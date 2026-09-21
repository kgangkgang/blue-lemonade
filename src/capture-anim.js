// 움짤을 APNG · 움직이는 WebP 로 (GIF 는 capture-gif.js).
//
// GIF 는 256색이라 그라데이션 · 형광펜이 탁해진다. APNG 는 색을 줄이지 않고(무손실), WebP 는 작은 용량으로 담는다.
// 둘 다 '앞 장과 달라진 네모'만 담는다 — 글자만 움직이는 화면이면 그 줄만 들어가 용량이 크게 준다.
//   APNG : 브라우저의 CompressionStream('deflate') 로 직접 압축해 acTL · fcTL · fdAT 을 쓴다.
//   WebP : 캔버스가 한 장씩 WebP 로 구운 것을 풀어 VP8X · ANIM · ANMF 로 다시 묶는다 (인코더를 들고 오지 않는다).
import { prepareMotion, abortError } from './capture-motion.js';

const FPS = 10;

// ───────── 공통 ─────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(parts) { let c = 0xFFFFFFFF; for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC[(c ^ p[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
const u32 = n => new Uint8Array([n >>> 24, n >>> 16 & 255, n >>> 8 & 255, n & 255]);
const u16 = n => new Uint8Array([n >>> 8 & 255, n & 255]);
const le = (n, bytes) => { const out = new Uint8Array(bytes); for (let i = 0; i < bytes; i++) out[i] = (n >>> (8 * i)) & 255; return out; };
const ascii = text => Uint8Array.from(text, c => c.charCodeAt(0));

/** 앞 장과 달라진 네모 (없으면 null). even = 왼쪽 · 위를 짝수로 (WebP 규격) */
export function changedBox(prev, next, width, height, even = false) {
    if (!prev) return { x: 0, y: 0, w: width, h: height };
    const a = new Uint32Array(prev.buffer, prev.byteOffset, width * height), b = new Uint32Array(next.buffer, next.byteOffset, width * height);
    let top = -1, bottom = -1, left = width, right = -1;
    for (let y = 0; y < height; y++) {
        const row = y * width; let first = -1, last = -1;
        for (let x = 0; x < width; x++) if (a[row + x] !== b[row + x]) { if (first < 0) first = x; last = x; }
        if (first < 0) continue;
        if (top < 0) top = y; bottom = y;
        if (first < left) left = first; if (last > right) right = last;
    }
    if (top < 0) return null;
    if (even) { left -= left % 2; top -= top % 2; }
    return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}
function cropRgba(rgba, width, box) {
    if (box.x === 0 && box.w === width) return rgba.subarray(box.y * width * 4, (box.y + box.h) * width * 4);
    const out = new Uint8Array(box.w * box.h * 4);
    for (let y = 0; y < box.h; y++) out.set(rgba.subarray(((box.y + y) * width + box.x) * 4, ((box.y + y) * width + box.x + box.w) * 4), y * box.w * 4);
    return out;
}

// ───────── APNG ─────────
async function deflate(bytes) {
    if (typeof CompressionStream !== 'function') throw Error('이 브라우저는 APNG 저장을 지원하지 않아요. GIF 나 영상을 사용해 주세요.');
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}
/** 줄마다 None · Sub · Up 가운데 값이 가장 잔잔한 거르개를 고른다 (글자 화면은 Up · Sub 가 잘 먹는다) */
function filterRows(rgba, w, h) {
    const stride = w * 4, out = new Uint8Array((stride + 1) * h), sub = new Uint8Array(stride), up = new Uint8Array(stride);
    for (let y = 0; y < h; y++) {
        const row = rgba.subarray(y * stride, (y + 1) * stride), above = y ? rgba.subarray((y - 1) * stride, y * stride) : null;
        let sNone = 0, sSub = 0, sUp = 0;
        for (let i = 0; i < stride; i++) {
            const v = row[i], s = (v - (i >= 4 ? row[i - 4] : 0)) & 255, u = (v - (above ? above[i] : 0)) & 255;
            sub[i] = s; up[i] = u;
            sNone += v < 128 ? v : 256 - v; sSub += s < 128 ? s : 256 - s; sUp += u < 128 ? u : 256 - u;
        }
        const at = y * (stride + 1);
        if (sUp <= sSub && sUp <= sNone) { out[at] = 2; out.set(up, at + 1); } else if (sSub <= sNone) { out[at] = 1; out.set(sub, at + 1); } else { out[at] = 0; out.set(row, at + 1); }
    }
    return out;
}
function pngChunk(type, ...data) { const name = ascii(type), length = data.reduce((n, d) => n + d.length, 0); return [u32(length), name, ...data, u32(crc32([name, ...data]))]; }
function createApng(width, height) {
    const frames = []; let prev = null;
    return {
        async add(rgba, delayMs) {
            const box = changedBox(prev, rgba, width, height);
            if (!box) { if (frames.length) frames.at(-1).delay += delayMs; return; } // 똑같은 장은 앞 장을 더 오래
            frames.push({ box, delay: delayMs, data: await deflate(filterRows(cropRgba(rgba, width, box), box.w, box.h)) });
            prev = rgba.slice();
        },
        finish() {
            const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...pngChunk('IHDR', u32(width), u32(height), new Uint8Array([8, 6, 0, 0, 0])), ...pngChunk('acTL', u32(frames.length), u32(0))];
            let sequence = 0;
            frames.forEach((frame, i) => {
                // dispose 0(그대로 둠) · blend 0(덮어씀): 달라진 네모만 새 픽셀로 바꾼다
                parts.push(...pngChunk('fcTL', u32(sequence++), u32(frame.box.w), u32(frame.box.h), u32(frame.box.x), u32(frame.box.y), u16(Math.round(frame.delay)), u16(1000), new Uint8Array([0, 0])));
                parts.push(...(i === 0 ? pngChunk('IDAT', frame.data) : pngChunk('fdAT', u32(sequence++), frame.data)));
            });
            parts.push(...pngChunk('IEND'));
            return new Blob(parts, { type: 'image/apng' });
        },
    };
}

