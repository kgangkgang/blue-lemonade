// 7.7.9 단추 묶음 · 짧은 체크 항목 묶음의 2열 격자 자동 1열 — css/84-button-groups.css 가 2열로 그리는 묶음에서
// 라벨이 한 줄에 안 들어가면(320 폭 등) 그 묶음에만 data-bl-cols="1" 을 붙여 1열로 떨어뜨린다. 창이 열리거나 크기가 바뀔 때 다시 잰다.
const GROUPS = '.bl-btn-grid, .bl-check-grid, .llmt-card .translation-backup-buttons, .llmt-btn-group, .llmt-gl-actions, .llmt-check-actions, #lv_settings .lv-actions, .ms-fallback-actions, .llmt-settings .llmt-checks--grid, .salty-panel :is(.salty-group, .bl-editor-group-body, .bl-tool-body, .bl-addon-config, .salty-sec) > .salty-btns, .salty-panel .bl-word-options';
const ITEMS = ':scope > .menu_button, :scope > button, :scope > label, :scope > .salty-btn';
let bodyObserver = null, resizeObserver = null;
const watched = new WeakSet();

/** 2열일 때 어떤 항목이라도 글자가 칸보다 넓으면 1열 */
export function fitGroup(group) {
    if (!(group instanceof Element) || !group.isConnected) return;
    group.removeAttribute('data-bl-cols');
    if (!group.getClientRects().length) return;
    let overflow = false;
    for (const item of group.querySelectorAll(ITEMS)) {
        if (!item.getClientRects().length) continue;
        const inner = item.matches('label') ? (item.querySelector(':scope > span') || item) : item;
        if (inner.scrollWidth > inner.clientWidth + 1 || item.scrollWidth > item.clientWidth + 1) { overflow = true; break; }
    }
    if (overflow) group.setAttribute('data-bl-cols', '1');
}
function fitIn(root) {
    if (!root?.querySelectorAll) return;
    for (const g of root.querySelectorAll(GROUPS)) { fitGroup(g); if (resizeObserver && !watched.has(g)) { watched.add(g); resizeObserver.observe(g); } }
}
function watchDialog(dlg) {
    let t = 0;
    const run = () => { clearTimeout(t); t = setTimeout(() => fitIn(dlg), 40); };
    run();
    const ob = new MutationObserver(run);
    ob.observe(dlg, { childList: true, subtree: true });
    const done = new MutationObserver(() => { if (!dlg.isConnected) { ob.disconnect(); done.disconnect(); } });
    done.observe(document.body, { childList: true });
}

export function startGroupGrid() {
    if (bodyObserver) return;
    globalThis.BlueLemonadeFitGroups = root => fitIn(root || document);
    resizeObserver = new ResizeObserver(entries => { for (const e of entries) fitGroup(e.target); });
    bodyObserver = new MutationObserver(records => {
        for (const r of records) for (const node of r.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches('dialog')) watchDialog(node);
            else for (const d of node.querySelectorAll?.('dialog') || []) watchDialog(d);
        }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: false });
    for (const d of document.querySelectorAll('dialog[open]')) watchDialog(d);
    // 확장 서랍 · 창 안 탭을 누르면 그려진 뒤 한 번
    document.addEventListener('click', e => {
        const head = e.target instanceof Element ? e.target.closest('.inline-drawer-toggle, .inline-drawer-header, .pa-hub-tab, .lv-tab, .llmt-tab, .rl-tab, .drawer-toggle, [data-act=editor-route], .bl-editor-group-toggle') : null;
        if (head) setTimeout(() => fitIn(head.closest('dialog') || head.closest('.inline-drawer') || document.getElementById('extensions_settings') || document), 80);
    }, true);
    fitIn(document.getElementById('extensions_settings'));
    fitIn(document.getElementById('extensions_settings2'));
}
