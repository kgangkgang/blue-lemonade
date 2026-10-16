// ZIP 설치 서버 도우미 — 설치 · 업데이트 · 백업 복원 · 서버 경로 지키기 (server-plugin/blue-lemonade-zip/install.mjs · index.mjs)
//   node tools/tests/zipinstall-install.mjs <테마 루트>
// 삭제/삭제 복원은 zipinstall-remove.mjs 가 본다. 여기서는 ZIP 으로 설치 · 덮어쓰기 · 그 백업 되돌리기와 라우터 관문을 본다.
// 실제 yauzl 대신 항목 목록(JSON)을 내주는 가짜 yauzl. 라우터는 use/get/post 를 적어 두는 가짜, 요청은 Readable 에 사용자 정보를 붙인 가짜.
// 확인하는 것:
//   1) 새 설치: 정확한 바이트 · 백업 없음 · 작업(stage) 폴더가 남지 않음 · 같은 표로 두 번 설치 못 함
//   2) 업데이트: 저장소 주소로 기존 폴더 추천 · 교체/추가/유지 수 · ZIP 에 없는 확장 데이터와 .git 은 그대로 · 이전 판 통째로 백업 · 채팅/설정은 안 건드림
//   3) 백업 복원: 설치 전 상태로 정확히(새로 생긴 파일도 빠짐) · 지금 상태를 먼저 백업 · 옛 백업은 남김
//   4) 확인 뒤 폴더가 바뀌면 · 이름/구조가 충돌하면 · 확장 아닌 폴더 · 위험한 폴더 이름이면 쓰지 않음
//   5) 옮기는 중 실패하면 원래 폴더 그대로 · 멈춘 설치 기록은 다음 접근 때 정리 (새 판을 덮지 않음)
//   6) 추천 폴더 이름 · 표(plan) 주인 · 동시 확인 상한
//   7) 라우터: 관리자 · X-BL-Zip 머리 · 다른 사이트 요청 막기 · no-store · ZIP 형식/크기 · 동시 업로드 · 내부 오류는 일반 문구(500)
// 임시 폴더는 os.tmpdir() 아래에 만들고 끝에 지운다. 지어낸 확장 이름과 글만 쓴다.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const root = path.resolve(process.argv[2] || '.');
const plugin = path.join(root, 'server-plugin/blue-lemonade-zip');
const { readArchive, LIMITS } = await import(pathToFileURL(path.join(plugin, 'archive.mjs')).href);
const { Installer } = await import(pathToFileURL(path.join(plugin, 'install.mjs')).href);
const server = await import(pathToFileURL(path.join(plugin, 'index.mjs')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok   ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── 가짜 yauzl (zipinstall-archive.mjs 와 같은 꼴)
const table = Array.from({ length: 256 }, (_, n) => { for (let i = 0; i < 8; i++) n = (n >>> 1) ^ (n & 1 ? 0xedb88320 : 0); return n >>> 0; });
const crcOf = buf => (typeof zlib.crc32 === 'function' ? zlib.crc32(buf) : (() => { let c = 0xffffffff; for (const b of buf) c = (c >>> 8) ^ table[(c ^ b) & 255]; return (c ^ 0xffffffff) >>> 0; })());
/** { '경로': '내용' } → 가짜 ZIP 바이트 */
function zipOf(files) {
    return Buffer.from(JSON.stringify(Object.entries(files).map(([fileName, text]) => {
        const data = Buffer.from(text, 'utf8');
        return { fileName, externalFileAttributes: ((0x8000 | 0o644) << 16) >>> 0, generalPurposeBitFlag: 0, uncompressedSize: data.length, crc32: crcOf(data), text };
    })), 'utf8');
}
const yauzl = {
    fromBuffer(buffer, options, cb) {
        let list;
        try { list = JSON.parse(buffer.toString('utf8')); } catch { return cb(new Error('not a zip')); }
        const zip = new EventEmitter();
        let i = 0, closed = false;
        zip.readEntry = () => setImmediate(() => { if (closed) return; if (i >= list.length) zip.emit('end'); else zip.emit('entry', list[i++]); });
        zip.openReadStream = (entry, done) => setImmediate(() => done(null, Readable.from([Buffer.from(entry.text, 'utf8')])));
        zip.close = () => { closed = true; };
        cb(null, zip);
    },
};
const make = (options = {}) => new Installer({ yauzl, readArchive, ...options });

// ── 임시 폴더
const temps = [];
async function fixture() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bl-zip-install-'));
    temps.push(dir);
    const base = path.join(dir, 'extensions');
    await fs.mkdir(base);
    await fs.writeFile(path.join(dir, 'settings.json'), 'separate settings');
    await fs.mkdir(path.join(dir, 'chats'));
    await fs.writeFile(path.join(dir, 'chats/sample.jsonl'), 'separate chat');
    return { dir, base, vault: path.join(dir, '.blue-lemonade-zip') };
}
async function put(dir, files) {
    for (const [name, text] of Object.entries(files)) {
        await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true });
        await fs.writeFile(path.join(dir, name), text);
    }
}
async function tree(dir) {
    const out = {};
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, item.name);
        if (item.isDirectory()) for (const [n, d] of Object.entries(await tree(p))) out[item.name + '/' + n] = d;
        else out[item.name] = await fs.readFile(p, 'utf8');
    }
    return out;
}
const present = p => fs.access(p).then(() => true, () => false);
const stages = async vault => (await present(vault) ? (await fs.readdir(vault)).filter(n => n.startsWith('stage-')) : []);
const untouched = async ({ dir }) => {
    assert.equal(await fs.readFile(path.join(dir, 'settings.json'), 'utf8'), 'separate settings');
    assert.equal(await fs.readFile(path.join(dir, 'chats/sample.jsonl'), 'utf8'), 'separate chat');
};
const manifest = (extra = {}) => JSON.stringify({ display_name: 'Pebble Notes', version: '1.0.0', js: 'index.js', ...extra });
const ORIGINAL = {
    'manifest.json': manifest({ display_name: 'Pebble Notes Fork', homePage: 'https://github.com/example-dev/pebble-notes' }),
    'index.js': 'export const edition = "old";',
    'data/memo.json': '{"memo":"가상 사용자 메모"}',
    '.git/config': 'saved git metadata',
};
const UPDATE = {
    'pebble-notes-main/manifest.json': manifest({ version: '1.1.0', homePage: 'https://github.com/Example-Dev/pebble-notes.git' }),
    'pebble-notes-main/index.js': 'export const edition = "new";',
    'pebble-notes-main/lib/extra.js': 'export const extra = true;',
};

