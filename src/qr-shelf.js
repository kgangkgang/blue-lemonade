// QR 책장 (1.0.3 · 기본 끔) — QR 줄의 책 단추(layout.js syncQrShelf)를 처음 누를 때 받는 창.
//   칸: 즐겨찾기 · 최근(책장에서 누른 것) · 이 봇(채팅 · 캐릭터에 묶인 세트) · 세계관 · 카테고리들 · 미분류 · 전체 + 찾기.
//   QR 마다 이름 · 설명 · 카테고리 · 즐겨찾기 · 숨기기를 테마 설정 qrShelf.items 에 적어요(실리태번 QR 원본은 그대로).
//   누르면 창을 닫고 그 QR 의 execute() — 실리태번 QR 줄을 누를 때와 같은 길이에요.
//   AI 한 번에 정리: 단추를 눌렀을 때만, 보낼 개수 · 대략 토큰을 묻고 지금 연결로 한 번 → 미리 보기에서 고치거나 버려요.
//   결과를 보관함으로: 다른 확장이 연 보관함 창구(qr-shelf-keep.js)가 있을 때만 보여요.
//   창은 실리태번 Popup · 모양은 qr-shelf.css(이 모듈이 처음 열 때 <link>). 창이 열려 있는 동안만 창 안 누름 · 입력 리스너가 있어요.
import { getSettings, saveSettings } from './settings.js';
import { ask, attachUndo } from './ask.js';
import { hardenInfoPopup } from './popup-guard.js';
import { installTabScroll, applyFade, revealTab } from './tab-scroll.js';
import * as core from './qr-shelf-core.js';
import { keeper, keeperLabel, toward, watchReply } from './qr-shelf-keep.js';
import { starIconSvg } from './state-icons.js';

const TAB_KEY = 'bl-qrs-tab';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ctx = () => globalThis.SillyTavern?.getContext?.();
const toast = () => globalThis.toastr;

let popup = null, root = null, items = [], state = null, pending = null, cssOn = false, tidied = null;

// ───────── 저장 ─────────
/** 다듬은 저장값 — 설정이 통째로 바뀌었을 때(불러오기 · 되돌리기)만 다시 다듬어요 */
function store() {
    const s = getSettings();
    if (s.qrShelf && s.qrShelf === tidied) return tidied;
    const tidy = core.tidyStore(s.qrShelf);
    s.qrShelf = tidied = tidy;
    return tidy;
}
const save = () => saveSettings();
function snapshot() { const st = store(); return structuredClone({ items: st.items, recent: st.recent }); }
function restore(before) { const s = getSettings(); s.qrShelf = { ...s.qrShelf, items: before.items, recent: before.recent }; save(); paint(); }

function readTab() { try { return localStorage.getItem(TAB_KEY) || 'all'; } catch { return 'all'; } }
function writeTab(tab) { try { localStorage.setItem(TAB_KEY, tab); } catch { /* 기억 못 해도 돼요 */ } }

function ensureCss() {
    if (cssOn || document.getElementById('bl-qr-shelf-style')) { cssOn = true; return; }
    const link = document.createElement('link');
    link.id = 'bl-qr-shelf-style'; link.rel = 'stylesheet';
    link.href = new URL('./qr-shelf.css', import.meta.url).href;
    (document.head || document.documentElement).append(link);
    cssOn = true;
}

