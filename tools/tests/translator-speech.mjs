// 번역 2.3.0 · TTS 1.4.4 듣는 언어 — 번역 애드온이 TTS 에 내는 translateForSpeech (src/addons/translator/speech-translate.js · glossary-match.js glossaryLinesFor ·
//   index.js 의 speechReady · speechModelTag · speechGlossaryBlock · speechRequest · translateForSpeech 를 잘라 내 가짜 callLLMAPI 로 돌린다)
//   node tools/tests/translator-speech.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 확인: 줄 묶음 = 한 요청 (⟦n⟧ 번호) · 빠진 줄만 한 번 더 · 거절은 머리말을 바꿔 한 번 · 일시 오류 한 번 · 준비 안 되면 보내지 않음 ·
//       채팅 번역 프롬프트 · 목표 언어를 쓰지 않음 · 용어집은 그 언어 표기만 · 캐시 키용 지문에 키 · 비밀번호 없음. 합성 자료만 씀.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dev = path.resolve(process.argv[2] || '.');
const dir = path.join(dev, 'src/addons/translator');
if (!fs.existsSync(path.join(dir, 'speech-translate.js'))) { console.log('skip: 이 트리에는 speech-translate.js 가 없어요 (번역 2.3.0 이전)'); process.exit(0); }
const url = (name) => pathToFileURL(path.join(dir, name)).href;
const SP = await import(url('speech-translate.js'));
const GM = await import(url('glossary-match.js'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  PASS  ${name}`); }
    catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${String(e?.stack || e).split('\n').slice(0, 5).join('\n        ')}`); }
}

