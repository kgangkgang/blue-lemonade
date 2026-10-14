import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { selectRecentContext, calculateInputBudget, createSillyTavernContextServices, ContextSelectionError } = await import(pathToFileURL(path.join(root, 'src/recent-context.js')));

const tests = [];
const test = async (name, run) => { await run(); tests.push(name); console.log('PASS', name); };
const rejects = (promise, code) => assert.rejects(promise, e => e instanceof ContextSelectionError && e.code === code);
const words = new Map([['hello', 1], ['안녕하세요', 7], ['😀', 4], ['longword', 2], ['system', 5], ['persona', 6], ['previous', 8]]);
const tokenCost = message => 3 + message.content.split(/\s+/).filter(Boolean).reduce((sum, word) => sum + (words.get(word) ?? 2), 0);
const costs = request => request.messages.reduce((sum, message) => sum + tokenCost(message), 0);
function fixture(count = 32, budget = 100) {
    const history = Array.from({ length: count }, (_, id) => ({ id, role: id % 2 ? 'assistant' : 'user', content: ['hello', '안녕하세요', '😀', 'longword hello'][id % 4] }));
    const base = [{ role: 'system', content: 'system persona previous' }], builds = [], calls = [];
    const options = { history, getInputBudget: () => budget, isCurrent: () => true,
        buildRequest: selected => { builds.push(selected.length); return { messages: [...base, ...selected], temperature: 0.7 }; },
        countTokens: request => { calls.push(request); return costs(request); } };
    return { history, base, builds, calls, options };
}

