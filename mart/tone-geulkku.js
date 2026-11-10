// 11-10 글꾸 마트 「대사색 하나」 다시 칠하기 + 깡통에 붙일 꼴 — 사용자 「색감이개구려」 · 「지금 너무 글꾸 산만하달까 색많아서」 ·
//   「일단 내가 대사색깔지정해둔애들은 그 색깔바탕으로 글꾸해주면좋겠음」 · 「ai를 거치지않고도 쓸만했음좋것다」
//   색 규칙은 테마와 같은 계산(lib/log-copy/shared/char-tone.js — 블루레몬 logcopy-b-113 사본)이에요. B안: 무채 바탕 + 강조색은 대사색 하나 ·
//   대사는 글자가 아니라 대사 뒤 띠(.18) · 대사색 글자는 같은 색상에서 명도만 옮겨 대비 4.6.
//   컨셉의 장식 · 모양 · 분위기는 그대로 두고 색만 바꿔요:
//     ① 틀 색 묶음(colors · palette)의 역할 색은 역할대로(바탕 = 무채 면 · 본문 = 무채 · 이름 · 포인트 = 대사색 · 속마음 · 강조 = 본문 무채 …)
//     ② 그 밖에 틀에 박힌 색(장식 · 그림 속 색)은 「밝기 자리」를 새 바탕↔본문 사이로 옮기고, 채도 있는 색은 색상을 대사색 하나로 · 바탕 가까운 색은 무채로
//     ③ 따옴표로 시작하는 대사 조각은 대사 글자(무채) + 그 사람 색 띠로
//   깡통에 붙일 꼴(kkangtongReady): 인라인 url( 을 <style> 클래스 규칙으로(log-copy-lift.js pasteReady) + 모든 글자색에 -webkit-text-fill-color.
// DOM 없는 순수 모듈(node 로 시험 — tools/geulkku-tone.mjs).
import { tone, fitInk, bandColor, oklchOf, oklchHex, over, speakerColor, INK_TARGET } from './lib/log-copy/shared/char-tone.js';
import { parseColor, contrast } from './lib/log-copy/shared/ink-paint.js';
import { pasteReady } from './lib/log-copy/log-copy-lift.js';

