import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const ctx = { extensionSettings: {}, saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
const S = await import(pathToFileURL(path.join(root, 'src/settings.js')));
const F = await import(pathToFileURL(path.join(root, 'src/first-run.js')));
const flags = s => [s.syncWatch, s.squareButtons, s.headSwitchRows, s.chat.numComma];
const read = ext => { ctx.extensionSettings = ext; S.invalidateSettings(); return S.getSettings(); };
let passed = 0;
const test = (name, run) => { run(); passed++; console.log(`통과 ${passed}: ${name}`); };
test('새 설치와 깨진 설정 칸은 네 가지 기능을 끄고 시작해요', () => {
    for (const ext of [{}, { salty: null }, { salty: [] }, { salty: '깨진 값' }]) assert.deepEqual(flags(read(ext)), [false, false, false, false]);
    assert.deepEqual(flags(S.DEFAULTS), [false, false, false, false]);
});
test('기존 사용자의 생략된 켬 값은 예전처럼 유지해요', () => {
    for (const saved of [{}, { palette: 'night' }, { chat: {} }, { chat: null }]) assert.deepEqual(flags(read({ salty: saved })), [true, true, true, true]);
});
test('사용자가 직접 켜거나 끈 값과 가져온 문자열 값은 유지해요', () => {
    for (const value of [true, false, 'true', 'false']) {
        const s = read({ salty: { syncWatch: value, squareButtons: value, headSwitchRows: value, chat: { numComma: value } } });
        assert.deepEqual(flags(s), Array(4).fill(value === true || value === 'true'));
    }
});
test('새 설치 뒤 다시 읽어도 예전 설정으로 오인해 켜지 않아요', () => {
    const s = read({}); S.invalidateSettings(); assert.equal(S.getSettings(), s);
    assert.deepEqual(flags(s), [false, false, false, false]);
    assert.deepEqual(flags(read({ salty: structuredClone(s) })), [false, false, false, false]);
});
test('기기 선택은 기존 syncWatch만 바꾸고 모양과 다른 설정은 유지해요', () => {
    const s = structuredClone(S.DEFAULTS), before = structuredClone(s);
    F.chooseDeviceUse(s, 'multiple'); assert.equal(s.syncWatch, true);
    assert.deepEqual({ ...s, syncWatch: before.syncWatch }, before);
    F.chooseDeviceUse(s, 'single'); assert.equal(s.syncWatch, false);
    F.chooseDeviceUse(s, '잘못된 선택'); assert.equal(s.syncWatch, false);
    assert.equal(F.STEPS.at(-1)[0], 'mode'); assert.ok(F.STEPS.some(step => step[0] === 'devices'));
});
test('기존 공용 단추와 눌림 상태로 두 기기 선택을 표시해요', () => {
    for (const value of [true, false]) {
        const html = F.deviceStep({ syncWatch: value });
        assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
        assert.match(html, new RegExp(`data-fr-device="${value ? 'multiple' : 'single'}" aria-pressed="true"`));
        assert.equal((html.match(/class="bl-fr-choice/g) || []).length, 2);
    }
});
test('테마 모습 초기화로 기기 알림 선택이 바뀌지 않아요', () => {
    const s = read({}); F.chooseDeviceUse(s, 'multiple');
    S.resetSettings({ look: true }); assert.equal(S.getSettings().syncWatch, true);
    F.chooseDeviceUse(S.getSettings(), 'single');
    S.resetSettings({ look: true }); assert.equal(S.getSettings().syncWatch, false);
});
test('(1.4.x 최적화 3차) 성능 보조 「로딩 시간」 불러오기는 기본 끔 · 저장된 켬/끔은 그대로 · 다른 도구 기본은 켬', () => {
    assert.equal(S.DEFAULTS.addonUI.perfLoad.timer, false);
    for (const k of ['watchdog', 'perf', 'log', 'dedupe']) assert.equal(S.DEFAULTS.addonUI.perfLoad[k], true, k);
    assert.equal(read({}).addonUI.perfLoad.timer, false, '새 설치');
    assert.equal(read({ salty: { addonUI: { perfLoad: { watchdog: true } } } }).addonUI.perfLoad.timer, false, '빠진 칸은 기본값으로');
    assert.equal(read({ salty: { addonUI: { perfLoad: { timer: true } } } }).addonUI.perfLoad.timer, true, '켜 둔 사람은 그대로');
    assert.equal(read({ salty: { addonUI: { perfLoad: { timer: false } } } }).addonUI.perfLoad.timer, false);
    assert.equal(read({ salty: { addonUI: { perfLoad: {} } } }).addonUI.perfLoad.dedupe, true);
});
console.log(`가벼운 기본값 시험 ${passed}개를 통과했어요.`);
