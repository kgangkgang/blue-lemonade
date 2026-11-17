// 버그 사냥 7 — 「오늘의 에이드」 가 자정을 넘겨도 안 바뀌던 것 (src/ade.js)
//   날짜 확인이 설정이 바뀔 때(applyAll → syncAde)에만 있어서, 탭을 띄워 두거나 숨겨 둔 채 자정을 넘기면
//   다음 날 탭으로 돌아와도 · 채팅을 옮겨도 어제 에이드 그대로였어요. 이제 채팅이 바뀔 때 · 탭이 다시 보일 때도 날짜를 봐요.
//   진짜 ade.js · settings.js 를 가짜 브라우저(leak-dom)에서 돌려요.  node tools/tests/ade-daily-roll.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('  PASS  ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n        ')); } }

// 시계: 날짜만 바꿔요(타이머는 leak-dom 시계)
const RealDate = Date;
let shift = 0;
globalThis.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + shift); } static now() { return RealDate.now() + shift; } };
const nextDay = () => { shift += 86400000; };

const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, palette: 'salt', quick: { adeChat: false, adeDaily: true } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
ctx.characters.push({ name: 'B', avatar: 'b.png', data: { extensions: {} } });
const S = await import(url('src/settings.js'));
const P = await import(url('src/palettes.js'));
const ade = await import(url('src/ade.js'));
const core = await import(url('src/ade-core.js'));
const q = () => S.getSettings().quick;
const hooks = { applyAll() { Promise.resolve().then(() => ade.syncAde(true, q(), hooks)); }, refreshPanels() {} };
const chatChanged = async (id) => { ctx.characterId = id; await eventSource.emit(ctx.event_types.CHAT_CHANGED); await dom.clock.advance(1); };
const fam = () => P.paletteFamily(S.getSettings().palette);
const todays = () => core.dailyFamily(ade.families(), core.dayKey(), '');

S.getSettings();
hooks.applyAll(); await dom.clock.advance(1);
await chatChanged(0);

await test('켤 때는 오늘의 에이드', async () => {
    assert.equal(ade._forTest.state().day, core.dayKey());
    assert.equal(fam(), ade.adeBase());
});

await test('자정을 넘긴 뒤 채팅을 옮기면 오늘의 에이드로 바뀌어요', async () => {
    const before = ade.adeBase();
    // 날마다 다른 가족이 나오는 날까지 넘겨요(같은 가족이면 바뀐 것을 못 봐요)
    for (let i = 0; i < 10 && core.dailyFamily(ade.families(), core.dayKey(new Date(Date.now() + 86400000)), before) === before; i++) nextDay();
    nextDay();
    await chatChanged(1);
    assert.equal(ade._forTest.state().day, core.dayKey(), '날짜가 어제 그대로예요');
    assert.notEqual(ade.adeBase(), before, '기본 에이드가 어제 것 그대로예요');
    assert.equal(fam(), ade.adeBase(), '팔레트가 어제 가족 그대로예요');
});

await test('자정을 넘긴 숨은 탭이 다시 보이면 오늘의 에이드로 바뀌어요', async () => {
    const before = ade.adeBase();
    for (let i = 0; i < 10 && core.dailyFamily(ade.families(), core.dayKey(new Date(Date.now() + 86400000)), before) === before; i++) nextDay();
    document._hiddenTab = true;
    document.dispatchEvent(new Event('visibilitychange'));
    nextDay();
    document._hiddenTab = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await dom.clock.advance(1);
    assert.equal(ade._forTest.state().day, core.dayKey(), '날짜가 어제 그대로예요');
    assert.notEqual(ade.adeBase(), before);
    assert.equal(fam(), ade.adeBase());
});

await test('「오늘의 에이드」 를 끈 채면 날이 바뀌어도 기본 에이드를 안 바꿔요', async () => {
    S.getSettings().quick.adeDaily = false; S.getSettings().quick.adeChat = true;
    hooks.applyAll(); await dom.clock.advance(1);
    const before = ade.adeBase();
    nextDay(); nextDay();
    await chatChanged(0);
    assert.equal(ade.adeBase(), before);
});

void todays;
console.log(`ade-daily-roll: ${pass}개 통과${fail ? ` · ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
