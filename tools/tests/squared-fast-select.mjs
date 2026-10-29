// 10-30 perf-icon: 네모 단추 감시(src/squared-buttons.js)가 진짜 문서에서는 후보를 브라우저 선택자(FAST_CANDIDATES)로 미리 걸러
//   이미 표시한 것 · 입력 · 그림 태그 · 건너뛸 구역 안 후보를 JS 로 하나씩 보지 않는지, 끝 표시가 예전 길(흉내 문서 길)과 같은지,
//   메시지 하나를 훑을 때 후보마다 그 메시지를 다시 찾지 않는지 봐요(가짜 DOM, 브라우저 없음 — 선택자 자체의 뜻은 리그에서 뿌리 315개 대조로 확인)
//   node tools/tests/squared-fast-select.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const mod = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')));
const { watchSquaredButtons, FAST_CANDIDATES, skippedMessageOf } = mod;
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('  PASS  ' + name); };
assert.equal(typeof FAST_CANDIDATES, 'string', 'FAST_CANDIDATES 를 내보내요');
assert.ok(FAST_CANDIDATES.startsWith(':is(button,a,summary'), '후보 선택자를 :is() 로 감싸요');

const count = { has: 0, mesClosest: 0 };
const AREA = new Set(['mes_buttons', 'swipe_left', 'swipe_right']);
class El {
    constructor(tag, parent = null, cls = '', real = true) {
        this.tagName = tag; this.parentElement = parent; this.nodeType = 1; this.isConnected = true; this.children = []; this.attrs = new Set(); this.dataset = {}; this.id = '';
        this.cls = new Set(cls.split(' ').filter(Boolean)); this.innerText = '시험 단추'; this.cv = 'visible'; parent?.children.push(this);
        this.classList = { contains: c => this.cls.has(c) };
        if (real) this.contains = x => { for (let p = x; p; p = p.parentElement) if (p === this) return true; return false; };
    }
    get className() { return [...this.cls].join(' '); }
    getAttribute(k) { return k === 'class' ? this.className : null; }
    get offsetParent() { return {}; }
    checkVisibility() { return true; }
    inArea() { for (let p = this; p; p = p.parentElement) if ([...p.cls].some(c => AREA.has(c))) return true; return false; }
    isCand() { return this.tagName === 'BUTTON'; }
    fast() { return this.isCand() && !this.attrs.has('data-bl-squared') && !this.inArea(); }
    matches(s) { if (s === FAST_CANDIDATES) return this.fast(); return this.isCand() && s.startsWith('button,a,summary'); }
    closest(s) {
        if (s === '#chat > .mes') { count.mesClosest++; for (let p = this; p; p = p.parentElement) if (p.cls.has('mes') && p.parentElement?.id === 'chat') return p; return null; }
        if (s.startsWith('#send_form')) { for (let p = this; p; p = p.parentElement) if ([...p.cls].some(c => AREA.has(c))) return p; return null; }
        return null;
    }
    walk() { const out = []; const w = e => e.children.forEach(c => { out.push(c); w(c); }); w(this); return out; }
    querySelectorAll(s) {
        if (s === FAST_CANDIDATES) return this.walk().filter(e => e.fast());
        if (s.startsWith('button,a,summary')) return this.walk().filter(e => e.isCand());
        if (s.startsWith('#send_form')) return this.walk().filter(e => [...e.cls].some(c => AREA.has(c)));
        return [];
    }
    getBoundingClientRect() { return { width: 80, height: 32 }; }
    hasAttribute(k) { count.has++; return this.attrs.has(k); } setAttribute(k) { this.attrs.add(k); } removeAttribute(k) { this.attrs.delete(k); }
}
const view = { getComputedStyle: el => ({ contentVisibility: el.cv, display: 'block', visibility: 'visible', borderTopLeftRadius: el.round ? '16px' : '2px', backgroundColor: 'rgb(1,2,3)', borderTopWidth: '0', backgroundImage: 'none', boxShadow: 'none', cursor: 'pointer' }) };
function rig(real, seed) {
    let s = seed; const rnd = n => { s = (s * 1103515245 + 12345) % 2147483648; return (s >>> 8) % n; };   // 아래 비트는 번갈아 나와 위 비트를 써요
    const body = new El('BODY', null, 'salty', real); const chat = new El('DIV', body, '', real); chat.id = 'chat';
    for (let i = 0; i < 40; i++) {
        const m = new El('DIV', chat, 'mes', real); const bar = new El('DIV', m, rnd(2) ? 'mes_buttons' : 'extra', real);
        for (let k = rnd(6); k >= 0; k--) { const b = new El('BUTTON', rnd(2) ? bar : m, 'chip-' + rnd(5), real); b.round = rnd(3) === 0; }
    }
    const side = new El('DIV', body, '', real); for (let k = 0; k < 20; k++) { const b = new El('BUTTON', side, 'pill-' + rnd(4), real); b.round = rnd(2) === 0; }
    const timers = [], frames = [];
    const host = { HTMLElement: El, MutationObserver: class { constructor(cb) { host.notify = cb; } observe() {} disconnect() {} }, setTimeout: fn => (timers.push(fn), timers.length), clearTimeout() {}, requestAnimationFrame: fn => (frames.push(fn), frames.length), cancelAnimationFrame() {}, addEventListener() {}, removeEventListener() {}, ...view };
    const doc = { body, head: { append() {} }, createElement: () => ({ dataset: {}, remove() {} }), querySelectorAll: () => [], getElementById: id => (id === 'chat' ? chat : null), addEventListener() {}, removeEventListener() {} };
    const stop = watchSquaredButtons(doc, host);
    const flush = () => { while (timers.length || frames.length) { while (timers.length) timers.shift()(); while (frames.length) frames.shift()(); } };
    return { body, chat, host, flush, stop };
}
const marks = r => [r.body, ...r.body.walk()].map(e => (e.attrs.has('data-bl-squared') ? 1 : 0)).join('');

