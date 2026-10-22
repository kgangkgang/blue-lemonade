// 7.7.2 중계 · 공식 가격 비교 — new-api / one-api 계열 중계의 공개 가격표(/api/pricing · /api/status)를 읽어 공식 단가와 견준다 (순수 함수).
//   중계 쿼터: 배율 1 = 100만 토큰당 쿼터 2달러(쿼터 단위 500000 기준). 입력 = model_ratio × 그룹 배율, 출력 = 입력 × completion_ratio,
//   캐시 읽기 = 입력 × cache_ratio. 실제 화폐 = 쿼터 달러 × 충전 단가(/api/status 의 price — 쿼터 1달러를 사는 데 드는 그 중계 화폐).
//   키 · 계정은 쓰지 않는다 — 두 주소 모두 공개 GET. 결과는 부르는 쪽이 이 기기에만 둔다.
export const RELAY_PRICING_PATH = '/api/pricing';
export const RELAY_STATUS_PATH = '/api/status';
export const MAX_RELAY_BYTES = 2 * 1024 * 1024;
const MAX_MODELS = 2000;

const num = (value, { min = 0, max = 1e6 } = {}) => { const n = Number(value); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
const text = (value, max = 120) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const round = n => Math.round(n * 1e6) / 1e6;

/** 주소 → origin (http · https 만, 경로 · 검색어 · 계정 정보 버림) */
export function relayOrigin(value) {
    try { const url = new URL(String(value || '').trim()); return ['https:', 'http:'].includes(url.protocol) ? url.origin : ''; } catch { return ''; }
}

/**
 * /api/pricing · /api/status 응답 → { models, groups, recharge, vendors } — 모르는 칸은 버리고 숫자는 범위를 본다. 형식이 아니면 throw.
 *   models: [{ name, vendor, kind: 'token' | 'request', ratio, completion, cache, cacheWrite, perRequest, groups }]
 *   groups: [{ id, ratio, note }]  (그룹 배율이 없으면 default 1 하나)
 *   recharge: { price, quotaPerUnit, display, usdRate } — price 는 쿼터 1달러 값(그 중계 화폐), 없으면 null
 */
export function parseRelayPricing(pricing, status) {
    const list = pricing?.data;
    if (!Array.isArray(list)) throw Object.assign(new Error('가격표 형식이 아니에요 (new-api /api/pricing 의 data 배열이 없어요)'), { format: true });
    const vendors = new Map((Array.isArray(pricing.vendors) ? pricing.vendors : []).map(v => [Number(v?.id), text(v?.name, 40)]).filter(([id, name]) => Number.isInteger(id) && name));
    const models = [];
    for (const row of list.slice(0, MAX_MODELS)) {
        const name = text(row?.model_name, 120);
        if (!name) continue;
        const perRequest = num(row.model_price, { max: 1e4 });
        const kind = Number(row.quota_type) === 1 || (perRequest !== null && perRequest > 0) ? 'request' : 'token';
        const ratio = num(row.model_ratio, { max: 1e4 });
        if (kind === 'token' && !(ratio > 0)) continue;
        models.push({
            name, vendor: vendors.get(Number(row.vendor_id)) || text(row.owner_by, 40), kind,
            ratio: ratio ?? 0, completion: num(row.completion_ratio, { max: 1e3 }) ?? 1,
            cache: num(row.cache_ratio, { max: 10 }), cacheWrite: num(row.create_cache_ratio, { max: 10 }),
            perRequest: kind === 'request' ? perRequest ?? 0 : null,
            groups: Array.isArray(row.enable_groups) ? row.enable_groups.map(g => text(g, 60)).filter(Boolean).slice(0, 40) : [],
        });
    }
    const ratios = pricing.group_ratio && typeof pricing.group_ratio === 'object' ? pricing.group_ratio : {};
    const notes = pricing.usable_group && typeof pricing.usable_group === 'object' ? pricing.usable_group : {};
    const groups = Object.entries(ratios).map(([id, r]) => ({ id: text(id, 60), ratio: num(r, { max: 100 }), note: text(notes[id], 160) })).filter(g => g.id && g.ratio > 0).slice(0, 40);
    if (!groups.length) groups.push({ id: 'default', ratio: 1, note: '' });
    const s = status?.data && typeof status.data === 'object' ? status.data : {};
    const recharge = { price: num(s.price, { max: 1e4 }) || null, quotaPerUnit: num(s.quota_per_unit, { min: 1, max: 1e9 }) || 500000, display: text(s.quota_display_type, 12), usdRate: num(s.usd_exchange_rate, { max: 1e4 }) || null };
    return { models, groups, recharge };
}

/** 쿼터 달러 / 100만 토큰 { input, output, cacheRead, cacheWrite } (토큰 과금만, 건당은 null) */
export function relayQuotaRates(model, { groupRatio = 1, quotaPerUnit = 500000 } = {}) {
    if (!model || model.kind !== 'token') return null;
    const input = model.ratio * (groupRatio > 0 ? groupRatio : 1) * 1e6 / (quotaPerUnit > 0 ? quotaPerUnit : 500000);   // 배율 1 · 단위 500000 → 2
    return {
        input: round(input), output: round(input * model.completion),
        cacheRead: round(input * (model.cache ?? 1)), cacheWrite: model.cacheWrite === null || model.cacheWrite === undefined ? null : round(input * model.cacheWrite),
    };
}

/**
 * 쿼터 달러 → 원 · 달러. money: { quotaPrice: 쿼터 1달러 값(그 중계 화폐), currencyPerUsd: 그 화폐 1달러 환율, krwPerUsd }
 *   그 중계 화폐가 달러면 currencyPerUsd 1. → { usd, krw } (원은 장부 환율)
 */
export function relayMoney(quotaUsd, { quotaPrice, currencyPerUsd, krwPerUsd }) {
    const real = quotaUsd * (quotaPrice > 0 ? quotaPrice : 1);
    const usd = real / (currencyPerUsd > 0 ? currencyPerUsd : 1);
    return { usd: round(usd), krw: Math.round(usd * (krwPerUsd > 0 ? krwPerUsd : 0)) };
}

/** 원 1원당이 아니라 「쿼터 1달러가 몇 원」 — 장부의 중계 원화 환산(relayKrw)에 쓴다 */
export const krwPerQuotaUsd = ({ quotaPrice, currencyPerUsd, krwPerUsd }) => Math.round((quotaPrice > 0 ? quotaPrice : 1) / (currencyPerUsd > 0 ? currencyPerUsd : 1) * (krwPerUsd > 0 ? krwPerUsd : 0) * 100) / 100;

/** 모델 이름 · 판매사로 공식 제공처 후보 (추측은 판매사 이름 · 잘 알려진 앞머리만, 표에 없으면 비교하지 않는다) */
export function officialProvidersFor(model) {
    const vendor = String(model?.vendor || '').toLowerCase(), name = String(model?.name || '').toLowerCase();
    const by = [['google', ['gemini', 'vertex']], ['gemini', ['gemini', 'vertex']], ['anthropic', ['anthropic']], ['claude', ['anthropic']], ['openai', ['openai']], ['deepseek', ['deepseek']],
        ['minimax', ['minimax']], ['xai', ['xai']], ['moonshot', ['moonshot']], ['kimi', ['moonshot']], ['zhipu', ['zai']], ['智谱', ['zai']], ['mistral', ['mistral']]];
    for (const [key, list] of by) if (vendor.includes(key)) return list;
    if (/^gemini-/.test(name)) return ['gemini', 'vertex'];
    if (/^claude-/.test(name)) return ['anthropic'];
    if (/^(gpt-|o\d|chatgpt-)/.test(name)) return ['openai'];
    if (/^deepseek-/.test(name)) return ['deepseek'];
    if (/^minimax-/.test(name)) return ['minimax'];
    if (/^grok-/.test(name)) return ['xai'];
    if (/^(kimi-|moonshot-)/.test(name)) return ['moonshot'];
    if (/^glm-/.test(name)) return ['zai'];
    return [];
}

/** 사용 묶음의 값(같은 화폐): mix { input, cachedInput, output } 토큰, rates 100만 토큰당. 캐시 단가가 없으면 입력 단가 */
export function mixCost(mix, rates) {
    if (!rates) return null;
    const cached = Math.min(mix.cachedInput || 0, mix.input || 0);
    const cacheRate = Number.isFinite(rates.cacheRead) ? rates.cacheRead : rates.input;
    return ((mix.input - cached) * rates.input + cached * cacheRate + (mix.output || 0) * rates.output) / 1e6;
}

/** 최근 장부 기록 → 모델마다 { input, cachedInput, output, requests } (이름 그대로, 대소문자만 무시) */
export function usageByModel(rows) {
    const out = new Map();
    for (const row of Array.isArray(rows) ? rows : []) {
        const key = String(row?.model || '').toLowerCase().replace(/^models\//, '');
        if (!key || !(row.input > 0 || row.output > 0)) continue;
        const m = out.get(key) || { input: 0, cachedInput: 0, output: 0, requests: 0 };
        m.input += row.input || 0; m.cachedInput += Math.min(row.cachedInput || 0, row.input || 0); m.output += row.output || 0; m.requests++;
        out.set(key, m);
    }
    return out;
}

/** 기록이 없을 때 쓰는 가정 묶음: 입력 100만 토큰, 출력은 입력 ÷ outPerIn, 캐시 cacheShare(0~1) */
export const assumedMix = ({ cacheShare = 0, outPerIn = 4 } = {}) => ({ input: 1e6, cachedInput: Math.round(1e6 * Math.min(Math.max(cacheShare, 0), 1)), output: Math.round(1e6 / (outPerIn > 0 ? outPerIn : 4)), requests: 0, assumed: true });

/**
 * 한 줄 비교: relay(달러 단가) · official(달러 단가 | null) · mix → { relayUsd, officialUsd, cheaper: 'relay' | 'official' | 'same' | null, diff(비율, 싼 쪽이 몇 % 싼지) }
 */
export function compareRow({ relayUsdRates, officialUsdRates, mix }) {
    const relayUsd = mixCost(mix, relayUsdRates), officialUsd = mixCost(mix, officialUsdRates);
    if (relayUsd === null || officialUsd === null || !(relayUsd >= 0) || !(officialUsd >= 0)) return { relayUsd, officialUsd, cheaper: null, diff: null };
    const hi = Math.max(relayUsd, officialUsd), lo = Math.min(relayUsd, officialUsd);
    if (hi === 0 || (hi - lo) / hi < 0.005) return { relayUsd, officialUsd, cheaper: 'same', diff: 0 };
    return { relayUsd, officialUsd, cheaper: relayUsd < officialUsd ? 'relay' : 'official', diff: Math.round((hi - lo) / hi * 100) };
}

/** 쿼터 달러 단가 → 실제 달러 단가 (같은 모양) */
export function relayUsdRates(quota, money) {
    if (!quota) return null;
    const f = q => q === null || q === undefined ? null : relayMoney(q, { ...money, krwPerUsd: 0 }).usd;
    return { input: f(quota.input), output: f(quota.output), cacheRead: f(quota.cacheRead), cacheWrite: f(quota.cacheWrite) };
}
