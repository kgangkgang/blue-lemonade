// 성능 보조 · 점검 도구의 「최근 오류」 고리 (2026-10-31 따로 깔던 런처 확장에서 옮김). 시작할 때 한 번 건다(가볍다): window error · unhandledrejection · console.error 감싸기.
// 글은 이 페이지 메모리에만 30개(가린 글은 보일 때 · 복사할 때 다시 가린다). 어디로도 보내지 않고, 네트워크는 보지 않는다. 두 번 걸리지 않게 전역 한 벌.
import { ERRORS_KEY, createErrorRing, errorSource } from './core.js';

const WRAP = Symbol.for('blue-lemonade.console-error.wrap'), WRAP_OWNER = 'blue-lemonade';
const textOf = v => {
    try {
        if (v instanceof Error) return `${v.name}: ${v.message}\n${String(v.stack || '').split('\n').slice(1, 4).join('\n')}`;
        if (typeof v === 'string') return v;
        if (v && typeof v === 'object') return v.message ? String(v.message) : `[${v.constructor?.name || 'object'}]`;   // 남의 큰 객체는 글로 풀지 않는다
        return String(v);
    } catch { return '[읽을 수 없는 값]'; }
};
export function installErrorRing(g = globalThis) {
    if (g[ERRORS_KEY]) return g[ERRORS_KEY];
    const ring = createErrorRing(30);
    const add = (kind, parts) => {
        try {
            const text = parts.map(textOf).join(' ').slice(0, 1200);
            if (!text.trim()) return;
            ring.push({ at: Date.now(), kind, text, source: errorSource(text) });
        } catch { /* 고리가 오류를 만들지 않게 */ }
    };
    const api = Object.freeze({ list: () => ring.list(), clear: () => ring.clear(), get dropped() { return ring.dropped; }, limit: ring.limit });
    g[ERRORS_KEY] = api;
    try {
        g.addEventListener?.('error', e => add('오류', [e.error || e.message || '오류', e.filename ? `@ ${e.filename}:${e.lineno}` : '']));
        g.addEventListener?.('unhandledrejection', e => add('거부', [e.reason ?? '처리 안 된 거부']));
        // 1.0.9 사슬 감싸기 · 내가 감싼 것은 다시 안 감쌈
        const original = g.console?.error;
        if (typeof original === 'function' && original[WRAP] !== WRAP_OWNER) {
            const wrapped = function (...args) { add('console', args); return original.apply(this, args); };
            wrapped[WRAP] = WRAP_OWNER;
            g.console.error = wrapped;
        }
    } catch { /* 듣기를 못 걸면 고리는 빈 채로 */ }
    return api;
}
