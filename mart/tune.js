// 11-11 글꾸 마트 「조절」 — 크게 보기 창에서 틀 하나를 세세하게 고친 값(역할별 글자색 · 소품 색 · 고쳐 쓴 글)과 「내 글꾸」 저장.
//   사용자 「마트에서 진짜 섬세하게 다 조절가능하게해줘야지」. DOM 없는 순수 모듈(node 시험 — tools/geulkku-simple-test.mjs) · 화면은 tune-ui.js.
//   - 값만 바꿔요: 글자색은 틀 <style> 끝에 덮는 규칙 몇 줄, 글은 그 요소의 글자만. 뼈대 · 움직임 · <style> 하나는 그대로.
//   - 아무것도 안 고친 틀은 조절 값이 없어(tuneOf → null) 미리보기 · 「HTML 복사」가 한 글자도 안 달라져요.
//   - 깡통 · 깡캐 색은 목록 위 두 칸(tone-state.js)과 같은 값이라 여기에 안 들어 있어요.
export const TUNE_KEY = 'bl-mart-tune-v1';     // 지금 고치는 중인 값(탭을 닫으면 사라져요 — sessionStorage)
export const MINE_KEY = 'bl-mart-mine-v1';     // 「내 글꾸」(이 브라우저에 기억 — localStorage)
import { spoilerHtml, spoilerStyle, SPOILER_LABEL, unparagraphHtml } from './lib/log-copy/log-copy-spoiler.js?v=20261112a';
import { cleanLook } from './look.js?v=20261112a';
import { applyVals } from './custom.js?v=20261112e';
import { PAINT_ROLES } from './shape.js?v=20261112a';   // 11-12 낱낱 바탕 색(카드 바탕 · 깡통 띠 · 깡캐 띠 · 제목 밑줄) — 같은 inks 칸에 기억 · 규칙은 shape.js 가 내요
import { cleanShape } from './shape.js?v=20261112a';   // 11-11 틀별 값(점수 · 개수 · 별 · 날짜 · 소품 글자)
const HEX = /^#[0-9a-f]{6}$/i;

