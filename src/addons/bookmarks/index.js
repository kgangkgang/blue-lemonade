// 북마크 — 채팅 메시지 북마크. 단독 확장(chat-bookmarks)의 코드를 블루 레몬에이드 애드온으로 옮긴 것 (설정 칸 chaekgalpi · 자료 chat_metadata.favorites 는 그대로라 서로 이어진다)
import { verifyAddonCss } from '../../addon-files-check.js';
import { eventSource, event_types } from '../../../../../../../script.js';
import { VERSION, initSettings, hooks, applyColors, colorsFor, currentChatKey, iconName, settings, themeColors } from './state.js';
import { currentRecord, bookmarkAt, addBookmark, removeBookmark, syncAnchors } from './data.js';
import { openNoteEditor, previewRecord, isPreviewing, exitPreview, abandonPreviewForGeneration } from './viewers.js';

// 4.5.4: 모아 보기 창(panel.js 47KB + 그것만 쓰는 settings-view.js 17.7KB)은 창을 열 때 읽는다.
// 북마크 표시 · 메모 · 미리보기는 창 없이도 돌아가야 해서 index.js 는 그대로 시작할 때 읽힌다.
let panelPromise = null;
const panelModule = () => (panelPromise ??= import('./panel.js'));
export async function openPanel(...args) { return (await panelModule()).openPanel(...args); }
// 창을 아직 안 열었으면 알릴 곳이 없다 — 읽은 뒤에만 넘긴다
function notifyChatChanged() { if (panelPromise) panelPromise.then(m => m.onChatChanged()).catch(() => {}); }

initSettings();

const BUTTON_CLASS = 'cg-mes-btn';
const LONG_PRESS_MS = 550;

/** 미리보기 중이면 미리보는 채팅, 아니면 현재 채팅 */
function targetRecord() {
    return previewRecord() ?? currentRecord();
}

// ── 메시지 버튼 ─────────────────────────────────────────────

function ensureMessageButtons() {
    document.querySelectorAll('#chat .mes').forEach((mes) => {
        const buttons = mes.querySelector('.mes_block .ch_name .mes_buttons');
        if (!buttons || buttons.querySelector(`:scope > .${BUTTON_CLASS}`)) return;
        const button = document.createElement('div');
        button.className = `mes_button ${BUTTON_CLASS} fa-regular ${iconName()} interactable`;
        button.title = '북마크 (길게 누르면 메모)';
        button.tabIndex = 0;
        button.setAttribute('role', 'button');
        const anchor = buttons.querySelector(':scope > .mes_bookmark') ?? buttons.querySelector(':scope > .mes_edit');
        if (anchor) anchor.before(button);
        else buttons.append(button);
    });
}

function refreshMessageIcons() {
    ensureMessageButtons();
    const record = targetRecord();
    const marked = new Set((record?.favorites ?? []).map(fav => String(fav.messageId)));
    const icon = iconName();
    document.querySelectorAll(`#chat .mes .${BUTTON_CLASS}`).forEach((button) => {
        const isMarked = marked.has(String(button.closest('.mes')?.getAttribute('mesid')));
        button.classList.toggle('fa-solid', isMarked);
        button.classList.toggle('fa-regular', !isMarked);
        button.classList.toggle('is-marked', isMarked);
        if (!button.classList.contains(icon)) {
            button.classList.remove('fa-bookmark', 'fa-star');
            button.classList.add(icon);
        }
    });
    // 마법봉 메뉴의 아이콘도 메시지 아이콘 모양을 따라간다.
    const wandIcon = document.querySelector('#cg-wand-button .extensionsMenuExtensionButton');
    if (wandIcon && !wandIcon.classList.contains(icon)) {
        wandIcon.classList.remove('fa-bookmark', 'fa-star');
        wandIcon.classList.add(icon);
    }
}
hooks.refreshMessageIcons = refreshMessageIcons;

function messageIndexOf(button) {
    const index = Number.parseInt(button.closest('.mes')?.getAttribute('mesid') ?? '', 10);
    return Number.isInteger(index) ? index : null;
}

async function toggleFromButton(button) {
    const record = targetRecord();
    const index = messageIndexOf(button);
    if (!record || index === null) return;
    const existing = bookmarkAt(record, index);
    try {
        if (existing) await removeBookmark(record, existing.id);
        else await addBookmark(record, index);
    } catch (error) {
        toastr.error(error.message, '북마크');
    }
    refreshMessageIcons();
    if (!existing) {
        button.classList.remove('cg-pop');
        void button.offsetWidth;
        button.classList.add('cg-pop');
    }
}

async function noteFromButton(button) {
    const record = targetRecord();
    const index = messageIndexOf(button);
    if (!record || index === null) return;
    let fav = bookmarkAt(record, index);
    const createdNow = !fav;
    try {
        if (!fav) {
            fav = await addBookmark(record, index);
            refreshMessageIcons();
        }
        await openNoteEditor(record, fav, { createdNow });
    } catch (error) {
        toastr.error(error.message, '북마크');
    }
    refreshMessageIcons();
}

