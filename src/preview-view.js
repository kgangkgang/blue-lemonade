// Viewing state belongs to the open panel, never to a saved theme.
export function bindPreviewViews(root, section) {
    root._previewViews ??= new Map();
    root._previewCleanup?.();
    const cleanups = [];
    root._previewCleanup = () => cleanups.splice(0).forEach(fn => fn());
    for (const box of root.querySelectorAll('.salty-prevbox,.bl-inline-preview')) {
        const targets = [...box.children].filter(e => e.matches('.salty-preview,.salty-sample,.salty-uisample,.salty-phonemock,.bl-qr-sample-wrap'));
        if (!targets.length) continue;
        const key = box.dataset.pv || section;
        const state = root._previewViews.get(key) || { scale: 1, x: 0, y: 0 };
        root._previewViews.set(key, state);
        const bar = document.createElement('div'); bar.className = 'bl-view-tools';
        bar.innerHTML = '<button type="button" aria-label="미리보기 축소">−</button><output aria-label="미리보기 배율"></output><button type="button" aria-label="미리보기 확대">+</button><button type="button" class="bl-view-reset">원래 크기</button><small>드래그 · 두 손가락으로 조절</small>';
        const viewport = document.createElement('div'); viewport.className = 'bl-view-port'; viewport.tabIndex = 0;
        viewport.setAttribute('aria-label', '미리보기 · 방향키 또는 드래그로 이동');
        const scene = document.createElement('div'); scene.className = 'bl-view-scene';
        targets.forEach(e => scene.append(e)); viewport.append(scene); box.append(bar, viewport);
        const [minus, plus, reset] = bar.querySelectorAll('button'), output = bar.querySelector('output');
        let width = 0, height = 0, viewHeight = 0, raf = 0;
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
            box.append(row); grip = row.firstElementChild;
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
        function paint() {
            raf = 0;
            const extraX = Math.max(0, width * (state.scale - 1));
            state.x = Math.max(-extraX / 2, Math.min(extraX / 2, state.x));
            state.y = Math.max(Math.min(0, viewHeight - height * state.scale), Math.min(0, state.y));
            scene.style.transform = `translate(${(width - width * state.scale) / 2 + state.x}px,${state.y}px) scale(${state.scale})`;
            output.textContent = `${Math.round(state.scale * 100)}%`;
            minus.disabled = state.scale <= .5; plus.disabled = state.scale >= 3;
        }
        const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
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
                const maxX = Math.max(0, width * (state.scale - 1)) / 2;
                const x = Math.max(-maxX, Math.min(maxX, state.x - dx));
                const y = Math.max(Math.min(0, viewHeight - height * state.scale), Math.min(0, state.y - dy));
                if (x === state.x && y === state.y) return;
                state.x = x; state.y = y; schedule();
            }
            e.preventDefault(); e.stopPropagation();
        };
        viewport.addEventListener('wheel', wheel, { passive: false });
        function zoom(value, center = { x: width / 2, y: viewHeight / 2 }) {
            const next = Math.max(.5, Math.min(3, value)), ratio = next / state.scale;
            state.x = (state.x - (center.x - width / 2)) * ratio + center.x - width / 2;
            state.y = (state.y - center.y) * ratio + center.y;
            state.scale = next; schedule();
        }
        minus.onclick = () => zoom(state.scale - .25);
        plus.onclick = () => zoom(state.scale + .25);
        reset.onclick = () => { Object.assign(state, { scale: 1, x: 0, y: 0 }); schedule(); };
        viewport.onkeydown = e => {
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
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            viewport.setPointerCapture(e.pointerId); e.preventDefault();
        };
        viewport.onpointermove = e => {
            const old = pointers.get(e.pointerId); if (!old) return;
            const next = { x: e.clientX, y: e.clientY };
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
        const measure = () => {
            if (!box.isConnected) { dispose(); return; }
            // Hidden drawers and folded previews have zero dimensions. Keep pan
            // until the same view becomes visible again instead of clamping to 0.
            if (!scene.offsetWidth || !scene.offsetHeight) return;
            width = scene.offsetWidth; height = scene.offsetHeight;
            viewHeight = Number.isFinite(state.height) ? Math.max(48, Math.min(state.height, heightLimit())) : Math.min(height, heightLimit(), sideBySide() && grip ? heightLimit() : Math.min(window.innerHeight * .28, 230));
            viewport.style.height = `${viewHeight}px`; schedule();
            if (grip) { grip.setAttribute('aria-valuemin', '48'); grip.setAttribute('aria-valuemax', String(Math.round(heightLimit()))); grip.setAttribute('aria-valuenow', String(Math.round(viewHeight))); }
        };
        const resize = new ResizeObserver(measure);
        const dispose = () => { resize.disconnect(); cancelAnimationFrame(raf); pointers.clear(); resizeStart = null; window.removeEventListener('resize', measure); root.removeEventListener('bl:preview-resize', measure); };
        measure();
        resize.observe(scene);
        window.addEventListener('resize', measure, { passive: true });
        root.addEventListener('bl:preview-resize', measure);
        cleanups.push(dispose);
    }
}
