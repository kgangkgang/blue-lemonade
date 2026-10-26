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
console.log(`탭 스크롤: ${pass}개 통과했어요.`);
