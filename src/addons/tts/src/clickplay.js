// TTS · 대사 클릭 재생 (1.2.0 §6) · 속마음 클릭 (1.2.1)
// 채팅의 대화문 한 줄(또는 속마음 하나)을 한 번 클릭하면 그것만 읽는다 (설정 click_play).
//
// 흐름: #chat 의 click → .mes .mes_text 안인지 · 편집 중이 아닌지 · 글이 선택돼 있지 않은지 · 버튼/링크가 아닌지 확인
//   → caretPositionFromPoint 로 누른 글자 자리
//   → 먼저 속마음: 누른 글자를 감싼 속마음 틀 (findClickedThought) → text.segmentMessage 의 속마음 조각과 맞춤
//   → 아니면 대화문: .mes_text 의 글자 노드를 이어 붙인 문자열에서 여닫이 짝 찾기 → 같은 대화문 조각(번역문 → 원문 차례), 없으면 즉석 조각
//     (조각이 없는 대화문이 속마음 조각 안에 있으면 그 속마음으로 올림 — text.js 도 속마음 안의 「」 는 대화문으로 치지 않는다)
//   → player.speakSegments(mesId, [seg]) (지금 읽던 건 끊김. 강조는 재생기의 기존 길로 붙는다)
// preventDefault · stopPropagation 은 절대 쓰지 않는다 (테마의 접기·번역 토글은 그대로 돈다).
// 여닫이 짝(또는 속마음 틀) 안의 글자를 실제로 눌렀을 때만 (글자 상자로 확인 — 줄 끝 오른쪽·아래 빈 곳은 가장 가까운 자리로 잡혀도 무시).
// 확장 '사용'이 꺼져 있으면 대사 클릭도 쉰다 (글을 누르는 건 실수로도 일어나서) — 메시지 ▶ 버튼은 손으로 고른 것이라 꺼져 있어도 읽는다.
//
// 속마음 틀 (데우스 프리셋 정규식이 그리는 모양):
//   강한 틀  span.custom-tt.custom-tt-<이름> 안에 em (「속마음 색 (캐릭터별)」: <true_thoughts character="이름"> → <span class="tt tt-이름"><em>…</em></span>,
//            실리태번이 class 에 custom- 을 붙임). 세 가지가 다 있어야 강한 틀 (카드의 툴팁 .tt · .tt-text 는 아님).
//            이름은 class 끝, 색은 class 스타일이라 getComputedStyle 로 읽음
//   약한 틀  가장 가까운 em · i · font, 없으면 문단(p · div …). 「Show @True Thoughts」 의 *…* (이름 없는 속마음) ·
//            여러 문단 속마음의 둘째 문단부터 (showdown 이 나눠 span 이 빠짐) · "이름 true thoughts:" 라벨.
//            속마음 전체 또는 그 한 문단과 글이 같을 때만 받아들인다 (그냥 기울인 서술 · 속마음이 따라 적은 대사·서술은 조용히 넘어감)
// 속마음은 읽기 설정의 속마음 길이 '건너뛰기'여도 누르면 읽는다 (재생기가 tapped 로 받음). 자동 읽기의 조각 수는 그대로 (index.js segOpts 는 안 건드림).
// 속마음 화자: 이름(character= · class 끝)에 정해 둔 목소리가 있으면 이름, 없으면 틀의 색 → 이름 → 보낸 사람 (번역문의 "캐릭터" 처럼 모르는 이름)
//
// findClickedDialogue(root, x, y, opts) 는 DOM 만 보는 도우미 (tests/clickplay.test.mjs 가 가짜 DOM 으로 검사)
//   → { text, raw, quoted, color, speakerHint, line, start, end } | null
// findClickedThought(root, x, y) → { kind: 'thought', strong, match, text, raw, nameHint, color, line, lines, ordinal, frames } | null  (1.2.4: 강한 틀 순번·개수)
//   match: 'any' (속마음 전체 · 한 문단과 같음) | 'part' (문단 틀: 같은 것만) | 'equal' (문단 일부인 기울임: 속마음 전체와 같을 때만)
//   강한 틀은 속마음이 누른 글을 품어도 맞음 (여러 문단 속마음의 첫 문단). 같은 글이 여럿이면 class 이름과 주인이 같은 것 → 누른 줄에 가까운 것
// segmentForHit(mes, hit) → Segment (text.js 모양 + dialogueIndex: 원문 대화문 목록에서의 번호, 못 찾으면 -1
//   · 속마음이면 thoughtIndex: 그 목록의 속마음 번호, 즉석이면 -1) | null (약한 속마음 틀이 어느 속마음과도 안 맞음)

import { chat, substituteParams } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';
import { settings } from './settings.js';
import { segmentMessage, pairSegments, parseRegexLines, normColor, speechDisplay } from './text.js';
import { resolveSpeaker, canon, knownNames as learnedNames } from './speakers.js';
import { findVoice, voiceByName } from './voices.js';
import { speakSegments } from './player.js';
import { log } from './log.js';

