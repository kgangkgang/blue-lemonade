import { preserveDraftForReload } from './draft.js';

const EXCLUDE = 'input,textarea,select,button,a,label,summary,[contenteditable]:not([contenteditable="false"]),[draggable="true"],[role="button"],[role="slider"],[role="tab"],[role="tablist"],canvas,iframe,video,audio,.mes_buttons,.mes_button,.swipe_left,.swipe_right,.mes_edit,.edit_textarea,.ui-draggable-handle';
const OVERLAYS = 'dialog[open],.drawer-content.openDrawer,#cg-panel:not([hidden]),#pt-panel:not(.pt-hidden)';
const THRESHOLD = 112;
// 저장 실패는 이 시간 동안만 새로고침을 막아요. 한 번 실패한 경로가 다시 성공하지 않아도 영영 막히지 않게 해요.
export const FAIL_HOLD_MS = 20000;
// 실패 안내를 본 뒤 이 시간 안에 한 번 더 끝까지 당기면 초안을 보관하고 그래도 새로고침해요.
export const FORCE_WINDOW_MS = 10000;
// 주소가 없거나(확장이 없는 파일을 지울 때 404) 받지 않는 요청은 저장 실패가 아니에요.
const MISSING = new Set([404, 405, 410, 501]);
const FAILED_TEXT = '저장을 확인하지 못했어요. 한 번 더 당기면 그래도 새로고침해요.';
const BUSY_TEXT = '저장 중이에요. 잠시 뒤 다시 당겨 주세요.';

// 최초 방향을 고정해요. 가로 손짓이나 위로 스크롤하던 손짓은 나중에 새로고침으로 바뀌지 않아요.
export function createPullGesture(x, y, at) {
    let cancelled = false, claimed = false, distance = 0;
    return {
        move(nx, ny, now, count = 1) {
            const dx = Math.abs(nx - x), dy = ny - y;
            if (count !== 1 || dy < -6 || dx > Math.max(10, Math.abs(dy) * 0.65) || (!claimed && now - at > 650)) cancelled = true;
            if (cancelled) return { cancelled: true };
            if (dy > 6 && dy > dx * 1.5) claimed = true;
            distance = Math.max(0, dy);
            return { claimed, distance, armed: claimed && distance >= THRESHOLD };
        },
        cancel() { cancelled = true; },
    };
}

export function installedTouchMode(win) {
    return win.navigator.maxTouchPoints > 0 && win.matchMedia('(pointer: coarse)').matches
        && (win.matchMedia('(display-mode: standalone)').matches || win.navigator.standalone === true);
}

// 요청 본문이나 인증값은 읽지 않아요. 진행 중인 서버 요청과 최근 저장 실패 여부만 세요.
export function trackRefreshWrites(win, now, quietMs, holdMs = FAIL_HOLD_MS) {
    const original = win.fetch;
    let pending = 0, quietUntil = 0, disposed = false;
    const failed = new Map();   // 경로 → 마지막 실패 시각
    const wrapper = async function(input, init) {
        let local = false, saving = false, key = '';
        try {
            const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, win.location.href);
            const method = String(init?.method || input?.method || 'GET').toUpperCase();
            local = url.origin === win.location.origin && url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(method);
            key = url.pathname;
            saving = local && /\/(save|edit|update|set|create|delete|rename|import|upload)(\/|$)/.test(key);
        } catch { /* 주소를 읽지 못한 요청은 기존 함수에 그대로 넘겨요. */ }
        if (disposed || !local) return original.apply(this, arguments);
        pending++;
        try {
            const response = await original.apply(this, arguments);
            if (saving) { if (response.ok) failed.delete(key); else if (!MISSING.has(response.status)) failed.set(key, now()); }
            return response;
        } catch (error) { if (saving && error?.name !== 'AbortError') failed.set(key, now()); throw error; }
        finally { pending--; quietUntil = Math.max(quietUntil, now() + 300); }
    };
    win.fetch = wrapper;
    const recentFailure = () => {
        const t = now();
        for (const [key, at] of failed) if (t - at >= holdMs) failed.delete(key);
        return failed.size > 0;
    };
    // 진행 중인 저장이 먼저예요. 실패가 남아 있어도 지금 저장 중이면 강제 새로고침을 허락하지 않아요.
    const state = () => pending || now() < quietUntil || win.jQuery?.active > 0 ? 'busy' : recentFailure() ? 'failed' : '';
    return {
        changed() { quietUntil = now() + quietMs; },
        state,
        reason() { const s = state(); return s === 'busy' ? BUSY_TEXT : s === 'failed' ? FAILED_TEXT : ''; },
        dispose() { disposed = true; if (win.fetch === wrapper) win.fetch = original; },
    };
}

