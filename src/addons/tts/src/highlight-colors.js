// 1.6.9 (테마 6.1.6) 재생 표시의 밑줄이 그 글자의 색을 따라가게 — 사용자: 「tts 재생표시 밑줄 글자색 따라가게」, 「속마음이나 대사 글자색은 보통 다르니까」,
//   「대사색 따라서 밑줄 치는 건 기본으로 켜 두되 싫어하는 사람도 있을 수 있으니 밑줄을 고른 사람들에게만 물어보는 걸로」.
// ::highlight() 안의 currentColor 는 글자마다의 색이 아니라 하이라이트 자체 색으로 풀려서(시험대에서 빨강 · 파랑 · 초록 글자 밑줄이 전부 검정)
// CSS 만으로는 안 된다 → 읽는 범위를 글자 노드마다 잘라 그 부모 요소의 계산된 색으로 묶고, 색마다 하이라이트 이름 + ::highlight 규칙을 따로 만든다.
// - 따라가는 것은 밑줄만. 색칠(배경)은 예전처럼 테마 색 — 스위치는 밑줄을 고른 사람에게만 보이므로, '색깔만' 을 고른 사람의 표시는 그대로여야 한다.
// - 색이 없는 보통 글자(본문 글자색과 같거나 아주 가까운 색)는 테마 색 — 본문 색 그대로 밑줄을 그으면 글자와 같은 색이라 표시가 안 보인다.
//
// 1.7.0 (테마 6.1.7) 사용자: 「잠깐 무지개색처럼 보였다가 글자색으로 바뀌는데 거슬리네」, 「어떤 건 밑줄이 생기고 어떤 건 안 생긴다??」 — 시험대(형광펜 직사각형 ·
//   데우스 대사색 · 속마음 · 표현 대사, 어두운/밝은 팔레트)에서 잰 것:
//   ① 띠 위 밑줄이 안 보였다. 프롬프트 색 형광펜 대사(q, css/37-prompt-ink.css)는 color = 인물 색, 글자 칠(-webkit-text-fill-color) = 테마 잉크이고
//      띠를 마스크(글자 층 + 붓자국 층)로 그린다 — 그 마스크가 밑줄까지 띠 투명도로 흐려, 인물 색 띠 위의 인물 색 밑줄이 띠에 묻혔다.
//      → 띠가 단색(background-image 없음)인 그 q 는 읽는 동안만 마스크 맨 아래에 밑줄 자리를 연다 (data-lv-line, style.css): 띠 아랫단과 밑줄이
//      띠 색 한 줄로 또렷하게 (1.6.9 의 「대사는 인물 색」 그대로). 「글자색 따라가기」를 끄면 열지 않는다 (테마 색 밑줄 약속).
//      테마 형광펜(마스크 없이 띠 그림을 칠함)의 색 없는 대사는 테마 색 밑줄이 테마 색 띠 위라 안 보였다 → 띠 위 글자는 보이는 글자색(글자 칠)으로,
//      본문색과 가까워도 그 색으로.
//   ② 하이라이트를 걸면 크롬은 그 글자를 하이라이트의 color(= 요소의 color)로 다시 칠한다 — 글자 칠을 무시해서, 읽는 동안 형광펜 대사 글자가
//      잉크에서 인물 색(빨강 · 파랑 · 청록 …)으로, 흐린 취소선 글자는 진하게, 그라데이션 글자는 단색으로 바뀌었다 (6.1.5 테마 색 하이라이트에서도).
//      → 글자 칠이 color 와 다르면 규칙에 그 칠(투명도 · transparent 포함)을 color · -webkit-text-fill-color 로 고정한다 (pin). 표시 방식 · 스위치와 상관없이.
//   ③ 읽는 동안 메시지가 다시 그려지면(번역이 붙음 · 다시 쓰기 · 편집 · 스트림 뒤 정리) 범위가 무너져 그 줄의 밑줄이 사라졌다 → player.js 가 지켜보다 다시 칠함.
// 위 절반(순수 함수)은 node 로 시험한다 (tools/tests/tts-highlight-colors.mjs).

