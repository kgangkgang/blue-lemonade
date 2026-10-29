// Mermaid 도표 — 묶어 둔 mermaid 11.12.3 이 끝없이 도는 도표 세 가지(간트 모든 요일 빼기 · xychart 같은 값 x 축 · radar 큰 ticks)를
// 그리기 전에 막는지. mermaid 11.15.0 · 11.16.1 의 보안 고침(GHSA-6m6c-36f7-fhxh · GHSA-2v8p-3f2j-5mp7 · GHSA-rhh3-jpg6-66xh)과 같은 조건이에요.
//   node tools/tests/mermaid-dos-guard.mjs .        (네트워크 없음 · 가짜 DOM · 가짜 그림 도구)
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const rootUrl = pathToFileURL(root + path.sep);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let passed = 0, failed = 0, generation = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); } }

const TYPES = { CHARACTER_MESSAGE_RENDERED: 'cmr', USER_MESSAGE_RENDERED: 'umr', CHAT_CHANGED: 'cc', MESSAGE_SWIPED: 'ms', MESSAGE_UPDATED: 'mu', MORE_MESSAGES_LOADED: 'mml' };
function world(sources) {
    const scripts = [], handlers = {}, codes = [], renders = [];
    for (const key of ['webpackChunkextension_mermaid', 'webpackChunkblue_lemonade_mermaid', '__blMermaidEngine', '__blMermaidBase']) delete globalThis[key];
    class El {
        constructor(tag) { this.tag = tag; this.children = []; this.isConnected = false; this.textContent = ''; this.className = ''; this.hidden = false; this.attrs = {}; this.classList = { add: (...names) => { this.className = [...new Set([...this.className.split(' '), ...names])].join(' '); }, remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); } }; }
        append(...els) { for (const el of els) { el.parentElement = this; el.isConnected = this.isConnected; this.children.push(el); } }
        remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(el => el !== this); }
        setAttribute(key, value) { this.attrs[key] = value; }
        closest(selector) { return selector === '#chat' && this.isConnected ? chat : null; }
        set innerHTML(value) { this._html = value; }
        querySelector(tag) { return this.children.find(el => el.tag === tag); }
        replaceChildren(...els) { this.children = []; this.append(...els); }
    }
    const chat = new El('chat'); chat.isConnected = true; chat.scrollTop = 0; chat.scrollHeight = 100; chat.clientHeight = 100;
    const body = new El('body'); body.isConnected = true;
    for (const source of sources) { const pre = new El('pre'), code = new El('code'); pre.isConnected = true; code.textContent = source; code.className = 'language-mermaid'; pre.append(code); codes.push(code); }
    globalThis.document = { scripts, body, head: { append(el) { el.isConnected = true; scripts.push(el); } }, createElement: tag => new El(tag), querySelectorAll: () => codes.filter(code => code.isConnected), getElementById: id => id === 'chat' ? chat : scripts.find(el => el.id === id && el.isConnected) };
    globalThis.SillyTavern = { getContext: () => ({ event_types: TYPES, eventSource: { on(type, fn) { (handlers[type] ??= []).push(fn); } } }) };
    // 가짜 그림 도구: 실제 mermaid 11.12.3 은 아래 도표에서 멈추지 않으므로 받은 글만 적어 둔다
    const execute = script => { globalThis.webpackChunkblue_lemonade_mermaid = []; globalThis.__blMermaidEngine = { initialize() {}, async render(_id, source) { renders.push(source); return { svg: '<svg></svg>' }; } }; script.onload(); };
    return { scripts, codes, renders, execute };
}
const loadAddon = () => import(new URL('src/addons/mermaid/index.js', rootUrl).href + '?case=' + (++generation));
async function run(sources) {
    const w = world(sources);
    await loadAddon();
    assert.equal(w.scripts.length, 1, '도표가 있으니 그림 도구를 한 번 불러와요');
    w.execute(w.scripts[0]);
    await sleep(120);
    return w;
}
const failedNotice = code => code.parentElement.children.some(el => el.className === 'bl-mermaid-error');
const drawn = code => code.parentElement.children.some(el => el.className === 'bl-mermaid-output');

