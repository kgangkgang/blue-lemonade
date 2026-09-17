// 색 고르기 팝업 (3.5.0) — 실리태번의 toolcool 색 칸 · <input type="color"> 를 누르면 뜨는 테마 색 고르기.
// 사용자: "모바일 색깔 선택화면 안 보임 · PC 도 좀 더 괜찮은 색 고르는 거 없어?" — toolcool 팝업은 칸 옆에 고정 위치로 떠서
// 폰에서 화면 밖으로 잘렸다. 이것은 칸 밑(모자라면 위)에 보이는 화면 안으로 띄우고, 판 · 색상 · 투명도 막대 · 코드 칸 ·
// 지금 테마 색 · 최근 색을 한 장에. 만지는 동안 바로 칠하고(짧게 솎아서), 닫을 때 한 번 더 확정.
// 문서 갈고리는 colorpop.js (늘 로드), 이 파일은 처음 누를 때 불러온다.
import { getSettings } from './settings.js';
import { paletteColors, parseColor } from './palettes.js';
import { decodeAnyImage, imageWidth, imageHeight, IMAGE_ACCEPT } from './imagedecode.js';

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

// ───────── 이미지에서 색 따기 (3.5.1) ─────────
// 사용자: "갤러리에서 이미지 가져와서 스포이드로 콕 찍어 색만 빼오는 거". 고른 이미지는 긴 변 1024px 캔버스로 줄여
// 이 페이지에서만 기억한다 (저장 안 함 — 다른 색 칸을 열어도 그대로, 새로 고치면 사라짐). 누른 자리 3×3 평균 색,
// 손가락에 가리지 않게 위에 확대경. 이미지의 대표 색 8개는 따로 한 줄.
const PIC_MAX = 1024;
let picture = null;    // { canvas, ctx, colors }
let pictureView = false; // 마지막에 이미지 화면이었나 (다음에 열 때도 이미지로)

function dominantColors(source, max = 8) {
    const k = Math.min(1, 64 / Math.max(source.width, source.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(source.width * k));
    c.height = Math.max(1, Math.round(source.height * k));
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(source, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const buckets = new Map();
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 128) continue;
        const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = [0, 0, 0, 0]));
        b[0] += d[i]; b[1] += d[i + 1]; b[2] += d[i + 2]; b[3]++;
    }
    // 많이 쓰인 색부터, 채도가 있는 색은 조금 더 쳐줌 (배경 회색만 잔뜩 나오지 않게), 서로 비슷한 색은 건너뜀
    const list = [...buckets.values()].map(([r, g, b, n]) => {
        const rgb = [r / n, g / n, b / n];
        const hi = Math.max(...rgb), lo = Math.min(...rgb);
        return { rgb, score: n * (1 + 1.5 * (hi ? (hi - lo) / hi : 0)) };
    }).sort((a, b) => b.score - a.score);
    const out = [];
    for (const { rgb } of list) {
        if (out.every(o => (o[0] - rgb[0]) ** 2 + (o[1] - rgb[1]) ** 2 + (o[2] - rgb[2]) ** 2 > 42 * 42)) out.push(rgb);
        if (out.length >= max) break;
    }
    return out.map(hexOf);
}

/** 변환기를 받아야 하는 형식일 때 한 줄 알림 (처음엔 몇 초 · 이후 캐시) */
export function slowNotice(kind) {
    window.toastr?.info?.(kind === 'heic' ? 'HEIC 사진을 바꾸는 중…' : '이 형식은 변환기로 여는 중… (처음 한 번만 약 15MB 받아요)', '', { timeOut: 3000 });
}

async function loadPicture(file, onSlow) {
    const bitmap = await decodeAnyImage(file, { onSlow });
    const w0 = imageWidth(bitmap), h0 = imageHeight(bitmap);
    if (!w0 || !h0) throw new Error('empty');
    const k = Math.min(1, PIC_MAX / Math.max(w0, h0));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w0 * k));
    canvas.height = Math.max(1, Math.round(h0 * k));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return { canvas, ctx, colors: dominantColors(canvas) };
}

