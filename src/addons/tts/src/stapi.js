// TTS — 대사 분석 엔진 「실리태번 API 중 선택」 (1.2.1): 공급자 목록 · 키 상태 · 모델 목록 · 요청 본문
//
// LLM 번역기의 「실리태번 API 중 선택」과 같은 길: 요청은 실리태번 서버(/api/backends/chat-completions/generate · /status)를 거치고,
// 키는 실리태번 secrets 에 있는 것을 서버가 붙인다. 여기선 키가 있나 없나(secret_state)만 본다 — 값은 읽지도 저장하지도 않는다.
// 공급자별 접속 설정(Vertex AI 인증·리전, Custom 추가 헤더/본문, Azure 배포, 엔드포인트)은 실리태번 설정(chatCompletionSettings)을 따른다.
// 리버스 프록시: 고른 공급자가 실리태번의 지금 공급자와 같고 거기에 프록시가 적혀 있을 때만 그대로 (실리태번 본체와 같은 요청).
//
// 모델 목록 = 테마 공용 목록 (src/live-models.js — 번역기 · 다시 쓰기 · 모델 전환과 같은 캐시):
//           /status 로 받은 목록(새것 먼저, 하루 TTL)이 있으면 그것 + 모델 등록, 없으면 실리태번 화면의 #model_<id>_select 옵션
//           (목록을 받을 수 없는 공급자 — Claude · Vertex · Z.AI … — 는 테마가 아는 최신 이름 KNOWN 도). 캐시는 이 브라우저의 localStorage
//           (settings.json 이 커지지 않고 폰과 오가지 않게). 옛 캐시 lemon_voice_model_lists 에도 그대로 적어 둔다 (최근 MAX_LISTS 개 — 예전 판이 읽게)
// 응답 길이: MAX_TOKENS (생각 토큰도 여기 들어감). 생각을 오래 하는 모델(Claude 5 이후 · Fable · Gemini 3 이후 · OpenAI 추론)은 reasoning_effort 'low'.
//           그래도 잘리면 analysis.js 가 RETRY_MAX_TOKENS 로 한 번 더 (번역기와 같은 12000)
//
// 밖으로:
//   SOURCES · source(id) · MAX_TOKENS · RETRY_MAX_TOKENS · LIST_TTL
//   keyState(id) → 'yes' | 'no' | 'optional' | 'unknown' · hasInheritedProxy(id) · autoListOk(id)
//   customEndpoint(cfg) → { url, inherit }
//   listKey(cfg) · cachedModels(key) · pageModels(id, cfg) · modelList(cfg) · modelOf(cfg, id?)
//   modelIds(data) · fetchProviderModels(cfg) · fetchCompatModels(cfg)
//   needsAutoList(cfg) → 지금 조용히 목록을 다시 받아도 되나 (카드를 열 때) · onListChange(cb) → 그만 듣기 함수
//   providerProblem(cfg) → '' | 한국어 한 줄 (준비 안 된 까닭) · buildRequest(cfg, system, user, { maxTokens }) → /generate 본문
//   applyModelRequestRules(provider, model, body)
import { getRequestHeaders, substituteParams } from '../../../../../../../../script.js';
import { getContext } from '../../../../../../../extensions.js';
import { secret_state } from '../../../../../../../secrets.js';
import { fetchJson } from './providers/_http.js';
import * as LM from '../../../live-models.js';

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

/**
 * 공급자별 접속 설정 (본체 설정을 따름) — /generate 와 /status 에 같이. 규칙은 공용 live-models.js 의 sourceExtras 하나
 * (Custom 추가 헤더/본문 · Vertex 인증·리전·Express 프로젝트 · Azure 배포 · Z.AI · SiliconFlow · MiniMax · Pollinations · Workers AI 계정 · 본체 리버스 프록시)
 */
function sourceExtras(src, cfg, forStatus) {
    const ep = src.id === 'custom' ? customEndpoint(cfg) : { url: '', inherit: false };
    return LM.sourceExtras(src.id, { settings: cs(), customUrl: ep.url, inherit: ep.inherit, forStatus, substitute: sub });
}

// ---------- 모델 목록

