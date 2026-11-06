// 1.0.4 닫힌 <details> 안 요소 미루기(src/hidden-details.js) 계약 — 카드 글자색 · 가운데 줄 잉크 · 글자색 대비가 같이 써요.
//   ① 보이는 요소(닫힌 묶음 밖 · 닫힌 묶음의 머리 summary 안)는 미루지 않아요
//   ② 닫힌 묶음 안 요소는 가장 바깥 닫힌 묶음 단위로 모았다가 쉴 때 한 번 — 결과를 내는 함수(run)는 그대로 불려요
//   ③ 그 전에 머리를 누르면(열리기 전) 그 묶음만 바로 · 안쪽에 아직 닫힌 묶음이 있으면 그 묶음으로 다시 미뤄요
//   ④ 스크립트가 열면(toggle) 그 묶음 · 끄면(enabled=false) 아무것도 안 해요 · clear 는 다 버려요
//   node tools/tests/hidden-details.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');

// 작은 가짜 DOM — closest('details') · :scope > summary · contains · isConnected 만
class El {
    constructor(tag, parent = null) { this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = parent; this.open = false; this.isConnected = true; if (parent) parent.children.push(this); }
    closest(sel) { if (sel === 'summary') { for (let n = this; n; n = n.parentElement) if (n.tagName === 'SUMMARY') return n; return null; } assert.equal(sel, 'details'); for (let n = this; n; n = n.parentElement) if (n.tagName === 'DETAILS') return n; return null; }
    querySelector(sel) { assert.equal(sel, ':scope > summary'); return this.children.find(c => c.tagName === 'SUMMARY') || null; }
    contains(el) { for (let n = el; n; n = n.parentElement) if (n === this) return true; return false; }
}
const listeners = {};
let idle = [], timers = [], clock = 1e6;
const cap = o => o === true || o?.capture === true;
globalThis.document = { body: { dataset: {} }, addEventListener: (type, fn, opt) => { assert.ok(cap(opt)); (listeners[type] ||= []).push(fn); } };
globalThis.requestIdleCallback = fn => { idle.push(fn); return idle.length; };
Date.now = () => clock;
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms) => { timers.push(fn); return 1000 + timers.length; };
globalThis.clearTimeout = () => {};
// 조용해질 만큼 시계를 돌리고 쉬는 틈 · 타이머를 다 돌려요
const runIdle = () => { for (let k = 0; k < 5; k++) { clock += 2000; const t = timers; timers = []; for (const fn of t) fn(); const list = idle; idle = []; for (const fn of list) fn({ timeRemaining: () => 50 }); } };

