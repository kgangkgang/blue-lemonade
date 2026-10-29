// 성능 보조 — 보이는 프롬프트 목록의 render(true) 묶기 (src/addons/perf/promptlist.js, 8.0.5)
//   node tools/tests/perf-prompt-render-batch.mjs <테마 루트>
// 가짜 시계로: 짧은 사이에 거듭 온 render(true) 는 마지막 인자로 한 번만 · 최대 대기 ms × 4 · render(false) 는 그대로 · 닫힌 목록은 예전 미루기 · 끄면 안 묶음.
// 8.2.5 앞쪽 가장자리: 마지막 그리기에서 coalesceMs 가 지난 첫 render(true) 는 바로 돌리고(토글 한 번에 300ms 지연 없음), 그 뒤 coalesceMs 안에
//   잇달아 오는 것만 마지막 한 번으로 묶는다 — 8.1.0 「토글 잇달아 누르면 마지막 한 번」은 「첫 번째 바로 + 마지막 한 번」으로 유지.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { createPromptListDefer } = await import(pathToFileURL(path.join(root, 'src/addons/perf/promptlist.js')).href);

function rig({ shown = true, enabled = true, coalesceMs = 300, coalesceWhen } = {}) {
    let now = 0; const timers = [];
    const realNow = Date.now; Date.now = () => now;
    const calls = [];
    const pm = { containerElement: {}, render(a = true, b) { calls.push([a, b, now]); } };
    const state = { shown, enabled };
    const d = createPromptListDefer({
        manager: () => pm, enabled: () => state.enabled, visible: () => state.shown, watch: () => () => {}, coalesceMs, coalesceWhen,
        setTimer: (fn, ms) => { const t = { fn, at: now + ms, live: true }; timers.push(t); return t; },
        clearTimer: t => { if (t) t.live = false; },
    });
    assert.equal(d.install(), true);
    const tick = ms => { const end = now + ms; for (;;) { const due = timers.filter(t => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; now = due.at; due.live = false; due.fn(); } now = end; };
    return { pm, d, calls, tick, state, done: () => { Date.now = realNow; } };
}
let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

test('한 번 부르면(앞쪽 가장자리) 바로 돈다 — 300ms 를 기다리지 않고, 뒤에 타이머도 남지 않는다', () => {
    const r = rig(); r.pm.render(); assert.deepEqual(r.calls.map(c => c[0]), [true]); assert.equal(r.calls[0][2], 0);
    assert.equal(r.d.batched(), false); assert.equal(r.d.stats.leading, 1); r.tick(1000); assert.equal(r.calls.length, 1); assert.equal(r.d.stats.coalescedRuns, 0); r.done();
});
test('토글 세 번(200ms 사이) → 첫 번째 바로 + 마지막 한 번(마지막 인자) — 가운데 것은 묶인다', () => {
    const r = rig(); r.pm.render(); assert.equal(r.calls.length, 1); r.tick(200); r.pm.render(); assert.equal(r.calls.length, 1, '두 번째는 묶여 기다린다'); r.tick(200); r.pm.render(true, 'x'); assert.equal(r.calls.length, 1); r.tick(300);
    assert.equal(r.calls.length, 2); assert.deepEqual(r.calls[1].slice(0, 2), [true, 'x']); assert.equal(r.d.stats.coalesced, 1); assert.equal(r.d.stats.coalescedRuns, 1); r.done();
});
test('마지막 그리기에서 300ms 가 지난 뒤의 토글은 다시 바로 그린다', () => {
    const r = rig(); r.pm.render(); r.tick(300); r.pm.render(); assert.equal(r.calls.length, 2); assert.equal(r.calls[1][2], 300); r.tick(1000); assert.equal(r.calls.length, 2); r.done();
    const q = rig(); q.pm.render(); q.tick(299); q.pm.render(); assert.equal(q.calls.length, 1, '299ms 뒤는 아직 묶인다'); q.tick(300); assert.equal(q.calls.length, 2); q.done();
});
test('묶어 돌린 직후 300ms 안에 또 오면 그것도 묶인다(앞쪽 가장자리가 연달아 열리지 않는다)', () => {
    const r = rig(); r.pm.render(); r.tick(100); r.pm.render(); r.tick(300);
    assert.equal(r.calls.length, 2); assert.equal(r.calls[1][2], 400);
    r.tick(50); r.pm.render(true, 'y'); assert.equal(r.calls.length, 2); r.tick(300); assert.equal(r.calls.length, 3); assert.deepEqual(r.calls[2].slice(0, 2), [true, 'y']); r.done();
});
test('계속 눌러도 처음부터 ms × 4 안에는 한 번 돈다 · 20번(100ms 사이) 눌러도 그리기는 20번보다 훨씬 적다', () => {
    const r = rig(); for (let i = 0; i < 20; i++) { r.pm.render(); r.tick(100); }
    assert.ok(r.calls.length >= 1 && r.calls[0][2] <= 1200, `첫 실행 ${r.calls[0]?.[2]}`);
    const gaps = r.calls.slice(1).map((c, i) => c[2] - r.calls[i][2]); assert.ok(gaps.every(g => g >= 300), '그리기 사이는 300ms 이상: ' + gaps.join(','));
    assert.ok(r.calls.length <= 5, `그리기 ${r.calls.length}번`); r.done();
});
test('render(false)(보내기 쪽)는 묶지 않고 바로 · 묶어 둔 것은 그 뒤 그대로', () => {
    const r = rig(); r.pm.render(); r.tick(100); r.pm.render(); r.pm.render(false); assert.deepEqual(r.calls.map(c => c[0]), [true, false]); r.tick(300); assert.deepEqual(r.calls.map(c => c[0]), [true, false, true]); r.done();
});
test('목록이 안 보이면 render(true) 는 바로(예전 그대로), render(false) 는 미룬다', () => {
    const r = rig({ shown: false }); r.pm.render(); assert.deepEqual(r.calls.map(c => c[0]), [true]); r.pm.render(false); assert.equal(r.calls.length, 1); assert.equal(r.d.pending(), true); r.done();
});
test('끄면(설정) · coalesceMs 0 이면 묶지 않는다', () => {
    const a = rig({ enabled: false }); a.pm.render(); assert.equal(a.calls.length, 1); a.done();
    const b = rig({ coalesceMs: 0 }); b.pm.render(); assert.equal(b.calls.length, 1); b.done();
});
test('flushBatch 는 묶어 둔 것을 지금 한 번 돌리고 타이머는 다시 돌지 않는다', () => {
    const r = rig(); r.pm.render(); assert.equal(r.d.flushBatch(), false, '바로 돌렸으니 묶어 둔 것이 없다'); r.tick(100); r.pm.render(); assert.equal(r.d.batched(), true);
    assert.equal(r.d.flushBatch(), true); assert.equal(r.calls.length, 2); r.tick(1000); assert.equal(r.calls.length, 2); assert.equal(r.d.flushBatch(), false); r.done();
});
test('coalesceWhen 이 거짓이면(토글이 아닌 그리기) 바로 돌고, 참이면 묶는다 · 던지면 묶지 않는다', () => {
    const state = { toggle: false };
    const r = rig({ coalesceWhen: () => state.toggle }); r.pm.render(); assert.equal(r.calls.length, 1);
    state.toggle = true; r.pm.render(); assert.equal(r.calls.length, 1); r.tick(300); assert.equal(r.calls.length, 2); r.done();
    const t = rig({ coalesceWhen: () => { throw new Error('x'); } }); t.pm.render(); assert.equal(t.calls.length, 1); t.done();
});
console.log(`perf-prompt-render-batch: ${n}/${n} 통과`);
