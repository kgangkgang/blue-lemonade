// 캐릭터 에셋 1.6.0 — 「다른 모델이 고르기」 연결: 설정 · 쓸 수 있나 · 요청 보내기.
// 연결 방식은 다시 쓰기와 같다 (직접 선택 = 공급자 + 모델 · 공용 모델 목록 / 연결 프로필). 「지금 연결」은 예전처럼 본문 모델이 태그를 쓴다.
import { getRequestHeaders, substituteParams, extractMessageFromData } from '../../../../../../../script.js';
import { extension_settings } from '../../../../../../extensions.js';
import { ChatCompletionService } from '../../../../../../custom-request.js';
import { oai_settings } from '../../../../../../openai.js';
import { SECRET_KEYS, secret_state } from '../../../../../../secrets.js';
import { ConnectionManagerRequestService } from '../../../../../shared.js';
import { addonsEnabled } from '../../usage-mode.js';
import { applyModelRequestRules, lowEffort, THINK_MIN_TOKENS, thoughtOnly } from '../../live-models.js';

/** 6.4.1 정말 생각하는 모델인가 — 출력 한도 바닥은 이때만. Claude · Google 은 lowEffort 가 이미 고른 모델(Claude 5 · Fable · Gemini 3 이후)이고,
 *  OpenAI 는 실리태번 서버의 추론 모델 목록과 같은 판정(o 시리즈 · gpt-5 이후, gpt-5-chat-latest 빼고) — gpt-4o-mini 같은 모델은 출력 상한 4096 이라 8192 면 400 */
export function pickThinks(source, model, effort = lowEffort(source, model)) {
    if (!effort) return false;
    if (source !== 'openai') return true;
    const m = String(model || '');
    return /^o\d/.test(m) || (/^gpt-[5-9]/.test(m) && !/^gpt-5-chat-latest/.test(m));
}
import { PROVIDERS, normalizeUrl, resolveModel, isHttpUrl, providerKeyOf } from '../rewrite/providers.js';
import { fallbackOf, withFallback } from '../modelswitch/fallback.js';   // 6.2.9 검열되면 다른 모델로
import { settings, normalizePick, PICK_DEFAULTS } from './state.js';

export { PICK_DEFAULTS, normalizePick };

export const pickSettings = () => settings()?.pick ?? normalizePick();

function addonActive() {
    const theme = extension_settings?.salty;
    return !!theme?.addons?.assets && addonsEnabled(theme);
}

/** Custom: 이 칸의 주소, 비면 실리태번 본체 주소 (그때는 본체의 추가 헤더 · 본문도) */
export function customEndpoint(pick = pickSettings()) {
    const own = normalizeUrl(pick.customUrl);
    if (own) return { url: own, inheritExtras: false };
    return { url: normalizeUrl(oai_settings?.custom_url), inheritExtras: true };
}

const hasSecret = name => { const value = secret_state?.[SECRET_KEYS?.[name]]; return Array.isArray(value) ? value.length > 0 : Boolean(value); };

/** 연결이 정해졌나 — 까닭('' = 됨) */
export function connectionProblem(pick = pickSettings()) {
    if (pick.connection === 'current') return 'current';
    if (pick.connection === 'profile') {
        if (!pick.profileId) return '연결 프로필을 골라 주세요.';
        try { if (!ConnectionManagerRequestService.getSupportedProfiles().some(p => p.id === pick.profileId)) return '고른 연결 프로필이 없어요. 다시 골라 주세요.'; }
        catch { return '연결 관리자를 쓸 수 없어요. 실리태번의 Connection Manager 를 켜 주세요.'; }
        return '';
    }
    const provider = PROVIDERS[pick.provider];
    if (!provider) return '공급자를 골라 주세요.';
    const endpoint = pick.provider === 'custom' ? customEndpoint(pick) : undefined;
    if (!resolveModel(pick, endpoint)) return '모델을 골라 주세요.';
    if (pick.provider === 'custom' && !isHttpUrl(endpoint.url)) return 'Custom 주소를 넣거나 본체의 Custom 연결을 설정해 주세요.';
    if (pick.provider !== 'custom' && !provider.secrets.some(hasSecret)) return `${provider.label} API 키가 실리태번에 저장되어 있지 않아요.`;
    return '';
}

/**
 * 다른 모델이 고르기가 지금 도나 — 이미지 프롬프트 켬 · 애드온 켬 · 스위치 켬 · 연결(직접 · 프로필)이 정해짐.
 * 「지금 연결」이면 false (예전처럼 본문 모델이 쓴다).
 */
export function pickActive(store = settings()) {
    if (!store || store.promptEnabled === false || store.renderEnabled === false || !addonActive()) return false;
    const pick = store.pick ?? normalizePick(store);
    return pick.enabled && connectionProblem(pick) === '';
}

