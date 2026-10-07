// 모델 전환 — 바꿀 수 있는 확장 찾기 · 읽기 · 쓰기
// 공급자 이름은 실리태번의 chat_completion_source 값으로 통일한다 (Google AI Studio = makersuite).
// 아는 확장은 그 확장의 설정 화면까지 맞춰 주고, 모르는 확장은 켜진 확장의 소스로 설정 키의 주인을 찾아 그 설정의 '공급자 + 모델' 자리 값만 바꾼다 (1.0.5, discover.js).
import { extension_settings, extensionNames } from '../../../../../../extensions.js';
import { oai_settings } from '../../../../../../openai.js';
import { SOURCES } from '../models/sources.js';
import * as LM from '../../live-models.js';
import { CORE_KEYS, findNodes, settingsRefs, ownerOf, makeTarget, crawl, skipRegistered, autoSpots } from './discover.js';

const $ = globalThis.jQuery;
const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
const installed = folder => extensionNames.includes(`third-party/${folder}`) && !extension_settings.disabledExtensions?.includes(`third-party/${folder}`);
const NARROW = ['openai', 'custom', 'claude', 'cohere', 'makersuite', 'vertexai', 'openrouter', 'deepseek'];
const toGoogle = source => source === 'makersuite' ? 'google' : source;
const fromGoogle = provider => provider === 'google' ? 'makersuite' : provider;
const hasDom = selector => !!$ && $(selector).length > 0;

function ownObject(parent, key, fallback) {
    // 기본값 객체가 얼어 있거나 여러 곳에서 같이 쓰일 수 있으니, 쓸 때는 이 설치본의 객체로 만든다
    if (!isObj(parent[key]) || Object.isFrozen(parent[key])) parent[key] = { ...(isObj(parent[key]) ? parent[key] : fallback) };
    return parent[key];
}

const translator = {
    id: 'translator', name: '번역', folder: 'llm-translator-custom', sources: NARROW,
    builtin: () => !!extension_settings.salty?.addons?.translator,
    settings: () => extension_settings['llm-translator-custom'],
    read() {
        const s = this.settings();
        if (!isObj(s)) return null;
        if (s.connection_mode !== 'direct') return { follow: '지금 연결' };
        const provider = String(s.llm_provider || '');
        const model = s.llm_model === 'custom' ? String(s.custom_models?.[provider] || '') : String(s.llm_model || '');
        return { source: fromGoogle(provider), model, url: provider === 'custom' ? String(s.custom_url || '') : '' };
    },
    apply({ source, model, url }) {
        const s = this.settings(), provider = toGoogle(source);
        s.connection_mode = 'direct';
        ownObject(s, 'provider_model_history', {})[provider] = model;
        s.llm_provider = provider; s.llm_model = model;
        if (provider === 'custom' && url) s.custom_url = url;
        // 번역 설정 화면의 공급자 change 가 모델 목록 · 파라미터 · 주소 칸을 다시 그린다 (목록에 없는 모델은 '이전 목록'으로 붙여 고른다)
        if (hasDom('#llm_provider')) {
            $('#llm_connection_mode').val('direct').trigger('change');
            if (provider === 'custom' && url) $('#llm_custom_url').val(url);
            $('#llm_provider').val(provider).trigger('change');
        }
    },
};

