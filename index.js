// Blue Lemonade · 블루 레몬에이드 — 실리태번 테마 확장 (폴더·설정 키는 예전 이름 salty 그대로)
// 부팅 3층(src/boot-layers.js): 정적 묶음은 설정·CSS 변수·글꼴·핵심 배치·요청 훅만 담아요.
// FRAME_LAYER는 첫 프레임 뒤, IDLE_LAYER는 덮개가 걷힌 뒤나 처음 쓸 때 받아요.
// 늦은 채팅 사건은 withReplay로 보완해요. 첫 화면 순서의 근거는 tools/tests/boot-layers.mjs에 있어요.
import { installUsageLedger } from './src/usage-ledger-lite.js';   // 7.4.0 사용량 장부 허브 — 다른 확장이 읽기 전에 (1.1.1 가볍게: 허브 · 설정 · 알림만, 장부 · 가격표 본체는 처음 쓸 때 받아요)
// 1.0.2 블루레몬에이드 제로(usage-mode.js zeroMode): 모양(CSS · 색 · 글꼴 · 말풍선)만 — 아래 ZERO 가 서 있으면 기능 모듈 · 감시자 · 요청 훅을 받지도 걸지도 않아요.
//   모드를 바꾸면 새로고침해요(설정 › 테마 › 기타 › 사용 모드). 시험 tools/tests/zero-mode.mjs
const ZERO = (() => { try { return zeroMode(getSettings()); } catch { return false; } })();
if (!ZERO) installUsageLedger();
// 6.6.9 진단 파일용 최근 오류 20줄 (diag-errors.js — 시작 그래프 밖)
if (!ZERO) import('./src/diag-errors.js').then(m => m.startErrorLog()).catch(() => {});
// 실리태번 판 호환: getContext().event_types 는 실리태번이 「옛 이름」으로 표시해 둔 것(새 이름 eventTypes). 그 이름이 빠진 판이 오면 새 이름을 옛 이름으로도
//   이어 붙여, 테마 모듈 30여 곳이 거는 사건 리스너(채팅 바뀜 · 설정 저장 · 생성 시작 …)가 조용히 빠지거나 시작 함수가 던지지 않게 한다. 둘 다 있는 지금 판에서는 아무것도 안 바꾼다.
try {
    const host = globalThis.SillyTavern, probe = host?.getContext?.();
    if (probe && probe.event_types === undefined && probe.eventTypes && !host.getContext.__blEventTypesAlias) {
        const original = host.getContext;
        const aliased = function (...args) { const ctx = original.apply(this, args); if (ctx && ctx.event_types === undefined) ctx.event_types = ctx.eventTypes; return ctx; };
        aliased.__blEventTypesAlias = true;
        host.getContext = aliased;
        console.warn('[Blue Lemonade] 이 실리태번 판에는 getContext().event_types 가 없어 eventTypes 로 이어 붙였어요');
    }
} catch { /* 그대로 */ }
// 공용 모델 목록(live-models.js)은 맨 위 await(실리태번 모듈 · 모델 등록 상태 받기)가 있어 정적 import 하면 테마 시작 전체가 그만큼 기다렸다 —
//   기다리지 않고 바로 받는다. 실리태번이 연결하며 받은 목록을 받아 두는 훅은 예전처럼 시작할 때 걸린다 (연결은 확장을 다 실은 뒤)
if (!ZERO) import('./src/live-models.js').catch(error => console.warn('[Blue Lemonade] 모델 목록', error));
import { themeEnabled, publicSettings, zeroMode } from './src/usage-mode.js';
import { bindSettingsDialog } from './src/settings-dialog.js';
import { loadRemainingFaces } from './src/fonts.js';
import { startAddons, syncAddonIcons, startLateAddons, lateReason, waitAddonModule } from './src/addons.js';
// 1.0.1 자동화 입구: 묶음 판에서 테마 모듈을 같은 인스턴스로(src/ 직접 import 는 두 번째 인스턴스) — 표는 처음 물을 때 받아요(시작 그래프 밖 · 사용자 화면은 안 써요)
const liveEntry = () => import('./src/live-entry.js');
const liveModule = name => liveEntry().then(m => m.liveModule(name));
const liveModuleNames = () => liveEntry().then(m => m.liveModuleNames());
import { installGenerateInterceptor } from './src/private-addons.js';
import { getSettings, saveSettings, invalidateSettings, FRESH_SETTINGS } from './src/settings.js';
// 설치 점검(판만): 처음 누르거나 칠 때(늦어도 60초) — build-info 48KB 가 부팅에서 빠져요
if (!ZERO) { let done = false; const go = () => { if (done) return; done = true; import('./src/install-health.js').then(m => m.checkInstallation()).catch(() => {}); }; const t = setTimeout(go, 60000); for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, e => { if (booting()) return; clearTimeout(t); go(); }, { once: true, capture: true, passive: true }); }
import { applyAll, syncReasoningOff } from './src/apply.js';
import { startCompactLayout, startFavoritesHeading } from './src/layout.js';
import { watchDom } from './src/dom-watch.js';   // 9.0.4 공용 감시 허브(lite.js 가 이미 시작 그래프에 올려요)
import { startMainChatRules } from './src/main-chat-rules.js';   // 1층: 본채팅 fetch 감싸기 — 성능 보조의 fetch 감싸기보다 먼저(예전 차례 그대로)
import { installedTouchMode } from './src/device-layouts.js';
import { afterFirstFrame, whenIdle, scheduleIdle, kickIdle, withReplay, idleReady, layerLog, lateSettled, onGate, fireGate, gateFired } from './src/boot-layers.js';
import { booting } from './src/boot-gate.js';

