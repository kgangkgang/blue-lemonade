// 캐릭터 에셋 — 그림 가볍게 만들기 (shrink.js · image-format.js): 서버의 원본 파일을 WebP 로 바꿔 끼우는 길
//   1) image-format.js: 움직이는 그림(APNG · GIF 여러 장 · 움직이는 WebP · AVIF 시퀀스 · 움직이는 SVG)을 알아봐서 한 장짜리로 굳히지 않게
//   2) shrinkFolders: 한 장짜리만 바꾸고 원본(같은 이름)은 서버가 지움 · 꺼짐 상태는 새 파일로 · 경량화 기록(SHA-256) ·
//      움직이는 그림 · 기존 WebP · 이미 더 작은 원본 · 너무 큰 그림 · 같은 이름 충돌 · 못 읽는 형식은 손대지 않음
//   3) 다시 돌리면 기록과 같은 WebP 는 「이미 경량화」로 건너뜀 (사용자가 바꾼 WebP 는 보존) · 교체 직전 목록이 바뀌면 그만둠 · 취소
//   4) estimateFolders 는 재기만 하고 아무것도 쓰지 않음
// 실리태번 /api/sprites 는 메모리 속 가짜 서버, 캔버스 · createImageBitmap 은 작은 가짜 (WebP 결과 바이트를 정해 둠). 네트워크 · 디스크 쓰기 없음.
//   node tools/tests/assets-shrink.mjs <테마 루트>
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const F = await import(pathToFileURL(path.join(root, 'src/addons/assets/image-format.js')).href);
const names = await import(pathToFileURL(path.join(root, 'src/addons/assets/names.js')).href);

let moduleId = 0;
const bindings = globalThis.__assetShrinkTest = {};
function importedNames(source) {
    const out = [];
    for (const match of source.matchAll(/^import\s+\{([^}]*)\}\s+from\s/gm)) {
        for (const part of match[1].split(',')) { const name = part.trim(); if (name) out.push((/\s+as\s+(\w+)$/.exec(name) || [, name])[1]); }
    }
    return out;
}
/** import 줄을 떼고 넘긴 값을 그 이름으로 묶어 새 모듈로 연다 (character-assets-prompt.mjs 와 같은 방식) */
async function load(name, imports = {}) {
    const id = ++moduleId;
    const raw = read(`src/addons/assets/${name}`).replace(/\r\n/g, '\n');
    const wanted = [...new Set([...importedNames(raw), ...Object.keys(imports)])];
    bindings[id] = new Proxy(imports, { get: (target, key) => key in target ? target[key] : () => { throw new Error(`시험에서 부르지 않을 함수: ${String(key)}`); } });
    const prelude = `const {${wanted.join(',')}} = globalThis.__assetShrinkTest[${id}];\n`;
    return import('data:text/javascript;base64,' + Buffer.from(prelude + raw.replace(/^import\s[^\n]*(?:\n|$)/gm, '')).toString('base64'));
}

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n' + String(error.stack || error).replace(/data:text\/javascript;base64,[\w+/=]+/g, 'data:…')); }
}
async function quiet(fn) {
    const saved = console.warn;
    console.warn = () => {};
    try { return await fn(); } finally { console.warn = saved; }
}