export const HIGHLIGHT_BASE = Object.freeze({ both: 'lv-now', color: 'lv-now-color', underline: 'lv-now-underline' });
export const COLOR_LIMIT = 24;   // 한 줄에 색이 이보다 많을 일은 없다 — 넘친 색은 테마 색으로
export const NEAR_PLAIN = 24;    // 채널마다 이만큼 안쪽이면 본문 글자색과 같은 색으로 본다 (테마 대사 #f5f5f7 ↔ 본문 #e1e1e5 같은 것)
export const LINE_SLOT = 'data-lv-line';   // 1.7.0 밑줄 자리를 연 띠 (style.css)
const THEME_FILL = 'background-color: color-mix(in srgb, var(--SmartThemeQuoteColor, #51a0de) 28%, transparent);';
const THEME_LINE = 'color-mix(in srgb, var(--SmartThemeQuoteColor, #51a0de) 70%, transparent)';

/** 계산된 색의 채널 · 투명도 → [r, g, b, a] (0~255 · 0~1). 'rgb(…)' · 'rgba(…)' · '#rgb' · '#rrggbb(aa)' · 'color(srgb …)' · 'transparent'. 모르면 null */
function channels(value) {
    const text = String(value ?? '').trim().toLowerCase();
    if (text === 'transparent') return [0, 0, 0, 0];
    let m = /^#([0-9a-f]{3})$/.exec(text);
    if (m) return [...[...m[1]].map(c => parseInt(c + c, 16)), 1];
    m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(text);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1];
    const num = v => (v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : Number(v));
    m = /^color\(srgb\s+([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+%?)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(text);
    // color-mix() 결과(내 메시지 글자 진하기 등)는 color(srgb 0~1 0~1 0~1 / a) 로 읽힌다
    if (m) return [num(m[1]) * 255, num(m[2]) * 255, num(m[3]) * 255, m[4] === undefined ? 1 : num(m[4])];
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(text);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : num(m[4])];
    return null;
}
const hex2 = v => Math.max(0, Math.min(255, Math.round(Number(v)))).toString(16).padStart(2, '0');

/** 계산된 색 → '#rrggbb'. 투명 · 반쯤 투명 · 모르는 값이면 null (밑줄 색으로 못 쓴다) */
export function colorKey(value) {
    const c = channels(value);
    if (!c || !(c[3] >= 0.5)) return null;
    return `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
}
/** 1.7.0 글자 칠을 그대로 적는 값 — '#rrggbb' · 투명도가 있으면 '#rrggbbaa' · 완전 투명이면 'transparent'. 모르면 null */
export function paintKey(value) {
    const c = channels(value);
    if (!c) return null;
    if (!(c[3] > 0)) return 'transparent';
    const base = `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
    return c[3] >= 1 ? base : `${base}${hex2(c[3] * 255)}`;
}
/** 계산된 색의 투명도 0~1 (모르는 색 공간 color(display-p3 …) 도 / 뒤 값으로). 비었거나 transparent 면 0 */
export function alphaOf(value) {
    const v = String(value ?? '').trim().toLowerCase();
    if (!v || v === 'transparent') return 0;
    const c = channels(v);
    if (c) return c[3];
    const slash = v.lastIndexOf('/');
    if (slash < 0) return 1;
    const a = v.slice(slash + 1).replace(/\)\s*$/, '').trim();
    const n = a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a);
    return Number.isFinite(n) ? n : 1;
}

/** 두 '#rrggbb' 가 채널마다 tolerance 안쪽인가 */
export function nearColor(a, b, tolerance = NEAR_PLAIN) {
    if (!a || !b) return false;
    for (const i of [1, 3, 5]) if (Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) > tolerance) return false;
    return true;
}

