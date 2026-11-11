// 11-11 글꾸 마트 「조절」 — 크게 보기 창에서 틀 하나를 세세하게 고친 값(역할별 글자색 · 소품 색 · 고쳐 쓴 글)과 「내 글꾸」 저장.
//   사용자 「마트에서 진짜 섬세하게 다 조절가능하게해줘야지」. DOM 없는 순수 모듈(node 시험 — tools/geulkku-simple-test.mjs) · 화면은 tune-ui.js.
//   - 값만 바꿔요: 글자색은 틀 <style> 끝에 덮는 규칙 몇 줄, 글은 그 요소의 글자만. 뼈대 · 움직임 · <style> 하나는 그대로.
//   - 아무것도 안 고친 틀은 조절 값이 없어(tuneOf → null) 미리보기 · 「HTML 복사」가 한 글자도 안 달라져요.
//   - 깡통 · 깡캐 색은 목록 위 두 칸(tone-state.js)과 같은 값이라 여기에 안 들어 있어요.
export const TUNE_KEY = 'bl-mart-tune-v1';     // 지금 고치는 중인 값(탭을 닫으면 사라져요 — sessionStorage)
export const MINE_KEY = 'bl-mart-mine-v1';     // 「내 글꾸」(이 브라우저에 기억 — localStorage)
import { cleanLook } from './look.js?v=20261111n';
const HEX = /^#[0-9a-f]{6}$/i;

/** 역할별 글자색 — 이름은 inks.js(테마 글자색 칩)와 같아요. 새 틀에 그 글자가 있는 역할만 칸이 떠요(속마음 · 강조 · 형광펜은 그 클래스를 쓰는 틀이 생기면 한 줄 더해요) */
export const TUNE_ROLES = Object.freeze([
    Object.freeze({ role: 'title', label: '제목', cls: 'gk-tt', sel: '.gk-tt' }),
    Object.freeze({ role: 'text', label: '본문', cls: 'gk-nr', sel: 'p.gk-nr' }),
    Object.freeze({ role: 'dialogue', label: '대사', cls: 'gk-d', sel: '.gk-d' }),
]);
/** 미리보기에서 고쳐 쓸 수 있는 글 자리 — 이 클래스가 붙은(또는 틀이 「✎」 주석을 달아 둔) 글자만 든 요소 */
export const EDIT_CLASSES = Object.freeze(['gk-tt', 'gk-nr', 'gk-nm', 'gk-d', 'gk-sn']);
/** 지문 안의 속마음 · 강조 · 취소 글자도 고쳐 쓸 수 있어요(클래스 없이 태그로) */
export const EDIT_TAGS = Object.freeze(['em', 'strong', 's']);
/** 대사 줄 늘리기 · 줄이기 범위(틀이 버티는 만큼 — 견본 대사 둘에서 하나 ~ 넷) */
export const LINES_RANGE = Object.freeze([-1, 2]);
const MODES = ['light', 'dark'];
const DARK_BASES = ['gk-td', 'gk-tx'];

const escText = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const oneLine = s => String(s ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, 600);
/** 글 칸 안에 남겨 두는 꾸밈 — 줄바꿈 · 굵게 · 기울임 · 강조 · 속마음 · 취소(깡통 글에서 살아요) */
export const RICH_TAGS = Object.freeze(['br', 'b', 'i', 'strong', 'em', 's']);
/**
 * 고쳐 쓴 글 → 글 칸에 넣을 HTML(남겨 둘 꾸밈만 · 속성 없이 · 나머지 태그는 글자만 · 글자는 이스케이프) — 2000자까지
 *   옛 꼴(꾸밈 없는 글)도 그대로 받아요
 */
