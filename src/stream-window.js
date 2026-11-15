// 1.5.1 opt-stream 「답이 흘러드는 중」 한 곳 — body[data-generating] 이 켜져 있거나, 답장 토큰(STREAM_TOKEN_RECEIVED)이 TOKEN_QUIET_MS 안에 왔으면 참.
// 왜: 메시지 꾸미기(조판 · 색) · 네모 단추 · 그림 줄바꿈 정리는 「답이 오는 동안은 그 메시지를 걸음마다 다시 보지 않고 끝날 때 한 번」으로 짜여 있는데,
//   그 판정을 body[data-generating] 하나로만 했어요. 실리태번 본채팅 생성은 그 표식을 켜지만, 표식 없이 토큰만 흘리는 스트림(다른 확장 · 성능 관문 장면)에서는
//   토큰마다 다시 훑었어요. 긴 채팅 가볍게(chat-light.js STREAM_QUIET_MS)가 이미 토큰 간격으로 같은 일을 해요 — 그 판정을 여럿이 나눠 쓰게 꺼냈어요.
// 끝: 표식이 빠지거나(감시 허브 구독 · 그대로 각 모듈이 봐요) 토큰이 TOKEN_QUIET_MS 동안 끊기면 onStreamQuiet 구독을 불러요 — 미뤄 둔 일을 그때 한 번.
// 실제 생성(표식 켬)에서는 예전과 같아요: 표식이 켜진 동안은 참이고, 끝 알림은 표식이 빠질 때 각 모듈의 원래 길이 그대로 돌아요(이 알림은 한 번 더 와도 할 일이 없어요).
export const TOKEN_QUIET_MS = 1000;

let lastToken = -Infinity, timer = 0, wired = null;   // wired = [eventSource, [[이름, 함수]…]]
const quiet = new Set();
const now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

function wire() {
    if (wired) return;
    wired = [null, []];
    try {
        const ctx = globalThis.SillyTavern?.getContext?.(); const es = ctx?.eventSource, T = ctx?.eventTypes || ctx?.event_types;
        if (!es?.on || !T) return;
        wired[0] = es;
        const on = (name, fn) => { if (T[name]) { es.on(T[name], fn); wired[1].push([T[name], fn]); } };
        on('STREAM_TOKEN_RECEIVED', noteToken);
        // 끝 신호가 오면 토큰 창을 바로 닫아요 — 실리태번은 GENERATION_ENDED 를 표식 지우기(activateSendButtons) 바로 앞, 같은 작업 안에서 내요(hideStopButton).
        //   그래서 표식이 빠질 때 각 모듈의 끝 처리가 예전과 같은 때에 돌아요(최근 토큰 때문에 1초 늦지 않게)
        for (const name of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_CHANGED']) on(name, noteEnd);
    } catch { /* 실리태번 문맥이 없으면(시험) 표식만 봐요 */ }
}
// 끝 알림 구독이 모두 끊기면 듣기도 떼요(메시지 꾸미기를 멈추면 리스너가 처음과 같게). 판정만 묻는 쪽은 다음에 물을 때 다시 걸어요
function unwire() {
    if (!wired) return;
    const [es, list] = wired; wired = null; lastToken = -Infinity;
    if (timer) { clearTimeout(timer); timer = 0; }
    for (const [name, fn] of list) { try { (es.removeListener || es.off)?.call(es, name, fn); } catch { /* 없음 */ } }
}
/** 끝 신호 — 토큰 창을 닫고, 표식이 이미 없으면(표식 없는 스트림) 끝 알림을 지금 */
export function noteEnd() {
    const was = lastToken !== -Infinity;
    lastToken = -Infinity;
    if (timer) { clearTimeout(timer); timer = 0; }
    if (was && !generatingMark()) fire();
}
function fire() { for (const fn of [...quiet]) { try { fn(); } catch (error) { console.warn('[Blue Lemonade] 스트림 끝 알림', error); } } }
/** 토큰 하나 — 시각만 적고 끝 타이머는 하나만(토큰마다 다시 걸지 않아요) */
export function noteToken() {
    lastToken = now();
    if (!timer) timer = setTimeout(check, TOKEN_QUIET_MS);
}
function check() {
    timer = 0;
    const left = TOKEN_QUIET_MS - (now() - lastToken);
    if (left > 0) { timer = setTimeout(check, left); return; }
    if (generatingMark()) return;   // 표식이 켜진 생성 — 끝은 표식이 빠질 때 각 모듈이 봐요
    fire();
}
const generatingMark = (doc = globalThis.document) => doc?.body?.dataset?.generating === 'true';
/** 답이 흘러드는 중인가(표식 또는 최근 토큰) */
export function streamingNow(doc = globalThis.document) {
    wire();
    return generatingMark(doc) || now() - lastToken < TOKEN_QUIET_MS;
}
/**
 * 설정 저장(SETTINGS_UPDATED) 뒤 맞추기처럼 「답이 오는 동안은 해 봐야 소용없는」 일을 미뤄요: 지금 답이 흘러드는 중이 아니면 바로 fn,
 * 흘러드는 중이면 retryMs 뒤 다시 봐요(끝날 때까지). 돌려주는 값을 타이머 자리에 넣고 부르면 돼요 · .cancel() 로 기다리던 것을 버려요.
 * 1.5.1 실제 폰 추적: 생성 35초 동안 설정 저장이 35번 났고(과일 프리셋 스크립트의 고리) 그때마다 프롬프트 연동 정규식 · 프롬프트 귀속 맞추기가 돌아 테마 몫 1,738ms 중 약 870ms 였어요.
 */
export function whenNotStreaming(fn, retryMs = 1000) {
    let t = 0;
    const run = () => { t = 0; if (streamingNow()) { t = setTimeout(run, retryMs); return; } fn(); };
    run.cancel = () => { if (t) clearTimeout(t); t = 0; };
    return run;
}
/** 토큰이 끊겨(표식 없는 스트림) 조용해지면 부를 함수 — 돌려주는 값으로 끊어요 */
export function onStreamQuiet(fn) {
    wire();
    quiet.add(fn);
    return () => { quiet.delete(fn); if (!quiet.size) unwire(); };
}
/** 시험용 */
export const _streamWindow = { reset() { quiet.clear(); unwire(); }, state: () => ({ lastToken, timer: !!timer, subs: quiet.size }) };
