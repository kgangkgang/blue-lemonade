// 캐릭터 에셋 1.6.9 그룹 채팅 — 멤버 둘(각자 폴더) · 메시지마다 주인 폴더로 그리기 · 차례마다 그 멤버 목록 · 「다른 모델이 고르기」도 그 답 주인 목록 · 1:1 그대로
// 실리태번 없이: 모듈의 import 줄을 떼고 대역을 넣는다 (character-assets-prompt.mjs 와 같은 방식, import 뒤 주석이 있어도 떼게 줄 통째로)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const folder = path.join(root, 'src/addons/assets');
let moduleId = 0;
const bindings = globalThis.__assetGroupTest = {};
async function load(name, imports = {}, tail = '') {
    const id = ++moduleId;
    bindings[id] = imports;
    const source = (await fs.readFile(path.join(folder, name), 'utf8')).replace(/^import [^\n]*\n/gm, '');
    const prelude = `const {${Object.keys(imports).join(',')}} = globalThis.__assetGroupTest[${id}];\n`;
    return import('data:text/javascript;base64,' + Buffer.from(prelude + source + '\n' + tail).toString('base64'));
}
const presets = await import(pathToFileURL(path.join(folder, 'presets.js')));
const names = await import(pathToFileURL(path.join(folder, 'names.js')));
const slots = await import(pathToFileURL(path.join(folder, 'slots.js')));
let passed = 0;
const test = async (label, fn) => { await fn(); passed++; console.log(`PASS ${label}`); };
const tick = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

// 멤버 둘: Ann(A.png → 폴더 A) · Bo(B.png → 폴더 B), 그리고 그룹 밖 캐릭터 Cy(C.png)
const characters = [{ avatar: 'A.png', name: 'Ann' }, { avatar: 'B.png', name: 'Bo' }, { avatar: 'C.png', name: 'Cy' }];
const context = { characters, groups: [{ id: 'g1', members: ['A.png', 'B.png'] }], groupId: 'g1', characterId: undefined, chat: [], chatId: 'g-chat', name1: 'Me', extensionSettings: {} };
const ext = {};
const state = await load('state.js', { extension_settings: ext, getContext: () => context, saveSettingsDebounced: () => {} });
state.initSettings();

await test('messageOwner: original_avatar → that member · no avatar → same-name member · user/system → none · 1:1 → current character', () => {
    assert.equal(state.messageOwner({ name: 'Ann', original_avatar: 'A.png', mes: 'x' }).avatar, 'A.png');
    assert.equal(state.messageFolder({ name: 'Bo', original_avatar: 'B.png' }), 'B');
    assert.equal(state.messageFolder({ name: 'Bo' }), 'B', 'old message without original_avatar: same-name member');
    assert.equal(state.messageFolder({ name: 'Cy' }), '', 'a non-member name is not guessed');
    assert.equal(state.messageFolder({ name: 'Me', is_user: true }), '');
    assert.equal(state.messageFolder({ name: 'System', is_system: true }), '');
    assert.equal(state.messageFolder({ name: 'Ann', is_system: true, original_avatar: 'A.png' }), 'A', 'a hidden member message keeps its owner');
    assert.equal(state.messageFolder({ name: 'Gone', original_avatar: 'Gone.png' }), 'Gone', 'a deleted card still names its folder');
    context.groupId = null; context.characterId = 2;
    assert.equal(state.messageFolder({ name: 'Cy' }), 'C', '1:1: the current character');
    context.groupId = 'g1'; context.characterId = undefined;
});
await test('speakerCharacter: group only during a turn (this_chid set to a member) · non-member this_chid ignored · 1:1 = current', () => {
    assert.equal(state.speakerFolder(), '', 'outside a turn there is no speaker');
    context.characterId = 1; assert.equal(state.speakerFolder(), 'B');
    context.characterId = 2; assert.equal(state.speakerFolder(), '', 'Cy is not in this group');
    context.groupId = null; assert.equal(state.speakerFolder(), 'C', '1:1');
    context.groupId = 'g1'; context.characterId = undefined;
    assert.equal(state.currentFolder(), '', 'the panel still has no current character in a group');
});

// ---- store.js: 멤버 목록
const requests = [];
const files = new Map([['A', ['smile.png', 'cry.png']], ['B', ['moon.png', 'moon-2.png']], ['C', ['sun.png']]]);
const fetch = async url => {
    const key = new URL(url, 'https://fixture.invalid').searchParams.get('name');
    requests.push(key);
    return { ok: true, json: async () => (files.get(key) ?? []).map(file => ({ path: `/characters/${key}/${file}` })) };
};
const assets = await load('assets.js', { fetch, getRequestHeaders: () => ({}), formatKeywordList: names.formatKeywordList });
const memberCalls = [];
let cleared = 0;
const store = await load('store.js', { ...state, ...assets, ...presets, setIndex: () => {}, clearIndex: () => {}, setMemberIndex: (f, index) => memberCalls.push([f, index]), clearMemberIndexes: () => { cleared++; } });

