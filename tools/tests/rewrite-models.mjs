// 다시 쓰기 (src/addons/rewrite) 직접 선택의 모델 고르기 — 공용 목록 src/live-models.js 를 쓰는 길
//   node tools/tests/rewrite-models.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈은 data: 스텁으로 (live-models.mjs 와 같은 방식). 네트워크 없음 — fetch 는 가짜 (부른 것을 기록).
// 확인하는 것:
//   1) 요청 본문: 예전 다시 쓰기(2.0.1 — 아래에 그대로 옮긴 applyModelRequestRules · resolveModel · generateDirect 의 본문 만들기)와
//      저장된 모델이면 글자까지 같음. 공용 규칙만 쓰고 자기 사본은 없음
//   2) 목록: 받은 목록(새것 먼저) + 모델 등록 · 받기 전엔 모델 등록 → KNOWN (Claude/Vertex 와 본체 주소 Custom 만 실리태번 화면 목록까지) ·
//      저장된 모델은 그대로 (이전 목록 · 이 주소 목록에 없음) · 직접 입력 · 고정 첫 모델로 몰래 바꾸지 않음
//   3) 받기: Custom /status 본문이 예전과 글자까지 같음 · 오류 문구 · localStorage 에만 (settings.json 은 그대로) · 하루 TTL ·
//      Claude/Vertex/키 없음/새로 친 주소는 안 물음 · 같은 목록은 한 번만 · 실패하면 기다림 · onChange 키 = 화면의 키
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__liveModelsTest = { ext: {}, ctx: { chatCompletionSettings: {}, onlineStatus: 'no_connection' }, handlers: {} };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const G = 'const T = globalThis.__liveModelsTest;\n';
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
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    const base = spec.split('/').pop();
    if (parent.startsWith(R) && (spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(srcDir).href } });

const secrets = await import(ST['secrets.js']);
const LM = await import(pathToFileURL(path.join(srcDir, 'live-models.js')).href);
const RW = await import(pathToFileURL(path.join(srcDir, 'addons/rewrite/providers.js')).href);
const { DEFAULT_SETTINGS } = await import(pathToFileURL(path.join(srcDir, 'addons/rewrite/defaults.js')).href);
const INDEX = fs.readFileSync(path.join(srcDir, 'addons/rewrite/index.js'), 'utf8');
const PROVIDERS_SRC = fs.readFileSync(path.join(srcDir, 'addons/rewrite/providers.js'), 'utf8');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}

// ---------- 가짜 브라우저 (localStorage · fetch · document)
function fakeStorage(init = {}) {
    const data = { ...init };
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}
const calls = [];
function useFetch(reply) {
    calls.length = 0;
    globalThis.fetch = async (url, init) => {
        calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : undefined, raw: init?.body });
        const r = await reply(url, init);
        if (r instanceof Error) throw r;
        return { ok: r.status >= 200 && r.status < 300, status: r.status, statusText: r.statusText ?? '', json: async () => r.body, text: async () => JSON.stringify(r.body) };
    };
}
const SECRET = (on) => (on ? [{ id: 'k1', value: '***', label: 'x', active: true }] : null);
const DAY = 24 * 60 * 60 * 1000;
const ST_URL = 'http://127.0.0.1:5001/v1';
function reset({ cs = {}, keys = {}, ext = {}, storage = {} } = {}) {
    globalThis.localStorage = fakeStorage(storage);
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    Object.assign(T.ext, ext);
    T.ctx.chatCompletionSettings = { chat_completion_source: 'openai', custom_url: `${ST_URL}/`, custom_include_headers: 'X-H: 1', reverse_proxy: '', proxy_password: '', ...cs };
    T.ctx.onlineStatus = 'no_connection';
    secrets.setSecretState({ api_key_openai: SECRET(true), api_key_openrouter: SECRET(true), api_key_makersuite: SECRET(true), api_key_claude: SECRET(true),
        api_key_deepseek: SECRET(false), api_key_cohere: SECRET(true), ...keys });
    LM._resetForTest();
    delete globalThis.document;
    useFetch(() => ({ status: 200, body: { data: [] } }));
}
const opts = (vals) => ({ options: vals.map(v => ({ value: v })) });
function pageSelects(map) {
    globalThis.document = { getElementById: (id) => (map[id] ? opts(map[id]) : null) };
}