// 새로고침해도 되는지 판단해요. 생성 중·채팅 저장 중·편집 중·진행 중인 저장은 언제나 막고,
// 최근 저장 실패만 남았을 때는 안내 뒤 한 번 더 당기면 허락해요.
export function createRefreshGate({ host, writes, now, editing = () => false, forceMs = FORCE_WINDOW_MS }) {
    let forceUntil = 0;
    const hard = () => {
        if (host.isGenerating?.() || host.is_send_press || host.is_group_generating) return '답변 생성 중에는 새로고침하지 않아요.';
        if (host.isChatSaving) return '채팅 저장 중이에요. 잠시 뒤 다시 당겨 주세요.';
        if (editing()) return '메시지 편집을 마친 뒤 다시 당겨 주세요.';
        return '';
    };
    const check = () => {
        const reason = hard();
        if (reason) return { reason, forced: false, failed: false };
        if (writes.state() === 'failed') return now() < forceUntil ? { reason: '', forced: true, failed: true } : { reason: writes.reason(), forced: false, failed: true };
        return { reason: writes.reason(), forced: false, failed: false };
    };
    return {
        check,
        // 끝까지 당겼다 놓았을 때 불러요. 실패만으로 막혔으면 다음 당김을 허락해 둬요.
        release() { const v = check(); if (v.failed && v.reason) forceUntil = now() + forceMs; return v; },
        clear() { forceUntil = 0; },
    };
}

