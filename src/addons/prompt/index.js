import { installLocalizationPage } from './localization-ui.js';
import { forEachLimited } from './cache-loading.js';
// Modified 2026-09-24: Blue Lemonade personal preview 1.1.0; based on supplied 개인개조+++ ZIP.
import { installRegexPage } from './regex-ui.js';
import { installGuide } from './guide.js';
import { settingsHTML } from './settings-ui.js';
import { requestActive, applyCustomConnection, customEndpoint, bindConnection } from './connection.js';
/**
  * Prompt Panel
 */

const EXT    = 'prompt-panel';
// CSS URL is derived from this script's own URL (import.meta.url) so it works
// regardless of the actual folder name on disk (e.g. when installed via GitHub
// the folder may be named after the repo, not after EXT).
const SELF_DIR_URL = (() => {
    try { return new URL('./', import.meta.url).href; } catch(e) { return ''; }
})();
const CSS_URL = SELF_DIR_URL ? (SELF_DIR_URL + 'style.css') : '';

// Status Tray / QR Floating 방식: parent.document
const PAR  = (function(){ try { return window.parent || window; } catch(e){ return window; } })();
const PDOC = (function(p){ try { return p.document || document; } catch(e){ return document; } })(PAR);

// ── Dynamic imports ────────────────────────────────────────────────────
let getRequestHeaders, saveSettingsDebounced, eventSource, event_types,
    extension_settings, getContext,
    oai_settings, openai_settings, openai_setting_names,
    getChatCompletionPreset, promptManager,
    characters, unshallowCharacter, world_names, world_info, getSortedEntries,
    setWIOriginalDataValue;

async function initImports() {
    const s = import.meta.url;
    const tp = s.includes('/third-party/');
    const bundled = s.includes('/src/addons/prompt/');
    const base = bundled ? '../../../../../../../' : tp ? '../../../../' : '../../../';
    const base2 = bundled ? '../../../../../../' : tp ? '../../../' : '../../';

    const sm = await import(base + 'script.js');
    getRequestHeaders     = sm.getRequestHeaders;
    saveSettingsDebounced = sm.saveSettingsDebounced;
    eventSource           = sm.eventSource;
    event_types           = sm.event_types;
    characters            = sm.characters;
    unshallowCharacter    = sm.unshallowCharacter;

    const om = await import(base2 + 'openai.js');
    oai_settings         = om.oai_settings;
    openai_settings      = om.openai_settings;
    openai_setting_names = om.openai_setting_names;
    // Used by applyPresetLive() to write translations straight back into ST
    // (same save path ST's own preset "update" button uses) instead of
    // downloading a file the person has to re-import by hand.
    getChatCompletionPreset = om.getChatCompletionPreset;
    promptManager            = om.promptManager;

    const em = await import(base2 + 'extensions.js');
    extension_settings = em.extension_settings;
    getContext         = em.getContext;

    const wi = await import(base2 + 'world-info.js');
    getSortedEntries = wi.getSortedEntries;
    world_names      = wi.world_names;
    world_info       = wi.world_info;
    // Used by applyWorldInfoLive() to keep a character-book's `originalData`
    // mirror in sync with the entries we rewrite (ST does the same on edit).
    setWIOriginalDataValue = wi.setWIOriginalDataValue;
}

// ── Providers ─────────────────────────────────────────────────────────
// Selecting this hands the whole request to SillyTavern's Connection Manager:
// the profile already carries the API, model, key, proxy and completion preset,
// so the panel's own provider/model/parameter/proxy controls are hidden.
const ST_PROFILE = '__st_profile__';
const PROVIDER_LIST = [
    { key: 'custom', label: 'Custom (OpenAI-compatible)', source: 'custom' },
    { key: 'openai',     label: 'OpenAI',           source: 'openai'     },
    { key: 'claude',     label: 'Claude',           source: 'claude'     },
    { key: 'google',     label: 'Google AI Studio', source: 'makersuite' },
    { key: 'vertexai',   label: 'Google Vertex AI', source: 'vertexai'   },
    { key: 'openrouter', label: 'OpenRouter',       source: 'openrouter' },
    { key: 'deepseek',   label: 'DeepSeek',         source: 'deepseek'   },
    { key: 'mistralai',  label: 'MistralAI',        source: 'mistralai'  },
    { key: 'groq',       label: 'Groq',             source: 'groq'       },
    { key: 'cohere',     label: 'Cohere',           source: 'cohere'     },
    { key: 'xai',        label: 'xAI (Grok)',       source: 'xai'        },
    { key: 'zai',        label: 'Z.AI (GLM)',       source: 'zai'        },
];
const PROVIDER_MODELS = {
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
const PROVIDER_TO_SOURCE = {
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
const PARAM_LABELS = { temperature:'응답 다양성', top_p:'확률 범위', top_k:'후보 수', frequency_penalty:'반복 빈도 억제', presence_penalty:'기존 표현 억제' };
const PARAM_RANGES = { temperature:{min:0,max:2,step:0.05}, top_p:{min:0,max:1,step:0.01}, top_k:{min:0,max:200,step:1}, frequency_penalty:{min:-2,max:2,step:0.05}, presence_penalty:{min:-2,max:2,step:0.05} };

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

// ── Settings ──────────────────────────────────────────────────────────
function cfg() {
    if (!extension_settings[EXT]) extension_settings[EXT] = {};
    const c = extension_settings[EXT];
    if (!c.targetLang)    c.targetLang    = 'Korean';
    // Per-area target languages. 제목에는 '본문과 동일'(__same__) 선택지가 없고
    // 항상 구체적인 언어를 가진다. 기존 설정이 '__same__'(또는 미설정)이면 그때
    // 실제로 쓰이던 언어 = 본문 언어를 그대로 박아 넣는다. 해석 결과가 같으므로
    // 이미 쌓인 제목 번역 캐시의 키도 그대로 유지된다.
    if (!c.titleLang || c.titleLang === '__same__') {
        c.titleLang = c.targetLang;
        if (c.targetLang === '__custom__' && !c.titleCustomLang) c.titleCustomLang = c.customLang || '';
    }
    // 주석 has no "follow 본문" mode — a 주석 is a reading aid, so it defaults to
    // 한국어 outright. Migrate anyone still carrying the old '__same__' value.
    if (!c.noteLang || c.noteLang === '__same__') c.noteLang = 'Korean';
    if (!c.connectionMode) c.connectionMode = c.provider === ST_PROFILE ? 'profile' : c.provider ? 'direct' : 'current';
    if (!c.provider)      c.provider      = 'openai';
    if (!c.model)         c.model         = 'gpt-4o-mini';
    if (c.prefillEnabled === undefined) c.prefillEnabled = false;
    if (!c.prefillText)   c.prefillText   = 'Understood. Executing the translation as instructed. Here is the translation:';
    if (c.useReverseProxy === undefined) c.useReverseProxy = false;
    if (!c.reverseProxyUrl) c.reverseProxyUrl = '';
    if (!c.reverseProxyPassword) c.reverseProxyPassword = '';
    c.theme = 'lemonade';
    c.fabVisible = false;
    if (typeof c.originalFontSize !== 'number')   c.originalFontSize   = 14;
    if (typeof c.translatedFontSize !== 'number') c.translatedFontSize = 15;
    // Throttling / batching
    if (typeof c.titleBatchSize !== 'number' || c.titleBatchSize < 1) c.titleBatchSize = 15;
    if (typeof c.requestDelayMs !== 'number' || c.requestDelayMs < 0) c.requestDelayMs = 60;
    // 동시에 보낼 번역 요청 수. 1 = 예전과 완전히 같은 순차 실행(기본값).
    if (typeof c.concurrency !== 'number' || c.concurrency < 1) c.concurrency = 1;
    // 429 / 5xx / 네트워크 오류에 한해 다시 보내는 횟수. 4xx는 재시도하지 않는다.
    if (typeof c.maxRetries !== 'number' || c.maxRetries < 0) c.maxRetries = 2;
    // 응답이 오지 않는 요청을 끊는 상한. 이게 없으면 한 항목에서 영원히 멈춘다.
    if (typeof c.requestTimeoutMs !== 'number' || c.requestTimeoutMs < 5000) c.requestTimeoutMs = 120000;
    if (!c.parameters) c.parameters = {};
    for (const k in DEFAULT_PARAMS) if (!c.parameters[k]) c.parameters[k] = {...DEFAULT_PARAMS[k]};
    return c;
}

function getCurrentParams() {
    const c = cfg();
    const prov = c.provider || 'openai';
    if (!c.parameters[prov]) c.parameters[prov] = {...(DEFAULT_PARAMS[prov]||DEFAULT_PARAMS.openai)};
    return { provider: prov, params: c.parameters[prov] };
}

// ── Translation Cache Layer (user/files + in-memory Map) ─────────────
// Translations live as JSON files under the ST user's data/<user>/user/files,
// so they follow the account instead of one browser origin (localhost vs
// 127.0.0.1, another device, cleared site data all used to lose them).
// The Map stays the source for synchronous reads; files are the persistence.
//
// Layout (ST's upload API allows no subfolders, so everything is flat):
//   prompt-panel-cache-index.json          → { version, shards: [file, …] }
//   prompt-panel-cache-<hash>.json         → { entries: { cacheKey: translation } }
// One shard per preset / world info / character (title entries share the
// item's shard), so saving one translation rewrites one small file.
const CACHE_PREFIX     = 'prompt-panel-cache-';
const CACHE_INDEX_FILE = `${CACHE_PREFIX}index.json`;
const CACHE_SAVE_DELAY = 600;
const LEGACY_DB_NAME   = 'PTTranslationDB_PLUS';   // old IndexedDB store, read once for migration

const translationMap = new Map();  // key → translation string
const keyShard       = new Map();  // key → shard file
const shardKeys      = new Map();  // shard file → Set<key>
const dirtyShards    = new Set();
// Shards listed in the index that failed to load. Writing them would replace
// the unread file with only this session's entries, so they are never saved.
const brokenShards   = new Set();
let indexShards      = new Set();  // shard files the index file lists
let cacheWritable    = true;       // false when the index itself could not be read
let saveTimer        = null;
let saveChain        = Promise.resolve();
let saveErrorShown   = false;
let indexDirty       = false;

// FNV-1a — a stable, filename-safe id for a namespace. A collision would only
// put two items in one file; entries are still keyed by their full cache key.
function hashNS(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}
const shardFileForNS = (ns) => `${CACHE_PREFIX}${hashNS(String(ns).replace(/@title$/, ''))}.json`;
// Keys are `${ns}::${id}::${lang}`; used only where the ns is not at hand (migration).
const nsFromKey = (key) => key.split('::').slice(0, -2).join('::');

function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
}

async function fileGetJSON(name) {
    const res = await fetch(`/user/files/${name}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${name} → ${res.status}`);
    return await res.json();
}
async function filePutJSON(name, obj) {
    const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name, data: utf8ToBase64(JSON.stringify(obj)) }),
    });
    if (!res.ok) throw new Error(`upload ${name} → ${res.status}`);
}
async function fileDelete(name) {
    const res = await fetch('/api/files/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ path: `user/files/${name}` }),
    });
    if (!res.ok && res.status !== 404) throw new Error(`delete ${name} → ${res.status}`);
}

function memPut(file, key, t) {
    translationMap.set(key, t);
    keyShard.set(key, file);
    if (!shardKeys.has(file)) shardKeys.set(file, new Set());
    shardKeys.get(file).add(key);
}
function cachePut(ns, key, t) {
    const file = shardFileForNS(ns);
    memPut(file, key, t);
    markDirty(file);
}
function cacheDelete(key) {
    if (!translationMap.has(key)) return;
    translationMap.delete(key);
    const file = keyShard.get(key);
    keyShard.delete(key);
    if (file) { shardKeys.get(file)?.delete(key); markDirty(file); }
}

function markDirty(file) {
    dirtyShards.add(file);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushTranslationCache, CACHE_SAVE_DELAY);
}

function flushTranslationCache() {
    clearTimeout(saveTimer);
    saveTimer = null;
    // Chained so two flushes never upload the same shard concurrently.
    saveChain = saveChain.then(doFlush, doFlush);
    return saveChain;
}

async function doFlush() {
    if (!cacheWritable || (!dirtyShards.size && !indexDirty)) return;
    const files = [...dirtyShards];
    dirtyShards.clear();
    const failed = [];
    for (const file of files) {
        if (brokenShards.has(file)) continue;
        const keys = shardKeys.get(file);
        try {
            if (!keys || !keys.size) {
                if (indexShards.has(file)) {
                    await fileDelete(file);
                    indexShards.delete(file);
                    indexDirty = true;
                }
                shardKeys.delete(file);
                continue;
            }
            const entries = {};
            for (const k of keys) {
                const v = translationMap.get(k);
                if (v != null) entries[k] = v;
            }
            await filePutJSON(file, { entries });
            if (!indexShards.has(file)) { indexShards.add(file); indexDirty = true; }
        } catch (e) {
            console.warn(`[${EXT}] cache save failed: ${file}`, e);
            failed.push(file);
        }
    }
    if (indexDirty) {
        try { await writeCacheIndex(); indexDirty = false; }
        catch (e) { console.warn(`[${EXT}] cache index save failed`, e); }
    }
    if (failed.length || indexDirty) {
        failed.forEach(f => dirtyShards.add(f));
        if (!saveErrorShown && typeof toastr !== 'undefined') {
            saveErrorShown = true;
            toastr.error('번역 캐시를 파일로 저장하지 못했습니다. 잠시 후 다시 시도합니다.');
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flushTranslationCache, 10000);
    } else {
        saveErrorShown = false;
    }
}

const writeCacheIndex = () => filePutJSON(CACHE_INDEX_FILE, { version: 1, shards: [...indexShards] });

// Remove every translation (memory + files). The index is kept (empty) so the
// one-time IndexedDB migration does not run again.
async function clearTranslationCache() {
    clearTimeout(saveTimer);
    await saveChain.catch(() => {});
    const files = new Set([...indexShards, ...shardKeys.keys()]);
    translationMap.clear();
    keyShard.clear();
    shardKeys.clear();
    dirtyShards.clear();
    brokenShards.clear();
    for (const f of files) {
        try { await fileDelete(f); } catch (e) { console.warn(`[${EXT}] cache delete failed: ${f}`, e); }
    }
    indexShards = new Set();
    indexDirty = false;
    try { await writeCacheIndex(); } catch (e) { console.warn(`[${EXT}] cache index save failed`, e); }
}

// Old versions kept translations in this browser's IndexedDB. Read it once
// (without creating it) so they are not lost; the database itself is left alone.
async function readLegacyIndexedDB() {
    try {
        if (typeof indexedDB === 'undefined') return [];
        if (indexedDB.databases) {
            const dbs = await indexedDB.databases();
            if (!dbs.some(d => d.name === LEGACY_DB_NAME)) return [];
        }
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open(LEGACY_DB_NAME);
            req.onupgradeneeded = () => { req.transaction.abort(); };   // did not exist — don't create it
            req.onsuccess = () => resolve(req.result);
            req.onerror   = () => reject(req.error);
        });
        try {
            if (!db.objectStoreNames.contains('translations')) return [];
            return await new Promise((resolve, reject) => {
                const req = db.transaction('translations', 'readonly').objectStore('translations').getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror   = () => reject(req.error);
            });
        } finally { db.close(); }
    } catch (e) {
        return [];
    }
}

// Load all translations into the memory Map at startup
async function initTranslationCache() {
    let index;
    try {
        index = await fileGetJSON(CACHE_INDEX_FILE);
    } catch (e) {
        // Unknown state on disk — saving now could orphan existing shards.
        cacheWritable = false;
        console.warn(`[${EXT}] cache index load failed; translations will not be saved this session`, e);
        if (typeof toastr !== 'undefined') toastr.warning('번역 캐시 파일을 읽지 못해 이번 세션에는 번역이 저장되지 않습니다.');
        return;
    }

    if (index === null) {
        const legacy = await readLegacyIndexedDB();
        for (const rec of legacy) {
            if (rec?.cacheKey && rec.translation) {
                const file = shardFileForNS(nsFromKey(rec.cacheKey));
                memPut(file, rec.cacheKey, rec.translation);
                dirtyShards.add(file);
            }
        }
        if (legacy.length) console.log(`[${EXT}] migrating ${translationMap.size} translations from IndexedDB to user/files`);
        if (dirtyShards.size) await flushTranslationCache();
        else { try { await writeCacheIndex(); } catch (e) {} }
        console.log(`[${EXT}] Translation cache loaded: ${translationMap.size} entries`);
        return;
    }

    indexShards = new Set(Array.isArray(index.shards) ? index.shards : []);
    await forEachLimited(indexShards,4,async file => {
        try {
            const data = await fileGetJSON(file);
            const entries = data?.entries || {};
            for (const [k, v] of Object.entries(entries)) {
                if (typeof v === 'string' && !translationMap.has(k)) memPut(file, k, v);
            }
        } catch (e) {
            brokenShards.add(file);
            console.warn(`[${EXT}] cache shard load failed: ${file}`, e);
        }
    });
    if (brokenShards.size && typeof toastr !== 'undefined') {
        toastr.warning(`번역 캐시 파일 ${brokenShards.size}개를 읽지 못했습니다. 해당 항목의 번역은 이번 세션에 저장되지 않습니다.`);
    }
    console.log(`[${EXT}] Translation cache loaded: ${translationMap.size} entries`);
}

// A hidden/closing tab gets no more timer ticks — push pending writes now.
try {
    PDOC.addEventListener('visibilitychange', () => { if (PDOC.visibilityState === 'hidden') flushTranslationCache(); });
    PAR.addEventListener('pagehide', () => flushTranslationCache());
} catch (e) {}

// Effective target language string.
// The dropdown may hold the sentinel '__custom__', in which case the user's
// free-text language (customLang) is what we actually send to the model and
// what we key the cache by. Never let '__custom__' itself reach a cache key.
function resolveLang(sel, custom) {
    if (sel === '__custom__') {
        const v = (custom || '').trim();
        return v || 'Korean';
    }
    return sel || 'Korean';
}

// effLang(area) — area is 'title' | 'note' | undefined (= 본문/body, the default).
// 주석은 '본문과 동일'이 없고 한국어가 기본이다. 제목도 마찬가지로 구체적인
// 언어를 갖도록 cfg()에서 옮겨지지만, 혹시 남아 있는 옛 '__same__' 값은 예전처럼
// 본문 언어로 읽어 준다.
function effLang(area) {
    const c = cfg();
    const body = resolveLang(c.targetLang, c.customLang);
    if (area === 'title') {
        // 하위 호환: 마이그레이션 전에 저장된 옛 값이면 본문 언어를 따른다.
        if (!c.titleLang || c.titleLang === '__same__') return body;
        return resolveLang(c.titleLang, c.titleCustomLang);
    }
    if (area === 'note') {
        return resolveLang(c.noteLang || 'Korean', c.noteCustomLang);
    }
    return body;
}

const ck        = (ns, id) => `${ns}::${id}::${effLang()}`;
const getCached = (ns, id) => translationMap.get(ck(ns, id)) ?? null;
const setCache  = (ns, id, t) => {
    const key = ck(ns, id);
    cachePut(ns, key, t);  // debounced file save
};

// Title-only translations live in a sibling namespace so that they never
// shadow a full translation. Consequences of this separation:
//   - Pressing 번역 later still performs a full translation (no cache hit).
//   -  and script export prefer the full translation's title when present,
//     and fall back to the title-only cache otherwise.
const titleNS = (ns) => `${ns}@title`;
// Title entries are keyed by the 제목 language, body entries by the 본문 language,
// so the two areas can target different languages without colliding. 제목이 본문과
// 같은 언어를 가리키면 두 값이 같은 문자열로 해석되어, 예전 버전에서 쌓인 캐시가
// 그대로 계속 맞는다.
const ckT = (ns, id) => `${titleNS(ns)}::${id}::${effLang('title')}`;
// Drop a title-only entry. Called when a full translation succeeds, so the
// newer full translation's title wins. Without this, a stale title-only
// result would keep overriding it (title cache has higher precedence).
const clearCachedTitle = (ns, id) => {
    cacheDelete(ckT(ns, id));
};
const getCachedTitle = (ns, id) => translationMap.get(ckT(ns, id)) ?? null;
const setCacheTitle  = (ns, id, t) => {
    cachePut(ns, ckT(ns, id), t);
};

const clearNS = (ns, ids) => {
    ids.forEach(id => {
        cacheDelete(ck(ns, id));
        cacheDelete(ckT(ns, id));
    });
};

// Stats helper for UI
function getCacheStats() {
    let totalChars = 0;
    for (const v of translationMap.values()) totalChars += v.length;
    const bytes = totalChars * 2;  // UTF-16 approx
    const kb = bytes / 1024;
    const sizeStr = kb > 1024 ? `${(kb/1024).toFixed(2)} MB` : `${kb.toFixed(1)} KB`;
    return { count: translationMap.size, sizeStr };
}

// Local heuristic only. ctx.getTokenCount() is a synchronous XHR per uncached
// string on chat-completion APIs (ST 1.19), so a few hundred blocks would block
// the UI a few hundred times while rendering; this is an estimate for display.
function estimateTokens(text) {
    if (!text) return 0;
    const cjk=(text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)||[]).length;
    return Math.ceil(cjk/1.5+(text.length-cjk)/4);
}

let isBusy=false, stopReq=false;

// 진행 중인 요청과 "요청 간 대기" 타이머를 모아 둔다. 중단 버튼은 예전에 플래그만
// 세웠기 때문에 이미 날아간 요청의 응답과 대기 시간이 끝나야 멈췄다. 이제 둘 다
// 즉시 깨워서 누른 순간 멈춘다.
const inFlight = new Set();
const sleepWaiters = new Set();

// 사용자가 중단해서 끝난 것을 일반 실패와 구분하는 표식.
function stopError() { const e = new Error('중단됨'); e.__stopped = true; return e; }

// stopReq가 서면 즉시 깨어나는 대기. 그 외에는 setTimeout과 동일하다.
function sleepCancellable(ms) {
    if (!(ms > 0) || stopReq) return Promise.resolve();
    return new Promise(resolve => {
        const w = {};
        w.done = () => { clearTimeout(w.timer); sleepWaiters.delete(w); resolve(); };
        w.timer = setTimeout(w.done, ms);
        sleepWaiters.add(w);
    });
}

function requestStop() {
    stopReq = true;
    for (const ac of [...inFlight])     { try { ac.abort(); } catch (e) {} }
    for (const w  of [...sleepWaiters]) { try { w.done();   } catch (e) {} }
}

// Each tab registers { sleep, wake } here. A loaded 프리셋 can be 471 toggles
// (~100KB of text), which becomes several thousand DOM nodes plus their
// listeners — and a closed panel is only display:none, so all of it stayed in
// SillyTavern's document. ST's own $()/querySelectorAll calls walk that tree
// and every style invalidation recomputes it, which is what made ST sluggish
// after the panel had been used. Closing now drops the rendered rows; `items`
// stays in JS memory so reopening re-renders without touching the source.
const PAGE_HOOKS = [];
function sleepPages() { for (const h of PAGE_HOOKS) { try { h.sleep(); } catch (e) { console.warn(`[${EXT}] page sleep failed`, e); } } }
function wakePages()  { for (const h of PAGE_HOOKS) { try { h.wake();  } catch (e) { console.warn(`[${EXT}] page wake failed`, e); } } }

// ── Connection-profile plumbing ───────────────────────────────────────
const usingStProfile = () => cfg().connectionMode === 'profile';

function getConnSvc() {
    try { return SillyTavern?.getContext?.()?.ConnectionManagerRequestService || null; }
    catch (e) { return null; }
}

// Profiles the Connection Manager exposes for chat/text completion. Returns []
// (never throws) so the settings UI can degrade to a plain message.
function listStProfiles() {
    const svc = getConnSvc();
    if (!svc?.getSupportedProfiles) return [];
    try {
        return (svc.getSupportedProfiles() || [])
            .filter(pr => pr && pr.id)
            .map(pr => ({ id: pr.id, name: pr.name || pr.id, api: pr.api || '', model: pr.model || '' }));
    } catch (e) {
        console.warn(`[${EXT}] connection profiles unavailable`, e);
        return [];
    }
}

// The service needs an explicit token budget. Size it from the request itself —
// a translation is roughly as long as its source, so 2× plus a floor covers
// both a one-line label and a long prompt block.
function budgetFor(messages) {
    const text = messages.map(m => m?.content || '').join('\n');
    return Math.min(32768, Math.max(1024, Math.ceil(estimateTokens(text) * 2)));
}