export { tone, speakerColor };
export const FRAME_WIDTH = 640;   // 확정 규칙: 640 고정(메모리 log-post-layout-rules)
const TEXT_TARGET = 4.8;          // 틀에 박힌 글자의 대비 목표(덮임 문턱 4.5 · 규칙 4.6 에 겹친 바탕 차이 여유)
const NEAR_GREY = 0.035;         // 이보다 채도가 낮으면 무채로 봐요
const NEAR_BG = 0.16;             // 바탕과 밝기 자리가 이만큼 가까우면 무채 면으로(「무채 바탕」)
const QUOTE = /^[\s​]*(?:<[^>]+>\s*)*["“「『‘'«〈《]/;

const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
const hexOf = c => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;
const lightOf = value => { const c = parseColor(value); return c ? oklchOf(hexOf(c)).l : null; };

/** 이 틀의 바탕 · 본문 색(역할 묶음이 있으면 그 값, 없으면 HTML 에서 가장 많이 쓰인 바탕 · 글자색) */
function sourceInks(html, roles) {
    const bg = roles?.panel || roles?.surface || roles?.face || roles?.bg;
    const text = roles?.text || roles?.faceText;
    if (bg && text) return { bg, text };
    const count = (re) => { const m = new Map(); for (const x of html.matchAll(re)) { const c = parseColor(x[1]); if (c && c.a > 0.9) { const h = hexOf(c); m.set(h, (m.get(h) ?? 0) + 1); } } return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; };
    return { bg: bg || count(/background(?:-color)?\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi) || '#ffffff', text: text || count(/(?:^|[;"\s])color\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi) || '#222222' };
}

/**
 * 다시 칠하는 표(틀 하나 · 대사색 하나 · 낮/밤 하나에 한 번 만들어요)
 * @param {object|null} roles 틀 색 묶음(colors — 틈 템플릿 · palette — 내장 기본 틀) · 없으면 null
 * @param {string|null} K 주인공 대사색
 * @param {{ mode?: 'light'|'dark', plan?: 'A'|'B'|'C', html?: string }} options
 */
export function toneMap(roles, K, { mode = 'dark', plan = 'B', html = '' } = {}) {
    const t = tone(K, { mode, plan });
    const k = speakerColor(K), ko = k ? oklchOf(k) : null;
    const src = sourceInks(html, roles);
    const Lb = lightOf(src.bg) ?? 1, Lt = lightOf(src.text) ?? 0.2;
    const Lcard = oklchOf(t.card).l, Llog = oklchOf(t.log).l, Ltext = oklchOf(t.text).l;
    const span = Math.abs(Lt - Lb) < 0.2 ? (Lt < Lb ? -0.6 : 0.6) : Lt - Lb;
    /** 장식 · 그림 속 색 하나 → 새 색(알파는 그대로) */
    const shift = (value) => {
        const c = parseColor(value); if (!c) return null;
        const o = oklchOf(hexOf(c));
        const s = Math.max(-0.35, Math.min(1.35, (o.l - Lb) / span));
        const L = Math.max(0, Math.min(1, Lcard + s * (Ltext - Lcard)));
        let C = 0, H = o.h;
        if (o.c >= NEAR_GREY && Math.abs(s) > NEAR_BG) {
            if (plan === 'C' && ko) { C = Math.min(o.c, ko.c); H = ko.h; }
            else if (ko && ko.c >= NEAR_GREY) { C = Math.min(o.c, ko.c); H = ko.h; }
        } else if (plan === 'C' && ko) { C = Math.min(o.c * 0.3, ko.c * 0.3, 0.03); H = ko.h; }
        return { hex: oklchHex(L, C, H), a: c.a };
    };
    const pick = (value) => { const s = shift(value); return s?.hex ?? value; };
    // 역할 색(틈 템플릿 colors 이름 · 내장 palette 이름 둘 다)
    const out = {};
    const face = plan === 'C' ? t.card : Lb > 0.5 === (mode === 'light') ? t.card : t.card;
    const panelOf = name => (roles?.[name] ? pick(roles[name]) : t.log);
    const surface = { bg: t.card, face: t.card, panel: t.log, panel2: panelOf('panel2'), surface: t.log, raised: panelOf('raised'), chip: panelOf('chip') };
    const ink = (c, ...bgs) => bgs.reduce((x, b) => fitInk(x, b) ?? x, c);
    const accentInk = k ? ink(k, t.log, t.card) : t.text;
    const textInk = t.text;
    let dialogueInk = k ? ink(k, t.log, t.card) : t.dialogue;
    const bar = k ? oklchHex(Math.min(Math.max(ko.l, mode === 'dark' ? 0.6 : 0.5), mode === 'dark' ? 0.8 : 0.66), ko.c, ko.h) : (mode === 'dark' ? '#5c5e64' : '#b8b9be');
    const roleNew = {
        bg: surface.bg, face: surface.face, panel: surface.panel, panel2: surface.panel2, surface: surface.surface, raised: surface.raised, chip: surface.chip,
        text: textInk, faceText: textInk, thought: textInk, emphasis: textInk, chipText: null,
        faceMuted: null, muted: null, faint: null,
        name: accentInk, accent: accentInk, pop: accentInk, dialogue: dialogueInk,
        quoteBar: bar, deco1: bar, deco2: null, deco3: null,
        mark: over(bandColor(k, mode), t.log), marker: bandColor(k, mode),
        line: t.line, onAccent: null,
    };
    for (const [name, value] of Object.entries(roles ?? {})) {
        if (typeof value !== 'string') continue;
        let v = roleNew[name];
        if (v == null) {
            if (name === 'faceMuted' || name === 'muted' || name === 'faint') v = ink(pick(value), t.log, t.card);
            else if (name === 'chipText') v = ink(textInk, surface.chip);
            else if (name === 'onAccent') v = contrast('#ffffff', accentInk) >= contrast('#111113', accentInk) ? '#ffffff' : '#111113';
            else v = pick(value);
        }
        out[name] = v;
    }
    // 대사 글자와 이름표가 같은 값이면 대사 조각을 못 가려요 — 한 칸만 비켜요(눈에 같은 색)
    if (out.dialogue && out.name && out.dialogue === out.name) { const c = parseColor(out.dialogue); out.dialogue = hexOf({ r: c.r, g: c.g, b: c.b ^ 1 }); dialogueInk = out.dialogue; }
    // 옛 값 → 새 값(같은 값을 여러 역할이 쓰면 앞 역할이 이겨요 — 면 · 본문이 먼저)
    const exact = new Map();
    const order = ['bg', 'face', 'panel', 'surface', 'panel2', 'raised', 'chip', 'text', 'faceText', 'dialogue', 'name', 'accent', 'pop', 'faceMuted', 'muted', 'faint', 'thought', 'emphasis', 'chipText', 'quoteBar', 'deco1', 'deco2', 'deco3', 'mark', 'marker', 'line', 'onAccent'];
    for (const name of order) {
        const from = roles?.[name]; if (typeof from !== 'string' || !out[name]) continue;
        const c = parseColor(from); if (!c) continue;
        const key = `${hexOf(c)}|${c.a.toFixed(3)}`;
        if (!exact.has(key)) exact.set(key, out[name]);
    }
    const dialogueFrom = roles?.dialogue ? hexOf(parseColor(roles.dialogue)) : null;
    return { t, K: k, mode, plan, roles: out, exact, shift, dialogueFrom, dialogueInk, accentInk, textInk };
}

const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d[^)]*\)/g;
const SVG_HEX = /%23([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const fmt = (hex, a) => (a >= 0.999 ? hex : `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${Math.round(a * 1000) / 1000})`);

/** 색 하나 바꾸기(역할 값이면 역할대로 · 아니면 밝기 자리 옮기기) */
function mapColor(map, value) {
    const c = parseColor(value); if (!c) return value;
    const key = `${hexOf(c)}|${c.a.toFixed(3)}`;
    const hit = map.exact.get(key);
    if (hit) { const h = parseColor(hit); return h.a < 0.999 ? hit : fmt(hexOf(h), c.a); }
    const solid = map.exact.get(`${hexOf(c)}|1.000`);
    if (solid && c.a < 0.999) { const h = parseColor(solid); return fmt(hexOf(h), c.a); }
    const s = map.shift(value); return s ? fmt(s.hex, c.a) : value;
}

/** 인라인 style 하나 다시 칠하기 — 글자색은 그 자리 바탕(같은 style 의 바탕 또는 틀 면 · 로그 면) 대비 4.6 까지 */
function toneStyle(map, css, ctxBg) {
    const decls = css.split(/;(?![^(]*\))/);
    let bgHere = null;
    const outDecls = decls.map((d) => {
        const at = d.indexOf(':'); if (at < 0) return d;
        const prop = d.slice(0, at).trim().toLowerCase(); let val = d.slice(at + 1);
        if (/url\(/i.test(val)) {   // 그림(svg data) 안의 색도 같은 표로
            val = val.replace(SVG_HEX, (all, h) => { const m = mapColor(map, `#${h}`); const p = parseColor(m); return p ? `%23${hexOf(p).slice(1)}` : all; });
            val = val.replace(/(url\([^)]*\))|#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d[^)]*\)/g, (m, u) => (u ? u : mapColor(map, m)));
        } else val = val.replace(COLOR_RE, m => mapColor(map, m));
        return `${d.slice(0, at)}:${val}`;
    });
    const info = {};
    bgHere = bgOfStyle(outDecls.join(';'), ctxBg[0], info);
    // 가운데 밝기 단색 바탕(회색 알약 · 진한 하늘 띠)은 검정도 흰색도 4.8 이 안 돼요 — 바탕 명도를 한쪽으로 조금 옮겨요
    if (bgHere && !info.grad && Math.max(contrast('#111113', bgHere), contrast('#f5f5f7', bgHere)) < TEXT_TARGET + 0.2) {
        const next = contrast('#111113', bgHere) >= contrast('#f5f5f7', bgHere) ? fitInk(bgHere, '#111113', TEXT_TARGET + 0.2) : fitInk(bgHere, '#f5f5f7', TEXT_TARGET + 0.2);
        if (next && next !== bgHere) {
            const from = bgHere;
            for (let i = 0; i < outDecls.length; i++) if (/^\s*background(?:-color)?\s*:/i.test(outDecls[i])) outDecls[i] = outDecls[i].replace(COLOR_RE, m => { const c = parseColor(m); return c && (hexOf(c) === from || (c.a < 0.85 && over(m, ctxBg[0]) === from)) ? next : m; });   // 반투명 면은 섞은 색 그대로 불투명으로
            bgHere = next;
        }
    }
    // 글자색 대비
    return outDecls.map((d) => {
        const at = d.indexOf(':'); if (at < 0) return d;
        const prop = d.slice(0, at).trim().toLowerCase();
        if (prop !== 'color' && prop !== '-webkit-text-fill-color') return d;
        const c = parseColor(d.slice(at + 1).trim()); if (!c || c.a < 0.5) return d;
        const bgs = bgHere ? [bgHere] : ctxBg;
        let h = hexOf(c);
        for (const b of bgs) h = fitInk(h, b, TEXT_TARGET) ?? h;
        // 명도만 옮겨선 안 되면: 거의 검정 · 거의 흰색 중 더 또렷한 쪽
        if (bgs.some(b => contrast(h, b) < TEXT_TARGET)) h = ['#111113', '#f5f5f7'].sort((x, y) => Math.min(...bgs.map(b => contrast(y, b))) - Math.min(...bgs.map(b => contrast(x, b))))[0];
        return `${d.slice(0, at)}:${h}`;
    }).join(';');
}

const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'wbr', 'source', 'col', 'area', 'base', 'link', 'track', 'embed', 'param']);
/** 그 style 의 불투명 바탕색(단색 · 그라데이션은 색들의 평균) — 없으면 null */
function bgOfStyle(css, under = null, info = {}) {
    const m = css.match(/(?:^|;)\s*background(?:-color|-image)?\s*:\s*([^;]+)/gi); if (!m) return null;
    let solid = null, grad = null;
    // 반투명 면(rgba .3~.85)은 바깥 바탕에 섞은 색으로 봐요
    const solidOf = (text) => { const c = parseColor(text); if (!c) return null; if (c.a > 0.85) return hexOf(c); return c.a >= 0.3 && under ? over(text, under) : null; };
    for (const d of m) {
        const prop = d.slice(0, d.indexOf(':')).replace(/^[;\s]+/, '').toLowerCase(), v = d.slice(d.indexOf(':') + 1);
        if (prop === 'background-color') { const s = solidOf(v.trim()); if (s) solid = s; continue; }
        if (/url\(/i.test(v) && !/gradient/i.test(v)) continue;
        if (prop === 'background' && !/gradient/i.test(v)) { const t0 = (v.trim().match(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))/) || [])[1]; const s = t0 && solidOf(t0); if (s) { solid = s; grad = null; } continue; }
        if (/transparent|rgba\([^)]*,\s*0(?:\.\d+)?\)/i.test(v)) continue;   // 비치는 무늬(줄 · 점)는 바탕이 아니에요 — 밑의 단색이 바탕
        const cs = (v.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || []).map(parseColor).filter(c => c && c.a > 0.85);
        if (cs.length) grad = hexOf({ r: cs.reduce((s, c) => s + c.r, 0) / cs.length, g: cs.reduce((s, c) => s + c.g, 0) / cs.length, b: cs.reduce((s, c) => s + c.b, 0) / cs.length });
    }
    info.grad = !!grad;
    return grad || solid;
}
/** HTML 의 여는 태그 style 마다 fn(css, 바깥 바탕색 쌓기)를 불러 바꿔요(<style> · <script> 안은 건너뛰어요) */
function walkStyles(html, fn, base = null) {
    const stack = [];   // { tag, bg }
    return html.replace(/<style>[\s\S]*?<\/style>|<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g, (all, close, open, attrs) => {
        if (close) {
            const name = close.toLowerCase();
            for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === name) { stack.length = i; break; }
            return all;
        }
        if (!open) return all;
        const name = open.toLowerCase();
        let bg = null;
        const next = attrs.replace(/(\sstyle=")([^"]*)(")/i, (x, a, css, b) => {
            const plain = css.replace(/&quot;/g, '"');
            const bgs = stack.map(s => s.bg).filter(Boolean);
            const out = fn(plain, bgs);
            bg = bgOfStyle(out, bgs[bgs.length - 1] || base);
            return a + out.replace(/"/g, '&quot;') + b;
        });
        if (!VOID.has(name) && !/\/\s*$/.test(attrs)) stack.push({ tag: name, bg });
        return `<${open}${next}>`;
    });
}

/** 대사 조각(따옴표로 시작하는 색 글자 · 옛 대사 역할 색) → 대사 글자 + 띠 */
function bandify(map, html) {
    const band = (who) => { const c = bandColor(who, map.mode); return `background-image:linear-gradient(transparent 5%, ${c} 5%, ${c} 100%, transparent 100%)`; };
    return html.replace(/<(span|q|em|i|b|strong)\b([^>]*?)\sstyle="([^"]*)"([^>]*)>/gi, (all, tagName, pre, css, post, offset, whole) => {
        const m = css.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i); if (!m) return all;
        const c = parseColor(m[1].trim()); if (!c) return all;
        const h = hexOf(c);
        const own = (map.dialogueFrom && h === map.dialogueFrom) || h === map.dialogueInk;   // 틀의 대사 역할 색(다시 칠하기 전 · 뒤)
        const lead = whole.slice(offset + all.length, offset + all.length + 40);
        const quoted = QUOTE.test(lead) || /^\s*(?:&quot;|&#39;|&#x27;)/.test(lead);
        if (!quoted || !(own || oklchOf(h).c >= 0.06) || /background-image\s*:\s*linear-gradient/i.test(css)) return all;
        const who = own ? map.K : h;
        const next = css.replace(/(^|;)\s*color\s*:\s*[^;]+/i, `$1color:${map.t.dialogue}`).replace(/;?\s*$/, '') + `;${band(who)}`;
        return `<${tagName}${pre} style="${next}"${post}>`;
    });
}

