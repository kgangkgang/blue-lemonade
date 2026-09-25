// 메모 — 제목 + 내용을 적어 두는 쪽지 묶음 (커뮤니티 요청 2026-09-25: 껐다 켜도 남고, 항목마다 제목·내용, 지우기·복제·순서 바꾸기)
// 저장: extension_settings['bl-notes'] (실리태번 설정 파일에 같이 저장 → 새로고침 · 기기 사이 동기화에도 남는다)
//   { notes:[{id,title,body,updated}], stickies:{id:{x,y,w,h}}, look:{font,size,lh,ls,weight} }
// 보기: 큰 창(요술봉 · ☰ 길게) · 입력창 위 메모 줄(칩 = 한 메모 펼침, ☰ 짧게 = 미니 목록) · PC 스티커(화면에 꺼내 두기)
// 내용은 채팅 본문과 같은 길(messageFormatting → 표시 정규식 · 마크다운 · 대사 색 · 감정 대사)로 그리고, 누르면 편집 칸으로 바뀐다.
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { saveSettingsDebounced, messageFormatting, eventSource, event_types, getThumbnailUrl, getRequestHeaders } from '../../../../../../../script.js';
import { verifyAddonCss } from '../../addon-files-check.js';
import { getSettings } from '../../settings.js';
import { wrapSpanningQuotes } from '../../dialogue-span.js';
import { dressBody } from '../../dem-expressive.js';
import { allFonts, findFont, loadFont, fontStack, fontsFor, previewStack, queuePreview, GROUPS, SAMPLES } from '../../fonts.js';
import { restorePreviewRules } from '../../lite.js';
import { PALETTES, PALETTE_FAMILIES } from '../../palettes.js';

export const VERSION = '1.1.0';
const MODULE = 'bl-notes';
const TITLE = '메모';
const MAX_NOTES = 300;
const LOOK_DEFAULT = { font: '', size: 100, lh: '', ls: '', weight: '', cols: 'auto', sort: 'manual' };