// ---------- 다시 쓰기 2.0.1 (2026-10-07 판) — 그대로 옮김
const OLD_GEMINI = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const OLD_PROVIDERS = {
    openai: { label: 'OpenAI', source: 'openai', secrets: ['OPENAI'], models: [
        'gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6', 'gpt-5.5', 'gpt-5.4',
        'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.3-chat-latest', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-5-mini',
        'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3', 'gpt-4o', 'gpt-4o-mini'] },
    claude: { label: 'Claude', source: 'claude', secrets: ['CLAUDE'], models: [
        'claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'claude-fable-5',
        'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-opus-4-5', 'claude-sonnet-4-5'] },
    google: { label: 'Google AI Studio', source: 'makersuite', secrets: ['MAKERSUITE'], models: OLD_GEMINI },
    vertexai: { label: 'Vertex AI', source: 'vertexai', secrets: ['VERTEXAI', 'VERTEXAI_SERVICE_ACCOUNT'], models: OLD_GEMINI },
    openrouter: { label: 'OpenRouter', source: 'openrouter', secrets: ['OPENROUTER'], models: [
        'google/gemini-3.8-flash', 'google/gemini-3.7-flash', 'google/gemini-3.5-flash-lite',
        'google/gemini-3.1-pro-preview', 'google/gemini-2.5-pro', 'anthropic/claude-fable-5.1',
        'anthropic/claude-opus-5', 'anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5', 'openai/gpt-6-astra',
        'openai/gpt-5.6-terra', 'openai/gpt-5.6-luna', 'deepseek/deepseek-v4.1-flash', 'deepseek/deepseek-v4-pro',
        'x-ai/grok-4.6', 'qwen/qwen3.8-max-0902', 'moonshotai/kimi-k3', 'z-ai/glm-5.3', 'mistralai/mistral-medium-3-5'] },
    deepseek: { label: 'DeepSeek', source: 'deepseek', secrets: ['DEEPSEEK'], models: ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash'] },
    cohere: { label: 'Cohere', source: 'cohere', secrets: ['COHERE'], models: [
        'command-a-plus-05-2026', 'command-a-03-2025', 'command-r7b-12-2024', 'command-r-plus-08-2024',
        'command-r-08-2024', 'c4ai-aya-expanse-32b', 'c4ai-aya-expanse-8b'] },
    custom: { label: 'Custom (OpenAI 호환)', source: 'custom', secrets: ['CUSTOM'], models: [] },
};
function oldResolveModel({ provider, models, customModels }) {
    const picked = models?.[provider] || OLD_PROVIDERS[provider]?.models[0] || 'custom';
    return picked === 'custom' ? String(customModels?.[provider] ?? '').trim() : picked;
}
function oldApplyModelRequestRules(provider, model, request) {
    const dropSampling = (...keys) => keys.forEach(key => delete request[key]);
    const useMaxCompletionTokens = () => {
        if (provider === 'openai' && request.max_tokens !== undefined) {
            request.max_completion_tokens = request.max_tokens;
            delete request.max_tokens;
        }
    };
    if ((provider === 'openai' && /^(o1|o3|o4)/.test(model)) || (provider === 'openrouter' && /^openai\/(o1|o3|o4)/.test(model))) {
        useMaxCompletionTokens();
        dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }
    if ((provider === 'openai' || provider === 'openrouter') && /gpt-(5|6)/.test(model)) {
        useMaxCompletionTokens();
        if (/gpt-5-chat-latest/.test(model)) {
            // Chat-only model accepts sampling.
        } else if (/gpt-5\.(1|2|3|4)/.test(model) && !/chat-latest/.test(model)) {
            dropSampling('frequency_penalty', 'presence_penalty');
        } else {
            dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
        }
    }
    if (/claude-(fable|opus-5|sonnet-5)/.test(model)) {
        dropSampling('temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty');
    }
}
const oldNormalizeUrl = (url) => String(url ?? '').trim().replace(/\/+$/, '');
// generateDirect (index.js) 의 본문 만들기 — 이 부분은 2.0.1 그대로이고, 바뀐 것은 모델 이름(resolveModel)과 규칙(applyModelRequestRules)뿐
function generateBody(settings, oai, { resolve, rules, endpoint }) {
    const provider = OLD_PROVIDERS[settings.provider];
    const model = resolve();
    const request = { messages: [{ role: 'user', content: 'U' }], model, chat_completion_source: provider.source, temperature: settings.temperature, max_tokens: settings.maxTokens, stream: false };
    if (settings.provider === 'custom') {
        request.custom_url = endpoint.url;
        if (endpoint.inheritExtras) {
            request.custom_include_body = `{${oai.custom_include_body || ''}}`;
            request.custom_exclude_body = `{${oai.custom_exclude_body || ''}}`;
            request.custom_include_headers = `{${oai.custom_include_headers || ''}}`;
        }
    }
    if (settings.provider === 'vertexai') {
        request.vertexai_auth_mode = oai?.vertexai_auth_mode || 'full';
        request.vertexai_region = oai?.vertexai_region || 'us-central1';
        request.vertexai_express_project_id = oai?.vertexai_express_project_id || '';
    }
    if (settings.useReverseProxy && settings.reverseProxyUrl) {
        request.reverse_proxy = settings.reverseProxyUrl;
        request.proxy_password = settings.reverseProxyPassword;
    }
    rules(settings.provider, model, request);
    return JSON.stringify(request);
}
const oldEndpoint = (settings, oai) => {
    const own = oldNormalizeUrl(settings.customUrl);
    return own ? { url: own, inheritExtras: false } : { url: oldNormalizeUrl(oai?.custom_url), inheritExtras: true };
};

// 2026-10 까지의 이름: 예전 고정 목록 · 기본값 · KNOWN · 실리태번 · OpenRouter 의 이름 몇 · 이상한 이름
const IDS = [...new Set([
    ...Object.values(OLD_PROVIDERS).flatMap(p => p.models),
    ...Object.values(DEFAULT_SETTINGS.models),
    ...Object.values(LM.KNOWN).flat(),
    'gpt-5-chat-latest', 'gpt-5.2-chat-latest', 'gpt-5.1-2025-11-13', 'gpt-5.5-2026-04-23', 'gpt-4o-2024-11-20', 'gpt-3.5-turbo', 'o1', 'o3-mini', 'o4-mini-2025-04-16',
    'claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929', 'claude-opus-4-0', 'claude-sonnet-4-20250514', 'claude-3-opus-20240229', 'claude-instant-1.2',
    'openai/o3', 'openai/o4-mini-high', 'openai/o1-pro', 'openai/gpt-5.4-mini', 'openai/gpt-5-chat', 'openai/gpt-oss-120b', 'openai/gpt-4o-mini',
    'anthropic/claude-sonnet-5.5:batch', 'anthropic/claude-3.5-sonnet:beta', 'anthropic/claude-opus-4.8', '~anthropic/claude-fable-latest',
    'gpt-35-turbo', 'claude-opus-45', 'gemini-15-pro', 'o2-test', 'gpt-oss-120b', 'chatgpt-4o-latest', 'my-gpt-5-proxy', 'relay/gpt-6-sol',
    'claude-sonnet-5-thinking', 'claude-opus-4-5-thinking', 'gemini-3.8-flash-thinking', 'gpt-5.10', 'deepseek-chat', 'GPT-6-SOL', 'Claude-Opus-5',
    'models/gemini-3.8-flash', 'gemini-flash-latest', 'relay-model', 'claude-sonnet-4-5@20250929',
])];
// 새 세대 (예전 규칙이 놓치던 이름) — 공용 규칙이 가장 새 세대처럼 다룬다 (여기서는 같음을 보지 않음)
const FUTURE = new Set(['o5', 'o5-mini', 'gpt-7', 'gpt-7-mini', 'openai/gpt-7', 'claude-haiku-5', 'claude-haiku-5-5', 'anthropic/claude-haiku-5.5', 'claude-opus-6',
    'claude-sonnet-6', 'anthropic/claude-opus-6']);

// ---------- 1) 요청 본문
await test('요청 본문: 저장된 모델이면 예전 2.0.1 과 글자까지 같다 (공급자 8개 × 이름 × 온도 · 프록시 · Custom 주소 · Vertex)', () => {
    reset();
    let n = 0;
    const variants = [
        { temperature: 1, maxTokens: 4096 },
        { temperature: 0.35, maxTokens: 300, useReverseProxy: true, reverseProxyUrl: 'https://proxy.test/v1', reverseProxyPassword: 'pw' },
        { temperature: 0, maxTokens: 65536, useReverseProxy: true, reverseProxyUrl: '', reverseProxyPassword: 'pw' },
        { temperature: 2, maxTokens: 256, customUrl: 'https://own.test/v1//' },
    ];
    const oais = [
        { custom_url: `${ST_URL}/`, custom_include_body: 'top_k: 5', custom_exclude_body: 'logit_bias', custom_include_headers: 'X-H: 1', vertexai_auth_mode: 'express', vertexai_region: 'global', vertexai_express_project_id: 'p1' },
        { custom_url: '' },
    ];
    for (const provider of Object.keys(OLD_PROVIDERS)) {
        for (const id of [...IDS, 'custom']) {
            if (FUTURE.has(id)) continue;
            for (const v of variants) {
                for (const oai of oais) {
                    const settings = { connection: 'direct', provider, models: { [provider]: id }, customModels: { [provider]: ' typed-model ' }, customUrl: '', ...v };
                    T.ctx.chatCompletionSettings = { chat_completion_source: 'openai', ...oai };
                    const endpoint = oldEndpoint(settings, oai);
                    const want = generateBody(settings, oai, { resolve: () => oldResolveModel(settings), rules: oldApplyModelRequestRules, endpoint });
                    const got = generateBody(settings, oai, { resolve: () => RW.resolveModel(settings, provider === 'custom' ? endpoint : undefined), rules: LM.applyModelRequestRules, endpoint });
                    assert.equal(got, want, `${provider} ${id}`);
                    // index.js 는 resolveModel(settings, currentEndpoint()) — Custom 이 아니면 endpoint 없이도 같은 이름
                    assert.equal(RW.resolveModel(settings), oldResolveModel(settings), `resolveModel ${provider} ${id}`);
                    n++;
                }
            }
        }
    }
    assert.ok(n > 3000, `비교 ${n}개`);
});
await test('요청 규칙: 자기 사본은 없고 공용 applyModelRequestRules 만 쓴다 (새 세대 이름도 막힘 없이)', () => {
    assert.equal('applyModelRequestRules' in RW, false, 'providers.js 의 사본은 지움');
    assert.ok(!/function applyModelRequestRules/.test(INDEX) && !/function applyModelRequestRules/.test(PROVIDERS_SRC));
    assert.match(INDEX, /import \{[^}]*\bapplyModelRequestRules\b[^}]*\} from '\.\.\/\.\.\/live-models\.js';/);
    assert.match(INDEX, /applyModelRequestRules\(settings\.provider, model, request\);/);
    assert.match(INDEX, /const model = resolveModel\(settings, currentEndpoint\(\)\);/);
    const body = () => ({ model: 'x', temperature: 1, max_tokens: 100, stream: false });
    assert.deepEqual(LM.applyModelRequestRules('openai', 'gpt-7', body()), { model: 'x', stream: false, max_completion_tokens: 100 });
    assert.deepEqual(LM.applyModelRequestRules('openai', 'o5-mini', body()), { model: 'x', stream: false, max_completion_tokens: 100 });
    assert.deepEqual(LM.applyModelRequestRules('openrouter', 'anthropic/claude-opus-6', body()), { model: 'x', max_tokens: 100, stream: false });
    assert.deepEqual(LM.applyModelRequestRules('google', 'gemini-3.8-flash', body()), body(), "다시 쓰기의 'google' 키도 그대로 받음");
});

