// 1.9.8 답 뒤 이어지는 일(다시 쓰기 → 번역)의 알림을 답마다 한 장으로 (사용자 11-21 「다시쓰기랑 번역 팝업 하나로 · 자꾸 뿅 떴다 사라지고 귀찮아」).
//   단계마다 새 알림을 띄우지 않고 같은 알림의 글만 바꿔요: 「3곳 다시 쓰는 중…」 → 「3곳 고쳤어요 · 번역을 시작해요」 → 「번역하는 중…」 → 「번역했어요」 → 잠시 뒤 닫힘.
//   · 단계(stage)마다 한 줄 — 지금 단계 줄만 보이고, 앞 단계가 잘 끝난 줄은 다음 단계가 시작하면 비켜요. 실패 · 멈춤 줄(sticky)은 남아 까닭을 보여 줘요(사용자가 닫을 때까지).
//   · 앞 단계가 끝날 때 다음 단계가 올 것 같으면(뒤따르는 일이 「이 답 할 거예요」 라고 답하면) 알림을 닫지 않고 잠깐(waitMs) 기다려요. 안 오면 앞 단계 결과로 닫아요.
//   · 다시 쓰기만 · 번역만 쓰면 그 단계만 보여요. 다른 확장이 띄우는 알림은 건드리지 않아요(테마 애드온 둘만 이 장치를 써요).
//   알림 그리기는 toastr(실리태번) — 알림 요소의 글 · 색 갈래만 바꿔요. 모듈 둘(다시 쓰기 · 번역)이 따로 읽혀도 한 장치를 쓰게 전역 다리에 하나만 둬요.
//   순수 부분은 시험 tools/tests/flow-toast.mjs 가 가짜 toastr 로 검사해요.
export const BRIDGE = Symbol.for('blue-lemonade.flow-toast');
const KINDS = ['success', 'info', 'warning', 'error'];
const RANK = { success: 0, info: 1, warning: 2, error: 3 };
// 2.0.0 완료 알림은 짧게(사용자 11-21 「팝업 너무 오래 떠 있는당 번역됐다는 거」) — 예전 3초 · 되돌리기 단추가 붙으면 9초 → 2초 · 단추가 붙으면 3초.
//   손가락이 닿아 있거나 마우스가 올라가 있는 동안은 멈추고 떼면 1.5초 뒤 · 옆으로 쓸면 바로 닫혀요. 진행 중 · 실패 · 멈춤 알림은 예전 그대로예요.
export const DONE_MS = 2000, DONE_ACTION_MS = 3000, RESUME_MS = 1500, SWIPE_PX = 48;
/** 완료 알림(일반 toastr) 옵션 — 다시 쓰기 · 번역 애드온의 「…했어요」 알림이 같은 기준을 써요 */
export const doneOptions = (actions = false, extra = {}) => ({ timeOut: actions ? DONE_ACTION_MS : DONE_MS, extendedTimeOut: RESUME_MS, ...extra });
/**
 * 알림 요소에 「닿는 동안 멈춤 · 옆으로 쓸면 닫힘」 — hold() · release() · dismiss() 는 부르는 쪽이 정해요.
 *   mouse: 일반 toastr 는 스스로 마우스 올림을 멈추니 opts.mouse === false 로 손가락 · 펜만 받아요(두 번 멈추지 않게).
 */
