// 1.9.8 답 뒤 이어지는 일(자동 다시 쓰기 → 자동 번역)의 알림 한 장 (src/flow-toast.js) — 가짜 toastr · 가짜 시계로 검사해요. 유료 호출 없음.
//   실행: node tools/tests/flow-toast.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { createFlowToast } = await import(pathToFileURL(path.join(root, 'src/flow-toast.js')));

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };

// 가짜 toastr: 띄운 알림 요소(jQuery 비슷) · 글 칸 · 색 갈래 · 닫힘
function fakeToastr() {
    const made = [], cleared = [];
    const toast = kind => (html, title, opts) => {
        const el = { kind: `toast-${kind}`, html, title, opts, buttons: [], removed: false, length: 1,
            removeClass(names) { for (const n of names.split(' ')) if (this.kind === n) this.kind = ''; return this; },
            addClass(n) { if (n.startsWith('toast-')) this.kind = n; return this; },
            closest() { return { length: this.removed ? 0 : 1 }; },
            find(sel) { const self = this; return sel === '.bl-flow-text' ? { first: () => ({ html(v) { self.html = `<span class="bl-flow-text">${v}</span>`; } }) } : sel === '.toast-title' ? { length: 1, first: () => ({ text(v) { self.title = v; } }) } : { length: 0 }; } };
        made.push(el); return el;
    };
    return { made, cleared, api: { info: toast('info'), success: toast('success'), warning: toast('warning'), error: toast('error'), clear(el) { el.removed = true; cleared.push(el); } } };
}
function fakeClock() {
    let now = 0, id = 0; const timers = new Map();
    return { set: (fn, ms) => { timers.set(++id, { fn, at: now + ms }); return id; }, clear: i => timers.delete(i),
        tick(ms) { now += ms; for (const [i, t] of [...timers].sort((a, b) => a[1].at - b[1].at)) if (t.at <= now) { timers.delete(i); t.fn(); } } };
}
const text = el => el.html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
const make = () => { const T = fakeToastr(), C = fakeClock(); const F = createFlowToast({ toastr: () => T.api, setTimer: C.set, clearTimer: C.clear, waitMs: 4000, hideMs: 3000, actionHideMs: 9000 }); return { T, C, F }; };

await test('다시 쓰기 → 번역: 알림은 한 장 · 글만 바뀌고 끝나면 잠시 뒤 닫혀요', () => {
    const { T, C, F } = make(); const msg = {};
    F.follow('translate', () => true);
    F.step(msg, 'rewrite', { title: '다시 쓰기', text: '3곳 다시 쓰는 중…' });
    F.end(msg, 'rewrite', { title: '다시 쓰기', text: '3곳 고쳤어요.', kind: 'success', next: 'translate', waitText: '3곳 고쳤어요 · 번역을 시작해요' });
    assert.equal(T.made.length, 1); assert.equal(text(T.made[0]), '3곳 고쳤어요 · 번역을 시작해요');
    C.tick(3500); assert.equal(T.cleared.length, 0, '번역을 기다리는 동안 안 닫혀요');
    F.step(msg, 'translate', { title: '번역', text: '번역하는 중…' });
    assert.equal(T.made.length, 1, '새 알림을 안 띄워요'); assert.equal(text(T.made[0]), '번역하는 중…');
    assert.equal(T.made[0].title, '다시 쓰기 · 번역');
    C.tick(60000); assert.equal(T.cleared.length, 0, '번역하는 동안엔 안 닫혀요');
    F.end(msg, 'translate', { title: '번역', text: '번역했어요.', kind: 'success' });
    assert.equal(text(T.made[0]), '번역했어요.'); assert.equal(T.made[0].kind, 'toast-success');
    C.tick(2999); assert.equal(T.cleared.length, 0); C.tick(2); assert.equal(T.cleared.length, 1);
});

await test('번역이 안 이어지면(자동 번역 끔) 다시 쓰기 결과로 닫혀요 · 이어질 줄 알았는데 안 오면 기다린 뒤 결과 글로', () => {
    const a = make(); a.F.follow('translate', () => false);
    a.F.step(1, 'rewrite', { title: '다시 쓰기', text: '2곳 다시 쓰는 중…' });
    a.F.end(1, 'rewrite', { title: '다시 쓰기', text: '2곳 고쳤어요.', kind: 'success', next: 'translate', waitText: '2곳 고쳤어요 · 번역을 시작해요' });
    assert.equal(text(a.T.made[0]), '2곳 고쳤어요.'); a.C.tick(3001); assert.equal(a.T.cleared.length, 1);
    const b = make(); b.F.follow('translate', () => true);
    b.F.end(2, 'rewrite', { title: '다시 쓰기', text: '2곳 고쳤어요.', kind: 'success', next: 'translate', waitText: '2곳 고쳤어요 · 번역을 시작해요' });
    b.C.tick(4001); assert.equal(text(b.T.made[0]), '2곳 고쳤어요.', '기다림이 끝나면 결과 글'); b.C.tick(3001); assert.equal(b.T.cleared.length, 1);
});

