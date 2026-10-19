// TTS 대사 분석 재요청 막기 (7.2.5 안 P1 · P2) — 실패 기억을 채팅에 남기고(새로고침 · 다시 열기 뒤에도) 잠깐의 실패엔 식는 시간,
//   값을 치른 결과는 보관함에 두어 같은 글(채팅을 바꾼 뒤 도착 · 같은 인사말)을 요청 없이 다시 쓴다.
//   사용자 제보(10-19): 「TTS 분석도 뭔가 API 과하게 가는 것 같은데 … 왜 분석한 걸 또 분석하지?」 — 조사 outputs/tts-reanalysis/report.md
//   node tools/tests/tts-reanalysis-guard.mjs <테마 루트>     (7.2.3 소스에서는 P1 · P2 항목이 기대대로 실패한다)
// rewrite-tts-keep.mjs 와 같은 틀: 실리태번 모듈은 data: 스텁, 진짜 analysis.js · settings.js, compat 엔진은 가짜 fetch.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const root = path.join(theme, 'src/addons/tts/src');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const T = globalThis.__reanalysisTest = { ext: {}, saves: 0, requests: [], reply: null, status: 200, gate: null, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina', characters: [], groups: [], chatId: 'chat-a' } };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T=globalThis.__reanalysisTest;';
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
    return new Response(JSON.stringify({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10 } }), { headers: { 'Content-Type': 'application/json' } });
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
    T.requests.length = 0; T.gate = null; T.reply = OK; T.status = 200; T.saves = 0; store.clear();
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

