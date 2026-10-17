// 테마 6.1.7 (TTS 1.7.0 · 다시 쓰기 2.0.3) 다시 쓰기로 고친 글은 TTS 대사 분석을 버리지 않고 이어 쓴다 — 사람이 고친 글은 지금처럼 다시 분석.
// 출처 표시(src/edit-origin.js) · 줄 맞추기(moveAnalysis) · 바뀐 줄만 다시 옮기기 · 맞추기 실패면 지움 · 사람 편집은 지움 · 보낸 요청은 받아서 옮김 · 다시 쓰기 연결.
// 실제 analysis.js · settings.js · text.js 에 실리태번과 통신만 흉내 (계정 · 목소리 · 사용자 데이터 없음).
//   node tools/tests/rewrite-tts-keep.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const root = path.join(theme, 'src/addons/tts/src');
const read = rel => fs.readFileSync(path.join(theme, rel), 'utf8');
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const T = globalThis.__rewriteKeepTest = { ext: {}, saves: 0, requests: [], reply: null, gate: null, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina', characters: [], groups: [] } };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T=globalThis.__rewriteKeepTest;';
const stubs = {
    'script.js': data(G + `export const chat=T.ctx.chat; export const event_types={}; export const eventSource={on(){},makeLast(){},emit(){},removeListener(){}};
export const substituteParams=t=>String(t??''); export const getRequestHeaders=()=>({}); export function saveSettingsDebounced(){} export async function saveSettings(){}
export function syncMesToSwipe(){} export const main_api='openai'; export function generateRaw(){throw Error('Unexpected LLM')}`),
    'extensions.js': data(G + 'export const extension_settings=T.ext; export const extensionNames=[]; export const getContext=()=>T.ctx; export function saveMetadataDebounced(){}'),
    'utils.js': data('export const getStringHash=s=>String(s).length; export const splitRecursive=t=>[String(t??"")];'),
    'secrets.js': data('export const secret_state={};'),
    'popup.js': data('export const POPUP_TYPE={TEXT:1,CONFIRM:2,INPUT:3}; export const POPUP_RESULT={AFFIRMATIVE:1,NEGATIVE:0,CANCELLED:null}; export async function callGenericPopup(){throw Error("Unexpected popup")} export function fixToastrForDialogs(){}'),
};
register(data(`let D;export function initialize(d){D=d}export async function resolve(spec,ctx,next){const base=spec.split('/').pop();if(String(ctx.parentURL||'').includes('/addons/tts/')&&spec.split('../').length>3&&D[base])return {url:D[base],shortCircuit:true};return next(spec,ctx)}`), { data: stubs });
globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), 'https://mock.invalid/v1/chat/completions');
    const body = JSON.parse(init.body); T.requests.push(body);
    if (T.gate) { T.gate.started = true; await T.gate.promise; }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(T.reply(body)) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }));
};
const O = await import(pathToFileURL(path.join(theme, 'src/edit-origin.js')).href);
const A = await import(pathToFileURL(path.join(root, 'analysis.js')).href);
const S = await import(pathToFileURL(path.join(root, 'settings.js')).href);
const L = await import(pathToFileURL(path.join(root, 'sfx-library.js')).href);

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function gate() { let release; const promise = new Promise(r => { release = r; }); return { promise, release, started: false }; }

const BEFORE = '"Good morning." She stretched and yawned. "Did you sleep well?" He nodded. "Let us eat."';
const REWRITTEN = '"Good morning." She stretched lazily. "Did you rest well?" He nodded. "Let us eat."';
const FULL = () => ({ segs: [{ i: 0, emotion: 'happy', ja: 'おはよう。' }, { i: 1, emotion: 'calm', ja: 'よく眠れた？' }, { i: 2, emotion: 'happy', ja: '食べよう。' }] });
const prompt = n => T.requests[n].messages.at(-1).content;
async function setup(text = BEFORE) {
    T.requests.length = 0; T.gate = null; T.reply = FULL;
    Object.assign(S.settings(), { enabled: true, extras: 'off', voices: [], sfx: { ...(S.settings().sfx || {}), enabled: false, auto: false, custom: [] } });
    Object.assign(S.settings().analysis, { enabled: true, engine: 'compat', base: 'https://mock.invalid/v1', key: 'mock-only', model: 'm', emotion: true, translate: true, speaker: false, context_chars: 1200, when: 'auto' });
    A.clearAnalysis('chat');
    T.ctx.chat.length = 0;
    T.ctx.chat.push({ mes: text, name: 'Mina', is_user: false, is_system: false, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });
    return T.ctx.chat[0];
}
/** 다시 쓰기가 하는 순서 그대로: 글을 바꾸고 → 표시 → 알림 (index.js cleanMessage) */
function rewrite(mes, after, { notify = true, mark = true } = {}) {
    const before = mes.mes;
    mes.mes = after; mes.swipes[0] = after;
    if (mark) O.markRewrite(mes, before, after);
    if (notify) A.onMessageChanged(0);
}

