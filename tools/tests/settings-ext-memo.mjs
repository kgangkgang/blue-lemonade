// 1.1.4 성능: src/settings.js getSettings — 메모가 살아 있는 동안에는 SillyTavern.getContext() 를 다시 부르지 않는지(실리태번 getContext 는 부를 때마다 큰 객체를 새로 만들어요),
//   그래도 저장 칸이 통째로 바뀜 · 설정 사건 · getContext 함수나 주인이 바뀜은 예전처럼 바로 알아보는지
//   node tools/tests/settings-ext-memo.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

globalThis.matchMedia = () => ({ addEventListener() {}, matches: false });
const listeners = new Map();
const eventSource = { on: (n, fn) => { if (!listeners.has(n)) listeners.set(n, []); listeners.get(n).push(fn); }, emit: n => (listeners.get(n) || []).forEach(fn => fn()) };
const event_types = { SETTINGS_UPDATED: 'settings_updated', SETTINGS_LOADED: 'settings_loaded' };
// 실리태번처럼: extensionSettings 는 늘 같은 객체, getContext() 는 부를 때마다 새 객체
const extension_settings = {};
let calls = 0, saves = 0;
const makeContext = ext => () => { calls++; return { extensionSettings: ext, powerUserSettings: {}, eventSource, event_types, saveSettingsDebounced() { saves++; } }; };
globalThis.SillyTavern = { getContext: makeContext(extension_settings) };
const { DEFAULTS, getSettings, readSettings, invalidateSettings, saveSettings, resetSettings, settingsStats } = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
extension_settings.salty = structuredClone(DEFAULTS);
const count = fn => { const before = calls; fn(); return calls - before; };

await test('메모가 살아 있으면 getSettings · readSettings 1,000번에 getContext 0번', () => {
    invalidateSettings();
    const first = getSettings();
    assert.equal(first, extension_settings.salty);
    assert.equal(count(() => { for (let i = 0; i < 1000; i++) { assert.equal(getSettings(), first); assert.equal(readSettings(), first); } }), 0);
});
await test('제자리에서 고친 값은 바로 보여요(돌려주는 것은 저장 칸 그 객체)', () => {
    getSettings().fruitEntryMode = 'cat';
    assert.equal(getSettings().fruitEntryMode, 'cat');
    assert.equal(extension_settings.salty.fruitEntryMode, 'cat');
});
await test('저장 칸이 통째로 바뀌면(가져오기 · 실리태번이 다시 읽음) 바로 새 객체를 정리해 돌려줘요', () => {
    const before = settingsStats.tidy, old = getSettings();
    extension_settings.salty = structuredClone(DEFAULTS);
    const now = getSettings();
    assert.notEqual(now, old); assert.equal(now, extension_settings.salty);
    assert.equal(settingsStats.tidy, before + 1);
    assert.equal(count(() => { for (let i = 0; i < 100; i++) getSettings(); }), 0, '다시 메모된 뒤에는 getContext 를 안 불러요');
});
await test('설정 사건(invalidateSettings · 저장 · 초기화 · SETTINGS_UPDATED)은 다음 읽기에서 문맥을 다시 읽고 정리해요', () => {
    for (const [name, fire] of [['invalidateSettings', invalidateSettings], ['saveSettings', saveSettings], ['resetSettings', () => resetSettings({ look: true })], ['SETTINGS_UPDATED', () => eventSource.emit('settings_updated')]]) {
        getSettings();
        const before = settingsStats.tidy;
        fire();
        assert.ok(count(getSettings) >= 1, `${name}: 문맥을 다시 읽어요`);
        assert.equal(settingsStats.tidy, before + 1, `${name}: 한 번 다시 정리해요`);
        assert.equal(count(getSettings), 0, `${name}: 그 뒤에는 메모`);
    }
});
await test('getContext 함수가 바뀌면(다른 확장이 감쌈 · index.js 의 event_types 잇기) 그 문맥을 다시 읽어요', () => {
    const first = getSettings();
    const original = SillyTavern.getContext;
    SillyTavern.getContext = function wrapped(...args) { return original.apply(this, args); };
    assert.ok(count(getSettings) >= 1, '감싼 함수로 한 번 다시 읽어요');
    assert.equal(getSettings(), first, '같은 저장 칸이면 같은 객체(다시 정리하지 않아요)');
    assert.equal(count(getSettings), 0);
    // 다른 저장 칸을 주는 문맥으로 바뀌면 그 칸을 따라가요
    const other = { salty: structuredClone(DEFAULTS) };
    SillyTavern.getContext = makeContext(other);
    assert.equal(getSettings(), other.salty);
    // 주인 객체가 통째로 바뀌어도
    const third = { salty: structuredClone(DEFAULTS) };
    globalThis.SillyTavern = { getContext: makeContext(third) };
    assert.equal(getSettings(), third.salty);
});
await test('미세 벤치(참고): 메모된 getSettings 100만 번', () => {
    // 실리태번 1.19 getContext 꼴 흉내(190칸 · bind 10 · 화살표 6)로 「메모 앞에서 문맥을 매번 만들던」 예전 길과 견줘요 — 숫자는 기기마다 달라 판정하지 않아요
    const vals = Array.from({ length: 190 }, (_, i) => ({ i })); class M { static a() {} }
    const body = vals.map((_, i) => (i < 10 ? `p${i}: M.a.bind(M)` : i < 16 ? `p${i}: () => vals[${i}]` : `p${i}: vals[${i}]`)).join(',');
    const ext = { salty: structuredClone(DEFAULTS) };
    const heavy = new Function('vals', 'M', 'ext', `return function getContext(){ return { extensionSettings: ext, ${body} }; }`)(vals, M, ext);
    globalThis.SillyTavern = { getContext: heavy };
    const s = getSettings(), N = 1e6;
    let t = performance.now(); for (let i = 0; i < N; i++) if (getSettings() !== s) throw new Error('메모가 깨졌어요');
    const now = performance.now() - t;
    t = performance.now(); for (let i = 0; i < N; i++) { const e = SillyTavern.getContext().extensionSettings; if (e.salty !== s) throw new Error('?'); }
    const old = performance.now() - t;
    console.log(`        지금 ${(now / N * 1e6).toFixed(0)}ns/호출 · 예전 길(문맥을 매번) ${(old / N * 1e6).toFixed(0)}ns/호출`);
});
console.log(`settings-ext-memo: ${passed} passed`);
