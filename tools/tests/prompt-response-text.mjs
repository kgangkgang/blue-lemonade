import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { completionText } from '../../src/addons/prompt/response-text.js';
import { responseError } from '../../src/addons/prompt/request-errors.js';
import { requestCurrentConnection } from '../../src/addons/prompt/current-connection.js';
import { maybeBlocked, withFallback } from '../../src/addons/modelswitch/fallback.js';

const fixtures = [
    ['plain', ' 번역문 ', '번역문'],
    ['OpenAI', { choices: [{ message: { content: '번역문' } }] }, '번역문'],
    ['Claude thinking first', { choices: [{ message: { content: '' } }], content: [{ type: 'thinking', thinking: 'private reasoning' }, { type: 'text', text: '번역문' }] }, '번역문'],
    ['Claude several text blocks', { choices: [{ message: { content: '앞' } }], content: [{ type: 'text', text: '앞' }, { type: 'redacted_thinking', data: 'hidden' }, { type: 'text', text: '뒤' }] }, '앞\n\n뒤'],
    ['OpenAI content array', { choices: [{ message: { content: [{ type: 'text', text: '번역' }, { type: 'text', text: '문' }, { type: 'image_url', text: 'not text' }] } }] }, '번역문'],
    ['Google thoughts first', { candidates: [{ content: { parts: [{ thought: true, text: 'private reasoning' }, { text: '앞 문단' }, { text: '뒤 문단' }] } }] }, '앞 문단\n\n뒤 문단'],
    ['ST Google wrapper', { choices: [{ message: { content: '앞\n\n뒤' } }], responseContent: { parts: [{ text: '앞' }, { text: '뒤' }] } }, '앞\n\n뒤'],
    ['Cohere', { message: { content: [{ type: 'text', text: '번역문' }] } }, '번역문'],
    ['text completion choices', { choices: [{ text: '번역문' }] }, '번역문'],
    ['text completion results', { results: [{ text: '번역문' }] }, '번역문'],
    ['text completion response', { response: '번역문' }, '번역문'],
    ['extracted profile', { content: '번역문' }, '번역문'],
    ['thinking is not output', { content: [{ type: 'thinking', text: 'private reasoning' }] }, ''],
    ['tool input is not output', { content: [{ type: 'tool_use', input: { text: 'not an answer' } }] }, ''],
    ['empty', { choices: [{ message: { content: null } }] }, ''],
    ['quoted refusal is ordinary translation', { choices: [{ message: { content: 'I cannot was translated as 할 수 없다.' }, finish_reason: 'stop' }] }, 'I cannot was translated as 할 수 없다.'],
    ['no explicit truncation metadata means no guessed failure', { choices: [{ message: { content: 'A sentence ending…' } }] }, 'A sentence ending…'],
];
for (const [name, input, expected] of fixtures) {
    assert.equal(completionText(input), expected, name);
}
assert.throws(() => completionText({ error: { message: 'rate limit', code: 429 } }), e => e.status === 429 && e.transient === true);
assert.throws(() => completionText({ choices: [{ message: { refusal: 'declined' }, finish_reason: 'content_filter' }] }), e => e.blocked && e.refused);
assert.throws(() => completionText({ candidates: [{ finishReason: 'SAFETY' }] }), e => e.blocked);
assert.throws(() => completionText({ stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: 'hidden' }] }), /출력 한도/);
const partial = 'SYNTHETIC_PARTIAL_ANSWER_DO_NOT_ECHO';
const limited = [
    { choices: [{ message: { content: partial }, finish_reason: 'length' }] },
    { stop_reason: 'max_tokens', content: [{ type: 'text', text: partial }] },
    { candidates: [{ content: { parts: [{ text: partial }] }, finishReason: 'MAX_TOKENS' }] },
];
const blocked = [
    { choices: [{ message: { content: partial }, finish_reason: 'content_filter' }] },
    { choices: [{ message: { content: partial, refusal: 'explicit refusal' }, finish_reason: 'stop' }] },
    { candidates: [{ content: { parts: [{ text: partial }] }, finishReason: 'SAFETY' }] },
];
for (const input of limited) assert.throws(() => completionText(input), e => /출력 한도.*끊겼/.test(e.message) && !e.message.includes(partial) && !maybeBlocked(e));
for (const input of blocked) assert.throws(() => completionText(input), e => e.blocked && e.refused && !e.message.includes(partial) && maybeBlocked(e));
assert.throws(() => completionText({ error: { code: 429, message: 'blocked due to rate limit' } }), e => e.status === 429 && e.transient && !maybeBlocked(e));
assert.throws(() => completionText({ error: { code: 401, message: 'content policy wording in unauthorized error' } }), e => e.status === 401 && !maybeBlocked(e));
// The old direct reader drops a real answer after a thinking block; the old
// current-connection reader turns the blocks into [object Object].
const raw = fixtures[2][1];
const oldDirect = raw.choices?.[0]?.message?.content?.trim() || raw.content?.[0]?.text?.trim() || '';
const oldCurrent = String(raw.content || raw.choices?.[0]?.message?.content || '').trim();
assert.equal(oldDirect, '');
assert.match(oldCurrent, /\[object Object\]/);
assert.equal(completionText(raw), '번역문');
const twenty = Array.from({ length: 20 }, (_, i) => i < 2 ? fixtures[1][1] : raw);
assert.equal(twenty.filter(d => (d.choices?.[0]?.message?.content || d.content?.[0]?.text || '').trim()).length, 2);
assert.equal(twenty.filter(d => completionText(d) === '번역문').length, 20);
// Execute the actual call sites, not just the parser, against ST-shaped replies.
const src = fs.readFileSync(new URL('../../src/addons/prompt/index.js', import.meta.url), 'utf8');
const start = src.indexOf('async function runCompletionOnce('), end = src.indexOf('// 다시 보내면 결과가', start);
const parseStart = src.indexOf('function parseNumberedTitles('), parseEnd = src.indexOf('async function translateTitleBatch(', parseStart);
const parseTitles = new Function(src.slice(parseStart, parseEnd) + '\nreturn parseNumberedTitles;')();
const googleTitles = { responseContent: { parts: [{ text: '1. 첫 제목' }, { thought: true, text: 'hidden' }, { text: '2. 다음 제목' }] } };
assert.deepEqual(parseTitles(completionText(googleTitles), 2), ['첫 제목', '다음 제목']);
let mode = 'direct';
let reply = raw;
const flight = new Set();
const env = { completionText, responseError, AbortController, setTimeout, clearTimeout, stopReq: false, inFlight: flight,
    cfg: () => ({ connectionMode: mode, provider: 'claude', model: 'test-model', stProfileId: 'fixture' }),
    PROVIDER_TO_SOURCE: { claude: 'claude' }, getCurrentParams: () => ({ params: {} }), getProviderSpecificParams: () => ({}),
    budgetFor: () => 2048, directParameters: () => ({}), oai_settings: {}, requestTimeoutMs: () => 2000,
    getRequestHeaders: () => ({}), fetch: async () => ({ ok: true, json: async () => reply }),
    usingStProfile: () => mode === 'profile', getConnSvc: () => ({ sendRequest: async () => ({ content: '번역문' }) }),
    listStProfiles: () => [{ id: 'fixture' }], isTransientFailure: () => false,
};
vm.createContext(env);
vm.runInContext(src.slice(start, end).replaceAll('import.meta.url', "'fixture.js'"), env);
assert.equal(await env.runCompletionOnce([{ role: 'user', content: 'Translate' }]), '번역문');
assert.equal(flight.size, 0);
mode = 'profile';
assert.equal(await env.runCompletionOnce([{ role: 'user', content: 'Translate' }]), '번역문');
// A known chat profile must keep raw finish/refusal fields. A text profile
// must keep ST's extracted result (which strips instruct stopping strings).
let profileKind = 'openai', profileOptions;
const profileService = {
    getProfile: id => ({ id }), validateProfile: () => ({ selected: profileKind }),
    sendRequest: async (_id, _messages, _budget, options) => {
        profileOptions = options;
        return options.extractData ? { content: '정지문자를 제거한 번역문' } : reply;
    },
};
env.getConnSvc = () => profileService;
assert.equal(await env.runCompletionOnce([]), '번역문'); assert.equal(profileOptions.extractData, false);
for (const input of [...limited, ...blocked]) {
    reply = input;
    await assert.rejects(env.runCompletionOnce([]), e => !e.message.includes(partial) && (blocked.includes(input) ? e.blocked && e.refused && maybeBlocked(e) : /출력 한도/.test(e.message) && !maybeBlocked(e)));
    assert.equal(flight.size, 0);
}
reply = { error: { code: 429, message: 'blocked due to rate limit' } };
await assert.rejects(env.runCompletionOnce([]), e => e.status === 429 && e.transient && !maybeBlocked(e));
let fallbackCalls = 0;
const fallbackOptions = { target: { provider: 'custom', model: 'fixture-fallback' }, send: async () => { fallbackCalls++; return '대체 번역문'; } };
reply = blocked[0]; assert.equal(await withFallback(() => env.runCompletionOnce([]), fallbackOptions), '대체 번역문'); assert.equal(fallbackCalls, 1);
reply = limited[0]; await assert.rejects(withFallback(() => env.runCompletionOnce([]), fallbackOptions), /출력 한도/); assert.equal(fallbackCalls, 1);
reply = { error: { code: 429, message: 'blocked due to rate limit' } }; await assert.rejects(withFallback(() => env.runCompletionOnce([]), fallbackOptions), e => e.status === 429); assert.equal(fallbackCalls, 1);
profileService.sendRequest = async () => { throw new Error('API request failed', { cause: Object.assign(new Error('rate limit'), { status: 429, transient: true, retryAfterMs: 2500 }) }); };
await assert.rejects(env.runCompletionOnce([]), e => e.status === 429 && e.transient && e.retryAfterMs === 2500 && !maybeBlocked(e));
profileService.sendRequest = async (_id, _messages, _budget, options) => { profileOptions = options; return options.extractData ? { content: '정지문자를 제거한 번역문' } : { choices: [{ text: '번역문<STOP>' }] }; };
profileKind = 'textgenerationwebui';
assert.equal(await env.runCompletionOnce([]), '정지문자를 제거한 번역문'); assert.equal(profileOptions.extractData, true);
profileKind = 'unknown'; await env.runCompletionOnce([]); assert.equal(profileOptions.extractData, true);
delete profileService.getProfile; await env.runCompletionOnce([]); assert.equal(profileOptions.extractData, true);
mode = 'direct';
for (const input of [...limited, ...blocked]) { reply = input; await assert.rejects(env.runCompletionOnce([]), e => blocked.includes(input) ? e.blocked && maybeBlocked(e) : /출력 한도/.test(e.message) && !maybeBlocked(e)); }
reply = raw;
const conn = fs.readFileSync(new URL('../../src/addons/prompt/connection.js', import.meta.url), 'utf8');
const activeSource = conn.slice(conn.indexOf('export async function requestActive('), conn.indexOf('export function bindConnection(')).replace('export ', '');
const active = new Function('completionText', 'requestCurrentConnection', activeSource + '\nreturn requestActive;')(completionText, requestCurrentConnection);
let mainApi = 'openai';
const context = () => ({ mainApi, chatCompletionSettings: {}, textCompletionSettings: {}, ChatCompletionService: { processRequest: async (_p, _o, extract) => { assert.equal(extract, false); return reply; } }, TextCompletionService: { processRequest: async (_p, _o, extract) => { assert.equal(extract, false); return reply; } } });
assert.equal(await active({ cfg: () => ({ requestTimeoutMs: 2000 }), context, messages: [], inFlight: flight,
    hostModules: async () => ({ script: {}, text: {}, chat: { getChatCompletionModel: () => 'fixture', createGenerationParameters: async () => ({ generate_data: {} }) } }) }), '번역문');
assert.equal(flight.size, 0);
const runActive = () => active({ cfg: () => ({ requestTimeoutMs: 2000 }), context, messages: [], inFlight: flight,
    hostModules: async () => ({ script: { createRawPrompt: () => 'synthetic prompt' }, text: { getTextGenModel: () => 'fixture', createTextGenGenerationData: () => ({}) }, chat: { getChatCompletionModel: () => 'fixture', createGenerationParameters: async () => ({ generate_data: {} }) } }) });
for (const input of [...limited, ...blocked]) { reply = input; await assert.rejects(runActive(), e => blocked.includes(input) ? e.blocked && maybeBlocked(e) : /출력 한도/.test(e.message) && !maybeBlocked(e)); assert.equal(flight.size, 0); }
mainApi = 'textgenerationwebui'; reply = { results: [{ text: 'Text completion translation' }] }; assert.equal(await runActive(), 'Text completion translation');
reply = limited[0]; await assert.rejects(runActive(), /출력 한도/); assert.equal(flight.size, 0);
console.log('prompt-response-text: parser + direct/profile/current, Google paragraphs/titles, partial finish errors and profile extraction/metadata passed; old parser 2/20, new parser 20/20');