function store() {
    const s = extension_settings[MODULE] ??= {};
    if (!Array.isArray(s.notes)) s.notes = [];
    s.notes = s.notes.filter(n => n && typeof n === 'object').map(n => ({ id: String(n.id || uid()), title: String(n.title ?? ''), body: String(n.body ?? ''), updated: Number(n.updated) || 0, color: /^#[0-9a-f]{6}$/i.test(String(n.color || '')) ? n.color : '', ink: /^#[0-9a-f]{6}$/i.test(String(n.ink || '')) ? n.ink : '', ...(n.owner && typeof n.owner === 'object' ? { owner: n.owner } : {}) }));
    if (!s.look || typeof s.look !== 'object') s.look = { ...LOOK_DEFAULT };
    s.version = VERSION;
    return s;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let barTimer = 0;
const save = () => { saveSettingsDebounced(); clearTimeout(barTimer); barTimer = setTimeout(renderBar, 120); };
export const notes = () => store().notes;
export const look = () => store().look;
/** 지금 열린 채팅 (없으면 null = 전체) — key 는 캐릭터(또는 그룹) + 채팅 파일 이름. 채팅 이름을 바꾸면 CHAT_RENAMED 에서 따라 고친다 */
export function currentOwner() {
    const c = getContext(); if (!c?.chatId) return null;
    if (c.groupId) { const g = c.groups?.find(x => x.id === c.groupId); return { key: `g:${c.groupId}/${c.chatId}`, chat: String(c.chatId), group: c.groupId, name: g?.name || '그룹', avatar: g?.avatar_url || '' }; }
    const ch = c.characters?.[c.characterId]; if (!ch) return null;
    return { key: `${ch.avatar}/${c.chatId}`, chat: String(c.chatId), avatar: ch.avatar, name: ch.name };
}
/** 지금 보이는 메모: 전체 메모 + 지금 채팅에 귀속된 메모 */
export function visibleNotes() { const key = currentOwner()?.key; return notes().filter(n => !n.owner || n.owner.key === key); }
const SORTS = [['manual', '직접 정한 순', 'fa-grip-lines'], ['name', '가나다순', 'fa-arrow-down-a-z'], ['time', '최근 고친 순', 'fa-clock-rotate-left']];
const sortName = note => (note.title || note.body || '').trim();
/** 보이는 순서: 직접 정한 순(저장 순서) · 가나다순(제목, 없으면 내용) · 최근 고친 순 */
export function orderedNotes() {
    const list = [...visibleNotes()], mode = look().sort || 'manual';
    if (mode === 'name') list.sort((a, b) => sortName(a).localeCompare(sortName(b), 'ko', { numeric: true, sensitivity: 'base' }));
    else if (mode === 'time') list.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return list;
}

// ── 자료 ───────────────────────────────────────────────────
export function addNote(title = '', body = '', at = 0) {
    const list = notes();
    if (list.length >= MAX_NOTES) { globalThis.toastr?.warning(`메모는 ${MAX_NOTES}개까지예요.`, TITLE); return null; }
    const owner = currentOwner();
    const note = { id: uid(), title, body, updated: Date.now(), ...(owner ? { owner } : {}) };
    list.splice(Math.max(0, Math.min(at, list.length)), 0, note);
    save(); return note;
}
export function removeNote(id) { const list = notes(), i = list.findIndex(n => n.id === id); if (i < 0) return false; list.splice(i, 1); save(); return true; }
export function duplicateNote(id) { const list = notes(), i = list.findIndex(n => n.id === id); if (i < 0) return null; const made = addNote(list[i].title, list[i].body, i + 1); if (made) { made.color = list[i].color || ''; made.ink = list[i].ink || ''; if (list[i].owner) made.owner = { ...list[i].owner }; save(); } return made; }
export function moveNote(id, delta) {
    // 보이는 메모끼리 자리 바꿈 (다른 채팅 메모는 건너뜀)
    const list = notes(), vis = orderedNotes().map(n => n.id), vi = vis.indexOf(id), vj = vi + delta;
    if (vi < 0 || vj < 0 || vj >= vis.length) return false;
    const i = list.findIndex(n => n.id === id), j = list.findIndex(n => n.id === vis[vj]);
    [list[i], list[j]] = [list[j], list[i]]; save(); return true;
}
export function updateNote(id, patch) { const note = notes().find(n => n.id === id); if (!note) return false; Object.assign(note, patch, { updated: Date.now() }); save(); syncViews(id); return true; }

// ── 내용 그리기 (채팅 본문과 같은 길) ──────────────────────
/** host(.bl-notes-view) 안에 채팅처럼 그린다: 표시 정규식 · 마크다운 · 대사 q · 감정 대사 */
let previewRulesOn = false;
const TASK_RE = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\](?=\s|$)/gm;
/** k 번째 체크 목록 줄의 [ ] ↔ [x] */
function toggleTask(text, k) {
    let n = -1;
    return String(text).replace(TASK_RE, (all, lead, mark) => (++n === k ? `${lead}[${mark.trim() ? ' ' : 'x'}]` : all));
}
/** 그린 목록에서 '[ ] ' · '[x] ' 로 시작하는 항목을 상자로 — 순서대로 번호를 붙여 원문의 k 번째와 짝짓는다 */
function drawTasks(body, onToggle) {
    let k = 0;
    for (const li of body.querySelectorAll('li')) {
        const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode(); while (node && !node.data.trim()) node = walker.nextNode();
        if (!node || node.parentElement.closest('li') !== li) continue;
        const m = /^\s*\[([ xX])\]\s?/.exec(node.data); if (!m) continue;
        node.data = node.data.slice(m[0].length);
        const done = !!m[1].trim(), index = k++;
        const box = document.createElement('span');
        box.className = 'bl-note-check' + (done ? ' is-on' : ''); box.setAttribute('role', 'checkbox'); box.setAttribute('aria-checked', String(done)); box.tabIndex = 0; box.title = done ? '체크 풀기' : '체크';
        box.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i>';
        const fire = event => { event.preventDefault(); event.stopPropagation(); onToggle?.(index); };
        box.addEventListener('click', fire); box.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') fire(e); });
        node.parentNode.insertBefore(box, node);
        li.classList.add('bl-task'); li.classList.toggle('is-done', done); li.parentElement?.classList.add('bl-tasklist');
    }
}
function renderView(host, text, onToggle) {
    // 채팅 서식의 사본 규칙(.salty-preview …)은 시작 속도 때문에 꺼져 있다 — 처음 그릴 때 한 번 켠다 (북마크 창과 같음)
    if (!previewRulesOn) { previewRulesOn = true; try { restorePreviewRules(); } catch { /* 표시용 */ } }
    if (!host.firstChild) host.innerHTML = '<div class="mes"><div class="mes_block"><div class="mes_text"></div></div></div>';
    const body = host.querySelector('.mes_text');
    const raw = String(text ?? '').trim();
    if (!raw) { body.innerHTML = ''; return; }
    try { body.innerHTML = messageFormatting(raw, '', false, false, -1, {}, false); }
    catch (error) { console.warn('[메모] 본문 그리기 실패:', error); body.textContent = raw; }
    try { drawTasks(body, onToggle); } catch (error) { console.warn('[메모] 체크 상자:', error); }
    try { wrapSpanningQuotes(body); } catch { /* 표시용 */ }
    try { dressBody(body, { mes: raw, extra: {} }); } catch { /* 표시용 */ }
}
/**
 * 내용 칸 = 그린 보기(.bl-notes-view) + 편집 textarea. 보기를 누르면 편집, 편집 칸에서 나가면 다시 보기.
 * 내용이 비어 있으면 편집 칸을 바로 보인다. commit(value, now) 는 저장 담당.
 */
// ── 편집 서식 줄 (마크다운 · 실리태번이 허용하는 태그로 감싼다 — 그린 보기에서 채팅과 같이 보인다) ──
//    기본은 접힘(펜 하나) — 펼치면 버튼들. 어떤 버튼을 어떤 순서로 둘지는 메모 설정(look.fmtButtons)에서.
const FMT_ALL = {
    b: ['fa-bold', '굵게', '**', '**'], i: ['fa-italic', '기울기 (속마음)', '*', '*'], s: ['fa-strikethrough', '취소선', '~~', '~~'], u: ['fa-underline', '밑줄', '<u>', '</u>'],
    h: ['fa-heading', '제목 (H1 · H2 · H3)', '', ''], list: ['fa-list-ul', '목록 (점 · 번호 · 체크)', '', ''], code: ['fa-code', '코드', '`', '`'], mark: ['fa-highlighter', '형광펜 (테마 형광펜 색)', '<mark>', '</mark>'],
    quote: ['fa-quote-left', '대사 따옴표', '"', '"'], color: ['fa-palette', '글자색', '', ''],
};
const FMT_DEFAULT = [['b', 1], ['i', 1], ['s', 1], ['u', 1], ['h', 1], ['list', 1], ['code', 1], ['mark', 1], ['quote', 0], ['color', 0]];
const SWATCHES = ['#e05a5a', '#e8913a', '#e6c23a', '#5fbf6a', '#3fb8c4', '#6f9cf5', '#a37ef0', '#f28cc0', '#9aa0a6'];
/** [{ k, on }] — 저장된 순서를 따르고, 새로 생긴 버튼은 기본값으로 뒤에 붙인다 */
function fmtButtons() {
    const saved = Array.isArray(look().fmtButtons) ? look().fmtButtons.filter(x => x && FMT_ALL[x.k]) : [];
    const seen = new Set(saved.map(x => x.k));
    return [...saved.map(x => ({ k: x.k, on: !!x.on })), ...FMT_DEFAULT.filter(([k]) => !seen.has(k)).map(([k, on]) => ({ k, on: !!on }))];
}
const popHtml = (key, inner) => `<span class="bl-note-fmt-h"><button type="button" class="bl-note-btn" data-fmt="${key}" title="${FMT_ALL[key][1]}" aria-label="${FMT_ALL[key][1]}"><i class="fa-solid ${FMT_ALL[key][0]}"></i></button><span class="bl-note-fmt-hs" data-pop="${key}" hidden>${inner}</span></span>`;
function toolsHtml() {
    return fmtButtons().filter(x => x.on).map(({ k }) => {
        if (k === 'h') return popHtml('h', [1, 2, 3].map(n => `<button type="button" class="bl-note-btn" data-heading="${n}" title="제목 ${n}" aria-label="제목 ${n}">H${n}</button>`).join(''));
        if (k === 'list') return popHtml('list', [['- ', 'fa-list-ul', '점 목록'], ['1. ', 'fa-list-ol', '번호 목록'], ['- [ ] ', 'fa-list-check', '체크박스 목록']].map(([mark, icon, name]) => `<button type="button" class="bl-note-btn" data-list="${mark}" title="${name}" aria-label="${name}"><i class="fa-solid ${icon}"></i></button>`).join(''));
        if (k === 'color') return popHtml('color', SWATCHES.map(c => `<button type="button" class="bl-note-swatch" data-color="${c}" title="${c}" aria-label="${c}" style="--sw:${c}"></button>`).join('') + '<button type="button" class="bl-note-swatch" data-color="" title="색 지우기" aria-label="색 지우기"><i class="fa-solid fa-ban"></i></button>');
        const [icon, name] = FMT_ALL[k];
        return `<button type="button" class="bl-note-btn" data-fmt="${k}" title="${name}" aria-label="${name}"><i class="fa-solid ${icon}"></i></button>`;
    }).join('');
}
/** 설정을 바꾸면 열려 있는 서식 줄을 모두 다시 그린다 */
function rebuildFmtBars() { document.querySelectorAll('.bl-note-fmt .bl-note-fmt-tools').forEach(el => { el.innerHTML = toolsHtml(); }); }
/** 선택한 글을 before · after 로 감싼다 (이미 감쌌으면 푼다). lineMode 는 줄 머리 표시(제목 · 목록)를 줄마다 붙이거나 뗀다 */
function surround(area, before, after, lineMode = false) {
    const start = area.selectionStart ?? area.value.length, end = area.selectionEnd ?? start, value = area.value;
    let s = start, e = end;
    if (lineMode) {
        s = value.lastIndexOf('\n', start - 1) + 1;
        const lines = value.slice(s, e).split('\n');
        const strip = l => l.replace(/^(#{1,6} |- \[[ xX]\] |- |\d+\. )/, '');
        const numbered = before === '1. ';
        const done = lines.every(l => numbered ? /^\d+\. /.test(l) : l.startsWith(before));
        const next = lines.map((l, k) => done ? strip(l) : (numbered ? `${k + 1}. ` : before) + strip(l)).join('\n');
        area.setRangeText(next, s, e, 'select');
    } else {
        const inner = value.slice(s, e);
        const wrapped = inner.startsWith(before) && inner.endsWith(after) && inner.length >= before.length + after.length ? inner.slice(before.length, inner.length - after.length) : before + inner + after;
        area.setRangeText(wrapped, s, e, inner ? 'select' : 'end');
        if (!inner) area.setSelectionRange(s + before.length, s + before.length);
    }
    area.dispatchEvent(new Event('input', { bubbles: true }));
}
/** 버튼 아래 팝업: 목록 상자(스크롤 칸)에 잘리지 않게 화면 기준(fixed)으로 띄우고, 화면 좌우 · 아래 8px 안으로 맞춘다.
 *  fixed 의 기준이 화면이 아닌 조상(변형 · 필터가 걸린 칸)이면 그린 뒤 어긋난 만큼 되돌려 맞춘다 */
function placePop(pop) {
    if (pop.hidden) { pop.style.position = ''; return; }
    const button = pop.parentElement?.querySelector(':scope > button') || pop.previousElementSibling;
    const b = button.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    Object.assign(pop.style, { position: 'fixed', right: 'auto', bottom: 'auto', left: '0px', top: '0px' });
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = Math.min(Math.max(8, b.left), vw - 8 - w), y = b.bottom + 4;
    if (y + h > vh - 8 && b.top - 4 - h > 8) y = b.top - 4 - h; // 아래가 모자라면 위로
    pop.style.left = `${Math.round(x)}px`; pop.style.top = `${Math.round(y)}px`;
    const r = pop.getBoundingClientRect(); // 기준이 화면이 아니면 어긋난 만큼 보정
    if (Math.abs(r.left - x) > 1 || Math.abs(r.top - y) > 1) { pop.style.left = `${Math.round(2 * x - r.left)}px`; pop.style.top = `${Math.round(2 * y - r.top)}px`; }
}
// 스크롤 · 창 크기가 바뀌면 열린 팝업을 닫는다 (버튼에서 떨어져 떠 있지 않게)
addEventListener('resize', () => document.querySelectorAll('.bl-note-fmt-hs:not([hidden])').forEach(p => { p.hidden = true; p.style.position = ''; }));
document.addEventListener('scroll', e => { if (e.target?.closest?.('.bl-notes-dialog, .bl-notes-mini, #chat')) document.querySelectorAll('.bl-note-fmt-hs:not([hidden])').forEach(p => { p.hidden = true; p.style.position = ''; }); }, true);
function formatBar(area) {
    const bar = document.createElement('div'); bar.className = 'bl-note-fmt'; bar.hidden = true;
    bar.innerHTML = `<button type="button" class="bl-note-btn bl-note-fmt-toggle" data-fmt="toggle" title="서식 버튼 펼치기 · 접기" aria-label="서식 버튼 펼치기 · 접기"><i class="fa-solid fa-pen-nib"></i></button><span class="bl-note-fmt-tools">${toolsHtml()}</span>`;
    bar.classList.toggle('is-open', !!look().fmtOpen);
    bar.addEventListener('pointerdown', event => event.preventDefault()); // 편집 칸의 초점(blur → 보기 전환)을 뺏지 않는다
    const pops = () => bar.querySelectorAll('.bl-note-fmt-hs');
    const closePops = (keep = null) => pops().forEach(p => { if (p !== keep) p.hidden = true; });
    const done = () => { closePops(); area.focus({ preventScroll: true }); };
    bar.addEventListener('click', event => {
        const heading = event.target.closest('[data-heading]'); if (heading) { surround(area, '#'.repeat(Number(heading.dataset.heading)) + ' ', '', true); done(); return; }
        const listKind = event.target.closest('[data-list]'); if (listKind) { surround(area, listKind.dataset.list, '', true); done(); return; }
        const color = event.target.closest('[data-color]');
        if (color) {
            const c = color.dataset.color;
            if (c) surround(area, `<font color="${c}">`, '</font>');
            else { const s = area.selectionStart, e = area.selectionEnd; area.setRangeText(area.value.slice(s, e).replace(/<\/?font\b[^>]*>/gi, ''), s, e, 'select'); area.dispatchEvent(new Event('input', { bubbles: true })); }
            done(); return;
        }
        const key = event.target.closest('[data-fmt]')?.dataset.fmt; if (!key) return;
        if (key === 'toggle') { store().look.fmtOpen = !look().fmtOpen; save(); document.querySelectorAll('.bl-note-fmt').forEach(b => b.classList.toggle('is-open', !!look().fmtOpen)); area.focus({ preventScroll: true }); return; }
        const pop = bar.querySelector(`[data-pop="${key}"]`);
        if (pop) { closePops(pop); pop.hidden = !pop.hidden; placePop(pop); return; }
        const f = FMT_ALL[key]; if (f) surround(area, f[2], f[3], false);
        done();
    });
    return bar;
}
function bodyField(view, area, getText, commit, mount = fmt => area.before(fmt)) {
    const fmt = formatBar(area); mount(fmt);
    const toggleAt = k => { const next = toggleTask(getText(), k); area.value = next; commit(next, true); draw(); };
    const draw = () => renderView(view, getText(), toggleAt);
    const show = editing => {
        const text = getText();
        const edit = editing || !text.trim();
        view.hidden = edit; area.hidden = !edit; fmt.hidden = !edit;
        if (!edit) draw();
        else grow(area);
    };
    view.title = '눌러서 고치기';
    view.addEventListener('click', event => { if (event.target.closest('a, details, summary, button, .bl-note-check')) return; show(true); area.focus({ preventScroll: true }); try { area.setSelectionRange(area.value.length, area.value.length); } catch { /* 표시용 */ } });
    area.addEventListener('blur', () => { commit(area.value, true); show(false); });
    area.addEventListener('input', () => { grow(area); commit(area.value, false); });
    // 목록 이어 쓰기: 엔터 → 다음 줄에 같은 표시(- · - [ ] · 다음 번호). 표시만 남은 빈 항목에서 엔터 → 표시를 지우고 목록 끝
    area.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
        const s = area.selectionStart, e = area.selectionEnd, value = area.value;
        if (s !== e) return;
        const lineStart = value.lastIndexOf('\n', s - 1) + 1, line = value.slice(lineStart, s);
        const m = /^(\s*)(- \[[ x]\] |- |(\d+)\. )(.*)$/.exec(line);
        if (!m) return;
        event.preventDefault();
        if (!m[4].trim()) { area.setRangeText('', lineStart, s, 'end'); area.dispatchEvent(new Event('input', { bubbles: true })); return; }
        const marker = m[3] ? `${Number(m[3]) + 1}. ` : (m[2].startsWith('- [') ? '- [ ] ' : '- ');
        area.setRangeText('\n' + m[1] + marker, s, e, 'end'); area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    show(false);
    return { show, refresh: () => { if (area.hidden) draw(); else if (document.activeElement !== area && area.value !== getText()) { area.value = getText(); grow(area); } } };
}
/** 저장된 값이 바뀌면(다른 보기에서 고침) 열린 카드 · 펼침 · 쪽지를 맞춘다 */
function syncViews(id) {
    for (const el of document.querySelectorAll(`.bl-note[data-id="${id}"], .bl-sticky[data-id="${id}"], .bl-notes-peek[data-id="${id}"]`)) el._sync?.();
}

// ── 메모지 색: 테마 팔레트(에이드마다 한 색 — 나이트 쪽 파스텔이라 밝은 · 어두운 테마 모두 어울림) + 내 색 ──
const NOTE_COLORS = () => Object.entries(PALETTE_FAMILIES).filter(([key]) => key !== 'custom').map(([key, fam]) => {
    const p = PALETTES[fam.dark] || PALETTES[fam.light] || {};
    const c = String(p.pop && p.pop !== p.accent ? p.accent : p.accent || '').trim();
    return /^#[0-9a-f]{6}$/i.test(c) ? [c, fam.sample || fam.label] : null;
}).filter(Boolean);
function paintNote(el, color, ink) {
    if (color) { el.style.setProperty('--bl-note-c', color); el.classList.add('has-color'); } else { el.style.removeProperty('--bl-note-c'); el.classList.remove('has-color'); }
    if (ink !== undefined) { if (ink) { el.style.setProperty('--bl-note-ink', ink); el.classList.add('has-ink'); } else { el.style.removeProperty('--bl-note-ink'); el.classList.remove('has-ink'); } }
}
function colorButton(id) { return `<span class="bl-note-fmt-h bl-note-colorwrap"><button type="button" class="bl-note-btn bl-note-colorbtn" data-note-color="${id}" title="메모지 색" aria-label="메모지 색"><span class="bl-note-colordot"></span></button><span class="bl-note-fmt-hs bl-note-colorpop" hidden></span></span>`; }
/** 색 고르기 팝업 — 메모지(기본 · 테마 팔레트 · 내 색) / 글자(기본 · 흰색 · 검정 · 테마 팔레트 · 내 색) */
function openColorPop(button, id) {
    const pop = button.nextElementSibling, note = notes().find(n => n.id === id); if (!pop || !note) return;
    if (!pop.hidden) { pop.hidden = true; placePop(pop); return; }
    const custom = (look().customColors || []).slice(0, 6), same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();
    const row = (kind, cur, extra) => `<div class="bl-note-colorrow"><span class="bl-note-colorlabel">${kind === 'color' ? '메모지' : '글자'}</span>`
        + `<button type="button" class="bl-note-swatch bl-note-swatch-none${cur ? '' : ' on'}" data-set-${kind}="" title="기본" aria-label="기본"><i class="fa-solid fa-ban"></i></button>`
        + [...extra, ...NOTE_COLORS(), ...custom.map(c => [c, `내 색 ${c}`])].map(([c, name]) => `<button type="button" class="bl-note-swatch${same(cur, c) ? ' on' : ''}" data-set-${kind}="${c}" title="${name}" aria-label="${name}" style="--sw:${c}"></button>`).join('')
        + `<label class="bl-note-swatch bl-note-swatch-add" title="내 색 고르기"><i class="fa-solid fa-plus"></i><input type="color" data-pick="${kind}" value="${cur || (kind === 'color' ? '#f5d547' : '#ffffff')}" aria-label="내 색 고르기"></label></div>`;
    pop.innerHTML = row('color', note.color, []) + row('ink', note.ink, [['#ffffff', '흰색'], ['#1b1a1f', '검정']]);
    pop.hidden = false; placePop(pop);
    const apply = (kind, c) => {
        updateNote(id, kind === 'color' ? { color: c } : { ink: c });
        const n = notes().find(x => x.id === id);
        document.querySelectorAll(`.bl-note[data-id="${id}"], .bl-sticky[data-id="${id}"]`).forEach(el => paintNote(el, n.color, n.ink));
        renderBar();
        pop.querySelectorAll(`[data-set-${kind}]`).forEach(b => b.classList.toggle('on', same(b.getAttribute(`data-set-${kind}`), c)));
    };
    pop.onclick = event => { const b = event.target.closest('[data-set-color], [data-set-ink]'); if (!b) return; event.stopPropagation(); const kind = b.hasAttribute('data-set-color') ? 'color' : 'ink'; apply(kind, b.getAttribute(`data-set-${kind}`)); };
    pop.querySelectorAll('input[type="color"]').forEach(input => {
        input.oninput = () => apply(input.dataset.pick, input.value);
        input.onchange = () => { store().look.customColors = [input.value, ...(look().customColors || []).filter(c => !same(c, input.value))].slice(0, 6); save(); };
    });
}
document.addEventListener('pointerdown', e => { if (!e.target.closest?.('.bl-note-colorwrap')) document.querySelectorAll('.bl-note-colorpop:not([hidden])').forEach(p => { p.hidden = true; placePop(p); }); }, true);
document.addEventListener('click', e => { const b = e.target.closest?.('[data-note-color]'); if (!b) return; e.preventDefault(); e.stopPropagation(); openColorPop(b, b.dataset.noteColor); }, true);

// ── 귀속 표시 · 바꾸기 ──────────────────────────────────────
const escA = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const ownerImg = o => o.group ? (o.avatar || '') : (o.avatar ? getThumbnailUrl('avatar', o.avatar) : '');
function ownerBadge(note) {
    const o = note.owner;
    if (!o) return `<span class="bl-note-owner is-global" data-owner="${note.id}" title="전체 메모 · 꾹 누르면 채팅에 귀속" role="button" tabindex="0"><i class="fa-solid fa-earth-asia"></i><span class="bl-note-owner-name" hidden>전체 메모</span></span>`;
    const img = ownerImg(o);
    return `<span class="bl-note-owner" data-owner="${note.id}" title="${escA(o.name)} · ${escA(o.chat)} (꾹 누르면 귀속 바꾸기)" role="button" tabindex="0">${img ? `<img src="${escA(img)}" alt="" loading="lazy" draggable="false">` : '<i class="fa-solid fa-user"></i>'}<span class="bl-note-owner-name" hidden>${escA(o.chat)}</span></span>`;
}
// 누르면 채팅방 이름을 옆에 · 꾹 누르면 귀속 바꾸기 창
let ownerPress = 0, ownerLong = false;
document.addEventListener('pointerdown', e => { const b = e.target.closest?.('[data-owner]'); if (!b) return; ownerLong = false; clearTimeout(ownerPress); ownerPress = setTimeout(() => { ownerLong = true; navigator.vibrate?.(12); openBind(b.dataset.owner); }, 500); }, true);
['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, () => clearTimeout(ownerPress), true));
document.addEventListener('pointermove', e => { if (ownerPress && e.target.closest?.('[data-owner]') == null) clearTimeout(ownerPress); }, true);
document.addEventListener('click', e => { const b = e.target.closest?.('[data-owner]'); if (!b) return; e.preventDefault(); e.stopPropagation(); if (ownerLong) { ownerLong = false; return; } const name = b.querySelector('.bl-note-owner-name'); name.hidden = !name.hidden; b.classList.toggle('is-open', !name.hidden); }, true);
document.addEventListener('contextmenu', e => { if (e.target.closest?.('[data-owner]')) e.preventDefault(); }, true);

function setOwner(id, owner) {
    const note = notes().find(n => n.id === id); if (!note) return;
    if (owner) note.owner = owner; else delete note.owner;
    note.updated = Date.now(); save(); rerenderAll();
    globalThis.toastr?.success(owner ? `${owner.name} · ${owner.chat} 에 귀속했어요.` : '전체 메모로 바꿨어요.', TITLE, { timeOut: 2500 });
}
let bindDialog = null;
async function openBind(id) {
    const note = notes().find(n => n.id === id); if (!note || bindDialog?.open) return;
    const cur = currentOwner(), ctx = getContext();
    bindDialog = document.createElement('dialog'); bindDialog.className = 'bl-notes-dialog bl-notes-bind'; bindDialog.setAttribute('aria-label', '메모 귀속');
    bindDialog.innerHTML = `<header><b><i class="fa-solid fa-link" aria-hidden="true"></i> 메모 귀속</b><div class="bl-notes-head-tools"><button type="button" class="bl-note-btn" data-bind="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></div></header>
<p class="bl-notes-empty">'${escA(label(note))}' 메모를 어디에 둘까요?</p>
<div class="bl-bind-quick">
 <button type="button" class="bl-bind-opt${note.owner ? '' : ' on'}" data-bind="global"><i class="fa-solid fa-earth-asia"></i><span><b>전체 메모</b><small>어느 채팅에서나 보여요</small></span></button>
 ${cur ? `<button type="button" class="bl-bind-opt${note.owner?.key === cur.key ? ' on' : ''}" data-bind="here">${ownerImg(cur) ? `<img src="${escA(ownerImg(cur))}" alt="">` : '<i class="fa-solid fa-user"></i>'}<span><b>지금 채팅</b><small>${escA(cur.name)} · ${escA(cur.chat)}</small></span></button>` : ''}
</div>
<div class="bl-bind-pick"><div class="bl-bind-head"><b>다른 채팅에 귀속</b><input type="search" placeholder="이름 · 태그 · 메모로 찾기" spellcheck="false" aria-label="캐릭터 찾기"></div><div class="bl-bind-list"></div></div>`;
    document.body.append(bindDialog);
    const list = bindDialog.querySelector('.bl-bind-list'), find = bindDialog.querySelector('.bl-bind-pick input');
    const tagNames = key => { try { const ids = ctx.tagMap?.[key] || []; return ids.map(tid => ctx.tags?.find(tg => tg.id === tid)).filter(Boolean).map(tg => ({ name: tg.name, color: tg.color || '', color2: tg.color2 || '' })); } catch { return []; } };
    const aux = ctx.powerUserSettings?.aux_field || 'character_version';
    const people = [...(ctx.characters || []).map((ch, i) => ({ type: 'char', i, name: ch.name, avatar: ch.avatar, img: getThumbnailUrl('avatar', ch.avatar), version: String(ch.data?.[aux] || ''), desc: String(ch.data?.creator_notes || ch.creatorcomment || ''), tags: tagNames(ch.avatar) })),
        ...(ctx.groups || []).map(g => ({ type: 'group', id: g.id, name: g.name, img: g.avatar_url || '', chats: g.chats || [], version: '', desc: `${(g.members || []).length}명 그룹`, tags: tagNames(g.id) }))].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
    const drawPeople = () => {
        const q = find.value.trim().toLowerCase();
        const hit = x => !q || [x.name, x.version, x.desc, ...x.tags.map(tg => tg.name)].some(v => String(v).toLowerCase().includes(q)); // 이름 · 버전 · 메모 · 태그로 찾기
        list.classList.add('is-cards');
        list.innerHTML = people.filter(hit).map(x => `<button type="button" class="bl-bind-card" data-person="${people.indexOf(x)}">
${x.img ? `<img src="${escA(x.img)}" alt="" loading="lazy">` : `<i class="fa-solid ${x.type === 'group' ? 'fa-users' : 'fa-user'} bl-bind-noimg"></i>`}
<span class="bl-bind-info"><span class="bl-bind-namerow"><b>${escA(x.name)}</b>${x.version ? `<em>${escA(x.version)}</em>` : ''}</span>${x.desc ? `<small class="bl-bind-desc">${escA(x.desc)}</small>` : ''}${x.tags.length ? `<span class="bl-bind-tags">${x.tags.map(tg => `<span style="${tg.color ? `background:${escA(tg.color)};` : ''}${tg.color2 ? `color:${escA(tg.color2)};` : ''}">${escA(tg.name)}</span>`).join('')}</span>` : ''}</span></button>`).join('') || '<p class="bl-notes-empty">없어요.</p>';
    };
    const drawChats = async x => {
        list.classList.remove('is-cards'); list.innerHTML = '<p class="bl-notes-empty">채팅 목록을 불러오는 중…</p>';
        let chats = [];
        try {
            if (x.type === 'group') chats = [...x.chats].reverse().map(c => ({ chat: String(c), when: '' }));
            else {
                const res = await fetch('/api/characters/chats', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ avatar_url: x.avatar }) });
                const data = res.ok ? await res.json() : [];
                chats = Object.values(data || {}).filter(c => c && c.file_name).map(c => ({ chat: String(c.file_name).replace(/\.jsonl$/i, ''), when: c.last_mes ? String(c.last_mes).slice(0, 16) : '' })).sort((a, b) => String(b.when).localeCompare(String(a.when)));
            }
        } catch (error) { console.warn('[메모] 채팅 목록:', error); }
        list.innerHTML = `<button type="button" class="bl-bind-back" data-bind="back"><i class="fa-solid fa-chevron-left"></i> ${escA(x.name)}</button>`
            + (chats.map(c => `<button type="button" class="bl-bind-chat" data-chat="${escA(c.chat)}"><i class="fa-regular fa-comment"></i><span>${escA(c.chat)}</span>${c.when ? `<small>${escA(c.when)}</small>` : ''}</button>`).join('') || '<p class="bl-notes-empty">채팅이 없어요.</p>');
        list.dataset.person = String(people.indexOf(x));
    };
    drawPeople();
    find.addEventListener('input', drawPeople);
    bindDialog.addEventListener('click', event => {
        const act = event.target.closest('[data-bind]')?.dataset.bind;
        if (act === 'close') { bindDialog.close(); return; }
        if (act === 'global') { setOwner(id, null); bindDialog.close(); return; }
        if (act === 'here' && cur) { setOwner(id, cur); bindDialog.close(); return; }
        if (act === 'back') { drawPeople(); return; }
        const person = event.target.closest('[data-person]'); if (person) { drawChats(people[Number(person.dataset.person)]); return; }
        const chat = event.target.closest('[data-chat]');
        if (chat) {
            const x = people[Number(list.dataset.person)], name = chat.dataset.chat;
            setOwner(id, x.type === 'group' ? { key: `g:${x.id}/${name}`, chat: name, group: x.id, name: x.name, avatar: x.img } : { key: `${x.avatar}/${name}`, chat: name, avatar: x.avatar, name: x.name });
            bindDialog.close();
        }
    });
    bindDialog.addEventListener('close', () => { bindDialog.remove(); bindDialog = null; }, { once: true });
    bindDialog.showModal();
}
// 채팅을 바꾸면 보이는 메모가 달라진다 · 채팅 이름을 바꾸면 귀속도 따라간다 · 캐릭터 이름이 바뀌면 표시 이름도
function onChatChanged() {
    const cur = currentOwner();
    if (cur) { let changed = false; for (const n of notes()) if (n.owner?.key === cur.key && (n.owner.name !== cur.name || n.owner.avatar !== cur.avatar)) { n.owner = { ...n.owner, name: cur.name, avatar: cur.avatar }; changed = true; } if (changed) save(); }
    peekId = null; rerenderAll();
}
function onChatRenamed(data) {
    const from = String(data?.oldFileName || '').replace(/\.jsonl$/i, ''), to = String(data?.newFileName || '').replace(/\.jsonl$/i, '');
    if (!from || !to) return;
    let changed = false;
    for (const n of notes()) {
        const o = n.owner; if (!o || o.chat !== from) continue;
        if (data.groupId ? o.group !== data.groupId : o.avatar !== data.avatarId) continue;
        n.owner = { ...o, chat: to, key: o.group ? `g:${o.group}/${to}` : `${o.avatar}/${to}` }; changed = true;
    }
    if (changed) { save(); rerenderAll(); }
}

// ── 창 ─────────────────────────────────────────────────────
let dialog = null;
// 날짜는 짧게: 오늘이면 시:분, 올해면 월.일, 그 전이면 연.월.일 — 칸이 좁아도 날짜 · 버튼이 한 줄에 (전체는 마우스를 올리면)
const pad2 = n => String(n).padStart(2, '0');
const whenFull = ts => { if (!ts) return ''; const d = new Date(ts); return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const when = ts => { if (!ts) return ''; const d = new Date(ts), now = new Date(); if (d.toDateString() === now.toDateString()) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; return d.getFullYear() === now.getFullYear() ? `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}` : `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`; };
const grow = area => { if (area.hidden) return; area.style.height = 'auto'; area.style.height = Math.min(area.scrollHeight + 2, 480) + 'px'; };

function card(note, index, total) {
    const el = document.createElement('article');
    el.className = 'bl-note'; el.dataset.id = note.id; paintNote(el, note.color, note.ink);
    el.innerHTML = `<div class="bl-note-head"><input class="bl-note-title" type="text" maxlength="120" placeholder="제목" spellcheck="false"></div>
<div class="bl-note-view bl-notes-view salty-preview" hidden></div>
<textarea class="bl-note-body" rows="2" placeholder="내용" spellcheck="false"></textarea>
<div class="bl-note-tools">${colorButton(note.id)}<time class="bl-note-time"></time>${ownerBadge(note)}
 <button type="button" class="bl-note-btn" data-act="up" title="위로" aria-label="위로" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button>
 <button type="button" class="bl-note-btn" data-act="down" title="아래로" aria-label="아래로" ${index === total - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button>
 <button type="button" class="bl-note-btn" data-act="copy" title="복제" aria-label="복제"><i class="fa-regular fa-clone"></i></button>
 <button type="button" class="bl-note-btn bl-note-pop" data-act="pop" title="화면에 꺼내 두기 (PC)" aria-label="화면에 꺼내 두기"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
 <button type="button" class="bl-note-btn bl-note-danger" data-act="del" title="지우기" aria-label="지우기"><i class="fa-regular fa-trash-can"></i></button>
</div>`;
    const title = el.querySelector('.bl-note-title'), body = el.querySelector('.bl-note-body'), view = el.querySelector('.bl-note-view'), time = el.querySelector('.bl-note-time');
    title.value = note.title; body.value = note.body; time.textContent = when(note.updated); time.title = whenFull(note.updated);
    let timer = 0;
    const current = () => notes().find(n => n.id === note.id) ?? note;
    const commit = (value, now) => { clearTimeout(timer); const run = () => { const n = current(); if (n.title !== title.value || n.body !== body.value) { updateNote(note.id, { title: title.value, body: body.value }); time.textContent = when(Date.now()); } }; now ? run() : (timer = setTimeout(run, 350)); };
    title.addEventListener('input', () => commit(null, false));
    title.addEventListener('blur', () => commit(null, true));
    title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); field.show(true); body.focus(); } });
    const field = bodyField(view, body, () => body.value, commit, fmt => title.after(fmt));
    el._sync = () => { const n = current(); if (document.activeElement !== title) title.value = n.title; if (document.activeElement !== body) body.value = n.body; field.refresh(); time.textContent = when(n.updated); };
    return el;
}

