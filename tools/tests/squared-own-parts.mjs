// 1.2.2 「다른 확장 단추 네모로」(src/squared-buttons.js)가 테마 창 단추 모서리를 8 로 바꾸던 것 —
//   ① 상태 아닌 클래스가 없는 빈 생김새 열쇠(「BUTTON|」 — 클래스 없는 단추 · bl- 클래스만 있는 단추)는 기억 · 바로 붙이기에 안 써요
//   ② 테마 자기 부품(클래스가 bl- · salty- 와 상태 클래스뿐)은 후보가 아니에요
//   1.1.7 ~ 1.2.1: 로그 복사 알약(「+n」 · 이름 칩)이나 클래스 없는 둥근 단추 하나를 배우면, 그 뒤 여는 창(번역 리모컨 · 캡처 · 색 고르기 · 출처 · 처음 켰을 때)의
//   상관없는 단추까지 재지 않고 [data-bl-squared](모서리 8)가 붙었어요. 가짜 DOM(squared-buttons-754.mjs 와 같은 방식)
//   node tools/tests/squared-own-parts.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

class El {
    constructor(tag, { cls = '', text = 'Button', w = 80, h = 32, radius = '16px', bg = 'rgb(10, 20, 30)', cursor = 'pointer', parent = null } = {}) {
        Object.assign(this, { tagName: tag.toUpperCase(), className: cls, id: '', innerText: text, w, h, radius, bg, cursor, parent, attrs: new Map(), children: [], isConnected: true, nodeType: 1 });
        this.offsetReads = 0;
        parent?.children.push(this);
    }
    get offsetParent() { this.offsetReads++; return {}; }
    hasAttribute(a) { return this.attrs.has(a); }
    setAttribute(a, v) { this.attrs.set(a, v); }
    removeAttribute(a) { this.attrs.delete(a); }
    matches(sel) {
        const t = this.tagName.toLowerCase();
        if (sel === 'input,select,textarea,img,svg') return ['input', 'select', 'textarea', 'img', 'svg'].includes(t);
        if (/^button,a,summary/.test(sel)) return ['button', 'a', 'summary'].includes(t) || /chip|tab|pill|btn/.test(this.className);
        return false;
    }
    closest() { return null; }
    querySelectorAll() { const out = []; const walk = e => { for (const c of e.children) { out.push(c); walk(c); } }; walk(this); return out; }
    getBoundingClientRect() { return { width: this.w, height: this.h }; }
}
function squaredHost() {
    const timers = [], frames = [];
    class HTMLElement {}
    Object.setPrototypeOf(El.prototype, HTMLElement.prototype);
    const host = {
        HTMLElement, timers, frames,
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clearTimeout() {},
        requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
        addEventListener() {}, removeEventListener() {},
        MutationObserver: class { constructor(cb) { host.observerCb = cb; } observe() {} disconnect() {} },
        getComputedStyle: el => ({ display: 'block', visibility: 'visible', borderTopLeftRadius: el.radius, backgroundColor: el.bg, borderTopWidth: '0px', backgroundImage: 'none', boxShadow: 'none', cursor: el.cursor }),
    };
    return host;
}
const runMeasure = host => { host.timers.at(-1).fn(); host.frames.at(-1)(); host.timers.at(-1).fn(); };   // 재기는 타이머 → rAF → setTimeout(배치 뒤)
const mod = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')).href);

await test('빈 열쇠: 클래스 없는 단추 · bl- 클래스만 있는 단추는 바로 붙이기 열쇠가 없어요(다른 확장 클래스는 그대로)', () => {
    assert.equal(mod.stampKey({ tagName: 'BUTTON', className: '' }), '');
    assert.equal(mod.stampKey({ tagName: 'BUTTON', className: 'bl-lc-chip bl-lc-cr-more' }), '');
    assert.equal(mod.stampKey({ tagName: 'BUTTON', className: 'bl-cp-sw on' }), '');
    assert.equal(mod.stampKey({ tagName: 'BUTTON', className: 'fsc-chip on' }), 'BUTTON|fsc-chip');
    assert.equal(mod.shapeKey({ tagName: 'BUTTON', className: '' }), 'BUTTON|', '생김새 열쇠 자체는 예전 그대로');
});