test('끝 표시가 예전 길(흉내 문서)과 같고, 구역 안 · 표시된 후보는 JS 로 보지 않아요(무작위 채팅 30개)', () => {
    let realHas = 0, fakeHas = 0, marked = 0;
    for (let t = 0; t < 30; t++) {
        count.has = 0; const a = rig(true, 1000 + t); a.flush(); realHas += count.has;
        count.has = 0; const b = rig(false, 1000 + t); b.flush(); fakeHas += count.has;
        assert.equal(marks(a), marks(b), `채팅 ${t} 의 표시가 달라요`);
        marked += marks(a).split('1').length - 1;
        // 같은 생김새가 새로 붙을 때(restamp)도 같아요
        a.stop(); b.stop();
    }
    assert.ok(marked > 50, `표시가 실제로 붙어야 해요(${marked})`);
    assert.ok(realHas < fakeHas * 0.95, `후보 확인 ${fakeHas} → ${realHas}`);
    console.log(`        후보 확인(hasAttribute) ${fakeHas} → ${realHas}`);
});
test('메시지 하나를 훑을 때 후보마다 그 메시지를 다시 찾지 않아요(rootMes)', () => {
    const chat = new El('DIV', new El('BODY')); chat.id = 'chat';
    const m = new El('DIV', chat, 'mes'); m.cv = 'auto'; m.checkVisibility = () => true;
    const kids = Array.from({ length: 20 }, () => new El('BUTTON', m));
    const known = new WeakMap([[m, true]]);
    count.mesClosest = 0; const cache = new Map();
    for (const k of kids) assert.equal(skippedMessageOf(k, view, cache, known, m), m);
    assert.equal(count.mesClosest, 0, `closest ${count.mesClosest}번`);
    assert.equal(skippedMessageOf(m, view, new Map(), known, m), null, '메시지 자신은 예전처럼 null');
});
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/squared-fast-select.mjs .'), 'release-check.yml 에 등록');
console.log(`squared-fast-select: ${pass}개 통과`);