// ── 그림 바이트 만들기 (형식의 머리 · 덩어리 구조만 맞춘 작은 파일) ──
const ascii = text => [...text].map(c => c.charCodeAt(0));
const be32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
const fill = (n, v = 7) => new Array(n).fill(v);
const pngChunk = (type, data) => [...be32(data.length), ...ascii(type), ...data, 0, 0, 0, 0];
function png({ width = 4, height = 4, animated = false, pad = 300 } = {}) {
    return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...pngChunk('IHDR', [...be32(width), ...be32(height), 8, 6, 0, 0, 0]),
        ...(animated ? pngChunk('acTL', [...be32(2), ...be32(0)]) : []), ...pngChunk('IDAT', fill(pad)), ...pngChunk('IEND', [])]);
}
function subBlocks(n) { const out = []; for (let left = n; left > 0; left -= 255) { const size = Math.min(255, left); out.push(size, ...fill(size, 1)); } out.push(0); return out; }
function gif(frames = 1, pad = 200) {
    const frame = [0x21, 0xF9, 4, 0, 10, 0, 0, 0, 0x2C, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, ...subBlocks(pad)];
    return new Uint8Array([...ascii('GIF89a'), 1, 0, 1, 0, 0, 0, 0, ...Array.from({ length: frames }, () => frame).flat(), 0x3B]);
}
const riff = (type, data) => [...ascii(type), ...le32(data.length), ...data, ...(data.length % 2 ? [0] : [])];
function webp(...chunks) { const body = [...ascii('WEBP'), ...chunks.flat()]; return new Uint8Array([...ascii('RIFF'), ...le32(body.length), ...body]); }
const avif = brands => new Uint8Array([...be32(16 + 4 * brands.length), ...ascii('ftyp'), ...ascii('avif'), 0, 0, 0, 0, ...brands.flatMap(ascii), ...fill(40)]);
const text = value => new TextEncoder().encode(value);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const WEBP_OUT = webp(riff('VP8 ', fill(40, 9)));   // 가짜 캔버스가 내놓는 결과 (60바이트)

// ---------- 1) 형식 알아보기
await test('imageFormat: 움직이는 그림을 알아본다 — APNG(acTL) · GIF 두 장 · WebP(ANIM/ANMF · VP8X 플래그) · AVIF(avis) · SVG(animate · @keyframes)', () => {
    const cases = [
        ['still png', png(), 'png', false], ['apng', png({ animated: true }), 'png', true],
        ['gif 1', gif(1), 'gif', false], ['gif 2', gif(2), 'gif', true],
        ['webp vp8', webp(riff('VP8 ', fill(30))), 'webp', false],
        ['webp vp8x alpha', webp(riff('VP8X', [0x10, ...fill(9, 0)]), riff('VP8 ', fill(30))), 'webp', false],
        ['webp vp8x anim flag', webp(riff('VP8X', [0x02, ...fill(9, 0)]), riff('VP8 ', fill(30))), 'webp', true],
        ['webp ANIM', webp(riff('VP8X', [0x10, ...fill(9, 0)]), riff('ANIM', fill(6, 0)), riff('ANMF', fill(31, 0))), 'webp', true],
        ['avif', avif(['mif1', 'miaf']), 'avif', false], ['avif seq', avif(['mif1', 'avis']), 'avif', true],
        ['svg', text('<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>'), 'svg', false],
        ['svg animate', text('<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"><animate attributeName="r" values="1;2" dur="1s"/></circle></svg>'), 'svg', true],
        ['svg keyframes', text('<svg xmlns="http://www.w3.org/2000/svg"><style>@keyframes spin{to{opacity:0}}</style></svg>'), 'svg', true],
        ['jpeg', new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...fill(20)]), 'jpeg', false],
        ['bmp', new Uint8Array([...ascii('BM'), ...fill(20)]), 'bmp', false],
        ['ico', new Uint8Array([0, 0, 1, 0, ...fill(20)]), 'ico', false],
    ];
    for (const [label, bytes, type, animated] of cases) {
        const got = F.imageFormat(bytes);
        assert.deepEqual(got, { supported: true, type, animated }, label);
    }
    for (const [label, bytes] of [['짧음', new Uint8Array(8)], ['잘린 png', png().subarray(0, 40)], ['글자', text('hello there, plain words')], ['gif 끝 없음', gif(1).subarray(0, 30)]]) {
        assert.equal(F.imageFormat(bytes).supported, false, label);
    }
});

