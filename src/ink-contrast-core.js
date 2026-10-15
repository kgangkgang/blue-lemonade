// 6.6.9 글자색 대비 맞추기 — 계산만 (DOM · 실리태번 없음, tools/tests/ink-contrast.mjs 가 검사한다).
// 메시지에 적힌 글자색(<font color> · style="color:…")이 바탕에 묻히면 색상(hue) · 채도는 두고 밝기(HSL L)만 옮겨
// WCAG 대비 4.5 : 1 에 닿는 가장 가까운 색을 고른다. 4.5 에 못 닿는 바탕(가운데 회색 같은)이면 3 : 1, 그것도 안 되면 갈 수 있는 끝까지.
// 이미 4.5 를 넘는 색은 그대로(null). 같은 색 · 같은 바탕은 늘 같은 답이라 makeInkCache 로 한 번만 계산한다.
export const TARGET = 4.5;
export const FLOOR = 3;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (s, scale) => s.endsWith('%') ? parseFloat(s) * scale / 100 : parseFloat(s);
// 글자 · 바탕 색을 [r, g, b, a] 로 (0~255, a 0~1). 못 읽는 값(var(…) · currentColor · 이름 색)은 named 로 넘긴다 — 브라우저에서는 캔버스가 맡는다
export function parseColor(value, named = null) {
    const s = String(value ?? '').trim().toLowerCase();
    if (!s) return null;
    let m = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
    if (m) {
        let h = m[1];
        if (h.length < 6) h = [...h].map(c => c + c).join('');
        const n = i => parseInt(h.slice(i, i + 2), 16);
        return [n(0), n(2), n(4), h.length === 8 ? Math.round(n(6) / 255 * 1000) / 1000 : 1];
    }
    m = /^(rgba?|hsla?)\(\s*([^)]*)\)$/.exec(s);
    if (m) {
        const parts = m[2].split(/[\s,/]+/).filter(Boolean);
        if (parts.length < 3 || parts.some(p => !/^-?[\d.]+(%|deg)?$/.test(p))) return null;
        const a = parts[3] === undefined ? 1 : clamp(num(parts[3], 1), 0, 1);
        if (m[1].startsWith('rgb')) return [...parts.slice(0, 3).map(p => clamp(Math.round(num(p, 255)), 0, 255)), a];
        const [r, g, b] = hslToRgb([((parseFloat(parts[0]) % 360) + 360) % 360, clamp(parseFloat(parts[1]) / 100, 0, 1), clamp(parseFloat(parts[2]) / 100, 0, 1)]);
        return [r, g, b, a];
    }
    if (s === 'transparent') return [0, 0, 0, 0];
    return typeof named === 'function' ? named(s) : null;
}

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
/** WCAG 상대 휘도 */
export const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
/** WCAG 대비 (1~21) */
export function contrast(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** 반투명 색 fg 를 불투명 바탕 bg 위에 겹친 색 [r, g, b] */
export function over(fg, bg) {
    const a = fg[3] ?? 1;
    return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
}
/** 안쪽 → 바깥 차례의 바탕 층들을 맨 바깥 불투명 바탕 base 위에 차례로 겹친 색 */
export function stack(layers, base) {
    let out = base.slice(0, 3);
    for (let i = layers.length - 1; i >= 0; i--) out = over(layers[i], out);
    return out.map(Math.round);
}

export function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return [h, s, l];
}
export function hslToRgb([h, s, l]) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r, g, b].map(v => clamp(Math.round((v + m) * 255), 0, 255));
}
export const hex = rgb => '#' + rgb.slice(0, 3).map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

/** 글자색 fg([r,g,b,a]) 가 바탕 bg([r,g,b]) 위에서 target 대비에 못 미치면 밝기만 옮긴 색 { hex, ratio, before }, 이미 넉넉하면 null.
 *  HSL 의 L 만 바꾼다 — 채널마다 L 에 대해 단조라 휘도도 단조, 이분 탐색으로 원래 밝기에서 가장 가까운 자리를 찾는다 */
