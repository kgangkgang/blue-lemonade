// 끊김 감시 — 스트림을 지켜보는 순수 로직 (브라우저 전역을 안 쓰고 env 로 받아서 Node 에서도 시험한다)
//
// 왜: 실리태번 1.19 서버(src/util.js forwardFetchResponse)는 중계 서버 쪽 스트림이 도중에 끊겨도 브라우저 응답을 끝내지 않는다.
// 브라우저는 조각이 더 안 오는 열린 연결을 붙잡고 '생성 중'으로 남아, 사용자가 멈춤을 눌러야 풀렸다.
// 그래서 답이 한 번 시작된 뒤 정해 둔 시간 동안 조각이 하나도 안 오면, 브라우저 쪽에서 연결이 끊긴 것과 똑같이
// 스트림을 오류로 끝낸다 → 실리태번의 onErrorStreaming (받은 글은 남기고 잠금을 푼다) · 다시 쓰기의 끊김 리롤이 평소대로 돈다.
// 1.1.0: 첫 글자까지 기다릴 최대 시간(기본 끔) — 요청을 보낸 뒤 그 시간 안에 첫 조각이 안 오면 끊는다.
//        응답 머리도 안 왔으면 요청 자체를 끊고(실리태번은 오류로 보고 잠금을 푼다), 머리만 왔으면 스트림을 오류로 끝낸다.
// 1.1.1: 받은 글이 있을 때는 오류가 아니라 끝으로 닫는다 (아래 [1.1.1] 설명 — 멈춤 단추와 같은 끝 처리).
// 1.1.2: 화면이 가려졌는지가 아니라 검사가 제때 돌았는지로 센다 — 배경 창(소리)으로 살아 있는 가려진 탭도 멈춘 답을 끊고,
//        얼었다 깬 탭의 밀린 틈은 세지 않는다 (아래 [1.1.2] 설명).

export const GENERATE_PATHS = [
    '/api/backends/chat-completions/generate',
    '/api/backends/text-completions/generate',
    '/api/backends/kobold/generate',
    '/api/novelai/generate',
];

export const STALL_NAME = 'StreamStalled';
export const IDLE_RANGE = [3, 300];   // 초. 설정 창은 10초부터 — 3초는 시험용
export const FIRST_RANGE = [3, 1800]; // 초. 0 = 끔. 설정 창은 30초부터

// [1.1.1] 받은 글이 있으면 오류가 아니라 "끝"으로 닫는다 (원래 요청은 끊는다).
// 오류로 끝내면 실리태번은 onErrorStreaming 으로 간다: 마지막으로 그린 뒤에 온 글(초당 streaming_fps 번만 그림)을 버리고,
// 스와이프 · 이어쓰기 · 사칭은 MESSAGE_RECEIVED 도 안 쏘고 저장도 안 한다 (다시 쓰기 · 번역 · 장기 기억이 안 돌고 파일 ≠ 메모리).
// 끝으로 닫으면 멈춤 단추와 같은 onFinishStreaming 이라 받은 글 전부를 남기고 모든 종류가 끝 처리 · 저장을 거친다.
// 멈춤과 다른 점: 실리태번의 abortController 는 그대로라, 다시 쓰기는 사용자가 멈춘 답으로 보지 않고 끊긴 씬 플랜을 리롤한다.
// 끊었다는 사실은 응답 객체의 streamWatchdog 에 남긴다 — 요청 로그가 이걸 보고 성공이 아닌 끊김으로 적는다.

export function pathOf(input, origin) {
    try {
        const raw = typeof input === 'string' ? input : (input instanceof URL ? input.href : String(input?.url ?? ''));
        return new URL(raw, origin).pathname;
    } catch {
        return '';
    }
}

/**
 * 스트리밍 생성 요청인가: POST · 생성 경로 · 문자열 본문 맨 위에 "stream":true.
 * 최상위 플래그를 확인한다. 프롬프트 문자열이나 중첩 객체의 stream 값은 감시 대상을 바꾸지 않는다.
 */
export function isStreamRequest(input, init, origin) {
    if (!init || typeof init.body !== 'string') return false;
    if (typeof input !== 'string' && !(input instanceof URL)) return false; // Request 객체는 본문을 못 보니 그대로 보낸다
    if (String(init.method ?? 'GET').toUpperCase() !== 'POST') return false;
    if (!GENERATE_PATHS.includes(pathOf(input, origin))) return false;
    try { return JSON.parse(init.body)?.stream === true; } catch { return false; }
}

export function clampIdle(seconds, fallback = 20) {
    const n = Number(seconds);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(IDLE_RANGE[1], Math.max(IDLE_RANGE[0], Math.round(n)));
}

