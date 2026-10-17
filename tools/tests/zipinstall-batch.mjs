// ZIP 설치 1.1.2 — 여러 ZIP · 확장 여러 개를 묶은 ZIP 을 한 번에 (src/addons/zipinstall/batch.js + 서버 도우미 1.1.0 그대로)
//   node tools/tests/zipinstall-batch.mjs <테마 루트>
// 진짜 ZIP 바이트(저장 · deflate · 데이터 서술자 · 확장 필드)를 만들어 화면 쪽에서 나눈 뒤, 진짜 서버 도우미 코드(archive.mjs · install.mjs)로 임시 폴더에 설치한다.
// yauzl 은 아래의 작은 ZIP 읽개를 쓰고, 실리태번의 yauzl 이 옆에 있으면 그것으로도 한 번 더 읽는다(없으면 건너뜀).
// 확인하는 것:
//   1) 나누기: 가장 바깥 manifest.json 이 둘 이상일 때만 확장마다 ZIP 을 새로 엮는다 · 한 확장(안에 든 작은 manifest 포함)이나 ZIP 아닌 것은 null(원래 파일 그대로)
//   2) 나눈 ZIP 은 도우미가 그대로 읽는다 — 파일 · 바이트 · 추천 폴더 이름 · 압축 방식 · 서술자 · 바깥 겉폴더 · 묶음 밖 파일은 빠짐
//   3) 여러 ZIP + 묶음 ZIP: 확장마다 미리보기(새 설치/업데이트 · 판 · 교체/추가/유지 · 백업) → 모두 설치 → 정확한 바이트 · 업데이트는 각각 백업
//   4) 같은 폴더가 두 번이면 막는다(대소문자 무시) — 설치 요청을 하나도 보내지 않음
//   5) 하나가 실패해도(확인 실패 · 설치 직전 바뀜 · 설치 오류) 나머지는 설치하고 끝에 성공/실패를 한꺼번에
//   6) 옛 도우미(1.1.0 · 사용자마다 확인 표 하나): 설치 때마다 다시 확인해 받은 표만 쓴다 · 화면이 기대하는 도우미 판 = 서버 판
//   7) 테마 자신(blue-lemonade) 삭제 보호는 그대로
// 임시 폴더는 os.tmpdir() 아래에 만들고 끝에 지운다. 지어낸 확장 이름과 글만 쓴다.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const root = path.resolve(process.argv[2] || '.');
const plugin = path.join(root, 'server-plugin/blue-lemonade-zip');
const B = await import(pathToFileURL(path.join(root, 'src/addons/zipinstall/batch.js')).href);
const { readArchive, ZipError } = await import(pathToFileURL(path.join(plugin, 'archive.mjs')).href);
const { Installer } = await import(pathToFileURL(path.join(plugin, 'install.mjs')).href);
const server = await import(pathToFileURL(path.join(plugin, 'index.mjs')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── 진짜 ZIP 쓰개: { name, text, deflate, descriptor, ascii } → 바이트
const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); return n >>> 0; });
const crcOf = buf => { let c = 0xffffffff; for (const b of buf) c = (c >>> 8) ^ table[(c ^ b) & 255]; return (c ^ 0xffffffff) >>> 0; };
function writeZip(list) {
    const parts = [], central = []; let offset = 0;
    for (const e of list) {
        const name = Buffer.from(e.name, 'utf8'), dir = e.name.endsWith('/'), data = Buffer.from(e.text ?? '', 'utf8');
        const body = e.deflate ? zlib.deflateRawSync(data) : data, crc = crcOf(data), flags = (e.ascii ? 0 : 0x800) | (e.descriptor ? 8 : 0), method = e.deflate ? 8 : 0;
        const extra = Buffer.from([0x55, 0x54, 5, 0, 1, 0, 0, 0, 0]);
        const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8);
        local.writeUInt16LE(0x6000, 10); local.writeUInt16LE(0x5a51, 12);
        if (!e.descriptor) { local.writeUInt32LE(crc, 14); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); }
        local.writeUInt16LE(name.length, 26); local.writeUInt16LE(extra.length, 28);
        const tail = e.descriptor ? Buffer.alloc(16) : Buffer.alloc(0);
        if (e.descriptor) { tail.writeUInt32LE(0x08074b50, 0); tail.writeUInt32LE(crc, 4); tail.writeUInt32LE(body.length, 8); tail.writeUInt32LE(data.length, 12); }
        parts.push(local, name, extra, body, tail);
        const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x031e, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(flags, 8); c.writeUInt16LE(method, 10);
        c.writeUInt16LE(0x6000, 12); c.writeUInt16LE(0x5a51, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(data.length, 24);
        c.writeUInt16LE(name.length, 28); c.writeUInt16LE(5, 30); c.writeUInt16LE(0, 32); c.writeUInt32LE((((dir ? 0x4000 | 0o755 : 0x8000 | 0o644)) << 16) >>> 0, 38); c.writeUInt32LE(offset, 42);
        central.push(c, name, Buffer.from([0x55, 0x54, 1, 0, 1]));
        offset += 30 + name.length + extra.length + body.length + tail.length;
    }
    const cd = Buffer.concat(central), end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(list.length, 8); end.writeUInt16LE(list.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
    return Buffer.concat([...parts, cd, end]);
}
const files = (prefix, obj, opts = {}) => Object.entries(obj).map(([n, text], i) => ({ name: prefix + n, text, deflate: i % 2 === 0 && !n.endsWith('/'), descriptor: i % 3 === 1, ...opts }));

