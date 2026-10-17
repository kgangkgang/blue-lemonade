// 다시 쓰기 ↶ 되돌리기 (7.0.1): 고치기 전 본문 · 스와이프를 메모리에 채팅마다 마지막 하나만 둔다 (채팅 파일에는 남기지 않는다 — 고른 글 지우기와 같은 규칙).
//   remember(rec) → rec   rec = { chatId, messageId, message, before, after, beforeSwipe, swipeId, tokenBefore }
//   check(rec, { chatId, chat }) → 'ok' | 'gone'(더 최근 고침 · 이미 되돌림) | 'chat'(채팅을 바꿈) | 'changed'(그 사이 메시지 · 스와이프가 바뀜)
//   restore(rec) → 메시지 글 · 스와이프 사본 · 토큰 수를 고치기 전으로 (부르는 쪽이 check 뒤에)
//   7.0.2 check(rec, { …, rebase }) — 고친 뒤 같은 MESSAGE_RECEIVED 의 뒤 리스너(캐릭터 에셋 그림 자리 넣기 · 실리태번 추론 자동 분리)가
//         보이는 글은 그대로 두고 mes 를 바꾸면 늘 'changed' 로 거절됐다. rebase(after, now, before) 가 지금 글 기준의 「고치기 전 글」을 만들어 주면
//         기록을 지금 글에 맞춰 고치고 'ok' (못 만들면 예전처럼 'changed')
export function createRewriteUndo() {
    const last = new Map();   // chatId → rec
    return {
        remember(rec) { last.set(rec.chatId, rec); return rec; },
        peek(chatId) { return last.get(chatId) ?? null; },
        get size() { return last.size; },
        check(rec, { chatId, chat, rebase = null } = {}) {
            if (!rec || last.get(rec.chatId) !== rec) return 'gone';
            if (chatId !== rec.chatId) return 'chat';
            const now = Array.isArray(chat) ? chat[rec.messageId] : null;
            if (now !== rec.message || (now.swipe_id ?? 0) !== rec.swipeId) return 'changed';
            if (now.mes !== rec.after) {
                const before = typeof rebase === 'function' && typeof now.mes === 'string' ? rebase(rec.after, now.mes, rec.before) : null;
                if (typeof before !== 'string') return 'changed';
                if (rec.beforeSwipe === rec.before) rec.beforeSwipe = before;
                rec.before = before; rec.after = now.mes;
            }
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
