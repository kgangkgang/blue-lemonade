// 캐릭터 로어북 연결 점검 (src/wi-link.js) — 연결이 빠진 경우만 책 아이콘에 빨간 점, 고치면 사라짐, 로어북 없는 캐릭터 · 설정 읽기 전엔 점 없음
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const { loreLinkProblem: problem, chatCharacters, loreLinkBroken, startWorldInfoLinkMark } = await import(new URL('src/wi-link.js', root));

const card = (name, { world = '', book = null, shallow = false } = {}) => ({ name, avatar: `${name}.png`, ...(shallow ? { shallow: true } : {}), data: { name, extensions: { world }, ...(book ? { character_book: book } : {}) } });
const book = (n, name = 'Bundled Book') => ({ name, entries: Array.from({ length: n }, (_, i) => ({ id: i, keys: ['k'], content: 'c' })) });
const names = ['Shared Lore', 'Library'];

// 정상
assert.equal(problem(card('Plain'), names), '', 'no lorebook at all is normal');
assert.equal(problem(card('Linked', { world: 'Library' }), names), '', 'linked book that exists');
assert.equal(problem(card('Both', { world: 'Library', book: book(3) }), names), '', 'embedded book with a working link (imported under another name)');
assert.equal(problem(card('Empty', { book: book(0) }), names), '', 'an empty embedded book is ignored');
assert.equal(problem(card('Lazy', { book: book(3), shallow: true }), names), '', 'shallow list cards carry no embedded book: unknown, no dot');
assert.equal(problem(card('Gone', { world: 'Old Name' }), undefined), '', 'before the world list loads nothing is judged');
assert.equal(problem(null, names), '');
// 빠짐
assert.equal(problem(card('Gone', { world: 'Old Name' }), names), 'missing', 'renamed or deleted book');
assert.equal(problem(card('Gone', { world: 'Old Name' }), []), 'missing', 'an empty world list is a loaded list');
assert.equal(problem(card('Case', { world: 'library' }), names), 'missing', 'names match exactly, as SillyTavern does');
assert.equal(problem(card('Bundle', { book: book(2) }), names), 'embedded', 'embedded book never imported');
assert.equal(problem(card('Bundle', { book: { name: 'x', entries: { 0: { content: 'c' } } } }), names), 'embedded', 'object-shaped entries count too');
assert.equal(problem(card('Broken', { world: 'Old Name', book: book(2) }), names), 'missing', 'a dead link wins over the embedded check');
// 추가 로어북 (charLore: 아바타 파일 이름 기준)
const lore = [{ name: 'Extra', extraBooks: ['Library', 'Lost Book'] }, { name: 'Fine', extraBooks: ['Shared Lore'] }];
assert.equal(problem(card('Extra'), names, lore), 'extra', 'additional book that no longer exists');
assert.equal(problem(card('Fine'), names, lore), '', 'additional books all present');
assert.equal(problem({ ...card('Extra'), avatar: 'Extra.webp' }, names, lore), 'extra', 'file name drops any extension');
assert.equal(problem(card('Other'), names, lore), '', 'other characters are not affected');
assert.equal(problem(card('Extra'), names, 'bad'), '', 'malformed charLore is ignored');

// 어떤 캐릭터를 보나
const chars = [card('Plain'), card('Gone', { world: 'Old Name' }), card('Linked', { world: 'Library' }), card('Bundle', { book: book(2) })];
assert.deepEqual(chatCharacters({ characters: chars, characterId: '2' }).map(c => c.name), ['Linked'], 'solo chat by string id');
assert.deepEqual(chatCharacters({ characters: chars, characterId: 0 }).map(c => c.name), ['Plain']);
for (const id of [undefined, null, '', 99]) assert.deepEqual(chatCharacters({ characters: chars, characterId: id }), [], `no character for ${String(id)}`);
{
    const embedded = card('Attached', { book: { entries: [{ keys: ['x'], content: 'y' }] } });
    assert.equal(problem(embedded, ['Attached Lore']), 'embedded', 'embedded book, nothing attached');
    assert.equal(problem(embedded, ['Attached Lore'], [{ name: 'Attached', extraBooks: ['Attached Lore'] }]), '', 'imported as an additional book = connected');
    assert.equal(problem(embedded, ['Other'], [{ name: 'Attached', extraBooks: ['Attached Lore'] }]), 'extra', 'additional book missing from the list');
    assert.equal(problem(embedded, ['Attached Lore'], [{ name: 'Attached', extraBooks: [''] }]), 'embedded', 'an empty name is not a link');
}
const groups = [{ id: 'g1', members: ['Plain.png', 'Gone.png', 'Missing.png', 'Linked.png'], disabled_members: ['Gone.png'] }];
assert.deepEqual(chatCharacters({ characters: chars, characterId: 1, groupId: 'g1', groups }).map(c => c.name), ['Plain', 'Linked'], 'group: enabled members only, unknown avatars skipped');
assert.deepEqual(chatCharacters({ characters: chars, groupId: 'nope', groups }), [], 'unknown group');
assert.equal(loreLinkBroken({ characters: chars, characterId: 1 }, names), true);
assert.equal(loreLinkBroken({ characters: chars, characterId: 2 }, names), false);
assert.equal(loreLinkBroken({ characters: chars, groupId: 'g1', groups }, names), false, 'the broken member is disabled');
groups[0].disabled_members = [];
assert.equal(loreLinkBroken({ characters: chars, groupId: 'g1', groups }, names), true, 'one broken member is enough');

