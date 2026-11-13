// 11-13 글꾸 본문 줄바꿈 — 고른 값(이 기기에 기억 · 모든 틀에 같이): 「글자 단위」(기본 · 사용자 「난 글자 단위가 좋아서」) · 「단어 단위」.
//   바꾸면 'bl-tone-change' 를 알려요 — 목록 카드 · 크게 보기 · 복사 글이 같은 길(mart.js previewOf → word-wrap.js wrapHtml)로 다시 그려져요(밤낮 · 글 모양 · 움직임과 같은 알림).
//   테마 로그 복사 창의 값(logCopy.wrap)과는 따로예요 — 「테마로 담기」에는 안 실어요(테마는 제 설정으로 그려요).
import { wrapMode } from './word-wrap.js?v=20261113q';

const KEY = 'bl-mart-wrap-v1';
export const wrapState = { mode: (() => { try { return wrapMode(globalThis.localStorage?.getItem(KEY)); } catch { return 'char'; } })() };
/** 'char' | 'word' — 같은 값이면 아무것도 안 해요 */
export function setWrap(mode) {
    const next = wrapMode(mode);
    if (next === wrapState.mode) return;
    wrapState.mode = next;
    try { globalThis.localStorage?.setItem(KEY, next === 'word' ? 'word' : ''); } catch { /* 이 화면에서만 */ }
    try { document.dispatchEvent(new CustomEvent('bl-tone-change', { detail: { wrap: true } })); } catch { /* 시험 */ }
}
