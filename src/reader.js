// 몰입 읽기 (3.1.0) — 폰에서 채팅을 아래로 밀어 읽으면 위 메뉴 줄 · 입력창이 비켜나고, 조금 위로 올리거나 빈 곳을 톡 누르면 다시 나온다.
//
// 자리를 늘 비워 두면(채팅 칸 위아래에 바가 차지하는 만큼) 숨길 때 채팅 칸 크기가 바뀌어 글 전체를 다시 배치해야 한다.
// 그래서 켜 두는 동안은 채팅 칸이 화면을 꽉 채우고, 위 바 · 입력창은 그 위에 떠 있게 바꾼다 (채팅 위아래 여백 = 바 높이).
// 숨기고 꺼내는 것은 바를 밀어 올리고 내리는 것뿐이라 글은 다시 배치하지 않는다.
//  · 위 바는 top 으로 민다 — transform 을 걸면 그 안의 서랍(position: fixed)이 바를 기준으로 붙어 화면 밖으로 따라 나간다.
//  · 입력창은 transform 으로 내린다 (보일 때는 transform 이 없음 → 안의 메뉴 · 팝업은 평소대로).
// 손으로 민 스크롤만 센다: 실리태번이 스트리밍 중 맨 아래로 내리는 스크롤에는 반응하지 않는다.
// 입력칸에 글을 쓰는 중 · 서랍이나 팝업이 열려 있을 때는 숨기지 않는다. 폭 1000px 이하에서만.
const HIDE_AFTER = 48;   // px — 이만큼 아래로 밀면 숨김
const SHOW_AFTER = 40;   // px — 이만큼 위로 올리면 꺼냄 (읽다가 살짝 흔들린 것에는 안 나오게)
const USER_TOUCH_MS = 1200; // 손가락을 뗀 뒤에도 관성 스크롤은 손으로 민 것으로 친다
const USER_WHEEL_MS = 350;
const TAP_IGNORE = 'a, button, input, textarea, select, label, summary, video, audio, iframe, img, [role="button"], [onclick], [contenteditable="true"], .mes_buttons, .mes_button, .extraMesButtons, .swipe_left, .swipe_right, .swipes-counter, .mes_edit_buttons, .mesAvatarWrapper, .menu_button, .interactable, .mes_reasoning_header, .custom-cac-wrap, .ch_name, .mes_img_controls, .qr--button, .custom-dem-track, .custom-dem-track-recovery, .thk-fold';

const mq = window.matchMedia('(max-width: 1000px)');
let wanted = false;
let active = false;
let chat = null;
let form = null;
let formObserver = null;
let holderObserver = null;
let lastTop = 0;
let travel = 0;
let userUntil = 0;
let lastScrollAt = 0;

const root = document.documentElement;
const body = document.body;

function hidden() {
    return body.classList.contains('bl-bars-hidden');
}

function busy() {
    // 쓰던 글이 있으면 숨기지 않는다. 빈 입력칸에 초점만 남은 것(폰에서 뒤로 가기로 키보드만 닫은 경우)은 숨긴다
    const focus = document.activeElement;
    if (focus?.matches?.('#form_sheld textarea, #form_sheld input') && String(focus.value || '').trim()) return true;
    if (document.querySelector('.drawer-content.openDrawer, dialog[open]')) return true;
    // ≡ · ✦ 메뉴 (jQuery show/hide 로 인라인 display)
    return ['options', 'extensionsMenu'].some(id => { const menu = document.getElementById(id); return !!menu && menu.style.display !== 'none' && menu.style.display !== ''; });
}

function hide() {
    if (hidden() || busy()) return;
    if (document.activeElement?.closest?.('#form_sheld')) document.activeElement.blur(); // 빈 입력칸 초점 → 키보드도 내림
    body.classList.add('bl-bars-hidden');
    // 숨긴 동안 서랍이 열리면(단축키 · 다른 확장) 바를 꺼낸다
    holderObserver ??= new MutationObserver(() => { if (document.querySelector('#top-settings-holder .openDrawer')) show(); });
    const holder = document.getElementById('top-settings-holder');
    if (holder) holderObserver.observe(holder, { subtree: true, attributes: true, attributeFilter: ['class'] });
}

function show() {
    if (!hidden()) return;
    body.classList.remove('bl-bars-hidden');
    holderObserver?.disconnect();
}

function onScroll() {
    const top = chat.scrollTop;
    const delta = top - lastTop;
    lastTop = top;
    lastScrollAt = performance.now();
    if (performance.now() > userUntil) {
        travel = 0;
        return;
    }
    if (!delta || Math.sign(delta) !== Math.sign(travel)) travel = 0;
    travel += delta;
    if (travel > HIDE_AFTER) { travel = 0; hide(); }
    else if (travel < -SHOW_AFTER) { travel = 0; show(); }
}

function markTouch() { userUntil = performance.now() + USER_TOUCH_MS; }
function markWheel() { userUntil = performance.now() + USER_WHEEL_MS; }

function onTap(event) {
    if (performance.now() - lastScrollAt < 250) return; // 관성 스크롤을 멈추려고 누른 것
    if (event.target.closest?.(TAP_IGNORE)) return;
    if (event.target.closest?.('.mes')?.querySelector('.edit_textarea')) return; // 편집 중인 메시지
    if (!window.getSelection()?.isCollapsed) return; // 글자를 고르는 중
    if (hidden()) show();
    else hide();
}

function onFocusIn(event) {
    if (event.target.closest?.('#form_sheld')) show();
}

function measureForm() {
    if (!form) return;
    root.style.setProperty('--bl-form-h', `${Math.round(form.getBoundingClientRect().height)}px`);
}

function start() {
    chat = document.getElementById('chat');
    form = document.getElementById('form_sheld');
    if (!chat || !form) return false;
    active = true;
    measureForm();
    body.classList.add('bl-reader');
    formObserver = new ResizeObserver(measureForm);
    formObserver.observe(form);
    lastTop = chat.scrollTop;
    chat.addEventListener('scroll', onScroll, { passive: true });
    chat.addEventListener('touchstart', markTouch, { passive: true });
    chat.addEventListener('touchmove', markTouch, { passive: true });
    chat.addEventListener('wheel', markWheel, { passive: true });
    chat.addEventListener('click', onTap);
    document.addEventListener('focusin', onFocusIn);
    return true;
}

function stop() {
    active = false;
    show();
    body.classList.remove('bl-reader');
    root.style.removeProperty('--bl-form-h');
    formObserver?.disconnect();
    formObserver = null;
    chat?.removeEventListener('scroll', onScroll);
    chat?.removeEventListener('touchstart', markTouch);
    chat?.removeEventListener('touchmove', markTouch);
    chat?.removeEventListener('wheel', markWheel);
    chat?.removeEventListener('click', onTap);
    document.removeEventListener('focusin', onFocusIn);
}

function sync() {
    const want = wanted && mq.matches;
    if (want && !active) start();
    else if (!want && active) stop();
}

mq.addEventListener('change', sync);

/** apply.js 가 설정이 바뀔 때마다 부른다 */
export function syncReader(on) {
    wanted = !!on;
    sync();
}

/** 시험 · 콘솔용 */
export function readerState() {
    return { wanted, active, hidden: hidden(), formH: root.style.getPropertyValue('--bl-form-h') };
}
export { show as showBars, hide as hideBars };
