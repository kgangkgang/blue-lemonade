// 캐릭터 에셋 — 그림 크게 보기 (넘기기, 확대, 켜기/끄기, 태그 복사, 이름 바꾸기, 지우기)
// <dialog>의 맨 위 층(top layer)에 띄워서, 폰에서 html에 transform이 걸려 있어도 화면 밖으로 밀리지 않는다.
import { fixToastrForDialogs } from '../../../../../../popup.js';
import { disabledSet, setDisabled, forgetOptimized, copyOptimized } from './state.js';
import { deleteAsset, renameAsset, sanitizeBase, sameBaseSiblings, baseOf } from './assets.js';
import { toast, confirmDialog, inputDialog, copyText, applyThemeVars } from './ui.js';
import { runtime, reload, recompute, sourceByKey } from './store.js';

let dialog = null;

/** 창을 닫고 바로 치운다. 실리태번이 toast 컨테이너를 dialog 안으로 옮겨 두므로, 치우기 전에 body로 되돌린다. */
function dispose(element) {
    if (dialog === element) dialog = null;
    element._cleanup?.(); // 5.4.3: 창 위 Esc 가로채기 풀기 · 확대 감시(크기 변화) 풀기
    if (element.open) element.close();
    fixToastrForDialogs();
    element.remove();
}

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
 * @param {{ element: HTMLDialogElement, stage: HTMLElement, img: HTMLImageElement, onSwipe: (delta: number) => void }} options
 */
