// 색 고르기 팝업 (3.5.0) — 실리태번의 toolcool 색 칸 · <input type="color"> 를 누르면 뜨는 테마 색 고르기.
// 사용자: "모바일 색깔 선택화면 안 보임 · PC 도 좀 더 괜찮은 색 고르는 거 없어?" — toolcool 팝업은 칸 옆에 고정 위치로 떠서
// 폰에서 화면 밖으로 잘렸다. 이것은 칸 밑(모자라면 위)에 보이는 화면 안으로 띄우고, 판 · 색상 · 투명도 막대 · 코드 칸 ·
// 지금 테마 색 · 최근 색을 한 장에. 만지는 동안 바로 칠하고(짧게 솎아서), 닫을 때 한 번 더 확정.
// 문서 갈고리는 colorpop.js (늘 로드), 이 파일은 처음 누를 때 불러온다.
import { getSettings } from './settings.js';
import { paletteColors, parseColor } from './palettes.js';

const RECENT_KEY = 'bl-color-recent';
const RECENT_MAX = 8;
const SWATCH_TOKENS = ['accent', 'dialogue', 'em', 'strong', 'marker', 'gold', 'text', 'muted', 'raised', 'bg'];
const GRACE = 700;

let layer = null;
let session = null;
let closedAt = 0;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hex2 = v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');

function hsvToRgb(h, s, v) {
    const f = (n) => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };
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