// ───────── 그리기 ─────────
function rowHtml(st, item, keep) {
    const m = core.metaOf(st, item);
    const icon = item.icon ? `<i class="fa-solid ${esc(item.icon)}" aria-hidden="true"></i>` : '';
    const desc = core.descOf(st, item);
    const where = [item.set, m.c && m.c !== item.set ? m.c : ''].filter(Boolean).join(' · ');
    const marks = `${m.h ? '<i class="fa-solid fa-eye-slash" title="숨김" aria-label="숨김"></i>' : ''}${m.k && keep ? `<i class="fa-solid fa-box-archive" title="답을 ${esc(toward(keeperLabel(keep)))}" aria-label="답을 ${esc(toward(keeperLabel(keep)))}"></i>` : ''}`;
    if (state.editing === item.key) return editHtml(st, item, keep);
    return `<div class="bl-qrs-row${m.h ? ' bl-qrs-hidden' : ''}" role="listitem" data-key="${esc(encodeURIComponent(item.key))}">
        <button type="button" class="bl-qrs-run" data-act="run"><span class="bl-qrs-name">${icon}<b>${esc(core.nameOf(st, item))}</b>${marks}</span>${desc ? `<small class="bl-qrs-desc">${esc(desc)}</small>` : ''}<small class="bl-qrs-where">${esc(where)}</small></button>
        <button type="button" class="bl-qrs-icon bl-qrs-fav" data-act="fav" aria-pressed="${m.f ? 'true' : 'false'}" aria-label="${m.f ? '즐겨찾기 빼기' : '즐겨찾기'}" title="${m.f ? '즐겨찾기 빼기' : '즐겨찾기'}">${starIconSvg(m.f)}</button>
        <button type="button" class="bl-qrs-icon bl-qrs-edit-btn" data-act="edit" aria-label="이름 · 설명 고치기" title="이름 · 설명 고치기"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
    </div>`;
}
function editHtml(st, item, keep) {
    const m = core.metaOf(st, item);
    const field = (name, label, value, max, extra = '') => `<label class="bl-qrs-field"><span>${label}</span><input type="text" class="text_pole" name="${name}" value="${esc(value || '')}" maxlength="${max}" autocomplete="off" spellcheck="false"${extra}></label>`;
    return `<div class="bl-qrs-row bl-qrs-editing" role="listitem" data-key="${esc(encodeURIComponent(item.key))}"><div class="bl-qrs-edit">
        <div class="bl-qrs-edit-head"><b>${esc(item.label || item.title || '(이름 없음)')}</b><small>${esc(item.set)}</small></div>
        ${field('n', '이름', m.n, core.LIMITS.n, ` placeholder="${esc(item.label)}"`)}
        ${field('d', '설명', m.d, core.LIMITS.d, ' placeholder="한 줄 설명"')}
        ${field('c', '카테고리', m.c, core.LIMITS.c, ` list="bl-qrs-cats" placeholder="${esc(core.WORLD)} · 전투 · 일상 …"`)}
        <div class="bl-qrs-checks">
            <label class="checkbox_label"><input type="checkbox" name="h"${m.h ? ' checked' : ''}><span>책장에서 숨기기</span></label>
            ${keep ? `<label class="checkbox_label"><input type="checkbox" name="k"${m.k ? ' checked' : ''}><span>답을 ${esc(toward(keeperLabel(keep)))}</span></label>` : ''}
        </div>
        <div class="bl-qrs-btns"><button type="button" class="menu_button" data-act="save">저장</button><button type="button" class="menu_button" data-act="cancel">취소</button></div>
    </div></div>`;
}
function previewHtml(st) {
    const ai = state.ai;
    const rows = ai.rows.map((r, i) => `<div class="bl-qrs-prev${r.use ? '' : ' bl-qrs-off'}" data-i="${i}">
        <label class="checkbox_label"><input type="checkbox" data-ai-use="${i}"${r.use ? ' checked' : ''}><b>${esc(r.label)}</b></label>
        <input type="text" class="text_pole" data-ai="n" data-i="${i}" value="${esc(r.n)}" maxlength="${core.LIMITS.n}" aria-label="이름">
        <input type="text" class="text_pole" data-ai="d" data-i="${i}" value="${esc(r.d)}" maxlength="${core.LIMITS.d}" aria-label="설명">
        <input type="text" class="text_pole" data-ai="c" data-i="${i}" value="${esc(r.c)}" maxlength="${core.LIMITS.c}" list="bl-qrs-cats" aria-label="카테고리">
    </div>`).join('');
    const note = ai.rows.length ? `AI 가 ${ai.rows.length}개를 채웠어요. 고치거나 체크를 풀고 「채우기」를 눌러요.${ai.dropped ? ` (알아보지 못한 줄 ${ai.dropped}개는 뺐어요)` : ''}` : '채울 것을 받지 못했어요.';
    return `<div class="bl-qrs-ai-note">${esc(note)}</div>${rows}
        <div class="bl-qrs-btns">${ai.rows.length ? '<button type="button" class="menu_button" data-act="ai-apply">채우기</button>' : ''}<button type="button" class="menu_button" data-act="ai-drop">버리기</button></div>`;
}
function listHtml(st) {
    if (state.ai) return previewHtml(st);
    const keep = keeper();
    const q = state.q.trim();
    const list = q ? core.search(st, items, q, { showHidden: state.showHidden }) : core.listFor(st, items, state.tab, { showHidden: state.showHidden });
    if (!items.length) return '<div class="bl-qrs-empty">퀵 리플라이가 없어요. 실리태번 확장 › Quick Reply 에서 세트를 묶어요.</div>';
    if (!list.length) {
        const why = q ? '찾은 것이 없어요.' : state.tab === 'fav' ? '☆ 를 누르면 여기에 모여요.' : state.tab === 'recent' ? '책장에서 누른 QR 이 여기에 남아요.' : '이 칸에는 QR 이 없어요.';
        return `<div class="bl-qrs-empty">${why}</div>`;
    }
    return list.map(item => rowHtml(st, item, keep)).join('');
}
function tabsHtml(st) {
    return core.tabsFor(st, items).map(t => `<button type="button" role="tab" data-tab="${esc(t.id)}" aria-selected="${!state.q.trim() && state.tab === t.id ? 'true' : 'false'}"><i class="fa-solid ${t.icon}" aria-hidden="true"></i><span>${esc(t.label)}</span>${t.count ? `<small>${t.count}</small>` : ''}</button>`).join('');
}
function paint() {
    if (!root) return;
    const st = store();
    const tabs = core.tabsFor(st, items);
    if (!state.q.trim() && !tabs.some(t => t.id === state.tab)) state.tab = 'all';
    const hidden = items.filter(i => core.metaOf(st, i).h).length;
    const bar = root.querySelector('.bl-qrs-tabs');
    bar.innerHTML = tabsHtml(st);
    root.querySelector('.bl-qrs-list').innerHTML = listHtml(st);
    const ai = root.querySelector('[data-act="ai"]');
    ai.disabled = !!state.busy || !!state.ai;
    ai.querySelector('span').textContent = state.busy ? '정리하는 중…' : 'AI 정리';
    const hide = root.querySelector('[data-act="hidden"]');
    hide.hidden = !hidden;
    hide.setAttribute('aria-pressed', state.showHidden ? 'true' : 'false');
    hide.querySelector('span').textContent = state.showHidden ? `숨긴 것 감추기` : `숨긴 것 ${hidden}`;
    root.querySelector('#bl-qrs-cats').innerHTML = [core.WORLD, ...core.categories(st, items)].map(c => `<option value="${esc(c)}"></option>`).join('');
    requestAnimationFrame(() => { revealTab(bar, bar.querySelector('[aria-selected="true"]')); applyFade(bar); });
}

