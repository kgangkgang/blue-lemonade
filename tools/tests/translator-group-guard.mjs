// 2.6.1 그룹 채팅: 실리태번이 답을 만드는 동안 characterId · name2 를 말하는 캐릭터로 두었다 비워도 번역이 멈추지 않는다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const { createGuards } = await import(new URL('src/addons/translator/translation-guard.js', root));
const { autoContextFingerprint } = await import(new URL('src/addons/translator/context-auto.js', root));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const reasonOf = guard => { try { guard.assert(); return 'valid'; } catch (error) { return error.reason; } };
check('group chat: speaker id set during generation then cleared — still the same chat', () => {
    const ctx = { chat: [], groupId: 'g1', characterId: 3, name2: 'Mina', chatId: 'group chat 1', getCurrentChatId() { return this.chatId; } };
    const guards = createGuards(() => ctx);
    const m = { mes: '안녕', swipe_id: 0, extra: {} }; ctx.chat.push(m);
    const chatGuard = guards.capture(), guard = guards.capture(m);
    ctx.characterId = undefined; ctx.name2 = '';          // GROUP_WRAPPER finally: setCharacterId(undefined)
    assert.equal(reasonOf(chatGuard), 'valid'); assert.equal(reasonOf(guard), 'valid');
    ctx.characterId = 5;                                  // next member drafted
    assert.equal(reasonOf(guard), 'valid');
    ctx.chatId = 'group chat 2';                          // a real chat change still stops
    assert.equal(reasonOf(chatGuard).what, 'chat');
});
check('solo chat: switching character still counts as a chat change', () => {
    const ctx = { chat: [], groupId: null, characterId: 1, chatId: 'c1', getCurrentChatId() { return this.chatId; } };
    const guards = createGuards(() => ctx);
    const g = guards.capture();
    ctx.characterId = 2;
    assert.equal(reasonOf(g).what, 'chat');
});
check('auto context fingerprint ignores the group speaker', () => {
    const base = { chat: [{ name: 'Mina', mes: 'a' }], groupId: 'g1', chatId: 'gc', mainApi: 'openai', name1: 'You' };
    const settings = {};
    assert.equal(autoContextFingerprint({ ...base, characterId: 3, name2: 'Mina' }, settings), autoContextFingerprint({ ...base, characterId: undefined, name2: '' }, settings));
    const solo = { ...base, groupId: null };
    assert.notEqual(autoContextFingerprint({ ...solo, characterId: 1, name2: 'A' }, settings), autoContextFingerprint({ ...solo, characterId: 2, name2: 'B' }, settings));
});
console.log(`translator-group-guard: ${passed} passed, 0 failed`);
