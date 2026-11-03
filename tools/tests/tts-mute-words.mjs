// TTS 단어 음소거 — 원문 · 한국어 번역 어느 쪽으로 적어도 같이 찾는다 (src/addons/tts/src/mute.js muteTerms · player.js 재생 길)
//   node tools/tests/tts-mute-words.mjs <테마 루트>
//   이름 짝은 번역 애드온의 이름 다리(translator/names-bridge.js buildNames)를 그대로 쓴다. 실리태번 모듈은 data: 스텁,
//   IndexedDB 는 메모리, OfflineAudioContext 는 16비트 WAV 만 읽는 가짜, 엔진은 1초 사인파 WAV 를 돌려주는 가짜 (네트워크 · 요금 없음)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';

const themeRoot = path.resolve(process.argv[2] || '.');
const root = path.join(themeRoot, 'src/addons/tts/src');
const data = text => `data:text/javascript,${encodeURIComponent(text)}`;
const T = globalThis.__ttsMuteWords = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Seraphina' }, plays: [], requests: [], warnings: [], urls: new Map(), seq: 0, align: null };
const G = 'const T = globalThis.__ttsMuteWords;\n';
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
function parseWav(buf) {
    const dv = new DataView(buf);
    if (buf.byteLength < 44 || String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'RIFF') throw new Error('not wav');
    const ch = dv.getUint16(22, true), rate = dv.getUint32(24, true), n = Math.floor(dv.getUint32(40, true) / 2 / ch);
    const out = Array.from({ length: ch }, () => new Float32Array(n));
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = dv.getInt16(44 + (i * ch + c) * 2, true); out[c][i] = s < 0 ? s / 32768 : s / 32767; }
    return { sampleRate: rate, numberOfChannels: ch, length: n, duration: n / rate, getChannelData: c => out[c] };
}
globalThis.OfflineAudioContext = class { constructor() {} async decodeAudioData(buf) { return parseWav(buf); } };
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
        this.paused = false; T.plays.push({ blob }); this.onplaying?.();
        clearTimeout(this.timer); this.timer = setTimeout(() => { if (!this.paused) { this.paused = true; this.onended?.(); this.dispatchEvent(new Event('ended')); } }, 30);
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
URL.createObjectURL = blob => { const url = `blob:mute-words/${++T.seq}`; T.urls.set(url, blob); return url; };
URL.revokeObjectURL = url => T.urls.delete(url);
globalThis.fetch = async (url) => { throw Error('Blocked non-mock fetch: ' + url); };

const mod = file => import(pathToFileURL(path.join(root, file)).href);
const Lo = await mod('loudness.js'), M = await mod('mute.js'), S = await mod('settings.js');
const P = await mod('player.js'), Registry = await mod('providers/index.js');
const NB = await import(pathToFileURL(path.join(themeRoot, 'src/addons/translator/names-bridge.js')).href);
const NAMES = Symbol.for('blue-lemonade.names');
/** 번역 용어집 항목 → 이름 다리 (번역 애드온이 채팅을 열 때 하는 것과 같은 함수) */
const bridge = (entries) => { globalThis[NAMES] = NB.buildNames(NB.namePairs(entries), { doc: () => null }); };
const GLOSSARY = [{ src: 'Seraphina, セラフィナ', dst: '세라피나', scope: 'global' }, { src: 'Old Rowan', dst: '올드 로완', scope: 'global' }, { src: 'Forest Keeper', dst: '숲지기', scope: 'global' }];
/** 고치기 전 mute.js 에는 muteTerms 가 없다 → 적은 목록 그대로 (예전 동작) */
const termsOf = s => (typeof M.muteTerms === 'function' ? M.muteTerms(s) : M.muteWords(s.mute_words));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
    finally { P.stop(); await sleep(5); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 1500) { const at = Date.now(); while (!fn()) { if (Date.now() - at > ms) throw Error('Timed out; warnings=' + JSON.stringify(T.warnings)); await sleep(5); } }
