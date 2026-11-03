// 9.0.7 내장 스크립트마다 하나씩 주는 「창 대리」. 예전에는 스크립트마다 숨은 iframe 을 만들고 그 창의 Function 으로 돌렸어요(공유용 사용자 코드 격리).
//   이제 스크립트는 테마 창에서 보통 모듈로 돌고(src/scripts/plain/<id>.js), 그 모듈이 받는 `window` 가 이 대리예요.
//   - window.parent · top · self 는 대리 자신 → 스크립트의 `host = window.parent` · 「부모를 따라 올라가기」가 그대로 테마 창(대리)에서 멈춰요.
//   - setTimeout · requestAnimationFrame · requestIdleCallback · MutationObserver · ResizeObserver · IntersectionObserver · addEventListener 는
//     스크립트별 모음에 적어 두고, 끌 때 남은 것을 한 번에 정리해요(iframe 을 떼면 저절로 지워지던 것을 대신).
//   - setInterval 은 진짜 타이머를 만들지 않고 공용 스케줄러(scheduler.js) 일로 — 진짜 setInterval 은 모든 스크립트를 통틀어 하나예요.
//   - window.addEventListener('pagehide', …) 는 iframe 이 닫힐 때 부르던 정리 함수예요 → 끌 때 부르는 정리 목록으로.
//   - 그 밖의 이름(document · SillyTavern · TavernHelper · confirm …)은 진짜 창 그대로. 창의 기본 함수는 진짜 창에 묶어(bind) 돌려주고,
//     스크립트가 그 묶은 함수를 다시 창에 넣으면(예: confirm 되돌리기) 원래 함수로 바꿔 넣어 같은 것이 되게 해요.
//   - 콜백에서 난 오류는 스크립트별로 세고 콘솔에 남겨요(다른 스크립트 · 테마는 계속 돌아요).
import { every, cancel } from './scheduler.js';

const SELF_KEYS = new Set(['parent', 'top', 'self', 'window', 'frames', 'globalThis']);
const OBSERVERS = ['MutationObserver', 'ResizeObserver', 'IntersectionObserver'];
// 제 속성이 length · name 뿐인 함수만 묶어요 (창의 기본 함수). 속성을 품은 함수(NodeFilter 상수 등)는 묶으면 속성을 잃어요
const plainFunction = fn => Object.getOwnPropertyNames(fn).every(name => name === 'length' || name === 'name');

