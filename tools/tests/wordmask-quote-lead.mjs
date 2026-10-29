// 8.2.7 잠시 가리기 × 조판의 「 머리 칸 (src/wordmask.js joinQuoteLeads) — 작은 DOM 흉내로 확인해요.
// 조판은 「민수야」를 <span class="bl-quote-lead">「민</span>수야 로 떼어 둬요. 가리기가 글자 노드 하나씩만 보면 '민수'를 못 찾았어요.
//   node tools/tests/wordmask-quote-lead.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));

class Node0 {
    constructor() { this.parentNode = null; }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    get nextSibling() { const k = this.parentNode?.childNodes; return k ? k[k.indexOf(this) + 1] ?? null : null; }
    remove() { const k = this.parentNode?.childNodes; if (k) k.splice(k.indexOf(this), 1); this.parentNode = null; }
    replaceWith(...nodes) {
        const parent = this.parentNode, k = parent.childNodes, at = k.indexOf(this);
        const flat = nodes.flatMap(n => (n.nodeType === 11 ? n.childNodes.splice(0) : [n]));
        for (const n of flat) { n.parentNode?.childNodes && n.parentNode !== parent && n.remove(); n.parentNode = parent; }
        k.splice(at, 1, ...flat); this.parentNode = null;
    }
}
class Text extends Node0 { constructor(v) { super(); this.nodeType = 3; this.nodeValue = v; } get data() { return this.nodeValue; } get textContent() { return this.nodeValue; } }
class El extends Node0 {
    constructor(tag = 'DIV', cls = '') { super(); this.nodeType = 1; this.tagName = tag; this.className = cls; this.childNodes = []; this.dataset = {}; }
    matches(sel) { return sel.split(',').map(s => s.trim()).some(s => s.split('.').filter(Boolean).every(c => this.className.split(' ').includes(c))); }
    closest(sel) { for (let e = this; e; e = e.parentElement) if (e.matches(sel)) return e; return null; }
    append(...nodes) { for (const n of nodes) { if (n.nodeType === 11) { this.append(...n.childNodes.splice(0)); continue; } n.parentNode = this; this.childNodes.push(n); } return this; }
    get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
    set textContent(v) { this.childNodes = []; this.append(new Text(String(v))); }
    *walk() { for (const n of this.childNodes) { yield n; if (n.nodeType === 1) yield* n.walk(); } }
    querySelectorAll(sel) { return [...this.walk()].filter(n => n.nodeType === 1 && n.matches(sel)); }
    normalize() {
        const out = [];
        for (const n of this.childNodes) { const last = out[out.length - 1]; if (n.nodeType === 3 && last?.nodeType === 3) last.nodeValue += n.nodeValue; else if (n.nodeType !== 3 || n.nodeValue) out.push(n); }
        this.childNodes = out;
    }
}
const chat = new El('DIV', 'chat');
const body = new El('BODY'); body.classList = { add() {}, remove() {} };
globalThis.NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
globalThis.MutationObserver = class { observe() {} disconnect() {} takeRecords() { return []; } };
globalThis.document = {
    body, getElementById: id => (id === 'chat' ? chat : null), addEventListener() {}, removeEventListener() {},
    createTextNode: v => new Text(v), createElement: tag => new El(tag.toUpperCase()),
    createDocumentFragment: () => { const f = new El('#frag'); f.nodeType = 11; return f; },
    createTreeWalker(rootEl, _show, filter) {
        const list = [...rootEl.walk()].filter(n => n.nodeType === 3 && filter.acceptNode(n) === 1);
        let i = 0; return { nextNode: () => list[i++] ?? null };
    },
};
const M = await import(pathToFileURL(path.join(root, 'src/wordmask.js')));

// 조판이 떼어 둔 모양 그대로: <q><span class="bl-quote-lead">「민</span>수야, 가자.」</q>
const message = (leadText, rest) => {
    const mes = new El('DIV', 'mes'), text = new El('DIV', 'mes_text'), q = new El('Q');
    const lead = new El('SPAN', 'bl-quote-lead'); lead.append(new Text(leadText));
    q.append(lead, new Text(rest)); text.append(q); mes.append(text); chat.append(mes);
    return { mes, text, q };
};
const a = message('「민', '수야, 가자.」');
const b = message('「하', '늘이 맑다.」');
assert.equal(M.startMask('민수\n늘이'), 2, '「 머리 칸 경계를 넘는 낱말도 가려요');
assert.equal(a.text.textContent, '「■■야, 가자.」', '이름이 보이지 않아요');
assert.equal(b.text.textContent, '「하■■ 맑다.」');
// 경계를 넘지 않는 낱말이면 머리 칸은 그대로 둬요 (조판과 서로 되풀이하지 않게)
const c = message('「바', '다 건너 민수.」');
M.startMask('민수');
assert.equal(c.q.querySelectorAll('.bl-quote-lead').length, 1, '넘지 않으면 머리 칸을 붙이지 않아요');
assert.equal(c.text.textContent, '「바다 건너 ■■.」');
// 끄면 글은 원문 그대로
M.stopMask();
assert.equal(a.text.textContent, '「민수야, 가자.」');
assert.equal(c.text.textContent, '「바다 건너 민수.」');
console.log('PASS 잠시 가리기가 조판의 「 머리 칸 경계를 넘는 이름도 가리고, 끄면 원문으로 돌아와요');
