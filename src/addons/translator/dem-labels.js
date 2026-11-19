// 11-19 데우스 카드 위 영어 표지를 화면에서만 한국어로 (번역기 켬 · 스위치 「데우스 카드 표지 한국어로」 기본 켬)
//   원작 정규식(데우스 엑스 마키나, lsennn · CC BY-NC-SA 4.0)이 그린 HTML 에서, 아는 표지 class 의 글자가 아래 영어 낱말과 「똑같을」 때만 바꿔요.
//   원작 정규식 · 저장된 글 · 모델에 가는 글은 그대로예요(실리태번 서식 훅 · 정규식 뒤). class · data-* 속성(원작 CSS 가 읽는 것)은 건드리지 않아요.
//   사전의 영어는 짧은 표지 낱말만(긴 안내 문장은 담지 않아요) · 한국어는 테마가 직접 썼어요. 인물 이름 · 값 칸은 건드리지 않아요.
//   실리태번 모듈을 import 하지 않아요 (node 시험: tools/tests/translator-dem-labels.mjs).
const TITLES = {
    'DEM Active Modules': '데우스 모듈', All: '전체', Status: '상태', Characters: '인물', Relationships: '관계', 'Story Threads': '떡밥', Threads: '떡밥',
    Psychology: '심리', 'Psychological States': '심리', Plotlines: '줄거리', Momentum: '전개', 'Momentum Engine': '전개', Conflict: '갈등', Meanwhile: '한편',
    'Hidden Truths': '숨은 진실', Truths: '숨은 진실', Undercurrents: '물밑 흐름', "Phi's Scratchpad": '파이의 퇴고 메모', Phi: '파이', Companions: '친구들',
    'Scene Plan': '장면 계획', 'Your Choices': '선택지', Diaries: '일기장', Diary: '일기장', 'Format check': '형식 확인', 'Dialogue color': '대사 색',
};
const TAGS = {
    Recurring: '다시 나올 인물', Passing: '스쳐 가는 인물', Recovered: '되살린 카드', Active: '진행 중', Asides: '한마디', Reread: '다시 읽기', 'Route computed': '경로 정함', 'Route pending': '경로 정하는 중','Your move': '내 차례',
    Current: '지금', Unresolved: '안 풀림', Possible: '일어날 수도', Seed: '씨앗', Offscreen: '화면 밖', World: '세상', Secret: '비밀', Subtle: '은근히',
    'Out of character': '장면 밖 쪽지',
};
const LABELS = {
    Physical: '몸', Clothes: '옷차림', Mental: '마음', Location: '위치', Relationship: '관계', Inventory: '소지품',
    Closeness: '친밀도', Unspoken: '못 한 말', Obstacle: '걸림돌',
    Act: '행동', Feel: '감정', Now: '지금', Read: '속내', Trigger: '계기', Urge: '충동',
    'Main plot': '큰 줄기', 'Main Plot': '큰 줄기', Subplots: '곁가지', 'Current scene': '지금 장면',
    Context: '상황', Constraints: '제약', 'Narrative Style': '문체', 'Prose Plan': '본문 계획',
    Knows: '아는 사람', Suspects: '의심하는 사람', Misled: '속은 사람', External: '바깥', Want: '바람', Pressure: '압박',
};
const OTHER = { 'No entries yet': '아직 일기가 없어요', 'No entries': '아직 일기가 없어요' };
const GROUPS = [
    [/^dem-(?:card__title|tab__label|modules__title|format-note__title|dialogue-note__title)$/, TITLES],
    [/^dem-(?:card__tag|thread-tag|meanwhile-tag|truth-tag|undercurrent__tag|phi-note__tag)$/, TAGS],
    [/^dem-(?:status-row__label|bond-field__label|bond-meter__label|psychological-state-row__label|plotlines__label|momentum-engine__label|scene-plan__label|truth-field__label|undercurrents__label)$/, LABELS],
    [/^dem-diary-none$/, OTHER],
];
const own = Object.prototype.hasOwnProperty;
function dictFor(classes) {
    for (const name of classes.split(/\s+/)) {
        const bare = name.replace(/^custom-/, '');
        for (const [re, dict] of GROUPS) if (re.test(bare)) return dict;
    }
    return null;
}
// 표지 요소: 여는 태그(class 에 dem-…) + 글자만(안에 다른 태그 없음) + 같은 이름의 닫는 태그
const LABEL_EL = /(<(span|div|strong|b|em|p|label|summary)\b[^>]*?\bclass\s*=\s*"([^"]*\bdem-[^"]*)"[^>]*>)([^<]{1,80})(<\/\2\s*>)/gi;
// 운명의 주사위 막대(dem-fate · 굴리는 중 dem-fate-rolling) 안 글자 — 막대 하나 안에서만
//   막대 안에는 div 가 없어요(span · b · svg) — 여는 div 부터 첫 </div> 까지
const FATE_BAR = /<div\b[^>]*\bclass\s*=\s*"(?:custom-)?dem-fate(?:-rolling)?(?=[\s"])[^"]*"[^>]*>(?:(?!<\/?div\b)[\s\S]){0,4000}<\/div>/gi;
function fateKo(bar) {
    return bar
        .replace(/(<\/svg>\s*|<span\b[^>]*>\s*)Fate(\s*<\/span>)/i, '$1운명의 주사위$2')
        .replace(/·\s*rolled\s+(\d{1,3})\s*·\s*need under\s+(\d{1,3})/i, '· 굴림 $1 · $2 미만이면 성공')
        .replace(/·\s*need under\s+(\d{1,3})/i, '· $1 미만이면 성공')
        .replace(/(<b\b[^>]*>)\s*passed\s*(<\/b>)/i, '$1성공$2')
        .replace(/(<b\b[^>]*>)\s*failed\s*(<\/b>)/i, '$1실패$2')
        .replace(/(<b\b[^>]*>)\s*rolling…?\s*(<\/b>)/i, '$1굴리는 중…$2');
}
/** 새 얼굴 카드(dem-new-face)의 제목은 인물의 보이는 이름이라 바꾸지 않아요 — 그 카드의 summary 안인지 */
function inNewFaceSummary(html, at) {
    const open = html.lastIndexOf('<details', at);
    if (open < 0) return false;
    const tag = html.slice(open, html.indexOf('>', open) + 1);
    return /\bdem-new-face\b/.test(tag) && html.lastIndexOf('</summary', at) < open;
}
/**
 * 정규식이 그린 데우스 HTML → 표지만 한국어. dem- 가 없으면 그대로 돌려줘요(문자열 같음).
 * @param {string} html
 */
export function demLabelsKo(html) {
    if (typeof html !== 'string' || !html.includes('dem-')) return html;
    let out = html.replace(LABEL_EL, (all, open, tag, classes, text, close, at) => {
        const dict = dictFor(classes); if (!dict) return all;
        const key = text.trim(); if (!own.call(dict, key)) return all;
        if (dict === TITLES && /\bdem-card__title\b/.test(classes) && inNewFaceSummary(html, at)) return all;
        return open + text.replace(key, dict[key]) + close;
    });
    if (out.includes('dem-fate')) out = out.replace(FATE_BAR, fateKo);
    // 숨김 묶음 머리(Spoilers) · 새 얼굴 카드의 「Keep this character:」 표지 — class 없는 짧은 글자라 그 자리 꼴로만
    out = out.replace(/(<summary\b[^>]*>\s*<span\b[^>]*\bclass\s*=\s*"[^"]*\bdem-card__caret\b[^"]*"[^>]*>[^<]*<\/span>\s*)Spoilers(\s*<\/summary>)/gi, '$1스포일러$2')
        .replace(/(<p\b[^>]*\bclass\s*=\s*"[^"]*\bdem-new-face__keep\b[^"]*"[^>]*>\s*<b\b[^>]*>)\s*Keep this character:\s*(<\/b>)/gi, '$1이 인물 남겨 두기:$2');
    return out;
}
export const DEM_LABEL_WORDS = { TITLES, TAGS, LABELS, OTHER };
