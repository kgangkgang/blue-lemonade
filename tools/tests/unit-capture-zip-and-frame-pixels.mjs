// 캡처 묶음 ZIP (src/capture-archive.js) · 테두리 픽셀 처리 (src/frame-region.js) · 그림 파일 종류 판별 (src/addons/assets/image-format.js)
//   node tools/tests/unit-capture-zip-and-frame-pixels.mjs .
import zlib from 'node:zlib';
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-capture-zip-and-frame-pixels');
const { captureArchive } = await load('src/capture-archive.js');
const { removeBackground, findInterior } = await load('src/frame-region.js');
const { imageFormat } = await load('src/addons/assets/image-format.js');

// ── captureArchive: 만든 ZIP 을 직접 읽어 구조 · CRC 를 확인 ──
const crc32 = bytes => zlib.crc32 ? zlib.crc32(bytes) : (() => { let c, crc = 0xffffffff; for (const b of bytes) { c = (crc ^ b) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; })();
async function readZip(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer()), v = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    assert.equal(v.getUint32(end, true), 0x06054b50, '끝 기록 표식');
    const total = v.getUint16(end + 10, true), dirSize = v.getUint32(end + 12, true), dirAt = v.getUint32(end + 16, true);
    assert.equal(dirAt + dirSize, end, '중앙 디렉터리가 끝 기록 바로 앞에서 끝나요');
    const files = [];
    for (let at = dirAt, i = 0; i < total; i++) {
        assert.equal(v.getUint32(at, true), 0x02014b50);
        const flags = v.getUint16(at + 8, true), method = v.getUint16(at + 10, true), crc = v.getUint32(at + 16, true), size = v.getUint32(at + 20, true), usize = v.getUint32(at + 24, true);
        const nameLen = v.getUint16(at + 28, true), extra = v.getUint16(at + 30, true), comment = v.getUint16(at + 32, true), local = v.getUint32(at + 42, true);
        const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLen));
        assert.equal(v.getUint32(local, true), 0x04034b50, '로컬 헤더 표식');
        const lnLen = v.getUint16(local + 26, true), leLen = v.getUint16(local + 28, true);
        const data = bytes.subarray(local + 30 + lnLen + leLen, local + 30 + lnLen + leLen + size);
        files.push({ name, flags, method, crc, size, usize, data });
        at += 46 + nameLen + extra + comment;
    }
    return files;
}

await test('captureArchive: 파일 여러 개를 저장 방식(무압축) ZIP 으로 묶고 CRC · 크기 · 이름이 맞아요', async () => {
    const a = new Uint8Array([1, 2, 3, 4, 5, 250, 251]);
    const b = new TextEncoder().encode('두 번째 파일 내용');
    const zip = await captureArchive([{ name: '01.png', blob: new Blob([a]) }, { name: '가나다/02.txt', blob: new Blob([b]) }]);
    assert.equal(zip.type, 'application/zip');
    const files = await readZip(zip);
    assert.deepEqual(files.map(f => f.name), ['01.png', '가나다/02.txt']);
    assert.deepEqual([...files[0].data], [...a]);
    assert.deepEqual([...files[1].data], [...b]);
    for (const f of files) {
        assert.equal(f.method, 0, '저장(무압축)');
        assert.equal(f.size, f.usize);
        assert.equal(f.crc, crc32(f.data) >>> 0, f.name + ' CRC');
        assert.equal(f.flags & 0x800, 0x800, '이름은 UTF-8 표시');
    }
});

await test('captureArchive: 빈 목록은 끝 기록만 있는 22바이트 ZIP', async () => {
    const zip = await captureArchive([]);
    assert.equal(zip.size, 22);
    assert.deepEqual(await readZip(zip), []);
});

await test('captureArchive: 빈 파일도 묶여요 (CRC 0)', async () => {
    const [f] = await readZip(await captureArchive([{ name: 'empty.bin', blob: new Blob([]) }]));
    assert.equal(f.size, 0);
    assert.equal(f.crc, 0);
});

await test('captureArchive: 이미 취소된 신호면 던지고, 신호가 없어도 돌아요', async () => {
    const ctl = new AbortController(); ctl.abort();
    await assert.rejects(() => captureArchive([{ name: 'a', blob: new Blob([1]) }], ctl.signal));
    await assert.doesNotReject(() => captureArchive([{ name: 'a', blob: new Blob([1]) }]));
});

// ── frame-region ──
const px = (...pixels) => new Uint8ClampedArray(pixels.flat());

