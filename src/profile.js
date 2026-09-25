// 큰 프로필에서만, 화면 가까이에 온 캐릭터 사진을 원본으로 교체한다.
// 작은 프로필·테마 끄기에서는 관찰자를 해제하고 기존 주소로 되돌린다.
const SELECTOR = '.mes:not([is_system="true"]):not(.smallSysMes) > .mesAvatarWrapper > .avatar img';
let active = { profile: false, userProfile: false };
let enabled = false, chat = null, waiting = false;
let changes = null, visible = null, flags = null;
const swapped = new Map();
let failed = new WeakMap();

function source(img) {
    if (!img.matches(SELECTOR)) return null;
    const user = img.closest('.mes')?.getAttribute('is_user') === 'true';
    if (!active[user ? 'userProfile' : 'profile']) return null;
    try {
        const url = new URL(img.src, location.href);
        const file = url.searchParams.get('file');
        if (url.origin !== location.origin || !url.pathname.endsWith('/thumbnail') || url.searchParams.get('type') !== (user ? 'persona' : 'avatar') || !file || /[/\\]/.test(file)) return null;
        const full = new URL(`${user ? 'User Avatars' : 'characters'}/${encodeURIComponent(file)}`, document.baseURI);
        for (const [key, value] of url.searchParams) if (key !== 'file' && key !== 'type') full.searchParams.set(key, value);
        return full.href;
    } catch { return null; }
}
function watch(img) {
    const full = source(img);
    if (full && failed.get(img) !== full) visible?.observe(img);
}
function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches(SELECTOR)) watch(root);
    for (const img of root.querySelectorAll(SELECTOR)) watch(img);
}
// 숨기기·보이기: 다시 보이면 원본을 걸고, 숨기면 썸네일로 되돌린다.
function toggle(records) {
    for (const { target } of records) {
        if (!target.classList?.contains('mes')) continue;
        for (const img of target.querySelectorAll('.mesAvatarWrapper > .avatar img')) {
            if (img.matches(SELECTOR)) { watch(img); continue; }
            visible?.unobserve(img);
            const previous = swapped.get(img);
            if (!previous) continue;
            if (img.src === previous.full) img.src = previous.thumb;
            swapped.delete(img);
        }
    }
}
function load(event) { if (event.target instanceof HTMLImageElement) watch(event.target); }
function error(event) {
    const img = event.target, previous = swapped.get(img);
    if (!previous || img.src !== previous.full) return;
    failed.set(img, previous.full); swapped.delete(img);
    img.src = previous.thumb;
}
function stop() {
    changes?.disconnect(); visible?.disconnect(); flags?.disconnect(); changes = visible = flags = null;
    chat?.removeEventListener('load', load, true); chat?.removeEventListener('error', error, true);
    for (const [img, previous] of swapped) if (img.src === previous.full) img.src = previous.thumb;
    swapped.clear(); failed = new WeakMap(); chat = null;
}
function start() {
    if (!enabled || chat) return;
    chat = document.getElementById('chat');
    if (!chat) return;
    visible = new IntersectionObserver(entries => {
        for (const { target: img, isIntersecting } of entries) {
            if (!isIntersecting) continue;
            visible.unobserve(img);
            const full = source(img);
            if (!full || failed.get(img) === full) continue;
            swapped.set(img, { thumb: img.src, full });
            img.src = full;
        }
    }, { root: chat, rootMargin: '160px' });
    changes = new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.addedNodes) scan(node);
            for (const node of record.removedNodes) {
                if (node.nodeType !== 1) continue;
                for (const img of node.querySelectorAll('img')) visible.unobserve(img);
            }
        }
        for (const [img, previous] of swapped) if (!chat.contains(img)) {
            if (img.src === previous.full) img.src = previous.thumb;
            swapped.delete(img);
        }
    });
    // 본문 스트림은 감시하지 않고 메시지 추가·삭제만 받는다.
    changes.observe(chat, { childList: true });
    flags = new MutationObserver(toggle);
    flags.observe(chat, { subtree: true, attributes: true, attributeFilter: ['is_system'] });
    chat.addEventListener('load', load, true); chat.addEventListener('error', error, true);
    scan(chat);
}
export function syncProfile(settings) {
    const owners = Object.fromEntries(['profile', 'userProfile'].map(owner => [owner, !!(settings.enabled && settings[owner]?.mode === 'banner' && settings[owner]?.original)]));
    if (owners.profile !== active.profile || owners.userProfile !== active.userProfile) { stop(); active = owners; }
    enabled = active.profile || active.userProfile;
    if (!enabled) return;
    if (document.readyState === 'loading' && !document.getElementById('chat')) {
        if (!waiting) { waiting = true; document.addEventListener('DOMContentLoaded', () => { waiting = false; start(); }, { once: true }); }
    } else start();
}
