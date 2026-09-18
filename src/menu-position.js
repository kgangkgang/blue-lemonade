// Keep message menus in the visible chat viewport, including centered/left
// profile headers. The top layer avoids clipping by cards and transformed chat.
const open = new Set();
let frame = 0, resize;
const schedule = () => { if (!frame && open.size) frame = requestAnimationFrame(place); };
function clear(menu) {
    open.delete(menu); resize?.unobserve(menu);
    if (menu.matches(':popover-open')) menu.hidePopover();
    menu.removeAttribute('popover'); menu.classList.remove('bl-positioned-menu');
    for (const key of ['--bl-menu-x', '--bl-menu-y', '--bl-menu-height']) menu.style.removeProperty(key);
}
function place() {
    frame = 0;
    const viewport = window.visualViewport;
    const left = (viewport?.offsetLeft || 0) + 8, top = (viewport?.offsetTop || 0) + 8;
    const right = left + (viewport?.width || document.documentElement.clientWidth) - 16;
    const bottom = top + (viewport?.height || window.innerHeight) - 16;
    for (const menu of open) {
        if (!menu.isConnected || !menu.classList.contains('visible') || !document.body.classList.contains('salty') || document.body.classList.contains('expandMessageActions')) { clear(menu); continue; }
        const anchor = menu.parentElement.getBoundingClientRect();
        const chat = menu.closest('#chat')?.getBoundingClientRect();
        const floor = Math.max(top + 44, Math.min(bottom, chat?.bottom || bottom));
        const ceiling = Math.max(top, Math.min(floor - 44, chat?.top || top));
        const height = Math.max(44, floor - ceiling);
        menu.style.setProperty('--bl-menu-height', height + 'px');
        const rect = menu.getBoundingClientRect();
        const x = Math.max(left, Math.min(right - rect.width, anchor.right - rect.width));
        const y = anchor.bottom + 6 + rect.height <= floor ? anchor.bottom + 6 : anchor.top - rect.height - 6;
        menu.style.setProperty('--bl-menu-x', x + 'px');
        menu.style.setProperty('--bl-menu-y', Math.max(ceiling, Math.min(floor - rect.height, y)) + 'px');
    }
    if (!open.size) stop();
}
function stop() {
    cancelAnimationFrame(frame); frame = 0; resize?.disconnect();
    document.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('resize', schedule); window.visualViewport?.removeEventListener('scroll', schedule);
}
export function syncMessageMenus() { schedule(); }
export function positionMessageMenu(menu, visible) {
    if (!visible || !document.body.classList.contains('salty') || document.body.classList.contains('expandMessageActions')) {
        if (open.has(menu)) clear(menu);
        if (!open.size) stop();
        return;
    }
    if (!open.has(menu)) {
        if (!open.size) {
            document.addEventListener('scroll', schedule, { capture: true, passive: true }); window.addEventListener('resize', schedule);
            window.visualViewport?.addEventListener('resize', schedule); window.visualViewport?.addEventListener('scroll', schedule);
        }
        open.add(menu); menu.classList.add('bl-positioned-menu');
        if (typeof menu.showPopover === 'function') { menu.setAttribute('popover', 'manual'); menu.showPopover(); }
        resize ||= new ResizeObserver(schedule); resize.observe(menu);
    }
    schedule();
}