const RATE = 44100;
const sine = (seconds, amp, hz = 440) => { const n = Math.round(seconds * RATE), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = amp * Math.sin(2 * Math.PI * hz * i / RATE); return x; };
const wavBlob = samples => new Blob([Lo.encodeWav(samples, RATE)], { type: 'audio/wav' });
const peakIn = (audio, a, b) => { const d = audio.getChannelData(0); let p = 0; for (let i = Math.round(a * RATE); i < Math.round(b * RATE); i++) p = Math.max(p, Math.abs(d[i])); return p; };
const alignOf = (chars, stepMs) => ({ chars, start: [...chars].map((_, i) => i * stepMs), end: [...chars].map((_, i) => (i + 1) * stepMs) });
/** 설정 s 로 이 글에서 찾은 글자 구간 → 그 글자들 */
const hits = (text, s) => M.findSpans(text, termsOf(s)).map(sp => text.slice(sp.start, sp.end));
const conf = (mute_words, extra = {}) => ({ mute_words, mute_mode: 'audio', pron_dict: '', voices: [], ...extra });

await test('원문 글 + 한국어 목록: 「세라피나」로 적어도 영어 · 일본어 원문의 이름을 찾는다', () => {
    bridge(GLOSSARY);
    assert.deepEqual(hits('"Hello, Seraphina." She smiled.', conf('세라피나')), ['Seraphina']);
    assert.deepEqual(hits('セラフィナが笑った。', conf('세라피나')), ['セラフィナ']);
    assert.deepEqual(hits('Old Rowan waits.', conf('올드 로완')), ['Old Rowan'], '두 낱말 이름');
});
await test('쉼표로 한 줄에 여럿: 「드림주, ドリムジュ」 — 「드림주 씨」 를 찾고 소리 음소거 서명이 걸린다 (11-03 제보)', () => {
    bridge([]);
    const line = '「아까 창고 안에서의 일은, 저와 당신만의 비밀로 해 둘까요. ……그럼, 조만간 또 들르겠습니다, 드림주 씨. 오늘도 저를 위해 기도해 주던 때처럼, 건강하게 지내 주세요.」';
    assert.deepEqual(M.muteWords('드림주, ドリムジュ'), ['드림주', 'ドリムジュ'], '쉼표로 나눠 적어도 따로');
    assert.deepEqual(M.muteWords('드림주，ドリムジュ、세라'), ['드림주', 'ドリムジュ', '세라'], '전각 쉼표 · 일본어 쉼표');
    assert.deepEqual(hits(line, conf('드림주, ドリムジュ')), ['드림주']);
    assert.deepEqual(hits('ドリムジュさん、おはよう', conf('드림주, ドリムジュ')), ['ドリムジュ']);
    assert.ok(M.muteSig(line, conf('드림주, ドリムジュ')), '소리에서 지우기 서명');
    assert.equal(M.muteText(line, termsOf(conf('드림주, ドリムジュ'))).includes('드림주'), false, 'text 모드로도 빠진다');
});
await test('번역 글 + 원문 목록: 「Seraphina」로 적어도 한국어 번역문의 이름을 찾는다', () => {
    bridge(GLOSSARY);
    assert.deepEqual(hits('세라피나가 웃었다.', conf('Seraphina')), ['세라피나']);
    assert.deepEqual(hits('올드 로완은 기다린다.', conf('Old Rowan')), ['올드 로완']);
    assert.deepEqual(hits('세라피나가 웃었다.', conf('セラフィナ')), ['세라피나'], '일본어로 적어도');
});
await test('같은 언어(원문 글 + 원문 목록 · 번역 글 + 한국어 목록)는 예전처럼', () => {
    bridge(GLOSSARY);
    assert.deepEqual(hits('Hello Seraphina', conf('Seraphina')), ['Seraphina']);
    assert.deepEqual(hits('세라피나가 왔다', conf('세라피나')), ['세라피나']);
});
await test('조사: 낱말 부분만 (이/가/을/를/은/는/의/에게/한테/와/과/도/만)', () => {
    bridge(GLOSSARY);
    for (const p of ['이', '가', '을', '를', '은', '는', '의', '에게', '한테', '와', '과', '도', '만']) {
        const t = `세라피나${p} 왔다`;
        assert.deepEqual(M.findSpans(t, termsOf(conf('Seraphina'))), [{ start: 0, end: 4 }], p);
    }
});
await test('대소문자 · 전각/반각 · 앞뒤 문장부호 · 띄어쓰기 차이는 무시', () => {
    bridge(GLOSSARY);
    assert.deepEqual(hits('SERAPHINA and seraphina', conf('Seraphina')), ['SERAPHINA', 'seraphina']);
    assert.deepEqual(hits('Ｓｅｒａｐｈｉｎａ smiled', conf('Seraphina')), ['Ｓｅｒａｐｈｉｎａ'], '전각 라틴');
    assert.deepEqual(hits('ｾﾗﾌｨﾅが来た', conf('세라피나')), ['ｾﾗﾌｨﾅ'], '반각 가나');
    assert.deepEqual(hits('Seraphina smiled', conf('「Seraphina」,')), ['Seraphina'], '목록 쪽 앞뒤 문장부호');
    assert.deepEqual(hits('the old  rowan', conf('Old Rowan')), ['old  rowan'], '사이 빈칸 수');
});
await test('사전에 짝이 없는 낱말은 적힌 그대로만 (새 번역 호출 없음)', () => {
    bridge(GLOSSARY);
    assert.deepEqual(hits('Lumi waved. 루미가 웃었다.', conf('Lumi')), ['Lumi']);
    assert.deepEqual(hits('The Forest Keeper. 숲지기가 왔다.', conf('숲지기')), ['숲지기'], '이름꼴이 아닌 용어집 항목(12자 넘는 말 · 문장부호 · 숫자)은 이름 다리에 없어 적힌 그대로만');
    globalThis[NAMES] = undefined;
    assert.deepEqual(hits('Seraphina, 세라피나', conf('세라피나')), ['세라피나'], '다리가 없으면(번역 애드온 끔) 예전처럼');
});
await test('발음 사전 뒤 글에서도 찾는다 (Seraphina=세라핀 → 읽는 글은 「세라핀」)', () => {
    bridge(GLOSSARY);
    const pron = t => t.replace(/Seraphina/g, '세라핀');   // player.js applyPron 과 같은 일 (원래말=읽을말)
    const ph = (text, s) => M.findSpans(text, typeof M.muteTerms === 'function' ? M.muteTerms(s, pron) : M.muteWords(s.mute_words)).map(sp => text.slice(sp.start, sp.end));
    assert.deepEqual(ph('세라핀이 왔다', conf('Seraphina', { pron_dict: 'Seraphina=세라핀' })), ['세라핀']);
    assert.deepEqual(ph('세라핀이 왔다', conf('세라피나', { pron_dict: 'Seraphina=세라핀' })), ['세라핀'], '한국어 목록 → 원문 → 발음');
});
await test('목소리 별명으로 묶인 표기도 같이 (용어집이 없어도)', () => {
    globalThis[NAMES] = undefined;
    const s = conf('미나', { voices: [{ uid: 'minimax:mina', name: 'Mina', aliases: ['미나', 'ミナ'] }] });
    assert.deepEqual(hits('Mina, 미나, ミナ', s), ['Mina', '미나', 'ミナ']);
});
await test('서명: 원문 글에 한국어 목록이 걸리고, 이름 다리가 바뀌면 서명도 바뀐다', () => {
    bridge(GLOSSARY);
    assert.ok(M.muteSig('Seraphina here', conf('세라피나')).startsWith('m'), '원문 글에 한국어 목록이 걸린다');
    bridge([{ src: 'Seraphina', dst: '세라핀', scope: 'global' }]);
    assert.equal(M.muteSig('Seraphina here', conf('세라피나')), '', '짝이 없어지면 안 걸림');
});

