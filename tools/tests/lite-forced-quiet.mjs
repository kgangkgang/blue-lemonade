// 8.2.6 성능: src/lite.js 「늘 펼친 메시지 단추」 재기(detectForced)가 바뀔 것이 없을 때 body class 를 건드리지 않는지 —
//   없는 클래스를 remove 해도 class 변경 기록이 나서 실리태번 keyboard.js 가 body 아래를 전부 다시 훑고 squared-buttons 가 body 를 통째로 다시 쟀어요.
//   끝 상태(body 클래스)는 예전과 같아요 (가짜 문서 · 가짜 타이머)
//   node tools/tests/lite-forced-quiet.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

// classList 흉내 — DOM 명세대로: add · remove 는 늘 class 를 다시 써서 변경 기록이 나고, toggle(이름, 참/거짓)은 상태가 바뀔 때만
function classes(initial = []) {
    const set = new Set(initial); const list = { records: 0 };
    list.contains = c => set.has(c);
    list.add = c => { set.add(c); list.records++; };
    list.remove = c => { set.delete(c); list.records++; };
    list.toggle = (c, force) => { const want = force === undefined ? !set.has(c) : !!force; if (want === set.has(c)) return want; if (want) set.add(c); else set.delete(c); list.records++; return want; };
    list.values = () => [...set].sort();
    return list;
}
const env = { checked: false, menu: null };
const body = { classList: classes(['salty']) };
const chat = { classList: classes(), querySelector: sel => sel.includes('last-of-type') ? env.menu : null, querySelectorAll: () => [], getElementsByClassName: () => [] };
globalThis.document = { body, getElementById: id => id === 'chat' ? chat : id === 'expandMessageActions' ? { checked: env.checked } : null, getElementsByClassName: () => [], addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
globalThis.getComputedStyle = el => ({ display: el.display });
globalThis.MutationObserver = class { observe() {} disconnect() {} };
let queue = [];
globalThis.setTimeout = fn => { queue.push(fn); return queue.length; };
globalThis.requestAnimationFrame = fn => { queue.push(fn); return queue.length; };
const flush = () => { for (let i = 0; queue.length && i < 50; i++) { const q = queue; queue = []; q.forEach(fn => fn(0)); } };
const handlers = [];
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: { salty: { enabled: true } }, powerUserSettings: {}, eventSource: { on: (n, fn) => handlers.push(fn) }, event_types: { CHAT_CHANGED: 'chat_changed' } }) };
const { startMenuOpenMark } = await import(pathToFileURL(path.join(root, 'src/lite.js')).href);
const menu = (display, extra = {}) => ({ classList: classes(), getAttribute: () => extra.style ?? null, display });
const changeChats = n => { for (let i = 0; i < n; i++) handlers.forEach(fn => fn()); flush(); };

startMenuOpenMark();
await test('실리태번 「메시지 작업 펼치기」를 켠 사람: 시작 · 채팅 바꾸기 10번에도 body class 변경 기록 0', () => {
    env.checked = true; env.menu = menu('flex');
    body.classList.records = 0; flush(); changeChats(10);
    assert.equal(body.classList.records, 0);
    assert.deepEqual(body.classList.values(), ['salty']);
});
await test('마지막 메시지 단추 칸이 없을 때도 0', () => {
    env.checked = false; env.menu = null;
    body.classList.records = 0; changeChats(5);
    assert.equal(body.classList.records, 0);
});
await test('늘 펼친 환경(다른 CSS 가 칸을 보이게 둠)은 예전처럼 표시를 달고, 다시 잴 때만 잠깐 떼었다 달아요 · 펼치기를 켜면 내 표시를 한 번 떼요', () => {
    env.menu = menu('flex');
    body.classList.records = 0; changeChats(1);
    assert.deepEqual(body.classList.values(), ['bl-forced-expand', 'expandMessageActions', 'salty']);
    assert.equal(body.classList.records, 2, '처음: 내 표시 + 실리태번 표시');
    body.classList.records = 0; changeChats(1);
    assert.deepEqual(body.classList.values(), ['bl-forced-expand', 'expandMessageActions', 'salty']);
    assert.equal(body.classList.records, 2, '다시 잴 때: 실리태번 표시를 잠깐 떼고 다시(같은 태스크)');
    env.checked = true; body.classList.records = 0; changeChats(3);
    assert.deepEqual(body.classList.values(), ['expandMessageActions', 'salty'], '펼치기를 켜면 내 표시만 떼요(실리태번 표시는 실리태번 것)');
    assert.equal(body.classList.records, 1);
});
await test('펼친 환경이 아니면(메뉴가 닫혀 숨음) 아무것도 쓰지 않아요', () => {
    env.checked = false; env.menu = menu('none');
    body.classList.remove('expandMessageActions'); body.classList.records = 0; changeChats(5);
    assert.equal(body.classList.records, 0);
    assert.deepEqual(body.classList.values(), ['salty']);
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/lite-forced-quiet\.mjs \./);
});
console.log(`\n${passed} passed`);
