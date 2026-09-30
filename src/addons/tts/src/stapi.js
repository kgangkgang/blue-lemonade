// TTS — 대사 분석 엔진 「실리태번 API 중 선택」 (1.2.1): 공급자 목록 · 키 상태 · 모델 목록 · 요청 본문
//
// LLM 번역기의 「실리태번 API 중 선택」과 같은 길: 요청은 실리태번 서버(/api/backends/chat-completions/generate · /status)를 거치고,
// 키는 실리태번 secrets 에 있는 것을 서버가 붙인다. 여기선 키가 있나 없나(secret_state)만 본다 — 값은 읽지도 저장하지도 않는다.
// 공급자별 접속 설정(Vertex AI 인증·리전, Custom 추가 헤더/본문, Azure 배포, 엔드포인트)은 실리태번 설정(chatCompletionSettings)을 따른다.
// 리버스 프록시: 고른 공급자가 실리태번의 지금 공급자와 같고 거기에 프록시가 적혀 있을 때만 그대로 (실리태번 본체와 같은 요청).
//
// 모델 목록 = 실리태번 화면의 #model_<id>_select 옵션 (본체가 이미 가진 목록 — 번역기와 같은 목록)
//           + /status 로 받은 목록 (이 브라우저의 localStorage 에 캐시, 최근 MAX_LISTS 개 — settings.json 이 커지지 않고 폰과 오가지 않게)
// 응답 길이: MAX_TOKENS (생각 토큰도 여기 들어감). 생각을 오래 하는 모델(Claude 5 · Fable · Gemini 3 · OpenAI 추론)은 reasoning_effort 'low'.
//           그래도 잘리면 analysis.js 가 RETRY_MAX_TOKENS 로 한 번 더 (번역기와 같은 12000)
//
// 밖으로:
//   SOURCES · source(id) · MAX_TOKENS · RETRY_MAX_TOKENS
//   keyState(id) → 'yes' | 'no' | 'optional' | 'unknown' · hasInheritedProxy(id) · autoListOk(id)
//   customEndpoint(cfg) → { url, inherit }
//   listKey(cfg) · cachedModels(key) · pageModels(id, cfg) · modelList(cfg) · modelOf(cfg, id?)
//   modelIds(data) · fetchProviderModels(cfg) · fetchCompatModels(cfg)
//   providerProblem(cfg) → '' | 한국어 한 줄 (준비 안 된 까닭) · buildRequest(cfg, system, user, { maxTokens }) → /generate 본문
//   applyModelRequestRules(provider, model, body)
import { getRequestHeaders, substituteParams } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';
import { secret_state } from '../../../../../../../secrets.js';
import { fetchJson } from './providers/_http.js';

export const GENERATE_URL = '/api/backends/chat-completions/generate';
export const STATUS_URL = '/api/backends/chat-completions/status';
export const MAX_TOKENS = 8192;          // 응답 길이 (Claude 는 꼭 있어야 함 · 생각 토큰도 여기 들어감)
export const RETRY_MAX_TOKENS = 12000;   // 잘렸을 때 한 번 더 (번역기와 같음)
const LIST_TIMEOUT = 30000;
const MAX_LISTS = 4;                     // 모델 목록 캐시는 최근 4개만
const MAX_MODELS = 2000;
const LIST_STORE = 'lemon_voice_model_lists';   // localStorage 키