// 누르기 = 북마크 달기/떼기, 길게 누르기(PC는 우클릭) = 메모
// 안드로이드는 길게 누르면 타이머와 contextmenu가 둘 다 올 수 있어서, 메모 창은 잠깐 사이에 한 번만 열고
// 길게 누른 뒤 따라오는 click은 무시한다. (상태를 계속 들고 있지 않도록 시간으로만 판단한다)
const NOTE_GUARD_MS = 800;
let pressTimer = null;
let pressStart = null;
let lastNoteAt = 0;

function openNoteOnce(button) {
    const now = Date.now();
    if (now - lastNoteAt < NOTE_GUARD_MS) return;
    lastNoteAt = now;
    noteFromButton(button);
}

document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest?.(`.${BUTTON_CLASS}`);
    if (!button || event.button > 0) return;
    pressStart = { x: event.clientX, y: event.clientY };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
        pressTimer = null;
        openNoteOnce(button);
    }, LONG_PRESS_MS);
});

document.addEventListener('pointermove', (event) => {
    if (!pressTimer || !pressStart) return;
    if (Math.hypot(event.clientX - pressStart.x, event.clientY - pressStart.y) > 10) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
});

for (const type of ['pointerup', 'pointercancel']) {
    document.addEventListener(type, () => {
        clearTimeout(pressTimer);
        pressTimer = null;
    });
}

document.addEventListener('click', (event) => {
    const button = event.target.closest?.(`.${BUTTON_CLASS}`);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    // 길게 눌러 메모 창을 연 직후 따라오는 click은 무시한다.
    if (Date.now() - lastNoteAt < NOTE_GUARD_MS) return;
    toggleFromButton(button);
}, true);

// 안드로이드는 길게 누르면 contextmenu가 먼저 올 수 있다. 어느 쪽이 먼저 와도 메모 창은 한 번만 연다.
document.addEventListener('contextmenu', (event) => {
    const button = event.target.closest?.(`.${BUTTON_CLASS}`);
    if (!button) return;
    event.preventDefault();
    if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
    }
    openNoteOnce(button);
});