// 2 · 3층 모듈: 받은 것은 lazy[이름] 에 (설정 창 · 채팅 바뀜 리스너 · 콘솔이 아직 안 받은 모듈을 부르면 아무 일도 하지 않아요 — 받으면 지금 상태로 한 번 시작)
const lazy = {};
const retoneAll = () => lazy.tone?.retoneAll();   // 서랍 · 팝업 미리보기 톤 맞춤 (tone.js 가 2층에 붙기 전엔 맞출 글도 없어요)
// 4.1.2: 설정 창(panel.js 와 거기에만 딸린 모듈 24개 · 310KB)은 설정 창을 처음 열 때 불러온다 — 시작할 때 읽는 모듈 64 → 40개.
let panelApi = null, panelLoading = null;
// 못 불러오면 기억을 지워 다음에 누를 때 다시 부른다 (실패한 약속을 붙들고 있으면 새로고침 전까지 서랍이 빈 채였다)
// 1.1.6 설정 창(.salty-panel) 규칙은 첫 장 · 전체 장에 없고 src/panel.gen.css 에만 있어요 — 창을 만들기 전에 그 시트까지 받아요(못 받아도 창은 열어요)
const loadPanel = () => panelLoading ||= Promise.all([import('./src/panel.js'), panelCssReady()]).then(([api]) => (panelApi = api), (error) => { panelLoading = null; throw error; });
const panelFailed = () => toastr.warning('설정 창을 못 불러왔어요. 다시 누르거나 새로고침해 주세요.', 'Blue Lemonade');
const refreshPanels = (changes) => panelApi?.refreshPanels(changes); // 아직 안 불러왔으면 그려진 창도 없다
import { setFeatureHooks } from './src/features.js';
import { startThemeSettingsSync } from './src/settings-sync.js';
import { preloadPreviewCss, panelCssReady, scheduleSplitCss, loadSplitCss, splitCssReady, loadCompatCss, restorePreviewRules, deferredPreviewRuleCount, startMenuOpenMark, startAnchorGate, widenSelectorCache, deferPanelHasRules, panelHasRuleCount, panelCssEnabled } from './src/lite.js';

function mountDrawer() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || document.getElementById('salty-drawer')) return;
    const drawer = document.createElement('div');
    drawer.id = 'salty-drawer';
    drawer.className = 'inline-drawer';
    // 다른 확장들과 같은 머리 모양: 속찬 레몬 + 이름 — 판 알약 · ⓒ 는 3층(version-pill.js)이 붙여요 (1.0.0 바탕에서 되살림)
    drawer.innerHTML = `
        <div class="inline-drawer-toggle inline-drawer-header">
            <b><i class="fa-solid fa-lemon"></i> Blue Lemonade</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content"></div>`;
    host.prepend(drawer);
    // 미리보기 CSS 는 서랍을 펼 때 되돌린다 (lite.js) — 실리태번의 토글 핸들러보다 먼저 받게 capture 로
    drawer.querySelector('.inline-drawer-toggle').addEventListener('click', ()=>{restorePreviewRules();}, { capture: true });
    drawer.querySelector('.inline-drawer-toggle').addEventListener('click', () => setTimeout(retoneAll, 400)); // 서랍 미리보기도 톤 맞춤
    // 4.1.2: 서랍 속 설정 창은 처음 펼칠 때 만든다 — 닫힌 서랍 안에 시작할 때마다 통째로 그리고(버전 · 확장 기능 상태가 올 때마다 다시)
    // 미리보기 크기까지 재던 것 (폰 리그 시작 한 번에 0.45초). 실리태번의 토글 핸들러보다 먼저 받게 capture 로.
    const ensurePanel = async () => {
        const content = drawer.querySelector('.inline-drawer-content');
        if (!content || drawer._blMounting) return;
        const existing = content.querySelector('.salty-panel');
        if (existing) { existing._resetComparison?.(getSettings()); return; }
        drawer._blMounting = true;
        try {
            const { mountPanel } = await loadPanel();
            if (!content.querySelector('.salty-panel')) mountPanel(content, { onFullscreen: () => openPopup(true) });
        } catch (error) { console.error('[Blue Lemonade] 설정 창을 불러오지 못했어요', error); panelFailed(); }
        finally { drawer._blMounting = false; }
    };
    drawer._blEnsurePanel = ensurePanel;
    drawer.querySelector('.inline-drawer-toggle').addEventListener('click', ()=>{ensurePanel();}, { capture: true });
}

