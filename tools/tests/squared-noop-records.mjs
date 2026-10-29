// 10-30 perf-icon: 네모 단추 감시(src/squared-buttons.js)가 바뀐 것 없는 기록에 메시지를 다시 재지 않는지 —
//   ① 속성을 같은 값으로 다시 쓴 기록(실리태번 refreshSwipeButtons 가 메시지가 붙을 때마다 메시지 전부에 없는 클래스를 classList.remove — 기록만 남)
//   ② 메시지(.mes)의 스와이프 표시 클래스(fade · last_swipe · swipes_visible)만 바뀐 기록(그 클래스가 고르는 것은 이 감시가 보지 않는 스와이프 단추뿐)
//   (가짜 DOM, 브라우저 없음)
//   node tools/tests/squared-noop-records.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const mod = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')));
const { watchSquaredButtons, unchangedAttr, swipeMarkOnly } = mod;
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('  PASS  ' + name); };
assert.equal(typeof unchangedAttr, 'function', 'unchangedAttr 를 내보내요');
assert.equal(typeof swipeMarkOnly, 'function', 'swipeMarkOnly 를 내보내요');

let vis = 0, queries = 0;
class El {
    constructor(tag, parent = null, { id = '', cls = '' } = {}) {
        this.tagName = tag; this.parentElement = parent; this.nodeType = 1; this.isConnected = true; this.children = []; this.attrs = new Set(); this.dataset = {}; this.id = id;
        this.cls = new Set(cls.split(' ').filter(Boolean)); this.innerText = '시험 단추'; this.cv = 'visible'; this.skipped = false; this.display = 'block'; parent?.children.push(this);
        this.classList = { contains: c => this.cls.has(c), add: c => this.cls.add(c), remove: c => this.cls.delete(c) };
    }
    get className() { return [...this.cls].join(' '); }
    getAttribute(k) { return k === 'class' ? this.className : null; }
    get offsetParent() { return this.boxed() ? {} : null; }
    isMes() { return this.cls.has('mes') && this.parentElement?.id === 'chat'; }
    lockedBy() { for (let p = this.parentElement; p; p = p.parentElement) if (p.cv === 'auto' && p.skipped) return p; return null; }
    boxed() { for (let p = this; p; p = p.parentElement) if (p.display === 'none') return false; return this.display !== 'contents'; }
    checkVisibility(o = {}) { vis++; return this.boxed() && !(o.contentVisibilityAuto && this.lockedBy()); }
    matches(s) { return this.tagName === 'BUTTON' && s.startsWith('button,a,summary'); }
    closest(s) {
        if (s === '#chat > .mes') { for (let p = this; p; p = p.parentElement) if (p.isMes()) return p; return null; }
        if (s === '#chat') { for (let p = this; p; p = p.parentElement) if (p.id === 'chat') return p; return null; }
        if (s === '.mes') { for (let p = this; p; p = p.parentElement) if (p.cls.has('mes')) return p; return null; }
        return null;
    }
    querySelectorAll(s) { if (s && !s.startsWith('button,a,summary')) return []; queries++; const out = []; const walk = e => e.children.forEach(c => { if (c.tagName === 'BUTTON') out.push(c); walk(c); }); walk(this); return out; }
    getBoundingClientRect() { return { width: 80, height: 32 }; }
    hasAttribute(k) { return this.attrs.has(k); } setAttribute(k) { this.attrs.add(k); } removeAttribute(k) { this.attrs.delete(k); }
}
let styled = 0;
const view = { getComputedStyle: el => { if (!el.isMes?.()) styled++; return { contentVisibility: el.cv, display: el.display, visibility: 'visible', borderTopLeftRadius: '16px', backgroundColor: 'rgb(1,2,3)', borderTopWidth: '0', backgroundImage: 'none', boxShadow: 'none', cursor: 'pointer' }; } };
function rig(n = 150) {
    const body = new El('BODY', null, { cls: 'salty' }); const chat = new El('DIV', body, { id: 'chat' });
    const timers = [], frames = [];
    const host = { HTMLElement: El, MutationObserver: class { constructor(cb) { host.notify = cb; } observe() {} disconnect() {} }, setTimeout: fn => (timers.push(fn), timers.length), clearTimeout() {}, requestAnimationFrame: fn => (frames.push(fn), frames.length), cancelAnimationFrame() {}, addEventListener() {}, removeEventListener() {}, ...view };
    const doc = { body, head: { append() {} }, createElement: () => ({ dataset: {}, remove() {} }), querySelectorAll: () => [], getElementById: id => (id === 'chat' ? chat : null), addEventListener() {}, removeEventListener() {} };
    const mes = []; for (let i = 0; i < n; i++) { const m = new El('DIV', chat, { cls: 'mes' }); new El('BUTTON', new El('DIV', m, { cls: 'mes_text' })); mes.push(m); }
    const stop = watchSquaredButtons(doc, host);
    const flush = () => { while (timers.length || frames.length) { while (timers.length) timers.shift()(); while (frames.length) frames.shift()(); } };
    flush();
    return { body, chat, mes, host, flush, stop };
}
const rec = (target, oldValue) => ({ type: 'attributes', attributeName: 'class', oldValue, target });

