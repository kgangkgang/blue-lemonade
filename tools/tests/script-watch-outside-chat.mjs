// 1.4.x opt-chat-open(고침안 8 — 내장 스크립트 감시 범위): 채팅을 열 때 내장 스크립트 쪽 감시 · 훑기가 메시지까지 닿지 않게.
//   ㄱ. 과일 입구(fruit-entry) 감시는 공용 허브 body 구역(#chat 밖) 구독 — 예전 감시자는 body 전체를 봐서 메시지 기록마다 콜백이 돌았어요(폰 4배 짧은 채팅 열기 766번)
//   ㄴ. 과일의 마음 한글화(fruit-heart)의 flush 는 #chat 밖 가지에서만 훑어요.
//   예전: 알림 · 팝업이 뜰 때마다 doc.querySelectorAll(13갈래)로 메시지 요소까지 다 훑었어요(폰 4배 · 짧은 채팅 열기 42ms · 300개 열기 101ms — 진단 diag-1).
//   잠그는 것: ① 칠하는 대상(과일 창 · 알림)은 그대로 칠해요 ② #chat 안 요소는 훑지 않아요 ③ 문서 전체 훑기는 #chat 이 없을 때만
//   node tools/tests/script-watch-outside-chat.mjs [테마 루트]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { scriptCode } from './script-code.mjs';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const code = await scriptCode(root, 'fruit-heart');
let passed = 0; const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

const visited = [];   // flush 의 한 번 훑기(FLUSH_ALL)가 지나간 요소(가짜 DOM 은 자식을 하나씩 돌아요)
class Element {
    constructor(tag = 'div', attrs = {}, text = '') { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.localName = tag; this.attrs = new Map(Object.entries(attrs)); this.children = []; this.dataset = {}; if (text) this.append({ nodeType: 3, nodeValue: text }); }
    get id() { return this.getAttribute('id') || ''; } get className() { return this.getAttribute('class') || ''; }
    get isConnected() { return this.tagName === 'HTML' || !!this.parentElement?.isConnected; }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; } setAttribute(k, v) { this.attrs.set(k, String(v)); }
    append(node) { node.parentElement = this; Object.defineProperty(node, 'isConnected', { configurable: true, get: () => this.isConnected }); this.children.push(node); }
    matches(selector) { return selector.split(',').some(part => {
        part = part.trim(); const child = part.split(/\s*>\s*/); if (child.length > 1) { const last = child.pop(); return this.matches(last) && !!this.parentElement?.matches(child.join(' > ')); }
        if (part.includes(':first-child')) { if (this.parentElement?.children.find(x => x.nodeType === 1) !== this) return false; part = part.replace(':first-child', ''); }
        part = part.trim(); const ancestry = part.split(/\s+(?![^\[]*\])/); if (ancestry.length > 1) { const last = ancestry.pop(); return this.matches(last) && !!this.parentElement?.closest(ancestry.join(' ')); }
        const no = part.match(/:not\((.*?)\)/); if (no) { if (this.matches(no[1])) return false; part = part.replace(no[0], ''); }
        part = part.replace(/\[open\]/, m => (this.attrs.has('open') ? '' : '[__never__]'));
        for (const a of part.matchAll(/\[([^=\]^]+)(?:\^?="([^"]*)")?\]/g)) if (!this.attrs.has(a[1]) || (a[2] !== undefined && !String(this.getAttribute(a[1])).startsWith(a[2]))) return false;
        part = part.replace(/\[[^\]]*\]/g, ''); const id = part.match(/#([\w-]+)/); if (id && this.id !== id[1]) return false;
        for (const c of part.matchAll(/\.([\w-]+)/g)) if (!this.className.split(/\s+/).includes(c[1])) return false;
        const tag = part.match(/^[\w-]+/); return !tag || tag[0].toUpperCase() === this.tagName;
    }); }
    closest(s) { for (let n = this; n; n = n.parentElement) if (n.matches(s)) return n; return null; }
    querySelectorAll(s) { const out = []; for (const c of this.children) if (c.nodeType === 1) { if (s.includes('#toast-container .toast-message')) visited.push(c); if (c.matches(s)) out.push(c); out.push(...c.querySelectorAll(s)); } return out; }
    getElementsByClassName(name) { const root = this; return { [Symbol.iterator]: function* () { const walk = function* (n) { for (const c of n.children) if (c.nodeType === 1) { if (c.className.split(/\s+/).includes(name)) yield c; yield* walk(c); } }; yield* walk(root); } }; }
    get text() { return this.children.filter(x => x.nodeType === 3).map(x => x.nodeValue).join(''); }
}
const add = (parent, tag, attrs, text) => { const x = new Element(tag, attrs, text); parent.append(x); return x; };

