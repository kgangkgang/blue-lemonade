// 모델 등록 — 고른 모델 기억과 실리태번 값 맞추기 (src/addons/models/inject.js restorePick · syncStore · undoAutoSelect · syncCustomSelect · watchPicks)
//   node tools/tests/model-register-picks.mjs <테마 루트>   (공개 저장소는 '.')
// 진짜 inject.js · state.js · sources.js 를 부르고 실리태번 모듈(script.js · extensions.js)만 data: 스텁. jsdom 없이 작은 DOM 흉내
// (select 의 HTML 선택 규칙 · MutationObserver 기록). 실리태번의 select change 처리기는 「받으면 oai_settings 에 적는」 가짜. 네트워크 없음.
// 옮겨 오기 · 제자리 돌려놓기는 model-register-move.mjs 가 본다. 여기서 확인하는 것:
//   1) 1.0.2 첫 연결 실패 고침: 화면에 등록한 모델이 골라졌으면 실리태번 값(oai_settings)도 같게 — change 를 한 번 쏴서
//   2) 우리 묶음을 끼우며 브라우저가 첫 항목을 고른 것 때문에 실리태번이 저장해 둔 모델을 덮어쓰지 않음 (Custom 은 직접 쳐 둔 이름)
//   3) 실리태번이 우리 값을 안 받아 주면 같은 값을 끝없이 다시 밀지 않음 · 맞춰진 뒤 다시 어긋나면 다시 밈
//   4) watchPicks: 사람이 고른 것 · 일부러 바꾼 것(고르기 팝업 · /model)은 기억 · 목록을 갈아 끼우며 난 change 는 기억 안 함 → 다시 되살림
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const url = rel => pathToFileURL(path.join(srcDir, rel)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__mrPicksTest = { ext: {}, cs: {}, saves: 0 };
const G = 'const T = globalThis.__mrPicksTest;\n';
const ST = {
    'script.js': js(G + 'export function saveSettingsDebounced() { T.saves++; }'),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export function getContext() { return { chatCompletionSettings: T.cs }; }`),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    const base = spec.split('/').pop();
    if (parent.startsWith(R) && (spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(srcDir).href } });

// ---------- 작은 DOM: 자식 목록 · select 선택 규칙 · MutationObserver 기록 · 이벤트
const fired = [];   // 요소에 쏜 이벤트 { id, type, trusted }
const watchers = new Set();
function mutated(node) {
    for (const w of watchers) {
        if (!w.target || !w.target.contains(node)) continue;
        w.records.push({ type: 'childList', target: node });
        if (w.queued) continue;
        w.queued = true;
        queueMicrotask(() => { w.queued = false; if (w.target && w.records.length) w.callback(w.records.splice(0), w); });
    }
}
class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.target = null; this.records = []; this.queued = false; watchers.add(this); }
    observe(target) { this.target = target; }
    disconnect() { this.target = null; this.records = []; }
    takeRecords() { return this.records.splice(0); }
}
class Node {
    constructor() { this.parentNode = null; this.childNodes = []; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === doc.body; }
    get nextSibling() { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) + 1] ?? null : null; }
    contains(node) { for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; }
    remove() {
        const p = this.parentNode;
        if (!p) return;
        p.childNodes.splice(p.childNodes.indexOf(this), 1);
        this.parentNode = null;
        selectOf(p)?.settle();
        mutated(p);
    }
    insertBefore(node, ref) {
        if (ref && ref.parentNode !== this) throw new Error('NotFoundError');
        if (node === ref) return node;
        node.remove();
        this.childNodes.splice(ref ? this.childNodes.indexOf(ref) : this.childNodes.length, 0, node);
        node.parentNode = this;
        selectOf(this)?.settle(node);
        mutated(this);
        return node;
    }
    append(...nodes) { for (const n of nodes) this.insertBefore(n, null); }
    prepend(...nodes) { const first = this.childNodes[0] ?? null; for (const n of nodes) this.insertBefore(n, first); }
    replaceChildren(...nodes) { for (const n of [...this.childNodes]) if (!nodes.includes(n)) n.remove(); for (const n of nodes) this.insertBefore(n, null); }
}
const attrName = key => 'data-' + String(key).replace(/[A-Z]/g, c => '-' + c.toLowerCase());
class Element extends Node {
    constructor(tag) {
        super();
        this.tagName = tag.toUpperCase(); this.id = ''; this.hidden = false; this.textContent = '';
        this.attrs = new Map(); this.listeners = {};
        const self = this;
        this.dataset = new Proxy({}, { set(_, key, value) { self.setAttribute(attrName(key), value); return true; }, get(_, key) { return self.getAttribute(attrName(key)) ?? undefined; } });
    }
    setAttribute(k, v) { this.attrs.set(k, String(v)); }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
    hasAttribute(k) { return this.attrs.has(k); }
    get label() { return this.getAttribute('label') ?? ''; }
    set label(v) { this.setAttribute('label', v); }
    get children() { return this.childNodes.filter(n => n instanceof Element); }
    get firstElementChild() { return this.children[0] ?? null; }
    descendants() { return this.children.flatMap(c => [c, ...c.descendants()]); }
    matches(sel) {
        const m = /^(\w+)?(?:\[([\w-]+)\])?$/.exec(sel.trim());
        if (!m) throw new Error('이 시험의 DOM 이 모르는 선택자: ' + sel);
        return (!m[1] || this.tagName === m[1].toUpperCase()) && (!m[2] || this.hasAttribute(m[2]));
    }
    querySelectorAll(sel) {
        const scoped = /^:scope\s*>\s*(.+)$/.exec(sel);
        if (scoped) return this.children.filter(c => c.matches(scoped[1]));
        if (sel.startsWith('#')) return this.descendants().filter(c => c.id === sel.slice(1));
        return this.descendants().filter(c => c.matches(sel));
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
    addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
    dispatchEvent(event) { fired.push({ id: this.id, type: event.type, trusted: event.isTrusted === true }); for (const fn of this.listeners[event.type] ?? []) fn(event); return true; }
}
class OptionElement extends Element {
    constructor() { super('option'); this.selectedness = false; }
    get value() { return this.getAttribute('value') ?? ''; }
    set value(v) { this.setAttribute('value', v); }
}
class SelectElement extends Element {
    constructor() { super('select'); }
    get options() { return this.descendants().filter(n => n instanceof OptionElement); }
    get selectedIndex() { return this.options.findIndex(o => o.selectedness); }
    set selectedIndex(i) { this.options.forEach((o, n) => { o.selectedness = n === i; }); }
    get value() { return this.options.find(o => o.selectedness)?.value ?? ''; }
    set value(v) { this.selectedIndex = this.options.findIndex(o => o.value === v); }
    // HTML 선택 규칙 (size 1): option 이 들어오거나 빠지면 — 골라진 것이 없으면 첫 항목, 둘 이상이면 마지막 하나 (골라진 채 들어온 것이 이김)
    settle(inserted = null) {
        if (inserted instanceof Element) {
            const incoming = [inserted, ...inserted.descendants()].filter(o => o instanceof OptionElement && o.selectedness);
            if (incoming.length) for (const o of this.options) if (!incoming.includes(o)) o.selectedness = false;
        }
        const picked = this.options.filter(o => o.selectedness);
        if (!picked.length) { if (this.options[0]) this.options[0].selectedness = true; }
        else if (picked.length > 1) picked.slice(0, -1).forEach(o => { o.selectedness = false; });
    }
}
function selectOf(node) { for (let n = node; n; n = n.parentNode) if (n instanceof SelectElement) return n; return null; }
const doc = {
    body: new Element('body'),
    createElement: tag => (tag === 'option' ? new OptionElement() : tag === 'select' ? new SelectElement() : new Element(tag)),
    querySelector: sel => doc.body.querySelector(sel),
};
globalThis.document = doc;
globalThis.MutationObserver = FakeMutationObserver;

const state = await import(url('addons/models/state.js'));
const M = await import(url('addons/models/inject.js'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
const tick = ms => new Promise(resolve => setTimeout(resolve, ms));
function opt(value, selected = false) { const o = doc.createElement('option'); o.value = value; o.textContent = value; o.selectedness = selected; return o; }
function group(label, ...options) { const g = doc.createElement('optgroup'); g.label = label; g.append(...options); return g; }
function element(tag, id, ...children) { const el = doc.createElement(tag); el.id = id; el.append(...children); doc.body.append(el); return el; }
// 실리태번의 select change 처리기 흉내: 받아 주면 그 값을 oai_settings 에 적는다
let accepts = true;
function stHandler(select, key) { select.addEventListener('change', () => { if (accepts) T.cs[key] = select.value; }); }
function reset(store, cs = {}) {
    M.stopAll();
    doc.body.replaceChildren();
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    T.ext.model_register = structuredClone(store);
    state.initSettings();
    for (const k of Object.keys(T.cs)) delete T.cs[k];
    Object.assign(T.cs, cs);
    accepts = true; fired.length = 0; T.saves = 0;
}
const changes = id => fired.filter(e => e.id === id && e.type === 'change').length;

// ---------- 1) 화면과 실리태번 값 맞추기
await test('1.0.2 고른 등록 모델을 되살리면 실리태번 값도 같게 (change 한 번) — 그대로 연결해도 모델 이름이 비지 않음 · 다시 불러도 또 쏘지 않음', async () => {
    reset({ sources: { vertexai: ['my-vx-a', 'my-vx-b'] }, picks: { vertexai: 'my-vx-b' } }, { vertexai_model: '' });
    const vx = element('select', 'model_vertexai_select', group('Gemini 3.7', opt('gemini-3.7-flash'), opt('gemini-3.7-pro')));
    vx.selectedIndex = -1;   // 버텍스는 불러올 때 빈 값을 저장한다 → 아무것도 안 골라진 select
    stHandler(vx, 'vertexai_model');
    M.applyOne('vertexai');
    assert.deepEqual(vx.options.map(o => o.value).slice(0, 2), ['my-vx-a', 'my-vx-b'], '등록한 모델이 맨 위 묶음에');
    assert.equal(vx.value, 'my-vx-b', '기억해 둔 선택');
    assert.equal(T.cs.vertexai_model, 'my-vx-b', '실리태번 값도 같게');
    assert.equal(changes('model_vertexai_select'), 1);
    M.applyOne('vertexai');
    M.applyAll();
    await tick(90);
    assert.equal(changes('model_vertexai_select'), 1, '맞춰진 뒤에는 쏘지 않음');
    assert.equal(state.pickOf('vertexai'), 'my-vx-b');
});

// ---------- 2) 브라우저의 자동 선택이 저장해 둔 모델을 덮어쓰지 않음
await test('select 가 비어 있던 공급자: 묶음을 끼워 넣어 첫 등록 모델이 저절로 골라져도 실리태번이 들고 있던 모델은 그대로', async () => {
    reset({ sources: { claude: ['claude-mine'] }, picks: {} }, { claude_model: 'claude-remote-only' });
    const cl = element('select', 'model_claude_select', group('Versions', opt('claude-st-a'), opt('claude-st-b')));
    cl.selectedIndex = -1;   // 연결해야 받아 오는 모델이라 아직 목록에 없음
    stHandler(cl, 'claude_model');
    M.applyOne('claude');
    assert.equal(cl.options[0].value, 'claude-mine', '묶음은 맨 위에');
    assert.equal(cl.selectedIndex, -1, '실리태번이 보던 대로 선택을 비움');
    assert.equal(T.cs.claude_model, 'claude-remote-only', '저장해 둔 모델을 덮어쓰지 않음');
    assert.equal(changes('model_claude_select'), 0);
    // 실리태번 값이 목록에 있는 모델이면 그것을 다시 고름 (change 없이)
    reset({ sources: { claude: ['claude-mine'] }, picks: {} }, { claude_model: 'claude-st-b' });
    const again = element('select', 'model_claude_select', group('Versions', opt('claude-st-a'), opt('claude-st-b')));
    again.selectedIndex = -1;
    stHandler(again, 'claude_model');
    M.applyOne('claude');
    assert.equal(again.value, 'claude-st-b');
    assert.equal(T.cs.claude_model, 'claude-st-b');
    assert.equal(changes('model_claude_select'), 0);
    await tick(90);
});

await test('Custom: 직접 쳐 둔 모델 이름을 첫 등록 모델로 바꾸지 않음 · 자동완성엔 실리태번에 없는 이름만 · 입력칸이 등록 이름이면 보조 select 만 조용히 맞춤', async () => {
    reset({ sources: { custom: ['relay-a', 'gpt-st', 'relay-b'] }, picks: {} }, { custom_model: 'typed-model' });
    const input = element('input', 'custom_model_id');
    input.value = 'typed-model';
    const list = element('datalist', 'model_custom_select_fill', opt('gpt-st'));
    const cs = element('select', 'model_custom_select');
    stHandler(cs, 'custom_model');
    M.applyOne('custom');
    assert.deepEqual(list.children.map(o => o.value), ['relay-a', 'relay-b', 'gpt-st'], '실리태번에 있는 이름은 두 번 넣지 않음');
    assert.deepEqual(cs.options.map(o => o.value), ['relay-a', 'gpt-st', 'relay-b']);
    assert.equal(cs.selectedIndex, -1, '보조 select 가 첫 등록 모델을 고른 채로 두지 않음');
    assert.equal(T.cs.custom_model, 'typed-model');
    input.value = ' relay-b ';
    M.applyOne('custom');
    assert.equal(cs.value, 'relay-b');
    assert.equal(changes('model_custom_select'), 0, 'Custom 은 입력칸이 주인 — change 를 쏘지 않음');
    assert.equal(T.cs.custom_model, 'typed-model');
    await tick(90);
});

// ---------- 3) 한 번만 민다
await test('실리태번이 우리 값을 안 받아 주면 같은 값은 한 번만 밈 · 맞춰진 뒤 다시 어긋나면 다시 밈', async () => {
    reset({ sources: { vertexai: ['my-vx-a', 'my-vx-b'] }, picks: { vertexai: 'my-vx-b' } }, { vertexai_model: 'gemini-3.7-flash' });
    const vx = element('select', 'model_vertexai_select', group('Gemini 3.7', opt('gemini-3.7-flash', true), opt('gemini-3.7-pro')));
    stHandler(vx, 'vertexai_model');
    accepts = false;
    M.applyOne('vertexai');
    assert.equal(vx.value, 'my-vx-b');
    assert.equal(changes('model_vertexai_select'), 1);
    M.applyOne('vertexai');
    M.applyOne('vertexai');
    await tick(90);
    assert.equal(changes('model_vertexai_select'), 1, '안 받아 줘도 끝없이 주고받지 않음');
    accepts = true;
    T.cs.vertexai_model = 'my-vx-b';   // 실리태번이 따라잡음
    M.applyOne('vertexai');
    assert.equal(changes('model_vertexai_select'), 1);
    T.cs.vertexai_model = 'gemini-3.7-pro';   // 다른 길로 다시 어긋남
    M.applyOne('vertexai');
    assert.equal(changes('model_vertexai_select'), 2, '맞춰진 적이 있으면 다시 밈');
    assert.equal(T.cs.vertexai_model, 'my-vx-b');
    await tick(90);
});

// ---------- 4) watchPicks
await test('watchPicks: 사람이 고른 실리태번 모델이면 기억을 지우고 안 되돌림 · 고르기 팝업 · /model 로 고른 등록 모델은 기억 · 목록을 갈아 끼우며 난 change 는 기억 안 함 → 되살림', async () => {
    reset({ sources: { vertexai: ['my-vx-a', 'my-vx-b'] }, picks: { vertexai: 'my-vx-a' } }, { vertexai_model: 'my-vx-a' });
    const vx = element('select', 'model_vertexai_select', group('Gemini 3.7', opt('gemini-3.7-flash'), opt('gemini-3.7-pro')));
    stHandler(vx, 'vertexai_model');   // 실리태번 처리기는 우리보다 먼저 붙어 있다
    M.applyAll();
    M.watchPicks();
    assert.equal(vx.value, 'my-vx-a');
    await tick(90);
    // 사람이 고름 (isTrusted)
    vx.value = 'gemini-3.7-pro';
    vx.dispatchEvent({ type: 'change', isTrusted: true });
    assert.equal(state.pickOf('vertexai'), '', '실리태번 모델을 고르면 기억을 지움');
    await tick(90);
    assert.equal(vx.value, 'gemini-3.7-pro', '사람이 고른 것을 되돌리지 않음');
    assert.equal(T.cs.vertexai_model, 'gemini-3.7-pro');
    // 고르기 팝업 · /model: isTrusted 는 거짓, 목록은 그대로
    vx.value = 'my-vx-b';
    vx.dispatchEvent(new Event('change'));
    assert.equal(state.pickOf('vertexai'), 'my-vx-b', '1.0.3 일부러 바꾼 것도 기억');
    await tick(90);
    assert.equal(vx.value, 'my-vx-b', '60ms 뒤 예전 선택으로 되돌아가지 않음');
    // 실리태번이 연결하며 목록을 통째로 새로 채우고 바로 change (우리 묶음은 사라지고 첫 항목이 골라짐)
    const saves = T.saves;
    vx.replaceChildren(group('Gemini 3.7', opt('gemini-3.7-flash'), opt('gemini-3.7-pro')));
    vx.dispatchEvent(new Event('change'));
    assert.equal(T.cs.vertexai_model, 'gemini-3.7-flash', '(실리태번이 제 첫 모델을 적음)');
    assert.equal(state.pickOf('vertexai'), 'my-vx-b', '갈아 끼우며 난 change 는 기억하지 않음');
    assert.equal(T.saves, saves);
    await tick(90);
    assert.equal(vx.options[0].value, 'my-vx-a', '묶음을 다시 넣음');
    assert.equal(vx.value, 'my-vx-b', '기억대로 되살림');
    assert.equal(T.cs.vertexai_model, 'my-vx-b', '실리태번 값도 다시 맞춤');
    assert.equal(state.pickOf('vertexai'), 'my-vx-b', '우리가 쏜 change 로 기억이 바뀌지 않음');
    M.stopAll();
});

console.log(`\nmodel-register-picks: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
