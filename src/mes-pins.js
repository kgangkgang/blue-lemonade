// 메시지 버튼 고정 (4.1.3): ··· 메뉴 안의 버튼 중 고른 것만 메뉴를 열지 않아도 이름 줄에 늘 보이게 한다.
// 복제하지 않고 진짜 버튼을 버튼 줄로 옮긴다 — 실리태번 · 다른 확장이 건 클릭 처리, 켜짐 표시, 숨김 상태가 그대로 따라온다.
// 옮긴 자리에는 주석 노드를 남겨 두었다가, 고정을 풀거나 테마를 끄면 원래 순서 그대로 메뉴에 돌려놓는다.
// 감시자는 두지 않는다: 메시지가 그려지는 이벤트와 ··· 를 누르는 순간에만 훑는다 (대기 중 콜백 0).

import { getSettings, saveSettings } from './settings.js';
import { watchDom } from './dom-watch.js';

import { GENERIC, PAIRS, PAIRED, PIN_LIMIT, KNOWN_PINS, tidyPins } from './mes-pins-keys.js';   // 9.0.9 통합: 설정 정리(settings.js)가 쓰는 순수 부분 — 이 파일(감시 허브 포함)은 2층(features.js)에서만 받아요
export { PIN_LIMIT, tidyPins };

const slots = new WeakMap();
let pins = [];
let order = [];
let active = false;
let timers = [];
let bound = null;

/** 버튼 하나의 이름표: 공통 클래스를 뺀 첫 클래스 (mes_translate · mes_llm_translate …) */
// 1.0.0 극한 최적화: 단추 class 문자열마다 한 번만 — 300개 채팅 열기에서 단추마다 classList 펼치기 · 정규식이 폰 4배 89ms(프로파일 chatLong300 테마 1위)
const pinKeyCache = new Map();
const basePinKey = el => {
    const cls = el.className;
    if (typeof cls !== 'string') return [...(el.classList || [])].find(name => !GENERIC.test(name)) || '';   // SVG · 시험의 가짜 요소
    let key = pinKeyCache.get(cls);
    if (key === undefined) { key = [...(el.classList || [])].find(name => !GENERIC.test(name)) || ''; if (pinKeyCache.size < 4000) pinKeyCache.set(cls, key); }
    return key;
};
export function pinKey(el) {
    const base = basePinKey(el);
    // Extensions can use one common class for several actions. Keep the saved
    // stock keys, but distinguish stable action attributes without using titles.
    const action = ['data-action', 'data-act', 'data-stbs', 'data-event'].map(key => el.getAttribute(key)).filter(value => value !== null).join('|');
    if (!base || !action) return base;
    let hash = 2166136261;
    for (const char of action) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return `${base.slice(0, 50)}__${(hash >>> 0).toString(36)}`;
}
// 1.2.1 고를 단추인가: 이름표(base)가 바로 맞으면 끝. 아니면 pinKey 는 base 그대로이거나 「base 앞 50자__해시」라, 고른 열쇠 가운데 그 앞부분(마지막 __ 앞)이
//   이 단추의 base 와 같은 것이 없으면 맞을 수가 없어요 — 그때는 동작 속성 넷을 읽고 이어 붙이는 pinKey 를 만들지 않아요(300개 채팅 × 메뉴 단추 십수 개를 두 번 훑어요).
//   답은 예전(pinKey 가 맞거나 base 가 맞거나)과 같아요. 해시는 36진(밑줄 없음)이라 마지막 __ 가 base 와 해시의 경계예요. 시험 tools/tests/mes-pins-one.mjs
let basesFor = null, wantedBases = null;
function actionBases(wanted) {
    if (basesFor === wanted) return wantedBases;
    basesFor = wanted; wantedBases = new Set();
    for (const key of wanted) { const i = key.lastIndexOf('__'); if (i > 0) wantedBases.add(key.slice(0, i)); }
    return wantedBases;
}
const wantedKey = (el, wanted) => {
    const base = basePinKey(el);
    if (wanted.has(base)) return true;
    if (!base || !actionBases(wanted).has(base.slice(0, 50))) return false;
    return wanted.has(pinKey(el));
};

