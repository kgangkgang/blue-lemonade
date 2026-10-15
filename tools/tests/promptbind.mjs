// 프롬프트 귀속 (6.0.4, src/promptbind.js) — 가짜 실리태번 문맥 · 가짜 프롬프트 관리자로 묶기 · 맞추기 · 이름 바꾸기 · 설정 정리 검사. 네트워크 · DOM 없음.
//   node tools/tests/promptbind.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const listeners = {};
const ctx = {
    extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() { ctx.saves = (ctx.saves || 0) + 1; },
    characters: [{ avatar: 'haru.png', name: '하루' }, { avatar: 'selene.png', name: '셀레네' }], groups: [{ id: 'g1', name: '블루 록 모임' }],
    characterId: 0, groupId: null, chatId: 'chat-a', getCurrentChatId: () => ctx.chatId,
    eventSource: { on(name, fn) { (listeners[name] ??= []).push(fn); } },
    event_types: { CHAT_CHANGED: 'chat_id_changed', OAI_PRESET_CHANGED_AFTER: 'oai_preset_changed_after', CHARACTER_RENAMED: 'character_renamed' },
};
globalThis.SillyTavern = { getContext: () => ctx };
const { getSettings, invalidateSettings, resetSettings } = await import(pathToFileURL(path.join(root, 'src/settings.js')));
const B = await import(pathToFileURL(path.join(root, 'src/promptbind.js')));
// 가짜 프롬프트 관리자: 전역 순서 하나
const order = [{ identifier: 'dialogue_colors', enabled: false }, { identifier: 'main', enabled: true }, { identifier: 'bluelock_colors', enabled: true }];
const pm = { activeCharacter: { id: 100001 }, saved: 0, rendered: 0,
    getPromptOrderEntry: (_c, id) => order.find(e => e.identifier === id) ?? null,
    getPromptById: id => ({ identifier: id, name: `이름:${id}` }),
    saveServiceSettings: async () => { pm.saved++; }, render: () => { pm.rendered++; } };
B.setPromptManager(pm);
const on = (id) => (order.find(e => e.identifier === id).enabled !== false);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
getSettings();

