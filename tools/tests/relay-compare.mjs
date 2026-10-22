// 7.7.2 중계 · 공식 가격 비교 — new-api 공개 가격표 해석 · 쿼터 → 실제 화폐 · 그룹 배율 · 건당 · 캐시 · 공식 이름 대소문자 · 장부의 중계 원화 환산.
//   지어낸 중계(relay.example)와 지어낸 가격만. node tools/tests/relay-compare.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const R = await import(pathToFileURL(path.join(root, 'src/relay-prices.js')).href);
const L = await import(pathToFileURL(path.join(root, 'src/usage-ledger-core.js')).href);
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log('  PASS  ' + name); };
const pricing = {
    success: true, group_ratio: { default: 1, vip: 1.5 }, usable_group: { default: '기본 줄', vip: '빠른 줄' },
    vendors: [{ id: 5, name: 'Google' }, { id: 10, name: 'MiniMax' }, { id: 1, name: 'Anthropic' }],
    data: [
        { model_name: 'gemini-4-argon', vendor_id: 5, quota_type: 0, model_ratio: 1.75, model_price: 0, completion_ratio: 4, cache_ratio: 1, enable_groups: ['default', 'vip'] },
        { model_name: 'minimax-m3', vendor_id: 10, quota_type: 0, model_ratio: 0.5, completion_ratio: 6, cache_ratio: 0.1, enable_groups: ['default'] },
        { model_name: 'claude-opus-5-5', vendor_id: 1, quota_type: 0, model_ratio: 12.5, completion_ratio: 6, cache_ratio: 0.2, enable_groups: ['vip'] },
        { model_name: 'image-maker', quota_type: 1, model_price: 0.04, enable_groups: ['default'] },
        { model_name: '', model_ratio: 1 }, { model_name: 'broken', model_ratio: -3 }, { model_name: 'x'.repeat(500), model_ratio: 'nope' },
    ],
};
const status = { success: true, data: { price: 1, quota_per_unit: 500000, quota_display_type: 'USD', usd_exchange_rate: 7.3, secret_thing: 'ignored' } };

