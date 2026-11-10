// 원본 블루레몬 codex/tone-ladder-113 분기(4564922f)의 src/shared/char-tone.js 를 2026-11-11 에 그대로 복사한 것이에요(앞 사본 logcopy-b-113 판 + 톤 사다리 toneLadder · LADDER_SLOTS · ladderSlots — 기존 함수는 한 글자도 안 바뀌었고 주석만 원본을 따라요) · 고치지 말고 다시 복사해요(글꾸 마트가 테마 로그 복사와 같은 색 규칙 · 붙여 넣을 꼴을 쓰려고)
// 1.1.3 글꾸 색 규칙 — 캐릭터 대사색 하나(K)에서 틀 색 전부를 뽑아요. 로그 복사(log-copy-*)와 글꾸 마트가 같이 써요.
//   사용자가 캐릭터마다 정해 둔 대사색을 틀 색의 바탕으로 쓰고, 한 틀에 쓰는 색 수를 줄여요(B안이 기본).
//   - 무채 바탕 + 강조색은 대사색 하나. 대사색은 글자가 아니라 대사 뒤 띠(틴트 .18)에 써요.
//   - 글자에 대사색을 쓸 때는 같은 색상 · 채도에서 명도만 옮겨 그 바탕 대비 4.6 이상(커뮤니티 글 화면은 대비 4.5 미만 글자색을 덮어요).
//   - plan 'A' 무채 + 띠만 · 'B' 무채 + 이름표 · 제목 밑줄만 대사색(기본 「깡통 로그」) · 'C' 대사색으로 물든 바탕(「진한 바탕」).
//   - 레몬: 노랑 #FFE23C(테두리 #E9BE00) 기본, 진한 색 바탕(C 밤)일 때만 대표색.
// DOM 없는 순수 모듈(시험 tools/tests/char-tone.mjs).
import { parseColor, contrast } from './ink-paint.js';

export const TONE_PLANS = ['A', 'B', 'C'];
export const TONE_MODES = ['light', 'dark'];
export const INK_TARGET = 4.6;           // 글자 대비 목표(덮임 문턱 4.5 에 여유)
export const BAND_ALPHA = 0.18;          // 대사 띠 틴트
export const LEMON_YELLOW = Object.freeze({ fill: '#FFE23C', stroke: '#E9BE00' });
const GREY_CHROMA = 0.04;                // 이보다 채도가 낮으면 회색 계열(옅은 회청색 대사색 같은 것)

// 무채 바탕(밤 · 낮)
const NEUTRAL = Object.freeze({
    dark: Object.freeze({ card: '#25272b', log: '#1c1e21', line: 'rgba(224, 224, 228, 0.09)', text: '#e1e1e5', dialogue: '#f5f5f7' }),
    light: Object.freeze({ card: '#ffffff', log: '#f5f5f6', line: 'rgba(20, 20, 24, 0.08)', text: '#26272b', dialogue: '#111113' }),
});

// ── OKLCH ─────────────────────────────────────────────────────
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const delin = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
const toHex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

