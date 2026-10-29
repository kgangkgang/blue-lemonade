// 데우스 V3 카드 「테두리 빛」(chat.demGlow) — 값 하나를 CSS 변수 --bl-dem-glow 로 (css/30-dem-skin.css).
//
// 8.2.3 까지는 이 변수가 :root 변수 시트(#salty-vars)에 들어 있어서, 슬라이더 한 칸에 시트 전체가 다시 써지고 문서 전체 스타일이 다시
// 계산됐다(상태창 30개가 든 300메시지 채팅 · 폰 4배에서 재계산 9~13번 1.9~2.4초). 변수를 쓰는 곳은 데우스 상태창 묶음 · 트래커뿐이라
// 그 요소에만 변수를 두는 작은 시트(#salty-dem-vars)로 뗀다 — 시트가 바뀌면 그 class 를 가진 요소(와 그 안)만 다시 계산한다.
//
// 끌어서 움직이는 동안(설정 창 슬라이더를 누른 채)은 설정 창 안 표본(.salty-panel 안 · 숨은 표본 자리 .bl-ft-sample-host)에만 새 값을 주고,
// 채팅 쪽은 손을 뗄 때(change) 한 번만 바꾼다 — 그동안 채팅의 상태창은 마지막으로 확정한 값 그대로.
const SCOPE = '.custom-dem-modules, .custom-dem-track, .custom-dem-track-recovery';
const PREVIEW_HOSTS = '.salty-panel, .bl-ft-sample-host';
export const DEM_GLOW_STYLE_ID = 'salty-dem-vars';

/** 설정값(0~100, 없으면 35) → 변수 값 문자열(0~1) */
export function demGlowValue(raw) {
    const n = Number(raw);
    return String(Math.min(100, Math.max(0, Number.isFinite(n) ? n : 35)) / 100);
}

/** 시트 본문. preview 가 있으면 채팅은 committed 값, 설정 창 표본만 live 값 */
export function demGlowCss(live, committed = live) {
    if (committed === live) return `:is(${SCOPE}) { --bl-dem-glow: ${live}; }`;
    return `:is(${SCOPE}) { --bl-dem-glow: ${committed}; }\n:is(${PREVIEW_HOSTS}) :is(${SCOPE}) { --bl-dem-glow: ${live}; }`;
}

let committed = null;      // 채팅에 마지막으로 준 값 (끌기 중엔 이 값이 채팅에 남는다)
let previewOnly = false;   // 슬라이더를 누른 채 — true 면 채팅은 그대로, 표본만 새 값

/** panel.js: 「테두리 빛」 슬라이더를 누르는 동안 true, 떼면 false (떼면 다음 applyAll 이 채팅에도 반영) */
export function setDemGlowPreview(on) { previewOnly = !!on; }
export function demGlowPreviewing() { return previewOnly; }

/** apply.js applyAll 이 부른다 — 값 · 시트가 그대로면 아무것도 쓰지 않는다 */
export function syncDemGlow(raw, doc = document) {
    const live = demGlowValue(raw);
    if (committed === null || !previewOnly) committed = live;
    const css = demGlowCss(live, committed);
    let el = doc.getElementById(DEM_GLOW_STYLE_ID);
    if (!el) { el = doc.createElement('style'); el.id = DEM_GLOW_STYLE_ID; doc.head.appendChild(el); }
    if (el.textContent !== css) el.textContent = css;
    return css;
}

/** 시험용 */
export function resetDemGlowState() { committed = null; previewOnly = false; }
