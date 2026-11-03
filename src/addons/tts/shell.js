// TTS 껍데기 (1.0.0 극한 최적화) — 부팅 3층에서는 이것만 받아요: 화자 색(paint.js 가벼운 길) · 메시지 읽기 · 대본 단추 · 요술봉 두 줄 · 슬래시 명령 ·
//   LemonVoice 자리 · 인물표 · 기기 간 합치기. 본체(index.js · 재생기 · 엔진 · 분석 · 설정 화면 ≈ 1.2MB)는 처음 쓸 때(단추 · 대사 누름 · 생성 · 답 그려짐 ·
//   스와이프 · 지움 · 고침 · 이름 바꿈 · 서랍 · ✦ 메뉴 · 입력 · 설정 창 · 명령 · 바깥 API · 저장된 대사 분석이 있는 채팅)만 받고, 그 사이 들어온 실리태번 사건은
//   쌓아 두었다가 본체의 같은 처리기로 넘겨요(replayEvent). 화면 · 설정 키 · 동작은 본체 하나일 때와 같아요.
import { eventSource, event_types, chat, saveSettingsDebounced, getCurrentChatId } from '../../../../../../../script.js';
import { extensionNames, extension_settings } from '../../../../../../extensions.js';
import { SlashCommandParser } from '../../../../../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../../../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../../../../slash-commands/SlashCommandArgument.js';
import { getSettings as themeSettings } from '../../settings.js';
import { addonsEnabled } from '../../usage-mode.js';
import { withReplay } from '../../boot-layers.js';
import { onLateAddons } from '../../addons.js';
import { registerPeopleSource, peopleChanged, invalidatePeople } from '../../people.js';
import { registerAddonMerge } from '../list-sync.js';
import { runtimeEnabled, setRuntimeEnabled } from './src/runtime.js';
import { settings, SYNC_TEXT_FIELDS } from './src/settings.js';
import * as speakers from './src/speakers.js';
import * as paint from './src/paint.js';
import { TTS_VERSION as VERSION } from './version.js';
import { voiceOfName, voiceListPublic } from './src/voice-public.js';

const OWNER = Symbol.for('blue-lemonade.tts.owner');
const SHELL = Symbol.for('blue-lemonade.tts.shell');
export let duplicate = false;
let body = null, bodyPromise = null, started = false, observer = null;
let bodyModule = null, importAttempts = 0, chatEpoch = 0, playbackEpoch = 0, draining = false;
const queued = [];
const shellListeners = [];
const INTERACTIVE = 'a, button, input, textarea, select, img, video, audio, details, summary, code, pre, .mes_button, [contenteditable]';   // clickplay.js 와 같은 목록

function hasOtherOwner() {
    const disabled = extension_settings.disabledExtensions || [];
    return ['tts', 'lemon-voice', 'lemon-tts'].some(name => extensionNames.includes(`third-party/${name}`) && !disabled.includes(`third-party/${name}`))
        || (!!window.LemonVoice && !window.LemonVoice.blShell) || !!document.getElementById('lv_settings') || (!!globalThis[OWNER] && globalThis[OWNER] !== 'builtin');
}
const msgOf = (id) => (Number.isInteger(id) && id >= 0 ? chat[id] : undefined);
const chatKey = () => { try { return getCurrentChatId(); } catch { return undefined; } };
const MESSAGE_EVENTS = new Set(['CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED'].map(k => event_types[k]).filter(Boolean));
function eventRecord(type, args) {
    const target = MESSAGE_EVENTS.has(type) ? msgOf(Number(args[0])) : null;
    return { type, args, epoch: chatEpoch, chatId: chatKey(), target, swipe: target?.swipe_id, chatLength: chat.length };
}
function currentEvent(event) {
    return runtimeEnabled() && event.epoch === chatEpoch && event.chatId === chatKey()
        && (!MESSAGE_EVENTS.has(event.type) || !!event.target && msgOf(Number(event.args[0])) === event.target && event.target.swipe_id === event.swipe);
}

