// Opt out of our UI color overrides without changing another extension's settings,
// inline styles, class-based panel-order keys, or layout rules.
const MARKER = 'data-bl-native-ext-colors';
const COLUMNS = '#extensions_settings, #extensions_settings2';
const FOREIGN = [
    '.text-to-image-converter-settings', '.tti-select-menu', '.tti-modal-backdrop',
    '.tti-selection-float', '.tti-highlight-float', '#autopic_settings_container',
    '.TH-custom-tailwind', '.TH-popup',
].join(',');
// These surfaces belong to the host or our bundled tools. Keep their theme UI.
// Check descendants too: extensions can insert an extra .extension_container.
const OWN = [
    '.salty-panel', '#salty-drawer', '[id^="salty-"]', '[data-bl-addon]',
    '.bl-extension-page', '.bl-tool-section', '#bl-ctsi-holder',
    '.cg-root', '.llmt-settings', '.eh-root', '.jj-settings', '.pa-hub',
    '.rl-settings', '.lt-settings', '.sw-settings', '.wd-settings',
    '#request_log_settings', '#model_register_settings', '#model-switch-settings',
    '#regex-link-settings', '#jj-settings', '#char_assets_settings',
    '#bwr_settings', '#ban_word_rewrite_settings', '.bwr-settings', '.bwr_settings',
    '#prompt-panel', '.pt-settings', '.pt-extension-settings', '#pt-panel', '#panel_order_settings', '#perf_assist_settings',
    '#regex_container', '#qr--settings', '#quick_reply_container',
    '.regex_settings', '.caption_settings', '.vectors_settings', '#tts_settings',
    '#memory_settings', '.translation_settings', '.expression_settings', '.sd_settings', '#assets_ui',
    '#extensions_settings > .extensions_info', '#extensions_settings2 > .extensions_info',
].join(',');
const SKIP_TREE = '#chat, #send_form, .salty-preview, .salty-sample, #salty-nochat';
const NON_PANEL = 'script,style,link,template,meta,noscript,hr,#po-divider';
let active = false, observer = null, pending = null;
const marked = new Set(), foreign = new Set();

function excluded(el) {
    return el.matches(NON_PANEL) || el.closest(SKIP_TREE) || el.closest(OWN) || el.querySelector(OWN);
}

function collectForeign(scope) {
    if (scope.nodeType !== 1 || scope.closest(SKIP_TREE)) return;
    if (scope.matches(FOREIGN)) foreign.add(scope);
    for (const root of scope.querySelectorAll(FOREIGN)) if (!root.closest(SKIP_TREE)) foreign.add(root);
}

function collectPanels(next) {
    for (const column of document.querySelectorAll(COLUMNS)) {
        for (const child of column.children) {
            if (child.matches(NON_PANEL) || child.closest(OWN)) continue;
            if (child.matches('.extension_container')) {
                const panels = [...child.children].filter(el => !el.matches(NON_PANEL));
                // The outer container may own the extension's color variables.
                // Never mark a mixed wrapper containing a host/bundled panel.
                const external = panels.filter(el => !excluded(el));
                if (external.length && external.length === panels.length) next.add(child);
                else for (const panel of external) next.add(panel);
            } else if (!excluded(child)) next.add(child);
        }
    }
}

function refresh() {
    pending = null;
    if (!active) return;
    const next = new Set();
    collectPanels(next);
    for (const root of foreign) {
        if (!root.isConnected || !root.matches(FOREIGN)) { foreign.delete(root); continue; }
        if (!excluded(root)) next.add(root);
    }
    for (const root of marked) {
        if (!next.has(root)) { root.removeAttribute(MARKER); marked.delete(root); }
    }
    for (const root of next) {
        if (!marked.has(root)) { root.setAttribute(MARKER, ''); marked.add(root); }
    }
}

function schedule() {
    if (pending === null) pending = setTimeout(refresh, 0);
}

export function syncExtensionColors(enabled) {
    enabled = !!enabled;
    if (enabled === active) return;
    active = enabled;
    if (!enabled) {
        observer?.disconnect(); observer = null;
        if (pending !== null) clearTimeout(pending);
        pending = null;
        for (const root of marked) root.removeAttribute(MARKER);
        marked.clear(); foreign.clear();
        return;
    }
    collectForeign(document.body);
    refresh();
    observer = new MutationObserver(records => {
        let dirty = false;
        for (const record of records) {
            // A streamed message must not rescan the extension settings or CSS.
            if (record.target.nodeType === 1 && record.target.closest(SKIP_TREE)) continue;
            if (record.target.nodeType === 1 && record.target.closest(COLUMNS)) dirty = true;
            if (record.type === 'attributes') {
                // Portals may receive their class/id after being attached. Never
                // observe style/text mutations or our own marker attribute.
                const t = record.target;
                if (t.nodeType === 1 && t.matches(FOREIGN) && !foreign.has(t)) { foreign.add(t); dirty = true; }
                if (foreign.has(t) || marked.has(t)) dirty = true;
                continue;
            }
            const host = record.target.nodeType === 1 && record.target.closest(FOREIGN);
            if (host && !foreign.has(host)) { foreign.add(host); dirty = true; }
            if (record.removedNodes.length && marked.size) dirty = true;
            for (const node of record.addedNodes) {
                if (node.nodeType !== 1 || node.closest(SKIP_TREE)) continue;
                const before = foreign.size;
                collectForeign(node);
                if (foreign.size !== before || node.matches(COLUMNS) || node.querySelector(COLUMNS)) dirty = true;
            }
        }
        if (dirty) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id'] });
}
