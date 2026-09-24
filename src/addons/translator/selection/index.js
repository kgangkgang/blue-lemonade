import { IDS, LABELS } from './core.js';
import { context, enabled, configure } from './state.js';
import { selectionSnapshot } from './translation.js';
import { openTool, setSelection, clearSelection, closeTools } from './ui.js';
let listening = false, style = null, selectionTimer = 0;
function positionToolbar() {
    const bar = document.getElementById('llmt-selection-selection');
    if (!bar) return;
    const view = window.visualViewport, top = view?.offsetTop || 0, height = view?.height || innerHeight;
    const composer = document.getElementById('send_form')?.getBoundingClientRect();
    const bottom = Math.min(top + height - 12, composer?.top > top ? composer.top - 8 : top + height - 90);
    bar.style.top = `${Math.max(top + 8, bottom - bar.offsetHeight)}px`;
}
const ICONS = { conflicts: 'stethoscope', retranslate: 'language' };
function selectionChanged() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
        if (!enabled()) return;
        const snap = selectionSnapshot(), toolbar = document.getElementById('llmt-selection-selection');
        if (!snap) { if (!document.querySelector('dialog.llmt-selection[open]')) toolbar?.remove(); return; }
        setSelection(snap);
        if (toolbar) return;
        const bar = document.createElement('div'); bar.id = 'llmt-selection-selection'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', '선택한 글 도구');
        // ST transforms its zero-height html element; the top layer uses the viewport instead.
        bar.setAttribute('popover', 'manual');
        for (const id of ['retranslate'].filter(enabled)) {
            const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', LABELS[id]); button.innerHTML = `<i class="fa-solid fa-${ICONS[id]}"></i>`;
            button.addEventListener('pointerdown', e => e.preventDefault());
            button.onclick = () => { bar.remove(); openTool(id); }; bar.append(button);
        }
        if (bar.children.length) { document.body.append(bar); bar.showPopover?.(); positionToolbar(); }
    }, 180);
}
function chatChanged() { clearSelection(); document.getElementById('llmt-selection-selection')?.remove(); closeTools(); }
export function syncSelectionRetranslate(options) {
    if (options) configure(options);
    const any = IDS.some(enabled);
    if (any && !style) { style = document.createElement('link'); style.rel = 'stylesheet'; style.href = new URL('./style.css', import.meta.url).href; document.head.append(style); }
    if (any && !listening) {
        document.addEventListener('selectionchange', selectionChanged);
        window.addEventListener('resize', positionToolbar);
        window.visualViewport?.addEventListener('resize', positionToolbar);
        window.visualViewport?.addEventListener('scroll', positionToolbar);
        context().eventSource.on(context().eventTypes.CHAT_CHANGED, chatChanged); listening = true;
    } else if (!any && listening) {
        document.removeEventListener('selectionchange', selectionChanged);
        window.removeEventListener('resize', positionToolbar);
        window.visualViewport?.removeEventListener('resize', positionToolbar);
        window.visualViewport?.removeEventListener('scroll', positionToolbar);
        context().eventSource.removeListener(context().eventTypes.CHAT_CHANGED, chatChanged);
        clearTimeout(selectionTimer); document.getElementById('llmt-selection-selection')?.remove(); closeTools(); listening = false;
    }
}
export { openTool };
