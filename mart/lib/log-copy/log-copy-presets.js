// 원본 1.0.9 c5038e7b 의 src/log-copy-presets.js 를 복사한 것이에요 · 고치지 말고 다시 복사해요(글꾸 마트 「🍽️ 시식하기」가 테마 로그 복사와 같은 모양으로 그리려고 써요)
// 로그 복사 — 글꾸 틀(모양) 모음. 모두 블루 레몬에이드 디자인 언어로 새로 그렸다 (평평한 면 + 1px 선 · 모서리 12(작은 칸 8) · 판 알약 · 여백 16 · 사이 8 ·
// 제목 20/650 · 소제목 16/650 · 보조 13 · 알약 12). 색은 고른 에이드 팔레트의 실제 값(c.*)만 — 새 색 · 섞은 색 · 그라데이션 없음(종이 결 하나만 예외: 노트 모눈 = 팔레트 선 색 한 겹).
// 글꼴은 테마 화면 글꼴(ui.family) · 자간(ui.tracking, em), 로그 글은 화면에 보이던 모양 그대로(log-copy-capture.js).
// 출력은 인라인 style 만. data-f 표시는 시트 미리보기에서 눌러 고치는 칸 표시라 복사할 때 걷는다(log-copy-sheet.js).
// 시작 그래프 밖 — 시트를 열 때 받는다.
import { esc, tag, mark, nodesHtml, baseFont, logHtml, logMarkdown, logText, inkEverywhere } from './log-copy-render.js';
import { contrast, parseColor, cssColor } from './shared/ink-paint.js';
import { recolorLog } from './log-copy-words.js';
import { box, font, hide, svgDoc, svgUrl } from './log-copy-concept-kit.js';   // 메시지 배치(유령 말풍선 꼬리 svg) · 컨셉 칸 공용 상자
import { fillTemplate, templateColors, tidyType } from './log-copy-template.js';
import { BUILTIN_TEMPLATES } from './log-copy-builtin.gen.js';   // 1.0.1(11-04) 테마 내장 심플 글꾸(틈 템플릿 · tools/mart/build-builtin.mjs 생성물)

export { logMarkdown, logText };
export const HEIGHTS = { s: 280, m: 420, l: 600 };