// ───────── 움직이는 WebP ─────────
function riffChunk(type, ...data) { const length = data.reduce((n, d) => n + d.length, 0); return [ascii(type), le(length, 4), ...data, ...(length % 2 ? [new Uint8Array(1)] : [])]; }
/** 캔버스가 구운 WebP 한 장에서 그림 데이터 덩어리(ALPH · VP8 · VP8L)만 꺼낸다 */
function webpPayload(bytes) {
    if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' || String.fromCharCode(...bytes.subarray(8, 12)) !== 'WEBP') throw Error('이 브라우저는 WebP 저장을 지원하지 않아요. GIF 나 APNG 를 사용해 주세요.');
    const keep = [];
    for (let at = 12; at + 8 <= bytes.length;) {
        const type = String.fromCharCode(...bytes.subarray(at, at + 4)), size = bytes[at + 4] | bytes[at + 5] << 8 | bytes[at + 6] << 16 | bytes[at + 7] << 24, end = at + 8 + size + (size % 2);
        if (['ALPH', 'VP8 ', 'VP8L'].includes(type)) keep.push(bytes.subarray(at, Math.min(end, bytes.length)));
        at = end;
    }
    if (!keep.length) throw Error('WebP 그림을 만들지 못했어요.');
    return keep;
}
function createWebp(width, height, quality) {
    const frames = []; let prev = null;
    const sheet = document.createElement('canvas'), ctx = sheet.getContext('2d');
    return {
        async add(rgba, delayMs) {
            const box = changedBox(prev, rgba, width, height, true);
            if (!box) { if (frames.length) frames.at(-1).delay += delayMs; return; }
            sheet.width = box.w; sheet.height = box.h;
            ctx.putImageData(new ImageData(new Uint8ClampedArray(cropRgba(rgba, width, box)), box.w, box.h), 0, 0);
            const blob = await new Promise(resolve => sheet.toBlob(resolve, 'image/webp', quality));
            if (!blob || blob.type !== 'image/webp') throw Error('이 브라우저는 WebP 저장을 지원하지 않아요. GIF 나 APNG 를 사용해 주세요.');
            frames.push({ box, delay: delayMs, payload: webpPayload(new Uint8Array(await blob.arrayBuffer())) });
            prev = rgba.slice();
        },
        finish() {
            sheet.width = sheet.height = 1;
            const body = [ascii('WEBP'), ...riffChunk('VP8X', new Uint8Array([0x02, 0, 0, 0]), le(width - 1, 3), le(height - 1, 3)), ...riffChunk('ANIM', le(0, 4), le(0, 2))]; // 0x02 = 움직임, 바탕 투명, 무한 반복
            for (const frame of frames) {
                // 0x02 = 섞지 않고 덮어씀, 지우지 않음
                body.push(...riffChunk('ANMF', le(frame.box.x / 2, 3), le(frame.box.y / 2, 3), le(frame.box.w - 1, 3), le(frame.box.h - 1, 3), le(Math.round(frame.delay), 3), new Uint8Array([0x02]), ...frame.payload));
            }
            const size = body.reduce((n, d) => n + d.length, 0);
            return new Blob([ascii('RIFF'), le(size, 4), ...body], { type: 'image/webp' });
        },
    };
}

/** capture-options.js 가 부른다. options.format = 'apng' | 'webp' */
export async function captureAnimated(ids, progress = () => {}, options = {}, signal) {
    const kind = options.format === 'webp' ? 'webp' : 'apng';
    const motion = await prepareMotion(ids, progress, { ...options, format: 'gif' }, signal); // 크기 · 길이는 움짤과 같은 규칙 (720px · 10fps)
    const hidden = () => { if (document.hidden) failure = Error('저장 중에는 이 탭을 열어 두세요.'); };
    let failure = null;
    document.addEventListener('visibilitychange', hidden);
    try {
        const { width, height, duration } = motion.layout, frames = Math.ceil(duration * FPS);
        const encoder = kind === 'webp' ? createWebp(width, height, 0.9) : createApng(width, height);
        const start = performance.now();
        for (let i = 0; i < frames; i++) {
            if (signal?.aborted) throw abortError();
            if (failure) throw failure;
            const wait = start + i * 1000 / FPS - performance.now(); if (wait > 0) await new Promise(r => setTimeout(r, wait)); // 배경 영상은 실제 시간으로 흐른다
            motion.draw(i ? 1 / FPS : 0, i * 1000 / FPS, i / FPS);
            await encoder.add(new Uint8Array(motion.ctx.getImageData(0, 0, width, height).data.buffer), 1000 / FPS);
            progress(`${kind === 'webp' ? 'WebP' : 'APNG'} 만드는 중… ${i + 1} / ${frames}장`);
        }
        return { ...motion.result, blob: encoder.finish(), format: kind, extension: kind === 'webp' ? 'webp' : 'png' };
    } finally { document.removeEventListener('visibilitychange', hidden); motion.close(); }
}
