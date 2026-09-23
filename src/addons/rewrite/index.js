import {
    eventSource,
    event_types,
    generateRaw,
    getRequestHeaders,
    isChatSaving,
    main_api,
    saveChatConditional,
    saveSettingsDebounced,
    substituteParams,
    updateMessageBlock,
} from '../../../../../../../script.js';
import { extension_settings, getContext } from '../../../../../../extensions.js';
import { ChatCompletionService } from '../../../../../../custom-request.js';
import { oai_settings } from '../../../../../../openai.js';
import { POPUP_TYPE, callGenericPopup } from '../../../../../../popup.js';
import { SECRET_KEYS, secret_state } from '../../../../../../secrets.js';
import { ConnectionManagerRequestService } from '../../../../../shared.js';
import {
    activateRules,
    checkReplyStart,
    compilePattern,
    compileRule,
    findActiveExceptions,
    findRepeats,
    findSpans,
    mergeSpans,
    prepareSpans,
    promptHasMarker,
    rerollUntil,
    rewriteText,
    splitNames,
} from './core.js';
import { DEFAULT_SETTINGS } from './defaults.js';
import { PERSONAL } from './defaults-personal.js';
import { isEditingMessage } from './guards.js';
import { createSpanFinder } from './spans.js';
import { PROVIDERS, applyModelRequestRules, isHttpUrl, modelIdsFrom, normalizeUrl, pruneModelLists, resolveModel } from './providers.js';
import { capturedMessages, capturedRequest, holdGeneration, regenerateReply, replaceReply, visibleText, watchRequests, withTimeout } from './reroll.js';
import { applyUpgrades } from './upgrades.js';
import { startQuickBan } from './quick-ban.js';

const VERSION = '1.9.2';
const MODULE = 'ban_word_rewrite';
// Rules shipped before offeredRules existed (v1.6.0); installs from then already have or deleted them.
const FIRST_RULE_IDS = ['glasses', 'beard', 'tan', 'cane', 'ears'];
// Same for exceptions before offeredExceptions existed (v1.7.0).
const FIRST_EXCEPTION_IDS = ['belford'];
const TRANSLATOR_MODULE = 'llm-translator-custom';
// Template path relative to scripts/extensions, taken from where this file is served so a renamed folder still works.
const EXTENSION_PATH = decodeURIComponent(new URL('.', import.meta.url).pathname)
    .replace(/^.*\/scripts\/extensions\//, '')
    .replace(/\/$/, '');
const FOLDER = EXTENSION_PATH.split('/').pop();
// 1.8.0: the same files also ship inside the Blue Lemonade theme (src/addons/rewrite). There the theme decides when
// to load this module and where the settings go (openPanel / mountInline); on its own it is a settings drawer.
const EMBEDDED = /\/src\/addons\/rewrite$/.test(EXTENSION_PATH);
const TITLE = '다시 쓰기';
const SKIP_TYPES = ['impersonate', 'quiet', 'first_message', 'command', 'extension'];
// A continued reply keeps its old beginning, so its start is never re-checked. With streaming off SillyTavern
// finishes a continue through saveReply as 'appendFinal' (and 'append'), not 'continue'.
const REROLL_SKIP_TYPES = [...SKIP_TYPES, 'continue', 'appendFinal', 'append'];
const TAB_STORAGE_KEY = 'bwr_active_tab';
const CONNECTION_HINTS = {
    current: '지금 채팅에 쓰는 모델로 고쳐요.',
    direct: 'API 키는 SillyTavern 본체 API 연결에 저장된 키를 써요. 목록에 없는 모델은 맨 아래 커스텀 모델 입력으로 넣으세요.',
    profile: 'SillyTavern 연결 관리자(Connection Manager)에 저장한 프로필을 써요.',
};

let settings = loadSettings();
let compiled = [];
let startPattern = { regexes: [], errors: [] };
let markerPattern = { regexes: [], errors: [] };
recompile();

function loadSettings() {
    // Defaults stay in memory until the user changes something, so loading never rewrites settings.json.
    if (!extension_settings[MODULE]) {
        extension_settings[MODULE] = structuredClone(DEFAULT_SETTINGS);
    }
    const stored = extension_settings[MODULE];
    // v1.0 only had profileId: a chosen profile meant "use that profile".
    if (stored.connection === undefined) {
        stored.connection = stored.profileId ? 'profile' : 'current';
    }
    // Default rules and exceptions added in later versions are appended once; a deleted one stays deleted.
    if (Array.isArray(stored.rules)) {
        if (!Array.isArray(stored.offeredRules)) stored.offeredRules = [...FIRST_RULE_IDS];
        for (const rule of DEFAULT_SETTINGS.rules) {
            if (stored.offeredRules.includes(rule.id)) continue;
            if (!stored.rules.some(item => item.id === rule.id)) stored.rules.push(structuredClone(rule));
            stored.offeredRules.push(rule.id);
        }
    }
    if (Array.isArray(stored.exceptions)) {
        if (!Array.isArray(stored.offeredExceptions)) stored.offeredExceptions = [...FIRST_EXCEPTION_IDS];
        for (const exception of DEFAULT_SETTINGS.exceptions) {
            if (stored.offeredExceptions.includes(exception.id)) continue;
            if (!stored.exceptions.some(item => item.id === exception.id)) stored.exceptions.push(structuredClone(exception));
            stored.offeredExceptions.push(exception.id);
        }
    }
    // Default rules/exceptions whose contents changed after they were shipped (see upgrades.js).
    if (Array.isArray(stored.rules) && Array.isArray(stored.exceptions)) applyUpgrades(stored);
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (stored[key] === undefined) stored[key] = structuredClone(value);
    }
    stored.models = { ...DEFAULT_SETTINGS.models, ...stored.models };
    if (!stored.customModelLists || typeof stored.customModelLists !== 'object' || Array.isArray(stored.customModelLists)) {
        stored.customModelLists = {};
    }
    stored.scenePlan = { ...DEFAULT_SETTINGS.scenePlan, ...stored.scenePlan };
    stored.repeat = { ...DEFAULT_SETTINGS.repeat, ...(stored.repeat && typeof stored.repeat === 'object' ? stored.repeat : {}) };
    return stored;
}

function recompile() {
    compiled = settings.rules.filter(rule => rule.enabled !== false).map(compileRule);
    startPattern = compilePattern(settings.scenePlan.startPattern, { anchored: true });
    markerPattern = compilePattern(settings.scenePlan.promptPattern);
}

// "이 캐릭터에게만" names, with {{user}} / {{char}} expanded to the current persona and character.
function resolveNames(names) {
    return splitNames(names ? substituteParams(names) : '');
}

/** Rules in play for this text: limited rules only while one of their characters is in the recent messages. */
function rulesFor(recent) {
    return activateRules(compiled, recent, resolveNames);
}

function newId(prefix) {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function textNode(text) {
    const element = document.createElement('div');
    element.textContent = text;
    return element;
}

// ── Connections ───────────────────────────────────────

function hasSecret(name) {
    const value = secret_state[SECRET_KEYS[name]];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

// Trailing slashes are dropped: the server appends '/chat/completions', and '/v1/' would become '/v1//…' (404).
function customEndpoint() {
    const own = normalizeUrl(settings.customUrl);
    if (own) return { url: own, inheritExtras: false };
    return { url: normalizeUrl(oai_settings?.custom_url), inheritExtras: true };
}

// ── Custom endpoint model list ────────────────────────
// Fetched through SillyTavern's /status, the same call its own Connect button makes: the server adds the stored
// Custom key and asks <url>/models, so the key never reaches the page. A freshly typed address is only asked when
// the button is pressed (a typo must not receive the key); the saved one is fetched quietly while it has no list.

const MODEL_FETCH_TIMEOUT_MS = 30000;
/** @type {Map<string, Promise<{ok: boolean, ids: string[], error?: Error}>>} In-flight requests by address */
const modelFetches = new Map();
let lastRenderedCustomUrl = null;

/** The list fetched for `url`: ours, else the one LLM Translator keeps for the same address. */
function cachedModelList(url) {
    const own = settings.customModelLists?.[url];
    if (Array.isArray(own?.models)) return { models: own.models, fetchedAt: own.fetchedAt, from: '' };
    const translator = extension_settings[TRANSLATOR_MODULE]?.custom_model_lists?.[url];
    if (Array.isArray(translator?.models)) return { models: translator.models, fetchedAt: translator.fetched_at, from: 'LLM 번역기 목록' };
    return null;
}

function renderModelsStatus(message) {
    const status = $('#bwr_models_status');
    if (message) {
        status.text(message);
        return;
    }
    const { url, inheritExtras } = customEndpoint();
    if (!url) {
        status.text('주소를 넣거나 본체의 Custom 연결을 설정하면 그 서버의 모델 목록을 받아올 수 있어요.');
        return;
    }
    const where = inheritExtras ? '본체 설정 주소' : '위 주소';
    if (modelFetches.has(url)) {
        status.text(`모델 목록을 불러오는 중… (${url})`);
        return;
    }
    const list = cachedModelList(url);
    if (!list) {
        status.text(`아직 안 불러왔어요 (${where}: ${url})`);
        return;
    }
    const when = list.fetchedAt ? new Date(list.fetchedAt).toLocaleString() : '';
    status.text(`모델 ${list.models.length}개 · ${[when, list.from || where].filter(Boolean).join(' · ')}`);
}

// Locked only while the address on screen is being asked; another address can still be fetched right away.
function syncFetchButton() {
    $('#bwr_fetch_models').toggleClass('bwr_busy', modelFetches.has(customEndpoint().url));
}

async function requestModelIds(url, includeHeaders) {
    let response;
    try {
        response = await fetch('/api/backends/chat-completions/status', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ chat_completion_source: 'custom', custom_url: url, custom_include_headers: includeHeaders }),
            cache: 'no-cache',
            signal: AbortSignal.timeout(MODEL_FETCH_TIMEOUT_MS),
        });
    } catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
            throw new Error(`${MODEL_FETCH_TIMEOUT_MS / 1000}초 안에 응답이 없어요`);
        }
        throw error;
    }
    if (!response.ok) throw new Error(`서버 응답 ${response.status} ${response.statusText}`.trim());
    const ids = modelIdsFrom(await response.json());
    if (!ids) throw new Error('엔드포인트가 모델 목록을 돌려주지 않았어요. 주소(끝의 /v1까지)와 API 키를 확인해 주세요.');
    return ids;
}