// ── 부품 ─────────────────────────────────────────────────────
const F = (key, text, style = {}) => tag('span', style, esc(text)).replace('<span', `<span data-f="${key}"`);

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
// 1.0.1(11-04 「심플하게」): 틀 글(제목 · 날짜 · 꼬리)은 한국어 낱말 중간에서 안 꺾여요(keep-all) — 메시지 글에는 덧대지 않아요
const title = (fields, c, ui, size = 20, key = 'title') => (fields[key] ? tag('div', { color: c.text, ...font(ui, size, '650'), 'line-height': '1.4', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere' }, F(key, fields[key])) : '');
const muted = (key, text, c, ui, more = {}) => (text ? tag('div', { color: c.muted, ...font(ui, 13), 'line-height': '1.5', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere', ...more }, F(key, text)) : '');
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
    // 말풍선 리듬(11-04): 같은 사람이 이어지면 4 · 말하는 사람이 바뀌면 12 — 대화 차례가 눈에 보여요
    let lastTime = null, lastSide = null;
    const rows = model.messages.map((message) => {
        let out = '';
        if (message.time && (lastTime === null || message.time - lastTime >= TIME_GAP || new Date(message.time).toDateString() !== new Date(lastTime).toDateString())) {
            out += tag('div', { margin: '12px 0 8px', 'text-align': 'center', color: c.muted, ...font(ui, 12), 'line-height': '1.4' }, esc(timeLabel(message.time)));
            lastSide = null;
        }
        if (message.time) lastTime = message.time;
        const mine = message.user;
        const bg = mine ? c.accent : c.raised, ink = mine ? c.onAccent : c.text;
        const label = !mine && characters.size > 1 && lastSide !== message.name ? mark(tag('div', { margin: '0 0 4px 4px', color: c.muted, ...font(ui, 12), 'line-height': '1.4' }, esc(message.name)), 'data-bl-name') : '';
        const bubble = mark(tag('div', {
            display: 'inline-block', ...box, 'max-width': '82%', padding: '10px 12px', 'text-align': 'left', 'vertical-align': 'top',
            'border-radius': mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px', 'background-color': bg, ...baseFont(message.font), color: ink, 'overflow-wrap': 'anywhere',
        }, nodesHtml(message.nodes, { inkFix: { bg, ink }, trimEdges: true, relayout: true })), 'data-bl-body');   // data-bl-body: 「HTML 복사」 주석 자리(log-copy-pretty.js)
        const side = mine ? '' : message.name;
        const top = lastSide === null || lastSide === side ? '4px' : '12px';
        lastSide = side;
        return out + mark(tag('div', { margin: `${top} 0 0`, 'text-align': mine ? 'right' : 'left' }, label + bubble), `data-bl-msg data-bl-who="${esc(message.name)}"`);
    }).join('');
    const body = tag('div', { height: `${o.height + 60}px`, 'max-height': '80vh', 'overflow-y': 'auto', 'scrollbar-width': 'none', padding: '4px 12px 12px', 'box-sizing': 'border-box', 'background-color': c.bg }, rows);
    const end = (fields.info?.trim() ? tag('div', { 'background-color': c.surface, 'border-top': `1px solid ${c.line}`, 'padding-bottom': '12px' }, info(fields, c, ui)) : '')
        + (fields.tail?.trim() ? tag('div', { 'background-color': c.surface, 'border-top': `1px solid ${c.line}` }, foot(fields, c, ui)) : '');
    return outer(tag('div', { ...box, 'max-width': '400px', margin: '0 auto', 'background-color': c.bg, border: `1px solid ${c.line}`, 'border-radius': '24px', overflow: 'hidden' }, head + body + end), c, ui);
}

/** 노트: 방안 공책 — 왼쪽 여백 선 하나 · 위에 날짜 · 종이 결은 팔레트 선 색 모눈 한 겹(그라데이션 한 줄 — 편집기가 지우면 맨 종이) */
const GRID = 20;
function note(model, o) {
    const { c, ui, fields } = o;
    const head = tag('div', { padding: '16px 16px 12px 40px' }, muted('date', fields.date, c, ui, { 'margin-bottom': '4px' }) + title(fields, c, ui, 16) + (fields.title ? gap(8) : '') + pills(fields, c, ui));
    const paper = { 'background-image': `linear-gradient(transparent ${GRID - 1}px, ${c.line} ${GRID - 1}px), linear-gradient(90deg, transparent ${GRID - 1}px, ${c.line} ${GRID - 1}px)`, 'background-size': `${GRID}px ${GRID}px` };
    const body = scroller(tag('div', paper, tag('div', { margin: '0 16px 0 28px', padding: '12px 0 16px 12px', 'border-left': `1px solid ${c.accent}` }, flowLog(model, o, c.surface))), o.height, { 'border-top': `1px solid ${c.line}` });
    return outer(sheet(head + body + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

/** 편지: 좁은 종이 · To. / From. */
function letter(model, o) {
    const { c, ui, fields } = o;
    // To. · From. 은 작고 옅게, 받는 이 · 보낸 이 이름만 굵게 (11-04 — 굵기 대비로 위계)
    const lead = text => tag('span', { color: c.muted, ...font(ui, 13) }, text);
    const to = fields.title ? tag('div', { color: c.text, ...font(ui, 18, '650'), 'line-height': '1.4', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere', 'margin-bottom': '20px' }, `${lead('To.')} ${F('title', fields.title)}`) : '';
    const from = fields.from ? tag('div', { 'text-align': 'right', color: c.text, ...font(ui, 16, '650'), 'line-height': '1.4', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere', 'margin-top': '20px' }, `${lead('From.')} ${F('from', fields.from)}`) : '';
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
            + mark(tag('td', { 'background-color': c.surface, 'vertical-align': 'top', padding: '0 0 12px', ...baseFont(message.font), color: ink, 'overflow-wrap': 'anywhere' }, nodesHtml(message.nodes, { inkFix: { bg: c.surface, ink }, trimEdges: true, relayout: 'justify' })), 'data-bl-body')), 'data-bl-msg');
    }).join('');
    const table = tag('table', { width: '100%', 'border-collapse': 'collapse', 'table-layout': 'fixed', 'background-color': c.surface }, `<colgroup><col style="width:76px"><col></colgroup>${rows}`);
    return outer(sheet(head + scroller(tag('div', { padding: '16px 16px 4px' }, table), o.height) + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

/** 일기: 큰 날짜 머리 · 머리 아래 점선 한 줄(공책 칸 선) */
function diary(model, o) {
    const { c, ui, fields } = o;
    const head = tag('div', { padding: '16px', 'border-bottom': `1px dashed ${c.line}` },
        tag('div', { color: c.text, ...font(ui, 20, '650'), 'line-height': '1.4', 'word-break': 'keep-all' }, F('date', fields.date || '')) + muted('title', fields.title, c, ui, { 'margin-top': '4px' }) + (pills(fields, c, ui) ? gap(8) + pills(fields, c, ui) : ''));
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
            top + mark(tag('div', { ...baseFont(message.font), color: ink, 'overflow-wrap': 'anywhere' }, nodesHtml(message.nodes, { inkFix: { bg: c.surface, ink }, trimEdges: true, relayout: true })), 'data-bl-body')), 'data-bl-msg');
    }).join('');
    const head = tag('div', { 'text-align': 'center', 'margin-bottom': '12px' }, title(fields, c, ui, 16) + (pills(fields, c, ui) ? gap(8) + pills(fields, c, ui) : ''));
    return outer(tag('div', { ...box, 'max-width': '400px', margin: '0 auto' }, head + scroller(cards, o.height + 60) + info(fields, c, ui, '4px 0 0') + (fields.tail?.trim() ? muted('tail', fields.tail.trim(), c, ui, { 'text-align': 'center', 'margin-top': '8px' }) : '')), c, ui);
}

/** 기사: 머리기사 · 줄 · 기자란 */
function article(model, o) {
    const { c, ui, fields } = o;
    const kicker = fields.mark ? tag('div', { 'margin-bottom': '8px', 'line-height': '0' }, pill('mark', fields.mark, c, ui, true).replace('margin:0 8px 8px 0', 'margin:0')) : '';
    const byline = [fields.model, fields.prompt].filter(Boolean).length ? tag('div', { color: c.muted, ...font(ui, 13), 'line-height': '1.5', 'margin-top': '8px' }, [fields.model ? F('model', fields.model) : '', fields.prompt ? F('prompt', fields.prompt) : ''].filter(Boolean).join(' · ')) : '';
    // 머리기사 아래는 신문 겹줄(1px 두 줄) 하나 — 기사 틀의 표시
    const head = tag('div', { padding: '16px 16px 12px', 'border-bottom': `3px double ${c.text}` }, kicker + title(fields, c, ui, 20) + byline + muted('date', fields.date, c, ui, { 'margin-top': '4px' }));
    return outer(sheet(head + scroller(tag('div', { padding: '16px' }, flowLog(model, o, c.surface)), o.height) + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c, { 'border-radius': '8px' }), c, ui);
}

/** 책 페이지: 넓은 양쪽 여백 · 위 제목 · 아래 쪽 번호 */
function book(model, o) {
    const { c, ui, fields } = o;
    // 위 제목은 책 머리말(running head)처럼 작게 · 자간 넓게 · 폰에서 글 폭이 남게 옆 여백 28
    const top = fields.title ? tag('div', { 'text-align': 'center', color: c.muted, ...font(ui, 12), 'letter-spacing': '0.06em', 'line-height': '1.5', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere', 'margin-bottom': '20px' }, F('title', fields.title)) : '';
    const number = tag('div', { 'text-align': 'center', color: c.muted, ...font(ui, 12), 'line-height': '1.5', 'margin-top': '20px' }, `— ${F('page', fields.page || '1')} —`);
    const page = tag('div', { padding: '24px 28px' }, top + scroller(flowLog(model, o, c.surface, { names: o.names }), o.height) + number);
    return outer(sheet(page + info(fields, c, ui, '0 28px 24px'), c, { 'max-width': '520px', 'border-radius': '8px' }), c, ui);
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
        return mark(tag('tr', { 'background-color': c.surface }, tag('td', { 'background-color': c.surface, 'vertical-align': 'top', padding: '12px 8px 12px 0', color: c.muted, ...font(ui, 12), 'font-variant-numeric': 'tabular-nums', 'line-height': '1.6', 'white-space': 'nowrap', 'border-top': i ? `1px solid ${c.line}` : '0' }, esc(message.time ? clockLabel(message.time) : `#${message.index ?? i}`))
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
        tag('div', { color: c.muted, ...font(ui, 12), 'line-height': '1.4' }, esc(label)) + tag('div', { color: c.text, ...font(ui, 13, '650'), 'line-height': '1.5', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere' }, F(key, fields[key]))));
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

// 1.0.9 제목 앞 레몬은 🍋 이모지 대신 테마 레몬(fa-lemon · splash.js LEMON_PATH · 탭 아이콘과 같은 면 #FFE23C + 테두리 #E9BE00) 그림 — 붙여 넣는 곳에 글꼴 아이콘이 없어서 그림 부품(svg 주소)으로
const LEMON_MARK = tag('span', { display: 'inline-block', width: '0.95em', height: '0.95em', 'margin-right': '0.3em', 'vertical-align': '-0.1em', background: `${svgUrl(svgDoc(472, 472, `<path fill="#FFE23C" fill-rule="evenodd" stroke="#E9BE00" stroke-width="18" stroke-linejoin="round" transform="translate(12 428) scale(1 -1)" d="M448 352Q447 379 429 397Q411 415 384 416Q374 416 365 413Q348 407 330 404Q311 400 294 404Q237 418 180 399Q124 379 80 336Q37 292 17 236Q-2 179 12 122Q16 105 12 86Q9 68 3 51Q0 42 0 32Q1 5 19 -13Q37 -31 64 -32Q74 -32 83 -29Q100 -23 118 -20Q137 -16 154 -20Q211 -34 268 -15Q324 5 368 48Q411 92 431 148Q450 205 436 262Q432 279 436 298Q439 316 445 333Q448 342 448 352ZM213 321Q171 308 139 277Q108 245 95 203Q90 190 76 193Q62 198 65 212Q80 262 117 299Q154 336 204 351Q218 354 223 340Q226 326 213 321Z"/>`))} center/100% 100% no-repeat` }, '');
/** 레몬: 팔레트 카드(색 고르기 견본)의 두 번째 포인트 막대 · 레몬 그림 */
function lemon(model, o) {
    const { c, ui, fields } = o;
    const bar = tag('div', { height: '4px', width: '46%', 'border-radius': '2px', 'background-color': c.pop, margin: '0 0 12px' }, '');
    const head = tag('div', { padding: '16px 16px 12px' }, bar + tag('div', { color: c.text, ...font(ui, 20, '650'), 'line-height': '1.4', 'overflow-wrap': 'anywhere' }, `${LEMON_MARK}${F('title', fields.title || '')}`) + (pills(fields, c, ui) ? gap(8) + pills(fields, c, ui) : ''));
    const body = tag('div', { margin: '0 12px', 'border-radius': '8px', overflow: 'hidden' }, scroller(screenLog(model, o), o.height));
    return outer(sheet(head + body + gap(12) + info(fields, c, ui, '0 16px 12px') + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

// ── 컨셉 틀 30종(기념일 · 사물 · 장르)은 11-04 글꾸 마트 그림체 「일러스트」로 옮겼어요(tools/mart/geulkku-concept30.mjs — 테마에는 안 실려요).
//    테마 내장은 기본 틀(이 파일 위) + 심플 그림체 내장 글꾸(log-copy-builtin.gen.js · 틈 템플릿 · drawTemplate)만이에요. 아래 conceptParts 는 받은 글꾸 · 내장 심플 글꾸가 함께 써요.

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
// 1.0.1 대개편: 틀마다 제목 꼴(frame.type · 마트 글꾸 item.type — log-copy-template.js tidyType 로 거른 값만)
const TYPE_STACK = { serif: "'Nanum Myeongjo', 'Noto Serif KR', 'Batang', serif", mono: "'D2Coding', 'Consolas', 'Courier New', monospace", hand: "'Nanum Pen Script', 'Gaegu', 'Gamja Flower', sans-serif", display: "'Black Han Sans', 'Do Hyeon', 'Jua', sans-serif" };
export function typeStyle(raw, k) {
    const type = tidyType(raw);
    if (!type) return {};
    const s = {};
    if (type.font && type.font !== 'sans') s['font-family'] = TYPE_STACK[type.font];
    if (type.size) { s['font-size'] = `${type.size}px`; s['line-height'] = type.size >= 26 ? '1.15' : '1.35'; }
    if (type.weight) s['font-weight'] = String(type.weight);
    if (type.align) s['text-align'] = type.align;
    if (type.tracking !== undefined) s['letter-spacing'] = `${type.tracking}em`;
    if (type.upper) s['text-transform'] = 'uppercase';
    if (type.italic) s['font-style'] = 'italic';
    if (type.ink && k?.[type.ink]) s.color = k[type.ink];
    return s;
}
const cTitle = (fields, k, ui, more = {}) => (fields.title ? tag('div', { color: k.faceText, ...font(ui, 20, '650'), 'line-height': '1.4', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere', 'text-align': 'center', ...more }, F('title', fields.title)) : '');
/** 1.0.1(11-04 사용자 「LOG 있는 건 3블럭으로 · 깡통 / 모델 / 프롬프트」): 머리 알약 셋 — 앞 낱말(작고 가는 글씨 · 투명도는 안 써요) + 값(굵게) · 칸이 비면 그 알약은 숨겨요 */
export const HEAD_TAGS = [['char', '깡통'], ['model', '모델'], ['prompt', '프롬프트']];
/** 알약 줄 — align 맞춤 · more 는 줄에, pill 은 알약마다 덧써요 · 세 알약 모두 그 틀의 옛 LOG 알약 색(accent · onAccent)과 모양을 이어받아요
 *  keys 는 옛 호출 꼴 그대로 받지만(mark · model · prompt) 이제 늘 깡통 · 모델 · 프롬프트 셋이에요. 폭이 좁으면 알약 단위로 줄을 바꿔요(알약 안 글은 … 로 줄여 넘치지 않게) */
function cPills(fields, k, ui, align = 'center', more = {}, keys = undefined, pill = {}) {
    void keys;
    const list = HEAD_TAGS.filter(([key]) => fields[key]?.trim?.()).map(([key, label]) => tag('span', {
        display: 'inline-block', ...box, 'max-width': '100%', height: '20px', margin: align === 'left' ? '0 5px 5px 0' : align === 'right' ? '0 0 5px 5px' : '0 2px 5px', padding: '0 7px', 'vertical-align': 'middle', 'border-radius': '10px',
        'background-color': k.accent, color: k.onAccent, ...font(ui, 11, '650'), 'line-height': '20px', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis',
        ...pill, 'background-color': k.accent, color: k.onAccent,
    }, tag('span', { ...font(ui, 10, '400'), 'margin-right': '4px' }, label) + F(key, fields[key].trim(), { 'font-weight': '650' })));
    return list.length ? tag('div', { 'text-align': align, 'line-height': '0', 'margin-bottom': '-5px', ...more }, list.join('')) : '';
}
const cTail = (fields, k, ui, text, more = {}) => tag('div', { 'text-align': 'center', color: k.faceMuted, ...font(ui, 13), 'line-height': '1.6', 'word-break': 'keep-all', 'overflow-wrap': 'anywhere', ...more },
    fields.tail?.trim() ? F('tail', fields.tail.trim()) : text ? F('tail', text) : '');   // 1.0.1 틀 기본 꼬리말(「다음 역은 할로윈」 …)도 고칠 칸 — 편집용 꼴에 「꼬리말 (글자만 바꿔요)」 주석이 붙어요
function cInfo(fields, k, ui, margin = '12px 0 0') {
    if (!fields.info?.trim()) return '';
    const summary = tag('summary', { display: 'block', 'list-style': 'none', cursor: 'pointer', 'min-height': '36px', padding: '0 12px', color: k.text, ...font(ui, 13, '650'), 'line-height': '36px' }, `추가 정보 ${tag('span', { color: k.muted, 'font-weight': '400' }, '▾')}`);
    const text = tag('div', { padding: '0 12px 12px', color: k.muted, ...font(ui, 13), 'line-height': '1.6', 'white-space': 'pre-wrap', 'overflow-wrap': 'anywhere' }, F('info', fields.info.trim()));
    return tag('details', { display: 'block', margin, 'border-radius': '8px', 'background-color': k.panel2 }, summary + text);
}
const emojiLine = (text, k, ui, size = 18) => hide(tag('div', { 'text-align': 'center', color: k.faceMuted, ...font(ui, size), 'line-height': '1.3', 'letter-spacing': '0.1em', 'white-space': 'nowrap', overflow: 'hidden' }, esc(text)));

// ── 메시지 배치: box(화면 상자 그대로 · 컨셉 색) · bubble(유령 말풍선) · wrap(사탕 포장) · columns(신문 두 단) · station(지하철 역) · subtitle(영화 자막) · rpg(레트로 대사창) ──
function cMessages(model, o, k, style) {
    const ui = o.ui;
    if (style === 'box') return scroller(logHtml(model, { names: o.names, gap: o.gap, frameless: false, relayout: 'justify' }), o.height, { 'border-radius': '12px', 'background-color': k.panel });
    if (style === 'columns') return scroller(tag('div', { 'column-count': '2', 'column-gap': '14px', 'column-rule': `1px solid ${k.line}`, 'background-color': k.panel }, logHtml(model, { names: o.names, gap: o.gap, frameless: false, relayout: 'justify' })), o.height, { 'background-color': k.panel });
    const flow = (message, bg) => nodesHtml(message.nodes, { inkFix: { bg, ink: k.text }, trimEdges: true, relayout: true });
    if (style === 'station') {
        // 역 점: 상대는 흰 속 · 내 말은 꽉 찬 환승역, 왼쪽 세로 노선 한 줄
        const stop = mine => hide(tag('span', { position: 'absolute', left: '-31px', top: '2px', width: '14px', height: '14px', 'border-radius': '50%', 'box-sizing': 'border-box', 'background-color': mine ? k.deco1 : k.panel, border: `4px solid ${k.deco1}` }, ''));
        const stops = model.messages.map((message, i) => {
            const mine = message.user;
            const when = mine ? '환승' : message.time ? `${clockLabel(message.time)} 도착` : '';
            const label = o.names && message.name ? mark(tag('div', { color: k.name, ...font(ui, 12, '650'), 'line-height': '1.5', 'overflow-wrap': 'anywhere' }, `${esc(message.name)} 역 ${tag('span', { color: k.muted, ...font(ui, 11) }, esc(when))}`), 'data-bl-name') : '';
            return mark(tag('div', { position: 'relative', margin: i ? '14px 0 0' : '0' }, stop(mine) + label + mark(tag('div', { ...baseFont(message.font), color: k.text, 'margin-top': '4px', 'overflow-wrap': 'anywhere' }, flow(message, k.panel)), 'data-bl-body')), 'data-bl-msg');
        }).join('');
        const end = tag('div', { position: 'relative', 'margin-top': '14px' }, stop(false) + tag('div', { color: k.muted, ...font(ui, 11), 'line-height': '1.6' }, '종착'));
        return scroller(tag('div', { position: 'relative', padding: '4px 0 2px 34px', 'background-color': k.panel }, hide(tag('div', { position: 'absolute', left: '11px', top: '6px', bottom: '6px', width: '6px', 'background-color': k.deco1, 'border-radius': '3px' }, '')) + stops + end), o.height + 40);
    }
    if (style === 'subtitle') {
        const lines = model.messages.map((message, i) => mark(tag('div', { margin: i ? '12px 0 0' : '0', 'text-align': 'center' },
            (o.names && message.name ? mark(tag('div', { color: k.name, ...font(ui, 11, '650'), 'letter-spacing': '0.08em', 'line-height': '1.5', margin: '0 0 2px' }, esc(message.name)), 'data-bl-name') : '')
            + mark(tag('div', { ...baseFont(message.font), color: k.text, 'text-shadow': `0 1px 2px ${k.panel2}, 0 0 6px ${k.panel2}`, 'overflow-wrap': 'anywhere' }, flow(message, k.panel)), 'data-bl-body')), 'data-bl-msg')).join('');
        return scroller(tag('div', { padding: '10px 12px', 'background-color': k.panel, 'border-radius': '4px' }, lines), o.height);
    }
    const items = model.messages.map((message) => {
        const name = o.names && message.name ? mark(tag('div', { color: k.name, ...font(ui, 13, '650'), 'line-height': '1.5', margin: '0 0 4px' }, esc(message.name)), 'data-bl-name') : '';
        const body = name + nodesHtml(message.nodes, { inkFix: { bg: k.panel2, ink: k.text }, trimEdges: true, relayout: true });
        const textBox = { ...box, ...baseFont(message.font), color: k.text, 'background-color': k.panel2, padding: '10px 12px', 'overflow-wrap': 'anywhere' };
        if (style === 'bubble') {
            const mine = message.user;
            const bubble = mark(tag('div', { ...textBox, display: 'inline-block', 'max-width': '92%', 'text-align': 'left', 'border-radius': mine ? '18px 18px 6px 18px' : '18px 18px 18px 6px', border: `1px solid ${k.line}`, 'box-shadow': `0 2px 0 ${k.deco3}` }, body), 'data-bl-body');
            // 1.0.1(11-04 「로그에 얼굴 들어가는 거 별로」): 받는 쪽 말풍선 앞 표시는 얼굴 있는 이모지 대신 작은 빛방울 그림
            const ghost = hide(tag('span', { display: 'inline-block', width: '18px', height: '20px', 'vertical-align': 'top', color: k.faceMuted, background: `${svgUrl(svgDoc(18, 20, `<defs><radialGradient id="g" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="${k.deco3}"/><stop offset="1" stop-color="${k.line}"/></radialGradient></defs><circle cx="9" cy="11" r="5.5" fill="url(#g)"/><circle cx="13.5" cy="5" r="1.6" fill="${k.deco3}"/>`))} center/18px 20px no-repeat` }, ''));
            return mark(tag('div', { margin: '0 0 10px', 'text-align': mine ? 'right' : 'left' }, mine ? bubble : ghost + bubble), 'data-bl-msg');
        }
        if (style === 'rpg') {
            // 레트로 대사창: 3px 테 상자, 위 테에 걸친 이름표, 오른쪽 아래 ▼
            const nameTag = o.names && message.name ? mark(tag('div', { position: 'absolute', left: '12px', top: '-11px', 'max-width': '80%', padding: '0 8px', 'background-color': k.panel2, color: k.name, ...font(ui, 11, '650'), 'letter-spacing': '0.14em', 'line-height': '1.6', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis', 'box-sizing': 'border-box' }, esc(message.name)), 'data-bl-name') : '';
            return mark(tag('div', { ...textBox, position: 'relative', border: `3px solid ${k.line}`, padding: '14px 14px 18px', margin: '12px 0 0' }, nameTag + flow(message, k.panel2) + hide(tag('div', { position: 'absolute', right: '10px', bottom: '4px', color: k.muted, ...font(ui, 11), 'line-height': '1' }, '▼'))), 'data-bl-msg');
        }
        // wrap: 사탕 포장 — 가운데 글 칸, 양쪽 꼬인 끝(작은 리본)
        const end = side => hide(tag('div', { flex: '0 0 8px', 'align-self': 'center', width: '8px', height: '20px', 'background-color': k.deco2, 'clip-path': side === 'l' ? 'polygon(0 0, 100% 35%, 100% 65%, 0 100%, 30% 50%)' : 'polygon(100% 0, 0 35%, 0 65%, 100% 100%, 70% 50%)' }, ''));
        return mark(tag('div', { display: 'flex', 'align-items': 'stretch', gap: '0', margin: '0 0 10px' }, end('l') + mark(tag('div', { ...textBox, padding: '10px', flex: '1 1 auto', 'min-width': '0', 'border-radius': '14px', border: `1px solid ${k.line}`, 'box-shadow': `inset 0 2px 0 ${k.panel}` }, body), 'data-bl-body') + end('r')), 'data-bl-msg');
    }).join('');
    return scroller(tag('div', { padding: style === 'wrap' ? '10px 0 2px' : '12px 4px 2px', 'background-color': k.panel, 'border-radius': '12px' }, items), o.height + 40);
}

/** 1.0.1 글꾸 마트 글꾸(내 글꾸 template) — 받은 고정 색 묶음 + 틈 템플릿의 네 자리에 컨셉 틀과 같은 부품을 끼워요 */
export function drawTemplate(model, o, item) {
    const k = templateColors(item.colors);
    return fillTemplate(item.template, conceptParts(model, o, k, { messages: item.messages, tail: item.tail, type: item.type }));
}
/** 컨셉 틀 · 틈 템플릿이 함께 쓰는 부품 (frame: messages · tail · top) */
export function conceptParts(model, o, k, frame) {
    const ui = o.ui, fields = o.fields;
    const inner = conceptModel(model, k, o.screen ?? null);
    return {
        head: (frame.top ? emojiLine(frame.top, k, ui, 18) : '') + cTitle(fields, k, ui, typeStyle(frame.type, k)) + (cPills(fields, k, ui, tidyType(frame.type)?.align ?? 'center') ? tag('div', { height: '6px' }, '') + cPills(fields, k, ui, tidyType(frame.type)?.align ?? 'center') : ''),
        body: cMessages(inner, o, k, frame.messages ?? 'box'),
        info: cInfo(fields, k, ui),
        tail: cTail(fields, k, ui, frame.tail ?? ''),
        // 컨셉 30종이 머리 · 바닥 줄을 제 나름대로 짤 때 쓰는 부품(모두 인라인 style · data-f 표시 포함)
        fields, n: model.messages.length, count: fields.count ?? `${model.messages.length}개`, model: inner,
        tailPlain: frame.tail ?? '', tailText: fields.tail?.trim() ? F('tail', fields.tail.trim()) : esc(frame.tail ?? ''),
        f: (key, style = {}) => (fields[key] ? F(key, fields[key], style) : ''),
        title: (more = {}) => (fields.title ? tag('div', { color: k.faceText, ...font(ui, 16, '650'), ...typeStyle(frame.type, k), 'line-height': '1.4', 'overflow-wrap': 'anywhere', 'min-width': '0', ...more }, F('title', fields.title)) : ''),
        date: (more = {}) => (fields.date ? tag('span', { color: k.faceMuted, ...font(ui, 12), 'line-height': '1.5', flex: '0 0 auto', 'white-space': 'nowrap', ...more }, F('date', fields.date)) : ''),
        pills: (align = 'left', more = {}, keys = undefined, pill = {}) => cPills(fields, k, ui, align, more, keys, pill),
    };
}

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
            ? imgTag(image, { flex: '0 0 auto', height: '200px', width: 'auto', 'max-width': '80%', 'object-fit': 'cover', 'border-radius': '8px', 'scroll-snap-align': 'start', 'background-color': c.raised })
            : polaroid(image, c, ui, i, 150))).join('');
        pics = tag('div', { display: 'flex', gap: '8px', 'overflow-x': 'auto', 'overflow-y': 'hidden', 'scroll-snap-type': 'x mandatory', 'scrollbar-width': 'none', 'padding-bottom': '4px' }, items);
    } else {
        const items = images.map((image, i) => (kind === 'grid'
            ? imgTag(image, { display: 'block', width: '100%', 'aspect-ratio': '1 / 1', 'object-fit': 'cover', 'border-radius': '8px', 'background-color': c.raised })
            : polaroid(image, c, ui, i, 0))).join('');
        pics = tag('div', { display: 'grid', 'grid-template-columns': `repeat(auto-fill, minmax(${kind === 'grid' ? 104 : 120}px, 1fr))`, gap: '8px' }, items);
    }
    const body = tag('div', { padding: '0 16px 12px' }, pics);
    // 갤러리는 사진이 주인공 — 로그 칸은 낮게(높이의 반)
    const log = model.messages.length ? tag('div', { 'border-top': `1px solid ${c.line}` }, scroller(screenLog(model, o), Math.round(o.height * 0.5))) : '';
    return outer(sheet(galleryHead(fields, c, ui, kind === 'grid-polaroid') + body + log + info(fields, c, ui) + foot(fields, c, ui, { 'border-top': `1px solid ${c.line}` }), c), c, ui);
}

/** 프리셋 분류 — 칩 줄 차례. 프리셋 데이터의 category 값 하나로 나뉘어요(분류를 더하려면 여기와 프리셋의 category 만). 저장한 내 글꾸는 'mine' */
const ALL_CATEGORIES = [
    { id: 'basic', label: '기본' },
    { id: 'talk', label: '대화' },
    { id: 'paper', label: '종이' },
    { id: 'event', label: '기념일' },
    { id: 'thing', label: '사물' },
    { id: 'genre', label: '장르' },
    { id: 'react', label: '반응' },   // 1.0.9 누르면 반응하는 글꾸(봉투 열기 · 초대장 · 쪽 넘기기 · 통통 카드 — tools/mart/react-geulkku.mjs)
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
    // 내장 심플 글꾸(1.0.1 · 11-04): 글꾸 마트 「심플」 그림체와 같은 틈 템플릿 · 전용 색(own) — 에이드 색 칩은 숨겨요. 칩에는 이모지 + 짧은 이름.
    //   옛 내장 컨셉 30(오리지널 그림)은 글꾸 마트 「일러스트」로 옮겼어요(tools/mart/geulkku-concept30.mjs)
    ...BUILTIN_TEMPLATES.map(t => ({ id: t.id, label: t.label, emoji: t.emoji, category: t.category, own: t.id, template: t, render: (m, o) => drawTemplate(m, o, t) })),
    { id: 'gallery-strip', label: '가로 넘김', icon: 'fa-images', render: (m, o) => galleryFrame(m, o, 'strip'), category: 'gallery', images: true },
    { id: 'gallery-strip-polaroid', label: '가로 폴라로이드', icon: 'fa-camera-retro', render: (m, o) => galleryFrame(m, o, 'strip-polaroid'), category: 'gallery', images: true },
    { id: 'gallery-grid', label: '격자', icon: 'fa-table-cells', render: (m, o) => galleryFrame(m, o, 'grid'), category: 'gallery', images: true },
    { id: 'gallery-grid-polaroid', label: '격자 폴라로이드', icon: 'fa-camera', render: (m, o) => galleryFrame(m, o, 'grid-polaroid'), category: 'gallery', images: true },
];

/** 분류 칩 — 틀이 하나라도 있는 분류만(내장 심플 글꾸가 아직 없는 기념일 · 장르 칩은 숨어요) · 내 글꾸는 늘 */
export const CATEGORIES = ALL_CATEGORIES.filter(c => c.id === 'mine' || PRESETS.some(p => (p.category || 'basic') === c.id));
/** 내장 글꾸 전용 색(own) — 시트가 미리보기 바탕 · 숨긴 글 색에 써요 */
export const OWN_COLORS = Object.fromEntries(BUILTIN_TEMPLATES.map(t => [t.id, templateColors(t.colors)]));
/** 1.0.1 시험판에서 고른 옛 내장 컨셉 id(컨셉 30 은 1.0.1 에 처음 들어와 게시 전에 마트로 옮겼어요) → 같은 주제의 내장 심플 글꾸 id (없으면 그대로 — 시트가 모르는 id 는 카드로) */
export const movedShape = id => BUILTIN_TEMPLATES.find(t => t.was === id)?.id ?? id;

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
export function renderLog(model, { shape = 'plain', colors = null, ui = null, fields = {}, size = 'm', names = true, gap: blank = true, images = [], screen = null, template = null } = {}) {
    if (!model?.messages?.length) return '';
    // 1.0.1 template: 글꾸 마트에서 받은 내 글꾸(틈 템플릿 · 전용 색) — 렌더 분기는 여기 한 곳
    const found = template?.template ? null : PRESETS.find(p => p.id === shape);
    const tpl = template?.template ? template : found?.template ?? null;   // 받은 글꾸 · 내장 심플 글꾸(틈 템플릿)
    const preset = template?.template ? { own: 'template', render: (m, o) => drawTemplate(m, o, template) } : found;
    if (!preset?.render || (!colors && !preset.own)) return inkEverywhere(logHtml(model, { names, gap: blank }), model.base.color, { bg: model.base.bg, candidates: [colors?.text] });
    const font = ui ?? { family: model.base['font-family'], tracking: 'normal' };
    const c = tpl ? templateColors(tpl.colors) : colors;
    return inkEverywhere(preset.render(model, { c, ui: font, fields: { count: `${model.messages.length}개`, ...fields }, size, height: HEIGHTS[size] ?? HEIGHTS.m, names, gap: blank, images: [...(model.images ?? []), ...images], screen }), c.text, { bg: c.bg, candidates: preset.own ? [c.faceText, c.panel, c.bg] : [model.base.color, c.surface, c.bg], keepOwn: !!tpl });
}