function attachZoom({ element, stage, img, onSwipe }) {
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
            zoomAround(ZOOM_DOUBLE, x, y, box());
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
            scale = clamp(pinch.scale * Math.hypot(p1.x - p2.x, p1.y - p2.y) / pinch.dist, ZOOM_PINCH_MIN, ZOOM_MAX);
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
        let next = clamp(scale * factor, 1, ZOOM_MAX);
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

export function closeViewer() {
    if (dialog) dispose(dialog);
}

/**
 * @param {{ items: import('./assets.js').Asset[], start?: number }} options items는 보이는 순서의 파일 목록
 */
export function openViewer({ items, start = 0 }) {
    closeViewer();
    if (!items.length) return;
    let list = [...items];
    let cursor = Math.min(Math.max(0, start), list.length - 1);
    let working = false;

    dialog = document.createElement('dialog');
    dialog.className = 'eh-root eh-viewer';
    applyThemeVars(dialog);
    dialog.innerHTML = `
        <div class="eh-viewer-top">
            <div class="eh-viewer-title">
                <b class="eh-viewer-name"></b>
                <span class="eh-viewer-meta">
                    <span class="eh-viewer-count"></span>
                    <span class="eh-viewer-state" hidden><i class="fa-solid fa-eye-slash"></i> 꺼짐 · AI에게 알려 주지 않아요</span>
                </span>
            </div>
            <button type="button" class="eh-icon-btn eh-icon-btn--light" data-act="close" aria-label="닫기"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="eh-viewer-stage">
            <button type="button" class="eh-viewer-nav eh-viewer-nav--prev" data-act="prev" aria-label="이전"><i class="fa-solid fa-chevron-left"></i></button>
            <img class="eh-viewer-img" alt="">
            <button type="button" class="eh-viewer-nav eh-viewer-nav--next" data-act="next" aria-label="다음"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="eh-viewer-actions">
            <button type="button" class="eh-vbtn" data-act="toggle"><i class="fa-solid fa-eye-slash"></i><span>끄기</span></button>
            <button type="button" class="eh-vbtn" data-act="copy"><i class="fa-solid fa-tag"></i><span>태그 복사</span></button>
            <button type="button" class="eh-vbtn" data-act="rename"><i class="fa-solid fa-pen"></i><span>이름 바꾸기</span></button>
            <button type="button" class="eh-vbtn eh-vbtn--danger" data-act="delete"><i class="fa-solid fa-trash"></i><span>지우기</span></button>
        </div>`;

    const element = dialog;
    const img = element.querySelector('.eh-viewer-img');
    const name = element.querySelector('.eh-viewer-name');
    const count = element.querySelector('.eh-viewer-count');
    const state = element.querySelector('.eh-viewer-state');
    const prev = element.querySelector('[data-act="prev"]');
    const next = element.querySelector('[data-act="next"]');
    const toggle = element.querySelector('[data-act="toggle"]');
    const rename = element.querySelector('[data-act="rename"]');
    const remove = element.querySelector('[data-act="delete"]');

    const current = () => list[cursor];
    /** 이름 바꾸기 · 지우기가 되는 파일인지 — 이 캐릭터의 폴더(원본 · 프리셋)만. 불러온 남의 폴더는 설정 칸처럼 그 캐릭터에서만 (panel.js ownActive) */
    const ownFile = asset => sourceByKey(asset.folder)?.own === true;

    // 확대 · 옮기기 · 쓸어 넘기기 (attachZoom). 쓸어 넘기기는 확대하지 않았을 때만 온다.
    const stage = element.querySelector('.eh-viewer-stage');
    const zoom = attachZoom({ element, stage, img, onSwipe: delta => step(delta) });
    /** 지금 띄운 그림 주소 — 다른 그림으로 바뀔 때만 원래 크기로 돌린다 (끄기 · 켜기로 다시 그릴 때는 그대로) */
    let shownUrl = '';

    function show() {
        const asset = current();
        if (!asset) {
            closeViewer();
            return;
        }
        if (asset.url !== shownUrl) {
            shownUrl = asset.url;
            zoom.clear();
        }
        img.src = asset.url;
        img.alt = asset.file;
        name.textContent = asset.file;
        count.textContent = `${cursor + 1} / ${list.length}`;
        prev.hidden = list.length < 2;
        next.hidden = list.length < 2;
        const off = disabledSet(asset.folder).has(asset.file);
        // 버튼에는 '누르면 하는 일'을, 상태는 이름 옆 표시와 흐린 그림으로 보여 준다.
        element.classList.toggle('is-off', off);
        state.hidden = !off;
        toggle.querySelector('i').className = `fa-solid ${off ? 'fa-eye' : 'fa-eye-slash'}`;
        toggle.querySelector('span').textContent = off ? '켜기' : '끄기';
        toggle.setAttribute('aria-pressed', String(off));
        rename.hidden = !ownFile(asset);
        remove.hidden = !ownFile(asset);
    }

    function step(delta) {
        if (list.length < 2) return;
        cursor = (cursor + delta + list.length) % list.length;
        show();
    }

    function onToggle() {
        const asset = current();
        const off = !disabledSet(asset.folder).has(asset.file);
        setDisabled(asset.folder, asset.file, off);
        recompute();
        show();
    }

    async function onCopy() {
        const tag = `{{img::${current().file}}}`;
        const ok = await copyText(tag);
        toast(ok ? 'success' : 'error', ok ? `${tag} 복사했어요.` : '복사하지 못했어요.');
    }

    async function onRename() {
        const asset = current();
        if (!ownFile(asset)) return;
        const input = await inputDialog(`새 이름을 적어 주세요. (확장자 .${asset.ext}는 그대로예요)\n번호 묶음으로 만들려면 이름 뒤에 -1, -2처럼 번호를 붙여요.`, asset.base, { ok: '바꾸기' });
        if (input === null) return;
        const newBase = sanitizeBase(input);
        if (!newBase) {
            toast('warning', '이름이 비어 있어요.');
            return;
        }
        if (newBase === asset.base) return;
        if (newBase.toLowerCase() === asset.base.toLowerCase()) {
            toast('warning', '대소문자만 다른 이름으로는 바꿀 수 없어요.');
            return;
        }
        // 같은 폴더(프리셋) 안에서만 겹침을 본다 — 다른 프리셋에 같은 이름이 있는 건 일부러 그런 것
        // 1.3.2: 합친 목록(runtime.assets)이 아니라 그 폴더의 목록을 본다. 합친 목록에는 꺼 둔 프리셋의 그림과 위 폴더에 가려진
        //        같은 이름이 없어서, 그런 폴더에서는 묻지도 않고 있던 파일을 덮어썼다.
        const inFolder = runtime.sources.find(source => source.key === asset.folder)?.assets ?? [];
        const takenAll = inFolder.filter(other => other !== asset && other.base.toLowerCase() === newBase.toLowerCase());
        const taken = takenAll[0] ?? null;
        if (taken && !(await confirmDialog(`'${takenAll.map(item => item.file).join(', ')}'이(가) 이미 있어요. 그 파일을 덮어쓸까요?`, { ok: '덮어쓰기' }))) return;
        // 1.3.2: 서버는 예전 이름을 지울 때 확장자만 다른 같은 이름(이름.jpg 등)도 함께 지운다. 지우기처럼 먼저 알린다.
        const siblings = sameBaseSiblings(inFolder, asset);
        if (siblings.length && !(await confirmDialog(`같은 이름의 ${siblings.map(item => item.file).join(', ')}도 함께 지워져요. 이 파일만 따로 이름을 바꿀 수는 없어요.\n계속할까요?`, { ok: '바꾸기' }))) return;

        working = true;
        const wasOff = disabledSet(asset.folder).has(asset.file);
        const newFile = `${newBase}.${asset.ext}`;
        let partial = false;
        try {
            await renameAsset(asset, newBase, {
                taken,
                // 새 파일이 생기자마자 꺼짐 상태를 옮겨서, 예전 파일 지우기가 실패해도 숨긴 그림이 AI에게 새지 않게 한다.
                afterUpload: () => {
                    copyOptimized(asset.folder, asset.file, asset.folder, newFile);
                    // 2026-10-06: 덮어쓴 같은 이름의 꺼짐은 지우고 새 파일은 제 상태를 가진다 (꺼 둔 이름으로 바꾸면 켜진 그림이 꺼지던 것).
                    //             올리기가 지우는 건 이름이 똑같은 파일뿐 — 대소문자만 다른 이름의 꺼짐은 pruneDisabled 가 알아서 버린다.
                    for (const name of disabledSet(asset.folder)) if (name !== newFile && baseOf(name) === newBase) setDisabled(asset.folder, name, false);
                    setDisabled(asset.folder, newFile, wasOff);
                },
            });
        } catch (error) {
            console.error('[캐릭터 에셋] 이름 바꾸기 실패', error);
            if (!error?.partial) {
                toast('error', `이름을 바꾸지 못했어요. ${error?.message ?? ''}`);
                working = false;
                return;
            }
            partial = true;
            toast('warning', error.message, { timeOut: 10000 });
        }
        try {
            if (!partial) {
                setDisabled(asset.folder, asset.file, false);
                forgetOptimized(asset.folder, [asset.file, ...siblings.map(item => item.file)]);
            }
            await reload();
            const fresh = runtime.sources.find(source => source.key === asset.folder)?.assets.find(other => other.file.toLowerCase() === newFile.toLowerCase()) ?? null;
            // 덮어쓴 파일과 함께 지워진 같은 이름 파일은 넘겨 보기 목록에서도 뺀다
            for (const gone of [...takenAll, ...(partial ? [] : siblings)]) {
                const removed = list.findIndex((item, i) => i !== cursor && item.folder === gone.folder && item.file === gone.file);
                if (removed >= 0) {
                    list.splice(removed, 1);
                    if (removed < cursor) cursor--;
                }
            }
            if (partial) {
                // 예전 파일이 남아 있으니 그대로 보여 주고, 새 파일은 목록 뒤에 붙인다.
                if (fresh && !list.includes(fresh)) list.push(fresh);
            } else if (fresh) {
                list[cursor] = fresh;
                toast('success', `'${asset.file}' → '${newFile}'`);
            } else {
                list.splice(cursor, 1);
            }
            if (!list.length) {
                closeViewer();
                return;
            }
            cursor = Math.min(cursor, list.length - 1);
            show();
        } finally {
            working = false;
        }
    }

    async function onDelete() {
        const asset = current();
        if (!ownFile(asset)) return;
        // 서버는 확장자만 다른 같은 이름의 파일도 함께 지운다.
        const siblings = sameBaseSiblings(runtime.sources.find(source => source.key === asset.folder)?.assets ?? [], asset);
        const extra = siblings.length ? `\n같은 이름의 ${siblings.map(item => item.file).join(', ')}도 함께 지워져요.` : '';
        if (!(await confirmDialog(`'${asset.file}' 그림을 지울까요?${extra}\n파일이 지워지고 되돌릴 수 없어요.`, { ok: '지우기' }))) return;
        working = true;
        try {
            await deleteAsset(asset.folder, asset.base);
            const gone = new Set([asset, ...siblings].map(item => item.file));
            for (const file of gone) setDisabled(asset.folder, file, false);
            forgetOptimized(asset.folder, [...gone]);
            toast('success', `'${asset.file}'을(를) 지웠어요.`);
            await reload();
            // 채팅 · 북마크 카드 · 메모에 이미 떠 있는 그 그림을 숨기게 알린다 (hold.js)
            document.dispatchEvent(new CustomEvent('char-assets:deleted', { detail: { folder: asset.folder, files: [...gone] } }));
            list = list.filter(item => !gone.has(item.file) && runtime.sources.some(source => source.assets.some(other => other.folder === item.folder && other.file === item.file)));
            if (!list.length) {
                closeViewer();
                return;
            }
            cursor = Math.min(cursor, list.length - 1);
            show();
        } catch (error) {
            console.error('[캐릭터 에셋] 지우기 실패', error);
            toast('error', `지우지 못했어요. ${error?.message ?? ''}`);
        } finally {
            working = false;
        }
    }

    // 채팅의 그림을 꾹 눌러 열었을 때(hold.js) 손을 떼며 오는 click 이 어두운 곳에 닿아도 바로 닫히지 않게 — hold.js 가 먼저 먹지만 한 번 더
    const openedAt = Date.now();
    element.addEventListener('click', (event) => {
        const action = event.target.closest('[data-act]')?.dataset.act;
        if (!action) {
            // 그림 바깥(어두운 곳)을 누르면 닫는다. 쓸어 넘기기 · 끌기 · 두 번 톡 직후의 click 과, 확대해서 보는 중에는 닫지 않는다.
            if (zoom.quiet() || zoom.zoomed() || Date.now() - openedAt < 350) return;
            if (event.target === element || event.target.classList.contains('eh-viewer-stage')) closeViewer();
            return;
        }
        if (working) return;
        if (action === 'close') closeViewer();
        else if (action === 'prev') step(-1);
        else if (action === 'next') step(1);
        else if (action === 'toggle') onToggle();
        else if (action === 'copy') onCopy();
        else if (action === 'rename') onRename();
        else if (action === 'delete') onDelete();
    });

    // 실리태번은 html에서 mousedown/touchstart를 받아 '서랍 바깥을 눌렀다'고 보고 확장 서랍을 닫아 버린다.
    // 이 창은 body에 붙어 있어 서랍 바깥으로 보이므로, 누름 이벤트가 html까지 올라가지 않게 막는다.
    for (const type of ['mousedown', 'touchstart', 'pointerdown']) {
        element.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
    }

    // 창이 떠 있는 동안 실리태번 전역 단축키(← → 스와이프, ↑ 마지막 메시지 편집 등)로 새지 않게 막는다.
    element.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (working) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    });
    element.addEventListener('keyup', (event) => event.stopPropagation());

    // Esc 등 브라우저가 직접 닫았을 때도 치운다
    element.addEventListener('close', () => {
        if (element.isConnected) dispose(element);
    });
    // 5.4.3: 북마크 창 · 앞뒤 문맥 창 위에서 연 경우(채팅 그림 꾹 누르기) 그 창들의 document 캡처 Esc 가 먼저 받아 밑의 창을 닫고
    // preventDefault 로 이 창의 Esc 닫기까지 막았다 — 이 창이 맨 위일 때만 window 캡처로 먼저 받아 이 창만 닫는다.
    // 창 위에 확인 · 입력 팝업이 떠 있으면 그 팝업이 맨 위이므로 건드리지 않는다.
    const onEsc = (event) => {
        if (event.key !== 'Escape' || !element.open) return;
        const open = [...document.querySelectorAll('dialog[open]')];
        if (open[open.length - 1] !== element) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        dispose(element);
    };
    window.addEventListener('keydown', onEsc, true);
    element._cleanup = () => {
        window.removeEventListener('keydown', onEsc, true);
        zoom.destroy();
    };

    document.body.append(element);
    show();
    element.showModal();
    // toast 컨테이너를 맨 위 층(dialog 안)으로 옮겨야 창 위에 알림이 보인다.
    fixToastrForDialogs();
}
