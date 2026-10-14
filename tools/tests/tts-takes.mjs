// TTS 테마 6.4.4 테이크 되돌리기 (v1.4) — src/addons/tts/src/cache.js (retire · restoreTake · takeCount · takeLimits · prune · stats) · player.js (↻ · ⟲ · 막대 단추)
//   node tools/tests/tts-takes.mjs <테마 루트>
//   실리태번 모듈은 data: 스텁, IndexedDB 는 열쇠 범위까지 흉내 낸 메모리, Audio 는 받은 blob 을 기록(30ms 뒤 끝), 엔진은 가짜(길이가 다른 WAV). 네트워크 없음.
//   효과음(sfx-audio.js)도 스텁 — 겹침 효과음은 T.tailMs 뒤 끝나는 꼬리 (v1.2 꼬리 기다림 재현)
//   v1.3: 디코드를 T.decodeMs 만큼 늦출 수 있다 (미리 만들기가 캐시 적중을 데우는 동안 재현)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';

const NAV_PROBE = process.argv[3] === '--nav-probe';
const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const data = text => `data:text/javascript,${encodeURIComponent(text)}`;
const T = globalThis.__ttsTakesTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina' }, plays: [], requests: [], warnings: [], urls: new Map(), seq: 0, saved: [] };
const G = 'const T = globalThis.__ttsTakesTest;\n';
const stubs = {
    'script.js': data(G + `export const chat = T.ctx.chat; export const event_types = {}; export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = t => String(t ?? ''); export function getRequestHeaders() { return {}; } export function saveSettingsDebounced() {} export async function saveSettings() {}
export function syncMesToSwipe() {} export const main_api = 'openai'; export function generateRaw() { throw Error('Unexpected LLM generation'); }`),
    'extensions.js': data(G + 'export const extension_settings = T.ext; export const extensionNames = []; export const getContext = () => T.ctx; export function saveMetadataDebounced() {}'),
    'popup.js': data('export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 }; export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null }; export async function callGenericPopup() { throw Error(\'Unexpected popup\'); } export function fixToastrForDialogs() {}'),
    'utils.js': data('export function getStringHash(s) { let h = 0; for (const c of String(s ?? \'\')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; } export const splitRecursive = t => [String(t ?? \'\')];'),
    'secrets.js': data('export const secret_state = {};'),
};
register(data(`let D; export function initialize(d) { D = d; } export async function resolve(spec, ctx, next) {
if (String(ctx.parentURL || '').includes('/addons/tts/')) { const base = spec.split('/').pop(); if (spec.split('../').length > 3 && D[base]) return { url: D[base], shortCircuit: true }; }
return next(spec, ctx); }`), { data: stubs });
const SFX_STUB = data(G + `export function createSfxController() {
    const live = new Set();
    return {
        play(id, opts) { T.sfxPlays = (T.sfxPlays || 0) + 1; let stop; const done = new Promise(r => { const t = setTimeout(r, T.tailMs ?? 800); stop = () => { clearTimeout(t); r(); }; }); const h = { stop: () => stop(), done }; live.add(h); done.then(() => live.delete(h)); return Promise.resolve(h); },
        stopAll() { T.sfxStopAll = (T.sfxStopAll || 0) + 1; for (const h of [...live]) h.stop(); },
        stopBefore() {}, stopLoops() {}, stopDisabled() {}, pause() {}, resume() {}, setRate() {}, setVolume() {},
    };
}`);
register(data(`export async function resolve(spec, ctx, next) { if (spec === './sfx-audio.js' && String(ctx.parentURL || '').includes('/addons/tts/')) return { url: ${JSON.stringify(SFX_STUB)}, shortCircuit: true }; return next(spec, ctx); }`));
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

// ---------- IndexedDB 흉내 (keyPath 'key' · get/put/delete/count/openCursor(범위) · index('t') · IDBKeyRange.bound) — 요청은 건 차례대로
const rows = new Map();
globalThis.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper, includes: k => typeof k === 'string' && k >= lower && k <= upper }) };
const inRange = (k, q) => q === undefined || q === null ? true : (typeof q === 'object' && q.includes ? q.includes(k) : k === q);
function store() {
    const req = (fill) => { const r = {}; queueMicrotask(() => { fill(r); r.onsuccess?.(); }); return r; };
    const cursorOver = (list) => { const r = {}; let i = 0; const step = () => { r.result = i < list.length ? { value: list[i], continue() { i++; queueMicrotask(step); } } : null; r.onsuccess?.(); }; queueMicrotask(step); return r; };
    const sorted = q => [...rows.keys()].filter(k => inRange(k, q)).sort().map(k => rows.get(k));
    return {
        get: k => req(r => { r.result = rows.get(k); }), put: rec => { rows.set(rec.key, rec); }, delete: k => { rows.delete(k); }, clear: () => rows.clear(),
        count: q => req(r => { r.result = [...rows.keys()].filter(k => inRange(k, q)).length; }),
        openCursor: q => cursorOver(sorted(q)), index: () => ({ openCursor: () => cursorOver([...rows.values()].sort((a, b) => a.t - b.t)) }),
        indexNames: { contains: () => true }, createIndex() {},
    };
}
globalThis.indexedDB = { open() {
    const request = {};
    setTimeout(() => {
        request.result = { objectStoreNames: { contains: () => true }, close() {}, transaction() { const tx = { objectStore: store, abort() { tx.onabort?.(); } }; setTimeout(() => tx.oncomplete?.(), 0); return tx; } };
        request.onsuccess?.();
    }, 0);
    return request;
} };

