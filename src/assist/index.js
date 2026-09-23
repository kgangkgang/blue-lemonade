import { IDS, LABELS } from './core.js';
import { context, enabled } from './state.js';
import { syncRequests } from './requests.js';
import { syncDiagnostics } from './diagnostics.js';
import { syncTaste } from './taste.js';
import { selectionSnapshot } from './translation.js';
import { openTool, setSelection, clearSelection, closeTools } from './ui.js';
let listening = false, style = null, selectionTimer = 0;
const ICONS = { conflicts: 'stethoscope', requestview: 'list-check', retranslate: 'language', taste: 'pen-nib' };
function selectionChanged() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
        const snap = selectionSnapshot(), toolbar = document.getElementById('bl-assist-selection');
        if (!snap) { if (!document.querySelector('dialog.bl-assist[open]')) toolbar?.remove(); return; }
        setSelection(snap);
        if (toolbar) return;
        const bar = document.createElement('div'); bar.id = 'bl-assist-selection'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', '선택한 글 도구');
        for (const id of ['retranslate', 'taste'].filter(enabled)) {
            const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', LABELS[id]); button.innerHTML = `<i class="fa-solid fa-${ICONS[id]}"></i>`;
            button.addEventListener('pointerdown', e => e.preventDefault());
            button.onclick = () => { bar.remove(); openTool(id); }; bar.append(button);
        }
        if (bar.children.length) document.body.append(bar);
    }, 180);
}
function chatChanged() { clearSelection(); document.getElementById('bl-assist-selection')?.remove(); closeTools(); syncTaste(); }
export function syncAssist() {
    const any = IDS.some(enabled);
    if (any && !style) { style = document.createElement('link'); style.rel = 'stylesheet'; style.href = new URL('./style.css', import.meta.url).href; document.head.append(style); }
    syncRequests(enabled('requestview')); syncDiagnostics(enabled('conflicts')); syncTaste();
    const menu = document.getElementById('extensionsMenu');
    for (const id of IDS) {
        let item = document.getElementById('bl-assist-menu-' + id);
        if (!enabled(id)) { item?.remove(); continue; }
        if (!item && menu) {
            item = document.createElement('div'); item.id = 'bl-assist-menu-' + id; item.className = 'list-group-item flex-container flexGap5 interactable'; item.tabIndex = 0; item.setAttribute('role','button');
            item.innerHTML = `<div class="fa-fw fa-solid fa-${ICONS[id]} extensionsMenuExtensionButton"></div><span>${LABELS[id]}</span>`;
            item.onclick = () => openTool(id); item.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTool(id); } }; menu.append(item);
        }
    }
    if (any && !listening) {
        document.addEventListener('selectionchange', selectionChanged);
        context().eventSource.on(context().eventTypes.CHAT_CHANGED, chatChanged); listening = true;
    } else if (!any && listening) {
        document.removeEventListener('selectionchange', selectionChanged);
        context().eventSource.removeListener(context().eventTypes.CHAT_CHANGED, chatChanged);
        clearTimeout(selectionTimer); document.getElementById('bl-assist-selection')?.remove(); closeTools(); listening = false;
    }
}
export { openTool };