// ── 작은 진짜 ZIP 읽개 (yauzl 꼴: fromBuffer · entry · openReadStream · end)
const mini = {
    fromBuffer(buffer, options, cb) {
        let end = buffer.length - 22; while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
        if (end < 0) return cb(new Error('no zip'));
        const list = []; let o = buffer.readUInt32LE(end + 16);
        for (let i = 0; i < buffer.readUInt16LE(end + 10); i++) {
            const n = buffer.readUInt16LE(o + 28), x = buffer.readUInt16LE(o + 30), c = buffer.readUInt16LE(o + 32);
            list.push({ fileName: buffer.subarray(o + 46, o + 46 + n).toString(buffer.readUInt16LE(o + 8) & 0x800 ? 'utf8' : 'latin1'), generalPurposeBitFlag: buffer.readUInt16LE(o + 8), compressionMethod: buffer.readUInt16LE(o + 10), crc32: buffer.readUInt32LE(o + 16), compressedSize: buffer.readUInt32LE(o + 20), uncompressedSize: buffer.readUInt32LE(o + 24), externalFileAttributes: buffer.readUInt32LE(o + 38), offset: buffer.readUInt32LE(o + 42) });
            o += 46 + n + x + c;
        }
        const zip = new EventEmitter(); let i = 0, closed = false;
        zip.readEntry = () => setImmediate(() => { if (closed) return; if (i >= list.length) zip.emit('end'); else zip.emit('entry', list[i++]); });
        zip.openReadStream = (e, done) => setImmediate(() => {
            const at = e.offset + 30 + buffer.readUInt16LE(e.offset + 26) + buffer.readUInt16LE(e.offset + 28), raw = buffer.subarray(at, at + e.compressedSize);
            done(null, Readable.from([e.compressionMethod === 8 ? zlib.inflateRawSync(raw) : raw]));
        });
        zip.close = () => { closed = true; };
        cb(null, zip);
    },
};
const realYauzl = (() => {
    for (const base of [process.cwd(), path.join(root, '../..'), path.join(root, '../../..')]) {
        try { const p = createRequire(path.join(base, 'package.json')).resolve('yauzl'); if (existsSync(p)) return createRequire(path.join(base, 'package.json'))('yauzl'); } catch {}
    }
    return null;
})();
const readers = realYauzl ? [mini, realYauzl] : [mini];

