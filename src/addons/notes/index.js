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
import { NOTES_VERSION } from './version.js';

export const VERSION = NOTES_VERSION;
const MODULE = 'bl-notes';
const TITLE = '메모';
const MAX_NOTES = 300;
const LOOK_DEFAULT = { font: '', size: 100, lh: '', ls: '', weight: '', cols: 'auto', sort: 'manual' };

// 1.2.0: 목록을 부를 때마다 새 배열 · 새 객체로 바꾸면(1.1.x) 앞에서 잡아 둔 배열에 한 일이 버려졌다
//        (위 · 아래 버튼이 안 움직이던 원인) → 한 배열은 한 번만, 제자리에서 다듬는다
const tidied = new WeakSet();
const HEX6 = /^#[0-9a-f]{6}$/i;
function store() {
    const s = extension_settings[MODULE] ??= {};
    if (!Array.isArray(s.notes)) s.notes = [];
    if (!tidied.has(s.notes)) {
        s.notes = s.notes.filter(n => n && typeof n === 'object');
        for (const n of s.notes) {
            n.id = String(n.id || uid()); n.title = String(n.title ?? ''); n.body = String(n.body ?? ''); n.updated = Number(n.updated) || 0;
            n.color = HEX6.test(String(n.color || '')) ? n.color : ''; n.ink = HEX6.test(String(n.ink || '')) ? n.ink : '';
            if (!(n.owner && typeof n.owner === 'object')) delete n.owner;
            if (!(typeof n.folder === 'string' && n.folder)) delete n.folder;
        }
        tidied.add(s.notes);
    }
    if (!Array.isArray(s.folders)) s.folders = [];
    if (!tidied.has(s.folders)) { s.folders = s.folders.filter(f => f && f.id); for (const f of s.folders) { f.id = String(f.id); f.name = String(f.name ?? ''); } tidied.add(s.folders); }
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
export function visibleNotes() { const key = currentOwner()?.key; return notes().filter(n => !n.owner || n.owner.key === key || strayOwner(n.owner)); }
const SORTS = [['manual', '직접 정한 순', 'fa-grip-lines'], ['name', '가나다순', 'fa-arrow-down-a-z'], ['time', '최근 고친 순', 'fa-clock-rotate-left']];
const sortName = note => (note.title || note.body || '').trim();
/** 보이는 순서: 직접 정한 순(저장 순서) · 가나다순(제목, 없으면 내용) · 최근 고친 순 */
export function orderedNotes() {
    const list = [...visibleNotes()], mode = look().sort || 'manual';
    if (mode === 'name') list.sort((a, b) => sortName(a).localeCompare(sortName(b), 'ko', { numeric: true, sensitivity: 'base' }));
    else if (mode === 'time') list.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return list;
}

// ── 태그 · 연결 · 폴더 ─────────────────────────────────────
// #태그: 띄어쓰기 없이 · '/' 로 하위 태그. 코드 칸 안 · 숫자만인 것(#1) · 제목(# 뒤 띄어쓰기)은 태그가 아니다
const TAG_RE = /(^|\s)#([\p{L}\p{N}_\-\/]*[\p{L}_\-][\p{L}\p{N}_\-\/]*)/gu;
// [[제목]] 연결 · ![[제목]] 끌어오기 · [[제목|보일 이름]]
const LINK_RE = /(!?)\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]+?))?\]\]/g;
const CODE_RE = /```[\s\S]*?```|`[^`\n]*`/g;
const stripCode = text => String(text || '').replace(CODE_RE, ' ');
/** 코드 칸 밖의 글에만 fn 을 적용 (코드 칸은 그대로) */
const outsideCode = (text, fn) => { const s = String(text || ''); let out = '', last = 0; for (const m of s.matchAll(CODE_RE)) { out += fn(s.slice(last, m.index)) + m[0]; last = m.index + m[0].length; } return out + fn(s.slice(last)); };
// #fff · #1a2b3c 같은 색 값은 태그가 아니다 — 세기 · 목록(tagsOf · allTags) · 그래프 · 그리기(decorate) · 찾기(applyFind)가 모두 tagName 하나로
// 5.3.5 규칙: 16진수 3·4·6·8자리이면서 ① 숫자가 섞였거나(#000 #1a2b3c #ff0) ② 한 글자만 되풀이(#fff #ffffff #eee)
// ③ 6·8자리가 두 글자씩 겹친 꼴(#ffeedd) · 두 글자가 번갈아(#fafafa) 일 때만 색. 영어 낱말(#add #bad #cafe #face #fade #decade #bead #abc)은 태그
const HEX_SHAPE = /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const isHexColor = t => { if (!HEX_SHAPE.test(t)) return false; const s = t.toLowerCase(); return /\d/.test(s) || /^(.)\1*$/.test(s) || (s.length >= 6 && (/^(?:(.)\1)+$/.test(s) || /^(..)\1+$/.test(s))); };
const tagName = raw => { const t = raw.replace(/\/+$/, ''); return t && !isHexColor(t) ? t : ''; };
// 그린 보기는 HTML 태그 속성 · 링크(a) 안 글을 태그로 안 그린다 — 셀 때도 뺀다
const stripForTags = text => stripCode(text).replace(/<[^>]*>/g, ' ').replace(/!?\[[^\]\n]*\]\([^)\n]*\)/g, ' ');
export function tagsOf(text) { const out = new Set(); for (const m of stripForTags(text).matchAll(TAG_RE)) out.add(tagName(m[2])); out.delete(''); return [...out]; }
export function linksOf(text) { return [...stripCode(text).matchAll(LINK_RE)].map(m => ({ title: m[2].trim(), embed: !!m[1] })).filter(l => l.title); }
const tagHit = (tags, q) => { const want = q.toLowerCase(); return tags.some(t => { const v = t.toLowerCase(); return v === want || v.startsWith(want + '/'); }); };
/** 보이는 메모에 쓰인 태그 [[태그, 개수]] — 많은 순 */
export function allTags() { const count = new Map(); for (const n of visibleNotes()) for (const t of tagsOf(n.body)) count.set(t, (count.get(t) || 0) + 1); return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')); }
/** 제목으로 메모 찾기 (대소문자 무시) — 지금 보이는 메모를 먼저 */
export function findByTitle(title) {
    const key = String(title || '').trim().toLowerCase(); if (!key) return null;
    const hit = n => n.title.trim().toLowerCase() === key;
    return visibleNotes().find(hit) || notes().find(hit) || null;
}
/** 내용 첫 줄을 글자만 (폴더 · 고르기 목록의 한 줄 미리보기) */
const plainLine = body => {
    for (const raw of String(body || '').split('\n')) {
        const line = raw.replace(/<[^>]+>/g, '').replace(/^\s*(#{1,6}\s+|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+|>\s*)/, '').replace(/!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (all, t, alias) => alias || t).replace(/[*_~`]+/g, '').trim();
        if (line) return line;
    }
    return '';
};
// 폴더: 메모마다 folder(폴더 id) · 폴더 목록 { id, name }. 목록에서는 폴더의 첫 메모 자리에 폴더 칸 하나로 보인다
export const folders = () => store().folders;
const folderById = id => (id ? folders().find(f => f.id === id) || null : null);
const folderName = f => (f?.name || '').trim() || '폴더';
/** 메모가 둘 미만인 폴더는 풀고, 없는 폴더를 가리키는 메모는 뗀다 */
function tidyFolders() {
    const s = store(), gone = [];
    for (const n of s.notes) if (n.folder && !s.folders.some(f => f.id === n.folder)) delete n.folder;
    s.folders = s.folders.filter(f => { const members = s.notes.filter(n => n.folder === f.id); if (members.length >= 2) return true; members.forEach(n => { delete n.folder; }); gone.push(f.id); return false; });
    for (const fid of gone) closeSticky('f:' + fid);
}
/** target = { id } (메모) 또는 { folder } 쪽으로 ids 메모를 모은다 → 폴더 id. 모은 메모는 폴더의 마지막 메모 뒤로 */
function joinFolder(target, ids) {
    const s = store(); let fid = target.folder;
    if (!fid) {
        const t = s.notes.find(n => n.id === target.id); if (!t) return null;
        fid = t.folder;
        if (!fid || !s.folders.some(f => f.id === fid)) { fid = 'f' + uid(); s.folders.push({ id: fid, name: '' }); t.folder = fid; }
    }
    if (!s.folders.some(f => f.id === fid)) return null;
    const moving = s.notes.filter(n => ids.includes(n.id) && n.folder !== fid);
    const rest = s.notes.filter(n => !moving.includes(n));
    moving.forEach(n => { n.folder = fid; });
    let at = -1; rest.forEach((n, i) => { if (n.folder === fid) at = i; });
    rest.splice(at + 1, 0, ...moving);
    s.notes = rest; tidyFolders(); save();
    return folderById(fid) ? fid : null;
}
function leaveFolder(id) {
    const s = store(), i = s.notes.findIndex(n => n.id === id); if (i < 0) return;
    const n = s.notes[i], fid = n.folder; if (!fid) return;
    s.notes.splice(i, 1); delete n.folder;
    let at = -1; s.notes.forEach((m, k) => { if (m.folder === fid) at = k; });
    s.notes.splice(at + 1, 0, n); tidyFolders(); save();
}
function breakFolder(fid) { const s = store(); s.notes.forEach(n => { if (n.folder === fid) delete n.folder; }); tidyFolders(); save(); }
/** 목록에 그릴 칸: 폴더 안이면 그 폴더 메모만, 밖이면 폴더는 첫 메모 자리에 한 칸 */
function displayItems(fid) {
    const list = orderedNotes();
    if (fid) return list.filter(n => n.folder === fid).map(note => ({ note }));
    const out = [], seen = new Set(), live = new Set(folders().map(f => f.id));
    for (const note of list) {
        if (note.folder && live.has(note.folder)) { if (seen.has(note.folder)) continue; seen.add(note.folder); out.push({ folder: note.folder }); }
        else out.push({ note });
    }
    return out;
}
/** 제목을 바꾸면 다른 메모의 [[옛 제목]] 도 새 제목으로 (같은 옛 제목 메모가 또 있으면 그쪽 연결이라 두고) */
function renameLinks(from, to, selfId) {
    const a = String(from || '').trim(), b = String(to || '').trim();
    if (!a || !b || a.toLowerCase() === b.toLowerCase()) return;
    if (notes().some(n => n.id !== selfId && n.title.trim().toLowerCase() === a.toLowerCase())) return;
    const pattern = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(!?\\[\\[)\\s*' + pattern + '\\s*((?:\\|[^\\]\\n]*)?\\]\\])', 'gi');
    let changed = 0;
    for (const n of [...notes()]) {
        const next = outsideCode(n.body, part => part.replace(re, (all, open, close) => { changed++; return open + b + close; })); // 코드 칸 안의 [[ ]] 는 글자 그대로
        if (next !== n.body) updateNote(n.id, { body: next });
    }
    if (changed) globalThis.toastr?.info(`다른 메모의 연결 ${changed}곳도 새 제목으로 바꿨어요.`, TITLE, { timeOut: 2500 });
}

