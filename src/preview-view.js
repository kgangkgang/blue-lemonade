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
            width = scene.offsetWidth; height = scene.offsetHeight;
            viewHeight = Math.min(height, Math.min(window.innerHeight * .28, 230));
            viewport.style.height = `${viewHeight}px`; schedule();
        };
        const resize = new ResizeObserver(measure);
        const dispose = () => { resize.disconnect(); cancelAnimationFrame(raf); pointers.clear(); window.removeEventListener('resize', measure); };
        resize.observe(scene);
        window.addEventListener('resize', measure, { passive: true });
        cleanups.push(dispose);
    }
}
