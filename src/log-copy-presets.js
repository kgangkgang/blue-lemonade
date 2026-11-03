// 로그 복사 — 글꾸 틀(모양) 모음. 모두 블루 레몬에이드 디자인 언어로 새로 그렸다 (평평한 면 + 1px 선 · 모서리 12(작은 칸 8) · 판 알약 · 여백 16 · 사이 8 ·
// 제목 20/650 · 소제목 16/650 · 보조 13 · 알약 12). 색은 고른 에이드 팔레트의 실제 값(c.*)만 — 새 색 · 섞은 색 · 그라데이션 없음.
// 글꼴은 테마 화면 글꼴(ui.family) · 자간(ui.tracking, em), 로그 글은 화면에 보이던 모양 그대로(log-copy-capture.js).
// 출력은 인라인 style 만. data-f 표시는 시트 미리보기에서 눌러 고치는 칸 표시라 복사할 때 걷는다(log-copy-sheet.js).
// 시작 그래프 밖 — 시트를 열 때 받는다.
import { esc, tag, mark, nodesHtml, baseFont, logHtml, logMarkdown, logText, inkEverywhere } from './log-copy-render.js';
import { contrast, parseColor, cssColor } from './shared/ink-paint.js';
import { recolorLog } from './log-copy-words.js';

export { logMarkdown, logText };
export const HEIGHTS = { s: 280, m: 420, l: 600 };

// ── 부품 ─────────────────────────────────────────────────────
const F = (key, text, style = {}) => tag('span', style, esc(text)).replace('<span', `<span data-f="${key}"`);
const font = (ui, size, weight = '400', more = {}) => ({ 'font-family': ui.family, 'font-size': `${size}px`, 'font-weight': weight, 'letter-spacing': ui.tracking, ...more });
const box = { 'box-sizing': 'border-box', 'max-width': '100%' };

/** 판 알약: 12px · 높이 20 · 0 8 · 1px 선 · 모서리 10 (accent = 포인트 면) */
function pill(key, text, c, ui, accent = false) {
    return F(key, text, {
        display: 'inline-block', ...box, height: '20px', margin: '0 8px 8px 0', padding: '0 8px', 'vertical-align': 'middle',
        border: `1px solid ${accent ? c.accent : c.line}`, 'border-radius': '10px', 'background-color': accent ? c.accent : undefined, color: accent ? c.onAccent : c.muted,
        ...font(ui, 12, accent ? '650' : '400'), 'line-height': '18px', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis',
    });
}
/** 알약 줄 (알약 아래 8 여백을 줄이 먹는다) */
function pills(fields, c, ui, keys = ['mark', 'model', 'prompt']) {
    const list = keys.filter(key => fields[key]).map(key => pill(key, fields[key], c, ui, key === 'mark'));
    return list.length ? tag('div', { 'margin-bottom': '-8px', 'line-height': '0' }, list.join('')) : '';
}
const title = (fields, c, ui, size = 20, key = 'title') => (fields[key] ? tag('div', { color: c.text, ...font(ui, size, '650'), 'line-height': '1.4', 'overflow-wrap': 'anywhere' }, F(key, fields[key])) : '');
const muted = (key, text, c, ui, more = {}) => (text ? tag('div', { color: c.muted, ...font(ui, 13), 'line-height': '1.5', 'overflow-wrap': 'anywhere', ...more }, F(key, text)) : '');
const rule = c => tag('div', { height: '0', 'border-top': `1px solid ${c.line}` }, '');
const gap = n => tag('div', { height: `${n}px` }, '');
/** 글자로 쓸 색: 그 바탕에서 대비 4.5 이상이면 그 색, 아니면 팔레트 본문색 (붙인 곳 어디서나 읽히게) */
const readable = (color, bg, fallback) => (color && contrast(color, bg) >= 4.5 ? color : fallback);
/** 이름의 첫 글자(문자 · 숫자만 — 「[이름]」 같은 괄호는 건너뛰어요) */
const initial = name => [...String(name ?? '')].find(ch => /[\p{L}\p{N}]/u.test(ch)) ?? '';

