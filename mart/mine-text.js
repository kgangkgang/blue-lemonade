// 11-11 글꾸 마트 「내 글 넣기」 — 붙여 넣은 내 글(실리태번에서 복사한 로그 · 아무 글)을 새 틀(심플 · 게시글 틀)의 글 자리에 나눠 넣어요.
//   사용자 「내 글 넣어서 자동으로 글꾸보여주는 기능 어디감」. 예전 「📝 내 로그로 보기」(옛 글꾸 전용 — 11-11 c02f2e1f 에서 뺌)를 새 틀 길로 되살린 것.
//   나누기는 시식 파서(taste-parse.js parseLog — 「이름:」 줄 · 실리태번 화면 복사 · 이름 줄 + 다음 줄 따옴표 대사 · 빈 줄 번갈아)를 그대로 써요.
//   그리기: 틀의 견본 글 자리(지문 p.gk-nr · 화자 이름 p.gk-nm.gk-n<화자> · 대사 p.gk-dl > span.gk-d.gk-d<화자>)를 본으로 줄마다 다시 만들어요.
//     소리 카드 · 바인더 쪽 넘김처럼 글 사이에 낀 것은 제자리에 둬요(앞 묶음 · 뒤 묶음으로 나눠 넣어요). 제목 · 소품은 그대로예요.
//   DOM 없는 순수 모듈(node 시험). 넣은 글은 이 브라우저에 기억(localStorage) · 켬끔도 기억.
import { parseLog } from './taste-parse.js';
import { THIRD } from './simple-frames.js?v=20261112a';

