// 8.0.8 데우스 V3 모듈 카드(<relationships> · <status> · <companions> …)를 번역할 때 지킬 것.
//   V3 정규식은 줄마다 「- 이름 | Closeness: 50/100 (was 45) | Stage: Strangers | Unspoken: … | Obstacle: …」 꼴을 영어 열쇠(Closeness · Stage …)로 읽어
//   인물 줄(dem-bond-row)로 그린다. 열쇠 · 단계 낱말 · 「was」 까지 옮기면 정규식이 줄을 못 알아봐 날글이 되고,
//   V3 가 그 칸의 <br> 을 숨겨(.dem-relationships__body>br{display:none}) 인물 줄이 한 문단으로 붙었다(10-27 제보).
//   그래서 display-cards.js 가 이 카드들을 상태 카드처럼 다뤄 열쇠 · 줄 · 기호는 이 기기에 두고 값만 보낸다. 이 파일은 그 목록과 낱말표예요.
//   실리태번 모듈을 import 하지 않아요 (node 시험: tools/tests/translator-v3-modules.mjs).

/** 데우스 V3(2.5 도 같은 이름) 바닥 모듈 태그. 모멘텀 엔진(<momentum>)은 길 고르기(<momentum_route>)까지 얽힌 꼴이라 예전 길 그대로 (translation-cards 시험) */
export const MODULE_CARDS = Object.freeze(['status', 'threads', 'psych', 'psychological_states', 'bond', 'relationships', 'plotlines', 'meanwhile', 'truths', 'hidden_truths',
    'conflict', 'undercurrents', 'companions', 'scratchpad']);
const MODULES = new Set(MODULE_CARDS);
export const isModuleCard = name => MODULES.has(String(name ?? '').toLowerCase());

// 모듈 제목(<summary>Relationships</summary> · <summary>Status⏎- …) — 정규식이 영어 그대로 찾거나 버리는 글자
const TITLES = new Set(['relationships', 'relationship', 'bond', 'bonds', 'status', 'story threads', 'threads', 'psychological states', 'plotlines', 'meanwhile', 'hidden truths', 'truths',
    'conflict', 'undercurrents', "phi's scratchpad", 'phi’s scratchpad', 'scratchpad', 'companions']);
// 칸 값 전체가 정규식의 스위치인 낱말 (빈 모듈 None · 자리 밖 (Off-scene) · (Departed) · 점수 unknown · N/A)
const SWITCHES = new Set(['none', 'n/a', 'na', 'unknown', 'off-scene', 'offscene', 'departed']);
/** 칸 첫머리 열쇠: 「Closeness:」 · 「Inner state:」 · 「Current scene:」 (영어 낱말 1~4개 + 쌍점, 굵게 표시 허용) */
export const MODULE_KEY = /^(?:\*\*|__)?([A-Za-z][A-Za-z'’]*(?:[ -][A-Za-z][A-Za-z'’]*){0,3})(?:\*\*|__)?[ \t]*[:：](?!\/\/)/;

/** 모듈 카드의 한 조각(| · ( ) · [ ] 로 나뉜 것)이 번역하지 말아야 할 정규식 글자인가 */
export function moduleKeepsLocal(text, { before = '', after = '', card = '' } = {}) {
    const value = String(text ?? '').trim(), lower = value.toLowerCase().replace(/\s+/g, ' ');
    if (!value) return true;
    // 동료(Companions) 「**Chi**: …」 의 이름은 정규식이 data-s="Chi" 로 얼굴 · 색을 고르는 열쇠예요 (Chi · Lou · Sam · Grace · Layla · Phi · Sola)
    if (card === 'companions' && /(?:\*\*|__)\s*$/.test(before) && /^\s*(?:\*\*|__|[:：])/.test(after) && /^[A-Za-z][A-Za-z'’ .-]{0,38}$/.test(value)) return true;
    if (TITLES.has(lower) || SWITCHES.has(lower)) return true;
    if (/^was\s+-?\d{1,3}(?:\s*\/\s*100)?$/i.test(value)) return true;   // 「52/100 (was 50)」의 was 50
    if (/^see\s+@?[A-Za-z][A-Za-z'’ ]{0,40}$/i.test(value)) return true;   // 상태창 「Relationship: see Relationships」
    // [Unresolved] · [Character] · [Hold/Subtle] 처럼 대괄호 안 영어 표지 (Meanwhile · Undercurrents 정규식이 영어 낱말로 읽는다)
    if (/\[\s*$/.test(before) && /^\s*\]/.test(after) && /^[A-Za-z][A-Za-z\/ -]{0,40}$/.test(value)) return true;
    return false;
}

// 관계 단계: 화면 글자는 한국어로 바로 채우고(요청 없음), 정규식이 단계 막대에 쓰는 data-stage 는 아래 stageAttrs 가 영어로 되돌린다
const STAGE_KO = {
    enemies: '적대', strangers: '모르는 사이', interested: '관심', tension: '긴장', together: '연인', strained: '틀어짐',
    rivals: '라이벌', acquaintances: '아는 사이', friendly: '친근함', friends: '친구', close: '절친',
    crush: '짝사랑', flirting: '썸', dating: '연애 중', devoted: '헌신',
    noticed: '눈길', drawn: '끌림', entangled: '얽힘', bound: '얽매임', breaking: '무너짐',
};
const STAGE_EN = Object.fromEntries(Object.entries(STAGE_KO).map(([en, ko]) => [ko, en.charAt(0).toUpperCase() + en.slice(1)]));
/** 관계 카드 「Stage:」 칸 값의 한국어 (모르는 낱말이면 null — 모델에 보낸다) */
export function stageValue(text) {
    const key = String(text ?? '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(STAGE_KO, key) ? STAGE_KO[key] : null;
}
/** 이 기기에서 바로 채우는 모듈 칸 값 (지금은 관계 단계만). card = 카드 이름, key = 칸 열쇠(소문자) */
export function moduleLocalValue(text, card, key) {
    if ((card === 'relationships' || card === 'bond') && key === 'stage') return stageValue(text);
    return null;
}
/** 정규식이 그린 관계 줄에서 data-stage 만 영어로 (보이는 단계 글자는 한국어 그대로). 고칠 게 없으면 같은 글 */
export function stageAttrs(html) {
    const text = String(html ?? '');
    if (!text.includes('data-stage="') || !text.includes('dem-bond-arc__stage')) return text;
    return text.replace(/(\bclass="(?:custom-)?dem-bond-arc__stage"[^>]*>)([^<]*)(<\/span>\s*<span\b[^>]*?\bdata-stage=")([^"]*)(")/g,
        (m, open, shown, mid, _stage, close) => { const en = STAGE_EN[shown.trim()]; return en ? open + shown + mid + en + close : m; });
}
