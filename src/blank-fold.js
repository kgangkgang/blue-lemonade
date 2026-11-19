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
/** 빈칸 글자 하나인가(공백 · 점자 빈칸) */
export const isSpace = ch => ch === BLANK || /\s/u.test(ch);
export const hasBlank = s => typeof s === 'string' && s.includes(BLANK);
/** 점자 빈칸 → 보통 빈칸(같은 길이 · 없으면 같은 글 그대로) */
export const foldBlank = s => { const t = String(s ?? ''); return t.includes(BLANK) ? t.replace(ALL, ' ') : t; };
/** 접고 앞뒤 다듬기 */
export const trimBlank = s => foldBlank(s).trim();
/** 접고 이어진 빈칸 하나로 · 앞뒤 다듬기 */
export const squashBlank = s => foldBlank(s).replace(/\s+/g, ' ').trim();
/** 원문이 점자 빈칸만 쓰면(보통 빈칸 0) 새 글의 보통 빈칸도 점자 빈칸으로 — 원문에 다시 써 넣는 글이 두 꼴로 섞이지 않게 */
export function matchBlankStyle(original, text) {
    const o = String(original ?? ''), t = String(text ?? '');
    if (!o.includes(BLANK) || o.includes(' ')) return t;
    return t.replace(/ /g, BLANK);
}
