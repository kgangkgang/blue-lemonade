// 계산된 색 · 형광펜 그림 읽기 — 북마크 발췌(bookmarks/excerpt-capture.js)와 로그 복사(log-copy-capture.js)가 같이 쓴다.
// DOM 을 import 하지 않는 순수 함수라 node 로 시험한다.

const round = n => Math.round(n * 1000) / 1000;

/** 계산된 색 글자(rgb() · rgba() · color(srgb …) · #hex) → { r, g, b, a } | null */
export function parseColor(value) {
    const text = String(value ?? '').trim();
    const rgb = text.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i);
    if (rgb) {
        const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? Number.parseFloat(rgb[4]) / 100 : Number(rgb[4]);
        return { r: Math.round(Number(rgb[1])), g: Math.round(Number(rgb[2])), b: Math.round(Number(rgb[3])), a: alpha };
    }
    // color-mix() · 상대 색은 color(srgb r g b / a) 로 계산되어 나온다 (0~1)
    const srgb = text.match(/^color\(\s*srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+%?))?\s*\)$/i);
    if (srgb) {
        const channel = n => Math.round(Math.min(1, Math.max(0, Number(n))) * 255);
        const alpha = srgb[4] === undefined ? 1 : srgb[4].endsWith('%') ? Number.parseFloat(srgb[4]) / 100 : Number(srgb[4]);
        return { r: channel(srgb[1]), g: channel(srgb[2]), b: channel(srgb[3]), a: alpha };
    }
    return hexColor(text);
}

export function hexColor(value) {
    const hex = String(value ?? '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!hex) return null;
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d).join('') : hex[1];
    return { r: Number.parseInt(digits.slice(0, 2), 16), g: Number.parseInt(digits.slice(2, 4), 16), b: Number.parseInt(digits.slice(4, 6), 16), a: digits.length === 8 ? round(Number.parseInt(digits.slice(6, 8), 16) / 255) : 1 };
}

export function cssColor(color, alpha = color.a) {
    const a = Math.min(1, Math.max(0, alpha));
    return a >= 0.999 ? `rgb(${color.r}, ${color.g}, ${color.b})` : `rgba(${color.r}, ${color.g}, ${color.b}, ${round(a)})`;
}

/** over 를 under(불투명) 위에 겹친 색 */
export function compose(over, under) {
    const a = Math.min(1, Math.max(0, over.a));
    const mix = (x, y) => Math.round(x * a + y * (1 - a));
    return { r: mix(over.r, under.r), g: mix(over.g, under.g), b: mix(over.b, under.b), a: 1 };
}

/** 글자에 실제로 칠해지는 색: 글자 채움색(형광펜 색 모드는 띠가 color, 글자가 -webkit-text-fill-color) 먼저 */
export function textInk(style) {
    const fill = parseColor(style.webkitTextFillColor);
    if (fill && fill.a > 0.05) return fill;
    const color = parseColor(style.color);
    return color && color.a > 0.05 ? color : null;
}

/** WCAG 대비 (두 색 모두 불투명으로 본다) */
export function contrast(a, b) {
    const x = typeof a === 'string' ? parseColor(a) : a, y = typeof b === 'string' ? parseColor(b) : b;
    if (!x || !y) return 21;
    const lum = ({ r, g, b: blue }) => {
        const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(blue);
    };
    const [hi, lo] = [lum(x), lum(y)].sort((m, n) => n - m);
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * url("data:image/svg+xml,…") 안 그림(테마 형광펜 — apply.js markerBackground)의 칠 색 · 투명도 · 띠 높이.
 * 띠 높이는 글 상자 높이의 % — 네모는 rect 의 y · height, 붓 획은 경로의 왼쪽 · 오른쪽 윗변과 두께(가운데로), 알약은 그림 크기 · 자리(layer)에서.
 */
export function svgPaint(image) {
    const text = String(image ?? '');
    const at = text.indexOf('data:image/svg+xml');
    if (at < 0) return null;
    // 계산된 값은 url("data:…") — 그림 글 안에 ' ( ) 가 그대로 들어 있으니(encodeURIComponent 는 안 바꾼다) 감싼 따옴표의 짝까지 자른다
    const quote = text[at - 1];
    let end = -1;
    if (quote === '"' || quote === "'") {
        for (let i = at; i < text.length; i++) {
            if (text[i] === '\\') { i++; continue; }
            if (text[i] === quote) { end = i; break; }
        }
    } else end = text.indexOf(')', at);
    let svg = text.slice(at, end === -1 ? undefined : end);
    svg = svg.slice(svg.indexOf(',') + 1).replace(/\\(.)/g, '$1');
    try { svg = decodeURIComponent(svg); } catch { /* 이미 풀린 글 */ }
    const opacity = svg.match(/fill-opacity=['"]([\d.]+)['"]/);
    const fill = svg.match(/fill=['"](rgba?\([^'"]*\)|#[0-9a-f]{3,8})['"]/i);
    let span = null;
    if (/<circle/i.test(svg)) span = { pill: true };
    else {
        const rect = svg.match(/<rect\b[^>]*\by=['"]([\d.]+)['"][^>]*\bheight=['"]([\d.]+)['"]/i);
        const left = svg.match(/L2\.2,([\d.-]+)/), right = svg.match(/T98\.6,([\d.-]+)/), rightBottom = svg.match(/L97\.2,([\d.-]+)/);
        if (rect) span = { from: Number(rect[1]), to: Number(rect[1]) + Number(rect[2]) };
        else if (left && right && rightBottom) {
            const top = (Number(left[1]) + Number(right[1])) / 2;
            span = { from: top, to: top + Number(rightBottom[1]) - Number(right[1]) };
        }
    }
    return { color: fill ? parseColor(fill[1]) : null, opacity: opacity ? Number(opacity[1]) : null, span };
}

/** 알약 띠: 그림 크기(100% T%) · 세로 자리(y%)는 그림 층의 값 — 여러 층이면 마지막 층(형광펜) */
export function pillSpan(size, positionY) {
    const height = Number.parseFloat(String(size ?? '').split(',').at(-1)?.trim().split(/\s+/)[1]);
    const y = Number.parseFloat(String(positionY ?? '').split(',').at(-1));
    if (!Number.isFinite(height) || !Number.isFinite(y)) return null;
    const from = (100 - height) * y / 100;
    return { from, to: from + height };
}

/** 형광펜 띠 값: 위 · 아래는 글 상자 높이의 % (0~100). 색은 rgb() · rgba() · #hex 만 */
export function bandImage(color, from, to) {
    const clamp = n => Math.round(Math.min(100, Math.max(0, Number(n))) * 10) / 10;
    const top = clamp(from), bottom = clamp(to);
    if (!(bottom > top) || !/^(?:#[0-9a-f]{3,8}|rgba?\([\d., ]+\))$/i.test(String(color))) return '';
    return `linear-gradient(transparent ${top}%, ${color} ${top}%, ${color} ${bottom}%, transparent ${bottom}%)`;
}
