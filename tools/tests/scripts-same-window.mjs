// 9.0.7 내장 스크립트 계약: iframe 0개 · 진짜 setInterval 1개(공용 스케줄러) · 한글화 사전은 처음 필요할 때 · 감시 객체는 스크립트별로 세고 줄였어요.
//   예전(8.2.4 폰 4배 측정): 스크립트마다 숨은 iframe(문서 3 → 38) · 감시 객체 92 · setInterval 45회 371ms · korean.js 1,031KB 를 시작 때 평가.
//   이 시험은 실리태번 · 브라우저 없이 돌아요: 작은 가짜 문서 · 가짜 창 위에서 plain 모듈 여덟 개를 실행기와 같은 길(createRealm → install(api, realm.window))로 켜고 꺼요.
//   글은 모두 지어낸 것이에요.
//   node tools/tests/scripts-same-window.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`  PASS  ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${String(e.stack || e).split('\n').slice(0, 8).join('\n        ')}`); } };

// ── 진짜 setInterval 세기 (스케줄러가 쓰는 전역)
const realSetInterval = globalThis.setInterval, realClearInterval = globalThis.clearInterval;
const activeIntervals = new Set();
globalThis.setInterval = (fn, ms, ...rest) => { const handle = realSetInterval(fn, ms, ...rest); activeIntervals.add(handle); return handle; };
globalThis.clearInterval = handle => { activeIntervals.delete(handle); realClearInterval(handle); };

