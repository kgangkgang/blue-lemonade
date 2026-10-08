// 북마크 — 고른 글 조각(발췌). 채팅에서 글을 골라 북마크하면 화면에 보이던 그대로(번역문 · 대사 색 · 형광펜 띠 · 기울기 · 굵기)를
// 그 북마크에 함께 둔다. 채팅 파일의 chat_metadata.favorites[n].excerpts:
//   [{ id, text, html, pos?, at, tone?, ink? }]
//   text 찾기 · 겹침 판단용 순수 글 / html 그 모양 — <p> <br> <span style> 만 (STYLE_RULES: 글자색 · 바탕색 · 형광펜 띠 · 기울기 · 굵기 · 밑줄/취소선)
//   pos 메시지 글에서 시작 자리(카드 안 순서) / at 만든 시각 / tone 고를 때 글 바탕('dark' = 어두운 바탕의 밝은 글) / ink 둘레 글자색
// 이전 확장 · 예전 판은 모르는 칸이라 그대로 두고 지나간다 (anchor 와 같다).
// 실리태번 · DOM 을 import 하지 않는 순수 함수라 node 로 시험한다 (blue-lemonade-audit/bookmark-excerpts-20261008/excerpts.test.mjs).

export const EXCERPT_LIMITS = Object.freeze({ text: 6000, html: 24000, count: 30 });

