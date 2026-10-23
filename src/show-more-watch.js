// 7.7.9 채팅 맨 위 「이전 메시지 더 보기」 단추(#show_more_messages)가 (다시) 생길 때 알리는 감시자 하나 — #chat 의 바로 아래 자식만 본다(subtree 없음,
// 메시지 본문 변화는 보지 않으므로 긴 채팅에서도 값싸다). 실리태번 printMessages 는 i18n 없이 단추를 만들고, 채팅 열기 · 더 보기 · 번역 뒤 다시 그리기마다
// 새로 만든다 → ko-ui 의 한글 치환이 이벤트 한 번에 기대면 영어로 돌아왔다(사용자 사진: 번역 9/62 진행 중 「Show more messages」).
// 같은 감시자를 여러 곳(ko-ui 치환 · show-more-auto 관찰)이 나눠 쓴다 — 부르는 쪽마다 콜백 하나.
const callbacks = new Set();
let observer = null, watchedChat = null;

function notify() { for (const cb of callbacks) { try { cb(); } catch (error) { console.error('[Blue Lemonade] show-more-watch', error); } } }

function attach(chat) {
    if (!chat || watchedChat === chat || typeof MutationObserver !== 'function') return;
    observer?.disconnect();
    watchedChat = chat;
    observer = new MutationObserver(records => {
        for (const r of records) for (const node of r.addedNodes) {
            if (node instanceof Element && (node.id === 'show_more_messages' || node.querySelector?.('#show_more_messages'))) { notify(); return; }
        }
    });
    observer.observe(chat, { childList: true });
}

/** 단추가 (다시) 붙을 때마다 fix 를 부른다. 지금 있으면 바로 한 번. 돌려주는 함수로 뗀다. 시험용 chat 요소를 받을 수 있다. */
export function onShowMoreButton(fix, chat = document.getElementById('chat')) {
    callbacks.add(fix);
    attach(chat);
    if (chat?.querySelector?.('#show_more_messages')) { try { fix(); } catch { /* 위 notify 와 같은 보호 */ } }
    return () => { callbacks.delete(fix); if (!callbacks.size) { observer?.disconnect(); observer = null; watchedChat = null; } };
}
