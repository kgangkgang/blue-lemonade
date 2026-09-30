// Keep the configured system instruction position. Gemini continuation requests
// must still end with a user turn; never relabel or remove the previous answer.
export const CONTINUE_DIRECTION = 'Continue the story following the director\'s instructions above.';

// 서버는 끝의 assistant 턴을 미리 채우기(prefill)로 바꾸므로, 이어 쓰기(continue)와 '답변 시작 문구'가 있을 때는
// user 턴을 덧붙이지 않는다 — 덧붙이면 continue_prefill 이어 쓰기와 미리 채우기가 깨진다.
export function insertDirection(messages, template, direction, depth, model, options = {}) {
    if (!Array.isArray(messages) || !template?.trim()) return;
    insertInstructions(messages, [template.replace(/\{\{direction\}\}/gi, () => direction)], depth, model, options);
}

/**
 * 여러 지시(항상 지시 · 전개 지시)를 같은 자리에 순서대로 system 메시지로 넣는다. 빈 글은 건너뛴다.
 * appendUser: 제미니에서 끝이 assistant 턴이면 user 턴을 덧붙일지 — 전개 지시가 들어갈 때만 (예전 그대로).
 * 늘 켜 두는 항상 지시만 있을 때는 덧붙이지 않는다: 프리셋 끝의 프리필이 '이전 답변' 으로 밀리는 일이 모든 요청에서 생긴다.
 */
export function insertInstructions(messages, contents, depth, model, { type = '', prefill = '', appendUser = true } = {}) {
    const list = (Array.isArray(contents) ? contents : []).filter(content => typeof content === 'string' && content.trim());
    if (!Array.isArray(messages) || !list.length) return;
    const offset = Math.max(0, Math.trunc(Number(depth) || 0));
    messages.splice(Math.max(0, messages.length - offset), 0, ...list.map(content => ({ role: 'system', content })));

    if (!appendUser || !/(?:^|[\s/:])gemini[-.]/i.test(String(model ?? ''))) return;
    if (type === 'continue' || String(prefill ?? '').trim()) return;
    let lastTurn;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (!['system', 'developer'].includes(messages[i]?.role)) { lastTurn = messages[i]; break; }
    }
    if (!lastTurn || (lastTurn.role === 'assistant' && !lastTurn.tool_calls?.length && !lastTurn.function_call)) {
        messages.push({ role: 'user', content: CONTINUE_DIRECTION });
    }
}
