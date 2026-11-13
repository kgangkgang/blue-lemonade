// 1.2.x 남의 확장 기능 다리의 설정 칸(src/ext-bridge-ui.js) — 작은 가짜 DOM, 브라우저 없음
//   ① 두 칸을 그 확장의 설정 칸 안에 넣어요(용어집: 지침 칸이 든 묶음의 맨 끝 · 모델: 기능별 모델 묶음 바로 뒤) · 그 확장의 요소는 차례 · 개수 그대로
//   ② 분류 탭 묶음 표식(data-bl-tab-g · data-bl-tab-off)을 물려받아요 · 두 번 불러도 한 벌
//   ③ 우리 입력에는 그 확장의 저장 표식(data-s · data-s-act · data-s-preset · data-s-every)이 없어요
//   ④ 용어집 켬끔 → 테마 쪽 설정에만 적어요 · 안내 줄 · 지난 요청에 실은 줄
//   ⑤ 모델 칸: 「확장 AI 전체」 + 여섯 갈래 · 회사를 고르면 모델 칸이 열리고 · 직접 입력이면 이름 칸이 열려요
//   ⑥ 자리를 못 찾으면 맨 아래(맞춘 판 안내 줄 앞) · 기능을 안 쓰는 모드면 넣지 않고 있던 칸은 치워요
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