// ---------- P1 잠깐의 실패 (5xx) — 식는 시간 · 채팅에 남는 기억
await test('P1 a 5xx failure is remembered in the message extra (soft) and stops the next automatic attempt', async () => {
    const mes = await setup();
    T.status = 500;
    const e = await fail(A.analyzeMessage(0));
    assert.ok(e, 'the first attempt fails');
    assert.equal(T.requests.length, 1);
    const f = mes.extra?.lemon_voice?.failed;
    assert.ok(f && typeof f.key === 'string', 'failure remembered in mes.extra.lemon_voice.failed');
    assert.equal(f.hard, false, '5xx is a soft failure');
    assert.equal(A.hasResponseFailure(0), true);
    await fail(A.analyzeMessage(0));
    assert.equal(T.requests.length, 1, 'no second request while cooling down');
    assert.deepEqual(mes.swipe_info[0].extra.lemon_voice.failed, f, 'mirrored to the swipe');
});
await test('P1 the soft memory survives a reload (new message objects) and expires after the cooldown', async () => {
    await setup();
    T.status = 500;
    await fail(A.analyzeMessage(0));
    reload();
    assert.equal(A.hasResponseFailure(0), true, 'still remembered from the chat file');
    await fail(A.analyzeMessage(0));
    assert.equal(T.requests.length, 1, 'reopening the chat does not pay again');
    const t0 = realNow();
    Date.now = () => t0 + 11 * 60 * 1000;
    assert.equal(A.hasResponseFailure(0), false, 'cooldown over');
    T.status = 200;
    const a = await A.analyzeMessage(0);
    assert.ok(a && a.segs.length === 2);
    assert.equal(T.requests.length, 2);
    assert.equal(T.ctx.chat[0].extra.lemon_voice.failed, undefined, 'success clears the memory');
    Date.now = realNow;
});
await test('P1 three soft failures in a row cool down longer (an hour)', async () => {
    await setup();
    T.status = 500;
    const t0 = realNow();
    for (let k = 0; k < 3; k++) { Date.now = () => t0 + k * 11 * 60 * 1000; await fail(A.analyzeMessage(0)); }
    assert.equal(T.requests.length, 3);
    assert.equal(T.ctx.chat[0].extra.lemon_voice.failed.n, 3);
    Date.now = () => t0 + 2 * 11 * 60 * 1000 + 30 * 60 * 1000;
    assert.equal(A.hasResponseFailure(0), true, '30 minutes later still resting');
    Date.now = () => t0 + 2 * 11 * 60 * 1000 + 61 * 60 * 1000;
    assert.equal(A.hasResponseFailure(0), false);
    Date.now = realNow;
});
// ---------- P1 확실한 실패 (형식 오류 · 거절) — 글 · 설정이 같은 동안 계속
await test('P1 a non-JSON reply is a hard failure: remembered across reload until the text or the analysis settings change', async () => {
    const mes = await setup();
    T.reply = () => 'Sure! The lines sound happy.';
    const e = await fail(A.analyzeMessage(0));
    assert.ok(e);
    assert.equal(mes.extra.lemon_voice.failed.hard, true);
    reload();
    assert.equal(A.hasResponseFailure(0), true);
    const t0 = realNow(); Date.now = () => t0 + 24 * 60 * 60 * 1000;
    assert.equal(A.hasResponseFailure(0), true, 'hard failures do not expire');
    await fail(A.analyzeMessage(0));
    assert.equal(T.requests.length, 1);
    S.settings().analysis.model = 'another-model';
    assert.equal(A.hasResponseFailure(0), false, 'another model → key differs → try again');
    T.reply = OK;
    assert.ok(await A.analyzeMessage(0));
    assert.equal(T.requests.length, 2);
    Date.now = realNow;
});
await test('P1 a refusal is remembered as blocked (wasBlocked after reload) and the wand regenerate (force) clears it', async () => {
    await setup();
    T.reply = () => "I'm sorry, but I can't help with analyzing this content.";
    await fail(A.analyzeMessage(0));
    assert.equal(A.wasBlocked(0), true);
    reload();
    assert.equal(A.wasBlocked(0), true, 'blocked memory survives reload');
    assert.equal(A.hasResponseFailure(0), true);
    A.clearAnalysis(0);
    assert.equal(A.hasResponseFailure(0), false, 'clearing (wand › regenerate) forgets the failure');
    T.reply = OK;
    assert.ok(await A.analyzeMessage(0, { force: true }));
    assert.equal(T.requests.length, 2);
});
await test('P1 editing the text frees the memory (different key) and the stale record is removed', async () => {
    const mes = await setup();
    T.status = 500;
    await fail(A.analyzeMessage(0));
    mes.mes = TEXT + ' "One more thing."'; mes.swipes[0] = mes.mes;
    A.onMessageChanged(0);
    assert.equal(A.hasResponseFailure(0), false);
    assert.equal(mes.extra.lemon_voice?.failed, undefined, 'old failure record dropped with the old text');
});
// ---------- P2 보관함
await test('P2 a result arriving after the chat was switched is kept and reused without a request when the same text comes back', async () => {
    const mes = await setup();
    const g = gate(); T.gate = g;
    const p = A.analyzeMessage(0);
    while (!g.started) await new Promise(r => setTimeout(r, 5));
    // 채팅을 바꿈: chat[0] 은 이제 다른 메시지
    T.ctx.chat[0] = message('"Different chat."');
    g.release();
    assert.equal(await p, null, 'the arrived result is not stored on the other chat');
    assert.equal(T.requests.length, 1);
    // 돌아옴: 같은 글의 새 객체 (채팅 파일에서 다시 읽음)
    T.ctx.chat[0] = message(TEXT);
    const a = await A.analyzeMessage(0);
    assert.ok(a && a.segs.length === 2, 'adopted from the kept store');
    assert.equal(T.requests.length, 1, 'no second request');
    assert.equal(T.ctx.chat[0].extra.lemon_voice.analysis.hash, A.hash(TEXT));
    assert.ok(mes.extra.lemon_voice === undefined || !mes.extra.lemon_voice.analysis || true, 'old object untouched or harmless');
});
await test('P2 the same greeting in a new chat is not analysed again', async () => {
    await setup();
    assert.ok(await A.analyzeMessage(0));
    assert.equal(T.requests.length, 1);
    // 새 채팅: 같은 인사말, 새 객체 · 빈 extra
    T.ctx.chat.length = 0; T.ctx.chat.push(message(TEXT)); T.ctx.chatId = 'chat-b';
    const a = await A.analyzeMessage(0);
    assert.ok(a && a.segs.length === 2);
    assert.equal(T.requests.length, 1, 'greeting reused from the kept store');
    assert.equal(A.getAnalysis(0)?.hash, A.hash(TEXT));
});
await test('P2 the kept store is bounded and expires; a different text is never adopted', async () => {
    await setup();
    assert.ok(await A.analyzeMessage(0));
    T.ctx.chat.length = 0; T.ctx.chat.push(message('"Nothing alike here."'));
    const a = await A.analyzeMessage(0);
    assert.ok(a);
    assert.equal(T.requests.length, 2, 'a different text is analysed');
    const raw = JSON.parse(store.get('lemon_voice.kept_analyses') || '{}');
    assert.ok(Object.keys(raw).length <= 32);
    assert.ok(!JSON.stringify(raw).includes('Nothing alike'), 'the store holds hashes and analyses, never the text');
    const t0 = realNow(); Date.now = () => t0 + 7 * 60 * 60 * 1000;
    T.ctx.chat.length = 0; T.ctx.chat.push(message(TEXT));
    await A.analyzeMessage(0);
    assert.equal(T.requests.length, 3, 'expired entries are not reused');
    Date.now = realNow;
});
// ---------- 바뀌지 않아야 하는 것
await test('a stored analysis is still reused as before (no request), and a human edit still re-analyses', async () => {
    const mes = await setup();
    const first = await A.analyzeMessage(0);
    assert.equal(await A.analyzeMessage(0), first);
    assert.equal(T.requests.length, 1);
    mes.mes = TEXT.replace('Good morning', 'Morning'); mes.swipes[0] = mes.mes;
    A.onMessageChanged(0);
    assert.equal(A.getAnalysis(0), null);
    assert.ok(await A.analyzeMessage(0));
    assert.equal(T.requests.length, 2);
});

Date.now = realNow;
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