const hexOf = ([r, g, b]) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();
const cssOf = ([r, g, b, a]) => a >= 1 ? hexOf([r, g, b]) : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(a.toFixed(3))})`;

/** '#RGB' · '#RRGGBB' · '#RRGGBBAA' (# 없어도) → [r, g, b, a] | null */
function parseHex(text) {
    const m = String(text).trim().replace(/^#/, '').match(/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = [...h].map(c => c + c).join('');
    const n = [0, 2, 4, 6].map(i => parseInt(h.slice(i, i + 2), 16));
    return [n[0], n[1], n[2], h.length === 8 ? n[3] / 255 : 1];
}

function readRecent() {
    try {
        const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        return Array.isArray(list) ? list.filter(c => typeof c === 'string').slice(0, RECENT_MAX) : [];
    } catch { return []; }
}

function pushRecent(color) {
    try {
        const list = [color, ...readRecent().filter(c => c.toLowerCase() !== color.toLowerCase())].slice(0, RECENT_MAX);
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch { /* 저장 못 해도 고르기는 됨 */ }
}

function viewport() {
    const vv = window.visualViewport;
    if (vv && vv.height > 0) return { x: vv.offsetLeft, y: vv.offsetTop, w: vv.width, h: vv.height };
    return { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
}

function swatchList() {
    let pal = {};
    try { pal = paletteColors(getSettings()); } catch { /* 설정 전 */ }
    const seen = new Set();
    const theme = [];
    for (const key of SWATCH_TOKENS) {
        const value = pal[key];
        if (!value) continue;
        const [r, g, b, a] = parseColor(value);
        if (a < 0.05) continue;
        const css = cssOf([r, g, b, a]);
        if (seen.has(css.toLowerCase())) continue;
        seen.add(css.toLowerCase());
        theme.push(css);
    }
    return { theme, recent: readRecent() };
}

const swatchButtons = (list, kind) => list.map(c => `<button type="button" class="bl-cp-sw" data-sw="${c}" data-kind="${kind}" style="--c:${c}" aria-label="${c}"></button>`).join('');

function place(box, anchor) {
    const r = anchor.getBoundingClientRect();
    const v = viewport();
    const edge = 8, gap = 8;
    const phone = v.w < 600;
    const width = Math.min(phone ? 360 : 272, v.w - edge * 2);
    box.style.width = `${width}px`;
    // 칸이 화면 오른쪽 반에 있으면 칸의 오른쪽 끝에(설정 줄의 색 칸), 왼쪽 반이면 왼쪽 끝에(실리태번 테마 색상 줄) — 화면 안으로
    const edgeAt = r.left + r.width / 2 > v.x + v.w / 2 ? r.right - width : r.left;
    const left = phone ? v.x + (v.w - width) / 2 : clamp(edgeAt, v.x + edge, v.x + v.w - width - edge);
    box.style.left = `${left}px`;
    box.style.top = '0px';
    const h = box.offsetHeight;
    const below = v.y + v.h - r.bottom - gap - edge;
    const above = r.top - v.y - gap - edge;
    const up = below < h && above > below;
    let top = up ? r.top - gap - h : r.bottom + gap;
    top = clamp(top, v.y + edge, Math.max(v.y + edge, v.y + v.h - edge - h));
    box.style.top = `${top}px`;
    box.classList.toggle('up', up);
}

function render(state) {
    const { h, s, v, a } = state;
    const [r, g, b] = hsvToRgb(h, s, v);
    const box = layer.firstElementChild;
    box.style.setProperty('--hue', `hsl(${h} 100% 50%)`);
    box.style.setProperty('--rgb', `${Math.round(r)} ${Math.round(g)} ${Math.round(b)}`);
    box.style.setProperty('--now', cssOf([r, g, b, a]));
    const board = box.querySelector('.bl-cp-board');
    board.style.setProperty('--x', `${s * 100}%`);
    board.style.setProperty('--y', `${(1 - v) * 100}%`);
    box.querySelector('.bl-cp-hue').style.setProperty('--x', `${(h / 360) * 100}%`);
    box.querySelector('.bl-cp-alpha')?.style.setProperty('--x', `${a * 100}%`);
    const input = box.querySelector('.bl-cp-hex');
    if (document.activeElement !== input) input.value = state.alpha && a < 1 ? `${hexOf([r, g, b])}${hex2(a * 255).toUpperCase()}` : hexOf([r, g, b]);
    input.removeAttribute('aria-invalid');
}

function current(state) {
    const [r, g, b] = hsvToRgb(state.h, state.s, state.v);
    return [r, g, b, state.alpha ? state.a : 1];
}

// 바로 칠하기: 끌 때는 짧게 솎는다 (색 하나 바꿀 때마다 테마 전체를 다시 칠하므로 폰에서는 더 드물게)
function emit(final = false) {
    if (!session) return;
    const value = cssOf(current(session.state));
    session.dirty = true;
    const now = performance.now();
    clearTimeout(session.timer);
    if (final || now - session.lastEmit >= session.every) {
        session.lastEmit = now;
        if (value !== session.lastValue) { session.lastValue = value; session.onInput(value); }
        return;
    }
    session.timer = setTimeout(() => emit(true), session.every - (now - session.lastEmit));
}

function setFrom(rgba, { keepHue = true } = {}) {
    const st = session.state;
    const [h, s, v] = rgbToHsv(rgba[0], rgba[1], rgba[2], keepHue ? st.h : 0);
    st.h = s === 0 || v === 0 ? st.h : h;
    st.s = v === 0 ? st.s : s;
    st.v = v;
    if (st.alpha) st.a = clamp(rgba[3], 0, 1);
}

function drag(el, onMove) {
    el.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch { /* 합성 누름 */ }
        const move = (ev) => {
            const rect = el.getBoundingClientRect();
            onMove(clamp((ev.clientX - rect.left) / rect.width, 0, 1), clamp((ev.clientY - rect.top) / rect.height, 0, 1));
            render(session.state);
            emit();
        };
        move(e);
        const up = () => {
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', up);
            emit(true);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
    });
}

function keys(el, onKey) {
    el.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 0.1 : 0.01;
        const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (!d) return;
        e.preventDefault();
        onKey(d[0], d[1]);
        render(session.state);
        emit(true);
    });
}

export function isColorPickOpen() {
    return !!layer;
}

export function colorPickAge() {
    return session ? Date.now() - session.openedAt : Infinity;
}

export function colorPickPhantom(target) {
    return (layer && session && Date.now() - session.openedAt < GRACE && !layer.contains(target)) || (!layer && Date.now() - closedAt < 400);
}

export function closeColorPick() {
    if (!layer) return;
    const s = session;
    clearTimeout(s?.timer);
    layer.remove();
    layer = null;
    session = null;
    closedAt = Date.now();
    window.removeEventListener('resize', onResize);
    window.visualViewport?.removeEventListener('resize', onResize);
    if (!s) return;
    const value = cssOf(current(s.state));
    if (s.dirty && value !== s.lastValue) s.onInput(value);
    if (s.dirty && value !== s.original) pushRecent(value);
    s.onClose?.(s.dirty && value !== s.original);
}

function onResize() {
    if (!layer || !session) return;
    if (!session.anchor.isConnected) { closeColorPick(); return; }
    place(layer.firstElementChild, session.anchor);
}

/**
 * @param {{ anchor: Element, value: string, alpha?: boolean, onInput: (css: string) => void, onClose?: (changed: boolean) => void }} opts
 */
export function openColorPick({ anchor, value, alpha = false, onInput, onClose }) {
    closeColorPick();
    const rgba = parseColor(value);
    const [h, s, v] = rgbToHsv(rgba[0], rgba[1], rgba[2]);
    const original = cssOf([rgba[0], rgba[1], rgba[2], alpha ? rgba[3] : 1]);
    const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    session = {
        anchor, onInput, onClose, original, dirty: false, lastValue: original, lastEmit: 0, timer: 0,
        every: touch ? 90 : 50, openedAt: Date.now(),
        state: { h, s, v, a: alpha ? rgba[3] : 1, alpha },
    };
    const { theme, recent } = swatchList();
    const host = anchor.closest('dialog[open]') || document.body;
    layer = document.createElement('div');
    layer.className = 'bl-cp-layer';
    layer.style.cssText = 'top:0;left:0;width:100vw;height:100vh;height:100lvh';
    layer.innerHTML = `<div class="bl-cp" role="dialog" aria-label="색 고르기">
        <div class="bl-cp-board" tabindex="0" role="slider" aria-label="채도 · 밝기"><i></i></div>
        <div class="bl-cp-mid">
            <button type="button" class="bl-cp-cmp" data-act="revert" aria-label="처음 색으로" style="--was:${original}"><i></i><b></b></button>
            <div class="bl-cp-bars">
                <div class="bl-cp-hue" tabindex="0" role="slider" aria-label="색상"><i></i></div>
                ${alpha ? '<div class="bl-cp-alpha" tabindex="0" role="slider" aria-label="투명도"><i></i></div>' : ''}
            </div>
        </div>
        <div class="bl-cp-code">
            <input type="text" class="bl-cp-hex" maxlength="9" spellcheck="false" autocomplete="off" aria-label="색 코드">
            ${'EyeDropper' in window ? '<button type="button" class="bl-cp-drop" data-act="drop" aria-label="화면에서 색 따기"><i class="fa-solid fa-eye-dropper" aria-hidden="true"></i></button>' : ''}
        </div>
        <div class="bl-cp-sws">${swatchButtons(theme, 'theme')}</div>
        ${recent.length ? `<div class="bl-cp-sws bl-cp-recent">${swatchButtons(recent, 'recent')}</div>` : ''}
    </div>`;
    const box = layer.firstElementChild;
    const board = box.querySelector('.bl-cp-board');
    const hue = box.querySelector('.bl-cp-hue');
    const alphaBar = box.querySelector('.bl-cp-alpha');
    const input = box.querySelector('.bl-cp-hex');

    drag(board, (x, y) => { session.state.s = x; session.state.v = 1 - y; });
    drag(hue, (x) => { session.state.h = x * 360; });
    keys(board, (dx, dy) => { const st = session.state; st.s = clamp(st.s + dx, 0, 1); st.v = clamp(st.v - dy, 0, 1); });
    keys(hue, (dx, dy) => { const st = session.state; st.h = clamp(st.h + (dx || -dy) * 360, 0, 360); });
    if (alphaBar) {
        drag(alphaBar, (x) => { session.state.a = Math.round(x * 100) / 100; });
        keys(alphaBar, (dx, dy) => { const st = session.state; st.a = clamp(Math.round((st.a + (dx || -dy)) * 100) / 100, 0, 1); });
    }
    input.addEventListener('input', () => {
        const parsed = parseHex(input.value);
        if (!parsed) { input.setAttribute('aria-invalid', 'true'); return; }
        input.removeAttribute('aria-invalid');
        if (!alpha) parsed[3] = 1;
        setFrom(parsed);
        render(session.state);
        emit(true);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); closeColorPick(); }
    });
    input.addEventListener('blur', () => { if (session) render(session.state); });

    // 바깥을 누르면 닫힘. 층 안의 누름은 문서로 올려 보내지 않음 — 실리태번이 html touchstart · mousedown 에서 서랍을 닫는다
    layer.addEventListener('pointerdown', (e) => { if (e.target === layer) { e.preventDefault(); closeColorPick(); } });
    for (const type of ['touchstart', 'touchend', 'mousedown', 'mouseup', 'pointerdown', 'pointerup']) {
        layer.addEventListener(type, (e) => e.stopPropagation());
    }
    layer.addEventListener('click', async (e) => {
        e.stopPropagation();
        const sw = e.target.closest('[data-sw]');
        if (sw) {
            const parsed = parseColor(sw.dataset.sw);
            if (!alpha) parsed[3] = 1;
            setFrom(parsed);
            render(session.state);
            emit(true);
            return;
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'revert') {
            setFrom(parseColor(original));
            render(session.state);
            emit(true);
        } else if (act === 'drop') {
            try {
                const res = await new window.EyeDropper().open();
                if (!session) return;
                const parsed = parseHex(res.sRGBHex) || parseColor(res.sRGBHex);
                parsed[3] = session.state.alpha ? session.state.a : 1;
                setFrom(parsed);
                render(session.state);
                emit(true);
            } catch { /* 취소 */ }
        }
    });
    layer.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeColorPick(); }
    });

    host.append(layer);
    // 실리태번 팝업(dialog) 안이나 transform 걸린 조상 밑에서는 fixed 기준이 화면이 아닐 수 있음 → 층을 화면 원점으로 되돌림
    const origin = layer.getBoundingClientRect();
    if (Math.abs(origin.left) > 0.5 || Math.abs(origin.top) > 0.5) {
        layer.style.left = `${-origin.left}px`;
        layer.style.top = `${-origin.top}px`;
    }
    render(session.state);
    place(box, anchor);
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches && !(navigator.maxTouchPoints > 0);
    (mouse ? board : box).focus?.({ preventScroll: true });
}