// ---------- 가짜 디코더 (16비트 PCM WAV) · DOM · Audio
function parseWav(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength < 44 || String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'RIFF') throw new Error('not wav');
    const ch = dv.getUint16(22, true), rate = dv.getUint32(24, true), n = Math.floor(dv.getUint32(40, true) / 2 / ch);
    const out = Array.from({ length: ch }, () => new Float32Array(n));
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = dv.getInt16(44 + (i * ch + c) * 2, true); out[c][i] = s < 0 ? s / 32768 : s / 32767; }
    return { sampleRate: rate, numberOfChannels: ch, length: n, duration: n / rate, getChannelData: c => out[c] };
}
globalThis.OfflineAudioContext = class { constructor() {} async decodeAudioData(buf) { const hook = T.decodeHooks?.shift(); if (hook) await hook(); if (T.decodeMs) await new Promise(r => setTimeout(r, T.decodeMs)); return parseWav(buf); } };
class Element extends EventTarget {
    constructor(tag = 'div') { super(); this.tagName = tag.toUpperCase(); this.dataset = {}; this.children = []; this.attributes = new Map(); this.style = { setProperty() {}, removeProperty() {} }; this._selectors = new Map(); this.hidden = false; this.innerHTML = ''; this.textContent = '';
        const cls = new Set(); this.classList = { add: (...x) => x.forEach(v => cls.add(v)), remove: (...x) => x.forEach(v => cls.delete(v)), contains: x => cls.has(x), toggle: (x, v) => { v ??= !cls.has(x); if (v) cls.add(x); else cls.delete(x); return v; } }; }
    setAttribute(k, v) { this.attributes.set(k, v); } removeAttribute(k) { this.attributes.delete(k); } getAttribute(k) { return this.attributes.get(k); } hasAttribute(k) { return this.attributes.has(k); }
    appendChild(n) { this.children.push(n); return n; } append(...n) { this.children.push(...n); } replaceChildren(...n) { this.children = n; } remove() {} focus() {} contains() { return false; } closest() { return null; }
    querySelector(s) { if (!this._selectors.has(s)) this._selectors.set(s, new Element()); return this._selectors.get(s); } querySelectorAll() { return []; } click() { this.dispatchEvent(new Event('click')); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 40, right: 800, bottom: 40 }; }
}
class MockAudio extends Element {
    constructor(src = '') { super('audio'); this.src = src; this.paused = true; this.volume = 1; this.playbackRate = 1; this.loop = false; this.timer = 0; this.currentTime = 0; }
    async play() {
        const blob = T.urls.get(this.src); if (!blob) throw Error('Missing test blob');
        this.paused = false; T.plays.push(blob); this.onplaying?.();
        clearTimeout(this.timer); this.timer = setTimeout(() => { if (!this.paused) { this.paused = true; T.ended = (T.ended || 0) + 1; this.onended?.(); this.dispatchEvent(new Event('ended')); } }, T.playMs ?? 30);
    }
    pause() { this.paused = true; clearTimeout(this.timer); }
    removeAttribute(k) { super.removeAttribute(k); if (k === 'src') this.src = ''; }
    load() {}
}
globalThis.Audio = MockAudio; globalThis.window = globalThis; globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
globalThis.CustomEvent ||= class extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
const body = new Element('body');
globalThis.document = { body, createElement: t => t === 'audio' ? new MockAudio() : new Element(t), querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, dispatchEvent() {}, addEventListener() {}, removeEventListener() {}, activeElement: null };
globalThis.innerWidth = 1100; globalThis.innerHeight = 900;
globalThis.toastr = Object.fromEntries(['info', 'warning', 'error', 'success'].map(kind => [kind, msg => T.warnings.push({ kind, msg })]));
const local = new Map(); globalThis.localStorage = { getItem: k => local.get(k) ?? null, setItem: (k, v) => local.set(k, String(v)), removeItem: k => local.delete(k) };
URL.createObjectURL = blob => { const url = `blob:takes-test/${++T.seq}`; T.urls.set(url, blob); return url; };
URL.revokeObjectURL = url => T.urls.delete(url);
globalThis.fetch = async (url) => { throw Error('Blocked fetch: ' + url); };

const mod = file => import(pathToFileURL(path.join(root, file)).href);
const Lo = await mod('loudness.js'), S = await mod('settings.js'), C = await mod('cache.js');
const P = await mod('player.js'), V = await mod('voices.js'), Registry = await mod('providers/index.js');
let pass = 0, fail = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function test(name, fn) {
    if (NAV_PROBE && !name.startsWith('v1.4 nav child')) return;
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
    finally { P.stop(); await sleep(5); }
}
async function until(fn, ms = 2000) { const at = Date.now(); while (!(await fn())) { if (Date.now() - at > ms) throw Error('Timed out; warnings=' + JSON.stringify(T.warnings)); await sleep(5); } }
const RATE = 8000;
const wav = (seconds) => new Blob([Lo.encodeWav(new Float32Array(Math.round(seconds * RATE)).fill(0.25), RATE)], { type: 'audio/wav' });
const blobOf = key => rows.get(key)?.blob ?? null;
const takeRows = () => [...rows.values()].filter(r => C.isTakeKey(r.key));
const evicted = () => JSON.parse(localStorage.getItem('lemon_voice_evicted') || '[]');
function cfg(extra = {}) { T.ext.lemon_voice = { ...extra }; return S.settings(); }

if (!NAV_PROBE) console.log('TTS 6.4.4 테이크 되돌리기');