/** 역할별 글자색 — 이름은 inks.js(테마 글자색 칩)와 같아요. 새 틀에 그 글자가 있는 역할만 칸이 떠요(속마음 · 강조 · 형광펜은 그 클래스를 쓰는 틀이 생기면 한 줄 더해요) */
export const TUNE_ROLES = Object.freeze([
    Object.freeze({ role: 'title', label: '제목', cls: 'gk-tt', sel: '.gk-tt' }),
    Object.freeze({ role: 'text', label: '본문', cls: 'gk-nr', sel: 'p.gk-nr' }),
    Object.freeze({ role: 'dialogue', label: '대사', cls: 'gk-d', sel: '.gk-d' }),
    Object.freeze({ role: 'name', label: '이름', cls: 'gk-nm', sel: 'p.gk-nm' }),   // 11-11 F5 — 이름표 색을 깡통 · 깡캐 색과 따로(두 화자 이름 모두)
]);
/** 미리보기에서 고쳐 쓸 수 있는 글 자리 — 이 클래스가 붙은(또는 틀이 「✎」 주석을 달아 둔) 글자만 든 요소 */
export const EDIT_CLASSES = Object.freeze(['gk-tt', 'gk-nr', 'gk-nm', 'gk-d', 'gk-sn', 'gk-hl']);   // gk-hl: 05 티백 숨은 한 줄(15 요람의 빈 공 빛 조각은 글이 없어 칸이 아니에요)
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
        for (const { role } of [...TUNE_ROLES, ...PAINT_ROLES]) { const v = t.inks?.[m]?.[role]; if (HEX.test(v || '')) row[role] = v.toLowerCase(); }
        if (Object.keys(row).length) inks[m] = row;
    }
    if (Object.keys(inks).length) out.inks = inks;
    if (HEX.test(t.prop || '')) out.prop = t.prop.toLowerCase();   // 소품 색: 없으면 깡통 색을 따라가요(나중에 「기본 색」 켬끔이 들어올 자리 — 값 'own')
    if (t.own === false || t.own === true) out.own = t.own;   // 11-11 이 틀만: true = 소품 기본 색 · false = 소품 캐릭터 색 · 없으면 마트 칸(원래 색 · 「소품도 캐릭터 색」)을 따라요
    if (t.hideTitle === true) out.hideTitle = true;   // 보일 것: 제목 끔(제목이 누름 칸 안인 틀은 화면이 이 칸을 안 줘요)
    if (t.hideNames === true) out.hideNames = true;   // 보일 것: 이름 줄 끔
    // 숨긴 줄(스포일러): [{ i: 글 칸 번호 }] — 견본 글 · 내 글 따로(번호가 달라요) · 20개까지
    //   11-12 고른 글만 숨기기(고른 글 옆 막대): { i, a, b, t } — 그 칸 글자(태그 뺀 글) a ~ b 자리 · t = 그때 고른 글(글을 고쳐 자리가 밀리면 t 로 다시 찾아요)
    for (const key of ['spoilers', 'mineSpoilers']) {
        const seen = new Set(), list = [];
        for (const x of Array.isArray(t[key]) ? t[key] : []) {
            const i = Number(x?.i); if (!Number.isInteger(i) || i < 0) continue;
            const a = Number(x?.a), b = Number(x?.b), part = Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b > a && typeof x?.t === 'string' && x.t.trim() && x.t.length <= 2000;
            const k = part ? `${i}:${a}:${b}` : `${i}`; if (seen.has(k)) continue;
            seen.add(k); list.push(part ? { i, a, b, t: x.t } : { i });
            if (list.length >= 20) break;
        }
        if (list.length) out[key] = list;
    }
    const lines = Number(t.lines); if (Number.isInteger(lines) && lines !== 0 && lines >= LINES_RANGE[0] && lines <= LINES_RANGE[1]) out.lines = lines;   // 대사 줄(견본 글일 때만)   // 「기본 색」이 있는 틀: false = 소품을 캐릭터 색으로 덮어써요(없으면 기본 색 그대로)
    const texts = {};
    for (const [i, v] of Object.entries(t.texts || {})) if (/^\d+$/.test(i) && typeof v === 'string') texts[i] = cleanRich(v);
    if (Object.keys(texts).length) out.texts = texts;
    const mineTexts = {};   // 11-11 「내 글 넣기」로 넣은 글에서 고쳐 쓴 것(견본 글 자리와 번호가 달라 따로 둬요)
    for (const [i, v] of Object.entries(t.mineTexts || {})) if (/^\d+$/.test(i) && typeof v === 'string') mineTexts[i] = cleanRich(v);
    if (Object.keys(mineTexts).length) out.mineTexts = mineTexts;
    const vals = {};   // 11-11 틀별 값: 칸 꼴은 틀이 알아요(custom.js fieldsOf) — 여기서는 짧은 숫자 · 글자만 남겨요
    for (const [k, v] of Object.entries(t.vals && typeof t.vals === 'object' ? t.vals : {}).slice(0, 40)) if (/^[\p{L}\p{N}_ -]{1,24}$/u.test(k) && (Number.isFinite(v) || (typeof v === 'string' && v.length <= 80))) vals[k] = typeof v === 'string' ? v.replace(/[<>]/g, '') : v;
    if (Object.keys(vals).length) out.vals = vals;
    return Object.keys(out).length ? out : null;
}

