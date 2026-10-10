import { PROVIDERS } from './pricing-providers.js';
import { priceSnapshot } from './pricing-live.js';

const count = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
const standard = tier => !tier || ['auto','default','standard','on_demand'].includes(tier);
const unknown = (result, note) => ({ ...result, cost: null, note });
const copyRates = rates => rates ? JSON.parse(JSON.stringify(rates)) : null;

function findModel(table, model) {
    const id = String(model || '').replace(/^models\//, '');
    if (Object.hasOwn(table, id)) return id;
    // Only provider-published aliases in the catalog are eligible. No family/prefix guessing.
    return Object.keys(table).find(key => table[key].aliases?.includes(id));
}

function deepseekPeriod(at) {
    const date = new Date(at), day = date.getUTCDay(), hour = date.getUTCHours();
    if (![1,2,3,4,5].includes(day) || !((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10))) return 'offpeak';
    // State Council's 2026 holiday schedule; weekends remain off-peak per DeepSeek's rule.
    // https://www.beijing.gov.cn/zhengce/zhengcefagui/202511/t20251104_4258873.html
    if (date.getUTCFullYear() !== 2026) return 'peak-or-holiday';
    const md = (date.getUTCMonth()+1)*100 + date.getUTCDate();
    if ([[101,103],[215,223],[404,406],[501,505],[619,621],[925,927],[1001,1007]].some(([a,b]) => md >= a && md <= b)) return 'offpeak';
    return 'peak';
}

/** All rates are in the connected seller's currency. Subscription fees never become token rates. */
export function providerQuote({ result, connection, model, requestedModel, usage = {}, serviceTier = '', estimated, manualPrice, manualUnit, at, requestEnd, hasMedia, priceData = priceSnapshot(connection.provider) }) {
    const info = PROVIDERS[connection.provider], provider = connection.provider;
    result = { ...result, currency: info.currency || 'USD', billing: connection.billing || info.billing || 'tokens' };
    const explain = [connection.note || info.note || '', estimated ? 'API 사용량이 없어 토큰 수를 추정했어요.' : ''].filter(Boolean).join(' ');
    const reported = info.reported && Number.isFinite(usage.reportedCost) && usage.reportedCost >= 0;
    const finish = quote => reported ? { ...quote, cost: usage.reportedCost, kind: 'reported', note: 'API 응답이 알려 준 요청 비용이에요. ' + quote.note } : quote;
    if (['plan','local','deployment'].includes(result.billing)) {
        if (!manualPrice || manualPrice.auto) return { ...result, kind: result.billing, note: explain };
        return { ...result, kind: 'manual', currency: manualUnit === '$' ? 'USD' : manualUnit, checked: '', rates: { input: manualPrice.input, output: manualPrice.output }, cost: (count(usage.prompt)*manualPrice.input + count(usage.completion)*manualPrice.output)/1e6, note: explain + ' 사용자가 지정한 토큰 환산 추정액이에요.' };
    }
    if (result.billing === 'free') return { ...result, kind: 'free', rates: { input: 0, output: 0 }, cost: 0, note: explain };
    const table = priceData?.models || {}, resolvedModel = findModel(table, model) || findModel(table, requestedModel), row = table[resolvedModel];
    if (!row) {
        if (manualPrice && !manualPrice.auto) return { ...result, kind: 'manual', currency: manualUnit === '$' ? 'USD' : manualUnit, checked: '', rates: { input: manualPrice.input, output: manualPrice.output }, cost: (count(usage.prompt)*manualPrice.input + count(usage.completion)*manualPrice.output)/1e6, note: '공식 모델 단가 미확인 · 사용자가 지정한 가격으로 계산했어요. ' + explain };
        return finish(unknown(result, '공식 가격표에서 이 모델의 단가를 확인하지 못했어요. ' + explain));
    }
    const long = row.longAbove !== undefined && count(usage.prompt) > row.longAbove;
    let rates = copyRates(long ? row.longRates : row.rates), tier = standard(serviceTier) ? 'standard' : serviceTier;
    if (!rates || rates.input == null || rates.output == null) return finish(unknown(result, '이 문맥 길이의 공식 단가를 확인하지 못했어요.'));
    if (!standard(tier)) {
        const explicit = (long ? row.longTiers : row.tiers)?.[tier];
        if (explicit) rates = copyRates(explicit);
        else if (tier === 'priority' && row.priorityFactor) for (const key of Object.keys(rates)) rates[key] *= row.priorityFactor;
        else return finish(unknown(result, '이 모델·처리 등급의 공식 단가를 확인하지 못했어요.'));
    }
    if (provider === 'vertex') {
        const region = connection.region || (connection.origin === 'https://aiplatform.googleapis.com' ? 'global' : '');
        if (row.globalOnly && region !== 'global') return unknown(result, '이 모델의 지역별 단가는 확인되지 않았어요. 전역(Global) 단가를 대신 적용하지 않아요.');
        if (row.regionalFactor && region !== 'global') { for (const key of Object.keys(rates)) rates[key] *= row.regionalFactor; tier += ' · 지역 엔드포인트'; }
    }
    if (row.cacheWrite5m != null) Object.assign(rates, { cacheWrite5m: row.cacheWrite5m, cacheWrite1h: row.cacheWrite1h });
    let uncertain = row.uncertain, note = ['공식 공개 단가 기준 예상액 · 세금·별도 도구/보관료·계약 할인 제외', explain, row.note].filter(Boolean).join(' · ');
    if (model !== resolvedModel && requestedModel === resolvedModel) note += ' · 응답 모델명의 단가가 없어 이 제공처에 요청한 모델 ID 기준이에요.';
    let alternatives;
    if (row.timePricing === 'deepseek') {
        alternatives = { label: '혼잡 시간 / 그 외 시간', rates: { peak: copyRates(rates), offpeak: Object.fromEntries(Object.entries(rates).map(([k,v]) => [k,v/2])) } };
        const period = deepseekPeriod(at);
        if (period === 'offpeak') { rates = alternatives.rates.offpeak; tier += ' · 비혼잡 시간'; }
        else if (period === 'peak') tier += ' · 혼잡 시간';
        else { uncertain = true; tier += ' · 혼잡 시간 상한'; note += ' · 해당 연도의 중국 공휴일 여부를 확인할 수 없어 비용 합산에서 제외해요.'; }
        note += ' · 평일 UTC 01–04시·06–10시는 혼잡 요금, 그 외 시간·주말·중국 공휴일은 절반이에요.';
        if (requestEnd && deepseekPeriod(requestEnd) !== period) { uncertain = true; note += ' · 요청 중 요금 시간대가 바뀌었어요.'; }
    }
    if (long) tier += ` · 입력 ${Number(row.longAbove+1).toLocaleString('ko-KR')} 이상`;
    result = { ...result, kind: 'official', rates, tier, resolvedModel, note, ...(alternatives ? { alternatives } : {}), ...(info.minimum || row.minimum ? { minimum: true } : {}) };
    if (row.expires && at > Date.parse(row.expires)) return finish(unknown(result, '등록된 할인 기간이 끝났어요. 최신 공식 요금 확인이 필요해요.'));
    if (hasMedia) return finish(unknown(result, '오디오·영상 입력이 포함되어 텍스트 단가만으로 전체 비용을 계산하지 않았어요.'));
    if (uncertain) return finish(unknown(result, note));
    if (info.reported) return finish(unknown(result, note + ' · 응답 비용이 없으면 총액을 확정하지 않아요.'));
    const prompt = count(usage.prompt), output = count(usage.completion), cached = count(usage.cached), write = count(usage.cacheWrite);
    if (cached + write > prompt) return unknown(result, '입력·캐시 사용량이 맞지 않아 비용을 계산하지 않았어요.');
    if (cached && rates.cacheRead == null) return unknown(result, '캐시 읽기 단가가 없어 비용을 계산하지 않았어요.');
    let cost = (prompt-cached-write)*rates.input + output*rates.output + cached*(rates.cacheRead || 0);
    if (write) {
        if (rates.cacheWrite5m != null) {
            if (!usage.cacheWriteSplit || count(usage.cacheWrite5m)+count(usage.cacheWrite1h)!==write) return unknown(result, '캐시 저장 시간별 사용량이 없어 비용을 계산하지 않았어요.');
            if (usage.cacheWrite1h && rates.cacheWrite1h == null) return unknown(result, '1시간 캐시 저장 가격은 확인되지 않았어요.');
            cost += count(usage.cacheWrite5m)*rates.cacheWrite5m + count(usage.cacheWrite1h)*(rates.cacheWrite1h || 0);
        } else {
            if (rates.cacheWrite == null) return unknown(result, '캐시 저장 단가가 없어 비용을 계산하지 않았어요.');
            cost += write*rates.cacheWrite;
        }
    }
    return { ...result, cost: cost/1e6 };
}

export const catalogCount = provider => Object.keys(priceSnapshot(provider)?.models || {}).length;
