// Presentation choices only: never parse or rewrite saved Markdown/message text.
// The first choice preserves the current theme. One definition feeds validation,
// the settings page, search labels, and the render-only body classes.
export const MARKDOWN_CONTROLS = [
    { key: 'size', label: '제목 크기', options: [['default', '기본'], ['small', '작게'], ['large', '크게']] },
    { key: 'space', label: '블록 사이', options: [['default', '기본'], ['compact', '촘촘히'], ['relaxed', '넉넉히']] },
    { key: 'heading', label: '제목', options: [['default', '기본'], ['line', '밑선'], ['soft', '옅은 면'], ['ribbon', '책갈피'], ['marker', '형광펜'], ['ornament', '별 장식']] },
    { key: 'hr', label: '구분선', options: [['dots', '점 세 개'], ['line', '선'], ['star', '별'], ['diamond', '다이아'], ['fade', '흐린 끝'], ['dashed', '점선']] },
    { key: 'quote', label: '인용문', options: [['default', '기본'], ['line', '옆선'], ['soft', '옅은 면'], ['plain', '글자만'], ['quotation', '따옴표'], ['notebook', '줄노트'], ['border', '테두리']] },
    { key: 'list', label: '글머리 · 번호 목록', options: [['default', '기본'], ['accent', '표시 강조'], ['roomy', '항목 간격']] },
    { key: 'link', label: '링크', options: [['default', '기본'], ['plain', '색만'], ['soft', '옅은 면']] },
    { key: 'table', label: '표', options: [['default', '기본'], ['zebra', '줄무늬'], ['plain', '간결하게'], ['grid', '격자']] },
    { key: 'details', label: '접기', options: [['default', '기본'], ['card', '카드'], ['plain', '간결하게'], ['bar', '제목 띠']] },
    { key: 'mark', label: '강조 표시', options: [['default', '기본'], ['soft', '옅은 면'], ['plain', '글자만']] },
    { key: 'underline', label: '밑줄', options: [['default', '기본'], ['accent', '포인트색'], ['wavy', '물결'], ['dotted', '점선'], ['double', '이중선']] },
    { key: 'listMark', label: '글머리 모양', options: [['default', '기본'], ['circle', '빈 원'], ['square', '네모'], ['diamond', '다이아']] },
    { key: 'strongStyle', label: '굵은 강조', options: [['default', '기본'], ['marker', '전체 칠'], ['underline', '아래 칠'], ['plain', '글자만']] },
    { key: 'inlineCode', label: '코드 글자', options: [['default', '기본'], ['outline', '테두리'], ['pill', '알약'], ['plain', '글자만']] },
    { key: 'tableHead', label: '표 제목 행', options: [['default', '기본'], ['accent', '포인트색']] },
];
export const MARKDOWN_TUNING = [
    { key:'hrWidth', label:'선 길이', min:35, max:100, step:1, default:100, unit:'%', group:'hr' },
    { key:'hrSpace', label:'위아래 여백', min:.3, max:2.5, step:.05, default:1.2, unit:'em', group:'hr' },
    { key:'quotePadding', label:'안쪽 여백', min:0, max:1.5, step:.05, default:.75, unit:'em', group:'quote' },
    { key:'quoteAlpha', label:'배경 진하기', min:0, max:35, step:1, default:10, unit:'%', group:'quote' },
    { key:'strongThick', label:'칠하는 두께', min:15, max:100, step:1, default:45, unit:'%', group:'strongStyle' },
    { key:'strongAlpha', label:'형광펜 진하기', min:0, max:70, step:1, default:30, unit:'%', group:'strongStyle' },
    { key:'listIndent', label:'들여쓰기 폭', min:1, max:2.5, step:.05, default:1.5, unit:'em', group:'list' },
    { key:'tablePadding', label:'칸 안쪽 여백', min:.15, max:1, step:.05, default:.4, unit:'em', group:'table' },
    { key:'underlineWidth', label:'선 두께', min:.5, max:4, step:.25, default:1.5, unit:'px', group:'underline' },
    { key:'underlineOffset', label:'글자와 거리', min:.05, max:.4, step:.01, default:.2, unit:'em', group:'underline' },
];
export const MARKDOWN_DEFAULTS = {
    ...Object.fromEntries(MARKDOWN_CONTROLS.map(({ key, options }) => [key, options[0][0]])),
    ...Object.fromEntries(MARKDOWN_TUNING.map(item => [item.key, item.default])),
    accentOwn:false, accentColor:'#73b9ec',
};
const validNumber = (value, item) => typeof value === 'number' && Number.isFinite(value)
    ? Math.min(item.max, Math.max(item.min, value)) : item.default;
export function tidyMarkdown(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
    for (const { key, options } of MARKDOWN_CONTROLS) {
        if (!options.some(([id]) => id === value[key])) value[key] = MARKDOWN_DEFAULTS[key];
    }
    for (const item of MARKDOWN_TUNING) value[item.key] = validNumber(value[item.key], item);
    value.accentOwn = value.accentOwn === true;
    if (!/^#[0-9a-f]{6}$/i.test(value.accentColor)) value.accentColor = MARKDOWN_DEFAULTS.accentColor;
    return value;
}
export function markdownClasses(value) {
    return [...MARKDOWN_CONTROLS.flatMap(({ key, options }) => {
        const selected = value?.[key];
        return selected !== options[0][0] && options.some(([id]) => id === selected) ? [`salty-md-${key}-${selected}`] : [];
    }), ...MARKDOWN_TUNING.filter(item => validNumber(value?.[item.key], item) !== item.default).map(item => `salty-md-tune-${item.key}`),
    ...(value?.accentOwn === true ? ['salty-md-custom-accent'] : [])];
}
export function markdownVariables(value) {
    const vars = {};
    for (const item of MARKDOWN_TUNING) {
        const number = validNumber(value?.[item.key], item);
        if (number !== item.default) vars[`--bl-md-${item.key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}`] = `${number}${item.unit}`;
    }
    if (value?.accentOwn === true && /^#[0-9a-f]{6}$/i.test(value.accentColor)) vars['--bl-md-accent'] = value.accentColor;
    return vars;
}