// ---------- 1) 캐시 (cache.js)
await test('테이크 칸: 한도의 5% (개수 3~30) · 용량 한도 없으면 20 MB', () => {
    assert.deepEqual(C.takeLimits({ count: 1000, bytes: 200 * 1048576 }), { count: 30, bytes: Math.floor(10 * 1048576) });
    assert.deepEqual(C.takeLimits({ count: 100, bytes: 50 * 1048576 }), { count: 5, bytes: Math.floor(2.5 * 1048576) });
    assert.deepEqual(C.takeLimits({ count: 10, bytes: 10 * 1048576 }), { count: 3, bytes: Math.floor(0.5 * 1048576) });
    assert.deepEqual(C.takeLimits({ count: Infinity, bytes: Infinity }), { count: 30, bytes: 20 * 1048576 });
    cfg({ cache_limit: 1000, cache_mb: 200 }); assert.deepEqual(C.takeLimits(), { count: 30, bytes: 10 * 1048576 });
});
await test('retire: 줄 소리를 테이크로 옮기고 줄 열쇠는 비움 · 6.4.2 다시 사기 기록에 넣지 않음 · 테이크 열쇠는 거절', async () => {
    rows.clear(); local.clear(); cfg();
    const a = wav(1);
    assert.equal(await C.put('line1', a, { mime: 'audio/wav', lufs: -18 }), true);
    assert.equal(await C.takeCount('line1'), 0);
    assert.equal(await C.retire('line1'), true);
    assert.equal(await C.get('line1'), null, '줄 열쇠 비움 (다시 만들기가 새로 산다)');
    assert.equal(await C.takeCount('line1'), 1);
    const t = takeRows()[0];
    assert.equal(t.blob, a); assert.equal(t.line, 'line1'); assert.equal(t.lufs, -18); assert.ok(C.isTakeKey(t.key));
    assert.deepEqual(evicted(), [], '한도 정리가 아니라 다시 사기 안내와 무관');
    assert.equal(await C.retire('line1'), false, '줄 소리가 없으면 옮길 것 없음');
    assert.equal(await C.takeCount('line1'), 1);
    assert.equal(await C.retire(t.key), false); assert.equal(await C.restoreTake(t.key), false); assert.equal(await C.takeCount(t.key), 0);
    assert.equal(await C.restoreTake('none'), false, '테이크 없는 줄');
});
await test('restoreTake: 맞바꿈 · 셋이면 지금 → 바로 전 → 그 전 → 지금 으로 돈다 · 개수 그대로', async () => {
    rows.clear(); cfg();
    const a1 = wav(1), a2 = wav(0.8), a3 = wav(0.6);
    await C.put('L', a1); await C.retire('L'); await C.put('L', a2); await C.retire('L'); await C.put('L', a3);
    assert.equal(await C.takeCount('L'), 2);
    const seen = [blobOf('L')];
    for (let i = 0; i < 3; i++) { assert.equal(await C.restoreTake('L'), true); seen.push(blobOf('L')); assert.equal(await C.takeCount('L'), 2); }
    assert.deepEqual(seen, [a3, a2, a1, a3]);
    const got = await C.get('L'); assert.equal(got.blob, a3); assert.equal(got.mime, 'audio/wav');
});
await test('줄마다 지난 소리 2개까지 (가장 최근 것 남김)', async () => {
    rows.clear(); cfg();
    const b = [wav(0.2), wav(0.3), wav(0.4), wav(0.5), wav(0.6)];
    for (let i = 0; i < 4; i++) { await C.put('M', b[i]); await C.retire('M'); }
    await C.put('M', b[4]);
    assert.equal(await C.takeCount('M'), 2);
    assert.deepEqual(takeRows().map(r => r.blob).sort((x, y) => x.size - y.size), [b[2], b[3]], '오래된 b0 · b1 은 지움');
});
await test('테이크 칸 넘침: 개수 · 용량 한도 — 오래 보관한 것부터, 방금 것은 남김', async () => {
    rows.clear(); cfg({ cache_limit: 40, cache_mb: 200 });   // 칸 3개
    for (let i = 0; i < 5; i++) { await C.put('n' + i, wav(0.1)); await C.retire('n' + i); await sleep(2); }
    const left = takeRows().map(r => r.line).sort();
    assert.deepEqual(left, ['n2', 'n3', 'n4']);
    rows.clear(); cfg({ cache_limit: 1000, cache_mb: 1 });   // 용량 칸 = 1 MB 의 5% ≈ 52 KB
    for (let i = 0; i < 4; i++) { await C.put('m' + i, wav(2)); await C.retire('m' + i); await sleep(2); }   // 2초 ≈ 32 KB
    assert.deepEqual(takeRows().map(r => r.line), ['m3'], '하나만 들어감 (방금 것)');
    rows.clear(); cfg({ cache_limit: 1000, cache_mb: 1 });
    await C.put('big', wav(5)); assert.equal(await C.retire('big'), true);
    assert.equal(takeRows().length, 1, '칸보다 큰 하나는 방금 것이라 남김');
});
await test('한도 정리는 보통 줄만: 테이크 때문에 줄이 지워지지 않고 · 다시 사기 기록은 보통 줄만 · stats 는 따로', async () => {
    rows.clear(); local.clear(); cfg({ cache_limit: 10, cache_mb: 200 });
    for (let i = 0; i < 3; i++) { await C.put('t' + i, wav(0.1)); await C.retire('t' + i); }
    for (let i = 0; i < 10; i++) { await C.put('k' + i, wav(0.1)); await sleep(2); }
    await C.prune();
    assert.equal([...rows.keys()].filter(k => !C.isTakeKey(k)).length, 10, '보통 줄 10개 그대로 (테이크 3개가 있어도)');
    assert.equal(takeRows().length, 3);
    const st = await C.stats();
    assert.equal(st.count, 10); assert.equal(st.takes.count, 3); assert.ok(st.takes.bytes > 0 && st.bytes > 0);
    await C.put('k10', wav(0.1)); await C.prune();
    assert.equal(rows.has('k0'), false, '11번째 → 가장 오래된 보통 줄만');
    assert.equal(takeRows().length, 3, '테이크는 그대로');
    assert.deepEqual(evicted(), ['k0']);
});
await test('비우기는 테이크도 지움', async () => {
    rows.clear(); cfg();
    await C.put('z', wav(0.1)); await C.retire('z'); await C.put('z', wav(0.2));
    assert.equal(await C.clear(), true);
    assert.equal(rows.size, 0); assert.equal(await C.takeCount('z'), 0);
});
await test('캐시 열쇠 규칙 그대로 (엔진 · 목소리 · 섞기 · 파라미터 · 언어 · 감정 · 글)', () => {
    const k = C.cacheKey({ provider: 'elevenlabs', uid: 'elevenlabs:v', mix: [], params: { b: 1, a: 2 }, lang: 'ko', emotion: 'sad', text: '안녕' });
    assert.equal(k, C.hash(['elevenlabs', 'elevenlabs:v', '', '{"a":2,"b":1}', 'ko', 'sad', '안녕'].join('\u0001')));
    assert.ok(/^[0-9a-z]+$/.test(k) && !C.isTakeKey(k));
});

// ---------- 2) 재생기 (player.js) — 가짜 엔진은 요청마다 길이가 다른 WAV
const voice = (id, name) => ({ uid: 'minimax:' + id, provider: 'minimax', voiceId: id, name, aliases: [], params: {}, mix: [], lang: '' });
const LENS = [1.0, 0.6, 0.4, 0.3];
Registry.PROVIDERS.minimax.synth = async ({ text }) => { const n = T.requests.push(text); if (T.delayMs) await sleep(T.delayMs); if (T.failNext) { T.failNext = false; throw Object.assign(new Error('mock 400'), { status: 400 }); } return { blob: wav(LENS[(n - 1) % LENS.length]), usage: { chars: text.length } }; };
P.init();
async function reset() {
    P.stop(); await sleep(10); P.forgetClips(); P.forgetFrom(0); rows.clear(); local.clear(); T.plays.length = T.requests.length = T.warnings.length = 0; T.playMs = 30; T.delayMs = 0; T.ended = 0;
    T.ext.lemon_voice = {};
    const s = S.settings();
    Object.assign(s, { enabled: true, mini_player: true, voices: [voice('mina', 'Mina')], char_map: { Mina: 'minimax:mina' }, default_voice: 'minimax:mina', narrator_voice: '', user_voice: '', prefer_provider: '', normalize: false, dethump: false, auto_play: false, pregen: 'off',
        providers: { minimax: { key: 'mock-key', model: 'speech-2.8-hd' } }, sfx: { enabled: false, auto: false, volume: .5, mode: 'overlay', custom: [] }, analysis: { ...s.analysis, enabled: false } });
    T.ctx.chat.length = 0; T.ctx.chat.push({ mes: '"Hello there."', name: 'Mina', is_user: false, is_system: false, swipe_id: 0, extra: {} }); T.ctx.name2 = 'Mina'; body.dataset.generating = 'false';
}
const row = (id, text, gapMs = 0) => ({ id, kind: 'voice', text, speaker: 'Mina', voiceUid: 'minimax:mina', emotion: '', sourceIndex: null, volume: 1, gapMs, enabled: true });
const durOf = async blob => parseWav(await blob.arrayBuffer()).duration;
const lineKey = () => [...rows.keys()].find(k => !C.isTakeKey(k));
const bar = () => body.children.find(e => e.className === 'lv-bar' || e.classList?.contains('lv-bar'));
const takesBtn = () => bar()?.querySelector('.lv-bar-takes');
async function playOnce(opts = {}) { const before = T.plays.length; await P.speakScript(0, [row('a', 'Hello there.')], opts); await until(() => T.plays.length > before); await until(() => !P.isPlaying()); return T.plays.at(-1); }

