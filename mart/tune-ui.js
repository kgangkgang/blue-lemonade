// 11-11 글꾸 마트 크게 보기 창의 「조절」 칸 — 틀 하나를 세세하게: 색 칩(깡통 · 깡캐 · 소품 · 제목 · 본문 · 대사) · 밤/낮 · 글 고치기(미리보기에서 바로) · 「내 글꾸」 저장.
//   값은 tune.js(틀마다) · tone-state.js(깡통 · 깡캐 · 밤낮 — 목록 위 두 칸과 같은 값). 고친 것은 카드 미리보기 · 「HTML 복사」에 같은 길(toneOut)로 들어가요.
//   색 칩은 글자색 칩(inks.js)과 같은 부품(.mart-ink) · 누르면 colorpop.js 의 마트 색 고르기. 바꾼 칸에만 ↺(그 칸만 원래 색).
import { toneState, setTone } from './tone-state.js?v=20261111g';
import { speakerPair, hasPropTone, hasOwnTone } from './simple-frames.js?v=20261111e';
import { TUNE_ROLES, EDIT_CLASSES, tuneOf, setTune, editables, mineList, saveMine, forgetMine } from './tune.js?v=20261111f';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const HEX = /^#[0-9a-f]{6}$/i;
const NEUTRAL = '#8b8e96';
const hexOf = (rgb) => { const m = String(rgb || '').match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/); return m ? '#' + m.slice(1, 4).map(v => Number(v).toString(16).padStart(2, '0')).join('') : null; };
const clone = t => JSON.parse(JSON.stringify(t || {}));
let editing = false;   // 「글 고치기」 켬 — 켜 둔 동안만 미리보기 글자를 고쳐 쓸 수 있어요(꺼져 있으면 소품 누르기 그대로)

/** 그 틀에 보일 색 칩 목록 — [{ key, label, title }] (틀에 있는 것만) */
function chipsOf(item) {
    const html = item.preview || '';
    const out = [{ key: 'k', label: '깡통', title: '깡통(첫째 화자) 색 — 목록 위 「깡통」 칸과 같은 값이에요' }, { key: 'k2', label: '깡캐', title: '깡캐(둘째 화자) 색 — 목록 위 「깡캐」 칸과 같은 값이에요' }];
    if (hasPropTone(html)) out.push({ key: 'prop', label: '소품', title: '소품 색 — 안 고르면 깡통 색을 따라가요' });
    for (const r of TUNE_ROLES) if (new RegExp(`class="(?:[^"]*\\s)?${r.cls}(?:\\s[^"]*)?"`).test(html)) out.push({ key: r.role, label: r.label, title: `${r.label} 글자색 — 밤 · 낮 판마다 따로 기억해요` });
    return out;
}
/** 지금 값 — { 칸: { value(보일 색), changed } } · previewRoot: 크게 보기 미리보기(글자색 원래 값을 화면에서 읽어요) */
function valuesOf(item, previewRoot) {
    const t = tuneOf(item.id), pair = speakerPair(item.preview || ''), mode = toneState.mode;
    const k = toneState.on ? (toneState.k || NEUTRAL) : (pair.main || NEUTRAL);
    const out = { k: { value: k, changed: toneState.on }, k2: { value: toneState.k2 || pair.other || NEUTRAL, changed: !!toneState.k2 }, prop: { value: t?.prop || k, changed: !!t?.prop } };
    for (const r of TUNE_ROLES) {
        const own = t?.inks?.[mode]?.[r.role];
        const el = previewRoot?.querySelector(`.gk ${r.sel}`);
        out[r.role] = { value: own || (el && hexOf(getComputedStyle(el).color)) || NEUTRAL, changed: !!own };
    }
    return out;
}
const mineHtml = (item) => {
    const list = mineList();
    if (!list.length) return '<p class="mart-tune-empty">아직 없어요 · 위에서 고친 모습을 이름 붙여 기억해 두면 여기서 다시 불러와요</p>';
    return `<ul class="mart-tune-mine">${list.map(x => `<li${x.frame === item.id ? ' class="is-here"' : ''}><button type="button" class="mart-tune-load" data-mine-load="${esc(x.id)}" title="불러오기"><i class="mart-ink-dot" style="background:${esc(x.tone.on && x.tone.k ? x.tone.k : NEUTRAL)}" aria-hidden="true"></i><b>${esc(x.name)}</b><span>${esc(x.frameName || x.frame)}</span></button><button type="button" class="mart-cast-x" data-mine-forget="${esc(x.id)}" aria-label="${esc(x.name)} 지우기" title="지우기">×</button></li>`).join('')}</ul>`;
};

