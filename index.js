import { startAddons, syncAddonIcons } from './src/addons.js';
// Blue Lemonade · 블루 레몬에이드 — 실리태번 테마 확장 (폴더·설정 키는 예전 이름 salty 그대로)
import { getSettings, saveSettings } from './src/settings.js';
import { applyAll, dropStaleOverrides } from './src/apply.js';
import { startAssetWatcher, classifyAll } from './src/assets.js';
import { startPromptList } from './src/promptlist.js';
import { startCurrentMark } from './src/current.js';
import { startDangerMark } from './src/danger.js';
import { startCompactLayout } from './src/layout.js';
import { startNameMarquee } from './src/marquee.js';
import { startGutterWatch } from './src/gutter.js';
import { startDraftKeep } from './src/draft.js';
import { startCardInk } from './src/cardink.js';
import { startSelectPop } from './src/selects.js';
import { startColorPop } from './src/colorpop.js';
import { startInlineTone, retoneAll } from './src/tone.js';
import { startStreamFade, streamFadeState } from './src/streamfade.js';
// 4.1.2: 설정 창(panel.js 와 거기에만 딸린 모듈 24개 · 310KB)은 설정 창을 처음 열 때 불러온다 — 시작할 때 읽는 모듈 64 → 40개.
let panelApi = null, panelLoading = null;
// 못 불러오면 기억을 지워 다음에 누를 때 다시 부른다 (실패한 약속을 붙들고 있으면 새로고침 전까지 서랍이 빈 채였다)
const loadPanel = () => panelLoading ||= import('./src/panel.js').then(api => (panelApi = api), (error) => { panelLoading = null; throw error; });
const panelFailed = () => toastr.warning('설정 창을 못 불러왔어요. 다시 누르거나 새로고침해 주세요.', 'Blue Lemonade');
const refreshPanels = (changes) => panelApi?.refreshPanels(changes); // 아직 안 불러왔으면 그려진 창도 없다
function noticeSeenChanged() {
    if (panelApi) return panelApi.noticeSeenChanged();
    const unseen = hasUnseenNotice();
    document.querySelectorAll('#salty-drawer .bl-version').forEach(badge => badge.classList.toggle('is-new', unseen));
}
import { loadVersion, hasUnseenNotice, openNotice } from './src/notice.js';
import { setFeatureHooks } from './src/features.js';
import { deferPreviewRules, restorePreviewRules, deferredPreviewRuleCount, startMenuOpenMark, startAnchorGate, widenSelectorCache, deferPanelHasRules, panelHasRuleCount, panelCssEnabled } from './src/lite.js';

function mountDrawer() {
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host || document.getElementById('salty-drawer')) return;
    const drawer = document.createElement('div');
    drawer.id = 'salty-drawer';
    drawer.className = 'inline-drawer';
    // 다른 확장들과 같은 머리 모양: 속찬 레몬 + 이름 + 버전 배지
    drawer.innerHTML = `
        <div class="inline-drawer-toggle inline-drawer-header">
            <b><i class="fa-solid fa-lemon"></i> Blue Lemonade <span class="bl-version ext-version" hidden></span></b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content"></div>`;
    host.prepend(drawer);
    showVersion(drawer.querySelector('.bl-version'));
    // 미리보기 CSS 는 서랍을 펼 때 되돌린다 (lite.js) — 실리태번의 토글 핸들러보다 먼저 받게 capture 로
    drawer.querySelector('.inline-drawer-toggle').addEventListener('click', restorePreviewRules, { capture: true });
    drawer.querySelector('.inline-drawer-toggle').addEventListener('click', () => setTimeout(retoneAll, 400)); // 서랍 미리보기도 톤 맞춤
    // 4.1.2: 서랍 속 설정 창은 처음 펼칠 때 만든다 — 닫힌 서랍 안에 시작할 때마다 통째로 그리고(버전 · 확장 기능 상태가 올 때마다 다시)
    // 미리보기 크기까지 재던 것 (폰 리그 시작 한 번에 0.45초). 실리태번의 토글 핸들러보다 먼저 받게 capture 로.
    const ensurePanel = async () => {
        const content = drawer.querySelector('.inline-drawer-content');
        if (!content || content.querySelector('.salty-panel') || drawer._blMounting) return;
        drawer._blMounting = true;
        try {
            const { mountPanel } = await loadPanel();
            if (!content.querySelector('.salty-panel')) mountPanel(content, { onFullscreen: () => openPopup(true) });
        } catch (error) { console.error('[Blue Lemonade] 설정 창을 불러오지 못했어요', error); panelFailed(); }
        finally { drawer._blMounting = false; }
    };
    drawer._blEnsurePanel = ensurePanel;
    drawer.querySelector('.inline-drawer-toggle').addEventListener('click', ensurePanel, { capture: true });
}

// 버전 배지는 manifest.json 을 읽어서 적음 (버전을 코드에 두 번 적지 않게)
// 3.0.0: 누르면 공지사항 — 안 본 업데이트가 있으면 빛남(is-new). 서랍 머리를 누른 것으로 치지 않게 전파를 막는다
async function showVersion(badge) {
    if (!badge) return;
    const version = await loadVersion();
    if (!version) return; // 못 읽으면 배지 없이 그대로
    badge.textContent = `v${version}`;
    badge.hidden = false;
    badge.classList.toggle('is-new', hasUnseenNotice());
    badge.setAttribute('role', 'button');
    badge.tabIndex = 0;
    badge.setAttribute('aria-label', '공지사항');
    const open = (event) => {
        event.preventDefault();
        event.stopPropagation();
        openNotice(noticeSeenChanged);
    };
    badge.addEventListener('click', open);
    badge.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') open(event); });
    refreshPanels(); // 설정 창이 버전을 읽기 전에 그려졌으면 알약을 붙여 다시 그림
}

