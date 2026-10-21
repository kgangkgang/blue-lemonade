// 7.5.4 squared-buttons: 목록을 innerHTML 로 다시 그리는 확장(탭 · 칩이 새 요소가 됨)에서 새 요소가 300ms 동안 둥글게 보였다가 네모가 되던 것 —
//   한 번 표시한 생김새(태그 + 상태 아닌 클래스)는 MutationObserver 콜백에서 바로 표시한다. 잰 적 없는 생김새는 예전처럼 타이머 → 프레임에서 잰다.
//   가짜 DOM(phone-speed-728.mjs 와 같은 방식). node tools/tests/squared-buttons-754.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

class El {
    constructor(tag, { cls = '', id = '', text = 'Button', w = 80, h = 32, radius = '16px', bg = 'rgb(10, 20, 30)', cursor = 'pointer', parent = null, skipArea = false, hidden = false } = {}) {
        Object.assign(this, { tagName: tag.toUpperCase(), className: cls, id, innerText: text, w, h, radius, bg, cursor, parent, skipArea, hidden, attrs: new Map(), children: [], isConnected: true, nodeType: 1 });
        this.offsetReads = 0;
        parent?.children.push(this);
    }
    get offsetParent() { this.offsetReads++; return this.hidden ? null : {}; }
    hasAttribute(a) { return this.attrs.has(a); }
    setAttribute(a, v) { this.attrs.set(a, v); }
    removeAttribute(a) { this.attrs.delete(a); }
    matches(sel) {
        const t = this.tagName.toLowerCase();
        if (sel === 'input,select,textarea,img,svg') return ['input', 'select', 'textarea', 'img', 'svg'].includes(t);
        if (/^button,a,summary/.test(sel)) return ['button', 'a', 'summary'].includes(t) || /chip|tab|pill|btn/.test(this.className);
        return false;
    }
    closest(sel) { if (/send_form|mes_buttons/.test(sel)) return this.skipArea ? this : null; return null; }
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
const mod = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')).href);

await test('shapeKey: 태그 + 상태 아닌 클래스(정렬) — .on · is-* · bl-* 는 빠진다', () => {
    assert.equal(mod.shapeKey({ tagName: 'BUTTON', className: 'fsc-chip on' }), 'BUTTON|fsc-chip');
    assert.equal(mod.shapeKey({ tagName: 'BUTTON', className: 'b fsc-chip is-active a' }), 'BUTTON|a b fsc-chip');
    assert.notEqual(mod.shapeKey({ tagName: 'BUTTON', className: 'fsc-chip' }), mod.shapeKey({ tagName: 'A', className: 'fsc-chip' }));
});

await test('다시 그려진 같은 생김새의 칩은 재지 않고 MutationObserver 콜백에서 바로 표시 · 처음 보는 생김새는 프레임에서 잰다', async () => {
    const host = squaredHost();
    const body = new El('body', { text: '' }); body.dataset = {}; body.matches = () => false;
    const doc = { body, head: { append() {} }, documentElement: body, createElement: () => ({ dataset: {}, remove() {} }), querySelectorAll: () => [] };
    const list = new El('div', { parent: body, text: '' }); list.matches = () => false;
    const chip = new El('button', { cls: 'fsc-chip on', parent: list, text: '자유' });
    const tab = new El('button', { cls: 'fsc-modetab', parent: list, text: '본편 반응' });
    const stop = mod.watchSquaredButtons(doc, host);
    host.timers[0].fn(); host.frames[0]();
    assert.ok(chip.hasAttribute('data-bl-squared') && tab.hasAttribute('data-bl-squared'), '첫 번째는 예전처럼 재서 표시');
    // 확장이 목록을 innerHTML 로 다시 그림: 새 요소들 (같은 클래스, 상태 클래스는 다름)
    list.children = [];
    const chip2 = new El('button', { cls: 'fsc-chip', parent: list, text: '자유' });
    const tab2 = new El('button', { cls: 'fsc-modetab on', parent: list, text: '세계관 속' });
    const fresh = new El('button', { cls: 'fsc-never-seen', parent: list, text: '새 것' });
    const inSend = new El('button', { cls: 'fsc-chip', parent: list, text: '건너뜀', skipArea: true });
    const timersBefore = host.timers.length, framesBefore = host.frames.length;
    host.observerCb([{ type: 'childList', addedNodes: [list], target: body }]);
    assert.equal(chip2.hasAttribute('data-bl-squared'), true, '같은 생김새 칩은 바로 표시(둥근 0.3초 없음)');
    assert.equal(tab2.hasAttribute('data-bl-squared'), true, '상태 클래스(.on)만 다른 탭도 바로');
    assert.equal(fresh.hasAttribute('data-bl-squared'), false, '처음 보는 생김새는 아직');
    assert.equal(inSend.hasAttribute('data-bl-squared'), false, '건너뛸 영역은 바로 표시하지 않는다');
    assert.equal(chip2.offsetReads + tab2.offsetReads, 0, '바로 표시할 때는 레이아웃을 묻지 않는다');
    assert.equal(host.timers.length, timersBefore + 1, '잰 적 없는 요소를 위해 타이머는 예전처럼');
    host.timers.at(-1).fn(); host.frames.at(-1)();
    assert.equal(fresh.hasAttribute('data-bl-squared'), true, '처음 보는 생김새는 프레임에서 재서 표시');
    assert.equal(host.frames.length, framesBefore + 1);
    stop();
});

await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/squared-buttons-754\.mjs \./);
});
console.log(`squared-buttons-754: ${passed} passed, 0 failed`);