// ── 자료 ───────────────────────────────────────────────────
export function addNote(title = '', body = '', at = 0) {
    const list = notes();
    if (list.length >= MAX_NOTES) { globalThis.toastr?.warning(`메모는 ${MAX_NOTES}개까지예요.`, TITLE); return null; }
    const owner = currentOwner();
    const note = { id: uid(), title, body, updated: Date.now(), ...(owner ? { owner } : {}) };
    list.splice(Math.max(0, Math.min(at, list.length)), 0, note);
    save(); if (String(title).trim()) syncLinkViews(); return note;
}
export function removeNote(id) { const list = notes(), i = list.findIndex(n => n.id === id); if (i < 0) return false; list.splice(i, 1); save(); syncLinkViews(); return true; }
// 전체 메모를 복제하면 복사본도 전체 메모 (addNote 가 지금 채팅을 붙이므로 뗀다)
export function duplicateNote(id) { const list = notes(), i = list.findIndex(n => n.id === id); if (i < 0) return null; const made = addNote(list[i].title, list[i].body, i + 1); if (made) { made.color = list[i].color || ''; made.ink = list[i].ink || ''; if (list[i].owner) made.owner = { ...list[i].owner }; else delete made.owner; if (list[i].folder) made.folder = list[i].folder; save(); } return made; }
export function moveNote(id, delta) {
    // 보이는 칸끼리 자리 바꿈 — 폴더는 한 칸(폴더 메모 전부가 같이 움직인다), 다른 채팅 메모는 건너뜀
    const units = displayItems('').map(x => (x.folder ? orderedNotes().filter(n => n.folder === x.folder).map(n => n.id) : [x.note.id]));
    const vi = units.findIndex(u => u.includes(id)), vj = vi + delta;
    if (vi < 0 || vj < 0 || vj >= units.length) return false;
    [units[vi], units[vj]] = [units[vj], units[vi]];
    placeVisible(units.flat()); save(); return true;
}
export function updateNote(id, patch) {
    const note = notes().find(n => n.id === id); if (!note) return false;
    const retitled = 'title' in patch && String(patch.title ?? '').trim().toLowerCase() !== note.title.trim().toLowerCase();
    Object.assign(note, patch, { updated: Date.now() }); save(); syncViews(id);
    if (retitled) syncLinkViews(); // [[제목]] · ![[제목]] 이 가리키는 메모가 바뀌었을 수 있다
    return true;
}