async function fetchCustomModels({ silent = false } = {}) {
    const endpoint = customEndpoint();
    const { url } = endpoint;
    if (!isHttpUrl(url)) {
        renderModelsStatus(url ? `올바른 주소가 아니에요: ${url}` : '커스텀 엔드포인트 주소가 비어 있어요.');
        if (!silent) toastr.warning('커스텀 엔드포인트 주소를 먼저 넣어 주세요. (예: http://127.0.0.1:5001/v1)', TITLE);
        return;
    }
    const isCurrent = () => customEndpoint().url === url;

    // A second press for the same address waits for the request already running.
    let job = modelFetches.get(url);
    if (!job) {
        const includeHeaders = endpoint.inheritExtras ? substituteParams(oai_settings?.custom_include_headers || '') : '';
        job = requestModelIds(url, includeHeaders)
            .then((ids) => {
                settings.customModelLists[url] = { models: ids, fetchedAt: new Date().toISOString() };
                pruneModelLists(settings.customModelLists, url);
                // A name typed into the free-text box that the server lists becomes the picked entry (same name sent).
                const typed = String(settings.customModels.custom ?? '').trim();
                if (isCurrent() && settings.models.custom === 'custom' && ids.includes(typed)) settings.models.custom = typed;
                saveSettingsDebounced();
                return { ok: true, ids };
            })
            .catch((error) => {
                console.warn(`[${TITLE}] 모델 목록 불러오기 실패:`, url, error);
                return { ok: false, ids: [], error };
            })
            .finally(() => modelFetches.delete(url));
        modelFetches.set(url, job);
    }
    syncFetchButton();
    if (isCurrent()) renderModelsStatus(`모델 목록을 불러오는 중… (${url})`);

    const result = await job;
    syncFetchButton();
    // The address changed while waiting: the screen now belongs to the new address.
    if (!isCurrent()) return;
    if (settings.provider === 'custom') renderModels();
    if (!result.ok) console.warn(`[${TITLE}] 모델 목록 실패:`, result.error);
    const reason = result.ok ? '' : friendlyError(result.error?.message || result.error) || '알 수 없는 오류';
    if (!result.ok) renderModelsStatus(`불러오기 실패: ${reason}`);
    if (silent) return;
    if (!result.ok) {
        toastr.error(`모델 목록을 불러오지 못했어요: ${reason}`, TITLE);
    } else if (result.ids.length === 0) {
        toastr.warning('엔드포인트가 빈 모델 목록을 돌려줬어요.', TITLE);
    } else {
        toastr.success(`모델 ${result.ids.length}개를 불러왔어요.`, TITLE);
        const picked = settings.models.custom;
        if (picked && picked !== 'custom' && !result.ids.includes(picked)) {
            toastr.warning(`지금 고른 모델 '${picked}'은(는) 이 주소의 목록에 없어요. 목록에서 다시 골라 주세요.`, TITLE);
        }
    }
}

/** Fetches the saved address's list quietly when it has none yet (first load, switching to Custom). */
function autoFetchModels() {
    if (settings.connection !== 'direct' || settings.provider !== 'custom') return;
    const { url } = customEndpoint();
    if (isHttpUrl(url) && !cachedModelList(url) && !modelFetches.has(url)) fetchCustomModels({ silent: true });
}

// Same request shape as LLM Translator, sent through SillyTavern's ChatCompletionService.
async function generateDirect(messages, signal) {
    const provider = PROVIDERS[settings.provider];
    if (!provider) throw new Error(`알 수 없는 공급자예요: ${settings.provider}`);
    const model = resolveModel(settings);
    if (!model) throw new Error('모델명이 비어 있어요. 커스텀 모델명을 입력해 주세요.');

    const request = {
        messages,
        model,
        chat_completion_source: provider.source,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: false,
    };

    if (settings.provider === 'custom') {
        const endpoint = customEndpoint();
        if (!endpoint.url) throw new Error('커스텀 엔드포인트 주소가 없어요. 주소를 넣거나 본체의 Custom 연결을 설정해 주세요.');
        request.custom_url = endpoint.url;
        if (endpoint.inheritExtras) {
            request.custom_include_body = substituteParams(oai_settings?.custom_include_body || '');
            request.custom_exclude_body = substituteParams(oai_settings?.custom_exclude_body || '');
            request.custom_include_headers = substituteParams(oai_settings?.custom_include_headers || '');
        }
    } else if (!settings.useReverseProxy && !provider.secrets.some(hasSecret)) {
        throw new Error(`${provider.label} API 키가 SillyTavern에 저장되어 있지 않아요.`);
    }

    if (settings.provider === 'vertexai') {
        // Follow SillyTavern's Vertex settings; without a region the server pins us-central1.
        request.vertexai_auth_mode = oai_settings?.vertexai_auth_mode || 'full';
        request.vertexai_region = oai_settings?.vertexai_region || 'us-central1';
        request.vertexai_express_project_id = oai_settings?.vertexai_express_project_id || '';
    }
    if (settings.useReverseProxy && settings.reverseProxyUrl) {
        request.reverse_proxy = settings.reverseProxyUrl;
        request.proxy_password = settings.reverseProxyPassword;
    }

    applyModelRequestRules(settings.provider, model, request);
    const result = await ChatCompletionService.processRequest(request, {}, true, signal);
    return result?.content ?? '';
}

async function generateWithProfile(messages, signal) {
    if (!settings.profileId) throw new Error('연결 프로필을 골라 주세요.');
    const result = await ConnectionManagerRequestService.sendRequest(settings.profileId, messages, settings.maxTokens, {
        stream: false,
        signal,
        extractData: true,
        includePreset: true,
    });
    return result?.content ?? '';
}

/**
 * @param {{role: string, content: string}[]} messages
 * @param {AbortSignal} [signal] 멈춤 버튼 (자동 고쳐 쓰기에서만)
 */
async function generate(messages, signal) {
    signal?.throwIfAborted();
    const controller = new AbortController();
    let timer;
    let onStop;
    const timeout = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
            controller.abort();
            reject(new Error(`${settings.timeoutSec}초 안에 응답이 없어요`));
        }, settings.timeoutSec * 1000);
        // 멈추면 응답을 기다리지 않는다 (현재 연결의 generateRaw는 GENERATION_STOPPED를 직접 듣고 요청을 끊는다).
        onStop = () => {
            controller.abort();
            reject(new Error('멈춤 버튼을 눌렀어요'));
        };
        signal?.addEventListener('abort', onStop, { once: true });
    });
    let request;
    if (settings.connection === 'direct') {
        request = generateDirect(messages, controller.signal);
    } else if (settings.connection === 'profile') {
        request = generateWithProfile(messages, controller.signal);
    } else {
        request = generateRaw({ prompt: messages, trimNames: false });
    }
    try {
        return await Promise.race([request, timeout]);
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onStop);
    }
}

// ── Translator hand-off ───────────────────────────────
// LLM 번역기는 MESSAGE_UPDATED를 받아도 번역문이 이미 붙은 메시지만 다시 번역한다. 끊긴 스트림처럼 번역기가 옛 본문을
// 번역하는 도중에 본문을 바꾸면, 그 알림은 그냥 지나가고 조금 뒤 옛 본문의 번역이 붙어 저장된다. 그래서 옛 본문의 번역이
// 끝났다는 신호(EXTENSION_LLM_TRANSLATE_DONE)를 보면 한 번 더 알린다. 번역기는 그 신호 뒤 채팅을 저장하고서야
// '번역 중' 표시를 풀고, 그 전에 알리면 다시 번역을 건너뛰므로 저장이 끝날 때까지 기다렸다가 알린다.

const TRANSLATE_DONE_EVENT = 'EXTENSION_LLM_TRANSLATE_DONE';
const STALE_TRANSLATION_WATCH_MS = 10 * 60 * 1000;
// saveChatConditional은 100ms마다 앞선 저장이 끝났는지 본다. 그보다 넉넉히 저장이 없으면 번역기의 저장도 끝난 것이다.
const SAVE_QUIET_MS = 500;
const SAVE_WAIT_MAX_MS = 60 * 1000;
/** @type {Map<string, () => void>} 메시지별 감시 해제 함수 */
const staleTranslationWatches = new Map();

async function waitForChatSaves() {
    const started = Date.now();
    let quietSince = started;
    while (Date.now() - started < SAVE_WAIT_MAX_MS) {
        await new Promise(resolve => setTimeout(resolve, 50));
        if (isChatSaving) quietSince = Date.now();
        else if (Date.now() - quietSince >= SAVE_QUIET_MS) return;
    }
}

function watchStaleTranslation(messageId) {
    const message = getContext().chat[messageId];
    if (!message) return;
    const key = busyKey(messageId);
    staleTranslationWatches.get(key)?.();

    const stop = () => {
        clearTimeout(timer);
        eventSource.removeListener(TRANSLATE_DONE_EVENT, onDone);
        eventSource.removeListener(event_types.CHAT_CHANGED, stop);
        if (staleTranslationWatches.get(key) === stop) staleTranslationWatches.delete(key);
    };
    const onDone = (data) => {
        if (Number(data?.messageId) !== messageId) return;
        stop();
        const context = getContext();
        // 번역기와 같은 방식으로 본 지금 본문의 번역이면 할 일이 없다.
        if (context.chat[messageId] !== message || data.originalText === substituteParams(message.mes, context.name1, message.name)) return;
        waitForChatSaves().then(async () => {
            if (getContext().chat[messageId] !== message || !message.extra?.display_text) return;
            console.debug(`[${TITLE}] 바뀌기 전 본문의 번역이 늦게 붙어서 다시 번역을 요청해요 (#${messageId})`);
            await eventSource.emit(event_types.MESSAGE_UPDATED, messageId);
        });
    };
    const timer = setTimeout(stop, STALE_TRANSLATION_WATCH_MS);
    eventSource.on(TRANSLATE_DONE_EVENT, onDone);
    eventSource.on(event_types.CHAT_CHANGED, stop);
    staleTranslationWatches.set(key, stop);
}

