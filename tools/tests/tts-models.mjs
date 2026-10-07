// TTS 1.3.7 엔진 모델 목록 — 늘 최신 (src/addons/tts/src/providers/_models.js · 엔진마다 listModels · ui.js ↻ · 카드가 보일 때 자동)
//   node tools/tests/tts-models.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈은 data: 스텁으로 (settings.js 가 extension_settings 를 읽는다). fetch 는 흉내 낸 응답만 (실제 네트워크 없음 · 돈 드는 요청 없음).
// 핵심: 예전 모델 id 의 요청 본문과 캐시 키(player.keyOf)는 1.3.6 과 바이트까지 같다 (GOLDEN = 바꾸기 전 코드로 만든 값),
//   고른 모델은 목록에 없어도 그대로 남고 그대로 보내며(바꿔치기 없음), 모든 엔진에 직접 입력, 새 모델(eleven_v5 · speech-3.0 …)은 최신 갈래처럼.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const mod = (name) => pathToFileURL(path.join(root, name)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;

// ---------- 공유 상태 · 스텁
const T = globalThis.__ttsModelsTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Char', characters: [], groups: [] } };
const G = 'const T = globalThis.__ttsModelsTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}`),
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
        if (spec.split('../').length - 1 >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST } });

// localStorage (Map) — 막힌 저장소도 흉내 낼 수 있게
const LS = new Map();
let lsBroken = false;
globalThis.localStorage = {
    getItem: (k) => { if (lsBroken) throw new Error('denied'); return LS.has(k) ? LS.get(k) : null; },
    setItem: (k, v) => { if (lsBroken) throw new Error('denied'); LS.set(k, String(v)); },
    removeItem: (k) => { LS.delete(k); },
};