await test('새 설치: -main 을 뗀 이름 추천 · 정확한 바이트 · 백업 없음 · 작업 폴더가 남지 않음 · 같은 표로 두 번 설치 못 함', async () => {
    const f = await fixture(), m = make();
    const zip = { 'pebble-notes-main/manifest.json': manifest(), 'pebble-notes-main/index.js': 'export const memo = "새 메모";', 'pebble-notes-main/img/icon.svg': '<svg/>' };
    const plan = await m.inspect(f.base, 'alice', zipOf(zip), 'pebble-notes-main.zip');
    assert.equal(plan.suggested, 'pebble-notes'); assert.deepEqual(plan.matches, []); assert.deepEqual(plan.installed, []);
    assert.equal(plan.count, 3); assert.equal(plan.manifest.display_name, 'Pebble Notes');
    const preview = await m.preview(f.base, 'alice', plan.token, 'pebble-notes');
    assert.deepEqual({ current: preview.current, files: preview.files, replaced: preview.replaced, kept: preview.kept, backupBytes: preview.backupBytes }, { current: null, files: 3, replaced: 0, kept: 0, backupBytes: 0 });
    assert.equal(await present(path.join(f.base, 'pebble-notes')), false, 'preview writes nothing');
    const result = await m.install(f.base, 'alice', plan.token);
    assert.deepEqual(result, { folder: 'pebble-notes', backup: null, reload: true });
    assert.deepEqual(await tree(path.join(f.base, 'pebble-notes')), { 'manifest.json': manifest(), 'index.js': 'export const memo = "새 메모";', 'img/icon.svg': '<svg/>' });
    assert.deepEqual(await stages(f.vault), []);
    assert.deepEqual(await m.backups(f.base), []);
    await assert.rejects(m.install(f.base, 'alice', plan.token), /확인 시간이 지났어요/);
    await untouched(f);
});

