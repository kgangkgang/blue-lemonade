// 1.5.7 2차 부팅: src/boot-layers.js afterSettle — 「부팅 뒤 미리 하기」는 첫 누름 · 글쇠 또는 정한 시간 중 먼저 오는 때에 한 번만 불러요.
//   icon-text.js 닫힌 서랍 미리 훑기가 이것을 써요(한글화 내장 스크립트는 같은 규칙을 제 안에 둬요 — tools/tests/korean-closed-late.mjs).
//   node tools/tests/after-settle.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const listeners = new Map();
globalThis.document = {
    addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
};
const fire = type => { for (const fn of [...(listeners.get(type) || [])]) fn(); };
const { afterSettle, SETTLE_MS } = await import(pathToFileURL(path.join(root, 'src/boot-layers.js')).href);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

await test('기본은 10초', () => assert.equal(SETTLE_MS, 10000));
await test('시간이 먼저면 시간에 한 번 · 그 뒤 누름은 아무 일 없음 · 들은 것은 떼요', async () => {
    let n = 0; afterSettle(() => n++, 30);
    assert.equal(n, 0); await sleep(60); assert.equal(n, 1);
    fire('pointerdown'); fire('keydown'); assert.equal(n, 1);
    assert.equal(listeners.get('pointerdown').size + listeners.get('keydown').size, 0);
});
await test('누름이 먼저면 바로 한 번 · 시간이 와도 또 안 불러요', async () => {
    let n = 0; afterSettle(() => n++, 40);
    fire('pointerdown'); assert.equal(n, 1); fire('keydown'); await sleep(70); assert.equal(n, 1);
});
await test('글쇠도 같아요 · 일이 던져도 다음 것은 그대로', async () => {
    let n = 0; afterSettle(() => { throw Error('일부러'); }, 1000); afterSettle(() => n++, 1000);
    const warn = console.warn; console.warn = () => {}; fire('keydown'); console.warn = warn;
    assert.equal(n, 1);
});
console.log(`\nafter-settle: ${passed} passed`);
