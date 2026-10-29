// 기기별 배치(폰 · PC 따로)를 켠 채 두 기기를 오갈 때 세 갈래 합치기(settings-sync.js)가 이 기기 배치를 지키는지
//   위 칸(type.size · measure …)은 「지금 기기」 값이라 기기마다 달라요. 합치기가 그 차이를 「서버가 바꾼 값」으로 보고
//   다른 기기의 글자 크기를 가져오면, 다음 저장이 그 값을 이 기기 배치(deviceLayouts.pc / mobile)에 담아 이 기기 배치가 사라졌어요.
//   node tools/tests/device-layout-merge.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let mobile = false;
globalThis.matchMedia = () => ({ matches: mobile, addEventListener() {} });
const handlers = {};
let server = null, emitSaved = true;
const ctx = {
    extensionSettings: {}, powerUserSettings: {},
    eventSource: { on: (name, fn) => (handlers[name] ??= []).push(fn) },
    event_types: { SETTINGS_UPDATED: 'SETTINGS_UPDATED' },
    // 실리태번 저장: 서버가 이 탭 값을 통째로 가짐 → 저장 끝 사건 (다른 기기 흉내 중에는 이 탭의 사건을 쏘지 않음)
    saveSettingsDebounced() { server = JSON.parse(JSON.stringify(ctx.extensionSettings.salty)); if (emitSaved) for (const fn of handlers.SETTINGS_UPDATED || []) fn(); },
};
globalThis.SillyTavern = { getContext: () => ctx };
const S = await import(pathToFileURL(path.join(root, 'src/settings.js')).href);
const sync = await import(pathToFileURL(path.join(root, 'src/settings-sync.js')).href);
const merge = await import(pathToFileURL(path.join(root, 'src/settings-merge.js')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const json = v => JSON.parse(JSON.stringify(v));
// 다른 기기 한 대: 서버 값을 읽어 그 기기 모양으로 불러오고, 고친 뒤 저장 (이 탭의 저장 끝 사건은 안 쏨)
function otherDevice(isMobile, edit) {
    const mine = ctx.extensionSettings, wasMobile = mobile;
    mobile = isMobile; emitSaved = false;
    ctx.extensionSettings = { salty: json(server) }; S.invalidateSettings();
    const s = S.getSettings(); edit(s); S.saveSettings();
    ctx.extensionSettings = mine; mobile = wasMobile; emitSaved = true; S.invalidateSettings();
    return json(server);
}
let remote = null, now = 1000;
const doc = { hidden: false, addEventListener(name, fn) { if (name === 'visibilitychange') this.onVisible = fn; }, removeEventListener() {} };
merge._forTest.setHost({ doc: () => doc, now: () => now, fetch: async () => ({ ok: true, json: async () => ({ settings: JSON.stringify({ extension_settings: { salty: remote } }) }) }) });
let afterCalls = 0;
// 1분 넘게 숨었다가 다시 보임 → 서버를 읽어 합침
async function comeBack() {
    doc.hidden = true; doc.onVisible(); now += 120000; doc.hidden = false; doc.onVisible();
    for (let i = 0; i < 10 && merge._forTest.lastRun()?.at !== now; i++) await new Promise(r => setTimeout(r, 5));
    assert.equal(merge._forTest.lastRun()?.ok, true, '합치기가 돌았어요');
}

// 시작: 기기별 배치 켬 · 폰이 마지막으로 저장(위 칸 = 폰 20px)
const first = structuredClone(S.DEFAULTS); first.profile.modeVersion = 1; first.deviceLayouts.on = true;
mobile = true; ctx.extensionSettings = { salty: first }; S.invalidateSettings();
S.getSettings().type.size = 20; S.getSettings().type.measure = 600; S.saveSettings();
// 이 탭 = PC
mobile = false; ctx.extensionSettings = { salty: json(server) }; S.invalidateSettings();
sync.startThemeSettingsSync({ getSalty: () => ctx.extensionSettings.salty, save: () => S.saveSettings(), after: () => { afterCalls++; S.getSettings(); } });

await test('PC 로 열면 PC 배치(16px), 폰 배치(20px)는 그대로', () => {
    const s = S.getSettings();
    assert.equal(s.type.size, 16);
    s.type.size = 15; s.type.measure = 900; S.saveSettings();
    assert.equal(server.deviceLayouts.pc.type.size, 15);
    assert.equal(server.deviceLayouts.mobile.type.size, 20);
});

await test('폰이 다른 값(팔레트)을 바꿔 저장한 뒤 PC 탭으로 돌아오면: 팔레트는 받고 PC 글자 크기 · 폭은 PC 것 그대로', async () => {
    remote = otherDevice(true, s => { assert.equal(s.type.size, 20, '폰은 폰 배치'); s.palette = 'melon-night'; });
    assert.equal(remote.type.size, 20, '서버 위 칸은 폰 값');
    await comeBack();
    const s = S.getSettings();
    assert.equal(s.palette, 'melon-night', '다른 기기가 바꾼 모양 값은 받아요');
    assert.equal(s.type.size, 15, 'PC 위 칸에 폰 글자 크기가 들어오면 안 돼요');
    assert.equal(s.type.measure, 900);
    S.saveSettings();
    assert.equal(server.deviceLayouts.pc.type.size, 15, '다음 저장이 PC 배치를 폰 값으로 덮으면 안 돼요');
    assert.equal(server.deviceLayouts.pc.type.measure, 900);
    assert.equal(server.deviceLayouts.mobile.type.size, 20, '폰 배치도 그대로');
});

await test('폰이 폰 배치(글자 크기)를 바꾸면 PC 는 폰 배치 칸만 받고 위 칸은 PC 그대로', async () => {
    remote = otherDevice(true, s => { s.type.size = 22; });
    await comeBack();
    const s = S.getSettings();
    assert.equal(s.type.size, 15);
    assert.equal(s.deviceLayouts.mobile.type.size, 22, '폰 배치는 새 값');
    S.saveSettings();
    assert.equal(server.deviceLayouts.mobile.type.size, 22);
    assert.equal(server.deviceLayouts.pc.type.size, 15);
});

await test('다른 PC(같은 기기 종류)가 PC 배치를 바꾸면 이 PC 도 따라가요', async () => {
    remote = otherDevice(false, s => { s.type.size = 18; });
    await comeBack();
    assert.equal(S.getSettings().type.size, 18);
    assert.equal(S.getSettings().deviceLayouts.pc.type.size, 18);
});

await test('이 탭이 숨은 사이 PC 배치를 고쳐 두었으면(저장 전) 그 값이 이겨요', async () => {
    remote = otherDevice(true, s => { s.palette = 'salt'; });
    S.getSettings().type.size = 19;   // 저장 전 (실리태번 저장 미룸 중)
    await comeBack();
    const s = S.getSettings();
    assert.equal(s.type.size, 19);
    assert.equal(s.palette, 'salt');
    S.saveSettings();
    assert.equal(server.deviceLayouts.pc.type.size, 19);
});

await test('다른 기기에서 테마 모습을 초기화하면(배치 기억도 비움) 이 기기 배치도 처음 값으로 따라가요', async () => {
    remote = otherDevice(true, s => {
        const fresh = S.resetSettings({ look: true });
        assert.deepEqual(fresh.deviceLayouts.mobile, {}, '초기화는 배치 기억을 비워요');
    });
    // 초기화한 기기가 다음 저장에서 제 기기 배치만 다시 담아요 — PC 칸은 빈 채로 서버에
    assert.deepEqual(remote.deviceLayouts.pc, {});
    await comeBack();
    const s = S.getSettings();
    assert.equal(s.type.size, S.DEFAULTS.type.size, 'PC 글자 크기도 처음 값');
    assert.equal(s.palette, S.DEFAULTS.palette);
    S.saveSettings();
    assert.equal(server.deviceLayouts.pc.type.size, S.DEFAULTS.type.size, '다음 저장이 옛 PC 배치를 되살리지 않아요');
});

await test('다른 기기가 기기별 배치를 끄면 그 기기 값을 함께 쓰는 값으로 받아요 (켬/끔이 따라감)', async () => {
    remote = otherDevice(true, s => { s.deviceLayouts.on = false; });
    await comeBack();
    const s = S.getSettings();
    assert.equal(s.deviceLayouts.on, false);
    assert.equal(s.type.size, remote.type.size);
});

await test('기기별 배치를 안 쓰면 예전처럼 서버 값을 받아요', async () => {
    remote = otherDevice(true, s => { s.type.size = 24; });
    await comeBack();
    assert.equal(S.getSettings().type.size, 24);
});

await test('다른 기기가 기기별 배치를 다시 켜고 제 배치를 바꾸면, 열려 있던 이 탭은 서버에 담긴 이 기기 배치를 받아요 (다른 기기 값이 아니라)', async () => {
    assert.equal(S.getSettings().deviceLayouts.on, false, '앞 시험에서 끈 상태');
    S.getSettings().type.size = 17; S.saveSettings();   // 끈 동안 함께 쓰는 값 17
    remote = otherDevice(true, s => { s.deviceLayouts.on = true; S.invalidateSettings(); S.getSettings(); s.type.size = 23; });   // 폰에서 다시 켜고 폰만 23
    const pcMemory = remote.deviceLayouts.pc.type.size;   // 켜는 기기가 정한 PC 배치 (끄기 전 기억이 있으면 그 값)
    assert.notEqual(pcMemory, 23);
    await comeBack();
    const s = S.getSettings();
    assert.equal(s.deviceLayouts.on, true);
    assert.equal(s.type.size, pcMemory, 'PC 위 칸은 서버의 PC 배치 — 폰 값 23 이 아니에요');
    S.saveSettings();
    assert.equal(server.deviceLayouts.pc.type.size, pcMemory, 'PC 배치 기억을 폰 값으로 덮지 않아요');
    assert.equal(server.deviceLayouts.mobile.type.size, 23);
});

await test('연결: CI 목록에 이 시험', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/device-layout-merge\.mjs \./);
});

console.log(`device-layout-merge: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
