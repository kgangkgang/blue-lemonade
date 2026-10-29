import { IDS, LABELS } from './core.js';
import { context, enabled, configure, deleteEnabled } from './state.js';
import { syncSelectionDelete } from './delete.js';   // 6.4.4 고른 글 지우기
import { selectionSnapshot, typingInField } from './translation.js';
// 7.7.4 고른 글 창(ui.js · 비교 · 용어 기억)은 글을 처음 고를 때 받는다 — 시작할 때는 아무도 부르지 않아 받기만 했다.
//   받기 전에는 고른 글도 열린 창도 없으니 비우기 · 닫기는 할 일이 없다
let ui = null, uiLoading = null;
const loadUI = () => uiLoading ||= import('./ui.js').then(m => (ui = m), error => { uiLoading = null; throw error; });
const openTool = id => loadUI().then(m => m.openTool(id));
let listening = false, style = null, selectionTimer = 0;
function positionToolbar() {
    const bar = document.getElementById('llmt-selection-selection');
    if (!bar) return;
    const view = window.visualViewport, top = view?.offsetTop || 0, height = view?.height || innerHeight;
    const composer = document.getElementById('send_form')?.getBoundingClientRect();
    const bottom = Math.min(top + height - 12, composer?.top > top ? composer.top - 8 : top + height - 90);
    bar.style.top = `${Math.max(top + 8, bottom - bar.offsetHeight)}px`;
}
const ICONS = { retranslate: 'language' };
function selectionChanged() {
    clearTimeout(selectionTimer);
    // 8.2.5 입력칸에 글을 치는 중이고 도구 막대도 없으면 할 일이 없다 — 타이머도 걸지 않는다 (막대가 있으면 아래에서 치운다)
    if (typingInField() && !document.getElementById('llmt-selection-selection')) return;
    selectionTimer = setTimeout(async () => {
        if (!enabled()) return;
        let snap = selectionSnapshot();
        if (!snap) { if (!document.querySelector('dialog.llmt-selection[open]')) document.getElementById('llmt-selection-selection')?.remove(); return; }
        if (!ui) {   // 처음 한 번만 받는다 — 받는 동안 고른 글 · 채팅이 바뀌었을 수 있어 지금 것으로 다시 본다
            try { await loadUI(); } catch (error) { console.warn('[LLM 번역] 고른 글 도구', error); return; }
            if (!enabled() || !(snap = selectionSnapshot())) return;
        }
        ui.setSelection(snap);
        const toolbar = document.getElementById('llmt-selection-selection');
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
function chatChanged() { ui?.clearSelection(); document.getElementById('llmt-selection-selection')?.remove(); ui?.closeTools(); }
export function syncSelectionRetranslate(options) {
    if (options) configure(options);
    const any = IDS.some(enabled);
    if ((any || deleteEnabled()) && !style) { style = document.createElement('link'); style.rel = 'stylesheet'; style.href = new URL('./style.css', import.meta.url).href; document.head.append(style); }
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
        clearTimeout(selectionTimer); document.getElementById('llmt-selection-selection')?.remove(); ui?.closeTools(); listening = false;
    }
    syncSelectionDelete();   // 6.4.4 고른 글 지우기 (같은 설정 묶음 · 따로 켜고 끈다)
}
export { openTool };
