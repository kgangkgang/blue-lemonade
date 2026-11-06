// 화면에 스위치가 있는 키는 기본값 표에 있어야 검색 스위치 · AI 목록 · 「변경한 설정」 · 항목별 복원이 돌아요. 값은 지금 동작과 같아요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.window = globalThis; globalThis.addEventListener = () => {};
globalThis.document = { createElement: () => ({ style: {} }), addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, head: { append() {} }, body: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, dataset: {} }, documentElement: { style: { setProperty() {}, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } } };
const S = await import(new URL('src/settings.js', root));
const D = await import(new URL('src/settings-differences.js', root));
const expected = { 'chat.inkContrast': true, syncWatch: false, 'chat.triangleFold': false, 'chat.weatherBubble': 70, 'chat.qrCtxNames': false };
const read = (from, key) => key.split('.').reduce((o, k) => o?.[k], from);
for (const [key, value] of Object.entries(expected)) assert.equal(read(S.DEFAULTS, key), value, `${key} 기본값`);
// 8.2.5 저장값 유지: 끈 값은 그대로 남고, 키가 없던 사람은 지금 동작과 같은 값을 받아요
ctx.extensionSettings = { salty: { chat: { inkContrast: false, weatherBubble: 40 }, syncWatch: false } };
S.invalidateSettings();
let s = S.getSettings();
assert.equal(s.chat.inkContrast, false); assert.equal(s.syncWatch, false); assert.equal(s.chat.weatherBubble, 40); assert.equal(s.chat.qrCtxNames, false);
// 변경한 설정에 뜨고 항목별로 복원돼요
const raw = structuredClone(S.DEFAULTS);
Object.assign(raw.chat, { inkContrast: false, triangleFold: true, weatherBubble: 40, qrCtxNames: true }); raw.syncWatch = true;
ctx.extensionSettings = { salty: raw };
S.invalidateSettings(); s = S.getSettings();
const listed = D.changedSettings(s).map(c => c.path);
for (const key of Object.keys(expected)) {
    assert.ok(listed.includes(key), `${key} 가 변경 목록에 떠요`);
    assert.equal(D.resetSetting(s, key), true, `${key} 복원`);
    assert.equal(read(s, key), expected[key]);
}
assert.deepEqual(D.settingRoute('syncWatch'), { tab: 'chat', sub: 'etc' });
assert.deepEqual(D.settingRoute('chat.triangleFold'), { tab: 'chat', sub: 'etc' });
assert.deepEqual(D.settingRoute('chat.inkContrast'), { tab: 'chat', sub: 'screen' });
const { SETTING_LABELS } = await import(new URL('src/settings-labels.js', root));
for (const key of Object.keys(expected)) assert.ok(SETTING_LABELS[key], `${key} 라벨`);
// 옛 스크립트의 「접기」를 켰던 사람은 키가 없어도 그대로 켜져 있어요
for (const [old, want] of [[true, true], [false, false], [undefined, false]]) {
    ctx.extensionSettings = { salty: { chat: {} }, blue_lemonade_scripts: { enabled: old === undefined ? {} : { fold: old } } };
    S.invalidateSettings();
    assert.equal(S.getSettings().chat.triangleFold, want, `옛 값 ${old}`);
}
console.log('PASS 스위치 있는 키가 기본값 표 · 변경 목록 · 복원에 다 들어가요');