// ── 임시 폴더 + 진짜 도우미에 붙인 request (index.js 의 request 와 같은 꼴: 오류면 Error(message))
const temps = [];
async function fixture() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bl-zip-batch-')); temps.push(dir);
    const base = path.join(dir, 'extensions'); await fs.mkdir(base);
    return { dir, base, vault: path.join(dir, '.blue-lemonade-zip') };
}
async function put(dir, obj) { for (const [n, t] of Object.entries(obj)) { await fs.mkdir(path.dirname(path.join(dir, n)), { recursive: true }); await fs.writeFile(path.join(dir, n), t); } }
async function tree(dir) {
    const out = {};
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, item.name);
        if (item.isDirectory()) for (const [n, d] of Object.entries(await tree(p))) out[item.name + '/' + n] = d;
        else out[item.name] = await fs.readFile(p, 'utf8');
    }
    return out;
}
function helper(base, installer = new Installer({ yauzl: mini, readArchive }), hooks = {}) {
    const calls = [];
    const request = async (route, body, blob) => {
        const [r, q] = route.split('?'); calls.push({ route: r, body, blob });
        try {
            await hooks[r]?.(body);
            if (r === '/inspect') return await installer.inspect(base, 'admin', Buffer.from(await blob.arrayBuffer()), new URLSearchParams(q).get('name'));
            if (r === '/preview') return await installer.preview(base, 'admin', body.token, body.folder);
            if (r === '/install') return await installer.install(base, 'admin', body.token);
            throw new ZipError('없는 길', 404);
        } catch (e) { throw Error(e.message); }
    };
    return { request, calls, installer };
}
const asFile = (buf, name) => new File([buf], name, { type: 'application/zip' });
const manifest = (name, version, extra = {}) => JSON.stringify({ display_name: name, version, js: 'index.js', ...extra });
const PEBBLE = { 'manifest.json': manifest('Pebble Notes', '2.0.0'), 'index.js': 'export const pebble = 2;', 'lib/a.js': 'export const a = "가나다";', 'img/': '' };
const QUILL = { 'manifest.json': manifest('Quill Pad', '1.4.0'), 'index.js': 'export const quill = 1;', 'style.css': '.q{}', 'tools/inner/manifest.json': manifest('Inner Tool', '0.1.0'), 'tools/inner/index.js': '//' };
const MOSS = { 'manifest.json': manifest('Moss Clock', '0.9.0'), 'index.js': 'export const moss = 9;' };
const FERN = { 'manifest.json': manifest('Fern Map', '3.0.0'), 'index.js': 'export const fern = 3;' };
const bundle = () => writeZip([{ name: 'README.txt', text: 'bundle readme' }, ...files('pebble-notes/', PEBBLE), ...files('quill-pad/', QUILL), ...files('moss-clock/', MOSS, { ascii: true })]);
const noDirs = obj => Object.fromEntries(Object.entries(obj).filter(([n]) => !n.endsWith('/')));

await test('나누기: 가장 바깥 manifest 가 둘 이상일 때만 · 한 확장(안쪽 작은 manifest 포함) · 맨 위 manifest · ZIP 아닌 것은 null', () => {
    assert.equal(B.splitZip(new Uint8Array(writeZip(files('quill-pad/', QUILL)))), null);
    assert.equal(B.splitZip(new Uint8Array(writeZip([...files('', MOSS), ...files('extra/', FERN)]))), null, 'root manifest owns everything');
    assert.equal(B.splitZip(new Uint8Array(Buffer.from('not a zip at all'))), null);
    assert.equal(B.splitZip(new Uint8Array(writeZip([{ name: 'a.txt', text: 'x' }]))), null);
    const parts = B.splitZip(new Uint8Array(bundle()));
    assert.deepEqual(parts.map(p => p.root), ['pebble-notes', 'quill-pad', 'moss-clock']);
    const wrapped = B.splitZip(new Uint8Array(writeZip([...files('my-bundle/pebble-notes/', PEBBLE), ...files('my-bundle/fern-map/', FERN)])));
    assert.deepEqual(wrapped.map(p => p.root), ['pebble-notes', 'fern-map']);
});