// ---------- 출처 표시 (src/edit-origin.js)
await test('origin hash is the same FNV-1a base36 as the TTS analysis hash', () => {
    for (const s of ['', 'abc', BEFORE, '안녕 "하세요" 「대사」', 'emoji 😀 and\nnew line']) assert.equal(O.originHash(s), A.hash(s), JSON.stringify(s));
});
await test('markRewrite: hash pairs only, newest four, copied to the swipe extra; no-ops are not marked', () => {
    const mes = { mes: 'x', swipe_id: 0, swipe_info: [{ extra: {} }] };
    assert.equal(O.markRewrite(mes, 'same', 'same'), false);
    assert.equal(O.markRewrite(mes, 1, 'x'), false);
    assert.equal(O.markRewrite(null, 'a', 'b'), false);
    assert.equal(mes.extra, undefined, 'nothing written for a no-op');
    for (const [a, b] of [['t1', 't2'], ['t2', 't3'], ['t3', 't4'], ['t4', 't5'], ['t5', 't6']]) assert.equal(O.markRewrite(mes, a, b), true);
    assert.equal(mes.extra[O.REWRITE_KEY].length, O.REWRITE_LINKS);
    assert.deepEqual(mes.extra[O.REWRITE_KEY][0], [O.originHash('t2'), O.originHash('t3')]);
    assert.deepEqual(mes.swipe_info[0].extra[O.REWRITE_KEY], mes.extra[O.REWRITE_KEY]);
    assert.notEqual(mes.swipe_info[0].extra[O.REWRITE_KEY], mes.extra[O.REWRITE_KEY], 'a copy, not the same array');
    assert.ok(!JSON.stringify(mes.extra).includes('t2'), 'only hashes are stored, never the text');
});
await test('rewriteLinked follows rewrite hops in order; a human edit between them breaks the chain', () => {
    const h = O.originHash;
    const mes = { extra: {} };
    O.markRewrite(mes, 'one', 'two'); O.markRewrite(mes, 'two', 'three');
    assert.equal(O.rewriteLinked(mes, h('one'), h('two')), true);
    assert.equal(O.rewriteLinked(mes, h('one'), h('three')), true, 'two rewrites in a row');
    assert.equal(O.rewriteLinked(mes, h('two'), h('three')), true, 'after TTS already moved to the first rewrite');
    assert.equal(O.rewriteLinked(mes, h('three'), h('one')), false, 'never backwards');
    assert.equal(O.rewriteLinked(mes, h('one'), h('one')), false);
    assert.equal(O.rewriteLinked(mes, '', h('two')), false);
    const human = { extra: {} };
    O.markRewrite(human, 'one', 'two'); O.markRewrite(human, 'two (hand edit)', 'three');
    assert.equal(O.rewriteLinked(human, h('one'), h('three')), false, 'hand edit two → two (hand edit) is not a rewrite hop');
    assert.equal(O.rewriteLinked({ extra: { [O.REWRITE_KEY]: 'broken' } }, h('one'), h('two')), false);
    assert.equal(O.rewriteLinked({}, h('one'), h('two')), false);
});

