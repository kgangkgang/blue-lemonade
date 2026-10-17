// 메모 애드온 — 메모 자료(extension_settings['bl-notes'])가 바뀌는 길 (src/addons/notes/index.js)
//   node tools/tests/notes-data.mjs <테마 루트>   (공개 저장소는 '.')
// 진짜 index.js 를 그대로 불러온다. 실리태번 모듈(script.js · extensions.js · utils.js)과 테마 화면 모듈(모달 · 글꼴 · 팔레트 …)은 data: 스텁,
// 문서는 작은 가짜. 안에서만 쓰는 함수(폴더 · 연결 이름 바꾸기 · 체크 줄 · 끌어서 순서)는 불러올 때 파일 끝에 export 한 줄만 붙여 꺼낸다
// (원본 글은 그대로 — 로더 load 훅). 네트워크 없음.
// 확인하는 것:
//   1) 옛 설정 다듬기(store): 망가진 항목은 버리고 값 꼴을 맞춘다 (id · 제목 · 내용 · 시각 · 색 · 귀속 · 폴더 · 폴더 목록 · 보기 설정 · 판)
//   2) 같은 배열은 한 번만, 제자리에서 다듬는다 (1.2.0: 부를 때마다 새 배열이라 위 · 아래 버튼이 안 움직이던 것) · 다른 기기 설정이 배열을 통째로 바꾸면 다시 다듬음
//   3) 더하기 · 고치기 · 지우기 · 300개 한도 · 복제(5.3.4: 전체 메모를 복제하면 복사본도 전체 메모, 색 · 글자색 · 폴더 같이, 귀속은 따로 된 객체)
//   4) 위 · 아래 옮기기와 끌어서 순서: 다른 채팅 메모는 저장 순서에서 제자리, 폴더는 한 칸으로 같이 움직임, 정렬은 '직접 정한 순'으로
//   5) 폴더 모으기 · 빼기 · 풀기 — 메모가 하나만 남은 폴더는 풀리고 꺼내 둔 폴더 쪽지 자리도 지운다, 없는 폴더를 가리키던 메모는 뗀다
//   6) 제목을 바꾸면 다른 메모의 [[옛 제목]] · ![[ ]] · [[옛 제목|별칭]] 도 새 제목으로 (코드 칸 안은 그대로, 같은 옛 제목 메모가 남아 있으면 안 바꿈)
//   7) 그린 보기의 체크 상자 → 원문 k 번째 [ ] ↔ [x] (코드 칸 · 인용 · 번호 목록 · 붙여 쓴 '[ ]글자' 는 상자가 아님)
// 시험 글은 지어낸 이름 · 문장만 쓴다.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const notesUrl = pathToFileURL(path.join(root, 'src/addons/notes/index.js')).href;
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__notesDataTest = { ext: {}, ctx: {}, theme: { addonUI: { notesMenu: false, notesBarMenu: false } }, handlers: {}, saves: 0, toasts: [], sanitize: async name => name };
const G = 'const T = globalThis.__notesDataTest;\n';
const STUBS = {
    'extensions.js': js(G + 'export const extension_settings = T.ext;\nexport function getContext() { return T.ctx; }'),
    'script.js': js(G + `export const event_types = { CHAT_CHANGED: 'chat_id_changed', CHAT_RENAMED: 'chat_renamed', CHARACTER_RENAMED: 'character_renamed', CHAT_DELETED: 'chat_deleted', GROUP_CHAT_DELETED: 'group_chat_deleted', CHARACTER_DELETED: 'characterDeleted' };
export const eventSource = { on(type, fn) { T.handlers[type] = fn; } };
export function saveSettingsDebounced() { T.saves++; }
export const messageFormatting = text => String(text ?? '');
export const getThumbnailUrl = (type, file) => '/thumbnail?type=' + type + '&file=' + file;
export function getRequestHeaders() { return {}; }`),
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
// 안에서만 쓰는 함수를 꺼내는 꼬리 (원본 끝에 붙일 뿐 — 함수 몸은 그대로)
const TAIL = '\nexport { joinFolder as __joinFolder, leaveFolder as __leaveFolder, breakFolder as __breakFolder, renameLinks as __renameLinks, toggleTask as __toggleTask, applyOrder as __applyOrder };\n';
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

// 작은 가짜 문서: 메모 줄 · 큰 창이 없는 상태 (찾으면 늘 없음)
const noop = () => {};
const fakeEl = () => ({ style: { setProperty: noop, removeProperty: noop }, classList: { toggle: noop, add: noop, remove: noop, contains: () => false }, dataset: {}, append: noop, remove: noop });
globalThis.document = Object.assign(new EventTarget(), { documentElement: fakeEl(), body: fakeEl(), activeElement: null, createElement: fakeEl, getElementById: () => null, getElementsByClassName: () => [], querySelector: () => null, querySelectorAll: () => [] });
globalThis.addEventListener = noop;
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop });
globalThis.toastr = Object.fromEntries(['info', 'success', 'warning', 'error'].map(kind => [kind, message => T.toasts.push([kind, String(message)])]));
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };

