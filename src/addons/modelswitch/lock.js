// 모델 전환 — 잠금: 여기서 관리하는 확장의 공급자 · 모델 칸을 그 확장 화면에서는 못 바꾸게 한다.
// 칸을 없애거나 disabled 로 만들지 않는다 (확장이 다시 그리면 풀리고, 테마를 끄면 되돌릴 길이 없어진다).
// body 클래스 + CSS 로 흐리게 하고, 누르는 순간을 문서 맨 앞에서 가로채 모델 전환 창을 연다. 감시자 없음.
const CONTROLS = {
    translator: '#llm_connection_mode, #llm_provider, #llm_model, #llm_custom_model, #llm_custom_url, #llm_custom_fetch_models',
    rewrite: '#bwr_connection .bwr_seg, #bwr_provider, #bwr_model, #bwr_custom_model, #bwr_custom_url, #bwr_fetch_models',
    memory: '.lm-root [data-set-radio="apiMode"], .lm-root [data-set^="direct."]',
};
let locked = new Set(), bypass = 0, open = null, bound = false;

/** 우리 쪽에서 값을 넣는 동안에는 가로채지 않는다 (다시 쓰기는 click 으로 연결 방식을 바꾼다) */
export async function withoutLock(job) { bypass++; try { return await job(); } finally { bypass--; } }

function hit(event) {
    if (bypass || !locked.size) return null;
    const el = event.target instanceof Element ? event.target : null;
    if (!el) return null;
    for (const id of locked) { const control = el.closest(CONTROLS[id]); if (control) return control; }
    return null;
}

function bind() {
    if (bound) return; bound = true;
    const block = event => {
        const control = hit(event); if (!control) return;
        // 터치는 막지 않고 전파만 끊는다 — touchstart/touchend 를 preventDefault 하면 폰에서 click 이 안 생겨 창을 열 수 없다
        if (!event.type.startsWith('touch')) event.preventDefault();
        event.stopImmediatePropagation();
        if (event.type === 'click') open?.();
    };
    // window 의 capture 가 document 의 capture 보다 먼저 돈다 — 테마의 '고르기 목록 팝업'(selects.js, document capture)이 열리기 전에 막아야 한다
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'touchend', 'click']) window.addEventListener(type, block, { capture: true, passive: false });
    window.addEventListener('keydown', event => { if (event.key === 'Tab' || event.key === 'Escape') return; const control = hit(event); if (!control) return; event.preventDefault(); event.stopImmediatePropagation(); if (event.key === 'Enter' || event.key === ' ') open?.(); }, true);
    // 키보드로 들어와 값을 바꾸는 길(select 의 글자 입력 등)도 막는다
    window.addEventListener('focusin', event => { const control = hit(event); if (control) control.blur(); }, true);
}

/** ids = 잠글 대상(translator · rewrite · memory), opener = 막힌 칸을 눌렀을 때 열 창 */
export function setLocks(ids, opener) {
    open = opener; locked = new Set(ids.filter(id => CONTROLS[id]));
    for (const id of Object.keys(CONTROLS)) document.body.classList.toggle(`bl-ms-lock-${id}`, locked.has(id));
    if (locked.size) bind();
}