const tunes = (() => { const all = read('session', TUNE_KEY, {}); const out = {}; for (const [id, t] of Object.entries(all && typeof all === 'object' ? all : {})) { const c = cleanTune(t); if (c) out[id] = c; } return out; })();
let rev = 0;
/** 그 틀의 조절 값(없으면 null) */
export const tuneOf = id => tunes[id] || null;
/** 조절 값이 바뀔 때마다 올라가는 번호(카드가 그려 둔 것을 다시 쓸지 알아보는 열쇠에 들어가요) */
export const tuneRev = () => rev;
/** 조절 값을 통째로 바꿔요(null 이면 처음으로) · 'bl-tune-change' 를 알려요 — textOnly: 글만 고친 것(크게 보기 미리보기는 다시 안 그려요 · 글 쓰는 자리가 안 날아가게) */
/** 11-11 독립 점검 1 — 내 글이 바뀌면 옛 내 글에서 고친 줄 · 숨긴 줄(칸 번호가 옛 글 것)을 모든 틀에서 비워요 */
export function dropMineEdits() {
    let n = 0;
    for (const [id, t] of Object.entries(tunes)) {
        if (!t.mineTexts && !t.mineSpoilers) continue;
        const { mineTexts, mineSpoilers, ...rest } = t, c = cleanTune(rest);
        if (c) tunes[id] = c; else delete tunes[id];
        n++;
    }
    if (n) { rev++; write('session', TUNE_KEY, tunes); try { document.dispatchEvent(new CustomEvent('bl-tune-change', { detail: { id: null } })); } catch { /* 시험 */ } }
    return n;
}
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
/** 글자(문자 · 숫자)가 하나라도 있나 — 태그 · 엔티티를 풀고 봐요(edit-blocks.js markSlots 가 DOM 글로 같은 것을 봐요) */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const hasLetters = s => /[\p{L}\p{N}]/u.test(String(s ?? '').replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e.toLowerCase()] ?? '')));
/**
 * 11-12 덧칸: 바탕 칸(EDIT_CLASSES · ✎ · em/strong/s) 말고도 글자가 든 잎 요소(소품 위 글자 — 영수증 · 도장 · 신문 머리 · 선택지 …)는 모두 칸이에요.
 *   번호는 바탕 칸 뒤에 이어 붙여요(예전에 고친 글 번호가 안 밀려요) — 그래서 돌려주는 배열은 번호 차례(문서 차례가 아닐 수 있어요 · 자리 차례가 필요하면 start 로 정렬)
 */