/** 카드 목록을 그린다 — 큰 창(.bl-notes-dialog)과 입력창 위 미니 목록(.bl-notes-mini)이 같은 카드 · 같은 처리 */
function renderList(root) {
    if (!root) return;
    const list = orderedNotes(), host = root.querySelector('.bl-notes-list');
    host.replaceChildren(...list.map((note, i) => card(note, i, list.length)));
    host.classList.toggle('is-sorted', (look().sort || 'manual') !== 'manual');
    root.dataset.key = listKey();
    if (!host._drag) { host._drag = true; enableDrag(root, host); }
    applyFind(root);
    const empty = root.querySelector('.bl-notes-empty'); if (empty) empty.hidden = list.length > 0;
    const count = root.querySelector('.bl-notes-count'); if (count) count.textContent = list.length ? String(list.length) : '';
}
function render() { renderList(dialog); }
const listKey = () => `${look().sort || 'manual'}:` + orderedNotes().map(n => n.id).join('|');

/** 찾기: 제목 · 내용에 글이 든 카드만 (대소문자 무시) */
function applyFind(root) {
    if (!root) return;
    const q = (root.querySelector('.bl-notes-find input')?.value || '').trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll('.bl-notes-list > .bl-note').forEach(el => {
        const note = notes().find(n => n.id === el.dataset.id);
        const hit = !q || `${note?.title ?? ''}\n${note?.body ?? ''}`.toLowerCase().includes(q);
        el.hidden = !hit; if (hit) shown++;
    });
    const none = root.querySelector('.bl-notes-nohit'); if (none) none.hidden = !q || shown > 0;
}
/** 모든 목록 · 메모 줄을 새 순서로 */
function rerenderAll() { if (dialog) render(); const mini = document.querySelector('#bl-notes-bar .bl-notes-mini'); if (mini && !mini.hidden) renderList(mini); renderBar(); }

