// 새 답 첫 줄로 (6.9.8): 답(과 켜져 있으면 자동 번역)이 끝났을 때 그 답의 첫 줄이 화면 위로 지나가 있으면 채팅 오른쪽 아래(입력창 위)에 ↑ 아이콘 하나.
// 누르면 그 답(.mes)의 첫 줄로. 답이 끝날 때 맨 아래 근처에 있었을 때만 띄운다 — 위쪽을 읽고 있던 사람을 방해하지 않게.
// 첫 줄(이름 줄)이 보이면(IntersectionObserver 하나, 떠 있는 동안만) · 다음 보내기 · 스와이프 · 채팅 바뀜에 걷는다.
// 끝 신호: GENERATION_ENDED, 번역 애드온의 'llm-translator:rendered'(번역이 그려져 길이가 바뀐 뒤). 아이콘만 · 툴팁 없음 · aria-label 만.
// 설정: 채팅 › 화면 「새 답 첫 줄로 가는 단추」 (chat.replyTop, 기본 끔) — 켤 때만 불러온다 (features.js)
let on = false, bound = false, btn = null, io = null, target = null, nearAtStart = true, timer = 0;
const offs = [];
const NEAR = 160;   // 답이 끝났을 때 바닥에서 이만큼 안이면 「맨 아래 근처」
const chat = () => document.getElementById('chat');
const nearBottom = () => { const c = chat(); return c ? c.scrollHeight - c.scrollTop - c.clientHeight <= NEAR : true; };
const lastMes = () => chat()?.querySelector('.mes.last_mes') || [...(chat()?.querySelectorAll('.mes') || [])].pop() || null;
const headOf = mes => mes.querySelector('.ch_name') || mes.querySelector('.mes_block > :first-child') || mes.firstElementChild || mes;

function ensureButton() {
    if (btn?.isConnected) return btn;
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'bl-reply-top'; btn.className = 'bl-reply-top'; btn.hidden = true;
    btn.setAttribute('aria-label', '새 답 첫 줄로');
    btn.innerHTML = '<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>';
    btn.addEventListener('click', () => { const t = target; hide(); if (t?.isConnected) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); });   // 지워진 답이면 갈 데가 없다
    (document.getElementById('sheld') || document.body).append(btn);
    return btn;
}
// 7.0.2 자리: 입력판(#form_sheld) 실제 위끝 위로. 예전엔 한 줄 단추 크기 상수(--bottomFormBlockSize)라 폰의 두 줄 입력판 · 한 손 줄 · 퀵 리플라이 · 메모 줄 속에
//       놓였고 z 25 가 입력판 30 아래라 가려졌다(보이지도 눌리지도 않음). 떠 있는 동안만 입력판 크기를 지켜본다(ResizeObserver 하나)
let resize = null;
export function footOffset(sheldRect, formRect) {
    if (!sheldRect || !formRect || !(formRect.height > 0)) return null;
    return Math.max(0, Math.round(sheldRect.bottom - formRect.top));
}
function place() {
    if (!btn || btn.hidden) return;
    const sheld = btn.parentElement, form = document.getElementById('form_sheld');
    const foot = footOffset(sheld?.getBoundingClientRect?.(), form?.getBoundingClientRect?.());
    btn.style?.setProperty?.('--bl-reply-foot', foot === null ? '' : `${foot}px`);
}
function hide() { clearTimeout(timer); timer = 0; if (btn) btn.hidden = true; io?.disconnect(); io = null; target = null; resize?.disconnect(); resize = null; }
function show(mes) {
    const b = ensureButton(); target = mes; b.hidden = false;
    place();
    const form = document.getElementById('form_sheld');
    if (form && typeof ResizeObserver === 'function' && !resize) { resize = new ResizeObserver(place); resize.observe(form); }
    io?.disconnect();
    io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) hide(); }, { root: chat(), threshold: 0.5 });
    io.observe(headOf(mes));
}
/** 답의 첫 줄이 화면 위로 지나갔나 — 지나갔고 끝날 때 바닥 근처였으면 단추 */
function check() {
    if (!on) return false;
    const c = chat(), mes = lastMes(); if (!c || !mes || !mes.isConnected) { hide(); return false; }
    const cr = c.getBoundingClientRect(), hr = headOf(mes).getBoundingClientRect();
    const passed = hr.bottom < cr.top + 4;
    if (passed && nearAtStart) { show(mes); return true; }
    if (!passed) hide();
    return false;
}
function onEnded() { clearTimeout(timer); timer = setTimeout(check, 350); }   // 실리태번이 마지막 그림을 끝낸 뒤
function onRendered(event) {
    const id = Number(event?.detail?.messageId); const mes = lastMes();
    if (!mes || (Number.isFinite(id) && Number(mes.getAttribute('mesid')) !== id)) return;
    onEnded();
}

export function syncReplyTop(enabled) {
    on = !!enabled;
    if (!on) { hide(); btn?.remove(); btn = null; for (const off of offs.splice(0)) off(); bound = false; return; }
    if (bound) return;
    bound = true;
    try {
        const { eventSource, event_types } = SillyTavern.getContext();
        const listen = (name, fn) => { if (event_types[name]) { eventSource.on(event_types[name], fn); offs.push(() => eventSource.removeListener?.(event_types[name], fn)); } };
        listen('GENERATION_STARTED', (_type, _params, dryRun) => { if (dryRun) return; hide(); nearAtStart = nearBottom(); });
        listen('GENERATION_ENDED', onEnded);
        listen('MESSAGE_SWIPED', hide);
        listen('CHAT_CHANGED', hide);
        for (const name of ['MESSAGE_DELETED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED']) listen(name, hide);   // 지우거나 고친 뒤 ↑ 가 남아 아무 데도 안 가지 않게
    } catch { /* 이벤트를 못 걸면 번역 신호만 */ }
    document.addEventListener('llm-translator:rendered', onRendered);
    offs.push(() => document.removeEventListener('llm-translator:rendered', onRendered));
}

/** 시험용 */
export const _forTest = { check, hide, setNear: v => { nearAtStart = v; }, state: () => ({ on, shown: !!btn && !btn.hidden, target }) };
