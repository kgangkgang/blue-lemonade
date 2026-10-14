// Pure, dependency-injected context selection. No settings, chat writes or model requests.
export class ContextSelectionError extends Error {
    constructor(code, message, details = {}, cause) {
        super(message, cause ? { cause } : undefined);
        this.name = 'ContextSelectionError';
        this.code = code;
        this.details = details;
        this.manualFallback = code !== 'CANCELLED' && code !== 'CONTEXT_CHANGED';
    }
}
const error = (code, message, details, cause) => new ContextSelectionError(code, message, details, cause);
const integer = value => Number.isSafeInteger(value) && value >= 0;

// Copy JSON-shaped request data once. Later edits to the source cannot change counted data.
function snapshot(value, label, seen = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || seen.has(value) ||
        (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) {
        throw error('INVALID_DATA', `${label}을 안전하게 읽지 못했어요. 대화 개수를 직접 골라 주세요.`);
    }
    seen.add(value);
    if (Array.isArray(value)) for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(value, i)) throw error('INVALID_DATA', `${label}에 비어 있는 항목이 있어요. 대화 개수를 직접 골라 주세요.`);
    }
    const result = Array.isArray(value) ? [] : {};
    for (const key of Object.keys(value)) {
        if (value[key] === undefined && !Array.isArray(value)) continue; // JSON transport omits these too.
        Object.defineProperty(result, key, { value: snapshot(value[key], label, seen), enumerable: true });
    }
    seen.delete(value);
    return Object.freeze(result);
}

/** Native promptTokens already excludes the native reply. Do not subtract it twice. */
export function calculateInputBudget({ promptTokens, contextTokens, replyTokens, targetContextTokens = null, safetyTokens = 0 }) {
    if (!integer(promptTokens) || !promptTokens || !integer(contextTokens) || !contextTokens ||
        !integer(replyTokens) || !integer(safetyTokens) || promptTokens > contextTokens ||
        (targetContextTokens !== null && (!integer(targetContextTokens) || !targetContextTokens))) {
        throw error('INVALID_BUDGET', '현재 컨텍스트 크기를 확인하지 못했어요. 대화 개수를 직접 골라 주세요.');
    }
    const inputTokens = Math.min(promptTokens, contextTokens - replyTokens,
        targetContextTokens === null ? Infinity : targetContextTokens - replyTokens) - safetyTokens;
    if (!integer(inputTokens) || !inputTokens) {
        throw error('NO_INPUT_BUDGET', '응답 예약량을 빼면 대화를 넣을 공간이 없어요. 응답 길이나 대화 개수를 조절해 주세요.');
    }
    return Object.freeze({ inputTokens, details: Object.freeze({ basis: 'current-chat-settings', promptTokens,
        contextTokens, replyTokens, targetContextTokens, safetyTokens }) });
}

/**
 * Optional native adapter: import ST functions in the calling extension and inject them here.
 * The native chat-completion counter includes role framing and rejects endpoint failures.
 * It uses the current chat tokenizer, which may differ from an extension's target model;
 * reserve safety tokens and report that limitation instead of claiming exact provider use.
 * Other API modes need a separately verified counter: generic ST counting can silently
 * fall back to character estimates, so this adapter deliberately does not use it.
 */
