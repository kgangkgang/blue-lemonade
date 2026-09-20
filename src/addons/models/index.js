// 모델 등록 — 공급자마다 원하는 모델 이름을 직접 넣어 두고 고르는 확장
// 이전 확장 Custom-Vertex-Model(버텍스 전용)을 대신한다. 설정은 처음 켤 때 한 번 옮겨 온다.
import { eventSource, event_types } from '../../../../../../../script.js';
import { extension_settings } from '../../../../../../extensions.js';
import { OLD_MODULE, TITLE, VERSION, initSettings, saveSettings, settings } from './state.js';
import { applyAll, scheduleAll, watchPicks } from './inject.js';
import { buildPanel, render } from './panel.js';

initSettings();

function toast(kind, message, options = {}) {
    if (typeof toastr !== 'undefined') toastr[kind](message, TITLE, options);
}

// 실리태번이 목록을 다시 채우는 길은 여러 갈래다. 이벤트로 잡히는 것은 여기서 잡고,
// 이벤트가 없는 길(연결 직후의 목록 갈아치우기)은 inject.js의 DOM 감시가 맡는다.
const REFRESH_EVENTS = [
    event_types.APP_READY,
    event_types.CHATCOMPLETION_SOURCE_CHANGED,
    event_types.CHATCOMPLETION_MODEL_CHANGED,
    event_types.ONLINE_STATUS_CHANGED,
    event_types.SETTINGS_UPDATED,
    event_types.OAI_PRESET_CHANGED_AFTER,
];

for (const type of REFRESH_EVENTS) {
    if (!type) continue;
    // 바로 넣지 않고 미룬다 (inject.js scheduleAll 참고). applySource가 공급자마다 오류를 따로 잡는다.
    eventSource.on(type, () => scheduleAll());
}

/** 이전 확장이 아직 켜져 있으면 같은 자리에 묶음이 둘 생긴다. */
function checkOldExtension() {
    if (!document.querySelector('button.addModel_button')) return;
    toast('warning', '이전 “버텍스 모델 등록” 확장이 켜져 있어요. 버텍스 목록이 두 번 나오니 확장 관리에서 꺼 주세요. 등록해 둔 모델은 이미 옮겨 왔어요.', { timeOut: 15000 });
}

function checkFilesMatch() {
    const panel = document.querySelector('.mr-settings');
    if (!panel) return;
    const cssVersion = getComputedStyle(panel).getPropertyValue('--mr-css-version').trim().replace(/["']/g, '');
    if (cssVersion === VERSION) return;
    toast('warning', `${TITLE} 파일이 섞였어요 (코드 ${VERSION}, 스타일 ${cssVersion || '예전 것'}). 블루 레몬에이드 파일을 확인하고 다시 새로고침해 주세요.`, { timeOut: 15000 });
}

jQuery(async () => {
    buildPanel();
    applyAll();
    watchPicks();
    render();

    const store = settings();
    if (store.migratedFrom && !store.migrationNoticeShown) {
        store.migrationNoticeShown = true;
        saveSettings();
        const moved = (store.sources.vertexai ?? []).length;
        toast('info', `이전 버텍스 모델 등록 확장에서 모델 ${moved}개를 옮겨 왔어요.`, { timeOut: 10000 });
    }

    setTimeout(() => {
        checkFilesMatch();
        checkOldExtension();
    }, 3000);
});
