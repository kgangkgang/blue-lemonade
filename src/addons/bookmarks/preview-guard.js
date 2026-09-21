// 북마크 — 채팅에서 미리보기 중에 막을 실리태번 단축키 (순수 함수라 node로 시험한다: tests/logic.test.mjs)
//
// 미리보기는 #chat 화면만 다른 채팅으로 바꿔 그린다. 실리태번의 데이터(chat)는 지금 채팅 그대로라,
// 단축키로 다시 생성 · 이어 쓰기 · 스와이프 · 편집이 돌면 지금 채팅의 메시지를 지우거나 바꾸고 새 답을 미리보기 화면에 그린다.
// 실리태번 RossAscends-mods.js processHotkeys 기준:
//   Ctrl+Enter 다시 생성 · Alt+Enter 이어 쓰기 (어디에 초점이 있든) · Enter 보내기 (입력칸에서)
//   ← / → 스와이프 · ↑ / Ctrl+↑ 마지막 메시지 편집 (입력칸 밖, 또는 비어 있는 보내기 입력칸)

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/**
 * @param {{ key: string, ctrlKey?: boolean, altKey?: boolean, metaKey?: boolean, target?: any }} event
 * @returns {boolean} 미리보기 중이면 막아야 하는 키인지
 */
export function isBlockedPreviewKey(event) {
    const key = event?.key;
    const target = event?.target && typeof event.target.closest === 'function' ? event.target : null;
    const editable = target ? target.closest(EDITABLE) : null;
    const inSendBox = !!editable && editable.id === 'send_textarea';
    if (key === 'Enter') {
        // Ctrl/Alt+Enter 는 실리태번이 초점과 상관없이 받는다. 북마크 창의 입력칸(메모 편집의 Ctrl+Enter 저장 등)은 그 칸이 처리하고 전파를 멈춘다.
        if (event.ctrlKey || event.altKey) return !editable || inSendBox;
        return inSendBox; // 보내기 입력칸의 Enter = 보내기
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp') {
        // 다른 입력칸 안의 화살표는 글자 사이 이동이다 (실리태번도 그때는 스와이프 · 편집을 하지 않는다)
        return !editable || inSendBox;
    }
    return false;
}