// ---------- 줄 맞추기 (순수 함수)
await test('moveAnalysis keeps unchanged lines as they are and keeps speaker/emotion of a changed line, emptying only its translation', () => {
    const old = { hash: 'old', swipe: 0, langs: ['en', 'ja'], model: 'm', sfx: [{ after: 1, id: 'door_slam' }], people: { Kai: { g: 'm', a: 'a', l: 'ko' } },
        segs: [{ i: 0, h: 'a', emotion: 'happy', text: { ja: 'A' } }, { i: 1, h: 'b', emotion: 'sad', speaker: 'Kai', text: { ja: 'B', en: 'B!' } }, { i: 2, h: 'c', emotion: '', text: {} }] };
    const r = A.moveAnalysis(old, [{ i: 0, h: 'a' }, { i: 1, h: 'b2' }, { i: 2, h: 'c' }], 'new');
    assert.equal(r.changed, 1);
    assert.deepEqual(r.refill, ['en', 'ja']);
    assert.equal(r.analysis.hash, 'new');
    assert.deepEqual(r.analysis.langs, ['en', 'ja'], 'finished languages stay finished for the unchanged lines');
    assert.deepEqual(r.analysis.redo, { en: [1], ja: [1] }, 'the changed line is re-asked in every finished language (that line only)');
    assert.equal(A.analysisCovers(r.analysis, ['ja']), false);
    assert.equal(A.analysisCovers(r.analysis, []), true, 'nothing wanted → nothing to ask');
    assert.equal(r.analysis.segs[0], old.segs[0]);
    assert.equal(r.analysis.segs[2], old.segs[2]);
    assert.deepEqual(r.analysis.segs[1], { i: 1, h: 'b2', emotion: 'sad', speaker: 'Kai', text: {} });
    assert.equal(r.analysis.sfx, old.sfx, 'sound cues stay (positions count dialogue lines, unchanged)');
    assert.equal(r.analysis.people, old.people);
    assert.equal(old.hash, 'old', 'the old analysis is not mutated');
    const narrationOnly = A.moveAnalysis(old, [{ i: 0, h: 'a' }, { i: 1, h: 'b' }, { i: 2, h: 'c' }], 'n2');
    assert.equal(narrationOnly.changed, 0);
    assert.deepEqual(narrationOnly.analysis.langs, ['en', 'ja'], 'only narration changed → nothing to ask');
    assert.equal('redo' in narrationOnly.analysis, false);
    assert.equal(A.analysisCovers(narrationOnly.analysis, ['ja']), true);
    const echo = A.moveAnalysis({ ...old, segs: [old.segs[0], old.segs[1], { i: 2, h: 'c', emotion: '', text: {} }] }, [{ i: 0, h: 'a' }, { i: 1, h: 'b' }, { i: 2, h: 'c2' }], 'n3');
    assert.deepEqual(echo.analysis.redo, { en: [2], ja: [2] }, 'a changed line whose old translation was empty (echo of the source) is asked again too');
    const twice = A.moveAnalysis(r.analysis, [{ i: 0, h: 'a2' }, { i: 1, h: 'b2' }, { i: 2, h: 'c' }], 'n4');
    assert.deepEqual(twice.analysis.redo, { en: [0, 1], ja: [0, 1] }, 'a second rewrite before the refill keeps the first changed line in the list');
});
await test('moveAnalysis refuses a different structure (line count or order) → the caller drops as before', () => {
    const old = { hash: 'old', langs: [], segs: [{ i: 0, h: 'a', text: {} }, { i: 1, h: 'b', text: {} }] };
    assert.equal(A.moveAnalysis(old, [{ i: 0, h: 'a' }], 'n'), null, 'a line fewer');
    assert.equal(A.moveAnalysis(old, [{ i: 0, h: 'a' }, { i: 1, h: 'b' }, { i: 2, h: 'c' }], 'n'), null, 'a line more');
    assert.equal(A.moveAnalysis({ ...old, segs: [old.segs[1], old.segs[0]] }, [{ i: 0, h: 'a' }, { i: 1, h: 'b' }], 'n'), null, 'segments out of order');
    assert.equal(A.moveAnalysis(null, [], 'n'), null);
    assert.equal(A.moveAnalysis(old, [{ i: 0, h: 'a' }, { i: 1, h: 'b' }], ''), null);
});

