// 8.0.6 프리셋이 화면에서 숨기거나 번역할 필요가 없는 블록 — 번역 요청에 보내지 않고 제자리에 원문 그대로 둔다 (index.js getCombinedRegexes 맨 뒤).
//   번역기 보호 규칙 목록 맨 뒤에 붙어서, 이 블록이 없는 답의 [[__VAR_n__]] 번호 · 문단 캐시 키는 예전 그대로예요.
//   실리태번 모듈을 import 하지 않아요 (node 시험: tools/tests/translator-preset-compat.mjs).
const ROW = String.raw`[ \t]*(?:(?:[-*•·]|\d+[.)])[ \t]*)?(?:\*{1,2}|_{1,2})?@?`;
export const HIDDEN_BLOCKS = Object.freeze([
    // 데우스 V3 「! Thinking ! (FALLBACK)」: 모델이 <think> 없이 생각 줄(Context: … Knowledge: … Prose Length:)을 답 머리에 쓴 것.
    //   원작 정규식(Thinking (Fallback) wrapper)이 접힌 「Thinking Plan」 카드로 그리는 생각이에요 — 장면 계획(scene_plan)처럼 번역하지 않아요.
    //   답 맨 앞에서 Context 줄로 시작하고 Prose Plan · Response Structure · Story progression · Prose Length 줄을 품고, <tracker> · <prose> 바로 앞에서 끝날 때만.
    new RegExp(String.raw`(?<![\s\S])(?![\s\S]*<\/?think\b)(?=(?:[^<\n]{0,200}\n){0,3}${ROW}Context(?:\*{1,2}|_{1,2})?[ \t]*:)`
        + String.raw`(?=(?:(?!<(?:tracker|prose)\b)[\s\S])*?^${ROW}(?:Prose Plan|Response Structure|Story progression|Prose Length)\b)`
        + String.raw`(?:(?!<\/?(?:tracker|prose|scene_plan|scene_reasoning|content)\b)[\s\S])*?\S(?=\s*(?:\`{1,3}[a-z]{0,12}\s*)?<(?:tracker|prose)\b)`, 'im'),
    // 과일 계열 「清除多余内容」 정규식이 화면에서 지우는 것: <disclaimer> · <finish> 블록, [finire] 앞 전부(생각)
    /<(disclaimer|finish)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    /(?<![\s\S])[\s\S]*\[finire\]/i,
    // 본문에 섞인 <style> · <script> — 글자로 보이지 않는 코드 (상태 카드 안의 것은 display-cards.js 가 이미 보내지 않아요)
    /<(style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
]);
/** 글 전체가 위 블록 하나인가 — 모델이 자리표시를 빠뜨려도 제자리에 되돌릴 블록 (index.js droppedPlaceholders) */
export function isHiddenBlock(block) {
    const value = String(block ?? '');
    // 생각 줄 규칙은 뒤에 <tracker> · <prose> 가 와야 맞으니 그 꼴을 붙여 본다 — 맞은 글이 블록 전체일 때만
    return value.trim() !== '' && HIDDEN_BLOCKS.some(rule => [value, `${value}\n\n<prose>`].some(probe => {
        const m = new RegExp(rule.source, rule.flags.replace('g', '')).exec(probe);
        return m?.index === 0 && m[0] === value;
    }));
}
