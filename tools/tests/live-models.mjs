// 공용 모델 목록 src/live-models.js + TTS 대사 분석 stapi.js 가 그것을 쓰는 길
//   node tools/tests/live-models.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈(script.js · extensions.js · secrets.js · openai.js)은 data: 스텁으로. 네트워크 없음 (fetch 는 가짜 — 부른 것을 기록).
// 확인하는 것:
//   1) 모델별 요청 규칙: 예전 세 벌(번역기 · 다시 쓰기 · TTS — 아래에 그대로 옮김)과 2026-10 까지의 이름 650여 개에서 결과가 같고,
//      새 세대 이름(o5 · gpt-7 · claude-opus-6 · claude-haiku-5 · gemini-4 …)만 가장 새 세대처럼 바뀜. lowEffort 도 같은 방식
//   2) TTS 요청 본문이 1.3.x 와 글자까지 같음 (예전 stapi.js 로 만든 값을 아래 GOLD 에 박아 둠)
//   3) 목록: 거르기 · 새것 먼저 · 화면 목록 · 모델 등록 · KNOWN · 저장된 모델 · 캐시(TTL · 12개 · 옛 캐시 읽기) · 받기 묶기 · 조용히 다시 받기 · 실리태번 목록 받아 두기
import assert from 'node:assert/strict';
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