/** 조절 칸(미리보기 위) — 색 칩 줄 + 판 · 글 고치기 줄 */
export function tuneHtml(item) {
    if (!item?.simple || !item.preview) return '';
    const chips = chipsOf(item).map(c => `<span class="mart-tune-chip"><label class="mart-ink" title="${esc(c.title)}"><input type="color" data-tune="${c.key}" value="${NEUTRAL}" aria-label="${esc(c.label)} 색"><span class="mart-ink-dot" aria-hidden="true"></span>${esc(c.label)}</label><button type="button" class="mart-tune-undo" data-tune-reset="${c.key}" title="${esc(c.label)} · 원래 색으로" aria-label="${esc(c.label)} · 원래 색으로" hidden>↺</button></span>`).join('');
    return `<section class="mart-tune" aria-label="조절"><div class="mart-inks mart-tune-colors" role="group" aria-label="색 — 눌러서 바꿔요"><span class="mart-inks-title">색</span>${chips}</div>
        <div class="mart-tune-line"><span class="mart-seg" role="group" aria-label="밤낮"><button type="button" class="chip" data-tune-mode="dark" aria-pressed="false">밤</button><button type="button" class="chip" data-tune-mode="light" aria-pressed="false">낮</button></span>${hasOwnTone(item.preview) ? '<span class="mart-seg mart-tune-own" role="group" aria-label="소품 색"><button type="button" class="chip" data-tune-own="1" aria-pressed="true">소품 기본 색</button><button type="button" class="chip" data-tune-own="0" aria-pressed="false">소품 캐릭터 색</button></span>' : ''}<button type="button" class="chip mart-tune-edit" data-tune-edit aria-pressed="false">글 고치기</button><button type="button" class="chip mart-tune-all" data-tune-reset="all" hidden>전부 처음으로</button></div>
        <p class="mart-tune-hint" hidden>미리보기의 글자를 눌러 바로 고쳐 써요 · 고치는 동안은 소품이 안 눌려요</p></section>`;
}
/** 「내 글꾸」 칸(미리보기 아래) — 이름 붙여 저장 · 불러오기 · 지우기 */
export function mineBoxHtml(item) {
    if (!item?.simple || !item.preview) return '';
    return `<section class="mart-tune-save" aria-label="내 글꾸"><h3 class="mart-tune-h">내 글꾸</h3><form class="mart-tune-form"><label class="field-wrap"><input type="text" class="field" name="name" maxlength="24" placeholder="이름을 붙여 기억해요" aria-label="내 글꾸 이름" required></label><button type="submit" class="btn">내 글꾸에 저장</button></form><div class="mart-tune-list">${mineHtml(item)}</div></section>`;
}
/** 조절 칸을 지금 값으로 맞춰요 — 칩을 새로 그리지 않아요(색 고르기 창이 떠 있는 칸이 안 날아가게) */
export function syncTune(sheet, item) {
    const box = sheet?.querySelector('.mart-tune'); if (!box || !item) return;
    const root = sheet.querySelector('.mart-sheet-preview'), v = valuesOf(item, root), t = tuneOf(item.id);
    for (const input of box.querySelectorAll('input[data-tune]')) {
        const cur = v[input.dataset.tune]; if (!cur) continue;
        if (document.activeElement !== input && !input.dataset.busy) input.value = cur.value;
        const dot = input.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = input.dataset.busy ? input.value : cur.value;
        const undo = input.closest('.mart-tune-chip')?.querySelector('[data-tune-reset]'); if (undo) undo.hidden = !cur.changed;
    }
    for (const b of box.querySelectorAll('[data-tune-mode]')) b.setAttribute('aria-pressed', String(b.dataset.tuneMode === toneState.mode));
    for (const b of box.querySelectorAll('[data-tune-own]')) b.setAttribute('aria-pressed', String((b.dataset.tuneOwn === '0') === (t?.own === false)));
    box.querySelector('[data-tune-edit]')?.setAttribute('aria-pressed', String(editing));
    const hint = box.querySelector('.mart-tune-hint'); if (hint) hint.hidden = !editing;
    const all = box.querySelector('[data-tune-reset="all"]'); if (all) all.hidden = !(t || toneState.on || toneState.k2);
}
export const syncMine = (sheet, item) => { const list = sheet?.querySelector('.mart-tune-list'); if (list && item) list.innerHTML = mineHtml(item); };

