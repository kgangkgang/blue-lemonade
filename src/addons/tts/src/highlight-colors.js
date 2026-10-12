// 1.6.9 (테마 6.1.6) 재생 표시의 밑줄이 그 글자의 색을 따라가게 — 사용자: 「tts 재생표시 밑줄 글자색 따라가게」, 「속마음이나 대사 글자색은 보통 다르니까」,
//   「대사색 따라서 밑줄 치는 건 기본으로 켜 두되 싫어하는 사람도 있을 수 있으니 밑줄을 고른 사람들에게만 물어보는 걸로」.
// ::highlight() 안의 currentColor 는 글자마다의 색이 아니라 하이라이트 자체 색으로 풀려서(시험대에서 빨강 · 파랑 · 초록 글자 밑줄이 전부 검정)
// CSS 만으로는 안 된다 → 읽는 범위를 글자 노드마다 잘라 그 부모 요소의 계산된 color 로 묶고, 색마다 하이라이트 이름 + ::highlight 규칙을 따로 만든다.
// - 따라가는 것은 밑줄만. 색칠(배경)은 예전처럼 테마 색 — 스위치는 밑줄을 고른 사람에게만 보이므로, '색깔만' 을 고른 사람의 표시는 그대로여야 한다.
// - 색이 없는 보통 글자(본문 글자색과 같거나 아주 가까운 색)는 테마 색 — 본문 색 그대로 밑줄을 그으면 글자와 같은 색이라 표시가 안 보인다.
// - 형광펜 대사는 글자 칠(-webkit-text-fill-color)이 테마 잉크이고 color 가 인물 색(형광펜 띠 색)이라, color 를 따르면 밑줄이 그 인물 형광펜 색과 맞는다.
// 위 절반(순수 함수)은 node 로 시험한다 (tools/tests/tts-highlight-colors.mjs).

export const HIGHLIGHT_BASE = Object.freeze({ both: 'lv-now', color: 'lv-now-color', underline: 'lv-now-underline' });
export const COLOR_LIMIT = 24;   // 한 줄에 색이 이보다 많을 일은 없다 — 넘친 색은 테마 색으로
export const NEAR_PLAIN = 24;    // 채널마다 이만큼 안쪽이면 본문 글자색과 같은 색으로 본다 (테마 대사 #f5f5f7 ↔ 본문 #e1e1e5 같은 것)
const THEME_FILL = 'background-color: color-mix(in srgb, var(--SmartThemeQuoteColor, #51a0de) 28%, transparent);';