await test('↻ (대본 다시 만들기): 지난 소리는 테이크로 · 새 소리를 산다 (요청 1번 더)', async () => {
    await reset();
    const a = await playOnce();
    assert.equal(await durOf(a), 1); assert.equal(T.requests.length, 1);
    const key = lineKey();
    const b = await playOnce({ regenerate: true });
    assert.equal(T.requests.length, 2); assert.equal(await durOf(b), 0.6);
    assert.equal(await C.takeCount(key), 1);
    assert.equal(await durOf(takeRows()[0].blob), 1, '테이크 = 첫 소리');
    assert.equal(await durOf(blobOf(key)), 0.6, '줄 열쇠 = 새 소리');
});
await test('⟲ 이전 소리: 재생 중 줄을 테이크와 맞바꾸고 다시 읽음 (요청 없음) · 다시 듣기도 그 소리', async () => {
    await reset();
    await playOnce(); await playOnce({ regenerate: true });   // 테이크 1.0 · 줄 0.6
    const key = lineKey(), n = T.requests.length;
    T.playMs = 400;   // 재생 중에 누르게
    const before = T.plays.length;
    await P.speakScript(0, [row('a', 'Hello there.')]);
    await until(() => T.plays.length > before);
    assert.equal(await P.revertCurrent(), true);
    await until(() => T.plays.length > before + 1);
    assert.equal(await durOf(T.plays.at(-1)), 1, '되돌린 소리로 다시 읽음');
    T.playMs = 30; await until(() => !P.isPlaying(), 3000);
    assert.equal(T.requests.length, n, '되돌리기는 사지 않음');
    assert.equal(await durOf(blobOf(key)), 1, '줄 열쇠 = 고른 소리 (이어 듣기 · 내려받기도 이 열쇠를 읽음)');
    assert.equal(await durOf(takeRows()[0].blob), 0.6, '지금 소리는 테이크로');
    P.forgetClips();   // 메모리 사본 없이도 (새로 연 것처럼)
    assert.equal(await durOf(await playOnce()), 1, '다시 듣기 = 고른 소리');
    assert.equal(T.requests.length, n);
});
await test('⟲: 줄이 없거나 테이크가 없으면 아무것도 안 함 · 효과음 줄 · 꺼진 TTS', async () => {
    await reset();
    assert.equal(await P.revertCurrent(), false, '재생 중인 줄 없음');
    T.playMs = 400;
    const before = T.plays.length;
    await P.speakScript(0, [row('a', 'Hello there.')]);
    await until(() => T.plays.length > before);
    assert.equal(await P.revertCurrent(), false, '테이크 없음');
    assert.equal(T.requests.length, 1);
});
await test('막대 ⟲: 테이크가 있을 때만 보임 (소리가 준비된 뒤) · 없으면 숨김 · 툴팁 없음', async () => {
    await reset();
    T.playMs = 300;
    let before = T.plays.length;
    await P.speakScript(0, [row('a', 'Hello there.')]);
    await until(() => T.plays.length > before); await sleep(30);
    assert.equal(takesBtn().style.display, 'none', '테이크 없으면 숨김');
    T.playMs = 30; await until(() => !P.isPlaying(), 3000);
    await playOnce({ regenerate: true });
    T.playMs = 300; before = T.plays.length;
    await P.speakScript(0, [row('a', 'Hello there.')]);
    await until(() => T.plays.length > before);
    await until(() => takesBtn().style.display === '', 1000);
    T.playMs = 30; await until(() => !P.isPlaying(), 3000);
    const src = readFileSync(path.join(root, 'player.js'), 'utf8');
    assert.match(src, /btn\('lv-bar-takes', '이전 소리', 'fa-clock-rotate-left'\)/, '아이콘 단추 (aria-label 만)');
    assert.doesNotMatch(src.slice(src.indexOf('function buildBar'), src.indexOf('function buildBar') + 3000), /lv-bar-takes[^\n]*title=/, '툴팁(title) 없음');
    assert.match(src, /const WAIT_BLOCKED = \[[^\]]*'\.lv-bar-takes'/, '번역 · 분석을 기다리는 동안 막힘');
});
await test('막대 ↻ (regenerateCurrent): 재생 중 줄을 테이크로 옮기고 다시 삼', async () => {
    await reset();
    await playOnce();
    const key = lineKey();
    T.playMs = 400;
    const before = T.plays.length;
    await P.speakScript(0, [row('a', 'Hello there.')]);
    await until(() => T.plays.length > before);
    P.regenerateCurrent();
    await until(() => T.requests.length === 2);
    T.playMs = 30; await until(() => !P.isPlaying(), 3000);
    await until(async () => (await C.takeCount(key)) === 1);
    assert.equal(await durOf(takeRows()[0].blob), 1);
    await until(() => blobOf(key) != null);
    assert.equal(await durOf(blobOf(key)), 0.6);
});
await test('↻ 로 새로 사다가 실패하면 옮겨 둔 소리를 그 줄로 되돌림 → 다시 들어도 사지 않음 · 보관한 둘도 그대로', async () => {
    await reset();
    await playOnce(); await playOnce({ regenerate: true }); await playOnce({ regenerate: true });   // 1.0 → 0.6 → 0.4 (테이크 1.0 · 0.6)
    const key = lineKey();
    assert.equal(await C.takeCount(key), 2);
    T.failNext = true;
    await P.speakScript(0, [row('a', 'Hello there.')], { regenerate: true });
    await until(() => T.requests.length === 4);
    await until(() => !P.isPlaying(), 3000);
    await until(async () => blobOf(key) != null, 2000);
    assert.equal(await durOf(blobOf(key)), 0.4, '줄 = ↻ 전 소리 그대로');
    assert.deepEqual((await Promise.all(takeRows().map(r => durOf(r.blob)))).sort(), [0.6, 1], '보관한 둘을 잃지 않음');
    const n = T.requests.length;
    assert.equal(await durOf(await playOnce()), 0.4, '다시 듣기 = 그 소리');
    assert.equal(T.requests.length, n, '다시 사지 않음');
    assert.ok(T.warnings.length >= 1, '실패는 알림 (6.4.4 와 같음)');
});
await test('retire 는 줄마다 줄이지 않고(↻ 실패 대비) 새 소리가 들어올 때 put 이 최근 2개로', async () => {
    rows.clear(); cfg();
    await C.put('R', wav(0.1)); await C.retire('R'); await C.put('R', wav(0.2)); await C.retire('R'); await C.put('R', wav(0.3));
    assert.equal(await C.takeCount('R'), 2);
    assert.equal(await C.retire('R'), true);
    assert.equal(await C.takeCount('R'), 3, '받는 중엔 셋 (실패하면 되돌림)');
    assert.equal(await C.restoreTake('R'), true);
    assert.equal(await durOf(blobOf('R')), 0.3); assert.equal(await C.takeCount('R'), 2, '되돌리면 둘');
    assert.equal(await C.retire('R'), true); await C.put('R', wav(0.4));
    assert.equal(await C.takeCount('R'), 2, '새 소리가 들어오면 둘');
    assert.deepEqual((await Promise.all(takeRows().map(r => durOf(r.blob)))).sort(), [0.2, 0.3]);
});
await test('내려받기(이 문장): 되돌린 뒤 재생 중 줄을 저장하면 고른 테이크의 소리 (요청 없음)', async () => {
    await reset();
    await playOnce(); await playOnce({ regenerate: true });   // 테이크 1.0 · 줄 0.6
    const key = lineKey();
    assert.equal(await C.restoreTake(key), true); P.forgetClips();   // 줄 = 1.0
    const n = T.requests.length, saved = [];
    const prev = URL.createObjectURL;
    URL.createObjectURL = blob => { saved.push(blob); return prev(blob); };
    try {
        T.playMs = 400;
        const before = T.plays.length;
        await P.speakScript(0, [row('a', 'Hello there.')]);
        await until(() => T.plays.length > before);
        saved.length = 0;
        assert.equal(await P.downloadCurrent(), true);
    } finally { URL.createObjectURL = prev; T.playMs = 30; }
    assert.equal(T.requests.length, n, '사지 않음');
    assert.equal(saved.length, 1);
    assert.equal(await durOf(saved[0]), 1, '저장한 소리 = 고른 테이크');
});

