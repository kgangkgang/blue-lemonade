// 성능 보조 (Perf Assist)
// 폰에서 실리태번 본체가 쓰는 CPU 중 확장 쪽에서 안전하게 줄일 수 있는 것만 모았다. 기능마다 서랍에서 끌 수 있다.
//  1. 스트리밍 중 바뀐 곳만 다시 그리기 (morph.js)
//  2. 닫힌 프롬프트 목록은 열 때 그리기 (promptlist.js)
//  3. 큰 저장은 뒤에서 보내기 (savesend.js + save-worker.js)
//  4. 메시지 속 같은 <style> 은 하나만 쓰기 (styledup.js · 6.4.4)
//  5. 메시지 속 같은 꾸밈 한 번만 넣기 (styleonce.js) — 실리태번이 메시지마다 같은 CSS 를 다시 해석하지 않게
// 각 기능은 실리태번 쪽 모양(내보내기 · 이벤트 · 메서드)이 없으면 켜지지 않고 원래대로 둔다.
import { verifyAddonCss } from '../../addon-files-check.js';
import { pane } from './hub.js';
import * as extensions from '../../../../../../extensions.js';
import * as script from '../../../../../../../script.js';
import * as openai from '../../../../../../openai.js';
import * as powerUser from '../../../../../../power-user.js';
import * as chats from '../../../../../../chats.js';
import { morphdom } from '../../../../../../../lib.js';
import { createStreamMorph, SELF_TEST_STEPS } from './morph.js';
import { createPromptListDefer } from './promptlist.js';
import { listShown } from './shown.js';
import { createSaveSender } from './savesend.js';
import { createStyleDedupe } from './styledup.js';
import { createStyleOnce, installStyleOnce } from './styleonce.js';

const MODULE = 'perf_assist';
const VERSION = '1.0.2';
const TITLE = '성능 보조';

const DEFAULTS = Object.freeze({ morphStream: true, deferPromptList: true, saveInWorker: true, dedupeStyles: true, styleOnce: true });

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
const unavailable = { morphStream: '', deferPromptList: '', saveInWorker: '', dedupeStyles: '', styleOnce: '' };

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
        if (!processor || processor.isStopped || processor.isFinished || (processor === lastProcessor && morph.attached() === processor.messageTextDom)) return;
        lastProcessor = processor;
        // 실리태번 '스트리밍 페이드 인'은 스스로 morphdom 을 쓴다 — 그때는 할 일 없음
        if (powerUser.power_user?.stream_fade_in) return;
        morph.attach(processor);
    });
    const release = () => { morph.release(); lastProcessor = null; };
    for (const name of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_CHANGED']) if (ev[name]) es.on(ev[name], release);
    if (ev.MESSAGE_RECEIVED) (typeof es.makeFirst === 'function' ? es.makeFirst(ev.MESSAGE_RECEIVED, release) : es.on(ev.MESSAGE_RECEIVED, release));
}

// ── 2. 닫힌 프롬프트 목록은 열 때 그리기 ─────────────────────

