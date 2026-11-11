// 1.1.3 로그 복사 「깡통 로그」 틀 묶음 — 고칠 것 없이 눌러서 바로 쓸 만한 로그 글이 나오게(B안이 기본).
//   틀 셋: kkangtong(B안 · 기본) · kkangtong-mini(제목 줄 없이 로그 면만 · B안 색) · kkangtong-deep(C안 · 대사색으로 물든 진한 바탕).
//   색은 주인공 대사색 하나(K)에서 shared/char-tone.js 로 뽑아요 — 무채 바탕 + 대사 띠(.18) + 이름표 · 제목 밑줄만 대사색.
//   자동으로 들어가는 것: 대사 띠 다시 칠하기(화면 형광펜 세기와 상관없이 화자 색 .18) · 본문 글꼴 Salty Text 14.5/23.2 · 바깥 배경판 없음 ·
//   이름표는 말하는 사람이 둘 이상일 때만 · 모든 글자 대비 4.6(글자색 덮임 문턱 4.5).
//   640 고정 · 코멘트 칸 · 레몬 자리 · 그림 주소 옮기기는 원래 길(log-copy-presets.js fixedWidth · log-copy-lift.js · log-copy-lemon.js)이 해요.
// DOM 없는 순수 모듈(시험 tools/tests/log-copy-tone.mjs).
import { esc, tag, mark, nodesHtml } from './log-copy-render.js';
import { parseColor } from './shared/ink-paint.js';
import { tone, bandColor, fitInk, speakerColor, oklchOf } from './shared/char-tone.js';

