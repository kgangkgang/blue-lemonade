// 7.7.4 TTS API 실패 주입 — 실패를 만났을 때 같은 요청을 거듭 보내거나 · 끝없이 기다리거나 · 나쁜 답을 저장하지 않는지.
//   ① 대사 분석의 빈 답 · 출력 한도에 잘린 답은 잠깐의 실패(soft) — 굳은 실패(hard)로 기억해 글을 고치기 전엔 다시 안 묻던 것
//   ② 재생기 · 미리 만들기의 「한 번 더」(again)는 방금 남긴 잠깐 실패 기억을 넘어 실제로 보낸다 (굳은 실패는 그대로 막음)
//   ③ 실리태번 연결 기다림(waitForRuntime)에 시간 상한 — 답이 안 오면 끝나고 분석 줄을 푼다
//   ④ 200 인데 소리 대신 JSON · HTML 이 온 본문은 오류 (audioOrError) — 캐시에 들어가지 않게
//   node tools/tests/fault-tts.mjs <테마 루트>   (시험대는 tts-reanalysis-guard.mjs 와 같다: 실리태번 스텁 · 가짜 fetch, 네트워크 0)
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const root = path.join(theme, 'src/addons/tts/src');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const T = globalThis.__faultTtsTest = { ext: {}, saves: 0, requests: [], reply: null, status: 200, gate: null, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina', characters: [], groups: [], chatId: 'chat-a' } };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T=globalThis.__faultTtsTest;';
const stubs = {
    'script.js': data(G + `export const chat=T.ctx.chat; export const event_types={}; export const eventSource={on(){},makeLast(){},emit(){},removeListener(){}};
export const substituteParams=t=>String(t??''); export const getRequestHeaders=()=>({}); export function saveSettingsDebounced(){} export async function saveSettings(){}
export function syncMesToSwipe(i){ const m=T.ctx.chat[i]; if(m&&m.swipe_info&&m.swipe_info[m.swipe_id??0]) m.swipe_info[m.swipe_id??0].extra=structuredClone(m.extra); return true; } export const main_api='openai'; export function generateRaw(){throw Error('Unexpected LLM')}`),
    'extensions.js': data(G + 'export const extension_settings=T.ext; export const extensionNames=[]; export const getContext=()=>T.ctx; export function saveMetadataDebounced(){}'),
    'utils.js': data('export const getStringHash=s=>String(s).length; export const splitRecursive=t=>[String(t??"")];'),
    'secrets.js': data('export const secret_state={};'),
    'popup.js': data('export const POPUP_TYPE={TEXT:1,CONFIRM:2,INPUT:3}; export const POPUP_RESULT={AFFIRMATIVE:1,NEGATIVE:0,CANCELLED:null}; export async function callGenericPopup(){throw Error("Unexpected popup")} export function fixToastrForDialogs(){}'),
};
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){const base=spec.split('/').pop();if(String(ctx.parentURL||'').includes('/addons/tts/')&&spec.split('../').length>3&&D[base])return {url:D[base],shortCircuit:true};return next(spec,ctx)}`), { data: stubs });
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), 'https://mock.invalid/v1/chat/completions');
    const body = JSON.parse(init.body); T.requests.push(body);
    if (T.gate) { T.gate.started = true; await T.gate.promise; }
    if (T.status !== 200) return new Response(JSON.stringify({ error: { message: 'mock upstream failure' } }), { status: T.status, headers: { 'Content-Type': 'application/json' } });
    const content = T.reply(body);
    return new Response(JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: T.finish || 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10 } }), { headers: { 'Content-Type': 'application/json' } });
};
const A = await import(pathToFileURL(path.join(root, 'analysis.js')).href);
const S = await import(pathToFileURL(path.join(root, 'settings.js')).href);

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }
function gate() { let release; const promise = new Promise(r => { release = r; }); return { promise, release, started: false }; }
const realNow = Date.now;
const TEXT = '"Good morning." She stretched and yawned. "Did you sleep well?" He nodded.';
const OK = () => ({ segs: [{ i: 0, emotion: 'happy' }, { i: 1, emotion: 'calm' }] });
const message = (text = TEXT) => ({ mes: text, name: 'Mina', is_user: false, is_system: false, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });
async function setup(text = TEXT) {
    Date.now = realNow;
    T.requests.length = 0; T.gate = null; T.reply = OK; T.status = 200; T.finish = null; T.saves = 0; store.clear();
    Object.assign(S.settings(), { enabled: true, extras: 'off', voices: [], sfx: { ...(S.settings().sfx || {}), enabled: false, auto: false, custom: [] } });
    Object.assign(S.settings().analysis, { enabled: true, engine: 'compat', base: 'https://mock.invalid/v1', key: 'mock-only', model: 'm', emotion: true, translate: false, speaker: false, context_chars: 1200, when: 'auto', fallback: { enabled: false, provider: '', model: '' } });
    A.clearAnalysis('chat');
    T.ctx.chat.length = 0;
    T.ctx.chat.push(message(text));
    return T.ctx.chat[0];
}
/** 채팅 다시 열기 · 새로고침 흉내: 저장된 모양(JSON)으로 새 메시지 객체 — WeakMap 기억은 모두 사라진다 */
function reload() { const copy = JSON.parse(JSON.stringify(T.ctx.chat[0])); T.ctx.chat[0] = copy; return copy; }
const fail = async (p) => { try { await p; return null; } catch (e) { return e; } };

await test('7.7.4 an empty analysis reply is a soft failure (cooldown), not a hard one', async () => {
    const mes = await setup();
    T.reply = () => '';
    const e = await fail(A.analyzeMessage(0));
    assert.ok(e, 'empty reply fails');
    assert.equal(mes.extra?.lemon_voice?.failed?.hard, false, 'empty = soft');
    await setup();
    T.reply = () => 'not json at all';
    const e2 = await fail(A.analyzeMessage(0));
    assert.ok(e2);
    assert.equal(T.ctx.chat[0].extra?.lemon_voice?.failed?.hard, true, 'a non-JSON prose reply stays hard');
});
await test('7.7.4 a reply cut by finish_reason length is a soft failure (compat engine reads finish_reason)', async () => {
    const mes = await setup();
    T.finish = 'length';
    T.reply = () => '{"segs":[{"i":0,"emotion":"hap';
    const e = await fail(A.analyzeMessage(0));
    assert.ok(e && /길이 한도/.test(e.message), 'reported as cut: ' + e?.message);
    assert.equal(mes.extra?.lemon_voice?.failed?.hard, false);
});
await test('7.7.4 the SillyTavern-connection engine: a reply cut mid-JSON is a soft failure (no finish reason there)', async () => {
    const mes = await setup();
    S.settings().analysis.engine = 'st';
    T.ctx.mainApi = 'openai'; T.ctx.chatCompletionSettings = { chat_completion_source: 'custom' };
    let calls = 0;
    T.ctx.generateRaw = async () => { calls++; return '{"segs":[{"i":0,"emotion":"hap'; };
    try {
        const e = await fail(A.analyzeMessage(0));
        assert.ok(e, 'fails');
        assert.equal(calls, 1);
        assert.equal(mes.extra?.lemon_voice?.failed?.hard, false, 'cut JSON is soft: ' + e?.message);
    } finally { delete T.ctx.generateRaw; delete T.ctx.mainApi; delete T.ctx.chatCompletionSettings; }
});
await test('7.7.4 again:true sends once more after a soft failure, and a hard failure still blocks it', async () => {
    await setup();
    T.status = 503;
    await fail(A.analyzeMessage(0));
    assert.equal(T.requests.length, 1);
    const blocked = await fail(A.analyzeMessage(0));
    assert.ok(blocked && /쉬는 중/.test(blocked.message), 'a plain second call is still held back');
    assert.equal(T.requests.length, 1);
    T.status = 200;
    const r = await A.analyzeMessage(0, { again: true });
    assert.equal(T.requests.length, 2, 'the retry was actually sent');
    assert.ok(r && Array.isArray(r.segs), 'and its answer is used');
    await setup();
    T.reply = () => 'prose, no json';
    await fail(A.analyzeMessage(0));
    assert.equal(T.requests.length, 1);
    const hard = await fail(A.analyzeMessage(0, { again: true }));
    assert.ok(hard, 'hard failure still refuses');
    assert.equal(T.requests.length, 1, 'no request for a hard failure');
});
await test('7.7.4 waitForRuntime ends a call that never answers after timeoutMs', async () => {
    const R = await import(pathToFileURL(path.join(root, 'runtime.js')).href);
    const t0 = realNow();
    const e = await fail(R.waitForRuntime(() => new Promise(() => {}), null, { timeoutMs: 60, timeoutError: () => Object.assign(new Error('st timeout'), { retry: true }) }));
    assert.ok(e && e.message === 'st timeout' && e.retry === true, 'times out with the given error: ' + e?.message);
    assert.ok(realNow() - t0 < 2000);
    const ok = await R.waitForRuntime(async () => 'done', null, { timeoutMs: 60 });
    assert.equal(ok, 'done', 'a quick answer is unaffected');
    const src = (await import('node:fs')).readFileSync(path.join(root, 'analysis.js'), 'utf8');
    assert.equal((src.match(/waitForRuntime\([^\n]*signal, waitOpts\)/g) || []).length, 3, 'every generateRaw wait in callSt has the limit');
});
await test('7.7.4 audioOrError: JSON / HTML / text bodies are errors (not cached as audio), audio passes, untyped bytes are wrapped', async () => {
    const H = await import(pathToFileURL(path.join(root, 'providers/_http.js')).href);
    for (const [type, text] of [['application/json', '{"error":{"message":"quota"}}'], ['text/html; charset=utf-8', '<html>error code: 524</html>'], ['text/plain', 'Bad gateway']]) {
        const e = await fail(H.audioOrError(new Blob([text], { type })));
        assert.ok(e, type + ' rejected');
        assert.equal(e.retry, false, 'not retried: ' + type);
    }
    const wav = new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav' });
    assert.equal(await H.audioOrError(wav), wav);
    const bare = await H.audioOrError(new Blob([new Uint8Array([255, 251, 0, 0])]), 'audio/mpeg');
    assert.equal(bare.type, 'audio/mpeg');
    for (const f of ['cartesia.js', 'typecast.js', 'gtranslate.js', 'elevenlabs.js'])
        assert.ok((await import('node:fs')).readFileSync(path.join(root, 'providers', f), 'utf8').includes('await audioOrError('), f + ' uses audioOrError');
});

Date.now = realNow;
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
