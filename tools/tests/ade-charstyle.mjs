// 1.1.2 코드 감사 A2 · A3 — 에이드 갈아입기(src/ade.js)와 캐릭터별 스타일(src/charstyle.js)이 겹칠 때
//   node tools/tests/ade-charstyle.mjs <테마 루트>
// A2: 채팅방 기억이 있는 방에 캐릭터별 스타일이 이어져 있으면 「채팅방 에이드가 이겨요」로 칠한 팔레트가 0.6초 뒤 저장된 「내 스타일」 자료에 덮어써졌어요
//     (같은 스타일을 이은 다른 캐릭터 · 스타일 목록의 그 스타일까지 바뀜). 에이드가 칠한 팔레트는 스타일 편집이 아니에요.
// A3: 「오늘의 에이드」만 켜면(채팅방 기억 끔) 「채팅이 바뀌며 변한 팔레트」를 거르는 열쇠가 늘 '' 라, 캐릭터별 스타일이 칠한 팔레트가 기본 에이드로 적혔어요.
// 진짜 ade.js · charstyle.js · styles.js · settings.js 를 가짜 브라우저(leak-dom)에서 돌려요. features.js 의 applyAll → syncFeatures 흐름만 흉내 내요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('  PASS  ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n        ')); } }

const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, palette: 'salt', quick: { adeChat: false, adeDaily: true } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
ctx.characters.push({ name: 'B', avatar: 'b.png', data: { extensions: {} } });
const S = await import(url('src/settings.js'));
const ade = await import(url('src/ade.js'));
const CS = await import(url('src/charstyle.js'));
const ST = await import(url('src/styles.js'));
const q = () => S.getSettings().quick;
const wantOn = () => q().adeChat === true || q().adeDaily === true;
// features.js 흉내: applyAll 끝 syncFeatures → (마이크로태스크) syncAde · 캐릭터 스타일이 입혀져 있으면 noteChange
const hooks = { applyAll() { const s = S.getSettings(); Promise.resolve().then(() => ade.syncAde(wantOn(), q(), hooks)); if (s.activeStyle) Promise.resolve().then(() => CS.noteChange()); }, refreshPanels() {} };
const chatChanged = async (id) => { ctx.characterId = id; await eventSource.emit(ctx.event_types.CHAT_CHANGED); await dom.clock.advance(1); };
const pick = async (palette) => { S.getSettings().palette = palette; hooks.applyAll(); await dom.clock.advance(1); };   // 설정 창에서 에이드를 고름
const mode = async (chat, daily) => { const s = S.getSettings(); s.quick.adeChat = chat; s.quick.adeDaily = daily; hooks.applyAll(); await dom.clock.advance(1); };
const style = id => S.getSettings().styles.find(x => x.id === id).data;
const fam = () => { const id = S.getSettings().palette; return id === 'salt' ? 'blue' : id.replace(/-night$|-light$/, ''); };

S.getSettings();
hooks.applyAll(); await dom.clock.advance(1);
await chatChanged(0);
{
    const s = S.getSettings();
    s.styles = [{ id: 'st1', name: '라벤더 스타일', data: { ...ST.captureStyle(s), palette: 'lavender' } }];
    s.charStyles = { 'c:b.png': 'st1' };
    CS.startCharStyles(hooks.applyAll, hooks.refreshPanels);
}

await test('A3 오늘의 에이드만: 캐릭터별 스타일이 칠한 팔레트는 기본 에이드로 적지 않고, 그 방은 스타일 팔레트 그대로', async () => {
    const base = ade.adeBase();
    assert.ok(base && base !== 'lavender', `기본 에이드 ${base}`);
    await chatChanged(1);
    assert.equal(ade.adeBase(), base, '스타일이 칠한 라벤더가 기본 에이드로 적혔어요');
    assert.equal(fam(), 'lavender', '스타일이 이어진 방은 스타일 팔레트 그대로');
    await dom.clock.advance(700);
    assert.equal(style('st1').palette, 'lavender');
    await chatChanged(0);
    assert.equal(ade.adeBase(), base);
    assert.equal(fam(), base, '나오면 기본 에이드');
});

await test('A3 오늘의 에이드만: 같은 방에서 직접 고른 에이드는 예전처럼 기본 에이드로 적혀요', async () => {
    await pick('peach');
    assert.equal(ade.adeBase(), 'peach');
    assert.deepEqual(ade._forTest.state().chats, {});
});

await test('A2 채팅방 에이드가 스타일을 이긴 뒤에도 저장된 「내 스타일」의 팔레트는 그대로', async () => {
    await mode(true, false);
    ade._forTest.state().chats['c:b.png'] = 'melon';   // 스타일을 잇기 전에 이 방에서 멜론을 골라 둔 적이 있음
    await chatChanged(1);
    assert.equal(fam(), 'melon', '채팅방 에이드가 이겨요');
    await dom.clock.advance(700);   // charstyle.js noteChange → commit(600ms)
    assert.equal(style('st1').palette, 'lavender', '에이드가 칠한 멜론이 스타일 자료에 적혔어요');
});

await test('A2 에이드가 칠한 채로 다른 모습을 바꾸면 그 값만 스타일에 적히고 팔레트는 그대로', async () => {
    const s = S.getSettings();
    const was = s.chat.fontSize;
    s.chat.fontSize = was + 1; hooks.applyAll(); await dom.clock.advance(700);
    assert.equal(style('st1').chat.fontSize, was + 1, '스타일 편집은 예전처럼 적혀요');
    assert.equal(style('st1').palette, 'lavender');
    await chatChanged(0);   // 나갈 때의 commit 도 같아요
    assert.equal(style('st1').palette, 'lavender');
    assert.notEqual(fam(), 'melon');
});

await test('A2 스타일이 입혀진 방에서 사용자가 직접 고른 에이드는 예전처럼 스타일과 채팅방 기억 둘 다에 적혀요', async () => {
    await chatChanged(1);
    assert.equal(fam(), 'melon');
    await pick('strawberry');
    await dom.clock.advance(700);
    assert.equal(ade._forTest.state().chats['c:b.png'], 'strawberry');
    assert.equal(style('st1').palette, 'strawberry');
});

await test('에이드를 끈 뒤에는 표시가 남지 않아요 — 스타일 방에서 고른 팔레트가 그대로 스타일에 적혀요', async () => {
    await chatChanged(0);
    await mode(false, false);
    await chatChanged(1);
    assert.equal(fam(), 'strawberry', '스타일 팔레트');
    await pick('melon');
    await dom.clock.advance(700);
    assert.equal(style('st1').palette, 'melon');
});

console.log(`ade-charstyle: ${pass}개 통과${fail ? ` · ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
