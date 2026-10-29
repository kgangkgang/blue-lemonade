// 데우스 감정 대사(src/dem-expressive.js): 메시지 이벤트는 그 메시지만 훑어요(dem-sky.js 8.1.1 과 같은 방식).
//   예전에는 답이 하나 그려지거나 · 스와이프 · 수정될 때마다 80/800/3000ms 세 번 채팅의 모든 메시지 원문을 정규식으로 훑고 본문을 다시 봤어요.
//   채팅 열기 · 더 불러오기 · 이벤트에 번호가 없을 때만 채팅 전체예요. 감싸는 결과는 같아요(이미 감싼 대사는 건너뛰어요).
//   지어낸 글만: node tools/tests/dem-expressive-scope.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');

// 아주 작은 DOM 가짜 — dem-expressive.js 가 메시지 하나를 감쌀 때 쓰는 것만
class Node_ {
    constructor(tag, text = '') { this.tagName = tag; this.nodeType = 1; this.children = []; this.parentNode = null; this.ownText = text; this.cls = new Set(); this.attrs = {}; }
    get parentElement() { return this.parentNode; }
    get textContent() { return this.ownText + this.children.map(c => c.textContent).join(''); }
    set className(v) { this.cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get classList() { const s = this.cls; return { contains: c => s.has(c), toggle: (c, on) => { if (on) s.add(c); else s.delete(c); }, add: c => s.add(c), remove: (...c) => c.forEach(x => s.delete(x)) }; }
    insertBefore(node, ref) { node.parentNode = this; this.children.splice(this.children.indexOf(ref), 0, node); }
    appendChild(node) { if (node.parentNode) { const p = node.parentNode.children; p.splice(p.indexOf(node), 1); } node.parentNode = this; this.children.push(node); }
    contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
    all() { return this.children.flatMap(c => [c, ...c.all()]); }
    closest(sel) { for (let x = this; x; x = x.parentNode) if (x.is?.(sel)) return x; return null; }
    is(sel) { return sel.split(',').some(s => { s = s.trim(); if (s === 'p') return this.tagName === 'P'; if (s.startsWith('.')) return this.cls.has(s.slice(1).split(':')[0]); return s.split(/[\s[]/)[0].toUpperCase() === this.tagName; }); }
    matches(sel) { return this.is(sel); }
    querySelectorAll(sel) { return this.all().filter(n => n.is(sel)); }
    get previousSibling() { const p = this.parentNode?.children || []; return p[p.indexOf(this) - 1] || null; }
}
const visits = new Map();
const N = 40;
const messages = Array.from({ length: N }, (_, i) => ({ mes: i === N - 1 ? '그가 웃었다. <excited>「드디어 찾았어!」</excited>' : `지어낸 문단 ${i}. 대사는 없어요.` }));
const mesEls = messages.map((m, i) => {
    const body = new Node_('DIV'); body.cls.add('mes_text');
    if (i === N - 1) body.appendChild(new Node_('Q', '「드디어 찾았어!」'));
    return { id: i, body, getAttribute: k => (k === 'mesid' ? String(i) : null), querySelector: sel => { if (sel === '.mes_text') { visits.set(i, (visits.get(i) || 0) + 1); return body; } return null; } };
});
const timers = [];
const events = {};
globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
globalThis.clearTimeout = id => { if (timers[id - 1]) timers[id - 1].fn = () => {}; };
const runTimers = () => { for (const t of timers.splice(0).sort((a, b) => a.ms - b.ms)) t.fn(); };
globalThis.document = {
    addEventListener() {}, getElementsByClassName: () => [], getElementById: () => null, body: { toggleAttribute() {} },
    createElement: tag => new Node_(tag.toUpperCase()),
    createTreeWalker: () => ({ nextNode: () => null }),   // 가짜 DOM 의 글자는 노드가 아니라서 문단 속 대사 길은 비어요
    querySelectorAll: sel => (sel === '#chat .mes[mesid]' ? mesEls : []),
    querySelector: sel => { const m = /^#chat \.mes\[mesid="(\d+)"\]$/.exec(sel); return m ? mesEls[Number(m[1])] || null : null; },
};
globalThis.NodeFilter = { SHOW_TEXT: 4 };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.SillyTavern = { getContext: () => ({ chat: messages, eventSource: { on: (n, f) => { (events[n] ||= []).push(f); }, removeListener() {} }, event_types: { CHAT_CHANGED: 'chat', CHARACTER_MESSAGE_RENDERED: 'char', USER_MESSAGE_RENDERED: 'user', MORE_MESSAGES_LOADED: 'more', MESSAGE_UPDATED: 'upd', MESSAGE_SWIPED: 'swp', MESSAGE_EDITED: 'edit' } }) };
const fire = (name, ...args) => (events[name] || []).forEach(f => f(...args));
const fx = await import(pathToFileURL(path.join(root, 'src/dem-expressive.js')).href);

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
fx.syncDemExpressive(true); runTimers(); visits.clear();
const wrapped = () => mesEls[N - 1].body.querySelectorAll('.custom-dem-expressive').length;
check('켤 때(채팅 전체)도 감정 대사를 감싸요', () => assert.equal(wrapped(), 1));
check('답 하나가 그려지면 그 메시지만 훑어요(세 번 모두)', () => {
    fire('char', N - 1, 'normal'); runTimers();
    assert.deepEqual([...visits.keys()], [N - 1], `훑은 메시지 ${visits.size}개`);
    assert.equal(wrapped(), 1, '이미 감싼 대사는 그대로');
});
check('수정 · 스와이프 · 내 메시지도 그 메시지만', () => {
    for (const [name, id] of [['edit', 3], ['swp', N - 1], ['user', 7], ['upd', 5]]) { visits.clear(); fire(name, id); runTimers(); assert.deepEqual([...visits.keys()], [id], name); }
});
check('잇달아 온 이벤트는 모아서 같이 훑어요', () => { visits.clear(); fire('upd', 2); fire('upd', 9); runTimers(); assert.deepEqual([...visits.keys()].sort((a, b) => a - b), [2, 9]); });
check('채팅 열기 · 더 불러오기 · 번호 없는 이벤트는 채팅 전체', () => {
    for (const [name, arg] of [['chat', 'some-chat-id'], ['chat', '1730000000000'], ['more'], ['upd', undefined]]) { visits.clear(); fire(name, arg); runTimers(); assert.equal(visits.size, N, name); }
});
check('다시 그려진 메시지(감싼 칸이 사라짐)는 그 메시지 이벤트로 다시 감싸요', () => {
    const body = mesEls[N - 1].body; body.children = []; body.appendChild(new Node_('Q', '「드디어 찾았어!」'));
    fire('swp', N - 1); runTimers(); assert.equal(wrapped(), 1);
});
console.log(`dem-expressive-scope: ${passed} passed`);
