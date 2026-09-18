import { hasDecor } from './decor.js';
const ASSET = '.mes_text :is(.custom-cac-img, img.character-asset-rendered, img.eh-img, [class*="custom-imageWrapper"] img)';
const PROFILE = '.mes:not([is_user="true"]):not([is_system="true"]):not(.smallSysMes) > .mesAvatarWrapper > .avatar img';
const wrapped = new Map();
let state = { image: false, profile: false }, observer = null, roots = [], frame = 0;
const dirty = new Set();
const maskCache = new Map(), maskSources = {};
function windowFor(mask) {
    if (maskCache.has(mask)) return maskCache.get(mask);
    if (maskCache.size >= 4) maskCache.delete(maskCache.keys().next().value);
    const job = new Promise(resolve => {
        const image = new Image();
        image.onerror = () => resolve('0%');
        image.onload = () => {
            // Legacy saved frames have only a PNG mask. Read its bounds once so
            // rounding clips the inner photo window, not the outer canvas.
            const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const { width: w, height: h } = canvas, pixels = ctx.getImageData(0, 0, w, h).data;
            let left = w, top = h, right = -1, bottom = -1;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (pixels[(y * w + x) * 4 + 3] > 8) {
                left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
            }
            resolve(right < 0 ? '0%' : `${top / h * 100}% ${(w - right - 1) / w * 100}% ${(h - bottom - 1) / h * 100}% ${left / w * 100}%`);
            canvas.width = canvas.height = 1;
        };
        image.src = mask;
    });
    maskCache.set(mask, job); return job;
}
function syncWindows(settings, enabled) {
    for (const kind of ['image', 'profile']) {
        const mask = enabled[kind] ? settings[kind].decor.mask : '';
        if (maskSources[kind] === mask) continue;
        maskSources[kind] = mask;
        document.documentElement.style.removeProperty(`--bl-${kind}-decor-window`);
        if (mask) windowFor(mask).then(value => {
            if (maskSources[kind] === mask) document.documentElement.style.setProperty(`--bl-${kind}-decor-window`, value);
        });
    }
}
function undo(img, info) {
    if (info.kind === 'profile') { info.slot.replaceWith(img); info.host.classList.remove('bl-art-frame'); delete info.host.dataset.blFrame; }
    else info.host.replaceWith(img);
    wrapped.delete(img);
}
function wrap(img, kind) {
    if (wrapped.has(img) || !img.parentElement) return;
    const host = kind === 'profile' ? img.closest('.avatar') : document.createElement('span');
    const slot = document.createElement('span'); slot.className = 'bl-art-photo';
    if (kind === 'image') img.replaceWith(host);
    host.classList.add('bl-art-frame'); host.dataset.blFrame = kind;
    if (kind === 'profile') img.replaceWith(slot); else host.append(slot);
    slot.append(img); wrapped.set(img, { host, slot, kind });
}
function scan(root) {
    if (root.nodeType !== 1 || !root.isConnected) return;
    for (const [kind, selector] of [['image', ASSET], ['profile', PROFILE]]) {
        if (!state[kind]) continue;
        if (root.matches(selector)) wrap(root, kind);
        for (const img of root.querySelectorAll(selector)) wrap(img, kind);
    }
}
function listen() { for (const root of roots) observer.observe(root, { childList: true, subtree: true }); }
function flush() {
    frame = 0;
    // 직접 만든 감싸기 요소의 변경 알림은 남기지 않는다.
    const queued = observer?.takeRecords() || [];
    for (const rec of queued) for (const node of rec.addedNodes) if (node.nodeType === 1) dirty.add(node);
    observer?.disconnect();
    for (const [img, info] of wrapped) {
        if (!info.host.contains(img)) { wrapped.delete(img); continue; }
        if (!img.isConnected) { undo(img, info); continue; }
        if (!state[info.kind]) undo(img, info);
    }
    for (const root of dirty) scan(root);
    dirty.clear();
    if (state.image || state.profile) listen();
}
export function syncDecorView(settings) {
    const next = { image: settings.enabled && hasDecor(settings.image.decor), profile: settings.enabled && settings.profile.mode === 'banner' && hasDecor(settings.profile.decor) };
    syncWindows(settings, next);
    const nextRoots = [...document.querySelectorAll('#chat, .salty-preview')];
    if (observer && next.image === state.image && next.profile === state.profile && nextRoots.length === roots.length && nextRoots.every((root, i) => root === roots[i])) return;
    state = next; roots = nextRoots;
    if (!observer) observer = new MutationObserver(records => {
        for (const rec of records) for (const node of rec.addedNodes) if (node.nodeType === 1) dirty.add(node);
        // 삭제만 된 경우에도 참조를 해제한다.
        if (!frame) frame = requestAnimationFrame(flush);
    });
    cancelAnimationFrame(frame); frame = 0;
    if (state.image || state.profile) for (const root of roots) dirty.add(root);
    flush();
}
