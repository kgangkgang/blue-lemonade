// 1.1.1 시제품 에이드 갈아입기 (src/ade-core.js · src/ade.js)
//   · 순수: 저장값 다듬기 · 날짜 열쇠 · 오늘의 에이드(같은 날 같은 것 · 어제 것 건너뜀) · 보여 줄 가족 · 사용자 선택 적기 · 기억 지우기
//   · 가짜 브라우저: 켜면 기본 = 지금 가족 · 채팅방에서 고른 에이드가 그 방에 적힘 · 채팅이 바뀌면 그 방 에이드 ↔ 기본 · 밝기(나이트)는 지금 것 · 그룹 열쇠 · 기억 지우기 · 오늘의 에이드 · 끄면 기본으로 · 리스너는 CHAT_CHANGED 하나
//   · 기본 꺼짐 · 켤 때만 받음(features.js) · 시작 그래프 밖 · 설정 창 · 찾기 · 이름표 · 설정 길
//   node tools/tests/ade.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

const core = await import(url('src/ade-core.js'));
const FAM = ['blue', 'lemon', 'black', 'melon', 'grapefruit', 'peach'];

await test('다듬기: 모르는 열쇠 · 가족 · 날짜는 걷고 상한을 지켜요', () => {
    const st = core.tidyAdeState({ chats: { 'c:a.png': 'peach', 'x:1': 'peach', 'g:7': 'nope', 'c:b.png': 'custom' }, base: 'zzz', day: '2026-13-99x' }, FAM);
    assert.deepEqual(st, { chats: { 'c:a.png': 'peach', 'c:b.png': 'custom' }, base: '', day: '' });
    assert.deepEqual(core.tidyAdeState(null, FAM), { chats: {}, base: '', day: '' });
    const many = Object.fromEntries(Array.from({ length: core.MAX_CHATS + 20 }, (_, i) => [`c:${i}.png`, 'lemon']));
    assert.equal(Object.keys(core.tidyAdeState({ chats: many }, FAM).chats).length, core.MAX_CHATS);
});

await test('오늘의 에이드: 같은 날은 같은 것 · 다음 날은 다른 것 · 어제 것과 같으면 건너뜀 · 커스텀은 안 뽑음', () => {
    const a = core.dailyFamily(FAM, '2026-11-09'), b = core.dailyFamily(FAM, '2026-11-09'), c = core.dailyFamily(FAM, '2026-11-10');
    assert.equal(a, b); assert.notEqual(a, c);
    assert.ok(FAM.includes(a) && FAM.includes(c));
    assert.notEqual(core.dailyFamily(FAM, '2026-11-09', a), a, '어제와 같으면 다음 것');
    assert.notEqual(core.dailyFamily([...FAM, 'custom'], '2026-11-12'), 'custom');
    assert.equal(core.dailyFamily(['custom'], '2026-11-12'), '');
    assert.equal(core.dailyFamily(['lemon'], '2026-11-12', 'lemon'), 'lemon', '하나뿐이면 그것');
    assert.match(core.dayKey(new Date(2026, 0, 5)), /^2026-01-05$/);
});

await test('보여 줄 가족 · 사용자 선택 적기 · 기억 지우기', () => {
    const st = { chats: { 'c:a.png': 'peach' }, base: 'blue', day: '' };
    assert.equal(core.wantedFamily(st, 'c:a.png', { chat: true, daily: false }), 'peach');
    assert.equal(core.wantedFamily(st, 'c:b.png', { chat: true, daily: false }), 'blue', '기억 없는 방은 기본');
    assert.equal(core.wantedFamily(st, 'c:a.png', { chat: false, daily: true }), 'blue', '채팅방 기억을 끄면 기본만');
    assert.equal(core.wantedFamily(st, 'c:a.png', { chat: false, daily: false }), '', '둘 다 꺼지면 건드리지 않음');
    core.noteUserPick(st, 'c:b.png', 'melon', { chat: true });
    assert.equal(st.chats['c:b.png'], 'melon');
    core.noteUserPick(st, '', 'lemon', { chat: true });
    assert.equal(st.base, 'lemon', '채팅이 없으면 기본에');
    core.noteUserPick(st, 'c:b.png', 'black', { chat: false, daily: true });
    assert.equal(st.base, 'black', '채팅방 기억이 꺼져 있으면 기본에');
    assert.equal(core.forgetChat(st, 'c:a.png'), true); assert.equal(core.forgetChat(st, 'c:a.png'), false);
    assert.deepEqual(Object.keys(st.chats), ['c:b.png']);
});