// ── 작은 가짜 DOM ─────────────────────────────────────
const camel = name => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const kebab = key => `data-${key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`;
class Node {
    constructor(doc, tag) {
        this.ownerDocument = doc; this.localName = tag; this.attrs = new Map(); this.children = []; this.parentElement = null; this.text = ''; this.listeners = [];
        this.value = ''; this.checked = false; this.selected = false; this.disabled = false; this.hidden = false;
        this.dataset = new Proxy({}, {
            get: (_, key) => (typeof key === 'string' ? this.attrs.get(kebab(key)) : undefined),
            set: (_, key, value) => { this.attrs.set(kebab(key), String(value)); return true; },
            has: (_, key) => this.attrs.has(kebab(key)),
            deleteProperty: (_, key) => { this.attrs.delete(kebab(key)); return true; },
            ownKeys: () => [...this.attrs.keys()].filter(name => name.startsWith('data-')).map(camel),
            getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
        });
    }
    get id() { return this.attrs.get('id') || ''; }
    get className() { return this.attrs.get('class') || ''; } set className(value) { this.attrs.set('class', String(value)); }
    setAttribute(name, value) { this.attrs.set(name, String(value)); if (name === 'value') this.value = String(value); }
    getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; }
    hasAttribute(name) { return this.attrs.has(name); }
    get textContent() { return this.text + this.children.map(kid => kid.textContent).join(''); }
    set textContent(value) { for (const kid of this.children) kid.parentElement = null; this.children = []; this.text = String(value); }
    get isConnected() { let node = this; while (node.parentElement) node = node.parentElement; return node === this.ownerDocument.documentElement; }
    get previousElementSibling() { const list = this.parentElement?.children || []; return list[list.indexOf(this) - 1] || null; }
    get nextElementSibling() { const list = this.parentElement?.children || []; return list[list.indexOf(this) + 1] || null; }
    flat(nodes) { return nodes.flatMap(node => (node.localName === '#fragment' ? node.children.splice(0) : [node])); }
    adopt(node) { node.parentElement?.children.splice(node.parentElement.children.indexOf(node), 1); node.parentElement = this; return node; }
    append(...nodes) { for (const node of this.flat(nodes)) this.children.push(this.adopt(node)); }
    replaceChildren(...nodes) { for (const kid of this.children) kid.parentElement = null; this.children = []; this.append(...nodes); }
    after(node) { const parent = this.parentElement; parent.adopt(node); parent.children.splice(parent.children.indexOf(this) + 1, 0, node); }
    before(node) { const parent = this.parentElement; parent.adopt(node); parent.children.splice(parent.children.indexOf(this), 0, node); }
    remove() { if (this.parentElement) { this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; } }
    all(out = []) { for (const kid of this.children) { out.push(kid); kid.all(out); } return out; }
    is(part) {
        const m = /^([a-z]*)((?:[.#][\w-]+)*)((?:\[[^\]]+\])*)$/i.exec(part);
        if (!m) throw new Error(`가짜 DOM 이 모르는 선택자: ${part}`);
        if (m[1] && m[1] !== this.localName) return false;
        for (const token of m[2].match(/[.#][\w-]+/g) || []) if (token[0] === '#' ? this.id !== token.slice(1) : !this.className.split(/\s+/).includes(token.slice(1))) return false;
        for (const token of m[3].match(/\[[^\]]+\]/g) || []) {
            const [, name, value] = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(token) || [];
            if (!name) throw new Error(`가짜 DOM 이 모르는 속성 선택자: ${token}`);
            if (!this.attrs.has(name) || (value !== undefined && this.attrs.get(name) !== value)) return false;
        }
        return true;
    }
    matches(selector) {
        const parts = selector.trim().split(/\s+/);
        let node = this;
        if (!node.is(parts.at(-1))) return false;
        for (let i = parts.length - 2; i >= 0; i--) {
            if (parts[i] === '>') { node = node.parentElement; i -= 1; if (!node || !node.is(parts[i])) return false; continue; }
            node = node.parentElement;
            while (node && !node.is(parts[i])) node = node.parentElement;
            if (!node) return false;
        }
        return true;
    }
    closest(selector) { let node = this; while (node && !node.matches(selector)) node = node.parentElement; return node || null; }
    querySelectorAll(selector) {
        if (selector.startsWith(':scope > ')) return this.children.filter(kid => kid.is(selector.slice(9)));
        return this.all().filter(node => node.matches(selector));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    addEventListener(type, fn) { this.listeners.push([type, fn]); }
}
function makeDoc() {
    const doc = { activeElement: null };
    doc.createElement = tag => new Node(doc, tag);
    doc.createDocumentFragment = () => new Node(doc, '#fragment');
    doc.documentElement = new Node(doc, 'html');
    doc.head = new Node(doc, 'head'); doc.body = new Node(doc, 'body');
    doc.documentElement.append(doc.head, doc.body);
    doc.querySelector = selector => doc.documentElement.querySelector(selector);
    doc.getElementById = id => doc.documentElement.all().find(node => node.id === id) || null;
    return doc;
}
const fire = (target, type) => { for (let node = target; node; node = node.parentElement) for (const [name, fn] of node.listeners) if (name === type) fn({ target, preventDefault() {} }); };
const make = (doc, tag, attrs = {}, kids = [], text = '') => { const node = doc.createElement(tag); for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value); node.text = text; node.append(...kids); return node; };

/** 그 확장 설정 칸의 뼈대(선택자만 같은 가짜 — 그 확장의 글 · 코드는 들어 있지 않아요) */
function page({ anchors = true, tabs = true, note = true } = {}) {
    const doc = makeDoc();
    const row = (key, group, off) => make(doc, 'label', tabs ? { 'data-bl-tab-g': group, ...(off ? { 'data-bl-tab-off': '' } : {}) } : {}, [make(doc, 'select', { class: 'text_pole', 'data-s': key })], `원작 칸 ${key}`);
    const kids = [row('enabled', '0', false)];
    const head = (text, group, off) => make(doc, 'b', { class: 'ss-set-h', ...(tabs ? { 'data-bl-tab-g': group, ...(off ? { 'data-bl-tab-off': '' } : {}) } : {}) }, [], text);
    if (anchors) {
        kids.push(head('언어', '1', false), row('ssGenLang', '1', false), make(doc, 'label', tabs ? { 'data-bl-tab-g': '1' } : {}, [make(doc, 'textarea', { 'data-s': 'trRules' })], '원작 지침 칸'), row('trAuto', '1', false));
        kids.push(head('확장 AI', '2', true), row('aiProfile', '2', true), make(doc, 'details', { class: 'ss-set-more', ...(tabs ? { 'data-bl-tab-g': '2', 'data-bl-tab-off': '' } : {}) }, [row('profContact', '', false)]), row('aiFallbackMain', '2', true));
    } else kids.push(row('other', '1', true));
    if (note) kids.push(make(doc, 'small', { class: 'bl-ext-compat', ...(tabs ? { 'data-bl-tab-g': '2', 'data-bl-tab-off': '' } : {}) }, [], '맞춘 판 안내'));
    const content = make(doc, 'div', { class: 'inline-drawer-content' }, kids);
    doc.body.append(make(doc, 'div', { id: 'ss-settings' }, [make(doc, 'div', { class: 'inline-drawer' }, [content])]));
    return { doc, content, foreign: [...content.children] };
}
function fakeBridge({ features = true, saved } = {}) {
    const C = fakeBridge.core;
    const store = { value: saved || {} };
    const calls = [];
    const state = { features, owner: {}, last: { ext: null, main: null, model: null } };
    return {
        calls, state,
        config: () => C.readBridge({ meatball: store.value }),
        update(mutate) { const next = C.readBridge({ meatball: store.value }); mutate(next); const tidy = C.readBridge({ meatball: next }); store.value = tidy; calls.push(structuredClone(tidy)); return tidy; },   // 진짜 다리처럼 고친 값을 한 번 정리해요
        status: () => ({ features: state.features, addon: true, enabled: true, count: 278, mode: 'ko', engine: 'llm', trLang: '한국어', fallback: true, owner: state.owner, last: state.last }),
    };
}

globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {}, chatCompletionSettings: { custom_url: 'http://127.0.0.1:5001/v1' }, getRequestHeaders: () => ({}) }) };
fakeBridge.core = await import(pathToFileURL(path.join(root, 'src/ext-bridge-core.js')).href);
const { mountBridgeUi } = await import(pathToFileURL(path.join(root, 'src/ext-bridge-ui.js')).href);
const Providers = await import(pathToFileURL(path.join(root, 'src/addons/rewrite/providers.js')).href);
const use = doc => { globalThis.document = doc; };   // 모델 칸 채우기(src/live-models.js fillSelect)가 전역 document 로 option 을 만들어요

await test('① 두 칸이 정한 자리 바로 뒤에 들어가고, 그 확장의 요소는 차례 · 개수 그대로예요', async () => {
    const p = page(); use(p.doc);
    assert.equal(mountBridgeUi(p.doc, fakeBridge()), true);
    const kinds = p.content.children.map(node => node.getAttribute('data-bl-bridge') || node.querySelector('[data-s]')?.getAttribute('data-s') || node.className);
    assert.deepEqual(kinds, ['enabled', 'ss-set-h', 'ssGenLang', 'trRules', 'trAuto', 'glossary', 'ss-set-h', 'aiProfile', 'profContact', 'models', 'aiFallbackMain', 'bl-ext-compat'], '용어집 칸은 지침 칸이 든 묶음의 맨 끝 · 모델 칸은 기능별 모델 묶음 바로 뒤');
    assert.deepEqual(p.content.children.filter(node => !node.hasAttribute('data-bl-bridge')), p.foreign);
    assert.ok(p.doc.getElementById('bl-ext-bridge-css'), '시트는 한 번 붙여요');
});
await test('② 분류 탭 묶음 표식을 물려받고(보이는 탭 · 숨은 탭), 두 번 불러도 한 벌이에요', async () => {
    const p = page(); use(p.doc);
    const bridge = fakeBridge();
    mountBridgeUi(p.doc, bridge); mountBridgeUi(p.doc, bridge);
    const blocks = p.content.querySelectorAll(':scope > [data-bl-bridge]');
    assert.equal(blocks.length, 2);
    const [glossary, models] = blocks;
    assert.equal(glossary.dataset.blTabG, '1'); assert.equal('blTabOff' in glossary.dataset, false);
    assert.equal(models.dataset.blTabG, '2'); assert.equal('blTabOff' in models.dataset, true);
    assert.equal(p.doc.head.children.filter(node => node.id === 'bl-ext-bridge-css').length, 1);
    const plain = page({ tabs: false }); use(plain.doc);
    mountBridgeUi(plain.doc, fakeBridge());
    assert.equal('blTabG' in plain.content.querySelector('[data-bl-bridge="models"]').dataset, false, '탭이 없으면 표식도 없어요');
});
await test('③ 우리 입력에는 그 확장의 저장 · 단추 표식이 없어요', async () => {
    const p = page(); use(p.doc);
    mountBridgeUi(p.doc, fakeBridge());
    for (const block of p.content.querySelectorAll(':scope > [data-bl-bridge]')) {
        for (const node of [block, ...block.all()]) for (const name of ['data-s', 'data-s-act', 'data-s-preset', 'data-s-every']) assert.equal(node.hasAttribute(name), false, `${node.localName} ${name}`);
        assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(block.textContent), '그림 글자 없음');
    }
});

