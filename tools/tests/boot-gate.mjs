// 7.7.4 시작 덮개 기다리기 — src/boot-gate.js
//   node tools/tests/boot-gate.mjs <테마 루트>
// 실리태번 첫 불러오기 덮개(#preloader)가 있으면 재는 일을 미뤘다가 덮개가 빠질 때 한 번에, 없으면 바로 한다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let fresh = 0;
const load = () => import(`${pathToFileURL(path.join(root, 'src/boot-gate.js')).href}?fresh=${++fresh}`);

// 흉내: body 아래 #preloader 하나, MutationObserver 는 childList 변화를 손으로 알린다
const observers = [];
globalThis.MutationObserver = class { constructor(cb) { this.cb = cb; this.on = false; observers.push(this); } observe(target, opts) { this.on = true; this.target = target; this.opts = opts; } disconnect() { this.on = false; } };
const notify = () => { for (const o of [...observers]) if (o.on) o.cb([{ type: 'childList' }], o); };
let cover = null;
const body = { id: 'body' };
globalThis.document = { getElementById: id => (id === 'preloader' ? cover : null), documentElement: { id: 'html' } };
const addCover = () => { cover = { id: 'preloader', parentNode: body }; };
const removeCover = () => { cover = null; notify(); };

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (error) { fail++; console.log('FAIL ' + name); console.log(error); }
}

await test('덮개가 없으면 바로 한다 (옛 실리태번 · 이미 걷힘)', async () => {
    cover = null;
    const gate = await load();
    assert.equal(gate.booting(), false);
    let n = 0;
    gate.afterBoot(() => n++);
    assert.equal(n, 1);
});

await test('덮개가 있으면 미뤘다가 빠질 때 한 번 — 같은 함수는 한 번만, 넣은 차례대로', async () => {
    addCover();
    const gate = await load();
    assert.equal(gate.booting(), true);
    const order = [];
    const a = () => order.push('a'), b = () => order.push('b');
    gate.afterBoot(a); gate.afterBoot(b); gate.afterBoot(a);
    assert.deepEqual(order, []);
    const mine = observers.filter(o => o.on);
    assert.equal(mine.length, 1, '관찰자는 하나');
    assert.equal(mine[0].target, body, '덮개의 부모를 본다');
    assert.deepEqual(mine[0].opts, { childList: true }, '자식 목록만 (하위 트리 X)');
    notify();   // 다른 자식이 바뀐 것 — 덮개는 그대로
    assert.deepEqual(order, []);
    removeCover();
    assert.deepEqual(order, ['a', 'b']);
    assert.equal(observers.filter(o => o.on).length, 0, '다 하면 관찰을 끈다');
    gate.afterBoot(a);
    assert.deepEqual(order, ['a', 'b', 'a'], '걷힌 뒤에는 바로');
});

await test('미룬 일 하나가 오류여도 나머지는 한다', async () => {
    addCover();
    const gate = await load();
    const seen = [];
    const errors = [];
    const original = console.error; console.error = (...a) => errors.push(a);
    try {
        gate.afterBoot(() => { throw new Error('x'); });
        gate.afterBoot(() => seen.push('after'));
        removeCover();
    } finally { console.error = original; }
    assert.deepEqual(seen, ['after']);
    assert.equal(errors.length, 1);
});

console.log(`\nboot-gate: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
