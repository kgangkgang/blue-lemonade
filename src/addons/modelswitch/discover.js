// 모델 전환 — 모르는 확장 자동으로 찾기 (1.0.5)
// 실리태번 모듈을 부르지 않는 순수 함수만 둔다 → tools/tests/modelswitch-detect.mjs 가 node 로 바로 시험한다.
//  1) 주인: 켜진 외부 확장의 소스(manifest 의 js + 그 파일이 부르는 같은 폴더의 모듈)에서 extension_settings 키를 만드는 곳을 찾아
//     '설정 키 → 확장 폴더'. 키 이름이 폴더 이름과 같으면 그대로(옛 방식). 주인이 없는 키(지운 확장이 남긴 설정)는 건드리지 않는다.
//  2) 연결: 그 키의 설정 안(깊이 4까지)에서 '공급자(실리태번 chat_completion_source 또는 그 별칭) + 공급자별 모델 표 · 공급자별 모델 칸 · 모델 한 칸'.
//     확장이 쓰는 이름(anthropic · gemini · OpenAI …)은 실리태번 공급자로 읽고, 쓸 때는 그 확장의 표기로 돌려 쓴다.
//  3) 대상: read/apply 는 공급자 · 모델 · 주소 칸과, 분명할 때만 연결 방식 칸을 쓴다. 다른 칸은 손대지 않는다.

const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const flat = text => String(text).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
/** camelCase · snake_case · kebab-case · 점을 낱말로 (소문자) */
export const words = text => String(text).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean);

// 실리태번 본체와 본체 내장 확장의 설정 키 — 외부 확장이 주인일 수 없다
export const CORE_KEYS = new Set(['apiUrl', 'apiKey', 'autoConnect', 'notifyUpdates', 'disabledExtensions', 'expressionOverrides', 'memory', 'note', 'caption',
    'expressions', 'connectionManager', 'dice', 'regex', 'regex_presets', 'character_allowed_regex', 'preset_allowed_regex', 'tts', 'sd', 'chromadb', 'translate',
    'objective', 'quickReply', 'quickReplyV2', 'randomizer', 'speech_recognition', 'rvc', 'hypebot', 'vectors', 'variables', 'attachments',
    'character_attachments', 'disabled_attachments', 'gallery', 'cfg', 'assets']);
// '실리태번 연결을 따른다'는 값 / '직접 고른 공급자로'라는 값
export const FOLLOW = new Set(['st', 'current', 'profile', 'follow', 'auto', 'sillytavern', 'main']);
const DIRECT = ['direct', 'provider', 'api'];
const PROVIDER_KEYS = ['provider', 'source', 'llm_provider', 'llmProvider', 'api_provider', 'apiProvider', 'chat_completion_source', 'chatCompletionSource',
    'api', 'engine_provider', 'engineProvider', 'api_source', 'apiSource'];
const MODEL_KEYS = ['model', 'llm_model', 'llmModel', 'model_name', 'modelName', 'model_id', 'modelId'];
const URL_KEYS = ['customUrl', 'custom_url', 'customURL'];
const MODE_KEYS = ['connection', 'connection_mode', 'connectionMode', 'apiMode', 'api_mode', 'connectionType', 'connection_type', 'engine', 'backend', 'mode'];
// 채팅 모델이 아닌 연결 (임베딩 · 그림 · 음성 합성 · 받아쓰기).
// 경로는 낱말 단위로 본다 (lastTurn 의 'stt', invoice 의 'voice' 같은 글자 속 일치로 진짜 연결을 버리지 않게). 모델 이름은 글자 속까지.
const NOT_CHAT_WORD = /^(embed\w*|vectors?|rerank\w*|images?|imagegen|img|dall-?e\d*|speech|voices?|tts|stt|whisper|captions?|captioning|transcri\w*|sd|diffusion|txt2img|img2img|t2i)$/;
const NOT_CHAT_MODEL = /embed|vector|rerank|image|dall-?e|speech|voice|tts|stt|whisper|caption|transcri|flux|sdxl|stable-?diffusion|midjourney|kokoro|eleven|playht|xtts|piper/i;
const notChatPath = segment => words(segment).some(word => NOT_CHAT_WORD.test(word));
// 모델 칸이 비어 있으면 공급자 이름만으로는 LLM 연결인지 모른다 (MiniMax · Pollinations 는 음성 · 그림도 한다) → 소스가 채팅 생성을 부를 때만
const CHAT_CALLS = /\/chat\/completions|chat-completions\/generate|\bgenerateRaw\b|\bgenerateQuietPrompt\b|\bChatCompletionService\b|\bsendOpenAIRequest\b/;
const MAX_KEYS = 200, MAX_DEPTH = 4, MAX_SPOTS = 4;
// 저장해 둔 여러 벌(프리셋 · 프로필 …)의 연결은 지금 쓰는 연결이 아니다 — 다른 자리가 있으면 뺀다
const COLLECTION = /^(profiles?|presets?|slots?|saved|history|backups?|templates?)$/i;

