// 이미지 파일 → 그릴 수 있는 것 (3.5.2) — 확장자를 가리지 않고 (사용자: "이미지 확장자 다 안 가리고" · "도형 커스텀도 확장자 상관없이").
// 색 고르기 › 그림, 이미지 탭 › 도형 커스텀, 날씨 › 내 그림이 같이 쓴다. 가벼운 것부터 차례로:
//   1) 브라우저가 바로 읽는 것 (JPEG · PNG · GIF · WebP · AVIF · BMP · ICO · SVG) — 받는 것 없음
//   2) HEIC · HEIF (아이폰 · 삼성 고효율) → heic-to (libheif wasm 약 3MB)
//   3) 카메라 RAW (DNG · CR2 · NEF · ARW · ORF · RW2 · RAF · CR3 …) → 파일 안에 든 JPEG 미리보기를 꺼냄 — 받는 것 없음
//   4) 그 밖의 모든 형식 (TIFF · PSD · JPEG XL · TGA · QOI · EXR · DDS · PCX · 작은 미리보기뿐인 RAW …) → ImageMagick wasm (약 15MB)
// 2 · 4 는 처음 쓸 때만 jsdelivr 에서 버전 고정 + 무결성 해시(sha384)로 받고(이후 브라우저 캐시), 우리 워커 안에서 풀어
// ImageBitmap 만 받은 뒤 워커를 끝낸다 — wasm 메모리가 페이지에 남지 않게. 투명도는 그대로 (RGBA).
const HEIC_URL = 'https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js';
const HEIC_SRI = 'sha384-cVm8gaWQ5+URpoh6ACKXpm8TuyoHkfIDDBkxvDoUdIZ18w8nV5en0lVQvWMwO/6S';
const MAGICK_JS_URL = 'https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.43/dist/index.js';
const MAGICK_JS_SRI = 'sha384-74iEIMKK47WQ68pkuU6CpNZjwIgOYdbz28FS/YOH/bcLur2ATemQq/UkqyItYaNf';
const MAGICK_WASM_URL = 'https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.43/dist/x86/magick.wasm';
const MAGICK_WASM_SRI = 'sha384-UkheQ1f+jK/nFNM0di+YsgwPvE6Rwzkz3cF59obgVGwfQ26ay/sXU5k126VpxzOg';
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);
const RAW_EXT = /\.(dng|cr2|cr3|crw|nef|nrw|arw|srf|sr2|orf|rw2|raf|pef|srw|x3f|erf|kdc|dcr|mrw|3fr|iiq|rwl)$/i;
const PREVIEW_MIN = 480; // RAW 속 미리보기가 이보다 작으면 ImageMagick 으로 제대로 풀어 봄
const DECODE_MAX = 2048; // ImageMagick 결과 긴 변 (쓰는 곳은 모두 더 줄여 씀)
const TIMEOUT = 120000;

/** 브라우저 파일 칸 accept — 갤러리 먼저 뜨게 image/* 에, 이미지로 안 잡히는 형식 확장자를 더함 */
export const IMAGE_ACCEPT = 'image/*,.heic,.heif,.avif,.jxl,.tif,.tiff,.psd,.tga,.qoi,.exr,.dds,.pcx,.dng,.cr2,.cr3,.nef,.arw,.orf,.rw2,.raf,.pef,.srw';

function nativeDecode(file) {
    return createImageBitmap(file).catch(() => new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); (img.naturalWidth ? resolve(img) : reject(new Error('empty'))); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')); };
        img.src = url;
    }));
}

async function head(file, n = 32) {
    return new Uint8Array(await file.slice(0, n).arrayBuffer());
}

const text = (bytes, from, to) => String.fromCharCode(...bytes.slice(from, to));

function isHeif(file, bytes) {
    if (/\.hei[cf]$/i.test(file.name || '') || /image\/hei[cf]/i.test(file.type || '')) return true;
    return text(bytes, 4, 8) === 'ftyp' && HEIC_BRANDS.has(text(bytes, 8, 12));
}

function isRaw(file, bytes) {
    if (RAW_EXT.test(file.name || '')) return true;
    const tiff = (bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d);
    return (tiff && text(bytes, 8, 10) === 'CR') // CR2
        || text(bytes, 0, 8) === 'FUJIFILM' || text(bytes, 0, 4) === 'IIRO' || text(bytes, 0, 4) === 'IIU\0'
        || (text(bytes, 4, 8) === 'ftyp' && text(bytes, 8, 12) === 'crx ');
}

async function fetchChecked(url, integrity, kind) {
    const res = await fetch(url, { integrity, mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return kind === 'text' ? res.text() : res.arrayBuffer();
}

/** 워커 하나를 띄워 한 번 일을 시키고 끝냄 */
function runWorker(source, message, transfer = [], type = 'classic') {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const worker = new Worker(url, { type });
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('decode timeout')), TIMEOUT);
        worker.onmessage = ({ data }) => { clearTimeout(timeout); data?.bitmap ? resolve(data.bitmap) : reject(new Error(data?.error || 'decode')); };
        worker.onerror = (event) => { clearTimeout(timeout); reject(new Error(event.message || 'decode worker')); };
        worker.postMessage(message, transfer);
    }).finally(() => {
        worker.terminate();
        URL.revokeObjectURL(url);
    });
}

