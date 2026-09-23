// A render-only snapshot: never replace the persisted settings object.
let preview = null, owner = null;
const keys = ['palette','gradients','nightTint','lightTint','colorOverrides','customName','fonts','type','dialogue','ui','code','em','strong','shadow','outline','profile','userProfile','image','chat'];
export function appearanceSnapshot(settings) {
    return Object.fromEntries(keys.map(k => [k, structuredClone(settings[k])]));
}
export function beginComparison(token, snapshot) { owner = token; preview = snapshot; }
export function endComparison(token) {
    if (owner !== token) return false;
    preview = null; owner = null; return true;
}
export function comparisonView(settings) {
    return preview ? {...settings, ...structuredClone(preview)} : settings;
}
export function bindComparison(root, settings, apply) {
    let baseline = appearanceSnapshot(settings);
    let held = false;
    const stop = () => {
        if (!held) return;
        held = false; endComparison(root); apply();
        root.querySelector('[data-compare]')?.setAttribute('aria-pressed','false');
    };
    const start = button => {
        if (held) return;
        held = true; beginComparison(root, baseline); apply();
        button.setAttribute('aria-pressed','true');
    };
    const down = e => {
        const button = e.target.closest('[data-compare]');
        if (!button || e.button !== 0) return;
        e.preventDefault(); button.focus(); button.setPointerCapture(e.pointerId); start(button);
    };
    const keydown = e => {
        if (e.key === 'Escape') { stop(); return; }
        if (!e.target.closest('[data-compare]') || ![' ','Enter'].includes(e.key)) return;
        e.preventDefault(); start(e.target.closest('[data-compare]'));
    };
    const keyup = e => { if ([' ','Enter'].includes(e.key)) stop(); };
    const visibility = () => { if (document.hidden) stop(); };
    const focusout = e => { if (e.target.closest('[data-compare]')) stop(); };
    root.addEventListener('pointerdown',down);
    root.addEventListener('keydown',keydown);
    root.addEventListener('focusout',focusout);
    root.addEventListener('lostpointercapture',stop);
    for (const event of ['pointerup','pointercancel','blur']) window.addEventListener(event,stop);
    window.addEventListener('keyup',keyup);
    document.addEventListener('visibilitychange',visibility);
    root._stopComparison = stop;
    root._resetComparison = current => { stop(); baseline = appearanceSnapshot(current); };
    return () => {
        stop();
        root.removeEventListener('pointerdown',down); root.removeEventListener('keydown',keydown);
        root.removeEventListener('focusout',focusout); root.removeEventListener('lostpointercapture',stop);
        for (const event of ['pointerup','pointercancel','blur']) window.removeEventListener(event,stop);
        window.removeEventListener('keyup',keyup); document.removeEventListener('visibilitychange',visibility);
    };
}