// ── 가짜 서버 · 캔버스 · 실제 state/assets/shrink 한 벌 ──
function makeServer() {
    const folders = new Map(), writes = [], hooks = { onRead: null };
    const baseOf = file => { const at = file.lastIndexOf('.'); return at > 0 ? file.slice(0, at) : file; };
    const dir = folder => { if (!folders.has(folder)) folders.set(folder, new Map()); return folders.get(folder); };
    const server = {
        writes, hooks,
        put(folder, file, bytes) { dir(folder).set(file, bytes); },
        drop(folder, file) { folders.get(folder)?.delete(file); },
        files: folder => [...(folders.get(folder)?.keys() ?? [])].sort(),
        bytes: (folder, file) => folders.get(folder)?.get(file),
        async fetch(url, init = {}) {
            const u = new URL(url, 'https://st.invalid');
            if (u.pathname === '/api/sprites/get') {
                const name = u.searchParams.get('name');
                return Response.json(server.files(name).map(file => ({ label: baseOf(file), path: `/characters/${name}/${file}` })));
            }
            if (u.pathname === '/api/sprites/upload') {
                const form = init.body, folder = form.get('name'), label = form.get('spriteName') || form.get('label'), file = form.get('avatar');
                const target = label + (/\.[^.]*$/.exec(file.name)?.[0] ?? '');
                const bytes = new Uint8Array(await file.arrayBuffer());
                for (const name of [...dir(folder).keys()]) if (baseOf(name) === label) dir(folder).delete(name);
                dir(folder).set(target, bytes);
                writes.push(['upload', folder, target, file.type]);
                return new Response('{}');
            }
            if (u.pathname.startsWith('/characters/')) {
                const parts = u.pathname.slice('/characters/'.length).split('/').map(decodeURIComponent);
                const file = parts.pop(), folder = parts.join('/'), bytes = folders.get(folder)?.get(file);
                if (!bytes) return new Response('', { status: 404 });
                const response = new Response(new Blob([bytes]));
                hooks.onRead?.(folder, file);
                return response;
            }
            throw new Error('예상 밖 요청: ' + url);
        },
    };
    return server;
}
async function harness() {
    const server = makeServer();
    globalThis.fetch = server.fetch;
    const canvas = { made: 0, types: [] };
    globalThis.document = { createElement: tag => {
        assert.equal(tag, 'canvas');
        canvas.made++;
        return { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob: (done, type, quality) => { canvas.types.push([type, quality]); done(new Blob([WEBP_OUT], { type: 'image/webp' })); } };
    } };
    // 가짜 디코더: PNG 는 IHDR 의 가로 · 세로, 나머지는 4×4
    globalThis.createImageBitmap = async blob => {
        const b = new Uint8Array(await blob.arrayBuffer());
        const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
        const isPng = b[0] === 137 && b[1] === 80;
        return { width: isPng ? view.getUint32(16) : 4, height: isPng ? view.getUint32(20) : 4, close() {} };
    };
    const ext = {}, context = { characters: [{ avatar: 'Nova.png' }], characterId: 0 };
    let saves = 0;
    const state = await load('state.js', { extension_settings: ext, getContext: () => context, saveSettingsDebounced: () => { saves++; } });
    state.initSettings();
    const assets = await load('assets.js', { getRequestHeaders: () => ({}), formatKeywordList: names.formatKeywordList });
    const shrink = await load('shrink.js', { ...state, ...assets, imageFormat: F.imageFormat });
    return { server, canvas, state, shrink, settings: () => state.settings(), get saves() { return saves; } };
}
const key = (folder, file) => JSON.stringify([folder, file]);

/** 형식이 섞인 폴더 (원본 바이트를 함께 돌려준다) */
function fillMixed(h) {
    const files = {
        'big.png': png(), 'flat.gif': gif(1), 'spin.png': png({ animated: true }), 'wave.gif': gif(2),
        'loop.webp': webp(riff('VP8X', [0x02, ...fill(9, 0)]), riff('ANIM', fill(6, 0)), riff('ANMF', fill(200, 0))),
        'old.webp': webp(riff('VP8 ', fill(200))), 'tiny.png': png({ pad: 0 }), 'huge.png': png({ width: 7000, height: 7000 }),
        'dup.png': png(), 'dup.jpg': new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...fill(300)]), 'notes.png': text('hello there, not a picture at all'),
    };
    for (const [file, bytes] of Object.entries(files)) h.server.put('Nova', file, bytes);
    h.server.put('Nova/Season', 'snow.png', png());
    return files;
}