// ── 내용 그리기 (채팅 본문과 같은 길) ──────────────────────
/** host(.bl-notes-view) 안에 채팅처럼 그린다: 표시 정규식 · 마크다운 · 대사 q · 감정 대사 */
let previewRulesOn = false;
// 인용(>) 안 목록도 체크 줄 · 코드 칸(``` · ~~~) 안은 글자 그대로 — 그린 보기(drawTasks)와 같은 규칙으로 센다
const TASK_RE = /^(\s*(?:>\s*)*(?:[-*+]|\d+\.)\s+)\[([ xX])\](?=\s|$)/;
const FENCE_RE = /^\s*(?:>\s*)*(`{3,}|~{3,})/;
/** k 번째 체크 목록 줄의 [ ] ↔ [x] */
function toggleTask(text, k) {
    let n = -1, fence = '';
    return String(text).split('\n').map(line => {
        const f = FENCE_RE.exec(line);
        if (f) { if (!fence) fence = f[1][0]; else if (f[1][0] === fence) fence = ''; return line; }
        if (fence) return line;
        return line.replace(TASK_RE, (all, lead, mark) => (++n === k ? `${lead}[${mark.trim() ? ' ' : 'x'}]` : all));
    }).join('\n');
}
/** 글자 조각 바로 뒤가 띄어쓰기 · 줄 끝인가 (원문의 '[x] ' 규칙과 맞춘다 — '[x]글자' 는 상자가 아니다) */
function endsWord(node) {
    let s = node.nextSibling; while (s && s.nodeType === 3 && !s.data) s = s.nextSibling;
    if (!s) return true;
    if (s.nodeType === 3) return /^\s/.test(s.data);
    return /^(UL|OL|BR|P|DIV)$/.test(s.nodeName);
}
/** 그린 목록에서 '[ ] ' · '[x] ' 로 시작하는 항목을 상자로 — 순서대로 번호를 붙여 원문의 k 번째와 짝짓는다 */
function drawTasks(body, onToggle) {
    let k = 0;
    for (const li of body.querySelectorAll('li')) {
        const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode(); while (node && !node.data.trim()) node = walker.nextNode();
        if (!node || node.parentElement.closest('li') !== li || node.parentElement.closest('code, pre')) continue;
        const m = /^\s*\[([ xX])\](?:\s|$)/.exec(node.data); if (!m || (m[0].endsWith(']') && !endsWord(node))) continue;
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
// 그린 본문의 글자에서 #태그 · [[연결]] · ![[끌어오기]] 를 누를 수 있는 조각으로 (코드 · 링크 안은 그대로)
const DECOR_RE = /(!?)\[\[([^\[\]\n|]+?)(?:\|([^\[\]\n]+?))?\]\]|(^|\s)#([\p{L}\p{N}_\-\/]*[\p{L}_\-][\p{L}\p{N}_\-\/]*)/gu;
const tagEl = tag => { const b = document.createElement('button'); b.type = 'button'; b.className = 'bl-note-tag'; b.dataset.tag = tag; b.textContent = '#' + tag; b.title = `#${tag} 메모만 보기`; return b; };
function linkEl(title, alias, target) {
    const b = document.createElement('button'); b.type = 'button';
    b.className = 'bl-note-link' + (target ? '' : ' is-missing'); b.dataset.noteLink = title;
    b.textContent = String(alias || title).trim(); b.title = target ? `'${title}' 메모로` : `'${title}' — 누르면 새 메모로 만들어요`;
    return b;
}
function embedEl(target, depth) {
    const box = document.createElement('div'); box.className = 'bl-note-embed'; box.dataset.embed = target.id;
    if (target.color) { box.classList.add('has-color'); box.style.setProperty('--bl-note-c', target.color); }
    const head = linkEl(target.title, '', target); head.classList.add('bl-note-embed-title');
    head.innerHTML = `<i class="fa-regular fa-note-sticky" aria-hidden="true"></i> ${escA(target.title)}`;
    const inner = document.createElement('div'); inner.className = 'bl-note-embed-body';
    box.append(head, inner);
    const text = String(target.body || '').trim();
    if (!text) { inner.innerHTML = '<p class="bl-note-embed-empty">비어 있는 메모예요.</p>'; return box; }
    try { inner.innerHTML = messageFormatting(text, '', false, false, -1, {}, false); } catch { inner.textContent = text; }
    try { drawTasks(inner, k => { const n = notes().find(x => x.id === target.id); if (n) updateNote(n.id, { body: toggleTask(n.body, k) }); }); } catch { /* 표시용 */ }
    try { decorate(inner, target.id, depth + 1); } catch { /* 표시용 */ }
    return box;
}
function decorate(body, selfId = '', depth = 0) {
    const skip = 'code, pre, a, button, textarea, .bl-note-embed-title';
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode: node => (node.parentElement?.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
        const text = node.data; if (!text.includes('[[') && !text.includes('#')) continue;
        const parts = []; let last = 0;
        for (const m of text.matchAll(DECOR_RE)) {
            if (m[5] !== undefined) { const t = tagName(m[5]); if (!t) continue; const at = m.index + m[4].length; parts.push(text.slice(last, at), tagEl(t)); last = m.index + m[0].length; continue; }
            const title = m[2].trim(), target = findByTitle(title);
            parts.push(text.slice(last, m.index), m[1] && depth < 1 && target && target.id !== selfId ? embedEl(target, depth) : linkEl(title, m[3], target));
            last = m.index + m[0].length;
        }
        if (!parts.length) continue;
        parts.push(text.slice(last));
        node.replaceWith(...parts.filter(p => p !== ''));
    }
}
function renderView(host, text, onToggle, selfId = '') {
    // 채팅 서식의 사본 규칙(.salty-preview …)은 시작 속도 때문에 꺼져 있다 — 처음 그릴 때 한 번 켠다 (북마크 창과 같음)
    if (!previewRulesOn) { previewRulesOn = true; try { restorePreviewRules(); } catch { /* 표시용 */ } }
    if (!host.firstChild) host.innerHTML = '<div class="mes"><div class="mes_block"><div class="mes_text"></div></div></div>';
    const body = host.querySelector('.mes_text');
    const raw = String(text ?? '').trim();
    if (!raw) { body.innerHTML = ''; return; }
    try { body.innerHTML = messageFormatting(raw, '', false, false, -1, {}, false); }
    catch (error) { console.warn('[메모] 본문 그리기 실패:', error); body.textContent = raw; }
    try { drawTasks(body, onToggle); } catch (error) { console.warn('[메모] 체크 상자:', error); }
    try { decorate(body, selfId, 0); } catch (error) { console.warn('[메모] 태그 · 연결:', error); }
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
    link: ['fa-link', '링크 (외부 링크 · 메모 끌어오기)', '', ''],
    quote: ['fa-quote-left', '대사 따옴표', '"', '"'], color: ['fa-palette', '글자색', '', ''],
};
// 설정 목록에 쓰는 짧은 이름 (버튼 풍선말은 FMT_ALL 의 긴 이름)
const FMT_SHORT = { b: '굵게', i: '기울기', s: '취소선', u: '밑줄', h: '제목', list: '목록', code: '코드', mark: '형광펜', link: '링크', quote: '따옴표', color: '글자색' };
const FMT_DEFAULT = [['b', 1], ['i', 1], ['s', 1], ['u', 1], ['h', 1], ['list', 1], ['code', 1], ['mark', 1], ['link', 1], ['quote', 0], ['color', 0]];
const SWATCHES = ['#e05a5a', '#e8913a', '#e6c23a', '#5fbf6a', '#3fb8c4', '#6f9cf5', '#a37ef0', '#f28cc0', '#9aa0a6'];
/** [{ k, on }] — 저장된 순서를 따르고, 새로 생긴 버튼은 기본값으로 뒤에 붙인다 */
function fmtButtons() {
    const saved = Array.isArray(look().fmtButtons) ? look().fmtButtons.filter(x => x && FMT_ALL[x.k]) : [];
    const out = saved.map(x => ({ k: x.k, on: !!x.on })), seen = new Set(out.map(x => x.k));
    // 새로 생긴 버튼은 기본 순서의 앞 버튼 바로 뒤에 (링크 → 형광펜 옆)
    FMT_DEFAULT.forEach(([k, on], i) => {
        if (seen.has(k)) return;
        const prev = FMT_DEFAULT.slice(0, i).map(([p]) => p).reverse().find(p => seen.has(p));
        const at = prev ? out.findIndex(x => x.k === prev) + 1 : 0;
        out.splice(at, 0, { k, on: !!on }); seen.add(k);
    });
    return out;
}
const LINK_MENU = `<button type="button" class="bl-note-btn bl-note-linkopt" data-link-mode="url" title="인터넷 주소를 링크로" aria-label="외부 링크"><i class="fa-solid fa-globe"></i><span>외부 링크</span></button><button type="button" class="bl-note-btn bl-note-linkopt" data-link-mode="note" title="다른 메모를 연결하거나 내용째 끌어와요" aria-label="메모 끌어오기"><i class="fa-regular fa-note-sticky"></i><span>메모 끌어오기</span></button>`;
const popHtml = (key, inner) => `<span class="bl-note-fmt-h"><button type="button" class="bl-note-btn" data-fmt="${key}" title="${FMT_ALL[key][1]}" aria-label="${FMT_ALL[key][1]}"><i class="fa-solid ${FMT_ALL[key][0]}"></i></button><span class="bl-note-fmt-hs" data-pop="${key}" hidden>${inner}</span></span>`;
function toolsHtml() {
    return fmtButtons().filter(x => x.on).map(({ k }) => {
        if (k === 'h') return popHtml('h', [1, 2, 3].map(n => `<button type="button" class="bl-note-btn" data-heading="${n}" title="제목 ${n}" aria-label="제목 ${n}">H${n}</button>`).join(''));
        if (k === 'list') return popHtml('list', [['- ', 'fa-list-ul', '점 목록'], ['1. ', 'fa-list-ol', '번호 목록'], ['- [ ] ', 'fa-list-check', '체크박스 목록']].map(([mark, icon, name]) => `<button type="button" class="bl-note-btn" data-list="${mark}" title="${name}" aria-label="${name}"><i class="fa-solid ${icon}"></i></button>`).join(''));
        if (k === 'link') return popHtml('link', LINK_MENU);
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
        s = start > 0 ? value.lastIndexOf('\n', start - 1) + 1 : 0; // lastIndexOf(-1) 은 0 번째 줄바꿈을 찾아 s > e (IndexSizeError)
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
function placePop(pop, anchor = null) {
    if (pop.hidden) { pop.style.position = ''; return; }
    const button = pop.parentElement?.querySelector(':scope > button') || pop.previousElementSibling;
    const b = anchor || button.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    Object.assign(pop.style, { position: 'fixed', right: 'auto', bottom: 'auto', left: '0px', top: '0px' });
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = Math.min(Math.max(8, b.left), vw - 8 - w), y = b.bottom + 4;
    if (y + h > vh - 8 && b.top - 4 - h > 8) y = b.top - 4 - h; // 아래가 모자라면 위로
    pop.style.left = `${Math.round(x)}px`; pop.style.top = `${Math.round(y)}px`;
    const r = pop.getBoundingClientRect(); // 기준이 화면이 아니면 어긋난 만큼 보정
    if (Math.abs(r.left - x) > 1 || Math.abs(r.top - y) > 1) { pop.style.left = `${Math.round(2 * x - r.left)}px`; pop.style.top = `${Math.round(2 * y - r.top)}px`; }
}
// 스크롤 · 창 크기가 바뀌면 열린 팝업을 닫는다 (버튼에서 떨어져 떠 있지 않게)
// (주소 · 찾기 칸에 글을 쓰는 중인 팝업은 닫지 않고 자리만 — 폰 자판이 올라오면 화면 크기가 바뀐다)
// 스크롤마다 문서 전체를 선택자로 훑지 않게: 팝업 칸만 담긴 살아 있는 목록 + 한 화면(프레임)에 한 번
const popEls = document.getElementsByClassName('bl-note-fmt-hs');
const closeLoosePops = () => { for (const p of [...popEls]) { if (p.hidden) continue; if (p.contains(document.activeElement)) { if (!p.classList.contains('bl-note-ac')) placePop(p); continue; } p.hidden = true; p.style.position = ''; } };
let looseFrame = 0;
const closeLooseSoon = () => { if (!looseFrame) looseFrame = requestAnimationFrame(() => { looseFrame = 0; closeLoosePops(); }); };
addEventListener('resize', closeLooseSoon);
document.addEventListener('scroll', e => { if (!looseFrame && popEls.length && e.target?.closest?.('.bl-notes-dialog, .bl-notes-mini, #chat')) closeLooseSoon(); }, true);
/** 편집 칸 안 글자 커서의 화면 위치 (거울 칸으로 잰다) — [[ 고르기 목록을 커서 밑에 */
function caretRect(area) {
    const cs = getComputedStyle(area), m = document.createElement('div');
    for (const p of ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'wordSpacing', 'tabSize']) m.style[p] = cs[p];
    Object.assign(m.style, { position: 'fixed', visibility: 'hidden', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', top: '0px', left: '-9999px', borderStyle: 'solid' });
    m.textContent = area.value.slice(0, area.selectionStart ?? 0);
    const mark = document.createElement('span'); mark.textContent = '​'; m.append(mark); document.body.append(m);
    const r = area.getBoundingClientRect(), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5 || 20;
    const x = Math.min(mark.offsetLeft, r.width - 24), y = mark.offsetTop - area.scrollTop; m.remove();
    const top = Math.max(r.top, Math.min(r.bottom - lh, r.top + y));
    return { left: r.left + x, right: r.left + x, top, bottom: top + lh, width: 0, height: lh };
}
/** 메모 고르기 줄 (연결 · 끌어오기 · [[ 자동 목록 공용) — 제목 있는 메모만 */
function pickNotes(q, selfId) {
    const needle = String(q || '').trim().toLowerCase();
    return visibleNotes().filter(n => n.id !== selfId && n.title.trim() && (!needle || n.title.toLowerCase().includes(needle))).slice(0, 30);
}
const pickRow = (n, on = false) => `<button type="button" class="bl-note-pickrow${on ? ' on' : ''}" data-pick-note="${n.id}"><b>${escA(n.title.trim())}</b><small>${escA(plainLine(n.body))}</small></button>`;
function formatBar(area) {
    const bar = document.createElement('div'); bar.className = 'bl-note-fmt'; bar.hidden = true;
    bar.innerHTML = `<button type="button" class="bl-note-btn bl-note-fmt-toggle" data-fmt="toggle" title="서식 버튼 펼치기 · 접기" aria-label="서식 버튼 펼치기 · 접기"><i class="fa-solid fa-pen-nib"></i></button><span class="bl-note-fmt-tools">${toolsHtml()}</span><span class="bl-note-fmt-hs bl-note-ac" hidden></span>`;
    bar.classList.toggle('is-open', !!look().fmtOpen);
    bar.addEventListener('pointerdown', event => { if (!event.target.closest('input')) event.preventDefault(); }); // 편집 칸의 초점(blur → 보기 전환)을 뺏지 않는다 (팝업 안 입력 칸은 제외)
    const pops = () => bar.querySelectorAll('.bl-note-fmt-hs');
    const closePops = (keep = null) => pops().forEach(p => { if (p !== keep) p.hidden = true; });
    bar._closePops = closePops;
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
        if (pop) { closePops(pop); if (key === 'link') { pop.innerHTML = LINK_MENU; pop.classList.remove('is-pick', 'is-url'); bar._sel = [area.selectionStart, area.selectionEnd]; } pop.hidden = !pop.hidden; placePop(pop); return; }
        const f = FMT_ALL[key]; if (f) surround(area, f[2], f[3], false);
        done();
    });
    return bar;
}
function bodyField(view, area, getText, commit, mount = fmt => area.before(fmt)) {
    const fmt = formatBar(area); mount(fmt);
    const selfId = () => area.dataset.noteId || '';
    const toggleAt = k => { const next = toggleTask(getText(), k); area.value = next; commit(next, true); draw(); };
    const draw = () => renderView(view, getText(), toggleAt, selfId());
    const show = editing => {
        const text = getText();
        const edit = editing || !text.trim();
        view.hidden = edit; area.hidden = !edit; fmt.hidden = !edit;
        if (!edit) { acClose(); fmt._closePops?.(); draw(); }
        else grow(area);
    };
    const leave = () => { acClose(); commit(area.value, true); show(false); };
    view.title = '눌러서 고치기';
    view.addEventListener('click', event => { if (event.target.closest('a, details, summary, button, .bl-note-check')) return; show(true); area.focus({ preventScroll: true }); try { area.setSelectionRange(area.value.length, area.value.length); } catch { /* 표시용 */ } });
    // 서식 줄 팝업 안 입력 칸(주소 · 메모 찾기)으로 초점이 가면 편집을 끝내지 않는다
    area.addEventListener('blur', event => { if (fmt.contains(event.relatedTarget)) return; leave(); });
    fmt.addEventListener('focusout', event => { if (fmt.contains(event.relatedTarget) || event.relatedTarget === area) return; fmt._closePops?.(); leave(); });
    area.addEventListener('input', () => { grow(area); commit(area.value, false); acCheck(); });
    // ── 넣기 도우미: 선택 자리 → 글 넣기 ──
    const insert = (text, s, e) => { area.focus({ preventScroll: true }); area.setRangeText(text, s, e, 'end'); area.dispatchEvent(new Event('input', { bubbles: true })); };
    // ── [[ 치면 메모 목록 (커서 밑) — 위아래 · 엔터 · 탭 · Esc ──
    const ac = fmt.querySelector('.bl-note-ac'); let acFrom = -1, acBang = '', acIndex = 0, acList = [];
    function acClose() { if (ac) ac.hidden = true; acFrom = -1; acList = []; }
    function acDraw() { ac.innerHTML = acList.map((n, i) => pickRow(n, i === acIndex)).join(''); }
    function acCheck() {
        if (!ac) return;
        const pos = area.selectionStart; if (pos !== area.selectionEnd) return acClose();
        const m = /(!?)\[\[([^\[\]\n|]{0,40})$/.exec(area.value.slice(0, pos));
        if (!m) return acClose();
        acList = pickNotes(m[2], selfId()).slice(0, 8);
        if (!acList.length) return acClose();
        acFrom = m.index; acBang = m[1]; acIndex = Math.min(acIndex, acList.length - 1);
        acDraw(); ac.hidden = false; placePop(ac, caretRect(area));
    }
    const acPick = id => {
        const n = notes().find(x => x.id === id); if (!n || acFrom < 0) return;
        const pos = area.selectionStart, end = area.value.slice(pos, pos + 2) === ']]' ? pos + 2 : pos;
        const from = acFrom; acClose(); insert(`${acBang}[[${n.title.trim()}]]`, from, end);
    };
    // ── 링크 버튼 팝업: 외부 링크(주소) · 메모 끌어오기(연결 / 내용째) ──
    let pickEmbed = false;
    const linkPop = () => fmt.querySelector('[data-pop="link"]');
    const drawPick = (pop, q = '') => {
        const rows = pickNotes(q, selfId());
        pop.querySelector('.bl-note-picklist').innerHTML = rows.map(n => pickRow(n)).join('') || `<p class="bl-note-picknone">${q ? '그런 제목의 메모가 없어요.' : '제목이 있는 다른 메모가 없어요.'}</p>`;
    };
    fmt.addEventListener('click', event => {
        const pickBtn = event.target.closest('[data-pick-note]');
        if (pickBtn) {
            if (pickBtn.closest('.bl-note-ac')) { acPick(pickBtn.dataset.pickNote); return; }
            const n = notes().find(x => x.id === pickBtn.dataset.pickNote); if (!n) return;
            const [s, e] = fmt._sel || [area.selectionStart, area.selectionEnd];
            fmt._closePops?.(); insert(`${pickEmbed ? '!' : ''}[[${n.title.trim()}]]`, s, e); return;
        }
        const kind = event.target.closest('[data-pick-kind]');
        if (kind) { pickEmbed = kind.dataset.pickKind === 'embed'; kind.parentElement.querySelectorAll('[data-pick-kind]').forEach(b => b.classList.toggle('on', b === kind)); return; }
        const mode = event.target.closest('[data-link-mode]')?.dataset.linkMode, pop = linkPop();
        if (mode === 'url' && pop) {
            pop.classList.add('is-url'); pop.classList.remove('is-pick');
            pop.innerHTML = `<span class="bl-note-urlrow"><i class="fa-solid fa-globe" aria-hidden="true"></i><input type="url" inputmode="url" placeholder="https://" spellcheck="false" autocomplete="off" aria-label="링크 주소"><button type="button" class="bl-note-btn" data-link-ok title="넣기" aria-label="넣기"><i class="fa-solid fa-check"></i></button></span>`;
            placePop(pop); pop.querySelector('input').focus({ preventScroll: true }); return;
        }
        if (mode === 'note' && pop) {
            pickEmbed = false; pop.classList.add('is-pick'); pop.classList.remove('is-url');
            pop.innerHTML = `<span class="bl-note-pickhead"><span class="bl-note-pickseg" role="radiogroup" aria-label="넣는 방식"><button type="button" class="on" data-pick-kind="link" title="[[제목]] — 누르면 그 메모로 가요">연결</button><button type="button" data-pick-kind="embed" title="![[제목]] — 그 메모 내용을 여기 그대로 보여요">내용째</button></span><input type="search" placeholder="메모 찾기" spellcheck="false" autocomplete="off" aria-label="메모 찾기"></span><span class="bl-note-picklist"></span>`;
            drawPick(pop); placePop(pop); return;
        }
        if (event.target.closest('[data-link-ok]')) insertUrl();
    });
    const insertUrl = () => {
        const input = linkPop()?.querySelector('input[type="url"]'); let url = input?.value.trim(); if (!url) return;
        if (!/^[a-z][\w+.-]*:/i.test(url)) url = 'https://' + url;
        const [s, e] = fmt._sel || [area.selectionStart, area.selectionEnd];
        const text = area.value.slice(s, e).trim() || url.replace(/^https?:\/\//i, '');
        fmt._closePops?.(); insert(`[${text.replace(/[\[\]]/g, '')}](${url})`, s, e);
    };
    fmt.addEventListener('input', event => { const pop = linkPop(); if (pop && event.target.closest('.bl-note-pickhead')) drawPick(pop, event.target.value); });
    fmt.addEventListener('keydown', event => {
        if (event.target.matches('input[type="url"]') && event.key === 'Enter') { event.preventDefault(); insertUrl(); }
        if (event.key === 'Escape' && event.target.matches('input')) { event.preventDefault(); fmt._closePops?.(); area.focus({ preventScroll: true }); }
    });
    // 목록 이어 쓰기: 엔터 → 다음 줄에 같은 표시(- · - [ ] · 다음 번호). 표시만 남은 빈 항목에서 엔터 → 표시를 지우고 목록 끝
    area.addEventListener('keydown', event => {
        if (ac && !ac.hidden && acList.length) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); acIndex = (acIndex + (event.key === 'ArrowDown' ? 1 : -1) + acList.length) % acList.length; acDraw(); return; }
            if ((event.key === 'Enter' || event.key === 'Tab') && !event.isComposing) { event.preventDefault(); acPick(acList[acIndex].id); return; }
            if (event.key === 'Escape') { event.preventDefault(); acClose(); return; }
        }
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
    area.addEventListener('click', acCheck);
    show(false);
    return { show, refresh: () => { if (area.hidden) draw(); else if (document.activeElement !== area && area.value !== getText()) { area.value = getText(); grow(area); } } };
}
/** 저장된 값이 바뀌면(다른 보기에서 고침) 열린 카드 · 펼침 · 쪽지를 맞춘다 */
function syncViews(id) {
    for (const el of document.querySelectorAll(`.bl-note[data-id="${id}"], .bl-sticky[data-id="${id}"], .bl-notes-peek[data-id="${id}"]`)) el._sync?.();
    // 이 메모를 담은 폴더 칸 · 폴더 쪽지, 이 메모를 끌어온(![[ ]]) 다른 메모
    for (const el of document.querySelectorAll('.bl-note-folder, .bl-sticky-folder')) if ((el.dataset.ids || '').split('|').includes(id)) el._sync?.();
    const hosts = new Set([...document.querySelectorAll(`.bl-note-embed[data-embed="${id}"]`)].map(e => e.closest('.bl-note, .bl-sticky, .bl-notes-peek')).filter(Boolean));
    hosts.forEach(el => el._sync?.());
}
/** 제목이 바뀌거나 메모가 생기고 없어지면 [[연결]] · ![[끌어오기]] 가 든 보기를 다시 그린다 (없는 제목 ↔ 있는 제목) */
function syncLinkViews() {
    const hosts = new Set([...document.querySelectorAll('.bl-notes-view .bl-note-link, .bl-notes-view .bl-note-embed')].map(e => e.closest('.bl-note, .bl-sticky, .bl-notes-peek')).filter(Boolean));
    hosts.forEach(el => el._sync?.());
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
    measureOwners();
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
// 캐릭터 이름을 바꾸면 카드 파일(avatar)이 바뀐다 → 귀속 key 도 새 파일로 (채팅 파일 이름은 그대로)
function onCharacterRenamed(oldAvatar, newAvatar) {
    if (!oldAvatar || !newAvatar || oldAvatar === newAvatar) return;
    let changed = false;
    for (const n of notes()) { const o = n.owner; if (!o || o.group || o.avatar !== oldAvatar) continue; n.owner = { ...o, avatar: newAvatar, key: `${newAvatar}/${o.chat}` }; changed = true; }
    if (changed) { save(); rerenderAll(); }
}
/** 지운 채팅의 메모는 전체 메모로 — 안 보이는 채 남지 않게 */
function releaseNotes(match) {
    let count = 0;
    for (const n of notes()) if (n.owner && match(n.owner)) { delete n.owner; count++; }
    if (!count) return;
    save(); rerenderAll();
    globalThis.toastr?.info(`지운 채팅의 메모 ${count}개를 전체 메모로 옮겼어요.`, TITLE, { timeOut: 3500 });
}
// CHAT_DELETED 는 채팅 이름만 준다 — 지금 캐릭터의 그 채팅을 먼저, 없으면 같은 이름의 채팅 (이름에 캐릭터 이름 · 시각이 들어 있어 겹칠 일이 드물다)
function onChatDeleted(name) {
    const chat = String(name || '').replace(/\.jsonl$/i, ''); if (!chat) return;
    const c = getContext(), avatar = c.groupId ? '' : c.characters?.[c.characterId]?.avatar;
    const hit = o => !o.group && o.chat === chat;
    releaseNotes(avatar && notes().some(n => n.owner && hit(n.owner) && n.owner.avatar === avatar) ? o => hit(o) && o.avatar === avatar : hit);
}
function onGroupChatDeleted(chatId) { const chat = String(chatId || ''); if (chat) releaseNotes(o => !!o.group && o.chat === chat); }
// 캐릭터 · 그룹 자체가 없어진 메모(지운 캐릭터 · 이 수정 전에 이름을 바꾼 캐릭터)는 고치지 않고 어느 채팅에서나 보인다
// — 귀속 표시를 꾹 눌러 다시 귀속. 목록은 채팅을 열 때(캐릭터 목록이 다 불린 뒤) 다시 잰다
let liveOwners = null;
function measureOwners() {
    const c = getContext(), chars = c.characters || [];
    liveOwners = c.chatId && chars.length ? { avatars: new Set(chars.map(ch => ch.avatar)), groups: new Set((c.groups || []).map(g => g.id)) } : null;
}
const strayOwner = o => !!liveOwners && (o.group ? !liveOwners.groups.has(o.group) : !!o.avatar && !liveOwners.avatars.has(o.avatar));

// ── 창 ─────────────────────────────────────────────────────
let dialog = null;
// 날짜는 짧게: 오늘이면 시:분, 올해면 월.일, 그 전이면 연.월.일 — 칸이 좁아도 날짜 · 버튼이 한 줄에 (전체는 마우스를 올리면)
const pad2 = n => String(n).padStart(2, '0');
const whenFull = ts => { if (!ts) return ''; const d = new Date(ts); return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const when = ts => { if (!ts) return ''; const d = new Date(ts), now = new Date(); if (d.toDateString() === now.toDateString()) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; return d.getFullYear() === now.getFullYear() ? `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}` : `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`; };
const grow = area => { if (area.hidden) return; area.style.height = 'auto'; area.style.height = Math.min(area.scrollHeight + 2, 480) + 'px'; };

/** 카드를 다시 써도 되는지 — 카드 틀에 박힌 것(폴더 안 · 귀속 표시 · 색)이 같을 때만 */
const cardSig = (note, inFolder) => [inFolder ? 1 : 0, note.owner?.key || '', note.owner?.name || '', note.color || '', note.ink || ''].join('|');
function card(note, index, total, inFolder = false) {
    const el = document.createElement('article'); el._sig = cardSig(note, inFolder); el._upd = note.updated;
    el.className = 'bl-note'; el.dataset.id = note.id; paintNote(el, note.color, note.ink);
    el.innerHTML = `<div class="bl-note-head"><input class="bl-note-title" type="text" maxlength="120" placeholder="제목" spellcheck="false"></div>
<div class="bl-note-view bl-notes-view salty-preview" hidden></div>
<textarea class="bl-note-body" rows="2" placeholder="내용" spellcheck="false"></textarea>
<div class="bl-note-tools">${colorButton(note.id)}<time class="bl-note-time"></time>${ownerBadge(note)}
 ${inFolder ? '<button type="button" class="bl-note-btn" data-act="unfolder" title="폴더에서 빼기" aria-label="폴더에서 빼기"><i class="fa-solid fa-arrow-up-from-bracket"></i></button>' : `<button type="button" class="bl-note-btn" data-act="up" title="위로" aria-label="위로" ${index === 0 ? 'disabled' : ''}><i class="fa-solid fa-chevron-up"></i></button>
 <button type="button" class="bl-note-btn" data-act="down" title="아래로" aria-label="아래로" ${index === total - 1 ? 'disabled' : ''}><i class="fa-solid fa-chevron-down"></i></button>`}
 <button type="button" class="bl-note-btn" data-act="copy" title="복제" aria-label="복제"><i class="fa-regular fa-clone"></i></button>
 <button type="button" class="bl-note-btn bl-note-pop" data-act="pop" title="화면에 꺼내 두기 (PC)" aria-label="화면에 꺼내 두기"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
 <button type="button" class="bl-note-btn bl-note-danger" data-act="del" title="지우기" aria-label="지우기"><i class="fa-regular fa-trash-can"></i></button>
</div>`;
    const title = el.querySelector('.bl-note-title'), body = el.querySelector('.bl-note-body'), view = el.querySelector('.bl-note-view'), time = el.querySelector('.bl-note-time');
    title.value = note.title; body.value = note.body; time.textContent = when(note.updated); time.title = whenFull(note.updated); body.dataset.noteId = note.id;
    let timer = 0;
    const current = () => notes().find(n => n.id === note.id) ?? note;
    const commit = (value, now) => { clearTimeout(timer); const run = () => { const n = current(); if (n.title !== title.value || n.body !== body.value) { updateNote(note.id, { title: title.value, body: body.value }); time.textContent = when(Date.now()); } }; now ? run() : (timer = setTimeout(run, 350)); };
    title.addEventListener('input', () => commit(null, false));
    let titleBefore = null; // 제목을 고치기 시작할 때의 제목 — 칸에서 나가면 다른 메모의 [[연결]] 도 새 제목으로
    title.addEventListener('focus', () => { titleBefore = current().title; });
    title.addEventListener('blur', () => { commit(null, true); if (titleBefore !== null && titleBefore !== title.value) renameLinks(titleBefore, title.value, note.id); titleBefore = null; });
    title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); field.show(true); body.focus(); } });
    const field = bodyField(view, body, () => body.value, commit, fmt => title.after(fmt));
    el._sync = () => { const n = current(); el._upd = n.updated; if (document.activeElement !== title) title.value = n.title; if (document.activeElement !== body) body.value = n.body; field.refresh(); time.textContent = when(n.updated); time.title = whenFull(n.updated); };
    return el;
}

/** 폴더 칸 — 작게 접혀서 메모마다 제목 + 내용 첫 줄 한 줄 (좁으면 제목만). 누르면 폴더 안으로 */
const folderRow = n => `<div class="bl-folder-row${n.color ? ' has-color' : ''}" data-act="folder-open" data-note="${n.id}" role="button" tabindex="0"${n.color ? ` style="--bl-note-c:${n.color}"` : ''}><b>${escA(n.title.trim() || '제목 없음')}</b><span>${escA(plainLine(n.body))}</span></div>`;
function folderCard(fid) {
    const el = document.createElement('article');
    el.className = 'bl-note bl-note-folder'; el.dataset.folder = fid;
    const draw = () => {
        const f = folderById(fid); if (!f) return;
        const list = orderedNotes().filter(n => n.folder === fid);
        el.dataset.ids = list.map(n => n.id).join('|');
        el.innerHTML = `<div class="bl-folder-head" data-act="folder-open" role="button" tabindex="0" title="폴더 열기"><i class="fa-solid fa-folder" aria-hidden="true"></i><b>${escA(folderName(f))}</b><small>${list.length}</small><i class="fa-solid fa-chevron-right bl-folder-go" aria-hidden="true"></i></div><div class="bl-folder-rows">${list.map(folderRow).join('')}</div>`;
    };
    draw(); el._sync = draw;
    return el;
}
/** 폴더 안에 들어가 있으면 목록 위에 ‹ 폴더 이름 줄 */
function syncFolderBar(root, fid) {
    const host = root.querySelector('.bl-notes-list'); let bar = root.querySelector('.bl-folder-bar');
    if (!bar) {
        bar = document.createElement('div'); bar.className = 'bl-folder-bar';
        bar.innerHTML = `<button type="button" class="bl-note-btn" data-act="folder-back" title="폴더 밖으로" aria-label="폴더 밖으로"><i class="fa-solid fa-chevron-left"></i></button><i class="fa-solid fa-folder-open" aria-hidden="true"></i><input class="bl-folder-name" type="text" maxlength="40" placeholder="폴더" spellcheck="false" aria-label="폴더 이름"><button type="button" class="bl-note-btn bl-note-pop" data-act="folder-pop" title="폴더째 화면에 꺼내 두기 (PC)" aria-label="폴더째 화면에 꺼내 두기"><i class="fa-solid fa-arrow-up-right-from-square"></i></button><button type="button" class="bl-note-btn" data-act="folder-break" title="폴더 풀기 (메모는 그대로)" aria-label="폴더 풀기"><i class="fa-solid fa-folder-minus"></i></button>`;
        bar.querySelector('input').addEventListener('input', event => { const f = folderById(root.dataset.folder); if (!f) return; f.name = event.target.value; save(); syncFolderNames(f.id); });
        host.before(bar);
    }
    bar.hidden = !fid;
    const input = bar.querySelector('input'); if (fid && document.activeElement !== input) input.value = folderById(fid)?.name || '';
}
function syncFolderNames(fid) { document.querySelectorAll(`.bl-note-folder[data-folder="${fid}"]`).forEach(el => el._sync?.()); stickies.get('f:' + fid)?._sync?.(); }

/** 카드 목록을 그린다 — 큰 창(.bl-notes-dialog)과 입력창 위 미니 목록(.bl-notes-mini)이 같은 카드 · 같은 처리 */
function renderList(root) {
    if (!root) return;
    if (root.dataset.folder && !folderById(root.dataset.folder)) delete root.dataset.folder;
    const fid = root.dataset.folder || '';
    const items = displayItems(fid), host = root.querySelector('.bl-notes-list');
    // 1.2.x: 목록이 바뀔 때마다 카드 300장을 새로 만들던 것 → 이미 있는 카드는 다시 쓰고(모양이 같을 때), 바뀐 자리만 옮긴다
    const old = new Map(); for (const el of host.children) old.set(el.dataset.id ? 'n:' + el.dataset.id : 'f:' + el.dataset.folder, el);
    const els = items.map((x, i) => {
        if (x.folder) { const el = old.get('f:' + x.folder); if (el) { old.delete('f:' + x.folder); el._sync?.(); return el; } return folderCard(x.folder); }
        const n = x.note, sig = cardSig(n, !!fid), el = old.get('n:' + n.id);
        if (el && el._sig === sig) {
            old.delete('n:' + n.id);
            if (el._upd !== n.updated) el._sync?.();
            const up = el.querySelector('[data-act="up"]'), down = el.querySelector('[data-act="down"]');
            if (up) up.disabled = i === 0; if (down) down.disabled = i === items.length - 1;
            return el;
        }
        return card(n, i, items.length, !!fid);
    });
    old.forEach(el => el.remove());
    els.forEach((el, i) => { if (host.children[i] !== el) host.insertBefore(el, host.children[i] || null); });
    host.classList.toggle('is-sorted', (look().sort || 'manual') !== 'manual');
    host.classList.toggle('is-folder', !!fid);
    syncFolderBar(root, fid);
    root.dataset.key = listKey(root);
    if (!host._drag) { host._drag = true; enableDrag(root, host); }
    applyFind(root);
    const empty = root.querySelector('.bl-notes-empty'); if (empty) empty.hidden = items.length > 0;
    const count = root.querySelector('.bl-notes-count'); const total = visibleNotes().length; if (count) count.textContent = total ? String(total) : '';
}
function render() { renderList(dialog); }
const listKey = root => `${look().sort || 'manual'}:${root?.dataset.folder || ''}:` + orderedNotes().map(n => n.id + (n.folder ? '@' + n.folder : '')).join('|');

/** 찾기: 제목 · 내용에 글이 든 카드만 (대소문자 무시). '#태그' 면 그 태그(하위 태그 포함)가 든 메모만. 폴더는 맞는 메모 줄만 남긴다 */
function applyFind(root) {
    if (!root) return;
    const raw = (root.querySelector('.bl-notes-find input')?.value || '').trim(), q = raw.toLowerCase();
    const tag = /^#[^\s#]+$/.test(raw) ? tagName(raw.slice(1)) : ''; // 5.3.5: 색 값(#fff)은 태그가 아니라 글로 찾음 — tagsOf 와 같은 규칙
    const all = notes();
    const hitNote = note => !!note && (!q || (tag ? tagHit(tagsOf(note.body), tag) : `${note.title}\n${note.body}`.toLowerCase().includes(q)));
    let shown = 0;
    root.querySelectorAll('.bl-notes-list > .bl-note').forEach(el => {
        let hit;
        if (el.dataset.folder) { hit = false; el.querySelectorAll('.bl-folder-row').forEach(row => { const h = hitNote(all.find(n => n.id === row.dataset.note)); row.hidden = !h; hit ||= h; }); }
        else hit = hitNote(all.find(n => n.id === el.dataset.id));
        el.hidden = !hit; if (hit) shown++;
    });
    const none = root.querySelector('.bl-notes-nohit'); if (none) none.hidden = !q || shown > 0;
    root.querySelector('[data-act="tags"]')?.classList.toggle('is-on', !!tag);
}
function setFind(root, q) {
    const row = root.querySelector('.bl-notes-find'); if (!row) return;
    row.hidden = !q; row.querySelector('input').value = q; applyFind(root);
}
/** 모든 목록 · 메모 줄을 새 순서로 */
function rerenderAll() {
    if (dialog) render();
    const mini = document.querySelector('#bl-notes-bar .bl-notes-mini'); if (mini && !mini.hidden) renderList(mini);
    renderBar();
    stickies.forEach((el, key) => { if (key.startsWith('f:')) el._sync?.(); });
}

/** 창을 닫거나 다시 그리기 전에 타이핑 중이던 값을 바로 저장 */
function flush(root = dialog) {
    root?.querySelectorAll('.bl-note[data-id]').forEach(el => {
        const t = el.querySelector('.bl-note-title'), b = el.querySelector('.bl-note-body'); if (!t || !b) return;
        const id = el.dataset.id, note = notes().find(n => n.id === id);
        if (note && (note.title !== t.value || note.body !== b.value)) updateNote(id, { title: t.value, body: b.value });
    });
}

// ── 태그 · 연결 · 그래프로 옮겨 다니기 ──────────────────────
/** 목록(큰 창 · 작은 목록) 하나를 고른다: 누른 자리의 목록 → 열린 큰 창 → 입력창 위 작은 목록 → 큰 창 새로 */
function listRootFor(from) {
    const root = from?.closest?.('.bl-notes-mini, .bl-notes-dialog');
    if (root?.querySelector('.bl-notes-list')) return root;
    if (dialog?.open) return dialog;
    const bar = document.getElementById(BAR_ID);
    if (bar) { if (!miniOpen) { miniOpen = true; peekId = null; renderBar(); } return bar.querySelector('.bl-notes-mini'); }
    openPanel(); return dialog;
}
function flashCard(el) { if (!el) return; el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 1400); }
/** 그 메모를 보여 준다 — 쪽지에서 누르면 옆 쪽지로(PC), 펼침에서 누르면 그 메모 펼침, 아니면 목록에서 찾아 반짝 */
function revealNote(id, from) {
    const note = notes().find(n => n.id === id); if (!note) return;
    if (!visibleNotes().some(n => n.id === id)) { globalThis.toastr?.info(`${note.owner?.name || '다른'} 채팅에 귀속된 메모예요${note.owner?.chat ? ` (${note.owner.chat})` : ''}.`, TITLE); return; }
    if (from?.closest?.('.bl-sticky') && isWide()) { openSticky(id); return; }
    if (from?.closest?.('.bl-notes-peek')) { peekId = id; miniOpen = false; renderBar(); return; }
    const root = listRootFor(from); if (!root) return;
    flush(root);
    const want = note.folder && folderById(note.folder) ? note.folder : '';
    if (want) root.dataset.folder = want; else delete root.dataset.folder;
    const find = root.querySelector('.bl-notes-find'); if (find && !find.hidden) { find.querySelector('input').value = ''; find.hidden = true; }
    renderList(root);
    flashCard(root.querySelector(`.bl-notes-list > .bl-note[data-id="${id}"]`));
}
/** [[제목]] 을 누름 — 없는 제목이면 그 제목으로 새 메모 */
function openLinked(title, from) {
    let note = findByTitle(title);
    if (!note) { note = addNote(String(title).trim(), '', 0); if (!note) return; globalThis.toastr?.success(`'${String(title).trim()}' 메모를 새로 만들었어요.`, TITLE, { timeOut: 2000 }); rerenderAll(); }
    revealNote(note.id, from);
}
/** #태그 를 누름 — 그 목록을 태그로 거른다 (쪽지 · 펼침이면 작은 목록 · 큰 창을 열어서) */
function showTag(tag, from) {
    let root = from?.closest?.('.bl-notes-mini, .bl-notes-dialog');
    if (!root?.querySelector('.bl-notes-list')) root = listRootFor(null);
    if (!root) return;
    if (root.dataset.folder) { delete root.dataset.folder; renderList(root); }
    setFind(root, '#' + tag);
}
document.addEventListener('click', event => {
    const el = event.target.closest?.('.bl-note-tag, .bl-note-link'); if (!el || !el.closest('.bl-notes-view')) return;
    event.preventDefault(); event.stopPropagation();
    if (el.classList.contains('bl-note-tag')) showTag(el.dataset.tag, el); else openLinked(el.dataset.noteLink, el);
}, true);
// 폴더 칸 · 폴더 줄은 div(끌기가 되게) — 키보드로도 누르기
document.addEventListener('keydown', event => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('.bl-folder-row, .bl-folder-head')) { event.preventDefault(); event.target.click(); } });
function graphData(withTags) {
    const list = visibleNotes(), byTitle = new Map();
    for (const n of list) { const k = n.title.trim().toLowerCase(); if (k && !byTitle.has(k)) byTitle.set(k, n); }
    const nodes = list.map(n => ({ id: n.id, label: label(n), color: n.color || '', kind: 'note' }));
    const edges = [], seen = new Set();
    const link = (a, b) => { const k = a < b ? `${a}>${b}` : `${b}>${a}`; if (a !== b && !seen.has(k)) { seen.add(k); edges.push([a, b]); } };
    for (const n of list) for (const l of linksOf(n.body)) { const t = byTitle.get(l.title.toLowerCase()); if (t) link(n.id, t.id); }
    if (withTags) {
        const tags = new Set();
        for (const n of list) for (const t of tagsOf(n.body)) { tags.add(t); link(n.id, 'tag:' + t); }
        for (const t of tags) nodes.push({ id: 'tag:' + t, label: '#' + t, kind: 'tag', tag: t });
    }
    return { nodes, edges };
}
async function openGraphFor(root) {
    const { openGraph } = await import('./graph.js');
    const anchor = () => (root?.isConnected ? root.querySelector('.bl-notes-list') : null);
    openGraph({ build: graphData, onPick: id => revealNote(id, anchor()), onTag: tag => showTag(tag, anchor()) });
}
function tagPopHtml(root) {
    const tags = allTags(), cur = (root.querySelector('.bl-notes-find input')?.value || '').trim();
    if (!tags.length) return '<p class="bl-notes-tagnone">내용에 <b>#태그</b> 를 적으면 여기 모여요.</p>';
    return tags.map(([t, n]) => `<button type="button" class="bl-note-btn bl-notes-sortbtn${cur === '#' + t ? ' on' : ''}" data-act="tag-set" data-tag="${escA(t)}" title="#${escA(t)} 메모만 보기" aria-label="#${escA(t)} 메모만 보기"><i class="fa-solid fa-hashtag"></i><span>${escA(t)}</span><small>${n}</small></button>`).join('');
}

