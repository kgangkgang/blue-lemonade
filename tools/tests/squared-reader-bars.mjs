// 8.2.7 폰 예측점검(hunt-mobile) · 가볍게: 몰입 읽기(src/reader.js)는 폰에서 채팅을 내리고 올릴 때마다 body 에 bl-bars-hidden 을 붙였다 떼요.
// 네모 단추 감시(src/squared-buttons.js)는 body 의 class 가 바뀌면 문서 전체를 뿌리로 잡아 후보 전부를 다시 표시하고(restamp) 0.3초 뒤 다시 쟀어요
// (offsetParent · getBoundingClientRect · innerText · getComputedStyle — 긴 채팅 폰 4배에서 0.3초대). 그래서 읽다가 방향을 바꿀 때마다 스크롤 중에 끊겼어요.
// bl-bars-hidden 은 위 바 · 입력판을 top · transform 으로 밀기만 해요(css/29-reader-onehand.css — 보임 · 모서리 · 크기는 그대로) → 단추 모양 판정이 같아요.
// 고친 뒤: body 에서 bl-bars-hidden 만 바뀐 기록은 다시 재지 않아요(채팅 성능 표식과 같은 길). 다른 class 가 같이 바뀌면 지금처럼 다시 재요.
//   node tools/tests/squared-reader-bars.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { watchSquaredButtons, perfMarkOnly } = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')));
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
class El {
    constructor(tag, parent = null) { this.tagName = tag; this.parentElement = parent; this.nodeType = 1; this.isConnected = true; this.children = []; this.attrs = new Set(); this.dataset = {}; this.className = tag === 'BUTTON' ? 'known-chip' : ''; this.id = ''; this.innerText = '단추'; this.offsetParent = {}; parent?.children.push(this); }
    matches(s) { return this.tagName === 'BUTTON' && s.startsWith('button,a,summary'); }
    closest() { return null; }
    querySelectorAll(s) { if (s && !s.startsWith('button,a,summary')) return []; this.queries = (this.queries || 0) + 1; const out = []; const walk = e => e.children.forEach(c => { if (c.tagName === 'BUTTON') out.push(c); walk(c); }); walk(this); return out; }
    getBoundingClientRect() { this.reads = (this.reads || 0) + 1; return { width: 80, height: 32 }; }
    hasAttribute(k) { return this.attrs.has(k); } setAttribute(k) { this.attrs.add(k); } removeAttribute(k) { this.attrs.delete(k); }
}
function rig() {
    const body = new El('BODY'), timers = [], frames = [];
    body.cls = new Set(['salty', 'bl-reader']); body.classList = { contains: c => body.cls.has(c) }; body.getAttribute = () => [...body.cls].join(' ');
    const host = { HTMLElement: El, MutationObserver: class { constructor(cb) { host.notify = cb; } observe() {} disconnect() {} }, setTimeout: fn => (timers.push(fn), timers.length), clearTimeout() {}, requestAnimationFrame: fn => (frames.push(fn), frames.length), cancelAnimationFrame() {}, addEventListener() {}, removeEventListener() {},
        getComputedStyle: () => ({ display: 'block', visibility: 'visible', borderTopLeftRadius: '16px', backgroundColor: 'rgb(1,2,3)', borderTopWidth: '0', backgroundImage: 'none', boxShadow: 'none', cursor: 'pointer' }) };
    const doc = { body, head: { append() {} }, createElement: () => ({ dataset: {}, remove() {} }), querySelectorAll: () => [] };
    const stop = watchSquaredButtons(doc, host);
    const flush = () => { while (timers.length) timers.shift()(); while (frames.length) frames.shift()(); };
    return { body, host, flush, stop, pending: () => timers.length + frames.length };
}
const flip = (body, add, remove = []) => { const old = body.getAttribute(); for (const c of add) body.cls.add(c); for (const c of remove) body.cls.delete(c); return { type: 'attributes', attributeName: 'class', oldValue: old, target: body }; };
test('판정: body 에서 bl-bars-hidden 만 붙거나 빠진 기록은 모양이 안 바뀌는 기록이에요', () => {
    const t = v => ({ getAttribute: () => v, classList: { contains: () => false } });
    assert.equal(perfMarkOnly({ type: 'attributes', attributeName: 'class', oldValue: 'salty bl-reader', target: t('salty bl-reader bl-bars-hidden') }), true);
    assert.equal(perfMarkOnly({ type: 'attributes', attributeName: 'class', oldValue: 'salty bl-reader bl-bars-hidden', target: t('salty bl-reader') }), true);
    assert.equal(perfMarkOnly({ type: 'attributes', attributeName: 'class', oldValue: 'salty bl-reader', target: t('salty bl-reader bl-bars-hidden bl-weather-on') }), false, '다른 class 가 같이 바뀌면 다시 재요');
});
test('몰입 읽기로 바를 숨기고 꺼내도 문서 전체를 다시 훑거나 재지 않아요 (고치기 전: 훑기 · 0.3초 뒤 재기)', () => {
    const r = rig();
    const top = new El('DIV', r.body), button = new El('BUTTON', top);
    r.flush();
    assert.equal(button.hasAttribute('data-bl-squared'), true, '처음엔 잰다');
    r.body.queries = 0; button.reads = 0;
    r.host.notify([flip(r.body, ['bl-bars-hidden'])]);
    r.flush();
    r.host.notify([flip(r.body, [], ['bl-bars-hidden'])]);
    r.flush();
    assert.equal(r.body.queries, 0, 'querySelectorAll(후보) 없음');
    assert.equal(button.reads, 0, 'getBoundingClientRect 없음');
    r.stop();
});
test('body 의 다른 class 가 바뀌면(테마 켜고 끄기 등) 지금처럼 다시 재요', () => {
    const r = rig();
    new El('BUTTON', new El('DIV', r.body));
    r.flush(); r.body.queries = 0;
    r.host.notify([flip(r.body, ['salty-qr-top'])]);
    r.flush();
    assert.ok(r.body.queries > 0);
    r.stop();
});
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/squared-reader-bars.mjs .'), 'release-check.yml 에 등록');
console.log(`네모 단추 · 몰입 읽기 바: ${pass}개 통과했어요.`);