let updated = null;
await test('업데이트: 저장소 주소로 기존 폴더 추천 · ZIP 에 없는 데이터와 .git 유지 · 이전 판 통째로 백업 · 채팅/설정 그대로', async () => {
    const f = await fixture(), m = make(), target = path.join(f.base, 'pebble');
    await put(target, ORIGINAL);
    await put(path.join(f.base, 'other-tool'), { 'manifest.json': manifest({ display_name: 'Other Tool' }), 'index.js': '' });
    const plan = await m.inspect(f.base, 'alice', zipOf(UPDATE), 'download.zip');
    assert.deepEqual(plan.matches.map(x => x.folder), ['pebble'], 'matched by GitHub repository (case and .git ignored)');
    const preview = await m.preview(f.base, 'alice', plan.token, 'pebble');
    assert.equal(preview.current.version, '1.0.0'); assert.equal(preview.incoming.version, '1.1.0');
    assert.equal(preview.files, 3); assert.equal(preview.replaced, 2); assert.equal(preview.kept, 2);
    const oldBytes = Object.values(ORIGINAL).reduce((n, t) => n + Buffer.byteLength(t), 0);
    assert.equal(preview.backupBytes, oldBytes);
    const result = await m.install(f.base, 'alice', plan.token);
    assert.match(result.backup, /^[a-f0-9-]{36}$/);
    assert.deepEqual(await tree(target), {
        'manifest.json': manifest({ version: '1.1.0', homePage: 'https://github.com/Example-Dev/pebble-notes.git' }),
        'index.js': 'export const edition = "new";', 'lib/extra.js': 'export const extra = true;',
        'data/memo.json': ORIGINAL['data/memo.json'], '.git/config': 'saved git metadata',
    });
    const list = await m.backups(f.base);
    assert.equal(list.length, 1);
    assert.deepEqual({ id: list[0].id, folder: list[0].folder, action: list[0].action, version: list[0].manifest.version, bytes: list[0].bytes }, { id: result.backup, folder: 'pebble', action: 'install', version: '1.0.0', bytes: oldBytes });
    assert.deepEqual(await tree(path.join(f.vault, result.backup, 'files')), ORIGINAL, 'the backup is the whole previous folder');
    assert.equal(JSON.parse(await fs.readFile(path.join(f.vault, result.backup, 'record.json'), 'utf8')).pending, false);
    assert.deepEqual(await stages(f.vault), []);
    assert.equal(await fs.readFile(path.join(f.base, 'other-tool/manifest.json'), 'utf8'), manifest({ display_name: 'Other Tool' }));
    await untouched(f);
    updated = { f, target, backup: result.backup };
});

await test('백업 복원: 설치 전 상태로 정확히 (새 파일도 빠짐) · 지금 상태를 먼저 백업 · 옛 백업은 남김 · 재시작 뒤에도', async () => {
    assert.ok(updated, 'needs the update case');
    const { f, target, backup } = updated, m = make();
    const before = await tree(target);
    const result = await m.restore(f.base, backup);
    assert.equal(result.folder, 'pebble'); assert.match(result.backup, /^[a-f0-9-]{36}$/); assert.notEqual(result.backup, backup);
    assert.deepEqual(await tree(target), ORIGINAL);
    const list = await make().backups(f.base);
    assert.deepEqual(list.map(b => b.action).sort(), ['install', 'restore']);
    assert.deepEqual(await tree(path.join(f.vault, result.backup, 'files')), before, 'the replaced 1.1.0 state is kept');
    assert.deepEqual(await tree(path.join(f.vault, backup, 'files')), ORIGINAL, 'restoring does not consume the backup');
    assert.deepEqual(await stages(f.vault), []);
    await untouched(f);
});