// ---------- 1. 순수 함수
await test('speechPrompt: 목표 언어 · 줄 수 규칙 · 용어집 (채팅 번역 프롬프트와 별개)', () => {
    const one = SP.speechPrompt('ja');
    assert.ok(one.startsWith(SP.SPEECH_TAG));
    assert.match(one, /into Japanese/);
    assert.doesNotMatch(one, /⟦/);
    const many = SP.speechPrompt('en', { count: 3, glossary: '[Glossary]\nX → Y' });
    assert.match(many, /numbered lines below into English/);
    assert.match(many, /⟦2⟧/);
    assert.ok(many.endsWith('[Glossary]\nX → Y'));
    assert.doesNotMatch(many, /korean/i);
    assert.match(SP.speechPrompt('zh'), /Simplified/);
    assert.throws(() => SP.speechPrompt('fr'));
});
await test('speechPayload: 한 줄은 그대로 · 여럿은 ⟦n⟧ + 빈 줄 · 줄바꿈은 빈칸', () => {
    assert.equal(SP.speechPayload(['Hi.\nThere.']), 'Hi. There.');
    assert.equal(SP.speechPayload(['A.', 'B.']), '⟦0⟧ A.\n\n⟦1⟧ B.');
});
await test('parseSpeechBatch: 번호 찾은 줄만 · 빠진 줄 null · 1부터 매긴 답 · 머리말 · 꼬리 메모 · <think> · 다른 표시 · 따옴표', () => {
    assert.deepEqual(SP.parseSpeechBatch('⟦0⟧ あ\n\n⟦1⟧ い\n\n⟦2⟧ う', 3), ['あ', 'い', 'う']);
    assert.deepEqual(SP.parseSpeechBatch('Here you go:\n⟦0⟧ あ\n\n⟦2⟧ う\n\nNote: 2 lines only', 3), ['あ', null, 'う']);
    assert.deepEqual(SP.parseSpeechBatch('⟦1⟧ あ\n⟦2⟧ い', 2), ['あ', 'い'], '1부터');
    assert.deepEqual(SP.parseSpeechBatch('<think>hmm ⟦0⟧ no</think>\n【0】 あ\n[1] い', 2), ['あ', 'い']);
    assert.deepEqual(SP.parseSpeechBatch('⟦0] あ\n⟦0⟧ 두번째', 1), ['あ'], '망가진 닫음 · 같은 번호는 처음 것');
    assert.deepEqual(SP.parseSpeechBatch('⟦0⟧ 「おはよう」\n⟦1⟧ 「おやすみ」', 2, ['Morning', '「Night」']), ['おはよう', '「おやすみ」'], '원문에 없는 따옴표만 벗김');
    assert.deepEqual(SP.parseSpeechBatch('', 2), [null, null]);
    assert.deepEqual(SP.parseSpeechBatch('⟦0⟧ あ\nい', 1), ['あ い'], '번호 없는 다음 줄은 이어 붙임');
});
await test('parseSpeechBatch: 번호가 한 칸 밀렸을 수 있으면 아무 줄도 안 받음 · 한 줄에 붙은 번호 · 원문 되풀이(→) · 본문의 [n]', () => {
    const S = ['Hello there.', 'See you tomorrow.', 'Let us go.'];
    assert.deepEqual(SP.parseSpeechBatch('⟦1⟧ こんにちは。\n\n⟦2⟧ また明日。', 3, S), [null, null, null], '1부터 매기고 끝 줄이 빠짐 (전엔 1번 자리에 0번 번역)');
    assert.deepEqual(SP.parseSpeechBatch('⟦0⟧ こんにちは。\n\n⟦1⟧ また\n\n⟦2⟧ 明日。\n\n⟦3⟧ 行こう。', 3, S), [null, null, null], '줄을 나눠 번호가 늘어남 (전엔 2번 자리에 「明日。」)');
    assert.deepEqual(SP.parseSpeechBatch('⟦0⟧ こんにちは。 ⟦1⟧ また明日。\n\n⟦2⟧ 行こう。', 3, S), ['こんにちは。', 'また明日。', '行こう。'], '한 줄에 붙은 번호 (전엔 「⟦1⟧ また明日。」가 0번 소리에)');
    assert.deepEqual(SP.parseSpeechBatch('⟦0⟧ Hello there. → こんにちは。\n\n⟦1⟧ See you tomorrow. -> また明日。\n\n⟦2⟧ 行こう。', 3, S), ['こんにちは。', 'また明日。', '行こう。'], '원문 → 번역');
    assert.deepEqual(SP.parseSpeechBatch('⟦0⟧ Hello there.\n->\n\nこんにちは。\n\n⟦1⟧ また明日。\n\n⟦2⟧ 行こう。', 3, S), ['こんにちは。', 'また明日。', '行こう。'], '원문 · 화살표 · 빈 줄 · 번역');
    assert.deepEqual(SP.parseSpeechBatch('⟦0⟧ Hello there. ->\n\n⟦1⟧ また明日。', 2, S), [null, 'また明日。'], '원문 + 화살표뿐 = 빠진 줄');
    assert.deepEqual(SP.parseSpeechBatch('⟦0⟧ 品物は\n[3] 個です。\n\n⟦1⟧ また明日。', 2, ['The items', 'See you.']), ['品物は [3] 個です。', 'また明日。'], '⟦ 답 안의 [3] 은 번호가 아님');
    assert.equal(SP.cutEchoLine('Hello there.\n\nこんにちは。', 'Hello there.'), 'こんにちは。');
    assert.equal(SP.cutEchoLine('OK.', 'OK.'), 'OK.', '그대로 둔 줄은 그대로');
    assert.equal(SP.cutEchoLine('はい → いいえ', 'Yes'), 'はい → いいえ', '원문이 아닌 앞머리는 건드리지 않음');
});
const E = (src, dst, id = src) => ({ id, scope: 'global', src, dst });
const GL = [E('Adelstein, アデルスタイン', '아델스타인'), E('天地合同庁, H.A.L.O', '천지합동청'), E('Guild', '길드'), E('ロビン', '로빈')];
await test('glossaryLinesFor: ko = 채팅 번역 줄 그대로 · 다른 언어 = 원문 칸의 그 언어 표기 · 한국어 글은 번역 칸으로 찾음 · 그 언어 표기가 없으면 뺌', () => {
    assert.deepEqual(GM.glossaryLinesFor(GL, 'Adelstein met the Guild.', 'ko'), GM.glossaryLines(GL, 'Adelstein met the Guild.'));
    assert.deepEqual(GM.glossaryLinesFor(GL, 'Adelstein met the Guild.', 'ja').lines, ['Adelstein → アデルスタイン']);
    assert.deepEqual(GM.glossaryLinesFor(GL, 'アデルスタインさんとロビン', 'en').lines, ['アデルスタイン → Adelstein']);
    assert.deepEqual(GM.glossaryLinesFor(GL, '아델스타인이 천지합동청에 갔다.', 'ja').lines, ['아델스타인 → アデルスタイン', '천지합동청 → 天地合同庁']);
    assert.deepEqual(GM.glossaryLinesFor(GL, 'H.A.L.O office', 'zh').lines, ['H.A.L.O → 天地合同庁'], '한자 표기는 중국어 · 일본어 둘 다');
    assert.deepEqual(GM.glossaryLinesFor(GL, 'Nothing here.', 'ja').lines, []);
    assert.equal(GM.formScript('アデル'), 'ja');
    assert.equal(GM.formScript('天地'), 'han');
    assert.equal(GM.formScript('길드'), 'ko');
    assert.equal(GM.formScript('Guild'), 'en');
});

