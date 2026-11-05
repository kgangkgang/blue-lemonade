// 1.0.2 블루레몬에이드 제로 — 설정 창에서 제로가 받지 않는 기능 칸을 회색으로 두고 「제로 모드에서 꺼짐」을 달아요.
//   저장값은 건드리지 않아요(사용 모드를 바꾸면 그대로 돌아와요). 기능 칸은 아래 경로 머리로 알아봐요 — 모양 칸(색 · 글꼴 · 말풍선 · 마크다운 …)은 그대로 둬요.
//   설정 창(panel.js)과 함께 받아요(시작 그래프 밖). 시험 tools/tests/zero-mode.mjs
import { zeroMode } from './usage-mode.js';

// 제로에서 꺼지는 기능의 설정 경로 머리 — 이 경로이거나 '머리.' 로 시작하면 기능 칸이에요
export const ZERO_OFF_PATHS = [
    'addons', 'addonUI', 'wordTools', 'captureTools', 'deus', 'sceneSound', 'reader', 'onehand', 'replyNotify', 'bgWindow', 'searchAi', 'logCopy', 'multiAvatar',
    'syncWatch', 'longpressHelp', 'koUi', 'headSwitchRows', 'fruitTypography', 'squareButtons', 'promptFolders', 'promptLink',
    'chat.weather', 'chat.demSkin', 'chat.demFold', 'chat.demInk', 'chat.demGlow', 'chat.triangleFold', 'chat.mesPins', 'chat.selectPop', 'chat.colorPop', 'chat.numComma',
    'chat.webSearchMarks', 'chat.showMoreAuto', 'chat.lazyAvatars', 'chat.searchIme', 'chat.codePlain', 'chat.worldInfoLight', 'chat.chatLight', 'chat.personaDefer',
    'chat.emptyGuard', 'chat.replyTop', 'chat.sentTokens', 'chat.streamFade', 'chat.inkContrast', 'chat.toneInline', 'chat.dialogueOnly', 'chat.qrFind', 'chat.qrFold', 'chat.qrCtxNames',
];
/** 그 설정 경로가 제로에서 꺼지는 기능인가 (chat.weather 는 chat.weatherLevel 같은 날씨 칸 전부) */
export function zeroOffPath(path) {
    const p = String(path || '');
    return ZERO_OFF_PATHS.some(head => p === head || p.startsWith(head + '.') || (head === 'chat.weather' && p.startsWith('chat.weather')) || (head === 'chat.demInk' && p.startsWith('chat.demInk')));
}
const CONTROL = '[data-toggle], [data-path], [data-range], [data-num], [data-color-path]';
const pathOf = el => el.dataset.toggle || el.dataset.path || el.dataset.range || el.dataset.num || el.dataset.colorPath || '';
export const ZERO_NOTE = '제로 모드에서 꺼짐';

/** 설정 창을 그린 뒤 부른다(panel.js render) — 제로가 아니면 아무것도 안 해요 */
export function markZeroOff(root, s) {
    if (!root || !zeroMode(s)) return 0;
    let marked = 0;
    for (const el of root.querySelectorAll(CONTROL)) {
        if (el.dataset.toggle === 'enabled' || !zeroOffPath(pathOf(el))) continue;
        el.disabled = true; el.setAttribute('aria-disabled', 'true');
        const row = el.closest('.salty-row, .salty-stack') || el.closest('.bl-addon-toggle') || el.closest('label') || el;   // 스위치 label 보다 줄을 먼저
        if (row.classList.contains('bl-zero-off')) continue;
        row.classList.add('bl-zero-off'); row.title = ZERO_NOTE; marked++;
        const label = row.querySelector(':scope > span');
        if (label && !label.querySelector('.bl-zero-note')) {
            const small = label.querySelector('small') || label.appendChild(document.createElement('small'));
            small.insertAdjacentHTML('afterbegin', `<b class="bl-rest-note bl-zero-note">${ZERO_NOTE}</b> `);
        }
    }
    const section = root.querySelector('.salty-sec');
    if (section && !section.querySelector('.bl-zero-banner')) section.insertAdjacentHTML('afterbegin', `<p class="salty-note bl-zero-banner" role="note"><b>블루레몬에이드 제로</b> — 모양만 켜져 있어요. 회색 칸은 제로에서 불러오지 않는 기능이에요(값은 그대로 보관). 테마 › 기타 설정 › 사용 모드에서 바꿔요.</p>`);
    return marked;
}
