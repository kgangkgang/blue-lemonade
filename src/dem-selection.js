// Keep the native selection handles/menu anchored while dialogue is animated.
let bound = false, pressing = false, releaseTimer = 0;
const scope = '#chat .mes_text, .cg-root, .salty-preview';
const inside = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.(scope);
// 5.6.4 (점검 RP-3): 입력칸에서 글자를 칠 때마다 selectionchange 가 오는데, selection.isCollapsed 를 읽으면 스타일 · 배치를 강제로 계산했다
// (폰 리그 4배 키당 약 13.6 ms). 초점이 범위 밖의 글 입력칸에 있으면 선택은 그 칸 안이라 범위 안일 수 없다 — Selection 을 읽지 않는다.
const TEXT_INPUT = /^(text|search|url|tel|email|password|number)$/;
const typingOutside = (el) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_INPUT.test(el.type))) && !inside(el);
function selectedInScope() {
    if (typingOutside(document.activeElement)) return false;
    const selection = document.getSelection();
    return !!(selection && selection.rangeCount > 0 && !selection.getRangeAt(0).collapsed &&   // 6.4.5 isCollapsed 대신 — 배치 계산 강제 없이 같은 답
        (inside(selection.anchorNode) || inside(selection.focusNode)));
}
// 5.8.4: 데우스 감정 효과 글(.custom-dem-expressive)이 하나도 없으면 멈춤 표시를 켜지 않는다.
// 입력칸에서 칠 때(typingOutside)는 목록도 안 센다 — 글이 바뀐 뒤 첫 .length 는 문서를 한 번 훑는다.
const fx = document.getElementsByClassName('custom-dem-expressive'); // 살아 있는 목록
const ROOT_SCOPE = '#chat, .cg-root, .salty-preview';
const SELECTING = 'data-bl-dem-selecting';
const PAUSED = 'data-bl-dem-paused';
let selecting = false, rootObserver = null;
const pausedRoots = new Set();
// 5.8.5: 끝의 ' *' 규칙이 body 속성에 매달리면 터치마다 설정 창까지 다시 계산한다.
// 채팅 · 북마크 · 미리보기의 가장 바깥 칸에서만 멈춘다. 효과 글 자체에는 속성을 쓰지 않아
// 스트리밍 morph의 외부 변경 감지나 캡처용 본문 비교에 선택 상태가 섞이지 않는다.
function syncRoots() {
    if (!selecting) return;
    const next = new Set();
    for (const root of document.body.querySelectorAll(ROOT_SCOPE)) {
        const parent = root.parentElement?.closest(ROOT_SCOPE);
        if (parent && parent !== document.body && document.body.contains(parent)) continue;
        next.add(root);
    }
    for (const root of pausedRoots) if (!next.has(root)) {
        root.removeAttribute(PAUSED);
        pausedRoots.delete(root);
    }
    for (const root of next) {
        root.toggleAttribute(PAUSED, true);
        pausedRoots.add(root);
    }
}
function pauseRoots(on) {
    selecting = on;
    // body 표시는 현재 선택 상태를 확인하는 기존 코드와 측정을 위해 남긴다.
    // 루트와 이름까지 같으면 body 속성 변경이 CSS 무효화를 다시 일으키므로 CSS는 별도 PAUSED 표시만 읽는다.
    document.body.toggleAttribute(SELECTING, on);
    if (on) {
        if (!rootObserver) {
            // 선택 중 새 창이 열리거나 루트가 이동/교체돼도 같은 프레임에서 멈춘다.
            // rAF는 숨은 탭에서 미뤄지므로 관찰자에서 바로 반영하며, 우리 표시 속성은 관찰하지 않는다.
            rootObserver = new MutationObserver(syncRoots);
            rootObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id'] });
        }
        syncRoots();
    } else {
        rootObserver?.disconnect();
        rootObserver = null;
        for (const root of pausedRoots) root.removeAttribute(PAUSED); // 떨어진 칸도 다시 붙기 전에 해제
        pausedRoots.clear();
    }
}
function update() {
    const on = (pressing || !typingOutside(document.activeElement)) && fx.length > 0 && (pressing || selectedInScope());
    pauseRoots(on);
}
// 6.4.5 누르자마자 멈추면 스크롤 · 짧은 탭마다 채팅 전체 스타일 계산이 두 번 돌았다 (답 24개 · 폰 4× 스크롤 17초 멈춤).
//   길게 누를 때만 멈춘다 — 안드로이드 길게 누르기 선택(~500 ms)보다 앞선 350 ms. 그 전에 떼거나 스크롤이 시작되면(pointercancel) 멈추지 않는다.
//   마우스로 끌어 고르면 첫 selectionchange 에서 멈춘다 (선택 중 멈춤은 예전과 같다). 이미 멈춘 채 다시 누르면 그대로 이어 간다.
//   누른 손가락이 10 px 넘게 움직여도 기다리던 멈춤을 거둔다 — 안드로이드 길게 누르기도 움직이면 취소된다 (pointercancel 이 늦게 오는 느린 끌기 대비).
const HOLD_MS = 350, HOLD_SLOP = 10;
let holdTimer = 0, holdAt = null;
function down(event) {
    if (document.body.classList.contains('cg-previewing')) return;
    if (event.button !== 0 || !inside(event.target)) return;
    clearTimeout(releaseTimer);
    if (pressing) return;
    clearTimeout(holdTimer);
    holdAt = { id: event.pointerId, x: event.clientX, y: event.clientY };
    holdTimer = setTimeout(() => { holdTimer = 0; pressing = true; update(); }, HOLD_MS);
}
function move(event) {
    if (!holdTimer || !holdAt || event.pointerId !== holdAt.id) return;
    if (Math.hypot(event.clientX - holdAt.x, event.clientY - holdAt.y) > HOLD_SLOP) { clearTimeout(holdTimer); holdTimer = 0; }
}
function up() {
    clearTimeout(releaseTimer);
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = 0; if (!pressing) return; }   // 6.4.5 길게 누르기 전에 뗌 · 스크롤 시작 — 멈춘 적 없다
    // Android can emit pointercancel just before establishing its long-press selection.
    releaseTimer = setTimeout(() => { pressing = false; update(); }, 250);
}
export function syncDemSelection(on) {
    if (!!on === bound) return;
    bound = !!on;
    const method = bound ? 'addEventListener' : 'removeEventListener';
    document[method]('selectionchange', update);
    document[method]('pointerdown', down, true);
    document[method]('pointermove', move, true);   // 6.4.5 길게 누르기를 기다리는 동안 움직이면 거둔다 (기다리는 중이 아니면 바로 돌아간다)
    document[method]('pointerup', up, true);
    document[method]('pointercancel', up, true);
    window[method]('blur', up);
    if (bound) update();
    else {
        clearTimeout(releaseTimer);
        clearTimeout(holdTimer); holdTimer = 0;
        pressing = false;
        pauseRoots(false);
    }
}
