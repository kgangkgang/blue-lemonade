// PNG 도구(리그 검사 · 사진 판정 공용): 읽기 · 쓰기 · 자르기 · 줄이기 · 밝기 · 잉크 상자. pngjs 는 격리 ST 사본의 것을 빌려 씀(설치 없음).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ST_COPY } from './common.mjs';

const pngjs = (await import(pathToFileURL(path.join(ST_COPY, 'node_modules/pngjs/lib/png.js')).href)).default;
export const PNG = pngjs.PNG;
export const read = file => PNG.sync.read(fs.readFileSync(file));
export const write = (file, png) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, PNG.sync.write(png)); return file; };
export function blank(width, height, rgb = [255, 255, 255]) {
    const p = new PNG({ width, height });
    for (let i = 0; i < width * height; i++) { p.data[i * 4] = rgb[0]; p.data[i * 4 + 1] = rgb[1]; p.data[i * 4 + 2] = rgb[2]; p.data[i * 4 + 3] = 255; }
    return p;
}
export const lum = (png, x, y) => { const i = (y * png.width + x) * 4; return 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2]; };
export const rgbAt = (png, x, y) => { const i = (y * png.width + x) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** 픽셀 좌표로 자르기(k 배 확대, 최근접) */
export function crop(png, x0, y0, w, h, k = 1) {
    x0 = clamp(Math.round(x0), 0, png.width - 1); y0 = clamp(Math.round(y0), 0, png.height - 1);
    w = clamp(Math.round(w), 1, png.width - x0); h = clamp(Math.round(h), 1, png.height - y0);
    const o = new PNG({ width: w * k, height: h * k });
    for (let y = 0; y < h * k; y++) for (let x = 0; x < w * k; x++) {
        const si = ((y0 + Math.floor(y / k)) * png.width + (x0 + Math.floor(x / k))) * 4, di = (y * w * k + x) * 4;
        o.data[di] = png.data[si]; o.data[di + 1] = png.data[si + 1]; o.data[di + 2] = png.data[si + 2]; o.data[di + 3] = 255;
    }
    return o;
}
/** 상자 평균으로 줄이기(f < 1) */
export function scale(png, f) {
    const w = Math.max(1, Math.round(png.width * f)), h = Math.max(1, Math.round(png.height * f));
    const o = new PNG({ width: w, height: h }); const sx = png.width / w, sy = png.height / h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, n = 0;
        for (let yy = Math.floor(y * sy); yy < Math.min(png.height, Math.floor((y + 1) * sy) || 1); yy++) for (let xx = Math.floor(x * sx); xx < Math.min(png.width, Math.floor((x + 1) * sx) || 1); xx++) { const i = (yy * png.width + xx) * 4; r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++; }
        const di = (y * w + x) * 4; o.data[di] = r / (n || 1); o.data[di + 1] = g / (n || 1); o.data[di + 2] = b / (n || 1); o.data[di + 3] = 255;
    }
    return o;
}
/**
 * 상자 안 잉크(배경과 밝기 차 > thr) 범위 — 배경은 상자 안 표본의 중앙값. 픽셀 좌표.
 * 돌려줌: { top, bottom, left, right, cy, cx, bg } 또는 null(잉크 없음)
 */
export function inkBox(png, x0, y0, x1, y1, { thr = 40, step = 1 } = {}) {
    x0 = clamp(Math.round(x0), 0, png.width - 1); x1 = clamp(Math.round(x1), 0, png.width); y0 = clamp(Math.round(y0), 0, png.height - 1); y1 = clamp(Math.round(y1), 0, png.height);
    if (x1 - x0 < 2 || y1 - y0 < 2) return null;
    const v = []; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 3) v.push(lum(png, x, y));
    v.sort((a, b) => a - b); const bg = v[v.length >> 1];
    let top = -1, bottom = -1, left = 1e9, right = -1;
    for (let y = y0; y < y1; y += step) {
        let hit = false;
        for (let x = x0; x < x1; x++) if (Math.abs(lum(png, x, y) - bg) > thr) { hit = true; if (x < left) left = x; if (x > right) right = x; }
        if (hit) { if (top < 0) top = y; bottom = y; }
    }
    if (top < 0) return null;
    return { top, bottom, left, right, cy: (top + bottom) / 2, cx: (left + right) / 2, bg };
}
/** 사각형 테두리 그리기(픽셀 좌표, 제자리) */
export function rect(png, x0, y0, w, h, rgb = [255, 0, 0], t = 2) {
    const put = (x, y) => { if (x < 0 || y < 0 || x >= png.width || y >= png.height) return; const i = (y * png.width + x) * 4; png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; png.data[i + 3] = 255; };
    x0 = Math.round(x0); y0 = Math.round(y0); w = Math.round(w); h = Math.round(h);
    for (let k = 0; k < t; k++) { for (let x = x0; x <= x0 + w; x++) { put(x, y0 + k); put(x, y0 + h - k); } for (let y = y0; y <= y0 + h; y++) { put(x0 + k, y); put(x0 + w - k, y); } }
    return png;
}
export const hline = (png, x0, x1, y, rgb = [0, 200, 0]) => { for (let x = Math.round(x0); x <= Math.round(x1); x++) { if (x < 0 || x >= png.width || y < 0 || y >= png.height) continue; const i = (Math.round(y) * png.width + x) * 4; png.data[i] = rgb[0]; png.data[i + 1] = rgb[1]; png.data[i + 2] = rgb[2]; } return png; };
