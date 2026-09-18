// 업로드 때만 실행하는 픽셀 처리. 채팅 중에는 저장된 PNG와 마스크를 CSS로 재사용한다.
export function removeBackground(rgba, color, tolerance) {
    const out = new Uint8ClampedArray(rgba);
    if (!color) return out;
    for (let i = 0; i < out.length; i += 4) {
        const d = Math.max(Math.abs(out[i] - color[0]), Math.abs(out[i + 1] - color[1]), Math.abs(out[i + 2] - color[2]));
        out[i + 3] = Math.round(out[i + 3] * Math.max(0, Math.min(1, (d - tolerance) / 8)));
    }
    return out;
}
// 거리 변환: 지정한 색의 픽셀에서 반경 r까지 확장. O(width * height).
function expand(mask, width, height, radius) {
    if (!radius) return mask;
    const dist = new Uint16Array(mask.length); dist.fill(65535);
    for (let i = 0; i < mask.length; i++) {
        if (mask[i]) dist[i] = 0;
        else {
            if (i % width) dist[i] = Math.min(dist[i], dist[i - 1] + 1);
            if (i >= width) dist[i] = Math.min(dist[i], dist[i - width] + 1);
        }
    }
    for (let i = mask.length - 1; i >= 0; i--) {
        if (i % width < width - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
        if (i + width < mask.length) dist[i] = Math.min(dist[i], dist[i + width] + 1);
    }
    return Uint8Array.from(dist, n => n <= radius ? 1 : 0);
}
export function findInterior(rgba, width, height, { x = 0.5, y = 0.5, seal = 2 } = {}) {
    const solid = new Uint8Array(width * height);
    for (let i = 0; i < solid.length; i++) solid[i] = rgba[i * 4 + 3] > 64 ? 1 : 0;
    const barrier = expand(solid, width, height, seal);
    const sx = Math.max(0, Math.min(width - 1, Math.floor(x * width)));
    const sy = Math.max(0, Math.min(height - 1, Math.floor(y * height)));
    const start = sy * width + sx;
    const region = new Uint8Array(solid.length);
    if (barrier[start]) return { region, count: 0, outside: false, onFrame: true };
    const queue = new Int32Array(solid.length);
    let head = 0, tail = 1, outside = false;
    queue[0] = start; region[start] = 1;
    const add = n => { if (!barrier[n] && !region[n]) { region[n] = 1; queue[tail++] = n; } };
    while (head < tail) {
        const at = queue[head++], px = at % width, py = Math.floor(at / width);
        if (!px || !py || px === width - 1 || py === height - 1) outside = true;
        if (px) add(at - 1);
        if (px < width - 1) add(at + 1);
        if (py) add(at - width);
        if (py < height - 1) add(at + width);
    }
    return { region: outside ? region : expand(region, width, height, seal + 1), count: tail, outside, onFrame: false };
}
