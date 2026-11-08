import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { revealTab, installTabScroll, fadeState, applyFade } = await import(pathToFileURL(path.join(root, 'src/tab-scroll.js')));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const strip = (extra = {}) => ({ clientWidth: 100, scrollWidth: 300, clientLeft: 2, scrollLeft: 40,
    getBoundingClientRect: () => ({ left: 10, right: 114, width: 104 }), ...extra });
const tab = (left, width) => ({ getBoundingClientRect: () => ({ left, right: left + width, width }) });
test('visible tab leaves its strip and ancestors unchanged', () => { const b = strip(); revealTab(b, tab(30, 40)); assert.equal(b.scrollLeft, 40); });
test('right edge moves only the necessary horizontal distance', () => { const b = strip(); revealTab(b, tab(100, 40)); assert.equal(b.scrollLeft, 68); });
test('left edge respects the scrollport border', () => { const b = strip(); revealTab(b, tab(0, 40)); assert.equal(b.scrollLeft, 28); });
test('oversized label reveals its beginning instead of oscillating', () => { const b = strip(); revealTab(b, tab(80, 180)); assert.equal(b.scrollLeft, 108); });
test('hidden strip and nonoverflowing strip do not scroll', () => { for (const extra of [{ clientWidth: 0 }, { scrollWidth: 100 }]) { const b = strip(extra); revealTab(b, tab(180, 40)); assert.equal(b.scrollLeft, 40); } });
test('missing tab is safe during replacement', () => { revealTab(null, tab(0, 10)); revealTab(strip(), null); installTabScroll([], null); });
test('navigation CSS does not change font, control height, or form grids', () => {
    const css = fs.readFileSync(path.join(root, 'css/98-tab-strips.css'), 'utf8');
    assert.doesNotMatch(css, /(?:font(?:-size|-family|-weight)?|(?:min-)?height)\s*:/);
    assert.doesNotMatch(css, /bwr_segment|pt-params-wrap|eh-preset-chips|llmt-gl-scopes|bl-look-fonttags/);
});
// 7.7.9 edge fades: only when overflowing, only the side that hides more
test('fade state names the overflowing side only', () => {
    assert.equal(fadeState(strip({ scrollLeft: 0 })), 'right');
    assert.equal(fadeState(strip({ scrollLeft: 40 })), 'both');
    assert.equal(fadeState(strip({ scrollLeft: 200 })), 'left');
    assert.equal(fadeState(strip({ scrollWidth: 100 })), '');
    assert.equal(fadeState(strip({ clientWidth: 0 })), '');
    assert.equal(fadeState(null), '');
});
test('applyFade writes data-bl-fade and removes it when the strip fits', () => {
    const b = strip({ scrollLeft: 0, dataset: {} }); assert.equal(applyFade(b), 'right'); assert.equal(b.dataset.blFade, 'right');
    b.scrollWidth = 100; assert.equal(applyFade(b), ''); assert.equal('blFade' in b.dataset, false);
});
test('fade CSS only masks edges by data attribute', () => {
    const css = fs.readFileSync(path.join(root, 'css/98-tab-strips.css'), 'utf8');
    for (const side of ['left', 'right', 'both']) assert.ok(css.includes(`[data-bl-fade="${side}"]`), side);
    assert.match(css, /mask-image: linear-gradient/);
});
test('흐림을 지정한 줄의 포커스 탭은 가장자리 28px 안쪽까지 보여요', () => {
    const b = strip({ ownerDocument:{defaultView:{getComputedStyle:()=>({getPropertyValue:()=> '28px'})}} });
    revealTab(b, tab(80, 30)); assert.equal(b.scrollLeft, 66);
    revealTab(b, tab(20, 30)); assert.equal(b.scrollLeft, 46);
});
test('흐림 여백보다 넓은 탭도 반대 방향으로 흔들리지 않아요', () => {
    const b = strip({ ownerDocument:{defaultView:{getComputedStyle:()=>({getPropertyValue:()=> '28px'})}} });
    revealTab(b, tab(80, 180)); assert.equal(b.scrollLeft, 108);
});
test('독립 공통 스타일도 기존 방향 표식의 세 흐림을 제공해요', () => {
    const css = fs.readFileSync(path.join(root,'src/tab-scroll.css'),'utf8');
    for (const side of ['left','right','both']) assert.ok(css.includes(`[data-bl-fade="${side}"]`));
    assert.match(css,/--bl-tab-reveal-inset:var\(--bl-fade\)/);
    assert.doesNotMatch(css,/pointer-events|z-index|::before|::after|overflow\s*:/);
});
// 1.0.9 공용 모듈 약속(tab-scroll v1): 스타일 링크는 문서마다 하나 · 등록부가 있으면 줄만 보탬
const fakeDoc = pre => {
    const made = [];
    class MO { observe() {} disconnect() {} takeRecords() { return []; } }
    const el = () => ({ nodeType: 1, append() {}, appendChild() {}, querySelectorAll: () => [], matches: () => false, closest: () => null, children: [], dataset: {}, addEventListener() {} });
    const de = el(), head = el(); head.append = n => made.push(n);
    const win = { MutationObserver: MO, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, setTimeout: () => 0, clearTimeout() {}, AbortController };
    const doc = { documentElement: de, head, body: el(), defaultView: win, listeners: 0,
        getElementById: id => pre === 'id' && id === 'bl-tab-scroll-style' ? {} : null,
        querySelector: s => pre === 'data' && s === 'link[data-bl-tab-scroll]' ? {} : null,
        querySelectorAll: () => [], createElement: () => ({ dataset: {} }), addEventListener() { doc.listeners++; } };
    de.ownerDocument = doc; win.document = doc;
    return { doc, made };
};
test('1.0.9 공용 약속: 링크가 없을 때만 넣고(id · data-bl-tab-scroll · 주인 표시) · id 든 data 표시든 먼저 있으면 그것을 같이 써요', () => {
    const none = fakeDoc('none'); installTabScroll(['.x'], none.doc);
    assert.equal(none.made.length, 1);
    assert.equal(none.made[0].id, 'bl-tab-scroll-style');
    assert.deepEqual({ ...none.made[0].dataset }, { blTabScroll: 'v1', blOwner: 'blue-lemonade', blVer: '1' });
    for (const pre of ['id', 'data']) { const d = fakeDoc(pre); installTabScroll(['.x'], d.doc); assert.equal(d.made.length, 0, pre); }
});
test('1.0.9 공용 약속: 등록부가 이미 있으면 새 감시 · 리스너 · 링크 없이 .add 만', () => {
    const d = fakeDoc('none'), got = [];
    d.doc[Symbol.for('blue-lemonade.tab-scroll.v1')] = { owner: 'other-ext', ver: 1, add: list => got.push(...list) };
    installTabScroll(['.a', '.b'], d.doc);
    assert.deepEqual(got, ['.a', '.b']); assert.equal(d.made.length, 0); assert.equal(d.doc.listeners, 0);
    const own = fakeDoc('none'); installTabScroll(['.x'], own.doc);
    const reg = own.doc[Symbol.for('blue-lemonade.tab-scroll.v1')];
    assert.equal(reg.owner, 'blue-lemonade'); assert.equal(reg.ver, 1); assert.equal(typeof reg.add, 'function');
    const n = own.doc.listeners; installTabScroll(['.y'], own.doc); assert.equal(own.doc.listeners, n, '두 번째 부름은 리스너를 더 걸지 않음');
});
console.log(`탭 스크롤: ${pass}개 통과했어요.`);
