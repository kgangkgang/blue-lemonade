// 한글화 패널(prompt) 모델 고르기 — 공용 src/live-models.js 로 옮긴 뒤
//   node tools/tests/prompt-models.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈은 data: 스텁 (live-models.mjs 와 같은 방식). 네트워크 없음 (fetch 는 가짜 — 부른 것을 기록).
// 확인하는 것:
//   1) 요청 본문: 예전 index.js runCompletionOnce 의 본문 만들기(아래에 그대로 옮김)와, 모델별 규칙에 걸리지 않는 모델은 글자까지 같다.
//      예전 고정 목록에서 본문이 바뀌는 건 OpenAI o3 · o3-mini · o4-mini 뿐 (실리태번 본체 · LLM 번역기와 같은 o 시리즈 규칙).
//      새 이름(gpt-6.1-sol · claude-sonnet-5-5 · openai/gpt-6.1-sol …)은 샘플링 값을 뺀다 — 예전엔 그대로 보내 400.
//   2) 목록: 받은 목록이 없으면 모델 등록 → 최신 이름 먼저 · 받은 목록이 있으면 그것만 (옛 이름을 덧붙이지 않음) · 저장된 모델은 그대로
//      ('(이전 목록)' · '(이 주소 목록에 없음)') · 맨 끝 커스텀 모델 입력 · 옛 customModelLists(설정 속 배열) 읽기
//   3) 공급자별로 고른 모델 기억 (예전 c.model 옮김 · 바꿨다 돌아오면 그대로 · 커스텀 모델 이름도)
//   4) LLM 번역 설정 가져오기가 합친 목록으로 확인 (예전 고정 목록에 없던 최신 모델도 그대로 고름)
//   5) ↻ (실리태번 /status · 목록은 localStorage 에만 — settings.json 에 안 씀) · 조용히 다시 받기 (연결 방식 · 공급자 · TTL · 키) · 목록 그리기는 통신 없음
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
const P = await import(pathToFileURL(path.join(srcDir, 'addons/prompt/connection.js')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}

// ---------- 가짜 브라우저 (localStorage · fetch · select)
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
        calls.push({ url, method: init?.method, body, raw: init?.body });
        const r = await reply(url, body);
        return { ok: r.status >= 200 && r.status < 300, status: r.status, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(r.body), json: async () => r.body };
    };
}
const SECRET = (on) => (on ? [{ id: 'k1', value: '***', label: 'x', active: true }] : null);
const page = {};   // 실리태번 화면의 #model_<id>_select
const opts = (vals) => ({ options: vals.map(v => ({ value: v })) });
globalThis.document = {
    activeElement: null,
    getElementById: (id) => page[id] || null,
    createDocumentFragment: () => ({ children: [], append(...n) { this.children.push(...n); } }),
    createElement: () => ({ value: '', textContent: '', selected: false }),
};
function fakeSelect() {
    return {
        children: [], dataset: {}, ownerDocument: globalThis.document,
        replaceChildren(frag) { this.children = [...(frag?.children || [])]; },
        get options() { return this.children; },
        get value() { const o = this.children.find(x => x.selected) || this.children[0]; return o ? o.value : ''; },
        set value(v) { let hit = false; for (const o of this.children) { o.selected = !hit && o.value === v; if (o.selected) hit = true; } },
    };
}
const labels = (sel) => sel.children.map(o => o.textContent);
const host = () => T.ctx.chatCompletionSettings;
function reset({ cs = {}, keys = {}, ext = {}, storage = {} } = {}) {
    globalThis.localStorage = fakeStorage(storage);
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    Object.assign(T.ext, ext);
    for (const k of Object.keys(page)) delete page[k];
    T.ctx.chatCompletionSettings = { chat_completion_source: 'openai', custom_url: 'http://127.0.0.1:5001/v1/', custom_include_headers: 'X-H: 1', reverse_proxy: '', proxy_password: '', ...cs };
    T.ctx.onlineStatus = 'no_connection';
    secrets.setSecretState({ api_key_openai: SECRET(true), api_key_openrouter: SECRET(true), api_key_claude: SECRET(true), api_key_deepseek: SECRET(false), ...keys });
    LM._resetForTest();
    useFetch(() => ({ status: 200, body: { data: [] } }));
}
const DAY = 24 * 60 * 60 * 1000;