// ---------- 실제 흐름 (analysis.js)
await test('rewrite → analysis kept on the new text with no request; the next play asks only the changed line for its translation', async () => {
    const mes = await setup();
    const first = await A.analyzeMessage(0, { langs: ['ja'] });
    assert.equal(T.requests.length, 1);
    assert.deepEqual(first.segs.map(g => g.emotion), ['happy', 'calm', 'happy']);
    rewrite(mes, REWRITTEN);
    const kept = A.getAnalysis(0);
    assert.ok(kept, 'not dropped');
    assert.equal(kept.hash, A.hash(REWRITTEN));
    assert.equal(T.requests.length, 1, 'no request on the rewrite itself');
    assert.equal(kept.segs[0], first.segs[0]);
    assert.equal(kept.segs[2], first.segs[2]);
    assert.equal(kept.segs[1].emotion, 'calm');
    assert.equal(kept.segs[1].h, A.hash(A.normText('Did you rest well?')));
    assert.deepEqual(kept.segs[1].text, {});
    assert.deepEqual(kept.langs, ['ja']);
    assert.deepEqual(kept.redo, { ja: [1] });
    T.reply = () => ({ segs: [{ i: 1, ja: 'よく休めた？' }] });
    const filled = await A.analyzeMessage(0, { langs: ['ja'] });
    assert.equal(T.requests.length, 2);
    const asked = prompt(1);
    assert.equal((asked.match(/→ needs: ja/g) || []).length, 1, asked);
    assert.match(asked, /\[1\] (?:\(Mina\) )?"Did you rest well\?"\s+→ needs: ja/);
    assert.ok(!asked.includes('give "emotion"') && !asked.includes('"sfx"'), 'no emotion · sound effect task, translation only');
    assert.deepEqual(filled.langs, ['ja']);
    assert.equal('redo' in filled, false, 'the refill clears the redo list');
    assert.deepEqual(filled.segs.map(g => g.text.ja), ['おはよう。', 'よく休めた？', '食べよう。']);
    assert.deepEqual(filled.segs.map(g => g.emotion), ['happy', 'calm', 'happy'], 'emotions kept through the refill');
    assert.equal(await A.analyzeMessage(0, { langs: ['ja'] }), filled);
    assert.equal(T.requests.length, 2);
});
await test('a rewrite that changes only narration costs nothing at all', async () => {
    const mes = await setup();
    const first = await A.analyzeMessage(0, { langs: ['ja'] });
    rewrite(mes, BEFORE.replace('and yawned', 'with a yawn'));
    const kept = await A.analyzeMessage(0, { langs: ['ja'] });
    assert.equal(T.requests.length, 1);
    assert.deepEqual(kept.segs, first.segs);
    assert.deepEqual(kept.langs, ['ja']);
});
await test('two rewrites in a row (and one the TTS missed) still follow; a hand edit after them drops as before', async () => {
    const mes = await setup();
    await A.analyzeMessage(0, { langs: ['ja'] });
    rewrite(mes, REWRITTEN);
    rewrite(mes, REWRITTEN.replace('lazily', 'slowly'), { notify: false });   // 자동 다시 쓰기는 따로 알리지 않는다 · TTS 가 꺼져 있던 때
    const lazy = A.getAnalysis(0);
    assert.ok(lazy && lazy.hash === A.hash(mes.mes), 'followed on read');
    assert.equal(T.requests.length, 1);
    rewrite(mes, mes.mes.replace('Good morning.', 'Morning!'), { mark: false });   // 실리태번 편집
    assert.equal(A.getAnalysis(0), null);
    assert.equal(mes.extra.lemon_voice?.analysis, undefined, 'dropped like any hand edit');
});
await test('a hand edit (no mark) still drops and re-analyses the whole message', async () => {
    const mes = await setup();
    await A.analyzeMessage(0, { langs: ['ja'] });
    rewrite(mes, REWRITTEN, { mark: false });
    assert.equal(A.getAnalysis(0), null);
    await A.analyzeMessage(0, { langs: ['ja'] });
    assert.equal(T.requests.length, 2);
    assert.match(prompt(1), /give "emotion"/, 'full analysis again');
});
await test('a rewrite that changes the number of dialogue lines cannot be matched → dropped as before', async () => {
    const mes = await setup();
    await A.analyzeMessage(0, { langs: ['ja'] });
    rewrite(mes, BEFORE.replace('He nodded.', 'He nodded. "Yes."'));
    assert.equal(A.getAnalysis(0), null);
    assert.equal(mes.extra.lemon_voice?.analysis, undefined);
});
await test('another swipe’s analysis is never moved onto this swipe (the stored analysis keeps its own text)', async () => {
    const mes = await setup();
    await A.analyzeMessage(0, { langs: ['ja'] });
    // 실리태번 스와이프처럼: 다른 스와이프로 넘어가 그 글을 다시 쓰기가 고침 — 옛 스와이프(0)의 분석은 extra 에 남아 있다
    // 스와이프 1 이 같은 글이어도 (그래서 다시 쓰기 고리는 이어져도) 스와이프 0 의 분석은 옮기지 않는다 — 막는 것은 스와이프 확인뿐
    mes.swipes = [BEFORE, BEFORE]; mes.swipe_info = [{ extra: {} }, { extra: {} }];
    mes.swipe_id = 1; mes.mes = mes.swipes[1];
    rewrite(mes, REWRITTEN, { notify: false });
    assert.equal(O.rewriteLinked(mes, A.hash(BEFORE), A.hash(REWRITTEN)), true);
    assert.equal(A.getAnalysis(0), null);
    assert.equal(mes.extra.lemon_voice?.analysis?.hash, A.hash(BEFORE), 'not moved onto swipe 1');
});
await test('hand-placed sound effects follow the rewrite (positions unchanged)', async () => {
    const mes = await setup();
    const id = L.listSfx().find(x => x && L.getSfx(x.id))?.id;
    assert.ok(id, 'a built-in sound exists');
    assert.equal(A.addManualSfx(0, 1, id), true);
    rewrite(mes, REWRITTEN);
    assert.deepEqual(A.manualSfx(0).map(c => [c.after, c.id]), [[1, L.resolveSfxId(id, { lib: L.SFX_LIB })]]);
    assert.equal(mes.extra.lemon_voice.manual.h, A.hash(REWRITTEN));
    rewrite(mes, mes.mes + ' (hand)', { mark: false });
    assert.deepEqual(A.manualSfx(0), [], 'a hand edit still discards them');
});
await test('a request already sent for the old text is kept and moved when a rewrite lands meanwhile', async () => {
    const mes = await setup();
    const g = gate(); T.gate = g;
    const pending = A.analyzeMessage(0, { langs: ['ja'] });
    for (let k = 0; k < 200 && !g.started; k++) await sleep(5);
    assert.ok(g.started, 'request sent');
    rewrite(mes, REWRITTEN);
    g.release();
    const result = await pending;
    assert.ok(result, 'not thrown away');
    assert.equal(result.hash, A.hash(REWRITTEN));
    assert.deepEqual(result.segs.map(s => s.emotion), ['happy', 'calm', 'happy']);
    assert.deepEqual(result.segs[1].text, {});
    assert.equal(A.getAnalysis(0), result);
    assert.equal(T.requests.length, 1);
});
await test('a hand edit while the request is out aborts and discards it, as before', async () => {
    const mes = await setup();
    const g = gate(); T.gate = g;
    const pending = A.analyzeMessage(0, { langs: ['ja'] });
    for (let k = 0; k < 200 && !g.started; k++) await sleep(5);
    rewrite(mes, REWRITTEN, { mark: false });
    g.release();
    await assert.rejects(pending, e => e?.name === 'AbortError');
    assert.equal(A.getAnalysis(0), null);
});