// ---------- v1.1 (BL 독립 검증 결함마다 재현)
await test('v1.1 줄 사이 쉼에 ⟲: 다음 줄로 넘어가지 않고 그 줄로 돌아가 고른 테이크를 읽은 뒤 다음 줄', async () => {
    await reset();
    await playOnce(); await playOnce({ regenerate: true });   // 줄 a: 테이크 1.0 · 지금 0.6
    const two = [row('a', 'Hello there.', 400), row('b', 'Bye now.')];
    T.plays.length = 0; T.ended = 0;
    await P.speakScript(0, two);
    await until(() => T.ended >= 1);   // a 가 끝나고 쉼 400ms
    await sleep(60);
    assert.equal(await P.revertCurrent(), true);
    await until(() => !P.isPlaying(), 4000);
    const seq = await Promise.all(T.plays.map(durOf));
    assert.deepEqual(seq, [0.6, 1, 0.4], `재생 차례 ${JSON.stringify(seq)} (v1: [0.6, 0.4] — 고른 소리를 건너뜀)`);
    assert.equal(T.requests.length, 3, '되돌리기는 사지 않음 (b 만 삼)');
});
await test('v1.1 줄 사이 쉼에 ↻: 그 줄을 다시 사서 읽은 뒤 다음 줄 (옮기기만 하고 넘어가지 않음)', async () => {
    await reset();
    const two = [row('a', 'Hello there.', 400), row('b', 'Bye now.')];
    await P.speakScript(0, two);
    await until(() => T.ended >= 1);
    await sleep(60);
    P.regenerateCurrent();
    await until(() => T.requests.filter(t => t === 'Hello there.').length >= 2, 4000);
    await until(() => !P.isPlaying(), 4000);
    const seq = await Promise.all(T.plays.map(durOf));
    assert.equal(T.requests.filter(t => t === 'Hello there.').length, 2, 'a 를 다시 삼');
    assert.equal(seq.length, 3, `a · 새 a · b 셋 — ${JSON.stringify(seq)} (v1: a 를 옮기기만 하고 b 로)`);
});
await test('v1.1 같은 줄을 다시 읽는 동안 ⟲ 를 숨기지 않고 흐리게 (키보드 포커스 유지) · 끝나면 다시 눌림', async () => {
    await reset();
    await playOnce(); await playOnce({ regenerate: true });
    T.playMs = 400;
    const before = T.plays.length;
    await P.speakScript(0, [row('a', 'Hello there.')]);
    await until(() => T.plays.length > before);
    await until(() => takesBtn().style.display === '', 1000);
    const st = takesBtn().style; let disp = st.display; const writes = [];
    Object.defineProperty(st, 'display', { get: () => disp, set: v => { writes.push(v); disp = v; }, configurable: true });
    const attrs = [];
    const el = takesBtn(), set = el.setAttribute.bind(el);
    el.setAttribute = (k, v) => { attrs.push(k + '=' + v); set(k, v); };
    try {
        assert.equal(await P.revertCurrent(), true);
        await until(() => T.plays.length > before + 1);
        await sleep(40);
        assert.ok(!writes.includes('none'), `숨기지 않음 — display 쓴 값 ${JSON.stringify(writes)} (v1: none 이 들어감)`);
        assert.ok(attrs.includes('aria-disabled=true'), '읽는 동안 aria-disabled');
        assert.equal(el.getAttribute('aria-disabled'), undefined, '준비되면 풀림');
        assert.equal(await P.revertCurrent(), true, '두 번째도 눌림');
    } finally {
        T.playMs = 30; await until(() => !P.isPlaying(), 3000);
        delete st.display; st.display = disp; delete el.setAttribute;
    }
});
await test('v1.1 대본 「다시 생성」 직후 멈추면(옮기는 사이) 옮긴 소리를 그 줄로 되돌림 → 다시 사지 않음', async () => {
    await reset();
    await playOnce();   // 1.0
    const key = lineKey();
    const pr = P.speakScript(0, [row('a', 'Hello there.')], { rowId: 'a', regenerate: true });
    P.stop();   // 옮기기를 기다리는 사이 (창 닫기 · 정지)
    assert.equal(await pr, false);
    await until(async () => blobOf(key) != null, 2000);
    assert.equal(await durOf(blobOf(key)), 1, '줄 = 옛 소리');
    assert.equal(await C.takeCount(key), 0);
    const n = T.requests.length;
    assert.equal(await durOf(await playOnce()), 1);
    assert.equal(T.requests.length, n, '다시 사지 않음 (v1: +1)');
});
await test('v1.1 받는 중에 ↻ 를 또 누르면 무시 — 산 소리를 버리지 않음 (요청 1번만 더)', async () => {
    await reset();
    await playOnce();   // A 1.0
    const key = lineKey();
    T.playMs = 400; T.delayMs = 200;
    const before = T.plays.length;
    await P.speakScript(0, [row('a', 'Hello there.')]);
    await until(() => T.plays.length > before);
    P.regenerateCurrent();
    await sleep(60);
    P.regenerateCurrent();   // 받는 중
    await until(() => T.requests.length >= 2);
    await sleep(400);
    T.playMs = 30; await until(() => !P.isPlaying(), 4000);
    assert.equal(T.requests.length, 2, `요청 ${T.requests.length} (v1: 3 — 첫 구매를 버림)`);
    await until(async () => blobOf(key) != null, 2000);
    assert.equal(await durOf(blobOf(key)), 0.6);
    assert.equal(await C.takeCount(key), 1);
});
await test('v1.1 정리(prune)도 테이크 칸 한도를 지킴 (한도를 낮추면 오래 보관한 것부터)', async () => {
    rows.clear(); cfg({ cache_limit: 1000, cache_mb: 200 });
    for (let i = 0; i < 12; i++) { await C.put('p' + i, wav(0.1)); await C.retire('p' + i); await sleep(1); }
    assert.equal(takeRows().length, 12);
    cfg({ cache_limit: 40, cache_mb: 200 });   // 칸 3
    await C.prune();
    assert.deepEqual(takeRows().map(r => r.line).sort(), ['p10', 'p11', 'p9'], `남은 테이크 ${takeRows().length} (v1: 12)`);
});
await test('v1.1 캐시 비우기 → ⟲ 숨김 · 되돌릴 표시도 버림', async () => {
    await reset();
    await playOnce(); await playOnce({ regenerate: true });
    T.playMs = 400;
    const before = T.plays.length;
    await P.speakScript(0, [row('a', 'Hello there.')]);
    await until(() => T.plays.length > before);
    await until(() => takesBtn().style.display === '', 1000);
    assert.equal(await C.clear(), true);
    assert.equal(takesBtn().style.display, 'none', 'v1: 계속 보임');
    T.playMs = 30; await until(() => !P.isPlaying(), 3000);
});
await test('v1.1 ⟲ 뒤 ↻: 방금까지 듣던 소리를 남기고 가장 오래된 것을 지움 · 순환은 그대로', async () => {
    rows.clear(); cfg();
    const A = wav(0.11), B = wav(0.12), Cc = wav(0.13), D = wav(0.14);
    await C.put('Q', A); await C.retire('Q'); await C.put('Q', B); await C.retire('Q'); await C.put('Q', Cc);   // 줄 C · 테이크 B · A
    assert.equal(await C.restoreTake('Q'), true);   // 줄 B · 테이크 A · C(방금까지 듣던)
    assert.equal(await C.retire('Q'), true); await C.put('Q', D);   // ↻ → 새 D
    assert.deepEqual(takeRows().map(r => r.blob).sort((x, y) => x.size - y.size), [B, Cc], 'B · C 남김, 맨 처음 A 지움 (v1: A · B)');
    const order = [];
    for (let i = 0; i < 3; i++) { await C.restoreTake('Q'); order.push(blobOf('Q')); }
    assert.deepEqual(order, [B, Cc, D]);
});

