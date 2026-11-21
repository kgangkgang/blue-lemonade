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

/** 장치 하나 — deps: toastr(함수 · 호출 때 읽음) · timers · 기다림 · 닫힘 시간 */
export function createFlowToast({ toastr = () => globalThis.toastr, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id), waitMs = 4000, hideMs = 3000, actionHideMs = 9000 } = {}) {
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
    function paint(card) {
        const lines = shown(card), kind = kindOf(lines), t = toastr();
        const text = lines.map(l => l.text).join('\n');
        if (!alive(card.el)) {
            if (!t) return;
            card.el = t[kind](`<span class="bl-flow-text">${esc(text).replace(/\n/g, '<br>')}</span>`, title(card), { timeOut: 0, extendedTimeOut: 0, closeButton: lines.some(l => l.sticky), escapeHtml: false });
            card.el?.addClass?.('bl-flow-toast');
            return;
        }
        const el = card.el;
        el.removeClass?.(KINDS.map(k => `toast-${k}`).join(' '));
        el.addClass?.(`toast-${kind}`);
        el.find?.('.bl-flow-text').first().html(esc(text).replace(/\n/g, '<br>'));   // 글 칸만 — 붙인 단추(되돌리기 · 다시)는 그대로
        const head = el.find?.('.toast-title');
        if (head?.length) head.first().text(title(card));
    }
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    function card(key) { const k = keyOf(key); let c = cards.get(k); if (!c) { c = { el: null, lines: new Map(), order: [], hide: 0, wait: 0, actions: false }; cards.set(k, c); } return [k, c]; }
    function stopTimers(c) { if (c.hide) clearTimer(c.hide); if (c.wait) clearTimer(c.wait); c.hide = c.wait = 0; }
    function close(k) {
        const c = cards.get(k); if (!c) return;
        stopTimers(c); cards.delete(k);
        const t = toastr(); if (c.el && t?.clear) t.clear(c.el);
    }
    function scheduleClose(k, c) {
        if ([...c.lines.values()].some(l => l.sticky)) return;   // 실패 · 멈춤은 사용자가 닫아요
        c.hide = setTimer(() => close(k), c.actions ? actionHideMs : hideMs);
    }
    function put(key, stage, { text, kind = 'info', title: head = '', sticky = false, done = false }) {
        const [k, c] = card(key); stopTimers(c); c.pending = null;
        c.order = c.order.filter(s => s !== stage).concat(stage);
        c.lines.set(stage, { text, kind, title: head, sticky, done });
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