// Single exit point for every model call. `tweak` may adjust the raw-provider
// payload (used by 재번역 to nudge sampling); it is ignored on the profile path,
// where sampling belongs to the profile's own completion preset.
// 한 번의 호출 = 한 번의 요청. 타임아웃·재시도는 아래 runCompletion이 감싼다.
async function runCompletionOnce(messages, tweak) {
    const c = cfg();
    if(c.connectionMode==='current') {
        return requestActive({cfg,context:getContext,messages,inFlight,hostModules:async()=>{
            const bundled=import.meta.url.includes('/src/addons/prompt/');
            const base=bundled?'../../../../../../../':'../../../../';
            const base2=bundled?'../../../../../../':'../../../';
            const [script,chat,text]=await Promise.all([import(base+'script.js'),import(base2+'openai.js'),import(base2+'textgen-settings.js')]);
            return {script,chat,text};
        }});
    }

    if (usingStProfile()) {
        const svc = getConnSvc();
        if (!svc?.sendRequest) throw new Error('이 SillyTavern 버전에서는 연결 프로필을 쓸 수 없습니다');
        const profileId = c.stProfileId || '';
        if (!profileId) throw new Error('ST 프로필이 선택되지 않았습니다 (확장 설정에서 선택하세요)');
        const known = listStProfiles();
        if (known.length && !known.some(pr => pr.id === profileId)) {
            throw new Error('선택한 ST 프로필을 찾을 수 없습니다 (삭제되었거나 지원되지 않는 유형)');
        }
        // Chat-completion profiles take the messages as-is; text-completion ones
        // need them flattened through the profile's instruct template first.
        let payload = messages;
        try { if (svc.constructPrompt) payload = svc.constructPrompt(messages, profileId); }
        catch (e) { console.warn(`[${EXT}] constructPrompt failed, sending raw messages`, e); }
        const data = await svc.sendRequest(profileId, payload, budgetFor(messages), {
            stream: false,
            extractData: true,
            // The profile's completion preset supplies sampling; its instruct
            // template is irrelevant to a chat-completion translation but is
            // what makes text-completion profiles work, so leave both on.
            includePreset: true,
            includeInstruct: true,
        });
        const out = typeof data === 'string' ? data : (data?.content || '');
        return (out || '').trim();
    }

    const prov = c.provider || 'openai';
    const source = PROVIDER_TO_SOURCE[prov] || prov;
    const model = (c.model === '__custom__' ? (c.customModelName || '') : (c.model || '')) || '';
    const { params } = getCurrentParams();
    const providerParams = getProviderSpecificParams(prov, params);
    const parameters = { model, messages, stream: false, chat_completion_source: source, ...providerParams };
    if (source === 'vertexai') {
        // Read Vertex auth mode and region from ST's main API settings (oai_settings).
        // Hardcoding 'full' breaks users whose ST is configured in 'express' mode,
        // and missing region/project_id causes 404 on certain models.
        parameters.vertexai_auth_mode = oai_settings?.vertexai_auth_mode || 'full';
        const region = oai_settings?.vertexai_region;
        if (region) parameters.vertexai_region = region;
        if (parameters.vertexai_auth_mode === 'express' && oai_settings?.vertexai_express_project_id) {
            parameters.vertexai_express_project_id = oai_settings.vertexai_express_project_id;
        }
    }
    if(source==='custom')applyCustomConnection(parameters,c,oai_settings);
    if (source!=='custom' && c.useReverseProxy && c.reverseProxyUrl?.trim()) {
        parameters.reverse_proxy = c.reverseProxyUrl.trim();
        parameters.proxy_password = c.reverseProxyPassword || '';
    }
    if (typeof tweak === 'function') tweak(parameters, params, providerParams);

    // 응답이 영영 오지 않는 요청을 끊고, 중단 버튼이 진행 중인 요청까지 즉시
    // 취소할 수 있게 한다. 성공 경로에서 오가는 값은 이전과 동일하다.
    const ac = new AbortController();
    inFlight.add(ac);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { ac.abort(); } catch (e) {} }, requestTimeoutMs());
    try {
        const res = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST', headers: { ...getRequestHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(parameters),
            signal: ac.signal,
        });
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try { const err = await res.json(); msg = err?.error?.message || err?.message || msg; } catch (e) {}
            // 상태 코드를 실어 보내야 재시도할 오류인지 판단할 수 있다.
            const e = new Error(msg);
            e.status = res.status;
            const ra = res.headers?.get?.('retry-after');
            if (ra) {
                const s = String(ra).trim();
                e.retryAfterMs = /^\d+$/.test(s) ? parseInt(s, 10) * 1000 : Math.max(0, Date.parse(s) - Date.now());
            }
            throw e;
        }
        const d = await res.json();
        return (d.choices?.[0]?.message?.content?.trim()
            || d.content?.[0]?.text?.trim()
            || d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '').trim();
    } catch (e) {
        // 타임아웃으로 끊은 것은 재시도 대상, 사용자가 중단한 것은 그대로 올린다.
        if (e?.name === 'AbortError' && timedOut) {
            const te = new Error(`요청 시간 초과 (${Math.round(requestTimeoutMs() / 1000)}초)`);
            te.timeout = true;
            throw te;
        }
        throw e;
    } finally {
        clearTimeout(timer);
        inFlight.delete(ac);
    }
}

// 다시 보내면 결과가 달라질 수 있는 오류만 재시도한다. 키 오류·잘못된 모델명 같은
// 4xx는 몇 번을 보내도 같으므로 그대로 실패시킨다.
function isRetryableError(e) {
    if (!e || e.__stopped || e.name === 'AbortError') return false;
    if (e.timeout) return true;
    const s = e.status;
    if (typeof s === 'number') return s === 429 || (s >= 500 && s <= 599);
    return /network|failed to fetch|networkerror|econnreset|socket hang up|timeout|timed out/i.test(e.message || '');
}

// 서버가 Retry-After를 주면 그걸 따르고, 없으면 지수 백오프 + 약간의 지터.
function retryWaitMs(attempt, e) {
    const ra = e?.retryAfterMs;
    if (typeof ra === 'number' && isFinite(ra) && ra >= 0) return Math.min(60000, ra);
    const base = Math.max(500, requestDelayMs());
    return Math.min(30000, base * Math.pow(2, attempt) + Math.floor(Math.random() * 250));
}

// 모든 모델 호출의 단일 출입구. 성공 시 반환값은 예전과 같고, 일시적 실패일 때만
// 사이에 대기를 두고 다시 보낸다.
async function runCompletion(messages, tweak) {
    const tries = maxRetries() + 1;
    let lastErr = null;
    for (let attempt = 0; attempt < tries; attempt++) {
        if (stopReq) throw stopError();
        try {
            return await runCompletionOnce(messages, tweak);
        } catch (e) {
            lastErr = e;
            if (stopReq || e?.name === 'AbortError' || e?.__stopped) throw stopError();
            if (attempt === tries - 1 || !isRetryableError(e)) throw e;
            const wait = retryWaitMs(attempt, e);
            console.warn(`[${EXT}] 요청 실패 — ${wait}ms 후 재시도 (${attempt + 1}/${tries - 1}): ${e.message}`);
            await sleepCancellable(wait);
        }
    }
    throw lastErr;
}

// Prefill rides as an assistant/model turn. A profile hides its source, so read
// the role off the profile's api string instead.
function prefillRole(source) {
    const t = String(source || '').toLowerCase();
    return (t.includes('makersuite') || t.includes('google') || t.includes('vertexai')) ? 'model' : 'assistant';
}

function buildMessages(prompt) {
    const c = cfg();
    const messages = [{ role: 'user', content: prompt }];
    if (c.prefillEnabled && c.prefillText?.trim()) {
        let src;
        if(c.connectionMode==='current'){src=getContext()?.chatCompletionSettings?.chat_completion_source;} else if (usingStProfile()) {
            const pr = listStProfiles().find(x => x.id === c.stProfileId);
            src = pr?.api || '';
        } else {
            src = PROVIDER_TO_SOURCE[c.provider || 'openai'] || c.provider;
        }
        messages.push({ role: prefillRole(src), content: c.prefillText.trim() });
    }
    return messages;
}

// ── Annotation ({{// ... }}) helpers ──────────────────────────────────
// A block's stored translation always keeps the shape
//     본문 번역 (없으면 원문)
//     {{// ========
//     [내용 번역]
//
//     주석 번역
//
//     ========}}
// so 본문 and 주석 can be produced by two separate runs (better model output
// than asking for both at once) and still end up merged into one entry.
const NOTE_RE = /\{\{\s*\/\/([\s\S]*?)\}\}/;

// The 주석 block is fenced and labelled so it is easy to spot while scrolling a
// long prompt. The label is always this exact Korean string, whatever language
// the 주석 itself is translated into — it marks the block, it isn't content.
const NOTE_LABEL = '[내용 번역]';
const NOTE_FENCE = '========';
// Tolerated on read: the fence line, the label line (any [...] variant), and
// the closing fence. Notes stored by older versions had none of these and are
// still parsed correctly, then re-fenced the next time the item is translated.
const NOTE_OPEN_RE  = /^={3,}[ \t]*(?:\r?\n|$)/;
const NOTE_LABEL_RE = /^[ \t]*\[[^\]]*\][ \t]*(?:\r?\n|$)/;
const NOTE_CLOSE_RE = /(?:\r?\n)?[ \t]*={3,}[ \t]*$/;

// Global twin of NOTE_RE, for scanning every comment in a piece of source text.
const NOTE_RE_G = /\{\{\s*\/\/([\s\S]*?)\}\}/g;
// Presence of the  label is what makes a comment *ours*.
const NOTE_MARK_RE = /\[[^\]]*\]/;

// Once a 주석 번역 has been applied to a preset/WI/card, the annotation lives in
// the file itself. Re-loading that file later, the extension has to tell its own
// annotation apart from a comment the author wrote by hand — otherwise it would
// send its own Korean note back to the model as if it were source text, and
// would have no way to know a 주석 already exists once the local cache is gone.
// The fenced [내용 번역] label is that marker: specific enough that no
// hand-written {{// ... }} comment will collide with it.
//
// Returns { source, note } — source is the content with our block removed,
// note is the annotation we recovered (or '' if the text holds none of ours).
// Comments that are NOT ours are left in source untouched.
function extractOwnNote(text) {
    const t = typeof text === 'string' ? text : '';
    if (!t || !NOTE_MARK_RE.test(t)) return { source: t, note: '' };
    NOTE_RE_G.lastIndex = 0;
    for (const m of t.matchAll(NOTE_RE_G)) {
        if (!NOTE_MARK_RE.test(m[1] || '')) continue;   // someone else's comment
        const note = unwrapNoteBody(m[1] || '');
        const source = (t.slice(0, m.index) + t.slice(m.index + m[0].length)).trim();
        return { source, note };
    }
    return { source: t, note: '' };
}

// Peel the fence/label decoration off a note's inner text.
function unwrapNoteBody(inner) {
    let t = (inner || '').trim();
    t = t.replace(NOTE_OPEN_RE, '');
    t = t.replace(NOTE_LABEL_RE, '');
    t = t.replace(NOTE_CLOSE_RE, '');
    return t.trim();
}

function wrapNote(note) {
    return `{{// ${NOTE_FENCE}\n${NOTE_LABEL}\n\n${note}\n\n${NOTE_FENCE}}}`;
}

// Split a stored body part into its 본문 and 주석 halves.
function splitBodyAndNote(bodyText) {
    const t = typeof bodyText === 'string' ? bodyText : '';
    const m = t.match(NOTE_RE);
    if (!m) return { body: t.trim(), note: '' };
    const note = unwrapNoteBody(m[1] || '');
    const body = (t.slice(0, m.index) + t.slice(m.index + m[0].length)).trim();
    return { body, note };
}

// Re-join 본문 + 주석 into the canonical stored shape.
function joinBodyAndNote(body, note) {
    const b = (body || '').trim();
    const n = (note || '').trim();
    if (b && n) return `${b}\n${wrapNote(n)}`;
    if (n) return wrapNote(n);
    return b;
}

// A 주석 lives inside {{// ... }}, so a {{macro}} in it would be terminated by the
// macro's own "}}" — cutting the comment short and leaving half a macro exposed
// to ST's parser. Rewrite every {{...}} inside a note as <...>: the shape asked
// for, and inert to the macro engine.
function sanitizeNoteMacros(text) {
    let t = (text || '');
    // Looped for nested macros like {{random::{{char}}}}; bounded so no input can
    // spin here.
    for (let i = 0; i < 5 && t.includes('{{'); i++) {
        const next = t.replace(/\{\{([^{}]*)\}\}/g, '<$1>');
        if (next === t) break;
        t = next;
    }
    // Anything still unbalanced would break the comment just the same.
    return t.replace(/\{\{/g, '<').replace(/\}\}/g, '>').trim();
}

// The model occasionally wraps its answer in {{// }} on its own when it can see
// the annotation shape in context — unwrap it so we never nest the markers.
function stripNoteWrapper(text) {
    const t = (text || '').trim();
    const m = t.match(/^\{\{\s*\/\/([\s\S]*)\}\}$/);
    return unwrapNoteBody(m ? (m[1] || '') : t);
}

// ── Translation ─────────────────────────────────────────────────
// opts:
//   mode         'body' (default) → target language is 본문; 'note' → 주석 language.
//                Only one of the two is requested per call, so the model never
//                has to produce two different renderings in one response.
//   includeTitle false → do not send/translate the title, because a 제목
//                translation already exists and must be preserved.
async function translateText(name, text, extraNonce, opts = {}) {
    const mode         = opts.mode === 'note' ? 'note' : 'body';
    const includeTitle = opts.includeTitle !== false;
    const hasName    = includeTitle && !!(name && name.trim());
    const hasContent = !!(text && text.trim());
    // Nothing translatable at all → skip
    if (!hasName && !hasContent) return '';
    const c = cfg();
    // 제목 always uses its own configured language, independently of whether this
    // run is producing 본문 or 주석.
    const titleLang = effLang('title');
    const lang = hasContent ? (mode === 'note' ? effLang('note') : effLang()) : titleLang;
    const dualLang = hasName && hasContent && titleLang !== lang;
    const nonce = extraNonce ? `\n<!--retry:${extraNonce}-->` : '';
    // Compose what we send to the model:
    //   - name + content → "### {name}\n\n{content}"
    //   - name only     → "### {name}"   (title-only translation)
    //   - content only  → "{content}"
    const combined = hasName && hasContent
        ? `### ${name}\n\n${text}`
        : (hasName ? `### ${name}` : text);

    // 주석은 {{// ... }} 안에 들어가므로 중괄호 매크로를 그대로 두면 주석이 잘린다.
    const noteRule = mode === 'note'
        ? `\n8. This text will be placed inside an inline annotation. Rule 2 still holds — do not translate a macro's contents — but write every macro in ANGLE brackets instead of curly braces: {{char}} → <char>, {{user}} → <user>, {{getvar::x}} → <getvar::x>. Never emit "{{" or "}}".`
        : '';
    const titleRule = dualLang
        ? `\n0. The first line starts with "### " — that is a TITLE. Translate the title text into ${titleLang} (keep the "### " prefix), and translate everything after it into ${lang}. The two target languages are intentional; do not unify them.`
        : '';
    const headline = dualLang
        ? `Translate the following text: the "### " title line into ${titleLang}, and everything after it into ${lang}.`
        : `Translate the following text into ${lang}.`;

    const prompt =
`${headline}

RULES:${titleRule}
1. Translate ALL human-readable text including headings, labels, titles, and body content.
2. Do NOT translate: HTML/XML tags, {{char}}, {{user}}, {{getvar::*}}, {{setvar::*}}, {{random::*}}, regex patterns, JSON keys, code, URLs, emoji.
3. Do NOT alter references to languages, nationalities, cultures, or styles. For example: if the source says "Chinese style" or "中文风格" or "중국식", translate those words literally — do NOT replace them with the target language name.
4. Preserve all markdown, whitespace, indentation, and line breaks exactly.
5. Output ONLY the translated text — no preamble, no "Here is:", no meta-commentary.
6. Never echo the source text back unchanged. Even if the source is already close to ${lang}, produce a proper ${lang} rendering.
7. If a line starts with "**Keys:**" or "**Filters:**", keep that exact prefix and the comma-separated list format, and keep it on its own line at the top. Translate each item into ${lang}. These are trigger keywords, so render them as the natural word a reader would actually type, not as a literal gloss.${noteRule}

--- SOURCE ---
${combined}
--- END ---

Now output the above text translated${dualLang ? ` (title into ${titleLang}, the rest into ${lang})` : ` into ${lang}`}.${nonce}`;

    let result = await runCompletion(buildMessages(prompt), extraNonce ? (par, params, provParams) => {
        par.top_p = Math.min(1, (params.top_p ?? 1) * 0.97);
        if ('top_k' in provParams) par.top_k = Math.max(1, params.top_k || 40);
    } : null);
    result = result.replace(/^---\s*SOURCE\s*---\s*\n?/i,'').replace(/\n?---\s*END\s*---\s*$/i,'').trim();
    return result;
}

// ── Preset ────────────────────────────────────────────────────────────
function listAllPresets() {
    if (!openai_settings||!openai_setting_names) return [];
    return Object.keys(openai_setting_names).filter(n=>openai_settings[openai_setting_names[n]]).map(n=>({id:n,name:n}));
}
function getCurrentPresetName() {
    if (oai_settings?.preset_settings_openai) return oai_settings.preset_settings_openai;
    for (const s of ['#settings_preset','#preset_name_select','select[name="preset_name"]']) {
        const el=document.querySelector(s); if(!el) continue;
        const txt=el.options[el.selectedIndex]?.text?.trim(); if(txt&&txt!=='—') return txt;
    }
    return '';
}
// Cache namespace for a preset. An empty / '__cur__' selection resolves to the
// loaded preset's real name so the entries never share one '__cur__' bucket.
function presetNs(presetName) {
    const name = (!presetName || presetName === '__cur__') ? (getCurrentPresetName() || '__cur__') : presetName;
    return `pt-preset::${name}`;
}
function readPresetBlocks(presetName) {
    const blocks=[];
    try {
        const cur=getCurrentPresetName();
        let preset=(!presetName||presetName===cur)?oai_settings:openai_settings[openai_setting_names[presetName]];
        if (!preset) return blocks;
        const prompts=preset.prompts||[];
        const allOrders=preset.prompt_order||[];
        const charOrder=allOrders.find(o=>String(o.character_id)==='100001')||allOrders.find(o=>String(o.character_id)==='100000')||allOrders[0];
        const order=charOrder?.order||[];
        const map=Object.fromEntries(prompts.map(p=>[p.identifier,p]));
        const systemIds=new Set(['main','worldInfoBefore','worldInfoAfter','charDescription','charPersonality','scenario','personaDescription','enhanceDefinitions','nsfw','dialogueExamples','chatHistory','jailbreak']);
        for (const entry of order) {
            const p=map[entry.identifier]; if(!p) continue;
            blocks.push({ id:p.identifier, name:p.name||p.identifier, enabled:entry.enabled!==false, content:p.content||'', isCustom:!systemIds.has(p.identifier) });
        }

        // Preset-scoped regex scripts (preset.extensions.regex_scripts).
        // These are listed so their *names* can be translated — the pattern and
        // the replacement are code, and translating either would break the
        // script, so they are shown read-only and marked titleOnly, which keeps
        // them out of the full-body translation run entirely.
        const rx = preset.extensions?.regex_scripts;
        if (Array.isArray(rx)) {
            rx.forEach((r, i) => {
                if (!r) return;
                blocks.push({
                    id: regexBlockId(r, i),
                    name: String(r.scriptName || `Regex ${i + 1}`),
                    enabled: !r.disabled,
                    // The pattern and the replacement are never surfaced: they
                    // are code, they must not be translated, and showing them
                    // only invites someone to try. Only the name is in play.
                    content: '',
                    isRegex: true,
                    titleOnly: true,
                });
            });
        }

        // ST-BaiBai-Tools 그룹(폴더) 이름.
        readPresetGroups(preset).forEach((g, i) => {
            if (!g || !g.name) return;
            blocks.push({
                id: `${GROUP_ID_PREFIX}${g.id || i}`,
                name: String(g.name),
                enabled: g.enabled !== false,
                content: '',
                isGroup: true,
                titleOnly: true,
            });
        });

        // JS러너(酒馆助手) 폴더/스크립트 이름. 코드(content)는 노출하지 않는다.
        readTavernHelperNodes(preset).forEach(({ node, depth, index }) => {
            if (!node.name) return;
            const isFolder = node.type === 'folder' || Array.isArray(node.scripts);
            blocks.push({
                id: `${THS_ID_PREFIX}${node.id || `${depth}-${index}`}`,
                name: String(node.name),
                enabled: String(node.enabled) !== 'false',
                content: '',
                isRunner: true,
                isRunnerFolder: isFolder,
                titleOnly: true,
            });
        });
    } catch(e) { console.warn(`[${EXT}]`,e); }
    return blocks;
}

// Cache id for a preset regex script. Uses the script's own UUID when it has
// one so the cached translation survives reordering; falls back to position.
const REGEX_ID_PREFIX = '__pp_regex__::';
const regexBlockId = (script, index) => `${REGEX_ID_PREFIX}${script?.id || index}`;

// ── Third-party title sources living inside the preset ────────────────
// Both are other extensions' data that happens to ride along in the preset
// file, and both are label-only: their payload is code or layout state, so
// they are read as titleOnly blocks exactly like regex scripts.
const GROUP_ID_PREFIX = '__grp::';
const THS_ID_PREFIX   = '__ths::';

// ST-BaiBai-Tools (柏宝箱) prompt grouping. Current path is
// extensions.baibaiToolkit.presetPromptGroups; extensions.entryGrouping is the
// older layout it still reads as a fallback, so accept both.
function readPresetGroups(preset) {
    const ext = preset?.extensions;
    if (!ext || typeof ext !== 'object') return [];
    const candidates = [ext.baibaiToolkit?.presetPromptGroups, ext.entryGrouping];
    for (const c of candidates) {
        const groups = Array.isArray(c) ? c : (Array.isArray(c?.groups) ? c.groups : null);
        if (groups?.length) return groups;
    }
    return [];
}

// JS-Slash-Runner (酒馆助手) preset-bound scripts. `scripts` is a tree: folders
// carry type 'folder' and nest more entries under their own `scripts`. Folder
// names and script names are both translatable; `content` is JavaScript and is
// never surfaced.
function walkTavernHelper(nodes, visit, depth = 0, out = []) {
    if (!Array.isArray(nodes) || depth > 6) return out;
    nodes.forEach((node, i) => {
        if (!node || typeof node !== 'object') return;
        visit(node, i, depth, out);
        walkTavernHelper(node.scripts, visit, depth + 1, out);
    });
    return out;
}

function readTavernHelperNodes(preset) {
    const scripts = preset?.extensions?.tavern_helper?.scripts;
    return walkTavernHelper(scripts, (node, i, depth, out) => {
        out.push({ node, depth, index: i });
    });
}

// 酒馆助手(JS-Slash-Runner) keeps preset scripts in its own Pinia store, loaded
// once and only re-read when the preset NAME changes — so reopening its script
// list re-renders the same stale copy and our new names never show. It does
// expose a public API on globalThis.TavernHelper, and writing through that
// updates the store (UI reacts immediately) and lets the extension persist the
// change itself. Only valid for the currently selected preset, which is the
// only one its store is bound to.
//
// Returns true if the handoff happened. Best-effort by design: this is another
// extension's API, so any failure must leave our own save untouched.
function pushRunnerTitlesToTavernHelper(ns) {
    const th = (typeof PAR !== 'undefined' && PAR?.TavernHelper) || globalThis.TavernHelper;
    if (typeof th?.updateScriptTreesWith !== 'function') return false;
    try {
        let renamed = 0;
        th.updateScriptTreesWith(trees => {
            walkTavernHelper(trees, (node, i, depth) => {
                const title = getTranslatedTitle(ns, `${THS_ID_PREFIX}${node.id || `${depth}-${i}`}`);
                if (title && node.name !== title) { node.name = title; renamed++; }
            });
            return trees;
        }, { type: 'preset' });
        return renamed > 0;
    } catch (e) {
        console.warn(`[${EXT}] TavernHelper script rename failed`, e);
        return false;
    }
}

// Writes translated group names back onto a preset, in place. Only `name` is
// touched — id/order/collapsed/enabled decide layout and must survive.
function applyPresetGroupTitles(presetObj, ns) {
    let n = 0;
    readPresetGroups(presetObj).forEach((g, i) => {
        if (!g) return;
        const title = getTranslatedTitle(ns, `${GROUP_ID_PREFIX}${g.id || i}`);
        if (title) { g.name = title; n++; }
    });
    return n;
}

// Writes translated names onto the JS-Runner folder/script tree, in place.
// `content` (the script source) is never read or written here.
function applyPresetRunnerTitles(presetObj, ns) {
    let n = 0;
    readTavernHelperNodes(presetObj).forEach(({ node, depth, index }) => {
        const title = getTranslatedTitle(ns, `${THS_ID_PREFIX}${node.id || `${depth}-${index}`}`);
        if (title) { node.name = title; n++; }
    });
    return n;
}

// Writes translated names back onto a preset's regex scripts, in place.
// Title only — findRegex/replaceString are never touched.
// Returns the number of scripts renamed.
function applyPresetRegexTitles(presetObj, ns) {
    const rx = presetObj?.extensions?.regex_scripts;
    if (!Array.isArray(rx)) return 0;
    let n = 0;
    rx.forEach((r, i) => {
        if (!r) return;
        const title = getTranslatedTitle(ns, regexBlockId(r, i));
        if (title) { r.scriptName = title; n++; }
    });
    return n;
}

// ── World Info ────────────────────────────────────────────────────────
function listAllWorldInfos() {
    const items=[];
    try {
        if (Array.isArray(world_names)&&world_names.length) { world_names.forEach(n=>{if(n)items.push({id:n,name:n});}); return items; }
        const sel=document.querySelector('#world_editor_select');
        if (sel) Array.from(sel.options).forEach(o=>{const v=(o.value||o.textContent||'').trim();if(v)items.push({id:v,name:v});});
    } catch(e){}
    return items;
}
// Marker used to carry world-info keywords through the translation round-trip.
const KEYS_MARKER = '**Keys:**';
const FILTERS_MARKER = '**Filters:**';

// Pull the "**Keys:** a, b, c" line out of a body.
// Returns { keys: string[]|null, body } — keys is null when the line is absent,
// in which case callers keep the original keywords untouched.
function splitKeysAndBody(text) {
    if (typeof text !== 'string' || !text) return { keys: null, filters: null, body: text || '' };
    const lines = text.split(/\r?\n/);
    const parseList = v => {
        const out = v.split(/[,，]/).map(k => k.trim()).filter(Boolean);
        return out.length ? out : null;
    };
    let keys = null, filters = null, consumed = -1;
    // Both marker lines sit in the leading block, in either order, possibly
    // separated by blank lines. Scanning stops at the first content line.
    for (let i = 0; i < lines.length && i < 6; i++) {
        const trimmed = lines[i].trim();
        if (trimmed === '') continue;
        // Accepts "**Keys:** a, b" / "**Keys**: a, b" / "Keys: a, b" / "Keys： a, b"
        const mk = trimmed.match(/^\*{0,2}\s*Keys\s*\*{0,2}\s*[:：]\s*\*{0,2}\s*(.*?)\s*\*{0,2}$/i);
        if (mk) { keys = parseList(mk[1]); consumed = i; continue; }
        const mf = trimmed.match(/^\*{0,2}\s*Filters?\s*\*{0,2}\s*[:：]\s*\*{0,2}\s*(.*?)\s*\*{0,2}$/i);
        if (mf) { filters = parseList(mf[1]); consumed = i; continue; }
        break;
    }
    if (consumed < 0) return { keys: null, filters: null, body: text };
    const body = lines.slice(consumed + 1).join('\n').replace(/^(\s*\r?\n)+/, '');
    return { keys, filters, body };
}

// Compact, display-only metadata for a world-info entry.
function readEntryMeta(e) {
    if (!e) return null;
    const posMap = { 0:'↑Char', 1:'↓Char', 2:'↑AN', 3:'↓AN', 4:'@D', 5:'↑EM', 6:'↓EM' };
    const pos = posMap[e.position] ?? (e.position != null ? String(e.position) : '');
    const strat = e.constant ? 'const' : (e.vectorized ? 'vector' : 'normal');
    return {
        strategy: strat,
        position: pos,
        depth: (e.position === 4 && e.depth != null) ? e.depth : null,
        order: e.order ?? null,
        probability: (e.useProbability === false) ? null : (e.probability ?? null),
    };
}