// ---------- 1) 요청 본문 — 예전 코드 그대로 (2026-10-07 판 salty-ext/src/addons/prompt)
// index.js PROVIDER_MODELS (지운 고정 목록)
const OLD_PROVIDER_MODELS = {
    openai:     ['gpt-4o','gpt-4o-mini','gpt-4.1','gpt-4.1-mini','gpt-4.1-nano','o3','o3-mini','o4-mini','chatgpt-4o-latest','gpt-4-turbo','gpt-3.5-turbo'],
    claude:     ['claude-opus-4-6','claude-opus-4-5','claude-sonnet-4-6','claude-sonnet-4-5','claude-haiku-4-5','claude-3-7-sonnet-latest','claude-3-5-sonnet-latest','claude-3-5-haiku-latest','claude-3-opus-20240229'],
    google:     ['gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview','gemini-3.1-flash-lite','gemini-3.1-flash-lite-preview','gemini-3-pro-preview','gemini-3-flash-preview','gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite'],
    vertexai:   ['gemini-3.6-flash','gemini-3.5-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview','gemini-3.1-flash-lite','gemini-3.1-flash-lite-preview','gemini-3-pro-preview','gemini-3-flash-preview','gemini-2.5-pro','gemini-2.5-flash','gemini-2.5-flash-lite'],
    openrouter: ['deepseek/deepseek-r1','deepseek/deepseek-chat','google/gemini-2.5-pro','google/gemini-2.5-flash','anthropic/claude-3-haiku','meta-llama/llama-3-70b-instruct'],
    deepseek:   ['deepseek-v4-pro','deepseek-v4-flash'],
    mistralai:  ['mistral-large-latest','mistral-medium-latest','mistral-small-latest','open-mistral-nemo','pixtral-large-latest'],
    groq:       ['llama-3.3-70b-versatile','llama-3.1-70b-versatile','gemma2-9b-it','qwen/qwen3-32b','deepseek-r1-distill-llama-70b','mixtral-8x7b-32768'],
    cohere:     ['command-a-03-2025','command-r-plus','command-r','c4ai-aya-expanse-32b'],
    xai:        ['grok-4','grok-3','grok-3-mini','grok-2'],
    zai:        ['glm-5.2','glm-5.1','glm-5','glm-5-turbo','glm-4.7','glm-4.7-flash','glm-4.6','glm-4.5-flash'],
};
const OLD_PROVIDER_TO_SOURCE = {
    custom:'custom', openai:'openai', claude:'claude', google:'makersuite', vertexai:'vertexai',
    openrouter:'openrouter', deepseek:'deepseek', mistralai:'mistralai', groq:'groq', cohere:'cohere', xai:'xai', zai:'zai',
};
const DEFAULT_PARAMS = {
    openai:     { temperature:1, top_p:1, frequency_penalty:0, presence_penalty:0 },
    claude:     { temperature:1, top_p:1, top_k:0 },
    google:     { temperature:1, top_p:1, top_k:0 },
    vertexai:   { temperature:1, top_p:1, top_k:0 },
    openrouter: { temperature:1, top_p:1, frequency_penalty:0, presence_penalty:0 },
    deepseek:   { temperature:1, top_p:1, frequency_penalty:0, presence_penalty:0 },
    mistralai:  { temperature:1, top_p:1 },
    groq:       { temperature:1, top_p:1 },
    cohere:     { temperature:1, top_p:1, top_k:0, frequency_penalty:0, presence_penalty:0 },
    xai:        { temperature:1, top_p:1, frequency_penalty:0, presence_penalty:0 },
    zai:        { temperature:1, top_p:1 },
};
// index.js getProviderSpecificParams (그대로 남아 있음 — 두 길에 같은 입력을 주려고 옮김)
function getProviderSpecificParams(provider, params) {
    const out = { temperature: params.temperature };
    if(Number(params.max_length)>0)out.max_tokens=Number(params.max_length);
    if (['openai','custom','openrouter','deepseek','xai'].includes(provider)) {
        out.top_p = params.top_p; out.frequency_penalty = params.frequency_penalty; out.presence_penalty = params.presence_penalty;
    } else if (['claude','google','vertexai'].includes(provider)) {
        out.top_p = params.top_p; out.top_k = params.top_k;
    } else if (provider === 'cohere') {
        out.top_p = params.top_p; out.top_k = params.top_k; out.frequency_penalty = params.frequency_penalty; out.presence_penalty = params.presence_penalty;
    } else {
        out.top_p = params.top_p;
    }
    return out;
}
// connection.js customEndpoint · applyCustomConnection (예전)
const cleanUrl=value=>String(value||'').trim().replace(/\/+$/,'');
function oldCustomEndpoint(c,host) {
 const own=cleanUrl(c.customUrl);
 return {url:own||cleanUrl(host.custom_url),extras:!own};
}
function oldApplyCustomConnection(payload,c,host) {
 const {url,extras}=oldCustomEndpoint(c,host);
 if(!/^https?:\/\//i.test(url))throw Error('Custom 엔드포인트 주소를 확인해 주세요.');
 payload.custom_url=url;
 for(const key of ['custom_include_headers','custom_include_body','custom_exclude_body'])payload[key]=extras?(host[key]||''):'';
}
// index.js runCompletionOnce 의 「실리태번 API 중 선택」 본문 (모델 규칙 없음)
function oldParameters({ c, oai_settings, messages, tweak, budget }) {
    const prov = c.provider || 'openai';
    const source = OLD_PROVIDER_TO_SOURCE[prov] || prov;
    const model = (c.model === '__custom__' ? (c.customModelName || '') : (c.model || '')) || '';
    const params = c.parameters[prov];
    const providerParams = getProviderSpecificParams(prov, params);
    if (prov === 'claude' && !providerParams.max_tokens) providerParams.max_tokens = budget;
    const parameters = { model, messages, stream: false, chat_completion_source: source, ...providerParams };
    if (source === 'vertexai') {
        parameters.vertexai_auth_mode = oai_settings?.vertexai_auth_mode || 'full';
        const region = oai_settings?.vertexai_region;
        if (region) parameters.vertexai_region = region;
        if (parameters.vertexai_auth_mode === 'express' && oai_settings?.vertexai_express_project_id) {
            parameters.vertexai_express_project_id = oai_settings.vertexai_express_project_id;
        }
    }
    if(source==='custom')oldApplyCustomConnection(parameters,c,oai_settings);
    if (source!=='custom' && c.useReverseProxy && c.reverseProxyUrl?.trim()) {
        parameters.reverse_proxy = c.reverseProxyUrl.trim();
        parameters.proxy_password = c.reverseProxyPassword || '';
    }
    if (typeof tweak === 'function') tweak(parameters, params, providerParams);
    return parameters;
}
// 지금 index.js runCompletionOnce 가 하는 것 (본문은 connection.js directParameters)
function newParameters({ c, oai_settings, messages, tweak, budget }) {
    const prov = c.provider || 'openai';
    const source = OLD_PROVIDER_TO_SOURCE[prov] || prov;
    const model = (c.model === '__custom__' ? (c.customModelName || '') : (c.model || '')) || '';
    const params = c.parameters[prov];
    const providerParams = getProviderSpecificParams(prov, params);
    if (prov === 'claude' && !providerParams.max_tokens) providerParams.max_tokens = budget;
    return P.directParameters({ c, source, model, messages, params, providerParams, host: oai_settings, tweak });
}
// 재번역 (index.js retranslate 의 tweak)
const retranslate = (par, params, provParams) => {
    par.top_p = Math.min(1, (params.top_p ?? 1) * 0.97);
    if ('top_k' in provParams) par.top_k = Math.max(1, params.top_k || 40);
};
// LLM 번역기의 예전 규칙 (live-models.mjs 와 같은 사본) — 한글화 패널이 이제 번역기와 같게 보내는지
function oldTranslatorRules(provider, model, parameters) {
    const dropSampling = (...keys) => keys.forEach(key => delete parameters[key]);
    const useMaxCompletionTokens = () => {
        if (provider === 'openai' && parameters.max_tokens !== undefined) {
            parameters.max_completion_tokens = parameters.max_tokens;
            delete parameters.max_tokens;
        }
    };
    if ((provider === 'openai' && /^(o1|o3|o4)/.test(model)) || (provider === 'openrouter' && /^openai\/(o1|o3|o4)/.test(model))) {
        useMaxCompletionTokens();
        dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }
    if ((provider === 'openai' || provider === 'openrouter') && /gpt-(5|6)/.test(model)) {
        useMaxCompletionTokens();
        if (/gpt-5-chat-latest/.test(model)) {
            // chat only
        } else if (/gpt-5\.(1|2|3|4)/.test(model) && !/chat-latest/.test(model)) {
            dropSampling('frequency_penalty', 'presence_penalty');
        } else {
            dropSampling('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
        }
    }
    if (/claude-(fable|opus-5|sonnet-5)/.test(model)) {
        dropSampling('temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty');
    }
    return parameters;
}

const PROVIDERS = Object.keys(OLD_PROVIDER_TO_SOURCE);
// claude-haiku-5-5 (2026-10-07) 는 예전 번역기 규칙이 놓쳐 샘플링 값을 보냈다 — 같음을 보는 목록에서 빼고 아래 '새 모델' 에서 봄
const IDS = [...new Set([
    ...Object.values(OLD_PROVIDER_MODELS).flat(), ...Object.values(LM.KNOWN).flat().filter(id => !/claude-haiku-5/.test(id)),
    'gpt-5-chat-latest', 'gpt-5.4-mini', 'gpt-5.1-chat-latest', 'o1', 'o3-pro', 'o4-mini-2025-04-16', 'gpt-4o-2024-11-20', 'claude-opus-4-8',
    'claude-opus-4-20250514', 'openai/o4-mini', 'openai/gpt-4o', 'openai/gpt-5.2', 'anthropic/claude-sonnet-4.5', 'deepseek-reasoner',
    'my-relay/model-x', 'MiniMax-M2.7', 'glm-5.3', '',
])];
const MSGS = [{ role: 'system', content: 'sys' }, { role: 'user', content: '번역해 주세요' }];
function variants(prov) {
    // index.js getCurrentParams: 표에 없는 공급자(custom)는 OpenAI 기본값
    const base = () => ({ connectionMode: 'direct', provider: prov,
        parameters: { custom: { ...DEFAULT_PARAMS.openai }, ...Object.fromEntries(Object.entries(DEFAULT_PARAMS).map(([k, v]) => [k, { ...v }])) },
        customUrl: '', useReverseProxy: false, reverseProxyUrl: '', reverseProxyPassword: '' });
    const list = [
        ['기본', base(), {}],
        ['최대 길이', Object.assign(base(), {}), { maxLength: 3000 }],
        ['재번역', base(), { tweak: retranslate }],
        ['프록시', Object.assign(base(), { useReverseProxy: true, reverseProxyUrl: ' https://proxy.example/v1 ', reverseProxyPassword: 'pw' }), {}],
        ['직접 입력', base(), { custom: true }],
    ];
    if (prov === 'custom') {
        list.push(['Custom 내 주소', Object.assign(base(), { customUrl: 'https://relay.example/v1/' }), {}]);
        list.push(['Custom 내 주소 · 재번역', Object.assign(base(), { customUrl: 'https://relay.example/v1' }), { tweak: retranslate }]);
    }
    return list;
}
function hostFor(prov, i) {
    const h = { custom_url: 'http://127.0.0.1:5001/v1/', custom_include_headers: 'X-H: 1', custom_include_body: 'a: 1', custom_exclude_body: 'b', chat_completion_source: 'openai' };
    if (prov === 'vertexai') Object.assign(h, i % 2 ? { vertexai_auth_mode: 'express', vertexai_region: 'us-east5', vertexai_express_project_id: 'proj' } : { vertexai_auth_mode: 'full', vertexai_region: 'global' });
    return h;
}

await test('요청 본문: 규칙에 걸리지 않는 모델은 예전과 글자까지 같음 (공급자 12 · 모델 이름 · 최대 길이 · 재번역 · 프록시 · Custom · Vertex)', () => {
    reset();
    let same = 0, ruled = 0;
    for (const prov of PROVIDERS) {
        for (const id of IDS) {
            variants(prov).forEach(([name, c, o], i) => {
                if (o.maxLength) c.parameters[prov] = { ...c.parameters[prov], max_length: o.maxLength };
                if (o.custom) { c.model = '__custom__'; c.customModelName = id; } else c.model = id;
                const args = () => ({ c: structuredClone(c), oai_settings: hostFor(prov, i), messages: structuredClone(MSGS), tweak: o.tweak, budget: 2048 });
                const before = oldParameters(args());
                const after = newParameters(args());
                const source = OLD_PROVIDER_TO_SOURCE[prov];
                const ruledBefore = LM.applyModelRequestRules(source, id, structuredClone(before));
                const untouched = JSON.stringify(ruledBefore) === JSON.stringify(before);
                const where = `${prov} · ${id || '(빈 이름)'} · ${name}`;
                if (untouched) { assert.equal(JSON.stringify(after), JSON.stringify(before), where); same++; }
                else { assert.equal(JSON.stringify(after), JSON.stringify(ruledBefore), where); ruled++; }
                // 2026-10 까지의 이름은 LLM 번역기(예전 규칙)와 같은 본문
                assert.equal(JSON.stringify(after), JSON.stringify(oldTranslatorRules(source, id, structuredClone(before))), `번역기와 같음: ${where}`);
            });
        }
    }
    assert.ok(same > 4000 && ruled > 300, `same ${same} · ruled ${ruled}`);
});

await test('요청 본문: 예전 고정 목록에서 바뀌는 건 OpenAI o3 · o3-mini · o4-mini 뿐 (o 시리즈 규칙)', () => {
    reset();
    const changed = [];
    for (const [prov, ids] of Object.entries(OLD_PROVIDER_MODELS)) {
        for (const id of ids) {
            for (const [name, c, o] of variants(prov)) {
                if (o.maxLength) c.parameters[prov] = { ...c.parameters[prov], max_length: o.maxLength };
                if (o.custom) { c.model = '__custom__'; c.customModelName = id; } else c.model = id;
                const args = () => ({ c: structuredClone(c), oai_settings: hostFor(prov, 1), messages: structuredClone(MSGS), tweak: o.tweak, budget: 4096 });
                if (JSON.stringify(oldParameters(args())) !== JSON.stringify(newParameters(args()))) changed.push(`${prov}:${id}:${name}`);
            }
        }
    }
    const who = [...new Set(changed.map(x => x.split(':').slice(0, 2).join(':')))].sort();
    assert.deepEqual(who, ['openai:o3', 'openai:o3-mini', 'openai:o4-mini']);
    // o 시리즈: 샘플링 값을 빼고 max_tokens → max_completion_tokens (실리태번 본체 openai.js 와 같음)
    const c = variants('openai')[1][1];
    c.parameters.openai = { ...c.parameters.openai, max_length: 3000 };
    c.model = 'o4-mini';
    const body = newParameters({ c, oai_settings: hostFor('openai', 0), messages: MSGS, budget: 1 });
    assert.equal(JSON.stringify(body), JSON.stringify({ model: 'o4-mini', messages: MSGS, stream: false, chat_completion_source: 'openai', max_completion_tokens: 3000 }));
});

await test('요청 본문: 새 모델은 거부되는 샘플링 값을 뺀다 (예전엔 그대로 보내 400) · 재번역의 top_p 도', () => {
    reset();
    const make = (prov, model, o = {}) => {
        const c = variants(prov)[0][1];
        c.model = model;
        return newParameters({ c, oai_settings: hostFor(prov, 0), messages: MSGS, tweak: o.tweak, budget: 2048 });
    };
    assert.deepEqual(make('openai', 'gpt-6.1-sol'), { model: 'gpt-6.1-sol', messages: MSGS, stream: false, chat_completion_source: 'openai' });
    assert.deepEqual(make('openai', 'gpt-6.1-sol', { tweak: retranslate }), { model: 'gpt-6.1-sol', messages: MSGS, stream: false, chat_completion_source: 'openai' }, '재번역 tweak 뒤에 규칙');
    assert.deepEqual(make('openai', 'gpt-5.4'), { model: 'gpt-5.4', messages: MSGS, stream: false, chat_completion_source: 'openai', temperature: 1, top_p: 1 });
    assert.deepEqual(make('claude', 'claude-sonnet-5-5'), { model: 'claude-sonnet-5-5', messages: MSGS, stream: false, chat_completion_source: 'claude', max_tokens: 2048 });
    assert.deepEqual(make('claude', 'claude-haiku-5-5'), { model: 'claude-haiku-5-5', messages: MSGS, stream: false, chat_completion_source: 'claude', max_tokens: 2048 });
    assert.deepEqual(make('openrouter', 'anthropic/claude-haiku-5.5'), { model: 'anthropic/claude-haiku-5.5', messages: MSGS, stream: false, chat_completion_source: 'openrouter' });
    assert.deepEqual(make('openrouter', 'openai/gpt-6.1-sol'), { model: 'openai/gpt-6.1-sol', messages: MSGS, stream: false, chat_completion_source: 'openrouter' });
    assert.deepEqual(make('openrouter', 'anthropic/claude-sonnet-5.5'), { model: 'anthropic/claude-sonnet-5.5', messages: MSGS, stream: false, chat_completion_source: 'openrouter' });
    assert.deepEqual(make('openai', 'o5-mini'), { model: 'o5-mini', messages: MSGS, stream: false, chat_completion_source: 'openai' }, '다음 세대 o 시리즈');
    assert.equal(make('google', 'gemini-3.8-flash').temperature, 1, 'Gemini 는 실리태번 서버가 맞춘다 — 그대로');
});

await test('index.js: 고정 목록 · 따로 만든 본문이 없고 directParameters · 공용 목록을 씀', () => {
    const src = readFileSync(path.join(srcDir, 'addons/prompt/index.js'), 'utf8');
    assert.ok(!/PROVIDER_MODELS/.test(src), '옛 고정 목록');
    assert.ok(!/chat_completion_source: source, \.\.\.providerParams/.test(src), '본문은 connection.js 에서만');
    assert.ok(/directParameters\(\{ c, source, model, messages, params, providerParams, host: oai_settings, tweak \}\)/.test(src));
    assert.ok(/renderModelSelect\(sel,c,oai_settings\)/.test(src) && /restoreModel\(c, oai_settings\)/.test(src) && /syncModelMemory\(c\);/.test(src));
    const conn = readFileSync(path.join(srcDir, 'addons/prompt/connection.js'), 'utf8');
    assert.ok(!/customModelLists\s*=/.test(conn), '받은 목록을 settings.json 에 쓰지 않음');
    assert.ok(!/fetch\(/.test(conn), '목록 받기는 live-models 만');
});

// ---------- 2) 목록
const cfgOf = (o = {}) => ({ connectionMode: 'direct', provider: 'openai', model: 'gpt-4o-mini', customModelName: '', customUrl: '', parameters: {}, ...o });

await test('목록: 받은 목록이 없으면 최신 이름 먼저 · 저장된 모델 골라 둠 · 맨 끝 커스텀 모델 입력 · 그리기는 통신 없음', () => {
    reset();
    const sel = fakeSelect();
    const c = cfgOf();
    const r = P.renderModelSelect(sel, c, host());
    assert.equal(calls.length, 0, '통신 없음');
    assert.equal(r.live, false);
    assert.equal(sel.children[0].value, LM.KNOWN.openai[0], 'gpt-6.1-sol 맨 앞');
    assert.equal(sel.value, 'gpt-4o-mini');
    const last = sel.children.at(-1);
    assert.deepEqual([last.value, last.textContent], ['__custom__', '커스텀 모델 입력']);
    assert.ok(!labels(sel).some(l => l.includes('이전 목록')));
    assert.ok(!sel.children.some(o => o.value === ''), '고른 모델이 있으면 빈 칸 없음');
});

await test('목록: 저장된 모델이 목록에 없으면 그대로 맨 앞에 골라 둠 (이전 목록) · 실리태번 화면 목록에 있으면 그냥', () => {
    reset();
    const sel = fakeSelect();
    P.renderModelSelect(sel, cfgOf({ model: 'gpt-3.5-turbo' }), host());
    assert.equal(sel.children[0].textContent, 'gpt-3.5-turbo (이전 목록)');
    assert.equal(sel.value, 'gpt-3.5-turbo');
    page.model_openai_select = opts(['gpt-6-sol', 'gpt-3.5-turbo', 'text-embedding-3-large']);
    const sel2 = fakeSelect();
    P.renderModelSelect(sel2, cfgOf({ model: 'gpt-3.5-turbo' }), host());
    assert.ok(labels(sel2).includes('gpt-3.5-turbo') && !labels(sel2).some(l => l.includes('이전 목록')));
    assert.ok(!labels(sel2).includes('text-embedding-3-large'), '채팅 모델 아님');
    assert.equal(sel2.value, 'gpt-3.5-turbo');
});

await test('목록: 받은 목록이 있으면 그것만 (최신 이름 · 화면 목록을 덧붙이지 않음) · 모델 등록은 붙음', () => {
    reset({ ext: { model_register: { sources: { openai: ['my-gpt'] }, picks: {} } } });
    page.model_openai_select = opts(['gpt-3.5-turbo']);
    LM.put('openai', [{ id: 'gpt-6.1-sol', created: 3 }, { id: 'gpt-4o-mini', created: 1 }]);
    const sel = fakeSelect();
    const r = P.renderModelSelect(sel, cfgOf({ model: 'gpt-4.1' }), host());
    assert.equal(r.live, true);
    assert.deepEqual(sel.children.map(o => o.value), ['gpt-4.1', 'gpt-6.1-sol', 'gpt-4o-mini', 'my-gpt', '__custom__']);
    assert.equal(sel.children[0].textContent, 'gpt-4.1 (이전 목록)');
    assert.equal(sel.value, 'gpt-4.1');
});

await test('목록: 받은 목록이 없으면 모델 등록이 맨 앞 · Claude 는 목록을 못 받음 (↻ 숨김)', () => {
    reset({ ext: { model_register: { sources: { claude: ['claude-test-x'] }, picks: {} } } });
    const sel = fakeSelect();
    P.renderModelSelect(sel, cfgOf({ provider: 'claude', model: 'claude-opus-4-6' }), host());
    assert.deepEqual(sel.children.slice(0, 3).map(o => o.value), ['claude-test-x', 'claude-sonnet-5-5', 'claude-opus-5-5']);
    assert.equal(sel.value, 'claude-opus-4-6');
    assert.equal(P.canListModels({ provider: 'claude' }), false);
    assert.equal(P.canListModels({ provider: 'google' }), true);
    assert.equal(P.canListModels({ provider: 'custom' }), true);
});

await test('목록: Custom — 옛 customModelLists(설정 속 배열)를 읽음 · 목록에 없으면 (이 주소 목록에 없음) · 빈 목록이면 (이전 목록)', () => {
    reset({ ext: { 'prompt-panel': { customModelLists: { 'https://relay.example/v1': ['b-model', 'a-model'] } } } });
    const sel = fakeSelect();
    const c = cfgOf({ provider: 'custom', customUrl: 'https://relay.example/v1/', model: 'zzz' });
    const r = P.renderModelSelect(sel, c, host());
    assert.equal(r.key, 'custom:https://relay.example/v1');
    assert.equal(P.modelListKey(c, host()), r.key);
    assert.deepEqual(sel.children.map(o => o.textContent), ['zzz (이 주소 목록에 없음)', 'b-model', 'a-model', '커스텀 모델 입력']);
    const sel2 = fakeSelect();
    P.renderModelSelect(sel2, cfgOf({ provider: 'custom', customUrl: 'https://other.example/v1', model: 'zzz' }), host());
    assert.deepEqual(sel2.children.map(o => o.textContent), ['zzz (이전 목록)', '커스텀 모델 입력']);
    // 본체 주소를 쓰면 본체 주소 목록
    LM.put('custom:http://127.0.0.1:5001/v1', ['local-1']);
    const sel3 = fakeSelect();
    P.renderModelSelect(sel3, cfgOf({ provider: 'custom', model: 'local-1' }), host());
    assert.deepEqual(sel3.children.map(o => o.value), ['local-1', '__custom__']);
});

await test('목록: 커스텀 모델 입력을 고른 때 · 고른 모델이 없을 때', () => {
    reset();
    const sel = fakeSelect();
    P.renderModelSelect(sel, cfgOf({ model: '__custom__', customModelName: 'ft:gpt-4o:me' }), host());
    assert.equal(sel.value, '__custom__');
    assert.ok(!labels(sel).some(l => l.includes('이전 목록') || l.includes('모델 선택')));
    const sel2 = fakeSelect();
    P.renderModelSelect(sel2, cfgOf({ provider: 'custom', model: '' }), host());
    assert.deepEqual([sel2.children[0].value, sel2.children[0].textContent], ['', '모델 선택...']);
    assert.equal(sel2.value, '');
});

await test('목록: 같은 내용이면 다시 그리지 않음 (폰에서 깜빡임 없음) · 목록이 바뀐 알림의 키가 맞음', () => {
    reset();
    const sel = fakeSelect();
    const c = cfgOf();
    P.renderModelSelect(sel, c, host());
    const first = sel.children;
    P.renderModelSelect(sel, c, host());
    assert.equal(sel.children, first);
    const seen = [];
    const off = P.watchModelLists(e => seen.push(e.key));
    LM.put('openai', ['gpt-6.1-sol']);
    off();
    LM.put('openai', ['gpt-6-sol']);
    assert.deepEqual(seen, [P.modelListKey(c, host())]);
});

// ---------- 3) 공급자별 기억
await test('기억: 예전 c.model 은 지금 공급자 것으로 · 바꿨다 돌아오면 그대로 (예전: 고정 목록 첫 모델로 덮어씀)', () => {
    reset();
    const c = cfgOf({ provider: 'openai', model: 'gpt-4.1' });
    P.syncModelMemory(c);
    assert.deepEqual(c.models, { openai: 'gpt-4.1' });
    c.provider = 'claude'; P.restoreModel(c, host());
    assert.equal(c.model, LM.KNOWN.claude[0], '처음 고르는 공급자는 목록 맨 앞');
    c.model = 'claude-opus-4-6'; P.syncModelMemory(c);
    c.provider = 'openai'; P.restoreModel(c, host());
    assert.equal(c.model, 'gpt-4.1');
    c.provider = 'claude'; P.restoreModel(c, host());
    assert.equal(c.model, 'claude-opus-4-6');
    assert.deepEqual(c.models, { openai: 'gpt-4.1', claude: 'claude-opus-4-6' });
});

await test('기억: 목록에 없는 모델도 그대로 · 커스텀 모델 이름도 공급자별 · 프로필은 건드리지 않음', () => {
    reset();
    const c = cfgOf({ provider: 'openai', model: '__custom__', customModelName: 'ft:gpt-4o:me', models: { groq: 'mixtral-8x7b-32768' } });
    P.syncModelMemory(c);
    assert.deepEqual(c.customModels, { openai: 'ft:gpt-4o:me' });
    c.provider = 'groq'; P.restoreModel(c, host());
    assert.equal(c.model, 'mixtral-8x7b-32768', '목록에 없어도 그대로');
    assert.equal(c.customModelName, 'ft:gpt-4o:me', '커스텀 이름은 그대로 (groq 엔 기억 없음)');
    c.model = '__custom__'; c.customModelName = 'groq-ft'; P.syncModelMemory(c);
    c.provider = 'openai'; P.restoreModel(c, host());
    assert.deepEqual([c.model, c.customModelName], ['__custom__', 'ft:gpt-4o:me']);
    c.provider = 'groq'; P.restoreModel(c, host());
    assert.deepEqual([c.model, c.customModelName], ['__custom__', 'groq-ft']);
    const before = JSON.stringify(c.models);
    c.provider = '__st_profile__'; P.syncModelMemory(c); P.restoreModel(c, host());
    assert.equal(JSON.stringify(c.models), before);
    assert.equal(c.model, '__custom__');
});

// ---------- 4) / 5) 화면 연결 (bindConnection)
function fakeDoc() {
    const els = {};
    return { els, getElementById: (id) => (els[id] ||= { id, value: '', textContent: '', hidden: false, checked: false, disabled: false }) };
}
function bind(c, ext = T.ext) {
    const doc = fakeDoc();
    let refreshed = 0, saved = 0;
    P.bindConnection({ doc, cfg: () => { P.syncModelMemory(c); return c; }, save: () => { saved++; }, host: host(), extensions: ext, refresh: () => { refreshed++; } });
    return { doc, el: doc.els, get refreshed() { return refreshed; }, get saved() { return saved; } };
}

await test('가져오기: LLM 번역 모델을 합친 목록으로 확인 (예전 고정 목록에 없던 최신 모델도 그대로) · 없으면 커스텀 모델 입력', () => {
    reset();
    const c = cfgOf({ parameters: { claude: { ...DEFAULT_PARAMS.claude } } });
    const ext = { 'llm-translator-custom': { llm_provider: 'claude', llm_model: 'claude-sonnet-5-5', connection_mode: 'direct', parameters: {} } };
    const ui = bind(c, ext);
    ui.el['pt-import-llm'].onclick();
    assert.deepEqual([c.provider, c.model, c.connectionMode], ['claude', 'claude-sonnet-5-5', 'direct']);
    assert.equal(c.models.claude, 'claude-sonnet-5-5');
    ext['llm-translator-custom'].llm_model = 'claude-mystery-9';
    ui.el['pt-import-llm'].onclick();
    assert.deepEqual([c.model, c.customModelName], ['__custom__', 'claude-mystery-9']);
    assert.equal(ui.el['pt-model-custom'].value, 'claude-mystery-9');
    // Custom: 가져온 주소의 목록으로 확인 (번역기 custom_model_lists)
    reset({ ext: { 'llm-translator-custom': { custom_model_lists: { 'https://relay.example/v1': { models: ['relay-a', 'relay-b'], fetchedAt: '2026-10-01T00:00:00Z' } } } } });
    const c2 = cfgOf();
    const ext2 = { 'llm-translator-custom': { llm_provider: 'custom', llm_model: 'relay-b', custom_url: 'https://relay.example/v1', connection_mode: 'direct', parameters: {} } };
    bind(c2, ext2).el['pt-import-llm'].onclick();
    assert.deepEqual([c2.provider, c2.model, c2.customUrl], ['custom', 'relay-b', 'https://relay.example/v1']);
});

await test('↻: 실리태번 /status 로 받아 localStorage 에만 (settings.json 에 안 씀) · 다시 그림 · 실패해도 예전 목록', async () => {
    reset();
    const c = cfgOf();
    const ui = bind(c);
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-4o', created: 1 }, { id: 'gpt-6.1-sol', created: 3 }, { id: 'text-embedding-3-large', created: 5 }] } }));
    await ui.el['pt-fetch-models'].onclick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/api/backends/chat-completions/status');
    assert.equal(calls[0].raw, JSON.stringify({ chat_completion_source: 'openai' }));
    assert.equal(ui.el['pt-models-status'].textContent, '모델 2개를 불러왔어요.');
    assert.equal(ui.el['pt-models-status'].hidden, false);
    assert.equal(ui.refreshed, 1);
    assert.deepEqual(LM.cached('openai').ids, ['gpt-6.1-sol', 'gpt-4o']);
    assert.ok(JSON.parse(localStorage.getItem(LM.STORE_KEY)).openai);
    assert.ok(!('customModelLists' in c), 'settings.json 에 쓰지 않음');
    useFetch(() => ({ status: 500, body: {} }));
    await ui.el['pt-fetch-models'].onclick();
    assert.match(ui.el['pt-models-status'].textContent, /^목록을 불러오지 못했어요\./);
    assert.equal(ui.el['pt-fetch-models'].disabled, false);
    assert.deepEqual(LM.cached('openai').ids, ['gpt-6.1-sol', 'gpt-4o'], '예전 목록 그대로');
});

await test('↻ Custom: 내 주소 → custom_url 만 · 본체 주소 → 본체 추가 헤더도 · 주소 없으면 안내만', async () => {
    reset();
    const c = cfgOf({ provider: 'custom', customUrl: 'https://relay.example/v1' });
    const ui = bind(c);
    useFetch(() => ({ status: 200, body: { data: [{ id: 'relay-a' }] } }));
    await ui.el['pt-fetch-models'].onclick();
    assert.equal(calls[0].raw, JSON.stringify({ chat_completion_source: 'custom', custom_url: 'https://relay.example/v1' }));
    assert.deepEqual(LM.cached('custom:https://relay.example/v1').ids, ['relay-a']);
    c.customUrl = '';
    useFetch(() => ({ status: 200, body: { data: [{ id: 'local-1' }] } }));
    await ui.el['pt-fetch-models'].onclick();
    assert.equal(calls[0].raw, JSON.stringify({ chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:5001/v1', custom_include_headers: '{X-H: 1}' }));
    T.ctx.chatCompletionSettings.custom_url = '';
    useFetch(() => ({ status: 200, body: { data: [] } }));
    await ui.el['pt-fetch-models'].onclick();
    assert.equal(calls.length, 0);
    assert.equal(ui.el['pt-models-status'].textContent, '주소를 먼저 입력해 주세요.');
});

await test('조용히 다시 받기: 「API 중 선택」일 때만 · 하루 지난 목록만 · 키가 있을 때만 · Claude 는 안 함 · 실패해도 조용히', async () => {
    reset();
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-6.1-sol' }] } }));
    assert.equal(await P.autoListModels(cfgOf({ connectionMode: 'current' }), host()), null);
    assert.equal(await P.autoListModels(cfgOf({ connectionMode: 'profile' }), host()), null);
    assert.equal(calls.length, 0);
    assert.deepEqual(await P.autoListModels(cfgOf(), host()), ['gpt-6.1-sol']);
    assert.equal(calls.length, 1);
    assert.equal(await P.autoListModels(cfgOf(), host()), null, '받은 지 하루 안');
    assert.equal(calls.length, 1);
    assert.equal(await P.autoListModels(cfgOf({ provider: 'claude', model: 'claude-opus-4-6' }), host()), null);
    assert.equal(await P.autoListModels(cfgOf({ provider: 'deepseek', model: 'deepseek-v4-pro' }), host()), null, '키 없음');
    assert.equal(calls.length, 1);
    // 하루가 지나면 다시
    const store = JSON.parse(localStorage.getItem(LM.STORE_KEY));
    store.openai.at = Date.now() - DAY - 1000;
    localStorage.setItem(LM.STORE_KEY, JSON.stringify(store));
    LM._resetForTest();
    useFetch(() => ({ status: 503, body: {} }));
    assert.equal(await P.autoListModels(cfgOf(), host()), null, '실패는 조용히');
    assert.equal(calls.length, 1);
    assert.deepEqual(LM.cached('openai').ids, ['gpt-6.1-sol'], '예전 목록 그대로');
    // Custom: 이 패널에 저장된 주소 — 5.7.1 받아 본 적이 있을 때만 (방금 친 · 오타 난 주소로 저장된 키가 가지 않게)
    reset();
    useFetch(() => ({ status: 200, body: { data: [{ id: 'relay-a' }] } }));
    assert.equal(await P.autoListModels(cfgOf({ provider: 'custom', customUrl: 'https://relay.example/v1' }), host()), null, '처음 보는 주소는 ↻ 로만');
    assert.equal(calls.length, 0);
    LM.put('custom:https://relay.example/v1', ['relay-old'], { at: Date.now() - 2 * 24 * 3600e3 });
    assert.deepEqual(await P.autoListModels(cfgOf({ provider: 'custom', customUrl: 'https://relay.example/v1' }), host()), ['relay-a']);
    assert.equal(calls[0].raw, JSON.stringify({ chat_completion_source: 'custom', custom_url: 'https://relay.example/v1' }));
});

await test('연결 방식을 「API 중 선택」으로 바꾸면 조용히 다시 받기', async () => {
    reset();
    const c = cfgOf({ connectionMode: 'current' });
    const ui = bind(c);
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-6.1-sol' }] } }));
    ui.el['pt-connection-mode'].onchange({ target: { value: 'direct' } });
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calls.length, 1);
    assert.equal(c.connectionMode, 'direct');
    ui.el['pt-connection-mode'].onchange({ target: { value: 'current' } });
    await new Promise(r => setTimeout(r, 0));
    assert.equal(calls.length, 1);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
