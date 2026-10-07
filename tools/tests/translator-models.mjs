// 번역 add-on 의 모델 고르기 (src/addons/translator/index.js) — 공용 모델 목록 src/live-models.js 를 쓰는 길
//   node tools/tests/translator-models.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// index.js 는 실리태번 모듈을 정적으로 읽어 node 에서 통째로 못 불러온다 → 모델 목록 함수들만 잘라 작은 DOM 흉내 · jQuery 흉내 위에서 돌린다.
// 실리태번 모듈(script.js · extensions.js · secrets.js · openai.js)은 data: 스텁으로. 네트워크 없음 (fetch 는 가짜 — 부른 것을 기록).
// 확인하는 것:
//   1) 모델별 요청 규칙: 예전(2.2.7) applyModelRequestRules 를 아래에 그대로 옮겨, 2026-10 까지의 이름 × 공급자 × 값 조합에서
//      번역 요청 본문(JSON 글자)이 같음. 새 세대 이름(o5 · gpt-7 · claude-opus-6 …)만 가장 새 세대처럼 바뀜
//   2) Custom 목록 요청 본문 · 헤더가 2.2.7 과 글자까지 같음 · settings.json(custom_model_lists)에 더 쓰지 않음 (옛 목록은 읽기만)
//   3) 고르기: 받은 목록 → 새것 먼저 · 없으면 모델 등록 → KNOWN(gpt-6.1-sol · claude-sonnet-5-5 …) · 저장된 모델은 '(이전 목록)' /
//      '(이 주소 목록에 없음)' 으로 그대로 고름 · ⚙️ 커스텀 모델 입력 · 자동완성 목록은 모든 공급자 · 같은 내용이면 다시 쓰지 않음
//   4) 받는 때: 모델 칸이 보일 때 · 공급자를 바꿀 때만 (없거나 하루 지났을 때 · 키가 있을 때 · 새로 친 주소 X) · 쓰는 중엔 다시 그리지 않음
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const indexPath = path.join(srcDir, 'addons/translator/index.js');
const source = fs.readFileSync(indexPath, 'utf8');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__translatorModelsTest = { ext: {}, ctx: { chatCompletionSettings: {}, onlineStatus: 'no_connection' }, handlers: {} };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const G = 'const T = globalThis.__translatorModelsTest;\n';
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
const lmUrl = pathToFileURL(path.join(srcDir, 'live-models.js')).href;
const LM = await import(lmUrl);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}

// ---------- index.js 에서 잘라 오기
function cut(name) {
    let start = -1;
    for (const head of [`\nfunction ${name}(`, `\nasync function ${name}(`]) {
        start = source.indexOf(head);
        if (start >= 0) break;
    }
    assert.ok(start >= 0, 'index.js 에 없음: ' + name);
    let depth = 0;
    for (let j = source.indexOf(') {', start) + 2; j < source.length; j++) {
        const ch = source[j];
        if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return source.slice(start + 1, j + 1);
    }
    throw new Error('짝이 안 맞음 ' + name);
}
function cutDecl(name) {
    const m = source.match(new RegExp(`^(?:const|let) ${name}\\b[^\\n]*$`, 'm'));
    assert.ok(m, 'index.js 에 없음: ' + name);
    return m[0];
}
/** initializeEventHandlers 안의 LiveModels.onChange(...) 한 덩어리 */
function cutOnChange() {
    const start = source.indexOf('LiveModels.onChange(');
    assert.ok(start >= 0, 'onChange 연결이 없음');
    let depth = 0;
    for (let j = start; j < source.length; j++) {
        const ch = source[j];
        if (ch === '(') depth++;
        else if (ch === ')' && --depth === 0) return source.slice(start, j + 1) + ';';
    }
    throw new Error('짝이 안 맞음 onChange');
}
const FUNCS = ['normalizeCustomUrl', 'isValidHttpUrl', 'getCustomModelName', 'getCustomEndpointConfig', 'translatorModelList', 'translatorListProxy', 'modelListKey', 'customListBody',
    'modelListRequest', 'modelListErrorMessage', 'updateCustomModelsStatus', 'syncCustomFetchButton', 'syncModelRefreshButton', 'modelPickerInUse',
    'renderModelListWhenIdle', 'afterCustomModelList', 'fetchCustomModelList', 'refreshProviderModelList', 'autoRefreshModels', 'modelPickerShown',
    'fillModelDatalist', 'updateModelList', 'getProviderSpecificParams'];
const DECLS = ['MODEL_LIST_TIMEOUT_MS', 'LIST_PROXY_SOURCES', 'customModelFetches', 'manualModelRefreshes', 'typedCustomUrls', 'pendingModelRender', 'pendingRenderTimer', 'customStatusOwner', 'lastRenderedCustomUrl'];