async function readWorldInfo(wiName) {
    const entries=[];
    if (!wiName) return entries;
    try {
        const ctx=SillyTavern.getContext();
        let bookData=null;
        if (typeof ctx.loadWorldInfo==='function') bookData=await ctx.loadWorldInfo(wiName);
        if (!bookData?.entries&&world_info?.[wiName]?.entries) bookData=world_info[wiName];
        if (!bookData?.entries) return entries;
        const rawEntries=Object.entries(bookData.entries);
        rawEntries.sort((a,b)=>Number(a[1]?.uid??a[0])-Number(b[1]?.uid??b[0]));
        for (const [uid,e] of rawEntries) {
            const keys = Array.isArray(e.key) ? e.key.filter(k => String(k||'').trim()) : [];
            const filters = Array.isArray(e.keysecondary) ? e.keysecondary.filter(k => String(k||'').trim()) : [];
            // Keywords and the optional filter ride along inside the translated
            // body as leading marker lines — the same trick already used for
            // titles. This keeps one translation unit per entry, so cache keys,
            // progress, search and  all stay unchanged.
            const body = e.content || '';
            const header = [];
            if (keys.length)    header.push(`${KEYS_MARKER} ${keys.join(', ')}`);
            if (filters.length) header.push(`${FILTERS_MARKER} ${filters.join(', ')}`);
            const content = header.length ? `${header.join('\n')}\n\n${body}` : body;
            entries.push({
                id: `${wiName}::${uid}`,
                name: e.comment || `Entry ${uid}`,
                enabled: !e.disable,
                content,
                meta: readEntryMeta(e),
            });
        }
    } catch(e) { console.warn(`[${EXT}]`,e); }
    return entries;
}

// ── Characters ──────────────────────────────────────────────────
function listAllCharacters() {
    let arr=[];
    try { if(Array.isArray(characters)&&characters.length) arr=characters; } catch(e){}
    if (!arr.length) { try { arr=SillyTavern.getContext().characters||[]; } catch(e){} }
    if (!arr.length) {
        try {
            const blocks=document.querySelectorAll('#rm_print_characters_block .character_select');
            const items=[];
            blocks.forEach(el=>{
                const name=el.querySelector('.ch_name')?.textContent?.trim()||'';
                const avatar=el.getAttribute('avatar')||el.dataset.avatar||'';
                const id=avatar||el.getAttribute('chid')||el.dataset.chid||'';
                if(id&&name)items.push({id,name});
            });
            return items;
        } catch(e){}
    }
    // Use avatar filename as stable ID (survives array reindexing when characters are deleted)
    return arr
        .map((c,i)=>({ id: c?.avatar || `_idx${i}`, name: c?.name || c?.data?.name || `#${i}` }))
        .filter(c=>c.name);
}

// Find character array index given avatar filename (or fallback to number id)
function findCharIndex(avatarOrId) {
    if (!Array.isArray(characters)) return -1;
    // First try: match by avatar
    let idx = characters.findIndex(c => c?.avatar === avatarOrId);
    if (idx >= 0) return idx;
    // Fallback: if it's numeric (legacy behavior), treat as index
    const n = Number(avatarOrId);
    if (!Number.isNaN(n) && n >= 0 && n < characters.length) return n;
    return -1;
}

async function readCharCard(charIdOrAvatar) {
    const fields=[];
    try {
        const idx = findCharIndex(charIdOrAvatar);
        if (idx < 0) return fields;
        if (typeof unshallowCharacter==='function') {
            try { await unshallowCharacter(idx); } catch(e) {}
        }
        let char=null;
        if (Array.isArray(characters)&&characters[idx]) char=characters[idx];
        if (!char) char=SillyTavern.getContext().characters?.[idx];
        if (!char) return fields;
        const d=char.data||{};
        const add=(id,label,val)=>{ if(val&&String(val).trim()) fields.push({id,name:label,content:String(val),isChar:true}); };

        add('description',               ' Description',          d.description    || char.description);
        add('personality',               ' Personality Summary',  d.personality    || char.personality);
        add('scenario',                  ' Scenario',             d.scenario       || char.scenario);
        add('first_mes',                 ' First Greeting',       d.first_mes      || char.first_mes);
        add('mes_example',               ' Examples of Dialogue', d.mes_example    || char.mes_example);
        add('system_prompt',             ' System Prompt',        d.system_prompt);
        // Character's Note (inline injection) = extensions.depth_prompt.prompt
        const depthPrompt = d.extensions?.depth_prompt?.prompt || d.character_note || '';
        add('character_note',            " Character's Note",     depthPrompt);
        add('post_history_instructions', ' Post History Instr.',  d.post_history_instructions);
        add('creator_notes',             ' Creator Notes',        d.creator_notes);
        const alts=d.alternate_greetings||char.alternate_greetings||[];
        alts.forEach((g,i)=>{ if(g&&String(g).trim()) fields.push({id:`alt_greeting_${i}`,name:` Alternate Greeting ${i+1}`,content:String(g),isChar:true}); });
    } catch(e) { console.warn(`[${EXT}]`,e); }
    return fields;
}

// ── UI ────────────────────────────────────────────────────────────────
// Escapes text for safe insertion into both HTML text nodes and quoted
// attribute values. Quotes matter: prompt/entry names are placed into
// title="..." attributes, and an unescaped quote there would let a crafted
// name break out of the attribute.
const esc = s => (s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');

// Search keyword highlight
function highlightText(html, keyword) {
    if (!keyword) return html;
    const safeK = keyword.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return html.replace(new RegExp(`(${safeK})`, 'gi'), '<mark class="pt-highlight">$1</mark>');
}

function makeBlockItem(block, ns, selectable, onEdited) {
    const el = PDOC.createElement('div');
    el.className = 'pt-block-item';
    el.dataset.id = block.id;
    // Title-only blocks (preset regex scripts) never hold a body translation,
    // so their "번역" box shows the translated name instead — otherwise there
    // would be nothing to see there at all.
    // A note recovered from the file (cache lost / different device) is real
    // translated content, so show it rather than claiming 번역 전.
    const cached = block.titleOnly
        ? getCachedTitle(ns, block.id)
        : (getCached(ns, block.id)
            ?? (block.injectedNote ? joinBodyAndNote(block.content || '', block.injectedNote) : null));
    const tokens = estimateTokens(block.content||'');
    el.dataset.searchText = (block.name+' '+(block.content||'')+' '+(cached||'')).toLowerCase();

    // Use ST native FA link icon
    const clipBadge = block.isCustom
        ? `<span class="pt-clip-badge"><i class="fa-solid fa-link"></i></span>` : '';

    // Preset regex script: name is translatable, body is code (read-only).
    const regexBadge = block.isRegex
        ? `<span class="pt-clip-badge" title="프리셋 정규식 — 제목만 번역됩니다"><i class="fa-solid fa-code"></i></span>` : '';

    // Other extensions' labels that live in the preset — same title-only rule.
    const groupBadge = block.isGroup
        ? `<span class="pt-clip-badge" title="프롬프트 그룹 (ST-BaiBai-Tools) — 제목만 번역됩니다"><i class="fa-solid fa-folder"></i></span>` : '';
    const runnerBadge = block.isRunner
        ? `<span class="pt-clip-badge" title="${block.isRunnerFolder ? 'JS러너 폴더' : 'JS러너 스크립트'} — 제목만 번역됩니다"><i class="fa-solid fa-${block.isRunnerFolder ? 'folder-tree' : 'scroll'}"></i></span>` : '';

    // Character cards: no ON/OFF badge
    const statusBadge = block.isChar
        ? ''
        : `<span class="pt-status-badge ${block.enabled!==false?'pt-status-on':'pt-status-off'}">${block.enabled!==false?'ON':'OFF'}</span>`;

    // Select-all checkbox when selectable
    const checkboxHtml = selectable ? `<input type="checkbox" class="pt-checkbox">` : '';

    // Compact metadata strip (world info only). Display-only, never translated.
    const m = block.meta;
    let metaHtml = '';
    if (m) {
        const dot = m.strategy === 'const' ? '' : (m.strategy === 'vector' ? '' : '');
        const bits = [`${dot}`];
        if (m.position)             bits.push(`pos ${esc(m.position)}`);
        if (m.depth != null)        bits.push(`depth ${m.depth}`);
        if (m.order != null)        bits.push(`order ${m.order}`);
        if (m.probability != null && m.probability !== 100) bits.push(`trig ${m.probability}%`);
        metaHtml = `<div class="pt-block-meta">${bits.join('<span class="pt-meta-sep">·</span>')}</div>`;
    }

    el.innerHTML = `
        <div class="pt-block-header">
            ${checkboxHtml}
            ${statusBadge}
            <span class="pt-block-name" title="${esc(block.name)}">${esc(block.name)}</span>
            ${clipBadge}${regexBadge}${groupBadge}${runnerBadge}
            <span class="pt-token-count">${tokens}</span>
            <span class="pt-block-chevron">▶</span>
        </div>
        <div class="pt-block-body">
            ${metaHtml}
            ${block.titleOnly ? '' : `<div class="pt-original-label">원문</div>
            <div class="pt-original-text">${esc(block.content||'')}</div>`}
            <div class="pt-translated-label">${block.titleOnly ? '번역된 제목' : '번역'} <button type="button" class="pt-edit-btn" title="번역 직접 수정"><i class="fa-solid fa-pen"></i></button></div>
            <div class="pt-translated-text">${cached?esc(cached):'<span class="pt-no-trans">번역 전</span>'}</div>
        </div>`;

    el.querySelector('.pt-block-header').addEventListener('click', e => {
        if (e.target.classList.contains('pt-checkbox')) return;
        el.classList.toggle('expanded');
    });

    // ── Direct edit: let the person hand-fix a translated title/body ────
    // instead of re-running the model. Stored back through the exact same
    // "### {title}\n\n{body}" shape a real translation produces, so every
    // reader of the cache (JSON export, TM export,  title mode, etc.)
    // treats a manual edit identically to a model translation.
    const trTextEl = el.querySelector('.pt-translated-text');
    const closeEditForm = () => {
        const form = el.querySelector('.pt-edit-form');
        if (form) form.remove();
        trTextEl.style.display = '';
    };
    el.querySelector('.pt-edit-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        if (el.querySelector('.pt-edit-form')) { closeEditForm(); return; } // already open → toggle closed
        const id = block.id;
        const cachedNow = getCached(ns, id);
        const parsed = splitTitleAndBody(cachedNow || '');
        const titleCached = getCachedTitle(ns, id);
        const curTitle = (titleCached && titleCached.trim()) ? titleCached.trim() : (parsed.title || '');
        const curBody  = parsed.title ? parsed.body : (cachedNow || '');

        const form = PDOC.createElement('div');
        form.className = 'pt-edit-form';
        // Title-only blocks (preset regex scripts): no body field at all — the
        // body is a regex pattern and must stay exactly as written.
        const bodyFieldHtml = block.titleOnly ? '' : `
            <div class="pt-edit-label">본문 (번역)</div>
            <textarea class="pt-edit-body text_pole" rows="6" placeholder="번역된 본문">${esc(curBody)}</textarea>`;
        form.innerHTML = `
            <div class="pt-edit-label">제목 (번역, 비워두면 원래 이름 사용)</div>
            <input type="text" class="pt-edit-title text_pole" value="${esc(curTitle)}" placeholder="번역된 제목">
            ${bodyFieldHtml}
            <div class="pt-edit-actions">
                <button type="button" class="pt-btn pt-btn-primary pt-edit-save">저장</button>
                <button type="button" class="pt-btn pt-btn-secondary pt-edit-cancel">취소</button>
            </div>`;
        trTextEl.insertAdjacentElement('afterend', form);
        trTextEl.style.display = 'none';
        form.addEventListener('click', ev => ev.stopPropagation());

        form.querySelector('.pt-edit-cancel').addEventListener('click', () => closeEditForm());
        form.querySelector('.pt-edit-save').addEventListener('click', () => {
            const newTitle = form.querySelector('.pt-edit-title').value.trim();
            const newBody  = form.querySelector('.pt-edit-body')?.value.trim() || '';

            if (block.titleOnly) {
                // Only the title cache is ever written for these, so a full
                // translation can never sneak a body in behind them.
                if (!newTitle) {
                    clearNS(ns, [id]);
                    trTextEl.innerHTML = '<span class="pt-no-trans">번역 전</span>';
                } else {
                    setCacheTitle(ns, id, newTitle);
                    trTextEl.innerHTML = esc(newTitle);
                }
            } else if (!newTitle && !newBody) {
                // Both cleared → wipe this item's translation entirely.
                clearNS(ns, [id]);
                trTextEl.innerHTML = '<span class="pt-no-trans">번역 전</span>';
            } else {
                const combined = newTitle ? `### ${newTitle}\n\n${newBody}` : newBody;
                setCache(ns, id, combined);
                clearCachedTitle(ns, id); // full translation now wins over any stale title-only entry
                trTextEl.innerHTML = esc(combined);
            }
            closeEditForm();

            // Keep the search index in sync (same fields setBlockHTML() indexes).
            const namePart = el.dataset.origName || el.querySelector('.pt-block-name')?.textContent || '';
            const origPart = el.querySelector('.pt-original-text')?.textContent || '';
            const transPart = trTextEl.textContent || '';
            el.dataset.searchText = (namePart+' '+origPart+' '+transPart).toLowerCase();

            try { updateCacheStatsUI(); } catch(e) {}
            if (typeof onEdited === 'function') onEdited(id);
            if (typeof toastr !== 'undefined') toastr.success('번역이 저장되었습니다');
        });
    });
    if (selectable) {
        el.querySelector('.pt-checkbox')?.addEventListener('change', ev => {
            el.classList.toggle('selected', ev.target.checked);
            const page = el.closest('.pt-page');
            if (page) updateSelectedCount(page);
        });
    }
    return el;
}

// Selected chip shows count + token sum
function updateSelectedCount(page) {
    const selectedItems = [...page.querySelectorAll('.pt-block-item.selected')];
    const count = selectedItems.length;
    const el = page.querySelector('.pt-selected-chip');
    if (!el) return;
    if (count > 0) {
        // 토큰 합계 계산
        const totalTkn = selectedItems.reduce((s, item) => {
            const tkEl = item.querySelector('.pt-token-count');
            return s + (parseInt(tkEl?.textContent || '0') || 0);
        }, 0);
        el.textContent = `선택: ${count}개  ${totalTkn.toLocaleString()} tkn`;
        el.style.display = '';
    } else {
        el.style.display = 'none';
    }
}

function setBlockHTML(list, id, htmlContent) {
    const item = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!item) return;
    const ta = item.querySelector('.pt-translated-text');
    if (ta) ta.innerHTML = htmlContent;
    if (typeof htmlContent === 'string') {
        // Always use the original name for search indexing.
        // When the  toggle is ON, the displayed name may be the translated title,
        // but data-orig-name still holds the original — fall back to current text if absent.
        const namePart = item.dataset.origName || item.querySelector('.pt-block-name')?.textContent || '';
        const origPart = item.querySelector('.pt-original-text')?.textContent||'';
        const transPart = ta?.textContent||'';
        item.dataset.searchText = (namePart+' '+origPart+' '+transPart).toLowerCase();
    }
}

// ── Translation runner ─────────────────────────────────────────────────
// mode: 'body' → the translation replaces 본문; 'note' → it is stored as the
// {{// ... }} 주석 instead. A run only ever produces one of the two; whichever
// half already exists is carried over untouched, so running both modes in turn
// merges into the canonical "본문\n{{// 주석}}" shape.
async function runTranslation({ items, list, ns, pBar, pLabel, pWrap, btnStop, forceRetranslate, mode }) {
    if (isBusy) return;
    const runMode = mode === 'note' ? 'note' : 'body';

    const selected=[...list.querySelectorAll('.pt-block-item.selected')].map(el=>el.dataset.id);
    const scoped=selected.length?items.filter(b=>selected.includes(b.id)):items;
    // titleOnly items (preset regex scripts) carry a regex pattern as their
    // body — translating it would break the script, so they are never part of
    // a full-body run. Their names are handled by  제목 instead.
    const targets=scoped.filter(b=>!b.titleOnly);
    const skipped=scoped.length-targets.length;
    if (!targets.length) {
        if (typeof toastr!=='undefined') {
            toastr.info(skipped
                ? '정규식 · 그룹 · JS러너 항목은  제목 버튼으로만 번역됩니다'
                : '번역할 항목이 없습니다');
        }
        return;
    }

    isBusy=true; stopReq=false;
    const dot=PDOC.getElementById('pt-status-dot'), stTxt=PDOC.getElementById('pt-status-text');
    dot?.classList.add('busy');
    const modeLabel = runMode === 'note' ? '주석' : '번역';
    if (stTxt) stTxt.textContent = forceRetranslate?`${modeLabel} 재번역 중...`:`${modeLabel} 중...`;
    pWrap.classList.add('visible');
    if (btnStop) btnStop.disabled=false;

    const total=targets.length; let done=0;

    // 항목 하나를 처리한다. 내용은 예전 순차 루프와 한 줄도 다르지 않고, 여러
    // 개를 동시에 돌릴 수 있도록 함수로 떼어냈을 뿐이다 (항목끼리 공유 상태 없음).
    const runOne = async (b) => {
        if (stopReq) return;
        // Read the existing entry first: the half this run is NOT producing has
        // to survive, and forceRetranslate must only redo the half it targets.
        const prevFull  = getCached(ns, b.id);
        const prevSplit = prevFull ? splitTitleAndBody(prevFull) : { title:null, body:'' };
        const prevParts = splitBodyAndNote(prevSplit.body);
        // 제목 번역이 이미 존재하면 본문만 번역한다. 없을 때에만 제목을 함께
        // 번역하며, 그 경우에도 제목은 패널의 제목 언어 설정을 따른다.
        const existingTitle = getTranslatedTitle(ns, b.id);
        const includeTitle  = !existingTitle;
        const sentTitle     = includeTitle && !!(b.name && b.name.trim());
        // 주석만 번역한 항목은 본문 자리에 원문을 그대로 둔다. 그 원문은 "번역된
        // 본문"이 아니므로, 나중에 완전 번역을 돌릴 때 이미 번역된 것으로 오인해
        // 건너뛰면 안 된다 — 원문과 글자 그대로 같은지로 구분한다.
        const origBody      = (b.content || '').trim();
        const bodyIsOrig    = !!prevParts.body && prevParts.body === origBody;
        const haveBody      = !!prevParts.body && !bodyIsOrig;
        // 캐시에 주석이 없더라도, 파일에 이미 적용돼 있던 주석(로드 때 원문에서
        // 떼어낸 것)을 존재하는 주석으로 인정하고 그대로 보존한다.
        const prevNote      = prevParts.note || (b.injectedNote || '');
        const havePart = runMode === 'note' ? !!prevNote : haveBody;

        if (!forceRetranslate && havePart) {
            setBlockHTML(list,b.id,esc(prevFull));
        } else {
            setBlockHTML(list,b.id,`<span class="pt-translating">⟳ ${modeLabel} 중...</span>`);
            try {
                const nonce=forceRetranslate?Math.random().toString(36).slice(2,10):null;
                const res=await translateText(b.name,b.content,nonce,{ mode:runMode, includeTitle });
                if (res) {
                    let newTitle = existingTitle || '';
                    let part = res;
                    if (sentTitle) {
                        const sp = splitTitleAndBody(res);
                        if (sp.title) { newTitle = sp.title; part = sp.body; }
                    }
                    part = (part || '').trim();
                    const bodyPart = runMode === 'note'
                        // 완전 번역이 아직 없으면 원문을 본문 자리에 남겨 둔다:
                        //   원문
                        //   {{// 주석}}
                        ? joinBodyAndNote(haveBody ? prevParts.body : origBody,
                                          sanitizeNoteMacros(stripNoteWrapper(part)))
                        : joinBodyAndNote(part, prevNote);
                    const combined = newTitle ? `### ${newTitle}\n\n${bodyPart}` : bodyPart;
                    setBlockHTML(list,b.id,esc(combined));
                    setCache(ns,b.id,combined);
                    // A freshly translated title becomes the authoritative one;
                    // an existing 제목 번역 is left exactly as it was.
                    if (sentTitle && newTitle) setCacheTitle(ns,b.id,newTitle);
                } else {
                    // Both name and content were empty — nothing to translate
                    setBlockHTML(list,b.id,'<span class="pt-no-trans">번역 전</span>');
                }
            } catch(err) {
                if (err?.__stopped) {
                    // 사용자가 멈춘 것은 실패가 아니다 — 원래 보이던 것을 되돌린다.
                    setBlockHTML(list,b.id,prevFull?esc(prevFull):'<span class="pt-no-trans">번역 전</span>');
                } else {
                    setBlockHTML(list,b.id,`<span style="color:#ef4444;font-size:11px;"> ${esc(err.message)}</span>`);
                }
            }
        }
    };

    // 동시 실행 풀. 기본값 1이면 예전과 똑같이 한 번에 하나씩, 같은 순서로 돈다.
    // 항목의 결과는 id로 캐시에 들어가므로 완료 순서는 결과에 영향을 주지 않는다.
    let qi = 0;
    const worker = async () => {
        while (!stopReq) {
            const idx = qi++;
            if (idx >= targets.length) return;
            // runOne은 번역 실패를 스스로 처리한다. 그 밖의 예외로 한 레인이
            // 죽어도 나머지 레인과 마무리 처리(isBusy 해제 등)는 그대로 돌게 둔다.
            try { await runOne(targets[idx]); }
            catch (e) { console.error(`[${EXT}] 항목 처리 실패`, e); }
            done++;
            const pct=Math.round(done/total*100);
            pBar.style.width=pct+'%';
            pLabel.textContent=`${done} / ${total}  (${pct}%)`;
            // 남은 항목이 있을 때만 쉰다 — 예전에는 마지막 항목 뒤에도 한 번 더 쉬었다.
            if (!stopReq && qi < targets.length) await sleepCancellable(requestDelayMs());
        }
    };
    const lanes = Math.max(1, Math.min(concurrency(), targets.length));
    await Promise.all(Array.from({ length: lanes }, () => worker()));
    // (translations persist to user/files automatically via setCache/cacheDelete)
    try { updateCacheStatsUI(); } catch(e) {}
    isBusy=false;
    dot?.classList.remove('busy');
    if (stTxt) stTxt.textContent=stopReq?'중단됨':(forceRetranslate?`${modeLabel} 재번역 완료 `:`${modeLabel} 완료 `);
    pWrap.classList.remove('visible');
    if (btnStop) btnStop.disabled=true;
    setTimeout(()=>{const t=PDOC.getElementById('pt-status-text');if(t)t.textContent='대기 중';},3000);
    if (skipped && typeof toastr!=='undefined') {
        toastr.info(`제목 전용 항목 ${skipped}개는 본문 번역에서 제외됨 ( 제목으로 이름만 번역 가능)`);
    }
}

// ── Export Module (Plus) ────────────────────────────────────

// Sanitize filename: remove forbidden chars but keep unicode (Korean/Chinese OK)
function sanitizeFilename(name) {
    return String(name || 'untitled')
        .replace(/[\/\\:*?"<>|]+/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 80);
}

// Trigger browser download of a Blob
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// Show a 3-choice modal inside our panel (Original / Translated / Both)
// Returns a Promise resolving to 'original' | 'translated' | 'both' | null
// Generic N-choice modal. opts = [{ v:'value', label:'표시 텍스트' }, ...]
// Resolves to the chosen value, or null if cancelled / dismissed.
function askChoice(title, opts) {
    return new Promise(resolve => {
        const existing = PDOC.getElementById('pt-choice-modal');
        if (existing) existing.remove();

        const backdrop = PDOC.createElement('div');
        backdrop.id = 'pt-choice-modal';
        backdrop.className = 'pt-choice-backdrop';
        backdrop.innerHTML = `
          <div class="pt-choice-box" role="dialog" aria-modal="true">
            <div class="pt-choice-title">${esc(title)}</div>
            <div class="pt-choice-btns">
              ${opts.map(o => `<button type="button" data-v="${esc(o.v)}">${esc(o.label)}</button>`).join('')}
            </div>
            <div class="pt-choice-cancel"><button type="button" data-v="__cancel__">취소</button></div>
          </div>`;
        const panel = PDOC.getElementById('pt-panel');
        (panel || PDOC.body).appendChild(backdrop);

        const close = (val) => { backdrop.remove(); resolve(val); };
        backdrop.addEventListener('click', e => {
            if (e.target === backdrop) return close(null);
            const btn = e.target.closest('button[data-v]');
            if (!btn) return;
            const v = btn.dataset.v;
            close(v === '__cancel__' ? null : v);
        });
    });
}

function askTextChoice(title) {
    return new Promise(resolve => {
        const existing = PDOC.getElementById('pt-choice-modal');
        if (existing) existing.remove();

        const backdrop = PDOC.createElement('div');
        backdrop.id = 'pt-choice-modal';
        backdrop.className = 'pt-choice-backdrop';
        backdrop.innerHTML = `
          <div class="pt-choice-box" role="dialog" aria-modal="true">
            <div class="pt-choice-title">${esc(title)}</div>
            <div class="pt-choice-btns">
              <button type="button" data-v="original">원문만</button>
              <button type="button" data-v="translated">번역문만</button>
              <button type="button" data-v="both">둘 다</button>
            </div>
            <div class="pt-choice-cancel"><button type="button" data-v="cancel">취소</button></div>
          </div>`;
        // mount to panel if exists, else body
        const panel = PDOC.getElementById('pt-panel');
        (panel || PDOC.body).appendChild(backdrop);

        const close = (val) => { backdrop.remove(); resolve(val); };
        backdrop.addEventListener('click', e => {
            if (e.target === backdrop) close(null); // click outside = cancel
            const btn = e.target.closest('button[data-v]');
            if (!btn) return;
            const v = btn.dataset.v;
            close(v === 'cancel' ? null : v);
        });
    });
}

// Format text for export/copy according to choice.
// A translated title can exist even when the body was never fully
// translated (the "제목만" action caches only a title) — getTranslatedTitle()
// covers both that case and a title embedded in a full translation, so pull
// it in separately instead of only reading the full-translation cache.
function formatItemsAsText(items, choice) {
    const out = [];
    for (const it of items) {
        const original     = (it.content || '').trim();
        const name          = it.name || it.id || '';
        const full          = getCached(it._ns, it.id);
        const bodyTranslated = full ? splitTitleAndBody(full).body.trim() : '';
        const titleRaw      = getTranslatedTitle(it._ns, it.id);
        const hasTitle      = !!(titleRaw && titleRaw.trim() && titleRaw.trim() !== name.trim());
        const titleTranslated = hasTitle ? titleRaw.trim() : '';

        if (choice === 'original') {
            out.push(`━━━ ${name} ━━━\n${original}`);
        } else if (choice === 'translated') {
            const header = titleTranslated ? `${titleTranslated} (${name})` : name;
            const body   = bodyTranslated || (titleTranslated ? '(본문 번역 없음 — 제목만 번역됨)' : '(번역없음)');
            out.push(`━━━ ${header} ━━━\n${body}`);
        } else { // both
            const header = titleTranslated ? `${titleTranslated} (${name})` : name;
            const body   = bodyTranslated || (titleTranslated ? '(본문 번역 없음 — 제목만 번역됨)' : '(번역없음)');
            out.push(`━━━ ${header} ━━━\n[원문]\n${original}\n\n[번역]\n${body}`);
        }
    }
    return out.join('\n\n');
}

// Copy text to clipboard with fallback
async function copyTextToClipboard(text) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch(e) {}
    // fallback
    try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    } catch(e) { return false; }
}

