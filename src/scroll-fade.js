// 세로 스크롤 칸의 넘친 쪽 흐림 (8.2.3): 스크롤바를 숨긴 칸(캐릭터 목록 · 확장 설정 · 서랍 · 팝업 본문 · 테마 설정 창 · 월드인포 목록 · 애드온 창)에서
// 「더 있음」을 보여 줘요 — 탭 줄의 가로 흐림(tab-scroll.js applyFade · data-bl-fade)과 같은 방식, 세로는 data-bl-fade-y="top|bottom|both" 로 따로.
// 왜: 커뮤니티 제보 「봇 목록 · 확장 칸에 스크롤바가 없다」 → 사용자 결정(10-29) 「스크롤바는 숨긴 채로, 넘친 쪽만 흐리게」.
// 방식: 대상은 선택자 목록(FADE_Y_SELECTORS)으로 정하고, 칸마다 passive scroll · 바로 아래 자식 변화(MutationObserver, subtree 없음) · 안에서 누름(접기 · 펼치기 뒤) ·
//   ResizeObserver(서랍 열림 = 크기 0 → n) 를 받아 rAF 한 번에 묶어 다시 재요. 넘치지 않으면 속성을 떼서 mask 가 아예 없게(mask 는 넘칠 때만).
//   body 전체 subtree 감시자는 새로 만들지 않아요 — 새 팝업은 popup-guard.js 의 body 자식 감시자(onPopupAdded)에 얹고, 확장 설정의 접힘 칸은 그 서랍 안 누름 뒤 다시 훑어요.
// 제외: #chat · 메시지 본문 · textarea · 편집 칸 · pre · iframe · 이미 자체 흐림이 있는 칸(.salty-fonttags · .salty-fontscroll · 가로 흐림 줄).
// 다른 확장: 바이바이(ST-BaiBai-Tools)는 월드인포 항목에 content-visibility + ResizeObserver 를 걸어요 — 켜져 있으면 월드인포 목록은 건너뛰어요(resting).
// CSS 는 css/73-scroll-fade.css(모두 mask-image — 서랍의 sticky 가상 요소는 스크롤에 긴 작업을 만들어 뺐어요). 끄기는 탭 줄 흐림과 같은 길: html#bl-tab-scroll-off.
export const FADE_Y_SELECTORS = [
    '#rm_print_characters_block',                 // 캐릭터 목록
    '#rm_extensions_block .inline-drawer-content', // 확장 설정 안 접힘 칸 중 넘치는 것
    '.drawer-content',                            // 위 막대 서랍(확장 설정 #rm_extensions_block · 월드인포 #WorldInfo · 사용자 설정 …)
    'dialog.popup .popup-content',                // 팝업 본문 (테마 설정 창 .bl-settings-fullscreen 도 여기서 흐름)
    'dialog.popup .popup-body',
    '#world_popup_entries_list',                  // 월드인포 항목 목록
    '.bl-editor .salty-sec', '.bl-editor-directory-list', '.bl-notice-body',   // 테마 설정 편집 창 · 공지
    '.bl-addon-main', '.bl-addon-config', '.bl-extension-page > .bl-addon-group', // 애드온 창
];
export const FADE_Y_SELECTOR = FADE_Y_SELECTORS.join(', ');
export const SKIP_Y = '#chat, .mes_text, textarea, pre, iframe, [contenteditable=""], [contenteditable="true"], .salty-fonttags, .salty-fontscroll, [data-bl-fade], [data-bl-fade-y="off"]';
export const WORLD_INFO_LIST = '#world_popup_entries_list';
/** 안에서 누른 뒤 다시 훑는 뿌리(새로 보이는 접힘 칸 · 늦게 그려지는 애드온 칸) */
export const RESCAN_ROOTS = '#rm_extensions_block, dialog.popup';
const SETTLE_MS = 450;   // 접기 · 펼치기 애니메이션(실리태번 slideToggle 200ms · 서랍 250ms)이 끝난 뒤

