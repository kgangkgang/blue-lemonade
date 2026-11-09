// 설정 되돌리기 · 다시 하기 (src/settings-history.js) — 바뀐 가지만 기억하는 세션 기록
//   node tools/tests/unit-settings-history.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-settings-history');
const { SettingsHistory } = await load('src/settings-history.js');

await test('한 번 바꾸고 되돌리기 · 다시 하기가 값을 오가요', () => {
    const h = new SettingsHistory(), s = { type: { size: 16 }, a: 1 };
    h.run(s, x => { x.type.size = 20; });
    assert.deepEqual(h.step(s), [{ path: 'type.size', from: 20, to: 16 }]);
    assert.equal(s.type.size, 16);
    assert.deepEqual(h.step(s, true), [{ path: 'type.size', from: 16, to: 20 }]);
    assert.equal(s.type.size, 20);
});

await test('할 것이 없으면 빈 목록 · 변화가 없으면 쌓지 않아요', () => {
    const h = new SettingsHistory(), s = { a: 1 };
    assert.deepEqual(h.step(s), []);
    assert.deepEqual(h.step(s, true), []);
    h.run(s, x => { x.a = 1; });
    assert.equal(h.undoStack.length, 0);
});

await test('새 변경은 다시 하기 칸을 비워요', () => {
    const h = new SettingsHistory(), s = { a: 1 };
    h.run(s, x => { x.a = 2; });
    h.step(s);
    assert.equal(h.redoStack.length, 1);
    h.run(s, x => { x.a = 3; });
    assert.equal(h.redoStack.length, 0);
});

await test('같은 group 으로 이어 바꾸면 한 단계로 묶이고, 다른 group 이 오면 앞 것을 끊어요', () => {
    const h = new SettingsHistory(), s = { a: 0, b: 0 };
    h.run(s, x => { x.a = 1; }, 'slider');
    h.run(s, x => { x.a = 2; }, 'slider');
    h.run(s, x => { x.a = 3; }, 'slider');
    assert.equal(h.undoStack.length, 0, '아직 묶음이 열려 있음');
    h.run(s, x => { x.b = 1; }, 'other');
    assert.equal(h.undoStack.length, 1);
    h.flush(s);
    assert.equal(h.undoStack.length, 2);
    h.step(s);
    assert.equal(s.b, 0);
    h.step(s);
    assert.equal(s.a, 0, '슬라이더 세 번이 한 번에 되돌아와요');
});

await test('step 은 열려 있는 묶음을 먼저 마무리해요', () => {
    const h = new SettingsHistory(), s = { a: 0 };
    h.run(s, x => { x.a = 5; }, 'g');
    assert.equal(h.step(s).length, 1);
    assert.equal(s.a, 0);
});

await test('배열 · 객체 값은 복사해 두니 나중에 제자리에서 고쳐도 기록이 안 변해요', () => {
    const h = new SettingsHistory(), s = { list: [1, 2], o: { k: 1 } };
    h.run(s, x => { x.list.push(3); x.o.k = 2; });
    s.list.push(99);
    h.step(s);
    assert.deepEqual(s.list, [1, 2]);
    assert.equal(s.o.k, 1);
});

await test('키를 새로 만들거나 지운 변화도 되돌려요 (없음 ↔ 값)', () => {
    const h = new SettingsHistory(), s = { a: 1 };
    h.run(s, x => { x.nova = { deep: 1 }; delete x.a; });
    h.step(s);
    assert.ok(!('nova' in s));
    assert.equal(s.a, 1);
    h.step(s, true);
    assert.ok(!('a' in s));
    assert.deepEqual(s.nova, { deep: 1 });
});

await test('version · noticeSeen · appearanceHistory 는 기록에서 빼요 (되돌리기가 버전을 낮추면 안 돼요)', () => {
    const h = new SettingsHistory(), s = { version: 1, noticeSeen: 1, appearanceHistory: [], a: 1 };
    h.run(s, x => { x.version = 2; x.noticeSeen = 2; x.appearanceHistory = [{}]; });
    assert.equal(h.undoStack.length, 0);
    h.run(s, x => { x.version = 3; x.a = 2; });
    h.step(s);
    assert.equal(s.version, 3);
    assert.equal(s.a, 1);
});

await test('__proto__ · constructor 키는 기록하지 않아요 (원형 오염 막기)', () => {
    const h = new SettingsHistory(), s = { a: 1 };
    h.run(s, x => { Object.defineProperty(x, '__proto__', { value: { evil: 1 }, enumerable: true, configurable: true, writable: true }); x.constructor = 5; x.a = 2; });
    const changes = h.step(s);
    assert.deepEqual(changes.map(c => c.path), ['a']);
    assert.equal(({}).evil, undefined);
});

await test('개수 한도를 넘기면 오래된 것부터 버리되 마지막 한 단계는 남겨요', () => {
    const h = new SettingsHistory(3), s = { a: 0 };
    for (let i = 1; i <= 6; i++) h.run(s, x => { x.a = i; });
    assert.equal(h.undoStack.length, 3);
    h.step(s); h.step(s); h.step(s);
    assert.equal(s.a, 3, '앞의 세 단계는 잊었어요');
    const tiny = new SettingsHistory(40, 1);
    tiny.run(s, x => { x.a = 'x'.repeat(100); });
    assert.equal(tiny.undoStack.length, 1, '크기가 한도를 넘어도 최소 한 단계');
});

await test('clear: 기록과 열린 묶음을 모두 비워요', () => {
    const h = new SettingsHistory(), s = { a: 0 };
    h.run(s, x => { x.a = 1; });
    h.run(s, x => { x.a = 2; }, 'g');
    h.clear();
    assert.deepEqual([h.undoStack.length, h.redoStack.length, h.pending], [0, 0, null]);
    assert.deepEqual(h.step(s), []);
});

done();
