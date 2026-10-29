// Keep native mouse/keyboard controls; touch requires a deliberate horizontal drag, then the native slider takes over.
export const THEME_RANGES = 'input[type="range"]:is([data-range],[data-touch-range])';
// 8.2.7 폰 예측점검: 애드온 · 도구 창 슬라이더(TTS 설정 · 목소리 편집 · 커스텀 CSS 조절 · 메모 설정 · 프롬프트 패널 · 액자 편집 · 캡처 필터)는 이 보호가 없어서
//   창을 손가락으로 굴리다 슬라이더 위에서 시작하면 닿은 자리로 값이 뛰고 input · change 가 나가 저장됐어요(폰 흉내 엣지: 세로로 200px 밀면 50 → 82).
//   테마 설정 슬라이더와 같은 규칙(가로로 민 손짓만 값)을 문서에 한 벌만 걸어요. 테마 슬라이더([data-range] · [data-touch-range])는 제 뿌리가 받으니 뺐어요
export const ADDON_RANGES = ':is(#lv_settings, .lv-editor, #ctsi-drawer-content, .bl-notes-look, #pt-panel, .bl-frame-editor) input[type="range"]:not([data-range],[data-touch-range]), '
    + 'input[type="range"]:is([data-capture-option], [data-mask-param], .pt-param-slider, #pt-orig-size, #pt-trans-size):not([data-range],[data-touch-range])';
let addonBound = false;
export function startAddonTouchSliders(doc = document) { if (addonBound) return; addonBound = true; bindTouchSliders(doc, ADDON_RANGES); }
export function bindTouchSliders(root, ranges = THEME_RANGES) {
    let gesture = null;
    root.addEventListener('pointerdown', event => {
        const input = event.target.closest?.(ranges);
        if (event.pointerType !== 'touch' || !input || input.disabled || !event.isPrimary) return;
        event.preventDefault();
        gesture = { input, id: event.pointerId, x: event.clientX, y: event.clientY, value: input.value, horizontal: false, vertical: false };
    }, { passive: false });
    root.addEventListener('pointermove', event => {
        const g = gesture;
        if (!g || g.id !== event.pointerId || g.vertical || g.horizontal) return;
        const dx = event.clientX - g.x, dy = event.clientY - g.y;
        if (Math.abs(dy) >= 8 && Math.abs(dy) >= Math.abs(dx)) { g.vertical = true; return; }
        if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
        // No setPointerCapture: moving capture off the native thumb ended the gesture early (extra change, split undo).
        // From here the native slider drives the value and fires change on release.
        g.horizontal = true;
    });
    const finish = event => { if (gesture?.id === event.pointerId) gesture = null; };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(type, finish);
    // Some engines emit range input on contact before resolving pan-y.
    for (const type of ['input', 'change']) root.addEventListener(type, event => {
        if (gesture?.input === event.target && !gesture.horizontal) {
            event.stopImmediatePropagation();
            event.target.value = gesture.value;
        }
    }, true);
}