const rewrite = {
    id: 'rewrite', name: '다시 쓰기', folder: 'ban-word-rewrite', sources: NARROW,
    // 테마에 내장된 다시 쓰기(확장 › 다시 쓰기)도 같은 설정 칸을 쓴다
    builtin: () => !!extension_settings.salty?.addons?.rewrite,
    settings: () => extension_settings.ban_word_rewrite,
    read() {
        const s = this.settings();
        if (!isObj(s)) return null;
        if (s.connection !== 'direct') return { follow: s.connection === 'profile' ? '연결 프로필' : '지금 연결' };
        const provider = String(s.provider || '');
        const picked = String(s.models?.[provider] || '');
        return { source: fromGoogle(provider), model: picked === 'custom' ? String(s.customModels?.[provider] || '') : picked, url: provider === 'custom' ? String(s.customUrl || '') : '' };
    },
    apply({ source, model, url }) {
        const s = this.settings(), provider = toGoogle(source);
        s.connection = 'direct'; s.provider = provider;
        ownObject(s, 'models', {})[provider] = model;
        if (provider === 'custom' && url) s.customUrl = url;
        if (hasDom('#bwr_provider')) {
            $('#bwr_connection .bwr_seg[data-value="direct"]').trigger('click');
            if (provider === 'custom' && url) $('#bwr_custom_url').val(url);
            $('#bwr_provider').val(provider).trigger('change');
        }
    },
};

const memory = {
    id: 'memory', name: '장기 기억', folder: 'long-memory', sources: null,
    settings: () => extension_settings.memoria,
    read() {
        const s = this.settings();
        if (!isObj(s)) return null;
        if (s.apiMode !== 'direct') return { follow: s.apiMode === 'custom' ? '주소 직접' : '연결 프로필' };
        const d = isObj(s.direct) ? s.direct : {}, source = String(d.source || '');
        const picked = String(d.models?.[source] || '');
        return { source, model: picked === 'custom' ? String(d.customModels?.[source] || '') : picked, url: source === 'custom' ? String(d.customUrl || '') : '' };
    },
    async apply({ source, model, url }) {
        const s = this.settings();
        s.apiMode = 'direct';
        const d = ownObject(s, 'direct', { source: 'custom', models: {}, customModels: {}, customUrl: '' });
        d.source = source;
        ownObject(d, 'models', {})[source] = model;
        if (source === 'custom' && url) d.customUrl = url;
        // 장기 기억의 설정 창은 열려 있을 때만 그려진다. 같은 모듈을 불러 다시 그리게 하고, 안 되면 다음에 열 때 반영된다.
        // 1.5.1+ 는 창을 panel-loader 로 늦게 받는다 — 그쪽 refreshPanel 은 창이 없으면 아무것도 안 한다.
        // panel.js 를 바로 부르면 안 쓸 화면 코드(~230KB)를 받으니, panel-loader 가 없는 1.5.0 이하만 panel.js 로.
        const lm = file => new URL(`../../../../long-memory/${file}`, import.meta.url).href;
        try { (await import(lm('panel-loader.js')).catch(() => import(lm('panel.js')))).refreshPanel?.(); } catch { /* 다음에 열 때 반영 */ }
    },
};

const prompt = {
    id: 'prompt', name: '한글화 패널', folder: 'prompt-panel',
    sources: [...NARROW, 'mistralai', 'groq', 'xai', 'zai'],
    builtin: () => !!extension_settings.salty?.addons?.prompt,
    settings: () => extension_settings['prompt-panel'],
    read() {
        const s = this.settings();
        if (s.connectionMode !== 'direct') return { follow: s.connectionMode === 'profile' ? '연결 프로필' : '지금 연결' };
        return { source: fromGoogle(s.provider), model: s.model === '__custom__' ? s.customModelName || '' : s.model || '', url: s.provider === 'custom' ? s.customUrl || '' : '' };
    },
    apply({ source, model, url }) {
        const s = this.settings();
        s.connectionMode = 'direct'; s.provider = toGoogle(source); s.model = model;
        if (source === 'custom' && url) s.customUrl = url;
        window.dispatchEvent(new Event('bl:prompt-connection-changed'));
    },
};
const KNOWN = [translator, prompt, memory, rewrite];
const KNOWN_KEYS = new Set(['llm-translator-custom', 'prompt-panel', 'memoria', 'ban_word_rewrite', 'model_switch', 'model_register', 'salty']);
const registered = new Map();