/** 캐시 키: compat → 'compat:<주소>' · Custom → 'custom:<주소>' · 그 밖 → 공급자 id */
export function listKey(cfg) {
    const c = cfg || {};
    if (c.engine === 'compat') return `compat:${normUrl(c.base)}`;
    const id = str(c.provider) || 'openai';
    if (id === 'custom') return `custom:${customEndpoint(c).url}`;
    const px = normUrl(inheritedProxy(id)?.reverse_proxy);   // 5.7.1 본체 프록시로 받은 목록은 '<id>@<프록시>' (live-models.cacheKey 와 같은 꼴)
    return px ? `${id}@${px}` : id;
}
// 옛 캐시 (lemon_voice_model_lists): 공용 캐시와 함께 적어 둔다 — 예전 판으로 돌아가도 목록이 남게. 읽기는 공용 캐시(LM.cached)가 둘 다 본다
let listMem = null;   // localStorage 를 못 쓰면 이번 세션만
function lists() {
    if (listMem) return listMem;
    let v = null;
    try { v = JSON.parse(globalThis.localStorage?.getItem(LIST_STORE) || 'null'); } catch { v = null; }
    listMem = isObj(v) ? v : {};
    return listMem;
}
/** 테스트용: 옛 모델 목록 캐시 객체 그대로 */
export const _modelListsForTest = () => lists();
function persistLists() {
    try { globalThis.localStorage?.setItem(LIST_STORE, JSON.stringify(lists())); } catch { /* 저장소 없음 · 가득 참 — 이번 세션만 */ }
}
/** 받아 둔 목록 (공용 캐시 · 옛 캐시 가운데 최근 것, 새것 먼저) */
/** 받아 둔 목록의 시각 (ms · 없으면 0) — 같은 목록을 세션에 두 번 조용히 받지 않게 (ui.autoFetchModels) */
export const cachedAt = (key) => Number(LM.cached(key).at) || 0;
export function cachedModels(key) {
    return LM.cached(str(key)).ids;
}
function putModels(key, ids, at = Date.now()) {
    const all = lists();
    all[key] = { models: ids.slice(0, MAX_MODELS), at };
    const others = Object.entries(all).filter(([k]) => k !== key).sort((x, y) => (Number(y[1]?.at) || 0) - (Number(x[1]?.at) || 0)).map(([k]) => k);
    const keep = new Set([key, ...others].slice(0, MAX_LISTS));
    for (const k of Object.keys(all)) if (!keep.has(k)) delete all[k];
    persistLists();
}
/** 실리태번 화면이 가진 그 공급자의 모델 목록 (#model_<id>_select — 번역기와 같은 목록 · 웹사이트 고름 · 채팅 모델이 아닌 OpenAI 이름은 뺌). Custom 은 본체 주소를 쓸 때만 */
export function pageModels(id, cfg) {
    const src = source(id);
    if (!src) return [];
    return LM.pageModels(src.id, { inheritCustom: src.id !== 'custom' || customEndpoint(cfg).inherit });
}
/**
 * 고를 수 있는 모델: provider = 공용 목록 (새로 받은 목록이 있으면 그것 + 모델 등록, 오래됐거나 없으면 모델 등록 · KNOWN · 화면 목록도 함께)
 *                  compat = 받아 둔 목록
 */
