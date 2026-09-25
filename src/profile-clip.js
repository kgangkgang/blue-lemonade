// Round the painted photo, including contain-mode letterboxing, rather than its empty box.
const selector = '.mes:not([is_system="true"]):not(.smallSysMes) > .mesAvatarWrapper > .avatar img';
const tracked = new Set(), dirty = new Set();
const ownerOf = img => img.closest('.mes')?.getAttribute('is_user') === 'true' ? 'userProfile' : 'profile';
let active = { profile: false, userProfile: false };
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
        const p = options[ownerOf(img)];
        const ratio = img.naturalWidth / img.naturalHeight / (p.visibleHeight / 100);
        if (!Number.isFinite(ratio) || ratio <= 0) continue;
        const bounds = photoBounds(img.clientWidth, img.clientHeight, ratio, p.positionX, p.positionY);
        const radius = Math.max(0, p.radius - p.edgeGap);
        writes.push([img, `inset(${bounds.map(n => `${n.toFixed(3)}px`).join(' ')} round ${radius}px)`]);
    }
    dirty.clear();
    for (const [img, clip] of writes) {
        if (clip && img.style.getPropertyValue('--bl-photo-clip') !== clip) img.style.setProperty('--bl-photo-clip', clip);
        else if (!clip) img.style.removeProperty('--bl-photo-clip');
    }
}
function queue(img) { if (img) dirty.add(img); if (!frame) frame = requestAnimationFrame(flush); }
function scan(root) {
    if (root.nodeType !== 1 || (root.tagName !== 'IMG' && !root.querySelector('img'))) return;
    const imgs = [...root.querySelectorAll(selector)]; if (root.matches(selector)) imgs.push(root);
    for (const img of imgs) { if (!active[ownerOf(img)]) continue; if (!tracked.has(img)) { tracked.add(img); resize.observe(img); } queue(img); }
}
// Hiding/unhiding only flips is_system on an existing message.
function toggle(mes) {
    for (const img of mes.querySelectorAll('.mesAvatarWrapper > .avatar img')) {
        if (img.matches(selector)) continue;
        if (tracked.has(img)) { resize.unobserve(img); tracked.delete(img); dirty.delete(img); }
        img.style.removeProperty('--bl-photo-clip');
    }
    scan(mes);
}
function loaded(event) { if (tracked.has(event.target)) queue(event.target); }
function stop() {
    observer?.disconnect(); resize?.disconnect(); cancelAnimationFrame(frame); frame = 0;
    for (const root of roots) root.removeEventListener('load', loaded, true);
    for (const img of tracked) img.style.removeProperty('--bl-photo-clip');
    roots = []; tracked.clear(); dirty.clear(); signature = '';
}
export function syncProfileClip(settings) {
    const nextActive = Object.fromEntries(['profile', 'userProfile'].map(owner => [owner, !!(settings.enabled && settings[owner]?.mode === 'banner' && settings[owner]?.fit === 'contain')]));
    if (nextActive.profile !== active.profile || nextActive.userProfile !== active.userProfile) stop();
    active = nextActive;
    if (!active.profile && !active.userProfile) { if (roots.length) stop(); return; }
    options = settings;
    const nextRoots = [...document.querySelectorAll('#chat, .salty-preview')];
    if (roots.length !== nextRoots.length || nextRoots.some((r, i) => r !== roots[i])) {
        stop(); roots = nextRoots;
        resize ||= new ResizeObserver(entries => entries.forEach(e => queue(e.target)));
        observer ||= new MutationObserver(records => {
            for (const rec of records) {
                if (rec.type === 'attributes') { if (rec.target.classList.contains('mes')) toggle(rec.target); continue; }
                for (const node of rec.addedNodes) scan(node);
            }
            if (records.some(rec => [...rec.removedNodes].some(node => node.nodeType === 1 && (node.tagName === 'IMG' || node.querySelector('img'))))) queue();
        });
        for (const root of roots) { observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['is_system'] }); root.addEventListener('load', loaded, true); scan(root); }
    }
    const next = ['profile', 'userProfile'].map(owner => { const p = settings[owner]; return p && active[owner] ? [p.positionX, p.positionY, p.visibleHeight, p.radius, p.edgeGap, p.decor.on].join('/') : ''; }).join('|');
    if (signature !== next) { signature = next; for (const img of tracked) queue(img); }
}