export function createSillyTavernContextServices({ getMaxPromptTokens, getMaxContextTokens, countTokensOpenAIAsync, getMainApi,
    replyTokens, targetContextTokens = null, safetyTokens = 128, timeoutMs = 15000 }) {
    if (![getMaxPromptTokens, getMaxContextTokens, countTokensOpenAIAsync, getMainApi].every(fn => typeof fn === 'function') ||
        !integer(timeoutMs) || !timeoutMs) throw error('INVALID_ADAPTER', '자동 대화 범위 연결을 확인하지 못했어요.');
    const requireSupported = () => {
        if (getMainApi() !== 'openai') throw error('UNSUPPORTED_TOKENIZER', '현재 연결의 토큰 수를 확실히 계산할 수 없어요. 대화 개수를 직접 골라 주세요.');
    };
    return {
        getInputBudget: () => {
            requireSupported();
            return calculateInputBudget({ promptTokens: getMaxPromptTokens(), contextTokens: getMaxContextTokens(),
                replyTokens: typeof replyTokens === 'function' ? replyTokens() : replyTokens,
                targetContextTokens: typeof targetContextTokens === 'function' ? targetContextTokens() : targetContextTokens, safetyTokens });
        },
        async countTokens(request, { signal, isCurrent = () => true } = {}) {
            requireSupported();
            const messages = Array.isArray(request) ? request : request?.messages;
            const extraPrompt = !Array.isArray(request) && ['tools', 'functions', 'response_format', 'responseSchema', 'json_schema',
                'system', 'systemInstruction', 'system_instruction', 'system_prompt', 'prompt', 'prefix', 'suffix', 'documents', 'context']
                .some(key => request?.[key] != null && request[key] !== '' && (!Array.isArray(request[key]) || request[key].length > 0));
            if (extraPrompt || !Array.isArray(messages) || messages.some(message => !message || typeof message.role !== 'string' || typeof message.content !== 'string' || message.tool_calls || message.function_call)) {
                throw error('UNSUPPORTED_REQUEST', '이 요청 형식의 토큰 수를 확인하지 못했어요. 대화 개수를 직접 골라 주세요.');
            }
            let timer, abortListener, stopped = false;
            const check = () => {
                if (signal?.aborted) throw error('CANCELLED', '대화 범위 계산을 취소했어요.');
                if (stopped) throw error('TOKENIZER_TIMEOUT', '토큰 계산 응답이 늦어 멈췄어요.');
                requireSupported();
                if (!isCurrent()) throw error('CONTEXT_CHANGED', '대화나 연결 설정이 바뀌어 계산을 멈췄어요. 다시 시도해 주세요.');
            };
            const operation = async () => {
                let total = 0;
                // Native full=true is the sum of per-message counts. Checking between messages
                // also prevents its fixed endpoint model / live cache-key model from diverging
                // if the active model changes while a tokenizer request is awaited.
                for (const message of messages) {
                    check();
                    const count = await countTokensOpenAIAsync([message], true);
                    check();
                    if (!integer(count) || count === 0) throw error('INVALID_TOKEN_COUNT', '토큰 수를 확인하지 못했어요. 대화 개수를 직접 골라 주세요.');
                    total += count;
                }
                return total;
            };
            const limits = new Promise((_, reject) => {
                timer = setTimeout(() => { stopped = true; reject(error('TOKENIZER_TIMEOUT', '토큰 계산 응답이 늦어 멈췄어요. 다시 시도하거나 대화 개수를 직접 골라 주세요.')); }, timeoutMs);
                if (signal) {
                    abortListener = () => { stopped = true; reject(error('CANCELLED', '대화 범위 계산을 취소했어요.')); };
                    signal.addEventListener('abort', abortListener, { once: true });
                    if (signal.aborted) abortListener();
                }
            });
            const tokens = await Promise.race([operation(), limits]).finally(() => {
                clearTimeout(timer); if (abortListener) signal.removeEventListener('abort', abortListener);
            });
            if (!integer(tokens) || (messages.length && tokens === 0)) {
                throw error('INVALID_TOKEN_COUNT', '토큰 수를 확인하지 못했어요. 대화 개수를 직접 골라 주세요.');
            }
            requireSupported();
            return { tokens, method: 'current-chat-native-messages', approximate: true };
        },
    };
}

function budgetOf(value) {
    const inputTokens = typeof value === 'number' ? value : value?.inputTokens;
    if (!integer(inputTokens) || inputTokens === 0) throw error('INVALID_BUDGET', '현재 컨텍스트 크기를 확인하지 못했어요. 대화 개수를 직접 골라 주세요.');
    return { inputTokens, details: typeof value === 'object' && value?.details ? snapshot(value.details, '컨텍스트 설정') : null };
}
function countOf(value, messages) {
    const tokens = typeof value === 'number' ? value : value?.tokens;
    if (!integer(tokens) || (messages > 0 && tokens === 0)) throw error('INVALID_TOKEN_COUNT', '토큰 수를 확인하지 못했어요. 대화 개수를 직접 골라 주세요.');
    return { tokens, method: typeof value?.method === 'string' ? value.method : null,
        approximate: typeof value?.approximate === 'boolean' ? value.approximate : null };
}

/**
 * Select the longest recent complete-message suffix under a fixed input budget.
 * history filtering and manual-mode caps belong to adapters; AUTO history must be uncapped.
 * buildRequest must include every final instruction, card, persona and prior output sent.
 * isCurrent must check the originating chat/snapshot, selected model/profile and options.
 * Counts must be stable and monotonic as older complete messages are added. Observed
 * violations fail explicitly; the logarithmic search cannot prove unobserved monotonicity.
 * Return request is the frozen payload actually counted, ready to send without rebuilding.
 */
