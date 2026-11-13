// 7.7.4 시작 덮개 기다리기 — src/boot-gate.js
//   node tools/tests/boot-gate.mjs <테마 루트>
// 실리태번 첫 불러오기 덮개(#preloader)가 있으면 재는 일을 미뤘다가 덮개가 빠질 때 한 번에, 없으면 바로 한다.
// 1.2.2 덮개 동안 붙는 시트는 꺼 둔 채(holdSheet)였다가 걷히는 순간 대기자보다 먼저 한 번에 켠다 · 비치는 덮개 · 다른 문서 · APP_READY 안전망.
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


// ───── 1.2.2 덮개 동안 붙는 시트 모으기 (holdSheet) ─────
const sheetEl = (media = null, owner = globalThis.document) => {
    const attrs = new Map(); if (media != null) attrs.set('media', media);
    const log = [];
    return {
        ownerDocument: owner, log,
        getAttribute: n => (attrs.has(n) ? attrs.get(n) : null),
        setAttribute: (n, v) => { attrs.set(n, String(v)); log.push(`set ${n}=${v}`); },
        removeAttribute: n => { attrs.delete(n); log.push(`remove ${n}`); },
        hasAttribute: n => attrs.has(n),
        get media() { return attrs.get('media') ?? ''; },
        set media(v) { attrs.set('media', String(v)); log.push(`media=${v}`); },
    };
};
const listeners = new Map();
globalThis.SillyTavern = { getContext: () => ({
    event_types: { APP_READY: 'app_ready' },
    eventSource: {
        on: (name, fn) => { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
        removeListener: (name, fn) => { listeners.set(name, (listeners.get(name) || []).filter(f => f !== fn)); },
    },
}) };
const emit = name => { for (const fn of [...(listeners.get(name) || [])]) fn(); };

await test('덮개(불투명) 동안 붙은 시트는 꺼 뒀다가 걷히는 순간 원래 media 로 — 대기자보다 먼저 켜요', async () => {
    addCover(); listeners.clear();
    const gate = await load();
    gate.coverOpaque(true);
    const plain = sheetEl(), printed = sheetEl('print'), all = sheetEl('all');
    assert.equal(gate.holdSheet(plain), true);
    assert.equal(gate.holdSheet(printed), true);
    assert.equal(gate.holdSheet(all), true);
    assert.equal(gate.holdSheet(plain), true, '두 번 불러도 처음 값을 기억');
    for (const el of [plain, printed, all]) assert.equal(el.getAttribute('media'), 'not all');
    assert.equal(gate.heldSheets(), 3);
    const seen = [];
    gate.afterBoot(() => seen.push([plain.getAttribute('media'), printed.getAttribute('media'), all.getAttribute('media')]));
    assert.equal(observers.filter(o => o.on).length, 1, '관찰자는 하나(대기자와 같이 씀)');
    removeCover();
    assert.deepEqual(seen, [[null, 'print', 'all']], '대기자가 부를 때는 이미 켜져 있어요');
    assert.equal(gate.heldSheets(), 0);
    assert.equal(gate.holdSheet(sheetEl()), false, '걷힌 뒤에는 꺼 두지 않아요');
});

await test('대기자가 없어도 걷히면 켜요 — 덮개가 일찍 걷혀도(오류 · 다른 확장이 로더를 닫음) 같은 순간', async () => {
    addCover();
    const gate = await load();
    gate.coverOpaque(true);
    const el = sheetEl();
    gate.holdSheet(el);
    assert.equal(observers.filter(o => o.on).length, 1, 'holdSheet 가 덮개를 지켜봐요');
    removeCover();
    assert.equal(el.getAttribute('media'), null);
});

await test('덮개가 비치면(테마 끔 · 확장만 · 반투명 바탕) 꺼 두지 않아요 — 비치게 바뀌면 꺼 둔 것도 바로 켜요', async () => {
    addCover();
    const gate = await load();
    const el = sheetEl();
    assert.equal(gate.holdSheet(el), false, '처음(알림 전)은 비친다고 봐요');
    assert.equal(el.getAttribute('media'), null);
    gate.coverOpaque(true);
    const held = sheetEl('all');
    gate.holdSheet(held);
    assert.equal(held.getAttribute('media'), 'not all');
    gate.coverOpaque(false);
    assert.equal(held.getAttribute('media'), 'all', '비치게 되면 바로 켜요');
    assert.equal(gate.holdSheet(sheetEl()), false);
    removeCover();
});

await test('덮개가 없거나 다른 문서(채팅 iframe)의 시트면 아무것도 안 해요', async () => {
    cover = null;
    let gate = await load();
    gate.coverOpaque(true);
    const el = sheetEl();
    assert.equal(gate.holdSheet(el), false);
    assert.deepEqual(el.log, []);
    addCover();
    gate = await load();
    gate.coverOpaque(true);
    const other = sheetEl(null, { other: true });
    assert.equal(gate.holdSheet(other), false);
    assert.deepEqual(other.log, []);
    removeCover();
});

await test('꺼 둔 동안 setSheetMedia 는 켤 때 쓸 값만 바꾸고, sheetMedia 는 그 값을 알려요', async () => {
    addCover();
    const gate = await load();
    gate.coverOpaque(true);
    const on = sheetEl('all'), off = sheetEl('all');
    gate.holdSheet(on); gate.holdSheet(off);
    gate.setSheetMedia(off, 'not all');
    gate.setSheetMedia(on, 'all');
    assert.equal(on.getAttribute('media'), 'not all', '지금 바로 켜지 않아요');
    assert.equal(gate.sheetMedia(on), 'all');
    assert.equal(gate.sheetMedia(off), 'not all');
    removeCover();
    assert.equal(on.getAttribute('media'), 'all');
    assert.equal(off.getAttribute('media'), 'not all', '끄기로 바뀐 시트는 꺼진 채');
    const plain = sheetEl();
    gate.setSheetMedia(plain, 'all');
    assert.equal(plain.media, 'all', '꺼 두지 않은 시트는 바로');
    gate.setSheetMedia(plain, '');
    assert.equal(plain.getAttribute('media'), null);
});

await test('꺼 둔 뒤 다른 코드가 media 를 직접 바꾸면 그 값을 그대로 둬요', async () => {
    addCover();
    const gate = await load();
    gate.coverOpaque(true);
    const el = sheetEl('print');
    gate.holdSheet(el);
    el.media = 'screen';
    removeCover();
    assert.equal(el.getAttribute('media'), 'screen');
});

await test('안전망: 덮개가 안 걷힌 채 APP_READY 가 오면 시트만은 켜고, 그 뒤로는 꺼 두지 않아요 (대기자는 덮개를 따라요)', async () => {
    addCover(); listeners.clear();
    const gate = await load();
    gate.coverOpaque(true);
    const el = sheetEl();
    gate.holdSheet(el);
    gate.holdSheet(sheetEl());
    assert.equal((listeners.get('app_ready') || []).length, 1, 'APP_READY 를 한 번만 들어요');
    let ran = 0;
    gate.afterBoot(() => ran++);
    emit('app_ready');
    assert.equal(el.getAttribute('media'), null);
    assert.equal(ran, 0, 'afterBoot 는 예전처럼 덮개가 걷힐 때');
    assert.equal((listeners.get('app_ready') || []).length, 0, '듣기를 뗐어요');
    assert.equal(gate.holdSheet(sheetEl()), false);
    removeCover();
    assert.equal(ran, 1);
});

await test('시트 하나가 켜다 오류여도 나머지는 켜고 대기자도 돌아요', async () => {
    addCover();
    const gate = await load();
    gate.coverOpaque(true);
    const bad = sheetEl(); const good = sheetEl();
    gate.holdSheet(bad); gate.holdSheet(good);
    bad.removeAttribute = () => { throw new Error('x'); };
    const errors = []; const original = console.error; console.error = (...a) => errors.push(a);
    let ran = 0;
    try { gate.afterBoot(() => ran++); removeCover(); } finally { console.error = original; }
    assert.equal(good.getAttribute('media'), null);
    assert.equal(ran, 1);
    assert.equal(errors.length, 1);
});

console.log(`\nboot-gate: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
