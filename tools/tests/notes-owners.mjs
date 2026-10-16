// 메모 애드온 — 채팅 · 캐릭터 귀속이 바뀌는 길 (src/addons/notes/index.js)
//   node tools/tests/notes-owners.mjs <테마 루트>   (공개 저장소는 '.')
// 진짜 index.js 를 그대로 불러온다. 실리태번 모듈(script.js · extensions.js · utils.js)과 테마 화면 모듈은 data: 스텁, 문서는 작은 가짜,
// 서버 요청(fetch)은 시험이 정한 답만. 실리태번 이벤트 처리는 index.js 가 eventSource.on 으로 건 함수를 그대로 부른다.
// 귀속 바꾸기(setOwner)는 안에서만 쓰여서, 불러올 때 파일 끝에 export 한 줄만 붙여 꺼낸다 (로더 load 훅 — 원본 글은 그대로).
// 확인하는 것:
//   1) 지금 채팅 = 캐릭터 카드 + 채팅 이름 (그룹은 g:) · 새 메모는 지금 채팅에 귀속, 채팅이 없으면 전체 메모
//   2) 보이는 메모: 전체 + 지금 채팅 + 그 캐릭터(그룹) 전체 귀속 (5.4.8)
//   3) 귀속 바꾸기: 지금 채팅 · 캐릭터 전체 · 전체 메모 (고친 시각 · 알림)
//   4) 채팅을 열면 지금 채팅 · 캐릭터 전체 귀속 메모의 이름 · 그림을 새로 (다른 채팅은 그대로, 고칠 것이 없으면 저장 안 함)
//   5) 캐릭터 · 그룹이 없어진 메모는 고치지 않고 어느 채팅에서나 보임 (CHARACTER_DELETED)
//   6) 채팅 이름 바꾸기: 서버가 다듬은 이름(getSanitizedFilename)으로 key · chat 을 따라 고침, 같은 이름의 다른 캐릭터 채팅은 그대로 (5.4.5)
//   7) 캐릭터 이름 바꾸기: 카드 파일이 바뀌면 key 도 (캐릭터 전체 귀속은 c:<새 파일>)
//   8) 채팅 지우기: 지금 캐릭터 채팅이면 그 메모만 · 아니면 캐릭터마다 채팅 목록을 물어 정말 없어졌을 때만 전체 메모로 (5.6.3 —
//      예전엔 다른 캐릭터의 같은 이름 채팅 메모까지 풀었다) · 목록을 못 읽으면 아무것도 안 품 · 그룹 채팅 지우기는 그 그룹 채팅만
// 시험 글은 지어낸 이름 · 문장만 쓴다.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const notesUrl = pathToFileURL(path.join(root, 'src/addons/notes/index.js')).href;
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__notesOwnersTest = { ext: {}, ctx: {}, theme: { addonUI: { notesMenu: false, notesBarMenu: false } }, handlers: {}, saves: 0, toasts: [], sanitize: async name => name, fetch: null };
const G = 'const T = globalThis.__notesOwnersTest;\n';
const STUBS = {
    'extensions.js': js(G + 'export const extension_settings = T.ext;\nexport function getContext() { return T.ctx; }'),
    'script.js': js(G + `export const event_types = { CHAT_CHANGED: 'chat_id_changed', CHAT_RENAMED: 'chat_renamed', CHARACTER_RENAMED: 'character_renamed', CHAT_DELETED: 'chat_deleted', GROUP_CHAT_DELETED: 'group_chat_deleted', CHARACTER_DELETED: 'characterDeleted' };
export const eventSource = { on(type, fn) { T.handlers[type] = fn; } };
export function saveSettingsDebounced() { T.saves++; }
export const messageFormatting = text => String(text ?? '');
export const getThumbnailUrl = (type, file) => '/thumbnail?type=' + type + '&file=' + file;
export function getRequestHeaders() { return { 'Content-Type': 'application/json' }; }`),
    'utils.js': js(G + 'export async function getSanitizedFilename(name) { return T.sanitize(name); }'),
    'modal.js': js('export function showThemeModal() {}'),
    'addon-files-check.js': js('export function verifyAddonCss() {}'),
    'settings.js': js(G + 'export function getSettings() { return T.theme; }'),
    'dialogue-span.js': js('export function wrapSpanningQuotes() {}'),
    'dem-expressive.js': js('export function dressBody() {}'),
    'fonts.js': js(`export const allFonts = () => []; export const findFont = () => null; export function loadFont() {}
export const fontStack = () => ''; export const fontsFor = () => []; export const previewStack = () => ''; export function queuePreview() {}
export const GROUPS = []; export const SAMPLES = {};`),
    'lite.js': js('export function restorePreviewRules() {}'),
    'typography.js': js('export function typesetRoot() {}'),
    'assets.js': js('export function classifyAll() {}'),
    'palettes.js': js('export const PALETTES = {}; export const PALETTE_FAMILIES = {};'),
    'name-aliases.js': js('export const nameAliases = () => [];'),
};
const TAIL = '\nexport { setOwner as __setOwner };\n';
register(js(`import { readFile } from 'node:fs/promises';
let S = {}, TARGET = '', TAIL = '';
export async function initialize(d) { S = d.stubs; TARGET = d.target; TAIL = d.tail; }
export async function resolve(spec, ctx, next) {
    if (ctx.parentURL === TARGET && spec !== './version.js') { const url = S[spec.split('/').pop()]; if (url) return { url, shortCircuit: true }; }
    return next(spec, ctx);
}
export async function load(url, ctx, next) {
    if (url !== TARGET) return next(url, ctx);
    return { format: 'module', source: (await readFile(new URL(url), 'utf8')) + TAIL, shortCircuit: true };
}`), { data: { stubs: STUBS, target: notesUrl, tail: TAIL } });