const pinPart = pin => (pin === 'transparent' ? 't' : pin.slice(1));
/** 하이라이트 이름: 테마 색이면 예전 이름 그대로, 밑줄 색이 있으면 -c-rrggbb, 글자 칠 고정이 있으면 -p-rrggbb(aa) · -p-t */
export function highlightName(style, key, pin = '') {
    const base = HIGHLIGHT_BASE[style] || HIGHLIGHT_BASE.both;
    return `${base}${key ? `-c-${key.slice(1)}` : ''}${pin ? `-p-${pinPart(pin)}` : ''}`;
}

/** 이 설정에서 밑줄 색을 글자색으로 따라가는가 — 밑줄이 들어가는 표시(both · underline)이고 스위치가 켜져 있을 때 */
export const followsTextColor = (style, follow = true) => follow !== false && (style === 'both' || style === 'underline');

/** 마스크가 테마 형광펜 모양(글자 층 linear-gradient + 붓자국 그림 층)인가 — style.css 의 밑줄 자리 규칙이 같은 두 층에 한 층을 더한다 */
export const markerMask = (mask) => { const m = String(mask || ''); return m.startsWith('linear-gradient(') && m.includes('url('); };
/**
 * 1.7.0 글자가 띠 위인가 (순수 함수). chain = 글자의 부모부터 .mes_text 바로 아래까지의 계산된 모양
 *   [{ tag, display, backgroundColor, backgroundImage, backgroundClip, mask }] (안쪽부터).
 * 띠 = 대사(q) · 형광펜(mark) 가운데 바탕(색 · 그림)을 칠한 것 — 취소선 · 코드 · 금빛 강조처럼 다른 꾸밈 바탕은 띠가 아니다. 첫 블록에서 멈춘다.
 * → null | { index, slot, color } — slot = 테마 형광펜 마스크 + 단색 띠(밑줄 자리를 열 수 있음), color = 띠 색('#rrggbb' | null)
 */
export function bandFrom(chain) {
    for (let i = 0; i < (chain || []).length; i++) {
        const s = chain[i] || {};
        if (!String(s.display || 'inline').startsWith('inline')) return null;
        const tag = String(s.tag || '').toUpperCase();
        if (tag !== 'Q' && tag !== 'MARK') continue;
        if (s.backgroundClip === 'text') continue;
        const image = !!s.backgroundImage && s.backgroundImage !== 'none';
        if (!(alphaOf(s.backgroundColor) > 0.02 || image)) continue;
        return { index: i, slot: markerMask(s.mask) && !image, color: colorKey(s.backgroundColor) };
    }
    return null;
}

/**
 * 조각 하나의 밑줄 색(key, '' = 테마 색)과 글자 칠 고정(pin, '' = 없음). piece: { color, fill?, band?, slot?, bandColor? }
 *   띠 없음: 보이는 글자색(글자 칠, 없으면 color) — 본문색과 가까우면 테마 색 (1.6.9 그대로). 칠이 투명(그라데이션 글자)이면 테마 색.
 *   밑줄 자리를 여는 띠(slot): 띠 색 — 띠 아랫단과 한 줄이 된다 (색 톤 맞추기의 띠 색도 그대로).
 *   그 밖의 띠: 보이는 글자색 — 본문색과 가까워도 (테마 색 띠 위 테마 색 밑줄은 안 보인다).
 *   글자 칠이 color 와 다르면 그 칠로 고정 — 하이라이트가 글자를 color 로 다시 칠하지 않게.
 */
