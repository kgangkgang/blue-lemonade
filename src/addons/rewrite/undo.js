// 다시 쓰기 ↶ 되돌리기 (7.0.1): 고치기 전 본문 · 스와이프를 메모리에 채팅마다 마지막 하나만 둔다 (채팅 파일에는 남기지 않는다 — 고른 글 지우기와 같은 규칙).
//   remember(rec) → rec   rec = { chatId, messageId, message, before, after, beforeSwipe, swipeId, tokenBefore }
//   check(rec, { chatId, chat }) → 'ok' | 'gone'(더 최근 고침 · 이미 되돌림) | 'chat'(채팅을 바꿈) | 'changed'(그 사이 메시지 · 스와이프가 바뀜)
//   restore(rec) → 메시지 글 · 스와이프 사본 · 토큰 수를 고치기 전으로 (부르는 쪽이 check 뒤에)
export function createRewriteUndo() {
    const last = new Map();   // chatId → rec
    return {
        remember(rec) { last.set(rec.chatId, rec); return rec; },
        peek(chatId) { return last.get(chatId) ?? null; },
        get size() { return last.size; },
        check(rec, { chatId, chat } = {}) {
            if (!rec || last.get(rec.chatId) !== rec) return 'gone';
            if (chatId !== rec.chatId) return 'chat';
            const now = Array.isArray(chat) ? chat[rec.messageId] : null;
            if (now !== rec.message || now.mes !== rec.after || (now.swipe_id ?? 0) !== rec.swipeId) return 'changed';
            return 'ok';
        },
        restore(rec) {
            const m = rec.message;
            m.mes = rec.before;
            if (Array.isArray(m.swipes) && rec.beforeSwipe !== undefined) m.swipes[rec.swipeId] = rec.beforeSwipe;
            if (m.extra && typeof m.extra === 'object') {
                if (rec.tokenBefore === undefined) delete m.extra.token_count; else m.extra.token_count = rec.tokenBefore;
            }
            last.delete(rec.chatId);
            return m;
        },
    };
}