const noop = () => {};
const fakeEl = () => ({ style: { setProperty: noop, removeProperty: noop }, classList: { toggle: noop, add: noop, remove: noop, contains: () => false }, dataset: {}, append: noop, remove: noop });
globalThis.document = Object.assign(new EventTarget(), { documentElement: fakeEl(), body: fakeEl(), activeElement: null, createElement: fakeEl, getElementById: () => null, getElementsByClassName: () => [], querySelector: () => null, querySelectorAll: () => [] });
globalThis.addEventListener = noop;
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
globalThis.toastr = Object.fromEntries(['info', 'success', 'warning', 'error'].map(kind => [kind, message => T.toasts.push([kind, String(message)])]));
globalThis.fetch = async (url, init) => { if (!T.fetch) throw new Error('시험 중 예상하지 않은 네트워크 요청'); return T.fetch(url, init); };

T.ext['bl-notes'] = { notes: [], folders: [] };
const N = await import(notesUrl);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
// 실패 경로의 console.warn 은 시험 출력에서 감춘다
async function quiet(fn) { const warn = console.warn; console.warn = () => {}; try { return await fn(); } finally { console.warn = warn; } }
const note = (id, extra = {}) => ({ id, title: id, body: '', updated: 1, ...extra });
function reset(list) { T.ext['bl-notes'] = { notes: list, folders: [] }; T.saves = 0; T.toasts.length = 0; T.fetch = null; return N.notes(); }
const byId = id => N.notes().find(n => n.id === id);
const vis = () => N.visibleNotes().map(n => n.id);
const on = type => T.handlers[type];

// 지어낸 인물 · 그룹 (카드 파일 · 채팅 이름도 지어낸 것)
const A = { avatar: 'sample-a.png', name: '연습 인물 A' }, B = { avatar: 'sample-b.png', name: '연습 인물 B' };
const GRP = { id: 'grp-1', name: '연습 모임', avatar_url: '/img/grp-1.png' };
const openChat = (i, chatId, chars = [A, B]) => { T.ctx = { chatId, characterId: i, characters: chars, groups: [GRP] }; };
const openGroup = chatId => { T.ctx = { chatId, groupId: GRP.id, characters: [A, B], groups: [GRP] }; };
const own = (ch, chat) => ({ key: `${ch.avatar}/${chat}`, chat, avatar: ch.avatar, name: ch.name });
const whole = ch => ({ key: `c:${ch.avatar}`, whole: true, avatar: ch.avatar, name: ch.name });
const gown = chat => ({ key: `g:${GRP.id}/${chat}`, chat, group: GRP.id, name: GRP.name, avatar: GRP.avatar_url });
const gwhole = () => ({ key: `gc:${GRP.id}`, whole: true, group: GRP.id, name: GRP.name, avatar: GRP.avatar_url });

await test('실리태번 이벤트 여섯 가지를 건다 (채팅 열기 · 이름 바꾸기 · 지우기 · 그룹 채팅 지우기 · 캐릭터 이름 · 캐릭터 지우기)', () => {
    for (const type of ['chat_id_changed', 'chat_renamed', 'character_renamed', 'chat_deleted', 'group_chat_deleted', 'characterDeleted']) assert.equal(typeof on(type), 'function', type);
});