// ---------- 재생 길 (가짜 엔진 · 재생된 blob 의 무음 구간을 본다)
Registry.PROVIDERS.minimax.synth = async ({ text }) => { T.requests.push(text); return { blob: wavBlob(sine(1, 0.5)), usage: { chars: text.length }, ...(T.align ? { align: T.align } : {}) }; };
P.init();
const voice = { uid: 'minimax:sera', provider: 'minimax', voiceId: 'sera', name: 'Seraphina', aliases: [], params: {}, mix: [], lang: '' };
async function reset(extra = {}) {
    P.stop(); await sleep(10); P.forgetClips(); P.forgetFrom(0); rows.clear(); T.plays.length = T.requests.length = T.warnings.length = 0; T.align = null;
    T.ext.lemon_voice = {};
    const s = S.settings();
    Object.assign(s, { enabled: true, voices: [voice], char_map: { Seraphina: 'minimax:sera' }, default_voice: 'minimax:sera', narrator_voice: 'minimax:sera', user_voice: '', prefer_provider: '', normalize: false, dethump: false, auto_play: false, pregen: 'off', click_play: true, highlight: false, mini_player: false,
        providers: { minimax: { key: 'mock-key', model: 'speech-2.8-hd' } }, sfx: { enabled: false, auto: false, volume: .5, mode: 'overlay', custom: [] }, analysis: { ...s.analysis, enabled: false }, routes: { dialogue: 'character', narration: 'narrator', action: 'skip', thought: 'skip', user_dialogue: 'user' }, mute_words: '세라피나', mute_mode: 'audio', pron_dict: '', ...extra });
    T.ctx.chat.length = 0; T.ctx.chat.push({ mes: '"Hello Seraphina here."', name: 'Seraphina', is_user: false, is_system: false, swipe_id: 0, extra: {} }); document.body.dataset.generating = 'false';
    bridge(GLOSSARY);
}
async function played() { await until(() => T.plays.length >= 1); await until(() => !P.isPlaying()); return parseWav(await T.plays[0].blob.arrayBuffer()); }
const row = (text) => ({ id: 'a', kind: 'voice', text, speaker: 'Seraphina', voiceUid: 'minimax:sera', emotion: '', sourceIndex: null, volume: 1, gapMs: 0, enabled: true });