/** Tells LLM Translator the message text changed, including when it is still translating the old text. */
async function notifyTextChanged(messageId) {
    watchStaleTranslation(messageId);
    await eventSource.emit(event_types.MESSAGE_UPDATED, messageId);
}

// ── Rewriting ─────────────────────────────────────────

function log(verdict, original, rewrite) {
    console.debug(`[${TITLE}] ${verdict}:`, original, '→', rewrite);
}

// 1.7.6 답 끝의 금지 묘사 찾기는 워커에서 (spans.js). 못 쓰면 화면 스레드에서 예전처럼
const spanFinder = createSpanFinder({
    createWorker: () => new Worker(new URL(`./spans-worker.js?v=${VERSION}`, import.meta.url), { type: 'module' }),
    fallback: findSpans,
    warn: reason => console.warn(`[${TITLE}] 금지 묘사 찾기 워커를 못 써서 화면에서 찾아요:`, reason),
});

// 1.7.6 알림은 화면이 한 번 그려진 뒤에 띄운다. 답을 다시 그린 바로 뒤에 toastr 가 나타나는 애니메이션을 시작하면
// jQuery 가 계산 스타일을 읽어 채팅 전체의 스타일 계산을 그 자리에서 강제로 돌렸다 (폰 흉내 4배 CPU 답 한 번 0.4초).
// 화면이 꺼져 있으면 requestAnimationFrame 이 안 와서 1초 뒤에는 그냥 띄운다
function afterPaint() {
    return new Promise((resolve) => {
        let done = false;
        const go = () => {
            if (done) return;
            done = true;
            resolve();
        };
        requestAnimationFrame(() => setTimeout(go, 0));
        setTimeout(go, 1000);
    });
}

/** 나중에 띄우는 진행 알림 — 돌려받은 함수로 지운다 (띄우기 전에 끝나면 아예 안 띄움) */
function laterToast(show) {
    let toast = null;
    let cancelled = false;
    afterPaint().then(() => {
        if (!cancelled) toast = show();
    });
    return () => {
        cancelled = true;
        if (toast) toastr.clear(toast);
    };
}

// 1.8.7 — provider errors used to reach the toasts in English ("Resource has been exhausted (e.g. check quota).").
// Known wordings become Korean; anything else is shown exactly as it came, and every caller logs the raw error.
// Words are read before numbers: "429 Too Many Requests" and "503 Service Unavailable" carry their own words, so a
// bare number in a sentence ("500 tokens left") is never taken for a status code — only a labelled or bracketed one.
// Chinese lines are the new-api relay's own wording.
function friendlyError(error) {
    const text = String(error?.message ?? error ?? '').trim();
    if (!text) return '';
    const lower = text.toLowerCase();
    const has = (...words) => words.some(word => lower.includes(word));
    const status = (...codes) => new RegExp(
        String.raw`(?:\[\s*(?:${codes.join('|')})\s*\]|(?:status|code|http|error)\D{0,10}(?:${codes.join('|')}))(?!\d)`, 'i').test(text);
    if (has('rate limit', 'rate_limit', 'too many requests')) return '요청이 너무 잦아요. 잠깐 쉬었다 다시 해 주세요.';
    if (has('resource has been exhausted', 'resource_exhausted', 'quota', '额度', '余额不足') || status('429'))
        return '쓸 수 있는 양(할당량)을 다 썼어요. 잠시 뒤에 다시 하거나 다른 모델·키를 써 주세요.';
    if (has('prohibited_content', 'safety', 'blocked', 'recitation', 'content filter', 'content_filter'))
        return '모델이 이 내용을 거절했어요 (안전 필터). 같은 내용은 다시 해도 막혀요.';
    if (has('api key', 'api_key', 'unauthenticated', 'invalid authentication', 'permission_denied', 'permission denied', '无可用渠道') || status('401', '403'))
        return 'API 키가 없거나 권한이 없어요. 키와 주소를 확인해 주세요.';
    if (has('overloaded', 'unavailable', 'service_unavailable', 'capacity', '饱和') || status('502', '503'))
        return '모델 쪽 서버가 붐벼요. 잠시 뒤에 다시 해 주세요.';
    if (has('deadline', 'timed out', 'timeout', 'etimedout')) return '시간 안에 답이 오지 않았어요.';
    if (has('failed to fetch', 'network error', 'networkerror', 'err_network', 'econnrefused', 'enotfound'))
        return '연결이 끊겼어요. 인터넷과 주소를 확인해 주세요.';
    if (has('internal error', 'internal server error', 'internal_server_error') || status('500'))
        return '모델 쪽에서 오류가 났어요. 다시 해 주세요.';
    if (has('not found', 'does not exist', 'no such model') || status('404')) return '그 모델이나 주소를 찾을 수 없어요.';
    if (has('context length', 'maximum context', 'token limit', 'too long')) return '보낸 글이 모델이 받을 수 있는 길이를 넘었어요.';
    return text;
}

function report(result, total, manual) {
    afterPaint().then(() => showReport(result, total, manual));
}

function showReport({ fixed, failed, error }, total, manual) {
    const kept = total - fixed - failed;
    if (failed > 0) {
        const done = fixed > 0 ? ` (${fixed}곳은 고침)` : '';
        if (error) console.warn(`[${TITLE}] 고쳐 쓰기 실패:`, error);
        const friendly = friendlyError(error);
        const reason = friendly ? ` ${friendly}` : '';
        toastr.warning(`${failed}곳은 못 고쳐서 원문 그대로 뒀어요${done}.${reason}`, TITLE);
        return;
    }
    // Nothing changed (coincidental match or an exception's own trait): stay quiet unless asked.
    if (fixed === 0 && !manual) return;
    if (settings.notify || manual) {
        const parts = [];
        if (fixed > 0) parts.push(`${fixed}곳 고쳤어요`);
        if (kept > 0) parts.push(`${kept}곳은 다른 캐릭터의 특징이거나 외모 묘사가 아니라서 그대로 뒀어요`);
        toastr.success(`${parts.join(', ')}.`, TITLE);
    }
}

function recentText(chat, messageId) {
    return chat
        .slice(Math.max(0, messageId - settings.lookback), messageId + 1)
        .map(message => `${message.name}\n${message.mes}`)
        .join('\n');
}

// 1.9.2 반복 감지에 견줄 최근 AI 답들 (messageId 앞의 것만, 사용자 · 시스템 메시지는 제외)
function previousReplies(chat, messageId) {
    const out = [];
    for (let i = messageId - 1; i >= 0 && out.length < settings.repeat.lookback; i--) {
        const message = chat[i];
        if (!message || message.is_user || message.is_system || typeof message.mes !== 'string') continue;
        out.push(message.mes);
    }
    return out;
}
function repeatOptions() {
    return { threshold: Math.min(0.95, Math.max(0.3, settings.repeat.threshold / 100)), minLength: settings.repeat.minLength };
}

const busy = new Set();

// 채팅마다 따로 센다: 번호만 쓰면 다른 채팅의 같은 번호 메시지가 말없이 건너뛰어진다.
function busyKey(messageId) {
    return `${getContext().getCurrentChatId?.() ?? ''}#${messageId}`;
}

/**
 * @param {number} messageId
 * @param {boolean} manual
 * @param {AbortSignal} [signal] 자동 검사일 때 멈춤 버튼 (onMessageReceived의 holdGeneration)
 */
async function cleanMessage(messageId, manual, signal) {
    const { chat } = getContext();
    const message = chat[messageId];
    if (!message || message.is_user || message.is_system) return;
    const key = busyKey(messageId);
    if (busy.has(key)) {
        if (manual) toastr.info('이 답변은 지금 고치는 중이에요.', TITLE);
        return;
    }

    const original = message.mes;
    const recent = recentText(chat, messageId);
    const active = rulesFor(recent);
    // 1.7.6 찾기를 워커에서 기다리는 동안 같은 답을 또 검사하지 않게 먼저 잡아 둔다
    busy.add(key);
    let spans;
    try {
        spans = await spanFinder.find(original, active);
    } catch (error) {
        busy.delete(key);
        throw error;
    }
    // 기다리는 사이 답이 바뀌었으면(스와이프 · 편집) 이 검사는 버린다 — 바뀐 답은 제 이벤트로 다시 검사된다
    if (getContext().chat[messageId] !== message || message.mes !== original) {
        busy.delete(key);
        return;
    }
    // 1.9.2 최근 답과 거의 같은 문장도 같은 길로 고친다
    if (settings.repeat.on) {
        const repeats = findRepeats(original, previousReplies(chat, messageId), repeatOptions());
        if (repeats.length > 0) spans = mergeSpans(original, spans, repeats);
    }
    if (spans.length === 0) {
        busy.delete(key);
        if (manual) toastr.success('금지 묘사가 없어요.', TITLE);
        return;
    }

    const exceptions = findActiveExceptions(recent, settings.exceptions);
    prepareSpans(spans, exceptions);
    if (settings.skipExemptOnly && spans.every(span => span.fullyExempt)) {
        busy.delete(key);
        if (manual) toastr.success('예외 캐릭터의 특징만 있어서 그대로 뒀어요.', TITLE);
        return;
    }

    const clearProgress = settings.notify || manual
        ? laterToast(() => toastr.info(`${spans.length}곳 확인하는 중…`, TITLE, { timeOut: 0, extendedTimeOut: 0 }))
        : null;
    // 1.8.8 자동 검사는 실리태번이 이 답을 저장하기 전에 돈다. 고쳐 쓰는 동안 탭이 죽거나 새로 고치면 답이 통째로 사라지니
    // 요청과 함께 먼저 저장해 둔다. 스와이프 사본이 아직 안 맞으면(스트리밍 끔 · 끊긴 스트림) 덜 만든 답이라 저장하지 않는다.
    const preSave = !manual && (!Array.isArray(message.swipes) || message.swipes[message.swipe_id ?? 0] === message.mes)
        ? saveChatConditional().catch(error => console.warn(`[${TITLE}] 미리 저장 실패:`, error))
        : null;
    try {
        const result = await rewriteText({
            text: original,
            spans,
            exceptions,
            compiled: active,
            generate: messages => generate(messages, signal),
            maxAttempts: settings.maxAttempts,
            log,
        });
        // 미리 저장이 원문을 다 담은 뒤에 글을 바꾼다
        await preSave;
        // 멈춤 = 이 답변은 그대로 둔다 (리롤을 멈출 때와 같다). 앞선 시도에서 고친 곳도 넣지 않는다.
        if (signal?.aborted) {
            toastr.info('고쳐 쓰기를 멈췄어요. 답변을 그대로 뒀어요.', TITLE);
            return;
        }
        if (result.error) console.warn(`[${TITLE}] 요청 실패:`, result.error);

        if (result.text !== original) {
            const current = getContext().chat[messageId];
            if (current !== message || current.mes !== original) {
                toastr.warning('고치는 동안 메시지가 바뀌어서 적용하지 않았어요.', TITLE);
                return;
            }
            message.mes = result.text;
            if (Array.isArray(message.swipes)) {
                message.swipes[message.swipe_id ?? 0] = result.text;
            }
            // Without streaming the new message isn't on screen yet; SillyTavern renders it from chat[] afterwards.
            // 1.7.5: 편집 창이 열려 있으면 다시 그리지 않는다 (편집 창이 지워져 ✓ 를 누르면 화면 글자가 원문이 된다). 취소하면 실리태번이 고친 글을 그린다.
            if ($(`#chat .mes[mesid="${messageId}"]`).length > 0 && !isEditingMessage(document, messageId)) {
                updateMessageBlock(messageId, message);
            }
            if (manual) {
                // Lets LLM Translator drop the stale translation and translate the fixed text.
                await notifyTextChanged(messageId);
                await saveChatConditional();
            }
        }
        report(result, spans.length, manual);
    } catch (error) {
        console.error(`[${TITLE}]`, error);
        toastr.error(`고쳐 쓰는 중 오류: ${friendlyError(error)}`, TITLE);
    } finally {
        // 실리태번의 저장(이 리스너가 끝난 뒤)이 겹쳐 버려지지 않게 끝까지 기다린다
        await preSave;
        busy.delete(key);
        clearProgress?.();
    }
}

