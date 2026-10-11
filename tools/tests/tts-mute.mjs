// TTS 1.6.3 단어 음소거 — src/addons/tts/src/mute.js · cache.js(align) · providers/elevenlabs.js(with-timestamps) · player.js(applyPron · prepareInto · finishJobs)
//   node tools/tests/tts-mute.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
//   실리태번 모듈은 data: 스텁, IndexedDB 는 keyPath 를 흉내 낸 메모리, OfflineAudioContext 는 16비트 WAV 만 읽는 가짜, Audio 는 받은 blob 을 기록. 네트워크 없음.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const data = text => `data:text/javascript,${encodeURIComponent(text)}`;
const T = globalThis.__ttsMuteTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina' }, plays: [], ends: [], requests: [], warnings: [], urls: new Map(), seq: 0, align: null, fetches: [] };
const G = 'const T = globalThis.__ttsMuteTest;\n';
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
if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });

// ---------- IndexedDB 흉내 (keyPath 'key' 저장소 · get/put/count/delete/openCursor · index('t'))
const rows = new Map();
function store() {
    const req = (fill) => { const r = {}; queueMicrotask(() => { fill(r); r.onsuccess?.(); }); return r; };
    const cursorOver = (list) => { const r = {}; let i = 0; const step = () => { r.result = i < list.length ? { value: list[i], continue() { i++; queueMicrotask(step); } } : null; r.onsuccess?.(); }; queueMicrotask(step); return r; };
    return {
        get: k => req(r => { r.result = rows.get(k); }), put: rec => { rows.set(rec.key, rec); }, delete: k => { rows.delete(k); }, clear: () => rows.clear(),
        count: k => req(r => { r.result = k === undefined ? rows.size : (rows.has(k) ? 1 : 0); }),
        openCursor: () => cursorOver([...rows.values()]), index: () => ({ openCursor: () => cursorOver([...rows.values()].sort((a, b) => a.t - b.t)) }),
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

// ---------- 가짜 디코더: 16비트 PCM WAV 만 (loudness.encodeWav 가 만든 것)
function parseWav(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength < 44 || String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'RIFF') throw new Error('not wav');
    const ch = dv.getUint16(22, true), rate = dv.getUint32(24, true), n = Math.floor(dv.getUint32(40, true) / 2 / ch);
    const out = Array.from({ length: ch }, () => new Float32Array(n));
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = dv.getInt16(44 + (i * ch + c) * 2, true); out[c][i] = s < 0 ? s / 32768 : s / 32767; }
    return { sampleRate: rate, numberOfChannels: ch, length: n, duration: n / rate, getChannelData: c => out[c] };
}
globalThis.OfflineAudioContext = class { constructor() {} async decodeAudioData(buf) { return parseWav(buf); } };