await test('지금 채팅: 캐릭터 카드 + 채팅 이름 · 그룹은 g: · 새 메모는 지금 채팅에 귀속, 채팅이 없거나 카드를 못 찾으면 전체 메모', () => {
    reset([]);
    T.ctx = {};
    assert.equal(N.currentOwner(), null);
    assert.equal('owner' in N.addNote('전체', ''), false);
    openChat(0, 'a-1');
    assert.deepEqual(N.currentOwner(), own(A, 'a-1'));
    assert.deepEqual(N.addNote('채팅 메모', '').owner, own(A, 'a-1'));
    openGroup('g-1');
    assert.deepEqual(N.currentOwner(), gown('g-1'));
    T.ctx = { chatId: 'g-9', groupId: 'grp-none', characters: [A], groups: [] };
    assert.deepEqual(N.currentOwner(), { key: 'g:grp-none/g-9', chat: 'g-9', group: 'grp-none', name: '그룹', avatar: '' });
    T.ctx = { chatId: 'x', characterId: 5, characters: [A] };
    assert.equal(N.currentOwner(), null);
    assert.equal('owner' in N.addNote('카드 없음', ''), false);
});

await test('보이는 메모: 전체 + 지금 채팅 + 그 캐릭터(그룹) 전체 귀속 — 다른 채팅 · 다른 캐릭터 메모는 안 보임', () => {
    reset([note('G'), note('A1', { owner: own(A, 'a-1') }), note('A2', { owner: own(A, 'a-2') }), note('AW', { owner: whole(A) }), note('B1', { owner: own(B, 'b-1') }), note('GW', { owner: gwhole() }), note('G1', { owner: gown('g-1') })]);
    openChat(0, 'a-1'); assert.deepEqual(vis(), ['G', 'A1', 'AW']);
    openChat(0, 'a-2'); assert.deepEqual(vis(), ['G', 'A2', 'AW']);
    openChat(1, 'b-1'); assert.deepEqual(vis(), ['G', 'B1']);
    openGroup('g-1'); assert.deepEqual(vis(), ['G', 'GW', 'G1']);
    openGroup('g-2'); assert.deepEqual(vis(), ['G', 'GW']);
    T.ctx = {}; assert.deepEqual(vis(), ['G']);
});

await test('귀속 바꾸기: 지금 채팅 → 캐릭터 전체 → 전체 메모 (고친 시각 · 저장 · 알림), 없는 메모는 그대로', () => {
    reset([note('m')]);
    openChat(0, 'a-1');
    N.__setOwner('m', N.currentOwner());
    assert.deepEqual(byId('m').owner, own(A, 'a-1'));
    assert.ok(byId('m').updated > 1); assert.ok(T.saves >= 1);
    assert.ok(T.toasts.at(-1)[1].includes('a-1'));
    N.__setOwner('m', whole(A));
    assert.deepEqual(byId('m').owner, whole(A));
    assert.ok(T.toasts.at(-1)[1].includes('캐릭터 전체'));
    N.__setOwner('m', null);
    assert.equal('owner' in byId('m'), false);
    assert.ok(T.toasts.at(-1)[1].includes('전체 메모'));
    const saves = T.saves;
    N.__setOwner('없는 메모', whole(A));
    assert.equal(T.saves, saves);
});

await test('채팅을 열면: 지금 채팅 · 캐릭터 전체 귀속 메모의 이름을 새로 (다른 채팅 · 다른 캐릭터는 그대로), 두 번째는 저장 안 함', () => {
    reset([note('A1', { owner: { ...own(A, 'a-1'), name: '옛 이름' } }), note('AW', { owner: { ...whole(A), name: '옛 이름' } }), note('A2', { owner: { ...own(A, 'a-2'), name: '옛 이름' } }), note('B1', { owner: { ...own(B, 'b-1'), name: '옛 이름' } })]);
    const renamed = { avatar: A.avatar, name: '새 이름 A' };
    openChat(0, 'a-1', [renamed, B]);
    on('chat_id_changed')();
    assert.equal(byId('A1').owner.name, '새 이름 A');
    assert.equal(byId('A1').owner.key, own(A, 'a-1').key, 'key 는 그대로');
    assert.equal(byId('AW').owner.name, '새 이름 A');
    assert.equal(byId('A2').owner.name, '옛 이름', '같은 캐릭터라도 다른 채팅 메모는 그 채팅을 열 때');
    assert.equal(byId('B1').owner.name, '옛 이름');
    assert.ok(T.saves >= 1);
    T.saves = 0;
    on('chat_id_changed')();
    assert.equal(T.saves, 0, '고칠 것이 없으면 저장 안 함');
});