// 실리태번 1.19 의 chat_completion_sources (CometAPI 는 본체에서 꺼져 있어 뺌). 순서는 본체 API 연결 화면과 같다.
//   sel = 화면의 모델 select 가 model_<sel>_select (없으면 id) · model = 실리태번 설정의 모델 항목 (없으면 <sel|id>_model)
//   keys = secrets 키 (하나라도 있으면 됨, 빈 배열 = 키 없이 됨) · status = /status 로 모델 목록을 받음 · proxy = 본체 리버스 프록시를 쓰는 공급자
export const SOURCES = Object.freeze([
    { id: 'openai', name: 'OpenAI', keys: ['api_key_openai'], status: true, proxy: true },
    { id: 'custom', name: 'Custom (OpenAI 호환)', keys: [], status: true },
    { id: 'ai21', name: 'AI21', keys: ['api_key_ai21'] },
    { id: 'aimlapi', name: 'AI/ML API', keys: ['api_key_aimlapi'], status: true },
    { id: 'azure_openai', name: 'Azure OpenAI', keys: ['api_key_azure_openai'], status: true },
    { id: 'chutes', name: 'Chutes', keys: ['api_key_chutes'], status: true },
    { id: 'claude', name: 'Claude', keys: ['api_key_claude'], proxy: true },
    { id: 'workers_ai', name: 'Cloudflare Workers AI', keys: ['api_key_workers_ai'], status: true },
    { id: 'cohere', name: 'Cohere', keys: ['api_key_cohere'], status: true },
    { id: 'deepseek', name: 'DeepSeek', keys: ['api_key_deepseek'], status: true, proxy: true },
    { id: 'electronhub', name: 'Electron Hub', keys: ['api_key_electronhub'], status: true },
    { id: 'fireworks', name: 'Fireworks AI', keys: ['api_key_fireworks'], status: true },
    { id: 'groq', name: 'Groq', keys: ['api_key_groq'], status: true },
    { id: 'makersuite', name: 'Google AI Studio', sel: 'google', keys: ['api_key_makersuite'], status: true, proxy: true },
    { id: 'vertexai', name: 'Google Vertex AI', keys: ['api_key_vertexai', 'vertexai_service_account_json'], proxy: true },
    { id: 'mistralai', name: 'MistralAI', keys: ['api_key_mistralai'], status: true, proxy: true },
    { id: 'minimax', name: 'MiniMax', keys: ['api_key_minimax'] },
    { id: 'moonshot', name: 'Moonshot AI', keys: ['api_key_moonshot'], status: true, proxy: true },
    { id: 'nanogpt', name: 'NanoGPT', keys: ['api_key_nanogpt'], status: true },
    { id: 'openrouter', name: 'OpenRouter', keys: ['api_key_openrouter'], status: true },
    { id: 'perplexity', name: 'Perplexity', keys: ['api_key_perplexity'] },
    { id: 'pollinations', name: 'Pollinations', keys: ['api_key_pollinations'], status: true },
    { id: 'siliconflow', name: 'SiliconFlow', keys: ['api_key_siliconflow'], status: true },
    { id: 'xai', name: 'xAI (Grok)', keys: ['api_key_xai'], status: true, proxy: true },
    { id: 'zai', name: 'Z.AI (GLM)', keys: ['api_key_zai'], proxy: true },
].map(s => Object.freeze(s)));
const BY_ID = new Map(SOURCES.map(s => [s.id, s]));
const SYSPROMPT = new Set(['claude', 'makersuite', 'vertexai']);   // 시스템 프롬프트를 따로 받는 공급자 (use_sysprompt)
const NO_AUTO_LIST = new Set(['azure_openai']);                    // /status 가 진짜 채팅 요청을 보내는 공급자 — 목록은 ↻ 로만
const OR_WEBSITE = 'OR_Website';                                   // 본체 OpenRouter 목록의 "웹사이트에서 고름" 항목

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const uniq = (arr) => [...new Set(arr)];
export const normUrl = (u) => str(u).trim().replace(/\/+$/, '');
export function validUrl(u) {
    try { const p = new URL(u); return p.protocol === 'http:' || p.protocol === 'https:'; } catch { return false; }
}
function koErr(msg, { retry = false, status = 0 } = {}) {
    const e = new Error(msg);
    e.lv = true; e.retry = retry; e.status = status; e.code = status;
    return e;
}

export const source = (id) => BY_ID.get(str(id)) || null;

/** 실리태번 채팅 완성 설정 (oai_settings) — 없으면 빈 객체 */
function cs() {
    try { const c = getContext()?.chatCompletionSettings; return isObj(c) ? c : {}; } catch { return {}; }
}
function sub(t) { try { return substituteParams(str(t)); } catch { return str(t); } }

