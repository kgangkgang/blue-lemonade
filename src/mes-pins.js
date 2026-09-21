// 메시지 버튼 고정 (4.1.3): ··· 메뉴 안의 버튼 중 고른 것만 메뉴를 열지 않아도 이름 줄에 늘 보이게 한다.
// 복제하지 않고 진짜 버튼을 버튼 줄로 옮긴다 — 실리태번 · 다른 확장이 건 클릭 처리, 켜짐 표시, 숨김 상태가 그대로 따라온다.
// 옮긴 자리에는 주석 노드를 남겨 두었다가, 고정을 풀거나 테마를 끄면 원래 순서 그대로 메뉴에 돌려놓는다.
// 감시자는 두지 않는다: 메시지가 그려지는 이벤트와 ··· 를 누르는 순간에만 훑는다 (대기 중 콜백 0).

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
export function syncMesPins(on, list) {
    pins = tidyPins(list);
    order = pins.flatMap(k => [k, ...(PAIRS[k] || [])]);
    active = !!on && order.length > 0;
    if (active) bind(); else unbind();
    sweep();
}