/** 미리보기의 글 자리를 고쳐 쓸 수 있게(「글 고치기」가 켜져 있을 때만) — 자리 번호는 tune.js editables 와 같은 차례 */
export function armEdit(previewRoot, item) {
    if (!previewRoot || !item?.simple) return;
    const root = previewRoot.querySelector('.gk'); if (!root) return;
    let i = 0;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let el = walk.nextNode(); el; el = walk.nextNode()) {
        if (el.childElementCount || ['STYLE', 'SCRIPT', 'AUDIO'].includes(el.tagName) || [...el.childNodes].some(n => n.nodeType === 8)) continue;
        let prev = el.previousSibling; while (prev && prev.nodeType === 3 && !prev.data.trim()) prev = prev.previousSibling;
        const marked = prev?.nodeType === 8 && /^\s*✎/.test(prev.data);
        if (!marked && !EDIT_CLASSES.some(c => el.classList.contains(c))) continue;
        el.dataset.blEd = String(i++);
        if (editing) { el.setAttribute('contenteditable', 'plaintext-only'); if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); }
        else { el.removeAttribute('contenteditable'); el.removeAttribute('spellcheck'); }
    }
    previewRoot.classList.toggle('is-editing', editing);
}

/** 크게 보기 창에 한 번만 걸어요 — current(): 지금 열린 카드 상태({ item }) · openItem(id): 그 틀의 크게 보기를 열어요 · say: 알림 */
export function wireTune(sheet, { current, openItem, say = () => {} }) {
    let timer = 0;
    const apply = (item, key, hex) => {
        if (!HEX.test(hex)) return;
        if (key === 'k') setTone({ on: true, k: hex, name: '' });
        else if (key === 'k2') setTone({ k2: hex, name2: '' });
        else { const t = clone(tuneOf(item.id)); if (key === 'prop') t.prop = hex; else ((t.inks ??= {})[toneState.mode] ??= {})[key] = hex; setTune(item.id, t); }
    };
    sheet.addEventListener('input', (e) => {
        const t = e.target, item = current()?.item; if (!item) return;
        if (t.matches?.('input[data-tune]')) {
            t.dataset.busy = '1';
            const dot = t.parentElement.querySelector('.mart-ink-dot'); if (dot) dot.style.backgroundColor = t.value;
            clearTimeout(timer); timer = setTimeout(() => { apply(item, t.dataset.tune, t.value); }, 150);
            return;
        }
        const ed = t.closest?.('.mart-sheet-preview [data-bl-ed]');
        if (ed && editing) {   // 글 고치기: 원래 글과 같아지면 그 자리 값은 지워요
            const cur = clone(tuneOf(item.id)), texts = cur.texts ??= {}, i = ed.dataset.blEd;
            const base = current().editBase ??= editables(item.preview).map(x => x.text);
            const now = ed.textContent.replace(/[\r\n]+/g, ' ');
            if (esc(now).replace(/&quot;/g, '"').replace(/&#39;/g, "'") === base[i]) delete texts[i]; else texts[i] = now;
            setTune(item.id, cur, { textOnly: true });
        }
    });
    sheet.addEventListener('change', (e) => { const t = e.target; if (t.matches?.('input[data-tune]')) { delete t.dataset.busy; const item = current()?.item; if (item) { clearTimeout(timer); apply(item, t.dataset.tune, t.value); } } });
    sheet.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest?.('.mart-sheet-preview [data-bl-ed]')) e.preventDefault(); });
    // 고치는 동안 글자를 눌러도 소품(summary)이 열리고 닫히지 않게
    sheet.addEventListener('click', (e) => { if (editing && e.target.closest?.('.mart-sheet-preview [data-bl-ed]') && e.target.closest('summary')) e.preventDefault(); }, true);
    sheet.addEventListener('click', (e) => {
        const item = current()?.item; if (!item) return;
        const m = e.target.closest?.('[data-tune-mode]'); if (m) { setTone({ mode: m.dataset.tuneMode }); return; }
        const own = e.target.closest?.('[data-tune-own]'); if (own) { const t = clone(tuneOf(item.id)); if (own.dataset.tuneOwn === '0') t.own = false; else delete t.own; setTune(item.id, t); return; }
        if (e.target.closest?.('[data-tune-edit]')) { editing = !editing; armEdit(sheet.querySelector('.mart-sheet-preview'), item); syncTune(sheet, item); return; }
        const r = e.target.closest?.('[data-tune-reset]');
        if (r) {
            const key = r.dataset.tuneReset;
            if (key === 'all') { setTune(item.id, null); setTone({ on: false, k2: null }); return; }
            if (key === 'k') { setTone({ on: false }); return; }
            if (key === 'k2') { setTone({ k2: null }); return; }
            const t = clone(tuneOf(item.id));
            if (key === 'prop') delete t.prop; else if (t.inks?.[toneState.mode]) delete t.inks[toneState.mode][key];
            setTune(item.id, t); return;
        }
        const load = e.target.closest?.('[data-mine-load]');
        if (load) {
            const x = mineList().find(v => v.id === load.dataset.mineLoad); if (!x) return;
            setTune(x.frame, x.tune);
            setTone(x.tone.on ? { on: true, k: x.tone.k, name: x.tone.name, k2: x.tone.k2, name2: x.tone.name2, mode: x.tone.mode } : { on: false, k2: x.tone.k2, name2: x.tone.name2, mode: x.tone.mode });
            if (x.frame !== item.id) openItem(x.frame);
            say(`「${x.name}」을 불러왔어요`, 2400);
            return;
        }
        const del = e.target.closest?.('[data-mine-forget]');
        if (del) { forgetMine(del.dataset.mineForget); syncMine(sheet, item); }
    });
    sheet.addEventListener('submit', (e) => {
        const f = e.target.closest?.('.mart-tune-form'); if (!f) return;
        e.preventDefault();
        const item = current()?.item; if (!item) return;
        const row = saveMine({ frame: item.id, frameName: item.name || item.label, name: f.name.value, tone: { on: toneState.on, k: toneState.k, name: toneState.name, k2: toneState.k2, name2: toneState.name2, mode: toneState.mode, none: toneState.none }, tune: tuneOf(item.id) });
        if (!row) { say('이름을 넣어 주세요', 2400); return; }
        f.name.value = ''; syncMine(sheet, item);
        say(`「${row.name}」을 내 글꾸에 기억했어요 · 이 브라우저에 남아요`, 3000);
    });
}
