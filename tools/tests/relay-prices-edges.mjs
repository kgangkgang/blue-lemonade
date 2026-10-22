// 7.7.2 중계 가격표 읽기 · 환산의 경계 (relay-prices.js) — 응답 모양 · 숫자 범위 · 그룹 배율 · 충전 단가 · 공식 후보 · 묶음 값 · 비교 판정.
//   relay-compare 가 흐름을 보고, 여기는 칸마다 고른 값과 한도를 본다. 지어낸 중계 · 판매사 · 모델만. 네트워크 없음.
//   node tools/tests/relay-prices-edges.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const R = await import(pathToFileURL(path.join(root, 'src/relay-prices.js')).href);
let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const row = over => ({ model_name: 'm', model_ratio: 1, ...over });
const parse = (rows, extra = {}, status) => R.parseRelayPricing({ data: rows, ...extra }, status);

test('상수 · relayOrigin', () => {
    assert.equal(R.RELAY_PRICING_PATH, '/api/pricing');
    assert.equal(R.RELAY_STATUS_PATH, '/api/status');
    assert.equal(R.MAX_RELAY_BYTES, 2 * 1024 * 1024);
    assert.equal(R.relayOrigin(' https://u:p@relay.example.test/v1?key=x '), 'https://relay.example.test');
    assert.equal(R.relayOrigin('http://relay.example.test:3000/'), 'http://relay.example.test:3000');
    for (const bad of ['ftp://relay.example.test', 'relay.example.test', '', null, undefined]) assert.equal(R.relayOrigin(bad), '', String(bad));
});

test('parseRelayPricing: 형식 · 이름 · 토큰/건당 갈래', () => {
    for (const bad of [null, {}, { data: {} }, { data: 'x' }]) assert.throws(() => R.parseRelayPricing(bad), e => e.format === true && /가격표 형식이 아니에요/.test(e.message));
    const p = parse([row({ model_name: '  a   b  ' }), row({ model_name: '' }), null, row({ model_name: 5 }), row({ model_name: 'x'.repeat(130) })]);
    assert.deepEqual(p.models.map(m => m.name), ['a b', 'x'.repeat(120)]);
    // 토큰 과금은 배율이 0 보다 커야, 건당은 quota_type 1 이거나 model_price > 0
    const k = parse([row({ model_name: 't0', model_ratio: 0 }), row({ model_name: 't-neg', model_ratio: -1 }), row({ model_name: 't-big', model_ratio: 10001 }), row({ model_name: 't-max', model_ratio: 10000 }),
        row({ model_name: 'q1', quota_type: '1', model_ratio: 0 }), row({ model_name: 'p', model_price: 0.02, model_ratio: 0 }), row({ model_name: 'p0', model_price: 0, model_ratio: 2 }), row({ model_name: 'pbig', model_price: 10001, model_ratio: 3 })]).models;
    assert.deepEqual(k.map(m => [m.name, m.kind, m.ratio, m.perRequest]), [['t-max', 'token', 10000, null], ['q1', 'request', 0, 0], ['p', 'request', 0, 0.02], ['p0', 'token', 2, null], ['pbig', 'token', 3, null]]);
});

test('parseRelayPricing: 칸 범위 · 판매사 · 그룹 목록', () => {
    const p = parse([row({ completion_ratio: 4, cache_ratio: 0.1, create_cache_ratio: 1.25, vendor_id: '2', enable_groups: ['default', '', 7, 'vip', ...Array.from({ length: 50 }, (_, i) => 'g' + i)] }),
        row({ model_name: 'n', completion_ratio: 1001, cache_ratio: 11, create_cache_ratio: -1, owner_by: '  Own  er ', vendor_id: 9 }),
        row({ model_name: 'e', completion_ratio: 1000, cache_ratio: 10, create_cache_ratio: 10, enable_groups: 'x' }),
        row({ model_name: 'z', completion_ratio: 0, cache_ratio: 0 })],
    { vendors: [{ id: 2, name: '판매사 갑' }, { id: 'x', name: 'bad' }, { id: 3, name: '' }, null] });
    const [a, n, e, z] = p.models;
    assert.deepEqual([a.vendor, a.completion, a.cache, a.cacheWrite, a.groups.length, a.groups.slice(0, 3)], ['판매사 갑', 4, 0.1, 1.25, 40, ['default', 'vip', 'g0']]);
    assert.deepEqual([n.vendor, n.completion, n.cache, n.cacheWrite, n.groups], ['Own er', 1, null, null, []], '범위 밖은 기본 · 모름');
    assert.deepEqual([e.completion, e.cache, e.cacheWrite, e.groups], [1000, 10, 10, []]);
    assert.deepEqual([z.completion, z.cache], [0, 0], '0 은 그대로 (?? 라서 1 로 바꾸지 않는다)');
    assert.equal(parse([row({ owner_by: 'x'.repeat(50) })]).models[0].vendor.length, 40);
    assert.equal(parse([row()]).models[0].vendor, '');
    assert.equal(parse(Array.from({ length: 2005 }, (_, i) => row({ model_name: 'm' + i }))).models.length, 2000);
});