await test('간트: 모든 요일을 빼면 그림 도구에 넘기지 않고 원문 + 다시 그리기를 남겨요', async () => {
    const all = 'gantt\n  excludes monday,tuesday,wednesday,thursday,friday,saturday,sunday\n  멈춤 :2025-01-01, 1d';
    const weekends = '---\ntitle: 일정\n---\ngantt\n    dateFormat YYYY-MM-DD\n    %% 주석\n    weekend friday\n    excludes weekends sunday monday tuesday wednesday thursday\n    일 :a1, 2025-01-01, 3d';
    const semicolon = 'gantt; excludes Monday Tuesday Wednesday Thursday Friday weekends; 일 :2025-01-01, 1d';
    const w = await run([all, weekends, semicolon]);
    assert.deepEqual(w.renders, [], '멈추는 간트는 그림 도구에 넘기지 않아요');
    for (const code of w.codes) { assert.equal(code.hidden, false, '원문이 그대로 보여요'); assert.ok(failedNotice(code), '다시 그리기 안내가 붙어요'); }
});

await test('간트: 하루라도 남으면 그대로 그려요 (weekend friday 면 일요일이 남아요)', async () => {
    const workdays = 'gantt\n  excludes weekends\n  일 :2025-01-01, 3d';
    const sundayLeft = 'gantt\n  weekend friday\n  excludes weekends monday tuesday wednesday thursday\n  일 :2025-01-01, 1d';
    const dates = 'gantt\n  dateFormat YYYY-MM-DD\n  excludes 2025-01-02, 2025-01-03\n  일 :2025-01-01, 5d';
    const w = await run([workdays, sundayLeft, dates]);
    assert.deepEqual(w.renders, [workdays, sundayLeft, dates]);
    for (const code of w.codes) assert.ok(drawn(code));
});

await test('xychart: x 축 범위의 두 값이 같으면 넘기지 않고, 다르면 그대로 그려요', async () => {
    const same = 'xychart\n  x-axis 1 --> 1\n  line [1, 2]';
    const titled = 'xychart-beta\n  title "매출"\n  x-axis "달" 3.0 --> 3\n  bar [1, 2, 3]';
    const fine = 'xychart-beta\n  x-axis "달" 1 --> 12\n  line [1, 2, 3]';
    const w = await run([same, titled, fine]);
    assert.deepEqual(w.renders, [fine]);
    assert.ok(failedNotice(w.codes[0]) && failedNotice(w.codes[1]));
    assert.ok(drawn(w.codes[2]));
});

await test('radar: ticks 가 32 보다 크면 32 로 줄여 그려요 (mermaid 11.16.1 과 같은 결과), 원문은 그대로', async () => {
    const huge = 'radar-beta\n  axis a, b\n  curve c {1, 1}\n  ticks 1000000000';
    const small = 'radar-beta\n  axis a, b\n  curve c {1, 1}\n  ticks 5';
    const w = await run([huge, small]);
    assert.deepEqual(w.renders, ['radar-beta\n  axis a, b\n  curve c {1, 1}\n  ticks 32', small]);
    assert.equal(w.codes[0].textContent, huge, '메시지 원문은 바꾸지 않아요');
    assert.ok(drawn(w.codes[0]) && drawn(w.codes[1]));
});

await test('다른 도표는 손대지 않아요', async () => {
    const flow = 'flowchart TD\n  A[excludes monday,tuesday,wednesday,thursday,friday,saturday,sunday] --> B\n  C["ticks 99999"]';
    const w = await run([flow]);
    assert.deepEqual(w.renders, [flow]);
});

for (const key of ['document', 'SillyTavern', 'webpackChunkextension_mermaid', 'webpackChunkblue_lemonade_mermaid', '__blMermaidEngine', '__blMermaidBase']) delete globalThis[key];
console.log(`${failed ? 'FAIL' : 'PASS'} mermaid DoS guard: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