const { hiddenBy, hiddenQueue, mayHide } = await import(pathToFileURL(path.join(root, 'src/hidden-details.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

// body > card(details 닫힘) > [summary > title, body > inner(details 닫힘) > [summary > t2, x]]
const body = new El('div');
const card = new El('details', body); const head = new El('summary', card); const title = new El('span', head);
const cbody = new El('div', card); const a = new El('span', cbody);
const inner = new El('details', cbody); const ihead = new El('summary', inner); const t2 = new El('span', ihead); const x = new El('span', inner);
const open = new El('details', body); open.open = true; const y = new El('span', open);

test('보이는 요소 · 머리 summary 안은 가리는 묶음이 없어요', () => {
    assert.equal(hiddenBy(title), null); assert.equal(hiddenBy(y), null); assert.equal(hiddenBy(body), null);
});
test('닫힌 묶음 안은 가장 바깥 닫힌 묶음', () => {
    assert.equal(hiddenBy(a), card); assert.equal(hiddenBy(t2), card); assert.equal(hiddenBy(x), card);
    assert.equal(hiddenBy(x, card), inner); assert.equal(hiddenBy(t2, card), null);
});
test('쉴 때 모아서 한 번 · 보이는 것은 바로 처리하라고 false', () => {
    const got = []; const q = hiddenQueue(list => got.push(list));
    assert.equal(q.defer(title), false); assert.equal(q.defer(a), true); assert.equal(q.defer(x), true);
    assert.equal(q.size, 2); assert.deepEqual(got, []);
    runIdle(); assert.equal(got.length, 1); assert.deepEqual(new Set(got[0]), new Set([a, x])); assert.equal(q.size, 0);
});
test('머리를 누르면 열리기 전에 그 묶음만 · 안쪽 닫힌 묶음은 다시 미룸', () => {
    const got = []; const q = hiddenQueue(list => got.push(list)); idle = []; timers = [];
    q.defer(a); q.defer(t2); q.defer(x);
    for (const fn of listeners.click) fn({ target: title });
    assert.equal(got.length, 1); assert.deepEqual(new Set(got[0]), new Set([a, t2])); assert.equal(q.size, 1);
    card.open = true;   // 이제 inner 만 닫힘
    for (const fn of listeners.click) fn({ target: t2 });
    assert.equal(got.length, 2); assert.deepEqual(got[1], [x]); assert.equal(q.size, 0);
    card.open = false;
});
test('굴리는 중 · 답 받는 중에는 미룬 일을 하지 않아요(조용해진 뒤)', () => {
    const got = []; const q = hiddenQueue(list => got.push(list)); idle = []; timers = [];
    q.defer(a);
    for (const fn of listeners.scroll) fn({});   // 지금 굴림
    const t = timers; timers = []; for (const fn of t) fn(); const list = idle; idle = []; for (const fn of list) fn({ timeRemaining: () => 50 });
    assert.deepEqual(got, []);
    document.body.dataset.generating = 'true'; runIdle(); assert.deepEqual(got, []);
    delete document.body.dataset.generating; runIdle(); assert.deepEqual(got, [[a]]);
});
test('스크립트가 열면 toggle 에서 · 꺼져 있으면 버려요 · clear', () => {
    const got = []; let on = true; const q = hiddenQueue(list => got.push(list), { enabled: () => on }); idle = [];
    q.defer(a); card.open = true; for (const fn of listeners.toggle) fn({ target: card }); card.open = false;
    assert.deepEqual(got, [[a]]);
    q.defer(a); on = false; runIdle(); assert.equal(got.length, 1); assert.equal(q.size, 0);
    on = true; q.defer(a); q.clear(); runIdle(); assert.equal(got.length, 1);
});
test('떨어져 나간 요소는 건너뛰어요', () => {
    const got = []; const q = hiddenQueue(list => got.push(list)); idle = [];
    const gone = new El('span', cbody); q.defer(gone); gone.isConnected = false; q.defer(a); runIdle();
    assert.deepEqual(got, [[a]]);
});
test('dispose 는 문서 리스너를 떼요(감시를 다시 만들어도 늘지 않게)', () => {
    const removed = [];
    globalThis.document.removeEventListener = (type, fn, capture) => { assert.ok(cap(capture)); removed.push(type); const list = listeners[type] || []; const i = list.indexOf(fn); if (i >= 0) list.splice(i, 1); };
    const before = (listeners.click || []).length;
    const q = hiddenQueue(() => {}); q.defer(a); assert.equal(listeners.click.length, before + 1);
    q.dispose(); assert.equal(listeners.click.length, before); assert.deepEqual(removed.sort(), ['click', 'toggle']); assert.equal(q.size, 0);
});
test('mayHide — 닫힌 details 가 없으면 거짓(보통 채팅은 조상을 안 올라요)', () => {
    const q = sel => sel === 'details:not([open])' ? (q.has || null) : null;
    const plain = { querySelector: q, closest: () => null }; assert.equal(mayHide(plain), false);
    q.has = {}; assert.equal(mayHide(plain), true);
    assert.equal(mayHide({ querySelector: () => null, closest: s => s === 'details' ? {} : null }), true);
    assert.equal(mayHide(null), true);
});
console.log(`hidden-details: ${pass} passed`);
