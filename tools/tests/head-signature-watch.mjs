// 8.2.7 커스텀 CSS 조절의 <head> 서명: 감시자가 있으면 글이 바뀐 <style> 만 다시 읽어요(예전엔 부를 때마다 모든 <style> 의 글 전체를 꺼냄) — perf-addons.
//   서명은 예전과 같은 규칙이어야 해요: 그대로면 같고, 글이 바뀌면 달라지고, 되돌려도 새 번호. 같은 작업 안의 변경(감시 기록이 아직 안 온 것)도 잡아요.
//   node tools/tests/head-signature-watch.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('ok', name); };

// 가짜 감시자: observe 한 대상의 기록을 손으로 넣고, takeRecords 로 가져가거나 콜백으로 받는다
const observers = [];
globalThis.MutationObserver = class { constructor(cb) { this.cb = cb; this.queue = []; observers.push(this); } observe(target, opts) { this.target = target; this.opts = opts; } takeRecords() { const q = this.queue; this.queue = []; return q; } disconnect() {} };
const mutate = target => { for (const o of observers) o.queue.push({ target, type: 'childList' }); };
const deliver = () => { for (const o of observers) { const q = o.takeRecords(); if (q.length) o.cb(q); } };

const { headSignature } = await import(pathToFileURL(path.join(root, 'src/addons/customstyle/head-signature.js')).href);
const big = 'body{}'.repeat(50000);
let reads = 0;
const head = { nodeType: 1, nodeName: 'HEAD', querySelectorAll: () => [style, link] };
const style = { nodeType: 1, nodeName: 'STYLE', tagName: 'STYLE', parentNode: head, _t: big, get textContent() { reads++; return this._t; }, set textContent(v) { this._t = v; }, getAttribute: () => null, sheet: { cssRules: { length: 50000 } } };
const textNode = { nodeType: 3, nodeName: '#text', parentNode: style };
const link = { nodeType: 1, nodeName: 'LINK', tagName: 'LINK', parentNode: head, getAttribute: k => (k === 'href' ? 'style.css' : null), sheet: { cssRules: { length: 3 } } };
const doc = { documentElement: { getAttribute: () => 'salty' }, head };
const win = { innerWidth: 384, innerHeight: 800, devicePixelRatio: 3 };

await check('감시자가 있으면 <head> 를 보고, 바뀐 기록이 없으면 <style> 글을 다시 꺼내지 않아요', () => {
    const a = headSignature(doc, win);
    assert.ok(observers.some(o => o.target === head && o.opts.subtree && o.opts.characterData && o.opts.childList), '<head> 하위 글 · 자식 변경을 봐요');
    const before = reads;
    const b = headSignature(doc, win), c = headSignature(doc, win);
    assert.equal(a, b); assert.equal(b, c);
    assert.equal(reads, before, `바뀐 것이 없는데 글을 ${reads - before}번 꺼냈어요`);
});
await check('글이 바뀌면(감시 기록이 같은 작업 안이라 아직 콜백 전이어도) 서명이 달라져요', () => {
    const a = headSignature(doc, win);
    style.textContent = big + 'p{}'; mutate(textNode);   // 콜백 전 — takeRecords 로 받아야 해요
    const b = headSignature(doc, win);
    assert.notEqual(b, a);
    style.textContent = big; mutate(style); deliver();    // 콜백으로 받은 경우
    const c = headSignature(doc, win);
    assert.notEqual(c, a, '되돌려도 새 번호(바뀐 적이 있으니 다시 읽어요 — 예전과 같은 규칙)');
    assert.notEqual(c, b);
    const before = reads; assert.equal(headSignature(doc, win), c); assert.equal(reads, before);
});
await check('기록은 왔지만 글이 그대로면 서명도 그대로예요(예전처럼 글을 견줘요)', () => {
    const a = headSignature(doc, win);
    mutate(style);
    assert.equal(headSignature(doc, win), a);
});
await check('시트 규칙 수 · 화면 크기는 감시자 없이도 늘 봐요(CSSOM 으로 빼고 더한 규칙)', () => {
    const a = headSignature(doc, win);
    style.sheet.cssRules.length = 49999;
    assert.notEqual(headSignature(doc, win), a);
    assert.notEqual(headSignature(doc, { ...win, innerWidth: 400 }), headSignature(doc, win));
});
console.log(`head-signature-watch: ${passed}개 통과`);
