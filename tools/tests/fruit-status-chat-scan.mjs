// 8.2.7(perf-rest): 상태창 한국어(fruit-status)가 스트리밍 · 메시지 그리기처럼 카드와 상관없는 요소가 붙고 떨어질 때마다
//   #chat 전체를 querySelectorAll(카드 · iframe) 로 다시 훑지 않아요. 카드 · iframe 이거나 품은 요소가 붙고 떨어질 때만 다시 훑고,
//   결과(한국어 이름표 · 되돌리기)는 예전과 같아요.
//   node tools/tests/fruit-status-chat-scan.mjs <테마 사본>
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const {installFruitStatusKorean} = await import(pathToFileURL(path.join(root, 'src/scripts/fruit-status.js')));
const one = s => {
    // 아주 작은 선택자 판정: 태그 · #id · .class 를 이어 붙인 꼴과, 공백으로 이은 조상 꼴(마지막 칸만 이 요소)
    const part = s.trim().split(/\s+/).pop();
    return el => {
        const m = part.match(/^([a-z]+)?((?:[#.][\w-]+)*)$/i); if (!m) return false;
        if (m[1] && el.tag !== m[1].toLowerCase()) return false;
        for (const t of (m[2] || '').match(/[#.][\w-]+/g) || []) { if (t[0] === '#' ? el.attrs.id !== t.slice(1) : !(el.attrs.class || '').split(' ').includes(t.slice(1))) return false; }
        if (part !== s.trim()) { const up = s.trim().split(/\s+/)[0]; for (let p = el.parentElement; p; p = p.parentElement) if (one(up)(p)) return true; return false; }
        return true;
    };
};
const scans = {chat: 0};
class Element {
    constructor(doc, tag, attrs = {}, text = '') { this.ownerDocument = doc; this.tag = tag; this.nodeType = 1; this.attrs = {...attrs}; this.dataset = {}; this.children = []; this.listeners = new Map(); if (text) this.appendText(text); }
    appendText(text) { const node = {nodeType: 3, nodeValue: text, parentElement: this}; this.children.push(node); return node; }
    append(node) { node.parentElement = this; this.children.push(node); return node; }
    get isConnected() { return this === this.ownerDocument.body || !!this.parentElement?.isConnected; }
    matches(selector) { return selector.split(',').some(s => s.trim().startsWith('[') ? Object.hasOwn(this.attrs, s.trim().slice(1, -1).split('=')[0]) : one(s)(this)); }
    closest(s) { for (let n = this; n; n = n.parentElement) if (n.matches(s)) return n; return null; }
    querySelectorAll(s) { if (this.attrs.id === 'chat') scans.chat++; return this.walk(s); }
    walk(s) { return this.children.filter(n => n.nodeType === 1).flatMap(n => [...(n.matches(s) ? [n] : []), ...n.walk(s)]); }
    querySelector(s) { return this.walk(s)[0] || null; }
    getElementsByTagName(t) { return this.walk(t); }
    getAttribute(k) { return this.attrs[k] ?? null; } setAttribute(k, v) { this.attrs[k] = v; }
    addEventListener(k, fn) { this.listeners.set(k, fn); } removeEventListener(k, fn) { if (this.listeners.get(k) === fn) this.listeners.delete(k); }
    get text() { return this.children.map(n => n.nodeType === 3 ? n.nodeValue : n.text).join(''); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); this.parentElement = null; }
}
function documentFixture() {
    const doc = {querySelector(s) { return this.body.querySelector(s); }, createTreeWalker(el) { const nodes = []; function visit(n) { for (const c of n.children) if (c.nodeType === 3) nodes.push(c); else visit(c); } visit(el); let i = 0; return {nextNode() { this.currentNode = nodes[i++]; return !!this.currentNode; }}; }};
    doc.body = new Element(doc, 'body'); doc.head = doc.body.append(new Element(doc, 'head')); doc.createElement = tag => new Element(doc, tag); return doc;
}
const doc = documentFixture(), chat = doc.body.append(new Element(doc, 'div', {id: 'chat'}));
const frames = new Map(), timers = new Map(), observers = []; let next = 1;
const host = {requestAnimationFrame(fn) { const id = next++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id), setInterval(fn) { const id = next++; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
    MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe(node, opt) { this.node = node; this.opt = opt; } disconnect() { this.node = null; } }};
const settle = () => { for (let i = 0; frames.size && i < 8; i++) { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); } assert.equal(frames.size, 0); };
const chatObserver = () => observers.find(o => o.node === chat);
// 브라우저처럼 #chat 감시자에게 붙은 · 떨어진 노드를 알려요
const tell = (added = [], removed = []) => { chatObserver().fn([{type: 'childList', addedNodes: added, removedNodes: removed}]); settle(); };
const add = (parent, tag, attrs, text) => parent.append(new Element(parent.ownerDocument, tag, attrs, text));
const mes = add(chat, 'div', {class: 'mes'}), text = add(mes, 'div', {class: 'mes_text'});
const card = add(text, 'div', {class: 'fate-status-wrapper'}), label = add(card, 'span', {class: 'fate-grid-label'}, 'DATE');
const stop = installFruitStatusKorean(doc, host); settle();
assert.equal(label.text, '날짜', '처음엔 카드 이름표를 한국어로 바꿔요');
const base = scans.chat;
// ① 스트리밍처럼 카드 없는 글 칸 내용이 바뀌어요(붙음 · 떨어짐) — #chat 을 다시 훑지 않아요
for (let i = 0; i < 25; i++) { const p = new Element(doc, 'p', {}, '지어낸 글 ' + i); add(p, 'q', {}, '말'); add(p, 'em', {}, '몸짓'); text.append(p); tell([p], i ? [{nodeType: 3}] : []); }
const m2 = add(chat, 'div', {class: 'mes'}); add(add(m2, 'div', {class: 'mes_buttons'}), 'div', {class: 'mes_button'}); tell([m2]);
m2.remove(); tell([], [m2]);
assert.equal(scans.chat - base, 0, `카드와 상관없는 요소가 붙고 떨어질 때 #chat 전체를 다시 훑지 않아요(훑음 ${scans.chat - base}번)`);
// ② 카드를 품은 새 메시지가 붙으면 그때 다시 훑어 한국어로 바꿔요
const m3 = new Element(doc, 'div', {class: 'mes'}), t3 = add(m3, 'div', {class: 'mes_text'}), c3 = add(t3, 'div', {class: 'fate-status-wrapper'}), l3 = add(c3, 'span', {class: 'fate-grid-label'}, 'TIME');
chat.append(m3); tell([m3]);
assert.equal(l3.text, '시간', '카드를 품은 메시지가 붙으면 바꿔요');
// ③ 카드 자체가 바로 붙어도
const c4 = new Element(doc, 'div', {class: 'swiss-island'}), l4 = add(c4, 'span', {class: 'status-text'}, 'AUDIO LOG'); text.append(c4); tell([c4]);
assert.equal(l4.text, '음악', '카드가 바로 붙어도 바꿔요');
// ④ 조상 선택자(.mobile-screen #settings-panel) 꼴: 안쪽 칸만 붙어도
const screen = add(text, 'div', {class: 'mobile-screen'}); tell([screen]);
const panel = new Element(doc, 'div', {id: 'settings-panel'}), title = add(panel, 'div', {class: 'settings-title'}, '显示设置'); screen.append(panel); tell([panel]);
assert.equal(title.text, '표시 설정', '조상 선택자 꼴 카드도 붙으면 바꿔요');
// ⑤ iframe 이 붙으면 다시 훑어 그 문서를 봐요
const frame = new Element(doc, 'iframe', {}), inner = documentFixture(); frame.contentDocument = inner; const ic = add(inner.body, 'div', {class: 'fate-status-wrapper'}), il = add(ic, 'span', {class: 'fate-grid-label'}, 'LOC.');
text.append(frame); tell([frame]);
assert.equal(il.text, '장소', 'iframe 이 붙으면 그 문서 카드도 바꿔요');
// ⑥ 카드를 품은 메시지가 떨어지면 다시 훑어 감시를 풀어요(예전과 같음)
const before = observers.filter(o => o.node).length; m3.remove(); tell([], [m3]);
assert.equal(observers.filter(o => o.node).length, before - 1, '떨어진 카드의 감시를 풀어요');
// ⑦ 알 수 없는 노드(요소인지만 아는 기록)는 예전처럼 다시 훑어요
const s7 = scans.chat; tell([{nodeType: 1}]); assert(scans.chat > s7, '판정할 수 없는 요소 기록은 예전처럼 다시 훑어요');
stop(); assert.equal(label.text, 'DATE'); assert.equal(l4.text, 'AUDIO LOG');
console.log('fruit-status-chat-scan: 상관없는 붙음 · 떨어짐 0번 훑기 · 카드 붙음 · 조상 꼴 · iframe · 떨어짐 · 알 수 없는 기록 · 되돌리기 통과');
