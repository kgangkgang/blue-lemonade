// 북마크 창을 연 채 채팅을 바꿀 때 「다른 채팅」 목록 캐시 (예측점검-애드온 1029).
//   ① 다른 캐릭터로 바꾸면 앞 캐릭터의 채팅 목록을 5분 동안 그대로 보여 주던 것 — 캐시 열쇠(owner.key)가 늘 비어 있었어요.
//   ② 같은 캐릭터의 다른 채팅으로 바꾸면 방금 떠난 채팅이 목록에서 빠지던 것 — 떠난 채팅 사진을 새 채팅으로 덮어썼어요.
//   인물 · 채팅 이름은 지어낸 것. 네트워크 없음.  node tools/tests/bookmarks-others-cache.mjs <테마 루트>
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const panelSource = fs.readFileSync(path.join(root, 'src/addons/bookmarks/panel.js'), 'utf8');
const dataSource = fs.readFileSync(path.join(root, 'src/addons/bookmarks/data.js'), 'utf8');

// data.js 의 getOwner 를 그대로 쓴다 (주인 열쇠가 실제로 무엇을 돌려주는지가 이 시험의 핵심)
const T = { ctx: { characters: [], characterId: 0, groupId: null, groups: [] }, chatKey: '', lists: {}, listCalls: [] };
const ownerOf = (() => {
    const m = dataSource.match(/export function getOwner\(\) \{[\s\S]*?\n\}/);
    assert.ok(m, 'data.js 에서 getOwner 를 찾지 못했어요');
    const box = { getContext: () => T.ctx, getThumbnailUrl: (type, file) => `/thumb/${file}` };
    vm.runInNewContext(m[0].replace('export ', '') + '\nthis.getOwner = getOwner;', box);
    return box.getOwner;
})();

const nodes = new Map();
function node(key) {
    if (!nodes.has(key)) nodes.set(key, { hidden: false, value: '', dataset: {}, style: {}, listeners: {}, addEventListener(k, f) { this.listeners[k] = f; }, focus() {}, setAttribute() {}, classList: { remove() {}, add() {}, toggle() {}, contains() { return false; } }, querySelector: node, querySelectorAll: () => [], replaceChildren() {}, contains() { return true; }, append() {} });
    return nodes.get(key);
}
const shell = node('root');
const otherRecord = (owner, key, { favorites = [], messageCount = 0, lastMes = '' } = {}) => ({ key, label: key, isCurrent: false, owner, favorites, messages: null, header: null, loaded: false, messageCount, lastMes });
const favs = new Map();   // 채팅 열쇠 → 북마크
const context = {
    console, Map, Set, WeakMap, Date, Promise,
    document: { createElement: () => shell, body: { append() {} }, addEventListener() {}, activeElement: null },
    window: { matchMedia: () => ({ matches: false }) },
    ResizeObserver: class { observe() {} disconnect() {} },
    toastr: { info() {}, warning() {} },
    hooks: { syncBookmarks() {}, hideSelectionChip() {} },
    holdPreviewRules() {}, releasePreviewRules() {}, isPreviewing: () => false, applyTheme() {},
    tileLayouter: () => ({}), iconName: () => '', settings: () => ({}), applyColors() {}, colorsFor() {},
    currentChatKey: () => T.chatKey,
    getOwner: () => ownerOf(),
    // 현재 채팅 record — 실리태번이 들고 있는 북마크를 getter 로 본다 (data.js currentRecord 와 같은 모양)
    currentRecord: () => { const key = T.chatKey; return key ? { key, label: key, isCurrent: true, owner: ownerOf(), get favorites() { return favs.get(T.chatKey) || []; }, messageCount: 3, lastMes: '' } : null; },
    otherRecord,
    listOtherChats: async owner => { T.listCalls.push(owner.name); return (T.lists[owner.name] || []).filter(key => key !== T.chatKey).map(key => otherRecord(owner, key, { favorites: favs.get(key) || [] })); },
    setTimeout: () => 0, clearTimeout() {}, nameAliases: () => [],
};
const plain = panelSource.split('\n').filter(line => !line.startsWith('import ')).join('\n').replace(/^export /gm, '');
vm.runInNewContext(plain + `
renderSidebar=()=>snapCurrent();closeSettings=()=>{};closeDrawer=()=>{};renderAll=()=>{renderHeader();renderSidebar();};renderMain=()=>{};renderHeader=()=>{};
globalThis.api={view,openPanel,onChatChanged,closePanel};`, context);
const api = context.api;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function setChar(name, avatar) { T.ctx.characters = [{ name, avatar }]; T.ctx.characterId = 0; }
const keys = () => Array.from(api.view.records, record => record.key).sort();
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('ok', name); }

await check('창을 연 채 다른 캐릭터로 바꾸면 그 캐릭터의 다른 채팅을 새로 받아요 (앞 캐릭터 목록을 쓰지 않아요)', async () => {
    favs.clear(); T.listCalls.length = 0;
    favs.set('가람 1부', [{ id: 'a1', messageId: '0' }]); favs.set('가람 2부', [{ id: 'a2', messageId: '1' }]);
    favs.set('누리 1부', [{ id: 'b1', messageId: '0' }]); favs.set('누리 2부', [{ id: 'b2', messageId: '2' }]);
    T.lists = { 가람: ['가람 1부', '가람 2부'], 누리: ['누리 1부', '누리 2부'] };
    setChar('가람', 'garam.png'); T.chatKey = '가람 1부';
    await api.openPanel(); await flush();
    assert.deepEqual(keys(), ['가람 1부', '가람 2부']);
    setChar('누리', 'nuri.png'); T.chatKey = '누리 1부';
    api.onChatChanged(); await flush();
    assert.deepEqual(T.listCalls, ['가람', '누리'], '두 번째 캐릭터의 목록을 받아야 해요');
    assert.deepEqual(keys(), ['누리 1부', '누리 2부']);
    assert.ok(api.view.records.every(record => record.owner.name === '누리'), '목록의 주인이 모두 지금 캐릭터');
    api.closePanel();
});

await check('창을 연 채 같은 캐릭터의 다른 채팅으로 바꾸면 방금 떠난 채팅도 목록에 남아요 (목록은 다시 받지 않아요)', async () => {
    favs.clear(); T.listCalls.length = 0;
    favs.set('가람 1부', [{ id: 'a1', messageId: '0' }]); favs.set('가람 2부', [{ id: 'a2', messageId: '1' }]); favs.set('가람 3부', [{ id: 'a3', messageId: '4' }]);
    T.lists = { 가람: ['가람 1부', '가람 2부', '가람 3부'] };
    setChar('가람', 'garam.png'); T.chatKey = '가람 1부';
    await api.openPanel(); await flush();
    assert.deepEqual(keys(), ['가람 1부', '가람 2부', '가람 3부']);
    T.chatKey = '가람 2부';
    api.onChatChanged(); await flush();
    assert.deepEqual(T.listCalls, ['가람'], '같은 캐릭터면 캐시를 써요');
    assert.deepEqual(keys(), ['가람 1부', '가람 2부', '가람 3부'], '떠난 1부가 목록에 있어야 해요');
    const left = api.view.records.find(record => record.key === '가람 1부');
    assert.equal(left.isCurrent, false);
    assert.deepEqual(Array.from(left.favorites, f => f.id), ['a1'], '떠난 채팅 칸에는 그 채팅의 북마크(새 채팅 것이 아님)');
    api.closePanel();
});

console.log(`bookmarks others cache: ${passed} passed`);