await test('loadMember reads each member folder once, hands render.js its own index, activeEntry follows the speaker', async () => {
    const [a, again] = await Promise.all([store.loadMember('A'), store.loadMember('A')]);
    assert.equal(a, again); assert.deepEqual(requests, ['A'], 'one request for two callers');
    assert.match(a.keywords, /smile\.png/); assert.doesNotMatch(a.keywords, /moon/);
    const b = await store.loadMember('B');
    assert.match(b.keywords, /moon/); assert.doesNotMatch(b.keywords, /smile/);
    assert.deepEqual(memberCalls.map(([f, index]) => [f, index.folder]), [['A', 'A'], ['B', 'B']]);
    assert.ok(memberCalls[0][1].byName.has('smile.png') && !memberCalls[0][1].byName.has('moon.png'));
    assert.equal(store.memberEntry('A'), a); assert.equal(store.memberEntry('C'), null, 'not read yet');
    context.characterId = 0; assert.equal(store.activeEntry(context), a);
    context.characterId = 1; assert.equal(store.activeEntry(context), b);
    context.characterId = undefined; assert.equal(store.activeEntry(context), null, 'outside a turn nothing');
    context.groupId = null; assert.equal(store.activeEntry(context), store.runtime, '1:1 keeps runtime'); context.groupId = 'g1';
    assert.match(store.expandedPrompt(b), /moon/); assert.equal(store.expandedPrompt(null), '');
    assert.equal(store.runtime.folder, '', 'the 1:1 list stays empty in a group');
});
await test('switching a picture off rebuilds the loaded member lists · chat change forgets them', async () => {
    memberCalls.length = 0;
    state.setDisabled('A', 'cry.png', true);
    store.recompute();
    assert.doesNotMatch(store.memberEntry('A').keywords, /cry\.png/);
    assert.deepEqual(memberCalls.map(([f]) => f).sort(), ['A', 'B'], 'render gets fresh indexes');
    state.setDisabled('A', 'cry.png', false); store.recompute();
    store.clearMembers();
    assert.equal(cleared, 1); assert.equal(store.memberEntry('A'), null);
    await store.loadMember('A');
    assert.deepEqual(requests, ['A', 'B', 'A'], 'read again after the chat changed');
});

// ---- render.js: 메시지마다 주인 폴더의 찾아보기표
const documentStub = { dispatchEvent() {}, getElementById: () => null, addEventListener() {}, querySelector: () => null };
globalThis.document = documentStub;
const stScript = { this_chid: undefined, characters, chat: [] };
const stGroups = { selected_group: 'g1', groups: context.groups };
const render = await load('render.js', {
    getContext: () => context, stScript, stGroups, ...state, groupKeyOf: assets.groupKeyOf, baseOf: assets.baseOf,
    findSimilar: names.findSimilar, findSimilarList: names.findSimilarList, slotView: slots.slotView, isManual: slots.isManual,
}, 'export const __t = { memberFor, forMessage, current: () => index?.folder ?? null, members };');
const asked = [];
render.setMemberLoader(f => asked.push(f));
const mesOf = id => ({ getAttribute: key => (key === 'mesid' ? String(id) : null) });
stScript.chat = [
    { name: 'Me', is_user: true, mes: 'hi' },
    { name: 'Ann', original_avatar: 'A.png', mes: '{{img::smile.png}}' },
    { name: 'Bo', original_avatar: 'B.png', mes: '{{img::moon.png}}' },
    { name: 'Ann', original_avatar: 'A.png', mes: 'again' },
];
const indexA = assets.buildIndex('A', store.memberEntry('A').assets, new Set(), ['A']);
const indexB = assets.buildIndex('B', (await store.loadMember('B')).assets, new Set(), ['B']);

