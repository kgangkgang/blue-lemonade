// 5.8.0 본채팅 요청에도 Claude 5 세대 규칙.
// 실리태번 본체(1.19.0, chat-completions.js isClaude5Model = /claude-(opus-5|sonnet-5)/)가 2026-10-07 에 나온 claude-haiku-5-5 를
// Claude 5 로 알아보지 못해 온도 · top_p · top_k 를 그대로 보내고, Claude 5 세대는 기본값이 아닌 샘플링 값을 받지 않는다(오류).
// 보내기 직전(CHAT_COMPLETION_SETTINGS_READY)에 Claude 5 이후 모델이면 샘플링 값만 뺀다 — 테마의 다른 기능(번역 · 다시 쓰기 · TTS)이
// 쓰는 live-models.js 규칙과 같은 판단. 본체가 이미 빼는 모델(opus-5 · sonnet-5 · fable)은 결과가 같고, Claude 5 가 아닌 모델은 그대로.
// 다시 쓰기 리롤(reroll.js)은 같은 요청 객체를 잡아 두므로 처리 순서와 상관없이 같은 값으로 다시 보낸다.
import { isClaude5Plus } from './claude-gen.js';   // live-models.js 와 같은 판단 (그 파일은 맨 위 await 가 있어 시작 순서를 막지 않게 따로 받는다)
import { mainGoogleBody, isGenerateRequest, createMainGate, stackOrigin, HELPER_EVENTS, tallyOf, finishNotice, NOTICES } from './main-chat-finish.js';   // 6.4.x Google 답의 끝 이유 알림 (v3 본채팅 문지기)
import { createGenerationState } from './generation-state.js';   // 6.5.3 생성 상태 — 애드온 공용 「생성 중」 판정 (본채팅 생성만)

const SAMPLING = ['temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty'];

/** 보낼 요청(generate_data)을 그 자리에서 고친다. @returns {string[]} 뺀 키 */
export function stripClaude5Sampling(data) {
    if (!data || typeof data !== 'object' || !isClaude5Plus(String(data.model ?? ''))) return [];
    const removed = SAMPLING.filter(key => Object.hasOwn(data, key));
    for (const key of removed) delete data[key];
    return removed;
}