/** 어느 쪽에 더 있나: '' (맞거나 안 보임) · 'top' · 'bottom' · 'both' */
export function fadeStateY(el) {
    if (!el || !el.clientHeight || el.scrollHeight <= el.clientHeight + 1) return '';
    const top = el.scrollTop > 1, bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    return top && bottom ? 'both' : top ? 'top' : bottom ? 'bottom' : '';
}
/** 속성을 쓰고(바뀔 때만) 상태를 돌려줘요. scrollable 이 false 면(overflow hidden) 넘쳐도 떼요. */
export function applyFadeY(el, scrollable = true) {
    const state = scrollable ? fadeStateY(el) : '';
    if (state) { if (el.dataset.blFadeY !== state) el.dataset.blFadeY = state; }
    else if ('blFadeY' in el.dataset) delete el.dataset.blFadeY;
    return state;
}
const scrollableY = (el, style) => { const o = style(el).overflowY; return o === 'auto' || o === 'scroll'; };

const KEY = Symbol.for('blue-lemonade.scroll-fade.v1');
/**
 * 문서에 한 번. resting(feature) 가 true 면 그 칸은 건너뛰어요(지금은 'worldInfo' 만 — 바이바이가 켜져 있을 때).
 * 돌려주는 api: scan(root) · bind(el) · unbind(el) · refreshResting() · size()
 */
