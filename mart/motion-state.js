// 11-12 움직임 세기(글 · 소품 · 약 / 중 / 강) — 설계 `지시-1111/글꾸-조절-설계/설계.md` 4-2 · 4-4 ③ · 연결 설명서 `지시-1111/글움직임-세기/마트-연결.md`.
//   모든 틀에 같이 · 이 브라우저에 기억(`bl-mart-motion-v1` — 「모바일에서 강하다」 사용자 말이라 틀을 넘나들어 기억) · 중 = 지금 HTML 그대로.
//   그 틀에 그 세기가 없으면(describe 가 false) 조용히 중으로 둬요. 11-12 밤: 세기 모듈에 「끔」(gm-0 · gp-0)이 들어와 넷.
//   11-12 빠르기(N3) · 처음부터 열어 두기(N4)는 세기 모듈에 축이 아직 없어 마트가 걸어요(설계 거는 꼴 그대로 — 모듈에 축이 생기면 그쪽으로 옮겨요):
//     빠르기 — 뿌리 class gk-gs-s(느리게 ×1.3) · gk-gs-l(빠르게 ×0.75) + 틀 <style> 의 길이(duration · delay)가 든 규칙마다 그 class 를 낀 사본(길이 낱말만 · 3.5초 상한)
//     열어 두기 — 누름 칸(details.gk-kx)에 open 속성(복사 글에도 · 카드 미리보기 「열어 둠」 표시와 달라 다시 닫히지 않아요)
import { applyLevel, describe, FELT } from './lib/motion/motion.js';   // FELT: 약 · 강이 중과 같아 보이는 틀(정본 화면 재기 — 깡통 118 뒤)

