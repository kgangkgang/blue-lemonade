// 1.1.2 코드 감사 A1(급한 대안) — 에이드 갈아입기: 다른 기기 · 다른 탭에서 합쳐져 들어온 팔레트를 「이 채팅방에서 사용자가 고름」으로 적던 것
//   node tools/tests/ade-merge.mjs <테마 루트>
// 에이드 갈아입기는 「팔레트 가족이 바뀌었고 채팅이 그대로면 사용자가 고른 것」으로 봐요. 그런데 팔레트는 설정 합치기(settings-sync.js — 탭이 오래 숨었다 돌아올 때)로도 바뀌어 들어와요.
//   (a) 설정 합치기는 다시 적용하기 전에 window 에 bl:settings-merged 를 알려요
//   (b) 그 알림(과 설정 통째 바꿈 bl:settings-replaced) 바로 뒤의 팔레트 바뀜 한 번은 적지 않고, 그 채팅방 에이드를 다시 칠해요
//   (c) 그 밖의 고르기는 예전 그대로 적혀요 — 알림만 오고 적용이 없었어도 다음 고르기를 삼키지 않아요
// 남은 것(1.1.3 후보): 사용자 선택을 설정 창의 팔레트 누름에서 직접 알리는 꼴로 바꾸는 일은 여기서 하지 않았어요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('  PASS  ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n        ')); } }

const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, palette: 'salt', quick: { adeChat: true, adeDaily: false } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
ctx.characters.push({ name: 'B', avatar: 'b.png', data: { extensions: {} } });
const S = await import(url('src/settings.js'));
const ade = await import(url('src/ade.js'));
const q = () => S.getSettings().quick;
const wantOn = () => q().adeChat === true || q().adeDaily === true;
// features.js 흉내: applyAll 끝 syncFeatures → (마이크로태스크) syncAde
const hooks = { applyAll() { Promise.resolve().then(() => ade.syncAde(wantOn(), q(), hooks)); }, refreshPanels() {} };
const chatChanged = async (id) => { ctx.characterId = id; await eventSource.emit(ctx.event_types.CHAT_CHANGED); await dom.clock.advance(1); };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
const pick = async (palette) => { S.getSettings().palette = palette; hooks.applyAll(); await tick(); };
const chats = () => ({ ...ade._forTest.state().chats });
const fam = () => { const id = S.getSettings().palette; return id === 'salt' ? 'blue' : id.replace(/-night$|-light$/, ''); };
const announce = name => globalThis.window.dispatchEvent(new Event(name));

S.getSettings();
hooks.applyAll(); await dom.clock.advance(1);
await chatChanged(0);

await test('합쳐져 들어온 팔레트는 이 채팅방 기억으로 적지 않고, 기억 없는 방은 기본 에이드로 다시 칠해요', async () => {
    assert.deepEqual(chats(), {});
    const base = ade.adeBase();
    // index.js: 합치기 → after: () => { invalidateSettings(); applyAll(); refreshPanels(); }
    announce('bl:settings-merged');
    S.getSettings().palette = 'peach'; S.invalidateSettings?.(); hooks.applyAll(); await tick();
    assert.deepEqual(chats(), {}, '이 탭 사용자는 아무것도 안 골랐어요');
    assert.equal(ade.adeBase(), base);
    assert.equal(fam(), base, '이 방의 에이드(기본)로 다시 칠해요');
    await dom.clock.advance(1);
});

await test('그 뒤 사용자가 직접 고르면 예전처럼 그 방에 적혀요', async () => {
    await pick('melon');
    assert.deepEqual(chats(), { 'c:char.png': 'melon' });
    assert.equal(fam(), 'melon');
});

await test('기억 있는 방: 합쳐져 들어온 팔레트 대신 그 방 에이드가 다시 칠해지고 기억은 그대로', async () => {
    announce('bl:settings-merged');
    S.getSettings().palette = 'lavender'; hooks.applyAll(); await tick();
    assert.deepEqual(chats(), { 'c:char.png': 'melon' });
    assert.equal(fam(), 'melon');
    await dom.clock.advance(1);
});

await test('설정을 통째로 바꾼 알림(bl:settings-replaced) 뒤의 팔레트 바뀜도 사용자 선택으로 적지 않아요', async () => {
    announce('bl:settings-replaced');
    S.getSettings().palette = 'strawberry'; hooks.applyAll(); await tick();
    assert.deepEqual(chats(), { 'c:char.png': 'melon' });
    await dom.clock.advance(1);
});

await test('알림만 오고 적용이 없었으면 다음 틱에 풀려요 — 그 뒤의 고르기를 삼키지 않아요', async () => {
    announce('bl:settings-merged');
    await dom.clock.advance(1);
    await pick('peach');
    assert.deepEqual(chats(), { 'c:char.png': 'peach' });
});

await test('에이드를 끈 동안의 알림은 켠 뒤의 고르기에 영향이 없어요', async () => {
    const s = S.getSettings(); s.quick.adeChat = false; hooks.applyAll(); await tick();
    announce('bl:settings-merged');
    s.quick.adeChat = true; hooks.applyAll(); await tick();
    await pick('melon');
    assert.equal(chats()['c:char.png'], 'melon');
    await dom.clock.advance(1);
});

await test('설정 합치기(settings-sync.js)는 값이 바뀌었을 때만, 다시 적용하기 전에 bl:settings-merged 를 알려요', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-ade-merge-'));
    try {
        fs.copyFileSync(path.join(root, 'src/settings-sync.js'), path.join(dir, 'settings-sync.js'));
        fs.writeFileSync(path.join(dir, 'settings-merge.js'), 'export const registerSettingsMerge = (name, fn) => { globalThis.__blMergeFn = fn; };\nexport const startSettingsMerge = () => {};\n');
        fs.writeFileSync(path.join(dir, 'device-layouts.js'), 'export const layoutMergeView = () => Object.assign(value => value, { settle() {} });\n');
        const sync = await import(pathToFileURL(path.join(dir, 'settings-sync.js')).href);
        const salty = { palette: 'salt', quick: { adeChat: true } };
        const order = [];
        const heard = () => order.push('event');
        globalThis.window.addEventListener('bl:settings-merged', heard);
        sync.startThemeSettingsSync({ getSalty: () => salty, save() {}, after: () => order.push('after') });
        const merge = globalThis.__blMergeFn;
        assert.equal(typeof merge, 'function');
        const same = merge({ salty: structuredClone(salty) });
        assert.deepEqual(order, [], '바뀐 것이 없으면 알리지도 다시 적용하지도 않아요');
        assert.equal(same.pulled, 0);
        const changed = merge({ salty: { palette: 'peach', quick: { adeChat: true } } });   // 다른 기기가 저장한 값
        assert.equal(changed.pulled, 1);
        assert.equal(salty.palette, 'peach');
        assert.deepEqual(order, ['event', 'after']);
        globalThis.window.removeEventListener('bl:settings-merged', heard);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); delete globalThis.__blMergeFn; }
});

console.log(`ade-merge: ${pass}개 통과${fail ? ` · ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