async function checkLastMessage() {
    // 1.8.8 답이 오는 중에 누르면 반쯤 온 글을 붙잡아, 끝난 답의 자동 검사가 말없이 건너뛰어진다
    if (document.body.dataset.generating === 'true') {
        toastr.info('답이 끝난 뒤에 눌러 주세요.', TITLE);
        return;
    }
    const { chat } = getContext();
    for (let id = chat.length - 1; id >= Math.max(0, chat.length - 6); id--) {
        if (!chat[id].is_user && !chat[id].is_system) {
            await cleanMessage(id, true);
            return;
        }
    }
    toastr.info('검사할 AI 답변이 없어요.', TITLE);
}

// ── Scene Plan reroll ─────────────────────────────────

/**
 * Why a reply is out of scope for the reroll, or '' when it should be checked. An empty reply is in scope:
 * it has no Scene Plan either, and a stopped stream is filtered out separately.
 * @param {import('./reroll.js').CapturedRequest | null} request The request that produced the reply
 */
function rerollBlocker(request) {
    const scene = settings.scenePlan;
    if (!scene.enabled) return '씬 플랜 리롤이 꺼져 있어요';
    if (startPattern.regexes.length === 0) return '답변 시작 글자가 비어 있어요';
    // 텍스트 완성 등으로 바꾼 뒤에는 남아 있는 채팅 완성 요청이 이 답변의 요청이 아니다.
    if (main_api !== 'openai') return '채팅 완성(Chat Completion) API가 아니에요';
    if (!request?.request) return '마지막 요청을 아직 못 잡았어요';
    if (!promptHasMarker(capturedMessages(request), markerPattern)) return '프롬프트에 씬 플랜 지시가 없어요';
    return '';
}

function setProgress(toast, text) {
    if (toast) toast.find('.toast-message').text(text);
}

/**
 * How the streamed reply ended. SillyTavern aborts the stream's controller both when the user presses Stop
 * (onStopStreaming) and when the stream breaks on an error (onErrorStreaming, the only place that sets isStopped).
 * A broken processor is never cleared, so one left over from an earlier reply must not count.
 * @param {number} messageId
 * @returns {'done' | 'stopped' | 'broken'}
 */
function streamEnd(messageId) {
    const processor = getContext().streamingProcessor;
    if (!processor?.abortController?.signal?.aborted || Number(processor.messageId) !== messageId) return 'done';
    return processor.isStopped ? 'broken' : 'stopped';
}

/**
 * Rerolls the reply when it lacks the Scene Plan or the plan was cut off.
 * @param {number} messageId
 * @param {'done' | 'stopped' | 'broken'} end From streamEnd(), taken when the reply arrived
 * @param {AbortSignal} stopSignal The Stop button, from the caller's holdGeneration
 */
async function ensureScenePlan(messageId, end, stopSignal) {
    const scene = settings.scenePlan;
    const { chat } = getContext();
    const message = chat[messageId];
    const key = busyKey(messageId);
    if (!message || message.is_user || message.is_system || busy.has(key)) return;

    const original = message.mes;
    // Taken once: a quiet generation from another extension must not change what later attempts resend.
    const request = capturedRequest();
    const blocker = rerollBlocker(request);
    if (blocker) {
        if (scene.enabled) console.debug(`[${TITLE}] 씬 플랜 검사 건너뜀: ${blocker}`);
        return;
    }
    // Without streaming SillyTavern strips a <think> block only after this listener; judge what will be shown.
    const verdict = checkReplyStart(visibleText(message), startPattern);
    if (verdict === 'ok') return;
    // The user pressed Stop mid-stream: a cut-off reply is what they asked for. A stream that broke on an error
    // is rerolled like any other cut-off reply.
    if (end === 'stopped') return;

    const reason = verdict === 'cut' ? '씬 플랜이 끊겨서' : '씬 플랜이 없어서';
    busy.add(key);
    const progress = settings.notify
        ? toastr.info(`${reason} 다시 생성하는 중…`, TITLE, { timeOut: 0, extendedTimeOut: 0 })
        : null;
    try {
        const outcome = await rerollUntil({
            maxAttempts: scene.maxAttempts,
            generate: () => withTimeout(signal => regenerateReply(request, signal), scene.timeoutSec, stopSignal),
            accept: result => checkReplyStart(result.text, startPattern) === 'ok',
            // Only the Stop button ends the loop early; an API error or timeout just uses up one attempt.
            isFatal: () => stopSignal.aborted,
            onAttempt: attempt => setProgress(progress, `${reason} 다시 생성하는 중… (${attempt}/${scene.maxAttempts})`),
            log: (verdict, result) => console.debug(`[${TITLE}] 씬 플랜 리롤 ${verdict}:`, result?.text ?? result),
        });

        if (outcome.result) {
            const current = getContext().chat[messageId];
            if (current !== message || current.mes !== original) {
                toastr.warning('다시 생성하는 동안 메시지가 바뀌어서 적용하지 않았어요.', TITLE);
                return;
            }
            await replaceReply(messageId, message, outcome.result);
            // 1.8.8: 끊김 감시가 끊은 답을 새로 받아 바꿨으니 '끊긴 답' 표시를 지운다 — 남아 있으면 번역기가 온전한 새 답을 건너뛴다
            delete globalThis[Symbol.for('st.stream-watchdog.cut')];
            if ($(`#chat .mes[mesid="${messageId}"]`).length > 0 && !isEditingMessage(document, messageId)) { // 1.7.5: 편집 중이면 다시 그리지 않는다
                updateMessageBlock(messageId, message);
            }
            if (settings.notify) {
                const times = outcome.attempts > 1 ? `${outcome.attempts}번 만에 ` : '';
                toastr.success(`${reason} ${times}다시 생성했어요.`, TITLE);
            }
        } else if (stopSignal.aborted) {
            toastr.info('다시 생성을 멈췄어요. 처음 답변을 그대로 뒀어요.', TITLE);
        } else if (outcome.error) {
            const reason = outcome.error?.name === 'AbortError' ? `${scene.timeoutSec}초 안에 응답이 없어요` : friendlyError(outcome.error);
            console.warn(`[${TITLE}] 씬 플랜 리롤 실패:`, outcome.error);
            toastr.warning(`${outcome.attempts}번 다시 생성해 봤지만 처음 답변을 그대로 뒀어요. 마지막 오류: ${reason}`, TITLE);
        } else {
            toastr.warning(`${outcome.attempts}번 다시 생성했지만 완성된 씬 플랜이 안 나와서 처음 답변을 그대로 뒀어요.`, TITLE);
        }
    } catch (error) {
        console.error(`[${TITLE}]`, error);
        toastr.error(`다시 생성 중 오류: ${friendlyError(error)}`, TITLE);
    } finally {
        busy.delete(key);
        if (progress) toastr.clear(progress);
    }
}

// Runs before other listeners and is awaited, so the translator (CHARACTER_MESSAGE_RENDERED) only sees the final text.
async function onMessageReceived(messageId, type) {
    if (SKIP_TYPES.includes(type)) return;
    const reroll = settings.scenePlan.enabled && !REROLL_SKIP_TYPES.includes(type);
    if (!reroll && !settings.enabled) return;
    const id = Number(messageId);
    const end = streamEnd(id);
    const before = getContext().chat[id]?.mes;
    // 스트리밍이면 SillyTavern은 이 이벤트 직전에 이미 입력 잠금을 풀었다. 리롤·고쳐 쓰기 동안 풀려 있으면 그 사이 보낸 다음
    // 메시지의 streamingProcessor를 이 답변의 Generate가 끝나며 지워 새 답변이 멈추고, 스와이프한 답변은 검사 없이 번역된다.
    // 그래서 번역기에 알리는 것까지 끝날 때까지 잠가 둔다 (이미 잠겨 있으면 그대로 둔다).
    const controller = new AbortController();
    const release = holdGeneration(controller);
    try {
        if (reroll) {
            await ensureScenePlan(id, end, controller.signal);
        }
        // Stop means "leave this reply alone", so the banned-word pass is skipped too.
        if (settings.enabled && !controller.signal.aborted) {
            await cleanMessage(id, false, controller.signal);
        }
        // A broken stream reaches us from onErrorStreaming, which neither waits for this listener nor saves the chat,
        // so the translator is already working on the cut reply. Tell it the text changed, then save.
        const message = getContext().chat[id];
        if (end === 'broken' && message && message.mes !== before) {
            await notifyTextChanged(id);
            await saveChatConditional();
        }
    } finally {
        release();
    }
}