export const MOTION_KEY = 'bl-mart-motion-v1';
export const MOTION_LEVELS = Object.freeze([['0', '끔'], ['s', '약'], ['m', '중'], ['l', '강']]);
export const SPEEDS = Object.freeze([['s', '느리게'], ['m', '보통'], ['l', '빠르게']]);
const SPEED_X = { s: 1.3, l: 0.75 }, CAP_S = 3.5;
const ok = v => (v === '0' || v === 's' || v === 'l' ? v : 'm');
const okSpeed = v => (v === 's' || v === 'l' ? v : 'm');
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
const tidy = v => ({ text: ok(v?.text), prop: ok(v?.prop), speed: okSpeed(v?.speed), open: v?.open === true });
let motion = (() => { try { return tidy(JSON.parse(store()?.getItem(MOTION_KEY) || 'null') || {}); } catch { return tidy({}); } })();
let rev = 0;
export const motionNow = () => ({ ...motion });
export const motionRev = () => rev;
/** 그대로인가(넷 다 기본) */
export const motionPlain = (v = motion) => { const t = tidy(v); return t.text === 'm' && t.prop === 'm' && t.speed === 'm' && !t.open; };
/** 바꿔요 — { text, prop, speed, open } 중 준 것만 · 기억하고 'bl-tone-change' 를 알려요 */
export function setMotion(next = {}) {
    if ('text' in next) motion.text = ok(next.text);
    if ('prop' in next) motion.prop = ok(next.prop);
    if ('speed' in next) motion.speed = okSpeed(next.speed);
    if ('open' in next) motion.open = next.open === true;
    rev++;
    const keep = {}; if (motion.text !== 'm') keep.text = motion.text; if (motion.prop !== 'm') keep.prop = motion.prop; if (motion.speed !== 'm') keep.speed = motion.speed; if (motion.open) keep.open = true;
    try { store()?.setItem(MOTION_KEY, JSON.stringify(keep)); } catch { /* 이번 화면에서만 */ }
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { motion: true } })); } catch { /* 시험 */ }
    return motionNow();
}
const keyOf = html => (String(html ?? '').match(/^\s*<div\b[^>]*\sclass="gk\s(?:[^"]*\s)?gk-((?:k|q)\d+)(?=[\s"])/) || [])[1] || '';

// ── 빠르기 ──
const TIME = /^-?(?:\d+\.?\d*|\.\d+)m?s$/;
const secOf = t => (/ms$/.test(t) ? parseFloat(t) / 1000 : parseFloat(t));
const fmt = v => `${Number(v.toFixed(3))}s`;
/** 첫 <style> 의 맨 위 규칙(@ 덩이는 통째로 건너뛰어요 — 움직임 줄이기 덩이 · @keyframes) — [{ sel, body }] */
function topRules(css) {
    const out = []; let depth = 0, at = 0, sel = '', skip = false;
    for (let i = 0; i < css.length; i++) {
        const c = css[i];
        if (c === '{') { if (depth === 0) { sel = css.slice(at, i).trim(); skip = sel.startsWith('@'); at = i + 1; } depth++; }
        else if (c === '}') { depth--; if (depth === 0) { if (!skip) out.push({ sel, body: css.slice(at, i) }); at = i + 1; } }
    }
    return out;
}
const splitTop = (s, ch) => { const out = []; let d = 0, cur = ''; for (const c of s) { if (c === '(') d++; else if (c === ')') d--; if (c === ch && !d) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };
/** 규칙 몸 하나 → 길이를 곱한 길이 낱말들(없으면 '') — 계속 도는 반복(infinite)은 3.5초 상한 없이 같은 배로 */
const scaleT = (t, x, loop = false) => { const v = secOf(t); if (!v) return '0s'; const n = v * x; return fmt(x > 1 && !loop && v <= CAP_S ? Math.min(n, CAP_S) : n); };
function scaledDecls(body, x) {
    const list = [];
    for (const d of splitTop(body, ';')) {
        const i = d.indexOf(':'); if (i < 0) continue;
        const p = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).trim().replace(/\s*!important$/, '');
        if (/^(animation|transition)-(duration|delay)$/.test(p)) { const ts = splitTop(v, ','); if (ts.every(t => TIME.test(t))) list.push(`${p}:${ts.map(t => scaleT(t, x)).join(',')}`); continue; }
        if (p !== 'animation' && p !== 'transition') continue;
        if (/^none$/i.test(v)) continue;
        const durs = [], dels = [];
        for (const item of splitTop(v, ',')) { const loop = /\binfinite\b/.test(item), times = item.split(/\s+/).filter(t => TIME.test(t)); durs.push(scaleT(times[0] || '0s', x, loop)); dels.push(scaleT(times[1] || '0s', x, loop)); }
        if (durs.some(t => t !== '0s')) list.push(`${p}-duration:${durs.join(',')}`, `${p}-delay:${dels.join(',')}`);
    }
    return list.join(';');
}
/** 11-12 깡통 118 뒤: 틀 본문의 인라인 움직임(style="animation:…" — 13틀 · 대사 줄 차례 · 상시 물결)도 같은 배로 — 그 값 자리만 바꿔요(새 인라인 style 은 안 만들어요) */
function scaleInline(style, x) {
    return splitTop(style, ';').map((d) => {
        const i = d.indexOf(':'); if (i < 0) return d;
        const p = d.slice(0, i).trim().toLowerCase(); if (!/^(animation|transition)(-duration|-delay)?$/.test(p)) return d;
        const items = splitTop(d.slice(i + 1), ',').map((item) => { const loop = /\binfinite\b/.test(item); return item.split(/\s+/).map(t => (TIME.test(t) && secOf(t) ? scaleT(t, x, loop) : t)).join(' '); });
        return `${d.slice(0, i).trim()}:${items.join(',')}`;
    }).join(';');
}
const INLINE_MOTION = /\sstyle="([^"]*(?:animation|transition)[^"]*)"/g;
/** 그 틀에 빠르기를 걸 수 있나(길이가 든 규칙 · 인라인 움직임이 하나라도) */
export function speedCaps(html) {
    const text = String(html ?? ''), key = keyOf(text), end = text.indexOf('</style>'); if (!key || end < 0) return false;
    return topRules(text.slice(text.indexOf('<style>') + 7, end)).some(r => scaledDecls(r.body, 2) !== '') || /\sstyle="[^"]*(?:animation|transition)[^"]*\d/.test(text.slice(end));
}
/** 빠르기 — 그 틀의 모든 움직임(누름 움직임 · 글 움직임 · 계속 도는 반복까지) 같은 배 */
export function applySpeed(html, speed) {
    const x = SPEED_X[speed]; if (!x) return html;
    const text = String(html ?? ''), key = keyOf(text), end = text.indexOf('</style>'); if (!key || end < 0) return text;
    const K = `.gk-${key}`, C = `gk-gs-${speed}`, rows = [];
    for (const r of topRules(text.slice(text.indexOf('<style>') + 7, end))) {
        const d = scaledDecls(r.body, x); if (!d) continue;
        const sels = r.sel.split(',').map(s => s.trim()).filter(s => s.startsWith(K) && !/[\w-]/.test(s[K.length] || '')).map(s => `${K}.${C}${s.slice(K.length)}`);
        if (sels.length) rows.push(`${sels.join(',')}{${d}}`);
    }
    const bodyOld = text.slice(end), bodyNew = bodyOld.replace(INLINE_MOTION, (m, st) => ` style="${scaleInline(st, x)}"`);
    if (!rows.length && bodyNew === bodyOld) return text;
    const out = (text.slice(0, end) + bodyNew).replace(/^(\s*<div\b[^>]*\sclass=")(gk(?:\s[^"]*)?)(")/, (m, a, c, z) => `${a}${c} ${C}${z}`);
    const at = out.indexOf('\n</style>');
    return !rows.length || at < 0 ? out : `${out.slice(0, at)}\n${rows.join('\n')}${out.slice(at)}`;
}
// ── 처음부터 열어 두기 ──
//   11-12 깡통 118: 정화기가 <details open> 의 open 속성을 지워요 → 속성에 기대지 않게, 누름 칸(details.gk-kx)을 figure.gk-kx.gk-det · 그 summary 를 figcaption 으로 바꾸고
//   <style> 은 ① .gk-kx[open] → .gk-kx.gk-det(그 자리에서 · 무게 같음 — 열린 규칙은 늘 먹고 닫힌 규칙 :not(:has(…[open])) 은 안 먹어요) ② :not(summary) → :not(summary,figcaption)
//   ③ details · summary 꼴 선택자는 같은 규칙에 figure · figcaption 판을 더해요(꼴 선택자끼리라 무게 같음 · 같은 자리라 겹침 차례 그대로 — class 로 바꾸면 무게가 올라 틀 규칙을 이겨요)
//   ④ figure 의 기본 여백(1em 40px)은 맨 앞 .gk figure{margin:0} 로 지워요(틀 규칙이 뒤라 이겨요). 누르면 닫히는 기능은 없어요(「열어 둔 채」) · 뿌리 class gk-op.
export const openCaps = html => /<details class="gk-kx"/.test(String(html ?? ''));
const TYPE = /(^|[\s>+~(])(details|summary)(?![\w-])/;
function openSel(sel) {
    const parts = splitTop(sel.replace(/\.gk-kx\[open\]/g, '.gk-kx.gk-det').replace(/:not\(summary\)/g, ':not(summary,figcaption)'), ',');
    const extra = parts.filter(p => TYPE.test(p)).map(p => p.replace(/(^|[\s>+~(])details\[open\]/g, '$1figure.gk-det').replace(/(^|[\s>+~(])details:not\(\[open\]\)/g, '$1figure:not(.gk-det)').replace(/(^|[\s>+~(])details(?![\w-])/g, '$1figure').replace(/(^|[\s>+~(])summary(?![\w-])/g, '$1figcaption'));
    return [...parts, ...extra].join(',');
}
function openCss(css) {
    let out = '', i = 0;
    while (i < css.length) {
        const a = css.indexOf('{', i); if (a < 0) { out += css.slice(i); break; }
        const pre = css.slice(i, a), lead = pre.match(/^\s*/)[0], sel = pre.trim();
        let d = 1, j = a + 1; for (; j < css.length && d; j++) { if (css[j] === '{') d++; else if (css[j] === '}') d--; }
        const inner = css.slice(a + 1, j - 1);
        if (/^@(media|supports)/.test(sel)) out += `${lead}${sel}{${openCss(inner)}}`;
        else if (sel.startsWith('@')) out += `${lead}${sel}{${inner}}`;
        else out += `${lead}${openSel(sel)}{${inner}}`;
        i = j;
    }
    return out;
}
export function applyOpen(html) {
    const text = String(html ?? ''); if (!openCaps(text)) return text;
    const s0 = text.indexOf('<style>') + 7, e0 = text.indexOf('</style>'); if (s0 < 7 || e0 < 0) return text;
    let body = text.slice(e0), at = 0;
    const RE = /<details class="gk-kx"([^>]*)>/g;
    for (;;) {
        RE.lastIndex = at; const m = RE.exec(body); if (!m) break;
        const attrs = m[1].replace(/\sopen(?:="[^"]*")?(?=[\s>]|$)/, '').replace(/\sdata-bl-peek=""/, ''), head = `<figure class="gk-kx gk-det"${attrs}>`;
        let rest = body.slice(m.index + m[0].length);
        const sm = /^(\s*)<summary\b([^>]*)>/.exec(rest);
        if (sm) { rest = `${sm[1]}<figcaption${sm[2]}>${rest.slice(sm[0].length).replace('</summary>', '</figcaption>')}`; }
        rest = rest.replace('</details>', '</figure>');
        body = body.slice(0, m.index) + head + rest; at = m.index + head.length;
    }
    return (text.slice(0, s0) + '\n.gk figure{margin:0}' + openCss(text.slice(s0, e0)) + body).replace(/^(\s*<div\b[^>]*\sclass=")(gk(?:\s[^"]*)?)(")/, (mm, a, c, z) => `${a}${c} gk-op${z}`);
}

/** 세기 모듈이 걸 수 있고(describe) · 걸면 실제로 달라 보이는(FELT) 세기 */
function levelCaps(html) {
    const key = keyOf(html), d = describe(html, { key }); if (!d) return null;
    const f = FELT[key] || {};
    return { text: { 0: !!d.text.off, s: !!d.text.s && f.ts !== false, l: !!d.text.l && f.tl !== false }, prop: { 0: !!d.prop.off, s: !!d.prop.s && f.ps !== false, l: !!d.prop.l && f.pl !== false } };
}
/** 그 틀이 받는 세기 — { text: { 0, s, l }, prop: { 0, s, l }, speed, open } · 못 읽는 틀이면 false */
export function motionCaps(html) {
    let text = { 0: false, s: false, l: false }, prop = { 0: false, s: false, l: false };
    try { const c = levelCaps(String(html ?? '')); if (c) ({ text, prop } = c); } catch { /* 아래 */ }
    let speed = false; try { speed = speedCaps(html); } catch { /* 없음 */ }
    return { text, prop, speed, open: openCaps(html) };
}
/** 다 그린 틀 HTML 에 지금 세기 · 빠르기 · 열어 두기를 걸어요(전부 기본이면 그대로 · 그 틀에 없는 세기는 중) */
export function applyMotion(html, value = motion) {
    const v = tidy(value);
    if (motionPlain(v)) return html;
    let out = String(html ?? '');
    try {
        if (v.text !== 'm' || v.prop !== 'm') {
            const caps = levelCaps(out);
            const t = caps && v.text !== 'm' && caps.text[v.text] ? v.text : 'm', p = caps && v.prop !== 'm' && caps.prop[v.prop] ? v.prop : 'm';
            if (t !== 'm' || p !== 'm') out = applyLevel(out, { text: t, prop: p, key: keyOf(out) });
        }
    } catch { /* 세기는 건너뛰어요 */ }
    try { if (v.speed !== 'm' && !(v.text === '0' && v.prop === '0')) out = applySpeed(out, v.speed); } catch { /* 빠르기는 건너뛰어요 */ }
    if (v.open) out = applyOpen(out);
    return out;
}
