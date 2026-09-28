// 모델 등록 1.1.1 — 실리태번이 이미 가진 모델도 맨 위 '직접 등록한 모델' 묶음에 (src/addons/models/inject.js)
// 같은 값을 둘 만들지 않고 실리태번 option을 옮겨 오며, 등록을 빼거나 끄면 원래 자리로 돌려놓는다.
// 실행: node tools/tests/model-register-move.mjs salty-ext   (jsdom 없이 작은 DOM 흉내로)
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const root = path.resolve(process.argv[2] || '.');

// ---------- 작은 DOM: select의 선택 규칙 · MutationObserver · 이벤트만
const observersAll = new Set();
let mutations = 0;
function notify(target) {
    mutations++;
    for (const observer of observersAll) {
        if (!observer.target) continue;
        if (observer.target === target || observer.target.contains(target)) {
            observer.records.push({ type: 'childList', target });
            if (!observer.queued) {
                observer.queued = true;
                queueMicrotask(() => {
                    observer.queued = false;
                    if (!observer.target || !observer.records.length) return;
                    const list = observer.records.splice(0);
                    observer.callback(list, observer);
                });
            }
        }
    }
}
class MutationObserverStub {
    constructor(callback) { this.callback = callback; this.target = null; this.records = []; this.queued = false; observersAll.add(this); }
    observe(target) { this.target = target; }
    disconnect() { this.target = null; this.records = []; }
    takeRecords() { return this.records.splice(0); }
}

