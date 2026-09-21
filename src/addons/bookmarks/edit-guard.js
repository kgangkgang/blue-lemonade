// 북마크 — 채팅에서 그 메시지의 편집 창이 열려 있는지 (1.2.10)
// 편집 창이 열린 메시지를 updateMessageBlock 으로 다시 그리면 편집 창이 지워지고, 그 뒤 ✓ 를 누르면 실리태번 updateMessage 가
// 화면 글자(.mes_text 의 text — 번역문이거나 서식이 빠진 글)를 원문으로 저장한다 (재현: 번역하기 → ✓ 에 "[번역] …" 이 원문이 됨).
// 실리태번을 import 하지 않아 node 로 시험한다 (tests/logic.test.mjs).

export const EDITING_IN_CHAT = '채팅에서 이 메시지를 고치는 중이에요. 편집을 끝낸 뒤 다시 해 주세요.';

/**
 * @param {ParentNode | null | undefined} root 보통 document
 * @param {number | string} index 메시지 번호
 */
export function isEditingMessage(root, index) {
    return !!root?.querySelector?.(`#chat .mes[mesid="${index}"] .edit_textarea`);
}
