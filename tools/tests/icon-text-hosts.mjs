// 10-30 perf-icon: src/icon-text.js 의 서랍 줄 표식 훑기가 「모든 요소를 TreeWalker 로 돌기」에서 「바뀔 수 있는 요소만 선택자로 모으기」(rowHosts)로 바뀐 뒤에도
//   ① 끝 표식이 예전 훑기와 같은지(무작위 나무 400개 · 표식이 미리 붙은 요소 · #chat · .mes · svg 가지 포함) ② 뿌리 자신도 후보가 되는지,
//   ③ 줄 검사는 그 자식 특징이 있는 것만 도는지(35가지를 다 돌리지 않음)
//   ④ 감시 콜백 하나에서 같은 메시지를 여러 번 재지 않는지(메시지 안 30곳이 바뀌어도 checkMes 1번 · 같은 값 기록은 0번) 봐요(가짜 DOM, 브라우저 없음)
//   node tools/tests/icon-text-hosts.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

// ---------------------------------------------------------------- 가짜 DOM(이 시험에 필요한 만큼: 단순 선택자 목록 · closest · 클래스 · 태그 모으기)
const counts = { editing: 0, matches: 0, contains: 0 };
class El {
    constructor(tag, cls = '', attrs = {}) {
        this.localName = tag; this.nodeType = 1; this.isConnected = true; this.parentElement = null; this.children = []; this.attrs = { ...attrs };
        this.id = attrs.id || ''; this.name = attrs.name || ''; this.type = attrs.type || ''; this.cls = cls.split(/\s+/).filter(Boolean);
        const self = this;
        this.classList = { contains: c => { counts.contains++; return self.cls.includes(c); }, get length() { return self.cls.length; }, *[Symbol.iterator]() { yield* self.cls; } };
    }
    get className() { return this.cls.join(' '); }
    append(...kids) { for (const k of kids) { k.parentElement = this; this.children.push(k); } return this; }
    get firstElementChild() { return this.children[0] || null; }
    get nextElementSibling() { const s = this.parentElement?.children; return s ? s[s.indexOf(this) + 1] || null : null; }
    get childElementCount() { return this.children.length; }
    get firstChild() { return this.children[0] || null; }
    get nextSibling() { return this.nextElementSibling; }
    getAttribute(a) { return a in this.attrs ? this.attrs[a] : null; }
    hasAttribute(a) { return a in this.attrs; }
    setAttribute(a, v) { this.attrs[a] = String(v); }
    removeAttribute(a) { delete this.attrs[a]; }
    one(sel) { sel = sel.trim(); if (sel.startsWith('#')) return this.id === sel.slice(1); if (sel.startsWith('.')) return this.cls.includes(sel.slice(1)); if (sel.startsWith('[')) return this.hasAttribute(sel.slice(1, -1)); return this.localName === sel; }
    matches(sel) { counts.matches++; return sel.split(',').some(s => this.one(s)); }
    closest(sel) { for (let p = this; p; p = p.parentElement) if (sel.split(',').some(s => p.one(s))) return p; return null; }
    *walk() { for (const k of this.children) { yield k; yield* k.walk(); } }
    querySelectorAll(sel) { const list = sel.split(','); return [...this.walk()].filter(e => list.some(s => e.one(s))); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    getElementsByClassName(c) { if (c === 'edit_textarea') counts.editing++; return [...this.walk()].filter(e => e.cls.includes(c)); }
    getElementsByTagName(t) { return [...this.walk()].filter(e => e.localName === t); }
}
const mod = await import(pathToFileURL(path.join(root, 'src/icon-text.js')).href);
const { rowTokens, rowHosts } = mod;
assert.equal(typeof rowHosts, 'function', 'rowHosts 를 내보내요');

// 예전 훑기(lean-827 까지) 그대로 — 기준
const NOT_HOST = new Set(['script', 'style', 'template', 'svg', 'path', 'g', 'use', 'select', 'option', 'optgroup', 'textarea', 'input', 'img', 'video', 'canvas', 'iframe', 'br', 'hr', 'i']);
const isRowHost = el => !NOT_HOST.has(el.localName) && !el.closest('svg');
const inMessage = el => !!el.closest('#chat,.mes');
function* oldWalk(r) {   // TreeWalker: 뿌리 + 자손, #chat · .mes 가지는 통째로 뺌
    yield r;
    const rec = function* (e) { for (const k of e.children) { if (k.id === 'chat' || k.cls.includes('mes')) continue; yield k; yield* rec(k); } };
    yield* rec(r);
}
const oldVisits = r => (inMessage(r) ? [] : [...oldWalk(r)].filter(el => (el.firstElementChild || el.hasAttribute('data-bl-row')) && isRowHost(el)));
const checkRow = el => { const v = rowTokens(el); if (v) el.setAttribute('data-bl-row', v); else el.removeAttribute('data-bl-row'); };

// 지어낸 무작위 나무(고정 씨앗)
let seed = 20261030;
const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return (seed >>> 8) % n; };   // 아래 비트는 번갈아 나와 위 비트를 써요
const TAGS = ['div', 'span', 'small', 'label', 'select', 'input', 'h4', 'form', 'li', 'i', 'b', 'svg', 'g'];
const CLASSES = ['', '', '', 'flex-container', 'range-block', 'range-block-title', 'range-block-range-and-counter', 'neo-range-slider', 'neo-range-input', 'checkbox_label', 'inline-drawer', 'menu_button_icon', 'fa-folder-plus', 'flex1', 'wide100p', 'salty-slider', 'mes', 'mes_text'];
const IDS = ['', '', '', '', '', '', 'chat', 'stream_toggle', 'regex_presets', 'openai_max_context', 'bl-response-range'];
function tree(depth) {
    const el = new El(TAGS[rnd(TAGS.length)], CLASSES[rnd(CLASSES.length)], {});
    const id = IDS[rnd(IDS.length)]; if (id) { el.id = id; el.attrs.id = id; }
    if (el.localName === 'input') { el.type = ['number', 'checkbox', 'text'][rnd(3)]; el.attrs.type = el.type; }
    if (rnd(9) === 0) el.attrs['data-bl-row'] = ['sel', 'neo', 'chk'][rnd(3)];   // 예전에 붙어 남은 표식(지워져야 할 수도)
    if (depth > 0) for (let i = rnd(5); i > 0; i--) el.append(tree(depth - 1));
    return el;
}
const clone = el => { const c = new El(el.localName, el.className, el.attrs); c.id = el.id; c.name = el.name; c.type = el.type; for (const k of el.children) c.append(clone(k)); return c; };
const snapshot = r => [r, ...r.walk()].map(e => e.getAttribute('data-bl-row') || '').join('|');