/** 카드 도구 처리 (큰 창 · 미니 목록 공용). close 는 호출한 쪽이 처리 */
function handleAct(act, id, root, rerender, button = null) {
    flush(root);
    if (act === 'look') { openLook(); return; }
    if (act === 'guide') { import('./guide.js').then(m => m.showNotesGuide()); return; }
    if (act === 'graph') { openGraphFor(root); return; }
    if (act === 'find') { const row = root.querySelector('.bl-notes-find'); if (!row) return; row.hidden = !row.hidden; const input = row.querySelector('input'); if (row.hidden) { input.value = ''; applyFind(root); } else input.focus({ preventScroll: true }); return; }
    if (act === 'sort') { const pop = root.querySelector('.bl-notes-sortpop'); if (pop) { root.querySelector('.bl-notes-tagpop')?.setAttribute('hidden', ''); pop.hidden = !pop.hidden; pop.querySelectorAll('[data-sort]').forEach(b => b.classList.toggle('on', b.dataset.sort === (look().sort || 'manual'))); placePop(pop); } return; }
    if (act === 'sort-set') { const mode = id; store().look.sort = mode; save(); root.querySelector('.bl-notes-sortpop').hidden = true; rerenderAll(); return; }
    if (act === 'tags') { const pop = root.querySelector('.bl-notes-tagpop'); if (!pop) return; root.querySelector('.bl-notes-sortpop')?.setAttribute('hidden', ''); if (pop.hidden) pop.innerHTML = tagPopHtml(root); pop.hidden = !pop.hidden; placePop(pop); return; }
    if (act === 'tag-set') {
        root.querySelector('.bl-notes-tagpop').hidden = true;
        const cur = (root.querySelector('.bl-notes-find input')?.value || '').trim();
        if (root.dataset.folder) { delete root.dataset.folder; rerender(); }
        setFind(root, cur === '#' + id ? '' : '#' + id); return;
    }
    if (act === 'folder-back') { delete root.dataset.folder; rerender(); return; }
    if (act === 'folder-open') {
        const fid = button?.closest('[data-folder]')?.dataset.folder; if (!fid || !folderById(fid)) return;
        root.dataset.folder = fid; rerender();
        if (id) flashCard(root.querySelector(`.bl-notes-list > .bl-note[data-id="${id}"]`));
        return;
    }
    if (act === 'folder-break') { const fid = root.dataset.folder; if (!fid) return; breakFolder(fid); delete root.dataset.folder; rerenderAll(); return; }
    if (act === 'folder-pop') {
        const fid = root.dataset.folder; if (!fid) return;
        if (!isWide()) { globalThis.toastr?.info('화면에 꺼내 두기는 넓은 화면(PC)에서만 돼요.', TITLE); return; }
        delete root.dataset.folder; if (root === dialog) dialog.close(); else { miniOpen = false; renderBar(); }
        openSticky('f:' + fid); return;
    }
    if (act === 'add') {
        const note = addNote('', '', 0); if (!note) return;
        if (root.dataset.folder) joinFolder({ folder: root.dataset.folder }, [note.id]);
        rerender(); root.querySelector(`.bl-note[data-id="${note.id}"] .bl-note-title`)?.focus(); return;
    }
    if (!id) return;
    if (act === 'unfolder') { leaveFolder(id); if (!folderById(root.dataset.folder)) delete root.dataset.folder; rerenderAll(); return; }
    if (act === 'up' || act === 'down') { moveNote(id, act === 'up' ? -1 : 1); rerender(); root.querySelector(`.bl-note[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' }); }
    else if (act === 'copy') { const made = duplicateNote(id); rerender(); if (made) root.querySelector(`.bl-note[data-id="${made.id}"] .bl-note-title`)?.focus(); }
    else if (act === 'pop') { if (root === dialog) dialog.close(); else { miniOpen = false; renderBar(); } openSticky(id); }
    else if (act === 'del') {
        const note = notes().find(n => n.id === id);
        if (note && (note.title || note.body) && !confirm(`"${note.title || note.body.slice(0, 20) || '메모'}" 를 지울까요?`)) return;
        closeSticky(id); removeNote(id); tidyFolders(); if (!folderById(root.dataset.folder)) delete root.dataset.folder; rerenderAll();
    }
}
/** 목록 머리 버튼 누름 → handleAct 에 넘길 값 (정렬 방식 · 태그 · 폴더 줄의 메모 · 카드의 메모) */
const actArg = button => button.dataset.sort || button.dataset.tag || button.dataset.note || button.closest('.bl-note[data-id]')?.dataset.id;
const HEAD_TOOLS = `<button type="button" class="bl-note-btn" data-act="find" title="메모에서 찾기" aria-label="메모에서 찾기"><i class="fa-solid fa-magnifying-glass"></i></button><span class="bl-notes-find" hidden><input type="search" placeholder="찾기 · #태그" spellcheck="false" aria-label="메모에서 찾기"></span>`
    + `<span class="bl-note-fmt-h bl-notes-tagwrap"><button type="button" class="bl-note-btn" data-act="tags" title="태그 모아보기" aria-label="태그 모아보기"><i class="fa-solid fa-hashtag"></i></button><span class="bl-note-fmt-hs bl-notes-sortpop bl-notes-tagpop" hidden></span></span>`
    + `<span class="bl-note-fmt-h bl-notes-sortwrap"><button type="button" class="bl-note-btn" data-act="sort" title="정렬" aria-label="정렬"><i class="fa-solid fa-arrow-down-wide-short"></i></button><span class="bl-note-fmt-hs bl-notes-sortpop" hidden>${SORTS.map(([key, name, icon]) => `<button type="button" class="bl-note-btn bl-notes-sortbtn" data-act="sort-set" data-sort="${key}" title="${name}" aria-label="${name}"><i class="fa-solid ${icon}"></i><span>${name}</span></button>`).join('')}</span></span>`
    + `<button type="button" class="bl-note-btn" data-act="graph" title="연결 보기 (메모 · 태그 그래프)" aria-label="연결 보기"><i class="fa-solid fa-share-nodes"></i></button>`
    + `<button type="button" class="bl-note-btn" data-act="look" title="메모 글꼴 · 크기 · 한 줄 장수 설정" aria-label="메모 설정"><i class="fa-solid fa-gear"></i></button><button type="button" class="bl-note-btn bl-note-add" data-act="add" title="새 메모" aria-label="새 메모"><i class="fa-solid fa-plus"></i></button>`;
const FIND_ROW = `<p class="bl-notes-nohit" hidden>찾는 글이 든 메모가 없어요.</p>`;
const EMPTY_ROW = `<p class="bl-notes-empty">+ 를 눌러 첫 메모를 적어 보세요. <button type="button" class="bl-notes-guidelink" data-act="guide">쓰는 법 보기</button></p>`;

export function openPanel() {
    if (dialog?.open) return;
    const previous = document.activeElement;
    dialog = document.createElement('dialog');
    dialog.className = 'bl-notes-dialog'; dialog.setAttribute('aria-label', TITLE);
    dialog.innerHTML = `<header><b><i class="fa-solid fa-note-sticky" aria-hidden="true"></i> ${TITLE} <small class="bl-notes-count"></small><button type="button" class="bl-notes-ver" data-act="guide" title="메모 사용방법" aria-label="메모 사용방법">v${VERSION}</button></b><div class="bl-notes-head-tools">${HEAD_TOOLS}<button type="button" class="bl-note-btn" data-act="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></div></header>
${FIND_ROW}${EMPTY_ROW}
<div class="bl-notes-list"></div>`;
    document.body.append(dialog);
    dialog.addEventListener('click', event => {
        const button = event.target.closest('[data-act]'); if (!button) return;
        const act = button.dataset.act;
        if (act === 'close') { dialog.close(); return; }
        handleAct(act, actArg(button), dialog, render, button);
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
        // 1.2.0: 이름 · 값 · 같게를 한 줄에, 슬라이더는 그 아래 넓게 (숫자 칸은 상자 없이 글자처럼)
        return `<div class="bl-look-item" data-param="${key}">
<div class="bl-look-head"><span class="bl-look-name">${name}</span><span class="bl-look-val"><input type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" value="${value}" data-look-key="${key}" aria-label="${name} 값" ${same ? 'disabled' : ''}><span class="bl-look-unit">${unit}</span></span><label class="bl-look-same" title="채팅 본문 설정 따라가기"><input type="checkbox" data-look-same="${key}" ${same ? 'checked' : ''}><span>같게</span></label></div>
<div class="bl-look-ctl"><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-look-range="${key}" aria-label="${name}" ${same ? 'disabled' : ''}></div>
</div>`; }).join('');
    lookDialog = document.createElement('dialog');
    lookDialog.className = 'bl-notes-dialog bl-notes-look'; lookDialog.setAttribute('aria-label', '메모 설정');
    lookDialog.innerHTML = `<header><b><i class="fa-solid fa-gear" aria-hidden="true"></i> 메모 설정</b><div class="bl-notes-head-tools"><button type="button" class="bl-note-btn" data-look="reset" title="기본값으로" aria-label="기본값으로"><i class="fa-solid fa-rotate-left"></i></button><button type="button" class="bl-note-btn" data-look="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></div></header>
<section class="bl-look-sec bl-look-top"><div class="bl-notes-view salty-preview bl-look-sample"></div>
<p class="bl-look-note">메모 안 글에만 쓰여요. '같게'를 켜 두면 채팅 본문 설정을 따라가요.</p></section>
<section class="bl-look-sec"><h4 class="bl-look-title">글자</h4>
<div class="bl-look-item" data-param="font"><div class="bl-look-head"><span>글꼴</span></div><div class="bl-look-ctl"><button type="button" class="bl-look-fontbtn" data-look="fonts" title="글꼴 고르기"><span class="bl-look-fontname">${esc(fontLabel(findFont(l.font)))}</span><i class="fa-solid fa-chevron-down"></i></button></div>
<div class="bl-look-fonts" hidden><div class="bl-look-fonttags" role="tablist" aria-label="글꼴 묶음"></div><input type="search" class="bl-look-fontfind" placeholder="찾기" spellcheck="false"><div class="bl-look-fontlist"></div></div></div>
<div class="bl-look-grid">${rows}</div></section>
<section class="bl-look-sec"><h4 class="bl-look-title">한 줄에 메모</h4>
<div class="bl-look-item" data-param="cols"><div class="bl-look-seg" role="radiogroup" aria-label="한 줄에 메모">${[['auto', '자동'], ['1', '1장'], ['2', '2장'], ['3', '3장']].map(([v, n]) => `<button type="button" class="bl-look-segbtn${String(l.cols || 'auto') === v ? ' on' : ''}" data-look-cols="${v}" role="radio" aria-checked="${String(l.cols || 'auto') === v}">${n}</button>`).join('')}</div><p class="bl-look-hint">자동은 PC 한 줄 3장 · 폰 1장이에요.</p></div></section>
<section class="bl-look-sec"><h4 class="bl-look-title">서식 버튼 <small>켜고 끄기 · 끌어서 순서</small></h4>
<div class="bl-look-item" data-param="fmt"><div class="bl-look-fmtlist"></div></div></section>`;
    document.body.append(lookDialog);
    const sample = lookDialog.querySelector('.bl-look-sample');
    renderView(sample, '메모 안 글은 이렇게 보여요. *속마음*과 "대사"도 채팅과 같은 색이에요.');
    // 서식 버튼 목록: 켜기 · 끄기(스위치), 손잡이를 잡거나 줄을 꾹 눌러 끌면 순서가 바뀐다 → 열려 있는 서식 줄에 바로 반영
    const fmtHost = lookDialog.querySelector('.bl-look-fmtlist');
    const drawFmtList = () => { fmtHost.innerHTML = fmtButtons().map(({ k, on }) => `<div class="bl-look-fmtrow${on ? '' : ' is-off'}" data-k="${k}"><span class="bl-look-grip" title="끌어서 순서 바꾸기" aria-hidden="true"><i class="fa-solid fa-grip-vertical"></i></span><i class="fa-solid ${FMT_ALL[k][0]} bl-look-fmticon" aria-hidden="true"></i><span class="bl-look-fmtname" title="${FMT_ALL[k][1]}">${FMT_SHORT[k] || FMT_ALL[k][1]}</span><label class="bl-look-switch" title="${on ? '끄기' : '켜기'}"><input type="checkbox" data-fmt-on="${k}" ${on ? 'checked' : ''} aria-label="${FMT_ALL[k][1]}"><span></span></label></div>`).join(''); };
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
        if (act === 'reset') { store().look = { ...LOOK_DEFAULT, fmtOpen: look().fmtOpen, sort: look().sort, ...(look().customColors ? { customColors: look().customColors } : {}) }; apply(); rebuildFmtBars(); lookDialog.close(); openLook(); } // 내 색(메모지 색 고르기)은 모양이 아니라 남긴다
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
    if (!el.isConnected || stickies.get(id) !== el) return; // 닫힌 쪽지(목록에 다시 넣음)는 자리를 다시 적지 않는다
    const r = el.getBoundingClientRect(), next = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }, old = stickyStore()[id];
    if (old && old.x === next.x && old.y === next.y && old.w === next.w && old.h === next.h) return; // 쪽지 안을 누르기만 했으면(자리 · 크기 그대로) 저장하지 않는다
    stickyStore()[id] = next;
    saveSettingsDebounced(); // 자리 · 크기는 메모 줄과 무관 — save() 의 메모 줄 다시 그리기는 건너뜀
}
function raiseSticky(el) { stickies.forEach(other => other.classList.toggle('is-top', other === el)); }

// ── 꾹 눌러 끌기 (버튼 없이 손으로) ─────────────────────────
//    목록 안에서 끌면 칸 자리가 바뀌고(놓으면 '직접 정한 순'으로 저장), PC 에서 목록 밖에 놓으면 그 자리에 스티커로 뜬다.
//    다른 메모 한가운데에 잠깐 머물면 테두리가 빛나고, 놓으면 두 메모가 폴더로 (폴더 칸에 놓으면 그 폴더에)
const PRESS_MS = 380;
const MERGE_MS = 280;
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
    host.addEventListener('contextmenu', e => { if (dragging || e.target.closest('.bl-note-view, .bl-note-folder')) e.preventDefault(); });
    // 놓은 직후의 click(보기 → 편집 전환 · 폴더 열기)은 먹는다
    // (작은 목록은 열 때마다 목록 칸을 새로 만든다 — 그대로 남는 root 에는 한 번만)
    if (!root._dragClick) { root._dragClick = true; root.addEventListener('click', e => { if (Date.now() - dragEndedAt < 350) { e.preventDefault(); e.stopPropagation(); } }, true); }
}
const cardIds = el => (el.dataset.id ? [el.dataset.id] : (el.dataset.ids || '').split('|').filter(Boolean));
function startDrag(root, host, cardEl, sx, sy) {
    const isFolder = !cardEl.dataset.id, id = cardEl.dataset.id || 'f:' + cardEl.dataset.folder;
    const r = cardEl.getBoundingClientRect(), dx = sx - r.left, dy = sy - r.top, wide = isWide();
    const ghost = cardEl.cloneNode(true);
    ghost.classList.add('bl-note-ghost'); ghost.removeAttribute('data-id'); ghost.removeAttribute('data-folder'); ghost.setAttribute('aria-hidden', 'true');
    Object.assign(ghost.style, { width: `${r.width}px`, height: `${r.height}px`, left: `${r.left}px`, top: `${r.top}px` });
    (root.closest('dialog') || document.body).append(ghost); // 모달 창 안이면 창 안에 (맨 위 층)
    cardEl.classList.add('is-dragging'); document.documentElement.classList.add('bl-notes-dragging');
    dragging = { id };
    const orderBefore = [...host.children].flatMap(cardIds).join('|'); // 놓았을 때 칸 순서가 그대로면(꾹 누르기만) 저장 · 정렬 방식을 건드리지 않는다
    let lx = sx, ly = sy, outside = false, merge = null, mergeCand = null, mergeTimer = 0;
    const canMerge = !isFolder && !root.dataset.folder; // 폴더 밖 목록에서 메모를 끌 때만
    const clearMerge = () => { clearTimeout(mergeTimer); mergeTimer = 0; mergeCand = null; merge?.classList.remove('is-merge'); merge = null; ghost.classList.remove('is-merge'); };
    const move = e => {
        lx = e.clientX; ly = e.clientY;
        ghost.style.left = `${lx - dx}px`; ghost.style.top = `${ly - dy}px`;
        const b = root.getBoundingClientRect();
        outside = wide && (lx < b.left || lx > b.right || ly < b.top || ly > b.bottom);
        ghost.classList.toggle('is-pop', outside); cardEl.classList.toggle('is-leaving', outside);
        if (outside) { clearMerge(); return; }
        const over = document.elementsFromPoint(lx, ly).map(el => el.closest?.('.bl-note')).find(el => el && el !== ghost && host.contains(el));
        if (!over || over === cardEl || !host.contains(over)) { if (over !== mergeCand) clearMerge(); return; }
        const or = over.getBoundingClientRect(), fx = (lx - or.left) / or.width, fy = (ly - or.top) / or.height;
        if (canMerge && fx > 0.2 && fx < 0.8 && fy > 0.22 && fy < 0.78) { // 한가운데: 잠깐 머물면 합치기
            if (mergeCand !== over) { clearMerge(); mergeCand = over; mergeTimer = setTimeout(() => { merge = over; over.classList.add('is-merge'); ghost.classList.add('is-merge'); navigator.vibrate?.(8); }, MERGE_MS); }
            return;
        }
        clearMerge();
        const cols = getComputedStyle(host).gridTemplateColumns.split(' ').filter(Boolean).length;
        const after = cols > 1 ? (Math.abs(ly - (or.top + or.height / 2)) < or.height / 2 ? lx > or.left + or.width / 2 : ly > or.top + or.height / 2) : ly > or.top + or.height / 2;
        if (after) { if (over.nextElementSibling !== cardEl) over.after(cardEl); } else if (over.previousElementSibling !== cardEl) over.before(cardEl);
    };
    const end = () => {
        document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerup', end, true); document.removeEventListener('pointercancel', end, true);
        const target = merge; clearTimeout(mergeTimer); merge?.classList.remove('is-merge');
        ghost.remove(); cardEl.classList.remove('is-dragging', 'is-leaving'); document.documentElement.classList.remove('bl-notes-dragging');
        dragging = null; dragEndedAt = Date.now();
        if (target) { // 폴더로 합치기
            flush(root);
            joinFolder(target.dataset.folder ? { folder: target.dataset.folder } : { id: target.dataset.id }, [id]);
            rerenderAll(); flashCard([...host.children].find(el => el.dataset.folder && (el.dataset.ids || '').split('|').includes(id)));
            return;
        }
        if (outside) { // PC: 그 자리에 스티커로
            flush(root);
            const w = isFolder ? 230 : 260, h = 220;
            stickyStore()[id] = { x: Math.round(lx - 40), y: Math.round(ly - 16), w, h }; save(); // 놓은 곳이 쪽지 머리띠 왼쪽 위쯤
            const old = stickies.get(id); if (old) { old.remove(); stickies.delete(id); }
            if (root === dialog) dialog.close(); else { miniOpen = false; renderBar(); }
            openSticky(id);
            return;
        }
        const ids = [...host.children].flatMap(cardIds);
        if (ids.join('|') === orderBefore) return;
        applyOrder(ids);
        rerenderAll();
    };
    document.addEventListener('pointermove', move, true); document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true);
    navigator.vibrate?.(12);
}
/** 보이는 순서를 저장 순서로 (정렬 방식은 '직접 정한 순'으로) — 안 보이는 메모(다른 채팅)는 제자리, 보이는 메모는 첫 자리부터 새 순서로 */
function applyOrder(ids) { placeVisible(ids); store().look.sort = 'manual'; save(); }
/** ids 순서대로 저장 순서를 고친다 (안 보이는 메모는 제자리) — 배열은 제자리에서 (store() 의 한 배열 규칙) */
function placeVisible(ids) {
    const list = notes(), set = new Set(ids), byId = new Map(list.map(n => [n.id, n]));
    const first = list.findIndex(n => set.has(n.id));
    const rest = list.filter(n => !set.has(n.id));
    rest.splice(Math.max(0, first), 0, ...ids.map(id => byId.get(id)).filter(Boolean));
    list.splice(0, list.length, ...rest);
}

// ── 쪽지 머리띠 끌기: 옮기기 · 다른 쪽지에 놓으면 폴더 · 메모 줄(작은 목록)에 놓으면 다시 목록으로 ──
function stickyTargetAt(x, y, self) {
    for (const hit of document.elementsFromPoint(x, y)) {
        if (self.contains(hit)) continue;
        const other = hit.closest?.('.bl-sticky'); if (other) return other;
        const cardEl = hit.closest?.('.bl-notes-mini .bl-notes-list > .bl-note');
        if (cardEl && !cardEl.closest('.bl-notes-mini').dataset.folder && !(cardEl.dataset.id && self.dataset.id === cardEl.dataset.id)) return cardEl;
        const bar = hit.closest?.('#' + BAR_ID); if (bar) return bar;
    }
    return null;
}
function stickyMove(el, id) {
    const head = el.querySelector('.bl-sticky-head');
    head.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('input, button')) return;
        const r = el.getBoundingClientRect(), dx = event.clientX - r.left, dy = event.clientY - r.top;
        head.setPointerCapture(event.pointerId); el.classList.add('is-dragging');
        let drop = null;
        const setDrop = next => { if (drop === next) return; drop?.classList.remove('is-drop'); drop = next; drop?.classList.add('is-drop'); el.classList.toggle('is-dropping', !!drop); };
        const move = e => {
            el.style.left = clamp(e.clientX - dx, 0, innerWidth - r.width) + 'px'; el.style.top = clamp(e.clientY - dy, 0, innerHeight - r.height) + 'px';
            setDrop(stickyTargetAt(e.clientX, e.clientY, el));
        };
        const up = () => {
            head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up);
            el.classList.remove('is-dragging'); const target = drop; setDrop(null);
            if (target) dropSticky(id, target); else rememberSticky(id, el);
        };
        head.addEventListener('pointermove', move); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
        event.preventDefault();
    });
}
function dropSticky(id, target) {
    stickies.get(id)?._flush?.();
    const isFolder = id.startsWith('f:'), moving = isFolder ? notes().filter(n => n.folder === id.slice(2)).map(n => n.id) : [id];
    if (target.id === BAR_ID) { closeSticky(id); rerenderAll(); return; } // 다시 목록으로
    if (target.classList.contains('bl-sticky')) { // 쪽지끼리 → 폴더 쪽지 (놓인 쪽지 자리)
        const tid = target.dataset.id, r = target.getBoundingClientRect();
        const fid = tid.startsWith('f:') ? joinFolder({ folder: tid.slice(2) }, moving) : joinFolder({ id: tid }, moving);
        if (!fid) return;
        closeSticky(id); if (!tid.startsWith('f:')) closeSticky(tid);
        const key = 'f:' + fid;
        if (!stickyStore()[key]) { stickyStore()[key] = { x: Math.round(r.left), y: Math.round(r.top), w: 230, h: 0 }; save(); }
        openSticky(key)?._sync?.(); rerenderAll(); return;
    }
    // 작은 목록의 메모 · 폴더 위 → 그 메모와 폴더로 (쪽지는 목록으로 들어간다)
    const fid = target.dataset.folder ? joinFolder({ folder: target.dataset.folder }, moving) : joinFolder({ id: target.dataset.id }, moving);
    if (!fid) return;
    closeSticky(id); rerenderAll();
}

export function openSticky(id) {
    if (String(id).startsWith('f:')) return openFolderSticky(String(id).slice(2));
    const note = notes().find(n => n.id === id);
    if (!note) return null;
    if (stickies.has(id)) { const el = stickies.get(id); raiseSticky(el); return el; }
    const el = document.createElement('section');
    el.className = 'bl-sticky'; el.dataset.id = id; paintNote(el, note.color, note.ink); el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', TITLE);
    el.innerHTML = `<header class="bl-sticky-head"><input class="bl-sticky-title" type="text" maxlength="120" placeholder="제목" spellcheck="false">${colorButton(id)}<button type="button" class="bl-note-btn" data-sticky="list" title="메모 목록" aria-label="메모 목록"><i class="fa-solid fa-bars"></i></button><button type="button" class="bl-note-btn" data-sticky="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></header><div class="bl-sticky-scroll"><div class="bl-sticky-view bl-notes-view salty-preview" hidden></div><textarea class="bl-sticky-body" placeholder="내용" spellcheck="false"></textarea></div>`;
    const title = el.querySelector('.bl-sticky-title'), body = el.querySelector('.bl-sticky-body'), view = el.querySelector('.bl-sticky-view');
    title.value = note.title; body.value = note.body; body.dataset.noteId = id;
    let timer = 0;
    const current = () => notes().find(n => n.id === id) ?? note;
    const commit = (value, now) => { clearTimeout(timer); const run = () => { const n = current(); if (n.title !== title.value || n.body !== body.value) updateNote(id, { title: title.value, body: body.value }); }; now ? run() : (timer = setTimeout(run, 350)); };
    title.addEventListener('input', () => commit(null, false));
    let titleBefore = null;
    title.addEventListener('focus', () => { titleBefore = current().title; });
    title.addEventListener('blur', () => { commit(null, true); if (titleBefore !== null && titleBefore !== title.value) renameLinks(titleBefore, title.value, id); titleBefore = null; });
    title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); field.show(true); body.focus(); } });
    const field = bodyField(view, body, () => body.value, commit, fmt => title.after(fmt)); // 서식 줄은 머리띠 안(제목 옆)
    el._sync = () => { const n = current(); if (document.activeElement !== title) title.value = n.title; if (document.activeElement !== body) body.value = n.body; field.refresh(); };
    el._flush = () => commit(null, true);
    el.querySelector('[data-sticky="close"]').onclick = () => { commit(null, true); closeSticky(id); };
    el.querySelector('[data-sticky="list"]').onclick = () => openPanel();
    el.addEventListener('pointerdown', () => raiseSticky(el), true);
    stickyMove(el, id);
    // 크기는 CSS resize — 끝나면(포인터를 뗄 때) 기억
    el.addEventListener('pointerup', () => rememberSticky(id, el));
    new ResizeObserver(() => { if (!el.isConnected) return; clearTimeout(el._rs); el._rs = setTimeout(() => rememberSticky(id, el), 400); }).observe(el);
    placeSticky(el, stickyStore()[id] || {});
    document.body.append(el); stickies.set(id, el); raiseSticky(el); rememberSticky(id, el);
    return el;
}
/** 폴더 쪽지: 작게, 메모마다 제목 + 첫 줄 한 줄 (좁으면 제목만). 줄을 누르면 그 메모가 옆에 쪽지로 */
function openFolderSticky(fid) {
    const key = 'f:' + fid;
    if (!folderById(fid)) { closeSticky(key); return null; }
    if (stickies.has(key)) { const el = stickies.get(key); el._sync?.(); raiseSticky(el); return el; }
    const el = document.createElement('section');
    el.className = 'bl-sticky bl-sticky-folder'; el.dataset.id = key; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '메모 폴더');
    el.innerHTML = `<header class="bl-sticky-head"><i class="fa-solid fa-folder bl-sticky-foldericon" aria-hidden="true"></i><input class="bl-sticky-title" type="text" maxlength="40" placeholder="폴더" spellcheck="false" aria-label="폴더 이름"><button type="button" class="bl-note-btn" data-sticky="list" title="메모 목록" aria-label="메모 목록"><i class="fa-solid fa-bars"></i></button><button type="button" class="bl-note-btn" data-sticky="close" title="닫기" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button></header><div class="bl-sticky-scroll"><div class="bl-folder-rows"></div></div>`;
    const name = el.querySelector('.bl-sticky-title'), rows = el.querySelector('.bl-folder-rows');
    name.addEventListener('input', () => { const f = folderById(fid); if (!f) return; f.name = name.value; save(); document.querySelectorAll(`.bl-note-folder[data-folder="${fid}"]`).forEach(c => c._sync?.()); document.querySelectorAll('.bl-folder-bar input').forEach(i => { if (i.closest('.bl-notes-mini, .bl-notes-dialog')?.dataset.folder === fid && document.activeElement !== i) i.value = f.name; }); });
    el._sync = () => {
        const f = folderById(fid); if (!f) { closeSticky(key); return; }
        const list = orderedNotes().filter(n => n.folder === fid);
        el.dataset.ids = list.map(n => n.id).join('|'); rows.innerHTML = list.map(folderRow).join('');
        if (document.activeElement !== name) name.value = f.name || '';
    };
    el._sync();
    rows.addEventListener('click', event => {
        const row = event.target.closest('[data-note]'); if (!row) return;
        const nid = row.dataset.note, r = el.getBoundingClientRect();
        if (!stickyStore()[nid]) { stickyStore()[nid] = { x: Math.round(r.right + 10 + 260 > innerWidth ? Math.max(0, r.left - 270) : r.right + 10), y: Math.round(r.top), w: 260, h: 220 }; save(); }
        openSticky(nid);
    });
    el.querySelector('[data-sticky="close"]').onclick = () => closeSticky(key);
    el.querySelector('[data-sticky="list"]').onclick = () => openPanel();
    el.addEventListener('pointerdown', () => raiseSticky(el), true);
    stickyMove(el, key);
    el.addEventListener('pointerup', () => rememberSticky(key, el));
    placeSticky(el, stickyStore()[key] || { w: 230 }); el.style.height = ''; // 높이는 줄 수만큼
    document.body.append(el); stickies.set(key, el); raiseSticky(el); rememberSticky(key, el);
    return el;
}
export function closeSticky(id) {
    const el = stickies.get(id); if (el) { el.remove(); stickies.delete(id); }
    if (stickyStore()[id]) { delete stickyStore()[id]; save(); }
}
function restoreStickies() {
    if (!isWide()) return;
    for (const id of Object.keys(stickyStore())) {
        const ok = id.startsWith('f:') ? !!folderById(id.slice(2)) : notes().some(n => n.id === id);
        if (ok) openSticky(id); else { delete stickyStore()[id]; save(); }
    }
}
addEventListener('resize', () => stickies.forEach((el, id) => { placeSticky(el, stickyStore()[id] || {}); if (id.startsWith('f:')) el.style.height = ''; }));

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
    const list = orderedNotes(), row = bar.querySelector('.bl-notes-row'), mini = bar.querySelector('.bl-notes-mini');
    if (peekId && !list.some(n => n.id === peekId)) peekId = null;
    // 폴더는 칩 하나 (누르면 작은 목록이 그 폴더 안으로 열린다)
    const chips = displayItems('').map(x => {
        const b = document.createElement('button'); b.type = 'button';
        if (x.folder) {
            const f = folderById(x.folder), count = list.filter(n => n.folder === x.folder).length;
            b.className = 'bl-notes-chip bl-notes-chip-folder' + (miniOpen && mini?.dataset.folder === x.folder ? ' is-open' : ''); b.dataset.folder = x.folder;
            b.innerHTML = `<i class="fa-solid fa-folder" aria-hidden="true"></i><span></span>`; b.querySelector('span').textContent = folderName(f); b.title = `${folderName(f)} · 메모 ${count}개`;
            return b;
        }
        const note = x.note;
        b.className = 'bl-notes-chip' + (note.id === peekId ? ' is-open' : ''); b.dataset.id = note.id; b.textContent = label(note); paintNote(b, note.color); b.title = note.title || label(note); return b;
    });
    const more = document.createElement('button'); more.type = 'button'; more.className = 'bl-notes-chip bl-notes-more' + (miniOpen && !mini?.dataset.folder ? ' is-open' : ''); more.dataset.bar = 'list'; more.setAttribute('aria-label', '메모 목록 (길게 누르면 큰 창)'); more.title = '메모 목록 · 길게 누르면 큰 창'; more.innerHTML = list.length ? '<i class="fa-solid fa-bars"></i>' : '<i class="fa-solid fa-plus"></i> 메모';
    row.replaceChildren(more, ...chips);
    renderMini(); renderPeek();
}
// 목록 열쇠의 앞(정렬 · 폴더) · 뒤(메모 구성) — 쓰는 중에는 순서만 바뀐 것으로 다시 만들지 않는다
const keyHead = k => (k || '').split(':').slice(0, -1).join(':');
const keySet = k => (k || '').split(':').pop().split('|').sort().join('|');
function renderMini() {
    const bar = document.getElementById(BAR_ID); if (!bar) return;
    const host = bar.querySelector('.bl-notes-mini');
    if (!miniOpen) { flush(host); host.hidden = true; host.replaceChildren(); delete host.dataset.key; delete host.dataset.folder; return; }
    host.hidden = false;
    if (!host.querySelector('.bl-notes-list')) host.innerHTML = `<div class="bl-notes-peek-head"><b><i class="fa-solid fa-note-sticky" aria-hidden="true"></i> ${TITLE} <small class="bl-notes-count"></small></b>${HEAD_TOOLS}</div>${FIND_ROW}${EMPTY_ROW}<div class="bl-notes-list"></div>`;
    // 카드는 목록의 구성(순서 · 개수)이 바뀔 때만 다시 만든다 — 타이핑마다 다시 만들면 편집 칸이 사라지고 초점을 잃는다 (폰 제보)
    const key = listKey(host);
    // 칸에 초점이 있고 메모 개수 · 구성이 그대로면(가나다 · 최근 순이라 순서만 바뀜) 쓰는 동안은 다시 만들지 않는다 — 칸에서 나가면 맞춘다
    const same = (a, b) => keyHead(a) === keyHead(b) && keySet(a) === keySet(b);
    if (host.dataset.key !== key && !(host.contains(document.activeElement) && same(host.dataset.key, key))) { host.dataset.key = key; renderList(host); }
    else { const count = host.querySelector('.bl-notes-count'); if (count) count.textContent = visibleNotes().length ? String(visibleNotes().length) : ''; }
    if (!host._blurSort) { host._blurSort = true; host.addEventListener('focusout', () => setTimeout(() => { if (!host.hidden && !host.contains(document.activeElement) && host.dataset.key !== listKey(host)) renderList(host); }, 0)); }
}
function renderPeek() {
    const bar = document.getElementById(BAR_ID); if (!bar) return;
    const host = bar.querySelector('.bl-notes-peek'), note = miniOpen ? null : notes().find(n => n.id === peekId);
    if (!note) { host.hidden = true; host.replaceChildren(); delete host.dataset.id; host._sync = null; return; }
    host.hidden = false;
    if (host.dataset.id !== note.id) {
        host.dataset.id = note.id;
        host.innerHTML = `<div class="bl-notes-peek-head"><b></b><button type="button" class="bl-note-btn" data-bar="pop" title="화면에 꺼내 두기 (PC)" aria-label="화면에 꺼내 두기"><i class="fa-solid fa-arrow-up-right-from-square"></i></button><button type="button" class="bl-note-btn" data-bar="close" title="접기" aria-label="접기"><i class="fa-solid fa-xmark"></i></button></div><div class="bl-notes-peek-view bl-notes-view salty-preview" hidden></div><textarea class="bl-notes-peek-body" placeholder="내용" spellcheck="false"></textarea>`;
        const area = host.querySelector('textarea'), view = host.querySelector('.bl-notes-peek-view'); area.value = note.body; area.dataset.noteId = note.id; // 자기 자신 ![[ ]] 끌어오기 막기 · 고르기 목록에서 빼기
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
        const mini = bar.querySelector('.bl-notes-mini');
        if (barAct === 'list') { if (longFired) { longFired = false; return; } if (miniOpen && mini.dataset.folder) { flush(mini); delete mini.dataset.folder; renderBar(); return; } miniOpen = !miniOpen; if (miniOpen) peekId = null; renderBar(); return; }
        if (chip?.dataset.folder) { // 폴더 칩: 작은 목록을 그 폴더 안으로 (한 번 더 누르면 닫기)
            const same = miniOpen && mini.dataset.folder === chip.dataset.folder;
            if (miniOpen) flush(mini);
            miniOpen = !same; peekId = null; if (miniOpen) mini.dataset.folder = chip.dataset.folder;
            renderBar(); return;
        }
        if (barAct === 'close') { peekId = null; miniOpen = false; renderBar(); return; }
        if (barAct === 'pop') { const id = peekId; peekId = null; renderBar(); openSticky(id); return; }
        if (act) { const mini = bar.querySelector('.bl-notes-mini'), btn = event.target.closest('[data-act]'); handleAct(act, actArg(btn), mini, () => renderList(mini), btn); return; }
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
try {
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged); eventSource.on(event_types.CHAT_RENAMED, onChatRenamed);
    eventSource.on(event_types.CHARACTER_RENAMED, onCharacterRenamed); eventSource.on(event_types.CHAT_DELETED, onChatDeleted); eventSource.on(event_types.GROUP_CHAT_DELETED, onGroupChatDeleted);
    eventSource.on(event_types.CHARACTER_DELETED, () => { measureOwners(); rerenderAll(); });
} catch (error) { console.warn('[메모] 채팅 이벤트:', error); }
let tries = 0;
const mount = () => { syncMenu(); if ((!document.getElementById(MENU_ID) || !document.getElementById(BAR_ID)) && tries++ < 20) setTimeout(mount, 500); };
mount();
setTimeout(restoreStickies, 1200); // 화면이 다 그려진 뒤 (꺼내 둔 쪽지는 PC 너비에서만)
verifyAddonCss({ folder: 'notes', name: '--bl-notes-css-version', version: VERSION, title: TITLE });
