// QR 책장 › 결과를 보관함으로 (1.0.3) — 「보관함으로」 표시한 QR 을 책장에서 누르면, 그 QR 이 만든 다음 AI 답 하나를
//   다른 확장이 연 결과 보관함 창구로 보내고, 받았다고 하면 채팅에서 그 메시지를 실리태번 삭제 함수로 빼요(못 받으면 채팅에 그대로).
//   창구: globalThis[Symbol.for('blue-lemonade.result-keeper.v1')] = { label, keep(entry) → Promise<true | { id }>, available?() → boolean }
//   (DEVELOPERS.md 「결과 보관함 창구」). 창구가 없으면 책장은 이 칸을 숨기고 이 모듈도 받지 않아요.
//   듣기: 누른 뒤 한 번만 CHARACTER_MESSAGE_RENDERED · CHAT_CHANGED 두 개를 걸고, 첫 답 · 채팅 바뀜 · 2분 중 먼저 오는 것에서 떼요.
export const KEEPER = Symbol.for('blue-lemonade.result-keeper.v1');
export const WAIT_MS = 120_000;

/** 지금 쓸 수 있는 보관함 창구(없으면 null) */
export function keeper(target = globalThis) {
    let k = null;
    try { k = target[KEEPER] || null; } catch { return null; }
    if (!k || typeof k.keep !== 'function') return null;
    try { if (typeof k.available === 'function' && !k.available()) return null; } catch { return null; }
    return k;
}
export const keeperLabel = k => (typeof k?.label === 'string' && k.label.trim() ? k.label.trim().slice(0, 30) : '보관함');
/** 「○○으로 · ○○로」 — 받침(ㄹ 받침은 로)에 맞춰요. 한글로 안 끝나면 「(으)로」 */
export function toward(word) {
    const code = String(word).charCodeAt(String(word).length - 1) - 0xAC00;
    if (!(code >= 0 && code < 11172)) return `${word}(으)로`;
    const jong = code % 28;
    return `${word}${jong === 0 || jong === 8 ? '로' : '으로'}`;
}

/** QR 하나를 실행하기 직전에 부르기 — 그 뒤 처음 붙는 AI 답을 보관함으로. { stop } 을 돌려줘요 */
export function watchReply({ ctx, keep, title = '', label = '', waitMs = WAIT_MS, toast = globalThis.toastr } = {}) {
    const es = ctx?.eventSource, T = ctx?.eventTypes || ctx?.event_types;
    if (!es?.on || !T?.CHARACTER_MESSAGE_RENDERED || !keep?.keep) return { stop() {} };
    const start = Array.isArray(ctx.chat) ? ctx.chat.length : 0;
    const chatId = ctx.getCurrentChatId?.() ?? null;
    let done = false, timer = 0;
    const off = (type, fn) => { try { (es.removeListener || es.off)?.call(es, type, fn); } catch { /* 이미 뗌 */ } };
    const stop = () => { if (done) return; done = true; clearTimeout(timer); off(T.CHARACTER_MESSAGE_RENDERED, onReply); off(T.CHAT_CHANGED, stop); };
    async function onReply(mesId) {
        if (done) return;
        const id = Number(mesId);
        const msg = Number.isInteger(id) && id >= start ? ctx.chat?.[id] : null;
        if (!msg || msg.is_user || msg.is_system || !String(msg.mes || '').trim()) return;
        if ((ctx.getCurrentChatId?.() ?? null) !== chatId) { stop(); return; }
        stop();
        let ok = false;
        try {
            const r = await keep.keep({ text: String(msg.mes), title: String(title || label || '').slice(0, 80), source: 'blue-lemonade.qr-shelf', qr: String(label || ''), speaker: String(msg.name || ''), chatId, at: Date.now() });
            ok = r === true || (!!r && typeof r === 'object' && r.ok !== false);
        } catch (error) { console.warn('[Blue Lemonade] QR 책장 보관함', error); }
        const where = keeperLabel(keep);
        if (!ok) { toast?.warning?.(`${where}에 넣지 못했어요. 답은 채팅에 그대로 있어요.`, 'QR 책장'); return; }
        // 받은 메시지만 채팅에서 빼요 — 그사이 채팅이 바뀌었거나 다른 메시지가 그 자리에 오면 그대로 둬요
        const same = (ctx.getCurrentChatId?.() ?? null) === chatId && ctx.chat?.[id] === msg;
        let removed = false;
        try {
            if (same && typeof ctx.deleteMessage === 'function') { await ctx.deleteMessage(id); removed = true; }
            else if (same && id === ctx.chat.length - 1 && typeof ctx.deleteLastMessage === 'function') { await ctx.deleteLastMessage(); await ctx.saveChat?.(); removed = true; }
        } catch (error) { console.warn('[Blue Lemonade] QR 책장 채팅에서 빼기', error); }
        toast?.success?.(removed ? `${where}에 넣고 채팅에서는 뺐어요.` : `${where}에 넣었어요. 채팅 글은 그대로 뒀어요.`, 'QR 책장');
    }
    es.on(T.CHARACTER_MESSAGE_RENDERED, onReply);
    if (T.CHAT_CHANGED) es.on(T.CHAT_CHANGED, stop);
    timer = setTimeout(stop, waitMs);
    return { stop };
}