// 불러오기 전에 옛 판 · 망가진 설정을 넣어 둔다 (불러올 때 store() 가 한 번 돈다)
T.ext['bl-notes'] = {
    notes: [
        null, '글자만', 42,
        { id: 7, title: 12, body: null, updated: '1700000000000', color: '#ABCDEF', ink: 'red' },
        { title: '옛 메모', body: '본문', owner: 'chat', folder: '' },
        { id: 'n3', title: '바구니', body: '사과', owner: { key: 'card-x.png/talk-x' }, folder: 'f1', color: '#12345', ink: '#00ff00' },
    ],
    folders: [{ id: 'f1', name: 3 }, { name: '이름만' }, null, { id: 5 }],
    stickies: { n3: { x: 1, y: 2, w: 200, h: 150 } },
};

const N = await import(notesUrl);
const { NOTES_VERSION } = await import(pathToFileURL(path.join(root, 'src/addons/notes/version.js')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
const note = (id, extra = {}) => ({ id, title: id, body: '', updated: 1, ...extra });
function reset(list, more = {}) { T.ext['bl-notes'] = { notes: list, folders: [], ...more }; T.ctx = {}; T.saves = 0; T.toasts.length = 0; return N.notes(); }
const ids = () => N.notes().map(n => n.id);
const byId = id => N.notes().find(n => n.id === id);
// 지금 열린 채팅 (연습 인물 하나의 채팅) · 다른 인물의 채팅에 귀속된 메모
const chatA = { chatId: 'talk-a', characterId: 0, characters: [{ avatar: 'card-a.png', name: '연습 인물 하나' }], groups: [] };
const otherChat = { key: 'card-b.png/talk-b', chat: 'talk-b', avatar: 'card-b.png', name: '연습 인물 둘' };

await test('옛 설정 다듬기: 망가진 항목은 버리고 id · 제목 · 내용 · 시각 · 색 · 귀속 · 폴더를 맞는 꼴로, 폴더 목록 · 보기 설정 · 판도', () => {
    const s = T.ext['bl-notes'];
    assert.equal(s.notes.length, 3, '객체가 아닌 항목 3개는 버린다');
    assert.deepEqual(s.notes[0], { id: '7', title: '12', body: '', updated: 1700000000000, color: '#ABCDEF', ink: '' });
    const b = s.notes[1];
    assert.ok(typeof b.id === 'string' && b.id.length >= 6, 'id 없는 메모는 새 id');
    assert.equal(b.title, '옛 메모'); assert.equal(b.body, '본문'); assert.equal(b.updated, 0);
    assert.equal('owner' in b, false, '객체가 아닌 귀속은 뗀다 (전체 메모)');
    assert.equal('folder' in b, false, '빈 폴더 id 는 뗀다');
    const c = s.notes[2];
    assert.equal(c.color, '', '6자리 색이 아니면 지운다'); assert.equal(c.ink, '#00ff00');
    assert.deepEqual(c.owner, { key: 'card-x.png/talk-x' }); assert.equal(c.folder, 'f1');
    assert.deepEqual(s.folders, [{ id: 'f1', name: '3' }, { id: '5', name: '' }], 'id 없는 폴더는 버리고 id · 이름은 글자로');
    assert.deepEqual(s.look, { font: '', size: 100, lh: '', ls: '', weight: '', cols: 'auto', sort: 'manual' });
    assert.equal(s.version, NOTES_VERSION);
    assert.deepEqual(s.stickies, { n3: { x: 1, y: 2, w: 200, h: 150 } }, '꺼내 둔 쪽지 자리는 그대로');
});

await test('같은 배열은 제자리에서 (1.2.0) · 다른 기기 설정이 배열을 바꾸면 새 배열을 다시 다듬음 · 설정 칸이 통째로 없으면 새로', () => {
    const list = reset([note('a'), note('b')]);
    assert.equal(N.notes(), list, '두 번 불러도 같은 배열');
    N.addNote('셋째', '');
    assert.equal(N.notes(), list, '더한 뒤에도 같은 배열');
    T.ext['bl-notes'].notes = [{ id: 'sync', title: null, color: 'blue', updated: 'x' }, 0];
    const synced = N.notes();
    assert.equal(synced.length, 1);
    assert.deepEqual(synced[0], { id: 'sync', title: '', body: '', updated: 0, color: '', ink: '' });
    assert.equal(N.notes(), synced);
    delete T.ext['bl-notes'];
    assert.deepEqual(N.notes(), []);
    assert.deepEqual(T.ext['bl-notes'].folders, []);
    assert.equal(T.ext['bl-notes'].version, NOTES_VERSION);
});

await test('더하기 · 고치기 · 지우기: 자리(at)는 0 ~ 끝으로 맞추고, 채팅이 없으면 전체 메모, 바꿀 때마다 저장', () => {
    reset([]);
    const a = N.addNote('첫 메모', '본문 하나');
    assert.deepEqual(ids(), [a.id]);
    assert.equal('owner' in a, false);
    assert.ok(T.saves >= 1, '저장');
    const b = N.addNote('끝', '', 99), c = N.addNote('앞', '', -3);
    assert.deepEqual(ids(), [c.id, a.id, b.id]);
    a.updated = 5;
    const saves = T.saves;
    assert.equal(N.updateNote(a.id, { body: '고친 본문' }), true);
    assert.equal(a.body, '고친 본문'); assert.ok(a.updated > 5, '고친 시각'); assert.ok(T.saves > saves);
    assert.equal(N.updateNote('없는 메모', { body: 'x' }), false);
    assert.equal(N.removeNote('없는 메모'), false);
    assert.equal(N.removeNote(a.id), true);
    assert.deepEqual(ids(), [c.id, b.id]);
});

await test('300개 한도: 더하기 · 복제 모두 막고 알린다 (목록은 그대로)', () => {
    reset(Array.from({ length: 300 }, (_, i) => note('m' + i)));
    assert.equal(N.addNote('하나 더', ''), null);
    assert.equal(N.notes().length, 300);
    assert.ok(T.toasts.some(([kind, text]) => kind === 'warning' && text.includes('300')));
    assert.equal(N.duplicateNote('m0'), null);
    assert.equal(N.notes().length, 300);
});

await test('복제: 바로 뒤에, 색 · 글자색 · 폴더 같이 — 전체 메모는 다른 채팅이 열려 있어도 전체 메모로 (5.3.4), 귀속은 따로 된 객체', () => {
    reset([note('a', { title: '장보기', body: '- [ ] 우유', color: '#112233', ink: '#445566', folder: 'fx' }), note('b', { folder: 'fx' }), note('c', { owner: { ...otherChat } })], { folders: [{ id: 'fx', name: '묶음' }] });
    T.ctx = chatA;
    const copy = N.duplicateNote('a');
    assert.deepEqual(ids(), ['a', copy.id, 'b', 'c']);
    assert.notEqual(copy.id, 'a');
    assert.equal(copy.title, '장보기'); assert.equal(copy.body, '- [ ] 우유');
    assert.equal(copy.color, '#112233'); assert.equal(copy.ink, '#445566'); assert.equal(copy.folder, 'fx');
    assert.equal('owner' in copy, false, '지금 채팅에 붙지 않는다');
    const copyC = N.duplicateNote('c');
    assert.deepEqual(copyC.owner, otherChat);
    assert.notEqual(copyC.owner, byId('c').owner, '귀속을 고쳐도 원본이 같이 바뀌지 않게');
    assert.equal(N.duplicateNote('없는 메모'), null);
});

await test('위 · 아래: 보이는 칸끼리만 — 다른 채팅 메모는 저장 순서에서 제자리, 폴더는 한 칸, 끝에서는 안 움직임, 배열은 그대로', () => {
    const list = reset([note('g1'), note('h1', { owner: otherChat }), note('f1a', { folder: 'F' }), note('g2'), note('f1b', { folder: 'F' }), note('h2', { owner: otherChat }), note('g3')], { folders: [{ id: 'F', name: '묶음' }] });
    T.ctx = chatA;
    assert.deepEqual(N.visibleNotes().map(n => n.id), ['g1', 'f1a', 'g2', 'f1b', 'g3']);
    assert.equal(N.moveNote('g2', -1), true);
    assert.deepEqual(ids(), ['g1', 'h1', 'g2', 'f1a', 'f1b', 'h2', 'g3'], 'g2 가 폴더 칸 위로 · h1 · h2 는 제자리');
    assert.equal(N.moveNote('f1b', 1), true);
    assert.deepEqual(ids(), ['g1', 'h1', 'g2', 'g3', 'f1a', 'h2', 'f1b'], '폴더 메모 둘이 같이 아래로 · 안 보이는 h2 는 5번째 그대로');
    assert.equal(N.moveNote('g1', -1), false, '맨 위');
    assert.equal(N.moveNote('h1', 1), false, '안 보이는 메모');
    assert.equal(N.notes(), list, '같은 배열 (앞에서 잡아 둔 목록이 버려지지 않게)');
});

await test('끌어서 순서: 보이는 메모만 새 차례로 · 안 보이는 메모 제자리 · 겹친 id · 없는 id 무시 · 정렬은 직접 정한 순으로', () => {
    reset([note('g1'), note('h1', { owner: otherChat }), note('f1a', { folder: 'F' }), note('g2'), note('f1b', { folder: 'F' }), note('h2', { owner: otherChat }), note('g3')], { folders: [{ id: 'F', name: '묶음' }] });
    T.ctx = chatA;
    N.look().sort = 'name';
    N.__applyOrder(['g3', 'g1', 'g3', 'ghost', 'f1a', 'f1b', 'g2']);
    assert.deepEqual(ids(), ['g3', 'h1', 'g1', 'f1a', 'f1b', 'h2', 'g2']);
    assert.equal(N.look().sort, 'manual');
    assert.ok(T.saves >= 1);
});

await test('폴더: 놓은 메모와 새 폴더 · 모은 메모는 폴더 끝 뒤로 · 빼면 폴더 바로 뒤로 · 하나 남으면 풀리고 폴더 쪽지 자리도 지움', () => {
    reset([note('A'), note('B'), note('C'), note('D')]);
    const fid = N.__joinFolder({ id: 'B' }, ['A']);
    assert.ok(fid);
    assert.deepEqual(N.folders().map(({ id, name }) => ({ id, name })), [{ id: fid, name: '' }]);   // 7.0.2 새 폴더에는 updated (기기 간 합치기)
    assert.deepEqual(ids(), ['B', 'A', 'C', 'D']);
    assert.equal(byId('A').folder, fid); assert.equal(byId('B').folder, fid);
    assert.equal(N.__joinFolder({ folder: fid }, ['D']), fid);
    assert.deepEqual(ids(), ['B', 'A', 'D', 'C']);
    N.__leaveFolder('B');
    assert.deepEqual(ids(), ['A', 'D', 'B', 'C']);
    assert.equal('folder' in byId('B'), false);
    assert.equal(N.folders().length, 1, '둘 남은 폴더는 그대로');
    T.ext['bl-notes'].stickies = { ['f:' + fid]: { x: 10, y: 20, w: 230, h: 0 }, A: { x: 1, y: 1, w: 260, h: 220 } };
    N.__leaveFolder('A');
    assert.deepEqual(ids(), ['D', 'A', 'B', 'C']);
    assert.deepEqual(N.folders(), [], '메모 하나 남은 폴더는 풀린다');
    assert.equal('folder' in byId('D'), false);
    assert.deepEqual(Object.keys(T.ext['bl-notes'].stickies), ['A'], '풀린 폴더의 쪽지 자리만 지운다');
});

await test('폴더: 다른 폴더로 옮기면 남은 폴더가 하나뿐일 때 풀림 · 없는 폴더 id 는 뗌 · 자기 위에 놓기는 폴더 없음 · 폴더 풀기', () => {
    reset([note('p', { folder: 'ghost' }), note('q')]);
    const made = N.__joinFolder({ id: 'p' }, ['q']);
    assert.ok(made && made !== 'ghost', '없는 폴더를 가리키던 메모에 놓으면 새 폴더');
    assert.equal(byId('p').folder, made); assert.equal(byId('q').folder, made);
    assert.deepEqual(N.folders().map(({ id, name }) => ({ id, name })), [{ id: made, name: '' }]);

    reset([note('a1', { folder: 'F1' }), note('a2', { folder: 'F1' }), note('b1', { folder: 'F2' }), note('b2', { folder: 'F2' }), note('x', { folder: 'ghost' })],
        { folders: [{ id: 'F1', name: '하나' }, { id: 'F2', name: '둘' }], stickies: { 'f:F2': { x: 0, y: 0, w: 230, h: 0 } } });
    assert.equal(N.__joinFolder({ folder: 'F1' }, ['b1']), 'F1');
    assert.deepEqual(ids(), ['a1', 'a2', 'b1', 'b2', 'x']);
    assert.deepEqual(N.folders().map(f => f.id), ['F1']);
    assert.equal('folder' in byId('b2'), false); assert.equal('folder' in byId('x'), false);
    assert.equal(T.ext['bl-notes'].stickies['f:F2'], undefined);
    assert.equal(N.__joinFolder({ id: 'x' }, ['x']), null, '자기 위에 놓기');
    assert.deepEqual(N.folders().map(f => f.id), ['F1']);
    assert.equal('folder' in byId('x'), false);
    N.__breakFolder('F1');
    assert.deepEqual(N.folders(), []);
    assert.ok(N.notes().every(n => !('folder' in n)));
});

await test('제목 바꾸기 → 다른 메모의 연결 · 끌어오기 · 별칭 연결도 새 제목 (코드 칸 · 다른 제목은 그대로, 대소문자 무시, 특수 글자 제목)', () => {
    reset([
        note('self', { title: '파도 일지' }),
        note('n2', { body: '오늘은 [[바다 일지]] 를 읽고 ![[ 바다 일지 ]] 도 붙였다.\n[[바다 일지|그 기록]] · `[[바다 일지]]` · [[바다 일지 2]]' }),
        note('n3', { body: '```\n[[바다 일지]]\n```\n끝' }),
        note('n4', { body: '[[harbor log]] 와 [[C++ (초안)]]' }),
        note('n5', { title: 'C++ (완성)' }),
    ]);
    N.__renameLinks('바다 일지', '파도 일지', 'self');
    assert.equal(byId('n2').body, '오늘은 [[파도 일지]] 를 읽고 ![[파도 일지]] 도 붙였다.\n[[파도 일지|그 기록]] · `[[바다 일지]]` · [[바다 일지 2]]');
    assert.ok(byId('n2').updated > 1);
    assert.equal(byId('n3').body, '```\n[[바다 일지]]\n```\n끝', '코드 칸 안은 글자 그대로');
    assert.equal(byId('n3').updated, 1, '안 바뀐 메모는 시각도 그대로');
    assert.ok(T.toasts.some(([kind, text]) => kind === 'info' && text.includes('3곳')), '바꾼 곳 수를 알린다');
    N.__renameLinks('Harbor Log', 'Harbor Notes', 'nobody');
    N.__renameLinks('C++ (초안)', 'C++ (완성)', 'n5');
    assert.equal(byId('n4').body, '[[Harbor Notes]] 와 [[C++ (완성)]]');
});

await test('제목 바꾸기: 같은 옛 제목 메모가 남아 있거나 대소문자만 바뀌면 다른 메모는 그대로', () => {
    reset([note('s', { title: '새 제목' }), note('twin', { title: '옛 제목' }), note('r', { body: '[[옛 제목]] · [[Night Log]]' })]);
    N.__renameLinks('옛 제목', '새 제목', 's');
    N.__renameLinks('Night Log', 'night log', 's');
    assert.equal(byId('r').body, '[[옛 제목]] · [[Night Log]]');
    assert.equal(byId('r').updated, 1);
    assert.equal(T.toasts.length, 0);
});

await test('체크 상자 → 원문 k 번째 체크 줄만 [ ] ↔ [x] (``` · ~~~ 코드 칸 안은 세지 않음, 인용 · 번호 목록 · + 목록 포함, [ ]글자 는 상자 아님)', () => {
    const lines = ['- [ ] 하나', '1. [x] 둘', '> - [ ] 인용 셋', '```', '- [ ] 코드 안', '```', '~~~', '- [ ] 물결 코드', '```', '- [ ] 여전히 코드', '~~~', '* [ ] 넷', '- [ ]붙음', '  + [X] 다섯'];
    const text = lines.join('\n');
    const flip = (k, at, next) => { const want = [...lines]; want[at] = next; assert.equal(N.__toggleTask(text, k), want.join('\n'), `k=${k}`); };
    flip(0, 0, '- [x] 하나');
    flip(1, 1, '1. [ ] 둘');
    flip(2, 2, '> - [x] 인용 셋');
    flip(3, 11, '* [x] 넷');
    flip(4, 13, '  + [ ] 다섯');
    assert.equal(N.__toggleTask(text, 5), text, '없는 번호는 그대로');
    assert.equal(N.__toggleTask(N.__toggleTask(text, 3), 3), text, '두 번 누르면 제자리');
});

console.log(`notes-data: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
