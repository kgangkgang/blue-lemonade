// 7.0.3 preferences-safety 흔들림: 작업 트리를 고치는 도중(파일은 새것, 지문표 src/build-info.js 는 아직)에 돌면 지문 검사가
//   잠깐 어긋나 「1 !== 0」 만 남기고 실패했다(혼자 다시 돌리면 통과). tools/integrity-recheck.mjs 가 지문표를 디스크에서 새로 읽어
//   몇 번 더 보고, 그래도 다르면 STALE build-info 로 따로 알린다(낡은 지문표 = 정상 실패). 지어낸 파일 이름만.
//   node tools/tests/integrity-recheck.mjs <테마 루트>   (공개 저장소는 '.')
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const { recheckInstalled, staleMessage, readHashesFresh } = await load('tools/integrity-recheck.mjs');
const { verifyFiles } = await load('src/install-health.js');
const { fileFingerprint } = await load('src/file-fingerprint.js');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
const info = hashes => `// Generated\nexport const BUILD_VERSION = "0.0.1";\nexport const FILE_HASHES = ${JSON.stringify(hashes, null, 2)};\n`;

await t('잠깐 어긋남: 기다리는 동안 지문표가 새로 써지면 통과 · 지문표는 새로 읽은 것으로 · 한 번만 다시 봄', async () => {
    const waits = [];
    let disk = { 'a.js': 'old' };
    const verify = async hashes => ({ checked: 1, failures: hashes['a.js'] === 'new' ? [] : [{ path: 'a.js', kind: 'mismatch' }] });
    const result = await recheckInstalled({ hashes: disk, reloadHashes: async () => disk, verify, wait: async ms => { waits.push(ms); disk = { 'a.js': 'new' }; } });
    assert.deepEqual(result, { checked: 1, failures: [], rechecked: 1 });
    assert.deepEqual(waits, [750]);
});

await t('계속 어긋남(낡은 지문표): 네 번 보고 실패를 그대로 · 처음부터 맞으면 기다리지 않음', async () => {
    let calls = 0, waited = 0;
    const verify = async () => { calls++; return { checked: 2, failures: [{ path: 'b.css', kind: 'mismatch' }] }; };
    const result = await recheckInstalled({ hashes: {}, reloadHashes: async () => ({}), verify, wait: async () => { waited++; } });
    assert.equal(calls, 4); assert.equal(waited, 3); assert.equal(result.rechecked, 3); assert.deepEqual(result.failures, [{ path: 'b.css', kind: 'mismatch' }]);
    const ok = await recheckInstalled({ hashes: {}, reloadHashes: async () => { throw Error('읽지 않아야 함'); }, verify: async () => ({ checked: 0, failures: [] }), wait: async () => { throw Error('기다리지 않아야 함'); } });
    assert.equal(ok.rechecked, 0);
});

await t('STALE 글: 첫 줄 표지 · 파일 이름과 까닭 · 8개 넘으면 … · 다시 만드는 명령', async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ path: `src/f${i}.js`, kind: i ? 'mismatch' : 'unavailable' }));
    const text = staleMessage(many);
    assert.match(text, /^STALE build-info: 파일 10개가 지문표와 달라요 — src\/f0\.js \(못 읽음\), src\/f1\.js \(내용 다름\)/);
    assert.ok(text.includes('src/f7.js') && !text.includes('src/f8.js') && text.includes(' …'));
    assert.match(text, /node tools\/build-integrity\.mjs \./);
    assert.ok(!staleMessage(many.slice(0, 2)).includes('…'));
});

await t('readHashesFresh: 같은 경로 import 캐시와 달리 글이 바뀌면 새 지문표', async () => {
    assert.deepEqual(await readHashesFresh(info({ 'x.js': '1:a:b' })), { 'x.js': '1:a:b' });
    assert.deepEqual(await readHashesFresh(info({ 'x.js': '2:c:d' })), { 'x.js': '2:c:d' });
});

await t('실제 파일로: 파일을 고친 뒤 지문표가 조금 늦게 다시 써져도 통과 · 끝내 안 써지면 그 파일만 STALE', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-integrity-'));
    try {
        const file = path.join(dir, 'sample.js'), infoFile = path.join(dir, 'build-info.js');
        const stamp = () => ({ 'sample.js': fileFingerprint(fs.readFileSync(file)) });
        fs.writeFileSync(file, 'export const a = 1;\n'); fs.writeFileSync(infoFile, info(stamp()));
        const first = await readHashesFresh(fs.readFileSync(infoFile, 'utf8'));
        fs.writeFileSync(file, 'export const a = 2;\n');   // 고침 — 지문표는 아직 옛것
        const verify = hashes => verifyFiles(hashes, p => fs.readFileSync(path.join(dir, p)), fileFingerprint);
        const reloadHashes = () => readHashesFresh(fs.readFileSync(infoFile, 'utf8'));
        let ticks = 0;
        const late = await recheckInstalled({ hashes: first, reloadHashes, verify, wait: async () => { if (++ticks === 2) fs.writeFileSync(infoFile, info(stamp())); } });
        assert.equal(late.failures.length, 0); assert.equal(late.rechecked, 2);
        fs.writeFileSync(file, 'export const a = 3;\n');
        const never = await recheckInstalled({ hashes: await reloadHashes(), reloadHashes, verify, wait: async () => {} });
        assert.deepEqual(never.failures, [{ path: 'sample.js', kind: 'mismatch' }]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

await t('배선: preferences-safety 가 recheckInstalled 로 보고 · 낡으면 STALE 글 + 종료 코드 1 (나머지 검사는 끝까지) · CI', async () => {
    const src = fs.readFileSync(path.join(root, 'tools/tests/preferences-safety.mjs'), 'utf8');
    assert.match(src, /const installed=await recheckInstalled\(\{hashes:FILE_HASHES,reloadHashes:\(\)=>readHashesFresh\(fs\.readFileSync\(new URL\('src\/build-info\.js',root\),'utf8'\)\),/);
    assert.ok(!src.includes('assert.equal(installed.failures.length,0)'), '바로 assert 하지 않는다 — 다른 검사도 돌고 까닭을 남긴다');
    assert.match(src, /if\(stale\)\{console\.error\(stale\);[^\n]*process\.exitCode=1;\}/);
    const ci = fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').replace(/\r\n/g, '\n');
    assert.match(ci, /node tools\/tests\/integrity-recheck\.mjs \.\n\s+node tools\/tests\/preferences-safety\.mjs \./);
});

console.log(`integrity-recheck: ${n} passed, 0 failed`);
