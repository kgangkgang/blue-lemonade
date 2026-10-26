// 「이전 메시지 더 보기」 저절로 (6.9.8): 채팅 맨 위의 #show_more_messages 단추를 누르지 않아도 눌러 준다.
// 실리태번의 showMoreMessages() 는 단추 클릭 경로(script.js 의 document click '#show_more_messages')로만 부른다 — 처음 그리는 수(chat_truncation) 는 실리태번 그대로.
// 7.6.3: 단추가 화면에 다 들어온 뒤가 아니라, 위로 올리다 단추가 화면 위 가까이(채팅 칸 높이의 3배 안) 오면 미리 부른다. 그리고 불러온 뒤 보던 자리를 지킨다.
//   전(6.9.8~7.6.2)엔 단추가 다 보일 때(맨 위) 눌렀는데, 실리태번은 그때 scrollTop 을 「새로 들어온 높이」로 놓는다 — 보던 메시지(최근 쪽)는 그대로 보이지만
//   맨 위까지 올렸던 사람에겐 방금 본 단추와 옛 메시지가 위로 사라지고 최근 메시지로 「튕긴」 것처럼 보였고, 다시 올리면 또 불러와 또 튕겼다(사용자 제보 10-21).
//   실측(폰 360×800, 154개 채팅): 단추가 화면 밖(위)일 때 끼워 넣으면 브라우저 스크롤 앵커링이 자리를 정확히 지킨다(300~1739px 에서 0px 차이). 단추가 화면 바로 위
//   (≤60px)면 앵커링도 실리태번 보정도 안 걸려 보던 글이 바뀌고, 단추가 다 보이면 실리태번이 scrollTop 을 들어온 높이로 놓는다(원래 자리와 단추 높이만큼 어긋남).
//   → 누르기 전 scrollTop · scrollHeight 를 적어 두고, 누른 뒤 「원래 자리 + 들어온 높이」가 아니면 그 자리로 맞춘다 (앵커링이 이미 맞췄으면 손대지 않는다 — 관성 스크롤을 끊지 않게).
// 채팅이 화면보다 짧아 단추가 계속 미리보기 영역에 있으면 화면이 찰 때까지 이어서 부른다(한 프레임에 한 번).
// 감시는 IntersectionObserver 하나(root #chat · rootMargin 위 300% · threshold 0) · 단추가 있을 때만. 숨은 탭에서는 관찰자가 안 돌아 아무 일도 없다.
// 설정: 채팅 › 화면 「이전 메시지 저절로 불러오기」 (chat.showMoreAuto, 기본 켬) — 끄면 관찰자 · 이벤트를 모두 뗀다.
let on = false, bound = false, io = null, watched = null, resting = false, pending = 0, holdUntil = 0;
const offs = [];
const button = () => document.getElementById('show_more_messages');
const chat = () => document.getElementById('chat');
export const ROOT_MARGIN = '300% 0px 0px 0px';   // 채팅 칸 높이의 3배 위까지 미리 — 빠른 플링(100개 ≈ 15화면)이 맨 위에 닿기 전에 불러오도록

function unwatch() { if (io && watched) io.unobserve(watched); watched = null; }
/** 단추가 있으면 지켜본다 (이미 보고 있으면 다시 걸어 지금 상태를 한 번 더 받는다 — 관찰자는 변화가 있을 때만 알리므로) */
function watch() {
    const b = on ? button() : null;
    if (!b) { unwatch(); return false; }
    if (!io) io = new IntersectionObserver(onSeen, { root: chat(), rootMargin: ROOT_MARGIN, threshold: 0 });
    if (watched === b) io.unobserve(b); else unwatch();
    watched = b; io.observe(b);
    return true;
}
/**
 * 단추를 누르고 보던 자리를 지킨다. 실리태번 showMoreMessages() 는 끼워 넣기 · (단추가 창 안이면) scrollTop 보정까지 동기로 한다(첫 await 는 그 뒤의 emit).
 * 돌려주는 값: { inserted, fixed } — 들어온 높이 · 자리를 손봤는지. 시험용으로 chat 요소를 받을 수 있다.
 */
export function loadKeepingPlace(b, c = chat()) {
    if (!c) { b.click(); return { inserted: 0, fixed: false }; }
    const top = c.scrollTop, height = c.scrollHeight;
    b.click();   // → 실리태번 showMoreMessages()
    const inserted = c.scrollHeight - height;
    if (inserted <= 0) return { inserted, fixed: false };
    const wanted = Math.min(top + inserted, c.scrollHeight - c.clientHeight);
    if (Math.abs(c.scrollTop - wanted) <= 1) return { inserted, fixed: false };   // 브라우저 앵커링이 이미 맞췄다
    c.scrollTop = wanted;
    return { inserted, fixed: true };
}
/** 7.9.9 손으로 단추를 눌러 보여 준 자리를 바로 또 불러 가리지 않게 ms 동안 쉰다 (show-more-tap.js) — 쉰 뒤 단추가 아직 미리보기 영역이면 이어서 부른다 */
export function holdAuto(ms) {
    holdUntil = Math.max(holdUntil, Date.now() + Math.max(0, Number(ms) || 0));
    if (on) { clearTimeout(pending); pending = setTimeout(watch, holdUntil - Date.now() + 20); }
}
function onSeen(entries) {
    if (!on || resting) return;
    if (!entries.some(e => e.target === watched && e.isIntersecting)) return;
    if (Date.now() < holdUntil) return;   // 손으로 눌러 보여 준 자리 — holdAuto 가 쉰 뒤 다시 본다
    const b = button(); if (!b || b !== watched) return;
    resting = true;
    loadKeepingPlace(b);
    // 다음 프레임까지 쉬고 다시 본다 — 단추가 남아 있고 아직 미리보기 영역이면(짧은 채팅) 한 번 더, 사라졌으면 끝. rAF 는 숨은 탭에서 안 돌아 타이머도 함께
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
export const _forTest = { onSeen, state: () => ({ on, watched, resting, holding: Date.now() < holdUntil }) };
