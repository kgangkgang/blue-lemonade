// 남의 확장 기능 다리의 「비동기 프레임이 남나」 재기(src/async-frames.js) — 11-14 검토 M1: 함수 이름에 기대면 배포본(이름 줄임)에서 틀려요
//   ① 소스 모듈: 노드(V8)에서 재면 「남음」 · 스택 글 판정(크롬 · 사파리 · 파이어폭스 꼴, 줄인 이름) · 못 재면 null
//   ② 묶음 도구와 같은 줄이기(esbuild minify)를 한 모듈: 이름이 줄어도 같은 답(도구가 깔려 있을 때)
//   ③ 실제 dist 조각: dist 가 소스와 맞으면 그 조각을 그대로 불러 같은 답 · 조각은 아무것도 import 하지 않아요(작업 갈래처럼 dist 가 낡았으면 건너뜀을 적어요)
//   ④ 다리 소스: 재기를 함수 이름(.name)으로 하지 않고 그 조각을 import() 로 받아요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
const pathOf = url => new URL(url).pathname;

/** 한 모듈(주소)에 대해 판정 · 재기를 맞대요 */
async function checkModule(url, label) {
    const m = await import(url);
    const self = pathOf(url);
    const host = `http://127.0.0.1:8000${self}`;
    // 줄인 이름(e · it · n)을 일부러 써요 — 이름이 아니라 그 파일 줄 수로 판정해요
    const chrome = ['Error: bl-async-frames-v1', `    at e (${host}:1:120)`, `    at async it (${host}:1:180)`].join('\n');
    const safari = [`e@${host}:1:120`, 'promiseReactionJob@[native code]'].join('\n');
    const firefoxQuiet = [`e@${host}:1:120`, ''].join('\n');
    const firefoxAsync = [`e@${host}:1:120`, `async*it@${host}:1:180`].join('\n');
    assert.equal(m.asyncFramesIn(chrome, self), true, `${label}: 크롬 꼴`);
    assert.equal(m.asyncFramesIn(safari, self), false, `${label}: 사파리 꼴(줄인 이름 e 가 다른 줄에 섞여도)`);
    assert.equal(m.asyncFramesIn(firefoxQuiet, self), false, `${label}: 파이어폭스(개발자 도구 닫힘)`);
    assert.equal(m.asyncFramesIn(firefoxAsync, self), true, `${label}: 파이어폭스(async*)`);
    assert.equal(m.asyncFramesIn('', self), null, `${label}: 빈 스택`);
    assert.equal(m.asyncFramesIn('at e (http://other/x.js:1:1)', self), null, `${label}: 이 파일 주소가 없는 스택`);
    assert.equal(await m.probeAsyncFrames(), true, `${label}: 노드(V8)에서 재면 남음`);
    assert.equal(m.ASYNC_FRAMES_MARK, 'bl-async-frames-v1');
}

await test('① 소스 모듈: 판정 · 재기', async () => {
    await checkModule(pathToFileURL(path.join(root, 'src/async-frames.js')).href, '소스');
});

await test('② 묶음 도구와 같은 줄이기를 한 모듈(이름이 줄어도 같은 답)', async () => {
    let esbuild = null;
    try { esbuild = createRequire(path.join(root, 'tools/package.json'))('esbuild'); } catch { esbuild = null; }
    if (!esbuild) { console.log('  (건너뜀 — tools/node_modules 에 esbuild 가 없어요: cd tools && npm ci)'); return; }
    const code = fs.readFileSync(path.join(root, 'src/async-frames.js'), 'utf8');
    const out = await esbuild.transform(code, { minify: true, format: 'esm', target: 'es2022', charset: 'utf8', legalComments: 'none' });   // tools/build-bundle.mjs 와 같은 옵션
    assert.ok(!/probeInner|probeOuter/.test(out.code), '안쪽 함수 이름이 줄었어요(줄인 판으로 시험해요)');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-async-probe-'));
    const file = path.join(dir, 'c-probe.js');
    fs.writeFileSync(file, out.code);
    try { await checkModule(pathToFileURL(file).href, '줄인 판'); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

await test('③ 실제 dist 조각(소스와 맞을 때)', async () => {
    const dist = path.join(root, 'dist');
    if (!fs.existsSync(dist)) { console.log('  (건너뜀 — dist 없음)'); return; }
    const { bundleFresh } = await import(pathToFileURL(path.join(root, 'tools/build-bundle.mjs')).href);
    const fresh = bundleFresh(root);
    if (!fresh.ok) { console.log(`  (건너뜀 — dist 가 소스보다 낡았어요: ${fresh.why} · 합칠 때 node tools/build-bundle.mjs 뒤 다시)`); return; }
    const hits = fs.readdirSync(dist).filter(f => f.endsWith('.js') && fs.readFileSync(path.join(dist, f), 'utf8').includes('bl-async-frames-v1'));
    assert.equal(hits.length, 1, `재기 조각은 dist 에 하나(따로 받는 조각): ${hits.join(', ')}`);
    const text = fs.readFileSync(path.join(dist, hits[0]), 'utf8');
    assert.ok(!/\bimport\s*[\s{*"'(]|\bfrom\s*["']/.test(text), '조각은 아무것도 import 하지 않아요(다리가 import() 로 받는 작은 조각)');
    await checkModule(pathToFileURL(path.join(dist, hits[0])).href, `dist/${hits[0]}`);
});

await test('④ 다리 소스: 이름(.name)으로 재지 않고 그 조각을 import() 로 받아요', async () => {
    const code = fs.readFileSync(path.join(root, 'src/ext-bridge.js'), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    assert.match(code, /import\('\.\/async-frames\.js'\)\.then\(module => module\.probeAsyncFrames\(\), \(\) => true\)/);
    assert.ok(!/blProbe|\.name\)/.test(code), '함수 이름으로 재는 길이 남지 않았어요');
    const probe = fs.readFileSync(path.join(root, 'src/async-frames.js'), 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\.name\b/.test(probe), '재기 조각도 이름을 안 봐요');
    assert.ok(!/^\s*import\s/m.test(probe), '재기 조각은 다른 모듈을 안 받아요');
});

console.log(`\next-bridge-async-probe: ${passed}개 통과`);