await test('④ 용어집: 기본은 둘 다 켬 · 끄면 테마 쪽 설정에만 적히고 안내 줄이 바뀌어요', async () => {
    const p = page(); use(p.doc);
    const bridge = fakeBridge();
    mountBridgeUi(p.doc, bridge);
    const block = p.content.querySelector('[data-bl-bridge="glossary"]');
    const [ext, main] = block.querySelectorAll('[data-bl-bridge-flag]');
    assert.deepEqual([ext.checked, main.checked], [true, true]);
    assert.match(block.querySelector('[data-bl-bridge-note]').textContent, /용어집 278개 가운데 요청 글에 나온 이름만/);
    ext.checked = false; fire(ext, 'change');
    assert.equal(bridge.calls.at(-1).glossary, false); assert.equal(bridge.calls.at(-1).glossaryMain, true);
    main.checked = false; fire(main, 'change');
    assert.equal(bridge.calls.at(-1).glossaryMain, false);
    assert.match(block.querySelector('[data-bl-bridge-note]').textContent, /꺼 두었어요/);
});
await test('④ 지난 요청에 실은 줄: 없으면 그렇다고, 있으면 어느 요청에 몇 줄인지와 줄 그대로', async () => {
    const p = page(); use(p.doc);
    const bridge = fakeBridge();
    mountBridgeUi(p.doc, bridge);
    const lines = p.content.querySelector('[data-bl-bridge-lines]');
    assert.match(lines.textContent, /아직 실은 요청이 없어요/);
    bridge.state.last = { ext: { at: 0, slot: 'gen', kind: 'gen', lines: ['Leon → 리온', 'Ardel → 아르델'] }, main: { at: 0, lines: ['Klein → 클라인'] }, model: null };
    mountBridgeUi(p.doc, bridge);
    assert.match(lines.textContent, /확장 AI 요청 · 만들기 · .* · 2줄\nLeon → 리온\nArdel → 아르델\n\n본편 요청 · .* · 1줄\nKlein → 클라인/);
});

