// 9.0.9 애드온 CSS 한 장 (순수 모듈 · 빌드 tools/build-addon-css.mjs · 비교 tools/css-cascade-diff.mjs · 시험 tools/tests/addon-style-bundle.mjs)
// 애드온마다 <link> 하나씩(+ 애드온의 @import 조각들) 받던 스타일을, 켜진 애드온이 아래 목록과 꼭 같을 때(같은 순서) src/addons/style-addons.css 한 장으로 받아요.
//   목록 = addons.js startAddonsOnce 의 시작 순서에서 스타일을 따로 붙이는 번역(translator)만 뺀 것 — 내장 애드온을 전부 켠 설정과 같아요.
//   하나라도 꺼져 있거나(대기 중인 개인 애드온 포함) 순서가 다르면 예전처럼 한 장씩 — 끈 애드온의 규칙이 화면에 들어오면 안 되니까요.
// 한 장은 각 시트를 브라우저가 읽는 순서(@import 먼저 · 제자리)대로 이은 것에서 「뒤에 똑같은 규칙이 또 있는 앞 규칙」(공용 조각 checks-common · size · palette · num-comma 의 여러 벌)과
// 주석만 뺀 것이라, 규칙 순서 · 특이도가 그대로예요. css-cascade-diff 가 선택자별 최종 선언과 규칙 순서가 전후 같은지 확인해요(차이 0 이어야 빌드 · CI 통과).
export const ADDON_STYLE_BUNDLE = 'style-addons.css';   // src/addons/ 아래
export const ADDON_STYLE_IDS = Object.freeze(['perf', 'order', 'models', 'modelswitch', 'regexlink', 'rewrite', 'direction', 'bookmarks', 'notes', 'zipinstall', 'assets', 'prompt', 'prompt-template', 'customstyle', 'mermaid', 'tts']);
/** 스타일을 붙일 애드온 id 목록(시작 순서)이 한 장 목록과 꼭 같은가 */
export const bundleFits = ids => Array.isArray(ids) && ids.length === ADDON_STYLE_IDS.length && ids.every((id, i) => id === ADDON_STYLE_IDS[i]);
// 1.0.0 극한 최적화: 애드온 창 안에서만 쓰는 규칙을 뺀 첫 장(<시트>.boot.gen.css · 빌드 tools/build-addon-css.mjs)을 먼저 붙이고, 처음 누르거나 창이 뜨면(또는 서랍 · 창이 열리면) 전체 시트로 바꿔요.
//   id → 창 안 표시(바깥 사슬에 있으면 뺌) · 지킴(있으면 남김). 표에 없는 애드온은 작아서 그대로 전체 시트를 붙여요
export const ADDON_BOOT_CSS = Object.freeze({
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