/** 첫 글자 최대 대기: 0 이하 = 끔 */
export function clampFirst(seconds, fallback = 0) {
    const n = Number(seconds);
    if (!Number.isFinite(n)) return fallback;
    if (n <= 0) return 0;
    return Math.min(FIRST_RANGE[1], Math.max(FIRST_RANGE[0], Math.round(n)));
}

function stallError(message) {
    const error = new TypeError(message);
    error.name = STALL_NAME; // TypeError 그대로 두면 이름이 TypeError — 콘솔에서 구별되게
    return error;
}

const tickFor = (...limits) => Math.max(100, Math.min(1000, ...limits.filter(ms => ms > 0).map(ms => Math.floor(ms / 4))));

// [1.1.2] 틱 사이가 이보다 길면 그동안 페이지가 돌지 않은 것(탭이 얼었다 깸 · 긴 작업 · 1분 간격으로 조인 가려진 탭)이라 그 틈은 안 센다.
// 깨어난 뒤에는 쌓인 조각보다 타이머가 먼저 돌 수 있다. 제때 돈 틱은 가려져 있어도 센다 (가려진 탭도 1초 간격으로 돈다).
const maxGapFor = tickMs => Math.max(3000, tickMs * 3);

/**
 * 요청 전체를 감싼다: 첫 글자 최대 대기(firstMs > 0)면 응답 머리가 오기 전부터 시간을 센다 (페이지가 멈춰 있던 틈은 빼고).
 * 머리가 오면 watchResponse 가 이어서 센다.
 * @param {Promise<Response>} request 원래 fetch
 * @returns {Promise<Response>}
 */
export function watchRequest(request, { idleMs, firstMs = 0, abort, env }) {
    if (!(firstMs > 0)) return request.then(response => watchResponse(response, { idleMs, abort, env }));
    return new Promise((resolve, reject) => {
        let waited = 0;
        let last = env.now();
        let settled = false;
        const tickMs = tickFor(firstMs);
        const maxGap = maxGapFor(tickMs);
        const tick = () => {
            const now = env.now();
            if (now - last <= maxGap) waited += now - last;
            last = now;
        };
        const timer = env.setInterval(() => {
            if (settled) return;
            tick();
            if (waited < firstMs) return;
            settled = true;
            env.clearInterval(timer);
            const error = stallError(`Stream stalled: no response for ${Math.round(waited / 1000)}s`);
            try { abort(error); } catch { /* 무시 */ }
            try { env.onStall({ idleMs: waited, first: true }); } catch { /* 무시 */ }
            reject(error);
        }, tickMs);
        request.then((response) => {
            if (settled) return;
            settled = true;
            env.clearInterval(timer);
            tick();
            resolve(watchResponse(response, { idleMs, firstMs, firstWaited: waited, abort, env }));
        }, (error) => {
            if (settled) return;
            settled = true;
            env.clearInterval(timer);
            reject(error);
        });
    });
}

/**
 * 응답 본문을 감싼다. 첫 조각이 온 뒤, 조각을 기다리는 동안(읽기가 걸려 있는 동안)만 시간을 센다 —
 * 실리태번이 그리느라 바빠 읽기를 쉬는 동안(역압)은 세지 않고, 페이지가 멈춰 있던 틈(틱 사이가 maxGapFor 보다 김)이
 * 보이면 거기서 다시 센다 (폰이 탭을 얼렸다 깨우면 쌓인 조각보다 타이머가 먼저 돌 수 있다).
 * 첫 조각 전은 firstMs(> 0 일 때만)로 따로 센다 — firstWaited 는 응답 머리가 오기 전까지 이미 기다린 시간.
 *
 * @param {Response} response 원래 응답
 * @param {object} options
 * @param {number} options.idleMs 이만큼 조각이 안 오면 끊는다
 * @param {number} [options.firstMs] 첫 조각까지 최대 대기 (0 = 끔)
 * @param {number} [options.firstWaited] 머리가 오기 전까지 기다린 시간
 * @param {(error: Error) => void} options.abort 원래 요청 끊기 (fetch 신호)
 * @param {object} options.env { now, setInterval, clearInterval, onStall(info) }
 * @returns {Response} 감싼 응답. [1.1.1] 끊었으면 response.streamWatchdog = { stalled: true, error, first }
 */
