// 번역기 2.5.2 빠진 대사 괄호 되살리기 (가상 인물 · 가상 문장으로 바꾼 재현).
// 원문 색 대사 <span style="color:…">「…」</span> 를 번역 모델이 괄호만 빼고 옮겨, 테마가 대사로 못 알아봐 형광펜 · 밝은 글자색이 빠졌다.
// 원문과 같은 자리 줄 · 색 span 끼리 맞춰 원문이 통째 감싼 「…」 / 『…』 만 되살리고, 원문에 없는 괄호는 만들지 않는다.
//   node tools/tests/translator-brackets.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
const glossary = await import(pathToFileURL(path.join(dir, 'glossary-match.js')));
const { restoreDialogueBrackets: fix, dropWrapQuotes, BATCH_HEADER } = seg;

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}
const A = text => `<span style="color:#424C59">${text}</span>`;   // 가상 인물 하나
const B = text => `<span style="color:#f0d878">${text}</span>`;   // 가상 인물 둘
const join = (...lines) => lines.join('\n\n');

// ── 1. 실제 사례 모양 ──
const SRC = join(
    'The elevator doors slid open just in time.',
    A('「ふぅ、間に合った！ありがとう、ルカ。待っててくれたんだね？」'),
    B('「閉まりかけていたので押さえただけです」'),
    'She laughed and pressed the button for the seventh floor.',
    A('「真面目だなぁ。冗談だってば」'),
    B('「……ここが職場であることをお忘れなく」'),
);
const KO_FULL = join(
    '엘리베이터 문이 아슬아슬하게 열렸다.',
    A('「후우, 늦지 않았다! 고마워, 루카. 기다려 준 거지?」'),
    B('「닫히려던 참이라 잡아 둔 것뿐입니다」'),
    '그녀는 웃으며 7층 버튼을 눌렀다.',
    A('「진지하긴. 농담이라니까」'),
    B('「……여기가 직장이라는 걸 잊지 마세요」'),
);
const KO_LOST = KO_FULL
    .replace('「후우, 늦지 않았다! 고마워, 루카. 기다려 준 거지?」', '후우, 늦지 않았다! 고마워, 루카. 기다려 준 거지?')
    .replace('「진지하긴. 농담이라니까」', '진지하긴. 농담이라니까')
    .replace('「……여기가 직장이라는 걸 잊지 마세요」', '……여기가 직장이라는 걸 잊지 마세요');
await check('coloured dialogue that lost its 「」 gets them back; untouched lines stay byte-identical', () => {
    assert.equal(fix(SRC, KO_LOST), KO_FULL);
    assert.equal(fix(SRC, KO_FULL), KO_FULL, 'nothing to do');
    assert.equal(fix(SRC, fix(SRC, KO_LOST)), KO_FULL, 'idempotent');
});
await check('only one side missing: the missing side is added', () => {
    assert.equal(fix(SRC, KO_FULL.replace('농담이라니까」', '농담이라니까')), KO_FULL);
    assert.equal(fix(SRC, KO_FULL.replace('「진지하긴', '진지하긴')), KO_FULL);
});
await check('『…』 wrapped lines and 「」 holding an inner 『』 quote', () => {
    const src = join('『星の手紙』', A('「彼は『星は遠い』と言った」'));
    assert.equal(fix(src, join('별의 편지', A('그는 『별은 멀다』고 말했다'))), join('『별의 편지』', A('「그는 『별은 멀다』고 말했다」')));
});
await check('CRLF source, leading spaces and emphasis around the line are respected', () => {
    const src = '  *「行こう」*\r\n\r\nShe nodded.';
    assert.equal(fix(src, '  *가자*\n\n그녀가 고개를 끄덕였다.'), '  *「가자」*\n\n그녀가 고개를 끄덕였다.');
});
await check('paragraphs out of step: falls back to matching colour spans in order', () => {
    const out = KO_LOST.replace('그녀는 웃으며 7층 버튼을 눌렀다.\n\n', '그녀는 웃으며 7층 버튼을 눌렀다. ');
    const fixed = fix(SRC, out);
    assert(fixed.includes(A('「진지하긴. 농담이라니까」')) && fixed.includes(B('「……여기가 직장이라는 걸 잊지 마세요」')) && fixed.includes(A('「후우, 늦지 않았다! 고마워, 루카. 기다려 준 거지?」')));
    // span 차례가 다르면(색이 바뀜) 손대지 않는다
    const swapped = out.replace('<span style="color:#f0d878">……여기가', '<span style="color:#424C59">……여기가');
    assert.equal(fix(SRC, swapped), swapped);
});

