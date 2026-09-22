// 요청 로그 — fetch를 가로채서 API 요청과 응답을 기록한다
//
// 실리태번(그리고 확장들)은 모두 브라우저에서 서버의 /api/backends/…/generate 로 요청을 보낸다.
// window.fetch를 감싸면 누가 보내든 한 곳에서 잡힌다. 응답은 clone()으로 따로 읽으니 원래 흐름은 건드리지 않는다.
import { LOG_BRIDGE, createAttribution, requestKind } from './attribution.js';
const attribution=createAttribution();
import { getCurrentChatId, name2 } from '../../../../../../../script.js';
import { getTokenCountAsync } from '../../../../../../tokenizers.js';
import { settings, costOf } from './state.js';
import { addEntry, bumpDaily, trimEntries } from './store.js';

// Known paid-work endpoints only; auth, status and ordinary local requests stay unlogged.

const listeners = new Set();
let installed = false;
let sinceTrim = 0;

/** 실리태번의 채팅 생성이 진행 중이면 그 종류 (normal / regenerate / swipe / continue / impersonate / quiet) */
let generationType = null;

// ── 전송 흐름 (1.1.0): 보내기 버튼을 누른 뒤 요청이 나가기까지 단계별 시각 ──────────────
// 폰에서 "보내고 한참 뒤에 나간다"를 숫자로 보려고 둔다. 버튼(또는 Enter) → 생성 시작 → 채팅 저장 → 메시지 전송 이벤트
// → 내 메시지 표시 → 프롬프트 완성 → 요청. 그 사이에 난 채팅 저장 · 임베딩 검색 · 토크나이저 요청의 길이도 같이 적는다.
const TRACE_PATHS = { '/api/chats/save': '채팅 저장', '/api/chats/group/save': '채팅 저장', '/api/vector/query': '임베딩 검색', '/api/vector/insert': '임베딩 색인', '/api/tokenizers': '토큰 세기', '/api/worldinfo': '월드인포', '/api/ping': '서버 응답 확인' };
let trace = null;
/**
 * [1.2.2] 보내기를 눌러도 채팅 요청이 안 나가는 경우가 있다 (슬래시 명령, 폰에서 줄 바꿈 Enter).
 * 예전에는 그 흐름이 열린 채 남아 그 뒤의 저장 · 토큰 세기를 끝없이 쌓다가, 한참 뒤 스와이프 같은 엉뚱한 요청에 붙었다.
 * 이만큼 지난 흐름은 버린다.
 */
const TRACE_MAX_MS = 120000;
/** 보내기 버튼 · Enter로는 생기지 않는 생성 — 이런 요청에는 전송 흐름을 붙이지 않는다 */
const NOT_SEND_TYPES = ['quiet', 'swipe', 'regenerate', 'impersonate'];

export function beginSendTrace(source = 'button') {
    trace = { start: performance.now(), source, marks: [], fetches: [] };
}

/** 열려 있고 아직 오래되지 않은 흐름 (오래됐으면 버린다) */
function liveTrace() {
    if (trace && performance.now() - trace.start > TRACE_MAX_MS) trace = null;
    return trace;
}

export function markSend(name) {
    if (!liveTrace()) return;
    trace.marks.push([name, Math.round(performance.now() - trace.start)]);
}

function traceFetchStart(path) {
    if (!liveTrace()) return null;
    const key = Object.keys(TRACE_PATHS).find(prefix => path.startsWith(prefix));
    if (!key) return null;
    const row = { label: TRACE_PATHS[key], at: Math.round(performance.now() - trace.start), ms: null };
    trace.fetches.push(row);
    return row;
}

/** 요청 기록에 붙여 보낼 전송 흐름을 떼어 낸다 (채팅 요청 하나에 한 번) */
function takeSendTrace() {
    if (!liveTrace()) return null;
    const out = { source: trace.source, marks: trace.marks, fetches: trace.fetches.filter(row => row.ms !== null), requestAt: Math.round(performance.now() - trace.start) };
    trace = null;
    return out;
}

export function setGenerationType(type) {
    generationType = type || 'normal';
}

export function clearGenerationType() {
    generationType = null;
}

