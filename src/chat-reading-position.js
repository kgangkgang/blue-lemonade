// Replacing a long message with shorter text can clamp scrollTop to the new bottom.
// Remember the visible paragraph before each paint, not when the model request starts.
const pending = new WeakMap();
const userUntil = new WeakMap();
const gestureTrackers = new WeakMap();
const navigationKey = event => /^(ArrowUp|ArrowDown|PageUp|PageDown|Home|End|Enter| )$/.test(event.key);
const CONTROL = 'button,a,input,select,textarea,label,[role=button],.mes_button,.mes_buttons,.extraMesButtons,.swipe_left,.swipe_right';

// Remember a gesture that starts while the model is still answering, before a
// paint guard exists. Otherwise mobile momentum looks like a renderer scroll.
export function watchChatReadingGestures(doc) {
    if (!doc?.addEventListener) return () => {};
    if (gestureTrackers.has(doc)) return gestureTrackers.get(doc);
    const types = ['wheel', 'touchstart', 'touchmove', 'touchend', 'pointerdown', 'mousedown', 'keydown'];
    const track = event => {
        if (event.type === 'keydown' && (!navigationKey(event) || event.target?.closest?.('input,textarea,select,[contenteditable]'))) return;
        // 7.6.9: a tap on a message control is not a scroll gesture; the paint it triggers keeps the full guard
        if (event.type !== 'wheel' && event.type !== 'touchmove' && event.type !== 'keydown' && event.target?.closest?.(CONTROL)) return;
        const chat = event.target?.closest?.('#chat');
        if (chat) userUntil.set(chat, Date.now() + 1500);
    };
    for (const type of types) doc.addEventListener(type, track, { capture: true, passive: true });
    const stop = () => { for (const type of types) doc.removeEventListener(type, track, true); gestureTrackers.delete(doc); };
    gestureTrackers.set(doc, stop);
    return stop;
}
watchChatReadingGestures(globalThis.document);

/** 7.7.4 ms until the reader's last gesture on this chat (finger, wheel, momentum allowance) has rested; 0 = resting.
 *  Lets a renderer hold back optional repaints while the reader is scrolling by hand. */