export function holdAndSwipe(toast, { hold, release, dismiss, mouse = true } = {}) {
    const el = toast?.[0] ?? toast;
    if (!el?.addEventListener || el.dataset?.blHold) return el ?? null;
    if (el.dataset) el.dataset.blHold = '1';
    if (el.style) el.style.touchAction = 'pan-y';   // 세로 굴림은 그대로 · 가로 쓸기는 우리가 받아요
    let start = null, holding = false;
    const mine = e => mouse || e.pointerType !== 'mouse';
    const on = e => { if (!mine(e) || holding) return; holding = true; hold?.(); };
    const off = e => { if (!mine(e) || !holding) return; holding = false; release?.(); };
    const reset = () => { start = null; if (el.style) { el.style.transform = ''; el.style.opacity = ''; } };
    el.addEventListener('pointerenter', on);
    el.addEventListener('pointerdown', e => { on(e); start = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    el.addEventListener('pointermove', e => {
        if (!start || e.pointerId !== start.id) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (Math.abs(dx) < Math.abs(dy)) return;
        if (el.style) { el.style.transform = `translateX(${dx}px)`; el.style.opacity = String(Math.max(0.2, 1 - Math.abs(dx) / 160)); }
        if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) { start = null; holding = false; dismiss?.(); }
    });
    for (const type of ['pointerup', 'pointercancel']) el.addEventListener(type, e => { if (start) reset(); if (e.pointerType !== 'mouse') off(e); });
    el.addEventListener('pointerleave', e => { if (start) reset(); off(e); });
    return el;
}

/** 일반 toastr 완료 알림에 같은 손길 — 손가락이 닿으면 toastr 의 마우스 올림 멈춤을 그대로 부르고 · 옆으로 쓸면 닫아요 → 그 알림 */
export function doneToast(toast, toastr = () => globalThis.toastr) {
    if (!toast) return toast;
    holdAndSwipe(toast, {
        mouse: false,
        hold() { toast.trigger?.('mouseenter'); },
        release() { toast.trigger?.('mouseleave'); },
        dismiss() { try { toastr()?.clear?.(toast, { force: true }); } catch { /* 이미 닫힘 */ } },
    });
    return toast;
}

/** 장치 하나 — deps: toastr(함수 · 호출 때 읽음) · timers · 기다림 · 닫힘 시간 */
export function createFlowToast({ toastr = () => globalThis.toastr, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id), waitMs = 4000, hideMs = 3000, actionHideMs = 9000, doneMs = DONE_MS, doneActionMs = DONE_ACTION_MS, resumeMs = RESUME_MS } = {}) {
    const cards = new Map();   // key → { el, lines: Map(stage → { text, kind, sticky, done }), order: [], hide, wait, actions }
    const followers = new Map();   // stage → (key, meta) → bool (이 답을 이어서 할 것인가)
    const objKeys = new WeakMap(); let seq = 0;
    const keyOf = key => (key && typeof key === 'object' ? (objKeys.get(key) ?? (objKeys.set(key, `m${++seq}`), objKeys.get(key))) : String(key));
    const alive = el => !!el && el.length !== 0 && (typeof el.closest !== 'function' || el.closest('body').length > 0);
    const title = card => card.order.map(s => card.lines.get(s)?.title).filter(Boolean).filter((t, i, a) => a.indexOf(t) === i).join(' · ');
    const shown = card => {
        // 실패 · 멈춤 줄 + 지금(마지막) 단계 줄 — 잘 끝난 앞 단계 줄은 뒤 단계가 있으면 비켜요
        const last = card.order[card.order.length - 1];
        return card.order.filter(s => s === last || card.lines.get(s).sticky).map(s => card.lines.get(s));
    };
    const kindOf = lines => lines.reduce((k, l) => (RANK[l.kind] > RANK[k] ? l.kind : k), lines.length ? lines[lines.length - 1].kind : 'info');
    // 2.0.0 한 꼴(사용자 11-21 「번역 알림 왜 저래 왤케 커」): 아이콘 · 제목 · 한 줄 · 오른쪽 끝 ↻ · × — 보이는 줄이 여럿이면 「 · 」 로 이어 한 줄(넘치면 말줄임),
    //   자세한 까닭(detail)은 알림을 누르면 펼쳐져요(한 번 더 누르면 닫힘). × 는 toastr 닫기 단추 대신 글 줄 끝에 붙여 따로 줄을 만들지 않아요.
    const body = lines => {
        const line = lines.map(l => esc(l.text)).join(' · ');
        const more = lines.map(l => l.detail).filter(Boolean).map(esc).join('<br>');
        return `<span class="bl-flow-line">${line}</span>${more ? `<span class="bl-flow-more">${more}</span>` : ''}`;
    };
    function paint(card) {
        const lines = shown(card), kind = kindOf(lines), t = toastr();
        card.more = lines.some(l => l.detail);
        if (!alive(card.el)) {
            if (!t) return;
            card.el = t[kind](`<span class="bl-flow-text">${body(lines)}</span>`, title(card), { timeOut: 0, extendedTimeOut: 0, closeButton: false, tapToDismiss: false, escapeHtml: false });
            card.el?.addClass?.('bl-flow-toast');
            const c = card;
            addClose(c);
            if (c.more) c.el?.addClass?.('bl-flow-has-more');
            const node = c.el?.[0] ?? c.el;
            node?.addEventListener?.('click', event => {   // 누르면: 펼칠 까닭이 있고 아직 접혀 있으면 펼침 · 아니면 닫음(예전 「눌러서 닫기」 그대로)
                if (event?.defaultPrevented) return;
                if (c.more && !c.open) { c.open = true; c.el?.addClass?.('bl-flow-open'); if (c.hide) { clearTimer(c.hide); c.hide = 0; } return; }
                close(c.k);
            });
            holdAndSwipe(card.el, {
                hold() { c.held = true; if (c.hide) { clearTimer(c.hide); c.hide = 0; c.resume = true; } },
                release() { c.held = false; if (c.resume) { c.resume = false; c.hide = setTimer(() => close(c.k), resumeMs); } },
                dismiss() { close(c.k); },
            });
            return;
        }
        const el = card.el;
        el.removeClass?.(KINDS.map(k => `toast-${k}`).join(' '));
        el.addClass?.(`toast-${kind}`);
        el.find?.('.bl-flow-text').first().html(body(lines));   // 글 칸만 — 붙인 단추(되돌리기 · 다시 · 닫기)는 그대로
        const head = el.find?.('.toast-title');
        if (head?.length) head.first().text(title(card));
        if (card.more) el.addClass?.('bl-flow-has-more'); else { el.removeClass?.('bl-flow-has-more bl-flow-open'); card.open = false; }
    }
    /** × — 글 줄 끝(↻ 옆)에 · 누르면 닫기(알림 누름 펼치기로 안 번짐) */
    function addClose(c) {
        const node = c.el?.[0] ?? c.el, host = node?.querySelector?.('.toast-message') || null, doc = globalThis.document;
        if (!host?.append || !doc?.createElement) return;
        const b = doc.createElement('button');
        b.type = 'button'; b.className = 'bl-flow-close'; b.setAttribute('aria-label', '닫기');
        b.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        b.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); close(c.k); });
        host.append(b);
    }
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    function card(key) { const k = keyOf(key); let c = cards.get(k); if (!c) { c = { k, el: null, lines: new Map(), order: [], hide: 0, wait: 0, actions: false, held: false, resume: false, more: false, open: false }; cards.set(k, c); } return [k, c]; }
    function stopTimers(c) { if (c.hide) clearTimer(c.hide); if (c.wait) clearTimer(c.wait); c.hide = c.wait = 0; c.resume = false; }
    function close(k) {
        const c = cards.get(k); if (!c) return;
        stopTimers(c); cards.delete(k);
        const t = toastr(); if (c.el && t?.clear) t.clear(c.el);
    }
    function scheduleClose(k, c) {
        if ([...c.lines.values()].some(l => l.sticky)) return;   // 실패 · 멈춤은 사용자가 닫아요
        if (c.held) { c.resume = true; return; }   // 닿아 있는 동안은 멈춤 — 떼면 resumeMs 뒤
        if (c.open) return;   // 2.0.0 까닭을 펼쳐 읽는 동안은 안 닫혀요(× · 다시 누름 · 쓸기로 닫음)
        // 2.0.0 보이는 줄이 다 잘 끝났으면(완료) 짧게 · 그 밖(멈춤 안내 등)은 예전 길이
        const done = shown(c).every(l => l.kind === 'success');
        c.hide = setTimer(() => close(k), done ? (c.actions ? doneActionMs : doneMs) : (c.actions ? actionHideMs : hideMs));
    }
    function put(key, stage, { text, detail = '', kind = 'info', title: head = '', sticky = false, done = false }) {
        const [k, c] = card(key); stopTimers(c); c.pending = null;
        c.order = c.order.filter(s => s !== stage).concat(stage);
        c.lines.set(stage, { text, detail, kind, title: head, sticky, done });
        paint(c);
        return [k, c];
    }
    return {
        /** 단계 진행 중 — 알림이 없으면 띄우고 있으면 글만 바꿔요 */
        step(key, stage, opts) { return put(key, stage, { ...opts, done: false })[1].el; },
        /** 단계 끝 — next: 다음 단계 이름(그 단계를 따르는 일이 「할 거예요」 하면 닫지 않고 기다려요) · waitText: 기다리는 동안의 글 */
        end(key, stage, { next = null, waitText = null, meta = null, ...opts } = {}) {
            const follow = next && followers.get(next);
            const coming = !!(follow && !opts.sticky && safe(() => follow(key, meta)));
            const [k, c] = put(key, stage, { ...opts, text: coming && waitText ? waitText : opts.text, done: true });
            if (coming) {
                c.pending = { stage, text: opts.text, kind: opts.kind || 'success' };
                c.wait = setTimer(() => { c.wait = 0; const p = c.pending; c.pending = null; if (p && c.order[c.order.length - 1] === p.stage) { c.lines.set(p.stage, { ...c.lines.get(p.stage), text: p.text, kind: p.kind }); paint(c); } scheduleClose(k, c); }, waitMs);
            } else scheduleClose(k, c);
            return c.el;
        },
        /** 끝나지 않은 단계 줄이면 끝내요(이미 끝났으면 그대로) — 일이 어느 길로 끝나든 알림이 「…하는 중」에 남지 않게 */
        settle(key, stage, opts) {
            const c = cards.get(keyOf(key)), line = c?.lines.get(stage);
            if (line && !line.done) this.end(key, stage, opts);
        },
        /** 이 답의 알림이 있나 (번역이 「번역만 쓰는」 길로 갈지 고를 때) */
        has(key) { const c = cards.get(keyOf(key)); return !!c && alive(c.el); },
        /** 알림에 단추를 붙였다고 알려요 — 닫힘을 늦춰요(되돌리기 단추를 누를 틈) */
        withActions(key) {
            const k = keyOf(key), c = cards.get(k); if (!c) return null;
            c.actions = true;
            if (c.hide) { clearTimer(c.hide); c.hide = 0; scheduleClose(k, c); }   // 이미 닫힘을 걸었으면 늦춰 다시
            return c.el;
        },
        /** 단계를 따르는 일 등록 — fn(key, meta) 이 참이면 앞 단계가 끝날 때 기다려요 */
        follow(stage, fn) { followers.set(stage, fn); return () => { if (followers.get(stage) === fn) followers.delete(stage); }; },
        /** 이 단계 줄만 지우고(할 일이 없었음) 남은 줄로 — 아무 줄도 없으면 닫아요 */
        drop(key, stage) {
            const k = keyOf(key), c = cards.get(k); if (!c || !c.lines.has(stage)) return;
            c.lines.delete(stage); c.order = c.order.filter(s => s !== stage);
            if (!c.order.length) { close(k); return; }
            paint(c);
        },
        close(key) { close(keyOf(key)); },
        _cards: cards,
    };
}
const safe = fn => { try { return fn(); } catch { return false; } };

/** 전역에 하나 — 다시 쓰기 · 번역 애드온이 같은 장치를 써요 */
export function flowToast() {
    return globalThis[BRIDGE] ??= createFlowToast();
}
