// TTS 대사 분석은 메시지당 한 번 (1.5.8) — 사용자 (11-16): 「tts 분석은 왜 누를때마다 하는거임? 한번싹하는거아니었어? 뭔 대사 누를때마다 분석중이야」
//   고치기 전 (1.5.5 ~ 1.5.7): 1.5.5 가 점자 빈칸(U+2800)을 보통 빈칸으로 바꾼 뒤 글을 나누면서, 1.5.4 까지 저장한 분석(색 태그 속 "color:#…" 까지 대사로 센 줄)이
//     지금 줄과 순번 · 해시가 하나도 안 맞았다. 누름 1: 기울임 열쇠(j:h)가 달라 기울임 보충 요청 → 그 보충이 감정을 모두 비움 → 누름 2: 「감정 빠짐」으로 통째로 다시 (유료 2번).
//   고친 뒤: 저장된 분석을 지금 줄로 옮겨(옛 나누기 · 옛 정규화로 찾아) 요청 없이 쓴다. 못 찾은 줄만 한 번 묻는다. 같은 메시지 요청은 하나에 붙는다.
//   node tools/tests/tts-analyze-once.mjs <테마 루트>      — 실리태번 모듈은 data: 스텁, 분석 엔진은 가짜 fetch (네트워크 0)
//   node tools/tests/tts-analyze-once.mjs <1.5.4 테마 루트> --make-fixture   — 1.5.4 가 저장했을 분석을 고정 자료로 만든다 (한 번 만들어 둠)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const theme = path.resolve(process.argv[2] || path.join(here, '../..'));
const makeFixture = process.argv.includes('--make-fixture');
const root = path.join(theme, 'src/addons/tts/src');
const fixDir = path.join(here, 'fixtures/tts-analyze-once');
const greeting = JSON.parse(fs.readFileSync(path.join(fixDir, 'braille-greeting.json'), 'utf8'));
const BRAILLE = '⠀';
const TEXT = greeting.text.join('\n').replace(/ /g, BRAILLE);   // 프리셋: 빈칸마다 점자 빈칸 (태그 속까지)

const data = s => `data:text/javascript,${encodeURIComponent(s)}`;
const T = globalThis.__analyzeOnce = { ext: {}, saves: 0, requests: [], gate: null, ctx: { chat: [], chatMetadata: {}, name1: 'Mira', name2: greeting.name, characters: [], groups: [], chatId: 'chat-a' } };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T=globalThis.__analyzeOnce;';
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
/** 가짜 분석 엔진: 물은 줄마다 감정 calm · 화자 '?' · 물은 기울임마다 narration · 효과음 없음. 무엇을 물었는지 적어 둔다 */
globalThis.fetch = async (url, init = {}) => {
    assert.equal(String(url), 'https://mock.invalid/v1/chat/completions');
    const body = JSON.parse(init.body);
    const user = body.messages.map(m => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n');
    const lines = ((user.match(/requested dialogue index: ([0-9, ]+)/) || [, ''])[1]).split(',').map(x => x.trim()).filter(Boolean).map(Number);
    const italics = [...user.matchAll(/\[\*(\d+)\]/g)].map(m => Number(m[1]));
    T.requests.push({ lines, italics });
    if (T.gate) { T.gate.started = true; await T.gate.promise; }
    const reply = { segs: lines.map(i => ({ i, emotion: 'calm', speaker: '?' })), italics: italics.map(j => ({ j, kind: 'narration' })), sfx: [] };
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 10 } }), { headers: { 'Content-Type': 'application/json' } });
};
const A = await import(pathToFileURL(path.join(root, 'analysis.js')).href);
const S = await import(pathToFileURL(path.join(root, 'settings.js')).href);