// ---------- 리뷰 뒤 (6.1.7)
const ECHO = '"OK!" She nodded. "Did you sleep well?"';
await test('an unchanged line whose translation equals the source is not re-asked; a changed one is', async () => {
    const mes = await setup(ECHO);
    T.reply = () => ({ segs: [{ i: 0, emotion: 'happy', ja: 'OK!' }, { i: 1, emotion: 'calm', ja: 'よく眠れた？' }] });
    const first = await A.analyzeMessage(0, { langs: ['ja'] });
    assert.deepEqual(first.segs[0].text, {}, 'the echoed translation is not stored');
    rewrite(mes, '"OK!" She nodded. "Did you rest well?"');
    T.reply = () => ({ segs: [{ i: 1, ja: 'よく休めた？' }] });
    await A.analyzeMessage(0, { langs: ['ja'] });
    const asked = prompt(1);
    assert.ok(!asked.includes('[0] (Mina) "OK!"  → needs') && !/\[0\][^\n]*→ needs/.test(asked), asked);
    assert.equal((asked.match(/→ needs: ja/g) || []).length, 1);
    rewrite(mes, '"Fine, have it your way, then!" She nodded. "Did you rest well?"');
    T.reply = () => ({ segs: [{ i: 0, ja: '勝手にしなさい！' }] });
    const third = await A.analyzeMessage(0, { langs: ['ja'] });
    assert.equal(T.requests.length, 3, 'the changed echo line is translated (one small request)');
    assert.match(prompt(2), /\[0\][^\n]*Fine, have it your way, then![^\n]*→ needs: ja/);
    assert.equal(third.segs[0].text.ja, '勝手にしなさい！');
    assert.equal(await A.analyzeMessage(0, { langs: ['ja'] }), third);
    assert.equal(T.requests.length, 3);
});
await test('hand-placed sounds do not move when a rewrite changed the number of dialogue lines (no analysis to compare)', async () => {
    const mes = await setup();
    const id = L.listSfx().find(x => x && L.getSfx(x.id))?.id;
    assert.equal(A.addManualSfx(0, 2, id), true);
    assert.equal(mes.extra.lemon_voice.manual.n, 3, 'the dialogue count is stored with the cues');
    rewrite(mes, BEFORE.replace('He nodded.', 'He nodded. "Yes."'));
    assert.deepEqual(A.manualSfx(0), [], 'not moved one line off');
    const mes2 = await setup();
    assert.equal(A.addManualSfx(0, 2, id), true);
    rewrite(mes2, REWRITTEN);
    assert.equal(A.manualSfx(0).length, 1, 'same count → moved');
});
await test('a request kept through a rewrite is still stopped by clearing the analysis', async () => {
    const mes = await setup();
    const g = gate(); T.gate = g;
    const pending = A.analyzeMessage(0, { langs: ['ja'] });
    for (let k = 0; k < 200 && !g.started; k++) await sleep(5);
    rewrite(mes, REWRITTEN);   // 보낸 요청은 계속 받는다
    T.gate = null;
    A.clearAnalysis(0);
    g.release();
    await assert.rejects(pending, e => e?.name === 'AbortError');
    assert.equal(mes.extra.lemon_voice?.analysis, undefined, 'nothing stored after the clear');
});
await test('a request kept through a rewrite is saved right away once moved; a rewrite that changes the line count stops it as before', async () => {
    const mes = await setup();
    const g = gate(); T.gate = g;
    const pending = A.analyzeMessage(0, { langs: ['ja'] });
    for (let k = 0; k < 200 && !g.started; k++) await sleep(5);
    rewrite(mes, REWRITTEN);
    const saves = T.saves;
    g.release();
    const moved = await pending;
    assert.equal(moved.hash, A.hash(REWRITTEN));
    assert.ok(T.saves > saves, 'saved without waiting for the 1 s timer');
    const mes2 = await setup();
    const g2 = gate(); T.gate = g2;
    const pending2 = A.analyzeMessage(0, { langs: ['ja'] });
    for (let k = 0; k < 200 && !g2.started; k++) await sleep(5);
    rewrite(mes2, BEFORE.replace('He nodded.', 'He nodded. "Yes."'));
    g2.release();
    await assert.rejects(pending2, e => e?.name === 'AbortError', 'a different line count cannot be moved → not kept');
});