async function openPopup(fullscreen = false, extension = null) {
    const directCapture = extension === 'capture';
    if (!directCapture) restorePreviewRules();
    startLateAddons('설정 창'); fireGate('drawer');   // 설정 창의 애드온 카드가 실제 상태를 보이게
    const ctx = SillyTavern.getContext();
    let api;
    try { [api] = await Promise.all([loadPanel(), splitCssReady().catch(() => null)]); } catch (error) { console.error('[Blue Lemonade] 설정 창을 불러오지 못했어요', error); panelFailed(); return; }   // 1.0.0 두 장 빌드: 설정 창 CSS 는 둘째 장 — 같이 기다려요
    const { mountPanel, unmountPanel, setPanelFullscreen } = api;
    const wrap = document.createElement('div');
    wrap.style.textAlign = 'left';
    const panel = mountPanel(wrap, { popup: true, initialExtension: extension });
    const dialog = bindSettingsDialog(panel);

    if (!directCapture) setTimeout(retoneAll, 400); // 캡처는 이미 표시된 채팅을 쓰므로 전체 채팅을 다시 톤 맞추지 않는다.
    try {
        await ctx.callGenericPopup(wrap, ctx.POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true, okButton: false, onOpen: popup => {
            dialog.opened(popup);
            setPanelFullscreen(panel, fullscreen);
        } });
    } finally { dialog.closed(); unmountPanel(panel); refreshPanels(); }
}

function addMenuItem() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('salty-menu-item')) return;
    const item = document.createElement('div');
    item.id = 'salty-menu-item';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    // 옆 줄들과 같은 속찬 FA 레몬 — 20px 칸 안에서 크기·높이가 맞음
    item.innerHTML = `<div class="fa-fw fa-solid fa-lemon extensionsMenuExtensionButton"></div><span>Blue Lemonade</span>`;
    item.addEventListener('click', () => openPopup());
    menu.appendChild(item);
    // 7.2.1 요술봉의 「화면 모드」 항목은 뺐다 (사용자 요청) — 어디서도 화면 모드를 열지 않는다
}

// 테마는 가능한 한 빨리 (깜빡임 줄이기)
setFeatureHooks({ applyAll, refreshPanels }); // 켤 때만 불러오는 기능이 설정 적용 · 창 다시 그리기를 부를 수 있게 (3.1.0)
// 7.0.2 테마 설정(salty) 기기 간 합치기 — 탭이 오래 숨었다 돌아올 때 서버 값과 세 갈래로 합친다 (보관함이 다른 기기의 옛 탭 저장에 사라지지 않게)
startThemeSettingsSync({ getSalty: () => SillyTavern.getContext().extensionSettings?.salty, save: saveSettings, after: () => { invalidateSettings(); applyAll(); refreshPanels(); } });   // 9.0.2 합친 값은 제자리 — 정리 메모를 먼저 비운다 (settings.js)
const settings = getSettings();
// 6.9.0 실리태번 한국어 화면 다듬기 (ko-ui.js) — 언어가 한국어(ko · ko-kr, 7.7.9: 브라우저 언어가 'ko' 인 폰도)일 때만 표를 받는다. 끄기: 설정 koUi=false
//   1층: 실리태번이 화면을 그리기 전에 addLocaleData 로 표를 넣어야 해서 기다리지 않고 바로 받아요
//   제로는 공식 ko-kr.json 만 이어요(ko-locale-bridge.js)
try {
    const ko = /^ko(?:[-_]|$)/i.test(String(SillyTavern.getContext().getCurrentLocale?.() ?? ''));
    if (ZERO && ko) import('./src/ko-locale-bridge.js').then(m => m.startKoLocaleBridge()).catch(error => console.warn('[Blue Lemonade] 한국어 표', error));
    else if (ko && settings.koUi !== false) import('./src/ko-ui.js').then(m => m.startKoreanUi()).catch(error => console.warn('[Blue Lemonade] 한국어 화면', error));
} catch { /* 언어를 못 읽으면 그대로 */ }
// 5.3.4: 적용이 죽어도 아래 서랍 · 메뉴는 붙게 — 예전에는 값 하나가 깨지면 설정 창까지 안 떠 고칠 길이 없었다
try { applyAll(); } catch (error) { console.error('[Blue Lemonade] 시작할 때 설정 적용', error); }

// 콘솔·테스트용 (streamFadeState 는 streamfade.js 가 2층에 붙은 뒤부터 값이 있어요)
window.Salty = { lateAddons: () => lateReason, gate: name => fireGate(name), addon: id => waitAddonModule(id), module: liveModule, modules: liveModuleNames, ensureDrawerPanel: () => document.getElementById('salty-drawer')?._blEnsurePanel?.(), getSettings: () => publicSettings(getSettings()), themeOn: () => themeEnabled(getSettings()), applyAll, refreshPanels, openPopup, restorePreviewRules, deferredPreviewRuleCount, panelHasRuleCount, panelCssEnabled, streamFadeState: () => lazy.streamfade?.streamFadeState() ?? null, bootLayers: { idleReady, kickIdle, log: layerLog } };
window.addEventListener('bl:addons-state', () => refreshPanels());