await test('확인한 뒤 폴더가 바뀌면 설치를 거절하고 아무것도 옮기지 않는다', async () => {
    const f = await fixture(), m = make(), target = path.join(f.base, 'pebble');
    await put(target, ORIGINAL);
    const plan = await m.inspect(f.base, 'alice', zipOf(UPDATE), 'x.zip');
    await m.preview(f.base, 'alice', plan.token, 'pebble');
    await fs.writeFile(path.join(target, 'data/memo.json'), '{"memo":"미리보기 뒤에 고친 메모"}');
    await assert.rejects(m.install(f.base, 'alice', plan.token), /바뀌었어요/);
    assert.deepEqual(await tree(target), { ...ORIGINAL, 'data/memo.json': '{"memo":"미리보기 뒤에 고친 메모"}' });
    assert.deepEqual(await m.backups(f.base), []);
    assert.deepEqual(await stages(f.vault), []);
    const noPreview = await m.inspect(f.base, 'alice', zipOf(UPDATE), 'x.zip');
    await assert.rejects(m.install(f.base, 'alice', noPreview.token), /먼저 확인/);
});

await test('충돌 · 확장 아닌 폴더 · 위험한 폴더 이름은 미리보기에서 막는다 (밖에 아무것도 만들지 않음)', async () => {
    const f = await fixture(), m = make(), target = path.join(f.base, 'pebble');
    await put(target, { ...ORIGINAL, notes: 'a plain file' });
    await put(path.join(f.base, 'plain-folder'), { 'readme.txt': 'not an extension' });
    const conflicts = [
        { 'manifest.json': manifest({ js: 'Index.js' }), 'Index.js': '' },
        { 'manifest.json': manifest(), 'index.js': '', data: 'file where a folder is' },
        { 'manifest.json': manifest(), 'index.js': '', 'notes/a.txt': 'folder where a file is' },
        { 'manifest.json': manifest(), 'index.js': '', 'DATA/memo.json': 'case of an existing folder' },
    ];
    for (const files of conflicts) {
        const plan = await m.inspect(f.base, 'alice', zipOf(files), 'x.zip');
        await assert.rejects(m.preview(f.base, 'alice', plan.token, 'pebble'), /충돌/, Object.keys(files).join(','));
    }
    const plan = await m.inspect(f.base, 'alice', zipOf(UPDATE), 'x.zip');
    await assert.rejects(m.preview(f.base, 'alice', plan.token, 'PEBBLE'), /기존 폴더 이름 그대로 골라 주세요: pebble/);
    await assert.rejects(m.preview(f.base, 'alice', plan.token, 'plain-folder'), /실리태번 확장이 아니어서/);
    for (const folder of ['../escape', 'a/b', '.hidden', '', 'con', 'trail.']) await assert.rejects(m.preview(f.base, 'alice', plan.token, folder), undefined, folder);
    assert.equal(await present(path.join(f.dir, 'escape')), false);
    await assert.rejects(m.install(f.base, 'alice', plan.token), /먼저 확인/, 'a rejected preview leaves no selection');
    assert.deepEqual(await tree(target), { ...ORIGINAL, notes: 'a plain file' });
});

await test('옮기는 중 실패하면 원래 폴더 그대로 · 반쪽 백업은 목록에 없음 · 작업 폴더 정리 (새 설치도 흔적 없음)', async () => {
    const f = await fixture(), target = path.join(f.base, 'pebble');
    await put(target, ORIGINAL);
    const m = make({ beforePublish: () => { throw Error('simulated move failure'); } });
    const plan = await m.inspect(f.base, 'alice', zipOf(UPDATE), 'x.zip');
    await m.preview(f.base, 'alice', plan.token, 'pebble');
    await assert.rejects(m.install(f.base, 'alice', plan.token), /simulated move failure/);
    assert.deepEqual(await tree(target), ORIGINAL);
    assert.deepEqual(await m.backups(f.base), []);
    assert.deepEqual(await stages(f.vault), []);
    const fresh = await m.inspect(f.base, 'alice', zipOf({ 'manifest.json': manifest({ display_name: 'Fresh One' }), 'index.js': '' }), 'fresh-one.zip');
    await m.preview(f.base, 'alice', fresh.token, 'fresh-one');
    await assert.rejects(m.install(f.base, 'alice', fresh.token), /simulated/);
    assert.equal(await present(path.join(f.base, 'fresh-one')), false);
    assert.deepEqual(await stages(f.vault), []);
});

