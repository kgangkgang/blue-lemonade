import { watchDom } from './dom-watch.js';
// 한 손 버튼 줄 (3.1.0) — 입력창 바로 위에 자주 쓰는 동작을 모아 엄지로 누르게 한다.
// ‹ › (마지막 답 스와이프) · 사칭 · 이어 쓰기 · 다시 생성. 동작은 실리태번 자신의 단추를 대신 눌러서 하므로
// 막혀 있는 때(생성 중 · 스와이프 못 하는 메시지)의 판단도 실리태번이 한다. 생성 중에는 줄을 흐리게.
// 1.0.3 가운데 묶음: 맨 위 · 맨 아래 · 번호로 가기 · 마지막 메시지 지우기 (기본 켬). 이동은 실리태번 /chat-jump(입력창 자연어 명령과 같은 길 —
//   natural-slash.js), 지우기는 연필 옆 지우기와 같은 실리태번 확인 창(quick/mes-delete.js) — 둘 다 누를 때 받는다.
// 단추는 누를 때 초점을 가져가지 않는다 (입력칸의 키보드가 닫히지 않게).
const BUTTONS = [
    { key: 'swipe', act: 'swipe-left', icon: 'fa-chevron-left', label: '이전 답', run: () => $('#chat .last_mes .swipe_left').trigger('click') },
    { key: 'swipe', act: 'swipe-right', icon: 'fa-chevron-right', label: '다음 답', run: () => $('#chat .last_mes .swipe_right').trigger('click') },
    { key: 'top', act: 'chat-top', icon: 'fa-angles-up', label: '맨 위로', run: () => goTo({ kind: 'top' }) },
    { key: 'bottom', act: 'chat-bottom', icon: 'fa-angles-down', label: '맨 아래로', run: toBottom },
    { key: 'jump', act: 'chat-jump', icon: 'fa-hashtag', label: '번호로 가기', run: askJump },
    { key: 'delLast', act: 'delete-last', icon: 'fa-trash-can', label: '마지막 메시지 지우기', run: deleteLast },
    { key: 'imp', act: 'impersonate', icon: 'fa-user-secret', label: '사칭', run: () => $('#option_impersonate').trigger('click') },
    { key: 'cont', act: 'continue', icon: 'fa-forward', label: '이어 쓰기', run: () => $('#option_continue').trigger('click') },
    { key: 'regen', act: 'regenerate', icon: 'fa-rotate-right', label: '다시 생성', run: () => $('#option_regenerate').trigger('click') },
];
const NAV = new Set(['top', 'bottom', 'jump', 'delLast']);

// 1.0.3 이동 · 지우기 — 누를 때만 받는다 (실패하면 알림 한 줄)
const say = message => globalThis.toastr?.info?.(message, '한 손 버튼 줄', { timeOut: 2500 });
function goTo(action) {
    return import('./natural-slash.js').then(m => m.runNaturalSlash(action, SillyTavern.getContext())).then(result => { if (!result?.ok) say(result?.message || '옮기지 못했어요.'); })
        .catch(error => { console.warn('[Blue Lemonade] 한 손 버튼 줄 이동', error); say('옮기지 못했어요.'); });
}
/** 맨 아래: 채팅 칸 끝까지 (그려진 메시지는 늘 마지막까지 이어져 있어요) */
function toBottom() {
    const chat = document.getElementById('chat');
    if (!chat) return;
    chat.scrollTo?.({ top: chat.scrollHeight, behavior: 'smooth' });
}
async function askJump() {
    const c = SillyTavern.getContext();
    const total = Array.isArray(c.chat) ? c.chat.length : 0;
    if (!total) { say('먼저 대화를 열어 주세요.'); return; }
    const answer = await c.callGenericPopup?.(`몇 번 메시지로 갈까요? (#0 ~ #${total - 1})`, c.POPUP_TYPE?.INPUT, '', { okButton: '가기', cancelButton: '취소' });
    if (answer === null || answer === undefined || answer === false || answer === '') return;
    const index = Number.parseInt(String(answer).replace(/[^\d]/g, ''), 10);
    if (!Number.isSafeInteger(index)) { say('번호를 숫자로 적어 주세요.'); return; }
    return goTo({ kind: 'jump', index });
}
function deleteLast() {
    const c = SillyTavern.getContext();
    const last = Array.isArray(c.chat) ? c.chat.length - 1 : -1;
    if (last < 0) { say('지울 메시지가 없어요.'); return; }
    return import('./quick/mes-delete.js').then(m => m.deleteWithAsk(last)).catch(error => { console.warn('[Blue Lemonade] 마지막 메시지 지우기', error); say('지우지 못했어요.'); });
}

