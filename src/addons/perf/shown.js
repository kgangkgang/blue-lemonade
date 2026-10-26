// 프롬프트 관리자 목록이 지금 그려지는지 — 스타일 계산을 강제하지 않고 본다 (8.0.5 후보, 프리셋 화면 성능)
//
// 예전에는 서랍이 열려 있으면 checkVisibility() 를 불렀다. 그 호출은 밀린 스타일 계산을 그 자리에서 돌리는데,
// 프리셋을 바꾸는 동안 실리태번이 설정 칸을 하나씩 바꾸고 renderDebounced() 를 부를 때마다 서랍 전체(3천 요소 남짓)를
// 다시 계산했다 (PC 한 번 약 50ms · 폰 흉내 4배 약 200ms, 프리셋 한 번 바꾸는 데 4번 남짓).
// 실리태번은 서랍을 .openDrawer 로, API 별 칸을 인라인 display:none 으로 숨긴다 → 조상의 class · 인라인 style · hidden 만 본다.
// CSS 규칙만으로 숨은 경우는 「보임」으로 답한다 — 그러면 미루지 않고 실리태번 그대로 그리니 결과는 같고 아끼는 것만 줄어든다.

/** @param {Element | null | undefined} el */
export function listShown(el) {
    if (!el?.isConnected) return false;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        if (node.hidden) return false;
        const style = node.style;
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
        const list = node.classList;
        if (list?.contains('drawer-content') && !list.contains('openDrawer')) return false;
        if (list?.contains('displayNone')) return false;
        if (node === document.body) break;
    }
    return true;
}