// ── 2. 오탐: 원문에 없는 괄호는 만들지 않는다 ──
await check('no brackets in the source line → nothing added (and a model-added wrap is left to dropWrapQuotes)', () => {
    const src = join(A('ふぅ、間に合った'), 'He waved.');
    const out = join(A('후우, 늦지 않았다'), '그가 손을 흔들었다.');
    assert.equal(fix(src, out), out);
    const wrapped = join(A('「후우, 늦지 않았다」'), '그가 손을 흔들었다.');
    assert.equal(fix(src, wrapped), wrapped);
    assert.equal(dropWrapQuotes(wrapped, src), out, 'the opposite rule still works');
});
await check('narration with an inline quote, two quotes on one line, and English quotes are not wrapped', () => {
    for (const [src, out] of [
        ['She whispered 「go」 and left.', '그녀는 「가」라고 속삭이고 떠났다.'],
        ['She whispered 「go」 and left.', '그녀는 가라고 속삭이고 떠났다.'],
        ['「来て」……「早く」', '와……빨리'],
        ['"Come here," she said.', '"이리 와," 그녀가 말했다.'],
        ['"Come here."', '이리 와.'],
    ]) assert.equal(fix(src, out), out, src);
});
await check('dialogue spanning lines, other quote marks in the answer, and brackets already present inside are left alone', () => {
    const multi = '「行こう、\nもう時間だ」';
    assert.equal(fix(multi, '가자,\n벌써 시간이야'), '가자,\n벌써 시간이야');
    assert.equal(fix(A('「行こう」'), A('“가자”')), A('“가자”'));
    assert.equal(fix(A('「行こう」'), A('"가자"')), A('"가자"'));
    assert.equal(fix(A('「行こう」'), A('그래, 「가자」')), A('그래, 「가자」'));
});
await check('misaligned lines (different leading tags) and code blocks are never touched', () => {
    const src = join(A('「行こう」'), 'He waved.');
    const out = join('그가 손을 흔들었다.', A('가자'));
    assert.equal(fix(src, out), out);
    const code = '```\n「x」\n```';
    assert.equal(fix(code, '```\nx\n```'), '```\nx\n```');
});
await check('works with the dangling-「 tidy rule instead of fighting it', () => {
    const out = KO_FULL.replace('농담이라니까」', '농담이라니까');
    const fixed = fix(SRC, out);
    assert.equal(glossary.dropDanglingOpenQuote(fixed, SRC), fixed);
    assert.equal(dropWrapQuotes(fixed, SRC), fixed);
});

// ── 3. translate() 를 잘라 가짜 모델로 (모든 경로 · 미리 보기 · 프롬프트 한 줄) ──
function cut(name) {
    const re = new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('), start = source.search(re);
    assert(start >= 0, name);
    return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2).replace(/^export /, '');
}
const BRACKET_NOTE = /\nconst BRACKET_NOTE = '([^']*)'/.exec(source)?.[1];
assert(BRACKET_NOTE, 'BRACKET_NOTE');
const S = { llm_prompt_chat: 'Translate visible text.', glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled' };
const ctx = { chatMetadata: {}, chat: [] };
const env = { ...card, ...seg, ...resume, ...auto, cardValues: cardValueModule.cardValues, getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S, getContext: () => ctx,
    guards: { capture: () => ({ assert() {} }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }), document: { getElementById: () => null },
    BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
    buildGlossaryBlock: () => '', checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
    looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
    tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [],
    runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
    correctBackticks: x => x, window: {}, toastr: { warning() {} }, BRACKET_NOTE,
};
function install(name) { env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env); return env[name]; }
for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
    'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'translate']) install(name);
