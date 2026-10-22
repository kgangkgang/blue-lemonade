// Horizontal navigation only. Callers explicitly register strips, never option grids.
const KEY = Symbol.for('blue-lemonade.tab-scroll.v1');
const ACTIVE = '[aria-selected="true"], [aria-pressed="true"], .active, .on, .is-active, .ui-tabs-active';

export function revealTab(bar, tab) {
    if (!bar || !tab || !bar.clientWidth || bar.scrollWidth <= bar.clientWidth + 1) return;
    const b = bar.getBoundingClientRect(), t = tab.getBoundingClientRect();
    const left = b.left + bar.clientLeft, right = left + bar.clientWidth;
    // Only this strip moves; focusing a tab must not scroll its dialog or document.
    const delta = t.width > bar.clientWidth ? t.left - left : t.left < left ? t.left - left : t.right > right ? t.right - right : 0;
    if (Math.abs(delta) > 0.5) bar.scrollLeft += delta;
}

export function installTabScroll(selectors, doc = globalThis.document) {
    if (!doc?.documentElement || !selectors?.length) return;
    if (doc[KEY]) { doc[KEY].add(selectors); return; }
    const win = doc.defaultView, names = new Set(), states = new Map();
    let selector = '', frame = 0;
    const pending = new Set();
    const buttons = bar => [...bar.querySelectorAll('button, a[href], [role="tab"], [role="button"]')].filter(el => !el.disabled && el.getAttribute('aria-disabled') !== 'true' && !el.closest('[hidden]') && el.getClientRects().length && el.closest(selector) === bar);
    const selected = bar => buttons(bar).find(el => el.matches(ACTIVE) || el.parentElement?.matches('.ui-tabs-active'));
    const schedule = bar => {
        pending.add(bar);
        if (!frame) frame = win.requestAnimationFrame(() => {
            frame = 0;
            for (const row of pending) {
                if (!row.isConnected) continue;
                const active = selected(row);
                if (active) revealTab(row, active);
            }
            pending.clear();
        });
    };
    const resize = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(entries => entries.forEach(e => schedule(e.target))) : null;
    function bind(bar) {
        if (states.has(bar)) return;
        const controller = new win.AbortController();
        const signal = controller.signal;
        const observer = new win.MutationObserver(records => {
            // Scroll position is deliberately not observed: swiping must stay under user control.
            if (records.some(r => r.type === 'childList' || r.oldValue !== r.target.getAttribute(r.attributeName))) schedule(bar);
        });
        observer.observe(bar, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['aria-selected', 'aria-pressed', 'class', 'hidden'] });
        bar.addEventListener('focusin', e => {
            const tab = buttons(bar).find(el => el === e.target || el.contains(e.target));
            if (tab) revealTab(bar, tab);
        }, { signal });
        bar.addEventListener('click', () => schedule(bar), { signal });
        bar.addEventListener('wheel', e => {
            if (e.ctrlKey || e.metaKey || e.shiftKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY) || bar.scrollWidth <= bar.clientWidth + 1) return;
            const before = bar.scrollLeft;
            bar.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 20 : e.deltaMode === 2 ? bar.clientWidth : 1);
            if (bar.scrollLeft !== before) e.preventDefault();
        }, { signal, passive: false });
        states.set(bar, { controller, observer });
        resize?.observe(bar);
        schedule(bar);
    }
    function scan(node) {
        if (node.nodeType !== 1) return;
        if (node.matches(selector)) bind(node);
        node.querySelectorAll(selector).forEach(bind);
    }
    const cleanup = () => {
        for (const [bar, state] of states) if (!bar.isConnected) {
            state.controller.abort(); state.observer.disconnect(); resize?.unobserve(bar);
            states.delete(bar); pending.delete(bar);
        }
    };
    const api = { add(list) {
        const fresh = list.filter(s => !names.has(s));
        if (!fresh.length) return;
        fresh.forEach(s => names.add(s)); selector = [...names].join(',');
        doc.querySelectorAll(fresh.join(',')).forEach(bind);
    } };
    doc[KEY] = api;
    api.add(selectors);
    new win.MutationObserver(records => {
        let removed = false;
        for (const r of records) {
            r.addedNodes.forEach(scan);
            if ([...r.removedNodes].some(n => n.nodeType === 1)) removed = true;
        }
        if (removed) cleanup();
    }).observe(doc.documentElement, { childList: true, subtree: true });
    // Existing tab handlers run first. Supply focus navigation only when they did not handle it; Enter/Space keep native activation.
    doc.addEventListener('keydown', e => {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        const bar = e.target.closest?.(selector);
        if (!bar || bar.getAttribute('aria-orientation') === 'vertical') return;
        const tabs = buttons(bar), at = tabs.indexOf(e.target);
        if (at < 0 || !tabs.length) return;
        const rtl = win.getComputedStyle(bar).direction === 'rtl';
        const step = (e.key === 'ArrowRight' ? 1 : -1) * (rtl ? -1 : 1);
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (at + step + tabs.length) % tabs.length;
        e.preventDefault();
        tabs[next].focus({ preventScroll: true }); revealTab(bar, tabs[next]);
    });
    doc.fonts?.ready?.then(() => states.forEach((_state, bar) => schedule(bar)));
}