let row = null;
let listening = false;
let current = '';
let unwatch = null;
const cleanups = [];
function unlisten() { unwatch?.(); unwatch = null; for (const off of cleanups.splice(0)) off(); listening = false; }

function markBusy(busy) {
    row?.classList.toggle('is-busy', busy);
}

function listen() {
    if (listening) return;
    listening = true;
    const { eventSource, event_types } = SillyTavern.getContext();
    // 흐리게만 한다 (누르는 것은 막지 않음 — 실리태번이 알아서 무시). 번역 · 기억 같은 조용한 생성은 빼고
    const sync = () => markBusy(document.body.dataset.generating === 'true');
    unwatch = watchDom(document.body, { attributes: ['data-generating'], name: '한 손 줄 생성 상태' }, sync);
    sync();
    for (const name of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'MESSAGE_RECEIVED', 'CHAT_CHANGED']) {
        if (event_types[name]) {
            const handler = () => markBusy(false), type = event_types[name];
            eventSource.on(type, handler);
            cleanups.push(() => (eventSource.removeListener || eventSource.off)?.call(eventSource, type, handler));
        }
    }
}

function build(options) {
    const shown = BUTTONS.filter(b => options[b.key] !== false);
    const signature = shown.map(b => b.act).join(',');
    if (row && signature === current) return;
    current = signature;
    row ??= document.createElement('div');
    row.id = 'bl-onehand';
    row.setAttribute('role', 'toolbar');
    row.setAttribute('aria-label', '빠른 동작');
    const left = shown.filter(b => b.key === 'swipe');
    const middle = shown.filter(b => NAV.has(b.key));
    const right = shown.filter(b => b.key !== 'swipe' && !NAV.has(b.key));
    const button = b => `<button type="button" class="bl-onehand-btn" data-act="${b.act}" aria-label="${b.label}"><i class="fa-solid ${b.icon}" aria-hidden="true"></i></button>`;
    const group = list => `<span class="bl-onehand-group">${list.map(button).join('')}</span>`;
    // 단추가 많으면(7개 넘게) 폰 폭(384)에 한 줄로 들어가게 조금 좁게 — 누르는 넓이는 css/86 의 투명 상자가 받쳐요
    row.classList.toggle('is-many', shown.length > 7);
    row.innerHTML = middle.length ? group(left) + group(middle) + group(right) : group(left) + group(right);
}

function onPointerDown(event) {
    if (event.target.closest('.bl-onehand-btn')) event.preventDefault(); // 초점 안 가져감
}

function onClick(event) {
    const el = event.target.closest('.bl-onehand-btn');
    if (!el) return;
    event.preventDefault();
    BUTTONS.find(b => b.act === el.dataset.act)?.run();
}

/** apply.js 가 설정이 바뀔 때마다 부른다: options = settings.onehand */
export function syncOneHand(on, options = {}) {
    const form = document.getElementById('form_sheld');
    if (!on || !form) {
        unlisten();
        if (row) { row.removeEventListener('pointerdown', onPointerDown); row.removeEventListener('mousedown', onPointerDown); row.removeEventListener('click', onClick); row.remove(); }
        row = null; current = '';
        return;
    }
    const fresh = !row;
    build(options);
    if (fresh) {
        row.addEventListener('pointerdown', onPointerDown);
        row.addEventListener('mousedown', onPointerDown);
        row.addEventListener('click', onClick);
        listen();
    }
    if (row.parentElement !== form) form.prepend(row);
    markBusy(document.body.dataset.generating === 'true');
}
