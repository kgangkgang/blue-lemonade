// 8.2.7 실리태번 refreshSwipeButtons 는 메시지 하나가 그려질 때마다 넘길 수 없는 메시지 전부에 classList.remove('swipes_visible', 'last_swipe') 를 불러요.
//   없는 클래스를 빼도 브라우저는 class 를 같은 값으로 다시 써 변경 기록을 남기고, 실리태번 keyboard.js 감시는 기록마다 그 메시지 아래를
//   선택자 30여 개로 훑어요(메시지 하나 그릴 때 기록 300개 남짓 · 테마가 메시지마다 단추 · 꾸밈을 달아 훑을 양도 커요).
//   #chat 바로 아래 메시지(.mes)의 classList 에서만, 바뀌는 것이 없는 add · remove(이미 있는 것 붙이기 · 없는 것 빼기, class 글자가 이미
//   정리된 꼴)는 브라우저까지 보내지 않아요 — class 값 · 화면 · 감시자가 받는 바뀐 기록은 같고, 같은 값 기록만 안 생겨요.
//   그 밖(토큰이 이상함 · 글자가 정리 안 됨 · 값이 바뀜)은 원래 함수 그대로예요.
const SPACE = /[\t\n\f\r ]/;
const UNTIDY = /^ | $| {2}|[\t\n\f\r]/;
let nativeAdd = null, nativeRemove = null;

/** 바꿀 것이 없고, 원래 함수가 써도 지금과 같은 글자일 때만 참 */
export function nothingToWrite(list, tokens, present) {
    if (!tokens.length) return false;
    for (const token of tokens) if (typeof token !== 'string' || !token || SPACE.test(token) || list.contains(token) !== present) return false;
    const value = list.value;
    return value !== '' && !UNTIDY.test(value) && value.split(' ').length === list.length;
}
function quietAdd(...tokens) { if (!nothingToWrite(this, tokens, true)) return nativeAdd.apply(this, tokens); }
function quietRemove(...tokens) { if (!nothingToWrite(this, tokens, false)) return nativeRemove.apply(this, tokens); }

export function guardMessage(el) {
    const list = el?.classList;
    if (!list || Object.hasOwn(list, 'remove')) return false;
    const proto = Object.getPrototypeOf(list);
    nativeAdd ||= proto.add; nativeRemove ||= proto.remove;
    Object.defineProperty(list, 'add', { configurable: true, writable: true, value: quietAdd });
    Object.defineProperty(list, 'remove', { configurable: true, writable: true, value: quietRemove });
    return true;
}

let observer = null, watched = null;
export function startMesClassQuiet(chat = document.getElementById('chat'), MO = globalThis.MutationObserver) {
    if (observer || !chat || typeof MO !== 'function') return;
    for (const el of chat.children) if (el.classList?.contains('mes')) guardMessage(el);
    observer = new MO(records => {
        for (const r of records) for (const node of r.addedNodes) if (node.nodeType === 1 && node.classList.contains('mes')) guardMessage(node);
    });
    observer.observe(chat, { childList: true }); watched = chat;
}

export function stopMesClassQuiet() {
    observer?.disconnect(); observer = null;
    for (const el of watched?.children || []) if (el.classList && Object.hasOwn(el.classList, 'remove')) { delete el.classList.add; delete el.classList.remove; }
    watched = null;
}
