import { enabled, context } from './state.js';
import { syncDiagnostics } from './diagnostics.js';
import { openTool } from './ui.js';
let style = null;
export function syncAssist() {
    if (enabled('conflicts') && !style) {
        style = document.createElement('link'); style.rel = 'stylesheet';
        style.href = new URL('./style.css', import.meta.url).href; document.head.append(style);
    }
    syncDiagnostics(enabled('conflicts'));
    context().setExtensionPrompt?.('blue_lemonade_writing_taste', '', 1, 1, false, 0);
    for (const id of ['taste','requestview','conflicts','retranslate']) document.getElementById('bl-assist-menu-' + id)?.remove();
    document.getElementById('bl-assist-selection')?.remove();
}
export { openTool };
