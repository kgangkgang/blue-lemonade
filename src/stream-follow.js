// A scroll event can arrive after the next streamed paragraph has grown. The host then
// mistakes the new bottom gap for an upward gesture and locks automatic scrolling.
// Repair only this race, before the host's scroll listener sees the delayed event.
import { getSettings } from './settings.js';
import { themeEnabled } from './usage-mode.js';

let started = false;

export function startStreamFollow() {
    if (started) return;
    const chat = document.getElementById('chat');
    const ctx = SillyTavern.getContext();
    const types = ctx.eventTypes || ctx.event_types;
    if (!chat || !ctx.eventSource || !types) return;
    started = true;

    let streaming = false, generationChat = null;
    // 5.8.4: 처음 값은 한가할 때 읽는다 — 시작하자마자 읽으면 부팅 중 배치를 그 자리에서 강제로 셌다 (폰 리그 4배 50~75 ms).
    // 이 값은 스트리밍 중의 늦은 scroll 을 가릴 때만 쓰이고, 그 전에 보내기(GENERATION_STARTED) · scroll 이 늘 새로 읽는다 — 그쪽이 먼저 읽었으면 건너뜀
    let lastTop = 0, lastHeight = 0, lastViewport = 0, pinned = false, seeded = false;
    let held = false, userUntil = 0;
    const key = () => {
        const current = SillyTavern.getContext();
        return `${current.characterId}:${current.groupId}:${current.getCurrentChatId?.()}`;
    };
    const remember = () => {
        seeded = true;
        lastTop = chat.scrollTop;
        lastHeight = chat.scrollHeight;
        lastViewport = chat.clientHeight;
        pinned = Math.abs(lastHeight - lastViewport - lastTop) < 5;
    };
    // 5.8.4: 보내기 직후(GENERATION_STARTED) 바로 읽으면 방금 붙은 내 메시지 때문에 스타일 · 배치를 그 자리에서 강제로 셈
    // (폰 리그 4배 160~234 ms, 요청이 그만큼 늦게 나감) → 다음 프레임에 읽는다 (그 프레임이 어차피 하는 배치에 얹힘)
    const nextFrame = typeof requestAnimationFrame === 'function' ? fn => requestAnimationFrame(fn) : fn => fn();
    const whenIdle = typeof requestIdleCallback === 'function' ? fn => requestIdleCallback(fn, { timeout: 3000 })
        : typeof setTimeout === 'function' ? fn => setTimeout(fn, 1000) : fn => fn();
    whenIdle(() => { if (!seeded) remember(); });
    const hold = (ms) => { userUntil = Math.max(userUntil, performance.now() + ms); };
    const passiveCapture = { capture: true, passive: true };
    chat.addEventListener('touchstart', () => { held = true; hold(1500); }, passiveCapture);
    chat.addEventListener('touchmove', () => hold(1500), passiveCapture);
    const release = () => { if (held) { held = false; hold(1500); } };
    window.addEventListener('touchend', release, passiveCapture);
    window.addEventListener('touchcancel', release, passiveCapture);
    chat.addEventListener('pointerdown', () => { held = true; }, passiveCapture);
    window.addEventListener('pointerup', release, passiveCapture);
    window.addEventListener('pointercancel', release, passiveCapture);
    window.addEventListener('blur', release);
    chat.addEventListener('wheel', () => hold(800), passiveCapture);
    document.addEventListener('keydown', event => {
        if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End| )$/.test(event.key)
            && !event.target?.closest?.('textarea, input, select, [contenteditable]')) hold(800);
    }, passiveCapture);

    const on = (name, fn) => { if (types[name]) ctx.eventSource.on(types[name], fn); };
    const stop = () => { streaming = false; generationChat = null; };
    on('GENERATION_STARTED', (type, options, dryRun) => {
        if (dryRun || type === 'quiet' || type === 'impersonate') return;
        stop();
        generationChat = key();
        nextFrame(remember);
    });
    on('STREAM_TOKEN_RECEIVED', () => {
        // 5.8.4: 한 번 켜지면 끝(stop)까지 그대로라 조각마다 getContext() 를 다시 부르지 않는다 (답 하나에 75~92 ms)
        if (!streaming && generationChat !== null && generationChat === key()) streaming = true;
    });
    on('GENERATION_ENDED', stop);
    on('GENERATION_STOPPED', stop);
    on('CHAT_CHANGED', stop);

    document.addEventListener('scroll', event => {
        if (event.target !== chat) return;
        const top = chat.scrollTop, height = chat.scrollHeight, viewport = chat.clientHeight;
        const gap = height - viewport - top;
        if (streaming && pinned && gap >= 5 && height > lastHeight && viewport === lastViewport
            && top >= lastTop - 1 && !held && performance.now() >= userUntil
            && generationChat === key() && themeEnabled(getSettings())) {
            const power = SillyTavern.getContext().powerUserSettings;
            if (power?.auto_scroll_chat_to_bottom && !power.waifuMode) chat.scrollTop = height;
        }
        // Upward moves, viewport changes, bookmarks, and gestures lose the pin normally.
        // Following resumes only after a later scroll actually reaches the bottom.
        remember();
    }, passiveCapture);
}