// ── Tabs ──────────────────────────────────────────────

function savedTab() {
    try {
        return localStorage.getItem(TAB_STORAGE_KEY) || 'connection';
    } catch {
        return 'connection';
    }
}

function showTab(tab) {
    $('.bwr_settings .bwr_tab').each(function () {
        $(this).toggleClass('active', this.dataset.tab === tab);
    });
    $('.bwr_settings .bwr_panel').each(function () {
        $(this).toggleClass('active', this.dataset.panel === tab);
    });
    if (tab === 'connection') renderProfiles();
    if (tab === 'reroll') renderSceneStatus();
    try {
        localStorage.setItem(TAB_STORAGE_KEY, tab);
    } catch {
        // Storage unavailable: the tab just isn't remembered.
    }
}

function updateBadges() {
    $('#bwr_rules_count').text(settings.rules.filter(rule => rule.enabled !== false).length);
    $('#bwr_exceptions_count').text(settings.exceptions.filter(exception => exception.enabled !== false).length);
}

function chip(label, { id, active = false, off = false } = {}) {
    const element = $('<div class="bwr_chip"><span class="bwr_chip_label"></span></div>');
    element.find('.bwr_chip_label').text(label);
    element.toggleClass('active', active).toggleClass('bwr_off', off);
    if (id) element.attr('data-id', id);
    return element;
}

function addChip(onClick) {
    return $('<div class="bwr_chip bwr_add" title="추가"><i class="fa-solid fa-plus"></i><span>추가</span></div>').on('click', onClick);
}

function findChip(container, id) {
    return $(container).children('.bwr_chip').filter((index, element) => element.dataset.id === id);
}

// ── Connection UI ─────────────────────────────────────

function renderProfiles() {
    const select = $('#bwr_profile').empty();
    select.append(new Option('프로필 선택', ''));
    let profiles = [];
    try {
        profiles = ConnectionManagerRequestService.getSupportedProfiles();
    } catch {
        // Connection Manager disabled.
    }
    for (const profile of profiles) {
        select.append(new Option(profile.name, profile.id));
    }
    if (settings.profileId && !profiles.some(profile => profile.id === settings.profileId)) {
        select.append(new Option('(찾을 수 없는 프로필)', settings.profileId));
    }
    select.val(settings.profileId);
}

function renderProviders() {
    const select = $('#bwr_provider').empty();
    for (const [id, provider] of Object.entries(PROVIDERS)) {
        select.append(new Option(provider.label, id));
    }
    select.val(settings.provider);
}

function renderModels() {
    const provider = settings.provider;
    const isCustom = provider === 'custom';
    const url = isCustom ? customEndpoint().url : '';
    // Custom has no fixed list: it shows what was fetched from the endpoint address.
    const list = isCustom ? (cachedModelList(url)?.models ?? []) : (PROVIDERS[provider]?.models ?? []);
    const saved = settings.models[provider];
    const select = $('#bwr_model').empty();
    for (const model of list) {
        select.append(new Option(model, model));
    }
    // Keep a model that dropped off the list selectable instead of silently switching.
    if (saved && saved !== 'custom' && !list.includes(saved)) {
        const note = isCustom && list.length > 0 ? '이 주소 목록에 없음' : '이전 목록';
        select.append(new Option(`${saved} (${note})`, saved));
    }
    select.append(new Option('⚙️ 커스텀 모델 입력', 'custom'));

    const picked = saved || list[0] || 'custom';
    select.val(picked);
    settings.models[provider] = picked;
    $('#bwr_custom_model_box').toggle(picked === 'custom');
    $('#bwr_custom_model').val(settings.customModels[provider] ?? '');
    $('#bwr_custom_url_box').toggle(isCustom);
    $('#bwr_fetch_box').toggle(isCustom);
    // The free-text box suggests the fetched names too.
    const datalist = $('#bwr_custom_model_datalist').empty();
    if (isCustom) {
        for (const model of list) datalist.append($('<option>').attr('value', model));
        renderModelsStatus();
        syncFetchButton();
        lastRenderedCustomUrl = url;
    }
}

function syncConnection() {
    $('#bwr_connection .bwr_seg').each(function () {
        $(this).toggleClass('active', this.dataset.value === settings.connection);
    });
    $('#bwr_connection_hint').text(CONNECTION_HINTS[settings.connection] ?? '');
    $('#bwr_profile_box').toggle(settings.connection === 'profile');
    $('#bwr_direct_box').toggle(settings.connection === 'direct');
    $('#bwr_tokens_box').toggle(settings.connection !== 'current');
    $('#bwr_custom_url').val(settings.customUrl);
    $('#bwr_temperature').val(settings.temperature);
    $('#bwr_max_tokens').val(settings.maxTokens);
    $('#bwr_use_proxy').prop('checked', settings.useReverseProxy);
    $('#bwr_proxy_box').toggle(settings.useReverseProxy);
    $('#bwr_proxy_url').val(settings.reverseProxyUrl);
    $('#bwr_proxy_password').val(settings.reverseProxyPassword);
    renderProfiles();
    renderProviders();
    renderModels();
}

function importTranslatorSettings() {
    const translator = extension_settings[TRANSLATOR_MODULE];
    const provider = translator?.llm_provider;
    if (!translator || !PROVIDERS[provider]) {
        toastr.warning('LLM 번역기 설정을 찾지 못했어요.', TITLE);
        return;
    }
    settings.connection = 'direct';
    settings.provider = provider;
    settings.models[provider] = translator.llm_model || 'custom';
    if (settings.models[provider] === 'custom') {
        settings.customModels[provider] = translator.custom_models?.[provider] ?? translator.custom_model ?? '';
    }
    if (provider === 'custom') {
        settings.customUrl = translator.custom_url ?? '';
    }
    settings.useReverseProxy = Boolean(translator.use_reverse_proxy);
    settings.reverseProxyUrl = translator.reverse_proxy_url ?? '';
    settings.reverseProxyPassword = translator.reverse_proxy_password ?? '';
    const temperature = translator.parameters?.[provider]?.temperature;
    if (typeof temperature === 'number') {
        settings.temperature = temperature;
    }
    syncConnection();
    autoFetchModels();
    saveSettingsDebounced();
    toastr.success(`LLM 번역기 설정을 가져왔어요: ${PROVIDERS[provider].label} · ${resolveModel(settings) || '모델명 없음'}`, TITLE);
}

function bindConnection() {
    $('#bwr_connection .bwr_seg').on('click', function () {
        settings.connection = this.dataset.value;
        syncConnection();
        autoFetchModels();
        saveSettingsDebounced();
    });
    $('#bwr_profile').on('change', function () {
        settings.profileId = String(this.value);
        saveSettingsDebounced();
    });
    $('#bwr_provider').on('change', function () {
        settings.provider = String(this.value);
        renderModels();
        autoFetchModels();
        saveSettingsDebounced();
    });
    $('#bwr_model').on('change', function () {
        settings.models[settings.provider] = String(this.value);
        $('#bwr_custom_model_box').toggle(this.value === 'custom');
        $('#bwr_custom_model').val(settings.customModels[settings.provider] ?? '');
        saveSettingsDebounced();
    });
    $('#bwr_custom_model').on('input', function () {
        settings.customModels[settings.provider] = this.value.trim();
        saveSettingsDebounced();
    });
    $('#bwr_custom_url').on('input', function () {
        settings.customUrl = this.value.trim();
        saveSettingsDebounced();
    });
    // When typing is done, show the list kept for that address (typing alone never sends a request).
    $('#bwr_custom_url').on('change', () => renderModels());
    $('#bwr_fetch_models').on('click', function () {
        if (!$(this).hasClass('bwr_busy')) fetchCustomModels();
    });
    $('#bwr_temperature').on('change', function () {
        const value = Math.min(2, Math.max(0, Number(this.value)));
        settings.temperature = Number.isFinite(value) ? value : DEFAULT_SETTINGS.temperature;
        this.value = settings.temperature;
        saveSettingsDebounced();
    });
    $('#bwr_use_proxy').on('change', function () {
        settings.useReverseProxy = this.checked;
        $('#bwr_proxy_box').toggle(this.checked);
        saveSettingsDebounced();
    });
    $('#bwr_proxy_url').on('input', function () {
        settings.reverseProxyUrl = this.value.trim();
        saveSettingsDebounced();
    });
    $('#bwr_proxy_password').on('input', function () {
        settings.reverseProxyPassword = this.value;
        saveSettingsDebounced();
    });
    $('#bwr_import_translator').on('click', importTranslatorSettings);
}

// ── Rules UI: chips + one editor ──────────────────────

let selectedRuleId = null;

function makeRuleChip(rule) {
    const element = chip(rule.name || '이름 없음', {
        id: rule.id,
        active: rule.id === selectedRuleId,
        off: rule.enabled === false,
    });
    if (splitNames(rule.onlyFor).length > 0) {
        element.append('<i class="fa-solid fa-user bwr_scope" title="특정 캐릭터에게만"></i>');
    }
    if (compileRule(rule).errors.length > 0) {
        element.append('<i class="fa-solid fa-triangle-exclamation bwr_warn" title="단어 목록에 오류가 있어요"></i>');
    }
    return element.on('click', () => {
        selectedRuleId = rule.id;
        renderRules();
    });
}