// Deep clone via structured JSON (ST data is JSON-safe)
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Get translation for a given namespace + id (returns null if not translated)
function getTranslated(ns, id) {
    return getCached(ns, id);
}

// Split a translated content into { title, body }.
// During translation we prepend "### {title}\n\n" so the model also translates
// the toggle/entry name. The model output may include markdown separators (---)
// before/around the heading, so we scan the first few non-empty lines for the
// first markdown heading and treat everything before it as discardable preamble.
function splitTitleAndBody(translated) {
    if (typeof translated !== 'string' || !translated) return { title: null, body: translated || '' };

    const lines = translated.split(/\r?\n/);
    let scanned = 0;
    for (let i = 0; i < lines.length && scanned < 5; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed === '') continue; // skip leading blank lines
        scanned++;
        // Skip horizontal-rule separators (--- *** ___) that the model sometimes emits
        if (/^([-*_]){3,}$/.test(trimmed)) continue;
        // Match a markdown heading line
        const m = trimmed.match(/^#{1,6}\s+(.+?)\s*$/);
        if (m) {
            const title = m[1].trim();
            // Body = everything after this heading line, with leading blank lines stripped
            let body = lines.slice(i + 1).join('\n');
            body = body.replace(/^(\s*\r?\n)+/, '');
            return { title, body };
        }
        // Hit a non-heading content line — no title prefix detected
        break;
    }
    return { title: null, body: translated };
}

// Helper used by JSON exporters: returns the translated body (without the prepended title line).
// If no translation exists, returns null.
function getTranslatedBody(ns, id) {
    const t = getTranslated(ns, id);
    if (!t) return null;
    return splitTitleAndBody(t).body;
}

// Helper: returns only the translated title (or null if not found in the translation)
function getTranslatedTitle(ns, id) {
    // Precedence: the title-only cache wins when present.
    // It is only ever written by an explicit "제목만" action (which skips
    // items that already have a title, unless the user confirms a redo),
    // so its presence always reflects a deliberate user choice — including
    // a redo meant to override a bad title from a full translation.
    const only = getCachedTitle(ns, id);
    if (only && only.trim()) return only.trim();

    // Otherwise use the title embedded in a full translation.
    const t = getTranslated(ns, id);
    if (t) {
        const title = splitTitleAndBody(t).title;
        if (title) return title;
    }
    return null;
}

// ── JSON Export: Preset ───────────────────────────────────────────────
// Returns ST-compatible preset JSON with translated toggle contents.
// Strips API connection/endpoint settings (they shouldn't be shared with translations).
// ── JS-Slash-Runner script export (preset / world info titles) ────────
// Builds a JS Runner script that puts a floating button on screen. Clicking it
// shows the titles before/after, and on confirm writes the translated names
// into the preset / world info itself. After a successful apply the script
// removes everything it added and switches itself off in JS Runner, so nothing
// keeps running. Turning it back on gives access to "원래대로" (restore).
//
// Matching: 1) id (prompt identifier / WI entry uid)  2) exact name. We
// deliberately do NOT fall back to substring matching: with entries like
// "NSFW" and "NSFW 기초" present, fuzzy matching assigns the wrong title.
//
// The generated script is assembled from plain template literals below.
// Rule for all of them: no backticks, no backslashes, no dollar-brace
// sequences inside the generated code — only buildTitleScriptContent()
// interpolates, and only in the header/constants.

// Preset adapter. Deliberately does NOT use JS Runner's updatePresetWith():
// that round-trips the whole preset through its own format and rewrites
// prompt_order down to a single character entry. Instead it edits only `name`
// on ST's own objects and saves through ST's PresetManager, the same path the
// extension's instant apply uses.
const TITLE_SCRIPT_PRESET_ADAPTER = `
const UI = {
  title: "프롬프트 제목 번역",
  fabTitle: "프롬프트 제목 번역 적용",
  fabIcon: "fa-language",
  targetLabel: "현재 프리셋",
  empty: "이 프리셋에서 일치하는 프롬프트가 없습니다",
  sourceWarn: "이 스크립트는 '" + SOURCE_NAME + "' 프리셋용입니다. 이름이 다른 항목은 기본으로 선택하지 않았으니 확인 후 적용하세요.",
};

function presetManager(ctx) {
  const pm = ctx.getPresetManager ? ctx.getPresetManager("openai") : null;
  if (!pm || !ctx.chatCompletionSettings) throw new Error("SillyTavern 프리셋 정보를 찾을 수 없습니다");
  return pm;
}

function listTargets() {
  const name = presetManager(stContext()).getSelectedPresetName() || "";
  return { names: name ? [name] : [], current: name, fixed: true };
}

async function loadItems() {
  const live = stContext().chatCompletionSettings;
  return (Array.isArray(live.prompts) ? live.prompts : [])
    .filter((p) => p && p.identifier)
    .map((p) => ({ key: String(p.identifier), raw: String(p.name || "") }));
}

function idMatchAllowed() { return true; }

function renameIn(prompts, picks) {
  if (!Array.isArray(prompts)) return;
  for (const p of prompts) {
    const pick = p ? picks.get(String(p.identifier)) : null;
    if (pick) p.name = pick.to;
  }
}

// Update the already-rendered prompt list in place, so the new names show
// without forcing a prompt manager re-render. ST's own next render reads the
// same (already renamed) data, so the two can never disagree.
function patchDom(picks) {
  pdoc.querySelectorAll("li[data-pm-identifier]").forEach((li) => {
    const pick = picks.get(li.getAttribute("data-pm-identifier"));
    if (!pick) return;
    const box = li.querySelector("[data-pm-name]");
    if (!box) return;
    box.setAttribute("data-pm-name", pick.to);
    Array.from(box.children).forEach((el) => {
      const isName = el.classList.contains("prompt-manager-inspect-action")
        || (el.tagName === "SPAN" && (el.getAttribute("title") || "") === pick.raw);
      if (!isName) return;
      el.setAttribute("title", pick.to);
      el.textContent = pick.to;
    });
  });
  const select = pdoc.getElementById("completion_prompt_manager_footer_append_prompt");
  if (select) {
    Array.from(select.options).forEach((opt) => {
      const pick = picks.get(opt.value);
      if (pick) opt.textContent = pick.to;
    });
  }
}

async function saveNames(target, picks) {
  const ctx = stContext();
  const pm = presetManager(ctx);
  if (pm.getSelectedPresetName() !== target) throw new Error("그 사이 프리셋이 바뀌었습니다. 다시 열어주세요.");
  let stored = null;
  try { stored = pm.getCompletionPresetByName(target); } catch (e) {}
  let saved = false;
  // The saved preset file: rename a copy, save it, and only then mirror the
  // rename onto ST's in-memory copy of the list. skipUpdate keeps ST from
  // reloading the preset, which would throw away unsaved edits.
  if (stored && Array.isArray(stored.prompts) && typeof pm.savePreset === "function") {
    const body = structuredClone(stored);
    renameIn(body.prompts, picks);
    await pm.savePreset(target, body, { skipUpdate: true });
    renameIn(stored.prompts, picks);
    saved = true;
  }
  // The preset currently in use (what the prompt list shows).
  renameIn(ctx.chatCompletionSettings.prompts, picks);
  if (typeof ctx.saveSettingsDebounced === "function") ctx.saveSettingsDebounced();
  patchDom(picks);
  return saved
    ? { saved: true }
    : { saved: false, note: "프리셋 파일은 저장하지 못했습니다. 프리셋 저장 버튼을 눌러주세요." };
}
`;

// World Info adapter. Same save path as the extension's instant apply:
// ST's loadWorldInfo()/saveWorldInfo(), plus the character-book
// `originalData` mirror, which ST otherwise writes back over our change.
// Entry uids are only meaningful inside one book, so id matching is used
// only when the target is the book this script was made from.
const TITLE_SCRIPT_WI_ADAPTER = `
const UI = {
  title: "월드인포 제목 번역",
  fabTitle: "월드인포 제목 번역 적용",
  fabIcon: "fa-book-atlas",
  targetLabel: "대상 월드인포",
  empty: "이 월드인포에서 일치하는 항목이 없습니다",
  sourceWarn: "이 스크립트는 '" + SOURCE_NAME + "' 월드인포용입니다. 다른 월드인포에서는 제목이 정확히 같은 항목만 찾습니다.",
};

function listTargets() {
  const ctx = stContext();
  const names = typeof ctx.getWorldInfoNames === "function" ? ctx.getWorldInfoNames() : [];
  return { names: names, current: names.indexOf(SOURCE_NAME) >= 0 ? SOURCE_NAME : (names[0] || ""), fixed: false };
}

async function loadBook(target) {
  const ctx = stContext();
  if (typeof ctx.loadWorldInfo !== "function" || typeof ctx.saveWorldInfo !== "function") {
    throw new Error("월드인포 저장 함수를 찾을 수 없습니다");
  }
  const book = await ctx.loadWorldInfo(target);
  if (!book || !book.entries) throw new Error("월드인포 '" + target + "'를 불러오지 못했습니다");
  return book;
}

async function loadItems(target) {
  const book = await loadBook(target);
  return Object.keys(book.entries)
    .filter((k) => book.entries[k])
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => ({ key: String(k), raw: String(book.entries[k].comment || "") }));
}

function idMatchAllowed(target) { return target === SOURCE_NAME; }

async function saveNames(target, picks) {
  const ctx = stContext();
  const book = await loadBook(target);
  for (const k of Object.keys(book.entries)) {
    const entry = book.entries[k];
    const pick = entry ? picks.get(String(k)) : null;
    if (!pick) continue;
    entry.comment = pick.to;
    if (book.originalData && Array.isArray(book.originalData.entries)) {
      const mirror = book.originalData.entries.find((x) => x.uid === entry.uid);
      if (mirror) mirror.comment = pick.to;
    }
  }
  // true = save now instead of leaving it in ST's debounce queue.
  await ctx.saveWorldInfo(target, book, true);
  try { if (typeof ctx.reloadWorldInfoEditor === "function") ctx.reloadWorldInfoEditor(target); } catch (e) {}
  return { saved: true };
}
`;

// Shared runtime: matching, preview modal, floating button, self-disable.
// Uses the adapter's UI / listTargets / loadItems / idMatchAllowed / saveNames.
const TITLE_SCRIPT_RUNTIME = `
const pwin = parent;
const pdoc = parent.document;
// Per-kind ids, so a preset script and a world info script can run side by side.
const ROOT_ID = "ppt-ta-root-" + KIND;
const STYLE_ID = "ppt-ta-style-" + KIND;
const POS_KEY = "ppt-title-apply-pos-" + KIND;

const byId = new Map();
const byName = new Map();
const byTitle = new Map();
for (const e of ENTRIES) {
  byId.set(String(e.id), e);
  if (!byName.has(e.name)) byName.set(e.name, e);
  if (!byTitle.has(e.title)) byTitle.set(e.title, e);
}

function toast(type, msg) {
  const t = pwin.toastr;
  if (t && typeof t[type] === "function") t[type](msg);
  else console.log("[ppt-title-apply] " + msg);
}

function stContext() {
  const st = pwin.SillyTavern;
  const ctx = st && typeof st.getContext === "function" ? st.getContext() : null;
  if (!ctx) throw new Error("SillyTavern 정보를 찾을 수 없습니다");
  return ctx;
}

// ── Matching ─────────────────────────────────────────────────────────
// mode "apply": original -> translated. mode "restore": translated -> original.
// status: "ready" (will change), "done" (already the target name),
//         "changed" (id matched but the current name is neither — renamed by hand)
function buildRows(items, mode, useId) {
  const rows = [];
  for (const it of items) {
    const cur = it.raw.trim();
    let e = useId ? byId.get(it.key) : null;
    let via = "id";
    if (!e) {
      via = "name";
      e = mode === "apply"
        ? (byName.get(cur) || byTitle.get(cur))
        : (byTitle.get(cur) || byName.get(cur));
    }
    if (!e) continue;
    const from = mode === "apply" ? e.name : e.title;
    const to = mode === "apply" ? e.title : e.name;
    const status = cur === to ? "done" : cur === from ? "ready" : "changed";
    rows.push({ id: it.key, raw: it.raw, to: to, via: via, status: status });
  }
  const rank = { ready: 0, changed: 1, done: 2 };
  rows.sort((a, b) => rank[a.status] - rank[b.status]);
  return rows;
}

// ── UI ───────────────────────────────────────────────────────────────
function h(tag, attrs, children) {
  const el = pdoc.createElement(tag);
  if (attrs) {
    for (const k of Object.keys(attrs)) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "text") el.textContent = v;
      else if (k === "onclick") el.addEventListener("click", v);
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  (children || []).forEach((c) => { if (c) el.appendChild(c); });
  return el;
}

function injectStyle() {
  if (pdoc.getElementById(STYLE_ID)) return;
  const css = [
    ".ppt-ta-root { --ppt-bg: var(--SmartThemeBlurTintColor, rgba(28,28,32,0.96)); --ppt-fg: var(--SmartThemeBodyColor, #ddd); --ppt-border: var(--SmartThemeBorderColor, rgba(255,255,255,0.18)); --ppt-accent: var(--SmartThemeQuoteColor, #e69a4a); --ppt-dim: color-mix(in srgb, var(--ppt-fg) 55%, transparent); }",
    ".ppt-ta-fab { position: fixed; z-index: 30000; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--ppt-border); background: var(--ppt-bg); color: var(--ppt-fg); backdrop-filter: blur(8px); box-shadow: 0 2px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer; touch-action: none; user-select: none; }",
    ".ppt-ta-fab:hover { color: var(--ppt-accent); }",
    // Sized in viewport units, not inset: 0. ST puts a transform on <html>,
    // which makes <html> the box fixed elements are placed in, and on mobile
    // <body> is position: fixed, so <html> is 0px tall there — inset: 0 then
    // collapses the overlay and the centred modal ends up at the top.
    ".ppt-ta-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; height: 100dvh; box-sizing: border-box; z-index: 30001; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 16px; }",
    ".ppt-ta-modal { width: min(560px, 100%); max-height: calc(100dvh - 32px); display: flex; flex-direction: column; background: var(--ppt-bg); color: var(--ppt-fg); border: 1px solid var(--ppt-border); border-radius: 12px; backdrop-filter: blur(12px); box-shadow: 0 8px 32px rgba(0,0,0,0.45); overflow: hidden; }",
    ".ppt-ta-head { padding: 14px 16px 10px; border-bottom: 1px solid var(--ppt-border); display: flex; flex-direction: column; gap: 8px; }",
    ".ppt-ta-title { font-weight: 600; font-size: 1.05em; }",
    ".ppt-ta-sub { font-size: 0.85em; color: var(--ppt-dim); overflow-wrap: anywhere; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }",
    ".ppt-ta-select { flex: 1 1 160px; min-width: 0; padding: 4px 6px; border-radius: 6px; border: 1px solid var(--ppt-border); background: var(--ppt-bg); color: var(--ppt-fg); font: inherit; }",
    ".ppt-ta-warn { font-size: 0.85em; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--ppt-accent); color: var(--ppt-accent); }",
    ".ppt-ta-tabs { display: flex; gap: 6px; }",
    ".ppt-ta-tab { flex: 1; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--ppt-border); background: transparent; color: var(--ppt-fg); cursor: pointer; font: inherit; }",
    ".ppt-ta-tab.on { border-color: var(--ppt-accent); color: var(--ppt-accent); }",
    ".ppt-ta-list { overflow-y: auto; padding: 6px 8px; flex: 1 1 auto; min-height: 60px; }",
    ".ppt-ta-row { display: grid; grid-template-columns: 22px 1fr; gap: 8px; align-items: start; padding: 8px; border-radius: 8px; cursor: pointer; }",
    ".ppt-ta-row:hover { background: color-mix(in srgb, var(--ppt-fg) 7%, transparent); }",
    ".ppt-ta-row.is-done { cursor: default; opacity: 0.5; }",
    ".ppt-ta-row input { margin: 3px 0 0; cursor: inherit; }",
    ".ppt-ta-from { color: var(--ppt-dim); font-size: 0.9em; overflow-wrap: anywhere; }",
    ".ppt-ta-to { overflow-wrap: anywhere; }",
    ".ppt-ta-badge { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 6px; font-size: 0.75em; border: 1px solid var(--ppt-border); color: var(--ppt-dim); vertical-align: 1px; }",
    ".ppt-ta-badge.warn { border-color: var(--ppt-accent); color: var(--ppt-accent); }",
    ".ppt-ta-empty { padding: 24px 8px; text-align: center; color: var(--ppt-dim); }",
    ".ppt-ta-foot { padding: 10px 16px 14px; border-top: 1px solid var(--ppt-border); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }",
    ".ppt-ta-foot .ppt-ta-grow { flex: 1 1 auto; min-width: 7em; white-space: nowrap; font-size: 0.85em; color: var(--ppt-dim); }",
    ".ppt-ta-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--ppt-border); background: transparent; color: var(--ppt-fg); cursor: pointer; font: inherit; }",
    ".ppt-ta-btn.primary { border-color: var(--ppt-accent); background: var(--ppt-accent); color: #fff; font-weight: 600; }",
    ".ppt-ta-btn:disabled { opacity: 0.45; cursor: default; }",
  ].join(" ");
  pdoc.head.appendChild(h("style", { id: STYLE_ID, text: css }));
}

let overlay = null;

function closeModal() {
  if (overlay) overlay.remove();
  overlay = null;
  pdoc.removeEventListener("keydown", onKey, true);
}

function onKey(ev) {
  if (ev.key === "Escape") { ev.stopPropagation(); closeModal(); }
}

function openModal() {
  let targets;
  try { targets = listTargets(); } catch (err) { toast("error", err.message || String(err)); return; }

  let target = targets.current;
  let mode = "apply";
  let rows = [];
  let picked = new Set();
  let busy = false;
  let loading = false;
  let loadSeq = 0;

  const root = pdoc.getElementById(ROOT_ID);
  const list = h("div", { class: "ppt-ta-list" });
  const warn = h("div", { class: "ppt-ta-warn" });
  const info = h("span", { class: "ppt-ta-grow" });
  const toggleAllBtn = h("button", { class: "ppt-ta-btn", type: "button" });
  const okBtn = h("button", { class: "ppt-ta-btn primary", type: "button" });
  const tabApply = h("button", { class: "ppt-ta-tab", type: "button", text: "번역 적용" });
  const tabRestore = h("button", { class: "ppt-ta-tab", type: "button", text: "원래대로" });

  let targetEl;
  if (targets.fixed) {
    targetEl = h("span", { text: target || "(알 수 없음)" });
  } else {
    targetEl = h("select", { class: "ppt-ta-select" }, targets.names.map((n) => h("option", { value: n, text: n })));
    targetEl.value = target;
    targetEl.addEventListener("change", () => { target = targetEl.value; load(); });
  }

  function selectable() { return rows.filter((r) => r.status !== "done"); }

  async function load() {
    const seq = ++loadSeq;
    loading = true;
    warn.style.display = target && target !== SOURCE_NAME ? "" : "none";
    warn.textContent = UI.sourceWarn;
    list.replaceChildren(h("div", { class: "ppt-ta-empty", text: "불러오는 중…" }));
    renderFoot();
    try {
      const items = target ? await loadItems(target) : [];
      if (seq !== loadSeq) return;
      rows = buildRows(items, mode, idMatchAllowed(target));
    } catch (err) {
      if (seq !== loadSeq) return;
      rows = [];
      toast("error", err && err.message ? err.message : String(err));
    }
    picked = new Set(rows.filter((r) => r.status === "ready").map((r) => r.id));
    loading = false;
    render();
  }

  function render() {
    tabApply.classList.toggle("on", mode === "apply");
    tabRestore.classList.toggle("on", mode === "restore");
    list.replaceChildren();

    if (!rows.length) list.appendChild(h("div", { class: "ppt-ta-empty", text: UI.empty }));
    for (const r of rows) {
      const done = r.status === "done";
      const cb = h("input", { type: "checkbox", disabled: done });
      cb.checked = picked.has(r.id);
      const badges = [];
      if (done) badges.push(h("span", { class: "ppt-ta-badge", text: mode === "apply" ? "이미 적용됨" : "이미 원래 이름" }));
      if (r.status === "changed") badges.push(h("span", { class: "ppt-ta-badge warn", text: "이름이 다름" }));
      if (r.via === "name") badges.push(h("span", { class: "ppt-ta-badge", text: "이름 일치" }));
      const text = h("div", null, [
        h("div", { class: "ppt-ta-from", text: r.raw || "(이름 없음)" }),
        h("div", { class: "ppt-ta-to" }, [pdoc.createTextNode("→ " + r.to)].concat(badges)),
      ]);
      const row = h("div", { class: "ppt-ta-row" + (done ? " is-done" : "") }, [cb, text]);
      if (!done) {
        row.addEventListener("click", (ev) => {
          if (busy) { cb.checked = picked.has(r.id); return; }
          if (ev.target !== cb) cb.checked = !cb.checked;
          if (cb.checked) picked.add(r.id); else picked.delete(r.id);
          renderFoot();
        });
      }
      list.appendChild(row);
    }
    renderFoot();
  }

  function renderFoot() {
    const sel = selectable();
    const doneCount = rows.length - sel.length;
    info.textContent = loading ? "" : "선택 " + picked.size + " / " + sel.length + (doneCount ? " · 완료 " + doneCount : "");
    const allOn = sel.length > 0 && sel.every((r) => picked.has(r.id));
    toggleAllBtn.textContent = allOn ? "전체 해제" : "전체 선택";
    toggleAllBtn.disabled = busy || loading || !sel.length;
    okBtn.textContent = busy ? "저장 중…" : (mode === "apply" ? "적용" : "되돌리기") + (picked.size ? " (" + picked.size + ")" : "");
    okBtn.disabled = busy || loading || !picked.size;
    if (targetEl.tagName === "SELECT") targetEl.disabled = busy;
  }

  tabApply.addEventListener("click", () => { if (!busy && mode !== "apply") { mode = "apply"; load(); } });
  tabRestore.addEventListener("click", () => { if (!busy && mode !== "restore") { mode = "restore"; load(); } });
  toggleAllBtn.addEventListener("click", () => {
    const sel = selectable();
    const allOn = sel.every((r) => picked.has(r.id));
    picked = allOn ? new Set() : new Set(sel.map((r) => r.id));
    render();
  });
  okBtn.addEventListener("click", async () => {
    if (busy || loading || !picked.size) return;
    const picks = new Map();
    for (const r of rows) if (picked.has(r.id)) picks.set(r.id, { to: r.to, raw: r.raw });
    busy = true;
    renderFoot();
    try {
      const res = await saveNames(target, picks);
      const verb = mode === "apply" ? "번역 제목 적용" : "원래 이름으로 복구";
      if (res.saved) toast("success", verb + ": " + picks.size + "개 (" + target + " 저장됨)");
      else toast("warning", verb + ": " + picks.size + "개 — " + res.note);
      closeModal();
      // The names now live in the data itself, so this script has no job
      // left: remove everything it added and switch it off in JS Runner.
      // "원래대로" stays available by turning the script back on.
      if (mode === "apply") {
        teardown();
        if (disableSelf()) toast("info", "제목 적용이 끝나서 JS러너에서 이 스크립트를 껐습니다");
        else toast("info", "JS러너에서 이 스크립트를 직접 꺼주세요 (자동으로 끄지 못했습니다)");
      }
    } catch (err) {
      console.error("[ppt-title-apply]", err);
      toast("error", "적용 실패: " + (err && err.message ? err.message : err));
      busy = false;
      renderFoot();
    }
  });

  const cancelBtn = h("button", { class: "ppt-ta-btn", type: "button", text: "취소", onclick: () => { if (!busy) closeModal(); } });
  const modal = h("div", { class: "ppt-ta-modal", role: "dialog", "aria-modal": "true" }, [
    h("div", { class: "ppt-ta-head" }, [
      h("div", { class: "ppt-ta-title", text: UI.title }),
      h("div", { class: "ppt-ta-sub" }, [h("span", { text: UI.targetLabel + ":" }), targetEl]),
      warn,
      h("div", { class: "ppt-ta-tabs" }, [tabApply, tabRestore]),
    ]),
    list,
    h("div", { class: "ppt-ta-foot" }, [info, toggleAllBtn, cancelBtn, okBtn]),
  ]);

  closeModal();
  overlay = h("div", { class: "ppt-ta-overlay" }, [modal]);
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay && !busy) closeModal(); });
  root.appendChild(overlay);
  pdoc.addEventListener("keydown", onKey, true);
  load();
}

// ── Floating button (draggable, position remembered) ─────────────────
function readPos() {
  try { return JSON.parse(pwin.localStorage.getItem(POS_KEY) || "null"); } catch (e) { return null; }
}
function savePos(pos) {
  try { pwin.localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch (e) {}
}
function clampPos(x, y) {
  const w = pwin.innerWidth, hgt = pwin.innerHeight, size = 44, m = 8;
  return { x: Math.min(Math.max(m, x), w - size - m), y: Math.min(Math.max(m, y), hgt - size - m) };
}

let onResize = null;

function makeFab() {
  const fab = h("button", { class: "ppt-ta-fab", type: "button", title: UI.fabTitle }, [
    h("i", { class: "fa-solid " + UI.fabIcon }),
  ]);
  const saved = readPos();
  // The two kinds start at different heights so they never stack on first run.
  const startY = pwin.innerHeight * (KIND === "wi" ? 0.5 : 0.4);
  let pos = clampPos(saved ? saved.x : pwin.innerWidth - 64, saved ? saved.y : startY);
  const place = () => { fab.style.left = pos.x + "px"; fab.style.top = pos.y + "px"; };
  place();

  let drag = null;
  fab.addEventListener("pointerdown", (ev) => {
    drag = { sx: ev.clientX, sy: ev.clientY, ox: pos.x, oy: pos.y, moved: false };
    fab.setPointerCapture(ev.pointerId);
  });
  fab.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
    drag.moved = true;
    pos = clampPos(drag.ox + dx, drag.oy + dy);
    place();
  });
  // A drag ends in a click event too; swallow that one so moving the button
  // does not also open the preview. Keyboard Enter/Space still opens it.
  let justDragged = false;
  fab.addEventListener("pointerup", () => {
    if (!drag) return;
    justDragged = drag.moved;
    if (drag.moved) savePos(pos);
    drag = null;
  });
  fab.addEventListener("pointercancel", () => { drag = null; });
  fab.addEventListener("click", () => {
    if (justDragged) { justDragged = false; return; }
    openModal();
  });

  onResize = () => { pos = clampPos(pos.x, pos.y); place(); };
  pwin.addEventListener("resize", onResize);
  return fab;
}

function teardown() {
  closeModal();
  if (onResize) pwin.removeEventListener("resize", onResize);
  onResize = null;
  const root = pdoc.getElementById(ROOT_ID);
  if (root) root.remove();
  const style = pdoc.getElementById(STYLE_ID);
  if (style) style.remove();
}

// Turn this script off in JS Runner. JS Runner then drops the script's frame,
// so nothing of it keeps running. Returns false when the JS Runner API is
// missing (older version) or the script can't be found in any list.
function disableSelf() {
  if (typeof getScriptId !== "function" || typeof getScriptTrees !== "function"
    || typeof updateScriptTreesWith !== "function") return false;
  const id = getScriptId();
  const hasSelf = (trees) => trees.some((t) => t.id === id
    || (t.type === "folder" && Array.isArray(t.scripts) && t.scripts.some((sc) => sc.id === id)));
  const switchOff = (trees) => trees.map((t) => {
    if (t.id === id) return Object.assign({}, t, { enabled: false });
    if (t.type === "folder" && Array.isArray(t.scripts)) {
      return Object.assign({}, t, {
        scripts: t.scripts.map((sc) => sc.id === id ? Object.assign({}, sc, { enabled: false }) : sc),
      });
    }
    return t;
  });
  for (const type of ["global", "preset", "character"]) {
    try {
      if (!hasSelf(getScriptTrees({ type: type }))) continue;
      updateScriptTreesWith(switchOff, { type: type });
      return true;
    } catch (e) {
      console.warn("[ppt-title-apply] disable failed (" + type + ")", e);
    }
  }
  return false;
}

function init() {
  teardown();
  injectStyle();
  pdoc.body.appendChild(h("div", { id: ROOT_ID, class: "ppt-ta-root" }, [makeFab()]));
}

// JS Runner removes this script's frame when the script is turned off.
window.addEventListener("pagehide", teardown);
init();
`;

