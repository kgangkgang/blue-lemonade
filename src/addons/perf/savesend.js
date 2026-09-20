// 성능 보조 — 큰 저장은 뒤에서 보내기
//
// 채팅 저장(/api/chats/save, /api/chats/group/save)과 설정 저장(/api/settings/save)은 수 MB 짜리 JSON 문자열을 fetch 로 보낸다.
// fetch(…, { body: 문자열 }) 호출은 메인 스레드에서 본문을 UTF-8 로 인코딩하고 네트워크 쪽으로 복사하느라 그 자리에서 오래 걸린다
// (7 MB 채팅, 폰 흉내 4× CPU 에서 저장 한 번에 ~120 ms — JSON.stringify 와 별도). 한 턴에 저장이 5번쯤이다.
// 이 모듈은 그런 요청만 워커로 넘긴다: 워커가 같은 주소 · 머리 · 본문으로 fetch 하고 응답을 돌려주면 Response 를 만들어 돌려준다.
// 메인 스레드에 남는 일은 문자열을 워커로 넘기는 복사 한 번.
//
// 안전장치
// - 같은 출처 · POST · 문자열 본문 · 정한 길이 이상 · keepalive 아님 · 경로가 위 셋일 때만. 나머지는 원래 fetch.
// - 켤 때 워커와 메인에서 /api/ping 을 같은 머리로 보내 상태가 같아야 쓴다 (로그인 · CSRF · 쿠키가 워커에서도 똑같이 통하는지).
// - 멈춤 신호(signal)는 워커의 요청까지 끊고, 원래 fetch 처럼 signal.reason 으로 거부한다.
// - 워커가 죽으면(error) 보내던 요청은 원래 fetch 로 다시 보내고, 이후로는 쓰지 않는다.
// - [1.0.1] 워커가 아무 말 없이 멈추면(error 도 없이) 저장이 영영 끝나지 않아 실리태번의 isChatSaving 이 계속 참이었다 (재현: 뒤따른 저장이
//   모두 1초 뒤 버려짐). 답을 기다린 지 8초(보이는 시간)면 워커에 살아 있는지 묻고 4초 안에 대답이 없으면, 또는 워커가 살아 있어도 한 요청이
//   2분을 넘으면 — 워커의 요청을 끊고 워커를 닫고 그 저장을 실패로 돌려준다(실리태번의 저장 실패 알림 · 다음 저장이 새 내용을 싣는다).
//   같은 본문을 다시 보내지 않는다(서버에 늦게 닿은 옛 본문이 새 저장을 덮지 않게). 그 뒤 저장은 원래 fetch 로 보낸다.

export const SAVE_PATHS = Object.freeze(['/api/chats/save', '/api/chats/group/save', '/api/settings/save']);
export const MIN_CHARS = 100_000;
const NULL_BODY_STATUS = new Set([101, 103, 204, 205, 304]);

export function pathOf(input, origin) {
    try {
        const url = new URL(String(input), origin);
        if (url.origin !== origin) return '';
        return url.pathname;
    } catch {
        return '';
    }
}

/** 워커로 보낼 요청인가 */
export function eligible(input, init, origin, minChars = MIN_CHARS) {
    if (!init || typeof init.body !== 'string' || init.body.length < minChars) return false;
    if (typeof input !== 'string' && !(input instanceof URL)) return false; // Request 객체는 그대로
    if (String(init.method ?? 'GET').toUpperCase() !== 'POST') return false;
    if (init.keepalive) return false;
    if (init.signal != null && (typeof init.signal.aborted !== 'boolean' || typeof init.signal.addEventListener !== 'function')) return false;
    return SAVE_PATHS.includes(pathOf(input, origin));
}

/** fetch init 에서 워커로 넘길 수 있는 부분만 (머리는 [이름, 값] 목록으로) */
export function portableInit(init, HeadersCtor) {
    const out = { method: 'POST', body: init.body, headers: [] };
    if (init.headers != null) out.headers = [...new HeadersCtor(init.headers)];
    for (const key of ['cache', 'credentials', 'mode', 'redirect', 'referrerPolicy', 'integrity', 'priority']) {
        if (init[key] !== undefined) out[key] = init[key];
    }
    return out;
}

/**
 * @param {object} env
 * @param {(input: any, init?: any) => Promise<Response>} env.nativeFetch
 * @param {() => { postMessage: Function, addEventListener: Function, terminate?: Function }} env.createWorker
 * @param {string} env.origin
 * @param {() => boolean} env.enabled
 * @param {typeof Response} env.Response
 * @param {typeof Headers} env.Headers
 * @param {() => Record<string, string>} [env.testHeaders] 켤 때 /api/ping 시험에 쓸 머리
 * @param {number} [env.minChars]
 * @param {(reason: string) => void} [env.onDisabled]
 */