// 대화문 여닫이 글자 (text.js 와 같은 짝 + „“). ASCII ' 는 안 씀
const CLOSER = { '“': '”', '"': '"', '「': '」', '『': '』', '«': '»', '＂': '＂', '‘': '’', '„': '“' };
const ONE_LINE = new Set(['"', '＂']); // 좌우 같은 모양 → 한 줄 안에서만 짝을 찾음
const LETTER = /[\p{L}\p{N}]/u;
const HEX_BEFORE = /(?:^|\s)#([0-9a-fA-F]{6})[ \t]*$/;                 // 데우스 맨 색 표기  #e63946 "…"
const PREFIX_COLON = /^\s*([^\s:：「『“"]{1,20})\s*[:：]\s*$/;           // 이름: 「…」
const PREFIX_BARE = /^\s*([^\s「『]{1,20})$/;                            // 이름「…」 (아는 이름일 때만)

// 클릭을 무시할 대상 (그 안을 눌렀을 때)
const INTERACTIVE = 'a, button, input, textarea, select, img, video, audio, details, summary, code, pre, .mes_button, [contenteditable]';
// 글자를 세지 않는 요소 (그 안의 글은 대화문 짝 찾기에 넣지 않음)
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'BUTTON', 'SELECT', 'INPUT', 'DETAILS', 'SVG']);
// 줄을 나누는 블록 요소 (앞에 문단 경계를 넣음)
const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'DL', 'DT', 'DD', 'TR', 'TABLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'HR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'NAV', 'MAIN', 'FIGURE', 'FIGCAPTION']);
const SHOW_ELEMENT_AND_TEXT = 0x1 | 0x4;   // NodeFilter.SHOW_ELEMENT | SHOW_TEXT
const FILTER_ACCEPT = 1, FILTER_REJECT = 2;
// 속마음 틀: span 의 class 낱말 custom-tt + custom-tt-<이름> + 안에 em (강한 틀), 약한 틀은 기울임·색 글자 → 없으면 문단
const THOUGHT_NAME = /^custom-tt-(.+)$/;
const WEAK_INLINE = new Set(['EM', 'I', 'FONT']);
const MIN_PART = 4;                                                       // 강한 틀을 포함으로 맞출 때 누른 글의 최소 글자 수
const LABEL_HEAD = /^.*?\btrue\s+thoughts?\s*[:：]\s*/i;                  // "Character true thoughts: …" 라벨 머리