test('parseRelayPricing: 그룹 배율 · 설명 · 충전 단가', () => {
    const p = parse([row()], { group_ratio: { default: 1, vip: 0.5, zero: 0, neg: -1, big: 101, max: 100, ['x'.repeat(70)]: 2 }, usable_group: { vip: '  빠른  줄 ', default: 3 } });
    assert.deepEqual(p.groups.map(g => [g.id, g.ratio, g.note]), [['default', 1, ''], ['vip', 0.5, '빠른 줄'], ['max', 100, ''], ['x'.repeat(60), 2, '']]);
    assert.deepEqual(parse([row()]).groups, [{ id: 'default', ratio: 1, note: '' }]);
    assert.deepEqual(parse([row()], { group_ratio: { zero: 0 } }).groups, [{ id: 'default', ratio: 1, note: '' }]);
    assert.deepEqual(parse([row()], { group_ratio: 'x', usable_group: 'y' }).groups.map(g => g.id), ['default']);
    assert.equal(parse([row()], { group_ratio: Object.fromEntries(Array.from({ length: 45 }, (_, i) => ['g' + i, 1])) }).groups.length, 40);
    assert.equal(parse([row()], { group_ratio: { g: 1 }, usable_group: { g: 'n'.repeat(200) } }).groups[0].note.length, 160);
    const r = parse([row()], {}, { data: { price: 7.3, quota_per_unit: 1000, quota_display_type: 'CNY-and-more!', usd_exchange_rate: 7.1 } }).recharge;
    assert.deepEqual(r, { price: 7.3, quotaPerUnit: 1000, display: 'CNY-and-more', usdRate: 7.1 });
    assert.deepEqual(parse([row()]).recharge, { price: null, quotaPerUnit: 500000, display: '', usdRate: null });
    assert.deepEqual(parse([row()], {}, { data: { price: 0, quota_per_unit: 0.5, usd_exchange_rate: 1e5 } }).recharge, { price: null, quotaPerUnit: 500000, display: '', usdRate: null });
    assert.deepEqual(parse([row()], {}, { data: { price: 1e4, quota_per_unit: 1, usd_exchange_rate: 1e4 } }).recharge, { price: 1e4, quotaPerUnit: 1, display: '', usdRate: 1e4 });
    assert.equal(parse([row()], {}, { data: { price: 10001 } }).recharge.price, null);
    assert.equal(parse([row()], {}, { data: { quota_per_unit: 1e9 + 1 } }).recharge.quotaPerUnit, 500000);
    assert.equal(parse([row()], {}, { data: 'x' }).recharge.price, null);
});

test('relayQuotaRates: 배율 1 · 단위 500000 → 입력 2 쿼터 달러, 그룹 · 출력 · 캐시', () => {
    const m = { kind: 'token', ratio: 1.5, completion: 4, cache: 0.1, cacheWrite: 1.25 };
    assert.deepEqual(R.relayQuotaRates(m), { input: 3, output: 12, cacheRead: 0.3, cacheWrite: 3.75 });
    assert.deepEqual(R.relayQuotaRates(m, { groupRatio: 0.5 }), { input: 1.5, output: 6, cacheRead: 0.15, cacheWrite: 1.875 });
    assert.deepEqual(R.relayQuotaRates(m, { groupRatio: 0 }).input, 3, '0 · 음수 그룹 배율은 1');
    assert.deepEqual(R.relayQuotaRates(m, { groupRatio: -2 }).input, 3);
    assert.deepEqual(R.relayQuotaRates(m, { quotaPerUnit: 1e6 }).input, 1.5);
    assert.deepEqual(R.relayQuotaRates(m, { quotaPerUnit: 0 }).input, 3);
    assert.deepEqual(R.relayQuotaRates({ ...m, cache: null, cacheWrite: null }), { input: 3, output: 12, cacheRead: 3, cacheWrite: null }, '캐시 배율이 없으면 입력과 같게');
    assert.deepEqual(R.relayQuotaRates({ ...m, cache: 0, cacheWrite: undefined }).cacheRead, 0);
    assert.equal(R.relayQuotaRates({ ...m, cacheWrite: undefined }).cacheWrite, null);
    assert.equal(R.relayQuotaRates({ ...m, cacheWrite: 0 }).cacheWrite, 0);
    assert.equal(R.relayQuotaRates({ ...m, kind: 'request' }), null);
    assert.equal(R.relayQuotaRates(null), null);
    assert.equal(R.relayQuotaRates({ kind: 'token', ratio: 1 / 3, completion: 1 }).input, Math.round(2 / 3 * 1e6) / 1e6, '소수 6자리');
});

