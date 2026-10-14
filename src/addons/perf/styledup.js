// 성능 보조 4. 메시지 속 같은 <style> 은 하나만 쓰기 (6.4.4)
// 프리셋 정규식이 메시지마다 · 속마음마다 같은 <style> 을 통째로 넣으면(예: 인물 색 style 이 답 하나에 열두 벌) 문서의 규칙이 그만큼 늘고,
// 메뉴 · 서랍을 열 때마다 하는 넓은 스타일 계산이 그 규칙을 모든 요소에 다시 맞춰 본다 (폰 4× 에서 ≡ 메뉴 하나 2.7초 → 1.2초).
// 같은 글(같은 media)의 style 은 문서 순서상 마지막 한 벌만 켜 두고 나머지는 끈다(style.disabled — HTML 에 남지 않는 값, 저장된 글은 그대로).
// 같은 규칙의 반복은 마지막 한 벌이 캐스케이드 차례를 정하므로 화면은 같다.
// 예외 @layer: 레이어 순서는 그 이름이 처음 나온 자리가 정한다(마지막이 아니다) — 앞 사본을 끄면 순서가 뒤집혀 화면이 바뀐다. 그래서 @layer 가 든 style 은 묶지 않는다 (6.4.4 v3).
// @font-face 도 같은 선언을 공유하는 브라우저 글꼴 등록 순서가 달라질 수 있다. 조건부 규칙과 keyframes 외 @규칙은 보수적으로 그대로 둔다 (v4).
// 지키는 것: 켜 둔 한 벌이 든 칸이 다시 그려지거나 메시지가 지워지면, 그리기 전에(마이크로태스크) 다음 마지막 사본을 켠다.
// 감시는 켜 둔 한 벌이 든 칸의 자식 목록만 (하위 전체 · #chat 전체는 보지 않는다).
// 순수한 판단(planStyleDedupe)과 DOM 연결(createStyleDedupe)을 나눴다 — 시험: tools/tests/style-dedupe.mjs

// 위치와 무관하게 마지막 선언으로 정해지는 규칙만 합친다. 등록형 · 범위형 · 알 수 없는 @규칙은 제외한다.
const DEDUPE_AT_RULES = new Set(['media', 'supports', 'container', 'keyframes', '-webkit-keyframes']);

/** 같은 묶음의 열쇠 — media 가 다르면 다른 style. 대체 스타일시트 · 등록 순서나 범위에 의존하는 @규칙은 손대지 않는다 */
export function styleKey(node) {
    if (!node || node.hasAttribute?.('title')) return null;
    const text = node.textContent || '';
    for (const match of text.matchAll(/@([\w-]+|\\)/g)) if (!DEDUPE_AT_RULES.has(match[1].toLowerCase())) return null;
    return `${node.getAttribute?.('media') || ''}\u0001${text}`;
}

/**
 * nodes(문서 순서) → 켤 것 · 끌 것. 열쇠마다 마지막 한 벌만 켠다.
 * repairOnly 면 끄지 않고, 마지막 사본이 꺼져 있을 때 그것만 켠다 (스트리밍 중 — 스타일 계산을 더 부르지 않게).
 */
export function planStyleDedupe(nodes, { keyOf = styleKey, repairOnly = false } = {}) {
    const keys = nodes.map(node => keyOf(node));   // 열쇠는 한 번만 (큰 style 글을 두 번 읽지 않게)
    const last = new Map();
    keys.forEach((k, i) => { if (k !== null) last.set(k, i); });
    const enable = [], disable = [];
    nodes.forEach((node, i) => {
        const k = keys[i];
        if (k === null) return;
        const keep = last.get(k) === i;
        if (keep && node.disabled) enable.push(node);
        else if (!keep && !node.disabled && !repairOnly) disable.push(node);
    });
    return { enable, disable, keep: [...last.values()].map(i => nodes[i]) };
}

/**
 * DOM 연결. query() = 지금 문서 순서의 메시지 style 들, holderOf(node) = 감시할 칸(들), streaming() = 생성 중인가, enabled() = 스위치.
 * MutationObserver 는 켜 둔 한 벌의 부모 · 그 메시지 글 칸만 childList 로 본다.
 */
export function createStyleDedupe({ query, holdersOf, streaming = () => false, enabled = () => true, MutationObserver: MO = globalThis.MutationObserver, queue = fn => queueMicrotask(fn) }) {
    const mine = new Set();   // 우리가 끈 style (끄기 · 되돌리기용)
    let observer = null, watched = [], pending = false, runs = 0, changes = 0;
    const watch = targets => {
        if (!MO) return;
        if (!observer) observer = new MO(() => schedule());
        observer.disconnect();
        watched = [...new Set(targets.filter(Boolean))];
        for (const t of watched) observer.observe(t, { childList: true });
    };
    function run() {
        pending = false;
        runs++;
        if (!enabled()) { release(); return; }
        const nodes = query();
        // 우리가 끈 것 가운데 문서에서 빠진 것은 잊는다
        // 큰 CSS 본문을 한 번만 읽는다. 외부에서 꺼 둔 사본은 활성 사본을 대신할 수 없다.
        const keys = new Map(nodes.map(n => [n, n.disabled && !mine.has(n) ? null : styleKey(n)]));
        for (const n of mine) {
            if (!n.isConnected) mine.delete(n);
            // 다른 코드가 글이나 title 을 바꿔 이제 합칠 수 없게 되었으면, 우리가 끈 사본을 즉시 돌려준다.
            else if (!keys.has(n) || keys.get(n) === null) { n.disabled = false; mine.delete(n); changes++; }
        }
        const plan = planStyleDedupe(nodes, {
            repairOnly: streaming(),
            // 우리가 끈 사본은 복원 후보로 남긴다. 메시지 밖으로 옮겨진 사본도 위에서 돌려준다.
            keyOf: n => keys.get(n),
        });
        // 다시 켜는 것은 우리가 끈 것만 (다른 코드가 일부러 끈 style 은 그대로)
        for (const n of plan.enable) if (mine.has(n)) { n.disabled = false; mine.delete(n); changes++; }
        for (const n of plan.disable) { n.disabled = true; mine.add(n); changes++; }
        watch(plan.keep.flatMap(n => holdersOf(n)));
    }
    function schedule() { if (pending) return; pending = true; queue(run); }
    function release() {
        for (const n of mine) n.disabled = false;
        mine.clear();
        if (observer) observer.disconnect();
        watched = [];
    }
    return { run, schedule, release, get stats() { return { runs, changes, disabled: mine.size, watched: watched.length }; } };
}