async function openPopup(fullscreen = false, extension = null) {
    restorePreviewRules();
    const ctx = SillyTavern.getContext();
    let api;
    try { api = await loadPanel(); } catch (error) { console.error('[Blue Lemonade] 설정 창을 불러오지 못했어요', error); panelFailed(); return; }
    const { mountPanel, unmountPanel, setPanelFullscreen } = api;
    const wrap = document.createElement('div');
    wrap.style.textAlign = 'left';
    const panel = mountPanel(wrap, { popup: true });

    setTimeout(retoneAll, 400); // 정규식 카드 미리보기의 색 글자도 톤 맞춤 (tone.js)
    try {
        await ctx.callGenericPopup(wrap, ctx.POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true, okButton: false, onOpen: popup => {
    if(['words','capture'].includes(extension))panel.querySelector(`[data-act="editor-route"][data-tab="extensions"][data-sub="${extension}"]`)?.click();
            panel._onClose = () => popup.completeAffirmative();
            setPanelFullscreen(panel, fullscreen);
        } });
    } finally { unmountPanel(panel); }
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
}

// 테마는 가능한 한 빨리 (깜빡임 줄이기)
setFeatureHooks({ applyAll, refreshPanels }); // 켤 때만 불러오는 기능이 설정 적용 · 창 다시 그리기를 부를 수 있게 (3.1.0)
const settings = getSettings();
if (dropStaleOverrides(settings)) saveSettings();
applyAll();
loadVersion().then(() => refreshPanels()); // 설정 창 제목 옆 공지사항 알약에 쓸 버전 (3.0.0)

// 콘솔·테스트용
window.Salty = { ensureDrawerPanel: () => document.getElementById('salty-drawer')?._blEnsurePanel?.(), getSettings, applyAll, refreshPanels, openPopup, restorePreviewRules, deferredPreviewRuleCount, panelHasRuleCount, panelCssEnabled, streamFadeState };
window.addEventListener('bl:addons-state', () => refreshPanels());

jQuery(() => {
    widenSelectorCache(); // 실리태번의 위임 핸들러 선택자를 jQuery 가 매번 다시 컴파일하지 않게 (2.9.4, lite.js)
    deferPreviewRules(); // 설정창 미리보기 전용 규칙은 설정창을 열 때까지 시트에서 빼 둠 (lite.js)
    deferPanelHasRules(); // 서랍 · 팝업 전용 :has() 규칙은 서랍 · 팝업이 열려 있을 때만 (lite.js, 2.8.4)
    startMenuOpenMark(); // ··· 메뉴가 열린 메시지에 bl-menu-open (style.css 의 :has() 대신, lite.js)
    startAnchorGate();   // ≡ · ✦ 메뉴가 열려 있을 때만 입력판에 앵커 이름 (2.9.4, lite.js)
    mountDrawer();
    // 확장 서랍 · ✦ 메뉴를 여는 순간 설정 창 코드를 미리 받아 둔다 (테마 줄을 누를 때 기다리지 않게)
    for (const id of ['extensions-settings-button', 'extensionsMenuButton']) document.getElementById(id)?.addEventListener('pointerdown', () => { loadPanel().catch(() => {}); }, { capture: true, passive: true });
    syncAddonIcons();
    addMenuItem();
    startAssetWatcher();
    startPromptList(); // 검사 창 프롬프트 목록 줄을 세 조각으로 쪼갬 (CSS 로는 순서를 못 바꿈)
    startCurrentMark();
    startDangerMark();
    startCompactLayout();
    startNameMarquee(); // 헬퍼 스크립트 이름: 눌러서 긴 이름 끝까지 보기
    startGutterWatch(); // 스크롤하는 칸에만 양쪽 스크롤바 홈 (PC)
    startDraftKeep(); // 입력칸에 쓰다 만 글은 새로고침해도 남는다 (채팅마다 따로)
    startCardInk(); // 메시지 안 HTML 카드가 제 배경만 칠했을 때 글자색을 읽히게
    startSelectPop();   // select 를 테마가 그린 목록 팝업으로 (2.5.0)
    startColorPop();    // 색 칸을 테마 색 고르기로 (3.5.0)
    startInlineTone();  // 본문 글자색의 채도 · 밝기 맞춤 (2.6.0)
    startStreamFade();  // 스트리밍 중 새 글자만 가볍게 페이드 인 (2.9.5)
    $(document).on('change', 'input[data-toggle="chat.toneInline"], input[data-toggle="chat.unifyInline"]', () => setTimeout(retoneAll, 50));

    const { eventSource, event_types } = SillyTavern.getContext();
    eventSource.on(event_types.CHAT_CHANGED, () => setTimeout(classifyAll, 300));

    // 실리태번 쪽 설정이 바뀌면 설정 점검을 다시
    let refreshTimer = null;
    $(document).on('change input', '#chat_display, #hideChatAvatarsEnabled, #customCSS, #stream_fade_in', () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshPanels, 400);
    });
});

// Host modules finish evaluating after extensions load; do not hold that cycle open.
startAddons().catch(error => console.error('[Blue Lemonade] 확장 기능 시작', error));