await test('재생 · 대본(레몬 스튜디오): 원문 글 + 한국어 목록, 시간표 있음 → 그 구간만 무음', async () => {
    await reset();
    T.align = alignOf('Hello Seraphina here.', 40);   // Seraphina 6~15 → 240~600 → 210~630
    await P.speakScript(0, [row('Hello Seraphina here.')]);
    const a = await played();
    assert.deepEqual(T.requests, ['Hello Seraphina here.'], '글은 그대로 (요금 없이 소리에서)');
    assert.equal(peakIn(a, 0.215, 0.625), 0, '이름 구간 무음');
    assert.ok(peakIn(a, 0.02, 0.18) > 0.45 && peakIn(a, 0.66, 0.95) > 0.45, '밖은 그대로');
});
await test('재생 · 시험 듣기(speakText): 번역 글 + 원문 목록, 시간표 없음 → 어림으로 무음 · 뒤는 남김', async () => {
    await reset({ mute_words: 'Seraphina' });
    P.speakText('세라피나가 웃었다', 'minimax:sera');   // 세라피나 0~4 / 9 → 0~444ms, pad 120 → 0~564
    const a = await played();
    assert.equal(peakIn(a, 0, 0.56), 0, '이름 구간 무음');
    assert.ok(peakIn(a, 0.6, 0.98) > 0.45, '뒤는 그대로');
});
await test('재생 · 메시지 읽기(자동 재생 · 대사 누름이 쓰는 speakMessage): 원문 메시지 + 한국어 목록', async () => {
    await reset();
    T.ctx.chat.length = 0;
    T.ctx.chat.push({ mes: '"Hi Seraphina, come."', name: 'Seraphina', is_user: false, is_system: false, swipe_id: 0, extra: {} });
    T.align = alignOf('Hi Seraphina, come.', 40);   // 3~12 → 120~480 → 90~510
    P.speakMessage(0, { force: true });
    const a = await played();
    assert.ok(T.requests.length >= 1 && /Seraphina/.test(T.requests[0]), '원문을 읽음: ' + JSON.stringify(T.requests));
    assert.equal(peakIn(a, 0.095, 0.505), 0, '이름 구간 무음');
    assert.ok(peakIn(a, 0.55, 0.7) > 0.45, '밖은 그대로');
});
await test('재생 · 발음 사전을 건 글(Seraphina=세라핀): 원문 목록으로 읽는 글 「세라핀」을 지움', async () => {
    await reset({ mute_words: 'Seraphina', mute_mode: 'text', pron_dict: 'Seraphina=세라핀' });
    P.speakText('Seraphina smiled', 'minimax:sera');
    await played();
    assert.deepEqual(T.requests, ['smiled']);
});
await test('재생 · 다시 만들기(text 모드): 한국어 목록으로 원문 글에서 이름을 빼고 보냄', async () => {
    await reset({ mute_mode: 'text' });
    await P.speakScript(0, [row('Hello Seraphina here.')]);
    await played();
    assert.deepEqual(T.requests, ['Hello here.']);
});

console.log(`\ntts-mute-words: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
