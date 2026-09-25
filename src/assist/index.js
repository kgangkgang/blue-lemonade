import { enabled, context } from './state.js';
import { syncDiagnostics } from './diagnostics.js';
import { openTool } from './ui.js';
let style = null, synced = null;
// 5.3.4: applyAll 마다(슬라이더를 끄는 프레임마다) 불린다 — 켬/끔이 바뀔 때만 일한다 (옛 메뉴 · 프롬프트 지우기는 처음 한 번이면 된다)
export function syncAssist() {
    const on = enabled('conflicts');
    if (on === synced) return;
    synced = on;
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
