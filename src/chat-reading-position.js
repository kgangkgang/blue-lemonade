// Replacing a long message with shorter text can clamp scrollTop to the new bottom.
// Remember the visible paragraph before each paint, not when the model request starts.
const pending = new WeakMap();
const userUntil = new WeakMap();

export function keepChatReadingPosition(element, draw) {
    const doc = element?.ownerDocument;
    const chat = element?.closest?.('#chat');
    if (!chat || !doc?.defaultView || !chat.clientHeight) return draw();
    pending.get(chat)?.();
    const cooling = Date.now() < (userUntil.get(chat) ?? 0);
    const win = doc.defaultView;
    const ctx = globalThis.SillyTavern?.getContext?.();
    const chatId = ctx?.getCurrentChatId?.() ?? ctx?.chatId;
    const key = [ctx?.characterId, ctx?.groupId, chatId].join(':');
    const top = chat.scrollTop;
    const bottom = chat.scrollHeight - chat.clientHeight - top < 5;
    const follow = bottom && ctx?.powerUserSettings?.auto_scroll_chat_to_bottom !== false && !ctx?.powerUserSettings?.waifuMode;
    const chatRect = chat.getBoundingClientRect();
    const viewportTop = chatRect.top + chat.clientTop;
    const x = chatRect.left + chat.clientWidth / 2, y = viewportTop + 2;
    // Toasts and fixed controls can cover the top pixel while text is still being
    // read underneath. Hit-test through those overlays, without scanning the chat.
    const hit = (doc.elementsFromPoint?.(x, y) ?? [doc.elementFromPoint?.(x, y)]).find(node => node?.closest?.('#chat') === chat);
    const mes = hit?.closest?.('#chat') === chat ? hit.closest('.mes') : null;
    const body = mes?.querySelector('.mes_text');
    const children = node => [...(node?.children ?? [])].filter(child => !child.classList.contains('llmt-progress'));
    const blocks = children(body);
    let anchor = mes ? hit : null;
    while (anchor && anchor.parentElement !== body) anchor = anchor.parentElement;
    anchor ??= mes;
    const rect = anchor?.getBoundingClientRect();
    const offset = rect ? rect.top - viewportTop : 0;
    const index = blocks.indexOf(anchor);
    const mesId = mes?.getAttribute('mesid');
    const message = ctx?.chat?.[mesId];
    const swipe = message?.swipe_id;
    const messageRect = mes?.getBoundingClientRect();
    const messageFraction = messageRect?.height ? (viewportTop - messageRect.top) / messageRect.height : 0;
    let active = true, timer, frame, observer;
    const events = ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'];
    function cancel(event) {
        if (event?.type === 'keydown' && !/^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End| )$/.test(event.key)) return;
        if (event) userUntil.set(chat, Date.now() + 1500); // includes touch momentum between preview paints
        if (!active) return;
        active = false;
        clearTimeout(timer);
        if (frame !== undefined) win.cancelAnimationFrame?.(frame);
        observer?.disconnect();
        for (const type of events) doc.removeEventListener(type, cancel, true);
        if (pending.get(chat) === cancel) pending.delete(chat);
    }
    function restore() {
        if (!active) return;
        const now = globalThis.SillyTavern?.getContext?.();
        const current = [now?.characterId, now?.groupId, now?.getCurrentChatId?.() ?? now?.chatId].join(':');
        if (!chat.isConnected || chat !== doc.getElementById('chat') || current !== key || (mes && !mes.isConnected)) { cancel(); return; }
        if (message && (now?.chat?.[mesId] !== message || message.swipe_id !== swipe)) { cancel(); return; }
        let wanted = top;
        if (follow) wanted = chat.scrollHeight - chat.clientHeight;
        else if (!bottom && anchor) {
            const currentMes = doc.querySelector(`#chat .mes[mesid="${mesId}"]`);
            if (currentMes !== mes) { cancel(); return; }
            const currentBlocks = children(currentMes.querySelector('.mes_text'));
            // A surviving node is exact. With the same paragraph count, a replaced
            // node has a stable ordinal; otherwise retain the message-relative position.
            const next = anchor === mes && messageFraction > 0 ? null : anchor.isConnected ? anchor : index >= 0 && currentBlocks.length === blocks.length ? currentBlocks[index] : null;
            if (next) {
                const nextRect = next.getBoundingClientRect();
                const keptOffset = offset < 0 && rect.height > 0 ? offset * nextRect.height / rect.height : offset;
                wanted = chat.scrollTop + nextRect.top - (chat.getBoundingClientRect().top + chat.clientTop) - keptOffset;
            } else {
                const nextRect = mes.getBoundingClientRect();
                wanted = chat.scrollTop + nextRect.top - (chat.getBoundingClientRect().top + chat.clientTop) + messageFraction * nextRect.height;
            }
        }
        const clamped = Math.max(0, Math.min(wanted, chat.scrollHeight - chat.clientHeight));
        if (Math.abs(chat.scrollTop - clamped) > 1) chat.scrollTop = clamped;
    }
    for (const type of events) doc.addEventListener(type, cancel, { capture: true, passive: true });
    pending.set(chat, cancel);
    // Watch while an awaited renderer is running too, but a broken renderer must
    // not retain listeners forever. The normal settling window begins on return.
    timer = setTimeout(cancel, 10000);
    if (!cooling && win.ResizeObserver) {
        observer = new win.ResizeObserver(restore);
        if (mes) observer.observe(mes);
        const changed = element.closest?.('.mes');
        if (changed && changed !== mes) observer.observe(changed);
    }
    const settle = () => {
        restore();
        if (!active) return;
        if (win.requestAnimationFrame) frame = win.requestAnimationFrame(() => { restore(); frame = win.requestAnimationFrame(restore); });
        // Media/iframe layout can settle after the render event. Stop at the first
        // gesture, next paint, navigation, or bounded timeout; never hold a reader.
        clearTimeout(timer);
        timer = setTimeout(cancel, 1200);
    };
    try {
        const result = draw();
        restore();
        if (cooling) { cancel(); return result; } // keep this paint, leave ongoing momentum alone
        if (result?.then) return Promise.resolve(result).finally(settle);
        settle();
        return result;
    } catch (error) { restore(); cancel(); throw error; }
}
