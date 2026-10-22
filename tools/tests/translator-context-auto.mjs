// Actual translator request/send functions, synthetic token counts and transports only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const { requestCurrentConnection } = await import(pathToFileURL(path.join(dir, 'current-connection.js')));
const { withPromptCache } = await import(pathToFileURL(path.join(root, 'src/prompt-cache.js')));   // 7.7.2 callLLMAPI 가 부른다
function cut(name) {
    const start = source.search(new RegExp(`\\n(?:async )?function ${name}\\(`)); assert(start >= 0, name);
    return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2);
}
const cases = [], test = async (name, fn) => { await fn(); cases.push(name); console.log('PASS', name); };
function fixture() {
    const settings = { context_message_auto: true, context_message_count: 7, context_include_user: false, context_exclude_last: true,
        connection_mode: 'direct', llm_provider: 'openai', llm_model: 'synthetic', parameters: { openai: { max_length: 200, temperature: 0.7 } },
        send_ctx_history: true, llm_prompt_send: 'Translate into Korean.', send_translate: true, send_display: 'original' };
    const context = { chatId: 'synthetic-a', characterId: 1, groupId: null, mainApi: 'openai', name1: 'Reader', name2: 'Character',
        chatCompletionSettings: { model: 'main-model', openai_max_context: 1000, openai_max_tokens: 100 },
        chat: Array.from({ length: 40 }, (_, i) => ({ name: i % 2 ? 'Reader' : 'Character', is_user: i % 2 === 1, is_system: false,
            mes: `message-${i} ` + 'complete words '.repeat(12), extra: {} })), characters: [] };
    const sent = [], counted = [], logs = [], saved = [];
    const $ = () => ({ text(value) { logs.push(value); return this; }, val() { return this; }, toggle() { return this; }, prop() { return this; } });
    const env = { ...auto, requestCurrentConnection, withPromptCache, extensionSettings: settings, getContext: () => context, document: { getElementById: () => null }, $,
        getMaxPromptTokens: () => context.chatCompletionSettings.openai_max_context - context.chatCompletionSettings.openai_max_tokens,
        getMaxContextTokens: () => context.chatCompletionSettings.openai_max_context,
        autoRequestSignature: () => JSON.stringify([settings.connection_mode, settings.llm_provider, settings.llm_model, settings.parameters, settings.profile_max_tokens, context.mainApi, context.chatCompletionSettings]),
        countTokensOpenAIAsync: async (messages, full) => { assert.equal(full, true); counted.push(structuredClone(messages)); return messages.reduce((sum, m) => sum + 4 + m.content.split(/\s+/).filter(Boolean).length, 0); },
        secret_state: { OPENAI: true }, SECRET_KEYS: { OPENAI: 'OPENAI' }, getProviderSpecificParams: () => ({}), oai_settings: {},
        LiveModels: { lowEffort: () => null, applyModelRequestRules() {}, THINK_MIN_TOKENS: 8192 }, getRequestHeaders: () => ({}),
        fetch: async (_url, options) => { const body = JSON.parse(options.body); sent.push(body); return { ok: true, text: async () => JSON.stringify({ text: '번역한 입력' }) }; },
        extractTranslationResult: data => data.text, getChatCompletionModel: s => s.model,
        createGenerationParameters: async (s, _model, _type, input) => ({ generate_data: { model: s.model, messages: [{ role: 'system', content: 'Native system instruction' }, ...input], max_tokens: s.openai_max_tokens } }),
        createTextGenGenerationData: (_s, _m, prompt, max) => ({ prompt, max_tokens: max }), getTextGenModel: () => 'text-model',
        createRawPrompt: messages => messages.map(m => m.content).join('\n'), textOutputLimit: () => 100,
        power_user: { persona_description: 'Persona reference' }, getWorldInfoPrompt: async () => ({ worldInfoString: 'World information reference' }),
        sendLangLabel: () => '한국어', sendLanguageRules: () => 'Korean', sendLang: () => 'ko', sendDialogueLang: () => '',
        defaultSettings: { llm_prompt_send: 'Translate.' }, toastr: { info() {}, error() {}, clear() {} }, setSendButtonBusy() {},
        event_types: { GENERATION_STOPPED: 'stop' }, eventSource: { on() {}, removeListener() {} }, substituteParams: x => x,
        guards: { capture: message => { const original = message.mes; return { assert() { if (message.mes !== original) throw Object.assign(Error('edited'), { cancelled: true }); } }; } },
        markTranslatedOriginal: (message, text) => { message.extra.original_text_hash = text; },
    };
    context.saveChat = async () => saved.push(true);
    context.ChatCompletionService = { processRequest: async payload => { sent.push(structuredClone(payload)); return { text: '번역한 입력' }; } };
    context.TextCompletionService = { processRequest: async payload => { sent.push(structuredClone(payload)); return { text: '번역한 입력' }; } };
    for (const name of ['substituteCustomPlaceholders', 'prepareAutoTranslationPayload', 'callLLMAPI', 'buildSendReference', 'onMessageSentTranslate']) env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
    env.translate = async (text, options) => env.callLLMAPI(env.substituteCustomPlaceholders(options.prompt, true) + '\n\n' + text);
    return { env, settings, context, sent, counted, saved, logs };
}