/** 다른 확장이 스스로 등록하는 길: globalThis[Symbol.for('st.model-switch.v1')].register({ id, name, read, apply, sources?, settingsKey?, path? })
 *  settingsKey(+path)를 주면 그 설정 자리는 자동 찾기에서 뺀다 (같은 연결이 두 번 나오지 않게). path 는 'a.b' 또는 ['a','b'].
 *  자동으로 찾은 자리를 바꾼 뒤에는 window 에 'st:model-switch-applied' (detail { settingsKey, path }) 를 보낸다 —
 *  설정 화면이 열려 있는 확장은 이걸 받아 다시 그리면 된다 (폼 전체를 저장하는 확장이 예전 값으로 되돌리지 않게). */
export const registry = {
    register(target) {
        if (!target || typeof target.id !== 'string' || typeof target.read !== 'function' || typeof target.apply !== 'function') return false;
        registered.set(target.id, { sources: null, ...target, id: `ext:${target.id}`, name: String(target.name || target.id), external: true });
        window.dispatchEvent(new Event('bl:model-switch-targets'));
        return true;
    },
    unregister(id) { registered.delete(id); window.dispatchEvent(new Event('bl:model-switch-targets')); },
};

// 1.0.5: 모르는 확장 자동으로 찾기 — 확장마다 적어 두지 않는다 (discover.js).
// 켜진 외부 확장의 소스를 이 세션에 한 번 읽어 '설정 키 → 확장'을 알아내고, 그 설정 안의 '공급자 + 모델' 자리를 찾는다.
// 소스는 바꿀 만한 설정이 있을 때만, 모델 전환 창을 처음 그릴 때 읽는다 (페이지를 열 때는 읽지 않는다).
const KNOWN_FOLDERS = new Set(KNOWN.map(target => target.folder));
const STS = SOURCES.map(source => source.id);
// 이 테마의 폴더 (…/<폴더>/src/addons/modelswitch/targets.js) — 테마 소스는 다른 확장 설정 키를 두루 적고 있어 주인 찾기에서 뺀다
const THEME_FOLDER = decodeURIComponent(new URL('../../../', import.meta.url).pathname.split('/').filter(Boolean).pop() || '');
let scan = null;

// 바꿀 만한 설정 키: 아는 키 · 실리태번 본체 키가 아니고, 안에 연결 자리가 있는 것
function candidateKeys() {
    return Object.keys(extension_settings).filter(key => !KNOWN_KEYS.has(key) && !CORE_KEYS.has(key) && isObj(extension_settings[key]) && findNodes(extension_settings[key], STS).length);
}

// 파일마다 5초 — 느린 서버(폰)에서 한 파일이 멈춰도 찾기 전체가 멈추지 않게. 크기를 먼저 보고 남은 한도보다 크면 받지 않는다
async function fetchText(url, budget = Infinity) {
    try {
        const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(5000) });
        if (!response.ok) return null;
        const size = Number(response.headers.get('content-length'));
        if (size > budget) { response.body?.cancel?.().catch(() => {}); return null; }
        return await response.text();
    } catch { return null; }
}

/** 주인 찾기를 (필요하면) 시작한다. 끝나면 대상 목록이 바뀌었다고 알린다. */
export function discoverTargets() {
    const keys = candidateKeys();
    const folders = extensionNames.filter(name => name.startsWith('third-party/')).map(name => name.slice(12))
        .filter(folder => installed(folder) && folder !== THEME_FOLDER && !KNOWN_FOLDERS.has(folder));
    const sig = `${folders.join('|')}#${keys.join('|')}`;
    if (scan?.sig === sig) return scan.promise;
    const job = { sig, done: !keys.length || !folders.length, owners: new Map(), made: new Map() };
    scan = job;
    job.promise = job.done ? Promise.resolve() : (async () => {
        const read = await Promise.all(folders.map(async folder => {
            const got = await crawl(`/scripts/extensions/third-party/${encodeURIComponent(folder)}/`, fetchText).catch(() => null);
            return got && { folder, name: String(got.manifest?.display_name || folder), texts: got.texts, refs: settingsRefs(got.texts) };
        }));
        const extensions = read.filter(Boolean);
        for (const key of keys) {
            const owner = ownerOf(key, extensions);
            if (owner) job.owners.set(key, { folder: owner.folder, name: owner.name, texts: owner.texts });
        }
        // 주인이 아닌 확장의 소스는 들고 있지 않는다
        for (const ext of extensions) ext.texts = null;
        job.done = true;
        if (scan === job) window.dispatchEvent(new Event('bl:model-switch-targets'));
    })();
    return job.promise;
}

