// 10-30 perf-gaps: 긴 채팅 가볍게(src/chat-light.js)가 화면 밖 메시지(#chat > .mes)에 content-visibility:auto 를 걸면, 네모 단추 감시(src/squared-buttons.js)가
// 그 안 후보에 offsetParent 를 물을 때마다 크롬이 그 메시지만 풀어 스타일 · 배치를 그 자리에서 계산했어요(긴 채팅 300 열기 · 폰 4배: 배치 300번 · 약 5초,
// 스크롤 중 body class 가 바뀐 뒤 훑기 0.5~6초). 고친 뒤: checkVisibility({ contentVisibilityAuto: true }) 로 「건너뛴 메시지 안」인지만 보고(풀지 않음)
// 그 메시지는 적어 두었다가 크롬이 계산을 시작할 때(contentvisibilityautostatechange · skipped=false) 그 메시지만 재요. 판정 · 표시 결과는 같아요.
//   node tools/tests/squared-light-skip.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const mod = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')));
const { watchSquaredButtons } = mod;
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
let reads = 0;
class El {
    constructor(tag, parent = null, { id = '', cls = '' } = {}) { this.tagName = tag; this.parentElement = parent; this.nodeType = 1; this.isConnected = true; this.children = []; this.attrs = new Set(); this.dataset = {}; this.id = id; this.cls = new Set(cls.split(' ').filter(Boolean)); this.innerText = '시험 단추'; this.cv = 'visible'; this.skipped = false; parent?.children.push(this);
        this.classList = { contains: c => this.cls.has(c), add: c => this.cls.add(c), remove: c => this.cls.delete(c) }; }
    get className() { return [...this.cls].join(' '); }
    getAttribute(k) { return k === 'class' ? this.className : null; }
    get offsetParent() { if (this.lockedBy()) reads++; return {}; }
    isMes() { return this.cls.has('mes') && this.parentElement?.id === 'chat'; }
    lockedBy() { for (let p = this.parentElement; p; p = p.parentElement) if (p.cv === 'auto' && p.skipped) return p; return null; }
    checkVisibility(o = {}) { if (!o.contentVisibilityAuto) { if (this.lockedBy()) reads++; return true; } return !this.lockedBy(); }
    matches(s) { return this.tagName === 'BUTTON' && s.startsWith('button,a,summary'); }
    closest(s) { if (s === '#chat > .mes') { for (let p = this; p; p = p.parentElement) if (p.isMes()) return p; return null; } if (s === '#chat.bl-chat-covered') { for (let p = this; p; p = p.parentElement) if (p.id === 'chat' && p.cls.has('bl-chat-covered')) return p; } return null; }
    querySelectorAll(s) { if (s && !s.startsWith('button,a,summary')) return []; const out = []; const walk = e => e.children.forEach(c => { if (c.tagName === 'BUTTON') out.push(c); walk(c); }); walk(this); return out; }
    getBoundingClientRect() { if (this.lockedBy()) reads++; return { width: 80, height: 32 }; }
    hasAttribute(k) { return this.attrs.has(k); } setAttribute(k) { this.attrs.add(k); } removeAttribute(k) { this.attrs.delete(k); }
}
function rig() {
    // 8.2.7 lean-perf: 긴 채팅 가볍게 표식은 html 에 달려요(perf-fade) — 가짜 감시자는 observe 한 뿌리의 기록만 넘겨요(html 을 안 보면 html 기록은 안 와요)
    const html = new El('HTML', null, { cls: 'bl-chat-light' });
    const body = new El('BODY', html, { cls: 'salty' }); const chat = new El('DIV', body, { id: 'chat' });
    const timers = [], frames = [], listeners = new Map(), watched = new Map();
    const under = (el, root) => { for (let p = el; p; p = p.parentElement) if (p === root) return true; return false; };
    const host = { HTMLElement: El, MutationObserver: class { constructor(cb) { host.cb = cb; } observe(target, opts) { watched.set(target, opts); } disconnect() { watched.clear(); } }, setTimeout: fn => (timers.push(fn), timers.length), clearTimeout() {}, requestAnimationFrame: fn => (frames.push(fn), frames.length), cancelAnimationFrame() {}, addEventListener() {}, removeEventListener() {},
        getComputedStyle: el => ({ contentVisibility: el.cv, display: 'block', visibility: 'visible', borderTopLeftRadius: '16px', backgroundColor: 'rgb(1,2,3)', borderTopWidth: '0', backgroundImage: 'none', boxShadow: 'none', cursor: 'pointer' }) };
    host.notify = records => { const got = records.filter(r => !r.target || [...watched].some(([t, o]) => r.target === t || (o.subtree && under(r.target, t)))); if (got.length) host.cb(got); };
    const doc = { documentElement: html, body, head: { append() {} }, createElement: () => ({ dataset: {}, remove() {} }), querySelectorAll: () => [], getElementById: id => (id === 'chat' ? chat : null),
        addEventListener: (t, fn) => listeners.set(t, fn), removeEventListener: t => listeners.delete(t) };
    const mes = []; for (let i = 0; i < 5; i++) { const m = new El('DIV', chat, { cls: 'mes' }); m.cv = i < 4 ? 'auto' : 'visible'; m.skipped = i < 3; const b = new El('BUTTON', new El('DIV', m, { cls: 'mes_text' })); b.cls.add('card-chip-' + i); m.button = b; mes.push(m); }
    const stop = watchSquaredButtons(doc, host);
    const flush = () => { while (timers.length || frames.length) { while (timers.length) timers.shift()(); while (frames.length) frames.shift()(); } };
    const unskip = m => { m.skipped = false; listeners.get('contentvisibilityautostatechange')?.({ target: m, skipped: false }); };
    return { html, body, chat, mes, host, flush, stop, unskip, listeners, watched };
}
const marked = m => m.button.hasAttribute('data-bl-squared');
test('건너뛴 메시지 안 후보는 offsetParent · 크기를 묻지 않아요 (고치기 전: 메시지마다 풀어 계산)', () => {
    const r = rig(); reads = 0; r.flush();
    assert.equal(reads, 0, '건너뛴 메시지를 푸는 읽기 0');
    assert.deepEqual(r.mes.map(marked), [false, false, false, true, true], '보이는 메시지(c-v auto 이지만 안 건너뜀 · 보통)는 예전처럼 바로');
    r.stop();
});
test('크롬이 그 메시지 계산을 시작하면(skipped=false) 다음 프레임에 그 메시지만 재서 같은 표시가 붙어요', () => {
    const r = rig(); r.flush(); reads = 0;
    r.unskip(r.mes[1]); r.flush();
    assert.equal(marked(r.mes[1]), true); assert.equal(marked(r.mes[0]), false, '아직 건너뛴 메시지는 그대로'); assert.equal(reads, 0);
    r.unskip(r.mes[0]); r.unskip(r.mes[2]); r.flush();
    assert.deepEqual(r.mes.map(marked), [true, true, true, true, true], '끝까지 굴리면 예전(바로 재기)과 같은 표시');
    r.stop();
});
test('새로 안 생김새는 건너뛴 메시지 안 같은 생김새에도 재지 않고 바로 붙어요', () => {
    const r = rig();
    for (const m of r.mes) { m.button.cls.clear(); m.button.cls.add('same-chip'); }
    r.flush();
    assert.deepEqual(r.mes.map(marked), [true, true, true, true, true]); assert.equal(reads, 0);
    r.stop();
});
test('긴 채팅 가볍게가 꺼지면(html 의 bl-chat-light 빠짐 · 사건 없음) 적어 둔 메시지를 다시 재요', () => {
    const r = rig(); r.flush();
    assert.deepEqual(r.watched.get(r.html), { attributes: true, attributeOldValue: true, attributeFilter: ['class'] }, 'html 은 자기 class 만(subtree 없음) 봐요');
    const old = r.html.className; r.html.cls.delete('bl-chat-light'); for (const m of r.mes) { m.cv = 'visible'; m.skipped = false; }
    r.host.notify([{ type: 'attributes', attributeName: 'class', oldValue: old, target: r.html }]); r.flush();
    assert.deepEqual(r.mes.map(marked), [true, true, true, true, true]);
    r.stop();
});
test('html 의 다른 class 기록(몰입 읽기 바 숨김 등)은 문서를 다시 훑지 않아요', () => {
    const r = rig(); r.flush(); reads = 0;
    let walks = 0; const qsa = El.prototype.querySelectorAll; El.prototype.querySelectorAll = function (s) { walks++; return qsa.call(this, s); };
    r.html.cls.add('bl-bars-hidden'); r.host.notify([{ type: 'attributes', attributeName: 'class', oldValue: 'bl-chat-light', target: r.html }]); r.flush();
    El.prototype.querySelectorAll = qsa;
    assert.equal(walks, 0); assert.deepEqual(r.mes.map(marked), [false, false, false, true, true], '건너뛴 메시지는 그대로 미뤄 둬요');
    r.stop();
});
test('서랍 덮개(bl-chat-covered) 동안에는 예전 길 그대로(미루지 않음)', () => {
    const r = rig(); r.chat.cls.add('bl-chat-covered'); reads = 0;
    r.host.notify([{ type: 'childList', addedNodes: [r.body] }]); r.flush();
    r.stop();
    assert.equal(typeof mod.skippedMessageOf, 'function');
});
test('stop 하면 상태 사건 리스너를 떼요', () => { const r = rig(); r.stop(); assert.equal(r.listeners.has('contentvisibilityautostatechange'), false); });
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/squared-light-skip.mjs .'), 'release-check.yml 에 등록');
console.log(`네모 단추 · 긴 채팅 가볍게: ${pass}개 통과했어요.`);
