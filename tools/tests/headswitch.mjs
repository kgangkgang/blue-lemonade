// 확장 위 스위치 (6.0.4, src/headswitch.js) — DOM 없이 되는 부분: 창 열쇠 · 후보 점수 · 설정 정리(headSwitches). 네트워크 · DOM 없음.
//   node tools/tests/headswitch.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
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
await test('6.1.8 줄 이름은 모든 창에서 「확장 탭에 보이기」 하나 (확장 이름 · 켜기 이름 없이)', async () => {
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
await test('6.8.8 줄 끄기: headSwitchRows 기본 켬 · 끄면 그대로 · 줄도 스위치도 없으면 모듈이 쉰다 · ✦ 메뉴 오른쪽 여백', async () => {
    ctx.extensionSettings.salty = {};
    invalidateSettings();
    assert.equal(getSettings().headSwitchRows, true, '기본 켬 (지금 그대로)');
    ctx.extensionSettings.salty = { headSwitchRows: false };
    invalidateSettings();
    assert.equal(getSettings().headSwitchRows, false);
    ctx.extensionSettings.salty = { headSwitchRows: 'junk' };
    invalidateSettings();
    assert.equal(getSettings().headSwitchRows, true, '이상한 값은 기본으로');
    const fs = await import('node:fs');
    const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
    assert.match(read('src/headswitch.js'), /if \(!rowsOn\) row\?\.remove\(\);/);
    assert.match(read('src/features.js'), /const headSwitchWanted = on && \(s\.headSwitchRows !== false \|\| Object\.keys\(s\.headSwitches \|\| \{\}\)\.some\(k => !Object\.hasOwn\(s\.headSwitchMove\?\.done \|\| \{\}, k\)\)\);/);
    assert.match(read('src/panel.js'), /toggle\('headSwitchRows', s\.headSwitchRows !== false\)/);
    assert.match(read('css/03-menus.css'), /#extensionsMenu#extensionsMenu > div:not\(\.extension_container\) \{\s*padding-right: 16px !important;/);
});
await test('6.8.9 테마를 끈 서랍 제목 줄: 한 줄(ⓒ 는 버전 옆) · 위아래 틈 — 테마를 켠 화면은 그대로', async () => {
    const fs = await import('node:fs');
    const css = fs.readFileSync(path.join(root, 'css/19-extwindows.css'), 'utf8');
    assert.match(css, /body:not\(\.salty\) #rm_extensions_block #salty-drawer > \.inline-drawer-header > b\{display:inline-flex!important;[^}]*flex-wrap:nowrap!important;[^}]*white-space:nowrap!important/);
    assert.match(css, /body:not\(\.salty\) #rm_extensions_block #salty-drawer > \.inline-drawer-header\{align-items:center!important;padding-top:8px!important;padding-bottom:8px!important\}/);
    assert.ok(!/body\.salty[^{]*#salty-drawer > \.inline-drawer-header\{[^}]*padding-top:8px/.test(css), '테마를 켠 화면 규칙은 건드리지 않는다');
    const chat = fs.readFileSync(path.join(root, 'css/05-chat.css'), 'utf8');
    assert.match(chat, /body\.salty #chat \.mes\[is_system="true"\] \.ch_name \.alignItemsBaseline \{\s*flex-wrap: nowrap;/, '숨긴 메시지 머리줄은 한 줄');
    assert.match(chat, /body\.salty #chat \.mes\[is_system="true"\] \.ch_name \.timestamp \{\s*flex: 0 1 auto;/, '날짜가 모자라면 줄어듦');
});
await test('1.4.x 통합: 애드온을 나눠 시작하는 동안은 열쇠 번호를 안 매기고, 끝나면 한 번 다시 그려요(addon-start-state.js)', async () => {
    const S = await import(pathToFileURL(path.join(root, 'src/addon-start-state.js')));
    let calls = 0; const fn = () => calls++;
    S.whenSpreadSettled(fn); assert.equal(calls, 1, '나눠 시작이 없으면 바로');
    S.spreadBegin(); S.spreadBegin();
    assert.equal(S.spreadPending(), true);
    S.whenSpreadSettled(fn); S.whenSpreadSettled(fn);
    S.spreadEnd(); assert.equal(calls, 1, '하나 남았으면 아직');
    S.spreadEnd(); assert.equal(calls, 2, '다 끝나면 한 번만'); assert.equal(S.spreadPending(), false);
    const src = fs.readFileSync(path.join(root, 'src/headswitch.js'), 'utf8');
    const body = src.slice(src.indexOf('export function refresh()'));
    assert.ok(body.indexOf('spreadPending()') >= 0 && body.indexOf('spreadPending()') < body.indexOf('dataset.blHsKey'), 'refresh 가 열쇠를 매기기 전에 나눠 시작을 봐요');
    assert.match(body, /< 6000/, '6초까지만 기다려요');
});
await test('1.4.x 통합(덧 3): 이름 없는 창은 이름 열쇠로 — data-i18n → 감싼 id → 제목 글자 · 이미 안정된 열쇠는 그대로', () => {
    const el = ({ id = '', cls = ['inline-drawer'], parent = null, closest = null } = {}) => ({ id, dataset: {}, classList: cls, parentElement: parent, closest: () => closest, tagName: 'DIV' });
    const col = { id: 'extensions_settings', parentElement: null };
    const head = i18n => ({ querySelector: sel => sel === '[data-i18n]' && i18n ? { getAttribute: () => i18n } : null,
        querySelectorAll: sel => sel === '[data-i18n]' && i18n ? [{ getAttribute: () => i18n, closest: () => null }] : [], contains: () => true });
    assert.equal(H.stableKeyOf(el({ id: 'salty-drawer' }), head('')), 'id:salty-drawer', 'id 는 그대로');
    assert.equal(H.stableKeyOf(el({ cls: ['inline-drawer', 'ap-root'] }), head('')), 'cls:ap-root.inline-drawer', '이름 있는 class 는 그대로');
    const wrap = { id: 'qr--settings', parentElement: { id: 'qr_container', parentElement: col } };
    assert.equal(H.stableKeyOf(el({ parent: wrap, closest: col }), head('Quick Reply')), 't:Quick Reply', '제목 data-i18n 먼저');
    assert.equal(H.stableKeyOf(el({ parent: wrap, closest: col }), head('')), 'in:qr--settings', '없으면 가장 가까운 감싼 id');
    assert.ok(H.LEGACY_KEY.test('cls:inline-drawer') && H.LEGACY_KEY.test('cls:inline-drawer#8') && !H.LEGACY_KEY.test('cls:ap-root.inline-drawer'));
});
await test('1.4.6 검토 2: 옛 번호 열쇠 알아보기 = 확장 순서 애드온 기준(공용 틀 class 뿐)', () => {
    for (const k of ['cls:inline-drawer', 'cls:inline-drawer#8', 'cls:inline-drawer.wide100p', 'cls:inline-drawer.wide100p#3', 'cls:flex-container.inline-drawer', 'tag:div#2']) assert.ok(H.isLegacyKey(k), k);
    for (const k of ['cls:ap-root.inline-drawer', 'id:salty-drawer', 't:Quick Reply', 'u:cls:inline-drawer#2', 'x:이름']) assert.ok(!H.isLegacyKey(k), k);
    const src = fs.readFileSync(path.join(root, 'src/headswitch.js'), 'utf8');
    assert.match(src, /import \{ ambiguousLegacyKey \} from '\.\/addons\/order\/panel-keys\.js';/, '같은 함수를 써요');
});
await test('1.4.6 검토 1: 옮기기 짝 — 남은 옛 열쇠만 · 켜기 스위치와 이름 열쇠가 있는 창만 · 기록(done)이 있으면 다시 안 함', () => {
    const hs = { 'cls:inline-drawer#8': true, 'cls:inline-drawer#7': true, 'cls:ap-root.inline-drawer': true };
    const pairs = [
        { legacy: 'cls:inline-drawer#8', stable: 't:Quick Reply', master: true },
        { legacy: 'cls:inline-drawer#7', stable: 'in:char_assets_settings', master: false },   // 서랍을 열기 전(속 없음)
        { legacy: 'cls:inline-drawer#9', stable: 't:Image Captioning', master: true },
    ];
    assert.deepEqual(H.movesFor(hs, {}, pairs), [{ from: 'cls:inline-drawer#8', to: 't:Quick Reply' }]);
    assert.deepEqual(H.pendingLegacyKeys(hs, { 'cls:inline-drawer#8': 't:Quick Reply' }), ['cls:inline-drawer#7'], '짝을 못 찾은 것은 남아요');
    pairs[1].master = true;   // 서랍을 열어 켜기 스위치가 생김
    assert.deepEqual(H.movesFor(hs, { 'cls:inline-drawer#8': 't:Quick Reply' }, pairs), [{ from: 'cls:inline-drawer#7', to: 'in:char_assets_settings' }], '다시 짝지어요');
    assert.deepEqual(H.movesFor(hs, { 'cls:inline-drawer#7': '' }, [pairs[1]]), [], '못 옮김(끝)으로 적은 것은 다시 안 해요');
    assert.deepEqual(H.movesFor(hs, {}, [{ legacy: 'cls:inline-drawer#7', stable: 'u:cls:inline-drawer#2', master: true }]), [], '이름을 못 만든 창으로는 안 옮겨요(검토 7)');
    assert.deepEqual(H.movedKeys(hs, pairs.slice(0, 1)), ['t:Quick Reply'], '옛 판 함수도 같아요');
    assert.equal(H.unmovedCount(['cls:inline-drawer#8'], [{ legacy: 'cls:inline-drawer#8', stable: 't:Summarize', master: false }]), 1);
    assert.equal(H.unmovedText(2), '확장 위로 꺼내 둔 스위치 2개를 새 판으로 옮기지 못했어요. 확장 서랍에서 한 번만 다시 켜 주세요.');
});
await test('1.4.6 검토 1 · 3: 알림은 서랍을 연 뒤 조용해지면 한 번 · 기록을 먼저 · 옛 열쇠는 안 지움 · 표시는 headSwitches 밖', () => {
    const src = fs.readFileSync(path.join(root, 'src/headswitch.js'), 'utf8');
    const settle = src.slice(src.indexOf('function settleLegacy'), src.indexOf('export function unmovedCount'));
    assert.ok(settle.indexOf('mv.noticed = true') < settle.indexOf('toastr'), '기록을 먼저 남기고 알림');
    assert.ok(!/delete hs\[/.test(settle), '옛 열쇠는 지우지 않아요');
    assert.ok(!src.includes('hs[MOVED_MARK]'), '표시를 headSwitches 안에 쓰지 않아요');
    assert.match(src, /noteOpen\(drawer\)/, '서랍 열림을 봐요');
    ctx.extensionSettings.salty = { headSwitches: { 'cls:inline-drawer#8': true, '@moved:stable-keys': true, 't:Quick Reply': true } };
    invalidateSettings();
    assert.deepEqual(getSettings().headSwitches, { 'cls:inline-drawer#8': true, 't:Quick Reply': true }, '1.4.5 표시는 목록에서 빠져요 · 옛 열쇠는 그대로');
    assert.deepEqual(getSettings().headSwitchMove, { done: {}, noticed: true, from145: true, names145: ['t:Quick Reply'] }, '1.4.5 에서 알림을 이미 띄웠으니 noticed · 첫 정리에서 1.4.5 가 옮긴 것은 끝(검토 H1) · 그때 이름 열쇠만 옮길 대상(검토 H2)');
    ctx.extensionSettings.salty = { headSwitchMove: { done: { 'cls:inline-drawer#2': 't:A', bad: 3, '': 'x' }, noticed: 'yes', junk: 1 } };
    invalidateSettings();
    assert.deepEqual(getSettings().headSwitchMove, { done: { 'cls:inline-drawer#2': 't:A' }, noticed: false, from145: false, names145: [] });
});
await test('1.4.6 검토 5 · 6: 제목 열쇠 — 판 번호 · 숫자 떼기 · 단추 안 data-i18n · 속성 칸만 있는 data-i18n 은 건너뜀', () => {
    assert.equal(H.titleWords('My Ext v1.2.3'), 'My Ext');
    assert.equal(H.titleWords('Tool 2.0 (beta)'), 'Tool (beta)');
    assert.equal(H.titleWords('Preview2 · v10'), 'Preview');
    assert.equal(H.titleWords('123'), '');
});
await test('1.4.x 통합(덧 4): 전개 지시 켜기 스위치는 부팅 때부터(늦게 만드는 속 밖) — 확장 위 스위치가 찾아요', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons/direction/index.js'), 'utf8');
    const build = src.slice(src.indexOf('function buildSettings()'), src.indexOf('function fillSettings()'));
    for (const id of ['jj_direction_switch', 'jj_always_switch', 'jj_prompts_switch']) assert.ok(build.includes(`id="${id}"`), id);
});
await test('1.4.6 검토 H1: 1.4.5 가 옮긴 설정의 첫 정리 — 켜기 스위치가 있는 창의 옛 열쇠는 끝(이름 열쇠가 꺼져 있으면 빈 글) · 없는 창만 남겨요', () => {
    const hs = { 'cls:inline-drawer': true, 'cls:inline-drawer#2': true, 'cls:inline-drawer#3': true, 't:B': true };
    const pairs = [
        { legacy: 'cls:inline-drawer', stable: 't:A', master: true },     // 1.4.5 에서 옮긴 뒤 끔
        { legacy: 'cls:inline-drawer#2', stable: 't:B', master: true },   // 옮긴 채 켜져 있음
        { legacy: 'cls:inline-drawer#3', stable: 'in:late', master: false },   // 1.4.5 가 놓친 늦은 창
    ];
    assert.deepEqual(H.settled145(hs, {}, pairs), [{ from: 'cls:inline-drawer', to: '' }, { from: 'cls:inline-drawer#2', to: 't:B' }]);
    const src = fs.readFileSync(path.join(root, 'src/headswitch.js'), 'utf8');
    assert.match(src, /MAX_WAIT_MS = 15000/, '검토 H3: 서랍을 연 뒤 15초 한도');
});
console.log(`${passed} tests passed`);