// 확장이 쓰는 공급자 이름 → 실리태번 공급자 (대소문자 무시). 쓸 때는 그 확장이 쓰던 표기로 돌려 쓴다
const ALIAS = { google: 'makersuite', gemini: 'makersuite', 'google-ai-studio': 'makersuite', google_ai_studio: 'makersuite', googleaistudio: 'makersuite', aistudio: 'makersuite',
    anthropic: 'claude', mistral: 'mistralai', vertex: 'vertexai', 'google-vertex': 'vertexai', 'x-ai': 'xai', azure: 'azure_openai', 'azure-openai': 'azure_openai' };
/** 값 → 실리태번 공급자 id ('' = 공급자 아님) */
export function sourceOf(value, sources) {
    if (typeof value !== 'string' || !value || value.length > 40) return '';
    if (sources.includes(value)) return value;
    const low = value.toLowerCase();
    if (sources.includes(low)) return low;
    const alias = ALIAS[low];
    return alias && sources.includes(alias) ? alias : '';
}
export const isSource = (value, sources) => !!sourceOf(value, sources);
// 실리태번 설정 꼴(chat_completion_source + claude_model …)의 공급자별 모델 칸 이름
const perKeyName = id => id === 'makersuite' ? 'google_model' : `${id}_model`;
function perKeysOf(node, sources) {
    return Object.keys(node).filter(key => typeof node[key] === 'string' && /^[\w-]+_model$/.test(key) && isSource(key.slice(0, -6), sources));
}

function isMap(value, sources) {
    if (!isObj(value)) return false;
    const entries = Object.entries(value);
    return entries.length <= MAX_KEYS && entries.every(([key, model]) => isSource(key, sources) && typeof model === 'string');
}
const mapRank = key => key === 'models' ? 0 : /history/i.test(key) ? 2 : 1;
function mapKeyOf(node, sources) {
    return Object.keys(node)
        .filter(key => (/models?$/i.test(key) || /model_?(map|by_?provider|history)/i.test(key)) && !/^custom/i.test(key) && isMap(node[key], sources))
        .sort((a, b) => mapRank(a) - mapRank(b))[0] || '';
}

export function at(root, path) {
    let node = root;
    for (const key of path) { if (!isObj(node)) return null; node = node[key]; }
    return isObj(node) ? node : null;
}

/** 지금 모델 값 (표 · 공급자별 칸 · 한 칸 중 이 자리가 쓰는 것) */
function currentModel(n, node, sources) {
    const provider = n[node.providerKey], id = sourceOf(provider, sources);
    if (node.mapKey && isObj(n[node.mapKey])) {
        const map = n[node.mapKey], key = Object.keys(map).find(k => k === provider) ?? Object.keys(map).find(k => sourceOf(k, sources) === id);
        if (key !== undefined && map[key]) return map[key];
    }
    if (node.perModel) { const key = perKeysOf(n, sources).find(k => sourceOf(k.slice(0, -6), sources) === id); if (key) return n[key]; }
    return node.modelKey ? n[node.modelKey] : '';
}

