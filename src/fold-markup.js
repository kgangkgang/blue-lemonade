// 접기 틀(제목 없는 <details>) 글자 다루기 — 화면 · 실리태번 없이 글만 봐요.
// mes-fold.js(눈 길게 누르기 · 그때만 읽음)와 내장 번역기(채팅을 열 때 저장된 번역문 고치기)가 같이 써요.
//
// 1.7.9 버그 사냥 3: 번역기의 태그 짝 고치기는 원문에 없는 <details> 를 첫 문단 안에서 닫아 버려
//   「<details><summary></summary></details>\n\n본문\n\n」 꼴(깨진 틀)을 남겼어요 — 채팅을 다시 열 때마다.
//   그 답은 접힌 채(숨김)인데 글이 다 펼쳐져 보이고 맨 위에 빈 삼각형만 남았어요. 이제 틀 안쪽만 고치고 틀은 그대로 둬요.
//   이미 깨진 틀은 우리가 접은 답(extra.bl_folded)에서만 알아봐서 되살려요.

export const FOLD_HEAD = '<details><summary></summary>\n\n', FOLD_TAIL = '\n\n</details>';
const OPEN = /^\s*<details\s*>\s*<summary\s*>\s*<\/summary\s*>/i;
const CLOSE = /<\/details\s*>\s*$/i;
const BROKEN = /^(?:\s*<details\s*>\s*<summary\s*>\s*<\/summary\s*>\s*<\/details\s*>)+\s*/i;

export const wrapFold = (text) => FOLD_HEAD + String(text ?? '') + FOLD_TAIL;

/** 통째로 감싼 빈 제목 접기 칸이면 안쪽 글, 아니면 null. 손으로 감싼 한 줄 틀도 알아본다 —
 *  첫 <details> 의 짝이 맨 끝 </details> 여야 한다 (제목 있는 카드 · 클래스 달린 번역기 칸은 아님) */
export function unwrapFold(text) {
    const s = String(text ?? '');
    // 우리가 쓴 틀 그대로면 짝 세기 전에 바로 — 안쪽에 닫히지 않은 <details>(끊긴 답의 상태창 · 코드 속 태그)가 있으면
    // 짝 세기가 실패해 접힌 글을 못 알아보고 한 겹 더 감쌌다 (검증에서 확인)
    if (s.startsWith(FOLD_HEAD) && s.endsWith(FOLD_TAIL) && s.length >= FOLD_HEAD.length + FOLD_TAIL.length) return s.slice(FOLD_HEAD.length, s.length - FOLD_TAIL.length);
    const head = s.match(OPEN), tail = s.match(CLOSE);
    if (!head || !tail) return null;
    let depth = 0, end = -1;
    for (const m of s.matchAll(/<(\/?)details\b[^>]*>/gi)) {
        depth += m[1] ? -1 : 1;
        if (depth === 0) { end = m.index; break; }
    }
    if (end !== tail.index) return null;
    return s.slice(head[0].length, tail.index).replace(/^[ \t]*\r?\n/, '').replace(/\r?\n[ \t]*$/, '');
}

/** 깨진 틀(맨 앞 빈 <details></details> 한 겹 이상)이면 안쪽 글, 아니면 null. 본래 글(원문)이 그렇게 시작하면 깨진 틀이 아니에요 */
export function brokenFoldInner(text, original = '') {
    const s = String(text ?? '');
    const head = s.match(BROKEN);
    if (!head || BROKEN.test(String(original ?? ''))) return null;
    return s.slice(head[0].length).replace(/\s+$/, '');
}

/**
 * 접힌 글이면 틀 안쪽만 transform 하고 틀은 그대로 다시 감싸요. 접힌 글이 아니면 transform 그대로.
 * folded(우리가 접은 답)일 때만 깨진 틀도 안쪽을 꺼내 제 틀로 되살려요.
 */
export function keepFold(text, transform, { folded = false, original = '' } = {}) {
    const s = String(text ?? '');
    let inner = unwrapFold(s);
    if (inner === null && folded) inner = brokenFoldInner(s, original);
    if (inner === null) return transform(s);
    return wrapFold(transform(inner));
}