export function editables(html) {
    const text = String(html ?? ''), at = text.indexOf('</style>');
    const from = at < 0 ? 0 : at + 8, out = [], extra = [];
    LEAF.lastIndex = from;
    for (let m; (m = LEAF.exec(text));) {
        if (['style', 'script', 'audio', 'title'].includes(m[2])) continue;
        const cls = ((m[3].match(/\sclass="([^"]*)"/) || [])[1] || '').split(/\s+/);
        const hit = EDIT_CLASSES.find(c => cls.includes(c));
        const end = m.index + m[0].length - (`</${m[2]}>`).length;
        const cell = { cls: hit || (EDIT_TAGS.includes(m[2]) ? m[2] : m[1] ? 'mark' : 'prop'), text: m[4], start: end - m[4].length, end };
        if (hit || m[1] || EDIT_TAGS.includes(m[2])) { if (!(hit === 'gk-hl' && !m[4].trim())) out.push({ i: out.length, ...cell }); continue; }
        if (hasLetters(m[4])) extra.push(cell);
    }
    for (const c of extra) out.push({ i: out.length, ...c });
    return out;
}
/** 고쳐 쓴 글을 넣어요 — texts: { 자리 번호: 글(이스케이프 전) } */
export function applyTexts(html, texts) {
    const keys = Object.keys(texts || {});
    if (!keys.length) return String(html ?? '');
    let text = String(html ?? '');
    // 자리 뒤에서부터(덧칸은 번호 차례와 자리 차례가 달라요)
    for (const e of editables(text).sort((a, b) => b.start - a.start)) if (Object.hasOwn(texts, e.i)) text = text.slice(0, e.start) + cleanRich(texts[e.i]) + text.slice(e.end);
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
/** 제목이 누름 칸(summary · label) 안인 틀 — 제목을 끄면 소품을 누를 자리가 없어져서 「제목 끄기」를 안 줘요 */
export const titleInPress = html => [...String(html ?? '').matchAll(/<(summary|label)\b[\s\S]*?<\/\1>/g)].some(m => /class="(?:[^"]*\s)?gk-tt(?:\s[^"]*)?"/.test(m[0]));
/** 보일 것(테마 SHOWS 꼴) — 제목 · 이름 줄을 끄는 규칙(틀 <style> 끝에) */
export function showRules(html, t) {
    const key = (String(html ?? '').match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1];
    if (!key || !t) return [];
    const K = `.gk-${key}`.repeat(3), out = [];
    if (t.hideTitle && !titleInPress(html)) out.push(`${K} .gk-tt,${K} .gk-ul{display:none}`);
    if (t.hideNames) out.push(`${K} p.gk-nm{display:none}`);
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
// ── 숨긴 글(스포일러) — 테마와 같은 마크업(spoilerHtml · 스크립트 없이 눌러 펼치는 details) · 꾸밈 규칙은 틀 <style> 한 곳에 ──
//   마트는 무테라 「숨겨진 글 보기」 알약의 테두리는 투명 · 옅은 바탕(테마는 1px 선) · 글자색은 fill 짝(깡통이 color 를 눌러요)
const SPOILER_LOOK = { line: 'transparent', raised: 'rgba(127,127,127,.16)', muted: '#8b8e96' };
const spoilerOf = (inner, inline = false) => spoilerHtml(inner, SPOILER_LOOK, inline).replace('color:#8b8e96;', 'color:#8b8e96;-webkit-text-fill-color:#8b8e96;');
const CELL_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
/** 11-12 칸 HTML(글 · <br> · <b> 같은 꾸밈 태그) → 태그 뺀 글과, 글자마다 HTML 자리(at[k] = k번째 글자가 시작하는 자리 · at[길이] = 끝). &…; 은 한 글자 */
export function cellText(html) {
    const src = String(html ?? ''), at = [];
    let text = '';
    for (let k = 0; k < src.length;) {
        if (src[k] === '<') { const e = src.indexOf('>', k); if (e < 0) break; k = e + 1; continue; }
        const m = src[k] === '&' ? /^&(#\d+|#x[0-9a-f]+|[a-z]+);/i.exec(src.slice(k, k + 12)) : null;
        if (m) {
            const n = m[1];
            const ch = n[0] === '#' ? String.fromCodePoint(n[1].toLowerCase() === 'x' ? parseInt(n.slice(2), 16) : Number(n.slice(1))) : (CELL_ENT[n.toLowerCase()] ?? m[0]);
            for (let c = 0; c < ch.length; c++) { at.push(k); text += ch[c]; }
            k += m[0].length; continue;
        }
        at.push(k); text += src[k]; k++;
    }
    at.push(src.length);
    return { text, at };
}
/** 11-12 고른 글 숨김 { a, b, t } 가 지금 칸 글(text)의 어디인지 — a ~ b 가 t 그대로면 그 자리, 아니면 t 를 찾아(처음 나온 곳) · 못 찾으면 null */
export function spanIn(text, sp) {
    const s = String(text ?? ''), t = String(sp?.t ?? '');
    if (!t) return null;
    if (s.slice(sp.a, sp.b) === t) return { a: sp.a, b: sp.b };
    const at = s.indexOf(t);
    return at < 0 ? null : { a: at, b: at + t.length };
}
/** HTML 조각 안 꾸밈 태그가 짝이 맞는지(열고 닫는 차례) — 고른 글만 감쌀 때 태그를 가로지르면 안 돼요 */
const balanced = (html) => {
    const stack = [];
    for (const m of String(html).matchAll(/<(\/?)([a-z][a-z0-9]*)(?:\s[^>]*?)?(\/?)>/gi)) {
        const tag = m[2].toLowerCase(); if (m[3] || tag === 'br') continue;
        if (!m[1]) stack.push(tag); else if (stack.pop() !== tag) return false;
    }
    return !stack.length;
};
const SPOILER_RULES = spoilerStyle().replace(/^<style>|<\/style>$/g, '');
const escAttr = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
/**
 * 글 칸 i 가 든 글 줄(p — 지문 · 대사 줄)의 글을 통째로 눌러야 보이는 글로(테마 블록 숨김 꼴).
 *   11-12(테마 1.1.3 c3528bad7 과 같은 고침): 예전에는 <p> 를 통째로 <details> 안에 넣어서 틀의 「.gk-lg>p…」 · 「:first-child」 같은 자리 규칙이 숨긴 줄에 안 먹었어요
 *   (k1372 인스타 피드 첫 줄 사진 글 · k1437 들여쓰기). 이제 줄 자리는 그대로 두고 그 안 글만 <details> 로 감싸요 — <p> 안에는 <details> 를 둘 수 없으니
 *   그 <p> 를 <div class="… blsp-p"> 로 바꾸고 틀 <style> 의 문단(p) 규칙마다 같은 선언의 .blsp-p 짝 선택자를 더해요(테마 unparagraphHtml · paragraphTwin 사본).
 *   짝은 한 번만 붙어요 — 그래서 마트는 숨기기를 복사 글 길 맨 끝(toneOut 의 움직임 · 도구 · 질감 뒤)에 걸어요(applyTune 의 nospoil).
 *   제목 · 화자 이름 칸(p 가 아닌 칸 · 이름표)은 안 숨겨요. 못 찾으면 그대로.
 */
export function applySpoilers(html, list) {
    let text = String(html ?? '');
    if (!Array.isArray(list) || !list.length) return text;
    const cells = editables(text), spans = [], whole = new Set();
    for (const sp of list) {
        if (sp.t != null) continue;   // 고른 글만 숨긴 것은 아래에서(같은 칸이 줄째 숨겨져 있으면 그쪽이 이겨요)
        const cell = cells[sp.i]; if (!cell || !['gk-nr', 'gk-d'].includes(cell.cls)) continue;
        const open = text.lastIndexOf('<p', cell.start); if (open < 0) continue;
        const inner = text.indexOf('>', open) + 1, close = text.indexOf('</p>', cell.end); if (!inner || close < 0) continue;
        whole.add(sp.i);
        if (!spans.some(x => x.start === inner)) spans.push({ start: inner, end: close });
    }
    for (const sp of list) {   // 11-12 고른 글만: 그 칸 안 글줄 안 숨긴 글(테마 미리보기 「숨기기」와 같은 글줄 안 꼴)
        if (sp.t == null || whole.has(sp.i)) continue;
        const cell = cells[sp.i]; if (!cell || !['gk-nr', 'gk-d'].includes(cell.cls)) continue;
        const map = cellText(cell.text), hit = spanIn(map.text, sp); if (!hit) continue;
        const start = cell.start + map.at[hit.a], end = cell.start + map.at[hit.b];
        if (!balanced(text.slice(start, end)) || spans.some(x => x.start < end && start < x.end)) continue;
        spans.push({ start, end, inline: true });
    }
    if (!spans.length) return text;
    spans.sort((x, y) => y.start - x.start);
    for (const x of spans) text = text.slice(0, x.start) + spoilerOf(text.slice(x.start, x.end), !!x.inline) + text.slice(x.end);
    if (!text.includes('.blsp-s>summary{')) { const at = text.indexOf('\n</style>'); if (at >= 0) text = `${text.slice(0, at)}\n${SPOILER_RULES}${text.slice(at)}`; }
    return unparagraphHtml(text);
}
export { SPOILER_LABEL };
export const spoilersOf = (tune, { mine = false } = {}) => { const t = cleanTune(tune); return (t && (mine ? t.mineSpoilers : t.spoilers)) || null; };
export function applyTune(html, tune, { mine = false, nospoil = false } = {}) {
    const t = cleanTune(tune);
    let text = String(html ?? '');
    if (!t) return text;
    if (!mine && t.lines) text = applyLines(text, t.lines);
    if (t.vals) text = applyVals(text, t.vals);
    const rules = [...inkRules(text, t.inks), ...showRules(text, t)];
    if (rules.length) { const at = text.indexOf('\n</style>'); if (at >= 0) text = `${text.slice(0, at)}\n${rules.join('\n')}${text.slice(at)}`; }
    const texted = applyTexts(text, mine ? t.mineTexts : t.texts);
    return nospoil ? texted : applySpoilers(texted, mine ? t.mineSpoilers : t.spoilers);
}

// ── 「내 글꾸」: 틀 + 깡통 · 깡캐 · 낮밤 + 조절 값을 이름 붙여 기억 ──
/** 11-12 움직임 값 다듬기(motion-state.js 와 같은 꼴 — 그 모듈은 세기 사본을 불러서 여기서는 꼴만) */
const cleanMotion = (v) => { const L = x => (['0', 's', 'l'].includes(x) ? x : 'm'); const o = { text: L(v?.text), prop: L(v?.prop), speed: ['s', 'l'].includes(v?.speed) ? v.speed : 'm', open: v?.open === true }; return o; };
const cleanName = s => String(s ?? '').replace(/[<>"'`]/g, '').trim().slice(0, 24);
const cleanMine = x => {
    if (!x || typeof x !== 'object' || typeof x.frame !== 'string' || !/^[a-z0-9-]{1,40}$/.test(x.frame)) return null;
    const name = cleanName(x.name); if (!name) return null;
    const tone = x.tone && typeof x.tone === 'object' ? x.tone : {};
    const hex = v => (HEX.test(v || '') ? v.toLowerCase() : null);
    return {
        id: /^[a-z0-9]{4,16}$/.test(x.id || '') ? x.id : Math.random().toString(36).slice(2, 10), frame: x.frame, frameName: cleanName(x.frameName), name,
        tone: { on: tone.on === true, k: hex(tone.k), name: cleanName(tone.name), k2: hex(tone.k2), name2: cleanName(tone.name2), ...(hex(tone.k3) ? { k3: hex(tone.k3), name3: cleanName(tone.name3) } : {}), mode: tone.mode === 'light' ? 'light' : 'dark', none: tone.none === true },
        tune: cleanTune(x.tune), ...(x.look !== undefined ? { look: cleanLook(x.look) } : {}), ...(x.shape !== undefined ? { shape: cleanShape(x.shape) } : {}), ...(x.motion && typeof x.motion === 'object' ? { motion: cleanMotion(x.motion) } : {}), ...(x.tone?.auto === true ? { auto: true } : {}), at: Number(x.at) || 0,
    };
};
/** 기억한 내 글꾸(최근 것이 앞 · 최대 60) */
export function mineList() { const list = read('local', MINE_KEY, []); return Array.isArray(list) ? list.map(cleanMine).filter(Boolean).slice(0, 60) : []; }
/** 저장 — 같은 틀에 같은 이름이면 덮어써요 */
export function saveMine({ frame, frameName, name, tone, tune, look, shape, motion }) {
    const row = cleanMine({ frame, frameName, name, tone, tune, look, shape, motion, at: Date.now() });
    if (!row) return null;
    const list = mineList().filter(x => !(x.frame === row.frame && x.name === row.name));
    list.unshift(row);
    write('local', MINE_KEY, list.slice(0, 60));
    return row;
}
export function forgetMine(id) { write('local', MINE_KEY, mineList().filter(x => x.id !== id)); }

// ── 11-12 완성 프리셋 파일(「내 글꾸」 저장분 = 틀 + 색 + 글 모양 + 값 + 고친 글) — 내려받기 · 가져오기 ──
export const SET_MARK = 'bl-mart-set';
/** 내려받을 글(JSON) — 기억한 줄 그대로(id · 저장 시각은 빼요) */
export function setsFile(rows) {
    const sets = (rows || []).map(cleanMine).filter(Boolean).map(({ id, at, ...rest }) => rest);
    return `${JSON.stringify({ [SET_MARK]: 1, sets }, null, 1)}\n`;
}
/** 파일 글 → 기억할 줄들(모르는 꼴 · 틀린 값은 버려요 · 60개까지) — 읽을 게 없으면 [] */
export function readSets(text) {
    let v = null;
    try { v = JSON.parse(String(text ?? '').replace(/^﻿/, '')); } catch { return []; }
    const list = v && typeof v === 'object' && v[SET_MARK] === 1 && Array.isArray(v.sets) ? v.sets : v && typeof v === 'object' && typeof v.frame === 'string' ? [v] : [];
    return list.slice(0, 60).map(x => cleanMine({ ...x, id: '' })).filter(Boolean);
}
/** 가져온 줄들을 기억해요(같은 틀 · 같은 이름이면 덮어써요) — 기억한 줄들 */
export function addSets(rows) { const out = []; for (const r of [...(rows || [])].reverse()) { const row = saveMine(r); if (row) out.unshift(row); } return out; }
