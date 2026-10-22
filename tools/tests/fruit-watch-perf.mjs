// 7.7.4 폰 성능: 과일 입구(fruit-entry) · 바로가기 단추(fruit-type-shortcuts) 감시가 상관없는 변화에는 다시 훑지 않는다 (지어낸 DOM · 가짜 타이머)
//   node tools/tests/fruit-watch-perf.mjs <테마 루트>
// 측정(격리 리그 · 375×812 · CPU 6배 · 지어낸 긴 채팅 2,400개): 두 감시가 1.5초마다, 그리고 알림 · 팝업 같은 상관없는 곳이 바뀔 때마다
// 문서 전체를 훑고 QR 줄의 계산 스타일을 읽었다 — 부팅에 약 5초, 채팅 전환 10번에 약 2초.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── 작은 DOM 흉내: 태그 · #id · .class · [속성] · [속성="값"] · [속성^="값"] · 쉼표 · 자손(빈칸)
const compoundOk = (el, c) => {
    const m = c.match(/^([a-z*][\w-]*)?((?:#[\w-]+|\.[\w-]+|\[[^\]]+\])*)$/i);
    if (!m) return false;
    if (m[1] && m[1] !== '*' && el.tagName !== m[1].toUpperCase()) return false;
    for (const part of m[2].match(/#[\w-]+|\.[\w-]+|\[[^\]]+\]/g) || []) {
        if (part[0] === '#') { if (el.attrs.id !== part.slice(1)) return false; continue; }
        if (part[0] === '.') { if (!String(el.attrs.class || '').split(/\s+/).includes(part.slice(1))) return false; continue; }
        const a = part.slice(1, -1).match(/^([\w-]+)(?:(\^?=)"?([^"]*)"?)?$/);
        if (!a || !(a[1] in el.attrs)) return false;
        if (a[2] === '=' && el.attrs[a[1]] !== a[3]) return false;
        if (a[2] === '^=' && !String(el.attrs[a[1]]).startsWith(a[3])) return false;
    }
    return true;
};
const selectorOk = (el, s) => {
    const parts = s.trim().split(/\s+/);
    if (!compoundOk(el, parts.at(-1))) return false;
    let at = el.parentElement;
    for (let i = parts.length - 2; i >= 0; i--) { while (at && !compoundOk(at, parts[i])) at = at.parentElement; if (!at) return false; at = at.parentElement; }
    return true;
};
const splitList = sel => { const out = []; let depth = 0, cur = ''; for (const ch of sel) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && !depth) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
class El {
    constructor(doc, tag, attrs = {}) { this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.nodeType = 1; this.attrs = { ...attrs }; this.children = []; this.listeners = new Map(); this.parentElement = null; this.style = {}; this.hidden = false; }
    get id() { return this.attrs.id || ''; }
    get dataset() { const attrs = this.attrs, key = k => 'data-' + k.replace(/[A-Z]/g, c => '-' + c.toLowerCase()); return new Proxy({}, { get: (_, k) => typeof k === 'string' ? attrs[key(k)] : undefined, set: (_, k, v) => { attrs[key(k)] = String(v); return true; }, has: (_, k) => key(k) in attrs, deleteProperty: (_, k) => { delete attrs[key(k)]; return true; } }); }
    get childElementCount() { return this.children.length; }
    get nextElementSibling() { const p = this.parentElement; return p ? p.children[p.children.indexOf(this) + 1] || null : null; }
    get isConnected() { return this === this.ownerDocument.body || this === this.ownerDocument.head || !!this.parentElement?.isConnected; }
    set innerHTML(v) { this.children = []; }
    append(...nodes) { for (const n of nodes) { n.remove?.(); n.parentElement = this; this.children.push(n); } return nodes[0]; }
    before(n) { const p = this.parentElement; if (!p) return; n.remove?.(); n.parentElement = p; p.children.splice(p.children.indexOf(this), 0, n); }
    after(n) { const p = this.parentElement; if (!p) return; n.remove?.(); n.parentElement = p; p.children.splice(p.children.indexOf(this) + 1, 0, n); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); this.parentElement = null; }
    matches(sel) { return splitList(sel).some(s => selectorOk(this, s)); }
    closest(sel) { for (let n = this; n; n = n.parentElement) if (n.matches?.(sel)) return n; return null; }
    querySelectorAll(sel) { const out = []; const visit = n => { for (const c of n.children) { if (c.matches(sel)) out.push(c); visit(c); } }; visit(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    getAttribute(k) { return this.attrs[k] ?? null; } setAttribute(k, v) { this.attrs[k] = String(v); } hasAttribute(k) { return k in this.attrs; } removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(k, fn) { this.listeners.set(k, fn); } removeEventListener(k, fn) { if (this.listeners.get(k) === fn) this.listeners.delete(k); }
}
function fakeDoc() {
    const doc = { createElement: tag => new El(doc, tag), addEventListener() {}, removeEventListener() {} };
    doc.body = new El(doc, 'body'); doc.head = new El(doc, 'head'); doc.documentElement = new El(doc, 'html');
    doc.querySelectorAll = s => doc.body.querySelectorAll(s);
    doc.querySelector = s => doc.body.querySelector(s);
    doc.getElementById = id => id ? doc.body.querySelector('#' + id) : null;
    return doc;
}
function fakeHost() {
    const frames = new Map(), timers = new Map(), observers = []; let next = 1, reads = 0;
    const host = {
        requestAnimationFrame(fn) { const id = next++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
        setInterval(fn) { const id = next++; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
        getComputedStyle() { reads++; return { display: 'flex' }; },
        MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe(node) { this.node = node; } disconnect() { this.node = null; } takeRecords() { return []; } },
    };
    const tick = () => { for (const fn of [...timers.values()]) fn(); };
    const settle = () => { for (let i = 0; frames.size && i < 8; i++) { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); } };
    const notify = records => { for (const o of observers) if (o.node) o.fn(records); };
    return { host, frames, timers, observers, tick, settle, notify, reads: () => reads };
}
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const salty = { fruitEntryMode: 'qr', fruitEntryDisplay: 'icon', fruitEntryIcon: 'fa-apple-whole' };
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: { salty, blue_lemonade_scripts: { names: {} } } }) };

function entryFixture(doc) {
    const form = doc.body.append(new El(doc, 'div', { id: 'send_form' }));
    const nonQR = form.append(new El(doc, 'div', { id: 'nonQRFormItems' }));
    const qr = nonQR.append(new El(doc, 'div', { id: 'qr--bar' }));
    const menu = doc.body.append(new El(doc, 'div', { id: 'extensionsMenu' }));
    menu.append(new El(doc, 'div', { id: 'fruit-heart-v6-wand-entry' }));
    const toasts = doc.body.append(new El(doc, 'div', { id: 'toast-container' }));
    const chat = doc.body.append(new El(doc, 'div', { id: 'chat' }));
    return { form, nonQR, qr, menu, toasts, chat };
}

await test('과일 입구: 그대로면 1.5초 타이머가 다시 훑지 않고(10번에 한 번만), 상관없는 곳의 변화도 무시 · 입구 자리의 변화 · 설정 변화는 바로 본다', async () => {
    const { installFruitEntry } = await imp('src/scripts/fruit-entry.js');
    const doc = fakeDoc(), H = fakeHost(); const F = entryFixture(doc);
    const stop = installFruitEntry(doc, H.host);
    H.settle();
    const proxy = () => doc.body.querySelector('[data-bl-fruit-entry-proxy]');
    assert.equal(proxy()?.nextElementSibling, F.qr, '아이콘만 표시: QR 줄 바로 앞에 입구');
    assert.equal(doc.body.getAttribute('data-bl-fruit-entry'), 'qr');
    const reads0 = H.reads();
    for (let i = 0; i < 9; i++) { H.tick(); assert.equal(H.frames.size, 0, `그대로인데 ${i + 1}번째 타이머가 다시 훑음`); }
    H.tick(); assert.equal(H.frames.size, 1, '10번째는 서명과 상관없이 한 번 다시 본다'); H.settle();
    assert.equal(proxy()?.nextElementSibling, F.qr);
    // 상관없는 곳: 알림 · 채팅
    const toast = new El(doc, 'div', { class: 'toast' }); F.toasts.append(toast);
    H.notify([{ type: 'childList', target: F.toasts, addedNodes: [toast], removedNodes: [] }]);
    const msg = new El(doc, 'div', { class: 'mes' }); F.chat.append(msg);
    H.notify([{ type: 'childList', target: F.chat, addedNodes: [msg], removedNodes: [] }]);
    assert.equal(H.frames.size, 0, '알림 · 채팅 변화로 다시 훑음');
    // 입구 자리: 입력 줄이 다시 그려져 입구가 빠짐 → 바로 되돌림
    const p = proxy(); p.remove();
    H.notify([{ type: 'childList', target: F.nonQR, addedNodes: [], removedNodes: [p] }]);
    assert.equal(H.frames.size, 1, '입력 줄 변화를 못 봄'); H.settle();
    assert.equal(proxy()?.nextElementSibling, F.qr, '빠진 입구를 다시 넣음');
    // 어디선가 과일 입구 모양 요소가 새로 생김 (상관없는 곳 안이라도)
    const cat = new El(doc, 'div', { 'data-fh-cat': '1' }); F.toasts.append(cat);
    H.notify([{ type: 'childList', target: F.toasts, addedNodes: [cat], removedNodes: [] }]);
    assert.equal(H.frames.size, 1, '새 과일 입구를 못 봄'); H.settle();
    assert.ok(cat.hasAttribute('data-bl-fruit-native-entry'), '원래 입구는 숨김 표시');
    assert.ok(H.reads() - reads0 <= 3, `닫힌 상태에서 계산 스타일 읽기가 너무 많음: ${H.reads() - reads0}`);
    // 과일 창(<html> 아래)이 열려 있는 동안은 예전처럼 타이머마다 다시 본다 — 창 안 입구 고르기 줄이 늦지 않게
    const panel = new El(doc, 'div', { id: 'fruit-heart-v6' }); doc.body.append(panel);   // 흉내에서는 getElementById 가 body 아래만 찾는다
    H.tick(); H.settle();
    for (let i = 0; i < 3; i++) { H.tick(); assert.equal(H.frames.size, 0, '닫힌 과일 창만으로 다시 훑음'); }
    panel.attrs.class = 'open'; panel.classList = { contains: c => String(panel.attrs.class || '').split(/\s+/).includes(c) };
    for (let i = 0; i < 3; i++) { H.tick(); assert.equal(H.frames.size, 1, '열린 과일 창인데 다시 안 봄'); H.settle(); }
    panel.remove(); H.tick(); H.settle();
    // 설정을 바꾸면(창의 라디오가 아니라 다른 곳에서) 다음 타이머가 본다
    salty.fruitEntryMode = 'wand';
    H.tick(); assert.equal(H.frames.size, 1, '설정 변화를 못 봄'); H.settle();
    assert.equal(proxy()?.parentElement, F.menu, '요술봉 메뉴로 옮김');
    stop(); assert.equal(H.timers.size, 0); assert.equal(proxy(), null);
    salty.fruitEntryMode = 'qr';
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/fruit-watch-perf\.mjs \./);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