await test('끝 표식이 예전 훑기와 같아요(무작위 나무 400개 · 남은 표식 · #chat · .mes · svg 가지)', () => {
    let oldN = 0, newN = 0, changed = 0;
    for (let t = 0; t < 400; t++) {
        const a = new El('div', 'drawer-content').append(tree(5)); const b = clone(a);
        const visits = oldVisits(a); oldN += visits.length;
        for (const el of visits) { const before = el.getAttribute('data-bl-row') || ''; checkRow(el); if ((el.getAttribute('data-bl-row') || '') !== before) changed++; }
        const hosts = inMessage(b) ? [] : [...rowHosts(b)].filter(el => isRowHost(el) && !inMessage(el)); newN += hosts.length;
        for (const el of hosts) checkRow(el);
        assert.equal(snapshot(b), snapshot(a), `나무 ${t} 의 표식이 예전과 달라요`);
    }
    assert.ok(changed > 300, `시험 나무에서 표식이 실제로 바뀐 요소가 있어야 해요(${changed})`);
    assert.ok(newN < oldN, `재는 요소 ${newN} 가 예전 ${oldN} 보다 적어야 해요`);
    console.log(`        재는 그릇 예전 ${oldN} → ${newN}`);
});

await test('뿌리 자신도 후보가 되고, 메시지 안 뿌리는 훑지 않아요', () => {
    const solo = new El('div', 'flex-container').append(new El('select'));
    assert.ok(rowHosts(solo).has(solo), '자식에 select 가 있는 뿌리');
    const lab = new El('label').append(new El('span').append(new El('select')));
    assert.ok(rowHosts(lab).has(lab), '자손에 select 가 있는 label 뿌리(dsel)');
    const marked = new El('div', '', { 'data-bl-row': 'sel' });
    assert.ok(rowHosts(marked).has(marked), '표식만 남은 뿌리(지워야 함)');
    const rb = new El('div', 'range-block').append(new El('div').append(new El('input', '', { id: 'stream_toggle' })));
    assert.ok(rowHosts(rb).has(rb), '.range-block 뿌리(자손 아이디)');
});

await test('걸릴 자식이 input 하나뿐인 줄은 그 특징이 필요한 검사만 돌아요(35가지를 다 돌리지 않음)', () => {
    const row = new El('div', 'flex-container').append(new El('span', 'a b'), new El('input', 'text_pole', { type: 'number' }), new El('small', 'c'), new El('div', 'd e'));
    counts.contains = 0;
    assert.equal(rowTokens(row), 'numin');
    assert.ok(counts.contains <= 6, `클래스 확인 ${counts.contains}번 — 35가지를 다 돌리면 60번 가까이`);
});

// ---------------------------------------------------------------- 감시 콜백: 같은 메시지는 한 번만
await test('메시지 안 30곳이 한 콜백에서 바뀌어도 그 메시지는 한 번만 재요', async () => {
    let cb = null;
    globalThis.MutationObserver = class { constructor(f) { cb = f; } observe() {} };
    const body = new El('body'); const chat = new El('div', '', { id: 'chat' });
    const mes = new El('div', 'mes'); const block = new El('div', 'mes_block'); const text = new El('div', 'mes_text');
    const spans = Array.from({ length: 30 }, () => new El('span'));
    text.append(...spans); block.append(text); mes.append(block); chat.append(mes); body.append(chat);
    globalThis.document = { body };
    mod.startIconTextMark();
    assert.ok(cb, '감시자를 걸어요');
    counts.editing = 0;
    cb(spans.map(s => ({ type: 'attributes', attributeName: 'class', target: s, addedNodes: [] })));
    assert.equal(counts.editing, 1, `checkMes(edit_textarea 찾기) ${counts.editing}번 — 1번이어야 해요`);
    // 같은 값으로 다시 쓴 class 기록(실리태번 refreshSwipeButtons 의 없는 클래스 빼기)은 아예 재지 않아요
    counts.editing = 0;
    cb(spans.map(s => ({ type: 'attributes', attributeName: 'class', oldValue: s.getAttribute('class'), target: s, addedNodes: [] })));
    assert.equal(counts.editing, 0, `값이 같은 기록에 checkMes ${counts.editing}번`);
    // 편집칸이 생기면 표식은 그대로 따라와요
    const ta = new El('textarea', 'edit_textarea'); text.append(ta);
    cb([{ type: 'childList', target: text, addedNodes: [ta] }, { type: 'attributes', attributeName: 'class', target: spans[3], addedNodes: [] }]);
    assert.equal(mes.getAttribute('data-bl-editing'), 'deep text');
});

console.log(`icon-text-hosts: ${passed}개 통과`);