await test('멈춘 설치 기록: 새 판과 백업이 둘 다 있으면 새 판을 덮지 않고 백업만 확정 · 새 판이 없으면 이전 판을 되살림', async () => {
    const f = await fixture(), target = path.join(f.base, 'pebble');
    await fs.mkdir(f.vault, { recursive: true });
    const NEW = { 'manifest.json': manifest({ version: '1.1.0' }), 'index.js': 'export const edition = "new";' };
    await put(target, NEW);
    const both = path.join(f.vault, randomUUID());
    await put(path.join(both, 'files'), ORIGINAL);
    await fs.writeFile(path.join(both, 'record.json'), JSON.stringify({ folder: 'pebble', date: new Date(Date.now() - 1000).toISOString(), manifest: { display_name: 'Pebble Notes Fork', version: '1.0.0' }, bytes: 10, action: 'install', pending: true }));
    const list = await make().backups(f.base);
    assert.deepEqual(await tree(target), NEW, 'the finished update is not overwritten');
    assert.deepEqual(list.map(b => [b.id, b.action]), [[path.basename(both), 'install']]);
    const record = JSON.parse(await fs.readFile(path.join(both, 'record.json'), 'utf8'));
    assert.equal(record.pending, false); assert.equal(record.recovered, undefined);
    await fs.rm(target, { recursive: true });
    const lost = path.join(f.vault, randomUUID());
    await put(path.join(lost, 'files'), ORIGINAL);
    await fs.writeFile(path.join(lost, 'record.json'), JSON.stringify({ folder: 'pebble', date: new Date().toISOString(), action: 'install', pending: true }));
    await make().manageable(f.base);
    assert.deepEqual(await tree(target), ORIGINAL, 'interrupted before the new folder moved in: the old one comes back');
    assert.equal(JSON.parse(await fs.readFile(path.join(lost, 'record.json'), 'utf8')).recovered, true);
});

await test('추천 폴더 이름: 판 번호 · -master 떼기 · 쓸 수 없는 이름은 my-extension · 같은 이름/폴더의 확장 추천', async () => {
    const f = await fixture(), m = make();
    await put(path.join(f.base, 'Pebble Notes'), { 'manifest.json': manifest({ display_name: 'Something Else' }), 'index.js': '' });
    await put(path.join(f.base, 'renamed-copy'), { 'manifest.json': manifest(), 'index.js': '' });
    await put(path.join(f.base, 'unrelated'), { 'manifest.json': manifest({ display_name: 'Unrelated' }), 'index.js': '' });
    const flat = { 'manifest.json': manifest(), 'index.js': '' };
    const a = await m.inspect(f.base, 'alice', zipOf(flat), 'Pebble Notes-v2.3.1.zip');
    assert.equal(a.suggested, 'Pebble Notes');
    assert.deepEqual(a.matches.map(x => x.folder).sort(), ['Pebble Notes', 'renamed-copy'], 'same folder name or same display name');
    assert.equal(a.installed.length, 3);
    assert.equal((await m.inspect(f.base, 'alice', zipOf({ 'tool-master/manifest.json': manifest(), 'tool-master/index.js': '' }), 'x.zip')).suggested, 'tool');
    assert.equal((await m.inspect(f.base, 'alice', zipOf({ 'tool-1.4/manifest.json': manifest(), 'tool-1.4/index.js': '' }), 'x.zip')).suggested, 'tool');
    assert.equal((await m.inspect(f.base, 'alice', zipOf(flat), '.zip')).suggested, 'my-extension');
    assert.equal((await m.inspect(f.base, 'alice', zipOf({ '.dot-tool/manifest.json': manifest(), '.dot-tool/index.js': '' }), 'x.zip')).suggested, 'my-extension');
});

await test('표(plan): 다른 사용자 · 다른 폴더 · 지난 표 · 시간 지난 표는 못 씀 · 동시 확인은 둘까지', async () => {
    const f = await fixture(), other = await fixture(), m = make();
    const zip = zipOf({ 'manifest.json': manifest(), 'index.js': '' });
    const first = await m.inspect(f.base, 'alice', zip, 'pebble.zip');
    await assert.rejects(m.preview(f.base, 'bob', first.token, 'pebble'), /확인 시간이 지났어요/);
    await assert.rejects(m.preview(other.base, 'alice', first.token, 'pebble'), /확인 시간이 지났어요/);
    const second = await m.inspect(f.base, 'alice', zip, 'pebble.zip');
    await assert.rejects(m.preview(f.base, 'alice', first.token, 'pebble'), /확인 시간이 지났어요/, 'choosing a new ZIP drops the old plan');
    await m.preview(f.base, 'alice', second.token, 'pebble');
    await m.inspect(f.base, 'bob', zip, 'pebble.zip');
    await assert.rejects(m.inspect(f.base, 'carol', zip, 'pebble.zip'), e => e.status === 429 && /다른 ZIP을 확인 중/.test(e.message));
    m.plans.get(second.token).expires = 0;
    await assert.rejects(m.install(f.base, 'alice', second.token), /확인 시간이 지났어요/);
    assert.equal(await present(path.join(f.base, 'pebble')), false);
});

