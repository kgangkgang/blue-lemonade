let options = null;
export function configure(next) { options = next; }
export const adapter = () => {
    if (!options) throw Error('번역 기능을 초기화하지 못했어요. 새로고침해 주세요.');
    return { command: { callback: (args, text) => options.translate(text, { prompt: args.prompt || undefined, assertValid: args.assertValid, noChunks: true }) }, render: options.render };
};
export const context = () => SillyTavern.getContext();
export const enabled = () => options?.settings?.selection_retranslate === true;
export const chatKey = () => String(context().groupId ?? context().characterId ?? '') + ':' + String(context().getCurrentChatId?.() ?? context().chatId ?? '');
let busy = false;
export function isBusy() { return busy; }
export async function exclusive(task) {
    if (busy) throw Error('다른 분석이나 재번역이 끝난 뒤 다시 눌러 주세요.');
    if (context().streamingProcessor && !context().streamingProcessor.isFinished) throw Error('답변 생성이 끝난 뒤 사용해 주세요.');
    busy = true;
    try {
        const core = await import('/script.js');
        if (core.isGenerating?.()) throw Error('답변 생성이 끝난 뒤 사용해 주세요.');
        return await task();
    } finally { busy = false; }
}

export const captureGuard = message => options?.capture?.(message);