// ---------- 2) 목록
await test('PROVIDERS: 이름 · source · secrets 는 그대로, 고정 모델 목록은 없음', () => {
    assert.deepEqual(Object.keys(RW.PROVIDERS), Object.keys(OLD_PROVIDERS));
    for (const [id, p] of Object.entries(OLD_PROVIDERS)) {
        const { models, ...rest } = p;
        assert.deepEqual(RW.PROVIDERS[id], rest, id);
        assert.equal(RW.PROVIDERS[id].models, undefined, `${id} 고정 목록 없음`);
    }
    assert.equal(RW.sourceOf('google'), 'makersuite');
    assert.equal(RW.sourceOf('nope'), '');
    for (const p of ['openai', 'google', 'openrouter', 'deepseek', 'cohere', 'custom']) assert.equal(RW.canFetch(p), true, p);
    for (const p of ['claude', 'vertexai', 'nope']) assert.equal(RW.canFetch(p), false, p);
});
await test('받기 전: 모델 등록 → 최신 이름(KNOWN, 새것 먼저) · 목록을 받는 공급자는 실리태번 고정 목록으로 부풀리지 않음 · 예전 고정 목록에 없던 새 모델이 맨 위', () => {
    reset({ ext: { model_register: { sources: { openai: ['my-gpt'], claude: ['claude-x-registered'] } } } });
    pageSelects({ model_openai_select: ['my-gpt', 'gpt-6-sol', 'gpt-4-0613', 'babbage-002', 'whisper-1'], model_claude_select: ['claude-haiku-5', 'claude-3-opus-20240229', 'claude-sonnet-5-5'] });
    const openai = RW.modelChoices('openai', 'gpt-5.4-mini');
    assert.deepEqual(openai.ids.slice(0, 3), ['my-gpt', 'gpt-6.1-sol', 'gpt-6-astra']);
    assert.deepEqual(openai.ids, ['my-gpt', ...LM.KNOWN.openai], '모델 등록 + KNOWN 만 (실리태번의 긴 고정 목록 gpt-4-0613 … 은 안 붙임)');
    assert.equal(openai.live, false);
    assert.equal(openai.savedMissing, false);
    for (const id of ['gpt-6.1-sol', 'gpt-6-sol', 'gpt-6-luna']) assert.ok(openai.ids.includes(id) && !OLD_PROVIDERS.openai.models.includes(id), id);
    // Claude 는 목록을 받지 못하는 공급자: 모델 등록 · KNOWN · 화면 목록 (실리태번이 새로 넣은 이름도)
    const claude = RW.modelChoices('claude', 'claude-haiku-4-5');
    assert.deepEqual(claude.ids.slice(0, 3), ['claude-x-registered', 'claude-sonnet-5-5', 'claude-opus-5-5']);
    assert.ok(!claude.ids.includes('claude-3-opus-20240229'), '끝난 이름은 화면 목록에서도 뺌');
    assert.ok(claude.ids.includes('claude-haiku-5'), '실리태번 화면 목록의 새 이름');
    assert.equal(claude.key, 'claude');
    // Google 은 makersuite 목록
    assert.equal(RW.modelChoices('google', '').key, 'makersuite');
    assert.equal(RW.modelChoices('google', '').ids[0], 'gemini-3.8-flash');
    assert.deepEqual(RW.modelChoices('nope', 'x'), { ids: [], savedMissing: false, live: false, at: 0, key: '' });
});
await test('받은 뒤: 받은 목록(새것 먼저) + 모델 등록만 · 공급자가 안 주는 옛 이름은 붙이지 않음 · 저장된 모델은 그대로 표시', () => {
    reset({ ext: { model_register: { sources: { openrouter: ['my/route'] } } } });
    pageSelects({ model_openrouter_select: ['OR_Website', 'old/model'] });
    LM.put('openrouter', [{ id: 'anthropic/claude-sonnet-5.5', created: 30 }, { id: 'openai/gpt-6.1-sol', created: 29 }, { id: 'google/gemini-3.8-flash', created: 10 }]);
    const c = RW.modelChoices('openrouter', 'x-ai/grok-4.6');
    assert.deepEqual(c.ids, ['anthropic/claude-sonnet-5.5', 'openai/gpt-6.1-sol', 'google/gemini-3.8-flash', 'my/route']);
    assert.equal(c.live, true);
    assert.equal(c.savedMissing, true, '목록에 없는 저장된 모델');
    assert.equal(RW.pickModel('x-ai/grok-4.6', c.ids), 'x-ai/grok-4.6', '몰래 바꾸지 않음');
    assert.equal(RW.missingNote('openrouter', c.ids), '이전 목록');
    assert.equal(RW.modelChoices('openrouter', 'custom').savedMissing, false, "'custom' 은 직접 입력");
    assert.equal(RW.modelChoices('openrouter', 'openai/gpt-6.1-sol').savedMissing, false);
});
await test('화면의 select: 저장된 모델은 맨 앞에 골라 둠 (이전 목록 · 이 주소 목록에 없음) · 맨 끝 ⚙️ 커스텀 모델 입력', () => {
    reset();
    const mk = (tag) => ({ tag, value: '', textContent: '', selected: false });
    globalThis.document = { createDocumentFragment: () => ({ children: [], append(...n) { this.children.push(...n); } }), createElement: mk };
    const sel = { dataset: {}, children: [], replaceChildren(f) { this.children = f.children; } };
    // index.js renderModels 와 같은 옵션
    const fill = (provider, saved, ids) => {
        const picked = RW.pickModel(saved, ids);
        LM.fillSelect(sel, ids, { saved: picked, missingSuffix: ` (${RW.missingNote(provider, ids)})`, customValue: 'custom', customLabel: '⚙️ 커스텀 모델 입력', customSelected: picked === 'custom' });
        return sel.children.map(o => [o.value, o.textContent, o.selected]);
    };
    assert.deepEqual(fill('openai', 'gpt-old', ['gpt-6.1-sol']), [['gpt-old', 'gpt-old (이전 목록)', true], ['gpt-6.1-sol', 'gpt-6.1-sol', false], ['custom', '⚙️ 커스텀 모델 입력', false]]);
    assert.deepEqual(fill('custom', 'relay-old', ['relay-new']), [['relay-old', 'relay-old (이 주소 목록에 없음)', true], ['relay-new', 'relay-new', false], ['custom', '⚙️ 커스텀 모델 입력', false]]);
    assert.deepEqual(fill('custom', 'relay-old', []), [['relay-old', 'relay-old (이전 목록)', true], ['custom', '⚙️ 커스텀 모델 입력', false]], '목록이 없으면 이전 목록');
    assert.deepEqual(fill('custom', 'custom', ['relay-new']), [['relay-new', 'relay-new', false], ['custom', '⚙️ 커스텀 모델 입력', true]]);
    assert.deepEqual(fill('custom', '', []), [['custom', '⚙️ 커스텀 모델 입력', true]], '아무것도 없으면 직접 입력');
    assert.deepEqual(fill('openai', '', ['gpt-6.1-sol', 'gpt-6-sol']).map(x => x[2]), [true, false, false], '저장된 것이 없으면 목록의 첫 모델');
});
await test('resolveModel: 저장된 모델 → 목록의 첫 모델 → (직접 입력) → \'\' — 고정된 첫 모델로 가지 않음', () => {
    reset();
    assert.equal(RW.resolveModel({ provider: 'google', models: { google: 'gemini-3.7-flash' } }), 'gemini-3.7-flash');
    assert.equal(RW.resolveModel({ provider: 'custom', models: { custom: 'custom' }, customModels: { custom: ' gemini-3.8-flash ' } }), 'gemini-3.8-flash');
    assert.equal(RW.resolveModel({ provider: 'custom', models: {}, customModels: {} }), '');
    assert.equal(RW.resolveModel({ provider: 'nope', models: {} }), '');
    assert.equal(RW.resolveModel({ provider: 'claude', models: {} }), LM.KNOWN.claude[0]);
    assert.notEqual(RW.resolveModel({ provider: 'claude', models: {} }), OLD_PROVIDERS.claude.models[0], '예전 고정 첫 모델(claude-fable-5-1)이 아님');
    LM.put('openai', [{ id: 'gpt-6.1-sol-2026-09-29', created: 9 }, { id: 'gpt-6.1-sol', created: 8 }]);
    assert.equal(RW.resolveModel({ provider: 'openai', models: { openai: '' } }), 'gpt-6.1-sol-2026-09-29', '받은 목록의 첫 모델');
    assert.equal(RW.resolveModel({ provider: 'openai', models: { openai: 'gpt-retired' } }), 'gpt-retired', '목록에 없어도 저장된 것');
    // Custom: 우리 주소 · 본체 주소의 목록
    LM.put('custom:https://own.test/v1', ['own-a']);
    LM.put(`custom:${ST_URL}`, ['st-a']);
    assert.equal(RW.resolveModel({ provider: 'custom', models: {}, customUrl: 'https://own.test/v1/' }), 'own-a');
    assert.equal(RW.resolveModel({ provider: 'custom', models: {}, customUrl: '' }), 'st-a');
    assert.equal(RW.resolveModel({ provider: 'custom', models: {} }, { url: ST_URL, inheritExtras: true }), 'st-a');
});
await test('Custom 목록: 주소별 키 · 2.0.1 의 customModelLists · 번역기 목록도 읽음 (지우지 않음) · 본체 주소면 실리태번 Custom 목록도', () => {
    const lists = { 'https://own.test/v1': { models: ['b-model', 'a-model'], fetchedAt: '2026-10-06T00:00:00.000Z' } };
    reset({ ext: { ban_word_rewrite: { customModelLists: lists }, 'llm-translator-custom': { custom_model_lists: { [ST_URL]: { models: ['tr-1'], fetched_at: '2026-10-05T00:00:00.000Z' } } } } });
    const own = RW.endpointOf('https://own.test/v1/');
    assert.deepEqual(own, { url: 'https://own.test/v1', inheritExtras: false });
    assert.equal(RW.listKey('custom', own), 'custom:https://own.test/v1');
    assert.deepEqual(RW.modelChoices('custom', 'a-model', own).ids, ['b-model', 'a-model']);
    const st = { url: ST_URL, inheritExtras: true };
    assert.equal(RW.listKey('custom', st), `custom:${ST_URL}`);
    pageSelects({ model_custom_select: ['', 'st-page', 'custom'] });
    assert.deepEqual(RW.modelChoices('custom', '', st).ids, ['tr-1'], '받은 목록이 있으면 그것만');
    assert.deepEqual(RW.modelChoices('custom', '', own).ids, ['b-model', 'a-model'], '다른 주소는 본체 목록을 섞지 않음');
    reset();
    pageSelects({ model_custom_select: ['', 'st-page', 'custom'] });
    assert.deepEqual(RW.modelChoices('custom', '', st).ids, ['st-page'], '받기 전 본체 주소면 실리태번 Custom 목록');
    assert.deepEqual(RW.modelChoices('custom', '', own).ids, []);
    assert.equal(RW.modelChoices('custom', 'relay-x', own).savedMissing, true);
    assert.deepEqual(T.ext, {}, '읽기만');
});