await test('render: a member message asks for its folder once, waits, then draws with that member index only', () => {
    assert.equal(render.__t.memberFor(mesOf(1)), null, 'not loaded yet');
    assert.equal(render.__t.memberFor(mesOf(3)), null);
    assert.deepEqual(asked, ['A'], 'one request per folder, on first sight');
    assert.equal(render.__t.memberFor(mesOf(0)), null); assert.deepEqual(asked, ['A'], 'user message has no folder');
    render.setMemberIndex('A', indexA);
    render.setMemberIndex('B', indexB);
    const seen = [];
    for (const id of [1, 2, 3]) render.__t.forMessage(mesOf(id), true, () => seen.push(render.__t.current()));
    assert.deepEqual(seen, ['A', 'B', 'A'], 'each message uses its owner list');
    assert.equal(render.__t.current(), null, 'swapped back after each message');
    assert.equal(render.__t.forMessage(mesOf(0), true, () => 'ran'), undefined, 'user message skipped');
});
await test('render: assetInfoFor resolves a name in that member folder only · an empty member folder draws nothing (as before)', () => {
    assert.equal(render.assetInfoFor('A', 'smile.png')?.file, 'smile.png');
    assert.equal(render.assetInfoFor('B', 'smile.png'), null, 'Bo has no smile');
    assert.equal(render.assetInfoFor('B', 'moon')?.group, 'moon', 'numbered group name resolves in B');
    render.setMemberIndex('E', assets.buildIndex('E', [], new Set(), ['E']));
    stScript.chat.push({ name: 'Ann', original_avatar: 'E.png', mes: '{{img::smile.png}}' });
    assert.equal(render.__t.forMessage(mesOf(4), true, () => 'ran'), undefined, 'an empty folder leaves the message untouched');
    render.clearMemberIndexes();
    assert.equal(render.__t.members.size, 0);
    render.__t.memberFor(mesOf(1)); assert.deepEqual(asked, ['A', 'A'], 'asks again after the chat changed');
});
await test('render 1:1 path is unchanged: no member lookup, fn runs with the solo index', () => {
    stGroups.selected_group = null;
    asked.length = 0;
    let ran = 0;
    render.setIndex(assets.buildIndex('C', [], new Set(), ['C']));
    render.__t.forMessage(mesOf(1), false, () => { ran++; });
    assert.equal(ran, 1); assert.deepEqual(asked, []);
    assert.equal(render.assetInfoFor('', 'x'), render.assetInfo('x'));
    stGroups.selected_group = 'g1';
});

// ---- after-reply.js: 그룹에서 답 주인의 목록으로 고르기
const picked = [];
let pickCalls = 0;
const afterReply = await load('after-reply.js', {
    eventSource: { on() {} }, event_types: {}, saveChatConditional: async () => {}, updateMessageBlock: () => {},
    getContext: () => context, notifyRerender: async () => {}, ...state, ...slots,
    runtime: store.runtime, ensureLoaded: async () => false, loadMember: store.loadMember, memberEntry: store.memberEntry,
    pickActive: () => true, pickSettings: () => ({ count: 1, timeoutSec: 30 }),
    generatePick: async messages => { pickCalls++; picked.push(messages); return '[ASSET 1]: moon.png'; },
    assetInfoFor: (f, name) => render.assetInfoFor(f, name), refreshSlots: () => false, slotRunning: new Set(), slotHooks: {}, shownSlotFiles: () => ({}),
    messageWork: () => ({ noteWrite() {} }), ownerSpellings: () => '',
});
render.setMemberIndex('A', indexA); render.setMemberIndex('B', indexB);

await test('pick after reply in a group: the reply owner list (Bo → moon), not the other member', async () => {
    context.chat = [{ name: 'Me', is_user: true, mes: 'hi' }, { name: 'Bo', original_avatar: 'B.png', mes: 'He nodded.\n\n"Look at the moon."\n\nThey walked on.', extra: {}, swipes: null }];
    afterReply.onMessageReceived(1, 'normal');
    await tick(); await new Promise(resolve => setTimeout(resolve, 20)); await tick();
    assert.equal(pickCalls, 1);
    const sent = JSON.stringify(picked[0]);
    assert.match(sent, /moon/); assert.doesNotMatch(sent, /smile\.png/, 'Ann list is not sent');
    assert.ok(JSON.stringify(context.chat[1].extra).includes('moon'), 'the pick is recorded against B');
});
await test('pick after reply: a member without pictures gets no slots · user messages untouched', async () => {
    const before = pickCalls;
    files.set('D', []); characters.push({ avatar: 'D.png', name: 'Dee' }); context.groups[0].members.push('D.png');
    await store.loadMember('D');
    context.chat.push({ name: 'Dee', original_avatar: 'D.png', mes: 'Hm.\n\n"Hello."', extra: {} });
    afterReply.onMessageReceived(2, 'normal');
    await tick();
    assert.equal(context.chat[2].mes, 'Hm.\n\n"Hello."', 'no slot inserted for an empty member');
    context.chat.push({ name: 'Me', is_user: true, mes: 'ok', extra: {} });
    afterReply.onMessageReceived(3, 'normal');
    assert.equal(pickCalls, before);
});

delete globalThis.__assetGroupTest;
console.log(`PASS assets group chat: ${passed} checks (owner · speaker · member lists · per-message index · 1:1 unchanged · pick by owner)`);