/**
 * 실리태번에 그 공급자의 키가 있나 (secret_state 는 키마다 null | [ {id, value(가림), label, active} ])
 * 'yes' 있음 · 'no' 없음 · 'optional' 키 없이도 됨 (Custom · 익명 Pollinations) · 'unknown' 아직 모름 (secrets 를 못 읽음)
 */
export function keyState(id) {
    const src = source(id);
    if (!src) return 'unknown';
    if (!src.keys.length) return 'optional';
    if (src.id === 'pollinations' && cs().pollinations_endpoint === 'anonymous') return 'optional';
    let st = null;
    try { st = secret_state; } catch { st = null; }
    if (!isObj(st) || !Object.keys(st).length) return 'unknown';
    // Vertex AI 는 인증 방식에 맞는 키만 (Express = API 키 · Full = 서비스 계정 JSON — 서버가 그 하나만 봄)
    const keys = src.id === 'vertexai' ? [vertexMode() === 'full' ? 'vertexai_service_account_json' : 'api_key_vertexai'] : src.keys;
    const has = (k) => { const v = st[k]; return Array.isArray(v) ? v.length > 0 : !!v; };
    if (keys.some(has)) return 'yes';
    return keys.some(k => k in st) ? 'no' : 'unknown';
}
/** Vertex AI 인증 방식 (본체 · 서버 기본값과 같은 express) */
function vertexMode() { return cs().vertexai_auth_mode === 'full' ? 'full' : 'express'; }

/** Custom 주소: 분석에 따로 적은 주소, 비었으면 실리태번 Custom 주소 (그땐 본체의 추가 헤더·본문도 함께 — inherit) */
export function customEndpoint(cfg) {
    const own = normUrl(cfg?.custom_url);
    if (own) return { url: own, inherit: false };
    return { url: normUrl(cs().custom_url), inherit: true };
}

/** 본체 리버스 프록시: 고른 공급자가 실리태번의 지금 공급자와 같고 프록시가 있을 때만 (값은 요청 본문으로만 — 저장·기록 안 함) */
function inheritedProxy(id) {
    const src = source(id);
    const c = cs();
    if (!src || !src.proxy || c.chat_completion_source !== src.id) return null;
    const url = str(c.reverse_proxy).trim();
    return url ? { reverse_proxy: url, proxy_password: str(c.proxy_password) } : null;
}
/** 본체 리버스 프록시를 따라가나 (그땐 키가 없어도 됨 — 공급자 목록에 · 키 없음 을 붙이지 않는다) */
export const hasInheritedProxy = (id) => !!inheritedProxy(id);

/** 공급자별 접속 설정 (본체 설정을 따름) — /generate 와 /status 에 같이 */
function sourceExtras(src, cfg, forStatus) {
    const c = cs();
    const out = {};
    switch (src.id) {
        case 'custom': {
            const ep = customEndpoint(cfg);
            out.custom_url = ep.url;
            if (ep.inherit) {
                out.custom_include_headers = sub(c.custom_include_headers);
                if (!forStatus) {
                    out.custom_include_body = sub(c.custom_include_body);
                    out.custom_exclude_body = sub(c.custom_exclude_body);
                }
            }
            break;
        }
        case 'vertexai':
            // 번역기와 같다: 본체의 인증 방식 · 리전 · Express 프로젝트 (리전을 안 보내면 서버가 us-central1 로 고정)
            if (!forStatus) {
                out.vertexai_auth_mode = vertexMode();
                out.vertexai_region = c.vertexai_region || 'us-central1';
                out.vertexai_express_project_id = c.vertexai_express_project_id || '';
            }
            break;
        case 'azure_openai':
            out.azure_base_url = str(c.azure_base_url);
            out.azure_deployment_name = str(c.azure_deployment_name);
            out.azure_api_version = str(c.azure_api_version);
            break;
        case 'zai': if (!forStatus) out.zai_endpoint = c.zai_endpoint || 'common'; break;
        case 'siliconflow': out.siliconflow_endpoint = c.siliconflow_endpoint || 'global'; break;
        case 'minimax': out.minimax_endpoint = c.minimax_endpoint || 'global'; break;
        case 'pollinations': out.pollinations_endpoint = c.pollinations_endpoint || 'authenticated'; break;
        case 'workers_ai': out.workers_ai_account_id = str(c.workers_ai_account_id); break;
        default: break;
    }
    const proxy = inheritedProxy(src.id);
    if (proxy) Object.assign(out, proxy);
    return out;
}

