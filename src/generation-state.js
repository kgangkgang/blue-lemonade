// 6.5.2 생성 상태 — 테마 애드온이 「생성 중」을 판정하는 한 곳 (순수 함수: DOM · 실리태번 없음, tools/tests/generation-state.mjs 가 검사한다. 배선은 main-chat-rules.js).
// 본채팅 생성(Generate 의 type 이 normal · regenerate · swipe · continue, 드라이런 아님)만 생성 중으로 본다.
//   · 조용한 생성(quiet · impersonate · 드라이런 · generateRaw) · 실리태번 헬퍼의 generate(js_generation_*) 는 생성 중이 아니다 — 헬퍼 · 다른 확장이 답 뒤에 돌리는 생성이
//     실리태번의 is_send_press · body[data-generating] 을 켜도 다시 쓰기 · 번역 · 에셋이 「생성 중」이라고 물러서지 않게 (과일 프리셋 호환, 세션3 10-15).
//   · 테마 자신의 붙잡음(다시 쓰기 holdGeneration · 에셋 holdSendState)은 hold() 로 따로 센다 — 「생성 중」은 아니지만 「끝나길 기다릴 것」 (whenIdle 의 holds).
// 실리태번 신호의 모양 (1.19): GENERATION_STARTED(type, options, dryRun) · GENERATION_ENDED(chat.length) — hideStopButton 이 멈춤 단추를 숨길 때마다 (조용한 생성의 끝에도) ·
//   GENERATION_STOPPED() — 사용자의 멈춤(stopGeneration). 실리태번 헬퍼 4.x 는 제 생성을 멈출 때 GENERATION_STOPPED(생성 id 문자열) 을 같은 이름으로 낸다 → 문자열 인수 = 헬퍼.
// 끝 신호가 안 오는 길(슬래시 명령으로 끊긴 Generate 등)이 있어 창은 실리태번의 isGenerating()(is_send_press · 그룹 생성)과 맞춰 본다: 창이 열려 있어도 실리태번이 쉬고 있다면 쉬는 것.
export const MAIN_TYPES = Object.freeze(['normal', 'regenerate', 'swipe', 'continue']);
export const MAIN_TTL = 10 * 60 * 1000;   // 끝 신호 없이 창이 남는 최대 시간

/** 스트리밍 처리기가 아직 글을 받는 중인가 (끝 · 멈춤 · 끊김은 아님) */
export const processorLive = processor => !!processor && !processor.isFinished && !processor.isStopped;

/**
 * @param {{ now?: () => number, setTimer?: Function, clearTimer?: Function, setTick?: Function, clearTick?: Function }} [env] 시계 · 타이머 (시험용)
 */
export function createGenerationState({ now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout, setTick = setInterval, clearTick = clearInterval } = {}) {
    let main = null;            // { type, at } — 열린 본채팅 생성 창
    const holds = new Map();    // 테마의 붙잡음 이름 → 수
    const listeners = new Set();
    const notify = () => { for (const fn of [...listeners]) { try { fn(); } catch { /* 듣는 쪽 오류는 상태와 상관없음 */ } } };
    const helperArg = arg => typeof arg === 'string' && arg !== '';   // 헬퍼의 GENERATION_STOPPED(생성 id)
    const state = {
        /** GENERATION_STARTED — 본채팅 type 이고 드라이런이 아니면 창을 연다. @returns {boolean} 열었나 */
        started(type, dryRun) {
            if (dryRun || !MAIN_TYPES.includes(String(type ?? ''))) return false;
            main = { type: String(type), at: now() };
            notify();
            return true;
        },
        /** GENERATION_ENDED · GENERATION_STOPPED — 헬퍼의 멈춤(문자열 id)은 이 창의 끝이 아니다. @returns {boolean} 닫았나 */
        ended(arg) {
            if (helperArg(arg) || !main) return false;
            main = null;
            notify();
            return true;
        },
        /** 실리태번 헬퍼가 제 생성을 멈출 때 내는 신호인가 (GENERATION_STOPPED 의 첫 인수) */
        isHelperStop: helperArg,
        /**
         * 본채팅 생성 중인가. processor = 실리태번 streamingProcessor (스트림이 살아 있으면 창과 상관없이 참),
         * generating = 실리태번 isGenerating() (false 면 창이 열려 있어도 거짓 — 끝 신호가 안 온 길; undefined 면 창만 본다)
         */
        mainGenerating({ processor = null, generating } = {}) {
            if (processorLive(processor)) return true;
            if (!main || now() - main.at >= MAIN_TTL) { if (main) main = null; return false; }
            return generating !== false;
        },
        /** 테마의 붙잡음을 등록한다. @returns {() => void} 풀기 (여러 번 불러도 한 번만) */
        hold(name = 'theme') {
            const key = String(name);
            holds.set(key, (holds.get(key) || 0) + 1);
            notify();
            let done = false;
            return () => {
                if (done) return;
                done = true;
                const left = (holds.get(key) || 1) - 1;
                if (left <= 0) holds.delete(key); else holds.set(key, left);
                notify();
            };
        },
        /** 붙잡고 있나 (이름을 주면 그 붙잡음만) */
        holding(name) { return name === undefined ? holds.size > 0 : (holds.get(String(name)) || 0) > 0; },
        /** 지금 물러설 까닭: 'main'(본채팅 생성 중) · 'hold'(테마가 붙잡음) · ''(없음 — 조용한 생성 · 헬퍼 생성은 까닭이 아니다) */
        lockReason(env = {}) { return this.mainGenerating(env) ? 'main' : holds.size ? 'hold' : ''; },
        onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        /**
         * 본채팅 생성(과 holds 가 참이면 테마의 붙잡음)이 끝나고 quietMs 동안 그대로이면 true · maxMs 안에 못 끝나면 false.
         * processor · generating 은 함수 (부를 때마다 실리태번의 지금 값). 상태 바뀜(onChange)과 tickMs 마다 다시 본다 (스트림 처리기는 신호가 없다).
         */
        whenIdle({ quietMs = 300, maxMs = MAIN_TTL, holds: waitHolds = true, processor = () => null, generating = () => undefined, tickMs = 250 } = {}) {
            return new Promise(resolve => {
                let quiet = null, finished = false;
                const busy = () => state.mainGenerating({ processor: processor(), generating: generating() }) || (waitHolds && holds.size > 0);
                const stop = () => { off(); clearTimer(quiet); clearTimer(deadline); clearTick(tick); };
                const finish = value => { if (finished) return; finished = true; stop(); resolve(value); };
                const check = () => {
                    if (finished) return;
                    if (busy()) { if (quiet !== null) { clearTimer(quiet); quiet = null; } return; }
                    if (quiet === null) quiet = setTimer(() => finish(true), quietMs);
                };
                const off = state.onChange(check);
                const deadline = setTimer(() => finish(false), maxMs);
                const tick = setTick(check, tickMs);
                check();
            });
        },
        get snapshot() { return { main: main ? { ...main } : null, holds: Object.fromEntries(holds) }; },
    };
    return state;
}
