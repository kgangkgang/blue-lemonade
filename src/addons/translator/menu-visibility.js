const entries = [
    ['show_chat_translate_menu', 'llm_show_chat_translate_menu', 'llm_translate_chat'],
    ['show_input_translate_menu', 'llm_show_input_translate_menu', 'llm_translate_input_message'],
];
export function syncTranslatorMenus(settings, root = document) {
    for (const [key, controlId, menuId] of entries) {
        const visible = settings[key] !== false;
        const control = root.querySelector('#' + controlId);
        if (control) control.checked = visible;
        const item = root.querySelector('#' + menuId);
        if (!item) continue;
        item.hidden = !visible;
        if (visible) item.style.removeProperty('display');
        else item.style.setProperty('display', 'none', 'important');
    }
}
export function bindTranslatorMenus(settings, save, root = document) {
    for (const [key, controlId] of entries) {
        const control = root.querySelector('#' + controlId);
        if (control) control.onchange = () => {
            settings[key] = control.checked;
            syncTranslatorMenus(settings, root);
            save();
        };
    }
    syncTranslatorMenus(settings, root);
}
