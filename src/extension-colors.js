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
let off = new Set();   // 5.5.2: 색을 유지하지 않을 확장 키 (설정 compat.extensionColorsOff)

// 5.5.2 확장별 켜고 끄기: 설정창 칸의 키 · 이름은 확장 순서 애드온(src/addons/order/order.js keyOf · labelOf)과 거의 같은 규칙
// (애드온을 끈 사용자도 쓰도록 여기 따로 둔다 · .extension_container 겉 클래스는 키에서 뺌).
// 팝업을 따로 띄우는 확장은 설정창과 팝업을 한 키로 묶는다 (헬퍼를 빼면 헬퍼 팝업도 테마 색).
const GROUPS = [
    { key: 'grp:tavern-helper', name: 'Tavern Helper', match: '#tavern_helper, .TH-custom-tailwind, .TH-popup' },
    { key: 'grp:text-to-image', name: 'Text to Image', match: '.text-to-image-converter-settings, .tti-select-menu, .tti-modal-backdrop, .tti-selection-float, .tti-highlight-float' },
    { key: 'grp:autopic', name: 'AutoPic', match: '#autopic_settings_container' },
];
// 실리태번 공용 틀 클래스 — 이것만으로는 어느 확장인지 모른다 (여러 확장이 같은 이름을 쓴다)
const GENERIC = new Set(['extension_container', 'inline-drawer', 'wide100p', 'flex-container', 'flexFlowColumn']);
// 칸의 키: 알려진 묶음 → 칸 id → 바깥 .extension_container id → 공용이 아닌 클래스 → 서랍 제목
function panelKey(el, box = null) {
    for (const g of GROUPS) if (el.matches(g.match) || el.querySelector(g.match) || box?.matches(g.match)) return g.key;
    if (el.id) return `id:${el.id}`;
    if (box?.id) return `id:${box.id}`;
    const cls = [...el.classList].filter(c => c && !GENERIC.has(c)).sort().join('.');
    return cls ? `cls:${cls}` : `name:${panelLabel(el, '')}`;
}
function panelLabel(el, key) {
    const head = el.querySelector('.inline-drawer-toggle, .inline-drawer-header') ?? el.querySelector('b, h3, h4');
    const title = head?.querySelector('b, h3, h4') ?? head;
    const text = (title?.textContent || '').replace(/\s+/g, ' ').trim()
        .replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N})\]]+$/u, '');
    return text || GROUPS.find(g => g.key === key)?.name || key.replace(/^\w+:/, '');
}

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
                const kept = external.filter(el => !off.has(panelKey(el, child)));
                if (kept.length && kept.length === panels.length) next.add(child);
                else for (const panel of kept) next.add(panel);
            } else if (!excluded(child) && !off.has(panelKey(child))) next.add(child);
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
        if (!excluded(root) && !off.has(panelKey(root))) next.add(root);
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

/** 5.5.2: 지금 색을 유지할 수 있는 다른 확장 목록 [{ key, label }] — 설정창의 확장별 스위치가 쓴다 */
export function listExtensionColorTargets() {
    const out = new Map();
    for (const column of document.querySelectorAll(COLUMNS)) {
        for (const child of column.children) {
            if (child.matches(NON_PANEL) || child.closest(OWN)) continue;
            const box = child.matches('.extension_container') ? child : null;
            const panels = box ? [...child.children].filter(el => !el.matches(NON_PANEL)) : [child];
            for (const el of panels) {
                if (excluded(el)) continue;
                const key = panelKey(el, box);
                if (!out.has(key)) out.set(key, panelLabel(el, key));
            }
        }
    }
    return [...out].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'ko'));
}

export function syncExtensionColors(enabled, offList = []) {
    enabled = !!enabled;
    const nextOff = new Set(Array.isArray(offList) ? offList : []);
    const offChanged = nextOff.size !== off.size || [...nextOff].some(k => !off.has(k));
    off = nextOff;
    if (enabled && active && offChanged) { refresh(); return; }
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
