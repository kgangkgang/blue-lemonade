// 테마 6.1.8 (다시 쓰기 2.0.4 · TTS) 그림 자리(그림 확장의 슬롯)는 글이 아니다 — 다시 쓰기는 고치지 않고, TTS 는 읽지 않는다.
// 다시 쓰기: 요소 통째 가리기(문단 경계처럼) · 규칙 / 반복이 「[AutoPic 이미지]」에 안 걸림 · 문장 가운데 자리도 범위 밖 · 맥락에서 뺌 ·
//   자리를 바꾼 고친 글은 거절 · 고치는 사이 자리 줄만 바뀌면 다시 끼워 적용 · 워커도 버전 붙여 읽기.
// TTS: 자리는 구간이 아니고 줄 번호 · 대사 차례는 그대로 · 분석 맥락에 안 감 · 링크를 남긴 자리 넣기는 분석을 그대로 둔다 (요청 0).
// 실제 core.js · text.js · analysis.js · spans-worker.js 에 실리태번과 통신만 흉내 (계정 · 목소리 · 사용자 데이터 없음).
//   node tools/tests/rewrite-tts-slots.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(theme, rel), 'utf8');
const url = rel => pathToFileURL(path.join(theme, rel)).href;
const data = s => `data:text/javascript,${encodeURIComponent(s)}`;

const C = await import(url('src/addons/rewrite/core.js'));
const X = await import(url('src/addons/tts/src/text.js'));
const O = await import(url('src/edit-origin.js'));

// analysis.js 는 실리태번 모듈을 읽는다 → rewrite-tts-keep.mjs 와 같은 흉내 (이 파일만의 전역 이름)
const T = globalThis.__rewriteSlotTest = { ext: {}, saves: 0, requests: [], reply: null, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina', characters: [], groups: [] } };
T.ctx.saveChat = async () => { T.saves++; };
const G = 'const T=globalThis.__rewriteSlotTest;';
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
globalThis.fetch = async (to, init = {}) => {
    assert.equal(String(to), 'https://mock.invalid/v1/chat/completions');
    const body = JSON.parse(init.body); T.requests.push(body);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(T.reply(body)) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }));
};
const A = await import(url('src/addons/tts/src/analysis.js'));
const S = await import(url('src/addons/tts/src/settings.js'));

let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + e.stack); } }

const slot = id => `<span class="autopic-image-slot" data-autopic-slot="${id}">[AutoPic 이미지]</span>`;
const S1 = slot('ap-2'), S2 = slot('ap-9');
const rule = (id, words) => C.compileRule({ id, name: id, words });
const GLASSES = rule('glasses', 'glasses');

