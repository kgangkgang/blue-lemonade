// 7.2.6 TTS 대사 분석 — 이어 쓰기(continue) 때 앞줄의 감정 · 화자 재사용(tts-reanalysis P4) · 분석 저장을 5초 모아서(api-audit #7) · 스와이프 해시 불일치는 저장 없음(#10)
//   글이 뒤로 늘기만 했으면 옛 분석의 줄(순번 · 해시)은 그대로 두고 새 줄만 묻는다. 서술만 늘었으면 요청 0. 가운데가 바뀌면 전처럼 전체.
//   node tools/tests/tts-continue-reuse.mjs <테마 루트>
// tts-reanalysis-guard.mjs 와 같은 틀: 실리태번 모듈은 data: 스텁, 진짜 analysis.js · settings.js, compat 엔진은 가짜 fetch.
//
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

const promptLines = body => (body.messages || []).filter(m => m.role === 'user').map(m => m.content).join('\n').split('\n').filter(l => /^\[\d+\]/.test(l));
const STORE_MS = A.STORE_SAVE_MS;
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- P4 이어 쓰기: 앞줄 재사용
await test('P4 continue: a line appended at the end asks only the new line; the old lines keep their emotion', async () => {
    const mes = await setup();
    const first = await A.analyzeMessage(0);
    assert.ok(first && first.segs.length === 2);
    assert.equal(T.requests.length, 1);
    assert.deepEqual(promptLines(T.requests[0]).map(l => l.slice(0, 3)), ['[0]', '[1]']);
    mes.mes = TEXT + ' She laughed. "One more thing before breakfast." He waited.'; mes.swipes[0] = mes.mes;
    A.onMessageChanged(0);
    assert.equal(A.getAnalysis(0), null, 'the hash changed');
    T.reply = () => ({ segs: [{ i: 2, emotion: 'surprised' }] });
    const next = await A.analyzeMessage(0);
    assert.equal(T.requests.length, 2);
    assert.deepEqual(promptLines(T.requests[1]).map(l => l.slice(0, 3)), ['[2]'], 'only the appended line is asked');
    assert.ok(/EVERY requested dialogue index: 2\./.test(T.requests[1].messages.at(-1).content));
    assert.deepEqual(next.segs.map(g => [g.i, g.emotion]), [[0, 'happy'], [1, 'calm'], [2, 'surprised']]);
    assert.equal(next.hash, A.hash(mes.mes));
    assert.equal(A.getAnalysis(0), next);
});
await test('P4 continue with narration only (no new dialogue) stores the moved analysis without any request', async () => {
    const mes = await setup();
    await A.analyzeMessage(0);
    assert.equal(T.requests.length, 1);
    mes.mes = TEXT + ' The kettle whistled in the kitchen.'; mes.swipes[0] = mes.mes;
    A.onMessageChanged(0);
    const a = await A.analyzeMessage(0);
    assert.equal(T.requests.length, 1, 'no request');
    assert.deepEqual(a.segs.map(g => [g.i, g.emotion]), [[0, 'happy'], [1, 'calm']]);
    assert.equal(a.hash, A.hash(mes.mes));
    assert.equal(A.getAnalysis(0)?.hash, A.hash(mes.mes));
});
await test('P4 a change in the middle (not a pure append) still re-analyses everything, and an unrelated swipe text too', async () => {
    const mes = await setup();
    await A.analyzeMessage(0);
    mes.mes = TEXT.replace('Good morning', 'Morning') + ' "Extra."'; mes.swipes[0] = mes.mes;
    A.onMessageChanged(0);
    T.reply = () => ({ segs: [{ i: 0, emotion: 'happy' }, { i: 1, emotion: 'calm' }, { i: 2, emotion: 'sad' }] });
    const a = await A.analyzeMessage(0);
    assert.equal(T.requests.length, 2);
    assert.deepEqual(promptLines(T.requests[1]).map(l => l.slice(0, 3)), ['[0]', '[1]', '[2]'], 'all lines asked');
    assert.equal(a.segs.length, 3);
});
await test('P4 the reused lines keep their speaker and translation; the reply for a known index is ignored', async () => {
    const mes = await setup();
    S.settings().analysis.speaker = true;
    T.reply = () => ({ segs: [{ i: 0, emotion: 'happy', speaker: 'Mina' }, { i: 1, emotion: 'calm', speaker: 'User' }] });
    const first = await A.analyzeMessage(0);
    assert.ok(first);
    first.segs[0].text = { ja: 'おはよう' };   // 들은 언어 번역이 있었던 것처럼
    mes.mes = TEXT + ' "Shall we go?"'; mes.swipes[0] = mes.mes;
    A.onMessageChanged(0);
    T.reply = () => ({ segs: [{ i: 0, emotion: 'angry' }, { i: 2, emotion: 'happy', speaker: 'Mina' }] });
    const a = await A.analyzeMessage(0);
    assert.equal(T.requests.length, 2);
    assert.equal(a.segs[0].emotion, 'happy', 'known line keeps its emotion even if the model returned one');
    assert.deepEqual(a.segs[0].text, { ja: 'おはよう' });
    assert.equal(a.segs[2].emotion, 'happy');
    S.settings().analysis.speaker = false;
});

// ---------- #7 저장 디바운스 · #10 스와이프 저장 없음
await test('#7 a finished analysis is saved once, a few seconds later (two analyses inside the window share one save)', async () => {
    await setup();
    T.ctx.chat.push(message('"Second message here." She nodded.'));
    assert.equal(STORE_MS, 5000);
    await A.analyzeMessage(0);
    assert.equal(T.saves, 0, 'not saved right away');
    await A.analyzeMessage(1);
    assert.equal(T.requests.length, 2);
    await wait(STORE_MS + 400);
    assert.equal(T.saves, 1, 'one save for both');
    assert.ok(T.ctx.chat[0].extra.lemon_voice.analysis && T.ctx.chat[1].extra.lemon_voice.analysis);
});
await test('#10 a swipe whose extra carries an analysis of another text drops it in memory only (no save)', async () => {
    const mes = await setup();
    await A.analyzeMessage(0);
    await wait(STORE_MS + 400);
    assert.equal(T.saves, 1);
    // 스와이프: 글이 바뀌고 extra 에는 옛 글의 분석이 남아 있다
    mes.mes = '"A completely different swipe." She frowned.'; mes.swipe_id = 1; mes.swipes.push(mes.mes); mes.swipe_info.push({ extra: {} });
    A.onMessageChanged(0);
    assert.equal(mes.extra.lemon_voice?.analysis, undefined, 'dropped in memory');
    await wait(1500);
    assert.equal(T.saves, 1, 'no extra chat save for the mismatch');
});

Date.now = realNow;
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
