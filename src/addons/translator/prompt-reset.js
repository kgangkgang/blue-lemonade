// 3.1.6 프롬프트 편집 칸의 「기본값으로」 단추 — 기본 프롬프트(채팅 번역 · ⚙️ 재번역 · 입력 · 보내기 · 프리필)를 처음 값으로 되돌린다.
//   번역기 설정은 키가 아예 없을 때만 기본값으로 채워서(loadSettings), 고쳐 저장한 프롬프트는 테마를 다시 받아도 안 돌아왔다(커뮤니티 질문).
//   사용자 정의 프롬프트는 대상이 아니다(지우기 단추가 그 자리). 실리태번 · 화면 없이 node 시험에서도 불러올 수 있게 순수 함수만.

/** 편집 칸에서 기본값으로 되돌릴 수 있는 기본 프롬프트 열쇠 — 고르기 칸(#prompt_select)의 기본 항목과 같은 차례 */
export const RESETTABLE_PROMPT_KEYS = Object.freeze([
    'llm_prompt_chat',
    'llm_prompt_retranslate_correction',
    'llm_prompt_retranslate_guidance',
    'llm_prompt_retranslate_paragraph',
    'llm_prompt_input',
    'llm_prompt_send',
    'llm_prefill_content',
]);

/** 이 열쇠가 기본값으로 되돌릴 수 있는 기본 프롬프트인가 (사용자 정의 프롬프트 id · 빈 값 · 모르는 열쇠는 아님) */
export function canResetPrompt(key, defaults) {
    return RESETTABLE_PROMPT_KEYS.includes(key) && typeof defaults?.[key] === 'string';
}

/** 저장 단추는 앞뒤 빈칸을 걷어 저장하니 같은지는 앞뒤 빈칸을 빼고 본다 */
export function sameAsDefault(value, defaultValue) {
    return String(value ?? '').trim() === String(defaultValue ?? '').trim();
}

/** 단추 상태 — 사용자 정의 프롬프트면 숨김, 저장값 · 편집 칸 글이 모두 기본값이면 꺼짐 */
export function resetButtonState(key, { settings, defaults, editorText, isCustom = false } = {}) {
    if (isCustom || !canResetPrompt(key, defaults)) return { visible: false, enabled: false };
    const def = defaults[key];
    const changed = !sameAsDefault(settings?.[key], def) || (editorText !== undefined && !sameAsDefault(editorText, def));
    return { visible: true, enabled: changed };
}

/** 기본값으로 되돌리고 되돌리기 전 저장값을 돌려준다 (알림의 「되돌리기 취소」에 쓴다). 되돌릴 게 없으면 null */
export function resetPrompt(settings, key, defaults) {
    if (!settings || !canResetPrompt(key, defaults)) return null;
    const prev = settings[key];
    const def = defaults[key];
    if (sameAsDefault(prev, def) && prev === def) return null;
    settings[key] = def;
    return { key, prev: typeof prev === 'string' ? prev : '' };
}

/** 「되돌리기 취소」: 되돌리기 전 값을 다시 넣는다 — 그 뒤 사용자가 또 고쳤으면(기본값이 아니면) 덮지 않는다 */
export function undoPromptReset(settings, undo, defaults) {
    if (!settings || !undo || !canResetPrompt(undo.key, defaults)) return false;
    if (settings[undo.key] !== defaults[undo.key]) return false;
    settings[undo.key] = undo.prev;
    return true;
}