/** 설정 창의 고르기 목록: 메시지 틀과 지금 채팅의 마지막 메시지에서 메뉴 버튼을 모은다 (다른 확장이 메시지마다 붙이는 버튼 포함) */
export function listMenuButtons() {
    const found = new Map();
    const template = [...document.querySelectorAll('#message_template .mes_buttons > .extraMesButtons > *')];
    const stock = new Set(template.map(pinKey));
    const take = (el) => {
        const key = pinKey(el);
        // 다른 확장이 자기 설정으로 숨겨 둔 버튼은 빼고, 실리태번이 메시지에 따라 숨기는 기본 버튼(프롬프트 보기 등)은 남긴다
        if (!key || PAIRED.has(key) || found.has(key) || (el.style.display === 'none' && !stock.has(key))) return;
        const icon = [...el.classList].filter(c => /^fa(-|$)/.test(c)).join(' ');
        const title = (el.getAttribute('title') || el.getAttribute('aria-label') || '').trim();
        found.set(key, { key, icon: icon || KNOWN_PINS[key]?.[0] || 'fa-solid fa-puzzle-piece', title: title || KNOWN_PINS[key]?.[1] || '다른 확장 단추' });
    };
    const last = [...document.querySelectorAll('#chat > .mes')].at(-1);
    // 꺼내 둔 버튼은 메뉴에 남긴 자리 표시(주석 노드) 순서로 — 고를 때마다 목록 순서가 바뀌지 않게
    const bar = last?.querySelector('.mes_buttons');
    const moved = new Map([...(bar?.querySelectorAll(':scope > .bl-pinned') || [])].map(el => [slots.get(el), el]));
    for (const node of bar?.querySelector(':scope > .extraMesButtons')?.childNodes || []) {
        if (node.nodeType === 1) take(node);
        else if (moved.has(node)) take(moved.get(node));
    }
    template.forEach(take);
    rememberNames(found.values());
    return [...found.values()];
}