/** [1.0.1] 멈춘 워커 알아보기 — 시간은 페이지가 보이는 동안만 센다 (폰에서 앱을 내리면 타이머가 멈췄다 한꺼번에 돈다) */
export const WATCH_DEFAULTS = Object.freeze({
    tickMs: 1000,
    pingAfterMs: 8000, // 답을 이만큼 기다리면 워커에 살아 있는지 묻는다 (그 뒤에도 기다리는 동안 이 간격으로)
    pongWithinMs: 4000, // 물은 뒤 이만큼 대답이 없으면 워커가 멈춘 것
    maxMs: 120000, // 워커가 살아 있어도 요청 하나를 이보다 오래 붙잡지 않는다
});

/**
 * @param {object} env (아래 env.* 외에)
 * @param {() => number} [env.now]
 * @param {(fn: Function, ms: number) => any} [env.setTimer]
 * @param {(id: any) => void} [env.clearTimer]
 * @param {() => boolean} [env.hidden] 페이지가 가려졌는지
 * @param {Partial<typeof WATCH_DEFAULTS>} [options]
 */
export function createSaveSender(env, options = {}) {
    const stats = { sent: 0, native: 0, resent: 0, failed: 0, timedOut: 0 };
    const watchOptions = { ...WATCH_DEFAULTS, ...options };
    const now = env.now ?? (() => performance.now());
    const setTimer = env.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = env.clearTimer ?? (id => clearTimeout(id));
    const hidden = env.hidden ?? (() => false);
    /** 보이는 동안 흐른 시간 (ms) */
    let visible = 0;
    let lastTick = 0;
    let watchTimer = null;
    /** 대답을 기다리는 물음 { at } · 마지막으로 물은 때 */
    let ping = null;
    let lastAsk = -Infinity;
    const pending = new Map(); // id → { resolve, reject, input, init, signal, onAbort }
    let worker = null;
    let state = 'off'; // off | starting | ready | broken
    let reason = '';
    let seq = 0;
    let readyPromise = null;

    function settle(id) {
        const p = pending.get(id);
        if (!p) return null;
        pending.delete(id);
        if (p.signal && p.onAbort) p.signal.removeEventListener('abort', p.onAbort);
        return p;
    }

    function stopWatch() {
        if (watchTimer !== null) clearTimer(watchTimer);
        watchTimer = null;
        ping = null;
    }

    /** 기다리는 요청이 있는 동안만 돈다 */
    function watch() {
        if (watchTimer !== null || state === 'broken') return;
        lastTick = now();
        watchTimer = setTimer(tick, watchOptions.tickMs);
    }

    function tick() {
        watchTimer = null;
        if (!pending.size || state === 'broken') {
            ping = null;
            return;
        }
        const t = now();
        // 가려졌다 돌아오면 멈췄던 시간이 한 번에 들어온다 — 한 틱에 두 간격까지만 센다
        if (!hidden()) visible += Math.min(Math.max(0, t - lastTick), watchOptions.tickMs * 2);
        lastTick = t;
        let oldest = Infinity;
        for (const p of pending.values()) oldest = Math.min(oldest, p.since ?? visible);
        const waited = visible - oldest;
        if (waited >= watchOptions.maxMs) return giveUp('저장 응답이 너무 늦음');
        if (ping && visible - ping.at >= watchOptions.pongWithinMs) return giveUp('워커 응답 없음');
        if (!ping && waited >= watchOptions.pingAfterMs && visible - lastAsk >= watchOptions.pingAfterMs) {
            ping = { at: visible };
            lastAsk = visible;
            try {
                worker?.postMessage({ type: 'ping' });
            } catch {
                return giveUp('워커 응답 없음');
            }
        }
        watchTimer = setTimer(tick, watchOptions.tickMs);
    }

    /** [1.0.1] 멈춘 워커: 요청을 끊고 워커를 닫고, 기다리던 요청은 실패로 돌려준다 (다시 보내지 않는다) */
    function giveUp(why) {
        if (state === 'broken') return;
        state = 'broken';
        reason = why;
        stopWatch();
        const ids = [...pending.keys()];
        for (const id of ids) {
            try { worker?.postMessage({ type: 'abort', id }); } catch { /* */ }
        }
        try { worker?.terminate?.(); } catch { /* */ }
        worker = null;
        for (const id of ids) {
            const p = settle(id);
            if (!p) continue;
            stats.failed++;
            stats.timedOut++;
            p.reject(new TypeError(`Failed to fetch (${why})`));
        }
        try { env.onDisabled?.(why); } catch { /* */ }
    }

    function breakDown(why) {
        if (state === 'broken') return;
        state = 'broken';
        reason = why;
        stopWatch();
        try { worker?.terminate?.(); } catch { /* */ }
        worker = null;
        // 보내던 요청은 원래 fetch 로 다시
        for (const id of [...pending.keys()]) {
            const p = settle(id);
            if (!p) continue;
            stats.resent++;
            env.nativeFetch(p.input, p.init).then(p.resolve, p.reject);
        }
        try { env.onDisabled?.(why); } catch { /* */ }
    }

    function onMessage(event) {
        const msg = event?.data || {};
        if (msg.type === 'pong') {
            ping = null;
            return;
        }
        if (msg.type === 'done') {
            const p = settle(msg.id);
            if (!p) return;
            try {
                const body = NULL_BODY_STATUS.has(msg.status) ? null : msg.body;
                p.resolve(new env.Response(body, { status: msg.status, statusText: msg.statusText, headers: msg.headers }));
            } catch (error) {
                p.reject(error);
            }
        } else if (msg.type === 'fail') {
            const p = settle(msg.id);
            if (!p) return;
            stats.failed++;
            if (msg.name === 'AbortError' && p.signal?.aborted) p.reject(p.signal.reason);
            else p.reject(new TypeError(msg.message || 'Failed to fetch'));
        }
    }

    function viaWorker(input, init) {
        const signal = init.signal ?? null;
        if (signal?.aborted) return Promise.reject(signal.reason);
        const id = ++seq;
        const url = new URL(String(input), env.origin).href;
        const portable = portableInit(init, env.Headers);
        return new Promise((resolve, reject) => {
            const entry = { resolve, reject, input, init, signal, onAbort: null, since: visible };
            if (signal) {
                entry.onAbort = () => {
                    const p = settle(id);
                    if (!p) return;
                    try { worker?.postMessage({ type: 'abort', id }); } catch { /* */ }
                    p.reject(signal.reason);
                };
                signal.addEventListener('abort', entry.onAbort, { once: true });
            }
            pending.set(id, entry);
            watch();
            try {
                worker.postMessage({ type: 'send', id, url, init: portable });
                stats.sent++;
            } catch (error) {
                settle(id);
                stats.native++;
                env.nativeFetch(input, init).then(resolve, reject);
            }
        });
    }

    /** 워커를 띄우고 /api/ping 을 워커 · 메인에서 한 번씩 보내 결과가 같은지 본다 */
    function start() {
        if (readyPromise) return readyPromise;
        readyPromise = (async () => {
            state = 'starting';
            try {
                worker = env.createWorker();
            } catch (error) {
                breakDown('워커를 만들 수 없음');
                return false;
            }
            worker.addEventListener('message', onMessage);
            worker.addEventListener('error', () => breakDown('워커 오류'));
            const headers = env.testHeaders?.() ?? {};
            try {
                const [mine, theirs] = await Promise.all([
                    new Promise((resolve, reject) => {
                        const id = ++seq;
                        pending.set(id, { resolve, reject, input: '/api/ping', init: { method: 'POST', headers }, signal: null, onAbort: null, since: visible });
                        watch();
                        worker.postMessage({ type: 'send', id, url: new URL('/api/ping', env.origin).href, init: { method: 'POST', headers: [...new env.Headers(headers)] } });
                    }),
                    env.nativeFetch('/api/ping', { method: 'POST', headers }),
                ]);
                if (state === 'broken') return false;
                if (mine.status !== theirs.status || !theirs.ok) {
                    breakDown(`시험 응답이 다름 (${mine.status} / ${theirs.status})`);
                    return false;
                }
            } catch (error) {
                breakDown('시험 요청 실패');
                return false;
            }
            state = 'ready';
            return true;
        })();
        return readyPromise;
    }

    /** window.fetch 자리에 둘 함수가 부르는 곳 */
    function send(input, init) {
        if (state === 'ready' && env.enabled() && eligible(input, init, env.origin, env.minChars ?? MIN_CHARS)) {
            return viaWorker(input, init);
        }
        return env.nativeFetch(input, init);
    }

    return { start, send, stats, state: () => state, reason: () => reason, pending: () => pending.size };
}