// 실리태번 판 호환: 시작 함수 하나가 던져도(실리태번이 이름 · DOM 을 바꾼 판) 서랍 · 메뉴 · 나머지 기능 · 아래 감시와 안내는 그대로 시작한다.
//   예전에는 하나가 던지면 그 뒤가 전부 안 붙었다(테마 런타임은 started 표시가 이미 서 있어 다시 시도도 안 했다).
const startSafe = (name, start) => { try { return start(); } catch (error) { console.error(`[Blue Lemonade] 시작하지 못했어요(${name})`, error); } };
const isEnabled = () => themeEnabled(getSettings());
// [이름, 받기, 시작] — 받기는 같은 층 안에서 한꺼번에, 시작은 표 차례대로(예전 시작 차례 그대로). 하나가 못 받거나 던져도 나머지는 그대로 시작해요
//   시작이 약속을 돌려주면(로어북 연결 점검처럼 안에서 기다림) 그 끝까지(늦어도 3초) 이 층 다시 알림 창을 열어 둬요
// 표의 넷째 칸 = 문(drawer · input · press): 그 문을 처음 쓸 때만 받는 모듈(boot-layers onGate)
// 1.0.2 제로: 표에서 :has() 비용 고침 · 판 알약(자동 확인은 설정대로)만 — 나머지 2 · 3층 모듈은 받지 않아요
const ZERO_START = new Set(['rebaseBodyHasRules', 'startVersionPill']);
async function startLayer(layer, table) {
    if (ZERO) table = table.filter(e => ZERO_START.has(e[0]));
    const later = table.filter(e => e[3] && !gateFired(e[3]));
    if (later.length) {
        const byGate = new Map();
        for (const e of later) (byGate.get(e[3]) || byGate.set(e[3], []).get(e[3])).push(e);
        for (const [gate, list] of byGate) onGate(gate, () => { withReplay(`문 ${gate}`, () => startLayer(layer, list)).catch?.(() => {}); });
        table = table.filter(e => !later.includes(e));
        if (!table.length) { layerLog.push([layer, 'started', 0]); return; }
    }
    const loaded = await Promise.allSettled(table.map(([, load]) => load()));
    const running = [];
    table.forEach(([name, , start], i) => {
        const result = loaded[i];
        if (result.status === 'rejected') { console.warn(`[Blue Lemonade] 시작하지 못했어요(${name})`, result.reason); return; }
        startSafe(name, () => { const ran = start(result.value); if (ran && typeof ran.then === 'function') running.push(Promise.resolve(ran).catch(error => console.warn(`[Blue Lemonade] 시작하지 못했어요(${name})`, error))); });
    });
    if (running.length) await Promise.race([Promise.allSettled(running), new Promise(resolve => setTimeout(resolve, 3000))]);
    layerLog.push([layer, 'started', table.length]);
}
// 2층(첫 프레임 뒤 · 시작 덮개 아래) — 테마 화면이 켜져 있을 때. 채팅 · 메뉴 모양 감시라 첫 화면 전에 붙어야 모양이 한 번에 맞아요
const FRAME_LAYER = [
    ['startAssetWatcher', () => import('./src/assets.js'), m => { lazy.assets = m; m.startAssetWatcher(); }],
    ['startCurrentMark', () => import('./src/current.js'), m => { m.startCurrentMark(); }],
    ['startDangerMark', () => import('./src/danger.js'), m => { m.startDangerMark(); }],
    // 7.7.9 안내 창 「닫기」 하나 보장 + 실리태번 판 로그 · 8.2.3 세로 스크롤 칸의 넘친 쪽 흐림(scroll-fade.js — 새 팝업은 이 감시자에 얹고, 바이바이가 켜져 있으면 월드인포 목록은 쉼)
    ['startPopupGuard', () => import('./src/popup-guard.js'), m => {
        m.startPopupGuard();
        import('./src/scroll-fade.js').then(({ installScrollFade, baibaiPresence }) => baibaiPresence().then(presence => {
            const fade = installScrollFade(document, { resting: feature => feature === 'worldInfo' && presence.baibai() });
            if (!fade) return;
            m.onPopupAdded(dialog => { fade.scan(dialog); setTimeout(() => { if (dialog.isConnected) fade.scan(dialog); }, 600); });
            presence.onChange(() => fade.refreshResting());
        })).catch(error => console.warn('[Blue Lemonade] 스크롤 흐림', error));
    }],
    ['startNumberWidth', () => import('./src/num-width.js'), m => { m.startNumberWidth(); }, 'drawer'],   // 7.7.9 애드온 창 · 팝업 숫자칸 유동 폭(--bl-num-ch)
    ['startGroupGrid', () => import('./src/group-grid.js'), m => { m.startGroupGrid(); }, 'drawer'],   // 7.7.9 단추 묶음 · 짧은 체크 묶음 2열 격자
    ['startIconTextMark', () => import('./src/icon-text.js'), m => { m.startIconTextMark(); }],   // 아이콘 + 맨 글자 .menu_button 은 아이콘 버튼 규칙에서 뺀다 (CSS 는 글자 노드를 못 봄)
    ['startGutterWatch', () => import('./src/gutter.js'), m => { m.startGutterWatch(); }],   // 스크롤하는 칸에만 양쪽 스크롤바 홈 (PC)
    ['startDraftKeep', () => import('./src/draft.js'), m => { m.startDraftKeep(); }],   // 입력칸에 쓰다 만 글은 새로고침해도 남는다 (채팅마다 따로 — 늦게 붙어도 지금 채팅으로 한 번)
    ['startCardInk', () => import('./src/cardink.js'), m => { m.startCardInk(); }],   // 메시지 안 HTML 카드가 제 배경만 칠했을 때 글자색을 읽히게
    // 8.2.7 메시지 class 의 같은 값 쓰기를 브라우저까지 보내지 않아 keyboard.js 감시가 메시지를 다시 훑지 않게 (mes-class-quiet.js)
    ['startMesClassQuiet', () => import('./src/mes-class-quiet.js'), m => { m.startMesClassQuiet(); }],
    ['startSelectPop', () => import('./src/selects.js'), m => { m.startSelectPop(); }, 'press'],   // select 를 테마가 그린 목록 팝업으로 (2.5.0)
    ['startColorPop', () => import('./src/colorpop.js'), m => { m.startColorPop(); }, 'drawer'],   // 색 칸을 테마 색 고르기로 (3.5.0)
    ['startInlineTone', () => import('./src/tone.js'), m => { lazy.tone = m; m.startInlineTone(); }],   // 본문 글자색의 채도 · 밝기 맞춤 (2.6.0)
    ['startStreamFade', () => import('./src/streamfade.js'), m => { lazy.streamfade = m; m.startStreamFade(); }],   // 스트리밍 중 새 글자만 가볍게 페이드 인 (2.9.5)
    ['startStreamFollow', () => import('./src/stream-follow.js'), m => { m.startStreamFollow(); }],   // 새 글 뒤에 늦게 온 scroll 이벤트가 자동 스크롤을 잠그지 않게
    ['startReadingResume', () => import('./src/reading-resume.js'), m => { m.startReadingResume({ isEnabled }); }],
    ['classifyAll', () => import('./src/assets.js'), m => { m.classifyAll(); }],
];
// 3층(덮개가 걷힌 뒤 유휴 · 처음 쓸 때 당김) — 테마 화면이 켜져 있을 때. 누르거나 열어야 쓰는 것
const IDLE_LAYER = [
    ['startPromptList', () => import('./src/promptlist.js'), m => { m.startPromptList(); }, 'drawer'],   // 검사 창 프롬프트 목록 줄을 세 조각으로 쪼갬 (CSS 로는 순서를 못 바꿈)
    ['installWheelX', () => import('./src/wheel-x.js'), m => { m.installWheelX(); }],   // 8.2.3 가로로만 넘치는 칸은 Shift 없이 휠로
    ['startNameMarquee', () => import('./src/marquee.js'), m => { m.startNameMarquee(); }, 'drawer'],   // 헬퍼 스크립트 이름: 눌러서 긴 이름 끝까지 보기
    // 당겨 새로고침은 홈 화면에 깐 터치 앱에서만 — 그 밖(PC · 브라우저 탭)에서는 파일도 받지 않는다 (device-layouts.js installedTouchMode)
    ['startPullToRefresh', () => installedTouchMode(window) ? import('./src/pull-to-refresh.js') : Promise.resolve(null), m => m?.startPullToRefresh({ isEnabled: () => isEnabled() && document.body.classList.contains('salty') })],
    ['startNaturalSlash', () => import('./src/natural-slash.js'), m => { m.startNaturalSlash({ isEnabled }); }, 'input'],
    ['startWorldInfoHelp', () => import('./src/wi-help.js'), m => { m.startWorldInfoHelp(); }, 'drawer'],   // 6.1.5 월드인포 설정 · 항목 칸 옆 ? 도움말
    ['startLongpressHelp', () => import('./src/longpress-help.js'), m => { m.startLongpressHelp({ isEnabled: () => { const s = getSettings(); return s.longpressHelp !== false && themeEnabled(s); } }); }],   // 8.1.2 단추 길게 누르면 설명 — 사전은 처음 길게 누를 때만
    ['startLogCopy', () => import('./src/log-copy.js'), m => { m.startLogCopy({ isEnabled: () => { const s = getSettings(); return s.logCopy?.on !== false && themeEnabled(s) && document.body.classList.contains('salty'); } }); }],   // 로그 복사: 채팅에서 고른 글을 보이는 그대로 (고른 글 도구 줄 · 시트는 처음 누를 때)
    ['startWebSearchMarks', () => import('./src/websearch.js'), m => { m.startWebSearchMarks(); }],   // 6.2.6 웹 검색을 쓴 답에 지구 표시 · 낱말 꾹 눌러 출처
    ['startWorldInfoLinkMark', () => import('./src/wi-link.js'), m => m.startWorldInfoLinkMark()],   // 캐릭터 로어북 연결이 빠지면 책 아이콘에 빨간 점
    ['startSwipePickerTranslation', () => import('./src/swipe-picker-launch.js'), m => { m.startSwipePickerTranslation(); }],   // 6.9.7 스와이프 고르기 창 미리보기에 번역문 (본 모듈은 창을 여는 단추를 누를 때)
    ['startAddonTouchSliders', () => import('./src/touch-sliders.js'), m => { m.startAddonTouchSliders(); }, 'drawer'],   // 8.2.7 폰: 애드온 · 도구 창 슬라이더 위에서 시작한 세로 스크롤이 값을 바꾸지 않게
    ['startChatGraph', () => import('./src/chat-graph-launcher.js'), m => { m.startChatGraph(); }, 'drawer'],   // 채팅 파일 관리: 목록 / 분기 지도
];
// 테마 화면 켬과 상관없는 2 · 3층
const BOOT_FRAME = [
    // 8.0.7 작가 노트 「페르소나 위치」 · 「캐릭터 설명 위치」 — 테마 화면 켜짐과 따로(확장만 모드에서도), 테마를 끄면 본체 위치로 (an-anchor.js)
    ['startNoteAnchor', () => import('./src/an-anchor.js'), m => { m.startNoteAnchor(); }],
    // 8.2.4 가운데 서랍을 한 번 열면 body 가 :has() 기준이 되어 프롬프트 토글 · 채팅 변화마다 메시지 요소 전부를 다시 계산했다 (st-has-anchor.js)
    ['rebaseBodyHasRules', () => import('./src/st-has-anchor.js'), m => { m.rebaseBodyHasRules(); }],
];
const BOOT_IDLE = [
    ['registerExtcheckCommand', () => import('./src/natural-slash.js'), m => { m.registerExtcheckCommand(); }, 'input'],   // 1.0.3 /extconflict
    // 1.0.0 바탕: 확장 서랍 머리의 판 알약(공지 · 새 판) · ⓒ(출처 · 라이선스) — 문서 단위 누름 받기와 8초 뒤 새 판 확인 (src/version-pill.js)
    ['startVersionPill', () => import('./src/version-pill.js'), m => { m.startVersionPill(); }, 'drawer'],
    ['startTabScroll', () => import('./src/tab-scroll-init.js'), () => {}, 'drawer'],   // 애드온 창 · 도구 창의 가로 탭 줄 스크롤 (불러오면 걸어요)
    ['registerStorageReport', () => import('./src/storage-report.js'), m => { m.registerStorageReport(); }, 'drawer'],   // 7.4.0 저장 공간 보고 다리에 등록
    // 6.9.9 프롬프트 템플릿(ST-Prompt-Template) 설정 블록: 한국어 표 · 머리글 아이콘 — 블록이 없으면 몇 번 찾고 끝 (src/prompt-template-host.js)
    ['startPromptTemplateHost', () => import('./src/prompt-template-host.js'), m => { m.startPromptTemplateHost({ koUi: settings.koUi }); }, 'drawer'],
];