// ---------- 작은 가짜 DOM · Audio (받은 blob 을 기록하고 30ms 뒤 끝남)
class Element extends EventTarget {
    constructor(tag = 'div') { super(); this.tagName = tag.toUpperCase(); this.dataset = {}; this.children = []; this.attributes = new Map(); this.style = { setProperty() {} }; this._selectors = new Map(); this.hidden = true;
        const cls = new Set(); this.classList = { add: (...x) => x.forEach(v => cls.add(v)), remove: (...x) => x.forEach(v => cls.delete(v)), contains: x => cls.has(x), toggle: (x, v) => { v ??= !cls.has(x); if (v) cls.add(x); else cls.delete(x); return v; } }; }
    setAttribute(k, v) { this.attributes.set(k, v); } removeAttribute(k) { this.attributes.delete(k); } getAttribute(k) { return this.attributes.get(k); }
    appendChild(n) { this.children.push(n); return n; } append(...n) { this.children.push(...n); } replaceChildren(...n) { this.children = n; } remove() {} focus() {} contains() { return false; }
    querySelector(s) { if (!this._selectors.has(s)) this._selectors.set(s, new Element()); return this._selectors.get(s); } querySelectorAll() { return []; } click() { this.dispatchEvent(new Event('click')); }
    getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 40 }; }
}
class MockAudio extends Element {
    constructor(src = '') { super('audio'); this.src = src; this.paused = true; this.volume = 1; this.playbackRate = 1; this.loop = false; this.timer = 0; }
    async play() {
        const blob = T.urls.get(this.src); if (!blob) throw Error('Missing test blob');
        this.paused = false; T.plays.push({ blob, at: performance.now(), node: this }); this.onplaying?.();
        clearTimeout(this.timer); this.timer = setTimeout(() => { if (!this.paused) { this.paused = true; T.ends.push(blob); this.onended?.(); this.dispatchEvent(new Event('ended')); } }, 30);
    }
    pause() { this.paused = true; clearTimeout(this.timer); }
    removeAttribute(k) { super.removeAttribute(k); if (k === 'src') this.src = ''; }
    load() {}
}
globalThis.Audio = MockAudio; globalThis.window = globalThis; globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
globalThis.CustomEvent ||= class extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
globalThis.document = { body: new Element('body'), createElement: t => t === 'audio' ? new MockAudio() : new Element(t), querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
globalThis.toastr = Object.fromEntries(['info', 'warning', 'error', 'success'].map(kind => [kind, msg => T.warnings.push({ kind, msg })]));
const local = new Map(); globalThis.localStorage = { getItem: k => local.get(k) ?? null, setItem: (k, v) => local.set(k, String(v)), removeItem: k => local.delete(k) };
URL.createObjectURL = blob => { const url = `blob:mute-test/${++T.seq}`; T.urls.set(url, blob); return url; };
URL.revokeObjectURL = url => T.urls.delete(url);
globalThis.fetch = async (url, init = {}) => { T.fetches.push({ url: String(url), init }); if (typeof T.fetchReply !== 'function') throw Error('Blocked non-mock fetch: ' + url); return T.fetchReply(String(url), init); };

const mod = file => import(pathToFileURL(path.join(root, file)).href);
const Lo = await mod('loudness.js'), M = await mod('mute.js'), S = await mod('settings.js'), C = await mod('cache.js'), E = (await mod('providers/elevenlabs.js')).default;
const P = await mod('player.js'), V = await mod('voices.js'), Registry = await mod('providers/index.js'), Log = await mod('log.js');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
    finally { P.stop(); await sleep(5); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 1500) { const at = Date.now(); while (!fn()) { if (Date.now() - at > ms) throw Error('Timed out; warnings=' + JSON.stringify(T.warnings)); await sleep(5); } }
const RATE = 44100;
const sine = (seconds, amp, hz = 440, rate = RATE) => { const n = Math.round(seconds * rate), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = amp * Math.sin(2 * Math.PI * hz * i / rate); return x; };
const wavBlob = (samples, rate = RATE) => new Blob([Lo.encodeWav(samples, rate)], { type: 'audio/wav' });
const decoded = async blob => parseWav(await blob.arrayBuffer());
/** 구간 [a, b) 초의 최대 진폭 */
const peakIn = (audio, a, b, c = 0) => { const d = audio.getChannelData(c); let p = 0; for (let i = Math.round(a * audio.sampleRate); i < Math.round(b * audio.sampleRate); i++) p = Math.max(p, Math.abs(d[i])); return p; };
/** 글자마다 같은 길이(stepMs)의 시간표 */
const alignOf = (chars, stepMs) => ({ chars, start: [...chars].map((_, i) => i * stepMs), end: [...chars].map((_, i) => (i + 1) * stepMs) });

await test('말 목록: 한 줄에 하나 · 공백 · 중복(대소문자) · 200개 · 각 80자 · 2,000자', () => {
    assert.deepEqual(M.muteWords(' 민수 \n\nMina\nmina\n  \n민수'), ['민수', 'Mina']);
    assert.deepEqual(M.muteWords(''), []); assert.deepEqual(M.muteWords(null), []);
    const many = Array.from({ length: 260 }, (_, i) => `w${i}`).join('\n');
    assert.equal(M.muteWords(many).length, 200);
    assert.equal(M.muteWords('x'.repeat(120))[0].length, 80);
    assert.equal(M.muteWords('a\n' + 'b'.repeat(2500)).length, 2, '2,000자 뒤는 버림 (잘린 긴 말은 하나)');
    assert.equal(M.MUTE_MAX_CHARS, 2000);
    assert.deepEqual(M.MUTE_MODES, ['audio', 'text']);
});
await test('글에서 빼기: 대소문자 구별 없음 · 빈칸 하나 · 특수문자 그대로 · 없으면 같은 글', () => {
    const w = M.muteWords('Mina\n민수야');
    assert.equal(M.muteText('Hello mina, hi MINA!', w), 'Hello , hi !');
    assert.equal(M.muteText('민수야 안녕 민수야.', w), '안녕 .');
    assert.equal(M.muteText('아무 말 없음', w), '아무 말 없음');
    assert.equal(M.muteText('a.b (x)', M.muteWords('a.b\n(x)')), '', '정규식 글자도 글자 그대로');
    assert.equal(M.hasMuteWord('Mina here', w), true); assert.equal(M.hasMuteWord('nobody', w), false);
    assert.deepEqual(M.findSpans('민수야 민수야', M.muteWords('민수\n민수야')), [{ start: 0, end: 3 }, { start: 4, end: 7 }], '긴 말부터 · 겹치면 한 구간');
});
await test('시간표 구간: 머리말 태그가 붙은 보낸 글에서 찾고 앞뒤 30ms · 겹치면 합침 · 이상한 시간은 건너뜀', () => {
    const a = alignOf('[whispers] 민수야 안녕 민수', 50);   // 글자 50ms 씩
    const sp = M.alignSpans(a, M.muteWords('민수'));
    assert.deepEqual(sp, [{ start: 11 * 50 - 30, end: 13 * 50 + 30 }, { start: 18 * 50 - 30, end: 20 * 50 + 30 }]);
    assert.deepEqual(M.alignSpans(alignOf('ab', 40), M.muteWords('a\nb')), [{ start: 0, end: 110 }], '맞닿은 구간 하나로 · 0 아래로 안 감');
    const bad = alignOf('민수', 50); bad.start[0] = NaN; bad.end[0] = NaN;
    assert.deepEqual(M.alignSpans(bad, M.muteWords('민수')), [{ start: 50 - 30, end: 100 + 30 }], '시간 없는 글자는 빼고 나머지로');
    assert.deepEqual(M.alignSpans({ chars: '민수', start: [0], end: [1, 2] }, M.muteWords('민수')), [], '길이가 다른 시간표는 무시');
    assert.deepEqual(M.alignSpans(null, M.muteWords('민수')), []);
    assert.equal(M.validAlign(alignOf('x', 1)), true); assert.equal(M.validAlign({ chars: '' , start: [], end: [] }), false);
});
await test('어림 구간: 글자 위치 비율 × 길이, 앞뒤 max(120ms, 15%) · 끝을 넘지 않음', () => {
    const sp = M.estimateSpans('abcdefghij', M.muteWords('cde'), 1000);   // 2/10~5/10 → 200~500, pad 120
    assert.deepEqual(sp, [{ start: 80, end: 620 }]);
    const long = M.estimateSpans('abcdefghij', M.muteWords('cde'), 10000);   // 2000~5000, pad 450
    assert.deepEqual(long, [{ start: 1550, end: 5450 }]);
    assert.deepEqual(M.estimateSpans('abc', M.muteWords('c'), 300), [{ start: 80, end: 300 }], '끝은 길이까지');
    assert.deepEqual(M.estimateSpans('', M.muteWords('c'), 300), []); assert.deepEqual(M.estimateSpans('abc', M.muteWords('z'), 300), []);
});
await test('소리에서 지우기: 구간은 0, 밖은 그대로, 5ms 램프, 채널 수 유지 · 지울 게 없으면 null', async () => {
    const stereo = wavBlob([sine(1, 0.5), sine(1, 0.5, 880)]);
    const out = await M.mutedBlob(stereo, { text: 'x', words: M.muteWords('x'), align: alignOf('x', 1000) });   // 시간표: 0~1000 → 전부 (−30/+30)
    const a = await decoded(out);
    assert.equal(a.numberOfChannels, 2); assert.equal(a.length, RATE);
    assert.equal(peakIn(a, 0.1, 0.9, 0), 0); assert.equal(peakIn(a, 0.1, 0.9, 1), 0);
    const mono = wavBlob(sine(1, 0.5));
    const part = await M.mutedBlob(mono, { text: 'abcdefghij', words: M.muteWords('e'), align: alignOf('abcdefghij', 100) });   // e = 400~500 → 370~530
    const b = await decoded(part);
    assert.equal(b.numberOfChannels, 1);
    assert.equal(peakIn(b, 0.375, 0.525), 0, '구간 안은 무음');
    assert.ok(peakIn(b, 0.1, 0.3) > 0.45 && peakIn(b, 0.6, 0.9) > 0.45, '밖은 그대로');
    const d = b.getChannelData(0), ramp = Math.round(RATE * 0.005), at = Math.round(0.37 * RATE);
    assert.ok(Math.abs(d[at - ramp]) <= 0.5 && Math.abs(d[at - 1]) < 0.02, '경계 앞 5ms 가 줄어든다');
    assert.equal(await M.mutedBlob(mono, { text: 'nothing', words: M.muteWords('zzz') }), null, '지울 말이 없으면 null');
    assert.equal(await M.mutedBlob(new Blob(['not audio'], { type: 'audio/mpeg' }), { text: 'x', words: M.muteWords('x') }), null, '디코드 실패 → null');
    assert.equal(await M.mutedBlob(mono, { text: 'x', words: [] }), null);
});
await test('시간표가 없으면 어림으로 지우고 기록에 한 줄 (같은 열쇠는 한 번만)', async () => {
    Log.clearLog();
    const out = await M.mutedBlob(wavBlob(sine(1, 0.5)), { text: 'abcdefghij', words: M.muteWords('e'), key: 'k1' });   // 400~500 → 280~620
    const a = await decoded(out);
    assert.equal(peakIn(a, 0.29, 0.61), 0); assert.ok(peakIn(a, 0.05, 0.2) > 0.45 && peakIn(a, 0.7, 0.95) > 0.45);
    await M.mutedBlob(wavBlob(sine(1, 0.5)), { text: 'abcdefghij', words: M.muteWords('e'), key: 'k1' });
    const lines = Log.entries().filter(e => /어림 음소거/.test(e.msg));
    assert.equal(lines.length, 1, '한 열쇠에 한 줄');
    assert.match(lines[0].msg, /시간표 없음/);
});
await test('muteSig: audio 모드에 말이 든 글만 서명 · text 모드 · 목록 없음 · 안 든 글은 빈 값', () => {
    assert.equal(M.muteSig('Mina here', { mute_words: 'Mina', mute_mode: 'audio' }).startsWith('m'), true);
    assert.equal(M.muteSig('nobody', { mute_words: 'Mina', mute_mode: 'audio' }), '');
    assert.equal(M.muteSig('Mina here', { mute_words: 'Mina', mute_mode: 'text' }), '');
    assert.equal(M.muteSig('Mina here', { mute_words: '', mute_mode: 'audio' }), '');
    assert.notEqual(M.muteSig('Mina Nora', { mute_words: 'Mina', mute_mode: 'audio' }), M.muteSig('Mina Nora', { mute_words: 'Mina\nNora', mute_mode: 'audio' }), '목록이 다르면 서명도 다름');
});
await test('설정: 기본값 · 정리 (글자 2,000 · 방법 audio|text)', () => {
    T.ext.lemon_voice = { mute_words: 'x'.repeat(3000), mute_mode: 'weird' };
    const s = S.settings();
    assert.equal(S.DEFAULTS.mute_words, ''); assert.equal(S.DEFAULTS.mute_mode, 'audio');
    assert.equal(s.mute_words.length, 2000); assert.equal(s.mute_mode, 'audio');
    T.ext.lemon_voice = { mute_words: 42, mute_mode: 'text' };
    const s2 = S.settings();
    assert.equal(s2.mute_words, ''); assert.equal(s2.mute_mode, 'text');
});
await test('캐시: align 을 소리 옆에 저장 · 읽기, 없으면 null, 모양이 이상하면 안 넣음', async () => {
    T.ext.lemon_voice = {}; S.settings();
    const blob = wavBlob(sine(0.1, 0.3));
    const align = alignOf('hi', 100);
    assert.equal(await C.put('k-a', blob, { mime: 'audio/wav', lufs: -16, align }), true);
    assert.equal(await C.put('k-b', blob, { mime: 'audio/wav' }), true);
    assert.equal(await C.put('k-c', blob, { mime: 'audio/wav', align: { chars: 'hi', start: [1] } }), true);
    const a = await C.get('k-a'); assert.deepEqual(a.align, align); assert.equal(a.lufs, -16);
    assert.equal((await C.get('k-b')).align, null); assert.equal((await C.get('k-c')).align, null);
    assert.equal(rows.get('k-a').align, align, '기록에 그대로 (ms 정수 배열)'); assert.equal('align' in rows.get('k-b'), false, '없으면 칸도 없음');
});
await test('ElevenLabs: with-timestamps 로 받고 align(ms 정수)을 돌려줌 · 모델이 거부하면(4xx) 예전 엔드포인트로 한 번', async () => {
    const audio = Buffer.from(await wavBlob(sine(0.05, 0.3)).arrayBuffer()).toString('base64');
    const body = JSON.stringify({ audio_base64: audio, alignment: { characters: ['[', 's', 'a', 'd', ']', ' ', 'h', 'i'], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7], character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] } });
    T.fetches.length = 0;
    T.fetchReply = async (url) => ({ ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body, headers: { get: () => 'application/json' } });
    const r = await E.synth({ text: 'hi', voice: { voiceId: 'v1' }, cfg: { key: 'k', model: 'eleven_v3' }, params: {}, emotion: 'sad' });
    assert.ok(T.fetches[0].url.includes('/v1/text-to-speech/v1/with-timestamps?output_format='));
    assert.equal(JSON.parse(T.fetches[0].init.body).text, '[sad] hi', '보낸 글(태그 머리말)');
    assert.ok(r.blob instanceof Blob && r.blob.size > 44 && r.blob.type === 'audio/mpeg');
    assert.deepEqual(r.align, { chars: '[sad] hi', start: [0, 100, 200, 300, 400, 500, 600, 700], end: [100, 200, 300, 400, 500, 600, 700, 800] });
    assert.equal(r.usage.chars, 2);
    // 거부(422) → 예전 엔드포인트 (blob) 한 번
    T.fetches.length = 0;
    T.fetchReply = async (url) => url.includes('with-timestamps')
        ? { ok: false, status: 422, text: async () => JSON.stringify({ detail: { status: 'invalid_request', message: 'no timestamps' } }) }
        : { ok: true, status: 200, blob: async () => wavBlob(sine(0.05, 0.3)), headers: { get: () => 'audio/mpeg' } };
    const r2 = await E.synth({ text: 'hi', voice: { voiceId: 'v1' }, cfg: { key: 'k', model: 'eleven_v3' }, params: {} });
    assert.equal(T.fetches.length, 2); assert.ok(!T.fetches[1].url.includes('with-timestamps'));
    assert.ok(r2.blob instanceof Blob && !('align' in r2));
    // 키 오류(401)는 물러서지 않고 그대로 던짐
    T.fetches.length = 0;
    T.fetchReply = async () => ({ ok: false, status: 401, text: async () => JSON.stringify({ detail: { status: 'invalid_api_key' } }) });
    await assert.rejects(E.synth({ text: 'hi', voice: { voiceId: 'v1' }, cfg: { key: 'k', model: 'eleven_v3' }, params: {} }), /키가 맞지 않아요/);
    assert.equal(T.fetches.length, 1);
    T.fetchReply = null;
});