// ── 작은 가짜 문서
class FakeEl {
    constructor(tag, doc) { this.tagName = String(tag).toUpperCase(); this.localName = String(tag).toLowerCase(); this.ownerDocument = doc; this.nodeType = 1; this.children = []; this.childNodes = this.children; this.parentElement = null; this.parentNode = null; this.attrs = {}; this.style = { setProperty() {}, removeProperty() {} }; this.dataset = {}; this.listeners = []; this.textContent = ''; this.innerHTML = ''; this.hidden = false; this.id = ''; this.className = ''; const cls = new Set(); this.classList = { add: (...c) => c.forEach(x => cls.add(x)), remove: (...c) => c.forEach(x => cls.delete(x)), toggle: (c, on) => { const v = on ?? !cls.has(c); if (v) cls.add(c); else cls.delete(c); return v; }, contains: c => cls.has(c) }; }
    get isConnected() { for (let n = this; n; n = n.parentNode) if (n === this.ownerDocument?.documentElement) return true; return false; }
    get firstElementChild() { return this.children[0] || null; }
    get firstChild() { return this.children[0] || null; }
    get childElementCount() { return this.children.length; }
    get nextElementSibling() { const list = this.parentElement?.children || []; return list[list.indexOf(this) + 1] || null; }
    append(...nodes) { for (const n of nodes) { if (typeof n !== 'object') continue; n.remove?.(); n.parentElement = n.parentNode = this; this.children.push(n); } }
    prepend(...nodes) { for (const n of nodes.reverse()) { if (typeof n !== 'object') continue; n.remove?.(); n.parentElement = n.parentNode = this; this.children.unshift(n); } }
    appendChild(n) { this.append(n); return n; }
    insertBefore(n) { this.append(n); return n; }
    after() {} before() {}
    replaceChildren(...nodes) { for (const n of [...this.children]) n.remove(); this.append(...nodes); }
    remove() { const p = this.parentElement; if (p) { const i = p.children.indexOf(this); if (i >= 0) p.children.splice(i, 1); } this.parentElement = this.parentNode = null; }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    hasAttribute(k) { return k in this.attrs; }
    removeAttribute(k) { delete this.attrs[k]; }
    toggleAttribute(k, on) { if (on ?? !(k in this.attrs)) this.attrs[k] = ''; else delete this.attrs[k]; }
    addEventListener(type, fn, options) { this.listeners.push([type, fn, options]); }
    removeEventListener(type, fn) { const i = this.listeners.findIndex(([t, f]) => t === type && f === fn); if (i >= 0) this.listeners.splice(i, 1); }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    getElementsByTagName() { return []; }
    getElementsByClassName() { return []; }
    closest() { return null; }
    matches() { return false; }
    contains(n) { for (let x = n; x; x = x.parentNode) if (x === this) return true; return false; }
    getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
    getClientRects() { return []; }
    getRootNode() { let n = this; while (n.parentNode) n = n.parentNode; return n; }
    focus() {} blur() {} click() {} scrollIntoView() {}
    get offsetHeight() { return 0; } get offsetWidth() { return 0; }
}
function fakePage({ bodyChildren = 0 } = {}) {
    const doc = { nodeType: 9, readyState: 'complete', hidden: false, baseURI: 'http://localhost:8000/', activeElement: null, listeners: [], title: '' };
    doc.createElement = tag => new FakeEl(tag, doc);
    doc.createElementNS = (_, tag) => new FakeEl(tag, doc);
    doc.createTextNode = text => ({ nodeType: 3, nodeValue: text, textContent: text, remove() {} });
    doc.documentElement = new FakeEl('html', doc); doc.documentElement.parentNode = null;
    doc.head = new FakeEl('head', doc); doc.body = new FakeEl('body', doc);
    doc.documentElement.append(doc.head, doc.body);
    const scopes = [];
    for (let i = 0; i < bodyChildren; i++) { const el = new FakeEl('div', doc); el.id = `panel${i}`; doc.body.append(el); scopes.push(el); }
    doc.getElementById = id => scopes.find(el => el.id === id) || null;
    doc.getElementsByClassName = () => [];
    // 한글화 범위(body 바로 아래 칸)만 돌려줘요 — 범위마다 감시 객체를 만들던 옛 꼴과 견주려고
    doc.querySelectorAll = selector => String(selector).startsWith('body > :not(#sheld') ? [...scopes] : [];
    doc.querySelector = () => null;
    doc.createTreeWalker = () => ({ nextNode: () => null, currentNode: null });
    doc.addEventListener = (type, fn, options) => doc.listeners.push([type, fn, options]);
    doc.removeEventListener = (type, fn) => { const i = doc.listeners.findIndex(([t, f]) => t === type && f === fn); if (i >= 0) doc.listeners.splice(i, 1); };
    return { doc, scopes };
}
// 가짜 창: 감시 객체 · 타이머를 세요
function fakeWindow(doc) {
    const made = [], live = new Set(), idleQueue = [], listeners = [];
    class FakeObserver { constructor(fn) { this.fn = fn; made.push(this); } observe() { live.add(this); } disconnect() { live.delete(this); } takeRecords() { return []; } unobserve() {} }
    const win = {
        document: doc, NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 },
        MutationObserver: class extends FakeObserver {}, ResizeObserver: class extends FakeObserver {}, IntersectionObserver: class extends FakeObserver {},
        setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms ?? 0, 5)), clearTimeout: handle => clearTimeout(handle),
        requestAnimationFrame: fn => setTimeout(() => fn(0), 1), cancelAnimationFrame: handle => clearTimeout(handle),
        requestIdleCallback: fn => { idleQueue.push(fn); return idleQueue.length; }, cancelIdleCallback: handle => { idleQueue[handle - 1] = null; },
        queueMicrotask: fn => queueMicrotask(fn), performance: { now: () => performance.now() },
        confirm() { return true; }, prompt() { return null; },   // 브라우저의 기본 함수처럼 prototype 없음
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        visualViewport: { addEventListener() {}, removeEventListener() {}, width: 400, height: 800, offsetLeft: 0, offsetTop: 0 },
        innerWidth: 400, innerHeight: 800,
        getComputedStyle: () => ({ getPropertyValue: () => '', display: 'block', visibility: 'visible', opacity: '1' }),
        addEventListener: (type, fn, options) => listeners.push([type, fn, options]),
        removeEventListener: (type, fn) => { const i = listeners.findIndex(([t, f]) => t === type && f === fn); if (i >= 0) listeners.splice(i, 1); },
        SillyTavern: { getContext: () => ({ extensionSettings: { blue_lemonade_scripts: { enabled: {}, names: {} } }, eventSource: { on() {}, once() {}, removeListener() {}, off() {} }, event_types: {}, chat: [], characters: [] }) },
        toastr: { success() {}, error() {}, info() {}, warning() {} },
        Function,
    };
    return { win, made, live, idleQueue, listeners, runIdle: () => { for (const fn of idleQueue.splice(0)) fn?.({ didTimeout: false, timeRemaining: () => 50 }); } };
}
const settle = (ms = 30) => new Promise(resolve => setTimeout(resolve, ms));

