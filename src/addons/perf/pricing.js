// Pricing is selected from the request route, never from the model name alone.
import { priceSnapshot } from './pricing-live.js';
import { PROVIDERS, CHAT_PROVIDER, TEXT_PROVIDER, PROXY_SOURCES, providerAt } from './pricing-providers.js';
import { providerQuote } from './pricing-resolve.js';

export const PRICE_CHECKED = '2026-10-10';
export const PRICE_SOURCES = Object.freeze(Object.fromEntries(Object.entries(PROVIDERS).map(([key, value]) => [key, value.url])));

// USD / 1M: ordinary input, output, cache read, 5-minute write, 1-hour write.


export function safeOrigin(value) {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.origin : ''; }
    catch { return ''; }
}

export function manualPriceForConnection(price, connection) {
    if (!price) return null;
    // A legacy auto price has no source. Re-fetch it before using it on any relay.
    if (price.auto && (!price.origin || safeOrigin(price.origin) !== connection?.origin)) return null;
    return { ...price };
}

/** Only origin is retained: paths, userinfo, query strings and keys never enter pricing metadata. */
export function connectionFor(input, body = {}, localOrigin = '') {
    const source = String(body.chat_completion_source || body.api_type || '');
    const raw = typeof input === 'string' ? input : input?.url || input?.href || '';
    let path = ''; try { path = new URL(raw, localOrigin || 'http://localhost').pathname; } catch { /* malformed route */ }
    const direct = safeOrigin(raw);
    const isDirect = direct && direct !== localOrigin;
    let target = isDirect ? raw : '', native = '';
    if (!isDirect && path === '/api/backends/chat-completions/generate') {
        native = CHAT_PROVIDER[source] || '';
        if (source === 'custom') target = body.custom_url || '';
        else if (source === 'azure_openai') target = body.azure_base_url || '';
        else if (PROXY_SOURCES.has(source) && body.reverse_proxy) target = body.reverse_proxy;
        else {
            if (source === 'siliconflow' && body.siliconflow_endpoint === 'cn') native = 'siliconflow_cn';
            if (source === 'minimax' && body.minimax_endpoint === 'cn') native = 'minimax_cn';
            if (source === 'pollinations' && body.pollinations_endpoint === 'anonymous') native = 'pollinations_free';
            target = PROVIDERS[native]?.hosts[0] ? 'https://' + PROVIDERS[native].hosts[0] : '';
            if (native === 'vertex') {
                const region = String(body.vertexai_region || 'us-central1').replace(/[^a-z0-9-]/g, '');
                target = region === 'global' || body.vertexai_express_project_id ? 'https://aiplatform.googleapis.com' : `https://${region}-aiplatform.googleapis.com`;
            }
        }
    } else if (!isDirect && path === '/api/backends/text-completions/generate') {
        native = TEXT_PROVIDER[source] || '';
        target = body.api_server || body.api_url || '';
    } else if (!isDirect && path === '/api/novelai/generate') {
        native = 'novelai'; target = 'https://text.novelai.net';
    } else if (!isDirect && path === '/api/horde/generate-text') {
        native = 'horde'; target = 'https://aihorde.net';
    } else if (!isDirect && path === '/api/backends/kobold/generate') {
        native = 'local'; target = body.api_server || '';
    } else if (!isDirect) target = body.api_server || body.api_url || '';
    const origin = safeOrigin(target);
    let provider = providerAt(origin);
    // Never label a remote unknown host free/local merely because it speaks a local API dialect.
    if (provider === 'other' && native === 'local' && origin && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(origin).hostname)) provider = 'local';
    const coding = provider === 'zai' && ((!isDirect && source === 'zai' && !body.reverse_proxy && body.zai_endpoint === 'coding') || /\/api\/coding\/paas\//.test(target));
    const billing = coding ? 'plan' : PROVIDERS[provider]?.billing || '';
    let region = '';
    if (provider === 'vertex') {
        const pathRegion = String(target).match(/\/locations\/([a-z0-9-]+)\//)?.[1];
        const hostRegion = new URL(origin).hostname.match(/^([a-z0-9-]+)-aiplatform\./)?.[1];
        region = !isDirect && source === 'vertexai' && !body.reverse_proxy ? body.vertexai_region || 'us-central1' : pathRegion || hostRegion || 'global';
        region = String(region).replace(/[^a-z0-9-]/g, '');
    }
    return { provider, origin, label: PROVIDERS[provider] ? PROVIDERS[provider].label + (coding ? ' Coding Plan' : provider === 'local' ? '' : ' 공식 API') : origin ? new URL(origin).host : (source || '연결처 미확인'),
        ...(billing ? { billing } : {}), ...(provider === 'vertex' ? { region } : {}),
        ...(coding ? { note: 'Coding Plan 전용 경로예요. 구독 요금·할당량 기준이며 일반 API 토큰 단가를 적용하지 않아요.' } : {}) };
}

const n = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;

/** Anthropic input_tokens excludes cache; OpenAI input_tokens already includes it. */
export function mergeTokenUsage(previous, raw, anthropic = false) {
    const usage = { ...(previous || {}) };
    if (anthropic) {
        if (raw.input_tokens !== undefined) usage.uncached = n(raw.input_tokens);
        if (raw.cache_read_input_tokens !== undefined) usage.cached = n(raw.cache_read_input_tokens);
        if (raw.cache_creation_input_tokens !== undefined) usage.cacheWrite = n(raw.cache_creation_input_tokens);
        if (raw.cache_creation) {
            usage.cacheWrite5m = n(raw.cache_creation.ephemeral_5m_input_tokens);
            usage.cacheWrite1h = n(raw.cache_creation.ephemeral_1h_input_tokens);
            usage.cacheWriteSplit = true;
        }
        usage.prompt = n(usage.uncached) + n(usage.cached) + n(usage.cacheWrite);
    } else {
        if (raw.prompt_tokens !== undefined || raw.input_tokens !== undefined) usage.prompt = n(raw.prompt_tokens ?? raw.input_tokens);
        const details = raw.prompt_tokens_details ?? raw.input_tokens_details;
        if (raw.prompt_cache_hit_tokens !== undefined) usage.cached = n(raw.prompt_cache_hit_tokens);
        if (raw.cached_tokens !== undefined) usage.cached = n(raw.cached_tokens);
        if (raw.cache_creation_input_tokens !== undefined) usage.cacheWrite = n(raw.cache_creation_input_tokens);
        if (raw.cache_read_input_tokens !== undefined) usage.cached = n(raw.cache_read_input_tokens);
        if (raw.cache_creation) {
            usage.cacheWrite5m = n(raw.cache_creation.ephemeral_5m_input_tokens);
            usage.cacheWrite1h = n(raw.cache_creation.ephemeral_1h_input_tokens);
            usage.cacheWriteSplit = true;
        }
        if (details) {
            if (details.cached_tokens !== undefined) usage.cached = n(details.cached_tokens);
            if (details.cache_write_tokens !== undefined) usage.cacheWrite = n(details.cache_write_tokens);
        }
        const outputDetails = raw.completion_tokens_details ?? raw.output_tokens_details;
        if (outputDetails) usage.reasoning = n(outputDetails.reasoning_tokens);
    }
    if (raw.completion_tokens !== undefined || raw.output_tokens !== undefined) usage.completion = n(raw.completion_tokens ?? raw.output_tokens);
    const reported = typeof raw.cost === 'object' ? raw.cost?.total_cost : raw.cost;
    if (reported !== undefined && reported !== null && Number.isFinite(Number(reported)) && Number(reported) >= 0) usage.reportedCost = Number(reported);
    return usage;
}

function canonicalModel(model, table) {
    const name = String(model || '').trim();
    if (Object.hasOwn(table, name)) return name;
    const base = name.replace(/-(?:\d{8}|\d{4}-\d{2}-\d{2})$/, '');
    return Object.hasOwn(table, base) ? base : null;
}

/** Frozen, serializable quote. Missing prices stay unknown instead of borrowing a proxy's rate. */
export function quoteRequest({ connection, model, requestedModel, usage = {}, serviceTier = '', speed = '', inferenceGeo = '', estimated = false, manualPrice = null, manualUnit = '$', unsupported = false, at = Date.now(), requestEnd, hasMedia = false, priceData = priceSnapshot(connection?.provider) }) {
    const provider = connection?.provider || 'other';
    const OPENAI_RATES = provider === 'openai' ? priceData?.models || {} : {};
    const CLAUDE_RATES = provider === 'anthropic' ? priceData?.models || {} : {};
    const result = { version: 1, provider, origin: connection?.origin || '', label: connection?.label || '연결처 미확인', model, currency: 'USD', kind: 'unknown', cost: null, checked: priceData?.checkedAt || PRICE_CHECKED, priceStatus: priceData?.status || 'bundled', priceRevision: priceData?.revision || '', url: PRICE_SOURCES[provider] || '', note: '' };
    if (unsupported) return { ...result, note: '이 요청 종류는 토큰 단가만으로 계산할 수 없어요.' };
    if (!['anthropic','openai','other'].includes(provider)) return providerQuote({ result, connection, model, requestedModel, usage, serviceTier, estimated, manualPrice, manualUnit, at, requestEnd, hasMedia, priceData });
    if (provider === 'other') {
        if (!manualPrice) return { ...result, note: '이 연결처의 가격은 확인되지 않았어요. 다른 제공처의 단가를 대신 적용하지 않아요.' };
        return { ...result, kind: manualPrice.auto ? 'relay' : 'manual', currency: manualUnit === '$' ? 'USD' : manualUnit, checked: '', rates: { input: manualPrice.input, output: manualPrice.output }, cost: (n(usage.prompt) * manualPrice.input + n(usage.completion) * manualPrice.output) / 1e6, note: '사용자 가격표 기준 추정액 · 캐시 할인/저장 요금은 별도 반영되지 않아요.' };
    }
    let rates, resolvedModel, tier = serviceTier || 'standard';
    if (provider === 'anthropic') {
        resolvedModel = canonicalModel(model, CLAUDE_RATES);
        if (!resolvedModel) return { ...result, note: '공식 요금표에서 이 모델의 가격을 아직 확인하지 못했어요.' };
        const values = [...CLAUDE_RATES[resolvedModel]];
        if (resolvedModel === 'claude-haiku-5-5' && n(usage.prompt) > 100000) { values.splice(0,5,.5,2.5,.05,.625,1); tier = '입력 10만 초과'; }
        if (/^claude-(?:sonnet-4(?:-5)?|opus-4(?:-1|-5)?|haiku-4-5|3-5-haiku)$/.test(resolvedModel) && n(usage.prompt) > 200000) return { ...result, note: '이 구형 모델의 긴 문맥 단가는 별도 확인이 필요해요.' };
        let factor = 1;
        if (speed === 'fast') {
            if (['claude-opus-5-5','claude-opus-5','claude-opus-4-8'].includes(resolvedModel)) { factor = 2; tier = 'Fast'; }
            else if (resolvedModel !== 'claude-opus-4-6') return { ...result, note: '이 모델의 Fast 요금은 확인되지 않았어요.' };
        }
        if (serviceTier && !['standard','auto'].includes(serviceTier)) return { ...result, note: '별도 계약·처리 등급의 요금은 확인되지 않았어요.' };
        if (inferenceGeo === 'us') factor *= 1.1;
        else if (inferenceGeo && inferenceGeo !== 'global') return { ...result, note: '이 추론 지역의 단가는 확인되지 않았어요.' };
        rates = Object.fromEntries(['input','output','cacheRead','cacheWrite5m','cacheWrite1h'].map((key,index) => [key, values[index] * factor]));
        if (inferenceGeo === 'us') tier += ' · 미국 추론 +10%';
    } else {
        resolvedModel = canonicalModel(model, OPENAI_RATES);
        if (!resolvedModel) return { ...result, note: '공식 요금표에서 이 모델의 가격을 아직 확인하지 못했어요.' };
        tier = ({ default: 'standard', auto: 'standard', priority: 'fast' })[tier] || tier;
        const row = OPENAI_RATES[resolvedModel][tier];
        if (!row) return { ...result, note: '이 모델·처리 등급의 공식 가격을 아직 확인하지 못했어요.' };
        const long = n(usage.prompt) > 272000 && OPENAI_RATES[resolvedModel].standard[4] !== null;
        const offset = long ? 4 : 0;
        if (row[offset] === null) return { ...result, note: '이 처리 등급의 긴 문맥 가격은 확인되지 않았어요.' };
        rates = { input: row[offset], cacheRead: row[offset+1], cacheWrite: row[offset+2], output: row[offset+3] };
        if (long) tier += ' · 입력 27.2만 초과';
    }
    Object.assign(result, { kind: 'official', resolvedModel, rates, tier, note: '공식 공개 단가로 계산한 토큰 예상액 · 세금·도구 사용료·개별 계약 할인 제외' });
    if (hasMedia) return { ...result, note: '별도 미디어 입력이 포함되어 텍스트 단가만으로 전체 비용을 계산하지 않았어요.' };
    if (estimated) result.note += ' · API 사용량이 없어 토큰 수를 추정했어요';
    const prompt = n(usage.prompt), cached = n(usage.cached), write = n(usage.cacheWrite), output = n(usage.completion);
    if (cached + write > prompt) return { ...result, note: 'API 사용량의 입력·캐시 수치가 맞지 않아 비용을 계산하지 않았어요.' };
    let cost = (prompt - cached - write) * rates.input + output * rates.output;
    if (cached && rates.cacheRead == null) return { ...result, note: '이 모델의 캐시 읽기 가격을 확인할 수 없어요.' };
    cost += cached * (rates.cacheRead || 0);
    if (provider === 'anthropic') {
        if (write && (!usage.cacheWriteSplit || n(usage.cacheWrite5m) + n(usage.cacheWrite1h) !== write)) return { ...result, note: '캐시 저장 시간(5분/1시간)별 사용량이 없어 비용을 확정할 수 없어요.' };
        cost += n(usage.cacheWrite5m) * rates.cacheWrite5m + n(usage.cacheWrite1h) * rates.cacheWrite1h;
    } else {
        if (write && rates.cacheWrite == null) return { ...result, note: '이 모델의 캐시 저장 가격을 확인할 수 없어요.' };
        cost += write * (rates.cacheWrite || 0);
    }
    result.cost = cost / 1e6;
    return result;
}
