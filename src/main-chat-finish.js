// 6.4.x 본채팅 Google(AI Studio · Vertex AI) 답의 끝 이유 알림 — 순수 함수 (DOM · 실리태번 없음, tools/tests/main-chat-finish.mjs 가 검사한다).
// v3: 본채팅은 「본채팅 생성 창 + 그 생성이 만든 본문의 표 (+ 그 본문을 만든 호출 스택)」로 가린다. v2 는 본문 type 만 봐서 실리태번 헬퍼(JS-Slash-Runner)의 generate · generateRaw
//   (본문 type 'normal' — 스트림은 createGenerationParameters(…, 'normal') 뒤 제 fetch, 스트림 아님은 sendOpenAIRequest('normal'))에도 본채팅 알림을 띄웠다.
//   · 본채팅 생성 창: 드라이런이 아닌 GENERATION_STARTED(type 이 quiet · impersonate 가 아닌 것) ~ GENERATION_ENDED / GENERATION_STOPPED.
//     스택이 본채팅(Generate)이라고 말하면 끝 신호는 안 본다 (최근 MAIN_TTL 안에 본채팅 시작만) — 헬퍼 요청이 오류로 끝날 때 실리태번이 본채팅 도중에도
//     GENERATION_ENDED 를 내서 그 뒤의 진짜 본채팅 본문이 표를 못 받았다 (실제 헬퍼 시험대에서 본 순서)
//   · 헬퍼 생성 창: js_generation_requested / js_generation_started(생성 id) ~ js_generation_ended(글, 생성 id) 또는 그 헬퍼의 생성 요청이 실제로 나간 때
//     (표와 안 맞는 생성 요청 = 헬퍼가 보낸 것 — 헬퍼는 오류로 끝나면 js_generation_ended 를 안 내서, 그것만 기다리면 그동안 본채팅 알림까지 막혔다).
//     둘 다 없으면 HELPER_TTL 뒤 저절로 닫는다
//   · 표: 본채팅 창 안에서 온 CHAT_COMPLETION_SETTINGS_READY 의 generate_data (본채팅 type · Google) — 그 처리 안의 호출 스택이 다른 확장(헬퍼 등)이 부른 것이면 빼고,
//     스택으로 모를 때만 헬퍼 창 밖인지 본다 (본채팅 생성 시작 직후 헬퍼 스크립트가 끼어들어도 본채팅 본문은 표를 받는다). 그 요청 본문과 같은 표가 있으면 한 번 쓰고 알린다 —
//     같은 본문을 다시 보내는 다시 쓰기 씬 플랜 리롤(reroll.js repeatRequest)은 표가 이미 쓰여 조용하다 (한 답에 알림 한 번)
// 스트림 답은 서버가 원본 Gemini SSE 를 그대로 넘겨서 끝 이유(finishReason) · 프롬프트 차단(promptFeedback.blockReason) · 생각 토큰을 읽는다.
// 스트림이 아닌 답은 서버가 { choices, responseContent } 로 감싸며 끝 이유를 버린다. 글이 비면 오류 글로만 답한다:
//   「<공급자> Candidate text empty」 · 「<공급자> API returned no candidate」(+ 「Prompt was blocked due to : <이유>」) — 이유가 보이면 그 알림, 없으면 빈 답 알림.
//  · 안전 필터: 끝 이유 또는 프롬프트 차단이 SAFETY_REASONS — 실리태번이 끌 수 있는 범주는 이미 다 끄고 보내므로 끌 수 없는 쪽의 차단이다
//    (같은 글도 다시 하면 지나가기도 한다)
//  · 생각 잘림: 끝 이유 MAX_TOKENS 이고 출력 토큰의 대부분(THOUGHT_SHARE)이 생각
export const SAFETY_REASONS = Object.freeze(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'OTHER', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT']);
export const THOUGHT_SHARE = 0.8;
export const MAIN_TYPES = Object.freeze(['normal', 'regenerate', 'continue', 'swipe']);
export const NOTICES = Object.freeze({
    safety: '구글 안전 필터가 답을 막았어요 — 다시 생성해 보거나, 프롬프트의 탈옥처럼 보이는 문장을 꺼 보세요',
    thought: '생각이 응답 길이를 다 써서 답이 잘렸어요 — 응답 길이를 올려 주세요',
    empty: '구글이 빈 답을 보냈어요 — 안전 필터나 생각 길이 때문일 수 있어요. 다시 생성해 보세요',
});
/** 실리태번 헬퍼가 실리태번 eventSource 로 내는 생성 신호 (헬퍼 4.x · 이름 그대로) */
export const HELPER_EVENTS = Object.freeze({ start: Object.freeze(['js_generation_requested', 'js_generation_started']), end: 'js_generation_ended' });
export const MAIN_TTL = 10 * 60 * 1000;     // 본채팅 창 · 표가 끝 신호 없이 남는 최대 시간
export const HELPER_TTL = 60 * 1000;        // 헬퍼 창 (오류 때 js_generation_ended 가 없고, 요청도 못 나간 경우의 마지막 닫힘)
const GOOGLE = new Set(['makersuite', 'vertexai']);
const GENERATE = /\/api\/backends\/chat-completions\/generate(?:[?#]|$)/;
const GOOGLE_BODY = /"chat_completion_source"\s*:\s*"(?:makersuite|vertexai)"/;
const NOT_MAIN_STARTS = new Set(['quiet', 'impersonate']);

export const isGoogleSource = source => GOOGLE.has(String(source ?? ''));
export const emptyTally = () => ({ finish: '', block: '', empty: false, thoughts: 0, answer: 0, thoughtChars: 0, textChars: 0 });

/** fetch(input, init) 가 본채팅 꼴(본문 type · Google 공급자)의 생성 요청이면 푼 본문, 아니면 null */
export function mainGoogleBody(input, init) {
    const url = typeof input === 'string' ? input : String(input?.url ?? input ?? '');
    if (!GENERATE.test(url)) return null;
    if (String(init?.method ?? input?.method ?? 'GET').toUpperCase() !== 'POST' || typeof init?.body !== 'string') return null;
    if (!GOOGLE_BODY.test(init.body)) return null;   // 다른 공급자의 큰 본문은 풀지 않는다
    let body = null;
    try { body = JSON.parse(init.body); } catch { return null; }
    return MAIN_TYPES.includes(String(body?.type ?? '')) && isGoogleSource(body?.chat_completion_source) ? body : null;
}
/** v2 와 같은 꼴 판정 (본채팅인지는 createMainGate 가 더 본다) */
export const isMainGoogleRequest = (input, init) => mainGoogleBody(input, init) !== null;
/** 채팅 생성 요청인가 (공급자 · type 상관없이 — 헬퍼 창을 닫는 데 쓴다) */
export function isGenerateRequest(input, init) {
    const url = typeof input === 'string' ? input : String(input?.url ?? input ?? '');
    return GENERATE.test(url) && String(init?.method ?? input?.method ?? 'GET').toUpperCase() === 'POST';
}

/**
 * CHAT_COMPLETION_SETTINGS_READY 처리 안에서 본 호출 스택 → 'main' | 'foreign' | 'unknown' (성능 보조 요청 로그의 부르는 쪽 찾기와 같은 규칙).
 * 스택은 안쪽→바깥쪽. 실리태번 본체 프레임(openai.js · script.js) 바깥에 확장 프레임이 있으면 그 확장이 부른 것('foreign' — 헬퍼 generate · generateRaw 의
 * sendOpenAIRequest 길), 본체 프레임 없이 확장 프레임만 있어도 'foreign'(헬퍼 스트림 길 · 헬퍼가 스스로 띄운 SETTINGS_READY). 확장이 아니고 script.js(Generate)가
 * 보이면 'main', 그 밖(비동기 프레임이 안 보이는 등)은 'unknown' — 그때만 헬퍼 생성 창으로 가린다. own = 이 테마의 폴더 이름(제 프레임은 안 센다)
 */
export function stackOrigin(stack, own = '') {
    const frames = [];
    for (const line of String(stack ?? '').split('\n')) {
        const third = /\/scripts\/extensions\/third-party\/([^/?#]+)\//.exec(line);
        if (third) {
            let name = third[1];
            try { name = decodeURIComponent(name); } catch { /* 그대로 */ }
            if (name !== own) frames.push('ext');
            continue;
        }
        if (/\/scripts\/extensions\/[^/?#]+\//.test(line)) { frames.push('ext'); continue; }
        if (/\/script\.js(?:[?#:]|\)|$)/.test(line)) { frames.push('generate'); continue; }
        if (/\/scripts\/openai\.js/.test(line)) frames.push('core');
    }
    const firstCore = frames.findIndex(f => f !== 'ext');
    if (firstCore < 0 ? frames.includes('ext') : frames.slice(firstCore).includes('ext')) return 'foreign';
    return frames.includes('generate') ? 'main' : 'unknown';
}

/** 본문의 표 — type · 공급자 · 모델 · 메시지 수 · 마지막 메시지 글 (stream · n · 샘플링 값은 안 본다) */
export function ticketOf(data) {
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    const tail = messages.length ? messages[messages.length - 1] : null;
    const content = tail == null ? '' : typeof tail.content === 'string' ? tail.content : JSON.stringify(tail.content ?? '');
    return [data?.type, data?.chat_completion_source, data?.model, messages.length, content.length, content.slice(0, 200), content.slice(-200)].map(v => String(v ?? '')).join('\u0001');
}

/**
 * 본채팅 문지기: 실리태번 생성 신호 · 헬퍼 생성 신호 · CHAT_COMPLETION_SETTINGS_READY 로 본채팅 본문의 표를 만들고, 요청 본문이 그 표와 맞으면 한 번 쓴다.
 * now: 시계 (시험용)
 */
export function createMainGate({ now = () => Date.now() } = {}) {
    let mainAt = 0;              // 열린 본채팅 생성의 시작 시각 (0 = 없음) — 끝 · 멈춤 신호로 닫힌다 (스택으로 모를 때 쓰는 창)
    let lastMainAt = 0;          // 마지막 본채팅 생성 시작 — 끝 신호로 안 닫는다: 헬퍼 요청이 오류로 끝나면 실리태번이 본채팅 중에도 GENERATION_ENDED 를 낸다
    const helpers = new Map();   // 헬퍼 생성 id → 시작 시각
    const tickets = [];          // { data, at } — data = 그 생성의 generate_data (보낼 때 글로 바뀌는 바로 그 객체)
    const live = (at, ttl) => at > 0 && now() - at < ttl;
    const helperBusy = () => { for (const [id, at] of helpers) if (!live(at, HELPER_TTL)) helpers.delete(id); return helpers.size > 0; };
    return {
        generationStarted(type, dryRun) { if (!dryRun && !NOT_MAIN_STARTS.has(String(type ?? ''))) mainAt = lastMainAt = now(); },
        generationEnded() { mainAt = 0; },
        helperStarted(id) { helpers.set(String(id ?? ''), now()); },
        helperEnded(id) { helpers.delete(String(id ?? '')); },
        /** 표와 안 맞는 생성 요청이 나갔다 — 헬퍼 창이 열려 있으면 가장 먼저 연 것이 그 요청을 보낸 것으로 보고 닫는다 */
        otherRequestSent() { const first = helpers.keys().next(); if (!first.done) helpers.delete(first.value); },
        /** CHAT_COMPLETION_SETTINGS_READY — 본채팅 창 안 · 본채팅 type · Google 이고, 스택이 본채팅(Generate)이거나 모를 때는 헬퍼 창 밖이면 표를 남긴다.
         *  origin = stackOrigin(그 처리 안의 스택): 'foreign'(다른 확장이 부름)이면 늘 안 남긴다 */
        settingsReady(data, origin = 'unknown') {
            if (origin === 'foreign') return false;
            if (origin === 'main' ? !live(lastMainAt, MAIN_TTL) : (!live(mainAt, MAIN_TTL) || helperBusy())) return false;
            if (!data || typeof data !== 'object' || !isGoogleSource(data.chat_completion_source) || !MAIN_TYPES.includes(String(data.type ?? ''))) return false;
            if (tickets.some(t => t.data === data)) return true;
            tickets.push({ data, at: now() });
            return true;
        },
        /** 요청 본문(푼 것)과 같은 표가 있으면 그 표를 쓰고 true */
        take(body) {
            for (let i = tickets.length - 1; i >= 0; i--) if (!live(tickets[i].at, MAIN_TTL)) tickets.splice(i, 1);
            const key = ticketOf(body);
            const at = tickets.findIndex(t => ticketOf(t.data) === key);
            if (at < 0) return false;
            tickets.splice(at, 1);
            return true;
        },
        get state() { return { main: live(mainAt, MAIN_TTL), helpers: helpers.size, tickets: tickets.length }; },
    };
}

/** 서버의 오류 글(스트림이 아닌 답) → tally (차단 이유 · 빈 답) */
function absorbServerError(message, tally) {
    const text = String(message ?? '');
    const blocked = /Prompt was blocked due to\s*:\s*([A-Z_]+)/.exec(text);
    if (blocked) tally.block = blocked[1];
    if (/Candidate text empty|API returned no candidate/.test(text)) tally.empty = true;
    return tally;
}

/** Gemini 응답 조각(스트림 한 덩이 또는 전체 응답 JSON) 하나를 tally 에 더한다 */
export function absorbGemini(json, tally) {
    if (!json || typeof json !== 'object' || !tally) return tally;
    if (typeof json.error?.message === 'string') absorbServerError(json.error.message, tally);
    if (json.promptFeedback?.blockReason) tally.block = String(json.promptFeedback.blockReason);
    const candidate = Array.isArray(json.candidates) ? json.candidates[0] : null;
    if (candidate) {
        for (const part of candidate.content?.parts ?? []) {
            if (typeof part?.text !== 'string') continue;
            if (part.thought) tally.thoughtChars += part.text.length;
            else tally.textChars += part.text.length;
        }
        if (candidate.finishReason) tally.finish = String(candidate.finishReason);
    }
    const usage = json.usageMetadata;
    if (usage && typeof usage === 'object') {
        if (Number.isFinite(Number(usage.thoughtsTokenCount))) tally.thoughts = Number(usage.thoughtsTokenCount);
        if (Number.isFinite(Number(usage.candidatesTokenCount))) tally.answer = Number(usage.candidatesTokenCount);
    }
    return tally;
}

/** SSE 글 → 조각 JSON 들 (data: 줄마다 · 깨진 줄 · [DONE] 은 건너뜀) */
export function sseEvents(text) {
    const out = [];
    for (const line of String(text ?? '').split(/\r?\n/)) {
        const m = /^data:\s?(.*)$/.exec(line);
        if (!m) continue;
        const payload = m[1].trim();
        if (!payload || payload === '[DONE]') continue;
        try { out.push(JSON.parse(payload)); } catch { /* 반 토막 줄 */ }
    }
    return out;
}

/** 응답 글 전체(SSE 또는 JSON) → tally */
export function tallyOf(text) {
    const tally = emptyTally();
    const body = String(text ?? '').trim();
    if (body.startsWith('{')) { try { absorbGemini(JSON.parse(body), tally); } catch { /* JSON 아님 */ } return tally; }
    for (const event of sseEvents(body)) absorbGemini(event, tally);
    return tally;
}

/** 끝 이유 MAX_TOKENS 이고 출력 토큰의 대부분이 생각인가 (토큰 수가 없으면 보이는 생각 · 답 글자 수로) */
export function thoughtCutoff(tally) {
    if (String(tally?.finish ?? '').toUpperCase() !== 'MAX_TOKENS') return false;
    const thoughts = Number(tally.thoughts) || 0, answer = Number(tally.answer) || 0;
    if (thoughts > 0) return thoughts / (thoughts + answer) >= THOUGHT_SHARE;
    const tc = Number(tally.thoughtChars) || 0, ac = Number(tally.textChars) || 0;
    return tc > 0 && tc / (tc + ac) >= THOUGHT_SHARE;
}

/** 알릴 것: 'safety' | 'thought' | 'empty' | '' */
export function finishNotice(tally) {
    const reasons = [tally?.finish, tally?.block].map(r => String(r ?? '').toUpperCase());
    if (reasons.some(r => SAFETY_REASONS.includes(r))) return 'safety';
    if (thoughtCutoff(tally)) return 'thought';
    if (tally?.empty) return 'empty';
    return '';
}
