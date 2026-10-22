// 7.7.2 북마크 데이터의 발췌 · 그림 · 메모 갈래 (src/addons/bookmarks/data.js) — 현재 채팅과 다른 채팅(파일 최신본 위에 고치기)에서 붙이기 · 떼기 · 고치기,
//   바뀐 것이 없으면 저장하지 않기, 그사이 바뀐 메시지 · 열린 채팅이면 덮어쓰지 않기, 그룹 저장 길. bookmarks-data.mjs 와 같은 스텁 · 메모리 속 가짜 서버, 지어낸 채팅만.
//   node tools/tests/bookmarks-attach-edges.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const dir = pathToFileURL(path.join(root, 'src/addons/bookmarks')).href + '/';
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__bookmarksAttachTest = { ext: {}, ctx: null, meta: 0, chatSaves: 0, settingsSaves: 0, events: [], blocks: [], server: new Map(), posts: [], saveStatus: 200, savePayload: null };
const G = 'const T = globalThis.__bookmarksAttachTest;\n';
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


const otherChat = (messages, favorites = []) => {
    openChat([msg('미나', '현재')]);
    T.server.set('old-chat', [{ user_name: '하람', character_name: '미나', chat_metadata: { favorites } }, ...messages]);
    return { key: 'old-chat', label: 'old', isCurrent: false, owner: D.getOwner(), favorites: [], messages: null, header: null, loaded: false, messageCount: 0, lastMes: '' };
};
const saves = () => T.posts.filter(([url]) => url === '/api/chats/save');
const IMG = '/user/images/Mina/a.png';

await test('현재 채팅: 발췌 — 북마크가 없으면 만들고, 같은 글 · 빈 글은 저장하지 않는다', async () => {
    const ctx = openChat([msg('미나', '「긴 대사 하나와 두 번째 문장」')]);
    const record = D.currentRecord();
    changed = 0;
    const r = await D.addExcerpt(record, 0, { text: '긴 대사', html: '<b>긴 대사</b>', pos: 1 });
    assert.deepEqual([r.created, r.added], [true, true]);
    assert.equal(ctx.chatMetadata.favorites.length, 1);
    assert.equal(ctx.chatMetadata.favorites[0].excerpts[0].text, '긴 대사');
    assert.equal(T.meta, 1);
    const dup = await D.addExcerpt(record, 0, { text: '대사' });
    assert.deepEqual([dup.created, dup.added, dup.reason], [false, false, 'duplicate']);
    assert.equal(T.meta, 1, '안 바뀌면 저장 안 함');
    const empty = await D.addExcerpt(record, 0, { text: '   ' });
    assert.equal(empty.reason, 'empty');
    const more = await D.addExcerpt(record, 0, { text: '두 번째 문장' });
    assert.deepEqual([more.created, more.added], [false, true], '같은 메시지면 있는 북마크에');
    assert.equal(ctx.chatMetadata.favorites.length, 1);
    assert.equal(T.meta, 2);
    await assert.rejects(D.addExcerpt(record, 5, { text: 'x' }), /찾을 수 없습니다/);
    // 고치기 · 빼기
    const fav = ctx.chatMetadata.favorites[0], exId = fav.excerpts[0].id;
    assert.equal(await D.editExcerptIn(record, fav.id, exId, { text: '긴 대사 고침', html: '' }), true);
    assert.equal(T.meta, 3);
    assert.equal(await D.editExcerptIn(record, fav.id, exId, { text: '긴 대사 고침', html: '' }), false, '같은 글이면 안 바뀜');
    assert.equal(T.meta, 3);
    await assert.rejects(D.editExcerptIn(record, fav.id, 'nope', { text: 'x' }), /발췌를 찾을 수 없습니다/);
    await assert.rejects(D.editExcerptIn(record, 'nofav', exId, { text: 'x' }), /북마크를 찾을 수 없습니다/);
    assert.equal(await D.removeExcerptFrom(record, fav.id, 'nope'), false);
    assert.equal(T.meta, 3);
    assert.equal(await D.removeExcerptFrom(record, fav.id, exId), true);
    assert.equal(T.meta, 4);
    await assert.rejects(D.removeExcerptFrom(record, 'nofav', exId), /북마크를 찾을 수 없습니다/);
});

