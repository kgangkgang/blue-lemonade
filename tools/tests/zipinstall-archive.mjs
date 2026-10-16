// ZIP 설치 서버 도우미 — 압축 읽기와 이름 검사 (server-plugin/blue-lemonade-zip/archive.mjs)
//   node tools/tests/zipinstall-archive.mjs <테마 루트>
// 실제 yauzl 은 실리태번 본체에만 있어 CI 에 없다 → 항목 목록(JSON)을 그대로 내주는 가짜 yauzl 을 넣는다 (readArchive 가 yauzl 을 인자로 받는다).
// 확인하는 것:
//   1) safePath · folderName: 위로 올라가기(..) · 절대 경로 · 드라이브 · 예약 이름(con, com1 …) · 끝 점/공백 · .git · 조절 문자 · 정규화 안 된 이름은 막고,
//      역슬래시는 / 로 바꾼다. 설치 폴더는 한 겹 · 점으로 시작 안 함 · 100자까지
//   2) manifestOf: 실리태번 확장 manifest 만 · js/css 가 실제로 ZIP 안에 있어야 함 · 긴 글은 자른다 · BOM 허용
//   3) readArchive: 폴더가 한 겹 더 있어도 벗기고 root 이름을 알려 줌 · 묶음 안의 manifest 는 바깥 것 하나만 · 두 확장이 섞이면 거절
//   4) 링크 · 암호 · 대소문자만 다른 이름 · 파일/폴더 이름 겹침 · CRC/크기 불일치 · 크기 상한(파일 32MB · 전체 128MB · ZIP 64MB) · 항목 8000개 상한
// 지어낸 확장 이름과 글만 쓴다. 디스크에 쓰지 않는다.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const root = path.resolve(process.argv[2] || '.');
const A = await import(pathToFileURL(path.join(root, 'server-plugin/blue-lemonade-zip/archive.mjs')).href);
const { safePath, folderName, manifestOf, readArchive, ZipError, LIMITS } = A;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── 가짜 yauzl: buffer = 항목 목록 JSON. 내용은 읽을 때 만든다 (큰 파일은 { fill, length })
const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); return n >>> 0; });
const crcOf = buf => (typeof zlib.crc32 === 'function' ? zlib.crc32(buf) : (() => { let c = 0xffffffff; for (const b of buf) c = (c >>> 8) ^ table[(c ^ b) & 255]; return (c ^ 0xffffffff) >>> 0; })());
const bytesOf = spec => (spec.fill !== undefined ? Buffer.alloc(spec.length, spec.fill) : Buffer.from(spec.text ?? '', 'utf8'));
const FILE = 0x8000, DIR = 0x4000, LINK = 0xa000;
/** 항목: { name, text } · { name, fill, length } · { name: 'dir/', dir: true } · type/flag/size/crc 로 덮어쓰기 */
function zipOf(items) {
    return Buffer.from(JSON.stringify(items.map(item => {
        const dir = item.name.endsWith('/');
        const data = dir ? Buffer.alloc(0) : bytesOf(item);
        return {
            fileName: item.name,
            externalFileAttributes: (((item.type ?? (dir ? DIR : FILE)) | 0o644) << 16) >>> 0,
            generalPurposeBitFlag: item.flag ?? 0,
            uncompressedSize: item.size ?? data.length,
            crc32: item.crc ?? crcOf(data),
            spec: dir ? { text: '' } : (item.fill !== undefined ? { fill: item.fill, length: item.actual ?? item.length } : { text: item.actualText ?? item.text ?? '' }),
        };
    })), 'utf8');
}
const yauzl = {
    calls: 0, options: null, closed: 0,
    fromBuffer(buffer, options, cb) {
        this.calls++; this.options = options;
        let list;
        try { list = JSON.parse(buffer.toString('utf8')); } catch { return cb(new Error('not a zip')); }
        const zip = new EventEmitter();
        let i = 0, closed = false;
        zip.readEntry = () => setImmediate(() => { if (closed) return; if (i >= list.length) zip.emit('end'); else zip.emit('entry', list[i++]); });
        zip.openReadStream = (entry, done) => setImmediate(() => done(null, Readable.from([bytesOf(entry.spec)])));
        zip.close = () => { closed = true; yauzl.closed++; };
        cb(null, zip);
    },
};
const manifest = (extra = {}) => JSON.stringify({ display_name: 'Pebble Notes', version: '2.0.1', js: 'index.js', ...extra });
const rejects = (promise, re, status) => assert.rejects(promise, e => { assert.ok(e instanceof ZipError, 'ZipError: ' + e); assert.match(e.message, re); if (status) assert.equal(e.status, status); return true; });

