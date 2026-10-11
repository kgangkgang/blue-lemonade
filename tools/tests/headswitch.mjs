// 확장 위 스위치 (6.0.4, src/headswitch.js) — DOM 없이 되는 부분: 창 열쇠 · 후보 점수 · 설정 정리(headSwitches). 네트워크 · DOM 없음.
//   node tools/tests/headswitch.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const ctx = { extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() { ctx.saves = (ctx.saves || 0) + 1; }, characters: [], groups: [], characterId: undefined, groupId: null,
    eventSource: { on() {} }, event_types: {} };
globalThis.SillyTavern = { getContext: () => ctx };
const { getSettings, invalidateSettings } = await import(pathToFileURL(path.join(root, 'src/settings.js')));
const H = await import(pathToFileURL(path.join(root, 'src/headswitch.js')));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };

await test('창 열쇠: data-po-key → id → class(정렬) → 태그', () => {
    assert.equal(H.keyOf({ dataset: { poKey: 'id:x' }, id: 'y', classList: [] }), 'id:x');
    assert.equal(H.keyOf({ dataset: {}, id: 'autopic_settings_container', classList: ['a'] }), 'id:autopic_settings_container');
    assert.equal(H.keyOf({ dataset: {}, id: '', classList: ['inline-drawer', 'ap-root'] }), 'cls:ap-root.inline-drawer');
    assert.equal(H.keyOf({ dataset: {}, id: '', classList: [], tagName: 'DIV' }), 'tag:div');
});
await test('후보 점수: data-bl-master 100 · id/name 힌트 3 · 라벨 힌트 2 · 그 밖 1', () => {
    assert.equal(H.scoreOf({ master: true }), 100);
    for (const id of ['tts_enabled', 'qr--isEnabled', 'lm_active', 'x_toggle', 'autopic_on', 'use_x', 'enable']) assert.equal(H.scoreOf({ id }), 3, id);
    assert.equal(H.scoreOf({ name: 'enabled' }), 3);
    for (const text of ['사용', '켜기', '확장 켜짐', 'Enable extension', 'Active', '활성화', '작동']) assert.equal(H.scoreOf({ id: 'x', text }), 2, text);
    for (const id of ['translate_input', 'sd_refine', 'canon']) assert.equal(H.scoreOf({ id, text: '입력도 번역' }), 1, id);
});
await test('설정 정리: headSwitches 는 true 인 글자 열쇠만 · 그 밖은 지움 · 초기화에도 남는다', () => {
    ctx.extensionSettings.salty = { headSwitches: { 'id:a': true, 'id:b': 'yes', 'id:c': false, 7: true, '': true } };
    invalidateSettings();
    assert.deepEqual(getSettings().headSwitches, { 'id:a': true, '7': true }, 'true 인 글자 열쇠만 남는다 (숫자 열쇠는 글자가 된다)');
    ctx.extensionSettings.salty = { headSwitches: 'junk' };
    invalidateSettings();
    assert.deepEqual(getSettings().headSwitches, {});
    ctx.extensionSettings.salty = { headSwitches: Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`id:k${i}`, true])) };
    invalidateSettings();
    assert.equal(Object.keys(getSettings().headSwitches).length, 100, '100개까지');
});
await test('보이기 켜고 끄기: setShown 이 설정에 적고 저장한다', () => {
    ctx.extensionSettings.salty = {};
    invalidateSettings(); getSettings();
    const before = ctx.saves || 0;
    H.setShown('id:autopic_settings_container', true);
    assert.deepEqual(getSettings().headSwitches, { 'id:autopic_settings_container': true });
    assert.equal(H.isShown('id:autopic_settings_container'), true);
    H.setShown('id:autopic_settings_container', false);
    assert.deepEqual(getSettings().headSwitches, {});
    assert.ok((ctx.saves || 0) > before, '저장했다');
});
console.log(`${passed} tests passed`);