await test('나눈 ZIP 을 도우미가 그대로 읽는다: 파일 · 바이트 · 추천 이름 · deflate/저장 · 서술자 · 묶음 밖 README 는 빠짐' + (realYauzl ? ' (실리태번 yauzl 로도)' : ' (실리태번 yauzl 없음 — 작은 읽개만)'), async () => {
    const parts = B.splitZip(new Uint8Array(bundle()));
    for (const yauzl of readers) {
        for (const [p, want] of [[parts[0], PEBBLE], [parts[1], QUILL], [parts[2], MOSS]]) {
            const a = await readArchive(Buffer.from(p.bytes), yauzl);
            assert.equal(a.root, p.root);
            assert.deepEqual(Object.fromEntries([...a.files].map(([n, d]) => [n, d.toString('utf8')])), noDirs(want));
        }
    }
    const whole = await readArchive(Buffer.from(parts[1].bytes), mini);
    assert.equal(whole.manifest.display_name, 'Quill Pad', 'outer manifest wins over the nested tool');
    await assert.rejects(readArchive(bundle(), mini), /한 확장만 들어 있는 ZIP/, 'the unchanged helper alone refuses a bundle');
});

await test('고르기: .zip 아님 · 64MB 넘음은 목록에 이유와 함께 · ZIP 아닌 바이트는 원래 파일 그대로 · 묶음은 확장마다 · 출처 ZIP 이름', async () => {
    const plain = asFile(writeZip(files('fern-map-main/', FERN)), 'fern-map-main.zip');
    const items = await B.gather([asFile(bundle(), 'my-bundle.zip'), plain, { name: 'notes.rar', size: 3 }, { name: 'big.ZIP', size: 64 * 1024 ** 2 + 1 }]);
    assert.deepEqual(items.map(i => [i.name, i.source, !!i.blob, i.error || '']), [
        ['pebble-notes.zip', 'my-bundle.zip', true, ''], ['quill-pad.zip', 'my-bundle.zip', true, ''], ['moss-clock.zip', 'my-bundle.zip', true, ''],
        ['fern-map-main.zip', 'fern-map-main.zip', true, ''], ['notes.rar', 'notes.rar', false, '.zip 파일이 아니에요.'], ['big.ZIP', 'big.ZIP', false, 'ZIP은 64MB까지 넣을 수 있어요.'],
    ]);
    assert.equal(items[3].blob, plain, 'a single-extension ZIP is sent untouched');
});

await test('여러 ZIP + 묶음 ZIP: 확장마다 미리보기 → 모두 설치 → 정확한 바이트 · 업데이트는 백업하고 ZIP 에 없는 파일은 유지', async () => {
    const f = await fixture(), h = helper(f.base);
    await put(path.join(f.base, 'quill-pad'), { 'manifest.json': manifest('Quill Pad', '1.3.0'), 'index.js': 'old', 'data/keep.json': '{"keep":1}' });
    const items = await B.gather([asFile(bundle(), 'my-bundle.zip'), asFile(writeZip(files('fern-map-main/', FERN)), 'fern-map-main.zip')]);
    for (const item of items) await B.check(item, h.request);
    assert.deepEqual(items.map(i => [i.folder, i.preview.current?.version ?? null, i.preview.incoming.version, i.preview.replaced, i.preview.files - i.preview.replaced, i.preview.kept, i.preview.backupBytes > 0]), [
        ['pebble-notes', null, '2.0.0', 0, 3, 0, false], ['quill-pad', '1.3.0', '1.4.0', 2, 3, 1, true], ['moss-clock', null, '0.9.0', 0, 2, 0, false], ['fern-map', null, '3.0.0', 0, 2, 0, false],
    ]);
    assert.equal(B.blocked(items), false);
    const steps = [];
    const result = await B.installAll(items, h.request, (i, n) => steps.push(`${i}/${n}`));
    assert.deepEqual(steps, ['0/4', '1/4', '2/4', '3/4', '4/4']);
    assert.equal(result.ok.length, 4); assert.equal(result.failed.length, 0);
    assert.deepEqual(await tree(path.join(f.base, 'pebble-notes')), noDirs(PEBBLE));
    assert.deepEqual(await tree(path.join(f.base, 'quill-pad')), { ...noDirs(QUILL), 'data/keep.json': '{"keep":1}' });
    assert.deepEqual(await tree(path.join(f.base, 'moss-clock')), MOSS);
    assert.deepEqual(await tree(path.join(f.base, 'fern-map')), FERN);
    const backups = await h.installer.backups(f.base);
    assert.deepEqual(backups.map(b => [b.folder, b.manifest.version]), [['quill-pad', '1.3.0']], 'one backup, only for the update');
    assert.equal(result.ok.find(i => i.folder === 'quill-pad').result.backup, backups[0].id);
});