/** 본체를 받아요(한 번) — 늦게 붙은 리스너에 지금 채팅을 알리고(withReplay), 받는 동안 쌓인 사건을 같은 처리기로 넘겨요 */
export function ensureBody(reason = '?') {
    if (bodyPromise) return bodyPromise;
    bodyPromise = withReplay(`TTS 본체(${reason})`, async () => {
        // 모듈을 받은 뒤 설정 화면 초기화만 실패했으면 같은 모듈에서 다시 시작해요.
        // 모듈 자체를 못 받았을 때만 새 URL로 한 번 더 받아요.
        if (!bodyModule) { const attempt = importAttempts++; bodyModule = await (attempt ? import(`./index.js?retry=${attempt}`) : import('./index.js')); }
        await bodyModule.ensureReady();
        return bodyModule;
    })
        .then(async m => {
            // 본체는 shell이 사건을 맡고 있으면 별도 리스너를 달지 않아요. 초기 상태 뒤 대기 사건을 한 번씩 넘겨요.
            await m.replayEvent(event_types.CHAT_CHANGED, [chatKey()]);
            body = m;
            observer?.disconnect(); observer = null;   // 단추는 본체의 감시자가
            draining = true;
            try {
                while (queued.length) {
                    const event = queued.shift();
                    if (currentEvent(event)) try { await m.replayEvent(event.type, event.args, event); } catch (error) { console.warn('[tts] 쌓아 둔 사건 넘기기', error); }
                }
            } finally { draining = false; }
            return m;
        }).catch(error => { bodyPromise = null; throw error; });
    bodyPromise.catch(error => console.error('[tts] 본체를 불러오지 못했어요', error));
    return bodyPromise;
}
const withBody = (reason, fn) => ensureBody(reason).then(fn).catch(() => {});
function cancelPendingPlayback() { playbackEpoch++; pendingTap = null; queued.length = 0; }
function stopPlayback() { cancelPendingPlayback(); if (body) body.stopPlayback(); }

// ---------- 메시지 단추 (index.js addButtonsTo 와 같은 DOM · 같은 순서)
function addButtonsTo(el) {
    const mes = msgOf(Number(el.getAttribute('mesid')));
    if (mes && mes.is_system) return;
    const box = el.querySelector('.extraMesButtons');
    if (!box) return;
    const add = [];
    if (!el.querySelector('.lv_play')) {
        const btn = document.createElement('div');
        btn.className = 'mes_button lv_play fa-solid fa-volume-high interactable';
        btn.tabIndex = 0; btn.setAttribute('role', 'button'); btn.setAttribute('aria-label', '읽기');
        add.push(btn);
    }
    if (!el.querySelector('.lv_script')) {
        const edit = document.createElement('div');
        edit.className = 'mes_button lv_script fa-solid fa-file-audio interactable';
        edit.tabIndex = 0; edit.setAttribute('role', 'button'); edit.setAttribute('aria-label', '소리 대본 편집');
        if (add.length) add.push(edit); else box.prepend(edit);
    }
    if (add.length) box.prepend(...add);
}
function addButtons() {
    if (!runtimeEnabled() || body) return;
    for (const el of document.querySelectorAll('#chat .mes')) addButtonsTo(el);
}
function addButtonsFor(records) {
    if (!runtimeEnabled() || body) return;
    for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.classList.contains('mes')) addButtonsTo(node);
        else for (const el of node.querySelectorAll?.('.mes') || []) addButtonsTo(el);
    }
}
const isKey = (e) => e.key === 'Enter' || e.key === ' ';
function onButton(e) {
    if (body || !runtimeEnabled()) return;
    const el = e.target?.closest?.('#chat .mes .lv_play, #chat .mes .lv_script');
    if (!el) return;
    if (e.type === 'keydown') { if (!isKey(e)) return; e.preventDefault(); }
    const script = el.classList.contains('lv_script');
    if (script) e.stopPropagation();
    const epoch = chatEpoch, key = chatKey(), play = playbackEpoch;
    withBody('단추', m => {
        if (!runtimeEnabled() || epoch !== chatEpoch || key !== chatKey() || !el.isConnected || !script && play !== playbackEpoch) return;
        return script ? m.scriptButton(el) : m.playButton(el);
    });
}
// 대사 누르기(clickplay) · 이름 꾹 누르기는 본체가 받아요 — 본체가 오기 전 처음 누른 대사는 받은 뒤 같은 자리에 한 번 다시 눌러 줘요
let pendingTap = null;
function onChatClick(e) {
    if (body || !runtimeEnabled() || e.isTrusted === false) return;
    const t = e.target;
    if (!t?.closest?.('#chat .mes .mes_text') || t.closest(INTERACTIVE)) return;
    pendingTap = { target: t, x: e.clientX, y: e.clientY, at: Date.now(), play: playbackEpoch };
    withBody('대사 누름', () => {
        const tap = pendingTap; pendingTap = null;
        if (!tap || tap.play !== playbackEpoch || Date.now() - tap.at > 8000 || !tap.target.isConnected) return;
        tap.target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: tap.x, clientY: tap.y, view: window }));
    });
}

