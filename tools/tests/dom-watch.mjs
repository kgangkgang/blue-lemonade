// 공용 DOM 감시자(src/dom-watch.js) — 뿌리마다 감시자 하나 · 구독마다 원한 기록만 · 'frame' 은 모아서 한 번 · 끊으면 감시자도 끊김 · 한 구독이 던져도 나머지는 받음
//   node tools/tests/dom-watch.mjs <테마 루트>   (가짜 브라우저 tools/tests/leak-dom.mjs 의 MutationObserver · 가상 시계)
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
dom.installBrowser({});
const { watchDom, addedElements, domWatchStats } = await import(pathToFileURL(path.join(root, 'src/dom-watch.js')).href);
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };
const tick = async () => { for (let i = 0; i < 6; i++) await null; };   // 마이크로태스크(감시자 콜백) 뒤 — 가짜 브라우저의 setTimeout 은 가상 시계라 안 써요
let made = 0;
const RealMO = globalThis.MutationObserver;
globalThis.MutationObserver = class extends RealMO { constructor(cb) { super(cb); made++; } };
const body = document.body;
const chat = document.createElement('div'); chat.id = 'chat'; body.append(chat);
await tick();

await test('같은 뿌리(subtree)의 구독 셋은 감시자 하나로, 구독마다 원한 종류만 받아요', async () => {
    const before = made;
    const got = { child: [], cls: [], all: [] };
    const off1 = watchDom(chat, { childList: true, subtree: true }, r => got.child.push(...r));
    const off2 = watchDom(chat, { attributes: ['class'], subtree: true }, r => got.cls.push(...r));
    const off3 = watchDom(chat, { childList: true, attributes: ['class', 'style'], subtree: true }, r => got.all.push(...r));
    assert.equal(made - before, 1, '감시자 하나');
    const mes = document.createElement('div'); chat.append(mes); mes.className = 'mes'; mes.setAttribute('style', 'x'); mes.setAttribute('title', 't');
    await tick();
    assert.deepEqual(got.child.map(r => r.type), ['childList']);
    assert.deepEqual(got.cls.map(r => r.attributeName), ['class']);
    assert.deepEqual(got.all.map(r => r.type + ':' + (r.attributeName || '')), ['childList:', 'attributes:class', 'attributes:style']);
    off1(); off2(); off3();
    assert.equal(domWatchStats().roots, 0, '마지막 구독이 끊기면 뿌리도 끊어요');
    mes.className = 'mes x'; await tick();
    assert.equal(got.cls.length, 1, '끊은 뒤에는 안 받아요');
});

await test('subtree 없는 구독은 뿌리 자신의 기록만 받고, 여러 뿌리(body · #chat)를 감시자 하나로 봐요', async () => {
    const before = made;
    const a = [], b = [];
    const offA = watchDom(body, { attributes: ['class'] }, r => a.push(...r));
    const offB = watchDom(chat, { childList: true }, r => b.push(...r));
    const offC = watchDom(body, { attributes: ['data-generating'] }, () => {});
    assert.equal(made - before, 1, '자기만 보는 구독은 문서마다 감시자 하나');
    body.classList.add('salty'); chat.firstChild.classList.add('deep'); chat.append(document.createElement('div'));
    const inner = document.createElement('i'); chat.firstChild.append(inner);
    await tick();
    assert.equal(a.length, 1); assert.equal(a[0].target, body);
    assert.equal(b.length, 1, '#chat 바로 아래 추가만(안쪽 추가는 아님)'); assert.equal(b[0].target, chat);
    offB();
    chat.append(document.createElement('div')); body.classList.add('two'); await tick();
    assert.equal(b.length, 1, '끊은 뿌리는 더 안 받아요'); assert.equal(a.length, 2, '남은 뿌리는 그대로');
    offA(); offC();
});

await test("when:'frame' 은 그 사이 기록을 모아 다음 프레임에 한 번 — 끊으면 모아 둔 것도 버려요", async () => {
    const calls = [];
    const off = watchDom(chat, { childList: true, subtree: true, when: 'frame' }, r => calls.push(r.length));
    for (let i = 0; i < 5; i++) { chat.append(document.createElement('div')); await tick(); }
    assert.equal(calls.length, 0, '프레임 전에는 안 불러요');
    await dom.clock.advance(20);
    assert.deepEqual(calls, [5], '다섯 번 바뀌어도 한 번에 다섯 기록');
    chat.append(document.createElement('div')); await tick(); off(); await dom.clock.advance(20);
    assert.deepEqual(calls, [5], '끊으면 모아 둔 것은 안 불러요');
});

await test('한 구독이 던져도 다른 구독은 받고, skip 으로 고른 기록은 빼요', async () => {
    const got = [];
    const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
    const off1 = watchDom(chat, { childList: true, subtree: true }, () => { throw new Error('일부러'); });
    const off2 = watchDom(chat, { childList: true, subtree: true, skip: r => [...r.addedNodes].some(n => n.className === 'mine') }, r => got.push(...r));
    const mine = document.createElement('b'); mine.className = 'mine'; chat.append(mine); chat.append(document.createElement('u'));
    await tick(); console.warn = warn;
    assert.equal(got.length, 1, '내 것은 빼고 하나'); assert.equal(warned, 1, '던진 구독은 경고만');
    assert.equal(addedElements(got).size, 1);
    off1(); off2();
});

await test('자기만 보는 뿌리 여럿을 한꺼번에 끊으면 다음 마이크로태스크에 한 번만 다시 걸고, 남은 뿌리의 기록은 잃지 않아요', async () => {
    const boxes = [0, 1, 2, 3, 4].map(() => { const b = document.createElement('div'); body.append(b); return b; });
    const got = [];
    const offs = boxes.map((b, i) => watchDom(b, { childList: true }, r => got.push([i, r.length])));
    await tick();
    const proto = Object.getPrototypeOf(Object.getPrototypeOf(new MutationObserver(() => {})));
    const realObserve = proto.observe; let observes = 0; proto.observe = function (...a) { observes++; return realObserve.apply(this, a); };
    boxes[4].append(document.createElement('i'));   // 끊기 전에 쌓인 기록
    for (const off of offs.slice(0, 4)) off();
    assert.equal(observes, 0, '끊는 자리에서는 다시 안 걸어요');
    await tick();
    assert.equal(observes, 1, '남은 뿌리 하나만 한 번 다시 걸어요');
    assert.deepEqual(got, [[4, 1]], '쌓인 기록은 남은 구독이 받아요');
    proto.observe = realObserve; offs[4]();
});
await test('구독별 이름 · 횟수 · 시간이 진단에 보여요', async () => {
    const off = watchDom(body, { childList: true, subtree: true, name: '시험 구독' }, () => {});
    body.append(document.createElement('div')); await tick();
    const s = domWatchStats();
    const me = s.each.find(e => e.name === '시험 구독');
    assert.ok(me && me.calls === 1 && me.subtree === true);
    off();
});
console.log(`공용 감시자: ${pass}개 통과했어요.`);
process.exit(0);
