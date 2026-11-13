// 1.4.1 덮개가 걷힌 뒤 애드온 시작을 나눠요 (src/addons.js startEach · src/boot-layers.js withReplay { spread })
//   ① 덮개가 걷혔으면 애드온을 하나씩 시작하고 사이사이 한 박자 — 차례 그대로 · 앞 것이 끝나길 기다리지 않아요(받기는 겹쳐요)
//   ② 덮개 아래면 예전처럼 한 번에(덮개 없는 앞 층까지 나누면 표식이 늦게 붙어요 — 이 길은 3층 · 처음 쓸 때만 spread 를 줘요)
//   ③ 늦게 붙은 리스너에 지금 채팅 알리기도 사이사이 한 박자 — 그 사이 진짜 CHAT_CHANGED 가 오면 남은 리스너에 또 부르지 않아요(두 번 받지 않음)
//   node tools/tests/late-start-spread.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..', process.argv[2] && process.argv[2] !== '.' ? process.argv[2] : '');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log(`ok ${passed} - ${name}`); };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

// ── addons.js startEach 를 그대로 떼어 돌려요 ──
const addons = read('src/addons.js');
const part = (a, b) => { const s = addons.indexOf(a), e = addons.indexOf(b, s); assert.ok(s >= 0 && e > s, a); return addons.slice(s, e); };
function startEachWith(isBooting) {
    const log = [];
    let task = 0;   // 매크로 작업 번호 — 한 박자마다 올라요
    const box = { setTimeout: (fn, ms) => setTimeout(() => { task++; fn(); }, ms), Promise, booting: () => isBooting,
        startOne: async id => { log.push([id, task, 'start']); await tick(); log.push([id, task, 'end']); } };
    vm.runInNewContext(part('const beat=', '\nlet lateFired') + '\nthis.startEach=startEach;', box);
    return { run: ids => box.startEach(ids), log };
}
await test('덮개가 걷혔으면 하나씩 · 사이사이 한 박자 · 차례 그대로 · 앞 것을 기다리지 않아요', async () => {
    const h = startEachWith(false);
    const out = await h.run(['a', 'b', 'c']);
    assert.equal(out.length, 3); assert.ok(out.every(r => r.status === 'fulfilled'));
    const starts = h.log.filter(r => r[2] === 'start');
    assert.deepEqual(starts.map(r => r[0]), ['a', 'b', 'c']);
    assert.ok(starts[0][1] < starts[1][1] && starts[1][1] < starts[2][1], '서로 다른 작업에서 시작');
    assert.ok(h.log.findIndex(r => r[0] === 'b' && r[2] === 'start') < h.log.findIndex(r => r[0] === 'c' && r[2] === 'end'), '앞 것이 끝나길 기다리지 않아요');
});
await test('덮개 아래면 예전처럼 한 작업에서 다 시작해요', async () => {
    const h = startEachWith(true);
    await h.run(['a', 'b', 'c']);
    const starts = h.log.filter(r => r[2] === 'start');
    assert.deepEqual(starts.map(r => r[0]), ['a', 'b', 'c']);
    assert.equal(new Set(starts.map(r => r[1])).size, 1);
});
await test('3층 · 처음 쓸 때 두 길만 나눠요(spread) — 2층 · 덮개 아래 층은 그대로', () => {
    assert.match(addons, /const run=async\(\)=>\{await startEach\(lateIds\);[^\n]*withReplay\('늦은 애드온',run,\{spread:true\}\)/);
    assert.match(addons, /const run=async\(\)=>\{await startEach\(rest\);[^\n]*\n\s*await\(layers\?layers\.withReplay\('애드온',run,\{spread:true\}\):run\(\)\);/);
    assert.ok(!/withReplay\('(?:2층|테마 2층)'[^\n]*spread/.test(read('index.js')), '2층은 나누지 않아요');
    assert.match(read('src/boot-layers.js'), /const split = spread && fresh\.length > 1 && !booting\(\);/);
});

// ── boot-layers.js withReplay — 가짜 실리태번 사건 상자 ──
function eventSource() {
    const events = {};
    return {
        events,
        on(type, fn) { (events[type] ??= []).push(fn); },
        makeFirst(type, fn) { (events[type] ??= []).unshift(fn); },
        removeListener(type, fn) { const list = events[type] ?? []; const at = list.indexOf(fn); if (at >= 0) list.splice(at, 1); },
        async emit(type, ...args) { for (const fn of [...(events[type] ?? [])]) await fn(...args); },
    };
}
const es = eventSource();
let chatId = 'chat-1';
globalThis.SillyTavern = { getContext: () => ({ eventSource: es, eventTypes: { CHAT_CHANGED: 'chat_changed' }, getCurrentChatId: () => chatId }) };
let preloader = false;
globalThis.document = { getElementById: id => (id === 'preloader' && preloader ? {} : null) };
const { withReplay } = await import(pathToFileURL(path.join(root, 'src/boot-layers.js')).href);

await test('지금 채팅 알리기: spread 면 리스너 사이사이 한 박자 · 한 번씩', async () => {
    const calls = []; let task = 0; const pump = setInterval(() => task++, 0);
    const fns = ['x', 'y', 'z'].map(name => async id => { calls.push([name, id, task]); });
    await withReplay('시험', async () => { for (const fn of fns) es.on('chat_changed', fn); }, { spread: true });
    clearInterval(pump);
    assert.deepEqual(calls.map(c => c.slice(0, 2)), [['x', 'chat-1'], ['y', 'chat-1'], ['z', 'chat-1']]);
    assert.ok(calls[0][2] < calls[2][2], '한 작업에 몰리지 않아요');
    for (const fn of fns) es.removeListener('chat_changed', fn);
});
await test('쉬는 사이 진짜 CHAT_CHANGED 가 오면 남은 리스너에 또 부르지 않아요(한 번만 받음)', async () => {
    const calls = [];
    const fns = ['x', 'y', 'z'].map(name => async id => { calls.push([name, id]); if (name === 'x' && id === 'chat-1') setTimeout(() => { chatId = 'chat-2'; es.emit('chat_changed', 'chat-2'); }, 0); });
    await withReplay('시험', async () => { for (const fn of fns) es.on('chat_changed', fn); }, { spread: true });
    await tick(); await tick();
    for (const name of ['y', 'z']) assert.equal(calls.filter(c => c[0] === name).length, 1, `${name} 는 한 번`);
    assert.deepEqual(calls.filter(c => c[0] !== 'x').map(c => c[1]), ['chat-2', 'chat-2'], '남은 리스너는 진짜 사건(새 채팅)만');
    assert.equal(es.events.chat_changed.filter(fn => fn.blLayerMark).length, 0, '표시 리스너는 떼요');
    for (const fn of fns) es.removeListener('chat_changed', fn);
    chatId = 'chat-1';
});
await test('덮개 아래거나 spread 가 없으면 예전처럼 줄줄이(한 작업)', async () => {
    for (const [cover, opts] of [[true, { spread: true }], [false, undefined]]) {
        preloader = cover;
        const calls = []; let task = 0; const pump = setInterval(() => task++, 0);
        const fns = ['x', 'y', 'z'].map(name => id => { calls.push([name, id, task]); });
        await withReplay('시험', async () => { for (const fn of fns) es.on('chat_changed', fn); }, opts);
        clearInterval(pump);
        assert.equal(calls.length, 3); assert.equal(new Set(calls.map(c => c[2])).size, 1);
        for (const fn of fns) es.removeListener('chat_changed', fn);
    }
    preloader = false;
});
await test('CI 등록', () => assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/late-start-spread.mjs .')));
console.log(`late-start-spread: ${passed} passed`);
