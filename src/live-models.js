// 공용 모델 목록 (채팅 완성 LLM) — 번역 · 다시 쓰기 · 한글화 패널 · 모델 전환 · TTS 대사 분석이 같이 쓴다
//
// "항상 최신": 공급자가 지금 내놓는 모델을 보여 준다. 실리태번 서버의 /status (키는 서버가 secrets 에서 붙임 — 여기선 값을 읽지 않는다)
// 로 받은 목록을 이 브라우저의 localStorage 에 하루(TTL) 둔다. settings.json 에는 두지 않는다 (폰 ↔ PC 동기화가 출렁이지 않게).
// 페이지를 열 때는 통신하지 않는다 — 설정 화면 · 카드를 열 때(autoRefresh)나 ↻ 를 누를 때(refresh)만, 같은 목록 요청은 하나로 묶고, 실패하면 조용히(예전 목록 그대로).
// 실리태번이 지금 공급자에 연결하며 받은 목록(model_list)은 요청 없이 그대로 받아 둔다.
//
// 목록 순서 (list):
//   받은 목록이 있으면  → 받은 목록(새것 먼저: created 내림차순, 없으면 이름 속 버전 내림차순) + 모델 등록 (공급자가 안 주는 옛 이름은 붙이지 않는다)
//   받은 목록이 없으면  → 모델 등록 → KNOWN(테마가 아는 최신 이름, 새것 먼저) → 실리태번 화면 목록(#model_<id>_select)
//   저장된 모델이 목록에 없으면 savedMissing — 화면은 그 이름을 그대로 골라 둔 채 보여 준다 (몰래 바꾸지 않는다)
//
// 실리태번 모듈은 정적 import 하지 않는다 (아래 HOST — 맨 위 await 로 한 번 읽음). 실리태번 밖(시험)에서 못 읽으면 기능만 줄고 오류는 안 난다.
//
// 밖으로:
//   STATUS_SOURCES · KNOWN · TTL · STORE_KEY
//   sourceOf(key) → 실리태번 chat_completion_source ('google' → 'makersuite')
//   canList(source) · cacheKey(source, customUrl?, proxy?) · keyState(source) · hasInheritedProxy(source) · inheritedProxyUrl(source)
//     5.7.1 리버스 프록시로 받은 목록은 '<공급자>@<프록시 주소>' 키에 따로 — 프록시(중계)의 모델이 직접 연결 칸에 섞여 첫째로 골리지 않게
//   pageModels(source, { inheritCustom }) · registered(source)
//   cached(key) → { ids, created, at } · isStale(key) · inBackoff(key) · put(key, ids|entries, { at })
//   modelEntries(source, data) → [{ id, created }] (거르기 · 정렬) · modelIdsFrom(source, data) → ids
//   sourceExtras(source, { settings, customUrl, inherit, forStatus, substitute }) → /status · /generate 에 붙는 본체 설정
//   refresh(source, opts) → Promise<ids> (실패하면 던짐) · autoRefresh(source, opts) → Promise<ids | null> (조용히)
//     opts.inheritProxy: false = 본체 리버스 프록시를 따르지 않음 (그 애드온이 생성도 본체 프록시로 보내지 않을 때 — 번역기 · 다시 쓰기 · 한글화 · 모델 전환)
//   list(source, { saved, customUrl, inheritCustom, known, page, all, proxy }) → { ids, savedMissing, live, at, key }   proxy = 그 애드온이 생성을 보내는 프록시 ('' = 직접)
//   onChange(cb) → 그만 듣기 함수 · fillSelect(select, ids, opts) → 바뀌었나
//   applyModelRequestRules(source, model, body) · lowEffort(source, model)

// ---------- 실리태번 (설치 자리: public/scripts/extensions/third-party/<테마>/src/live-models.js)
async function tryImport(path) {
    try { return await import(path); } catch { return null; }
}
const HOST = await (async () => {
    const [script, extensions, secrets, openai, models] = await Promise.all([
        tryImport('../../../../../script.js'),
        tryImport('../../../../extensions.js'),
        tryImport('../../../../secrets.js'),
        tryImport('../../../../openai.js'),
        tryImport('./addons/models/state.js'),
    ]);
    return { script, extensions, secrets, openai, models };
})();

export const TTL = 24 * 60 * 60 * 1000;     // 받은 목록을 믿는 시간 (지나면 설정을 열 때 조용히 다시)
export const STORE_KEY = 'bl_live_models_v1';
const LEGACY_TTS_KEY = 'lemon_voice_model_lists';   // TTS 1.3.x 까지의 목록 캐시 (읽기만)
const MAX_KEYS = 12;
const MAX_MODELS = 2000;
const STATUS_URL = '/api/backends/chat-completions/status';
const LIST_TIMEOUT = 30000;
const FAIL_WAIT = 30 * 60 * 1000;           // 실패 뒤 저절로 다시 묻기까지 (30분 · 1시간 · 2시간 … TTL 까지)

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const uniq = (arr) => [...new Set(arr)];
const normUrl = (u) => str(u).trim().replace(/\/+$/, '');
function validUrl(u) {
    try { const p = new URL(u); return p.protocol === 'http:' || p.protocol === 'https:'; } catch { return false; }
}

function ctx() {
    try { return HOST.extensions?.getContext?.() || globalThis.SillyTavern?.getContext?.() || null; } catch { return null; }
}
/** 실리태번 채팅 완성 설정 (oai_settings) */
function hostCs() {
    const c = ctx()?.chatCompletionSettings;
    return isObj(c) ? c : {};
}
function hostSettings() {
    try { const s = HOST.extensions?.extension_settings || ctx()?.extensionSettings; return isObj(s) ? s : {}; } catch { return {}; }
}
function hostHeaders() {
    try {
        const f = HOST.script?.getRequestHeaders || ctx()?.getRequestHeaders;
        const h = typeof f === 'function' ? f() : null;
        return isObj(h) ? h : { 'Content-Type': 'application/json' };
    } catch { return { 'Content-Type': 'application/json' }; }
}
function hostSub(t) {
    try {
        const f = HOST.script?.substituteParams || ctx()?.substituteParams;
        return typeof f === 'function' ? f(str(t)) : str(t);
    } catch { return str(t); }
}