// ---------- 요술봉 두 줄 (index.js addWand 와 같은 DOM — 본체가 오면 그 줄을 그대로 써요)
function addWand() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('lv_wand')) return;
    const item = (id, icon, label) => {
        const d = document.createElement('div');
        d.id = id; d.className = 'list-group-item flex-container flexGap5 interactable'; d.tabIndex = 0; d.setAttribute('role', 'button');
        d.innerHTML = `<div class="fa-solid ${icon} extensionsMenuExtensionButton"></div><span>${label}</span>`;
        return d;
    };
    const wand = item('lv_wand', 'fa-volume-high', 'TTS'), stopItem = item('lv_wand_stop', 'fa-stop', 'TTS 정지');
    const open = () => withBody('요술봉', m => m.openPanel());
    const stop = stopPlayback;
    const onKey = (fn) => (e) => { if (isKey(e)) { e.preventDefault(); fn(); } };
    wand.addEventListener('click', open); wand.addEventListener('keydown', onKey(open));
    stopItem.addEventListener('click', stop); stopItem.addEventListener('keydown', onKey(stop));
    menu.append(wand, stopItem);
}
function removeWand() { for (const id of ['lv_wand', 'lv_wand_stop']) document.getElementById(id)?.remove(); }
function syncWand() { if (runtimeEnabled() && settings().wand_menu !== false) addWand(); else removeWand(); }

// ---------- 슬래시 명령 (본체 index.js 와 같은 이름 · 도움말 — 콜백은 본체를 받아 runCommand 로)
function addSlashCommands() {
    const run = (name) => (args, value) => {
        if (name === 'lv-stop') { stopPlayback(); return ''; }
        const play = playbackEpoch;
        return ensureBody(`/${name}`).then(m => {
            if ((name === 'lv' || name === 'lv-read') && play !== playbackEpoch) return '';
            return m.runCommand(name, args, value);
        });
    };
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lv', callback: run('lv'),
        namedArgumentList: [SlashCommandNamedArgument.fromProps({ name: 'voice', description: '목소리 uid 또는 이름', typeList: [ARGUMENT_TYPE.STRING] })],
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '읽을 글', typeList: [ARGUMENT_TYPE.STRING], isRequired: true })],
        helpString: 'TTS로 글 읽기. 예: <code>/lv voice=안내 안녕</code>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'lv-stop', callback: run('lv-stop'), helpString: 'TTS 정지' }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lv-read', callback: run('lv-read'),
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '메시지 번호 (비우면 마지막)', typeList: [ARGUMENT_TYPE.NUMBER] })],
        helpString: '메시지를 TTS로 읽기. 예: <code>/lv-read 12</code>',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lv-analyze', callback: run('lv-analyze'),
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: '메시지 번호 (비우면 마지막)', typeList: [ARGUMENT_TYPE.NUMBER] })],
        helpString: '메시지의 대사를 다시 분석 (감정 · 원어 읽기). 예: <code>/lv-analyze 12</code>',
    }));
}

// ---------- 다른 스크립트용 자리 (본체가 오면 같은 이름의 진짜 객체로 바뀌어요)
function installApi() {
    const real = () => { const api = window.LemonVoice; return api && !api.blShell ? api : null; };
    const later = (name) => (...args) => {
        const play = playbackEpoch;
        return ensureBody('LemonVoice').then(() => {
            if ((name === 'speakText' || name === 'readText') && play !== playbackEpoch) return;
            const api = real(); if (!api) throw new Error('TTS 본체가 없어요'); return api[name](...args);
        });
    };
    window.LemonVoice = Object.freeze({
        blShell: true, version: VERSION,
        speakText: later('speakText'), readText: later('readText'), voiceOf: opts => voiceOfName(opts && typeof opts === 'object' ? opts : { name: opts }), synth: later('synth'),
        stop: stopPlayback,
        voices: voiceListPublic,
        callFx: () => import('./src/fx-call.js'),
    });
}

// ---------- 인물표 (본체 peopleSource 와 같은 이름 · 색 — 목소리는 본체가 등록하면서 채워요)
const peopleSource = {
    person(names) {
        if (!runtimeEnabled()) return null;
        ensureBody('인물표');
        let color = null;
        for (const n of names) { color ??= speakers.colorOfName(n); if (color) break; }
        return { names: speakers.namesOf(names[0]), color, voice: null };
    },
    names() { return runtimeEnabled() ? speakers.peopleNames() : []; },
    stamp: () => [runtimeEnabled(), ...speakers.peopleInputs()],
};