function detected() {
    if (!scan?.done) return [];
    const own = [...registered.values()];
    const out = [];
    for (const [key, owner] of scan.owners) {
        if (!installed(owner.folder) || !isObj(extension_settings[key])) continue;
        // 스스로 등록한 확장(settingsKey · path)과 겹치는 자리는 건너뛴다 · 이름 · 개수 정리는 autoSpots
        const nodes = skipRegistered(findNodes(extension_settings[key], STS), key, own);
        for (const { node, name } of autoSpots({ root: extension_settings[key], nodes, owner, sources: STS })) {
            // 같은 모양의 자리는 한 번 만든 대상을 다시 쓴다 (소스 글자 찾기를 그릴 때마다 되풀이하지 않게)
            const sig = [key, name, ...node.path, node.providerKey, node.mapKey, node.modelKey, node.perModel, node.urlKey, node.customKey].join('\u0001');
            if (!scan.made.has(sig)) scan.made.set(sig, makeTarget({ key, node, getRoot: () => extension_settings[key], name, texts: owner.texts, sources: STS }));
            out.push(scan.made.get(sig));
        }
    }
    return out;
}

/** 지금 바꿀 수 있는 대상 전부 (설치돼 켜져 있는 아는 확장 → 스스로 등록한 확장 → 자동으로 찾은 확장) */
export function listTargets() {
    const known = KNOWN.filter(target => (installed(target.folder) || target.builtin?.()) && isObj(target.settings()));
    return [...known, ...registered.values(), ...detected()];
}

export function supports(target, source) { return !target.sources || target.sources.includes(source); }

// ---------- 모델 고르기 목록 — 공용 목록 src/live-models.js ("항상 최신")
// 목록 = 공용 목록 (받은 목록이 있으면: 받은 목록 새것 먼저 + 모델 등록 / 없으면: 모델 등록 → 테마가 아는 최신 이름 → 실리태번 화면 목록)
//      ∪ Custom 에서 주소 칸이 비었을 때(각 확장이 제 주소를 그대로 씀) 그 주소들의 목록 ∪ 대상 확장의 지금 모델 (이름 속 버전 새것 먼저).
// 'OR_Website' · 직접 입력 표시 · OpenAI 의 채팅 아닌 모델(임베딩 · 음성 · 그림 …)은 뺀다. 아무도 안 쓰는 옛 주소의 목록으로 부풀리지 않는다.
// 받은 목록은 이 브라우저의 localStorage 에만 둔다 (settings.json 은 폰과 동기화됨). 예전에 설정에 둔 Custom 목록(model_switch.lists)은 읽기만.
// 받기: ↻ 는 목록을 주는 공급자 모두 · 창을 열 때와 공급자를 바꿀 때는 오래된 목록만 조용히. Custom 은 실리태번 Custom 주소일 때만
// (실리태번 서버가 저장된 Custom 키를 그 주소로 보낸다 — 새로 친 주소로 키가 가지 않게).
const MAX_OPTIONS = 1000;
const cleanUrl = url => String(url || '').trim().replace(/\/+$/, '');
const isHttp = url => /^https?:\/\//i.test(url);
/** 목록을 받을 Custom 주소: 모델 전환의 주소 칸 → 비면 실리태번 Custom 주소 */
export const listUrlOf = url => cleanUrl(url) || cleanUrl(oai_settings?.custom_url);
const keyOf = (src, url) => LM.cacheKey(src, src === 'custom' ? listUrlOf(url) : undefined);