await test('실패는 그 한 장에 남아요(까닭 줄 · 사용자가 닫을 때까지) · 이어지는 번역 줄은 그 아래', () => {
    const { T, C, F } = make(); const msg = {}; F.follow('translate', () => true);
    F.step(msg, 'rewrite', { title: '다시 쓰기', text: '1곳 다시 쓰는 중…' });
    const el = F.end(msg, 'rewrite', { title: '다시 쓰기', text: '1곳은 못 고쳐서 원문 그대로 뒀어요.', kind: 'warning', sticky: true });
    assert.equal(el.kind, 'toast-warning');
    F.step(msg, 'translate', { title: '번역', text: '번역하는 중…' });
    assert.equal(T.made.length, 1); assert.equal(text(T.made[0]), '1곳은 못 고쳐서 원문 그대로 뒀어요.번역하는 중…'.replace('.번', '.번'));
    assert.match(T.made[0].html, /원문 그대로 뒀어요\.<br>번역하는 중…/);
    assert.equal(T.made[0].kind, 'toast-warning', '색은 더 센 쪽');
    F.end(msg, 'translate', { title: '번역', text: '번역했어요.', kind: 'success' });
    C.tick(60000); assert.equal(T.cleared.length, 0, '실패 줄이 있으면 저절로 안 닫혀요');
    // 번역 실패도 sticky
    const b = make(); b.F.step(3, 'translate', { title: '번역', text: '번역하는 중…' }); b.F.end(3, 'translate', { title: '번역', text: '번역에 실패했어요. 시간 초과', kind: 'error', sticky: true });
    b.C.tick(60000); assert.equal(b.T.cleared.length, 0); assert.equal(b.T.made[0].kind, 'toast-error');
});

await test('번역만 쓰면 번역 단계만 · settle 은 끝난 줄을 안 덮어요 · 단추가 있으면 늦게 닫혀요', () => {
    const { T, C, F } = make(); const msg = {};
    F.step(msg, 'translate', { title: '번역', text: '번역하는 중…' });
    assert.equal(T.made[0].title, '번역');
    F.end(msg, 'translate', { title: '번역', text: '번역했어요.', kind: 'success' });
    F.settle(msg, 'translate', { title: '번역', text: '다른 글', kind: 'info' });
    assert.equal(text(T.made[0]), '번역했어요.');
    C.tick(3001); assert.equal(T.cleared.length, 1);
    const b = make(); b.F.follow('translate', () => false); const m2 = {};
    b.F.end(m2, 'rewrite', { title: '다시 쓰기', text: '1곳 고쳤어요.', kind: 'success', next: 'translate' }); b.F.withActions(m2);
    b.C.tick(3001); assert.equal(b.T.cleared.length, 0, '되돌리기 단추를 누를 틈'); b.C.tick(6000); assert.equal(b.T.cleared.length, 1);
});

await test('다시 쓰기 · 번역 애드온이 이 장치를 써요(자동 길만 · 손으로 누른 길은 예전 알림)', () => {
    const rw = fs.readFileSync(path.join(root, 'src/addons/rewrite/index.js'), 'utf8');
    const tr = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    assert.match(rw, /import \{ flowToast \} from '\.\.\/\.\.\/flow-toast\.js'/);
    assert.match(rw, /const flow = !manual && settings\.notify \? message : null;/);
    assert.match(rw, /flowToast\(\)\.step\(flow, 'rewrite'/);
    assert.match(rw, /next: 'translate'/);
    assert.match(tr, /import \{ flowToast \} from '\.\.\/\.\.\/flow-toast\.js'/);
    assert.match(tr, /const flowing = source === 'auto' && !!flowApi;/);
    assert.match(tr, /flowToast\(\)\.follow\('translate'/);
    assert.match(tr, /runToken\.flowApi\.settle\(runToken\.flow, 'translate'/);
});

console.log(`flow-toast: ${passed} passed, 0 failed`);