await t('가격표 해석: 토큰 · 건당 모델, 판매사 이름, 그룹 배율 · 설명, 충전 단가 · 쿼터 단위 — 이름 없는 줄 · 음수 · 숫자 아닌 배율은 버림', () => {
    const p = R.parseRelayPricing(pricing, status);
    assert.deepEqual(p.models.map(m => [m.name, m.kind, m.vendor]), [['gemini-4-argon', 'token', 'Google'], ['minimax-m3', 'token', 'MiniMax'], ['claude-opus-5-5', 'token', 'Anthropic'], ['image-maker', 'request', '']]);
    assert.deepEqual(p.groups, [{ id: 'default', ratio: 1, note: '기본 줄' }, { id: 'vip', ratio: 1.5, note: '빠른 줄' }]);
    assert.deepEqual(p.recharge, { price: 1, quotaPerUnit: 500000, display: 'USD', usdRate: 7.3 });
    assert.throws(() => R.parseRelayPricing({ nope: 1 }, status), /data 배열/);
    assert.deepEqual(R.parseRelayPricing({ data: [] }, null).groups, [{ id: 'default', ratio: 1, note: '' }], '그룹 정보가 없으면 default × 1');
});
await t('쿼터 단가: 배율 1 = 100만 토큰당 쿼터 2달러 · 출력 = 입력 × completion · 캐시 = 입력 × cache_ratio · 그룹 배율 곱하기 · 건당은 null', () => {
    const p = R.parseRelayPricing(pricing, status), [argon, m3, , image] = p.models;
    assert.deepEqual(R.relayQuotaRates(argon), { input: 3.5, output: 14, cacheRead: 3.5, cacheWrite: null });
    assert.deepEqual(R.relayQuotaRates(m3), { input: 1, output: 6, cacheRead: 0.1, cacheWrite: null });
    assert.deepEqual(R.relayQuotaRates(argon, { groupRatio: 1.5 }), { input: 5.25, output: 21, cacheRead: 5.25, cacheWrite: null });
    assert.equal(R.relayQuotaRates(image), null);
});
await t('실제 화폐: 쿼터 달러 × 충전 단가(¥) ÷ 환율(¥/$) → 달러 · 원, 장부용 「쿼터 1달러 = 몇 원」', () => {
    const money = { quotaPrice: 1, currencyPerUsd: 7, krwPerUsd: 1400 };
    assert.deepEqual(R.relayMoney(3.5, money), { usd: 0.5, krw: 700 });
    assert.equal(R.krwPerQuotaUsd(money), 200);
    assert.deepEqual(R.relayUsdRates({ input: 3.5, output: 14, cacheRead: 3.5, cacheWrite: null }, money), { input: 0.5, output: 2, cacheRead: 0.5, cacheWrite: null });
    assert.equal(R.krwPerQuotaUsd({ quotaPrice: 7, currencyPerUsd: 7, krwPerUsd: 1400 }), 1400, '쿼터 1달러를 7위안에 파는 중계면 실제 1달러');
});
await t('비교: 캐시를 많이 쓰면 캐시 할인 없는 중계보다 공식이 쌀 수 있다 · 기록이 없으면 가정 묶음 · 비슷하면 same', () => {
    const relay = { input: 0.5, output: 2, cacheRead: 0.5 }, official = { input: 2, output: 10, cacheRead: 0.1 };
    const noCache = R.compareRow({ relayUsdRates: relay, officialUsdRates: official, mix: R.assumedMix({ cacheShare: 0, outPerIn: 4 }) });
    assert.equal(noCache.cheaper, 'relay'); assert.ok(noCache.diff > 70);
    const heavy = R.compareRow({ relayUsdRates: relay, officialUsdRates: official, mix: { input: 1e6, cachedInput: 950000, output: 10000 } });
    assert.equal(heavy.cheaper, 'official', '캐시 95% · 출력 적음 → 공식이 더 쌈');
    assert.equal(R.compareRow({ relayUsdRates: relay, officialUsdRates: null, mix: R.assumedMix() }).cheaper, null);
    assert.equal(R.compareRow({ relayUsdRates: relay, officialUsdRates: { ...relay }, mix: R.assumedMix() }).cheaper, 'same');
});
await t('장부에서 모델별 사용량: 이름 대소문자 · models/ 무시, 캐시는 입력을 넘지 않음, 토큰 없는 기록은 뺌', () => {
    const m = R.usageByModel([{ model: 'Gemini-4-Argon', input: 1000, cachedInput: 1500, output: 100 }, { model: 'models/gemini-4-argon', input: 500, cachedInput: 100, output: 50 }, { model: 'x', input: 0, output: 0 }]);
    assert.deepEqual(m.get('gemini-4-argon'), { input: 1500, cachedInput: 1100, output: 150, requests: 2 }); assert.equal(m.has('x'), false);
});
await t('공식 제공처 후보: 판매사 이름 먼저, 없으면 잘 알려진 앞머리만 (모르는 모델은 비교하지 않음)', () => {
    assert.deepEqual(R.officialProvidersFor({ name: 'gemini-4-argon', vendor: 'Google' }), ['gemini', 'vertex']);
    assert.deepEqual(R.officialProvidersFor({ name: 'minimax-m3', vendor: '' }), ['minimax']);
    assert.deepEqual(R.officialProvidersFor({ name: 'claude-opus-5-5', vendor: '' }), ['anthropic']);
    assert.deepEqual(R.officialProvidersFor({ name: 'someones-model', vendor: '' }), []);
});
await t('장부: 중계 원화 환산은 그 중계의 「쿼터 1달러 = 원」이 있으면 그것 (예전엔 늘 쿼터 달러 × 원/달러 환율 가정)', () => {
    const origin = 'https://relay.example', entry = L.normalizeEntry({ ext: '블루레몬에이드', feature: '번역', model: 'gemini-4-argon', origin, input: 1e6, output: 0, at: Date.now() });
    const base = { relays: [origin], relayPrices: { 'gemini-4-argon': { input: 3.5, output: 14, origin } }, krw: { rate: 1400 } };
    assert.equal(L.costOf(entry, base).krw, 4900, '가정: 쿼터 $3.5 × 1400원');
    const fixed = L.costOf(entry, { ...base, relayKrwByOrigin: { [origin]: { rate: 200, source: '쿼터 $1 = ¥1 · $1 = ¥7' } } });
    assert.equal(fixed.krw, 700); assert.match(fixed.krwNote, /중계 환산 쿼터 \$1 = ¥1/);
});
await t('공식 단가: 이름 대소문자만 다른 공식 이름 하나면 그 이름으로 (MiniMax-M3 ↔ minimax-m3) — 화면 연결', async () => {
    const src = fs.readFileSync(path.join(root, 'src/usage-ledger.js'), 'utf8');
    assert.match(src, /export async function officialPrice\(provider, model, at = Date\.now\(\)\)/);
    assert.match(src, /key\.toLowerCase\(\) === id\.toLowerCase\(\)\);\n\s+return keys\.length === 1/);
    assert.match(src, /relayKrwByOrigin: s\.relayRates/);
    const view = fs.readFileSync(path.join(root, 'src/addons/perf/relay-compare-view.js'), 'utf8');
    assert.match(view, /fetch\('\/api\/search\/visit'/, 'CORS 가 없으면 실리태번 서버로 대신 읽음');
    assert.doesNotMatch(view, /Authorization|api_key|apiKey/i, '키를 쓰지 않음');
    assert.match(fs.readFileSync(path.join(root, 'src/addons/perf/ledger-view.js'), 'utf8'), /import\('\.\/relay-compare-view\.js'\)/, '열 때만 불러옴');
});
console.log(`relay-compare: ${n} passed`);