// ───────── 하는 일 ─────────
const itemOf = el => { const key = el?.closest?.('[data-key]')?.dataset.key; return key ? items.find(i => i.key === decodeURIComponent(key)) || null : null; };
function run(item) {
    pending = item;
    popup?.complete?.(ctx()?.POPUP_RESULT?.AFFIRMATIVE ?? 1);
}
async function runNow(item) {
    const st = store();
    core.pushRecent(st, item.key); save();
    const meta = core.metaOf(st, item);
    const k = meta.k ? keeper() : null;
    let watch = null;
    if (k) watch = watchReply({ ctx: ctx(), keep: k, title: core.nameOf(st, item), label: item.label });
    try { await item.qr?.execute?.(); }
    catch (error) { watch?.stop(); console.warn('[Blue Lemonade] QR 책장 실행', error); toast()?.warning?.('QR 을 실행하지 못했어요.', 'QR 책장'); }
}
function saveEdit(row, item) {
    const before = snapshot(), st = store();
    const get = name => row.querySelector(`[name="${name}"]`);
    const changed = core.setMeta(st, item.key, { n: get('n')?.value, d: get('d')?.value, c: get('c')?.value, h: !!get('h')?.checked, ...(get('k') ? { k: !!get('k').checked } : {}) });
    state.editing = null;
    if (changed) { save(); attachUndo(toast()?.info?.('QR 이름표를 고쳤어요.', 'QR 책장'), () => restore(before)); }
    paint();
}
function toggleFav(item) {
    const st = store();
    core.setMeta(st, item.key, { f: !core.metaOf(st, item).f });
    save(); paint();
}
function modelName(c) {
    try { if (c.mainApi === 'openai' && typeof c.getChatCompletionModel === 'function') return String(c.getChatCompletionModel() || ''); } catch { /* 모름 */ }
    return typeof c.onlineStatus === 'string' && c.onlineStatus !== 'no_connection' ? c.onlineStatus : '';
}
async function countTokens(messages) {
    const text = messages.map(m => m.content).join('\n');
    try { const c = ctx(); if (typeof c?.getTokenCountAsync === 'function') return await c.getTokenCountAsync(text); } catch { /* 어림 */ }
    return Math.ceil(text.length / 2);
}
/** 시험이 바꿔 끼우는 보내기 (기본: 실리태번 지금 연결 generateRaw · 프리셋 · 대화는 안 붙임) */
export const send = { raw: async (messages, responseLength) => {
    const c = ctx();
    if (typeof c?.generateRaw !== 'function') throw new Error('실리태번 생성 함수를 찾지 못했어요');
    return c.generateRaw({ prompt: messages, responseLength, trimNames: false });
} };
async function organize() {
    if (state.busy || state.ai) return;
    const st = store();
    const { list, rest } = core.aiTargets(st, items);
    if (!list.length) { toast()?.info?.('이름 · 설명 · 카테고리가 빈 QR 이 없어요.', 'QR 책장'); return; }
    const c = ctx();
    if (!c || c.onlineStatus === 'no_connection') { toast()?.warning?.('실리태번이 모델에 연결돼 있지 않아요. 연결한 뒤 다시 눌러 주세요.', 'QR 책장'); return; }
    const messages = core.aiMessages(st, list, core.categories(st, items));
    const tokens = await countTokens(messages);
    const reply = core.aiResponseTokens(list.length);
    const model = modelName(c);
    const ok = await ask(`이름 · 설명 · 카테고리가 빈 QR ${list.length}개를 ${model ? `지금 연결(${model})` : '지금 연결'}에 한 번 보내요.${rest ? `\n나머지 ${rest}개는 다음에 한 번 더 눌러요.` : ''}\n보내는 것: 세트 이름 · QR 이름표 · 내용 앞 ${core.AI_BODY}자 (대화 · 캐릭터는 안 보내요)\n대략 보내기 ${tokens.toLocaleString('ko-KR')} 토큰 + 답 최대 ${reply.toLocaleString('ko-KR')} 토큰 · 요금이 들 수 있어요.\n받은 답은 미리 보기에서 고치거나 버릴 수 있어요.`, { ok: '보내기', cancel: '취소', title: 'AI 한 번에 정리' });
    if (!ok || !root) return;
    state.busy = true; paint();
    try {
        const text = await send.raw(messages, reply);
        if (!root) return;
        const parsed = core.aiParse(text, store(), list);
        state.ai = { rows: parsed.rows.map(r => ({ ...r, use: true })), dropped: parsed.dropped };
    } catch (error) {
        console.warn('[Blue Lemonade] QR 책장 AI 정리', error);
        toast()?.warning?.(`정리를 받지 못했어요. ${error?.message || ''}`.trim(), 'QR 책장');
    } finally { state.busy = false; paint(); }
}
function applyAi() {
    const st = store(), before = snapshot();
    let n = 0;
    for (const r of state.ai.rows) if (r.use && core.setMeta(st, r.key, { n: r.n, d: r.d, c: r.c })) n++;
    state.ai = null;
    if (n) { save(); attachUndo(toast()?.success?.(`QR ${n}개에 이름 · 설명 · 카테고리를 채웠어요.`, 'QR 책장'), () => restore(before)); }
    paint();
}

