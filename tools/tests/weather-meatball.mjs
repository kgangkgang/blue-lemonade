// 1.4.x 날씨 「트래커 따라」 × 미트볼 상태창 달력 날씨 (src/weather-meatball.js · src/weather.js)
//   ① 옮김 표 전수(그 확장 2.7.2 WEATHER 표 14값 × 한국어 · 영어 저장 + 이벤트 카드 폭우 + 자유 글) ② 읽기 조건(없음 · 꺼짐 · 달력 꺼짐)
//   ③ 바뀜 따라가기(답 · 그 확장 화면 누름 · 보내기 · 별도 분석 · 채팅 바꾸기) ④ 모르는 글은 지금 값 유지 ⑤ 직접 고른 날씨 > 미트볼 > 트래커
//   node tools/tests/weather-meatball.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log('PASS', name); };

// ── 가짜 실리태번 · 문서 ─────────────────────────────
const handlers = new Map();
const eventSource = { on: (n, fn) => { if (!handlers.has(n)) handlers.set(n, []); handlers.get(n).push(fn); } };
const emit = n => { for (const fn of handlers.get(n) || []) fn(); };
const event_types = Object.fromEntries(['CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'CHAT_CHANGED', 'MESSAGE_EDITED', 'MESSAGE_RECEIVED', 'GENERATION_ENDED'].map(n => [n, n]));
const mb = { installed: true, enabled: true, chatId: 'c1', weather: '🌧 비', time: '낮', meta: { mods: {} }, legacy: false, calls: 0 };
const chat = [{ is_user: true, mes: '안녕' }, { is_user: false, mes: '<status>\n날씨: 맑음\n</status>' }];
function substituteParams(text) {
    mb.calls++;
    if (!mb.installed) return text;
    const map = { weather: mb.weather, time: mb.time };
    return String(text).replace(mb.legacy ? /\{\{ss_(\w+)\}\}/g : /\{\{ss::(\w+)\}\}/g, (all, key) => (key in map ? map[key] : all));
}
const ctx = () => ({
    chat, eventSource, event_types, substituteParams, powerUserSettings: {}, saveSettingsDebounced() {},
    getCurrentChatId: () => mb.chatId,
    extensionSettings: mb.installed ? { statussim: { enabled: mb.enabled, sync: mb.sync } } : {},
    chatMetadata: mb.meta ? { statussim: mb.meta } : {},
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
// 가짜 캔버스는 그리지 못해 날씨 층이 「다시 시도는 2.5초 뒤」로 접혀요 — 시계를 한 번 부를 때마다 3초씩 넘겨 그 기다림이 시험 사이에 남지 않게 해요
const realNow = Date.now; let skew = 0; Date.now = () => realNow() + (skew += 3000);

const M = await import(pathToFileURL(path.join(root, 'src/weather-meatball.js')));
const W = await import(pathToFileURL(path.join(root, 'src/weather.js')));
const R = await import(pathToFileURL(path.join(root, 'src/weather-readability.js')));
const modesOf = (text, time = '') => M.meatballWeatherModes(text, time, W.detectWeatherAll);

// ── ① 옮김 표 ─────────────────────────────────────────
// 그 확장 2.7.2 src/engine.js WEATHER 표의 값(한국어 저장)과 src/skeleton_en.js SK_EN 의 영어 저장 값 — 판이 바뀌면 이 줄을 그 표와 다시 맞춰요
const UPSTREAM = [
    ['☀️ 맑음', '☀️ Clear', ['sun']], ['⛅ 구름', '⛅ Cloudy', []], ['🌧 비', '🌧 Rain', ['rain']], ['🌫 안개', '🌫 Fog', ['fog']],
    ['🌸 꽃바람', '🌸 Blossom Breeze', ['petal', 'breeze']], ['🔥 무더위', '🔥 Heat Wave', ['sun']], ['⛈ 소나기', '⛈ Shower', ['rain']], ['🌀 폭풍', '🌀 Storm', ['rain', 'breeze']],
    ['🍂 쌀쌀함', '🍂 Chilly', ['breeze']], ['☁️ 흐림', '☁️ Overcast', []], ['❄️ 눈', '❄️ Snow', ['snow']], ['🥶 한파', '🥶 Cold Snap', []], ['🌨 눈보라', '🌨 Blizzard', ['snow', 'breeze']],
    ['폭우', 'heavy rain', ['rain']],
];
await check('upstream weather table — every Korean and English value', () => {
    assert.equal(UPSTREAM.length, 14);
    for (const [ko, en, want] of UPSTREAM) {
        for (const text of [ko, en, ko.replace(/️/g, ''), en.toUpperCase(), ` ${ko} `]) {
            const got = modesOf(text);
            assert.equal(got.known, true, `${text} 는 아는 날씨`);
            assert.deepEqual(got.all, want, `${text} → ${want.join('+') || '끔'}`);
        }
    }
});
await check('free text from AI or user', () => {
    const cases = [
        ['이슬비', ['rain']], ['🌦 이슬비', ['rain']], ['소나기', ['rain']], ['진눈깨비', ['snow', 'rain']], ['Sleet', ['snow', 'rain']], ['천둥번개', ['rain']], ['⛈ Thunderstorm', ['rain']],
        ['Light drizzle', ['rain']], ['비 (약함)', ['rain']], ['오후부터 비', ['rain']], ['Heavy snow', ['snow']], ['함박눈', ['snow']], ['짙은 안개', ['fog']], ['Foggy', ['fog']],
        ['바람', ['breeze']], ['Windy', ['breeze']], ['맑고 바람 부는 날', ['sun', 'breeze']], ['Sunny', ['sun']], ['흐리고 쌀쌀함', []], ['Cloudy and cold', []], ['무지개', ['rainbow']], ['번개', ['rain']], ['장대비', ['rain']], ['황사', ['fog']], ['함박눈', ['snow']],
        ['Clear and warm, salty sea breeze', ['sun', 'breeze']], ['Shower', ['rain']], ['안개비', ['rain', 'fog']],
    ];
    for (const [text, want] of cases) {
        const got = modesOf(text);
        assert.equal(got.known, true, `${text} 는 아는 날씨`);
        assert.deepEqual(got.all, want, `${text} → ${want.join('+') || '끔'} (받은 값 ${got.all.join('+') || '끔'})`);
    }
});
await check('unknown text is not known (caller keeps the current effect)', () => {
    for (const text of ['🎃 이상한 하늘', '???', '', '   ', '🌈']) assert.equal(modesOf(text).known, false, text);
});
await check('time of day: clear night shows stars, evening is warm', () => {
    assert.deepEqual(modesOf('☀️ 맑음', '밤').all, ['star']);
    assert.deepEqual(modesOf('☀️ Clear', 'Night').all, ['star']);
    assert.deepEqual(modesOf('☀️ 맑음', '심야').all, ['star']);
    assert.deepEqual(modesOf('🌧 비', '밤').all, ['rain']);
    assert.deepEqual(modesOf('🌸 꽃바람', '밤').all, ['petal', 'breeze']);
    assert.equal(modesOf('☀️ 맑음', '저녁').warm, true);
    assert.equal(modesOf('☀️ 맑음', '낮').warm, false);
    assert.equal(modesOf('☀️ 맑음', '아침').all[0], 'sun');
});

// ── ② 읽기 조건 ──────────────────────────────────────
await check('read only when installed, enabled, chat on and calendar on', () => {
    const c = () => ctx();
    assert.deepEqual(M.readMeatballWeather(c()), { text: '🌧 비', time: '낮' });
    mb.legacy = true; assert.deepEqual(M.readMeatballWeather(c()), { text: '🌧 비', time: '낮' }, '옛 실리 매크로 {{ss_weather}}'); mb.legacy = false;
    mb.installed = false; assert.equal(M.readMeatballWeather(c()), null, '확장 없음'); mb.installed = true;
    mb.enabled = false; assert.equal(M.readMeatballWeather(c()), null, '확장 꺼짐'); mb.enabled = true;
    mb.meta = null; assert.equal(M.readMeatballWeather(c()), null, '이 채팅에 상태창 없음'); mb.meta = { mods: {} };
    mb.meta.off = true; assert.equal(M.readMeatballWeather(c()), null, '이 채팅에서 끔'); delete mb.meta.off;
    mb.meta.mods.calendar = false; assert.equal(M.readMeatballWeather(c()), null, '달력 꺼짐'); delete mb.meta.mods.calendar;
    const w = mb.weather; mb.weather = ''; assert.equal(M.readMeatballWeather(c()), null, '날씨 빈칸'); mb.weather = w;
    assert.equal(M.readMeatballWeather({}), null);
    assert.equal(M.readMeatballWeather(null), null);
});

// ── ③ ~ ⑤ weather.js 에서 ────────────────────────────
const state = () => W.weatherState();
const mode = () => state().current?.mode;
const follow = (extra = {}) => W.syncWeather(true, { weather: 'tracker', ...extra });
await check('meatball weather wins over the status line in the last reply', () => {
    follow();
    assert.equal(mode(), 'rain', '미트볼 🌧 비 (마지막 답 상태 줄은 맑음)');
    assert.equal(state().source, 'meatball');
    assert.equal(state().meatball, '🌧 비');
});
await check('follows AI update, user change in its window, sent command, separate analysis, chat change', () => {
    mb.weather = '☀️ 맑음';
    emit('CHARACTER_MESSAGE_RENDERED'); run();
    assert.equal(mode(), 'sun', 'AI 갱신 · 하루 지나기(답 뒤)');
    mb.weather = '❄️ 눈';
    const press = docListeners.get('click') || [];
    assert.equal(press.length, 1, '누름 듣기 하나');
    press[0]({ target: { closest: s => (s.includes('.ss-scope') ? {} : null) } }); run();
    assert.equal(mode(), 'snow', '그 확장 달력에서 바꿈');
    mb.weather = '🌧 Rain';
    press[0]({ target: { closest: () => null } }); run();
    assert.equal(mode(), 'snow', '다른 곳을 누르면 다시 읽지 않아요');
    // 보내기 칸에서 Enter(/ss-set 같은 명령) 뒤에 다시 봐요 · 줄바꿈(Shift+Enter) · 한글 조합 중 · 다른 칸은 아니에요
    const key = docListeners.get('keydown')?.[0];
    assert.ok(key, '보내기 듣기 하나');
    key({ key: 'Enter', shiftKey: true, target: { id: 'send_textarea' } }); run();
    assert.equal(mode(), 'snow');
    key({ key: 'Enter', target: { id: 'other' } }); run();
    assert.equal(mode(), 'snow');
    key({ key: 'Enter', target: { id: 'send_textarea' } }); run();
    assert.equal(mode(), 'rain', '/ss-set 보낸 뒤');
    // 별도 분석(답 뒤 AI 한 번 더)이면 답 뒤 세 번 더 봐요(4 · 12 · 30초) · 아니면 한 번만
    timers.length = 0; emit('CHARACTER_MESSAGE_RENDERED');
    assert.equal(timers.length, 1, '보통은 답 뒤 한 번');
    run(); mb.sync = 'analyze'; timers.length = 0; emit('CHARACTER_MESSAGE_RENDERED');
    assert.equal(timers.length, 4, '별도 분석이면 답 뒤 세 번 더');
    mb.weather = '🌫 안개'; run();
    assert.equal(mode(), 'fog', '별도 분석이 날씨를 바꾼 뒤');
    delete mb.sync;
    mb.chatId = 'c2'; mb.weather = '⛈ 소나기';
    emit('CHAT_CHANGED'); run();
    assert.equal(mode(), 'rain', '채팅 바꾸기');
});
await check('reads only on events, never per frame', () => {
    const before = mb.calls;
    run(); run();
    assert.equal(mb.calls, before, '사건이 없으면 매크로를 부르지 않아요');
});
await check('unknown text keeps the current effect', () => {
    mb.weather = '🎃 이상한 하늘';
    emit('CHARACTER_MESSAGE_RENDERED'); run();
    assert.equal(mode(), 'rain', '모르는 글 → 지금 값(소나기 → 비) 유지');
    assert.equal(state().source, 'meatball');
    // 새 채팅에서 처음부터 모르는 글이면 예전 소스(마지막 답 상태 줄 · 맑음)
    mb.chatId = 'c3';
    emit('CHAT_CHANGED'); run();
    assert.equal(mode(), 'sun');
    assert.equal(state().source, 'tracker');
});
await check('no meatball / calendar off / follow off → old tracker behaviour', () => {
    mb.chatId = 'c4'; mb.weather = '❄️ 눈';
    emit('CHAT_CHANGED'); run();
    assert.equal(mode(), 'snow');
    mb.installed = false; emit('CHAT_CHANGED'); run();
    assert.equal(mode(), 'sun', '미트볼 없음 → 마지막 답 상태 줄'); assert.equal(state().source, 'tracker');
    mb.installed = true; mb.meta.mods.calendar = false; emit('CHAT_CHANGED'); run();
    assert.equal(mode(), 'sun', '달력 꺼짐 → 마지막 답 상태 줄');
    delete mb.meta.mods.calendar; emit('CHAT_CHANGED'); run();
    assert.equal(mode(), 'snow');
    follow({ weatherFollowMeatball: false });
    assert.equal(mode(), 'sun', '「날씨 따라가기: 미트볼 상태창」 끔');
    follow();
    assert.equal(mode(), 'snow');
});
await check('a weather the user fixed wins over meatball', () => {
    W.syncWeather(true, { weather: 'rain' });
    assert.equal(mode(), 'rain'); assert.equal(state().source, 'set');
    W.syncWeather(true, { weather: 'fog' });
    assert.equal(mode(), 'fog');
    const press = docListeners.get('click')[0];
    mb.weather = '☀️ 맑음';
    press({ target: { closest: () => ({}) } }); emit('CHARACTER_MESSAGE_RENDERED'); run();
    assert.equal(mode(), 'fog', '직접 고른 날씨는 미트볼이 바뀌어도 그대로');
    follow();
    assert.equal(mode(), 'sun');
});
await check('skip list still applies to meatball weather', () => {
    mb.weather = '🌸 꽃바람';
    follow({ weatherTrackerSkip: ['breeze'] });
    assert.equal(mode(), 'petal');
    assert.equal(state().current.second, null);
    follow({ weatherTrackerSkip: ['petal', 'breeze'] });
    assert.equal(mode(), 'off');
});
await check('deus compatibility off: meatball alone enables tracker, deus and status text are not read', () => {
    assert.equal(R.trackerWeatherOn({ deus: { on: false } }), true, '미트볼 상태창이 켜져 있으면 데우스 호환 없이 고를 수 있어요');
    mb.enabled = false; assert.equal(R.trackerWeatherOn({ deus: { on: false } }), false); assert.equal(R.trackerWeatherOn({ deus: { on: true } }), true); mb.enabled = true;
    mb.weather = '❄️ 눈'; mb.chatId = 'c9';
    follow({ weatherDeusRead: false });
    assert.equal(mode(), 'snow', '미트볼 날씨만 따라가요');
    mb.meta.mods.calendar = false; emit('CHAT_CHANGED'); run();
    assert.equal(mode(), 'off', '데우스 호환이 꺼져 있으면 마지막 답 상태 줄(맑음)을 읽지 않아요');
    delete mb.meta.mods.calendar;
    follow();
    assert.equal(mode(), 'snow');
});
await check('night time turns clear sky into stars', () => {
    mb.weather = '☀️ 맑음'; mb.time = '밤';
    follow();
    assert.equal(mode(), 'star');
    mb.time = '낮';
});
console.log(`weather-meatball: ${passed} passed`);