/** 접는 추가 정보 — 테마 접힘 머리(36) 모양 */
function info(fields, c, ui, margin = '12px 16px 0') {
    if (!fields.info?.trim()) return '';
    const summary = tag('summary', { display: 'block', 'list-style': 'none', cursor: 'pointer', 'min-height': '36px', padding: '0 12px', color: c.text, ...font(ui, 13, '650'), 'line-height': '36px' },
        `추가 정보 ${tag('span', { color: c.muted, 'font-weight': '400' }, '▾')}`);
    const text = tag('div', { padding: '0 12px 12px', color: c.muted, ...font(ui, 13), 'line-height': '1.6', 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' }, F('info', fields.info.trim()));
    return tag('details', { display: 'block', margin, border: `1px solid ${c.line}`, 'border-radius': '8px', 'background-color': c.raised }, summary + text);
}
const foot = (fields, c, ui, more = {}) => (fields.tail?.trim() ? tag('div', { padding: '12px 16px', ...more }, muted('tail', fields.tail.trim(), c, ui)) : '');

/** 안쪽만 스크롤되는 칸 (높이 고정 · 스크롤바 숨김) */
const scroller = (inner, height, more = {}) => tag('div', { 'max-height': `${height}px`, 'overflow-y': 'auto', 'scrollbar-width': 'none', ...more }, inner);
/** 바깥 배경 (팔레트 바탕) */
const outer = (inner, c, ui) => tag('div', { ...box, padding: '16px', 'background-color': c.bg, 'border-radius': '12px', 'font-family': ui.family, 'letter-spacing': ui.tracking, 'text-align': 'left' }, inner);
/** 면 + 1px 선 카드 */
const sheet = (inner, c, extra = {}) => tag('div', { ...box, 'max-width': '640px', margin: '0 auto', 'background-color': c.surface, border: `1px solid ${c.line}`, 'border-radius': '12px', overflow: 'hidden', ...extra }, inner);

/** 화면에 보이던 로그 상자 그대로 (채팅 바탕 · 글자 모양) */
// 틀 안 로그는 화면보다 좁아요 — 화면의 양쪽 맞춤을 그대로 두면 낱말 사이가 벌어져서(미라 사고) 틀 안에서는 왼쪽 맞춤
const screenLog = (model, o) => logHtml(model, { names: o.names, gap: o.gap, frameless: false, relayout: 'justify' });

/** 로그를 팔레트 종이(bg) 위에 바로 흘린다 — 화면 글자색이 그 종이에서 안 읽히면(대비 < 3) 팔레트 글자색으로 */
function flowLog(model, o, bg, { names = o.names, nameKey = null } = {}) {
    const { c, ui } = o;
    return model.messages.map((message, i) => {
        const nameColor = message.nameStyle?.color && contrast(message.nameStyle.color, bg) >= 4.5 ? message.nameStyle.color : readable(c.accent, bg, c.text);
        const name = names && message.name ? mark(tag('div', { color: nameColor, ...font(ui, 13, '650'), 'line-height': '1.5', margin: '0 0 4px' }, esc(message.name)), 'data-bl-name') : '';
        const ink = contrast(message.font.color, bg) >= 4.5 ? message.font.color : c.text;
        return mark(tag('div', { ...baseFont(message.font), color: ink, margin: i === model.messages.length - 1 ? '0' : `0 0 ${o.gap ? '16px' : '8px'}`, 'overflow-wrap': 'anywhere' },
            name + nodesHtml(message.nodes, { inkFix: { bg, ink }, trimEdges: true, relayout: 'justify' })), 'data-bl-msg');
    }).join('');
}

const two = n => String(n).padStart(2, '0');
export function timeLabel(ms) {
    const d = new Date(ms);
    if (!Number.isFinite(d.getTime())) return '';
    const h = d.getHours();
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${two(d.getMinutes())}`;
}
export const clockLabel = (ms) => { const d = new Date(ms); return Number.isFinite(d.getTime()) ? `${two(d.getHours())}:${two(d.getMinutes())}` : ''; };
export function dateLabel(ms) {
    const d = new Date(ms ?? Date.now());
    if (!Number.isFinite(d.getTime())) return '';
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${'일월화수목금토'[d.getDay()]}요일`;
}

// ── 틀 ───────────────────────────────────────────────────────
// 각 틀: (model, o) → HTML. o = { c(팔레트 값), ui, fields(title · mark · model · prompt · tail · info · date · from), height, names, gap }

function card(model, o) {
    const { c, ui, fields } = o;
    const head = tag('div', { padding: '16px 16px 12px' }, title(fields, c, ui) + (fields.title ? gap(8) : '') + pills(fields, c, ui));
    const body = tag('div', { 'border-top': `1px solid ${c.line}` }, scroller(screenLog(model, o), o.height));
    const end = info(fields, c, ui) + (fields.tail?.trim() ? tag('div', { 'border-top': fields.info?.trim() ? '0' : `1px solid ${c.line}` }, foot(fields, c, ui)) : fields.info?.trim() ? gap(12) : '');
    return outer(sheet(head + body + end, c), c, ui);
}

function tabs(model, o) {
    const { c, ui, fields } = o;
    const labels = [['mark', fields.mark || 'LOG'], ['model', fields.model], ['prompt', fields.prompt]].filter(([, text]) => text);
    const row = labels.map(([key, label], i) => F(key, label, {
        display: 'inline-block', ...box, height: '32px', 'max-width': '40%', margin: '0 4px 0 0', padding: '0 12px', 'vertical-align': 'bottom',
        border: `1px solid ${c.line}`, 'border-bottom': '0', 'border-radius': '8px 8px 0 0', 'background-color': i ? c.raised : c.surface, color: i ? c.muted : c.text,
        ...font(ui, 13, i ? '400' : '650'), 'line-height': '31px', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis',
    })).join('');
    const head = fields.title ? tag('div', { padding: '12px 16px', 'border-bottom': `1px solid ${c.line}` }, title(fields, c, ui, 16)) : '';
    const end = info(fields, c, ui) + (fields.tail?.trim() ? tag('div', { 'border-top': `1px solid ${c.line}` }, foot(fields, c, ui)) : fields.info?.trim() ? gap(12) : '');
    const body = sheet(head + scroller(screenLog(model, o), o.height) + end, c, { 'border-radius': '0 12px 12px 12px', margin: '0' });
    return outer(tag('div', { 'max-width': '640px', margin: '0 auto' }, tag('div', { 'line-height': '0', 'white-space': 'nowrap', overflow: 'hidden', 'margin-bottom': '-1px' }, row) + body), c, ui);
}

function windowFrame(model, o) {
    const { c, ui, fields } = o;
    const left = tag('div', { 'min-width': '0', flex: '1 1 auto', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis', color: c.text, ...font(ui, 16, '650'), 'line-height': '1.4' }, F('title', fields.title || ''));
    const right = ['model', 'prompt', 'mark'].filter(key => fields[key]).map(key => pill(key, fields[key], c, ui, key === 'mark')).join('');
    const head = tag('div', { display: 'flex', 'align-items': 'center', gap: '8px', 'min-height': '44px', padding: '0 16px', 'background-color': c.raised, 'border-bottom': `1px solid ${c.line}` },
        left + (right ? tag('div', { flex: '0 1 auto', 'min-width': '0', 'line-height': '0', 'white-space': 'nowrap', overflow: 'hidden', 'margin-bottom': '-8px' }, right) : ''));
    const end = info(fields, c, ui) + (fields.tail?.trim() ? tag('div', { 'border-top': `1px solid ${c.line}`, 'background-color': c.raised }, foot(fields, c, ui)) : fields.info?.trim() ? gap(12) : '');
    return outer(sheet(head + scroller(screenLog(model, o), o.height) + end, c), c, ui);
}

const TIME_GAP = 30 * 60 * 1000;
function messenger(model, o) {
    const { c, ui, fields } = o;
    const name = fields.title || '';
    const avatar = tag('div', { flex: '0 0 auto', width: '36px', height: '36px', 'border-radius': '50%', 'background-color': c.raised, color: readable(c.accent, c.raised, c.text), 'text-align': 'center', ...font(ui, 16, '650'), 'line-height': '36px' }, esc(initial(name)));
    const meta = ['model', 'prompt'].filter(key => fields[key]).map(key => pill(key, fields[key], c, ui)).join('');
    const who = tag('div', { 'min-width': '0', flex: '1 1 auto' }, tag('div', { color: c.text, ...font(ui, 16, '650'), 'line-height': '1.4', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }, F('title', name))
        + (meta ? tag('div', { 'margin-top': '4px', 'margin-bottom': '-8px', 'line-height': '0', 'white-space': 'nowrap', overflow: 'hidden' }, meta) : ''));
    const head = tag('div', { display: 'flex', 'align-items': 'center', gap: '12px', padding: '12px 16px', 'background-color': c.surface, 'border-bottom': `1px solid ${c.line}` }, avatar + who + (fields.mark ? tag('div', { flex: '0 0 auto', 'line-height': '0', 'margin-bottom': '-8px' }, pill('mark', fields.mark, c, ui, true)) : ''));
    const characters = new Set(model.messages.filter(m => !m.user).map(m => m.name));
    let lastTime = null, lastSide = null;
    const rows = model.messages.map((message) => {
        let out = '';
        if (message.time && (lastTime === null || message.time - lastTime >= TIME_GAP || new Date(message.time).toDateString() !== new Date(lastTime).toDateString())) {
            out += tag('div', { margin: '12px 0', 'text-align': 'center', color: c.muted, ...font(ui, 12), 'line-height': '1.4' }, esc(timeLabel(message.time)));
            lastSide = null;
        }
        if (message.time) lastTime = message.time;
        const mine = message.user;
        const bg = mine ? c.accent : c.raised, ink = mine ? c.onAccent : c.text;
        const label = !mine && characters.size > 1 && lastSide !== message.name ? mark(tag('div', { margin: '0 0 4px 4px', color: c.muted, ...font(ui, 12), 'line-height': '1.4' }, esc(message.name)), 'data-bl-name') : '';
        const bubble = tag('div', {
            display: 'inline-block', ...box, 'max-width': '82%', padding: '8px 12px', 'text-align': 'left', 'vertical-align': 'top',
            'border-radius': mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', 'background-color': bg, ...baseFont(message.font), color: ink, 'overflow-wrap': 'anywhere',
        }, nodesHtml(message.nodes, { inkFix: { bg, ink }, trimEdges: true, relayout: true }));
        lastSide = mine ? '' : message.name;
        return out + mark(tag('div', { margin: '4px 0', 'text-align': mine ? 'right' : 'left' }, label + bubble), `data-bl-msg data-bl-who="${esc(message.name)}"`);
    }).join('');
    const body = tag('div', { height: `${o.height + 60}px`, 'max-height': '80vh', 'overflow-y': 'auto', 'scrollbar-width': 'none', padding: '4px 12px 12px', 'box-sizing': 'border-box', 'background-color': c.bg }, rows);
    const end = (fields.info?.trim() ? tag('div', { 'background-color': c.surface, 'border-top': `1px solid ${c.line}`, 'padding-bottom': '12px' }, info(fields, c, ui)) : '')
        + (fields.tail?.trim() ? tag('div', { 'background-color': c.surface, 'border-top': `1px solid ${c.line}` }, foot(fields, c, ui)) : '');
    return outer(tag('div', { ...box, 'max-width': '400px', margin: '0 auto', 'background-color': c.bg, border: `1px solid ${c.line}`, 'border-radius': '24px', overflow: 'hidden' }, head + body + end), c, ui);
}

/** 노트: 줄 공책 — 왼쪽 여백 선 하나 · 위에 날짜 */
function note(model, o) {
    const { c, ui, fields } = o;
    const head = tag('div', { padding: '16px 16px 12px 52px' }, muted('date', fields.date, c, ui, { 'margin-bottom': '4px' }) + title(fields, c, ui, 16) + (fields.title ? gap(8) : '') + pills(fields, c, ui));
    const body = scroller(tag('div', { margin: '0 16px 0 40px', padding: '12px 0 16px 12px', 'border-left': `1px solid ${c.accent}` }, flowLog(model, o, c.surface)), o.height, { 'border-top': `1px solid ${c.line}` });
    return outer(sheet(head + body + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

/** 편지: 좁은 종이 · To. / From. */
function letter(model, o) {
    const { c, ui, fields } = o;
    const to = fields.title ? tag('div', { color: c.text, ...font(ui, 16, '650'), 'line-height': '1.4', 'margin-bottom': '16px' }, `To. ${F('title', fields.title)}`) : '';
    const from = fields.from ? tag('div', { 'text-align': 'right', color: c.text, ...font(ui, 16, '650'), 'line-height': '1.4', 'margin-top': '16px' }, `From. ${F('from', fields.from)}`) : '';
    const date = muted('date', fields.date, c, ui, { 'text-align': 'right', 'margin-top': '4px' });
    const page = tag('div', { padding: '24px' }, to + scroller(flowLog(model, o, c.surface), o.height) + from + date + (pills(fields, c, ui) ? gap(16) + pills(fields, c, ui) : ''));
    return outer(sheet(page + info(fields, c, ui, '0 24px 24px') + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c, { 'max-width': '480px' }), c, ui);
}

/** 대본: 이름 칸 | 대사 칸 두 열 */
function script(model, o) {
    const { c, ui, fields } = o;
    const head = tag('div', { padding: '16px', 'border-bottom': `1px solid ${c.line}`, 'text-align': 'center' }, title(fields, c, ui, 16) + (fields.title ? gap(8) : '') + pills(fields, c, ui));
    const rows = model.messages.map((message) => {
        const nameColor = message.nameStyle?.color && contrast(message.nameStyle.color, c.surface) >= 4.5 ? message.nameStyle.color : readable(c.accent, c.surface, c.text);
        const ink = contrast(message.font.color, c.surface) >= 4.5 ? message.font.color : c.text;
        return mark(tag('tr', { 'background-color': c.surface }, mark(tag('td', { 'background-color': c.surface, 'vertical-align': 'top', padding: '0 12px 12px 0', color: nameColor, ...font(ui, 13, '650'), 'line-height': message.font['line-height'], 'text-align': 'right' }, esc(message.name)), 'data-bl-name')
            + tag('td', { 'background-color': c.surface, 'vertical-align': 'top', padding: '0 0 12px', ...baseFont(message.font), color: ink, 'overflow-wrap': 'anywhere' }, nodesHtml(message.nodes, { inkFix: { bg: c.surface, ink }, trimEdges: true, relayout: 'justify' }))), 'data-bl-msg');
    }).join('');
    const table = tag('table', { width: '100%', 'border-collapse': 'collapse', 'table-layout': 'fixed', 'background-color': c.surface }, `<colgroup><col style="width:76px"><col></colgroup>${rows}`);
    return outer(sheet(head + scroller(tag('div', { padding: '16px 16px 4px' }, table), o.height) + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

/** 일기: 큰 날짜 머리 */
function diary(model, o) {
    const { c, ui, fields } = o;
    const head = tag('div', { padding: '16px', 'border-bottom': `1px solid ${c.line}` },
        tag('div', { color: c.text, ...font(ui, 20, '650'), 'line-height': '1.4' }, F('date', fields.date || '')) + muted('title', fields.title, c, ui, { 'margin-top': '4px' }) + (pills(fields, c, ui) ? gap(8) + pills(fields, c, ui) : ''));
    return outer(sheet(head + scroller(tag('div', { padding: '16px' }, flowLog(model, o, c.surface)), o.height) + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

/** 폰 알림: 메시지마다 알림 카드 한 장 */
function notify(model, o) {
    const { c, ui, fields } = o;
    const cards = model.messages.map((message) => {
        const ink = contrast(message.font.color, c.surface) >= 4.5 ? message.font.color : c.text;
        const dot = tag('span', { display: 'inline-block', width: '20px', height: '20px', 'border-radius': '50%', 'background-color': message.user ? c.raised : c.accent, color: message.user ? readable(c.accent, c.raised, c.text) : c.onAccent, 'text-align': 'center', ...font(ui, 12, '650'), 'line-height': '20px', 'vertical-align': 'middle', 'margin-right': '8px' }, esc(initial(message.name)));
        const top = tag('div', { 'margin-bottom': '4px', 'line-height': '20px', 'white-space': 'nowrap', overflow: 'hidden' }, dot + mark(tag('span', { color: c.text, ...font(ui, 13, '650'), 'vertical-align': 'middle' }, esc(message.name)), 'data-bl-name') + (message.time ? tag('span', { float: 'right', color: c.muted, ...font(ui, 12), 'line-height': '20px' }, esc(clockLabel(message.time))) : ''));
        return mark(tag('div', { ...box, margin: '0 0 8px', padding: '12px', 'background-color': c.surface, border: `1px solid ${c.line}`, 'border-radius': '12px' },
            top + tag('div', { ...baseFont(message.font), color: ink, 'overflow-wrap': 'anywhere' }, nodesHtml(message.nodes, { inkFix: { bg: c.surface, ink }, trimEdges: true, relayout: true }))), 'data-bl-msg');
    }).join('');
    const head = tag('div', { 'text-align': 'center', 'margin-bottom': '12px' }, title(fields, c, ui, 16) + (pills(fields, c, ui) ? gap(8) + pills(fields, c, ui) : ''));
    return outer(tag('div', { ...box, 'max-width': '400px', margin: '0 auto' }, head + scroller(cards, o.height + 60) + info(fields, c, ui, '4px 0 0') + (fields.tail?.trim() ? muted('tail', fields.tail.trim(), c, ui, { 'text-align': 'center', 'margin-top': '8px' }) : '')), c, ui);
}

/** 기사: 머리기사 · 줄 · 기자란 */
function article(model, o) {
    const { c, ui, fields } = o;
    const kicker = fields.mark ? tag('div', { 'margin-bottom': '8px', 'line-height': '0' }, pill('mark', fields.mark, c, ui, true).replace('margin:0 8px 8px 0', 'margin:0')) : '';
    const byline = [fields.model, fields.prompt].filter(Boolean).length ? tag('div', { color: c.muted, ...font(ui, 13), 'line-height': '1.5', 'margin-top': '8px' }, [fields.model ? F('model', fields.model) : '', fields.prompt ? F('prompt', fields.prompt) : ''].filter(Boolean).join(' · ')) : '';
    const head = tag('div', { padding: '16px 16px 12px', 'border-bottom': `1px solid ${c.text}` }, kicker + title(fields, c, ui, 20) + byline + muted('date', fields.date, c, ui, { 'margin-top': '4px' }));
    return outer(sheet(head + scroller(tag('div', { padding: '16px' }, flowLog(model, o, c.surface)), o.height) + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c, { 'border-radius': '8px' }), c, ui);
}

/** 책 페이지: 넓은 양쪽 여백 · 위 제목 · 아래 쪽 번호 */
function book(model, o) {
    const { c, ui, fields } = o;
    const top = fields.title ? tag('div', { 'text-align': 'center', color: c.muted, ...font(ui, 13), 'line-height': '1.5', 'margin-bottom': '16px' }, F('title', fields.title)) : '';
    const number = tag('div', { 'text-align': 'center', color: c.muted, ...font(ui, 13), 'line-height': '1.5', 'margin-top': '16px' }, `— ${F('page', fields.page || '1')} —`);
    const page = tag('div', { padding: '24px 32px' }, top + scroller(flowLog(model, o, c.surface, { names: o.names }), o.height) + number);
    return outer(sheet(page + info(fields, c, ui, '0 32px 24px'), c, { 'max-width': '520px', 'border-radius': '8px' }), c, ui);
}

/** 채팅 기록: 시각 칸 | 이름 + 글 */
function record(model, o) {
    const { c, ui, fields } = o;
    const head = tag('div', { display: 'flex', 'align-items': 'center', gap: '8px', 'min-height': '44px', padding: '0 16px', 'border-bottom': `1px solid ${c.line}` },
        tag('div', { flex: '1 1 auto', 'min-width': '0', color: c.text, ...font(ui, 16, '650'), 'line-height': '1.4', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }, F('title', fields.title || ''))
        + tag('div', { flex: '0 1 auto', 'min-width': '0', 'line-height': '0', 'white-space': 'nowrap', overflow: 'hidden', 'margin-bottom': '-8px' }, ['model', 'prompt'].filter(key => fields[key]).map(key => pill(key, fields[key], c, ui)).join('')));
    const rows = model.messages.map((message, i) => {
        const nameColor = message.nameStyle?.color && contrast(message.nameStyle.color, c.surface) >= 4.5 ? message.nameStyle.color : readable(c.accent, c.surface, c.text);
        const ink = contrast(message.font.color, c.surface) >= 4.5 ? message.font.color : c.text;
        return mark(tag('tr', { 'background-color': c.surface }, tag('td', { 'background-color': c.surface, 'vertical-align': 'top', padding: '12px 8px 12px 0', color: c.muted, ...font(ui, 12), 'line-height': '1.6', 'white-space': 'nowrap', 'border-top': i ? `1px solid ${c.line}` : '0' }, esc(message.time ? clockLabel(message.time) : `#${message.index ?? i}`))
            + tag('td', { 'background-color': c.surface, 'vertical-align': 'top', padding: '12px 0', ...baseFont(message.font), color: ink, 'overflow-wrap': 'anywhere', 'border-top': i ? `1px solid ${c.line}` : '0' },
                mark(tag('div', { color: nameColor, ...font(ui, 13, '650'), 'line-height': '1.5', 'margin-bottom': '4px' }, esc(message.name)), 'data-bl-name') + nodesHtml(message.nodes, { inkFix: { bg: c.surface, ink }, trimEdges: true, relayout: 'justify' }))), 'data-bl-msg');
    }).join('');
    const table = tag('table', { width: '100%', 'border-collapse': 'collapse', 'table-layout': 'fixed', 'background-color': c.surface }, `<colgroup><col style="width:44px"><col></colgroup>${rows}`);
    return outer(sheet(head + scroller(tag('div', { padding: '0 16px' }, table), o.height) + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

/** 상태창 카드: 이름 · 값 2열 칸 + 로그 */
function status(model, o) {
    const { c, ui, fields } = o;
    const cells = [['모델', 'model'], ['프롬프트', 'prompt'], ['메시지', 'count'], ['날짜', 'date']].filter(([, key]) => fields[key]);
    const cell = ([label, key]) => tag('td', { 'background-color': c.surface, width: '50%', padding: '4px', 'vertical-align': 'top' }, tag('div', { ...box, padding: '8px 12px', 'background-color': c.raised, 'border-radius': '8px', 'min-height': '52px' },
        tag('div', { color: c.muted, ...font(ui, 12), 'line-height': '1.4' }, esc(label)) + tag('div', { color: c.text, ...font(ui, 13, '650'), 'line-height': '1.5', 'overflow-wrap': 'anywhere' }, F(key, fields[key]))));
    let grid = '';
    for (let i = 0; i < cells.length; i += 2) grid += tag('tr', { 'background-color': c.surface }, cell(cells[i]) + (cells[i + 1] ? cell(cells[i + 1]) : tag('td', { width: '50%' }, '')));
    const head = tag('div', { padding: '16px 16px 8px' }, tag('div', { display: 'flex', 'align-items': 'center', gap: '8px' }, tag('div', { flex: '1 1 auto', 'min-width': '0' }, title(fields, c, ui, 16)) + (fields.mark ? tag('div', { 'line-height': '0', 'margin-bottom': '-8px' }, pill('mark', fields.mark, c, ui, true)) : '')));
    const table = grid ? tag('div', { padding: '0 12px 12px' }, tag('table', { width: '100%', 'border-collapse': 'collapse', 'table-layout': 'fixed', 'background-color': c.surface }, grid)) : '';
    return outer(sheet(head + table + tag('div', { 'border-top': `1px solid ${c.line}` }, scroller(screenLog(model, o), o.height)) + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

/** 미니: 한 줄 머리 + 낮은 칸 (짧은 발췌용) */
function mini(model, o) {
    const { c, ui, fields } = o;
    const head = tag('div', { display: 'flex', 'align-items': 'center', gap: '8px', padding: '8px 12px', 'border-bottom': `1px solid ${c.line}` },
        (fields.mark ? tag('div', { 'line-height': '0', 'margin-bottom': '-8px', flex: '0 0 auto' }, pill('mark', fields.mark, c, ui, true)) : '')
        + tag('div', { flex: '1 1 auto', 'min-width': '0', color: c.text, ...font(ui, 13, '650'), 'line-height': '1.5', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }, F('title', fields.title || ''))
        + (fields.model ? tag('div', { flex: '0 1 auto', 'min-width': '0', color: c.muted, ...font(ui, 12), 'line-height': '1.5', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }, F('model', fields.model)) : ''));
    return tag('div', { ...box, 'font-family': ui.family, 'letter-spacing': ui.tracking }, sheet(head + scroller(screenLog(model, o), Math.round(o.height * 0.5)), c, { 'max-width': '520px', margin: '0' }));
}

/** 레몬: 팔레트 카드(색 고르기 견본)의 두 번째 포인트 막대 · 🍋 */
function lemon(model, o) {
    const { c, ui, fields } = o;
    const bar = tag('div', { height: '4px', width: '46%', 'border-radius': '2px', 'background-color': c.pop, margin: '0 0 12px' }, '');
    const head = tag('div', { padding: '16px 16px 12px' }, bar + tag('div', { color: c.text, ...font(ui, 20, '650'), 'line-height': '1.4', 'overflow-wrap': 'anywhere' }, `🍋 ${F('title', fields.title || '')}`) + (pills(fields, c, ui) ? gap(8) + pills(fields, c, ui) : ''));
    const body = tag('div', { margin: '0 12px', 'border-radius': '8px', overflow: 'hidden' }, scroller(screenLog(model, o), o.height));
    return outer(sheet(head + body + gap(12) + info(fields, c, ui, '0 16px 12px') + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

// ── 컨셉 틀 (분류 halloween — 1.0.1 기념일 · 계절 · 장르도 같은 길) ──
// 컨셉 틀 하나 = CONCEPT_FRAMES 데이터 한 줄 { 색 묶음(colors) · 모양 조각(shape) · 메시지 배치(messages) · 장식 }, 그리기는 drawConcept 하나예요.
// 새 컨셉은 CONCEPT_COLORS 에 역할 색 묶음, CONCEPT_FRAMES 에 줄(모양 조각은 SHAPES 에서 고르거나 더해요), CATEGORIES 에 분류만 더하면 칩 · 시트 · 시험이 따라와요.
// 전용 색은 이 분류들에만 — 사용자 결정 「할로윈만 할로윈색」(10-31). 다른 분류는 고른 에이드 팔레트 값만 써요.
// 컨셉 틀은 안쪽 글자 · 바탕까지 그 컨셉 색이에요(사용자 10-31 「안에 글자 색깔까지 다 컨셉 따라가면」) — 글자 내용 · 줄 끊김 · 자간 · 굵기 · 기울임 · 취소선은 화면 그대로, 색과 바탕만.
// 모양은 액자가 아니라 컨셉 자체(사용자 10-31 「다 액자같아서 매력 없음」): 호박 몸통 · 붕대 · 관 · 유령 몸 · 박쥐 날개 · 거미줄 · 마녀 모자와 가마솥 · 사탕 포장 · 거울 · 숲 · 귀신의 집 · 고양이 · 묘비.
// 장식 조각은 aria-hidden 이고 글자 칸과 겹치지 않아요. 편집기가 clip-path · transform · 그라데이션을 지워도 글은 그 바탕 · 글자색 그대로 읽혀요(모양만 단순해져요).
// 역할: bg(바깥) · face · faceText · faceMuted(모양 면과 그 위 글) · panel · panel2(메시지 칸 · 말풍선) · text · dialogue · thought · emphasis · mark(형광펜 바탕) · quoteBar · name · muted(칸 위)
//       · chip · chipText(알약) · accent · onAccent(LOG 알약) · line · 모양마다 쓰는 장식 색(deco1 · deco2 · deco3). 글자 4.5 · 장식 3 은 tools/tests/log-copy.mjs 가 묶음마다 재요.
export const CONCEPT_COLORS = {
    pumpkin: { bg: '#1b0f24', face: '#ff8a1f', faceText: '#3a1a05', faceMuted: '#4a2408', panel: '#2a1736', panel2: '#3b2148', text: '#fff3e0', dialogue: '#ffb057', thought: '#d9bcff', emphasis: '#ffd166', mark: '#4f2d63', quoteBar: '#ff8a1f', name: '#ffb057', muted: '#d7c2e3', chip: '#3b2148', chipText: '#fff3e0', accent: '#3f7a2e', onAccent: '#ffffff', line: '#e8751a', deco1: '#f07a12', deco2: '#4f8a3a', deco3: '#7cc455' },
    mummy: { bg: '#2a2119', face: '#efe0c2', faceText: '#3b2a1c', faceMuted: '#5e4632', panel: '#fbf4e4', panel2: '#f3e6cc', text: '#3b2a1c', dialogue: '#8c2f1b', thought: '#4f5f22', emphasis: '#9a4a14', mark: '#ecd9b3', quoteBar: '#8c2f1b', name: '#6b3a1c', muted: '#6e5440', chip: '#e3d2b0', chipText: '#3b2a1c', accent: '#8a5a32', onAccent: '#fff8ec', line: '#b89b70', deco1: '#d9c39c', deco2: '#c4aa80', deco3: '#2a2119' },
    coffin: { bg: '#150b1b', face: '#5a3826', faceText: '#f8e7c9', faceMuted: '#ecd2a8', panel: '#3a1f47', panel2: '#4a2b58', text: '#f6eefa', dialogue: '#f2c96d', thought: '#d8bcff', emphasis: '#ffdf8a', mark: '#5a3466', quoteBar: '#e9c46a', name: '#f2c96d', muted: '#d6c4e0', chip: '#2e1838', chipText: '#f6eefa', accent: '#e9c46a', onAccent: '#2a1630', line: '#e9c46a', deco1: '#4c2e1f', deco2: '#6a4430', deco3: '#e9c46a' },
    ghost: { bg: '#2c2645', face: '#f8f6ff', faceText: '#2f2752', faceMuted: '#4b4270', panel: '#f8f6ff', panel2: '#ece6ff', text: '#2f2752', dialogue: '#5b3fd1', thought: '#74469e', emphasis: '#9c2468', mark: '#ddd3ff', quoteBar: '#8f7fd6', name: '#4b3ba8', muted: '#5f5683', chip: '#e4ddff', chipText: '#2f2752', accent: '#6f55d6', onAccent: '#ffffff', line: '#8f7fd6', deco1: '#2f2752', deco2: '#ff9ec7', deco3: '#c9bcff' },
    bat: { bg: '#0f1430', face: '#1d2547', faceText: '#eef1ff', faceMuted: '#c3cbef', panel: '#151c3a', panel2: '#212a52', text: '#e8ecff', dialogue: '#ffd95e', thought: '#aebcff', emphasis: '#ff9ad1', mark: '#2c3766', quoteBar: '#ffd95e', name: '#ffd95e', muted: '#bcc5ec', chip: '#283260', chipText: '#eef1ff', accent: '#ffd95e', onAccent: '#1d2547', line: '#6b7bc4', deco1: '#3d4a8c', deco2: '#ffe48a', deco3: '#f5c842' },
    web: { bg: '#16161d', face: '#20202a', faceText: '#f1f1f6', faceMuted: '#c9c9d8', panel: '#1a1a22', panel2: '#262632', text: '#ededf3', dialogue: '#b8f06a', thought: '#c7c7ff', emphasis: '#ffd166', mark: '#2f3a25', quoteBar: '#b8f06a', name: '#b8f06a', muted: '#c3c3d3', chip: '#2c2c39', chipText: '#f1f1f6', accent: '#b8f06a', onAccent: '#16161d', line: '#8f8fa8', deco1: '#8f8fa8', deco2: '#5d5d70', deco3: '#16161d' },
    witch: { bg: '#1b1431', face: '#271d45', faceText: '#f4efff', faceMuted: '#d2c6f2', panel: '#1f1838', panel2: '#2c2250', text: '#f2ecff', dialogue: '#7ee8a8', thought: '#cba4ff', emphasis: '#ffd166', mark: '#2f4a3c', quoteBar: '#7ee8a8', name: '#7ee8a8', muted: '#cdbff0', chip: '#33275a', chipText: '#f4efff', accent: '#7ee8a8', onAccent: '#1b1431', line: '#7d68c4', deco1: '#4a3580', deco2: '#7d68c4', deco3: '#4a4a5c' },
    candy: { bg: '#ffd9ea', face: '#ffe9f3', faceText: '#5b2148', faceMuted: '#7d3c66', panel: '#fff7fb', panel2: '#ffeef6', text: '#5b2148', dialogue: '#b52659', thought: '#7a3fa0', emphasis: '#0f6e5c', mark: '#ffe8f1', quoteBar: '#c92f68', name: '#a3245a', muted: '#8a4a72', chip: '#ffe0ee', chipText: '#5b2148', accent: '#c92f68', onAccent: '#ffffff', line: '#c92f68', deco1: '#c92f68', deco2: '#ff9f43', deco3: '#5fa83a' },
    mirror: { bg: '#1c1430', face: '#c9a24e', faceText: '#2a1a05', faceMuted: '#3d2a0c', panel: '#e8eef8', panel2: '#dbe3f2', text: '#1f2740', dialogue: '#5a3fb8', thought: '#2a6585', emphasis: '#a8326e', mark: '#d2dcf0', quoteBar: '#5a6aa0', name: '#3d4a8a', muted: '#4a5578', chip: '#f2e2b8', chipText: '#2a1a05', accent: '#7a5a1a', onAccent: '#ffffff', line: '#c9a24e', deco1: '#e8c86e', deco2: '#a07a2a', deco3: '#ffffff' },
    forest: { bg: '#0f1813', face: '#16241c', faceText: '#e6f2ea', faceMuted: '#bfd6c8', panel: '#1e2b24', panel2: '#28382f', text: '#e6f2ea', dialogue: '#ffd166', thought: '#9fe0c0', emphasis: '#ff9ab0', mark: '#2d3f35', quoteBar: '#7fd3a0', name: '#ffd166', muted: '#b7cfc0', chip: '#2a3a31', chipText: '#e6f2ea', accent: '#ffd166', onAccent: '#121c17', line: '#4f6b5a', deco1: '#2e5a40', deco2: '#c9d6cf', deco3: '#ffe066' },
    house: { bg: '#1a1428', face: '#2b2140', faceText: '#f3eaff', faceMuted: '#d6c9ee', panel: '#fdf1d6', panel2: '#f6e4bd', text: '#3a2a1a', dialogue: '#8a3b12', thought: '#5b4a8a', emphasis: '#a82a58', mark: '#f3dca8', quoteBar: '#c47a1f', name: '#7a3b12', muted: '#6e5a40', chip: '#3b2a4f', chipText: '#f3eaff', accent: '#ffd36b', onAccent: '#2b2140', line: '#3b2a4f', deco1: '#3b2a4f', deco2: '#ffd36b', deco3: '#4a3a62' },
    cat: { bg: '#3a2d52', face: '#18151f', faceText: '#f3eefc', faceMuted: '#d3c9e6', panel: '#221d2c', panel2: '#2e2838', text: '#f0ebf8', dialogue: '#ffd166', thought: '#c9b8ff', emphasis: '#ff8fb1', mark: '#3a3046', quoteBar: '#ffd166', name: '#ffd166', muted: '#c7bdd8', chip: '#2e2838', chipText: '#f0ebf8', accent: '#ffd166', onAccent: '#18151f', line: '#4a4258', deco1: '#0e0b14', deco2: '#ffd166', deco3: '#ff8fb1' },
    tomb: { bg: '#1d2430', face: '#9aa3ad', faceText: '#1d2430', faceMuted: '#2a323e', panel: '#e4e8ec', panel2: '#d6dce2', text: '#1f2630', dialogue: '#5b3f8f', thought: '#2a5868', emphasis: '#9a2f4a', mark: '#cfd6dd', quoteBar: '#5b6672', name: '#3d4a5a', muted: '#4a5563', chip: '#c8cfd6', chipText: '#1f2630', accent: '#3d4a5a', onAccent: '#ffffff', line: '#7a838d', deco1: '#4f8a3a', deco2: '#7a838d', deco3: '#ffffff' },
};
/** 옛 이름 (시트 · 시험이 쓰던) */
export const HALLOWEEN_COLORS = CONCEPT_COLORS;

// ── 안쪽 색: 화면 역할 색 → 컨셉 역할 색 (그 밖의 색 · 직접 고른 고정 색도 컨셉 색으로) ──
/** @param {object} model @param {object} k 컨셉 색 묶음 @param {Record<string,string>|null} screen 화면 팔레트 역할 색 (sheet tokensOf) */
export function conceptModel(model, k, screen = null) {
    const to = { bg: k.panel, surface: k.panel, raised: k.panel2, text: k.text, dialogue: k.dialogue, em: k.thought, strong: k.emphasis, marker: k.mark, gold: k.mark, accent: k.quoteBar, pop: k.quoteBar, muted: k.muted, faint: k.muted, line: k.line, shadow: k.line };
    const out = screen ? recolorLog(model, screen, to) : structuredClone(model);
    const inks = new Set([k.text, k.dialogue, k.thought, k.emphasis, k.name, k.muted].map(c => cssColor(parseColor(c))));
    const norm = v => { const c = parseColor(v); return c ? cssColor(c) : null; };
    const ink = v => (inks.has(norm(v)) ? v : k.text);
    const paintAll = (v, color) => String(v).replace(/rgba?\([^)]*\)|#[0-9a-f]{3,8}\b/gi, color);
    const fix = (style, block) => {
        if (!style) return style;
        const s = { ...style };
        if (s.color) s.color = ink(s.color);
        if (s['text-decoration-color']) s['text-decoration-color'] = ink(s['text-decoration-color']);
        delete s['text-shadow'];
        if (s['background-image']) s['background-image'] = paintAll(s['background-image'], k.mark);
        if (s['background-color']) s['background-color'] = block ? k.panel2 : k.mark;
        for (const key of Object.keys(s)) if (/^border/.test(key) && key !== 'border-radius') s[key] = paintAll(s[key], k.quoteBar);
        return s;
    };
    const walk = list => { for (const node of list ?? []) { if (node.t === 'el' && !node.mask) node.style = fix(node.style, node.block); if (node.t === 'hr') node.style = fix(node.style, true); if (node.children) walk(node.children); } };
    out.base = { ...out.base, bg: k.panel, color: k.text };
    for (const message of out.messages) {
        message.font = { ...message.font, color: k.text };
        if (message.nameStyle) message.nameStyle = { ...message.nameStyle, color: k.name };
        if (message.bubble) message.bubble = { ...message.bubble, 'background-color': k.panel2 };
        walk(message.nodes);
    }
    return out;
}

// ── 조각 ──
const hide = html => mark(html, 'aria-hidden="true"');   // 장식(글 없음 · 글자 칸과 안 겹침)
const deco = (style, inner = '') => hide(tag('div', style, inner));
const cTitle = (fields, k, ui, more = {}) => (fields.title ? tag('div', { color: k.faceText, ...font(ui, 20, '650'), 'line-height': '1.4', 'overflow-wrap': 'anywhere', 'text-align': 'center', ...more }, F('title', fields.title)) : '');
function cPills(fields, k, ui) {
    const list = ['mark', 'model', 'prompt'].filter(key => fields[key]).map(key => F(key, fields[key], {
        display: 'inline-block', ...box, height: '20px', margin: '0 4px 8px', padding: '0 8px', 'vertical-align': 'middle', 'border-radius': '10px',
        'background-color': key === 'mark' ? k.accent : k.chip, color: key === 'mark' ? k.onAccent : k.chipText, ...font(ui, 12, key === 'mark' ? '650' : '400'), 'line-height': '20px', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis',
    }));
    return list.length ? tag('div', { 'text-align': 'center', 'line-height': '0', 'margin-bottom': '-8px' }, list.join('')) : '';
}
const cTail = (fields, k, ui, text, more = {}) => tag('div', { 'text-align': 'center', color: k.faceMuted, ...font(ui, 13), 'line-height': '1.6', ...more },
    fields.tail?.trim() ? F('tail', fields.tail.trim()) : esc(text));
function cInfo(fields, k, ui, margin = '12px 0 0') {
    if (!fields.info?.trim()) return '';
    const summary = tag('summary', { display: 'block', 'list-style': 'none', cursor: 'pointer', 'min-height': '36px', padding: '0 12px', color: k.text, ...font(ui, 13, '650'), 'line-height': '36px' }, `추가 정보 ${tag('span', { color: k.muted, 'font-weight': '400' }, '▾')}`);
    const text = tag('div', { padding: '0 12px 12px', color: k.muted, ...font(ui, 13), 'line-height': '1.6', 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' }, F('info', fields.info.trim()));
    return tag('details', { display: 'block', margin, 'border-radius': '8px', 'background-color': k.panel2 }, summary + text);
}
const emojiLine = (text, k, ui, size = 18) => hide(tag('div', { 'text-align': 'center', color: k.faceMuted, ...font(ui, size), 'line-height': '1.3', 'letter-spacing': '0.1em', 'white-space': 'nowrap', overflow: 'hidden' }, esc(text)));

// ── 메시지 배치: box(화면 상자 그대로 · 컨셉 색) · bubble(유령 말풍선) · wrap(사탕 포장) ──
function cMessages(model, o, k, style) {
    const ui = o.ui;
    if (style === 'box') return scroller(logHtml(model, { names: o.names, gap: o.gap, frameless: false, relayout: 'justify' }), o.height, { 'border-radius': '12px', 'background-color': k.panel });
    const items = model.messages.map((message) => {
        const name = o.names && message.name ? mark(tag('div', { color: k.name, ...font(ui, 13, '650'), 'line-height': '1.5', margin: '0 0 4px' }, esc(message.name)), 'data-bl-name') : '';
        const body = name + nodesHtml(message.nodes, { inkFix: { bg: k.panel2, ink: k.text }, trimEdges: true, relayout: true });
        const textBox = { ...box, ...baseFont(message.font), color: k.text, 'background-color': k.panel2, padding: '10px 12px', 'overflow-wrap': 'anywhere' };
        if (style === 'bubble') {
            const mine = message.user;
            const bubble = tag('div', { ...textBox, display: 'inline-block', 'max-width': '92%', 'text-align': 'left', 'border-radius': mine ? '18px 18px 6px 18px' : '18px 18px 18px 6px', border: `1px solid ${k.line}`, 'box-shadow': `0 2px 0 ${k.deco3}` }, body);
            const ghost = hide(tag('span', { display: 'inline-block', width: '18px', 'vertical-align': 'top', ...font(ui, 14), 'line-height': '1.4', color: k.faceMuted }, '👻'));
            return mark(tag('div', { margin: '0 0 10px', 'text-align': mine ? 'right' : 'left' }, mine ? bubble : ghost + bubble), 'data-bl-msg');
        }
        // wrap: 사탕 포장 — 가운데 글 칸, 양쪽 꼬인 끝(작은 리본)
        const end = side => hide(tag('div', { flex: '0 0 8px', 'align-self': 'center', width: '8px', height: '20px', 'background-color': k.deco2, 'clip-path': side === 'l' ? 'polygon(0 0, 100% 35%, 100% 65%, 0 100%, 30% 50%)' : 'polygon(100% 0, 0 35%, 0 65%, 100% 100%, 70% 50%)' }, ''));
        return mark(tag('div', { display: 'flex', 'align-items': 'stretch', gap: '0', margin: '0 0 10px' }, end('l') + tag('div', { ...textBox, padding: '10px', flex: '1 1 auto', 'min-width': '0', 'border-radius': '14px', border: `1px solid ${k.line}`, 'box-shadow': `inset 0 2px 0 ${k.panel}` }, body) + end('r')), 'data-bl-msg');
    }).join('');
    return scroller(tag('div', { padding: style === 'wrap' ? '10px 0 2px' : '12px 4px 2px', 'background-color': k.panel, 'border-radius': '12px' }, items), o.height + 40);
}

// ── 모양 조각: (k, parts, ui) → HTML. parts = { head(제목 · 알약), body(메시지), info, tail } — 글이 든 칸은 늘 자기 바탕 · 글자색을 가져요 ──
// 다듬기(10-31 「ppt 도형 같아」): 덩어리는 한 겹 단색으로 두지 않고 같은 묶음 색끼리 은은한 명암(그라데이션 · 안쪽 그림자) · 하이라이트를 얹어요.
// 선은 1~2px, 작은 장식(반짝이 · 별 · 박쥐 떼 · 거미 실 · 촛불 빛)은 글이 없는 줄(장식 줄 · 바깥 여백)에만 흩어요 — 글 칸 위는 덮지 않아요.
// 색은 그 컨셉 묶음 값만(투명도만 바꾼 같은 색 · 흰 반사광 포함). 가운데 맞춤은 transform 대신 margin 으로 — 편집기가 transform 을 지워도 자리가 그대로예요.
const wrapOuter = (k, ui, inner, pad = '14px') => tag('div', { ...box, position: 'relative', padding: pad, 'background-color': k.bg, color: k.text, 'border-radius': '20px', overflow: 'hidden', 'font-family': ui.family, 'letter-spacing': ui.tracking, 'text-align': 'left' }, inner);
const al = (hex, a) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;   // 같은 색 · 투명도만
const WHITE = '#ffffff';
const at = (pos, style, inner = '') => deco({ position: 'absolute', ...pos, ...style }, inner);
const lane = (h, inner, more = {}) => deco({ position: 'relative', height: `${h}px`, ...more }, inner);   // 글 없는 장식 줄
const gap10 = tag('div', { height: '10px' }, '');
const STAR = 'polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%)';
const star = (pos, size, color) => at(pos, { width: `${size}px`, height: `${size}px`, 'background-color': color, 'clip-path': STAR });
const dot = (pos, size, color, more = {}) => at(pos, { width: `${size}px`, height: `${size}px`, 'border-radius': '50%', 'background-color': color, ...more });
const BAT = 'polygon(50% 34%, 54% 14%, 56% 34%, 64% 22%, 78% 12%, 100% 18%, 90% 34%, 86% 58%, 76% 48%, 68% 72%, 60% 60%, 50% 92%, 40% 60%, 32% 72%, 24% 48%, 14% 58%, 10% 34%, 0 18%, 22% 12%, 36% 22%, 44% 34%, 46% 14%)';
const bat = (pos, w, color) => at(pos, { width: `${w}px`, height: `${Math.round(w * 0.46)}px`, 'background-color': color, 'clip-path': BAT });
const centerAt = w => ({ left: '50%', 'margin-left': `${Math.round(-w / 2)}px` });

export const SHAPES = {
    // 🎃 호박: 골이 휜 둥근 몸통(명암 · 반사광 · 양옆 겹친 골) · 작은 꼭지와 잎 · 덩굴손 · 등불 눈 — 몸통 안 진보라 칸에 메시지
    pumpkin: (k, p, ui) => {
        const rib = rx => `radial-gradient(ellipse ${rx}% 62% at 50% 50%, transparent calc(100% - 2px), ${al(k.deco1, 0.85)} calc(100% - 2px) 100%, transparent 100%)`;
        const sky = lane(34, star({ left: '4%', top: '6px' }, 10, k.emphasis) + star({ right: '6%', top: '12px' }, 7, k.emphasis) + dot({ left: '17%', top: '20px' }, 3, k.dialogue) + dot({ right: '19%', top: '3px' }, 3, k.thought)
            + bat({ left: '24%', top: '2px' }, 18, k.mark) + bat({ right: '27%', top: '18px' }, 13, k.mark)
            + at({ ...centerAt(10), bottom: '-5px' }, { width: '10px', height: '22px', 'border-radius': '4px 5px 2px 2px', 'background-color': k.deco2, 'background-image': `linear-gradient(90deg, ${k.deco2} 0 30%, ${k.deco3} 30% 50%, ${k.deco2} 50%)`, transform: 'rotate(7deg)', 'transform-origin': '50% 100%', 'z-index': '1' })
            + at({ left: '50%', 'margin-left': '5px', bottom: '7px' }, { width: '22px', height: '11px', 'border-radius': '0 11px 0 11px', 'background-color': k.deco3, 'background-image': `linear-gradient(162deg, transparent 0 47%, ${k.deco2} 47% 53%, transparent 53%)`, transform: 'rotate(-12deg)', 'z-index': '1' })
            + at({ left: '50%', 'margin-left': '-22px', bottom: '2px' }, { ...box, width: '15px', height: '15px', 'border-radius': '50%', border: `2px solid ${k.deco3}`, 'border-color': `${k.deco3} transparent transparent ${k.deco3}`, transform: 'rotate(-35deg)' }));
        const eye = left => at({ left, top: '2px' }, { width: '15px', height: '11px', 'background-color': k.faceText, 'background-image': `linear-gradient(to top, ${k.emphasis} 0 3px, transparent 3px)`, 'clip-path': 'polygon(50% 0, 100% 100%, 0 100%)' });
        const lantern = lane(22, eye('calc(50% - 26px)') + eye('calc(50% + 11px)') + at({ ...centerAt(18), top: '10px' }, { ...box, width: '18px', height: '9px', 'border-bottom': `2px solid ${k.faceText}`, 'border-radius': '0 0 9px 9px' }));
        const body = tag('div', {
            ...box, position: 'relative', margin: '0 7px', 'background-color': k.face,
            'background-image': [`radial-gradient(ellipse 38% 46px at 30% 22px, ${al(WHITE, 0.28)}, transparent)`, rib(16), rib(33), rib(50), `linear-gradient(to bottom, transparent 70%, ${al(k.deco1, 0.6)})`].join(', '),
            color: k.faceText, 'border-radius': '50% 50% 44% 44% / 74px 74px 54px 54px', padding: '14px 12px 20px',
            'box-shadow': `-7px 5px 0 -3px ${k.deco1}, 7px 5px 0 -3px ${k.deco1}, inset 0 -10px 18px -10px ${k.line}, inset 0 2px 0 ${al(WHITE, 0.3)}`,
        }, lantern + p.head + gap10 + tag('div', { 'border-radius': '12px', 'box-shadow': `0 0 0 2px ${k.line}, 0 3px 0 2px ${al(k.bg, 0.35)}` }, p.body) + p.info + tag('div', { 'margin-top': '10px' }, p.tail));
        return wrapOuter(k, ui, sky + body, '10px 12px 18px');
    },
    // 🧟 미라: 1px 솔기 붕대가 비스듬히 겹쳐 감기고(아래 그늘 한 겹) · 붕대 틈 사이로 동그란 눈 — 크림 종이 칸에 메시지
    mummy: (k, p, ui) => {
        // 붕대 한 줄 = 장식 줄 높이 안의 비스듬한 띠(clip-path 점 4개, 왼쪽 y0 → 오른쪽 y1). 회전(transform) 대신이라 넓은 화면에서도 상자가 줄 밖으로 안 나가요
        const poly = (y0, y1, h) => `polygon(0 ${y0}px, 100% ${y1}px, 100% ${y1 + h}px, 0 ${y0 + h}px)`;
        const band = (y0, y1, h = 14, pos = { left: '0', right: '0' }) => at({ ...pos, top: '0', bottom: '0' }, { 'background-color': al(k.deco2, 0.85), 'clip-path': poly(y0 + 1, y1 + 2, h) })
            + at({ ...pos, top: '0', bottom: '0' }, { 'background-color': k.deco1, 'background-image': `repeating-linear-gradient(90deg, transparent 0 23px, ${al(k.deco2, 0.7)} 23px 24px), linear-gradient(to bottom, ${al(WHITE, 0.3)}, transparent)`, 'clip-path': poly(y0, y1, h) });
        const eyeBall = left => at({ left, top: '2px' }, { width: '11px', height: '11px', 'border-radius': '50%', 'background-color': WHITE, 'background-image': `radial-gradient(circle at 60% 55%, ${k.faceText} 0 2.5px, transparent 3px)` });
        const gapBand = deco({ position: 'absolute', left: 'calc(50% - 40px)', width: '80px', height: '14px', top: '27px', transform: 'rotate(2deg)', 'background-color': k.deco3, 'border-radius': '8px' }, eyeBall('calc(50% - 18px)') + eyeBall('calc(50% + 7px)'));
        const ragged = deco({ height: '6px', 'background-image': `linear-gradient(135deg, ${k.bg} 33%, transparent 33%), linear-gradient(225deg, ${k.bg} 33%, transparent 33%)`, 'background-size': '8px 8px', 'background-color': k.face });
        const tag1 = at({ left: '2px', top: '74px' }, { width: '9px', height: '34px', 'background-color': k.deco1, 'border-radius': '0 0 3px 3px', transform: 'rotate(8deg)', 'box-shadow': `inset -1px 0 0 ${k.deco2}` });
        const tag2 = at({ right: '3px', bottom: '58px' }, { width: '8px', height: '26px', 'background-color': k.deco1, 'border-radius': '0 0 3px 3px', transform: 'rotate(-10deg)', 'box-shadow': `inset 1px 0 0 ${k.deco2}` });
        return wrapOuter(k, ui, tag1 + tag2 + tag('div', { ...box, position: 'relative', overflow: 'hidden', 'background-color': k.face, 'background-image': `repeating-linear-gradient(-6deg, transparent 0 17px, ${al(k.deco2, 0.35)} 17px 18px)`, color: k.faceText, 'border-radius': '10px', 'box-shadow': `inset 0 0 0 1px ${k.deco2}` },
            ragged + lane(62, band(12, 2, 14) + band(18, 12, 9, { left: '62%', right: '0' }) + gapBand + band(40, 47, 13), { overflow: 'hidden' })
            + tag('div', { ...box, position: 'relative', padding: '0 10px' }, p.head + gap10 + p.body + p.info)
            + lane(34, band(4, 12, 14) + band(22, 16, 10, { left: '0', right: '58%' }), { 'margin-top': '8px', overflow: 'hidden' }) + tag('div', { padding: '0 12px 12px' }, p.tail) + ragged), '14px 12px');
    },
    // ⚰️ 관: 2px 금 테를 두른 육각 관(나뭇결 · 둥근 명암) · 그린 십자와 못 · 양옆 촛불 빛 — 안쪽 보랏빛 공단 칸에 메시지
    coffin: (k, p, ui) => {
        const hex = 'polygon(24% 0, 76% 0, 100% 9%, 96% 100%, 4% 100%, 0 9%)';
        const candle = side => at({ [side]: '2px', bottom: '12px' }, { width: '8px', height: '22px', 'border-radius': '2px', 'background-color': k.faceText, 'background-image': `linear-gradient(90deg, transparent 60%, ${al(k.deco2, 0.35)})` },
            at({ left: '2px', top: '-9px' }, { width: '4px', height: '8px', 'border-radius': '50% 50% 50% 50% / 70% 70% 30% 30%', 'background-color': k.emphasis, 'box-shadow': `0 0 6px 3px ${al(k.emphasis, 0.45)}, 0 0 16px 8px ${al(k.emphasis, 0.15)}` }));
        const cross = lane(24, at({ ...centerAt(4), top: '2px' }, { width: '4px', height: '20px', 'border-radius': '1px', 'background-color': k.deco3, 'box-shadow': `0 1px 0 ${k.deco1}` })
            + at({ ...centerAt(14), top: '7px' }, { width: '14px', height: '4px', 'border-radius': '1px', 'background-color': k.deco3, 'box-shadow': `0 1px 0 ${k.deco1}` })
            + dot({ left: '27%', top: '6px' }, 4, k.deco3) + dot({ right: '27%', top: '6px' }, 4, k.deco3));
        const wood = tag('div', { ...box, 'background-color': k.face, 'background-image': `linear-gradient(90deg, ${al(k.deco1, 0.75)}, transparent 16%, transparent 84%, ${al(k.deco1, 0.75)}), repeating-linear-gradient(90deg, transparent 0 13px, ${al(k.deco1, 0.6)} 13px 14px, transparent 14px 31px, ${al(k.deco2, 0.7)} 31px 32px)`, color: k.faceText, 'clip-path': hex, padding: '14px 5% 34px' },
            cross + p.head + gap10 + tag('div', { ...box, border: `1px solid ${k.deco3}`, 'border-radius': '10px', padding: '3px', 'background-color': k.panel2, 'box-shadow': `0 2px 0 ${k.deco1}` }, p.body) + p.info + tag('div', { 'margin-top': '12px' }, p.tail));
        return wrapOuter(k, ui, candle('left') + candle('right') + tag('div', { ...box, 'background-color': k.deco3, 'clip-path': hex, padding: '2px', margin: '0 7px' }, wood), '14px 2px');
    },
    // 👻 유령: 몸 전체가 유령 — 둥근 머리(반사 눈 · 볼 홍조 · 작은 입) · 옆구리 명암 · 짧은 팔 · 두 겹 물결 자락, 메시지는 몸 안 작은 말풍선
    ghost: (k, p, ui) => {
        const eye = left => at({ left, top: '4px' }, { width: '13px', height: '18px', 'border-radius': '50%', 'background-color': k.deco1, 'background-image': `radial-gradient(circle at 35% 30%, ${WHITE} 0 2.5px, transparent 3px)` });
        const cheek = left => at({ left, top: '20px' }, { width: '14px', height: '7px', 'border-radius': '50%', 'background-color': al(k.deco2, 0.55) });
        const face = lane(32, eye('calc(50% - 26px)') + eye('calc(50% + 13px)') + cheek('calc(50% - 44px)') + cheek('calc(50% + 30px)')
            + at({ ...centerAt(10), top: '18px' }, { ...box, width: '10px', height: '8px', 'border-radius': '50%', border: `2px solid ${k.deco1}`, 'background-color': k.deco2 }), { width: '120px', margin: '0 auto 2px' });
        const arm = side => at({ [side]: '3px', top: '46%' }, { width: '16px', height: '26px', 'border-radius': '50%', 'background-color': k.face, transform: `rotate(${side === 'left' ? 24 : -24}deg)`, 'box-shadow': `inset ${side === 'left' ? 3 : -3}px -3px 6px -3px ${k.deco3}` });
        const hem = (color, size, x) => `radial-gradient(circle at 50% 0, ${color} 0 ${size / 2}px, transparent ${size / 2 + 0.5}px) ${x}px 0 / ${size}px ${Math.round(size / 1.6)}px repeat-x`;
        const tail = deco({ height: '20px', margin: '0 8px', background: `${hem(k.face, 34, 0)}, ${hem(k.deco3, 34, 17)}` });
        const sparks = star({ left: '4px', top: '18px' }, 9, k.deco3) + star({ right: '6px', top: '30px' }, 7, k.deco2) + dot({ right: '16px', top: '10px' }, 3, k.deco3) + dot({ left: '18px', top: '6px' }, 3, k.deco2);
        return wrapOuter(k, ui, sparks + arm('left') + arm('right') + tag('div', { ...box, margin: '0 8px', 'background-color': k.face, 'background-image': `radial-gradient(ellipse 70% 120px at 40% 0, ${WHITE}, transparent)`, color: k.faceText, 'border-radius': '160px 160px 0 0 / 120px 120px 0 0', padding: '26px 6px 8px', 'box-shadow': `inset -10px 0 16px -10px ${k.deco3}, inset 8px 0 14px -10px ${al(k.deco3, 0.7)}` },
            face + p.head + gap10 + p.body + p.info + tag('div', { 'margin-top': '8px' }, p.tail)) + tail, '14px 4px 12px');
    },
    // 🦇 박쥐 달밤: 크레이터 · 달무리 있는 달 · 날개뼈가 있는 박쥐 한 마리와 작은 박쥐 떼 · 별 — 밤하늘 칸에 메시지
    bat: (k, p, ui) => {
        const moon = at({ right: '18px', top: '10px' }, { width: '50px', height: '50px', 'border-radius': '50%', 'background-color': k.deco2,
            'background-image': `radial-gradient(circle at 66% 34%, ${k.deco3} 0 6px, transparent 6.5px), radial-gradient(circle at 34% 62%, ${k.deco3} 0 4px, transparent 4.5px), radial-gradient(circle at 60% 74%, ${k.deco3} 0 2.5px, transparent 3px), radial-gradient(circle at 30% 28%, ${al(WHITE, 0.6)} 0 5px, transparent 14px)`,
            'box-shadow': `0 0 0 6px ${al(k.deco2, 0.1)}, 0 0 22px 8px ${al(k.deco2, 0.22)}, inset -5px -4px 0 ${al(k.deco3, 0.55)}` });
        const big = at({ left: '22%', top: '24px' }, { width: '120px', height: '46px', 'background-color': k.deco1, 'background-image': `linear-gradient(to bottom, ${al(k.line, 0.55)}, transparent 60%)`, 'clip-path': BAT },
            dot({ left: '57px', top: '13px' }, 2, k.deco2) + dot({ left: '61px', top: '13px' }, 2, k.deco2));
        const sky = [['6%', '8px', 2], ['14%', '40px', 3], ['40%', '6px', 2], ['58%', '58px', 2], ['70%', '12px', 3], ['10%', '70px', 2]].map(([left, top, s]) => dot({ left, top }, s, s > 2 ? k.deco2 : k.faceMuted)).join('')
            + star({ left: '3%', top: '22px' }, 9, k.deco2) + star({ left: '62%', top: '30px' }, 7, k.faceMuted);
        const flock = bat({ right: '80px', top: '8px' }, 16, k.line) + bat({ right: '72px', top: '30px' }, 11, k.line) + bat({ right: '96px', top: '40px' }, 9, k.line);
        return wrapOuter(k, ui, lane(84, sky + moon + flock + big) + tag('div', { ...box, 'background-color': k.face, 'background-image': `linear-gradient(to bottom, ${al(k.line, 0.18)}, transparent 90px)`, color: k.faceText, 'border-radius': '16px', padding: '12px 10px', 'box-shadow': `inset 0 1px 0 ${al(k.line, 0.7)}, 0 6px 16px -6px ${al(k.bg, 0.9)}` },
            p.head + gap10 + p.body + p.info + tag('div', { 'margin-top': '10px' }, p.tail)), '0 14px 14px');
    },
    // 🕸 거미줄: 크기가 다른 부채꼴 거미줄(1px 실 · 이슬방울) · 실에 매달린 거미 둘 — 장식은 머리 · 꼬리 칸에만
    web: (k, p, ui) => {
        const web = (pos, size, at0, radius) => at(pos, { width: `${size}px`, height: `${size}px`, [radius]: '100%', 'background-image': `repeating-radial-gradient(circle at ${at0}, transparent 0 ${Math.round(size / 7) - 1}px, ${al(k.deco1, 0.85)} ${Math.round(size / 7) - 1}px ${Math.round(size / 7)}px), repeating-conic-gradient(from 0deg at ${at0}, ${al(k.deco1, 0.85)} 0 0.7deg, transparent 0.7deg 15deg)` });
        const dew = pos => dot(pos, 3, al(WHITE, 0.75));
        const leg = (dir, r, s) => tag('div', { position: 'absolute', top: '40%', [dir < 0 ? 'right' : 'left']: '60%', width: `${s}px`, height: '1px', 'background-color': k.faceMuted, transform: `rotate(${dir * r}deg)`, 'transform-origin': dir < 0 ? '100% 50%' : '0 50%' }, '');
        const spider = (pos, len, s) => at(pos, { width: `${s * 2}px`, 'margin-left': `${-s}px` },
            tag('div', { width: '1px', height: `${len}px`, margin: '0 auto', 'background-color': k.deco1 }, '')
            + tag('div', { position: 'relative', width: `${s}px`, height: `${s}px`, margin: '0 auto', 'border-radius': '50%', 'background-color': k.faceMuted, 'background-image': `radial-gradient(circle at 35% 30%, ${al(WHITE, 0.7)} 0 1px, transparent 2px)` },
                [-1, 1].flatMap(dir => [-30, 0, 30].map(r => leg(dir, r, s))).join('')));
        return wrapOuter(k, ui, tag('div', { ...box, position: 'relative', 'background-color': k.face, 'background-image': `radial-gradient(ellipse 80% 90px at 50% 0, ${al(k.deco2, 0.45)}, transparent)`, color: k.faceText, 'border-radius': '14px', padding: '48px 10px 50px', 'box-shadow': `inset 0 0 0 1px ${al(k.deco2, 0.8)}` },
            web({ left: '0', top: '0' }, 76, '0 0', 'border-bottom-right-radius') + web({ right: '0', top: '0' }, 46, '100% 0', 'border-bottom-left-radius') + web({ right: '0', bottom: '0' }, 62, '100% 100%', 'border-top-left-radius')
            + dew({ left: '22px', top: '30px' }) + dew({ left: '44px', top: '12px' }) + dew({ right: '18px', top: '22px' }) + dew({ right: '30px', bottom: '24px' })
            + spider({ left: '30%', top: '0' }, 22, 8) + spider({ left: '76%', top: '0' }, 12, 6) + star({ left: '12px', bottom: '16px' }, 7, k.deco1)
            + p.head + gap10 + p.body + p.info + tag('div', { 'margin-top': '10px' }, p.tail)));
    },
    // 🧙 마녀: 끝이 휜 뾰족 모자(띠 · 금 버클 · 명암 챙) · 반짝이 — 아래는 둥근 가마솥(테 · 초록 물약 · 크기 다른 거품)
    witch: (k, p, ui) => {
        const hat = deco({ position: 'relative', width: '128px', height: '62px', margin: '0 auto' },
            at({ left: '0', top: '0' }, { width: '128px', height: '62px', 'background-color': k.deco1, 'background-image': `linear-gradient(90deg, transparent 50%, ${al(k.bg, 0.35)})`, 'clip-path': 'polygon(86% 4%, 80% 2%, 70% 8%, 60% 22%, 54% 40%, 50% 62%, 46% 84%, 44% 100%, 78% 100%, 74% 80%, 70% 56%, 70% 34%, 74% 18%, 82% 10%, 90% 10%)' })
            + at({ left: '56px', bottom: '0' }, { width: '44px', height: '10px', 'background-color': k.dialogue, 'background-image': `linear-gradient(to bottom, ${al(WHITE, 0.3)}, transparent)` })
            + at({ left: '72px', bottom: '0' }, { ...box, width: '12px', height: '10px', border: `2px solid ${k.emphasis}`, 'border-radius': '2px' }));
        const brim = deco({ position: 'relative', 'z-index': '1', width: '200px', height: '14px', margin: '-3px auto 0', 'border-radius': '50%', 'background-color': k.deco1, 'background-image': `linear-gradient(to bottom, ${al(k.deco2, 0.9)}, transparent 55%)`, 'box-shadow': `0 3px 0 ${al(k.bg, 0.6)}` });
        const sparks = star({ left: '18%', top: '18px' }, 10, k.emphasis) + star({ right: '20%', top: '10px' }, 7, k.thought) + dot({ left: '28%', top: '6px' }, 3, k.thought) + dot({ right: '14%', top: '40px' }, 3, k.emphasis) + star({ right: '28%', top: '44px' }, 6, k.emphasis);
        const bubble = (left, top, s, ring = false) => dot({ left, top: `${top}px` }, s, ring ? 'transparent' : k.accent, ring ? { ...box, border: `1px solid ${k.accent}` } : { 'background-image': `radial-gradient(circle at 35% 30%, ${al(WHITE, 0.7)} 0 1px, transparent 2px)` });
        const brew = lane(26, bubble('16%', 12, 8) + bubble('26%', 4, 5, true) + bubble('38%', 14, 6) + bubble('52%', 2, 9) + bubble('63%', 13, 5, true) + bubble('72%', 8, 7) + bubble('84%', 14, 4) + bubble('46%', 16, 4, true), { margin: '0 20px' });
        const pot = deco({ position: 'relative', height: '46px', margin: '0 18px 4px' },
            at({ left: '0', right: '0', top: '0' }, { height: '8px', 'border-radius': '4px', 'background-color': k.deco3, 'background-image': `linear-gradient(to bottom, ${al(WHITE, 0.25)}, transparent)` })
            + at({ left: '8px', right: '8px', top: '6px' }, { height: '40px', 'background-color': k.deco3, 'background-image': `radial-gradient(ellipse 60% 80% at 30% 20%, ${al(WHITE, 0.14)}, transparent), linear-gradient(to top, ${al(k.bg, 0.5)}, transparent)`, 'border-radius': '0 0 46% 46% / 0 0 100% 100%' })
            + at({ left: '22%', bottom: '-2px' }, { width: '8px', height: '6px', 'border-radius': '0 0 3px 3px', 'background-color': k.deco3 }) + at({ right: '22%', bottom: '-2px' }, { width: '8px', height: '6px', 'border-radius': '0 0 3px 3px', 'background-color': k.deco3 })
            + at({ left: '14px', top: '8px', right: '14px' }, { height: '3px', 'border-radius': '2px', 'background-color': k.accent }));
        return wrapOuter(k, ui, sparks + hat + brim + tag('div', { ...box, 'background-color': k.face, 'background-image': `radial-gradient(circle at 20% 30%, ${al(k.deco2, 0.55)} 0 1px, transparent 1.5px), radial-gradient(circle at 70% 60%, ${al(k.deco2, 0.45)} 0 1px, transparent 1.5px)`, 'background-size': '47px 41px, 61px 53px', color: k.faceText, 'border-radius': '16px', padding: '12px 10px', 'margin-top': '-6px', 'box-shadow': `inset 0 1px 0 ${al(k.deco2, 0.6)}` },
            p.head + gap10 + p.body + p.info + tag('div', { 'margin-top': '10px' }, p.tail)) + brew + pot, '10px 14px 14px');
    },
    // 🍬 사탕 포장지: 좌우 주름 부채꼴 포장 끝(꼬인 매듭 · 광택) · 줄무늬 띠 · 막대사탕 · 작은 사탕 — 가운데 포장 칸, 메시지마다 작은 사탕 포장
    candy: (k, p, ui) => {
        const twist = side => deco({ flex: '0 0 18px', 'align-self': 'center', position: 'relative', height: '96px' },
            at({ [side === 'l' ? 'left' : 'right']: '0', top: '0' }, { width: '14px', height: '96px', 'background-color': k.deco1, 'background-image': `repeating-linear-gradient(to bottom, transparent 0 7px, ${al(WHITE, 0.45)} 7px 8px), linear-gradient(${side === 'l' ? 90 : 270}deg, ${al(WHITE, 0.25)}, transparent)`, 'clip-path': side === 'l' ? 'polygon(0 0, 30% 6%, 0 14%, 30% 22%, 0 30%, 30% 38%, 0 46%, 30% 54%, 0 62%, 30% 70%, 0 78%, 30% 86%, 0 94%, 30% 100%, 100% 58%, 100% 42%)' : 'polygon(100% 0, 70% 6%, 100% 14%, 70% 22%, 100% 30%, 70% 38%, 100% 46%, 70% 54%, 100% 62%, 70% 70%, 100% 78%, 70% 86%, 100% 94%, 70% 100%, 0 58%, 0 42%)' })
            + at({ [side === 'l' ? 'right' : 'left']: '0', top: '40px' }, { width: '6px', height: '16px', 'border-radius': '3px', 'background-color': k.deco2 }));
        const stripe = deco({ height: '8px', margin: '0 6px 8px', 'border-radius': '4px', 'background-color': k.deco1, 'background-image': `repeating-linear-gradient(45deg, ${k.deco1} 0 6px, ${k.face} 6px 10px, ${k.deco2} 10px 16px, ${k.face} 16px 20px, ${k.deco3} 20px 26px, ${k.face} 26px 30px)`, 'box-shadow': `inset 0 0 0 1px ${al(k.deco1, 0.5)}` });
        const lolly = (pos, s, a, b) => at(pos, { width: `${s}px`, height: `${s + 12}px` },
            tag('div', { width: '2px', height: '14px', margin: `${s - 2}px auto 0`, 'background-color': k.faceMuted }, '')
            + tag('div', { position: 'absolute', left: '0', top: '0', width: `${s}px`, height: `${s}px`, 'border-radius': '50%', 'background-color': a, 'background-image': `radial-gradient(circle at 35% 30%, ${al(WHITE, 0.7)} 0 2px, transparent 3px), repeating-conic-gradient(${a} 0 30deg, ${b} 30deg 60deg)` }, ''));
        const sweet = (pos, color) => at(pos, { width: '24px', height: '10px' },
            tag('div', { position: 'absolute', left: '0', top: '0', width: '24px', height: '10px', 'background-color': color, 'clip-path': 'polygon(0 0, 30% 50%, 0 100%, 100% 0, 70% 50%, 100% 100%)' }, '')
            + tag('div', { position: 'absolute', left: '7px', top: '0', width: '10px', height: '10px', 'border-radius': '50%', 'background-color': color, 'background-image': `radial-gradient(circle at 35% 30%, ${al(WHITE, 0.75)} 0 1.5px, transparent 2.5px)` }, ''));
        const top = lane(30, lolly({ left: '18px', top: '0' }, 18, k.deco1, k.face) + sweet({ left: '46px', top: '14px' }, k.deco3) + sweet({ right: '22px', top: '6px' }, k.deco2) + lolly({ right: '52px', top: '2px' }, 14, k.deco2, k.face)
            + star({ left: '42%', top: '4px' }, 7, k.deco2) + dot({ left: '58%', top: '16px' }, 3, k.deco3) + dot({ left: '32%', top: '20px' }, 3, k.deco1));
        return wrapOuter(k, ui, top + tag('div', { display: 'flex', 'align-items': 'stretch' }, twist('l') + tag('div', { ...box, flex: '1 1 auto', 'min-width': '0', 'background-color': k.face, 'background-image': `radial-gradient(ellipse 50% 50px at 26% 0, ${al(WHITE, 0.8)}, transparent), repeating-linear-gradient(45deg, transparent 0 14px, ${al(k.deco1, 0.06)} 14px 22px)`, color: k.faceText, 'border-radius': '20px', padding: '10px 4px', border: `2px solid ${k.line}`, 'box-shadow': `0 3px 0 ${al(k.line, 0.25)}, inset 0 -6px 12px -8px ${al(k.line, 0.5)}` },
            stripe + p.head + gap10 + p.body + p.info + tag('div', { 'margin-top': '10px' }, p.tail)) + twist('r')), '8px 4px 12px');
    },
    // 🪞 마법 거울: 금속 명암 금빛 타원 테 · 진주 알 테두리(점선) · 위 보석 장식 — 은빛 거울 면(반사 두 줄)에 메시지
    // 🪞 마법 거울: 빛 띠가 지나는 금속 금테(위 밝고 아래 어두운 깎은 테 · 보랏빛 광채) · 두 줄 새김선 + 진주 점선 · 꼭대기 금 받침 보석과 소용돌이 · 진주
    //   양옆 작은 보석 · 아래 받침 장식 — 거울 유리(안쪽 상자를 유리 모양대로 자름)에 메시지
    mirror: (k, p, ui) => {
        const gold = `linear-gradient(100deg, ${k.deco1} 0%, ${k.face} 16%, ${k.deco2} 30%, ${k.deco1} 44%, ${k.face} 58%, ${k.deco2} 76%, ${k.deco1} 92%, ${k.face} 100%)`;
        const pearl = (pos, size) => dot(pos, size, k.chip, { 'background-image': `radial-gradient(circle at 35% 35%, ${WHITE} 0 ${size / 6}px, transparent ${size / 3}px)`, 'box-shadow': `0 1px 0 ${k.deco2}` });
        // 보석 = 금 받침 마름모 위에 보랏빛 마름모(위 왼쪽 반사 · 아래 오른쪽 그늘)
        const jewel = (pos, size) => at(pos, { width: `${size + 6}px`, height: `${size + 6}px`, 'background-color': k.deco2, 'background-image': gold, 'clip-path': 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' },
            at({ left: '3px', top: '3px' }, { width: `${size}px`, height: `${size}px`, 'background-color': k.dialogue, 'background-image': `linear-gradient(135deg, ${al(WHITE, 0.75)} 0 22%, transparent 22% 52%, ${al(k.bg, 0.4)} 52%)`, 'clip-path': 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' }));
        // 소용돌이 = 반쯤 그린 금 고리 두 개(큰 것 · 작은 것) — 오른쪽은 왼쪽을 좌우로 뒤집어 대칭
        const curl = (pos, size, turn, flip = false) => at(pos, { ...box, width: `${size}px`, height: `${size}px`, 'border-radius': '50%', border: `3px solid ${k.deco1}`, 'border-color': `${k.deco1} ${k.deco1} transparent transparent`, transform: `${flip ? 'scaleX(-1) ' : ''}rotate(${turn}deg)`, 'box-shadow': `inset -1px 1px 0 ${al(k.deco2, 0.6)}` });
        const crest = lane(34, curl({ left: 'calc(50% - 42px)', top: '10px' }, 22, -70) + curl({ left: 'calc(50% - 58px)', top: '18px' }, 14, -100)
            + curl({ left: 'calc(50% + 20px)', top: '10px' }, 22, -70, true) + curl({ left: 'calc(50% + 44px)', top: '18px' }, 14, -100, true)
            + pearl({ left: 'calc(50% - 25px)', top: '6px' }, 7) + pearl({ left: 'calc(50% + 18px)', top: '6px' }, 7) + pearl({ ...centerAt(6), top: '0' }, 6)
            + jewel({ ...centerAt(26), top: '6px' }, 20), { 'margin-bottom': '-16px', 'z-index': '1' });
        const foot = lane(18, curl({ left: 'calc(50% - 30px)', top: '-6px' }, 16, -160) + curl({ left: 'calc(50% + 14px)', top: '-6px' }, 16, -160, true)
            + jewel({ ...centerAt(16), top: '-4px' }, 10) + pearl({ left: 'calc(50% - 40px)', top: '4px' }, 5) + pearl({ left: 'calc(50% + 35px)', top: '4px' }, 5), { 'margin-top': '-10px', 'z-index': '1' });
        const sparks = star({ left: '5px', top: '34%' }, 10, k.deco1) + star({ right: '5px', top: '22%' }, 8, k.deco3) + star({ right: '7px', top: '58%' }, 7, k.dialogue) + dot({ left: '9px', top: '52%' }, 3, k.deco3)
            + star({ left: '7px', bottom: '16%' }, 7, k.deco3) + dot({ right: '10px', bottom: '22%' }, 3, k.deco1) + star({ left: '14%', top: '4px' }, 6, k.deco1) + star({ right: '15%', top: '10px' }, 6, k.dialogue);
        const glass = tag('div', { ...box, 'border-radius': '40% / 26px', 'background-color': k.panel, 'background-image': `radial-gradient(ellipse 34% 60px at 18% 0, ${al(WHITE, 0.85)}, transparent), radial-gradient(ellipse 22% 40px at 88% 100%, ${al(WHITE, 0.6)}, transparent)`, padding: '12px 2px', border: `1px solid ${k.deco2}`, 'box-shadow': `inset 0 0 0 2px ${al(WHITE, 0.5)}, inset 0 0 16px ${al(k.dialogue, 0.22)}, 0 0 0 2px ${al(k.deco1, 0.7)}`, overflow: 'hidden' }, p.body);
        const frame = tag('div', { ...box, position: 'relative', 'background-color': k.face, 'background-image': `radial-gradient(ellipse 40% 50px at 26% 18px, ${al(WHITE, 0.4)}, transparent), linear-gradient(to bottom, transparent 55%, ${al(k.deco2, 0.55)}), ${gold}`, color: k.faceText, 'border-radius': '50% / 64px', padding: '7px', margin: '0 8px',
            'box-shadow': `inset 0 0 0 1px ${k.deco2}, inset 0 2px 0 ${al(WHITE, 0.45)}, inset 0 -3px 0 ${al(k.deco2, 0.8)}, 0 3px 0 ${k.deco2}, 0 0 18px ${al(k.dialogue, 0.45)}` },
            jewel({ left: '-5px', top: 'calc(50% - 8px)' }, 10) + jewel({ right: '-5px', top: 'calc(50% - 8px)' }, 10)
            + tag('div', { ...box, 'border-radius': '50% / 58px', border: `3px double ${k.deco2}`, 'box-shadow': `inset 0 0 0 1px ${al(k.deco1, 0.9)}` },
                tag('div', { ...box, 'border-radius': '50% / 54px', border: `2px dotted ${al(k.chip, 0.9)}`, padding: '22px 2px 26px' },
                    p.head + gap10 + glass + p.info + tag('div', { 'margin-top': '12px' }, p.tail))));
        return wrapOuter(k, ui, sparks + crest + frame + foot, '6px 6px 10px');
    },
    // 🌲 으스스한 숲: 두 겹 층 진 전나무 · 나무 사이 빛나는 눈 · 반딧불 · 바닥 안개 두 겹
    forest: (k, p, ui) => {
        const PINE = 'polygon(50% 0, 66% 28%, 58% 28%, 76% 56%, 64% 56%, 88% 88%, 54% 88%, 54% 100%, 46% 100%, 46% 88%, 12% 88%, 36% 56%, 24% 56%, 42% 28%, 34% 28%)';
        const pine = (left, w, h, color) => at({ left, bottom: '0' }, { width: `${w}px`, height: `${h}px`, 'background-color': color, 'clip-path': PINE });
        const back = [['-2%', 40, 50], ['14%', 34, 42], ['30%', 46, 58], ['50%', 36, 46], ['66%', 44, 56], ['84%', 38, 48]].map(([l, w, h]) => pine(l, w, h, al(k.line, 0.55))).join('');
        const front = [['4%', 46, 62], ['22%', 30, 40], ['74%', 34, 46], ['90%', 48, 66]].map(([l, w, h]) => pine(l, w, h, k.deco1)).join('');
        const eyes = (left, top) => at({ left, top }, { width: '16px', height: '5px', 'background-image': `radial-gradient(circle at 3px 2.5px, ${k.deco3} 0 2px, transparent 2.5px), radial-gradient(circle at 13px 2.5px, ${k.deco3} 0 2px, transparent 2.5px)`, 'box-shadow': `0 0 8px 2px ${al(k.deco3, 0.25)}`, 'border-radius': '3px' });
        const fire = pos => dot(pos, 3, k.deco3, { 'box-shadow': `0 0 6px 2px ${al(k.deco3, 0.45)}` });
        const fog = deco({ height: '30px', 'margin-top': '-6px', background: `radial-gradient(ellipse 40% 60% at 20% 70%, ${al(k.deco2, 0.22)}, transparent), radial-gradient(ellipse 46% 70% at 74% 60%, ${al(k.deco2, 0.18)}, transparent), linear-gradient(to bottom, transparent, ${al(k.deco1, 0.5)})`, 'border-radius': '0 0 14px 14px' });
        return wrapOuter(k, ui, lane(66, back + eyes('40%', '30px') + eyes('60%', '42px') + front + fire({ left: '18%', top: '10px' }) + fire({ right: '22%', top: '18px' }) + dot({ left: '58%', top: '6px' }, 2, k.deco3) + star({ left: '44%', top: '4px' }, 7, k.deco2))
            + tag('div', { ...box, 'background-color': k.face, 'background-image': `linear-gradient(to bottom, ${al(k.deco1, 0.55)}, transparent 70px)`, color: k.faceText, padding: '12px 8px', 'border-radius': '4px 4px 0 0', 'box-shadow': `inset 1px 0 0 ${al(k.line, 0.7)}, inset -1px 0 0 ${al(k.line, 0.7)}` },
                p.head + gap10 + p.body + p.info + tag('div', { 'margin-top': '10px' }, p.tail)) + fog + fire({ left: '6px', top: '50%' }) + fire({ right: '5px', top: '64%' }), '6px 12px 12px');
    },
    // 🏚 귀신의 집: 너와 지붕(굴뚝 · 둥근 다락 창 불빛) · 판자 벽 · 빛 새는 창 둘 — 메시지는 불 켜진 방(가는 창틀 + 불빛 번짐)
    house: (k, p, ui) => {
        const lit = { 'background-color': k.deco2, 'background-image': `linear-gradient(${k.deco1}, ${k.deco1}), linear-gradient(${k.deco1}, ${k.deco1})`, 'background-size': '2px 100%, 100% 2px', 'background-position': 'center, center', 'background-repeat': 'no-repeat', 'box-shadow': `0 0 10px 2px ${al(k.deco2, 0.35)}` };
        const roof = lane(66, at({ left: '72%', top: '8px' }, { width: '16px', height: '30px', 'background-color': k.deco3, 'box-shadow': `inset -3px 0 0 ${al(k.bg, 0.35)}`, 'border-radius': '1px' })
            + at({ left: '-6px', right: '-6px', top: '6px', bottom: '0' }, { 'background-color': k.deco1, 'background-image': `repeating-linear-gradient(to bottom, transparent 0 9px, ${al(k.bg, 0.5)} 9px 10px), linear-gradient(90deg, ${al(k.deco3, 0.6)}, transparent 50%, ${al(k.bg, 0.4)})`, 'clip-path': 'polygon(50% 0, 100% 100%, 0 100%)' })
            + at({ ...centerAt(18), top: '32px' }, { ...lit, width: '18px', height: '18px', 'border-radius': '50%' })
            + bat({ left: '14%', top: '4px' }, 16, k.deco3) + bat({ left: '24%', top: '18px' }, 11, k.deco3) + star({ right: '10%', top: '2px' }, 8, k.deco2), { margin: '0 -6px' });
        const windows = lane(24, at({ left: 'calc(50% - 64px)', top: '0' }, { ...lit, width: '20px', height: '22px', 'border-radius': '10px 10px 1px 1px' }) + at({ left: 'calc(50% + 44px)', top: '0' }, { ...lit, width: '20px', height: '22px', 'border-radius': '10px 10px 1px 1px' }), { margin: '6px 0 4px' });
        return wrapOuter(k, ui, roof + tag('div', { ...box, 'background-color': k.face, 'background-image': `repeating-linear-gradient(to bottom, transparent 0 13px, ${al(k.deco3, 0.7)} 13px 14px)`, color: k.faceText, padding: '6px 10px 14px', 'box-shadow': `inset 2px 0 0 ${k.deco3}, inset -2px 0 0 ${k.deco3}` },
            windows + p.head + gap10 + tag('div', { ...box, border: `2px solid ${k.deco3}`, 'border-radius': '8px', 'background-color': k.panel, 'box-shadow': `0 0 0 2px ${al(k.deco2, 0.6)}, 0 0 16px 4px ${al(k.deco2, 0.22)}` }, p.body) + p.info + tag('div', { 'margin-top': '10px' }, p.tail))
            + deco({ height: '6px', 'background-color': k.deco3, 'border-radius': '0 0 6px 6px' }), '12px 12px');
    },
    // 🐈‍⬛ 검은 고양이: 머리에 붙은 귀(분홍 속귀) · 세로 동공 눈 · 분홍 코 · 수염 · 카드를 잡은 앞발 · 말린 꼬리
    cat: (k, p, ui) => {
        const ear = side => at({ top: '-22px', [side]: '30px' }, { width: '40px', height: '34px' },
            tag('div', { position: 'absolute', inset: '0', 'background-color': k.face, 'clip-path': side === 'left' ? 'polygon(36% 0, 100% 78%, 70% 100%, 0 100%)' : 'polygon(64% 0, 100% 100%, 30% 100%, 0 78%)' }, '')
            + tag('div', { position: 'absolute', left: '10px', top: '9px', width: '20px', height: '20px', 'background-color': al(k.deco3, 0.7), 'clip-path': side === 'left' ? 'polygon(36% 0, 90% 80%, 6% 100%)' : 'polygon(64% 0, 94% 100%, 10% 80%)' }, ''));
        const eye = left => at({ left, top: '0' }, { width: '16px', height: '14px', 'border-radius': '50% 50% 50% 50% / 60% 60% 40% 40%', 'background-color': k.deco2, 'background-image': `radial-gradient(circle at 30% 30%, ${al(WHITE, 0.8)} 0 1.5px, transparent 2px), linear-gradient(90deg, transparent 43%, ${k.deco1} 43% 57%, transparent 57%)`, 'box-shadow': `0 0 6px 1px ${al(k.deco2, 0.35)}` });
        const whisk = (side, top, rot) => at({ [side]: '-14px', top }, { width: '30px', height: '1px', 'background-color': al(k.faceMuted, 0.7), transform: `rotate(${rot}deg)` });
        const face = lane(26, eye('calc(50% - 32px)') + eye('calc(50% + 16px)') + at({ ...centerAt(8), top: '14px' }, { width: '8px', height: '5px', 'background-color': k.deco3, 'border-radius': '50% 50% 50% 50% / 30% 30% 70% 70%' })
            + whisk('left', '12px', 6) + whisk('left', '18px', -4) + whisk('right', '12px', -6) + whisk('right', '18px', 4));
        const paw = left => at({ left, top: '-8px' }, { width: '30px', height: '16px', 'border-radius': '15px 15px 8px 8px', 'background-color': k.face, 'box-shadow': `inset 0 1px 0 ${al(k.line, 0.9)}`, 'background-image': `radial-gradient(circle at 9px 11px, ${al(k.deco3, 0.8)} 0 2px, transparent 2.5px), radial-gradient(circle at 15px 9px, ${al(k.deco3, 0.8)} 0 2px, transparent 2.5px), radial-gradient(circle at 21px 11px, ${al(k.deco3, 0.8)} 0 2px, transparent 2.5px)` });
        const tail = at({ right: '-4px', bottom: '-2px' }, { ...box, width: '34px', height: '40px', 'border-radius': '50%', border: `4px solid ${k.deco1}`, 'border-color': `transparent ${k.deco1} ${k.deco1} transparent`, transform: 'rotate(20deg)' });
        const sparks = star({ left: '6px', top: '8px' }, 8, k.deco2) + dot({ right: '10px', top: '14px' }, 3, k.deco2) + star({ right: '4px', top: '40%' }, 6, k.deco3);
        return wrapOuter(k, ui, sparks + tag('div', { ...box, position: 'relative', 'margin-top': '22px', 'background-color': k.face, 'background-image': `radial-gradient(ellipse 60% 70px at 50% 0, ${al(k.line, 0.55)}, transparent)`, color: k.faceText, 'border-radius': '46px 46px 16px 16px / 40px 40px 16px 16px', padding: '16px 10px 14px', 'box-shadow': `inset 0 1px 0 ${al(k.line, 0.9)}` },
            ear('left') + ear('right') + face + p.head + gap10 + p.body + p.info + tag('div', { 'margin-top': '10px' }, p.tail))
            + lane(16, paw('22%') + paw('calc(78% - 30px)') + tail), '10px 14px 6px');
    },
    // 🪦 묘비: 깎은 돌 명암(윗면 빛 · 아랫면 그늘) · 크기 다른 돌 얼룩 · 이끼 · 금 · 초승달 · 들쭉날쭉 풀잎과 작은 꽃
    tomb: (k, p, ui) => {
        const GRASS = 'polygon(0 100%, 0 60%, 3% 20%, 5% 62%, 8% 0, 11% 58%, 15% 30%, 18% 66%, 22% 10%, 25% 60%, 29% 36%, 32% 64%, 36% 4%, 39% 60%, 43% 28%, 47% 62%, 50% 14%, 53% 60%, 57% 34%, 60% 64%, 64% 6%, 67% 60%, 71% 30%, 75% 64%, 78% 12%, 82% 62%, 86% 32%, 89% 60%, 93% 2%, 96% 58%, 100% 26%, 100% 100%)';
        const grass = lane(20, at({ left: '0', right: '0', bottom: '0' }, { height: '18px', 'background-color': k.deco1, 'background-image': `linear-gradient(to top, ${al(k.bg, 0.4)}, transparent)`, 'clip-path': GRASS })
            + dot({ left: '14%', bottom: '10px' }, 5, k.deco3, { 'box-shadow': `0 0 0 1px ${al(k.deco3, 0.5)}` }) + dot({ left: '82%', bottom: '12px' }, 4, k.deco3) + dot({ left: '86%', bottom: '8px' }, 3, k.deco3), { 'margin-top': '-6px' });
        const moon = at({ left: '18px', top: '12px' }, { width: '18px', height: '18px', 'border-radius': '50%', 'box-shadow': `5px -3px 0 0 ${k.deco3}` });
        const sky = moon + dot({ right: '20px', top: '14px' }, 2, k.deco3) + dot({ right: '36px', top: '30px' }, 2, al(k.deco3, 0.7)) + star({ left: '44px', top: '34px' }, 7, k.deco3) + bat({ right: '24px', top: '44px' }, 14, k.deco2);
        const crack = at({ right: '22%', top: '14px' }, { width: '14px', height: '26px', 'background-color': al(k.deco2, 0.8), 'clip-path': 'polygon(40% 0, 50% 0, 30% 40%, 70% 60%, 46% 100%, 40% 100%, 60% 62%, 20% 42%)' });
        const moss = dot({ left: '17%', top: '13px' }, 7, al(k.deco1, 0.85)) + dot({ left: 'calc(17% + 6px)', top: '10px' }, 9, al(k.deco1, 0.75)) + dot({ left: 'calc(17% + 14px)', top: '15px' }, 5, al(k.deco1, 0.85));
        return wrapOuter(k, ui, sky + tag('div', { ...box, position: 'relative', margin: '0 6px', 'background-color': k.face,
            'background-image': `linear-gradient(to bottom, ${al(WHITE, 0.18)}, transparent 40px), radial-gradient(circle at 20% 30%, ${al(k.deco2, 0.7)} 0 1.5px, transparent 2.5px), radial-gradient(circle at 70% 60%, ${al(k.deco2, 0.6)} 0 1px, transparent 2px), radial-gradient(circle at 40% 80%, ${al(WHITE, 0.35)} 0 1px, transparent 2px)`,
            'background-size': '100% 100%, 53px 47px, 37px 61px, 71px 43px', color: k.faceText, 'border-radius': '50% 50% 8px 8px / 90px 90px 8px 8px', padding: '30px 10px 16px', border: `1px solid ${k.line}`, 'box-shadow': `inset 0 3px 0 ${al(WHITE, 0.3)}, inset 0 -5px 0 ${al(k.deco2, 0.55)}, 5px 0 0 -1px ${k.deco2}` },
            crack + moss + hide(tag('div', { 'text-align': 'center', color: k.faceMuted, ...font(ui, 13, '650'), 'letter-spacing': '0.3em', 'line-height': '1.4', 'text-shadow': `0 1px 0 ${al(WHITE, 0.35)}` }, 'R.I.P')) + p.head + gap10 + p.body + p.info + tag('div', { 'margin-top': '10px' }, p.tail)) + grass, '44px 10px 0');
    },
};

/** 컨셉 틀 그리기 — 색 묶음 + 모양 조각 + 메시지 배치 */
export function drawConcept(model, o, frame) {
    const k = CONCEPT_COLORS[frame.colors];
    const ui = o.ui, fields = o.fields;
    const inner = conceptModel(model, k, o.screen ?? null);
    const parts = {
        head: (frame.top ? emojiLine(frame.top, k, ui, 18) : '') + cTitle(fields, k, ui) + (cPills(fields, k, ui) ? tag('div', { height: '6px' }, '') + cPills(fields, k, ui) : ''),
        body: cMessages(inner, o, k, frame.messages ?? 'box'),
        info: cInfo(fields, k, ui),
        tail: cTail(fields, k, ui, frame.tail ?? ''),
    };
    return SHAPES[frame.shape](k, parts, ui);
}

/** 컨셉 틀 데이터 — 한 줄이 틀 하나 (칩: 이모지 + 짧은 이름) */
export const CONCEPT_FRAMES = [
    { id: 'halloween', label: '호박', emoji: '🎃', category: 'halloween', colors: 'pumpkin', shape: 'pumpkin', messages: 'box', tail: '🎃 호박 등불 켜졌어요 🎃' },
    { id: 'halloween-mummy', label: '미라', emoji: '🧟', category: 'halloween', colors: 'mummy', shape: 'mummy', messages: 'box', tail: '🩹 붕대 꽁꽁 🩹' },
    { id: 'halloween-coffin', label: '관', emoji: '⚰️', category: 'halloween', colors: 'coffin', shape: 'coffin', messages: 'box', tail: '🕯 쉿, 자는 중 🕯' },
    { id: 'halloween-ghost', label: '유령', emoji: '👻', category: 'halloween', colors: 'ghost', shape: 'ghost', messages: 'bubble', tail: '부우 · 놀랐지?' },
    { id: 'halloween-bat', label: '박쥐 달밤', emoji: '🦇', category: 'halloween', colors: 'bat', shape: 'bat', messages: 'box', tail: '🌙 달밤 산책 🦇' },
    { id: 'halloween-note', label: '거미줄', emoji: '🕸', category: 'halloween', colors: 'web', shape: 'web', messages: 'box', tail: '거미가 지켜보는 중' },
    { id: 'halloween-witch', label: '마녀', emoji: '🧙', category: 'halloween', colors: 'witch', shape: 'witch', messages: 'box', tail: '🧹 보글보글 🧹' },
    { id: 'halloween-candy', label: '사탕', emoji: '🍬', category: 'halloween', colors: 'candy', shape: 'candy', messages: 'wrap', tail: '🍬 트릭 오어 트릿 🍭' },
    { id: 'halloween-mirror', label: '마법 거울', emoji: '🪞', category: 'halloween', colors: 'mirror', shape: 'mirror', messages: 'box', tail: '거울아 거울아' },
    { id: 'halloween-forest', label: '으스스한 숲', emoji: '🌲', category: 'halloween', colors: 'forest', shape: 'forest', messages: 'box', tail: '🌲 누가 보고 있어 🌲' },
    { id: 'halloween-house', label: '귀신의 집', emoji: '🏚', category: 'halloween', colors: 'house', shape: 'house', messages: 'box', tail: '🕯 불 켜진 방 🕯' },
    { id: 'halloween-cat', label: '검은 고양이', emoji: '🐈‍⬛', category: 'halloween', colors: 'cat', shape: 'cat', messages: 'box', tail: '🐾 🐾 🐾' },
    { id: 'halloween-tomb', label: '묘비', emoji: '🪦', category: 'halloween', colors: 'tomb', shape: 'tomb', messages: 'box', tail: '🌱 편히 쉬어요 🌱' },
];

// ── 갤러리 (분류 gallery) — 사진 여러 장. 사진 = 고른 메시지 안 그림 + 시트에 붙여 넣은 이미지 코드 · 주소(소독한 것) ──
// 가로 스크롤은 overflow-x 칸이라 PC 는 Shift+휠로 넘어가요(브라우저 기본 — 스크립트 없음).
const imgTag = (image, style) => `<img src="${esc(image.src)}" alt="${esc(image.alt || '')}" loading="lazy" style="${esc(Object.entries(style).map(([k, v]) => `${k}:${v}`).join(';'))}">`;
const noImages = (c, ui) => tag('div', { padding: '24px 16px', 'text-align': 'center', color: c.muted, ...font(ui, 13), 'line-height': '1.6', border: `1px dashed ${c.line}`, 'border-radius': '8px' }, '사진 코드나 주소를 붙여 넣으면 여기에 들어가요');
const polaroid = (image, c, ui, i, size) => tag('div', { 'box-sizing': 'border-box', padding: '8px 8px 4px', 'background-color': c.surface, border: `1px solid ${c.line}`, 'border-radius': '4px', ...(size ? { flex: '0 0 auto', width: `${size}px`, 'scroll-snap-align': 'start' } : {}) },
    imgTag(image, { display: 'block', width: '100%', 'aspect-ratio': '1 / 1', 'object-fit': 'cover', 'border-radius': '2px', 'background-color': c.raised })
    + tag('div', { padding: '6px 2px 4px', color: c.muted, ...font(ui, 12), 'line-height': '1.4', 'text-align': 'center', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }, esc(image.alt || `#${i + 1}`)));
function galleryHead(fields, c, ui, withDate) {
    return tag('div', { padding: '16px 16px 12px' }, title(fields, c, ui, withDate ? 20 : 16)
        + (withDate && fields.subtitle ? muted('subtitle', fields.subtitle, c, ui, { 'margin-top': '4px' }) : '')
        + (withDate ? tag('div', { 'margin-top': '8px', color: c.muted, ...font(ui, 12), 'line-height': '1.5', 'border-top': `1px solid ${c.line}`, 'padding-top': '8px' }, `기록 날짜 · ${F('date', fields.date || '')}`) : '')
        + (pills(fields, c, ui) ? gap(8) + pills(fields, c, ui) : ''));
}
function galleryFrame(model, o, kind) {
    const { c, ui, fields } = o;
    const images = o.images ?? [];
    let pics;
    if (!images.length) pics = noImages(c, ui);
    else if (kind === 'strip' || kind === 'strip-polaroid') {
        const items = images.map((image, i) => (kind === 'strip'
            ? imgTag(image, { flex: '0 0 auto', height: '180px', width: 'auto', 'max-width': '80%', 'object-fit': 'cover', 'border-radius': '8px', 'scroll-snap-align': 'start', 'background-color': c.raised })
            : polaroid(image, c, ui, i, 150))).join('');
        pics = tag('div', { display: 'flex', gap: '8px', 'overflow-x': 'auto', 'overflow-y': 'hidden', 'scroll-snap-type': 'x mandatory', 'scrollbar-width': 'none', 'padding-bottom': '4px' }, items);
    } else {
        const items = images.map((image, i) => (kind === 'grid'
            ? imgTag(image, { display: 'block', width: '100%', 'aspect-ratio': '1 / 1', 'object-fit': 'cover', 'border-radius': '8px', 'background-color': c.raised })
            : polaroid(image, c, ui, i, 0))).join('');
        pics = tag('div', { display: 'grid', 'grid-template-columns': `repeat(auto-fill, minmax(${kind === 'grid' ? 104 : 120}px, 1fr))`, gap: '8px' }, items);
    }
    const body = tag('div', { padding: '0 16px 12px' }, pics);
    const log = model.messages.length ? tag('div', { 'border-top': `1px solid ${c.line}` }, scroller(screenLog(model, o), Math.round(o.height * 0.6))) : '';
    return outer(sheet(galleryHead(fields, c, ui, kind === 'grid-polaroid') + body + log + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

/** 프리셋 분류 — 칩 줄 차례. 프리셋 데이터의 category 값 하나로 나뉘어요(분류를 더하려면 여기와 프리셋의 category 만). 저장한 내 글꾸는 'mine' */
export const CATEGORIES = [
    { id: 'basic', label: '기본' },
    { id: 'talk', label: '대화' },
    { id: 'paper', label: '종이' },
    { id: 'halloween', label: '할로윈' },
    { id: 'gallery', label: '갤러리' },
    { id: 'mine', label: '내 글꾸' },
];

export const PRESETS = [
    { id: 'plain', label: '그대로', icon: 'fa-align-left', category: 'basic' },
    { id: 'card', label: '카드', icon: 'fa-square', render: card, category: 'basic' },
    { id: 'tab', label: '탭', icon: 'fa-folder', render: tabs, category: 'basic' },
    { id: 'window', label: '창', icon: 'fa-window-maximize', render: windowFrame, category: 'basic' },
    { id: 'status', label: '상태창', icon: 'fa-table-cells-large', render: status, category: 'basic' },
    { id: 'mini', label: '미니', icon: 'fa-minus', render: mini, category: 'basic' },
    { id: 'lemon', label: '레몬', icon: 'fa-lemon', render: lemon, category: 'basic' },
    { id: 'messenger', label: '메신저', icon: 'fa-comments', render: messenger, category: 'talk' },
    { id: 'notify', label: '알림', icon: 'fa-bell', render: notify, category: 'talk' },
    { id: 'script', label: '대본', icon: 'fa-clapperboard', render: script, category: 'talk' },
    { id: 'record', label: '기록', icon: 'fa-list', render: record, category: 'talk' },
    { id: 'note', label: '노트', icon: 'fa-book-open', render: note, category: 'paper' },
    { id: 'letter', label: '편지', icon: 'fa-envelope', render: letter, category: 'paper' },
    { id: 'diary', label: '일기', icon: 'fa-calendar-day', render: diary, category: 'paper' },
    { id: 'article', label: '기사', icon: 'fa-newspaper', render: article, category: 'paper' },
    { id: 'book', label: '책', icon: 'fa-book', render: book, category: 'paper' },
    // 컨셉 틀(할로윈 · 1.0.1 기념일): 전용 색(own) — 에이드 색 칩은 숨겨요. 칩에는 컨셉 이모지 + 짧은 이름. 데이터는 CONCEPT_FRAMES
    ...CONCEPT_FRAMES.map(f => ({ id: f.id, label: f.label, emoji: f.emoji, category: f.category, own: f.colors, render: (m, o) => drawConcept(m, o, f) })),
    { id: 'gallery-strip', label: '가로 넘김', icon: 'fa-images', render: (m, o) => galleryFrame(m, o, 'strip'), category: 'gallery', images: true },
    { id: 'gallery-strip-polaroid', label: '가로 폴라로이드', icon: 'fa-camera-retro', render: (m, o) => galleryFrame(m, o, 'strip-polaroid'), category: 'gallery', images: true },
    { id: 'gallery-grid', label: '격자', icon: 'fa-table-cells', render: (m, o) => galleryFrame(m, o, 'grid'), category: 'gallery', images: true },
    { id: 'gallery-grid-polaroid', label: '격자 폴라로이드', icon: 'fa-camera', render: (m, o) => galleryFrame(m, o, 'grid-polaroid'), category: 'gallery', images: true },
];

/** 그 분류의 모양 id (프리셋 차례 그대로) — 내 글꾸는 분류가 없어도 'mine' 으로 모아요 */
export function presetsIn(category, customs = []) {
    if (category === 'mine') return customs.map(c => c.id);
    return PRESETS.filter(p => (p.category || 'basic') === category).map(p => p.id);
}
/** 모양 id → 분류 (모르는 id · 내 글꾸는 'mine') */
export const categoryOf = id => PRESETS.find(p => p.id === id)?.category ?? 'mine';

/**
 * @param {object} model captureLog() 결과
 * @param {{ shape?: string, colors?: object, ui?: { family: string, tracking: string }, fields?: object, size?: 's'|'m'|'l', names?: boolean, gap?: boolean }} [options]
 * @returns {string} 인라인 style 만 쓴 HTML (data-f 고치기 표시 포함)
 */
export function renderLog(model, { shape = 'plain', colors = null, ui = null, fields = {}, size = 'm', names = true, gap: blank = true, images = [], screen = null } = {}) {
    if (!model?.messages?.length) return '';
    const preset = PRESETS.find(p => p.id === shape);
    if (!preset?.render || (!colors && !preset.own)) return inkEverywhere(logHtml(model, { names, gap: blank }), model.base.color, { bg: model.base.bg, candidates: [colors?.text] });
    const font = ui ?? { family: model.base['font-family'], tracking: 'normal' };
    const c = preset.own ? CONCEPT_COLORS[preset.own] : colors;
    return inkEverywhere(preset.render(model, { c, ui: font, fields: { count: `${model.messages.length}개`, ...fields }, size, height: HEIGHTS[size] ?? HEIGHTS.m, names, gap: blank, images: [...(model.images ?? []), ...images], screen }), c.text, { bg: c.bg, candidates: preset.own ? [c.faceText, c.panel, c.bg] : [model.base.color, c.surface, c.bg] });
}