/** 화면에 보일 연결 이름 */
export function connectionLabel(pick = pickSettings()) {
    if (pick.connection === 'profile') {
        try { return ConnectionManagerRequestService.getSupportedProfiles().find(p => p.id === pick.profileId)?.name || '연결 프로필'; } catch { return '연결 프로필'; }
    }
    if (pick.connection !== 'direct') return '본문 모델';
    const model = resolveModel(pick, pick.provider === 'custom' ? customEndpoint(pick) : undefined);
    return `${PROVIDERS[pick.provider]?.label ?? pick.provider} · ${model || '모델 없음'}`;
}

/** 고르는 모델에게 보낸다 → 답 글. signal 로 멈춘다.
 *  6.2.9 검열되면 다른 모델로 (모델 전환 「캐릭터 에셋 (검열되면)」 — 켜고 고른 때만): 내용 차단으로 막히면 그 모델로 한 번 더 */
export async function generatePick(messages, signal) {
    const pick = pickSettings();
    const main = pick.connection === 'direct' ? { provider: PROVIDERS[pick.provider]?.source || pick.provider, model: resolveModel(pick, pick.provider === 'custom' ? customEndpoint(pick) : undefined), url: pick.provider === 'custom' ? customEndpoint(pick).url : '' } : null;
    return withFallback(() => generatePickOnce(messages, signal), { target: fallbackOf(pick), failed: main, send: target => generatePickOnce(messages, signal, target) });
}

async function generatePickOnce(messages, signal, via = null) {
    const pick = pickSettings();
    if (!via && pick.connection === 'profile') {
        const result = await ConnectionManagerRequestService.sendRequest(pick.profileId, messages, pick.maxTokens, { stream: false, signal, extractData: true, includePreset: true });
        return result?.content ?? '';
    }
    const key = via ? providerKeyOf(via.provider) : pick.provider;
    const provider = PROVIDERS[key];
    const endpoint = key === 'custom' ? customEndpoint(pick) : undefined;
    const model = via ? String(via.model || '') : resolveModel(pick, endpoint);
    if (!provider || !model) throw new Error('모델이 정해지지 않았어요.');
    const request = { messages, model, chat_completion_source: provider.source, temperature: 0.4, max_tokens: pick.maxTokens, stream: false };
    // 6.4.1 생각하는 모델은 생각도 출력 한도를 쓴다 — 번역(6.3.5)과 같은 규칙: 생각은 짧게(low) · 출력 한도는 최소 8192 (정말 생각하는 모델만)
    const effort = lowEffort(provider.source, model);
    if (effort) request.reasoning_effort = effort;
    if (pickThinks(provider.source, model, effort) && request.max_tokens > 0 && request.max_tokens < THINK_MIN_TOKENS) request.max_tokens = THINK_MIN_TOKENS;
    if (key === 'custom') {
        if (!endpoint.url) throw new Error('Custom 주소가 없어요.');
        request.custom_url = endpoint.url;
        if (endpoint.inheritExtras) {
            request.custom_include_body = substituteParams(oai_settings?.custom_include_body || '');
            request.custom_exclude_body = substituteParams(oai_settings?.custom_exclude_body || '');
            request.custom_include_headers = substituteParams(oai_settings?.custom_include_headers || '');
        }
    }
    if (key === 'vertexai') {
        request.vertexai_auth_mode = oai_settings?.vertexai_auth_mode || 'full';
        request.vertexai_region = oai_settings?.vertexai_region || 'us-central1';
        request.vertexai_express_project_id = oai_settings?.vertexai_express_project_id || '';
    }
    applyModelRequestRules(key, model, request);
    // 6.4.1 원본 응답으로 받는다 — 「생각만 오고 글이 없음」(출력 한도를 생각에 다 씀)을 번역처럼 알아보려고. 글은 실리태번과 같은 방법으로 뽑는다
    const data = await ChatCompletionService.processRequest(request, {}, false, signal);
    const content = String(extractMessageFromData(data, 'openai') ?? '');
    if (!content.trim() && thoughtOnly(data)) throw new Error('모델이 생각하느라 출력 한도를 다 써서 고른 답이 오지 않았어요');
    return content;
}

/** 목록 받기 요청 모양 (다시 쓰기 providers.js 와 같다) */
export function listRequest(pick = pickSettings()) {
    const endpoint = pick.provider === 'custom' ? customEndpoint(pick) : undefined;
    const includeHeaders = endpoint?.inheritExtras ? substituteParams(oai_settings?.custom_include_headers || '') : '';
    return { endpoint, includeHeaders, headers: getRequestHeaders };
}