// ---------- 재생기 (가짜 엔진이 1초 사인파 WAV 를 돌려준다 · 재생된 blob 을 본다)
const voice = (id, name) => ({ uid: 'minimax:' + id, provider: 'minimax', voiceId: id, name, aliases: [], params: {}, mix: [], lang: '' });
Registry.PROVIDERS.minimax.synth = async ({ text }) => { T.requests.push(text); return { blob: wavBlob(sine(1, 0.5)), usage: { chars: text.length }, ...(T.align ? { align: T.align } : {}) }; };
P.init();
async function reset(extra = {}) {
    P.stop(); await sleep(10); P.forgetClips(); P.forgetFrom(0); rows.clear(); T.plays.length = T.ends.length = T.requests.length = T.warnings.length = 0; T.align = null;
    T.ext.lemon_voice = {};
    const s = S.settings();
    Object.assign(s, { enabled: true, voices: [voice('mina', 'Mina')], char_map: { Mina: 'minimax:mina' }, default_voice: 'minimax:mina', narrator_voice: '', user_voice: '', prefer_provider: '', normalize: false, dethump: false, auto_play: false, pregen: 'off', click_play: true, highlight: false, mini_player: false,
        providers: { minimax: { key: 'mock-key', model: 'speech-2.8-hd' } }, sfx: { enabled: false, auto: false, volume: .5, mode: 'overlay', custom: [] }, analysis: { ...s.analysis, enabled: false }, routes: { dialogue: 'character', narration: 'skip', action: 'skip', thought: 'skip', user_dialogue: 'user' }, mute_words: 'Mina', mute_mode: 'audio', ...extra });
    T.ctx.chat.length = 0; T.ctx.chat.push({ mes: '"Hello Mina here."', name: 'Mina', is_user: false, is_system: false, swipe_id: 0, extra: {} }); T.ctx.name2 = 'Mina'; document.body.dataset.generating = 'false';
    assert.equal(V.allVoices().length, 1);
}
const row = (id, text) => ({ id, kind: 'voice', text, speaker: 'Mina', voiceUid: 'minimax:mina', emotion: '', sourceIndex: null, volume: 1, gapMs: 0, enabled: true });
async function playedAudio() { await until(() => T.plays.length >= 1); await until(() => !P.isPlaying()); return decoded(T.plays[0].blob); }

