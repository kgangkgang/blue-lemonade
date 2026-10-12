// TTS 1.7.1 (테마 6.1.8) 다른 확장용 API — window.LemonVoice.voiceOf · synth · voices (src/addons/tts/src/player.js voiceOfName · synthForExternal · voiceListPublic)
//   다른 확장이 자기 화면에서 TTS 목소리로 소리만 받는다: 재생 · 막대 없음, 캐시 · 발음 사전 · 엔진 설정 그대로, 실패는 Error.code.
//   node tools/tests/tts-bridge.mjs <테마 루트>
// 실리태번 모듈은 data: 스텁, 엔진 synth 는 가짜 (부른 글을 기록). 네트워크 없음.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsBridgeTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina' } };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__ttsBridgeTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}
export const main_api = 'openai';
export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return T.ctx; }
export function saveMetadataDebounced() {}`),
    'popup.js': js(`export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 };
export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup() { return null; }`),
    'utils.js': js(`export function getStringHash(s) { let h = 0; for (const c of String(s ?? '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
export function splitRecursive(t) { return [String(t ?? '')]; }`),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.includes('/addons/tts/')) {
        const base = spec.split('/').pop();
        if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST } });

const mod = (name) => import(pathToFileURL(path.join(root, name)).href);
const S = await mod('settings.js');
const P = await mod('player.js');
const PR = await mod('providers/index.js');
const { settings } = S;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

const calls = [];
for (const id of ['minimax', 'elevenlabs']) {
    PR.PROVIDERS[id].synth = async ({ text, voice }) => { calls.push({ id, text: String(text), voice: voice?.voiceId }); return { blob: new Blob([new Uint8Array([73, 68, 51, 4, 0, 0, 0, 0, 0, 0, calls.length])], { type: 'audio/mpeg' }), usage: { chars: String(text).length } }; };
}
const gv = (provider, voiceId, name, extra = {}) => ({ uid: `${provider}:${voiceId}`, provider, voiceId, name, lang: '', group: 'g', aliases: [], params: {}, mix: [], ...extra });
function reset() {
    const s = settings();
    s.enabled = true;
    s.voices = [gv('minimax', 'mm_a', 'Mina', { group: '천지' }), gv('elevenlabs', 'el_a', 'Ella')];
    s.char_map = { Mina: 'minimax:mm_a', Ella: 'elevenlabs:el_a' };
    s.default_voice = ''; s.user_voice = ''; s.narrator_voice = ''; s.prefer_provider = ''; s.extras = 'off';
    s.pron_dict = 'Mina=미나'; s.mute_words = ''; s.normalize = false;
    s.providers = { minimax: { key: 'mm-test-key-000000000000000000000000000000000000', host: 'https://api.minimax.io', model: 'speech-2.8-hd' }, elevenlabs: { key: 'el-test', model: 'eleven_v4' } };
    calls.length = 0;
}

await test('voiceOf: the speaker\'s voice by the same rules as chat reading; unknown → null', () => {
    reset();
    assert.deepEqual(P.voiceOfName({ name: 'Mina' }), { uid: 'minimax:mm_a', name: 'Mina', provider: 'minimax', lang: '' });
    assert.equal(P.voiceOfName({ name: 'Nobody' }), null);
    settings().default_voice = 'elevenlabs:el_a';
    assert.equal(P.voiceOfName({ name: 'Nobody' })?.uid, 'elevenlabs:el_a', 'the default voice, as in chat reading');
});
await test('voices: the usable voice list for pickers', () => {
    reset();
    const list = P.voiceListPublic();
    assert.deepEqual(list.map(v => v.uid).sort(), ['elevenlabs:el_a', 'minimax:mm_a']);
    assert.equal(list.find(v => v.uid === 'minimax:mm_a').group, '천지');
});
await test('synth: sound only (ArrayBuffer), pronunciation dictionary applied, nothing played, the second call is served from the cache', async () => {
    reset();
    const r = await P.synthForExternal({ text: 'Hi, Mina.', name: 'Mina' });
    assert.ok(r.audio instanceof ArrayBuffer && r.audio.byteLength > 0);
    assert.equal(r.type, 'audio/mpeg');
    assert.deepEqual(r.voice, { uid: 'minimax:mm_a', name: 'Mina', provider: 'minimax' });
    assert.deepEqual(calls.map(c => c.text), ['Hi, 미나.']);
    assert.equal(P.isPlaying(), false, 'no bar, no playback');
    await P.synthForExternal({ text: 'Hi, Mina.', name: 'Mina' });
    assert.equal(calls.length, 1, 'cache hit');
});
await test('synth: audio tags stay only for engines that take them (ElevenLabs v3+), otherwise removed', async () => {
    reset();
    await P.synthForExternal({ text: '[whispers] Come closer.', name: 'Mina' });
    assert.equal(calls.at(-1).text, 'Come closer.', 'MiniMax: tag removed');
    await P.synthForExternal({ text: '[whispers] Come closer.', name: 'Ella' });
    assert.equal(calls.at(-1).id, 'elevenlabs');
    assert.match(calls.at(-1).text, /\[whispers\] Come closer\./, 'ElevenLabs v4: kept');
});
await test('synth errors carry a code: no-voice · disabled · aborted · engine', async () => {
    reset();
    await assert.rejects(P.synthForExternal({ text: 'Hello.', name: 'Nobody' }), (e) => e.code === 'no-voice');
    const ac = new AbortController(); ac.abort();
    await assert.rejects(P.synthForExternal({ text: 'Hello.', name: 'Mina', signal: ac.signal }), (e) => e.code === 'aborted');
    PR.PROVIDERS.minimax.synth = async () => { throw Object.assign(new Error('인증 실패'), { status: 401, fatal: true }); };
    await assert.rejects(P.synthForExternal({ text: 'A fresh line.', name: 'Mina' }), (e) => e.code === 'engine');
    settings().enabled = false;
    await assert.rejects(P.synthForExternal({ text: 'Hello.', name: 'Mina' }), (e) => e.code === 'disabled');
    settings().enabled = true;
});

console.log(`\ntts-bridge: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
