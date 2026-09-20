// 저장 정리 (Save Dedupe)
// 실리태번은 채팅 변수가 바뀔 때마다(프리셋의 {{.x = …}} · {{setvar}} 매크로 — 데우스 프리셋은 프롬프트 한 번에 176개)
// 채팅 파일 전체를 다시 저장한다. 값이 지난번과 똑같아도 그렇다. 7MB 채팅이면 저장 한 번이 폰에서 수 초라,
// 한 턴에 4~6번 저장되던 것 중 내용이 지난 저장과 완전히 같은 요청은 서버로 보내지 않고 성공으로 돌려준다.
// 내용이 조금이라도 다르면(새 메시지 · 번역 · 기억 · 수정) 평소대로 저장한다. 실리태번 코드는 건드리지 않는다.
// [1.0.2] 저장이 1초를 넘어 실리태번이 뒤따르던 저장을 버리면, 앞 저장이 끝난 뒤 한 번 더 저장한다 (recovery.js).
// [1.1.0] 닫힌 프롬프트 관리자의 답장마다 도는 토큰 계산을 서랍을 열 때로 미룬다 (promptdefer.js).
//         채팅을 바꾸기 전에 1초 저장 대기 · 밀린 저장을 마친다 (switchflush.js).
// [1.1.1] 답을 받는 동안 채팅 바꾸기를 막고, 스트리밍 답의 끝 저장 · 끊긴 스트림의 답을 저장한 뒤 넘긴다 (switchguard.js).
// [1.1.2] 누름이 아닌 길도 막는다 (switchcode.js): 확장 · 스크립트의 getContext().openCharacterChat · openGroupChat,
//         jQuery .trigger('click'), 그리고 reloadCurrentChat (정규식 편집기 · 페르소나 · 사용자 설정 · /chat-reload …).
import { pane } from './hub.js';
import * as extensions from '../../../../../../extensions.js';
import * as script from '../../../../../../../script.js';
import * as openai from '../../../../../../openai.js';
import * as groupChats from '../../../../../../group-chats.js';
import { createRecovery, asyncStacksWork, stackHas, bodyKey, liveChatFrom, MARKER, DROP_MESSAGE } from './recovery.js';
import { createPromptDefer } from './promptdefer.js';
import { createSaveTimers, createSwitchFlush, matchSwitchEntry, FLUSH_MARKER, SWITCH_ENTRIES } from './switchflush.js';
import { createSwitchGuard, wrapCommands, DELETE_ENTRY, GUARD_COMMANDS } from './switchguard.js';
import { createCodeGuard, isClickTrigger, CODE_SWITCH_KEYS } from './switchcode.js';

const MODULE = 'save_dedupe';
const FOLDER = 'blue-lemonade'; // 2.0.0 성능 보조로 합침
const VERSION = '1.1.2';
const TITLE = '저장 정리';
const SAVE_PATHS = ['/api/chats/save', '/api/chats/group/save'];

const DEFAULTS = Object.freeze({ enabled: true, recover: true, deferPromptRender: true, flushOnSwitch: true, guardGeneration: true });

function settings() {
    return extensions.extension_settings[MODULE];
}

function initSettings() {
    const all = extensions.extension_settings;
    const existing = all[MODULE];
    all[MODULE] = existing && typeof existing === 'object' ? { ...DEFAULTS, ...existing } : { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) all[MODULE][key] = all[MODULE][key] !== false;
}

/** 마지막으로 서버에 성공적으로 보낸 저장 본문 (경로별) */
const last = new Map();
const stats = { skipped: 0, sent: 0, skippedBytes: 0 };
/** 채팅 키 → 성공했거나(같은 본문이라 건너뛴 것 포함) 저장 가운데 가장 늦게 시작한 시각 */
const lastOk = new Map();
/** 밀린 저장 되살리기. 이 실리태번에서 쓸 수 없으면 null (저장 건너뛰기만 동작) */
let recovery = null;
let recoveryUnsupported = false;
/** 닫힌 프롬프트 관리자 계산 미루기 */
let promptDefer = null;
/** 채팅 바꾸기 전 저장 마치기. 쓸 수 없으면 null */
let saveTimers = null;
let switchFlush = null;
/** 답을 받는 동안 채팅 바꾸기 막기. 쓸 수 없으면 null */
let switchGuard = null;
/** [1.1.2] 코드로 바꾸는 길 (getContext 함수 · jQuery trigger · reloadCurrentChat) */
let codeGuard = null;