await test('safePath: 올라가기 · 절대 경로 · 드라이브 · 예약 이름 · 끝 점/공백 · .git · 조절 문자 · 정규화 안 된 이름을 막는다', () => {
    const bad = ['', '../evil.js', 'a/../../b.js', 'a/./b.js', 'a//b.js', '/etc/x', '\\\\server\\x', 'C:\\Windows\\x.js', 'C:x.js', 'a\\..\\b.js',
        'con', 'CON.txt', 'nul.js', 'aux/x.js', 'com1.js', 'LPT9', 'com\u00b9.js', 'name.', 'dir./x.js', 'trailing ', 'a/ b /c',
        '.git/config', 'sub/.GIT/HEAD', 'bad\u0000name', 'tab\tname', 'q?.js', 'star*.js', 'pipe|x', '<x>.js', 'e\u0301.js', 'x'.repeat(221), 42, null];
    for (const value of bad) assert.throws(() => safePath(value), ZipError, JSON.stringify(value));
});

await test('safePath: 보통 이름은 그대로 · 역슬래시는 / 로 · .github 같은 점 폴더 · 한글(NFC) 은 된다', () => {
    assert.equal(safePath('src/index.js'), 'src/index.js');
    assert.equal(safePath('src\\lib\\util.js'), 'src/lib/util.js');
    assert.equal(safePath('.github/workflows/ci.yml'), '.github/workflows/ci.yml');
    assert.equal(safePath('문서/설명.md'), '문서/설명.md');
    assert.equal(safePath('two words/console.log.js'), 'two words/console.log.js');
    assert.equal(safePath('x'.repeat(220)), 'x'.repeat(220));
});

await test('folderName: 한 겹 · 점으로 시작하지 않음 · 100자까지', () => {
    assert.equal(folderName('pebble-notes'), 'pebble-notes');
    assert.equal(folderName('Pebble Notes 2'), 'Pebble Notes 2');
    assert.equal(folderName('x'.repeat(100)), 'x'.repeat(100));
    for (const value of ['a/b', 'a\\b', '.hidden', '..', '.', 'x'.repeat(101), '', 'con', 'name.']) assert.throws(() => folderName(value), ZipError, value);
});

await test('manifestOf: BOM 허용 · 이름 다듬기 · 긴 author/homePage 자르기 · 문자열 아닌 author 버림', () => {
    const files = new Map([['index.js', Buffer.from('')], ['style.css', Buffer.from('')]]);
    const m = manifestOf(Buffer.from('\uFEFF' + manifest({ display_name: '  Pebble Notes  ', css: 'style.css', author: 'a'.repeat(300), homePage: 'https://example.test/' + 'p'.repeat(600) })), files);
    assert.deepEqual(Object.keys(m).sort(), ['author', 'display_name', 'homePage', 'version']);
    assert.equal(m.display_name, 'Pebble Notes'); assert.equal(m.version, '2.0.1');
    assert.equal(m.author.length, 160); assert.equal(m.homePage.length, 500);
    assert.equal(manifestOf(Buffer.from(manifest({ author: { name: 'x' } })), files).author, '');
    const cssOnly = manifestOf(Buffer.from(JSON.stringify({ display_name: 'Only Style', version: '1', css: 'style.css' })), files);
    assert.equal(cssOnly.display_name, 'Only Style');
});

