// 3.1.7 코드 칸 울타리 줄(``` · ~~~ 과 그 뒤 언어 이름) — 번역 요청에 보내지 않고 제자리에 글자 그대로 둔다 (index.js translate).
//   전에는 울타리 줄이 본문과 함께 모델에 갔다. 모델이 울타리를 빼거나 언어 이름(html)을 지우거나 바꿔도 그대로 붙어,
//   헬퍼가 그리는 코드 칸(화면 카드 · 상태창)이 날 글로 보이거나 다른 칸이 됐다. 이제 울타리 줄만 자리표([[__VAR_n__]])로 보내고
//   안의 글은 예전처럼 보낸다. 상태 카드가 품은 울타리(display-cards.js) · 보호 규칙이 가린 블록 뒤에 돌아서
//   그 블록들의 자리표 번호 · 문단 캐시 열쇠는 예전 그대로다. 실리태번 모듈을 import 하지 않는다 (node 시험: tools/tests/translator-code-fences.mjs).

const OPEN = /^[ \t]*(`{3,}|~{3,})(.*)$/;
const CLOSE = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;
const BLANK = /(\r?\n[\t ]*\r?\n(?:[\t ]*\r?\n)*)/;

/** 글의 줄을 차례로 — { start, end } (줄 끝 \r\n · \n 은 뺀 자리) */
function lineRanges(text) {
    const out = [];
    for (let at = 0; ;) {
        const nl = text.indexOf('\n', at), stop = nl < 0 ? text.length : nl;
        out.push({ start: at, end: stop > at && text[stop - 1] === '\r' ? stop - 1 : stop });
        if (nl < 0) return out;
        at = nl + 1;
    }
}

/**
 * 울타리 줄 자리 (원문 차례). 여는 줄 = 백틱 · 물결 셋 이상 + 언어 이름(백틱 울타리는 이름에 백틱이 없을 때만 — 「```a``` 글」 같은 줄은 울타리가 아님),
 * 닫는 줄 = 같은 글자 · 여는 것 이상 길이 · 뒤에 빈칸만. 닫히지 않은 칸(흘려받는 중인 답)은 여는 줄만.
 */
export function fenceLines(text) {
    const value = String(text ?? ''), found = [];
    let open = null;
    for (const range of lineRanges(value)) {
        const line = value.slice(range.start, range.end);
        if (open) {
            const m = CLOSE.exec(line);
            if (m && m[1][0] === open[0] && m[1].length >= open.length) { found.push(range); open = null; }
            continue;
        }
        const m = OPEN.exec(line);
        if (!m || (m[1][0] === '`' && m[2].includes('`'))) continue;
        open = m[1];
        found.push(range);
    }
    return found;
}

/**
 * 울타리 줄을 reserve(줄) 가 주는 자리표로 바꾼다. 줄 끝 바꿈은 그대로라 자리표는 늘 제 줄에 혼자 있다.
 * → { text, tokens: 자리표 차례, lines: 가린 울타리 줄 글 (Set) }
 */
export function maskFences(text, reserve) {
    const value = String(text ?? ''), ranges = fenceLines(value), tokens = [], lines = new Set();
    if (!ranges.length) return { text: value, tokens, lines };
    let out = '', at = 0;
    for (const { start, end } of ranges) {
        const line = value.slice(start, end), token = reserve(line);
        tokens.push(token); lines.add(line);
        out += value.slice(at, start) + token;
        at = end;
    }
    return { text: out + value.slice(at), tokens, lines };
}

/** 울타리 자리표가 든 요청에만 붙이는 한 줄 — 자리표 사이가 코드 칸 안이라는 것 (모델은 울타리 줄을 못 본다) */
export const FENCE_NOTE = '[Some [[__VAR_n__]] placeholders stand for the first and last line of a code block. Keep each of them on its own line, exactly where it is. Between them, translate only the words a reader sees; leave code, markup, identifiers and data keys as they are.]';

/**
 * 모델이 빠뜨린 울타리 자리표를 원문과 같은 줄 자리에 되돌린다 (문단 안 가운데 줄이어도).
 * 문단 수가 원문과 같고, 그 문단의 줄 수가 「원문 줄 수 − 빠진 울타리 줄 수」일 때만 — 아니면 건드리지 않고
 * 남은 것은 index.js 의 보호 블록 되돌리기(restoreDroppedPlaceholders — 문단 머리 · 끝 · 맨 끝)가 맡는다.
 * source: 보낸 원문(자리표 포함) · output: 모델 답(자리표를 풀기 전) · tokens: 울타리 자리표 → { text, restored }
 */
export function restoreFenceLines(source, output, tokens) {
    const src = String(source ?? ''), answer = String(output ?? '');
    const missing = new Set((tokens || []).filter(token => token && src.includes(token) && !answer.includes(token)));
    if (!missing.size) return { text: answer, restored: 0 };
    const from = src.split(BLANK), to = answer.split(BLANK);
    if (from.length !== to.length) return { text: answer, restored: 0 };
    let restored = 0;
    for (let i = 0; i < from.length; i += 2) {
        const lines = from[i].split('\n'), gone = lines.filter(line => missing.has(line.trim())).length;
        if (!gone) continue;
        const got = to[i].split('\n');
        if (got.length !== lines.length - gone) continue;
        let k = 0;
        to[i] = lines.map(line => (missing.has(line.trim()) ? line : got[k++])).join('\n');
        restored += gone;
    }
    return { text: restored ? to.join('') : answer, restored };
}
