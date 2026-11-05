// 1.0.1 자동화 입구(window.Salty.module) — 검사 도구가 테마 모듈을 「같은 인스턴스」로 받는 길.
//   1.0.0 부터 브라우저가 받는 JS 는 dist/ 묶음(tools/build-bundle.mjs)이라 src/<모듈>.js 를 주소로 직접 import 하면 같은 코드의 두 번째 인스턴스가 생겨요
//   (설정 메모 · 애드온 상태 · 시트 표가 갈라져 창이 안 뜨거나 TTS 가 두 번 울려요). 여기 표의 import 는 묶음 도구가 테마 안 dynamic import 와 같은 조각으로 묶어요.
//   이름 = src/ 뒤 경로(.js 없이). 자동화가 새 화면 · 창을 열어야 하면 한 줄 더해요 — tools/tests/live-entry.mjs 가 「여는 함수(open…)가 있는데 표에 없는 모듈」을 잡아요.
//   애드온 본체(index.js)는 window.Salty.addon(id)(src/addons.js 실행 표)가 먼저예요 — 여기 표는 애드온 안 하위 창(perf 허브 · 저장 공간 · TTS 편집기 …)과 테마 기능 창용이에요.
import { addonRunning } from './addons.js';
/** 꺼졌거나 아직 안 도는 애드온의 본체 — 입구가 불러 시작시키지 않아요(본체를 받는 길은 window.Salty.addon(id)) */
const notRunning = id => Promise.reject(Error(`[Blue Lemonade] 살아 있는 입구: 지금 안 도는 애드온이에요: ${id}`));
const LIVE_MODULES = {
    // 설정 · 테마 기능 창
    'settings': () => import('./settings.js'),
    'settings-editor': () => import('./settings-editor.js'),
    'settings-search': () => import('./settings-search.js'),
    'settings-advanced': () => import('./settings-advanced.js'),
    'palettes': () => import('./palettes.js'),
    'notice': () => import('./notice.js'),
    'notice-actions': () => import('./notice-actions.js'),
    'credits': () => import('./credits.js'),
    'update-check': () => import('./update-check.js'),
    'log-copy-capture': () => import('./log-copy-capture.js'),
    'log-copy-sheet': () => import('./log-copy-sheet.js'),
    'log-copy-presets': () => import('./log-copy-presets.js'),
    'log-copy-sanitize': () => import('./log-copy-sanitize.js'),
    'log-copy-motion': () => import('./log-copy-motion.js'),   // 1.0.1 글꾸 움직임(openBox 는 창이 아니라 눌러 접는 상자 HTML 을 만들어요)
    'mart-import-ui': () => import('./mart-import-ui.js'),   // 1.0.1 「마트에서 가져오기」 창
    'extcheck/index': () => import('./extcheck/index.js'),   // 1.0.3 확장 충돌 검사 창(누를 때만 받는 도구)
    'fonts': () => import('./fonts.js'),   // 1.0.2 테마 글꼴 목록 — 개인 확장(글꼴 고르기)이 src/fonts.js 를 주소로 받으면 테마 모듈 묶음이 한 벌 더 생겨요(두 번째 인스턴스). 이 길로 같은 인스턴스를 받아요
    'quick/shared': () => import('./quick/shared.js'),   // 1.0.3 편의 기능 공용 떠 있는 메뉴(openMenu) · 이름 묻기
    // 검사 도구가 값 · 순수 함수를 읽는 모듈(여는 함수는 없어요)
    'addons': () => import('./addons.js'),
    'private-addons': () => import('./private-addons.js'),
    'usage-mode': () => import('./usage-mode.js'),
    'fruit-type-shortcuts': () => import('./fruit-type-shortcuts.js'),
    'fruit-type-snapshot': () => import('./fruit-type-snapshot.js'),
    'fruit-type-runtime': () => import('./fruit-type-runtime.js'),
    'num-width': () => import('./num-width.js'),
    'prompt-choice': () => import('./prompt-choice.js'),
    'frame-library': () => import('./frame-library.js'),
    'wi-help': () => import('./wi-help.js'),
    'wi-help-data': () => import('./wi-help-data.js'),
    'help-sheet': () => import('./help-sheet.js'),
    'capture-options': () => import('./capture-options.js'),
    'chat-graph-launcher': () => import('./chat-graph-launcher.js'),
    'colorpick': () => import('./colorpick.js'),
    'custompalette': () => import('./custompalette.js'),
    'diag-file': () => import('./diag-file.js'),
    'dialogue-view': () => import('./dialogue-view.js'),
    'first-run': () => import('./first-run.js'),
    'fruit-type-ui': () => import('./fruit-type-ui.js'),
    'mes-fold': () => import('./mes-fold.js'),
    'multi-avatar/dialog': () => import('./multi-avatar/dialog.js'),
    'prompt-card-picker': () => import('./prompt-card-picker.js'),
    'qrfind': () => import('./qrfind.js'),
    'qr-shelf': () => import('./qr-shelf.js'),   // 1.0.3 QR 책장 창(openQrShelf)
    'selects': () => import('./selects.js'),
    // 애드온 안 창(본체 index.js 는 Salty.addon(id))
    'addons/assets/index': () => addonRunning('assets') ? import('./addons/assets/index.js') : notRunning('assets'),
    'addons/assets/viewer': () => import('./addons/assets/viewer.js'),
    'addons/bookmarks/index': () => addonRunning('bookmarks') ? import('./addons/bookmarks/index.js') : notRunning('bookmarks'),
    'addons/bookmarks/panel': () => import('./addons/bookmarks/panel.js'),
    'addons/bookmarks/data': () => import('./addons/bookmarks/data.js'),
    'addons/bookmarks/excerpts': () => import('./addons/bookmarks/excerpts.js'),
    'addons/bookmarks/excerpt-editor': () => import('./addons/bookmarks/excerpt-editor.js'),
    'addons/bookmarks/image-viewer': () => import('./addons/bookmarks/image-viewer.js'),
    'addons/bookmarks/ui-kit': () => import('./addons/bookmarks/ui-kit.js'),
    'addons/bookmarks/viewers': () => import('./addons/bookmarks/viewers.js'),
    'addons/customstyle/index': () => addonRunning('customstyle') ? import('./addons/customstyle/index.js') : notRunning('customstyle'),
    'addons/direction/index': () => addonRunning('direction') ? import('./addons/direction/index.js') : notRunning('direction'),
    'addons/mermaid/index': () => addonRunning('mermaid') ? import('./addons/mermaid/index.js') : notRunning('mermaid'),
    'addons/models/panel': () => import('./addons/models/panel.js'),
    'addons/modelswitch/index': () => addonRunning('modelswitch') ? import('./addons/modelswitch/index.js') : notRunning('modelswitch'),
    'addons/modelswitch/jump': () => import('./addons/modelswitch/jump.js'),
    'addons/notes/index': () => addonRunning('notes') ? import('./addons/notes/index.js') : notRunning('notes'),
    'addons/notes/graph': () => import('./addons/notes/graph.js'),
    'addons/order/panel': () => import('./addons/order/panel.js'),
    'addons/perf/hub': () => import('./addons/perf/hub.js'),
    'addons/perf/panel': () => import('./addons/perf/panel.js'),
    'addons/perf/storage/boot': () => import('./addons/perf/storage/boot.js'),
    'addons/perf/storage/panel': () => import('./addons/perf/storage/panel.js'),
    'addons/perf/storage/status': () => import('./addons/perf/storage/status.js'),
    'addons/perf/storage/view': () => import('./addons/perf/storage/view.js'),
    'addons/prompt/index': () => addonRunning('prompt') ? import('./addons/prompt/index.js') : notRunning('prompt'),
    'addons/prompt-template/index': () => import('./addons/prompt-template/index.js'),
    'addons/regexlink/index': () => addonRunning('regexlink') ? import('./addons/regexlink/index.js') : notRunning('regexlink'),
    'addons/rewrite/index': () => addonRunning('rewrite') ? import('./addons/rewrite/index.js') : notRunning('rewrite'),
    'addons/translator/bridge': () => addonRunning('translator') ? import('./addons/translator/bridge.js') : notRunning('translator'),
    'addons/translator/index': () => addonRunning('translator') ? import('./addons/translator/index.js') : notRunning('translator'),
    'addons/translator/check-board': () => import('./addons/translator/check-board.js'),
    'addons/translator/translation-segments': () => import('./addons/translator/translation-segments.js'),
    'addons/translator/selection/book-transfer-ui': () => import('./addons/translator/selection/book-transfer-ui.js'),
    'addons/translator/selection/style-profile-ui': () => import('./addons/translator/selection/style-profile-ui.js'),
    'addons/translator/selection/ui': () => import('./addons/translator/selection/ui.js'),
    'addons/tts/index': () => addonRunning('tts') ? import('./addons/tts/index.js') : notRunning('tts'),
    'addons/tts/shell': () => import('./addons/tts/shell.js'),
    'addons/tts/src/script-editor': () => import('./addons/tts/src/script-editor.js'),
    'addons/tts/src/ui': () => import('./addons/tts/src/ui.js'),
    'addons/zipinstall/index': () => addonRunning('zipinstall') ? import('./addons/zipinstall/index.js') : notRunning('zipinstall'),
};
/** 표의 이름(src/ 뒤 경로 · .js 없이) — 자동화가 「이 판에 그 창이 있나」를 이것으로 물어요 */
export const liveModuleNames = () => Object.keys(LIVE_MODULES);
/** 같은 인스턴스의 모듈 — 표에 없으면 거절(자동화는 그 글자로 「입구에 없는 모듈」을 적어요) */
export function liveModule(name) {
    const key = String(name ?? '').replace(/^src\//, '').replace(/\.js$/, '');
    const load = LIVE_MODULES[key];
    if (!load) return Promise.reject(Error(`[Blue Lemonade] 살아 있는 입구에 없는 모듈: ${key}`));
    return load();
}
