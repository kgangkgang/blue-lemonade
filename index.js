// Blue Lemonade · 블루 레몬에이드 — 실리태번 테마 확장 (폴더·설정 키는 예전 이름 salty 그대로)
import { getSettings, saveSettings } from './src/settings.js';
import { applyAll, dropStaleOverrides } from './src/apply.js';
import { startAssetWatcher, classifyAll } from './src/assets.js';
import { startPromptList } from './src/promptlist.js';
import { startCurrentMark } from './src/current.js';
import { startDangerMark } from './src/danger.js';
import { startCompactLayout } from './src/layout.js';
import { startNumberDisplay } from './src/numbers.js';
import { startNameMarquee } from './src/marquee.js';
import { startGutterWatch } from './src/gutter.js';
import { startSelectPop } from './src/selects.js';
import { startInlineTone, retoneAll } from './src/tone.js';
import { mountPanel, refreshPanels } from './src/panel.js';
import { deferPreviewRules, restorePreviewRules, deferredPreviewRuleCount, startMenuOpenMark, deferPanelHasRules, panelHasRuleCount, panelCssEnabled } from './src/lite.js';

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
    mountPanel(drawer.querySelector('.inline-drawer-content'));
}

// 버전 배지는 manifest.json 을 읽어서 적음 (버전을 코드에 두 번 적지 않게)
async function showVersion(badge) {
    if (!badge) return;
    try {
        const res = await fetch(new URL('./manifest.json', import.meta.url));
        const version = (await res.json())?.version;
        if (!version) return;
        badge.textContent = `v${version}`;
        badge.hidden = false;
    } catch (err) { /* 못 읽으면 배지 없이 그대로 */ }
}

async function openPopup() {
    restorePreviewRules();
    const ctx = SillyTavern.getContext();
    const wrap = document.createElement('div');
    wrap.style.textAlign = 'left';
    mountPanel(wrap, { popup: true });
    setTimeout(retoneAll, 400); // 정규식 카드 미리보기의 색 글자도 톤 맞춤 (tone.js)
    await ctx.callGenericPopup(wrap, ctx.POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true, okButton: '닫기' });
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
    item.addEventListener('click', openPopup);
    menu.appendChild(item);
}

// 테마는 가능한 한 빨리 (깜빡임 줄이기)
const settings = getSettings();
if (dropStaleOverrides(settings)) saveSettings();
applyAll();

// 콘솔·테스트용
window.Salty = { getSettings, applyAll, refreshPanels, openPopup, restorePreviewRules, deferredPreviewRuleCount, panelHasRuleCount, panelCssEnabled };

jQuery(() => {
    deferPreviewRules(); // 설정창 미리보기 전용 규칙은 설정창을 열 때까지 시트에서 빼 둠 (lite.js)
    deferPanelHasRules(); // 서랍 · 팝업 전용 :has() 규칙은 서랍 · 팝업이 열려 있을 때만 (lite.js, 2.8.4)
    startMenuOpenMark(); // ··· 메뉴가 열린 메시지에 bl-menu-open (style.css 의 :has() 대신, lite.js)
    mountDrawer();
    addMenuItem();
    startAssetWatcher();
    startPromptList(); // 검사 창 프롬프트 목록 줄을 세 조각으로 쪼갬 (CSS 로는 순서를 못 바꿈)
    startCurrentMark();
    startDangerMark();
    startCompactLayout();
    startNumberDisplay();
    startNameMarquee(); // 헬퍼 스크립트 이름: 눌러서 긴 이름 끝까지 보기
    startGutterWatch(); // 스크롤하는 칸에만 양쪽 스크롤바 홈 (PC)
    startSelectPop();   // select 를 테마가 그린 목록 팝업으로 (2.5.0)
    startInlineTone();  // 본문 글자색의 채도 · 밝기 맞춤 (2.6.0)
    $(document).on('change', 'input[data-toggle="chat.toneInline"], input[data-toggle="chat.unifyInline"]', () => setTimeout(retoneAll, 50));

    const { eventSource, event_types } = SillyTavern.getContext();
    eventSource.on(event_types.CHAT_CHANGED, () => setTimeout(classifyAll, 300));

    // 실리태번 쪽 설정이 바뀌면 설정 점검을 다시
    let refreshTimer = null;
    $(document).on('change input', '#chat_display, #hideChatAvatarsEnabled, #customCSS', () => {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refreshPanels, 400);
    });
});
