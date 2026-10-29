// 아바타 썸네일 지연 로딩 (8.2.2 뒤 · 성능): 캐릭터 목록 · 페르소나 목록의 화면 밖 아바타는 스크롤해 가까워질 때 받는다.
// 왜: 캐릭터가 수백이면 목록을 그릴 때 썸네일 요청이 한 번에 수백 개 나가 폰에서 목록이 늦게 뜨고 첫 스크롤이 끊긴다.
// 어떻게 (실리태번 1.19 기준):
//  ① 실리태번이 복제해 쓰는 템플릿(#character_template · #user_avatar_template)의 <img> 에 loading="lazy" · decoding="async" 를 붙인다.
//     복제된 그림은 src 가 들어가도(문서에 붙기 전) 브라우저가 받지 않고 문서에 붙어 화면 가까이 올 때 받는다 — 우리가 보기 전에 요청이 나가는 일이 없다.
//  ② 목록 뿌리(#rm_print_characters_block · #user_avatar_block)에만 childList 감시자(subtree 없음)를 걸어, 새로 들어온 블록의 lazy 그림을
//     src → data-bl-src 로 옮기고 투명 1px 자리표시로 바꾼 뒤 IntersectionObserver(뷰포트 위아래 한 화면 여유)로 본다. 가까워지면 src 를 되돌린다.
//     템플릿 표시(loading=lazy)가 없는 그림(그룹 아바타 · 이미 캐시에서 받은 그림)은 손대지 않는다 — 요청이 이미 나갔거나 끝났으니 바꿔 끼우면 오히려 낭비.
//  ③ 이미 문서에 있던 그림은 켤 때도 건드리지 않는다(깜빡임 금지). 끄면 남은 자리표시를 모두 되돌리고 감시자 · 템플릿 속성을 뗀다.
//  최근 채팅(#chat .welcomePanel)은 실리태번이 HTML 문자열로 한 번에 만들어 넣어(createContextualFragment) 우리가 보기 전에 요청이 나간다
//  → 거기엔 decoding="async" 만 붙인다 (그리기를 막지 않게). 답장 중(body[data-generating])에 #chat 에 들어오는 메시지는 바로 지나친다.
// 다른 모듈: multi-avatar 는 그림의 원래 주소를 data-bl-src 에서도 읽는다(자리표시로 바뀐 그림의 캐릭터를 알아보게). 다른 모듈이 자리표시를 다른
//  그림으로 바꿔 두었으면 가까워져도 되돌리지 않는다.
// 설정: 채팅 › 화면 › 가볍게 「아바타는 가까워질 때 받기」 (chat.lazyAvatars, 기본 켬)
export const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export const ROOT_MARGIN = '100% 0px 100% 0px';   // 뷰포트 위아래 한 화면씩 미리
export const LIST_ROOTS = ['rm_print_characters_block', 'user_avatar_block'];
const TEMPLATE_IMGS = '#character_template .avatar img, #user_avatar_template .avatar img';
let on = false, io = null, chatWatcher = null;
const watchers = new Map();   // 목록 뿌리 → MutationObserver
const pending = new Set();    // 자리표시로 바꿔 둔 그림 (끌 때 모두 되돌린다 — 문서에서 빠진 그림도)

function markTemplates(enable) {
    for (const img of document.querySelectorAll(TEMPLATE_IMGS)) {
        if (enable) { img.setAttribute('loading', 'lazy'); img.setAttribute('decoding', 'async'); img.dataset.blLazyTpl = '1'; }
        else if (img.dataset.blLazyTpl) { img.removeAttribute('loading'); img.removeAttribute('decoding'); delete img.dataset.blLazyTpl; }
    }
}

/** 가까워진 그림: 자리표시였으면 원래 주소로. 다른 모듈이 이미 바꿨으면 그대로 둔다 */
export function reveal(img) {
    io?.unobserve(img); pending.delete(img);
    const src = img.dataset.blSrc;
    if (src === undefined) return false;
    delete img.dataset.blSrc;
    if (img.getAttribute('src') !== PLACEHOLDER) return false;
    img.setAttribute('src', src);
    return true;
}

/**
 * 새로 들어온 블록 안의 아바타 그림을 미룬다. 돌려주는 값: 미룬 그림 수.
 * lazy 표시가 없는 그림 · data: 그림 · 이미 받은 그림(complete)은 decoding 만 붙이고 지나친다.
 */
export function deferImages(node) {
    if (!node || node.nodeType !== 1) return 0;
    let n = 0;
    const imgs = node.matches?.('img') ? [node] : node.querySelectorAll?.('.avatar img') ?? [];
    for (const img of imgs) {
        if (img.dataset.blLazy) continue;
        img.dataset.blLazy = '1';
        if (img.getAttribute('decoding') !== 'async') img.setAttribute('decoding', 'async');
        const src = img.getAttribute('src') || '';
        if (!io || img.getAttribute('loading') !== 'lazy' || !src || src.startsWith('data:') || (img.complete && img.naturalWidth > 0)) continue;
        img.dataset.blSrc = src;
        img.setAttribute('src', PLACEHOLDER);
        io.observe(img); pending.add(img);
        n++;
    }
    return n;
}

function onSeen(entries) {
    for (const e of entries) if (e.isIntersecting) reveal(e.target);
}
function restoreAll() {
    for (const img of [...pending]) reveal(img);
}
function watchRoot(root) {
    if (!root || watchers.has(root)) return;
    const mo = new MutationObserver(records => { for (const r of records) for (const node of r.addedNodes) deferImages(node); });
    mo.observe(root, { childList: true });
    watchers.set(root, mo);
}
/** 최근 채팅(웰컴 패널)의 그림엔 decoding=async 만 — 메시지(.mes) · 답장 중엔 바로 지나친다 */
export function easeRecentChats(node) {
    if (!node || node.nodeType !== 1 || node.classList?.contains('mes') || document.body?.dataset?.generating) return 0;
    const panel = node.classList?.contains('welcomePanel') ? node : node.querySelector?.('.welcomePanel');
    if (!panel) return 0;
    let n = 0;
    for (const img of panel.querySelectorAll('.recentChat .avatar img')) {
        if (img.getAttribute('decoding') === 'async') continue;
        img.setAttribute('decoding', 'async'); n++;
    }
    return n;
}

export function syncLazyAvatars(enabled) {
    on = !!enabled;
    if (!on) {
        for (const mo of watchers.values()) mo.disconnect();
        watchers.clear();
        chatWatcher?.disconnect(); chatWatcher = null;
        restoreAll();
        io?.disconnect(); io = null;
        markTemplates(false);
        return;
    }
    if (!io && typeof IntersectionObserver === 'function') io = new IntersectionObserver(onSeen, { rootMargin: ROOT_MARGIN, threshold: 0 });
    markTemplates(true);   // 관찰자가 없는 환경이어도 브라우저 자체 lazy 는 살린다
    for (const id of LIST_ROOTS) watchRoot(document.getElementById(id));
    const chat = document.getElementById('chat');
    if (chat && !chatWatcher) {
        chatWatcher = new MutationObserver(records => { for (const r of records) for (const node of r.addedNodes) easeRecentChats(node); });
        chatWatcher.observe(chat, { childList: true });
    }
}

/** 시험용 */
export const _forTest = { state: () => ({ on, io: !!io, roots: watchers.size, chat: !!chatWatcher, pending: pending.size }) };