await test('removeBackground: 색이 없으면 복사만, 지정한 색과 가까운 점은 투명하게', () => {
    const src = px([255, 255, 255, 255], [0, 0, 0, 255]);
    const same = removeBackground(src, null, 10);
    assert.deepEqual([...same], [...src]);
    assert.notEqual(same, src, '원본을 고치지 않고 복사본을 줘요');
    const out = removeBackground(src, [255, 255, 255], 10);
    assert.equal(out[3], 0, '배경색은 투명');
    assert.equal(out[7], 255, '다른 색은 그대로');
    assert.deepEqual([...src.slice(0, 4)], [255, 255, 255, 255], '원본 그대로');
});

await test('removeBackground: 허용 오차 경계에서 부드럽게 (8 단계) 투명해져요', () => {
    const out = removeBackground(px([100, 100, 100, 200]), [100, 100, 104], 2);
    assert.equal(out[3], Math.round(200 * ((4 - 2) / 8)));
    assert.equal(removeBackground(px([100, 100, 100, 200]), [100, 100, 130], 2)[3], 200, '충분히 다르면 그대로');
    assert.equal(removeBackground(px([100, 100, 100, 77]), [100, 100, 100], 0)[3], 0);
});

const grid = (rows) => { const h = rows.length, w = rows[0].length, a = new Uint8ClampedArray(w * h * 4); rows.forEach((row, y) => [...row].forEach((c, x) => { a[(y * w + x) * 4 + 3] = c === '#' ? 255 : 0; })); return { a, w, h }; };

await test('findInterior: 닫힌 틀 안쪽을 찾고 바깥으로 새지 않아요', () => {
    const { a, w, h } = grid([
        '.........',
        '.#######.',
        '.#.....#.',
        '.#.....#.',
        '.#.....#.',
        '.#######.',
        '.........',
    ]);
    const r = findInterior(a, w, h, { x: 0.5, y: 0.5, seal: 0 });
    assert.equal(r.outside, false);
    assert.equal(r.onFrame, false);
    assert.equal(r.count, 5 * 3);
    assert.equal(r.region[3 * w + 4], 1);
    assert.equal(r.region[0], 0, '바깥은 영역이 아니에요');
});

await test('findInterior: 틀이 뚫려 있으면 outside 로 알려요', () => {
    const open = grid(['.........', '.#######.', '.#.......', '.#.....#.', '.#######.']);
    const r = findInterior(open.a, open.w, open.h, { x: 0.5, y: 0.5, seal: 0 });
    assert.equal(r.outside, true);
});

await test('findInterior: 시작점이 틀(선) 위면 onFrame, 좌표는 화면 안으로 붙여요', () => {
    const { a, w, h } = grid(['###', '###', '###']);
    const r = findInterior(a, w, h, { x: 0.5, y: 0.5, seal: 0 });
    assert.equal(r.onFrame, true);
    assert.equal(r.count, 0);
    const clamped = findInterior(a, w, h, { x: 9, y: -9, seal: 0 });
    assert.equal(clamped.onFrame, true);
});

await test('findInterior: seal 이 있으면 가는 틈(1칸)을 메워 안쪽으로 인정해요', () => {
    const gap = grid([
        '.........',
        '.###.###.',
        '.#.....#.',
        '.#.....#.',
        '.#######.',
        '.........',
    ]);
    const leaky = findInterior(gap.a, gap.w, gap.h, { x: 0.5, y: 0.55, seal: 0 });
    assert.equal(leaky.outside, true, '틈이 있으니 새요');
    const sealed = findInterior(gap.a, gap.w, gap.h, { x: 0.5, y: 0.55, seal: 1 });
    assert.equal(sealed.outside, false, 'seal 1 이면 한 칸 틈을 막아요');
});

// ── imageFormat ──
const ascii = s => [...s].map(c => c.charCodeAt(0));
const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u32le = n => u32(n).reverse();
const bytes = (...parts) => Uint8Array.from(parts.flat(Infinity));
const png = (...chunks) => bytes([137, 80, 78, 71, 13, 10, 26, 10], chunks.map(([kind, len]) => [u32(len), ascii(kind), new Array(len).fill(0), [0, 0, 0, 0]]));

await test('imageFormat: 너무 짧거나 모르는 파일은 지원 안 함', () => {
    assert.deepEqual(imageFormat(bytes([1, 2, 3])), { supported: false, type: 'unknown', animated: false });
    assert.equal(imageFormat(new Uint8Array(64)).supported, false);
    assert.equal(imageFormat(bytes(ascii('hello world, not an image at all'))).supported, false);
});

await test('imageFormat: JPEG · BMP · ICO 는 움직이지 않는 그림', () => {
    assert.deepEqual(imageFormat(bytes([255, 216, 255, 224], new Array(20).fill(0))), { supported: true, type: 'jpeg', animated: false });
    assert.equal(imageFormat(bytes(ascii('BM'), new Array(20).fill(0))).type, 'bmp');
    assert.equal(imageFormat(bytes([0, 0, 1, 0], new Array(20).fill(0))).type, 'ico');
});