const { createRealm } = await load('src/scripts/realm.js');
const scheduler = await load('src/scripts/scheduler.js');
const { PARAMS } = await load('tools/build-plain-scripts.mjs');
const { SCRIPT_CATALOG } = await import(pathToFileURL(path.join(root, 'src/scripts/catalog.js')).href);
const ids = SCRIPT_CATALOG.map(item => item.file);

// 실행기(runtime.js startOne · stop)와 같은 길로 켜고 끄기
async function start(id, page, fake, extra = {}) {
    const install = (await load(`src/scripts/plain/${id}.js`)).default;
    const cleanups = [], realm = createRealm(id, { host: fake.win });
    const api = Object.freeze({
        fonts: { list: () => [], stack: () => null, load() {} },
        deusOptionHelp: () => () => {}, fruitOptionHelp: () => () => {}, localizeFruitStatus: () => () => {},
        promptTitle: () => null, choicePeers: () => [],
        onCleanup(fn) { if (typeof fn === 'function') cleanups.push(fn); },
        translate() { cleanups.push(() => {}); },
        ...extra,
    });
    install(api, realm.window);
    return { realm, stop() { for (const fn of [...realm.hides(), ...cleanups]) fn(); realm.dispose(); } };
}

await test('iframe 0개: 실행기는 iframe · contentWindow · 코드 글 실행(Function) 없이 모듈을 import 해 (BlueLemonade, window) 로 불러요', () => {
    const runtime = read('src/scripts/runtime.js');
    assert.ok(!/createElement\(['"]iframe/.test(runtime) && !runtime.includes('contentWindow') && !runtime.includes('Function('), 'no iframe / no code-as-text');
    assert.ok(runtime.includes("import {createRealm} from './realm.js';") && runtime.includes('install(apiFor(id,cleanups),realm.window);'));
    assert.deepEqual(PARAMS, ['BlueLemonade', 'window']);
    assert.ok(!fs.existsSync(path.join(root, 'src/scripts/bundled')), 'no second copy');
    for (const id of ids) assert.ok(read(`src/scripts/plain/${id}.js`).includes(`export default function blueLemonadeScript(${PARAMS.join(', ')}) {`), id);
    assert.ok(!read('src/scripts/catalog.js').includes('fetch('), 'no fetch-as-text detour');
});

await test('스크립트는 창 대리(window)를 거쳐서만 타이머 · 감시를 써요 — 맨 setInterval · setTimeout · MutationObserver 없음', () => {
    const bare = /(?<![\w.$'"`])(setInterval|setTimeout|clearInterval|clearTimeout|requestAnimationFrame|MutationObserver|ResizeObserver)\s*\(/;
    for (const id of ids) {
        const lines = read(`src/scripts/plain/${id}.js`).split('\n').filter(line => line.length < 2000 && !/^\s*\/\//.test(line));
        const hit = lines.find(line => bare.test(line) && !/['"`].*(setTimeout|MutationObserver).*['"`]/.test(line));
        assert.equal(hit, undefined, `${id}: ${hit?.trim().slice(0, 100)}`);
    }
});

await test('창 대리: parent · top · self 는 자기 자신 · 기본 함수는 진짜 창에 묶이고 되돌려 넣으면 원래 함수 · pagehide 는 끌 때 부름', () => {
    const { doc } = fakePage(); const fake = fakeWindow(doc);
    const realm = createRealm('t', { host: fake.win }), w = realm.window;
    assert.equal(w.parent, w); assert.equal(w.top, w); assert.equal(w.self, w);
    let host = w; while (host.parent && host.parent !== host) host = host.parent;
    assert.equal(host, w, '「부모를 따라 올라가기」가 대리에서 멈춰요');
    assert.equal(w.document, doc);
    const original = fake.win.confirm, got = w.confirm;
    assert.notEqual(got, original); assert.equal(w.confirm, got, '같은 묶음 함수');
    w.confirm = function mine() { return false; }; w.confirm = got;
    assert.equal(fake.win.confirm, original, '묶은 함수를 넣으면 원래 함수로');
    // 크롬의 NodeFilter 는 prototype 없는 함수에 상수를 품어요 — 묶으면 상수가 사라져 트리 훑기가 빈손(실제 창 점검에서 잡힌 것)
    const NodeFilter = () => {}; Object.assign(NodeFilter, { SHOW_ELEMENT: 1, SHOW_TEXT: 4 }); fake.win.NodeFilter = NodeFilter;
    assert.equal(w.NodeFilter, NodeFilter); assert.equal(w.NodeFilter.SHOW_ELEMENT | w.NodeFilter.SHOW_TEXT, 5);
    let hidden = 0; w.addEventListener('pagehide', () => hidden++, { once: true });
    assert.equal(fake.listeners.length, 0, 'pagehide 는 진짜 창에 안 걸어요');
    for (const fn of realm.hides()) fn();
    assert.equal(hidden, 1);
    w.addEventListener('resize', () => {}); assert.equal(fake.listeners.length, 1);
    realm.dispose(); assert.equal(fake.listeners.length, 0, '남은 창 리스너는 끌 때 떼요');
});

await test('setInterval 1개: 여러 스크립트의 되풀이 일이 진짜 타이머 하나를 나눠 써요 · 가려지면 멈춰요 · 다 끄면 0개', async () => {
    scheduler.resetScheduler(); activeIntervals.clear();
    const { doc } = fakePage(); const fake = fakeWindow(doc);
    const a = createRealm('a', { host: fake.win }), b = createRealm('b', { host: fake.win });
    let runsA = 0, runsB = 0;
    a.window.setInterval(() => runsA++, 60); b.window.setInterval(() => runsB++, 120); b.window.setInterval(() => {}, 500);
    assert.equal(activeIntervals.size, 1, '진짜 setInterval 하나');
    assert.equal(scheduler.schedulerStats().period, 60, '가장 짧은 간격');
    await settle(400);
    assert.ok(runsA >= 3 && runsB >= 1 && runsA > runsB, `${runsA} / ${runsB}`);
    globalThis.document = { hidden: true, addEventListener() {}, removeEventListener() {} };
    await settle(150); const paused = runsA; await settle(200);
    assert.equal(runsA, paused, '가려지면 안 돌아요'); assert.equal(activeIntervals.size, 0, '가려지면 진짜 타이머도 내려요');
    globalThis.document.hidden = false; scheduler.every(() => {}, 1000).toString(); // 다시 걸기(보임 사건 대신)
    assert.equal(activeIntervals.size, 1);
    delete globalThis.document;
    a.dispose(); b.dispose(); scheduler.resetScheduler();
    assert.equal(activeIntervals.size, 0, '일이 없으면 0개');
});

await test('사전 지연: 한글화 모듈은 사전 없이 시작하고(감시 0) 쉬는 틈에 한 번 받아 그때 감시를 걸어요 · 받는 파일은 정적 그래프 밖', async () => {
    scheduler.resetScheduler();
    const code = read('src/scripts/plain/korean.js');
    assert.ok(Buffer.byteLength(code) < 80 * 1024, `모듈 ${Math.round(Buffer.byteLength(code) / 1024)}KB`);
    assert.ok(!code.includes('const TRANSLATIONS = {'));
    // 사전 파일은 ko-ui.js 의 동적 import 로만 받아요(정적 import 없음) · 1.0.0 되살린 무결성표(build-info.js)는 파일 이름만 적은 표라 빼요
    const importers = [];
    const walk = dir => { for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const rel = `${dir}/${e.name}`; if (e.isDirectory()) walk(rel); else if (/\.(m?js)$/.test(e.name) && rel !== 'src/build-info.js' && !rel.startsWith('src/ko-ui-text.') && read(rel).includes('ko-ui-text.')) importers.push(rel); } };
    walk('src'); importers.push(...(read('index.js').includes('ko-ui-text.') ? ['index.js'] : []));
    assert.deepEqual(importers.sort(), ['src/ko-ui.js', 'src/scripts/plain/korean.js'].sort());
    // 1.0.0 극한 최적화: 색인(index) 한 장 + 조각 여섯 — 전부 동적 import
    assert.match(read('src/ko-ui.js'), /textDictionary \?\?= import\('\.\/ko-ui-text\.index\.gen\.js'\)/);
    for (const name of ['boot', 'drawers', 'templates', 'js', 'html', 'rest']) assert.ok(read('src/ko-ui.js').includes(`import('./ko-ui-text.${name}.gen.js')`), name);
    assert.ok(!/^import .*ko-ui-text/m.test(read('src/ko-ui.js')));
    const { doc, scopes } = fakePage({ bodyChildren: 30 }); const fake = fakeWindow(doc);
    let asked = 0; const dictionary = { exact: [['Hello there', '안녕하세요']], htmlExact: [], PATTERNS: [] };
    const run = await start('korean', null, fake, { koreanDictionary: () => { asked++; return Promise.resolve(dictionary); } });
    assert.equal(asked, 0, '켜자마자 받지 않아요');
    assert.equal(fake.live.size, 0, '사전 전에는 감시도 없어요');
    assert.equal(doc.listeners.filter(([t]) => t === 'pointerdown').length, 1, '처음 누를 때도 받아요');
    fake.runIdle(); await settle();
    assert.equal(asked, 1, '쉬는 틈에 한 번');
    assert.equal(doc.listeners.filter(([t]) => t === 'pointerdown').length, 0, '받은 뒤 누르기 리스너는 떼요');
    const stats = run.realm.stats();
    assert.ok(stats.observers <= 6, `한글화 감시 객체 ${stats.observers}개 (범위 ${scopes.length}칸이어도 하나로)`);
    assert.ok(stats.observersMade <= 6, `만든 감시 객체 ${stats.observersMade}개`);
    run.stop();
    assert.equal(fake.live.size, 0, '끄면 감시가 다 끊겨요');
});

await test('여덟 스크립트를 실행기 길로 켜면: 진짜 setInterval ≤ 1 · 스크립트별 감시 객체 수 · 끄면 감시 · 일 · 리스너 0', async () => {
    scheduler.resetScheduler(); activeIntervals.clear();
    const { doc } = fakePage({ bodyChildren: 30 }); const fake = fakeWindow(doc);
    const runs = {}, counts = {};
    for (const id of ids) {
        runs[id] = await start(id, null, fake, { koreanDictionary: () => Promise.resolve({ exact: [], htmlExact: [], PATTERNS: [] }) });
    }
    fake.runIdle(); await settle(60);
    for (const id of ids) counts[id] = runs[id].realm.stats().observers;
    console.log('        감시 객체(스크립트별):', JSON.stringify(counts), '· 스케줄러', JSON.stringify(scheduler.schedulerStats()));
    assert.ok(activeIntervals.size <= 1, `진짜 setInterval ${activeIntervals.size}개`);
    assert.equal(counts.deus, 0); assert.equal(counts.fruit, 0);
    assert.ok(counts.korean <= 6 && counts.helper <= 2, JSON.stringify(counts));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    assert.ok(total <= 20, `모두 ${total}개`);
    for (const id of ids) runs[id].stop();
    assert.equal(fake.live.size, 0, '감시 0');
    assert.equal(scheduler.schedulerStats().tasks, 0, '되풀이 일 0');
    assert.equal(activeIntervals.size, 0, '진짜 setInterval 0');
    assert.equal(fake.listeners.length, 0, '창 리스너 0');
    assert.equal(doc.listeners.length, 0, '문서 리스너 0');
});

await test('CI 등록', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/scripts-same-window\.mjs \./);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