// ---------- 공급자
/** 실리태번 /status 가 목록을 주는 공급자 (CometAPI 는 본체에서 꺼짐). azure_openai 는 진짜 채팅을 한 번 보내므로 ↻ 로만 */
export const STATUS_SOURCES = Object.freeze(['openai', 'custom', 'aimlapi', 'azure_openai', 'chutes', 'workers_ai', 'cohere', 'deepseek',
    'electronhub', 'fireworks', 'groq', 'makersuite', 'mistralai', 'moonshot', 'nanogpt', 'openrouter', 'pollinations', 'siliconflow', 'xai']);
const STATUS = new Set(STATUS_SOURCES);
const NO_AUTO = new Set(['azure_openai']);
/** secrets 키 (하나라도 있으면 됨, 빈 배열 = 키 없이 됨) */
const SECRETS = {
    openai: ['api_key_openai'], custom: [], ai21: ['api_key_ai21'], aimlapi: ['api_key_aimlapi'], azure_openai: ['api_key_azure_openai'],
    chutes: ['api_key_chutes'], claude: ['api_key_claude'], workers_ai: ['api_key_workers_ai'], cohere: ['api_key_cohere'],
    deepseek: ['api_key_deepseek'], electronhub: ['api_key_electronhub'], fireworks: ['api_key_fireworks'], groq: ['api_key_groq'],
    makersuite: ['api_key_makersuite'], vertexai: ['api_key_vertexai', 'vertexai_service_account_json'], mistralai: ['api_key_mistralai'],
    minimax: ['api_key_minimax'], moonshot: ['api_key_moonshot'], nanogpt: ['api_key_nanogpt'], openrouter: ['api_key_openrouter'],
    perplexity: ['api_key_perplexity'], pollinations: ['api_key_pollinations'], siliconflow: ['api_key_siliconflow'], xai: ['api_key_xai'],
    zai: ['api_key_zai'],
};
/** 본체 리버스 프록시를 쓰는 공급자 */
const PROXY = new Set(['openai', 'claude', 'deepseek', 'makersuite', 'vertexai', 'mistralai', 'moonshot', 'xai', 'zai']);
/** 화면의 모델 select (없으면 model_<source>_select) */
const SELECT_ID = { makersuite: 'model_google_select', azure_openai: 'azure_openai_model' };
/** 목록 칸의 특별한 값 (웹사이트에서 고름 · 직접 입력) — 모델 이름이 아니다 */
const NOT_MODEL = new Set(['', 'OR_Website', 'custom', '__custom__']);

/** 번역기 · 한글화 패널의 공급자 이름 → 실리태번 chat_completion_source */
export function sourceOf(key) {
    const k = str(key).trim();
    return k === 'google' ? 'makersuite' : k;
}
export const canList = (source) => STATUS.has(sourceOf(source));

/**
 * KNOWN — 받은 목록이 없을 때 보여 줄 최신 이름 (새것 먼저). 릴리스 때 이 표 하나만 고친다.
 * 근거: 실리태번 1.19 staging(ad29cbd, 2026-10-03) index.html 의 목록 · 테마 2026-09 목록 · OpenRouter 공개 목록(2026-10-07)에 있는 새 모델
 * (claude-sonnet-5-5 2026-09-28 · gpt-6.1-sol 2026-09-29 · glm-5.3 계열 · grok-4.7 · command-a-plus · mistral-large-4-0 …).
 * 실리태번 화면 목록에 이미 있는 옛 이름은 화면 목록이 채운다 — 여기엔 지금 세대만.
 */
const GEMINI = Object.freeze(['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite',
    'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite']);
