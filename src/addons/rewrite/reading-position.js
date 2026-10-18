import { observeEventCompletion } from '../translator/render-completion.js';
import { keepChatReadingPosition } from '../../chat-reading-position.js';

const installed = new WeakMap();
const chatKey = ctx => [ctx?.characterId, ctx?.groupId, ctx?.getCurrentChatId?.() ?? ctx?.chatId].join(':');

// Non-streamed replies are inserted by the host after ALL message listeners
// finish. Starting a settling window inside the first listener is too early.
export function watchRewriteReadingPosition({ getContext, document: doc, keep = keepChatReadingPosition }) {
    const ctx = getContext(), source = ctx.eventSource;
    const type = (ctx.eventTypes ?? ctx.event_types)?.MESSAGE_RECEIVED;
    if (!source || !type) return () => {};
    installed.get(source)?.();
    const stop = observeEventCompletion(source, (event, id) => {
        if (event !== type) return;
        const before = getContext(), message = before.chat?.[id], key = chatKey(before);
        if (!message) return;
        const text = message.mes, swipe = message.swipe_id;
        return success => {
            const now = getContext();
            if (!success || key !== chatKey(now) || now.chat?.[id] !== message || message.swipe_id !== swipe || message.mes === text) return;
            keep(doc.getElementById('chat'), () => {});
        };
    });
    const dispose = () => { stop(); if (installed.get(source) === dispose) installed.delete(source); };
    installed.set(source, dispose);
    return dispose;
}