// entries: [{ id, name, title }] — id is the prompt identifier (preset) or
// the entry key/uid inside the book (world info).
function buildTitleScriptContent(label, entries, kind) {
    const isWi = kind === 'wi';
    const what = isWi ? 'world info entry' : 'prompt';
    const header = `/**
 * ${isWi ? 'World Info' : 'Prompt'} Title Apply — ${label.replace(/\*\//g, '* /')}
 * Generated by Prompt Panel.
 *
 * Adds a floating button. Clicking it shows the ${what} titles before/after,
 * and saves the ones you pick into the ${isWi ? 'world info' : 'preset'}.
 *
 * Matching: 1) ${isWi ? 'entry uid (same world info only)' : 'prompt id'}  2) exact title.
 * Only titles change — content, keys, order and on/off state are untouched.
 * The original titles are kept in this script, so "원래대로" restores them.
 * Nothing runs in the background (no DOM watchers, no timers).
 * After a successful apply the script removes its button and switches
 * itself off in JS Runner. Turn it back on to use "원래대로".
 *
 * Note: this relies on SillyTavern's getContext() API${isWi ? '' : ' and prompt\n * manager markup'}. A future SillyTavern update could change those.
 */

const KIND = ${JSON.stringify(isWi ? 'wi' : 'preset')};
const SOURCE_NAME = ${JSON.stringify(label)};
const ENTRIES = ${JSON.stringify(entries, null, 2)};
`;
    return header
        + (isWi ? TITLE_SCRIPT_WI_ADAPTER : TITLE_SCRIPT_PRESET_ADAPTER)
        + TITLE_SCRIPT_RUNTIME;
}

// kind: 'preset' | 'wi'
function exportTitleScript(kind, srcName, items, ns) {
    let targetName = srcName;
    if (kind === 'preset' && (srcName === '__cur__' || !srcName)) {
        targetName = oai_settings?.preset_settings_openai || '';
    }

    // [{ id, name, title }] — the script matches by id first and falls back to
    // the exact name. Preset ids are prompt identifiers; world info item ids
    // are "{book}::{entry key}", and the script only needs the entry key.
    const entries = [];
    let skipped = 0;
    for (const b of (items || [])) {
        // Preset regex scripts / groups / runner nodes aren't prompt-manager
        // entries, so the generated script has nothing of theirs to rename.
        if (b.titleOnly) continue;
        const original = (b.name || '').trim();
        if (!original) continue;
        const translated = getTranslatedTitle(ns, b.id);
        if (!translated || translated === original) { skipped++; continue; }
        const rawId = String(b.id);
        const id = kind === 'wi' ? rawId.slice(rawId.lastIndexOf('::') + 2) : rawId;
        entries.push({ id, name: original, title: translated });
    }

    const count = entries.length;
    if (!count) {
        throw new Error('번역된 제목이 없습니다. 먼저 번역 또는 "제목만" 번역을 실행하세요.');
    }

    const label = targetName || (kind === 'wi' ? 'World Info' : 'Preset');
    const content = buildTitleScriptContent(label, entries, kind);

    let uuid;
    try { uuid = crypto.randomUUID(); }
    catch (e) { uuid = 'ppt-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2, 10); }

    const data = {
        type: 'script',
        enabled: true,
        name: `(제목번역) ${label}`,
        id: uuid,
        content,
        info: `Prompt Panel이 생성한 제목 번역 스크립트 (${count}개 항목, ${effLang('title')}). 플로팅 버튼 → 미리보기 → 적용/원래대로`,
        button: { enabled: true, buttons: [] },
        data: {},
    };

    return {
        data,
        filename: `${sanitizeFilename(label)}_titles_${effLang('title')}_jsrunner.json`,
        count,
        skipped,
    };
}

function exportPresetJSON(presetName) {
    const targetName = presetName === '__cur__' || !presetName
        ? (oai_settings?.preset_settings_openai || '')
        : presetName;
    if (!targetName) throw new Error('프리셋을 찾을 수 없습니다');

    // Match readPresetBlocks(): for the preset that is currently loaded, ST's
    // live working state lives in oai_settings, while openai_settings[] holds
    // the last *saved* copy. Reading from different sources would let the panel
    // show edited content while the export wrote the stale saved version.
    const cur = getCurrentPresetName();
    let presetObj;
    if (targetName === cur) {
        presetObj = oai_settings;
    } else {
        const presetIndex = openai_setting_names?.[targetName];
        presetObj = presetIndex !== undefined ? openai_settings[presetIndex] : null;
    }
    if (!presetObj) throw new Error('프리셋 객체를 찾을 수 없습니다');

    const cloned = deepClone(presetObj);
    const ns = presetNs(presetName);

    // Strip API connection / endpoint / credential fields.
    // These are machine-specific and may include secrets; they should never be
    // embedded in a translated preset file meant for sharing.
    const STRIP_KEYS = [
        'custom_url', 'custom_model', 'custom_include_body', 'custom_exclude_body',
        'custom_include_headers', 'custom_prompt_post_processing',
        'reverse_proxy', 'proxy_password',
        'vertexai_region', 'vertexai_auth_mode', 'vertexai_express_project_id',
        'vertexai_template', 'vertexai_model',
        'openrouter_model', 'openrouter_use_fallback', 'openrouter_group_models',
        'openrouter_sort_models', 'openrouter_providers', 'openrouter_allow_fallbacks',
        'openrouter_middleout', 'openrouter_api_key',
        'openai_model', 'claude_model', 'google_model', 'ai21_model', 'mistralai_model',
        'cohere_model', 'perplexity_model', 'groq_model', 'deepseek_model',
        'zerooneai_model', 'nanogpt_model', 'blockentropy_model', 'xai_model',
        'chat_completion_source',
        'api_url_scale', 'bypass_status_check',
    ];
    for (const k of STRIP_KEYS) delete cloned[k];

    // Also strip the entire connection profile if present
    if (cloned.connection_profile) delete cloned.connection_profile;

    // Note: extensions object is preserved (contains regex_scripts and other useful settings)

    // Replace prompt contents and names with translations where available
    if (Array.isArray(cloned.prompts)) {
        for (const p of cloned.prompts) {
            if (!p || !p.identifier) continue;
            const cached = getTranslated(ns, p.identifier);
            // Title may come from a title-only translation even when there is
            // no full translation, so resolve it independently of the body.
            const title = getTranslatedTitle(ns, p.identifier);
            if (title) p.name = title;
            if (!cached) continue;
            const { body } = splitTitleAndBody(cached);
            if (typeof body === 'string') p.content = body;
        }
    }

    // Preset-scoped regex scripts: translated names only.
    applyPresetRegexTitles(cloned, ns);
    // Third-party label sources that ride along in the preset.
    applyPresetGroupTitles(cloned, ns);
    applyPresetRunnerTitles(cloned, ns);

    return { data: cloned, filename: `${sanitizeFilename(targetName)}_${effLang()}.json` };
}

// ── Live Apply: Preset ──────────────────────────────────────────────
// Writes cached translations straight into ST's own preset object (the
// live `oai_settings` when the target preset is the one currently loaded,
// otherwise the stored-but-inactive `openai_settings[idx]` object) and
// persists it through the same '/api/presets/save' endpoint ST's own
// "update preset" button uses — no JSON file to download/re-import.
// Always applies to ALL prompts (matches exportPresetJSON: full export/apply
// only, to keep preset structure intact).
// titlesOnly: write only the translated names, leaving every prompt's content
// as the original. That keeps the preset's source text intact, so the panel (and
// a TM file) can still match it later by original content — a full apply
// replaces the content and makes the item unmatchable from then on.
async function applyPresetLive(presetName, titlesOnly) {
    const targetName = presetName === '__cur__' || !presetName
        ? (oai_settings?.preset_settings_openai || '')
        : presetName;
    if (!targetName) throw new Error('프리셋을 찾을 수 없습니다');
    if (typeof getChatCompletionPreset !== 'function') {
        throw new Error('프리셋 저장 함수를 찾을 수 없습니다 (ST 버전이 호환되지 않을 수 있습니다)');
    }

    const cur = getCurrentPresetName();
    const isCurrent = targetName === cur;
    let presetObj;
    const presetIndex = isCurrent ? undefined : openai_setting_names?.[targetName];
    if (isCurrent) {
        presetObj = oai_settings;
    } else {
        // Work on a copy: ST's stored entry is only replaced once the save
        // succeeded, so a failed save leaves its in-memory list untouched.
        presetObj = presetIndex !== undefined && openai_settings[presetIndex] ? deepClone(openai_settings[presetIndex]) : null;
    }
    if (!presetObj) throw new Error('프리셋 객체를 찾을 수 없습니다');

    // Same ns readPresetBlocks()/exportPresetJSON() use, so this picks up
    // whatever was already translated in the panel for this preset.
    const ns = presetNs(presetName);
    let applied = 0;
    if (Array.isArray(presetObj.prompts)) {
        for (const p of presetObj.prompts) {
            if (!p || !p.identifier) continue;
            const cached = getTranslated(ns, p.identifier);
            const title = getTranslatedTitle(ns, p.identifier);
            if (title) { p.name = title; applied++; }
            if (titlesOnly || !cached) continue;
            const { body } = splitTitleAndBody(cached);
            if (typeof body === 'string') { p.content = body; applied++; }
        }
    }

    // Preset-scoped regex scripts: rename only. `extensions` is part of
    // settingsToUpdate, so getChatCompletionPreset() below carries this along.
    const regexRenamed = applyPresetRegexTitles(presetObj, ns);
    applied += regexRenamed;

    // ST-BaiBai-Tools 그룹명 / JS러너 스크립트·폴더명. 같은 extensions 안에 있어
    // 저장 경로는 동일하다.
    //
    // 그룹명은 한 가지를 더 해줘야 한다. ST-BaiBai-Tools는 "현재 선택된"
    // 프리셋의 그룹 상태를 자체 메모리에 들고 있고, 그 캐시는 프리셋 이름이
    // 바뀔 때만 파일에서 다시 읽는다. 그리고 그룹 조작이 있을 때마다 그 캐시를
    // 프리셋에 되쓰기 때문에, 우리가 넣은 번역명이 원래 이름으로 되돌아간다.
    // (프리셋을 떠났다 돌아와도 소용없다 — 떠나는 시점에 낡은 캐시가 먼저
    //  파일로 flush되기 때문이다.) 저장 후 캐시를 강제로 버리게 만든다.
    const groupRenamed  = applyPresetGroupTitles(presetObj, ns);
    const runnerRenamed = applyPresetRunnerTitles(presetObj, ns);
    applied += groupRenamed + runnerRenamed;

    if (!applied) throw new Error(titlesOnly
        ? '적용할 제목 번역이 없습니다. 먼저  제목 번역을 실행하세요.'
        : '적용할 번역이 없습니다. 먼저 번역을 실행하세요.');

    // getChatCompletionPreset() pulls the full field set (all of
    // settingsToUpdate, including prompts/prompt_order) off the object we
    // just edited — this is exactly what ST's own save button sends, so
    // nothing else in the preset gets clobbered.
    const presetBody = getChatCompletionPreset(presetObj);

    // Save through ST's own PresetManager rather than POSTing to /api/presets/save
    // ourselves. Both write the same file, but savePreset() also calls
    // updateList(), which refreshes ST's in-memory preset array (openai_settings).
    // Skipping that left the file and ST's memory disagreeing, and other
    // extensions read that array: 酒馆助手(JS-Slash-Runner) rebuilds the whole
    // preset from `preset_list.presets[idx]` on its own debounced save, so a
    // stale entry there would silently write our applied names back out.
    //
    // For a preset that is NOT the loaded one, updateList() would also select
    // it (val().trigger('change')), switching the user over and discarding
    // unsaved edits of the loaded preset — so skip the update there and sync
    // the in-memory entry ourselves.
    const presetManager = SillyTavern?.getContext?.()?.getPresetManager?.('openai');
    const syncStoredCopy = () => {
        try {
            const idx = openai_setting_names?.[targetName];
            if (idx !== undefined && Array.isArray(openai_settings)) openai_settings[idx] = presetBody;
        } catch (e) { console.warn(`[${EXT}] preset list sync failed`, e); }
    };
    if (presetManager?.savePreset) {
        await presetManager.savePreset(targetName, presetBody, { skipUpdate: !isCurrent });
        if (!isCurrent) syncStoredCopy();
    } else {
        // Older ST without an exposed PresetManager — fall back to the raw call.
        const res = await fetch('/api/presets/save', {
            method: 'POST',
            headers: { ...getRequestHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiId: 'openai', name: targetName, preset: presetBody }),
        });
        if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status})`);
        // Keep ST's in-memory copy in step with what we just wrote.
        syncStoredCopy();
    }

    // Make ST-BaiBai-Tools drop its cached group state so it re-reads the names
    // we just saved. OAI_PRESET_IMPORT_READY is the one public event whose
    // handler calls resetPresetPromptGroupRuntimeState(); we deliberately send
    // NO `data`, which is what keeps its two side effects from firing:
    //   collapseImportedPresetPromptGroups(undefined) → bails on !Array.isArray
    //     (so groups are not all collapsed shut)
    //   importRegexPresetGroupStateFromPresetData(undefined) → bails on !presetData
    // Only the cache reset is left. Best-effort: this is another extension's
    // internal behaviour, so a failure here must never fail the apply itself.
    // 酒馆助手 store handoff — see pushRunnerTitlesToTavernHelper(). Runs after the
    // save so its own debounced write rebuilds from a preset list we already
    // refreshed above, not from a stale entry.
    let runnerLiveUpdated = false;
    if (isCurrent && runnerRenamed > 0) {
        runnerLiveUpdated = pushRunnerTitlesToTavernHelper(ns);
    }

    let groupReloadFailed = false;
    if (isCurrent && groupRenamed > 0) {
        try {
            if (eventSource?.emit && event_types?.OAI_PRESET_IMPORT_READY) {
                await eventSource.emit(event_types.OAI_PRESET_IMPORT_READY, { presetName: targetName });
            } else {
                groupReloadFailed = true;
            }
        } catch (e) {
            groupReloadFailed = true;
            console.warn(`[${EXT}] group cache reload failed`, e);
        }
    }

    // Only the currently-loaded preset has a live UI panel to refresh;
    // editing an inactive preset just updates its in-memory copy + the
    // file on disk, and will show correctly next time it's loaded.
    if (isCurrent) {
        try { promptManager?.render?.(false); } catch (e) { console.warn(`[${EXT}] promptManager render failed`, e); }
        // For the loaded preset, ST's regex engine reads the scripts off the
        // live oai_settings we just mutated — persist that to settings.json too
        // so the rename survives a reload without re-selecting the preset.
        if (regexRenamed) { try { saveSettingsDebounced?.(); } catch (e) {} }
    }
    return { targetName, applied, isCurrent, regexRenamed, groupRenamed, runnerRenamed, groupReloadFailed, runnerLiveUpdated };
}

// ── Shared: apply one world-info entry's cached translation, in place ──
// Used by both the JSON export and the live apply so the two never drift on
// the subtle parts (keyword marker lines, selectiveLogic-aware secondary keys).
// Returns the number of fields changed; 0 means nothing was cached for it.
function applyWiEntryTranslation(entry, ns, entryId, titlesOnly) {
    if (!entry) return 0;
    let changed = 0;

    const cached = getTranslated(ns, entryId);
    const title = getTranslatedTitle(ns, entryId);
    if (title) { entry.comment = title; changed++; }
    // Titles-only leaves content AND the trigger keywords alone — keys are part
    // of how the entry fires, not part of its label.
    if (titlesOnly || !cached) return changed;

    const { body: afterTitle } = splitTitleAndBody(cached);
    const parsed = splitKeysAndBody(afterTitle);
    // Guard against false positives: only honour a marker line if the
    // original entry actually had that field. Otherwise a body that
    // genuinely starts with "**Keys:**" would be mis-read as metadata.
    const hadKeys    = Array.isArray(entry.key) && entry.key.length > 0;
    const hadFilters = Array.isArray(entry.keysecondary) && entry.keysecondary.length > 0;
    const keys    = hadKeys    ? parsed.keys    : null;
    const filters = hadFilters ? parsed.filters : null;
    // If a marker was parsed but the original had no such field, that line
    // was real content — put it back so nothing is lost.
    let body = parsed.body;
    if ((parsed.keys && !hadKeys) || (parsed.filters && !hadFilters)) body = afterTitle;
    if (typeof body === 'string') { entry.content = body; changed++; }

    const mergeList = (orig, added) => {
        const out = [], seen = new Set();
        for (const k of [...(Array.isArray(orig) ? orig : []), ...added]) {
            const v = String(k || '').trim();
            if (!v || seen.has(v)) continue;
            seen.add(v);
            out.push(v);
        }
        return out;
    };

    // Primary keys use "any one matches" semantics, so merging original and
    // translated terms is always safe and lets the entry fire either way.
    if (keys && keys.length) { entry.key = mergeList(entry.key, keys); changed++; }

    // Secondary keys depend on selectiveLogic (ST world_info_logic):
    //   0 AND_ANY  — any secondary matches      → merging is safe
    //   1 NOT_ALL  — blocked only if ALL match  → merging breaks the block
    //   2 NOT_ANY  — blocked if any match       → merging is safe (and desirable)
    //   3 AND_ALL  — ALL secondaries must match → merging kills the entry
    // For the two "ALL" logics, extra terms change the condition itself, so
    // we replace with the translated terms instead of merging. The result is
    // meant to be used in the target language, so those terms should apply.
    if (filters && filters.length) {
        const logic = Number(entry.selectiveLogic ?? 0);
        const isAllLogic = (logic === 1 || logic === 3);
        entry.keysecondary = isAllLogic ? filters.slice() : mergeList(entry.keysecondary, filters);
        changed++;
    }
    return changed;
}

// ── JSON Export: World Info ───────────────────────────────────────────
// selectedIds: null = all entries, Set = only those entries (others stay original)
async function exportWorldInfoJSON(worldName, selectedIds) {
    const ctx = SillyTavern?.getContext?.() || getContext?.();
    if (!ctx?.loadWorldInfo) throw new Error('WI 로드 함수를 찾을 수 없습니다');
    const wi = await ctx.loadWorldInfo(worldName);
    if (!wi || !wi.entries) throw new Error('WI 데이터를 찾을 수 없습니다');

    const cloned = deepClone(wi);
    const ns = `pt-wi::${worldName}`;

    // ST's loadWorldInfo() sometimes attaches an `originalData` field that
    // contains a backup of all entries in the original (array) shape. This
    // field is NOT part of the standard WI export format and we must remove
    // it — otherwise filtered exports still contain the full original list,
    // and the file is bloated with duplicated content.
    if ('originalData' in cloned) delete cloned.originalData;

    // If partial selection, filter entries to only selected ones
    if (selectedIds instanceof Set && selectedIds.size > 0) {
        const filteredEntries = {};
        let kept = 0;
        for (const key of Object.keys(cloned.entries)) {
            const entry = cloned.entries[key];
            if (!entry) continue;
            // Try multiple id formats since uid could be number or string
            const candidates = [
                `${worldName}::${entry.uid}`,
                `${worldName}::${String(entry.uid)}`,
                `${worldName}::${key}`,
            ];
            if (candidates.some(c => selectedIds.has(c))) {
                filteredEntries[key] = entry;
                kept++;
            }
        }
        cloned.entries = filteredEntries;
        console.log(`[${EXT}] WI export: filtered ${kept}/${selectedIds.size} entries`);
    }

    // Apply translations (id format matches readWorldInfo: "{wiName}::{uid}")
    for (const key of Object.keys(cloned.entries)) {
        const entry = cloned.entries[key];
        if (!entry) continue;
        applyWiEntryTranslation(entry, ns, `${worldName}::${entry.uid ?? key}`);
    }
    return { data: cloned, filename: `${sanitizeFilename(worldName)}_${effLang()}.json` };
}

// ── Live Apply: World Info ──────────────────────────────────────────
// Writes cached translations straight into the world-info book and saves it
// through ST's own saveWorldInfo() — no file to export and re-import.
// Respects the checkbox selection: with entries selected, only those are
// rewritten and every other entry is left exactly as it was (this never
// deletes entries, unlike the partial JSON *export* which filters them out).
async function applyWorldInfoLive(worldName, selectedIds, titlesOnly) {
    if (!worldName) throw new Error('월드인포를 찾을 수 없습니다');
    const ctx = SillyTavern?.getContext?.() || getContext?.();
    if (!ctx?.loadWorldInfo || !ctx?.saveWorldInfo) {
        throw new Error('월드인포 저장 함수를 찾을 수 없습니다 (ST 버전이 호환되지 않을 수 있습니다)');
    }
    const wi = await ctx.loadWorldInfo(worldName);
    if (!wi || !wi.entries) throw new Error('월드인포 데이터를 찾을 수 없습니다');

    // Same ns readWorldInfo()/exportWorldInfoJSON() use.
    const ns = `pt-wi::${worldName}`;
    const isPartial = selectedIds instanceof Set && selectedIds.size > 0;

    let applied = 0, touched = 0;
    for (const key of Object.keys(wi.entries)) {
        const entry = wi.entries[key];
        if (!entry) continue;
        const entryId = `${worldName}::${entry.uid ?? key}`;
        if (isPartial) {
            // uid may be a number or string depending on how the book was made
            const candidates = [entryId, `${worldName}::${String(entry.uid)}`, `${worldName}::${key}`];
            if (!candidates.some(c => selectedIds.has(c))) continue;
        }
        const n = applyWiEntryTranslation(entry, ns, entryId, titlesOnly);
        if (!n) continue;
        applied += n;
        touched++;
        // Character books carry an `originalData` mirror that ST keeps in sync
        // on every edit; without this the mirror would still hold the original
        // text and could be written back over ours later.
        if (wi.originalData && typeof setWIOriginalDataValue === 'function') {
            try {
                setWIOriginalDataValue(wi, entry.uid, 'comment', entry.comment);
                // Titles-only never touched these; mirroring them would be a
                // no-op at best and could re-write untouched fields at worst.
                if (!titlesOnly) {
                    setWIOriginalDataValue(wi, entry.uid, 'content', entry.content);
                    setWIOriginalDataValue(wi, entry.uid, 'keys', entry.key);
                    setWIOriginalDataValue(wi, entry.uid, 'secondary_keys', entry.keysecondary);
                }
            } catch (e) { console.warn(`[${EXT}] originalData sync failed`, e); }
        }
    }
    if (!applied) throw new Error(titlesOnly
        ? '적용할 제목 번역이 없습니다. 먼저  제목 번역을 실행하세요.'
        : '적용할 번역이 없습니다. 먼저 번역을 실행하세요.');

    // immediately = true: don't leave the write sitting in ST's debounce queue.
    await ctx.saveWorldInfo(worldName, wi, true);
    // Refresh the WI editor only when this book is the one open in it.
    try { ctx.reloadWorldInfoEditor?.(worldName); } catch (e) { console.warn(`[${EXT}] WI editor reload failed`, e); }

    return { targetName: worldName, applied, entries: touched };
}

// ── JSON Export: Character Card ───────────────────────────────────────
// selectedIds: null = translate all fields, Set = only apply translation to those field ids
async function exportCharacterJSON(charIdRaw, opts, selectedIds) {
    let idx = -1;
    if (charIdRaw === '__cur__' || charIdRaw === undefined || charIdRaw === null || charIdRaw === '') {
        const ctx = SillyTavern?.getContext?.() || getContext?.();
        idx = ctx?.characterId !== undefined ? Number(ctx.characterId) : -1;
    } else {
        idx = findCharIndex(charIdRaw);
    }
    if (idx < 0 || !characters?.[idx]) throw new Error('캐릭터를 찾을 수 없습니다');

    try { await unshallowCharacter?.(idx); } catch(e) {}
    const char = characters[idx];
    if (!char) throw new Error('캐릭터 데이터 없음');

    const cloned = deepClone(char);

    // Namespace matches page load: pt-char::{avatar}
    const ns = `pt-char::${char.avatar || '_idx' + idx}`;

    // Strip ST runtime metadata (not part of proper character card export)
    const RUNTIME_KEYS = ['chat', 'chat_size', 'data_size', 'date_added', 'date_last_chat', 'json_data', 'shallow'];
    for (const k of RUNTIME_KEYS) delete cloned[k];

    const shouldApply = (fieldId) => !(selectedIds instanceof Set) || selectedIds.size === 0 || selectedIds.has(fieldId);
    const isPartial = selectedIds instanceof Set && selectedIds.size > 0;

    // V3 spec uses data.* as source of truth. V1 top-level fields are duplicates.
    // We write translations into V2 (data.*) only and clear V1 duplicates to keep file lean.
    const setV2 = (v2Key, value) => {
        if (value === undefined || value === null) return;
        if (cloned.data) cloned.data[v2Key] = value;
    };

    const mainFields = [
        'description', 'personality', 'scenario', 'first_mes', 'mes_example',
        'post_history_instructions', 'creator_notes',
    ];

    // Apply translations to V2; clear non-selected fields when partial selection is active
    for (const f of mainFields) {
        if (shouldApply(f)) {
            const t = getTranslatedBody(ns, f);
            if (t !== null) setV2(f, t);
        } else if (isPartial) {
            setV2(f, '');
        }
    }

    // Clear V1 duplicates (description, personality, etc. at top level)
    const V1_DUPLICATES = ['description', 'personality', 'scenario', 'first_mes', 'mes_example',
                           'post_history_instructions', 'creator_notes', 'system_prompt',
                           'creator', 'character_version'];
    for (const k of V1_DUPLICATES) {
        if (k in cloned) cloned[k] = '';
    }

    // Alternate greetings: V2 is source of truth
    const alts = cloned.data?.alternate_greetings || cloned.alternate_greetings || null;
    if (Array.isArray(alts)) {
        for (let i = 0; i < alts.length; i++) {
            const fieldId = `alt_greeting_${i}`;
            if (shouldApply(fieldId)) {
                const t = getTranslatedBody(ns, fieldId);
                if (t !== null) alts[i] = t;
            } else if (isPartial) {
                alts[i] = '';
            }
        }
        if (cloned.data) cloned.data.alternate_greetings = alts;
        if ('alternate_greetings' in cloned) cloned.alternate_greetings = [];
    }

    // Character's Note: V2 path only
    if (shouldApply('character_note')) {
        const noteT = getTranslatedBody(ns, 'character_note');
        if (noteT && cloned.data?.extensions?.depth_prompt) {
            cloned.data.extensions.depth_prompt.prompt = noteT;
        }
    } else if (isPartial && cloned.data?.extensions?.depth_prompt) {
        cloned.data.extensions.depth_prompt.prompt = '';
    }

    // system_prompt
    if (shouldApply('system_prompt')) {
        const t = getTranslatedBody(ns, 'system_prompt');
        if (t && cloned.data) cloned.data.system_prompt = t;
    } else if (isPartial && cloned.data) {
        cloned.data.system_prompt = '';
    }

    // Embedded character_book: option A — keep original. If excluded, remove ALL world link refs.
    if (opts && opts.includeCharacterBook === false) {
        // Remove the embedded book itself
        if (cloned.data?.character_book) delete cloned.data.character_book;
        if (cloned.character_book) delete cloned.character_book;
        // Remove world-info name references — ST auto-links a same-named world info on import,
        // which defeats the "exclude" intent.
        if (cloned.data?.extensions) {
            if ('world' in cloned.data.extensions) cloned.data.extensions.world = '';
        }
        if (cloned.extensions) {
            if ('world' in cloned.extensions) cloned.extensions.world = '';
        }
        // Some cards also carry a top-level reference
        if ('world' in cloned) cloned.world = '';
        if (cloned.data && 'world' in cloned.data) cloned.data.world = '';
    }

    const name = char.name || `character_${idx}`;
    return { data: cloned, filename: `${sanitizeFilename(name)}_${effLang()}.json` };
}

// ── Live Apply: Character Card ──────────────────────────────────────
// Writes cached translations straight into the character PNG through the same
// '/api/characters/merge-attributes' endpoint ST's own character editor and
// /update-char command use — no JSON to export and re-import.
// Respects the checkbox selection: with fields selected, only those are
// written; every other field keeps its current value (unlike the partial JSON
// *export*, which blanks the unselected ones).
async function applyCharacterLive(charIdRaw, selectedIds) {
    let idx = -1;
    const ctx = SillyTavern?.getContext?.() || getContext?.();
    if (charIdRaw === '__cur__' || charIdRaw === undefined || charIdRaw === null || charIdRaw === '') {
        idx = ctx?.characterId !== undefined ? Number(ctx.characterId) : -1;
    } else {
        idx = findCharIndex(charIdRaw);
    }
    if (idx < 0 || !characters?.[idx]) throw new Error('캐릭터를 찾을 수 없습니다');

    try { await unshallowCharacter?.(idx); } catch (e) {}
    const char = characters[idx];
    if (!char) throw new Error('캐릭터 데이터 없음');
    // The endpoint identifies the target card by its avatar filename, so a card
    // without one can't be written to safely.
    if (!char.avatar) throw new Error('아바타 파일명이 없어 저장 대상을 특정할 수 없습니다');

    // Namespace matches page load: pt-char::{avatar}
    const ns = `pt-char::${char.avatar}`;
    const isPartial = selectedIds instanceof Set && selectedIds.size > 0;
    const shouldApply = fieldId => !isPartial || selectedIds.has(fieldId);

    // The server deep-merges this object into the card, so only the keys we
    // send are changed. V1 (top-level) and V2 (data.*) are both written, the
    // same as ST's own character update path, so readers of either agree.
    const update = { avatar: char.avatar, data: {} };
    let applied = 0;

    const MAIN_FIELDS = [
        'description', 'personality', 'scenario', 'first_mes', 'mes_example',
        'system_prompt', 'post_history_instructions', 'creator_notes',
    ];
    for (const f of MAIN_FIELDS) {
        if (!shouldApply(f)) continue;
        const t = getTranslatedBody(ns, f);
        if (t === null) continue;
        update[f] = t;
        update.data[f] = t;
        applied++;
    }

    // Alternate greetings: deepMerge replaces arrays wholesale, so the full
    // list has to be sent with only the translated slots substituted.
    const alts = char.data?.alternate_greetings || char.alternate_greetings || null;
    if (Array.isArray(alts) && alts.length) {
        const next = alts.slice();
        let hits = 0;
        for (let i = 0; i < next.length; i++) {
            const fieldId = `alt_greeting_${i}`;
            if (!shouldApply(fieldId)) continue;
            const t = getTranslatedBody(ns, fieldId);
            if (t === null) continue;
            next[i] = t;
            hits++;
        }
        if (hits) {
            update.data.alternate_greetings = next;
            update.alternate_greetings = next;
            applied += hits;
        }
    }

    // Character's Note = data.extensions.depth_prompt.prompt (keep depth/role)
    if (shouldApply('character_note')) {
        const t = getTranslatedBody(ns, 'character_note');
        const dp = char.data?.extensions?.depth_prompt;
        if (t !== null && dp) {
            update.data.extensions = { depth_prompt: { ...dp, prompt: t } };
            applied++;
        }
    }

    if (!applied) throw new Error('적용할 번역이 없습니다. 먼저 번역을 실행하세요.');
    if (!Object.keys(update.data).length) delete update.data;

    const res = await fetch('/api/characters/merge-attributes', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(update),
    });
    if (!res.ok) throw new Error(`저장 실패 (HTTP ${res.status})`);

    // Pull the saved card back into ST's in-memory list so the panel and the
    // character editor both read the new text.
    try { await ctx?.getOneCharacter?.(char.avatar); } catch (e) { console.warn(`[${EXT}] character reload failed`, e); }
    try {
        await eventSource?.emit?.(event_types.CHARACTER_EDITED, { detail: { id: idx, character: characters?.[idx] } });
    } catch (e) { console.warn(`[${EXT}] CHARACTER_EDITED emit failed`, e); }

    const isCurrent = ctx?.characterId != null && Number(ctx.characterId) === idx;
    return { targetName: char.name || `#${idx}`, applied, isCurrent };
}

