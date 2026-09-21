// Providers and model lists for the "직접 선택" connection. Mirrors LLM Translator (2026-09 lists):
// when refreshing models there, update this file too.

const GEMINI = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
];

/** secrets are SECRET_KEYS names from SillyTavern's secrets.js */
export const PROVIDERS = {
    openai: {
        label: 'OpenAI',
        source: 'openai',
        secrets: ['OPENAI'],
        models: [
            'gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6', 'gpt-5.5', 'gpt-5.4',
            'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.3-chat-latest', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-5-mini',
            'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3', 'gpt-4o', 'gpt-4o-mini',
        ],
    },
    claude: {
        label: 'Claude',
        source: 'claude',
        secrets: ['CLAUDE'],
        models: [
            'claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'claude-fable-5',
            'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-opus-4-5',
            'claude-sonnet-4-5',
        ],
    },
    google: {
        label: 'Google AI Studio',
        source: 'makersuite',
        secrets: ['MAKERSUITE'],
        models: GEMINI,
    },
    vertexai: {
        label: 'Vertex AI',
        source: 'vertexai',
        secrets: ['VERTEXAI', 'VERTEXAI_SERVICE_ACCOUNT'],
        models: GEMINI,
    },
    openrouter: {
        label: 'OpenRouter',
        source: 'openrouter',
        secrets: ['OPENROUTER'],
        models: [
            'google/gemini-3.8-flash', 'google/gemini-3.7-flash', 'google/gemini-3.5-flash-lite',
            'google/gemini-3.1-pro-preview', 'google/gemini-2.5-pro', 'anthropic/claude-fable-5.1',
            'anthropic/claude-opus-5', 'anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5', 'openai/gpt-6-astra',
            'openai/gpt-5.6-terra', 'openai/gpt-5.6-luna', 'deepseek/deepseek-v4.1-flash', 'deepseek/deepseek-v4-pro',
            'x-ai/grok-4.6', 'qwen/qwen3.8-max-0902', 'moonshotai/kimi-k3', 'z-ai/glm-5.3',
            'mistralai/mistral-medium-3-5',
        ],
    },
    deepseek: {
        label: 'DeepSeek',
        source: 'deepseek',
        secrets: ['DEEPSEEK'],
        models: ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash'],
    },
    cohere: {
        label: 'Cohere',
        source: 'cohere',
        secrets: ['COHERE'],
        models: [
            'command-a-plus-05-2026', 'command-a-03-2025', 'command-r7b-12-2024', 'command-r-plus-08-2024',
            'command-r-08-2024', 'c4ai-aya-expanse-32b', 'c4ai-aya-expanse-8b',
        ],
    },
    // OpenAI-compatible servers have no fixed list: it is fetched from the endpoint, or the name is typed in.
    custom: {
        label: 'Custom (OpenAI 호환)',
        source: 'custom',
        secrets: ['CUSTOM'],
        models: [],
    },
};

// ── Custom endpoint model lists ───────────────────────

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

/**
 * Model ids from a /models reply as SillyTavern's /status passes it on. The standard shape is {data: [...]}, but
 * some servers send a bare array or {models: [...]}. 'custom' is the free-text entry's value, so it is dropped.
 * @returns {string[] | null} Sorted unique ids, or null when the reply is an error
 */
export function modelIdsFrom(data) {
    const list = Array.isArray(data) ? data
        : Array.isArray(data?.data) ? data.data
            : Array.isArray(data?.models) ? data.models
                : [];
    if (list.length === 0 && data?.error) return null;
    const ids = list
        .map(item => (item && typeof item === 'object' ? item.id ?? item.name ?? '' : item))
        .map(id => String(id ?? '').trim())
        .filter(id => id && id !== 'custom');
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

/** Keeps only the newest `limit` addresses' lists (and `keepUrl`'s), so settings.json doesn't collect old ones. */
export function pruneModelLists(lists, keepUrl, limit = 3) {
    const newestFirst = Object.entries(lists)
        .sort((a, b) => String(b[1]?.fetchedAt ?? '').localeCompare(String(a[1]?.fetchedAt ?? '')));
    const keep = new Set([keepUrl, ...newestFirst.slice(0, limit).map(([url]) => url)]);
    for (const [url] of newestFirst) {
        if (!keep.has(url)) delete lists[url];
    }
}

/** The model name to send: the picked list entry, or the typed name when '커스텀 모델 입력' is picked. */
export function resolveModel({ provider, models, customModels }) {
    const picked = models?.[provider] || PROVIDERS[provider]?.models[0] || 'custom';
    return picked === 'custom' ? String(customModels?.[provider] ?? '').trim() : picked;
}

// Same per-model rules SillyTavern (public/scripts/openai.js) and LLM Translator apply.
// Requests here go straight to the backend, so without them newer models reject the request.
export function applyModelRequestRules(provider, model, request) {
    const dropSampling = (...keys) => keys.forEach(key => delete request[key]);
    const useMaxCompletionTokens = () => {
        // OpenRouter converts max_tokens itself, so only direct OpenAI needs the rename.
        if (provider === 'openai' && request.max_tokens !== undefined) {
            request.max_completion_tokens = request.max_tokens;
            delete request.max_tokens;
        }
    };

    if ((provider === 'openai' && /^(o1|o3|o4)/.test(model)) || (provider === 'openrouter' && /^openai\/(o1|o3|o4)/.test(model))) {
        useMaxCompletionTokens();
        dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }

    // GPT-5 and later reject sampling in reasoning mode; GPT-5.1–5.4 only reject penalties.
    if ((provider === 'openai' || provider === 'openrouter') && /gpt-(5|6)/.test(model)) {
        useMaxCompletionTokens();
        if (/gpt-5-chat-latest/.test(model)) {
            // Chat-only model accepts sampling.
        } else if (/gpt-5\.(1|2|3|4)/.test(model) && !/chat-latest/.test(model)) {
            dropSampling('frequency_penalty', 'presence_penalty');
        } else {
            dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
        }
    }

    // Claude Fable / Claude 5 reject all sampling values, including through proxies.
    if (/claude-(fable|opus-5|sonnet-5)/.test(model)) {
        dropSampling('temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty');
    }
}
