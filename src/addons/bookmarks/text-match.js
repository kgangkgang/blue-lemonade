// 북마크 — 검색어 위치 찾기
// 실리태번을 import하지 않는 순수 함수라 node로 시험한다 (tests/logic.test.mjs).

/** 글자(코드 포인트)마다 소문자로 바꾸며, 바뀐 글의 각 칸이 원래 글의 어디에서 왔는지 적어 둔다. */
function lowerWithMap(text) {
    let lower = '';
    const starts = [];
    const ends = [];
    for (let index = 0; index < text.length;) {
        const code = text.codePointAt(index);
        const width = code > 0xffff ? 2 : 1;
        const piece = String.fromCodePoint(code).toLowerCase();
        for (let k = 0; k < piece.length; k++) {
            starts.push(index);
            ends.push(index + width);
        }
        lower += piece;
        index += width;
    }
    return { lower, starts, ends };
}

/**
 * text 안에서 query(대소문자 무시)가 나오는 [시작, 끝) 위치들. 위치는 원래 text 기준이고 늘 text 길이 안이다.
 * 소문자로 바꾸면 길이가 달라지는 글자가 있어서(İ → i̇, 두 칸) 소문자 글에서 찾은 위치를 원래 글에 그대로 쓰면
 * 뒤로 갈수록 어긋나고, 끝을 넘으면 Range.setEnd가 IndexSizeError를 던진다. 그래서 위치를 원래 글로 옮겨 준다.
 * 글자 중간에서 끝나는 일치는 그 글자까지 넓힌다.
 */
export function findMatches(text, query) {
    const source = String(text ?? '');
    const needle = lowerWithMap(String(query ?? '')).lower;
    if (!source || !needle) return [];
    const { lower, starts, ends } = lowerWithMap(source);
    const ranges = [];
    let from = lower.indexOf(needle);
    while (from >= 0) {
        const start = starts[from];
        const end = ends[from + needle.length - 1];
        if (end > start && (!ranges.length || start >= ranges.at(-1)[1])) ranges.push([start, end]);
        from = lower.indexOf(needle, from + needle.length);
    }
    return ranges;
}
