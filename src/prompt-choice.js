import { preparePromptChoice } from './prompt-choice-core.js';

let wanted = false, binding = null, loading = null;

export function bindPromptChoices(doc, getManager) {
    const click = event => {
        const toggle = event.target?.closest?.('.prompt-manager-toggle-action');
        if (!toggle) return;
        const manager = getManager();
        if (!manager?.containerElement?.contains(toggle)) return;
        const selected = toggle.closest('[data-pm-identifier]')?.dataset.pmIdentifier;
        const settings = manager.serviceSettings;
        if (!selected || !settings || !manager.activeCharacter) return;
        const order = manager.getPromptOrderForCharacter(manager.activeCharacter);
        const changed = preparePromptChoice(settings.prompts, order, settings.extensions?.blPromptChoices, selected);
        if (changed.length) {
            const counts = manager.getTokenHandler?.()?.getCounts?.();
            if (counts) for (const id of changed) counts[id] = null;
        }
    };
    doc.addEventListener('click', click, true);
    return () => doc.removeEventListener('click', click, true);
}

export async function syncPromptChoices(enabled) {
    wanted = !!enabled;
    if (!wanted) { binding?.(); binding = null; return; }
    if (binding) return;
    try {
        loading ??= import('../../../../openai.js');
        const api = await loading;
        if (wanted && !binding) binding = bindPromptChoices(document, () => api.promptManager);
    } catch (error) {
        loading = null;
        console.warn('[Blue Lemonade] 택1 선택 연결을 불러오지 못했어요', error);
    }
}