export function pieceKey(piece, plainKey, follow = true) {
    const color = colorKey(piece?.color);
    const fill = piece?.fill ? colorKey(piece.fill) : color;
    const paint = piece?.fill ? paintKey(piece.fill) : null;
    const pin = paint && paint !== paintKey(piece?.color) ? paint : '';
    let key = '';
    if (follow) {
        if (piece?.band && piece?.slot) key = colorKey(piece.bandColor) || color || fill || '';
        else if (piece?.band) key = fill || color || '';
        else { key = piece?.fill ? (fill || '') : (color || ''); if (key && nearColor(key, plainKey)) key = ''; }
    }
    return { key, pin };
}
/**
 * 1.7.1 (테마 6.1.8) 재생 막대의 이름 색 = 읽는 줄의 대사 색 (순수 함수). 사용자: 「tts 밑에 이름 뜨는 것도 대사 색깔이랑 맞춰 주삼 대사 색 있는 애들은」.
 * pieces = piecesOf 조각 (color · start/end), exclude = 「색 없음」으로 볼 색들 (본문 · 테마 대사색 · 형광펜 잉크).
 * → 그 밖의 색 가운데 가장 많은 글자를 차지한 '#rrggbb', 없으면 '' (색 없는 인물 · 지문 → 테마 색 그대로).
 * 글자 칠이 아니라 color 를 본다 — 형광펜 대사는 칠이 잉크이고 color 가 인물 색(띠 색)이다. 투명 · 반투명 색(그라데이션 글자)은 세지 않는다.
 */
/**
 * 6.3.9 그 줄 화자의 팔레트 색(known)이 화면 글자색으로 보이면 그 색 ('#rrggbb'), 아니면 ''. speakerColor 의 「테마 잉크와 가까우면 색 없음」보다 먼저 —
 * 팔레트 색이 테마의 굵게 · 인용 색과 가까운 인물(레몬 노랑 · 하늘색)도 막대 이름에 제 색이 나오게. tolerance 는 좁게(6): 테마 잉크 그대로인 글자는 거의 늘 그 밖이다
 */
export function ownSpeakerColor(pieces, known, tolerance = 6) {
    const want = colorKey(known);
    if (!want) return '';
    return (pieces || []).some(p => p && !p.blank && nearColor(colorKey(p.color), want, tolerance)) ? want.slice(0, 7) : '';
}
export function speakerColor(pieces, exclude = []) {
    const skip = (exclude || []).map(colorKey).filter(Boolean);
    const weight = new Map();
    for (const p of pieces || []) {
        if (!p || p.blank) continue;
        const key = colorKey(p.color);
        if (!key || skip.some(s => nearColor(key, s))) continue;
        const n = Number.isInteger(p.start) && Number.isInteger(p.end) ? Math.max(1, p.end - p.start) : Math.max(1, String(p.text || '').length);
        weight.set(key, (weight.get(key) || 0) + n);
    }
    let best = '', most = 0;
    for (const [key, n] of weight) if (n > most) { best = key; most = n; }
    return best;
}
/** 묶음 이름 ↔ { key, pin } — 'key' 또는 'key|pin' ('' = 테마 색 · 고정 없음) */
export const groupId = (key, pin) => (pin ? `${key}|${pin}` : key);
export function splitGroup(id) { const [key = '', pin = ''] = String(id ?? '').split('|'); return { key, pin }; }

/**
 * 조각들을 색으로 묶는다. pieces: [{ color, fill?, band?, slot?, bandColor?, blank?, ...anything }] (색 = 계산된 값), plainColor = 본문(.mes_text) 색.
 * 돌려주는 값: Map(묶음 이름 → pieces) — '' = 테마 색, '#rrggbb' = 그 색 밑줄, '…|칠' = 글자 칠 고정. 색 종류가 limit 을 넘으면 넘친 색은 테마 색으로.
 * follow = false (스위치 끔 · 색깔만) 면 밑줄 색은 모두 테마 색이고 글자 칠 고정만 남는다.
 */
