// 8.2.6 성능: src/preview-view.js 가 미리보기 칸 여러 개를 한 프레임에 모아 「모두 읽고 → 모두 쓰고 → 그리기」로 재는지 —
//   강제 배치(높이를 쓴 뒤 크기를 다시 읽기)가 칸 수만큼 늘지 않고, 높이 · 이동 값은 칸 하나씩 잴 때와 같은지 (가짜 DOM · 가짜 배치)
//   node tools/tests/preview-measure-batch.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

// ── 가짜 배치: 높이(height)를 쓰면 배치가 더러워지고, 더러운 채로 크기를 읽으면 강제 배치 한 번 ──
let dirty = true, flushes = 0;
const layoutRead = v => { if (dirty) { flushes++; dirty = false; } return v; };
class Style { constructor() { this._h = ''; this.transform = ''; } get height() { return this._h; } set height(v) { if (v !== this._h) { this._h = v; dirty = true; } } }
class El {
    constructor(tag, attrs = {}) {
        this.localName = tag; this.attrs = { ...attrs }; this.children = []; this.parentElement = null; this.style = new Style(); this.dataset = {}; this.listeners = {}; this.hidden = false; this.disabled = false; this.textContent = '';
        const cls = () => String(this.attrs.class || '').split(/\s+/).filter(Boolean);
        this.classList = { contains: c => cls().includes(c), add: c => { if (!cls().includes(c)) this.attrs.class = [...cls(), c].join(' '); }, remove: c => { this.attrs.class = cls().filter(x => x !== c).join(' '); }, toggle() {} };
        this.sceneSize = null;   // 장면(.bl-view-scene) 크기 — 첫 아이의 크기를 따라요
    }
    set className(v) { this.attrs.class = v; } get className() { return this.attrs.class || ''; }
    set tabIndex(v) { this.attrs.tabindex = String(v); }
    set type(v) { this.attrs.type = v; }
    set innerHTML(html) { this.children = []; const stack = [this]; for (const m of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>/g)) { if (m[1]) { stack.pop(); continue; } const attrs = {}; for (const a of m[3].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2]; const el = new El(m[2], attrs); stack.at(-1).append(el); stack.push(el); } }
    get isConnected() { let n = this; while (n.parentElement) n = n.parentElement; return n === docRoot; }
    get firstElementChild() { return this.children[0] || null; }
    get lastElementChild() { return this.children.at(-1) || null; }
    append(...nodes) { for (const n of nodes) { if (n.parentElement) n.parentElement.children = n.parentElement.children.filter(x => x !== n); n.parentElement = this; this.children.push(n); } dirty = true; }
    prepend(n) { if (n.parentElement) n.parentElement.children = n.parentElement.children.filter(x => x !== n); n.parentElement = this; this.children.unshift(n); dirty = true; }
    setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); } removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter(f => f !== fn); }
    dispatch(t) { for (const fn of this.listeners[t] || []) fn({}); }
    one(sel) { return sel.split(',').map(s => s.trim()).some(s => s.startsWith('.') ? this.classList.contains(s.slice(1)) : s.startsWith('[') ? s.slice(1, -1) in this.attrs : s === this.localName); }
    matches(sel) { return this.one(sel); }
    querySelectorAll(sel) { const out = []; const walk = e => { for (const c of e.children) { if (c.one(sel)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    setPointerCapture() {}
    get offsetWidth() { return layoutRead(this.classList.contains('bl-view-scene') ? (this.children[0]?.size?.[0] || 0) : this.hidden ? 0 : 30); }
    get offsetHeight() { return layoutRead(this.classList.contains('bl-view-scene') ? (this.children[0]?.size?.[1] || 0) : this.hidden ? 0 : 30); }
    get clientWidth() { return layoutRead(this.classList.contains('bl-view-port') ? 280 : 300); }
    get clientHeight() { return layoutRead(this.classList.contains('bl-editor-workspace') ? 700 : 0); }
}
const docRoot = new El('html');
let frames = new Map(), nextFrame = 1, rafCalls = 0;
globalThis.requestAnimationFrame = fn => { rafCalls++; const id = nextFrame++; frames.set(id, fn); return id; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
const runFrames = () => { for (let i = 0; frames.size && i < 5; i++) { const b = [...frames.values()]; frames.clear(); b.forEach(fn => fn(16)); } };
const observers = [];
globalThis.ResizeObserver = class { constructor(fn) { this.fn = fn; observers.push(this); } observe(el) { this.el = el; } disconnect() { this.el = null; } };
globalThis.getComputedStyle = el => ({ display: layoutRead('flex') });
globalThis.document = { hidden: false, createElement: tag => new El(tag), body: new El('body') };
globalThis.window = { innerHeight: 800, addEventListener() {}, removeEventListener() {} };
const { bindPreviewViews, previewMeasureStats } = await import(pathToFileURL(path.join(root, 'src/preview-view.js')).href);

// 설정 창 흉내: 작업 칸 안에 미리보기 칸 6개(큰 미리보기 3 · 설정 사이 작은 미리보기 3, 하나는 data-pv-max=120) + 접힌 칸 1
function panel() {
    for (const old of docRoot.children) old.parentElement = null; docRoot.children = []; observers.length = 0;
    const rootEl = new El('div', { class: 'bl-editor' }); docRoot.append(rootEl);
    const work = new El('div', { class: 'bl-editor-workspace' }); rootEl.append(work);
    const boxes = [];
    for (let i = 0; i < 7; i++) {
        const big = i < 3;
        const box = new El('div', { class: big ? 'salty-prevbox' : 'bl-inline-preview' }); box.dataset.pv = `pv${i}`; if (i === 4) box.dataset.pvMax = '120';
        const sample = new El('div', { class: big ? 'salty-preview' : 'salty-sample' }); sample.size = i === 6 ? [0, 0] : [300, big ? 400 + i * 10 : 80 + i * 10];   // 작은 미리보기는 자리 잡아 둔 높이(176)보다 낮아 처음 잴 때 높이를 써요
        box.append(sample); work.append(box); boxes.push(box);
    }
    return { rootEl, boxes };
}
// 칸 하나씩 잴 때(8.2.5)의 값 — 작업 칸 700 · 창 800 · 도구 줄 접힘(0) · 큰 칸은 끌기 줄(48) · 나란히 아님(150)
const expected = i => {
    const big = i < 3, h = big ? 400 + i * 10 : 80 + i * 10, limit = Math.max(48, Math.min(800 * .7, 700 - 0 - (big ? 48 : 0) - 150));
    return Math.min(h, limit, Math.min(800 * .22, i === 4 ? 120 : 180));
};

await test('칸 7개(하나는 접힘)를 프레임 하나 · 강제 배치 한 번으로 재고, 높이 · 이동 값은 칸 하나씩 잴 때와 같아요', () => {
    const { rootEl, boxes } = panel();
    flushes = 0; rafCalls = 0; const b0 = previewMeasureStats.batches;
    bindPreviewViews(rootEl, 'look');
    assert.equal(rafCalls, 1, `프레임 콜백은 하나(${rafCalls})`);
    runFrames();
    console.log(`        강제 배치 ${flushes}번 · 묶음 ${previewMeasureStats.batches - b0}번 (칸 7개)`);
    assert.ok(flushes <= 2, `강제 배치 ${flushes}번`);
    boxes.forEach((box, i) => {
        const port = box.querySelector('.bl-view-port'), scene = box.querySelector('.bl-view-scene');
        if (i === 6) { assert.notEqual(port.style.height, '0px', '접힌 칸은 높이를 0 으로 줄이지 않아요'); return; }
        assert.equal(port.style.height, `${expected(i)}px`, `칸 ${i} 높이`);
        assert.equal(scene.style.transform, 'translate(-10px,0px) scale(1)', `칸 ${i} 이동`);
    });
    const grip = boxes[0].querySelector('.bl-view-grip');
    assert.equal(grip.getAttribute('aria-valuenow'), String(Math.round(expected(0))));
    assert.equal(grip.getAttribute('aria-valuemax'), '502');
});
await test('크기가 바뀐 칸들(ResizeObserver)도 한 프레임에 모아요 · 같은 높이면 다시 쓰지 않아요', () => {
    const { rootEl, boxes } = panel(); bindPreviewViews(rootEl, 'look'); runFrames();
    rafCalls = 0; flushes = 0; dirty = true;
    for (const o of observers) if (o.el) o.fn([]);
    assert.equal(rafCalls, 1);
    const writes = []; for (const box of boxes) { const port = box.querySelector('.bl-view-port'); const st = port.style; const d = Object.getOwnPropertyDescriptor(Style.prototype, 'height'); Object.defineProperty(st, 'height', { get: () => d.get.call(st), set: v => { writes.push(v); d.set.call(st, v); }, configurable: true }); }
    runFrames();
    assert.equal(writes.length, 0, '같은 높이를 다시 씀');
    assert.ok(flushes <= 1);
});
await test('도구 단추 · 끌기는 그 자리에서 바로 재고 묶음에서 빠져요 · 창을 닫으면 묶음에 남지 않아요', () => {
    const { rootEl, boxes } = panel(); bindPreviewViews(rootEl, 'look'); runFrames();
    const toggle = boxes[0].querySelector('.bl-view-toggle');
    for (const o of observers) if (o.el) o.fn([]);   // 묶음 하나 대기
    toggle.onclick();                                // 도구 줄을 펴고 바로 재기
    const port = boxes[0].querySelector('.bl-view-port');
    assert.equal(port.style.height, '176px', '도구 줄(30)을 펴도 작은 높이(창 22%)가 한계보다 작아요');
    assert.equal(boxes[0].querySelector('.bl-view-grip').getAttribute('aria-valuemax'), String(700 - 30 - 48 - 150), '한계는 도구 줄만큼 줄어요');
    const before = previewMeasureStats.measured; runFrames();
    assert.equal(previewMeasureStats.measured - before, 5, '바로 잰 칸은 묶음에서 빠지고 접힌 칸은 재지 않아요(7 − 1 − 1)');
    for (const o of observers) if (o.el) o.fn([]);
    rootEl._previewCleanup();
    const m = previewMeasureStats.measured; runFrames();
    assert.equal(previewMeasureStats.measured, m, '닫은 창의 칸을 재요');
});
await test('숨은 탭에서는 프레임 대신 타이머로 한 번', async () => {
    document.hidden = true;
    const { rootEl } = panel(); rafCalls = 0; const m = previewMeasureStats.measured;
    bindPreviewViews(rootEl, 'look');
    assert.equal(rafCalls, 0);
    await new Promise(r => setTimeout(r, 5));
    assert.equal(previewMeasureStats.measured - m, 6);
    document.hidden = false; rootEl._previewCleanup();
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/preview-measure-batch\.mjs \./);
});
console.log(`\n${passed} passed`);