await test('manifestOf: 확장 manifest 가 아니면 · 버전이 없으면 · js/css 가 없거나 ZIP 에 없으면 · 경로가 위험하면 거절', () => {
    const files = new Map([['index.js', Buffer.from('')]]);
    const bad = [
        ['{not json', /읽을 수 없어요/], ['[]', /manifest\.json이 아니에요/], ['null', /manifest\.json이 아니에요/],
        [JSON.stringify({ display_name: '   ', version: '1', js: 'index.js' }), /아니에요/],
        [JSON.stringify({ display_name: 'x'.repeat(161), version: '1', js: 'index.js' }), /아니에요/],
        [JSON.stringify({ display_name: 'Pebble', version: 3, js: 'index.js' }), /버전/],
        [JSON.stringify({ display_name: 'Pebble', version: 'v'.repeat(81), js: 'index.js' }), /버전/],
        [JSON.stringify({ display_name: 'Pebble', version: '1' }), /JS 또는 CSS/],
        [JSON.stringify({ display_name: 'Pebble', version: '1', js: 'missing.js' }), /js 파일이 없어요/],
        [JSON.stringify({ display_name: 'Pebble', version: '1', js: 'index.js', css: 'gone.css' }), /css 파일이 없어요/],
        [JSON.stringify({ display_name: 'Pebble', version: '1', js: '../index.js' }), /안전하지 않은/],
    ];
    for (const [text, re] of bad) assert.throws(() => manifestOf(Buffer.from(text), files), e => e instanceof ZipError && re.test(e.message), text);
});

await test('readArchive: 한 겹 더 감싼 폴더를 벗기고 root 를 알려 준다 · 폴더 항목 · 바깥 파일은 뺀다 · yauzl 옵션', async () => {
    const zip = zipOf([
        { name: 'pebble-notes-main/' }, { name: 'pebble-notes-main/manifest.json', text: manifest() },
        { name: 'pebble-notes-main/index.js', text: 'export const memo = "가상 메모";' }, { name: 'pebble-notes-main/lib/' },
        { name: 'pebble-notes-main/lib/util.js', text: 'export {};' }, { name: 'stray-readme.txt', text: 'outside' },
    ]);
    const r = await readArchive(zip, yauzl);
    assert.equal(r.root, 'pebble-notes-main');
    assert.deepEqual([...r.files.keys()].sort(), ['index.js', 'lib/util.js', 'manifest.json']);
    assert.equal(r.files.get('index.js').toString('utf8'), 'export const memo = "가상 메모";');
    assert.equal(r.manifest.display_name, 'Pebble Notes');
    assert.equal(r.size, [...r.files.values()].reduce((n, b) => n + b.length, 0));
    assert.equal(yauzl.options.lazyEntries, true); assert.equal(yauzl.options.validateEntrySizes, true);
    const flat = await readArchive(zipOf([{ name: 'manifest.json', text: manifest() }, { name: 'index.js', text: '' }]), yauzl);
    assert.equal(flat.root, ''); assert.deepEqual([...flat.files.keys()].sort(), ['index.js', 'manifest.json']);
});

await test('readArchive: 묶음 안의 manifest 는 바깥 것 하나만 확장으로 본다 · 나란한 두 확장은 거절 · manifest 가 없으면 거절', async () => {
    const r = await readArchive(zipOf([
        { name: 'suite/manifest.json', text: manifest() }, { name: 'suite/index.js', text: '' },
        { name: 'suite/addons/inner/manifest.json', text: manifest({ display_name: 'Inner Part' }) }, { name: 'suite/addons/inner/index.js', text: '' },
    ]), yauzl);
    assert.equal(r.manifest.display_name, 'Pebble Notes');
    assert.ok(r.files.has('addons/inner/manifest.json'));
    await rejects(readArchive(zipOf([
        { name: 'one/manifest.json', text: manifest() }, { name: 'one/index.js', text: '' },
        { name: 'two/manifest.json', text: manifest() }, { name: 'two/index.js', text: '' },
    ]), yauzl), /한 확장만/);
    await rejects(readArchive(zipOf([{ name: 'index.js', text: '' }]), yauzl), /한 확장만/);
});