await test('imageFormat: PNG 는 IDAT 로 정지, acTL 이 먼저 나오면 움직이는 그림 (APNG)', () => {
    assert.deepEqual(imageFormat(png(['IHDR', 13], ['IDAT', 4], ['IEND', 0])), { supported: true, type: 'png', animated: false });
    assert.deepEqual(imageFormat(png(['IHDR', 13], ['acTL', 8], ['IDAT', 4], ['IEND', 0])), { supported: true, type: 'png', animated: true });
    assert.equal(imageFormat(png(['IHDR', 13], ['IEND', 0])).supported, false, '그림 조각이 없으면 지원 안 함');
});

await test('imageFormat: 잘려서 길이가 파일을 넘는 PNG 조각은 지원 안 함 (무한 루프 · 범위 밖 읽기 없이)', () => {
    const cut = png(['IHDR', 13], ['IDAT', 4]);
    const broken = cut.slice(0, cut.length - 6);
    assert.equal(imageFormat(broken).supported, false);
    const evil = bytes([137, 80, 78, 71, 13, 10, 26, 10], u32(0xffffffff), ascii('IDAT'), new Array(8).fill(0));
    assert.equal(imageFormat(evil).supported, false);
});

await test('imageFormat: SVG 는 애니메이션 · 스크립트가 들어 있으면 animated 로 표시', () => {
    const svg = s => bytes(ascii(s));
    assert.deepEqual(imageFormat(svg('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>')), { supported: true, type: 'svg', animated: false });
    for (const moving of ['<svg><animate attributeName="x"/></svg>', '<svg><set to="1"/></svg>', '<svg><style>@keyframes a{}</style></svg>', '<svg><style>.a{animation: x 1s}</style></svg>', '<svg><script>1</script></svg>'])
        assert.equal(imageFormat(svg(moving)).animated, true, moving);
});

await test('imageFormat: WebP 는 ANIM · ANMF · VP8X 의 움직임 비트가 있으면 animated', () => {
    const webp = (...chunks) => { const body = chunks.flatMap(([kind, data]) => [ascii(kind), u32le(data.length), data, data.length % 2 ? [0] : []]).flat(); return bytes(ascii('RIFF'), u32le(4 + body.length), ascii('WEBP'), body); };
    assert.deepEqual(imageFormat(webp(['VP8 ', [0, 0, 0, 0]])), { supported: true, type: 'webp', animated: false });
    assert.equal(imageFormat(webp(['VP8X', [2, 0, 0, 0, 0, 0, 0, 0, 0, 0]])).animated, true);
    assert.equal(imageFormat(webp(['VP8X', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]])).animated, false);
    assert.equal(imageFormat(webp(['ANIM', [0, 0, 0, 0, 0, 0]])).animated, true);
});

await test('imageFormat: GIF 는 프레임이 하나면 정지, 둘 이상이면 움직임, 프레임이 없으면 지원 안 함', () => {
    const header = [...ascii('GIF89a'), 1, 0, 1, 0, 0, 0, 0];   // 폭 1 · 높이 1 · 전역 색표 없음
    const frame = [44, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 0x01, 0];   // 이미지 기술자 + 최소 LZW 2 + 블록 + 끝
    assert.deepEqual(imageFormat(bytes(header, frame, [59])), { supported: true, type: 'gif', animated: false });
    assert.equal(imageFormat(bytes(header, frame, frame, [59])).animated, true);
    assert.equal(imageFormat(bytes(header, [59], new Array(8).fill(0))).supported, false);
    assert.equal(imageFormat(bytes(header, frame.slice(0, 6))).supported, false, '잘린 GIF');
});

await test('imageFormat: AVIF 는 avif 브랜드면 정지, avis 면 움직임', () => {
    const ftyp = (...brands) => { const len = 16 + (brands.length - 1) * 4; return bytes(u32(Math.max(len, 16)), ascii('ftyp'), ascii(brands[0]), [0, 0, 0, 0], brands.slice(1).flatMap(ascii), new Array(8).fill(0)); };
    assert.deepEqual(imageFormat(ftyp('avif')), { supported: true, type: 'avif', animated: false });
    assert.equal(imageFormat(ftyp('avis')).animated, true);
    assert.equal(imageFormat(ftyp('mif1', 'avif')).type, 'avif', '호환 브랜드 목록에서도 찾아요');
    assert.equal(imageFormat(ftyp('heic')).supported, false);
});

done();
