// 1.0.0 되살림: 화이트 · 나이트 자동(automode.js — 9.0.0 c7f8705b 에서 걷었다가 되살림)
//   ① 기기 다크 모드 · 시간(자정 넘는 구간 포함) 판정 ② 다른 에이드도 색 정의를 받기 전에 같은 묶음의 밝기만 바꿈 ③ 자동 전환은 저장하지 않음
//   ④ 설정 키 auto 가 8.2.5 와 같은 모양으로 정리됨 ⑤ 설정 창 반달 단추 · 기준 줄 · 해/달을 누르면 자동 끔 ⑥ 켜 둘 때만 받음(시작 그래프 밖)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const palettes = await import(pathToFileURL(path.join(root, 'src/palettes.js')).href);
const s = { enabled: true, palette: 'melon', auto: { on: true, by: 'time', night: '00:00', day: '23:59' } };
let saves = 0;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-automode-'));
fs.writeFileSync(path.join(dir, 'settings.js'), 'export const getSettings = () => globalThis.__s; export const saveSettings = () => globalThis.__saves++;');
fs.writeFileSync(path.join(dir, 'palettes.js'), `export * from ${JSON.stringify(pathToFileURL(path.join(root, 'src/palettes.js')).href)};`);
fs.writeFileSync(path.join(dir, 'automode.js'), read('src/automode.js'));
globalThis.__s = s; globalThis.__saves = 0;
const auto = await import(pathToFileURL(path.join(dir, 'automode.js')).href);

await test('시간 기준: 자정을 넘는 구간(20:00 → 07:00)과 넘지 않는 구간', () => {
    const at = (h, m = 0) => new Date(2026, 0, 1, h, m);
    const cross = { by: 'time', night: '20:00', day: '07:00' };
    assert.equal(auto.wantMode(cross, at(21)), 'dark');
    assert.equal(auto.wantMode(cross, at(3)), 'dark');
    assert.equal(auto.wantMode(cross, at(12)), 'light');
    const inside = { by: 'time', night: '01:00', day: '05:00' };
    assert.equal(auto.wantMode(inside, at(2)), 'dark');
    assert.equal(auto.wantMode(inside, at(6)), 'light');
    assert.equal(auto.wantMode({ by: 'time', night: '08:00', day: '08:00' }, at(9)), 'light');
});
await test('기기 기준: 다크 모드를 따라가요', () => {
    assert.equal(auto.wantMode({ by: 'system' }, new Date(), true), 'dark');
    assert.equal(auto.wantMode({ by: 'system' }, new Date(), false), 'light');
});
await test('다른 에이드(멜론)도 색 정의를 받기 전에 같은 묶음의 밤 · 낮만 바꾸고, 저장하지 않아요', () => {
    let applied = 0;
    auto.syncAutoMode(true, { applyAll: () => applied++, refreshPanels() {} });
    const want = auto.wantMode(s.auto);
    assert.equal(palettes.paletteMode(s.palette), want);
    assert.equal(palettes.paletteFamily(s.palette), 'melon');
    assert.ok(applied >= 1);
    assert.equal(globalThis.__saves, 0);
    assert.doesNotMatch(read('src/automode.js'), /saveSettings\(\)/);
    auto.syncAutoMode(false);
});
await test('설정 키 auto 는 8.2.5 와 같은 모양 · 잘못된 값은 기본값으로', () => {
    const settings = read('src/settings.js');
    assert.match(settings, /auto: \{ on: false, by: 'system', night: '20:00', day: '07:00' \}/);
    assert.match(settings, /if \(!\['system', 'time'\]\.includes\(s\.auto\.by\)\) s\.auto\.by = 'system';/);
    assert.match(settings, /RESET_KEEP = \[[^\]]*'auto'/, '모양 되돌리기에서도 자동 설정은 남겨요');
});
await test('설정 창: 반달 단추 · 기준 줄 · 해/달을 누르면 자동 끔', () => {
    const panel = read('src/panel.js');
    assert.match(panel, /data-act="palette-auto"/);
    assert.match(panel, /seg\('auto\.by', \[\['system', '기기 다크 모드'\], \['time', '시간'\]\]\)/);
    assert.match(panel, /data-time-path="auto\.night"/);
    assert.match(panel, /case 'palette-mode':[\s\S]{0,200}st\.auto\.on = false/);
    assert.match(read('src/settings-differences.js'), /'nightTint','auto'/);
});
await test('켜 둘 때만 받아요(features.js 동적 import · 시작 그래프 밖)', () => {
    const features = read('src/features.js');
    assert.match(features, /const auto = on && !!s\.auto\?\.on;\s*\n\s*if \(auto \|\| modules\.auto\) load\('auto', '\.\/automode\.js'\)/);
    assert.doesNotMatch(read('index.js'), /automode/);
});
fs.rmSync(dir, { recursive: true, force: true });
console.log(`automode-restore: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