// ---------- 모델 목록

/** 캐시 키: compat → 'compat:<주소>' · Custom → 'custom:<주소>' · 그 밖 → 공급자 id */
export function listKey(cfg) {
    const c = cfg || {};
    if (c.engine === 'compat') return `compat:${normUrl(c.base)}`;
    const id = str(c.provider) || 'openai';
    return id === 'custom' ? `custom:${customEndpoint(c).url}` : id;
}
let listMem = null;   // localStorage 를 못 쓰면 이번 세션만
function lists() {
    if (listMem) return listMem;
    let v = null;
    try { v = JSON.parse(globalThis.localStorage?.getItem(LIST_STORE) || 'null'); } catch { v = null; }
    listMem = isObj(v) ? v : {};
    return listMem;
}
/** 테스트용: 모델 목록 캐시 객체 그대로 */
export const _modelListsForTest = () => lists();
function persistLists() {
    try { globalThis.localStorage?.setItem(LIST_STORE, JSON.stringify(lists())); } catch { /* 저장소 없음 · 가득 참 — 이번 세션만 */ }
}
export function cachedModels(key) {
    const e = lists()[key];
    return isObj(e) && Array.isArray(e.models) ? e.models.filter(m => typeof m === 'string' && m) : [];
}
function putModels(key, ids) {
    const all = lists();
    all[key] = { models: ids.slice(0, MAX_MODELS), at: Date.now() };
    const others = Object.entries(all).filter(([k]) => k !== key).sort((x, y) => (Number(y[1]?.at) || 0) - (Number(x[1]?.at) || 0)).map(([k]) => k);
    const keep = new Set([key, ...others].slice(0, MAX_LISTS));
    for (const k of Object.keys(all)) if (!keep.has(k)) delete all[k];
    persistLists();
}
/** 실리태번 화면이 가진 그 공급자의 모델 목록 (#model_<id>_select — 번역기와 같은 목록). Custom 은 본체 주소를 쓸 때만 */
export function pageModels(id, cfg) {
    const src = source(id);
    if (!src || typeof document === 'undefined') return [];
    if (src.id === 'custom' && !customEndpoint(cfg).inherit) return [];
    let el = null;
    try { el = document.getElementById(`model_${src.sel || src.id}_select`); } catch { el = null; }
    if (!el || !el.options) return [];
    return uniq([...el.options].map(o => str(o.value).trim()).filter(v => v && v !== OR_WEBSITE));
}
/** 고를 수 있는 모델: provider = 화면 목록 + 받아 둔 목록 · compat = 받아 둔 목록 */
export function modelList(cfg) {
    const c = cfg || {};
    if (c.engine === 'compat') return cachedModels(listKey(c));
    return uniq([...pageModels(c.provider, c), ...cachedModels(listKey(c))]);
}
/** 실리태번에서 그 공급자에 골라 둔 모델 (Custom 은 본체 주소를 쓸 때만) */
function stModel(src, cfg) {
    if (src.id === 'custom' && !customEndpoint(cfg).inherit) return '';
    const m = str(cs()[`${src.sel || src.id}_model`]).trim();
    if (src.id === 'azure_openai' && !m) return str(cs().azure_deployment_name).trim();   // Azure 는 배포 이름으로 부름 (모델 칸은 비어 있기 일쑤)
    return m === OR_WEBSITE ? '' : m;
}
/** 쓸 모델: 이 공급자에 고른 것 → 실리태번에서 그 공급자에 고른 것. 둘 다 없으면 '' (목록 첫째를 몰래 쓰지 않는다 — 값이 다른 모델일 수 있음) */
export function modelOf(cfg, id) {
    const c = cfg || {};
    const src = source(id || c.provider);
    if (!src) return '';
    const saved = isObj(c.provider_models) ? str(c.provider_models[src.id]).trim() : '';
    if (saved) return saved;
    return stModel(src, c);
}
/** 목록을 저절로 받아도 되나 (Azure 는 /status 가 진짜 채팅 요청이라 ↻ 로만) */
export const autoListOk = (id) => !!(source(id)?.status) && !NO_AUTO_LIST.has(str(id));