test('같은 값으로 다시 쓴 기록 150개에는 메시지를 다시 재지 않아요(고치기 전: 150번)', () => {
    const r = rig(); queries = 0;
    r.host.notify(r.mes.map(m => rec(m, m.className))); r.flush();
    assert.equal(queries, 0, `후보 찾기 ${queries}번`);
    r.stop();
});
test('스와이프 표시 클래스(fade · last_swipe · swipes_visible)만 바뀐 메시지도 다시 재지 않아요', () => {
    const r = rig(); queries = 0;
    r.host.notify(r.mes.map(m => { const old = m.className; m.cls.add('fade'); m.cls.add('last_swipe'); return rec(m, old); })); r.flush();
    assert.equal(queries, 0, `후보 찾기 ${queries}번`);
    r.stop();
});
test('다른 클래스가 함께 바뀌면(last_mes 등) 예전처럼 그 메시지를 재요', () => {
    const r = rig(); queries = 0;
    const m = r.mes[5]; const old = m.className; m.cls.add('fade'); m.cls.add('last_mes');
    r.host.notify([rec(m, old), rec(r.mes[6], r.mes[6].className)]); r.flush();
    assert.ok(queries >= 1 && queries <= 2, `그 메시지 하나만(알려진 생김새 붙이기 + 재기) — ${queries}번`);
    r.stop();
});
test('판정 함수: 값이 실제로 바뀌었거나 oldValue 가 없는 흉내 기록은 「같음」이 아니에요', () => {
    const el = new El('DIV', null, { cls: 'a b' });
    assert.equal(unchangedAttr(rec(el, 'a b')), true);
    assert.equal(unchangedAttr(rec(el, 'a')), false);
    assert.equal(unchangedAttr({ type: 'attributes', attributeName: 'class', target: el }), false, 'oldValue 없음');
    assert.equal(unchangedAttr({ type: 'childList', target: el, oldValue: null }), false);
    const mes = new El('DIV', null, { cls: 'mes fade' });
    assert.equal(swipeMarkOnly(rec(mes, 'mes')), true);
    assert.equal(swipeMarkOnly(rec(mes, 'mes last_mes')), false, 'last_mes 는 테마 CSS 가 봐요');
    assert.equal(swipeMarkOnly(rec(mes, 'fade')), false, '.mes 가 새로 붙은 것');
    assert.equal(swipeMarkOnly(rec(new El('DIV', null, { cls: 'card fade' }), 'card')), false, '메시지가 아닌 요소');
});

assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/squared-noop-records.mjs .'), 'release-check.yml 에 등록');
console.log(`squared-noop-records: ${pass}개 통과`);