await test('manual llmContext keeps the saved numeric selection and existing exclusion/filter order', () => {
    const f = fixture(); f.settings.context_message_auto = false; f.settings.context_message_count = 7;
    const expected = f.context.chat.slice(-8, -1).filter(m => !m.is_user).map(m => m.mes).join('\n\n');
    assert.equal(f.env.substituteCustomPlaceholders('Before {{llmContext}} after'), 'Before ' + expected + ' after');
    assert.equal(f.settings.context_message_count, 7);
    assert.match(source, /context_message_count: 5,/); assert.match(source, /context_message_auto: false,/);
});
await test('direct actual request counts its complete prompt and prefill, strips markers and selects whole recent messages', async () => {
    const f = fixture(); f.settings.llm_prefill_toggle = true; f.settings.llm_prefill_content = 'Synthetic assistant prefill';
    const prompt = f.env.substituteCustomPlaceholders('Translate with context:\n{{llmContext}}\n[Body] A full translation body.');
    await f.env.callLLMAPI(prompt);
    assert.equal(f.sent.length, 1); const sent = f.sent[0]; assert.equal(sent.messages.length, 2); assert.equal(sent.messages[1].content, f.settings.llm_prefill_content);
    assert(!auto.hasAutoContext(sent.messages[0].content)); assert(sent.messages[0].content.includes('[Body] A full translation body.'));
    const content = sent.messages[0].content, used = f.context.chat.filter(m => content.includes(m.mes));
    assert(used.length > 7); assert(used.every(m => !m.is_user)); assert(used.at(-1) === f.context.chat[38]);
    assert.deepEqual(f.counted.slice(-sent.messages.length).flat(), sent.messages); assert.equal(f.settings.context_message_count, 7);
});
await test('actual current-connection payload is counted after system insertion and reply override', async () => {
    const f = fixture(); f.settings.connection_mode = 'profile'; f.settings.profile_max_tokens = 400;
    await f.env.callLLMAPI(f.env.substituteCustomPlaceholders('Context {{llmContext}} body'));
    const sent = f.sent[0]; assert.equal(sent.max_tokens, 400); assert.equal(sent.messages[0].role, 'system');
    assert.deepEqual(f.counted.slice(-sent.messages.length).flat(), sent.messages); assert(f.logs.some(x => String(x).includes('472')));
});
await test('direct reasoning-model reply rules apply before automatic input budgeting', async () => {
    const f = fixture(); f.context.chatCompletionSettings.openai_max_context = 10000;
    f.env.LiveModels.lowEffort = () => 'low';
    f.env.LiveModels.applyModelRequestRules = (_provider, _model, body) => { body.max_completion_tokens = body.max_tokens; delete body.max_tokens; };
    await f.env.callLLMAPI(f.env.substituteCustomPlaceholders('{{llmContext}} Translate body.'));
    assert.equal(f.sent[0].max_completion_tokens, 8192); assert(f.logs.some(x => String(x).includes('1,680')));
});
await test('manual send reference retains the 600-character cap while auto includes complete history values', async () => {
    const f = fixture(); const long = 'long '.repeat(250); f.context.chat[38].mes = long;
    f.settings.context_message_auto = false;
    const manual = await f.env.buildSendReference('new message'); assert(!manual.includes(long)); assert(manual.includes(long.slice(0, 600) + '…'));
    f.settings.context_message_auto = true; f.context.chatCompletionSettings.openai_max_context = 30000;
    const automatic = await f.env.buildSendReference('new message'); assert(automatic.includes(auto.AUTO_CONTEXT.send));
    await f.env.callLLMAPI(automatic + '\n[Body] New user message');
    assert(f.sent[0].messages[0].content.includes(long)); assert(!auto.hasAutoContext(f.sent[0].messages[0].content));
});

