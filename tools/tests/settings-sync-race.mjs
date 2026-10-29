// 세 갈래 합치기(settings-sync.js)가 서버를 읽는 사이 이 탭의 저장이 끝나도, 막 저장한 이 탭 값을 옛 서버 값으로 되돌리지 않는지
//   폰에서 설정을 바꾸고 곧바로 다른 앱으로 가면 실리태번의 1초 미룬 저장이 멈춰 있다가, 돌아오는 순간 「서버 읽기(합치기)」와 「미룬 저장」이 함께 떠요.
//   서버가 읽기를 먼저 내주고 저장이 먼저 끝나면, 저장 끝 사건이 base 를 이 탭 값으로 옮긴 뒤 옛 서버 값이 와서
//   「이 탭은 안 바꿈 · 서버가 바꿈」으로 보고 방금 바꾼 값을 되돌렸어요(서버에는 새 값, 이 탭에는 옛 값 → 다음 저장이 옛 값으로 덮음).
//   node tools/tests/settings-sync-race.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const handlers = {};
const ctx = { extensionSettings: { salty: { palette: 'salt', type: { size: 16 }, styles: [{ id: 'a', name: 'A' }] } }, powerUserSettings: {},
    eventSource: { on: (name, fn) => (handlers[name] ??= []).push(fn) }, event_types: { SETTINGS_UPDATED: 'SETTINGS_UPDATED' } };
globalThis.SillyTavern = { getContext: () => ctx };
const sync = await import(pathToFileURL(path.join(root, 'src/settings-sync.js')).href);
const merge = await import(pathToFileURL(path.join(root, 'src/settings-merge.js')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const json = v => JSON.parse(JSON.stringify(v));
let server = json(ctx.extensionSettings.salty), answer = null, saves = 0;
const savedEvent = () => { for (const fn of handlers.SETTINGS_UPDATED || []) fn(); };
const save = () => { saves++; server = json(ctx.extensionSettings.salty); savedEvent(); };
merge._forTest.setHost({ doc: () => ({ hidden: false, addEventListener() {}, removeEventListener() {} }), now: () => 0,
    fetch: async () => { const read = json(server); await new Promise(r => { answer = r; }); return { ok: true, json: async () => ({ settings: JSON.stringify({ extension_settings: { salty: read } }) }) }; } });
sync.startThemeSettingsSync({ getSalty: () => ctx.extensionSettings.salty, save, after: () => {} });

await test('서버를 읽는 사이 이 탭 저장이 끝나도: 이 탭이 바꾼 값은 남고, 다른 기기가 더한 것은 받아요', async () => {
    // 다른 기기가 스타일 b 를 더해 저장해 둠 (이 탭은 아직 모름)
    server.styles.push({ id: 'b', name: 'B' });
    // 이 탭: 숨기 직전 글자 크기를 바꿈 (미룬 저장은 멈춰 있음)
    ctx.extensionSettings.salty.type.size = 20;
    const run = merge.mergeFromServer('visible');   // 돌아옴 → 서버 읽기 (서버는 지금 값을 내줌: 글자 16 · 스타일 a b)
    await new Promise(r => setTimeout(r, 0));
    assert.ok(answer, '서버 읽기가 떠 있어요');
    save();                                          // 그사이 미룬 저장이 먼저 끝남 (서버 = 이 탭 값: 글자 20 · 스타일 a — b 는 덮여 사라짐)
    answer();                                        // 이제 옛 읽기 결과가 도착
    const out = await run;
    assert.equal(out.ok, true);
    const s = ctx.extensionSettings.salty;
    assert.equal(s.type.size, 20, '방금 바꾼 글자 크기를 옛 서버 값으로 되돌리면 안 돼요');
    assert.deepEqual(s.styles.map(x => x.id), ['a', 'b'], '다른 기기가 더한 스타일은 받아요');
    assert.equal(out.saved, true, '합친 값을 다시 저장해요 (서버는 b 를 잃은 상태)');
    assert.equal(server.type.size, 20);
    assert.deepEqual(server.styles.map(x => x.id), ['a', 'b']);
});

await test('그사이 저장이 없으면 예전처럼 (이 탭이 안 바꾼 값은 서버 값)', async () => {
    server.palette = 'melon-night';
    const run = merge.mergeFromServer('visible');
    await new Promise(r => setTimeout(r, 0));
    answer();
    await run;
    assert.equal(ctx.extensionSettings.salty.palette, 'melon-night');
    assert.equal(ctx.extensionSettings.salty.type.size, 20);
});

await test('연결: CI 목록에 이 시험', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/settings-sync-race\.mjs \./);
});

console.log(`settings-sync-race: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
