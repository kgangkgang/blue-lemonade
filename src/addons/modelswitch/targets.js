// 모델 전환 — 바꿀 수 있는 확장 찾기 · 읽기 · 쓰기
// 공급자 이름은 실리태번의 chat_completion_source 값으로 통일한다 (Google AI Studio = makersuite).
// 아는 확장은 그 확장의 설정 화면까지 맞춰 주고, 모르는 확장은 '공급자 + 공급자별 모델' 꼴의 설정을 찾아 값만 바꾼다.
import { extension_settings, extensionNames } from '../../../../../../extensions.js';

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

const KNOWN = [translator, memory, rewrite];
const KNOWN_KEYS = new Set(['llm-translator-custom', 'memoria', 'ban_word_rewrite', 'model_switch', 'model_register', 'salty']);
const registered = new Map();

/** 다른 확장이 스스로 등록하는 길: globalThis[Symbol.for('st.model-switch.v1')].register({ id, name, read, apply, sources? }) */
export const registry = {
    register(target) {
        if (!target || typeof target.id !== 'string' || typeof target.read !== 'function' || typeof target.apply !== 'function') return false;
        registered.set(target.id, { sources: null, ...target, id: `ext:${target.id}`, name: String(target.name || target.id), external: true });
        window.dispatchEvent(new Event('bl:model-switch-targets'));
        return true;
    },
    unregister(id) { registered.delete(id); window.dispatchEvent(new Event('bl:model-switch-targets')); },
};

// '공급자 + 공급자별 모델' 꼴: { provider|source: 'custom', models: { custom: '…' } } — 설정 맨 위 또는 한 단계 안쪽
function shapeOf(node) {
    if (!isObj(node) || !isObj(node.models)) return null;
    const key = typeof node.provider === 'string' ? 'provider' : typeof node.source === 'string' ? 'source' : '';
    if (!key || !node[key]) return null;
    const values = Object.values(node.models);
    if (!values.length || values.some(value => typeof value !== 'string')) return null;
    return key;
}

function prettyName(key, folderNames) {
    const flat = text => String(text).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
    const folder = folderNames.find(name => flat(name) === flat(key));
    return folder || key;
}

function detected() {
    const folders = extensionNames.filter(name => name.startsWith('third-party/')).map(name => name.slice(12));
    const out = [];
    for (const [key, value] of Object.entries(extension_settings)) {
        if (KNOWN_KEYS.has(key) || !isObj(value)) continue;
        const spots = [[value, '']];
        for (const [inner, node] of Object.entries(value)) if (isObj(node)) spots.push([node, inner]);
        for (const [node, inner] of spots) {
            const providerKey = shapeOf(node);
            if (!providerKey) continue;
            const google = 'google' in node.models && !('makersuite' in node.models);
            const to = source => google ? toGoogle(source) : source, from = provider => google ? fromGoogle(provider) : provider;
            const urlKey = ['customUrl', 'custom_url'].find(name => typeof node[name] === 'string');
            out.push({
                id: `auto:${key}${inner ? '.' + inner : ''}`, name: prettyName(key, folders), auto: true, sources: null,
                read() {
                    const provider = String(node[providerKey] || ''), picked = String(node.models?.[provider] || '');
                    return { source: from(provider), model: picked === 'custom' ? String(node.customModels?.[provider] || '') : picked, url: provider === 'custom' && urlKey ? node[urlKey] : '' };
                },
                apply({ source, model, url }) {
                    const provider = to(source);
                    node[providerKey] = provider; node.models[provider] = model;
                    if (provider === 'custom' && url && urlKey) node[urlKey] = url;
                },
            });
            break; // 확장 하나에 한 군데만
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
