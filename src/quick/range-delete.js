// 메시지 범위 지우기 (1.0.3, 기본 켬) — 실리태번 옵션 메뉴(☰)의 「메시지 삭제」 바로 아래 「범위 지우기」.
// 실리태번 기본 「메시지 삭제」는 누른 메시지부터 끝까지라 중간 몇 개(OOC · 실패한 답)만 지우기 어려웠어요.
// 고르는 방법: 처음 메시지 → 끝 메시지를 차례로 누르면 그 사이(양 끝 포함)가 실리태번 삭제 모드와 같은 모양(.mes.selected)으로 칠해져요.
//   세 번째로 누르면 처음부터 다시 골라요. 하나만 고르고 지우면 그 메시지 하나예요.
// 입력줄 자리에 실리태번 삭제 줄과 같은 꼴의 「지우기 · 취소」 줄이 떠요(입력줄은 그동안 숨김). Esc · 채팅 바꿈 · 취소로 그냥 나와요.
// 지우기 전에 늘 확인 창(몇 번부터 몇 번 · 몇 개 · 되돌릴 수 없음)을 거치고, 실리태번 deleteMessage 로 끝에서부터 하나씩 지워요(번호 다시 매기기 · 저장 · 알림은 실리태번 몫).
// 비용: 켜 두면 메뉴 항목 하나 · 그 항목 누름 리스너 하나. 고르는 동안에만 #chat 누름 · Esc · 채팅 바뀜을 들어요.
import { ctx, generating, ensureQuickCss } from './shared.js';
import { ask } from '../ask.js';

const ITEM_ID = 'option_bl_range_delete';
const BAR_ID = 'bl-range-del';
const PICK = 'bl-rd-pick';
let wanted = false, item = null, mode = null;   // mode = { start, end, bar, form, display, chatId, off }

/** 고른 두 끝 → [작은 번호, 큰 번호] (끝을 아직 안 골랐으면 처음 하나) */
export function rangeOf(start, end) {
    if (!Number.isInteger(start)) return null;
    const to = Number.isInteger(end) ? end : start;
    return [Math.min(start, to), Math.max(start, to)];
}
/** 다음 고르기: 처음 → 끝 → (세 번째) 새 처음 */
export function nextPick(state, id) {
    if (!Number.isInteger(state.start) || Number.isInteger(state.end)) return { start: id, end: null };
    return { start: state.start, end: id };
}
export function rangeLabel(range) {
    if (!range) return '지울 처음 메시지를 눌러요';
    const [lo, hi] = range, n = hi - lo + 1;
    return lo === hi ? `#${lo} 하나 · 끝 메시지도 누를 수 있어요` : `#${lo} ~ #${hi} · ${n}개`;
}

function ensureItem() {
    if (item?.isConnected) return;
    const anchor = document.getElementById('option_delete_mes');
    if (!anchor) return;
    item = document.createElement('a');
    item.id = ITEM_ID;
    item.innerHTML = '<i class="fa-lg fa-solid fa-eraser" aria-hidden="true"></i><span>범위 지우기</span>';
    item.title = '처음 · 끝 메시지를 골라 그 사이만 지워요';
    item.addEventListener('click', onItem);
    anchor.after(item);
}
function removeItem() {
    item?.removeEventListener('click', onItem);
    item?.remove();
    item = null;
}

function onItem(event) {
    event.preventDefault();
    event.stopPropagation();
    // 실리태번 메뉴 닫기: 메뉴 단추를 한 번 더 누른 것처럼(메뉴가 열렸다는 표시까지 같이 닫혀요)
    if (document.getElementById('options')?.style.display !== 'none') document.getElementById('options_button')?.click();
    enter();
}

function paint() {
    const range = rangeOf(mode.start, mode.end);
    const chat = document.getElementById('chat');
    for (const mes of chat?.querySelectorAll(`.mes.${PICK}`) || []) mes.classList.remove(PICK, 'selected');
    if (range) {
        for (const mes of chat?.children || []) {
            if (!mes.classList.contains('mes')) continue;
            const id = Number.parseInt(mes.getAttribute('mesid') ?? '', 10);
            if (id >= range[0] && id <= range[1] && !mes.classList.contains('selected')) mes.classList.add(PICK, 'selected');
        }
    }
    mode.bar.querySelector('.bl-rd-note').textContent = rangeLabel(range);
    const ok = mode.bar.querySelector('.bl-rd-ok');
    ok.classList.toggle('disabled', !range);
    ok.setAttribute('aria-disabled', String(!range));
}