// ---------- 2) 바꾸기
await test('shrinkFolders: 한 장짜리만 WebP 로 바꾸고 원본은 사라짐 · 꺼짐은 새 파일로 · 경량화 기록은 결과의 SHA-256 · 나머지는 바이트 그대로', async () => {
    const h = await harness();
    const files = fillMixed(h);
    const s = h.settings();
    s.disabled.Nova = ['big.png', 'wave.gif'];
    const progress = [];
    const result = await h.shrink.shrinkFolders(['Nova', 'Nova/Season'], info => progress.push(info.done));
    assert.deepEqual(h.server.files('Nova'), ['big.webp', 'dup.jpg', 'dup.png', 'flat.webp', 'huge.png', 'loop.webp', 'notes.png', 'old.webp', 'spin.png', 'tiny.png', 'wave.gif']);
    assert.deepEqual(h.server.files('Nova/Season'), ['snow.webp']);
    for (const [file, bytes] of Object.entries(files)) {
        if (file === 'big.png' || file === 'flat.gif') continue;
        assert.deepEqual(h.server.bytes('Nova', file), bytes, `${file} 은 손대지 않는다`);
    }
    assert.deepEqual(h.server.bytes('Nova', 'big.webp'), WEBP_OUT);
    assert.deepEqual(h.server.writes.map(w => [w[1], w[2], w[3]]), [['Nova', 'big.webp', 'image/webp'], ['Nova', 'flat.webp', 'image/webp'], ['Nova/Season', 'snow.webp', 'image/webp']]);
    assert.deepEqual([...s.disabled.Nova].sort(), ['big.webp', 'wave.gif'], '꺼 둔 big 은 WebP 가 되어도 꺼진 채로, 옛 이름은 지움');
    assert.deepEqual(s.optimizedImages, { [key('Nova', 'big.webp')]: sha(WEBP_OUT), [key('Nova', 'flat.webp')]: sha(WEBP_OUT), [key('Nova/Season', 'snow.webp')]: sha(WEBP_OUT) });
    assert.equal(result.total, 12); assert.equal(result.changed, 3); assert.equal(result.skipped, 9); assert.equal(result.failed, 0); assert.equal(result.cancelled, false);
    assert.deepEqual(result.reasons, { animated: 3, webp: 1, smaller: 1, large: 1, collision: 2, unsupported: 1 });
    assert.equal(result.before, files['big.png'].length + files['flat.gif'].length + png().length);
    assert.equal(result.after, WEBP_OUT.length * 3);
    assert.deepEqual(progress, Array.from({ length: 12 }, (_, i) => i + 1));
    assert.ok(h.canvas.types.every(([type, quality]) => type === 'image/webp' && quality === 0.9));
});

await test('다시 돌리기: 기록과 같은 WebP 는 「이미 경량화」, 사용자가 바꿔 넣은 WebP 는 「기존 WebP 보존」 — 어느 쪽도 다시 올리지 않음', async () => {
    const h = await harness();
    h.server.put('Nova', 'big.png', png()); h.server.put('Nova', 'calm.png', png());
    await h.shrink.shrinkFolders(['Nova']);
    const writes = h.server.writes.length;
    h.server.put('Nova', 'calm.webp', webp(riff('VP8 ', fill(120, 5))));
    const again = await h.shrink.shrinkFolders(['Nova']);
    assert.equal(h.server.writes.length, writes);
    assert.equal(again.changed, 0);
    assert.deepEqual(again.reasons, { optimized: 1, webp: 1 });
    const estimate = await h.shrink.estimateFolders(['Nova']);
    assert.equal(estimate.count, 0); assert.deepEqual(estimate.reasons, { optimized: 1, webp: 1 });
});