export function fixInk(fg, bg, { target = TARGET, floor = FLOOR } = {}) {
    if (!fg || !bg) return null;
    const shown = over(fg, bg), before = contrast(shown, bg);
    if (before >= target) return null;
    const [h, s, l0] = rgbToHsl(shown);
    // 밝게 갈지 어둡게 갈지: 흰색 · 검정 가운데 바탕과 더 벌어지는 쪽
    const up = contrast([255, 255, 255], bg) >= contrast([0, 0, 0], bg);
    const end = up ? 1 : 0;
    const at = l => hslToRgb([h, s, l]);
    const best = contrast(at(end), bg);
    const goal = best >= target ? target : best >= floor ? floor : best;
    if (goal <= before) return null; // 그 방향으로 가도 나아지지 않는다
    let lo = l0, hi = end; // lo 쪽은 모자람, hi 쪽은 닿음
    for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        if (contrast(at(mid), bg) >= goal) hi = mid; else lo = mid;
    }
    let rgb = at(hi);
    // 반올림한 8비트 색이 목표에 살짝 못 미치면 한 칸씩 더 민다
    for (let step = 0; step < 8 && contrast(rgb, bg) < goal - 1e-9; step++) rgb = at(clamp(hi + (up ? 1 : -1) * (step + 1) / 255, 0, 1));
    return { hex: hex(rgb), rgb, ratio: Math.round(contrast(rgb, bg) * 100) / 100, before: Math.round(before * 100) / 100 };
}

/** 형광펜 띠(apply.js markerBackground 의 SVG) 색 · 투명도 · 두께(%). 그라데이션 띠 · 모르는 그림은 null */
export function bandOf(image, size = '') {
    const s = String(image || '');
    if (!s.includes('data:image/svg+xml')) return null;
    let svg = s;
    try { svg = decodeURIComponent(s); } catch { /* 그대로 */ }
    if (/url\(#blend\)/.test(svg)) return null;
    const m = /fill='rgb\((\d+),(\d+),(\d+)\)' fill-opacity='([\d.]+)'/.exec(svg);
    if (!m) return null;
    const thick = /\s([\d.]+)%\s*$/.exec(String(size).trim()) || /^\S+\s+([\d.]+)%/.exec(String(size).trim());
    return { rgba: [Number(m[1]), Number(m[2]), Number(m[3]), clamp(Number(m[4]), 0, 1)], thick: thick ? Number(thick[1]) : 100 };
}
// 띠가 이보다 얇으면 글자 대부분이 띠 밖(메시지 바탕)에 있다 — 그때는 띠를 바탕으로 치지 않는다
export const BAND_MIN = 45;

/** 같은 (글자색, 바탕) 은 한 번만 계산. 넘치면 통째로 비운다 (퍼스널 컬러 수 × 바탕 수라 보통 수십 개) */
export function makeInkCache(limit = 512) {
    const memo = new Map();
    return {
        get(fg, bg, options) {
            const key = fg.join(',') + '|' + bg.join(',');
            if (memo.has(key)) return memo.get(key);
            if (memo.size >= limit) memo.clear();
            const out = fixInk(fg, bg, options);
            memo.set(key, out);
            return out;
        },
        get size() { return memo.size; },
        clear() { memo.clear(); },
    };
}

/** 요소의 글자색 표기: <font color> 먼저, 아니면 style 의 color. 우리 몫이 아닌 것은 '' —
 *  !important 로 박힌 색(테마 규칙으로 못 덮음) · var(…) · currentColor · inherit 같은 테마 · 상속 값 */
export function sourceColor(colorAttr, styleAttr) {
    let value = colorAttr && String(colorAttr).trim();
    if (!value) {
        const m = /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(String(styleAttr || ''));
        value = m ? m[1].trim() : '';
    }
    if (!value || /!\s*important|var\(|currentcolor|inherit|initial|unset|revert|transparent/i.test(value)) return '';
    return value;
}

/** 색 두 개가 화면에서 같은 색인가 (브라우저 계산값 반올림 1 차이까지) */
export const sameRgb = (a, b) => !!a && !!b && Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && Math.abs(a[2] - b[2]) <= 1 && Math.abs((a[3] ?? 1) - (b[3] ?? 1)) < 0.02;
