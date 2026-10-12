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
await test('6.1.8 줄 이름은 모든 창에서 「확장 탭에 보이기」 하나 (확장 이름 · 켜기 이름 없이) — 사용자: 「~위에도 보이기 … 확장탭에 보이기로 이름 다 통일해 줘」', async () => {
    assert.equal(H.ROW_LABEL, '확장 탭에 보이기');
    const fs = await import('node:fs');
    const src = fs.readFileSync(path.join(root, 'src/headswitch.js'), 'utf8');
    assert.ok(src.includes("opt.setAttribute('aria-label', ROW_LABEL);"), '스위치 이름표도 같은 이름');
    assert.ok(src.includes('setText(row.firstElementChild, ROW_LABEL);'), '줄 글자는 창마다 바뀌지 않는다');
    const code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
    assert.ok(!code.includes('위에도 보이기'), '옛 이름이 코드에 남지 않음 (주석의 바뀐 기록만)');
    for (const f of ['src/settings.js', 'src/features.js', 'css/64-headswitch.css']) assert.ok(!fs.readFileSync(path.join(root, f), 'utf8').includes('위에도 보이기'), f);
});
await test('6.2.0 (ui-density-620d) 켜기 스위치가 없는 창: data-bl-master="none" 이면 줄을 만들지 않고, id 가운데 -use- 는 힌트가 아니다 (한글화 패널 #pt-use-proxy 오인)', async () => {
    assert.equal(H.scoreOf({ id: 'pt-use-proxy' }), 1, '가운데 -use- 는 힌트 아님');
    for (const id of ['use_x', 'autopic_on', 'on', 'use']) assert.equal(H.scoreOf({ id }), 3, id);
    const box = (blMaster, found = []) => { const content = { querySelector: sel => sel === '[data-bl-master]' && blMaster !== undefined ? { dataset: { blMaster } } : null, querySelectorAll: () => found };
        return { querySelector: sel => sel === ':scope > .inline-drawer-content' ? content : null }; };
    assert.equal(H.masterOf(box('none')), null, 'none 이면 스위치 없음');
    assert.deepEqual(H.masterOf(box('')), { dataset: { blMaster: '' } }, '그냥 data-bl-master 는 그 요소');
    const fs = await import('node:fs');
    assert.ok(fs.readFileSync(path.join(root, 'src/addons/prompt/settings-ui.js'), 'utf8').includes('<span hidden data-bl-master="none"></span>'), '한글화 패널은 켜기 스위치 없음을 밝힌다');
});
console.log(`${passed} tests passed`);
