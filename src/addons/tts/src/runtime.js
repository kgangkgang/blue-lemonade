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
// 7.7.4 timeoutMs: 그만큼 지나도 답이 없으면 timeoutError() 로 끝낸다 — 서버가 연결을 붙잡고 답을 안 주면 전엔 끝없이 기다려
//       대사 분석 줄(한 번에 하나)에 선 뒤 분석이 모두 멈췄다
export async function waitForRuntime(work, signal, { timeoutMs = 0, timeoutError = null } = {}) {
    assertRuntime();
    const ctrl = new AbortController(), release = trackController(ctrl);
    const abort = () => ctrl.abort(signal?.reason || stoppedError());
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    const timer = timeoutMs > 0 ? setTimeout(() => ctrl.abort(timeoutError?.() || new Error(`${Math.round(timeoutMs / 1000)}초 안에 답이 오지 않았어요`)), timeoutMs) : 0;
    let rejectAbort;
    const stopped = new Promise((_, reject) => { rejectAbort = () => reject(ctrl.signal.reason || stoppedError()); ctrl.signal.addEventListener('abort', rejectAbort, { once: true }); });
    try { if (ctrl.signal.aborted) throw ctrl.signal.reason; return await Promise.race([Promise.resolve().then(() => { assertRuntime(); if (ctrl.signal.aborted) throw ctrl.signal.reason; return work(); }), stopped]); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); ctrl.signal.removeEventListener('abort', rejectAbort); release(); }
}