function isShown(el) {
    // 4.2.2: 닫힌 서랍이면 물어볼 것도 없다. 8.0.5: 열린 서랍에서도 checkVisibility() 대신 조상의 class · 인라인 style 만 본다(shown.js) —
    // 프리셋을 바꾸는 동안 부를 때마다 서랍 전체 스타일 계산을 강제했다 (PC 약 50ms · 폰 흉내 약 200ms × 4번 남짓)
    return listShown(el);
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

// 토글을 누른 직후의 render(true) 만 묶는다 — 실리태번 handleToggle 은 누름 처리(거품 단계) 안에서 바로 render() 를 부른다.
// 지우기 · 끼우기 · 편집 저장 · 끌어 옮기기 뒤의 그리기는 예전처럼 바로 보낸다(보이는 결과가 늦어지지 않게).
let lastToggleAt = 0;
const TOGGLE_WINDOW_MS = 100;
if (typeof document?.addEventListener === 'function') {   // 시험은 document 흉내만 준다
    document.addEventListener('click', (event) => {
        if (event.target?.closest?.('.prompt-manager-toggle-action')) lastToggleAt = Date.now();
    }, true);
}

const promptList = createPromptListDefer({
    manager: () => openai.promptManager ?? null,
    enabled: () => settings().deferPromptList !== false,
    visible: isShown,
    watch: watchShown,
    peer: () => window.SaveDedupe?.promptDefer ?? null,
    coalesceMs: 300,   // 8.0.5 토글을 잇달아 누를 때 미리 돌려 보기 · 목록 그리기를 마지막 한 번으로
    coalesceWhen: () => Date.now() - lastToggleAt < TOGGLE_WINDOW_MS,
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

// 6.7.1 채팅 저장이 끝나면 알린다 — 이 감싸개가 다른 확장의 감싸개(다른 기기 바뀜 감시 등)보다 바깥에 놓여 워커로 보내면 그쪽은 저장을 못 본다
const CHAT_SAVES = ['/api/chats/save', '/api/chats/group/save'];
function announceChatSave(input, init, request) {
    try {
        if (String(init?.method ?? input?.method ?? 'GET').toUpperCase() !== 'POST') return request;
        const path = new URL(typeof input === 'string' ? input : input?.url ?? String(input), location.href).pathname;
        if (!CHAT_SAVES.includes(path)) return request;
        Promise.resolve(request).then(response => { if (response?.ok) window.dispatchEvent(new CustomEvent('bl:chat-saved', { detail: { path, body: init?.body } })); }, () => {});
    } catch { /* 알리기는 덤 */ }
    return request;
}

// 6.7.5 다른 기기 바뀜 감시(chat-sync.js)의 저장 관문 — 워커로 보내기 전에 부른다. 이 감싸개가 그 감싸개 바깥이라
//       전엔 띠가 떠 있어도 덮어쓰기 전에 묻지 못하고 다른 기기에서 더한 메시지를 지웠다. 관문이 없으면(감시 끔 · 옛 판) 그대로 보낸다
const SAVE_GUARD = Symbol.for('blue-lemonade.chat-save-guard');

function installSaver() {
    if (typeof Worker !== 'function' || typeof nativeFetch !== 'function') {
        unavailable.saveInWorker = '워커 없음';
        return;
    }
    // 다른 확장(끊김 감시 · 저장 정리 · 요청 로그)의 fetch 감싸기보다 안쪽에 있어야 한다 → loading_order 2
    window.fetch = function perfAssistFetch(input, init) {
        try {
            const send = () => announceChatSave(input, init, saver.send(input, init));
            const guard = globalThis[SAVE_GUARD];
            return typeof guard === 'function' ? guard(input, init, send) : send();
        } catch (error) {
            console.warn(`[${TITLE}] 요청을 살피지 못했어요`, error);
            return nativeFetch.call(window, input, init);
        }
    };
    if (settings().saveInWorker) saver.start();
}

// ── 4. 메시지 속 같은 <style> 은 하나만 (6.4.4) ───────────────
// 프리셋 정규식이 메시지마다 같은 <style> 을 넣으면 메뉴 · 서랍을 열 때의 넓은 스타일 계산이 그만큼 무거워진다 — 마지막 한 벌만 켜 둔다 (styledup.js)

let generating = false;
const styleDedupe = createStyleDedupe({
    query: () => [...document.querySelectorAll('#chat .mes style')],
    holdersOf: node => [node.parentNode, node.closest('.mes_text') || node.closest('.mes')],
    streaming: () => generating,
    enabled: () => settings().dedupeStyles !== false && !unavailable.dedupeStyles,
});

function installStyleDedupe() {
    const es = events(), ev = eventTypes();
    const chat = document.getElementById('chat');
    if (!es || !ev?.CHAT_CHANGED || typeof MutationObserver !== 'function' || !chat) {
        unavailable.dedupeStyles = '이벤트 없음';
        return;
    }
    const run = () => styleDedupe.schedule();
    for (const name of ['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'MORE_MESSAGES_LOADED']) if (ev[name]) es.on(ev[name], run);
    // 채팅에 답이 흘러드는 생성 중에는 새 사본을 끄지 않는다 (걸음마다 스타일 계산을 부르지 않게) — 끝나면 정리. 조용한 생성 · 대신 쓰기는 채팅에 안 그린다
    if (ev.GENERATION_STARTED) es.on(ev.GENERATION_STARTED, (type, _options, dryRun) => { if (!dryRun && type !== 'quiet' && type !== 'impersonate') generating = true; });
    for (const name of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'MESSAGE_RECEIVED', 'CHAT_CHANGED']) if (ev[name]) es.on(ev[name], () => { generating = false; run(); });
    // 이벤트 없이 메시지를 통째로 지우거나 더하는 경우 대비 — #chat 의 바로 아래 자식 목록만 (메시지 글이 바뀌는 것은 안 본다)
    new MutationObserver(run).observe(chat, { childList: true });
    run();
}

// ── 5. 메시지 속 같은 꾸밈 한 번만 넣기 ─────────────────────
// 100턴 표본에서 그리기 시간의 대부분이 메시지마다 같은 <style> 을 실리태번이 다시 해석하는 데 들었다 — 같은 원문은 한 번만 해석해
// #sheld 뒤 칸에 한 벌 두고, 메시지 안에는 작은 표시만 남긴다 (styleonce.js). 저장된 글은 그대로

const styleOnce = createStyleOnce({
    // 실리태번과 같은 길(DOMPurify 는 인코딩된 style 글을 건드리지 않는다)
    decode: html => chats.decodeStyleTags(chats.encodeStyleTags(html), { prefix: '.mes_text ' }),
    mediaAllowed: () => (typeof chats.isExternalMediaAllowed === 'function' ? chats.isExternalMediaAllowed() : true),
    enabled: () => settings().styleOnce !== false && !unavailable.styleOnce,
});

function installStyleOnceHook() {
    const es = events(), ev = eventTypes();
    if (typeof chats.decodeStyleTags !== 'function' || typeof chats.encodeStyleTags !== 'function' || !installStyleOnce(styleOnce, context()?.messageFormatter)) {
        unavailable.styleOnce = '실리태번 서식 훅 없음';
        return;
    }
    if (!es || !ev) return;
    // 지우기 · 다시 그리기 · 채팅 바꾸기 뒤 칸 정리 (메시지가 그려질 때는 훅이 스스로 부른다)
    for (const name of ['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'MORE_MESSAGES_LOADED', 'GENERATION_ENDED', 'GENERATION_STOPPED']) if (ev[name]) es.on(ev[name], () => styleOnce.schedule());
}

// ── 설정 서랍 ───────────────────────────────────────────────

const ROWS = [
    ['morphStream', '스트리밍 중 바뀐 곳만 다시 그리기'],
    ['deferPromptList', '닫힌 프롬프트 목록은 열 때 그리기'],
    ['saveInWorker', '큰 저장은 뒤에서 보내기'],
    ['dedupeStyles', '메시지 속 같은 style 은 하나만 쓰기'],
    ['styleOnce', '메시지 속 같은 꾸밈 한 번만 넣기'],
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
                <b><i class="fa-solid fa-gauge-high"></i> ${TITLE} <span class="pa-version ext-version">v${VERSION}</span></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="pa-body">
                    ${ROWS.map(([key, label]) => `<label class="checkbox_label pa-check" for="pa_${key}"><input type="checkbox" id="pa_${key}" data-pa-key="${key}"><span>${label}</span><small class="pa-note" data-pa-note="${key}" hidden></small></label>`).join('')}
                </div>
            </div>
        </div>`;
    container.append(drawer);
    for (const input of drawer.querySelectorAll('input[data-pa-key]')) {
        const key = input.dataset.paKey;
        input.checked = settings()[key] !== false;
        input.addEventListener('change', () => {
            settings()[key] = input.checked;
            if (key === 'morphStream' && !input.checked) morph.release();
            if (key === 'deferPromptList' && !input.checked) { promptList.flush(true); promptList.flushBatch(); }
            if (key === 'saveInWorker' && input.checked) saver.start();
            if (key === 'dedupeStyles') styleDedupe.schedule();   // 끄면 모두 되돌린다 (run 이 enabled 를 본다)
            // styleOnce: 끄면 다음에 그리는 메시지부터 원래대로 — 이미 그린 메시지의 꾸밈은 칸이 그대로 지킨다
            script.saveSettingsDebounced?.();
        });
    }
    refreshDrawer();
}

function checkFilesMatch() {
    // 기다려 보고 · 스타일을 한 번 다시 받아 보고 · 그래도 다를 때만 한 번 알린다 (src/addon-files-check.js)
    verifyAddonCss({ folder: 'perf', name: '--pa-css-version', version: VERSION, title: TITLE });
}

initSettings();
for (const [name, install] of [['saveInWorker', installSaver], ['morphStream', installMorph], ['deferPromptList', installPromptList], ['dedupeStyles', installStyleDedupe], ['styleOnce', installStyleOnceHook]]) {
    try {
        install();
    } catch (error) {
        unavailable[name] = '설치 실패';
        console.warn(`[${TITLE}] ${name} 설치 실패`, error);
    }
}
window.PerfAssist = { settings, unavailable, morph, promptList, saver, styleOnce, version: VERSION };

jQuery(() => {
    buildDrawer();
    // 4.2.2: 계산된 스타일은 화면이 한 번 그려진 직후에 읽는다 (그때는 이미 계산돼 있어 공짜) — 시작 도중에 읽으면 문서 전체를 그 자리에서 계산했다. 화면이 꺼져 있으면 5초 뒤 그냥 읽음
    setTimeout(() => { let done = false; const go = () => { if (!done) { done = true; checkFilesMatch(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 5000); }, 3000);
});
