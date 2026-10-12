// 캐릭터 에셋 1.6.0 — 「다른 모델이 고르기」 연결: 설정 · 쓸 수 있나 · 요청 보내기.
// 연결 방식은 다시 쓰기와 같다 (직접 선택 = 공급자 + 모델 · 공용 모델 목록 / 연결 프로필). 「지금 연결」은 예전처럼 본문 모델이 태그를 쓴다.
import { getRequestHeaders, substituteParams } from '../../../../../../../script.js';
import { extension_settings } from '../../../../../../extensions.js';
import { ChatCompletionService } from '../../../../../../custom-request.js';
import { oai_settings } from '../../../../../../openai.js';
import { SECRET_KEYS, secret_state } from '../../../../../../secrets.js';
import { ConnectionManagerRequestService } from '../../../../../shared.js';
import { addonsEnabled } from '../../usage-mode.js';
import { applyModelRequestRules } from '../../live-models.js';
import { PROVIDERS, normalizeUrl, resolveModel, isHttpUrl } from '../rewrite/providers.js';
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

/** 고르는 모델에게 보낸다 → 답 글. signal 로 멈춘다 */
export async function generatePick(messages, signal) {
    const pick = pickSettings();
    if (pick.connection === 'profile') {
        const result = await ConnectionManagerRequestService.sendRequest(pick.profileId, messages, pick.maxTokens, { stream: false, signal, extractData: true, includePreset: true });
        return result?.content ?? '';
    }
    const provider = PROVIDERS[pick.provider];
    const endpoint = pick.provider === 'custom' ? customEndpoint(pick) : undefined;
    const model = resolveModel(pick, endpoint);
    if (!provider || !model) throw new Error('모델이 정해지지 않았어요.');
    const request = { messages, model, chat_completion_source: provider.source, temperature: 0.4, max_tokens: pick.maxTokens, stream: false };
    if (pick.provider === 'custom') {
        if (!endpoint.url) throw new Error('Custom 주소가 없어요.');
        request.custom_url = endpoint.url;
        if (endpoint.inheritExtras) {
            request.custom_include_body = substituteParams(oai_settings?.custom_include_body || '');
            request.custom_exclude_body = substituteParams(oai_settings?.custom_exclude_body || '');
            request.custom_include_headers = substituteParams(oai_settings?.custom_include_headers || '');
        }
    }
    if (pick.provider === 'vertexai') {
        request.vertexai_auth_mode = oai_settings?.vertexai_auth_mode || 'full';
        request.vertexai_region = oai_settings?.vertexai_region || 'us-central1';
        request.vertexai_express_project_id = oai_settings?.vertexai_express_project_id || '';
    }
    applyModelRequestRules(pick.provider, model, request);
    const result = await ChatCompletionService.processRequest(request, {}, true, signal);
    return result?.content ?? '';
}

/** 목록 받기 요청 모양 (다시 쓰기 providers.js 와 같다) */
export function listRequest(pick = pickSettings()) {
    const endpoint = pick.provider === 'custom' ? customEndpoint(pick) : undefined;
    const includeHeaders = endpoint?.inheritExtras ? substituteParams(oai_settings?.custom_include_headers || '') : '';
    return { endpoint, includeHeaders, headers: getRequestHeaders };
}
