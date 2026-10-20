// 북마크 1.7.1 (블루레몬에이드 7.3.1) — 그림만 격자를 읽는 차례대로 쌓는다.
// 1.7.0 은 CSS columns 로 쌓아서 칸이 세로 먼저 찼다: 「처음부터」인데 왼쪽 줄이 #3 · #7 · #13, 오른쪽 줄이 #14 · #15 라
// 왼쪽 → 오른쪽으로 읽으면 #3 #14 / #7 #15 / #13 처럼 뒤섞여 보였다 (사용자 폰 화면).
// 이제 정렬 차례대로 한 장씩 가장 낮은 줄(같으면 왼쪽 줄)에 놓는다. 놓이는 높이는 줄 높이의 최솟값이라 차례가 갈수록 내려가기만 하므로
// 위 → 아래, 같은 높이면 왼쪽 → 오른쪽으로 읽은 차례가 정렬 차례와 같다. 그림 비율은 그대로(자르지 않음), DOM 순서도 정렬 차례 그대로라
// 크게 보기에서 넘기는 차례 · 화면 읽기 프로그램의 차례도 같다.
// 순수 함수(tileColumns · placeTiles)는 node 로 시험한다 (tools/tests/bookmark-masonry-731.mjs). layoutTiles 만 DOM 을 쓴다.

/** 줄 수 — 1.7.0 의 CSS 와 같은 규칙: 폰(760px 이하) 최대 2줄 · 140px 이상, 넓으면 최대 4줄 · 180px 이상 */
export function tileColumns(width, wide) {
    const [max, min, gap] = wide ? [4, 180, 12] : [2, 140, 10];
    return Math.max(1, Math.min(max, Math.floor((Math.max(0, width) + gap) / (min + gap))));
}

/**
 * 높이 목록(정렬 차례)을 줄에 놓는다 → { places: [{ col, left, top }], height }.
 * 가장 낮은 줄(같은 높이면 가장 왼쪽)에 놓는다. 높이는 정수 px 로 받는다 (소수면 같은 높이 판정이 흔들린다).
 */
export function placeTiles(heights, columns, colWidth, gap) {
    const tops = new Array(Math.max(1, columns)).fill(0);
    const places = heights.map(height => {
        let col = 0;
        for (let k = 1; k < tops.length; k++) if (tops[k] < tops[col]) col = k;
        const top = tops[col];
        tops[col] += Math.max(0, Math.round(height)) + gap;
        return { col, left: col * (colWidth + gap), top };
    });
    const height = places.length ? Math.max(...tops) - gap : 0;
    return { places, height: Math.max(0, height) };
}

/** 화면에 놓인 칸의 읽는 차례 (위 → 아래, 같은 높이면 왼쪽 → 오른쪽) — 시험 · rig 에서 정렬 차례와 견준다 */
export function readingOrder(places) {
    return places.map((place, i) => ({ ...place, i })).sort((a, b) => a.top - b.top || a.left - b.left).map(place => place.i);
}

/**
 * 격자(.cg-tiles)를 다시 놓는다. 너비를 먼저 정해 그림 높이(받기 전엔 2:3 자리, 받은 뒤엔 원래 비율)를 한 번에 읽고, 자리를 한 번에 쓴다.
 * 못 놓으면(너비 0 · 화면 밖) 아무것도 바꾸지 않는다 — CSS 의 기본 격자(행 먼저)가 그대로 남는다.
 */
export function layoutTiles(box) {
    if (!box?.isConnected) return false;
    const tiles = [...box.children].filter(el => el.classList?.contains('cg-tile'));
    const style = getComputedStyle(box);
    const padLeft = parseFloat(style.paddingLeft) || 0, padRight = parseFloat(style.paddingRight) || 0;
    const padTop = parseFloat(style.paddingTop) || 0, padBottom = parseFloat(style.paddingBottom) || 0;
    const width = box.clientWidth - padLeft - padRight;
    if (!(width > 0) || !tiles.length) return false;
    const wide = typeof matchMedia === 'function' && matchMedia('(min-width: 761px)').matches;
    const gap = wide ? 12 : 10;
    const columns = tileColumns(width, wide);
    const colWidth = Math.floor((width - gap * (columns - 1)) * 100 / columns) / 100;
    box.classList.add('is-masonry');
    for (const tile of tiles) tile.style.width = `${colWidth}px`;
    const heights = tiles.map(tile => Math.round(tile.getBoundingClientRect().height));
    const { places, height } = placeTiles(heights, columns, colWidth, gap);
    places.forEach((place, i) => {
        tiles[i].style.left = `${padLeft + place.left}px`;
        tiles[i].style.top = `${padTop + place.top}px`;
    });
    box.style.height = `${Math.ceil(height + padTop + padBottom)}px`;
    box.dataset.columns = String(columns);
    return true;
}

/** 그림이 실리거나 창 너비가 바뀌면 한 프레임에 한 번 다시 놓는다 → { schedule, observe, disconnect } */
export function tileLayouter() {
    let frame = 0, box = null;
    const run = () => { frame = 0; if (box) layoutTiles(box); };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(run); };
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
        // 너비가 바뀔 때만 (높이는 우리가 쓴 값)
        for (const entry of entries) { const w = Math.round(entry.contentRect.width); if (entry.target.__cgWidth !== w) { entry.target.__cgWidth = w; schedule(); } }
    }) : null;
    return {
        observe(next) {
            if (box && box !== next) resize?.unobserve(box);
            box = next;
            if (!box) return;
            box.__cgWidth = undefined;
            resize?.observe(box);
            layoutTiles(box);
        },
        schedule,
        disconnect() { resize?.disconnect(); box = null; if (frame) cancelAnimationFrame(frame); frame = 0; },
    };
}