export async function selectRecentContext({ history, getInputBudget, countTokens, buildRequest, isCurrent, signal, allowEmptyHistory = false } = {}) {
    if (!Array.isArray(history) || ![getInputBudget, countTokens, buildRequest, isCurrent].every(fn => typeof fn === 'function')) {
        throw error('INVALID_ADAPTER', '자동 대화 범위 연결을 확인하지 못했어요. 대화 개수를 직접 골라 주세요.');
    }
    const check = () => {
        if (signal?.aborted) throw error('CANCELLED', '대화 범위 계산을 취소했어요.');
        let current = false;
        try { current = isCurrent() === true; } catch { /* A failed guard cannot authorize a stale request. */ }
        if (!current) throw error('CONTEXT_CHANGED', '대화나 연결 설정이 바뀌어 계산을 멈췄어요. 다시 시도해 주세요.');
    };
    check();
    const fixed = snapshot(history, '대화 기록');
    if (!fixed.length && allowEmptyHistory !== true) throw error('EMPTY_HISTORY', '자동으로 고를 대화가 없어요. 대화 개수를 직접 골라 주세요.');
    const wait = async (fn, args, code, message) => {
        check();
        let listener;
        try {
            const operation = Promise.resolve().then(() => { check(); return fn(...args); });
            const value = signal ? await Promise.race([operation, new Promise((_, reject) => {
                listener = () => reject(error('CANCELLED', '대화 범위 계산을 취소했어요.'));
                signal.addEventListener('abort', listener, { once: true });
                if (signal.aborted) listener();
            })]) : await operation;
            check();
            return value;
        } catch (cause) {
            check();
            if (cause instanceof ContextSelectionError) throw cause;
            throw error(code, message, {}, cause);
        } finally { if (listener) signal.removeEventListener('abort', listener); }
    };
    const readBudget = async () => budgetOf(await wait(getInputBudget, [{ signal }], 'BUDGET_FAILED', '현재 컨텍스트 크기를 읽지 못했어요. 대화 개수를 직접 골라 주세요.'));
    const budget = await readBudget(), samples = new Map();
    let measurements = 0;
    const measure = async count => {
        const selected = Object.freeze(fixed.slice(fixed.length - count));
        const built = await wait(buildRequest, [selected, { signal }], 'BUILD_FAILED', '번역·생성 요청을 준비하지 못했어요.');
        const request = snapshot(built, '요청');
        const result = countOf(await wait(countTokens, [request, { signal, isCurrent }], 'TOKEN_COUNT_FAILED', '토큰 수를 계산하지 못했어요. 대화 개수를 직접 골라 주세요.'), count);
        measurements++;
        for (const [other, tokens] of samples) {
            if ((other < count && tokens > result.tokens) || (other > count && tokens < result.tokens)) {
                throw error('NON_MONOTONIC_COUNT', '대화 범위에 따라 요청 크기가 일정하게 늘지 않아요. 대화 개수를 직접 골라 주세요.');
            }
        }
        samples.set(count, result.tokens);
        return { count, history: selected, request, ...result };
    };
    const base = await measure(0);
    if (base.tokens > budget.inputTokens) throw error('BASE_OVER_BUDGET', '기본 지시와 카드만으로 컨텍스트를 넘어요. 지시나 응답 길이를 줄여 주세요.', { baseTokens: base.tokens, inputBudgetTokens: budget.inputTokens });
    if (!fixed.length && base.tokens === 0) throw error('EMPTY_REQUEST', '보낼 내용이 없어요. 입력 내용을 확인해 주세요.');
    let best = fixed.length ? await measure(1) : base;
    if (best.tokens > budget.inputTokens) throw error('LATEST_MESSAGE_TOO_LARGE', '가장 최근 대화 한 개도 컨텍스트에 들어가지 않아요. 응답 길이나 대화 범위를 직접 조절해 주세요.', { requestTokens: best.tokens, inputBudgetTokens: budget.inputTokens });
    if (fixed.length > 1) {
        // Bracket from the recent end first; native counters may issue one cache-miss
        // request per message, so eagerly measuring a huge full history is wasteful.
        let upper = null, probe = 2;
        while (probe <= fixed.length) {
            const candidate = await measure(probe);
            if (candidate.tokens > budget.inputTokens) { upper = probe; break; }
            best = candidate;
            if (probe === fixed.length) break;
            probe = Math.min(fixed.length, probe * 2);
        }
        if (upper !== null) {
            let low = best.count + 1, high = upper - 1;
            while (low <= high) {
                const middle = Math.floor((low + high) / 2), candidate = await measure(middle);
                if (candidate.tokens <= budget.inputTokens) { best = candidate; low = middle + 1; }
                else high = middle - 1;
            }
        }
    }
    // The binary-search boundary and the exact final payload are both checked.
    if (best.count < fixed.length && (!samples.has(best.count + 1) || samples.get(best.count + 1) <= budget.inputTokens)) {
        throw error('UNVERIFIED_BOUNDARY', '자동 대화 범위를 확정하지 못했어요. 대화 개수를 직접 골라 주세요.');
    }
    const finalCount = countOf(await wait(countTokens, [best.request, { signal, isCurrent }], 'TOKEN_COUNT_FAILED', '최종 요청의 토큰 수를 확인하지 못했어요.'), best.count);
    measurements++;
    if (finalCount.tokens !== best.tokens || finalCount.tokens > budget.inputTokens) {
        throw error('TOKEN_COUNT_CHANGED', '계산 중 토큰 수가 바뀌었어요. 대화 개수를 직접 골라 주세요.');
    }
    const lastBudget = await readBudget();
    if (lastBudget.inputTokens !== budget.inputTokens || JSON.stringify(lastBudget.details) !== JSON.stringify(budget.details)) {
        throw error('CONTEXT_CHANGED', '계산 중 컨텍스트 설정이 바뀌었어요. 다시 시도해 주세요.');
    }
    check();
    return Object.freeze({ history: best.history, request: best.request, count: best.count, omitted: fixed.length - best.count,
        inputBudgetTokens: budget.inputTokens, requestTokens: finalCount.tokens, baseTokens: base.tokens,
        measurements, budgetDetails: budget.details, countMethod: finalCount.method, approximate: finalCount.approximate });
}