await test('열쇠: 캐릭터 c:아바타 · 채팅 c:아바타/채팅 · 그룹 g:id', () => {
    assert.deepEqual(B.currentKeys(), ['c:haru.png', 'c:haru.png/chat-a']);
    assert.equal(B.isChatKey('c:haru.png/chat-a'), true); assert.equal(B.isChatKey('c:haru.png'), false);
    assert.equal(B.bindLabel('c:haru.png'), '하루'); assert.equal(B.bindLabel('c:haru.png/chat-a.jsonl'), '하루 · chat-a'); assert.equal(B.bindLabel('g:g1'), '블루 록 모임');
    ctx.groupId = 'g1'; ctx.chatId = 'gchat';
    assert.deepEqual(B.currentKeys(), ['g:g1', 'g:g1/gchat']);
    ctx.groupId = null; ctx.chatId = 'chat-a';
});
await test('묶기 · 풀기 저장 (설정 promptBinds) · 잘못된 열쇠는 거부', () => {
    assert.equal(B.setBind('bluelock_colors', 'c:haru.png', true), true);
    assert.deepEqual(getSettings().promptBinds, { bluelock_colors: { keys: ['c:haru.png'], regex: [] } });
    assert.equal(B.setBind('bluelock_colors', 'x:bad', true), false);
    assert.equal(B.setBind('', 'c:haru.png', true), false);
    B.setBind('bluelock_colors', 'c:haru.png', false);
    assert.deepEqual(getSettings().promptBinds, {}, '마지막 열쇠를 풀면 묶음이 사라진다');
});
await test('맞추기: 묶인 캐릭터를 열면 켜고 다른 캐릭터로 가면 끈다 · 묶지 않은 항목은 건드리지 않는다', async () => {
    B.setBind('bluelock_colors', 'c:haru.png', true);
    order[2].enabled = false;
    assert.equal(await B.syncPromptBinds(), 1); assert.equal(on('bluelock_colors'), true); assert.equal(pm.saved, 1); assert.equal(pm.rendered, 1);
    assert.equal(await B.syncPromptBinds(), 0, '이미 맞으면 저장하지 않는다'); assert.equal(pm.saved, 1);
    ctx.characterId = 1;   // 셀레네
    assert.equal(await B.syncPromptBinds(), 1); assert.equal(on('bluelock_colors'), false, '나가면 꺼진다');
    assert.equal(on('main'), true, '묶지 않은 항목은 그대로'); assert.equal(on('dialogue_colors'), false);
    ctx.characterId = 0;
    assert.equal(await B.syncPromptBinds(), 1); assert.equal(on('bluelock_colors'), true);
});
await test('채팅 단위 묶기: 그 채팅에서만 켜진다', async () => {
    B.setBind('dialogue_colors', 'c:selene.png/chat-s', true);
    ctx.characterId = 1; ctx.chatId = 'chat-x';
    await B.syncPromptBinds(); assert.equal(on('dialogue_colors'), false);
    ctx.chatId = 'chat-s';
    await B.syncPromptBinds(); assert.equal(on('dialogue_colors'), true);
    ctx.chatId = 'chat-x';
    await B.syncPromptBinds(); assert.equal(on('dialogue_colors'), false);
    ctx.characterId = 0; ctx.chatId = 'chat-a';
});
await test('그룹 묶기 · 이 프리셋에 없는 항목은 무시 · 프롬프트 관리자가 없으면 0', async () => {
    B.setBind('bluelock_colors', 'g:g1', true);
    ctx.groupId = 'g1'; ctx.chatId = 'gchat';
    await B.syncPromptBinds(); assert.equal(on('bluelock_colors'), true);
    ctx.groupId = null; ctx.chatId = 'chat-a';
    B.setBind('ghost_prompt', 'c:haru.png', true);
    assert.equal(await B.syncPromptBinds(), 0, '없는 항목은 건너뛰고 나머지는 이미 맞음');
    B.clearBinds('ghost_prompt');
    B.setPromptManager({ activeCharacter: null }); assert.equal(await B.syncPromptBinds(), 0); B.setPromptManager(pm);
});
await test('캐릭터 파일 이름 바꾸기: 캐릭터 열쇠와 그 채팅 열쇠를 옮긴다', () => {
    B.setBind('dialogue_colors', 'c:haru.png/chat-a', true);
    assert.equal(B.renameKeys('haru.png', 'haru2.png'), 2);
    assert.deepEqual(B.keysOf('bluelock_colors').sort(), ['c:haru2.png', 'g:g1']);
    assert.ok(B.keysOf('dialogue_colors').includes('c:haru2.png/chat-a'));
    assert.equal(B.renameKeys('haru2.png', 'haru.png'), 2);
});
await test('설정 정리: 잘못된 묶음은 지우고 열쇠는 중복 없이 · 모습 초기화 뒤에도 남는다', () => {
    ctx.extensionSettings.salty.promptBinds = { ok: { keys: ['c:a.png', 'c:a.png', 'bad', 7] }, empty: { keys: [] }, junk: 'x', 5: { keys: ['g:1'] }, rx: { regex: ['r1', 5, 'r1'] } };
    invalidateSettings();
    assert.deepEqual(getSettings().promptBinds, { ok: { keys: ['c:a.png'], regex: [] }, 5: { keys: ['g:1'], regex: [] }, rx: { keys: [], regex: ['r1'] } });
    resetSettings({ look: true });
    assert.deepEqual(getSettings().promptBinds, { ok: { keys: ['c:a.png'], regex: [] }, 5: { keys: ['g:1'], regex: [] }, rx: { keys: [], regex: ['r1'] } }, '테마 모습 초기화는 귀속을 지우지 않는다');
});
await test('정규식 붙이기: 프롬프트와 함께 켜고 끈다 (전역 정규식 disabled) · 정규식만 붙인 묶음은 캐릭터 열쇠가 없으면 건드리지 않는다', async () => {
    ctx.extensionSettings.salty.promptBinds = {}; invalidateSettings();
    ctx.extensionSettings.regex = [{ id: 'rx-1', scriptName: '속마음 색', disabled: true }, { id: 'rx-2', scriptName: '다른 것', disabled: false }];
    order[2].enabled = false; ctx.characterId = 0;
    assert.equal(B.setBindRegex('bluelock_colors', 'rx-1', true), true);
    assert.deepEqual(B.regexOf('bluelock_colors'), ['rx-1']);
    assert.equal(await B.syncPromptBinds(), 0, '캐릭터 열쇠가 없으면 판단하지 않는다'); assert.equal(ctx.extensionSettings.regex[0].disabled, true);
    B.setBind('bluelock_colors', 'c:haru.png', true);
    assert.equal(await B.syncPromptBinds(), 2, '프롬프트 + 정규식'); assert.equal(on('bluelock_colors'), true); assert.equal(ctx.extensionSettings.regex[0].disabled, false); assert.equal(ctx.extensionSettings.regex[1].disabled, false, '안 붙인 정규식은 그대로');
    ctx.characterId = 1;
    assert.equal(await B.syncPromptBinds(), 2); assert.equal(on('bluelock_colors'), false); assert.equal(ctx.extensionSettings.regex[0].disabled, true, '나가면 정규식도 꺼진다');
    B.setBindRegex('bluelock_colors', 'rx-1', false); assert.deepEqual(B.regexOf('bluelock_colors'), []); assert.deepEqual(B.keysOf('bluelock_colors'), ['c:haru.png']);
    assert.equal(B.regexName('rx-2'), '다른 것'); assert.equal(B.regexName('nope'), 'nope');
    ctx.characterId = 0; B.clearBinds('bluelock_colors');
});
await test('시작: CHAT_CHANGED · 프리셋 바꿈 · 이름 바꿈을 듣고 바로 한 번 맞춘다', async () => {
    ctx.extensionSettings.salty.promptBinds = { bluelock_colors: { keys: ['c:haru.png'] } }; invalidateSettings();
    order[2].enabled = false;
    B.startPromptBinds();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(on('bluelock_colors'), true, '시작할 때 지금 채팅에 맞춘다');
    assert.ok(listeners['chat_id_changed']?.length && listeners['oai_preset_changed_after']?.length && listeners['character_renamed']?.length);
    ctx.characterId = 1; for (const fn of listeners['chat_id_changed']) fn(); await new Promise(r => setTimeout(r, 10));
    assert.equal(on('bluelock_colors'), false);
    for (const fn of listeners['character_renamed']) fn('haru.png', 'haru3.png');
    assert.deepEqual(B.keysOf('bluelock_colors'), ['c:haru3.png']);
});
await test('6.0.5 카드 안(스코프) 정규식도 목록에 들고 같이 켜고 끈다 · 카드에 저장한다', async () => {
    ctx.characterId = 0; ctx.chatId = 'chat-a';
    ctx.characters[0].data = { extensions: { regex_scripts: [{ id: 'r-scoped', scriptName: '스코프 정규식', disabled: true }] } };
    ctx.writeExtensionField = async (chid, key, value) => { ctx.wrote = [chid, key, value.length]; };
    assert.deepEqual(B.scopedRegexScripts().map(s => s.id), ['r-scoped']);
    assert.equal(B.regexName('r-scoped'), '스코프 정규식');
    ctx.extensionSettings.salty.promptBinds = { bluelock_colors: { keys: ['c:haru.png'], regex: ['r-scoped'] } }; invalidateSettings();
    order[2].enabled = true;
    assert.ok(await B.syncPromptBinds() >= 1);
    assert.equal(ctx.characters[0].data.extensions.regex_scripts[0].disabled, false, '묶인 캐릭터를 열면 카드 정규식이 켜진다');
    assert.deepEqual(ctx.wrote, [0, 'regex_scripts', 1], '카드에 저장');
    ctx.chatId = 'other'; ctx.extensionSettings.salty.promptBinds = { bluelock_colors: { keys: ['c:haru.png/chat-a'], regex: ['r-scoped'] } }; invalidateSettings();
    await B.syncPromptBinds();
    assert.equal(ctx.characters[0].data.extensions.regex_scripts[0].disabled, true, '같은 캐릭터의 다른 채팅이면 끈다');
    delete ctx.characters[0].data; delete ctx.writeExtensionField; ctx.chatId = 'chat-a';
});
await test('6.0.6 프리셋 안 정규식도 목록에 들고 같이 켜고 끈다 · 프리셋에 저장한다 · 정규식이 바뀌면 채팅을 다시 그린다', async () => {
    ctx.characterId = 0; ctx.chatId = 'chat-a';
    ctx.extensionSettings.regex = [{ id: 'rx-1', scriptName: '속마음 색', disabled: true }];
    const presetList = [{ id: 'r-preset', scriptName: 'DEM - Dialogue Color', disabled: true }, { id: 'r-other', scriptName: 'DEM - Other', disabled: true }];
    const tick = () => new Promise(r => setTimeout(r, 5));
    const pmgr = { name: 'P', stored: presetList,
        getSelectedPresetName() { return pmgr.name; }, getCompletionPresetByName(n) { return n === 'P' ? { extensions: { regex_scripts: pmgr.stored } } : null; },
        readPresetExtensionField: ({ path }) => path === 'regex_scripts' ? presetList : null,
        writePresetExtensionField: async ({ name, path, value }) => { ctx.presetWrote = [name, path, value === presetList]; } };
    ctx.getPresetManager = () => pmgr;
    ctx.reloadCurrentChat = async () => { ctx.reloads = (ctx.reloads || 0) + 1; };
    ctx.saveChat = async () => { ctx.chatSaves = (ctx.chatSaves || 0) + 1; };
    assert.deepEqual(B.presetRegexScripts().map(s => s.id), ['r-preset', 'r-other']);
    assert.deepEqual(B.allRegexScripts().map(s => [s.id, s._scope]), [['rx-1', 'global'], ['r-preset', 'preset'], ['r-other', 'preset']], '전역 · 이 캐릭터 · 프리셋 순서');
    assert.equal(B.regexName('r-preset'), 'DEM - Dialogue Color');
    ctx.extensionSettings.salty.promptBinds = { bluelock_colors: { keys: ['c:haru.png'], regex: ['r-preset'] } }; invalidateSettings();
    order[2].enabled = true;
    assert.equal(await B.syncPromptBinds('chat'), 1); await tick();
    assert.equal(presetList[0].disabled, false, '묶은 캐릭터를 열면 프리셋 정규식이 켜진다'); assert.equal(presetList[1].disabled, true, '안 붙인 프리셋 정규식은 그대로');
    assert.deepEqual(ctx.presetWrote, ['P', 'regex_scripts', true], '읽을 때의 프리셋 이름으로 저장 (같은 배열을 그대로)');
    assert.equal(ctx.reloads, 1, '정규식이 바뀌면 채팅을 다시 그린다'); assert.equal(ctx.chatSaves, 1, '다시 그리기 전에 저장한다');
    assert.equal(await B.syncPromptBinds('chat'), 0, '이미 맞으면 바꾸지 않는다'); await tick(); assert.equal(ctx.reloads, 1, '맞으면 다시 그리지 않는다');
    ctx.characterId = 1; ctx.presetWrote = null;
    assert.equal(await B.syncPromptBinds('chat'), 2, '프롬프트 + 프리셋 정규식');
    assert.equal(presetList[0].disabled, true, '나가면 프리셋 정규식도 꺼진다'); assert.deepEqual(ctx.presetWrote, ['P', 'regex_scripts', true]);
    assert.equal(ctx.reloads, 1, '1.5초 안의 두 번째 바뀜은 바로 그리지 않고');
    // 미뤄 둔 다시 그리기는 1.5초 뒤 — 타이머가 1ms 일찍 깨면 600ms 더 미루므로 (느린 CI 러너에서 1.7초 고정 대기가 어긋났다) 기다리며 본다
    for (let i = 0; i < 80 && ctx.reloads < 2; i++) await new Promise(r => setTimeout(r, 50));
    assert.equal(ctx.reloads, 2, '미뤘다가 다시 그린다');
    // 설정 저장 뒤의 되맞춤(settle)은 정규식을 바꿔도 다시 그리지 않는다 (다른 확장과 서로 뒤집는 자리)
    ctx.characterId = 0; ctx.presetWrote = null;
    assert.equal(await B.syncPromptBinds('settle'), 2); await new Promise(r => setTimeout(r, 2300));
    assert.equal(presetList[0].disabled, false); assert.equal(ctx.reloads, 2, 'settle 은 다시 그리지 않는다');
    // 프리셋이 바뀌는 틈(선택은 새 이름 · 설정은 옛 목록)에는 프리셋 정규식을 건드리지도 쓰지도 않는다
    ctx.characterId = 1; ctx.presetWrote = null; pmgr.stored = [{ id: 'r-new', disabled: false }];
    assert.equal(await B.syncPromptBinds('chat'), 1, '프롬프트만 끈다'); assert.equal(presetList[0].disabled, false, '옛 목록은 그대로'); assert.equal(ctx.presetWrote, null, '쓰지 않는다');
    pmgr.stored = presetList;
    assert.equal(await B.syncPromptBinds('chat'), 1, '프리셋이 자리 잡으면 정규식을 끈다'); assert.equal(presetList[0].disabled, true); assert.deepEqual(ctx.presetWrote, ['P', 'regex_scripts', true]);
    // 읽은 뒤 쓰기 전에 다른 프리셋을 골랐으면 쓰지 않는다
    ctx.characterId = 0; ctx.presetWrote = null; let reads = 0; pmgr.getSelectedPresetName = () => (reads++ === 0 ? 'P' : 'Q');
    assert.equal(await B.syncPromptBinds('chat'), 2); assert.equal(presetList[0].disabled, false); assert.equal(ctx.presetWrote, null, '그새 다른 프리셋을 골랐으면 쓰지 않는다');
    pmgr.getSelectedPresetName = () => pmgr.name;
    await new Promise(r => setTimeout(r, 1600));
    B.clearBinds('bluelock_colors'); delete ctx.getPresetManager; delete ctx.reloadCurrentChat; delete ctx.saveChat; delete ctx.presetWrote; delete ctx.reloads; delete ctx.chatSaves;
    assert.deepEqual(B.presetRegexScripts(), [], '프리셋 관리자가 없으면 빈 목록');
});
await test('6.0.6 두 묶음이 같은 정규식을 서로 다르게 바라면 켜기가 이기고 되돌이표가 없다', async () => {
    ctx.characterId = 0; ctx.chatId = 'chat-a';
    ctx.extensionSettings.regex = [{ id: 'rx-1', scriptName: '속마음 색', disabled: true }];
    order[0].enabled = false; order[2].enabled = false;
    ctx.extensionSettings.salty.promptBinds = { bluelock_colors: { keys: ['c:haru.png'], regex: ['rx-1'] }, dialogue_colors: { keys: ['c:selene.png'], regex: ['rx-1'] } }; invalidateSettings();
    assert.equal(await B.syncPromptBinds(), 2, '하루: bluelock 켜짐 + 정규식 켜짐 (dialogue 는 이미 꺼짐)');
    assert.equal(ctx.extensionSettings.regex[0].disabled, false);
    assert.equal(await B.syncPromptBinds(), 0, '한 번 더 맞춰도 바뀌지 않는다 (묶음마다 뒤집으면 여기서 2 가 나와 되돌이표)');
    ctx.characterId = 1;
    assert.equal(await B.syncPromptBinds(), 2, '셀레네: bluelock 꺼짐 + dialogue 켜짐, 정규식은 그대로 켜짐');
    assert.equal(ctx.extensionSettings.regex[0].disabled, false);
    ctx.groupId = 'g1'; ctx.chatId = 'gchat';
    assert.equal(await B.syncPromptBinds(), 2, '그룹: dialogue 꺼짐 + 정규식 꺼짐');
    assert.equal(ctx.extensionSettings.regex[0].disabled, true);
    ctx.groupId = null; ctx.characterId = 0; ctx.chatId = 'chat-a'; B.clearBinds('bluelock_colors'); B.clearBinds('dialogue_colors');
});
await test('6.0.6 찾기: 한글화 스크립트가 정규식 목록 줄에 바꿔 보여 주는 이름으로도 맞는다 · 보이는 이름이 칩 · 창 제목은 편집 창 이름 칸', () => {
    const rows = { 'r-preset': 'DEM - 대사 색', 'rx-1': '' };
    globalThis.document = { getElementById: id => id === 'completion_prompt_manager_popup_entry_form_name' ? { value: ' Dialogue Color ' }
        : (id in rows && rows[id]) ? { classList: { contains: c => c === 'regex-script-label' }, querySelector: sel => sel === '.regex_script_name' ? { textContent: ` ${rows[id]} ` } : null } : null };
    try {
        ctx.extensionSettings.regex = [{ id: 'rx-1', scriptName: '속마음 색' }];
        ctx.getPresetManager = () => ({ readPresetExtensionField: () => [{ id: 'r-preset', scriptName: 'DEM - Dialogue Color' }] });
        assert.equal(B.regexShownName('r-preset'), 'DEM - 대사 색'); assert.equal(B.regexShownName('rx-1'), '', '목록 줄이 없으면 빈 글자'); assert.equal(B.regexShownName(''), '');
        assert.equal(B.regexName('r-preset'), 'DEM - 대사 색', '칩 · 목록에는 한글화된 이름'); assert.equal(B.regexName('rx-1'), '속마음 색', '없으면 원래 이름');
        const s = { id: 'r-preset', scriptName: 'DEM - Dialogue Color' };
        assert.equal(B.regexMatches(s, '대사'), true, '한글화된 이름'); assert.equal(B.regexMatches(s, 'dialogue'), true, '원래 이름 (대소문자 무시)'); assert.equal(B.regexMatches(s, ' 색 '), true); assert.equal(B.regexMatches(s, 'xyz'), false); assert.equal(B.regexMatches(s, ''), true, '빈 찾기는 전부');
        assert.equal(B._forTest.promptName('abc-123'), 'Dialogue Color', '편집 창 이름 칸');
    } finally { delete globalThis.document; delete ctx.getPresetManager; }
    assert.equal(B._forTest.promptName('abc-123'), '이름:abc-123', 'DOM 이 없으면 프롬프트 관리자');
});
await test('6.5.2 캐릭터 이름 연동: 이름이 든 프롬프트·정규식은 그 캐릭터에서만, 「기본」·이름 뺀 짝은 반대로 · 직접 묶은 것은 묶음이 우선', async () => {
    ctx.characterId = 0; ctx.chatId = 'chat-a'; ctx.groupId = null;
    const names = { color_base: '🎨 대사 색상 (데우스 · 기본)｜색상 택1', color_haru: '🎨 대사 색상 (데우스 · 하루)｜색상 택1', dc_plain: '| Dialogue Color |', dc_haru: '| Dialogue Color (하루) |', dc_other: '| Dialogue Color (Rex) |', main: '메인', bound: '묶은 것 (하루)' };
    const order2 = [{ identifier: 'color_base', enabled: true }, { identifier: 'color_haru', enabled: false }, { identifier: 'dc_plain', enabled: true }, { identifier: 'dc_haru', enabled: false }, { identifier: 'dc_other', enabled: true }, { identifier: 'main', enabled: true }, { identifier: 'bound', enabled: false }];
    const pm2 = { activeCharacter: { id: 100001 }, saved: 0, rendered: 0, getPromptOrderForCharacter: () => order2, getPromptOrderEntry: (_c, id) => order2.find(e => e.identifier === id) ?? null,
        getPromptById: id => ({ identifier: id, name: names[id] || id }), saveServiceSettings: async () => { pm2.saved++; }, render: () => { pm2.rendered++; } };
    B.setPromptManager(pm2);
    const on2 = id => order2.find(e => e.identifier === id).enabled !== false;
    ctx.extensionSettings.regex = [{ id: 'rx-haru', scriptName: '속마음 색 — 하루 (데우스)', disabled: true }, { id: 'rx-show', scriptName: '속마음 표시 (데우스)', disabled: false }];
    ctx.extensionSettings.salty.promptBinds = {}; ctx.extensionSettings.salty.promptLink = { on: true, name: ' 하루 ' }; invalidateSettings();
    assert.deepEqual(getSettings().promptLink, { on: true, rows: [{ word: '하루', cards: [] }] }, '6.7.5 예전 한 줄 설정은 다듬어 첫 줄로'); assert.deepEqual(B.linkRows(), [{ word: '하루', cards: [] }]);
    const fold = s => s.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();   // 짝 이름은 fold 한 꼴로 돌아온다 (전각 ｜ → | 도 NFKC 로 같아진다)
    assert.ok(B.linkTwinNames(names.color_haru, '하루').includes(fold(names.color_base)), '이름 자리에 「기본」');
    assert.ok(B.linkTwinNames(names.dc_haru, '하루').includes('| dialogue color |'), '(이름) 괄호째 뺀 것 (fold: 소문자)');
    assert.ok(!B.linkTwinNames(names.color_haru, '하루').some(x => x.includes('하루')), '짝 후보에 이름이 남지 않는다');
    assert.deepEqual(B.linkTwinNames('메인', '하루'), [], '이름이 안 든 것은 짝 후보가 없다');
    assert.equal(B.linkMatches('하루', ctx), true, '카드 이름'); assert.equal(B.linkMatches('HARU', ctx), true, '아바타 파일 이름 (확장자 뺀 · 대소문자 무시)'); assert.equal(B.linkMatches('', ctx), false);
    ctx.characterId = 1; assert.equal(B.linkMatches('하루', ctx), false, '다른 캐릭터');
    ctx.groupId = 'g1'; ctx.groups[0].members = ['haru.png']; assert.equal(B.linkMatches('하루', ctx), true, '그룹 구성원'); ctx.groups[0].members = ['selene.png']; assert.equal(B.linkMatches('하루', ctx), false); delete ctx.groups[0].members; ctx.groupId = null;
    ctx.characterId = 0;
    assert.deepEqual(await B.linkReport(), { prompts: 3, twins: 2, regex: 1, rows: [{ prompts: 3, twins: 2, regex: 1 }] }, '안내: 이름 든 프롬프트 3 (color_haru · dc_haru · bound) · 짝 2 · 정규식 1');
    assert.equal(await B.syncPromptBinds(), 6, '하루: 이름 든 셋(color_haru · dc_haru · bound) 켜고 짝 둘 끄고 정규식 하나 켠다');
    assert.equal(on2('color_haru'), true); assert.equal(on2('color_base'), false); assert.equal(on2('dc_haru'), true); assert.equal(on2('dc_plain'), false);
    assert.equal(on2('dc_other'), true, '다른 이름의 변형은 그대로'); assert.equal(on2('main'), true); assert.equal(on2('bound'), true, '묶음이 없으니 이름 규칙으로 켜진다');
    assert.equal(ctx.extensionSettings.regex[0].disabled, false, '이름 든 정규식 켜짐'); assert.equal(ctx.extensionSettings.regex[1].disabled, false, '이름 없는 정규식은 그대로');
    assert.equal(pm2.saved, 1); assert.equal(await B.syncPromptBinds(), 0, '이미 맞으면 저장하지 않는다'); assert.equal(pm2.saved, 1);
    ctx.characterId = 1;
    assert.equal(await B.syncPromptBinds(), 6, '셀레네: 반대로');
    assert.equal(on2('color_haru'), false); assert.equal(on2('color_base'), true); assert.equal(on2('dc_haru'), false); assert.equal(on2('dc_plain'), true); assert.equal(on2('bound'), false); assert.equal(ctx.extensionSettings.regex[0].disabled, true);
    // 직접 묶은 프롬프트는 묶음이 우선: bound 를 셀레네에 묶으면 이름 규칙(끔)과 반대로 켜진다
    ctx.extensionSettings.salty.promptBinds = { bound: { keys: ['c:selene.png'], regex: [] } }; invalidateSettings();
    assert.equal(await B.syncPromptBinds(), 1); assert.equal(on2('bound'), true, '묶음이 이긴다'); assert.equal(await B.syncPromptBinds(), 0, '되돌이표 없음');
    ctx.extensionSettings.salty.promptBinds = {}; invalidateSettings();
    // 끄면 아무것도 안 바꾼다
    ctx.extensionSettings.salty.promptLink = { on: false, name: '하루' }; invalidateSettings();
    order2[1].enabled = true; assert.equal(await B.syncPromptBinds(), 0); assert.equal(on2('color_haru'), true, '꺼져 있으면 손대지 않는다'); assert.deepEqual(B.linkRows(), []);
    assert.deepEqual(await B.linkReport('하루'), { prompts: 3, twins: 2, regex: 1, rows: [{ prompts: 3, twins: 2, regex: 1 }] }, '안내는 말을 직접 받아도 된다');
    B.setPromptManager({ activeCharacter: null }); assert.deepEqual(await B.linkReport('하루'), { prompts: 0, twins: 0, regex: 0, rows: [{ prompts: 0, twins: 0, regex: 0 }] });
    B.setPromptManager(pm); ctx.extensionSettings.salty.promptLink = { on: false, name: '' }; ctx.extensionSettings.regex = []; invalidateSettings(); ctx.characterId = 0;
});
await test('6.5.2 설정 정리: promptLink 는 켜짐 불리언 · 6.7.5 줄 { 말 80자 · 카드 } · 예전 이름은 첫 줄로 · 테마 모습 초기화에도 남는다', () => {
    ctx.extensionSettings.salty.promptLink = { on: 'true', name: 7 }; invalidateSettings(); assert.deepEqual(getSettings().promptLink, { on: true, rows: [] });
    ctx.extensionSettings.salty.promptLink = { on: 1, name: ' ' + '가'.repeat(100) + ' ' }; invalidateSettings(); assert.deepEqual(getSettings().promptLink, { on: false, rows: [{ word: '가'.repeat(80), cards: [] }] });
    ctx.extensionSettings.salty.promptLink = 'junk'; invalidateSettings(); assert.deepEqual(getSettings().promptLink, { on: false, rows: [] });
    ctx.extensionSettings.salty.promptLink = { on: true, name: '옛 이름', rows: [{ word: ' Mina ', cards: ['a.png', 'a.png', 7, '', 'b.png'], extra: 1 }, 'junk', null, { cards: 'x' }] }; invalidateSettings();
    assert.deepEqual(getSettings().promptLink, { on: true, rows: [{ word: 'Mina', cards: ['a.png', 'b.png'] }, { word: '', cards: [] }] }, '줄이 있으면 예전 이름은 버리고 · 글자 아닌 카드 · 중복 · 객체 아닌 줄은 뺀다');
    ctx.extensionSettings.salty.promptLink = { on: true, rows: Array.from({ length: 30 }, (_, i) => ({ word: `w${i}`, cards: Array.from({ length: 60 }, (_, j) => `c${j}.png`) })) }; invalidateSettings();
    assert.equal(getSettings().promptLink.rows.length, 20, '20줄까지'); assert.equal(getSettings().promptLink.rows[0].cards.length, 50, '카드는 50장까지');
    ctx.extensionSettings.salty.promptLink = { on: true, name: '하루' }; invalidateSettings(); resetSettings({ look: true });
    assert.deepEqual(getSettings().promptLink, { on: true, rows: [{ word: '하루', cards: [] }] }, '테마 모습 초기화는 연동을 지우지 않는다');
    ctx.extensionSettings.salty.promptLink = { on: false, rows: [] }; invalidateSettings();
});
await test('6.7.5 연동 여러 줄: 줄마다 말 + 카드 여러 장 · 같은 「기본」 짝은 어느 줄에도 안 맞을 때만 · 말은 띄어쓰기 · 대소문자 무시', async () => {
    const extra = [{ avatar: 'mina1.png', name: 'Mina One' }, { avatar: 'mina2.png', name: 'Mina Two' }, { avatar: 'rex.png', name: 'REX' }, { avatar: 'other.png', name: 'Other' }];
    ctx.characters.push(...extra);   // 2 mina1 · 3 mina2 · 4 rex · 5 other
    ctx.groupId = null; ctx.chatId = 'chat-a';
    const names = { base: '🎨 대사 색상 (A · 기본)｜색상 택1', mina: '🎨 대사 색상 (A · Mina)｜색상 택1', rex: '🎨 대사 색상 (A · Re x)｜색상 택1', dc: '| Dialogue Color |', dc_mina: '| Dialogue Color (mina) |', main: '메인', rexa: '| Dialogue Color (Rexa) |' };
    const order3 = Object.keys(names).map(identifier => ({ identifier, enabled: identifier === 'main' || identifier === 'base' || identifier === 'dc' }));
    const pm3 = { activeCharacter: { id: 100001 }, getPromptOrderForCharacter: () => order3, getPromptOrderEntry: (_c, id) => order3.find(e => e.identifier === id) ?? null,
        getPromptById: id => ({ identifier: id, name: names[id] }), saveServiceSettings: async () => {}, render: () => {} };
    B.setPromptManager(pm3);
    const on3 = id => order3.find(e => e.identifier === id).enabled !== false;
    const state = () => Object.fromEntries(['base', 'mina', 'rex', 'dc', 'dc_mina', 'main', 'rexa'].map(id => [id, on3(id)]));
    ctx.extensionSettings.regex = [{ id: 'rx-mina', scriptName: '속마음 색 — Mina (A)', disabled: true }, { id: 'rx-rex', scriptName: '속마음 색 — rex (A · 색 한 번)', disabled: true }, { id: 'rx-show', scriptName: '속마음 표시 (A)', disabled: false }];
    const regex = () => Object.fromEntries(ctx.extensionSettings.regex.map(r => [r.id, !r.disabled]));
    ctx.extensionSettings.salty.promptBinds = {};
    ctx.extensionSettings.salty.promptLink = { on: true, rows: [{ word: 'Mina', cards: ['mina1.png', 'mina2.png'] }, { word: 'Rex', cards: [] }, { word: '', cards: ['other.png'] }, { word: 'Rexa', cards: ['nobody.png'] }] }; invalidateSettings();
    assert.deepEqual(B.linkRows().map(r => r.word), ['Mina', 'Rex', 'Rexa'], '말이 빈 줄은 쓰지 않는다');
    assert.equal(B.linkMatches({ word: 'Mina', cards: ['mina1.png'] }, { ...ctx, characterId: 2 }), true, '고른 카드');
    assert.equal(B.linkMatches({ word: 'Mina One', cards: ['mina2.png'] }, { ...ctx, characterId: 2 }), false, '카드를 고르면 이름이 같아도 고른 카드만');
    assert.equal(B.linkMatches({ word: 'r e x', cards: [] }, { ...ctx, characterId: 4 }), true, '카드를 안 고르면 이름이 같은 카드 (띄어쓰기 · 대소문자 무시)');
    assert.ok(B.linkTwinNames(names.rex, 'Rex').includes('🎨 대사 색상 (a · 기본)|색상 택1'), '띄어 쓴 말도 「기본」 짝을 찾는다');
    const report = await B.linkReport(getSettings().promptLink.rows);
    assert.deepEqual(report.rows, [{ prompts: 2, twins: 2, regex: 1 }, { prompts: 1, twins: 1, regex: 1 }, { prompts: 0, twins: 0, regex: 0 }, { prompts: 1, twins: 1, regex: 0 }], '줄마다: Mina 둘(색 · dc) 짝 둘 · Rex 하나(Rexa 항목은 더 긴 Rexa 줄 것) · 빈 줄 0 · Rexa 하나 짝 하나(dc 를 Mina 와 함께 씀)');
    assert.deepEqual([report.prompts, report.twins, report.regex], [4, 2, 2]);
    ctx.characterId = 2;   // Mina One — 고른 카드
    await B.syncPromptBinds();
    assert.deepEqual(state(), { base: false, mina: true, rex: false, dc: false, dc_mina: true, main: true, rexa: false });
    assert.deepEqual(regex(), { 'rx-mina': true, 'rx-rex': false, 'rx-show': true });
    assert.equal(await B.syncPromptBinds(), 0, '되돌이표 없음');
    ctx.characterId = 4;   // REX — 카드를 안 고른 줄은 이름으로
    await B.syncPromptBinds();
    assert.deepEqual(state(), { base: false, mina: false, rex: true, dc: true, dc_mina: false, main: true, rexa: false }, '「| Dialogue Color |」 짝은 Mina 줄 것이라 Rex 에서는 켜진다');
    assert.deepEqual(regex(), { 'rx-mina': false, 'rx-rex': true, 'rx-show': true });
    ctx.characterId = 5;   // 어느 줄에도 안 맞음
    await B.syncPromptBinds();
    assert.deepEqual(state(), { base: true, mina: false, rex: false, dc: true, dc_mina: false, main: true, rexa: false }, '함께 쓰는 「기본」은 어느 줄에도 안 맞을 때만 켜진다');
    assert.deepEqual(regex(), { 'rx-mina': false, 'rx-rex': false, 'rx-show': true });
    ctx.groupId = 'g1'; ctx.chatId = 'gchat'; ctx.groups[0].members = ['selene.png', 'mina2.png', 'rex.png'];
    await B.syncPromptBinds();
    assert.deepEqual(state(), { base: false, mina: true, rex: true, dc: false, dc_mina: true, main: true, rexa: false }, '그룹: 구성원 중 하나라도 — 두 줄이 다 맞으면 둘 다 켜고 짝은 끈다');
    delete ctx.groups[0].members; ctx.groupId = null; ctx.chatId = 'chat-a';
    // 직접 묶은 프롬프트는 묶음이 우선 (Other 에서 base 를 끄게 묶음)
    ctx.characterId = 5; ctx.extensionSettings.salty.promptBinds = { base: { keys: ['c:rex.png'], regex: [] } }; invalidateSettings();
    await B.syncPromptBinds(); assert.equal(on3('base'), false, '묶음이 이긴다'); assert.equal(await B.syncPromptBinds(), 0);
    ctx.extensionSettings.salty.promptBinds = {}; invalidateSettings();
    // 카드 파일 이름이 바뀌면 줄의 카드도 옮긴다
    assert.equal(B.renameKeys('mina1.png', 'mina9.png'), 1); assert.deepEqual(getSettings().promptLink.rows[0].cards, ['mina9.png', 'mina2.png']);
    B.renameKeys('mina9.png', 'mina1.png');
    B.setPromptManager(pm); ctx.extensionSettings.salty.promptLink = { on: false, rows: [] }; ctx.extensionSettings.regex = []; invalidateSettings();
    ctx.characters.splice(2); ctx.characterId = 0;
});
console.log(`\npromptbind: ${passed} passed, 0 failed`);