env.tidyGlossaryOutput = (_s, x) => x;
const PAIRS = SRC.split('\n\n').map((line, i) => [line, KO_LOST.split('\n\n')[i]]);
const lossy = body => { let out = String(body); for (const [a, b] of PAIRS) out = out.split(a).join(b); return out; };   // 괄호를 빼먹는 가짜 모델
const prompts = [];
env.callLLMAPI = async prompt => {
    prompts.push(prompt);
    let body = prompt.slice(prompt.indexOf('\n\n') + 2);
    if (body.startsWith(BRACKET_NOTE)) body = body.slice(BRACKET_NOTE.length + 2);
    return lossy(body.startsWith(BATCH_HEADER) ? body.slice(BATCH_HEADER.length) : body);
};
await check('every path restores the dropped brackets: whole, chunks, paragraph batches (+ cache), previews', async () => {
    await seg.clearSegmentCache(); await resume.clearCheckpoints();
    assert.equal(await env.translate(SRC), KO_FULL, 'whole');
    env.CHUNK_TARGET = 60;
    const previews = [];
    assert.equal(await env.translate(SRC, { onPreview: text => previews.push(text) }), KO_FULL, 'chunks');
    env.CHUNK_TARGET = 100000;
    assert(previews.length > 0 && previews.every(text => !/>(?:후우|진지하긴|……여기가)/.test(text)), 'previews show the brackets too');
    assert.equal(await env.translate(SRC, { segmentCache: true }), KO_FULL, 'paragraph batches');
    const calls = prompts.length;
    assert.equal(await env.translate(SRC, { segmentCache: true }), KO_FULL, 'paragraph cache');
    assert.equal(prompts.length, calls);
});
await check('prompt: one bracket line only when the source has 「」『』 and the prompt does not already talk about them', async () => {
    prompts.length = 0;
    await env.translate(SRC);
    assert(prompts.at(-1).includes(BRACKET_NOTE));
    await env.translate('He waved and left the room.');
    assert(!prompts.at(-1).includes(BRACKET_NOTE), 'no brackets in the source');
    await env.translate(SRC, { prompt: 'Translate to Korean. Keep the 「」 brackets exactly as in the source.' });
    assert(!prompts.at(-1).includes(BRACKET_NOTE), 'the user prompt already says it');
    assert(/^Translate to Korean\. Keep the 「」 brackets exactly as in the source\.\n\n/.test(prompts.at(-1)), 'user prompt unchanged');
});
await check('send-side (input) translation is left as the model wrote it', async () => {
    assert.equal(await env.translate(SRC, { isInputTranslation: true }), KO_LOST);
});

// ── 4. 표시 보정 훅 · 연결 ──
await check('render hook fills brackets on stored translations without touching data; user messages and original view untouched', () => {
    const hooks = [];
    ctx.messageFormatter = { stage: { BEFORE_REGEX: 'beforeRegex' }, order: { EARLIEST: 0 }, addHook: fn => hooks.push(fn) };
    env.commentHookAdded = false; install('hideBrokenCommentsOnRender'); env.hideBrokenCommentsOnRender();
    const stored = { mes: SRC, extra: { display_text: KO_LOST } }, mine = { mes: SRC, is_user: true, extra: { display_text: KO_LOST } };
    ctx.chat = [stored, mine];
    assert.equal(hooks[0](KO_LOST, { messageId: 0 }), KO_FULL);
    assert.equal(stored.extra.display_text, KO_LOST, 'stored data untouched');
    assert.equal(hooks[0](SRC, { messageId: 0 }), SRC, 'original view');
    assert.equal(hooks[0](KO_LOST, { messageId: 1 }), KO_LOST, 'user message');
    assert.equal(hooks[0]('<!-- x\n\n' + KO_LOST, { messageId: 0 }), KO_FULL, 'comment hiding and brackets together');
    delete ctx.messageFormatter; ctx.chat = [];
});
await check('wiring: final pass, cached translations and the version', () => {
    assert(/const bracketed = restoreDialogueBrackets\(tagSource, translatedText\);/.test(source));
    assert(/if \(cachedTranslation && !editedByHand\) translation = restoreDialogueBrackets\(originalText, translation\);/.test(source));
    assert(/options\.onPreview\(restoreDialogueBrackets\(text, value\)\)/.test(source));
    const version = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;
    assert.equal(version, '2.5.2');
    assert(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('>v2.5.2<'));
});

console.log(`translator-brackets: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