await test('같은 폴더가 두 번이면 막는다 (다른 ZIP 의 같은 확장 · 대소문자만 다른 폴더) — 설치 요청 없음', async () => {
    const f = await fixture(), h = helper(f.base);
    const items = await B.gather([asFile(writeZip(files('moss-clock/', MOSS)), 'moss-clock.zip'), asFile(writeZip([...files('Moss-Clock/', MOSS), ...files('fern-map/', FERN)]), 'two.zip')]);
    for (const item of items) await B.check(item, h.request);
    assert.deepEqual(B.duplicates(items).map(s => s.toLowerCase()), ['moss-clock']);
    assert.equal(B.blocked(items), true);
    h.calls.length = 0;
    const result = await B.installAll(items, h.request);
    assert.deepEqual(result, { ok: [], failed: [] });
    assert.equal(h.calls.length, 0, 'nothing sent while blocked');
    assert.deepEqual(await fs.readdir(f.base), []);
});

await test('하나가 실패해도 나머지는 설치: 확인 실패(js 없음) · 확인 뒤 폴더가 바뀜 · 설치 오류 → 끝에 성공/실패 한꺼번에', async () => {
    const f = await fixture();
    const broken = { 'manifest.json': manifest('Broken Leaf', '1.0.0'), 'readme.md': 'no js' };
    await put(path.join(f.base, 'moss-clock'), { 'manifest.json': manifest('Moss Clock', '0.8.0'), 'index.js': 'old' });
    let h = helper(f.base);
    const items = await B.gather([asFile(writeZip([...files('broken-leaf/', broken), ...files('moss-clock/', MOSS), ...files('fern-map/', FERN), ...files('pebble-notes/', PEBBLE)]), 'mixed.zip')]);
    for (const item of items) await B.check(item, h.request);
    assert.match(items[0].error, /js 파일이 없어요/);
    assert.equal(B.blocked(items), false, 'a broken item does not block the rest');
    // 확인 뒤 moss-clock 이 바뀜 → 그 확장만 멈춤, pebble-notes 는 도우미 오류
    await fs.writeFile(path.join(f.base, 'moss-clock/index.js'), 'changed meanwhile');
    h = helper(f.base, undefined, { '/install': body => { if (h.calls.at(-3)?.blob && items[3].blob === h.calls.at(-3).blob) throw new ZipError('파일 작업을 마치지 못했어요.'); } });
    const result = await B.installAll(items, h.request);
    assert.deepEqual(result.ok.map(i => i.folder), ['fern-map']);
    assert.deepEqual(result.failed.map(i => [i.name, i.error]), [
        ['moss-clock.zip', '확인한 뒤 확장 파일이 바뀌었어요. 다시 골라 주세요.'], ['pebble-notes.zip', '파일 작업을 마치지 못했어요.'], ['broken-leaf.zip', items[0].error],
    ]);
    assert.equal(await fs.readFile(path.join(f.base, 'moss-clock/index.js'), 'utf8'), 'changed meanwhile', 'changed folder left alone');
    assert.deepEqual(await tree(path.join(f.base, 'fern-map')), FERN);
    assert.ok(!(await fs.readdir(f.base)).includes('pebble-notes'));
    assert.equal(h.calls.filter(c => c.route === '/install').length, 2, 'moss stopped before /install');
});

