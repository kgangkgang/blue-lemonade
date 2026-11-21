// 1.9.9 날씨 「트래커 따라」 × 상태창 날씨 창구 (src/weather-meatball.js readStatusWeather · src/weather.js · src/weather-readability.js)
//   원작 상태창이 없고(설정 칸만 남았거나 아예 없음) 상태창을 맡은 다른 확장이 globalThis[Symbol.for('blue-lemonade.status-weather.v1')] 로 날씨 · 때를 내줘요.
//   ① 읽기 조건(없음 · 빈 글 · 오류) ② 원작 매크로 > 창구 > 트래커 ③ 창구 사건 · 늦게 실림으로 다시 그림 ④ 제외할 날씨 · 밤 별 · 따라가기 끔 ⑤ 고를 수 있나(trackerWeatherOn)
//   node tools/tests/weather-status-window.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };

const handlers = new Map();
const eventSource = { on: (n, fn) => { if (!handlers.has(n)) handlers.set(n, []); handlers.get(n).push(fn); } };
const emit = n => { for (const fn of handlers.get(n) || []) fn(); };
const event_types = Object.fromEntries(['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'MESSAGE_EDITED', 'MESSAGE_RECEIVED', 'GENERATION_ENDED'].map(n => [n, n]));
// 원작: 설정 칸이 켬으로 남았지만 확장은 없어 매크로가 안 풀려요(사용자 11-21 꼴) — upstream.live 로 원작이 살아 있는 꼴도 봐요
const upstream = { settings: true, live: false, weather: '☀️ 맑음', time: '낮' };
const meta = { mods: {} };
const chat = [{ is_user: true, mes: '안녕' }, { is_user: false, mes: '<status>\n날씨: 맑음\n</status>' }];
let chatId = 'c1';
function substituteParams(text) {
    if (!upstream.live) return text;
    const map = { weather: upstream.weather, time: upstream.time };
    return String(text).replace(/\{\{ss::(\w+)\}\}/g, (all, key) => (key in map ? map[key] : all));
}
const ctx = () => ({
    chat, eventSource, event_types, substituteParams, powerUserSettings: {}, saveSettingsDebounced() {},
    getCurrentChatId: () => chatId,
    extensionSettings: upstream.settings ? { statussim: { enabled: true } } : {},
    chatMetadata: { statussim: meta },
});
globalThis.SillyTavern = { getContext: ctx };
const timers = [];
globalThis.setTimeout = fn => { timers.push(fn); return timers.length; };
globalThis.clearTimeout = () => {};
const run = () => { for (let i = 0; i < 5 && timers.length; i++) for (const fn of timers.splice(0)) fn(); };
const noop = () => {};
const body = { dataset: {}, classList: { contains: () => false, add: noop, remove: noop } };
const host = { isConnected: true, prepend: noop, getBoundingClientRect: () => ({ width: 400, height: 800 }), clientWidth: 400, clientHeight: 800 };
const docListeners = new Map();
const fire = type => { for (const fn of docListeners.get(type) || []) fn({ type }); };
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
    createElement: () => { const el = { style: {}, isConnected: true, parentElement: host, setAttribute: noop, getContext: () => null }; el.remove = () => { el.isConnected = false; }; return el; },
    addEventListener: (type, fn) => { if (!docListeners.has(type)) docListeners.set(type, []); docListeners.get(type).push(fn); }, removeEventListener: noop,
};
console.warn = noop; console.info = noop;
const realNow = Date.now; let skew = 0; Date.now = () => realNow() + (skew += 3000);

const KEY = Symbol.for('blue-lemonade.status-weather.v1');
// 가짜 창구(상태창을 맡은 확장 꼴): read() → { text, time } | null · on(fn) → 해제
const box = { text: '🌧️ 비', time: '아침', reads: 0, listeners: new Set(), broken: false };
const windowObj = {
    version: 1,
    read() { box.reads++; if (box.broken) throw new Error('깨짐'); return box.text ? { text: box.text, time: box.time } : null; },
    on(fn) { box.listeners.add(fn); return () => box.listeners.delete(fn); },
};
const change = () => { for (const fn of box.listeners) fn({ reason: 'refresh' }); };

const M = await import(pathToFileURL(path.join(root, 'src/weather-meatball.js')));
const W = await import(pathToFileURL(path.join(root, 'src/weather.js')));
const R = await import(pathToFileURL(path.join(root, 'src/weather-readability.js')));
const state = () => W.weatherState();
const mode = () => state().current?.mode;
const follow = (extra = {}) => W.syncWeather(true, { weather: 'tracker', ...extra });

await check('reader: no window / empty / throws → null, otherwise { text, time }', () => {
    assert.equal(M.STATUS_WEATHER, KEY, '열쇠 이름');
    assert.equal(M.readStatusWeather(), null, '창구 없음');
    globalThis[KEY] = windowObj;
    assert.deepEqual(M.readStatusWeather(), { text: '🌧️ 비', time: '아침' });
    box.text = '  '; assert.equal(M.readStatusWeather(), null, '빈 글'); box.text = '🌧️ 비';
    box.broken = true; assert.equal(M.readStatusWeather(), null, '창구 오류'); box.broken = false;
    assert.equal(M.readStatusWeather({ [KEY]: { read: () => ({ text: '눈' }) } }).time, '', '때 없음');
    assert.equal(M.readStatusWeather({ [KEY]: { version: 1 } }), null, 'read 없음');
    delete globalThis[KEY];
});

await check('late window: tracker draws nothing before, rain after the ready event (user 11-21 case)', () => {
    follow({ weatherDeusRead: true });
    assert.equal(mode(), 'sun', '창구 전: 원작 매크로 안 풀림 → 마지막 답 상태 줄(맑음)');
    assert.equal(state().source, 'tracker');
    globalThis[KEY] = windowObj;
    fire('blue-lemonade:status-weather'); run();
    assert.equal(mode(), 'rain', '창구가 선 뒤 사건 한 번 → 비');
    assert.equal(state().source, 'status');
    assert.equal(state().meatball, '🌧️ 비');
    assert.equal(box.listeners.size, 1, '창구 구독 하나');
});

await check('window change event redraws (day over · weather changed)', () => {
    box.text = '❄️ 눈'; change(); run();
    assert.equal(mode(), 'snow', '날씨 바꾸기');
    box.text = '🌫 안개'; change(); run();
    assert.equal(mode(), 'fog');
    box.text = '☀️ 맑음'; box.time = '밤'; change(); run();
    assert.equal(mode(), 'star', '밤 맑음 → 별');
    box.time = '23:30'; box.text = '☀️ 맑음'; change(); run();
    assert.equal(mode(), 'star', '시각 꼴 때');
    box.text = '🌧️ 비'; box.time = '아침';
    emit('CHARACTER_MESSAGE_RENDERED'); run();
    assert.equal(mode(), 'rain', '답 사건으로도');
    fire('blue-lemonade:status-weather'); run();
    assert.equal(box.listeners.size, 1, '같은 창구를 두 번 구독하지 않아요');
});

await check('reads only on events, never per frame', () => {
    const before = box.reads; run(); run();
    assert.equal(box.reads, before);
});

await check('original meatball macros win over the window', () => {
    upstream.live = true; upstream.weather = '❄️ 눈';
    emit('CHAT_CHANGED'); run();
    assert.equal(mode(), 'snow', '원작이 살아 있으면 원작');
    assert.equal(state().source, 'meatball');
    upstream.live = false; emit('CHAT_CHANGED'); run();
    assert.equal(mode(), 'rain', '원작이 없으면 창구');
    assert.equal(state().source, 'status');
});

await check('window null → old deus / status text path; unknown text keeps current', () => {
    box.text = ''; change(); run();
    assert.equal(mode(), 'sun', '창구 null(달력 꺼짐 등) → 마지막 답 상태 줄');
    assert.equal(state().source, 'tracker');
    box.text = '🌧️ 비'; change(); run();
    assert.equal(mode(), 'rain');
    box.text = '🎃 이상한 하늘'; change(); run();
    assert.equal(mode(), 'rain', '모르는 글 → 지금 값');
    assert.equal(state().source, 'status');
    box.text = '🌧️ 비';
});

await check('skip list · per-weather level · follow off still apply', () => {
    follow({ weatherTrackerSkip: ['rain'] });
    assert.equal(mode(), 'off', '비를 제외');
    follow({ weatherTrackerSkip: ['sun'], weatherProfiles: { rain: { weatherLevel: 3 } } });
    assert.equal(mode(), 'rain');
    assert.equal(state().current.level, 3, '비 탭에서 맞춘 세기');
    follow({ weatherFollowMeatball: false });
    assert.equal(mode(), 'sun', '「날씨 따라가기: 상태창」 끔 → 창구 안 읽음');
    follow({ weatherDeusRead: false });
    assert.equal(mode(), 'rain', '데우스 호환 꺼도 창구 날씨는 따라가요');
    box.text = ''; change(); run();
    assert.equal(mode(), 'off', '데우스 호환 꺼짐 · 창구 null → 상태 줄 안 읽음');
    box.text = '🌧️ 비'; follow();
});

await check('trackerWeatherOn: window alone enables tracker', () => {
    upstream.settings = false;
    assert.equal(R.trackerWeatherOn({ deus: { on: false } }), true, '창구만 있어도');
    delete globalThis[KEY];
    assert.equal(R.trackerWeatherOn({ deus: { on: false } }), false, '창구 · 원작 · 데우스 다 없음');
    assert.equal(R.trackerWeatherOn({ deus: { on: true } }), true);
    upstream.settings = true;
    assert.equal(R.trackerWeatherOn({ deus: { on: false } }), true, '원작 설정 켬');
    globalThis[KEY] = windowObj;
});

await check('settings label says 상태창 (no private extension name)', async () => {
    const { SETTING_LABELS } = await import(pathToFileURL(path.join(root, 'src/settings-labels.js')));
    assert.equal(SETTING_LABELS['chat.weatherFollowMeatball'], '날씨 따라가기: 상태창');
});
console.log(`weather-status-window: ${passed} passed`);
