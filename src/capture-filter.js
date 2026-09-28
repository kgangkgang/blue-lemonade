// 5.5.3 채팅 캡처 필터: 필름 그레인 · 흑백 · 색감 (밝기 · 대비 · 채도 · 색온도 · 비네트)
// 순수 부분(filterSettings · filterCss · noiseTile · isNeutral)은 node 에서 그대로 검사한다. 캔버스 부분은 applyCaptureFilter 뿐.
// 값이 전부 0(프리셋 없음)이면 캔버스를 한 번도 건드리지 않는다 → 기존 캡처 결과와 바이트까지 같다.
// 키 · 범위 · 프리셋 표는 capture-style.js 한 곳에만 둔다 (설정 정규화 · 캡처 옵션 화면과 같은 표). 프리셋을 고르면 이 값을 채우고, 슬라이더를 만지면 'custom'.
import { FILTER_KEYS, FILTER_RANGES, FILTER_PRESETS } from './capture-style.js';
export { FILTER_KEYS, FILTER_RANGES, FILTER_PRESETS };
const TILE = 256;
const clamp = (value, [low, high]) => { const n = Number(value); return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : 0; };
/** captureTools(또는 그 스냅샷)에서 여섯 값을 읽어 정규화 · 클램프한다. 값은 문자열로 저장돼 있을 수 있다(Number).
 *  저장된 값이 기준이다 (프리셋을 고르면 화면이 값을 채우고, 설정 정규화가 이름 있는 프리셋의 값을 표에 맞춘다). 표는 값이 없을 때만 — 예전 · 불완전한 설정. */
