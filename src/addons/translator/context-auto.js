import { ContextSelectionError, createSillyTavernContextServices, selectRecentContext } from '../../recent-context.js';
import { THINK_MIN_TOKENS } from '../../live-models.js';

// Resolved only after the final request messages and reply reservation are known.
export const AUTO_CONTEXT = Object.freeze({ chat: '\uE000BL_CONTEXT_CHAT\uE001', input: '\uE000BL_CONTEXT_INPUT\uE001', send: '\uE000BL_CONTEXT_SEND\uE001' });
// 2.8.2 대화 범위를 셀 때 떼어 두는 응답 몫. 응답 길이를 100000 처럼 크게 두면 컨텍스트 − 응답 길이가 0 이하라 대화를 한 줄도 못 넣었다.
//   번역 답은 보낸 글보다 길지 않다(토큰당 ≈1.2자) — 2.8.3 묶음 상한이 응답 길이를 따르게 되어 몫도 요청 글자 수 ÷ 1.2 토큰까지로 잡고,
//   생각하는 모델 몫(번역기가 출력 한도를 THINK_MIN_TOKENS 8192 까지 올림)을 바닥으로 둔다. 예약만 묶고 실제 요청의 max_tokens 는 그대로 둔다
export const AUTO_REPLY_RESERVE_MAX = THINK_MIN_TOKENS;
export function autoReplyReserve(replyTokens, messages) {
    const chars = (messages || []).reduce((sum, message) => sum + (typeof message?.content === 'string'
        ? Object.values(AUTO_CONTEXT).reduce((text, marker) => text.split(marker).join(''), message.content).length : 0), 0);
    return Math.min(replyTokens, Math.max(AUTO_REPLY_RESERVE_MAX, Math.ceil(chars / 1.2)));
}
export const hasAutoContext = text => typeof text === 'string' && Object.values(AUTO_CONTEXT).some(marker => text.includes(marker));
export function markAutoContext(prompt, isInputTranslation = false) {
    return prompt.replace(/\{\{llmContext\}\}/g, () => AUTO_CONTEXT[isInputTranslation ? 'input' : 'chat']);
}
function historyState(context) {
    return (context.chat || []).map((message, index) => ({ index, name: String(message?.name || ''),
        text: String(message?.mes || ''), user: message?.is_user === true, system: message?.is_system === true,
        swipe: message?.swipe_id ?? null }));
}
export function autoContextFingerprint(context, settings, connection = '') {
    // 2.6.1 그룹 채팅의 characterId · name2 는 답을 만드는 동안만 말하는 캐릭터였다가 끝나면 비워진다 → 그룹이면 견주지 않는다 (번역 감시 열쇠와 같은 까닭)
    const group = context.groupId ?? null;
    return JSON.stringify([context.chatId ?? context.getCurrentChatId?.() ?? null, group === null ? context.characterId ?? null : null,
        group, context.mainApi, context.name1, group === null ? context.name2 : null, connection, settings.context_message_auto === true,
        settings.context_include_user === true, settings.context_exclude_last !== false,
        settings.send_ctx_history === true, settings.send_ctx_persona === true, settings.send_ctx_char === true,
        settings.send_ctx_note === true, settings.send_ctx_wi === true, historyState(context)]);
}
function contextChanged() {
    return Object.assign(new ContextSelectionError('CONTEXT_CHANGED', '참고할 대화나 연결 설정이 바뀌어 번역을 멈췄어요. 다시 시도해 주세요.'), { cancelled: true });
}
export function captureAutoContextGuard(getContext, getSettings, getConnection = () => '') {
    const context = getContext(), chat = context.chat;
    const stamp = autoContextFingerprint(context, getSettings(), getConnection());
    return { stamp, isCurrent: () => getContext().chat === chat && autoContextFingerprint(getContext(), getSettings(), getConnection()) === stamp,
        assert() { if (!this.isCurrent()) throw contextChanged(); } };
}