export function installScrollFade(doc = globalThis.document, { resting = () => false, style = el => el.ownerDocument.defaultView.getComputedStyle(el) } = {}) {
    if (!doc?.documentElement) return null;
    if (doc[KEY]) return doc[KEY];
    const win = doc.defaultView;
    const states = new Map(), roots = new Map(), pending = new Map();
    let frame = 0;
    const flush = () => {
        frame = 0;
        for (const [el, recheck] of pending) {
            const state = states.get(el);
            if (!state || !el.isConnected) continue;
            if (recheck) state.scrollable = scrollableY(el, style);
            applyFadeY(el, state.scrollable);
        }
        pending.clear();
    };
    // recheck: overflow 가 바뀌었을 수 있는 변화(열림 · 크기 · 자식) 때만 getComputedStyle — 스크롤마다는 안 해요
    const schedule = (el, recheck = false) => {
        pending.set(el, recheck || pending.get(el) || false);
        if (!frame) frame = win.requestAnimationFrame(flush);
    };
    const resize = typeof win.ResizeObserver === 'function' ? new win.ResizeObserver(entries => { for (const e of entries) schedule(e.target, true); }) : null;
    const skip = el => !!el.closest?.(SKIP_Y) || (el.matches(WORLD_INFO_LIST) && !!resting('worldInfo'));
    function bind(el) {
        if (!el || el.nodeType !== 1 || states.has(el) || skip(el)) return false;
        const controller = new win.AbortController(), signal = controller.signal;
        el.addEventListener('scroll', () => schedule(el), { signal, passive: true });
        // 안의 내용이 바뀌어도 칸 크기는 안 변해요(ResizeObserver 는 칸만 봄) — 바로 아래 자식 변화와 안에서 누른 뒤(접기 · 펼치기가 끝난 뒤)를 봐요
        const observer = new win.MutationObserver(() => schedule(el, true));
        observer.observe(el, { childList: true });
        let settle = 0;
        // capture: 설정 창(panel.js)처럼 안쪽 처리기가 전파를 멈추는 곳에서도 받아요
        el.addEventListener('click', () => { schedule(el, true); clearTimeout(settle); settle = setTimeout(() => schedule(el, true), SETTLE_MS); }, { signal, passive: true, capture: true });
        resize?.observe(el);
        states.set(el, { controller, observer, scrollable: true });
        schedule(el, true);
        return true;
    }
    function unbind(el) {
        const state = states.get(el); if (!state) return;
        state.controller.abort(); state.observer.disconnect(); resize?.unobserve(el);
        states.delete(el); pending.delete(el);
        if ('blFadeY' in el.dataset) delete el.dataset.blFadeY;
    }
    function hookRoot(root) {
        if (roots.has(root)) return;
        const controller = new win.AbortController();
        let timer = 0;
        // capture: 테마 설정 창은 페이지를 바꿀 때 스크롤 칸(.salty-sec)을 새로 만들고 클릭 전파를 멈춰요 — bubbling 으로는 한 번도 못 받았어요(리그 확인 10-29)
        root.addEventListener('click', () => { clearTimeout(timer); timer = setTimeout(() => { if (root.isConnected) scan(root); }, SETTLE_MS); }, { signal: controller.signal, passive: true, capture: true });
        // (10-30) 창(dialog.popup)은 닫혀 떨어지면 바로 놓아요 — 예전엔 다음 팝업이 뜰 때(scan → cleanup)까지 닫힌 창의 뿌리 · 칸을 붙잡아,
        //   테마 설정 창이면 떨어진 창 DOM 전체가 몇 시간이고 남았어요. 실리태번은 close 뒤 onClose 를 기다렸다 떼므로 떨어질 때까지 몇 번 더 봐요
        if (root.localName === 'dialog') {
            let tries = 0;
            const sweep = () => { if (root.isConnected) { if (!root.open && tries++ < 8) setTimeout(sweep, 250); return; } cleanup(); };
            root.addEventListener('close', () => { tries = 0; setTimeout(sweep, 0); }, { signal: controller.signal });
        }
        roots.set(root, controller);
    }
    const cleanup = () => {
        for (const el of states.keys()) if (!el.isConnected) unbind(el);
        for (const [root, controller] of roots) if (!root.isConnected) { controller.abort(); roots.delete(root); }
    };
    /** root(문서 · 서랍 · 팝업)안의 대상 칸을 묶어요 — 돌려주는 값은 새로 묶은 수 */
    function scan(root = doc) {
        if (!root?.querySelectorAll) return 0;
        let n = 0;
        if (root.nodeType === 1) {
            if (root.matches(FADE_Y_SELECTOR) && bind(root)) n++;
            if (root.matches(RESCAN_ROOTS)) hookRoot(root);
        }
        for (const el of root.querySelectorAll(FADE_Y_SELECTOR)) if (bind(el)) n++;
        if (root.nodeType !== 1) for (const r of root.querySelectorAll(RESCAN_ROOTS)) hookRoot(r);
        cleanup();
        return n;
    }
    /** 다른 확장이 켜지거나 꺼졌을 때: 쉬어야 하는 칸은 떼고, 아니면 다시 묶어요 */
    function refreshResting() {
        for (const el of doc.querySelectorAll(WORLD_INFO_LIST)) { if (resting('worldInfo')) unbind(el); else bind(el); }
    }
    const api = { scan, bind, unbind, refreshResting, size: () => states.size, has: el => states.has(el) };
    doc[KEY] = api;
    scan(doc);
    return api;
}

/**
 * 바이바이 설치 감지: src/ext-presence.js(경량화 작업에서 같은 이름으로 만들어요 — presence() · onPresenceChange · startPresence)가 있으면 그것을,
 * 없으면 실리태번 extensionNames · disabledExtensions 를 직접 읽는 작은 대체를 써요. 돌려주는 값: { baibai(): boolean, onChange(fn) }
 */
export async function baibaiPresence() {
    try {
        const m = await import('./ext-presence.js');
        m.startPresence?.();
        return { baibai: () => !!m.presence?.().baibai, onChange: fn => m.onPresenceChange?.(() => fn()) };
    } catch { /* 모듈 없음 — 아래 대체 */ }
    let found = false;
    try {
        const { extensionNames, extension_settings } = await import('../../../../extensions.js');
        const off = new Set(extension_settings?.disabledExtensions || []);
        found = (extensionNames || []).some(name => typeof name === 'string' && !off.has(name) && /^third-party\/st-baibai-tools(?:[-_.]|$)/i.test(name));
    } catch { /* 실리태번 모듈을 못 읽으면 없는 것으로 */ }
    return { baibai: () => found, onChange: () => {} };
}