await test('기본 꺼짐 · 켤 때만 받음 · 시작 그래프 밖 · 설정 창 · 찾기 · 이름표 · 설정 길', async () => {
    assert.match(read('src/settings.js'), /quick: \{ selEdit: false, mesDelete: false, rangeDelete: true, selEditTr: false, adeChat: false, adeDaily: false \}/);
    const f = read('src/features.js');
    assert.match(f, /q\.adeChat === true \|\| q\.adeDaily === true/);
    assert.match(f, /load\('ade', '\.\/ade\.js'\)\.then\(m => m\?\.syncAde\(ade, q, hooks\)\)/);
    assert.match(read('src/panel.js'), /toggle\('quick\.adeChat', q\.adeChat === true\)/);
    assert.match(read('src/panel.js'), /toggle\('quick\.adeDaily', q\.adeDaily === true\)/);
    assert.match(read('src/panel.js'), /select\[data-ade-base\]/, '기본 에이드 고르기 줄');
    assert.match(read('src/settings-search.js'), /'quick\.adeChat'\]/);
    assert.match(read('src/settings-labels.js'), /'quick\.adeDaily':'오늘의 에이드'/);
    for (const file of ['index.js', 'src/apply.js', 'src/settings.js', 'src/features.js']) assert.doesNotMatch(read(file), /from '\.\/(src\/)?ade(-core)?\.js'/, file);
    const D = await import(url('src/settings-differences.js'));
    assert.deepEqual(D.settingRoute('quick.adeChat'), { tab: 'theme', sub: 'palette' });
    assert.deepEqual(D.settingRoute('quick.selEdit'), { tab: 'chat', sub: 'etc' });
});

// ───────── 가짜 브라우저 ─────────
const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, palette: 'salt', quick: { adeChat: true, adeDaily: false } };
const { ctx, eventSource } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
ctx.characters.push({ name: 'B', avatar: 'b.png', data: { extensions: {} } });
const S = await import(url('src/settings.js'));
const mod = await import(url('src/ade.js'));
const q = () => S.getSettings().quick;
let applies = 0;
// features.js 의 applyAll → syncFeatures → syncAde 되들어옴을 흉내
const wantOn = () => q().adeChat === true || q().adeDaily === true;
const hooks = { applyAll() { applies++; mod.syncAde(wantOn(), q(), hooks); }, refreshPanels() {} };
const fam = () => { const id = S.getSettings().palette; return id === 'salt' ? 'blue' : id.replace(/-night$|-light$/, ''); };
// 채팅 바뀜: 사건을 쏘고 다음 틱(ade 는 다른 리스너 뒤에 칠해요)까지 보내요
const chatChanged = async () => { await eventSource.emit(ctx.event_types.CHAT_CHANGED); await dom.clock.advance(1); };
S.getSettings();
const chatListeners = () => eventSource.byType().chat_changed || 0;
const before = chatListeners();

await test('켜면 기본 = 지금 가족 · 리스너는 CHAT_CHANGED 하나 · 팔레트 그대로', () => {
    mod.syncAde(true, q(), hooks); mod.syncAde(true, q(), hooks);
    assert.equal(mod._forTest.state().base, 'blue');
    assert.equal(chatListeners() - before, 1);
    assert.equal(S.getSettings().palette, 'salt'); assert.equal(applies, 0);
});

await test('채팅방에서 에이드를 고르면 그 방에 적혀요 (밝기 바꾸기는 안 적음)', () => {
    S.getSettings().palette = 'peach'; mod.syncAde(true, q(), hooks);   // 설정 창에서 피치 고름 → applyAll 끝의 syncFeatures
    assert.deepEqual(mod._forTest.state().chats, { 'c:char.png': 'peach' });
    S.getSettings().palette = 'peach-night'; mod.syncAde(true, q(), hooks);
    assert.deepEqual(mod._forTest.state().chats, { 'c:char.png': 'peach' }, '같은 가족이면 그대로');
    assert.equal(mod._forTest.state().base, 'blue');
    S.getSettings().palette = 'peach';
    mod.syncAde(true, q(), hooks);
});

await test('채팅이 바뀌면: 기억 없는 방은 기본으로 · 돌아오면 그 방 에이드 · applyAll 한 번씩', async () => {
    ctx.characterId = 1; applies = 0;
    await chatChanged();
    assert.equal(S.getSettings().palette, 'salt'); assert.equal(applies, 1);
    ctx.characterId = 0;
    await chatChanged();
    assert.equal(S.getSettings().palette, 'peach'); assert.equal(applies, 2);
    await chatChanged();
    assert.equal(applies, 2, '같은 방이면 다시 칠하지 않아요');
});