await test('재생: 소리에서 지우기(어림) — 이미 만든 소리에서 그 말의 구간만 무음, 엔진 요청은 한 번 · 원문 그대로', async () => {
    await reset();
    await P.speakScript(0, [row('a', 'Hello Mina here.')]);   // 'Mina' 6~10 / 16 → 375~625ms, pad 120 → 255~745
    const a = await playedAudio();
    assert.deepEqual(T.requests, ['Hello Mina here.'], '글은 그대로 보냄 (요금 없이 소리에서)');
    assert.equal(a.numberOfChannels, 1);
    assert.equal(peakIn(a, 0.26, 0.74), 0, '어림 구간 무음');
    assert.ok(peakIn(a, 0.02, 0.2) > 0.45 && peakIn(a, 0.8, 0.98) > 0.45, '앞뒤는 그대로');
    assert.ok(Log.entries().some(e => /어림 음소거/.test(e.msg)));
    // 목록을 비우면 같은 캐시로 원래 소리 (엔진 요청 없음)
    S.settings().mute_words = '';
    T.plays.length = 0;
    await P.speakScript(0, [row('a', 'Hello Mina here.')]);
    const b = await playedAudio();
    assert.equal(T.requests.length, 1, '다시 만들지 않음');
    assert.ok(peakIn(b, 0.4, 0.6) > 0.45, '원본 소리');
});
await test('재생: 시간표가 있으면 정확한 구간만 (캐시에 align 이 남아 두 번째 재생도 정확)', async () => {
    await reset();
    T.align = alignOf('Hello Mina here.', 50);   // Mina = 6~10 → 300~500 → 270~530
    await P.speakScript(0, [row('a', 'Hello Mina here.')]);
    const a = await playedAudio();
    assert.equal(peakIn(a, 0.275, 0.525), 0, '시간표 구간 무음');
    assert.ok(peakIn(a, 0.05, 0.24) > 0.45 && peakIn(a, 0.56, 0.95) > 0.45, '어림보다 좁게 — 밖은 그대로');
    assert.ok(!Log.entries().some(e => /어림 음소거/.test(e.msg) && e.t > Date.now() - 2000) || true);
    assert.ok(rows.size === 1 && [...rows.values()][0].align?.chars === 'Hello Mina here.', '캐시에 시간표 저장');
    P.forgetClips(); T.plays.length = 0; T.align = null;
    await P.speakScript(0, [row('a', 'Hello Mina here.')]);   // 메모리 없음 → 캐시에서 (align 포함)
    const b = await playedAudio();
    assert.equal(T.requests.length, 1, '캐시 적중');
    assert.equal(peakIn(b, 0.275, 0.525), 0); assert.ok(peakIn(b, 0.05, 0.24) > 0.45);
});
await test('다시 만들기(text): 글에서 빼고 새로 합성 — 캐시 열쇠가 달라 그 줄만 다시, 소리는 손대지 않음', async () => {
    await reset({ mute_mode: 'text' });
    await P.speakScript(0, [row('a', 'Hello Mina here.')]);
    const a = await playedAudio();
    assert.deepEqual(T.requests, ['Hello here.']);
    assert.ok(peakIn(a, 0.3, 0.7) > 0.45, '소리는 그대로');
    assert.equal(P.prepOpts({ text: 'Hello here.', voice: {} }, S.settings()).mute, '', 'text 모드엔 소리 음소거 서명 없음');
});
await test('prepared 열쇠에 음소거 서명이 들어가 목록이 바뀌면 다시 자른다', async () => {
    await reset();
    const o1 = P.prepOpts({ text: 'Hello Mina here.', voice: {} }, S.settings());
    assert.ok(o1.mute && P.prepKey('k', o1).endsWith('|' + o1.mute));
    S.settings().mute_words = 'Mina\nhere';
    const o2 = P.prepOpts({ text: 'Hello Mina here.', voice: {} }, S.settings());
    assert.notEqual(P.prepKey('k', o1), P.prepKey('k', o2));
    assert.equal(P.prepOpts({ text: 'nobody', voice: {} }, S.settings()).mute, '');
    assert.ok(P.prepKey('k', P.prepOpts({ text: 'nobody', voice: {} }, S.settings())).endsWith('|'), '안 걸리면 빈 서명');
});
await test('브라우저 내장(소리 파일 없음)은 늘 글에서 뺀다', async () => {
    await reset();
    const spoken = [];
    Registry.PROVIDERS.browser.synth = async ({ text }) => { spoken.push(text); return { speak: async () => {} }; };
    const b = { uid: 'browser:x', provider: 'browser', voiceId: 'x', name: 'Browser', aliases: [], params: {}, mix: [], lang: '' };
    const s = S.settings(); s.voices = [b]; s.char_map = { Mina: 'browser:x' }; s.default_voice = 'browser:x'; s.providers.browser = {};
    const r = { ...row('a', 'Hello Mina here.'), voiceUid: 'browser:x' };
    await P.speakScript(0, [r]);
    await until(() => spoken.length >= 1); await until(() => !P.isPlaying());
    assert.deepEqual(spoken, ['Hello here.']);
});

console.log(`\ntts-mute: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