const EMO = ['happy', 'angry', 'surprised', 'sad', 'calm', 'fearful'];
const message = (text = TEXT) => ({ mes: text, name: greeting.name, is_user: false, is_system: false, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });
function setup(text = TEXT) {
    T.requests.length = 0; T.gate = null; T.saves = 0; store.clear();
    Object.assign(S.settings(), { enabled: true, extras: 'off', join_paragraph: true, voices: [], char_map: {}, sfx: { ...(S.settings().sfx || {}), enabled: false, auto: false, custom: [] } });
    Object.assign(S.settings().analysis, { enabled: true, engine: 'compat', base: 'https://mock.invalid/v1', key: 'mock-only', model: 'm', emotion: true, translate: false, speaker: true, context_chars: 1200, when: 'auto', fallback: { enabled: false, provider: '', model: '' } });
    A.clearAnalysis('chat');
    T.ctx.chat.length = 0;
    T.ctx.chat.push(message(text));
    return T.ctx.chat[0];
}

// ---------- 고정 자료 만들기 (1.5.4 코드로): 1.5.4 가 이 인사말을 분석해 저장했을 모양 — 줄 · 기울임 순번과 해시는 1.5.4 의 나누기 · 정규화 그대로
if (makeFixture) {
    const mes = setup();
    const built = A.buildPrompt(mes, { speaker: true, italics: true, emotion: true });
    const analysis = {
        hash: A.hash(TEXT), swipe: 0, langs: [], model: 'fixture', at: 0, speaker: true, lib: 2,
        segs: built.lines.map(l => ({ i: l.i, h: l.h, emotion: EMO[l.i % EMO.length], text: {}, ...(l.ask ? { speaker: 'Corvin' } : {}) })),
        sfx: [{ after: Math.min(2, built.lines.length), id: 'bell', strength: 1, repeats: 1, durationMs: 0 }, { after: built.lines.length, id: 'thud', strength: 1, repeats: 1, durationMs: 0 }],
        italics: built.italics.map(x => ({ j: x.j, h: x.h, kind: x.j % 2 ? 'thought' : 'narration', ...(x.j % 2 ? { speaker: 'Mira' } : {}) })),
        italicsTried: built.italics.map(x => `${x.j}:${x.h}`),
    };
    fs.writeFileSync(path.join(fixDir, 'analysis-154.json'), JSON.stringify({ note: '1.5.4 코드(node tools/tests/tts-analyze-once.mjs <1.5.4 루트> --make-fixture)로 만든 저장된 분석. 감정 · 화자 · 효과음 값은 지어낸 것', lines: built.lines.map(l => l.text.replace(/⠀/g, ' ')), analysis }, null, 1) + '\n');
    console.log(`fixture: ${built.lines.length} lines · ${built.italics.length} italics`);
    process.exit(0);
}

const OLD = JSON.parse(fs.readFileSync(path.join(fixDir, 'analysis-154.json'), 'utf8'));
const oldAnalysis = () => structuredClone(OLD.analysis);
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }
function gate() { let release; const promise = new Promise(r => { release = r; }); return { promise, release, started: false }; }
const nowLines = (mes) => A.buildPrompt(mes, { speaker: true, italics: true, emotion: true });

await test('고정 자료: 1.5.4 분석은 지금 줄과 순번 · 해시가 안 맞는다 (색 태그 속 "color:" 를 대사로 셈)', async () => {
    const mes = setup();
    const built = nowLines(mes);
    assert.ok(OLD.analysis.segs.length > built.lines.length, `1.5.4 ${OLD.analysis.segs.length}줄 > 지금 ${built.lines.length}줄`);
    assert.ok(OLD.lines.some(t => /color:/.test(t)), '1.5.4 가 색 태그 조각을 대사로 셌다');
    assert.equal(built.lines.filter((l, k) => OLD.analysis.segs[k]?.h === l.h).length, 0, '순번 · 해시가 맞는 줄 0');
});