await test('캐릭터 · 그룹이 없어진 메모는 고치지 않고 어느 채팅에서나 보인다 (CHARACTER_DELETED 뒤 다시 잼)', () => {
    reset([note('G'), note('A1', { owner: own(A, 'a-1') }), note('B1', { owner: own(B, 'b-1') }), note('BW', { owner: whole(B) }), note('GX', { owner: { key: 'g:grp-gone/x', chat: 'x', group: 'grp-gone', name: '사라진 모임', avatar: '' } })]);
    openChat(0, 'a-1', [A, B]);
    on('characterDeleted')();
    assert.deepEqual(vis(), ['G', 'A1', 'GX'], '없는 그룹의 메모만');
    openChat(0, 'a-1', [A]);
    T.saves = 0;
    on('characterDeleted')();
    assert.deepEqual(vis(), ['G', 'A1', 'B1', 'BW', 'GX']);
    assert.deepEqual(byId('B1').owner, own(B, 'b-1'), '귀속은 그대로 (다시 귀속할 수 있게)');
    assert.equal(T.saves, 0);
    openChat(0, 'a-1', [A, B]);
    on('characterDeleted')();
});

await test('채팅 이름 바꾸기: 서버가 다듬은 이름으로 key · chat 을 고침 (.jsonl 뗌) · 같은 이름의 다른 캐릭터 채팅 · 캐릭터 전체는 그대로 · 그룹 채팅도', async () => {
    reset([note('A1', { owner: own(A, 'old talk') }), note('B1', { owner: own(B, 'old talk') }), note('AW', { owner: whole(A) }), note('G1', { owner: gown('old talk') })]);
    let calls = [];
    T.sanitize = async name => { calls.push(name); return name.replace(/[:?]/g, ''); };
    await on('chat_renamed')({ avatarId: A.avatar, oldFileName: 'old talk.jsonl', newFileName: 'new: talk v1.2.jsonl' });
    assert.deepEqual(calls, ['new: talk v1.2.jsonl']);
    assert.deepEqual(byId('A1').owner, { ...own(A, 'old talk'), chat: 'new talk v1.2', key: `${A.avatar}/new talk v1.2` });
    assert.deepEqual(byId('B1').owner, own(B, 'old talk'));
    assert.deepEqual(byId('AW').owner, whole(A));
    assert.deepEqual(byId('G1').owner, gown('old talk'));
    await on('chat_renamed')({ groupId: GRP.id, oldFileName: 'old talk.jsonl', newFileName: 'group next.jsonl' });
    assert.deepEqual(byId('G1').owner, { ...gown('old talk'), chat: 'group next', key: `g:${GRP.id}/group next` });
    assert.deepEqual(byId('B1').owner, own(B, 'old talk'));
    calls = [];
    await on('chat_renamed')({ avatarId: A.avatar, oldFileName: 'nothing here.jsonl', newFileName: 'x.jsonl' });
    assert.equal(calls.length, 0, '귀속된 메모가 없으면 이름 확인 요청도 안 한다');
    T.sanitize = async () => { throw new Error('이름 확인 실패'); };
    await quiet(() => on('chat_renamed')({ avatarId: B.avatar, oldFileName: 'old talk.jsonl', newFileName: 'z.jsonl' }));
    assert.deepEqual(byId('B1').owner, own(B, 'old talk'), '확인이 실패하면 그대로');
    T.sanitize = async name => name;
});

await test('캐릭터 이름 바꾸기: 카드 파일이 바뀌면 채팅 귀속 key 와 캐릭터 전체 key(c:) 를 새 파일로, 그룹 · 다른 캐릭터는 그대로', () => {
    reset([note('A1', { owner: own(A, 'a-1') }), note('AW', { owner: whole(A) }), note('B1', { owner: own(B, 'b-1') }), note('G1', { owner: gown('a-1') })]);
    on('character_renamed')(A.avatar, 'sample-a-renamed.png');
    assert.deepEqual(byId('A1').owner, { ...own(A, 'a-1'), avatar: 'sample-a-renamed.png', key: 'sample-a-renamed.png/a-1' });
    assert.deepEqual(byId('AW').owner, { ...whole(A), avatar: 'sample-a-renamed.png', key: 'c:sample-a-renamed.png' });
    assert.deepEqual(byId('B1').owner, own(B, 'b-1'));
    assert.deepEqual(byId('G1').owner, gown('a-1'));
    T.saves = 0;
    on('character_renamed')('sample-a-renamed.png', 'sample-a-renamed.png');
    on('character_renamed')('', 'x.png');
    assert.equal(T.saves, 0);
});