// ───────── 창 ─────────
function bind() {
    root.addEventListener('click', event => {
        const el = event.target.closest?.('[data-act], [data-tab]');
        if (!el || !root.contains(el)) return;
        if (el.dataset.tab) { state.tab = el.dataset.tab; state.q = ''; root.querySelector('.bl-qrs-search').value = ''; state.editing = null; writeTab(state.tab); paint(); return; }
        const act = el.dataset.act, item = itemOf(el);
        if (act === 'run' && item) run(item);
        else if (act === 'fav' && item) toggleFav(item);
        else if (act === 'edit' && item) { state.editing = item.key; paint(); root.querySelector('.bl-qrs-editing input[name="n"]')?.focus({ preventScroll: true }); }
        else if (act === 'save' && item) saveEdit(el.closest('.bl-qrs-row'), item);
        else if (act === 'cancel') { state.editing = null; paint(); }
        else if (act === 'hidden') { state.showHidden = !state.showHidden; if (state.showHidden && !state.q.trim()) state.tab = 'all'; paint(); }
        else if (act === 'ai') organize();
        else if (act === 'ai-apply') applyAi();
        else if (act === 'ai-drop') { state.ai = null; paint(); }
    });
    root.addEventListener('input', event => {
        const t = event.target;
        if (t.classList?.contains('bl-qrs-search')) { state.q = t.value; state.editing = null; paint(); return; }
        if (state.ai && t.dataset?.ai) { const r = state.ai.rows[Number(t.dataset.i)]; if (r) r[t.dataset.ai] = t.value; }
    });
    root.addEventListener('change', event => {
        const t = event.target;
        if (state.ai && t.dataset?.aiUse !== undefined) { const r = state.ai.rows[Number(t.dataset.aiUse)]; if (r) { r.use = t.checked; t.closest('.bl-qrs-prev')?.classList.toggle('bl-qrs-off', !t.checked); } }
    });
    root.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.isComposing) return;
        const row = event.target.closest?.('.bl-qrs-editing');
        if (row && event.target.matches('input[type="text"]')) { event.preventDefault(); const item = itemOf(row); if (item) saveEdit(row, item); }
    });
    root.querySelector('.bl-qrs-tabs').addEventListener('scroll', e => applyFade(e.currentTarget), { passive: true });
}

