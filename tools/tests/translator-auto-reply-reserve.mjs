// 번역기 2.8.2 「자동 · 현재 컨텍스트」 응답 몫: 응답 길이를 100000 처럼 크게 넣으면 컨텍스트 − 응답 길이가 0 이하라
// 「응답 예약량을 빼면 대화를 넣을 공간이 없어요」가 났다. 번역 답은 보낸 글보다 길지 않으므로(토큰당 ≈1.2자, 2.8.3 묶음 = 응답 길이 × 1.2자)
// 대화 범위를 셀 때 떼어 두는 응답 몫만 8192(생각하는 모델의 출력 바닥 THINK_MIN_TOKENS)로 묶는다. 실제 요청의 max_tokens 는 그대로. 가짜 채팅 · 가짜 토큰 셈만.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const auto = await import(pathToFileURL(path.join(root, 'src/addons/translator/context-auto.js')));
const { calculateInputBudget } = await import(pathToFileURL(path.join(root, 'src/recent-context.js')));
const source = fs.readFileSync(path.join(root, 'src/addons/translator/context-auto.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const SAFETY = 128, NATIVE_REPLY = 500;   // createSillyTavernContextServices 기본 safetyTokens · 본채팅 응답 길이(가짜)
const words = text => text.split(/\s+/).filter(Boolean).length;
async function select({ maxTokens, contextTokens, key = 'max_tokens', body = 'The boats came home.' }) {
    const chat = Array.from({ length: 400 }, (_, i) => ({ name: i % 2 ? 'Reader' : 'Character', is_user: i % 2 === 1, is_system: false,
        mes: `line ${i} ` + 'quiet harbor words '.repeat(20) }));
    const context = { chatId: 'synthetic', characterId: 1, groupId: null, mainApi: 'openai', name1: 'Reader', name2: 'Character', chat };
    const settings = { context_message_auto: true, context_include_user: true, context_exclude_last: true };
    const payload = { model: 'synthetic', [key]: maxTokens, messages: [{ role: 'system', content: 'Translate into Korean.' },
        { role: 'user', content: `Earlier lines:\n${auto.AUTO_CONTEXT.chat}\n\nTranslate: ${body}` }] };
    let selected = null;
    const out = await auto.prepareTranslatorAutoContext({ payload, getContext: () => context, getSettings: () => settings, getConnection: () => 'synthetic',
        getMaxPromptTokens: () => contextTokens - NATIVE_REPLY, getMaxContextTokens: () => contextTokens,
        countTokensOpenAIAsync: async messages => messages.reduce((sum, m) => sum + 4 + words(m.content), 0), onSelected: r => { selected = r; } });
    return { out, selected, payload };
}
const budget = (contextTokens, reserve) => Math.min(contextTokens - NATIVE_REPLY, contextTokens - reserve) - SAFETY;

await test('응답 길이 100000 · 컨텍스트 32k: 대화 자리가 남는다 (응답 몫 8192) · 실제 max_tokens 는 100000 그대로', async () => {
    const { out, selected, payload } = await select({ maxTokens: 100000, contextTokens: 32000 });
    assert.equal(selected.inputBudgetTokens, budget(32000, 8192));
    assert.ok(selected.count > 0, 'some recent lines fit');
    assert.ok(selected.requestTokens <= selected.inputBudgetTokens);
    assert.equal(out.max_tokens, 100000); assert.equal(payload.max_tokens, 100000);
    assert.ok(!auto.hasAutoContext(JSON.stringify(out.messages)));
});
await test('응답 길이 100000 · 컨텍스트 128k: 응답 몫 8192 (전엔 128000 − 100000 만 남았다)', async () => {
    const { out, selected } = await select({ maxTokens: 100000, contextTokens: 128000 });
    assert.equal(selected.inputBudgetTokens, budget(128000, 8192));
    assert.ok(selected.count > 0); assert.equal(out.max_tokens, 100000);
});
await test('max_completion_tokens 도 같은 상한', async () => {
    const { out, selected } = await select({ maxTokens: 100000, contextTokens: 32000, key: 'max_completion_tokens' });
    assert.equal(selected.inputBudgetTokens, budget(32000, 8192)); assert.equal(out.max_completion_tokens, 100000);
});
await test('응답 길이 1000 · 8192 는 예전과 같다 (상한 아래는 그대로 뺀다)', async () => {
    for (const maxTokens of [1000, 4096, 8192]) {
        const { out, selected } = await select({ maxTokens, contextTokens: 32000 });
        assert.equal(selected.inputBudgetTokens, budget(32000, maxTokens), String(maxTokens)); assert.equal(out.max_tokens, maxTokens);
    }
    const small = await select({ maxTokens: 1000, contextTokens: 8000 });
    assert.equal(small.selected.inputBudgetTokens, budget(8000, 1000));
});
await test('2.8.3 큰 묶음: 원문 40000자 · 응답 길이 60000 · 컨텍스트 128k → 응답 몫 = 요청 글자 수 ÷ 1.2 (8192 보다 크게) · 실제 max_tokens 그대로', async () => {
    const body = 'The harbor lights were slow tonight. '.repeat(1100).slice(0, 40000);
    const { out, selected, payload } = await select({ maxTokens: 60000, contextTokens: 128000, body });
    const chars = payload.messages.reduce((n, m) => n + m.content.split(auto.AUTO_CONTEXT.chat).join('').length, 0);
    assert.equal(auto.autoReplyReserve(60000, payload.messages), Math.ceil(chars / 1.2));
    assert.ok(Math.ceil(chars / 1.2) > 8192 && Math.ceil(chars / 1.2) < 60000);
    assert.equal(selected.inputBudgetTokens, budget(128000, Math.ceil(chars / 1.2)));
    assert.equal(out.max_tokens, 60000);
    // 응답 길이가 더 작으면 그 값이 몫 (min)
    assert.equal(auto.autoReplyReserve(20000, payload.messages), 20000);
    // 컨텍스트가 모자라면 예전처럼 NO_INPUT_BUDGET
    await assert.rejects(select({ maxTokens: 60000, contextTokens: 32000, body }), e => e.code === 'NO_INPUT_BUDGET' || e.code === 'BASE_OVER_BUDGET');
});
await test('컨텍스트보다 큰 응답 몫 · 0 · 음수 예산은 NO_INPUT_BUDGET (0 만이 아니라 음수도)', () => {
    const args = { promptTokens: 900, contextTokens: 1000 };
    assert.throws(() => calculateInputBudget({ ...args, replyTokens: 1000 }), e => e.code === 'NO_INPUT_BUDGET');
    assert.throws(() => calculateInputBudget({ ...args, replyTokens: 2000 }), e => e.code === 'NO_INPUT_BUDGET');
    assert.throws(() => calculateInputBudget({ ...args, replyTokens: 900, safetyTokens: 200 }), e => e.code === 'NO_INPUT_BUDGET');
    assert.equal(calculateInputBudget({ ...args, replyTokens: 50 }).inputTokens, 900);
});
await test('배선: 응답 몫 = min(응답 길이, max(THINK_MIN_TOKENS 8192, 요청 글자 수 ÷ 1.2)) · 묶음 = 응답 길이 × 1.2자 · 응답 몫만 묶음', async () => {
    assert.match(source, /import \{ THINK_MIN_TOKENS \} from '\.\.\/\.\.\/live-models\.js';/);
    assert.match(source, /export const AUTO_REPLY_RESERVE_MAX = THINK_MIN_TOKENS;/);
    assert.equal(auto.AUTO_REPLY_RESERVE_MAX, (await import(pathToFileURL(path.join(root, 'src/live-models.js')))).THINK_MIN_TOKENS);
    assert.equal(auto.AUTO_REPLY_RESERVE_MAX, 8192);
    assert.match(source, /replyTokens: autoReplyReserve\(replyTokens, messages\)/);
    assert.match(source, /return Math\.min\(replyTokens, Math\.max\(AUTO_REPLY_RESERVE_MAX, Math\.ceil\(chars \/ 1\.2\)\)\);/);
    assert.match(index, /const CHUNK_TARGET = 1800;/);
    assert.match(index, /const groupLimit = outputTokens > 0 \? Math\.max\(400, Math\.round\(outputTokens \* 1\.2\)\) : CHUNK_TARGET \* 2;/);
    assert.ok(Math.ceil(1800 * 2 / 1.2) <= auto.AUTO_REPLY_RESERVE_MAX, 'one bundle reply fits the reserve');
});
console.log(`\ntranslator-auto-reply-reserve: ${passed} passed, 0 failed`);