export function installPullToRefresh({ host, isEnabled, doc = document, win = window, prepare = preserveDraftForReload, reload = () => win.location.reload() }) {
    const chat = doc.getElementById('chat');
    if (!chat || !installedTouchMode(win)) return null;
    const now = () => win.performance.now();
    const writes = trackRefreshWrites(win, now, Math.max(1500, (host.DEFAULT_SAVE_EDIT_TIMEOUT || 1000) + 300));
    const indicator = doc.createElement('div');
    indicator.className = 'bl-pull-refresh'; indicator.hidden = true;
    indicator.setAttribute('role', 'status'); indicator.setAttribute('aria-live', 'polite'); indicator.setAttribute('aria-atomic', 'true');
    const icon = doc.createElement('span'); icon.className = 'bl-pull-refresh-icon'; icon.textContent = '↻'; icon.setAttribute('aria-hidden', 'true');
    const label = doc.createElement('span'); indicator.append(icon, label); doc.body.append(indicator);
    let gesture = null, state = null, identifier = null, startTarget = null, reloading = false, resetTimer = null, lastScroll = -Infinity, disposed = false;
    const listeners = [], subscriptions = [];
    const listen = (el, type, fn, opts) => { el.addEventListener(type, fn, opts); listeners.push(() => el.removeEventListener(type, fn, opts)); };
    const enabled = () => !disposed && isEnabled() && installedTouchMode(win);
    const visible = e => e && e.getClientRects().length && win.getComputedStyle(e).visibility !== 'hidden';
    const selected = () => { const selection = win.getSelection(); return !!selection && !selection.isCollapsed; };
    const gate = createRefreshGate({ host, writes, now, editing: () => [...doc.querySelectorAll('.edit_textarea')].some(visible) });
    function show(text, distance = 0, armed = false) {
        indicator.hidden = false;
        if (label.textContent !== text) label.textContent = text;
        indicator.classList.toggle('is-ready', armed);
        indicator.style.setProperty('--bl-pull-distance', Math.min(56, distance * 0.4) + 'px');
        icon.style.transform = `rotate(${Math.min(300, distance * 2)}deg)`;
    }
    function reset() {
        gesture?.cancel(); gesture = null; state = null; identifier = null; startTarget = null;
        if (!reloading) indicator.hidden = true;
    }
    function eligible(target) {
        if (!enabled() || reloading || chat.scrollTop > 1 || now() - lastScroll < 250 || selected()) return false;
        if (!chat.contains(target) || target.closest(EXCLUDE) || doc.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return false;
        if ([...doc.querySelectorAll(OVERLAYS)].some(visible)) return false;
        if (win.visualViewport && win.visualViewport.scale > 1.05) return false;
        // 메시지 안 코드·가로 탭·내부 스크롤의 끝을 페이지 최상단으로 오해하지 않아요.
        for (let e = target; e && e !== chat; e = e.parentElement) {
            const s = win.getComputedStyle(e);
            if ((/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight + 1)
                || (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1)
                || s.touchAction === 'none') return false;
        }
        return true;
    }
    function start(event) {
        if (reloading) return;
        win.clearTimeout(resetTimer);
        reset();
        if (event.defaultPrevented || event.touches.length !== 1 || !eligible(event.target)) return;
        const t = event.touches[0]; identifier = t.identifier; startTarget = event.target; gesture = createPullGesture(t.clientX, t.clientY, now());
    }
    function move(event) {
        if (!gesture) return;
        if (!enabled() || event.defaultPrevented || event.touches.length !== 1 || chat.scrollTop > 1 || selected()) { reset(); return; }
        const t = [...event.touches].find(t => t.identifier === identifier);
        if (!t) { reset(); return; }
        state = gesture.move(t.clientX, t.clientY, now(), event.touches.length);
        if (state.cancelled) { reset(); return; }
        if (!state.claimed) return;
        if (!event.cancelable) { reset(); return; }
        event.preventDefault();
        const { reason, forced } = gate.check();
        show(reason || (state.armed ? (forced ? '놓으면 그래도 새로고침해요' : '놓으면 새로고침해요') : '아래로 더 당겨 주세요'), state.distance, state.armed && !reason);
    }
    function end(event) {
        if (!gesture) return;
        const armed = state?.armed && event.touches.length === 0 && eligible(startTarget);
        reset();
        if (!armed || !enabled() || chat.scrollTop > 1 || selected()) return;
        const { reason } = gate.release();
        if (reason || !prepare()) {
            show(reason || '입력한 글을 보관하지 못했어요. 글을 복사한 뒤 다시 시도해 주세요.');
            win.clearTimeout(resetTimer); resetTimer = win.setTimeout(reset, 2200); return;
        }
        gate.clear(); reloading = true; show('새로고침 중이에요', THRESHOLD, true);
        // 기존 beforeunload 처리와 브라우저 확인창을 그대로 거쳐요. 취소되면 다시 당길 수 있어요.
        resetTimer = win.setTimeout(() => { reloading = false; reset(); }, 1800);
        try { reload(); } catch { reloading = false; reset(); }
    }
    const changed = event => { if (event.target?.id !== 'send_textarea') writes.changed(); reset(); };
    listen(chat, 'touchstart', start, { passive: true });
    listen(chat, 'touchmove', move, { passive: false });
    listen(chat, 'touchend', end, { passive: true });
    listen(chat, 'touchcancel', reset, { passive: true });
    listen(chat, 'scroll', () => { lastScroll = now(); reset(); }, { passive: true });
    listen(doc, 'touchstart', e => { if (e.touches.length !== 1) reset(); }, { passive: true, capture: true });
    listen(doc, 'contextmenu', reset, true); listen(doc, 'selectionchange', () => { if (selected()) reset(); });
    listen(doc, 'input', changed, true); listen(doc, 'change', changed, true);
    listen(doc, 'visibilitychange', reset); listen(win, 'pagehide', reset);
    const syncMode = () => { doc.documentElement.toggleAttribute('data-bl-pull-refresh', enabled()); if (!enabled()) reset(); };
    const observer = new win.MutationObserver(syncMode); observer.observe(doc.body, { attributes: true, attributeFilter: ['class'] }); syncMode();
    const ctx = win.SillyTavern?.getContext(), types = ctx?.eventTypes || ctx?.event_types;
    if (types && ctx.eventSource) for (const type of ['GENERATION_STARTED', 'GENERATION_ENDED', 'CHAT_CHANGED']) {
        if (!types[type]) continue;
        const fn = () => { writes.changed(); reset(); };
        ctx.eventSource.on(types[type], fn); subscriptions.push(() => ctx.eventSource.removeListener(types[type], fn));
    }
    return { dispose() { disposed = true; reloading = false; reset(); win.clearTimeout(resetTimer); listeners.forEach(f => f()); subscriptions.forEach(f => f()); observer.disconnect(); writes.dispose(); indicator.remove(); doc.documentElement.removeAttribute('data-bl-pull-refresh'); } };
}

let running = null;
export async function startPullToRefresh({ isEnabled }) {
    if (running || !installedTouchMode(window)) return running;
    const host = await import('../../../../../script.js');
    return running ||= installPullToRefresh({ host, isEnabled });
}