/** 새 기록이 저장될 때마다 부른다 (열려 있는 창을 새로 그리는 데 쓴다) */
export function onEntry(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notify(entry) {
    for (const listener of listeners) {
        try {
            listener(entry);
        } catch (error) {
            console.warn('[요청 로그] listener', error);
        }
    }
}

// ── 누가 보냈나 ─────────────────────────────────────────────

/** 테마 폴더 이름 — 이 파일은 <폴더>/src/addons/perf/ 에 있다 (설치 이름이 달라도 맞게) */
const OWN_FOLDER = new URL('../../../', import.meta.url).pathname.split('/').filter(Boolean).pop();
/** 테마 안 애드온 폴더 → 요청 로그의 호출자 키 (CALLER_LABELS · 용도 표에 이미 있는 이름) */
const OWN_ADDONS = new Map([['rewrite', 'ban-word-rewrite'], ['bookmarks', 'chat-bookmarks']]);

/**
 * 호출 스택에서 요청을 시작한 확장 폴더를 찾는다 (1.1.0).
 * 스택은 안쪽→바깥쪽 순서다. 실리태번 헬퍼처럼 fetch 나 생성 함수를 감싸는 확장은 실제 호출자보다 안쪽에 나타나므로,
 * 실리태번 본체 프레임(openai.js · script.js)보다 바깥쪽에 있는 확장 중 가장 바깥 것을 호출자로 본다.
 * 본체 프레임이 없으면 가장 바깥 확장, 그것도 없으면 본체가 보낸 채팅 요청이다.
 * 테마 안의 성능 보조(이 감싸기) 프레임은 빼고, 내장 다시 쓰기 · 북마크는 위 표의 호출자 키로 적는다.
 */
function callerFromStack() {
    const stack = new Error().stack ?? '';
    const frames = [];
    for (const line of stack.split('\n')) {
        const third = line.match(/\/scripts\/extensions\/third-party\/([^/]+)\/(?:src\/addons\/([^/]+)\/)?/);
        if (third) {
            let name = third[1];
            if (name === OWN_FOLDER) {
                if (third[2] === 'perf') continue;
                name = OWN_ADDONS.get(third[2]) ?? name;
            }
            if (name !== 'perf-assist' && name !== 'request-log') frames.push({ kind: 'ext', name });
            continue;
        }
        const builtin = line.match(/\/scripts\/extensions\/([^/]+)\//);
        if (builtin && builtin[1] !== 'third-party') { frames.push({ kind: 'ext', name: builtin[1] }); continue; }
        if (/\/scripts\/(openai|textgen-settings|kai-settings|nai-settings|horde)\.js|\/script\.js/.test(line)) frames.push({ kind: 'core' });
    }
    const firstCore = frames.findIndex(f => f.kind === 'core');
    const candidates = frames.filter((f, i) => f.kind === 'ext' && (firstCore < 0 || i > firstCore));
    if (candidates.length) return candidates[candidates.length - 1].name;
    if (firstCore >= 0) return 'chat';
    return 'unknown'; // A concurrent chat generation does not identify an unrelated extension.
}

// ── 요청 본문 정리 ──────────────────────────────────────────

const SECRET_KEY = /password|api[-_]key|apikey|secret|authorization|include_headers|access_token|bearer|credential/i;

function partText(part) {
    if (part == null) return '';
    if (typeof part === 'string') return part;
    if (typeof part.text === 'string') return part.text;
    if (part.type === 'image_url' || part.inlineData || part.inline_data || part.source?.type === 'base64') return '[이미지]';
    if (part.type === 'input_audio') return '[오디오]';
    return '';
}

/** 메시지 내용을 글자로. 이미지 같은 큰 것은 표시로만 남긴다. */
export function contentText(content) {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) return content.map(partText).filter(Boolean).join('\n');
    if (content && typeof content === 'object') return partText(content);
    return '';
}

function slimMessages(messages) {
    if (!Array.isArray(messages)) return null;
    return messages.map((message) => {
        const slim = { role: message?.role ?? '?', content: contentText(message?.content) };
        if (message?.name) slim.name = message.name;
        if (message?.tool_calls) slim.tool_calls = message.tool_calls;
        if (message?.tool_call_id) slim.tool_call_id = message.tool_call_id;
        return slim;
    });
}

function slimParams(body) {
    const params = {};
    for (const [key, value] of Object.entries(body ?? {})) {
        if (key === 'messages' || key === 'prompt' || SECRET_KEY.test(key)) continue;
        if (value === null || value === undefined || value === '') continue;
        if (typeof value === 'object' && JSON.stringify(value).length > 4000) {
            params[key] = '[생략]';
            continue;
        }
        params[key] = value;
    }
    return params;
}

// ── 응답 읽기 (공급자마다 모양이 다르다) ──────────────────

function makeAccumulator() {
    return { text: '', reasoning: '', usage: null, finish: '', error: null, swipes: 0 };
}

function numberOr(...values) {
    for (const value of values) {
        const number = Number(value);
        if (Number.isFinite(number) && number > 0) return number;
    }
    return 0;
}

/** 응답 조각(스트림 한 덩이 또는 전체 응답)에서 글·생각·토큰 사용량을 뽑아 acc에 더한다. */
export function absorbChunk(json, acc) {
    if (!json || typeof json !== 'object') return;

    if(Array.isArray(json.output))for(const item of json.output)for(const part of item.content||[])if(part.type==='output_text')acc.text+=part.text||'';
    if(json.type==='response.output_text.delta')acc.text+=json.delta||'';
    if(json.type==='response.completed'&&json.response?.usage)json={usage:json.response.usage};
    if(typeof json.text==='string'&&!json.choices)acc.text+=json.text;
    // 오류
    if (json.error) {
        const error = json.error;
        acc.error = typeof error === 'string' ? error : (error.message ?? JSON.stringify(error).slice(0, 500));
    }
    if (json.type === 'error' && json.error?.message) acc.error = json.error.message;

    // OpenAI 계열 (custom, openrouter, deepseek, …)
    if (Array.isArray(json.choices)) {
        const choice = json.choices[0];
        if (choice) {
            if (json.choices.length > 1) acc.swipes = Math.max(acc.swipes, json.choices.length);
            const delta = choice.delta ?? choice.message ?? choice;
            const content = delta?.content;
            if (typeof content === 'string') acc.text += content;
            else if (Array.isArray(content)) acc.text += content.map(part => part?.text ?? part?.thinking?.[0]?.text ?? '').join('');
            else if (typeof choice.text === 'string') acc.text += choice.text;
            const reasoning = delta?.reasoning_content ?? delta?.reasoning;
            if (typeof reasoning === 'string') acc.reasoning += reasoning;
            if (choice.finish_reason) acc.finish = String(choice.finish_reason);
        }
    }

    // Claude (메시지 API)
    if (json.type === 'message_start' && json.message?.usage) {
        acc.usage = { ...(acc.usage ?? {}), prompt: numberOr(json.message.usage.input_tokens)+numberOr(json.message.usage.cache_read_input_tokens)+numberOr(json.message.usage.cache_creation_input_tokens), cached: numberOr(json.message.usage.cache_read_input_tokens) };
    }
    if (json.type === 'content_block_delta' && json.delta) {
        if (typeof json.delta.text === 'string') acc.text += json.delta.text;
        if (typeof json.delta.thinking === 'string') acc.reasoning += json.delta.thinking;
    }
    if (json.type === 'message_delta') {
        if (json.usage) acc.usage = { ...(acc.usage ?? {}), completion: numberOr(json.usage.output_tokens) };
        if (json.delta?.stop_reason) acc.finish = String(json.delta.stop_reason);
    }
    if (json.type === 'message' && Array.isArray(json.content)) {
        for (const block of json.content) {
            if (block?.type === 'text' && typeof block.text === 'string') acc.text += block.text;
            if (block?.type === 'thinking' && typeof block.thinking === 'string') acc.reasoning += block.thinking;
        }
        if (json.stop_reason) acc.finish = String(json.stop_reason);
        if (json.usage) acc.usage = { prompt: numberOr(json.usage.input_tokens)+numberOr(json.usage.cache_read_input_tokens)+numberOr(json.usage.cache_creation_input_tokens), completion: numberOr(json.usage.output_tokens), cached: numberOr(json.usage.cache_read_input_tokens) };
    }

    // Gemini (MakerSuite / Vertex)
    if (Array.isArray(json.candidates)) {
        const candidate = json.candidates[0];
        const parts = candidate?.content?.parts ?? [];
        for (const part of parts) {
            if (typeof part?.text !== 'string') continue;
            if (part.thought) acc.reasoning += part.text;
            else acc.text += part.text;
        }
        if (candidate?.finishReason) acc.finish = String(candidate.finishReason);
        if (json.promptFeedback?.blockReason) acc.error = `차단됨: ${json.promptFeedback.blockReason}`;
    }
    if (json.usageMetadata) {
        const meta = json.usageMetadata;
        acc.usage = {
            prompt: numberOr(meta.promptTokenCount),
            completion: numberOr(meta.candidatesTokenCount)+numberOr(meta.thoughtsTokenCount),
            reasoning: numberOr(meta.thoughtsTokenCount),
            cached: numberOr(meta.cachedContentTokenCount),
        };
    }

    // Cohere v2
    if (json.message?.content && Array.isArray(json.message.content) && !json.type) {
        acc.text += json.message.content.map(part => part?.text ?? '').join('');
    }
    if (json.type === 'content-delta' && typeof json.delta?.message?.content?.text === 'string') acc.text += json.delta.message.content.text;
    if (json.type === 'message-end' && json.delta?.usage?.tokens) {
        acc.usage = { prompt: numberOr(json.delta.usage.tokens.input_tokens), completion: numberOr(json.delta.usage.tokens.output_tokens) };
    }
    if (json.usage?.tokens && !json.type) {
        acc.usage = { prompt: numberOr(json.usage.tokens.input_tokens), completion: numberOr(json.usage.tokens.output_tokens) };
    }

    // OpenAI 계열 usage (마지막 조각이나 전체 응답에 온다)
    if (json.usage && (json.usage.prompt_tokens !== undefined || json.usage.completion_tokens !== undefined || json.usage.input_tokens !== undefined)) {
        const usage = json.usage;
        const found = {
            prompt: numberOr(usage.prompt_tokens, usage.input_tokens)+(usage.prompt_tokens===undefined?numberOr(usage.cache_read_input_tokens)+numberOr(usage.cache_creation_input_tokens):0),
            completion: numberOr(usage.completion_tokens, usage.output_tokens),
            reasoning: numberOr(usage.completion_tokens_details?.reasoning_tokens, usage.output_tokens_details?.reasoning_tokens),
            cached: numberOr(usage.prompt_tokens_details?.cached_tokens, usage.cache_read_input_tokens),
        };
        acc.usage = found;
    }
}

/** SSE 본문을 한 줄씩 읽는다. `data: {...}` 줄만 JSON으로 본다. */
async function readStream(body, acc, marks) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let first = true;
    const handleLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;
        const data = trimmed.slice(5).trim();
        if (!data || data === '[DONE]') return;
        try {
            absorbChunk(JSON.parse(data), acc);
        } catch {
            // JSON이 아닌 줄(keep-alive 등)은 넘긴다
        }
    };
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (first) {
            marks.firstByte = performance.now();
            first = false;
        }
        buffer += decoder.decode(value, { stream: true });
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
            handleLine(buffer.slice(0, newline));
            buffer = buffer.slice(newline + 1);
        }
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);
}

