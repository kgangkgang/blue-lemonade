// Presentation choices only: never parse or rewrite saved Markdown/message text.
// The first choice preserves the current theme. One definition feeds validation,
// the settings page, search labels, and the render-only body classes.
export const MARKDOWN_CONTROLS = [
    { key: 'size', label: '제목 크기', options: [['default', '기본'], ['small', '작게'], ['large', '크게']] },
    { key: 'space', label: '블록 사이', options: [['default', '기본'], ['compact', '촘촘히'], ['relaxed', '넉넉히']] },
    { key: 'heading', label: '제목', options: [['default', '기본'], ['line', '밑선'], ['soft', '옅은 면']] },
    { key: 'hr', label: '구분선', options: [['dots', '점 세 개'], ['line', '선']] },
    { key: 'quote', label: '인용문', options: [['default', '기본'], ['line', '옆선'], ['soft', '옅은 면'], ['plain', '글자만']] },
    { key: 'list', label: '글머리 · 번호 목록', options: [['default', '기본'], ['accent', '표시 강조'], ['roomy', '항목 간격']] },
    { key: 'link', label: '링크', options: [['default', '기본'], ['plain', '색만'], ['soft', '옅은 면']] },
    { key: 'table', label: '표', options: [['default', '기본'], ['zebra', '줄무늬'], ['plain', '간결하게']] },
    { key: 'details', label: '접기', options: [['default', '기본'], ['card', '카드'], ['plain', '간결하게']] },
    { key: 'mark', label: '강조 표시', options: [['default', '기본'], ['soft', '옅은 면'], ['plain', '글자만']] },
    { key: 'underline', label: '밑줄', options: [['default', '기본'], ['accent', '포인트색'], ['wavy', '물결']] },
];
export const MARKDOWN_DEFAULTS = Object.fromEntries(MARKDOWN_CONTROLS.map(({ key, options }) => [key, options[0][0]]));
export function tidyMarkdown(value) {
    for (const { key, options } of MARKDOWN_CONTROLS) {
        if (!options.some(([id]) => id === value[key])) value[key] = MARKDOWN_DEFAULTS[key];
    }
    return value;
}
export function markdownClasses(value) {
    return MARKDOWN_CONTROLS.flatMap(({ key, options }) => {
        const selected = value?.[key];
        return selected !== options[0][0] && options.some(([id]) => id === selected) ? [`salty-md-${key}-${selected}`] : [];
    });
}