/** 설정 안의 연결 자리들: [{ path, providerKey, mapKey, history, modelKey, perModel, urlKey, customKey }] */
export function findNodes(settings, sources) {
    const out = [];
    const walk = (node, path) => {
        const keys = Object.keys(node);
        if (keys.length > MAX_KEYS || path.some(notChatPath)) return;
        const providerKey = PROVIDER_KEYS.find(key => isSource(node[key], sources));
        if (providerKey) {
            const mapKey = mapKeyOf(node, sources);
            const modelKey = MODEL_KEYS.find(key => typeof node[key] === 'string') || '';
            const per = mapKey ? [] : perKeysOf(node, sources);
            const perModel = per.length >= 2 || (per.length === 1 && sourceOf(per[0].slice(0, -6), sources) === sourceOf(node[providerKey], sources));
            const spot = { path, providerKey, mapKey, history: /history/i.test(mapKey), modelKey, perModel };
            if ((mapKey || modelKey || perModel) && !NOT_CHAT_MODEL.test(String(currentModel(node, spot, sources) || ''))) {
                const urlKey = URL_KEYS.find(key => typeof node[key] === 'string') || (sourceOf(node[providerKey], sources) === 'custom' && typeof node.url === 'string' ? 'url' : '');
                const customKey = keys.find(key => /^custom_?models$/i.test(key) && isObj(node[key])) || '';
                out.push({ ...spot, urlKey, customKey });
            }
        }
        if (path.length >= MAX_DEPTH) return;
        for (const key of keys) if (isObj(node[key])) walk(node[key], [...path, key]);
    };
    if (isObj(settings)) walk(settings, []);
    return out;
}

const pathText = path => Array.isArray(path) ? path.join('.') : String(path);
/** 스스로 등록한 확장이 settingsKey(+path)로 알린 자리는 뺀다 (path 는 'a.b' 또는 ['a','b']) */
export function skipRegistered(nodes, key, registered) {
    const mine = registered.filter(target => target && target.settingsKey === key);
    return nodes.filter(node => {
        const path = node.path.join('.');
        return !mine.some(target => { if (!target.path) return true; const p = pathText(target.path); return path === p || path.startsWith(`${p}.`); });
    });
}

// ---------- 소스 읽기

/**
 * 소스에서 extension_settings 키를 만드는 곳(assigned)과 언급만 하는 곳(mentioned).
 * extensionSettings 는 getContext() 의 것일 때만 — `.extensionSettings` 이거나 getContext() 에서 꺼낸 이름.
 * (확장 안의 지역 변수 `const extensionSettings = extension_settings[KEY]` 는 제 설정이라, 그 아래 칸을 다른 설정 키로 읽으면 안 된다)
 */
