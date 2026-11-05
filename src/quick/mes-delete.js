// 연필 옆 지우기 단추 (1.0.3, 기본 켬) — 메시지 이름 줄의 연필(편집) 바로 앞에 휴지통 하나. 폰에서 연필 → 휴지통 두 번 누르던 것을 한 번으로.
// 지우기는 실리태번 자신의 deleteMessage 에 맡기고 늘 실리태번 확인 창을 거쳐요(「이 메시지를 지울까요?」 — 다른 답이 여럿인 마지막 AI 메시지면
//   편집 중 휴지통처럼 「스와이프만 / 메시지 전체」를 골라요). 답을 만드는 중에는 지우지 않아요.
// 단추는 실리태번 메시지 틀(#message_template)에 한 번 넣어 두면 새로 그리는 메시지마다 따라와요 — 메시지마다 감시하지 않아요.
//   켤 때 이미 그려진 메시지에 한 번 붙이고, 끄면 틀 · 채팅에서 모두 떼요. 누름은 #chat 에 리스너 하나.
// 한 손 버튼 줄의 「마지막 메시지 지우기」도 여기 deleteWithAsk 를 써요(누를 때 받음).
import { ctx, generating } from './shared.js';

const CLS = 'bl_mes_del';
let wanted = false, chatEl = null;

function makeButton() {
    const button = document.createElement('div');
    button.className = `mes_button ${CLS} fa-solid fa-trash-can`;
    button.title = '메시지 지우기';
    button.setAttribute('aria-label', '메시지 지우기');
    button.setAttribute('role', 'button');
    return button;
}
/** 메시지 단추 줄 하나에 (연필 바로 앞) — 이미 있으면 그대로 */
function addTo(buttons) {
    if (!buttons || buttons.querySelector(`:scope > .${CLS}`)) return;
    const pencil = buttons.querySelector(':scope > .mes_edit');
    const button = makeButton();
    if (pencil) pencil.before(button); else buttons.append(button);
}
function placeAll() {
    addTo(document.querySelector('#message_template .mes_buttons'));
    for (const buttons of document.querySelectorAll('#chat > .mes .mes_buttons')) addTo(buttons);
}
function removeAll() {
    for (const button of document.querySelectorAll(`.${CLS}`)) button.remove();
}

/**
 * 메시지 하나 지우기 — 실리태번 확인 창을 거쳐요. 지우면 true
 * @param {number} id 메시지 번호
 */
export async function deleteWithAsk(id) {
    const c = ctx();
    const message = c.chat?.[id];
    if (!Number.isInteger(id) || id < 0 || !message) return false;
    if (generating()) { toastr.info('답을 만드는 중에는 지울 수 없어요. 멈춘 뒤에 지워 주세요.', '메시지 지우기'); return false; }
    if (typeof c.deleteMessage !== 'function') { toastr.warning('이 실리태번 판에서는 바로 지우기를 쓸 수 없어요. 연필 → 휴지통으로 지워 주세요.', '메시지 지우기'); return false; }
    // 실리태번 편집 중 휴지통과 같은 판단: 다른 답이 여럿인 마지막 AI 메시지면 지금 스와이프만 지울지도 물어요
    const swipeCount = Array.isArray(message.swipes) ? message.swipes.length : 0;
    const swipeOnly = !message.is_user && swipeCount > 1 && id === c.chat.length - 1 && Number.isInteger(message.swipe_id);
    const before = c.chat.length;
    await c.deleteMessage(id, swipeOnly ? message.swipe_id : undefined, true);
    return c.chat.length !== before || (Array.isArray(message.swipes) ? message.swipes.length : 0) < swipeCount;
}

function onClick(event) {
    const button = event.target?.closest?.(`.${CLS}`);
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = Number.parseInt(button.closest('.mes')?.getAttribute('mesid') ?? '', 10);
    deleteWithAsk(id).catch(error => { console.warn('[Blue Lemonade] 메시지 지우기', error); toastr.error(error?.message || '지우지 못했어요', '메시지 지우기'); });
}

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncMesDelete(on) {
    const next = !!on;
    if (next === wanted && (!next || chatEl === document.getElementById('chat'))) return;
    wanted = next;
    chatEl?.removeEventListener('click', onClick);
    chatEl = null;
    if (!wanted) { removeAll(); return; }
    chatEl = document.getElementById('chat');
    chatEl?.addEventListener('click', onClick);
    placeAll();
}