// ---------- 다시 쓰기: 가리기
await test('the whole slot element is masked as a line break of the same length; other tags only as spaces', () => {
    const text = `She smiled.\n\n${S1}\n\n<b>Bold</b> line.`;
    const masked = C.maskProtected(text);
    assert.equal(masked.length, text.length);
    const at = text.indexOf(S1);
    assert.equal(masked[at], '\n', 'first character of the slot becomes a line break');
    assert.equal(masked.slice(at + 1, at + S1.length).trim(), '', 'the rest is blank, including 「[AutoPic 이미지]」');
    assert.ok(!masked.includes('AutoPic') && !masked.includes('이미지'));
    assert.ok(masked.includes('Bold') && !masked.includes('<b>'), 'an ordinary tag keeps its inner text');
    assert.equal(C.maskProtected(`a \`${S1}\` b`).includes('\n'), false, 'inside inline code it is code, not a slot');
});
await test('slot on its own paragraph: a rule matching its words (이미지 · autopic) never targets it; real words elsewhere still do', () => {
    const quick = rule('quick', '이미지, autopic');
    const text = `거울 속 이미지가 흔들렸다.\n\n${S1}\n\n그는 안경을 고쳐 썼다.`;
    const spans = C.findSpans(text, [quick]);
    assert.equal(spans.length, 1);
    assert.equal(spans[0].text, '거울 속 이미지가 흔들렸다.');
    assert.equal(C.findSpans(`${S1}\n\n${S2}`, [quick]).length, 0, 'slots only → nothing to rewrite');
});
await test('slot in the middle of a sentence: the span stops at the slot, the splice leaves the slot untouched', async () => {
    const text = `He pushed up his glasses ${S1} and smiled.`;
    const spans = C.findSpans(text, [GLASSES]);
    assert.equal(spans.length, 1);
    assert.equal(spans[0].text, 'He pushed up his glasses');
    assert.ok(!spans[0].text.includes('autopic'), 'no slot markup sent as a sentence to rewrite');
    C.prepareSpans(spans, []);
    const out = await C.rewriteText({ text, spans, exceptions: [], compiled: [GLASSES], generate: async () => '<s1>He rubbed the back of his neck</s1>' });
    assert.equal(out.fixed, 1);
    assert.equal(out.text, `He rubbed the back of his neck ${S1} and smiled.`);
});
await test('repeat detection at the smallest length (6) never flags the slot line, even when every reply has one', () => {
    const prev = `Rain tapped on the window.\n\n${S1}`;
    const now = `The kettle began to whistle.\n\n${S2}`;
    assert.deepEqual(C.findRepeats(now, [prev], { threshold: 0.6, minLength: 6 }), []);
    const echo = C.findRepeats(`Rain tapped on the window.\n\n${S2}`, [prev], { threshold: 0.6, minLength: 6 });
    assert.equal(echo.length, 1, 'a real repeat is still found');
    assert.equal(echo[0].text, 'Rain tapped on the window.');
});
await test('the rewrite prompt leaves slots out of the reply context; tagged sentences unchanged', () => {
    const text = `He pushed up his glasses.\n\n${S1}\n\nShe laughed.`;
    const spans = C.prepareSpans(C.findSpans(text, [GLASSES]), []);
    const [, user] = C.buildPrompt(text, spans, false, []);
    assert.ok(!user.content.includes('autopic-image-slot') && !user.content.includes('AutoPic'), user.content);
    assert.match(user.content, /<reply>\nHe pushed up his glasses\.\n\nShe laughed\.\n<\/reply>/, 'one blank line left where the slot was');
    assert.match(user.content, /<s1>He pushed up his glasses\.<\/s1>/);
    assert.equal(C.stripSlots(`a\n\n${S1}\n\n${S2}\n\nb`), 'a\n\nb');
});
await test('checkRewrite: a rewrite that changes a slot id or its text, drops it or invents one is rejected (format); identical slot passes', () => {
    const span = { text: `his glasses ${S1} and`, rules: [GLASSES.rule], exemptRules: [] };
    assert.equal(C.checkRewrite(span, `his scarf ${S1} and`, [GLASSES]), 'ok');
    assert.equal(C.checkRewrite(span, `his scarf ${S2} and`, [GLASSES]), 'format', 'id changed');
    assert.equal(C.checkRewrite(span, `his scarf ${S1.replace('[AutoPic 이미지]', '[그림]')} and`, [GLASSES]), 'format', 'inner text changed');
    assert.equal(C.checkRewrite(span, 'his scarf and', [GLASSES]), 'format', 'slot dropped');
    const plain = { text: 'He pushed up his glasses.', rules: [GLASSES.rule], exemptRules: [] };
    assert.equal(C.checkRewrite(plain, `He rubbed his neck. ${S1}`, [GLASSES]), 'format', 'a new slot may not be invented');
    assert.equal(C.checkRewrite(plain, 'He rubbed his neck.', [GLASSES]), 'ok');
});

