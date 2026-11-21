// 1.9.8 답 뒤 이어지는 일(자동 다시 쓰기 → 자동 번역)의 알림 한 장 (src/flow-toast.js) — 가짜 toastr · 가짜 시계로 검사해요. 유료 호출 없음.
//   실행: node tools/tests/flow-toast.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { createFlowToast, holdAndSwipe, doneOptions, DONE_MS, DONE_ACTION_MS, RESUME_MS } = await import(pathToFileURL(path.join(root, 'src/flow-toast.js')));

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };

// 가짜 toastr: 띄운 알림 요소(jQuery 비슷) · 글 칸 · 색 갈래 · 닫힘
function fakeToastr() {
    const made = [], cleared = [];
    const toast = kind => (html, title, opts) => {
        const on = {}; const el = { kind: `toast-${kind}`, html, title, opts, buttons: [], removed: false, length: 1, dataset: {}, style: {}, on,
            addEventListener(type, fn) { (on[type] ||= []).push(fn); }, fire(type, e = {}) { for (const fn of on[type] || []) fn({ pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0, ...e }); },
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
    C.tick(1999); assert.equal(T.cleared.length, 0); C.tick(2); assert.equal(T.cleared.length, 1, '2.0.0 완료는 2초');
});

await test('번역이 안 이어지면(자동 번역 끔) 다시 쓰기 결과로 닫혀요 · 이어질 줄 알았는데 안 오면 기다린 뒤 결과 글로', () => {
    const a = make(); a.F.follow('translate', () => false);
    a.F.step(1, 'rewrite', { title: '다시 쓰기', text: '2곳 다시 쓰는 중…' });
    a.F.end(1, 'rewrite', { title: '다시 쓰기', text: '2곳 고쳤어요.', kind: 'success', next: 'translate', waitText: '2곳 고쳤어요 · 번역을 시작해요' });
    assert.equal(text(a.T.made[0]), '2곳 고쳤어요.'); a.C.tick(2001); assert.equal(a.T.cleared.length, 1);
    const b = make(); b.F.follow('translate', () => true);
    b.F.end(2, 'rewrite', { title: '다시 쓰기', text: '2곳 고쳤어요.', kind: 'success', next: 'translate', waitText: '2곳 고쳤어요 · 번역을 시작해요' });
    b.C.tick(4001); assert.equal(text(b.T.made[0]), '2곳 고쳤어요.', '기다림이 끝나면 결과 글'); b.C.tick(2001); assert.equal(b.T.cleared.length, 1);
});

await test('실패는 그 한 장에 남아요(까닭 줄 · 사용자가 닫을 때까지) · 이어지는 번역 줄은 그 아래', () => {
    const { T, C, F } = make(); const msg = {}; F.follow('translate', () => true);
    F.step(msg, 'rewrite', { title: '다시 쓰기', text: '1곳 다시 쓰는 중…' });
    const el = F.end(msg, 'rewrite', { title: '다시 쓰기', text: '1곳은 못 고쳐서 원문 그대로 뒀어요.', kind: 'warning', sticky: true });
    assert.equal(el.kind, 'toast-warning');
    F.step(msg, 'translate', { title: '번역', text: '번역하는 중…' });
    assert.equal(T.made.length, 1); assert.equal(text(T.made[0]), '1곳은 못 고쳐서 원문 그대로 뒀어요. · 번역하는 중…', '2.0.0 한 줄로 이어요');
    assert.match(T.made[0].html, /<span class="bl-flow-line">1곳은 못 고쳐서 원문 그대로 뒀어요\. · 번역하는 중…<\/span>/);
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
    C.tick(2001); assert.equal(T.cleared.length, 1);
    const b = make(); b.F.follow('translate', () => false); const m2 = {};
    b.F.end(m2, 'rewrite', { title: '다시 쓰기', text: '1곳 고쳤어요.', kind: 'success', next: 'translate' }); b.F.withActions(m2);
    b.C.tick(2001); assert.equal(b.T.cleared.length, 0, '되돌리기 단추를 누를 틈(3초)'); b.C.tick(1000); assert.equal(b.T.cleared.length, 1);
});

await test('2.0.0 완료 2초 · 단추 3초 · 멈춤 안내는 예전 3초 · 진행 중 · 실패는 안 닫힘', () => {
    assert.equal(DONE_MS, 2000); assert.equal(DONE_ACTION_MS, 3000); assert.equal(RESUME_MS, 1500);
    const a = make(); a.F.step(1, 'translate', { title: '번역', text: '번역하는 중…' });
    a.F.end(1, 'translate', { title: '번역', text: '번역을 멈췄어요. 글이 바뀌었어요', kind: 'info' });
    a.C.tick(2001); assert.equal(a.T.cleared.length, 0, '멈춤 안내는 완료가 아니라 예전 길이'); a.C.tick(1000); assert.equal(a.T.cleared.length, 1);
    const b = make(); b.F.step(2, 'rewrite', { title: '다시 쓰기', text: '1곳 다시 쓰는 중…' }); b.C.tick(600000); assert.equal(b.T.cleared.length, 0, '진행 중은 안 닫힘');
    assert.deepEqual(doneOptions(), { timeOut: 2000, extendedTimeOut: 1500 }); assert.deepEqual(doneOptions(true), { timeOut: 3000, extendedTimeOut: 1500 });
});

await test('2.0.0 손가락 · 마우스가 닿은 동안 멈추고 떼면 1.5초 뒤 · 옆으로 쓸면 바로 닫혀요', () => {
    const { T, C, F } = make(); const msg = {};
    F.end(msg, 'translate', { title: '번역', text: '번역했어요.', kind: 'success' });
    const el = T.made[0];
    assert.equal(el.style.touchAction, 'pan-y');
    C.tick(1000); el.fire('pointerdown', { clientX: 100, clientY: 10 });
    C.tick(60000); assert.equal(T.cleared.length, 0, '닿아 있는 동안 안 닫혀요');
    el.fire('pointerup', { clientX: 100, clientY: 10 }); C.tick(1499); assert.equal(T.cleared.length, 0); C.tick(2); assert.equal(T.cleared.length, 1, '떼고 1.5초 뒤');
    const m = make(); m.F.end(2, 'translate', { title: '번역', text: '번역했어요.', kind: 'success' }); const e2 = m.T.made[0];
    e2.fire('pointerenter', { pointerType: 'mouse' }); m.C.tick(10000); assert.equal(m.T.cleared.length, 0, '마우스가 올라가 있는 동안 멈춤');
    e2.fire('pointerleave', { pointerType: 'mouse' }); m.C.tick(1501); assert.equal(m.T.cleared.length, 1);
    const s = make(); s.F.end(3, 'rewrite', { title: '다시 쓰기', text: '1곳 고쳤어요.', kind: 'success' }); s.F.withActions(3); const e3 = s.T.made[0];
    e3.fire('pointerdown', { clientX: 100, clientY: 10 }); e3.fire('pointermove', { clientX: 120, clientY: 12 }); assert.equal(s.T.cleared.length, 0, '조금 움직임은 안 닫힘');
    e3.fire('pointermove', { clientX: 160, clientY: 14 }); assert.equal(s.T.cleared.length, 1, '옆으로 쓸면 바로');
    const v = make(); v.F.end(4, 'translate', { title: '번역', text: '번역했어요.', kind: 'success' }); const e4 = v.T.made[0];
    e4.fire('pointerdown', { clientX: 100, clientY: 10 }); e4.fire('pointermove', { clientX: 110, clientY: 90 }); assert.equal(v.T.cleared.length, 0, '세로로 움직임은 쓸기가 아니에요');
    // 일반 toastr(mouse: false) — 마우스는 toastr 가 스스로 멈추니 손가락만 받아요
    let held = 0, freed = 0; const plain = { dataset: {}, style: {}, on: {}, addEventListener(t, f) { (this.on[t] ||= []).push(f); } };
    holdAndSwipe(plain, { hold: () => held++, release: () => freed++, mouse: false });
    for (const f of plain.on.pointerenter) f({ pointerType: 'mouse' }); assert.equal(held, 0);
    for (const f of plain.on.pointerdown) f({ pointerType: 'touch', pointerId: 1, clientX: 0, clientY: 0 }); assert.equal(held, 1);
    for (const f of plain.on.pointerup) f({ pointerType: 'touch', pointerId: 1 }); assert.equal(freed, 1);
    assert.equal(holdAndSwipe(plain, {}), plain, '두 번 걸지 않아요');
});

await test('2.0.0 한 꼴: 닫기 단추는 toastr 것 대신(따로 줄 0) · 까닭은 누르면 펼침 · 한 번 더 누르면 닫힘 · 펼친 동안 안 닫힘 · 까닭 없으면 누르면 닫힘', () => {
    const { T, C, F } = make(); const msg = {};
    F.step(msg, 'translate', { title: '번역', text: '번역하는 중…' });
    assert.equal(T.made[0].opts.closeButton, false); assert.equal(T.made[0].opts.tapToDismiss, false);
    F.end(msg, 'translate', { title: '번역', text: '번역이 멈췄어요 · 받은 문단은 남겨 뒀어요', detail: '90초 동안 번역 글이 더 오지 않아 끊었어요.', kind: 'error', sticky: true });
    const el = T.made[0];
    assert.match(el.html, /<span class="bl-flow-line">번역이 멈췄어요 · 받은 문단은 남겨 뒀어요<\/span><span class="bl-flow-more">90초 동안/);
    assert.equal(el.kind, 'toast-error');
    el.fire('click'); assert.equal(T.cleared.length, 0, '첫 누름은 펼침');
    C.tick(60000); assert.equal(T.cleared.length, 0);
    el.fire('click'); assert.equal(T.cleared.length, 1, '두 번째 누름은 닫힘');
    const b = make(); b.F.end(2, 'translate', { title: '번역', text: '번역했어요.', kind: 'success' });
    b.T.made[0].fire('click'); assert.equal(b.T.cleared.length, 1, '까닭이 없으면 누르면 바로 닫힘(예전과 같음)');
    // 펼친 완료 알림(까닭 있음)은 읽는 동안 안 닫힘
    const d = make(); d.F.end(3, 'rewrite', { title: '다시 쓰기', text: '2곳 고쳤어요.', detail: '1곳은 다른 캐릭터 특징이라 그대로 뒀어요.', kind: 'success' });
    d.T.made[0].fire('click'); d.C.tick(60000); assert.equal(d.T.cleared.length, 0, '펼친 동안 안 닫힘');
});

await test('2.0.0 진행 줄이 보이면 「번역하는 중」 줄 없이: 다시 쓰기 카드가 기다리는 동안 끝나면 그 카드에 「번역했어요」 · 늦게 끝나면 새 카드 2초', () => {
    const { T, C, F } = make(); const msg = {}; F.follow('translate', () => true);
    F.end(msg, 'rewrite', { title: '다시 쓰기', text: '2곳 고쳤어요.', kind: 'success', next: 'translate', waitText: '2곳 고쳤어요 · 번역을 시작해요' });
    C.tick(1500); F.end(msg, 'translate', { title: '번역', text: '번역했어요.', kind: 'success' });
    assert.equal(T.made.length, 1); assert.equal(text(T.made[0]), '번역했어요.'); C.tick(2001); assert.equal(T.cleared.length, 1);
    const b = make(); const m2 = {}; b.F.follow('translate', () => true);
    b.F.end(m2, 'rewrite', { title: '다시 쓰기', text: '1곳 고쳤어요.', kind: 'success', next: 'translate', waitText: '1곳 고쳤어요 · 번역을 시작해요' });
    b.C.tick(4001); assert.equal(text(b.T.made[0]), '1곳 고쳤어요.', '기다림이 끝나면 다시 쓰기 결과'); b.C.tick(2001); assert.equal(b.T.cleared.length, 1);
    b.F.end(m2, 'translate', { title: '번역', text: '번역했어요.', kind: 'success' }); assert.equal(b.T.made.length, 2); b.C.tick(2001); assert.equal(b.T.cleared.length, 2);
    const tr = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    assert.match(tr, /if \(!\(typeof flowBadgeShown === 'function' && flowBadgeShown\(messageId\)\)\) flowApi\.step\(message, 'translate'/);
    assert.match(tr, /function flowBadgeShown\(messageId\) \{/);
});

await test('다시 쓰기 · 번역 애드온이 이 장치를 써요(자동 길만 · 손으로 누른 길은 예전 알림)', () => {
    const rw = fs.readFileSync(path.join(root, 'src/addons/rewrite/index.js'), 'utf8');
    const tr = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    assert.match(rw, /import \{ flowToast[^}]*\} from '\.\.\/\.\.\/flow-toast\.js'/);
    assert.match(rw, /const flow = !manual && settings\.notify \? message : null;/);
    assert.match(rw, /flowToast\(\)\.step\(flow, 'rewrite'/);
    assert.match(rw, /next: 'translate'/);
    assert.match(tr, /import \{ flowToast[^}]*\} from '\.\.\/\.\.\/flow-toast\.js'/);
    assert.match(tr, /const flowing = source === 'auto' && !!flowApi;/);
    assert.match(tr, /flowToast\(\)\.follow\('translate'/);
    assert.match(tr, /runToken\.flowApi\.settle\(runToken\.flow, 'translate'/);
});

console.log(`flow-toast: ${passed} passed, 0 failed`);