await test('⑤ 모델 칸: 「확장 AI 전체」 + 여섯 갈래 · 회사 목록은 번역기와 같은 여덟 곳', async () => {
    const p = page(); use(p.doc);
    mountBridgeUi(p.doc, fakeBridge());
    const rows = p.content.querySelectorAll('[data-bl-bridge-slot]');
    assert.deepEqual(rows.map(row => row.dataset.blBridgeSlot), fakeBridge.core.SLOTS.map(([id]) => id));
    const options = rows[0].querySelector('[data-bl-bridge-provider]').children;
    assert.deepEqual(options.map(option => option.value), ['', ...Object.keys(Providers.PROVIDERS)]);
    assert.match(options[0].textContent, /미트볼 설정대로/);
    assert.match(rows[1].querySelector('[data-bl-bridge-provider]').children[0].textContent, /「확장 AI 전체」와 같게/);
    for (const row of rows) { assert.equal(row.querySelector('[data-bl-bridge-model]').hidden, true); assert.equal(row.querySelector('[data-bl-bridge-name]').hidden, true); assert.equal(row.querySelector('[data-bl-bridge-hint]').hidden, true); }
    assert.match(rows[1].textContent, /^연락 메신저 · 편지 · 선톡 · 연락 요약 · 속마음/, '이름 옆에 그 칸이 맡는 기능');
    assert.match(rows[4].textContent, /답마다 스스로 불려요/);
    assert.match(p.content.querySelector('[data-bl-bridge="models"]').textContent, /위 미트볼 칸에는 실리태번 연결 프로필만 떠요/, '왜 다른 모델이 안 떴는지 한 줄');
});
await test('⑤ 그 확장 칸에 연결 프로필이 골라져 있는 칸은, 여기서 회사를 골랐을 때만 「그쪽이 먼저」라고 알려요', async () => {
    const p = page(); use(p.doc);
    const bridge = fakeBridge({ saved: { models: { gen: { provider: 'openai', model: 'm' } } } });
    bridge.state.owner = { gen: true, feeds: true };
    mountBridgeUi(p.doc, bridge);
    const hint = id => p.content.querySelector(`[data-bl-bridge-slot="${id}"]`).querySelector('[data-bl-bridge-hint]');
    assert.equal(hint('gen').hidden, false);
    assert.match(hint('gen').textContent, /그쪽이 먼저예요/);
    assert.equal(hint('feeds').hidden, true, '여기서 안 고른 칸에는 띄우지 않아요');
    assert.equal(hint('base').hidden, true);
});
await test('⑤ 회사를 고르면 모델 칸이 열리고, 모델 · 직접 입력 이름이 그 칸에만 적혀요', async () => {
    const p = page(); use(p.doc);
    const bridge = fakeBridge();
    mountBridgeUi(p.doc, bridge);
    const row = p.content.querySelector('[data-bl-bridge-slot="analyze"]');
    const provider = row.querySelector('[data-bl-bridge-provider]'), model = row.querySelector('[data-bl-bridge-model]'), name = row.querySelector('[data-bl-bridge-name]');
    provider.value = 'claude'; fire(provider, 'change');
    assert.deepEqual(bridge.calls.at(-1).models.analyze, { provider: 'claude', model: '', name: '' });
    assert.equal(model.hidden, false);
    const ids = model.children.map(option => option.value);
    assert.equal(ids[0], '', '아직 안 골랐으면 맨 앞은 「모델을 골라 주세요」');
    assert.equal(ids.at(-1), 'custom');
    assert.ok(ids.length > 2, '목록을 받기 전에도 아는 이름이 떠요');
    model.value = ids[1]; fire(model, 'change');
    assert.equal(bridge.calls.at(-1).models.analyze.model, ids[1]);
    assert.equal(name.hidden, true);
    model.value = 'custom'; fire(model, 'change');
    assert.equal(name.hidden, false);
    name.value = '  my-model  '; fire(name, 'change');
    assert.deepEqual(bridge.calls.at(-1).models.analyze, { provider: 'claude', model: 'custom', name: 'my-model' });
    assert.deepEqual(bridge.calls.at(-1).models.base, { provider: '', model: '', name: '' }, '다른 칸은 그대로');
    provider.value = ''; fire(provider, 'change');
    assert.deepEqual(bridge.calls.at(-1).models.analyze, { provider: '', model: '', name: '' });
    assert.equal(model.hidden, true); assert.equal(name.hidden, true);
});
await test('⑤ 저장된 값으로 그려요 · 지난 요청 한 줄 · 고른 회사가 없으면 새로고침 단추는 쉬어요', async () => {
    const p = page(); use(p.doc);
    const bridge = fakeBridge({ saved: { models: { base: { provider: 'openai', model: 'gpt-saved-x' } } } });
    bridge.state.last.model = { at: 0, slot: 'gen', used: 'base', label: 'openai · gpt-saved-x', ok: false, note: '429' };
    mountBridgeUi(p.doc, bridge);
    const block = p.content.querySelector('[data-bl-bridge="models"]');
    const row = block.querySelector('[data-bl-bridge-slot="base"]');
    assert.equal(row.querySelector('[data-bl-bridge-provider]').children.find(option => option.selected).value, 'openai');
    const picked = row.querySelector('[data-bl-bridge-model]').children.find(option => option.selected);
    assert.equal(picked.value, 'gpt-saved-x');
    assert.match(block.querySelector('[data-bl-bridge-note]').textContent, /지난 요청: 만들기 → openai · gpt-saved-x 실패 — 429/);
    assert.equal(block.querySelector('[data-bl-bridge-refresh]').disabled, false);
    const empty = page(); use(empty.doc);
    mountBridgeUi(empty.doc, fakeBridge());
    assert.equal(empty.content.querySelector('[data-bl-bridge-refresh]').disabled, true);
});