// ---------- 다시 쓰기: 고치는 사이 자리 줄이 바뀌었을 때 (순수 함수)
await test('rebaseSlotLines: slot lines added between paragraphs or at the end are kept, the rewrite goes on the same line', () => {
    const original = 'He pushed up his glasses.\n\nShe laughed.';
    const replacement = 'He rubbed his neck.\n\nShe laughed.';
    assert.equal(C.rebaseSlotLines(original, `He pushed up his glasses.\n\n${S1}\n\nShe laughed.`, replacement), `He rubbed his neck.\n\n${S1}\n\nShe laughed.`);
    assert.equal(C.rebaseSlotLines(original, `${original}\n\n${S1}`, replacement), `${replacement}\n\n${S1}`);
    assert.equal(C.rebaseSlotLines(original, `${S1}\n\n${original}`, replacement), `${S1}\n\n${replacement}`);
    const two = `He pushed up his glasses.\n\n${S1}\n\nShe laughed.\n\n${S2}`;
    assert.equal(C.rebaseSlotLines(original, two, replacement), `He rubbed his neck.\n\n${S1}\n\nShe laughed.\n\n${S2}`);
});
await test('rebaseSlotLines: slot lines removed meanwhile stay removed; a hidden prefix stays as it is', () => {
    const original = `<think>plan</think>\nHe pushed up his glasses.\n\n${S1}\n\nShe laughed.`;
    const replacement = `<think>plan</think>\nHe rubbed his neck.\n\n${S1}\n\nShe laughed.`;
    assert.equal(C.rebaseSlotLines(original, '<think>plan</think>\nHe pushed up his glasses.\n\nShe laughed.', replacement), '<think>plan</think>\nHe rubbed his neck.\n\nShe laughed.');
    assert.equal(C.rebaseSlotLines(original, original, replacement), replacement, 'unchanged → the rewrite as it is');
});
await test('rebaseSlotLines refuses anything but slot lines: an edited sentence, a slot inside a line, a blank line only, a different line count', () => {
    const original = 'He pushed up his glasses.\n\nShe laughed.';
    const replacement = 'He rubbed his neck.\n\nShe laughed.';
    assert.equal(C.rebaseSlotLines(original, 'He pushed up his glasses.\n\nShe laughed loudly.', replacement), null, 'a human edit');
    assert.equal(C.rebaseSlotLines(original, `He pushed up his glasses. ${S1}\n\nShe laughed.`, replacement), null, 'slot glued to a sentence');
    assert.equal(C.rebaseSlotLines(original, 'He pushed up his glasses.\n\n\nShe laughed.', replacement), null, 'only whitespace changed (not a slot)');
    assert.equal(C.rebaseSlotLines(original, `${original}\n\n${S1}`, 'He rubbed his neck. She laughed.'), null, 'replacement with a different line count');
    assert.equal(C.rebaseSlotLines(original, `He pushed up his glasses.\n\n${S1}\n\nShe laughed.\n\nNew line.`, replacement), null, 'slot plus a new sentence');
});
await test('the rewrite add-on rebases instead of discarding, and still writes and marks in one place', () => {
    const src = read('src/addons/rewrite/index.js');
    const check = src.indexOf('if (current !== message || current.mes !== original) {');
    const rebase = src.indexOf('rebaseSlotLines(original, current.mes, replacement)', check);
    const warn = src.indexOf("toastr.warning('고치는 동안 메시지가 바뀌어서 적용하지 않았어요.', TITLE);", check);
    const write = src.indexOf('            message.mes = replacement;\n', check);
    const mark = src.indexOf('markRewrite(message, original, replacement);', write);
    assert.ok(check > 0 && rebase > check && warn > rebase && write > warn && mark > write, 'rebase → (else warn) → write → mark');
    assert.ok(src.slice(check, write).includes('original = current.mes;'), 'the mark links the text with slots to the rewrite');
    assert.ok(src.slice(check, write).includes('tokenCount = undefined;'), 'no stale token count written');
    assert.equal(src.split('markRewrite(').length - 1, 2, 'cleanMessage + 7.0.1 undoRewrite');
    assert.ok(!/\bawait\b/.test(src.slice(check, write)), 'no wait between the check and the write');
});

// ---------- 다시 쓰기: 워커
await test('the span worker loads core.js with its own ?v= and finds spans with the slot rule', async () => {
    const src = read('src/addons/rewrite/spans-worker.js');
    assert.ok(!/^import\s/m.test(src), 'no static import without a version');
    const v = read('src/addons/rewrite/index.js').match(/const VERSION = '([\d.]+)';/)[1];
    const sent = [];
    globalThis.self = { location: { href: `${url('src/addons/rewrite/spans-worker.js')}?v=${v}` }, postMessage: msg => sent.push(msg) };
    await import(`${url('src/addons/rewrite/spans-worker.js')}?v=${v}`);
    const text = `He pushed up his glasses ${S1} and smiled.\n\n${S2}`;
    await globalThis.self.onmessage({ data: { id: 7, text, rules: [{ words: 'glasses, autopic, 이미지' }] } });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].id, 7);
    assert.deepEqual(sent[0].spans.map(s => text.slice(s.start, s.end)), ['He pushed up his glasses']);
    await globalThis.self.onmessage({ data: { id: 8, text: null, rules: null } });
    assert.equal(sent[1].id, 8);
    assert.ok(typeof sent[1].error === 'string', 'a bad request answers with an error (the page falls back), never throws');
    delete globalThis.self;
});
await test('rewrite and TTS use the same slot pattern; version stamps agree', () => {
    assert.equal(C.SLOT_RE.source, X.SLOT_RE.source);
    assert.equal(C.SLOT_RE.flags, X.SLOT_RE.flags);
    const v = read('src/addons/rewrite/index.js').match(/const VERSION = '([\d.]+)';/)[1];
    assert.ok(read('src/addons/rewrite/style.css').includes(`--bwr-css-version: "${v}";`));
    assert.notEqual(v, '2.0.3', 'the worker URL changes with the version');
});

