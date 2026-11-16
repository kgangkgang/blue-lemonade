// 버그 사냥 2차 (북마크 창 · 가상 자료 · 네트워크 없음)
//   ① 카드에서 마지막 그림을 떼면 그림으로만 생긴 북마크가 통째로 지워지는데, 왼쪽 목록 개수와 채팅 메시지의 별 아이콘을 안 고쳤어요(별이 채워진 채 남음).
//   ② 쪽 번호 칸에 범위 밖 숫자(99)를 넣으면 지금 쪽으로 잘린 뒤 그냥 돌아가, 칸이 「99 / 5」로 남았어요.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const panelSource = fs.readFileSync(path.join(root, 'src/addons/bookmarks/panel.js'), 'utf8');
const nodes = new Map();
function node(key) {
    if (!nodes.has(key)) nodes.set(key, { hidden: false, value: '', dataset: {}, style: {}, scrollTop: 0, innerHTML: '', listeners: {}, addEventListener(k, f) { this.listeners[k] = f; }, focus() {}, select() {}, blur() {}, setAttribute() {}, closest() { return this; }, classList: { remove() {}, add() {}, toggle() {}, contains() { return false; } }, querySelector: node, querySelectorAll: () => [] });
    return nodes.get(key);
}
const calls = [];
const T = { removeResult: { removed: true, bookmark: false } };
const record = { key: '합성 채팅', isCurrent: true, favorites: [{ id: 'f1', messageId: '3', images: [{ src: '/img/a.png' }] }] };
const context = {
    console, Map, Set, WeakMap, Date, Promise, Number, String, Math, Array, Object, CSS: { escape: s => s },
    document: { createElement: () => node('made'), body: { append() {} }, addEventListener() {}, activeElement: null },
    window: { matchMedia: () => ({ matches: false }) }, location: { origin: 'https://fixture.invalid' },
    ResizeObserver: class { observe() {} disconnect() {} },
    toastr: { info() {}, warning() {}, error() {}, success() {} },
    hooks: { syncBookmarks() {}, hideSelectionChip() {}, refreshMessageIcons() { calls.push('icons'); } },
    confirmSheet: async () => true,
    removeImageFrom: async () => T.removeResult,
    findBookmark: (rec, id) => rec.favorites.find(f => f.id === id) ?? null,
    setTimeout: () => 0, clearTimeout() {}, nameAliases: () => [],
    holdPreviewRules() {}, releasePreviewRules() {}, isPreviewing: () => false, applyTheme() {},
    tileLayouter: () => ({}), iconName: () => '', settings: () => ({}), applyColors() {}, colorsFor() {}, currentChatKey: () => '합성 채팅',
};
const plain = panelSource.split('\n').filter(line => !line.startsWith('import ')).join('\n').replace(/^export /gm, '');
vm.runInNewContext(plain + `
view.root = document.createElement('div'); view.open = true;
selectedRecord = () => globalThis.__record;
renderSidebar = () => { globalThis.__calls.push('sidebar'); };
renderMain = () => { globalThis.__calls.push('main'); };
rerenderCard = () => { globalThis.__calls.push('card'); };
const __realPager = renderPager; renderPager = (total) => { globalThis.__calls.push('pager'); };
globalThis.api = { view, onCardAction, goToPage };`, Object.assign(context, { __record: record, __calls: calls }));
const api = context.api;
let passed = 0;
async function check(name, fn) { calls.length = 0; await fn(); passed++; console.log('ok', name); }
const card = { dataset: { index: '0', favId: 'f1' } };
const el = { closest: () => ({ dataset: { imageSrc: '/img/a.png' } }) };

await check('마지막 그림을 떼어 북마크가 사라지면 왼쪽 목록 · 메시지 별 아이콘도 고쳐요', async () => {
    T.removeResult = { removed: true, bookmark: false };
    await api.onCardAction('image-remove', card, el);
    assert.ok(calls.includes('sidebar'), '왼쪽 목록 개수');
    assert.ok(calls.includes('icons'), '메시지 별 아이콘');
    assert.ok(calls.includes('main'), '카드 목록을 다시 그려요(사라진 카드)');
});
await check('그림만 하나 뗀 것(북마크는 남음)은 그 카드만 다시 그려요', async () => {
    T.removeResult = { removed: true, bookmark: true };
    await api.onCardAction('image-remove', card, el);
    assert.deepEqual(calls, ['card']);
});
await check('범위 밖 쪽 번호는 쪽 줄을 다시 그려 칸을 되돌려요', async () => {
    nodes.get('.cg-pager') ?? node('.cg-pager'); node('.cg-pager').dataset.total = '5';
    api.view.page = 5;
    api.goToPage(99);
    assert.equal(api.view.page, 5);
    assert.deepEqual(calls, ['pager'], '같은 쪽이어도 쪽 줄은 다시 그려요(입력 칸이 남지 않게)');
});
console.log(`bookmarks-panel-refresh: ${passed} passed`);
