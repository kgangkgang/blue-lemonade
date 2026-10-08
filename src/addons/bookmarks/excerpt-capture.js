// 북마크 — 채팅에서 고른 글을 화면에 보이던 모양 그대로 떠 온다 (selection-chip.js 가 부른다).
// 대사 색 · 형광펜 띠 · 속마음 기울기는 #chat 안에서만 먹는 테마 · 프리셋 규칙이라 cloneContents() 로 복사하면 채팅 밖에서 다 빠진다.
// 그래서 고른 범위의 글 조각마다 원래 자리의 계산된 모양(getComputedStyle)을 읽어 인라인 style 로 적는다:
//   글자색(글자 채움색 우선 — 형광펜 색 모드는 띠가 color, 글자가 -webkit-text-fill-color) · 띠(글을 감싼 인라인 요소의 바탕 · 형광펜 그림)
//   · 기울기 · 굵기 · 밑줄/취소선. 둘레 글자와 같은 값은 적지 않는다 (북마크 창의 글자색을 따른다).
// 번역문이 보이는 중이면 고른 글이 곧 번역문이다 — 화면에 보이는 그대로가 저장된다.
import { compactRuns, runsToHtml, runsToText, toneOf, bandImage, EXCERPT_LIMITS } from './excerpts.js';

const SKIP = 'script, style, template, textarea, input, select, iframe, svg, canvas, video, audio, img, picture, noscript, object, embed';

function parseColor(value) {
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
    return null;
}

const round = n => Math.round(n * 1000) / 1000;
function cssColor(color, alpha = color.a) {
    const a = Math.min(1, Math.max(0, alpha));
    return a >= 0.999 ? `rgb(${color.r}, ${color.g}, ${color.b})` : `rgba(${color.r}, ${color.g}, ${color.b}, ${round(a)})`;
}

/**
 * url("data:image/svg+xml,…") 안 그림(테마 형광펜 — apply.js markerBackground)의 칠 색 · 투명도 · 띠 높이.
 * 띠 높이는 글 상자 높이의 % — 네모는 rect 의 y · height, 붓 획은 경로의 왼쪽 · 오른쪽 윗변과 두께(가운데로), 알약은 그림 크기 · 자리(layer)에서.
 */
function svgPaint(image) {
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
    return { color: fill ? (parseColor(fill[1]) ?? hexColor(fill[1])) : null, opacity: opacity ? Number(opacity[1]) : null, span };
}

/** 알약 띠: 그림 크기(100% T%) · 세로 자리(y%)는 그림 층의 값 — 여러 층이면 마지막 층(형광펜) */
function pillSpan(size, positionY) {
    const height = Number.parseFloat(String(size ?? '').split(',').at(-1)?.trim().split(/\s+/)[1]);
    const y = Number.parseFloat(String(positionY ?? '').split(',').at(-1));
    if (!Number.isFinite(height) || !Number.isFinite(y)) return null;
    const from = (100 - height) * y / 100;
    return { from, to: from + height };
}

function hexColor(value) {
    const hex = String(value ?? '').trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!hex) return null;
    const digits = hex[1].length === 3 ? [...hex[1]].map(d => d + d).join('') : hex[1];
    return { r: Number.parseInt(digits.slice(0, 2), 16), g: Number.parseInt(digits.slice(2, 4), 16), b: Number.parseInt(digits.slice(4, 6), 16), a: 1 };
}

/**
 * @param {Range} range 고른 범위 (한 메시지 .mes_text 안)
 * @param {Element} root 그 .mes_text
 * @returns {{ text: string, html: string, pos: number, tone: string, ink: string } | null}
 */