// ---------- 실리태번 사건: 처음 오면 본체를 받고, 받는 동안 쌓아요
const TRIGGERS = ['GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'STREAM_TOKEN_RECEIVED', 'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED',
    'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'CHARACTER_RENAMED', 'GROUP_WRAPPER_STARTED', 'GROUP_WRAPPER_FINISHED'];
function listen() {
    for (const key of TRIGGERS) {
        const type = event_types[key];
        if (!type) continue;
        const fn = (...args) => {
            if (!runtimeEnabled()) return;
            const event = eventRecord(type, args);
            if (body && !draining) return body.replayEvent(type, args, event);
            queued.push(event); ensureBody(key);
        };
        if ((key === 'CHARACTER_MESSAGE_RENDERED' || key === 'USER_MESSAGE_RENDERED') && eventSource.makeLast) eventSource.makeLast(type, fn);
        else eventSource.on(type, fn);
        shellListeners.push([type, fn]);
    }
    eventSource.on(event_types.CHAT_CHANGED, () => {
        chatEpoch++; queued.length = 0; pendingTap = null;
        if (body) return body.replayEvent(event_types.CHAT_CHANGED);
        if (!runtimeEnabled()) return;
        addButtons();
        try { paint.onChatChanged(); } catch (error) { console.warn('[tts] 화자 색', error); }
        peopleChanged();
    });
    if (event_types.APP_READY) eventSource.on(event_types.APP_READY, () => { if (!body) syncWand(); });
}

/** 저장된 대사 분석이 있는 채팅은 화자 색이 그 분석을 봐야 해요(본체 판단과 같게) — 그때는 예전처럼 바로 본체 */
function needsBodyForPaint() {
    const s = settings();
    const an = s.analysis && typeof s.analysis === 'object' ? s.analysis : null;
    if (s.speaker_paint === false || !an?.enabled || an.speaker === false) return false;
    return chat.some(m => m && !m.is_user && !m.is_system && m.extra && typeof m.extra === 'object' && m.extra.lemon_voice && typeof m.extra.lemon_voice === 'object' && m.extra.lemon_voice.analysis);
}

function startShell() {
    if (started) return; started = true;
    globalThis[SHELL] = { commands: true, managesEvents: true, ensureBody, cancelPendingPlayback };
    addSlashCommands();
    installApi();
    registerPeopleSource('tts', peopleSource);
    try { registerAddonMerge('tts', { module: 'lemon_voice', store: () => extension_settings.lemon_voice, text: SYNC_TEXT_FIELDS, stampKey: 'field_stamps', save: saveSettingsDebounced, onChange: () => invalidatePeople() }); }
    catch (error) { console.warn('[tts] 기기 간 합치기', error); }
    document.addEventListener('click', onButton); document.addEventListener('keydown', onButton);
    document.addEventListener('click', onChatClick, true);
    listen();
    onLateAddons(reason => ensureBody(reason));
}
function startVisible() {
    const chatEl = document.getElementById('chat');
    if (chatEl && !observer) { observer = new MutationObserver(addButtonsFor); observer.observe(chatEl, { childList: true }); }
    addButtons();
    syncWand();
    try { paint.init(); } catch (error) { console.warn('[tts] 화자 색 시작', error); }
}
function stopVisible() {
    chatEpoch++; cancelPendingPlayback();
    observer?.disconnect(); observer = null;
    removeWand();
    document.querySelectorAll('#chat .lv_play, #chat .lv_script').forEach(el => el.remove());
    try { paint.destroy(); } catch { /* 없음 */ }
}
/** addons.js 가 켜고 끌 때 · 아이콘을 맞출 때: 본체가 있으면 본체가, 없으면 껍데기가 맞춰요 */
export function syncEnabled() {
    if (body) return body.syncEnabled();
    const s = themeSettings();
    const on = !duplicate && addonsEnabled(s) && s.addons?.tts === true;
    setRuntimeEnabled(on);
    if (started) { if (on) startVisible(); else stopVisible(); }
    peopleChanged();
    return on;
}
export const openPanel = () => withBody('설정 열기', m => m.openPanel());
export function mountInline(host) {
    let cancelled = false, off = null;
    ensureBody('설정 창').then(m => { if (!cancelled) off = m.mountInline(host); }).catch(() => { if (!cancelled) host.textContent = 'TTS 설정을 불러오지 못했어요. 새로고침 후 다시 확인해 주세요.'; });
    return () => { cancelled = true; off?.(); };
}

export const ready = new Promise((resolve, reject) => jQuery(() => { try {
    if (hasOtherOwner()) { duplicate = true; setRuntimeEnabled(false); resolve(); return; }
    globalThis[OWNER] = 'builtin';
    if (!syncEnabled()) { startShell(); resolve(); return; }
    startShell();
    startVisible();
    if (needsBodyForPaint()) { globalThis[SHELL].bodyAtBoot = true; ensureBody('저장된 대사 분석'); globalThis[Symbol.for('blue-lemonade.translator.shell')]?.ensureBody?.('TTS 화자 색 분석'); }
    resolve();
} catch (error) { reject(error); } }));