/** /models 응답 → 모델 id 들 (정렬 · 중복 제거). { data: [...] } · 배열 · { models: [...] } (Cohere 는 name) */
export function modelIds(data) {
    const raw = Array.isArray(data) ? data
        : Array.isArray(data?.data) ? data.data
            : Array.isArray(data?.models) ? data.models
                : Array.isArray(data?.data?.data) ? data.data.data : [];
    const ids = raw
        .map(x => (x && typeof x === 'object' ? (x.id ?? x.name ?? '') : x))
        .map(v => str(v).trim().replace(/^models\//, ''))
        .filter(Boolean);
    return uniq(ids).sort((a, b) => a.localeCompare(b));
}
// OpenAI 의 /models 에는 말하는 모델이 아닌 것(임베딩 · 음성 · 그림 …)도 섞여 있다
const OPENAI_NOT_CHAT = /(embedding|whisper|tts|dall-e|moderation|transcribe|realtime|audio|image|search|babbage|davinci|sora)/i;

/** 실리태번 서버의 /status 로 공급자의 모델 목록을 받아 캐시에 넣는다 (키는 서버가 붙임) → ids */
export async function fetchProviderModels(cfg, { signal } = {}) {
    const c = cfg || {};
    const src = source(c.provider);
    if (!src) throw koErr('모르는 공급자예요');
    if (!src.status) throw koErr('이 API 는 목록을 받아 오지 않아요');
    if (src.id === 'custom' && !validUrl(customEndpoint(c).url)) throw koErr('Custom 주소를 넣어 주세요');
    const pre = setupProblem(src);
    if (pre) throw koErr(pre);
    const key = listKey(c);
    const body = { chat_completion_source: src.id, ...sourceExtras(src, c, true) };
    let j;
    try {
        j = await fetchJson(STATUS_URL, { method: 'POST', headers: getRequestHeaders(), body, signal, timeout: LIST_TIMEOUT });
    } catch (e) {
        // 실리태번은 키·계정 ID·Azure 설정이 빠지면 빈 400 을 준다 (요청 형식 오류 라고 하면 헷갈림)
        if (Number(e?.status) === 400 && !(signal && signal.aborted)) throw koErr('목록을 받지 못했어요 (키·설정 확인)', { status: 400 });
        throw e;
    }
    let ids = modelIds(j);
    if (src.id === 'openai') ids = ids.filter(m => !OPENAI_NOT_CHAT.test(m));
    if (!ids.length && j && j.error) throw koErr('목록을 받지 못했어요 (키·주소 확인)');
    putModels(key, ids);
    return ids;
}
/** OpenAI 호환(직접 주소·키): GET {주소}/models → 캐시 → ids (키는 채팅 요청과 같은 서버로만) */
export async function fetchCompatModels(cfg, { signal } = {}) {
    const c = cfg || {};
    const base = normUrl(c.base);
    if (!validUrl(base)) throw koErr('주소를 먼저 넣어 주세요');
    const headers = str(c.key).trim() ? { Authorization: `Bearer ${str(c.key).trim()}` } : {};
    const j = await fetchJson(`${base}/models`, { method: 'GET', headers, signal, timeout: LIST_TIMEOUT });
    const ids = modelIds(j);
    putModels(`compat:${base}`, ids);
    return ids;
}

// ---------- 요청

/** 준비 안 된 까닭 (없으면 '') — engineReady · testEngine 이 같이 쓴다 */
/** 실리태번 쪽 준비 (계정 ID · Azure 설정 · 키) — 모델 목록 받기와 요청이 같이 쓴다 */
function setupProblem(src) {
    const c = cs();
    if (src.id === 'workers_ai' && !str(c.workers_ai_account_id).trim()) return '실리태번에 Workers AI 계정 ID 가 없어요';
    if (src.id === 'azure_openai') {
        if (!validUrl(str(c.azure_base_url))) return '실리태번에 Azure 주소가 없어요';
        if (!str(c.azure_deployment_name).trim() || !str(c.azure_api_version).trim()) return '실리태번에 Azure 배포 이름·API 버전이 없어요';
    }
    if (keyState(src.id) === 'no' && !inheritedProxy(src.id)) return `실리태번에 ${src.name} 키가 없어요`;
    return '';
}
export function providerProblem(cfg) {
    const c = cfg || {};
    const src = source(c.provider);
    if (!src) return '공급자를 골라 주세요';
    if (src.id === 'custom' && !validUrl(customEndpoint(c).url)) return 'Custom 주소를 넣어 주세요';
    const pre = setupProblem(src);
    if (pre) return pre;
    if (!modelOf(c)) return '모델을 골라 주세요';
    return '';
}

/**
 * 모델별 요청 규칙 — LLM 번역기(applyModelRequestRules)와 같다. 본체 화면을 거치지 않고 서버로 바로 보내므로 여기서 맞춘다
 * (최신 OpenAI 추론 모델은 max_completion_tokens · 샘플링 값 거부, Claude 5 · Fable 은 샘플링 값 거부)
 */
export function applyModelRequestRules(provider, model, body) {
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
        if (/gpt-5-chat-latest/.test(m)) { /* 채팅 전용 모델은 샘플링 값을 받는다 */ }
        else if (/gpt-5\.(1|2|3|4)/.test(m) && !/chat-latest/.test(m)) drop('frequency_penalty', 'presence_penalty');
        else drop('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }
    if (/claude-(fable|opus-5|sonnet-5)/.test(m)) drop('temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty');
    return body;
}

/** /generate 본문 (통신 없음). 키는 담지 않는다 — 서버가 secrets 에서 붙임 */
export function buildRequest(cfg, system, user, { maxTokens = MAX_TOKENS } = {}) {
    const c = cfg || {};
    const src = source(c.provider);
    if (!src) throw koErr('공급자를 골라 주세요');
    const model = modelOf(c);
    let temperature = Number.isFinite(Number(c.temperature)) ? Number(c.temperature) : 0.2;
    if (src.id === 'minimax') temperature = Math.min(1, Math.max(0.01, temperature));   // MiniMax 는 (0, 1] 만
    const body = {
        chat_completion_source: src.id,
        model,
        messages: [{ role: 'system', content: str(system) }, { role: 'user', content: str(user) }],
        temperature,
        max_tokens: maxTokens,
        stream: false,
    };
    if (SYSPROMPT.has(src.id)) body.use_sysprompt = true;
    const effort = lowEffort(src.id, model);
    if (effort) body.reasoning_effort = effort;
    Object.assign(body, sourceExtras(src, c, false));
    applyModelRequestRules(src.id, model, body);
    return body;
}
/**
 * 생각을 오래 하는 모델은 짧게 (low — 실리태번 서버가 공급자마다 바꿔 보냄): 생각 토큰이 응답 길이를 다 써서 JSON 이 잘리지 않게.
 *   OpenAI: 서버가 추론 모델에만 붙임 · Claude: 적응형 생각 모델(Fable · Claude 5 · Opus 4.7/4.8)만 · Google: Gemini 3 만.
 *   그 밖은 보내지 않는다 (생각을 안 하던 모델이 생각을 시작하거나, 모르는 값을 거절하는 공급자가 있음)
 */
function lowEffort(provider, model) {
    const m = str(model);
    if (provider === 'openai') return 'low';
    if (provider === 'claude' && /claude-(fable|opus-5|sonnet-5|opus-4-[78])/.test(m)) return 'low';
    if ((provider === 'makersuite' || provider === 'vertexai') && /gemini-3/.test(m)) return 'low';
    return '';
}
