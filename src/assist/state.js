import { getSettings } from '../settings.js';
export const context = () => SillyTavern.getContext();
export const enabled = id => !!getSettings().enabled && !!getSettings().addons?.[id];
export const chatKey = () => String(context().groupId ?? context().characterId ?? '') + ':' + String(context().getCurrentChatId?.() ?? context().chatId ?? '');
export function state() {
    const settings = context().extensionSettings;
    const s = settings.blue_lemonade_assist ??= { samples: [], rules: [], applyTaste: false };
    if (!Array.isArray(s.samples)) s.samples = [];
    if (!Array.isArray(s.rules)) s.rules = [];
    return s;
}
export function save() { context().saveSettingsDebounced(); }
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
