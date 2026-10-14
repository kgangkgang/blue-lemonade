// Model target links reveal existing settings without changing connections.
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(find) {
    const end = Date.now() + 6000;
    do { const found = find(); if (found) return found; await wait(60); } while (Date.now() < end);
    return null;
}
const visible = el => !!el?.getClientRects().length;
export function flash(elements) {
    for (const el of elements) {
        el.classList.remove('ms-flash'); void el.offsetWidth; el.classList.add('ms-flash');
        setTimeout(() => el.classList.remove('ms-flash'), 1800);
    }
}
export function reveal(elements) {
    const list = (Array.isArray(elements) ? elements : [elements]).filter(Boolean);
    if (!list.length) return null;
    for (const el of list) for (let parent = el; parent; parent = parent.parentElement) if (parent.tagName === 'DETAILS') parent.open = true;
    list[0].scrollIntoView({ block: 'start', behavior: 'smooth' }); flash(list); return list[0];
}
// Closing through the editor action returns controls to their original holder.
export async function closeModelDialogs() {
    for (const dialog of document.querySelectorAll('dialog[open]')) {
        if (dialog.querySelector('.salty-panel')) dialog.querySelector('[data-act="panel-close"]')?.click();
        else if (dialog.querySelector('#model-switch-settings')) (dialog.querySelector('.popup-button-ok') || dialog.querySelector('.popup-button-close'))?.click();
    }
    await wait(180);
}
const MODULES = {
    translator: () => import('../translator/bridge.js'), prompt: () => import('../prompt/index.js'),
    rewrite: () => import('../rewrite/index.js'), assets: () => import('../assets/index.js'), 'tts-analysis': () => import('../tts/index.js'),
};
const ROOTS = { translator: '.translation_settings.llmt-settings', prompt: '#pt-panel', rewrite: '.bwr_settings', assets: '#char_assets_settings', 'tts-analysis': '.lv-settings' };
const ancestor = (root, selector, closest) => root.querySelector(selector)?.closest(closest);
const cards = (root, selectors, closest) => [...new Set(selectors.map(selector => ancestor(root, selector, closest)).filter(visible))];
export async function openRoute(id, kind = 'main') {
    if (!hasRoute(id)) return null;
    await closeModelDialogs();
    const api = await MODULES[id]();
    // Popup functions can resolve only when closed; wait for their DOM instead.
    Promise.resolve(api.openPanel()).catch(error => console.warn('[Blue Lemonade] 설정 열기', error));
    const root = await until(() => [...document.querySelectorAll(ROOTS[id])].find(visible));
    if (!root) return null;
    let found;
    if (id === 'translator') {
        root.querySelector('[data-llmt-tab="model"]')?.click();
        found = kind === 'fallback' ? root.querySelector('#llm_fallback_field') : cards(root, ['#llm_connection_mode', '#llm_provider', '.parameter-settings'], '.llmt-card');
    } else if (id === 'prompt') {
        root.querySelector('#pt-main-tab-settings')?.click(); root.querySelector('#pt-setting-tab-connection')?.click();
        found = kind === 'fallback' ? ancestor(root, '#pt-fallback-field', '.pt-card') : cards(root, ['#pt-connection-mode', '#pt-provider', '#pt-params-wrap'], '.pt-card');
    } else if (id === 'rewrite') {
        root.querySelector('.bwr_tab[data-tab="connection"]')?.click();
        found = root.querySelector(kind === 'fallback' ? '#bwr_fallback_field' : '.bwr_panel[data-panel="connection"]');
    } else if (id === 'assets') {
        found = root.querySelector(kind === 'fallback' ? '.eh-pick-fallback' : '.eh-pick');
    } else {
        root.querySelector('.lv-tab[data-tab="read"]')?.click();
        found = ancestor(root, kind === 'fallback' ? '[data-lv-path="analysis.fallback.enabled"]' : '[data-lv-path="analysis.engine"]', kind === 'fallback' ? '.lv-field, label' : '.lv-card');
    }
    await wait(60); return reveal(found);
}
export const hasRoute = id => Object.hasOwn(MODULES, id);
