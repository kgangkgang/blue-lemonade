// 7.7.4 모델 목록 실패 주입 — 200 으로 빈 목록(빈 본문 · {} · {"data":[]})이 와도 받아 둔 목록을 지우지 않는다
//   live-models.refresh (번역 · 다시 쓰기 · TTS 분석 · 모델 전환이 같이 씀) · TTS 분석 OpenAI 호환(fetchCompatModels)
//   node tools/tests/fault-models.mjs <테마 루트>   (시험대는 live-models.mjs 와 같다 — 네트워크 0)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__faultModelsTest = { ext: {}, ctx: { chatCompletionSettings: {}, onlineStatus: 'no_connection' }, handlers: {} };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const G = 'const T = globalThis.__faultModelsTest;\n';
const ST = {
    'script.js': js(G + `export const chat = [];
export const event_types = { ONLINE_STATUS_CHANGED: 'online_status_changed' };
export const eventSource = { on(t, f) { (T.handlers[t] ||= []).push(f); }, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => '{' + String(t ?? '') + '}';
export function getRequestHeaders() { return { 'Content-Type': 'application/json', 'X-CSRF-Token': 'tok' }; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return T.ctx; }
export function saveMetadataDebounced() {}`),
    'secrets.js': js('export let secret_state = {};\nexport function setSecretState(s) { secret_state = s || {}; }'),
    'openai.js': js('export let model_list = [];\nexport function setModelList(l) { model_list = l; }'),
    'popup.js': js('export const POPUP_TYPE = {}; export const POPUP_RESULT = {}; export async function callGenericPopup() { return null; }'),
    'utils.js': js('export function getStringHash(s) { return String(s).length; }'),
};
const rootUrl = pathToFileURL(srcDir).href;
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    const base = spec.split('/').pop();
    if (parent.startsWith(R) && (spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, root: rootUrl } });

const secrets = await import(ST['secrets.js']);
const openai = await import(ST['openai.js']);
const LM = await import(pathToFileURL(path.join(srcDir, 'live-models.js')).href);
const stapi = await import(pathToFileURL(path.join(srcDir, 'addons/tts/src/stapi.js')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}

// ---------- 가짜 브라우저 (localStorage · fetch)
function fakeStorage(init = {}) {
    const data = { ...init };
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}
const calls = [];
let reply = () => ({ status: 200, body: { data: [] } });
function useFetch(fn) {
    reply = fn;
    calls.length = 0;
    globalThis.fetch = async (url, init) => {
        const body = init?.body ? JSON.parse(init.body) : undefined;
        calls.push({ url, method: init?.method, headers: init?.headers, body, raw: init?.body });
        const r = await reply(url, body);
        return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(r.body), json: async () => r.body };
    };
}
const SECRET = (on) => (on ? [{ id: 'k1', value: '***', label: 'x', active: true }] : null);
function reset({ cs = {}, keys = {}, ext = {}, storage = {} } = {}) {
    globalThis.localStorage = fakeStorage(storage);
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    Object.assign(T.ext, ext);
    T.ctx.chatCompletionSettings = { chat_completion_source: 'openai', custom_url: 'http://127.0.0.1:5001/v1/', custom_include_headers: 'X-H: 1', reverse_proxy: '', proxy_password: '', ...cs };
    T.ctx.onlineStatus = 'no_connection';
    secrets.setSecretState({ api_key_openai: SECRET(true), api_key_openrouter: SECRET(true), api_key_claude: SECRET(false), api_key_deepseek: SECRET(false), ...keys });
    LM._resetForTest();
    const legacy = stapi._modelListsForTest();
    for (const k of Object.keys(legacy)) delete legacy[k];
    useFetch(() => ({ status: 200, body: { data: [] } }));
}
const DAY = 24 * 60 * 60 * 1000;

await test('7.7.4 refresh: an empty 200 list keeps the saved list and counts as a failure', async () => {
    reset();
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-6-sol', created: 2 }] } }));
    assert.deepEqual(await LM.refresh('openai', { inheritProxy: false }), ['gpt-6-sol']);
    for (const body of [{}, { data: [] }, null]) {
        useFetch(() => ({ status: 200, body }));
        await assert.rejects(LM.refresh('openai', { inheritProxy: false }), e => e.empty === true, 'empty answer is an error: ' + JSON.stringify(body));
        assert.deepEqual(LM.cached('openai').ids, ['gpt-6-sol'], 'the saved list stays: ' + JSON.stringify(body));
    }
});
await test('7.7.4 refresh: with nothing saved yet, an empty list is stored as before (no error)', async () => {
    reset();
    useFetch(() => ({ status: 200, body: { data: [] } }));
    assert.deepEqual(await LM.refresh('openai', { inheritProxy: false }), []);
});
await test('7.7.4 TTS compat list: an empty answer does not overwrite the saved list', async () => {
    reset();
    globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ data: [{ id: 'mock-a' }, { id: 'mock-b' }] }), json: async () => ({ data: [{ id: 'mock-a' }, { id: 'mock-b' }] }) });
    const cfg = { base: 'https://compat.invalid/v1', key: 'mock-only' };
    assert.deepEqual((await stapi.fetchCompatModels(cfg)).sort(), ['mock-a', 'mock-b']);
    globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => '{}', json: async () => ({}) });
    await assert.rejects(stapi.fetchCompatModels(cfg), /비어/);
    assert.deepEqual([...LM.cached('compat:https://compat.invalid/v1').ids].sort(), ['mock-a', 'mock-b'], 'kept');
});

console.log(`\nfault-models: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