/**
 * 11-10 장식 줄이기 — 사용자 「아근데 다른 디자인은좀심란하다」 · 기준은 161057 의 차분함.
 *  떠 있는 꾸밈(aria-hidden + position:absolute — 큰 원 · 빛 · 말풍선 점 · 종 · 빈 덩어리)을 지우고, 작은 것(64px 이하) 하나만 남겨요.
 *  꾸밈을 담는 덮개 층(가득 찬 absolute · inset 0)은 두고 그 안에서 골라요. 글이 든 요소는 지우지 않아요.
 * @returns {{ html: string, removed: number, kept: number }}
 */
export function calmHtml(html, { keep = 1 } = {}) {
    const src = String(html ?? '');
    const re = /<style>[\s\S]*?<\/style>|<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>|<([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
    const px = (css, k) => { const x = css.match(new RegExp(`(?:^|;)\\s*${k}\\s*:\\s*(-?[\\d.]+)px`, 'i')); return x ? Number(x[1]) : null; };
    // 1차: 떠 있는 꾸밈 후보(덮개 층 바로 안 · 다른 후보 안이 아닌 것)를 모아요
    const cands = [], stack = [];
    let m;
    while ((m = re.exec(src))) {
        const [all, close, open, attrs] = m;
        if (close) {
            const name = close.toLowerCase();
            for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === name) { const top = stack[i]; stack.length = i; if (top.cand) { top.cand.end = m.index + all.length; } if (stack.length) stack[stack.length - 1].kids = (stack[stack.length - 1].kids || 0) + 1 + (top.kids || 0); break; }
            continue;
        }
        if (!open) continue;
        const name = open.toLowerCase();
        const css = ((attrs.match(/\sstyle="([^"]*)"/) || [])[1] || '').replace(/&quot;/g, '"');
        if (VOID.has(name) || /\/\s*$/.test(attrs)) { if (stack.length) stack[stack.length - 1].kids = (stack[stack.length - 1].kids || 0) + 1; continue; }
        const inCand = stack.some(s => s.cand);
        let cand = null;
        if (!inCand && /\saria-hidden="true"/.test(attrs) && /position\s*:\s*absolute/i.test(css)) {
            const cover = /(?:^|;)\s*left\s*:\s*0(?:px)?\s*(?:;|$)/i.test(css) && /(?:^|;)\s*right\s*:\s*0(?:px)?\s*(?:;|$)/i.test(css) && /(?:^|;)\s*top\s*:\s*0/i.test(css) && /(?:^|;)\s*bottom\s*:\s*0/i.test(css);
            if (!cover) {
                const w = px(css, 'width'), h = px(css, 'height');
                cand = { start: m.index, end: -1, w, h, css, image: /url\(|class=/.test(attrs) || /url\(/.test(css), round: /border-radius\s*:\s*(50%|9{2,}px)/i.test(css) };
                cands.push(cand);
            }
        }
        stack.push({ tag: name, cand, kids: 0 });
    }
    // 2차: 고르기 — 그림 없는 둥근 덩어리 · 빛 번짐(큰 원 · 빈 회색 덩어리)은 늘 빼요. 나머지 가운데 가장 큰 그림(컨셉 상징 — 호박 · 파라솔 · 그릇 · 종) 하나 + 작은 것 하나(keep 이 2 일 때)
    for (const c of cands) {
        const html = c.end > 0 ? src.slice(c.start, c.end) : '';
        c.hasChild = /<(?:div|span|svg|img|i|b)\b/i.test(html.slice(html.indexOf('>') + 1));
        c.blob = !c.image && !c.hasChild && (c.round || /gradient/i.test(c.css) || (c.w ?? 0) >= 120);
        c.area = (c.w ?? 40) * (c.h ?? 40);
    }
    const pool = cands.filter(c => c.end > 0 && !c.blob && (c.w ?? 0) <= 320 && (c.h ?? 0) <= 320);
    const keepSet = new Set();
    const motif = pool.filter(c => c.image || c.hasChild).sort((a, b) => b.area - a.area)[0];
    if (motif && keep >= 1) keepSet.add(motif);
    if (keep >= 2) { const small = pool.filter(c => !keepSet.has(c) && c.area <= 64 * 64)[0]; if (small) keepSet.add(small); }
    const cut = cands.filter(c => c.end > 0 && !keepSet.has(c)).map(c => [c.start, c.end]);
    const kept = keepSet.size;
    if (!cut.length) return { html: src, removed: 0, kept };
    cut.sort((a, b) => a[0] - b[0]);
    let out = '', at = 0;
    for (const [s, e] of cut) { if (s < at) continue; out += src.slice(at, s); at = e; }
    out += src.slice(at);
    // 지운 꾸밈 안에 글이 있었으면(꾸밈 글) 지우지 말아야 했어요 — 이 함수는 aria-hidden 만 지우니 화면 읽기 글은 그대로예요
    return { html: out, removed: cut.length, kept };
}

/** 바깥 틀 폭을 640 으로(맨 앞 요소의 max-width 만) */
function widen(html) {
    return html.replace(/^(\s*(?:<!--[\s\S]*?-->\s*)*(?:<style>[\s\S]*?<\/style>\s*)*(?:<!--[\s\S]*?-->\s*)*<[a-z]+\b[^>]*?style="[^"]*?)max-width\s*:\s*\d+px/i, `$1max-width:${FRAME_WIDTH}px`);
}

/**
 * 다 그린 글꾸 HTML(또는 틈 템플릿 글)을 대사색 하나로 다시 칠해요.
 * @param {string} html
 * @param {object|null} roles 틀 색 묶음(colors · palette)
 * @param {string|null} K 주인공 대사색
 * @param {{ mode?: 'light'|'dark', plan?: 'A'|'B'|'C', width?: boolean, band?: boolean }} [options]
 */
export function toneHtml(html, roles, K, { mode = 'dark', plan = 'B', width = true, band = true } = {}) {
    const src = String(html ?? '');
    const map = toneMap(roles, K, { mode, plan, html: src });
    const ctx = [map.t.card, map.t.log];
    let out = src.replace(/(<style>)([\s\S]*?)(<\/style>)/gi, (all, a, body, b) => a + body.replace(SVG_HEX, (x, h) => { const p = parseColor(mapColor(map, `#${h}`)); return p ? `%23${hexOf(p).slice(1)}` : x; }).replace(/(url\([^)]*\))|#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*\d[^)]*\)/g, (m, u) => (u ? u : mapColor(map, m))) + b);
    // 바깥 바탕이 틀 면 · 로그 면 근처면 둘 다에 맞춰요(어느 면 위에 놓일지 틀마다 달라요)
    const near = b => ctx.some(c => contrast(b, c) < 1.25);
    out = walkStyles(out, (css, bgs) => { const b = bgs[bgs.length - 1]; return toneStyle(map, css, !b ? ctx : near(b) ? [b, ...ctx] : [b]); }, map.t.card);
    out = out.replace(/\s(fill|stroke|stop-color)="(#[0-9a-fA-F]{3,8})"/g, (all, a, v) => ` ${a}="${mapColor(map, v)}"`);
    if (band) out = bandify(map, out);
    if (width) out = widen(out);
    return out;
}

/**
 * 11-10 비교안 (가) — 컨셉 원래 색 조합은 살리고, 탁한 색(채도 낮은 가운데 밝기)만 무채 쪽으로 · 대비 낮은 글자만 4.8 까지.
 *  캐릭터 색은 대사 띠(.18)와 이름표에만 써요.
 */
export function keepHtml(html, roles, K, { width = true } = {}) {
    const src = String(html ?? '');
    const k = speakerColor(K);
    const bg = roles?.panel || roles?.surface || roles?.bg || sourceInks(src, roles).bg;
    const text = roles?.text || sourceInks(src, roles).text;
    const light = (lightOf(bg) ?? 1) > 0.6;
    const name = roles?.name && k ? fitInk(k, bg, TEXT_TARGET) : null;
    const nameFrom = roles?.name ? hexOf(parseColor(roles.name)) : null;
    const tidy = (value) => {
        const c = parseColor(value); if (!c) return value;
        const h = hexOf(c);
        if (name && h === nameFrom) return fmt(name, c.a);
        const o = oklchOf(h);
        if (o.c >= 0.03 && o.c < 0.09 && o.l > 0.3 && o.l < 0.6) return fmt(oklchHex(o.l, 0.1, o.h), c.a);   // 탁한 색(채도 낮은 가운데 밝기) → 같은 색상에서 맑게(무채로 빼면 컨셉 분위기가 사라져요)
        return value;
    };
    const map = { exact: new Map(), shift: v => { const t = tidy(v); const p = parseColor(t); return p ? { hex: hexOf(p), a: p.a } : null; }, K: k, mode: light ? 'light' : 'dark', dialogueFrom: roles?.dialogue ? hexOf(parseColor(roles.dialogue)) : null, dialogueInk: null, t: { dialogue: text } };
    const ctx = [bg];
    let out = walkStyles(src, (css, bgs) => toneStyle(map, css, bgs.length ? [bgs[bgs.length - 1]] : ctx), bg);
    out = bandify(map, out);
    if (width) out = widen(out);
    return out;
}

/** 표본 글의 틀 속 이름(실리태번 기본 캐릭터) → 일반 낱말 — 공개 글에 사람 이름이 남지 않게 */
export const plainSample = html => String(html ?? '').replace(/세라피나 님/g, '상대').replace(/세라피나|Seraphina/g, '상대');

/** 틈 템플릿 글꾸 하나를 다시 칠한 새 항목(테마용 복사 · 담기 · 시식이 같이 써요) — template · colors · preview 를 바꿔요 */
export function toneItem(item, K, { mode = 'dark', plan = 'B' } = {}) {
    if (!item) return item;
    const roles = item.colors || item.palette || null;
    const map = toneMap(roles, K, { mode, plan, html: item.template || item.preview || '' });
    const next = { ...item, tone: { K: map.K, mode, plan } };
    if (item.colors) next.colors = { ...item.colors, ...map.roles };
    if (item.palette) next.palette = { ...item.palette, ...map.roles };
    if (item.template) next.template = toneHtml(item.template, roles, K, { mode, plan, band: false });
    if (item.preview) next.preview = toneHtml(item.preview, roles, K, { mode, plan });
    return next;
}

/** 인라인 style 의 color 옆에 -webkit-text-fill-color 를 같은 값으로(이미 있으면 그 값으로 맞춰요) */
export function fillInks(html) {
    return String(html ?? '').replace(/ style="([^"]*)"/g, (all, css) => {
        const m = css.match(/(?:^|;)\s*color\s*:\s*([^;"]+)/i); if (!m) return all;
        const value = m[1].trim().replace(/\s*!important$/i, '');
        const rest = css.replace(/;?\s*-webkit-text-fill-color\s*:[^;]*/gi, '');
        return ` style="${rest.replace(/;?\s*$/, '')};-webkit-text-fill-color:${value}"`;
    });
}

/** 깡통 글쓰기 HTML 칸에 붙일 꼴: 인라인 url( → <style> 클래스 규칙(테마 pasteReady) + 글자색마다 fill */
export function kkangtongReady(html) {
    const text = String(html ?? '');
    if (!text.trim()) return text;
    return pasteReady(fillInks(text));
}

/**
 * 붙여 넣은 채팅 HTML(실리태번 화면에서 복사 — 대사는 <span style="color:#3aa7ff">「…」</span> 처럼 인라인 색이에요)에서 대사색을 읽어요.
 * 따옴표로 시작하는 색 글자만 세요. 많이 쓰인 차례 [{ color, count }]
 */
export function dialogueColors(html) {
    const counts = new Map();
    const text = String(html ?? '');
    for (const m of text.matchAll(/<(span|font|q|em|i|b|strong)\b([^>]*)>(?=([\s\S]{0,60}))/gi)) {   // 뒤 글은 엿보기만(다음 태그를 먹지 않게)
        const attrs = m[2];
        const css = (attrs.match(/\sstyle\s*=\s*"([^"]*)"/i) || attrs.match(/\sstyle\s*=\s*'([^']*)'/i) || [])[1] || '';
        const raw = (css.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i) || [])[1] || (attrs.match(/\scolor\s*=\s*["']?([#a-z0-9(),.\s]+?)["'\s>]/i) || [])[1];
        if (!raw) continue;
        if (!QUOTE.test(m[3]) && !/^\s*(?:&quot;|&#39;|&ldquo;)/.test(m[3])) continue;
        const c = speakerColor(raw.trim().replace(/\s*!important$/i, ''));
        if (!c) continue;   // 거의 회색인 대사색도 그 사람 색이라 그대로 세요
        counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([color, count]) => ({ color, count }));
}

/** 붙일 꼴 점검(복사 직전 · 검사 도구): 인라인 url( · fill 없는 글자색 · 640 넘는 고정 폭 */
export function readyReport(html) {
    const text = String(html ?? '');
    let inlineUrl = 0, noFill = 0;
    for (const m of text.matchAll(/ style="([^"]*)"/g)) {
        if (/url\(/i.test(m[1])) inlineUrl++;
        if (/(?:^|;)\s*color\s*:/i.test(m[1]) && !/-webkit-text-fill-color/i.test(m[1])) noFill++;
    }
    return { inlineUrl, noFill, ok: inlineUrl === 0 && noFill === 0 };
}
