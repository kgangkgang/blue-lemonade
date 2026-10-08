// 본채팅 요청의 Claude 5 세대 규칙 (테마 5.8.0, src/main-chat-rules.js) — 보내기 직전에 Claude 5 이후 모델이면 샘플링 값만 뺀다
//   node tools/tests/main-chat-rules.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const file = path.join(root, 'src/main-chat-rules.js');
if (!fs.existsSync(file)) {
    console.log('skip: 이 트리에는 main-chat-rules.js 가 없어요 (5.8.0 이전)');
    process.exit(0);
}
const handlers = {};
globalThis.SillyTavern = { getContext: () => ({ event_types: { CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready' }, eventSource: { on: (name, fn) => { (handlers[name] ||= []).push(fn); } } }) };
const { stripClaude5Sampling, startMainChatRules } = await import(pathToFileURL(file).href);

const body = (model, source = 'claude') => ({ model, chat_completion_source: source, temperature: 0.8, top_p: 0.95, top_k: 40, frequency_penalty: 0.1, presence_penalty: 0.2, max_tokens: 900, messages: [{ role: 'user', content: '안녕' }], stream: true });
const SAMPLING = ['temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty'];
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };

test('Claude 5 이후(본체가 모르는 haiku-5-5 · 프록시 이름 포함)는 샘플링 값만 빠진다', () => {
    for (const [model, source] of [['claude-haiku-5-5', 'claude'], ['anthropic/claude-haiku-5.5', 'openrouter'], ['claude-sonnet-5-5', 'claude'], ['claude-opus-5-5', 'custom'], ['claude-fable-5-1', 'claude'], ['claude-opus-6', 'claude']]) {
        const data = body(model, source);
        assert.deepEqual(stripClaude5Sampling(data), SAMPLING, model);
        for (const key of SAMPLING) assert.equal(key in data, false, `${model} ${key}`);
        assert.equal(data.max_tokens, 900); assert.equal(data.stream, true); assert.equal(data.messages.length, 1); assert.equal(data.model, model);
    }
});

test('Claude 4 이하 · 다른 회사 모델 · 이상한 값은 그대로', () => {
    for (const [model, source] of [['claude-haiku-4-5', 'claude'], ['claude-sonnet-4-6', 'claude'], ['claude-3-5-sonnet-20241022', 'claude'], ['gpt-5.6', 'openai'], ['gemini-3.8-flash', 'makersuite'], ['', 'custom']]) {
        const data = body(model, source);
        const before = JSON.stringify(data);
        assert.deepEqual(stripClaude5Sampling(data), [], model);
        assert.equal(JSON.stringify(data), before, model);
    }
    assert.deepEqual(stripClaude5Sampling(null), []);
    assert.deepEqual(stripClaude5Sampling('claude-haiku-5-5'), []);
    // 처음부터 없는 값은 없는 채로
    assert.deepEqual(stripClaude5Sampling({ model: 'claude-haiku-5-5', temperature: 1 }), ['temperature']);
});

test('CHAT_COMPLETION_SETTINGS_READY 에 한 번만 붙고, 붙은 처리가 요청 객체를 고친다', () => {
    startMainChatRules();
    startMainChatRules();
    const list = handlers.chat_completion_settings_ready || [];
    assert.equal(list.length, 1);
    const data = body('claude-haiku-5-5');
    list[0](data);
    assert.equal('temperature' in data, false);
    const keep = body('claude-haiku-4-5');
    list[0](keep);
    assert.equal(keep.temperature, 0.8);
});

console.log(`PASS ${passed} main chat rule checks (${root})`);