await test('auto reference assembly guards earlier chat edits during asynchronous world-info preparation', async () => {
    const f = fixture(); f.settings.send_ctx_wi = true;
    f.env.getWorldInfoPrompt = async () => { f.context.chat[0].mes = 'Edited during world info'; return { worldInfoString: 'Old scan result' }; };
    await assert.rejects(f.env.buildSendReference('new input'), e => e.cancelled === true); assert.equal(f.sent.length, 0);
});
await test('actual send handler retains current input and fixed references in the measured request', async () => {
    const f = fixture(); f.settings.send_ctx_persona = true; f.settings.send_ctx_wi = true;
    const id = f.context.chat.length - 1, original = f.context.chat[id].mes;
    await f.env.onMessageSentTranslate(id);
    assert.equal(f.sent.length, 1); assert.equal(f.saved.length, 1); assert.equal(f.context.chat[id].extra.llmt_sent_original, original);
    const text = f.sent[0].messages[0].content;
    assert(text.includes('Persona reference')); assert(text.includes('World information reference')); assert(text.includes(original));
    assert.deepEqual(f.counted.slice(-f.sent[0].messages.length).flat(), f.sent[0].messages); assert.equal(f.context.chat[id].mes, '번역한 입력');
});
await test('message edits while counting preserve the edit and prevent actual send transport', async () => {
    const f = fixture(), id = f.context.chat.length - 1, originalCounter = f.env.countTokensOpenAIAsync; let once = false;
    f.env.countTokensOpenAIAsync = async (...args) => { if (!once) { once = true; f.context.chat[id].mes = 'Edited by user'; } return originalCounter(...args); };
    await f.env.onMessageSentTranslate(id);
    assert.equal(f.sent.length, 0); assert.equal(f.saved.length, 0); assert.equal(f.context.chat[id].mes, 'Edited by user'); assert.equal(f.context.chat[id].extra.llmt_sent_original, undefined);
});
await test('automatic current-connection text completion cannot send unresolved markers', async () => {
    const f = fixture(); f.settings.connection_mode = 'profile'; f.context.mainApi = 'textgenerationwebui'; f.context.textCompletionSettings = {};
    await assert.rejects(f.env.callLLMAPI(f.env.substituteCustomPlaceholders('{{llmContext}} body')), e => e.code === 'UNSUPPORTED_REQUEST'); assert.equal(f.sent.length, 0);
});
await test('chat/model changes or token failures never reach model transport', async () => {
    for (const kind of ['chat', 'model', 'failure']) {
        const f = fixture(); f.env.countTokensOpenAIAsync = async () => { if (kind === 'chat') f.context.chatId = 'other'; else if (kind === 'model') f.settings.llm_model = 'changed'; else throw Error('tokenizer offline'); return 20; };
        await assert.rejects(f.env.callLLMAPI(f.env.substituteCustomPlaceholders('{{llmContext}} body'))); assert.equal(f.sent.length, 0);
    }
});
await test('known name macros are literal substitutions and stateful history macros are never executed', async () => {
    const f = fixture(); f.context.chat[38].mes = '{{char}} greets {{user}}.';
    await f.env.callLLMAPI(f.env.substituteCustomPlaceholders('{{llmContext}} body')); assert(f.sent[0].messages[0].content.includes('Character greets Reader.'));
    const g = fixture(); g.context.chat[38].mes = '{{setvar::secret::bad}}';
    await assert.rejects(g.env.callLLMAPI(g.env.substituteCustomPlaceholders('{{llmContext}} body')), e => e.code === 'UNSUPPORTED_MACRO'); assert.equal(g.sent.length, 0);
});
await test('unrelated requests and manual mode keep transport payloads unchanged without token calls', async () => {
    const f = fixture(); await f.env.callLLMAPI('No context requested'); assert.equal(f.counted.length, 0); assert.equal(f.sent[0].messages[0].content, 'No context requested');
    const g = fixture(); g.settings.context_message_auto = false; const prompt = g.env.substituteCustomPlaceholders('Manual {{llmContext}}'); await g.env.callLLMAPI(prompt); assert.equal(g.counted.length, 0); assert.equal(g.sent[0].messages[0].content, prompt);
});
await test('native payload schema additions are rejected in automatic mode before generation', async () => {
    const f = fixture(); f.env.getProviderSpecificParams = () => ({ response_format: { type: 'json_schema', json_schema: { description: 'Uncounted input' } } });
    await assert.rejects(f.env.callLLMAPI(f.env.substituteCustomPlaceholders('{{llmContext}} body')), e => e.code === 'UNSUPPORTED_REQUEST'); assert.equal(f.sent.length, 0);
});
console.log(JSON.stringify({ passed: true, groups: cases.length, realModelRequests: 0, cases }, null, 2));