// ---------- 2. index.js 의 translateForSpeech (잘라 내서)
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
function cut(name) {
    let start = source.indexOf(`\nfunction ${name}(`);
    if (start < 0) start = source.indexOf(`\nasync function ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let j = source.indexOf(') {', start) + 2; j < source.length; j++) {
        const ch = source[j];
        if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return source.slice(start + 1, j + 1);
    }
    throw new Error('unbalanced ' + name);
}
const keysLine = source.split('\n').find(l => l.startsWith('const SPEECH_KEYS = '));
assert.ok(keysLine, 'SPEECH_KEYS');
const api = /globalThis\[Symbol\.for\('blue-lemonade\.translator'\)\] = \{([\s\S]*?)\};/.exec(source);
const names = ['speechReady', 'speechModelTag', 'speechGlossaryBlock', 'speechRequest', 'translateForSpeech', 'speechGroupLimit'];
const moduleText = `import { SPEECH_LANGS, speechPrompt, speechPayload, speechLine, parseSpeechBatch, unwrapQuotes, cutEchoLine } from ${JSON.stringify(url('speech-translate.js'))};
import { glossaryLinesFor } from ${JSON.stringify(url('glossary-match.js'))};
import { stripReplyWrapping } from ${JSON.stringify(url('translation-segments.js'))};
export const H = globalThis.__speechTest = { calls: [], script: [], ctx: { mainApi: 'openai' }, fields: ['custom', 'mock-model', 'http://relay', 'proxy', true] };
const extensionSettings = H.settings = { connection_mode: 'direct', llm_provider: 'openai', llm_model: 'gpt-test', llm_prompt_chat: 'Please translate the following text to korean:', glossary_enabled: true, glossary_entries: [], use_reverse_proxy: false, reverse_proxy_password: 'pw-secret' };
let duplicate = false;
export const setDuplicate = v => { duplicate = v; };
const SECRET_KEYS = { OPENAI: 'api_key_openai', CLAUDE: 'api_key_claude', MAKERSUITE: 'api_key_makersuite', COHERE: 'api_key_cohere', VERTEXAI: 'api_key_vertexai', VERTEXAI_SERVICE_ACCOUNT: 'vertexai_service_account', OPENROUTER: 'api_key_openrouter', DEEPSEEK: 'api_key_deepseek', CUSTOM: 'api_key_custom' };
const secret_state = H.secrets = {};
const getContext = () => H.ctx;
const getCustomModelName = () => H.customModel || '';
const getCustomEndpointConfig = () => ({ url: H.customUrl || '' });
const activeConnectionFields = () => H.fields;
const activeGlossaryEntries = () => extensionSettings.glossary_entries;
const GLOSSARY_MAX_LINES = 60;
const looksLikeInputBlock = t => /prompt could not be submitted/i.test(String(t || ''));
const inputBlockError = () => Object.assign(new Error('입력 차단'), { refused: true });
const looksLikeRefusal = (src, out) => /^I'm sorry/.test(String(out || ''));
const isTransientError = e => Boolean(e?.transient) && !e?.refused;
const tidyKana = t => t;
const CHUNK_TARGET = 1800;
const textOutputLimit = () => 2048;
async function callLLMAPI(prompt, overrides = {}) {
    H.calls.push({ prompt, purpose: overrides.requestPurpose, signal: overrides.signal });
    const next = H.script.shift();
    if (!next) throw new Error('예상 못 한 요청');
    return next(prompt, overrides);
}
${keysLine}
${names.map(cut).join('\n')}
export { translateForSpeech, speechReady, speechModelTag };
`;
const file = path.join(os.tmpdir(), `llmt-speech-${process.pid}.mjs`);
fs.writeFileSync(file, moduleText);
let M;
try { M = await import(pathToFileURL(file).href); } finally { fs.unlinkSync(file); }
const H = M.H;
const reset = () => {
    H.calls = []; H.script = [];
    Object.assign(H.settings, { connection_mode: 'direct', llm_provider: 'openai', llm_model: 'gpt-test', glossary_enabled: true, glossary_entries: [], use_reverse_proxy: false, parameters: {}, profile_max_tokens: 0 });
    for (const k of Object.keys(H.secrets)) delete H.secrets[k];
    H.secrets.api_key_openai = true;
    H.ctx = { mainApi: 'openai' };
    H.customModel = ''; H.customUrl = '';
    M.setDuplicate(false);
};
/** 번호 묶음 답: 받은 프롬프트의 ⟦n⟧ 줄마다 '[ja] 글' (skip 번호는 뺌) */
const echoBatch = (skip = []) => (prompt) => prompt.split('\n').map(l => /^⟦(\d+)⟧ (.*)$/.exec(l)).filter(Boolean).filter(m => !skip.includes(Number(m[1]))).map(m => `⟦${m[1]}⟧ [ja] ${m[2]}`).join('\n\n');

await test('API 에 실림: translateForSpeech · speechReady · speechModelTag (기존 네 개 그대로)', () => {
    assert.ok(api, 'publishTranslatorAPI');
    for (const n of ['processTranslationText', 'readCachedTranslation', 'storeTranslationQuietly', 'deleteCachedTranslation', 'translateForSpeech', 'speechReady', 'speechModelTag']) assert.match(api[1], new RegExp(`\\b${n}\\b`), n);
});
await test('세 줄 = 요청 하나 (⟦n⟧ 묶음 · 일본어 지시 · 채팅 번역 프롬프트 없음 · 요청 로그 용도 translation.tts)', async () => {
    reset();
    H.script.push(echoBatch());
    const out = await M.translateForSpeech(['Hello there.', 'See you.', 'Bye.'], 'ja');
    assert.deepEqual(out, ['[ja] Hello there.', '[ja] See you.', '[ja] Bye.']);
    assert.equal(H.calls.length, 1);
    const p = H.calls[0].prompt;
    assert.ok(p.startsWith('[Text-to-speech translation]'));
    assert.match(p, /into Japanese/);
    assert.match(p, /⟦0⟧ Hello there\.\n\n⟦1⟧ See you\.\n\n⟦2⟧ Bye\./);
    assert.doesNotMatch(p, /translate the following text to korean/i);
    assert.equal(H.calls[0].purpose, 'translation.tts');
});
await test('한 줄은 번호 없이 · 머리말은 걷고 따옴표는 원문대로', async () => {
    reset();
    H.script.push(() => 'Here is the translation:\n\n「こんにちは。」');
    assert.deepEqual(await M.translateForSpeech(['Hello.'], 'ja'), ['こんにちは。']);
    assert.doesNotMatch(H.calls[0].prompt, /⟦/);
});
await test('답에 빠진 줄만 한 번 더 (한 줄이면 번호 없이) · 그래도 없으면 null · 거절문 줄은 null', async () => {
    reset();
    H.script.push(echoBatch([1]), () => '[ja] retry one');
    assert.deepEqual(await M.translateForSpeech(['A.', 'B.', 'C.'], 'ja'), ['[ja] A.', '[ja] retry one', '[ja] C.']);
    assert.equal(H.calls.length, 2);
    assert.match(H.calls[1].prompt, /\n\nB\.$/);
    reset();
    H.script.push(echoBatch([1]), () => '');
    assert.deepEqual(await M.translateForSpeech(['A.', 'B.', 'C.', 'D.'], 'ja'), ['[ja] A.', null, '[ja] C.', '[ja] D.']);
    assert.equal(H.calls.length, 2, '다시 보내기는 한 번만');
    assert.match(H.calls[1].prompt, /\n\nB\.$/);
    reset();
    // ⟦1⟧ 하나만 온 답: 0부터의 1번인지 1부터의 0번인지 모른다 → 아무 줄도 받지 않고 셋 다 한 번 더
    H.script.push(echoBatch([0, 2]), () => '');
    assert.deepEqual(await M.translateForSpeech(['A.', 'B.', 'C.'], 'ja'), [null, null, null]);
    assert.equal(H.calls.length, 2, '다시 보내기는 한 번만');
    assert.match(H.calls[1].prompt, /⟦0⟧ A\.\n\n⟦1⟧ B\.\n\n⟦2⟧ C\./);
    reset();
    H.script.push(() => '⟦0⟧ [ja] ok\n\n⟦1⟧ I\'m sorry, I can\'t translate this.', () => 'I\'m sorry, still no.');
    assert.deepEqual(await M.translateForSpeech(['Fine.', 'Spicy.'], 'ja'), ['[ja] ok', null]);
});
await test('거절 · 입력 차단은 머리말을 바꿔 한 번 더 · 일시 오류(429)는 한 번 더 · 그 밖 오류는 그대로', async () => {
    reset();
    H.script.push(() => { throw Object.assign(new Error('blocked'), { refused: true }); }, (p) => (p.startsWith('[Fiction translation request]') ? '[ja] ok' : 'wrong'));
    assert.deepEqual(await M.translateForSpeech(['Line.'], 'ja'), ['[ja] ok']);
    assert.equal(H.calls.length, 2);
    reset();
    H.script.push(() => 'The prompt could not be submitted. The prompt contains sensitive words', () => '[ja] ok2');
    assert.deepEqual(await M.translateForSpeech(['Line.'], 'ja'), ['[ja] ok2']);
    reset();
    H.script.push(() => { throw Object.assign(new Error('429'), { transient: true }); }, () => '[ja] later');
    const t0 = Date.now();
    assert.deepEqual(await M.translateForSpeech(['Line.'], 'ja'), ['[ja] later']);
    assert.ok(Date.now() - t0 >= 1400, '1.5초 쉬고');
    reset();
    H.script.push(() => { throw new Error('API 키가 잘못되었거나 권한이 없습니다.'); });
    await assert.rejects(M.translateForSpeech(['Line.'], 'ja'), /API 키/);
    assert.equal(H.calls.length, 1);
});
await test('그만두면(signal) 다시 보내지 않고 그 오류 그대로', async () => {
    reset();
    const ctrl = new AbortController();
    H.script.push(() => { ctrl.abort(); throw Object.assign(new Error('aborted'), { name: 'AbortError', transient: true }); });
    await assert.rejects(M.translateForSpeech(['Line.'], 'ja', { signal: ctrl.signal }), e => e.name === 'AbortError');
    assert.equal(H.calls.length, 1);
    assert.equal(H.calls[0].signal, ctrl.signal, 'callLLMAPI 에 signal 이 감');
});
await test('speechReady: 직접 연결 · 키 없음 · 모델 없음 · 사용자 지정 주소 · 현재 연결 · 단독 확장 → 준비 안 되면 보내지 않음 (notReady)', async () => {
    reset();
    assert.deepEqual(M.speechReady(), { ok: true });
    delete H.secrets.api_key_openai;
    assert.equal(M.speechReady().ok, false);
    await assert.rejects(M.translateForSpeech(['Line.'], 'ja'), e => e.notReady === true);
    assert.equal(H.calls.length, 0);
    H.settings.use_reverse_proxy = true;
    assert.equal(M.speechReady().ok, true, '리버스 프록시면 키 없이');
    reset();
    H.settings.llm_model = '';
    assert.match(M.speechReady().why, /모델/);
    reset();
    Object.assign(H.settings, { llm_provider: 'custom', llm_model: 'custom' });
    H.customModel = 'mock';
    assert.match(M.speechReady().why, /주소/);
    H.customUrl = 'http://127.0.0.1:1/v1';
    assert.equal(M.speechReady().ok, true, '사용자 지정은 키 없이 주소만');
    reset();
    H.settings.connection_mode = 'current';
    assert.equal(M.speechReady().ok, true);
    H.ctx = { mainApi: 'kobold' };
    assert.equal(M.speechReady().ok, false);
    reset();
    M.setDuplicate(true);
    assert.equal(M.speechReady().ok, false);
    await assert.rejects(M.translateForSpeech(['x'], 'ja'), e => e.notReady === true);
    assert.equal(H.calls.length, 0);
    await assert.rejects(M.translateForSpeech(['x'], 'fr'), /언어/);
});
await test('긴 답장: 출력 한도를 넘는 줄 묶음은 채팅 번역처럼 나눠 차례로 · 한 묶음이 실패해도 다른 줄은 받음 · 잘리면 반씩 · 모두 실패면 오류', async () => {
    reset();
    H.settings.parameters = { openai: { max_length: 400 } };   // 400 토큰 → 480자 묶음
    const long = (c) => `${c} `.repeat(100).trim() + '.';    // 200자
    const L4 = ['A', 'B', 'C', 'D'].map(long);
    H.script.push(echoBatch(), echoBatch());
    let out = await M.translateForSpeech(L4, 'ja');
    assert.equal(H.calls.length, 2, '200자 × 4 = 묶음 둘');
    assert.ok(out.every(Boolean));
    assert.match(H.calls[0].prompt, /⟦0⟧ A[^⟦]*⟦1⟧ B/);
    assert.doesNotMatch(H.calls[0].prompt, /⟦2⟧ C/);
    reset();
    H.settings.parameters = { openai: { max_length: 400 } };
    H.script.push(echoBatch(), () => { throw new Error('서버 내부 오류'); });
    out = await M.translateForSpeech(L4, 'ja');
    assert.deepEqual(out.map(Boolean), [true, true, false, false], '둘째 묶음만 원문');
    assert.equal(H.calls.length, 2, '실패한 묶음은 빠진 줄 다시 보내기에 넣지 않음');
    reset();
    H.settings.parameters = { openai: { max_length: 400 } };
    H.script.push(() => { throw new Error('서버 내부 오류'); }, () => { throw new Error('서버 내부 오류 2'); });
    await assert.rejects(M.translateForSpeech(L4, 'ja'), /서버 내부 오류$/, '모두 실패면 첫 오류');
    reset();
    H.script.push(() => { throw Object.assign(new Error('잘림'), { truncated: true }); }, echoBatch(), () => '[ja] Three.');
    out = await M.translateForSpeech(['One.', 'Two.', 'Three.'], 'ja');
    assert.deepEqual(out, ['[ja] One.', '[ja] Two.', '[ja] Three.']);
    assert.equal(H.calls.length, 3, '잘린 묶음은 반씩 (2 + 1)');
    reset();
    H.script.push(echoBatch());
    await M.translateForSpeech(['A.', 'B.'], 'ja');
    assert.equal(H.calls.length, 1, '한도를 모르면(0) 3600자 묶음 = 보통 메시지 하나에 요청 하나');
    reset();
    H.script.push(() => 'Hello there.\n->\n\nこんにちは。');
    assert.deepEqual(await M.translateForSpeech(['Hello there.'], 'ja'), ['こんにちは。'], '한 줄 답의 원문 되풀이도 걷음');
});
await test('speechModelTag: 연결 · 공급자 · 모델만 (키 · 비밀번호 · 주소 없음)', () => {
    reset();
    assert.equal(M.speechModelTag(), 'direct|openai|gpt-test');
    H.settings.connection_mode = 'current';
    const tag = M.speechModelTag();
    assert.equal(tag, 'current|custom|mock-model');
    assert.doesNotMatch(tag, /relay|proxy|pw-secret|true/);
});
await test('용어집: 원문에 나온 항목의 그 언어 표기만 프롬프트에 · 꺼 두면 없음', async () => {
    reset();
    H.settings.glossary_entries = GL;
    H.script.push(echoBatch());
    await M.translateForSpeech(['Adelstein waved.', 'The Guild hall.'], 'ja');
    assert.match(H.calls[0].prompt, /\[Glossary\]\nUse these forms[^\n]*\nAdelstein → アデルスタイン(\n|$)/);
    assert.doesNotMatch(H.calls[0].prompt, /Guild →|아델스타인/);
    reset();
    H.settings.glossary_entries = GL;
    H.settings.glossary_enabled = false;
    H.script.push(echoBatch());
    await M.translateForSpeech(['Adelstein waved.', 'Hi.'], 'ja');
    assert.doesNotMatch(H.calls[0].prompt, /Glossary/);
});

console.log(`\ntranslator-speech: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