jQuery(() => {
    // 6.9.5 첫 실행 안내 · 7.2.6 「쓰던 테마가 있어요」 (first-run.js — 조건이 맞을 때만 받아요)
    const later = (fn, ms) => { const go = () => setTimeout(fn, ms); try { const { eventSource, event_types } = SillyTavern.getContext(); if (document.getElementById('loader')) eventSource.once(event_types.APP_READY, go); else go(); } catch { go(); } };
    if (FRESH_SETTINGS) {
        later(() => import('./src/first-run.js').then(m => m.openFirstRunWhenFree()).catch(error => console.warn('[Blue Lemonade] 처음 설정 안내', error)), 900);
    } else {
        later(() => {
            try { const s = getSettings(); if (s.enabled === false || (s.usageMode || 'both') !== 'both' || s.compat?.muteCustomCss || !String(SillyTavern.getContext().powerUserSettings?.custom_css || '').trim()) return; } catch { return; }
            import('./src/first-run.js').then(m => m.openCssPromptWhenFree()).catch(error => console.warn('[Blue Lemonade] 쓰던 테마 안내', error));
        }, 1500);
    }
    // 1.2.x 남의 확장 화면 맞춤: 확인한 확장(미트볼 상태창)의 설정 칸이 있을 때만 모듈 · 시트를 받아요 — 없으면 아무것도 안 받아요.
    //   지난번에 그 확장의 설정 칸이 화면에 있었으면(이 기기 표시) 바로 받아 첫 화면부터 맞춤 시트가 붙어요. 앱이 준비된 뒤 한 번(못 봤으면 조금 뒤 한 번 더) 설정 칸이 실제로 있는지 보고 표시를 고쳐요 —
    //   그 확장을 지운 사람은 그다음 시작부터 아무것도 안 받아요(감시자 없음 · src/ext-compat.js SETS 와 같은 선택자 · 제로 모드는 안 받음). 받은 뒤에도 설정 칸을 보면 모듈을 한 번 더 불러 탭 · 머리줄 표식을 그때 달아요.
    //   실리태번은 확장을 깔면 새로 읽지 않아요 — 그 뒤 내는 「확장 설정 읽음」 사건에서 아직 안 받았으면 한 번 더 봐요(되풀이 없음 · 깐 그 세션에도 맞춤이 걸려요)
    if (!ZERO) { const KEY = 'bl-ext-compat'; let got = null; const go = () => { (got ||= import('./src/ext-compat.js')).then(m => m.startExtCompat()).catch(error => console.warn('[Blue Lemonade] 확장 화면 맞춤', error)); }; try { if (localStorage.getItem(KEY) === '1') go(); } catch { /* 저장소가 막혀 있으면 아래 확인만 */ } const look = again => { const here = !!document.getElementById('ss-settings'); if (!here && again) { setTimeout(() => look(false), 2500); return; } try { if (here) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* 표시 없이 */ } if (here) go(); }; later(() => { look(true); try { const { eventSource, event_types } = SillyTavern.getContext(); eventSource.on(event_types.EXTENSION_SETTINGS_LOADED, () => { if (!got) look(true); }); } catch { /* 다음 시작에 봐요 */ } }, 400); }
    // 1층 — 서랍 · 메뉴 입구와 CSS 바로잡기(:has 미루기 · 메뉴 열림 표식)는 바로
    if (!ZERO) startSafe('widenSelectorCache', () => { widenSelectorCache(); }); // 실리태번의 위임 핸들러 선택자를 jQuery 가 매번 다시 컴파일하지 않게 (2.9.4, lite.js)
    startSafe('loadCompatCss', () => { if (!loadCompatCss()) setTimeout(() => startSafe('loadCompatCss', loadCompatCss), 1500); });   // 1.0.0 다른 브라우저 · 폭 규칙은 조건이 맞을 때만 (src/compat-css.js)
    // 11-03: 3층 뒤 쉴 때 서랍 문 → 늦은 애드온 → 누름 문 → 남은 글꼴 조각(fonts.js) 차례로(처음 여는 서랍이 떠안던 것)
    const idleLater = fn => { if (typeof requestIdleCallback === 'function') requestIdleCallback(fn, { timeout: 4000 }); else setTimeout(fn, 1500); };
    // 글꼴 조각(fonts.js loadRemainingFaces): 안 받은 조각이 남아 있으면 그 글꼴을 쓰는 글 전부가 「받는 중 대체」라, 다른 글꼴이 받힐 때마다(설정 서랍 첫 열기의 실리태번 고정폭 글꼴) 긴 채팅 전체를 다시 배치했어요 — 쉴 때 다 받아 두면 그 뒤엔 없어요
    const warmDrawers = () => { fireGate('drawer', { cascade: false }); idleLater(() => { startLateAddons('쉴 때'); idleLater(() => { fireGate('press'); idleLater(() => { loadRemainingFaces(); }); }); }); };
    startSafe('scheduleSplitCss', () => { scheduleSplitCss({ after: idleReady, then: warmDrawers }); });   // 11-03: 3층 뒤 쉴 때 둘째 장 → 서랍 문 모듈(처음 여는 서랍이 떠안던 것) // 9.0.1 --split 빌드면 첫 화면에 안 쓰는 CSS(src/style-lazy.gen.css)를 쉴 때 (lite.js · 기본 한 장 빌드면 할 일 없음)
    startSafe('deferPanelHasRules', () => { deferPanelHasRules(); }); // 서랍 · 팝업 전용 :has() 규칙은 서랍 · 팝업이 열려 있을 때만 (lite.js, 2.8.4)
    startSafe('startMenuOpenMark', () => { startMenuOpenMark(); }); // ··· 메뉴가 열린 메시지에 bl-menu-open (style.css 의 :has() 대신, lite.js)
    startSafe('startAnchorGate', () => { startAnchorGate(); });   // ≡ · ✦ 메뉴가 열려 있을 때만 입력판에 앵커 이름 (2.9.4, lite.js)
    startSafe('mountDrawer', () => { mountDrawer(); });
    // 확장 서랍 · ✦ 메뉴를 여는 순간 설정 창 코드 · 미리보기 CSS · 둘째 장 · 3층을 당겨요
    for (const id of ['extensions-settings-button', 'extensionsMenuButton']) for (const type of ['pointerdown', 'click']) document.getElementById(id)?.addEventListener(type, () => { loadPanel().catch(() => {}); preloadPreviewCss(); loadSplitCss(); kickIdle('서랍'); startLateAddons('확장 서랍 · ✦ 메뉴'); fireGate('drawer'); }, { capture: true, passive: true });
    // 상단 서랍 아이콘을 눌러도 둘째 장을 붙여요
    for (const type of ['pointerdown', 'click']) document.getElementById('top-settings-holder')?.addEventListener(type, e => { if (booting()) return; loadSplitCss(); kickIdle('서랍'); startLateAddons('상단 서랍'); fireGate('drawer'); }, { capture: true, passive: true });   // 늦은 애드온(재작성 · 한글화 패널 · 모델 전환)도 처음 쓸 때
    // 9.0.2 입력칸을 누르거나 치기 시작하면 3층을 당겨요 — 보내기 전에 애드온(정규식 연동 · 생성 전 훅 …)이 붙게 (실리태번이 시작할 때 거는 포커스로는 당기지 않아요)
    if (!ZERO) for (const type of ['pointerdown', 'keydown']) document.getElementById('send_textarea')?.addEventListener(type, e => { if (booting()) return; kickIdle('입력'); startLateAddons('입력'); fireGate('input'); }, { passive: true });
    if (!ZERO) for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, () => { if (booting() || gateFired('press')) return; fireGate('press'); }, { capture: true, passive: true });
    startSafe('syncAddonIcons', () => { syncAddonIcons(); });
    startSafe('addMenuItem', () => { addMenuItem(); });
    afterFirstFrame(() => withReplay('2층', () => startLayer(2, BOOT_FRAME)));
    whenIdle('3층', () => withReplay('3층', () => startLayer(3, BOOT_IDLE)));
    // 1.0.0 사용 모드 되살림: 확장만 · 테마 끔일 때의 판 불투명 · 테마 클래스 지킴이 · 실리태번 설정 되돌리기 알림 (src/theme-off.js — 시작 그래프 밖)
    whenIdle('테마 끔 보정', () => import('./src/theme-off.js').then(m => m.startThemeOff()).catch(error => console.warn('[Blue Lemonade] 테마 끔 보정', error)));
    let themeRuntimeStarted = false;
    const startThemeRuntime = () => {
        if (themeRuntimeStarted || !themeEnabled(getSettings())) return;
        themeRuntimeStarted = true;
        if (!ZERO) startSafe('startCompactLayout', () => { startCompactLayout(); });   // 제로: 입력판 · 서랍 배치(DOM 옮기기 · 슬라이더 붙이기)는 실리태번 그대로   // 1층: 입력판 · 서랍 · 퀵 리플라이 배치
        else startSafe('startFavoritesHeading', () => { startFavoritesHeading(); });   // 제로도 즐겨찾기 머리 줄(모양)
        // 2층 다시 알림 창은 켜 둔 기능 모듈(features.js · apply.js 가 첫 프레임 뒤 받음)의 시작까지 덮어요
        afterFirstFrame(() => withReplay('테마 2층', async () => { await startLayer(2, FRAME_LAYER); await lateSettled(); }));
        whenIdle('테마 3층', () => withReplay('테마 3층', async () => { await startLayer(3, IDLE_LAYER); await lateSettled(); }));
    };
    $(document).on('change', 'input[data-toggle="chat.toneInline"], input[data-toggle="chat.unifyInline"]', () => setTimeout(retoneAll, 50));
    if (!ZERO) startSafe('classifyOnChatChanged', () => {
        const { eventSource, eventTypes, event_types = eventTypes } = SillyTavern.getContext();   // event_types 는 실리태번이 옛 이름으로 표시해 둔 것 — 빠진 판이면 새 이름으로
        eventSource.on(event_types.CHAT_CHANGED, () => setTimeout(() => lazy.assets?.classifyAll(), 300));   // 그림 분류(assets.js)가 2층에 붙기 전이면 붙을 때 전체를 한 번 분류해요
    });
    startThemeRuntime();
    // 9.0.4: 테마가 아직 꺼져 있을 때만 body class 를 봐요(공용 감시 허브) — 한 번 시작하면 끊어요(예전엔 시작 뒤에도 class 가 바뀔 때마다 불렀어요)
    if (!themeRuntimeStarted) { const offStart = watchDom(document.body, { attributes: ['class'], name: '테마 켜기 기다림' }, () => { startThemeRuntime(); if (themeRuntimeStarted) offStart(); }); }
    // 5.7.5 실리태번 「모델 추론 요청」 · API · 공급자가 바뀌면 지난 추론 숨기기 클래스만 다시 (프리셋을 바꿀 때도 실리태번이 input 을 쏜다 — jQuery trigger 라 jQuery 로 받는다)
    $(document).on('input change', '#openai_show_thoughts, #main_api, #chat_completion_source', syncReasoningOff);
    try { const { eventSource, event_types } = SillyTavern.getContext(); if (event_types.SETTINGS_LOADED) eventSource.on(event_types.SETTINGS_LOADED, syncReasoningOff); } catch { /* 이벤트가 없으면 시작 때 applyAll 값 그대로 */ }
    // 실리태번 쪽 설정이 바뀌면 설정 점검을 다시
    let refreshTimer = null;
    $(document).on('change input', '#chat_display, #hideChatAvatarsEnabled, #customCSS, #stream_fade_in', (event) => {
        // 5.1.2: 커스텀 CSS 를 치는 동안(input)은 그 보고서가 보이는 화면(채팅 › 기타)일 때만 — 400ms 마다 설정 창 전체를 다시 그렸다. 다 치고 나면(change) 그대로
        if (event.type === 'input' && event.target.id === 'customCSS' && !panelApi?.panelShows('chat', 'etc')) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshPanels, 400);
    });
});

