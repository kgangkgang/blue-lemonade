// 7.4.0 사용량 장부 — 블루레몬에이드가 스스로 적는 몫. 요청 로그의 기록(성능 보조 capture.js 가 응답에서 읽은 실제 usage)을 장부 한 건으로 바꾼다 (순수 함수).
//   실리태번 본 생성(본 답 · 다시 생성 · 스와이프 · 이어 쓰기 · 사칭)과 BL 기능(번역 · 번역 다시 · 다시 쓰기 · TTS 대사 분석 · 전개 지시 …)만.
//   다른 확장의 요청은 그 확장이 스스로 적는다 (두 번 세지 않게). TTS 음성(글자 과금)은 TTS 애드온이 소리를 받을 때 따로 적는다.
// 토큰: 입력 = 캐시 포함 전체(capture 의 promptTokens), 출력 = 생각 포함 전체(completionTokens — Gemini 는 thoughtsTokenCount 를 더해 둠), 생각 = reasoningTokens(정보용)

export const BL_EXT = '블루레몬에이드';
export const MAIN_EXT = '실리태번';
const MAIN = Object.freeze({ 'chat.generate': '본 답', 'chat.regenerate': '다시 생성', 'chat.swipe': '스와이프', 'chat.continue': '이어 쓰기', 'chat.impersonate': '사칭(내 대사 쓰기)' });
const OWN = Object.freeze({
    'translation.chat': '번역', 'translation.retranslate': '번역 다시(교정)', 'translation.input': '번역 (보낼 글)', 'translation.glossary': '번역 용어집',
    'translation.bookmark': '번역 (북마크)', 'translation.tts': '번역 (TTS 듣는 말)', 'translation.persona': '번역 (페르소나)',
    rewrite: '다시 쓰기', direction: '전개 지시', 'tts.analysis': 'TTS 대사 분석', 'tts.translate': 'TTS 듣는 말 번역',
});
/** BL 안 애드온이 요청 로그에 남기는 호출자 이름 (capture.js OWN_ADDONS) */
export const OWN_CALLERS = Object.freeze(['llm-translator-custom', 'ban-word-rewrite', 'story-direction', 'bl-tts', 'chat-bookmarks', 'prompt-panel']);

/** 요청 로그 한 건 → 장부 기록 (안 적을 것이면 null) */
export function ledgerEntryFromLog(log) {
    if (!log || typeof log !== 'object' || log.kind !== 'text') return null;
    let ext, feature;
    if (log.caller === 'chat' && MAIN[log.purpose]) { ext = MAIN_EXT; feature = MAIN[log.purpose]; }
    else if (OWN_CALLERS.includes(log.caller) && OWN[log.purpose]) { ext = BL_EXT; feature = OWN[log.purpose]; }
    else return null;
    const input = Number(log.promptTokens) || 0, output = Number(log.completionTokens) || 0;
    // 실패 · 중단도 적는다 (돈이 나갔을 수 있다) — 토큰이 하나도 없는 실패(HTTP 오류 등 과금 안 된 것)만 뺀다
    if (!log.ok && !input && !output) return null;
    const reported = log.pricing?.kind === 'reported' && Number.isFinite(log.pricing?.cost) ? log.pricing.cost : undefined;
    return {
        ext, feature, model: log.model || log.requestedModel || '', api: log.source || '', provider: log.connection?.provider || '', origin: log.connection?.origin || '',
        input, output, cachedInput: Number(log.cachedTokens) || 0, thinking: Number(log.reasoningTokens) || 0,
        estimated: !!log.estimated, ok: !!log.ok, at: log.at, chatId: log.chatId || '', requestId: log.id || '',
        ...(reported !== undefined ? { reportedUsd: reported } : {}),
    };
}
