// 「참고할 최근 대화」는 번역 프롬프트의 {{llmContext}} 자리에만 들어가요. 자리가 없으면 이 설정이 쓰이지 않으니 화면에 알리고 넣어 줘요.
export const CONTEXT_SLOT = '{{llmContext}}';
export const CONTEXT_BLOCK = `# Recent conversation (reference only, do not translate)\n${CONTEXT_SLOT}`;
export const usesContextSlot = prompt => String(prompt ?? '').includes(CONTEXT_SLOT);
export function withContextSlot(prompt) {
    const text = String(prompt ?? '').trimEnd();
    if (usesContextSlot(text)) return text;
    return text ? `${text}\n\n${CONTEXT_BLOCK}` : CONTEXT_BLOCK;
}