await test('1.5.4 분석이 저장된 메시지: 대사를 다섯 번 눌러도 분석 요청 0 — 지금 줄로 옮겨 쓴다', async () => {
    const mes = setup();
    mes.extra.lemon_voice = { analysis: oldAnalysis() };
    for (let k = 0; k < 5; k++) {
        const a = await A.analyzeMessage(0, { langs: [] });
        assert.ok(a && Array.isArray(a.segs), `누름 ${k + 1}: 분석 있음`);
    }
    assert.equal(T.requests.length, 0, '분석 요청 0 (고치기 전: 기울임 보충 1 + 통째로 다시 1)');
    const a = A.getAnalysis(0);
    const built = nowLines(mes);
    assert.equal(a.segs.length, built.lines.length);
    assert.deepEqual(a.segs.map(g => [g.i, g.h]), built.lines.map(l => [l.i, l.h]), '지금 줄의 순번 · 해시');
    assert.ok(a.segs.every(g => A.EMOTIONS.includes(g.emotion)), '감정이 비지 않음');
    assert.deepEqual(A.italicsToFill(mes, a), [], '기울임 보충 없음');
    assert.equal(mes.extra.lemon_voice.analysis, a, '옮긴 분석을 메시지에 저장');
    assert.deepEqual(mes.swipe_info[0].extra.lemon_voice.analysis, a, '스와이프 거울에도');
});

await test('옮긴 분석의 감정 · 화자 · 효과음 자리 · 기울임은 같은 대사 · 같은 조각의 것', async () => {
    const mes = setup();
    mes.extra.lemon_voice = { analysis: oldAnalysis() };
    const a = A.getAnalysis(0);
    const norm = t => A.normText(t);
    for (const g of a.segs) {
        const k = OLD.lines.findIndex((t, x) => norm(t) === norm(nowLines(mes).lines[g.i].text) && OLD.analysis.segs[x].emotion === g.emotion);
        assert.ok(k >= 0, `줄 ${g.i}: 같은 글의 옛 줄 감정`);
    }
    const last = a.sfx.find(c => c.id === 'thud');
    assert.equal(last.after, a.segs.length, '마지막 대사 뒤 효과음은 지금 줄 수 뒤');
    const first = a.sfx.find(c => c.id === 'bell');
    assert.ok(first.after < OLD.analysis.sfx[0].after || first.after === OLD.analysis.sfx[0].after, '앞쪽 효과음 자리는 앞으로 당겨지거나 그대로');
    const its = nowLines(mes).italics;
    assert.equal(a.italics.length, its.length, '기울임 답 수');
    assert.deepEqual(a.italics.map(x => `${x.j}:${x.h}`), its.map(x => `${x.j}:${x.h}`), '기울임 열쇠는 지금 조각');
    assert.deepEqual(a.italics.map(x => x.kind), OLD.analysis.italics.map(x => x.kind), '기울임 답(말 · 속마음 · 서술)은 그대로');
});

await test('줄 맞추기는 분석 하나에 한 번 — 다시 불러도 같은 분석 객체', async () => {
    const mes = setup();
    mes.extra.lemon_voice = { analysis: oldAnalysis() };
    const a = A.getAnalysis(0);
    assert.equal(A.getAnalysis(0), a);
    assert.equal(A.getAnalysis(0), a);
});

await test('못 찾은 줄이 있으면 그 줄만 한 번 묻고, 찾은 줄의 감정은 그대로', async () => {
    const mes = setup();
    const old = oldAnalysis();
    const built = nowLines(mes);
    // 지금 줄 1 에 해당하는 옛 줄의 해시를 지어낸 값으로 (그 줄만 못 찾게)
    const target = OLD.lines.findIndex(t => A.normText(t) === A.normText(built.lines[1].text));
    assert.ok(target >= 0);
    old.segs[target].h = 'zzzz';
    mes.extra.lemon_voice = { analysis: old };
    const a = await A.analyzeMessage(0, { langs: [] });
    assert.equal(T.requests.length, 1, '요청 한 번');
    assert.deepEqual(T.requests[0].lines, [1], '못 찾은 줄만 물음');
    assert.equal(a.segs[1].emotion, 'calm', '새로 물은 줄은 새 답');
    for (const g of a.segs) if (g.i !== 1) {
        const k = OLD.lines.findIndex((t, x) => A.normText(t) === A.normText(built.lines[g.i].text) && OLD.analysis.segs[x].emotion === g.emotion);
        assert.ok(k >= 0, `줄 ${g.i}: 옛 감정 그대로`);
    }
    await A.analyzeMessage(0, { langs: [] });
    assert.equal(T.requests.length, 1, '그 뒤로는 요청 없음');
});