// 2026-10-08: claude-haiku-5-5 (10-07) · anthropic/claude-haiku-5.5 · grok-4.6/4.5/4.3 · mistral-large-4-0 를 넣고, 끝났거나 곧 끝나는 이름을 뺌
//   (각 공급자 deprecations 문서: o4-mini · gpt-4.1-nano 10-23 · gpt-5 · o3 12-11 · gpt-5.1 · gpt-5.4-nano 2027-04-01 · gpt-5.3-chat-latest 08-10 ·
//   claude-sonnet-4-5 11-30 · groq llama 08-16 · grok-4 05-15 · pixtral-large · open-mistral-nemo · c4ai-aya-expanse-8b · deepseek-v4-flash ·
//   OpenRouter gemini-2.5-pro 10-20). 이미 고른 값은 savedMissing 으로 그대로 보인다.
export const KNOWN = Object.freeze({
    openai: Object.freeze(['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.6',
        'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.2', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini']),
    claude: Object.freeze(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'claude-opus-5', 'claude-sonnet-5',
        'claude-fable-5', 'claude-haiku-4-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-opus-4-5']),
    makersuite: GEMINI,
    vertexai: GEMINI,
    openrouter: Object.freeze(['anthropic/claude-haiku-5.5', 'mistralai/mistral-large-4-0', 'openai/gpt-6.1-sol', 'anthropic/claude-sonnet-5.5', 'z-ai/glm-5.3-prime',
        'qwen/qwen3.8-max-prime', 'anthropic/claude-opus-5.5', 'cohere/command-a-plus', 'openai/gpt-6-sol', 'openai/gpt-6-luna', 'x-ai/grok-4.7',
        'google/gemini-3.8-flash', 'anthropic/claude-fable-5.1', 'openai/gpt-6-astra', 'google/gemini-3.7-flash', 'deepseek/deepseek-v4.1-flash',
        'anthropic/claude-opus-5', 'anthropic/claude-sonnet-5', 'moonshotai/kimi-k3', 'z-ai/glm-5.3', 'google/gemini-3.5-flash-lite',
        'google/gemini-3.1-pro-preview', 'openai/gpt-5.6-terra', 'openai/gpt-5.6-luna', 'qwen/qwen3.8-max-0902', 'x-ai/grok-4.6',
        'deepseek/deepseek-v4-pro', 'mistralai/mistral-medium-3-5', 'anthropic/claude-haiku-4.5']),
    deepseek: Object.freeze(['deepseek-flash', 'deepseek-v4-pro']),
    cohere: Object.freeze(['command-a-plus-05-2026', 'command-a-03-2025', 'command-a-vision-07-2025', 'command-r7b-12-2024', 'command-r-plus-08-2024',
        'command-r-08-2024', 'c4ai-aya-expanse-32b']),
    zai: Object.freeze(['glm-5.3-prime', 'glm-5.3-flashx', 'glm-5.3-flash', 'glm-5.3', 'glm-5.2', 'glm-5-turbo', 'glm-5.1', 'glm-5', 'glm-4.7', 'glm-4.7-flash']),
    xai: Object.freeze(['grok-4.7', 'grok-4.6', 'grok-4.5', 'grok-4.3']),
    mistralai: Object.freeze(['mistral-large-4-0', 'mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest']),
    groq: Object.freeze(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']),
});

/** 실리태번에 그 공급자의 키가 있나: 'yes' · 'no' · 'optional'(키 없이 됨) · 'unknown'(secrets 를 못 읽음) */
export function keyState(source) {
    const src = sourceOf(source);
    const keys = SECRETS[src];
    if (!keys) return 'unknown';
    if (!keys.length) return 'optional';
    const c = hostCs();
    if (src === 'pollinations' && c.pollinations_endpoint === 'anonymous') return 'optional';
    let st = null;
    try { st = HOST.secrets?.secret_state; } catch { st = null; }
    if (!isObj(st) || !Object.keys(st).length) return 'unknown';
    const want = src === 'vertexai' ? [c.vertexai_auth_mode === 'full' ? 'vertexai_service_account_json' : 'api_key_vertexai'] : keys;
    const has = (k) => { const v = st[k]; return Array.isArray(v) ? v.length > 0 : !!v; };
    if (want.some(has)) return 'yes';
    return want.some(k => k in st) ? 'no' : 'unknown';
}
/** 본체 리버스 프록시: 그 공급자가 실리태번의 지금 공급자이고 프록시가 적혀 있을 때만 (값은 요청 본문으로만) */
function inheritedProxy(source, settings) {
    const c = isObj(settings) ? settings : hostCs();
    if (!PROXY.has(source) || c.chat_completion_source !== source) return null;
    const url = str(c.reverse_proxy).trim();
    return url ? { reverse_proxy: url, proxy_password: str(c.proxy_password) } : null;
}
export const hasInheritedProxy = (source) => !!inheritedProxy(sourceOf(source));
/** 5.7.1 본체 리버스 프록시 주소 (따를 때만 · 없으면 '') — 본체 연결을 따르는 칸(TTS 대사 분석 · 모델 등록)이 목록 키에 */
export const inheritedProxyUrl = (source) => str(inheritedProxy(sourceOf(source))?.reverse_proxy).trim();

/**
 * 공급자별 접속 설정 (본체 설정을 따름) — /status(forStatus) 와 /generate 에 같이. 키 순서도 TTS 1.3.x 와 같다 (요청이 글자까지 같게).
 *   customUrl: Custom 주소 (정리해서 씀) · inherit: 본체 Custom 주소를 쓰는 중 (그땐 본체의 추가 헤더 · 본문도)
 */
export function sourceExtras(source, { settings, customUrl = '', inherit = false, forStatus = false, substitute } = {}) {
    const src = sourceOf(source);
    const c = isObj(settings) ? settings : hostCs();
    const sub = typeof substitute === 'function' ? substitute : hostSub;
    const out = {};
    switch (src) {
        case 'custom':
            out.custom_url = normUrl(customUrl);
            if (inherit) {
                out.custom_include_headers = sub(c.custom_include_headers);
                if (!forStatus) {
                    out.custom_include_body = sub(c.custom_include_body);
                    out.custom_exclude_body = sub(c.custom_exclude_body);
                }
            }
            break;
        case 'vertexai':
            if (!forStatus) {
                out.vertexai_auth_mode = c.vertexai_auth_mode === 'full' ? 'full' : 'express';
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
    const proxy = inheritedProxy(src, c);
    if (proxy) Object.assign(out, proxy);
    return out;
}

/** 캐시 키: Custom → 'custom:<주소>' (주소를 안 주면 본체 Custom 주소) · 그 밖 → 공급자 id (프록시로 받으면 '<id>@<프록시>'). TTS 의 listKey 와 같은 꼴 */
export function cacheKey(source, customUrl, proxy = '') {
    const src = sourceOf(source);
    if (src !== 'custom') { const px = normUrl(proxy); return px ? `${src}@${px}` : src; }
    const own = normUrl(customUrl);
    return `custom:${own || normUrl(hostCs().custom_url)}`;
}
function sourceOfKey(key) {
    const k = str(key);
    if (k.startsWith('custom:')) return 'custom';
    if (k.startsWith('compat:')) return /^compat:https?:\/\/api\.openai\.com(\/|$)/i.test(k) ? 'openai' : 'compat';
    const at = k.indexOf('@');
    return at > 0 ? k.slice(0, at) : k;
}

// ---------- 거르기 · 정렬
// OpenAI 의 /models 에는 채팅 모델이 아닌 것(임베딩 · 음성 · 그림 · Responses 전용 …)도 섞여 있다
// 5.7.1 Responses API 전용 (o1-pro · o3-pro · gpt-5-pro · gpt-6.1-sol-pro …) — 실리태번은 chat/completions 로만 보내 실패한다. 저장된 값은 savedMissing 으로 그대로 보임
const OPENAI_RESPONSES_ONLY = /^(o\d+|gpt-\d[\w.]*?)(-[a-z]+)*-pro(-|$)/i;
const OPENAI_NOT_CHAT = /(embedding|whisper|tts|dall-e|moderation|transcribe|realtime|audio|image|search|babbage|davinci|sora|computer-use|codex|deep-research)/i;
/** 이름만 보고 거르기 (화면 목록 · 옛 캐시에도) */
// 2026-10-08 끝난 Claude (실리태번 화면 목록에 아직 있음 — platform.claude.com/docs/en/about-claude/model-deprecations):
//   Opus 4 · Sonnet 4 (06-15) · Opus 4.1 (08-05) · 3.x · 2.x · 1.x · instant. 이미 고른 값은 savedMissing 으로 그대로 보인다
const CLAUDE_RETIRED = /^claude-(?:(?:opus|sonnet)-4-(?:0|1|20\d{6})(?:-|$)|[123](?:[-.]|$)|instant|v\d)/i;
function keepId(source, id) {
    switch (source) {
        case 'openai': return !OPENAI_NOT_CHAT.test(id) && !OPENAI_RESPONSES_ONLY.test(id);
        case 'claude': return !CLAUDE_RETIRED.test(id);
        case 'groq': return !/whisper|guard|tts|orpheus/i.test(id);
        case 'openrouter': return !/:batch$/i.test(id);
        case 'makersuite': case 'vertexai': return !/tts/i.test(id);
        case 'chutes': return !/affine/i.test(id);
        default: return true;
    }
}
/** 응답 항목의 정보로 거르기 (채팅을 못 하는 모델 · 끝난 모델) */
function keepEntry(source, id, o) {
    if (!keepId(source, id)) return false;
    if (!o) return true;
    switch (source) {
        case 'groq': return o.active !== false;
        case 'mistralai': return isObj(o.capabilities) && 'completion_chat' in o.capabilities ? !!o.capabilities.completion_chat : true;
        case 'cohere': return Array.isArray(o.endpoints) ? o.endpoints.includes('chat') : true;
        case 'aimlapi': return typeof o.type === 'string' ? o.type === 'chat-completion' : true;
        case 'electronhub': return Array.isArray(o.endpoints) ? o.endpoints.includes('/v1/chat/completions') : true;
        case 'openrouter': {
            const out = o.architecture?.output_modalities;
            if (Array.isArray(out) && out.length && !out.includes('text')) return false;
            const end = o.expiration_date ? Date.parse(o.expiration_date) : NaN;
            return !(Number.isFinite(end) && end < Date.now());
        }
        default: return true;
    }
}
/** 이름 속 버전으로 비교: 같은 글자 부분은 가나다순, 버전(3.8 · 2025-08)은 큰 것 먼저, 짧은 이름(별칭) 먼저 */
function tokens(id) {
    return str(id).toLowerCase().match(/\d+(?:\.\d+)*|\D+/g) || [];
}
function versionCmp(a, b) {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        const d = (y[i] ?? -1) - (x[i] ?? -1);
        if (d) return d;
    }
    return 0;
}
function nameCmp(a, b) {
    const x = tokens(a), y = tokens(b);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
        const p = x[i], q = y[i];
        const pn = /^\d/.test(p), qn = /^\d/.test(q);
        if (pn && qn) { const d = versionCmp(p, q); if (d) return d; continue; }
        if (pn !== qn) return pn ? -1 : 1;
        if (p !== q) return p < q ? -1 : 1;
    }
    if (x.length !== y.length) return x.length - y.length;
    return a < b ? -1 : a > b ? 1 : 0;
}
function sortEntries(list) {
    return list.sort((a, b) => (b.created - a.created) || nameCmp(a.id, b.id));
}

/** /status · /models 응답 → [{ id, created }] (거르기 · 중복 제거 · 새것 먼저). { data } · 배열 · { models }(Cohere name) · 오류 꼴 */
export function modelEntries(source, data) {
    const src = sourceOf(source);
    const raw = Array.isArray(data) ? data
        : Array.isArray(data?.data) ? data.data
            : Array.isArray(data?.models) ? data.models
                : Array.isArray(data?.data?.data) ? data.data.data : [];
    const seen = new Map();
    for (const x of raw) {
        const o = x && typeof x === 'object' ? x : null;
        const id = str(o ? (o.id ?? o.name ?? '') : x).trim().replace(/^models\//, '');
        if (!id || NOT_MODEL.has(id) || id.length > 300) continue;
        if (!keepEntry(src, id, o)) continue;
        let created = Number(o?.created) || 0;
        if (created > 1e12) created = Math.floor(created / 1000);   // 밀리초로 주는 서버
        if (!seen.has(id) || created > seen.get(id)) seen.set(id, created);
    }
    return sortEntries([...seen].map(([id, created]) => ({ id, created }))).slice(0, MAX_MODELS);
}
export const modelIdsFrom = (source, data) => modelEntries(source, data).map(e => e.id);

// ---------- 캐시 (localStorage, 최근 MAX_KEYS 개)
let mem = null;   // localStorage 를 못 쓰면 이번 세션만
function storage() {
    try { return globalThis.localStorage || null; } catch { return null; }
}
function store() {
    if (mem) return mem;
    let v = null;
    try { v = JSON.parse(storage()?.getItem(STORE_KEY) || 'null'); } catch { v = null; }
    mem = isObj(v) ? v : {};
    return mem;
}
function persist() {
    try { storage()?.setItem(STORE_KEY, JSON.stringify(store())); } catch { /* 저장소 없음 · 가득 참 — 이번 세션만 */ }
}
const touched = (e) => Math.max(Number(e?.at) || 0, Number(e?.tried) || 0);
function prune(keep) {
    const all = store();
    const order = Object.keys(all).filter(k => k !== keep).sort((x, y) => touched(all[y]) - touched(all[x]));
    const stay = new Set([keep, ...order].slice(0, MAX_KEYS));
    for (const k of Object.keys(all)) if (!stay.has(k)) delete all[k];
}
function writeEntry(key, entries, at) {
    const all = store();
    const list = entries.slice(0, MAX_MODELS);
    const e = { at, ids: list.map(x => x.id) };
    if (list.some(x => x.created)) e.created = list.map(x => x.created || 0);
    all[key] = e;
    prune(key);
    persist();
}
function noteFailure(key) {
    const all = store();
    const e = isObj(all[key]) ? all[key] : (all[key] = { at: 0, ids: [] });
    e.tried = Date.now();
    e.fails = Math.min(8, (Number(e.fails) || 0) + 1);
    prune(key);
    persist();
}

/** 시험용: 메모리에 읽어 둔 캐시 · 옛 캐시 · 받는 중 표시를 비운다 (localStorage 는 그대로) */
export function _resetForTest() {
    mem = null;
    legacyTts = undefined;
    inflight.clear();
}

/** 다른 곳에서 받은 목록을 넣는다 (ids 또는 [{ id, created }]) — 이 순서를 그대로 쓴다 */
export function put(key, list, { at = Date.now() } = {}) {
    const k = str(key);
    if (!k) return;
    const src = sourceOfKey(k);
    const entries = (Array.isArray(list) ? list : [])
        .map(x => (isObj(x) ? { id: str(x.id).trim(), created: Number(x.created) || 0 } : { id: str(x).trim(), created: 0 }))
        .filter(x => x.id && !NOT_MODEL.has(x.id) && keepId(src, x.id));
    const seen = new Set();
    writeEntry(k, entries.filter(x => (seen.has(x.id) ? false : seen.add(x.id))), Number(at) || Date.now());
    emit(k);
}

// 옛 캐시 (읽기만, 지우지 않음): TTS localStorage · 번역기 · 다시 쓰기 · 한글화 패널 · 장기 기억 · 모델 전환의 Custom 주소별 목록 (settings.json)
const legacyMemo = new WeakMap();
function legacyIds(src, raw) {
    if (!Array.isArray(raw)) return [];
    if (legacyMemo.has(raw)) return legacyMemo.get(raw);
    const ids = uniq(raw.map(x => str(isObj(x) ? (x.id ?? x.name) : x).trim()).filter(id => id && !NOT_MODEL.has(id) && keepId(src, id)));
    legacyMemo.set(raw, ids);
    return ids;
}
const timeOf = (v) => (typeof v === 'number' ? v : Number.isFinite(Date.parse(v)) ? Date.parse(v) : 0);
function legacyEntry(raw) {
    if (Array.isArray(raw)) return { list: raw, at: 0 };
    if (!isObj(raw)) return null;
    const list = Array.isArray(raw.models) ? raw.models : Array.isArray(raw.ids) ? raw.ids : null;
    return list ? { list, at: timeOf(raw.at ?? raw.fetchedAt ?? raw.fetched_at) } : null;
}
let legacyTts;   // 한 번만 읽음
function legacyCandidates(key) {
    const out = [];
    if (legacyTts === undefined) {
        try { legacyTts = JSON.parse(storage()?.getItem(LEGACY_TTS_KEY) || 'null'); } catch { legacyTts = null; }
        if (!isObj(legacyTts)) legacyTts = null;
    }
    const t = legacyTts && legacyEntry(legacyTts[key]);
    if (t) out.push(t);
    if (key.startsWith('custom:')) {
        const url = key.slice(7);
        const ext = hostSettings();
        const maps = [ext['llm-translator-custom']?.custom_model_lists, ext.ban_word_rewrite?.customModelLists, ext['prompt-panel']?.customModelLists,
            ext.memoria?.direct?.customModelLists, ext.model_switch?.lists];
        for (const byUrl of maps) {
            if (!isObj(byUrl)) continue;
            for (const [u, v] of Object.entries(byUrl)) {
                if (normUrl(u) !== url) continue;
                const e = legacyEntry(v);
                if (e) out.push(e);
            }
        }
    }
    return out;
}

/** 받아 둔 목록 → { ids, created, at } (없으면 ids []). 이 캐시와 옛 캐시 가운데 가장 최근 것 */
export function cached(key) {
    const k = str(key);
    const src = sourceOfKey(k);
    const own = store()[k];
    let best = isObj(own) && Array.isArray(own.ids) && own.ids.length
        ? { ids: own.ids.filter(id => typeof id === 'string' && id), created: Array.isArray(own.created) ? own.created : [], at: Number(own.at) || 0 }
        : null;
    for (const e of legacyCandidates(k)) {
        if (best && e.at <= best.at) continue;
        const ids = legacyIds(src, e.list);
        if (ids.length) best = { ids, created: [], at: e.at };
    }
    return best || { ids: [], created: [], at: 0 };
}
export function isStale(key) {
    const at = cached(key).at;
    return !at || Date.now() - at > TTL;
}
/** 실패 뒤 저절로 다시 묻기를 기다리는 중인가 (30분 · 1시간 · 2시간 … 하루까지 늘어남 — ↻ 는 상관없음) */
export function inBackoff(key) {
    const e = store()[str(key)];
    const fails = Number(e?.fails) || 0;
    if (!fails) return false;
    return Date.now() - (Number(e.tried) || 0) < Math.min(TTL, FAIL_WAIT * 2 ** (fails - 1));
}

// ---------- 화면 목록 · 모델 등록
/** 실리태번 화면의 #model_<id>_select 옵션 (모델 등록 묶음 · 본체가 받은 목록 · 본체 고정 목록). Custom 은 본체 주소를 쓸 때만 */
export function pageModels(source, { inheritCustom = true } = {}) {
    const src = sourceOf(source);
    if (!src || typeof document === 'undefined') return [];
    if (src === 'custom' && !inheritCustom) return [];
    let el = null;
    try { el = document.getElementById(SELECT_ID[src] || `model_${src}_select`); } catch { el = null; }
    if (!el || !el.options) return [];
    const out = [];
    for (const o of el.options) {
        const v = str(o?.value).trim();
        if (v && !NOT_MODEL.has(v) && keepId(src, v)) out.push(v);
    }
    return uniq(out);
}
/** 모델 등록에 넣어 둔 이름 (모델 등록 add-on 의 modelsOf — 못 읽으면 설정에서 바로) */
export function registered(source) {
    const src = sourceOf(source);
    let list = null;
    try { list = HOST.models?.modelsOf?.(src); } catch { list = null; }
    if (!Array.isArray(list)) {
        const s = hostSettings().model_register?.sources;
        list = isObj(s) && Array.isArray(s[src]) ? s[src] : [];
    }
    return uniq(list.map(x => str(x).trim()).filter(v => v && !NOT_MODEL.has(v)));
}

// ---------- 받기
const inflight = new Map();   // 캐시 키 → Promise<ids>
const listeners = new Set();
function emit(key) {
    for (const cb of [...listeners]) { try { cb({ key, source: sourceOfKey(key) }); } catch { /* 듣는 쪽 오류는 무시 */ } }
}
/** 목록이 바뀌면 cb({ key, source }) — 받은 뒤 · 실리태번이 연결하며 받은 목록을 받아 둔 뒤. 그만 들으려면 돌려준 함수를 부른다 */
export function onChange(cb) {
    if (typeof cb !== 'function') return () => {};
    listeners.add(cb);
    return () => listeners.delete(cb);
}
async function postStatus(url, body, { signal, timeout = LIST_TIMEOUT } = {}) {
    const ac = new AbortController();
    const stop = () => ac.abort();
    if (signal) { if (signal.aborted) stop(); else signal.addEventListener('abort', stop, { once: true }); }
    const timer = setTimeout(stop, timeout);
    try {
        const r = await fetch(url, { method: 'POST', headers: hostHeaders(), body: JSON.stringify(body), signal: ac.signal, cache: 'no-cache' });
        if (!r.ok) { const e = new Error(`목록을 받지 못했어요 (${r.status})`); e.status = r.status; throw e; }
        const text = await r.text();
        return text ? JSON.parse(text) : null;
    } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', stop);
    }
}

/**
 * 실리태번 서버의 /status 로 목록을 받아 캐시에 넣는다 → ids (새것 먼저). 실패하면 던진다 (↻ 용 — 저절로는 autoRefresh).
 * opts: customUrl (Custom · 비면 본체 주소) · inheritCustom (본체 Custom 주소를 쓰는 중 — 기본: customUrl 이 비었을 때)
 *       reverseProxy · proxyPassword (주면 본체 프록시 대신) · body (본체 설정 대신 붙일 것 — TTS 가 자기 규칙으로)
 *       inheritProxy (false = 본체 프록시를 붙이지 않음) · fetcher(url, body, { signal, timeout }) → JSON (TTS 가 자기 오류 문구로) · signal · timeout
 *       key (캐시 키 — 없으면 공급자 · 주소 · 본문의 프록시로)
 * 같은 키를 받는 중이면 그 요청을 같이 기다린다.
 */
function statusRequest(src, opts) {
    if (!STATUS.has(src)) return { error: Object.assign(new Error('이 API 는 목록을 받아 오지 않아요'), { status: 0 }) };
    let extras = opts.body;
    if (!isObj(extras)) {
        const inherit = opts.inheritCustom ?? !normUrl(opts.customUrl);
        const url = src === 'custom' ? (normUrl(opts.customUrl) || normUrl(hostCs().custom_url)) : '';
        if (src === 'custom' && !validUrl(url)) return { error: Object.assign(new Error('Custom 주소를 넣어 주세요'), { status: 0 }) };
        extras = sourceExtras(src, { customUrl: url, inherit, forStatus: true });
        if (opts.inheritProxy === false) { delete extras.reverse_proxy; delete extras.proxy_password; }
    }
    const body = { chat_completion_source: src, ...extras };
    if (opts.reverseProxy) { body.reverse_proxy = str(opts.reverseProxy); body.proxy_password = str(opts.proxyPassword); }
    return { body };
}
const requestKey = (src, opts, req) => str(opts.key) || cacheKey(src, opts.customUrl, req && req.body ? req.body.reverse_proxy : '');
export function refresh(source, opts = {}) {
    const src = sourceOf(source);
    const req = statusRequest(src, opts);
    const key = requestKey(src, opts, req);
    if (inflight.has(key)) return inflight.get(key);
    const job = (async () => {
        if (req.error) throw req.error;
        const body = req.body;
        const fetcher = typeof opts.fetcher === 'function' ? opts.fetcher : postStatus;
        let j;
        try {
            j = await fetcher(STATUS_URL, body, { signal: opts.signal, timeout: opts.timeout || LIST_TIMEOUT });
        } catch (e) {
            if (!(opts.signal && opts.signal.aborted)) noteFailure(key);
            throw e;
        }
        const entries = modelEntries(src, j);
        if (!entries.length && j && j.error) {
            noteFailure(key);
            throw Object.assign(new Error('목록을 받지 못했어요 (키·주소 확인)'), { status: 0, empty: true });
        }
        writeEntry(key, entries, Date.now());
        emit(key);
        return entries.map(e => e.id);
    })();
    inflight.set(key, job);
    job.then(() => inflight.delete(key), () => inflight.delete(key));
    return job;
}

/**
 * 조용히 다시 받기 (설정 화면 · 카드를 열 때, 공급자를 바꿀 때). 받을 때만 Promise<ids>, 아니면 null 로 끝남 — 던지지 않는다.
 * 받는 때: 목록이 없거나 TTL 이 지났고 · 실패 뒤 기다리는 중이 아니고 · 키가 있거나(또는 본체 프록시) · Azure 가 아니고 ·
 *          Custom 이면 본체 Custom 주소이거나 저장된 주소(savedUrl: true)일 때만 (새로 친 주소로 키가 가지 않게)
 * opts: refresh 와 같음 + savedUrl
 */
export function autoRefresh(source, opts = {}) {
    const src = sourceOf(source);
    if (!STATUS.has(src) || NO_AUTO.has(src)) return Promise.resolve(null);
    const req = statusRequest(src, opts);
    if (req.error) return Promise.resolve(null);
    const key = requestKey(src, opts, req);
    if (inflight.has(key)) return inflight.get(key).catch(() => null);
    if (!isStale(key) || inBackoff(key)) return Promise.resolve(null);
    const c = hostCs();
    const ks = keyState(src);
    if (!(ks === 'yes' || ks === 'optional' || str(req.body.reverse_proxy).trim())) return Promise.resolve(null);
    if (src === 'custom') {
        const url = normUrl(opts.customUrl) || normUrl(c.custom_url);
        if (!validUrl(url)) return Promise.resolve(null);
        if (url !== normUrl(c.custom_url) && opts.savedUrl !== true) return Promise.resolve(null);
    }
    if (src === 'workers_ai' && !str(c.workers_ai_account_id).trim()) return Promise.resolve(null);
    return refresh(src, opts).catch(() => null);
}

// 실리태번이 지금 공급자에 연결하며 받은 목록(model_list)을 요청 없이 받아 둔다.
// 연결 상태가 바뀔 때(ONLINE_STATUS_CHANGED — 본체가 목록을 채운 뒤) 새 배열일 때만 · 'no_connection' 이 아닐 때만 (다른 공급자의 옛 목록을 잘못 넣지 않게)
let seenList;
function harvest() {
    const mod = HOST.openai;
    if (!mod) return;
    let arr;
    try { arr = mod.model_list; } catch { return; }
    const fresh = Array.isArray(arr) && arr.length > 0 && arr !== seenList;
    seenList = arr;
    const status = str(ctx()?.onlineStatus);
    if (!fresh || !status || status === 'no_connection') return;
    const c = hostCs();
    const src = str(c.chat_completion_source);
    if (!STATUS.has(src)) return;
    const key = cacheKey(src, src === 'custom' ? c.custom_url : undefined, inheritedProxy(src, c)?.reverse_proxy);   // 본체가 프록시로 받은 목록은 프록시 키에
    if (key === 'custom:') return;
    const entries = modelEntries(src, arr);
    if (!entries.length) return;
    // 같은 목록을 반나절 안에 또 받았으면 적지 않는다 (연결할 때마다 localStorage 를 다시 쓰지 않게)
    const own = store()[key];
    if (isObj(own) && Array.isArray(own.ids) && own.ids.length === entries.length && entries.every((e, i) => own.ids[i] === e.id)
        && Date.now() - (Number(own.at) || 0) < TTL / 2) return;
    writeEntry(key, entries, Date.now());
    emit(key);
}
(function hook() {
    try {
        const es = HOST.script?.eventSource, et = HOST.script?.event_types;
        if (!es || typeof es.on !== 'function' || !et?.ONLINE_STATUS_CHANGED) return;
        try { seenList = HOST.openai?.model_list; } catch { seenList = undefined; }
        es.on(et.ONLINE_STATUS_CHANGED, () => { try { harvest(); } catch { /* 받아 두기 실패는 조용히 */ } });
    } catch { /* 실리태번 밖 */ }
})();

// ---------- 고를 목록
/**
 * 고를 모델 목록 → { ids, savedMissing, live, at, key }
 * opts: saved (지금 고른 모델) · customUrl · inheritCustom (화면의 본체 Custom 목록을 쓸지 — 기본: customUrl 이 비었거나 본체 주소)
 *       known (KNOWN 을 넣을지, 기본 true) · page (화면 목록, 기본 true) · all (받은 목록이 있어도 화면 목록 · KNOWN 까지 — 제안용)
 *       proxy (5.7.1 그 애드온이 생성을 보내는 리버스 프록시 — 그 프록시로 받은 목록을 읽음. 기본 '' = 직접 연결의 목록)
 */
export function list(source, { saved = '', customUrl, inheritCustom, known = true, page = true, all = false, proxy = '' } = {}) {
    const src = sourceOf(source);
    const key = cacheKey(src, customUrl, proxy);
    const live = cached(key);
    const inherit = inheritCustom ?? (!normUrl(customUrl) || normUrl(customUrl) === normUrl(hostCs().custom_url));
    const reg = registered(src);
    const fromPage = page ? pageModels(src, { inheritCustom: inherit }) : [];
    const fallback = known ? (KNOWN[src] || []) : [];
    let ids;
    if (live.ids.length) ids = all ? uniq([...live.ids, ...fromPage, ...reg, ...fallback]) : uniq([...live.ids, ...reg]);
    else ids = uniq([...reg, ...fallback, ...fromPage]);
    ids = ids.slice(0, MAX_MODELS);
    const want = str(saved).trim();
    return { ids, savedMissing: !!want && !NOT_MODEL.has(want) && !ids.includes(want), live: live.ids.length > 0, at: live.at, key };
}

/**
 * <select> 를 채운다 (같은 내용이면 손대지 않음 — 폰에서 깜빡이지 않게). 바뀌었으면 true
 * opts: saved (고른 모델 — 목록에 없으면 '<이름><missingSuffix>' 로 맨 앞에 두고 고름) · missingSuffix (기본 ' (이전 목록)')
 *       placeholder (고른 것이 없을 때 맨 앞 글) · customValue · customLabel (맨 끝 직접 입력 항목, 기본 '직접 입력…') · customSelected
 */
export function fillSelect(select, ids, { saved = '', missingSuffix = ' (이전 목록)', placeholder = '', customValue = '', customLabel = '직접 입력…', customSelected = false } = {}) {
    if (!select || typeof document === 'undefined') return false;
    const want = str(saved).trim();
    const items = [];
    if (!customSelected && want && !ids.includes(want)) items.push([want, want + missingSuffix, true]);
    else if (!customSelected && !want && placeholder) items.push(['', placeholder, true]);
    for (const id of ids) items.push([id, id, !customSelected && id === want]);
    if (customValue) items.push([customValue, customLabel, customSelected]);
    const sig = JSON.stringify(items);
    if (select.dataset && select.dataset.blLiveSig === sig) return false;
    const frag = document.createDocumentFragment();
    for (const [value, label, selected] of items) {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = label;
        if (selected) o.selected = true;
        frag.append(o);
    }
    select.replaceChildren(frag);
    if (select.dataset) select.dataset.blLiveSig = sig;
    return true;
}

// ---------- 모델별 요청 규칙 (실리태번 본체 public/scripts/openai.js 가 자기 요청에 하는 것과 같다)
// 본체 화면을 거치지 않고 서버로 바로 보내므로 여기서 맞춘다. 2026-10 까지의 이름은 예전 세 벌(번역기 · 다시 쓰기 · TTS)과 결과가 같고,
// 새 이름은 가장 새 세대처럼: o5 → o 시리즈 · gpt-7 → GPT-6 · claude-opus-6 / claude-haiku-5 → Claude 5 · gemini-4 → Gemini 3.
const versions = (re, m) => [...m.matchAll(re)].map(x => Number(x[1]));
const inRange = (arr, lo, hi) => arr.some(n => n >= lo && n <= hi);
function isOSeries(source, m) {
    if (source === 'openai') return /^(o1|o3|o4)/.test(m) || inRange(versions(/^o(\d+)/g, m), 5, 9);
    if (source === 'openrouter') return /^openai\/(o1|o3|o4)/.test(m) || inRange(versions(/^openai\/o(\d+)/g, m), 5, 9);
    return false;
}
const isGpt5Plus = (m) => /gpt-(5|6)/.test(m) || inRange(versions(/gpt-(\d+)/g, m), 7, 9);
const isClaude5Plus = (m) => /claude-(fable|opus-5|sonnet-5)/.test(m) || inRange(versions(/claude-[a-z]+-(\d+)/g, m), 5, 9);

/** 모델별 요청 규칙 — body 를 고쳐서 돌려준다 (source: 실리태번 공급자 id · 'google' 도 받음) */
export function applyModelRequestRules(source, model, body) {
    const provider = sourceOf(source);
    const m = str(model);
    const drop = (...keys) => keys.forEach(k => delete body[k]);
    const useMaxCompletion = () => {
        // OpenRouter 는 max_tokens 를 알아서 바꾸므로 OpenAI 직접 연결에서만
        if (provider === 'openai' && body.max_tokens !== undefined) { body.max_completion_tokens = body.max_tokens; delete body.max_tokens; }
    };
    if (isOSeries(provider, m)) {
        useMaxCompletion();
        drop('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }
    // GPT-5 이후: 추론 모드에서는 샘플링 값을 거부한다. GPT-5.1~5.4 는 페널티만 거부 · gpt-5-chat-latest 는 모두 받음
    if ((provider === 'openai' || provider === 'openrouter') && isGpt5Plus(m)) {
        useMaxCompletion();
        if (/gpt-5-chat-latest/.test(m)) { /* 채팅 전용 모델은 샘플링 값을 받는다 */ }
        else if (/gpt-5\.(1|2|3|4)/.test(m) && !/chat-latest/.test(m)) drop('frequency_penalty', 'presence_penalty');
        else drop('temperature', 'top_p', 'frequency_penalty', 'presence_penalty');
    }
    // Claude Fable / Claude 5 이후: 샘플링 값을 모두 거부한다 (OpenRouter 등 프록시 경유 포함)
    if (isClaude5Plus(m)) drop('temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty');
    return body;
}
/**
 * 생각을 오래 하는 모델은 짧게 → 'low' (아니면 ''): 생각 토큰이 응답 길이를 다 써서 답이 잘리지 않게.
 *   OpenAI: 늘 (서버가 추론 모델에만 붙임) · Claude: 적응형 생각 모델(Fable · Claude 5 이후 · Opus 4.7/4.8) · Google: Gemini 3 이후
 */
export function lowEffort(source, model) {
    const provider = sourceOf(source);
    const m = str(model);
    if (provider === 'openai') return 'low';
    if (provider === 'claude' && (/claude-(fable|opus-5|sonnet-5|opus-4-[78])/.test(m) || isClaude5Plus(m))) return 'low';
    if ((provider === 'makersuite' || provider === 'vertexai') && (/gemini-3/.test(m) || inRange(versions(/gemini-(\d+)/g, m), 4, 9))) return 'low';
    return '';
}