export function cleanRich(v) {
    let s = String(v ?? '').slice(0, 4000).replace(/\r\n?/g, '\n');
    const out = [], stack = [];
    for (const m of s.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>|([^<]+)|(<)/gi)) {
        if (m[3] != null || m[4] != null) { out.push(String(m[3] ?? m[4]).replace(/&(?!(?:amp|lt|gt|quot|#39|#x?[0-9a-f]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')); continue; }
        const close = m[1] === '/', tag = m[2].toLowerCase();
        if (tag === 'div' || tag === 'p') { if (!close && out.length) out.push('<br>'); continue; }   // 붙여 넣은 줄 · 문단은 줄바꿈
        if (!RICH_TAGS.includes(tag)) continue;
        if (tag === 'br') { out.push('<br>'); continue; }
        if (!close) { out.push(`<${tag}>`); stack.push(tag); }
        else { const at = stack.lastIndexOf(tag); if (at < 0) continue; while (stack.length > at) out.push(`</${stack.pop()}>`); }
    }
    while (stack.length) out.push(`</${stack.pop()}>`);
    return out.join('').replace(/(<br>){3,}/g, '<br><br>').replace(/^(<br>)+|(<br>)+$/g, '').slice(0, 2000);
}
const store = (kind) => { try { return kind === 'session' ? globalThis.sessionStorage : globalThis.localStorage; } catch { return null; } };
const read = (kind, key, fallback) => { try { const v = JSON.parse(store(kind)?.getItem(key) || 'null'); return v ?? fallback; } catch { return fallback; } };
const write = (kind, key, value) => { try { store(kind)?.setItem(key, JSON.stringify(value)); } catch { /* 기억 못 해도 이번 화면에서는 써요 */ } };

/** 받은 값을 조절 값 꼴로 다듬어요(모르는 칸 · 틀린 색은 버려요) · 남는 게 없으면 null */
export function cleanTune(t) {
    if (!t || typeof t !== 'object') return null;
    const out = {};
    const inks = {};
    for (const m of MODES) {
        const row = {};
        for (const { role } of TUNE_ROLES) { const v = t.inks?.[m]?.[role]; if (HEX.test(v || '')) row[role] = v.toLowerCase(); }
        if (Object.keys(row).length) inks[m] = row;
    }
    if (Object.keys(inks).length) out.inks = inks;
    if (HEX.test(t.prop || '')) out.prop = t.prop.toLowerCase();   // 소품 색: 없으면 깡통 색을 따라가요(나중에 「기본 색」 켬끔이 들어올 자리 — 값 'own')
    if (t.own === false) out.own = false;
    const lines = Number(t.lines); if (Number.isInteger(lines) && lines !== 0 && lines >= LINES_RANGE[0] && lines <= LINES_RANGE[1]) out.lines = lines;   // 대사 줄(견본 글일 때만)   // 「기본 색」이 있는 틀: false = 소품을 캐릭터 색으로 덮어써요(없으면 기본 색 그대로)
    const texts = {};
    for (const [i, v] of Object.entries(t.texts || {})) if (/^\d+$/.test(i) && typeof v === 'string') texts[i] = cleanRich(v);
    if (Object.keys(texts).length) out.texts = texts;
    const mineTexts = {};   // 11-11 「내 글 넣기」로 넣은 글에서 고쳐 쓴 것(견본 글 자리와 번호가 달라 따로 둬요)
    for (const [i, v] of Object.entries(t.mineTexts || {})) if (/^\d+$/.test(i) && typeof v === 'string') mineTexts[i] = cleanRich(v);
    if (Object.keys(mineTexts).length) out.mineTexts = mineTexts;
    return Object.keys(out).length ? out : null;
}

const tunes = (() => { const all = read('session', TUNE_KEY, {}); const out = {}; for (const [id, t] of Object.entries(all && typeof all === 'object' ? all : {})) { const c = cleanTune(t); if (c) out[id] = c; } return out; })();
let rev = 0;
/** 그 틀의 조절 값(없으면 null) */
export const tuneOf = id => tunes[id] || null;
/** 조절 값이 바뀔 때마다 올라가는 번호(카드가 그려 둔 것을 다시 쓸지 알아보는 열쇠에 들어가요) */
export const tuneRev = () => rev;
/** 조절 값을 통째로 바꿔요(null 이면 처음으로) · 'bl-tune-change' 를 알려요 — textOnly: 글만 고친 것(크게 보기 미리보기는 다시 안 그려요 · 글 쓰는 자리가 안 날아가게) */
export function setTune(id, next, { textOnly = false } = {}) {
    const c = cleanTune(next);
    if (c) tunes[id] = c; else delete tunes[id];
    rev++;
    write('session', TUNE_KEY, tunes);
    try { document.dispatchEvent(new CustomEvent('bl-tune-change', { detail: { id, textOnly } })); } catch { /* 시험 */ }
    return c;
}

/** 틀 HTML 의 글 자리 목록(문서 차례) — [{ i, cls, text(HTML 이스케이프된 원래 글), start, end }] */
const LEAF = /(<!--\s*✎[^>]*-->\s*)?<([a-z][a-z0-9]*)\b([^>]*)>((?:[^<]|<br\s*\/?>|<\/?(?:b|i|strong|em|s)>)*)<\/\2>/g;
export function editables(html) {
    const text = String(html ?? ''), at = text.indexOf('</style>');
    const from = at < 0 ? 0 : at + 8, out = [];
    LEAF.lastIndex = from;
    for (let m; (m = LEAF.exec(text));) {
        const cls = ((m[3].match(/\sclass="([^"]*)"/) || [])[1] || '').split(/\s+/);
        const hit = EDIT_CLASSES.find(c => cls.includes(c));
        if (!hit && !m[1] && !EDIT_TAGS.includes(m[2])) continue;
        if (m[2] === 'style' || m[2] === 'script' || m[2] === 'audio') continue;
        const end = m.index + m[0].length - (`</${m[2]}>`).length;
        out.push({ i: out.length, cls: hit || (EDIT_TAGS.includes(m[2]) ? m[2] : 'mark'), text: m[4], start: end - m[4].length, end });
    }
    return out;
}
/** 고쳐 쓴 글을 넣어요 — texts: { 자리 번호: 글(이스케이프 전) } */
export function applyTexts(html, texts) {
    const keys = Object.keys(texts || {});
    if (!keys.length) return String(html ?? '');
    let text = String(html ?? '');
    for (const e of editables(text).reverse()) if (Object.hasOwn(texts, e.i)) text = text.slice(0, e.start) + cleanRich(texts[e.i]) + text.slice(e.end);
    return text;
}
/** 역할별 글자색 덮는 규칙 — 틀 <style> 끝에(그 판 뿌리 클래스에만 걸려요 · 글자색마다 fill 짝) */
export function inkRules(html, inks) {
    const key = (String(html ?? '').match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1];
    if (!key || !inks) return [];
    const K = `.gk-${key}`.repeat(3), out = [];
    for (const m of MODES) for (const { role, sel } of TUNE_ROLES) {
        const v = inks[m]?.[role];
        if (!HEX.test(v || '')) continue;
        const roots = m === 'light' ? [`${K}.gk-tl`] : DARK_BASES.map(b => `${K}.${b}`);
        out.push(`${roots.map(r => `${r} ${sel}`).join(',')}{color:${v};-webkit-text-fill-color:${v}}`);
    }
    return out;
}
/** 다 칠한 틀 HTML 에 조절 값을 얹어요(글자색 규칙 + 고쳐 쓴 글) — 값이 없으면 받은 그대로 */
/** 대사 줄 늘리기 · 줄이기 — 견본 대사 쌍(이름 + 대사)을 마지막 쌍 뒤에 번갈아 붙이거나 마지막 쌍을 빼요(지문 · 소리 카드 · 쪽 넘김은 그대로) */
const PAIR_G = /<p class="gk-nm gk-n([A-Z])">[^<]*<\/p>\s*<p class="gk-dl"[^>]*><span class="gk-d gk-d[A-Z]">(?:(?!<\/p>)[\s\S])*?<\/span><\/p>/g;
export function applyLines(html, n) {
    const text = String(html ?? ''), k = Number(n);
    if (!Number.isInteger(k) || !k) return text;
    const at = text.indexOf('</style>'), pairs = [...text.matchAll(PAIR_G)].filter(m => m.index > at);
    if (pairs.length < 2) return text;
    const last = pairs.at(-1), end = last.index + last[0].length;
    if (k < 0) { const cut = Math.max(-k, 0), keep = pairs.length - cut; if (keep < 1) return text; const from = pairs[keep].index; return text.slice(0, from).replace(/\s*$/, '') + text.slice(end); }
    const gap = (text.slice(pairs.at(-2).index + pairs.at(-2)[0].length, last.index).match(/^\s*/) || [''])[0] || '\n';
    let add = '';
    for (let i = 0; i < k; i++) add += `${gap.includes('\n') ? '\n' : gap}${pairs[pairs.length - 2 + (i % 2)][0]}`;
    return text.slice(0, end) + add + text.slice(end);
}
export function applyTune(html, tune, { mine = false } = {}) {
    const t = cleanTune(tune);
    let text = String(html ?? '');
    if (!t) return text;
    if (!mine && t.lines) text = applyLines(text, t.lines);
    const rules = inkRules(text, t.inks);
    if (rules.length) { const at = text.indexOf('\n</style>'); if (at >= 0) text = `${text.slice(0, at)}\n${rules.join('\n')}${text.slice(at)}`; }
    return applyTexts(text, mine ? t.mineTexts : t.texts);
}

// ── 「내 글꾸」: 틀 + 깡통 · 깡캐 · 낮밤 + 조절 값을 이름 붙여 기억 ──
const cleanName = s => String(s ?? '').replace(/[<>"'`]/g, '').trim().slice(0, 24);
const cleanMine = x => {
    if (!x || typeof x !== 'object' || typeof x.frame !== 'string' || !/^[a-z0-9-]{1,40}$/.test(x.frame)) return null;
    const name = cleanName(x.name); if (!name) return null;
    const tone = x.tone && typeof x.tone === 'object' ? x.tone : {};
    const hex = v => (HEX.test(v || '') ? v.toLowerCase() : null);
    return {
        id: /^[a-z0-9]{4,16}$/.test(x.id || '') ? x.id : Math.random().toString(36).slice(2, 10), frame: x.frame, frameName: cleanName(x.frameName), name,
        tone: { on: tone.on === true, k: hex(tone.k), name: cleanName(tone.name), k2: hex(tone.k2), name2: cleanName(tone.name2), mode: tone.mode === 'light' ? 'light' : 'dark', none: tone.none === true },
        tune: cleanTune(x.tune), ...(x.look !== undefined ? { look: cleanLook(x.look) } : {}), at: Number(x.at) || 0,
    };
};
/** 기억한 내 글꾸(최근 것이 앞 · 최대 60) */
export function mineList() { const list = read('local', MINE_KEY, []); return Array.isArray(list) ? list.map(cleanMine).filter(Boolean).slice(0, 60) : []; }
/** 저장 — 같은 틀에 같은 이름이면 덮어써요 */
export function saveMine({ frame, frameName, name, tone, tune, look }) {
    const row = cleanMine({ frame, frameName, name, tone, tune, look, at: Date.now() });
    if (!row) return null;
    const list = mineList().filter(x => !(x.frame === row.frame && x.name === row.name));
    list.unshift(row);
    write('local', MINE_KEY, list.slice(0, 60));
    return row;
}
export function forgetMine(id) { write('local', MINE_KEY, mineList().filter(x => x.id !== id)); }
