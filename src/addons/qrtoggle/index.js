// 퀵 리플라이 줄 접기 (1.1.2, 기본 꺼짐) — 켤 때만 받는 모듈(features.js). 계산은 core.js(순수).
// Based on Simple QR Bar Toggle — Copyright (c) 2025 IceFog72, MIT. Blue Lemonade 호환판(sdafaff346/stqrtoggle-mod)의 방식을 따랐어요.
//   출처 · 라이선스 전문: src/addons/qrtoggle/NOTICE.md · LICENSE
// 요술봉 뒤 ⌃ 단추로 퀵 리플라이 줄(#qr--bar)을 접고 펼쳐요. 접힘은 <body> 의 data 속성 하나라 줄의 class(테마의 흐림 · 끌기 표시, 퀵 리플라이 자체 것)를 건드리지 않아요.
// 줄 앞의 「QR 접기 단추」(chat.qrFold · layout.js)와 겹치지 않게: 이 스위치를 켠 동안 apply.js 가 salty-qr-fold-off 를 걸고 salty-qr-folded 를 떼요(저장값은 그대로 — 끄면 돌아와요).
//   단추를 넣고 빼는 것이 입력판 변화라 layout.js 가 곧바로 줄 앞 단추를 떼거나 되살려요.
// 원작 · 호환판 확장이 따로 켜져 있으면 내장 쪽이 물러나요(단추가 둘 생기지 않게) — 그쪽 단추가 보이는 동안 우리 단추를 넣지 않고 한 번 알려요.
// 비용: 켰을 때만 입력판(#send_form) 감시 하나 · CHAT_CHANGED 리스너 하나 · <style> 하나. 끄면 모두 걷어요.
import { STATE_KEY, LEGACY_KEY, OTHER_BUTTONS, tidyState, buttonView, isPressKey } from './core.js';

// 접힘 표식은 <body> 의 class 가 아니라 data 속성이에요 — <body> 의 class 를 바꾸면 실리태번 keyboard.js 감시자(class 만 봐요)가 누를 때마다
//   문서 전체를 선택자 27개로 다시 훑어요(apply.js 의 data-bl-dem-fold 와 같은 까닭). 규칙의 무게(특이도)는 class 하나와 같아 모양은 그대로예요.
const BUTTON_ID = 'bl_qr_fold', BODY_ATTR = 'data-bl-qr-folded', STYLE_ID = 'bl-qrfold-style';
// 접힘: 줄이 어디 있든(입력판 · 폰의 아이콘 줄) 숨겨요. 단추 자리는 요술봉(order 3) 바로 뒤. 모양 · 크기는 테마가 입력줄의 다른 확장 아이콘에 주는 규칙 그대로예요.
const CSS = `body[${BODY_ATTR}] #qr--bar{display:none!important}#${BUTTON_ID}{display:flex;align-items:center;justify-content:center;cursor:pointer}body.salty #${BUTTON_ID}{order:3!important}`;
/** 접힘 표식을 달거나 떼요 — 이미 그 상태면 쓰지 않아요 */
function markFolded(fold) {
    const body = document.body, has = body.getAttribute(BODY_ATTR) !== null;
    if (fold && !has) body.setAttribute(BODY_ATTR, '');
    else if (!fold && has) body.removeAttribute(BODY_ATTR);
}

let on = false, bound = false, observer = null, queued = false, warned = false;
const ctx = () => SillyTavern.getContext();
function state() {
    const all = ctx().extensionSettings;
    all[STATE_KEY] = tidyState(all[STATE_KEY], all[LEGACY_KEY]);
    return all[STATE_KEY];
}
const otherButton = () => OTHER_BUTTONS.some(id => document.getElementById(id));

function apply() {
    const open = state().open, button = document.getElementById(BUTTON_ID);
    // 다른 확장의 단추가 있으면 접힘도 그쪽에 맡겨요(우리 표식으로 줄을 숨긴 채 남기지 않아요)
    markFolded(on && !open && !otherButton());
    if (!button) return;
    const view = buttonView(open);
    button.classList.remove(view.off); button.classList.add(view.icon);
    button.title = view.label;
    button.setAttribute('aria-label', view.label);
    button.setAttribute('aria-expanded', view.expanded);
}
function toggle() {
    const st = state();
    st.open = !st.open;
    ctx().saveSettingsDebounced?.();
    apply();
    // 숨은 동안 줄의 너비가 0 이라 테마의 양끝 흐림이 낡았어요 — 줄의 scroll 사건에 다시 재요
    if (st.open) requestAnimationFrame(() => document.getElementById('qr--bar')?.dispatchEvent(new Event('scroll')));
}
function makeButton() {
    const button = document.createElement('div');
    button.id = BUTTON_ID;
    button.className = 'fa-solid fa-chevron-up interactable';
    button.tabIndex = 0;
    button.setAttribute('role', 'button');
    button.addEventListener('click', toggle);
    button.addEventListener('keydown', event => { if (isPressKey(event.key)) { event.preventDefault(); toggle(); } });
    return button;
}
function ensure() {
    if (!on) return;
    const mine = document.getElementById(BUTTON_ID);
    if (otherButton()) {
        mine?.remove();
        if (!warned) { warned = true; globalThis.toastr?.info('Simple QR Bar Toggle 확장이 따로 켜져 있어 내장 「퀵 리플라이 줄 접기」는 쉬어요. 하나만 쓰려면 그 확장을 끄거나 이 스위치를 꺼 주세요.', 'Blue Lemonade'); }
    } else if (!mine) {
        document.getElementById('extensionsMenuButton')?.insertAdjacentElement('afterend', makeButton());
    }
    apply();
}
function watch() {
    const form = document.getElementById('send_form');
    if (!form || observer) return;
    observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; ensure(); });
    });
    observer.observe(form, { childList: true, subtree: true });
}
function bind() {
    if (bound) return;
    bound = true;
    const { eventSource, event_types } = ctx();
    eventSource.on(event_types.CHAT_CHANGED, () => { if (on) { watch(); ensure(); } });
}

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncQrToggle(next) {
    const was = on;
    on = next === true;
    if (on) {
        if (!document.getElementById(STYLE_ID)) { const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.append(style); }
        bind(); watch(); ensure();
        return;
    }
    if (!was) return;
    observer?.disconnect(); observer = null; queued = false; warned = false;
    document.getElementById(BUTTON_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    markFolded(false);
}

/** 시험용 */
export const _forTest = { BUTTON_ID, BODY_ATTR, STYLE_ID, state, toggle, ensure };
