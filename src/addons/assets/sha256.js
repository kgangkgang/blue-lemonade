// 작은 순수 JS SHA-256 — crypto.subtle 이 없는 곳(폰에서 http://192.168… 로 접속한 실리태번은 보안 맥락이 아니라 subtle 이 없다)에서
// 담긴 ZIP 이 덜 받히거나 깨지지 않았는지 확인하려고. 입력 Uint8Array → 16진 문자열. FIPS 180-4 그대로, 큰 파일은 덩어리로 돌며 쉬어 간다.
const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

function compress(H, W, view, offset) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
        const a = W[i - 15], b = W[i - 2];
        W[i] = (W[i - 16] + (rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3)) + W[i - 7] + (rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10))) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
}

/** bytes(Uint8Array) 의 SHA-256 16진 문자열. 1MB 마다 한 번 쉬어(폰에서 화면이 멈추지 않게) Promise 로 돌려준다 */
export async function sha256Hex(bytes, { yieldEvery = 1 << 20 } = {}) {
    const H = new Int32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const W = new Int32Array(64);
    const full = bytes.length - (bytes.length % 64);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let off = 0, next = yieldEvery; off < full; off += 64) {
        compress(H, W, view, off);
        if (off >= next) { next += yieldEvery; await new Promise(resolve => setTimeout(resolve, 0)); }
    }
    // 끝 덩어리: 남은 바이트 + 0x80 + 0 채움 + 비트 길이(64비트, 큰 끝)
    const rest = bytes.length - full, tail = new Uint8Array(rest + 9 > 64 ? 128 : 64);
    tail.set(bytes.subarray(full));
    tail[rest] = 0x80;
    const bits = bytes.length * 8, tv = new DataView(tail.buffer);
    tv.setUint32(tail.length - 8, Math.floor(bits / 0x100000000));
    tv.setUint32(tail.length - 4, bits >>> 0);
    for (let off = 0; off < tail.length; off += 64) compress(H, W, tv, off);
    return [...H].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
