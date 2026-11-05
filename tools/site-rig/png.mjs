// 작은 PNG 읽기(외부 의존 없음) — Chrome 사진(8비트 · RGB/RGBA · 비인터레이스)만 읽어요. 돌려줌 { width, height, data(RGBA Uint8Array) }
import zlib from 'node:zlib';
export function read(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 가 아니에요');
    let pos = 8, width = 0, height = 0, depth = 8, type = 6, interlace = 0; const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos), name = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
        if (name === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
        else if (name === 'IDAT') idat.push(body);
        else if (name === 'IEND') break;
        pos += 12 + len;
    }
    if (depth !== 8 || interlace) throw new Error(`지원하지 않는 PNG(깊이 ${depth} · 인터레이스 ${interlace})`);
    const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[type]; if (!ch) throw new Error('지원하지 않는 색 종류 ' + type);
    const raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * ch, out = new Uint8Array(width * height * 4);
    let prev = new Uint8Array(stride), cur = new Uint8Array(stride), p = 0;
    for (let y = 0; y < height; y++) {
        const f = raw[p++];
        for (let i = 0; i < stride; i++) {
            const x = raw[p++], a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
            let v;
            if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1);
            else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
            cur[i] = v & 255;
        }
        for (let x = 0; x < width; x++) {
            const s = x * ch, d = (y * width + x) * 4;
            if (ch === 4) { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = cur[s + 3]; }
            else if (ch === 3) { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = 255; }
            else if (ch === 2) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = cur[s + 1]; }
            else { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = 255; }
        }
        [prev, cur] = [cur, prev];
    }
    return { width, height, data: out };
}