export function settingsRefs(texts) {
    const aliases = new Set(['extension_settings']);
    const consts = new Map();
    for (const text of texts) {
        for (const m of text.matchAll(/\bextension_settings\s+as\s+([A-Za-z_$][\w$]*)/g)) aliases.add(m[1]);
        // const { extensionSettings } = getContext() · const { extensionSettings: es } = SillyTavern.getContext()
        for (const m of text.matchAll(/\{([^{}]{0,400})\}\s*=\s*(?:[\w$.]*\.)?getContext\s*\(\s*\)/g)) {
            const hit = m[1].match(/\bextensionSettings\b(?:\s*:\s*([A-Za-z_$][\w$]*))?/);
            if (hit) aliases.add(hit[1] || 'extensionSettings');
        }
        // const es = getContext().extensionSettings
        for (const m of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:[\w$.]*\.)?getContext\s*\(\s*\)\s*\??\.\s*extensionSettings\b(?!\s*[.[?])/g)) aliases.add(m[1]);
        for (const m of text.matchAll(/(?:\b(?:const|let|var)\s+|,\s*)([A-Za-z_$][\w$]*)\s*=\s*(['"`])([\w.-]{1,80})\2/g)) {
            const was = consts.get(m[1]);
            consts.set(m[1], was === undefined || was === m[3] ? m[3] : null);   // 같은 이름에 다른 값이면 모름
        }
    }
    const name = `(?<![\\w$])(?:${[...aliases].map(esc).join('|')})|(?<=\\.\\s*)extensionSettings`;
    // extension_settings.key · extension_settings?.key · extension_settings['key'] · extension_settings[KEY] (KEY = 소스의 const 글자)
    const dot = String.raw`\s*\??\.\s*([A-Za-z_$][\w$]*)(?![\w$]|\s*\()`;
    const bracket = String.raw`\s*(?:\?\.)?\s*\[\s*(?:(['"${'`'}])([^'"${'`'}\n$]{1,80})\2|([A-Za-z_$][\w$]*))\s*\]`;
    const ref = new RegExp(String.raw`(?:${name})(?:${dot}|${bracket})`, 'g');
    const assigned = new Set(), mentioned = new Set();
    for (const text of texts) {
        for (const m of text.matchAll(ref)) {
            const found = m[1] ?? m[3] ?? (m[4] ? consts.get(m[4]) : null);
            if (!found || typeof found !== 'string') continue;
            mentioned.add(found);
            if (/^\s*(?:=(?!=)|\?\?=|\|\|=)/.test(text.slice(m.index + m[0].length, m.index + m[0].length + 6))) assigned.add(found);
        }
    }
    return { assigned, mentioned };
}

/** 설정 키와 확장 이름이 닮았는지 (폴더 · 표시 이름의 낱말 하나가 키에 있거나, 한쪽이 다른 쪽을 품음) */
export function resembles(key, ext) {
    const k = flat(key), kw = new Set(words(key).filter(w => w.length >= 3));
    return [ext.folder, ext.name].filter(Boolean).some(label => {
        const f = flat(label);
        return (f.length >= 3 && (k.includes(f) || f.includes(k))) || words(label).some(w => w.length >= 3 && kw.has(w));
    });
}

/**
 * 설정 키 → 주인 확장. extensions = [{ folder, name?, refs }] (켜진 외부 확장만)
 * 폴더 이름이 같으면 그 확장. 아니면 키를 만드는 확장 가운데 이름이 닮은 것, 없으면 만드는 확장이 딱 하나일 때만.
 * 만들지 않고 언급만 하는 경우는 한 확장만 언급하고 이름도 닮았을 때만 (지운 확장이 남긴 키를 읽기만 하는 확장이 주인이 되지 않게).
 */
export function ownerOf(key, extensions) {
    const quick = extensions.find(ext => flat(ext.folder) === flat(key));
    if (quick) return quick;
    const assigners = extensions.filter(ext => ext.refs?.assigned.has(key));
    const alike = assigners.filter(ext => resembles(key, ext));
    if (alike.length === 1) return alike[0];
    if (assigners.length === 1) return assigners[0];
    if (assigners.length) return null;   // 여럿이 만들고 이름으로도 못 가름 (옮기기 · 가져오기 기능)
    const mentioners = extensions.filter(ext => ext.refs?.mentioned.has(key));
    return mentioners.length === 1 && resembles(key, mentioners[0]) ? mentioners[0] : null;
}

/** 소스가 연결 방식 칸(key)과 견주거나 넣는 글자 값들 */
export function modeLiterals(texts, key) {
    const k = esc(key), v = `['"\`]([\\w-]{1,32})['"\`]`, out = new Set();
    const res = [
        new RegExp(`(?:\\.|\\[\\s*['"\`])${k}(?:['"\`]\\s*\\])?\\s*(?:===?|!==?)\\s*${v}`, 'g'),
        new RegExp(`${v}\\s*(?:===?|!==?)\\s*[\\w$.?]*\\.${k}\\b`, 'g'),
        new RegExp(`(?:^|[\\s{,(])['"]?${k}['"]?\\s*:\\s*${v}`, 'g'),
        new RegExp(`\\.${k}\\s*=\\s*${v}`, 'g'),
    ];
    for (const text of texts) for (const re of res) for (const m of text.matchAll(re)) out.add(m[1]);
    return out;
}

/** 연결 방식 칸: 연결 자리 또는 그 부모에서. { path, key, direct } — direct 가 '' 면 바꿀 값을 모름(공급자 · 모델만 바꾼다) */
export function modeOf(root, node, texts) {
    const spots = [node.path];
    if (node.path.length) spots.push(node.path.slice(0, -1));
    for (const path of spots) {
        const holder = at(root, path);
        if (!holder) continue;
        for (const key of MODE_KEYS) {
            if (typeof holder[key] !== 'string' || (path === node.path && key === node.providerKey)) continue;
            const values = new Set([holder[key], ...modeLiterals(texts, key)]);
            const directs = DIRECT.filter(value => values.has(value));
            if (key === 'mode' && !directs.length) continue;
            if (!directs.length && ![...values].some(value => FOLLOW.has(value))) continue;
            return { path, key, direct: directs.length === 1 ? directs[0] : '' };
        }
    }
    return null;
}

const PROVIDERISH = /(?:provider|source|api|engine|backend|service|platform|vendor)\w*$/i;
/**
 * 소스에서 '공급자로 쓰인' 글자들 (원래 표기 그대로). 아무 데나 나오는 'custom' · 'openai' 는 치지 않는다:
 *  - 공급자 글자가 둘 이상 든 배열 · 객체(키 또는 값) 안
 *  - 공급자처럼 보이는 칸과 견주는 곳 (x.provider === 'y', 'y' === source)
 *  - 공급자처럼 보이는 값의 switch 안 case 'y':
 */
export function providerLiterals(texts, sources) {
    const out = new Set(), lit = /(['"`])([\w .-]{1,40})\1/g;
    const keep = list => { const hits = list.filter(v => isSource(v, sources)); if (new Set(hits.map(v => sourceOf(v, sources))).size >= 2) hits.forEach(v => out.add(v)); };
    for (const text of texts) {
        for (const m of text.matchAll(/\[([^[\]]{0,4000})\]/g)) keep([...m[1].matchAll(lit)].map(x => x[2]));
        for (const m of text.matchAll(/\{([^{}]{0,4000})\}/g)) keep([...[...m[1].matchAll(/(?:^|[,\s])(['"]?)([\w-]{2,40})\1\s*:/g)].map(x => x[2]), ...[...m[1].matchAll(lit)].map(x => x[2])]);
        for (const m of text.matchAll(/([\w$.?\]]{1,80})\s*(?:===?|!==?)\s*(['"`])([\w .-]{1,40})\2/g)) if (PROVIDERISH.test(m[1].replace(/[?\]]/g, '')) && isSource(m[3], sources)) out.add(m[3]);
        for (const m of text.matchAll(/(['"`])([\w .-]{1,40})\1\s*(?:===?|!==?)\s*([\w$.?]{1,80})/g)) if (PROVIDERISH.test(m[3].replace(/\?/g, '')) && isSource(m[2], sources)) out.add(m[2]);
        const switches = [...text.matchAll(/\bswitch\s*\(([^()]{0,80})\)/g)].map(m => ({ at: m.index, on: PROVIDERISH.test(m[1].trim()) }));
        for (const m of text.matchAll(/\bcase\s*(['"`])([\w .-]{1,40})\1\s*:/g)) {
            const sw = switches.filter(s => s.at < m.index).pop();
            if (sw?.on && isSource(m[2], sources)) out.add(m[2]);
        }
    }
    return out;
}
/** 실리태번 상수(chat_completion_sources.X)를 쓰는 확장 — 공급자 전부를 안다 */
export const usesStSources = texts => texts.some(text => /\bchat_completion_sources\b/.test(text));

// 기본값 객체가 얼어 있거나 같이 쓰일 수 있으니, 쓸 때는 경로의 객체를 이 설정의 것으로 만든다
function writable(root, path) {
    let node = root;
    for (const key of path) {
        if (!isObj(node[key]) || Object.isFrozen(node[key])) node[key] = { ...(isObj(node[key]) ? node[key] : {}) };
        node = node[key];
    }
    return node;
}

/**
 * 연결 자리 하나 → 모델 전환 대상.
 * getRoot = () => extension_settings[key] (확장이 설정 객체를 새로 만들어도 매번 경로로 다시 찾는다)
 */
export function makeTarget({ key, node, getRoot, name, texts = [], sources }) {
    const root0 = getRoot(), here = at(root0, node.path) || {};
    const map = node.mapKey && isObj(here[node.mapKey]) ? here[node.mapKey] : {};
    const literals = providerLiterals(texts, sources);
    // 표기: 지금 값 · 표의 키가 먼저, 그다음 소스에 공급자로 나온 글자 (실리태번 id 그대로가 있으면 그것)
    const spell = new Map();
    const note = value => { const id = sourceOf(value, sources); if (id && !spell.has(id)) spell.set(id, value); };
    note(here[node.providerKey]); Object.keys(map).forEach(note);
    if (node.perModel) perKeysOf(here, sources).forEach(k => note(k.slice(0, -6)));
    const fixed = new Set(spell.keys());
    for (const value of literals) { const id = sourceOf(value, sources); if (!fixed.has(id) && (!spell.has(id) || value === id)) spell.set(id, value); }
    const to = source => spell.get(source) ?? source;
    const from = provider => sourceOf(provider, sources) || String(provider || '');
    // 쓸 수 있는 공급자: 지금 값 · 표의 키 · 소스에 공급자로 나온 글자 (실리태번 상수를 쓰는 확장이면 전부).
    // Custom 은 주소 칸이 있거나, 이미 Custom 을 쓰거나 표에 있거나, 소스가 공급자로 다룰 때만 (모르는 확장에 주소 없는 custom 을 넣지 않게)
    const allowed = new Set([...spell.keys()]);
    if (usesStSources(texts)) sources.forEach(id => allowed.add(id));
    const customOk = !!node.urlKey || spell.has('custom') || texts.some(text => /\bchat_completion_sources\s*\.\s*CUSTOM\b/.test(text));
    if (!customOk) allowed.delete('custom');
    const mode = modeOf(root0, node, texts);
    const perKey = (n, id) => perKeysOf(n, sources).find(k => sourceOf(k.slice(0, -6), sources) === id) || perKeyName(id);
    const mapKeyFor = (m, id, provider) => Object.keys(m).find(k => k === provider) ?? Object.keys(m).find(k => sourceOf(k, sources) === id) ?? provider;
    return {
        id: `auto:${key}${node.path.length ? '.' + node.path.join('.') : ''}`, name, auto: true, settingsKey: key, path: node.path.join('.'),
        sources: sources.filter(id => allowed.has(id)),
        read() {
            const root = getRoot(), n = at(root, node.path);
            if (!n) return null;
            const provider = String(n[node.providerKey] || ''), source = from(provider);
            let model = '';
            if (node.mapKey && isObj(n[node.mapKey])) model = String(n[node.mapKey][mapKeyFor(n[node.mapKey], source, provider)] || '');
            if (node.perModel) model = String(n[perKey(n, source)] || '');
            if (node.modelKey && ((!node.mapKey && !node.perModel) || node.history || (!mode && !model))) model = String(n[node.modelKey] || '');
            if ((model === 'custom' || model === '__custom__') && node.customKey) model = String(n[node.customKey]?.[provider] || '');
            const url = source === 'custom' && node.urlKey ? String(n[node.urlKey] || '') : '';
            if (mode) {
                const value = at(root, mode.path)?.[mode.key];
                if (!DIRECT.includes(value)) {
                    const follow = !FOLLOW.has(value) ? '자체 연결' : value === 'profile' ? '연결 프로필' : '지금 연결';
                    return { follow, source, model, url, stays: !mode.direct };
                }
            }
            return { source, model, url };
        },
        apply({ source, model, url }) {
            if (!this.sources.includes(source)) throw new Error(`${name}: ${source} 못 씀`);
            const root = getRoot();
            if (!isObj(root) || !at(root, node.path)) throw new Error(`${name}: 설정이 없어요`);
            const provider = to(source);
            if (mode?.direct) writable(root, mode.path)[mode.key] = mode.direct;
            const n = writable(root, node.path);
            n[node.providerKey] = provider;
            // 표는 늘 이 설정의 새 객체로 (얼린 기본값의 안쪽 표를 같이 쓰고 있을 수 있다)
            if (node.mapKey) { const m = n[node.mapKey] = { ...(isObj(n[node.mapKey]) ? n[node.mapKey] : {}) }; m[mapKeyFor(m, source, provider)] = model; }
            if (node.perModel) n[perKey(n, source)] = model;
            // 모델 한 칸: 표가 없거나 기록용 표일 때, 또는 연결 방식 칸이 없을 때(확장이 이 칸을 읽을 수 있다 — 표만 바꾸면 다른 공급자에 옛 모델이 간다)
            if (node.modelKey && (!node.mapKey || node.history || !mode)) n[node.modelKey] = model;
            if (source === 'custom' && url && node.urlKey) n[node.urlKey] = url;
        },
    };
}

const KO_WORDS = { analysis: '분석', analyze: '분석', summary: '요약', summarize: '요약', summarizer: '요약', translate: '번역', translation: '번역', translator: '번역',
    rewrite: '다시 쓰기', memory: '기억', recall: '기억', direct: '직접', chat: '채팅', reply: '답변', main: '기본', primary: '기본', secondary: '보조',
    backup: '예비', fallback: '예비', reasoning: '생각', think: '생각', thinking: '생각', plan: '계획', planner: '계획', tracker: '트래커', check: '검사', judge: '검사' };
/**
 * 한 확장의 자동 대상들 (이름 · 개수 정리 포함). make(node, name) 이 대상을 만든다 (같은 모양은 다시 쓰게 부르는 쪽이 캐시).
 * - 모델 칸이 비어 있는 자리는 소스가 채팅 생성을 부를 때만 (MiniMax 음성 · Pollinations 그림 같은 겸용 공급자 이름)
 * - 저장해 둔 여러 벌(presets.* · profiles.*)은 다른 자리가 있으면 뺀다 · 확장마다 4곳까지
 * - 이름: 한 곳이면 확장 이름, 여럿이면 확장 이름 · 아는 낱말(분석 · 요약 …) 또는 번호
 */
export function autoSpots({ root, nodes, owner, sources }) {
    const texts = owner.texts || [];
    const chatty = texts.some(text => CHAT_CALLS.test(text));
    let list = nodes.filter(node => { const n = at(root, node.path); return n && (String(currentModel(n, node, sources) || '').trim() || chatty); });
    const live = list.filter(node => !node.path.some(segment => COLLECTION.test(segment)));
    if (live.length) list = live;
    list = list.slice(0, MAX_SPOTS);
    const used = new Set();
    return list.map((node, i) => {
        if (list.length === 1) return { node, name: owner.name };
        const word = [...node.path].reverse().flatMap(segment => words(segment)).map(w => KO_WORDS[w]).find(Boolean);
        const name = word && !used.has(word) ? `${owner.name} · ${word}` : `${owner.name} ${i + 1}`;
        if (word) used.add(word);
        return { node, name };
    });
}

// ---------- 확장 소스 모으기 (브라우저: fetchText = (url, 남은 바이트) → 글 | null)

// import x from ⟨./a.js⟩ · import{a}from⟨./a.js⟩ · export*from⟨./b.js⟩ · import(⟨./c.js⟩) · import(`./d.js`) · import ⟨./e.js⟩
// (⟨⟩ = 작은따옴표나 큰따옴표. 주석에 따옴표 경로를 그대로 쓰면 release_gate 가 import 로 읽고 없는 파일이라 막는다)
const IMPORT = /(?:\bimport|\bexport)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*(?:['"]([^'"]+)['"]|`([^`$]+)`)\s*\)|\bimport\s*['"]([^'"]+)['"]/g;
/** 확장 폴더(base = '/scripts/extensions/third-party/<folder>/')의 manifest 와 js 입구 + 같은 폴더 안에서 부르는 모듈 */
export async function crawl(base, fetchText, { maxFiles = 40, maxBytes = 4e6 } = {}) {
    const origin = new URL(base, globalThis.location?.href || 'http://localhost/').href;
    const manifestText = await fetchText(new URL('manifest.json', origin).href, maxBytes);
    let manifest = null; try { manifest = JSON.parse(manifestText || ''); } catch { return null; }
    if (!manifest?.js) return { manifest, texts: [] };
    const queue = [new URL(manifest.js, origin).href], seen = new Set(queue), texts = [];
    let bytes = 0;
    while (queue.length && texts.length < maxFiles && bytes < maxBytes) {
        const url = queue.shift();
        const text = await fetchText(url, maxBytes - bytes);
        if (typeof text !== 'string') continue;
        if (bytes + text.length > maxBytes) break;   // 한도를 넘는 파일은 읽지 않은 셈 (받는 쪽이 크기를 먼저 보고 거른다)
        texts.push(text); bytes += text.length;
        for (const m of text.matchAll(IMPORT)) {
            const spec = m[1] || m[2] || m[3] || m[4];
            if (!spec?.startsWith('.')) continue;
            const next = new URL(spec, url).href;
            if (next.startsWith(origin) && /\.m?js$/.test(next) && !seen.has(next)) { seen.add(next); queue.push(next); }
        }
    }
    return { manifest, texts };
}
