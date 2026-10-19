// 그림 확대 보기 손짓 (7.2.7 — 캐릭터 에셋 viewer.js 에서 옮겨 와 북마크 그림 보기와 같이 쓴다)
// 실리태번을 import 하지 않는다. 클래스 is-zoomed · is-gesturing(창) · is-easing(그림)과 변수 --eh-zoom-ms · --eh-zoom-scale 은 쓰는 쪽 CSS 가 받는다.

// ── 확대해서 보기 ─────────────────────────────────────────────
// 폰: 두 손가락으로 벌리기 · 오므리기, 두 번 톡(그림 위) = 2배 ↔ 원래대로, 확대 중에는 한 손가락으로 옮기기.
// PC: 휠 = 커서 자리를 기준으로 확대 · 축소, 두 번 클릭 = 2배 ↔ 원래대로, 확대 중에는 끌어서 옮기기. 돋보기 단추는 두지 않는다.
// 옆으로 쓸어 넘기기는 확대하지 않았을 때만. 그림을 바꾸면 원래 크기로 돌아온다.
// 그림 크기는 transform(translate3d + scale)만 바꾼다 — 자리 계산(레이아웃)은 그대로라 창 크기와 상관없이 가볍다.
const ZOOM_MAX = 5;          // 화면에 맞춘 크기의 5배까지
const ZOOM_PINCH_MIN = 0.8;  // 오므리는 동안은 조금 더 작아졌다가 손을 떼면 1배로 돌아온다
const ZOOM_DOUBLE = 2;       // 두 번 톡 · 두 번 클릭
const ZOOM_SNAP = 1.02;      // 손을 뗐을 때 이보다 작으면 1배로 맞춘다
const TAP_SLOP = 10;         // 이만큼(px) 안 움직였으면 톡
const TAP_MS = 300;          // 이 안에 뗐으면 톡
const DOUBLE_MS = 320;       // 두 톡 사이 시간 (손가락 · 펜만 — 마우스 두 번 클릭은 브라우저 dblclick 이 OS 의 두 번 클릭 빠르기를 따른다)
const DOUBLE_SLOP = 36;      // 두 톡 사이 거리(px)
const SWIPE_MIN = 48;        // 쓸어 넘기기로 칠 가로 거리(px)
const QUIET_MS = 400;        // 끌기 · 두 번 톡 뒤 따라오는 click 은 '어두운 곳 누르기(닫기)'로 치지 않는다
const EASE_MS = 260;         // 두 번 톡 · 1배로 돌아오기
const WHEEL_EASE_MS = 120;   // 휠 한 칸

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * 크게 보기 창의 그림에 확대 · 옮기기 · 쓸어 넘기기를 붙인다.
 * @param {{ element: HTMLElement, stage: HTMLElement, img: HTMLImageElement, onSwipe?: (delta: number) => void, maxScale?: () => number, doubleScale?: () => number }} options
 */
