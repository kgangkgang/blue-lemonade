// 6.4.5 성능 고침 묶음 — ① dem-selection 길게 누를 때만 멈춤 (가짜 문서 · 진짜 타이머) · ③ ④ ⑤ 연결 줄. 지어낸 것만.
//   node tools/tests/perf-bundle-645.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ── 가짜 문서: 채팅 칸 하나 · 효과 글 하나 · 선택은 바꿔 끼운다
const listeners = [];
let toggles = 0, selection = { rangeCount: 0 };
const chatRoot = { parentElement: { closest: () => null }, attrs: new Set(),
    toggleAttribute(n, on) { if (on && !this.attrs.has(n)) { this.attrs.add(n); toggles++; } else if (!on && this.attrs.has(n)) { this.attrs.delete(n); toggles++; } },
    removeAttribute(n) { if (this.attrs.delete(n)) toggles++; } };
const textEl = { nodeType: 1, closest: () => chatRoot };
globalThis.document = {
    activeElement: null,
    body: { classList: { contains: () => false }, toggleAttribute() {}, querySelectorAll: () => [chatRoot], contains: () => true },
    getElementsByClassName: () => ({ length: 1 }),
    getSelection: () => selection,
    addEventListener: (type, fn) => listeners.push([type, fn]),
    removeEventListener: (type, fn) => { const i = listeners.findIndex(([t, f]) => t === type && f === fn); if (i >= 0) listeners.splice(i, 1); },
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
const fire = (type, event = {}) => { for (const [t, fn] of listeners) if (t === type) fn({ button: 0, target: textEl, pointerId: 1, clientX: 100, clientY: 100, ...event }); };
const paused = () => chatRoot.attrs.has('data-bl-dem-paused');
const D = await import(pathToFileURL(path.join(themeRoot, 'src/dem-selection.js')).href);
D.syncDemSelection(true);

await test('① 짧은 탭 · 스크롤(pointercancel)은 멈추지 않는다 — 채팅 칸 속성 토글 0번', async () => {
    toggles = 0;
    fire('pointerdown'); await wait(80); fire('pointerup'); await wait(450);
    fire('pointerdown'); await wait(80); fire('pointercancel'); await wait(450);
    assert.equal(toggles, 0); assert.equal(paused(), false);
});
await test('① 누른 채 10 px 넘게 움직이면(느린 끌기 · pointercancel 이 늦음) 멈추지 않는다 — 작은 떨림(5 px)은 길게 누르기로 본다', async () => {
    toggles = 0;
    fire('pointerdown'); await wait(100); fire('pointermove', { clientY: 130 }); await wait(400);
    assert.equal(paused(), false, 'moved away: no pause'); fire('pointerup'); await wait(300);
    fire('pointerdown'); await wait(100); fire('pointermove', { clientX: 104, clientY: 103 }); await wait(300);
    assert.equal(paused(), true, 'a little jitter still counts as a long press');
    fire('pointerup'); await wait(350); assert.equal(paused(), false);
    fire('pointerdown', { pointerId: 1 }); fire('pointermove', { pointerId: 2, clientY: 300 }); await wait(400);
    assert.equal(paused(), true, 'another pointer moving does not cancel'); fire('pointerup'); await wait(350);
});
await test('① 길게 누르면(350 ms) 멈추고, 떼면 250 ms 뒤 풀린다', async () => {
    toggles = 0;
    fire('pointerdown'); await wait(200); assert.equal(paused(), false, 'not yet');
    await wait(250); assert.equal(paused(), true, 'long press pauses');
    fire('pointerup'); await wait(100); assert.equal(paused(), true, 'stays a moment (Android long-press selection)');
    await wait(300); assert.equal(paused(), false, 'released');
    assert.equal(toggles, 2);
});
await test('① 멈춘 채(뗀 뒤 250 ms 안) 다시 짧게 누르면 그대로 이어 가고, 뗀 뒤 풀린다 (누름 상태가 남지 않는다)', async () => {
    fire('pointerdown'); await wait(420); assert.equal(paused(), true);
    fire('pointerup'); await wait(100);
    fire('pointerdown'); await wait(60); fire('pointerup');
    assert.equal(paused(), true);
    await wait(400); assert.equal(paused(), false);
});
await test('① 마우스로 끌어 고르면 첫 selectionchange 에서 멈춘다 (선택 중 멈춤은 예전과 같다)', async () => {
    fire('pointerdown');
    selection = { rangeCount: 1, getRangeAt: () => ({ collapsed: false }), anchorNode: textEl, focusNode: textEl };
    fire('selectionchange'); assert.equal(paused(), true, 'paused by the selection');
    selection = { rangeCount: 0 };
    fire('pointerup'); fire('selectionchange'); await wait(100);
    assert.equal(paused(), false);
});
D.syncDemSelection(false);

await test('③ ④ ⑤ 연결 줄 · CI 등록', () => {
    const dir = read('src/addons/direction/index.js');
    assert.match(dir, /const headSheets = \(\) => document\.head\.querySelectorAll\('style, link\[rel~="stylesheet"\]'\)\.length;/);
    assert.match(dir, /document\.body\.classList\.contains\('salty-dark'\), headSheets\(\)\]\.join\('\|'\);/);
    assert.ok(!/document\.styleSheets\.length\]/.test(dir), '③ the cheap signature no longer counts every sheet');
    assert.match(read('src/headswitch.js'), /b\.closest\('\.drawer-content'\)\?\.classList\.contains\('openDrawer'\) === false\) return; if \(b\.offsetParent !== null\) sync\(\);/);
    assert.match(read('src/addons/translator/selection/translation.js'), /if \(!selected\?\.rangeCount \|\| selected\.getRangeAt\(0\)\.collapsed\) return null;/);
    assert.match(read('src/addons/bookmarks/selection-chip.js'), /selection\.rangeCount !== 1 \|\| selection\.getRangeAt\(0\)\.collapsed\) return null;/);
    assert.match(read('src/dem-selection.js'), /selection\.rangeCount > 0 && !selection\.getRangeAt\(0\)\.collapsed &&/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/perf-bundle-645\.mjs \./);
});

console.log(`perf-bundle-645: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