await test('response reservation is included once, larger target replies and explicit context limits tighten it', () => {
    const args = { promptTokens: 900, contextTokens: 1000, replyTokens: 100 };
    assert.equal(calculateInputBudget(args).inputTokens, 900);
    assert.equal(calculateInputBudget({ ...args, replyTokens: 50 }).inputTokens, 900);
    assert.equal(calculateInputBudget({ ...args, replyTokens: 250 }).inputTokens, 750);
    assert.equal(calculateInputBudget({ ...args, targetContextTokens: 700, safetyTokens: 64 }).inputTokens, 536);
    assert.equal(calculateInputBudget(args).details.targetContextTokens, null);
    for (const promptTokens of [0, -1, 1.5, Infinity, NaN, '900', 1001]) assert.throws(() => calculateInputBudget({ ...args, promptTokens }), e => e.code === 'INVALID_BUDGET');
    assert.throws(() => calculateInputBudget({ ...args, replyTokens: 1000 }), e => e.code === 'NO_INPUT_BUDGET');
});
await test('selection matches a complete-suffix reference across diverse token weights and budgets', async () => {
    for (const count of [1, 2, 3, 17, 63, 200]) for (const budget of [40, 80, 150, 400, 5000]) {
        const f = fixture(count, budget); let expected = 0;
        for (let n = 1; n <= count; n++) if (costs({ messages: [...f.base, ...f.history.slice(-n)] }) <= budget) expected = n;
        const result = await selectRecentContext(f.options);
        assert.equal(result.count, expected); assert.equal(result.omitted, count - expected);
        assert.deepEqual(result.history, f.history.slice(-expected)); assert.equal(result.requestTokens, costs(result.request));
        assert(result.requestTokens <= result.inputBudgetTokens);
        assert.equal(result.request.temperature, 0.7); assert.deepEqual(result.request.messages[0], f.base[0]);
        assert(result.measurements <= 2 * Math.ceil(Math.log2(count)) + 4);
    }
});
await test('large histories bracket near the recent end instead of eagerly counting every old message', async () => {
    const f = fixture(10000, 100), result = await selectRecentContext(f.options);
    assert.equal(Math.max(...f.builds) <= result.count * 2 + 2, true);
    assert(result.measurements < 20); assert(result.history[0].id === 10000 - result.count);
});
await test('automatic history is not truncated by a character cap', async () => {
    const text = '한'.repeat(160000), f = fixture(1, 100);
    f.history[0].content = text;
    const result = await selectRecentContext(f.options);
    assert.equal(result.history[0].content, text); assert.equal(result.request.messages[1].content.length, 160000);
});
await test('empty histories and oversized fixed instructions never produce an empty generation request', async () => {
    const f = fixture(0); await rejects(selectRecentContext(f.options), 'EMPTY_HISTORY'); assert.equal(f.calls.length, 0);
    const g = fixture(4, 3); await rejects(selectRecentContext(g.options), 'BASE_OVER_BUDGET'); assert.deepEqual(g.builds, [0]);
});
await test('explicit empty-history support still counts and validates the real first-turn request', async () => {
    const f = fixture(0, 100), result = await selectRecentContext({ ...f.options, allowEmptyHistory: true });
    assert.equal(result.count, 0); assert.equal(result.omitted, 0); assert.equal(result.measurements, 2);
    assert.deepEqual(result.request.messages, f.base); assert.equal(result.requestTokens, costs(result.request));
    const g = fixture(0); g.options.buildRequest = () => ({ messages: [] });
    await rejects(selectRecentContext({ ...g.options, allowEmptyHistory: true }), 'EMPTY_REQUEST');
    const h = fixture(1, 25); h.history[0].content = '안녕하세요 '.repeat(100);
    await rejects(selectRecentContext({ ...h.options, allowEmptyHistory: true }), 'LATEST_MESSAGE_TOO_LARGE');
});
await test('an oversized newest message fails instead of skipping it to select older messages', async () => {
    const f = fixture(3, 40); f.history[2].content = '안녕하세요 '.repeat(100);
    await rejects(selectRecentContext(f.options), 'LATEST_MESSAGE_TOO_LARGE'); assert.deepEqual(f.builds, [0, 1]);
});
await test('the history and actual counted payload are detached from later source edits', async () => {
    const f = fixture(3, 100), original = structuredClone(f.history); let once = false;
    f.options.countTokens = async request => { if (!once) { once = true; f.history[2].content = 'Changed live'; f.history.push({ role: 'user', content: 'New live message' }); } await Promise.resolve(); return costs(request); };
    const result = await selectRecentContext(f.options);
    assert.deepEqual(result.history, original); assert(Object.isFrozen(result)); assert(Object.isFrozen(result.history));
    assert(Object.isFrozen(result.history[0])); assert(Object.isFrozen(result.request.messages));
    assert.throws(() => { result.request.messages[1].content = 'mutated'; }, TypeError);
});
await test('chat or model changes after each awaited stage discard selection', async () => {
    for (const stage of ['getInputBudget', 'buildRequest', 'countTokens']) {
        const f = fixture(), original = f.options[stage]; let current = true;
        f.options.isCurrent = () => current;
        f.options[stage] = async (...args) => { const value = await original(...args); current = false; return value; };
        await rejects(selectRecentContext(f.options), 'CONTEXT_CHANGED');
    }
});
await test('changes to the final budget or its model metadata invalidate the result', async () => {
    const f = fixture(); let calls = 0; f.options.getInputBudget = () => ++calls === 1 ? 100 : 99;
    await rejects(selectRecentContext(f.options), 'CONTEXT_CHANGED');
    const g = fixture(); let reads = 0; g.options.getInputBudget = () => ({ inputTokens: 100, details: { model: ++reads === 1 ? 'A' : 'B' } });
    await rejects(selectRecentContext(g.options), 'CONTEXT_CHANGED');
});
await test('invalid, unavailable and unstable counts fail explicitly', async () => {
    for (const value of [-1, 0, 0.5, NaN, Infinity, '20', null]) {
        const f = fixture(); f.options.countTokens = () => value;
        await rejects(selectRecentContext(f.options), 'INVALID_TOKEN_COUNT');
    }
    const f = fixture(); f.options.countTokens = () => { throw Error('endpoint unavailable'); };
    await rejects(selectRecentContext(f.options), 'TOKEN_COUNT_FAILED');
    const g = fixture(1); let calls = 0; g.options.countTokens = request => costs(request) + (++calls === 3 ? 1 : 0);
    await rejects(selectRecentContext(g.options), 'TOKEN_COUNT_CHANGED');
});
await test('observed nonmonotonic builders cannot silently choose a questionable suffix', async () => {
    const f = fixture(8); f.options.countTokens = request => request.messages.length === 1 ? 50 : 20;
    await rejects(selectRecentContext(f.options), 'NON_MONOTONIC_COUNT');
});
await test('abort before and during a stalled count prevents a late request from being selected', async () => {
    const f = fixture(), controller = new AbortController(); controller.abort();
    await rejects(selectRecentContext({ ...f.options, signal: controller.signal }), 'CANCELLED'); assert.equal(f.calls.length, 0);
    const g = fixture(), pending = new AbortController(); let started;
    const ready = new Promise(resolve => { started = resolve; });
    g.options.countTokens = () => { started(); return new Promise(() => {}); };
    const task = selectRecentContext({ ...g.options, signal: pending.signal }); await ready; pending.abort();
    await rejects(task, 'CANCELLED');
});
await test('cyclic or unsupported request data fails before token counting', async () => {
    const f = fixture(); f.history[0].cycle = f.history[0]; await rejects(selectRecentContext(f.options), 'INVALID_DATA');
    const g = fixture(); g.options.buildRequest = () => ({ content: () => 'unstable' }); await rejects(selectRecentContext(g.options), 'INVALID_DATA');
    assert.equal(g.calls.length, 0);
});