function enter() {
    if (mode) return;
    const c = ctx();
    if (!Array.isArray(c.chat) || !c.chat.length) { toastr.info('지울 메시지가 없어요.', '범위 지우기'); return; }
    if (generating()) { toastr.info('답을 만드는 중에는 지울 수 없어요.', '범위 지우기'); return; }
    if (typeof c.deleteMessage !== 'function') { toastr.warning('이 실리태번 판에서는 범위 지우기를 쓸 수 없어요.', '범위 지우기'); return; }
    const form = document.getElementById('send_form');
    const host = document.getElementById('form_sheld');
    if (!host) return;
    ensureQuickCss();
    const bar = document.createElement('div');
    bar.id = BAR_ID;
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', '범위 지우기');
    bar.innerHTML = '<span class="bl-rd-note" role="status" aria-live="polite"></span><span class="bl-rd-actions"><div class="menu_button bl-rd-ok" role="button" tabindex="0">지우기</div><div class="menu_button bl-rd-cancel" role="button" tabindex="0">취소</div></span>';
    if (form?.parentElement === host) form.before(bar); else host.append(bar);
    const display = form?.style.display ?? '';
    if (form) form.style.display = 'none';
    document.body.classList.add('bl-range-picking');
    const chat = document.getElementById('chat');
    const onPick = (event) => {
        const mes = event.target?.closest?.('#chat > .mes');
        if (!mes) return;
        event.preventDefault();
        event.stopPropagation();
        const id = Number.parseInt(mes.getAttribute('mesid') ?? '', 10);
        if (!Number.isInteger(id)) return;
        Object.assign(mode, nextPick(mode, id));
        paint();
    };
    const onBar = (event) => {
        const button = event.target?.closest?.('.bl-rd-ok, .bl-rd-cancel');
        if (!button) return;
        if (button.classList.contains('bl-rd-cancel')) { leave(); return; }
        confirmDelete();
    };
    const onKey = (event) => {
        if (event.key === 'Escape') { event.preventDefault(); leave(); return; }
        if ((event.key === 'Enter' || event.key === ' ') && event.target?.closest?.(`#${BAR_ID} [role="button"]`)) { event.preventDefault(); event.target.click(); }
    };
    const types = c.eventTypes ?? c.event_types;
    const onChat = () => leave();
    chat?.addEventListener('click', onPick, true);
    bar.addEventListener('click', onBar);
    document.addEventListener('keydown', onKey, true);
    if (types?.CHAT_CHANGED) c.eventSource.on(types.CHAT_CHANGED, onChat);
    mode = {
        start: null, end: null, bar, form, display, chatId: c.getCurrentChatId?.() ?? c.chatId,
        off: () => {
            chat?.removeEventListener('click', onPick, true);
            bar.removeEventListener('click', onBar);
            document.removeEventListener('keydown', onKey, true);
            if (types?.CHAT_CHANGED) c.eventSource.removeListener(types.CHAT_CHANGED, onChat);
        },
    };
    paint();
}

function leave() {
    if (!mode) return;
    const { bar, form, display, off } = mode;
    off();
    for (const mes of document.querySelectorAll(`#chat .mes.${PICK}`)) mes.classList.remove(PICK, 'selected');
    bar.remove();
    if (form) form.style.display = display;
    document.body.classList.remove('bl-range-picking');
    mode = null;
}

async function confirmDelete() {
    if (!mode) return;
    const range = rangeOf(mode.start, mode.end);
    if (!range) return;
    const [lo, hi] = range, n = hi - lo + 1, chatId = mode.chatId;
    const sure = await ask(`${lo === hi ? `#${lo} 메시지 하나를` : `#${lo} ~ #${hi} 메시지 ${n}개를`} 지울까요?\n지운 메시지는 되돌릴 수 없어요.`, { ok: '지우기', cancel: '취소', danger: true, title: '범위 지우기' });
    if (!sure || !mode) return;
    leave();
    const c = ctx();
    if ((c.getCurrentChatId?.() ?? c.chatId) !== chatId) { toastr.warning('그사이 채팅이 바뀌어 지우지 않았어요.', '범위 지우기'); return; }
    if (generating()) { toastr.info('답을 만드는 중이라 지우지 않았어요.', '범위 지우기'); return; }
    if (hi >= (c.chat?.length ?? 0)) { toastr.warning('그사이 메시지가 줄어 지우지 않았어요. 다시 골라 주세요.', '범위 지우기'); return; }
    // 끝에서부터 — 앞 번호가 그대로라 하나씩 지워도 범위가 어긋나지 않아요. 도구 호출 메시지 묶음은 건드리지 않아요(범위 밖을 지우지 않게)
    let done = 0;
    for (let id = hi; id >= lo; id--) {
        await c.deleteMessage(id, undefined, false, false);
        done++;
    }
    toastr.success(`메시지 ${done}개를 지웠어요.`, '범위 지우기');
}

/** features.js 가 설정이 바뀔 때마다 부른다 */
export function syncRangeDelete(on) {
    wanted = !!on;
    if (!wanted) { leave(); removeItem(); return; }
    ensureItem();
}

/** 시험용 */
export const _forTest = { enter, leave, confirmDelete, state: () => mode && { start: mode.start, end: mode.end } };