function pathOf(input) {
    try {
        return new URL(typeof input === 'string' ? input : (input?.url ?? ''), location.origin).pathname;
    } catch {
        return '';
    }
}

function fakeOk() {
    return new Response('{"result":"ok"}', { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function noteOk(key, start) {
    if (key !== null && start > (lastOk.get(key) ?? -Infinity)) lastOk.set(key, start);
}

/** 채팅을 바꾸기 전 저장이 멈추면 끊을 수 있게 신호를 단다 */
function withSignal(init, signal) {
    if (!signal) return init;
    let merged = signal;
    if (init?.signal && typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') merged = AbortSignal.any([init.signal, signal]);
    else if (init?.signal) return init;
    return { ...init, signal: merged };
}

function installDedupe() {
    const nativeFetch = window.fetch;

    function send(self, input, init, path, token, remember, key, start) {
        const request = nativeFetch.call(self, input, init);
        request.then((response) => {
            if (response.ok) {
                noteOk(key, start);
                if (remember) { last.set(path, init.body); stats.sent++; refreshStats(); }
            } else {
                last.delete(path);
            }
            recovery?.onSaveResult(token, response.ok);
        }, () => {
            last.delete(path);
            recovery?.onSaveResult(token, false);
        });
        return request;
    }

    window.fetch = function saveDedupeFetch(input, init) {
        try {
            const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase();
            const path = method === 'POST' ? pathOf(input) : '';
            if (SAVE_PATHS.includes(path)) {
                const body = init?.body;
                const key = bodyKey(path, body);
                const start = performance.now();
                // [1.0.2] 복구가 부른 저장이면 보내기 직전에 채팅이 그대로인지 본다. 다른 저장은 기록만 하고 그대로 보낸다.
                let token = null;
                if (recovery) {
                    const own = recovery.inCall() && stackHas(MARKER);
                    const check = recovery.onSaveRequest({ key, own });
                    if (check.block) return Promise.resolve(fakeOk());
                    token = check.token;
                }
                // [1.1.0] 채팅을 바꾸기 전에 부른 저장은 5초를 넘기면 끊는다 (바꾸기가 멈춘 저장을 기다리다 실패하지 않게)
                if (switchFlush?.active() && stackHas(FLUSH_MARKER)) init = withSignal(init, switchFlush.signal());
                // [1.0.1] 비교하지 않고 그냥 내보내는 저장도 서버 파일을 바꾼다: 확장을 꺼 둔 동안의 저장, 그리고 실리태번 요청 압축
                // (config.yaml performance.requestCompression)이 켜져 본문이 gzip 바이트로 나가는 저장. 그때 기억해 둔 본문을 버리지 않으면
                // 나중에 그 전 내용으로 되돌린 저장(메시지 지우기 등)을 "지난번과 같다"며 건너뛰어, 지운 메시지가 서버 파일에 남았다.
                if (!settings().enabled || typeof body !== 'string') {
                    last.delete(path);
                    return send(this, input, init, path, token, false, key, start);
                }
                if (last.get(path) === body) {
                    stats.skipped++;
                    stats.skippedBytes += body.length;
                    refreshStats();
                    noteOk(key, start);
                    recovery?.onSaveResult(token, true, { skipped: true });
                    return Promise.resolve(fakeOk());
                }
                return send(this, input, init, path, token, true, key, start);
            }
        } catch (error) {
            console.warn(`[${TITLE}] 저장 요청을 살피지 못했어요`, error);
        }
        return nativeFetch.call(this, input, init);
    };
}

// ── 밀린 저장 되살리기 ───────────────────────────────────────

function context() {
    try {
        if (typeof extensions.getContext === 'function') return extensions.getContext();
        return window.SillyTavern?.getContext?.() ?? null;
    } catch {
        return null;
    }
}

function saveFunction() {
    if (typeof script.saveChatConditional === 'function') return script.saveChatConditional;
    const ctx = context();
    return typeof ctx?.saveChat === 'function' ? ctx.saveChat : null;
}

function hookDropWarning() {
    const nativeWarn = console.warn;
    console.warn = function saveDedupeWarn(...args) {
        try {
            if (recovery && args[0] === DROP_MESSAGE) recovery.onDrop({ own: recovery.inCall() && stackHas(MARKER) });
        } catch {
            // 복구는 조용히 실패한다 (경고는 그대로 찍힌다)
        }
        return nativeWarn.apply(this, args);
    };
}

async function installRecovery() {
    try {
        // 실리태번 버전이 달라 필요한 것이 없거나, 이 브라우저가 await 너머 호출자를 스택에 남기지 않으면 켜지 않는다
        const supported = typeof script.isChatSaving === 'boolean' && !!saveFunction() && typeof context()?.getCurrentChatId === 'function';
        if (!supported || !await asyncStacksWork()) {
            recoveryUnsupported = true;
            refreshStats();
            return;
        }
        recovery = createRecovery({
            now: () => performance.now(),
            setTimer: (fn, ms) => setTimeout(fn, ms),
            // 채팅을 바꾸기 전 저장을 마치는 동안은 저장 중으로 본다 (둘이 잠금을 두고 다투지 않게)
            isSaving: () => (typeof script.isChatSaving === 'boolean' ? (switchFlush?.active() || script.isChatSaving) : undefined),
            saveTimeout: () => (Number(script.DEFAULT_SAVE_EDIT_TIMEOUT) > 0 ? Number(script.DEFAULT_SAVE_EDIT_TIMEOUT) : 1000),
            live: () => liveChatFrom(context()),
            save: () => saveFunction()(),
            enabled: () => settings().recover !== false,
            hidden: () => document.visibilityState === 'hidden',
            onChange: refreshStats,
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') recovery?.kick();
        });
    } catch (error) {
        recovery = null;
        recoveryUnsupported = true;
        console.info(`[${TITLE}] 밀린 저장 되살리기를 켜지 못했어요`, error);
    }
}

// ── 닫힌 프롬프트 관리자 계산 미루기 ─────────────────────────────

/** 목록이 그려지는지 (닫힌 서랍 · display:none 조상이면 false) */
function isShown(el) {
    if (!el?.isConnected) return false;
    if (typeof el.checkVisibility === 'function') return el.checkVisibility();
    return el.getClientRects().length > 0;
}

/**
 * 목록이 보이기 시작할 수 있는 때를 알린다: 조상(서랍 · 설정 블록)의 class · style 이 바뀔 때, 그리고 화면에 들어올 때.
 * 미뤄 둔 것이 있는 동안만 본다.
 */
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

function installPromptDefer() {
    promptDefer = createPromptDefer({
        manager: () => openai.promptManager ?? null,
        enabled: () => settings().deferPromptRender !== false,
        visible: isShown,
        watch: watchShown,
        onChange: refreshStats,
    });
    if (promptDefer.install()) return;
    // 프롬프트 관리자는 설정을 읽을 때 만들어진다 — 아직이면 앱 준비 뒤에 다시
    try {
        script.eventSource?.on?.(script.event_types?.APP_READY, () => promptDefer.install());
    } catch { /* */ }
}

// ── 채팅 바꾸기 전 저장 마치기 ───────────────────────────────────

function shortStack() {
    const limit = Error.stackTraceLimit;
    try {
        Error.stackTraceLimit = 5;
        return String(new Error().stack);
    } finally {
        Error.stackTraceLimit = limit;
    }
}

// setTimeout 마다 불리므로 가볍게 (실리태번 상수 그대로)
const saveDelay = () => script.DEFAULT_SAVE_EDIT_TIMEOUT;

/**
 * 지금 채팅 키 · integrity 를 가볍게. 데우스 프리셋은 프롬프트 한 번에 saveMetadataDebounced 를 수백 번 부르고 그때마다
 * 타이머가 새로 걸리는데, getContext() 는 한 번에 ~0.1 ms(4× CPU)라 실리태번 내보내기를 바로 읽는다. 없으면 getContext() 로.
 * 키 모양은 recovery.js liveChatFrom 과 같다 (c|아바타|파일, g|채팅id).
 */
function quickLive() {
    if (!Array.isArray(script.characters) || typeof script.getCurrentChatId !== 'function' || !('selected_group' in groupChats)) return liveChatFrom(context());
    const integrity = script.chat_metadata?.integrity;
    if (groupChats.selected_group) {
        const id = script.getCurrentChatId();
        return { key: id ? `g|${id}` : null, integrity, length: Array.isArray(script.chat) ? script.chat.length : 0 };
    }
    const chid = script.this_chid;
    const character = chid !== undefined && chid !== null && chid !== '' ? script.characters[chid] : null;
    return { key: character?.chat && character?.avatar ? `c|${character.avatar}|${character.chat}` : null, integrity, length: Array.isArray(script.chat) ? script.chat.length : 0 };
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** 지금 채팅 저장이 wallMs(Date.now 기준) 뒤에 시작해 성공했는지 — lastOk 는 performance.now() 로 적혀 있다 */
function savedSinceWall(key, wallMs) {
    const start = lastOk.get(key);
    return start !== undefined && performance.timeOrigin + start > wallMs;
}

function installSwitchGuard() {
    if (typeof script.isGenerating !== 'function' || !('streamingProcessor' in script)) return;
    switchGuard = createSwitchGuard({
        isGenerating: () => script.isGenerating(),
        processor: () => script.streamingProcessor ?? null,
        messageAt: id => (Array.isArray(script.chat) ? script.chat[id] : null),
        now: () => performance.now(),
        savedSinceWall,
    });
}

const guardOn = () => !!switchGuard && settings().guardGeneration !== false;
const flushOn = () => !!switchFlush && settings().flushOnSwitch !== false;

function installSwitchFlush() {
    window.addEventListener('click', onSwitchClick, true);
    if (typeof script.isChatSaving !== 'boolean' || typeof script.saveChatConditional !== 'function') return;
    const nativeSet = window.setTimeout;
    const nativeClear = window.clearTimeout;
    saveTimers = createSaveTimers({
        nativeSet: (fn, ms, ...rest) => nativeSet.call(window, fn, ms, ...rest),
        nativeClear: id => nativeClear.call(window, id),
        delay: saveDelay,
        stack: shortStack,
        live: quickLive,
        enabled: () => settings().flushOnSwitch !== false,
        now: () => performance.now(),
    });
    window.setTimeout = saveTimers.setTimeout;
    window.clearTimeout = saveTimers.clearTimeout;
    switchFlush = createSwitchFlush({
        now: () => performance.now(),
        sleep,
        isSaving: () => script.isChatSaving,
        timers: saveTimers,
        live: quickLive,
        recoveryPending: () => recovery?.pending() ?? null,
        recoveryBusy: () => !!recovery?.inCall(),
        save: () => script.saveChatConditional(),
        savedSince: (key, since) => (lastOk.get(key) ?? -Infinity) >= since,
        onChange: refreshStats,
        // [1.1.1] 스트리밍 답 마무리 · 끊긴 스트림의 답 (막기를 꺼도 저장 마치기는 기다린다)
        finishing: () => switchGuard?.state() === 'finishing',
        generating: () => guardOn() && switchGuard.state() === 'generating',
        erroredUnsaved: live => !!switchGuard?.erroredUnsaved(live),
    });
}

/** 막았다고 알린다 (같은 알림이 떠 있으면 또 띄우지 않는다) */
function showBlocked() {
    if (switchGuard) switchGuard.stats.blocked++;
    refreshStats();
    if (typeof toastr !== 'undefined') toastr.info('답이 끝나면 바꿀 수 있어요', '', { preventDuplicates: true, timeOut: 2500 });
}

/**
 * [1.1.1] 채팅을 바꾸는 슬래시 명령: 답을 받는 중이면 막고(명령 줄도 멈춘다), 남은 저장이 있으면 마친 뒤 부른다.
 * @returns {Promise<boolean>} 막았으면 true
 */
async function commandBlocked() {
    if (guardOn() && switchGuard.state() === 'generating') return true;
    if (flushOn() && switchFlush.pending()) await switchFlush.run();
    return guardOn() && !!switchGuard.state();
}

const guardedCommands = new WeakSet();
function installCommandGuard() {
    try {
        const commands = context()?.SlashCommandParser?.commands;
        wrapCommands(commands, GUARD_COMMANDS, original => async function saveDedupeGuardedCommand(args, value) {
            if (await commandBlocked()) {
                if (switchGuard) switchGuard.stats.commands++;
                showBlocked();
                try { args?._abortController?.abort?.('답을 받는 중', true); } catch { /* 명령 줄은 그대로 */ }
                return '';
            }
            return original.call(this, args, value);
        }, guardedCommands);
    } catch (error) {
        console.info(`[${TITLE}] 슬래시 명령을 감싸지 못했어요`, error);
    }
}

let replaying = false;
/** 붙잡은 동안 마지막으로 누른 채팅 바꾸기 클릭 */
let queued = null;

function clickInit(event) {
    const init = { bubbles: true, cancelable: true, composed: true, view: window };
    for (const k of ['detail', 'screenX', 'screenY', 'clientX', 'clientY', 'ctrlKey', 'shiftKey', 'altKey', 'metaKey', 'button', 'buttons']) {
        if (event[k] !== undefined) init[k] = event[k];
    }
    return init;
}

/** 저장하는 사이 목록이 다시 그려졌으면 같은 항목을 다시 찾는다 */
function findAgain(el, selector) {
    if (el.isConnected) return el;
    const attrs = ['data-chid', 'data-grid', 'file_name', 'data-file', 'data-avatar', 'data-group'];
    if (el.id) return document.getElementById(el.id);
    const parts = attrs.filter(a => el.hasAttribute?.(a)).map(a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`);
    if (!parts.length || !selector) return null;
    return document.querySelector(selector + parts.join(''));
}

const GUARD_ENTRIES = Object.freeze([...SWITCH_ENTRIES, [DELETE_ENTRY, null]]);
/** 저장하는 사이 목록이 다시 그려졌을 때 같은 항목을 찾을 선택자 */
const REFIND_SELECTORS = ['.character_select', '.group_select', '.select_chat_block', '.recentChat', '.renameChatButton', '.mes_bookmark', '.mes_create_branch', '.swipe_picker_branch'];

/**
 * 이 누름(진짜 클릭이든 jQuery trigger 든)을 어떻게 할지 — 'block' 은 막기, 'hold' 는 저장을 마친 뒤 다시 보내기.
 * @returns {{ action: 'block'|'hold', el: any }|null}
 */
function switchDecision(target) {
    const guard = guardOn() ? switchGuard.state() : null;
    const flush = flushOn() && switchFlush.pending();
    if (!guard && !flush) return null;
    const el = matchSwitchEntry(target, GUARD_ENTRIES);
    if (!el) return null;
    const isDelete = !!el.matches?.(DELETE_ENTRY);
    // [1.1.1] 답을 받는 중이면 막는다. 지우기, 저장 마치기를 끈 경우는 마무리 중에도 막는다 (기다렸다 넘길 수 없다)
    if (guard === 'generating' || (guard && (isDelete || !flushOn()))) return { action: 'block', el };
    if (isDelete || !flush) return null;
    return { action: 'hold', el };
}

/** 붙잡은 누름을 줄 세우고 (마지막 것이 이긴다), 남은 저장을 마친 뒤 다시 보낸다 */
function queueSwitch(entry) {
    queued = entry;
    switchFlush.stats.intercepted++;
    if (switchFlush.active()) return;
    let toast = null;
    const toastTimer = setTimeout(() => {
        if (typeof toastr !== 'undefined') toast = toastr.info('저장을 마치고 넘어가요', TITLE, { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
    }, 700);
    switchFlush.run().finally(() => {
        clearTimeout(toastTimer);
        if (toast && typeof toastr !== 'undefined') toastr.clear(toast);
        replaySwitchClick();
    });
}

function onSwitchClick(event) {
    if (replaying) return;
    const decision = switchDecision(event.target);
    if (!decision) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (decision.action === 'block') {
        showBlocked();
        return;
    }
    const el = decision.el;
    queueSwitch({ kind: 'click', el, selector: REFIND_SELECTORS.find(s => el.matches?.(s)) ?? null, init: clickInit(event) });
}

function replaySwitchClick() {
    const q = queued;
    queued = null;
    if (!q) return;
    let el = null;
    try {
        el = findAgain(q.el, q.selector);
    } catch {
        el = null;
    }
    // [1.1.1] 기다리는 사이 답 받기가 시작됐거나 마무리가 안 끝났으면 넘기지 않는다
    if (guardOn() && switchGuard.state()) {
        switchFlush?.note('replay-blocked');
        showBlocked();
        return;
    }
    switchFlush?.note('replay', { found: !!el, kind: q.kind });
    // [1.1.2] 저장하는 사이 목록이 다시 그려져 누른 자리를 못 찾으면 조용히 사라지지 않게 알린다
    if (!el) {
        if (typeof toastr !== 'undefined') toastr.info('저장을 마쳤어요. 다시 눌러 주세요', TITLE, { preventDuplicates: true, timeOut: 4000 });
        return;
    }
    replaying = true;
    try {
        // [1.1.2] jQuery .trigger('click') 로 온 것은 같은 길로 돌려보낸다 (실리태번의 위임 핸들러는 jQuery 쪽에서만 돈다)
        if (q.kind === 'trigger' && nativeTrigger) nativeTrigger.call(window.jQuery(el), ...q.args);
        else el.dispatchEvent(new MouseEvent('click', q.init));
    } finally {
        replaying = false;
    }
}

// ── [1.1.2] 코드로 채팅을 바꾸는 길 ──────────────────────────

/** 감싸기 전의 jQuery.fn.trigger (다시 보낼 때 쓴다) */
let nativeTrigger = null;
const codeWrapped = new WeakMap();

/** 지금 채팅을 바꾸면 잃는 것이 있는지 */
function codeBusy() {
    if (guardOn()) {
        const state = switchGuard.state();
        if (state) return state;
    } else if (flushOn() && switchGuard?.state() === 'finishing') {
        return 'finishing';
    }
    if (flushOn() && switchFlush.pending()) return 'saving';
    return null;
}

function installCodeGuard() {
    if (!switchFlush && !switchGuard) return;
    let toast = null;
    let toastTimer = null;
    codeGuard = createCodeGuard({
        enabled: () => guardOn() || flushOn(),
        busy: codeBusy,
        flush: () => (flushOn() ? switchFlush.run() : Promise.resolve()),
        sleep,
        now: () => performance.now(),
        onStart: () => {
            toastTimer = setTimeout(() => {
                if (typeof toastr !== 'undefined') toast = toastr.info('답이 끝나면 할게요', TITLE, { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false });
            }, 700);
        },
        onEnd: () => {
            clearTimeout(toastTimer);
            if (toast && typeof toastr !== 'undefined') toastr.clear(toast);
            toast = null;
            refreshStats();
        },
    });
    installReloadGuard();
    installContextGuard();
    installTriggerGuard();
}

/**
 * 실리태번의 reloadCurrentChat 은 reloadChatMutex.update 에 묶여 있고, update 는 부를 때마다 this.callback 을 읽는다.
 * 그 callback 을 감싸면 코어(정규식 편집기 · 페르소나 · 사용자 설정 · 이름 바꾸기 · /chat-reload)와 확장 모두 잡힌다.
 */
function installReloadGuard() {
    const mutex = script.reloadChatMutex;
    if (!mutex || typeof mutex.callback !== 'function' || mutex.callback.name === 'saveDedupeGuardedReload') return;
    const original = mutex.callback;
    mutex.callback = async function saveDedupeGuardedReload(...args) {
        await codeGuard.hold('reload');
        return original.apply(this, args);
    };
}

/** getContext() 는 부를 때마다 새 객체를 만든다 → getContext 자체를 감싸 채팅 바꾸는 함수만 바꿔 준다 */
function installContextGuard() {
    const holder = window.SillyTavern;
    if (!holder || typeof holder.getContext !== 'function' || holder.getContext.name === 'saveDedupeGetContext') return;
    const original = holder.getContext;
    holder.getContext = function saveDedupeGetContext(...args) {
        const ctx = original.apply(this, args);
        if (ctx && codeGuard) {
            for (const key of CODE_SWITCH_KEYS) {
                const fn = ctx[key];
                if (typeof fn === 'function') ctx[key] = guardedSwitchFn(fn);
            }
        }
        return ctx;
    };
}

function guardedSwitchFn(original) {
    let wrapper = codeWrapped.get(original);
    if (!wrapper) {
        wrapper = async function saveDedupeGuardedSwitch(...args) {
            await codeGuard.hold('switch');
            return original.apply(this, args);
        };
        codeWrapped.set(original, wrapper);
    }
    return wrapper;
}

/**
 * jQuery 는 .trigger('click') 에서 자기 핸들러(실리태번의 위임 처리)를 먼저 부르고 그 다음에야 진짜 click 을 쏘므로
 * 창의 capture 리스너로는 늦는다 (/delchat 처럼 실리태번 자신도 이렇게 누른다). 여기서 같은 판단을 먼저 한다.
 */
function installTriggerGuard() {
    const jq = window.jQuery;
    if (!jq?.fn || typeof jq.fn.trigger !== 'function' || jq.fn.trigger.name === 'saveDedupeGuardedTrigger') return;
    nativeTrigger = jq.fn.trigger;
    jq.fn.trigger = function saveDedupeGuardedTrigger(event, ...rest) {
        if (!replaying && isClickTrigger(event) && (switchGuard || switchFlush)) {
            let decision = null;
            try {
                decision = switchDecision(this[0]);
            } catch {
                decision = null;
            }
            if (decision?.action === 'block') {
                showBlocked();
                return this;
            }
            if (decision?.action === 'hold') {
                const el = decision.el;
                queueSwitch({ kind: 'trigger', el, selector: REFIND_SELECTORS.find(s => el.matches?.(s)) ?? null, args: [event, ...rest] });
                return this;
            }
        }
        return nativeTrigger.call(this, event, ...rest);
    };
}

// ── 설정 서랍 ───────────────────────────────────────────────

let drawer = null;

function refreshStats() {
    const el = drawer?.querySelector('.sv-stats');
    if (!el) return;
    const mb = (stats.skippedBytes / 1048576).toFixed(1);
    const parts = [stats.skipped ? `건너뜀 ${stats.skipped}번 (${mb}MB)` : '', `보냄 ${stats.sent}번`];
    const recovered = recovery ? recovery.stats.recovered : 0;
    if (recovered) parts.push(`다시 저장 ${recovered}번`);
    if (recoveryUnsupported) parts.push('다시 저장 못 씀');
    if (promptDefer?.stats.deferred) parts.push(`토큰 계산 미룸 ${promptDefer.stats.deferred}번`);
    if (switchFlush?.stats.saved) parts.push(`바꾸기 전 저장 ${switchFlush.stats.saved}번`);
    if (switchGuard?.stats.blocked) parts.push(`바꾸기 막음 ${switchGuard.stats.blocked}번`);
    if (codeGuard?.stats.held) parts.push(`바꾸기 기다림 ${codeGuard.stats.held}번`);
    el.textContent = `이번 세션: ${parts.filter(Boolean).join(' · ')}`;
}

function buildDrawer() {
    const container = pane('dedupe'); // 2.0.0 톱니바퀴 설정 창의 탭 (hub.js)
    if (!container || drawer) return;
    drawer = document.createElement('div');
    drawer.id = 'save_dedupe_settings';
    drawer.className = 'sv-settings';
    drawer.innerHTML = `
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b><i class="fa-solid fa-floppy-disk"></i> ${TITLE} <span class="sv-version ext-version">v${VERSION}</span></b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <div class="sv-body">
                    <label class="checkbox_label sv-check" for="sv_enabled"><input type="checkbox" id="sv_enabled"><span>내용이 같은 채팅 저장은 건너뛰기</span></label>
                    <small class="sv-hint">프리셋의 변수 매크로가 턴마다 일으키는 헛저장을 막아요. 내용이 바뀐 저장은 그대로 보내요.</small>
                    <label class="checkbox_label sv-check" for="sv_recover"><input type="checkbox" id="sv_recover"><span>밀려서 빠진 저장 다시 하기</span></label>
                    <small class="sv-hint">저장이 1초를 넘으면 실리태번이 뒤따른 저장을 버려요. 앞 저장이 끝나면 한 번 더 저장해요.</small>
                    <label class="checkbox_label sv-check" for="sv_defer"><input type="checkbox" id="sv_defer"><span>닫힌 프롬프트 관리자 토큰 계산 미루기</span></label>
                    <small class="sv-hint">답장마다 프롬프트를 한 번 더 만드는 계산을 AI 응답 설정의 목록이 보일 때 해요.</small>
                    <label class="checkbox_label sv-check" for="sv_flush"><input type="checkbox" id="sv_flush"><span>채팅을 바꾸기 전에 남은 저장 마치기</span></label>
                    <small class="sv-hint">수정·스와이프 직후 채팅을 바꾸면 사라지던 내용을 저장하고 넘어가요.</small>
                    <label class="checkbox_label sv-check" for="sv_guard"><input type="checkbox" id="sv_guard"><span>답을 받는 동안 채팅 바꾸기 막기</span></label>
                    <small class="sv-hint">받던 답이 사라지거나 다른 채팅에 섞이지 않게 해요.</small>
                    <small class="sv-hint sv-stats"></small>
                </div>
            </div>
        </div>`;
    container.append(drawer);
    const bind = (id, key) => {
        const box = drawer.querySelector(id);
        box.checked = settings()[key] !== false;
        box.addEventListener('change', () => {
            settings()[key] = box.checked;
            script.saveSettingsDebounced?.();
        });
    };
    bind('#sv_enabled', 'enabled');
    bind('#sv_recover', 'recover');
    bind('#sv_defer', 'deferPromptRender');
    bind('#sv_flush', 'flushOnSwitch');
    bind('#sv_guard', 'guardGeneration');
    if (!switchFlush) drawer.querySelector('#sv_flush').disabled = true;
    if (!switchGuard) drawer.querySelector('#sv_guard').disabled = true;
    refreshStats();
}

function checkFilesMatch() {
    const cssVersion = getComputedStyle(document.documentElement).getPropertyValue('--sv-css-version').trim().replace(/["']/g, '');
    if (cssVersion === VERSION || typeof toastr === 'undefined') return;
    toastr.warning(`${TITLE} 파일이 섞였어요 (코드 ${VERSION}, 스타일 ${cssVersion || '예전 것'}). 블루 레몬에이드 업데이트 파일을 확인하고 새로고침해 주세요.`, TITLE, { timeOut: 15000 });
}

initSettings();
installDedupe();
hookDropWarning();
const recoveryReady = installRecovery();
installPromptDefer();
installSwitchGuard();
installSwitchFlush();
installCodeGuard();
installCommandGuard();
try {
    // 슬래시 명령이 아직 없으면 앱 준비 뒤에 다시 (이미 감싼 명령은 건너뛴다)
    script.eventSource?.on?.(script.event_types?.APP_READY, installCommandGuard);
} catch { /* */ }
window.SaveDedupe = {
    stats,
    settings,
    get recovery() { return recovery; },
    recoveryReady,
    get promptDefer() { return promptDefer; },
    get switchFlush() { return switchFlush; },
    get saveTimers() { return saveTimers; },
    get switchGuard() { return switchGuard; },
    get codeGuard() { return codeGuard; },
    debug: { quickLive, liveChat: () => liveChatFrom(context()) },
};

jQuery(() => {
    promptDefer?.install();
    buildDrawer();
    setTimeout(checkFilesMatch, 3000);
});