test('relayMoney · krwPerQuotaUsd · relayUsdRates: 충전 단가 · 화폐 환율 · 원', () => {
    assert.deepEqual(R.relayMoney(2, { quotaPrice: 7, currencyPerUsd: 7, krwPerUsd: 1300 }), { usd: 2, krw: 2600 });
    assert.deepEqual(R.relayMoney(2, { quotaPrice: 0.5, currencyPerUsd: 1, krwPerUsd: 1300 }), { usd: 1, krw: 1300 });
    assert.deepEqual(R.relayMoney(2, { quotaPrice: 0, currencyPerUsd: 0, krwPerUsd: 1000 }), { usd: 2, krw: 2000 }, '0 은 1 로');
    assert.deepEqual(R.relayMoney(2, { quotaPrice: -1, currencyPerUsd: -1, krwPerUsd: -1 }), { usd: 2, krw: 0 });
    assert.deepEqual(R.relayMoney(1, { quotaPrice: 1, currencyPerUsd: 3 }), { usd: Math.round(1e6 / 3) / 1e6, krw: 0 });
    assert.equal(R.krwPerQuotaUsd({ quotaPrice: 7.2, currencyPerUsd: 7.2, krwPerUsd: 1332.1 }), 1332.1);
    assert.equal(R.krwPerQuotaUsd({ quotaPrice: 0.3, currencyPerUsd: 1, krwPerUsd: 1332.1 }), 399.63);
    assert.equal(R.krwPerQuotaUsd({ quotaPrice: 0, currencyPerUsd: 0, krwPerUsd: 1000 }), 1000);
    assert.equal(R.krwPerQuotaUsd({ quotaPrice: 1, currencyPerUsd: 1, krwPerUsd: 0 }), 0);
    assert.equal(R.krwPerQuotaUsd({ quotaPrice: 1, currencyPerUsd: 3, krwPerUsd: 1000 }), 333.33);
    assert.equal(R.relayUsdRates(null, {}), null);
    assert.deepEqual(R.relayUsdRates({ input: 2, output: 8, cacheRead: null, cacheWrite: undefined }, { quotaPrice: 0.5, currencyPerUsd: 1, krwPerUsd: 9999 }), { input: 1, output: 4, cacheRead: null, cacheWrite: null });
    assert.deepEqual(R.relayUsdRates({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, {}), { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
});

test('officialProvidersFor: 판매사 이름이 먼저, 그다음 잘 알려진 앞머리만', () => {
    const f = (name, vendor) => R.officialProvidersFor({ name, vendor });
    assert.deepEqual(f('x', 'Google'), ['gemini', 'vertex']);
    assert.deepEqual(f('x', 'Gemini Team'), ['gemini', 'vertex']);
    assert.deepEqual(f('x', 'Anthropic'), ['anthropic']);
    assert.deepEqual(f('x', 'claude'), ['anthropic']);
    assert.deepEqual(f('gemini-x', 'OpenAI'), ['openai'], '판매사가 이름보다 먼저');
    assert.deepEqual(f('x', 'DeepSeek'), ['deepseek']);
    assert.deepEqual(f('x', 'MiniMax'), ['minimax']);
    assert.deepEqual(f('x', 'xAI'), ['xai']);
    assert.deepEqual(f('x', 'Moonshot'), ['moonshot']);
    assert.deepEqual(f('x', 'Kimi'), ['moonshot']);
    assert.deepEqual(f('x', 'Zhipu AI'), ['zai']);
    assert.deepEqual(f('x', '智谱'), ['zai']);
    assert.deepEqual(f('x', 'Mistral'), ['mistral']);
    assert.deepEqual(f('Gemini-4', ''), ['gemini', 'vertex']);
    assert.deepEqual(f('claude-opus-5-5', ''), ['anthropic']);
    for (const n of ['gpt-6-sol', 'o4-mini', 'chatgpt-4o']) assert.deepEqual(f(n, ''), ['openai'], n);
    assert.deepEqual(f('deepseek-v4', ''), ['deepseek']);
    assert.deepEqual(f('minimax-m3', ''), ['minimax']);
    assert.deepEqual(f('grok-5', ''), ['xai']);
    assert.deepEqual(f('kimi-k3', ''), ['moonshot']);
    assert.deepEqual(f('moonshot-v2', ''), ['moonshot']);
    assert.deepEqual(f('glm-5', ''), ['zai']);
    for (const n of ['my-gemini-copy', 'ogpt', 'oX', 'llama-4', '']) assert.deepEqual(f(n, ''), [], n);
    assert.deepEqual(R.officialProvidersFor(null), []);
});

test('mixCost · usageByModel · assumedMix', () => {
    assert.equal(R.mixCost({ input: 1e6 }, null), null);
    assert.equal(R.mixCost({ input: 1e6, cachedInput: 4e5, output: 2e5 }, { input: 2, output: 10, cacheRead: 0.5 }), (6e5 * 2 + 4e5 * 0.5 + 2e5 * 10) / 1e6);
    assert.equal(R.mixCost({ input: 1e6, cachedInput: 4e5 }, { input: 2, output: 10 }), 2, '캐시 단가가 없으면 입력 단가, 출력 없음은 0');
    assert.equal(R.mixCost({ input: 10, cachedInput: 50 }, { input: 1, output: 1, cacheRead: 0 }), 0, '캐시는 입력만큼까지');
    assert.equal(R.mixCost({ input: 0, output: 0 }, { input: 1, output: 1 }), 0);
    const u = R.usageByModel([{ model: 'Models/A', input: 100, cachedInput: 500, output: 1 }, { model: 'models/a', input: 0, output: 5 }, { model: 'a', input: 0, output: 0 }, { model: '', input: 9 }, null, { model: 'B', input: 1 }]);
    assert.deepEqual([...u.keys()], ['a', 'b'], '대소문자 · models/ 를 무시하고 묶는다, 토큰이 없는 줄은 뺀다');
    assert.deepEqual(u.get('a'), { input: 100, cachedInput: 100, output: 6, requests: 2 });
    assert.deepEqual(u.get('b'), { input: 1, cachedInput: 0, output: 0, requests: 1 });
    const two = R.usageByModel([{ model: 'x', input: 10, cachedInput: 4, output: 2 }, { model: 'X', input: 20, output: 3 }]);
    assert.deepEqual(two.get('x'), { input: 30, cachedInput: 4, output: 5, requests: 2 });
    assert.equal(R.usageByModel('x').size, 0);
    assert.deepEqual(R.assumedMix(), { input: 1e6, cachedInput: 0, output: 250000, requests: 0, assumed: true });
    assert.deepEqual(R.assumedMix({ cacheShare: 0.3, outPerIn: 2 }), { input: 1e6, cachedInput: 300000, output: 500000, requests: 0, assumed: true });
    assert.equal(R.assumedMix({ cacheShare: 2 }).cachedInput, 1e6);
    assert.equal(R.assumedMix({ cacheShare: -1 }).cachedInput, 0);
    assert.equal(R.assumedMix({ outPerIn: 0 }).output, 250000);
    assert.equal(R.assumedMix({ outPerIn: 3 }).output, 333333);
});

test('compareRow: 싼 쪽 · 차이 % · 0.5% 안은 같음 · 값이 없으면 판정 없음', () => {
    const mix = { input: 1e6, output: 0 };
    const c = (relay, official) => R.compareRow({ relayUsdRates: relay === null ? null : { input: relay, output: 0 }, officialUsdRates: official === null ? null : { input: official, output: 0 }, mix });
    assert.deepEqual(c(1, 2), { relayUsd: 1, officialUsd: 2, cheaper: 'relay', diff: 50 });
    assert.deepEqual(c(3, 2), { relayUsd: 3, officialUsd: 2, cheaper: 'official', diff: 33 });
    assert.deepEqual(c(2, 2), { relayUsd: 2, officialUsd: 2, cheaper: 'same', diff: 0 });
    assert.deepEqual(c(0, 0), { relayUsd: 0, officialUsd: 0, cheaper: 'same', diff: 0 });
    assert.equal(c(0.995, 1).cheaper, 'relay', '딱 0.5% 차이는 다름');
    assert.equal(c(0.996, 1).cheaper, 'same');
    assert.equal(c(1, 0.996).cheaper, 'same');
    assert.equal(c(0, 1).diff, 100);
    assert.deepEqual(c(null, 1), { relayUsd: null, officialUsd: 1, cheaper: null, diff: null });
    assert.deepEqual(c(1, null).cheaper, null);
    assert.equal(c(-1, 1).cheaper, null, '음수 값은 판정 안 함');
    assert.equal(c(1, -1).cheaper, null);
    assert.equal(R.compareRow({ relayUsdRates: { input: NaN, output: 0 }, officialUsdRates: { input: 1, output: 0 }, mix }).cheaper, null);
});

console.log(`relay-prices-edges: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