/** 창을 닫거나 다시 그리기 전에 타이핑 중이던 값을 바로 저장 */
function flush(root = dialog) {
    root?.querySelectorAll('.bl-note').forEach(el => {
        const id = el.dataset.id, title = el.querySelector('.bl-note-title').value, body = el.querySelector('.bl-note-body').value;
        const note = notes().find(n => n.id === id);
        if (note && (note.title !== title || note.body !== body)) updateNote(id, { title, body });
    });
}

/** 카드 도구 처리 (큰 창 · 미니 목록 공용). close 는 호출한 쪽이 처리 */
function handleAct(act, id, root, rerender) {
    flush(root);
    if (act === 'look') { openLook(); return; }
    if (act === 'find') { const row = root.querySelector('.bl-notes-find'); if (!row) return; row.hidden = !row.hidden; const input = row.querySelector('input'); if (row.hidden) { input.value = ''; applyFind(root); } else input.focus({ preventScroll: true }); return; }
    if (act === 'sort') { const pop = root.querySelector('.bl-notes-sortpop'); if (pop) { pop.hidden = !pop.hidden; pop.querySelectorAll('[data-sort]').forEach(b => b.classList.toggle('on', b.dataset.sort === (look().sort || 'manual'))); placePop(pop); } return; }
    if (act === 'sort-set') { const mode = id; store().look.sort = mode; save(); root.querySelector('.bl-notes-sortpop').hidden = true; rerenderAll(); return; }
    if (act === 'add') { const note = addNote('', '', 0); if (!note) return; rerender(); root.querySelector('.bl-note-title')?.focus(); return; }
    if (!id) return;
    if (act === 'up' || act === 'down') { moveNote(id, act === 'up' ? -1 : 1); rerender(); root.querySelector(`.bl-note[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }); }
    else if (act === 'copy') { const made = duplicateNote(id); rerender(); if (made) root.querySelector(`.bl-note[data-id="${made.id}"] .bl-note-title`)?.focus(); }
    else if (act === 'pop') { if (root === dialog) dialog.close(); else { miniOpen = false; renderBar(); } openSticky(id); }
    else if (act === 'del') {
        const note = notes().find(n => n.id === id);
        if (note && (note.title || note.body) && !confirm(`"${note.title || note.body.slice(0, 20) || '메모'}" 를 지울까요?`)) return;
        closeSticky(id); removeNote(id); rerender();
    }
}
const HEAD_TOOLS = `<button type="button" class="bl-note-btn" data-act="find" title="메모에서 찾기" aria-label="메모에서 찾기"><i class="fa-solid fa-magnifying-glass"></i></button><span class="bl-notes-find" hidden><input type="search" placeholder="찾기" spellcheck="false" aria-label="메모에서 찾기"></span>`
    + `<span class="bl-note-fmt-h bl-notes-sortwrap"><button type="button" class="bl-note-btn" data-act="sort" title="정렬" aria-label="정렬"><i class="fa-solid fa-arrow-down-wide-short"></i></button><span class="bl-note-fmt-hs bl-notes-sortpop" hidden>${SORTS.map(([key, name, icon]) => `<button type="button" class="bl-note-btn bl-notes-sortbtn" data-act="sort-set" data-sort="${key}" title="${name}" aria-label="${name}"><i class="fa-solid ${icon}"></i><span>${name}</span></button>`).join('')}</span></span>`
    + `<button type="button" class="bl-note-btn" data-act="look" title="메모 글꼴 · 크기 · 한 줄 장수 설정" aria-label="메모 설정"><i class="fa-solid fa-gear"></i></button><button type="button" class="bl-note-btn bl-note-add" data-act="add" title="새 메모" aria-label="새 메모"><i class="fa-solid fa-plus"></i></button>`;
const FIND_ROW = `<p class="bl-notes-nohit" hidden>찾는 글이 든 메모가 없어요.</p>`;

export function openPanel() {
    if (dialog?.open) return;
    const previous = document.activeElement;
    dialog = document.createElement('dialog');
    dialog.className = 'bl-notes-dialog'; dialog.setAttribute('aria-label', TITLE);
    dialog.innerHTML = `<header><b><i class="fa-solid fa-note-sticky" aria-hidden="true"></i> ${TITLE} <small class="bl-notes-count"></small></b><div class="bl-notes-head-tools">${HEAD_TOOLS}<button type="button" class="bl-note-btn" data-act="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></div></header>
${FIND_ROW}<p class="bl-notes-empty">+ 를 눌러 첫 메모를 적어 보세요.</p>
<div class="bl-notes-list"></div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
        const button = event.target.closest('[data-act]'); if (!button) return;
        const act = button.dataset.act, id = button.dataset.sort || button.closest('.bl-note')?.dataset.id;
        if (act === 'close') { dialog.close(); return; }
        handleAct(act, id, dialog, render);
    });
    dialog.addEventListener('input', event => { if (event.target.closest('.bl-notes-find')) applyFind(dialog); });
    dialog.addEventListener('close', () => { flush(); dialog.remove(); dialog = null; if (previous?.isConnected) previous.focus(); }, { once: true });
    render();
    dialog.showModal();
}

