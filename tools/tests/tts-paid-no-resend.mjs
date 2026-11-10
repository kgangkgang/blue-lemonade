// 코드 감사 2차 V1 · V2: TTS 합성 요청을 결과를 모르는 채로 다시 보내지 않아요(업체가 이미 만들었으면 두 번 과금).
//   V1 고치기 전: providers/_http.js 가 우리가 끊은 시간 초과를 408(retry) · 응답을 받은 뒤 본문 읽다 끊긴 것을 network(retry)로 바꿔,
//      player.js synthRetry 가 같은 글을 1.5 · 4초 뒤 최대 3번 다시 POST 했어요. 고친 뒤: 둘 다 retry=false, 응답 머리를 받기 전 연결 실패만 다시 보내요.
//   V2 고치기 전: ElevenLabs with-timestamps 응답이 200 인데 JSON 이 잘렸거나 audio_base64 가 없으면 같은 본문을 예전 주소로 한 번 더 POST 했어요.
//      고친 뒤: 업체가 거부한 4xx(키 · 한도 · 몰림이 아닌 것)일 때만 예전 주소로 물러서요.
//   node tools/tests/tts-paid-no-resend.mjs <테마 루트>   — 실리태번 모듈은 data: 스텁, 가짜 fetch 만 (네트워크 0)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
globalThis.__ttsNoResend = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina' } };
const G = 'const T = globalThis.__ttsNoResend;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat; export const event_types = {}; export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = t => String(t ?? ''); export function getRequestHeaders() { return {}; } export function saveSettingsDebounced() {} export async function saveSettings() {}
export const main_api = 'openai'; export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + 'export const extension_settings = T.ext; export const extensionNames = []; export function getContext() { return T.ctx; } export function saveMetadataDebounced() {}'),
    'popup.js': js('export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 }; export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null }; export async function callGenericPopup() { return null; }'),
    'utils.js': js('export function getStringHash(s) { let h = 0; for (const c of String(s ?? "")) h = (h * 31 + c.charCodeAt(0)) | 0; return h; } export function splitRecursive(t) { return [String(t ?? "")]; }'),
    'secrets.js': js('export const secret_state = {};'),
};
register(js(`let S = {}; export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) { const parent = String(ctx.parentURL || ''); if (parent.includes('/addons/tts/')) { const base = spec.split('/').pop(); if (spec.split('../').length - 1 >= 3 && S[base]) return { url: S[base], shortCircuit: true }; } return next(spec, ctx); }`), { data: { st: ST } });
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.document ??= { addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [], querySelector: () => null, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, addEventListener() {}, querySelector: () => null }), body: { appendChild() {}, append() {} }, hidden: false };
globalThis.window ??= globalThis;
const mod = name => import(pathToFileURL(path.join(root, name)).href);
const S = await mod('settings.js');
S.settings();
const R = await mod('runtime.js');
try { R.setRuntimeEnabled?.(true); } catch { /* 없음 */ }
const H = await mod('providers/_http.js');
const P = await mod('player.js');
const EL = (await mod('providers/elevenlabs.js')).default;

let pass = 0;
const test = async (name, fn) => { await fn(); pass++; console.log('PASS ' + name); };
const fail = async p => { try { await p; return null; } catch (e) { return e; } };
let posts = 0;
const hang = async (url, init) => { posts++; return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })); };
const cutBody = async () => { posts++; return { ok: true, status: 200, json: async () => { throw new TypeError('network error'); }, text: async () => { throw new TypeError('network error'); } }; };
const refused = async () => { posts++; throw new TypeError('Failed to fetch'); };

