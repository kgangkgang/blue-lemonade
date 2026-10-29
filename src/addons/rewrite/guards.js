// 다시 쓰기가 답을 붙잡고 있는 동안 채팅 화면을 지키는 작은 판단들. 실리태번을 import하지 않아 node로 시험한다 (test-extension.mjs).

/**
 * 채팅을 바꾸는 누름: 지난 채팅 목록 · 체크포인트 링크 · 분기 만들기 · 첫 화면의 최근 채팅.
 * 실리태번은 생성 중이면 캐릭터 바꾸기 · 새 채팅은 막지만 이것들은 막지 않는다. 다시 쓰는 동안(답은 아직 저장 전) 채팅을 바꾸면
 * 실리태번이 답을 저장하기 전에 채팅을 비워서, 파일에는 답 대신 '...' 이 남았다 (1.7.5에서 재현).
 */
export const CHAT_SWITCH_SELECTOR = '.select_chat_block, .mes_bookmark, .mes_create_branch, .recentChat';

/**
 * 누른 곳이 채팅을 바꾸는 버튼이면 그 요소, 아니면 null
 * @param {EventTarget | null} target
 */
export function chatSwitchTarget(target) {
    return target && typeof target.closest === 'function' ? target.closest(CHAT_SWITCH_SELECTOR) : null;
}

/**
 * 이 메시지의 편집 창이 열려 있는지. 열려 있을 때 메시지를 다시 그리면 편집 창이 지워지고, 그 뒤 ✓ 를 누르면
 * 실리태번이 화면 글자(번역문 · 서식이 빠진 글)를 원문으로 저장한다.
 * @param {ParentNode | null} root 보통 document
 * @param {number | string} messageId
 */
export function isEditingMessage(root, messageId) {
    return !!root?.querySelector?.(`#chat .mes[mesid="${messageId}"] .edit_textarea`);
}

/**
 * 1029 목록에서 그 항목만 뺀다. 없으면(확인 창이 떠 있는 사이 다른 기기 합치기가 이미 뺐으면) 아무것도 안 하고 false.
 * 예전엔 splice(indexOf(item), 1) 이라 -1 이면 맨 끝 항목(엉뚱한 금지 묘사 · 예외)을 지웠다.
 * @template T @param {T[]} list @param {T} item
 */
export function removeListed(list, item) {
    const at = Array.isArray(list) ? list.indexOf(item) : -1;
    if (at < 0) return false;
    list.splice(at, 1);
    return true;
}
