// 8.2.4 사후 검토(review-824): 아바타 지연(src/lazy-avatars.js) — 목록을 다시 그릴 때 빠진 그림을 붙들고 있지 않는지 · 다시 붙은 그림이 빈칸으로 남지 않는지.
// 실리태번 printCharacters 는 검색 · 정렬 · 태그 필터 · 쪽 넘김마다 $(목록).empty() 뒤 새 복제본을 붙여요.
// 고치기 전: 화면 밖이라 자리표시로 바꿔 둔 그림이 빠져도 pending(Set) · IntersectionObserver 에 남아 다시 그릴 때마다 쌓였어요(끌 때까지).
//   node tools/tests/lazy-avatars-detach.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

// ---- 작은 DOM 흉내 (붙어 있는지 = 부모를 따라 body 에 닿는지)
let body = null;
function el(tag, { id = '', cls = '', attrs = {} } = {}, children = []) {
    const node = {
        nodeType: 1, tag, id, classes: cls.split(' ').filter(Boolean), attrs: { ...attrs }, dataset: {}, children: [], parent: null, complete: false, naturalWidth: 0,
        get isConnected() { for (let p = node; p; p = p.parent) if (p === body) return true; return false; },
        get classList() { return { contains: c => node.classes.includes(c) }; },
        getAttribute(k) { return k in node.attrs ? node.attrs[k] : null; },
        setAttribute(k, v) { node.attrs[k] = String(v); },
        removeAttribute(k) { delete node.attrs[k]; },
        matches(sel) { return sel.split(',').some(s => s.trim() === tag); },
        querySelectorAll(sel) { return sel.trim() === '.avatar img' ? all(node).filter(c => c.tag === 'img' && c.parent?.classes.includes('avatar')) : []; },
        querySelector() { return null; },
    };
    for (const c of children) { c.parent = node; node.children.push(c); }
    return node;
}
const all = (node, out = []) => { for (const c of node.children) { out.push(c); all(c, out); } return out; };
const block = src => el('div', { cls: 'character_select' }, [el('div', { cls: 'avatar' }, [el('img', { attrs: { src, loading: 'lazy' } })])]);
const imgOf = b => b.children[0].children[0];

const list = el('div', { id: 'rm_print_characters_block' });
body = el('body', {}, [list]);
globalThis.document = { body, getElementById: id => (id === list.id ? list : null), querySelectorAll: () => [] };

const ios = [], mos = [];
class FakeIO { constructor(cb) { this.cb = cb; this.targets = new Set(); ios.push(this); } observe(x) { this.targets.add(x); } unobserve(x) { this.targets.delete(x); } disconnect() { this.targets.clear(); } seen(x) { this.cb([{ target: x, isIntersecting: true }]); } }
class FakeMO { constructor(cb) { this.cb = cb; mos.push(this); } observe(x) { this.target = x; } disconnect() {} }
globalThis.IntersectionObserver = FakeIO; globalThis.MutationObserver = FakeMO;
const mo = () => mos.find(m => m.target === list);

/** 실리태번처럼: 비우고 새 블록을 붙인 뒤 감시자 콜백 한 번 */
function render(blocks) {
    const removed = list.children.splice(0);
    for (const r of removed) r.parent = null;
    for (const b of blocks) { b.parent = list; list.children.push(b); }
    mo().cb([{ removedNodes: removed, addedNodes: [] }, { removedNodes: [], addedNodes: blocks }]);
}

const la = await import(pathToFileURL(path.join(root, 'src/lazy-avatars.js')));
la.syncLazyAvatars(true);
const io = ios.at(-1);

const first = Array.from({ length: 5 }, (_, i) => block(`/thumbnail?type=avatar&file=a${i}.png`));
render(first);
t('처음 그린 화면 밖 그림 5개는 자리표시 · 관찰 중', () => {
    assert.equal(la._forTest.state().pending, 5);
    for (const b of first) assert.equal(imgOf(b).getAttribute('src'), la.PLACEHOLDER);
});
for (let round = 0; round < 20; round++) render(Array.from({ length: 5 }, (_, i) => block(`/thumbnail?type=avatar&file=r${round}-${i}.png`)));
t('검색 · 정렬로 20번 다시 그려도 붙들고 있는 그림은 지금 목록의 5개뿐 (고치기 전 105개)', () => {
    assert.equal(la._forTest.state().pending, 5);
    assert.equal(io.targets.size, 5);
    for (const x of io.targets) assert.equal(x.isConnected, true);
});

// 같은 블록을 떼었다가 다시 붙이는 경우(다른 확장 · 앞으로의 실리태번) — 빈칸으로 남으면 안 돼요
const moved = block('/thumbnail?type=avatar&file=moved.png');
render([moved]);
render([]);
t('떼어 낸 그림은 관찰을 풀지만 원래 주소(data-bl-src)는 남겨요', () => {
    assert.equal(la._forTest.state().pending, 0);
    assert.equal(io.targets.has(imgOf(moved)), false);
    assert.equal(imgOf(moved).dataset.blSrc, '/thumbnail?type=avatar&file=moved.png');
});
render([moved]);
t('다시 붙으면 다시 관찰하고, 가까워지면 원래 주소로 돌아와요', () => {
    assert.equal(io.targets.has(imgOf(moved)), true);
    io.seen(imgOf(moved));
    assert.equal(imgOf(moved).getAttribute('src'), '/thumbnail?type=avatar&file=moved.png');
    assert.equal(la._forTest.state().pending, 0);
});
t('끄면 남은 자리표시는 모두 원래대로', () => {
    const last = Array.from({ length: 3 }, (_, i) => block(`/thumbnail?type=avatar&file=z${i}.png`));
    render(last);
    la.syncLazyAvatars(false);
    for (const b of last) assert.equal(imgOf(b).getAttribute('src'), imgOf(b).dataset.blSrc ?? imgOf(b).getAttribute('src'));
    for (const b of last) assert.notEqual(imgOf(b).getAttribute('src'), la.PLACEHOLDER);
});
console.log(`PASS lazy-avatars-detach: ${n} checks`);