await test('V1 timedFetch: 우리가 끊은 시간 초과는 408 이지만 다시 보내지 않아요', async () => {
    globalThis.fetch = hang; posts = 0;
    const e = await fail(H.timedFetch('https://x.invalid/tts', { method: 'POST' }, r => r.json(), { timeout: 30 }));
    assert.equal(e?.status, 408);
    assert.equal(e.retry, false);
});
await test('V1 timedFetch: 응답을 받은 뒤 본문 읽다 끊긴 것은 다시 보내지 않아요', async () => {
    globalThis.fetch = cutBody;
    const e = await fail(H.timedFetch('https://x.invalid/tts', { method: 'POST' }, r => r.json(), {}));
    assert.equal(e?.code, 'network');
    assert.equal(e.retry, false);
});
await test('V1 timedFetch: 응답 머리를 받기 전 연결 실패는 예전처럼 다시 보내요', async () => {
    globalThis.fetch = refused;
    const e = await fail(H.timedFetch('https://x.invalid/tts', { method: 'POST' }, r => r.json(), {}));
    assert.equal(e?.code, 'network');
    assert.equal(e.retry, true);
});
await test('V1 fetchJson · fetchBlob: 우리가 끊은 시간 초과는 다시 보내지 않아요 (MiniMax 등)', async () => {
    globalThis.fetch = hang;
    for (const f of [H.fetchJson, H.fetchBlob]) {
        const e = await fail(f('https://x.invalid/tts', { method: 'POST', body: { text: 'a' }, timeout: 30 }));
        assert.equal(e?.status, 408);
        assert.equal(e.retry, false);
    }
    assert.equal(H.koError(408, null).retry, true, '업체가 보낸 408 은 예전처럼 다시 시도');
});
await test('V1 재생기 synthRetry: 시간 초과 · 본문 끊김 뒤 같은 글을 한 번만 보내요 (고치기 전: 2번 이상)', async () => {
    for (const [label, f] of [['시간 초과', hang], ['본문 끊김', cutBody]]) {
        globalThis.fetch = f; posts = 0;
        const provider = { id: 'fake-' + label, name: 'Fake', needsKey: false, fields: [], params: [], caps: { blob: true }, defaults: {},
            async synth({ signal }) { return H.timedFetch('https://x.invalid/tts', { method: 'POST' }, r => r.json(), { signal, timeout: 30 }); } };
        const job = { mesId: -1, text: '안녕', voice: { uid: 'v', name: 'v', provider: provider.id }, provider, params: {}, lang: 'ko', emotion: '', key: 'k-' + label, parts: [] };
        const e = await fail(P.ensureClip(job, { prepare: false }));
        assert.ok(e, label + ': 실패로 끝나요');
        assert.equal(posts, 1, label + ': 합성 POST 1번');
    }
});
const mp3 = () => new Response(new Blob([new Uint8Array([0xff, 0xfb, 0x90, 0, 1, 2, 3])], { type: 'audio/mpeg' }), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
async function elScene(first) {
    const sent = [];
    globalThis.fetch = async url => { sent.push(String(url)); return sent.length === 1 ? first() : mp3(); };
    const e = await fail(EL.synth({ text: '안녕', voice: { voiceId: 'v1' }, cfg: { key: 'k', model: 'eleven_v3' }, params: {} }));
    return { sent, e };
}
await test('V2 ElevenLabs: 200 인데 JSON 이 잘렸으면 예전 주소로 다시 POST 하지 않아요', async () => {
    const { sent, e } = await elScene(() => new Response('{"audio_base64":"//uQ', { status: 200, headers: { 'content-type': 'application/json' } }));
    assert.equal(sent.length, 1);
    assert.ok(e && e.retry === false);
});
await test('V2 ElevenLabs: 200 인데 audio_base64 가 없으면 예전 주소로 다시 POST 하지 않아요', async () => {
    const { sent, e } = await elScene(() => new Response(JSON.stringify({ alignment: null }), { status: 200, headers: { 'content-type': 'application/json' } }));
    assert.equal(sent.length, 1);
    assert.ok(e && e.retry === false);
});
await test('V2 ElevenLabs: 업체가 거부한 422 는 예전처럼 예전 주소로 한 번 물러서요', async () => {
    const { sent, e } = await elScene(() => new Response(JSON.stringify({ detail: { status: 'invalid_request', message: 'no timestamps' } }), { status: 422, headers: { 'content-type': 'application/json' } }));
    assert.equal(sent.length, 2);
    assert.ok(!sent[1].includes('with-timestamps'));
    assert.equal(e, null);
});
await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(theme, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/tts-paid-no-resend.mjs .'));
});
console.log(`tts-paid-no-resend: ${pass} passed`);
process.exit(0);