// ---------- 1) 모델별 요청 규칙: 예전 세 벌 그대로 (2026-10-07 판)
// LLM 번역기 src/addons/translator/index.js applyModelRequestRules
function oldTranslator(provider, model, parameters) {
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
}
// 다시 쓰기 src/addons/rewrite/providers.js applyModelRequestRules
function oldRewrite(provider, model, request) {
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
}
// TTS src/addons/tts/src/stapi.js applyModelRequestRules · lowEffort (1.3.6)
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
function oldTts(provider, model, body) {
    const m = str(model);
    const drop = (...keys) => keys.forEach(k => delete body[k]);
    const useMaxCompletion = () => {
        if (provider === 'openai' && body.max_tokens !== undefined) { body.max_completion_tokens = body.max_tokens; delete body.max_tokens; }
    };
    if ((provider === 'openai' && /^(o1|o3|o4)/.test(m)) || (provider === 'openrouter' && /^openai\/(o1|o3|o4)/.test(m))) {
        useMaxCompletion();
        drop('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }
    if ((provider === 'openai' || provider === 'openrouter') && /gpt-(5|6)/.test(m)) {
        useMaxCompletion();
        if (/gpt-5-chat-latest/.test(m)) { /* chat only */ }
        else if (/gpt-5\.(1|2|3|4)/.test(m) && !/chat-latest/.test(m)) drop('frequency_penalty', 'presence_penalty');
        else drop('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }
    if (/claude-(fable|opus-5|sonnet-5)/.test(m)) drop('temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty');
    return body;
}
function oldLowEffort(provider, model) {
    const m = str(model);
    if (provider === 'openai') return 'low';
    if (provider === 'claude' && /claude-(fable|opus-5|sonnet-5|opus-4-[78])/.test(m)) return 'low';
    if ((provider === 'makersuite' || provider === 'vertexai') && /gemini-3/.test(m)) return 'low';
    return '';
}

// 실리태번 1.19 index.html 의 모든 모델 · OpenRouter 공개 목록(2026-10-07) 465개 · 이상한 이름
const KNOWN_IDS = [
    "clio-v1", "kayra-v1", "llama-3-erato-v1", "gpt-6-astra", "gpt-6-sol", "gpt-6-luna", "gpt-5.6", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna",
    "gpt-5.5", "gpt-5.5-2026-04-23", "gpt-5.4", "gpt-5.4-2026-03-05", "gpt-5.4-mini", "gpt-5.4-mini-2026-03-17", "gpt-5.4-nano",
    "gpt-5.4-nano-2026-03-17", "gpt-5.3-chat-latest", "gpt-5.2", "gpt-5.2-2025-12-11", "gpt-5.2-chat-latest", "gpt-5.1", "gpt-5.1-2025-11-13",
    "gpt-5.1-chat-latest", "gpt-5", "gpt-5-2025-08-07", "gpt-5-chat-latest", "gpt-5-mini", "gpt-5-mini-2025-08-07", "gpt-5-nano",
    "gpt-5-nano-2025-08-07", "gpt-4.1", "gpt-4.1-2025-04-14", "gpt-4.1-mini", "gpt-4.1-mini-2025-04-14", "gpt-4.1-nano", "gpt-4.1-nano-2025-04-14",
    "o4-mini", "o4-mini-2025-04-16", "o3", "o3-2025-04-16", "o3-mini", "o3-mini-2025-01-31", "o1", "o1-2024-12-17", "gpt-4o", "gpt-4o-2024-11-20",
    "gpt-4o-2024-08-06", "gpt-4o-2024-05-13", "gpt-4o-mini", "gpt-4o-mini-2024-07-18", "gpt-4-turbo", "gpt-4-turbo-2024-04-09", "gpt-4", "gpt-4-0613",
    "gpt-3.5-turbo", "gpt-3.5-turbo-0125", "gpt-3.5-turbo-1106", "gpt-3.5-turbo-instruct", "babbage-002", "davinci-002", "claude-fable-5-1",
    "claude-fable-5", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5", "claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6", "claude-opus-4-5",
    "claude-opus-4-5-20251101", "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-sonnet-4-5-20250929", "claude-haiku-4-5", "claude-haiku-4-5-20251001",
    "claude-opus-4-0", "claude-opus-4-20250514", "claude-sonnet-4-0", "claude-sonnet-4-20250514", "gemini-3.8-flash", "gemini-3.7-flash",
    "gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-pro-preview", "gemini-3.1-flash-lite", "gemini-3.1-flash-image",
    "gemini-3-pro-image", "gemini-3-flash-preview", "gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash-image",
    "gemini-2.0-flash-001", "gemini-2.0-flash", "gemini-2.0-flash-lite-001", "gemini-2.0-flash-lite", "gemma-4-31b-it", "gemma-4-26b-a4b-it",
    "gemma-3n-e4b-it", "gemma-3n-e2b-it", "gemma-3-27b-it", "gemma-3-12b-it", "gemma-3-4b-it", "gemma-3-1b-it", "learnlm-2.0-flash-experimental",
    "gemini-robotics-er-1.5-preview", "qwen/qwen3-32b", "deepseek-r1-distill-llama-70b", "gemma2-9b-it", "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct", "llama-3.1-8b-instant", "llama-3.3-70b-versatile", "llama-guard-3-8b", "llama3-70b-8192",
    "llama3-8b-8192", "mistral-saba-24b", "MiniMax-M2.7", "MiniMax-M2.7-highspeed", "MiniMax-M2.5", "MiniMax-M2.5-highspeed", "MiniMax-M2.1",
    "MiniMax-M2.1-highspeed", "MiniMax-M2", "M2-her", "sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro", "sonar-deep-research", "r1-1776",
    "llama-3.1-sonar-small-128k-online", "llama-3.1-sonar-large-128k-online", "llama-3.1-sonar-huge-128k-online", "llama-3.1-sonar-small-128k-chat",
    "llama-3.1-sonar-large-128k-chat", "c4ai-aya-23-8b", "c4ai-aya-23", "c4ai-aya-expanse-8b", "c4ai-aya-expanse-32b", "c4ai-aya-vision-8b",
    "c4ai-aya-vision-32b", "command-light", "command", "command-r", "command-r-plus", "command-r-08-2024", "command-r-plus-08-2024",
    "command-r7b-12-2024", "command-a-03-2025", "command-a-vision-07-2025", "command-light-nightly", "command-nightly", "kimi-k2-0711-preview",
    "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k", "moonshot-v1-auto", "kimi-latest", "moonshot-v1-8k-vision-preview",
    "moonshot-v1-32k-vision-preview", "moonshot-v1-128k-vision-preview", "kimi-thinking-preview", "glm-5.2", "glm-5-turbo", "glm-5v-turbo", "glm-5.1",
    "glm-5", "glm-4.7", "glm-4.7-flash", "glm-4.7-flashx", "glm-4.6", "glm-4.6v", "glm-4.6v-flash", "glm-4.6v-flashx", "glm-4.5v", "glm-4.5",
    "glm-4.5-air", "glm-4.5-x", "glm-4.5-airx", "glm-4.5-flash", "glm-4-32b-0414-128k", "autoglm-phone-multilingual", "google/gemini-nano-banana-2.1",
    "mistralai/mistral-large-4-0", "inclusionai/ling-3.1-flash", "apodex/apodex-1.1-mini:free", "unbiased/pareto-26.10-preview",
    "openai/gpt-6.1-sol-pro", "openai/gpt-6.1-sol", "anthropic/claude-sonnet-5.5", "anthropic/claude-sonnet-5.5:batch", "typesafe/jev-router",
    "perceptron/perceptron-mk1.5", "fireworks/ember-1", "z-ai/glm-5.3-prime", "qwen/qwen3.8-max-prime", "aion-labs/aion-3.5-mini", "aion-labs/aion-3.5",
    "upstage/solar-mini4", "cohere/command-a-plus", "openai/gpt-6-luna-pro", "openai/gpt-6-luna-pro:batch", "openai/gpt-6-luna",
    "openai/gpt-6-luna:batch", "openai/gpt-6-sol-pro", "openai/gpt-6-sol-pro:batch", "openai/gpt-6-sol", "openai/gpt-6-sol:batch",
    "anthropic/claude-opus-5.5", "anthropic/claude-opus-5.5:batch", "nvidia/switchyard", "xiaomi/mimo-v2.6-pro-ultraspeed", "xiaomi/mimo-v2.6-flash",
    "xiaomi/mimo-v2.6-pro", "x-ai/grok-4.7", "qwen/qwen3.8-omni-flash", "prism-ml/ternary-bonsai-2-27b", "z-ai/glm-5.3-flashx", "unbiased/pareto",
    "~deepseek/deepseek-pro-latest", "~deepseek/deepseek-flash-latest", "inference-net/schematron-v2-turbo", "inference-net/schematron-v2-small",
    "~openai/gpt-astra-latest", "~openai/gpt-sol-latest", "~openai/gpt-terra-latest", "~openai/gpt-luna-latest", "sakana/fugu-ultra-v2",
    "sakana/fugu-max", "inclusionai/ling-3.0-flash-vl", "deepseek/deepseek-v4.1-flash", "deepseek/deepseek-v4.1-flash:batch", "inception/mercury-2.5",
    "nex-agi/nex-n2.5-mini", "nex-agi/nex-n2.5-pro", "openai/gpt-6-astra", "openai/gpt-6-astra:batch", "openai/gpt-6-astra-pro",
    "openai/gpt-6-astra-pro:batch", "inclusionai/ling-3.0-flash-sante:free", "qwen/qwen3.8-max-0902", "meta/muse-spark-1.3-contributor",
    "meta/muse-spark-1.3", "google/gemini-3.8-flash", "google/gemini-3.8-flash:batch", "anthropic/claude-fable-5.1", "anthropic/claude-fable-5.1:batch",
    "ibm-granite/granite-4.2-8b", "tencent/hy4-preview", "inclusionai/ling-3.0-flash-fin", "~z-ai/glm-flash-latest", "qwen/qwen3.8-flash",
    "z-ai/glm-5.3-flash", "z-ai/glm-5.3-flash:batch", "meta/muse-spark-1.2-contributor", "deepseek/deepseek-v4-flash-vision-exp", "tencent/hy-mt2-1.8b",
    "tencent/hy-mt2-30b-a3b", "~z-ai/glm-latest", "tencent/hy-mt2-7b", "z-ai/glm-5.3", "z-ai/glm-5.3:batch", "qwen/qwen3.8-27b",
    "dots-studio/dots-3-note-preview:free", "google/gemini-3.7-flash", "google/gemini-3.7-flash:batch", "bytedance-seed/seed-2-1-turbo",
    "qwen/qwen3.8-2.4t-a95b", "bytedance-seed/seed-2.0-code", "deepseek/deepseek-v4-pro-0813", "x-ai/grok-4.6", "liquid/lfm-2.5-2.6b:free",
    "nvidia/nemotron-3.5-lightning", "nvidia/nemotron-3.5-lightning:free", "sakana/sakana-namazu", "upstage/solar-pro4", "meta/muse-glimmer-30b",
    "meta/muse-spark-1.2", "~deepseek/deepseek-v4-flash-latest", "deepseek/deepseek-v4-flash-0731", "thinkingmachines/inkling-small",
    "thinkingmachines/inkling-small:free", "qwen/qwen3.7-flash", "anthropic/claude-opus-5", "anthropic/claude-opus-5:batch",
    "inclusionai/ling-3.0-flash", "poolside/laguna-s-2.1", "poolside/laguna-s-2.1:free", "google/gemini-3.6-flash", "google/gemini-3.6-flash:batch",
    "google/gemini-3.5-flash-lite", "google/gemini-3.5-flash-lite:batch", "meituan/longcat-2.0", "thinkingmachines/inkling",
    "thinkingmachines/inkling:free", "openrouter/auto-beta", "moonshotai/kimi-k3", "moonshotai/kimi-k3:batch", "meta/muse-spark-1.1",
    "openai/gpt-5.6-luna-pro", "openai/gpt-5.6-luna-pro:batch", "openai/gpt-5.6-luna", "openai/gpt-5.6-luna:batch", "openai/gpt-5.6-terra-pro",
    "openai/gpt-5.6-terra-pro:batch", "openai/gpt-5.6-terra", "openai/gpt-5.6-terra:batch", "openai/gpt-5.6-sol-pro", "openai/gpt-5.6-sol-pro:batch",
    "openai/gpt-5.6-sol", "openai/gpt-5.6-sol:batch", "x-ai/grok-4.5", "~x-ai/grok-latest", "aion-labs/aion-3.0-mini", "aion-labs/aion-3.0",
    "tencent/hy3", "poolside/laguna-xs-2.1", "poolside/laguna-xs-2.1:free", "anthropic/claude-sonnet-5", "anthropic/claude-sonnet-5:batch",
    "google/gemini-3.1-flash-lite-image", "sakana/fugu-ultra", "google/gemini-3.1-flash-image", "google/gemini-3-pro-image",
    "cohere/north-mini-code:free", "z-ai/glm-5.2", "openrouter/fusion", "moonshotai/kimi-k2.7-code", "~anthropic/claude-fable-latest",
    "anthropic/claude-fable-5", "anthropic/claude-fable-5:batch", "nvidia/nemotron-3.5-content-safety", "nvidia/nemotron-3.5-content-safety:free",
    "nvidia/nemotron-3-ultra-550b-a55b", "nvidia/nemotron-3-ultra-550b-a55b:free", "qwen/qwen3.7-plus", "minimax/minimax-m3", "stepfun/step-3.7-flash",
    "anthropic/claude-opus-4.8", "anthropic/claude-opus-4.8:batch", "qwen/qwen3.7-max", "x-ai/grok-build-0.1", "google/gemini-3.5-flash",
    "google/gemini-3.5-flash:batch", "perceptron/perceptron-mk1", "google/gemini-3.1-flash-lite", "google/gemini-3.1-flash-lite:batch",
    "openai/gpt-chat-latest", "x-ai/grok-4.3", "x-ai/grok-4.3:batch", "mistralai/mistral-medium-3-5", "mistralai/mistral-medium-3-5:batch",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", "~anthropic/claude-haiku-latest", "~openai/gpt-mini-latest", "~google/gemini-pro-latest",
    "~moonshotai/kimi-latest", "~google/gemini-flash-latest", "~anthropic/claude-sonnet-latest", "qwen/qwen3.5-plus-20260420", "qwen/qwen3.6-flash",
    "qwen/qwen3.6-35b-a3b", "qwen/qwen3.6-max-preview", "qwen/qwen3.6-27b", "openai/gpt-5.5-pro", "openai/gpt-5.5-pro:batch", "openai/gpt-5.5",
    "openai/gpt-5.5:batch", "deepseek/deepseek-v4-pro", "deepseek/deepseek-v4-flash", "tencent/hy3-preview", "xiaomi/mimo-v2.5-pro", "xiaomi/mimo-v2.5",
    "openai/gpt-5.4-image-2", "~anthropic/claude-opus-latest", "openrouter/pareto-code", "moonshotai/kimi-k2.6", "anthropic/claude-opus-4.7",
    "anthropic/claude-opus-4.7:batch", "z-ai/glm-5.1", "google/gemma-4-26b-a4b-it", "google/gemma-4-26b-a4b-it:free", "google/gemma-4-31b-it",
    "google/gemma-4-31b-it:free", "qwen/qwen3.6-plus", "z-ai/glm-5v-turbo", "arcee-ai/trinity-large-thinking", "x-ai/grok-4.20-multi-agent",
    "x-ai/grok-4.20", "google/lyria-3-pro-preview", "google/lyria-3-clip-preview", "rekaai/reka-edge", "minimax/minimax-m2.7", "openai/gpt-5.4-nano",
    "openai/gpt-5.4-nano:batch", "openai/gpt-5.4-mini", "openai/gpt-5.4-mini:batch", "mistralai/mistral-small-2603",
    "mistralai/mistral-small-2603:batch", "z-ai/glm-5-turbo", "nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3-super-120b-a12b:free",
    "bytedance-seed/seed-2.0-lite", "qwen/qwen3.5-9b", "openai/gpt-5.4-pro", "openai/gpt-5.4-pro:batch", "openai/gpt-5.4", "openai/gpt-5.4:batch",
    "inception/mercury-2", "google/gemini-3.1-flash-lite-preview", "bytedance-seed/seed-2.0-mini", "google/gemini-3.1-flash-image-preview",
    "qwen/qwen3.5-35b-a3b", "qwen/qwen3.5-27b", "qwen/qwen3.5-122b-a10b", "qwen/qwen3.5-flash-02-23", "google/gemini-3.1-pro-preview-customtools",
    "openai/gpt-5.3-codex", "aion-labs/aion-2.0", "google/gemini-3.1-pro-preview", "google/gemini-3.1-pro-preview:batch", "anthropic/claude-sonnet-4.6",
    "anthropic/claude-sonnet-4.6:batch", "qwen/qwen3.5-plus-02-15", "qwen/qwen3.5-397b-a17b", "minimax/minimax-m2.5", "z-ai/glm-5",
    "qwen/qwen3-max-thinking", "anthropic/claude-opus-4.6", "anthropic/claude-opus-4.6:batch", "qwen/qwen3-coder-next", "openrouter/free",
    "stepfun/step-3.5-flash", "moonshotai/kimi-k2.5", "upstage/solar-pro-3", "minimax/minimax-m2-her", "writer/palmyra-x5", "openai/gpt-audio",
    "openai/gpt-audio-mini", "z-ai/glm-4.7-flash", "openai/gpt-5.2-codex", "bytedance-seed/seed-1.6-flash", "bytedance-seed/seed-1.6",
    "minimax/minimax-m2.1", "z-ai/glm-4.7", "google/gemini-3-flash-preview", "google/gemini-3-flash-preview:batch", "nvidia/nemotron-3-nano-30b-a3b",
    "openai/gpt-5.2-chat", "openai/gpt-5.2-pro", "openai/gpt-5.2-pro:batch", "openai/gpt-5.2", "openai/gpt-5.2:batch", "mistralai/devstral-2512",
    "relace/relace-search", "z-ai/glm-4.6v", "openrouter/bodybuilder", "openai/gpt-5.1-codex-max", "amazon/nova-2-lite-v1",
    "mistralai/ministral-14b-2512", "mistralai/ministral-8b-2512", "mistralai/ministral-8b-2512:batch", "mistralai/ministral-3b-2512",
    "mistralai/mistral-large-2512", "mistralai/mistral-large-2512:batch", "deepseek/deepseek-v3.2", "anthropic/claude-opus-4.5",
    "anthropic/claude-opus-4.5:batch", "google/gemini-3-pro-image-preview", "openai/gpt-5.1", "openai/gpt-5.1:batch", "openai/gpt-5.1-codex",
    "openai/gpt-5.1-codex-mini", "moonshotai/kimi-k2-thinking", "amazon/nova-premier-v1", "perplexity/sonar-pro-search",
    "mistralai/voxtral-small-24b-2507", "openai/gpt-oss-safeguard-20b", "minimax/minimax-m2", "qwen/qwen3-vl-32b-instruct",
    "ibm-granite/granite-4.0-h-micro", "openai/gpt-5-image-mini", "anthropic/claude-haiku-4.5", "anthropic/claude-haiku-4.5:batch",
    "qwen/qwen3-vl-8b-thinking", "qwen/qwen3-vl-8b-instruct", "openai/gpt-5-image", "google/gemini-2.5-flash-image", "qwen/qwen3-vl-30b-a3b-thinking",
    "qwen/qwen3-vl-30b-a3b-instruct", "openai/gpt-5-pro", "openai/gpt-5-pro:batch", "z-ai/glm-4.6", "anthropic/claude-sonnet-4.5",
    "anthropic/claude-sonnet-4.5:batch", "deepseek/deepseek-v3.2-exp", "thedrummer/cydonia-24b-v4.1", "relace/relace-apply-3",
    "qwen/qwen3-vl-235b-a22b-thinking", "qwen/qwen3-vl-235b-a22b-instruct", "qwen/qwen3-max", "qwen/qwen3-coder-plus", "deepseek/deepseek-v3.1-terminus",
    "qwen/qwen3-coder-flash", "qwen/qwen3-next-80b-a3b-thinking", "qwen/qwen3-next-80b-a3b-instruct", "qwen/qwen-plus-2025-07-28",
    "moonshotai/kimi-k2-0905", "qwen/qwen3-30b-a3b-thinking-2507", "nousresearch/hermes-4-405b", "deepseek/deepseek-chat-v3.1",
    "mistralai/mistral-medium-3.1", "mistralai/mistral-medium-3.1:batch", "z-ai/glm-4.5v", "openai/gpt-5", "openai/gpt-5:batch", "openai/gpt-5-mini",
    "openai/gpt-5-mini:batch", "openai/gpt-5-nano", "openai/gpt-5-nano:batch", "openai/gpt-oss-120b", "openai/gpt-oss-120b:batch", "openai/gpt-oss-20b",
    "openai/gpt-oss-20b:batch", "anthropic/claude-opus-4.1", "anthropic/claude-opus-4.1:batch", "mistralai/codestral-2508",
    "mistralai/codestral-2508:batch", "qwen/qwen3-coder-30b-a3b-instruct", "qwen/qwen3-30b-a3b-instruct-2507", "z-ai/glm-4.5", "z-ai/glm-4.5-air",
    "qwen/qwen3-235b-a22b-thinking-2507", "qwen/qwen3-coder", "bytedance/ui-tars-1.5-7b", "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash-lite:batch", "qwen/qwen3-235b-a22b-2507", "moonshotai/kimi-k2", "cognitivecomputations/dolphin-mistral-24b-venice-edition",
    "tencent/hunyuan-a13b-instruct", "morph/morph-v3-large", "morph/morph-v3-fast", "baidu/ernie-4.5-vl-424b-a47b",
    "mistralai/mistral-small-3.2-24b-instruct", "minimax/minimax-m1", "google/gemini-2.5-flash", "google/gemini-2.5-flash:batch",
    "google/gemini-2.5-pro", "google/gemini-2.5-pro:batch", "openai/o3-pro", "google/gemini-2.5-pro-preview", "deepseek/deepseek-r1-0528",
    "anthropic/claude-sonnet-4", "mistralai/mistral-medium-3", "meta-llama/llama-guard-4-12b", "qwen/qwen3-30b-a3b", "qwen/qwen3-8b", "qwen/qwen3-14b",
    "qwen/qwen3-235b-a22b", "openai/o4-mini-high", "openai/o3", "openai/o3:batch", "openai/o4-mini", "openai/o4-mini:batch", "openai/gpt-4.1",
    "openai/gpt-4.1:batch", "openai/gpt-4.1-mini", "openai/gpt-4.1-mini:batch", "openai/gpt-4.1-nano", "openai/gpt-4.1-nano:batch",
    "meta-llama/llama-4-maverick", "meta-llama/llama-4-scout", "deepseek/deepseek-chat-v3-0324", "openai/o1-pro",
    "mistralai/mistral-small-3.1-24b-instruct", "google/gemma-3-4b-it", "google/gemma-3-12b-it", "cohere/command-a", "rekaai/reka-flash-3",
    "google/gemma-3-27b-it", "thedrummer/skyfall-36b-v2", "perplexity/sonar-reasoning-pro", "perplexity/sonar-pro", "perplexity/sonar-deep-research",
    "mistralai/mistral-saba", "openai/o3-mini-high", "aion-labs/aion-rp-llama-3.1-8b", "qwen/qwen2.5-vl-72b-instruct", "qwen/qwen-plus",
    "openai/o3-mini", "openai/o3-mini:batch", "mistralai/mistral-small-24b-instruct-2501", "perplexity/sonar", "deepseek/deepseek-r1",
    "minimax/minimax-01", "microsoft/phi-4", "deepseek/deepseek-chat", "sao10k/l3.3-euryale-70b", "openai/o1", "cohere/command-r7b-12-2024",
    "meta-llama/llama-3.3-70b-instruct", "amazon/nova-lite-v1", "amazon/nova-micro-v1", "amazon/nova-pro-v1", "openai/gpt-4o-2024-11-20",
    "mistralai/mistral-large-2407", "qwen/qwen-2.5-coder-32b-instruct", "thedrummer/unslopnemo-12b", "anthracite-org/magnum-v4-72b",
    "qwen/qwen-2.5-7b-instruct", "meta-llama/llama-3.2-1b-instruct", "meta-llama/llama-3.2-3b-instruct", "qwen/qwen-2.5-72b-instruct",
    "cohere/command-r-08-2024", "cohere/command-r-plus-08-2024", "sao10k/l3.1-euryale-70b", "nousresearch/hermes-3-llama-3.1-70b",
    "nousresearch/hermes-3-llama-3.1-405b", "sao10k/l3-lunaris-8b", "openai/gpt-4o-2024-08-06", "meta-llama/llama-3.1-70b-instruct",
    "meta-llama/llama-3.1-8b-instruct", "mistralai/mistral-nemo", "openai/gpt-4o-mini", "openai/gpt-4o-mini-2024-07-18", "openai/gpt-4o-mini:batch",
    "google/gemma-2-27b-it", "openai/gpt-4o", "openai/gpt-4o-2024-05-13", "openai/gpt-4o:batch", "mistralai/mixtral-8x22b-instruct",
    "microsoft/wizardlm-2-8x22b", "openai/gpt-4-turbo", "openai/gpt-4-turbo:batch", "mistralai/mistral-large", "openai/gpt-3.5-turbo-0613",
    "openrouter/auto", "openai/gpt-3.5-turbo-instruct", "openai/gpt-3.5-turbo-16k", "mancer/weaver", "undi95/remm-slerp-l2-13b",
    "gryphe/mythomax-l2-13b", "openai/gpt-3.5-turbo", "openai/gpt-3.5-turbo:batch", "openai/gpt-4"
];
const ODD = ['', 'custom', '__custom__', 'gpt-35-turbo', 'gpt-35-turbo-16k', 'claude-opus-45', 'claude-sonnet-45', 'gemini-15-pro', 'o2-test', 'gpt-oss-120b', 'openai/gpt-oss-120b',
    'chatgpt-4o-latest', 'anthropic/claude-3.5-sonnet:beta', 'claude-3-opus-20240229', 'claude-instant-1.2', 'claude-2.1', 'claude-v1', 'my-gpt-5-proxy', 'relay/gpt-6-sol', 'claude-sonnet-5-thinking',
    'claude-opus-4-5-thinking', 'gemini-3.8-flash-thinking', 'gemma-4-31b-it', 'o10-preview', 'o1-pro', 'gpt-5.10', 'deepseek-chat', 'grok-4.7', 'glm-5.3-prime', 'command-a-plus-05-2026',
    'gpt-4o-2024-11-20', 'claude-sonnet-4-5@20250929', 'models/gemini-3.8-flash', 'gemini-flash-latest', 'GPT-6-SOL', 'Claude-Opus-5', undefined, null, 123];
// 새 세대 (예전 규칙이 놓치던 이름 — 가장 새 세대처럼 다뤄야 함)
const FUTURE = ['o5', 'o5-mini', 'o6-pro', 'openai/o5', 'openai/o5-mini', 'gpt-7', 'gpt-7-mini', 'gpt-7.1-sol', 'gpt-8-chat-latest', 'openai/gpt-7', 'openai/gpt-9-luna',
    'claude-haiku-5', 'claude-haiku-5-5', 'claude-opus-6', 'claude-sonnet-6', 'claude-sonnet-6-1', 'claude-fable-6', 'claude-mythos-5', 'anthropic/claude-opus-6', 'anthropic/claude-haiku-5.1',
    'gemini-4-flash', 'gemini-4.1-pro', 'gemini-5-flash-lite', 'google/gemini-4-flash'];
const PROVIDERS = ['openai', 'openrouter', 'claude', 'makersuite', 'google', 'vertexai', 'custom', 'deepseek', 'azure_openai', 'xai', 'zai'];
const BODIES = [
    () => ({ max_tokens: 100, temperature: 0.7, top_p: 0.9, top_k: 40, frequency_penalty: 0.1, presence_penalty: 0.2, stream: false }),
    () => ({ temperature: 1, stream: true }),
    () => ({ max_tokens: 0, top_k: 1 }),
];

await test('요청 규칙: 2026-10 까지의 이름은 예전 세 벌(번역기 · 다시 쓰기 · TTS)과 결과가 같다', () => {
    let n = 0;
    for (const id of [...KNOWN_IDS, ...ODD]) {
        for (const p of PROVIDERS) {
            for (const b of BODIES) {
                const want = oldTts(p, id, b());
                const a = b(); oldTranslator(p, id, a);
                const r = b(); oldRewrite(p, id, r);
                assert.deepEqual(a, want, `번역기 ≠ TTS: ${p} ${id}`);
                assert.deepEqual(r, want, `다시 쓰기 ≠ TTS: ${p} ${id}`);
                const got = b();
                const ret = LM.applyModelRequestRules(p, id, got);
                assert.equal(ret, got, '고친 본문을 그대로 돌려준다');
                assert.equal(JSON.stringify(got), JSON.stringify(want), `${p} ${id}`);
                n++;
            }
            assert.equal(LM.lowEffort(p, id), oldLowEffort(p === 'google' ? 'makersuite' : p, id), `lowEffort ${p} ${id}`);
        }
    }
    assert.ok(n > 20000, `비교 ${n}개`);
});
await test('요청 규칙: 새 세대 이름은 가장 새 세대처럼 (예전 규칙은 놓쳤음)', () => {
    const full = BODIES[0];
    const rules = (p, id) => LM.applyModelRequestRules(p, id, full());
    // o 시리즈 (OpenAI 직접: max_completion_tokens, 샘플링 뺌 · OpenRouter: 이름 바꾸기 없이 샘플링만)
    for (const id of ['o5', 'o5-mini', 'o6-pro']) {
        assert.deepEqual(rules('openai', id), { max_completion_tokens: 100, top_k: 40, stream: false }, id);
        assert.notDeepEqual(oldTts('openai', id, full()), rules('openai', id), `${id} 는 예전 규칙이 놓쳤다`);
    }
    assert.deepEqual(rules('openrouter', 'openai/o5'), { max_tokens: 100, top_k: 40, stream: false });
    // GPT-7 이후 = GPT-6 과 같음
    for (const id of ['gpt-7', 'gpt-7-mini', 'gpt-7.1-sol', 'gpt-8-chat-latest']) {
        assert.deepEqual(rules('openai', id), rules('openai', 'gpt-6-sol'), id);
        assert.deepEqual(rules('openai', id), { max_completion_tokens: 100, top_k: 40, stream: false }, id);
    }
    assert.deepEqual(rules('openrouter', 'openai/gpt-7'), rules('openrouter', 'openai/gpt-6-sol'));
    assert.deepEqual(rules('openrouter', 'openai/gpt-9-luna'), { max_tokens: 100, top_k: 40, stream: false });
    // Claude 5 이후 (어느 공급자로 가든)
    for (const id of ['claude-haiku-5', 'claude-haiku-5-5', 'claude-opus-6', 'claude-sonnet-6', 'claude-sonnet-6-1', 'claude-fable-6', 'claude-mythos-5', 'anthropic/claude-opus-6', 'anthropic/claude-haiku-5.1']) {
        for (const p of ['claude', 'openrouter', 'custom', 'vertexai']) {
            assert.deepEqual(rules(p, id), { max_tokens: 100, stream: false }, `${p} ${id}`);
        }
    }
    // lowEffort
    for (const id of ['claude-haiku-5', 'claude-opus-6', 'claude-sonnet-6-1', 'claude-mythos-5']) assert.equal(LM.lowEffort('claude', id), 'low', id);
    for (const id of ['gemini-4-flash', 'gemini-4.1-pro', 'gemini-5-flash-lite']) {
        assert.equal(LM.lowEffort('makersuite', id), 'low', id);
        assert.equal(LM.lowEffort('vertexai', id), 'low', id);
        assert.equal(LM.lowEffort('google', id), 'low', id);
        assert.equal(oldLowEffort('makersuite', id), '', `${id} 는 예전 규칙이 놓쳤다`);
    }
    assert.equal(LM.lowEffort('openrouter', 'google/gemini-4-flash'), '', 'OpenRouter 는 보내지 않음 (예전과 같음)');
    assert.equal(LM.lowEffort('claude', 'claude-haiku-4-5'), '', '적응형이 아닌 Claude 4');
    // 새 세대가 아닌데 숫자가 큰 이름은 그대로 (Azure gpt-35 · 별칭 45 · 15)
    for (const [p, id] of [['openai', 'gpt-35-turbo'], ['claude', 'claude-opus-45'], ['makersuite', 'gemini-15-pro'], ['openai', 'o2-test']]) {
        assert.deepEqual(rules(p, id), oldTts(p, id, full()), id);
        assert.equal(LM.lowEffort(p, id), oldLowEffort(p, id), id);
    }
    for (const id of FUTURE) assert.ok(!KNOWN_IDS.includes(id), `${id} 는 2026-10 목록에 없는 이름`);
});

// ---------- 2) TTS 요청 본문 (1.3.x 로 만든 값)
const GOLD = {
    build: [
        ["openai", "gpt-5.6-terra", {}, "{\"chat_completion_source\":\"openai\",\"model\":\"gpt-5.6-terra\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"stream\":false,\"reasoning_effort\":\"low\",\"max_completion_tokens\":8192}"],
        ["openai", "gpt-5.1", {}, "{\"chat_completion_source\":\"openai\",\"model\":\"gpt-5.1\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"stream\":false,\"reasoning_effort\":\"low\",\"max_completion_tokens\":8192}"],
        ["openai", "gpt-5-chat-latest", {}, "{\"chat_completion_source\":\"openai\",\"model\":\"gpt-5-chat-latest\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"stream\":false,\"reasoning_effort\":\"low\",\"max_completion_tokens\":8192}"],
        ["openai", "o4-mini", {}, "{\"chat_completion_source\":\"openai\",\"model\":\"o4-mini\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"stream\":false,\"reasoning_effort\":\"low\",\"max_completion_tokens\":8192}"],
        ["openai", "gpt-4.1", {}, "{\"chat_completion_source\":\"openai\",\"model\":\"gpt-4.1\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"reasoning_effort\":\"low\"}"],
        ["openai", "gpt-6-sol", {"reverse_proxy": "https://proxy.test/v1", "proxy_password": "pw"}, "{\"chat_completion_source\":\"openai\",\"model\":\"gpt-6-sol\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"stream\":false,\"reasoning_effort\":\"low\",\"reverse_proxy\":\"https://proxy.test/v1\",\"proxy_password\":\"pw\",\"max_completion_tokens\":8192}"],
        ["claude", "claude-sonnet-5", {}, "{\"chat_completion_source\":\"claude\",\"model\":\"claude-sonnet-5\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"max_tokens\":8192,\"stream\":false,\"use_sysprompt\":true,\"reasoning_effort\":\"low\"}"],
        ["claude", "claude-haiku-4-5", {"chat_completion_source": "claude", "reverse_proxy": "https://p.test", "proxy_password": "x"}, "{\"chat_completion_source\":\"claude\",\"model\":\"claude-haiku-4-5\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"use_sysprompt\":true,\"reverse_proxy\":\"https://p.test\",\"proxy_password\":\"x\"}"],
        ["makersuite", "gemini-3.8-flash", {}, "{\"chat_completion_source\":\"makersuite\",\"model\":\"gemini-3.8-flash\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"use_sysprompt\":true,\"reasoning_effort\":\"low\"}"],
        ["makersuite", "gemini-2.5-flash", {}, "{\"chat_completion_source\":\"makersuite\",\"model\":\"gemini-2.5-flash\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"use_sysprompt\":true}"],
        ["vertexai", "gemini-3.1-pro-preview", {"vertexai_auth_mode": "full"}, "{\"chat_completion_source\":\"vertexai\",\"model\":\"gemini-3.1-pro-preview\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"use_sysprompt\":true,\"reasoning_effort\":\"low\",\"vertexai_auth_mode\":\"full\",\"vertexai_region\":\"global\",\"vertexai_express_project_id\":\"p1\"}"],
        ["openrouter", "openai/gpt-5.6-terra", {}, "{\"chat_completion_source\":\"openrouter\",\"model\":\"openai/gpt-5.6-terra\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"max_tokens\":8192,\"stream\":false}"],
        ["openrouter", "anthropic/claude-opus-5.5", {}, "{\"chat_completion_source\":\"openrouter\",\"model\":\"anthropic/claude-opus-5.5\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"max_tokens\":8192,\"stream\":false}"],
        ["custom", "relay-model", {}, "{\"chat_completion_source\":\"custom\",\"model\":\"relay-model\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"custom_url\":\"http://127.0.0.1:5001/v1\",\"custom_include_headers\":\"{X-H: 1}\",\"custom_include_body\":\"{top_k: 5}\",\"custom_exclude_body\":\"{logit_bias}\"}"],
        ["zai", "glm-5.2", {}, "{\"chat_completion_source\":\"zai\",\"model\":\"glm-5.2\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"zai_endpoint\":\"common\"}"],
        ["minimax", "MiniMax-M2.7", {}, "{\"chat_completion_source\":\"minimax\",\"model\":\"MiniMax-M2.7\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"minimax_endpoint\":\"global\"}"],
        ["azure_openai", "gpt-5.6", {"azure_base_url": "https://x.openai.azure.com", "azure_deployment_name": "dep", "azure_api_version": "2024-10-21"}, "{\"chat_completion_source\":\"azure_openai\",\"model\":\"gpt-5.6\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"azure_base_url\":\"https://x.openai.azure.com\",\"azure_deployment_name\":\"dep\",\"azure_api_version\":\"2024-10-21\"}"],
        ["pollinations", "openai", {}, "{\"chat_completion_source\":\"pollinations\",\"model\":\"openai\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"pollinations_endpoint\":\"authenticated\"}"],
        ["workers_ai", "@cf/meta/llama", {"workers_ai_account_id": "acc"}, "{\"chat_completion_source\":\"workers_ai\",\"model\":\"@cf/meta/llama\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"workers_ai_account_id\":\"acc\"}"],
        ["siliconflow", "deepseek-ai/DeepSeek-V3", {}, "{\"chat_completion_source\":\"siliconflow\",\"model\":\"deepseek-ai/DeepSeek-V3\",\"messages\":[{\"role\":\"system\",\"content\":\"S\"},{\"role\":\"user\",\"content\":\"U\"}],\"temperature\":0.4,\"max_tokens\":8192,\"stream\":false,\"siliconflow_endpoint\":\"global\"}"],
    ],
    status: [
        ["custom", {}, "{\"chat_completion_source\":\"custom\",\"custom_url\":\"http://127.0.0.1:5001/v1\",\"custom_include_headers\":\"{X-H: 1}\"}"],
        ["openai", {"reverse_proxy": "https://proxy.test/v1", "proxy_password": "pw"}, "{\"chat_completion_source\":\"openai\",\"reverse_proxy\":\"https://proxy.test/v1\",\"proxy_password\":\"pw\"}"],
        ["workers_ai", {"workers_ai_account_id": "acc"}, "{\"chat_completion_source\":\"workers_ai\",\"workers_ai_account_id\":\"acc\"}"],
        ["azure_openai", {"azure_base_url": "https://x.openai.azure.com", "azure_deployment_name": "dep", "azure_api_version": "v"}, "{\"chat_completion_source\":\"azure_openai\",\"azure_base_url\":\"https://x.openai.azure.com\",\"azure_deployment_name\":\"dep\",\"azure_api_version\":\"v\"}"],
    ],
};
const GOLD_CS = { chat_completion_source: 'openai', custom_url: 'http://127.0.0.1:5001/v1/', custom_include_headers: 'X-H: 1', custom_include_body: 'top_k: 5', custom_exclude_body: 'logit_bias', openai_model: 'gpt-st', claude_model: 'claude-st', custom_model: 'st-custom', vertexai_region: 'global', vertexai_express_project_id: 'p1', reverse_proxy: '', proxy_password: '' };
await test('TTS buildRequest: 1.3.x 와 글자까지 같은 /generate 본문 (모델 규칙 · reasoning_effort · 공급자 설정 · 프록시)', () => {
    reset();
    for (const [p, m, extra, want] of GOLD.build) {
        T.ctx.chatCompletionSettings = { ...GOLD_CS, ...extra };
        const got = JSON.stringify(stapi.buildRequest({ engine: 'provider', provider: p, provider_models: { [p]: m }, custom_url: '', temperature: 0.4 }, 'S', 'U'));
        assert.equal(got, want, `${p} ${m}`);
    }
});
await test('TTS fetchProviderModels: 1.3.x 와 글자까지 같은 /status 본문 · 주소 · 머리글', async () => {
    for (const [p, extra, want] of GOLD.status) {
        reset({ keys: { api_key_openai: SECRET(true), api_key_workers_ai: SECRET(true), api_key_azure_openai: SECRET(true) } });
        T.ctx.chatCompletionSettings = { ...GOLD_CS, ...extra, chat_completion_source: 'openai' };
        useFetch(() => ({ status: 200, body: { data: [{ id: 'a' }] } }));
        await stapi.fetchProviderModels({ engine: 'provider', provider: p, provider_models: {}, custom_url: '' });
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, '/api/backends/chat-completions/status');
        assert.equal(calls[0].method, 'POST');
        assert.equal(calls[0].headers['X-CSRF-Token'], 'tok');
        assert.equal(calls[0].raw, want, p);
    }
});

// ---------- 3) 목록
await test('sourceOf · canList · STATUS_SOURCES · KNOWN (새것 먼저 · 중복 없음 · 근거 있는 새 이름)', () => {
    assert.equal(LM.sourceOf('google'), 'makersuite');
    assert.equal(LM.sourceOf(' vertexai '), 'vertexai');
    assert.equal(LM.canList('google'), true);
    for (const s of ['claude', 'vertexai', 'zai', 'minimax', 'perplexity', 'ai21', 'cometapi']) assert.equal(LM.canList(s), false, s);
    for (const s of ['openai', 'openrouter', 'custom', 'cohere', 'mistralai', 'groq', 'xai', 'deepseek', 'azure_openai']) assert.equal(LM.canList(s), true, s);
    assert.ok(Object.isFrozen(LM.KNOWN) && Object.isFrozen(LM.KNOWN.openai) && Object.isFrozen(LM.STATUS_SOURCES));
    for (const [s, ids] of Object.entries(LM.KNOWN)) assert.equal(new Set(ids).size, ids.length, `${s} 중복`);
    assert.equal(LM.KNOWN.openai[0], 'gpt-6.1-sol');
    assert.equal(LM.KNOWN.claude[0], 'claude-sonnet-5-5');
    assert.ok(LM.KNOWN.claude.includes('claude-opus-5-5'));
    assert.deepEqual(LM.KNOWN.zai.slice(0, 4), ['glm-5.3-prime', 'glm-5.3-flashx', 'glm-5.3-flash', 'glm-5.3']);
    assert.ok(LM.KNOWN.openrouter.includes('mistralai/mistral-large-4-0') && LM.KNOWN.openrouter.includes('x-ai/grok-4.7') && LM.KNOWN.openrouter.includes('cohere/command-a-plus'));
    assert.equal(LM.KNOWN.makersuite[0], 'gemini-3.8-flash');
    assert.equal(LM.KNOWN.minimax, undefined, 'MiniMax 는 실리태번 화면 목록만 (부풀리지 않음)');
});
await test('modelEntries: 채팅 모델만 · 끝난 모델 뺌 · created 큰 것 먼저 · 없으면 이름 속 버전 큰 것 먼저', () => {
    const ids = (s, d) => LM.modelIdsFrom(s, d);
    assert.deepEqual(ids('openai', { data: [{ id: 'gpt-4.1', created: 10 }, { id: 'text-embedding-3-large', created: 99 }, { id: 'whisper-1' }, { id: 'tts-1-hd' }, { id: 'gpt-image-1' }, { id: 'dall-e-3' },
        { id: 'omni-moderation-latest' }, { id: 'gpt-realtime' }, { id: 'gpt-4o-transcribe' }, { id: 'sora-2' }, { id: 'computer-use-preview' }, { id: 'gpt-5-codex' }, { id: 'o3-deep-research' },
        { id: 'gpt-6.1-sol', created: 1790000000 }, { id: 'gpt-6-sol', created: 1789000000 }, { id: 'o4-mini', created: 50 }] }), ['gpt-6.1-sol', 'gpt-6-sol', 'o4-mini', 'gpt-4.1']);
    assert.deepEqual(ids('cohere', { models: [{ name: 'command-a-plus-05-2026', endpoints: ['chat', 'generate'] }, { name: 'embed-v4.0', endpoints: ['embed'] }, { name: 'rerank-v3.5', endpoints: ['rerank'] }, { name: 'command-r' }] }),
        ['command-a-plus-05-2026', 'command-r']);
    assert.deepEqual(ids('mistralai', { data: [{ id: 'mistral-large-latest', capabilities: { completion_chat: true } }, { id: 'mistral-embed', capabilities: { completion_chat: false } }, { id: 'codestral-x' }] }),
        ['codestral-x', 'mistral-large-latest']);
    assert.deepEqual(ids('groq', { data: [{ id: 'whisper-large-v3' }, { id: 'meta-llama/llama-prompt-guard-2-86m' }, { id: 'playai-tts' }, { id: 'canopylabs/orpheus-v1-english' }, { id: 'old', active: false }, { id: 'llama-3.3-70b-versatile' }] }),
        ['llama-3.3-70b-versatile']);
    const past = new Date(Date.now() - DAY).toISOString(), future = new Date(Date.now() + DAY).toISOString();
    assert.deepEqual(ids('openrouter', { data: [
        { id: 'anthropic/claude-sonnet-5.5', created: 1790000000, architecture: { output_modalities: ['text'] } },
        { id: 'anthropic/claude-sonnet-5.5:batch', created: 1790000000 },
        { id: 'google/gemini-nano-banana-2.1', created: 1791000000, architecture: { output_modalities: ['image', 'text'] } },
        { id: 'google/gemini-3.8-flash-tts', created: 1791000001, architecture: { output_modalities: ['audio'] } },
        { id: 'old/expired', created: 1792000000, expiration_date: past },
        { id: 'qwen/qwen3.6-max-preview', created: 1700000000, expiration_date: future },
        { id: 'OR_Website' },
    ] }), ['google/gemini-nano-banana-2.1', 'anthropic/claude-sonnet-5.5', 'qwen/qwen3.6-max-preview']);
    assert.deepEqual(ids('makersuite', { data: [{ id: 'gemini-2.5-flash' }, { id: 'gemini-3.8-flash' }, { id: 'gemini-3.10-pro' }, { id: 'gemini-3.8-flash-lite' }, { id: 'gemini-3-flash-preview' },
        { id: 'gemini-3.8-flash-tts' }, { id: 'gemma-4-31b-it' }, { name: 'models/gemini-3.7-flash' }] }),
        ['gemini-3.10-pro', 'gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3.7-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemma-4-31b-it']);
    assert.deepEqual(ids('custom', ['z', { id: 'gpt-5' }, { id: 'gpt-5.1' }, { id: 'gpt-4o' }, { id: 'claude-opus-4-5-20251101' }, { id: 'claude-opus-4-5' }, { id: 'custom' }, 'gpt-5']),
        ['claude-opus-4-5', 'claude-opus-4-5-20251101', 'gpt-5.1', 'gpt-5', 'gpt-4o', 'z']);
    assert.deepEqual(ids('custom', { data: [{ id: 'a', created: 1700000000000 }, { id: 'b', created: 1800000000 }] }), ['b', 'a'], '밀리초 created');
    assert.deepEqual(ids('openai', { error: true, data: { data: [] } }), []);
    assert.deepEqual(ids('openai', null), []);
});
await test('pageModels: #model_<id>_select (Google = model_google_select) · 빈 값 · OR_Website · custom · __custom__ · OpenAI 비채팅(숨은 묶음 포함) 뺌', () => {
    reset();
    const opts = (vals) => ({ options: vals.map(v => ({ value: v })) });
    globalThis.document = { getElementById: (id) => ({
        model_openai_select: opts(['my-registered', 'gpt-6-sol', 'babbage-002', 'davinci-002', 'gpt-6-sol', '', 'text-embedding-3-small', 'tts-1', 'whisper-1', 'gpt-4o']),
        model_google_select: opts(['gemini-3.8-flash', 'gemini-3.8-flash-tts']),
        model_openrouter_select: opts(['OR_Website', 'x/y', 'x/y:batch']),
        model_custom_select: opts(['', 'relay-a', 'custom', '__custom__']),
    })[id] || null };
    try {
        assert.deepEqual(LM.pageModels('openai'), ['my-registered', 'gpt-6-sol', 'gpt-4o']);
        assert.deepEqual(LM.pageModels('google'), ['gemini-3.8-flash']);
        assert.deepEqual(LM.pageModels('openrouter'), ['x/y']);
        assert.deepEqual(LM.pageModels('custom'), ['relay-a']);
        assert.deepEqual(LM.pageModels('custom', { inheritCustom: false }), [], '다른 Custom 주소면 본체 목록을 쓰지 않음');
        assert.deepEqual(LM.pageModels('claude'), []);
        // TTS 도 같은 목록 (OpenAI 비채팅이 이제 빠짐)
        assert.deepEqual(stapi.pageModels('openai', { provider: 'openai' }), ['my-registered', 'gpt-6-sol', 'gpt-4o']);
        assert.deepEqual(stapi.pageModels('custom', { provider: 'custom', custom_url: 'https://own.test/v1' }), []);
        assert.deepEqual(stapi.pageModels('nope', {}), []);
    } finally { delete globalThis.document; }
    assert.deepEqual(LM.pageModels('openai'), [], 'document 가 없으면 빈 목록');
});
await test('registered: 모델 등록(model_register) 이름 · 빈 값 · 중복 뺌', () => {
    reset({ ext: { model_register: { sources: { claude: ['claude-sonnet-5-5', ' claude-sonnet-5-5 ', '', 'custom'], vertexai: ['my-vx'] }, picks: {} } } });
    assert.deepEqual(LM.registered('claude'), ['claude-sonnet-5-5']);
    assert.deepEqual(LM.registered('vertexai'), ['my-vx']);
    assert.deepEqual(LM.registered('openai'), []);
    reset();
    assert.deepEqual(LM.registered('claude'), [], '모델 등록 설정이 없어도 오류 없음');
});
await test('캐시: localStorage bl_live_models_v1 · created 함께 · 최근 12개 · settings.json 에 안 둠 · TTL', () => {
    reset();
    LM.put('openai', [{ id: 'gpt-6.1-sol', created: 3 }, { id: 'gpt-6-sol', created: 2 }, { id: 'whisper-1' }, 'gpt-6-sol'], { at: Date.now() - 60000 });
    assert.deepEqual(LM.cached('openai').ids, ['gpt-6.1-sol', 'gpt-6-sol'], '거르고 중복 뺌 · 받은 순서 그대로');
    assert.deepEqual(LM.cached('openai').created, [3, 2]);
    assert.equal(LM.isStale('openai'), false);
    const saved = JSON.parse(globalThis.localStorage.data.bl_live_models_v1);
    assert.deepEqual(saved.openai.ids, ['gpt-6.1-sol', 'gpt-6-sol']);
    assert.equal(JSON.stringify(T.ext), '{}', 'extension_settings 는 그대로');
    for (let i = 0; i < 15; i++) LM.put(`custom:https://r${i}.test/v1`, ['m'], { at: Date.now() - (15 - i) * 1000 });
    assert.equal(Object.keys(JSON.parse(globalThis.localStorage.data.bl_live_models_v1)).length, 12);
    assert.ok(LM.cached('custom:https://r14.test/v1').ids.length, '방금 넣은 것은 남음');
    assert.equal(LM.cached('openai').ids.length, 0, '가장 오래된 것부터 빠짐');
    LM.put('xai', ['grok-4.7'], { at: Date.now() - DAY - 1000 });
    assert.equal(LM.isStale('xai'), true, '하루 지남');
    assert.equal(LM.isStale('deepseek'), true, '없음');
    // 저장소를 못 쓰면 이번 세션만
    globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    LM._resetForTest();
    LM.put('groq', ['llama-3.3-70b-versatile']);
    assert.deepEqual(LM.cached('groq').ids, ['llama-3.3-70b-versatile']);
});
await test('옛 캐시 읽기 (지우지 않음): TTS lemon_voice_model_lists · 번역기 · 다시 쓰기 · 한글화 패널 · 장기 기억 · 모델 전환 — 가장 최근 것', () => {
    const now = Date.now();
    const legacy = { openrouter: { models: ['anthropic/claude-x', 'z-ai/glm', 'a/b:batch'], at: now - 1000 }, 'custom:https://relay.test/v1': { models: ['tts-old'], at: now - 5 * DAY } };
    const ext = {
        'llm-translator-custom': { custom_model_lists: { 'https://relay.test/v1/': { models: ['tr-1', 'tr-2'], fetched_at: new Date(now - 2 * DAY).toISOString() } } },
        ban_word_rewrite: { customModelLists: { 'https://relay.test/v1': { models: ['rw-1'], fetchedAt: new Date(now - 3 * DAY).toISOString() } } },
        'prompt-panel': { customModelLists: { 'https://other.test/v1': ['pp-1', 'pp-2'] } },
        memoria: { direct: { customModelLists: { 'https://mem.test/v1': { models: ['mem-1'], fetchedAt: new Date(now - 1000).toISOString() } } } },
        model_switch: { lists: { 'https://ms.test/v1': { models: ['ms-1'], fetchedAt: new Date(now - 1000).toISOString() } } },
    };
    reset({ ext, storage: { lemon_voice_model_lists: JSON.stringify(legacy) } });
    const before = JSON.stringify(ext);
    assert.deepEqual(LM.cached('openrouter').ids, ['anthropic/claude-x', 'z-ai/glm'], 'TTS 옛 캐시 (:batch 는 거름)');
    assert.equal(LM.isStale('openrouter'), false);
    assert.deepEqual(LM.cached('custom:https://relay.test/v1').ids, ['tr-1', 'tr-2'], '번역기 것이 가장 최근 (주소 끝 / 무시)');
    assert.deepEqual(LM.cached('custom:https://other.test/v1').ids, ['pp-1', 'pp-2'], '한글화 패널의 배열 꼴');
    assert.equal(LM.cached('custom:https://other.test/v1').at, 0);
    assert.equal(LM.isStale('custom:https://other.test/v1'), true, '시각이 없는 목록은 오래된 것으로');
    assert.deepEqual(LM.cached('custom:https://mem.test/v1').ids, ['mem-1']);
    assert.deepEqual(LM.cached('custom:https://ms.test/v1').ids, ['ms-1']);
    LM.put('custom:https://relay.test/v1', ['new-1']);
    assert.deepEqual(LM.cached('custom:https://relay.test/v1').ids, ['new-1'], '새로 받은 것이 이김');
    assert.equal(JSON.stringify(ext), before, '옛 캐시는 손대지 않음');
    assert.ok(globalThis.localStorage.data.lemon_voice_model_lists, '옛 TTS 캐시도 그대로');
});
await test('list: 받은 목록이 있으면 그것(새것 먼저) + 모델 등록만 · 없으면 모델 등록 → KNOWN → 화면 목록 · 저장된 모델이 없으면 savedMissing', () => {
    reset({ ext: { model_register: { sources: { openai: ['my-gpt'], claude: ['claude-test-x'] }, picks: {} } } });
    const opts = (vals) => ({ options: vals.map(v => ({ value: v })) });
    globalThis.document = { getElementById: (id) => ({ model_openai_select: opts(['my-gpt', 'gpt-6-astra', 'gpt-3.5-turbo']), model_claude_select: opts(['my-claude', 'claude-fable-5-1', 'claude-opus-4-20250514']) })[id] || null };
    try {
        let r = LM.list('openai', { saved: 'gpt-3.5-turbo' });
        assert.equal(r.live, false);
        assert.deepEqual(r.ids.slice(0, 3), ['my-gpt', 'gpt-6.1-sol', 'gpt-6-astra']);
        assert.ok(r.ids.includes('gpt-3.5-turbo') && r.ids.indexOf('gpt-3.5-turbo') > r.ids.indexOf('gpt-4o-mini'), '화면 목록의 옛 이름은 뒤에');
        assert.equal(r.savedMissing, false);
        assert.deepEqual(LM.list('openai', { known: false }).ids, ['my-gpt', 'gpt-6-astra', 'gpt-3.5-turbo']);
        assert.deepEqual(LM.list('openai', { known: false, page: false }).ids, ['my-gpt']);
        LM.put('openai', [{ id: 'gpt-6.1-sol', created: 9 }, { id: 'gpt-6-sol', created: 8 }]);
        r = LM.list('openai', { saved: 'gpt-3.5-turbo' });
        assert.equal(r.live, true);
        assert.deepEqual(r.ids, ['gpt-6.1-sol', 'gpt-6-sol', 'my-gpt'], '공급자가 안 주는 옛 이름 · KNOWN 은 붙이지 않음');
        assert.equal(r.savedMissing, true, '저장된 모델은 그대로 두고 표시만');
        assert.equal(r.key, 'openai');
        assert.deepEqual(LM.list('openai', { all: true }).ids.slice(0, 5), ['gpt-6.1-sol', 'gpt-6-sol', 'my-gpt', 'gpt-6-astra', 'gpt-3.5-turbo'], 'all: 받은 목록 → 화면 → 등록 → KNOWN');
        assert.equal(LM.list('openai', { saved: 'custom' }).savedMissing, false, '직접 입력 값은 모델이 아님');
        // 목록을 받을 수 없는 공급자 (Claude): 등록 → KNOWN(최신 먼저) → 화면 목록
        r = LM.list('claude', { saved: 'claude-opus-4-20250514' });
        assert.deepEqual(r.ids.slice(0, 3), ['claude-test-x', 'claude-sonnet-5-5', 'claude-opus-5-5']);
        assert.ok(r.ids.includes('my-claude') && r.ids.includes('claude-opus-4-20250514'));
        assert.equal(r.savedMissing, false);
        // Custom: 주소별 키 · 본체 주소면 화면 목록
        LM.put('custom:https://relay.test/v1', ['r-1']);
        assert.deepEqual(LM.list('custom', { customUrl: 'https://relay.test/v1/' }).ids, ['r-1']);
        assert.equal(LM.list('custom').key, 'custom:http://127.0.0.1:5001/v1');
    } finally { delete globalThis.document; }
});
await test('refresh: /status 본문 (Custom 헤더 · 본체 프록시) · 같은 목록 요청은 하나로 · 받은 뒤 onChange · 실패는 던지고 예전 목록 그대로', async () => {
    reset({ cs: { chat_completion_source: 'openai', reverse_proxy: 'https://proxy.test/v1', proxy_password: 'pw' } });
    useFetch(async () => { await new Promise(r => setTimeout(r, 5)); return { status: 200, body: { data: [{ id: 'gpt-6-sol', created: 2 }, { id: 'tts-1' }, { id: 'gpt-6.1-sol', created: 3 }] } }; });
    const seen = [];
    const off = LM.onChange((e) => seen.push(e));
    const [a, b] = await Promise.all([LM.refresh('openai'), LM.refresh('openai')]);
    assert.equal(calls.length, 1, '같은 키는 한 번만');
    assert.deepEqual(a, ['gpt-6.1-sol', 'gpt-6-sol']);
    assert.equal(a, b);
    assert.deepEqual(calls[0].body, { chat_completion_source: 'openai', reverse_proxy: 'https://proxy.test/v1', proxy_password: 'pw' });
    assert.deepEqual(seen, [{ key: 'openai@https://proxy.test/v1', source: 'openai' }], '5.7.1 본체 프록시로 받은 목록은 프록시 키에');
    assert.deepEqual(LM.cached('openai').ids, [], '직접 연결 목록에는 안 섞임');
    assert.deepEqual(LM.list('openai', { page: false, known: false }).ids, [], '직접 연결 칸(번역기 · 다시 쓰기 · 한글화)은 프록시 목록을 안 봄');
    assert.deepEqual(LM.list('openai', { page: false, known: false, proxy: LM.inheritedProxyUrl('openai') }).ids, ['gpt-6.1-sol', 'gpt-6-sol'], '본체 연결을 따르는 칸은 봄');
    off();
    // inheritProxy: false → 본체 프록시 없이 직접 (키도 직접)
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-direct', created: 1 }] } }));
    await LM.refresh('openai', { inheritProxy: false });
    assert.deepEqual(calls[0].body, { chat_completion_source: 'openai' });
    assert.deepEqual(LM.cached('openai').ids, ['gpt-direct']);
    // 애드온 자기 프록시 → 그 프록시 키
    await LM.refresh('openai', { body: {}, reverseProxy: 'https://own-proxy.test/v1/', proxyPassword: 'q' });
    assert.deepEqual(calls[1].body, { chat_completion_source: 'openai', reverse_proxy: 'https://own-proxy.test/v1/', proxy_password: 'q' });
    assert.deepEqual(LM.cached('openai@https://own-proxy.test/v1').ids, ['gpt-direct']);
    assert.equal(LM.cacheKey('openai', undefined, 'https://own-proxy.test/v1/'), 'openai@https://own-proxy.test/v1');
    // Custom: 본체 주소면 추가 헤더 · 다른 주소면 주소만
    useFetch(() => ({ status: 200, body: [{ id: 'r-2' }, { id: 'r-1' }] }));
    await LM.refresh('custom');
    assert.deepEqual(calls[0].body, { chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:5001/v1', custom_include_headers: '{X-H: 1}' });
    await LM.refresh('custom', { customUrl: 'https://own.test/v1/' });
    assert.deepEqual(calls[1].body, { chat_completion_source: 'custom', custom_url: 'https://own.test/v1' });
    assert.deepEqual(LM.cached('custom:https://own.test/v1').ids, ['r-2', 'r-1'], 'created 가 없으면 이름 속 숫자 큰 것 먼저');
    await assert.rejects(LM.refresh('custom', { customUrl: 'nope' }), /Custom 주소/);
    await assert.rejects(LM.refresh('claude'), /목록을 받아 오지 않아요/);
    // 실패: 던짐 · 예전 목록 그대로 · onChange 없음
    const seen2 = [];
    const off2 = LM.onChange((e) => seen2.push(e));
    useFetch(() => ({ status: 429, body: { error: { message: 'Too Many Requests' } } }));
    await assert.rejects(LM.refresh('openai'));
    assert.deepEqual(LM.cached('openai@https://proxy.test/v1').ids, ['gpt-6.1-sol', 'gpt-6-sol']);
    useFetch(() => ({ status: 200, body: { error: true, data: { data: [] } } }));
    await assert.rejects(LM.refresh('openai'), (e) => e.empty === true);
    assert.deepEqual(LM.cached('openai@https://proxy.test/v1').ids, ['gpt-6.1-sol', 'gpt-6-sol']);
    assert.deepEqual(seen2, []);
    off2();
});
await test('autoRefresh: 하루 안이면 안 물음 · 키 없음 / 모름 · Azure · 새로 친 Custom 주소는 안 물음 · 실패하면 조용히 + 기다림', async () => {
    reset();
    useFetch(() => ({ status: 200, body: { data: [{ id: 'm1' }] } }));
    assert.deepEqual(await LM.autoRefresh('openrouter'), ['m1'], '목록 없음 + 키 있음 → 받음');
    assert.equal(calls.length, 1);
    assert.equal(await LM.autoRefresh('openrouter'), null, '하루 안 → 안 물음');
    assert.equal(calls.length, 1);
    assert.equal(await LM.autoRefresh('deepseek'), null, '키 없음');
    assert.equal(await LM.autoRefresh('mistralai'), null, '키를 모름 (secret_state 에 없음)');
    secrets.setSecretState({ api_key_azure_openai: SECRET(true) });
    assert.equal(await LM.autoRefresh('azure_openai'), null, 'Azure 는 /status 가 진짜 채팅 → ↻ 로만');
    assert.equal(await LM.autoRefresh('claude'), null, '목록이 없는 공급자');
    assert.equal(calls.length, 1);
    // Custom: 본체 주소 · 저장된 주소만
    assert.deepEqual(await LM.autoRefresh('custom'), ['m1']);
    assert.equal(await LM.autoRefresh('custom', { customUrl: 'https://typed.test/v1' }), null, '새로 친 주소로 키가 가지 않게');
    assert.deepEqual(await LM.autoRefresh('custom', { customUrl: 'https://saved.test/v1', savedUrl: true }), ['m1']);
    assert.equal(calls.length, 3);
    // 본체 리버스 프록시면 키 없어도
    reset({ cs: { chat_completion_source: 'deepseek', reverse_proxy: 'https://p.test', proxy_password: '' } });
    useFetch(() => ({ status: 200, body: { data: [{ id: 'deepseek-flash' }] } }));
    assert.deepEqual(await LM.autoRefresh('deepseek'), ['deepseek-flash']);
    // 실패 → null (던지지 않음) · 30분 기다림 · ↻ 는 바로
    reset();
    useFetch(() => ({ status: 500, body: { error: true } }));
    assert.equal(await LM.autoRefresh('openai'), null);
    assert.equal(calls.length, 1);
    assert.equal(LM.inBackoff('openai'), true);
    assert.equal(await LM.autoRefresh('openai'), null);
    assert.equal(calls.length, 1, '기다리는 중엔 안 물음 (429 중계 서버 보호)');
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-6-sol' }] } }));
    assert.deepEqual(await LM.refresh('openai'), ['gpt-6-sol'], '↻ 는 기다림과 상관없음');
    assert.equal(LM.inBackoff('openai'), false, '받으면 기다림 끝');
    // 오래된 목록 → 다시 받음
    LM.put('openai', ['gpt-old'], { at: Date.now() - DAY - 5 });
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-new' }] } }));
    assert.deepEqual(await LM.autoRefresh('openai'), ['gpt-new']);
});
await test('실리태번이 연결하며 받은 목록(model_list)을 요청 없이 받아 둔다 — 새 배열 · 연결됨일 때만', async () => {
    reset({ cs: { chat_completion_source: 'openrouter' } });
    const fire = () => (T.handlers.online_status_changed || []).forEach(f => f());
    assert.ok((T.handlers.online_status_changed || []).length >= 1, 'ONLINE_STATUS_CHANGED 를 듣는다');
    const seen = [];
    const off = LM.onChange((e) => seen.push(e.key));
    const A = [{ id: 'openai/gpt-6.1-sol', created: 3 }, { id: 'anthropic/claude-sonnet-5.5', created: 2 }, { id: 'x/y:batch', created: 9 }];
    openai.setModelList(A);
    T.ctx.onlineStatus = 'no_connection';
    fire();
    assert.equal(LM.cached('openrouter').ids.length, 0, '연결 전엔 안 받음');
    fire();
    T.ctx.onlineStatus = 'Valid';
    fire();
    assert.equal(LM.cached('openrouter').ids.length, 0, '이미 본 배열(연결 전 · 다른 공급자 것일 수 있음)은 안 받음');
    const B = A.map(x => ({ ...x }));
    openai.setModelList(B);
    fire();
    assert.deepEqual(LM.cached('openrouter').ids, ['openai/gpt-6.1-sol', 'anthropic/claude-sonnet-5.5']);
    assert.deepEqual(seen, ['openrouter']);
    assert.equal(calls.length, 0, '요청 없음');
    const written = globalThis.localStorage.data.bl_live_models_v1;
    globalThis.localStorage.setItem('bl_live_models_v1', 'x');
    openai.setModelList(B.map(x => ({ ...x })));
    fire();
    assert.deepEqual(seen, ['openrouter'], '같은 목록을 반나절 안에 또 받으면 다시 적지 않음');
    assert.equal(globalThis.localStorage.data.bl_live_models_v1, 'x');
    globalThis.localStorage.setItem('bl_live_models_v1', written);
    // Custom: 본체 주소 키로
    T.ctx.chatCompletionSettings.chat_completion_source = 'custom';
    openai.setModelList([{ id: 'relay-1' }]);
    fire();
    assert.deepEqual(LM.cached('custom:http://127.0.0.1:5001/v1').ids, ['relay-1']);
    // 목록이 없는 공급자는 안 받음
    T.ctx.chatCompletionSettings.chat_completion_source = 'claude';
    openai.setModelList([{ id: 'stale' }]);
    fire();
    assert.equal(LM.cached('claude').ids.length, 0);
    off();
    openai.setModelList([]);
});
await test('sourceExtras: TTS 1.3.x 와 같은 키 순서 (Custom · Vertex · Azure · Z.AI · SiliconFlow · MiniMax · Pollinations · Workers AI · 프록시)', () => {
    const c = { chat_completion_source: 'zai', reverse_proxy: 'https://p.test', proxy_password: 'x', custom_include_headers: 'H', custom_include_body: 'B', custom_exclude_body: 'E',
        vertexai_auth_mode: 'full', azure_base_url: 'u', azure_deployment_name: 'd', azure_api_version: 'v', workers_ai_account_id: 'a' };
    const sub = (t) => `<${t}>`;
    assert.equal(JSON.stringify(LM.sourceExtras('custom', { settings: c, customUrl: 'https://r.test/v1/', inherit: true, substitute: sub })),
        '{"custom_url":"https://r.test/v1","custom_include_headers":"<H>","custom_include_body":"<B>","custom_exclude_body":"<E>"}');
    assert.equal(JSON.stringify(LM.sourceExtras('custom', { settings: c, customUrl: 'https://r.test/v1', inherit: true, forStatus: true, substitute: sub })), '{"custom_url":"https://r.test/v1","custom_include_headers":"<H>"}');
    assert.equal(JSON.stringify(LM.sourceExtras('vertexai', { settings: c })), '{"vertexai_auth_mode":"full","vertexai_region":"us-central1","vertexai_express_project_id":""}');
    assert.equal(JSON.stringify(LM.sourceExtras('vertexai', { settings: c, forStatus: true })), '{}');
    assert.equal(JSON.stringify(LM.sourceExtras('zai', { settings: c })), '{"zai_endpoint":"common","reverse_proxy":"https://p.test","proxy_password":"x"}');
    assert.equal(JSON.stringify(LM.sourceExtras('zai', { settings: c, forStatus: true })), '{"reverse_proxy":"https://p.test","proxy_password":"x"}');
    assert.equal(JSON.stringify(LM.sourceExtras('azure_openai', { settings: c })), '{"azure_base_url":"u","azure_deployment_name":"d","azure_api_version":"v"}');
    assert.equal(JSON.stringify(LM.sourceExtras('workers_ai', { settings: c })), '{"workers_ai_account_id":"a"}');
    assert.equal(JSON.stringify(LM.sourceExtras('openrouter', { settings: { ...c, chat_completion_source: 'openrouter' } })), '{}', 'OpenRouter 는 프록시 없음');
});
await test('TTS stapi: 목록 = 공용 목록 · 받은 목록은 새것 먼저 · 옛 TTS 캐시에도 적음 · needsAutoList · onListChange', async () => {
    reset();
    const a = { engine: 'provider', provider: 'openrouter', provider_models: {}, custom_url: '' };
    assert.deepEqual(stapi.modelList(a), [...LM.KNOWN.openrouter], '5.7.1 목록을 받기 전에도 KNOWN (최신 이름이 먼저 보이게) — 저절로 받기도');
    assert.equal(stapi.needsAutoList(a), true);
    useFetch(() => ({ status: 200, body: { data: [{ id: 'z-ai/glm-5.3', created: 1 }, { id: 'anthropic/claude-sonnet-5.5', created: 5 }, { id: 'x/old:batch', created: 9 }] } }));
    const ids = await stapi.fetchProviderModels(a);
    assert.deepEqual(ids, ['anthropic/claude-sonnet-5.5', 'z-ai/glm-5.3'], '새것 먼저 · :batch 뺌');
    assert.deepEqual(stapi.modelList(a), ids);
    assert.deepEqual(stapi.cachedModels('openrouter'), ids);
    assert.deepEqual(LM.cached('openrouter').ids, ids, '공용 캐시 (번역기 · 다시 쓰기와 같이)');
    assert.deepEqual(JSON.parse(globalThis.localStorage.data.lemon_voice_model_lists).openrouter.models, ids, '옛 TTS 캐시에도');
    assert.equal(stapi.needsAutoList(a), false, '하루 안');
    assert.equal(stapi.LIST_TTL, DAY);
    // Claude (목록 없음): KNOWN 으로 최신 이름
    const c = { engine: 'provider', provider: 'claude', provider_models: {} };
    assert.equal(stapi.modelList(c)[0], 'claude-sonnet-5-5');
    assert.equal(stapi.needsAutoList(c), false);
    // 키 없음 · 모름 · Azure · Custom 새 주소 · compat
    assert.equal(stapi.needsAutoList({ ...a, provider: 'deepseek' }), false);
    assert.equal(stapi.needsAutoList({ ...a, provider: 'mistralai' }), false, '키를 모름');
    assert.equal(stapi.needsAutoList({ ...a, provider: 'azure_openai' }), false);
    assert.equal(stapi.needsAutoList({ ...a, provider: 'custom' }), true, '본체 Custom 주소');
    assert.equal(stapi.needsAutoList({ ...a, provider: 'custom', custom_url: 'https://typed.test/v1' }), false, '받아 본 적 없는 주소');
    LM.put('custom:https://typed.test/v1', ['x'], { at: Date.now() - DAY - 5 });
    assert.equal(stapi.needsAutoList({ ...a, provider: 'custom', custom_url: 'https://typed.test/v1' }), true, '전에 ↻ 로 받아 본 주소가 하루 지남');
    assert.equal(stapi.needsAutoList({ engine: 'compat', base: 'https://x.test/v1', key: 'k' }), false, 'compat 새 주소');
    LM.put('compat:https://x.test/v1', ['m'], { at: Date.now() - DAY - 5 });
    assert.equal(stapi.needsAutoList({ engine: 'compat', base: 'https://x.test/v1', key: 'k' }), true);
    assert.equal(stapi.needsAutoList({ engine: 'compat', base: 'https://x.test/v1', key: '' }), false, '키 없음');
    assert.equal(stapi.needsAutoList({ engine: 'st' }), false);
    // compat: api.openai.com 이면 채팅 모델만
    useFetch(() => ({ status: 200, body: { data: [{ id: 'gpt-6-sol', created: 2 }, { id: 'tts-1', created: 9 }, { id: 'gpt-4.1', created: 1 }] } }));
    assert.deepEqual(await stapi.fetchCompatModels({ engine: 'compat', base: 'https://api.openai.com/v1', key: 'k' }), ['gpt-6-sol', 'gpt-4.1']);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/models');
    assert.equal(calls[0].headers.Authorization, 'Bearer k');
    // onListChange
    const seen = [];
    const off = stapi.onListChange((e) => seen.push(e.key));
    useFetch(() => ({ status: 200, body: { data: [{ id: 'g' }] } }));
    await stapi.fetchProviderModels({ ...a, provider: 'openai' });
    assert.deepEqual(seen, ['openai']);
    off();
    // 오류 문구는 예전과 같다
    useFetch(() => ({ status: 200, body: { error: true } }));
    await assert.rejects(stapi.fetchProviderModels({ ...a, provider: 'openai' }), (e) => e.message === '목록을 받지 못했어요 (키·주소 확인)' && e.lv === true);
    useFetch(() => ({ status: 400, body: { error: true } }));
    await assert.rejects(stapi.fetchProviderModels({ ...a, provider: 'openai' }), (e) => e.message === '목록을 받지 못했어요 (키·설정 확인)' && e.status === 400);
    assert.equal(stapi.needsAutoList({ ...a, provider: 'openai' }), false, '실패 뒤 기다림');
});
await test('fillSelect: 저장된 모델은 맨 앞에 골라 둠 (이전 목록) · 직접 입력 · 같은 내용이면 손대지 않음', () => {
    const mk = (tag) => ({ tag, value: '', textContent: '', selected: false });
    globalThis.document = { createDocumentFragment: () => ({ children: [], append(...n) { this.children.push(...n); } }), createElement: mk };
    try {
        const sel = { dataset: {}, children: [], replaceChildren(f) { this.children = f.children; this.n = (this.n || 0) + 1; } };
        assert.equal(LM.fillSelect(sel, ['a', 'b'], { saved: 'old', customValue: 'custom', customLabel: '⚙️ 커스텀 모델 입력' }), true);
        assert.deepEqual(sel.children.map(o => [o.value, o.textContent, o.selected]), [['old', 'old (이전 목록)', true], ['a', 'a', false], ['b', 'b', false], ['custom', '⚙️ 커스텀 모델 입력', false]]);
        assert.equal(LM.fillSelect(sel, ['a', 'b'], { saved: 'old', customValue: 'custom', customLabel: '⚙️ 커스텀 모델 입력' }), false, '같으면 그대로');
        assert.equal(sel.n, 1);
        LM.fillSelect(sel, ['a', 'b'], { saved: 'b', missingSuffix: ' (이 주소 목록에 없음)' });
        assert.deepEqual(sel.children.map(o => [o.value, o.selected]), [['a', false], ['b', true]]);
        LM.fillSelect(sel, ['a'], { placeholder: '모델 선택', customValue: '__custom__', customSelected: true });
        assert.deepEqual(sel.children.map(o => [o.value, o.selected]), [['a', false], ['__custom__', true]]);
    } finally { delete globalThis.document; }
});
await test('5.7.1 OpenAI: Responses 전용 -pro 모델은 뺌 (chat/completions 로 못 보냄) · 다른 공급자의 -pro 는 그대로', () => {
    const ids = LM.modelIdsFrom('openai', { data: [{ id: 'gpt-6.1-sol', created: 5 }, { id: 'gpt-6.1-sol-pro', created: 6 }, { id: 'gpt-5-pro' }, { id: 'o3-pro' }, { id: 'o1-pro' }, { id: 'gpt-5.4-pro' }, { id: 'o3', created: 1 }, { id: 'gpt-5-prompt-x' }] });
    assert.deepEqual(ids.filter(x => /pro(-|$)/.test(x)), []);
    assert.ok(ids.includes('gpt-6.1-sol') && ids.includes('o3') && ids.includes('gpt-5-prompt-x'));
    assert.ok(LM.modelIdsFrom('makersuite', { data: [{ id: 'gemini-3.1-pro-preview' }] }).includes('gemini-3.1-pro-preview'));
});
await test('불러오기만으로는 통신하지 않음 · 목록 · 캐시 읽기도 통신 없음', () => {
    reset();
    let hits = 0;
    globalThis.fetch = async () => { hits++; throw new Error('x'); };
    LM.list('openai'); LM.list('custom'); LM.cached('openai'); LM.isStale('openai'); stapi.modelList({ engine: 'provider', provider: 'openai' }); stapi.needsAutoList({ engine: 'provider', provider: 'openai' });
    assert.equal(hits, 0);
});

console.log(`\nlive-models: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