// ── 메모 전용 글꼴 · 크기 · 줄 간격 · 자간 · 굵기 (톱니) ──────
export function applyLook() {
    const l = look(), root = document.documentElement.style;
    for (const n of ['1', '2', '3']) document.documentElement.classList.toggle(`bl-notes-cols-${n}`, String(l.cols) === n);
    const font = l.font ? findFont(l.font) : null;
    if (font) loadFont(font);
    root.setProperty('--bl-notes-font', font ? fontStack(font, font.lang || 'ko') : 'var(--salty-font-text)');
    const size = Number(l.size) || 100;
    root.setProperty('--bl-notes-size', size === 100 ? 'var(--salty-size)' : `calc(var(--salty-size) * ${size / 100})`);
    root.setProperty('--bl-notes-lh', l.lh !== '' && Number(l.lh) > 0 ? String(Number(l.lh)) : 'var(--salty-lh)');
    root.setProperty('--bl-notes-ls', l.ls !== '' && !Number.isNaN(Number(l.ls)) ? `${Number(l.ls)}em` : 'var(--salty-ls)');
    root.setProperty('--bl-notes-weight', l.weight ? String(l.weight) : 'var(--salty-weight)');
}
let lookDialog = null;
const PARAMS = [
    ['size', '크기', 60, 160, 5, '%', 100], ['lh', '줄 간격', 1, 2.4, 0.05, '', 1.7], ['ls', '자간', -0.1, 0.5, 0.01, 'em', 0], ['weight', '굵기', 300, 800, 100, '', 400],
];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fontLabel = f => f ? (f.label || f.name || f.family) : '본문과 같게';
/** container 안의 item 을 끌어 순서 바꾸기 — 손잡이(grip)는 바로, 줄 아무 데나는 꾹 눌러서. 놓으면 onDrop() */
function sortableRows(container, itemSel, gripSel, onDrop) {
    container.addEventListener('pointerdown', event => {
        const row = event.target.closest(itemSel); if (!row || !container.contains(row) || (event.pointerType === 'mouse' && event.button !== 0)) return;
        if (event.target.closest('input, label, button') && !event.target.closest(gripSel)) return;
        const sx = event.clientX, sy = event.clientY, onGrip = !!event.target.closest(gripSel);
        let timer = 0;
        const cancel = () => { clearTimeout(timer); document.removeEventListener('pointermove', pre, true); document.removeEventListener('pointerup', cancel, true); document.removeEventListener('pointercancel', cancel, true); };
        const pre = e => { if (!onGrip && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) cancel(); };
        const begin = () => {
            cancel();
            const r = row.getBoundingClientRect(), dy = sy - r.top, dx = sx - r.left;
            const ghost = row.cloneNode(true); ghost.classList.add('bl-row-ghost');
            Object.assign(ghost.style, { width: `${r.width}px`, left: `${r.left}px`, top: `${r.top}px` });
            (container.closest('dialog') || document.body).append(ghost); row.classList.add('is-dragging'); document.documentElement.classList.add('bl-notes-dragging');
            const move = e => {
                ghost.style.left = `${e.clientX - dx}px`; ghost.style.top = `${e.clientY - dy}px`;
                const over = document.elementsFromPoint(e.clientX, e.clientY).map(el => el.closest?.(itemSel)).find(el => el && el !== ghost && container.contains(el));
                if (!over || over === row) return;
                const o = over.getBoundingClientRect(), cols = getComputedStyle(container).gridTemplateColumns.split(' ').filter(Boolean).length;
                const after = cols > 1 && Math.abs(e.clientY - (o.top + o.height / 2)) < o.height / 2 ? e.clientX > o.left + o.width / 2 : e.clientY > o.top + o.height / 2;
                if (after) { if (over.nextElementSibling !== row) over.after(row); } else if (over.previousElementSibling !== row) over.before(row);
            };
            const end = () => { document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerup', end, true); document.removeEventListener('pointercancel', end, true); ghost.remove(); row.classList.remove('is-dragging'); document.documentElement.classList.remove('bl-notes-dragging'); onDrop(); };
            document.addEventListener('pointermove', move, true); document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true);
        };
        document.addEventListener('pointermove', pre, true); document.addEventListener('pointerup', cancel, true); document.addEventListener('pointercancel', cancel, true);
        if (onGrip) { event.preventDefault(); begin(); } else timer = setTimeout(begin, PRESS_MS);
    });
    container.addEventListener('touchmove', e => { if (document.documentElement.classList.contains('bl-notes-dragging')) e.preventDefault(); }, { passive: false });
}
export function openLook() {
    if (lookDialog?.open) return;
    const l = look();
    const rows = PARAMS.map(([key, name, min, max, step, unit, fallback]) => {
        const same = key === 'size' ? Number(l[key] || 100) === 100 : (l[key] === '' || l[key] == null);
        const value = same ? fallback : Number(l[key]);
        return `<div class="bl-look-item" data-param="${key}">
<div class="bl-look-head"><span>${name}</span><label class="bl-look-same"><input type="checkbox" data-look-same="${key}" ${same ? 'checked' : ''}><span>같게</span></label></div>
<div class="bl-look-ctl"><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-look-range="${key}" ${same ? 'disabled' : ''}><input type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${value}" data-look-key="${key}" ${same ? 'disabled' : ''}><span class="bl-look-unit">${unit}</span></div>
</div>`; }).join('');
    lookDialog = document.createElement('dialog');
    lookDialog.className = 'bl-notes-dialog bl-notes-look'; lookDialog.setAttribute('aria-label', '메모 설정');
    lookDialog.innerHTML = `<header><b><i class="fa-solid fa-gear" aria-hidden="true"></i> 메모 설정</b><div class="bl-notes-head-tools"><button type="button" class="bl-note-btn" data-look="reset" title="기본값으로" aria-label="기본값으로"><i class="fa-solid fa-rotate-left"></i></button><button type="button" class="bl-note-btn" data-look="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></div></header>
<div class="bl-notes-view salty-preview bl-look-sample"></div>
<p class="bl-notes-empty">메모 안 글에만 쓰여요. '본문과 같게'면 채팅 본문 설정을 따라가요.</p>
<div class="bl-look-item" data-param="font"><div class="bl-look-head"><span>글꼴</span></div><div class="bl-look-ctl"><button type="button" class="bl-look-fontbtn" data-look="fonts" title="글꼴 고르기"><span class="bl-look-fontname">${esc(fontLabel(findFont(l.font)))}</span><i class="fa-solid fa-chevron-down"></i></button></div>
<div class="bl-look-fonts" hidden><div class="bl-look-fonttags" role="tablist" aria-label="글꼴 묶음"></div><input type="search" class="bl-look-fontfind" placeholder="찾기" spellcheck="false"><div class="bl-look-fontlist"></div></div></div>
<div class="bl-look-grid">${rows}</div>
<div class="bl-look-item" data-param="cols"><div class="bl-look-head"><span>한 줄에 메모</span></div><div class="bl-look-seg" role="radiogroup" aria-label="한 줄에 메모">${[['auto', '자동'], ['1', '1장'], ['2', '2장'], ['3', '3장']].map(([v, n]) => `<button type="button" class="bl-look-segbtn${String(l.cols || 'auto') === v ? ' on' : ''}" data-look-cols="${v}" role="radio" aria-checked="${String(l.cols || 'auto') === v}">${n}</button>`).join('')}</div><p class="bl-look-hint">자동은 PC 한 줄 3장 · 폰 1장이에요.</p></div>
<div class="bl-look-item" data-param="fmt"><div class="bl-look-head"><span>서식 버튼</span><span class="bl-look-hint">켜고 끄기 · 끌어서 순서</span></div><div class="bl-look-fmtlist"></div></div>`;
    document.body.append(lookDialog);
    const sample = lookDialog.querySelector('.bl-look-sample');
    renderView(sample, '메모 안 글은 이렇게 보여요. *속마음*과 "대사"도 채팅과 같은 색이에요.');
    // 서식 버튼 목록: 켜기 · 끄기(스위치), 손잡이를 잡거나 줄을 꾹 눌러 끌면 순서가 바뀐다 → 열려 있는 서식 줄에 바로 반영
    const fmtHost = lookDialog.querySelector('.bl-look-fmtlist');
    const drawFmtList = () => { fmtHost.innerHTML = fmtButtons().map(({ k, on }) => `<div class="bl-look-fmtrow${on ? '' : ' is-off'}" data-k="${k}"><span class="bl-look-grip" title="끌어서 순서 바꾸기" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span><i class="fa-solid ${FMT_ALL[k][0]} bl-look-fmticon" aria-hidden="true"></i><span class="bl-look-fmtname">${FMT_ALL[k][1]}</span><label class="bl-look-switch" title="${on ? '끄기' : '켜기'}"><input type="checkbox" data-fmt-on="${k}" ${on ? 'checked' : ''} aria-label="${FMT_ALL[k][1]}"><span></span></label></div>`).join(''); };
    const saveFmt = () => { store().look.fmtButtons = [...fmtHost.querySelectorAll('.bl-look-fmtrow')].map(r => ({ k: r.dataset.k, on: r.querySelector('input').checked })); save(); rebuildFmtBars(); };
    drawFmtList();
    fmtHost.addEventListener('change', event => { const box = event.target.closest('[data-fmt-on]'); if (!box) return; box.closest('.bl-look-fmtrow').classList.toggle('is-off', !box.checked); saveFmt(); });
    sortableRows(fmtHost, '.bl-look-fmtrow', '.bl-look-grip', saveFmt);
    // 글꼴 목록: 테마의 글꼴 고르기처럼 묶음(고딕 · 명조 · 꾸밈 · 고정폭 · 내 글꼴)으로, 줄마다 그 글꼴로 미리보기 (보일 때 미리보기 조각을 받는다)
    const listHost = lookDialog.querySelector('.bl-look-fontlist'), find = lookDialog.querySelector('.bl-look-fontfind'), panel = lookDialog.querySelector('.bl-look-fonts');
    const fonts = fontsFor('ko');
    const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { const f = findFont(e.target.dataset.id); if (f) { queuePreview(f); loadFont(f); } observer.unobserve(e.target); } }), { root: listHost, rootMargin: '200px' });
    const item = f => `<button type="button" class="bl-fontitem${look().font === f.id ? ' on' : ''}" data-font-id="${esc(f.id)}"><span class="bl-fontinfo"><b>${esc(fontLabel(f))}${f.native ? ` <i>${esc(f.native)}</i>` : ''}</b><small style="font-family:${esc(previewStack(f, f.lang || 'ko'))}">${esc(SAMPLES[f.lang || 'ko'] || SAMPLES.ko)}</small></span>${look().font === f.id ? '<i class="fa-solid fa-check"></i>' : ''}</button>`;
    // 묶음 태그: 처음엔 지금 글꼴의 묶음(본문과 같게면 고딕). 찾기는 고른 묶음 안에서, 태그 숫자는 찾기에 맞는 개수
    const tagsHost = lookDialog.querySelector('.bl-look-fonttags');
    let tag = (look().font && findFont(look().font)?.group) || 'sans';
    const renderFonts = (q = '') => {
        const needle = q.trim().toLowerCase();
        const pick = fonts.filter(f => !needle || fontLabel(f).toLowerCase().includes(needle) || String(f.family || '').toLowerCase().includes(needle) || String(f.native || '').toLowerCase().includes(needle));
        const present = GROUPS.map(([group, name]) => [group, name, pick.filter(f => f.group === group)]).filter(([group, , rows]) => rows.length || fonts.some(f => f.group === group));
        if (tag !== 'all' && !present.some(([group]) => group === tag)) tag = 'all';
        tagsHost.innerHTML = [['all', '전체', pick.length], ...present.map(([group, name, rows]) => [group, name, rows.length])]
            .map(([group, name, n]) => `<button type="button" class="bl-look-fonttag${tag === group ? ' on' : ''}" data-font-tag="${group}" role="tab" aria-selected="${tag === group}">${name}<span>${n}</span></button>`).join('');
        const shown = tag === 'all' ? present : present.filter(([group]) => group === tag);
        const body = shown.map(([group, name, rows]) => rows.length ? `${tag === 'all' ? `<div class="bl-fontgroup">${name} <small>${rows.length}</small></div>` : ''}${rows.map(item).join('')}` : '').join('');
        listHost.innerHTML = `<button type="button" class="bl-fontitem${!look().font ? ' on' : ''}" data-font-id=""><span class="bl-fontinfo"><b>본문과 같게</b><small>채팅 본문 글꼴 그대로</small></span>${!look().font ? '<i class="fa-solid fa-check"></i>' : ''}</button>`
            + (body || '<p class="bl-look-fontempty">그런 이름의 글꼴이 없어요</p>');
        listHost.scrollTop = 0;
        listHost.querySelectorAll('.bl-fontitem[data-font-id]:not([data-font-id=""])').forEach(el => { el.dataset.id = el.dataset.fontId; observer.observe(el); });
    };
    tagsHost.addEventListener('click', event => { const b = event.target.closest('[data-font-tag]'); if (!b) return; tag = b.dataset.fontTag; renderFonts(find.value); });
    find.addEventListener('input', () => renderFonts(find.value));
    const apply = () => { applyLook(); save(); };
    lookDialog.addEventListener('click', event => {
        const fontBtn = event.target.closest('[data-font-id]');
        if (fontBtn) { store().look.font = fontBtn.dataset.fontId; apply(); lookDialog.querySelector('.bl-look-fontname').textContent = fontLabel(findFont(look().font)); renderFonts(find.value); panel.hidden = true; return; }
        const cols = event.target.closest('[data-look-cols]'); if (cols) { store().look.cols = cols.dataset.lookCols; apply(); lookDialog.querySelectorAll('[data-look-cols]').forEach(b => { const on = b === cols; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }); return; }
        const act = event.target.closest('[data-look]')?.dataset.look; if (!act) return;
        if (act === 'fonts') { panel.hidden = !panel.hidden; if (!panel.hidden) { renderFonts(find.value); find.focus({ preventScroll: true }); } }
        if (act === 'close') lookDialog.close();
        if (act === 'reset') { store().look = { ...LOOK_DEFAULT, fmtOpen: look().fmtOpen, sort: look().sort }; apply(); rebuildFmtBars(); lookDialog.close(); openLook(); }
    });
    // 슬라이더 ↔ 숫자 ↔ 같게
    const readParam = key => {
        const same = lookDialog.querySelector(`[data-look-same="${key}"]`), range = lookDialog.querySelector(`[data-look-range="${key}"]`), num = lookDialog.querySelector(`[data-look-key="${key}"]`);
        range.disabled = num.disabled = same.checked;
        const next = { ...look() }; next[key] = same.checked ? (key === 'size' ? 100 : '') : num.value; store().look = next; apply();
    };
    lookDialog.addEventListener('input', event => {
        const range = event.target.closest('[data-look-range]'), num = event.target.closest('[data-look-key]'), same = event.target.closest('[data-look-same]');
        if (range) { lookDialog.querySelector(`[data-look-key="${range.dataset.lookRange}"]`).value = range.value; readParam(range.dataset.lookRange); }
        else if (num) { const r = lookDialog.querySelector(`[data-look-range="${num.dataset.lookKey}"]`); if (r) r.value = num.value; readParam(num.dataset.lookKey); }
        else if (same) readParam(same.dataset.lookSame);
    });
    lookDialog.addEventListener('close', () => { observer.disconnect(); lookDialog.remove(); lookDialog = null; }, { once: true });
    lookDialog.showModal();
}

