import { isMainChatGenerating } from '../../../main-chat-rules.js';   // 6.5.3 「생성 중」 = 본채팅 생성만
let options = null;
export function configure(next) { options = next; }
export const adapter = () => {
    if (!options) throw Error('번역 기능을 초기화하지 못했어요. 새로고침해 주세요.');
    return { command: { callback: (args, text) => options.translate(text, { prompt: args.prompt || undefined, assertValid: args.assertValid, noChunks: true }) }, render: options.render, clean: options.clean, remember: options.remember, refresh: options.refresh, complete: options.complete };
};
export const context = () => SillyTavern.getContext();
export const enabled = () => options?.settings?.selection_retranslate === true;
// 6.4.4 고른 글 지우기: 번역 설정의 selection_delete (기본 켬) · 번역기가 넘긴 도구 (index.js syncSelection 의 deleteHooks)
export const deleteEnabled = () => !!options && options.settings?.selection_delete !== false;
export const deleteHooks = () => options?.deleteHooks ?? null;
export const chatKey = () => String(context().groupId ?? context().characterId ?? '') + ':' + String(context().getCurrentChatId?.() ?? context().chatId ?? '');
let busy = false;
export async function exclusive(task) {
    if (document.body.classList.contains('cg-previewing')) throw Error('북마크 미리보기를 닫은 뒤 현재 채팅에서 선택해 주세요.');
    if (busy) throw Error('다른 분석이나 재번역이 끝난 뒤 다시 눌러 주세요.');
    // 6.5.3 본채팅 생성 중(살아 있는 스트림 · 본채팅 Generate)에만 막는다 — 다른 확장 · 실리태번 헬퍼의 조용한 생성이 is_send_press 를 켠 때는 그대로 간다
    if (isMainChatGenerating()) throw Error('답변 생성이 끝난 뒤 사용해 주세요.');
    busy = true;
    try {
        return await task();
    } finally { busy = false; }
}

export const captureGuard = message => options?.capture?.(message);