/** 이미지 화면 그리기 (고른 직후 · 이미지가 있는 채로 열 때) */
function showPicture(box) {
    if (!picture) return;
    const wrap = box.querySelector('.bl-cp-pic');
    const view = wrap.querySelector('.bl-cp-pic-canvas');
    if (view._src !== picture.canvas) {
        view.width = picture.canvas.width;
        view.height = picture.canvas.height;
        view.getContext('2d').drawImage(picture.canvas, 0, 0);
        view._src = picture.canvas;
        wrap.classList.remove('has-point');
    }
    box.classList.add('pic-on', 'has-pic');
    pictureView = true;
    const width = wrap.clientWidth || box.clientWidth - 20;
    const maxH = window.innerWidth < 600 ? 230 : 200;
    const k = Math.min(width / view.width, maxH / view.height);
    view.style.width = `${Math.max(1, Math.round(view.width * k))}px`;
    view.style.height = `${Math.max(1, Math.round(view.height * k))}px`;
    box.querySelector('.bl-cp-imgsws').innerHTML = swatchButtons(picture.colors, 'image');
}

function hidePicture(box) {
    box.classList.remove('pic-on');
    pictureView = false;
}

/** 이미지 위 한 점: 3×3 평균 색 + 고리 · 확대경 자리 */
function pickFromPicture(box, ev) {
    const wrap = box.querySelector('.bl-cp-pic');
    const view = wrap.querySelector('.bl-cp-pic-canvas');
    const rect = view.getBoundingClientRect();
    if (!picture || !rect.width || !rect.height) return;
    const fx = clamp((ev.clientX - rect.left) / rect.width, 0, 0.9999);
    const fy = clamp((ev.clientY - rect.top) / rect.height, 0, 0.9999);
    const { canvas, ctx } = picture;
    const px = Math.floor(fx * canvas.width), py = Math.floor(fy * canvas.height);
    const x0 = clamp(px - 1, 0, Math.max(0, canvas.width - 3)), y0 = clamp(py - 1, 0, Math.max(0, canvas.height - 3));
    const d = ctx.getImageData(x0, y0, Math.min(3, canvas.width), Math.min(3, canvas.height)).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 16) continue;
        r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    const wr = wrap.getBoundingClientRect();
    const x = rect.left - wr.left + fx * rect.width, y = rect.top - wr.top + fy * rect.height;
    wrap.style.setProperty('--px', `${x}px`);
    wrap.style.setProperty('--py', `${y}px`);
    wrap.classList.add('has-point');
    wrap.classList.toggle('loupe-down', ev.clientY < 110);
    const loupe = wrap.querySelector('.bl-cp-loupe');
    const lx = loupe.getContext('2d');
    lx.imageSmoothingEnabled = false;
    lx.clearRect(0, 0, loupe.width, loupe.height);
    lx.drawImage(canvas, px - 4, py - 4, 9, 9, 0, 0, loupe.width, loupe.height);
    const cell = loupe.width / 9;
    lx.strokeStyle = '#fff';
    lx.lineWidth = 2;
    lx.strokeRect(cell * 4, cell * 4, cell, cell);
    if (!n) return; // 투명한 곳
    setFrom([r / n, g / n, b / n, session.state.a]);
    render(session.state);
    emit();
}

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
        <div class="bl-cp-pic">
            <canvas class="bl-cp-pic-canvas" aria-label="이미지에서 색 따기"></canvas>
            <i class="bl-cp-pic-ring"></i>
            <canvas class="bl-cp-loupe" width="72" height="72"></canvas>
            <div class="bl-cp-pic-tools">
                <button type="button" data-act="pic-change" aria-label="다른 이미지"><i class="fa-solid fa-images" aria-hidden="true"></i></button>
                <button type="button" data-act="pic-close" aria-label="색 판으로"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </div>
        </div>
        <input type="file" class="bl-cp-file" accept="${IMAGE_ACCEPT}">
        <div class="bl-cp-mid">
            <button type="button" class="bl-cp-cmp" data-act="revert" aria-label="처음 색으로" style="--was:${original}"><i></i><b></b></button>
            <div class="bl-cp-bars">
                <div class="bl-cp-hue" tabindex="0" role="slider" aria-label="색상"><i></i></div>
                ${alpha ? '<div class="bl-cp-alpha" tabindex="0" role="slider" aria-label="투명도"><i></i></div>' : ''}
            </div>
        </div>
        <div class="bl-cp-code">
            <input type="text" class="bl-cp-hex" maxlength="9" spellcheck="false" autocomplete="off" aria-label="색 코드">
            <button type="button" class="bl-cp-drop" data-act="pic" aria-label="이미지에서 색 따기"><i class="fa-solid fa-image" aria-hidden="true"></i></button>
            ${'EyeDropper' in window ? '<button type="button" class="bl-cp-drop" data-act="drop" aria-label="화면에서 색 따기"><i class="fa-solid fa-eye-dropper" aria-hidden="true"></i></button>' : ''}
        </div>
        <div class="bl-cp-sws bl-cp-imgsws"></div>
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

    // 이미지: 누르고 끄는 동안 확대경, 뗄 때 확정
    const picCanvas = box.querySelector('.bl-cp-pic-canvas');
    const picWrap = box.querySelector('.bl-cp-pic');
    const fileInput = box.querySelector('.bl-cp-file');
    picCanvas.addEventListener('pointerdown', (e) => {
        if (e.button > 0 || !picture) return;
        e.preventDefault();
        try { picCanvas.setPointerCapture(e.pointerId); } catch { /* 합성 누름 */ }
        picWrap.classList.add('picking');
        const move = ev => pickFromPicture(box, ev);
        move(e);
        const up = () => {
            picCanvas.removeEventListener('pointermove', move);
            picCanvas.removeEventListener('pointerup', up);
            picCanvas.removeEventListener('pointercancel', up);
            picWrap.classList.remove('picking');
            emit(true);
        };
        picCanvas.addEventListener('pointermove', move);
        picCanvas.addEventListener('pointerup', up);
        picCanvas.addEventListener('pointercancel', up);
    });
    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        fileInput.value = '';
        if (!file) return;
        box.classList.add('pic-loading');
        let heif = false; // 변환기를 받아야 했던 형식
        try {
            // HEIC 는 변환기를 받아 푸느라 몇 초 걸림 — 그동안 알림 한 줄
            picture = await loadPicture(file, (kind) => { heif = true; slowNotice(kind); });
        } catch (error) {
            console.warn('[블루 레몬에이드] 이미지를 못 읽음', error);
            window.toastr?.warning?.(heif ? '이미지를 읽지 못했어요 — 인터넷 연결을 확인해 주세요' : '이미지를 읽지 못했어요');
            return;
        } finally {
            box.classList.remove('pic-loading');
        }
        if (!session || !box.isConnected) return;
        showPicture(box);
        place(box, session.anchor);
    });

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
            // 불투명한 견본은 지금 투명도를 둔다 (형광펜처럼 반투명 칸에 이미지 색을 넣어도 덮어 칠하지 않게)
            parsed[3] = !alpha ? 1 : parsed[3] < 1 ? parsed[3] : session.state.a;
            setFrom(parsed);
            render(session.state);
            emit(true);
            return;
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        // 파일 고르기는 누른 그 순간(사용자 동작 안)에 열어야 함 — await 앞
        if (act === 'pic') {
            if (!picture) fileInput.click();
            else if (box.classList.contains('pic-on')) hidePicture(box);
            else showPicture(box);
            if (picture) place(box, session.anchor);
            return;
        }
        if (act === 'pic-change') { fileInput.click(); return; }
        if (act === 'pic-close') { hidePicture(box); place(box, session.anchor); return; }
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
    if (picture) {
        // 이미지를 고른 적이 있으면 대표 색 줄은 늘, 마지막에 이미지 화면이었으면 이미지로 연다 (여러 칸을 같은 그림에서 따기)
        box.classList.add('has-pic');
        box.querySelector('.bl-cp-imgsws').innerHTML = swatchButtons(picture.colors, 'image');
    }
    place(box, anchor); // 폭이 정해진 뒤에 이미지 크기를 잰다
    if (picture && pictureView) {
        showPicture(box);
        place(box, anchor);
    }
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    const mouse = matchMedia('(hover: hover) and (pointer: fine)').matches && !(navigator.maxTouchPoints > 0);
    (mouse ? board : box).focus?.({ preventScroll: true });
}
