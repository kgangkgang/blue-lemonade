// Keep the configured system instruction position. Gemini continuation requests
// must still end with a user turn; never relabel or remove the previous answer.
export const CONTINUE_DIRECTION = 'Continue the story following the director\'s instructions above.';

// 서버는 끝의 assistant 턴을 미리 채우기(prefill)로 바꾸므로, 이어 쓰기(continue)와 '답변 시작 문구'가 있을 때는
// user 턴을 덧붙이지 않는다 — 덧붙이면 continue_prefill 이어 쓰기와 미리 채우기가 깨진다.
export function insertDirection(messages, template, direction, depth, model, { type = '', prefill = '' } = {}) {
    if (!Array.isArray(messages) || !template?.trim()) return;
    const message = { role: 'system', content: template.replace(/\{\{direction\}\}/gi, () => direction) };
    const offset = Math.max(0, Math.trunc(Number(depth) || 0));
    messages.splice(Math.max(0, messages.length - offset), 0, message);

    if (!/(?:^|[\s/:])gemini[-.]/i.test(String(model ?? ''))) return;
    if (type === 'continue' || String(prefill ?? '').trim()) return;
    let lastTurn;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (!['system', 'developer'].includes(messages[i]?.role)) { lastTurn = messages[i]; break; }
    }
    if (!lastTurn || (lastTurn.role === 'assistant' && !lastTurn.tool_calls?.length && !lastTurn.function_call)) {
        messages.push({ role: 'user', content: CONTINUE_DIRECTION });
    }
}