// ── Title-only translation (batched) ─────────────────────────────────
// Translates just the toggle/entry names, in batches, so a user can skim a
// large preset and decide what is worth translating in full.
//
// Safety notes:
//  - Results go to the title-only cache (titleNS), never to the main cache,
//    so a later full 번역 still runs normally and is never shadowed.
//  - Items that already have a translated title (full or title-only) are
//    skipped, so repeat presses cost nothing and never overwrite good data.
//  - Parsing is strict: a batch whose reply doesn't line up 1:1 is discarded
//    wholesale rather than risk assigning titles to the wrong toggles.
// Batch size and inter-request delay are user-configurable (extension drawer).
const titleBatchSize  = () => Math.max(1, Math.min(50, cfg().titleBatchSize || 15));
const requestDelayMs  = () => Math.max(0, cfg().requestDelayMs ?? 60);
const concurrency     = () => Math.max(1, Math.min(8, cfg().concurrency || 1));
const maxRetries      = () => Math.max(0, Math.min(5, cfg().maxRetries ?? 2));
const requestTimeoutMs= () => Math.max(5000, cfg().requestTimeoutMs || 120000);

function parseNumberedTitles(raw, expectedCount) {
    if (typeof raw !== 'string') return null;
    const found = new Map();
    for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*(\d+)\s*[.):\]]\s*(.+?)\s*$/);
        if (!m) continue;
        const idx = parseInt(m[1], 10);
        let val = m[2].trim();
        // Strip stray markdown emphasis/heading the model may add
        val = val.replace(/^#{1,6}\s+/, '').replace(/^\*\*(.*)\*\*$/, '$1').trim();
        if (!val) continue;
        if (idx >= 1 && idx <= expectedCount && !found.has(idx)) found.set(idx, val);
    }
    // Require a complete, unambiguous mapping
    if (found.size !== expectedCount) return null;
    const out = [];
    for (let i = 1; i <= expectedCount; i++) out.push(found.get(i));
    return out;
}

async function translateTitleBatch(names) {
    const lang = effLang('title');
    const numbered = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
    const prompt =
`Translate each of the following ${names.length} short labels into ${lang}.

RULES:
1. These are UI labels / section titles from a chat-AI prompt preset. Keep them short and label-like.
2. Do NOT translate: {{char}}, {{user}}, {{getvar::*}}, {{setvar::*}}, {{random::*}}, code identifiers, URLs.
3. Preserve any leading emoji or symbols exactly as they appear.
4. Do NOT alter references to languages, nationalities, cultures, or styles. Translate such words literally.
5. Output EXACTLY ${names.length} lines, each formatted as "<number>. <translation>", in the same order and numbering as the input.
6. Output ONLY those lines — no preamble, no commentary, no blank lines between items.
7. Never echo a label back unchanged. Even if a label is already close to ${lang}, produce a proper ${lang} rendering.

--- LABELS ---
${numbered}
--- END ---

Now output the ${names.length} numbered lines, translated into ${lang}.`;

    const result = await runCompletion(buildMessages(prompt));
    if (typeof result !== 'string' || !result.trim()) {
        // Nothing came back — halving the batch will not make the model answer.
        const err = new Error('empty reply'); err.__empty = true; throw err;
    }
    return parseNumberedTitles(result, names.length);
}

async function runTitleTranslation({ items, list, ns, pBar, pLabel, pWrap, btnStop, onDone }) {
    if (isBusy) return;

    // Respect selection; otherwise operate on everything loaded.
    const selected = [...list.querySelectorAll('.pt-block-item.selected')].map(el => el.dataset.id);
    const scoped = selected.length ? items.filter(b => selected.includes(b.id)) : items;

    // Split into "needs translation" and "already has a translated title".
    const named = scoped.filter(b => b.name && b.name.trim());
    const fresh = named.filter(b => !getTranslatedTitle(ns, b.id));
    const already = named.filter(b => getTranslatedTitle(ns, b.id));

    let targets = fresh;
    if (!fresh.length) {
        if (!already.length) {
            if (typeof toastr !== 'undefined') toastr.info('번역할 제목이 없습니다');
            return;
        }
        // Everything already has a title — offer a redo rather than refusing.
        const redo = confirm(
            `제목 ${already.length}개가 이미 번역되어 있습니다.\n\n다시 번역할까요?\n\n[확인] = 재번역 (기존 제목 번역을 덮어씀)\n[취소] = 아무것도 하지 않음\n\n※ 본문 번역 데이터는 영향을 받지 않습니다.`
        );
        if (!redo) return;
        targets = already;
    }

    if (!targets.length) {
        if (typeof toastr !== 'undefined') toastr.info('번역할 제목이 없습니다');
        return;
    }

    isBusy = true; stopReq = false;
    const dot = PDOC.getElementById('pt-status-dot'), stTxt = PDOC.getElementById('pt-status-text');
    dot?.classList.add('busy');
    if (stTxt) stTxt.textContent = '제목 번역 중...';
    pWrap.classList.add('visible');
    if (btnStop) btnStop.disabled = false;

    const batches = [];
    const bs = titleBatchSize();
    for (let i = 0; i < targets.length; i += bs) {
        batches.push(targets.slice(i, i + bs));
    }

    // 응답 줄 수가 배치와 어긋나면 예전에는 그 배치 전체(기본 15개)를 버렸다.
    // 이제는 반씩 쪼개 다시 물어보고, 한 개까지 내려가면 한 번 더 시도한다.
    // 개수가 맞는 응답만 채택하는 판정 자체는 그대로다 — 추측해서 넣지 않는다.
    // 쪼개기까지 합쳐 한 배치당 요청은 최대 BATCH_ATTEMPTS번 — 빈 응답은 쪼개
    // 봐야 똑같으니 바로 실패로 친다.
    const BATCH_ATTEMPTS = 4;
    const translateNames = async (batch, budget) => {
        const tries = batch.length === 1 ? 2 : 1;
        for (let attempt = 0; attempt < tries; attempt++) {
            if (stopReq || budget.left <= 0) return null;
            budget.left--;
            try {
                const t = await translateTitleBatch(batch.map(b => b.name));
                if (t) return t;
                console.warn(`[${EXT}] title batch reply did not match ${batch.length} items`);
            } catch (err) {
                if (stopReq || err?.__stopped) return null;
                console.warn(`[${EXT}] title batch failed`, err);
                if (err?.__empty) return null;
                // 키 오류 같은 확정적 실패는 쪼개 봐야 똑같이 실패한다.
                if (!isRetryableError(err)) return null;
            }
        }
        if (stopReq || batch.length === 1 || budget.left <= 0) return null;
        const mid = Math.ceil(batch.length / 2);
        const left = await translateNames(batch.slice(0, mid), budget);
        if (!stopReq) await sleepCancellable(requestDelayMs());
        const right = stopReq || budget.left <= 0 ? null : await translateNames(batch.slice(mid), budget);
        if (!left && !right) return null;
        return [
            ...(left  || new Array(mid).fill(null)),
            ...(right || new Array(batch.length - mid).fill(null)),
        ];
    };

    let done = 0, okCount = 0, failCount = 0, deadBatches = 0;
    for (const batch of batches) {
        if (stopReq) break;
        const translated = await translateNames(batch, { left: BATCH_ATTEMPTS });
        let batchOk = 0;
        batch.forEach((b, i) => {
            const v = translated?.[i];
            if (!v) { failCount++; return; }
            setCacheTitle(ns, b.id, v);
            // Title-only blocks show the translated name in their
            // 번역 box (they have no body), so refresh it in place.
            if (b.titleOnly) setBlockHTML(list, b.id, esc(v));
            okCount++; batchOk++;
        });
        done += batch.length;
        // 세 배치 연속으로 하나도 못 받으면 연결·모델 문제다 — 나머지를 돌려 봐야 요청만 쌓인다.
        deadBatches = batchOk ? 0 : deadBatches + 1;
        if (!stopReq && deadBatches >= 3 && done < targets.length) {
            if (typeof toastr !== 'undefined') toastr.error('제목 번역이 3배치 연속 실패해 중단했습니다. 연결·모델 설정을 확인해 주세요.');
            stopReq = true;
            break;
        }
        const pct = Math.round(done / targets.length * 100);
        pBar.style.width = pct + '%';
        pLabel.textContent = `${done} / ${targets.length}  (${pct}%)`;
        if (!stopReq && done < targets.length) await sleepCancellable(requestDelayMs());
    }

    try { updateCacheStatsUI(); } catch (e) {}
    isBusy = false;
    dot?.classList.remove('busy');
    pWrap.classList.remove('visible');
    if (btnStop) btnStop.disabled = true;
    if (stTxt) stTxt.textContent = stopReq ? '중단됨' : '제목 번역 완료 ';
    setTimeout(() => { const t = PDOC.getElementById('pt-status-text'); if (t) t.textContent = '대기 중'; }, 3000);

    if (typeof toastr !== 'undefined') {
        if (failCount) toastr.warning(`제목 ${okCount}개 번역 완료, ${failCount}개 실패`);
        else toastr.success(`제목 ${okCount}개 번역 완료`);
    }
    if (typeof onDone === 'function') onDone();
}

