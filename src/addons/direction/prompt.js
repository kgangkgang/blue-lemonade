// Keep the configured system instruction position. Gemini continuation requests
// must still end with a user turn; never relabel or remove the previous answer.
export const CONTINUE_DIRECTION = 'Continue the story following the director\'s instructions above.';

export function insertDirection(messages, template, direction, depth, model) {
    if (!Array.isArray(messages) || !template?.trim()) return;
    const message = { role: 'system', content: template.replace(/\{\{direction\}\}/gi, () => direction) };
    const offset = Math.max(0, Math.trunc(Number(depth) || 0));
    messages.splice(Math.max(0, messages.length - offset), 0, message);

    if (!/(?:^|[\s/:])gemini[-.]/i.test(String(model ?? ''))) return;
    let lastTurn;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (!['system', 'developer'].includes(messages[i]?.role)) { lastTurn = messages[i]; break; }
    }
    if (!lastTurn || (lastTurn.role === 'assistant' && !lastTurn.tool_calls?.length && !lastTurn.function_call)) {
        messages.push({ role: 'user', content: CONTINUE_DIRECTION });
    }
}