/** '#rrggbb' · rgb() 글 → { l, c, h } (OKLCH) | null */
export function oklchOf(value) {
    const p = typeof value === 'string' ? parseColor(value) : value;
    if (!p) return null;
    const [r, g, b] = [p.r, p.g, p.b].map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    let h = Math.atan2(B, A) * 180 / Math.PI; if (h < 0) h += 360;
    return { l: L, c: Math.hypot(A, B), h };
}
function rawRgb(L, C, H) {
    const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
/** OKLCH → '#rrggbb' (색역 밖이면 채도를 줄여 맞춰요) */
export function oklchHex(L, C, H) {
    let c = Math.max(0, C);
    const l = Math.min(1, Math.max(0, L));
    for (let i = 0; i < 60; i++) {
        const rgb = rawRgb(l, c, H);
        if (rgb.every(v => v >= -0.0005 && v <= 1.0005)) return toHex(...rgb.map(delin));
        c *= 0.94;
    }
    return toHex(...rawRgb(l, 0, H).map(delin));
}

/** 같은 색상 · 채도에서 명도만 옮겨 bg 대비 target 이상이 되는 첫 색(이미 되면 그대로 · 소문자 #rrggbb) */
export function fitInk(color, bg, target = INK_TARGET) {
    const p = parseColor(color), back = parseColor(bg);
    if (!p || !back) return null;
    const hex = toHex(p.r, p.g, p.b);
    if (contrast(hex, back) >= target) return hex;
    const o = oklchOf(hex), darkBg = luminance(back) < 0.18;
    for (let i = 1; i <= 100; i++) {
        const L = darkBg ? o.l + i * 0.01 : o.l - i * 0.01;
        if (L < 0 || L > 1) break;
        const out = oklchHex(L, o.c, o.h);
        if (contrast(out, back) >= target) return out;
    }
    return darkBg ? '#f5f5f7' : '#111113';
}
function luminance({ r, g, b }) { return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
const rgba = (hex, a) => { const p = parseColor(hex); return `rgba(${p.r}, ${p.g}, ${p.b}, ${a})`; };
/** 반투명 over 를 불투명 under 위에 섞은 '#rrggbb' */
export function over(top, under) {
    const t = parseColor(top), u = parseColor(under);
    if (!t || !u) return null;
    const a = Math.min(1, Math.max(0, t.a));
    return toHex(t.r * a + u.r * (1 - a), t.g * a + u.g * (1 - a), t.b * a + u.b * (1 - a));
}

/** 대사색을 쓸 수 있는 색으로(#rrggbb 이고 거의 투명이 아닌 것) — 아니면 null */
export function speakerColor(value) {
    const p = parseColor(value);
    return p && p.a >= 0.5 ? toHex(p.r, p.g, p.b) : null;
}

/** 대사 띠 색(rgba): K 의 색상 · 채도 그대로, 띠로 보일 명도로 끼우고 알파 .18 (회색 계열은 조금 옅게) · K 없음 = 무채 띠 */
export function bandColor(K, mode = 'dark') {
    const dark = mode === 'dark', k = speakerColor(K);
    if (!k) return dark ? 'rgba(225, 225, 229, 0.14)' : 'rgba(17, 17, 17, 0.1)';
    const o = oklchOf(k), grey = o.c < GREY_CHROMA;
    const l = dark ? Math.min(Math.max(o.l, 0.6), 0.82) : Math.min(Math.max(o.l, 0.55), 0.72);
    return rgba(oklchHex(l, o.c, o.h), grey ? (dark ? 0.16 : 0.14) : BAND_ALPHA);
}

/**
 * 틀 역할 색 전부.
 * @param {string|null} K 주인공 대사색(없으면 무채 기본)
 * @param {{ mode?: 'light'|'dark', plan?: 'A'|'B'|'C' }} [options]
 * @returns {{ plan, mode, card, log, line, text, dialogue, band, name, title, rule, lemon: { fill, stroke } }}
 *   card 틀 면 · log 로그 면 · line 테두리 · text 본문(제목 글자도) · dialogue 대사 글자 · band 대사 띠 · name 이름표 글자 ·
 *   title 제목 글자 · rule 제목 밑 2px 줄(없으면 null) · lemon 레몬 칠
 */
export function tone(K, { mode = 'dark', plan = 'B' } = {}) {
    const m = mode === 'light' ? 'light' : 'dark', p = TONE_PLANS.includes(plan) ? plan : 'B', dark = m === 'dark';
    const k = speakerColor(K);
    if (p !== 'C' || !k) {
        const n = NEUTRAL[m];
        const out = { plan: p, mode: m, ...n, band: bandColor(k, m), name: n.text, title: n.text, rule: null, lemon: { ...LEMON_YELLOW } };
        if (p === 'B' && k) { out.name = fitInk(k, n.log); out.rule = fitInk(k, n.card); }
        return Object.freeze(out);
    }
    const o = oklchOf(k), cap = (x, max) => Math.min(o.c * x, max);
    const base = dark
        ? { card: oklchHex(0.255, cap(0.42, 0.065), o.h), log: oklchHex(0.205, cap(0.36, 0.055), o.h), text: oklchHex(0.925, cap(0.06, 0.012), o.h), dialogue: oklchHex(0.975, cap(0.03, 0.008), o.h) }
        : { card: oklchHex(0.982, cap(0.16, 0.022), o.h), log: oklchHex(0.955, cap(0.26, 0.035), o.h), text: oklchHex(0.29, cap(0.22, 0.035), o.h), dialogue: oklchHex(0.2, cap(0.18, 0.03), o.h) };
    const line = rgba(oklchHex(dark ? 0.7 : 0.55, o.c, o.h), dark ? 0.22 : 0.2);
    let lemon = { ...LEMON_YELLOW };
    if (dark && o.c >= GREY_CHROMA) {
        const fill = fitInk(oklchHex(0.8, o.c, o.h), base.card, 3), f = parseColor(fill);
        lemon = { fill: fill.toUpperCase(), stroke: toHex(f.r * 0.75, f.g * 0.75, f.b * 0.75).toUpperCase() };
    }
    return Object.freeze({ plan: p, mode: m, ...base, line, band: bandColor(k, m), name: fitInk(k, base.log), title: fitInk(k, base.card), rule: null, lemon });
}

// ── 톤 사다리 ─────────────────────────────────────────────────
// 소품 · 포인트 자리에 쓰는 다섯 단계. 대사색 K 를 가운데(c500)로 두고 같은 색상에서 채도 · 명도만 옮겨요.
//   식은 HSL(시안에서 확정한 두 색의 값을 그대로 지키려고 — OKLCH 고정 색상으로는 진한 분홍 단계가 채널 12 만큼 어긋나요):
//   c100 채도×0.80 · 명도+(1−명도)×0.85 / c300 채도×0.95 · 명도+(1−명도)×0.45 / c500 = K / c700 채도×0.85 · 명도×0.62 / c900 채도×0.70 · 명도×0.34
//   그 뒤 OKLCH 명도로 밝기 순을 지키고, 이웃 단계가 LADDER_GAP 보다 붙으면 그 단계의 HSL 명도만 바깥쪽으로 더 옮겨요
//   (위 · 아래 여유가 모자라면 남은 여유의 1/3 씩). 이름 글자는 fitInk · 대사 띠는 bandColor 가 정본이고 사다리를 쓰지 않아요.
export const LADDER_STEPS = Object.freeze(['c100', 'c300', 'c500', 'c700', 'c900']);
export const LADDER_GAP = 0.04;          // 이웃 단계 사이 최소 OKLCH 명도 차
export const NEUTRAL_LADDER = Object.freeze({ c100: '#f1f1f3', c300: '#c9cacf', c500: '#8b8e96', c700: '#4c4e55', c900: '#26272b' });
const LADDER_RULE = Object.freeze({
    c100: { sat: 0.8, up: 0.85 }, c300: { sat: 0.95, up: 0.45 },
    c700: { sat: 0.85, down: 0.62 }, c900: { sat: 0.7, down: 0.34 },
});

function hslOf({ r, g, b }) {
    const [x, y, z] = [r, g, b].map(v => v / 255), mx = Math.max(x, y, z), mn = Math.min(x, y, z), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return { h: 0, s: 0, l };
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === x ? (y - z) / d + (y < z ? 6 : 0) : mx === y ? (z - x) / d + 2 : (x - y) / d + 4;
    return { h: h * 60, s, l };
}
function hslHex(h, s, l) {
    const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return toHex(f(0), f(8), f(4));
}
// HSL 명도만 0.005씩 옮겨 OKLCH 명도가 want 이상(up) / 이하가 되는 첫 색
function nudgeLadder(h, s, l, want, up) {
    let hex = hslHex(h, s, l);
    for (let i = 0; i < 200 && (up ? oklchOf(hex).l < want : oklchOf(hex).l > want); i++) {
        l = up ? Math.min(1, l + 0.005) : Math.max(0, l - 0.005);
        hex = hslHex(h, s, l);
        if (l === 0 || l === 1) break;
    }
    return hex;
}

/**
 * 대사색 K 의 톤 사다리(낮 · 밤 같은 값 — 어느 자리에 어느 단계를 쓰는지는 LADDER_SLOTS).
 * K 가 없거나 잘못된 값 · 거의 투명 · 회색 계열(OKLCH 채도 < 0.04)이면 무채 사다리.
 * @returns {{ c100, c300, c500, c700, c900 }} 소문자 '#rrggbb' · 얼린 객체
 */
export function toneLadder(K) {
    const k = speakerColor(K);
    if (!k || oklchOf(k).c < GREY_CHROMA) return NEUTRAL_LADDER;
    const { h, s, l } = hslOf(parseColor(k)), mid = oklchOf(k).l;
    const raw = step => {
        const rule = LADDER_RULE[step];
        return { s: s * rule.sat, l: rule.up ? l + (1 - l) * rule.up : l * rule.down };
    };
    const upGap = Math.min(LADDER_GAP, (1 - mid) / 3), downGap = Math.min(LADDER_GAP, mid / 3);
    const at = (step, want, up) => { const r = raw(step); return nudgeLadder(h, r.s, r.l, want, up); };
    const c300 = at('c300', mid + upGap, true);
    const c100 = at('c100', oklchOf(c300).l + upGap, true);
    const c700 = at('c700', mid - downGap, false);
    const c900 = at('c900', oklchOf(c700).l - downGap, false);
    return Object.freeze({ c100, c300, c500: k, c700, c900 });
}

// 심플 틀 자리 → 단계(시안 2-3절 표 그대로). 틀 번호 → 밝기 → 자리 이름 → 단계. null = 그 판은 사다리를 안 써요(틀이 가진 고정값).
//   01 은 이름 · 밑줄 맞춤(fitInk)만 쓰고 소품 톤이 없어서 표에 없어요.
const slots = o => Object.freeze(o);
export const LADDER_SLOTS = Object.freeze({
    '02': Object.freeze({
        light: slots({ face: 'c100', innerLine: 'c300', dots: 'c300', back: 'c300', rim: 'c500', topBand: 'c700' }),
        dark: slots({ face: 'c900', rim: 'c500', topBand: 'c300', innerLine: 'c700', dots: 'c700', back: 'c700' }),
    }),
    '03': Object.freeze({
        light: slots({ marginLine: 'c300', arrow: 'c500', spine: 'c700', underline: 'c700' }),
        dark: slots({ spine: 'c500', marginLine: 'c700', underline: 'c300', arrow: 'c500' }),
    }),
    '04': Object.freeze({
        light: slots({ rulerBase: 'c300', cursor: 'c500', tick5: 'c500', triangle: 'c700' }),
        dark: slots({ cursor: 'c500', tick5: 'c500', triangle: 'c300', rulerBase: 'c700' }),
    }),
    '05': Object.freeze({
        light: slots({ clearWater: 'c100', tagFace: 'c100', saucerShadow: 'c100', sparkle: 'c300', steam: 'c300', tea: 'c500', teabag: 'c700', tagRim: 'c700' }),
        dark: slots({ tea: 'c500', sparkle: 'c300', steam: 'c300', tagRim: 'c300', teabag: 'c700', clearWater: 'c900', tagFace: 'c900' }),
    }),
    '06': Object.freeze({
        light: slots({ filledBar: 'c700', restBar: 'c300', recDot: 'c500' }),
        dark: slots({ filledBar: 'c100', restBar: 'c700', recDot: 'c500' }),
    }),
    '07': Object.freeze({
        light: slots({ flameOuter: 'c700', flameMid: 'c500', wick: 'c300', glow: 'c300', litBorder: 'c500', rule: 'c500', head: 'c900' }),
        dark: slots({ flameOuter: 'c500', flameMid: 'c300', wick: 'c100', glow: 'c500', litBorder: 'c700', rule: 'c500', head: 'c900' }),
    }),
    '08': Object.freeze({
        light: slots({ shade: 'c100', slat: 'c300', bottomBar: 'c500', cord: 'c500', weight: 'c700' }),
        dark: null,
    }),
});

/** 틀 · 밝기의 자리 → 색('#rrggbb') · 모르는 틀이거나 사다리를 안 쓰는 판이면 null */
export function ladderSlots(K, frame, mode = 'dark') {
    const table = LADDER_SLOTS[frame]?.[mode === 'light' ? 'light' : 'dark'];
    if (!table) return null;
    const t = toneLadder(K);
    return Object.freeze(Object.fromEntries(Object.entries(table).map(([slot, step]) => [slot, t[step]])));
}

/** 한 틀에 쓰는 서로 다른 색 수(레몬 칠 포함 · 테두리 칠 제외) — 색을 줄였는지 보는 점검용 */
export function toneColorCount(t) {
    const values = [t.card, t.log, t.line, t.text, t.dialogue, t.band, t.name, t.title, t.rule, t.lemon?.fill].filter(Boolean).map(v => String(v).toLowerCase());
    return new Set(values).size;
}

/** 깡통 덮임 점검: 본문 · 띠 위 대사 · 이름 · 제목의 대비(가장 낮은 값과 각각) */
export function toneContrast(t) {
    const list = {
        text: contrast(t.text, t.log),
        dialogue: contrast(t.dialogue, over(t.band, t.log)),
        name: contrast(t.name, t.log),
        title: contrast(t.title, t.card),
    };
    return { ...list, min: Math.min(...Object.values(list)) };
}