// ── 기록 만들기 ─────────────────────────────────────────────

function newId(at) {
    return `${at}-${Math.random().toString(36).slice(2, 8)}`;
}

function firstNonEmpty(...values) {
    return values.find(value => typeof value === 'string' && value.trim()) ?? '';
}

async function estimateTokens(text) {
    if (!text) return 0;
    try {
        return await getTokenCountAsync(text);
    } catch {
        return Math.ceil(text.length / 3);
    }
}

async function finishEntry(context, response, acc, marks, failure) {
    const store = settings();
    const at = context.at;
    const ended = performance.now();
    const messages = context.messages;
    const promptText = messages ? messages.map(message => `${message.role}: ${message.content}`).join('\n') : (context.prompt ?? '');

    let promptTokens = acc.usage?.prompt ?? 0;
    let completionTokens = acc.usage?.completion ?? 0;
    const reasoningTokens = acc.usage?.reasoning ?? 0;
    const cachedTokens = acc.usage?.cached ?? 0;
    let estimated = false;
    const tokenBased=['text','embedding'].includes(context.kind);
    const usageKnown=!!acc.usage;
    // HTTP 오류로 끝난 요청(429 등)은 토큰을 쓰지 않았으니 추정하지 않는다. 중간에 끊긴 스트림은 쓴 만큼 추정한다.
    // [1.2.3] 실리태번 서버는 스트리밍이 아닌 요청(번역 · 다시 쓰기 · 장기 기억)의 중계 오류를 HTTP 200 + {"error":…} 로 넘긴다
    // (src/endpoints/backends/chat-completions.js). 글도 사용량도 없는 오류 응답은 과금되지 않았으니 이것도 추정하지 않는다.
    const httpOk = !!response?.ok;
    const errorOnly = !!acc.error && !acc.text && !acc.reasoning;
    if (!usageKnown && promptText && httpOk && !errorOnly && tokenBased) {
        promptTokens = await estimateTokens(promptText);
        estimated = true;
    }
    if (!usageKnown && (acc.text || acc.reasoning) && context.kind==='text') {
        completionTokens = await estimateTokens(acc.text + acc.reasoning);
        estimated = true;
    }

    const status = response?.status ?? 0;
    const ok = !failure && !!response?.ok && !acc.error;
    const error = failure ? (context.aborted ? '중단됨' : String(failure.message ?? failure)) : (acc.error ?? (response && !response.ok ? `HTTP ${status}` : null));

    const entry = {
        id: newId(at),
        at,
        caller: context.caller,
        purpose: context.purpose,
        attribution: context.attribution,
        kind: context.kind,
        endpoint: context.endpoint,
        type: context.type,
        source: context.source,
        model: context.model,
        stream: context.stream,
        chatId: context.chatId,
        character: context.character,
        messageCount: messages ? messages.length : (context.prompt ? 1 : 0),
        promptChars: promptText.length,
        replyChars: acc.text.length,
        status,
        ok,
        aborted: !!context.aborted,
        error,
        finish: acc.finish,
        swipes: acc.swipes,
        durationMs: Math.round(ended - marks.start),
        firstByteMs: marks.firstByte ? Math.round(marks.firstByte - marks.start) : null,
        promptTokens,
        completionTokens,
        reasoningTokens,
        cachedTokens,
        estimated,
        usageKnown,
        cost: tokenBased&&(usageKnown||estimated)?costOf(context.model,promptTokens,completionTokens):null,
        params: context.params,
    };
    if (context.sendTrace) entry.sendTrace = context.sendTrace;
    if (store.keepBodies > 0) {
        if (messages) entry.messages = messages;
        else if (context.prompt) entry.prompt = context.prompt;
        entry.reply = acc.text;
        if (acc.reasoning) entry.reasoning = acc.reasoning;
        if (failure && context.rawError) entry.raw = context.rawError;
        else if (error && acc.error) entry.raw = acc.error;
    }

    try {
        await addEntry(entry);
        await bumpDaily(entry);
        if (++sinceTrim >= 10) {
            sinceTrim = 0;
            await trimEntries();
        }
    } catch (storeError) {
        console.warn('[요청 로그] 기록을 저장하지 못했어요', storeError);
    }
    notify(entry);
    return entry;
}

