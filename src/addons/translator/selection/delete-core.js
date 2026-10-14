// 6.4.5 고른 글 지우기 — 순수 함수 (DOM · 실리태번 없음, tools/tests/selection-delete.mjs 가 검사한다).
// 화면에서 고른 글(그려진 글자)을 원래 글(마크다운 · 태그가 든 mes · 번역문)의 자리로 옮기고, 지운 뒤 둘레를 다듬는다.
// 원칙: 확실하지 않으면 지우지 않는다 (null — 부르는 쪽이 그 선택지를 끈다). 고쳐 붙이는 복구보다 거절이 낫다.
//  · 보이는 글: 짝 맞는 강조 표시(* ** *** _ __ ~~)와 태그(<…>) · 코드 울타리 · 인라인 코드 따옴표 · 줄 머리 표시(# · > · - · 1.) · 구분선 줄은
//    건너뛰고, 공백은 하나로 — 화면 글자와 같은 차례가 된다. 짝은 빈 줄(문단 경계)을 넘지 않고, 코드 안 · 낱말 속 _ · 구분선 줄은 짝이 아니다
//  · 같은 쪽(고른 글이 그 글의 화면): 화면에서 몇 번째인지 + 앞뒤 보이는 글이 화면과 같을 때만 (앞 글은 줄 처음에서 끊어 견줄 수도 있다 —
//    표시 정규식이 바꾼 윗줄(상태 카드 같은) 바로 뒤 문단 · 문장도 지울 수 있게. 뒤 글은 그대로 견준다)
//  · 다른 쪽(번역문에서 골라 원문을 지울 때 · 그 반대): 고른 글이 줄마다 몇 번 나오는지(빈 줄 뺀 줄의 개수 목록)가 두 글에서 같고,
//    고른 줄에 하나뿐일 때만 그 줄의 것으로 (줄을 나누고 합쳐 줄 수만 우연히 같거나 줄 안 어순이 바뀐 번역을 짝짓지 않게)
//  · 지우기: 지울 범위 안에 태그(<br> 말고)가 있으면 · 줄을 넘는 강조 짝이 깨지면 · 지운 뒤 줄의 마크다운 꼴이 바뀌면(제목 · 목록 · 인용 · 코드 ·
//    가로줄 · 링크가 새로 생기거나 사라짐 — 「#태그」가 제목이 되는 것 같은) · 이어진 줄이 있는 목록 첫 줄을 다 비우면 하지 않는다.
//    비게 된 강조 · 괄호 · 따옴표 · 꾸밈 태그 짝(span · b · em … 과 HTML 에 없는 사용자 태그 — td · summary 같은 구조 태그는 남김) ·
//    인라인 코드 따옴표와 겹친 공백 · 줄 머리 · 끝의 <br> · 빈 줄(공백 · 짝 없는 표시 · 줄 머리 표시만 남은 줄 — 태그가 남은 줄은 그대로) ·
//    글 앞뒤에 새로 생긴 빈 줄을 치운다. 줄을 지우는 것은 그 줄에 원래 화면에 보이던 글자가 남지 않았을 때뿐이다 (「Score: 100.」의 100. 은 남긴다)
//    양옆 표시 글자가 이어져 새 표시가 되면(「~♡~」 → 「~~」) · 「--」만 남아 윗줄이 제목이 되면 · 줄을 지워 들여 쓴 다음 줄이 코드가 되면 ·
//    줄이 블록 HTML 로 시작하게 되면 하지 않는다
//  · 끝 검사(formatKept): 실리태번 그리기로 지우기 전 · 뒤를 그린 HTML 을 견준다 — 보이는 글은 고른 글(+ 비게 된 괄호 · 따옴표 · 공백)만 빠지고,
//    블록 차례(p · 제목 · 목록 · pre · 인용 · 표 · div …)는 빈 블록이 빠진 것 말고 같고, 꾸밈(em · strong · del · code · a …)은 고른 글 안에 있던 것만 빠지고,
//    그림 · 가로줄은 그대로여야 한다. 하나라도 어긋나면 그 쪽을 끈다
const PAIR = /(\*{1,3}|_{1,3}|~~)(?=\S)((?:(?!\n[^\S\n]*\r?\n)[\s\S])*?\S)\1/g;
const TAG = /<\/?[A-Za-z][^<>]*>/g;
const BR = /^<br\s*\/?>$/i;
const BREAK_TAG = /^<\/?(?:br|p|div|li|h[1-6]|blockquote|pre|details|summary|tr|ul|ol|table|hr)(?=[\s/>])[^<>]*>$/i;   // 화면에서 줄이 바뀌는 태그 (delete.js 의 BLOCKS 와 같게)
const FENCE = /^[^\S\n]*```[^\n]*\n[\s\S]*?\n[^\S\n]*```[^\S\n]*$/gm;
const INLINE_CODE = /`[^`\n]+`/g;
const HR_LINE = /^[^\S\n]*([*_-])(?:[^\S\n]*\1){2,}[^\S\n]*\r?$/gm;
// 줄 머리 표시 (화면에 안 그려짐): 「# 」 · 「#태그」(실리태번은 # 뒤 공백 없이도 제목) · 「> 」 · 「- 」 · 「1. 」 — 표시만 홀로 있는 줄(「#」 「>」 「-」)은 글자 그대로 보인다
const LINE_HEAD = /^[^\S\n]{0,3}(?:#{1,6}(?:[^\S\n]+(?=\S)|(?=[^\s#]))|>[^\S\n]?(?=\S)|[-*+][^\S\n]+(?=\S)|\d{1,9}[.)][^\S\n]+(?=\S))/gm;
const SPACE = /[^\S\n]/;
const BRACKETS = { '「': '」', '『': '』', '（': '）', '(': ')', '[': ']', '“': '”', '‘': '’', '《': '》', '〈': '〉' };
const SAME_QUOTES = new Set(['"', "'"]);
const CLOSE_PUNCT = /^[,.!?;:…)\]」』）”’、。，！？〉》]/;
// 비면 함께 지우는 태그: 인라인 꾸밈 태그와 HTML 에 없는 이름(사용자 정의 태그 — 감정 · 속마음 같은 것). 그 밖의 HTML 태그(td · th · li · summary …)는 비어도 남긴다
const INLINE_TAGS = new Set(['span', 'b', 'i', 'em', 'strong', 'font', 'u', 's', 'small', 'mark']);
const HTML_TAGS = new Set(('a abbr address area article aside audio b base bdi bdo big blink blockquote body br button canvas caption center cite code col colgroup '
    + 'data datalist dd del details dfn dialog dir div dl dt em embed fieldset figcaption figure font footer form frame frameset h1 h2 h3 h4 h5 h6 head header '
    + 'hgroup hr html i iframe img input ins kbd label legend li link main map mark marquee menu meta meter nav nobr noscript object ol optgroup option output '
    + 'p param picture pre progress q rp rt ruby s samp script search section select slot small source span strike strong style sub summary sup svg table tbody '
    + 'td template textarea tfoot th thead time title tr track tt u ul var video wbr').split(' '));
const emptiable = name => { const n = name.toLowerCase(); return INLINE_TAGS.has(n) || !HTML_TAGS.has(n); };
const LEAD_BR = /^(?:[^\S\n]*<br\s*\/?>)+[^\S\n]*/i, TAIL_BR = /(?:[^\S\n]*<br\s*\/?>)+[^\S\n]*$/i;
const CONTEXT = 10;   // 같은 쪽 앞뒤 대조 글자 수

export const norm = value => String(value ?? '').replace(/\s+/gu, ' ').trim();

/** 짝 찾기에서 빼는 자리: 코드 울타리 · 인라인 코드 · 구분선 줄 → 같은 길이의 다른 글자로 (자리는 그대로) */
function literalMask(text) {
    const blank = part => part.replace(/[^\n]/g, 'x');
    return text.replace(FENCE, blank).replace(INLINE_CODE, blank).replace(HR_LINE, blank);
}

/** 코드 자리 표 (1 = 울타리 코드 블록 · 인라인 코드 안 — 따옴표 · 울타리 줄 포함) */
function codeMap(raw) {
    const map = new Uint8Array(raw.length);
    for (const match of raw.matchAll(FENCE)) map.fill(1, match.index, match.index + match[0].length);
    for (const match of raw.matchAll(INLINE_CODE)) map.fill(1, match.index, match.index + match[0].length);
    return map;
}

/** 짝 맞는 강조 표시들 [{ mark, open, close, width }] (바깥 짝이 먼저). 낱말 속 _ 짝(snake_case)은 강조가 아니다 */
export function markerPairs(text) {
    text = String(text ?? '');
    const masked = literalMask(text);
    const pairs = [];
    const scan = (part, base) => {
        for (const match of part.matchAll(PAIR)) {
            const start = base + match.index, width = match[1].length, end = start + match[0].length;
            if (match[1][0] === '_' && (/\w/.test(text[start - 1] ?? '') || /\w/.test(text[end] ?? ''))) { scan(match[2], start + width); continue; }
            pairs.push({ mark: match[1], open: start, close: end - width, width });
            scan(match[2], start + width);
        }
    };
    scan(masked, 0);
    return pairs;
}

/** 보이지 않는 글자 표 (1 = 화면에 안 그려짐) */
function hiddenMap(raw) {
    const hidden = new Uint8Array(raw.length);
    for (const pair of markerPairs(raw)) for (let i = 0; i < pair.width; i++) { hidden[pair.open + i] = 1; hidden[pair.close + i] = 1; }
    for (const match of raw.matchAll(TAG)) hidden.fill(1, match.index, match.index + match[0].length);
    for (const match of raw.matchAll(FENCE)) {   // 울타리 줄(``` · 언어 이름)만 — 안 글은 보인다
        const block = match[0], first = block.indexOf('\n'), last = block.lastIndexOf('\n');
        hidden.fill(1, match.index, match.index + first);
        hidden.fill(1, match.index + last + 1, match.index + block.length);
    }
    for (const match of raw.matchAll(INLINE_CODE)) { hidden[match.index] = 1; hidden[match.index + match[0].length - 1] = 1; }
    for (const match of raw.matchAll(HR_LINE)) hidden.fill(1, match.index, match.index + match[0].length);
    for (const match of raw.matchAll(LINE_HEAD)) hidden.fill(1, match.index, match.index + match[0].length);
    for (let i = 0; i < raw.length; i++) if (raw[i] === '\r') hidden[i] = 1;
    return hidden;
}