export const TONE_SHAPES = ['kkangtong', 'kkangtong-mini', 'kkangtong-deep'];
export const LOG_FONT = Object.freeze({ 'font-family': "'Salty Text', RIDIBatang, 'Noto Serif KR', serif", 'font-size': '14.5px', 'line-height': '23.2px', 'letter-spacing': '-0.36px' });
const QUOTE_START = /^[\s​]*["“「『‘'«〈《]/;
const GRADIENT_COLOR = /linear-gradient\([^)]*?((?:rgba?\([^)]*\))|#[0-9a-f]{3,8})/i;
const CHROMA_MIN = 0.06;   // 이보다 채도가 높아야 「색 글자」로 봐요(무채 · 거의 회색은 본문)

const hexOf = value => { const c = parseColor(value); return c && c.a >= 0.05 ? `#${[c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('')}` : null; };
const chromatic = value => { const h = hexOf(value); return !!h && oklchOf(h).c >= CHROMA_MIN; };
/** 인라인 조각의 띠 색(형광펜 그림 · 꽉 찬 바탕) — 없으면 null */
function bandOf(style) {
    if (!style) return null;
    const image = style['background-image'];
    if (image && /linear-gradient/i.test(image)) { const m = image.match(GRADIENT_COLOR); if (m) return hexOf(m[1]); }
    const fill = parseColor(style['background-color']);
    return fill && fill.a > 0.02 ? hexOf(style['background-color']) : null;
}
const hasBand = nodes => (nodes ?? []).some(n => n.t === 'el' && !n.block && (bandOf(n.style) || hasBand(n.children)));
const textOf = nodes => nodes.map(n => (n.t === 'text' ? n.text : n.children ? textOf(n.children) : '')).join('');

/** 메시지 한 개의 화자 색: ① 띠 색 ② 따옴표로 시작하는 색 글자 ③ 이름표 색이 색 글자면 그것 — 없으면 null */
export function messageSpeakerColor(message) {
    let band = null, quote = null;
    const walk = (nodes) => {
        for (const node of nodes ?? []) {
            if (node.t !== 'el') continue;
            if (!node.block) {
                const b = bandOf(node.style);
                if (b && chromatic(b) && !band) band = b;
                if (!quote && node.style?.color && chromatic(node.style.color) && QUOTE_START.test(textOf(node.children))) quote = hexOf(node.style.color);
            }
            walk(node.children);
        }
    };
    walk(message?.nodes);
    const name = message?.nameStyle?.color && chromatic(message.nameStyle.color) ? hexOf(message.nameStyle.color) : null;
    return speakerColor(band ?? quote ?? name);
}

/**
 * 화자 표: 이름 → 색. lookup(name) 은 인물표(people.get(name)?.color)처럼 「정해 둔 색」 — 있으면 먼저.
 * main = 주인공 색(사용자 말이 아닌 메시지 가운데 글자 수가 가장 많은 사람)
 */
export function speakersOf(model, lookup = null) {
    const byName = new Map(), weight = new Map();
    for (const message of model?.messages ?? []) {
        const name = String(message.name ?? '').trim();
        let color = null;
        try { color = speakerColor(lookup?.(name)); } catch { color = null; }
        color ??= messageSpeakerColor(message);
        if (color && !byName.has(name)) byName.set(name, color);
        if (!message.user) weight.set(name, (weight.get(name) ?? 0) + textOf(message.nodes).length);
    }
    const ranked = [...weight.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    const mainName = ranked.find(name => byName.has(name)) ?? null;
    const names = new Set((model?.messages ?? []).map(m => String(m.name ?? '').trim()).filter(Boolean));
    return { byName, main: mainName ? byName.get(mainName) : null, mainName, count: names.size };
}

/**
 * 메시지 노드를 틀 색에 맞춰 다시 칠한 새 모델(원본은 그대로).
 *  - 띠(형광펜 · 꽉 찬 바탕)는 그 색상의 .18 띠로 · 띠 위 글자는 대사 글자색(무채)
 *  - 띠 없이 따옴표로 시작하는 색 글자(화면이 「글자 색」 대사 표시)는 띠로 바꿔요(대사색은 띠에)
 *  - 그 밖 글자색(속마음 · 강조 · 색 문단)은 본문 무채로 · 굵기 · 기울임은 그대로 · 문단 바탕은 걷어요(로그 면이 대신)
 */
export function retintModel(model, t, { speakers = null, font = true } = {}) {
    const band = color => { const c = bandColor(color, t.mode); return `linear-gradient(transparent 5%, ${c} 5%, ${c} 100%, transparent 100%)`; };
    // 대사가 아닌 글자는 색이 있어도 틀 본문색(무채)으로 — 속마음 · 강조는 색 없이 굵기 · 기울임으로 구분해요(대사색은 띠 · 이름표 · 제목 밑줄에만)
    const ink = color => (!color ? color : t.text);
    // 글꼴 통일: 문단(늘 글자 모양을 적어요)은 Salty Text 14.5 로 · 조각은 문단과 같은 글꼴이던 것만(코드 · 일부러 바꾼 글꼴은 그대로)
    let baseKeys = {};   // 지금 메시지의 화면 글자 모양(이것과 같은 값만 바꿔요 — 일부러 키운 글자 · 코드 글꼴은 그대로)
    const unify = (style) => {
        if (!font) return;
        for (const key of ['font-family', 'font-size', 'line-height', 'letter-spacing']) if (style[key] && style[key] === baseKeys[key]) style[key] = LOG_FONT[key];
    };
    const fix = (nodes, fallback) => (nodes ?? []).map((node) => {
        if (node.t !== 'el') return node;
        const style = { ...node.style };
        if (t.mode === 'light') delete style['text-shadow'];
        unify(style);
        const children = node.children;
        if (node.block) {
            delete style['background-color'];
            delete style['background-image'];
            if (style.color) style.color = ink(style.color);
            return { ...node, style, children: fix(children, fallback) };
        }
        const b = bandOf(style);
        if (b) {
            delete style['background-color'];
            style['background-image'] = band(chromatic(b) ? b : fallback);
            style.color = t.dialogue;
            return { ...node, style, children: strip(children) };
        }
        if (style.color && chromatic(style.color) && hasBand(children)) {   // 화자 색 글자로 감싼 띠 조각 — 바깥 색은 걷고 안쪽 띠가 칠해요
            delete style.color;
            return { ...node, style, children: fix(children, hexOf(node.style.color) ?? fallback) };
        }
        if (style.color && chromatic(style.color) && QUOTE_START.test(textOf(children))) {
            style['background-image'] = band(hexOf(style.color));
            style.color = t.dialogue;
            return { ...node, style, children: strip(children) };
        }
        if (style.color) style.color = ink(style.color);
        return { ...node, style, children: fix(children, fallback) };
    });
    // 띠 안쪽 조각: 대사 글자색을 물려받게 색 글자 · 겹친 띠만 걷어요(굵게 · 기울임 같은 모양은 그대로)
    const DROP = new Set(['color', 'background-image', 'background-color']);
    const strip = nodes => (nodes ?? []).map(node => (node.t === 'el' ? { ...node, style: Object.fromEntries(Object.entries(node.style ?? {}).filter(([k]) => !DROP.has(k) && !(t.mode === 'light' && k === 'text-shadow'))), children: strip(node.children) } : node));
    const messages = (model?.messages ?? []).map((message) => {
        const who = speakers?.byName?.get(String(message.name ?? '').trim()) ?? messageSpeakerColor(message);
        baseKeys = message.font ?? {};
        const base = { ...message.font, color: t.text, ...(font ? LOG_FONT : {}) };
        return { ...message, font: base, bubble: null, nodes: fix(message.nodes, who), speaker: who };
    });
    return { ...model, messages, base: { ...model.base, color: t.text, bg: t.log, ...(font ? LOG_FONT : {}) } };
}

const family = ui => ui?.family || "'Salty UI', Freesentation, 'Pretendard Variable', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
/** 이름표: 그 사람 색을 로그 면 대비 4.6 으로(A안 · 색 없음은 본문색) */
const nameInk = (t, color) => (t.plan === 'A' || !color ? t.text : fitInk(color, t.log) ?? t.text);

/** 로그 면(대사 · 서술) */
function logBody(model, t, o, speakers) {
    const showNames = o.names !== false && speakers.count > 1;   // 이름표는 말하는 사람이 둘 이상일 때만
    const rows = model.messages.map((message, i) => {
        const last = i === model.messages.length - 1;
        const name = showNames && message.name ? mark(tag('div', { color: nameInk(t, message.speaker), 'font-family': message.font['font-family'], 'font-size': '12.5px', 'font-weight': '650', 'line-height': '1.5', 'letter-spacing': message.font['letter-spacing'], margin: '0 0 2px', 'text-indent': '0' }, esc(message.name)), 'data-bl-name') : '';
        const wrap = { margin: last ? '0' : `0 0 ${o.gap === false ? '8px' : message.font['line-height'] || '1.6em'}` };
        return mark(tag('div', wrap, name + nodesHtml(message.nodes, { trimEdges: true, relayout: 'justify' })), 'data-bl-msg');
    }).join('');
    const box = { 'box-sizing': 'border-box', 'max-width': '100%', 'background-color': t.log, color: t.text, ...LOG_FONT, 'font-weight': '400', padding: '12px 16px', 'text-align': 'left', 'overflow-wrap': 'anywhere' };
    return tag('div', box, rows);
}
const scroller = (inner, height) => tag('div', { 'max-height': `${height}px`, 'overflow-y': 'auto', 'scrollbar-width': 'none' }, inner);

/**
 * 틀 그리기. o = { ui, fields, height, names, gap, mode('light'|'dark'), lookup(name → 정해 둔 색) }
 * @returns {{ html: string, tone: object, speakers: object }}
 */
export function drawTone(shape, model, o = {}) {
    if (!model?.messages?.length) return { html: '', tone: null, speakers: null };
    const plan = shape === 'kkangtong-deep' ? 'C' : 'B';
    const speakers = speakersOf(model, o.lookup);
    const t = tone(speakers.main, { mode: o.mode === 'light' ? 'light' : 'dark', plan });
    const painted = retintModel(model, t, { speakers, font: o.font !== false });
    const body = logBody(painted, t, o, speakers);
    const ui = o.ui ?? {};
    const outerStyle = { 'box-sizing': 'border-box', 'max-width': '100%', 'background-color': t.card, border: `1px solid ${t.line}`, 'border-radius': '12px', overflow: 'clip', color: t.text, 'font-family': family(ui), 'letter-spacing': ui.tracking || '-0.025em', 'text-align': 'left' };
    if (shape === 'kkangtong-mini') {
        // 제목 줄 없이 로그 면만 — 바깥 상자가 곧 로그 면(레몬은 빈 모서리를 찾아요)
        return { html: tag('div', { ...outerStyle, 'background-color': t.log }, scroller(body, o.height ?? 420)), tone: t, speakers };
    }
    const title = String(o.fields?.title ?? '').trim();
    const titleStyle = { color: t.title, 'font-family': family(ui), 'font-size': '20px', 'font-weight': '650', 'line-height': '1.4', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere', 'min-height': '28px', ...(t.rule && title ? { 'border-bottom': `2px solid ${t.rule}`, 'padding-bottom': '4px' } : {}) };
    // 제목이 비어도 머리 줄은 남겨요 — 왼쪽 위 레몬 자리
    const head = tag('div', { padding: '16px 16px 12px' }, tag('div', titleStyle, title ? tag('span', null, esc(title)).replace('<span', '<span data-f="title"') : ''));
    const log = tag('div', { margin: '0 12px 12px', 'border-radius': '8px', overflow: 'clip' }, scroller(body, o.height ?? 420));
    return { html: tag('div', outerStyle, head + log), tone: t, speakers };
}

// ── 본체 연결(틀 목록 · 시트)이 쓰는 것 ─────────────────────────
export const isToneShape = id => TONE_SHAPES.includes(id);
/** 그리지 않고 색만: 그 틀이 이 로그에 쓸 색 묶음과 화자 표(시트가 숨긴 글 알약 · 미리보기 바탕에 써요) */
export function toneFor(shape, model, o = {}) {
    const speakers = speakersOf(model, o.lookup);
    return { tone: tone(speakers.main, { mode: o.mode === 'light' ? 'light' : 'dark', plan: shape === 'kkangtong-deep' ? 'C' : 'B' }), speakers };
}
/**
 * 인물표 색 찾기(lookup) 만들기 — 「이름 숨김 · 바꾸기」로 이름이 바뀐 뒤에도 원래 이름으로 물어요.
 * @param {object[]} shown 지금 그릴 메시지(이름이 바뀌었을 수 있음) · @param {object[]} source 같은 차례의 원래 메시지 · @param {(name: string) => any} get people.get
 */
export function toneLookup(shown, source, get) {
    const real = new Map();
    const same = Array.isArray(source) && source.length === shown?.length;
    (shown ?? []).forEach((message, i) => { const key = String(message?.name ?? '').trim(); if (key && !real.has(key)) real.set(key, String((same ? source[i]?.name : message?.name) ?? '').trim()); });
    return (name) => { try { return get?.(real.get(String(name ?? '').trim()) ?? name)?.color ?? null; } catch { return null; } };
}