export function modelList(cfg) {
    const c = cfg || {};
    if (c.engine === 'compat') return cachedModels(listKey(c));
    const src = source(c.provider);
    if (!src) return cachedModels(listKey(c));
    const ep = src.id === 'custom' ? customEndpoint(c) : null;
    // 5.7.1: 받은 목록이 오래됐거나(옛 1.3.x 캐시 포함) 없으면 화면 목록 · KNOWN 도 함께 — 오래된 목록 뒤에 새 모델이 숨지 않게
    const stale = LM.isStale(listKey(c));
    return LM.list(src.id, { customUrl: ep ? ep.url : undefined, inheritCustom: ep ? ep.inherit : true, known: true, all: stale, proxy: ep ? '' : str(inheritedProxy(src.id)?.reverse_proxy) }).ids;
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

/**
 * 실리태번 서버의 /status 로 공급자의 모델 목록을 받아 캐시에 넣는다 (키는 서버가 붙임) → ids (새것 먼저 · 채팅 모델만)
 * 받기 · 거르기 · 공용 캐시 · 같은 목록 요청 묶기는 live-models.js 의 refresh. 요청 본문 · 오류 문구는 예전과 같다
 */
export async function fetchProviderModels(cfg, { signal } = {}) {
    const c = cfg || {};
    const src = source(c.provider);
    if (!src) throw koErr('모르는 공급자예요');
    if (!src.status) throw koErr('이 API 는 목록을 받아 오지 않아요');
    if (src.id === 'custom' && !validUrl(customEndpoint(c).url)) throw koErr('Custom 주소를 넣어 주세요');
    const pre = setupProblem(src);
    if (pre) throw koErr(pre);
    const key = listKey(c);
    const fetcher = async (url, body, opts) => {
        try {
            return await fetchJson(url, { method: 'POST', headers: getRequestHeaders(), body, signal: opts?.signal, timeout: LIST_TIMEOUT });
        } catch (e) {
            // 실리태번은 키·계정 ID·Azure 설정이 빠지면 빈 400 을 준다 (요청 형식 오류 라고 하면 헷갈림)
            if (Number(e?.status) === 400 && !(opts?.signal && opts.signal.aborted)) throw koErr('목록을 받지 못했어요 (키·설정 확인)', { status: 400 });
            throw e;
        }
    };
    let ids;
    try {
        ids = await LM.refresh(src.id, { key, body: sourceExtras(src, c, true), fetcher, signal });
    } catch (e) {
        if (e && e.empty) throw koErr('목록을 받지 못했어요 (키·주소 확인)');
        throw e;
    }
    putModels(key, ids, LM.cached(key).at || Date.now());
    return ids;
}
/** OpenAI 호환(직접 주소·키): GET {주소}/models → 캐시 → ids (키는 채팅 요청과 같은 서버로만 · api.openai.com 이면 채팅 모델만) */
export async function fetchCompatModels(cfg, { signal } = {}) {
    const c = cfg || {};
    const base = normUrl(c.base);
    if (!validUrl(base)) throw koErr('주소를 먼저 넣어 주세요');
    const headers = str(c.key).trim() ? { Authorization: `Bearer ${str(c.key).trim()}` } : {};
    const j = await fetchJson(`${base}/models`, { method: 'GET', headers, signal, timeout: LIST_TIMEOUT });
    const key = `compat:${base}`;
    const entries = LM.modelEntries(/^https?:\/\/api\.openai\.com(\/|$)/i.test(base) ? 'openai' : 'compat', j);
    LM.put(key, entries);
    const ids = entries.map(e => e.id);
    putModels(key, ids, LM.cached(key).at || Date.now());
    return ids;
}
export const LIST_TTL = LM.TTL;
/**
 * 카드를 열 때 목록을 조용히 다시 받아도 되나 (통신 없음 — 판단만). 받는 것은 부르는 쪽이 fetchProviderModels · fetchCompatModels 로.
 *   provider: 목록을 받는 공급자 · Azure 아님 · 키가 있음(또는 키 없이 됨 · 본체 리버스 프록시) · 실리태번 쪽 준비됨 ·
 *             Custom 은 본체 주소이거나 전에 ↻ 로 받아 본 주소 · 목록이 없거나 하루(LIST_TTL)가 지남 · 실패 뒤 기다리는 중이 아님
 *   compat:   주소 · 키가 있고 전에 ↻ 로 받아 본 주소의 목록이 하루가 지남 (새로 적은 주소로 키가 가지 않게)
 *   st:       false
 */
export function needsAutoList(cfg) {
    const c = cfg || {};
    const key = listKey(c);
    const known = LM.cached(key).at > 0;
    if (c.engine === 'compat') {
        return validUrl(normUrl(c.base)) && !!str(c.key).trim() && known && LM.isStale(key) && !LM.inBackoff(key);
    }
    if (c.engine && c.engine !== 'provider') return false;
    const src = source(c.provider);
    if (!src || !autoListOk(src.id)) return false;
    const ks = keyState(src.id);
    if (!(ks === 'yes' || ks === 'optional' || inheritedProxy(src.id))) return false;
    if (src.id === 'custom') {
        const ep = customEndpoint(c);
        if (!validUrl(ep.url) || !(ep.inherit || known)) return false;
    }
    if (setupProblem(src)) return false;
    return LM.isStale(key) && !LM.inBackoff(key);
}
/** 받아 둔 목록이 바뀌면 cb({ key, source }) — 실리태번이 연결하며 받은 목록도. 그만 들으려면 돌려준 함수를 부른다 */
export const onListChange = (cb) => LM.onChange(cb);

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
 * 모델별 요청 규칙 — 테마 공용 하나(live-models.js, 번역기 · 다시 쓰기와 같음). 본체 화면을 거치지 않고 서버로 바로 보내므로 여기서 맞춘다
 * (최신 OpenAI 추론 모델은 max_completion_tokens · 샘플링 값 거부, Claude 5 이후 · Fable 은 샘플링 값 거부 — 새 세대 이름도 같은 대접)
 */
export function applyModelRequestRules(provider, model, body) {
    return LM.applyModelRequestRules(provider, model, body);
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
 *   OpenAI: 서버가 추론 모델에만 붙임 · Claude: 적응형 생각 모델(Fable · Claude 5 이후 · Opus 4.7/4.8)만 · Google: Gemini 3 이후만.
 *   그 밖은 보내지 않는다 (생각을 안 하던 모델이 생각을 시작하거나, 모르는 값을 거절하는 공급자가 있음). 규칙은 live-models.js 의 lowEffort
 */
function lowEffort(provider, model) {
    return LM.lowEffort(provider, model);
}
