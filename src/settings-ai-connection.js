// AI 설정 도우미의 연결 선택이에요. 이 화면을 열거나 직접 연결로 요청할 때만 불러요.
import * as Providers from './addons/rewrite/providers.js';
import * as Models from './live-models.js';
import { completionText } from './addons/prompt/response-text.js';

export const PROVIDERS = Providers.PROVIDERS;
const context = () => globalThis.SillyTavern?.getContext?.();
const clean = value => typeof value === 'string' ? value.trim() : '';
const knownProvider = id => typeof id === 'string' && Object.hasOwn(PROVIDERS, id);

// 회사별 값은 기능을 실제로 사용할 때 정리해요. 꺼진 기능의 시작 경로에서는 지도 모양만 확인해요.
export function normalizeModelConfig(config = {}) {
    const map = value => Object.fromEntries(Object.keys(PROVIDERS).filter(key => value && Object.hasOwn(value, key) && typeof value[key] === 'string').map(key => [key, value[key].trim().slice(0, 200)]));
    return { ...config, models: map(config.models), customModels: map(config.customModels) };
}

export function modelOf(config) {
    const selected = config.models?.[config.provider];
    return clean(selected === 'custom' ? config.customModels?.[config.provider] : selected);
}
export function endpointOf(config, host = {}) {
    const own = Providers.normalizeUrl(config.customUrl);
    return { url: own || Providers.normalizeUrl(host.custom_url), inheritExtras: !own };
}
export function buildDirectPayload(messages, config, host = {}, maxTokens = 800) {
    const provider = knownProvider(config?.provider) ? PROVIDERS[config.provider] : null;
    if (!provider) throw new Error('설정 도우미에서 사용할 회사를 다시 골라 주세요.');
    config = normalizeModelConfig(config);
    const model = modelOf(config);
    if (!model) throw new Error('설정 도우미에서 사용할 모델을 골라 주세요.');
    const source = provider.source;
    const payload = { chat_completion_source: source, model, messages: structuredClone(messages), stream: false, max_tokens: maxTokens };
    const effort = Models.lowEffort(source, model);
    if (effort) payload.reasoning_effort = effort;
    const routed = source === 'openrouter' ? /^(openai|anthropic|google)\/(.+)$/.exec(model) : null;
    const routedEffort = routed && Models.lowEffort(({ openai: 'openai', anthropic: 'claude', google: 'makersuite' })[routed[1]], routed[2]);
    if (source === 'vertexai') {
        payload.vertexai_auth_mode = host.vertexai_auth_mode || 'full';
        if (host.vertexai_region) payload.vertexai_region = host.vertexai_region;
        if (payload.vertexai_auth_mode === 'express' && host.vertexai_express_project_id) payload.vertexai_express_project_id = host.vertexai_express_project_id;
    }
    if (source === 'custom') {
        const endpoint = endpointOf(config, host);
        if (!Providers.isHttpUrl(endpoint.url)) throw new Error('OpenAI 호환 연결의 주소를 입력하거나 실리태번에 저장해 주세요.');
        payload.custom_url = endpoint.url;
        for (const key of ['custom_include_headers', 'custom_include_body', 'custom_exclude_body']) payload[key] = endpoint.inheritExtras ? (host[key] || '') : '';
    }
    // 선택한 회사의 서버 저장 키를 사용해요. 다른 회사의 프록시 설정은 가져오지 않아요.
    Models.applyModelRequestRules(source, model, payload);
    let thinking = source === 'openai' ? 'max_completion_tokens' in payload : !!effort;
    if (routedEffort) {
        const mapped = ({ openai: 'openai', anthropic: 'claude', google: 'makersuite' })[routed[1]];
        const rules = Models.applyModelRequestRules(mapped, routed[2], { max_tokens: maxTokens });
        thinking ||= mapped === 'openai' ? 'max_completion_tokens' in rules : true;
    }
    if (thinking) { const key = 'max_completion_tokens' in payload ? 'max_completion_tokens' : 'max_tokens'; payload[key] = Math.max(maxTokens, Models.THINK_MIN_TOKENS); }
    return payload;
}

