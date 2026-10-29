// 8.2.6 성능: 과일 상태창 감시가 상태창이 없는 채팅에서 덜 일하는지 (가짜 문서 · 가짜 타이머)
//   1) 바로가기(fruit-type-shortcuts) 1.5초 타이머: 과일 창 · 데우스 창 확인을 아이디로 — 쉼표 선택자 목록 querySelector 로 문서를 훑지 않고 판단은 같아요
//   2) 같은 타이머의 iframe 문서 요소 수는 살아 있는 목록으로 — 틱마다 querySelectorAll('*') 를 새로 만들지 않아요
//   3) 글자 설정(fruit-type-runtime): 켠 글꼴이 없으면 채팅 감시는 붙은 요소에서 iframe 만 찾아요(뿌리 선택자 목록으로 메시지를 훑지 않음)
//   node tools/tests/fruit-watch-scope.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {} }) };

const asked = [];   // querySelector · querySelectorAll · matches 로 물은 선택자
class El {
    constructor(doc, tag, attrs = {}) { this.ownerDocument = doc; this.localName = tag; this.nodeType = 1; this.attrs = { ...attrs }; this.children = []; this.parentElement = null; this.dataset = {}; this.style = {}; const self = this; this.classList = { contains: c => String(self.attrs.class || '').split(/\s+/).includes(c) }; }
    get id() { return this.attrs.id || ''; }
    get isConnected() { return true; }
    append(...n) { for (const c of n) { c.parentElement = this; this.children.push(c); } return n[0]; }
    matches(sel) { asked.push(sel); return sel.split(',').some(s => s.trim() === this.localName || s.trim() === '.' + this.attrs.class || s.trim() === '#' + this.id); }
    querySelectorAll(sel) { asked.push(sel); const out = []; const walk = e => { for (const c of e.children) { if (sel.split(',').some(s => s.trim() === c.localName)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    closest() { return null; }
    // 살아 있는 목록 흉내(브라우저가 DOM 이 바뀔 때만 다시 세는 것) — 셀 때 선택자를 묻지 않아요
    getElementsByTagName(t) { const self = this; const all = () => { const out = []; const walk = e => { for (const c of e.children) { if (t === '*' || c.localName === t) out.push(c); walk(c); } }; walk(self); return out; }; return { get length() { return all().length; }, *[Symbol.iterator]() { yield* all(); } }; }
    addEventListener() {} removeEventListener() {} after() {} remove() {}
}
function fakeDoc() {
    const doc = { nodeType: 9, ids: new Map(), addEventListener() {}, removeEventListener() {}, fonts: null };
    doc.createElement = tag => new El(doc, tag);
    doc.body = new El(doc, 'body'); doc.head = new El(doc, 'head'); doc.documentElement = new El(doc, 'html');
    doc.getElementById = id => doc.ids.get(id) || null;
    doc.querySelector = sel => { asked.push(sel); if (sel === '#chat') return doc.ids.get('chat') || null; return null; };
    doc.querySelectorAll = sel => { asked.push(sel); return []; };
    return doc;
}
function fakeHost() {
    const frames = new Map(), timers = new Map(), observers = []; let next = 1;
    const host = {
        requestAnimationFrame(fn) { const id = next++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
        setInterval(fn) { const id = next++; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
        MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe(node) { this.node = node; } disconnect() { this.node = null; } },
    };
    const tick = () => { for (const fn of [...timers.values()]) fn(); };
    const settle = () => { for (let i = 0; frames.size && i < 8; i++) { const b = [...frames.values()]; frames.clear(); b.forEach(fn => fn()); } };
    return { host, frames, timers, observers, tick, settle };
}
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);

await test('바로가기 타이머: 창이 없으면 다시 보지 않고 문서를 선택자 목록으로 훑지 않아요 · 과일 창이 열리거나 데우스 창이 있으면 다시 봐요', async () => {
    const { installFruitTypeShortcuts } = await imp('src/fruit-type-shortcuts.js');
    const doc = fakeDoc(), H = fakeHost();
    const chat = new El(doc, 'div', { id: 'chat' }); doc.body.append(chat); doc.ids.set('chat', chat);
    const stop = installFruitTypeShortcuts(doc, H.host); H.settle();
    asked.length = 0;
    for (let i = 0; i < 20; i++) { H.tick(); assert.equal(H.frames.size, 0, `${i + 1}번째 틱이 다시 훑음`); }
    assert.ok(!asked.some(s => s.includes('#fruit-heart-v6.open')), '창 확인을 선택자 목록으로 물음');
    assert.ok(!asked.includes('*'), '요소 수를 querySelectorAll(*) 로 셈');
    const panel = new El(doc, 'div', { id: 'fruit-heart-v6' }); doc.ids.set('fruit-heart-v6', panel);
    H.tick(); assert.equal(H.frames.size, 0, '닫힌 과일 창만으로 다시 훑음');
    panel.attrs.class = 'open'; H.tick(); assert.equal(H.frames.size, 1, '열린 과일 창인데 다시 안 봄'); H.settle();
    panel.attrs.class = ''; H.tick(); assert.equal(H.frames.size, 0);
    doc.ids.set('bl-deus-popover', new El(doc, 'div', { id: 'bl-deus-popover' })); H.tick(); assert.equal(H.frames.size, 1, '데우스 창인데 다시 안 봄'); H.settle();
    stop();
});
await test('바로가기 타이머: iframe 문서의 요소 수가 바뀌면 다시 보고, 그대로면 안 봐요(살아 있는 목록 · 같은 수)', async () => {
    const { installFruitTypeShortcuts } = await imp('src/fruit-type-shortcuts.js');
    const doc = fakeDoc(), H = fakeHost();
    const chat = new El(doc, 'div', { id: 'chat' }); doc.body.append(chat); doc.ids.set('chat', chat);
    const inner = fakeDoc(); let lists = 0; const orig = inner.getElementsByTagName; inner.getElementsByTagName = t => { lists++; return inner.body.getElementsByTagName(t); };
    const frame = new El(doc, 'iframe'); frame.contentDocument = inner; chat.append(new El(doc, 'div', { class: 'mes' })).append(frame);
    const stop = installFruitTypeShortcuts(doc, H.host); H.settle();
    asked.length = 0;
    for (let i = 0; i < 5; i++) { H.tick(); assert.equal(H.frames.size, 0); }
    assert.equal(lists, 1, `요소 목록은 문서마다 한 번만 만들어요(${lists})`);
    assert.ok(!asked.includes('*'));
    inner.body.append(new El(inner, 'div')); H.tick(); assert.equal(H.frames.size, 1, 'iframe 안에 요소가 늘었는데 다시 안 봄');
    void orig; stop();
});
await test('글자 설정: 켠 글꼴이 없으면 채팅 감시는 iframe 만 찾고(메시지마다 뿌리 선택자 목록 없음), iframe 이 붙으면 다시 봐요 · 켜면 예전처럼 뿌리까지', async () => {
    const { watchFruitTypography } = await imp('src/fruit-type-runtime.js');
    const { tidyFruitType, fruitTypeCss } = await imp('src/fruit-type-schema.js');
    const doc = fakeDoc(), H = fakeHost();
    const chat = new El(doc, 'div', { id: 'chat' }); doc.body.append(chat); doc.ids.set('chat', chat);
    let config = {};
    const stop = watchFruitTypography(doc, H.host, () => config, () => '');
    H.settle();
    const watcher = H.observers.find(o => o.node === chat);
    assert.ok(watcher, '채팅 감시가 있어요');
    assert.equal(fruitTypeCss(tidyFruitType(config), () => ''), '', '기본 설정은 글꼴 css 가 없어요');
    asked.length = 0;
    const mes = new El(doc, 'div', { class: 'mes' }); mes.append(new El(doc, 'div', { class: 'fate-status-wrapper' }));
    watcher.fn([{ type: 'childList', target: chat, addedNodes: [mes], removedNodes: [] }]);
    assert.equal(H.frames.size, 0, '상태창 없는 메시지로 다시 봄');
    assert.ok(asked.includes('iframe') && asked.every(s => s === 'iframe' || s === '.bl-ft-shortcut'), `물은 선택자: ${[...new Set(asked)].join(' | ').slice(0, 120)}`);
    const withFrame = new El(doc, 'div', { class: 'mes' }); withFrame.append(new El(doc, 'iframe'));
    watcher.fn([{ type: 'childList', target: chat, addedNodes: [withFrame], removedNodes: [] }]);
    assert.equal(H.frames.size, 1, 'iframe 이 붙었는데 다시 안 봄'); H.settle();
    // 글꼴 하나를 켜면 채팅 안 뿌리도 다시 봐요(예전과 같음)
    config = { on: true, ownerOn: { fruit: true }, types: { status: { layout: 'vertical' } } };
    assert.notEqual(fruitTypeCss(tidyFruitType(config), () => ''), '', '켠 설정은 css 가 있어요');
    stop.refresh(); H.settle();
    asked.length = 0;
    watcher.fn([{ type: 'childList', target: chat, addedNodes: [mes], removedNodes: [] }]);
    assert.ok(asked.some(s => s.includes('fate-status-wrapper')), '켜면 뿌리 선택자로 봐요');
    stop();
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/fruit-watch-scope\.mjs \./);
});
console.log(`\n${passed} passed`);
