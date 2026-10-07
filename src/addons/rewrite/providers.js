// Providers for the "직접 선택" connection. The model lists are not kept here any more: they come from the shared
// live list (src/live-models.js) — what the provider offers right now through SillyTavern's /status, cached in this
// browser for a day, plus 모델 등록 and the theme's newest-known names when no list has been fetched yet.

import * as LM from '../../live-models.js';

/** secrets are SECRET_KEYS names from SillyTavern's secrets.js */
export const PROVIDERS = {
    openai: { label: 'OpenAI', source: 'openai', secrets: ['OPENAI'] },
    claude: { label: 'Claude', source: 'claude', secrets: ['CLAUDE'] },
    google: { label: 'Google AI Studio', source: 'makersuite', secrets: ['MAKERSUITE'] },
    vertexai: { label: 'Vertex AI', source: 'vertexai', secrets: ['VERTEXAI', 'VERTEXAI_SERVICE_ACCOUNT'] },
    openrouter: { label: 'OpenRouter', source: 'openrouter', secrets: ['OPENROUTER'] },
    deepseek: { label: 'DeepSeek', source: 'deepseek', secrets: ['DEEPSEEK'] },
    cohere: { label: 'Cohere', source: 'cohere', secrets: ['COHERE'] },
    // OpenAI-compatible servers have no fixed list: it is fetched from the endpoint, or the name is typed in.
    custom: { label: 'Custom (OpenAI 호환)', source: 'custom', secrets: ['CUSTOM'] },
};

/** Endpoint address without trailing slashes: SillyTavern appends '/chat/completions' and '/models' itself. */
export function normalizeUrl(url) {
    return String(url ?? '').trim().replace(/\/+$/, '');
}

export function isHttpUrl(url) {
    try {
        const { protocol } = new URL(url);
        return protocol === 'http:' || protocol === 'https:';
    } catch {
        return false;
    }
}

// ── Model lists ───────────────────────────────────────

/** SillyTavern's chat_completion_source for a provider key ('google' → 'makersuite'), '' when unknown. */
export function sourceOf(provider) {
    return PROVIDERS[provider]?.source ?? '';
}

/** Whether SillyTavern can fetch this provider's list (Claude and Vertex AI have no list call). */
export function canFetch(provider) {
    const source = sourceOf(provider);
    return Boolean(source) && LM.canList(source);
}

/** Custom: our own address, else SillyTavern's (then its extra headers and body come along). */
export function endpointOf(customUrl) {
    const own = normalizeUrl(customUrl);
    return own ? { url: own, inheritExtras: false } : { url: '', inheritExtras: true };
}

/** Cache key of the list the select shows: the provider's source, or 'custom:<address>'. */
export function listKey(provider, endpoint = endpointOf('')) {
    const source = sourceOf(provider);
    if (!source) return '';
    return LM.cacheKey(source, source === 'custom' ? endpoint.url : undefined);
}

/**
 * What the model select offers: { ids (newest first), savedMissing, live, at, key }.
 * Live list + 모델 등록 once fetched; before that 모델 등록 → newest-known names, plus SillyTavern's own select
 * where that is the only source (Claude, Vertex AI: no list call) or the server's list (Custom on SillyTavern's
 * address). A provider that can list never gets SillyTavern's long built-in list padded on — only what it offers.
 * `saved` is only reported (savedMissing), never changed.
 */
export function modelChoices(provider, saved, endpoint = endpointOf('')) {
    const source = sourceOf(provider);
    if (!source) return { ids: [], savedMissing: false, live: false, at: 0, key: '' };
    const want = saved === 'custom' ? '' : saved;
    if (source !== 'custom') return LM.list(source, { saved: want, page: !LM.canList(source) });
    return LM.list('custom', { saved: want, customUrl: endpoint.url, inheritCustom: Boolean(endpoint.inheritExtras) });
}

/** The entry the select shows: the saved one (kept even when the list lost it), else the first listed, else free text. */
export function pickModel(saved, ids) {
    return saved || ids[0] || 'custom';
}