// ---------- 작은 DOM · jQuery 흉내
class El {
    constructor(tag, id = '') {
        this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this.dataset = {}; this.style = {};
        this.textContent = ''; this._value = ''; this.selected = false; this.disabled = false; this.classes = new Set(); this.shown = true; this.writes = 0;
    }
    append(...nodes) { for (const n of nodes) { if (n.isFrag) this.children.push(...n.children); else this.children.push(n); } }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); this.writes++; }
    get options() { return this.children; }
    get value() {
        if (this.tagName !== 'SELECT') return this._value;
        const o = this.children.find(c => c.selected) || this.children[0];
        return o ? o.value : '';
    }
    set value(v) {
        if (this.tagName !== 'SELECT') { this._value = String(v); return; }
        let hit = false;
        for (const o of this.children) { o.selected = !hit && o.value === v; if (o.selected) hit = true; }
    }
    querySelector(sel) { return this.children.find(c => c.tagName.toLowerCase() === sel) || null; }
    getClientRects() { return this.shown ? [{}] : []; }
}
const doc = {
    byId: {}, activeElement: null, pickLayer: null,
    querySelector(sel) { return sel === '.salty-pick-layer' ? this.pickLayer : null; },
    getElementById(id) { return this.byId[id] || null; },
    createDocumentFragment() { const f = new El('#fragment'); f.isFrag = true; return f; },
    createElement(tag) { return new El(tag); },
};
globalThis.document = doc;
function $(sel) {
    const els = String(sel).split(',').map(s => doc.byId[s.trim().replace(/^#/, '')]).filter(Boolean);
    const api = {
        length: els.length,
        val(v) { if (v === undefined) return els[0]?.value; els.forEach(e => { e.value = v; }); return api; },
        text(t) { if (t === undefined) return els[0]?.textContent; els.forEach(e => { e.textContent = String(t); }); return api; },
        show() { els.forEach(e => { e.style.display = ''; }); return api; },
        hide() { els.forEach(e => { e.style.display = 'none'; }); return api; },
        prop(k, v) { els.forEach(e => { e[k] = v; }); return api; },
        toggleClass(c, on) { els.forEach(e => (on ? e.classes.add(c) : e.classes.delete(c))); return api; },
    };
    return api;
}
function buildDom({ provider = 'openai', page = {} } = {}) {
    doc.byId = {};
    doc.activeElement = null;
    doc.pickLayer = null;
    const add = (tag, id) => (doc.byId[id] = new El(tag, id));
    add('input', 'llm_provider').value = provider;
    add('select', 'llm_model');
    add('datalist', 'llm_custom_model_datalist');
    add('div', 'custom_model_container');
    add('input', 'llm_custom_model');
    const refresh = add('button', 'llm_model_refresh');
    refresh.append(new El('i'));
    refresh.style.display = 'none';
    add('small', 'llm_custom_models_status');
    add('button', 'llm_custom_fetch_models');
    for (const [id, values] of Object.entries(page)) {
        const sel = add('select', id);
        for (const v of values) { const o = new El('option'); o.value = v; sel.children.push(o); }
    }
}

// ---------- 잘라 온 함수들을 모듈로
const settings = {};
T.ext['llm-translator-custom'] = settings;
const module = `import * as LiveModels from ${JSON.stringify(lmUrl)};
const H = globalThis.__translatorHarness;
const $ = H.$;
const extensionSettings = H.settings;
const substituteParams = (t) => '{' + String(t ?? '') + '}';
const saveSettingsDebounced = () => { H.saves++; };
const toastr = { success: (m) => H.toasts.push(['success', m]), warning: (m) => H.toasts.push(['warning', m]), error: (m) => H.toasts.push(['error', m]) };
const console = { error() {}, warn() {}, log() {} };
let oai_settings = H.oai();
export function setOai(o) { oai_settings = o; }
${DECLS.map(cutDecl).join('\n')}
${FUNCS.map(cut).join('\n\n')}
export function bindOnChange() { ${cutOnChange()} }
export const api = { translatorModelList, modelListKey, modelListRequest, modelListErrorMessage, updateCustomModelsStatus, fetchCustomModelList,
    refreshProviderModelList, autoRefreshModels, updateModelList, renderModelListWhenIdle, getProviderSpecificParams, modelPickerShown,
    typedCustomUrls, customModelFetches, pending: () => pendingModelRender };
`;
const H = globalThis.__translatorHarness = { $, settings, saves: 0, toasts: [], oai: () => T.ctx.chatCompletionSettings };
const file = path.join(os.tmpdir(), `llmt-models-${process.pid}.mjs`);
fs.writeFileSync(file, module);
let M;
try { M = await import(pathToFileURL(file).href); } finally { fs.unlinkSync(file); }
const A = M.api;
M.bindOnChange();

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
        calls.push({ url, method: init?.method, headers: init?.headers, raw: init?.body, body: init?.body ? JSON.parse(init.body) : undefined, cache: init?.cache });
        const r = await reply(url, init?.body ? JSON.parse(init.body) : undefined);
        return { ok: r.status >= 200 && r.status < 300, status: r.status, text: async () => JSON.stringify(r.body), json: async () => r.body };
    };
}
const SECRET = (on) => (on ? [{ id: 'k1', value: '***', label: 'x', active: true }] : null);
const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_HISTORY = { openai: 'gpt-5.4-mini', claude: 'claude-sonnet-5', google: 'gemini-3.7-flash', cohere: 'command-a-03-2025',
    vertexai: 'gemini-3.7-flash', openrouter: 'google/gemini-3.5-flash-lite', deepseek: 'deepseek-flash', custom: 'custom' };
function reset({ provider = 'openai', s = {}, cs = {}, keys = {}, ext = {}, storage = {}, page = {} } = {}) {
    globalThis.localStorage = fakeStorage(storage);
    for (const k of Object.keys(T.ext)) if (k !== 'llm-translator-custom') delete T.ext[k];
    Object.assign(T.ext, ext);
    for (const k of Object.keys(settings)) delete settings[k];
    Object.assign(settings, {
        connection_mode: 'direct', llm_provider: provider, llm_model: DEFAULT_HISTORY[provider], provider_model_history: { ...DEFAULT_HISTORY },
        custom_models: {}, custom_url: '', custom_model_lists: {}, use_reverse_proxy: false, reverse_proxy_url: '', reverse_proxy_password: '',
    }, structuredClone(s));
    T.ctx.chatCompletionSettings = { chat_completion_source: 'openai', custom_url: 'http://127.0.0.1:5001/v1/', custom_include_headers: 'X-H: 1', reverse_proxy: '', proxy_password: '', ...cs };
    M.setOai(T.ctx.chatCompletionSettings);
    secrets.setSecretState({ api_key_openai: SECRET(true), api_key_openrouter: SECRET(true), api_key_claude: SECRET(true), api_key_deepseek: SECRET(false),
        api_key_makersuite: SECRET(true), api_key_cohere: SECRET(false), api_key_vertexai: SECRET(true), ...keys });
    LM._resetForTest();
    A.typedCustomUrls.clear();
    A.customModelFetches.clear();
    H.saves = 0; H.toasts.length = 0;
    buildDom({ provider, page });
    useFetch(() => ({ status: 200, body: { data: [] } }));
}
const optionRows = () => doc.byId.llm_model.children.map(o => [o.value, o.textContent, !!o.selected]);
const optionValues = () => doc.byId.llm_model.children.map(o => o.value);
const flush = () => new Promise(r => setTimeout(r, 0));

// ---------- 1) 모델별 요청 규칙: 2.2.7 그대로 (2026-10-07 판, index.js 에서 지운 것)
function oldTranslatorRules(provider, model, parameters) {
    const dropSampling = (...keys) => keys.forEach(key => delete parameters[key]);
    const useMaxCompletionTokens = () => {
        // OpenRouter는 max_tokens를 알아서 변환하므로 OpenAI 직접 연결에서만 바꾼다.
        if (provider === 'openai' && parameters.max_tokens !== undefined) {
            parameters.max_completion_tokens = parameters.max_tokens;
            delete parameters.max_tokens;
        }
    };

    if ((provider === 'openai' && /^(o1|o3|o4)/.test(model)) || (provider === 'openrouter' && /^openai\/(o1|o3|o4)/.test(model))) {
        useMaxCompletionTokens();
        dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }

    // GPT-5 이후(GPT-6 포함): 추론 모드에서는 샘플링 값을 거부한다. GPT-5.1~5.4는 페널티만 거부한다.
    if ((provider === 'openai' || provider === 'openrouter') && /gpt-(5|6)/.test(model)) {
        useMaxCompletionTokens();
        if (/gpt-5-chat-latest/.test(model)) {
            // 채팅 전용 모델은 샘플링 값을 그대로 받는다.
        } else if (/gpt-5\.(1|2|3|4)/.test(model) && !/chat-latest/.test(model)) {
            dropSampling('frequency_penalty', 'presence_penalty');
        } else {
            dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
        }
    }

    // Claude Fable / Claude 5: 샘플링 값을 모두 거부한다 (OpenRouter 등 프록시 경유 포함).
    if (/claude-(fable|opus-5|sonnet-5)/.test(model)) {
        dropSampling('temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty');
    }
}
// 2.2.7 의 고정 목록 (index.js updateModelList 에 있던 것)
const OLD_LISTS = {
    gemini: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite',
        'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    openai: ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.3-chat-latest', 'gpt-5.2',
        'gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3', 'gpt-4o', 'gpt-4o-mini'],
    claude: ['claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5', 'claude-fable-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6',
        'claude-sonnet-4-6', 'claude-opus-4-5', 'claude-sonnet-4-5'],
    cohere: ['command-a-plus-05-2026', 'command-a-03-2025', 'command-r7b-12-2024', 'command-r-plus-08-2024', 'command-r-08-2024', 'c4ai-aya-expanse-32b', 'c4ai-aya-expanse-8b'],
    openrouter: ['google/gemini-3.8-flash', 'google/gemini-3.7-flash', 'google/gemini-3.5-flash-lite', 'google/gemini-3.1-pro-preview', 'google/gemini-2.5-pro',
        'anthropic/claude-fable-5.1', 'anthropic/claude-opus-5', 'anthropic/claude-sonnet-5', 'anthropic/claude-haiku-4.5', 'openai/gpt-6-astra', 'openai/gpt-5.6-terra',
        'openai/gpt-5.6-luna', 'deepseek/deepseek-v4.1-flash', 'deepseek/deepseek-v4-pro', 'x-ai/grok-4.6', 'qwen/qwen3.8-max-0902', 'moonshotai/kimi-k3', 'z-ai/glm-5.3',
        'mistralai/mistral-medium-3-5'],
    deepseek: ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-v4-flash'],
};
// 실리태번 1.19 index.html 의 OpenAI · Claude · Google · Cohere 목록과 그 밖의 2026-10 이름 · 이상한 이름
const ST_IDS = ['gpt-6-sol', 'gpt-6-luna', 'gpt-5.5-2026-04-23', 'gpt-5.4-2026-03-05', 'gpt-5.4-mini-2026-03-17', 'gpt-5.4-nano-2026-03-17', 'gpt-5.2-2025-12-11',
    'gpt-5.2-chat-latest', 'gpt-5.1-2025-11-13', 'gpt-5.1-chat-latest', 'gpt-5-2025-08-07', 'gpt-5-chat-latest', 'gpt-5-mini-2025-08-07', 'gpt-5-nano-2025-08-07',
    'gpt-4.1-2025-04-14', 'gpt-4.1-mini-2025-04-14', 'gpt-4.1-nano-2025-04-14', 'o4-mini-2025-04-16', 'o3-2025-04-16', 'o3-mini', 'o3-mini-2025-01-31', 'o1',
    'o1-2024-12-17', 'o1-preview', 'o1-mini', 'o3-pro', 'o4-mini-high', 'gpt-4o-2024-11-20', 'gpt-4o-2024-08-06', 'gpt-4o-2024-05-13', 'gpt-4o-mini-2024-07-18',
    'chatgpt-4o-latest', 'gpt-4-turbo', 'gpt-4-turbo-2024-04-09', 'gpt-4', 'gpt-4-0613', 'gpt-4.5-preview', 'gpt-3.5-turbo', 'gpt-3.5-turbo-0125', 'gpt-35-turbo',
    'gpt-oss-120b', 'gpt-oss-20b', 'gpt-5.1-codex', 'gpt-5-pro', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-opus-4-5-20251101', 'claude-sonnet-4-5-20250929',
    'claude-haiku-4-5-20251001', 'claude-opus-4-0', 'claude-opus-4-20250514', 'claude-sonnet-4-0', 'claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest',
    'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-latest', 'claude-3-opus-20240229', 'claude-opus-45', 'claude-instant-1.2', 'gemini-3.1-flash-image',
    'gemini-3-pro-image', 'gemini-2.5-flash-image', 'gemini-2.0-flash-001', 'gemini-2.0-flash', 'gemini-2.0-flash-lite-001', 'gemini-2.0-flash-lite', 'gemini-15',
    'gemini-1.5-pro', 'gemma-4-31b-it', 'gemma-3-27b-it', 'learnlm-2.0-flash-experimental', 'gemini-robotics-er-1.5-preview', 'c4ai-aya-23-8b', 'c4ai-aya-23',
    'c4ai-aya-vision-32b', 'command-light', 'command', 'command-r', 'command-r-plus', 'command-a-vision-07-2025', 'command-nightly', 'deepseek-chat',
    'deepseek-reasoner', 'deepseek-r1', 'grok-4.7', 'grok-4', 'glm-5.3-prime', 'glm-5.3', 'kimi-k3', 'qwen3.8-max-prime', 'mistral-large-4-0', 'mistral-large-latest',
    'MiniMax-M2.7', 'MiniMax-M2.5', 'llama-3.3-70b-versatile', 'custom', '', ' gpt-5 ', 'GPT-5', 'my-relay/gpt-6-sol', 'vendor/claude-sonnet-5-5-thinking'];