// ── Page factory ──────────────────────────────────────────────────────
function buildPage({ page, idPfx, listFn, loadFn, selectable, icon, hint, isAsync, kind }) {
    let items=[], ns='';

    // Buttons + search on same row
    page.innerHTML = `
        <div class="pt-page-fixed">
            <div class="pt-toolbar">
                <div class="pt-combo" id="${idPfx}-combo">
                    <input type="text" class="pt-combo-input" id="${idPfx}-cinput" placeholder="— 선택 —" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-autocomplete="list">
                    <span class="pt-combo-caret" aria-hidden="true">▾</span>
                    <div class="pt-combo-list" id="${idPfx}-clist" role="listbox"></div>
                </div>
                <select class="pt-select pt-combo-native" id="${idPfx}-sel"><option value="">— 선택 —</option></select>
                <button class="pt-btn pt-btn-secondary" id="${idPfx}-load"> 로드</button>
                <div class="pt-export-group">
                    <button class="pt-btn-icon" id="${idPfx}-apply" title="${kind === 'wi' ? '월드인포에 즉시 적용' : kind === 'char' ? '봇카드에 즉시 적용' : '프리셋에 즉시 적용'}"><i class="fa-solid fa-bolt"></i></button>
                    <details class="pt-more-actions"><summary><i class="fa-solid fa-ellipsis" aria-hidden="true"></i> 더보기</summary><div class="pt-more-actions-body">
                    <button class="pt-btn-icon" id="${idPfx}-copy" title="복사"><i class="fa-solid fa-copy" aria-hidden="true"></i><span>복사</span></button>
                    <button class="pt-btn-icon" id="${idPfx}-txt" title="TXT 내보내기"><i class="fa-solid fa-file-lines" aria-hidden="true"></i><span>TXT</span></button>
                    <button class="pt-btn-icon" id="${idPfx}-json" title="JSON 내보내기"><i class="fa-solid fa-file-code" aria-hidden="true"></i><span>JSON</span></button>
                    ${kind === 'char' ? '' : `<button class="pt-btn-icon" id="${idPfx}-tm" title="번역 메모리"><i class="fa-solid fa-box-archive" aria-hidden="true"></i><span>번역 기록</span></button>
                    <input type="file" id="${idPfx}-tmfile" accept="application/json,.json" style="display:none;">`}
                    </div></details>
                </div>
            </div>
            <div class="pt-progress-wrap" id="${idPfx}-prog">
                <div class="pt-progress-bar-outer"><div class="pt-progress-bar-inner" id="${idPfx}-pbar"></div></div>
                <div class="pt-progress-label" id="${idPfx}-plbl"></div>
            </div>
            <div class="pt-controls" id="${idPfx}-ctrl" style="display:none;">
                <div class="pt-controls-scroll">
                    <button class="pt-btn pt-btn-primary" id="${idPfx}-trans"> 번역</button>
                    <button class="pt-btn pt-btn-retr"    id="${idPfx}-retr">↺ 재번역</button>
                    <button class="pt-btn pt-btn-title"   id="${idPfx}-titles" title="제목만 빠르게 번역 (본문은 그대로)"> 제목</button>
                    <button class="pt-btn pt-btn-stop"    id="${idPfx}-stop" disabled>■ 중단</button>
                    <button class="pt-btn pt-btn-danger"  id="${idPfx}-clr" title="번역 캐시 비우기"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
                    <button class="pt-btn-icon pt-btn-eye" id="${idPfx}-eye" title="토글 제목을 번역본으로 보기 (다시 누르면 원어로)" aria-pressed="false"><i class="fa-solid fa-eye" aria-hidden="true"></i></button>
                </div>
                <input type="text" class="pt-search" id="${idPfx}-search" placeholder=" 검색">
            </div>
            ${selectable ? `<div class="pt-select-row" id="${idPfx}-sarow" style="display:none;">
                <input type="checkbox" class="pt-checkbox" id="${idPfx}-allcb">
                <span class="pt-info-chip" id="${idPfx}-cnt"></span>
                <span class="pt-selected-chip" style="display:none;"></span>
            </div>` : `<div class="pt-select-row" id="${idPfx}-sarow" style="display:none;">
                <span class="pt-info-chip" id="${idPfx}-cnt"></span>
            </div>`}
        </div>
        <div class="pt-page-scroll">
            <div class="pt-block-list" id="${idPfx}-list"></div>
            <div class="pt-empty" id="${idPfx}-empty">
                <div class="pt-empty-icon">${icon}</div>
                <p id="${idPfx}-emptymsg">${hint}</p>
            </div>
        </div>`;

    const sel=page.querySelector(`#${idPfx}-sel`), list=page.querySelector(`#${idPfx}-list`);
    const ctrl=page.querySelector(`#${idPfx}-ctrl`), saRow=page.querySelector(`#${idPfx}-sarow`);
    const pWrap=page.querySelector(`#${idPfx}-prog`), pBar=page.querySelector(`#${idPfx}-pbar`), pLabel=page.querySelector(`#${idPfx}-plbl`);
    const empty=page.querySelector(`#${idPfx}-empty`), emptyP=page.querySelector(`#${idPfx}-emptymsg`);
    const btnStop=page.querySelector(`#${idPfx}-stop`), searchEl=page.querySelector(`#${idPfx}-search`);
    const eyeBtn = page.querySelector(`#${idPfx}-eye`);

    // ──  Toggle title language (display-only, does not modify cache) ──
    // When ON: each block's name shows the translated title (if available).
    // When OFF (default): each block's name shows the original.
    // - data-orig-name attribute is saved on first toggle so we can always restore.
    // - Translated title comes from getTranslatedTitle(ns, id) which reads
    //   the first markdown heading line of the cached translation. If a
    //   translation has no heading, the original name is shown.
    // - Re-translation updates the cache; the next applyEyeMode call will pick
    //   up the new translated title automatically (we always re-read from cache).
    let _eyeOn = false;
    const applyEyeMode = () => {
        list.querySelectorAll('.pt-block-item').forEach(item => {
            const id = item.dataset.id;
            if (!id) return;
            const nameEl = item.querySelector('.pt-block-name');
            if (!nameEl) return;
            // Save original on first use
            if (!item.dataset.origName) {
                item.dataset.origName = nameEl.textContent || '';
            }
            if (_eyeOn) {
                const tTitle = getTranslatedTitle(ns, id);
                nameEl.textContent = tTitle || item.dataset.origName;
            } else {
                nameEl.textContent = item.dataset.origName;
            }
            // title attribute (hover tooltip) intentionally left as the original
        });
    };
    eyeBtn?.addEventListener('click', () => {
        _eyeOn = !_eyeOn;
        eyeBtn.setAttribute('aria-pressed', _eyeOn ? 'true' : 'false');
        eyeBtn.classList.toggle('pt-eye-on', _eyeOn);
        applyEyeMode();
    });

    const showEmpty = msg => { empty.style.display=''; if(msg)emptyP.textContent=msg; ctrl.style.display='none'; if(saRow)saRow.style.display='none'; };
    const hideEmpty = () => { empty.style.display='none'; ctrl.style.display=''; if(saRow)saRow.style.display=''; };
    showEmpty(hint);

    // Chunked (re)render of the currently loaded `items` into the list DOM.
    // Shared by the initial load and by TM import (which updates the cache
    // for already-loaded items and needs the previews refreshed without a
    // full reload).
    const renderList = (snap) => {
        list.innerHTML = '';
        let i = 0;
        const renderChunk = () => {
            const end = Math.min(i + 50, items.length), frag = PDOC.createDocumentFragment();
            for (; i < end; i++) frag.appendChild(makeBlockItem(items[i], ns, selectable, applyEyeMode));
            list.appendChild(frag);
            if (i < items.length) requestAnimationFrame(renderChunk);
            else {
                if (snap) {
                    // Put back what the person had set up before the panel closed.
                    if (snap.selected?.size) {
                        list.querySelectorAll('.pt-block-item').forEach(el => {
                            if (!snap.selected.has(el.dataset.id)) return;
                            el.classList.add('selected');
                            const cb = el.querySelector('.pt-checkbox');
                            if (cb) cb.checked = true;
                        });
                    }
                    if (searchEl) searchEl.value = snap.search || '';
                    if (snap.search) applySearchFilter(snap.search.trim().toLowerCase());
                } else if (searchEl) {
                    searchEl.value = '';
                }
                updateSelectedCount(page);
                applyEyeMode();
                if (snap?.scrollTop && scrollEl) scrollEl.scrollTop = snap.scrollTop;
            }
        };
        renderChunk();
    };

    // ── Close/open lifecycle ──────────────────────────────────────────
    // sleep() drops the rendered rows out of ST's document; wake() rebuilds
    // them from `items` and restores selection, search and scroll position.
    const scrollEl = page.querySelector('.pt-page-scroll');
    let dormant = null;   // snapshot while asleep, null while awake
    PAGE_HOOKS.push({
        sleep() {
            // Never yank the list out from under a running translation — the
            // progress writes target these very rows.
            if (isBusy || dormant || !list.childElementCount) return;
            dormant = {
                selected: new Set([...list.querySelectorAll('.pt-block-item.selected')].map(el => el.dataset.id)),
                search: searchEl?.value || '',
                scrollTop: scrollEl?.scrollTop || 0,
            };
            clearTimeout(searchTimeout);
            list.innerHTML = '';
        },
        wake() {
            if (!dormant) return;
            const snap = dormant;
            dormant = null;
            if (items.length) renderList(snap);
        },
    });

    // ── Searchable dropdown ───────────────────────────────────────────
    // The native <select> stays in the DOM and remains the source of truth —
    // every other code path (load, apply, export, getSourceName, the ↻ refresh)
    // reads sel.value / sel.options, so none of them had to change. The combo
    // is a thin filter UI in front of it; picking an entry writes through to
    // the select and fires 'change'.
    const combo  = page.querySelector(`#${idPfx}-combo`);
    const cInput = page.querySelector(`#${idPfx}-cinput`);
    const cList  = page.querySelector(`#${idPfx}-clist`);
    let comboOpen = false, activeIdx = -1, matches = [];

    const realOptions = () => [...sel.options].filter(o => o.value);
    const selectedLabel = () => {
        const o = sel.options[sel.selectedIndex];
        return (o && o.value) ? o.textContent : '';
    };
    // Keep the input showing the current selection; called after every refill.
    const syncCombo = () => { if (cInput) cInput.value = selectedLabel(); };

    const closeCombo = (restoreLabel = true) => {
        comboOpen = false; activeIdx = -1;
        combo?.classList.remove('open');
        cInput?.setAttribute('aria-expanded', 'false');
        if (restoreLabel) syncCombo();
    };

    const renderCombo = (query) => {
        const q = (query || '').trim().toLowerCase();
        matches = realOptions().filter(o => !q || o.textContent.toLowerCase().includes(q));
        if (!matches.length) {
            cList.innerHTML = `<div class="pt-combo-empty">결과 없음</div>`;
            return;
        }
        const cur = sel.value;
        cList.innerHTML = matches.map((o, i) => {
            const label = q ? highlightText(esc(o.textContent), q) : esc(o.textContent);
            const cls = ['pt-combo-item'];
            if (o.value === cur) cls.push('current');
            if (i === activeIdx) cls.push('active');
            return `<div class="${cls.join(' ')}" role="option" data-v="${esc(o.value)}" data-i="${i}">${label}</div>`;
        }).join('');
    };

    const setActive = (i) => {
        if (!matches.length) return;
        activeIdx = (i + matches.length) % matches.length;
        cList.querySelectorAll('.pt-combo-item').forEach(el => {
            const on = Number(el.dataset.i) === activeIdx;
            el.classList.toggle('active', on);
            if (on) el.scrollIntoView({ block: 'nearest' });
        });
    };

    const openCombo = (query) => {
        comboOpen = true;
        combo?.classList.add('open');
        cInput?.setAttribute('aria-expanded', 'true');
        activeIdx = -1;
        renderCombo(query);
        // Put the current entry in view so a long list opens where you left off.
        const cur = cList.querySelector('.pt-combo-item.current');
        if (cur) cur.scrollIntoView({ block: 'nearest' });
    };

    const pick = (value) => {
        sel.value = value;
        closeCombo();
        try { sel.dispatchEvent(new (PDOC.defaultView || window).Event('change', { bubbles: true })); } catch (e) {}
    };

    cInput?.addEventListener('focus', () => { cInput.select(); openCombo(''); });
    cInput?.addEventListener('input', () => { if (!comboOpen) comboOpen = true; combo?.classList.add('open'); activeIdx = -1; renderCombo(cInput.value); });
    combo?.querySelector('.pt-combo-caret')?.addEventListener('mousedown', e => {
        e.preventDefault();
        comboOpen ? closeCombo() : (cInput.focus(), openCombo(''));
    });
    cInput?.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown')      { e.preventDefault(); if (!comboOpen) openCombo(cInput.value); else setActive(activeIdx + 1); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); if (comboOpen) setActive(activeIdx - 1); }
        else if (e.key === 'Enter')     {
            if (comboOpen && matches.length) {
                e.preventDefault();
                pick(matches[activeIdx >= 0 ? activeIdx : 0].value);
            }
        }
        else if (e.key === 'Escape')    { if (comboOpen) { e.stopPropagation(); closeCombo(); } }
    });
    cList?.addEventListener('mousedown', e => {
        const item = e.target.closest('.pt-combo-item');
        if (!item) return;
        e.preventDefault();   // keep focus so blur does not fight the pick
        pick(item.dataset.v);
    });
    cInput?.addEventListener('blur', () => setTimeout(() => closeCombo(), 120));

    const refillSelect = async () => {
        const keep = sel.value;
        sel.innerHTML='<option value="">— 선택 —</option>';
        const opts=isAsync?await listFn():listFn();
        opts.forEach(item=>{ const o=PDOC.createElement('option'); o.value=item.id; o.textContent=item.name; sel.appendChild(o); });
        // A refill must not silently drop what the person had chosen.
        if (keep && [...sel.options].some(o => o.value === keep)) sel.value = keep;
        syncCombo();
    };
    // The ↻ refresh lives outside buildPage; let it reuse this refill.
    sel._ptRefill = refillSelect;
    refillSelect();
    if (idPfx==='pt-char') {
        try { eventSource?.on?.(event_types?.APP_READY, refillSelect); } catch(e){}
        setTimeout(refillSelect,1500); setTimeout(refillSelect,4000);
    }

    page.querySelector(`#${idPfx}-load`).addEventListener('click', async () => {
        const val=sel.value;
        // Character tab: require explicit selection (no implicit "current character" fallback)
        if (kind === 'char' && !val) {
            showEmpty('불러올 데이터가 없습니다.');
            return;
        }
        ns=kind==='preset' ? presetNs(val) : `${idPfx}::${val||'__cur__'}`;
        showEmpty('로딩 중...');
        try {
            items=await loadFn(val);
        } catch (e) {
            console.error(`[${EXT}] load failed`, e);
            items=[];
            list.innerHTML='';
            showEmpty('불러오기 실패');
            if (typeof toastr !== 'undefined') toastr.error('불러오기 실패');
            return;
        }
        // 이 확장이 예전에 적용해 둔 주석 블록은 "원문"이 아니다. 원문에서 떼어
        // 내어, ① 모델에 우리 주석을 원문인 양 다시 보내지 않고 ② 로컬 캐시가
        // 없어도 주석이 이미 존재한다는 것을 파일만 보고 알 수 있게 한다.
        for (const it of items) {
            if (!it || typeof it.content !== 'string') continue;
            const { source, note } = extractOwnNote(it.content);
            if (!note) continue;
            it.content = source;
            it.injectedNote = note;
        }
        list.innerHTML='';

        // 선택 상태 완전 초기화 (프리셋 변경 시 이전 선택이 남지 않도록)
        const allCb = page.querySelector(`#${idPfx}-allcb`);
        if (allCb) allCb.checked = false;
        const selChip = page.querySelector('.pt-selected-chip');
        if (selChip) { selChip.style.display = 'none'; selChip.textContent = ''; }

        if (!items.length) { showEmpty('불러올 데이터가 없습니다.'); return; }
        hideEmpty();
        const totalTkn=items.reduce((s,i)=>s+estimateTokens(i.content||''),0);
        const cntEl=page.querySelector(`#${idPfx}-cnt`);
        if (cntEl) cntEl.textContent=` ${items.length}개 · ${totalTkn.toLocaleString()} tkn`;
        renderList();
    });

    // Search with highlight
    let searchTimeout = null;
    const applySearchFilter = (q) => {
            list.querySelectorAll('.pt-block-item').forEach(el=>{
                if (!q) {
                    el.style.display='';
                    // 하이라이트 제거
                    el.querySelectorAll('.pt-original-text,.pt-translated-text').forEach(box=>{
                        if (box.dataset.origHtml) { box.innerHTML=box.dataset.origHtml; delete box.dataset.origHtml; }
                    });
                } else {
                    const match=el.dataset.searchText.includes(q);
                    el.style.display=match?'':'none';
                    if (match) {
                        // 하이라이트 적용
                        el.querySelectorAll('.pt-original-text,.pt-translated-text').forEach(box=>{
                            if (!box.dataset.origHtml) box.dataset.origHtml=box.innerHTML;
                            box.innerHTML=highlightText(box.dataset.origHtml, q);
                        });
                    }
                }
            });
    };
    searchEl?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => applySearchFilter(searchEl.value.trim().toLowerCase()), 120);
    });

    page.querySelector(`#${idPfx}-allcb`)?.addEventListener('change', ev => {
        list.querySelectorAll('.pt-block-item').forEach(item=>{
            if (item.style.display==='none') return;
            const cb=item.querySelector('.pt-checkbox');
            if (cb) { cb.checked=ev.target.checked; item.classList.toggle('selected',ev.target.checked); }
        });
        updateSelectedCount(page);
    });

    const mkArgs=(force,mode)=>({items,list,ns,pBar,pLabel,pWrap,btnStop,forceRetranslate:!!force,mode});
    // 본문을 "번역"으로 쓸지 "주석"으로 붙일지는 매 실행마다 고른다. 한 번의
    // 요청이 번역과 주석을 동시에 만들지 않게 하려는 것 — 나눠 돌린 결과는
    // "본문 번역\n{{// 주석 번역}}" 형태로 자동 병합된다.
    const askTransMode = () => askChoice('본문을 어떻게 번역할까요?', [
        { v:'body', label:' 완전 번역 (본문에 번역)' },
        { v:'note', label:' 주석으로 추가 ({{// }})' },
    ]);
    page.querySelector(`#${idPfx}-trans`).addEventListener('click',async()=>{
        const mode=await askTransMode(); if(!mode) return;
        await runTranslation(mkArgs(false,mode));
    });
    page.querySelector(`#${idPfx}-retr`).addEventListener('click',async()=>{
        const mode=await askTransMode(); if(!mode) return;
        if(!confirm(mode==='note'?'주석을 다시 번역할까요? (본문 번역은 유지됩니다)':'본문을 재번역할까요? (주석은 유지됩니다)')) return;
        await runTranslation(mkArgs(true,mode));
    });
    page.querySelector(`#${idPfx}-titles`)?.addEventListener('click',async()=>{
        await runTitleTranslation({
            items, list, ns, pBar, pLabel, pWrap, btnStop,
            onDone: () => {
                // Show the freshly translated titles right away
                if (!_eyeOn && eyeBtn) eyeBtn.click();
                else applyEyeMode();
            },
        });
    });
    btnStop?.addEventListener('click',()=>{requestStop();});
    page.querySelector(`#${idPfx}-clr`).addEventListener('click',()=>{
        // Respect selection: if items selected, clear only those; otherwise clear all loaded
        const selectedIds = [...list.querySelectorAll('.pt-block-item.selected')].map(el=>el.dataset.id).filter(Boolean);
        const targetIds = selectedIds.length ? selectedIds : items.map(i=>i.id);
        const scope = selectedIds.length ? `선택한 ${selectedIds.length}개 항목` : `로드된 전체 ${items.length}개 항목`;
        if(!confirm(`${scope}의 번역 캐시를 비울까요?`)) return;
        clearNS(ns, targetIds);
        // Update UI: reset translated text only for cleared items
        const targetSet = new Set(targetIds);
        list.querySelectorAll('.pt-block-item').forEach(el => {
            if (!targetSet.has(el.dataset.id)) return;
            const trEl = el.querySelector('.pt-translated-text');
            if (trEl) trEl.innerHTML = '<span class="pt-no-trans">번역 전</span>';
        });
    });

    // ── Export: Copy ──────────────────────────────────────────────────
    page.querySelector(`#${idPfx}-copy`)?.addEventListener('click', async () => {
        if (!items.length) { if (typeof toastr!=='undefined') toastr.warning('로드된 데이터가 없습니다'); return; }
        const checkedCount = page.querySelectorAll('.pt-block-item.selected').length;
        if (checkedCount === 0) {
            if (typeof toastr!=='undefined') toastr.warning('복사할 항목을 먼저 선택해주세요');
            return;
        }
        const targets = collectTargetItems(page, items, idPfx, ns);
        const choice = await askTextChoice('어떤 내용을 복사할까요?');
        if (!choice) return;
        const text = formatItemsAsText(targets, choice);
        const ok = await copyTextToClipboard(text);
        if (typeof toastr!=='undefined') {
            ok ? toastr.success(`${targets.length}개 항목 복사됨`) : toastr.error('복사 실패');
        }
    });

    // ── Export: TXT ───────────────────────────────────────────────────
    page.querySelector(`#${idPfx}-txt`)?.addEventListener('click', async () => {
        if (!items.length) { if (typeof toastr!=='undefined') toastr.warning('로드된 데이터가 없습니다'); return; }
        const checkedCount = page.querySelectorAll('.pt-block-item.selected').length;
        if (checkedCount === 0) {
            if (typeof toastr!=='undefined') toastr.warning('내보낼 항목을 먼저 선택해주세요');
            return;
        }
        const targets = collectTargetItems(page, items, idPfx, ns);
        const choice = await askTextChoice('어떤 내용을 내보낼까요?');
        if (!choice) return;
        const text = formatItemsAsText(targets, choice);
        const srcName = getSourceName(kind, page, idPfx);
        const suffix = choice === 'original' ? 'original' : (choice === 'translated' ? effLang() : `${effLang()}_bilingual`);
        const filename = `${sanitizeFilename(srcName)}_${suffix}.txt`;
        downloadBlob(new Blob([text], {type:'text/plain;charset=utf-8'}), filename);
        if (typeof toastr!=='undefined') toastr.success(`${filename} 다운로드됨`);
    });

    // ── Export: JSON ──────────────────────────────────────────────────
    page.querySelector(`#${idPfx}-json`)?.addEventListener('click', async () => {
        if (!items.length) { if (typeof toastr!=='undefined') toastr.warning('로드된 데이터가 없습니다'); return; }
        try {
            const srcSel = page.querySelector(`#${idPfx}-sel`);
            const srcVal = srcSel?.value || '';

            // Build set of selected item ids (for partial export in WI/char)
            const checkedIds = new Set(
                Array.from(page.querySelectorAll('.pt-block-item.selected'))
                    .map(el => el.dataset.id)
                    .filter(Boolean)
            );

            let result;
            if (kind === 'preset' || kind === 'wi') {
                const mode = await askChoice('어떤 형식으로 내보낼까요?', [
                    { v: 'data',   label: kind === 'wi' ? 'ST 월드인포 JSON' : 'ST 프리셋 JSON' },
                    { v: 'script', label: 'JS Runner 제목 번역 스크립트' },
                ]);
                if (!mode) return;
                if (mode === 'script') {
                    const r = exportTitleScript(kind, srcVal, items, ns);
                    const blob = new Blob([JSON.stringify(r.data, null, 2)], {type:'application/json;charset=utf-8'});
                    downloadBlob(blob, r.filename);
                    if (typeof toastr!=='undefined') {
                        const skipMsg = r.skipped ? `, 미번역 ${r.skipped}개 제외` : '';
                        toastr.success(`${r.filename} 다운로드됨 (제목 ${r.count}개${skipMsg})`);
                    }
                    return;
                }
            }
            if (kind === 'preset') {
                // Preset: always full export (structure integrity)
                result = exportPresetJSON(srcVal);
            } else if (kind === 'wi') {
                // WI: partial selection supported
                result = await exportWorldInfoJSON(srcVal, checkedIds);
            } else if (kind === 'char') {
                // Character: partial field selection supported
                const includeCB = confirm('캐릭터 카드에 임베디드 월드북(character_book)이 포함되어 있는 경우, JSON에 함께 포함할까요?\n\n[확인] = 포함 (원문 그대로)\n[취소] = 제외\n\n※ 임베디드 월드북의 내용은 번역되지 않고 원문 그대로 저장됩니다.');
                result = await exportCharacterJSON(srcVal, { includeCharacterBook: includeCB }, checkedIds);
            }
            if (!result) return;
            const blob = new Blob([JSON.stringify(result.data, null, 2)], {type:'application/json;charset=utf-8'});
            downloadBlob(blob, result.filename);
            if (typeof toastr!=='undefined') {
                let scopeMsg = '';
                if (kind === 'wi' && checkedIds.size > 0) scopeMsg = ` (선택한 ${checkedIds.size}개 엔트리)`;
                else if (kind === 'char' && checkedIds.size > 0) scopeMsg = ` (선택한 ${checkedIds.size}개 필드)`;
                toastr.success(`${result.filename} 다운로드됨${scopeMsg}`);
            }
        } catch (err) {
            console.error(`[${EXT}] JSON export failed`, err);
            if (typeof toastr!=='undefined') toastr.error('JSON 내보내기 실패: ' + (err?.message || err));
        }
    });

    // ── Translation Memory (TM): export ─────────────────────────────────
    // A portable file (original title/content + translated title/content),
    // independent of the translation cache and of this item's
    // identifier — so it survives moving to another device/browser, and
    // survives the source (preset/WI/character) being updated to a new
    // version with different internal ids, as long as the title or content
    // text is still recognizably the same.
    // scope: 'full'  → 제목 + 본문(주석 포함) 번역을 모두 내보낸다.
    //        'title' → 제목 번역만 내보낸다. 원문 name/content는 매칭 키로
    //                  남겨두되 contentTranslated는 절대 쓰지 않는다.
    function exportTM(scope) {
        const titleOnlyExport = scope === 'title';
        if (!items.length) { if (typeof toastr!=='undefined') toastr.warning('로드된 데이터가 없습니다'); return; }
        const entries = [];
        for (const it of items) {
            const name = (it.name || '').trim();
            const content = (it.content || '').trim();
            // Preset regex scripts are title-only: their "content" is a regex
            // pattern, so no body translation is ever exported for them.
            const isTitleOnly = !!it.titleOnly;
            const full = (isTitleOnly || titleOnlyExport) ? null : getCached(ns, it.id);
            const contentTranslated = full ? splitTitleAndBody(full).body.trim() : '';
            const titleRaw = getTranslatedTitle(ns, it.id);
            const nameTranslated = (titleRaw && titleRaw.trim() && titleRaw.trim() !== name) ? titleRaw.trim() : '';
            if (!contentTranslated && !nameTranslated) continue; // nothing translated for this item
            // id는 "같은 프리셋을 그대로 재가져오기" 했을 때 100% 정확한 매칭을 위해 함께 저장.
            // (동일 프리셋 안에서는 identifier가 항상 고유하므로, 서로 다른 블록이
            //  우연히 같은 content/title 텍스트를 가져도 id로는 절대 모호해지지 않는다.)
            // id가 없는 옛 TM 파일이나 프리셋이 갱신되어 id가 바뀐 경우를 위해
            // content/name 매칭은 그대로 폴백으로 남겨둔다.
            // content(원문 본문)는 본문 번역을 실제로 담고 있는 항목에만 넣는다.
            // 가져오기 때 "원문이 정말 같은지" 대조하기 위한 키이므로, 본문 번역이
            // 없는 항목(제목만 내보내기 / 제목만 번역된 항목)에는 쓸모가 없고
            // 파일만 원문 전체만큼 부풀린다.
            const entry = { id: it.id, name };
            if (contentTranslated) entry.content = content;
            if (isTitleOnly) entry.titleOnly = true;
            if (nameTranslated) entry.nameTranslated = nameTranslated;
            if (contentTranslated) entry.contentTranslated = contentTranslated;
            entries.push(entry);
        }
        if (!entries.length) {
            if (typeof toastr!=='undefined') toastr.warning(titleOnlyExport ? '내보낼 제목 번역이 없습니다' : '내보낼 번역이 없습니다');
            return;
        }
        const srcName = getSourceName(kind, page, idPfx);
        // Everything here is load-bearing: `type` validates the file, `kind`
        // rejects a memory exported from a different source type, `version` is
        // the escape hatch if the entry shape ever changes. Source name and
        // language live in the filename; export time was never read by anything.
        const payload = { type: 'prompt-panel-tm', version: 1, kind, entries };
        const label = titleOnlyExport ? '[번역 메모리-제목]' : '[번역 메모리]';
        const filename = `${label} ${sanitizeFilename(srcName)}.json`;
        downloadBlob(new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'}), filename);
        if (typeof toastr!=='undefined') toastr.success(`번역 메모리 ${entries.length}개 항목 내보냄 (${filename})`);
    }

    // ── Translation Memory (TM): import ─────────────────────────────────
    // Matches each currently-loaded item to a TM entry in three passes:
    //   1) exact id match   2) exact original content   3) exact original title
    // For passes 2 and 3, a key that maps to more than one TM entry is
    // ambiguous and is skipped entirely rather than risking a wrong match.
    //
    // A candidate found this way is then VERIFIED before anything is written,
    // because an id is not globally unique — world-info uids are small integers
    // scoped to a book name ("내 책::0") and preset system toggles all share
    // 'main'/'jailbreak'/… , so a TM someone else shared can land on a totally
    // unrelated entry. The body is written only when the TM's stored original
    // text is identical to the current one; the title only when the names agree
    // (or the body already verified). A mismatch loses part of the import — it
    // never writes the wrong translation.
    const tmFileInput = page.querySelector(`#${idPfx}-tmfile`);
    function importTM() {
        if (!items.length) { if (typeof toastr!=='undefined') toastr.warning('먼저 데이터를 로드하세요'); return; }
        tmFileInput?.click();
    }

    // ── Translation Memory (TM): single entry-point button ─────────────
    // One toolbar button covers both directions; askChoice() shows a modal
    // (same style as the copy/export "원문만 / 번역문만 / 둘 다" picker)
    // so the person picks export vs. import each time they click it.
    page.querySelector(`#${idPfx}-tm`)?.addEventListener('click', async () => {
        const choice = await askChoice('번역 메모리에 대해 어떤 작업을 할까요?', [
            { v: 'title',  label: '제목만 내보내기' },
            { v: 'full',   label: '전체 내보내기' },
            { v: 'import', label: '메모리 가져오기' },
        ]);
        if (!choice) return;
        if (choice === 'title' || choice === 'full') exportTM(choice);
        else if (choice === 'import') importTM();
    });

    tmFileInput?.addEventListener('change', async (ev) => {
        const file = ev.target.files?.[0];
        ev.target.value = ''; // allow re-selecting the same file later
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data || data.type !== 'prompt-panel-tm' || !Array.isArray(data.entries)) {
                throw new Error('번역 메모리 파일 형식이 아닙니다');
            }
            // A memory exported from a different source type can only ever
            // mismatch here — say so instead of reporting "0개 매칭".
            if (data.kind && data.kind !== kind) {
                const nameOf = k => k === 'wi' ? '월드인포' : k === 'char' ? '봇카드' : '프리셋';
                throw new Error(`${nameOf(data.kind)} 번역 메모리입니다 (지금 탭은 ${nameOf(kind)})`);
            }
            const byId = new Map(), byContent = new Map(), byName = new Map();
            const dupContent = new Set(), dupName = new Set();
            for (const e of data.entries) {
                const c = (e?.content || '').trim(), n = (e?.name || '').trim();
                // id가 있는 항목은 최우선 매칭 키로 사용 (동일 프리셋 재가져오기 시 항상 고유 → 절대 모호해지지 않음)
                if (e && e.id != null && e.id !== '') byId.set(String(e.id), e);
                if (c) { if (byContent.has(c)) dupContent.add(c); else byContent.set(c, e); }
                if (n) { if (byName.has(n)) dupName.add(n); else byName.set(n, e); }
            }

            let applied = 0, skipped = 0, staleBody = 0;
            for (const it of items) {
                const original = (it.content || '').trim();
                const name = (it.name || '').trim();
                let match = null;
                // 후보 찾기 — id → 원문 → 제목 순. 여기서는 "어떤 항목일 가능성이
                // 높은가"만 고르고, 실제로 무엇을 쓸지는 아래 검증이 결정한다.
                if (it.id != null && byId.has(String(it.id))) match = byId.get(String(it.id));
                if (!match && original && byContent.has(original) && !dupContent.has(original)) match = byContent.get(original);
                if (!match && name && byName.has(name) && !dupName.has(name)) match = byName.get(name);
                if (!match) { skipped++; continue; }

                // ── 검증: 본문과 제목을 따로 판정한다 ──────────────────────
                // id는 전역 고유가 아니다. 월드인포 uid는 책 이름 안에서만 유일한
                // 작은 정수("내 책::0")이고, 프리셋 시스템 토글은 모든 프리셋이
                // 'main'/'jailbreak' 같은 같은 id를 쓴다. 그래서 남이 공유한 TM이
                // 전혀 다른 항목에 id로 걸릴 수 있다.
                //   본문 번역 → TM이 들고 있는 원문이 지금 원문과 정확히 같을 때만.
                //               (다르면 그 번역은 이미 없는 글을 옮긴 것이다)
                //   제목 번역 → 제목이 같거나, 위 원문 대조를 통과했을 때만.
                // 어긋나면 "덜 적용"될 뿐, 엉뚱한 번역이 조용히 들어가지 않는다.
                const tmContent = (match.content || '').trim();
                const bodyVerified  = !!tmContent && tmContent === original;
                const titleVerified = bodyVerified || (!!name && (match.name || '').trim() === name);

                const hasBodyRaw = !!(match.contentTranslated && match.contentTranslated.trim());
                const hasBody  = hasBodyRaw && bodyVerified;
                const hasTitle = !!(match.nameTranslated && match.nameTranslated.trim()) && titleVerified;
                if (hasBodyRaw && !bodyVerified) staleBody++;
                if (!hasBody && !hasTitle) { skipped++; continue; }

                // Preset regex scripts only ever take the title. A body in the
                // file (an older export, or a hand-edited one) is ignored —
                // writing it would put translated prose where a regex pattern
                // belongs.
                if (it.titleOnly) {
                    if (!hasTitle) { skipped++; continue; }
                    setCacheTitle(ns, it.id, match.nameTranslated.trim());
                    applied++;
                    continue;
                }

                if (hasBody) {
                    // Store in the same "### {title}\n\n{body}" shape a real
                    // translation run produces, so every reader of the cache
                    // (JSON export, live-apply, , etc.) sees a normal entry.
                    const heading = hasTitle ? match.nameTranslated.trim() : name;
                    setCache(ns, it.id, `### ${heading}\n\n${match.contentTranslated.trim()}`);
                    clearCachedTitle(ns, it.id);
                } else {
                    setCacheTitle(ns, it.id, match.nameTranslated.trim());
                }
                applied++;
            }

            renderList();
            try { updateCacheStatsUI(); } catch (e) {}
            if (typeof toastr!=='undefined') {
                const dupNote = (dupContent.size || dupName.size) ? ' (중복된 원문/제목 일부는 안전을 위해 건너뜀)' : '';
                const staleNote = staleBody ? ` · 원문이 달라 본문 번역 ${staleBody}개는 적용하지 않음` : '';
                if (applied) toastr.success(`번역 메모리 적용: ${applied}개 매칭, ${skipped}개 매칭 실패${staleNote}${dupNote}`);
                else toastr.warning(`매칭되는 항목이 없습니다 (${skipped}개 미매칭)${staleNote}${dupNote}`);
            }
        } catch (err) {
            console.error(`[${EXT}] TM import failed`, err);
            if (typeof toastr!=='undefined') toastr.error('번역 메모리 가져오기 실패: ' + (err?.message || err));
        }
    });

    // ── Apply Live (writes into ST directly, no file round-trip) ──────
    // Preset  → the preset file (always the whole preset, to keep it intact)
    // WI      → the world-info book (selected entries only, if any selected)
    // 봇카드  → the character PNG   (selected fields only, if any selected)
    page.querySelector(`#${idPfx}-apply`)?.addEventListener('click', async () => {
        if (!items.length) { if (typeof toastr!=='undefined') toastr.warning('로드된 데이터가 없습니다'); return; }
        const srcSel = page.querySelector(`#${idPfx}-sel`);
        const srcVal = srcSel?.value || '';
        const label = getSourceName(kind, page, idPfx);

        const checkedIds = new Set(
            Array.from(page.querySelectorAll('.pt-block-item.selected'))
                .map(el => el.dataset.id)
                .filter(Boolean)
        );
        const kindLabel = kind === 'wi' ? '월드인포' : kind === 'char' ? '봇카드' : '프리셋';
        let scopeLine;
        if (kind === 'preset') {
            scopeLine = '모든 토글 (선택 불가)';
        } else if (checkedIds.size) {
            scopeLine = `선택한 ${checkedIds.size}개`;
        } else {
            scopeLine = `로드된 전체 ${items.length}개`;
        }

        // 봇카드는 번역 대상이 필드 본문뿐이라 "제목만"이라는 개념이 없다.
        let titlesOnly = false;
        if (kind !== 'char') {
            const scope = await askChoice(` "${label}" ${kindLabel}에 무엇을 적용할까요?`, [
                { v: 'title', label: ' 제목만 적용 (원문 보존)' },
                { v: 'all',   label: ' 모두 적용 (제목 + 본문)' },
            ]);
            if (!scope) return;
            titlesOnly = scope === 'title';
        }

        // 봇카드는 제목이라는 게 없으므로 "제목 + 본문"이라고 쓰면 사실과 다르다.
        const whatLine = kind === 'char'
            ? '본문'
            : (titlesOnly ? '제목만 (본문 원문 유지)' : '제목 + 본문');
        const ok = confirm(
            `"${label}" ${kindLabel}에 번역을 적용합니다.\n\n` +
            `적용 대상: ${whatLine}\n` +
            `범위: ${scopeLine}\n\n` +
            `파일을 덮어쓰며 되돌릴 수 없습니다.`
        );
        if (!ok) return;

        try {
            if (kind === 'preset') {
                const r = await applyPresetLive(srcVal, titlesOnly);
                if (typeof toastr!=='undefined') {
                    const note = r.isCurrent ? '' : ' — 현재 로드된 프리셋이 아니라 화면엔 반영되지 않음, 다음에 불러올 때 적용된 내용이 보입니다';
                    const extras = [
                        r.regexRenamed  ? `정규식 ${r.regexRenamed}개`  : '',
                        r.groupRenamed  ? `그룹 ${r.groupRenamed}개`    : '',
                        r.runnerRenamed ? `JS러너 ${r.runnerRenamed}개` : '',
                    ].filter(Boolean).join(' · ');
                    const rx = extras ? ` · ${extras}` : '';
                    toastr.success(`"${r.targetName}"에 적용됨 (${r.applied}개 필드${rx})${note}`);
                    if (r.regexRenamed) {
                        toastr.info('정규식 이름은 확장 > 정규식 창을 다시 열면 새 이름으로 보입니다');
                    }
                    // These belong to other extensions, which cache their own
                    // copy keyed by preset name — they re-read it when the
                    // preset is re-selected.
                    if (r.groupReloadFailed) {
                        toastr.warning(
                            '그룹명을 저장했지만 ST-BaiBai-Tools 캐시를 새로 읽게 하지 못했습니다. ' +
                            '되돌아갈 수 있으니, 그 프리셋을 선택하지 않은 상태에서 다시 적용하세요.',
                            '', { timeOut: 12000 }
                        );
                    } else if (r.isCurrent && r.runnerRenamed && !r.runnerLiveUpdated) {
                        toastr.info('JS러너 이름은 프리셋을 바꿨다 돌아오면 새 이름으로 보입니다');
                    }
                }
            } else if (kind === 'wi') {
                const r = await applyWorldInfoLive(srcVal, checkedIds, titlesOnly);
                if (typeof toastr!=='undefined') {
                    toastr.success(`"${r.targetName}"에 적용됨 (엔트리 ${r.entries}개 · ${r.applied}개 필드)`);
                }
            } else if (kind === 'char') {
                const r = await applyCharacterLive(srcVal, checkedIds);
                if (typeof toastr!=='undefined') {
                    const note = r.isCurrent ? ' — 편집창에 바로 안 보이면 캐릭터를 다시 선택하세요' : '';
                    toastr.success(`"${r.targetName}"에 적용됨 (${r.applied}개 필드)${note}`);
                }
            }
        } catch (err) {
            console.error(`[${EXT}] live apply failed (${kind})`, err);
            if (typeof toastr!=='undefined') toastr.error('즉시 적용 실패: ' + (err?.message || err));
        }
    });
}