await test('분석 중에 같은 메시지를 또 불러도 요청은 하나 (진행 중 약속 공유)', async () => {
    setup();
    T.gate = gate();
    const p1 = A.analyzeMessage(0, { langs: [] });
    const ctrl = new AbortController();
    const p2 = A.analyzeMessage(0, { langs: [], signal: ctrl.signal });
    const p3 = A.analyzeMessage(0, { langs: [] });
    for (let k = 0; k < 50 && !T.gate.started; k++) await new Promise(r => setTimeout(r, 5));
    assert.ok(T.gate.started, '요청이 나감');
    T.gate.release();
    const [a1, a2, a3] = await Promise.all([p1, p2, p3]);
    assert.equal(T.requests.length, 1, '요청 1');
    assert.equal(a1, a2);
    assert.equal(a1, a3);
    await A.analyzeMessage(0, { langs: [] });
    assert.equal(T.requests.length, 1, '끝난 뒤 또 눌러도 요청 없음');
});

await test('메시지 글이 실제로 바뀌면 (편집) 그때만 다시 묻는다', async () => {
    const mes = setup();
    await A.analyzeMessage(0, { langs: [] });
    await A.analyzeMessage(0, { langs: [] });
    assert.equal(T.requests.length, 1);
    mes.mes = TEXT.replace('冗談、ですよね', '本気、ですか');
    A.onMessageChanged(0);
    await A.analyzeMessage(0, { langs: [] });
    assert.equal(T.requests.length, 2, '글이 바뀐 뒤 한 번');
    await A.analyzeMessage(0, { langs: [] });
    assert.equal(T.requests.length, 2);
});

await test('기울임 보충은 감정을 지우지 않는다 (보충 뒤 통째로 다시 묻지 않음)', async () => {
    const mes = setup();
    await A.analyzeMessage(0, { langs: [] });
    assert.equal(T.requests.length, 1);
    const a = mes.extra.lemon_voice.analysis;
    a.italicsTried = a.italicsTried.slice(1);   // 한 조각을 아직 안 물어본 것처럼
    a.italics = a.italics.slice(1);
    const b = await A.analyzeMessage(0, { langs: [] });
    assert.equal(T.requests.length, 2, '기울임 보충 한 번');
    assert.deepEqual(T.requests[1].lines, [], '보충은 대사를 묻지 않음');
    assert.ok(b.segs.every(g => A.EMOTIONS.includes(g.emotion)), '감정 그대로');
    await A.analyzeMessage(0, { langs: [] });
    assert.equal(T.requests.length, 2, '그 뒤 요청 없음');
});

await test('normText: 점자 빈칸과 보통 빈칸은 같은 대사 — findSeg 가 어느 쪽 글로도 찾는다', async () => {
    assert.equal(A.normText('「冗談⠀ですよね？」'), A.normText('「冗談 ですよね？」'));
    const a = { segs: [{ i: 0, h: A.hash(A.normText('hello there')), emotion: 'happy' }, { i: 1, h: A.hash(A.normText('second line')), emotion: 'sad' }] };
    assert.equal(A.findSeg(a, 5, `second${BRAILLE}line`)?.emotion, 'sad');
});

await test('pairLines: 같은 대사가 두 번이면 차례대로 한 번씩', async () => {
    const S1 = (...h) => new Set(h);
    assert.deepEqual(A.pairLines([S1('a'), S1('x'), S1('b'), S1('y'), S1('a')], ['a', 'b', 'a', 'c']), [0, 2, 4, -1]);
    assert.deepEqual(A.pairLines([S1('a'), S1('b')], ['b', 'a']), [1, 0]);
});

await test('CI 등록', () => {
    assert.ok(fs.readFileSync(path.join(theme, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/tts-analyze-once.mjs .'));
});

console.log(`tts-analyze-once: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
