// 설정 잠금 (src/setting-locks.js) — 잠근 묶음의 값은 설정을 덮어쓴 뒤에도 되돌려 놓아야 해요
//   node tools/tests/unit-setting-locks.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-setting-locks');
const { LOCK_GROUPS, preserveLocks } = await load('src/setting-locks.js');

await test('묶음 이름표는 겹치지 않고 경로가 모두 점 경로예요', () => {
    const ids = LOCK_GROUPS.map(g => g[0]);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(ids, ['fonts', 'size', 'spacing', 'colors', 'profile']);
    const all = LOCK_GROUPS.flatMap(g => g[2]);
    assert.equal(new Set(all).size, all.length, '한 경로가 두 묶음에 들면 안 돼요');
    for (const p of all) assert.match(p, /^[A-Za-z]+(\.[A-Za-z]+)*$/);
    assert.ok(LOCK_GROUPS.find(g => g[0] === 'spacing')[2].includes('markdown.hrWidth'), '문단 · 여백 묶음에 마크다운 여백이 붙어요');
});

await test('잠그지 않았으면 아무것도 되돌리지 않아요', () => {
    const s = { type: { size: 16 }, settingLocks: { size: false } };
    const restore = preserveLocks(s);
    s.type.size = 30;
    restore();
    assert.equal(s.type.size, 30);
});

await test('잠근 묶음만 덮어쓴 뒤 되돌려요 (다른 묶음은 새 값 그대로)', () => {
    const s = { type: { size: 16, lineHeight: 1.6 }, fonts: { ko: 'A' }, settingLocks: { size: true } };
    const restore = preserveLocks(s);
    s.type.size = 30; s.type.lineHeight = 2; s.fonts.ko = 'B';
    restore();
    assert.equal(s.type.size, 16);
    assert.equal(s.type.lineHeight, 2);
    assert.equal(s.fonts.ko, 'B');
});

await test('잠글 때 값이 없던 칸은 덮어쓴 뒤 지워 원래대로(없음)로 되돌려요', () => {
    const s = { type: {}, settingLocks: { size: true } };
    const restore = preserveLocks(s);
    s.type.size = 99;
    restore();
    assert.ok(!('size' in s.type));
});

await test('잠금 때의 값은 복사해 둬요 — 객체를 제자리에서 고쳐도 되돌아와요', () => {
    const s = { fonts: { ko: 'A', list: [1, 2] }, settingLocks: { fonts: true } };
    const restore = preserveLocks(s);
    s.fonts.list.push(3); s.fonts.ko = 'Z';
    restore();
    assert.deepEqual(s.fonts, { ko: 'A', list: [1, 2] });
});

await test('위 칸이 통째로 사라졌어도 되돌릴 때 위 칸을 새로 만들어요', () => {
    const s = { type: { size: 16 }, settingLocks: { size: true } };
    const restore = preserveLocks(s);
    delete s.type;
    restore();
    assert.equal(s.type.size, 16);
});

await test('source 를 따로 주면 그쪽 값을 잠금값으로 써요 (가져오기 전 설정을 지키는 쓰임)', () => {
    const live = { type: { size: 18 }, settingLocks: { size: true } };
    const incoming = { type: { size: 40 }, settingLocks: {} };
    const restore = preserveLocks(incoming, live, live.settingLocks);
    restore();
    assert.equal(incoming.type.size, 18);
});

await test('settingLocks 가 아예 없어도 던지지 않아요', () => {
    const s = { type: { size: 1 } };
    assert.doesNotThrow(() => preserveLocks(s)());
});

done();
