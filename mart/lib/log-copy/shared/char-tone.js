// 원본 블루레몬 logcopy-b-113 분기(f9260b16 + 작업 중 판)의 src/shared/char-tone.js 를 2026-11-10 에 그대로 복사한 것이에요(주석 속 사람 이름 예시만 뺐어요) · 고치지 말고 다시 복사해요(글꾸 마트가 테마 로그 복사와 같은 색 규칙 · 붙여 넣을 꼴을 쓰려고)
// 1.1.3 글꾸 색 규칙 — 캐릭터 대사색 하나(K)에서 틀 색 전부를 뽑아요. 로그 복사(log-copy-*)와 글꾸 마트가 같이 써요.
//   사용자 「일단 내가 대사색깔지정해둔애들은 그 색깔바탕으로 글꾸해주면좋겠음」 · 「지금 너무 글꾸 산만하달까 색많아서」 · B안 확정(「오 B안좋다 ㄱㄱ」)
//   - 무채 바탕 + 강조색은 대사색 하나. 대사색은 글자가 아니라 대사 뒤 띠(틴트 .18)에 써요(161057).
//   - 글자에 대사색을 쓸 때는 같은 색상 · 채도에서 명도만 옮겨 그 바탕 대비 4.6 이상(깡통은 4.5 미만 글자색을 덮어요 — 4.41 덮임 · 4.79 유지 실측).
//   - plan 'A' 무채 + 띠만 · 'B' 무채 + 이름표 · 제목 밑줄만 대사색(기본 「깡통 로그」) · 'C' 대사색으로 물든 바탕(「진한 바탕」).
//   - 레몬: 노랑 #FFE23C(테두리 #E9BE00) 기본, 진한 색 바탕(C 밤)일 때만 대표색.
// 설계 문서: W/outputs/지시-1110/글꾸-색감/색-규칙.md · 색감-설계.md. DOM 없는 순수 모듈(시험 tools/tests/char-tone.mjs).
import { parseColor, contrast } from './ink-paint.js';

export const TONE_PLANS = ['A', 'B', 'C'];
export const TONE_MODES = ['light', 'dark'];
export const INK_TARGET = 4.6;           // 글자 대비 목표(덮임 문턱 4.5 에 여유)
export const BAND_ALPHA = 0.18;          // 대사 띠 틴트(사용자 확정 11-10)
export const LEMON_YELLOW = Object.freeze({ fill: '#FFE23C', stroke: '#E9BE00' });
const GREY_CHROMA = 0.04;                // 이보다 채도가 낮으면 회색 계열(#c9d1dc 같은 것)

// 무채 바탕(161057 실측 · 낮은 같은 결)
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

/** 한 틀에 쓰는 서로 다른 색 수(레몬 칠 포함 · 테두리 칠 제외) — 「색 많아서 산만」 점검용 */
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
