// 「이전 메시지 더 보기」 저절로 (6.9.8): 채팅 맨 위의 #show_more_messages 단추가 화면에 다 들어오면 누르지 않아도 눌러 준다.
// 실리태번의 showMoreMessages() 는 단추 클릭 경로(script.js 의 document click '#show_more_messages')로만 부른다 — 처음 그리는 수(chat_truncation) ·
// 스크롤 보정(isButtonInView: 보이던 단추는 새 메시지 높이만큼 위로 밀려나 화면 밖으로)은 실리태번 그대로. 채팅이 화면보다 짧아 단추가 계속 보이면
// 화면이 찰 때까지 이어서 부른다(한 프레임에 한 번).
// 감시는 IntersectionObserver 하나(threshold 1 · root #chat) · 단추가 있을 때만. 숨은 탭에서는 관찰자가 안 돌아 아무 일도 없다(보고 있을 때만 필요한 일).
// 설정: 채팅 › 화면 「이전 메시지 저절로 불러오기」 (chat.showMoreAuto, 기본 켬) — 끄면 관찰자 · 이벤트를 모두 뗀다.
let on = false, bound = false, io = null, watched = null, resting = false, pending = 0;
const offs = [];
const button = () => document.getElementById('show_more_messages');
const chat = () => document.getElementById('chat');

function unwatch() { if (io && watched) io.unobserve(watched); watched = null; }
/** 단추가 있으면 지켜본다 (이미 보고 있으면 다시 걸어 지금 상태를 한 번 더 받는다 — 관찰자는 변화가 있을 때만 알리므로) */
function watch() {
    const b = on ? button() : null;
    if (!b) { unwatch(); return false; }
    if (!io) io = new IntersectionObserver(onSeen, { root: chat(), threshold: 1 });
    if (watched === b) io.unobserve(b); else unwatch();
    watched = b; io.observe(b);
    return true;
}
function onSeen(entries) {
    if (!on || resting) return;
    if (!entries.some(e => e.target === watched && e.isIntersecting && e.intersectionRatio >= 0.99)) return;
    const b = button(); if (!b || b !== watched) return;
    resting = true;
    b.click();   // → 실리태번 showMoreMessages() (isButtonInView 보정 포함)
    // 다음 프레임까지 쉬고 다시 본다 — 단추가 남아 있고 아직 다 보이면(짧은 채팅) 한 번 더, 사라졌으면 끝. rAF 는 숨은 탭에서 안 돌아 타이머도 함께
    let done = false; const rest = () => { if (done) return; done = true; resting = false; watch(); };
    try { requestAnimationFrame(rest); } catch { /* 없는 환경 */ }
    setTimeout(rest, 150);
}
function later() { clearTimeout(pending); pending = setTimeout(() => { if (!watch()) pending = setTimeout(watch, 1200); }, 250); }

export function syncShowMoreAuto(enabled) {
    on = !!enabled;
    if (!on) { unwatch(); io?.disconnect(); io = null; clearTimeout(pending); for (const off of offs.splice(0)) off(); bound = false; return; }
    if (bound) { later(); return; }
    bound = true;
    try {
        const { eventSource, event_types } = SillyTavern.getContext();
        const listen = (name, fn) => { if (event_types[name]) { eventSource.on(event_types[name], fn); offs.push(() => eventSource.removeListener?.(event_types[name], fn)); } };
        listen('CHAT_CHANGED', later);           // 채팅을 열면 실리태번이 단추를 새로 붙인다
        listen('MORE_MESSAGES_LOADED', later);   // 불러온 뒤 단추가 남았는지
    } catch { /* 이벤트를 못 걸면 지금 있는 단추만 */ }
    later();
}

/** 시험용 */
export const _forTest = { onSeen, state: () => ({ on, watched, resting }) };
