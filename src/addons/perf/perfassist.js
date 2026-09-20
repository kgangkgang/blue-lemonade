// 성능 보조 (Perf Assist)
// 폰에서 실리태번 본체가 쓰는 CPU 중 확장 쪽에서 안전하게 줄일 수 있는 것만 모았다. 기능마다 서랍에서 끌 수 있다.
//  1. 스트리밍 중 바뀐 곳만 다시 그리기 (morph.js)
//  2. 닫힌 프롬프트 목록은 열 때 그리기 (promptlist.js)
//  3. 큰 저장은 뒤에서 보내기 (savesend.js + save-worker.js)
// 각 기능은 실리태번 쪽 모양(내보내기 · 이벤트 · 메서드)이 없으면 켜지지 않고 원래대로 둔다.
import { pane } from './hub.js';
import * as extensions from '../../../../../../extensions.js';
import * as script from '../../../../../../../script.js';
import * as openai from '../../../../../../openai.js';
import * as powerUser from '../../../../../../power-user.js';
import { morphdom } from '../../../../../../../lib.js';
import { createStreamMorph, SELF_TEST_STEPS } from './morph.js';
import { createPromptListDefer } from './promptlist.js';
import { createSaveSender } from './savesend.js';

const MODULE = 'perf_assist';
const FOLDER = 'blue-lemonade';
const VERSION = '1.0.1';
const TITLE = '성능 보조';

const DEFAULTS = Object.freeze({ morphStream: true, deferPromptList: true, saveInWorker: true });

function settings() {
    return extensions.extension_settings[MODULE];
}

function initSettings() {
    const all = extensions.extension_settings;
    const existing = all[MODULE];
    const s = existing && typeof existing === 'object' ? { ...DEFAULTS, ...existing } : { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) s[key] = s[key] !== false;
    all[MODULE] = s;
}

const context = () => SillyTavern.getContext();
const events = () => script.eventSource ?? context().eventSource;
const eventTypes = () => script.event_types ?? context().eventTypes;

/** 기능마다 못 쓰게 된 까닭 ('' = 쓸 수 있음) */
const unavailable = { morphStream: '', deferPromptList: '', saveInWorker: '' };

// ── 1. 스트리밍 중 바뀐 곳만 다시 그리기 ─────────────────────

const innerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
const morph = createStreamMorph({
    morphdom,
    descriptor: innerHTMLDescriptor,
    MutationObserver: typeof MutationObserver === 'function' ? MutationObserver : null,
    enabled: () => settings().morphStream !== false && !unavailable.morphStream,
    onFallback: error => console.warn(`[${TITLE}] 바뀐 곳만 그리기를 이번 답에서 멈췄어요`, error),
});

