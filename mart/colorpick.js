// 11-08 마트 색 고르기 — 테마 src/colorpick.js(3.5.0)를 사이트로 옮긴 판(사용자 「실리태번 안에 있는 만든 컬러 팔레트 넣어 줘 · 폰 기본 창 조작감 별로」).
//   원형 색판(각도 = 색상 · 거리 = 채도) → 비교 동그라미(처음 색 · 지금 색, 누르면 되돌림) + 밝기 막대 → 코드 칸(+ 화면 스포이트) → 견본 · 최근 색.
//   테마 판과 다른 점: 테마 설정 · 팔레트 · 그림에서 색 따기는 없어요. 견본은 부르는 쪽이 줘요(글꾸 원래 색 등).
//   colorpop.js 가 <input type="color"> 누름을 가로채 처음 누를 때 이 파일을 불러와요.
const RECENT_KEY = 'bl-mart-color-recent';
const RECENT_MAX = 8;
const GRACE = 400;
let layer = null, session = null, closedAt = 0;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hex2 = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
function hsvToRgb(h, s, v) {
    const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5) * 255, f(3) * 255, f(1) * 255];
}
function rgbToHsv(r, g, b, hueFallback = 0) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = hueFallback;
    if (d > 0) {
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;
    }
    return [h, max === 0 ? 0 : d / max, max];
}
const hexOf = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
/** '#RGB' · '#RRGGBB' (# 없어도) → [r, g, b] | null */
function parseHex(text) {
    const m = String(text ?? '').trim().replace(/^#/, '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = [...h].map(c => c + c).join('');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function readRecent() {
    try { const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(list) ? list.filter(c => parseHex(c)).slice(0, RECENT_MAX) : []; } catch { return []; }
}
function pushRecent(color) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([color, ...readRecent().filter(c => c.toLowerCase() !== color.toLowerCase())].slice(0, RECENT_MAX))); } catch { /* 기억 못 해도 고르기는 돼요 */ }
}
function viewport() {
    const vv = window.visualViewport;
    return vv && vv.height > 0 ? { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height } : { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}
const swatchButtons = list => list.map(c => `<button type="button" class="bl-cp-sw" data-sw="${c}" style="--c:${c}" aria-label="${c}"></button>`).join('');

function place(box, anchor) {
    const r = anchor.getBoundingClientRect(), v = viewport(), edge = 8, gap = 8;
    const width = Math.min(296, v.w - edge * 2);
    box.style.width = `${width}px`;
    box.style.maxHeight = `${Math.max(120, v.h - edge * 2)}px`;
    const edgeAt = r.left + r.width / 2 > v.x + v.w / 2 ? r.right - width : r.left;
    box.style.left = `${v.w < 600 ? v.x + (v.w - width) / 2 : clamp(edgeAt, v.x + edge, v.x + v.w - width - edge)}px`;
    box.style.top = '0px';
    const h = box.offsetHeight, below = v.y + v.h - r.bottom - gap - edge, above = r.top - v.y - gap - edge;
    const up = below < h && above > below;
    box.style.top = `${clamp(up ? r.top - gap - h : r.bottom + gap, v.y + edge, Math.max(v.y + edge, v.y + v.h - edge - h))}px`;
    box.classList.toggle('up', up);
}
function render(st) {
    const [r, g, b] = hsvToRgb(st.h, st.s, st.v);
    const box = layer.firstElementChild;
    box.style.setProperty('--rgb', `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`);
    box.style.setProperty('--now', hexOf([r, g, b]));
    const board = box.querySelector('.bl-cp-board'), a = st.h * Math.PI / 180;
    board.style.setProperty('--x', `${50 + Math.cos(a) * st.s * 50}%`);
    board.style.setProperty('--y', `${50 + Math.sin(a) * st.s * 50}%`);
    board.style.setProperty('--dim', `${1 - st.v}`);
    board.setAttribute('aria-valuetext', `색상 ${Math.round(st.h)}°, 채도 ${Math.round(st.s * 100)}%`);
    board.setAttribute('aria-valuenow', String(Math.round(st.h)));
    const bar = box.querySelector('.bl-cp-value');
    bar.style.setProperty('--x', `${st.v * 100}%`);
    bar.style.setProperty('--full', hexOf(hsvToRgb(st.h, st.s, 1)));
    bar.setAttribute('aria-valuenow', String(Math.round(st.v * 100)));
    const input = box.querySelector('.bl-cp-hex');
    if (document.activeElement !== input) input.value = hexOf([r, g, b]).toUpperCase();
    input.removeAttribute('aria-invalid');
}
const now = st => hexOf(hsvToRgb(st.h, st.s, st.v));
// 끄는 동안은 짧게 솎아 칠해요(폰은 더 드물게) · 닫을 때 한 번 더 확정
function emit(final = false) {
    if (!session) return;
    const value = now(session.state), t = performance.now();
    session.dirty = true;
    clearTimeout(session.timer);
    if (final || t - session.lastEmit >= session.every) {
        session.lastEmit = t;
        if (value !== session.lastValue) { session.lastValue = value; session.onInput(value); }
        return;
    }
    session.timer = setTimeout(() => emit(true), session.every - (t - session.lastEmit));
}
function setFrom(rgb) {
    const st = session.state, [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2], st.h);
    st.h = s === 0 || v === 0 ? st.h : h; st.s = v === 0 ? st.s : s; st.v = v;
}
function drag(el, onMove, clampPoint = true) {
    el.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch { /* 합성 누름 */ }
        const move = (ev) => {
            const rect = el.getBoundingClientRect();
            const x = (ev.clientX - rect.left) / rect.width, y = (ev.clientY - rect.top) / rect.height;
            onMove(clampPoint ? clamp(x, 0, 1) : x, clampPoint ? clamp(y, 0, 1) : y);
            render(session.state); emit();
        };
        move(e);
        const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); emit(true); };
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
}
function keys(el, onKey) {
    el.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault(); onKey(d[0], d[1]); render(session.state); emit(true);
    });
}
const onResize = () => { if (layer && session?.anchor.isConnected) place(layer.firstElementChild, session.anchor); };
export const isColorPickOpen = () => !!layer;
/** 막 닫았거나 막 열린 직후의 바깥 누름(유령 누름)인가 */
export const colorPickPhantom = target => (layer && session && Date.now() - session.openedAt < GRACE && !layer.contains(target)) || (!layer && Date.now() - closedAt < 300);

