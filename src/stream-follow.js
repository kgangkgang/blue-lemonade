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
    let lastTop = chat.scrollTop, lastHeight = chat.scrollHeight, lastViewport = chat.clientHeight;
    let pinned = Math.abs(lastHeight - lastViewport - lastTop) < 5;
    let held = false, userUntil = 0;
    const key = () => {
        const current = SillyTavern.getContext();
        return `${current.characterId}:${current.groupId}:${current.getCurrentChatId?.()}`;
    };
    const remember = () => {
        lastTop = chat.scrollTop;
        lastHeight = chat.scrollHeight;
        lastViewport = chat.clientHeight;
        pinned = Math.abs(lastHeight - lastViewport - lastTop) < 5;
    };
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
        remember();
    });
    on('STREAM_TOKEN_RECEIVED', () => {
        if (generationChat !== null && generationChat === key()) streaming = true;
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
