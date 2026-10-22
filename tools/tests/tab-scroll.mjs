import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { revealTab, installTabScroll } = await import(pathToFileURL(path.join(root, 'src/tab-scroll.js')));
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
console.log(`tab-scroll: ${pass} passed`);
