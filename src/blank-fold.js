// 버그 사냥 7 점자 빈칸(U+2800) 공용 정규화 — 띄어쓰기 대신 점자 빈칸을 쓰는 프리셋(「공백마다 점자 빈칸」 우회)의 답은
//   저장 원문 · 확장 자료 · 번역문에 `pocket⠀watch` 꼴로 들어와요. 자바스크립트 `\s` · `trim()` · `split(' ')` 은 이 글자를 빈칸으로 안 봐서
//   여러 낱말 이름 · 금지어 · 용어집 · 검색어 · 고른 글 자리 · 날씨 · 층 판정이 따로따로 빗나갔어요(1.8.6 칩 간격 · 속마음 두 칸 · 1.8.7 금지어).
//   정책: 이 모듈은 「견주기 · 찾기용」 접기만 해요 — 길이가 같은 보통 빈칸으로 바꿔 자리 번호가 그대로라 원문 자리 계산에 그대로 써요.
//   저장 자료 · 원문 · 프롬프트에 넣는 글은 바꾸지 않아요. 화면 글을 바꾸는 일은 스위치 blank(src/mb-place-mark.js · 화면만) 몫이에요.
//   쓰는 곳 · 시험: tools/tests/blank-fold.mjs(전수 목록은 허브 지시-1119/버그사냥-7 보고)
export const BLANK = '⠀';
const ALL = /⠀/g;
/** 정규식 조각: 빈칸 하나(공백 · 점자 빈칸) */
export const SP = '[\\s\\u2800]';
/** 1.9.1 정규식 조각: 줄 안 빈칸 하나(스페이스 · 탭 · 점자 빈칸 — 줄바꿈은 아님). `[ \t]` 자리에 */
export const HSP = '[ \\t\\u2800]';
/** 빈칸 글자 하나인가(공백 · 점자 빈칸) */
export const isSpace = ch => ch === BLANK || /\s/u.test(ch);
export const hasBlank = s => typeof s === 'string' && s.includes(BLANK);
/** 점자 빈칸 → 보통 빈칸(같은 길이 · 없으면 같은 글 그대로) */
export const foldBlank = s => { const t = String(s ?? ''); return t.includes(BLANK) ? t.replace(ALL, ' ') : t; };
/** 접고 앞뒤 다듬기 */
export const trimBlank = s => foldBlank(s).trim();
/** 1.9.1 앞뒤만 다듬기(앞뒤 점자 빈칸도 떼요 · 가운데 점자 빈칸은 그대로) — 보여 줄 이름처럼 글을 바꾸면 안 되는 자리 */
const EDGE = /^[\s⠀]+|[\s⠀]+$/g;
export const trimEdge = s => String(s ?? '').replace(EDGE, '');
/** 접고 이어진 빈칸 하나로 · 앞뒤 다듬기 */
export const squashBlank = s => foldBlank(s).replace(/\s+/g, ' ').trim();
// 1.9.1 점자 빈칸 전수 2: 사전(그 확장 화면 번역 tr 등) 열쇠가 `⠀이름⠀` 꼴이고 찾는 글은 앞뒤를 뗀 `이름` 꼴(또는 그 반대)일 때 —
//   글자 그대로 먼저 보고, 없으면 접은 열쇠(squashBlank)로 찾아 **사전에 있는 원래 열쇠**를 돌려줘요(값은 늘 사전에서 바로 읽게).
//   접은 찾기표는 사전마다 한 번 만들고, 열쇠 수가 바뀌거나 가리키던 열쇠가 사라지면 다시 만들어요.
const keyIndex = new WeakMap();
export function blankKey(dict, key) {
    if (!dict || typeof dict !== 'object') return undefined;
    const k = String(key ?? '');
    if (Object.hasOwn(dict, k)) return k;
    const want = squashBlank(k);
    if (!want) return undefined;
    const n = Object.keys(dict).length;
    let idx = keyIndex.get(dict);
    if (!idx || idx.n !== n) {
        const map = new Map();
        for (const kk of Object.keys(dict)) { const f = squashBlank(kk); if (f && !map.has(f)) map.set(f, kk); }
        idx = { n, map }; keyIndex.set(dict, idx);
    }
    const hit = idx.map.get(want);
    if (hit !== undefined && !Object.hasOwn(dict, hit)) { keyIndex.delete(dict); return blankKey(dict, key); }
    return hit;
}
/** 원문이 점자 빈칸만 쓰면(보통 빈칸 0) 새 글의 보통 빈칸도 점자 빈칸으로 — 원문에 다시 써 넣는 글이 두 꼴로 섞이지 않게 */
export function matchBlankStyle(original, text) {
    const o = String(original ?? ''), t = String(text ?? '');
    if (!o.includes(BLANK) || o.includes(' ')) return t;
    return t.replace(/ /g, BLANK);
}