export async function sendSettingsAiDirect(messages, { connection, signal, maxTokens = 800, ctx = context(), fetcher = globalThis.fetch }) {
    signal?.throwIfAborted?.();
    if (typeof ctx?.getRequestHeaders !== 'function') throw new Error('실리태번 요청 창구를 찾지 못했어요.');
    const payload = buildDirectPayload(messages, connection, ctx.chatCompletionSettings || {}, maxTokens);
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
    try {
        controller.signal.throwIfAborted();
        const response = await fetcher('/api/backends/chat-completions/generate', {
            method: 'POST', headers: { ...ctx.getRequestHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(payload), signal: controller.signal,
        });
        if (!response.ok) throw new Error(`설정 도우미 요청이 실패했어요(HTTP ${response.status}). 선택한 회사의 API 설정을 확인해 주세요.`);
        const data = await response.json();
        controller.signal.throwIfAborted();
        try { return completionText(data); }
        catch (error) {
            if (error?.refused) throw new Error('선택한 모델이 설정 요청에 응답하지 않았어요.');
            throw new Error('모델 응답이 완성되지 않았어요. 연결과 응답 한도를 확인해 주세요.');
        }
    } catch (error) {
        if (signal?.aborted) throw new Error('멈췄어요');
        if (timedOut) throw new Error('90초 안에 설정 도우미의 응답이 오지 않았어요.');
        throw error;
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

export function mountSettingsAiConnection(slot, { read: readStored, write: writeStored, stack, esc, models = Models, providers = Providers }) {
    const read = () => normalizeModelConfig(readStored());
    const write = mutate => writeStored(config => { Object.assign(config, normalizeModelConfig(config)); mutate(config); Object.assign(config, normalizeModelConfig(config)); });
    let disposed = false, message = '';
    const pending = new Set();
    const currentContext = () => context() || {};
    const endpoint = config => endpointOf(config, currentContext().chatCompletionSettings || {});
    const keyOf = config => knownProvider(config.provider) ? providers.listKey(config.provider, endpoint(config)) : '';
    const profiles = () => {
        try { const list = currentContext().ConnectionManagerRequestService?.getSupportedProfiles?.(); return Array.isArray(list) ? list.filter(p => p && typeof p.id === 'string' && p.id) : []; }
        catch { return []; }
    };
    function fillModels() {
        if (disposed || !slot.isConnected) return;
        const config = read(), provider = config.provider;
        if (!knownProvider(provider)) return;
        const select = slot.querySelector('[data-search-ai-model]'); if (!select) return;
        const typed = config.models?.[provider] === 'custom';
        const choices = providers.modelChoices(provider, typed ? '' : (config.models?.[provider] || ''), endpoint(config));
        models.fillSelect(select, choices.ids, {
            saved: typed ? '' : (config.models?.[provider] || ''), placeholder: '모델을 골라 주세요',
            customValue: 'custom', customLabel: '모델 이름 직접 입력', customSelected: typed,
            missingSuffix: provider === 'custom' && choices.ids.length ? ' (이 주소 목록에 없음)' : ' (저장한 모델)',
        });
    }
    function status() {
        if (disposed || !slot.isConnected) return;
        const config = read(), button = slot.querySelector('[data-search-ai-refresh]'), note = slot.querySelector('[data-search-ai-connection-status]');
        if (button) { const loading = pending.has(keyOf(config)); button.disabled = loading || !providers.canFetch(config.provider); button.textContent = loading ? '목록을 불러오는 중…' : '모델 목록 새로고침'; }
        if (note) note.textContent = message;
    }
    function paint() {
        if (disposed || !slot.isConnected) return;
        const config = read(), provider = config.provider || '', selected = provider ? `api:${provider}` : config.profileId ? `profile:${encodeURIComponent(config.profileId)}` : '';
        const entries = [['', '실리태번 지금 연결'], ...profiles().map(p => [`profile:${encodeURIComponent(p.id)}`, p.name || p.id]), ...Object.entries(PROVIDERS).map(([id, p]) => [`api:${id}`, `${p.label} · 직접 선택`])];
        if (selected && !entries.some(([value]) => value === selected)) entries.push([selected, '찾을 수 없는 연결 · 다시 선택해 주세요']);
        const select = `<select data-search-ai-connection-choice aria-label="AI 로 설정 바꾸기 연결">${entries.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('')}</select>`;
        slot.innerHTML = stack('연결', select);
        if (!knownProvider(provider)) return;
        const typed = config.models?.[provider] === 'custom';
        if (provider === 'custom') slot.insertAdjacentHTML('beforeend', stack('API 주소', `<input type="url" data-search-ai-url aria-label="설정 도우미 API 주소" value="${esc(config.customUrl || '')}" placeholder="비우면 실리태번에 저장한 주소를 사용해요" maxlength="2048">`));
        slot.insertAdjacentHTML('beforeend', stack('모델', '<select data-search-ai-model aria-label="설정 도우미 모델"></select>'));
        fillModels();
        if (typed) slot.insertAdjacentHTML('beforeend', stack('모델 이름', `<input type="text" data-search-ai-custom-model aria-label="설정 도우미 모델 이름" value="${esc(config.customModels?.[provider] || '')}" maxlength="200" placeholder="사용할 모델 이름을 입력해 주세요">`));
        slot.insertAdjacentHTML('beforeend', '<div class="salty-btns"><button type="button" class="salty-btn" data-search-ai-refresh>모델 목록 새로고침</button></div><p class="salty-note">API 키는 실리태번의 해당 회사 연결에 저장한 값을 사용해요.</p><small data-search-ai-connection-status role="status" aria-live="polite"></small>');
        status();
    }
    const onChange = event => {
        const element = event.target, before = read();
        if (!slot.contains(element)) return;
        let rebuild = false;
        if (element.matches('[data-search-ai-connection-choice]')) {
            const value = element.value;
            if (value.startsWith('api:') && !knownProvider(value.slice(4))) return;
            let profileId = '';
            if (value.startsWith('profile:')) { try { profileId = decodeURIComponent(value.slice(8)); } catch { return; } }
            write(config => { if (value.startsWith('api:')) config.provider = value.slice(4); else { config.provider = ''; config.profileId = profileId; } });
            rebuild = true;
        } else if (element.matches('[data-search-ai-model]')) { write(config => { (config.models ??= {})[before.provider] = element.value; }); rebuild = true; }
        else if (element.matches('[data-search-ai-custom-model]')) write(config => { (config.customModels ??= {})[before.provider] = element.value.trim(); });
        else if (element.matches('[data-search-ai-url]')) { write(config => { config.customUrl = providers.normalizeUrl(element.value); }); fillModels(); }
        else return;
        message = ''; if (rebuild) paint(); else status();
    };
    const onClick = async event => {
        if (!event.target.closest('[data-search-ai-refresh]')) return;
        const config = structuredClone(read());
        if (!knownProvider(config.provider) || !providers.canFetch(config.provider)) return;
        const requestKey = keyOf(config); if (pending.has(requestKey)) return;
        const target = endpoint(config);
        pending.add(requestKey); message = ''; status();
        try {
            const ids = await providers.fetchModelList(config.provider, { endpoint: target, includeHeaders: target.inheritExtras ? currentContext().chatCompletionSettings?.custom_include_headers || '' : '', headers: () => currentContext().getRequestHeaders?.() || {} });
            if (!disposed && keyOf(read()) === requestKey) { message = `모델 ${ids.length}개를 불러왔어요.`; fillModels(); }
        } catch { if (!disposed && keyOf(read()) === requestKey) message = '모델 목록을 불러오지 못했어요. 연결 설정과 주소를 확인해 주세요.'; }
        finally { pending.delete(requestKey); status(); }
    };
    slot.addEventListener('change', onChange); slot.addEventListener('click', onClick);
    // 목록 갱신은 선택 칸만 바꿔요. 입력 중인 모델명·주소와 포커스는 그대로 둬요.
    const stop = models.onChange(event => { if (event?.key === keyOf(read())) fillModels(); });
    paint();
    return () => { disposed = true; stop(); slot.removeEventListener('change', onChange); slot.removeEventListener('click', onClick); };
}
