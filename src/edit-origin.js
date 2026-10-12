// 6.1.7 글을 누가 고쳤나 — 다시 쓰기가 고친 글이면 TTS 가 대사 분석을 버리지 않고 새 글로 옮겨 쓴다.
// 사용자: 「다시쓰기 확장이 … 글의흐름을바꾸지않으니까 tts분석은그대로유지하게둘수있어? 유저가 직접 문장수정하는거랑 다시쓰기랑 tts는구별을못하나?」
// 다시 쓰기도 실리태번 편집도 MESSAGE_UPDATED · MESSAGE_EDITED 를 보내 이벤트만으로는 구별이 안 된다 → 다시 쓰기가 글을 바꿀 때 여기 적는다.
// 적는 자리: mes.extra.bl_rewrite = [[고치기 전 글 해시, 고친 뒤 글 해시], …] (최근 4번). 해시는 글 전체(mes.mes)의 FNV-1a → base36
//   (TTS analysis.hash 와 같은 계산 — tools/tests/rewrite-tts-keep.mjs 가 맞춰 본다). 글을 담지 않고 해시만 — 채팅 파일에 짧게 남고, 새로 고쳐도 이어진다.
// 표시는 스스로 맞춰 본다: 「이 해시의 글이 다시 쓰기만 거쳐 지금 해시가 됐나」(rewriteLinked). 사람이 그 사이에 고쳤으면 고리가 끊겨 false
//   → 쓰는 쪽은 지금처럼 다시 분석한다. 스와이프 · 다른 글로 바뀐 뒤 남은 옛 표시는 해시가 안 맞아 아무 일도 하지 않는다.

export const REWRITE_KEY = 'bl_rewrite';
export const REWRITE_LINKS = 4;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const validLink = l => Array.isArray(l) && l.length === 2 && typeof l[0] === 'string' && typeof l[1] === 'string' && !!l[0] && !!l[1] && l[0] !== l[1];

/** 글 해시 (FNV-1a → base36). TTS 의 analysis.hash 와 같다 */
export function originHash(text) {
    const s = String(text ?? '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
}

/** 이 메시지의 다시 쓰기 고리 (복사본, 오래된 것부터) */
export function rewriteOf(mes) {
    const links = mes?.extra?.[REWRITE_KEY];
    return Array.isArray(links) ? links.filter(validLink).map(l => [l[0], l[1]]) : [];
}

/**
 * 다시 쓰기가 글을 before → after 로 바꿨다고 적는다 (이벤트를 보내기 전에). 스와이프 정보의 extra 에도 같은 것을 (넘겼다 돌아와도 남게).
 * @returns {boolean} 적었나
 */
export function markRewrite(mes, before, after) {
    if (!isObj(mes) || typeof before !== 'string' || typeof after !== 'string' || before === after) return false;
    const link = [originHash(before), originHash(after)];
    if (!validLink(link)) return false;
    if (!isObj(mes.extra)) mes.extra = {};
    const links = [...rewriteOf(mes), link].slice(-REWRITE_LINKS);
    mes.extra[REWRITE_KEY] = links;
    const swipe = Array.isArray(mes.swipe_info) ? mes.swipe_info[Number(mes.swipe_id) || 0] : null;
    if (isObj(swipe?.extra) && swipe.extra !== mes.extra) swipe.extra[REWRITE_KEY] = links.map(l => [l[0], l[1]]);
    return true;
}

/** fromHash 의 글이 다시 쓰기만 거쳐 toHash 가 됐나 (적힌 차례대로 이어지는 고리가 있을 때만) */
export function rewriteLinked(mes, fromHash, toHash) {
    if (!fromHash || !toHash || fromHash === toHash) return false;
    let cur = String(fromHash);
    const goal = String(toHash);
    for (const [from, to] of rewriteOf(mes)) {
        if (from !== cur) continue;
        cur = to;
        if (cur === goal) return true;   // 고리 중간에서 지금 글에 닿아도 (그 뒤 고친 것이 되돌려졌을 때)
    }
    return false;
}
