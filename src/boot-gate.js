// 7.7.4 시작 덮개: 실리태번은 처음 불러오는 동안 #preloader 로 화면 전체를 덮고, 다 불러온 뒤(APP_READY 바로 앞) 한 번만 걷는다.
// 덮여 있는 동안은 아무것도 보이지 않는데, 테마가 크기 · 계산 스타일을 재면(getComputedStyle · getClientRects) 그때마다 문서 전체
// 스타일을 그 자리에서 다시 계산했다 — 확장들이 계속 붙는 중이라 같은 계산을 여러 번 (폰 흉내 4배 CPU 부팅에서 강제 계산 수 초).
// 재고 칠하는 일은 덮개가 걷히는 순간 한 번에 한다. 걷히는 것을 MutationObserver 로 보므로 첫 화면을 그리기 전에 끝난다.
// #preloader 가 없는 실리태번(옛 판 · 이미 걷힘)이면 기다리지 않고 바로 한다 — 예전과 같다.
let waiting = null;
let observer = null;

/** 실리태번이 아직 첫 불러오기 덮개를 쓰고 있나 */
export function booting(doc = globalThis.document) {
    return !!doc?.getElementById?.('preloader');
}

function release() {
    if (booting()) return;
    observer?.disconnect();
    observer = null;
    const list = waiting ? [...waiting] : [];
    waiting = null;
    for (const fn of list) {
        try { fn(); } catch (error) { console.error('[Blue Lemonade] 시작 뒤 작업', error); }
    }
}

/** 덮개가 걷힌 뒤 fn 을 한 번 (지금 덮개가 없으면 바로). 같은 함수를 여러 번 넘겨도 한 번만 */
export function afterBoot(fn) {
    if (!booting()) { fn(); return; }
    (waiting ??= new Set()).add(fn);
    if (observer) return;
    const preloader = document.getElementById('preloader');
    observer = new MutationObserver(release);
    observer.observe(preloader.parentNode || document.documentElement, { childList: true });
}