function services(overrides = {}) {
    return createSillyTavernContextServices({ getMaxPromptTokens: () => 900, getMaxContextTokens: () => 1000,
        getMainApi: () => 'openai', replyTokens: 100, safetyTokens: 20,
        countTokensOpenAIAsync: async messages => messages.reduce((n, m) => n + tokenCost(m), 0), ...overrides });
}
await test('native services use actual messages with full role framing and preserve explicit target limits', async () => {
    const input = [{ role: 'system', content: 'system' }, { role: 'user', content: '안녕하세요' }], called = [];
    const adapter = services({ targetContextTokens: 700, countTokensOpenAIAsync: async (messages, full) => { called.push({ messages, full }); return 15; } });
    assert.equal(adapter.getInputBudget().inputTokens, 580);
    const counted = await adapter.countTokens({ messages: input, model: 'existing' });
    assert.deepEqual(called.flatMap(x => x.messages), input); assert(called.every(x => x.messages.length === 1 && x.full === true)); assert.equal(counted.tokens, 30);
    assert.equal(counted.method, 'current-chat-native-messages'); assert.equal(counted.approximate, true);
});
await test('unsupported API modes and non-text request bodies never use a character estimate', async () => {
    let called = false; const adapter = services({ getMainApi: () => 'textgenerationwebui', countTokensOpenAIAsync: async () => { called = true; return 5; } });
    assert.throws(() => adapter.getInputBudget(), e => e.code === 'UNSUPPORTED_TOKENIZER');
    await rejects(adapter.countTokens([]), 'UNSUPPORTED_TOKENIZER'); assert.equal(called, false);
    for (const request of ['plain prompt', [{ role: 'user', content: [{ type: 'image_url' }] }], { prompt: 'x' }, { messages: [], tools: [{ name: 'tool' }] }, { messages: [], response_format: { type: 'json_schema' } }, { messages: [], systemInstruction: 'Hidden extra text' }, { messages: [], documents: ['More input'] }]) await rejects(services().countTokens(request), 'UNSUPPORTED_REQUEST');
});
await test('native tokenizer errors, invalid numbers and timeout cannot become a usable count', async () => {
    for (const value of [NaN, Infinity, -1, 0]) await rejects(services({ countTokensOpenAIAsync: async () => value }).countTokens([{ role: 'user', content: 'hello' }]), 'INVALID_TOKEN_COUNT');
    await assert.rejects(services({ countTokensOpenAIAsync: async () => { throw Error('endpoint failed'); } }).countTokens([{ role: 'user', content: 'hello' }]), /endpoint failed/);
    await rejects(services({ timeoutMs: 5, countTokensOpenAIAsync: () => new Promise(() => {}) }).countTokens([{ role: 'user', content: 'hello' }]), 'TOKENIZER_TIMEOUT');
});
await test('native per-message counting stops after a model switch, abort or timeout without counting later messages', async () => {
    const input = [{ role: 'system', content: 'system' }, { role: 'user', content: 'hello' }];
    let current = true, calls = 0;
    const changed = services({ countTokensOpenAIAsync: async () => { calls++; current = false; return 10; } });
    await rejects(changed.countTokens(input, { isCurrent: () => current }), 'CONTEXT_CHANGED'); assert.equal(calls, 1);
    const controller = new AbortController(); calls = 0;
    const aborted = services({ countTokensOpenAIAsync: async () => { calls++; controller.abort(); return 10; } });
    await rejects(aborted.countTokens(input, { signal: controller.signal }), 'CANCELLED'); assert.equal(calls, 1);
    let finish; calls = 0;
    const timed = services({ timeoutMs: 5, countTokensOpenAIAsync: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
    await rejects(timed.countTokens(input), 'TOKENIZER_TIMEOUT'); finish(10); await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(calls, 1);
});
console.log(JSON.stringify({ passed: true, groups: tests.length, modelRequests: 0, tests }, null, 2));