async function decodeHeif(file) {
    const lib = await fetchChecked(HEIC_URL, HEIC_SRI, 'text');
    return runWorker(`${lib}
;self.onmessage = async (event) => {
    try {
        const bitmap = await HeicTo({ blob: event.data, type: 'bitmap' });
        self.postMessage({ bitmap }, [bitmap]);
    } catch (error) {
        self.postMessage({ error: String((error && error.message) || error) });
    }
};`, file);
}

/** RAW 속 JPEG 미리보기 중 가장 큰 것 (SOI FFD8FF 뒤가 JPEG 표지일 때만 풀어 봄 — 압축 데이터 속 우연한 FFD8 은 걸러짐) */
async function rawPreview(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // SOI 바로 뒤 표지: APPn(E0~EF) · 주석(FE) · 양자화표(DB) · 허프만표(C4) · 프레임(C0~C3) · 재시작(DD)
    const marks = new Set([...Array.from({ length: 16 }, (_, k) => 0xe0 + k), 0xfe, 0xdb, 0xc4, 0xc0, 0xc1, 0xc2, 0xc3, 0xdd]);
    let best = null;
    let tried = 0;
    for (let i = 0; i < bytes.length - 4 && tried < 12; i++) {
        if (bytes[i] !== 0xff || bytes[i + 1] !== 0xd8 || bytes[i + 2] !== 0xff || !marks.has(bytes[i + 3])) continue;
        tried++;
        try {
            const bitmap = await createImageBitmap(new Blob([bytes.subarray(i)], { type: 'image/jpeg' }));
            if (!best || bitmap.width * bitmap.height > best.width * best.height) { best?.close?.(); best = bitmap; } else bitmap.close?.();
        } catch { /* 가짜 표지 */ }
    }
    return best;
}

async function decodeMagick(file) {
    const [lib, wasm] = await Promise.all([
        fetchChecked(MAGICK_JS_URL, MAGICK_JS_SRI, 'text'),
        fetchChecked(MAGICK_WASM_URL, MAGICK_WASM_SRI, 'buffer'),
    ]);
    const libUrl = URL.createObjectURL(new Blob([lib], { type: 'text/javascript' }));
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1] || '';
    try {
        return await runWorker(`import { initializeImageMagick, ImageMagick, MagickFormat, MagickGeometry } from '${libUrl}';
self.onmessage = async ({ data }) => {
    try {
        await initializeImageMagick(new Uint8Array(data.wasm));
        const bytes = new Uint8Array(await data.file.arrayBuffer());
        const format = Object.values(MagickFormat).find(value => value === data.ext.toUpperCase());
        const read = (image) => {
            if (Math.max(image.width, image.height) > data.max) image.resize(new MagickGeometry(data.max, data.max));
            const width = image.width, height = image.height;
            const pixels = image.getPixels(p => p.toByteArray(0, 0, width, height, 'RGBA'));
            return { width, height, pixels: new Uint8ClampedArray(pixels) };
        };
        let out;
        try {
            out = format ? ImageMagick.read(bytes, format, read) : ImageMagick.read(bytes, read);
        } catch (first) {
            if (!format) throw first;
            out = ImageMagick.read(bytes, read); // 확장자가 틀린 파일: 내용으로 다시
        }
        const bitmap = await createImageBitmap(new ImageData(out.pixels, out.width, out.height));
        self.postMessage({ bitmap }, [bitmap]);
    } catch (error) {
        self.postMessage({ error: String((error && error.message) || error) });
    }
};`, { wasm, file, ext, max: DECODE_MAX }, [wasm], 'module');
    } finally {
        URL.revokeObjectURL(libUrl);
    }
}

/**
 * @param {File|Blob} file
 * @param {{ onSlow?: (kind: 'heic'|'magick') => void }} [opts] 변환기를 받아야 할 때 한 번 (알림용)
 * @returns {Promise<ImageBitmap|HTMLImageElement>} width/height(naturalWidth) 로 크기, drawImage 로 그리기
 */
export async function decodeAnyImage(file, { onSlow } = {}) {
    try {
        return await nativeDecode(file);
    } catch { /* 아래로 */ }
    const bytes = await head(file);
    if (isHeif(file, bytes)) {
        onSlow?.('heic');
        try {
            return await decodeHeif(file);
        } catch (error) {
            console.warn('[Blue Lemonade] heic-to 로 못 풂 → ImageMagick', error);
        }
    }
    let preview = null;
    if (isRaw(file, bytes)) {
        preview = await rawPreview(file).catch(() => null);
        if (preview && Math.max(preview.width, preview.height) >= PREVIEW_MIN) return preview;
    }
    onSlow?.('magick');
    try {
        const bitmap = await decodeMagick(file);
        preview?.close?.();
        return bitmap;
    } catch (error) {
        if (preview) return preview;
        throw error;
    }
}

export const imageWidth = img => img.naturalWidth || img.width || 0;
export const imageHeight = img => img.naturalHeight || img.height || 0;