// ---------- TTS: text.js
const DIALOGUE = `"Good morning." She stretched.\n\n${S1}\n\n"Did you sleep well?" He nodded.\n\n${S2}`;
await test('TTS: a slot is never a segment; line numbers and dialogue order are those of the original text', () => {
    const segs = X.segmentMessage(DIALOGUE, { final: true });
    assert.ok(!segs.some(g => /AutoPic|이미지|autopic/.test(g.text) || /autopic/.test(g.raw || '')), JSON.stringify(segs));
    const lines = DIALOGUE.split('\n');
    for (const g of segs) assert.ok(lines[g.line].includes(g.raw || g.text), `${g.kind} "${g.text}" on line ${g.line}`);
    const plain = X.segmentMessage(DIALOGUE.replace(S1, '').replace(S2, ''), { final: true });
    assert.deepEqual(segs.map(g => [g.kind, g.text, g.line]), plain.map(g => [g.kind, g.text, g.line]), 'same as the text without slots, same line numbers');
    assert.deepEqual(segs.filter(g => g.kind === 'dialogue').map(g => g.text), ['Good morning.', 'Did you sleep well?'].map(t => segs.find(g => g.text.includes(t))?.text));
});
await test('TTS: blankSlots keeps the length and line breaks; stripForSpeech drops the slot text', () => {
    const b = X.blankSlots(DIALOGUE);
    assert.equal(b.length, DIALOGUE.length);
    assert.equal(b.split('\n').length, DIALOGUE.split('\n').length);
    assert.ok(!b.includes('AutoPic'));
    assert.equal(X.stripForSpeech(`앞 문장. ${S1} 뒤 문장.`), '앞 문장. 뒤 문장.');
    assert.equal(X.stripForSpeech('<span class="autopic-image-slot">[AutoPic 이미지]</span>'), '', 'a stray slot without an id too');
});

// ---------- TTS: analysis.js
async function setup(text) {
    T.requests.length = 0; T.reply = () => ({ segs: [{ i: 0, emotion: 'happy', ja: 'おはよう。' }, { i: 1, emotion: 'calm', ja: 'よく眠れた？' }] });
    Object.assign(S.settings(), { enabled: true, extras: 'off', voices: [], sfx: { ...(S.settings().sfx || {}), enabled: false, auto: false, custom: [] } });
    Object.assign(S.settings().analysis, { enabled: true, engine: 'compat', base: 'https://mock.invalid/v1', key: 'mock-only', model: 'm', emotion: true, translate: true, speaker: false, context_chars: 1200, when: 'auto' });
    A.clearAnalysis('chat');
    T.ctx.chat.length = 0;
    T.ctx.chat.push({ mes: text, name: 'Mina', is_user: false, is_system: false, swipe_id: 0, swipes: [text], swipe_info: [{ extra: {} }], extra: {} });
    return T.ctx.chat[0];
}
await test('TTS analysis: slots are not sent as context; the stored hash is still the hash of the raw text', async () => {
    const mes = await setup(DIALOGUE);
    const p = A.buildPrompt(mes, { langs: ['ja'] });
    assert.ok(!JSON.stringify(p).includes('AutoPic') && !JSON.stringify(p).includes('autopic'), p.user);
    const done = await A.analyzeMessage(0, { langs: ['ja'] });
    assert.equal(T.requests.length, 1);
    assert.equal(done.hash, A.hash(DIALOGUE), 'textHash is unchanged (saved analyses stay valid)');
    assert.ok(!JSON.stringify(T.requests[0]).includes('AutoPic'));
});
await test('TTS analysis: a slot line inserted with the edit-origin link keeps the analysis with no new request', async () => {
    const before = '"Good morning." She stretched.\n\n"Did you sleep well?" He nodded.';
    const mes = await setup(before);
    const first = await A.analyzeMessage(0, { langs: ['ja'] });
    const after = `"Good morning." She stretched.\n\n${S1}\n\n"Did you sleep well?" He nodded.`;
    mes.mes = after; mes.swipes[0] = after;
    O.markRewrite(mes, before, after);
    A.onMessageChanged(0);
    const kept = A.getAnalysis(0);
    assert.ok(kept, 'not dropped');
    assert.equal(kept.hash, A.hash(after));
    assert.deepEqual(kept.segs, first.segs);
    assert.equal((await A.analyzeMessage(0, { langs: ['ja'] })).hash, A.hash(after));
    assert.equal(T.requests.length, 1, 'no second paid request');
});

console.log(JSON.stringify({ passed, failed, mockOnly: true }, null, 2));
process.exitCode = failed ? 1 : 0;