await test('현재 채팅: 그림 — 다리가 만든 북마크는 마지막 그림을 떼면(dropEmpty) 북마크째, 손으로 단 별표는 남긴다', async () => {
    const ctx = openChat([msg('미나', 'a'), msg('미나', 'b')]);
    const record = D.currentRecord();
    const r = await D.addImageTo(record, 0, { src: IMG, prompt: 'tags' });
    assert.deepEqual([r.created, r.added, r.changed], [true, true, true]);
    assert.equal(ctx.chatMetadata.favorites[0].blImageBorn, true);
    const metaAfter = T.meta;
    const again = await D.addImageTo(record, 0, { src: IMG });
    assert.deepEqual([again.added, again.changed, again.reason], [false, false, 'duplicate']);
    assert.equal(T.meta, metaAfter, '같은 그림이면 저장 안 함');
    const fill = await D.addImageTo(record, 0, { src: 'http://127.0.0.1:8000' + IMG, prompt: 'p' }, { origin: 'http://127.0.0.1:8000' });
    assert.deepEqual([fill.added, fill.changed], [false, false], '같은 경로 · 이미 프롬프트가 있음');
    assert.equal((await D.addImageTo(record, 0, { src: '#x' })).reason, 'empty');
    const fav = ctx.chatMetadata.favorites[0];
    assert.deepEqual(await D.removeImageFrom(record, fav.id, '/nope.png', { dropEmpty: true }), { removed: false, bookmark: true });
    assert.deepEqual(await D.removeImageFrom(record, fav.id, IMG, { dropEmpty: true }), { removed: true, bookmark: false });
    assert.equal(ctx.chatMetadata.favorites.length, 0);
    // 손으로 단 별표에 붙인 그림은 떼도 별표는 남는다
    const star = await D.addBookmark(record, 1);
    await D.addImageTo(record, 1, { src: IMG });
    assert.deepEqual(await D.removeImageFrom(record, star.id, IMG, { dropEmpty: true }), { removed: true, bookmark: true });
    assert.equal(ctx.chatMetadata.favorites.length, 1);
    // 다리 북마크라도 메모가 있으면 남긴다 · dropEmpty 가 없으면 남긴다
    await D.addImageTo(record, 0, { src: IMG });
    const born = D.bookmarkAt(record, 0);
    await D.setNote(record, born.id, '메모');
    assert.equal((await D.removeImageFrom(record, born.id, IMG, { dropEmpty: true })).bookmark, true);
    await D.addImageTo(record, 0, { src: IMG });
    await D.setNote(record, born.id, '');
    assert.equal((await D.removeImageFrom(record, born.id, IMG)).bookmark, true);
    await assert.rejects(D.removeImageFrom(record, 'nofav', IMG), /북마크를 찾을 수 없습니다/);
    await assert.rejects(D.addImageTo(record, 9, { src: IMG }), /찾을 수 없습니다/);
});

await test('다른 채팅: 발췌 · 그림 · 메모 · 지우기는 파일 최신본 위에, 바뀐 것이 없으면 저장하지 않는다', async () => {
    const record = otherChat([msg('미나', '옛 대사 하나'), msg('미나', '둘')]);
    await D.loadRecord(record);
    T.posts.length = 0;
    const ex = await D.addExcerpt(record, 0, { text: '옛 대사' });
    assert.deepEqual([ex.created, ex.added], [true, true]);
    assert.equal(saves().length, 1);
    assert.equal(T.server.get('old-chat')[0].chat_metadata.favorites[0].excerpts[0].text, '옛 대사');
    const dup = await D.addExcerpt(record, 0, { text: '대사' });
    assert.equal(dup.added, false);
    assert.equal(saves().length, 1, '안 바뀌면 저장 안 함');
    const img = await D.addImageTo(record, 1, { src: IMG });
    assert.equal(img.created, true);
    assert.equal(saves().length, 2);
    assert.equal((await D.addImageTo(record, 1, { src: IMG })).changed, false);
    assert.equal(saves().length, 2);
    const fav = T.server.get('old-chat')[0].chat_metadata.favorites.find(f => f.messageId === '1');
    assert.deepEqual(await D.removeImageFrom(record, fav.id, IMG, { dropEmpty: true }), { removed: true, bookmark: false });
    assert.equal(T.server.get('old-chat')[0].chat_metadata.favorites.length, 1);
    assert.deepEqual(await D.removeImageFrom(record, T.server.get('old-chat')[0].chat_metadata.favorites[0].id, '/nope.png'), { removed: false, bookmark: true });
    assert.equal(saves().length, 3, '못 뗐으면 저장 안 함');
    await assert.rejects(D.removeImageFrom(record, 'nofav', IMG), /그사이 지워졌을 수 있어요/);
    const exFav = T.server.get('old-chat')[0].chat_metadata.favorites[0];
    const exId = exFav.excerpts[0].id;
    assert.equal(await D.editExcerptIn(record, exFav.id, exId, { text: '고친 발췌', html: '' }), true);
    assert.equal(T.server.get('old-chat')[0].chat_metadata.favorites[0].excerpts[0].text, '고친 발췌');
    await assert.rejects(D.editExcerptIn(record, exFav.id, 'nope', { text: 'x' }), /발췌를 찾을 수 없습니다/);
    await assert.rejects(D.editExcerptIn(record, 'nofav', exId, { text: 'x' }), /그사이 지워졌을 수 있어요/);
    assert.equal(await D.removeExcerptFrom(record, exFav.id, 'nope'), false);
    const before = saves().length;
    assert.equal(await D.removeExcerptFrom(record, exFav.id, exId), true);
    assert.equal(saves().length, before + 1);
    await assert.rejects(D.removeExcerptFrom(record, 'nofav', exId), /그사이 지워졌을 수 있어요/);
    assert.equal(await D.removeBookmark(record, 'nope'), false);
    assert.equal(saves().length, before + 1, '없는 북마크 지우기는 저장 안 함');
    // 그사이 메시지가 바뀌면 발췌 · 그림을 붙이지 않는다
    T.server.get('old-chat')[1] = msg('미나', '다른 기기가 고친 글');
    await assert.rejects(D.addExcerpt(record, 0, { text: '옛' }), /그사이 채팅이 바뀌어서/);
    await D.loadRecord(record, { force: true });
    T.server.get('old-chat')[2] = msg('미나', '또 고침');
    await assert.rejects(D.addImageTo(record, 1, { src: IMG }), /그사이 채팅이 바뀌어서/);
});