export function groupByColor(pieces, plainColor, limit = COLOR_LIMIT, { follow = true } = {}) {
    const plain = colorKey(plainColor);
    const groups = new Map();
    let colors = 0;
    // 빈칸만 든 조각(blank — 글자 사이 띄어쓰기 노드)은 색을 정하지 않고 앞 조각의 묶음을 따른다 (맨 앞이면 다음 조각) — 빼면 칠 · 밑줄이 띄어쓰기마다 끊긴다
    const ids = pieces.map(piece => {
        if (piece.blank) return null;
        const { key, pin } = pieceKey(piece, plain, follow);
        let id = groupId(key, pin);
        if (id && !groups.has(id)) {
            if (colors >= limit) id = '';
            else { colors++; groups.set(id, []); }
        }
        return id;
    });
    let last = ids.find(k => k !== null) ?? '';
    pieces.forEach((piece, i) => {
        const id = ids[i] === null ? last : (last = ids[i]);
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(piece);
    });
    return groups;
}

/** 묶음 하나의 ::highlight 규칙 — 테마 규칙(style.css)과 같은 모양 · 같은 진하기. 색칠(배경)은 테마 색 그대로, 밑줄은 key(없으면 테마 색), pin 이면 글자 칠 고정 */
export function highlightRule(style, key, pin = '') {
    const name = highlightName(style, key, pin);
    const fixed = pin ? ` color: ${pin}; -webkit-text-fill-color: ${pin};` : '';
    if (style === 'color') return `::highlight(${name}) { ${THEME_FILL}${fixed} }`;
    const line = `text-decoration: underline; text-decoration-color: ${key ? `color-mix(in srgb, ${key} 70%, transparent)` : THEME_LINE}; text-underline-offset: 2px;`;
    return `::highlight(${name}) { ${style === 'underline' ? line : `${THEME_FILL} ${line}`}${fixed} }`;
}

// ───────── 아래는 브라우저에서만 ─────────
const STYLE_ID = 'lv-highlight-colors';
const rules = new Map(); // 하이라이트 이름 → 규칙 (한 번 만든 규칙은 남겨 둔다 — 같은 인물 색이 다음 줄에도 나온다)
const active = new Set(); // 지금 걸려 있는 이름 (지울 때)
const slotted = new Set(); // 지금 밑줄 자리를 연 띠 요소
const RULE_LIMIT = 96;

function ensureRule(style, key, pin) {
    const name = highlightName(style, key, pin);
    if (rules.has(name)) return name;
    if (rules.size >= RULE_LIMIT) {
        // 오래된 규칙부터 뺀다 (지금 걸려 있는 이름은 남긴다)
        for (const old of rules.keys()) { if (rules.size < RULE_LIMIT) break; if (!active.has(old)) rules.delete(old); }
    }
    rules.set(name, highlightRule(style, key, pin));
    let tag = document.getElementById(STYLE_ID);
    if (!tag) { tag = document.createElement('style'); tag.id = STYLE_ID; document.head.append(tag); }
    tag.textContent = [...rules.values()].join('\n');
    return name;
}

/** 범위들을 글자 노드 조각으로 자른다 → [{ node, start, end, color, fill, band, slot, bandColor, bandEl, blank }] (색 · 띠는 부모 요소마다 한 번만 계산) */
export function piecesOf(ranges, root = null) {
    const out = [];
    const info = new Map();
    const styles = new Map();
    const styleOf = el => {
        if (!styles.has(el)) {
            const cs = getComputedStyle(el);
            styles.set(el, { tag: el.tagName, display: cs.display, backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage, backgroundClip: cs.backgroundClip, mask: cs.webkitMaskImage || cs.maskImage || '', color: cs.color, fill: cs.webkitTextFillColor || cs.getPropertyValue('-webkit-text-fill-color') || '' });
        }
        return styles.get(el);
    };
    const look = el => {
        if (info.has(el)) return info.get(el);
        let v = { color: '', fill: '', band: false, slot: false, bandColor: null, bandEl: null };
        if (el) {
            const els = [];
            for (let a = el; a && a !== root && a.nodeType === 1; a = a.parentElement) els.push(a);
            const b = bandFrom(els.map(styleOf));
            const own = styleOf(el);
            v = { color: own.color, fill: own.fill, band: !!b, slot: !!b?.slot, bandColor: b?.color || null, bandEl: b ? els[b.index] : null };
        }
        info.set(el, v);
        return v;
    };
    for (const range of ranges) {
        const top = range.commonAncestorContainer;
        if (top.nodeType === 3) { out.push({ node: top, start: range.startOffset, end: range.endOffset, ...look(top.parentElement) }); continue; }
        const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT);
        for (let n; (n = walker.nextNode());) {
            if (!range.intersectsNode(n)) continue;
            const start = n === range.startContainer ? range.startOffset : 0;
            const end = n === range.endContainer ? range.endOffset : n.nodeValue.length;
            if (end <= start) continue;
            // 빈칸만 든 조각도 남긴다 (예전처럼 줄 전체가 이어져 칠해지게) — 색은 앞뒤 조각을 따른다 (groupByColor)
            const blank = !n.nodeValue.slice(start, end).trim();
            out.push(blank ? { node: n, start, end, color: '', fill: '', band: false, slot: false, bandColor: null, bandEl: null, blank } : { node: n, start, end, ...look(n.parentElement), blank });
        }
    }
    return out;
}

