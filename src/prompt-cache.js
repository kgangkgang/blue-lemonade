// 프롬프트 캐시 (Anthropic cache_control) — 번역 · TTS 대사 분석이 같이 쓴다 (7.7.2)
//
// 보조 요청은 요청마다 같은 긴 앞부분(번역 지시문 · 효과음 목록)을 다시 보낸다. Claude 는 앞부분 끝에 cache_control 을 붙인 요청만
// 그 앞부분을 5분 동안 기억해 다음 요청에서 0.1배(Opus 5.5 는 0.05배) 값으로 읽는다. 저장하는 요청은 그 앞부분이 1.25배.
//
// 실리태번 1.19 서버(prompt-converters.js convertClaudeMessages)는 메시지의 text 조각을 { type, text } 로 새로 만들어 cache_control 을 버린다.
// tool_result 조각만 그대로 두었다가, 도구가 없는 요청이면 같은 객체를 type:'text' · text = content 로 바꾼다 — 그래서 고정 앞부분을
// tool_result 조각으로 보내면 Anthropic 에는 { type:'text', text: 앞부분, cache_control } 이 간다. 글은 한 덩이로 보낼 때와 같다.
// 붙이는 곳: 실리태번 서버가 api.anthropic.com 으로 바로 보내는 Claude 요청만 (chat_completion_source 'claude', 리버스 프록시 없음,
// 도구 · 후처리 없음). 중계(OpenAI 호환 주소) · 리버스 프록시는 넘겨주는지 알 수 없어 그대로 둔다. Gemini · OpenAI 는 자동 캐시라
// 부르는 쪽이 고정 글을 앞에 두기만 한다.
//
// 밖으로:
//   CACHE_TTL_MS · minCacheTokens(model) · estimateTokens(text)
//   claudeCacheable(body) → 이 본문에 cache_control 을 붙여도 되나 (공급자 · 프록시 · 도구)
//   withPromptCache(body, head) → 첫 user 메시지가 head 로 시작하고 head 가 모델 최소 길이 이상이면 [앞부분(캐시) · 나머지] 두 조각으로 나눈 새 본문, 아니면 body 그대로
//   pureMacros(text) → 다시 치환해도 결과 · 부작용이 같은 글인가 ({{char}} · {{user}} 만 있거나 매크로가 없음)

export const CACHE_TTL_MS = 5 * 60 * 1000;

// 모델별 캐시 최소 길이 (Anthropic 문서 2026-10 — 이보다 짧으면 표시를 붙여도 조용히 캐시되지 않는다). 모르는 이름은 1024
const MIN_TOKENS = [
    [/claude-sonnet-5(?![-.]?\d)/, 1024],
    [/claude-(?:opus|sonnet|haiku)-(?:[5-9]|\d{2})|claude-(?:fable|mythos)-?\d/, 512],
    [/claude-(?:opus-4-[56]|opus-4-5|haiku-4-5)/, 4096],
    [/claude-(?:opus-4-7|mythos-preview|3-5-haiku)/, 2048],
];
export function minCacheTokens(model) {
    const name = String(model || '').toLowerCase();
    for (const [pattern, tokens] of MIN_TOKENS) if (pattern.test(name)) return tokens;
    return 1024;
}

/** 토큰 수를 적게 어림한다 (영문 4자 · 그 밖 1.5자 = 1토큰). 실제보다 크게 잡아 짧은 앞부분에 표시를 붙이지 않게 */
export function estimateTokens(text) {
    const s = String(text ?? '');
    let ascii = 0;
    for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) < 128) ascii++;
    return Math.floor(ascii / 4 + (s.length - ascii) / 1.5);
}

/** 다시 치환해도 같은 글인가 — 매크로가 없거나 {{char}} · {{user}} 만 (상태를 바꾸는 매크로를 두 번 돌리지 않게) */
export function pureMacros(text) {
    return !/\{\{(?!\s*(?:char|user)\s*\}\})/i.test(String(text ?? ''));
}

export function claudeCacheable(body) {
    if (!body || body.chat_completion_source !== 'claude') return false;
    if (String(body.reverse_proxy ?? '').trim()) return false;
    if (Array.isArray(body.tools) && body.tools.length) return false;
    if (body.custom_prompt_post_processing) return false;
    return Array.isArray(body.messages);
}

export function withPromptCache(body, head) {
    const text = String(head ?? '');
    if (!text || !claudeCacheable(body)) return body;
    const at = body.messages.findIndex(message => message?.role === 'user');
    const message = body.messages[at];
    if (at < 0 || body.messages.slice(0, at).some(m => m?.role !== 'system') || typeof message.content !== 'string') return body;
    if (!message.content.startsWith(text) || message.content.length === text.length) return body;
    if (estimateTokens(body.messages.slice(0, at).map(m => String(m?.content ?? '')).join('') + text) < minCacheTokens(body.model)) return body;
    const messages = body.messages.slice();
    messages[at] = { ...message, content: [
        { type: 'tool_result', content: text, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: message.content.slice(text.length) },
    ] };
    return { ...body, messages };
}