await test('saveRecord: 다른 채팅은 불러오기 전 · 그사이 열린 채팅이면 저장하지 않는다, 그룹 채팅은 그룹 저장 길', async () => {
    const record = otherChat([msg('미나', 'x')]);
    await assert.rejects(D.saveRecord(record), /불러오기 전에는 저장할 수 없습니다/);
    await D.loadRecord(record);
    T.ctx.chatId = 'old-chat';
    await assert.rejects(D.saveRecord(record), /그사이 이 채팅을 열어서/);
    assert.equal(record.loaded, false, '다시 불러오게');
    await D.loadRecord(record);
    await assert.rejects(D.addExcerpt(record, 0, { text: 'x' }), /그사이 이 채팅을 열어서/);
    T.ctx.chatId = 'chat-now';
    T.ctx.characterId = 1; T.ctx.characters.push({ name: '렉스', avatar: 'rex.png' });
    await D.loadRecord(record, { force: true });
    T.ctx.chatId = 'old-chat';
    T.posts.length = 0;
    await D.saveRecord(record);
    assert.equal(saves().length, 1, '다른 캐릭터의 같은 이름 채팅은 열린 채팅이 아니다');
    // 그룹
    T.ctx = { chatId: 'g-now', chat: [], chatMetadata: {}, characters: [], characterId: undefined, groupId: 'g1', groups: [{ id: 'g1', name: '모임' }] };
    const owner = D.getOwner();
    assert.deepEqual([owner.isGroup, owner.name, owner.avatarUrl], [true, '모임', 'img/ai4.png']);
    let groupSaved = null;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => { if (url === '/api/chats/group/save') { groupSaved = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({}) }; } if (url === '/api/chats/group/get') return { ok: true, status: 200, json: async () => [{ chat_metadata: { favorites: [] } }, msg('미나', 'g')] }; return realFetch(url, init); };
    const g = D.otherRecord(owner, 'g-old');
    await D.loadRecord(g);
    await D.saveRecord(g);
    assert.deepEqual([groupSaved.id, groupSaved.chat.length], ['g-old', 2]);
    globalThis.fetch = realFetch;
    T.ctx.groupId = 'missing';
    assert.equal(D.getOwner(), null);
});

await test('sameMessage: 글 · 보낸 시각 · 이름 · 사용자 여부가 다 같아야', () => {
    const a = msg('미나', '글');
    assert.equal(D.sameMessage(a, { ...a }), true);
    assert.equal(D.sameMessage(a, { ...a, mes: '다름' }), false);
    assert.equal(D.sameMessage(a, { ...a, send_date: 'x' }), false);
    assert.equal(D.sameMessage(a, { ...a, name: '렉스' }), false);
    assert.equal(D.sameMessage(a, { ...a, is_user: true }), false);
    assert.equal(D.sameMessage({ mes: 'x' }, { mes: 'x', send_date: '', name: '', is_user: 0 }), true, '빈 값끼리는 같다');
    assert.equal(D.sameMessage(null, a), false);
    assert.equal(D.sameMessage(a, undefined), false);
});

console.log(`bookmarks-attach-edges: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