await test('테마 자기 부품: 클래스가 bl- · salty- (와 상태 클래스)뿐이면 후보가 아니에요', () => {
    for (const cls of ['bl-lc-chip bl-lc-cr-more', 'bl-lc-chip bl-lc-name', 'bl-lc-chip on', 'salty-btn', 'bl-fr-card bl-fr-pal is-on']) assert.equal(mod.ownPart(cls), true, cls);
    for (const cls of ['', 'on', 'fsc-chip', 'menu_button bl-x', 'qr--button']) assert.equal(mod.ownPart(cls), false, cls);
    const host = squaredHost();
    assert.equal(mod.isRoundTextButton(new El('button', { cls: 'bl-lc-chip bl-lc-cr-more', text: '+8', h: 28, radius: '999px' }), host), false, '테마 알약은 네모로 안 바꿔요');
    assert.equal(mod.isRoundTextButton(new El('button', { cls: 'fsc-chip', text: '자유' }), host), true, '다른 확장 알약은 예전처럼');
});

await test('둥근 단추(로그 복사 알약 · 클래스 없는 알약)를 먼저 배운 뒤 새 창의 클래스 없는 · bl- 단추에 data-bl-squared 가 안 붙어요 · 다른 확장 칩은 예전처럼 바로', async () => {
    const host = squaredHost();
    const body = new El('body', { text: '' }); body.dataset = {}; body.matches = () => false;
    const doc = { body, head: { append() {} }, documentElement: body, createElement: () => ({ dataset: {}, remove() {} }), querySelectorAll: () => [] };
    // 로그 복사 창: 테마 알약 둘 + 다른 확장이 그린 칩 + 클래스 없는 둥근 단추(진짜 알약)
    const sheet = new El('dialog', { parent: body, text: '' }); sheet.matches = () => false;
    const more = new El('button', { cls: 'bl-lc-chip bl-lc-cr-more', parent: sheet, text: '+8', h: 28, radius: '999px' });
    const nameChip = new El('button', { cls: 'bl-lc-chip bl-lc-name', parent: sheet, text: '유리 빼기', h: 30, radius: '999px' });
    const extChip = new El('button', { cls: 'fsc-chip', parent: sheet, text: '자유' });
    const plainPill = new El('button', { parent: sheet, text: '알약', h: 30, radius: '999px' });
    const stop = mod.watchSquaredButtons(doc, host);
    runMeasure(host);
    assert.equal(more.hasAttribute('data-bl-squared') || nameChip.hasAttribute('data-bl-squared'), false, '테마 알약은 그대로 둥글어요');
    assert.equal(extChip.hasAttribute('data-bl-squared'), true, '다른 확장 칩은 네모');
    assert.equal(plainPill.hasAttribute('data-bl-squared'), true, '클래스 없는 진짜 알약은 재서 네모(예전과 같아요)');
    // 나중에 연 창(번역 리모컨 · 출처 · 캡처 꼴): 모서리 10 · 0 인 클래스 없는 단추와 bl- 단추, 다시 그린 다른 확장 칩
    const later = new El('dialog', { parent: body, text: '' }); later.matches = () => false;
    const close = new El('button', { parent: later, text: '닫기', w: 44, h: 44, radius: '10px' });
    const plain = new El('button', { parent: later, text: '내보내기', h: 44, radius: '10px' });
    const heading = new El('button', { cls: 'bl-tool-heading', parent: later, text: '저장 방식', h: 44, radius: '0px', bg: 'rgba(0, 0, 0, 0)' });
    const swatch = new El('button', { cls: 'bl-cp-sw', parent: later, text: '#93C9FF', w: 30, h: 30, radius: '50%' });
    const extAgain = new El('button', { cls: 'fsc-chip on', parent: later, text: '자유' });
    host.observerCb([{ type: 'childList', addedNodes: [later], target: body }]);
    for (const el of [close, plain, heading, swatch]) assert.equal(el.hasAttribute('data-bl-squared'), false, `바로 붙이지 않아요: ${el.className || el.innerText}`);
    assert.equal(extAgain.hasAttribute('data-bl-squared'), true, '다시 그린 다른 확장 칩은 예전처럼 콜백에서 바로');
    runMeasure(host);
    for (const el of [close, plain, heading, swatch]) assert.equal(el.hasAttribute('data-bl-squared'), false, `재도 붙지 않아요: ${el.className || el.innerText}`);
    stop();
});

await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/squared-own-parts\.mjs \./);
});
console.log(`squared-own-parts: ${passed} passed, 0 failed`);