/** 계산된 색('rgb(…)' · 'rgba(…)' · '#rgb' · '#rrggbb') → '#rrggbb'. 투명 · 반쯤 투명 · 모르는 값이면 null */
export function colorKey(value) {
    const text = String(value ?? '').trim().toLowerCase();
    let m = /^#([0-9a-f]{3})$/.exec(text);
    if (m) return `#${[...m[1]].map(c => c + c).join('')}`;
    m = /^#([0-9a-f]{6})$/.exec(text);
    if (m) return `#${m[1]}`;
    m = /^color\(srgb\s+([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+%?)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(text);
    if (m) {
        // color-mix() 결과(내 메시지 글자 진하기 등)는 color(srgb 0~1 0~1 0~1 / a) 로 읽힌다
        const unit = v => (v.endsWith('%') ? Number(v.slice(0, -1)) / 100 : Number(v)) * 255;
        m = [m[0], unit(m[1]), unit(m[2]), unit(m[3]), m[4]];
    } else m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(text);
    if (!m) return null;
    if (m[4] !== undefined) {
        const a = m[4].endsWith('%') ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
        if (!(a >= 0.5)) return null; // 반쯤 투명한 글자색은 밑줄 색으로 못 쓴다
    }
    const hex = [m[1], m[2], m[3]].map(v => Math.max(0, Math.min(255, Math.round(Number(v)))).toString(16).padStart(2, '0')).join('');
    return `#${hex}`;
}

/** 두 '#rrggbb' 가 채널마다 tolerance 안쪽인가 */
export function nearColor(a, b, tolerance = NEAR_PLAIN) {
    if (!a || !b) return false;
    for (const i of [1, 3, 5]) if (Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) > tolerance) return false;
    return true;
}

/** 하이라이트 이름: 테마 색이면 예전 이름 그대로, 아니면 뒤에 -c-rrggbb */
export function highlightName(style, key) {
    const base = HIGHLIGHT_BASE[style] || HIGHLIGHT_BASE.both;
    return key ? `${base}-c-${key.slice(1)}` : base;
}

/** 이 설정에서 밑줄 색을 글자색으로 따라가는가 — 밑줄이 들어가는 표시(both · underline)이고 스위치가 켜져 있을 때 */
export const followsTextColor = (style, follow = true) => follow !== false && (style === 'both' || style === 'underline');

/**
 * 조각들을 색으로 묶는다. pieces: [{ color, ...anything }] (color = 계산된 색 문자열), plainColor = 본문(.mes_text) 색.
 * 돌려주는 값: Map(key → pieces) — key 가 '' 이면 테마 색. 색 종류가 limit 을 넘으면 넘친 색은 테마 색 묶음으로.
 */
export function groupByColor(pieces, plainColor, limit = COLOR_LIMIT) {
    const plain = colorKey(plainColor);
    const groups = new Map();
    let colors = 0;
    // 빈칸만 든 조각(blank — 글자 사이 띄어쓰기 노드)은 색을 정하지 않고 앞 조각의 묶음을 따른다 (맨 앞이면 다음 조각) — 빼면 칠 · 밑줄이 띄어쓰기마다 끊긴다
    const keys = pieces.map(piece => {
        if (piece.blank) return null;
        let key = colorKey(piece.color);
        if (!key || nearColor(key, plain)) key = '';
        if (key && !groups.has(key)) { if (colors >= limit) key = ''; else { colors++; groups.set(key, []); } }
        return key;
    });
    let last = keys.find(k => k !== null) ?? '';
    pieces.forEach((piece, i) => {
        const key = keys[i] === null ? last : (last = keys[i]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(piece);
    });
    return groups;
}

/** 색 하나의 ::highlight 규칙 — 테마 규칙(style.css)과 같은 모양 · 같은 진하기. 색칠(배경)은 테마 색 그대로, 밑줄만 그 글자색 */
export function highlightRule(style, key) {
    const name = highlightName(style, key);
    const line = `text-decoration: underline; text-decoration-color: color-mix(in srgb, ${key} 70%, transparent); text-underline-offset: 2px;`;
    return `::highlight(${name}) { ${style === 'underline' ? line : `${THEME_FILL} ${line}`} }`;
}

// ───────── 아래는 브라우저에서만 ─────────
const STYLE_ID = 'lv-highlight-colors';
const rules = new Map(); // 하이라이트 이름 → 규칙 (한 번 만든 규칙은 남겨 둔다 — 같은 인물 색이 다음 줄에도 나온다)
const active = new Set(); // 지금 걸려 있는 이름 (지울 때)
const RULE_LIMIT = 96;

function ensureRule(style, key) {
    const name = highlightName(style, key);
    if (rules.has(name)) return name;
    if (rules.size >= RULE_LIMIT) {
        // 오래된 규칙부터 뺀다 (지금 걸려 있는 이름은 남긴다)
        for (const old of rules.keys()) { if (rules.size < RULE_LIMIT) break; if (!active.has(old)) rules.delete(old); }
    }
    rules.set(name, highlightRule(style, key));
    let tag = document.getElementById(STYLE_ID);
    if (!tag) { tag = document.createElement('style'); tag.id = STYLE_ID; document.head.append(tag); }
    tag.textContent = [...rules.values()].join('\n');
    return name;
}

/** 범위들을 글자 노드 조각으로 자른다 → [{ node, start, end, color }] (색은 부모 요소마다 한 번만 계산) */
export function piecesOf(ranges) {
    const out = [];
    const colors = new Map();
    const colorOf = el => { if (!colors.has(el)) colors.set(el, el ? getComputedStyle(el).color : ''); return colors.get(el); };
    for (const range of ranges) {
        const root = range.commonAncestorContainer;
        if (root.nodeType === 3) { out.push({ node: root, start: range.startOffset, end: range.endOffset, color: colorOf(root.parentElement) }); continue; }
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n; (n = walker.nextNode());) {
            if (!range.intersectsNode(n)) continue;
            const start = n === range.startContainer ? range.startOffset : 0;
            const end = n === range.endContainer ? range.endOffset : n.nodeValue.length;
            if (end <= start) continue;
            // 빈칸만 든 조각도 남긴다 (예전처럼 줄 전체가 이어져 칠해지게) — 색은 앞뒤 조각을 따른다 (groupByColor)
            const blank = !n.nodeValue.slice(start, end).trim();
            out.push({ node: n, start, end, color: blank ? '' : colorOf(n.parentElement), blank });
        }
    }
    return out;
}

/** 지운다: 테마 색 이름 + 색별 이름 모두 */
export function clearColorHighlights() {
    try {
        for (const name of Object.values(HIGHLIGHT_BASE)) CSS.highlights.delete(name);
        for (const name of active) CSS.highlights.delete(name);
    } catch { /* 무시 */ }
    active.clear();
}

function paintTheme(style, ranges) {
    const name = highlightName(style, '');
    CSS.highlights.set(name, new Highlight(...ranges));
    active.add(name);
}

/**
 * 범위들을 칠한다. root = 읽는 메시지의 .mes_text (그 색이 '보통 글자' 기준), style = both | color | underline,
 * follow = 밑줄 색: 글자색 따라가기 (끄면 · 색깔만이면 예전처럼 테마 색 하나). 범위를 못 나누면 테마 색 하나로.
 */
export function paintColorHighlights(root, ranges, style, { follow = true } = {}) {
    clearColorHighlights();
    if (!ranges.length) return;
    if (!followsTextColor(style, follow)) { paintTheme(style, ranges); return; }
    let groups;
    try { groups = groupByColor(piecesOf(ranges), getComputedStyle(root).color); } catch { groups = null; }
    if (!groups || !groups.size) { paintTheme(style, ranges); return; }
    for (const [key, pieces] of groups) {
        const name = key ? ensureRule(style, key) : highlightName(style, '');
        const parts = pieces.map(p => { const r = document.createRange(); r.setStart(p.node, p.start); r.setEnd(p.node, p.end); return r; });
        CSS.highlights.set(name, new Highlight(...parts));
        active.add(name);
    }
}