await test('⑥ 끼울 자리를 못 찾으면 맨 아래, 맞춘 판 안내 줄 앞에 넣어요', async () => {
    const p = page({ anchors: false }); use(p.doc);
    mountBridgeUi(p.doc, fakeBridge());
    assert.deepEqual(p.content.children.map(node => node.getAttribute('data-bl-bridge') || node.className || 'row'), ['row', 'row', 'glossary', 'models', 'bl-ext-compat']);
    assert.equal(p.content.querySelector('[data-bl-bridge="glossary"]').dataset.blTabG, '1');
    const bare = page({ anchors: false, note: false, tabs: false }); use(bare.doc);
    mountBridgeUi(bare.doc, fakeBridge());
    assert.equal(bare.content.children.at(-1).getAttribute('data-bl-bridge'), 'models');
});
await test('⑥ 기능을 안 쓰는 모드면 넣지 않고, 있던 칸은 치워요 · 설정 칸이 없으면 아무것도 안 해요', async () => {
    const p = page(); use(p.doc);
    const bridge = fakeBridge();
    mountBridgeUi(p.doc, bridge);
    bridge.state.features = false;
    assert.equal(mountBridgeUi(p.doc, bridge), false);
    assert.deepEqual(p.content.children, p.foreign);
    const none = makeDoc(); use(none);
    assert.equal(mountBridgeUi(none, fakeBridge()), false);
});

console.log(`\next-bridge-ui: ${passed}개 통과`);
