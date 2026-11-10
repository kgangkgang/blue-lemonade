// 글꾸 마트 — 틀 디자인 안의 격자 무늬 끄기(11-10 밤) — 사용자 「디자인 자체에 격자 들어간것도 일단 빼봐 나중에 격자랑 배경 질감은 한꺼번에 추가하고싶음」
// 지우지 않고 꺼 둬요: 조각 자료 · 테마 모듈 사본(lib/log-copy)은 그대로고, 받은 뒤(mart.js ensureItem) · 시식으로 그린 뒤(taste-render.js tasteHtml) 아래 틀의 격자 층만 `none` 으로 바꿔요 — 층 수 · background-size 차례는 그대로라 빠진 자리는 그 틀의 민무늬 바탕색이에요.
// 미리보기 · HTML 복사 · 테마로 받기 · 지니 · 시식 · 내 로그로 보기 모두 이 둘을 지나요. 되살리기 = 아래 깃발 하나를 true 로(+ 이 파일을 부르는 쪽 판 꼬리 올리기). 고르는 질감의 모눈 · 원고지 · 방안지는 tone-geulkku.js TEXTURES 의 hidden 이에요.
// 목록: 공개 목록(심플 · 내장 447) 가운데 가로세로 선이 겹치는 바탕(linear-gradient 두 방향)을 훑고 헤드리스로 그려 본 19틀(마트-설계.md 9절).
export const GRID_PATTERN_ENABLED = false;
const GRID_PATTERNS = {   // 틀 id → 끌 층(글자 그대로 · 정규식은 색이 바뀌어 그려지는 내장 틀)
    "s-season-sp-2": ["linear-gradient(rgba(140,100,60,.12) 1px,transparent 1px)","linear-gradient(90deg,rgba(140,100,60,.12) 1px,transparent 1px)"],   // 가을 낙엽
    "s-animal-sp-4": ["linear-gradient(rgba(160,110,60,.12) 1px,transparent 1px)","linear-gradient(90deg,rgba(160,110,60,.12) 1px,transparent 1px)"],   // 토끼
    "halloween-sp-franken": ["linear-gradient(rgba(63,111,53,.14) 1px,transparent 1px)","linear-gradient(90deg,rgba(63,111,53,.14) 1px,transparent 1px)"],   // 프랑켄슈타인
    "halloween-sp-basket": ["linear-gradient(rgba(168,72,12,.25) 1px,transparent 1px)","linear-gradient(90deg,rgba(168,72,12,.25) 1px,transparent 1px)"],   // 사탕 바구니
    "halloween-sp-lab": ["linear-gradient(rgba(47,143,127,.14) 1px,transparent 1px)","linear-gradient(90deg,rgba(47,143,127,.14) 1px,transparent 1px)"],   // 물약 실험실
    "c-hud-sp-2": ["linear-gradient(rgba(74,138,26,.14) 1px,transparent 1px)","linear-gradient(90deg,rgba(74,138,26,.14) 1px,transparent 1px)"],   // 던전 지도
    "concept-sp-valentine": ["linear-gradient(rgba(179,47,85,.08) 1px,transparent 1px)","linear-gradient(90deg,rgba(179,47,85,.08) 1px,transparent 1px)"],   // 발렌타인
    "concept-sp-lab": ["linear-gradient(rgba(46,106,154,.12) 1px,transparent 1px)","linear-gradient(90deg,rgba(46,106,154,.12) 1px,transparent 1px)"],   // 실험 노트
    "world-hunter-sp-4": ["linear-gradient(rgba(31,138,106,.14) 1px,transparent 1px)","linear-gradient(90deg,rgba(31,138,106,.14) 1px,transparent 1px)"],   // 던전 브리핑 지도
    "char-seoyeonjin-sp-2": ["linear-gradient(rgba(29,111,224,.12) 1px,transparent 1px)","linear-gradient(90deg,rgba(29,111,224,.12) 1px,transparent 1px)"],   // 서연진 · 청운무영검 개편 도해
    "s-christmas-sp-7": ["linear-gradient(rgba(47,111,168,.05) 1px,transparent 1px)","linear-gradient(90deg,rgba(47,111,168,.05) 1px,transparent 1px)"],   // 눈사람
    "s-christmas-sp-19": ["linear-gradient(rgba(42,91,215,.07) 1px,transparent 1px)","linear-gradient(90deg,rgba(42,91,215,.07) 1px,transparent 1px)"],   // 새해 다짐
    "s-season-sp-8": ["linear-gradient(rgba(90,160,74,.13) 1px,transparent 1px)","linear-gradient(90deg,rgba(90,160,74,.13) 1px,transparent 1px)"],   // 봄 소풍
    "char-yusuho-sp-2": ["linear-gradient(rgba(42,93,154,.10) 1px,transparent 1px)","linear-gradient(90deg,rgba(42,93,154,.10) 1px,transparent 1px)"],   // 유수호 · 거북선 Mk.1 설계도
    "char-gwonmujin-sp-1": ["linear-gradient(rgba(61,58,102,.07) 1px,transparent 1px)","linear-gradient(90deg,rgba(61,58,102,.07) 1px,transparent 1px)"],   // 권무진 · 경호 동선 배치도
    "hwabo-table": ["linear-gradient(#e9e4d955 1px,transparent 1px)","linear-gradient(90deg,#e9e4d955 1px,transparent 1px)"],   // 라이트 테이블
    "c-hud-4": ["linear-gradient(rgba(110,168,255,.07) 1px,transparent 1px)","linear-gradient(90deg,rgba(110,168,255,.07) 1px,transparent 1px)"],   // 인벤토리
    "s-christmas-dk-2": ["linear-gradient(rgba(200,16,46,.08) 0 11px,transparent 11px)","linear-gradient(90deg,rgba(200,16,46,.08) 0 11px,transparent 11px)"],   // 선물 상자
    "lc-note": [/linear-gradient\(transparent 19px, ?(?:[^,()]|\([^()]*\))+ 19px\)/g, /linear-gradient\(90deg, ?transparent 19px, ?(?:[^,()]|\([^()]*\))+ 19px\)/g],   // 노트(테마 내장 · 선 색이 바탕 따라 바뀌어 정규식)
};
/** 그 틀의 격자 층을 none 으로(목록에 없는 틀 · 글이 아닌 값은 그대로) — 깃발이 켜져 있으면 아무것도 안 바꿔요 */
export function gridOff(id, html) {
    const layers = GRID_PATTERN_ENABLED ? null : GRID_PATTERNS[id];
    if (!layers || typeof html !== 'string') return html;
    let out = html;
    for (const g of layers) out = typeof g === 'string' ? out.split(g).join('none') : out.replace(g, 'none');
    return out;
}
export const gridOffIds = () => Object.keys(GRID_PATTERNS);
