// 모델 전환 — 바꿀 수 있는 확장 찾기 · 읽기 · 쓰기
// 공급자 이름은 실리태번의 chat_completion_source 값으로 통일한다 (Google AI Studio = makersuite).
// 아는 확장은 그 확장의 설정 화면까지 맞춰 주고, 모르는 확장은 켜진 확장의 소스로 설정 키의 주인을 찾아 그 설정의 '공급자 + 모델' 자리 값만 바꾼다 (1.0.5, discover.js).
import { extension_settings, extensionNames } from '../../../../../../extensions.js';
import { SOURCES } from '../models/sources.js';
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
