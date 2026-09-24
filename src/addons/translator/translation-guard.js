// A snapshot remains invalid after leaving and returning to the same chat/swipe.
export function createGuards(getContext) {
    let epoch = 0;
    const revisions = new WeakMap();
    const key = () => {
        const c = getContext();
        return JSON.stringify([c.groupId ?? null, c.characterId ?? null, c.getCurrentChatId?.() ?? c.chatId ?? null]);
    };
    const cancelled = () => Object.assign(new Error('채팅이나 글이 바뀌어 번역을 멈췄어요. 현재 글은 그대로 유지했어요.'), { cancelled: true });
    function capture(message = null) {
        const stamp = epoch, chat = key(), revision = message ? revisions.get(message) : null;
        const source = message?.mes, swipe = message?.swipe_id;
        let display = message?.extra?.display_text;
        return {
            valid() {
                return stamp === epoch && chat === key() && (!message ||
                    (getContext().chat?.includes(message) && revisions.get(message) === revision &&
                    message.mes === source && message.swipe_id === swipe && message.extra?.display_text === display));
            },
            assert() { if (!this.valid()) throw cancelled(); },
            index() { return this.valid() ? getContext().chat.indexOf(message) : -1; },
            acceptDisplay() { display = message?.extra?.display_text; },
        };
    }
    return { capture, cancelled, chatChanged() { epoch++; }, messageChanged(id) {
        const message = getContext().chat?.[Number(id)];
        if (message) revisions.set(message, (revisions.get(message) || 0) + 1);
    } };
}

export function watchGuard(assertValid, interval = 100) {
    const controller = new AbortController();
    const check = () => {
        if (controller.signal.aborted) throw controller.signal.reason;
        try { assertValid(); } catch (error) { controller.abort(error); throw error; }
    };
    check();
    const timer = setInterval(() => { try { check(); } catch { /* request receives the reason */ } }, interval);
    return { signal: controller.signal, check, close() { clearInterval(timer); } };
}
