// Repeats the chat's last request unchanged (same prompt, same settings, streaming off) so a reply can be
// replaced before the translator sees it. Only SillyTavern glue lives here; decisions are made in core.js.
import {
    cleanUpMessage,
    eventSource,
    event_types,
    extractMessageFromData,
    getRequestHeaders,
    hideSwipeButtons,
    main_api,
    setSendButtonState,
    showSwipeButtons,
    syncMesToSwipe,
} from '../../../../../../../script.js';
import { getRegexedString, regex_placement } from '../../../../../../extensions/regex/engine.js';
import { power_user } from '../../../../../../power-user.js';
import * as reasoningModule from '../../../../../../reasoning.js';
import { getTokenCountAsync } from '../../../../../../tokenizers.js';
import { chatSwitchTarget } from './guards.js';

const { extractReasoningFromData, parseReasoningFromString } = reasoningModule;
// Added to SillyTavern in December 2025 (Gemini thought signatures); a namespace import keeps older builds loading.
const extractReasoningSignatureFromData = reasoningModule.extractReasoningSignatureFromData ?? (() => null);

const GENERATE_URL = '/api/backends/chat-completions/generate';
// Generation types whose request may be repeated. Quiet requests (extensions, /gen), impersonation and continues
// (their body ends with the partial reply) are never resent.
const REPLY_TYPES = ['normal', 'swipe', 'regenerate'];

/**
 * @typedef {object} CapturedRequest
 * @property {object[]} prompt Prompt messages from GENERATE_AFTER_DATA
 * @property {object | null} request Full request body from CHAT_COMPLETION_SETTINGS_READY, after every extension touched it
 */

/** @type {CapturedRequest | null} */
let captured = null;
// Type of the Generate() in progress, from GENERATION_STARTED: GENERATE_AFTER_DATA carries no type, and quiet
// generations (extensions, /gen) can run between the reply's request and its MESSAGE_RECEIVED.
let startedType = null;
const watchers = new Set();

function notify() {
    for (const watcher of watchers) {
        try {
            watcher();
        } catch (error) {
            console.warn('[다시 쓰기] 요청 감시 콜백 오류', error);
        }
    }
}

/** Starts remembering what the chat sends. `onChange` runs whenever a new request is captured. */
export function watchRequests(onChange) {
    if (onChange) watchers.add(onChange);
    if (watchers.size > 1) return;

    eventSource.on(event_types.GENERATION_STARTED, (type, _params, dryRun) => {
        if (!dryRun) startedType = type;
    });
    eventSource.on(event_types.GENERATE_AFTER_DATA, (generateData, dryRun) => {
        if (dryRun || !REPLY_TYPES.includes(startedType)) return;
        // 텍스트 완성 등 다른 API로 답을 받으면 예전 채팅 완성 요청은 더는 마지막 요청이 아니다. 남겨 두면 API를 바꾼 뒤
        // 답변마다 그 옛 요청으로 리롤하려다 실패한다.
        if (main_api !== 'openai') {
            if (captured) {
                captured = null;
                notify();
            }
            return;
        }
        if (!Array.isArray(generateData?.prompt)) return;
        // The settings-ready event for this same generation follows right away and fills in the body.
        captured = { prompt: generateData.prompt, request: null };
        notify();
    });
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, (generateData) => {
        if (!generateData || !Array.isArray(generateData.messages) || !REPLY_TYPES.includes(generateData.type)) return;
        if (captured && !captured.request) {
            captured.request = generateData;
        } else {
            captured = { prompt: generateData.messages, request: generateData };
        }
        notify();
    });
}

/**
 * The last chat request, or null before the first one. Take it once per reply: later quiet generations must not
 * change what a reroll resends between attempts.
 * @returns {CapturedRequest | null}
 */
export function capturedRequest() {
    return captured;
}

/** The messages of a captured request. */
export function capturedMessages(request = captured) {
    return request?.request?.messages ?? request?.prompt ?? null;
}

// Same test SillyTavern's sendOpenAIRequest makes; a top-level `message` is a Cohere reply, not an error.
function apiErrorMessage(payload) {
    const error = payload?.error ?? payload?.detail?.error;
    if (!error) return '';
    const message = typeof error === 'string' ? error : (error?.message || error?.code || error?.type);
    return String(message || '알 수 없는 오류');
}

async function repeatRequest(request, signal) {
    // Same body SillyTavern sent, minus streaming and multi-swipe.
    const body = { ...request, stream: false, n: undefined };
    const response = await fetch(GENERATE_URL, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body),
        cache: 'no-cache',
        signal,
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        let message = '';
        try {
            message = apiErrorMessage(JSON.parse(text));
        } catch {
            message = text.slice(0, 200);
        }
        throw new Error(message || `API 응답 코드 ${response.status}`);
    }
    const data = await response.json();
    const message = apiErrorMessage(data);
    if (message) throw new Error(message);
    return data;
}