// ── 화면에 꺼내 둔 쪽지 (PC — 윈도우 스티커 메모처럼 채팅 옆에 떠 있고, 자리 · 크기를 기억한다) ──
const stickies = new Map(); // id → element
const stickyStore = () => (store().stickies ??= {});
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isWide = () => matchMedia('(min-width: 900px)').matches;

function placeSticky(el, pos) {
    const w = clamp(pos.w || 260, 180, innerWidth - 20), h = clamp(pos.h || 220, 120, innerHeight - 20);
    const x = clamp(pos.x ?? innerWidth - w - 24, 0, innerWidth - w), y = clamp(pos.y ?? 80, 0, innerHeight - h);
    Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
}
function rememberSticky(id, el) {
    const r = el.getBoundingClientRect();
    stickyStore()[id] = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    save();
}
function raiseSticky(el) { stickies.forEach(other => other.classList.toggle('is-top', other === el)); }

// ── 꾹 눌러 끌기 (버튼 없이 손으로) ─────────────────────────
//    목록 안에서 끌면 칸 자리가 바뀌고(놓으면 '직접 정한 순'으로 저장), PC 에서 목록 밖에 놓으면 그 자리에 스티커로 뜬다.
const PRESS_MS = 380;
let dragging = null, dragEndedAt = 0;
function enableDrag(root, host) {
    host.addEventListener('pointerdown', event => {
        if (dragging || (event.pointerType === 'mouse' && event.button !== 0)) return;
        const cardEl = event.target.closest('.bl-note');
        if (!cardEl || !host.contains(cardEl) || event.target.closest('input, textarea, button, select, a, summary, .bl-note-fmt, .bl-note-owner, .bl-note-colorwrap')) return;
        const sx = event.clientX, sy = event.clientY; let timer = 0;
        const cancel = () => { clearTimeout(timer); document.removeEventListener('pointermove', pre, true); document.removeEventListener('pointerup', cancel, true); document.removeEventListener('pointercancel', cancel, true); };
        const pre = e => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) cancel(); };
        document.addEventListener('pointermove', pre, true); document.addEventListener('pointerup', cancel, true); document.addEventListener('pointercancel', cancel, true);
        timer = setTimeout(() => { cancel(); startDrag(root, host, cardEl, sx, sy); }, PRESS_MS);
    });
    // 끄는 동안 화면이 같이 스크롤되지 않게 (미리 붙여 둬야 폰 브라우저가 기다린다)
    host.addEventListener('touchmove', e => { if (dragging) e.preventDefault(); }, { passive: false });
    host.addEventListener('contextmenu', e => { if (dragging || e.target.closest('.bl-note-view')) e.preventDefault(); });
    // 놓은 직후의 click(보기 → 편집 전환)은 먹는다
    root.addEventListener('click', e => { if (Date.now() - dragEndedAt < 350) { e.preventDefault(); e.stopPropagation(); } }, true);
}
function startDrag(root, host, cardEl, sx, sy) {
    const id = cardEl.dataset.id, r = cardEl.getBoundingClientRect(), dx = sx - r.left, dy = sy - r.top, wide = isWide();
    const ghost = cardEl.cloneNode(true);
    ghost.classList.add('bl-note-ghost'); ghost.removeAttribute('data-id'); ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { width: `${r.width}px`, height: `${r.height}px`, left: `${r.left}px`, top: `${r.top}px` });
    (root.closest('dialog') || document.body).append(ghost); // 모달 창 안이면 창 안에 (맨 위 층)
    cardEl.classList.add('is-dragging'); document.documentElement.classList.add('bl-notes-dragging');
    dragging = { id };
    let lx = sx, ly = sy, outside = false;
    const move = e => {
        lx = e.clientX; ly = e.clientY;
        ghost.style.left = `${lx - dx}px`; ghost.style.top = `${ly - dy}px`;
        const b = root.getBoundingClientRect();
        outside = wide && (lx < b.left || lx > b.right || ly < b.top || ly > b.bottom);
        ghost.classList.toggle('is-pop', outside); cardEl.classList.toggle('is-leaving', outside);
        if (outside) return;
        const over = document.elementsFromPoint(lx, ly).map(el => el.closest?.('.bl-note')).find(el => el && el !== ghost && host.contains(el));
        if (!over || over === cardEl || !host.contains(over)) return;
        const or = over.getBoundingClientRect(), cols = getComputedStyle(host).gridTemplateColumns.split(' ').filter(Boolean).length;
        const after = cols > 1 ? (Math.abs(ly - (or.top + or.height / 2)) < or.height / 2 ? lx > or.left + or.width / 2 : ly > or.top + or.height / 2) : ly > or.top + or.height / 2;
        if (after) { if (over.nextElementSibling !== cardEl) over.after(cardEl); } else if (over.previousElementSibling !== cardEl) over.before(cardEl);
    };
    const end = () => {
        document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerup', end, true); document.removeEventListener('pointercancel', end, true);
        ghost.remove(); cardEl.classList.remove('is-dragging', 'is-leaving'); document.documentElement.classList.remove('bl-notes-dragging');
        dragging = null; dragEndedAt = Date.now();
        if (outside) { // PC: 그 자리에 스티커로
            flush(root);
            const w = 260, h = 220;
            stickyStore()[id] = { x: Math.round(lx - 40), y: Math.round(ly - 16), w, h }; save(); // 놓은 곳이 쪽지 머리띠 왼쪽 위쯤
            const old = stickies.get(id); if (old) { old.remove(); stickies.delete(id); }
            if (root === dialog) dialog.close(); else { miniOpen = false; renderBar(); }
            openSticky(id);
            return;
        }
        applyOrder([...host.children].map(el => el.dataset.id).filter(Boolean));
        rerenderAll();
    };
    document.addEventListener('pointermove', move, true); document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true);
    navigator.vibrate?.(12);
}
/** 보이는 순서를 저장 순서로 (정렬 방식은 '직접 정한 순'으로) */
function applyOrder(ids) {
    const s = store(), byId = new Map(s.notes.map(n => [n.id, n]));
    const ordered = ids.map(id => byId.get(id)).filter(Boolean);
    s.notes = [...ordered, ...s.notes.filter(n => !ids.includes(n.id))];
    s.look.sort = 'manual'; save();
}