// 실제 흐름: 이벤트가 오면 점을 붙이고, 고치면 뗀다 (시간은 기다리지 않고 상태를 확인)
const handlers = new Map();
const eventSource = { on(name, fn) { handlers.set(name, [...(handlers.get(name) || []), fn]); } };
const event_types = { CHAT_CHANGED: 'chat_id_changed', WORLDINFO_SETTINGS_UPDATED: 'worldinfo_settings_updated', CHARACTER_EDITED: 'character_edited', APP_READY: 'app_ready', CHARACTER_EDITOR_OPENED: 'character_editor_opened', GENERATION_STARTED: 'generation_started' };
const classes = new Set();
const clicks = [];
const icon = { classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } }, addEventListener(type, fn) { clicks.push([type, fn]); } };
const doc = { getElementById: id => (id === 'WIDrawerIcon' ? icon : null) };
const worldInfo = { world_names: undefined, world_info: { charLore: [] } };
const ctx = { eventSource, event_types, characters: [card('Gone', { world: 'Old Name' }), card('Plain')], characterId: undefined, groupId: null, groups: [], getWorldInfoNames: () => [] };
const emit = name => (handlers.get(name) || []).forEach(fn => fn());
const settle = async (want, label) => {
    for (let i = 0; i < 200 && classes.has('bl-wi-unlinked') !== want; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(classes.has('bl-wi-unlinked'), want, label);
};
await startWorldInfoLinkMark({ getContext: () => ctx, loadWorldInfo: async () => worldInfo, doc, delay: 5 });
assert.ok(handlers.has('chat_id_changed') && handlers.has('worldinfo_settings_updated') && handlers.has('character_edited'), 'listens to chat, character and lorebook changes');
assert.ok(handlers.has('character_editor_opened') && handlers.has('generation_started'), 'rename-popup relink fires no event: editor open and generation start re-check');
assert.deepEqual(clicks.map(([type]) => type), ['click'], 'the book icon click re-checks too');
await settle(false, 'no chat open: no dot');
ctx.characterId = 0; emit('chat_id_changed');
await new Promise(resolve => setTimeout(resolve, 30));
assert.equal(classes.has('bl-wi-unlinked'), false, 'world list not loaded yet: no dot (getWorldInfoNames would say [] then)');
worldInfo.world_names = ['Library']; emit('app_ready');
await settle(true, 'dead link shows the dot');
worldInfo.world_names = ['Library', 'Old Name']; emit('worldinfo_settings_updated');
await settle(false, 'restoring the book clears the dot');
ctx.characters[0].data.extensions.world = 'Renamed'; emit('character_edited');
await settle(true, 'card pointed at a missing name again');
ctx.characters[0].data.extensions.world = 'Library'; emit('character_edited');
await settle(false, 'relinking clears it');
ctx.characters[0].data.extensions.world = 'Renamed'; emit('chat_id_changed');
await settle(true, 'dead link again');
ctx.characters[0].data.extensions.world = 'Library'; clicks[0][1]();
await settle(false, 'a relink without any event (group rename popup) clears when the icon is clicked');
ctx.characters[0].data.extensions.world = 'Renamed'; emit('generation_started');
await settle(true, 'generation start re-checks');
ctx.characters[0].data.extensions.world = 'Library'; emit('character_editor_opened');
await settle(false, 'editor open re-checks');
ctx.characterId = 1; worldInfo.world_info.charLore = [{ name: 'Plain', extraBooks: ['Lost Book'] }]; emit('chat_id_changed');
await settle(true, 'additional book of another character');
emit('chat_id_changed'); emit('chat_id_changed');
worldInfo.world_info.charLore = []; emit('worldinfo_settings_updated');
await settle(false, 'removing the dead additional book clears it');
await startWorldInfoLinkMark({ getContext: () => ctx, loadWorldInfo: async () => worldInfo, doc, delay: 5 });
assert.equal(handlers.get('chat_id_changed').length, 1, 'starts once');
console.log('PASS lorebook link dot: missing / additional / embedded books, normal cards untouched, group members, clears when fixed');