export const MINE_TEXT_KEY = 'bl-mart-mine-text-v1';
/** 한 틀에 넣는 줄 수 상한(지문 · 이름 · 대사 줄을 합쳐) — 넘으면 앞부분만 */
export const MAX_LINES = 80;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ── 글 → 줄 ──
/** 인라인 노드 → 틀 안 HTML(속마음 em · 강조 strong · 취소 s 만 남기고 나머지는 글자) */
function inlineHtml(nodes) {
    let out = '';
    for (const n of nodes || []) {
        if (n.t === 'text') out += esc(n.text);
        else if (n.t === 'br') out += ' ';
        else if (n.t === 'el') {
            const inner = inlineHtml(n.children);
            out += n.kind === 'em' ? `<em>${inner}</em>` : n.kind === 'strong' ? `<strong>${inner}</strong>` : n.kind === 'del' ? `<s>${inner}</s>` : inner;
        }
    }
    return out;
}
const plain = nodes => (nodes || []).map(n => (n.t === 'text' ? n.text : n.t === 'br' ? ' ' : n.t === 'el' ? plain(n.children) : '')).join('');
/** 블록 하나(문단)를 지문 · 대사 조각으로: 대사(따옴표) 조각은 따로 줄이 되고 그 사이 글은 지문 줄 */
function splitBlock(block, who, out) {
    let buf = [];
    const flush = () => { const html = inlineHtml(buf).replace(/\s+/g, ' ').trim(); if (html) out.push({ type: 'nr', html }); buf = []; };
    for (const n of block.children || []) {
        if (n.t === 'el' && n.kind === 'dialogue') { flush(); const text = plain(n.children).replace(/\s+/g, ' ').trim(); if (text) out.push({ type: 'dl', who, text }); }
        else buf.push(n);
    }
    flush();
}
/** 붙여 넣은 글 → { names, lines: [{ type:'nr', html } | { type:'dl', who, text }], cut } */
export function mineModel(text) {
    const parsed = parseLog(text);
    const lines = [];
    for (const turn of parsed.turns) {
        for (const b of turn.nodes) {
            if (b.t !== 'el') continue;
            if (b.kind === 'li' || (b.children || []).some(c => c.t === 'el' && c.block)) { for (const c of b.children || []) if (c.t === 'el') splitBlock(c, turn.who, lines); }
            else splitBlock(b, turn.who, lines);
        }
        // 대사 표기 없이 이름 붙은 짧은 메시지(「이름: 안녕」 같은 채팅 꼴 — 한 줄 · 80자 이하)는 그 화자 대사로 · 긴 서술(롤플 지문)은 지문 그대로
        //   11-12 밤(사용자 「왜 글꾸 예시로 소주 좀 한다도 나깡 대사에 들어간 거임?」): 첫 이름 앞 머리글(turn.lead — 이름이 안 붙은 글)은 짧아도 지문이에요
        const mine = lines.filter(l => l.turn === undefined);
        for (const l of mine) l.turn = turn;
        if (parsed.mode !== 'alternate' && !turn.lead && mine.length === 1 && mine[0].type === 'nr' && mine[0].html.replace(/<[^>]+>/g, '').length <= 80 && turn.who >= 0) {
            for (const l of mine) { l.type = 'dl'; l.who = turn.who; l.rich = l.html; l.text = l.html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'); delete l.html; }
        }
    }
    for (const l of lines) delete l.turn;
    // 이름이 없는 글(빈 줄로 나눈 그냥 글): 누가 말했는지 모르니 대사를 차례로 깡통 · 깡캐 번갈아 · 이름도 견본 이름
    if (parsed.generic) { let k = 0; for (const l of lines) if (l.type === 'dl') l.who = k++ % 2; parsed.names = ['깡통', '깡캐']; }
    const cut = lines.length > MAX_LINES;
    return { names: parsed.names, generic: parsed.generic, lines: lines.slice(0, MAX_LINES), cut, mode: parsed.mode };
}

// ── 틀에 넣기 ──
const NR_RE = /<p class="gk-nr">(?:(?!<\/p>)[\s\S])*<\/p>/y;
const PAIR_RE = /<p class="gk-nm gk-n([A-Z])">([^<]*)<\/p>(\s*)(<p class="gk-dl"[^>]*><span class="gk-d gk-d[A-Z]">)(?:(?!<\/p>)[\s\S])*?(<\/span><\/p>)/y;
/** 틀 HTML 의 글 자리: { start, end, tokens:[{ kind:'nr'|'pair'|'other', raw, X?, name?, gap?, open?, close? }] } · 꼴이 아니면 null */
export function storyOf(html) {
    const text = String(html ?? ''), at = text.indexOf('</style>');
    const first = text.indexOf('<p class="gk-nr">', at);
    if (at < 0 || first < 0) return null;
    let lastEnd = -1;
    for (const m of text.matchAll(new RegExp(PAIR_RE.source, 'g'))) if (m.index > first) lastEnd = m.index + m[0].length;
    if (lastEnd < 0) return null;
    const tokens = [];
    let i = first, other = '';
    const push = t => { if (other) { tokens.push({ kind: 'other', raw: other }); other = ''; } tokens.push(t); };
    while (i < lastEnd) {
        NR_RE.lastIndex = i; PAIR_RE.lastIndex = i;
        const nr = NR_RE.exec(text);
        if (nr) { push({ kind: 'nr', raw: nr[0] }); i += nr[0].length; continue; }
        const pr = PAIR_RE.exec(text);
        if (pr) { push({ kind: 'pair', raw: pr[0], X: pr[1], name: pr[2], gap: pr[3], open: pr[4], close: pr[5] }); i += pr[0].length; continue; }
        other += text[i++];
    }
    if (other) tokens.push({ kind: 'other', raw: other });
    return { start: first, end: lastEnd, tokens };
}
/** 사이에 낀 것이 공백뿐인 「other」는 묶음을 가르지 않아요 */
const isGap = t => t.kind === 'other' && !/\S/.test(t.raw);

/**
 * 틀 HTML 에 내 글을 넣어요 — 견본 글 자리만 바꾸고 제목 · 소품 · 소리 카드 · 쪽 넘김은 그대로
 * @param {string} html 틀 HTML(조각의 preview 나 그것을 칠한 것)
 * @param {ReturnType<typeof mineModel>|null} model
 */
export function fillMine(html, model) {
    const text = String(html ?? '');
    if (!model || !model.lines?.length) return text;
    const story = storyOf(text);
    if (!story) return text;
    const pairs = story.tokens.filter(t => t.kind === 'pair');
    if (!pairs.length) return text;
    // 화자 본: 견본에서 「깡통」인 화자 = 첫째(내 글의 첫 이름) · 다른 화자 = 둘째(셋째부터도 이 본 — 이름 글자는 제 이름)
    const main = pairs.find(p => p.name === '깡통') || pairs[0], other = pairs.find(p => p !== main && p.X !== main.X) || main;
    const tplOf = who => (who === 0 ? main : other);
    const nrOpen = '<p class="gk-nr">';
    const names = model.names || [];
    const nameOf = who => names[who] || (who === 0 ? '깡통' : '깡캐');
    // 줄 → HTML(대사 앞에는 화자가 바뀌었거나 지문 뒤이면 이름 줄)
    const pieces = [];
    let prevWho = null;
    for (const l of model.lines) {
        if (l.type === 'nr') { pieces.push({ html: `${nrOpen}${l.html}</p>`, dl: false }); prevWho = null; continue; }
        const t = tplOf(l.who), withName = prevWho !== l.who;
        // 11-12 셋째부터: 깡캐 본 클래스에 셋째 글자(THIRD — gk-nZ · gk-dZ)를 더 달아요 — 셋째 색을 안 고르면 깡캐 모습 그대로 · 고르면 그 색(simple-frames toneSimple third)
        const z = l.who >= 2 ? ` gk-n${THIRD}` : '', open = l.who >= 2 ? t.open.replace(/(class="gk-d gk-d[A-Z])"/, `$1 gk-d${THIRD}"`) : t.open;
        pieces.push({ html: `${withName ? `<p class="gk-nm gk-n${t.X}${z}">${esc(nameOf(l.who))}</p>${t.gap}` : ''}${open}${l.rich || esc(l.text)}${t.close}`, dl: true, head: withName });
        prevWho = l.who;
    }
    // 글 자리를 「사이에 낀 것」(소리 카드 · 쪽 넘김)으로 가른 묶음들 — 내 글도 그만큼 나눠 넣어요
    const groups = [[]], between = [];
    for (const t of story.tokens) { if (t.kind === 'other' && !isGap(t)) { between.push(t.raw); groups.push([]); } else groups.at(-1).push(t); }
    const sep = (story.tokens.find(isGap)?.raw) || '\n';
    const parts = [];
    let rest = pieces;
    for (let g = 0; g < groups.length; g++) {
        const left = groups.length - g;
        if (left === 1) { parts.push(rest); break; }
        // 소리 카드 앞 묶음은 첫 대사까지(견본처럼 첫 대사 뒤에 그 목소리) · 그 밖(쪽 넘김)은 남은 줄의 앞쪽 절반을 이름 줄 경계에서
        let cut;
        if (/gk-sd/.test(between[g])) { const k = rest.findIndex(p => p.dl); cut = k < 0 ? rest.length : k + 1; while (cut < rest.length && rest[cut].dl && !rest[cut].head) cut++; }
        else { cut = Math.ceil(rest.length / left); while (cut < rest.length && rest[cut].dl && !rest[cut].head) cut++; }
        parts.push(rest.slice(0, cut)); rest = rest.slice(cut);
    }
    let body = '';
    parts.forEach((p, g) => { body += p.map(x => x.html).join(sep); if (g < between.length) body += between[g]; });
    let out = text.slice(0, story.start) + body + text.slice(story.end);
    // 소리 카드 이름표: 그 카드의 화자 글자 → 그 화자 이름
    out = out.replace(/(<span class="gk-sn gk-s([A-Z])">)([^<]*)(<\/span>)/g, (all, a, X, n, b) => (X === main.X ? `${a}${esc(nameOf(0))}${b}` : X === other.X ? `${a}${esc(nameOf(1))}${b}` : all));
    return out;
}

// ── 지금 상태(이 브라우저에 기억) ──
const store = () => { try { return globalThis.localStorage; } catch { return null; } };
const read = () => { try { const v = JSON.parse(store()?.getItem(MINE_TEXT_KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
let saved = read();
let state = { on: saved.on === true && typeof saved.text === 'string' && !!saved.text.trim(), text: typeof saved.text === 'string' ? saved.text.slice(0, 200000) : '' };
let model = null, rev = 0;
const modelNow = () => (state.on ? (model ||= mineModel(state.text)) : null);
export const mineOn = () => state.on && !!modelNow()?.lines.length;
export const mineText = () => state.text;
/** 11-12 지금 넣은 내 글 줄(꺼져 있으면 null) — 마트 꼴이 아닌 「내 글꾸」(own.js fillSlot)에 넣을 때 */
export const mineModelNow = () => (mineOn() ? modelNow() : null);
export const mineRev = () => rev;
export const mineInfo = () => { const m = modelNow(); return m ? { names: m.names, generic: m.generic, lines: m.lines.length, dialogue: m.lines.filter(l => l.type === 'dl').length, cut: m.cut } : null; };
/** 내 글을 바꾸거나 켜고 꺼요 — 기억하고 'bl-tone-change' 를 알려요(카드 · 크게 보기 · 복사 글이 다시 그려져요) */
export function setMine({ text, on } = {}) {
    if (typeof text === 'string') { state.text = text.slice(0, 200000); model = null; }
    if (on !== undefined) state.on = !!on && !!state.text.trim();
    rev++;
    try { store()?.setItem(MINE_TEXT_KEY, JSON.stringify({ on: state.on, text: state.text })); } catch { /* 기억 못 해도 이번 화면에서는 써요 */ }
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { mine: true } })); } catch { /* 시험 */ }
    return mineInfo();
}
/** 지금 상태로 틀 HTML 에 내 글을 넣어요(꺼져 있으면 그대로) */
export const applyMine = html => (mineOn() ? fillMine(html, modelNow()) : html);

// ── 11-11 글만 복사(마크다운) — 테마 log-copy-render.js logMarkdown 꼴(이름은 **이름** 한 줄 · 메시지 사이 빈 줄) ──
const decodeHtml = s => String(s ?? '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const mdInline = h => decodeHtml(String(h ?? '')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, '**$2**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/g, '*$2*')
    .replace(/<s>([\s\S]*?)<\/s>/g, '~~$1~~')
    .replace(/<span class="blsp-l"[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, '')).replace(/[ \t]+\n/g, '\n').trim();
/** 11-12 숨긴 글이 든 문단은 <div class="… blsp-p">(테마 unparagraphHtml 꼴) — 글만 읽을 때는 그 div 를 짝 맞는 닫는 태그까지 <p> 로 되돌려요(안 div 는 태그만 빠져요) */
function unDivPara(html) {
    let text = html, guard = 0;
    for (let m; (m = /<div\b([^>]*\sclass="[^"]*\bblsp-p\b[^"]*"[^>]*)>/.exec(text)) && guard++ < 200;) {
        const re = /<(\/?)div\b[^>]*>/g; re.lastIndex = m.index + m[0].length;
        let depth = 1, end = -1;
        for (let t; (t = re.exec(text));) { depth += t[1] ? -1 : 1; if (!depth) { end = t.index; break; } }
        if (end < 0) break;
        text = `${text.slice(0, m.index)}<p${m[1].replace(/\s*\bblsp-p\b/, '')}>${text.slice(m.index + m[0].length, end).replace(/<\/?div\b[^>]*>/g, '')}</p>${text.slice(end + 6)}`;
    }
    return text;
}
/** 다 그린 틀 HTML → 글만(마크다운). 숨긴 줄의 흐린 사본 · 소품 · 소리 카드는 빼요 */
export function frameMarkdown(html) {
    let text = String(html ?? '');
    const at = text.indexOf('</style>'); if (at >= 0) text = text.slice(at + 8);
    text = text.replace(/<!--[\s\S]*?-->/g, '').replace(/<div class="blsp-b"[\s\S]*?<\/div><\/summary>/g, '</summary>');
    text = unDivPara(text);
    const out = [];
    // 제목은 틀마다 div · span · p 로 달라요 — 처음 하나만 따로 찾아요(div 를 아래 줄 찾기에 넣으면 글줄을 삼켜요)
    const tm = text.match(/<(div|span|p|h[1-6])\b[^>]*class="(?:[^"]*\s)?gk-tt(?:\s[^"]*)?"[^>]*>((?:(?!<\/\1>)[\s\S])*)<\/\1>/);
    const title = tm ? mdInline(tm[2]) : '';
    if (title) out.push({ k: 'title', t: title });
    for (const m of text.matchAll(/<(span|p)\b[^>]*class="((?:[^"]*\s)?gk-(?:nm|nr|dl|hl)(?:\s[^"]*)?)"[^>]*>((?:(?!<\/\1>)[\s\S])*)<\/\1>/g)) {
        const cls = m[2].split(/\s+/), body = mdInline(m[3]);
        if (!body) continue;
        if (cls.includes('gk-nm')) out.push({ k: 'name', t: body });
        else if (cls.includes('gk-nr') || cls.includes('gk-dl') || cls.includes('gk-hl')) out.push({ k: 'text', t: body });
    }
    let md = '', prev = null;
    for (const x of out) {
        if (x.k === 'title') md += `# ${x.t}\n\n`;
        else if (x.k === 'name') md += `${prev ? '\n' : ''}**${x.t}**\n`;
        else md += `${x.t}\n\n`;
        prev = x.k;
    }
    return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