// ---------- 다시 쓰기 연결 · 버전
await test('the rewrite add-on marks its own edits before notifying; the scene-plan reroll does not', () => {
    const src = read('src/addons/rewrite/index.js');
    assert.ok(src.includes("import { markRewrite } from '../../edit-origin.js';"));
    const at = src.indexOf('            message.mes = replacement;\n');
    const mark = src.indexOf('markRewrite(message, original, replacement);');
    const notify = src.indexOf('await notifyTextChanged(messageId);', at);
    assert.ok(at > 0 && mark > at && notify > mark, 'mark right after the text changes, before MESSAGE_UPDATED');
    // 7.0.1 ↶ 되돌리기도 반대 방향(after → before)으로 표시한다 — 그 밖에는 cleanMessage 하나
    assert.equal(src.split('markRewrite(').length - 1, 2, 'cleanMessage + undoRewrite');
    assert.ok(src.includes('markRewrite(message, rec.after, rec.before);'), 'undo marks the reverse edit');
    assert.ok(!read('src/addons/rewrite/reroll.js').includes('markRewrite'), 'a rerolled reply is new text');
    assert.match(read('src/addons/tts/src/analysis.js'), /import \{ rewriteLinked \} from '\.\.\/\.\.\/\.\.\/edit-origin\.js';/);
});
await test('version stamps agree (rewrite index/css, TTS)', () => {
    const rv = read('src/addons/rewrite/index.js').match(/const VERSION = '([\d.]+)';/)[1];
    assert.ok(read('src/addons/rewrite/style.css').includes(`--bwr-css-version: "${rv}";`));
    const tv = read('src/addons/tts/version.js').match(/TTS_VERSION = '([\d.]+)'/)[1];
    assert.equal(JSON.parse(read('src/addons/tts/manifest.json')).version, tv);
    assert.ok(read('src/addons/tts/style.css').includes(`--lv-css-version: "${tv}";`));
    assert.ok(read('src/addons/tts/README.md').startsWith(`# TTS ${tv}\n`));
});

console.log(JSON.stringify({ passed, failed, mockOnly: true }, null, 2));
process.exitCode = failed ? 1 : 0;