// 1.0.0 후보: 고정해 둔 단추가 지금 안 잡혀도 고르기 목록에 사람이 읽는 이름 · 아이콘으로 — 테마 단추는 KNOWN_PINS, 다른 확장 단추는 이 기기에서 본 이름(최대 40개)
const NAMES_KEY = 'bl_mespin_names';
function readNames() { try { const v = JSON.parse(localStorage.getItem(NAMES_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
function rememberNames(items) {
    const names = readNames(); let changed = false;
    for (const { key, icon, title } of items) {
        if (KNOWN_PINS[key] || title === '다른 확장 단추' || names[key]?.[1] === title) continue;
        delete names[key]; names[key] = [icon, title]; changed = true;
    }
    if (!changed) return;
    const keys = Object.keys(names); for (const k of keys.slice(0, Math.max(0, keys.length - 40))) delete names[k];
    try { localStorage.setItem(NAMES_KEY, JSON.stringify(names)); } catch { /* 저장 못 해도 이름만 덜 친절해져요 */ }
}
/** 지금 채팅에서 안 잡힌 고정 단추의 이름 · 아이콘 (열쇠 이름은 보이지 않아요) */
export function pinLabel(key) {
    const [icon, title] = KNOWN_PINS[key] || readNames()[key] || ['fa-solid fa-puzzle-piece', '다른 확장 단추'];
    return { key, icon, title };
}

function restore(el) {
    const slot = slots.get(el);
    const bar = el.parentElement;
    if (slot?.isConnected) slot.replaceWith(el);
    else bar?.querySelector(':scope > .extraMesButtons')?.append(el);
    slots.delete(el);
    el.classList.remove('bl-pinned');
    delete el.dataset.blPin;
    bar?.classList.remove('bl-menu-empty');
}

function pin(el) {
    const menu = el.parentElement;
    const bar = menu?.parentElement;
    if (!bar?.classList.contains('mes_buttons')) return;
    const key = pinKey(el);   // 1.2.1 한 번만 만들어요(예전: 이미 꺼낸 단추마다 · 차례 찾기에 또) — 같은 요소 · 같은 속성이라 답이 같아요
    if ([...bar.querySelectorAll(':scope > .bl-pinned')].some(other => pinKey(other) === key)) return;
    const ownRank = order.indexOf(key);
    const rank = ownRank >= 0 ? ownRank : order.indexOf(basePinKey(el));
    const slot = document.createComment('bl-pin');
    menu.insertBefore(slot, el);
    slots.set(el, slot);
    el.classList.add('bl-pinned');
    el.dataset.blPin = String(rank);
    const after = [...bar.querySelectorAll(':scope > .bl-pinned')].find(x => Number(x.dataset.blPin) > rank);
    bar.insertBefore(el, after || bar.querySelector(':scope > .extraMesButtonsHint') || menu);
    bar.classList.toggle('bl-menu-empty', menu.childElementCount === 0);
}

function sweep(root = document.getElementById('chat')) {
    if (!root) return;
    const wanted = new Set(active ? order : []);
    root.querySelectorAll('.mes_buttons > .bl-pinned').forEach((el) => { if (!wantedKey(el, wanted)) restore(el); });
    if (!wanted.size) return;
    root.querySelectorAll('.mes_buttons > .extraMesButtons > *').forEach(el => { if (wantedKey(el, wanted)) pin(el); });
}

// 8.2.6 성능: 메시지 하나가 그려지거나 바뀐 이벤트(번호가 같이 옴)는 그 메시지만 훑어요 — 예전에는 새 답 하나에도 채팅 전체(메시지 300개 ×
//   메뉴 단추 십수 개)를 60ms · 700ms 뒤 두 번 다 훑었어요. 채팅 바뀜 · 더 불러오기 · 지우기, 번호가 없거나 그 메시지를 못 찾으면, 한꺼번에 20개 넘게 쌓이면 예전처럼 전체.
//   두 번 훑기(바로 한 번 · 다른 확장이 버튼을 늦게 붙인 뒤 한 번 더)와 이벤트마다 타이머를 새로 거는 것은 그대로예요 — 쌓인 번호는 700ms 쪽이 끝날 때 비워요.
const ONE_LIMIT = 20;
let pendingAll = false;
const pendingIds = new Set();
/** #chat 의 바로 아래 .mes 가운데 mesid 가 같은 것 (뒤에서부터 — 새 메시지는 대개 끝에 있어요). querySelector 로 채팅 전체를 훑지 않게 */
export function messageById(chat, id) {
    const want = String(id);
    for (let el = chat?.lastElementChild; el; el = el.previousElementSibling) {
        if (el.classList?.contains('mes') && el.getAttribute('mesid') === want) return el;
    }
    return null;
}
function runPending() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    if (pendingAll) { sweep(chat); return; }
    const found = [];
    for (const id of pendingIds) { const mes = messageById(chat, id); if (!mes) { sweep(chat); return; } found.push(mes); }
    found.forEach(mes => sweep(mes));
}
function schedule(id, all = false) {
    if (all || id === undefined || id === null || id === '' || !Number.isInteger(Number(id))) pendingAll = true;
    else pendingIds.add(Number(id));
    if (pendingIds.size > ONE_LIMIT) pendingAll = true;
    timers.forEach(clearTimeout);
    // 두 번: 바로 한 번, 다른 확장이 버튼을 늦게 붙인 뒤 한 번 더
    timers = [setTimeout(runPending, 60), setTimeout(() => { runPending(); pendingAll = false; pendingIds.clear(); }, 700)];
}
const scheduleOne = id => schedule(id);
const scheduleAll = () => schedule(null, true);

function onHint(event) {
    const hint = event.target?.closest?.('.extraMesButtonsHint');
    if (hint) sweep(hint.closest('.mes'));
}

function bind() {
    if (bound) return;
    const { eventSource, event_types: t } = SillyTavern.getContext();
    const one = [t.CHARACTER_MESSAGE_RENDERED, t.USER_MESSAGE_RENDERED, t.MESSAGE_UPDATED, t.MESSAGE_SWIPED, t.MESSAGE_EDITED].filter(Boolean);
    const whole = [t.CHAT_CHANGED, t.MORE_MESSAGES_LOADED, t.MESSAGE_DELETED].filter(Boolean);
    const handlers = [...one.map(name => [name, scheduleOne]), ...whole.map(name => [name, scheduleAll])];
    handlers.forEach(([name, fn]) => eventSource.on(name, fn));
    document.addEventListener('click', onHint, true);
    // 8.2.6 검토: 테마 애드온(TTS · LLM 번역)은 켜질 때 이미 그려진 메시지 전부에 메뉴 단추를 붙여요(설정 열쇠는 그대로라 syncMesPins 는 다시 안 훑음).
    //   예전엔 다음 메시지 이벤트의 전체 훑기가 그 단추를 옛 메시지에서도 꺼냈는데, 메시지 하나만 훑게 된 뒤로는 채팅을 다시 열 때까지 메뉴 안에 남았어요.
    //   애드온이 시작 · 켜짐 · 저장을 마치면 내는 bl:addons-state(addons.js) 뒤에 채팅 전체를 훑어요(tools/tests/mes-pins-addon-late.mjs)
    globalThis.window?.addEventListener?.('bl:addons-state', scheduleAll);
    bound = { eventSource, handlers };
}

function unbind() {
    if (!bound) return;
    bound.handlers.forEach(([name, fn]) => bound.eventSource.removeListener(name, fn));
    document.removeEventListener('click', onHint, true);
    globalThis.window?.removeEventListener?.('bl:addons-state', scheduleAll);
    timers.forEach(clearTimeout);
    timers = [];
    pendingAll = false; pendingIds.clear();
    bound = null;
}

/** apply.js(features.js) 가 설정이 바뀔 때마다 부른다 */
let pinsKey = null;
export function syncMesPins(on, list, themeOn = on) {
    pins = tidyPins(list);
    order = pins.flatMap(k => [k, ...(PAIRS[k] || [])]);
    active = !!on && order.length > 0;
    if (active) bind(); else unbind();
    // 8.2.3 뒤: 고정 목록 · 켬이 그대로면 채팅을 다시 훑지 않는다 — 설정 적용마다(슬라이더 틱마다) 300메시지의 메뉴 단추를 전부 훑었다(폰 4배 40~50ms). 새 메시지는 이벤트(bind)가 따로 알린다
    const key = `${active}|${order.join(',')}`;
    if (key !== pinsKey) { pinsKey = key; sweep(); }
    startPinGesture(!!themeOn);
}

// 4.7.1 길게 누르기: ··· 메뉴 안 버튼을 길게 누르면 이름 줄로 꺼내고, 꺼낸 버튼을 길게 누르면 메뉴로 돌려놓는다 (설정 창 없이)
// 눈(숨기기) 버튼만은 바로 꺼내지 않고 '꺼내기(넣기) · 접기(펼치기)' 를 고르게 한다 — 고르기 창과 접기는 mes-fold.js (그때만 읽음)
const HOLD_MS = 550, MOVE_PX = 8;
const EYE = '.mes_hide, .mes_unhide';
let gesture = null, hold = 0, held = null, gestureOn = false, gestureBound = false, foldModule = null;
// 눈을 누르기 시작할 때 미리 읽어 두어 길게 누름이 끝나는 순간 바로 띄운다. 못 읽으면 다음에 다시 시도
const loadFold = () => (foldModule ||= import('./mes-fold.js').catch((error) => {
    foldModule = null;
    console.warn('[Blue Lemonade] 눈 길게 누르기', error);
    return null;
}));
// (10-30) 접기 고치기(mes-fold.js startFoldRepair)는 접어 둔 메시지(extra.bl_folded)가 채팅에 있을 때만 받는다 — 접기를 안 쓰는 사람은
//   시작할 때 그 파일(과 rerender-notify.js)을 싣지 않는다. 고치는 때는 같다: 실리태번 숨김 풀기(is_system → false) · 채팅 바뀜 · 생성 시작
//   (실리태번 emit 은 리스너를 기다리므로 생성 시작에서 받아 고친 뒤에 프롬프트를 만든다). 한 번 받으면 그 모듈이 스스로 지켜보니 여기는 뗀다.
let foldWatch = null;
function watchFoldRepair() {
    if (foldWatch) return;
    const chat = document.getElementById('chat');
    const ctx = SillyTavern.getContext(), types = ctx.eventTypes || ctx.event_types;
    if (!chat || !ctx.eventSource) return;
    const folded = () => (SillyTavern.getContext().chat || []).some(message => !message?.is_system && message?.extra?.bl_folded === true);
    const names = ['CHAT_CHANGED', 'GENERATION_STARTED'].filter(name => types?.[name]);
    let observer = null;
    const stop = () => { observer?.(); observer = null; for (const name of names) ctx.eventSource.removeListener?.(types[name], kick); };
    function kick() { if (foldWatch === 'started' || !folded()) return; return loadFold().then(module => { if (!module || foldWatch === 'started') return; foldWatch = 'started'; stop(); module.startFoldRepair(); }); }
    foldWatch = 'watching';
    // 9.0.4: 공용 감시 허브 구독(#chat 구역 — 채팅을 보는 감시자는 문서마다 하나)
    observer = watchDom(chat, { subtree: true, attributes: ['is_system'], name: '메시지 핀 · 접은 메시지 숨김 풀기' }, records => { if (records.some(record => record.target.getAttribute('is_system') === 'false')) kick(); });
    for (const name of names) ctx.eventSource.on(types[name], kick);
    kick();
}
function startPinGesture(on) {
    gestureOn = on;
    if (on) watchFoldRepair();
    if (!on || gestureBound) { if (!on) { clearTimeout(hold); foldModule?.then(m => m?.closeEyeChoice()); } return; }
    gestureBound = true;
    document.addEventListener('pointerdown', (event) => {
        // 새 누름이 시작되면 앞 길게 누르기의 click 은 이미 왔거나 오지 않는다 (폰은 길게 누른 뒤 click 을 건너뛰기도 함).
        // 남겨 두면 고르기 창의 첫 톡이 막혔다 — 여기서 푼다
        held = null;
        if (!gestureOn || (event.pointerType === 'mouse' && event.button !== 0)) return;
        const el = event.target?.closest?.('.mes_buttons > .extraMesButtons > *, .mes_buttons > .bl-pinned');
        if (!el || el.matches('.extraMesButtonsHint')) return;
        const eye = el.matches(EYE);
        if (eye) loadFold();
        clearTimeout(hold);
        gesture = { el, x: event.clientX, y: event.clientY };
        hold = setTimeout(() => { if (gesture?.el === el) { gesture = null; (eye ? eyeChoice : togglePin)(el); } }, HOLD_MS);
    }, true);
    const cancel = () => { clearTimeout(hold); gesture = null; };
    document.addEventListener('pointermove', (event) => { if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > MOVE_PX) cancel(); }, true);
    for (const type of ['pointerup', 'pointercancel', 'scroll']) document.addEventListener(type, cancel, true);
    // 길게 누른 뒤 손을 떼면 click 이 따라온다 — 그 버튼의 원래 동작(번역 · 숨김 …)이 돌지 않게 한 번 막는다
    document.addEventListener('click', (event) => {
        if (!held) return;
        const fresh = Date.now() - held.at < 800;
        held = null;
        if (fresh) { event.stopPropagation(); event.preventDefault(); }
    }, true);
    document.addEventListener('contextmenu', (event) => { if (held && Date.now() - held.at < 800) event.preventDefault(); }, true);
}
// 눈 길게 누르기: 손을 뗄 때의 click 은 위와 같이 막고, 고르기 창을 띄운다. 창을 못 띄우면 예전처럼 바로 꺼내기 · 넣기
function eyeChoice(el) {
    held = { el, at: Date.now() };
    try { navigator.vibrate?.(15); } catch { /* 진동이 없는 기기 */ }
    loadFold().then((mod) => {
        if (!gestureOn || !el.isConnected) return;
        if (mod) {
            try {
                // 창에서 꺼내기 · 넣기를 고르면 togglePin 이 막기를 다시 걸므로 바로 푼다 (다음 톡이 먹히지 않게)
                mod.openEyeChoice(el, () => { togglePin(el); held = null; });
                return;
            } catch (error) {
                console.warn('[Blue Lemonade] 눈 길게 누르기', error);
                try { mod.closeEyeChoice(); } catch { /* 반쯤 그린 창 */ }
            }
        }
        togglePin(el);
    });
}
function togglePin(el) {
    const key = pinKey(el);
    if (!key) return;
    const s = getSettings();
    const current = tidyPins(s.chat.mesPins || []);
    // 짝(mes_unhide 는 mes_hide 의 짝)은 앞 이름으로 고른다
    const own = Object.entries(PAIRS).find(([, pair]) => pair.includes(key))?.[0] || key;
    const legacy = basePinKey(el);
    const pinned = el.classList.contains('bl-pinned') || current.includes(own) || current.includes(legacy);
    let next;
    if (pinned) next = current.filter(k => k !== own && k !== legacy);
    else if (current.length >= PIN_LIMIT) { globalThis.toastr?.warning(`버튼은 ${PIN_LIMIT}개까지 꺼내 둘 수 있어요.`, 'Blue Lemonade'); return; }
    else next = [...current, own];
    held = { el, at: Date.now() };
    try { navigator.vibrate?.(15); } catch { /* 진동이 없는 기기 */ }
    s.chat.mesPins = next;
    saveSettings();
    syncMesPins(next.length > 0, next, true);
    globalThis.Salty?.refreshPanels?.();
    globalThis.toastr?.info(pinned ? '메뉴로 돌려놓았어요' : '이름 줄에 꺼냈어요 · 길게 누르면 되돌려요', 'Blue Lemonade', { timeOut: 2500 });
}
