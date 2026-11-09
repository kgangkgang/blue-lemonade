// 꾸미기 되돌리기 보관함 (src/appearance-archive.js) — 한도 · 같은 모습 중복 · 잠금과 상관없이 복구
//   node tools/tests/unit-appearance-archive.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-appearance-archive');
const { DEFAULTS } = await load('src/settings.js');
const { HISTORY_LIMIT, appearanceArchive, rememberAppearance, restoreAppearance } = await load('src/appearance-archive.js');
const fresh = () => structuredClone(DEFAULTS);

await test('appearanceArchive: 모양이 틀린 칸(id 없음 · 시각 없음 · data 가 배열)은 걸러내고 한도까지만', () => {
    const good = { id: 'a', at: 1, data: { type: {} } };
    const list = appearanceArchive({ appearanceHistory: [good, null, { id: 1, at: 1, data: {} }, { id: 'b', at: NaN, data: {} }, { id: 'c', at: 1, data: [] }, { id: 'd', at: 1 }] });
    assert.deepEqual(list, [good]);
    assert.deepEqual(appearanceArchive({}), []);
    assert.deepEqual(appearanceArchive({ appearanceHistory: 'x' }), []);
    const many = Array.from({ length: 30 }, (_, i) => ({ id: 'i' + i, at: i, data: {} }));
    assert.equal(appearanceArchive({ appearanceHistory: many }).length, HISTORY_LIMIT);
});

await test('rememberAppearance: 처음엔 담고, 모습이 같으면 또 담지 않아요', () => {
    const s = fresh();
    assert.equal(rememberAppearance(s), true);
    assert.equal(s.appearanceHistory.length, 1);
    assert.equal(rememberAppearance(s), true);
    assert.equal(s.appearanceHistory.length, 1);
    s.type.size = (s.type.size || 16) + 3;
    assert.equal(rememberAppearance(s, '글자 키움'), true);
    assert.equal(s.appearanceHistory.length, 2);
    assert.equal(s.appearanceHistory[0].label, '글자 키움', '새 것이 맨 앞');
});

await test('rememberAppearance: 이름표는 60자까지, 한도를 넘기면 오래된 것부터 버려요', () => {
    const s = fresh();
    for (let i = 0; i < HISTORY_LIMIT + 4; i++) { s.type.size = 10 + i; rememberAppearance(s, '가'.repeat(100)); }
    assert.equal(s.appearanceHistory.length, HISTORY_LIMIT);
    assert.equal(s.appearanceHistory[0].label.length, 60);
    assert.equal(s.appearanceHistory[0].data.type.size, 10 + HISTORY_LIMIT + 3);
});

await test('rememberAppearance: 한 칸이 1MB 를 넘으면 담지 못하고 false (보관함은 그대로)', () => {
    const s = fresh();
    s.fonts = { ...s.fonts, huge: 'x'.repeat(1_100_000) };
    const before = s.appearanceHistory;
    assert.equal(rememberAppearance(s), false);
    assert.equal(s.appearanceHistory, before);
});

await test('restoreAppearance: 고른 칸의 모습으로 되돌리고 되돌리기 전 모습을 새로 담아요', () => {
    const s = fresh();
    const original = s.type.size;
    rememberAppearance(s, '처음');
    s.type.size = original + 9;
    rememberAppearance(s, '바꾼 뒤');
    const id = s.appearanceHistory.find(x => x.label === '처음').id;
    s.type.size = original + 20;
    assert.equal(restoreAppearance(s, id), true);
    assert.equal(s.type.size, original);
    assert.equal(s.appearanceHistory[0].label, '복구하기 전');
    assert.equal(s.appearanceHistory[0].data.type.size, original + 20);
});

await test('restoreAppearance: 글자 크기 잠금이 켜져 있어도 복구는 그 값을 되돌리고, 잠금 설정은 그대로 남아요', () => {
    const s = fresh();
    const original = s.type.size;
    rememberAppearance(s, '처음');
    const id = s.appearanceHistory[0].id;
    s.type.size = original + 5;
    s.settingLocks = { size: true };
    restoreAppearance(s, id);
    assert.equal(s.type.size, original);
    assert.deepEqual(s.settingLocks, { size: true });
});

await test('restoreAppearance: 없는 id 는 false 이고 설정을 건드리지 않아요', () => {
    const s = fresh();
    s.type.size = 77;
    assert.equal(restoreAppearance(s, 'nope'), false);
    assert.equal(s.type.size, 77);
    assert.deepEqual(s.appearanceHistory, []);
});

await test('restoreAppearance: 되돌리기 전 모습을 못 담으면 알림 콜백을 불러요', () => {
    const s = fresh();
    rememberAppearance(s, '처음');
    const id = s.appearanceHistory[0].id;
    s.type.size = 41;
    s.fonts = { ...s.fonts, huge: 'x'.repeat(1_100_000) };
    let called = 0;
    assert.equal(restoreAppearance(s, id, () => called++), true);
    assert.equal(called, 1);
});

done();