const PROVIDERS = ['openai', 'claude', 'google', 'cohere', 'vertexai', 'openrouter', 'deepseek', 'custom'];
function allExistingIds() {
    const base = [...Object.values(OLD_LISTS).flat(), ...Object.values(LM.KNOWN).flat(), ...ST_IDS];
    const vendor = (id) => (/^(gpt|o\d|chatgpt)/.test(id) ? 'openai/' : /^claude/.test(id) ? 'anthropic/' : /^(gemini|gemma)/.test(id) ? 'google/' : /^command/.test(id) ? 'cohere/' : '');
    return [...new Set([...base, ...base.map(id => vendor(id) + id).filter(id => id.includes('/'))])];
}
// index.js callLLMAPI 가 만드는 본문 (규칙 앞까지) — getProviderSpecificParams 는 index.js 에서 잘라 온 것
function translatorBody(provider, model, params, maxTokens) {
    const chatCompletionSource = provider === 'google' ? 'makersuite' : provider;
    const parameters = { model, messages: [{ role: 'user', content: 'x' }], temperature: params.temperature, stream: false, chat_completion_source: chatCompletionSource, ...A.getProviderSpecificParams(provider, params) };
    if (maxTokens > 0) parameters.max_tokens = maxTokens;
    return parameters;
}
const PARAMS = { temperature: 0.7, top_p: 0.9, top_k: 40, frequency_penalty: 0.2, presence_penalty: 0.1, max_length: 1000 };

