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
    // 2026-10-06 이어 쓰기(continue prefill)는 이어 쓸 답이 맨 끝 assistant 턴이다 — 위치 0 이면 그 뒤에 붙어 새 답이 되므로 그 앞에 넣는다
    const minimum = type === 'continue' && messages.at(-1)?.role === 'assistant' ? 1 : 0;
    const offset = Math.max(minimum, Math.trunc(Number(depth) || 0));
    messages.splice(Math.max(0, messages.length - offset), 0, ...list.map(content => ({ role: 'system', content })));
    appendContinueTurn(messages, model, { type, prefill, appendUser });
}

const ROLES = new Set(['system', 'user', 'assistant']);
const depthOf = part => Math.max(0, Math.trunc(Number(part.depth) || 0));

/**
 * 1.4.0 넣는 곳이 저마다 다른 지시를 최종 메시지 목록에 넣는다. 메인 프롬프트 앞 · 뒤는 실리태번 확장 프롬프트로 따로 넣는다(index.js).
 * parts: [{ content, at, depth, role }] — 목록 순서가 같은 자리 안의 순서
 *   start: 맨 앞 · depth: 끝에서 depth 번째 메시지 앞(0 = 맨 끝) · end: 맨 끝(서버가 붙이는 답변 시작 문구보다는 앞)
 * 이어 쓰기(continue)는 이어 쓸 답(맨 끝 assistant 턴) 뒤에 붙으면 새 답이 되므로 그 앞에 넣는다 (깊이 0 · 맨 끝 모두).
 * 깊은 자리부터 넣는다: 얕은 자리(끝에 가까운)를 먼저 넣으면 깊은 자리의 셈이 밀린다.
 */
export function placeInstructions(messages, parts, model, { type = '', prefill = '', appendUser = true } = {}) {
    const list = (Array.isArray(parts) ? parts : []).filter(part => typeof part?.content === 'string' && part.content.trim());
    if (!Array.isArray(messages)) return;
    // 전개 지시를 메인 프롬프트 앞 · 뒤에만 넣어 여기서 넣을 것이 없어도, 제미니의 이어 가기 user 턴은 붙인다
    if (!list.length) return appendContinueTurn(messages, model, { type, prefill, appendUser });
    const message = part => ({ role: ROLES.has(part.role) ? part.role : 'system', content: part.content });
    const continuing = type === 'continue' && messages.at(-1)?.role === 'assistant';
    const start = list.filter(part => part.at === 'start');
    if (start.length) messages.splice(0, 0, ...start.map(message));
    const inChat = list.filter(part => part.at !== 'start' && part.at !== 'end');
    for (const depth of [...new Set(inChat.map(depthOf))].sort((a, b) => b - a)) {
        const offset = Math.max(continuing ? 1 : 0, depth);
        messages.splice(Math.max(0, messages.length - offset), 0, ...inChat.filter(part => depthOf(part) === depth).map(message));
    }
    const end = list.filter(part => part.at === 'end');
    if (end.length) messages.splice(continuing ? messages.length - 1 : messages.length, 0, ...end.map(message));
    appendContinueTurn(messages, model, { type, prefill, appendUser });
}

/** 제미니에서 끝이 assistant 턴이면 「지시대로 이어 가라」 user 턴을 덧붙인다 — 전개 지시가 들어갈 때만, 이어 쓰기 · 답변 시작 문구가 있으면 덧붙이지 않는다 */
function appendContinueTurn(messages, model, { type = '', prefill = '', appendUser = true } = {}) {
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
