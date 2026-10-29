// 전개 지시 입력칸 타이핑 (src/addons/direction/typing.js attachTypingRefresh) — 제보 「글자가 뚝뚝 끊기고 『미안』이 『ㅣ안』으로 깨진다」
//   node tools/tests/direction-typing.mjs <테마 루트>
// 가짜 textarea · 가짜 시계로: 한글 조합(compositionstart → input(isComposing) × n → compositionend) 중에는 값만 적고 창 · 단추 다시 그리기
// (refresh)를 한 번도 부르지 않는다 · 조합이 끝나면 delay 뒤 한 번 · 조합 없는 타자(영문 · 숫자)는 잇달아 쳐도 멈춘 뒤 한 번 · 창을 닫으면(stop) 미뤄 둔 것도 버린다.
// index.js 가 글 쪽 입력칸 둘에 이것을 붙이고, 예전처럼 input 마다 refreshButton() 을 부르는 줄이 없는지도 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { attachTypingRefresh } = await import(pathToFileURL(path.join(root, 'src/addons/direction/typing.js')).href);

function rig(delay) {
    let now = 0; const timers = [];
    const setTimer = (fn, ms) => { const t = { fn, at: now + ms, live: true }; timers.push(t); return t; };
    const clearTimer = t => { if (t) t.live = false; };
    const tick = ms => { const end = now + ms; for (;;) { const due = timers.filter(t => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; now = due.at; due.live = false; due.fn(); } now = end; };
    const listeners = {};
    const textarea = { value: '', addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }, removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter(f => f !== fn); } };
    const fire = (type, props = {}) => { for (const fn of listeners[type] || []) fn({ type, target: textarea, ...props }); };
    const values = [], refreshes = [];
    const handle = attachTypingRefresh(textarea, { onValue: v => values.push(v), refresh: () => refreshes.push(now), delay, setTimer, clearTimer });
    // 크롬의 한글 조합 순서: compositionstart → (compositionupdate · input isComposing) × n → compositionend. 값은 조합 글자가 바뀔 때마다 바뀐다
    const compose = steps => { fire('compositionstart'); for (const v of steps) { textarea.value = v; fire('input', { isComposing: true }); tick(30); } fire('compositionend'); };
    return { textarea, fire, tick, values, refreshes, handle, compose, listeners };
}
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.message}`); } };

test('「미안」 조합(ㅁ → 미 → 미ㅇ → 미안) 중에는 값만 적고 창을 다시 그리지 않는다 · 끝나면 120ms 뒤 한 번', () => {
    const r = rig(120);
    r.compose(['ㅁ', '미', '미ㅇ', '미안']);
    assert.deepEqual(r.values, ['ㅁ', '미', '미ㅇ', '미안', '미안'], '글자마다 값은 바로 (끝날 때 한 번 더)');
    assert.deepEqual(r.refreshes, [], '조합 중 · 끝난 직후에는 아직');
    assert.equal(r.handle.composing(), false); assert.equal(r.handle.pending(), true);
    r.tick(119); assert.deepEqual(r.refreshes, []); r.tick(1); assert.equal(r.refreshes.length, 1);
    r.tick(1000); assert.equal(r.refreshes.length, 1, '한 번만');
    assert.equal(r.textarea.value, '미안');
});

test('조합 중에 compositionstart 전에 걸려 있던 다시 그리기도 거둔다 — 조합 안에서는 어떤 다시 그리기도 돌지 않는다', () => {
    const r = rig(120);
    r.textarea.value = 'a'; r.fire('input', { isComposing: false }); assert.equal(r.handle.pending(), true);
    r.tick(50);
    r.compose(['aㅁ', 'a미']);
    assert.deepEqual(r.refreshes, [], '조합이 시작되면 기다리던 것도 멈춘다');
    r.tick(120); assert.equal(r.refreshes.length, 1);
});

test('조합 없는 타자(영문 10자 · 30ms 간격)는 멈춘 뒤 한 번만 다시 그린다', () => {
    const r = rig(120);
    for (let i = 0; i < 10; i++) { r.textarea.value += 'x'; r.fire('input', { isComposing: false }); r.tick(30); }
    assert.equal(r.values.length, 10); assert.deepEqual(r.refreshes, []);
    r.tick(120); assert.deepEqual(r.refreshes, [390], '마지막 글자 120ms 뒤');
});

test('isComposing 만 참인 input(compositionstart 를 못 받은 경우)도 조합 중으로 보고 미룬다 · compositionend 로 푼다', () => {
    const r = rig(120);
    r.textarea.value = '가'; r.fire('input', { isComposing: true }); r.tick(500);
    assert.deepEqual(r.values, ['가']); assert.deepEqual(r.refreshes, []);
    r.fire('compositionend'); r.tick(120); assert.equal(r.refreshes.length, 1);
});

test('flush 는 미뤄 둔 것을 지금 · 조합 중이면 하지 않는다 · stop 은 리스너와 타이머를 거둔다', () => {
    const r = rig(120);
    r.textarea.value = 'b'; r.fire('input', {}); r.handle.flush(); assert.equal(r.refreshes.length, 1); r.tick(500); assert.equal(r.refreshes.length, 1);
    r.fire('compositionstart'); r.handle.flush(); assert.equal(r.refreshes.length, 1, '조합 중엔 flush 도 안 그린다'); r.fire('compositionend');
    r.tick(120); assert.equal(r.refreshes.length, 2);
    r.textarea.value = 'bc'; r.fire('input', {}); r.handle.stop(); r.tick(1000); assert.equal(r.refreshes.length, 2, '닫으면 버린다');
    assert.equal(Object.values(r.listeners).flat().length, 0, '리스너 전부 뗌');
    assert.equal(r.values.length, 3, 'b · (조합 끝) b · bc'); r.fire('input', {}); assert.equal(r.values.length, 3, '멈춘 뒤에는 값도 적지 않는다');
});

test('index.js: 글 쪽 입력칸 둘에 attachTypingRefresh 를 붙이고, input 마다 refreshButton() 을 바로 부르는 줄은 없다 · 창을 닫을 때 stop', () => {
    const idx = read('src/addons/direction/index.js');
    assert.match(idx, /import \{ attachTypingRefresh \} from '\.\/typing\.js';/);
    assert.match(idx, /typingRefreshers\.push\(attachTypingRefresh\(textarea, \{\n\s+onValue: value => \{ store\[kind\]\.content = value; save\(\); \},\n\s+refresh: \(\) => \{ if \(popup\) refreshButton\(\); \},\n\s+\}\)\);/);
    assert.doesNotMatch(idx, /textarea\.addEventListener\('input', \(\) => \{\n\s+store\[kind\]\.content = textarea\.value;/, '예전 input 핸들러가 남아 있다');
    assert.match(idx, /for \(const t of typingRefreshers\.splice\(0\)\) t\.stop\(\);/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/direction-typing\.mjs \./);
});

console.log(`direction-typing: ${n}/${n + failed} 통과`);
if (failed) process.exit(1);
