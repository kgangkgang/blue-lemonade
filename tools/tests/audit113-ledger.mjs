// 코드 감사 2차 · 1.1.3 로 미룬 사용량 장부 · 가격 항목(P1 ~ P3) — 고치기 전에는 항목마다 실패했어요.
//   node tools/tests/audit113-ledger.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const C = await load('src/usage-ledger-core.js');

await test('P3 장부가 긴 모델 이름을 비밀로 보고 지우지 않아요(열쇠 모양만 지움)', async () => {
    const { PROVIDER_RATES } = await load('src/addons/perf/pricing-catalog.js');
    const entryFor = (model, provider = 'openrouter') => C.normalizeEntry({ ext: '실리태번', feature: '본 답', model, api: provider, provider, input: 1000, output: 100, at: Date.UTC(2026, 10, 9) }, Date.UTC(2026, 10, 10));
    const lost = [];
    for (const [provider, table] of Object.entries(PROVIDER_RATES)) for (const id of Object.keys(table)) {
        const e = entryFor(id, provider);
        if (!e || e.model !== id.replace(/^models\//, '')) lost.push(`${provider}: ${id}`);
    }
    assert.deepEqual(lost, []);   // 고치기 전: 14개
    // 열쇠 모양은 예전처럼 지워요
    // (지어낸 값 — 글자를 이어 붙여 만들어요. 한 덩어리로 적으면 공개 글 검사가 진짜 열쇠 꼴로 봐요)
    for (const secret of ['sk-' + 'abcdefghijklmnop1234', 'AIza' + 'SyA1234567890abcdefghijkl', 'Bearer abc', 'api_key=xyz', 'f'.repeat(40), 'm'.repeat(48)])
        assert.equal(entryFor(secret).model, '', secret);
});

await test('P2 요청 로그 가격: 앞부분만 같은 다른 모델의 값을 쓰지 않아요(날짜 · 판 꼬리만)', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/perf/state.js'), 'utf8');
    const body = /export function priceFor\(model\) \{[\s\S]*?\n\}/.exec(src)?.[0];
    assert.ok(body);
    const store = { prices: { 'gpt-4o': { input: 2.5 }, 'claude-opus-4': { input: 15 }, 'gemini-2.5-flash': { input: 0.3 }, o3: { input: 2 }, 'gemini-3.8-flash': { input: 0.5 } } };
    const priceFor = new Function('settings', `${body.replace('export ', '')}; return priceFor;`)(() => store);
    for (const m of ['gpt-4o-mini', 'claude-opus-4-8', 'gemini-2.5-flash-lite', 'o3-mini', 'o3-pro']) assert.equal(priceFor(m), null, m);   // 고치기 전: 앞 모델 값
    assert.equal(priceFor('gemini-3.8-flash-001'), store.prices['gemini-3.8-flash']);     // 주석의 예 그대로
    assert.equal(priceFor('gpt-4o-2024-08-06'), store.prices['gpt-4o']);
    assert.equal(priceFor('claude-opus-4-20250514'), store.prices['claude-opus-4']);
    assert.equal(priceFor('o3'), store.prices.o3);
    assert.equal(priceFor('gpt-4o-latest'), store.prices['gpt-4o']);
});

await test('P2 미리보기 꼬리: -preview(· -05-20 날짜) 이름은 앞 모델 값, -mini-preview · -pro-preview 는 계속 빈칸', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/perf/state.js'), 'utf8');
    const body = /export function priceFor\(model\) \{[\s\S]*?\n\}/.exec(src)?.[0];
    const store = { prices: { 'gpt-4o': { input: 2.5 }, 'gemini-2.5-flash': { input: 0.3 }, 'gemini-3.8-pro': { input: 1.25 } } };
    const priceFor = new Function('settings', `${body.replace('export ', '')}; return priceFor;`)(() => store);
    assert.equal(priceFor('gemini-2.5-flash-preview-05-20'), store.prices['gemini-2.5-flash']);   // 고치기 전: 빈칸
    assert.equal(priceFor('gemini-3.8-pro-preview'), store.prices['gemini-3.8-pro']);
    assert.equal(priceFor('gemini-3.8-pro-preview-001'), store.prices['gemini-3.8-pro']);
    for (const m of ['gpt-4o-mini-preview', 'gpt-4o-mini-search-preview', 'gemini-2.5-flash-lite-preview-06-17', 'gemini-2.5-flash-pro-preview', 'gpt-4o-previewish', 'gpt-4o-preview-5'])
        assert.equal(priceFor(m), null, m);
});