function environment({ withChat = true } = {}) {
    const html = new Element('html'), head = new Element('head'), body = new Element('body'); html.append(head); html.append(body);
    const frames = new Map(), docCalls = []; let next = 1;
    const byId = id => html.querySelectorAll('#' + id)[0];
    const doc = { documentElement: html, head, body, activeElement: null, querySelectorAll: s => { docCalls.push(s); return html.querySelectorAll(s); }, getElementById: id => byId(id), createElement: tag => new Element(tag), addEventListener() {}, removeEventListener() {},
        createTreeWalker(rootNode) { const nodes = []; const walk = n => { for (const c of n.children) { if (c.nodeType === 3) nodes.push(c); else walk(c); } }; walk(rootNode); let i = 0; return { currentNode: null, nextNode() { this.currentNode = nodes[i++]; return !!this.currentNode; } }; } };
    class Observer { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} }
    const host = { document: doc, MutationObserver: Observer, requestAnimationFrame: fn => { const id = next++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id), setInterval: () => next++, clearInterval() {}, confirm: () => false, prompt: () => '' };
    host.parent = host;
    const sheld = add(body, 'div', { id: 'sheld' });
    const chat = withChat ? add(sheld, 'div', { id: 'chat' }) : null;
    if (chat) for (let i = 0; i < 40; i++) { const mes = add(chat, 'div', { class: 'mes' }); add(add(mes, 'div', { class: 'mes_text' }), 'p', {}, 'message ' + i); }
    // 메시지 안에 우연히 class 가 popup 인 요소 — 예전에도 과일 문구가 아니면 칠하지 않았어요(지금은 훑지도 않아요)
    if (chat) add(chat.children[3], 'div', { class: 'popup' }, '首页');
    const panel = add(html, 'div', { id: 'fruit-heart-v6', class: 'open' });
    const home = add(panel, 'button', { 'data-nav': 'overview' }, '首页');
    const toasts = add(body, 'div', { id: 'toast-container' });
    const run = () => vm.runInNewContext(code, { window: host, BlueLemonade: { onCleanup() {} }, console }, { timeout: 2000 });
    return { html, body, chat, panel, home, toasts, doc, host, docCalls, run };
}

check('#chat 이 있으면 flush 는 메시지 요소를 훑지 않고 과일 창은 그대로 칠해요', () => {
    const e = environment();
    visited.length = 0; e.run();
    assert.equal(e.home.text, '홈', '과일 창 글은 칠해요');
    const inChat = visited.filter(el => el.closest('#chat') && el !== e.chat);
    assert.equal(inChat.length, 0, `#chat 안 요소 ${inChat.length}개를 훑었어요`);
    assert.ok(!e.docCalls.some(s => s.includes('#toast-container .toast-message')), '문서 전체 querySelectorAll(FLUSH_ALL) 을 부르지 않아요');
    assert.equal(e.chat.children[3].children.at(-1).text, '首页', '메시지 안 글은 손대지 않아요');
});

check('#chat 이 없으면 예전처럼 문서 전체를 한 번에 훑어요', () => {
    const e = environment({ withChat: false });
    e.run();
    assert.equal(e.home.text, '홈');
    assert.ok(e.docCalls.some(s => s.includes('#toast-container .toast-message')), '문서 전체 훑기(한 번)');
});

check('과일 입구 감시는 #chat 밖 허브 구독이에요(진짜 창) · 시험의 가짜 창은 그 창 감시자 하나', () => {
    const src = fs.readFileSync(path.join(root, 'src/scripts/fruit-entry.js'), 'utf8');
    assert.ok(src.includes("import {watchWith} from '../dom-watch.js';"));
    assert.ok(src.includes("const unwatch=watchWith(host,[[doc.body,{childList:true,subtree:true,exclude:'#chat',name:'과일 입구'}]],records=>{"));
    assert.ok(!/new host\.MutationObserver/.test(src), '따로 만든 body 전체 감시자가 없어요');
    assert.ok(src.includes('unwatch();stopRepeat(timer);'), '끌 때 구독을 끊어요');
});

console.log(`script-watch-outside-chat: ${passed} passed`);