/** Reply text as SillyTavern will show it: with the thinking block removed when auto-parse would strip it. */
export function visibleText(message) {
    const text = String(message?.mes ?? '');
    if (message?.extra?.reasoning || !power_user.reasoning?.auto_parse) return text;
    return parseReasoningFromString(text)?.content ?? text;
}

/**
 * Sends a captured chat request again and returns the reply the way SillyTavern would store it.
 * @param {CapturedRequest | null} request From capturedRequest()
 * @param {AbortSignal} signal
 * @returns {Promise<{text: string, reasoning: string, signature: string | null}>}
 */
export async function regenerateReply(request, signal) {
    if (main_api !== 'openai') throw new Error('채팅 완성(Chat Completion) API에서만 다시 생성할 수 있어요.');
    if (!request?.request) throw new Error('마지막 요청을 아직 못 잡았어요.');
    const data = await repeatRequest(request.request, signal);

    let text = extractMessageFromData(data, 'openai');
    let reasoning = getRegexedString(extractReasoningFromData(data, { mainApi: 'openai' }) || '', regex_placement.REASONING);
    const signature = extractReasoningSignatureFromData(data, { mainApi: 'openai' });
    text = cleanUpMessage({ getMessage: text, isImpersonate: false, isContinue: false, displayIncompleteSentences: false });
    if (power_user.trim_spaces) {
        text = text.trim();
        reasoning = reasoning.trim();
    }
    if (!reasoning && power_user.reasoning?.auto_parse) {
        const parsed = parseReasoningFromString(text);
        if (parsed?.reasoning) {
            reasoning = parsed.reasoning;
            text = parsed.content;
        }
    }
    return { text, reasoning, signature };
}

/** Writes a regenerated reply into the message the way saveReply would have. */
export async function replaceReply(messageId, message, { text, reasoning, signature }) {
    message.mes = text;
    message.extra = message.extra && typeof message.extra === 'object' ? message.extra : {};
    message.extra.reasoning = reasoning || '';
    message.extra.reasoning_duration = null;
    message.extra.reasoning_signature = signature ?? null;
    // Streaming-only bookkeeping from the discarded reply.
    delete message.extra.reasoning_type;
    delete message.extra.time_to_first_token;
    message.gen_finished = new Date();
    if (power_user.message_token_count_enabled) {
        message.extra.token_count = await getTokenCountAsync((reasoning || '') + text, 0);
        $(`#chat .mes[mesid="${messageId}"] .tokenCounterDisplay`).text(`${message.extra.token_count}t`);
    }
    // After streaming the swipe copy already exists; without streaming saveReply fills it in after we return.
    syncMesToSwipe(messageId);
}

/**
 * Keeps the send UI locked while a reply is regenerated or rewritten and aborts `controller` when the user presses Stop.
 * Toggles the pieces itself: activateSendButtons() would hide the Stop button through hideStopButton(), which
 * emits a second GENERATION_ENDED for the same reply.
 * @returns {() => void} Restores whatever state the UI had before.
 */
export function holdGeneration(controller) {
    const wasLocked = document.body.dataset.generating === 'true';
    if (!wasLocked) {
        setSendButtonState(true);
        // showStopButton()/hideStopButton() are not exported; this is what they do.
        $('#mes_stop').css({ display: 'flex' });
        hideSwipeButtons();
        document.body.dataset.generating = 'true';
    }
    const onStop = () => controller.abort();
    eventSource.on(event_types.GENERATION_STOPPED, onStop);
    // 1.7.5: 붙잡고 있는 동안 지난 채팅 · 체크포인트 · 분기로 채팅을 바꾸지 못하게 한다 (실리태번이 이 답을 저장하기 전이라 답이 사라진다).
    // 잠금이 원래 걸려 있던 경우(스트리밍 끔)도 같다. 멈춤을 누르면 곧 풀린다.
    const onClick = (event) => {
        if (!chatSwitchTarget(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        toastr.info('다시 쓰는 중이에요. 끝난 뒤에 채팅을 바꿔 주세요.', '다시 쓰기', { preventDuplicates: true });
    };
    window.addEventListener('click', onClick, true);
    return () => {
        window.removeEventListener('click', onClick, true);
        eventSource.removeListener(event_types.GENERATION_STOPPED, onStop);
        if (!wasLocked) {
            setSendButtonState(false);
            $('#mes_stop').css({ display: 'none' });
            showSwipeButtons();
            delete document.body.dataset.generating;
        }
    };
}

/** Runs `task` with its own abort signal that fires on the parent signal or after `seconds`. */
export async function withTimeout(task, seconds, parent) {
    const child = new AbortController();
    const abort = () => child.abort();
    if (parent.aborted) abort();
    parent.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, seconds * 1000);
    try {
        return await task(child.signal);
    } finally {
        clearTimeout(timer);
        parent.removeEventListener('abort', abort);
    }
}