/** 보이는 글과 원래 글 자리 { text, offsets } — text[k] 는 원래 글 offsets[k] 의 글자 (공백은 하나로) */
export function visibleText(raw) {
    raw = String(raw ?? '');
    const hidden = hiddenMap(raw);
    const breaks = new Set();   // 줄 바꾸는 태그의 첫 글자 — 화면처럼 공백 하나 (<br> 앞뒤 낱말이 붙지 않게)
    for (const match of raw.matchAll(TAG)) if (BREAK_TAG.test(match[0])) breaks.add(match.index);
    let text = '';
    const offsets = [];
    for (let i = 0; i < raw.length; i++) {
        if (hidden[i] && !breaks.has(i)) continue;
        if (breaks.has(i) || /\s/u.test(raw[i])) {
            if (text.endsWith(' ')) continue;
            text += ' ';
        } else text += raw[i];
        offsets.push(i);
    }
    return { text, offsets };
}

/** 공백만 하나로 { text, offsets } (화면 글자에는 표시 · 태그가 없다) */
function collapsed(raw) {
    raw = String(raw ?? '');
    let text = '';
    const offsets = [];
    for (let i = 0; i < raw.length; i++) {
        if (/\s/u.test(raw[i])) {
            if (text.endsWith(' ')) continue;
            text += ' ';
        } else text += raw[i];
        offsets.push(i);
    }
    return { text, offsets };
}