function renderRules() {
    if (!settings.rules.some(rule => rule.id === selectedRuleId)) {
        selectedRuleId = settings.rules[0]?.id ?? null;
    }
    const chips = $('#bwr_rule_chips').empty();
    for (const rule of settings.rules) {
        chips.append(makeRuleChip(rule));
    }
    chips.append(addChip(addRule));
    renderRuleEditor();
    updateBadges();
}

function renderRuleEditor() {
    const editor = $('#bwr_rule_editor').empty();
    const rule = settings.rules.find(item => item.id === selectedRuleId);
    if (!rule) {
        editor.append($('<small class="bwr_hint">').text('금지 묘사가 없어요. 추가를 눌러 만들어 보세요.'));
        return;
    }
    editor.append(`
        <div class="bwr_editor_head">
            <input type="text" class="text_pole bwr_name" placeholder="이름 (예: 안경)">
            <label class="bwr_switch_row bwr_compact"><span>사용</span><input type="checkbox" class="bwr_enabled"><span class="bwr_switch" aria-hidden="true"></span></label>
            <div class="menu_button menu_button_icon bwr_delete" title="삭제"><i class="fa-solid fa-trash-can"></i></div>
        </div>
        <label class="bwr_field"><span>단어</span><textarea class="text_pole bwr_words" rows="3" placeholder="glasses, spectacles, monocle*"></textarea></label>
        <label class="bwr_field"><span>AI에게 줄 설명 (선택, 영어 권장)</span><input type="text" class="text_pole bwr_desc" placeholder="eyewear such as glasses"></label>
        <label class="bwr_field"><span>이 캐릭터에게만 (선택, 쉼표로 구분)</span><input type="text" class="text_pole bwr_only" placeholder="비우면 모두 · Satan, 사탄 · {{user}}"></label>
        <label class="bwr_field"><span>이 말의 것일 때만 (선택)</span><input type="text" class="text_pole bwr_near" placeholder="비우면 항상 · her, she, {{user}}"></label>
        <small class="bwr_error"></small>`);

    const refresh = () => {
        findChip('#bwr_rule_chips', rule.id).replaceWith(makeRuleChip(rule));
        editor.find('.bwr_error').text(compileRule(rule).errors.join('\n'));
    };

    editor.find('.bwr_name').val(rule.name).on('input', function () {
        rule.name = this.value;
        refresh();
        renderExceptionEditor();
        saveSettingsDebounced();
    });
    editor.find('.bwr_enabled').prop('checked', rule.enabled !== false).on('change', function () {
        rule.enabled = this.checked;
        recompile();
        refresh();
        updateBadges();
        saveSettingsDebounced();
    });
    editor.find('.bwr_words').val(rule.words).on('input', function () {
        rule.words = this.value;
        recompile();
        refresh();
        saveSettingsDebounced();
    });
    editor.find('.bwr_desc').val(rule.description ?? '').on('input', function () {
        rule.description = this.value;
        saveSettingsDebounced();
    });
    editor.find('.bwr_only').val(rule.onlyFor ?? '').on('input', function () {
        rule.onlyFor = this.value;
        refresh();
        saveSettingsDebounced();
    });
    editor.find('.bwr_near').val(rule.near ?? '').on('input', function () {
        rule.near = this.value;
        saveSettingsDebounced();
    });
    editor.find('.bwr_delete').on('click', async () => {
        const confirmed = await callGenericPopup(textNode(`'${rule.name || '이름 없음'}' 금지 묘사를 삭제할까요?`), POPUP_TYPE.CONFIRM);
        if (!confirmed) return;
        settings.rules.splice(settings.rules.indexOf(rule), 1);
        for (const exception of settings.exceptions) {
            exception.allow = (exception.allow ?? []).filter(id => id !== rule.id);
        }
        recompile();
        renderRules();
        renderExceptions();
        saveSettingsDebounced();
    });
    editor.find('.bwr_error').text(compileRule(rule).errors.join('\n'));
}

function addRule() {
    const rule = { id: newId('rule'), name: '', enabled: true, words: '', description: '', onlyFor: '', near: '' };
    settings.rules.push(rule);
    selectedRuleId = rule.id;
    recompile();
    renderRules();
    renderExceptionEditor();
    saveSettingsDebounced();
    $('#bwr_rule_editor .bwr_name').trigger('focus');
}

// ── 1.8.0: rules written by an AI, and the how-to behind the version badge ─────────────────

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // http:// on a phone has no clipboard API; the old command still works there.
        const area = document.createElement('textarea');
        area.value = text;
        area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
        document.body.append(area);
        area.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch { /* shown as not copied */ }
        area.remove();
        return copied;
    }
}

async function openAiHelper() {
    const { buildAiPrompt, parseAiRules } = await import('./ai-rules.js');
    const box = $(`
        <div class="bwr_settings bwr_ai">
            <h3><i class="fa-solid fa-wand-magic-sparkles"></i> AI에게 부탁해서 만들기</h3>
            <label class="bwr_field"><span>1. 싫어하는 묘사를 평소 말투로 적어요</span><textarea class="text_pole bwr_ai_wish" rows="3" placeholder="예: 캐릭터가 자꾸 수염을 기르고 나와 · 내 캐릭터 눈 색을 멋대로 정해"></textarea></label>
            <div class="menu_button menu_button_icon bwr_wide bwr_ai_copy"><i class="fa-solid fa-copy"></i><span>2. 프롬프트 복사 → 아무 AI에게 붙여넣기</span></div>
            <textarea class="text_pole bwr_ai_prompt" rows="4" readonly hidden></textarea>
            <label class="bwr_field"><span>3. AI의 답을 통째로 붙여넣어요</span><textarea class="text_pole bwr_ai_answer" rows="5" placeholder='[ { "name": "…", "words": […] } ]'></textarea></label>
            <div class="menu_button menu_button_icon bwr_wide bwr_ai_add"><i class="fa-solid fa-plus"></i><span>규칙 추가</span></div>
            <small class="bwr_hint bwr_ai_result"></small>
        </div>`);
    const result = box.find('.bwr_ai_result');
    box.find('.bwr_ai_copy').on('click', async () => {
        const prompt = buildAiPrompt(box.find('.bwr_ai_wish').val(), settings.rules);
        const copied = await copyText(prompt);
        // When copying is blocked the prompt is shown so it can be selected by hand.
        box.find('.bwr_ai_prompt').val(prompt).prop('hidden', copied);
        result.text(copied ? '복사했어요. AI 채팅창에 붙여넣고, 받은 답을 아래 칸에 넣어 주세요.' : '자동 복사가 막혀 있어요. 위 글을 직접 복사해 주세요.');
    });
    box.find('.bwr_ai_add').on('click', () => {
        const parsed = parseAiRules(box.find('.bwr_ai_answer').val(), settings.rules);
        if (parsed.error) {
            result.text([parsed.error, ...parsed.notes].join('\n'));
            return;
        }
        for (const rule of parsed.rules) settings.rules.push({ id: newId('rule'), ...rule });
        selectedRuleId = settings.rules[settings.rules.length - parsed.rules.length].id;
        recompile();
        renderRules();
        renderExceptionEditor();
        saveSettingsDebounced();
        box.find('.bwr_ai_answer').val('');
        result.text([`${parsed.rules.length}개 추가했어요: ${parsed.rules.map(rule => rule.name).join(', ')}`, ...parsed.notes].join('\n'));
    });
    await callGenericPopup(box, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: roomyPopup });
}

// Our popups use the whole phone screen: SillyTavern's default padding left 316 of 412 px for the settings.
function roomyPopup(popup) {
    popup?.dlg?.classList.add('bwr_dialog');
}

async function openGuide() {
    const { guideHtml } = await import('./guide.js');
    const box = $('<div class="bwr_settings"></div>').html(guideHtml(PERSONAL));
    box.find('h3').first().append($('<span class="bwr-version ext-version">').text(`v${VERSION}`));
    return callGenericPopup(box, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, large: true, allowVerticalScrolling: true, onOpen: roomyPopup });
}

async function openSceneHelp() {
    const { SCENE_HELP_HTML } = await import('./guide.js');
    const box = $('<div class="bwr_settings"></div>').html(SCENE_HELP_HTML);
    return callGenericPopup(box, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, allowVerticalScrolling: true, onOpen: roomyPopup });
}

function bindGuide() {
    const open = event => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        // The badge sits inside the drawer header: opening the guide must not fold the drawer.
        event.preventDefault();
        event.stopPropagation();
        openGuide();
    };
    $('.bwr_settings .bwr-version, .bwr_settings .bwr_guide_link').on('click keydown', open);
    $('#bwr_ai_open').on('click', openAiHelper);
    // Inside the switch's <label>: a click must open the help, not flip the switch.
    $('.bwr_settings .bwr_help').on('click keydown', event => {
        if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        openSceneHelp();
    });
}

// ── Exceptions UI: chips + one editor ─────────────────

let selectedExceptionId = null;

function exceptionTitle(exception) {
    return splitNames(exception.names)[0] ?? '새 예외 캐릭터';
}

function makeExceptionChip(exception) {
    return chip(exceptionTitle(exception), {
        id: exception.id,
        active: exception.id === selectedExceptionId,
        off: exception.enabled === false,
    }).on('click', () => {
        selectedExceptionId = exception.id;
        renderExceptions();
    });
}

function renderExceptions() {
    if (!settings.exceptions.some(exception => exception.id === selectedExceptionId)) {
        selectedExceptionId = settings.exceptions[0]?.id ?? null;
    }
    const chips = $('#bwr_exception_chips').empty();
    for (const exception of settings.exceptions) {
        chips.append(makeExceptionChip(exception));
    }
    chips.append(addChip(addException));
    renderExceptionEditor();
    updateBadges();
}

