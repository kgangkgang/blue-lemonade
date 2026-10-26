import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(process.argv[2] || '.');
let next = 0, observer, reads = 0;
const frames = new Map(), listeners = {};
const style = {
    values: new Map([['padding-top', ['8px', '']], ['padding-bottom', ['8px', '']]]),
    getPropertyValue(p) { return this.values.get(p)?.[0] || ''; },
    getPropertyPriority(p) { return this.values.get(p)?.[1] || ''; },
    setProperty(p, v, priority) { this.values.set(p, [v, priority]); },
    removeProperty(p) { this.values.delete(p); },
};
const control = { textContent: 'ABC', style, closest: () => null, matches: () => false, querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 0, bottom: 44, width: 80, height: 44 }) };
const node = { textContent: 'ABC', parentElement: control };
const panel = { isConnected: true, hidden: false, contains: e => e === panel || e === nested,
    getClientRects() { return this.hidden ? [] : [{}]; }, checkVisibility: () => true,
    querySelectorAll() { reads++; return [control]; } };
const nested = { ...panel, contains: e => e === nested };
const fontEvents = {}, winEvents = {};
const context2d = { measureText: () => ({ fontBoundingBoxAscent: 14, width: 60, actualBoundingBoxLeft: 0, actualBoundingBoxAscent: 40, actualBoundingBoxDescent: 0 }),
    fillText() {}, getImageData() { const data = new Uint8ClampedArray(76 * 56 * 4); for (let y = 8; y < 48; y++) data[(y * 76 + 8) * 4 + 3] = 255; return { data }; } };
const document = {
    body: {}, fonts: { addEventListener: (k, f) => { fontEvents[k] = f; } },
    querySelectorAll: () => [panel, nested],
    createElement: () => ({ width: 76, height: 56, getContext: () => context2d }),
    createTreeWalker: () => { let once = false; return { nextNode: () => once ? null : (once = true, node) }; },
    createRange: () => ({ selectNodeContents() {}, getClientRects: () => [{ width: 40, height: 14, top: 10 + parseFloat(style.getPropertyValue('padding-top')) - 8 }] }),
};
const css = { fontStyle: 'normal', fontWeight: '400', fontSize: '14px', fontFamily: 'sans-serif', letterSpacing: 'normal', visibility: 'visible', writingMode: 'horizontal-tb', borderTopWidth: '0', borderBottomWidth: '0' };
const sandbox = {
    document, window: { addEventListener: (k, f) => { winEvents[k] = f; } }, NodeFilter: { SHOW_TEXT: 4 },
    getComputedStyle: (el, pseudo) => pseudo ? { position: 'absolute', content: 'none' } : { ...css, paddingTop: style.getPropertyValue('padding-top'), paddingBottom: style.getPropertyValue('padding-bottom') },
    MutationObserver: class { constructor(fn) { this.callback = fn; observer = this; } observe(_, options) { this.active = true; this.options = options; } disconnect() { this.active = false; } },
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id),
    console, Uint8ClampedArray,
};
const code = fs.readFileSync(path.join(root, 'src/control-ink.js'), 'utf8').replace('export function syncControlInk', 'function syncControlInk');
vm.createContext(sandbox); vm.runInContext(code + '\nthis.sync = syncControlInk;', sandbox);
const flush = () => { const jobs = [...frames.values()]; frames.clear(); jobs.forEach(f => f()); };
let count = 0; const test = (name, fn) => { fn(); console.log('PASS', name); count++; };
test('nested roots share one scheduled scan', () => { sandbox.sync(true, 'font-a'); assert.equal(frames.size, 1); flush(); assert.equal(reads, 1); });
test('redistribution preserves padding sum and changes actual baseline', () => { assert.equal(parseFloat(style.getPropertyValue('padding-top')) + parseFloat(style.getPropertyValue('padding-bottom')), 16); assert.notEqual(style.getPropertyValue('padding-top'), '8px'); });
test('unchanged appearance does not schedule work', () => { sandbox.sync(true, 'font-a'); assert.equal(frames.size, 0); });
test('unrelated chat streaming does not discover or scan panels', () => { for (let i = 0; i < 200; i++) observer.callback([{ target: { nodeType: 1, closest: sel => sel.includes('#chat') ? {} : null }, addedNodes: [{ nodeType: 1, matches() { throw Error('chat discovery'); } }] }]); assert.equal(frames.size, 0); assert.equal(reads, 1); });
test('text changes outside controls (slider readouts) do not rescan; changes inside or adding controls do', () => { panel.hidden = true; const outside = { nodeType: 1, closest: sel => sel.includes('#chat') ? null : sel.includes('button') && !sel.includes('salty-panel') ? null : panel }; observer.callback([{ type: 'childList', target: outside, addedNodes: [{ nodeType: 1, matches: () => false, querySelector: () => null, querySelectorAll: () => [] }] }, { type: 'characterData', target: { nodeType: 3, parentElement: outside } }]); assert.equal(frames.size, 0); const inside = { nodeType: 1, closest: sel => sel.includes('#chat') ? null : sel.includes('button') && !sel.includes('salty-panel') ? control : panel }; observer.callback([{ type: 'characterData', target: { nodeType: 3, parentElement: inside } }]); assert.equal(frames.size, 1); flush(); observer.callback([{ type: 'childList', target: outside, addedNodes: [{ nodeType: 1, matches: () => false, querySelector: () => control, querySelectorAll: () => [] }] }]); assert.equal(frames.size, 1); flush(); panel.hidden = false; });
test('hidden root is skipped before control collection', () => { panel.hidden = true; sandbox.sync(true, 'font-b'); flush(); assert.equal(reads, 1); panel.hidden = false; });
test('font loading and resize coalesce; style writes cannot feed back', () => { fontEvents.loadingdone(); winEvents.resize(); assert.equal(frames.size, 1); flush(); assert.equal(reads, 2); assert.ok(!observer.options.attributeFilter.includes('style')); });
test('disable cancels queued work, disconnects, and restores inline priorities', () => { winEvents.resize(); sandbox.sync(false); assert.equal(frames.size, 0); assert.equal(observer.active, false); assert.equal(style.getPropertyValue('padding-top'), '8px'); assert.equal(style.getPropertyValue('padding-bottom'), '8px'); assert.equal(style.getPropertyPriority('padding-top'), ''); fontEvents.loadingdone(); assert.equal(frames.size, 0); });
test('reenable resumes once without adding more listeners', () => { sandbox.sync(true, 'font-a'); flush(); assert.equal(observer.active, true); assert.deepEqual(Object.keys(fontEvents), ['loadingdone']); assert.deepEqual(Object.keys(winEvents), ['resize']); });
test('7.8.5 font loading only realigns visible roots that use the loaded family', () => { flush(); const before = reads; fontEvents.loadingdone({ fontfaces: [{ family: '"Unrelated Font"' }] }); assert.equal(frames.size, 0, 'unrelated font: no rescan'); fontEvents.loadingdone({ fontfaces: [{ family: 'sans-serif' }] }); assert.equal(frames.size, 1); flush(); assert.equal(reads, before + 1); panel.hidden = nested.hidden = true; const hiddenBefore = reads; fontEvents.loadingdone({ fontfaces: [{ family: 'sans-serif' }] }); flush(); assert.equal(reads, hiddenBefore, 'hidden root: controls are not collected'); panel.hidden = nested.hidden = false; });
console.log(`control-ink: ${count} passed`);