await test('readArchive: 위험한 항목은 하나만 있어도 전체를 거절한다 (올라가기 · .git · 링크 · 암호 · 대소문자 겹침 · 파일/폴더 겹침)', async () => {
    const ok = [{ name: 'manifest.json', text: manifest() }, { name: 'index.js', text: '' }];
    const cases = [
        [[{ name: '../outside.js', text: 'x' }], /안전하지 않은/],
        [[{ name: 'sub/../../outside.js', text: 'x' }], /안전하지 않은/],
        [[{ name: '/abs.js', text: 'x' }], /안전하지 않은/],
        [[{ name: '.git/config', text: 'x' }], /\.git 폴더/],
        [[{ name: 'link.js', text: '/etc/passwd', type: LINK }], /링크나 특수/],
        [[{ name: 'folder', text: '', type: DIR }], /파일과 폴더 정보/],
        [[{ name: 'secret.js', text: 'x', flag: 1 }], /암호 없는/],
        [[{ name: 'INDEX.js', text: 'x' }], /이름이 겹치는/],
        [[{ name: 'lib', text: 'x' }, { name: 'lib/a.js', text: 'y' }], /파일과 폴더의 이름이 겹쳐요/],
    ];
    for (const [extra, re] of cases) {
        const before = yauzl.closed;
        await rejects(readArchive(zipOf([...ok, ...extra]), yauzl), re);
        assert.equal(yauzl.closed, before + 1, 'zip closed after failure: ' + extra[0].name);
    }
});

await test('readArchive: CRC 가 다르거나 · 실제 내용이 적힌 크기보다 길거나 짧으면 손상으로 거절', async () => {
    const base = [{ name: 'manifest.json', text: manifest() }];
    await rejects(readArchive(zipOf([...base, { name: 'index.js', text: 'abc', crc: 12345 }]), yauzl), /손상/);
    await rejects(readArchive(zipOf([...base, { name: 'index.js', text: 'abc', actualText: 'abcdefghij' }]), yauzl), /크기 정보/);
    await rejects(readArchive(zipOf([...base, { name: 'index.js', text: 'abcdef', actualText: 'abc' }]), yauzl), /손상/);
});

await test('readArchive: ZIP 64MB · 파일 하나 32MB · 풀린 전체 128MB · 항목 8000개 상한 (413)', async () => {
    const calls = yauzl.calls;
    await rejects(readArchive(Buffer.alloc(LIMITS.zip + 1), yauzl), /64MB/, 413);
    await rejects(readArchive('not a buffer', yauzl), /64MB/, 413);
    assert.equal(yauzl.calls, calls, 'yauzl is not called for an oversized upload');
    await rejects(readArchive(zipOf([{ name: 'manifest.json', text: manifest() }, { name: 'index.js', text: '', size: LIMITS.file + 1 }]), yauzl), /너무 커요/, 413);
    const quarter = LIMITS.expanded / 4;
    assert.equal(quarter, LIMITS.file);
    const big = [0, 1, 2, 3].map(n => ({ name: `blob${n}.bin`, fill: n, length: quarter }));
    await rejects(readArchive(zipOf([{ name: 'manifest.json', text: manifest() }, { name: 'index.js', text: '' }, ...big]), yauzl), /너무 커요/, 413);
    const many = Array.from({ length: LIMITS.entries - 1 }, (_, n) => ({ name: `d/${n}.txt`, text: '' }));
    await rejects(readArchive(zipOf([{ name: 'manifest.json', text: manifest() }, { name: 'index.js', text: '' }, ...many]), yauzl), /8,000개/);
    const r = await readArchive(zipOf([{ name: 'manifest.json', text: manifest() }, { name: 'index.js', text: '' }, ...many.slice(1)]), yauzl);
    assert.equal(r.files.size, LIMITS.entries);
});

await test('readArchive: yauzl 이 못 읽으면 친절한 오류 (내부 오류 글을 그대로 내보내지 않는다)', async () => {
    await rejects(readArchive(Buffer.from('plain text, not a zip'), yauzl), /ZIP을 읽지 못했어요/);
});

console.log(`zipinstall-archive: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