function installMorph() {
    const ok = morph.selfTest(() => {
        const el = document.createElement('div');
        el.className = 'mes_text';
        return el;
    }, SELF_TEST_STEPS);
    const es = events(), ev = eventTypes();
    if (!ok || !es || !ev?.STREAM_TOKEN_RECEIVED || !ev.GENERATION_ENDED) {
        unavailable.morphStream = ok ? '이벤트 없음' : '자체 시험 실패';
        console.warn(`[${TITLE}] 스트리밍 중 바뀐 곳만 그리기를 쓸 수 없어요: ${unavailable.morphStream}`);
        return;
    }
    let lastProcessor = null;
    es.on(ev.STREAM_TOKEN_RECEIVED, () => {
        if (settings().morphStream === false) return;
        const processor = 'streamingProcessor' in script ? script.streamingProcessor : context().streamingProcessor;
        if (!processor || (processor === lastProcessor && morph.attached() === processor.messageTextDom)) return;
        lastProcessor = processor;
        // 실리태번 '스트리밍 페이드 인'은 스스로 morphdom 을 쓴다 — 그때는 할 일 없음
        if (powerUser.power_user?.stream_fade_in) return;
        morph.attach(processor);
    });
    const release = () => morph.release();
    for (const name of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_CHANGED']) if (ev[name]) es.on(ev[name], release);
    if (ev.MESSAGE_RECEIVED) (typeof es.makeFirst === 'function' ? es.makeFirst(ev.MESSAGE_RECEIVED, release) : es.on(ev.MESSAGE_RECEIVED, release));
}

// ── 2. 닫힌 프롬프트 목록은 열 때 그리기 ─────────────────────

function isShown(el) {
    if (!el?.isConnected) return false;
    if (typeof el.checkVisibility === 'function') return el.checkVisibility();
    return el.getClientRects().length > 0;
}

/** 목록이 보이기 시작할 수 있을 때: 조상(서랍 · 설정 블록)의 class · style · hidden 이 바뀔 때, 화면에 들어올 때 */
function watchShown(el, onChange) {
    const stops = [];
    if (typeof MutationObserver === 'function') {
        const mo = new MutationObserver(onChange);
        for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
            mo.observe(node, { attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
        }
        stops.push(() => mo.disconnect());
    }
    if (typeof IntersectionObserver === 'function') {
        const io = new IntersectionObserver((entries) => {
            if (entries.some(entry => entry.isIntersecting)) onChange();
        });
        io.observe(el);
        stops.push(() => io.disconnect());
    }
    if (!stops.length) return null;
    return () => stops.forEach(stop => stop());
}

const promptList = createPromptListDefer({
    manager: () => openai.promptManager ?? null,
    enabled: () => settings().deferPromptList !== false,
    visible: isShown,
    watch: watchShown,
    peer: () => window.SaveDedupe?.promptDefer ?? null,
});

function installPromptList() {
    if (promptList.install()) return;
    const es = events(), ev = eventTypes();
    if (es && ev?.APP_READY) {
        es.on(ev.APP_READY, () => {
            if (!promptList.install()) unavailable.deferPromptList = '프롬프트 관리자 없음';
            refreshDrawer();
        });
    } else {
        unavailable.deferPromptList = '프롬프트 관리자 없음';
        console.warn(`[${TITLE}] 닫힌 프롬프트 목록 미루기를 쓸 수 없어요: 프롬프트 관리자 없음`);
    }
}

// ── 3. 큰 저장은 뒤에서 보내기 ─────────────────────────────

const nativeFetch = window.fetch;
const saver = createSaveSender({
    nativeFetch: (input, init) => nativeFetch.call(window, input, init),
    // 버전을 붙여 예전 워커 파일(살아 있는지 묻기에 대답하지 않음)이 캐시에서 나오지 않게 한다
    createWorker: () => new Worker(new URL(`./save-worker.js?v=${VERSION}`, import.meta.url)),
    hidden: () => document.visibilityState === 'hidden',
    origin: location.origin,
    enabled: () => settings().saveInWorker !== false,
    Response,
    Headers,
    testHeaders: () => (typeof script.getRequestHeaders === 'function' ? script.getRequestHeaders() : { 'Content-Type': 'application/json' }),
    onDisabled: (why) => {
        unavailable.saveInWorker = why;
        console.warn(`[${TITLE}] 큰 저장은 원래대로 보내요: ${why}`);
        refreshDrawer();
    },
});

function installSaver() {
    if (typeof Worker !== 'function' || typeof nativeFetch !== 'function') {
        unavailable.saveInWorker = '워커 없음';
        return;
    }
    // 다른 확장(끊김 감시 · 저장 정리 · 요청 로그)의 fetch 감싸기보다 안쪽에 있어야 한다 → loading_order 2
    window.fetch = function perfAssistFetch(input, init) {
        try {
            return saver.send(input, init);
        } catch (error) {
            console.warn(`[${TITLE}] 요청을 살피지 못했어요`, error);
            return nativeFetch.call(window, input, init);
        }
    };
    if (settings().saveInWorker) saver.start();
}

// ── 설정 서랍 ───────────────────────────────────────────────

const ROWS = [
    ['morphStream', '스트리밍 중 바뀐 곳만 다시 그리기'],
    ['deferPromptList', '닫힌 프롬프트 목록은 열 때 그리기'],
    ['saveInWorker', '큰 저장은 뒤에서 보내기'],
];

let drawer = null;

function refreshDrawer() {
    if (!drawer) return;
    for (const [key] of ROWS) {
        const note = drawer.querySelector(`[data-pa-note="${key}"]`);
        if (!note) continue;
        note.textContent = unavailable[key] ? '쓸 수 없음' : '';
        note.hidden = !unavailable[key];
    }
}

function buildDrawer() {
    const container = pane('perf'); // 2.0.0 톱니바퀴 설정 창의 탭 (hub.js)
    if (!container || drawer) return;
    drawer = document.createElement('div');
    drawer.id = 'perf_assist_settings';
    drawer.className = 'pa-settings';
    drawer.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b><i class="fa-solid fa-gauge-high"></i> ${TITLE} <span class="pa-version ext-version">v${VERSION}</span> <button type="button" class="bl-word-help" data-pa-help aria-label="성능 보조 기능 설명">?</button></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="pa-body">
                    ${ROWS.map(([key, label]) => `<label class="checkbox_label pa-check" for="pa_${key}"><input type="checkbox" id="pa_${key}" data-pa-key="${key}"><span>${label}</span><small class="pa-note" data-pa-note="${key}" hidden></small></label>`).join('')}
                </div>
            </div>
        </div>`;
    container.append(drawer);
    drawer.querySelector('[data-pa-help]').addEventListener('click',event=>{event.stopPropagation();import('./help.js').then(api=>api.showPerfHelp());});
    for (const input of drawer.querySelectorAll('input[data-pa-key]')) {
        const key = input.dataset.paKey;
        input.checked = settings()[key] !== false;
        input.addEventListener('change', () => {
            settings()[key] = input.checked;
            if (key === 'morphStream' && !input.checked) morph.release();
            if (key === 'deferPromptList' && !input.checked) promptList.flush(true);
            if (key === 'saveInWorker' && input.checked) saver.start();
            script.saveSettingsDebounced?.();
        });
    }
    refreshDrawer();
}

function checkFilesMatch() {
    const cssVersion = getComputedStyle(document.documentElement).getPropertyValue('--pa-css-version').trim().replace(/["']/g, '');
    if (cssVersion === VERSION || typeof toastr === 'undefined') return;
    toastr.warning(`${TITLE} 파일이 섞였어요 (코드 ${VERSION}, 스타일 ${cssVersion || '예전 것'}). 블루 레몬에이드 업데이트 파일을 확인하고 새로고침해 주세요.`, TITLE, { timeOut: 15000 });
}

initSettings();
for (const [name, install] of [['saveInWorker', installSaver], ['morphStream', installMorph], ['deferPromptList', installPromptList]]) {
    try {
        install();
    } catch (error) {
        unavailable[name] = '설치 실패';
        console.warn(`[${TITLE}] ${name} 설치 실패`, error);
    }
}
window.PerfAssist = { settings, unavailable, morph, promptList, saver, version: VERSION };

jQuery(() => {
    buildDrawer();
    setTimeout(checkFilesMatch, 3000);
});