/** Fill every auto reference in one calculation, including duplicate references in a prompt. */
export async function prepareTranslatorAutoContext({ payload, getContext, getSettings, getConnection,
    getMaxPromptTokens, getMaxContextTokens, countTokensOpenAIAsync, signal, targetContextTokens = null, onSelected }) {
    const messages = payload?.messages;
    if (!Array.isArray(messages)) {
        if (hasAutoContext(JSON.stringify(payload))) throw new ContextSelectionError('UNSUPPORTED_REQUEST', '현재 요청 형식은 자동 대화 범위를 계산할 수 없어요. 대화 개수를 직접 골라 주세요.');
        return payload;
    }
    if (!messages.some(message => hasAutoContext(message?.content))) return payload;
    const settings = getSettings(), context = getContext(), guard = captureAutoContextGuard(getContext, getSettings, getConnection);
    if (settings.context_message_auto !== true) throw contextChanged();
    if (['tools', 'functions', 'response_format', 'responseSchema', 'json_schema', 'system', 'systemInstruction', 'system_instruction', 'system_prompt', 'prompt', 'prefix', 'suffix', 'documents', 'context']
        .some(key => payload[key] != null && payload[key] !== '' && (!Array.isArray(payload[key]) || payload[key].length)) ||
        [payload.custom_include_body, payload.custom_exclude_body].some(value => typeof value === 'string' && value.trim())) {
        throw new ContextSelectionError('UNSUPPORTED_REQUEST', '추가 요청 본문이나 도구 설정의 토큰 수를 확실히 계산할 수 없어요. 대화 개수를 직접 골라 주세요.');
    }
    const replyTokens = Number(payload.max_completion_tokens ?? payload.max_tokens);
    if (!Number.isSafeInteger(replyTokens) || replyTokens <= 0) throw new ContextSelectionError('INVALID_BUDGET', '번역 응답 길이를 확인하지 못했어요. 출력 길이나 대화 개수를 직접 설정해 주세요.');
    const present = Object.entries(AUTO_CONTEXT).filter(([, marker]) => messages.some(message => typeof message.content === 'string' && message.content.includes(marker))).map(([kind]) => kind);
    const state = historyState(context), last = state.length - 1;
    const eligible = (message, kind) => message.text.trim() !== '' && (kind === 'send'
        ? !message.system && message.index !== last
        : (settings.context_include_user === true || !message.user) && (kind === 'input' || settings.context_exclude_last === false || message.index !== last));
    const history = state.filter(message => present.some(kind => eligible(message, kind))).map(message => {
        // Resolve simple names without executing stateful macros on every search probe.
        const text = message.text.replace(/\{\{(user|char)\}\}/gi, (_, who) => String(who.toLowerCase() === 'user' ? context.name1 || '' : context.name2 || ''));
        if (/\{\{[\s\S]*?\}\}/.test(text)) throw new ContextSelectionError('UNSUPPORTED_MACRO', '참고 대화에 실행이 필요한 매크로가 있어요. 대화 개수를 직접 골라 주세요.');
        return { ...message, text };
    });
    const services = createSillyTavernContextServices({ getMaxPromptTokens, getMaxContextTokens, countTokensOpenAIAsync,
        getMainApi: () => getContext().mainApi, replyTokens: autoReplyReserve(replyTokens, messages), targetContextTokens });
    try {
        const selected = await selectRecentContext({ history, ...services, isCurrent: guard.isCurrent, signal,
            // A first translation may have no earlier history; its actual translation body remains in the base payload.
            allowEmptyHistory: true,
            buildRequest: picked => messages.map(message => {
                if (typeof message.content !== 'string') return message;
                let content = message.content;
                for (const kind of present) {
                    const text = picked.filter(item => eligible(item, kind)).map(item => kind === 'send' ? `${item.name}: ${item.text}` : item.text).join('\n\n');
                    content = content.split(AUTO_CONTEXT[kind]).join(text);
                }
                return { ...message, content };
            }),
        });
        guard.assert();
        if (selected.request.some(message => hasAutoContext(message?.content))) throw new ContextSelectionError('UNRESOLVED_CONTEXT', '자동 참고 대화를 완성하지 못했어요. 다시 시도해 주세요.');
        try { onSelected?.(selected); } catch { /* Status display must not change the selected request. */ }
        return { ...payload, messages: structuredClone(selected.request) };
    } catch (error) {
        if (error?.code === 'CANCELLED' || error?.code === 'CONTEXT_CHANGED') error.cancelled = true;
        throw error;
    }
}
