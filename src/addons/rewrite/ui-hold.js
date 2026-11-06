// 답 끝 검사 중에는 전송 상태만 잠그고 조작부만 숨겨요. body 속성과 채팅 본문은 건드리지 않아요.
export const REWRITE_ACTION_SELECTOR = '#send_but, #mes_continue, #mes_impersonate, #chat .last_mes .mes_buttons, #chat .last_mes .mes_reasoning_actions';

/** 겹친 검사도 마지막 소유자가 끝날 때 풀어요. 본체가 이미 잠갔으면 그 상태를 그대로 빌려요. */
export function createRewriteUiHold({ document: doc, getSendLocked, setSendLocked, hideSwipes, showSwipes }) {
    let users = 0, owned = false, restore = [];
    function write(el, name, value) {
        if (!el?.style) return;
        const old = el.style.getPropertyValue(name), priority = el.style.getPropertyPriority(name);
        el.style.setProperty(name, value, 'important');
        restore.push(() => {
            // 검사 중 본체나 다른 확장이 바꾼 값은 덮어쓰지 않아요.
            if (el.style.getPropertyValue(name) !== value || el.style.getPropertyPriority(name) !== 'important') return;
            if (old) el.style.setProperty(name, old, priority);
            else el.style.removeProperty(name);
        });
    }
    function finish() {
        for (const undo of restore.reverse()) undo();
        restore = [];
        if (owned && doc.body?.dataset?.generating !== 'true') {
            setSendLocked(false);
            showSwipes();
        }
        owned = false;
    }
    return () => {
        if (users++ === 0) {
            owned = !getSendLocked() && doc.body?.dataset?.generating !== 'true';
            if (owned) {
                try {
                    // 첫 await 전 내부 전송 차단부터 걸어 검사 중 새 답을 보내는 틈을 없애요.
                    setSendLocked(true);
                    hideSwipes();
                    for (const el of doc.querySelectorAll(REWRITE_ACTION_SELECTOR)) write(el, 'visibility', 'hidden');
                    write(doc.getElementById('mes_stop'), 'display', 'flex');
                } catch (error) {
                    users = 0;
                    finish();
                    throw error;
                }
            }
        }
        let released = false;
        return () => {
            if (released) return;
            released = true;
            if (--users === 0) finish();
        };
    };
}