export function createRealm(id, { host = globalThis, onError = () => {} } = {}) {
    const timeouts = new Set(), frames = new Set(), idles = new Set(), intervals = new Set(), live = new Set(), listeners = [], hides = [];
    let made = 0;   // 만든 감시 객체 수(누계) — 살아 있는 것(observe 뒤 · disconnect 전)만 live 에 들고 있어요
    const errors = { count: 0, last: '' };
    let disposed = false;
    const fail = error => {
        errors.count++; errors.last = String(error?.message || error).slice(0, 140);
        console.error(`[Blue Lemonade] 내장 스크립트 ${id} 오류`, error);
        try { onError(error); } catch { /* 알림 실패는 무시 */ }
    };
    const guard = fn => typeof fn !== 'function' ? fn : function guarded(...args) { try { return fn.apply(this, args); } catch (error) { fail(error); return undefined; } };
    const watcher = name => {
        const Base = host[name];
        if (typeof Base !== 'function') return undefined;
        return class extends Base {
            constructor(callback, options) { super(guard(callback), options); made++; }
            observe(...args) { live.add(this); return super.observe(...args); }
            disconnect() { live.delete(this); return super.disconnect(); }
        };
    };
    const own = {
        setTimeout(fn, ms, ...args) {
            const handle = host.setTimeout(() => { timeouts.delete(handle); if (!disposed) guard(fn)(...args); }, ms);
            timeouts.add(handle); return handle;
        },
        clearTimeout(handle) { timeouts.delete(handle); host.clearTimeout(handle); },
        setInterval(fn, ms, ...args) {
            const handle = every(() => { if (!disposed) guard(fn)(...args); }, ms, { owner: id });
            intervals.add(handle); return handle;
        },
        clearInterval(handle) { if (intervals.delete(handle)) cancel(handle); },
        requestAnimationFrame(fn) {
            const handle = host.requestAnimationFrame(time => { frames.delete(handle); if (!disposed) guard(fn)(time); });
            frames.add(handle); return handle;
        },
        cancelAnimationFrame(handle) { frames.delete(handle); host.cancelAnimationFrame(handle); },
        requestIdleCallback(fn, options) {
            if (typeof host.requestIdleCallback !== 'function') return own.setTimeout(() => fn({ didTimeout: true, timeRemaining: () => 0 }), 1);
            const handle = host.requestIdleCallback(deadline => { idles.delete(handle); if (!disposed) guard(fn)(deadline); }, options);
            idles.add(handle); return handle;
        },
        cancelIdleCallback(handle) { if (idles.delete(handle)) host.cancelIdleCallback?.(handle); else own.clearTimeout(handle); },
        addEventListener(type, fn, options) {
            if (type === 'pagehide') { if (!hides.includes(fn)) hides.push(fn); return; }
            host.addEventListener(type, fn, options); listeners.push([type, fn, options]);
        },
        removeEventListener(type, fn, options) {
            if (type === 'pagehide') { const at = hides.indexOf(fn); if (at >= 0) hides.splice(at, 1); return; }
            host.removeEventListener(type, fn, options);
            const capture = typeof options === 'boolean' ? options : !!options?.capture;
            const at = listeners.findIndex(([t, f, o]) => t === type && f === fn && (typeof o === 'boolean' ? o : !!o?.capture) === capture);
            if (at >= 0) listeners.splice(at, 1);
        },
    };
    for (const name of OBSERVERS) { const Watcher = watcher(name); if (Watcher) own[name] = Watcher; }
    const bound = new Map(), originals = new WeakMap();
    const proxy = new Proxy(host, {
        get(target, key) {
            if (SELF_KEYS.has(key)) return proxy;
            if (Object.hasOwn(own, key)) return own[key];
            const value = Reflect.get(target, key);
            // 창의 기본 함수(getComputedStyle · confirm · queueMicrotask …)는 prototype 이 없어요 — 진짜 창에 묶어야 불려요.
            // 생성자 · jQuery 처럼 prototype 이 있는 함수는 그대로(속성 · new 가 그대로 돼요)
            //   NodeFilter 처럼 prototype 은 없어도 상수(SHOW_TEXT …)를 품은 것도 그대로 — 묶으면 상수가 사라져요(트리 훑기가 빈손이 됨)
            if (typeof value !== 'function' || value.prototype !== undefined || !plainFunction(value)) return value;
            let entry = bound.get(key);
            if (!entry || entry.fn !== value) { entry = { fn: value, wrap: value.bind(target) }; bound.set(key, entry); originals.set(entry.wrap, value); }
            return entry.wrap;
        },
        set(target, key, value) { target[key] = originals.get(value) ?? value; return true; },
    });
    return {
        window: proxy,
        /** 스크립트가 iframe 닫힘(pagehide)에 걸어 둔 정리 함수 */
        hides: () => [...hides],
        /** 끌 때: 남은 타이머 · 감시 · 창 리스너를 모두 정리 (스크립트 자기 정리 함수를 부른 뒤) */
        dispose() {
            disposed = true;
            for (const handle of timeouts) host.clearTimeout(handle);
            for (const handle of frames) host.cancelAnimationFrame(handle);
            for (const handle of idles) host.cancelIdleCallback?.(handle);
            for (const handle of intervals) cancel(handle);
            for (const observer of [...live]) { try { observer.disconnect(); } catch { /* 이미 끊김 */ } }
            for (const [type, fn, options] of listeners) host.removeEventListener(type, fn, options);
            timeouts.clear(); frames.clear(); idles.clear(); intervals.clear(); live.clear(); listeners.length = 0; hides.length = 0;
        },
        /** 진단 · 시험용: 지금 살아 있는 것 */
        stats: () => ({ observers: live.size, observersMade: made, intervals: intervals.size, timeouts: timeouts.size, frames: frames.size, idles: idles.size, listeners: listeners.length, errors: errors.count, lastError: errors.last }),
    };
}