function pathOf(input) {
    try {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input?.url ?? '');
        return new URL(url, location.origin).pathname;
    } catch {
        return '';
    }
}

function modelFromPath(path) {
    const model=path.match(/\/models\/([^/]+):(?:streamGenerateContent|generateContent)$/)?.[1]||'';
    try { return decodeURIComponent(model); } catch { return model; }
}

/** 요청 하나를 지켜본다. 원래 fetch의 결과는 그대로 돌려준다. */
async function watch(nativeFetch, input, init, body, caller=callerFromStack()) {
    const at = Date.now();
    const endpoint=pathOf(input),kind=requestKind(endpoint);
    const marks = { start: performance.now(), firstByte: null };
    const context = {
        at, endpoint, kind,
        caller,
        type: null,
        source: firstNonEmpty(body.chat_completion_source, body.api_type, body.api_server ? 'textgen' : ''),
        model: firstNonEmpty(body.model, body.custom_model, body.claude_model, body.google_model,modelFromPath(endpoint)),
        stream: !!body.stream,
        chatId: safeChatId(),
        character: safeName(),
        messages: slimMessages(body.messages),
        prompt: typeof body.prompt==='string'?body.prompt:kind==='embedding'?(Array.isArray(body.input)?body.input.join('\n'):String(body.input||'')):Array.isArray(body.contents)?body.contents.flatMap(c=>(c.parts||[]).map(p=>p.text||'')).join('\n'):null,
        params: slimParams(body),
        aborted: false,
        rawError: null,
    };
    if (context.caller === 'chat') context.type = generationType ?? 'quiet';
    Object.assign(context,attribution.resolve({explicit:init?.requestLog,caller:context.caller,type:context.type,kind,body}));
    if (context.caller === 'chat' && !NOT_SEND_TYPES.includes(context.type)) context.sendTrace = takeSendTrace();
    if (settings().ignoreCallers.includes(context.caller)) return nativeFetch(input, init);

    const acc = makeAccumulator();
    let response;
    try {
        response = await nativeFetch(input, init);
    } catch (error) {
        context.aborted = !!(init?.signal?.aborted||input?.signal?.aborted||error?.name==='AbortError');
        finishEntry(context, null, acc, marks, error);
        throw error;
    }

    // 원래 응답은 손대지 않고, 복사본을 뒤에서 읽는다.
    const copy = response.clone();
    (async () => {
        let failure = null;
        try {
            const contentType = copy.headers.get('content-type') ?? '';
            if (!response.ok) {
                const text = await copy.text();
                marks.firstByte = performance.now();
                context.rawError = text.slice(0, 4000);
                try {
                    absorbChunk(JSON.parse(text), acc);
                } catch {
                    if (text.trim()) acc.error = text.trim().slice(0, 300);
                }
            } else if (contentType.includes('text/event-stream') || (context.stream && !contentType.includes('application/json'))) {
                await readStream(copy.body, acc, marks);
            } else if(contentType.startsWith('audio/')||contentType.startsWith('image/')||contentType.includes('octet-stream')) {
                marks.firstByte=performance.now();
                copy.body?.cancel().catch(()=>{});
            } else {
                const text = await copy.text();
                marks.firstByte = performance.now();
                try {
                    const data=JSON.parse(text);
                    if(!context.model&&typeof data.model==='string')context.model=data.model;
                    absorbChunk(data, acc);
                } catch {
                    acc.text = kind==='text'?text:'';
                }
            }
        } catch (error) {
            failure = error;
            context.aborted = !!init?.signal?.aborted || /abort/i.test(String(error?.name ?? ''));
        }
        // [1.2.3] 끊김 감시 1.1.1 은 멈춘 스트림을 오류가 아니라 "끝"으로 닫고(실리태번이 받은 글을 다 남기게), 끊었다는 표시를
        // 응답 객체의 streamWatchdog 에 남긴다. 복사본은 정상으로 끝나 보이니 그 표시로 끊김을 적는다.
        const stall = response?.streamWatchdog;
        if (!failure && stall?.stalled) failure = stall.error ?? new Error('Stream stalled');
        // 스트림이 오류로 끝나는 경우, 이미 받은 글이 있으면 중단으로 본다.
        if (failure && acc.text) {
            acc.finish = acc.finish || 'aborted';
        }
        await finishEntry(context, response, acc, marks, failure);
    })();

    return response;
}

