// Round the painted photo, including contain-mode letterboxing, rather than its empty box.
const selector = '.mes:not([is_user="true"]):not([is_system="true"]):not(.smallSysMes) > .mesAvatarWrapper > .avatar img';
const tracked = new Set(), dirty = new Set();
let roots = [], observer, resize, frame = 0, options, signature = '';
export function photoBounds(width, height, ratio, x, y) {
    const w = Math.min(width, height * ratio), h = Math.min(height, width / ratio);
    const left = Math.max(0, width - w) * x / 100, top = Math.max(0, height - h) * y / 100;
    return [top, Math.max(0, width - w - left), Math.max(0, height - h - top), left];
}
function flush() {
    frame = 0;
    for (const img of tracked) if (!img.isConnected) { resize.unobserve(img); tracked.delete(img); dirty.delete(img); }
    const writes = [];
    for (const img of dirty) {
        if (!img.isConnected || img.closest('.bl-art-frame')) { writes.push([img, '']); continue; }
        const ratio = img.naturalWidth / img.naturalHeight / (options.visibleHeight / 100);
        if (!Number.isFinite(ratio) || ratio <= 0) continue;
        const bounds = photoBounds(img.clientWidth, img.clientHeight, ratio, options.positionX, options.positionY);
        const radius = Math.max(0, options.radius - options.edgeGap);
        writes.push([img, `inset(${bounds.map(n => `${n.toFixed(3)}px`).join(' ')} round ${radius}px)`]);
    }
    dirty.clear();
    for (const [img, clip] of writes) {
        if (clip) img.style.setProperty('--bl-photo-clip', clip);
        else img.style.removeProperty('--bl-photo-clip');
    }
}
function queue(img) { if (img) dirty.add(img); if (!frame) frame = requestAnimationFrame(flush); }
function scan(root) {
    if (root.nodeType !== 1) return;
    const imgs = [...root.querySelectorAll(selector)]; if (root.matches(selector)) imgs.push(root);
    for (const img of imgs) { if (!tracked.has(img)) { tracked.add(img); resize.observe(img); } queue(img); }
}
function loaded(event) { if (tracked.has(event.target)) queue(event.target); }
function stop() {
    observer?.disconnect(); resize?.disconnect(); cancelAnimationFrame(frame); frame = 0;
    for (const root of roots) root.removeEventListener('load', loaded, true);
    for (const img of tracked) img.style.removeProperty('--bl-photo-clip');
    roots = []; tracked.clear(); dirty.clear(); signature = '';
}
export function syncProfileClip(settings) {
    const p = settings.profile;
    if (!settings.enabled || p.mode !== 'banner' || p.fit !== 'contain') { if (roots.length) stop(); return; }
    options = p;
    const nextRoots = [...document.querySelectorAll('#chat, .salty-preview')];
    if (roots.length !== nextRoots.length || nextRoots.some((r, i) => r !== roots[i])) {
        stop(); roots = nextRoots;
        resize ||= new ResizeObserver(entries => entries.forEach(e => queue(e.target)));
        observer ||= new MutationObserver(records => {
            for (const rec of records) for (const node of rec.addedNodes) scan(node);
            queue();
        });
        for (const root of roots) { observer.observe(root, { childList: true, subtree: true }); root.addEventListener('load', loaded, true); scan(root); }
    }
    const next = [p.positionX, p.positionY, p.visibleHeight, p.radius, p.edgeGap, p.decor.on].join('/');
    if (signature !== next) { signature = next; for (const img of tracked) queue(img); }
}
