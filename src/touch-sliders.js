// Keep native mouse/keyboard controls; touch requires a deliberate horizontal drag.
export function bindTouchSliders(root) {
    let gesture = null, writing = false;
    const emit = (input, type) => { writing = true; try { input.dispatchEvent(new Event(type, { bubbles: true })); } finally { writing = false; } };
    root.addEventListener('pointerdown', event => {
        const input = event.target.closest('input[type="range"][data-range]');
        if (event.pointerType !== 'touch' || !input || input.disabled || !event.isPrimary) return;
        event.preventDefault();
        gesture = { input, id: event.pointerId, x: event.clientX, y: event.clientY, value: input.value, horizontal: false, vertical: false, width: Math.max(1, input.getBoundingClientRect().width - 24), rtl: getComputedStyle(input).direction === 'rtl' };
    }, { passive: false });
    root.addEventListener('pointermove', event => {
        const g = gesture;
        if (!g || g.id !== event.pointerId || g.vertical) return;
        const dx = event.clientX - g.x, dy = event.clientY - g.y;
        if (!g.horizontal) {
            if (Math.abs(dy) >= 8 && Math.abs(dy) >= Math.abs(dx)) { g.vertical = true; return; }
            if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
            g.horizontal = true;
            try { g.input.setPointerCapture(event.pointerId); } catch { /* Synthetic events or an ended pointer. */ }
        }
        event.preventDefault();
        const min = Number(g.input.min), max = Number(g.input.max), step = Number(g.input.step) || 1;
        const raw = Number(g.value) + dx / g.width * (max - min) * (g.rtl ? -1 : 1);
        const next = Math.max(min, Math.min(max, min + Math.round((raw - min) / step) * step));
        const before = g.input.value; g.input.value = String(Number(next.toFixed(8)));
        if (g.input.value !== before) emit(g.input, 'input');
    }, { passive: false });
    const finish = event => {
        const g = gesture;
        if (!g || g.id !== event.pointerId) return;
        gesture = null;
        if (g.input.isConnected && g.horizontal && g.input.value !== g.value) emit(g.input, 'change');
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) root.addEventListener(type, finish);
    // Some engines emit range input on contact before resolving pan-y.
    for (const type of ['input', 'change']) root.addEventListener(type, event => {
        if (!writing && gesture?.input === event.target) {
            event.stopImmediatePropagation();
            if (!gesture.horizontal) event.target.value = gesture.value;
        }
    }, true);
}