/** QR 줄의 책 단추가 불러요. 열려 있으면 닫아요 */
export async function openQrShelf() {
    if (popup) { popup.complete?.(ctx()?.POPUP_RESULT?.CANCELLED ?? 0); return; }
    const c = ctx();
    if (!c?.Popup || !c?.POPUP_TYPE) { toast()?.warning?.('이 실리태번 판에서는 QR 책장을 열 수 없어요.', 'QR 책장'); return; }
    ensureCss();
    installTabScroll(['.bl-qrs-tabs']);
    items = core.collect(globalThis.quickReplyApi?.settings);
    state = { tab: readTab(), q: '', editing: null, showHidden: false, busy: false, ai: null };
    root = document.createElement('div');
    root.className = 'bl-qrs';
    root.innerHTML = `<div class="bl-qrs-head"><i class="fa-solid fa-book-bookmark" aria-hidden="true"></i><b>QR 책장</b><small>${items.length}</small></div>
        <div class="bl-qrs-bar"><input type="search" class="text_pole bl-qrs-search" placeholder="찾기 (이름 · 설명 · 내용)" aria-label="QR 찾기" autocomplete="off" spellcheck="false">
            <button type="button" class="menu_button bl-qrs-ai" data-act="ai"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span>AI 정리</span></button></div>
        <div class="bl-qrs-tabs" role="tablist" aria-label="QR 칸"></div>
        <div class="bl-qrs-list" role="list"></div>
        <div class="bl-qrs-foot"><button type="button" class="menu_button bl-qrs-hidden-btn" data-act="hidden" aria-pressed="false" hidden><i class="fa-solid fa-eye-slash" aria-hidden="true"></i><span></span></button></div>
        <datalist id="bl-qrs-cats"></datalist>`;
    bind();
    paint();
    pending = null;
    popup = new c.Popup(root, c.POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: p => { p?.dlg?.classList?.add('bl-qrs-dialog'); hardenInfoPopup(p); } });
    try { await popup.show(); }
    finally {
        popup = null; root = null; state = null;
        const item = pending; pending = null; items = [];   // 닫으면 모은 QR 을 놓아요
        if (item) await runNow(item);
    }
}

export const _forTest = { get state() { return state; }, get root() { return root; }, send };