await test('요청 규칙: 지운 2.2.7 함수와 번역 요청 본문이 글자까지 같음 (2026-10 까지의 이름 × 공급자 × max_tokens 유무)', () => {
    const ids = allExistingIds();
    assert.ok(ids.length > 300, `이름 ${ids.length}개`);
    let n = 0;
    for (const provider of PROVIDERS) {
        for (const model of ids) {
            for (const maxTokens of [0, 1000]) {
                const before = translatorBody(provider, model, PARAMS, maxTokens);
                const after = translatorBody(provider, model, PARAMS, maxTokens);
                oldTranslatorRules(provider, model, before);
                LM.applyModelRequestRules(provider, model, after);
                assert.equal(JSON.stringify(after), JSON.stringify(before), `${provider} ${model} ${maxTokens}`);
                n++;
            }
        }
    }
    assert.ok(n > 5000, `${n}가지`);
});
await test('요청 규칙: 새 세대 이름만 가장 새 세대처럼 (o5 · gpt-7 · claude-opus-6 · claude-haiku-5)', () => {
    const run = (provider, model) => { const b = translatorBody(provider, model, PARAMS, 1000); LM.applyModelRequestRules(provider, model, b); return b; };
    const o5 = run('openai', 'o5-mini');
    assert.equal(o5.max_completion_tokens, 1000); assert.equal('max_tokens' in o5, false); assert.equal('temperature' in o5, false);
    const gpt7 = run('openrouter', 'openai/gpt-7');
    assert.equal('temperature' in gpt7, false); assert.equal(gpt7.max_tokens, 1000, 'OpenRouter 는 max_tokens 그대로');
    for (const model of ['claude-opus-6', 'claude-haiku-5', 'anthropic/claude-sonnet-6']) {
        const b = run(model.includes('/') ? 'openrouter' : 'claude', model);
        assert.equal('temperature' in b || 'top_p' in b || 'top_k' in b, false, model);
    }
});
await test('index.js: 자기 규칙 함수는 없고 공용 함수를 부름 · 페이지를 열 때(loadSettings) 목록을 받지 않음', () => {
    assert.equal(/\nfunction applyModelRequestRules\(/.test(source), false, '지역 사본이 남아 있음');
    assert.ok(source.includes('LiveModels.applyModelRequestRules(provider, model, parameters);'));
    assert.ok(source.includes("import * as LiveModels from '../../live-models.js';"));
    const load = cut('loadSettings');
    assert.equal(/autoRefreshModels\(|fetchCustomModelList\(|LiveModels\.(refresh|autoRefresh)\(/.test(load), false, 'loadSettings 에서 받기');
    assert.equal(/'gpt-6-astra'|'claude-fable-5-1'|'command-a-03-2025'|'deepseek-v4-pro'/.test(cut('updateModelList')), false, '고정 목록이 남아 있음');
    assert.equal(/custom_model_lists\[[^\]]+\]\s*=/.test(source), false, 'settings.json 에 목록을 씀');
});

// ---------- 2) 고르기
await test('목록을 받기 전: 모델 등록 → KNOWN(새것 먼저, gpt-6.1-sol) · 저장된 모델 그대로 고름 · ⚙️ 커스텀 모델 입력 · 자동완성 · ↻ 보임', () => {
    reset({ provider: 'openai', ext: { model_register: { sources: { openai: ['my-gpt'] }, picks: {} } }, page: { model_openai_select: ['gpt-3.5-turbo', 'gpt-6-astra'] } });
    A.updateModelList();
    const values = optionValues();
    assert.deepEqual(values.slice(0, 3), ['my-gpt', 'gpt-6.1-sol', 'gpt-6-astra']);
    assert.equal(values.includes('gpt-3.5-turbo'), false, '목록을 받을 수 있는 공급자는 실리태번의 긴 고정 목록을 붙이지 않음');
    assert.equal(values.at(-1), 'custom');
    assert.equal(doc.byId.llm_model.children.at(-1).textContent, '⚙️ 커스텀 모델 입력');
    assert.equal(doc.byId.llm_model.value, 'gpt-5.4-mini');
    assert.equal(settings.llm_model, 'gpt-5.4-mini');
    assert.deepEqual(doc.byId.llm_custom_model_datalist.children.map(o => o.value), values.slice(0, -1), 'OpenAI 도 자동완성');
    assert.equal(doc.byId.llm_model_refresh.style.display, '');
    assert.equal(doc.byId.custom_model_container.style.display, 'none');
});
await test('저장된 모델이 목록에 없으면 "(이전 목록)" 으로 맨 위에 두고 고른 채 — 저장값은 그대로', () => {
    reset({ provider: 'openai', s: { llm_model: 'gpt-4-legacy', provider_model_history: { openai: 'gpt-4-legacy' } } });
    A.updateModelList();
    assert.deepEqual(optionRows()[0], ['gpt-4-legacy', 'gpt-4-legacy (이전 목록)', true]);
    assert.equal(doc.byId.llm_model.value, 'gpt-4-legacy');
    assert.equal(settings.provider_model_history.openai, 'gpt-4-legacy');
    assert.equal(settings.llm_model, 'gpt-4-legacy');
    // 받은 목록이 생겨도 그대로
    LM.put('openai', [{ id: 'gpt-6.1-sol', created: 3 }, { id: 'gpt-6-sol', created: 2 }]);
    A.updateModelList();
    assert.deepEqual(optionValues(), ['gpt-4-legacy', 'gpt-6.1-sol', 'gpt-6-sol', 'custom']);
    assert.equal(settings.provider_model_history.openai, 'gpt-4-legacy');
});
await test('받은 목록이 있으면 그 목록(새것 먼저) + 모델 등록만 — 공급자가 안 주는 이름으로 부풀리지 않음', () => {
    reset({ provider: 'openrouter', ext: { model_register: { sources: { openrouter: ['me/my-model'] }, picks: {} } } });
    LM.put('openrouter', [{ id: 'openai/gpt-6.1-sol', created: 31 }, { id: 'anthropic/claude-sonnet-5.5', created: 30 }, { id: 'x/batch:batch', created: 99 }]);
    A.updateModelList();
    assert.deepEqual(optionValues(), ['google/gemini-3.5-flash-lite', 'openai/gpt-6.1-sol', 'anthropic/claude-sonnet-5.5', 'me/my-model', 'custom']);
    assert.equal(optionRows()[0][1], 'google/gemini-3.5-flash-lite (이전 목록)');
});
await test('Google AI → 실리태번 makersuite 목록 · Claude / Vertex AI (목록을 못 받음) → KNOWN + 실리태번 화면 목록 · ↻ 숨김', () => {
    reset({ provider: 'google' });
    LM.put('makersuite', ['gemini-3.9-flash', 'gemini-3.8-flash']);
    A.updateModelList();
    assert.deepEqual(optionValues(), ['gemini-3.7-flash', 'gemini-3.9-flash', 'gemini-3.8-flash', 'custom']);
    assert.equal(A.modelListKey('google'), 'makersuite');
    assert.equal(doc.byId.llm_model_refresh.style.display, '');
    reset({ provider: 'claude', page: { model_claude_select: ['claude-opus-5-5', 'claude-opus-4-20250514'] } });
    A.updateModelList();
    const values = optionValues();
    assert.deepEqual(values.slice(0, 2), ['claude-sonnet-5-5', 'claude-opus-5-5']);
    assert.ok(values.includes('claude-opus-4-20250514'), '실리태번 화면 목록');
    assert.equal(doc.byId.llm_model.value, 'claude-sonnet-5');
    assert.equal(doc.byId.llm_model_refresh.style.display, 'none');
    assert.equal(A.modelListRequest('claude'), null);
    assert.equal(A.modelListRequest('vertexai'), null);
});
await test('⚙️ 커스텀 모델 입력을 고른 채면 그대로 · 같은 내용이면 다시 쓰지 않음 (폰에서 깜빡이지 않게)', () => {
    reset({ provider: 'deepseek', s: { llm_model: 'custom', provider_model_history: { deepseek: 'custom' }, custom_models: { deepseek: 'deepseek-v5-preview' } } });
    A.updateModelList();
    assert.equal(doc.byId.llm_model.value, 'custom');
    assert.equal(doc.byId.custom_model_container.style.display, '');
    assert.equal(doc.byId.llm_custom_model.value, 'deepseek-v5-preview');
    const writes = doc.byId.llm_model.writes;
    const listWrites = doc.byId.llm_custom_model_datalist.writes;
    A.updateModelList();
    assert.equal(doc.byId.llm_model.writes, writes);
    assert.equal(doc.byId.llm_custom_model_datalist.writes, listWrites);
});
await test('Custom: 옛 custom_model_lists 를 읽음 (지우지 않음) · 저장된 모델이 없으면 "(이 주소 목록에 없음)" · 상태 문구', () => {
    const lists = { 'https://relay.test/v1': { models: ['zeta-1', 'alpha-2'], fetched_at: new Date(Date.now() - 1000).toISOString() } };
    reset({ provider: 'custom', s: { custom_url: 'https://relay.test/v1/', custom_model_lists: lists, provider_model_history: { custom: 'other-model' } } });
    const before = JSON.stringify(settings.custom_model_lists);
    A.updateModelList();
    assert.deepEqual(optionRows()[0], ['other-model', 'other-model (이 주소 목록에 없음)', true]);
    assert.deepEqual(optionValues().slice(1), ['zeta-1', 'alpha-2', 'custom']);
    assert.match(doc.byId.llm_custom_models_status.textContent, /^모델 2개 \(.+ 기준, 위 주소\)$/);
    assert.equal(JSON.stringify(settings.custom_model_lists), before);
    // 목록을 아직 안 받은 주소는 "(이전 목록)"
    reset({ provider: 'custom', s: { custom_url: 'https://new.test/v1', provider_model_history: { custom: 'other-model' } } });
    A.updateModelList();
    assert.deepEqual(optionRows()[0], ['other-model', 'other-model (이전 목록)', true]);
    assert.match(doc.byId.llm_custom_models_status.textContent, /^아직 불러오지 않았습니다/);
});

// ---------- 3) 받기
await test('Custom 목록 요청: 본문 · 헤더가 2.2.7 과 글자까지 같음 (자기 주소 · 본체 주소) · localStorage 에만 두고 settings.json 은 그대로', async () => {
    // 2.2.7 requestCustomModelIds 가 만들던 본문
    const oldBody = (url, inherit, oai) => JSON.stringify({ chat_completion_source: 'custom', custom_url: url, custom_include_headers: inherit ? '{' + (oai.custom_include_headers || '') + '}' : '' });
    reset({ provider: 'custom', s: { custom_url: 'https://relay.test/v1/' } });
    useFetch(() => ({ status: 200, body: { data: [{ id: 'm-1', created: 1 }, { id: 'custom' }, { id: 'm-2', created: 2 }] } }));
    const ids = await A.fetchCustomModelList({ silent: false });
    assert.deepEqual(ids, ['m-2', 'm-1'], "새것 먼저 · 'custom' 은 뺌");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/backends/chat-completions/status');
    assert.equal(calls[0].method, 'POST');
    assert.equal(calls[0].cache, 'no-cache');
    assert.deepEqual(calls[0].headers, { 'Content-Type': 'application/json', 'X-CSRF-Token': 'tok' });
    assert.equal(calls[0].raw, oldBody('https://relay.test/v1', false, T.ctx.chatCompletionSettings));
    assert.deepEqual(settings.custom_model_lists, {}, 'settings.json 에 쓰지 않음');
    assert.deepEqual(JSON.parse(globalThis.localStorage.data[LM.STORE_KEY])['custom:https://relay.test/v1'].ids, ['m-2', 'm-1']);
    assert.deepEqual(H.toasts, [['success', '모델 2개를 불러왔습니다.']]);
    assert.deepEqual(optionValues(), ['m-2', 'm-1', 'custom']);
    // 본체 주소를 물려받을 때: 본체 추가 헤더 (매크로 치환)
    reset({ provider: 'custom', cs: { custom_url: 'http://127.0.0.1:5001/v1/', custom_include_headers: 'X-H: {{user}}' } });
    useFetch(() => ({ status: 200, body: [{ id: 'local-1' }] }));
    await A.fetchCustomModelList({ silent: false });
    assert.equal(calls[0].raw, oldBody('http://127.0.0.1:5001/v1', true, T.ctx.chatCompletionSettings));
    assert.match(doc.byId.llm_custom_models_status.textContent, /본체 설정 주소/);
});
await test('Custom 받기 실패: 2.2.7 문구 · 예전 목록 그대로 · 적어 둔 모델명이 목록에 있으면 그 항목으로 (보내는 이름은 같음)', async () => {
    reset({ provider: 'custom', s: { custom_url: 'https://relay.test/v1', provider_model_history: { custom: 'custom' }, llm_model: 'custom', custom_models: { custom: 'm-9' } } });
    LM.put('custom:https://relay.test/v1', ['m-1']);
    useFetch(() => ({ status: 200, body: { error: true } }));
    const ids = await A.fetchCustomModelList({ silent: false });
    assert.deepEqual(ids, []);
    assert.equal(H.toasts[0][0], 'error');
    assert.match(H.toasts[0][1], /엔드포인트가 모델 목록을 돌려주지 않았습니다/);
    assert.match(doc.byId.llm_custom_models_status.textContent, /^불러오기 실패: 엔드포인트가/);
    assert.deepEqual(LM.cached('custom:https://relay.test/v1').ids, ['m-1'], '예전 목록 그대로');
    useFetch(() => ({ status: 200, body: { data: [{ id: 'm-9' }, { id: 'm-1' }] } }));
    await A.fetchCustomModelList({ silent: false });
    assert.equal(settings.provider_model_history.custom, 'm-9');
    assert.equal(settings.llm_model, 'm-9');
    assert.equal(doc.byId.llm_model.value, 'm-9');
    assert.equal(A.modelListErrorMessage(Object.assign(new Error('x'), { name: 'AbortError' }), true), '응답 시간이 초과되었습니다. (30초)');
});
await test('Custom: 저절로 받는 중에 버튼을 누르면 같은 요청 하나를 같이 기다리고, 실패하면 이유를 알려 줌', async () => {
    reset({ provider: 'custom', s: { custom_url: 'https://relay.test/v1' } });
    let release;
    useFetch(() => new Promise(r => { release = () => r({ status: 502, body: {} }); }));
    const auto = A.fetchCustomModelList({ silent: true });
    const manual = A.fetchCustomModelList({ silent: false });
    assert.equal(doc.byId.llm_custom_fetch_models.disabled, true);
    await flush(); release();
    await Promise.all([auto, manual]);
    assert.equal(calls.length, 1, '요청은 하나');
    assert.equal(H.toasts.length, 1);
    assert.equal(H.toasts[0][0], 'error');
    assert.match(H.toasts[0][1], /502/);
    assert.equal(doc.byId.llm_custom_fetch_models.disabled, false);
    assert.match(doc.byId.llm_custom_models_status.textContent, /^불러오기 실패/);
});
await test('저절로 받기: 없거나 하루 지났을 때만 · 키가 없으면 · Claude 는 안 받음 · 새로 친 주소는 안 받음 · 본체 주소 · 받은 적 있는 주소는 받음', async () => {
    reset({ provider: 'openai' });
    LM.put('openai', ['gpt-6.1-sol']);
    A.autoRefreshModels(); await flush();
    assert.equal(calls.length, 0, '하루 안 지남');
    LM.put('openai', ['gpt-6.1-sol'], { at: Date.now() - DAY - 1000 });
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-6.1-sol', created: 4 }, { id: 'text-embedding-4' }, { id: 'gpt-6.2-sol', created: 5 }] } }));
    A.autoRefreshModels(); await flush(); await flush();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].raw, JSON.stringify({ chat_completion_source: 'openai' }), '본체 프록시는 따르지 않음 (번역 요청도 안 따름)');
    assert.deepEqual(optionValues().slice(0, 3), ['gpt-5.4-mini', 'gpt-6.2-sol', 'gpt-6.1-sol'], 'onChange 로 다시 그림 · 저장된 모델은 맨 위 (이전 목록)');
    assert.equal(H.toasts.length, 0, '조용히');
    // 키가 없으면 안 받음 · 번역기 리버스 프록시를 켰으면 그 프록시로
    reset({ provider: 'deepseek' });
    A.autoRefreshModels(); await flush();
    assert.equal(calls.length, 0, 'DeepSeek 키 없음');
    reset({ provider: 'deepseek', s: { use_reverse_proxy: true, reverse_proxy_url: ' https://proxy.test/v1 ', reverse_proxy_password: 'pw' } });
    A.autoRefreshModels(); await flush();
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body, { chat_completion_source: 'deepseek', reverse_proxy: 'https://proxy.test/v1', proxy_password: 'pw' });
    reset({ provider: 'cohere', s: { use_reverse_proxy: true, reverse_proxy_url: 'https://proxy.test/v1' } });
    A.autoRefreshModels(); await flush();
    assert.equal(calls.length, 0, 'Cohere /status 는 프록시를 안 따름 → 키가 있어야');
    reset({ provider: 'claude' });
    A.autoRefreshModels(); await flush();
    assert.equal(calls.length, 0, 'Claude 는 목록을 못 받음');
    reset({ provider: 'openai', s: { connection_mode: 'current' } });
    A.autoRefreshModels(); await flush();
    assert.equal(calls.length, 0, '지금 연결 따라가기');
    // Custom: 새로 친 주소 X · 받은 적 있으면 O · 본체 주소 O
    reset({ provider: 'custom', s: { custom_url: 'https://typo.test/v1' } });
    A.typedCustomUrls.add('https://typo.test/v1');
    A.autoRefreshModels(); await flush();
    assert.equal(calls.length, 0, '새로 친 주소로 키가 가지 않게');
    LM.put('custom:https://typo.test/v1', ['t-1'], { at: Date.now() - 2 * DAY });
    useFetch(() => ({ status: 200, body: { data: [{ id: 't-2' }] } }));
    A.autoRefreshModels(); await flush(); await flush();
    assert.equal(calls.length, 1, '받은 적 있는 주소는 하루 지나면 다시');
    assert.equal(H.toasts.length, 0);
    reset({ provider: 'custom' });
    A.autoRefreshModels(); await flush(); await flush();
    assert.equal(calls.length, 1, '본체 주소 (저장된 주소) 는 없으면 받음');
    assert.equal(calls[0].body.custom_url, 'http://127.0.0.1:5001/v1');
    // 저장돼 있던 자기 주소(이번에 친 게 아님)도 없으면 받음 — 2.2.7 과 같음
    reset({ provider: 'custom', s: { custom_url: 'https://saved.test/v1' } });
    A.autoRefreshModels(); await flush(); await flush();
    assert.equal(calls.length, 1);
    // 실패 뒤에는 기다림 (바로 또 묻지 않음)
    reset({ provider: 'openai' });
    useFetch(() => ({ status: 500, body: {} }));
    A.autoRefreshModels(); await flush(); await flush();
    A.autoRefreshModels(); await flush();
    assert.equal(calls.length, 1, '실패 뒤 30분은 다시 안 물음');
    assert.equal(H.toasts.length, 0, '실패도 조용히');
});
await test('↻: 늘 받음 · 결과 알림 · 받는 중 잠김 · 실패면 예전 목록 그대로', async () => {
    reset({ provider: 'openai' });
    LM.put('openai', ['gpt-6.1-sol']);
    let release;
    useFetch(() => new Promise(r => { release = () => r({ status: 200, body: { data: [{ id: 'gpt-7', created: 9 }, { id: 'gpt-6.1-sol', created: 8 }] } }); }));
    A.updateModelList();
    const job = A.refreshProviderModelList('openai');
    assert.equal(doc.byId.llm_model_refresh.disabled, true);
    assert.match(doc.byId.llm_model_refresh.children[0].style.animation, /llmt-spin/);
    await flush(); release(); await job;
    assert.equal(doc.byId.llm_model_refresh.disabled, false);
    assert.deepEqual(H.toasts, [['success', '모델 2개를 불러왔습니다.']]);
    assert.deepEqual(optionValues().slice(0, 3), ['gpt-5.4-mini', 'gpt-7', 'gpt-6.1-sol']);
    useFetch(() => ({ status: 502, body: {} }));
    H.toasts.length = 0;
    await A.refreshProviderModelList('openai');
    assert.equal(H.toasts[0][0], 'error');
    assert.deepEqual(LM.cached('openai').ids, ['gpt-7', 'gpt-6.1-sol']);
});
await test('목록이 바뀌어도 모델 칸 · 커스텀 입력란을 쓰는 중이면 다시 그리지 않음 — 손을 떼면 그림 · 다른 공급자 목록은 무시', async () => {
    reset({ provider: 'openai' });
    A.updateModelList();
    const writes = doc.byId.llm_model.writes;
    doc.activeElement = doc.byId.llm_model;
    LM.put('openai', ['gpt-7']);
    assert.equal(doc.byId.llm_model.writes, writes, '쓰는 중');
    assert.equal(A.pending(), true);
    doc.activeElement = null;
    A.renderModelListWhenIdle();
    assert.equal(doc.byId.llm_model.writes, writes + 1);
    assert.deepEqual(optionValues(), ['gpt-5.4-mini', 'gpt-7', 'custom']);
    LM.put('openrouter', ['x/y']);
    assert.equal(doc.byId.llm_model.writes, writes + 1, '다른 공급자');
    doc.activeElement = doc.byId.llm_custom_model;
    LM.put('openai', ['gpt-8']);
    assert.equal(doc.byId.llm_model.writes, writes + 1, '커스텀 입력 중');
    doc.activeElement = null;
});
await test('테마 고르기 팝업(번호로 고름)이 열려 있는 동안 목록을 바꾸지 않음 — 닫히면 조금 뒤 그림', async () => {
    reset({ provider: 'openai' });
    A.updateModelList();
    const writes = doc.byId.llm_model.writes;
    doc.pickLayer = new El('div');
    LM.put('openai', ['gpt-7', 'gpt-6.1-sol']);
    assert.equal(doc.byId.llm_model.writes, writes, '팝업이 열려 있음');
    assert.equal(A.pending(), true);
    doc.pickLayer = null;
    await new Promise(r => setTimeout(r, 1600));
    assert.equal(A.pending(), false);
    assert.equal(doc.byId.llm_model.writes, writes + 1);
    assert.deepEqual(optionValues(), ['gpt-5.4-mini', 'gpt-7', 'gpt-6.1-sol', 'custom']);
});
await test('불러오기 · 그리기만으로는 통신하지 않음', () => {
    reset({ provider: 'custom', s: { custom_url: 'https://relay.test/v1' } });
    let hits = 0;
    globalThis.fetch = async () => { hits++; throw new Error('x'); };
    for (const p of PROVIDERS) { doc.byId.llm_provider.value = p; A.updateModelList(); A.translatorModelList(p, ''); A.modelListRequest(p); }
    assert.equal(hits, 0);
});

console.log(`\ntranslator-models: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
