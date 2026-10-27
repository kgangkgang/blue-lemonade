// 성능 보조 — 보이는 프롬프트 목록의 render(true) 묶기 (src/addons/perf/promptlist.js, 8.0.5)
//   node tools/tests/perf-prompt-render-batch.mjs <테마 루트>
// 가짜 시계로: 짧은 사이에 거듭 온 render(true) 는 마지막 인자로 한 번만 · 최대 대기 ms × 4 · render(false) 는 그대로 · 닫힌 목록은 예전 미루기 · 끄면 안 묶음.
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

test('한 번 부르면 묶는 시간 뒤 한 번 그대로 돈다', () => {
    const r = rig(); r.pm.render(); assert.equal(r.calls.length, 0); r.tick(299); assert.equal(r.calls.length, 0); r.tick(1);
    assert.deepEqual(r.calls.map(c => c[0]), [true]); assert.equal(r.d.stats.coalescedRuns, 1); r.done();
});
test('토글 세 번(200ms 사이) → 마지막 한 번만', () => {
    const r = rig(); r.pm.render(); r.tick(200); r.pm.render(); r.tick(200); r.pm.render(true, 'x'); r.tick(300);
    assert.equal(r.calls.length, 1); assert.deepEqual(r.calls[0].slice(0, 2), [true, 'x']); assert.equal(r.d.stats.coalesced, 2); r.done();
});
test('계속 눌러도 처음부터 ms × 4 안에는 한 번 돈다', () => {
    const r = rig(); for (let i = 0; i < 20; i++) { r.pm.render(); r.tick(100); }
    assert.ok(r.calls.length >= 1 && r.calls[0][2] <= 1200, `첫 실행 ${r.calls[0]?.[2]}`); r.done();
});
test('render(false)(보내기 쪽)는 묶지 않고 바로 · 묶어 둔 것은 그 뒤 그대로', () => {
    const r = rig(); r.pm.render(); r.pm.render(false); assert.deepEqual(r.calls.map(c => c[0]), [false]); r.tick(300); assert.deepEqual(r.calls.map(c => c[0]), [false, true]); r.done();
});
test('목록이 안 보이면 render(true) 는 바로(예전 그대로), render(false) 는 미룬다', () => {
    const r = rig({ shown: false }); r.pm.render(); assert.deepEqual(r.calls.map(c => c[0]), [true]); r.pm.render(false); assert.equal(r.calls.length, 1); assert.equal(r.d.pending(), true); r.done();
});
test('끄면(설정) · coalesceMs 0 이면 묶지 않는다', () => {
    const a = rig({ enabled: false }); a.pm.render(); assert.equal(a.calls.length, 1); a.done();
    const b = rig({ coalesceMs: 0 }); b.pm.render(); assert.equal(b.calls.length, 1); b.done();
});
test('flushBatch 는 묶어 둔 것을 지금 한 번 돌리고 타이머는 다시 돌지 않는다', () => {
    const r = rig(); r.pm.render(); assert.equal(r.d.batched(), true); assert.equal(r.d.flushBatch(), true); assert.equal(r.calls.length, 1); r.tick(1000); assert.equal(r.calls.length, 1); assert.equal(r.d.flushBatch(), false); r.done();
});
test('coalesceWhen 이 거짓이면(토글이 아닌 그리기) 바로 돌고, 참이면 묶는다 · 던지면 묶지 않는다', () => {
    const state = { toggle: false };
    const r = rig({ coalesceWhen: () => state.toggle }); r.pm.render(); assert.equal(r.calls.length, 1);
    state.toggle = true; r.pm.render(); assert.equal(r.calls.length, 1); r.tick(300); assert.equal(r.calls.length, 2); r.done();
    const t = rig({ coalesceWhen: () => { throw new Error('x'); } }); t.pm.render(); assert.equal(t.calls.length, 1); t.done();
});
console.log(`perf-prompt-render-batch: ${n}/${n} 통과`);