// ---------- v1.2 (BL v1.1 재검증 결함마다 재현)
const SFX = (await mod('sfx-library.js')).listSfx()[0]?.id;
const sfxRow = (id) => ({ id, kind: 'sfx', text: '', sfxId: SFX, mode: 'overlay', volume: 1, gapMs: 0, enabled: true, repeats: 1, durationMs: 0 });
const takeDurs = async () => (await Promise.all(takeRows().map(r => durOf(r.blob)))).sort();
async function tailWait() {   // 효과음 · 대사 한 줄 → 대사가 끝나고 겹침 효과음 꼬리(1.5초)를 기다리는 중
    T.tailMs = 1500; T.plays.length = 0; T.ended = 0;
    await P.speakScript(0, [sfxRow('s'), row('a', 'Hello there.')]);
    await until(() => T.plays.length >= 1 && T.ended >= 1, 2000);
    await sleep(80);
    assert.ok(SFX && T.sfxPlays >= 1 && P.isPlaying(), '전제: 꼬리를 기다리는 중 (막대 · ⟲ 가 아직 보임)');
}
await test('v1.2 마지막 줄 뒤 효과음 꼬리를 기다리는 동안 ⟲: 그 줄을 고른 테이크로 다시 읽음 (막대가 닫히지 않음)', async () => {
    await reset();
    await playOnce(); await playOnce({ regenerate: true });   // 줄 0.6 · 테이크 1.0
    const key = lineKey(), n = T.requests.length;
    try {
        await tailWait();
        assert.equal(await P.revertCurrent(), true);
        await until(() => T.plays.length >= 2, 3000).catch(() => assert.fail('다시 읽지 않음 (v1.1: 소리만 바꾸고 꼬리가 끊긴 채 막대가 닫힘)'));
        await until(() => !P.isPlaying(), 4000);
    } finally { T.tailMs = 800; }
    assert.deepEqual(await Promise.all(T.plays.map(durOf)), [0.6, 1]);
    assert.equal(await durOf(blobOf(key)), 1);
    assert.equal(T.requests.length, n, '되돌리기는 사지 않음');
});
await test('v1.2 꼬리 기다림 중 ↻: 그 줄을 다시 사서 읽음 (옮기기만 하고 닫히지 않음)', async () => {
    await reset();
    await playOnce();   // 1.0
    const key = lineKey(), n = T.requests.length;
    try {
        await tailWait();
        P.regenerateCurrent();
        await until(() => T.requests.length === n + 1, 3000).catch(() => assert.fail('다시 사지 않음 (v1.1: 옮기고 닫힘 — 다음에 들을 때 삼)'));
        await until(() => T.plays.length >= 2, 3000);
        await until(() => !P.isPlaying(), 4000);
    } finally { T.tailMs = 800; }
    assert.deepEqual(await Promise.all(T.plays.map(durOf)), [1, 0.6]);
    await until(() => blobOf(key) != null, 2000);
    assert.equal(await durOf(blobOf(key)), 0.6);
    assert.deepEqual(await takeDurs(), [1]);
});
await test('v1.2 칸보다 큰 테이크도 다음 put 의 정리(prune)에서 남음 — ⟲ 로 맞바꾼 뒤에도', async () => {
    rows.clear(); cfg({ cache_limit: 1000, cache_mb: 10 });   // 칸 = 10 MB 의 5% = 512 KB
    const big = wav(36);   // ≈ 563 KB > 칸
    assert.ok(big.size > C.takeLimits().bytes, '전제: 칸보다 큼');
    await C.put('big', big); assert.equal(await C.retire('big'), true);
    await C.put('big', wav(0.1)); await C.prune();   // ↻ 로 산 새 소리가 들어옴 → 정리
    assert.equal(await C.takeCount('big'), 1, '큰 테이크가 남음 (v1.1: 0 — 다음 put 의 prune 이 지움)');
    assert.equal(await C.restoreTake('big'), true); assert.equal(blobOf('big'), big);
    assert.equal(await C.restoreTake('big'), true);   // 다시 ⟲ → 큰 것이 새 열쇠로 테이크에
    await C.put('other', wav(0.1)); await C.prune();
    assert.deepEqual(takeRows().map(r => r.blob), [big], '맞바꿔 테이크로 간 큰 것도 남음');
    await C.put('m2', wav(0.2)); await C.retire('m2'); await C.put('m2', wav(0.1)); await C.prune();
    assert.deepEqual(takeRows().map(r => r.line), ['m2'], '다른 줄의 새 테이크가 오면 칸 한도대로 (방금 것만 남김)');
});
await test('v1.2 대본 「다시 생성」을 받는 중에 또 누르면 산 소리를 버리지 않음 (요청 1번만 더)', async () => {
    await reset();
    await playOnce();   // A 1.0
    const key = lineKey();
    T.delayMs = 200;
    assert.equal(await P.speakScript(0, [row('a', 'Hello there.')], { regenerate: true }), true);
    await until(() => T.requests.length === 2);   // 보냄 (받는 중)
    assert.equal(await P.speakScript(0, [row('a', 'Hello there.')], { regenerate: true }), true);
    await until(() => T.plays.length >= 2, 3000);
    await until(() => !P.isPlaying(), 4000); await sleep(50);
    assert.equal(T.requests.length, 2, `요청 ${T.requests.length} (v1.1: 3 — 첫 구매를 버림)`);
    await until(() => blobOf(key) != null, 2000);
    assert.equal(await durOf(blobOf(key)), 0.6, '줄 = 산 소리');
    assert.deepEqual(await takeDurs(), [1], '테이크 = ↻ 전 소리');
});
await test('v1.2 보내기 전에(캐시 확인 · 줄 서는 중) 또 누르면 예전처럼 새로 삼 — 지난 소리를 잃지 않음', async () => {
    await reset();
    await playOnce();   // A 1.0
    const key = lineKey();
    assert.equal(await P.speakScript(0, [row('a', 'Hello there.')], { regenerate: true }), true);
    const sentBefore = T.requests.length;
    assert.equal(await P.speakScript(0, [row('a', 'Hello there.')], { regenerate: true }), true);
    await until(() => T.plays.length >= 2, 3000);
    await until(() => !P.isPlaying(), 4000); await sleep(50);
    assert.equal(sentBefore, 1, '전제: 둘째를 누를 때 첫 요청은 아직 안 보냄');
    assert.equal(T.requests.length, 2, '산 것은 하나');
    await until(() => blobOf(key) != null, 2000);
    assert.equal(await durOf(blobOf(key)), 0.6, '줄 = 새 소리');
    assert.deepEqual(await takeDurs(), [1], '테이크 = ↻ 전 소리 (잃지 않음)');
});