export function closeColorPick() {
    if (!layer) return;
    const s = session;
    clearTimeout(s?.timer);
    const active = document.activeElement, giveBack = !active || active === document.body || layer.contains(active);
    s?.stopEsc?.();
    layer.remove(); layer = null; session = null; closedAt = Date.now();
    window.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('resize', onResize);
    if (!s) return;
    if (giveBack && s.anchor.isConnected) s.anchor.focus?.({ preventScroll: true });
    const value = now(s.state);
    if (s.dirty && value !== s.lastValue) s.onInput(value);
    if (s.dirty && value !== s.original) pushRecent(value);
    s.onClose?.(s.dirty && value !== s.original);
}

/** @param {{ anchor: Element, value: string, swatches?: string[], onInput: (hex: string) => void, onClose?: (changed: boolean) => void }} opts */
export function openColorPick({ anchor, value, swatches = [], onInput, onClose }) {
    closeColorPick();
    const rgb = parseHex(value) || [0, 0, 0], [h, s, v] = rgbToHsv(...rgb), original = hexOf(rgb);
    const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    session = { anchor, onInput, onClose, original, dirty: false, lastValue: original, lastEmit: 0, timer: 0, every: touch ? 90 : 50, openedAt: Date.now(), state: { h, s, v } };
    const seen = new Set(), own = [];
    for (const c of swatches) { const p = parseHex(c); if (!p) continue; const x = hexOf(p); if (!seen.has(x)) { seen.add(x); own.push(x); } }
    const recent = readRecent();
    const host = anchor.closest('dialog[open]') || document.body;
    layer = document.createElement('div');
    layer.className = 'bl-cp-layer';
    layer.innerHTML = `<div class="bl-cp" role="dialog" aria-label="색 고르기" tabindex="-1">
        <div class="bl-cp-board" tabindex="0" role="slider" aria-label="색상 · 채도" aria-valuemin="0" aria-valuemax="360" aria-description="좌우 방향키로 색상, 위아래 방향키로 채도를 조절해요"><i></i></div>
        <div class="bl-cp-mid">
            <button type="button" class="bl-cp-cmp" data-act="revert" aria-label="처음 색으로" title="처음 색으로" style="--was:${original}"><i></i><b></b></button>
            <div class="bl-cp-bars"><div class="bl-cp-value" tabindex="0" role="slider" aria-label="밝기" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>
        </div>
        <div class="bl-cp-code">
            <input type="text" class="bl-cp-hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="색 코드">
            ${'EyeDropper' in window ? '<button type="button" class="bl-cp-drop" data-act="drop" aria-label="화면에서 색 따기" title="화면에서 색 따기"><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M10.6 1.9a1.7 1.7 0 0 1 2.4 0l1.1 1.1a1.7 1.7 0 0 1 0 2.4l-1.6 1.6.6.6-1.1 1.1-.6-.6-5.4 5.4H3.4L2 14.9l-.9-.9 1.4-1.4V9.9L7.9 4.5l-.6-.6 1.1-1.1.6.6zM4 10.4v2h2l5.1-5.1-2-2z" fill="currentColor"/></svg></button>' : ''}
        </div>
        ${own.length ? `<div class="bl-cp-sws" aria-label="이 글꾸 색">${swatchButtons(own)}</div>` : ''}
        ${recent.length ? `<div class="bl-cp-sws bl-cp-recent" aria-label="최근 색">${swatchButtons(recent)}</div>` : ''}
        <button type="button" class="bl-cp-done" data-act="done">다 골랐어요</button>
    </div>`;
    const box = layer.firstElementChild, board = box.querySelector('.bl-cp-board'), bar = box.querySelector('.bl-cp-value'), input = box.querySelector('.bl-cp-hex');
    drag(board, (x, y) => {
        const dx = x * 2 - 1, dy = y * 2 - 1, st = session.state;
        st.s = clamp(Math.hypot(dx, dy), 0, 1);
        if (st.s > .001) st.h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    }, false);
    drag(bar, (x) => { session.state.v = x; });
    keys(board, (dx, dy) => { const st = session.state; st.h = (st.h + dx * 360 + 360) % 360; st.s = clamp(st.s - dy, 0, 1); });
    keys(bar, (dx, dy) => { const st = session.state; st.v = clamp(st.v + (dx || -dy), 0, 1); });
    input.addEventListener('input', () => {
        const p = parseHex(input.value);
        if (!p) { input.setAttribute('aria-invalid', 'true'); return; }
        setFrom(p); render(session.state); emit(true);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closeColorPick(); } });
    input.addEventListener('blur', () => { if (session) render(session.state); });
    // 바깥을 누르면 닫혀요 · 층 안 누름은 밑의 창(상세 · 시식 · 크게 보기)으로 올려 보내지 않아요 — 밑 창이 바깥 누름으로 닫히지 않게
    layer.addEventListener('pointerdown', (e) => { if (e.target === layer) { e.preventDefault(); closeColorPick(); } });
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) layer.addEventListener(type, e => e.stopPropagation());
    layer.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sw = e.target.closest('[data-sw]');
        if (sw) { setFrom(parseHex(sw.dataset.sw)); render(session.state); emit(true); return; }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'revert') { setFrom(parseHex(original)); render(session.state); emit(true); }
        else if (act === 'done') closeColorPick();
        else if (act === 'drop') {
            try { const res = await new window.EyeDropper().open(); if (!session) return; const p = parseHex(res.sRGBHex); if (p) { setFrom(p); render(session.state); emit(true); } } catch { /* 취소 */ }
        }
    });
    const escKey = (e) => { if (e.key === 'Escape' && layer) { e.preventDefault(); e.stopImmediatePropagation(); closeColorPick(); } };
    const escCancel = (e) => { if (layer) e.preventDefault(); };
    document.addEventListener('keydown', escKey, true);
    const dialog = host.matches?.('dialog') ? host : null;
    dialog?.addEventListener('cancel', escCancel);
    session.stopEsc = () => { document.removeEventListener('keydown', escKey, true); dialog?.removeEventListener('cancel', escCancel); };
    host.append(layer);
    // 창(dialog) 안이나 transform 걸린 조상 밑에서는 fixed 기준이 화면이 아닐 수 있어요 → 층을 화면 원점으로
    const origin = layer.getBoundingClientRect();
    if (Math.abs(origin.left) > 0.5 || Math.abs(origin.top) > 0.5) { layer.style.left = `${-origin.left}px`; layer.style.top = `${-origin.top}px`; }
    render(session.state);
    place(box, anchor);
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches && !(navigator.maxTouchPoints > 0);
    (mouse ? board : box).focus?.({ preventScroll: true });
}