await test('교체 직전에 목록이 바뀌면 (같은 이름의 다른 파일이 생김 · 원본이 사라짐) 올리지 않고 실패로 셈', async () => {
    const h = await harness();
    h.server.put('Nova', 'race.png', png());
    h.server.hooks.onRead = (folder, file) => { if (file === 'race.png') h.server.put('Nova', 'race.jpg', new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...fill(20)])); };
    const result = await quiet(() => h.shrink.shrinkFolders(['Nova']));
    assert.equal(result.failed, 1); assert.equal(result.changed, 0);
    assert.deepEqual(h.server.files('Nova'), ['race.jpg', 'race.png']);
    assert.deepEqual(h.server.writes, []);
    assert.equal(h.settings().optimizedImages, undefined);

    const g = await harness();
    g.server.put('Nova', 'gone.png', png());
    g.server.hooks.onRead = () => g.server.drop('Nova', 'gone.png');
    const lost = await quiet(() => g.shrink.shrinkFolders(['Nova']));
    assert.equal(lost.failed, 1); assert.deepEqual(g.server.writes, []); assert.deepEqual(g.server.files('Nova'), []);
});

await test('취소: 시작 전에 취소하면 하나도 안 바꾸고, 중간에 취소하면 거기서 멈춤', async () => {
    const h = await harness();
    h.server.put('Nova', 'a.png', png()); h.server.put('Nova', 'b.png', png()); h.server.put('Nova', 'c.png', png());
    const none = await h.shrink.shrinkFolders(['Nova'], null, { cancelled: () => true });
    assert.equal(none.cancelled, true); assert.equal(none.changed, 0); assert.deepEqual(h.server.writes, []);
    let asked = 0;
    const one = await h.shrink.shrinkFolders(['Nova'], null, { cancelled: () => ++asked > 1 });
    assert.equal(one.cancelled, true); assert.equal(one.changed, 1);
    assert.deepEqual(h.server.files('Nova'), ['a.webp', 'b.png', 'c.png']);
});

await test('estimateFolders: 재기만 한다 — 서버 · 설정 · 꺼짐 · 기록 그대로, 줄 장수 · 바이트 · 이유를 셈', async () => {
    const h = await harness();
    const files = fillMixed(h);
    const s = h.settings();
    s.disabled.Nova = ['big.png'];
    const before = JSON.stringify(s), saves = h.saves;
    const steps = [];
    const result = await h.shrink.estimateFolders(['Nova'], info => steps.push(info.done));
    assert.deepEqual(h.server.writes, []);
    assert.equal(JSON.stringify(s), before); assert.equal(h.saves, saves);
    assert.equal(result.total, 11); assert.equal(result.count, 2);
    assert.equal(result.bytes, files['big.png'].length + files['flat.gif'].length);
    assert.equal(result.estimated, WEBP_OUT.length * 2);
    assert.deepEqual(result.reasons, { animated: 3, webp: 1, smaller: 1, large: 1, collision: 2, unsupported: 1 });
    assert.equal(steps.length, 11);
    assert.equal(h.shrink.skipSummary({ animated: 3, webp: 0, collision: 2 }), '움직이는 이미지 보존 3장 · 같은 이름 충돌 2장');
});

await test('같은 이름 충돌: 대소문자만 다른 이름 · 서버가 다르게 다듬을 이름은 바꾸지 않음 (올리기가 다른 파일을 지울 수 있다)', async () => {
    const h = await harness();
    h.server.put('Nova', 'Case.png', png()); h.server.put('Nova', 'case.png', png()); h.server.put('Nova', 'odd:name.png', png()); h.server.put('Nova', 'ok.png', png());
    const result = await h.shrink.shrinkFolders(['Nova']);
    assert.deepEqual(result.reasons, { collision: 3 }); assert.equal(result.changed, 1);
    assert.deepEqual(h.server.files('Nova'), ['Case.png', 'case.png', 'odd:name.png', 'ok.webp']);
});

delete globalThis.__assetShrinkTest;
console.log(`assets-shrink: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