// ── v1.3 (BL v1.2 검증 낮음 2): 다른 메시지가 덧붙은 큐에서 앞 메시지 꼬리를 기다리는 동안 ⟲ · ↻ · 미리 만들기가 캐시 적중을 데우는 중 「다시 생성」
const addMsg1 = () => T.ctx.chat.push({ mes: '"Second line."', name: 'Mina', is_user: false, is_system: false, swipe_id: 0, extra: {} });
async function crossTailWait() {   // 메시지 0 의 효과음 · 대사 → 읽는 중에 메시지 1 을 덧붙임(차례로) → 메시지 0 대사가 끝나고 그 꼬리를 기다리는 중
    addMsg1(); Object.assign(S.settings(), { on_new: 'queue' });
    T.tailMs = 1500; T.playMs = 300; T.plays.length = 0; T.ended = 0;
    await P.speakScript(0, [sfxRow('s'), row('a', 'Hello there.')]);
    await until(() => T.plays.length >= 1, 2000);
    P.speakMessage(1);
    await until(() => T.ended >= 1, 3000); await sleep(80);
    assert.ok(SFX && P.isPlaying() && T.plays.length === 1, '전제: 메시지 0 꼬리를 기다리는 중 (메시지 1 줄은 아직)');
}
await test('v1.3 메시지가 덧붙은 큐에서 앞 메시지 꼬리를 기다리는 동안 ⟲: 그 줄을 고른 테이크로 다시 읽고 다음 메시지로', async () => {
    await reset();
    await playOnce(); await playOnce({ regenerate: true });   // 줄 0.6 · 테이크 1.0
    const key = lineKey(), n = T.requests.length;
    try {
        await crossTailWait();
        assert.equal(await P.revertCurrent(), true);
        await until(() => T.plays.length >= 3, 6000).catch(() => {});
        await until(() => !P.isPlaying(), 6000);
    } finally { T.tailMs = 800; T.playMs = 30; }
    assert.deepEqual(await Promise.all(T.plays.map(durOf)), [0.6, 1, 0.4], '(v1.2: [0.6, 0.4] — 테이크만 바꾸고 다시 읽지 않음)');
    assert.equal(await durOf(blobOf(key)), 1);
    assert.equal(T.requests.length, n + 1, '되돌리기는 사지 않음 (메시지 1 줄 몫만)');
});
await test('v1.3 앞 메시지 꼬리를 기다리는 동안 ↻: 그 줄을 다시 사서 읽고 다음 메시지로 (다음 듣기에 또 사지 않음)', async () => {
    await reset();
    await playOnce();   // 1.0
    const key = lineKey(), n = T.requests.length;
    try {
        await crossTailWait();
        P.regenerateCurrent();
        await until(() => T.plays.length >= 3, 6000).catch(() => {});
        await until(() => !P.isPlaying(), 6000);
    } finally { T.tailMs = 800; T.playMs = 30; }
    assert.deepEqual(await Promise.all(T.plays.map(durOf)), [1, 0.6, 0.4], '(v1.2: [1, 0.6] — 옮기기만 하고 넘어감, 다음 듣기에 삼)');
    assert.equal(T.requests.length, n + 2, '↻ 몫 + 메시지 1 몫');
    await until(() => blobOf(key) != null, 2000);
    assert.equal(await durOf(blobOf(key)), 0.6);
    assert.deepEqual(await takeDurs(), [1]);
    const b = T.requests.length; await playOnce();
    assert.equal(T.requests.length, b, '다음 듣기는 캐시에서');
});
await test('v1.3 미리 만들기가 캐시 적중을 데우는 중에 대본 「다시 생성」: 예전처럼 테이크로 옮기고 새로 삼 (조용히 무시하지 않음)', async () => {
    await reset(); Object.assign(S.settings(), { dethump: true });
    await playOnce(); const key = lineKey();   // 1.0 캐시
    P.forgetClips();                           // 데운 사본 없음 (새로 연 페이지처럼)
    const [job] = P._forTest.sceneJobs(0, [row('a', 'Hello there.')], { manual: true });
    assert.equal(job.key, key, '전제: 같은 줄 열쇠');
    T.decodeMs = 400;
    try {
        const warm = P.ensureClip(job, { signal: new AbortController().signal, prepare: true }).catch(e => ({ err: e?.name }));
        await sleep(40);   // 캐시 적중 → 데우는 디코드 중
        const n0 = T.requests.length; T.plays.length = 0;
        assert.equal(await P.speakScript(0, [row('a', 'Hello there.')], { rowId: 'a', regenerate: true }), true);
        await until(() => T.plays.length >= 1, 4000).catch(() => {});
        await until(() => !P.isPlaying(), 5000); await sleep(60); await warm;
        assert.equal(T.requests.length - n0, 1, '새로 삼 (v1.2: 0 — 데운 옛 소리를 그대로 재생)');
        assert.equal(await durOf(T.plays.at(-1)), 0.6, '들린 소리 = 새 소리');
        await until(() => blobOf(key) != null, 2000);
        assert.equal(await durOf(blobOf(key)), 0.6, '줄 = 새 소리');
        assert.deepEqual(await takeDurs(), [1], '테이크 = 다시 생성 전 소리');
    } finally { T.decodeMs = 0; }
});

