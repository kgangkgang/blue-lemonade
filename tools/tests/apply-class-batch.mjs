// 8.2.7 perf-fade: 설정 적용(src/apply.js applyAll)이 body 의 테마 클래스(salty · salty-*)를 클래스마다 따로 붙이지 않고 한 번에 붙이고 떼는지 —
//   클래스마다 add 를 부르면 그때마다 body class 변경 기록이 나서, 실리태번 keyboard.js 가 기록마다 body 아래 전부를 선택자 31개로 다시 훑었어요
//   (폰 리그 감사: 시작 때 apply.js 한 자리에서 body class 기록 45번). 끝 상태(붙은 클래스)는 같아요.
//   테마 index.js 를 가짜 브라우저(leak-dom.mjs · leak-loader.mjs)에서 그대로 띄워요.
//   node tools/tests/apply-class-batch.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
const { ctx, eventSource } = dom.installBrowser({ settings: { enabled: true } });
dom.installHost(ctx);
const { register } = await import('node:module');
register(pathToFileURL(path.join(root, 'tools/tests/leak-loader.mjs')).href, { data: { root } });
const quiet = () => {}; console.warn = quiet; console.error = quiet; console.info = quiet; console.debug = quiet;
const log = console.log; console.log = quiet;
process.on('unhandledRejection', quiet);
await import(pathToFileURL(path.join(root, 'index.js')).href);
await dom.clock.advance(1000);
await eventSource.emit(ctx.event_types.APP_READY);
await dom.clock.advance(12000);
const { applyAll } = await import(pathToFileURL(path.join(root, 'src/apply.js')).href);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; log(`  PASS  ${name}`); };
const tick = async () => { for (let i = 0; i < 8; i++) await null; };
const mine = () => [...document.body.classList].filter(c => c === 'salty' || c.startsWith('salty-')).sort();

// 가짜 DOM 의 classList 는 바뀔 때마다 setAttribute('class') 한 번(= 변경 기록 한 번) — body 의 class 쓰기를 세요
const countBodyClassWrites = fn => {
    const body = document.body; const own = body.setAttribute; let n = 0;
    body.setAttribute = function (name, v) { if (name === 'class') n++; return own.call(this, name, v); };
    try { fn(); } finally { delete body.setAttribute; if (body.setAttribute !== own) body.setAttribute = own; }
    return n;
};
await test('테마 클래스를 모두 뗀 뒤 applyAll 한 번: 다시 붙는 클래스가 여럿이어도 body class 쓰기는 한 번', async () => {
    const before = mine();
    assert.ok(before.length >= 5, `테마 클래스가 여럿 붙어 있어요(${before.length})`);
    document.body.classList.remove(...before);
    const writes = countBodyClassWrites(() => applyAll());
    assert.deepEqual(mine(), before, '끝 상태는 같아요');
    assert.equal(writes, 1, `body class 쓰기 ${writes}번(예전엔 붙일 클래스마다 한 번 = ${before.length}번)`);
});
await test('붙은 것 · 뗄 것이 섞여도 떼기 한 번 + 붙이기 한 번, 바뀐 것이 없으면 0', async () => {
    const before = mine();
    document.body.classList.remove(...before.slice(0, 4)); document.body.classList.add('salty-old-a', 'salty-old-b', 'salty-old-c');
    const writes = countBodyClassWrites(() => applyAll());
    assert.deepEqual(mine(), before);
    assert.equal(writes, 2);
    assert.equal(countBodyClassWrites(() => { applyAll(); applyAll(); }), 0);
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/apply-class-batch\.mjs \./);
});
log(`\n${passed} passed`);
process.exit(0);