await test('restore: 모양이 틀린 id · 없는 백업은 거절', async () => {
    const f = await fixture(), m = make();
    for (const id of ['../x', 'not-a-uuid', '', undefined]) await assert.rejects(m.restore(f.base, id), /백업을 찾지 못했어요/, String(id));
    await assert.rejects(m.restore(f.base, randomUUID()), /백업을 찾지 못했어요/);
});

// ── 라우터 (index.mjs): 실리태번 본체의 yauzl 을 process.cwd() 에서 찾으므로 임시 폴더에 가짜 yauzl 꾸러미를 둔다
const routes = { use: [], get: {}, post: {} };
const router = { use: fn => routes.use.push(fn), get: (p, fn) => { routes.get[p] = fn; }, post: (p, fn) => { routes.post[p] = fn; } };
const cwd = process.cwd(), pkg = await fs.mkdtemp(path.join(os.tmpdir(), 'bl-zip-router-'));
temps.push(pkg);
globalThis.__blZipTestYauzl = yauzl;
await put(pkg, { 'package.json': '{}', 'node_modules/yauzl/package.json': '{"name":"yauzl","main":"index.js"}', 'node_modules/yauzl/index.js': 'module.exports = globalThis.__blZipTestYauzl;\n' });
try { process.chdir(pkg); await server.init(router); } finally { process.chdir(cwd); }

