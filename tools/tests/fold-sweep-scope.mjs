// 최적화 9차: 접기(src/fold.js) 안전망 훑기 범위 — 메시지 사건(그림 · 스와이프 · 고침 · 생성 끝)은 #chat 안만,
//   채팅 바꾸기 · 더 보기 · 화면 돌아옴은 예전처럼 문서 전체. 한 묶음(80ms) 안에 전체 요청이 하나라도 있으면 전체.
//   node tools/tests/fold-sweep-scope.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const calls = [];
const el = name => ({ name, nodeType: 1, querySelectorAll: sel => { calls.push(`${name}:${sel}`); return []; } });
const chat = el('chat');
const listeners = new Map();
const doc = {
    ...el('doc'), documentElement: {}, head: { append() {} },
    getElementById: id => (id === 'chat' ? chat : null),
    createElement: () => ({ setAttribute() {}, textContent: '' }),
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: () => {},
};
const bus = new Map();
const types = { CHAT_CHANGED: 'cc', MORE_MESSAGES_LOADED: 'ml', CHARACTER_MESSAGE_RENDERED: 'cr', MESSAGE_SWIPED: 'sw', MESSAGE_UPDATED: 'mu' };
const timers = [];
globalThis.window = { document: doc, addEventListener() {}, removeEventListener() {}, SillyTavern: { getContext: () => ({ eventSource: { on: (t, fn) => bus.set(t, fn), removeListener() {} }, event_types: types }) } };
globalThis.setTimeout = fn => { timers.push(fn); return timers.length; };
globalThis.clearTimeout = id => { if (id) timers[id - 1] = null; };
const origInfo = console.info; console.info = () => {};
const { syncFold } = await import(pathToFileURL(path.join(root, 'src/fold.js')).href);
syncFold(true);
const run = () => { const list = timers.splice(0); for (const fn of list) fn?.(); };
const take = () => calls.splice(0);
take();   // 켤 때 첫 훑기(문서 전체)

let pass = 0;
const t = (name, fn) => { fn(); pass++; };
t('message events scan #chat only', () => {
    for (const k of ['cr', 'sw', 'mu']) { bus.get(k)(3); run(); assert.deepEqual(take(), ['chat:details', 'chat:iframe'], k); }
});
t('chat change / more messages / visibility scan the whole document', () => {
    bus.get('cc')(); run(); assert.deepEqual(take(), ['doc:details', 'doc:iframe']);
    bus.get('ml')(); run(); assert.deepEqual(take(), ['doc:details', 'doc:iframe']);
    listeners.get('visibilitychange')({ type: 'visibilitychange' }); run(); assert.deepEqual(take(), ['doc:details', 'doc:iframe']);
});
t('a full request inside the same debounce window wins', () => {
    bus.get('sw')(1); bus.get('cc')(); bus.get('cr')(2); run(); assert.deepEqual(take(), ['doc:details', 'doc:iframe']);
    bus.get('cr')(2); run(); assert.deepEqual(take(), ['chat:details', 'chat:iframe'], 'flag resets');
});
window.__thkFold.destroy();
console.info = origInfo;
console.log(`PASS fold-sweep-scope: ${pass} checks`);