// 색 값: #hex 또는 rgb() · color(srgb …) 같은 함수 하나. 괄호 안에 괄호 · 따옴표 · 쌍점 · 쌍반점 · 별표 · 역빗금이 들어갈 수 없어 url() · 주석 · 다른 선언이 끼지 못한다
const COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([a-z0-9 ,.%/+-]*\))$/i;
// 형광펜 띠(줄 높이의 일부만 칠한 띠) 하나: linear-gradient(transparent 위%, 색 위%, 색 아래%, transparent 아래%) 모양만 받는다
const BAND = /^linear-gradient\(transparent (\d{1,3}(?:\.\d{1,2})?)%, ((?:#[0-9a-f]{3,8}|rgba?\(\d{1,3}, \d{1,3}, \d{1,3}(?:, (?:0|1|0?\.\d{1,4}))?\))) \1%, \2 (\d{1,3}(?:\.\d{1,2})?)%, transparent \3%\)$/i;
export const STYLE_RULES = Object.freeze({
    color: COLOR,
    'background-color': COLOR,
    'background-image': BAND,
    'font-style': /^(?:italic|oblique)$/i,
    'font-weight': /^(?:bold|[1-9]\d{0,2}|1000)$/i,
    'text-decoration-line': /^(?:underline|overline|line-through)(?: (?:underline|overline|line-through)){0,2}$/i,
});
const STYLE_ORDER = Object.keys(STYLE_RULES);

export function isCssColor(value) {
    return typeof value === 'string' && COLOR.test(value.trim());
}

/** 형광펜 띠 값 만들기: 위 · 아래는 글 상자 높이의 % (0~100) */
export function bandImage(color, from, to) {
    const clamp = n => Math.round(Math.min(100, Math.max(0, Number(n))) * 10) / 10;
    const top = clamp(from), bottom = clamp(to);
    if (!(bottom > top) || !isCssColor(color)) return '';
    const value = `linear-gradient(transparent ${top}%, ${color} ${top}%, ${color} ${bottom}%, transparent ${bottom}%)`;
    return BAND.test(value) ? value : '';
}

/** 허용한 속성 · 값만 남긴 새 모양 객체 */
function pickStyle(style) {
    const picked = {};
    if (!style || typeof style !== 'object') return picked;
    for (const name of STYLE_ORDER) {
        const value = typeof style[name] === 'string' ? style[name].trim().replace(/\s+/g, ' ') : '';
        if (value && STYLE_RULES[name].test(value)) picked[name] = value;
    }
    return picked;
}

/** { color, 'background-color', … } → 'color:…;background-color:…' (허용한 것만, 늘 같은 차례) */
export function styleText(style) {
    return Object.entries(pickStyle(style)).map(([name, value]) => `${name}:${value}`).join(';');
}

/** style 속성 글에서 허용한 속성 · 값만 남긴다 (저장된 html 을 그릴 때 다시 거른다) */
export function cleanStyle(text) {
    const picked = {};
    for (const part of String(text ?? '').split(';')) {
        const at = part.indexOf(':');
        if (at < 0) continue;
        const name = part.slice(0, at).trim().toLowerCase();
        const value = part.slice(at + 1).trim().replace(/\s+/g, ' ');
        if (Object.hasOwn(STYLE_RULES, name) && STYLE_RULES[name].test(value)) picked[name] = value;
    }
    return styleText(picked);
}

const isBreak = piece => !!piece && (piece.br === true || piece.p === true);

/** 줄 끝 빈칸을 뗀다 (빈 조각은 뺀다) */
function trimTail(out) {
    while (out.length && !isBreak(out.at(-1))) {
        const last = out.at(-1);
        last.text = last.text.replace(/\s+$/, '');
        if (last.text) return;
        out.pop();
    }
}

/**
 * 고른 글 조각 [{ text, style } | { br: true } | { p: true }] 를 다듬는다:
 * 붙어 있는 같은 모양은 하나로, 줄 머리 · 꼬리 빈칸과 맨 앞뒤 줄바꿈은 빼고, 빈 줄은 하나까지, 글자 수는 limit 까지 (넘으면 … ).
 * @returns {{ runs: object[], cut: boolean }}
 */
export function compactRuns(pieces, limit = EXCERPT_LIMITS.text) {
    const out = [];
    let length = 0;
    let cut = false;
    for (const piece of Array.isArray(pieces) ? pieces : []) {
        if (isBreak(piece)) {
            trimTail(out);
            if (!out.length) continue;
            const prev = out.at(-1);
            if (prev.p) continue;
            if (piece.p) {
                while (out.at(-1)?.br) out.pop();
                out.push({ p: true });
            } else if (!(prev.br && out.at(-2)?.br)) {
                out.push({ br: true });
            }
            continue;
        }
        if (!piece || typeof piece.text !== 'string') continue;
        let text = piece.text.replace(/[\r\n]+/g, ' ');
        const prev = out.at(-1);
        if (!prev || isBreak(prev) || /\s$/.test(prev.text)) text = text.replace(/^\s+/, '');
        if (!text) continue;
        const room = limit - length;
        if (room <= 0) { cut = true; break; }
        const chars = Array.from(text);
        if (chars.length > room) {
            text = `${chars.slice(0, room).join('').replace(/\s+$/, '')}…`;
            cut = true;
        }
        length += Math.min(chars.length, room);
        const style = pickStyle(piece.style);
        const styleKey = styleText(style);
        if (prev && !isBreak(prev) && prev.styleKey === styleKey) prev.text += text;
        else out.push({ text, style, styleKey });
        if (cut) break;
    }
    trimTail(out);
    while (out.length && isBreak(out.at(-1))) out.pop();
    return { runs: out.map(run => (isBreak(run) ? run : { text: run.text, style: run.style })), cut };
}

const escapeText = text => String(text).replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
const escapeAttr = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** 다듬은 조각 → <p> · <br> · <span style> 만 쓰는 html. stylesOff 면 모양 없이 글만 (html 이 너무 길 때) */
export function runsToHtml(runs, { stylesOff = false } = {}) {
    let html = '<p>';
    for (const run of Array.isArray(runs) ? runs : []) {
        if (run.p) html += '</p><p>';
        else if (run.br) html += '<br>';
        else {
            const style = stylesOff ? '' : styleText(run.style);
            html += style ? `<span style="${escapeAttr(style)}">${escapeText(run.text)}</span>` : escapeText(run.text);
        }
    }
    return `${html}</p>`;
}

/** 다듬은 조각 → 순수 글 (문단 사이는 빈 줄) */
export function runsToText(runs) {
    return (Array.isArray(runs) ? runs : []).map(run => (run.p ? '\n\n' : run.br ? '\n' : run.text)).join('');
}

/** 색 값의 밝기 0~1 (모르면 null). rgb() · rgba() · #hex · color(srgb …) */
export function colorLuminance(value) {
    const text = String(value ?? '').trim().toLowerCase();
    let rgb = null;
    const hex = text.match(/^#([0-9a-f]{3,8})$/);
    if (hex) {
        const digits = hex[1].length <= 4 ? [...hex[1].slice(0, 3)].map(d => d + d) : [hex[1].slice(0, 2), hex[1].slice(2, 4), hex[1].slice(4, 6)];
        rgb = digits.map(d => Number.parseInt(d, 16) / 255);
    }
    const fn = text.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (fn) rgb = fn.slice(1, 4).map(n => Number(n) / 255);
    const srgb = text.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (srgb) rgb = srgb.slice(1, 4).map(Number);
    if (!rgb || rgb.some(n => !Number.isFinite(n))) return null;
    const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const [r, g, b] = rgb.map(c => lin(Math.min(1, Math.max(0, c))));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 둘레 글자색으로 본 바탕 밝기: 밝은 글 = 'dark' 바탕 · 어두운 글 = 'light' 바탕 · 모르면 '' */
export function toneOf(ink) {
    const luminance = colorLuminance(ink);
    return luminance === null ? '' : luminance > 0.45 ? 'dark' : 'light';
}

const norm = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const posOf = item => (Number.isFinite(item?.pos) ? item.pos : Number.MAX_SAFE_INTEGER);

/** 읽을 수 있는 발췌인가 (손으로 고친 jsonl 의 빈 칸 · 글 없는 것은 아님) */
export function isExcerpt(item) {
    return !!item && typeof item === 'object' && !Array.isArray(item) && typeof item.text === 'string' && norm(item.text) !== '';
}

/** 북마크의 발췌들 — 메시지 안 자리 차례로 (자리를 모르면 넣은 차례로 맨 뒤). 예전 북마크 · 이상한 값이면 빈 배열 */
export function excerptList(fav) {
    const list = Array.isArray(fav?.excerpts) ? fav.excerpts.filter(isExcerpt) : [];
    return list
        .map((item, order) => ({ item, order }))
        .sort((a, b) => posOf(a.item) - posOf(b.item) || a.order - b.order)
        .map(entry => entry.item);
}

/** 검색용: 발췌 글을 한 줄씩 */
export function excerptsText(fav) {
    return excerptList(fav).map(item => item.text).join('\n');
}

let idSeed = 0;
function makeId(now) {
    idSeed = (idSeed + 1) % 1296;
    return `x${Number(now).toString(36)}${idSeed.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * 북마크에 발췌 하나를 더한다 (fav 를 그 자리에서 고친다).
 * - 이미 있는 발췌 안에 든 글이면 더하지 않는다 (duplicate)
 * - 새 글이 예전 발췌를 감싸면(범위를 넓혀 다시 고름) 그 예전 것들을 새것으로 바꾼다 (replaced)
 * - count 개가 차 있으면 더하지 않는다 (full)
 * @returns {{ added: boolean, reason?: 'empty'|'duplicate'|'full', replaced?: number, excerpt?: object }}
 */
export function appendExcerpt(fav, excerpt, { limit = EXCERPT_LIMITS.count, now = Date.now(), id = null } = {}) {
    if (!fav || typeof fav !== 'object') throw new TypeError('북마크가 아니에요.');
    const text = norm(excerpt?.text);
    if (!text) return { added: false, reason: 'empty' };
    const list = Array.isArray(fav.excerpts) ? fav.excerpts.filter(isExcerpt) : [];
    const holder = list.find(item => norm(item.text).includes(text));
    if (holder) return { added: false, reason: 'duplicate', excerpt: holder };
    const kept = list.filter(item => !text.includes(norm(item.text)));
    if (kept.length >= limit) return { added: false, reason: 'full' };
    const item = { id: String(id ?? excerpt.id ?? makeId(now)), text: String(excerpt.text), html: String(excerpt.html ?? '') };
    if (Number.isFinite(excerpt.pos) && excerpt.pos >= 0) item.pos = Math.floor(excerpt.pos);
    item.at = now;
    if (excerpt.tone === 'dark' || excerpt.tone === 'light') item.tone = excerpt.tone;
    if (isCssColor(excerpt.ink)) item.ink = excerpt.ink.trim();
    fav.excerpts = [...kept, item];
    return { added: true, replaced: list.length - kept.length, excerpt: item };
}

/** 발췌 하나를 뺀다. 다 빠지면 칸도 지운다 (예전 모양 그대로). @returns {boolean} 뺐으면 true */
export function removeExcerpt(fav, excerptId) {
    if (!Array.isArray(fav?.excerpts)) return false;
    const index = fav.excerpts.findIndex(item => item && typeof item === 'object' && String(item.id) === String(excerptId));
    if (index === -1) return false;
    fav.excerpts.splice(index, 1);
    if (!fav.excerpts.some(isExcerpt)) delete fav.excerpts;
    return true;
}