export function readerRestsIn(element, now = Date.now()) {
    const chat = element?.closest?.('#chat') ?? element?.ownerDocument?.getElementById?.('chat') ?? globalThis.document?.getElementById?.('chat');
    return chat ? Math.max(0, (userUntil.get(chat) ?? 0) - now) : 0;
}

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
    // 7.7.4 The final repaint can change how many blocks a status card takes (raw code block ->
    // helper frame + its fold button), so the plain ordinal no longer lines up. Paragraphs of the
    // anchor's own tag keep their order; use that before falling back to a message fraction
    // (which cannot see a card above the reader collapsing).
    const tag = anchor && anchor !== mes ? anchor.tagName : null;
    const sameTag = tag ? blocks.filter(block => block.tagName === tag) : [];
    const tagIndex = sameTag.indexOf(anchor);
    const replacement = currentBlocks => {
        if (index >= 0 && currentBlocks.length === blocks.length) return currentBlocks[index];
        if (tagIndex < 0) return null;
        const same = currentBlocks.filter(block => block.tagName === tag);
        return same.length === sameTag.length ? same[tagIndex] : null;
    };
    const mesId = mes?.getAttribute('mesid');
    const message = ctx?.chat?.[mesId];
    const swipe = message?.swipe_id;
    const messageRect = mes?.getBoundingClientRect();
    const messageFraction = messageRect?.height ? (viewportTop - messageRect.top) / messageRect.height : 0;
    // soft (7.7.4): the reader moved (a gesture during this paint, or one just before it). Absolute
    // restoring would fight that scroll, so it stops; but the renderer may still be changing layout
    // (an awaited helper re-render turns a tall raw code block back into a short frame). Until the
    // normal window ends, keep only those layout shifts of the reading paragraph off the screen,
    // like browser scroll anchoring. Before this, the guard let go at the gesture: the one restore
    // made inside the tall transient layout was left in place, and when the block collapsed the
    // browser clamped scrollTop to the bottom (translation done → screen dropped to the end).
    let active = true, soft = false, timer, frame, observer, lastPos = null, lastView = 0;
    const events = ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'mousedown', 'keydown', 'click']; // 7.6.9 mousedown: a native scrollbar drag sends no pointerdown
    function cancel(event) {
        if (event?.type === 'keydown' && !navigationKey(event)) return;
        if (event?.type === 'click' && event.isTrusted === false) return; // 7.6.9 a scripted click is not the reader moving
        if (event) { userUntil.set(chat, Date.now() + 1500); soften(); return; } // includes touch momentum between preview paints
        stop();
    }
    function stop() {
        if (!active) return;
        active = false;
        clearTimeout(timer);
        if (frame !== undefined) win.cancelAnimationFrame?.(frame);
        observer?.disconnect();
        if (!soft) for (const type of events) doc.removeEventListener(type, cancel, true);   // soften() already removed them
        doc.removeEventListener('scroll', onScroll, true);
        if (pending.get(chat) === stop) pending.delete(chat);
    }
    function soften() {
        if (!active || soft) return;
        soft = true;
        for (const type of events) doc.removeEventListener(type, cancel, true);
        if (frame !== undefined) win.cancelAnimationFrame?.(frame);
        const node = current();
        lastPos = node ? layoutTop(node) : null;
        lastView = lastPos === null ? 0 : lastPos - chat.scrollTop;
    }
    function valid() {
        const now = globalThis.SillyTavern?.getContext?.();
        const current = [now?.characterId, now?.groupId, now?.getCurrentChatId?.() ?? now?.chatId].join(':');
        if (!chat.isConnected || chat !== doc.getElementById('chat') || current !== key || (mes && !mes.isConnected)) return false;
        return !(message && (now?.chat?.[mesId] !== message || message.swipe_id !== swipe));
    }
    const layoutTop = node => node.getBoundingClientRect().top - (chat.getBoundingClientRect().top + chat.clientTop) + chat.scrollTop;
    // The node that stands for the reading position now (soft mode). None at the bottom: nothing to hold.
    function current() {
        if (bottom || !anchor) return null;
        const currentMes = doc.querySelector(`#chat .mes[mesid="${mesId}"]`);
        if (currentMes !== mes) return null;
        if (anchor === mes || anchor.isConnected) return anchor;
        const currentBlocks = children(currentMes.querySelector('.mes_text'));
        return replacement(currentBlocks) ?? mes;
    }
    function hold() {
        if (!active) return;
        if (!valid()) { stop(); return; }
        const node = current();
        if (!node) return;
        const pos = layoutTop(node);
        // Only the reader scrolled (no layout change): remember where they put the paragraph.
        if (lastPos === null || Math.abs(pos - lastPos) <= 1) { lastPos = pos; lastView = pos - chat.scrollTop; return; }
        // The paragraph moved in the content. Put it back where the reader last had it on screen;
        // this also undoes a bottom clamp and is a no-op when native anchoring already kept it.
        // A paragraph the reader left below the screen has nothing above it that they can see.
        if (lastView <= chat.clientHeight) {
            const wanted = Math.max(0, Math.min(pos - lastView, chat.scrollHeight - chat.clientHeight));
            if (Math.abs(chat.scrollTop - wanted) > 1) chat.scrollTop = wanted;
        }
        lastPos = pos; lastView = pos - chat.scrollTop;
    }
    const step = () => (soft ? hold() : restore());
    function restore() {
        if (!active || soft) return;
        if (!valid()) { stop(); return; }
        let wanted = top;
        if (follow) wanted = chat.scrollHeight - chat.clientHeight;
        else if (!bottom && anchor) {
            const currentMes = doc.querySelector(`#chat .mes[mesid="${mesId}"]`);
            if (currentMes !== mes) { stop(); return; }
            const currentBlocks = children(currentMes.querySelector('.mes_text'));
            // A surviving node is exact. With the same paragraph count, a replaced
            // node has a stable ordinal; otherwise retain the message-relative position.
            const next = anchor === mes && messageFraction > 0 ? null : anchor.isConnected ? anchor : replacement(currentBlocks);
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
    // A later renderer may scroll without changing any element's dimensions.
    // ResizeObserver and the two layout frames cannot see that case. Only guard
    // this existing bounded settling window; any reader gesture ends absolute
    // restoring first (soft mode then only undoes layout shifts, never the reader's scroll).
    function onScroll(event) {
        if (event.target === chat && active) step();
    }
    for (const type of events) doc.addEventListener(type, cancel, { capture: true, passive: true });
    doc.addEventListener('scroll', onScroll, { capture: true, passive: true });
    pending.set(chat, stop);
    // Watch while an awaited renderer is running too, but a broken renderer must
    // not retain listeners forever. The normal settling window begins on return.
    timer = setTimeout(stop, 10000);
    if (win.ResizeObserver) {
        observer = new win.ResizeObserver(step);
        if (mes) observer.observe(mes);
        const changed = element.closest?.('.mes');
        if (changed && changed !== mes) observer.observe(changed);
    }
    const settle = () => {
        step();
        if (!active) return;
        if (!soft && win.requestAnimationFrame) frame = win.requestAnimationFrame(() => { step(); frame = win.requestAnimationFrame(step); });
        // Media/iframe layout can settle after the render event. Stop at the next
        // paint, navigation, or bounded timeout (a gesture only softens); never hold a reader.
        clearTimeout(timer);
        timer = setTimeout(stop, 1200);
    };
    try {
        const result = draw();
        restore();
        if (cooling) soften(); // keep this paint, leave ongoing momentum alone (layout shifts only, 7.7.4)
        if (result?.then) return Promise.resolve(result).finally(settle);
        settle();
        return result;
    } catch (error) { restore(); stop(); throw error; }
}
