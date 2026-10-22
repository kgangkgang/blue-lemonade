// 7.7.2 요청 비용 셈의 갈래마다 (pricing.js quoteRequest · connectionFor · mergeTokenUsage · settleTokens, pricing-resolve.js providerQuote).
//   가격표는 지어낸 표(priceData)를 넘겨 실제 공개 단가가 바뀌어도 이 시험은 그대로 — 단가 고르기 · 등급 · 긴 문맥 · 캐시 · 시간대 · 지역 규칙만 본다.
//   중계 주소는 지어낸 것. 네트워크 없음.   node tools/tests/pricing-quote-edges.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const P = await import(pathToFileURL(path.join(root, 'src/addons/perf/pricing.js')).href);
const R = await import(pathToFileURL(path.join(root, 'src/addons/perf/pricing-resolve.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-12, `${msg || ''} ${a} ≠ ${b}`);
const RELAY = 'https://relay.example.test';
const BASE = { version: 1, provider: 'x', origin: '', label: 'L', model: 'm', currency: 'USD', kind: 'unknown', cost: null, checked: 'c', priceStatus: 'bundled', priceRevision: '', url: '', note: '' };
const quote = (provider, models, { connection, ...over } = {}) => R.providerQuote({ result: { ...BASE, provider }, connection: { provider, origin: '', ...connection }, model: 'm1', usage: { prompt: 1e6, completion: 1e6 }, at: Date.UTC(2026, 9, 20, 12), priceData: { models }, ...over });

await test('safeOrigin · manualPriceForConnection: 자동 가격은 같은 중계에서만', () => {
    assert.equal(P.safeOrigin('https://u:p@relay.example.test/v1?key=1'), RELAY);
    assert.equal(P.safeOrigin('ws://relay.example.test'), '');
    assert.equal(P.safeOrigin('nope'), '');
    assert.equal(P.manualPriceForConnection(null, { origin: RELAY }), null);
    const manual = { input: 1, output: 2 };
    const got = P.manualPriceForConnection(manual, { origin: RELAY });
    assert.deepEqual(got, manual); assert.notEqual(got, manual, '사본');
    assert.equal(P.manualPriceForConnection({ ...manual, auto: true }, { origin: RELAY }), null, '출처 없는 자동 가격');
    assert.equal(P.manualPriceForConnection({ ...manual, auto: true, origin: 'https://b.example.test/x' }, { origin: RELAY }), null);
    assert.deepEqual(P.manualPriceForConnection({ ...manual, auto: true, origin: RELAY + '/v1/models' }, { origin: RELAY }).origin, RELAY + '/v1/models');
    assert.equal(P.manualPriceForConnection({ ...manual, auto: true, origin: RELAY }, null), null);
});

await test('connectionFor: 실리태번 경로 · 직접 주소 · 프록시 · 지역 · 로컬', () => {
    const LOCAL = 'http://127.0.0.1:8000';
    const chat = (body, local = LOCAL) => P.connectionFor('/api/backends/chat-completions/generate', body, local);
    assert.deepEqual(chat({ chat_completion_source: 'claude' }), { provider: 'anthropic', origin: 'https://api.anthropic.com', label: 'Anthropic 공식 API' });
    assert.equal(chat({ chat_completion_source: 'claude', reverse_proxy: RELAY + '/v1' }).origin, RELAY, '프록시를 쓰면 그 서버');
    assert.equal(chat({ chat_completion_source: 'claude', reverse_proxy: RELAY + '/v1' }).provider, 'other');
    assert.equal(chat({ chat_completion_source: 'groq', reverse_proxy: RELAY }).origin, 'https://api.groq.com', '프록시가 없는 출처는 프록시 칸을 무시');
    assert.equal(chat({ chat_completion_source: 'custom', custom_url: RELAY + '/v1' }).origin, RELAY);
    assert.equal(chat({ chat_completion_source: 'custom', custom_url: RELAY }).label, 'relay.example.test');
    assert.equal(chat({ chat_completion_source: 'azure_openai', azure_base_url: 'https://my-res.openai.azure.com/x' }).provider, 'azure');
    assert.equal(chat({ chat_completion_source: 'siliconflow', siliconflow_endpoint: 'cn' }).provider, 'siliconflow_cn');
    assert.equal(chat({ chat_completion_source: 'minimax', minimax_endpoint: 'cn' }).provider, 'minimax_cn');
    assert.equal(chat({ chat_completion_source: 'pollinations', pollinations_endpoint: 'anonymous' }).billing, 'free');
    const v = chat({ chat_completion_source: 'vertexai', vertexai_region: 'europe-west4' });
    assert.deepEqual([v.provider, v.origin, v.region], ['vertex', 'https://europe-west4-aiplatform.googleapis.com', 'europe-west4']);
    assert.deepEqual([chat({ chat_completion_source: 'vertexai' }).region, chat({ chat_completion_source: 'vertexai' }).origin], ['us-central1', 'https://us-central1-aiplatform.googleapis.com']);
    assert.equal(chat({ chat_completion_source: 'vertexai', vertexai_region: 'global' }).origin, 'https://aiplatform.googleapis.com');
    assert.equal(chat({ chat_completion_source: 'vertexai', vertexai_express_project_id: 'p' }).origin, 'https://aiplatform.googleapis.com');
    assert.equal(P.connectionFor('https://aiplatform.googleapis.com/v1/projects/p/locations/asia-northeast3/publishers/x', {}, LOCAL).region, 'asia-northeast3', '직접 주소는 경로의 지역');
    assert.equal(P.connectionFor('https://aiplatform.googleapis.com/v1/x', {}, LOCAL).region, 'global');
    assert.equal(P.connectionFor('https://us-east1-aiplatform.googleapis.com/v1/x', {}, LOCAL).region, 'us-east1');
    assert.equal(chat({ chat_completion_source: 'zai', zai_endpoint: 'coding' }).billing, 'plan');
    assert.match(chat({ chat_completion_source: 'zai', zai_endpoint: 'coding' }).label, /Coding Plan$/);
    assert.equal(chat({ chat_completion_source: 'zai' }).billing, undefined);
    assert.equal(chat({ chat_completion_source: 'zai', zai_endpoint: 'coding', reverse_proxy: 'https://api.z.ai/x' }).billing, undefined, '프록시면 Coding Plan 아님');
    assert.equal(P.connectionFor('https://api.z.ai/api/coding/paas/v4/chat', {}, LOCAL).billing, 'plan');
    assert.equal(chat({ chat_completion_source: 'nope' }).label, 'nope');
    assert.equal(chat({}).label, '연결처 미확인');
    const text = body => P.connectionFor('/api/backends/text-completions/generate', body, LOCAL);
    assert.deepEqual(text({ api_type: 'koboldcpp', api_server: 'http://127.0.0.1:5001' }), { provider: 'local', origin: 'http://127.0.0.1:5001', label: '직접 운영 서버', billing: 'local' });
    assert.equal(text({ api_type: 'koboldcpp', api_server: 'https://remote.example.test' }).provider, 'other', '먼 주소를 로컬이라 하지 않는다');
    assert.equal(text({ api_type: 'ollama', api_url: 'http://localhost:11434' }).provider, 'local');
    assert.equal(P.connectionFor('/api/novelai/generate', {}, LOCAL).provider, 'novelai');
    assert.equal(P.connectionFor('/api/horde/generate-text', {}, LOCAL).billing, 'free');
    assert.equal(P.connectionFor('/api/backends/kobold/generate', { api_server: 'http://[::1]:5001' }, LOCAL).provider, 'local');
    assert.equal(P.connectionFor('/other', { api_server: RELAY }, LOCAL).origin, RELAY);
    assert.equal(P.connectionFor({ url: 'https://api.openai.com/v1/chat' }, {}, LOCAL).provider, 'openai', 'Request 처럼 url 칸');
    assert.equal(P.connectionFor({ href: 'https://api.openai.com/v1/chat' }, {}, LOCAL).provider, 'openai');
    assert.equal(P.connectionFor(LOCAL + '/api/backends/chat-completions/generate', { chat_completion_source: 'openai' }, LOCAL).provider, 'openai', '같은 서버 주소는 직접 연결이 아니다');
});

await test('mergeTokenUsage: Anthropic(입력이 캐시 제외) · OpenAI 계열 · 비용 보고', () => {
    const a = P.mergeTokenUsage({ completion: 3 }, { input_tokens: 10, cache_read_input_tokens: 20, cache_creation_input_tokens: 30, cache_creation: { ephemeral_5m_input_tokens: 25, ephemeral_1h_input_tokens: 5 } }, true);
    assert.deepEqual(a, { completion: 3, uncached: 10, cached: 20, cacheWrite: 30, cacheWrite5m: 25, cacheWrite1h: 5, cacheWriteSplit: true, prompt: 60 });
    const a2 = P.mergeTokenUsage(a, { output_tokens: 7 }, true);
    assert.deepEqual([a2.prompt, a2.completion], [60, 7], '스트림 뒤 조각이 앞 값을 지우지 않는다');
    const o = P.mergeTokenUsage(null, { prompt_tokens: 100, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 30, cache_write_tokens: 5 }, completion_tokens_details: { reasoning_tokens: 12 }, cost: 0.002 });
    assert.deepEqual(o, { prompt: 100, cached: 30, cacheWrite: 5, completion: 40, reasoning: 12, reportedCost: 0.002 });
    assert.equal(P.mergeTokenUsage({}, { input_tokens: 9, input_tokens_details: { cached_tokens: 2 }, output_tokens: 1, output_tokens_details: { reasoning_tokens: 1 } }).cached, 2, 'Responses API 이름');
    assert.equal(P.mergeTokenUsage({}, { prompt_cache_hit_tokens: 8 }).cached, 8, 'DeepSeek');
    assert.equal(P.mergeTokenUsage({}, { cached_tokens: 4 }).cached, 4);
    assert.equal(P.mergeTokenUsage({}, { cache_read_input_tokens: 6, cache_creation_input_tokens: 2 }).cacheWrite, 2);
    assert.equal(P.mergeTokenUsage({}, { cache_creation: {} }).cacheWriteSplit, true);
    assert.equal(P.mergeTokenUsage({}, { cost: { total_cost: '0.5' } }).reportedCost, 0.5);
    for (const bad of [-1, 'x', null, undefined, { total_cost: null }]) assert.equal('reportedCost' in P.mergeTokenUsage({}, { cost: bad }), false, JSON.stringify(bad));
    assert.equal(P.mergeTokenUsage({}, { cost: 0 }).reportedCost, 0);
    assert.equal(P.mergeTokenUsage({ prompt: 5 }, { prompt_tokens: -3 }).prompt, 0, '음수는 0');
    assert.equal(P.mergeTokenUsage({ prompt: 5 }, {}).prompt, 5);
});

await test('settleTokens: 0 · 빈 칸만 글로 센다', async () => {
    const count = async t => t.length;
    assert.deepEqual(await P.settleTokens({ usage: { prompt: 10, completion: 2 }, promptText: 'aaaa', replyText: 'bb', count }), { prompt: 10, completion: 2, estimated: false });
    assert.deepEqual(await P.settleTokens({ usage: { prompt: 0, completion: 2 }, promptText: 'aaaa', replyText: 'bb', count }), { prompt: 4, completion: 2, estimated: true });
    assert.deepEqual(await P.settleTokens({ usage: { prompt: 3 }, promptText: 'aaaa', replyText: 'bbb', count }), { prompt: 3, completion: 3, estimated: true });
    assert.deepEqual(await P.settleTokens({ usage: null, promptText: 'aa', replyText: 'b', canPrompt: false, count }), { prompt: 0, completion: 1, estimated: true });
    assert.deepEqual(await P.settleTokens({ usage: null, promptText: '', replyText: '', count }), { prompt: 0, completion: 0, estimated: false });
    assert.deepEqual(await P.settleTokens({ usage: null, replyText: 'abc', canCompletion: false, count }), { prompt: 0, completion: 0, estimated: false });
});

await test('quoteRequest: 모르는 연결 · 사용자 가격 · 지원 안 하는 요청', () => {
    const q = P.quoteRequest({ connection: { provider: 'other', origin: RELAY, label: 'R' }, model: 'm', usage: { prompt: 2e6, completion: 1e6 }, priceData: null, at: 1 });
    assert.deepEqual([q.kind, q.cost, q.provider, q.origin, q.label, q.checked, q.priceStatus], ['unknown', null, 'other', RELAY, 'R', P.PRICE_CHECKED, 'bundled']);
    const m = P.quoteRequest({ connection: { provider: 'other' }, model: 'm', usage: { prompt: 2e6, completion: 1e6 }, manualPrice: { input: 1, output: 3 }, manualUnit: '₩', priceData: null });
    assert.deepEqual([m.kind, m.cost, m.currency, m.rates], ['manual', 5, '₩', { input: 1, output: 3 }]);
    assert.equal(P.quoteRequest({ connection: { provider: 'other' }, usage: { prompt: 1e6 }, manualPrice: { input: 2, output: 3, auto: true }, priceData: null }).kind, 'relay');
    assert.equal(P.quoteRequest({ connection: { provider: 'other' }, usage: { prompt: 1e6 }, manualPrice: { input: 2, output: 3 }, priceData: null }).currency, 'USD');
    assert.match(P.quoteRequest({ connection: { provider: 'openai' }, unsupported: true, priceData: null }).note, /토큰 단가만으로/);
    assert.equal(P.quoteRequest({ connection: null, priceData: null }).provider, 'other');
});

await test('quoteRequest: OpenAI 표 — 등급 · 날짜 붙은 모델 · 긴 문맥 · 캐시', () => {
    // [input, cacheRead, cacheWrite, output, long input, long cacheRead, long cacheWrite, long output]
    const models = { 'gpt-x': { standard: [2, 0.5, null, 8, 4, 1, null, 16], flex: [1, 0.25, null, 4, null, null, null, null], fast: [3, null, 1, 12, 6, null, null, 24] }, 'gpt-short': { standard: [1, 0.1, null, 2, null, null, null, null] } };
    const q = over => P.quoteRequest({ connection: { provider: 'openai' }, model: 'gpt-x', usage: { prompt: 1e5, completion: 1e5, cached: 0 }, priceData: { models, checkedAt: 'C', status: 'live', revision: 'r' }, ...over });
    const s = q();
    assert.deepEqual([s.kind, s.cost, s.tier, s.resolvedModel, s.checked, s.priceStatus, s.priceRevision], ['official', 1, 'standard', 'gpt-x', 'C', 'live', 'r']);
    assert.equal(q({ model: 'gpt-x-2026-10-01' }).resolvedModel, 'gpt-x');
    assert.equal(q({ model: 'gpt-x-20261001' }).resolvedModel, 'gpt-x');
    assert.equal(q({ model: 'gpt-x-mini' }).kind, 'unknown', '이름 앞부분만 같은 모델은 빌리지 않는다');
    assert.equal(q({ serviceTier: 'flex' }).cost, 0.5);
    assert.equal(q({ serviceTier: 'priority' }).cost, 1.5, 'priority = fast 표');
    assert.equal(q({ serviceTier: 'auto' }).tier, 'standard');
    assert.equal(q({ serviceTier: 'default' }).cost, 1);
    assert.equal(q({ serviceTier: 'batch' }).kind, 'unknown');
    assert.equal(q({ usage: { prompt: 272000, completion: 0 } }).tier, 'standard');
    const long = q({ usage: { prompt: 272001, completion: 1e6 } });
    assert.deepEqual([long.tier, long.rates.input], ['standard · 입력 27.2만 초과', 4]);
    close(long.cost, (272001 * 4 + 1e6 * 16) / 1e6);
    assert.equal(q({ serviceTier: 'flex', usage: { prompt: 300000 } }).kind, 'unknown', '긴 문맥 값이 없는 등급');
    assert.equal(P.quoteRequest({ connection: { provider: 'openai' }, model: 'gpt-short', usage: { prompt: 400000, completion: 0 }, priceData: { models } }).cost, 0.4, '긴 문맥 표가 없는 모델은 기본 단가');
    close(q({ usage: { prompt: 2e5, cached: 1e5, completion: 0 } }).cost, 1e5 * 2 / 1e6 + 1e5 * 0.5 / 1e6);
    assert.equal(q({ serviceTier: 'priority', usage: { prompt: 1e5, cached: 1 } }).kind, 'official');
    assert.equal(q({ serviceTier: 'priority', usage: { prompt: 1e5, cached: 1 } }).cost, null, '캐시 읽기 단가가 없으면 계산하지 않음');
    assert.equal(q({ usage: { prompt: 10, cached: 6, cacheWrite: 5 } }).cost, null, '캐시가 입력보다 많음');
    assert.equal(q({ usage: { prompt: 10, cached: 10 } }).cost, 10 * 0.5 / 1e6, '캐시가 입력과 같으면 계산');
    assert.equal(q({ usage: { prompt: 10, cacheWrite: 2 } }).cost, null, '캐시 저장 단가 없음');
    close(q({ serviceTier: 'fast', usage: { prompt: 10, cacheWrite: 2, completion: 0 } }).cost, (8 * 3 + 2 * 1) / 1e6);
    assert.match(q({ estimated: true }).note, /추정했어요$/);
    assert.equal(q({ hasMedia: true }).cost, null);
    assert.equal(q({ priceData: { models: {} } }).kind, 'unknown');
});

await test('quoteRequest: Anthropic 표 — Fast · 지역 · 긴 문맥 · 캐시 저장 시간', () => {
    // [input, output, cacheRead, cacheWrite5m, cacheWrite1h]
    const models = { 'claude-opus-5-5': [5, 25, 0.5, 6.25, 10], 'claude-haiku-5-5': [1, 5, 0.1, 1.25, 2], 'claude-opus-4-6': [15, 75, 1.5, 18.75, 30], 'claude-sonnet-4-5': [3, 15, 0.3, 3.75, 6], 'claude-other': [1, 1, null, 1, 1] };
    const q = over => P.quoteRequest({ connection: { provider: 'anthropic' }, model: 'claude-opus-5-5', usage: { prompt: 1e6, completion: 1e6 }, priceData: { models }, ...over });
    assert.deepEqual([q().cost, q().tier], [30, 'standard']);
    assert.deepEqual([q({ speed: 'fast' }).cost, q({ speed: 'fast' }).tier], [60, 'Fast']);
    assert.equal(q({ speed: 'fast', model: 'claude-opus-4-6' }).cost, 90, 'Fast 를 따로 올리지 않는 모델');
    assert.equal(q({ speed: 'fast', model: 'claude-haiku-5-5' }).cost, null);
    close(q({ inferenceGeo: 'us' }).cost, 33);
    assert.equal(q({ inferenceGeo: 'us' }).tier, 'standard · 미국 추론 +10%');
    assert.equal(q({ inferenceGeo: 'global' }).cost, 30);
    assert.equal(q({ inferenceGeo: 'eu' }).cost, null);
    assert.equal(q({ serviceTier: 'auto' }).cost, 30);
    assert.equal(q({ serviceTier: 'priority' }).cost, null);
    assert.equal(q({ model: 'claude-haiku-5-5', usage: { prompt: 100000, completion: 0 } }).tier, 'standard');
    const hk = q({ model: 'claude-haiku-5-5', usage: { prompt: 100001, completion: 1e6 } });
    assert.equal(hk.tier, '입력 10만 초과');
    close(hk.cost, (100001 * 0.5 + 1e6 * 2.5) / 1e6);
    assert.equal(q({ model: 'claude-sonnet-4-5', usage: { prompt: 200001 } }).cost, null, '구형 모델의 긴 문맥');
    assert.equal(q({ model: 'claude-sonnet-4-5', usage: { prompt: 200000, completion: 0 } }).cost, 0.6);
    assert.equal(q({ usage: { prompt: 1000, cacheWrite: 300 } }).cost, null, '저장 시간별 수가 없으면 확정 안 함');
    assert.equal(q({ usage: { prompt: 1000, cacheWrite: 300, cacheWriteSplit: true, cacheWrite5m: 100, cacheWrite1h: 100 } }).cost, null, '합이 안 맞음');
    close(q({ usage: { prompt: 1000, cached: 200, cacheWrite: 300, cacheWriteSplit: true, cacheWrite5m: 200, cacheWrite1h: 100, completion: 0 } }).cost, (500 * 5 + 200 * 0.5 + 200 * 6.25 + 100 * 10) / 1e6);
    // (Anthropic 표는 다섯 값이 모두 숫자여야 들어온다 — pricing-live modelRow — 그래서 캐시 읽기 단가 없음 갈래는 표로 닿지 않는다)
    assert.equal(q({ model: 'claude-opus-5-5-20261001' }).resolvedModel, 'claude-opus-5-5');
});

await test('providerQuote: 플랜 · 로컬 · 무료 · 사용자 가격 · 보고 비용', () => {
    const plan = quote('novelai', {});
    assert.deepEqual([plan.kind, plan.cost, plan.billing, plan.currency], ['plan', null, 'plan', 'USD']);
    assert.equal(plan.note, R.providerQuote({ result: BASE, connection: { provider: 'novelai' }, priceData: { models: {} } }).note);
    const planManual = quote('novelai', {}, { manualPrice: { input: 1, output: 2 }, manualUnit: '₩' });
    assert.deepEqual([planManual.kind, planManual.cost, planManual.currency, planManual.checked], ['manual', 3, '₩', '']);
    assert.match(planManual.note, /사용자가 지정한 토큰 환산 추정액이에요\.$/);
    assert.equal(quote('novelai', {}, { manualPrice: { input: 1, output: 2, auto: true } }).kind, 'plan');
    assert.equal(quote('local', {}).kind, 'local');
    assert.equal(quote('azure', {}).kind, 'deployment');
    assert.equal(quote('openai', {}, { connection: { billing: 'plan' } }).kind, 'plan', '연결이 정한 과금 방식이 먼저');
    const free = quote('horde', {});
    assert.deepEqual([free.kind, free.cost, free.rates], ['free', 0, { input: 0, output: 0 }]);
    assert.equal(quote('moonshot_cn', { m1: { rates: { input: 1, output: 1 } } }).currency, 'CNY');
    const none = quote('groq', {});
    assert.deepEqual([none.kind, none.cost], ['unknown', null]);
    assert.match(none.note, /^공식 가격표에서 이 모델의 단가를 확인하지 못했어요\./);
    const manualMissing = quote('groq', {}, { manualPrice: { input: 2, output: 2 }, manualUnit: '$' });
    assert.deepEqual([manualMissing.kind, manualMissing.cost, manualMissing.currency], ['manual', 4, 'USD']);
    assert.equal(quote('groq', {}, { manualPrice: { input: 2, output: 2, auto: true } }).kind, 'unknown');
    assert.equal(quote('groq', {}, { manualPrice: { input: 2, output: 2 }, usage: { prompt: -5, completion: 'x' } }).cost, 0, '음수 · 글 사용량은 0');
    const rep = quote('openrouter', {}, { usage: { prompt: 1, completion: 1, reportedCost: 0.75 } });
    assert.deepEqual([rep.kind, rep.cost], ['reported', 0.75]);
    assert.match(rep.note, /^API 응답이 알려 준 요청 비용이에요\. /);
    assert.equal(quote('openrouter', {}, { usage: { reportedCost: -1 } }).kind, 'unknown');
    assert.equal(quote('groq', {}, { usage: { reportedCost: 0.75 } }).cost, null, '보고 비용을 믿지 않는 제공처');
    const repPriced = quote('openrouter', { m1: { rates: { input: 1, output: 1 } } }, { usage: { prompt: 1e6, completion: 0 } });
    assert.deepEqual([repPriced.kind, repPriced.cost, repPriced.minimum], ['official', null, true]);
    assert.match(repPriced.note, /응답 비용이 없으면 총액을 확정하지 않아요\.$/);
    assert.match(quote('groq', {}, { estimated: true }).note, /추정했어요\./);
});

await test('providerQuote: 모델 찾기 · 긴 문맥 · 등급 · 지역 · 기간 · 미디어', () => {
    const row = { rates: { input: 1, output: 4, cacheRead: 0.1, cacheWrite: 1.25 } };
    assert.equal(quote('groq', { m1: row }).cost, 5);
    assert.equal(quote('groq', { m1: row }, { model: 'models/m1' }).resolvedModel, 'm1');
    assert.equal(quote('groq', { real: { ...row, aliases: ['m1'] } }).resolvedModel, 'real', '가격표의 별칭');
    assert.equal(quote('groq', { real: row }, { model: 'm1-x' }).cost, null, '앞부분이 같다고 빌리지 않음');
    const req = quote('groq', { asked: row }, { model: 'answered', requestedModel: 'asked' });
    assert.equal(req.resolvedModel, 'asked');
    assert.match(req.note, /요청한 모델 ID 기준이에요\.$/);
    assert.doesNotMatch(quote('groq', { m1: row }, { requestedModel: 'm1' }).note, /요청한 모델 ID/);
    const longRow = { ...row, longAbove: 200000, longRates: { input: 2, output: 8 } };
    assert.equal(quote('groq', { m1: longRow }, { usage: { prompt: 200000, completion: 0 } }).cost, 0.2);
    const lq = quote('groq', { m1: longRow }, { usage: { prompt: 200001, completion: 0 } });
    assert.deepEqual([lq.cost, lq.tier], [200001 * 2 / 1e6, 'standard · 입력 200,001 이상']);
    assert.equal(quote('groq', { m1: { ...row, longAbove: 10 } }, { usage: { prompt: 11 } }).cost, null, '긴 문맥 단가가 없으면 모름');
    assert.equal(quote('groq', { m1: { rates: { input: 1 } } }).cost, null);
    // 등급
    for (const t of ['', 'auto', 'default', 'standard', 'on_demand']) assert.equal(quote('groq', { m1: row }, { serviceTier: t }).tier, 'standard', t);
    assert.equal(quote('groq', { m1: { ...row, tiers: { flex: { input: 0.5, output: 2 } } } }, { serviceTier: 'flex' }).cost, 2.5);
    assert.equal(quote('groq', { m1: { ...row, longAbove: 5, longRates: row.rates, longTiers: { flex: { input: 9, output: 9 } } } }, { serviceTier: 'flex', usage: { prompt: 1e6, completion: 0 } }).cost, 9);
    assert.equal(quote('groq', { m1: { ...row, priorityFactor: 1.75 } }, { serviceTier: 'priority' }).cost, 5 * 1.75);
    assert.equal(quote('groq', { m1: row }, { serviceTier: 'priority' }).cost, null);
    assert.equal(quote('groq', { m1: { ...row, priorityFactor: 2 } }, { serviceTier: 'batch' }).cost, null);
    // Vertex 지역
    const vtx = (r, connection) => quote('vertex', { m1: { ...row, ...r } }, { connection });
    assert.equal(vtx({ globalOnly: true }, { region: 'global' }).cost, 5);
    assert.equal(vtx({ globalOnly: true }, { origin: 'https://aiplatform.googleapis.com' }).cost, 5);
    assert.equal(vtx({ globalOnly: true }, { region: 'us-central1' }).cost, null);
    assert.equal(vtx({ regionalFactor: 1.1 }, { region: 'us-central1' }).cost, 5 * 1.1);
    assert.equal(vtx({ regionalFactor: 1.1 }, { region: 'us-central1' }).tier, 'standard · 지역 엔드포인트');
    assert.equal(vtx({ regionalFactor: 1.1 }, { region: 'global' }).cost, 5);
    assert.equal(quote('groq', { m1: { ...row, globalOnly: true } }).cost, 5, '지역 규칙은 Vertex 만');
    // 기간 · 미디어 · 미확인 · 최소 가격
    const at = Date.UTC(2026, 9, 20, 12);
    assert.equal(quote('groq', { m1: { ...row, expires: new Date(at).toISOString() } }).cost, 5);
    assert.equal(quote('groq', { m1: { ...row, expires: new Date(at - 1).toISOString() } }).cost, null);
    assert.equal(quote('groq', { m1: row }, { hasMedia: true }).cost, null);
    assert.equal(quote('groq', { m1: { ...row, uncertain: true } }).cost, null);
    assert.equal(quote('groq', { m1: { ...row, minimum: true } }).minimum, true);
    assert.equal('minimum' in quote('groq', { m1: row }), false);
    assert.equal(quote('groq', { m1: { ...row, note: '표 메모' } }).note.endsWith(' · 표 메모'), true);
});

await test('providerQuote: 캐시 읽기 · 저장(일반 · 5분/1시간)', () => {
    const row = { rates: { input: 1, output: 4, cacheRead: 0.1, cacheWrite: 1.25 } };
    const u = usage => quote('groq', { m1: row }, { usage });
    close(u({ prompt: 1000, cached: 300, cacheWrite: 200, completion: 10 }).cost, (500 * 1 + 10 * 4 + 300 * 0.1 + 200 * 1.25) / 1e6);
    assert.equal(u({ prompt: 100, cached: 60, cacheWrite: 41 }).cost, null);
    assert.equal(u({ prompt: 100, cached: 60, cacheWrite: 40 }).cost, (60 * 0.1 + 40 * 1.25) / 1e6);
    assert.equal(quote('groq', { m1: { rates: { input: 1, output: 1 } } }, { usage: { prompt: 10, cached: 1 } }).cost, null);
    assert.equal(quote('groq', { m1: { rates: { input: 1, output: 1 } } }, { usage: { prompt: 10, cacheWrite: 1 } }).cost, null);
    const split = { rates: { input: 1, output: 4, cacheRead: 0.1 }, cacheWrite5m: 1.25, cacheWrite1h: 2 };
    const s = usage => quote('groq', { m1: split }, { usage });
    assert.equal(s({ prompt: 100, cacheWrite: 30 }).cost, null, '시간별 수 없음');
    assert.equal(s({ prompt: 100, cacheWrite: 30, cacheWriteSplit: true, cacheWrite5m: 10, cacheWrite1h: 10 }).cost, null);
    close(s({ prompt: 100, cacheWrite: 30, cacheWriteSplit: true, cacheWrite5m: 20, cacheWrite1h: 10, completion: 0 }).cost, (70 * 1 + 20 * 1.25 + 10 * 2) / 1e6);
    assert.deepEqual([s({}).rates.cacheWrite5m, s({}).rates.cacheWrite1h], [1.25, 2]);
    const no1h = { ...split, cacheWrite1h: null };
    assert.equal(quote('groq', { m1: no1h }, { usage: { prompt: 100, cacheWrite: 30, cacheWriteSplit: true, cacheWrite5m: 20, cacheWrite1h: 10 } }).cost, null);
    close(quote('groq', { m1: no1h }, { usage: { prompt: 100, cacheWrite: 30, cacheWriteSplit: true, cacheWrite5m: 30, cacheWrite1h: 0, completion: 0 } }).cost, (70 + 30 * 1.25) / 1e6);
});

await test('providerQuote: DeepSeek 시간대 (평일 UTC 01–04 · 06–10 혼잡, 그 밖 · 주말 · 2026 공휴일 절반)', () => {
    const row = { rates: { input: 2, output: 8 }, timePricing: 'deepseek' };
    const ds = (at, requestEnd) => quote('deepseek', { m1: row }, { at, requestEnd, usage: { prompt: 1e6, completion: 0 } });
    const tue = h => Date.UTC(2026, 9, 20, h);
    assert.deepEqual([ds(tue(1)).cost, ds(tue(1)).tier], [2, 'standard · 혼잡 시간']);
    assert.equal(ds(tue(3) + 3599999).cost, 2);
    assert.deepEqual([ds(tue(4)).cost, ds(tue(4)).tier], [1, 'standard · 비혼잡 시간']);
    assert.equal(ds(tue(0) + 3599999).cost, 1);
    assert.equal(ds(tue(5)).cost, 1);
    assert.equal(ds(tue(6)).cost, 2);
    assert.equal(ds(tue(9)).cost, 2);
    assert.equal(ds(tue(10)).cost, 1);
    assert.equal(ds(Date.UTC(2026, 9, 24, 2)).cost, 1, '토요일');
    assert.equal(ds(Date.UTC(2026, 9, 25, 2)).cost, 1, '일요일');
    assert.equal(ds(Date.UTC(2026, 9, 19, 2)).cost, 2, '월요일');
    assert.equal(ds(Date.UTC(2026, 9, 23, 2)).cost, 2, '금요일');
    assert.equal(ds(Date.UTC(2026, 9, 1, 2)).cost, 1, '국경절');
    assert.equal(ds(Date.UTC(2026, 9, 7, 2)).cost, 1);
    assert.equal(ds(Date.UTC(2026, 9, 8, 2)).cost, 2, '연휴 다음 날');
    assert.equal(ds(Date.UTC(2026, 0, 1, 2)).cost, 1, '1월 1일');
    assert.equal(ds(Date.UTC(2026, 1, 23, 2)).cost, 1, '춘절 끝날');
    assert.equal(ds(Date.UTC(2026, 1, 24, 2)).cost, 2);
    const y27 = ds(Date.UTC(2027, 0, 5, 2));
    assert.deepEqual([y27.cost, y27.tier], [null, 'standard · 혼잡 시간 상한'], '다른 해의 평일 혼잡 시간은 공휴일을 몰라 합산 제외');
    assert.equal(ds(Date.UTC(2027, 0, 5, 12)).cost, 1, '다른 해라도 혼잡 시간 밖이면 절반');
    assert.equal(ds(tue(3), tue(4)).cost, null, '요청 중 시간대가 바뀜');
    assert.equal(ds(tue(1), tue(2)).cost, 2);
    const alt = ds(tue(1)).alternatives;
    assert.deepEqual(alt.rates, { peak: { input: 2, output: 8 }, offpeak: { input: 1, output: 4 } });
    assert.equal(quote('deepseek', { m1: { rates: { input: 2, output: 8 } } }, { at: tue(1) }).alternatives, undefined);
});

await test('catalogCount: 묶음 가격표의 모델 수, 모르는 제공처는 0', () => {
    assert.ok(R.catalogCount('anthropic') > 0);
    assert.equal(R.catalogCount('no-such-provider'), 0);
});

console.log(`pricing-quote-edges: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