await test('P1 같은 요청을 요청 로그와 사용량 장부가 같은 값으로 셈해요', async () => {
    const P = await load('src/addons/perf/pricing.js');
    const F = await load('src/usage-feed.js');
    const L = await load('src/usage-ledger.js');
    const sat = Date.UTC(2026, 10, 7, 12);
    const cases = [
        { provider: 'xai', origin: 'https://api.x.ai', source: 'xai', model: 'grok-4.5', usage: { prompt: 300000, completion: 2000 } },
        { provider: 'deepseek', origin: 'https://api.deepseek.com', source: 'deepseek', model: 'deepseek-v4-pro', usage: { prompt: 100000, completion: 4000 } },
        { provider: 'anthropic', origin: 'https://api.anthropic.com', source: 'claude', model: 'claude-opus-4-8', usage: { prompt: 100000, completion: 2000, cached: 0, cacheWrite: 90000, cacheWrite5m: 90000, cacheWrite1h: 0, cacheWriteSplit: true } },
        { provider: 'anthropic', origin: 'https://api.anthropic.com', source: 'claude', model: 'claude-opus-4-8', usage: { prompt: 50000, completion: 2000 }, extra: { speed: 'fast' } },
        { provider: 'openai', origin: 'https://api.openai.com', source: 'openai', model: 'gpt-5.4', usage: { prompt: 50000, completion: 2000 }, extra: { serviceTier: 'priority' } },
    ];
    for (const c of cases) {
        const connection = { provider: c.provider, origin: c.origin, label: c.provider };
        const quote = P.quoteRequest({ connection, model: c.model, usage: c.usage, at: sat, ...(c.extra || {}) });
        assert.equal(quote.kind, 'official', c.model);
        const log = { kind: 'text', caller: 'chat', purpose: 'chat.generate', ok: true, at: sat, model: c.model, source: c.source, connection, promptTokens: c.usage.prompt, completionTokens: c.usage.completion, cachedTokens: c.usage.cached || 0, pricing: quote };
        const entry = C.normalizeEntry(F.ledgerEntryFromLog(log), sat + 1000);
        const found = await L.officialPrice(c.provider, c.model, sat);
        const cost = C.costOf(entry, { lookup: () => found });
        assert.ok(Math.abs(cost.usd - quote.cost) < 1e-9, `${c.model} ${JSON.stringify(c.extra || {})}: 장부 ${cost.usd} · 요청 로그 ${quote.cost}`);   // 고치기 전: -50% ~ +100%
        assert.equal(cost.kind, 'official');
    }
    // 중계 · 응답이 알려 준 비용은 예전 그대로
    const relayLog = { kind: 'text', caller: 'chat', purpose: 'chat.generate', ok: true, at: sat, model: 'x', connection: { provider: 'other', origin: 'https://relay.example.test' }, promptTokens: 10, completionTokens: 1, pricing: { kind: 'manual', cost: 1 } };
    assert.equal(F.ledgerEntryFromLog(relayLog).quotedUsd, undefined);
    const reported = C.normalizeEntry({ ext: 'X', feature: 'F', model: 'm', provider: 'openai', api: 'openai', origin: 'https://api.openai.com', input: 10, output: 1, reportedUsd: 0.5, quotedUsd: 0.1, at: sat }, sat + 1);
    assert.equal(C.costOf(reported, { lookup: () => null }).usd, 0.5);
    // 날짜별 단가표 기간은 그 표가 먼저
    const dec = Date.UTC(2026, 11, 2);
    const argon = C.normalizeEntry({ ext: 'X', feature: 'F', model: 'gemini-4-argon', provider: 'gemini', api: 'makersuite', origin: 'https://generativelanguage.googleapis.com', input: 1e6, output: 0, quotedUsd: 99, at: dec }, dec + 1);
    assert.equal(C.costOf(argon, { lookup: () => null }).usd, 4);
});

await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/audit113-ledger.mjs .'));
});
console.log(`audit113-ledger: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