export function openSticky(id) {
    const note = notes().find(n => n.id === id);
    if (!note) return null;
    if (stickies.has(id)) { const el = stickies.get(id); raiseSticky(el); return el; }
    const el = document.createElement('section');
    el.className = 'bl-sticky'; el.dataset.id = id; paintNote(el, note.color, note.ink); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', TITLE);
    el.innerHTML = `<header class="bl-sticky-head"><input class="bl-sticky-title" type="text" maxlength="120" placeholder="제목" spellcheck="false">${colorButton(id)}<button type="button" class="bl-note-btn" data-sticky="list" title="메모 목록" aria-label="메모 목록"><i class="fa-solid fa-bars"></i></button><button type="button" class="bl-note-btn" data-sticky="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></header><div class="bl-sticky-scroll"><div class="bl-sticky-view bl-notes-view salty-preview" hidden></div><textarea class="bl-sticky-body" placeholder="내용" spellcheck="false"></textarea></div>`;
    const title = el.querySelector('.bl-sticky-title'), body = el.querySelector('.bl-sticky-body'), view = el.querySelector('.bl-sticky-view');
    title.value = note.title; body.value = note.body;
    let timer = 0;
    const current = () => notes().find(n => n.id === id) ?? note;
    const commit = (value, now) => { clearTimeout(timer); const run = () => { const n = current(); if (n.title !== title.value || n.body !== body.value) updateNote(id, { title: title.value, body: body.value }); }; now ? run() : (timer = setTimeout(run, 350)); };
    title.addEventListener('input', () => commit(null, false)); title.addEventListener('blur', () => commit(null, true));
    title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); field.show(true); body.focus(); } });
    const field = bodyField(view, body, () => body.value, commit, fmt => title.after(fmt)); // 서식 줄은 머리띠 안(제목 옆)
    el._sync = () => { const n = current(); if (document.activeElement !== title) title.value = n.title; if (document.activeElement !== body) body.value = n.body; field.refresh(); };
    el.querySelector('[data-sticky="close"]').onclick = () => { commit(null, true); closeSticky(id); };
    el.querySelector('[data-sticky="list"]').onclick = () => openPanel();
    el.addEventListener('pointerdown', () => raiseSticky(el), true);
    // 머리띠를 끌어 옮기기 (입력칸 · 버튼은 제외)
    const head = el.querySelector('.bl-sticky-head');
    head.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('input, button')) return;
        const r = el.getBoundingClientRect(), dx = event.clientX - r.left, dy = event.clientY - r.top;
        head.setPointerCapture(event.pointerId); el.classList.add('is-dragging');
        const move = e => { el.style.left = clamp(e.clientX - dx, 0, innerWidth - r.width) + 'px'; el.style.top = clamp(e.clientY - dy, 0, innerHeight - r.height) + 'px'; };
        const up = () => { head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up); el.classList.remove('is-dragging'); rememberSticky(id, el); };
        head.addEventListener('pointermove', move); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
        event.preventDefault();
    });
    // 크기는 CSS resize — 끝나면(포인터를 뗄 때) 기억
    el.addEventListener('pointerup', () => rememberSticky(id, el));
    new ResizeObserver(() => { if (!el.isConnected) return; clearTimeout(el._rs); el._rs = setTimeout(() => rememberSticky(id, el), 400); }).observe(el);
    placeSticky(el, stickyStore()[id] || {});
    document.body.append(el); stickies.set(id, el); raiseSticky(el); rememberSticky(id, el);
    return el;
}
export function closeSticky(id) {
    const el = stickies.get(id); if (el) { el.remove(); stickies.delete(id); }
    if (stickyStore()[id]) { delete stickyStore()[id]; save(); }
}
function restoreStickies() {
    if (!isWide()) return;
    for (const id of Object.keys(stickyStore())) { if (notes().some(n => n.id === id)) openSticky(id); else { delete stickyStore()[id]; save(); } }
}
addEventListener('resize', () => stickies.forEach((el, id) => placeSticky(el, stickyStore()[id] || {})));

