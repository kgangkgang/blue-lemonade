// 8.2.7 날씨 트래커 따라 × 새 스와이프 (src/weather.js refreshTracker) — 빈 글로 MESSAGE_SWIPED 가 온 뒤 생성하는 동안 날씨를 끄지 않아요.
//   node tools/tests/weather-tracker-swipe.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));

const handlers = new Map();
const eventSource = { on: (n, fn) => { if (!handlers.has(n)) handlers.set(n, []); handlers.get(n).push(fn); } };
const emit = n => { for (const fn of handlers.get(n) || []) fn(); };
const event_types = Object.fromEntries(['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'MESSAGE_EDITED'].map(n => [n, n]));
const chat = [{ is_user: true, mes: '안녕' }, { is_user: false, mes: '<status>\n날씨: 비\n</status>' }];
globalThis.SillyTavern = { getContext: () => ({ chat, eventSource, event_types, extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() {} }) };
const timers = [];
globalThis.setTimeout = fn => { timers.push(fn); return timers.length; };
globalThis.clearTimeout = () => {};
const run = () => { for (let i = 0; i < 5 && timers.length; i++) for (const fn of timers.splice(0)) fn(); };
const noop = () => {};
const body = { dataset: {}, classList: { contains: () => false, add: noop, remove: noop } };
const host = { isConnected: true, prepend: noop, getBoundingClientRect: () => ({ width: 400, height: 800 }), clientWidth: 400, clientHeight: 800 };
globalThis.window = globalThis;
globalThis.matchMedia = () => ({ matches: false, addEventListener: noop, removeEventListener: noop });
globalThis.devicePixelRatio = 1;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = noop;
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
globalThis.document = {
    hidden: false, body, documentElement: { classList: { contains: () => false, add: noop, remove: noop } },
    querySelector: s => (s === 'body > #sheld' ? host : null), querySelectorAll: () => [], getElementById: id => (id === 'sheld' ? host : null),
    createElement: () => ({ style: {}, isConnected: true, parentElement: host, remove: noop, setAttribute: noop, getContext: () => null }),
    addEventListener: noop, removeEventListener: noop,
};
console.warn = noop; console.info = noop;
const W = await import(pathToFileURL(path.join(root, 'src/weather.js')));
W.syncWeather(true, { weather: 'tracker' });
const mode = () => W.weatherState().current?.mode;
assert.equal(mode(), 'rain', '마지막 답의 상태창 날씨(비)를 따라가요');

// 오른쪽으로 밀어 새 스와이프: 실리태번은 글을 비운 채 MESSAGE_SWIPED 를 내고 곧 생성을 시작해요
chat[1].mes = '';
body.dataset.generating = 'true';
emit('MESSAGE_SWIPED');
run();
assert.equal(mode(), 'rain', '새 스와이프를 생성하는 동안 날씨를 끄지 않아요');

// 답이 다 오면 새 날씨로
chat[1].mes = '<status>\n날씨: 눈\n</status>';
delete body.dataset.generating;
emit('CHARACTER_MESSAGE_RENDERED');
run();
assert.equal(mode(), 'snow', '답이 끝나면 새 상태창 날씨를 따라가요');

// 생성 중이 아니면 바로(0.4초 뒤) 따라가요 — 왼쪽으로 밀어 옛 스와이프로
chat[1].mes = '<status>\n날씨: 비\n</status>';
emit('MESSAGE_SWIPED');
run();
assert.equal(mode(), 'rain');
// 그리는 쪽(캔버스)은 이 흉내에 없어 늦게 경고를 내요 — 경고는 끈 채로 둬요
console.log('PASS 날씨 트래커 따라는 새 스와이프를 생성하는 동안 지금 날씨를 두고, 끝나면 새 날씨를 따라가요');