export function captureExcerpt(range, root) {
    if (!range || !root?.isConnected || range.collapsed) return null;
    const view = root.ownerDocument.defaultView;
    const computed = new Map();
    const cs = (element) => {
        let style = computed.get(element);
        if (!style) { style = view.getComputedStyle(element); computed.set(element, style); }
        return style;
    };
    const base = cs(root);
    const textInk = (style) => {
        const fill = parseColor(style.webkitTextFillColor);
        if (fill && fill.a > 0.05) return fill;
        const color = parseColor(style.color);
        return color && color.a > 0.05 ? color : null;
    };
    const baseInk = textInk(base);
    const ink = baseInk ? cssColor(baseInk) : '';
    const baseWeight = Number.parseInt(base.fontWeight, 10) || 400;

    const isInline = element => cs(element).display.startsWith('inline') || cs(element).display === 'contents' || cs(element).display.startsWith('ruby');
    /** 이 글이 속한 문단(인라인이 아닌 가장 가까운 상자). root 까지 */
    const blockOf = (element) => {
        for (let node = element; node && node !== root; node = node.parentElement) {
            if (!isInline(node)) return node;
        }
        return root;
    };
    /**
     * 글을 감싼 인라인 요소의 띠. 문단 · 카드의 바탕은 고른 글의 띠가 아니다.
     * @returns {{ 'background-color'?: string, 'background-image'?: string } | null} 꽉 찬 바탕이면 색, 형광펜(줄 높이 일부)이면 그 높이의 띠
     */
    const band = (element) => {
        const shaped = (color, span, size, positionY) => {
            const range = span?.pill ? pillSpan(size, positionY) : span;
            const image = range ? bandImage(color, range.from, range.to) : '';
            return image ? { 'background-image': image } : { 'background-color': color };
        };
        for (let node = element; node && node !== root; node = node.parentElement) {
            const style = cs(node);
            if (!style.display.startsWith('inline')) break;
            const mask = [style.webkitMaskImage, style.maskImage].find(value => value && value !== 'none') ?? '';
            const color = parseColor(style.backgroundColor);
            if (color && color.a > 0.02) {
                // 형광펜 색 모드: 바탕은 currentColor 로 꽉 칠하고 형광펜 그림을 마스크로 써서 띠만 그 모양 · 투명도가 된다
                const paint = mask ? svgPaint(mask) : null;
                if (!paint) return { 'background-color': cssColor(color) };
                return shaped(cssColor(color, color.a * (paint.opacity ?? 0.4)), paint.span, style.webkitMaskSize || style.maskSize, style.webkitMaskPositionY || style.maskPosition);
            }
            const image = style.backgroundImage;
            if (image && image !== 'none' && image.includes('data:image/svg+xml')) {
                // 테마 형광펜(--salty-marker-bg): 띠는 그림 — 그림의 칠 색 · 투명도 · 높이로 옮긴다 (그라데이션 띠는 팔레트 형광펜 색으로)
                const paint = svgPaint(image);
                if (paint?.color) return shaped(cssColor(paint.color, paint.color.a * (paint.opacity ?? 1)), paint.span, style.backgroundSize, style.backgroundPositionY);
                const marker = parseColor(style.getPropertyValue('--salty-marker')) ?? hexColor(style.getPropertyValue('--salty-marker'));
                if (marker && marker.a > 0.02) return shaped(cssColor(marker, Math.min(marker.a, 0.6)), paint?.span, style.backgroundSize, style.backgroundPositionY);
            }
            // 강조(strong)의 아래쪽 띠: box-shadow: inset 0 -0.36em 색 → 상자 아래쪽 그 높이만큼
            const shadow = style.boxShadow;
            if (shadow && shadow !== 'none' && /inset/.test(shadow)) {
                const hit = shadow.match(/^(rgba?\([^)]*\))\s+0px\s+(-[\d.]+)px\s+0px(?:\s+0px)?\s+inset$/);
                const ink = hit && parseColor(hit[1]);
                const height = node.getClientRects()[0]?.height;
                if (ink && ink.a > 0.02 && height > 0) {
                    const image = bandImage(cssColor(ink), 100 - Math.min(100, (-Number(hit[2]) / height) * 100), 100);
                    if (image) return { 'background-image': image };
                }
            }
        }
        return null;
    };
    const decoration = (element) => {
        const lines = new Set();
        for (let node = element; node && node !== root; node = node.parentElement) {
            // 테마는 취소선을 글자 가운데 긋는 바탕 줄로 그린다 (text-decoration 은 none)
            if (node.matches('del, s, strike')) lines.add('line-through');
            const line = cs(node).textDecorationLine;
            if (line && line !== 'none') for (const word of line.split(/\s+/)) if (/^(underline|overline|line-through)$/.test(word)) lines.add(word);
            if (!isInline(node)) break;
        }
        return [...lines].join(' ');
    };
    const styles = new Map();
    const runStyle = (element) => {
        let style = styles.get(element);
        if (style) return style;
        const own = cs(element);
        style = {};
        const color = textInk(own);
        const colorText = color ? cssColor(color) : '';
        if (colorText && colorText !== ink) style.color = colorText;
        Object.assign(style, band(element));
        if (own.fontStyle !== 'normal') style['font-style'] = 'italic';
        const weight = Number.parseInt(own.fontWeight, 10);
        if (weight && Math.abs(weight - baseWeight) >= 100) style['font-weight'] = String(weight);
        const lines = decoration(element);
        if (lines) style['text-decoration-line'] = lines;
        styles.set(element, style);
        return style;
    };

    const container = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!container || !root.contains(container)) return null;
    const pieces = [];
    let lastBlock = null;
    const walker = root.ownerDocument.createTreeWalker(container, view.NodeFilter.SHOW_ELEMENT | view.NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!range.intersectsNode(node)) return view.NodeFilter.FILTER_REJECT;
            if (node.nodeType !== 1) return view.NodeFilter.FILTER_ACCEPT;
            if (node.matches(SKIP)) return view.NodeFilter.FILTER_REJECT;
            // 접힌 details 속 · display:none 은 화면에 없는 글이다 (테마가 숨긴 그림 옆 <br> 도).
            // display:contents 는 상자가 없어 checkVisibility() 가 늘 false 라 묻지 않는다 (속 글은 보인다)
            const display = cs(node).display;
            if (display === 'none') return view.NodeFilter.FILTER_REJECT;
            if (display !== 'contents' && node.tagName !== 'BR' && typeof node.checkVisibility === 'function' && !node.checkVisibility()) return view.NodeFilter.FILTER_REJECT;
            return node.tagName === 'BR' ? view.NodeFilter.FILTER_ACCEPT : view.NodeFilter.FILTER_SKIP;
        },
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (node.nodeType === 1) { // <br>
            pieces.push({ br: true });
            continue;
        }
        const parent = node.parentElement;
        if (!parent) continue;
        const style = cs(parent);
        if (style.visibility !== 'visible' || style.userSelect === 'none' || style.opacity === '0') continue;
        let text = node.data;
        if (node === range.endContainer) text = text.slice(0, range.endOffset);
        if (node === range.startContainer) text = text.slice(range.startOffset);
        if (!text) continue;
        const block = blockOf(parent);
        if (lastBlock && block !== lastBlock) pieces.push({ p: true });
        lastBlock = block;
        const space = style.whiteSpaceCollapse || '';
        const keepBreaks = space ? space !== 'collapse' : /^(pre|pre-wrap|pre-line|break-spaces)$/.test(style.whiteSpace);
        const keepSpaces = space ? /^(preserve|break-spaces)$/.test(space) : /^(pre|pre-wrap|break-spaces)$/.test(style.whiteSpace);
        const runs = keepBreaks ? text.split('\n') : [text];
        runs.forEach((line, index) => {
            if (index) pieces.push({ br: true });
            const value = keepSpaces ? line.replace(/\t/g, ' ') : line.replace(/[ \t\r\n\f]+/g, ' ');
            if (value) pieces.push({ text: value, style: runStyle(parent) });
        });
    }

    const { runs } = compactRuns(pieces, EXCERPT_LIMITS.text);
    if (!runs.some(run => run.text)) return null;
    let html = runsToHtml(runs);
    // 글자마다 색이 다른 효과 글 같은 것은 모양이 너무 길어진다 — 띠 · 기울기만 남기고, 그래도 길면 글만
    if (html.length > EXCERPT_LIMITS.html) {
        const lighter = runs.map(run => (run.text ? { text: run.text, style: { 'background-color': run.style['background-color'], 'font-style': run.style['font-style'] } } : run));
        html = runsToHtml(compactRuns(lighter, EXCERPT_LIMITS.text).runs);
        if (html.length > EXCERPT_LIMITS.html) html = runsToHtml(runs, { stylesOff: true });
    }
    let pos = 0;
    try {
        const before = root.ownerDocument.createRange();
        before.setStart(root, 0);
        before.setEnd(range.startContainer, range.startOffset);
        pos = before.toString().length;
    } catch { /* 자리를 몰라도 저장은 한다 */ }
    return { text: runsToText(runs), html, pos, tone: toneOf(ink), ink };
}
