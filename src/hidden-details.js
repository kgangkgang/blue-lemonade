// 1.0.4 닫힌 <details> 안(그려지지 않는 칸) 요소는 나중에 — 카드 글자색(cardink.js) · 가운데 줄 잉크(center-ink.js)가 같이 써요.
//   닫힌 묶음 안 요소는 브라우저가 그리지 않아서, 그 스타일 · 자리를 읽을 때마다 그 묶음만 따로 강제 계산해요.
//   데우스 상태창 채팅(30개 · 접힌 모듈 120개 · 폰 4배)을 열 때 그것만 2초 남짓이었어요.
//   보이는 요소는 지금처럼 바로 하고, 닫힌 묶음 안 요소는 ① 조용할 때(굴리기 · 누르기 · 치기 · 답 받기가 1.5초 없을 때 쉬는 틈에 묶음 하나씩)
//   ② 그 전에 열면 여는 순간(누름을 먼저 받아 열리기 전에) ③ 스크립트가 열면 toggle 에서 해요. 하는 일 · 결과는 그대로이고 때만 뒤로 가요.
//   (①을 그냥 「쉴 때」로 했더니 채팅을 열자마자 굴리면 프레임 사이 틈마다 묶음을 재서 굴리기가 끊겼어요 — 그래서 조용할 때만)

/** el 을 가리는 가장 바깥 닫힌 details(그 details 의 머리 summary 안이면 보이니까 빼요). opening 은 열리는 중이라 연 것으로 봐요 */
export function hiddenBy(el, opening = null) {
    let out = null;
    for (let d = el?.parentElement?.closest?.('details'); d; d = d.parentElement?.closest?.('details')) {
        if (d.open || d === opening) continue;
        const head = d.querySelector(':scope > summary');
        if (!head || !head.contains(el)) out = d;
    }
    return out;
}

// 조용함: 마지막 굴리기 · 누르기 · 치기 뒤 QUIET_MS, 답을 받는 동안(body[data-generating])은 조용하지 않아요. 문서마다 리스너 한 벌(줄이 여럿이어도)
export const QUIET_MS = 1500;
let lastActive = 0, activityBound = false;
const ACTIVITY = ['scroll', 'wheel', 'touchmove', 'pointerdown', 'keydown'];
const markActive = () => { lastActive = Date.now(); };
function bindActivity() {
    if (activityBound || typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    activityBound = true;
    for (const type of ACTIVITY) document.addEventListener(type, markActive, { capture: true, passive: true });
    lastActive = Date.now();
}
/** 조용해질 때까지 남은 ms(0 = 지금 조용) */
function busyFor() {
    if (typeof document !== 'undefined' && document.body?.dataset?.generating === 'true') return QUIET_MS;
    return Math.max(0, lastActive + QUIET_MS - Date.now());
}

/** 뿌리 안(또는 뿌리가 든 곳)에 닫힌 details 가 있을 수 있나 — 없으면 후보마다 조상을 오르지 않아요(보통 채팅) */
export function mayHide(root) {
    if (!root || typeof root.querySelector !== 'function') return true;
    try { return !!(root.closest?.('details') || root.querySelector('details:not([open])')); } catch { return true; }   // 못 물으면 예전 길(후보마다)
}

/** run(목록) 을 닫힌 묶음 단위로 미뤄 주는 줄. defer(el) 은 가려졌으면 미루고 true, 보이면 false */
export function hiddenQueue(run, { enabled = () => true } = {}) {
    const queue = new Map();   // 가리는 details → Set(요소)
    let idle = 0, idleIsTimer = false, bound = false;
    const add = (d, el) => { let s = queue.get(d); if (!s) queue.set(d, s = new Set()); s.add(el); };
    const flush = (d, opening = null) => {
        const set = queue.get(d); if (!set) return;
        queue.delete(d);
        if (!enabled()) return;
        const now = [];
        for (const el of set) {
            if (!el.isConnected) continue;
            const h = opening ? hiddenBy(el, opening) : null;   // 여는 순간: 안쪽에 아직 닫힌 묶음이 있으면 그 묶음으로 다시 미뤄요
            if (h) add(h, el); else now.push(el);
        }
        if (now.length) run(now);
        if (opening) later();
    };
    const drain = deadline => {
        idle = 0;
        if (busyFor() > 0) { later(); return; }
        for (const d of [...queue.keys()]) {
            flush(d);
            if (!deadline || typeof deadline.timeRemaining !== 'function' || deadline.timeRemaining() < 8) break;   // 쉬는 틈 하나에 묶음 하나(넉넉하면 더)
        }
        later();
    };
    function later() {
        if (idle || !queue.size) return;
        const wait = busyFor();
        if (wait > 0) { idle = setTimeout(() => { idle = 0; later(); }, wait); idleIsTimer = true; return; }
        idleIsTimer = typeof requestIdleCallback !== 'function';
        idle = idleIsTimer ? setTimeout(() => drain(null), 300) : requestIdleCallback(drain);
    }
    const onClick = event => {
        const head = event.target?.closest?.('summary');
        const d = head?.parentElement;
        if (!d || d.tagName !== 'DETAILS' || d.open || head !== d.querySelector(':scope > summary')) return;
        for (const key of [...queue.keys()]) if (key === d || d.contains(key)) flush(key, d);
    };
    const onToggle = event => {
        const d = event.target;
        if (d?.tagName !== 'DETAILS' || !d.open) return;
        for (const key of [...queue.keys()]) if (key === d || d.contains(key)) flush(key, d);
    };
    const bind = () => {
        if (bound || typeof document === 'undefined') return;
        bound = true; bindActivity();
        document.addEventListener('click', onClick, true);
        document.addEventListener('toggle', onToggle, true);
    };
    return {
        defer(el) { const d = hiddenBy(el); if (!d) return false; bind(); add(d, el); later(); return true; },
        clear() { queue.clear(); },
        /** 다 버리고 문서 리스너도 떼요(감시를 다시 만드는 쪽 — 네모 단추) */
        dispose() { queue.clear(); if (idle) { (idleIsTimer || typeof cancelIdleCallback !== 'function' ? clearTimeout : cancelIdleCallback)(idle); idle = 0; } if (bound && typeof document !== 'undefined') { document.removeEventListener('click', onClick, true); document.removeEventListener('toggle', onToggle, true); } bound = false; },
        get size() { let n = 0; for (const s of queue.values()) n += s.size; return n; },
        drainNow() { for (const d of [...queue.keys()]) flush(d); },
    };
}