// fetch: route(c) 가 응답을 만든다 (없으면 실패 — 모르는 요청은 시험 실패)
const calls = [];
let route = null;
globalThis.fetch = async (url, init = {}) => {
    const c = { url: String(url), method: init.method || 'GET', headers: { ...(init.headers || {}) }, body: init.body };
    calls.push(c);
    if (!route) throw new Error(`시험 중 네트워크 요청: ${c.url}`);
    return route(c);
};
const J = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const AUDIO = () => new Response(new Uint8Array([0xff, 0xf3, 1, 2]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
const WAV_B64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=';
const SYNTH = (c) => {
    if (c.url.includes('/t2a_v2')) return J({ data: { audio: 'fff3' }, base_resp: { status_code: 0 }, extra_info: { usage_characters: 3 } });
    if (c.url.includes(':generateContent')) return J({ candidates: [{ content: { parts: [{ inlineData: { data: WAV_B64, mimeType: 'audio/wav' } }] } }] });
    return AUDIO();
};
const header = (c, name) => { const k = Object.keys(c.headers).find(h => h.toLowerCase() === name.toLowerCase()); return k ? c.headers[k] : undefined; };

T.ext.lemon_voice = { version: 8, enabled: true, providers: {}, voices: [], usage: { month: '', chars: 0, requests: 0, models: {} }, ui: { tab: 'engine', provider_tab: 'minimax' } };

const S = await import(mod('settings.js'));
const M = await import(mod('providers/_models.js'));
const { koModelLabel: KO } = await import(mod('model-names.js'));   // 1.3.7 보이는 이름은 한국어 (값은 id 그대로)
const { getProvider, listProviders } = await import(mod('providers/index.js'));
const EL = await import(mod('providers/elevenlabs.js'));
const MM = await import(mod('providers/minimax.js'));
const GE = await import(mod('providers/gemini.js'));
const CA = await import(mod('providers/cartesia.js'));
const player = await import(mod('player.js'));
let ui = null;
try { ui = await import(mod('ui.js')); } catch (e) { ui = { __error: e }; }

let pass = 0, fail = 0;
async function test(name, fn) {
    try { M.clearModels(); LS.clear(); lsBroken = false; route = null; calls.length = 0; await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
const P = (id) => getProvider(id);
const setCfg = (id, cfg) => { T.ext.lemon_voice.providers[id] = JSON.parse(JSON.stringify(cfg)); return S.providerConfig(id, P(id).defaults); };
const opts = (id, cfg) => { const f = P(id).fields.find(x => x.key === 'model'); return typeof f.options === 'function' ? f.options(cfg) : f.options; };
const values = (list) => list.map(o => o.value);
async function synthBody(id, cfg, { voice = { uid: 'x:v1', voiceId: 'v1', mix: [], model: '' }, params = {}, emotion = '', lang = 'ja' } = {}) {
    const c = setCfg(id, cfg);
    calls.length = 0;
    route = SYNTH;
    await P(id).synth({ text: 'こんにちは。', voice, cfg: c, params: { ...P(id).defaults, ...params }, lang, emotion });
    route = null;
    const hit = calls.find(x => x.method === 'POST');
    return { url: hit.url, body: JSON.parse(hit.body) };
}

// 바꾸기 전 코드(1.3.6 + 오늘의 1.3.7 계정 맞춤)로 만든 요청 본문 · 캐시 키 — 예전 id 는 이것과 같아야 한다
const GOLDEN = [
    {"id": "minimax", "cfg": {"key": "k", "host": "https://api.minimax.io", "model": "speech-2.8-turbo", "model_from": "picked"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "happy", "url": "https://api.minimax.io/v1/t2a_v2", "body": "{\"model\":\"speech-2.8-turbo\",\"text\":\"こんにちは。\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"v1\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"happy\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Japanese\"}", "key": "17gvho86xxm"},
    {"id": "minimax", "cfg": {"key": "k", "host": "https://api.minimax.io", "model": "speech-2.8-hd", "model_from": "picked"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {"emotion_strength": "strong"}, "emotion": "angry", "url": "https://api.minimax.io/v1/t2a_v2", "body": "{\"model\":\"speech-2.8-hd\",\"text\":\"(breath)こんにちは。\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"v1\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"angry\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Japanese\"}", "key": "2emzdtkyu4h"},
    {"id": "minimax", "cfg": {"key": "k", "host": "https://api.minimax.io", "model": "speech-2.8-hd", "model_from": "picked"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "whisper", "url": "https://api.minimax.io/v1/t2a_v2", "body": "{\"model\":\"speech-2.6-hd\",\"text\":\"こんにちは。\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"v1\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"whisper\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Japanese\"}", "key": "20vjgkoqult"},
    {"id": "minimax", "cfg": {"key": "k", "host": "https://api.minimax.io", "model": "speech-2.6-turbo", "model_from": "picked"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "fluent", "url": "https://api.minimax.io/v1/t2a_v2", "body": "{\"model\":\"speech-2.6-turbo\",\"text\":\"こんにちは。\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"v1\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"fluent\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Japanese\"}", "key": "1w15go23u4b"},
    {"id": "minimax", "cfg": {"key": "k", "host": "https://api.minimax.io", "model": "speech-02-hd", "model_from": "picked"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {"emotion_strength": "strong"}, "emotion": "sad", "url": "https://api.minimax.io/v1/t2a_v2", "body": "{\"model\":\"speech-02-hd\",\"text\":\"こんにちは。\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"v1\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"sad\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Japanese\"}", "key": "2deuvjzx6kn"},
    {"id": "minimax", "cfg": {"key": "k", "host": "https://api.minimax.io", "model": "speech-01-turbo", "model_from": "picked"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "", "url": "https://api.minimax.io/v1/t2a_v2", "body": "{\"model\":\"speech-01-turbo\",\"text\":\"こんにちは。\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"v1\",\"speed\":1,\"vol\":1,\"pitch\":0},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Japanese\"}", "key": "216x0uyfefv"},
    {"id": "minimax", "cfg": {"key": "k", "host": "https://api.minimax.io", "model": "speech-2.8-turbo", "model_from": "voice"}, "voice": {"uid": "x:v2", "voiceId": "v2", "mix": [], "model": "speech-02-hd"}, "params": {}, "emotion": "surprised", "url": "https://api.minimax.io/v1/t2a_v2", "body": "{\"model\":\"speech-02-hd\",\"text\":\"こんにちは。\",\"stream\":false,\"output_format\":\"hex\",\"voice_setting\":{\"voice_id\":\"v2\",\"speed\":1,\"vol\":1,\"pitch\":0,\"emotion\":\"surprised\"},\"audio_setting\":{\"sample_rate\":32000,\"bitrate\":128000,\"format\":\"mp3\",\"channel\":1},\"language_boost\":\"Japanese\"}", "key": "1wrhwssuzxq"},
    {"id": "elevenlabs", "cfg": {"key": "k", "model": "eleven_v3"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {"stability": 0.37, "speed": 1.15}, "emotion": "happy", "url": "https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=mp3_44100_128", "body": "{\"text\":\"[happy] こんにちは。\",\"model_id\":\"eleven_v3\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true},\"language_code\":\"ja\"}", "key": "ggg6sazyaz"},
    {"id": "elevenlabs", "cfg": {"key": "k", "model": "eleven_multilingual_v2"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {"stability": 0.37, "speed": 1.15}, "emotion": "sad", "url": "https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=mp3_44100_128", "body": "{\"text\":\"こんにちは。\",\"model_id\":\"eleven_multilingual_v2\",\"voice_settings\":{\"stability\":0.37,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true,\"speed\":1.15}}", "key": "1n5hrbkq6d7"},
    {"id": "elevenlabs", "cfg": {"key": "k", "model": "eleven_flash_v2_5"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "shout", "url": "https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=mp3_44100_128", "body": "{\"text\":\"こんにちは。\",\"model_id\":\"eleven_flash_v2_5\",\"voice_settings\":{\"stability\":0.5,\"similarity_boost\":0.75,\"style\":0,\"use_speaker_boost\":true,\"speed\":1},\"language_code\":\"ja\"}", "key": "s17raa8jqe"},
    {"id": "cartesia", "cfg": {"key": "k", "model": "sonic-3.6"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "happy", "url": "https://api.cartesia.ai/tts/bytes", "body": "{\"model_id\":\"sonic-3.6\",\"transcript\":\"こんにちは。\",\"voice\":{\"id\":\"v1\"},\"output_format\":{\"container\":\"mp3\",\"sample_rate\":44100,\"bit_rate\":128000},\"generation_config\":{\"speed\":1,\"volume\":1,\"emotion\":\"happy\"},\"language\":\"ja\"}", "key": "1dqjtc4hcxc"},
    {"id": "cartesia", "cfg": {"key": "k", "model": "sonic-3"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {"speed": 1.2}, "emotion": "calm", "url": "https://api.cartesia.ai/tts/bytes", "body": "{\"model_id\":\"sonic-3\",\"transcript\":\"こんにちは。\",\"voice\":{\"id\":\"v1\"},\"output_format\":{\"container\":\"mp3\",\"sample_rate\":44100,\"bit_rate\":128000},\"generation_config\":{\"speed\":1.2,\"volume\":1,\"emotion\":\"calm\"},\"language\":\"ja\"}", "key": "92yuzfx1sn"},
    {"id": "cartesia", "cfg": {"key": "k", "model": "sonic-2"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "", "url": "https://api.cartesia.ai/tts/bytes", "body": "{\"model_id\":\"sonic-3.6\",\"transcript\":\"こんにちは。\",\"voice\":{\"id\":\"v1\"},\"output_format\":{\"container\":\"mp3\",\"sample_rate\":44100,\"bit_rate\":128000},\"generation_config\":{\"speed\":1,\"volume\":1},\"language\":\"ja\"}", "key": "2bk0u71d720"},
    {"id": "typecast", "cfg": {"key": "k", "model": "ssfm-v30"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "happy", "url": "https://api.typecast.ai/v1/text-to-speech", "body": "{\"model\":\"ssfm-v30\",\"voice_id\":\"v1\",\"text\":\"こんにちは。\",\"output\":{\"audio_format\":\"mp3\",\"volume\":100,\"audio_pitch\":0,\"audio_tempo\":1},\"language\":\"jpn\",\"prompt\":{\"emotion_type\":\"preset\",\"emotion_preset\":\"happy\",\"emotion_intensity\":1}}", "key": "1k2zrc88mnr"},
    {"id": "typecast", "cfg": {"key": "k", "model": "ssfm-v21"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {"emotion_preset": "sad"}, "emotion": "", "url": "https://api.typecast.ai/v1/text-to-speech", "body": "{\"model\":\"ssfm-v21\",\"voice_id\":\"v1\",\"text\":\"こんにちは。\",\"output\":{\"audio_format\":\"mp3\",\"volume\":100,\"audio_pitch\":0,\"audio_tempo\":1},\"language\":\"jpn\",\"prompt\":{\"emotion_preset\":\"sad\",\"emotion_intensity\":1}}", "key": "93jys2vi1v"},
    {"id": "gemini", "cfg": {"key": "k", "model": "gemini-3.8-flash-tts"}, "voice": {"uid": "x:v3", "voiceId": "Kore", "mix": [], "model": "", "instructions": "낮게"}, "params": {}, "emotion": "calm", "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent", "body": "{\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":\"こんにちは。\",\"speechMetadata\":{\"style\":\"낮게, calm\"}}]}],\"generationConfig\":{\"responseModalities\":[\"AUDIO\"],\"speechConfig\":{\"voiceConfig\":{\"prebuiltVoiceConfig\":{\"voiceName\":\"Kore\"}}}}}", "key": "sbd2st4957"},
    {"id": "gemini", "cfg": {"key": "k", "model": "gemini-2.5-flash-preview-tts"}, "voice": {"uid": "x:v3", "voiceId": "Kore", "mix": [], "model": "", "instructions": "낮게"}, "params": {}, "emotion": "calm", "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", "body": "{\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":\"낮게, calm: こんにちは。\"}]}],\"generationConfig\":{\"responseModalities\":[\"AUDIO\"],\"speechConfig\":{\"voiceConfig\":{\"prebuiltVoiceConfig\":{\"voiceName\":\"Kore\"}}}}}", "key": "78l96baas9"},
    {"id": "openai", "cfg": {"key": "k", "base": "https://api.openai.com/v1", "model": "gpt-4o-mini-tts"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "happy", "url": "https://api.openai.com/v1/audio/speech", "body": "{\"model\":\"gpt-4o-mini-tts\",\"input\":\"こんにちは。\",\"voice\":\"v1\",\"response_format\":\"mp3\",\"speed\":1,\"instructions\":\"Speak in a happy, bright tone.\"}", "key": "n61vbhqdr8"},
    {"id": "openai", "cfg": {"key": "k", "base": "https://api.openai.com/v1", "model": "tts-1"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "happy", "url": "https://api.openai.com/v1/audio/speech", "body": "{\"model\":\"tts-1\",\"input\":\"こんにちは。\",\"voice\":\"v1\",\"response_format\":\"mp3\",\"speed\":1}", "key": "rqmxpek8mk"},
    {"id": "openrouter", "cfg": {"key": "k", "model": "openai/gpt-4o-mini-tts"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "happy", "url": "https://openrouter.ai/api/v1/audio/speech", "body": "{\"model\":\"openai/gpt-4o-mini-tts\",\"input\":\"こんにちは。\",\"voice\":\"v1\",\"response_format\":\"mp3\",\"speed\":1,\"provider\":{\"options\":{\"openai\":{\"instructions\":\"Speak in a happy, bright tone.\"}}}}", "key": "1w8k7bcqzf5"},
    {"id": "openrouter", "cfg": {"key": "k", "model": "fish-audio/s2.1-pro"}, "voice": {"uid": "x:v1", "voiceId": "v1", "mix": [], "model": ""}, "params": {}, "emotion": "sad", "url": "https://openrouter.ai/api/v1/audio/speech", "body": "{\"model\":\"fish-audio/s2.1-pro\",\"input\":\"こんにちは。\",\"voice\":\"v1\",\"response_format\":\"mp3\",\"speed\":1}", "key": "lf5lym85b9"},
];

console.log('TTS 1.3.7 엔진 모델 목록');

// ---------- 1) _models.js
await test('캐시: localStorage 한 키 · TTL 12시간 · scope 가 다르면 안 씀 · 빈 목록은 예전 목록을 지우지 않음 · 시계가 뒤로 가면 오래된 것', () => {
    assert.equal(M.STORE, 'lemon_voice_tts_models');
    assert.equal(M.MODELS_TTL, 12 * 60 * 60 * 1000);
    assert.equal(M.isStale('x'), true);
    const saved = M.storeModels('x', [{ value: 'a', label: 'A' }, 'b', { value: 'a' }, { value: '' }, { value: 'custom' }]);
    assert.deepEqual(values(saved), ['a', 'b'], '같은 값 · 빈 값 · custom 은 뺌');
    assert.ok(LS.get(M.STORE).includes('"x"'), 'localStorage 에 들어감 (settings.json 아님)');
    assert.equal(T.ext.lemon_voice.tts_models, undefined);
    assert.equal(M.isStale('x'), false);
    assert.deepEqual(values(M.cachedModels('x')), ['a', 'b']);
    assert.equal(M.cachedModels('x', 'https://other'), null);
    assert.equal(M.isStale('x', 'https://other'), true);
    assert.deepEqual(M.storeModels('x', []), []);
    assert.deepEqual(values(M.cachedModels('x')), ['a', 'b'], '빈 목록은 넣지 않음');
    const all = JSON.parse(LS.get(M.STORE));
    all.x.at = Date.now() - M.MODELS_TTL - 1; LS.set(M.STORE, JSON.stringify(all));
    assert.equal(M.isStale('x'), true, '12시간 지남');
    assert.deepEqual(values(M.cachedModels('x')), ['a', 'b'], '오래돼도 새로 받을 때까지는 보여 줌');
    all.x.at = Date.now() + 60 * 60 * 1000; LS.set(M.STORE, JSON.stringify(all));
    assert.equal(M.isStale('x'), true, '앞날 시각 = 오래된 것');
    LS.set(M.STORE, '{깨진 글');
    assert.equal(M.cachedModels('x'), null, '깨진 저장값은 없는 것으로');
});
await test('캐시: localStorage 가 막혀도 이 세션은 메모리로 · 화면은 그대로', () => {
    lsBroken = true;
    assert.equal(M.cachedModels('y'), null);
    M.storeModels('y', ['m1']);
    assert.deepEqual(values(M.cachedModels('y')), ['m1']);
    assert.deepEqual(values(M.modelOptions('y', ['f1'], { model: 'm1' })), ['m1', 'custom']);
});
await test('modelOptions: 받은 목록 || 기본 목록 · 저장된 값은 목록에 없어도 그대로(목록에 없음 · note) · 직접 입력 · cfg 없이도 됨', () => {
    assert.deepEqual(M.modelOptions('z', ['f1', 'f2'], { model: 'f2' }).map(o => [o.value, o.label]), [['f1', 'f1'], ['f2', 'f2'], ['custom', '직접 입력']]);
    assert.deepEqual(M.modelOptions('z', ['f1'], { model: 'old-id' }).map(o => o.label), ['f1', `${KO('z', 'old-id')} (목록에 없음)`, '직접 입력']);
    assert.deepEqual(M.modelOptions('z', ['f1'], { model: 'old-id' }, { note: () => '이전 모델' }).map(o => o.label)[1], `${KO('z', 'old-id')} (이전 모델)`);
    assert.deepEqual(values(M.modelOptions('z', ['f1'], { model: 'custom', model_custom: 'q' })), ['f1', 'custom'], '직접 입력은 한 번만');
    assert.deepEqual(values(M.modelOptions('z', ['f1'])), ['f1', 'custom'], 'cfg 없음 (ui.coerce)');
    M.storeModels('z', ['live1', 'live2']);
    assert.deepEqual(values(M.modelOptions('z', ['f1'], { model: 'f1' })), ['live1', 'live2', 'f1', 'custom'], '받은 목록이 먼저 · 고른 기본 모델도 남음');
});
await test('resolveModel / keyModel: 직접 입력이면 model_custom (비면 기본) · 아니면 저장값 그대로', () => {
    assert.equal(M.resolveModel({ model: 'a' }, 'd'), 'a');
    assert.equal(M.resolveModel({ model: 'custom', model_custom: '  b ' }, 'd'), 'b');
    assert.equal(M.resolveModel({ model: 'custom', model_custom: '' }, 'd'), 'd');
    assert.equal(M.resolveModel({ model: '' }, 'd'), 'd');
    assert.equal(M.keyModel({ model: 'a' }, 'd'), 'a');
    assert.equal(M.keyModel({ model: undefined }, 'd'), undefined, '키는 저장값 그대로 (없으면 없음)');
    assert.equal(M.keyModel({ model: 'custom', model_custom: 'b' }, 'd'), 'b');
    const f = M.customField();
    assert.equal(f.key, 'model_custom'); assert.equal(f.nokey, true); assert.equal(f.show({ model: 'custom' }), true); assert.equal(f.show({ model: 'a' }), false);
});
await test('shared: 진행 중인 같은 요청은 하나로 · 끝나면 다시', async () => {
    let n = 0;
    const fn = () => new Promise(r => setTimeout(() => r(++n), 5));
    const [a, b] = await Promise.all([M.shared('k', fn), M.shared('k', fn)]);
    assert.equal(a, 1); assert.equal(b, 1); assert.equal(M.pending('k'), false);
    assert.equal(await M.shared('k', fn), 2);
    await assert.rejects(M.shared('e', () => { throw new Error('boom'); }), /boom/);
    assert.equal(M.pending('e'), false, '실패해도 비움');
});
await test('버전 비교 newer / atLeast', () => {
    assert.equal(M.newer([2, 9], [2, 8]), true); assert.equal(M.newer([3, 0], [2, 8]), true); assert.equal(M.newer([2, 8], [2, 8]), false);
    assert.equal(M.newer(null, [2, 8]), false); assert.equal(M.atLeast([3, 8], [3, 8]), true); assert.equal(M.atLeast([3, 1], [3, 8]), false);
});

// ---------- 2) 엔진마다 listModels (실제 모양의 응답)
await test('ElevenLabs listModels: GET /v1/models (xi-api-key) · 말하기 모델만 · API 순서 · 영어만은 뒤로 (영어만) · 아는 id 는 짧은 한글 이름 · style/boost 정보', async () => {
    const lang = (...ids) => ids.map(language_id => ({ language_id, name: language_id }));
    const multi = lang('en', 'ko', 'ja');
    route = (c) => {
        assert.equal(c.url, 'https://api.elevenlabs.io/v1/models');
        assert.equal(c.method, 'GET');
        assert.equal(header(c, 'xi-api-key'), 'el-key');
        return J([
            { model_id: 'eleven_v4', name: 'Eleven v4', can_do_text_to_speech: true, can_use_style: false, can_use_speaker_boost: true, languages: multi },
            { model_id: 'eleven_v4_turbo', name: 'Eleven v4 Turbo', can_do_text_to_speech: true, languages: multi },
            { model_id: 'eleven_turbo_v2', name: 'Eleven Turbo v2', can_do_text_to_speech: true, languages: lang('en') },
            { model_id: 'eleven_v3', name: 'Eleven v3', can_do_text_to_speech: true, can_use_style: true, languages: multi },
            { model_id: 'eleven_v3_conversational', name: 'Eleven v3 Conversational', can_do_text_to_speech: true, languages: multi },
            { model_id: 'eleven_multilingual_sts_v2', name: 'Eleven Multilingual v2 (STS)', can_do_text_to_speech: false, can_do_voice_conversion: true, languages: multi },
            { model_id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2', can_do_text_to_speech: true, languages: multi },
            { model_id: 'eleven_flash_v2_5', name: 'Eleven Flash v2.5', can_do_text_to_speech: true, languages: multi },
            { model_id: 'eleven_turbo_v2_5', name: 'Eleven Turbo v2.5', can_do_text_to_speech: true, languages: multi },
            { model_id: 'eleven_flash_v2', name: 'Eleven Flash v2', can_do_text_to_speech: true, languages: lang('en') },
            { model_id: 'eleven_english_sts_v2', name: 'Eleven English v2 (STS)', can_do_text_to_speech: false, languages: lang('en') },
        ]);
    };
    const list = await P('elevenlabs').listModels({ key: 'el-key' });
    assert.deepEqual(values(list), ['eleven_v4', 'eleven_v4_turbo', 'eleven_v3', 'eleven_v3_conversational', 'eleven_multilingual_v2', 'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_turbo_v2', 'eleven_flash_v2']);
    assert.equal(list[0].label, 'Eleven v4');
    assert.equal(list.find(o => o.value === 'eleven_turbo_v2').label, 'Turbo v2 (영어만)');
    assert.deepEqual(list[0].meta, { style: false, boost: true });
    assert.equal(calls.length, 1);
    const cfg = setCfg('elevenlabs', { key: 'el-key', model: 'eleven_v4' });
    assert.deepEqual(values(opts('elevenlabs', cfg)).slice(0, 2), ['eleven_v4', 'eleven_v4_turbo']);
    assert.equal(opts('elevenlabs', cfg).at(-1).value, 'custom');
    const style = P('elevenlabs').params.find(f => f.key === 'style');
    assert.equal(style.show({ model: 'eleven_v4' }), false, '받은 목록: v4 는 can_use_style=false');
    assert.equal(style.show({ model: 'eleven_v3' }), true);
});
await test('OpenAI listModels: GET {주소}/models (Bearer) · TTS 만 (받아 적기 · 실시간 · 검색 뺌) · 새것부터 · 주소마다 따로', async () => {
    route = (c) => {
        assert.equal(header(c, 'Authorization'), 'Bearer oa-key');
        return J({ data: [
            { id: 'gpt-4o-mini-transcribe', created: 9 }, { id: 'tts-1', created: 1 }, { id: 'gpt-realtime-mini-tts', created: 8 },
            { id: 'gpt-4o-mini-tts-2025-12-15', created: 5 }, { id: 'gpt-4o-mini-tts', created: 4 }, { id: 'tts-1-hd', created: 2 }, { id: 'gpt-5.6', created: 10 },
        ] });
    };
    const list = await P('openai').listModels({ key: 'oa-key', base: 'https://api.openai.com/v1/' });
    assert.equal(calls[0].url, 'https://api.openai.com/v1/models');
    assert.deepEqual(values(list), ['gpt-4o-mini-tts-2025-12-15', 'gpt-4o-mini-tts', 'tts-1-hd', 'tts-1']);
    const cfg = setCfg('openai', { key: 'oa-key', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini-tts' });
    assert.deepEqual(values(opts('openai', cfg)), ['gpt-4o-mini-tts-2025-12-15', 'gpt-4o-mini-tts', 'tts-1-hd', 'tts-1', 'custom']);
    const proxy = setCfg('openai', { key: 'oa-key', base: 'https://proxy.example/v1', model: 'gpt-4o-mini-tts' });
    assert.deepEqual(values(opts('openai', proxy)), ['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15', 'tts-1', 'tts-1-hd', 'custom'], '다른 주소는 기본 목록');
    await assert.rejects(P('openai').listModels({ key: '' }), /키/);
});
await test('OpenRouter listModels: 키 없이 GET /models?output_modalities=speech · 새것부터 · localStorage 에 남음 (새로 고침해도) · 기본 목록은 지금 OpenRouter 에 있는 id', async () => {
    route = (c) => {
        assert.equal(c.url, 'https://openrouter.ai/api/v1/models?output_modalities=speech');
        assert.equal(header(c, 'Authorization'), undefined, '키 없으면 헤더도 없음');
        return J({ data: [
            { id: 'minimax/speech-2.8-hd', name: 'MiniMax: Speech 2.8 HD', created: 1784164001, architecture: { output_modalities: ['speech'] } },
            { id: 'microsoft/mai-voice-2.1', name: 'Microsoft AI: MAI-Voice-2.1', created: 1790870467, architecture: { output_modalities: ['speech'] } },
            { id: 'openai/gpt-5.6', name: 'chat', created: 1790870999, architecture: { output_modalities: ['text'] } },
            { id: 'google/gemini-3.8-flash-tts', name: 'Google: Gemini 3.8 Flash TTS', created: 1790200266, architecture: { output_modalities: ['speech'] } },
        ] });
    };
    assert.equal(P('openrouter').modelsPublic, true);
    const list = await P('openrouter').listModels({ key: '' });
    assert.deepEqual(values(list), ['microsoft/mai-voice-2.1', 'google/gemini-3.8-flash-tts', 'minimax/speech-2.8-hd']);
    assert.ok(JSON.parse(LS.get(M.STORE)).openrouter.list.length === 3);
    const old = setCfg('openrouter', { key: 'k', model: 'openai/gpt-4o-mini-tts' });
    const o = opts('openrouter', old);
    assert.deepEqual(o.map(x => x.value), ['microsoft/mai-voice-2.1', 'google/gemini-3.8-flash-tts', 'minimax/speech-2.8-hd', 'openai/gpt-4o-mini-tts', 'custom']);
    assert.equal(o[3].value, 'openai/gpt-4o-mini-tts', '빠진 모델을 고른 사람은 그대로 (바꾸지 않음)');
    assert.equal(o[3].label, '오픈AI · GPT-4o 미니 (목록에 없음)');
    M.clearModels();
    assert.equal(P('openrouter').defaults.model, 'google/gemini-3.8-flash-tts', '새로 설치하면 지금 있는 모델');
    assert.ok(!values(opts('openrouter', setCfg('openrouter', { model: 'google/gemini-3.8-flash-tts' }))).some(v => v.startsWith('openai/')), '기본 목록에 OpenRouter 에서 빠진 openai/ 없음');
});
await test('Gemini listModels: GET /models?pageSize=1000 (x-goog-api-key) · 다음 쪽까지 · 이름에 tts 가 든 generateContent 모델 · models/ 뗌 · 새 버전부터', async () => {
    route = (c) => {
        assert.equal(header(c, 'x-goog-api-key'), 'g-key');
        if (!c.url.includes('pageToken')) {
            assert.equal(c.url, 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000');
            return J({ models: [
                { name: 'models/gemini-2.5-flash-preview-tts', displayName: 'Gemini 2.5 Flash Preview TTS', supportedGenerationMethods: ['countTokens', 'generateContent'] },
                { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-3.8-flash-tts', displayName: 'Gemini 3.8 Flash TTS', supportedGenerationMethods: ['generateContent'] },
            ], nextPageToken: 'p2' });
        }
        return J({ models: [
            { name: 'models/gemini-3.8-flash-lite-tts', displayName: 'Gemini 3.8 Flash-Lite TTS', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-4.0-flash-tts', displayName: 'Gemini 4 Flash TTS', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-tts-embedding', displayName: 'x', supportedGenerationMethods: ['embedContent'] },
        ] });
    };
    const list = await P('gemini').listModels({ key: 'g-key' });
    assert.equal(calls.length, 2);
    assert.deepEqual(values(list), ['gemini-4.0-flash-tts', 'gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-2.5-flash-preview-tts']);
    assert.equal(list[0].label, 'Gemini 4 Flash TTS');
    assert.equal(list[3].label, 'Gemini 2.5 Flash TTS (프리뷰)', '아는 id 는 한글 이름');
});
await test('Typecast listModels: GET /v3/voices (거르지 않고 · X-API-KEY) 의 models[].version 을 모아 새것부터', async () => {
    route = (c) => {
        assert.equal(c.url, 'https://api.typecast.ai/v3/voices');
        assert.equal(header(c, 'X-API-KEY'), 't-key');
        return J([
            { voice_id: 'a', voice_name: { kor: '가' }, models: [{ version: 'ssfm-v21', emotions: ['normal'] }, { version: 'ssfm-v30', emotions: ['normal', 'happy'] }] },
            { voice_id: 'b', voice_name: 'b', models: [{ version: 'ssfm-v31', emotions: ['normal'] }] },
            { voice_id: 'c', voice_name: 'c' },
        ]);
    };
    const list = await P('typecast').listModels({ key: 't-key' });
    assert.deepEqual(values(list), ['ssfm-v31', 'ssfm-v30', 'ssfm-v21']);
    assert.equal(list[1].label, 'ssfm-v30 (감정 7종·문맥 감정)');
});
await test('목록 API 가 없는 엔진 (MiniMax · Cartesia) 은 손으로 쓴 최신 목록 + 직접 입력 · listModels 없음 (↻ 없음)', () => {
    assert.equal(typeof P('minimax').listModels, 'undefined');
    assert.equal(typeof P('cartesia').listModels, 'undefined');
    assert.deepEqual(values(opts('cartesia', setCfg('cartesia', { model: 'sonic-3.6' }))), ['sonic-3.6', 'sonic-3.5', 'sonic-3', 'custom']);
});

// ---------- 3) MiniMax: 지금 내놓는 모델만 (사용자: "미니맥스에 몇 개 없지 않냐 · 내 목록엔 많아")
await test('MiniMax 모델 목록: speech-2.8-hd · speech-2.8-turbo + 직접 입력 · 이전 모델을 고른 사람은 그대로 (이전 모델) · 기본은 그대로 2.8-turbo', () => {
    assert.deepEqual(values(opts('minimax', setCfg('minimax', { model: 'speech-2.8-turbo' }))), ['speech-2.8-hd', 'speech-2.8-turbo', 'custom']);
    for (const m of ['speech-2.6-hd', 'speech-2.6-turbo', 'speech-02-hd', 'speech-02-turbo', 'speech-01-hd', 'speech-01-turbo']) {
        const o = opts('minimax', setCfg('minimax', { model: m }));
        assert.deepEqual(o.map(x => x.value), ['speech-2.8-hd', 'speech-2.8-turbo', m, 'custom'], m);
        assert.equal(o[2].label, `${KO('minimax', m)} (이전 모델)`);
        assert.equal(S.providerConfig('minimax', P('minimax').defaults).model, m, '저장값은 안 바뀜');
    }
    assert.equal(opts('minimax', setCfg('minimax', { model: 'gw-voice-1' }))[2].label, `${KO('minimax', 'gw-voice-1')} (목록에 없음)`);
    assert.equal(P('minimax').defaults.model, 'speech-2.8-turbo');
});

// ---------- 4) 모든 엔진: 직접 입력 칸 · 고른 모델은 바꾸지 않음
await test('모델 select 가 있는 엔진은 모두 직접 입력 (custom) + model_custom 칸 · 새 칸은 nokey (예전 캐시 키 그대로)', () => {
    for (const p of listProviders()) {
        const f = (p.fields || []).find(x => x.key === 'model');
        if (!f || f.type !== 'select') continue;
        assert.ok(values(typeof f.options === 'function' ? f.options() : f.options).includes('custom'), `${p.id} 직접 입력`);
        const mc = p.fields.find(x => x.key === 'model_custom');
        assert.ok(mc && mc.type === 'text' && mc.show({ model: 'custom' }) && !mc.show({ model: 'x' }), `${p.id} model_custom`);
        if (!['openai', 'openrouter'].includes(p.id)) assert.equal(mc.nokey, true, `${p.id} 새 칸은 캐시 키 밖`);
    }
});
await test('직접 입력 · 목록 밖 id 는 그대로 보낸다 (Cartesia · Typecast 바꿔치기 없앰) · 문을 닫은 Cartesia 모델만 1.3.6 처럼 sonic-3.6', async () => {
    assert.equal((await synthBody('cartesia', { key: 'k', model: 'sonic-3.7' })).body.model_id, 'sonic-3.7');
    assert.equal((await synthBody('cartesia', { key: 'k', model: 'custom', model_custom: 'sonic-latest' })).body.model_id, 'sonic-latest');
    for (const m of ['sonic-2', 'sonic-2-2025-03-07', 'sonic-turbo', 'sonic-3-2025-10-27', 'sonic', 'sonic-english', 'sonic-multilingual']) assert.equal(CA.cartesiaModel({ model: m }), 'sonic-3.6', m);
    assert.equal(CA.cartesiaModel({ model: 'sonic-3' }), 'sonic-3');
    assert.equal(opts('cartesia', setCfg('cartesia', { model: 'sonic-2' }))[3].label, '소닉 2 (종료)');
    assert.equal((await synthBody('typecast', { key: 'k', model: 'ssfm-v31' })).body.model, 'ssfm-v31');
    assert.equal((await synthBody('typecast', { key: 'k', model: 'custom', model_custom: 'ssfm-v40' })).body.model, 'ssfm-v40');
    route = () => J([]);
    calls.length = 0;
    await P('typecast').listVoices(setCfg('typecast', { key: 'k', model: 'ssfm-v31' }));
    assert.equal(calls[0].url, 'https://api.typecast.ai/v3/voices?model=ssfm-v31', '모르는 모델도 목소리 거르기');
    calls.length = 0;
    await P('typecast').listVoices(setCfg('typecast', { key: 'k', model: 'ssfm-v30' }));
    assert.equal(calls[0].url, 'https://api.typecast.ai/v3/voices?model=ssfm-v30');
    route = null;
    assert.equal((await synthBody('elevenlabs', { key: 'k', model: 'custom', model_custom: 'eleven_v9_beta' })).body.model_id, 'eleven_v9_beta');
    assert.equal((await synthBody('gemini', { key: 'k', model: 'custom', model_custom: 'gemini-flash-tts-latest' })).url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-tts-latest:generateContent');
    assert.equal((await synthBody('minimax', { key: 'k', host: 'https://api.minimax.io', model: 'custom', model_custom: 'speech-2.9-hd' })).body.model, 'speech-2.9-hd');
    assert.equal((await synthBody('minimax', { key: 'k', host: 'https://api.minimax.io', model: 'custom', model_custom: '' })).body.model, 'speech-2.8-turbo', '비운 직접 입력 = 기본');
    assert.equal((await synthBody('openrouter', { key: 'k', model: 'custom', model_custom: 'x-ai/grok-voice-tts-1.0' })).body.model, 'x-ai/grok-voice-tts-1.0');
});
await test('새로 설치한 기본 모델은 최신 · 저장된 모델은 providerConfig 가 그대로 둔다', () => {
    const want = { elevenlabs: 'eleven_v4', minimax: 'speech-2.8-turbo', cartesia: 'sonic-3.6', typecast: 'ssfm-v30', gemini: 'gemini-3.8-flash-tts', openai: 'gpt-4o-mini-tts', openrouter: 'google/gemini-3.8-flash-tts' };
    for (const [id, m] of Object.entries(want)) {
        delete T.ext.lemon_voice.providers[id];
        assert.equal(S.providerConfig(id, P(id).defaults).model, m, `${id} 새 설치`);
    }
    for (const [id, m] of Object.entries({ elevenlabs: 'eleven_v3', openrouter: 'openai/gpt-4o-mini-tts', gemini: 'gemini-2.5-pro-preview-tts', minimax: 'speech-02-hd' })) {
        T.ext.lemon_voice.providers[id] = { model: m };
        assert.equal(S.providerConfig(id, P(id).defaults).model, m, `${id} 저장값 그대로`);
    }
});

// ---------- 5) 예전 id: 요청 본문 · 캐시 키가 바꾸기 전과 바이트까지 같다
await test(`예전 모델 id ${GOLDEN.length}가지: 요청 주소 · 본문 · player.keyOf 가 바꾸기 전 코드와 같다`, async () => {
    assert.ok(GOLDEN.length >= 20);
    for (const g of GOLDEN) {
        const p = P(g.id);
        const cfg = setCfg(g.id, g.cfg);
        calls.length = 0;
        route = SYNTH;
        await p.synth({ text: 'こんにちは。', voice: g.voice, cfg, params: { ...p.defaults, ...g.params }, lang: 'ja', emotion: g.emotion });
        route = null;
        const label = `${g.id} ${g.cfg.model} ${g.emotion || '-'}`;
        assert.equal(calls[0].url, g.url, label);
        assert.equal(calls[0].body, g.body, label);
        assert.equal(player.keyOf({ provider: p, voice: g.voice, params: { ...g.params }, lang: 'ja', emotion: g.emotion, text: 'こんにちは。' }), g.key, `${label} 캐시 키`);
    }
});
await test('캐시 키: 새 model_custom 칸은 직접 입력이 아니면 키에 안 들어감 · 직접 입력이면 적은 이름이 키를 가른다', () => {
    const voice = { uid: 'x:v1', voiceId: 'v1', mix: [] };
    const key = (id, cfg) => { setCfg(id, cfg); return player.keyOf({ provider: P(id), voice, params: {}, lang: 'ja', emotion: '', text: 'a' }); };
    for (const [id, m] of [['elevenlabs', 'eleven_v3'], ['minimax', 'speech-2.8-hd'], ['cartesia', 'sonic-3.6'], ['typecast', 'ssfm-v30'], ['gemini', 'gemini-3.8-flash-tts']]) {
        const base = { key: 'k', model: m };
        assert.equal(key(id, { ...base, model_custom: 'leftover' }), key(id, base), `${id} 남은 model_custom 은 키 밖`);
        assert.equal(key(id, { key: 'k', model: 'custom', model_custom: m }), key(id, base), `${id} 직접 입력으로 같은 모델 = 같은 소리`);
        assert.notEqual(key(id, { key: 'k', model: 'custom', model_custom: `${m}-x` }), key(id, base), `${id} 다른 이름 = 다른 키`);
    }
});

// ---------- 6) 새 모델은 최신 갈래처럼 (버전 읽기)
await test('ElevenLabs 세대: 3 이상 태그 · 3 만 안정감 0/0.5/1 · 3 이상 속도 없음 · multilingual_v2 만 언어 코드 없음 — eleven_v4 · eleven_v5 도', async () => {
    assert.deepEqual(['eleven_v3', 'eleven_v3_conversational', 'eleven_v4', 'eleven_v4_turbo', 'eleven_v5', 'eleven_multilingual_v2', 'eleven_flash_v2_5', 'x'].map(EL.genOf), [3, 3, 4, 4, 5, 0, 0, 0]);
    for (const m of ['eleven_v4', 'eleven_v4_turbo', 'eleven_v5']) {
        const { body } = await synthBody('elevenlabs', { key: 'k', model: m }, { params: { stability: 0.37, speed: 1.2 }, emotion: 'whisper' });
        assert.equal(body.text, '[whispers] こんにちは。', `${m} 태그`);
        assert.equal(body.voice_settings.stability, 0.37, `${m} 안정감 그대로`);
        assert.equal('speed' in body.voice_settings, false, `${m} 속도 없음 (v4 는 무시)`);
        assert.equal(body.language_code, 'ja');
    }
    const speed = P('elevenlabs').params.find(f => f.key === 'speed');
    assert.equal(speed.show({ model: 'eleven_v4' }), false);
    assert.equal(speed.show({ model: 'eleven_flash_v2_5' }), true);
    assert.equal(speed.show({ model: 'custom', model_custom: 'eleven_v5' }), false, '직접 입력한 이름도 세대로');
    const style = P('elevenlabs').params.find(f => f.key === 'style');
    assert.equal(style.show({ model: 'eleven_v4' }), false, '목록 정보가 없으면 v4 부터 스타일 없음 (v4 안내)');
    assert.equal(style.show({ model: 'eleven_v3' }), true);
});
await test('MiniMax 버전: 감탄 태그 = 2.8 + 그보다 새 버전 · 속삭임/유창은 2.6 만 · 모르는 이름(게이트웨이)은 예전처럼 태그 없음', async () => {
    assert.deepEqual(['speech-2.8-hd', 'speech-02-hd', 'speech-01-turbo', 'speech-3-hd', 'speech-3.0-turbo', 'speech-2.10-hd', 'indextts'].map(MM.versionOf), [[2, 8], [2, 0], [1, 0], [3, 0], [3, 0], [2, 10], null]);
    assert.deepEqual(['speech-2.8-hd', 'speech-2.8-hd-20260716', 'speech-2.9-hd', 'speech-3.0-hd', 'speech-2.6-hd', 'speech-02-hd', 'speech-01-hd', 'indextts', ''].map(MM.hasTags), [true, true, true, true, false, false, false, false, false]);
    const v = { uid: 'x:v1', voiceId: 'v1', mix: [], model: '' };
    const strong = await synthBody('minimax', { key: 'k', host: 'https://api.minimax.io', model: 'speech-3.0-hd' }, { params: { emotion_strength: 'strong' }, emotion: 'happy' });
    assert.equal(strong.body.text, '(laughs)こんにちは。');
    assert.equal(MM.strengthApplies(v, { model: 'speech-3.0-hd' }, 'happy'), true);
    assert.equal(MM.strengthApplies(v, { model: 'indextts' }, 'happy'), false);
    assert.equal(MM.modelFor(v, { model: 'speech-3.0-turbo' }, 'whisper'), 'speech-2.6-turbo', '속삭임은 같은 등급의 2.6');
    assert.equal(MM.modelFor(v, { model: 'speech-3.0-hd' }, 'whisper'), 'speech-2.6-hd');
    assert.equal(MM.modelFor(v, { model: 'custom', model_custom: 'speech-3.0-hd' }, ''), 'speech-3.0-hd');
    const fl = await synthBody('minimax', { key: 'k', host: 'https://api.minimax.io', model: 'speech-3.0-hd' }, { emotion: 'fluent' });
    assert.equal(fl.body.voice_setting.emotion, undefined, '유창은 2.6 만');
});
await test('Gemini 버전: 3.8 이상 · 못 읽는 이름(별명)은 speechMetadata · 3.8 미만만 "말투: " 앞붙이기', () => {
    const want = { 'gemini-3.8-flash-tts': true, 'gemini-3.9-flash-tts': true, 'gemini-3.10-flash-tts': true, 'gemini-4-flash-tts': true, 'gemini-10.0-tts': true, 'gemini-flash-tts-latest': true, 'gemini-3.1-flash-tts-preview': false, 'gemini-2.5-pro-preview-tts': false };
    for (const [m, on] of Object.entries(want)) assert.equal(GE.usesMetadata(m), on, m);
    const o = opts('gemini', setCfg('gemini', { model: 'gemini-2.5-pro-preview-tts' }));
    assert.deepEqual(values(o), ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-2.5-pro-preview-tts', 'custom'], '기본 목록은 지금 모델 · 고른 프리뷰는 그대로');
    assert.equal(o[2].label, '제미나이 2.5 프로 미리보기 (종료 예정)');
});
await test('Typecast: ssfm-v21 만 예전 감정(4종) · 나머지(v31 · 직접 입력)는 v30 처럼 문맥 감정', async () => {
    const mode = P('typecast').params.find(f => f.key === 'emotion_mode');
    assert.equal(mode.show({ model: 'ssfm-v21' }), false);
    assert.equal(mode.show({ model: 'ssfm-v31' }), true);
    assert.deepEqual((await synthBody('typecast', { key: 'k', model: 'ssfm-v31' })).body.prompt, { emotion_type: 'smart' });
    assert.equal((await synthBody('typecast', { key: 'k', model: 'ssfm-v21' })).body.prompt.emotion_preset, 'normal');
});

// ---------- 7) 설정 창 (ui.js): ↻ · 자동 받기는 보일 때만 · 연결 확인이 목록도
await test('설정 창: 목록을 받는 엔진의 모델 줄에 ↻ (키가 있거나 키 없이 되는 목록) · MiniMax · 키 없는 ElevenLabs 엔 없음', () => {
    if (ui.__error) throw ui.__error;
    const { control, canListModels, listingProvider } = ui._forTest;
    const f = (id) => P(id).fields.find(x => x.key === 'model');
    setCfg('openrouter', { key: '', model: 'google/gemini-3.8-flash-tts' });
    setCfg('elevenlabs', { key: '', model: 'eleven_v3' });
    setCfg('minimax', { key: 'k', model: 'speech-2.8-turbo' });
    assert.equal(canListModels(P('openrouter')), true, 'OpenRouter 는 키 없이');
    assert.equal(canListModels(P('elevenlabs')), false);
    assert.equal(canListModels(P('minimax')), false);
    const html = (id) => control(f(id), `providers.${id}.model`, S.providerConfig(id, P(id).defaults).model, S.providerConfig(id, P(id).defaults));
    assert.match(html('openrouter'), /data-lv-act="engine-models"/);
    assert.match(html('openrouter'), /data-lv-path="providers\.openrouter\.model"/);
    assert.doesNotMatch(html('elevenlabs'), /engine-models/);
    assert.doesNotMatch(html('minimax'), /engine-models/);
    assert.match(html('minimax'), /<option value="custom">직접 입력<\/option>/);
    setCfg('elevenlabs', { key: 'el', model: 'eleven_v3' });
    assert.ok(listingProvider('providers.elevenlabs.model'));
    assert.match(html('elevenlabs'), /engine-models/);
    assert.equal(listingProvider('providers.elevenlabs.stability'), null);
    assert.doesNotMatch(html('elevenlabs'), /title=/, '말풍선(title) 없음');
});
await test('자동 받기: 엔진 탭이 안 보이면(페이지를 열 때 · 닫힌 서랍) 요청 없음 · 보이면 12시간에 한 번 · 실패는 조용히 10분 쉼 · OpenAI 새 주소는 저절로 안 감', async () => {
    if (ui.__error) throw ui.__error;
    const { autoEngineModels, autoModelsDue } = ui._forTest;
    const pane = { hidden: false, offsetParent: null };
    const prevDoc = globalThis.document;
    globalThis.document = { querySelector: (sel) => (sel === '#lv_pane_engine' ? pane : null), querySelectorAll: () => [], activeElement: null };
    try {
        T.ext.lemon_voice.ui.provider_tab = 'openrouter';
        setCfg('openrouter', { key: '', model: 'google/gemini-3.8-flash-tts' });
        let n = 0;
        route = () => { n++; return J({ data: [{ id: 'google/gemini-3.8-flash-tts', name: 'g', created: 1 }] }); };
        autoEngineModels();
        await new Promise(r => setTimeout(r, 10));
        assert.equal(n, 0, '닫힌 서랍 (offsetParent null) = 요청 없음');
        pane.offsetParent = {};
        autoEngineModels();
        await new Promise(r => setTimeout(r, 10));
        assert.equal(n, 1, '보이면 받음');
        assert.equal(M.isStale('openrouter'), false);
        autoEngineModels();
        await new Promise(r => setTimeout(r, 10));
        assert.equal(n, 1, '12시간 안엔 다시 안 받음');
        // 실패: 조용히 · 예전 목록 그대로 · 10분 안엔 다시 안 함
        const all = JSON.parse(LS.get(M.STORE)); all.openrouter.at = 0; LS.set(M.STORE, JSON.stringify(all));
        assert.equal(autoModelsDue(P('openrouter'), Date.now()), false, '방금 시도함 (10분)');
        assert.equal(autoModelsDue(P('openrouter'), Date.now() + 11 * 60 * 1000), true);
        // OpenAI: 기본 주소만 저절로 · 새로 적은 주소는 ↻ · 연결 확인으로만
        setCfg('openai', { key: 'oa', base: 'https://typo.example/v1', model: 'gpt-4o-mini-tts' });
        assert.equal(autoModelsDue(P('openai')), false);
        setCfg('openai', { key: 'oa', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini-tts' });
        assert.equal(autoModelsDue(P('openai')), true);
        setCfg('openai', { key: '', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini-tts' });
        assert.equal(autoModelsDue(P('openai')), false, '키 없으면 안 감');
    } finally { globalThis.document = prevDoc; route = null; }
});
await test('↻ · 연결 확인: 실패해도 예전 목록 · 고른 모델 그대로 · 같은 요청은 하나로', async () => {
    if (ui.__error) throw ui.__error;
    const { refreshEngineModels } = ui._forTest;
    const prevDoc = globalThis.document;
    globalThis.document = { querySelector: () => null, querySelectorAll: () => [], activeElement: null };
    try {
        M.storeModels('elevenlabs', [{ value: 'eleven_v3', label: 'Eleven v3' }]);
        setCfg('elevenlabs', { key: 'el', model: 'eleven_v3' });
        route = () => J({ detail: { status: 'invalid_api_key', message: 'bad' } }, 401);
        assert.equal(await refreshEngineModels(P('elevenlabs')), null);
        assert.deepEqual(values(M.cachedModels('elevenlabs')), ['eleven_v3'], '실패 = 예전 목록');
        assert.equal(S.providerConfig('elevenlabs', P('elevenlabs').defaults).model, 'eleven_v3');
        let n = 0;
        route = () => { n++; return J([{ model_id: 'eleven_v4', can_do_text_to_speech: true, languages: [] }]); };
        await Promise.all([refreshEngineModels(P('elevenlabs')), P('elevenlabs').listModels({ key: 'el' })]);
        assert.equal(n, 1, '설정 창과 연결 확인이 같이 불러도 한 번');
        assert.deepEqual(values(opts('elevenlabs', S.providerConfig('elevenlabs', P('elevenlabs').defaults))), ['eleven_v4', 'eleven_v3', 'custom'], '목록이 바뀌어도 고른 eleven_v3 는 남음');
    } finally { globalThis.document = prevDoc; route = null; }
});

console.log(`\ntts-models: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