export function mountInline(host) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'salty-btn'; button.textContent = '메모 열기';
    button.onclick = openPanel; host.replaceChildren(button);
    return () => host.replaceChildren();
}

// ── 입력창 위 메모 줄 (빠른 답장 줄처럼 제목이 늘 보인다) ──
//    칩 = 그 메모만 펼쳐 보기 · 누르면 고치기. ☰ 짧게 = 큰 창과 같은 목록을 입력창 위에 작게. ☰ 길게 = 큰 창.
const BAR_ID = 'bl-notes-bar';
const LONG_PRESS_MS = 550;
let peekId = null; // 펼쳐 둔 메모 하나
let miniOpen = false; // 입력창 위 미니 목록
const label = note => (note.title || note.body.split('\n').find(l => l.trim()) || '메모').trim().slice(0, 24);
function renderBar() {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;
    const list = orderedNotes(), row = bar.querySelector('.bl-notes-row');
    if (peekId && !list.some(n => n.id === peekId)) peekId = null;
    const chips = list.map(note => { const b = document.createElement('button'); b.type = 'button'; b.className = 'bl-notes-chip' + (note.id === peekId ? ' is-open' : ''); b.dataset.id = note.id; b.textContent = label(note); paintNote(b, note.color); b.title = note.title || label(note); return b; });
    const more = document.createElement('button'); more.type = 'button'; more.className = 'bl-notes-chip bl-notes-more' + (miniOpen ? ' is-open' : ''); more.dataset.bar = 'list'; more.setAttribute('aria-label', '메모 목록 (길게 누르면 큰 창)'); more.title = '메모 목록 · 길게 누르면 큰 창'; more.innerHTML = list.length ? '<i class="fa-solid fa-bars"></i>' : '<i class="fa-solid fa-plus"></i> 메모';
    row.replaceChildren(more, ...chips);
    renderMini(); renderPeek();
}
function renderMini() {
    const bar = document.getElementById(BAR_ID); if (!bar) return;
    const host = bar.querySelector('.bl-notes-mini');
    if (!miniOpen) { flush(host); host.hidden = true; host.replaceChildren(); delete host.dataset.key; return; }
    host.hidden = false;
    if (!host.querySelector('.bl-notes-list')) host.innerHTML = `<div class="bl-notes-peek-head"><b><i class="fa-solid fa-note-sticky" aria-hidden="true"></i> ${TITLE} <small class="bl-notes-count"></small></b>${HEAD_TOOLS}</div>${FIND_ROW}<p class="bl-notes-empty">+ 를 눌러 첫 메모를 적어 보세요.</p><div class="bl-notes-list"></div>`;
    // 카드는 목록의 구성(순서 · 개수)이 바뀔 때만 다시 만든다 — 타이핑마다 다시 만들면 편집 칸이 사라지고 초점을 잃는다 (폰 제보)
    const key = listKey();
    // 칸에 초점이 있고 메모 개수 · 구성이 그대로면(가나다 · 최근 순이라 순서만 바뀜) 쓰는 동안은 다시 만들지 않는다 — 칸에서 나가면 맞춘다
    const same = (a, b) => (a || '').split(':').pop().split('|').sort().join('|') === (b || '').split(':').pop().split('|').sort().join('|') && (a || '').split(':')[0] === (b || '').split(':')[0];
    if (host.dataset.key !== key && !(host.contains(document.activeElement) && same(host.dataset.key, key))) { host.dataset.key = key; renderList(host); }
    else { const count = host.querySelector('.bl-notes-count'); if (count) count.textContent = visibleNotes().length ? String(visibleNotes().length) : ''; }
    if (!host._blurSort) { host._blurSort = true; host.addEventListener('focusout', () => setTimeout(() => { if (!host.hidden && !host.contains(document.activeElement) && host.dataset.key !== listKey()) renderList(host); }, 0)); }
}
function renderPeek() {
    const bar = document.getElementById(BAR_ID); if (!bar) return;
    const host = bar.querySelector('.bl-notes-peek'), note = miniOpen ? null : notes().find(n => n.id === peekId);
    if (!note) { host.hidden = true; host.replaceChildren(); delete host.dataset.id; host._sync = null; return; }
    host.hidden = false;
    if (host.dataset.id !== note.id) {
        host.dataset.id = note.id;
        host.innerHTML = `<div class="bl-notes-peek-head"><b></b><button type="button" class="bl-note-btn" data-bar="pop" title="화면에 꺼내 두기 (PC)" aria-label="화면에 꺼내 두기"><i class="fa-solid fa-arrow-up-right-from-square"></i></button><button type="button" class="bl-note-btn" data-bar="close" title="접기" aria-label="접기"><i class="fa-solid fa-xmark"></i></button></div><div class="bl-notes-peek-view bl-notes-view salty-preview" hidden></div><textarea class="bl-notes-peek-body" placeholder="내용" spellcheck="false"></textarea>`;
        const area = host.querySelector('textarea'), view = host.querySelector('.bl-notes-peek-view'); area.value = note.body;
        let timer = 0;
        const commit = (value, now) => { clearTimeout(timer); const run = () => { const n = notes().find(x => x.id === note.id); if (n && n.body !== area.value) updateNote(note.id, { body: area.value }); }; now ? run() : (timer = setTimeout(run, 350)); };
        const field = bodyField(view, area, () => area.value, commit, fmt => host.querySelector('.bl-notes-peek-head b').after(fmt)); // 서식 줄은 제목 줄 안에
        host._sync = () => { const n = notes().find(x => x.id === note.id); if (!n) return; if (document.activeElement !== area) area.value = n.body; field.refresh(); host.querySelector('.bl-notes-peek-head b').textContent = n.title || ''; };
    }
    host.querySelector('.bl-notes-peek-head b').textContent = note.title || '';
}
export function syncBar() {
    const want = getSettings().addonUI?.notesBarMenu !== false;
    const old = document.getElementById(BAR_ID);
    if (!want) { old?.remove(); peekId = null; miniOpen = false; return; }
    if (old) { renderBar(); return; }
    const form = document.getElementById('send_form'); if (!form) return;
    const bar = document.createElement('div'); bar.id = BAR_ID;
    bar.innerHTML = '<div class="bl-notes-row" role="toolbar" aria-label="메모"></div><div class="bl-notes-mini" hidden></div><div class="bl-notes-peek" hidden></div>';
    // ☰ 길게 누르기 = 큰 창 (짧게 누른 click 은 미니 목록)
    let pressTimer = 0, longFired = false;
    const clearPress = () => { clearTimeout(pressTimer); pressTimer = 0; };
    bar.addEventListener('pointerdown', event => {
        const more = event.target.closest('.bl-notes-more'); if (!more || (event.pointerType === 'mouse' && event.button !== 0)) return;
        longFired = false; clearPress();
        pressTimer = setTimeout(() => { longFired = true; pressTimer = 0; miniOpen = false; renderBar(); openPanel(); }, LONG_PRESS_MS);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => bar.addEventListener(type, clearPress));
    bar.addEventListener('contextmenu', event => { if (event.target.closest('.bl-notes-more') && event.pointerType !== 'mouse') event.preventDefault(); });
    bar.addEventListener('click', event => {
        const chip = event.target.closest('.bl-notes-chip'), barAct = event.target.closest('[data-bar]')?.dataset.bar, act = event.target.closest('[data-act]')?.dataset.act;
        if (barAct === 'list') { if (longFired) { longFired = false; return; } miniOpen = !miniOpen; if (miniOpen) peekId = null; renderBar(); return; }
        if (barAct === 'close') { peekId = null; miniOpen = false; renderBar(); return; }
        if (barAct === 'pop') { const id = peekId; peekId = null; renderBar(); openSticky(id); return; }
        if (act) { const mini = bar.querySelector('.bl-notes-mini'), btn = event.target.closest('[data-act]'); handleAct(act, btn.dataset.sort || event.target.closest('.bl-note')?.dataset.id, mini, () => renderList(mini)); return; }
        if (chip?.dataset.id) { miniOpen = false; peekId = peekId === chip.dataset.id ? null : chip.dataset.id; renderBar(); }
    });
    bar.addEventListener('input', event => { if (event.target.closest('.bl-notes-find')) applyFind(bar.querySelector('.bl-notes-mini')); });
    form.prepend(bar);
    renderBar();
}

// ── 요술봉 메뉴 ────────────────────────────────────────────
const MENU_ID = 'bl-notes-wand';
export function syncMenu() {
    syncBar();
    const want = getSettings().addonUI?.notesMenu !== false;
    const old = document.getElementById(MENU_ID);
    if (!want) { old?.remove(); return; }
    if (old) return;
    const container = document.getElementById('data_bank_wand_container') ?? document.getElementById('extensionsMenu');
    if (!container) return;
    const item = document.createElement('div');
    item.id = MENU_ID; item.className = 'list-group-item flex-container flexGap5 interactable'; item.tabIndex = 0; item.setAttribute('role', 'button');
    item.innerHTML = `<div class="fa-solid fa-note-sticky extensionsMenuExtensionButton"></div><span>${TITLE}</span>`;
    const open = () => openPanel();
    item.addEventListener('click', open);
    item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    container.append(item);
}

store();
applyLook();
try { eventSource.on(event_types.CHAT_CHANGED, onChatChanged); eventSource.on(event_types.CHAT_RENAMED, onChatRenamed); } catch (error) { console.warn('[메모] 채팅 이벤트:', error); }
let tries = 0;
const mount = () => { syncMenu(); if ((!document.getElementById(MENU_ID) || !document.getElementById(BAR_ID)) && tries++ < 20) setTimeout(mount, 500); };
mount();
setTimeout(restoreStickies, 1200); // 화면이 다 그려진 뒤 (꺼내 둔 쪽지는 PC 너비에서만)
verifyAddonCss({ folder: 'notes', name: '--bl-notes-css-version', version: VERSION, title: TITLE });