function renderExceptionEditor() {
    const editor = $('#bwr_exception_editor').empty();
    const exception = settings.exceptions.find(item => item.id === selectedExceptionId);
    if (!exception) {
        editor.append($('<small class="bwr_hint">').text('예외 캐릭터가 없어요. 추가를 눌러 만들어 보세요.'));
        return;
    }
    editor.append(`
        <div class="bwr_editor_head">
            <b class="bwr_title"></b>
            <label class="bwr_switch_row bwr_compact"><span>사용</span><input type="checkbox" class="bwr_enabled"><span class="bwr_switch" aria-hidden="true"></span></label>
            <div class="menu_button menu_button_icon bwr_delete" title="삭제"><i class="fa-solid fa-trash-can"></i></div>
        </div>
        <label class="bwr_field"><span>이름 (쉼표로 구분, 본문에 나오는 호칭 모두)</span><textarea class="text_pole bwr_names" rows="2" placeholder="Belford, 벨포드, 벨"></textarea></label>
        <div class="bwr_field"><span>허용할 묘사</span><div class="bwr_chips bwr_allow"></div></div>`);

    const refresh = () => {
        editor.find('.bwr_title').text(exceptionTitle(exception));
        findChip('#bwr_exception_chips', exception.id).replaceWith(makeExceptionChip(exception));
    };

    editor.find('.bwr_enabled').prop('checked', exception.enabled !== false).on('change', function () {
        exception.enabled = this.checked;
        refresh();
        updateBadges();
        saveSettingsDebounced();
    });
    editor.find('.bwr_names').val(exception.names).on('input', function () {
        exception.names = this.value;
        refresh();
        saveSettingsDebounced();
    });
    editor.find('.bwr_delete').on('click', async () => {
        const confirmed = await callGenericPopup(textNode(`'${exceptionTitle(exception)}' 예외를 삭제할까요?`), POPUP_TYPE.CONFIRM);
        if (!confirmed) return;
        settings.exceptions.splice(settings.exceptions.indexOf(exception), 1);
        renderExceptions();
        saveSettingsDebounced();
    });

    const allow = editor.find('.bwr_allow');
    for (const rule of settings.rules) {
        const allowed = (exception.allow ?? []).includes(rule.id);
        const toggle = chip(rule.name || '이름 없음', { active: allowed })
            .prepend(`<i class="fa-solid ${allowed ? 'fa-check' : 'fa-xmark'}"></i>`)
            .on('click', () => {
                const ids = new Set(exception.allow ?? []);
                if (ids.has(rule.id)) ids.delete(rule.id);
                else ids.add(rule.id);
                exception.allow = [...ids];
                renderExceptionEditor();
                saveSettingsDebounced();
            });
        allow.append(toggle);
    }
    editor.find('.bwr_title').text(exceptionTitle(exception));
}

function addException() {
    const exception = { id: newId('exception'), enabled: true, names: '', allow: [] };
    settings.exceptions.push(exception);
    selectedExceptionId = exception.id;
    renderExceptions();
    saveSettingsDebounced();
    $('#bwr_exception_editor .bwr_names').trigger('focus');
}

// ── Reroll UI ─────────────────────────────────────────

function renderSceneStatus() {
    const status = $('#bwr_scene_status').empty();
    const messages = capturedMessages();
    const mark = (ok, text) => $('<span>').addClass(ok ? 'bwr_ok' : 'bwr_no').text(text);
    if (!messages) {
        status.append(mark(false, '마지막 요청: 아직 없음')).append(document.createTextNode(' · 채팅을 한 번 보내면 잡혀요.'));
        return;
    }
    const marker = promptHasMarker(messages, markerPattern);
    status
        .append(mark(true, `마지막 요청: 잡힘 (메시지 ${messages.length}개)`))
        .append(document.createTextNode(' · '))
        .append(mark(marker, marker ? '씬 플랜 지시: 있음 → 이 프리셋에서 검사해요' : '씬 플랜 지시: 없음 → 이 프리셋에서는 검사 안 해요'));
}

function syncScene() {
    const scene = settings.scenePlan;
    $('#bwr_scene_enabled').prop('checked', scene.enabled);
    $('#bwr_scene_start').val(scene.startPattern);
    $('#bwr_scene_marker').val(scene.promptPattern);
    $('#bwr_scene_attempts').val(scene.maxAttempts);
    $('#bwr_scene_timeout').val(scene.timeoutSec);
    $('#bwr_scene_error').text([...startPattern.errors, ...markerPattern.errors].join('\n'));
    renderSceneStatus();
}

function bindScene() {
    const scene = () => settings.scenePlan;
    $('#bwr_scene_enabled').on('change', function () {
        scene().enabled = this.checked;
        saveSettingsDebounced();
    });
    $('#bwr_scene_start').on('input', function () {
        scene().startPattern = this.value;
        recompile();
        $('#bwr_scene_error').text([...startPattern.errors, ...markerPattern.errors].join('\n'));
        saveSettingsDebounced();
    });
    $('#bwr_scene_marker').on('input', function () {
        scene().promptPattern = this.value;
        recompile();
        $('#bwr_scene_error').text([...startPattern.errors, ...markerPattern.errors].join('\n'));
        renderSceneStatus();
        saveSettingsDebounced();
    });
    const bindNumber = (selector, key, min, max) => $(selector).on('change', function () {
        const value = Math.min(max, Math.max(min, Math.round(Number(this.value)) || DEFAULT_SETTINGS.scenePlan[key]));
        scene()[key] = value;
        this.value = value;
        saveSettingsDebounced();
    });
    bindNumber('#bwr_scene_attempts', 'maxAttempts', 1, 5);
    bindNumber('#bwr_scene_timeout', 'timeoutSec', 30, 900);
}

// ── Test tab ──────────────────────────────────────────

// The pasted text stands in for the recent messages too, so limited rules need their character's name in it.
function detectTestText() {
    const text = String($('#bwr_test_input').val() ?? '');
    const active = rulesFor(text);
    // activateRules hands back copies of the limited rules, so compare by id.
    const skipped = compiled.filter(entry => !active.some(item => item.rule.id === entry.rule.id)).map(entry => entry.rule.name || '이름 없음');
    let spans = findSpans(text, active);
    if (settings.repeat.on) {
        // 시험 글은 채팅에 없으니 지금 채팅의 마지막 답들 전부와 견준다
        let previous = [];
        try { const { chat } = getContext(); previous = previousReplies(chat, chat.length); } catch { previous = []; }
        const repeats = findRepeats(text, previous, repeatOptions());
        if (repeats.length > 0) spans = mergeSpans(text, spans, repeats);
    }
    const exceptions = findActiveExceptions(text, settings.exceptions);
    prepareSpans(spans, exceptions);
    return { text, spans, exceptions, active, skipped };
}

function showDetection() {
    const { text, spans, exceptions, skipped } = detectTestText();
    const result = $('#bwr_test_result').empty();
    if (text.trim()) {
        const verdict = checkReplyStart(text, startPattern);
        const labels = {
            ok: '맞음 (씬 플랜 완성)',
            missing: '안 맞음 (씬 플랜 없음 → 리롤 대상)',
            cut: '끊김 (씬 플랜이 안 닫혔거나 뒤에 본문이 없음 → 리롤 대상)',
        };
        result.append($('<div>')
            .append($('<b>').text('시작 형식: '))
            .append($('<span>').addClass(verdict === 'ok' ? 'bwr_ok' : 'bwr_no').text(labels[verdict])));
    }
    if (skipped.length > 0) {
        result.append($('<small>').text(`이름이 안 나와서 건너뛴 규칙: ${skipped.join(', ')}`));
    }
    if (spans.length === 0) {
        result.append($('<div>').text('걸리는 금지 묘사가 없어요.'));
        return;
    }
    const list = $('<ul class="bwr_spans">');
    for (const span of spans) {
        const names = span.rules.map(rule => rule.name || '이름 없음').join(', ');
        const item = $('<li>')
            .append($('<b>').text(`[${names}]${span.exempt ? ' (예외 확인)' : ''} `))
            .append(document.createTextNode(span.text));
        if (span.repeatOf) item.append($('<small class="bwr_repeat_of">').text(`↳ 이전 답: ${span.repeatOf} (${Math.round(span.score * 100)}%)`));
        list.append(item);
    }
    result.append(list);
    if (exceptions.length > 0) {
        result.append($('<small>').text(`예외 켜짐: ${exceptions.map(exceptionTitle).join(', ')}`));
    }
}

let previewing = false;

async function previewRewrite() {
    if (previewing) return;
    const { text, spans, exceptions, active } = detectTestText();
    if (spans.length === 0) {
        showDetection();
        return;
    }
    previewing = true;
    const result = $('#bwr_test_result').empty().append($('<div>').text('AI에게 요청하는 중…'));
    try {
        const output = await rewriteText({ text, spans, exceptions, compiled: active, generate, maxAttempts: settings.maxAttempts, log });
        const kept = spans.length - output.fixed - output.failed;
        if (output.error) console.warn(`[${TITLE}] 테스트 고쳐 쓰기 실패:`, output.error);
        const error = output.error ? ` (${friendlyError(output.error)})` : '';
        result.empty()
            .append($('<div>').text(`고침 ${output.fixed} · 그대로 ${kept} · 실패 ${output.failed}${error}`))
            .append($('<pre class="bwr_preview">').text(output.text));
    } catch (error) {
        console.warn(`[${TITLE}] 테스트 오류:`, error);
        result.empty().append($('<div>').text(`오류: ${friendlyError(error)}`));
    } finally {
        previewing = false;
    }
}

// ── Setup ─────────────────────────────────────────────

function syncInputs() {
    $('#bwr_enabled').prop('checked', settings.enabled);
    $('#bwr_notify').prop('checked', settings.notify);
    $('#bwr_skip_exempt').prop('checked', settings.skipExemptOnly);
    $('#bwr_timeout').val(settings.timeoutSec);
    $('#bwr_attempts').val(settings.maxAttempts);
    $('#bwr_lookback').val(settings.lookback);
    $('#bwr_repeat_on').prop('checked', settings.repeat.on);
    $('#bwr_repeat_lookback').val(settings.repeat.lookback);
    $('#bwr_repeat_threshold').val(settings.repeat.threshold);
    $('#bwr_repeat_min').val(settings.repeat.minLength);
    syncConnection();
    syncScene();
    renderRules();
    renderExceptions();
}