export function watchResponse(response, { idleMs, firstMs = 0, firstWaited = 0, abort, env }) {
    if (!response?.ok || !response.body) return response;
    const contentType=response.headers.get('content-type')||'';
    if(contentType.includes('application/json'))return response;
    const sse=contentType.includes('text/event-stream'),decoder=sse?new TextDecoder():null;
    let pending='';
    const meaningful=value=>{
        if(typeof value==='string')return value.length>0;
        if(Array.isArray(value))return value.some(meaningful);
        if(!value||typeof value!=='object')return false;
        return Object.entries(value).some(([key,v])=>['content','text','reasoning','reasoning_content','thinking','token','completion','tool_calls','function_call','arguments','delta','choices','reasoning_details'].includes(key)&&meaningful(v));
    };
    function startsOutput(chunk){
        if(!sse)return true;
        pending+=decoder.decode(chunk,{stream:true});
        if(pending.length>65536){pending='';return true;}
        const lines=pending.split(/\r?\n/);pending=lines.pop();
        for(const line of lines){
            if(!line.startsWith('data:'))continue;
            const data=line.slice(5).trim();if(!data||data==='[DONE]')continue;
            try{if(meaningful(JSON.parse(data)))return true;}catch{return true;}
        }
        return false;
    }
    const reader = response.body.getReader();
    let controller = null;
    let started = false;   // 첫 조각이 왔는가 (그 전은 모델이 생각하는 시간이라 idleMs 로는 안 셈)
    let reading = false;   // 조각을 기다리는 중인가
    let finished = false;
    let last = env.now();
    let waitedFirst = firstWaited;
    const tickMs = tickFor(idleMs, firstMs);
    const maxGap = maxGapFor(tickMs);
    let lastTick = env.now();
    let timer = null;

    const stop = () => {
        finished = true;
        if (timer !== null) env.clearInterval(timer);
        timer = null;
    };

    /** [1.1.1] 끊었다는 표시 — 응답 객체에 붙여 요청 로그가 본다 */
    const stall = { stalled: false, error: null, first: false };

    const cut = (error, info) => {
        stop();
        stall.stalled = true;
        stall.error = error;
        stall.first = !!info.first;
        // 원래 요청부터 끊는다: 기다리던 읽기는 finished 라 조용히 끝나고, 실리태번 서버도 중계 연결을 닫는다
        try { abort(error); } catch { /* 무시 */ }
        reader.cancel(error).catch(() => {});
        if (started) {
            // [1.1.1] 받은 글이 있으면 "끝"으로 닫는다 — 큐에 남은 조각까지 다 넘어가고 실리태번은 onFinishStreaming 으로 간다
            try { controller.close(); } catch { /* 이미 닫힘 */ }
        } else {
            // 첫 조각도 없었으면 남길 글이 없다 — 예전처럼 오류 (실리태번이 만든 "..." 자리는 남을 수 있다)
            try { controller.error(error); } catch { /* 이미 닫힘 */ }
        }
        try { env.onStall(info); } catch { /* 알림 실패는 무시 */ }
    };

    const check = () => {
        if (finished) return;
        const now = env.now();
        // [1.1.2] 제때 돈 틱 = 페이지가 살아 있었다 (가려져 있어도). 틈이 길면 얼었다 깬 것 — 그 틈은 안 세고 여기서 다시 센다
        const gap = now - lastTick;
        const live = gap <= maxGap;
        lastTick = now;
        if (!started) {
            if (firstMs > 0 && live) waitedFirst += gap;
            last = now;
            if (firstMs > 0 && waitedFirst >= firstMs) cut(stallError(`Stream stalled: no first chunk for ${Math.round(waitedFirst / 1000)}s`), { idleMs: waitedFirst, first: true });
            return;
        }
        if (!reading || !live) {
            last = now;
            return;
        }
        const idle = now - last;
        if (idle < idleMs) return;
        cut(stallError(`Stream stalled: no data for ${Math.round(idle / 1000)}s`), { idleMs: idle });
    };

    const stream = new ReadableStream({
        start(c) {
            controller = c;
            timer = env.setInterval(check, tickMs);
        },
        async pull(c) {
            if (finished) return; // [1.1.1] 끊은 뒤 — 끊긴 원래 본문은 더 읽지 않는다
            reading = true;
            last = env.now();
            let result;
            try {
                result = await reader.read();
            } catch (error) {
                reading = false;
                if (!finished) {
                    stop();
                    c.error(error);
                }
                return;
            }
            reading = false;
            if (finished) return;
            if (result.done) {
                stop();
                c.close();
                return;
            }
            started ||= startsOutput(result.value);
            last = env.now();
            c.enqueue(result.value);
        },
        cancel(reason) {
            stop();
            return reader.cancel(reason);
        },
    });

    const wrapped = new Response(stream, { status: response.status, statusText: response.statusText, headers: response.headers });
    Object.defineProperty(wrapped, 'streamWatchdog', { value: stall, enumerable: false });
    return wrapped;
}
