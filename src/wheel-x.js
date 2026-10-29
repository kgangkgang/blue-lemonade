// 가로 스크롤 칸은 Shift 없이 휠로 (8.2.3): 가로로만 넘치는 칸(캐릭터 즐겨찾기 줄 · 글꼴 묶음 태그 줄 · 실리태번 원본의 가로 칸 …)에서
// 세로 휠을 돌리면 그 칸을 좌우로 굴려요. 왜: 탭 줄(tab-scroll.js)과 퀵 리플라이 줄(layout.js qrWheel)만 됐고, 나머지 가로 칸은 Shift+휠이어야 했어요
// (사용자 지시 10-29 「스크롤 가능한 곳은 다 마우스 휠이나 모바일 제스처로」). 모바일은 overflow-x 칸을 손가락으로 원래 밀 수 있어 JS 가 필요 없어요.
// 방식: 문서에 wheel 리스너 하나(passive:false). 이벤트 대상에서 올라가며 「가로로 넘치고(scrollWidth > clientWidth+1) 세로로는 안 넘치는
// (scrollHeight <= clientHeight+1) 첫 조상」을 찾아 굴려요. getComputedStyle 은 그 후보에만 — 매 휠마다 문서를 훑지 않아요.
// 건너뛰는 것: Ctrl · Meta · Shift(브라우저 기본) · 가로 델타가 큰 트랙패드 손짓 · 이미 처리된 이벤트(defaultPrevented — 탭 줄 · 퀵 리플라이 줄이
// 먼저 받아 굴린 것) · #chat 안(세로 읽기가 우선 — 넓은 표 · 코드는 손가락 · Shift 로) · textarea · pre · 편집 칸 · 세로로도 넘치는 칸.
// 칸 끝에 닿아 더 못 굴리면 preventDefault 하지 않아 바깥(세로)으로 자연히 넘어가요.
export const SKIP = '#chat, #qr--bar, .mes_text, textarea, pre, iframe, [contenteditable=""], [contenteditable="true"], [data-bl-wheel-x="off"]';
const LINE = 20;   // deltaMode 1(줄) 한 칸 — tab-scroll.js 와 같은 값

/** 대상에서 올라가며 가로로만 넘치는 첫 스크롤 칸 (없으면 null). style 은 시험용으로 바꿔 넣을 수 있어요. */
export function findWheelStrip(target, root = null, style = el => el.ownerDocument.defaultView.getComputedStyle(el)) {
    let el = target?.nodeType === 1 ? target : target?.parentElement;
    if (!el || el.closest?.(SKIP)) return null;
    for (; el && el !== root && el.nodeType === 1 && el !== el.ownerDocument?.body; el = el.parentElement) {
        const cw = el.clientWidth;
        if (!cw || el.scrollWidth <= cw + 1) continue;
        if (el.scrollHeight > el.clientHeight + 1) return null;   // 세로로도 넘치는 칸 — 세로 스크롤이 우선
        const overflow = style(el).overflowX;
        if (overflow === 'auto' || overflow === 'scroll') return el;
    }
    return null;
}

/** 세로 휠을 칸의 가로 스크롤로. 실제로 움직였을 때만 preventDefault — 돌려주는 값은 움직였는지. */
export function wheelToX(event, strip) {
    if (!strip || !event.deltaY) return false;
    const before = strip.scrollLeft;
    strip.scrollLeft += event.deltaY * (event.deltaMode === 1 ? LINE : event.deltaMode === 2 ? strip.clientWidth : 1);
    if (strip.scrollLeft === before) return false;
    event.preventDefault();
    return true;
}

/** 휠을 받아야 하는 이벤트인가 — 보조키 · 가로 우세 · 이미 처리됨 · 테마 꺼짐이면 아니요 */
export function wantsWheel(event, body) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey) return false;
    if (!event.deltaY || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return false;
    return !!body?.classList?.contains('salty');
}

const KEY = Symbol.for('blue-lemonade.wheel-x.v1');
export function installWheelX(doc = globalThis.document) {
    if (!doc?.documentElement || doc[KEY]) return;
    doc[KEY] = true;
    doc.addEventListener('wheel', event => {
        if (!wantsWheel(event, doc.body)) return;
        wheelToX(event, findWheelStrip(event.target, doc.body));
    }, { passive: false });
}