function bindSettings() {
    const bindCheckbox = (selector, key) => $(selector).on('change', function () {
        settings[key] = this.checked;
        saveSettingsDebounced();
    });
    const bindNumber = (selector, key, min, max) => $(selector).on('change', function () {
        const value = Math.min(max, Math.max(min, Math.round(Number(this.value)) || DEFAULT_SETTINGS[key]));
        settings[key] = value;
        this.value = value;
        saveSettingsDebounced();
    });

    bindCheckbox('#bwr_enabled', 'enabled');
    bindCheckbox('#bwr_notify', 'notify');
    bindCheckbox('#bwr_skip_exempt', 'skipExemptOnly');
    bindNumber('#bwr_timeout', 'timeoutSec', 10, 600);
    bindNumber('#bwr_attempts', 'maxAttempts', 1, 5);
    bindNumber('#bwr_lookback', 'lookback', 0, 50);
    bindNumber('#bwr_max_tokens', 'maxTokens', 256, 65536);
    // 1.9.2 반복 감지
    $('#bwr_repeat_on').on('change', function () {
        settings.repeat.on = this.checked;
        saveSettingsDebounced();
    });
    const bindRepeatNumber = (selector, key, min, max) => $(selector).on('change', function () {
        const value = Math.min(max, Math.max(min, Math.round(Number(this.value)) || DEFAULT_SETTINGS.repeat[key]));
        settings.repeat[key] = value;
        this.value = value;
        saveSettingsDebounced();
    });
    bindRepeatNumber('#bwr_repeat_lookback', 'lookback', 1, 30);
    bindRepeatNumber('#bwr_repeat_threshold', 'threshold', 30, 95);
    bindRepeatNumber('#bwr_repeat_min', 'minLength', 6, 60);
    bindConnection();
    bindScene();

    $('.bwr_settings .bwr_tab').on('click', function () {
        showTab(this.dataset.tab);
    });
    $('#bwr_check_last').on('click', checkLastMessage);
    $('#bwr_test_detect').on('click', showDetection);
    $('#bwr_test_rewrite').on('click', previewRewrite);
    $('#bwr_reset').on('click', async () => {
        const confirmed = await callGenericPopup(textNode('금지 묘사, 예외 캐릭터, 리롤, 연결 설정을 모두 기본값으로 되돌릴까요?'), POPUP_TYPE.CONFIRM);
        if (!confirmed) return;
        extension_settings[MODULE] = structuredClone(DEFAULT_SETTINGS);
        settings = extension_settings[MODULE];
        recompile();
        syncInputs();
        saveSettingsDebounced();
    });
}

function addWandButton() {
    const button = $(`
        <div id="bwr_wand_check" class="list-group-item flex-container flexGap5 interactable" tabindex="0" title="마지막 AI 답변에서 금지 묘사를 찾아 고칩니다">
            <div class="fa-solid fa-glasses extensionsMenuExtensionButton"></div>
            <span>다시 쓰기</span>
        </div>`);
    button.on('click', checkLastMessage);
    $('#extensionsMenu').append(button);
}

// A mismatch may come from packaging, stale cache, or mixed installed files.
function checkFilesMatch(retries = 3) {
    const panel = document.querySelector('.bwr_settings');
    if (!panel) return;
    const cssVersion = getComputedStyle(panel).getPropertyValue('--bwr-css-version').replace(/["'\s]/g, '');
    if (cssVersion === VERSION) return;
    // No value yet can just be a stylesheet still loading on a slow phone; ask again before complaining.
    if (!cssVersion && retries > 0) {
        setTimeout(() => checkFilesMatch(retries - 1), 3000);
        return;
    }
    toastr.warning(
        `파일이 섞였어요 (index.js ${VERSION} / style.css ${cssVersion || '없음'}). ${EMBEDDED ? '블루 레몬에이드 폴더' : `extensions/${FOLDER} 폴더`}를 지우고 다시 설치해 주세요.`,
        TITLE,
        { timeOut: 15000 },
    );
}

// Embedded: the settings wait in a hidden holder until the theme shows them (popup on phones, inline on wide screens).
const holder = EMBEDDED ? Object.assign(document.createElement('div'), { hidden: true }) : null;
let root = null;
let inlineHost = null;
let opening = false;

function runSteps(steps) {
    // One failing step must not take the rest down (1.8.4), and it says which one failed.
    const failed = [];
    for (const [name, run] of Object.entries(steps)) {
        try {
            run();
        } catch (error) {
            failed.push(`${name}: ${error?.message || error}`);
            console.error(`[${TITLE}] ${name} 단계 실패`, error);
        }
    }
    if (failed.length) toastr.warning(`시작하다 문제가 있었어요 — ${failed.join(' / ')}`, TITLE, { timeOut: 20000 });
}

// 1.8.5: the settings screen is built once, when it is first needed. On its own that is right away (the drawer has
// to exist in the extensions list); inside the theme it is the first 세부 설정 / wide-screen column, so a start-up
// never pays for a panel nobody opened.
let uiReady = null;

function ensureUi() {
    uiReady ??= (async () => {
        const html = (await import('./settings-html.js')).default;
        if (EMBEDDED) {
            root = $(html).get(0);
            document.body.append(holder);
            holder.append(root);
            // No drawer to fold inside the theme: the content is always open and the header is just a title.
            root.querySelector('.inline-drawer-content').style.display = 'block';
            root.querySelector('.inline-drawer-icon')?.remove();
            root.querySelector('.inline-drawer-header')?.classList.remove('inline-drawer-toggle');
        } else {
            $('#extensions_settings2').append(html);
        }
        runSteps({
            '버전 표시': () => $('.bwr_settings .bwr-version').text(`v${VERSION}`),
            '설정 화면': bindSettings,
            '사용법': bindGuide,
            '값 채우기': syncInputs,
            '탭': () => showTab(savedTab()),
            // Following SillyTavern's own Custom address: show that address's list once it changes there.
            '주소 따라가기': () => eventSource.on(event_types.SETTINGS_UPDATED, () => {
                if (settings.provider !== 'custom') return;
                const { url, inheritExtras } = customEndpoint();
                if (!inheritExtras || url === lastRenderedCustomUrl) return;
                renderModels();
                autoFetchModels();
            }),
            '모델 목록': autoFetchModels,
        });
        setTimeout(checkFilesMatch, 3000);
    })().catch(error => {
        console.error(`[${TITLE}] 설정 화면을 만들지 못했어요`, error);
        toastr.error(`설정 화면을 만들지 못했어요: ${error?.message || error}`, TITLE, { timeOut: 20000 });
    });
    return uiReady;
}

function start() {
    runSteps({
        '요술봉 메뉴': addWandButton,
        '요청 지켜보기': () => watchRequests(() => {
            if ($('.bwr_settings .bwr_panel[data-panel="reroll"]').hasClass('active')) renderSceneStatus();
        }),
        '답변 검사': () => eventSource.makeFirst(event_types.MESSAGE_RECEIVED, onMessageReceived),
        // 1.9.0 채팅에서 고른 낱말 옆의 금지 칩 (quick-ban.js)
        '빠른 금지': () => startQuickBan(addQuickRule),
    });
    if (!EMBEDDED) ensureUi();
}

/** 1.9.0 — 고른 글 그대로를 낱말로 하는 규칙 하나. 같은 낱말의 규칙이 있으면 만들지 않는다. */
export function addQuickRule(text) {
    const word = String(text || '').replace(/\s+/g, ' ').trim();
    if (!word) return false;
    const same = settings.rules.find(rule => String(rule.words || '').split('\n').map(w => w.trim().toLowerCase()).includes(word.toLowerCase()));
    if (same) {
        toastr.info(`"${same.name || word}" 규칙에 이미 있어요`, TITLE);
        return false;
    }
    const rule = { id: newId('rule'), name: word, enabled: true, words: word, description: `the exact wording "${word}"`, onlyFor: '', near: '' };
    settings.rules.push(rule);
    selectedRuleId = rule.id;
    recompile();
    // 설정 화면이 떠 있을 때만 다시 그린다 (없으면 그릴 자리가 없다)
    if (document.getElementById('bwr_rule_chips')) { renderRules(); renderExceptionEditor(); }
    saveSettingsDebounced();
    toastr.success(`"${word}" 금지 규칙을 넣었어요`, TITLE);
    return true;
}

const ready = new Promise(resolve => jQuery(() => {
    try {
        start();
    } catch (error) {
        console.error(`[${TITLE}] 시작 실패`, error);
        globalThis.toastr?.error(`시작하지 못했어요: ${error?.message || error}`, TITLE, { timeOut: 20000 });
    }
    resolve();
}));

/** Blue Lemonade: the settings as a popup. */
export async function openPanel() {
    await ready;
    await ensureUi();
    if (!root) {
        toastr.warning('설정 화면을 만들지 못했어요. 새로고침한 뒤에도 같으면 알려 주세요.', TITLE);
        return;
    }
    // Connected is not enough: on a slow phone the wide-screen column can hold the settings while it is hidden.
    if (inlineHost?.isConnected && inlineHost.offsetParent) {
        root.scrollIntoView({ block: 'nearest' });
        return;
    }
    if (opening) return;
    opening = true;
    try {
        await callGenericPopup(root, POPUP_TYPE.TEXT, '', { okButton: '닫기', wide: true, large: true, allowVerticalScrolling: true, onOpen: roomyPopup });
    } finally {
        (inlineHost?.isConnected ? inlineHost : holder).replaceChildren(root);
        opening = false;
    }
}

/** Blue Lemonade: the settings inside the theme's own window. Returns the cleanup. */
export function mountInline(host) {
    inlineHost = host;
    host.textContent = opening ? '열린 설정창을 닫으면 여기에 표시돼요.' : '설정을 불러오는 중…';
    ready.then(ensureUi).then(() => {
        if (inlineHost !== host || !root || opening) return;
        host.replaceChildren(root);
        root.classList.add('bl-embedded-settings');
    });
    return () => {
        if (inlineHost !== host) return;
        inlineHost = null;
        root?.classList.remove('bl-embedded-settings');
        if (root && !opening) holder.append(root);
    };
}