// ---------- 3) 받기
await test('Custom /status: 2.0.1 과 같은 본문 · 주소 · 머리글 · no-cache · 새것 먼저 · localStorage 에만', async () => {
    reset({ ext: { ban_word_rewrite: { customModelLists: {}, models: {} } } });
    const before = JSON.stringify(T.ext);
    useFetch(() => ({ status: 200, body: { data: [{ id: 'old-model', created: 1700000000 }, { id: 'new-model', created: 1790000000 }, { id: 'custom' }, { id: 'old-model' }] } }));
    const seen = [];
    const off = LM.onChange((e) => seen.push(e.key));
    const own = RW.endpointOf('https://relay.test/v1/');
    const ids = await RW.fetchModelList('custom', { endpoint: own, includeHeaders: '', headers: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'tok' }) });
    off();
    assert.deepEqual(ids, ['new-model', 'old-model']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/backends/chat-completions/status');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.cache, 'no-cache');
    assert.deepEqual(calls[0].init.headers, { 'Content-Type': 'application/json', 'X-CSRF-Token': 'tok' });
    assert.equal(calls[0].raw, '{"chat_completion_source":"custom","custom_url":"https://relay.test/v1","custom_include_headers":""}');
    assert.deepEqual(seen, [RW.listKey('custom', own)], 'onChange 의 키 = 화면이 보는 키');
    assert.deepEqual(JSON.parse(globalThis.localStorage.data.bl_live_models_v1)['custom:https://relay.test/v1'].ids, ['new-model', 'old-model']);
    assert.equal(JSON.stringify(T.ext), before, 'settings.json(extension_settings) 에는 쓰지 않음');
    // 본체 주소: 본체의 추가 헤더를 같이 (예전과 같은 자리)
    useFetch(() => ({ status: 200, body: [{ id: 'st-model' }] }));
    await RW.fetchModelList('custom', { endpoint: { url: ST_URL, inheritExtras: true }, includeHeaders: '{X-H: 1}', headers: { a: 'b' } });
    assert.equal(calls[0].raw, `{"chat_completion_source":"custom","custom_url":"${ST_URL}","custom_include_headers":"{X-H: 1}"}`);
    assert.deepEqual(calls[0].init.headers, { a: 'b' });
    await assert.rejects(RW.fetchModelList('custom', { endpoint: RW.endpointOf('127.0.0.1:5001') }), /주소가 비어/);
    await assert.rejects(RW.fetchModelList('claude', {}), /받아 오지 않아요/);
    assert.equal(calls.length, 1);
});
await test('직접 공급자 /status: 실리태번 공급자 id 로 · 같은 목록은 한 번만 · 오류 문구 (시간 초과 · 서버 응답 · 키) · 실패해도 예전 목록', async () => {
    reset();
    useFetch(async () => { await new Promise(r => setTimeout(r, 5)); return { status: 200, body: { data: [{ id: 'gemini-3.8-flash' }, { id: 'gemini-3.8-flash-tts' }, { id: 'gemini-4-flash' }] } }; });
    const [a, b] = await Promise.all([RW.fetchModelList('google', { headers: {} }), RW.fetchModelList('google', { headers: {} })]);
    assert.equal(calls.length, 1, '같은 목록은 한 번만');
    assert.equal(a, b);
    assert.deepEqual(a, ['gemini-4-flash', 'gemini-3.8-flash'], '음성 모델 뺌 · 새것 먼저');
    assert.equal(calls[0].raw, '{"chat_completion_source":"makersuite"}');
    assert.equal(RW.modelChoices('google', '').ids[0], 'gemini-4-flash');
    useFetch(() => ({ status: 500, statusText: 'Internal Server Error', body: {} }));
    await assert.rejects(RW.fetchModelList('google', { headers: {} }), (e) => e.message === '서버 응답 500 Internal Server Error');
    useFetch(() => Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    await assert.rejects(RW.fetchModelList('google', { headers: {} }), (e) => e.message === '30초 안에 응답이 없어요');
    useFetch(() => ({ status: 200, body: { error: true, data: { data: [] } } }));
    await assert.rejects(RW.fetchModelList('google', { headers: {} }), (e) => e.message === '모델 목록을 돌려주지 않았어요. API 키를 확인해 주세요.');
    await assert.rejects(RW.fetchModelList('custom', { endpoint: RW.endpointOf('https://relay.test/v1'), headers: {} }),
        (e) => e.message === '엔드포인트가 모델 목록을 돌려주지 않았어요. 주소(끝의 /v1까지)와 API 키를 확인해 주세요.');
    assert.deepEqual(LM.cached('makersuite').ids, ['gemini-4-flash', 'gemini-3.8-flash'], '예전 목록 그대로');
});
await test('조용히 다시 받기: 하루 안이면 안 물음 · Claude/Vertex · 키 없음 · 잘못된 주소는 안 물음 · 저장된 Custom 주소는 물음 · 실패하면 기다림', async () => {
    reset();
    useFetch(() => ({ status: 200, body: { data: [{ id: 'm1' }] } }));
    assert.deepEqual(await RW.autoFetchModelList('openai', { headers: {} }), ['m1']);
    assert.equal(await RW.autoFetchModelList('openai', { headers: {} }), null, '하루 안');
    assert.equal(await RW.autoFetchModelList('claude', { headers: {} }), null);
    assert.equal(await RW.autoFetchModelList('vertexai', { headers: {} }), null);
    assert.equal(await RW.autoFetchModelList('deepseek', { headers: {} }), null, '키 없음');
    assert.equal(await RW.autoFetchModelList('custom', { endpoint: RW.endpointOf('nope'), headers: {} }), null);
    assert.equal(await RW.autoFetchModelList('custom', { endpoint: RW.endpointOf(''), headers: {} }), null, '주소가 없음');
    assert.equal(calls.length, 1);
    // 다시 쓰기의 Custom 주소: 5.7.1 받아 본 적이 있는 주소만 저절로 (방금 친 · 오타 난 주소로 저장된 키가 가지 않게 — 처음은 ↻)
    assert.equal(await RW.autoFetchModelList('custom', { endpoint: RW.endpointOf('https://saved.test/v1'), includeHeaders: '', headers: {} }), null);
    assert.equal(calls.length, 1);
    LM.put('custom:https://saved.test/v1', ['old'], { at: Date.now() - 2 * 24 * 3600e3 });
    assert.deepEqual(await RW.autoFetchModelList('custom', { endpoint: RW.endpointOf('https://saved.test/v1'), includeHeaders: '', headers: {} }), ['m1']);
    assert.equal(calls[1].raw, '{"chat_completion_source":"custom","custom_url":"https://saved.test/v1","custom_include_headers":""}');
    assert.deepEqual(await RW.autoFetchModelList('custom', { endpoint: { url: ST_URL, inheritExtras: true }, includeHeaders: '{X-H: 1}', headers: {} }), ['m1']);
    assert.equal(calls.length, 3);
    // 하루 지난 목록 → 다시
    LM.put('openai', ['gpt-old'], { at: Date.now() - DAY - 5 });
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-new' }] } }));
    assert.deepEqual(await RW.autoFetchModelList('openai', { headers: {} }), ['gpt-new']);
    // 실패 → null · 기다림 (중계 서버 429 보호) · 버튼은 바로
    useFetch(() => ({ status: 429, statusText: 'Too Many Requests', body: {} }));
    LM.put('cohere', ['c-old'], { at: Date.now() - DAY - 5 });
    assert.equal(await RW.autoFetchModelList('cohere', { headers: {} }), null);
    assert.equal(await RW.autoFetchModelList('cohere', { headers: {} }), null);
    assert.equal(calls.length, 1, '실패 뒤 기다리는 중');
    assert.deepEqual(LM.cached('cohere').ids, ['c-old']);
    useFetch(() => ({ status: 200, body: { models: [{ name: 'command-a-plus-05-2026', endpoints: ['chat'] }, { name: 'embed-v4.0', endpoints: ['embed'] }] } }));
    assert.deepEqual(await RW.fetchModelList('cohere', { headers: {} }), ['command-a-plus-05-2026'], '버튼은 기다림과 상관없음');
});
await test('불러오기 · 목록 · resolveModel 만으로는 통신하지 않음', () => {
    reset();
    let hits = 0;
    globalThis.fetch = async () => { hits++; throw new Error('x'); };
    for (const p of Object.keys(RW.PROVIDERS)) { RW.modelChoices(p, ''); RW.resolveModel({ provider: p, models: {} }); RW.listKey(p); }
    assert.equal(hits, 0);
});
await test('index.js 연결: 화면을 열 때 · 공급자를 바꿀 때만 조용히 · 목록이 오면 다시 그림 (고르는 중엔 미룸) · 2.0.1 의 settings 목록에 쓰지 않음', () => {
    assert.ok(!/customModelLists\[/.test(INDEX) && !/pruneModelLists|modelIdsFrom/.test(INDEX), 'settings.json 목록 쓰기 없음');
    assert.ok(!/PROVIDERS\[[^\]]+\]\??\.models/.test(INDEX), '고정 목록 읽기 없음');
    assert.equal('customModelLists' in DEFAULT_SETTINGS, false);
    assert.match(INDEX, /'목록 따라가기': \(\) => onModelListChange\(onModelListArrived\)/);
    assert.match(INDEX, /active\.id === 'bwr_model'/);
    assert.match(INDEX, /\$\('#bwr_model, #bwr_custom_model'\)\.on\('blur', renderPendingModels\)/);
    assert.match(INDEX, /\$\('#bwr_provider'\)\.on\('change', function \(\) \{\s*settings\.provider = String\(this\.value\);\s*renderModels\(\);\s*autoFetchModels\(\);/);
    assert.match(INDEX, /'모델 목록': \(\) => \(EMBEDDED \? autoFetchModels\(\) : /, '단독 서랍은 페이지를 열 때 묻지 않음');
    assert.match(INDEX, /customLabel: '⚙️ 커스텀 모델 입력'/);
    assert.match(INDEX, /missingSuffix: ` \(\$\{missingNote\(provider, ids\)\}\)`/);
});

await test('새로 설치할 때의 기본 모델 = 지금 세대 (KNOWN 에 있는 이름) · 저장해 둔 모델은 그대로', () => {
    assert.equal(DEFAULT_SETTINGS.models.claude, 'claude-haiku-5-5');
    for (const [p, id] of Object.entries(DEFAULT_SETTINGS.models)) if (p !== 'custom') assert.ok((LM.KNOWN[LM.sourceOf(p)] || []).includes(id), `${p} ${id}`);
    // 불러올 때: 저장된 models 가 기본값보다 앞 — 예전 기본값(claude-haiku-4-5)을 저장해 둔 사람은 그대로
    assert.match(INDEX, /stored\.models = \{ \.\.\.DEFAULT_SETTINGS\.models, \.\.\.stored\.models \};/);
});

console.log(`\nrewrite-models: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
