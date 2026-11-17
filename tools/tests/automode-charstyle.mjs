// 버그 사냥 7 — 화이트 · 나이트 자동(src/automode.js)과 캐릭터별 스타일(src/charstyle.js)이 겹칠 때
//   node tools/tests/automode-charstyle.mjs <테마 루트>
// 자동이 바꾼 밝기는 「저장하지 않는다」(7.0.2) 인데, 캐릭터 스타일이 입혀진 채팅에서는 0.6초 뒤 commit 이 바뀐 밝기를
// 저장된 「내 스타일」 자료에 적고 설정 전체를 저장했어요. 숨었다 돌아온 탭이 다른 기기 설정을 덮던 길이 이쪽으로 다시 열려 있었어요.
// 진짜 automode.js · charstyle.js · styles.js · settings.js 를 가짜 브라우저(leak-dom)에서 돌려요. features.js 의 applyAll → syncFeatures 흐름만 흉내 내요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('  PASS  ' + name); } catch (e) { fail++; console.log('  FAIL  ' + name + '\n        ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n        ')); } }

const dom = await import(url('tools/tests/leak-dom.mjs'));
// 기기 다크 모드 꺼짐(leak-dom matchMedia 는 늘 false) → 자동은 「화이트」 를 원해요
const settings = { enabled: true, palette: 'salt', auto: { on: false, by: 'system', night: '20:00', day: '07:00' } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
let saves = 0;
ctx.saveSettingsDebounced = () => { saves++; };
ctx.characters.push({ name: 'B', avatar: 'b.png', data: { extensions: {} } });
const S = await import(url('src/settings.js'));
const P = await import(url('src/palettes.js'));
const AM = await import(url('src/automode.js'));
const CS = await import(url('src/charstyle.js'));
const ST = await import(url('src/styles.js'));
// features.js 흉내: applyAll 끝 syncFeatures → (마이크로태스크) 자동 켜졌으면 syncAutoMode · 캐릭터 스타일이 입혀져 있으면 noteChange
const hooks = {
    applyAll() {
        const s = S.getSettings();
        Promise.resolve().then(() => AM.syncAutoMode(!!s.auto?.on, hooks));
        if (s.activeStyle) Promise.resolve().then(() => CS.noteChange());
    },
    refreshPanels() {},
};
const chatChanged = async (id) => { ctx.characterId = id; await eventSource.emit(ctx.event_types.CHAT_CHANGED); await dom.clock.advance(1); };
const style = id => S.getSettings().styles.find(x => x.id === id).data;
const night = P.paletteVariant('blue', 'dark');

S.getSettings();
hooks.applyAll(); await dom.clock.advance(1);
await chatChanged(0);
{
    const s = S.getSettings();
    // 밤에 담아 둔 스타일(블루 · 나이트)을 캐릭터 B 에 이어 둠
    s.styles = [{ id: 'st1', name: '밤 스타일', data: { ...ST.captureStyle(s), palette: night } }];
    s.charStyles = { 'c:b.png': 'st1' };
    CS.startCharStyles(hooks.applyAll, hooks.refreshPanels);
}

await test('자동(기기 · 화이트)이 켜진 채 나이트 스타일 방을 열면 화면은 화이트, 스타일 자료는 나이트 그대로', async () => {
    S.getSettings().auto.on = true;
    hooks.applyAll(); await dom.clock.advance(1);
    await chatChanged(1);
    await dom.clock.advance(5);
    assert.equal(P.paletteMode(S.getSettings().palette), 'light', '자동이 밝기를 맞춰요');
    await dom.clock.advance(700);   // charstyle noteChange → commit(600ms)
    assert.equal(style('st1').palette, night, '자동이 바꾼 밝기가 「내 스타일」 자료에 적혔어요');
});

await test('자동이 밝기만 바꿀 때는 설정을 저장하지 않아요(숨었다 돌아온 탭)', async () => {
    const s = S.getSettings();
    s.palette = night;   // 다른 탭 · 잠든 동안 남은 옛 밝기
    saves = 0;
    AM.check();
    await dom.clock.advance(700);
    assert.equal(P.paletteMode(s.palette), 'light');
    assert.equal(saves, 0, `저장 ${saves}번`);
    assert.equal(style('st1').palette, night);
});

await test('자동이 켜진 채라도 사용자가 고른 다른 에이드(묶음)는 예전처럼 스타일에 적혀요', async () => {
    const s = S.getSettings();
    s.palette = P.paletteVariant('melon', 'light');
    hooks.applyAll(); await dom.clock.advance(700);
    assert.equal(P.paletteFamily(style('st1').palette), 'melon');
});

await test('자동을 끄면 밝기 바꾸기도 예전처럼 스타일에 적혀요', async () => {
    const s = S.getSettings();
    s.auto.on = false;
    s.palette = P.paletteVariant('melon', 'dark');
    hooks.applyAll(); await dom.clock.advance(700);
    assert.equal(style('st1').palette, P.paletteVariant('melon', 'dark'));
});

console.log(`automode-charstyle: ${pass}개 통과${fail ? ` · ${fail}개 실패` : ''}`);
process.exit(fail ? 1 : 0);