// 5.8.0 본채팅 요청의 Claude 5 세대 규칙 (본체가 claude-haiku-5-5 를 Claude 5 로 모르는 동안) — 테마 화면 켜짐 · 제로와 상관없이
try { startMainChatRules(); } catch (error) { console.error('[Blue Lemonade] 본채팅 규칙 시작', error); }   // 던져도 아래 애드온 시작은 그대로

/// 8.3.0 생성 전 훅 창구(manifest generate_interceptor) — 내장 확장이 Symbol.for('blue-lemonade.generate') Set 에 넣은 훅을 차례로 부른다
//   9.0.2 애드온 본체가 3층(유휴)에 붙기 전에 생성이 시작되면 3층을 당겨 훅이 다 걸린 뒤(늦어도 8초) 부른다
const ADDON_WAIT_MS = 8000;
if (!ZERO) try { installGenerateInterceptor(globalThis, { before: () => Promise.race([kickIdle('생성').then(() => startLateAddons('생성')), new Promise(resolve => setTimeout(resolve, ADDON_WAIT_MS))]) }); } catch (error) { console.error('[Blue Lemonade] 생성 전 훅 창구', error); }
// Host modules finish evaluating after extensions load; do not hold that cycle open.
//   9.0.2 성능 보조는 바로(fetch 감싸기 · 요청 로그), 애드온 스타일은 2층, 나머지 애드온 본체는 3층
startAddons({ afterFirstFrame, whenIdle, withReplay, lateSettled }).catch(error => console.error('[Blue Lemonade] 확장 기능 시작', error));
scheduleIdle();