function safeChatId() {
    try {
        return getCurrentChatId() ?? null;
    } catch {
        return null;
    }
}

function safeName() {
    try {
        return name2 ?? null;
    } catch {
        return null;
    }
}

export function installCapture() {
    if (installed) return;
    installed = true;
    globalThis[LOG_BRIDGE]={begin:attribution.begin};
    const nativeFetch = window.fetch;
    window.fetch = function requestLogFetch(input, init) {
        try {
            const path=pathOf(input);
            const captureKind=requestKind(path);
            const row = path ? traceFetchStart(path) : null;
            if (row && !(settings().enabled&&captureKind)) {
                const started = performance.now();
                const request = nativeFetch.call(this, input, init);
                request.then(() => { row.ms = Math.round(performance.now() - started); }, () => { row.ms = Math.round(performance.now() - started); });
                return request;
            }
            if (settings().enabled && init && typeof init.body === 'string' && captureKind) {
                let body = null;
                try {
                    body = JSON.parse(init.body);
                } catch {
                    body = null;
                }
                if (body && typeof body === 'object') return watch(nativeFetch, input, init, body);
            }
            if(settings().enabled&&captureKind&&init?.body instanceof FormData) {
                const body=Object.fromEntries([...init.body].filter(([,v])=>typeof v==='string'));
                return watch(nativeFetch,input,init,body);
            }
            if(settings().enabled&&captureKind&&input instanceof Request&&!init?.body) {
                const caller=callerFromStack();
                return input.clone().text().then(text=>{
                    let body;try{body=JSON.parse(text);}catch{return nativeFetch.call(this,input,init);}
                    return body&&typeof body==='object'?watch(nativeFetch,input,init,body,caller):nativeFetch.call(this,input,init);
                },()=>nativeFetch.call(this,input,init));
            }
        } catch (error) {
            console.warn('[요청 로그] 요청을 살피지 못했어요', error);
        }
        return nativeFetch.call(this, input, init);
    };
}
