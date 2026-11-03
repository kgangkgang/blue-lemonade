// 9.0.2 성능: src/settings.js getSettings — 마이크로태스크 · 작업이 지나도 설정 사건까지 정리(fill · tidy)를 다시 하지 않는지 (예전엔 마이크로태스크마다),
//   readSettings 가 getSettings 와 같은 객체 · 값인지, 설정 사건(저장 · 무효화 · 초기화 · 객체 바뀜 · SETTINGS_UPDATED · SETTINGS_LOADED)마다 다시 정리하는지
//   node tools/tests/settings-held.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

let clock = 1000;
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true, writable: true });
const media = { listeners: [], addEventListener(type, fn) { if (type === 'change') this.listeners.push(fn); }, matches: false };
globalThis.matchMedia = () => media;
const listeners = new Map();
const eventSource = { on: (n, fn) => { if (!listeners.has(n)) listeners.set(n, []); listeners.get(n).push(fn); }, emit: n => (listeners.get(n) || []).forEach(fn => fn()) };
const event_types = { SETTINGS_UPDATED: 'settings_updated', SETTINGS_LOADED: 'settings_loaded' };
const ctx = { extensionSettings: {}, powerUserSettings: {}, eventSource, event_types, saveSettingsDebounced() { ctx.saves++; }, saves: 0 };
globalThis.SillyTavern = { getContext: () => ctx };
const S = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
const { DEFAULTS, getSettings, readSettings, invalidateSettings, saveSettings, resetSettings, settingsStats } = S;
ctx.extensionSettings.salty = structuredClone(DEFAULTS);
const tidies = async (fn, n = 1000) => { const before = settingsStats.tidy; for (let i = 0; i < n; i++) { await null; fn(); } return settingsStats.tidy - before; };

await test('getSettings 1,000번(마이크로태스크 · 작업마다) → 정리는 한 번 (9.0.2 · 예전엔 1,000번)', async () => {
    invalidateSettings();
    assert.equal(await tidies(getSettings), 1);
    const before = settingsStats.tidy;
    for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 0)); getSettings(); }
    clock += 60000;
    getSettings();
    assert.equal(settingsStats.tidy, before, '작업 · 시간이 지나도 사건이 없으면 다시 정리하지 않아요');
});
await test('readSettings 1,000번(마이크로태스크마다) → 정리는 한 번', async () => {
    invalidateSettings();
    const n = await tidies(readSettings);
    console.log(`        정리 ${n}회 (getSettings 였으면 1,000회)`);
    assert.equal(n, 1);
});
await test('readSettings 는 getSettings 와 같은 객체 · 같은 값 — 제자리에서 고친 값은 바로 보여요', async () => {
    const a = readSettings(); await null; const b = getSettings();
    assert.equal(a, b); assert.equal(a, ctx.extensionSettings.salty);
    b.fruitEntryMode = 'cat'; await null;
    assert.equal(readSettings().fruitEntryMode, 'cat');
    assert.deepEqual(JSON.parse(JSON.stringify(readSettings())), JSON.parse(JSON.stringify(getSettings())));
});
await test('저장 · 무효화 · 초기화 뒤에는 다시 정리해서 범위를 맞춘 값을 줘요', async () => {
    for (const [name, event] of [['saveSettings', () => saveSettings()], ['invalidateSettings', () => invalidateSettings()], ['resetSettings', () => resetSettings({ look: false })]]) {
        await null; readSettings(); await null;
        getSettings().nightTint = 99; await null;
        const before = settingsStats.tidy;
        assert.equal(readSettings().nightTint, 99, `${name} 전에는 정리하지 않아요(같은 객체)`);
        assert.equal(settingsStats.tidy, before);
        event(); await null;
        assert.equal(readSettings().nightTint, 20, `${name} 뒤에는 범위 안(1~20)`);
        assert.ok(settingsStats.tidy > before, name);
    }
});
await test('저장 칸 객체가 통째로 바뀌면(가져오기) 새 객체를 정리해서 줘요', async () => {
    await null; const old = readSettings();
    const fresh = structuredClone(DEFAULTS); fresh.palette = 'no-such-palette';
    ctx.extensionSettings.salty = fresh; await null;
    const s = readSettings();
    assert.notEqual(s, old); assert.equal(s, fresh); assert.equal(s.palette, 'salt');
});
await test('실리태번 SETTINGS_UPDATED · SETTINGS_LOADED 뒤에는 다시 정리', async () => {
    for (const [name, fire] of [['SETTINGS_UPDATED', () => eventSource.emit(event_types.SETTINGS_UPDATED)], ['SETTINGS_LOADED', () => eventSource.emit(event_types.SETTINGS_LOADED)]]) {
        await null; readSettings(); await null;
        const before = settingsStats.tidy;
        readSettings(); assert.equal(settingsStats.tidy, before, `${name} 전`);
        fire(); await null;
        readSettings(); assert.equal(settingsStats.tidy, before + 1, `${name} 뒤`);
    }
    assert.equal(listeners.get(event_types.SETTINGS_UPDATED).length, 1, '이벤트 리스너는 한 번만 걸어요');
});
await test('뜨거운 읽기 자리가 readSettings 를 써요(과일 입구 1.5초 서명 · 색 맞춤 감시 · 고르기 키 · 생성 따라가기 scroll)', () => {
    const read = f => fs.readFileSync(path.join(root, f), 'utf8');
    assert.match(read('src/scripts/fruit-entry.js'), /qr=el\('qr--bar'\),s=readSettings\(\);/);
    assert.match(read('src/tone.js'), /function enabled\(\) \{\n    const s = readSettings\(\);/);
    assert.match(read('src/selects.js'), /if \(readSettings\(\)\.chat\?\.selectPop === false\) return false;/);
    assert.match(read('src/stream-follow.js'), /themeEnabled\(readSettings\(\)\)/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/settings-held\.mjs \./);
    assert.match(read('index.js'), /after: \(\) => \{ invalidateSettings\(\); applyAll\(\);/, '기기 간 합치기(제자리 고침) 뒤에는 정리 메모를 비워요');
    assert.ok(!/queueMicrotask/.test(read('src/settings.js')), '마이크로태스크마다 비우던 메모는 없어요');
});
console.log(`\n${passed} passed`);