/** 빈 줄을 뺀 줄 번호 (pos 가 든 줄) */
export function lineOf(raw, pos) {
    let line = 0;
    const lines = String(raw ?? '').slice(0, pos).split('\n');
    for (let i = 0; i < lines.length - 1; i++) if (lines[i].trim()) line++;
    return line;
}
/** 빈 줄을 뺀 줄 수 */
export const lineCount = raw => String(raw ?? '').split('\n').filter(line => line.trim()).length;

/** 원래 글에서 고른 글이 보이는 자리들 [{ start, end, line, vis }] (겹치지 않게, 차례대로 — vis 는 보이는 글 자리) */
export function occurrences(raw, selected) {
    const key = norm(selected);
    if (!key) return [];
    const { text, offsets } = visibleText(raw);
    const out = [];
    for (let at = text.indexOf(key); at >= 0; at = text.indexOf(key, at + key.length)) {
        const start = offsets[at], end = offsets[at + key.length - 1] + 1;
        out.push({ start, end, line: lineOf(raw, start), vis: at });
    }
    return out;
}

/** 화면 글에서 고른 글의 자리 { ordinal, total, pos } — at = 고른 글이 시작하는 화면 글 자리 */
export function screenOrdinal(screen, at, selected) {
    const key = norm(selected);
    const { text, offsets } = collapsed(screen);
    let pos = offsets.findIndex(offset => offset >= at);
    if (pos < 0 || !key) return null;
    if (text[pos] === ' ') pos++;
    const starts = [];
    for (let i = text.indexOf(key); i >= 0; i = text.indexOf(key, i + key.length)) starts.push(i);
    const ordinal = starts.indexOf(pos);
    return ordinal < 0 ? null : { ordinal, total: starts.length, pos };
}

/**
 * 같은 쪽: 화면에서 고른 자리와 원래 글 자리의 앞뒤 보이는 글(CONTEXT 글자, 글 처음 · 끝에서는 거기까지)이 같은가.
 * 앞 글이 다르면 두 쪽 다 줄 처음에서 끊은 앞 글로 한 번 더 견준다 — 표시 정규식이 윗줄(상태 카드 같은)을 다른 글로 그려도
 * 그 바로 뒤 문단 · 문장을 지울 수 있게. 뒤 글은 늘 그대로 견준다 (화면에서 줄이 바뀌는 자리 = 블록 · <br>, 원래 글은 줄바꿈)
 */
export function sameContext(screen, screenPos, raw, span, selected) {
    const key = norm(selected);
    const shown = collapsed(screen), seen = visibleText(raw), a = shown.text, b = seen.text;
    const k = occurrences(raw, key).find(item => item.start === span.start)?.vis;
    if (!Number.isInteger(k)) return false;
    const before = (text, at, from = 0) => text.slice(Math.max(from, at - CONTEXT), at).replace(/^ /, '');
    const after = (text, at) => text.slice(at, at + CONTEXT).replace(/ $/, '');
    if (after(a, screenPos + key.length) !== after(b, k + key.length)) return false;
    if (before(a, screenPos) === before(b, k)) return true;
    const lineStart = (source, offsets, at) => { const from = source.lastIndexOf('\n', Math.max(0, offsets[at] - 1)) + 1; const i = offsets.findIndex(offset => offset >= from); return i < 0 ? at : Math.min(i, at); };
    return before(a, screenPos, lineStart(String(screen ?? ''), shown.offsets, screenPos)) === before(b, k, lineStart(String(raw ?? ''), seen.offsets, k));
}

/**
 * 같은 쪽 자리: { start, end, line } 또는 null
 *  same = { ordinal, total, pos } (screenOrdinal) · screen = 그 쪽 화면 글 — 개수가 같고 앞뒤 보이는 글이 같을 때만
 */
export function pickSame(raw, selected, same, screen) {
    if (!same) return null;
    const found = occurrences(raw, selected);
    if (found.length !== same.total) return null;
    const span = found[same.ordinal];
    return span && sameContext(screen, same.pos, raw, span, selected) ? span : null;
}

/** 고른 글이 줄마다(빈 줄 뺀) 몇 번 나오는지 — [0, 1, 1] */
export function lineSignature(raw, selected) {
    const counts = new Array(lineCount(raw)).fill(0);
    for (const item of occurrences(raw, selected)) counts[item.line]++;
    return counts;
}

/** 다른 쪽 자리: 두 글의 줄마다 개수 목록이 같고, 고른 줄에 하나뿐일 때 그 줄의 것 — 아니면 null */
export function pickCross(otherRaw, selected, fromRaw, fromSpan) {
    if (!fromSpan) return null;
    const mine = lineSignature(fromRaw, selected), theirs = lineSignature(otherRaw, selected);
    if (mine.length !== theirs.length || mine.some((n, i) => n !== theirs[i]) || mine[fromSpan.line] !== 1) return null;
    if (!occurrences(fromRaw, selected).some(item => item.start === fromSpan.start)) return null;
    return occurrences(otherRaw, selected).find(item => item.line === fromSpan.line) ?? null;
}

/** pos 가 든 줄 [from, to) — \r 은 줄 끝에 둔다 */
function lineRange(text, pos) {
    const from = pos > 0 ? text.lastIndexOf('\n', pos - 1) + 1 : 0;   // lastIndexOf(…, -1) 은 0 번 자리를 본다
    const nl = text.indexOf('\n', pos);
    return { from, to: nl < 0 ? text.length : nl };
}

