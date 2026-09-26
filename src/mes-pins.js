// 메시지 버튼 고정 (4.1.3): ··· 메뉴 안의 버튼 중 고른 것만 메뉴를 열지 않아도 이름 줄에 늘 보이게 한다.
// 복제하지 않고 진짜 버튼을 버튼 줄로 옮긴다 — 실리태번 · 다른 확장이 건 클릭 처리, 켜짐 표시, 숨김 상태가 그대로 따라온다.
// 옮긴 자리에는 주석 노드를 남겨 두었다가, 고정을 풀거나 테마를 끄면 원래 순서 그대로 메뉴에 돌려놓는다.
// 감시자는 두지 않는다: 메시지가 그려지는 이벤트와 ··· 를 누르는 순간에만 훑는다 (대기 중 콜백 0).

import { getSettings, saveSettings } from './settings.js';

const GENERIC = /^(mes_button|interactable|menu_button|fa|fa-.+|bl-.+|salty-.+)$/;
// 실리태번이 상태에 따라 둘 중 하나만 보여 주는 짝 — 앞의 것을 고르면 뒤의 것도 같이 옮긴다
const PAIRS = { mes_hide: ['mes_unhide'], mes_media_gallery: ['mes_media_list'] };
const PAIRED = new Set(Object.values(PAIRS).flat());
export const PIN_LIMIT = 12;

const slots = new WeakMap();
let pins = [];
let order = [];
let active = false;
let timers = [];
let bound = null;

/** 버튼 하나의 이름표: 공통 클래스를 뺀 첫 클래스 (mes_translate · mes_llm_translate …) */
export function pinKey(el) {
    for (const name of el.classList || []) if (!GENERIC.test(name)) return name;
    return '';
}

export function tidyPins(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const key of list) {
        if (typeof key !== 'string' || !/^[A-Za-z_][\w-]{0,63}$/.test(key) || GENERIC.test(key) || PAIRED.has(key) || out.includes(key)) continue;
        out.push(key);
        if (out.length >= PIN_LIMIT) break;
    }
    return out;
}

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
        found.set(key, { key, icon, title: (el.getAttribute('title') || el.getAttribute('aria-label') || key).trim() });
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
    return [...found.values()];
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
    const rank = order.indexOf(pinKey(el));
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
    root.querySelectorAll('.mes_buttons > .bl-pinned').forEach((el) => { if (!wanted.has(pinKey(el))) restore(el); });
    if (!wanted.size) return;
    root.querySelectorAll(order.map(k => `.mes_buttons > .extraMesButtons > .${CSS.escape(k)}`).join(',')).forEach(pin);
}

function schedule() {
    timers.forEach(clearTimeout);
    // 두 번: 바로 한 번, 다른 확장이 버튼을 늦게 붙인 뒤 한 번 더
    timers = [setTimeout(sweep, 60), setTimeout(sweep, 700)];
}

function onHint(event) {
    const hint = event.target?.closest?.('.extraMesButtonsHint');
    if (hint) sweep(hint.closest('.mes'));
}

function bind() {
    if (bound) return;
    const { eventSource, event_types: t } = SillyTavern.getContext();
    const names = [t.CHAT_CHANGED, t.CHARACTER_MESSAGE_RENDERED, t.USER_MESSAGE_RENDERED, t.MORE_MESSAGES_LOADED, t.MESSAGE_UPDATED, t.MESSAGE_SWIPED, t.MESSAGE_EDITED, t.MESSAGE_DELETED].filter(Boolean);
    names.forEach(name => eventSource.on(name, schedule));
    document.addEventListener('click', onHint, true);
    bound = { eventSource, names };
}

function unbind() {
    if (!bound) return;
    bound.names.forEach(name => bound.eventSource.removeListener(name, schedule));
    document.removeEventListener('click', onHint, true);
    timers.forEach(clearTimeout);
    timers = [];
    bound = null;
}

/** apply.js(features.js) 가 설정이 바뀔 때마다 부른다 */
export function syncMesPins(on, list, themeOn = on) {
    pins = tidyPins(list);
    order = pins.flatMap(k => [k, ...(PAIRS[k] || [])]);
    active = !!on && order.length > 0;
    if (active) bind(); else unbind();
    sweep();
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
function startPinGesture(on) {
    gestureOn = on;
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
    const pinned = el.classList.contains('bl-pinned') || current.includes(own);
    let next;
    if (pinned) next = current.filter(k => k !== own);
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