export function attachZoom({ element, stage, img, onSwipe = () => {}, maxScale = null, doubleScale = null }) {
    // 7.2.7: 북마크 그림 보기도 쓴다 — 최대 배율 · 두 번 톡 배율을 그림마다 고를 수 있다 (원본 해상도 1:1 까지)
    const maxZoom = () => Math.max(ZOOM_MAX, Number(maxScale?.()) || 0);
    const doubleZoom = () => clamp(Number(doubleScale?.()) || ZOOM_DOUBLE, 1.25, maxZoom());
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let frame = 0;
    let easeTimer = 0;
    let quietUntil = 0;
    /** 누르고 있는 손가락 · 버튼 (둘까지): pointerId → { x, y } */
    const pointers = new Map();
    /** 지금 누르기: { id, x, y, at, onImg, zoomedAtStart, multi, moved, box, pan, pinch } */
    let gesture = null;
    /** 앞의 톡 (두 번 톡을 보려고): { at, x, y, onImg } */
    let lastTap = null;
    /** 그림이 바뀔 때(clear) 누르고 있던 손가락 · 버튼 — 뗄 때 따라오는 click 을 닫기로 치지 않으려고 */
    const stale = new Set();
    /** 마지막으로 누른 포인터 종류 ('mouse' | 'touch' | 'pen') */
    let lastType = '';
    /** 끌지 않고 이어서 누른 마우스 횟수 — 끌기 뒤 따라온 dblclick 은 두 번 클릭으로 치지 않는다 */
    let mouseTaps = 0;
    /** 모서리 둥글기를 나눠 둔 배율 (style.css --eh-zoom-scale) */
    let radiusScale = 1;

    const zoomed = () => scale > 1.01;
    const ready = () => img.complete && img.naturalWidth > 0 && img.offsetWidth > 0;

    /**
     * 무대 자리와 그림의 원래 자리(transform 전) — 가운데 점 cx, cy 와 크기 w, h.
     * offsetWidth · offsetLeft 는 정수로 반올림된다(518.66 → 519) — 그 값으로 옮기기 한계를 잡으면 끝까지 옮겼을 때 가장자리에
     * 1~2px 어두운 틈이 남았다. 지금 그려진 자리(getBoundingClientRect, 소수)에서 지금 걸린 transform 을 거꾸로 풀어 소수 그대로 잰다.
     * 부드럽게 옮겨 가는 중이어도 자리와 transform 이 같은 순간의 값이라 맞는다.
     */
    function box() {
        const st = stage.getBoundingClientRect();
        const r = img.getBoundingClientRect();
        const t = getComputedStyle(img).transform;
        const m = t && t !== 'none' ? new DOMMatrixReadOnly(t) : null;
        const w = r.width / (m?.a || 1);
        const h = r.height / (m?.d || 1);
        return { st, w, h, cx: r.left + r.width / 2 - (m?.e ?? 0), cy: r.top + r.height / 2 - (m?.f ?? 0) };
    }

    /** 그림이 무대 가장자리 안쪽으로 들어와 빈 곳이 생기지 않게 옮긴 거리를 묶는다. 무대보다 작은 쪽은 가운데에 둔다. */
    function clampPan(b) {
        const w = b.w * scale;
        const h = b.h * scale;
        tx = w <= b.st.width + 0.5 ? 0 : clamp(tx, b.st.right - b.cx - w / 2, b.st.left - b.cx + w / 2);
        ty = h <= b.st.height + 0.5 ? 0 : clamp(ty, b.st.bottom - b.cy - h / 2, b.st.top - b.cy + h / 2);
    }

    /** 배율을 바꾸되 화면의 (x, y) 자리에 있던 그림의 점은 그 자리에 그대로 둔다 */
    function zoomAround(next, x, y, b) {
        const ux = (x - b.cx - tx) / scale;
        const uy = (y - b.cy - ty) / scale;
        scale = next;
        tx = x - b.cx - scale * ux;
        ty = y - b.cy - scale * uy;
        clampPan(b);
    }

    function apply() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        img.style.transform = scale === 1 && !tx && !ty ? '' : `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
        // 모서리 둥글기도 transform 으로 같이 커진다(5배면 40px) — 배율만큼 나눠 늘 8px 로 보이게 (style.css).
        // 둥글기가 바뀌면 그림을 다시 그리므로, 손가락을 따라가는 동안에는 보이는 둥글기가 0.4px 넘게 어긋날 때만 바꾼다.
        if (scale === 1 ? radiusScale !== 1 : Math.abs(scale / radiusScale - 1) > 0.05) {
            radiusScale = scale;
            if (scale === 1) img.style.removeProperty('--eh-zoom-scale');
            else img.style.setProperty('--eh-zoom-scale', String(scale));
        }
        element.classList.toggle('is-zoomed', zoomed());
    }

    /** 움직이는 동안은 한 화면(frame)에 한 번만 그린다 */
    function schedule() {
        frame ||= requestAnimationFrame(() => {
            frame = 0;
            apply();
        });
    }

    /** 부드럽게 옮겨 간다 (움직임 줄이기 설정이면 CSS 가 바로 바꾼다) */
    function ease(ms) {
        clearTimeout(easeTimer);
        img.style.setProperty('--eh-zoom-ms', `${ms}ms`);
        img.classList.add('is-easing');
        easeTimer = setTimeout(stopEase, ms + 60);
    }

    function stopEase() {
        clearTimeout(easeTimer);
        img.classList.remove('is-easing');
    }

    /** 누르는 동안만 그림을 GPU 층에 올려 둔다 — 늘 올려 두면 확대한 그림이 흐리게 남는다 (손을 떼면 선명하게 다시 그린다) */
    function setMoving(on) {
        element.classList.toggle('is-gesturing', on);
    }

    /** 원래 크기로 */
    function reset(animate = false) {
        const was = scale !== 1 || tx || ty;
        scale = 1;
        tx = 0;
        ty = 0;
        if (animate && was) ease(EASE_MS);
        else stopEase();
        apply();
    }

    /** 두 번 톡 · 두 번 클릭 — 확대 중이면 원래대로, 아니면 그림 위를 누른 자리를 2배로 */
    function toggleZoom(x, y, onImg) {
        if (zoomed()) {
            quietUntil = Date.now() + QUIET_MS;
            reset(true);
        } else if (onImg && ready()) {
            quietUntil = Date.now() + QUIET_MS;
            zoomAround(doubleZoom(), x, y, box());
            ease(EASE_MS);
            apply();
        }
    }

    /** 누르던 손가락들을 기준으로 옮기기 · 벌리기의 시작점을 다시 잡는다 */
    function rebase() {
        if (!gesture) return;
        gesture.box = box();
        const list = [...pointers.values()];
        gesture.pan = list.length === 1 ? { x: list[0].x, y: list[0].y, tx, ty } : null;
        if (list.length >= 2) {
            const [a, b] = list;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            gesture.pinch = {
                dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                scale,
                ux: (mx - gesture.box.cx - tx) / scale,
                uy: (my - gesture.box.cy - ty) / scale,
            };
        } else {
            gesture.pinch = null;
        }
    }

    function onDown(event) {
        stale.delete(event.pointerId); // 앞의 누르기를 창 밖에서 뗐다 (pointerup 이 안 왔다)
        lastType = event.pointerType;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (pointers.size >= 2 || pointers.has(event.pointerId)) return; // 셋째 손가락은 보지 않는다
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        stopEase();
        if (pointers.size === 1 || !gesture) {
            gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, at: Date.now(), onImg: event.target === img, zoomedAtStart: zoomed(), multi: false, moved: false };
        } else {
            gesture.multi = true; // 두 손가락 — 톡 · 쓸어 넘기기가 아니다
            lastTap = null;
        }
        rebase();
    }

    function onMove(event) {
        const point = pointers.get(event.pointerId);
        if (!point || !gesture) return;
        // 마우스 버튼을 창 밖 · 다른 버튼과 섞어 뗐으면 pointerup 이 안 온다
        if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
            onUp(event);
            return;
        }
        point.x = event.clientX;
        point.y = event.clientY;
        if (!gesture.moved && event.pointerId === gesture.id && Math.hypot(point.x - gesture.x, point.y - gesture.y) > TAP_SLOP) {
            gesture.moved = true;
            // 끌기로 바뀐 뒤에만 붙잡는다 — 처음부터 붙잡으면 그림 click 이 무대로 가서 창이 닫힌다 (끈 뒤 click 은 QUIET_MS 로 거른다)
            if (event.pointerType === 'mouse') {
                try { stage.setPointerCapture(event.pointerId); } catch { /* 이미 뗐다 */ }
            }
        }
        if (!ready()) return;
        const { pinch, pan, box: b } = gesture;
        if (pinch && pointers.size >= 2) {
            const [p1, p2] = [...pointers.values()];
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            scale = clamp(pinch.scale * Math.hypot(p1.x - p2.x, p1.y - p2.y) / pinch.dist, ZOOM_PINCH_MIN, maxZoom());
            // 두 손가락 가운데 밑에 있던 그림의 점이 손가락을 따라온다
            tx = mx - b.cx - scale * pinch.ux;
            ty = my - b.cy - scale * pinch.uy;
            clampPan(b);
        } else if (pan && zoomed()) {
            tx = pan.tx + point.x - pan.x;
            ty = pan.ty + point.y - pan.y;
            clampPan(b);
        } else {
            return;
        }
        setMoving(true);
        schedule();
    }

    function onUp(event) {
        if (!pointers.delete(event.pointerId)) {
            // 누르고 있는 동안 그림이 바뀌었다(clear) — 뗄 때 따라오는 click 이 1배가 된 무대(어두운 곳)에 닿아 창을 닫지 않게
            if (stale.delete(event.pointerId)) quietUntil = Date.now() + QUIET_MS;
            return;
        }
        if (!gesture) return;
        const cancelled = event.type === 'pointercancel';
        if (pointers.size) {
            // 두 손가락 중 하나를 뗐다 — 1배보다 작으면 돌려 놓고, 남은 손가락으로 이어서 옮긴다
            if (scale < 1) reset(true);
            rebase();
            return;
        }
        const g = gesture;
        gesture = null;
        setMoving(false);
        const now = Date.now();
        if (g.multi || g.moved) quietUntil = now + QUIET_MS;
        if (scale < ZOOM_SNAP && (scale !== 1 || tx || ty)) reset(true);
        else apply(); // 남은 한 화면을 바로 그린다
        const mouse = event.pointerType === 'mouse';
        if (mouse) mouseTaps = g.moved || cancelled ? 0 : mouseTaps + 1;
        if (g.multi || cancelled) {
            lastTap = null;
            return;
        }
        const x = event.clientX;
        const y = event.clientY;
        if (g.moved) {
            lastTap = null;
            // 쓸어 넘기기 — 확대하지 않았을 때만
            const dx = x - g.x;
            const dy = y - g.y;
            if (!g.zoomedAtStart && !zoomed() && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
            return;
        }
        // 마우스 두 번 클릭은 onDblClick 이 본다 (OS 의 두 번 클릭 빠르기)
        if (mouse) return;
        if (now - g.at > TAP_MS) {
            lastTap = null;
            return;
        }
        // 톡 — 바로 앞의 톡과 가까우면 두 번 톡
        const first = lastTap;
        if (first && now - first.at < DOUBLE_MS && Math.hypot(x - first.x, y - first.y) < DOUBLE_SLOP) {
            lastTap = null;
            toggleZoom(x, y, first.onImg);
            return;
        }
        lastTap = { at: now, x, y, onImg: g.onImg };
    }

    /** 마우스 두 번 클릭 — 브라우저의 dblclick 이라 두 번 클릭 빠르기는 OS 설정을 따른다 */
    function onDblClick(event) {
        // 손가락 · 펜의 두 번 톡은 onUp 이 본다 (폰 · 터치 화면이 따로 보내는 dblclick 은 거른다).
        // 끈 뒤 바로 한 번 누른 것도 OS 는 두 번 클릭으로 친다 — 끌지 않고 이어 누른 두 번(mouseTaps)만. 넘기기 단추는 단추대로.
        if (lastType !== 'mouse' || mouseTaps < 2 || event.target.closest('button')) return;
        mouseTaps = 0;
        lastTap = null;
        toggleZoom(event.clientX, event.clientY, event.target === img);
    }

    function onWheel(event) {
        // 창이 떠 있는 동안 휠은 늘 이 그림의 확대 · 축소 — 뒤의 채팅이 스크롤되거나 Ctrl+휠로 페이지가 확대되지 않게
        event.preventDefault();
        if (!ready() || gesture?.pinch) return;
        let dy = event.deltaY;
        if (event.deltaMode === 1) dy *= 16;
        else if (event.deltaMode === 2) dy *= stage.clientHeight || 400;
        if (!dy) return;
        // Ctrl+휠 = 터치패드 두 손가락 벌리기 (작은 값이 자주 온다)
        const factor = Math.exp(-clamp(dy, -240, 240) * (event.ctrlKey ? 0.01 : 0.0015));
        let next = clamp(scale * factor, 1, maxZoom());
        if (next < 1.01) next = 1;
        if (next === scale) return;
        lastTap = null;
        zoomAround(next, event.clientX, event.clientY, box());
        if (next === 1) {
            tx = 0;
            ty = 0;
        }
        if (event.ctrlKey) stopEase();
        else ease(WHEEL_EASE_MS);
        apply();
        rebase(); // 끄는 중에 휠을 굴렸으면 거기서부터 이어서 옮긴다
    }

    // 창 크기가 바뀌면(폰 가로 · 세로 돌리기, 주소창) 확대한 그림을 무대 안으로 다시 맞춘다
    const observer = new ResizeObserver(() => {
        if (scale === 1 && !tx && !ty) return;
        clampPan(box());
        apply();
        rebase();
    });
    observer.observe(stage);

    img.draggable = false;
    stage.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('dblclick', onDblClick);
    // 위 제목 줄 · 아래 단추 줄 위의 Ctrl+휠(터치패드 벌리기)도 페이지 전체 확대가 되지 않게 — 그냥 휠은 그대로 둔다
    element.addEventListener('wheel', (event) => {
        if (event.ctrlKey) event.preventDefault();
    }, { passive: false });
    // 마우스로 끌 때 글자가 골라지거나 그림 끌어 놓기가 시작되지 않게 (넘기기 단추는 단추대로 둔다)
    stage.addEventListener('mousedown', (event) => {
        if (event.button === 0 && !event.target.closest('button')) event.preventDefault();
    });
    // iOS 사파리는 touch-action 과 따로 페이지 확대 제스처를 보낸다
    element.addEventListener('gesturestart', event => event.preventDefault());

    return {
        zoomed,
        /** 끌기 · 두 손가락 · 두 번 톡 직후라 따라오는 click 을 닫기로 치지 않을 때 */
        quiet: () => Date.now() < quietUntil,
        /** 다른 그림으로 바뀔 때 — 누르던 것까지 모두 잊고 원래 크기로 */
        clear() {
            // 끄는 중에 ← → 키로 바뀌었다: 무대 붙잡기를 풀고, 뗄 때 따라오는 click 은 onUp(stale)이 조용히 넘긴다
            // (안 그러면 그 click 이 1배가 된 무대 — 어두운 곳 — 에 닿아 창이 닫혔다)
            for (const id of pointers.keys()) {
                stale.add(id);
                try {
                    if (stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
                } catch { /* 이미 뗐다 */ }
            }
            pointers.clear();
            gesture = null;
            lastTap = null;
            mouseTaps = 0;
            setMoving(false);
            reset(false);
        },
        destroy() {
            observer.disconnect();
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            clearTimeout(easeTimer);
        },
    };
}
