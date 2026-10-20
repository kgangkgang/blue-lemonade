// 7.2.9 TTS 대사 분석 — 그림 자리 표시 · 그림 태그만 바뀐 답은 다시 분석하지 않는다 (사용자 10-20: 「문장마다 새로 분석하는거임? … 왜 뒤에 문장은 또 분석해??」)
//   그림을 붙이는 확장이 답 뒤(재생 중에도) 자리 표시를 덧붙이거나 그림 요청 태그를 그림으로 바꾸면 mes.mes 해시가 바뀌어 분석을 버렸고,
//   다음 대사를 누를 때 「분석 중…」으로 같은 답을 다시(유료) 물었다. 이제 소리로 읽는 글(speechText)의 열쇠(key)가 같으면 지금 글로 옮겨 단다.
//   + 기울임 보충(1.9.2)은 한 요청이 묻는 앞 40개 창에서만 — 40개가 넘는 긴 답은 줄을 읽을 때마다 보충을 또 보냈다.
//   node tools/tests/tts-picture-markers-729.mjs <테마 루트>
// tts-continue-reuse.mjs 와 같은 틀: 실리태번 모듈은 data: 스텁, 진짜 analysis.js · settings.js, compat 엔진은 가짜 fetch.
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

// ---------- 이 시험의 답: 물은 대사 줄마다 감정 · (?) 줄은 화자 · 기울임 조각은 속마음
const promptText = body => (body.messages || []).filter(m => m.role === 'user').map(m => m.content).join('\n');
const SMART = (body) => {
    const user = promptText(body);
    const asked = (/EVERY requested dialogue index: ([0-9, ]+)/.exec(user)?.[1] || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);
    const ask = new Set([...user.matchAll(/^\[(\d+)\] \(\?\) "/gm)].map(m => Number(m[1])));
    const italics = [...user.matchAll(/^\[\*(\d+)\] "/gm)].map(m => Number(m[1]));
    const out = { segs: asked.map(i => (ask.has(i) ? { i, emotion: 'happy', speaker: 'Mina' } : { i, emotion: 'happy' })) };
    if (italics.length) out.italics = italics.map(j => ({ j, kind: 'thought', speaker: 'Mina' }));
    return out;
};
// 그림 자리 표시 (text.js SLOT_RE 가 아는 모양 — 캐릭터 에셋의 빈 자리) · 그림 · 그림 요청 태그 · 마크다운 그림
const SLOT = k => `<span class="bl-asset-slot" data-asset-slot="slot-${k}">[image]</span>`;
const IMG = k => `<img src="/user/images/Mina/pic-${k}.png" title="harbor ${k}">`;
const PIC = k => `<pic prompt="harbor scene ${k}, lantern light">`;
const LONG = [
    'Mina stepped onto the wet pier. *The tide is early tonight,* she thought, frowning at the water.',
    '"You came after all," she said, setting the crate down beside Rex.',
    '"I promised, didn\'t I?" Rex answered with a tired grin.',
    'The gulls scattered over the pier as the lantern flickered. *He looks thinner than last winter.* She kept the thought to herself.',
    '"Careful with that one. It goes to the lighthouse keeper," Mina warned.',
    '"Then I\'ll make him smile," he said. "Watch me."',
].join('\n\n');
const edit = (mes, text) => { mes.mes = text; mes.swipes[0] = text; A.onMessageChanged(0); };

await test('speechText: picture slot markers, <img>, picture request tags and markdown pictures are not speech; the words are', () => {
    const base = '"Hello," she said.\n\nThe door slammed.';
    assert.equal(A.speechText(base), base);
    assert.equal(A.speechText(base + '\n\n' + SLOT(1)), base);
    assert.equal(A.speechText('"Hello," she said.\n\n' + PIC(1) + '\n\nThe door slammed.'), base);
    assert.equal(A.speechText('"Hello," she said.\n\n' + IMG(1) + '\n\nThe door slammed.'), base);
    assert.equal(A.speechText(base + '\n\n![harbor](/user/images/a.png)  \n'), base);
    assert.notEqual(A.speechText('"Hello there," she said.\n\nThe door slammed.'), base, 'a changed line is speech');
    assert.notEqual(A.speechText('"Hello," she said.\n\nThe door creaked.'), base, 'changed narration is speech (context · sound effects)');
});

await test('a picture slot marker appended after the analysis keeps the analysis (no second request), three times in a row', async () => {
    const mes = await setup(LONG);
    Object.assign(S.settings().analysis, { speaker: true }); S.settings().join_paragraph = true;
    T.reply = SMART;
    const first = await A.analyzeMessage(0);
    assert.ok(first && first.segs.length === 5, `dialogue lines ${first?.segs?.length}`);
    assert.equal(T.requests.length, 1);
    const italics = A.italicsOf(mes);
    assert.ok(Array.isArray(italics) && italics.length >= 1, 'italics answered once');
    let text = LONG;
    for (let k = 1; k <= 3; k++) {
        text += '\n\n' + SLOT(k);
        edit(mes, text);
        const a = A.getAnalysis(0);
        assert.ok(a, `analysis kept after marker ${k}`);
        assert.equal(a.hash, A.hash(text), 'moved to the current text');
        assert.equal(a.key, A.speechKey(mes));
        await A.analyzeMessage(0);   // 누른 줄 · 다음 줄 읽기마다 부르는 것과 같다
        assert.deepEqual(A.italicsOf(mes), italics, 'italics still apply');
    }
    assert.equal(T.requests.length, 1, 'one reply = one analysis request');
});

await test('picture request tags turned into pictures in the middle of the reply keep the analysis', async () => {
    const parts = LONG.split('\n\n');
    let text = [parts[0], PIC(1), ...parts.slice(1, 4), PIC(2), ...parts.slice(4)].join('\n\n');
    const mes = await setup(text);
    Object.assign(S.settings().analysis, { speaker: true }); S.settings().join_paragraph = true;
    T.reply = SMART;
    await A.analyzeMessage(0);
    for (const k of [1, 2]) { text = text.replace(PIC(k), IMG(k)); edit(mes, text); assert.ok(A.getAnalysis(0), `kept after picture ${k}`); await A.analyzeMessage(0); }
    assert.equal(T.requests.length, 1);
});

await test('a marker written while the request is in flight: the answer is kept for the current text (no abort, no second request)', async () => {
    const mes = await setup(LONG);
    Object.assign(S.settings().analysis, { speaker: true }); S.settings().join_paragraph = true;
    T.reply = SMART; T.gate = gate();
    const p = A.analyzeMessage(0);
    while (!T.gate.started) await wait(5);
    edit(mes, LONG + '\n\n' + SLOT(1));
    T.gate.release();
    const a = await p;
    assert.ok(a, 'the paid answer is not thrown away');
    assert.equal(A.getAnalysis(0)?.hash, A.hash(mes.mes));
    await A.analyzeMessage(0);
    assert.equal(T.requests.length, 1);
});

await test('reload after the marker (saved JSON, fresh objects) still needs no request; an analysis saved before 7.2.9 (no key) gets one while its text is unchanged', async () => {
    let mes = await setup(LONG);
    Object.assign(S.settings().analysis, { speaker: true }); S.settings().join_paragraph = true;
    T.reply = SMART;
    await A.analyzeMessage(0);
    delete mes.extra.lemon_voice.analysis.key;   // 7.2.8 까지 저장된 모양
    mes = reload();
    assert.ok(A.getAnalysis(0), 'old analysis still matches its text');
    assert.equal(typeof mes.extra.lemon_voice.analysis.key, 'string', 'key written on first use');
    edit(mes, LONG + '\n\n' + SLOT(1));
    mes = reload();
    assert.ok(A.getAnalysis(0), 'kept after reload');
    await A.analyzeMessage(0);
    assert.equal(T.requests.length, 1);
});

await test('a real change to what is spoken still re-analyses (dialogue edit), and a marker on another swipe text does not carry over', async () => {
    const mes = await setup(LONG);
    Object.assign(S.settings().analysis, { speaker: true }); S.settings().join_paragraph = true;
    T.reply = SMART;
    await A.analyzeMessage(0);
    edit(mes, LONG.replace('You came after all', 'You came back after all') + '\n\n' + SLOT(1));
    assert.equal(A.getAnalysis(0), null, 'speech changed → old analysis is not used');
    await A.analyzeMessage(0);
    assert.equal(T.requests.length, 2);
});

await test('one long reply with italics: the italics-only supplement is not sent per line (analyse once, then call per line)', async () => {
    const mes = await setup(LONG);
    Object.assign(S.settings().analysis, { speaker: true }); S.settings().join_paragraph = true;
    T.reply = SMART;
    for (let k = 0; k < 8; k++) await A.analyzeMessage(0);
    assert.equal(T.requests.length, 1);
    assert.ok(A.italicsOf(mes)?.length >= 1);
});


await test('a reply with more italic fragments than one request asks (40): the rest is not asked line by line in italics-only follow-ups', async () => {
    const paras = [];
    for (let k = 0; k < 26; k++) paras.push(`The rain kept falling on the pier, round ${k}. *Step ${k} forward.* She looked back once. *Hold ${k} still.*`, `"Line ${k} is here," Mina said.`);
    const mes = await setup(paras.join('\n\n'));
    Object.assign(S.settings().analysis, { speaker: true }); S.settings().join_paragraph = true;
    T.reply = SMART;
    for (let k = 0; k < 6; k++) await A.analyzeMessage(0);   // 줄마다 부름
    assert.equal(T.requests.length, 1, `requests ${T.requests.length}`);
    assert.equal(A.italicsToFill(mes, A.getAnalysis(0)).length, 0);
});

Date.now = realNow;
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