export function filterSettings(cfg) {
    const source = cfg && typeof cfg === 'object' ? cfg : {};
    const preset = typeof source.filterPreset === 'string' ? source.filterPreset : 'custom';
    const table = preset !== 'custom' && Object.hasOwn(FILTER_PRESETS, preset) ? FILTER_PRESETS[preset] : null;
    return Object.fromEntries(FILTER_KEYS.map(key => [key, clamp(source[key] ?? table?.[key], FILTER_RANGES[key])]));
}
export function isNeutral(f) {
    return FILTER_KEYS.every(key => !(Number(f?.[key]) || 0));
}
const ratio = value => String(Math.round((1 + value / 100) * 1000) / 1000);
/** ctx.filter 용 문자열. 색 세 가지(밝기 · 대비 · 채도)만 — 색온도 · 비네트 · 그레인은 블렌드로 따로 입힌다. */
export function filterCss(f) {
    const v = filterSettings({ ...f, filterPreset: 'custom' });
    const parts = [];
    if (v.brightness) parts.push(`brightness(${ratio(v.brightness)})`);
    if (v.contrast) parts.push(`contrast(${ratio(v.contrast)})`);
    if (v.saturation) parts.push(`saturate(${ratio(v.saturation)})`);
    return parts.length ? parts.join(' ') : 'none';
}
/** 결정적 PRNG — 같은 seed 면 같은 그레인 (테스트 · 페이지마다 다른 무늬) */
export function mulberry32(seed) {
    let a = (Number(seed) || 0) >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** 루미넌스 노이즈 타일(회색, 평균 128, 분산 ∝ strength). overlay 로 덮으면 128 은 그대로, 밝은 곳 · 어두운 곳 모두 자글자글해진다. ImageData 호환 {width, height, data}. */
export function noiseTile(size = TILE, seed = 1, strength = 100) {
    const side = Math.max(1, Math.floor(Number(size)) || TILE), count = side * side;
    const data = new Uint8ClampedArray(count * 4), rand = mulberry32(seed);
    const amp = 127 * Math.sqrt(clamp(strength, [0, 100]) / 100) * (2 / 3); // 균일 난수 셋의 합(종 모양) → ±127 · √강도
    for (let i = 0; i < count; i++) {
        const v = 128 + (rand() + rand() + rand() - 1.5) * amp;
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    }
    return { width: side, height: side, data };
}
// ---- 캔버스 부분 ----
let scratch = null; // 색 필터를 입힌 사본 (프레임마다 다시 만들지 않게 재사용 · releaseCaptureFilter 로 놓는다)
const tiles = new Map(); // seed → 그레인 타일 캔버스
let filterWorks = null;
/** ctx.filter 를 실제로 그리는지 한 번 재 본다 — 속성만 있고 무시하는 엔진이면 흑백이 조용히 색을 남긴다 (빨간 1×1 에 saturate(0) → 회색이어야) */
export function canvasFilterWorks() {
    if (filterWorks !== null) return filterWorks;
    filterWorks = false;
    try {
        if (typeof CanvasRenderingContext2D === 'undefined' || !('filter' in CanvasRenderingContext2D.prototype)) return filterWorks;
        const probe = document.createElement('canvas'); probe.width = probe.height = 1;
        const pctx = probe.getContext('2d', { willReadFrequently: true });
        if (!pctx) return filterWorks;
        pctx.filter = 'saturate(0)'; pctx.fillStyle = '#ff0000'; pctx.fillRect(0, 0, 1, 1); pctx.filter = 'none';
        const [r, g, b] = pctx.getImageData(0, 0, 1, 1).data;
        filterWorks = Math.abs(r - g) < 8 && Math.abs(g - b) < 8;
        probe.width = probe.height = 0;
    } catch { filterWorks = false; }
    return filterWorks;
}
/** 정지 캡처: 그리기 전에 ctx.filter 로 색(밝기 · 대비 · 채도)을 입힐 수 있으면 그 문자열, 아니면 'none' (사본 캔버스가 필요 없다) */
export function drawFilterCss(f) {
    const v = filterSettings({ ...f, filterPreset: 'custom' }), css = filterCss(v);
    return css !== 'none' && canvasFilterWorks() ? css : 'none';
}
const readsOften = ctx => { try { return !!ctx.getContextAttributes?.()?.willReadFrequently; } catch { return false; } };
/** 사본 캔버스 — 원본과 같은 메모리(willReadFrequently)에 둬야 프레임마다 GPU ↔ 메모리를 오가지 않는다 */
function scratchCanvas(width, height, cpu) {
    if (scratch && scratch._cpu !== cpu) { scratch.width = scratch.height = 0; scratch = null; }
    if (!scratch) { scratch = document.createElement('canvas'); scratch._cpu = cpu; }
    if (scratch.width !== width || scratch.height !== height) { scratch.width = width; scratch.height = height; }
    const sctx = scratch.getContext('2d', cpu ? { willReadFrequently: true } : undefined);
    return sctx && !sctx.isContextLost?.() && scratch.width === width && scratch.height === height ? sctx : null;
}
function tileCanvas(seed) {
    let tile = tiles.get(seed);
    if (tile) return tile;
    if (tiles.size >= 4) tiles.delete(tiles.keys().next().value);
    const noise = noiseTile(TILE, seed);
    tile = document.createElement('canvas'); tile.width = tile.height = TILE;
    tile.getContext('2d').putImageData(new ImageData(noise.data, TILE, TILE), 0, 0);
    tiles.set(seed, tile);
    return tile;
}
/** ctx.filter 가 없는 브라우저(옛 Safari): 픽셀 루프로 밝기 · 대비 · 채도 — CSS filter 와 같은 식 */
function filterPixels(ctx, width, height, f) {
    const image = ctx.getImageData(0, 0, width, height), d = image.data;
    const b = 1 + f.brightness / 100, c = 1 + f.contrast / 100, s = 1 + f.saturation / 100;
    const unit = x => x < 0 ? 0 : x > 255 ? 255 : x; // CSS filter 처럼 단계마다 0..255 로 자른다
    for (let i = 0; i < d.length; i += 4) {
        const r = unit((unit(d[i] * b) - 127.5) * c + 127.5), g = unit((unit(d[i + 1] * b) - 127.5) * c + 127.5), bl = unit((unit(d[i + 2] * b) - 127.5) * c + 127.5);
        const l = 0.213 * r + 0.715 * g + 0.072 * bl;
        d[i] = l + (r - l) * s; d[i + 1] = l + (g - l) * s; d[i + 2] = l + (bl - l) * s;
    }
    ctx.putImageData(image, 0, 0);
}
/**
 * 2D 캔버스에 제자리 적용. 순서: 색(ctx.filter) → 색온도(overlay) → 비네트(multiply) → 그레인(overlay 패턴) → 상태 복원.
 * seed: 페이지 · 용도마다 다른 그레인 무늬, frame: 프레임마다 타일 자리를 옮겨 움직이는 그레인, grainScale: 고배율 정지 캡처에서 그레인 알갱이 크기(축소해 봐도 같은 굵기).
 * colorApplied: 정지 캡처처럼 그릴 때 이미 ctx.filter 로 색을 입혔으면 true (색 단계를 건너뛴다).
 * region: 미리보기 전용(5.5.4) — 이 캔버스가 더 큰 그림의 한 조각일 때 {width, height, x, y} (전체 크기와 조각의 자리, 이 캔버스 픽셀 단위).
 *   비네트는 전체 그림 기준으로, 그레인은 조각끼리 이어지게 입힌다. 이때는 grainScale 1 미만도 그대로 쓴다. 파일 만들기는 region 을 넘기지 않는다(예전 그대로).
 * 값이 전부 0 이면 아무것도 하지 않고 false.
 */
export function applyCaptureFilter(canvas, f, { seed = 1, frame = 0, grainScale = 1, colorApplied = false, region = null } = {}) {
    const v = filterSettings({ ...f, filterPreset: 'custom' });
    if (isNeutral(v) || !canvas?.width || !canvas.height) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const width = canvas.width, height = canvas.height, css = colorApplied ? 'none' : filterCss(v);
    ctx.save();
    try {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (css !== 'none') {
            const cctx = canvasFilterWorks() ? scratchCanvas(width, height, readsOften(ctx)) : null;
            if (cctx) {
                cctx.clearRect(0, 0, width, height); cctx.filter = css; cctx.drawImage(canvas, 0, 0); cctx.filter = 'none';
                if (cctx.isContextLost?.()) throw Error('캡처 필터용 캔버스를 만들지 못했어요. 필터를 끄거나 메시지를 나누어 주세요.'); // 빈 사본으로 덮지 않는다
                ctx.clearRect(0, 0, width, height); ctx.drawImage(cctx.canvas, 0, 0);
            } else filterPixels(ctx, width, height, v);
        }
        if (v.temperature) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = v.temperature > 0 ? `rgba(255,170,60,${Math.abs(v.temperature) / 50 * .35})` : `rgba(60,140,255,${Math.abs(v.temperature) / 50 * .35})`;
            ctx.fillRect(0, 0, width, height);
        }
        if (v.vignette) {
            const full = region ? { w: region.width || width, h: region.height || height } : { w: width, h: height };
            const cx = full.w / 2 - (region?.x || 0), cy = full.h / 2 - (region?.y || 0), radius = Math.hypot(full.w / 2, full.h / 2);
            const gradient = ctx.createRadialGradient(cx, cy, radius * .55, cx, cy, radius);
            gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, `rgba(0,0,0,${v.vignette / 100 * .9})`);
            ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
        }
        if (v.grain) {
            const rand = mulberry32(seed * 65537 + frame), scale = Math.max(1, Number(grainScale) || 1);
            const ox = Math.floor(rand() * TILE), oy = Math.floor(rand() * TILE);
            ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = v.grain / 100 * .9;
            ctx.imageSmoothingEnabled = false; // 고배율에서도 알갱이가 흐려지지 않게 (restore 가 되돌린다)
            ctx.fillStyle = ctx.createPattern(tileCanvas(seed), 'repeat');
            if (!region) {
                ctx.setTransform(scale, 0, 0, scale, ox * scale, oy * scale);
                ctx.fillRect(-ox, -oy, width / scale + ox, height / scale + oy);
            } else { // 조각: 무늬 원점을 전체 그림 기준으로 (x · y 만큼 당긴다) — 위아래 조각의 알갱이가 이어진다
                const fine = Math.max(.25, Number(grainScale) || 1), tx = ox * fine - (region.x || 0), ty = oy * fine - (region.y || 0);
                ctx.setTransform(fine, 0, 0, fine, tx, ty);
                ctx.fillRect(-tx / fine, -ty / fine, width / fine, height / fine);
            }
        }
    } finally { ctx.restore(); }
    return true;
}
/** 사본 · 타일을 놓는다 — 정지 캡처가 끝난 뒤, 영상 · 움짤 close() 에서 */
export function releaseCaptureFilter() {
    if (scratch) { scratch.width = scratch.height = 0; scratch = null; }
    for (const tile of tiles.values()) tile.width = tile.height = 0;
    tiles.clear();
}