// Collect items: selected ones if any, else all
function collectTargetItems(page, items, idPfx, ns) {
    const checked = Array.from(page.querySelectorAll('.pt-block-item.selected'))
        .map(el => el.dataset.id)
        .filter(Boolean);
    const sourceList = checked.length > 0
        ? items.filter(i => checked.includes(String(i.id)))
        : items;
    // Attach _ns to each item for formatter
    return sourceList.map(i => ({ ...i, _ns: ns }));
}

// Get the source name (preset/world/char name) from the select box
function getSourceName(kind, page, idPfx) {
    const sel = page.querySelector(`#${idPfx}-sel`);
    if (!sel) return 'untitled';
    const opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) {
        // current
        if (kind === 'preset') return oai_settings?.preset_settings_openai || 'preset';
        return 'current';
    }
    return opt.textContent || opt.value || 'untitled';
}

// ── Panel ──────────────────────────────────────────────────────────────
function dockPanel() {
    const panel = PDOC.getElementById('pt-panel');
    const host = PDOC.getElementById('pt-drawer-host');
    if (!panel || !host) return;
    host.append(panel);
    panel.classList.remove('pt-hidden');
    panel.classList.add('pt-in-drawer');
    syncDrawerPages();
}
let drawerPagesVisible = null;
function syncDrawerPages() {
    const panel = PDOC.getElementById('pt-panel');
    if (!panel?.classList.contains('pt-in-drawer')) return;
    const visible = !!panel.getClientRects().length;
    if (visible === drawerPagesVisible) return;
    drawerPagesVisible = visible;
    if (visible) wakePages();
    else sleepPages();
}
export function openPanel() {
    const panel = PDOC.getElementById('pt-panel');
    if (!panel) return;
    PDOC.body.append(panel);
    panel.classList.remove('pt-hidden', 'pt-in-drawer');
    drawerPagesVisible = null;
    wakePages();
    panel.dispatchEvent(new Event('pt:opened'));
}
function closePanel() {
    dockPanel();
    PDOC.getElementById('pt-choice-modal')?.remove();
}

// Shows the model configured in the extension settings next to the status
// text. This is a straight read of the saved setting — no live detection.
function updateStatusModel() {
    const el = PDOC.getElementById('pt-status-model');
    if (!el) return;
    const c = cfg();
    let model;
    if(c.connectionMode==='current') { model='현재 연결 따라가기'; } else if (usingStProfile()) {
        const pr = listStProfiles().find(x => x.id === c.stProfileId);
        model = pr ? `프로필: ${pr.name}` : '프로필 미선택';
    } else {
        model = (c.model === '__custom__' ? (c.customModelName || '') : (c.model || '')).trim();
    }
    el.textContent = model ? `· ${model}` : '';
    el.title = model || '';
}

function applyFontSizes() {
    const p = PDOC.getElementById('pt-panel');
    if (!p) return;
    const c = cfg();
    p.style.setProperty('--pt-original-size', (c.originalFontSize || 11) + 'px');
    p.style.setProperty('--pt-translated-size', (c.translatedFontSize || 12) + 'px');
}

function buildPanel() {
    PDOC.getElementById('pt-panel')?.remove();
    const panel=PDOC.createElement('div');
    panel.id='pt-panel';
    panel.classList.add('pt-hidden');
    panel.setAttribute('data-pt-theme', cfg().theme||'dark');
    // 글자 크기 CSS 변수 주입
    const _c = cfg();
    panel.style.setProperty('--pt-original-size', (_c.originalFontSize || 11) + 'px');
    panel.style.setProperty('--pt-translated-size', (_c.translatedFontSize || 12) + 'px');
    panel.innerHTML=`
        <div id="pt-panel-header">
            <h3>한글화 패널</h3>
            <div style="display:flex;align-items:center;gap:4px;">
                <button id="pt-panel-refresh" aria-label="목록 새로고침"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i><span>목록 새로고침</span></button>
                <button id="pt-panel-close" aria-label="닫기"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </div>
        </div>
        <div id="pt-tabs">
            <button class="pt-tab active" data-tab="preset">프리셋</button>
            <button class="pt-tab" data-tab="wi">월드인포</button>
            <button class="pt-tab" data-tab="char">봇카드</button>
        </div>
        <div id="pt-panel-content">
            <div class="pt-page active" id="pt-page-preset"></div>
            <div class="pt-page"        id="pt-page-wi"></div>
            <div class="pt-page"        id="pt-page-char"></div>
        </div>
        <div id="pt-statusbar">
            <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                <div class="pt-status-dot" id="pt-status-dot"></div>
                <span id="pt-status-text">대기 중</span>
                <span class="pt-status-model" id="pt-status-model"></span>
            </div>
        </div>`;
    PDOC.body.appendChild(panel);

    panel.querySelectorAll('.pt-tab').forEach(tab=>tab.addEventListener('click',()=>{
        panel.querySelectorAll('.pt-tab').forEach(t=>t.classList.remove('active'));
        panel.querySelectorAll('.pt-page').forEach(p=>p.classList.remove('active'));
        tab.classList.add('active');
        panel.querySelector(`#pt-page-${tab.dataset.tab}`).classList.add('active');
    }));
    updateStatusModel();
    panel.querySelector('#pt-panel-close').addEventListener('click',closePanel);

    // Refresh button: rebuild select dropdowns only. Loaded items and translation cache are untouched.
    panel.querySelector('#pt-panel-refresh').addEventListener('click', async () => {
        try {
            // Re-import modules to get the latest references.
            // ST may reassign these collections (not just mutate them) when
            // presets/world info/characters are added or removed, so our
            // captured references can become stale. Re-importing forces ESM
            // to give us the current live bindings.
            try { await initImports(); } catch (impErr) {
                console.warn(`[${EXT}] refresh: re-import failed, falling back to cached refs`, impErr);
            }

            // Same refill each page runs on build (keeps the selection, re-syncs the combo).
            await Promise.all(['pt-preset', 'pt-wi', 'pt-char']
                .map(idPfx => panel.querySelector(`#${idPfx}-sel`)?._ptRefill?.()));
            if (typeof toastr !== 'undefined') toastr.success('목록을 새로고침했습니다');
        } catch (e) {
            console.error(`[${EXT}] refresh failed`, e);
            if (typeof toastr !== 'undefined') toastr.error('새로고침 실패');
        }
    });

    buildPage({page:panel.querySelector('#pt-page-preset'),idPfx:'pt-preset',listFn:listAllPresets,loadFn:readPresetBlocks,selectable:true,icon:'',hint:'프리셋을 선택하고 로드하세요.',isAsync:false,kind:'preset'});
    buildPage({page:panel.querySelector('#pt-page-wi'),idPfx:'pt-wi',listFn:listAllWorldInfos,loadFn:readWorldInfo,selectable:true,icon:'',hint:'월드인포를 선택하고 로드하세요.',isAsync:true,kind:'wi'});
    buildPage({page:panel.querySelector('#pt-page-char'),idPfx:'pt-char',listFn:listAllCharacters,loadFn:readCharCard,selectable:true,icon:'',hint:'캐릭터를 선택하고 로드하세요.',isAsync:true,kind:'char'});

    try { const cur=getCurrentPresetName(); if(cur)panel.querySelector('#pt-preset-sel').value=cur; } catch(e){}
    try {
        const ctx=SillyTavern.getContext();
        const cid=ctx.characterId;
        if (cid != null) {
            const ch = ctx.characters?.[cid] || characters?.[cid];
            const avatar = ch?.avatar;
            if (avatar) panel.querySelector('#pt-char-sel').value = avatar;
        }
    } catch(e){}

    // 패널 내 CSS 로드
    if (CSS_URL && !Array.from(PDOC.querySelectorAll('link[rel="stylesheet"]')).some(link=>link.href===CSS_URL)) {
        const link=PDOC.createElement('link');
        link.id='pt-panel-css'; link.rel='stylesheet'; link.href=CSS_URL;
        PDOC.head.appendChild(link);
    }
}

// ── Settings HTML ──────────────────────────────────────────────────────
function buildSettingsHTML() {
 const c=cfg();
 const choices=[['Korean','한국어'],['English','English'],['Japanese','日本語'],['Chinese (Simplified)','简体中文'],['Chinese (Traditional)','繁體中文'],['Polish','Polski'],['__custom__','직접 입력']];
 const languages=current=>choices.map(([value,label])=>`<option value="${value}" ${value===current?'selected':''}>${label}</option>`).join('');
 return settingsHTML({c,esc,languages,providers:PROVIDER_LIST.map(p=>`<option value="${p.key}" ${p.key===c.provider?'selected':''}>${p.label}</option>`).join(''),models:'',profiles:buildProfileOptions()});
}

// Options for the ST 프로필 picker. An empty Connection Manager (or an ST too
// old to expose one) yields a single disabled row rather than a silent blank.
function buildProfileOptions() {
    const c = cfg();
    const profiles = listStProfiles();
    if (!profiles.length) {
        return '<option value="">(사용 가능한 연결 프로필 없음)</option>';
    }
    const cur = c.stProfileId || '';
    let html = `<option value="" ${cur?'':'selected'}>— 프로필 선택 —</option>`;
    for (const pr of profiles) {
        const detail = pr.model ? ` (${pr.model})` : '';
        html += `<option value="${esc(pr.id)}" ${cur===pr.id?'selected':''}>${esc(pr.name + detail)}</option>`;
    }
    return html;
}

// A profile owns the model, sampling and proxy, so those controls are hidden
// rather than left showing values that no longer affect anything.
function applyProviderModeUI() {
 const c=cfg(),mode=c.connectionMode;
 for(const [id,on] of Object.entries({'pt-current-hint':mode==='current','pt-current-options':mode==='current','pt-profile-settings':mode==='profile','pt-direct-settings':mode==='direct','pt-custom-endpoint':c.provider==='custom','pt-proxy-toggle-row':c.provider!=='custom','pt-proxy-wrap':c.provider!=='custom'&&c.useReverseProxy})) {
  const el=document.getElementById(id);if(el)el.style.display=on?'':'none';
 }
 if(mode==='profile')document.getElementById('pt-profile-select').innerHTML=buildProfileOptions();
}

function updateModelDropdown() {
    const c=cfg(), prov=c.provider||'openai';
    const sel=document.getElementById('pt-model-select'); if(!sel) return;
    const models=prov==='custom'?(c.customModelLists?.[customEndpoint(c,oai_settings).url]||[]):(PROVIDER_MODELS[prov]||[]), current=c.model||'';
    let html='<option value="">모델 선택...</option>';
    models.forEach(m=>{html+=`<option value="${m}" ${current===m?'selected':''}>${m}</option>`;});
    if(current && current!=='__custom__' && !models.includes(current))html+=`<option value="${esc(current)}" selected>${esc(current)}</option>`;
    html+=`<option value="__custom__" ${current==='__custom__'?'selected':''}> 커스텀 모델 입력</option>`;
    sel.innerHTML=html;
    const cr=document.getElementById('pt-custom-model-row'); if(cr)cr.style.display=(current==='__custom__')?'':'none';
}

function updateCacheStatsUI() {
    const el = document.getElementById('pt-cache-stats');
    if (!el) return;
    const { count, sizeStr } = getCacheStats();
    el.textContent = `${count.toLocaleString()}개 · ${sizeStr}`;
}

function buildParamsUI() {
    const wrap=document.getElementById('pt-params-wrap'); if(!wrap) return;
    const {provider,params}=getCurrentParams(), defaults=DEFAULT_PARAMS[provider]||DEFAULT_PARAMS.openai, keys=Object.keys(defaults);
    let html='';
    keys.forEach(k=>{
        const range=PARAM_RANGES[k]||{min:0,max:1,step:0.01}, val=params[k]??defaults[k];
        html+=`<div class="pt-param-row"><label class="pt-param-label">${PARAM_LABELS[k]||k}</label><input aria-label="${PARAM_LABELS[k]||k} 조절" type="range" class="pt-param-slider" data-pkey="${k}" min="${range.min}" max="${range.max}" step="${range.step}" value="${val}"><input aria-label="${PARAM_LABELS[k]||k}" type="number" class="pt-param-num" data-pkey="${k}" min="${range.min}" max="${range.max}" step="${range.step}" value="${val}"></div>`;
    });
    html+=`<button class="pt-ui-button" id="pt-params-reset" >기본값으로 재설정</button>`;
    wrap.innerHTML=html;
    wrap.querySelectorAll('.pt-param-slider,.pt-param-num').forEach(el=>{
        el.addEventListener('input',()=>{
            const k=el.dataset.pkey, v=parseFloat(el.value), {params}=getCurrentParams();
            params[k]=v;
            wrap.querySelectorAll(`[data-pkey="${k}"]`).forEach(o=>{if(o!==el)o.value=v;});
            saveSettingsDebounced();
        });
    });
    document.getElementById('pt-params-reset')?.addEventListener('click',()=>{
        const {provider}=getCurrentParams(); cfg().parameters[provider]={...DEFAULT_PARAMS[provider]}; saveSettingsDebounced(); buildParamsUI();
    });
}

// ── Init ───────────────────────────────────────────────────────────────
// true when another Prompt Panel (standalone install under any folder name)
// already built its UI — we then stay dormant so the two never fight over
// the same cache files.
export let duplicate = false;
export const ready = new Promise((resolve,reject)=>{ jQuery(async()=>{ try {
    if (PDOC.getElementById('pt-panel') || PDOC.getElementById('pt-provider')) {
        duplicate = true;
        console.warn(`[${EXT}] another Prompt Panel is already running — built-in copy stays dormant`);
        resolve();
        return;
    }
    console.log(`[${EXT}] init start`);
    try { await initImports(); } catch(e) { console.error(`[${EXT}] initImports failed`, e); throw e; }
    console.log(`[${EXT}] imports OK`);

    try {
        $('#extensions_settings').append(buildSettingsHTML());
    } catch(e) {
        console.error(`[${EXT}] buildSettingsHTML failed`, e);
        return;
    }
    if (CSS_URL && !Array.from(PDOC.querySelectorAll('link[rel="stylesheet"]')).some(link=>link.href===CSS_URL)) {
        $('<link>',{id:'pt-main-css',rel:'stylesheet',href:CSS_URL}).appendTo('head');
    }

    // Load the file-backed translation cache (migrates old IndexedDB data once)
    try { await initTranslationCache(); } catch(e) { console.warn(`[${EXT}] cache init failed, using in-memory only`, e); }
    // 이전 버전 잔여물 정리
    let _needsSave = false;
    if (cfg()._fabDiag !== undefined) { delete cfg()._fabDiag; _needsSave = true; }
    if (cfg().useMainApi !== undefined) { delete cfg().useMainApi; _needsSave = true; }
    if (_needsSave) saveSettingsDebounced();
    updateCacheStatsUI();

    const c=cfg();
    $('#pt-target-lang').on('change',function(){
        cfg().targetLang=this.value;
        saveSettingsDebounced();
        const isCustom = this.value === '__custom__';
        $('#pt-custom-lang-row').toggle(isCustom);
    });
    $('#pt-custom-lang').on('input',function(){cfg().customLang=this.value;saveSettingsDebounced();});
    $('#pt-title-lang').on('change',function(){
        cfg().titleLang=this.value; saveSettingsDebounced();
        $('#pt-custom-title-lang-row').toggle(this.value === '__custom__');
    });
    $('#pt-custom-title-lang').on('input',function(){cfg().titleCustomLang=this.value;saveSettingsDebounced();});
    $('#pt-note-lang').on('change',function(){
        cfg().noteLang=this.value; saveSettingsDebounced();
        $('#pt-custom-note-lang-row').toggle(this.value === '__custom__');
    });
    $('#pt-custom-note-lang').on('input',function(){cfg().noteCustomLang=this.value;saveSettingsDebounced();});
    $('#pt-title-batch').on('change',function(){
        let v = parseInt(this.value,10);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 50) v = 50;
        this.value = v;
        cfg().titleBatchSize = v; saveSettingsDebounced();
    });
    $('#pt-req-delay').on('change',function(){
        let v = parseInt(this.value,10);
        if (isNaN(v) || v < 0) v = 0;
        if (v > 60000) v = 60000;
        this.value = v;
        cfg().requestDelayMs = v; saveSettingsDebounced();
    });
    $('#pt-concurrency').on('change',function(){
        let v = parseInt(this.value,10);
        if (isNaN(v) || v < 1) v = 1;
        if (v > 8) v = 8;
        this.value = v;
        cfg().concurrency = v; saveSettingsDebounced();
    });
    $('#pt-max-retries').on('change',function(){
        let v = parseInt(this.value,10);
        if (isNaN(v) || v < 0) v = 0;
        if (v > 5) v = 5;
        this.value = v;
        cfg().maxRetries = v; saveSettingsDebounced();
    });
    $('#pt-req-timeout').on('change',function(){
        let v = parseInt(this.value,10);
        if (isNaN(v) || v < 5) v = 5;
        if (v > 600) v = 600;
        this.value = v;
        cfg().requestTimeoutMs = v * 1000; saveSettingsDebounced();
    });
    $('#pt-orig-size').on('input', function(){
        const v = parseInt(this.value, 10) || 11;
        cfg().originalFontSize = v;
        saveSettingsDebounced();
        const label = document.getElementById('pt-orig-size-val');
        if (label) label.textContent = v + 'px';
        applyFontSizes();
    });
    $('#pt-trans-size').on('input', function(){
        const v = parseInt(this.value, 10) || 12;
        cfg().translatedFontSize = v;
        saveSettingsDebounced();
        const label = document.getElementById('pt-trans-size-val');
        if (label) label.textContent = v + 'px';
        applyFontSizes();
    });
    $('#pt-provider').on('change',function(){
        cfg().provider=this.value;
        // Keep the previously chosen model when switching to 프로필 — switching
        // back should land on the same provider/model the person had set up.
        if (this.value !== ST_PROFILE) cfg().model=(PROVIDER_MODELS[this.value]||[])[0]||'';
        saveSettingsDebounced();
        if (this.value !== ST_PROFILE) { updateModelDropdown(); buildParamsUI(); }
        applyProviderModeUI();
        updateStatusModel();
    });
    $(document).on('change','#pt-profile-select',function(){cfg().stProfileId=this.value;saveSettingsDebounced();updateStatusModel();});
    // The Connection Manager list can change while the drawer sits open.
    $(document).on('mousedown','#pt-profile-select',function(){ const v=cfg().stProfileId||''; this.innerHTML=buildProfileOptions(); this.value=v; });
    $(document).on('change','#pt-model-select',function(){cfg().model=this.value;saveSettingsDebounced();const cr=document.getElementById('pt-custom-model-row');if(cr)cr.style.display=(this.value==='__custom__')?'':'none';updateStatusModel();});
    $(document).on('input','#pt-model-custom',function(){cfg().customModelName=this.value;saveSettingsDebounced();updateStatusModel();});
    $('#pt-use-proxy').on('change',function(){cfg().useReverseProxy=this.checked;saveSettingsDebounced();$('#pt-proxy-wrap').toggle(this.checked);});
    $(document).on('input','#pt-proxy-url',function(){cfg().reverseProxyUrl=this.value;saveSettingsDebounced();});
    $(document).on('input','#pt-proxy-pw',function(){cfg().reverseProxyPassword=this.value;saveSettingsDebounced();});
    $('#pt-prefill-toggle').on('change',function(){cfg().prefillEnabled=this.checked;saveSettingsDebounced();});
    $('#pt-prefill-text').on('input',function(){cfg().prefillText=this.value;saveSettingsDebounced();});
    $('#pt-clear-cache-btn').on('click', async () => {
        const { count, sizeStr } = getCacheStats();
        if (count === 0) {
            if (typeof toastr !== 'undefined') toastr.info('삭제할 번역 캐시가 없습니다');
            return;
        }
        const msg = ` 번역 데이터가 전부 삭제됩니다.\n\n현재 저장된 번역: ${count}개 (${sizeStr})\n\n이 작업은 되돌릴 수 없습니다.\n정말 삭제할까요?`;
        if (!confirm(msg)) return;
        await clearTranslationCache();
        if (typeof toastr !== 'undefined') toastr.success(`번역 캐시 ${count}개가 삭제되었습니다`);
        updateCacheStatsUI();
    });

    buildPanel();
    installLocalizationPage({doc:PDOC});
    let regexOwnsRequest=false;
    installRegexPage({doc:PDOC,cfg,save:saveSettingsDebounced,
        list:async()=>{const module=await import(new URL('../../../../../../extensions/regex/engine.js',import.meta.url).href);return module.getRegexScripts({allowedOnly:false});},
        translate:async(prompt)=>{if(isBusy)throw Error('다른 번역이 진행 중이에요. 완료 후 다시 시도해 주세요.');isBusy=true;regexOwnsRequest=true;stopReq=false;try{return await runCompletion([{role:'user',content:prompt}]);}finally{isBusy=false;regexOwnsRequest=false;}},
        cancel:()=>{if(regexOwnsRequest){stopReq=true;for(const controller of inFlight)controller.abort();}},
    });
    installGuide({doc:PDOC, cfg, save:saveSettingsDebounced, openPanel, closePanel});
    bindConnection({doc:PDOC,cfg,save:saveSettingsDebounced,host:oai_settings,extensions:extension_settings,headers:getRequestHeaders,models:PROVIDER_MODELS,escape:esc,refresh:()=>{updateModelDropdown();buildParamsUI();applyProviderModeUI();updateStatusModel();}});
    updateModelDropdown();buildParamsUI();applyProviderModeUI();

    dockPanel();
    const drawerContent = PDOC.getElementById('pt-drawer-host').parentElement;
    // Only the drawer content, its own .inline-drawer and #extensions_settings
    // change when the drawer opens/closes; watching every ancestor up to <html>
    // made each body class toggle (streaming etc.) flush layout via getClientRects.
    const drawerObserver = new MutationObserver(syncDrawerPages);
    const drawerWatch = new Set([drawerContent, drawerContent.closest('.inline-drawer'), PDOC.getElementById('extensions_settings')]);
    for (const el of drawerWatch) {
        if (el) drawerObserver.observe(el, {attributes:true, attributeFilter:['style','class']});
    }
    PDOC.querySelector('.pt-extension-settings .inline-drawer-toggle').addEventListener('click', () => {
        setTimeout(() => {
            dockPanel();
            const panel = PDOC.getElementById('pt-panel');
            if (panel.getClientRects().length) panel.dispatchEvent(new Event('pt:opened'));
        }, 0);
    });
    cfg().fabVisible=false; PDOC.getElementById('pt-fab')?.remove();
    console.log(`[${EXT}] loaded`);
    resolve();
    } catch(error) {reject(error);}
});});

export function mountInline(host){
 const text=document.createElement('p');text.className='salty-note';text.textContent='프리셋·월드인포·봇카드를 한 화면에서 읽고 번역해요. 버전 버튼에서 사용방법을 볼 수 있어요.';
 const button=document.createElement('button');button.type='button';button.className='salty-btn';button.textContent='한글화 패널 열기';button.onclick=openPanel;host.replaceChildren(text,button);return()=>host.replaceChildren();
}

// Model switch changes the shared config without triggering provider defaults.
window.addEventListener('bl:prompt-connection-changed', () => {
    if (!extension_settings || !document.getElementById('pt-provider')) return;
    const c = cfg();
    document.getElementById('pt-provider').value = c.provider;
    document.getElementById('pt-connection-mode').value = c.connectionMode;
    document.getElementById('pt-custom-url').value = c.customUrl || '';
    updateModelDropdown(); buildParamsUI(); applyProviderModeUI(); updateStatusModel();
});