// ---------- 작은 도구
function sub(text) { try { return substituteParams(String(text || '')); } catch { return String(text || ''); } }
const fold = (s) => String(s || '').normalize('NFC').replace(/[*_~`\u200b-\u200f\ufeff]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const letters = (s) => (String(s || '').match(/[\p{L}\p{N}]/gu) || []).length;
function inside(node, root) { for (let n = node; n; n = n.parentNode) if (n === root) return true; return false; }
function isHidden(el) {
    if (el.hidden === true || el.style?.display === 'none') return true;
    if (typeof getComputedStyle === 'function') { try { return getComputedStyle(el).display === 'none'; } catch { /* 떨어진 요소 */ } }
    return false;
}

/** 강한 속마음 틀이면 그 이름 (class custom-tt + custom-tt-<이름> + 안에 em), 아니면 null */
function strongName(el) {
    if (!el || el.tagName !== 'SPAN') return null;
    const toks = String(el.getAttribute?.('class') || '').split(/\s+/);
    const own = toks.map(t => THOUGHT_NAME.exec(t)).find(Boolean);
    return own && toks.includes('custom-tt') && el.querySelector?.('em') ? own[1] : null;
}

// ---------- 누른 자리 (글자 노드 + 자리)
function caretAt(x, y) {
    try {
        if (typeof document.caretPositionFromPoint === 'function') {
            const p = document.caretPositionFromPoint(x, y);
            if (p && p.offsetNode) return { node: p.offsetNode, offset: Number(p.offset) || 0 };
        }
        if (typeof document.caretRangeFromPoint === 'function') {
            const r = document.caretRangeFromPoint(x, y);
            if (r && r.startContainer) return { node: r.startContainer, offset: Number(r.startOffset) || 0 };
        }
    } catch { /* 지원하지 않는 환경 */ }
    return null;
}
/** 요소 자리(자식 번호)면 그 옆의 글자 노드로 옮김 */
function toTextNode(node, offset) {
    if (node.nodeType === 3) return { node, offset };
    const kids = node.childNodes || [];
    const after = kids[offset], before = kids[offset - 1];
    if (after && after.nodeType === 3) return { node: after, offset: 0 };
    if (before && before.nodeType === 3) return { node: before, offset: String(before.nodeValue || '').length };
    return null;
}

// ---------- 글자 노드 이어 붙이기 (문단 경계 '\n\n' · <br> '\n')
function textIndex(root) {
    const nodes = [];
    let flat = '';
    const walker = document.createTreeWalker(root, SHOW_ELEMENT_AND_TEXT, (n) => (n.nodeType === 1 && (SKIP_TAGS.has(n.tagName) || isHidden(n)) ? FILTER_REJECT : FILTER_ACCEPT));
    for (let n; (n = walker.nextNode());) {
        if (n.nodeType === 1) {
            if (n.tagName === 'BR') flat += '\n';
            else if (BLOCK_TAGS.has(n.tagName) && flat && !flat.endsWith('\n\n')) flat += flat.endsWith('\n') ? '\n' : '\n\n';
            continue;
        }
        if (n.nodeType !== 3) continue;
        nodes.push({ node: n, start: flat.length });
        flat += String(n.nodeValue || '');
    }
    return { nodes, flat };
}

// ---------- 대화문 짝 찾기 (text.js scanDialogue 와 같은 규칙, 다 온 글 기준)
function paraEnd(s, from) {
    const re = /\n[ \t]*\n/g;
    re.lastIndex = from;
    const m = re.exec(s);
    return m ? m.index : -1;
}
function findCloser(s, closer, from, to) {
    for (let k = s.indexOf(closer, from); k >= 0 && k < to; k = s.indexOf(closer, k + 1)) {
        if (closer === '’' && LETTER.test(s[k + 1] || '')) continue; // don’t 의 ’ 는 닫는 글자가 아님
        return k;
    }
    return -1;
}
/** [{ start, end, is, ie, opener }] — start/end 는 여닫이 글자 포함, is/ie 는 안쪽 */
function scanDialogue(body) {
    const out = [], n = body.length;
    let i = 0;
    while (i < n) {
        const ch = body[i], closer = CLOSER[ch];
        if (!closer || (ch === '‘' && LETTER.test(body[i - 1] || ''))) { i++; continue; }
        const oneLine = ONE_LINE.has(ch);
        let bound = oneLine ? body.indexOf('\n', i) : paraEnd(body, i);
        if (bound < 0) bound = n;
        const j = findCloser(body, closer, i + 1, bound);
        if (j >= 0) { out.push({ start: i, end: j + 1, is: i + 1, ie: j, opener: ch }); i = j + 1; continue; }
        if (!/\S/.test(body.slice(bound))) { out.push({ start: i, end: n, is: i + 1, ie: n, opener: ch }); break; } // 글 끝에서 안 닫힘
        if (oneLine) { i++; continue; }
        out.push({ start: i, end: bound, is: i + 1, ie: bound, opener: ch }); // 여러 문단 대화의 첫 문단
        i = bound;
    }
    return out;
}

// ---------- 색 · 이름 힌트
/** 누른 글자 노드를 감싼 요소의 색 (안쪽부터): style="color:…" · <font color> */
function colorFromDom(node, root) {
    for (let el = node.parentNode; el && el !== root; el = el.parentNode) {
        if (el.nodeType !== 1) continue;
        const c = normColor(el.style?.color);
        if (c) return c;
        if (el.tagName === 'FONT') { const f = normColor(el.getAttribute?.('color')); if (f) return f; }
    }
    return null;
}
/** class 로 입힌 색 (속마음 틀): 그려진 색을 읽음. 잴 수 없으면 null */
function computedColor(el) {
    if (!el || typeof getComputedStyle !== 'function') return null;
    try { return normColor(getComputedStyle(el).color); } catch { return null; }
}
function colorFromBareHex(flat, start) {
    const m = HEX_BEFORE.exec(flat.slice(Math.max(0, start - 12), start));
    return m ? `#${m[1].toLowerCase()}` : null;
}
/** 줄 앞 이름: "이름: 「" · 이름「 (아는 이름일 때만) */
function prefixHint(flat, d, known) {
    const ls = flat.lastIndexOf('\n', d.start - 1) + 1;
    const prefix = flat.slice(ls, d.start).replace(/[*_~`]/g, '');
    let m = PREFIX_COLON.exec(prefix);
    if (m) return m[1];
    if ((d.opener === '「' || d.opener === '『') && (m = PREFIX_BARE.exec(prefix)) && known.has(fold(m[1]).replace(/\s+/g, ''))) return m[1];
    return null;
}

// ---------- 누른 글자 확인 (caretPositionFromPoint 는 빈 곳을 눌러도 가장 가까운 자리를 준다)
const HIT_PAD = 2;   // px: 글자 상자 둘레 여유
/** 이어 붙인 글의 i 번째 글자가 화면에서 (x, y) 를 덮나. 글자 상자를 못 재면 undefined */
function charCovers(nodes, i, x, y) {
    const rec = nodes.find(r => i >= r.start && i < r.start + String(r.node.nodeValue || '').length);
    if (!rec) return false;                                  // 문단 경계로 넣은 줄바꿈 (화면 글자 아님)
    let rects;
    try {
        const range = document.createRange();
        range.setStart(rec.node, i - rec.start);
        range.setEnd(rec.node, i - rec.start + 1);
        rects = range.getClientRects();
    } catch { return undefined; }
    if (!rects || typeof rects.length !== 'number') return undefined;
    for (let k = 0; k < rects.length; k++) {
        const r = rects[k];
        if (x >= r.left - HIT_PAD && x <= r.right + HIT_PAD && y >= r.top - HIT_PAD && y <= r.bottom + HIT_PAD) return true;
    }
    return false;
}
/** 누른 글자 번호 (자리 앞뒤 글자 중 (x, y) 를 덮는 것) · null = 글자 밖(빈 곳) · undefined = 잴 수 없음 */
function clickedChar(nodes, pos, x, y) {
    if (typeof document.createRange !== 'function') return undefined;
    let unknown = false;
    for (const i of [pos, pos - 1]) {
        if (i < 0) continue;
        const hit = charCovers(nodes, i, x, y);
        if (hit === true) return i;
        if (hit === undefined) unknown = true;
    }
    return unknown ? undefined : null;
}

/**
 * 누른 자리: 글자 노드(at) · 이어 붙인 글(nodes, flat) · 자리(pos) · 누른 글자 번호(c: undefined = 잴 수 없음).
 * 글자가 아닌 빈 곳 · root 밖 · 코드·숨긴 요소 안이면 null
 */
function tapAt(root, x, y) {
    if (!root) return null;
    const caret = caretAt(x, y);
    if (!caret) return null;
    const at = toTextNode(caret.node, caret.offset);
    if (!at || !inside(at.node, root)) return null;
    const { nodes, flat } = textIndex(root);
    const rec = nodes.find(r => r.node === at.node);
    if (!rec) return null;                                   // 코드·숨긴 요소 안의 글
    const pos = rec.start + Math.min(at.offset, String(at.node.nodeValue || '').length);
    const c = clickedChar(nodes, pos, x, y);
    if (c === null) return null;                             // 글자가 아닌 빈 곳
    return { at, nodes, flat, pos, c };
}
const lineOf = (flat, end) => { let line = 0; for (let i = flat.indexOf('\n'); i >= 0 && i < end; i = flat.indexOf('\n', i + 1)) line++; return line; };
/** el 안의 글 (이어 붙인 글에서 el 안 글자 노드의 처음~끝) → { start, raw } | null */
function spanOf(el, nodes, flat) {
    let a = -1, b = -1;
    for (const r of nodes) {
        if (!inside(r.node, el)) continue;
        if (a < 0) a = r.start;
        b = r.start + String(r.node.nodeValue || '').length;
    }
    return a < 0 ? null : { start: a, raw: flat.slice(a, b) };
}

/**
 * 화면의 (x, y) 를 누른 자리가 든 속마음 틀 (머리 주석의 강한 틀 · 약한 틀). root = 그 메시지의 .mes_text
 * 틀 안의 글자를 실제로 눌렀을 때만. 약한 틀은 segmentForHit 이 속마음 조각과 맞춰 봐야 받아들여진다
 */
export function findClickedThought(root, x, y) {
    const tap = tapAt(root, x, y);
    if (!tap) return null;
    const { at, nodes, flat } = tap;
    let strong = null, name = null, inline = null, block = null;
    for (let el = at.node.parentNode; el && el !== root; el = el.parentNode) {
        if (el.nodeType !== 1) continue;
        if (el.tagName === 'SPAN') {
            const own = strongName(el);
            if (own) { strong = el; name = own; break; }
        }
        if (!inline && WEAK_INLINE.has(el.tagName)) inline = el;
        if (!block && BLOCK_TAGS.has(el.tagName)) block = el;
    }
    const box = strong || inline || block;
    if (!box) return null;
    const got = spanOf(box, nodes, flat);
    if (!got) return null;
    const raw = got.raw.trim();
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!LETTER.test(text)) return null;
    let match = 'any', color = null;
    if (strong) color = computedColor(strong.querySelector?.('em') || strong);
    else {
        color = colorFromDom(at.node, root);
        if (!inline) match = 'part';                          // 문단 틀: 서술 문단이 짧은 속마음을 품었다고 그 속마음을 읽지 않게
        else {
            // 기울임이 제 문단을 다 채우면 틀 전체 (속마음 문단 · 라벨), 문단 일부면 글이 똑같을 때만
            let par = null;
            for (let el = inline.parentNode; el && el !== root; el = el.parentNode) if (el.nodeType === 1 && BLOCK_TAGS.has(el.tagName)) { par = el; break; }
            const whole = spanOf(par || root, nodes, flat);
            if (!whole || fold(whole.raw) !== fold(raw)) match = 'equal';
        }
    }
    // 1.2.4: 강한 틀의 순번 · 개수 (글로 못 맞출 때 원문 속마음과 순번으로 짝) · 전체 줄 수 (자리 비교)
    let ordinal = -1, frames = 0;
    if (strong && typeof root.querySelectorAll === 'function') {
        try { const all = [...root.querySelectorAll('span')].filter(el => strongName(el)); frames = all.length; ordinal = all.indexOf(strong); } catch { /* 가짜 DOM */ }
    }
    return { kind: 'thought', strong: !!strong, match, text, raw, nameHint: name, color, line: lineOf(flat, got.start + (got.raw.length - got.raw.trimStart().length)), lines: lineOf(flat, flat.length), ordinal, frames };
}

/**
 * 화면의 (x, y) 를 누른 자리가 든 대화문. root = 그 메시지의 .mes_text
 * 여닫이 짝 안의 글자를 눌렀을 때만 (여닫이 글자 포함). 줄 끝 오른쪽·아래 빈 곳은 가장 가까운 자리로 잡혀도 null
 * opts.knownNames: 이름「…」 꼴의 이름 힌트를 받아들일 이름들
 */
export function findClickedDialogue(root, x, y, opts = {}) {
    const tap = tapAt(root, x, y);
    if (!tap) return null;
    const { at, flat, pos, c } = tap;
    const quotes = scanDialogue(flat);
    // 글자를 쟀으면 그 글자가 짝 안(여닫이 포함)인지, 못 쟀으면 자리가 여닫이 글자 사이 안쪽인지
    const d = c === undefined ? quotes.find(q => pos > q.start && pos < q.end) : quotes.find(q => c >= q.start && c < q.end);
    if (!d) return null;
    const raw = flat.slice(d.is, d.ie).trim();
    const text = raw.replace(/\s+/g, ' ').trim();
    if (!LETTER.test(text)) return null;
    const known = new Set((opts.knownNames || []).map(n => fold(n).replace(/\s+/g, '')));
    const quoted = flat.slice(d.start, d.end).replace(/\s+/g, ' ').trim();
    // 1.4.0 같은 글의 대사가 여럿이면(두 사람이 따로 「다릅니다.」) 이게 몇 번째 · 모두 몇 개인지 — segmentForHit 은 색 · 이름을 먼저 보고,
    //       번째는 조각 쪽 개수와 같을 때만 믿는다 (속마음 · 상태창이 같은 대사를 따라 적으면 화면 쪽 개수가 더 많다)
    const want = fold(text);
    const same = quotes.filter(q => fold(flat.slice(q.is, q.ie)) === want);
    return { text, raw, quoted, color: colorFromDom(at.node, root) || colorFromBareHex(flat, d.start), speakerHint: prefixHint(flat, d, known), line: lineOf(flat, d.start), start: d.start, end: d.end, sameIndex: same.indexOf(d), sameCount: same.length };
}

// ---------- 누른 대화문 → 조각 (text.js 결과에서 찾고, 없으면 즉석)
function knownNames(ctx, s) {
    const set = new Set();
    for (const n of Object.keys(s.char_map || {})) set.add(n);
    for (const v of s.voices || []) { set.add(v.name); for (const a of v.aliases || []) set.add(a); }
    if (ctx.name1) set.add(ctx.name1);
    if (ctx.name2) set.add(ctx.name2);
    if (ctx.groupId && Array.isArray(ctx.groups)) {
        const g = ctx.groups.find(x => x.id == ctx.groupId);
        for (const av of (g && g.members) || []) { const c = (ctx.characters || []).find(x => x.avatar === av); if (c && c.name) set.add(c.name); }
    }
    try { for (const n of learnedNames() || []) set.add(n); } catch { /* 채팅 메타가 없으면 넘어감 */ }
    return [...set].filter(Boolean);
}
/** 조각 나누기 설정. readThoughts: 속마음 길이 '건너뛰기'여도 속마음 글을 조각으로 냄 (누른 자리 찾기 전용 — 자동 읽기는 index.js 의 설정 그대로) */
function segOpts(mes, s, ctx, { readThoughts = false } = {}) {
    const routes = s.routes || {};
    return {
        skipTags: new Set(String(s.skip_tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean)),
        skipCode: !!s.skip_codeblocks, stripRegex: parseRegexLines(s.strip_regex),
        userName: ctx.name1 || '', charName: (mes && !mes.is_user && mes.name) || ctx.name2 || '',
        knownNames: knownNames(ctx, s), final: true,
        routes: readThoughts && (!routes.thought || routes.thought === 'skip') ? { ...routes, thought: 'character' } : routes,
    };
}
function safeSegment(text, opts) {
    try { return segmentMessage(text, opts) || []; } catch (e) { log('err', `세그먼트 실패: ${String(e?.message || e).slice(0, 40)}`); return []; }
}
const dialogueIndexOf = (list, seg) => list.filter(x => x.kind === 'dialogue').indexOf(seg);
const thoughtsOf = (list) => (list || []).filter(x => x.kind === 'thought' && x.text);
/** 같은 조건에 맞는 것이 여럿이면 누른 줄에 가장 가까운 것 */
function nearest(list, line) {
    let best = null;
    for (const x of list) if (!best || Math.abs((x.line || 0) - line) < Math.abs((best.line || 0) - line)) best = x;
    return best;
}
const nameKey = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, '');
function canonName(n) { try { return canon(n) || n; } catch { return n; } }
/** 두 이름이 같은 사람인가 (별명표를 거쳐) */
const sameOwner = (a, b) => !!nameKey(a) && (nameKey(a) === nameKey(b) || nameKey(canonName(a)) === nameKey(canonName(b)));
/** 이름에 정해 둔 목소리가 있나 (연결표 · 목소리 이름·다른 이름, 별명표를 거쳐) — 없으면 틀의 색이 더 믿을 만하다 */
function voiced(name) {
    const s = settings();
    const map = s.char_map || {};
    return [name, canonName(name)].some(n => {
        const k = nameKey(n);
        if (!k) return false;
        const key = Object.keys(map).find(x => nameKey(x) === k);
        return !!((key && findVoice(map[key])) || voiceByName(n));
    });
}
/** 속마음 조각의 문단들 (빈 줄로 나눈 문단 + 줄) — 약한 틀은 이 가운데 하나와 같아야 */
function parasOf(seg) {
    const raw = String(seg.raw || seg.text || '');
    return [...raw.split(/\n[ \t]*\n/), ...raw.split('\n')].map(fold).filter(Boolean);
}
const unquote = (s) => { const t = String(s || '').trim(); const c = CLOSER[t[0]]; return c && t.length > 2 && t.endsWith(c) ? t.slice(1, -1) : t; };
/** 약한 틀의 글이 속마음이 아닌 조각(대화문 · 서술 · 행동)과 같나 — 그러면 그 조각을 누른 것 (속마음이 대사를 따라 적은 경우) */
function sameAsOther(list, hit) {
    const a = fold(hit.text), b = fold(unquote(hit.text));
    return (list || []).some(x => x.kind !== 'thought' && x.text && (fold(x.text) === a || fold(x.text) === b));
}
/**
 * 속마음 틀(hit)에 맞는 속마음 조각: 글이 같음 (라벨 뗀 글 포함) → 강한 틀이면 속마음이 누른 글을 품음 (4글자 이상, 여러 문단 속마음의 첫 문단),
 * 약한 틀이면 속마음의 한 문단과 같음 ('equal' 은 첫째만). 같은 조건에 여럿이면 class 이름과 주인이 같은 것 → 누른 줄에 가까운 것
 */
function matchThought(list, hit) {
    const ths = thoughtsOf(list);
    if (!ths.length) return null;
    const want = fold(hit.text), bare = fold(String(hit.text || '').replace(LABEL_HEAD, ''));
    const tiers = [(t) => t === want || (!!bare && t === bare)];
    if (hit.strong) tiers.push((t) => letters(want) >= MIN_PART && t.includes(want));
    else if (hit.match !== 'equal') tiers.push((t, x) => parasOf(x).includes(want));
    for (const ok of tiers) {
        const found = ths.filter(x => ok(fold(x.text), x));
        if (!found.length) continue;
        const mine = hit.nameHint ? found.filter(x => sameOwner(x.speakerHint, hit.nameHint)) : [];
        return nearest(mine.length ? mine : found, hit.line || 0);
    }
    return null;
}
/**
 * 1.2.4: 강한 틀의 글이 어느 속마음 조각과도 안 맞을 때 (화면 글이 조각과 달라짐) 원문 속마음을 고른다:
 * 틀 수 = 원문 속마음 수면 같은 순번 → 아니면 같은 주인 가운데 자리(줄 ÷ 전체 줄)가 가장 가까운 것. 없으면 null (화면 글)
 */
function origByFrame(orig, hit) {
    const o = thoughtsOf(orig);
    if (!o.length) return null;
    if (Number.isInteger(hit.ordinal) && hit.ordinal >= 0 && hit.frames === o.length) {
        const x = o[hit.ordinal];
        if (!hit.nameHint || !x.speakerHint || sameOwner(x.speakerHint, hit.nameHint)) return x;
    }
    const mine = hit.nameHint ? o.filter(x => sameOwner(x.speakerHint, hit.nameHint)) : [];
    if (!mine.length) return null;
    const span = Math.max(1, ...o.map(x => x.line || 0));
    const at = (hit.line || 0) / Math.max(1, hit.lines || 0);
    let best = null, gap = Infinity;
    for (const x of mine) { const g = Math.abs((x.line || 0) / span - at); if (g < gap) { gap = g; best = x; } }
    return best;
}
/** 이름이 있고 그 이름에 목소리가 있으면 색은 버린다 (화자 찾기에서 색이 이름보다 앞서서). 모르는 이름이면 색을 남겨 색 → 이름 차례로 */
const colorFor = (hint, color) => (hint && voiced(hint) ? null : color || null);
/**
 * 찾은 속마음 조각 → 읽을 조각. 이름: 원문 속마음의 character= (번역문이면 갈래 순번으로 짝인 원문 것 먼저 — 화면 "캐릭터", 원문 "Character")
 * → 번역문 것 → 틀의 class 이름
 */
function thoughtSegment(found, list, orig, disp, hit) {
    const index = thoughtsOf(list).indexOf(found);
    let hint = null;
    if (list === disp) {
        const o = thoughtsOf(orig);
        if (o.length === thoughtsOf(disp).length && o[index]) hint = o[index].speakerHint || null;
    }
    hint = hint || found.speakerHint || hit.nameHint || null;
    return { ...found, tags: (found.tags || []).slice(), speakerHint: hint, color: colorFor(hint, found.color || hit.color), dialogueIndex: -1, thoughtIndex: index };
}

/**
 * 누른 자리(hit)에 맞는 조각. 번역문 조각(원문과 짝 맞춤) → 원문 조각 → 즉석 조각.
 * 속마음 틀(hit.kind 'thought'): 속마음 조각 → 강한 틀이면 즉석 속마음 조각, 약한 틀이면 null
 *   (약한 틀의 글이 대화문·서술·행동 조각과 같으면 먼저 null — onClick 이 대화문으로 넘어감).
 * 대화문: 조각이 없고 그 대화문(여닫이 포함)을 품은 속마음 조각이 있으면 그 속마음
 */
export function segmentForHit(mes, hit) {
    const s = settings();
    const ctx = getContext() || {};
    const opts = segOpts(mes, s, ctx, { readThoughts: true });
    const orig = safeSegment(sub(mes.mes), opts);
    let disp = null;
    const d = mes.extra?.display_text;
    if (typeof d === 'string' && d.trim() && d !== mes.mes) { try { disp = pairSegments(orig, safeSegment(sub(speechDisplay(d)), opts)); } catch { disp = null; } }
    let seg = null, index = -1;
    if (hit.kind === 'thought') {
        if (!hit.strong && (sameAsOther(disp, hit) || sameAsOther(orig, hit))) return null;
        const fromDisp = matchThought(disp, hit);
        const found = fromDisp || matchThought(orig, hit) || (hit.strong ? origByFrame(orig, hit) : null);
        if (found) seg = thoughtSegment(found, fromDisp ? disp : orig, orig, disp, hit);
        else if (hit.strong) seg = { kind: 'thought', text: hit.text, raw: hit.raw, color: colorFor(hit.nameHint, hit.color), tags: [], speakerHint: hit.nameHint || null, line: hit.line || 0, dialogueIndex: -1, thoughtIndex: -1 };
        else return null;
    } else {
        const want = fold(hit.text);
        const find = (list) => {
            const all = (list || []).filter(x => x.kind === 'dialogue' && x.text && fold(x.text) === want);
            if (all.length < 2) return all[0] || null;
            // 1.4.0 같은 대사가 여럿 (사용자 제보: 두 사람이 「다릅니다.」 — 아래를 눌러도 위 캐릭터로 읽음): 누른 줄의 색 → 이름 → 번째(양쪽 개수가 같을 때만) → 가까운 줄
            const hc = normColor(hit.color);
            if (hc) { const byColor = all.filter(x => normColor(x.color) === hc); if (byColor.length === 1) return byColor[0]; }
            const hk = nameKey(hit.speakerHint);
            if (hk) { const byName = all.filter(x => nameKey(x.speakerHint) === hk); if (byName.length === 1) return byName[0]; }
            if (Number.isInteger(hit.sameIndex) && hit.sameIndex >= 0 && hit.sameIndex < all.length && hit.sameCount === all.length) return all[hit.sameIndex];
            return nearest(all, hit.line || 0);
        };
        const fromDisp = find(disp);
        if (fromDisp) { seg = fromDisp; index = dialogueIndexOf(disp, fromDisp); }
        else { const fromOrig = find(orig); if (fromOrig) { seg = fromOrig; index = dialogueIndexOf(orig, fromOrig); } }
        if (seg) seg = { ...seg, tags: (seg.tags || []).slice(), color: seg.color || hit.color || null, speakerHint: seg.speakerHint || hit.speakerHint || null };
        else {
            // 속마음 안의 「」 (약한 틀이 못 맞춘 경우): text.js 처럼 대화문이 아니라 그 속마음
            const q = fold(hit.quoted || hit.text);
            const inThought = (list) => { const f = thoughtsOf(list).filter(x => fold(x.text).includes(q)); return f.length ? nearest(f, hit.line || 0) : null; };
            const tDisp = q ? inThought(disp) : null;
            const tFound = tDisp || (q ? inThought(orig) : null);
            if (tFound) seg = thoughtSegment(tFound, tDisp ? disp : orig, orig, disp, { nameHint: null, color: null });   // 대화문의 색은 그 대사 화자의 것이라 쓰지 않음
            else seg = { kind: 'dialogue', text: hit.text, raw: hit.raw, color: hit.color || null, tags: [], speakerHint: hit.speakerHint || null, line: hit.line || 0 };
        }
        if (seg.kind === 'dialogue') seg.dialogueIndex = index;
    }
    // 색으로 알아낸 화자를 조각에 적어 둔다 (재생기·분석이 같은 이름을 쓰도록)
    if (!seg.speakerHint && seg.color && !mes.is_user) {
        try {
            const who = resolveSpeaker(seg, { mes, charName: opts.charName, userName: opts.userName });
            if (who?.name && who.source !== 'sender') seg.speakerHint = who.name;
        } catch { /* 화자 표가 없으면 그대로 */ }
    }
    return seg;
}

/**
 * 1.2.2 미리 만들기: 화면에 보이는 목록(번역문이 있으면 번역문, 없으면 원문)의 대화문마다, 그 줄을 눌렀을 때 segmentForHit 이 낼 조각
 * (thoughts 면 속마음도 강한 틀을 누른 것처럼 — 대화문 뒤에). 재생기의 lineJobs 가 이것으로 탭과 같은 캐시 키를 만든다
 */
export function tapSegments(mes, { thoughts = false } = {}) {
    if (!mes || mes.is_system) return [];
    const s = settings();
    const ctx = getContext() || {};
    const opts = segOpts(mes, s, ctx, { readThoughts: true });
    const orig = safeSegment(sub(mes.mes), opts);
    let disp = null;
    const d = mes.extra?.display_text;
    if (typeof d === 'string' && d.trim() && d !== mes.mes) { try { disp = pairSegments(orig, safeSegment(sub(speechDisplay(d)), opts)); } catch { disp = null; } }
    const shown = disp || orig;
    const out = [], later = [];
    const seen = new Map();   // 1.4.0 같은 글 대사의 번째 · 개수 (탭의 sameIndex · sameCount 와 같게)
    const count = new Map();
    for (const x of shown) if (x && x.kind === 'dialogue' && x.text) { const k = fold(x.text); count.set(k, (count.get(k) || 0) + 1); }
    for (const x of shown) {
        if (!x || !x.text) continue;
        let seg = null;
        try {
            if (x.kind === 'dialogue') {
                const k = fold(x.text), n = seen.get(k) || 0;
                seen.set(k, n + 1);
                seg = segmentForHit(mes, { kind: 'dialogue', text: x.text, raw: x.raw, quoted: x.text, color: x.color || null, speakerHint: x.speakerHint || null, line: x.line || 0, sameIndex: n, sameCount: count.get(k) || 0 });
            }
            else if (thoughts && x.kind === 'thought') seg = segmentForHit(mes, { kind: 'thought', strong: true, match: 'any', text: x.text, raw: x.raw, nameHint: x.speakerHint || null, color: x.color || null, line: x.line || 0 });
        } catch (e) { log('err', `미리 만들기 조각 실패: ${String(e?.message || e).slice(0, 40)}`); seg = null; }
        if (!seg) continue;
        (seg.kind === 'thought' ? later : out).push(seg);
    }
    return [...out, ...later];
}

// ---------- 클릭
function onClick(e) {
    try {
        if (e.defaultPrevented || e.button !== 0 || e.detail !== 1 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const s = settings();
        if (!s.enabled || s.click_play === false) return;
        const t = e.target;
        if (!t || t.nodeType !== 1 || typeof t.closest !== 'function') return;
        const mesText = t.closest('.mes_text');
        if (!mesText) return;
        const mesEl = mesText.closest('.mes');
        if (!mesEl || !mesEl.closest('#chat')) return;
        if (mesEl.hasAttribute('is_editing') || mesEl.querySelector('.edit_textarea')) return;   // 편집 중
        if (t.closest(INTERACTIVE)) return;
        const sel = typeof getSelection === 'function' ? getSelection() : null;
        if (sel && sel.isCollapsed === false) return;                                            // 글을 고르는 중
        const mesId = Number(mesEl.getAttribute('mesid'));
        const mes = Number.isInteger(mesId) && mesId >= 0 ? chat[mesId] : null;
        if (!mes || mes.is_system) return;
        // 속마음 먼저 (속마음 안의 「」 를 눌러도 속마음 통째로), 아니면 대화문
        const thought = findClickedThought(mesText, e.clientX, e.clientY);
        let seg = thought ? segmentForHit(mes, thought) : null;
        if (!seg) {
            const ctx = getContext() || {};
            const hit = findClickedDialogue(mesText, e.clientX, e.clientY, { knownNames: knownNames(ctx, s) });
            if (!hit) return;
            seg = segmentForHit(mes, hit);
        }
        if (seg) speakSegments(mesId, [seg]);
    } catch (err) {
        log('err', `대사 클릭 실패: ${String(err?.message || err).slice(0, 40)}`);
    }
}

let bound = null;
export function init() {
    if (bound) return;
    bound = document.getElementById('chat') || document;
    bound.addEventListener('click', onClick, false);
}
export function destroy() {
    if (!bound) return;
    bound.removeEventListener('click', onClick, false);
    bound = null;
}
