// 번역 요청과 이어하기 저장소의 지연 입구를 실제 모듈로 실행해요. 모델·서버 호출은 하지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
if (!process.execArgv.includes('--experimental-vm-modules')) {
    const run = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: 'inherit' });
    process.exit(run.status ?? 1);
}
const vm = await import('node:vm');
const root = path.resolve(process.argv[2] || '.');
const dir = path.join(root, 'src/addons/translator');
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log('PASS ' + name); };
async function fixture(source, exports, load) {
    const target = new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [name, fn] of Object.entries(exports)) this.setExport(name, fn);
    });
    await target.link(() => { throw Error('예상하지 않은 정적 의존성이에요'); });
    await target.evaluate();
    let imports = 0;
    const entry = new vm.SourceTextModule(source, {
        importModuleDynamically: async specifier => { imports++; await load?.(specifier); return target; },
    });
    await entry.link(() => { throw Error('부팅 때 본체를 정적으로 읽으면 안 돼요'); });
    await entry.evaluate();
    return { api: entry.namespace, imports: () => imports };
}
const names = ['checkpointKey', 'readCheckpoint', 'writeCheckpoint', 'clearCheckpoints', 'translateChunks'];
await test('이어하기 입구만 불러오면 본체와 저장소를 열지 않아요', async () => {
    const f = await fixture(read('resume-loader.js'), Object.fromEntries(names.map(name => [name, async () => name])));
    assert.equal(f.imports(), 0);
    for (const name of names) assert.equal(typeof f.api[name], 'function');
});
await test('첫 호출이 겹쳐도 본체는 한 번만 받고 인수·결과를 그대로 넘겨요', async () => {
    let release;
    const wait = new Promise(resolve => { release = resolve; });
    const seen = [], result = {};
    const f = await fixture(read('resume-loader.js'), Object.fromEntries(names.map(name => [name, async (...args) => { seen.push([name, args]); return result; }])), () => wait);
    const input = { key: '예시' };
    const jobs = names.map(name => f.api[name](input, null));
    assert.equal(f.imports(), 1);
    release();
    assert.ok((await Promise.all(jobs)).every(value => value === result));
    assert.equal(seen.length, names.length);
    assert.ok(seen.every(([, args]) => args[0] === input && args[1] === null));
    await f.api.checkpointKey('다음 호출');
    assert.equal(f.imports(), 1);
});
await test('파일을 못 받은 호출은 오류를 유지하고 다음 호출에서 다시 받아요', async () => {
    const failure = Error('파일을 못 받았어요'); let attempts = 0;
    const f = await fixture(read('resume-loader.js'), Object.fromEntries(names.map(name => [name, async () => name])), () => { if (++attempts === 1) throw failure; });
    await assert.rejects(f.api.readCheckpoint('예시'), error => error === failure);
    assert.equal(await f.api.readCheckpoint('예시'), 'readCheckpoint');
    assert.equal(f.imports(), 2);
});
await test('원래 저장소와 같은 해시·같은 메모리 이어하기 기록을 사용해요', async () => {
    const lazy = await import(pathToFileURL(path.join(dir, 'resume-loader.js')));
    const direct = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
    const key = await lazy.checkpointKey('한글·일본어 日本語·기호 😀');
    assert.equal(key, await direct.checkpointKey('한글·일본어 日本語·기호 😀'));
    await lazy.writeCheckpoint({ key, parts: ['첫 조각', null] });
    assert.deepEqual((await direct.readCheckpoint(key)).parts, ['첫 조각', null]);
    await lazy.clearCheckpoints(key);
    assert.equal(await direct.readCheckpoint(key), null);
});
await test('현재 연결도 요청 전에는 받지 않고 요청 인수와 오류를 그대로 돌려줘요', async () => {
    const index = read('index.js');
    const start = index.indexOf('async function requestCurrentConnection(');
    assert.ok(start >= 0);
    const code = index.slice(start, index.indexOf('\n}', start) + 2);
    const request = { signal: new AbortController().signal }, response = {}, failure = Error('요청 오류');
    let count = 0;
    const f = await fixture('export ' + code, { requestCurrentConnection: async value => { assert.equal(value, request); if (++count > 1) throw failure; return response; } });
    assert.equal(f.imports(), 0);
    assert.equal(await f.api.requestCurrentConnection(request), response);
    await assert.rejects(f.api.requestCurrentConnection(request), error => error === failure);
    assert.doesNotMatch(index, /import\s+\{[^}]*requestCurrentConnection[^}]*\}\s+from\s+['"]\.\/current-connection\.js/);
    assert.doesNotMatch(index + read('translation-segments.js'), /from\s+['"]\.\/translation-resume\.js/);
});
console.log(`번역 지연 입구: ${passed}개 통과했어요.`);