await test('캐릭터별 스타일과 겹치면 채팅방 에이드가 이겨요(스타일 뒤에 칠함) · 기억 없는 방은 스타일 그대로', async () => {
    // 캐릭터별 스타일 흉내: CHAT_CHANGED 에 팔레트를 바꾸고 applyAll(ade 보다 나중에 등록돼도 ade 가 마지막에 칠해요)
    const styled = () => { const s = S.getSettings(); if (ctx.characterId === 1) { s.palette = 'lavender'; s.activeStyle = { id: 'st1', key: 'c:b.png' }; } else { s.palette = 'salt'; s.activeStyle = null; } hooks.applyAll(); };
    eventSource.on(ctx.event_types.CHAT_CHANGED, styled);
    ctx.characterId = 1; await chatChanged();
    assert.equal(S.getSettings().palette, 'lavender', '기억 없는 방 → 스타일 팔레트 그대로(기본 에이드로 덮지 않음)');
    assert.deepEqual(mod._forTest.state().chats, { 'c:char.png': 'peach' }, '스타일이 바꾼 팔레트는 사용자 선택으로 적지 않아요');
    S.getSettings().palette = 'melon'; mod.syncAde(true, q(), hooks);   // 이 방에서 사용자가 직접 멜론을 고름
    assert.equal(mod._forTest.state().chats['c:b.png'], 'melon');
    ctx.characterId = 0; await chatChanged();
    assert.equal(S.getSettings().palette, 'peach');
    ctx.characterId = 1; await chatChanged();
    assert.equal(S.getSettings().palette, 'melon', '스타일(라벤더)이 칠한 뒤 채팅방 에이드(멜론)가 이겨요');
    eventSource.removeListener(ctx.event_types.CHAT_CHANGED, styled);
    S.getSettings().activeStyle = null;
    assert.equal(mod.adeForgetChat(), true);
    assert.equal(S.getSettings().palette, 'salt', '기억을 지우면 기본으로');
    ctx.characterId = 0; await chatChanged();
});

await test('기본 에이드 고르기: 기억 없는 방에 바로 칠해지고 모르는 값은 거절', async () => {
    ctx.characterId = 1; await chatChanged();
    assert.equal(mod.adeBase(), 'blue');
    assert.equal(mod.adeSetBase('zzz'), false); assert.equal(mod.adeSetBase('custom'), false);
    assert.equal(mod.adeSetBase('lemon'), true);
    assert.equal(S.getSettings().palette, 'lemon'); assert.equal(mod.adeBase(), 'lemon');
    ctx.characterId = 0; await chatChanged();
    assert.equal(S.getSettings().palette, 'peach', '기억 있는 방은 그대로');
    assert.equal(mod.adeSetBase('blue'), true);
    ctx.characterId = 1; await chatChanged(); assert.equal(S.getSettings().palette, 'salt');
    ctx.characterId = 0; await chatChanged();
});

await test('밝기는 지금 것을 따라요(나이트면 peach-night) · 그룹 열쇠', async () => {
    ctx.characterId = 1; await chatChanged();
    S.getSettings().palette = 'night'; mod.syncAde(true, q(), hooks);   // 나이트로 (가족은 blue 그대로 → 적지 않음)
    assert.deepEqual(mod._forTest.state().chats, { 'c:char.png': 'peach' });
    ctx.characterId = 0; await chatChanged();
    assert.equal(S.getSettings().palette, 'peach-night');
    ctx.groupId = 'g1'; await chatChanged();
    assert.equal(S.getSettings().palette, 'night', '그룹은 기억 없음 → 기본(나이트)');
    S.getSettings().palette = 'melon-night'; mod.syncAde(true, q(), hooks);
    assert.equal(mod._forTest.state().chats['g:g1'], 'melon');
    ctx.groupId = null;
});

await test('이 채팅방 기억 지우기 → 기본으로 돌아가요 · 라벨', async () => {
    ctx.characterId = 0; await chatChanged();
    assert.equal(S.getSettings().palette, 'peach-night');
    assert.equal(mod.adeChatLabel(), '피치 에이드');
    assert.equal(mod.adeForgetChat(), true);
    assert.equal(S.getSettings().palette, 'night');
    assert.equal(mod.adeChatLabel(), '');
    assert.equal(mod.adeForgetChat(), false);
});

await test('오늘의 에이드: 오늘 처음 켜면 기본이 오늘 것으로 · 같은 날 다시 불러도 그대로 · 기억 있는 방은 그쪽이 먼저', () => {
    settings.quick.adeDaily = true;
    mod.syncAde(true, q(), hooks);
    const st = mod._forTest.state();
    assert.equal(st.day, core.dayKey());
    assert.equal(st.base, core.dailyFamily(mod.families(), core.dayKey(), 'blue'));
    assert.equal(fam(), st.base);
    const was = S.getSettings().palette; mod.syncAde(true, q(), hooks);
    assert.equal(S.getSettings().palette, was);
    assert.equal(S.getSettings().palette.endsWith('-night') || S.getSettings().palette === 'black', true, '밝기는 나이트 그대로');
    S.getSettings().palette = 'lemon-night'; mod.syncAde(true, q(), hooks);
    assert.equal(mod._forTest.state().chats['c:char.png'], 'lemon');
});

await test('끄면 기본 에이드로 돌아와요 · 다시 켜도 리스너는 그대로', () => {
    const base = mod._forTest.state().base;
    settings.quick.adeChat = false; settings.quick.adeDaily = false;
    mod.syncAde(false, q(), hooks);
    assert.equal(fam(), base);
    assert.equal(mod._forTest.isOn(), false);
    settings.quick.adeChat = true;
    mod.syncAde(true, q(), hooks);
    assert.equal(chatListeners() - before, 1);
});

console.log(`ade: ${passed}개 통과`);
