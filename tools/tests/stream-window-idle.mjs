// 1.5.1 whenNotStreaming — 설정 저장 뒤 맞추기(프롬프트 연동 정규식 · 프롬프트 귀속)를 답이 오는 동안 미루는 감싸개
//   node tools/tests/stream-window-idle.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const body = { dataset: {} };
globalThis.document = { body };
const { whenNotStreaming, noteToken, noteEnd, _streamWindow } = await import(pathToFileURL(path.join(root, 'src/stream-window.js')).href);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0;
const check = async (name, fn) => { await fn(); pass++; console.log('  ok', name); };

await check('답이 오는 중이 아니면 바로 한 번 불러요', async () => {
    let n = 0; const run = whenNotStreaming(() => n++, 20);
    run(); assert.equal(n, 1);
});
await check('생성 표식이 켜진 동안은 미루고, 꺼진 뒤 한 번만 불러요', async () => {
    let n = 0; const run = whenNotStreaming(() => n++, 20);
    body.dataset.generating = 'true';
    run(); assert.equal(n, 0);
    await sleep(70); assert.equal(n, 0, '표식이 켜진 동안은 다시 봐도 부르지 않아요');
    delete body.dataset.generating;
    await sleep(45); assert.equal(n, 1, '끝난 뒤 한 번');
    await sleep(60); assert.equal(n, 1, '더 부르지 않아요');
});
await check('표식 없이 토큰만 오는 동안도 미뤄요', async () => {
    let n = 0; const run = whenNotStreaming(() => n++, 20);
    noteToken(); run(); assert.equal(n, 0);
    noteEnd(); await sleep(45); assert.equal(n, 1);
});
await check('cancel 하면 기다리던 것을 버려요', async () => {
    let n = 0; const run = whenNotStreaming(() => n++, 20);
    body.dataset.generating = 'true'; run(); run.cancel();
    delete body.dataset.generating; await sleep(60); assert.equal(n, 0);
});
_streamWindow.reset();
console.log(`stream-window-idle ${pass}/4 통과`);
