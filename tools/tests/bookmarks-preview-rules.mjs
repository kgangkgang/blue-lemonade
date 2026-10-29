// 북마크: 카드에서 「채팅에서」로 미리보기에 들어갔다가 끝내면 카드 서식 규칙(미리보기 사본 규칙 352개)을 놓아요 (예측점검-애드온 1029).
//   미리보기로 가는 닫기(keepColors)는 규칙을 쥔 채 닫아요. 예전엔 끝낸 뒤에도 다음에 창을 열고 닫을 때까지 켜져 있었어요(글이 붙을 때마다 채팅 전체를 다시 맞춰 봄).
//   네트워크 없음.  node tools/tests/bookmarks-preview-rules.mjs <테마 루트>
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const panelSource = fs.readFileSync(path.join(root, 'src/addons/bookmarks/panel.js'), 'utf8');
const viewersSource = fs.readFileSync(path.join(root, 'src/addons/bookmarks/viewers.js'), 'utf8');
const nodes = new Map();
function node(key) {
    if (!nodes.has(key)) nodes.set(key, { hidden: false, value: '', dataset: {}, style: {}, listeners: {}, addEventListener(k, f) { this.listeners[k] = f; }, focus() {}, setAttribute() {}, classList: { remove() {}, add() {}, toggle() {}, contains() { return false; } }, querySelector: node, querySelectorAll: () => [], replaceChildren() {}, contains() { return true; }, append() {} });
    return nodes.get(key);
}
const shell = node('root');
const timers = [];
const R = { held: 0 };
const owner = { key: 'char:a.png', isGroup: false, name: '가람', avatarUrl: '', character: {} };
const hooks = { syncBookmarks() {}, hideSelectionChip() {} };
const context = {
    console, Map, Set, WeakMap, Date, Promise,
    document: { createElement: () => shell, body: { append() {} }, addEventListener() {}, activeElement: null },
    window: { matchMedia: () => ({ matches: false }) },
    ResizeObserver: class { observe() {} disconnect() {} },
    toastr: { info() {}, warning() {} }, hooks,
    holdPreviewRules() { R.held++; }, releasePreviewRules() { R.held--; }, isPreviewing: () => false, applyTheme() {},
    tileLayouter: () => ({}), iconName: () => '', settings: () => ({}), applyColors() {}, colorsFor() {},
    currentChatKey: () => "1부", getOwner: () => owner, clearHighlights() {},
    currentRecord: () => ({ key: '1부', label: '1부', isCurrent: true, owner, favorites: [], messageCount: 1, lastMes: '' }),
    otherRecord: () => ({}), listOtherChats: async () => [],
    setTimeout: (f) => { timers.push(f); return timers.length; }, clearTimeout() {}, nameAliases: () => [],
};
const plain = panelSource.split('\n').filter(line => !line.startsWith('import ')).join('\n').replace(/^export /gm, '');
vm.runInNewContext(plain + `
renderSidebar=()=>{};renderAll=()=>{};renderMain=()=>{};renderHeader=()=>{};closeSettings=()=>{};closeDrawer=()=>{};
globalThis.api={view,openPanel,closePanel};`, context);
const api = context.api;
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); while (timers.length) timers.shift()(); };
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log('ok', name); }

await check('창 열기 → 미리보기로 닫기(규칙 쥔 채) → 미리보기 끝 → 규칙을 놓아요', async () => {
    await api.openPanel(); await flush();
    assert.equal(R.held, 1);
    api.closePanel({ keepColors: true }); await flush();
    assert.equal(R.held, 1, '미리보기 동안은 쥔 채');
    assert.equal(typeof hooks.previewEnded, 'function', '미리보기가 끝났을 때 부를 고리가 있어야 해요');
    hooks.previewEnded();
    assert.equal(R.held, 0, '창이 닫혀 있으면 놓아요');
    hooks.previewEnded();
    assert.equal(R.held, 0, '두 번 놓지 않아요');
});
await check('미리보기 중에 「북마크 목록」으로 창을 다시 열었으면 끝나도 놓지 않고, 창을 닫을 때 놓아요', async () => {
    await api.openPanel(); await flush();
    api.closePanel({ keepColors: true }); await flush();
    await api.openPanel({ keepState: true }); await flush();
    assert.equal(R.held, 1, '다시 열어도 한 번만 쥐어요');
    hooks.previewEnded();
    assert.equal(R.held, 1, '창이 열려 있으면 그대로');
    api.closePanel(); await flush();
    assert.equal(R.held, 0);
});
await check('배선: 미리보기가 끝나는 두 길(끝내기 · 답 만들기 시작)이 모두 previewEnded 를 불러요', async () => {
    const ends = viewersSource.split('    preview = null;\n').length - 1;
    const calls = viewersSource.split('    preview = null;\n    hooks.previewEnded?.();').length - 1;
    assert.equal(ends, 2); assert.equal(calls, 2);
});
console.log(`bookmarks preview rules: ${passed} passed`);
