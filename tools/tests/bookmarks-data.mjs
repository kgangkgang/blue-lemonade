// 북마크 애드온 — 데이터를 바꾸는 길 (src/addons/bookmarks/data.js · state.js)
//   node tools/tests/bookmarks-data.mjs <테마 루트>   (공개 저장소는 '.')
// 진짜 data.js · state.js · anchors.js · excerpts.js · images.js · render.js 를 불러온다. 실리태번 모듈(extensions.js · script.js · personas.js · utils.js)과
// 테마 모듈(dem-expressive · settings · apply · palettes)은 data: 스텁, 서버(/api/chats/get · save)는 메모리 속 가짜. 지어낸 채팅만 쓴다 (사용자 자료 없음).
// 확인하는 것:
//   1) 현재 채팅: 북마크 더하기(같은 메시지는 하나) · 지우기 · 메모 — chat_metadata.favorites 를 고치고 실리태번 debounce 저장 + bookmarksChanged 를 부른다
//   2) favorites 의 빈 칸(null 등)은 읽을 때 그 자리에서 뺀다 (같은 배열 그대로)
//   3) 다른 채팅: 파일의 최신본을 다시 읽어 고치고 통째로 저장(force false) · 그사이 메시지가 바뀌었으면 저장하지 않고 최신본만 받는다 · 무결성 오류면 다시 불러오게 한다
//   4) 메시지 원문 고치기(현재 채팅): 실리태번 순서(MESSAGE_EDITED → 그리기 → MESSAGE_UPDATED → 저장) · 번역기가 손대지 않은 번역문은 지움 · 실패하면 되돌림 · 편집 창이 열려 있으면 안 함
//   5) 메시지 원문 고치기(다른 채팅): 번역문 · 공유 기록을 지우고 그 메시지 북마크의 지문을 새로 쓴다
//   6) 설정(state.js initSettings): 처음 설치는 이전 확장(star) 설정을 옮기고, 범위 밖 숫자는 자른다, 옛 설정은 아이콘을 한 번만 별로
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = pathToFileURL(path.join(root, 'src/addons/bookmarks')).href + '/';
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__bookmarksDataTest = { ext: {}, ctx: null, meta: 0, chatSaves: 0, settingsSaves: 0, events: [], blocks: [], server: new Map(), posts: [], saveStatus: 200, savePayload: null };
const G = 'const T = globalThis.__bookmarksDataTest;\n';
const STUBS = {
    'extensions.js': js(G + 'export const extension_settings = T.ext; export function getContext() { return T.ctx; } export function saveMetadataDebounced() { T.meta++; }'),
    'script.js': js(G + `export function getRequestHeaders() { return {}; } export function getThumbnailUrl(type, file) { return '/thumbnail?type=' + type + '&file=' + file; } export function saveSettingsDebounced() { T.settingsSaves++; }
export async function saveChatConditional() { T.chatSaves++; } export function updateMessageBlock(id, message) { T.blocks.push([id, message.mes]); }
export const event_types = { MESSAGE_EDITED: 'message_edited', MESSAGE_UPDATED: 'message_updated' };
export const eventSource = { async emit(name, id) { T.events.push([name, id]); if (T.failOn === name) throw new Error('listener failed'); }, on() {}, removeListener() {} };
export function messageFormatting(text) { return String(text); }`),
    'personas.js': js('export const user_avatar = "persona.png";'),
    'utils.js': js('let n = 0; export function uuidv4() { return "id-" + (++n); } export function getStringHash(s) { let h = 0; for (const c of String(s ?? "")) h = (h * 31 + c.charCodeAt(0)) | 0; return h; } export function timestampToMoment() { return { isValid: () => false }; }'),
    'dem-expressive.js': js('export function dressBody() {}'),
    'settings.js': js('export function getSettings() { return { addons: {} }; }'),
    'apply.js': js('export function applyAll() {}'),
    'palettes.js': js('export const PALETTES = {}; export function paletteFamily() { return ""; } export function paletteVariant() { return ""; }'),
};
register(js(`let S = {}, DIR = '';
export async function initialize(d) { S = d.stubs; DIR = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(DIR)) {
        const ups = (spec.match(/\\.\\.\\//g) || []).length, base = spec.split('/').pop();
        if (ups >= 2 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { stubs: STUBS, dir } });

// 가짜 서버: 채팅 파일 = [머리글, ...메시지]
globalThis.fetch = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    T.posts.push([url, body]);
    const json = (status, data) => ({ ok: status < 400, status, json: async () => data });
    if (url === '/api/chats/get') return json(200, structuredClone(T.server.get(body.file_name) ?? []));
    if (url === '/api/chats/save') {
        if (T.saveStatus !== 200) return json(T.saveStatus, T.savePayload);
        T.server.set(body.file_name, structuredClone(body.chat));
        return json(200, { ok: true });
    }
    throw new Error('unexpected ' + url);
};
globalThis.document = { body: { classList: { contains: () => false } }, querySelector: sel => (sel.includes('.edit_textarea') ? T.editing ?? null : (T.rendered ? {} : null)) };

const S = await import(dir + 'state.js');
const D = await import(dir + 'data.js');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
const msg = (name, mes, is_user = false, extra = {}) => ({ name, mes, is_user, send_date: '2026-10-17 10:00', swipe_id: 0, swipes: [mes], extra: { ...extra } });
function openChat(messages, favorites = []) {
    T.ctx = { chatId: 'chat-now', chat: messages, chatMetadata: { favorites }, characters: [{ name: '미나', avatar: 'mina.png' }], characterId: 0, groupId: null, groups: [] };
    T.meta = 0; T.chatSaves = 0; T.events.length = 0; T.blocks.length = 0; T.posts.length = 0; T.rendered = true; T.editing = null; T.failOn = null; T.saveStatus = 200;
    return T.ctx;
}
let changed = 0;
S.hooks.bookmarksChanged = () => { changed++; };

await test('현재 채팅: 북마크 더하기 → favorites 에 한 줄(메시지 번호 · 보낸 이 · 역할 · 지문) · debounce 저장 · 같은 메시지는 하나', async () => {
    const ctx = openChat([msg('하람', '안녕', true), msg('미나', '「어서 와」')]);
    const record = D.currentRecord();
    changed = 0;
    const fav = await D.addBookmark(record, 1);
    assert.equal(ctx.chatMetadata.favorites.length, 1);
    assert.deepEqual({ messageId: fav.messageId, sender: fav.sender, role: fav.role, note: fav.note }, { messageId: '1', sender: '미나', role: 'character', note: '' });
    assert.ok(fav.anchor, '지문이 있다');
    assert.equal(T.meta, 1); assert.equal(T.chatSaves, 0); assert.equal(changed, 1);
    assert.equal(await D.addBookmark(record, 1), fav, '다시 더하면 있는 것');
    assert.equal(ctx.chatMetadata.favorites.length, 1);
    assert.equal(D.bookmarkAt(record, 1), fav);
    const user = await D.addBookmark(record, 0);
    assert.equal(user.role, 'user');
    await assert.rejects(D.addBookmark(record, 9), /찾을 수 없습니다/);
});

await test('현재 채팅: 메모 · 지우기 (모르는 id 는 거짓 · 저장 없음) · 지우면 맡긴 저장을 flushBookmarkSave 가 바로 쓴다', async () => {
    const ctx = openChat([msg('미나', '「어서 와」')]);
    const record = D.currentRecord();
    const fav = await D.addBookmark(record, 0);
    await D.setNote(record, fav.id, '여기부터');
    assert.equal(ctx.chatMetadata.favorites[0].note, '여기부터');
    await assert.rejects(D.setNote(record, 'nope', 'x'), /찾을 수 없습니다/);
    const before = T.meta;
    assert.equal(await D.removeBookmark(record, 'nope'), false);
    assert.equal(T.meta, before, '없는 북마크는 저장하지 않는다');
    assert.equal(await D.removeBookmark(record, fav.id), true);
    assert.deepEqual(ctx.chatMetadata.favorites, []);
    await D.flushBookmarkSave();
    assert.equal(T.chatSaves, 1, '맡긴 저장을 지금 쓴다');
    await D.flushBookmarkSave();
    assert.equal(T.chatSaves, 1, '두 번은 아니다');
});

await test('favorites 의 빈 칸(null · 글자)은 읽을 때 그 자리에서 빼고 같은 배열을 쓴다', () => {
    const favorites = [null, { id: 'a', messageId: '0', note: '' }, 'junk', { id: 'b', messageId: '1', note: '' }];
    openChat([msg('미나', 'x'), msg('미나', 'y')], favorites);
    const record = D.currentRecord();
    assert.equal(record.favorites, favorites, '새 배열로 바꾸지 않는다');
    assert.deepEqual(favorites.map(f => f.id), ['a', 'b']);
});

await test('다른 채팅: 북마크 더하기는 파일 최신본을 다시 읽어 고치고 통째로 저장(force false) · 패널의 복사본도 최신본으로', async () => {
    openChat([msg('미나', '현재')]);
    const owner = D.getOwner();
    const header = { user_name: '하람', character_name: '미나', chat_metadata: { favorites: [] } };
    T.server.set('old-chat', [header, msg('하람', '옛 안녕', true), msg('미나', '「옛 어서 와」')]);
    const record = { key: 'old-chat', label: 'old', isCurrent: false, owner, favorites: [], messages: null, header: null, loaded: false, messageCount: 0, lastMes: '' };
    await D.loadRecord(record);
    assert.equal(record.loaded, true); assert.equal(record.messages.length, 2);
    // 그사이 다른 기기가 메시지를 하나 더 붙였다 — 저장은 그 최신본 위에
    T.server.get('old-chat').push(msg('하람', '그사이 보낸 것', true));
    changed = 0;
    const fav = await D.addBookmark(record, 1);
    const saved = T.posts.filter(([url]) => url === '/api/chats/save');
    assert.equal(saved.length, 1);
    assert.equal(saved[0][1].force, false); assert.equal(saved[0][1].file_name, 'old-chat'); assert.equal(saved[0][1].avatar_url, 'mina.png');
    assert.equal(saved[0][1].chat.length, 4, '머리글 + 최신 메시지 3');
    assert.deepEqual(saved[0][1].chat[0].chat_metadata.favorites.map(f => f.messageId), ['1']);
    assert.equal(record.messages.length, 3, '패널 복사본이 최신본');
    assert.equal(record.favorites[0].id, fav.id);
    assert.equal(T.meta, 0, '다른 채팅은 실리태번 저장 길을 쓰지 않는다'); assert.equal(changed, 1);
    assert.equal(await D.removeBookmark(record, fav.id), true);
    assert.deepEqual(T.server.get('old-chat')[0].chat_metadata.favorites, []);
});

await test('다른 채팅: 그사이 그 메시지가 바뀌었으면 저장하지 않고 최신본만 받는다 · 무결성 오류면 다시 불러오게 한다', async () => {
    openChat([msg('미나', '현재')]);
    const owner = D.getOwner();
    T.server.set('old-chat', [{ chat_metadata: { favorites: [] } }, msg('미나', '처음 글')]);
    const record = { key: 'old-chat', label: 'old', isCurrent: false, owner, favorites: [], messages: null, header: null, loaded: false, messageCount: 0, lastMes: '' };
    await D.loadRecord(record);
    T.server.set('old-chat', [{ chat_metadata: { favorites: [] } }, msg('미나', '다른 기기가 고친 글')]);
    T.posts.length = 0;
    await assert.rejects(D.addBookmark(record, 0), /그사이 채팅이 바뀌어서/);
    assert.equal(T.posts.filter(([url]) => url === '/api/chats/save').length, 0);
    assert.equal(record.messages[0].mes, '다른 기기가 고친 글', '최신본을 받았다');
    T.saveStatus = 500; T.savePayload = { error: 'integrity' };
    await assert.rejects(D.setNote(record, 'none', 'x'), /찾을 수 없습니다/, '없는 북마크는 저장 전에 멈춘다');
    const fav = { id: 'f1', messageId: '0', note: '' };
    T.server.get('old-chat')[0].chat_metadata.favorites.push(fav);
    await assert.rejects(D.setNote(record, 'f1', '메모'), /그사이 채팅 파일이 바뀌어/);
    assert.equal(T.server.get('old-chat')[0].chat_metadata.favorites[0].note, '', '파일은 그대로');
    // 다시 하면 파일 최신본을 또 읽어 그 위에 고친다 (불러온 복사본으로 덮어쓰지 않는다)
    T.saveStatus = 200; T.posts.length = 0;
    await D.setNote(record, 'f1', '메모');
    assert.deepEqual(T.posts.map(([url]) => url), ['/api/chats/get', '/api/chats/save']);
    assert.equal(T.server.get('old-chat')[0].chat_metadata.favorites[0].note, '메모');
});

await test('메시지 원문 고치기(현재 채팅): MESSAGE_EDITED → 그리기 → MESSAGE_UPDATED → 저장 · 번역기가 손대지 않은 번역문 · 공유 기록은 지움', async () => {
    const ctx = openChat([msg('미나', '옛 글', false, { display_text: '옛 번역', original_translation_backup: 'b', translation_source: { v: 2 } })]);
    const record = D.currentRecord();
    await D.editMessageText(record, 0, '새 글');
    const m = ctx.chat[0];
    assert.equal(m.mes, '새 글'); assert.deepEqual(m.swipes, ['새 글']);
    assert.deepEqual(T.events, [['message_edited', 0], ['message_updated', 0]]);
    assert.deepEqual(T.blocks.map(([id]) => id), [0, 0], '고친 뒤 한 번 · 번역문을 지운 뒤 한 번');
    assert.equal(m.extra.display_text, undefined); assert.equal(m.extra.translation_source, undefined); assert.equal(m.extra.original_translation_backup, undefined);
    assert.equal(T.chatSaves, 1); assert.equal(ctx.chatMetadata.tainted, true);
});

await test('메시지 원문 고치기(현재 채팅): 번역기가 번역문을 새로 붙였으면 두고, 실패하면 원문 · 스와이프 · extra 를 되돌리고, 편집 창이 열려 있으면 안 한다', async () => {
    const ctx = openChat([msg('미나', '옛 글', false, { display_text: '옛 번역' })]);
    const record = D.currentRecord();
    globalThis.__bookmarksDataTest.ctx.chat[0].extra.display_text = '옛 번역';
    const stub = STUBS;   // (번역기 흉내: MESSAGE_UPDATED 에서 번역문을 바꾼다)
    const original = T.ctx.chat[0];
    const emit = (await import(stub['script.js'])).eventSource.emit;
    (await import(stub['script.js'])).eventSource.emit = async (name, id) => { T.events.push([name, id]); if (name === 'message_updated') original.extra.display_text = '새 번역'; };
    await D.editMessageText(record, 0, '새 글');
    assert.equal(original.extra.display_text, '새 번역', '번역기가 바꾼 번역문은 둔다');
    (await import(stub['script.js'])).eventSource.emit = emit;
    T.failOn = 'message_updated';
    await assert.rejects(D.editMessageText(record, 0, '또 새 글'), /listener failed/);
    assert.equal(ctx.chat[0].mes, '새 글', '되돌림'); assert.deepEqual(ctx.chat[0].swipes, ['새 글']);
    assert.equal(ctx.chat[0].extra.display_text, '새 번역');
    T.failOn = null; T.editing = {};
    await assert.rejects(D.editMessageText(record, 0, 'x'), /고치는 중/);
    T.editing = null;
    await assert.rejects(D.editMessageText(record, 0, 'x', msg('미나', '다른 글')), /그사이 채팅이 바뀌어서/, '기대한 메시지와 다르면 안 고친다');
});

await test('메시지 원문 고치기(다른 채팅): 번역문 · 공유 기록을 지우고 그 메시지 북마크의 지문을 새로 쓴다', async () => {
    openChat([msg('미나', '현재')]);
    const owner = D.getOwner();
    const old = msg('미나', '옛 글', false, { display_text: '옛 번역', translation_source: { v: 2 } });
    const anchorBefore = 'stale';
    T.server.set('old-chat', [{ chat_metadata: { favorites: [{ id: 'f1', messageId: '0', note: '', anchor: anchorBefore }] } }, old]);
    const record = { key: 'old-chat', label: 'old', isCurrent: false, owner, favorites: [], messages: null, header: null, loaded: false, messageCount: 0, lastMes: '' };
    await D.loadRecord(record);
    await D.editMessageText(record, 0, '새 글');
    const file = T.server.get('old-chat');
    assert.equal(file[1].mes, '새 글'); assert.deepEqual(file[1].swipes, ['새 글']);
    assert.equal(file[1].extra.display_text, undefined); assert.equal(file[1].extra.translation_source, undefined);
    assert.notEqual(file[0].chat_metadata.favorites[0].anchor, anchorBefore, '지문을 새 원문으로');
    assert.equal(T.events.length, 0, '다른 채팅은 실리태번 이벤트를 내지 않는다');
});

await test('설정: 처음 설치는 이전 확장(star) 설정을 옮기고 범위 밖 숫자는 자른다 · 옛 설정은 아이콘을 한 번만 별로 · 다음부터는 그대로', () => {
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    T.ext.star = { colors: { default: { accent: '#112233', junk: 'x' }, chats: { 'c1': { user: '#445566' }, 'c2': {} } }, contextViewRange: 99, itemsPerPage: 7 };
    const first = S.initSettings();
    assert.equal(first.migratedFrom, 'star');
    assert.deepEqual(first.colors, { default: { accent: '#112233' }, chats: { c1: { user: '#445566' } } });
    assert.equal(first.contextRange, 10, '0~10 으로 자른다'); assert.equal(first.itemsPerPage, 7);
    assert.equal(first.iconStyle, 'star'); assert.equal(first.starIconApplied, true);
    delete T.ext.star;
    T.ext.chaekgalpi = { iconStyle: 'bookmark', itemsPerPage: 500 };
    const old = S.initSettings();
    assert.equal(old.iconStyle, 'star', '옛 설정은 한 번 별로'); assert.equal(old.itemsPerPage, 50);
    old.iconStyle = 'bookmark';
    assert.equal(S.initSettings().iconStyle, 'bookmark', '그 뒤로는 고른 대로');
    assert.equal(S.chatKey('some chat.jsonl'), 'some chat');
});

delete globalThis.__bookmarksDataTest;
console.log(`bookmarks-data: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
