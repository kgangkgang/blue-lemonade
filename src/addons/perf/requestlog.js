// 요청 로그 (Request Log)
// 실리태번과 확장이 보내는 API 요청을 모두 기록한다. 프롬프트·응답·오류를 다시 보고, 토큰과 비용을 날짜·모델별로 모아 본다.
// 기록은 이 기기의 브라우저(IndexedDB)에만 남는다.
import { eventSource, event_types } from '../../../../../../../script.js';
import { TITLE, VERSION, FOLDER, initSettings } from './state.js';
import { installCapture, setGenerationType, clearGenerationType, beginSendTrace, markSend } from './capture.js';
import { buildDrawer, mountWandButton, openDialog } from './panel.js';
import { trimEntries } from './store.js';
import { refresh as refreshBudget, refreshSoon as refreshBudgetSoon } from './budget.js';

initSettings();
// 다른 확장보다 먼저 fetch를 감싸야 그 확장의 요청도 잡힌다 (loading_order가 낮다).
installCapture();

function toast(kind, message, options = {}) {
    if (typeof toastr !== 'undefined') toastr[kind](message, TITLE, options);
}

// 채팅 생성의 종류(보내기·스와이프·이어쓰기 …)를 기억해 두었다가 기록에 붙인다.
eventSource.on(event_types.GENERATION_STARTED, (type) => { setGenerationType(type); markSend('생성 시작'); });
eventSource.on(event_types.GENERATION_AFTER_COMMANDS, () => markSend('명령 처리 끝'));
eventSource.on(event_types.MESSAGE_SENT, () => markSend('메시지 전송 이벤트'));
eventSource.on(event_types.USER_MESSAGE_RENDERED, () => markSend('내 메시지 표시'));
eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, () => markSend('프롬프트 완성'));
// 보내기 버튼 · Enter — 실리태번보다 먼저(capture) 받아서 0초 기준으로 삼는다
document.addEventListener('click', (event) => {
    if (event.target.closest?.('#send_but')) beginSendTrace('버튼');
}, true);
document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && event.target?.id === 'send_textarea') beginSendTrace('Enter');
}, true);
// 요청이 끝나면 몇 초 뒤 중계 서버의 잔액·과금을 다시 가져온다 (1분에 한 번까지)
eventSource.on(event_types.GENERATION_ENDED, () => { clearGenerationType(); refreshBudgetSoon(); });
eventSource.on(event_types.GENERATION_STOPPED, () => clearGenerationType());

// 폰에서 zip을 덧씌우면 예전 파일이 그대로 남는 일이 있다. 코드와 스타일의 판이 다르면 알려 준다.
function checkFilesMatch() {
    const cssVersion = getComputedStyle(document.documentElement).getPropertyValue('--rl-css-version').trim().replace(/["']/g, '');
    if (cssVersion === VERSION) return;
    toast('warning', `${TITLE} 파일이 섞였어요 (코드 ${VERSION}, 스타일 ${cssVersion || '예전 것'}). 블루 레몬에이드 업데이트 파일을 확인하고 새로고침해 주세요.`, { timeOut: 15000 });
}

// 슬래시 명령: /request-log 로도 연다
function registerSlashCommand() {
    try {
        const { SlashCommandParser } = globalThis.SillyTavern?.getContext?.() ?? {};
        const { SlashCommand } = globalThis.SillyTavern?.getContext?.() ?? {};
        if (!SlashCommandParser || !SlashCommand) return;
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'request-log',
            callback: () => { openDialog(); return ''; },
            helpString: '요청 로그 창을 열어요.',
        }));
    } catch (error) {
        console.warn('[요청 로그] 슬래시 명령을 등록하지 못했어요', error);
    }
}

jQuery(async () => {
    buildDrawer();
    mountWandButton();
    registerSlashCommand();
    for (const delay of [800, 3000]) setTimeout(mountWandButton, delay);
    // 4.2.2: 계산된 스타일은 화면이 한 번 그려진 직후에 읽는다 (그때는 이미 계산돼 있어 공짜) — 시작 도중에 읽으면 문서 전체를 그 자리에서 계산했다. 화면이 꺼져 있으면 5초 뒤 그냥 읽음
    setTimeout(() => { let done = false; const go = () => { if (!done) { done = true; checkFilesMatch(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 5000); }, 3000);
    trimEntries().catch(() => {});
    // 시작할 때 한 번 가져와서 예산 알림을 바로 낼 수 있게 한다
    setTimeout(() => refreshBudget().catch(() => {}), 6000);
});