/** 고를 모델 이름들 (새것 먼저). url = 모델 전환의 주소 칸 */
export function modelOptions(source, { url = '' } = {}) {
    const src = LM.sourceOf(source), own = cleanUrl(url);
    const now = [];
    for (const target of listTargets()) {
        try { const r = target.read(); if (r?.source && LM.sourceOf(r.source) === src) now.push(r); } catch { /* 읽지 못한 대상 */ }
    }
    const ids = LM.list(src, src === 'custom' ? { customUrl: own } : {}).ids;
    const extra = [];
    if (src === 'custom' && !own) {
        const seen = new Set([listUrlOf('')]);
        for (const r of now) {
            const u = cleanUrl(r.url);
            if (!isHttp(u) || seen.has(u)) continue;
            seen.add(u);
            extra.push(...LM.list('custom', { customUrl: u, inheritCustom: false, known: false }).ids);
        }
    }
    for (const r of now) if (r.model) extra.push(String(r.model).trim());
    return [...new Set([...ids, ...LM.modelIdsFrom(src, extra)])].slice(0, MAX_OPTIONS);
}

/** 받은 목록이 있나 (이 공급자 · Custom 은 그 주소) */
export const hasModelList = (source, url = '') => LM.cached(keyOf(LM.sourceOf(source), url)).ids.length > 0;

/** ↻ 로 받을 수 없으면 그 까닭(화면에 그대로), 되면 '' */
export function fetchBlock(source, url = '') {
    const src = LM.sourceOf(source);
    if (!LM.canList(src)) return '이 공급자는 목록을 받아 오지 않아요';
    if (src === 'custom') {
        const u = listUrlOf(url);
        if (!isHttp(u)) return '주소를 먼저 넣어 주세요 (http…)';
        if (u !== cleanUrl(oai_settings?.custom_url)) return '실리태번 Custom 연결 주소를 먼저 이 주소로 바꿔 주세요. 저장된 키는 설정한 주소에만 보내요.';
        return '';
    }
    if (LM.keyState(src) === 'no') return '실리태번 API 연결에 이 공급자의 키를 먼저 넣어 주세요';
    return '';
}

// 목록 요청: Custom 은 예전(설정에 목록을 두던 때)과 글자까지 같은 본문 — custom_url · 실리태번 추가 헤더 · 빈 프록시.
// 그 밖은 공용 모듈의 본문 (실리태번이 지금 그 공급자에 리버스 프록시를 쓰면 그것까지)
function listRequest(src, url) {
    if (src !== 'custom') return { inheritProxy: false };   // 5.7.1 직접 연결의 목록 (본체 프록시 목록은 따로 키 — 바꾸는 애드온들이 그 프록시로 보내지 않음)
    const u = listUrlOf(url);
    return { customUrl: u, body: { custom_url: u, custom_include_headers: oai_settings?.custom_include_headers, reverse_proxy: '', proxy_password: '' } };
}

/** ↻: 받아서 ids (새것 먼저). 못 받으면 던진다 — 예전 목록은 그대로 */
export function refreshModels(source, url = '') {
    const src = LM.sourceOf(source), block = fetchBlock(src, url);
    if (block) return Promise.reject(Object.assign(new Error(block), { blocked: true }));
    return LM.refresh(src, listRequest(src, url));
}

/** 창을 열 때 · 공급자를 바꿀 때: 목록이 없거나 하루가 지났으면 조용히 다시 (키가 있을 때만 · 던지지 않음) */
export function autoModels(source, url = '') {
    const src = LM.sourceOf(source);
    if (!LM.canList(src) || (src === 'custom' && listUrlOf(url) !== cleanUrl(oai_settings?.custom_url))) return Promise.resolve(null);
    return LM.autoRefresh(src, listRequest(src, url));
}