// ---------- v1.4: 메시지 경계를 넘는 nav를 한 번만 소비한다.
// v1.3의 무한 루프는 JS 이벤트 루프까지 멈춘다. 별도 자식 실행에 실제 timeout을 두어 CI도 끝나게 한다.
async function navProbe(mode) {
    if (mode === 'next-tail' || mode === 'prev-tail') {
        await reset(); await crossTailWait();
        bar().querySelector(mode === 'next-tail' ? '.lv-bar-next' : '.lv-bar-prev').click();
        await until(() => T.plays.length >= (mode === 'next-tail' ? 2 : 3), 6000);
        await until(() => !P.isPlaying(), 6000);
        assert.deepEqual(await Promise.all(T.plays.map(durOf)), mode === 'next-tail' ? [1, 0.6] : [1, 1, 0.6]);
        assert.equal(T.requests.length, 2, '이미 받은 줄은 다시 사지 않음');
        return;
    }
    await reset(); addMsg1(); Object.assign(S.settings(), { on_new: 'queue', gap_ms: 0 });
    T.playMs = 200;
    P.speakMessage(0);
    await until(() => T.plays.length === 1);
    P.speakMessage(1);
    if (mode === 'next-playing') {
        bar().querySelector('.lv-bar-next').click();
        await until(() => T.plays.length === 2);
        assert.equal(P.currentMesId(), 1);
    } else if (mode === 'prev-playing') {
        await until(() => T.plays.length === 2);
        assert.equal(P.currentMesId(), 1);
        bar().querySelector('.lv-bar-prev').click();
        await until(() => T.plays.length === 3);
        assert.equal(P.currentMesId(), 0);
        await until(() => T.plays.length === 4);
    } else throw Error('Unknown nav probe: ' + mode);
    await until(() => !P.isPlaying());
    assert.deepEqual(await Promise.all(T.plays.map(durOf)), mode === 'next-playing' ? [1, 0.6] : [1, 0.6, 1, 0.6]);
    assert.equal(T.requests.length, 2);
}
if (NAV_PROBE) {
    await test('v1.4 nav child ' + process.argv[4], () => navProbe(process.argv[4]));
    process.exit(fail ? 1 : 0);
}
for (const [mode, label] of [
    ['next-tail', '메시지 사이 효과음 꼬리를 기다리며 다음을 누르면 다음 메시지로'],
    ['prev-tail', '효과음 꼬리를 기다리며 이전을 누르면 같은 메시지 앞줄로'],
    ['next-playing', '재생 중 다음을 누르면 다른 메시지로 넘어가며 멈추지 않음'],
    ['prev-playing', '재생 중 이전을 누르면 앞 메시지로 돌아가며 멈추지 않음'],
]) await test('v1.4 ' + label, () => {
    const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), path.resolve(process.argv[2] || '.'), '--nav-probe', mode], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    assert.equal(r.error, undefined, `${mode}: ${r.error?.message || ''}\n${r.stdout || ''}\n${r.stderr || ''}`);
    assert.equal(r.status, 0, `${mode}: ${r.stdout || ''}\n${r.stderr || ''}`);
});

function gate() {
    let open, entered = false;
    const wait = new Promise(r => open = r);
    return { hook: () => { entered = true; return wait; }, open: () => open(), entered: () => entered };
}
async function warmOld() {
    await reset(); Object.assign(S.settings(), { dethump: true });
    await playOnce(); const key = lineKey();
    P.forgetClips();
    const [job] = P._forTest.sceneJobs(0, [row('a', 'Hello there.')], { manual: true });
    const old = gate(); T.decodeHooks = [old.hook];
    const warm = P.ensureClip(job, { signal: new AbortController().signal, prepare: true });
    await until(old.entered);
    return { key, old, warm };
}
for (const oldFirst of [false, true]) await test('v1.4 옛 소리 데우기가 끝나도 다시 듣기는 새 소리 (옛 소리 먼저 완료 = ' + oldFirst, async () => {
    const {key, old, warm} = await warmOld();
    const fresh = gate(); T.decodeHooks = [fresh.hook];
    try {
        await P.speakScript(0, [row('a', 'Hello there.')], { rowId:'a', regenerate:true });
        await until(fresh.entered);
        assert.equal(T.requests.length, 2);
        if (oldFirst) { old.open(); await warm; fresh.open(); }
        else { fresh.open(); await until(() => T.plays.length === 2); await until(() => !P.isPlaying()); old.open(); await warm; }
        await until(() => T.plays.length === 2); await until(() => !P.isPlaying());
        assert.equal(await durOf(T.plays.at(-1)), 0.6);
        assert.equal(await durOf(blobOf(key)), 0.6);
        const replay = await playOnce();
        assert.equal(await durOf(replay), 0.6, 'memory replay uses new audio');
        assert.equal(T.requests.length, 2);
        assert.deepEqual(await Promise.all(takeRows().map(r => durOf(r.blob))), [1]);
        P.forgetClips();
        assert.equal(await durOf(await playOnce()), 0.6, 'persistent cache replay uses new audio');
        assert.equal(T.requests.length, 2);
    } finally { old.open(); fresh.open(); T.decodeHooks = []; await warm; }
});
await test('v1.4 다시 생성 실패 뒤 옛 소리 데우기가 끝나도 캐시 복구 유지', async () => {
    const {key, old, warm} = await warmOld();
    try {
        T.failNext = true;
        await P.speakScript(0, [row('a','Hello there.')], {rowId:'a', regenerate:true});
        await until(() => T.requests.length === 2); await until(() => !P.isPlaying());
        old.open(); await warm;
        await until(() => blobOf(key));
        assert.equal(await durOf(blobOf(key)), 1);
        assert.equal(await durOf(await playOnce()), 1);
        assert.equal(T.requests.length, 2);
    } finally { old.open(); T.decodeHooks = []; await warm; }
});
await test('v1.4 옛 소리 데우기가 늦게 끝나도 그동안 고른 테이크 유지', async () => {
    const {key, old, warm} = await warmOld();
    try {
        T.playMs=1500;
        await P.speakScript(0, [row('a','Hello there.')], {rowId:'a', regenerate:true});
        await until(() => T.plays.length === 2);
        await until(() => !P.isInflight(key));
        assert.equal(await P.revertCurrent(), true);
        await until(() => T.plays.length === 3);
        old.open(); await warm; T.playMs=30;
        P.stop();
        assert.equal(await durOf(await playOnce()), 1);
        assert.equal(T.requests.length, 2);
        assert.equal(await durOf(blobOf(key)), 1);
    } finally { old.open(); T.decodeHooks = []; await warm; T.playMs=30; }
});

console.log(`\ntts-takes: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
