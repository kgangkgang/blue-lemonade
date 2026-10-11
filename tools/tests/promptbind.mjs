// 프롬프트 귀속 (6.0.4, src/promptbind.js) — 가짜 실리태번 문맥 · 가짜 프롬프트 관리자로 묶기 · 맞추기 · 이름 바꾸기 · 설정 정리 검사. 네트워크 · DOM 없음.
//   node tools/tests/promptbind.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const listeners = {};
const ctx = {
    extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() { ctx.saves = (ctx.saves || 0) + 1; },
    characters: [{ avatar: 'nagi.png', name: '나기' }, { avatar: 'seraph.png', name: '세라프' }], groups: [{ id: 'g1', name: '블루 록 모임' }],
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
    assert.deepEqual(B.currentKeys(), ['c:nagi.png', 'c:nagi.png/chat-a']);
    assert.equal(B.isChatKey('c:nagi.png/chat-a'), true); assert.equal(B.isChatKey('c:nagi.png'), false);
    assert.equal(B.bindLabel('c:nagi.png'), '나기'); assert.equal(B.bindLabel('c:nagi.png/chat-a.jsonl'), '나기 · chat-a'); assert.equal(B.bindLabel('g:g1'), '블루 록 모임');
    ctx.groupId = 'g1'; ctx.chatId = 'gchat';
    assert.deepEqual(B.currentKeys(), ['g:g1', 'g:g1/gchat']);
    ctx.groupId = null; ctx.chatId = 'chat-a';
});
await test('묶기 · 풀기 저장 (설정 promptBinds) · 잘못된 열쇠는 거부', () => {
    assert.equal(B.setBind('bluelock_colors', 'c:nagi.png', true), true);
    assert.deepEqual(getSettings().promptBinds, { bluelock_colors: { keys: ['c:nagi.png'], regex: [] } });
    assert.equal(B.setBind('bluelock_colors', 'x:bad', true), false);
    assert.equal(B.setBind('', 'c:nagi.png', true), false);
    B.setBind('bluelock_colors', 'c:nagi.png', false);
    assert.deepEqual(getSettings().promptBinds, {}, '마지막 열쇠를 풀면 묶음이 사라진다');
});
await test('맞추기: 묶인 캐릭터를 열면 켜고 다른 캐릭터로 가면 끈다 · 묶지 않은 항목은 건드리지 않는다', async () => {
    B.setBind('bluelock_colors', 'c:nagi.png', true);
    order[2].enabled = false;
    assert.equal(await B.syncPromptBinds(), 1); assert.equal(on('bluelock_colors'), true); assert.equal(pm.saved, 1); assert.equal(pm.rendered, 1);
    assert.equal(await B.syncPromptBinds(), 0, '이미 맞으면 저장하지 않는다'); assert.equal(pm.saved, 1);
    ctx.characterId = 1;   // 세라프
    assert.equal(await B.syncPromptBinds(), 1); assert.equal(on('bluelock_colors'), false, '나가면 꺼진다');
    assert.equal(on('main'), true, '묶지 않은 항목은 그대로'); assert.equal(on('dialogue_colors'), false);
    ctx.characterId = 0;
    assert.equal(await B.syncPromptBinds(), 1); assert.equal(on('bluelock_colors'), true);
});
await test('채팅 단위 묶기: 그 채팅에서만 켜진다', async () => {
    B.setBind('dialogue_colors', 'c:seraph.png/chat-s', true);
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
    B.setBind('ghost_prompt', 'c:nagi.png', true);
    assert.equal(await B.syncPromptBinds(), 0, '없는 항목은 건너뛰고 나머지는 이미 맞음');
    B.clearBinds('ghost_prompt');
    B.setPromptManager({ activeCharacter: null }); assert.equal(await B.syncPromptBinds(), 0); B.setPromptManager(pm);
});
await test('캐릭터 파일 이름 바꾸기: 캐릭터 열쇠와 그 채팅 열쇠를 옮긴다', () => {
    B.setBind('dialogue_colors', 'c:nagi.png/chat-a', true);
    assert.equal(B.renameKeys('nagi.png', 'nagi2.png'), 2);
    assert.deepEqual(B.keysOf('bluelock_colors').sort(), ['c:nagi2.png', 'g:g1']);
    assert.ok(B.keysOf('dialogue_colors').includes('c:nagi2.png/chat-a'));
    assert.equal(B.renameKeys('nagi2.png', 'nagi.png'), 2);
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
    B.setBind('bluelock_colors', 'c:nagi.png', true);
    assert.equal(await B.syncPromptBinds(), 2, '프롬프트 + 정규식'); assert.equal(on('bluelock_colors'), true); assert.equal(ctx.extensionSettings.regex[0].disabled, false); assert.equal(ctx.extensionSettings.regex[1].disabled, false, '안 붙인 정규식은 그대로');
    ctx.characterId = 1;
    assert.equal(await B.syncPromptBinds(), 2); assert.equal(on('bluelock_colors'), false); assert.equal(ctx.extensionSettings.regex[0].disabled, true, '나가면 정규식도 꺼진다');
    B.setBindRegex('bluelock_colors', 'rx-1', false); assert.deepEqual(B.regexOf('bluelock_colors'), []); assert.deepEqual(B.keysOf('bluelock_colors'), ['c:nagi.png']);
    assert.equal(B.regexName('rx-2'), '다른 것'); assert.equal(B.regexName('nope'), 'nope');
    ctx.characterId = 0; B.clearBinds('bluelock_colors');
});
await test('시작: CHAT_CHANGED · 프리셋 바꿈 · 이름 바꿈을 듣고 바로 한 번 맞춘다', async () => {
    ctx.extensionSettings.salty.promptBinds = { bluelock_colors: { keys: ['c:nagi.png'] } }; invalidateSettings();
    order[2].enabled = false;
    B.startPromptBinds();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(on('bluelock_colors'), true, '시작할 때 지금 채팅에 맞춘다');
    assert.ok(listeners['chat_id_changed']?.length && listeners['oai_preset_changed_after']?.length && listeners['character_renamed']?.length);
    ctx.characterId = 1; for (const fn of listeners['chat_id_changed']) fn(); await new Promise(r => setTimeout(r, 10));
    assert.equal(on('bluelock_colors'), false);
    for (const fn of listeners['character_renamed']) fn('nagi.png', 'nagi3.png');
    assert.deepEqual(B.keysOf('bluelock_colors'), ['c:nagi3.png']);
});
console.log(`\npromptbind: ${passed} passed, 0 failed`);
