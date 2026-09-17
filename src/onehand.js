// 한 손 버튼 줄 (3.1.0) — 입력창 바로 위에 자주 쓰는 동작을 모아 엄지로 누르게 한다.
// ‹ › (마지막 답 스와이프) · 사칭 · 이어 쓰기 · 다시 생성. 동작은 실리태번 자신의 단추를 대신 눌러서 하므로
// 막혀 있는 때(생성 중 · 스와이프 못 하는 메시지)의 판단도 실리태번이 한다. 생성 중에는 줄을 흐리게.
// 단추는 누를 때 초점을 가져가지 않는다 (입력칸의 키보드가 닫히지 않게).
const BUTTONS = [
    { key: 'swipe', act: 'swipe-left', icon: 'fa-chevron-left', label: '이전 답', run: () => $('#chat .last_mes .swipe_left').trigger('click') },
    { key: 'swipe', act: 'swipe-right', icon: 'fa-chevron-right', label: '다음 답', run: () => $('#chat .last_mes .swipe_right').trigger('click') },
    { key: 'imp', act: 'impersonate', icon: 'fa-user-secret', label: '사칭', run: () => $('#option_impersonate').trigger('click') },
    { key: 'cont', act: 'continue', icon: 'fa-forward', label: '이어 쓰기', run: () => $('#option_continue').trigger('click') },
    { key: 'regen', act: 'regenerate', icon: 'fa-rotate-right', label: '다시 생성', run: () => $('#option_regenerate').trigger('click') },
];

let row = null;
let listening = false;
let current = '';

function markBusy(busy) {
    row?.classList.toggle('is-busy', busy);
}

function listen() {
    if (listening) return;
    listening = true;
    const { eventSource, event_types } = SillyTavern.getContext();
    // 흐리게만 한다 (누르는 것은 막지 않음 — 실리태번이 알아서 무시). 번역 · 기억 같은 조용한 생성은 빼고
    eventSource.on(event_types.GENERATION_STARTED, (type, options, dryRun) => { if (!dryRun && type !== 'quiet') markBusy(true); });
    for (const name of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'MESSAGE_RECEIVED', 'CHAT_CHANGED']) {
        if (event_types[name]) eventSource.on(event_types[name], () => markBusy(false));
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
    const right = shown.filter(b => b.key !== 'swipe');
    const button = b => `<button type="button" class="bl-onehand-btn" data-act="${b.act}" aria-label="${b.label}"><i class="fa-solid ${b.icon}" aria-hidden="true"></i></button>`;
    row.innerHTML = `<span class="bl-onehand-group">${left.map(button).join('')}</span><span class="bl-onehand-group">${right.map(button).join('')}</span>`;
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
        row?.remove();
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
}