await test('폴더를 골라야 하는 확장: 추천이 여럿이면 고를 때까지 막고 · 고르면 그 폴더로 · 새 폴더도 됨', async () => {
    const f = await fixture(), h = helper(f.base);
    await put(path.join(f.base, 'fern'), { 'manifest.json': manifest('Fern Map', '2.0.0'), 'index.js': 'a' });
    await put(path.join(f.base, 'fern-old'), { 'manifest.json': manifest('Fern Map', '1.0.0'), 'index.js': 'b' });
    const items = await B.gather([asFile(writeZip([...files('fern-map/', FERN), ...files('moss-clock/', MOSS)]), 'pair.zip')]);
    for (const item of items) await B.check(item, h.request);
    assert.equal(items[0].preview, null); assert.deepEqual(items[0].plan.matches.map(m => m.folder).sort(), ['fern', 'fern-old']);
    assert.equal(B.blocked(items), true);
    items[0].choice = 'fern-old'; await B.check(items[0], h.request);
    assert.equal(items[0].preview.current.version, '1.0.0');
    items[0].choice = '@new'; await B.check(items[0], h.request);
    assert.equal(items[0].folder, 'fern-map'); assert.equal(items[0].preview.current, null);
    assert.equal(B.blocked(items), false);
    assert.equal((await B.installAll(items, h.request)).ok.length, 2);
    assert.equal(await fs.readFile(path.join(f.base, 'fern/index.js'), 'utf8'), 'a');
});

await test('옛 도우미 1.1.0 그대로: 사용자마다 확인 표 하나 — 설치마다 다시 확인해 방금 받은 표만 보낸다 · 화면이 기대하는 판 = 서버 판', async () => {
    const source = readFileSync(path.join(root, 'src/addons/zipinstall/index.js'), 'utf8');
    assert.equal(/const HELPER_VERSION = '([^']+)'/.exec(source)?.[1], server.VERSION);
    const f = await fixture(), h = helper(f.base);
    const items = await B.gather([asFile(bundle(), 'my-bundle.zip')]);
    for (const item of items) await B.check(item, h.request);
    // 도우미는 새 확인이 오면 같은 사용자의 이전 표를 버린다 — 미리보기 때 받은 표로는 설치할 수 없다
    const stale = h.calls.find(c => c.route === '/preview').body.token;
    await assert.rejects(h.installer.install(f.base, 'admin', stale), /확인 시간이 지났어요/);
    h.calls.length = 0;
    const tokens = [];
    const tracking = async (route, body, blob) => { const r = await h.request(route, body, blob); if (route.startsWith('/inspect')) tokens.push(r.token); return r; };
    assert.equal((await B.installAll(items, tracking)).ok.length, 3);
    assert.deepEqual(h.calls.map(c => c.route), ['/inspect', '/preview', '/install', '/inspect', '/preview', '/install', '/inspect', '/preview', '/install']);
    h.calls.filter(c => c.route !== '/inspect').forEach((c, i) => assert.equal(c.body.token, tokens[Math.floor(i / 2)]));
    assert.equal(h.installer.plans.size, 0, 'no plan left behind');
});

await test('테마 자신 삭제 보호는 그대로 · 나눈 ZIP 이름에 경로가 섞이지 않음', async () => {
    const f = await fixture(), h = helper(f.base);
    await put(path.join(f.base, 'blue-lemonade'), { 'manifest.json': manifest('Blue Lemonade', '7.0.2'), 'index.js': '//' });
    await assert.rejects(h.installer.removalPreview(f.base, 'admin', 'blue-lemonade'), /블루레몬에이드는 이 화면에서 삭제할 수 없어요/);
    const parts = B.splitZip(new Uint8Array(writeZip([...files('a/b/moss-clock/', MOSS), ...files('a/b/fern-map/', FERN)])));
    assert.deepEqual(parts.map(p => p.root), ['moss-clock', 'fern-map']);
});

for (const dir of temps) await fs.rm(dir, { recursive: true, force: true });
console.log(`zipinstall-batch: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
