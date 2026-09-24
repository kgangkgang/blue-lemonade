// Keep the native selection handles/menu anchored while dialogue is animated.
let bound = false, pressing = false, releaseTimer = 0;
const scope = '#chat .mes_text, .cg-root, .salty-preview';
const inside = node => (node?.nodeType === 1 ? node : node?.parentElement)?.closest?.(scope);
function update() {
    const selection = document.getSelection();
    const selected = selection && !selection.isCollapsed &&
        (inside(selection.anchorNode) || inside(selection.focusNode));
    document.body.classList.toggle('bl-dem-selecting', !!(pressing || selected));
}
function down(event) {
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
        document.body.classList.remove('bl-dem-selecting');
    }
}
