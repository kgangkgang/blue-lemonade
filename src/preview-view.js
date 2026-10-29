import { updateQrEdges } from './layout.js';
import { dragIntent } from './touch-drag-intent.js';   // 8.2.3 폰: 세로 끌기는 화면 스크롤에 양보, 가로 끌기만 미리보기 이동
// 8.2.6 성능: 미리보기 칸 재기를 한 프레임에 모아 「모두 읽고 → 모두 쓰고 → 그리기」 순서로 돌려요.
//   예전에는 칸마다 제 프레임 콜백에서 「읽기 → 높이 쓰기 → 다시 읽기(viewport.clientWidth)」를 해서, 칸이 N개면 한 프레임에 강제 배치가 2N번이었어요
//   (긴 채팅 위에 테마 설정 창을 열면 그 한 번이 문서 전체 배치 — 전수조사 4절 8, 창 열기 테마 JS 의 84%). 이제는 읽기 묶음 앞에서 한 번이에요.
//   viewport 는 overflow:hidden 이라 제 높이를 바꿔도 안쪽 폭(clientWidth)이 그대로여서, 폭은 높이를 쓰기 전에 읽어도 같은 값이에요.
//   (높이가 늘어 바깥 서랍에 스크롤 막대가 생기는 드문 경우는 장면 폭이 바뀌어 ResizeObserver 가 다음 프레임에 다시 재요 — 예전과 같은 자리로 모여요)
const queued = new Set();
let batchFrame = 0, batchTimer = 0;
export const previewMeasureStats = { batches: 0, measured: 0 };   // 시험 · 진단용
function runBatch() {
    batchFrame = 0; batchTimer = 0;
    const list = [...queued]; queued.clear();
    previewMeasureStats.batches++;
    const ready = [];
    for (const task of list) { const r = task.read(); if (r) ready.push([task, r]); }
    for (const [task, r] of ready) task.write(r);
    for (const [task, r] of ready) task.finish(r);
    previewMeasureStats.measured += ready.length;
}
function queueMeasure(task) {
    queued.add(task);
    if (batchFrame || batchTimer) return;
    // Hidden tabs do not receive animation frames. Keep the preview
    // usable there as well, without retaining callbacks after close.
    if (document.hidden) batchTimer = setTimeout(runBatch, 0);
    else batchFrame = requestAnimationFrame(runBatch);
}
// Viewing state belongs to the open panel, never to a saved theme.
/** 8.2.3 미리보기 위 세로 끌기가 굴릴 칸: 설정 편집 창은 .salty-sec(미리보기 무대와 형제라 조상이 아님), 서랍 · 팝업 판은 가장 가까운 스크롤 칸 */
function scrollerOf(root, box) {
    return root.querySelector?.('.bl-editor .salty-sec') || box.closest('.drawer-content, .popup-content, .salty-sec') || null;
}
export function bindPreviewViews(root, section) {
    root._previewViews ??= new Map();
    root._previewCleanup?.();
    const cleanups = [];
    root._previewCleanup = () => cleanups.splice(0).forEach(fn => fn());
    for (const box of root.querySelectorAll('.salty-prevbox,.bl-inline-preview')) {
        const targets = [...box.children].filter(e => e.matches('.salty-preview,.salty-sample,.salty-uisample,.salty-phonemock,.bl-qr-sample-wrap,.bl-ft-preview'));
        if (!targets.length) continue;
        const key = box.dataset.pv || section;
        const state = root._previewViews.get(key) || { scale: 1, x: 0, y: 0 };
        root._previewViews.set(key, state);
        const bar = document.createElement('div'); bar.className = 'bl-view-tools';
        bar.innerHTML = '<button type="button" aria-label="미리보기 축소">−</button><output aria-label="미리보기 배율"></output><button type="button" aria-label="미리보기 확대">+</button><button type="button" class="bl-view-reset">원래 크기</button><small>드래그 · 두 손가락으로 조절</small>';
        const viewport = document.createElement('div'); viewport.className = 'bl-view-port'; viewport.tabIndex = 0;
        // Reserve the last measured height while the new DOM is being built.
        // Measuring here forces style/layout halfway through a settings render.
        viewport.style.height = `${state.viewHeight || Math.min(window.innerHeight * .22, Number(box.dataset.pvMax) || 180)}px`;
        viewport.setAttribute('aria-label', '미리보기 · 방향키 또는 드래그로 이동');
        const scene = document.createElement('div'); scene.className = 'bl-view-scene';
        targets.forEach(e => scene.append(e)); viewport.append(scene); box.append(bar, viewport);
        // 확대 · 축소 줄은 평소엔 접어 둔다 (4.1.2) — 폰에서 설정 줄이 더 보이게. 돋보기로 펴고, 두 손가락 · 휠 · 키보드 확대는 그대로
        const toolsToggle = document.createElement('button'); toolsToggle.type = 'button'; toolsToggle.className = 'bl-view-toggle';
        toolsToggle.innerHTML = '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>'; toolsToggle.setAttribute('aria-label', '미리보기 확대 · 축소 도구');
        const syncTools = () => { bar.hidden = !state.tools; toolsToggle.setAttribute('aria-expanded', String(!!state.tools)); };
        toolsToggle.onclick = () => { state.tools = !state.tools; syncTools(); measure(); };
        syncTools();
        const [minus, plus, reset] = bar.querySelectorAll('button'), output = bar.querySelector('output');
        let width = 0, height = 0, viewHeight = 0, raf = 0, disposed = false;
        const pointers = new Map();
        let resizeStart = null, grip;
        const sideBySide = () => getComputedStyle(root.querySelector('.bl-editor-workspace') || root).display === 'grid';
        const heightLimit = () => {
            const work = root.querySelector('.bl-editor-workspace');
            const available = work?.clientHeight || window.innerHeight - (root.querySelector('.salty-nav')?.offsetHeight || 0);
            return Math.max(48, Math.min(window.innerHeight * .7, available - bar.offsetHeight - (grip ? 48 : 0) - (sideBySide() ? 80 : 150)));
        };
        if (box.classList.contains('salty-prevbox')) {
            const row = document.createElement('div'); row.className = 'bl-view-resize';
            row.innerHTML = '<div class="bl-view-grip" role="separator" tabindex="0" aria-label="미리보기 높이 조절" aria-orientation="horizontal" title="위아래로 끌어서 높이 조절"><i></i></div><button type="button" aria-label="미리보기 기본 높이" title="기본 높이로">↺</button>';
            box.append(row); grip = row.firstElementChild; row.prepend(toolsToggle);
            grip.onpointerdown = e => { if (e.button !== 0) return; resizeStart = { id: e.pointerId, y: e.clientY, height: viewHeight }; grip.setPointerCapture(e.pointerId); e.preventDefault(); };
            grip.onpointermove = e => { if (resizeStart?.id !== e.pointerId) return; state.height = Math.max(48, Math.min(heightLimit(), resizeStart.height + e.clientY - resizeStart.y)); measure(); e.preventDefault(); };
            grip.onpointerup = grip.onpointercancel = grip.onlostpointercapture = () => { resizeStart = null; };
            grip.onkeydown = e => {
                if (e.key === 'Home') state.height = null;
                else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') state.height = Math.max(48, Math.min(heightLimit(), viewHeight + (e.key === 'ArrowUp' ? -16 : 16)));
                else return;
                measure(); e.preventDefault(); e.stopPropagation();
            };
            row.lastElementChild.onclick = () => { state.height = null; measure(); };
        }
        if (!toolsToggle.isConnected) { box.classList.add('bl-view-float'); box.append(toolsToggle); }
        // 5.3.7 같은 값이면 쓰지 않는다 — 슬라이더 틱마다 변환 · 글자 · disabled 를 다시 써 작은 재계산이 붙었다
        let painted = '';
        function paint(cw = viewport.clientWidth) {
            raf = 0;
            const extraX = Math.max(0, width * state.scale - cw);
            state.x = Math.max(-extraX / 2, Math.min(extraX / 2, state.x));
            state.y = Math.max(Math.min(0, viewHeight - height * state.scale), Math.min(0, state.y));
            const transform = `translate(${(cw - width * state.scale) / 2 + state.x}px,${state.y}px) scale(${state.scale})`;
            if (transform === painted && scene.style.transform === transform) return;
            painted = transform;
            scene.style.transform = transform;
            output.textContent = `${Math.round(state.scale * 100)}%`;
            minus.disabled = state.scale <= .5; plus.disabled = state.scale >= 3;
        }
        const schedule = () => { if (!raf) raf = requestAnimationFrame(() => paint()); };
        const wheel = e => {
            if (e.ctrlKey || e.metaKey) return;
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewHeight : 1;
            const dx = (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit;
            const dy = (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit;
            const qr = state.scale === 1 && box.dataset.pv === 'qr' && scene.querySelector('[data-qr-sample]');
            if (qr) {
                const x = qr.scrollLeft, y = qr.scrollTop;
                if (qr.scrollWidth > qr.clientWidth) qr.scrollLeft += dx || dy;
                else qr.scrollTop += dy;
                if (qr.scrollLeft === x && qr.scrollTop === y) return;
            } else {
                const maxX = Math.max(0, width * state.scale - viewport.clientWidth) / 2;
                const x = Math.max(-maxX, Math.min(maxX, state.x - dx));
                const y = Math.max(Math.min(0, viewHeight - height * state.scale), Math.min(0, state.y - dy));
                if (x === state.x && y === state.y) return;
                state.x = x; state.y = y; schedule();
            }
            e.preventDefault(); e.stopPropagation();
        };
        viewport.addEventListener('wheel', wheel, { passive: false });
        function zoom(value, center = { x: viewport.clientWidth / 2, y: viewHeight / 2 }) {
            const next = Math.max(.5, Math.min(3, value)), ratio = next / state.scale;
            state.x = (state.x - (center.x - viewport.clientWidth / 2)) * ratio + center.x - viewport.clientWidth / 2;
            state.y = (state.y - center.y) * ratio + center.y;
            state.scale = next; schedule();
        }
        minus.onclick = () => zoom(state.scale - .25);
        plus.onclick = () => zoom(state.scale + .25);
        reset.onclick = () => { Object.assign(state, { scale: 1, x: 0, y: 0 }); schedule(); };
        viewport.onkeydown = e => {
            if (box.dataset.pv === 'markdown' && e.target !== viewport) return;
            if (e.key === '+' || e.key === '=') zoom(state.scale + .25);
            else if (e.key === '-') zoom(state.scale - .25);
            else if (e.key === 'Home' || e.key === '0') reset.click();
            else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
                state.x += e.key === 'ArrowLeft' ? 32 : e.key === 'ArrowRight' ? -32 : 0;
                state.y += e.key === 'ArrowUp' ? 32 : e.key === 'ArrowDown' ? -32 : 0; schedule();
            } else return;
            e.preventDefault(); e.stopPropagation();
        };
        viewport.onpointerdown = e => {
            if (e.button !== 0) return;
            if (box.dataset.pv === 'markdown' && e.target.closest('summary,a,button,input,select,textarea')) return;
            // 8.2.3 터치 한 손가락은 첫 8px 방향을 본 뒤 결정(decided) — 세로면 설정 칸(scroll)을 손가락 따라 굴리고(설정 칸이 조상이 아니라 브라우저가 못 굴린다), 가로면 미리보기 이동. 마우스는 바로 끌기
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, decided: e.pointerType !== 'touch', scroll: null });
            viewport.setPointerCapture(e.pointerId); e.preventDefault();
        };
        viewport.onpointermove = e => {
            const old = pointers.get(e.pointerId); if (!old) return;
            const next = { x: e.clientX, y: e.clientY, x0: old.x0, y0: old.y0, decided: old.decided, scroll: old.scroll };
            if (!next.decided) {
                // 두 손가락은 확대라 바로 결정. 한 손가락은 첫 8px 이 세로 우세면 설정 칸 스크롤(아래 scroll), 가로 우세면 미리보기 이동
                const intent = pointers.size >= 2 ? 'horizontal' : dragIntent(next.x - old.x0, next.y - old.y0);
                if (!intent) { pointers.set(e.pointerId, next); return; }
                if (intent === 'vertical') next.scroll = scrollerOf(root, box);
                next.decided = true;
            }
            if (next.scroll) {
                // 세로 끌기 = 화면 스크롤(사용자 결정 10-29). 손가락 따라 설정 칸을 굴린다 — 미리보기는 안 움직인다
                if (pointers.size === 1) next.scroll.scrollTop -= next.y - old.y;
                pointers.set(e.pointerId, next); e.preventDefault(); return;
            }
            if (pointers.size === 2) {
                const other = [...pointers].find(([id]) => id !== e.pointerId)[1];
                const d0 = Math.hypot(old.x - other.x, old.y - other.y), d1 = Math.hypot(next.x - other.x, next.y - other.y);
                const rect = viewport.getBoundingClientRect();
                if (d0 > 2) zoom(state.scale * d1 / d0, { x: (old.x + other.x) / 2 - rect.left, y: (old.y + other.y) / 2 - rect.top });
                state.x += (next.x - old.x) / 2; state.y += (next.y - old.y) / 2;
            } else if (pointers.size === 1) {
                const qr = state.scale === 1 && box.dataset.pv === 'qr' && scene.querySelector('[data-qr-sample]');
                if (qr) { qr.scrollLeft -= next.x - old.x; qr.scrollTop -= next.y - old.y; }
                else { state.x += next.x - old.x; state.y += next.y - old.y; }
            }
            pointers.set(e.pointerId, next); schedule(); e.preventDefault();
        };
        viewport.onpointerup = viewport.onpointercancel = viewport.onlostpointercapture = e => pointers.delete(e.pointerId);
        const qrSample = box.dataset.pv === 'qr' && scene.querySelector('[data-qr-sample]');
        const syncQr = () => { if (qrSample && state.scale === 1) updateQrEdges(qrSample); };
        qrSample?.addEventListener?.('scroll', syncQr, {passive:true});
        // 읽기 — 이 칸의 크기 · 높이 한계 · 안쪽 폭. 쓰기 전에 모두 읽어요(5.3.7 와 같은 뜻을 여러 칸에 걸쳐)
        const read = () => {
            if (disposed) return null;
            if (!box.isConnected) { dispose(); return null; }
            // Hidden drawers and folded previews have zero dimensions. Keep pan
            // until the same view becomes visible again instead of clamping to 0.
            if (!scene.offsetWidth || !scene.offsetHeight) return null;
            width = scene.offsetWidth; height = scene.offsetHeight;
            const limit = heightLimit();
            // A stacked preview leaves room for settings; an explicitly resized view keeps its height.
            const next = Number.isFinite(state.height) ? Math.max(48, Math.min(state.height, limit)) : Math.min(height, limit, sideBySide() && grip ? limit : Math.min(window.innerHeight * .22, Number(box.dataset.pvMax) || 180)); // data-pv-max: 설정 사이에 끼는 작은 미리보기(상태창 글자)
            return { limit, next, cw: viewport.clientWidth };
        };
        // 쓰기 — 같은 높이면 쓰지 않는다
        const write = r => {
            viewHeight = r.next;
            const px = `${viewHeight}px`;
            state.viewHeight = viewHeight;
            if (viewport.style.height !== px) viewport.style.height = px;
        };
        const finish = r => {
            if (raf) cancelAnimationFrame(raf);
            paint(r.cw);
            if (grip) {
                const max = String(Math.round(r.limit)), now = String(Math.round(viewHeight));
                if (grip.getAttribute('aria-valuemin') !== '48') grip.setAttribute('aria-valuemin', '48');
                if (grip.getAttribute('aria-valuemax') !== max) grip.setAttribute('aria-valuemax', max);
                if (grip.getAttribute('aria-valuenow') !== now) grip.setAttribute('aria-valuenow', now);
            }
            syncQr();
        };
        const task = { read, write, finish };
        // 손으로 끌기 · 키 · 단추는 그 자리에서 바로 (묶음에 남은 것은 뺌)
        const measure = () => { queued.delete(task); const r = read(); if (r) { write(r); finish(r); } };
        const requestMeasure = () => { if (!disposed) queueMeasure(task); };
        const resize = new ResizeObserver(requestMeasure);
        const dispose = () => { disposed = true; queued.delete(task); qrSample?.removeEventListener?.('scroll',syncQr); resize.disconnect(); cancelAnimationFrame(raf); pointers.clear(); resizeStart = null; window.removeEventListener('resize', requestMeasure); root.removeEventListener('bl:preview-resize', requestMeasure); };
        requestMeasure();
        resize.observe(scene);
        window.addEventListener('resize', requestMeasure, { passive: true });
        root.addEventListener('bl:preview-resize', requestMeasure);
        root.addEventListener('bl:preview-resize',syncQr);
        cleanups.push(()=>root.removeEventListener('bl:preview-resize',syncQr));
        syncQr();
        cleanups.push(dispose);
    }
}