document.addEventListener('keydown', (event) => {
    const button = event.target.closest?.(`.${BUTTON_CLASS}`);
    if (!button || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    toggleFromButton(button);
});

// ── 마법봉 메뉴 ─────────────────────────────────────────────

function addWandButton(attempt = 0) {
    if (document.getElementById('cg-wand-button')) return;
    const container = document.getElementById('data_bank_wand_container') ?? document.getElementById('extensionsMenu');
    if (!container) {
        if (attempt < 20) setTimeout(() => addWandButton(attempt + 1), 500);
        return;
    }
    const item = document.createElement('div');
    item.id = 'cg-wand-button';
    item.className = 'list-group-item flex-container flexGap5 interactable';
    item.tabIndex = 0;
    item.title = '북마크 모아 보기';
    item.innerHTML = `<div class="fa-solid ${iconName()} extensionsMenuExtensionButton"></div><span>북마크</span>`;
    item.addEventListener('click', () => openPanel());
    container.append(item);
}

// ── 이벤트 ──────────────────────────────────────────────────

/**
 * 북마크 번호를 메시지에 맞추고(data.js syncAnchors), 지운 메시지의 북마크를 지웠으면 알린다.
 * 미리보기 중에는 채팅 화면에 다른 채팅이 그려져 있으니 하지 않는다 (끝내면 채팅을 다시 불러오며 맞춘다).
 */
function syncBookmarks() {
    if (isPreviewing()) return;
    const { removed, orphaned } = syncAnchors();
    if (removed) toastr.info(`지운 메시지에 달린 북마크 ${removed}개도 지웠어요.`, '북마크', { timeOut: 2500 });
    // 가지 · 체크포인트 파일은 원래 채팅의 북마크를 통째로 물려받는다 — 잘려 나간 메시지의 것
    if (orphaned) toastr.info(`이 채팅에 없는 메시지의 북마크 ${orphaned}개를 지웠어요.`, '북마크', { timeOut: 2500 });
}
hooks.syncBookmarks = syncBookmarks;

let iconTimer = null;
function scheduleIconRefresh(delay = 0) {
    clearTimeout(iconTimer);
    iconTimer = setTimeout(() => {
        syncBookmarks();
        refreshMessageIcons();
    }, delay);
}

eventSource.on(event_types.CHAT_CHANGED, async () => {
    if (isPreviewing()) await exitPreview({ reload: false });
    applyColors(colorsFor(currentChatKey()));
    syncBookmarks();
    notifyChatChanged();
    scheduleIconRefresh(120);
});

// 1.2.9: 미리보기 중에 답 만들기가 시작되면(다시 생성 · 이어 쓰기 · 슬래시 명령 등) 먼저 지금 채팅 화면으로 돌아간다 (viewers.js 참고).
// 속으로 도는 생성(번역 · 기억 같은 quiet)과 프롬프트 미리 계산(dryRun)은 화면을 건드리지 않으니 그대로 둔다.
eventSource.on(event_types.GENERATION_STARTED, async (type, _options, dryRun) => {
    if (dryRun || type === 'quiet' || !isPreviewing()) return;
    await abandonPreviewForGeneration();
});

eventSource.on(event_types.MESSAGE_DELETED, () => {
    syncBookmarks();
    scheduleIconRefresh();
});

// 메시지가 생기거나(/sendas at=, Tavern Helper의 끼워 넣기도 이 알림을 낸다) 바뀌면 북마크 번호를 확인한다.
for (const type of [event_types.MESSAGE_SENT, event_types.MESSAGE_RECEIVED, event_types.MESSAGE_SWIPED, event_types.MESSAGE_EDITED, event_types.MESSAGE_UPDATED]) {
    eventSource.on(type, syncBookmarks);
}
for (const type of [event_types.CHARACTER_MESSAGE_RENDERED, event_types.USER_MESSAGE_RENDERED, event_types.MORE_MESSAGES_LOADED, event_types.MESSAGE_SWIPED, event_types.MESSAGE_UPDATED]) {
    eventSource.on(type, () => scheduleIconRefresh(50));
}

// 블루 레몬에이드를 켜고 끄거나 에이드(팔레트)를 바꾸면 :root 변수와 body 클래스가 바뀐다 → 북마크 색 · 테마도 따라간다.
// applyColors도 :root 변수를 쓰니 여기로 다시 들어오지만, 테마 색이 그대로면 아무것도 하지 않아서 멎는다.
let themeSignature = null;
let themeTimer = null;
function syncThemeColors() {
    const signature = JSON.stringify([!!settings().followTheme, themeColors(), document.body.classList.contains('salty-dark')]);
    if (signature === themeSignature) return;
    themeSignature = signature;
    if (hooks.isPanelOpen()) hooks.refreshPanel({ keepPage: true });
    else applyColors(colorsFor(currentChatKey()));
}
hooks.syncThemeColors = syncThemeColors;

jQuery(() => {
    addWandButton();
    applyColors(colorsFor(currentChatKey()));
    syncBookmarks();
    refreshMessageIcons();

    const watchTheme = new MutationObserver(() => {
        clearTimeout(themeTimer);
        themeTimer = setTimeout(syncThemeColors, 120);
    });
    watchTheme.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
    watchTheme.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // 블루 레몬에이드는 팔레트 변수를 <head>의 <style id="salty-vars"> 글자로 써 넣는다 (html의 style 속성이 아님)
    watchTheme.observe(document.head, { childList: true, subtree: true, characterData: true });
    syncThemeColors();

    // 메시지 칸이 생기거나 빠지면 아이콘을 다시 달고 북마크 번호도 확인한다.
    // 편집 메뉴의 복사 · ↑↓ 옮기기, Tavern Helper의 메시지 지우기는 알림 없이 채팅 화면만 바꾼다.
    const chatElement = document.getElementById('chat');
    if (chatElement) {
        new MutationObserver(() => scheduleIconRefresh(30)).observe(chatElement, { childList: true });
    }

    // 폰 파일 앱은 압축을 풀 때 덮어쓰지 않고 'style (1).css'처럼 따로 저장해서 예전 파일이 남곤 한다.
    // style.css의 버전 표시가 코드와 다르면 알려 준다.
    verifyAddonCss({ folder: 'bookmarks', name: '--cg-css-version', version: VERSION, title: '북마크' });

    // 이전 확장이 같이 켜져 있으면 아이콘이 두 개가 되니 알려 준다 (데이터는 같아서 그대로 이어진다).
    setTimeout(() => {
        if (document.getElementById('favorites_button')) {
            toastr.warning('이전 “채팅 북마크” 확장이 켜져 있어요. 확장 관리에서 꺼 주세요. 북마크는 그대로 이어져요.', '북마크', { timeOut: 10000 });
        }
    }, 3000);
});

// ── 블루 레몬에이드 애드온 연결 (addons.js) ──────────────────
/** 테마 설정 창 안 칸: 북마크 창은 제 화면이 따로 있어 여는 단추만 둔다 */
export function mountInline(host) {
    host.innerHTML = '<p class="salty-note">메시지의 북마크 단추를 누르면 표시가 남고, 길게 누르면 메모를 적어요. 모아 보기는 ✦ 메뉴의 북마크로도 열려요.</p><button type="button" class="salty-btn bl-tool-primary">북마크 모아 보기</button>';
    host.querySelector('button').onclick = () => openPanel();
    return () => host.replaceChildren();
}
