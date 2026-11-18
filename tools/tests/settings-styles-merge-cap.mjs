// 버그 사냥 2(1.7.8 거리) — 두 기기 합치기로 내 스타일이 상한(20)을 넘으면 정리가 뒤쪽을 잘라 이 탭이 만든 스타일 · 캐릭터 연결이 조용히 사라지던 것.
//   상한은 저장할 때(새로 만들기 · 가져오기) 기기마다만 보고, 합친 목록은 넘쳐도 남겨요(정리는 깨진 항목만 · 아주 큰 목록만 자름).
//   node tools/tests/settings-styles-merge-cap.mjs <테마 루트>
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('settings-styles-merge-cap');
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {}, eventSource: { on() {} }, event_types: {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
const cl = { add() {}, remove() {}, toggle() {}, contains: () => false };
globalThis.document = { createElement: () => ({ style: {} }), addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, head: { append() {} }, body: { classList: cl, dataset: {} }, documentElement: { style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: cl } };
const S = await load('src/settings.js');
const Y = await load('src/settings-sync.js');
const { MAX_STYLES } = await load('src/styles.js');
const st = id => ({ id, name: id, data: { palette: 'salt' } });

await test('합쳐서 20개를 넘어도 두 기기 스타일 · 캐릭터 연결이 다 남아요', () => {
    const base = structuredClone(S.getSettings()); base.styles = Array.from({ length: 12 }, (_, i) => st('b' + i)); base.charStyles = {};
    const local = structuredClone(base); local.styles.push(...Array.from({ length: 8 }, (_, i) => st('pc' + i))); local.charStyles = { 'c:pc.png': 'pc7' };
    const remote = structuredClone(base); remote.styles.push(...Array.from({ length: 8 }, (_, i) => st('ph' + i))); remote.charStyles = { 'c:ph.png': 'ph7' };
    ctx.extensionSettings.salty = local; S.invalidateSettings();
    Y.mergeSalty(S.getSettings(), structuredClone(base), remote);
    S.invalidateSettings(); const s = S.getSettings();
    assert.equal(s.styles.length, 28);
    for (const id of ['b0', 'pc0', 'pc7', 'ph0', 'ph7']) assert.ok(s.styles.some(x => x.id === id), id);
    assert.deepEqual(Object.keys(s.charStyles).sort(), ['c:pc.png', 'c:ph.png']);
});
await test('저장 상한은 그대로 20 · 깨진 항목은 예전처럼 걸러요 · 아주 큰 목록은 잘라요', () => {
    assert.equal(MAX_STYLES, 20);
    ctx.extensionSettings.salty = { styles: [st('a'), null, { id: '', data: {} }, { id: 'x' }, st('b')] }; S.invalidateSettings();
    assert.deepEqual(S.getSettings().styles.map(x => x.id), ['a', 'b']);
    ctx.extensionSettings.salty = { styles: Array.from({ length: 200 }, (_, i) => st('s' + i)) }; S.invalidateSettings();
    const n = S.getSettings().styles.length;
    assert.ok(n >= 40 && n < 200, String(n));
});
done();
