// 5.8.0 본채팅 요청에도 Claude 5 세대 규칙.
// 실리태번 본체(1.19.0, chat-completions.js isClaude5Model = /claude-(opus-5|sonnet-5)/)가 2026-10-07 에 나온 claude-haiku-5-5 를
// Claude 5 로 알아보지 못해 온도 · top_p · top_k 를 그대로 보내고, Claude 5 세대는 기본값이 아닌 샘플링 값을 받지 않는다(오류).
// 보내기 직전(CHAT_COMPLETION_SETTINGS_READY)에 Claude 5 이후 모델이면 샘플링 값만 뺀다 — 테마의 다른 기능(번역 · 다시 쓰기 · TTS)이
// 쓰는 live-models.js 규칙과 같은 판단. 본체가 이미 빼는 모델(opus-5 · sonnet-5 · fable)은 결과가 같고, Claude 5 가 아닌 모델은 그대로.
// 다시 쓰기 리롤(reroll.js)은 같은 요청 객체를 잡아 두므로 처리 순서와 상관없이 같은 값으로 다시 보낸다.
import { isClaude5Plus } from './live-models.js';

const SAMPLING = ['temperature', 'top_p', 'top_k', 'frequency_penalty', 'presence_penalty'];

/** 보낼 요청(generate_data)을 그 자리에서 고친다. @returns {string[]} 뺀 키 */
export function stripClaude5Sampling(data) {
    if (!data || typeof data !== 'object' || !isClaude5Plus(String(data.model ?? ''))) return [];
    const removed = SAMPLING.filter(key => Object.hasOwn(data, key));
    for (const key of removed) delete data[key];
    return removed;
}

let started = false;

export function startMainChatRules() {
    if (started) return;
    try {
        const { eventSource, event_types } = SillyTavern.getContext();
        const name = event_types?.CHAT_COMPLETION_SETTINGS_READY;
        if (!name) return;
        eventSource.on(name, (data) => {
            try { stripClaude5Sampling(data); } catch (error) { console.warn('[블루 레몬에이드] 본채팅 Claude 5 규칙', error); }
        });
        started = true;
    } catch (error) {
        console.warn('[블루 레몬에이드] 본채팅 Claude 5 규칙을 켜지 못했어요', error);
    }
}
