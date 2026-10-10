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
    return !!(selection && !selection.isCollapsed &&
        (inside(selection.anchorNode) || inside(selection.focusNode)));
}
// 5.8.4: 데우스 감정 효과 글(.custom-dem-expressive)이 하나도 없으면 멈춤 표시를 켜지 않는다 — 규칙 끝의 ' *' 때문에 body 속성을
// 바꿀 때마다 문서 전체 스타일을 다시 셌다 (폰 리그 4배 한 번 370~590 ms, 터치마다 두 번). 효과 글이 있으면 5.8.3 그대로.
// 입력칸에서 칠 때(typingOutside)는 목록도 안 센다 — 글이 바뀐 뒤 첫 .length 는 문서를 한 번 훑는다.
const fx = document.getElementsByClassName('custom-dem-expressive'); // 살아 있는 목록
function update() {
    const on = (pressing || !typingOutside(document.activeElement)) && fx.length > 0 && (pressing || selectedInScope());
    document.body.toggleAttribute('data-bl-dem-selecting', on); // 같은 상태면 바뀌는 것 없음
}
function down(event) {
    if (document.body.classList.contains('cg-previewing')) return;
    if (event.button !== 0 || !inside(event.target)) return;
    clearTimeout(releaseTimer);
    pressing = true;
    update();
}
function up() {
    clearTimeout(releaseTimer);
    // Android can emit pointercancel just before establishing its long-press selection.
    releaseTimer = setTimeout(() => { pressing = false; update(); }, 250);
}
export function syncDemSelection(on) {
    if (!!on === bound) return;
    bound = !!on;
    const method = bound ? 'addEventListener' : 'removeEventListener';
    document[method]('selectionchange', update);
    document[method]('pointerdown', down, true);
    document[method]('pointerup', up, true);
    document[method]('pointercancel', up, true);
    window[method]('blur', up);
    if (bound) update();
    else {
        clearTimeout(releaseTimer);
        pressing = false;
        document.body.removeAttribute('data-bl-dem-selecting');
    }
}
