// 1.5.1 「이전 메시지 더 보기」 단추 지키기 — 화면의 첫 메시지 번호가 0 보다 큰데 단추가 없거나 메시지 아래에 있으면 맨 위(첫 메시지 바로 앞)로 되돌린다.
// 까닭(11-15 사용자 사진 「이전메시지보기가없잖아」 · 불러올 메시지 수 1): 酒馆助手(JS-Slash-Runner) 최적화 「better_message_to_load」(기본 켬)가
//   새 답이 그려질 때마다 화면 메시지를 「불러올 수」만 남기고 지운 뒤, 지워진 옛 첫 메시지(#0)의 번호를 읽어 「다 보였다」로 여겨 단추를 붙이지 않는다.
//   붙일 때도 #chat 맨 아래(append)에 붙여, 누르면 옛 메시지가 아래에 끼어 들어간다. 그쪽 파일은 고치지 않고 결과만 바로잡는다.
// 실리태번 printMessages 와 같은 꼴(<div id="show_more_messages">Show more messages</div>)로 만들어 본체 클릭 경로 · 한글 치환(ko-ui) · 자동 더 보기가 그대로 쓴다.
// 감시는 한글 치환이 이미 쓰는 #chat 바로 아래 자식 감시자(show-more-watch.js)를 나눠 쓴다(subtree 없음 — 본문 · 스트리밍 글자는 안 본다 · 감시자를 늘리지 않음) · 바뀜을 모아 마이크로태스크 한 번.
import { onChatChildren } from './show-more-watch.js';
const ID = 'show_more_messages';

/**
 * 지금 #chat 을 보고 단추를 바로잡는다. 돌려주는 값: 'added' | 'moved' | 'removed' | 'ok' | 'empty' | 'skip'.
 * chatLength 를 주면 그보다 큰 번호(채팅 배열 밖 — 다른 화면)는 건드리지 않는다.
 */
export function keepShowMore(chat, { doc = globalThis.document, chatLength } = {}) {
    if (!chat || !doc) return 'skip';
    const first = chat.querySelector(':scope > .mes[mesid]');
    if (!first) return 'empty';   // printMessages 가 단추만 먼저 붙인 틈 · 빈 채팅
    const id = Number(first.getAttribute('mesid'));
    if (!Number.isInteger(id) || id < 0) return 'skip';
    if (Number.isInteger(chatLength) && id >= chatLength) return 'skip';
    const button = doc.getElementById(ID);
    if (id === 0) {   // 맨 처음까지 다 보인다 — 본체 showMoreMessages 처럼 단추를 뗀다
        if (button && button.parentElement === chat) { button.remove(); return 'removed'; }
        return 'ok';
    }
    if (!button) {
        const b = doc.createElement('div');
        b.id = ID; b.textContent = 'Show more messages';
        chat.insertBefore(b, first);
        return 'added';
    }
    if (button.parentElement === chat && button.nextElementSibling === first) return 'ok';
    // 다른 곳(메시지 아래 · 사이)에 있으면 첫 메시지 바로 앞으로 — 본체는 단추 「뒤」에 옛 메시지를 끼워 넣는다
    if (button.parentElement === chat) { chat.insertBefore(button, first); return 'moved'; }
    return 'skip';   // #chat 밖의 같은 id(미리보기 등)는 건드리지 않는다
}

let off = null, watched = null, queued = false;
const chatLength = () => { try { const c = globalThis.SillyTavern?.getContext?.(); return Array.isArray(c?.chat) ? c.chat.length : undefined; } catch { return undefined; } };
function run() {
    queued = false;
    if (!watched?.isConnected) return;
    try { keepShowMore(watched, { chatLength: chatLength() }); } catch (error) { console.warn('[Blue Lemonade] show-more-keep', error); }
}
function schedule() { if (queued) return; queued = true; queueMicrotask(run); }

/** 켠다 — 시험용 chat 요소를 받을 수 있다. 돌려주는 함수로 뗀다 */
export function installShowMoreKeep(chat = globalThis.document?.getElementById?.('chat')) {
    if (!chat) return uninstallShowMoreKeep;
    if (watched === chat && off) return uninstallShowMoreKeep;
    off?.();
    watched = chat;
    off = onChatChildren(schedule, chat);
    schedule();
    return uninstallShowMoreKeep;
}
export function uninstallShowMoreKeep() {
    if (!off) return false;
    off(); off = null; watched = null; queued = false;
    return true;
}