/** Note after a saved model the list doesn't have. */
export function missingNote(provider, ids) {
    return provider === 'custom' && ids.length > 0 ? '이 주소 목록에 없음' : '이전 목록';
}

/**
 * The model name to send: the saved entry, else the first listed one, or the typed name when '커스텀 모델 입력'
 * is picked. There is no built-in default any more, so with nothing saved, listed or typed it is ''.
 */
export function resolveModel({ provider, models, customModels, customUrl } = {}, endpoint = endpointOf(customUrl)) {
    const saved = models?.[provider];
    const picked = saved || modelChoices(provider, '', endpoint).ids[0] || 'custom';
    return picked === 'custom' ? String(customModels?.[provider] ?? '').trim() : picked;
}

// ── Fetching a list ───────────────────────────────────
// Through SillyTavern's /status, the same call its own Connect button makes: the server adds the stored key, so the
// key never reaches the page. Custom keeps the exact request it always sent (address + extra headers).

export const LIST_TIMEOUT_MS = 30000;

function listOptions(provider, { endpoint, includeHeaders = '', headers } = {}) {
    const isCustom = sourceOf(provider) === 'custom';
    const options = {
        timeout: LIST_TIMEOUT_MS,
        inheritProxy: false,   // 5.7.1 다시 쓰기는 본체 리버스 프록시로 보내지 않는다 — 목록도 직접 연결의 것 (프록시 목록은 따로 키)
        fetcher: async (url, body, { timeout = LIST_TIMEOUT_MS } = {}) => {
            let response;
            try {
                response = await fetch(url, {
                    method: 'POST',
                    headers: typeof headers === 'function' ? headers() : headers,
                    body: JSON.stringify(body),
                    cache: 'no-cache',
                    signal: AbortSignal.timeout(timeout),
                });
            } catch (error) {
                if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
                    throw new Error(`${timeout / 1000}초 안에 응답이 없어요`);
                }
                throw error;
            }
            if (!response.ok) throw new Error(`서버 응답 ${response.status} ${response.statusText}`.trim());
            return response.json();
        },
    };
    if (isCustom) {
        options.customUrl = endpoint.url;
        options.body = { custom_url: endpoint.url, custom_include_headers: includeHeaders };
        // 5.7.1: quietly refresh only an address that was fetched before (↻ or an older list) — a freshly typed or mistyped
        // address must not get SillyTavern's stored Custom key without the button. SillyTavern's own address is always allowed.
        options.savedUrl = LM.cached(LM.cacheKey('custom', endpoint.url)).ids.length > 0;
    }
    return options;
}

function friendlyListError(provider, error) {
    if (!error?.empty) return error;
    return new Error(sourceOf(provider) === 'custom'
        ? '엔드포인트가 모델 목록을 돌려주지 않았어요. 주소(끝의 /v1까지)와 API 키를 확인해 주세요.'
        : '모델 목록을 돌려주지 않았어요. API 키를 확인해 주세요.');
}

/**
 * Fetches the list now (the button) → ids, newest first. Throws on failure; the old list stays.
 * @param {string} provider
 * @param {{endpoint?: {url: string, inheritExtras: boolean}, includeHeaders?: string, headers?: object | (() => object)}} [options]
 */
export async function fetchModelList(provider, options = {}) {
    if (!canFetch(provider)) throw new Error('이 공급자는 모델 목록을 받아 오지 않아요');
    if (sourceOf(provider) === 'custom' && !isHttpUrl(options.endpoint?.url)) throw new Error('커스텀 엔드포인트 주소가 비어 있어요.');
    try {
        return await LM.refresh(sourceOf(provider), listOptions(provider, options));
    } catch (error) {
        throw friendlyListError(provider, error);
    }
}

/** Quietly fetches the list when it is missing or a day old (settings opened, provider changed). Never throws. */
export function autoFetchModelList(provider, options = {}) {
    if (!canFetch(provider)) return Promise.resolve(null);
    if (sourceOf(provider) === 'custom' && !isHttpUrl(options.endpoint?.url)) return Promise.resolve(null);
    return LM.autoRefresh(sourceOf(provider), listOptions(provider, options));
}