await test('채팅 지우기 (지금 캐릭터의 채팅): 그 캐릭터의 그 채팅 메모만 전체 메모로 — 서버에 묻지 않음, 같은 이름의 다른 캐릭터 · 그룹 메모는 그대로', async () => {
    reset([note('A1', { owner: own(A, 'same name') }), note('B1', { owner: own(B, 'same name') }), note('AW', { owner: whole(A) }), note('G1', { owner: gown('same name') })]);
    openChat(0, 'a-other');
    await on('chat_deleted')('same name');
    assert.equal('owner' in byId('A1'), false);
    assert.deepEqual(byId('B1').owner, own(B, 'same name'));
    assert.deepEqual(byId('AW').owner, whole(A));
    assert.deepEqual(byId('G1').owner, gown('same name'));
    assert.ok(T.toasts.some(([kind, text]) => kind === 'info' && text.includes('1개')));
});

await test('채팅 지우기 (다른 캐릭터): 캐릭터마다 한 번 채팅 목록을 물어 정말 없어졌을 때만 · 목록을 못 읽으면 그대로 (5.6.3)', async () => {
    const C = { avatar: 'sample-c.png', name: '연습 인물 C' }, D = { avatar: 'sample-d.png', name: '연습 인물 D' };
    const E = { avatar: 'sample-e.png', name: '연습 인물 E' }, F = { avatar: 'sample-f.png', name: '연습 인물 F' };
    reset([
        note('B1', { owner: own(B, 'old') }), note('B2', { owner: own(B, 'old') }),   // 목록에 아직 있음 → 그대로 (요청은 한 번)
        note('C1', { owner: own(C, 'old') }),                                          // 목록에서 없어짐 → 전체 메모로
        note('D1', { owner: own(D, 'old') }),                                          // 응답 실패 → 그대로
        note('E1', { owner: own(E, 'old') }),                                          // 요청 실패 → 그대로
        note('F1', { owner: own(F, 'old') }),                                          // { error: true } = 채팅 폴더째 없음 → 전체 메모로
        note('N1', { owner: { key: '/old', chat: 'old', name: '알 수 없음' } }),          // 캐릭터를 모르는 귀속 → 이름만 보고 전체 메모로
        note('A1', { owner: own(A, 'other') }), note('G1', { owner: gown('old') }), note('BX', { owner: own(B, 'old-2') }),
    ]);
    openChat(0, 'a-1');
    const asked = [];
    const reply = (ok, data) => ({ ok, json: async () => data });
    T.fetch = async (url, init) => {
        const body = JSON.parse(init.body);
        asked.push([url, init.method, body.avatar_url, body.simple]);
        if (body.avatar_url === B.avatar) return reply(true, [{ file_name: 'old.jsonl' }, { file_name: 'old-2.jsonl' }]);
        if (body.avatar_url === C.avatar) return reply(true, [{ file_name: 'old-2.jsonl' }]);
        if (body.avatar_url === D.avatar) return reply(false, null);
        if (body.avatar_url === E.avatar) throw new Error('연결 끊김');
        if (body.avatar_url === F.avatar) return reply(true, { error: true });
        throw new Error('예상하지 않은 캐릭터 ' + body.avatar_url);
    };
    await quiet(() => on('chat_deleted')('old'));
    assert.deepEqual(asked, [B, C, D, E, F].map(ch => ['/api/characters/chats', 'POST', ch.avatar, true]));
    const released = N.notes().filter(n => !n.owner).map(n => n.id);
    assert.deepEqual(released, ['C1', 'F1', 'N1']);
    assert.deepEqual(byId('B1').owner, own(B, 'old')); assert.deepEqual(byId('D1').owner, own(D, 'old')); assert.deepEqual(byId('E1').owner, own(E, 'old'));
    assert.deepEqual(byId('G1').owner, gown('old'), '그룹 채팅 메모는 CHAT_DELETED 와 무관');
    assert.ok(T.toasts.some(([kind, text]) => kind === 'info' && text.includes('3개')));
});

await test('그룹 채팅 지우기: 그 그룹 채팅 메모만 전체 메모로 (그룹 전체 귀속 · 같은 이름의 캐릭터 채팅은 그대로)', () => {
    reset([note('G1', { owner: gown('g-old') }), note('G2', { owner: gown('g-keep') }), note('GW', { owner: gwhole() }), note('A1', { owner: own(A, 'g-old') })]);
    on('group_chat_deleted')('g-old');
    assert.equal('owner' in byId('G1'), false);
    assert.deepEqual(byId('G2').owner, gown('g-keep'));
    assert.deepEqual(byId('GW').owner, gwhole());
    assert.deepEqual(byId('A1').owner, own(A, 'g-old'));
    T.saves = 0;
    on('group_chat_deleted')('');
    assert.equal(T.saves, 0);
});

console.log(`notes-owners: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
