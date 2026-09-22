// Keep native mouse/keyboard controls; touch requires a deliberate horizontal drag, then the native slider takes over.
export function bindTouchSliders(root) {
    let gesture = null;
    root.addEventListener('pointerdown', event => {
        const input = event.target.closest('input[type="range"][data-range]');
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