class Node {
    constructor() { this.parentNode = null; this.childNodes = []; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === doc.body; }
    get nextSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) + 1] ?? null; }
    contains(node) { for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; }
    remove() {
        const p = this.parentNode;
        if (!p) return;
        p.childNodes.splice(p.childNodes.indexOf(this), 1);
        this.parentNode = null;
        selectOf(p)?.optionsChanged(this);
        notify(p);
    }
    insertBefore(node, ref) {
        if (ref && ref.parentNode !== this) throw new Error('NotFoundError');
        if (node === ref) return node;
        node.remove();
        const at = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
        this.childNodes.splice(at, 0, node);
        node.parentNode = this;
        selectOf(this)?.optionsChanged(node, true);
        notify(this);
        return node;
    }
    append(...nodes) { for (const n of nodes) this.insertBefore(n, null); }
    prepend(...nodes) { const first = this.childNodes[0] ?? null; for (const n of nodes) this.insertBefore(n, first); }
    replaceChildren(...nodes) { for (const n of [...this.childNodes]) if (!nodes.includes(n)) n.remove(); for (const n of nodes) this.insertBefore(n, null); }
}
class Text extends Node { constructor(t) { super(); this.data = t; } }
class Element extends Node {
    constructor(tag) {
        super();
        this.tagName = tag.toUpperCase();
        this.attributes = new Map();
        this.listeners = new Map();
        const self = this;
        this.dataset = new Proxy({}, {
            set(_, key, value) { self.setAttribute('data-' + key.replace(/[A-Z]/g, c => '-' + c.toLowerCase()), value); return true; },
            get(_, key) { return self.getAttribute('data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase())) ?? undefined; },
        });
    }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
    hasAttribute(k) { return this.attributes.has(k); }
    get children() { return this.childNodes.filter(n => n instanceof Element); }
    get firstElementChild() { return this.children[0] ?? null; }
    get textContent() { return this.childNodes.map(n => n instanceof Text ? n.data : n.textContent).join(''); }
    set textContent(t) { this.replaceChildren(new Text(t)); }
    get label() { return this.getAttribute('label') ?? ''; }
    set label(v) { this.setAttribute('label', v); }
    descendants() { return this.children.flatMap(c => [c, ...c.descendants()]); }
    matches(sel) {
        const m = /^(\w+)?(?:\[([\w-]+)\])?$/.exec(sel.trim());
        if (!m) throw new Error('selector not supported: ' + sel);
        return (!m[1] || this.tagName === m[1].toUpperCase()) && (!m[2] || this.hasAttribute(m[2]));
    }
    querySelectorAll(sel) {
        const scoped = /^:scope\s*>\s*(.+)$/.exec(sel);
        if (scoped) return this.children.filter(c => c.matches(scoped[1]));
        if (sel.startsWith('#')) return this.descendants().filter(c => c.id === sel.slice(1));
        return this.descendants().filter(c => c.matches(sel));
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
    addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
    dispatchEvent(event) { events.push({ type: event.type, target: this.id }); for (const fn of this.listeners.get(event.type) ?? []) fn(event); return true; }
}
class OptionElement extends Element {
    constructor() { super('option'); this.selectedness = false; this.disabled = false; }
    get value() { return this.getAttribute('value') ?? this.textContent; }
    set value(v) { this.setAttribute('value', v); }
}
class SelectElement extends Element {
    constructor() { super('select'); }
    get options() { return this.descendants().filter(n => n instanceof OptionElement); }
    get selectedIndex() { return this.options.findIndex(o => o.selectedness); }
    set selectedIndex(i) { this.options.forEach((o, n) => { o.selectedness = n === i; }); }
    get value() { return this.options.find(o => o.selectedness)?.value ?? ''; }
    set value(v) { const at = this.options.findIndex(o => o.value === v); this.selectedIndex = at; }
    // HTML의 selectedness setting algorithm (display size 1): 고른 것이 없으면 첫 항목, 둘 이상이면 마지막 것만
    optionsChanged(node, inserted = false) {
        if (inserted && node instanceof Element) {
            // 크롬처럼: 이미 골라진 option이 들어오면 그것이 골라진다
            const incoming = [node, ...node.descendants()].filter(o => o instanceof OptionElement && o.selectedness);
            if (incoming.length) for (const o of this.options) if (!incoming.includes(o)) o.selectedness = false;
        }
        const options = this.options;
        const picked = options.filter(o => o.selectedness);
        if (!picked.length) { const first = options.find(o => !o.disabled); if (first) first.selectedness = true; }
        else if (picked.length > 1) picked.slice(0, -1).forEach(o => { o.selectedness = false; });
    }
}
function selectOf(node) { for (let n = node; n; n = n.parentNode) if (n instanceof SelectElement) return n; return null; }
const doc = {
    body: new Element('body'),
    createElement(tag) { return tag === 'option' ? new OptionElement() : tag === 'select' ? new SelectElement() : new Element(tag); },
    querySelector(sel) { return doc.body.querySelector(sel); },
};
const events = [];

// ---------- inject.js를 실리태번 없이 불러온다 (import 줄을 빼고 필요한 것만 채운다)
const store = { sources: {}, picks: {} };
const stored = { claude_model: 'claude-sonnet-4-5', openrouter_model: 'c', custom_model: '', vertexai_model: 'gemini-3.7-flash' };
globalThis.__mrTest = {
    store, stored,
    SOURCES: [
        { id: 'claude', kind: 'select', selector: '#model_claude_select', key: 'claude_model' },
        { id: 'openrouter', kind: 'select', selector: '#model_openrouter_select', key: 'openrouter_model' },
        { id: 'vertexai', kind: 'select', selector: '#model_vertexai_select', key: 'vertexai_model' },
        { id: 'custom', kind: 'custom', selector: '#model_custom_select', key: 'custom_model', input: '#custom_model_id', datalist: '#model_custom_select_fill' },
    ],
};
globalThis.document = doc;
globalThis.MutationObserver = MutationObserverStub;
globalThis.Event = class { constructor(type) { this.type = type; } };
const source = (await fs.readFile(path.join(root, 'src/addons/models/inject.js'), 'utf8')).replace(/^import .*;$/gm, '');
const prelude = `const T=globalThis.__mrTest;const SOURCES=T.SOURCES;const sourceById=id=>SOURCES.find(s=>s.id===id)??null;
const getContext=()=>({chatCompletionSettings:T.stored});const modelsOf=id=>T.store.sources[id]??[];const pickOf=id=>T.store.picks[id]??'';
const rememberPick=(id,value)=>{if(modelsOf(id).includes(value))T.store.picks[id]=value;};`;
const M = await import('data:text/javascript;base64,' + Buffer.from(prelude + source).toString('base64'));

// ---------- 실리태번 1.18 Claude 목록 모양 (묶음 사이 공백 글자까지)
function opt(value, text = value, selected = false) { const o = doc.createElement('option'); o.value = value; o.textContent = text; o.selectedness = selected; return o; }
function group(label, ...options) { const g = doc.createElement('optgroup'); g.label = label; for (const o of options) { g.append(new Text('\n')); g.append(o); } g.append(new Text('\n')); return g; }
const select = doc.createElement('select'); select.id = 'model_claude_select';
const O = { opus: opt('claude-opus-5-5', 'Claude Opus 5.5'), sonnet45: opt('claude-sonnet-4-5', 'claude-sonnet-4-5', true), haiku: opt('claude-haiku-4-5'), snap: opt('claude-opus-4-1-20250805') };
const versions = group('Versions', O.opus, O.sonnet45, O.haiku);
const snapshots = group('Snapshots', O.snap);
select.append(versions, snapshots);
doc.body.append(select);
const layout = () => select.children.map(g => `${g.label}:${g.children.map(o => o.value).join(',')}`).join(' | ');
const ours = () => select.querySelector(':scope > optgroup[data-model-register]');
const valuesOf = s => s.options.map(o => o.value);
const noDuplicates = s => assert.equal(new Set(valuesOf(s)).size, valuesOf(s).length, '같은 값이 둘 있으면 안 된다: ' + valuesOf(s));
const original = layout();
const tick = ms => new Promise(r => setTimeout(r, ms));
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('PASS', name); };

await ok('옮겨 오기: 이미 있는 모델은 옮기고 없는 모델은 만든다 · 등록한 순서 · 값과 change 그대로', async () => {
    store.sources.claude = ['claude-opus-5-5', 'claude-sonnet-5-5'];
    events.length = 0;
    M.applyOne('claude');
    assert.equal(select.firstElementChild, ours(), '맨 위');
    assert.equal(ours().label, '직접 등록한 모델');
    assert.deepEqual(ours().children.map(o => o.value), ['claude-opus-5-5', 'claude-sonnet-5-5']);
    assert.equal(ours().children[0], O.opus, '새로 만들지 않고 실리태번 option 그대로 (표시 이름도)');
    assert.equal(O.opus.textContent, 'Claude Opus 5.5');
    assert.ok(!versions.contains(O.opus), 'Versions에서는 빠진다');
    noDuplicates(select);
    assert.equal(select.value, 'claude-sonnet-4-5', '고른 값은 그대로');
    assert.deepEqual(events, [], 'change · input을 쏘지 않는다');
});

await ok('다시 불러도 아무것도 바꾸지 않는다 (감시가 조용히 멎음)', async () => {
    await tick(80); // 우리 손질로 울린 감시가 한 번 돌고 멎을 때까지
    const before = mutations;
    M.applyOne('claude'); M.applyAll();
    assert.equal(mutations, before);
    await tick(80);
    assert.equal(mutations, before);
});

await ok('순서 바꾸기', async () => {
    store.sources.claude = ['claude-sonnet-5-5', 'claude-haiku-4-5', 'claude-opus-5-5'];
    M.applyOne('claude');
    assert.deepEqual(ours().children.map(o => o.value), ['claude-sonnet-5-5', 'claude-haiku-4-5', 'claude-opus-5-5']);
    assert.deepEqual(versions.children.map(o => o.value), ['claude-sonnet-4-5']);
    noDuplicates(select);
    assert.equal(select.value, 'claude-sonnet-4-5');
});

await ok('옮겨 온 모델이 골라져 있어도 선택이 튀지 않는다', async () => {
    select.value = 'claude-opus-5-5'; stored.claude_model = 'claude-opus-5-5';
    events.length = 0;
    store.sources.claude = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5'];
    M.applyOne('claude');
    assert.equal(select.value, 'claude-opus-5-5');
    assert.deepEqual(events, []);
});

await ok('등록을 빼면 원래 자리로 · 여러 개를 어떤 순서로 빼도 원래 순서', async () => {
    store.sources.claude = ['claude-sonnet-5-5', 'claude-haiku-4-5'];
    M.applyOne('claude');
    assert.deepEqual(versions.children.map(o => o.value), ['claude-opus-5-5', 'claude-sonnet-4-5'], 'opus가 원래 첫 자리로');
    assert.equal(versions.children[0], O.opus, '같은 option이 돌아온다');
    assert.equal(select.value, 'claude-opus-5-5', '고른 값 그대로');
    store.sources.claude = ['claude-opus-5-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
    M.applyOne('claude');
    assert.deepEqual(versions.children.map(o => o.value), []);
    store.sources.claude = ['claude-sonnet-4-5']; // opus와 haiku를 한꺼번에 뺀다 (가운데 sonnet은 아직 우리 묶음에)
    M.applyOne('claude');
    assert.deepEqual(versions.children.map(o => o.value), ['claude-opus-5-5', 'claude-haiku-4-5']);
    store.sources.claude = [];
    M.applyOne('claude');
    assert.equal(ours(), null, '묶음도 빠진다');
    assert.equal(layout(), original, '처음 모양 그대로');
    assert.equal(select.value, 'claude-opus-5-5');
    noDuplicates(select);
});

await ok('실리태번이 목록을 통째로 새로 채우면 감시가 새 option을 다시 옮겨 온다', async () => {
    select.value = 'claude-sonnet-4-5'; stored.claude_model = 'claude-sonnet-4-5';
    store.sources.claude = ['claude-opus-5-5', 'claude-sonnet-5-5'];
    M.applyOne('claude');
    await tick(80);
    const fresh = opt('claude-opus-5-5');
    select.replaceChildren(group('Versions', fresh, opt('claude-sonnet-4-5')), group('Snapshots', opt('claude-opus-4-1-20250805')));
    select.value = 'claude-sonnet-4-5';
    assert.equal(ours(), null, '실리태번이 비우면 우리 묶음도 사라진다');
    await tick(120);
    assert.equal(select.firstElementChild, ours());
    assert.deepEqual(ours().children.map(o => o.value), ['claude-opus-5-5', 'claude-sonnet-5-5']);
    assert.equal(ours().children[0], fresh, '새 목록의 option을 옮겨 온다');
    noDuplicates(select);
    assert.equal(select.value, 'claude-sonnet-4-5');
    store.sources.claude = ['claude-sonnet-5-5'];
    M.applyOne('claude');
    assert.equal(select.children[1].children[0], fresh, '새 목록의 원래 자리로 돌아간다');
});

await ok('실리태번이 제 묶음만 새로 채우면(OpenAI · Google) 새 것을 쓰고 예전 것은 버린다', async () => {
    store.sources.claude = ['claude-opus-5-5', 'claude-sonnet-5-5'];
    M.applyOne('claude');
    const versionsNow = select.children[1];
    const stale = ours().children[0];
    const fresh = opt('claude-opus-5-5');
    versionsNow.replaceChildren(fresh, opt('claude-sonnet-4-5', 'claude-sonnet-4-5', true));
    await tick(120);
    assert.equal(ours().children[0], fresh);
    assert.ok(!stale.parentNode, '예전 것은 버림');
    noDuplicates(select);
    assert.equal(select.value, 'claude-sonnet-4-5');
});

await ok('자유 입력칸 자동완성(datalist)은 예전처럼: 실리태번에 있는 이름은 넣지 않고 옮기지도 않는다', async () => {
    const datalist = doc.createElement('datalist'); datalist.id = 'model_custom_select_fill';
    const native = opt('gpt-5'); datalist.append(native);
    const input = doc.createElement('input'); input.id = 'custom_model_id'; input.value = '';
    const customSelect = doc.createElement('select'); customSelect.id = 'model_custom_select';
    doc.body.append(datalist, input, customSelect);
    store.sources.custom = ['gpt-5', 'my-model'];
    M.applyOne('custom');
    assert.deepEqual(datalist.children.map(o => o.value), ['my-model', 'gpt-5']);
    assert.equal(datalist.children[1], native, '실리태번 것은 제자리');
    assert.ok(datalist.children[0].hasAttribute('data-model-register'));
    await tick(80);
    const before = mutations;
    M.applyOne('custom');
    assert.equal(mutations, before, '1.0.4 깜빡임 고침 유지');
});

await ok('공백 글자 없는 목록(실리태번이 JS로 채운 것): 이웃도 옮겨 와 있으면 그 이웃의 원래 뒤를 따라 제자리', async () => {
    const flat = doc.createElement('select'); flat.id = 'model_openrouter_select';
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(v => opt(v, v, v === 'c'));
    flat.append(a, b, c, d); doc.body.append(flat);
    store.sources.openrouter = ['b', 'a'];
    M.applyOne('openrouter');
    assert.deepEqual(flat.children.map(x => x.tagName === 'OPTION' ? x.value : x.children.map(o => o.value).join('+')), ['b+a', 'c', 'd']);
    store.sources.openrouter = ['b'];
    M.applyOne('openrouter');
    assert.deepEqual(flat.children.slice(1).map(o => o.value), ['a', 'c', 'd'], 'a의 원래 뒤 b가 묶음에 있으니 b의 원래 뒤 c 앞으로');
    store.sources.openrouter = [];
    M.applyOne('openrouter');
    assert.deepEqual(flat.children.map(o => o.value), ['a', 'b', 'c', 'd']);
    assert.equal(flat.value, 'c');
    store.sources.openrouter = ['a', 'c'];
    M.applyOne('openrouter');
    store.sources.openrouter = [];
    M.applyOne('openrouter'); // 둘을 한꺼번에 — 어떤 순서로 돌려놓아도
    assert.deepEqual(flat.children.map(o => o.value), ['a', 'b', 'c', 'd']);
    assert.equal(flat.value, 'c');
    noDuplicates(flat);
});

await ok('모델 하나뿐인 묶음에서 옮겨 오면 빈 제목을 숨기고, 다시 채워지거나 돌려놓으면 되살린다', async () => {
    const vx = doc.createElement('select'); vx.id = 'model_vertexai_select';
    const only = opt('gemini-3.8-flash');
    const g38 = group('Gemini 3.8', only);
    const g37 = group('Gemini 3.7', opt('gemini-3.7-flash', 'gemini-3.7-flash', true));
    vx.append(g38, g37); doc.body.append(vx);
    store.sources.vertexai = ['gemini-3.8-flash', 'my-vertex'];
    M.applyOne('vertexai');
    assert.equal(g38.hidden, true, '빈 묶음은 숨긴다');
    assert.ok(!g37.hidden, '다른 묶음은 그대로');
    assert.equal(vx.value, 'gemini-3.7-flash');
    await tick(80);
    const before = mutations;
    M.applyOne('vertexai');
    assert.equal(mutations, before, '숨긴 뒤에도 조용히 멎는다');
    // 실리태번이 그 묶음을 다른 모델로 다시 채우면 되살린다
    g38.replaceChildren(opt('gemini-3.8-pro'));
    await tick(120);
    assert.ok(!g38.hidden, '다시 채워지면 보인다');
    assert.equal(ours().parentNode, select, '(Claude 쪽은 그대로)');
    // 등록을 빼면 그 묶음으로 돌아가고 숨김도 풀린다
    g38.replaceChildren(); await tick(120);
    assert.equal(g38.hidden, true);
    store.sources.vertexai = ['my-vertex'];
    M.applyOne('vertexai');
    assert.ok(!g38.hidden, '돌려놓으면 보인다');
    assert.deepEqual(g38.children.map(o => o.value), ['gemini-3.8-flash']);
    noDuplicates(vx);
    store.sources.vertexai = ['gemini-3.8-flash'];
    M.applyOne('vertexai');
    assert.equal(g38.hidden, true, '끄기 검사용으로 다시 숨긴 상태');
});

await ok('애드온을 끄면 옮긴 것은 제자리로, 만든 것은 빠진다', async () => {
    M.stopAll();
    assert.equal(ours(), null);
    assert.deepEqual(select.children.map(g => g.label), ['Versions', 'Snapshots']);
    assert.deepEqual(select.children[0].children.map(o => o.value), ['claude-opus-5-5', 'claude-sonnet-4-5']);
    assert.ok(!valuesOf(select).includes('claude-sonnet-5-5'));
    assert.equal(select.value, 'claude-sonnet-4-5');
    assert.deepEqual(doc.querySelector('#model_custom_select_fill').children.map(o => o.value), ['gpt-5']);
    const vx = doc.querySelector('#model_vertexai_select');
    assert.deepEqual(vx.children.map(g => `${g.label}:${g.hidden ? 'hidden' : ''}:${g.children.map(o => o.value)}`), ['Gemini 3.8::gemini-3.8-flash', 'Gemini 3.7::gemini-3.7-flash'], '숨긴 묶음도 되살린다');
    const before = mutations;
    await tick(120);
    assert.equal(mutations, before, '끈 뒤에는 다시 넣지 않는다');
});

delete globalThis.__mrTest;
console.log(`PASS model-register move (${n})`);
