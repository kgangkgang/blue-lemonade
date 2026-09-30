// 애드온 사용 여부는 메모리에만 둔다. lemon_voice.enabled와 사용자 설정은 바꾸지 않는다.
let enabled = true;
const controllers = new Set();
export const runtimeEnabled = () => enabled;
export const stoppedError = () => new DOMException('TTS 애드온이 꺼져 있어요', 'AbortError');
export function assertRuntime() { if (!enabled) throw stoppedError(); }
export function setRuntimeEnabled(on) {
    enabled = !!on;
    if (!enabled) for (const ctrl of [...controllers]) ctrl.abort(stoppedError());
}
export function trackController(ctrl) {
    assertRuntime(); controllers.add(ctrl);
    return () => controllers.delete(ctrl);
}
// 실리태번의 generateRaw는 호출자 signal을 받지 않는다. 늦은 응답은 버리고 기다림만 끝낸다.
export async function waitForRuntime(work, signal) {
    assertRuntime();
    const ctrl = new AbortController(), release = trackController(ctrl);
    const abort = () => ctrl.abort(signal?.reason || stoppedError());
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    let rejectAbort;
    const stopped = new Promise((_, reject) => { rejectAbort = () => reject(ctrl.signal.reason || stoppedError()); ctrl.signal.addEventListener('abort', rejectAbort, { once: true }); });
    try { if (ctrl.signal.aborted) throw ctrl.signal.reason; return await Promise.race([Promise.resolve().then(() => { assertRuntime(); if (ctrl.signal.aborted) throw ctrl.signal.reason; return work(); }), stopped]); }
    finally { signal?.removeEventListener('abort', abort); ctrl.signal.removeEventListener('abort', rejectAbort); release(); }
}