/**
 * 원래 글에서 [span.start, span.end) 를 지우고 둘레를 다듬는다 → { text, cut } 또는 null (확실하지 않아 지우지 않음)
 */
export function deleteSpan(raw, span) {
    raw = String(raw ?? '');
    let a = span.start, b = span.end;
    if (!(a >= 0 && b > a && b <= raw.length)) return null;
    // 코드(울타리 · 인라인) 안은 글자 그대로 — 고른 글만 빼고 다듬지 않는다. 코드 경계를 넘는 고르기는 하지 않는다
    const code = codeMap(raw);
    const inCode = code.slice(a, b).reduce((n, v) => n + v, 0);
    if (inCode === b - a) {
        // 인라인 코드 내용을 통째로 지우면 따옴표 짝도 함께 지우고 둘레를 다듬는다 (「``」 글자를 남기지 않게)
        const whole = [...raw.matchAll(INLINE_CODE)].find(match => match.index + 1 === a && match.index + match[0].length - 1 === b);
        if (!whole) return { text: raw.slice(0, a) + raw.slice(b), cut: a };
        a = whole.index; b = whole.index + whole[0].length;
    } else if (inCode) return null;
    // 범위 안의 태그: <br> 말고는 지우지 않는다 (여는 태그 · 닫는 태그 하나만 지워 뒤 글 전체에 서식이 번지지 않게)
    for (const match of raw.slice(a, b).matchAll(TAG)) if (!BR.test(match[0])) return null;
    const pairs = markerPairs(raw);
    // 지운 글을 꼭 감싸던 강조(*Now,*)는 함께 지운다 (겹겹이면 바깥까지)
    for (let changed = true; changed;) {
        changed = false;
        for (const pair of pairs) if (pair.open + pair.width === a && pair.close === b) { a = pair.open; b = pair.close + pair.width; changed = true; }
    }
    const inside = pos => pos >= a && pos < b;
    // 지운 글 안에서 닫힌 강조: 여는 표시가 자리 바로 앞이면 그 표시도 지우고(빈 강조를 남기지 않게), 아니면 자리에서 닫는다 (안쪽 먼저)
    // 지운 글 안에서 열린 강조: 닫는 표시가 자리 바로 뒤면 그 표시도 지우고, 아니면 자리 뒤에서 다시 연다 (바깥 먼저)
    let closings = '', openings = '';
    for (const pair of pairs.filter(pair => inside(pair.close) && pair.open + pair.width <= a).sort((x, y) => y.open - x.open)) {
        if (pair.open + pair.width === a) a = pair.open; else closings += pair.mark;
    }
    for (const pair of pairs.filter(pair => inside(pair.open) && pair.close >= b).sort((x, y) => x.open - y.open)) {
        if (pair.close === b) b = pair.close + pair.width; else openings = pair.mark + openings;
    }
    const opensAtCut = pairs.some(pair => pair.open + pair.width === a && pair.close >= b);
    const closesAtCut = pairs.some(pair => pair.close === b && pair.open + pair.width <= a);
    let left = raw.slice(0, a), right = raw.slice(b);
    // 지우는 원래 글 자리 [lo, hi) — 다듬기로 함께 지운 괄호 · 따옴표 · 태그 · 표시까지 (줄을 지울지 볼 때: 그 밖에 원래 보이던 글자가 남았나)
    let lo = a, hi = b;
    const inserted = !!(closings || openings);
    if (closings) { const space = /[^\S\n]*$/.exec(left)[0]; left = left.slice(0, left.length - space.length) + closings + space; }
    if (openings) { const space = /^[^\S\n]*/.exec(right)[0]; right = space + openings + right.slice(space.length); }
    // 비게 된 괄호 짝 「」 () · 따옴표 짝 ("" '' 는 여는 따옴표일 때만 — 앞 인용의 닫는 따옴표와 다음 인용의 여는 따옴표를 합치지 않게) · 빈 태그 짝 · 빈 강조
    for (let changed = true; changed;) {
        changed = false;
        const lastChar = left.at(-1), firstChar = right[0];
        if (lastChar && BRACKETS[lastChar] && BRACKETS[lastChar] === firstChar) { left = left.slice(0, -1); right = right.slice(1); lo--; hi++; changed = true; continue; }
        if (lastChar && SAME_QUOTES.has(lastChar) && firstChar === lastChar && quoteOpens(left)) { left = left.slice(0, -1); right = right.slice(1); lo--; hi++; changed = true; continue; }
        const openTag = /<([A-Za-z][\w-]*)(?:\s[^<>]*)?>$/.exec(left);
        if (openTag && emptiable(openTag[1]) && right.startsWith(`</${openTag[1]}>`)) { lo -= left.length - openTag.index; hi += openTag[1].length + 3; left = left.slice(0, openTag.index); right = right.slice(openTag[1].length + 3); changed = true; continue; }
        const mark = /(\*{1,3}|_{1,3}|~~)$/.exec(left)?.[1];
        const wordy = mark?.[0] === '_' && (/\w/.test(left.at(-mark.length - 1) ?? '') || /\w/.test(right[mark.length] ?? ''));   // 낱말 속 _ 는 강조가 아니다
        if (mark && !wordy && right.startsWith(mark) && !/[*_~]/.test(right[mark.length] ?? '') && !/[*_~]/.test(left.at(-mark.length - 1) ?? '')) { left = left.slice(0, -mark.length); right = right.slice(mark.length); lo -= mark.length; hi += mark.length; changed = true; }
    }
    // 공백 다듬기
    // 줄 머리: 글 처음 · 줄바꿈 뒤 · 줄 머리의 여는 태그들 뒤(「<prose>」 뒤 첫 문장을 지우면 「<prose> 미나는」 처럼 공백이 남지 않게)
    const lineStart = !left || /\n[^\S\n]*$/.test(left) || /^[^\S\n]*$/.test(left) || /(?:^|\n)[^\S\n]*(?:<[A-Za-z][^<>]*>[^\S\n]*)+$/.test(left);
    const lineEnd = !right || /^[^\S\n]*(\r?\n|$)/.test(right);
    if (lineStart) right = right.replace(/^[^\S\n]+/, '').replace(LEAD_BR, '');      // 줄 머리에 남는 <br> 은 빈 줄로만 보인다
    if (lineEnd || /^[^\S\n]*(?:\r?\n|$)/.test(right)) left = left.replace(TAIL_BR, '');
    if (lineEnd) left = left.replace(/[^\S\n]+$/, '');
    if (SPACE.test(left.at(-1) ?? '')) {
        const trimmed = left.replace(/[^\S\n]+$/, '');
        if (SPACE.test(right[0] ?? '')) right = right.replace(/^[^\S\n]+/, '');          // 「안녕  세상」 → 하나로
        else if (CLOSE_PUNCT.test(right)) left = trimmed;                                    // 「말했다 .」 → 「말했다.」
        else if (SAME_QUOTES.has(right[0]) && !quoteOpens(trimmed + right[0])) left = trimmed;   // 「"응 ♡"」 → 「"응"」 (닫는 따옴표 앞)
    }
    if (opensAtCut && !closings) right = right.replace(/^[^\S\n]+/, '');       // 「* 그는…*」 → 「*그는…*」
    if (closesAtCut && !openings) left = left.replace(/[^\S\n]+$/, '');        // 「*…말했다 *」 → 「*…말했다*」
    // 양옆에 남은 표시 글자가 이어져 새 표시가 되면 하지 않는다 (「~♡~」 의 ♡ → 「~~」 취소선 · 「*♡*」 → 「**」) — 낱말 속 _ 는 강조가 아니다
    const tailMark = /[*_~]+$/.exec(left)?.[0], headMark = /^[*_~]+/.exec(right)?.[0];
    if (tailMark && headMark && tailMark.at(-1) === headMark[0]
        && !(headMark[0] === '_' && /\w/.test(left.at(-tailMark.length - 1) ?? '') && /\w/.test(right[headMark.length] ?? ''))) return null;
    let text = left + right, cut = left.length;
    // 지운 자리의 줄: 공백 · 짝 없는 강조 표시 · 줄 머리 표시만 남았으면 그 줄을 지운다. 태그가 남았으면 그대로 (그림 · 블록을 지우지 않게)
    //   남은 글자가 원래 화면에 보이던 글자면(「Score: 100.」의 100. · 「-그래.」의 - · 「응~」의 ~) 줄을 남긴다 — 고르지 않은 글이다
    const { from, to } = lineRange(text, cut);
    const line = text.slice(from, to).replace(/\r$/, '').replace(/<br\s*\/?>/gi, '');
    const bare = line.replace(/^[^\S\n]{0,3}(?:#{1,6}|>|[-*+]|\d{1,9}[.)])(?=[^\S\n]|$)/, '').replace(/[*_~\s]/g, '');
    let removed = false;
    if (!bare && !/<[A-Za-z/]/.test(line) && inserted) return null;   // 자리에서 닫고 다시 연 표시만 남는 줄 — 확실하지 않다
    if (!bare && !/<[A-Za-z/]/.test(line) && !visibleRest(raw, lo, hi)) {
        // 남은 강조 표시가 다른 줄과 짝이었으면(줄을 넘는 강조) 줄을 지우면 짝이 깨진다 — 지우지 않는다
        const rawLine = lineRange(raw, span.start);
        if (pairs.some(pair => !inside(pair.open) && !inside(pair.close) && ((pair.open >= rawLine.from && pair.open < rawLine.to) !== (pair.close >= rawLine.from && pair.close < rawLine.to)))) return null;
        // 목록 · 인용 항목에 이어진 줄(들여 쓴 다음 줄)이 있으면: 표시만 남기면 실리태번이 윗줄을 제목으로 바꾸거나 표시를 글자로 그린다 — 지우지 않는다
        const next = text.slice(to + 1).split('\n')[0] ?? '';
        if (/^[^\S\n]{0,3}(?:>|[-*+]|\d{1,9}[.)])/.test(line) && /^[^\S\n]{2,}\S/.test(next)) return null;
        const before = text.slice(0, from), after = text.slice(to + 1);
        text = to < text.length ? before + after : before.replace(/\r?\n$/, '');
        cut = Math.min(from, text.length);
        removed = true;
    }
    // 지운 자리 줄에 닫는 태그만 남고(「…」</span></prose>」 의 대사를 통째로 · 그 대사 줄을 지움) 바로 위가 빈 줄이면 윗글 끝에 붙인다 —
    // 빈 줄 뒤에 홀로 선 닫는 태그는 빈 문단 하나가 되어 메시지 바닥이 좁아진다. 원래 글에서 그 닫는 태그가 글에 붙어 있었을 때만 (빈 줄 뒤에 있던 것은 그대로)
    if (!inserted) {
        const at = lineRange(text, Math.min(cut, text.length));
        const tags = text.slice(at.from, at.to).replace(/^[^\S\n]+/, '');
        const head = text.slice(0, at.from);
        if (/^(?:<\/[A-Za-z][\w-]*>[^\S\n]*)+\r?$/.test(tags) && /\S[^\S\n]*(?:\r?\n[^\S\n]*){2,}$/.test(head) && /^[^\S\n]*(?:\r?\n[^\S\n]*)?<\//.test(raw.slice(hi))) {
            const kept = head.replace(/(?:[^\S\n]*\r?\n)+[^\S\n]*$/, '');
            text = kept + tags + text.slice(at.to);
            cut = kept.length;
        }
    }
    // 지운 뒤 줄의 마크다운 꼴이 바뀌면 지우지 않는다 (「#태그」 → 제목 · 「- 」 → 목록 · 「[이름] (괄호)」 → 링크 · 제목 밑줄이 가로줄로 …)
    if (shapeChanged(raw, span, text, cut, removed)) return null;
    // 글 앞뒤에 새로 생긴 빈 줄 (원래 글이 빈 줄로 시작 · 끝나지 않으면)
    if (!/^[^\S\n]*\r?\n/.test(raw)) { const lead = /^(?:[^\S\n]*\r?\n)+/.exec(text)?.[0].length ?? 0; text = text.slice(lead); cut = Math.max(0, cut - lead); }
    if (!/\r?\n[^\S\n]*$/.test(raw)) text = text.replace(/(?:\r?\n[^\S\n]*)+$/, '');
    // 지운 자리의 빈 줄이 셋 이상 이어지면 둘로 (줄끝은 글 그대로)
    const eol = raw.includes('\r\n') ? '\r\n' : '\n';
    text = text.replace(/(?:\r?\n){3,}/g, (run, at) => (at <= cut + 2 && at + run.length >= cut - 2 ? eol + eol : run));
    return { text, cut };
}

/** 지울 자리 [lo, hi) 밖, 그 자리가 든 줄들에 원래 화면에 보이던 글자(공백 말고)가 남았나 — 남았으면 그 줄은 지우지 않는다 */
function visibleRest(raw, lo, hi) {
    const hidden = hiddenMap(raw);
    const from = lineRange(raw, lo).from, to = lineRange(raw, Math.max(lo, hi - 1)).to;
    for (let i = from; i < to; i++) if ((i < lo || i >= hi) && !hidden[i] && /\S/u.test(raw[i])) return true;
    return false;
}

/** left 끝의 같은 글자 따옴표(" ')가 여는 따옴표인가 — " 는 그 줄에서 홀수 번째, ' 는 앞이 줄 처음 · 공백 · 여는 괄호 · 태그 끝(>)일 때 */
function quoteOpens(left) {
    const q = left.at(-1);
    const lineText = left.slice(left.lastIndexOf('\n') + 1);
    if (q === '"') return (lineText.split('"').length - 1) % 2 === 1;
    const before = lineText.at(-2);
    return before === undefined || /[\s(\[「『（“‘《〈>]/u.test(before);
}

// 줄 머리의 블록 HTML 태그 — 실리태번 showdown 은 그 줄을 HTML 블록으로 보고 안의 마크다운을 그리지 않는다
const BLOCK_HTML = /^ {0,3}<\/?(?:address|article|aside|blockquote|center|details|dialog|dd|div|dl|dt|fieldset|figcaption|figure|footer|form|h[1-6]|header|hgroup|hr|li|main|menu|nav|ol|p|pre|section|summary|table|tbody|td|tfoot|th|thead|tr|ul)(?=[\s/>])/i;

/** 줄의 마크다운 꼴 (실리태번 showdown 기준 — 제목은 # 뒤 공백이 없어도 제목. 「#」 「>」 「-」 「100.」 처럼 표시만 홀로 있는 줄은 글자 그대로 보인다) */
function headKind(line) {
    line = String(line ?? '').replace(/\r$/, '');
    if (!line.trim()) return 'blank';
    if (/^(?: {4}|\t)/.test(line)) return 'code';
    if (/^ {0,3}(?:```|~~~)/.test(line)) return 'fence';
    if (/^ {0,3}#{1,6}(?:[ \t]+\S|[^\s#])/.test(line)) return 'heading';
    if (/^ {0,3}>[ \t]*\S/.test(line)) return 'quote';
    if (/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/.test(line) || /^ {0,3}=+[ \t]*$/.test(line)) return 'rule';
    if (/^ {0,3}-{1,2}[ \t]*$/.test(line)) return 'setext';   // 「-」 「--」: 윗줄이 글이면 그 줄을 제목으로 만드는 밑줄
    if (/^ {0,3}[-*+][ \t]/.test(line)) return 'list';
    if (/^ {0,3}\d{1,9}[.)][ \t]/.test(line)) return 'olist';
    if (/^ {0,3}\[[^\]]*\]:/.test(line)) return 'ref';
    if (BLOCK_HTML.test(line)) return 'html';
    return 'text';
}
/** 줄 안 링크 꼴 「] (」 · 「] [」 의 수 (가운데를 지워 「[이름] (괄호)」가 링크가 되는 것) */
const linkish = line => (String(line).match(/\][^\S\n]*[(\[]/g) || []).length;
const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*\r?$/;

/** 지운 자리 줄의 꼴이 바뀌었나 — 줄을 남겼으면 줄 머리 꼴 · 링크 꼴을 견주고, 줄을 지웠으면 새로 맞붙은 윗줄 · 아랫줄을 본다 */
function shapeChanged(raw, span, text, cut, removed) {
    const start = lineRange(raw, span.start), end = lineRange(raw, Math.max(span.start, span.end - 1));
    const rawLine = raw.slice(start.from, start.to);
    const nextRaw = raw.slice(end.to + 1).split('\n')[0] ?? '';
    if (removed) {
        if (end.to < raw.length && SETEXT.test(nextRaw) && !!rawLine.trim()) return true;
        if (end.to >= raw.length) return false;
        const here = lineRange(text, Math.min(cut, text.length)), below = text.slice(here.from, here.to);
        const above = here.from > 0 ? text.slice(lineRange(text, here.from - 1).from, here.from - 1) : null;
        // 아래 줄이 4칸 · 탭 들여쓰기이고 위가 빈 줄 · 글 처음이 되면 코드 블록이 된다 (원래는 지운 줄의 문단에 이어진 줄)
        if (/^(?: {4}|\t)/.test(below) && !!below.trim() && !above?.trim()) return true;
        // 문단을 끊던 줄(제목 · 인용 · 블록 HTML)을 지워 위아래 글 줄이 한 문단으로 붙으면
        return ['heading', 'quote', 'html'].includes(headKind(rawLine)) && !!above?.trim() && !!below.trim() && headKind(above) === 'text' && headKind(below) === 'text';
    }
    const { from, to } = lineRange(text, cut);
    const line = text.slice(from, to);
    if (headKind(rawLine) !== headKind(line)) return true;
    if (linkish(line) > linkish(rawLine)) return true;
    // 남은 줄 바로 아래가 제목 밑줄인데 줄 머리가 바뀌면 이미 위에서 걸린다 — 밑줄 줄 자체를 지우는 일은 없다 (보이지 않는 글)
    return false;
}

// ── 끝 검사: 지우기 전 · 뒤를 실리태번 그리기(messageFormatting — 표시 정규식 · 마크다운 · 소독)로 그린 HTML 을 견준다 ──
const H_VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const H_SKIP = new Set(['style', 'custom-style', 'script', 'template', 'textarea', 'noscript', 'title']);   // 안 글이 화면 글이 아닌 태그
const H_BLOCK = new Set(['address', 'article', 'aside', 'blockquote', 'caption', 'center', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure',
    'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'tbody', 'td',
    'tfoot', 'th', 'thead', 'tr', 'ul']);
const H_MARK = new Set(['a', 'b', 'code', 'del', 'em', 'i', 'ins', 'kbd', 'mark', 'q', 's', 'strike', 'strong', 'sub', 'sup', 'u', 'span', 'font', 'small', 'big']);
const H_KEEP = new Set(['img', 'hr', 'video', 'audio', 'iframe', 'svg', 'canvas', 'picture', 'input', 'math']);   // 그대로 남아야 하는 것
const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
    laquo: '«', raquo: '»', middot: '·', times: '×', copy: '©', reg: '®', trade: '™' };
const decode = text => text.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (all, name) => {
    if (name[0] !== '#') return ENTITY[name.toLowerCase()] ?? all;
    const code = /x/i.test(name[1]) ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
});
const HTML_TOKEN = /<!--[\s\S]*?-->|<(\/?)([A-Za-z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>|[^<]+|</g;
const PEEL = { ...BRACKETS, '"': '"', "'": "'" };   // 비게 되면 함께 지우는 짝 (보이는 글자)

/**
 * 그린 HTML 의 꼴 → { text, blocks, marks, keeps }
 *  text: 보이는 글 (공백은 하나로 · 블록 경계와 <br> 은 공백) · blocks / marks: [{ tag, depth, from, to, text }] — from · to 는 text 의 자리 (앞뒤 공백 뺌)
 *  keeps: 그림 · 가로줄 같은 것의 차례
 */
// 색 · 클래스가 바뀌어도 고르지 않은 글의 꾸밈이 바뀐 것이다.
function styleSignature(attrs) {
    const out = [];
    for (const m of attrs.matchAll(/([^\s"'>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
        const name = m[1].toLowerCase();
        if (!['class', 'style', 'color', 'face', 'size', 'hidden', 'dir'].includes(name)) continue;
        let value = decode(m[2] ?? m[3] ?? m[4] ?? '').trim();
        if (name === 'class') value = value.split(/\s+/).sort().join(' ');
        if (name === 'style') value = value.split(';').map(x => x.trim().replace(/\s*:\s*/, ':')).filter(Boolean).sort().join(';');
        out.push(name + '=' + value);
    }
    return out.sort().join('|');
}

export function renderShape(html) {
    let length = 0, last = '', depth = 0;
    const chunks = [], blocks = [], marks = [], keeps = [], stack = [], skipping = [];
    const append = str => { if (str) { chunks.push(str); length += str.length; last = str.at(-1); } };
    const space = () => { if (length && last !== ' ') append(' '); };
    const finish = item => {
        if (item.entry) item.entry.to = length;
        if (item.block) { depth--; space(); }
    };
    for (const match of String(html ?? '').matchAll(HTML_TOKEN)) {
        const [token, closing, rawName, attrs = ''] = match;
        if (rawName === undefined) {
            if (skipping.length || token.startsWith('<!--')) continue;
            const part = decode(token).replace(/\s+/gu, ' ');
            append(last === ' ' || !length ? part.replace(/^ /, '') : part);
            continue;
        }
        const name = rawName.toLowerCase();
        if (skipping.length) { if (closing && name === skipping.at(-1)) skipping.pop(); else if (!closing && H_SKIP.has(name)) skipping.push(name); continue; }
        if (closing) {
            let at = stack.length - 1;
            while (at >= 0 && stack[at].name !== name) at--;
            if (at >= 0) for (const item of stack.splice(at).reverse()) finish(item);
            continue;
        }
        if (H_SKIP.has(name)) { skipping.push(name); continue; }
        if (H_KEEP.has(name)) keeps.push(`${name} ${/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i.exec(attrs)?.[1] ?? ''}`);
        if (name === 'br') { space(); continue; }
        const block = H_BLOCK.has(name), signature = styleSignature(attrs);
        if (block) space();
        const entry = block || H_MARK.has(name) || signature ? { tag: name, attrs: signature, depth: block ? depth : 0, from: length } : null;
        if (entry) (block ? blocks : marks).push(entry);
        if (H_VOID.has(name)) { if (entry) entry.to = entry.from; if (block) space(); continue; }
        if (block) depth++;
        stack.push({ name, entry, block });
    }
    for (const item of stack.reverse()) finish(item);
    const text = chunks.join('');
    for (const item of [...blocks, ...marks]) {
        while (item.from < item.to && text[item.from] === ' ') item.from++;
        while (item.to > item.from && text[item.to - 1] === ' ') item.to--;
        item.text = text.slice(item.from, item.to);
    }
    return { text: text.trimEnd(), blocks, marks, keeps };
}

/** 보이는 글 b 에서 고른 글 key 하나(+ 비게 된 괄호 · 따옴표 짝 · 둘레 공백)만 빠지면 a 가 되나 → 빠진 자리 { from, to } 또는 null */
function cutOf(b, a, key) {
    // 접두 · 접미를 한 번만 센다. 반복 낱말마다 메시지 전체를 다시 만들지 않는다.
    let prefix = 0, suffix = 0;
    while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
    while (suffix < a.length && suffix < b.length && a[a.length - suffix - 1] === b[b.length - suffix - 1]) suffix++;
    const match = (left, right, gap) => {
        const tail = b.length - right;
        return left <= prefix && tail <= suffix && left + gap.length + tail === a.length && (!gap || a[left] === gap);
    };
    for (let i = b.indexOf(key); i >= 0; i = b.indexOf(key, i + 1)) {
        let left = i, right = i + key.length;
        for (;;) {
            const l = left > 0 && b[left - 1] === ' ' ? left - 1 : left;
            const r = b[right] === ' ' ? right + 1 : right;
            // renderShape 글은 공백이 하나뿐. 연결 뒤 둘레 공백 정리도 이 두 경계뿐이다.
            for (const x of [left, l]) for (const y of [right, r]) for (const gap of ['', ' ']) {
                let lx = x, ry = y, sep = gap;
                if (!lx) { if (b[ry] === ' ') ry++; sep = ''; }
                if (ry === b.length) { if (lx && b[lx - 1] === ' ') lx--; sep = ''; }
                if (lx && b[lx - 1] === ' ' && (sep || b[ry] === ' ')) { lx--; sep = ' '; }
                if (sep && b[ry] === ' ') ry++;
                if (match(lx, ry, sep)) return { from: l, to: r };
            }
            const open = b[l - 1];
            if (!open || PEEL[open] === undefined || PEEL[open] !== b[r]) break;
            left = l - 1; right = r + 1;
        }
    }
    return null;
}

// 여러 줄에 걸친 대사도 한쪽 따옴표만 없어지면 나머지 줄의 대사색이 바뀐다.
function quoteCut(text, cut) {
    const stack = [], closes = new Map([['”', '“'], ['」', '「'], ['』', '『']]);
    const inside = i => i >= cut.from && i < cut.to;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (text[i - 1] === '\\') continue;
        if (ch === '"') {
            if (stack.at(-1)?.ch === ch) { if (inside(stack.pop().i) !== inside(i)) return true; }
            else stack.push({ ch, i });
        } else if (['“', '「', '『'].includes(ch)) stack.push({ ch, i });
        else if (closes.has(ch) && stack.at(-1)?.ch === closes.get(ch)) {
            if (inside(stack.pop().i) !== inside(i)) return true;
        }
    }
    return false;
}

/**
 * 요소 차례가 같은가 — 글이 빠진 자리에 통째로 든 것만 빠질 수 있고(빈 채 남아도 됨), 글이 바뀐 것은 그 자리에 걸친 것뿐, 새로 생긴 것은 없음.
 * 앞에서부터 욕심내어 짝지으면 원래 빈 요소(에셋 자리 <p></p> 같은)를 지운 요소의 빈 껍데기로 잘못 짝지을 수 있어 맞춤 표로 본다 (요소 수 × 요소 수)
 */
function sameOrder(was, now, cut, withDepth) {
    const gone = item => item.to > item.from && item.from >= cut.from && item.to <= cut.to;
    const touches = item => item.from < cut.to && item.to > cut.from;
    const like = (other, item) => other.tag === item.tag && other.attrs === item.attrs && (!withDepth || other.depth === item.depth);
    const pairs = (item, other) => like(other, item) && (other.text === item.text || (gone(item) ? !other.text : touches(item)));   // 통째로 지운 꾸밈을 다른 글의 새 꾸밈으로 쓰지 않는다
    let row = new Set([0]);
    for (const item of was) {
        const next = new Set();
        for (const j of row) {
            if (gone(item)) next.add(j);
            if (j < now.length && pairs(item, now[j])) next.add(j + 1);
        }
        if (!next.size) return false;
        row = next;
    }
    return row.has(now.length);
}

/**
 * 끝 검사가 어긋난 까닭 — '' (고른 글만 빠짐) · 'text' (보이는 글) · 'keeps' (그림 · 가로줄) · 'blocks' (블록 차례) · 'marks' (꾸밈)
 *  보이는 글은 고른 글(+ 비게 된 괄호 · 따옴표 · 공백)만 빠지고 · 블록 차례는 빈 블록이 빠진 것 말고 같고 · 꾸밈은 고른 글 안에 있던 것만 빠지고 · 그림 · 가로줄은 그대로
 */
export function formatDiff(beforeHtml, afterHtml, selected) {
    const key = norm(selected);
    if (!key) return 'text';
    const was = renderShape(beforeHtml), now = renderShape(afterHtml);
    const cut = cutOf(was.text, now.text, key);
    if (!cut) return 'text';
    if (quoteCut(was.text, cut)) return 'marks';
    if (was.keeps.join('\n') !== now.keeps.join('\n')) return 'keeps';
    if (!sameOrder(was.blocks, now.blocks, cut, true)) return 'blocks';
    return sameOrder(was.marks, now.marks, cut, false) ? '' : 'marks';
}

/** 끝 검사: 지우기 전 · 뒤를 그린 HTML (같은 그리기) 이 「고른 글만 빠짐」인가 (formatDiff 가 '' ) */
export const formatKept = (beforeHtml, afterHtml, selected) => !formatDiff(beforeHtml, afterHtml, selected);