function req({ base, handle = 'alice', admin = true, headers = {}, body, query = {}, stream = Readable.from([]) } = {}) {
    const h = Object.fromEntries(Object.entries({ 'x-bl-zip': '1', ...headers }).map(([k, v]) => [k.toLowerCase(), v]));
    let resumed = 0;
    const r = Object.assign(stream, { user: { profile: { admin, handle }, directories: { extensions: base } }, get: name => h[name.toLowerCase()], query, body });
    const resume = r.resume.bind(r);
    r.resume = () => { resumed++; return resume(); };
    r.resumed = () => resumed;
    return r;
}
async function call(method, route, request) {
    const res = { statusCode: 200, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    for (const fn of routes.use) { let next = false; fn(request, res, () => { next = true; }); if (!next) return res; }
    await routes[method][route](request, res);
    return res;
}

await test('라우터 관문: 관리자 · 확장 폴더 · X-BL-Zip 머리 · 다른 사이트 요청을 막고 언제나 no-store', async () => {
    const f = await fixture();
    const cases = [
        [{ base: f.base, admin: false }, /관리자/], [{ base: undefined }, /관리자/],
        [{ base: f.base, headers: { 'X-BL-Zip': undefined } }, /ZIP 설치 화면/], [{ base: f.base, headers: { 'X-BL-Zip': 'yes' } }, /ZIP 설치 화면/],
        [{ base: f.base, headers: { 'Sec-Fetch-Site': 'cross-site' } }, /ZIP 설치 화면/],
    ];
    for (const [options, re] of cases) {
        const res = await call('get', '/status', req(options));
        assert.equal(res.statusCode, 403, JSON.stringify(options)); assert.match(res.body.error, re); assert.equal(res.headers['cache-control'], 'no-store');
    }
    const ok = await call('get', '/status', req({ base: f.base, headers: { 'Sec-Fetch-Site': 'same-origin' } }));
    assert.equal(ok.statusCode, 200); assert.equal(ok.body.version, server.VERSION); assert.deepEqual(ok.body.limits, LIMITS);
    assert.equal(ok.headers['cache-control'], 'no-store');
});

await test('라우터 /inspect: ZIP 형식이 아니면 400 · 64MB 넘는 길이는 받지 않고 413 · 동시 업로드는 429', async () => {
    const f = await fixture();
    const wrongType = await call('post', '/inspect', req({ base: f.base, headers: { 'Content-Type': 'application/json' } }));
    assert.equal(wrongType.statusCode, 400); assert.match(wrongType.body.error, /ZIP 파일을 골라/);
    const tooLong = req({ base: f.base, headers: { 'Content-Type': 'application/zip', 'Content-Length': String(LIMITS.zip + 1) } });
    const big = await call('post', '/inspect', tooLong);
    assert.equal(big.statusCode, 413); assert.equal(tooLong.resumed(), 1, 'the body is drained, not buffered');
    const slow = new PassThrough();
    const firstReq = req({ base: f.base, headers: { 'Content-Type': 'application/zip' }, query: { name: 'pebble.zip' }, stream: slow });
    const first = call('post', '/inspect', firstReq);
    await new Promise(r => setImmediate(r));
    const busyReq = req({ base: f.base, headers: { 'Content-Type': 'application/zip' } });
    const busy = await call('post', '/inspect', busyReq);
    assert.equal(busy.statusCode, 429); assert.equal(busyReq.resumed(), 1);
    slow.end(zipOf({ 'manifest.json': manifest(), 'index.js': '' }));
    const done = await first;
    assert.equal(done.statusCode, 200); assert.equal(done.body.suggested, 'pebble');
    const after = await call('post', '/inspect', req({ base: f.base, headers: { 'Content-Type': 'application/zip' }, query: { name: 'again.zip' }, stream: Readable.from([zipOf({ 'manifest.json': manifest(), 'index.js': '' })]) }));
    assert.equal(after.statusCode, 200, 'the upload lock is released');
});

await test('라우터 전체 흐름: inspect → preview → install 이 그 사용자 확장 폴더에만 쓴다 · 다른 사용자 표는 409 · 내부 오류는 일반 문구 500', async () => {
    const f = await fixture();
    const zipReq = req({ base: f.base, headers: { 'Content-Type': 'application/zip' }, query: { name: 'Pebble Notes-main.zip' }, stream: Readable.from([zipOf({ 'manifest.json': manifest(), 'index.js': 'export const memo = "흐름 메모";' })]) });
    const plan = await call('post', '/inspect', zipReq);
    assert.equal(plan.statusCode, 200); assert.equal(plan.body.suggested, 'Pebble Notes');
    const stolen = await call('post', '/preview', req({ base: f.base, handle: 'mallory', body: { token: plan.body.token, folder: 'pebble' } }));
    assert.equal(stolen.statusCode, 409);
    const escape = await call('post', '/preview', req({ base: f.base, body: { token: plan.body.token, folder: '../escape' } }));
    assert.equal(escape.statusCode, 400);
    const preview = await call('post', '/preview', req({ base: f.base, body: { token: plan.body.token, folder: 'pebble' } }));
    assert.equal(preview.statusCode, 200); assert.equal(preview.body.current, null);
    const install = await call('post', '/install', req({ base: f.base, body: { token: plan.body.token } }));
    assert.equal(install.statusCode, 200); assert.equal(install.body.folder, 'pebble');
    assert.equal(await fs.readFile(path.join(f.base, 'pebble/index.js'), 'utf8'), 'export const memo = "흐름 메모";');
    const installed = await call('get', '/installed', req({ base: f.base }));
    assert.deepEqual(installed.body.map(x => [x.folder, x.protected]), [['pebble', false]]);
    const errors = [], error = console.error;
    console.error = (...args) => errors.push(args);
    let broken;
    try { broken = await call('get', '/installed', req({ base: path.join(f.dir, 'missing-folder') })); } finally { console.error = error; }
    assert.equal(broken.statusCode, 500);
    assert.match(broken.body.error, /파일 작업을 마치지 못했어요/);
    assert.ok(!broken.body.error.includes(f.dir), 'no server path in the message');
    assert.equal(errors.length, 1);
    await untouched(f);
});

for (const dir of temps) await fs.rm(dir, { recursive: true, force: true });
delete globalThis.__blZipTestYauzl;
console.log(`zipinstall-install: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