// 6.4.x 본채팅 Google(AI Studio · Vertex AI) 답의 끝 이유 알림 (요청 로그를 꺼도) — main-chat-finish.js 머리말.
//   fetch 를 한 번 감싸 본채팅 Google 생성 요청이면 응답 사본을 끝까지 읽어 끝 이유 · 서버 오류 글로 한 줄 알림. 한 요청에 한 번
//   v3: 본채팅인지는 본문 꼴(type · 공급자)에 더해 문지기로 — 본채팅 생성 창 안 · 실리태번 헬퍼 생성 창 밖에서 만든 본문의 표와 맞는 요청만.
//       헬퍼 generate · generateRaw(type 'normal') 와 다시 쓰기 리롤의 재전송(같은 본문)은 조용하다
const mainGate = createMainGate();
// 6.5.3 생성 상태 (generation-state.js): 다시 쓰기 · 번역 · 에셋이 「생성 중」을 여기서 묻는다 — 본채팅 생성(normal · regenerate · swipe · continue)만 생성 중이고,
//   다른 확장 · 실리태번 헬퍼의 조용한 생성(quiet · generateRaw · 헬퍼 generate)과 테마 자신의 붙잡음(다시 쓰기 · 에셋)은 아니다 — 과일 프리셋의 헬퍼 스크립트가
//   is_send_press · body[data-generating] 을 켜 둬도 애드온이 물러서지 않게. 창은 실리태번 isGenerating() 과 맞춰 본다 (끝 신호가 안 오는 길: 슬래시 명령으로 끊긴 Generate).
const generation = createGenerationState();
let core = null;   // 실리태번 본체 모듈 (isGenerating · streamingProcessor) — startMainChatRules 가 읽는다. 시험(node)에서는 없다
function generationEnv() {
    let processor = null, generating;
    try { processor = core ? core.streamingProcessor ?? null : (SillyTavern.getContext().streamingProcessor ?? null); } catch { processor = null; }
    try { generating = typeof core?.isGenerating === 'function' ? !!core.isGenerating() : (typeof document !== 'undefined' ? document.body?.dataset?.generating === 'true' : undefined); } catch { generating = undefined; }
    return { processor, generating };
}
/** 본채팅 생성 중인가 — 조용한 생성(quiet · generateRaw) · 실리태번 헬퍼의 generate · 다시 쓰기 · 에셋의 붙잡음은 아니다 */
export function isMainChatGenerating() { try { return generation.mainGenerating(generationEnv()); } catch { return false; } }
/** 지금 물러설 까닭: 'main'(본채팅 생성 중) · 'hold'(테마가 답을 붙잡고 있다) · ''(없음) */
export function generationLockReason() { try { return generation.lockReason(generationEnv()); } catch { return ''; } }
/** 테마가 답을 붙잡는 동안(다시 쓰기 holdGeneration · 에셋 holdSendState) 등록한다 — whenMainChatIdle 이 이것도 기다린다. @returns {() => void} 풀기 */
export function holdGenerationState(name) { return generation.hold(name); }
/** 본채팅 생성(과 테마의 붙잡음)이 끝나고 quietMs 동안 그대로이면 true · maxMs(기본 10분) 안에 못 끝나면 false */
export function whenMainChatIdle(options = {}) { return generation.whenIdle({ ...options, processor: () => generationEnv().processor, generating: () => generationEnv().generating }); }
export const generationState = generation;   // 시험용 (tools/tests/fruit-compat-generating.mjs)
const OWN_FOLDER = (() => { try { return decodeURIComponent(new URL('../', import.meta.url).pathname.split('/').filter(Boolean).pop() || ''); } catch { return ''; } })();   // 이 테마 폴더 (스택에서 제 프레임은 안 센다)
function noticeFinish(text) {
    const kind = finishNotice(tallyOf(text));
    if (!kind) return;
    try { globalThis.toastr?.warning?.(NOTICES[kind], '', { timeOut: 10000 }); } catch { /* 알림 없음 */ }
}
function watchMainReplies() {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.fetch.blMainReplyWatch) return;
    const original = window.fetch;
    const watched = function (input, init) {
        let main = false;
        try {
            const body = mainGoogleBody(input, init); main = body !== null && mainGate.take(body);
            if (!main && isGenerateRequest(input, init)) mainGate.otherRequestSent();   // 헬퍼가 보낸 요청 — 오류로 끝나도 헬퍼 창이 닫힌다
        } catch { main = false; }
        const pending = original.apply(this, arguments);
        if (!main) return pending;
        return pending.then((response) => {
            try {
                if (response?.ok && response.body) response.clone().text().then(noticeFinish).catch(() => {});
            } catch { /* 사본을 못 만듦 */ }
            return response;
        });
    };
    watched.blMainReplyWatch = true;
    window.fetch = watched;
}
/** 문지기에 실리태번 생성 신호 · 헬퍼 생성 신호 · 보내기 직전 본문을 잇는다 */
function listenMainGate(eventSource, event_types) {
    const on = (event, fn) => { if (event) eventSource.on(event, (...args) => { try { fn(...args); } catch { /* 알림만 빠진다 */ } }); };
    on(event_types?.GENERATION_STARTED, (type, _options, dryRun) => { mainGate.generationStarted(type, dryRun); generation.started(type, dryRun); });
    on(event_types?.GENERATION_ENDED, (arg) => { mainGate.generationEnded(); generation.ended(arg); });
    // 6.5.3 실리태번 헬퍼는 제 generate 를 멈출 때 같은 GENERATION_STOPPED 를 생성 id(문자열)와 함께 낸다 — 본채팅의 끝이 아니다 (실리태번의 멈춤은 인수 없음)
    on(event_types?.GENERATION_STOPPED, (arg) => { if (!generation.isHelperStop(arg)) mainGate.generationEnded(); generation.ended(arg); });
    // 보내기 직전 본문(CHAT_COMPLETION_SETTINGS_READY)은 Claude 5 규칙과 같은 처리에서 mainGate.settingsReady 로 (처리는 하나)
    for (const event of HELPER_EVENTS.start) on(event, (id) => mainGate.helperStarted(id));
    on(HELPER_EVENTS.end, (_text, id) => mainGate.helperEnded(id));
}

let started = false;

export function startMainChatRules() {
    if (started) return;
    try {
        const { eventSource, event_types } = SillyTavern.getContext();
        // 6.5.3 생성 상태가 실리태번 isGenerating() · streamingProcessor 를 보게 본체 모듈을 읽어 둔다 (못 읽으면 body[data-generating] · getContext 로)
        import('../../../../../script.js').then(module => { core = module; }).catch(() => { core = null; });
        const name = event_types?.CHAT_COMPLETION_SETTINGS_READY;
        if (!name) return;
        eventSource.on(name, (data) => {
            try { stripClaude5Sampling(data); } catch (error) { console.warn('[블루 레몬에이드] 본채팅 Claude 5 규칙', error); }
            try { mainGate.settingsReady(data, stackOrigin(new Error().stack, OWN_FOLDER)); } catch { /* v3 본채팅 문지기 — 알림만 빠진다 */ }
        });
        watchMainReplies();   // 6.4.x 본채팅 Google 답의 끝 이유 알림
        listenMainGate(eventSource, event_types);   // v3 본채팅 문지기 (생성 창 · 헬퍼 창 · 본문 표)
        started = true;
    } catch (error) {
        console.warn('[블루 레몬에이드] 본채팅 Claude 5 규칙을 켜지 못했어요', error);
    }
}
