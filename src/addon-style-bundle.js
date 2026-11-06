// 애드온 CSS의 시작 순서·묶음 조건·첫 장 분리표예요. 번역기는 자기 시트를 써요.
// build-addon-css.mjs가 만들고, css-cascade-diff와 addon-gated-bundle 시험이 순서·선택 결과를 확인해요.
export const ADDON_STYLE_BUNDLE = 'style-addons.css';   // src/addons/ 아래
export const ADDON_STYLE_IDS = Object.freeze(['perf', 'order', 'models', 'modelswitch', 'regexlink', 'rewrite', 'direction', 'bookmarks', 'notes', 'zipinstall', 'assets', 'prompt', 'prompt-template', 'customstyle', 'mermaid', 'tts']);
// 기능 이름으로 상위를 찾는 코드와 겹치지 않는 번호 표식이에요.
export const addonStyleMark = id => `bl-asc-${ADDON_STYLE_IDS.indexOf(id)}`;
// 1.0.6 후보: 16개 중 15개 이상 켜면 조건부 묶음을 써요. 적게 켠 조합은 큰 묶음을 받지 않게 개별 시트로 남겨요.
export const ADDON_GATED_BUNDLE = 'style-addons.gated.gen.css';
export const ADDON_GATED_BOOT_BUNDLE = 'style-addons.gated.boot.gen.css';
export function gatedBundleFits(ids) {
    if (!Array.isArray(ids) || ids.length < ADDON_STYLE_IDS.length - 1) return false;
    let previous = -1;
    for (const id of ids) { const at = ADDON_STYLE_IDS.indexOf(id); if (at <= previous) return false; previous = at; }
    return true;
}
/** 실제 붙인 묶음의 활성 표식만 맞춰요. 같은 설정이면 DOM에 쓰지 않아요. */
export function syncAddonStyleFlags(doc, ids) {
    const active = new Set(ids), list = doc?.documentElement?.classList;
    if (!list) return;
    for (const id of ADDON_STYLE_IDS) {
        const key = addonStyleMark(id), on = active.has(id);
        if (list.contains(key) !== on) list.toggle(key, on);
    }
}
// 1.0.0 극한 최적화: 애드온 창 안에서만 쓰는 규칙을 뺀 첫 장(<시트>.boot.gen.css · 빌드 tools/build-addon-css.mjs)을 먼저 붙이고, 처음 누르거나 창이 뜨면(또는 서랍 · 창이 열리면) 전체 시트로 바꿔요.
//   id → 창 안 표시(바깥 사슬에 있으면 뺌) · 지킴(있으면 남김). 표에 없는 애드온은 작아서 그대로 전체 시트를 붙여요
export const ADDON_BOOT_CSS = Object.freeze({
    notes: { panel: '[.]bl-notes?-[\\w-]+', keep: '#chat|#extensionsMenu', roots: ['.bl-notes-dialog', '.bl-notes-mini', '.bl-notes-settings'] },
    perf: { panel: '[.](?:rl|lt|pa|sv)-(?!wand-button)[\\w-]+|[.]sw-settings|[.]sw-body', keep: '#chat|[.]mes(?![\\w-])', roots: ['.rl-root', '.rl-settings', '.lt-root', '.lt-drawer', '.pa-hub', '.pa-settings', '.sv-settings', '.sw-settings'] },
    direction: { panel: '[.]jj-[\\w-]+|#jj-popup|#jj-settings|[.]bl-direction-dialog', keep: '#jj-button|#chat|#leftSendForm|[.]jj-popup-host', roots: ['#jj-popup', '#jj-settings', '.jj-settings'] },
    bookmarks: { panel: '[.]cg-(?!mes-btn|pop|wand-button|ribbon)[\\w-]+|#cg-[\\w-]+', keep: '#chat|#form_sheld|[.]mes(?![\\w-])', roots: ['.cg-root', '.cg-window', '.cg-overlay', '.cg-sheet-overlay', '.cg-scrim', '#cg-preview-bar'] },
    assets: { panel: '[.]eh-[\\w-]+|#char_assets_settings|[.]bl-assets-dialog', keep: '#chat|[.]mes(?![\\w-])|[.]mes_text', roots: ['.eh-root', '.eh-viewer', '#char_assets_settings'] },
    tts: { panel: '[.]lv-(?!bar|now|on(?![\\w-])|off(?![\\w-])|paint|playing|hidden-line|read|stop|analyze)[\\w-]+|#lv_[\\w-]+', keep: '#chat|[.]mes(?![\\w-])|[.]lv-bar', roots: ['#lv_settings', '.lv-settings', '.lv-editor', '.lv-body'] },
    translator: { panel: '[.]llmt-(?:settings|card|tab|tabs|panel|gl|section|inline-row|version|divider|desc|tagline|field|label)[\\w-]*|[.]bl-translator-dialog[\\w-]*|[.]prompt-add-dialog', keep: '#chat|[.]mes(?![\\w-])|[.]mes_text', roots: ['.llmt-settings', '.bl-translator-dialog', '.prompt-add-dialog'] },
});
/** 첫 장 파일 이름(src/addons/ 아래) */
export const bootSheetOf = (id, sheet = 'style.css') => `${id}/${sheet.replace(/\.css$/, '')}.boot.gen.css`;
export const ADDON_BOOT_BUNDLE = 'style-addons.boot.gen.css';
export const ADDON_CSS_SENTINEL = 'bl-addon-css';
// 처음 쓸 때 시작하는 애드온(addons.js LATE_ADDONS)은 첫 장이 없어요 — 본체를 시작할 때 전체 시트를 붙여요
export const LATE_STYLE_IDS = Object.freeze(['rewrite', 'prompt', 'modelswitch']);