function clearHighlightsOnly() {
    try {
        for (const name of Object.values(HIGHLIGHT_BASE)) CSS.highlights.delete(name);
        for (const name of active) CSS.highlights.delete(name);
    } catch { /* 무시 */ }
    active.clear();
}
/** 밑줄 자리를 이 요소들로 맞춘다 — 바뀐 것만 붙이고 뗀다 (다시 칠할 때마다 같은 속성을 뗐다 붙이지 않게) */
function setSlots(want) {
    for (const el of [...slotted]) if (!want.has(el)) { try { el.removeAttribute(LINE_SLOT); } catch { /* 떨어진 요소 */ } slotted.delete(el); }
    for (const el of want) if (!slotted.has(el)) { try { el.setAttribute(LINE_SLOT, ''); slotted.add(el); } catch { /* 무시 */ } }
}
/** 지운다: 테마 색 이름 + 색별 이름 모두 · 연 밑줄 자리 */
export function clearColorHighlights() {
    clearHighlightsOnly();
    setSlots(new Set());
}

function paintTheme(style, ranges) {
    const name = highlightName(style, '');
    CSS.highlights.set(name, new Highlight(...ranges));
    active.add(name);
}

/**
 * 범위들을 칠한다. root = 읽는 메시지의 .mes_text (그 색이 '보통 글자' 기준), style = both | color | underline,
 * follow = 밑줄 색: 글자색 따라가기 (끄면 · 색깔만이면 밑줄은 테마 색 하나 — 글자 칠 고정은 그대로). 범위를 못 나누면 테마 색 하나로.
 */
export function paintColorHighlights(root, ranges, style, { follow = true } = {}) {
    clearHighlightsOnly();
    const slots = new Set();
    if (!ranges.length) { setSlots(slots); return; }
    const following = followsTextColor(style, follow);
    let groups;
    try { groups = groupByColor(piecesOf(ranges, root), getComputedStyle(root).color, COLOR_LIMIT, { follow: following }); } catch { groups = null; }
    if (!groups || !groups.size) { paintTheme(style, ranges); setSlots(slots); return; }
    for (const [id, pieces] of groups) {
        const { key, pin } = splitGroup(id);
        const name = key || pin ? ensureRule(style, key, pin) : highlightName(style, '');
        const parts = pieces.map(p => { const r = document.createRange(); r.setStart(p.node, p.start); r.setEnd(p.node, p.end); return r; });
        CSS.highlights.set(name, new Highlight(...parts));
        active.add(name);
        // 글자색을 따라 밑줄을 그을 때만 단색 띠의 밑줄 자리를 연다 (색깔만 · 스위치 끔이면 열지 않는다)
        if (following && key) for (const p of pieces) if (p.slot && p.bandEl) slots.add(p.bandEl);
    }
    setSlots(slots);
}
