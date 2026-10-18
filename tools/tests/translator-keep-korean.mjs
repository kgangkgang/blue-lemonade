// 번역기 2.7.9 「이미 한국어인 부분은 보내지 않기」 (korean-keep.js · translate()) — 가상 문장만.
//   영어 서술 + 한국어 대사인 답에서 한국어 문단 · 한국어 대사를 모델에 보내지 않고 글자 그대로 되돌린다. 모두 한국어면 요청하지 않는다.
//   index.js 의 translate() 를 잘라 가짜 모델로 돌린다 (브라우저 · 실리태번 · 네트워크 없음).
//   node tools/tests/translator-keep-korean.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KOREAN_KEEP_ENV } from './korean-keep-env.mjs';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
const keep = await import(pathToFileURL(path.join(dir, 'korean-keep.js')));
const { BATCH_HEADER } = seg;

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}
const HANGUL = /\p{Script=Hangul}/u;

// ── 가상 재료 ──
const EN = {
    rain: 'The rain had not stopped since morning, and the lanterns along the pier swayed in the wind.',
    map: 'She folded the map and slipped it into her coat pocket.',
    said: 'she said quietly.',
    door: 'The ferryman leaned on the door frame and shrugged.',
    guards: 'Mina walked past the two hundred-and-ninety-centimeter guards at the gate.',
};
const KO = {
    rain: '아침부터 비가 그치지 않았고, 부두를 따라 늘어선 등불이 바람에 흔들렸다.',
    map: '그녀는 지도를 접어 외투 주머니에 넣었다.',
    said: '그녀가 조용히 말했다.',
    door: '뱃사공은 문틀에 기대어 어깨를 으쓱했다.',
    guards: '미나는 문 앞의 190센티미터인 경비 둘을 지나쳤다.',
};
const DLG = '「오늘은 배가 뜨지 않을 거야. 내일 아침에 다시 와 봐.」';
const QUOTE = '그럼 여기서 기다릴게. 등대 불이 켜지면 알려 줘.';
const ko = text => { let out = String(text); for (const k of Object.keys(EN)) out = out.split(EN[k]).join(KO[k]); return out; };

const MESSAGE = [EN.rain, DLG, `${EN.map} "${QUOTE}" ${EN.said}`, EN.door].join('\n\n');
const EXPECTED = [KO.rain, DLG, `${KO.map} "${QUOTE}" ${KO.said}`, KO.door].join('\n\n');
const ALL_KOREAN = [KO.rain, DLG, KO.map].join('\n\n');

// ── 1. 판정 (순수 함수) ──
await check('isKorean: Korean prose · dialogue yes; mixed, Japanese, Chinese, English no; names, numbers and units are fine', () => {
    for (const text of [KO.rain, DLG, QUOTE, '키는 190cm였고 이름은 Mina 라고 했다.', '「알았어, Mina. 3시에 보자.」']) assert.ok(keep.isKorean(text), text);
    for (const text of ['그건 정말 amazing 했어, you know?', '「明日の朝、もう一度来てください。」', '「我们明天再来吧。」', EN.rain, '네.', '「응」', '[[__VAR_0__]]', '<b>Hello</b> 안녕'])
        assert.ok(!keep.isKorean(text), text);
    assert.ok(!keep.isKorean('「明日またね、알았지?」 그는 웃었다.'), 'any kana keeps the whole span');
});
await check('keepKorean: whole Korean paragraphs and Korean quote contents become placeholders (brackets kept); others untouched', () => {
    const blocks = [];
    const { text, paragraphs, quotes } = keep.keepKorean(MESSAGE, block => { blocks.push(block); return `[[__VAR_${blocks.length - 1}__]]`; });
    assert.equal(paragraphs, 1); assert.equal(quotes, 1);
    assert.equal(text, [EN.rain, '[[__VAR_0__]]', `${EN.map} "[[__VAR_1__]]" ${EN.said}`, EN.door].join('\n\n'));
    assert.deepEqual(blocks, [DLG, QUOTE]);
    const mixed = `${EN.map} "그건 정말 amazing 했어, you know?" ${EN.said}\n\n${EN.door} 「明日の朝、もう一度来てください。」\n\n${EN.door} 「我们明天再来吧。」 'don't' it's fine '네'`;
    assert.equal(keep.keepKorean(mixed, () => 'X').text, mixed, 'mixed quote, Japanese, Chinese, apostrophes and short Korean stay');
    assert.equal(keep.keepKorean(`${EN.door}\n\n  ${KO.map}  \n\n${EN.map}`, () => '[[__VAR_9__]]').text, `${EN.door}\n\n  [[__VAR_9__]]  \n\n${EN.map}`, 'surrounding spaces stay');
    for (const [open, close] of [['『', '』'], ['“', '”'], ['‘', '’'], ["'", "'"]]) {
        const line = `${EN.map} ${open}${QUOTE}${close} ${EN.said}`;
        assert.equal(keep.keepKorean(line, () => '[[__VAR_0__]]').text, `${EN.map} ${open}[[__VAR_0__]]${close} ${EN.said}`, open);
    }
});

// ── 2. translate() 를 잘라 가짜 모델로 ──
function cut(name) {
    const re = new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('), start = source.search(re);
    assert(start >= 0, name);
    return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2).replace(/^export /, '');
}
const BRACKET_NOTE = /\nconst BRACKET_NOTE = '([^']*)'/.exec(source)?.[1] ?? '';
const KOREAN_PROMPT = /\n {4}llm_prompt_chat: '([^']*)'/.exec(source)?.[1];
assert.match(KOREAN_PROMPT, /korean/i, 'default chat prompt');
const ctx = { chatMetadata: {}, chat: [] };
const S = { llm_prompt_chat: KOREAN_PROMPT, glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled' };
const digests = [];
const env = { ...KOREAN_KEEP_ENV, ...card, ...seg, ...resume, ...auto, cardValues: cardValueModule.cardValues, getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S, getContext: () => ctx,
    guards: { capture: () => ({ assert() {} }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }), document: { getElementById: () => null },
    BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
    buildGlossaryBlock: () => '', checkpointKey: async x => { digests.push(x); return x; }, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
    looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
    tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [], dropDanglingOpenQuote: x => x,
    runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
    correctBackticks: x => x, window: {}, toastr: { warning() {} }, globalThis: { toastr: { warning() {} } }, BRACKET_NOTE,
};
function install(name) { env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env); return env[name]; }
for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
    'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'tidyGlossaryOutput', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'liveChatPrompt', 'translate']) install(name);
env.tidyGlossaryOutput = (_s, x) => x;
const prompts = [];
let model = body => ko(body);
env.callLLMAPI = async prompt => {
    prompts.push(prompt);
    // 프롬프트 · 괄호 안내 · [Numbers:] 는 답에 넣지 않는다 (가짜 모델은 맨 끝 본문만 옮긴다)
    const batch = prompt.includes(BATCH_HEADER);
    const body = batch ? prompt.slice(prompt.indexOf(BATCH_HEADER) + BATCH_HEADER.length)
        : bodyOf(prompt).replace('\n\n' + BRACKET_NOTE, '').replace(/\n\n\[Numbers:[^\n]*\]/, '').replace(/^\n\n/, '');
    return model(body, batch);
};
const bodyOf = prompt => prompt.slice(prompt.indexOf(KOREAN_PROMPT) + KOREAN_PROMPT.length);
const reset = async () => { prompts.length = 0; digests.length = 0; model = body => ko(body); S.keep_korean_source = undefined; S.llm_prompt_chat = KOREAN_PROMPT; env.CHUNK_TARGET = 100000; await seg.clearSegmentCache(); await resume.clearCheckpoints(); };

await check('all-Korean message: no request on any path, text comes back unchanged', async () => {
    for (const [label, options, chunk] of [['whole', {}, 100000], ['paragraph cache', { segmentCache: true }, 100000], ['chunks', {}, 40]]) {
        await reset(); env.CHUNK_TARGET = chunk;
        const report = {};
        assert.equal(await env.translate(ALL_KOREAN, { ...options, report }), ALL_KOREAN, label);
        assert.equal(prompts.length, 0, `${label}: no request`);
    }
});
await check('English narration + Korean dialogue: the request carries no Hangul, the dialogue comes back byte-identical (whole · paragraph cache · chunks)', async () => {
    for (const [label, options, chunk] of [['whole', {}, 100000], ['paragraph cache', { segmentCache: true }, 100000], ['chunks', {}, 120]]) {
        await reset(); env.CHUNK_TARGET = chunk;
        const out = await env.translate(MESSAGE, options);
        assert.equal(out, EXPECTED, label);
        assert.ok(prompts.length >= 1, `${label}: sent`);
        for (const prompt of prompts) assert.ok(!HANGUL.test(prompt), `${label}: ${prompt.slice(-200)}`);
        assert.ok(out.includes(DLG) && out.includes(`"${QUOTE}"`), label);
    }
});
await check('paragraph cache: a second run is served from cache; the cache signature carries korean-keep-v1 only when something was kept', async () => {
    await reset();
    await env.translate(MESSAGE, { segmentCache: true });
    const calls = prompts.length;
    assert.ok(digests.some(d => String(d).includes('korean-keep-v1')));
    assert.equal(await env.translate(MESSAGE, { segmentCache: true }), EXPECTED);
    assert.equal(prompts.length, calls, 'cached');
    digests.length = 0;
    await env.translate(`${EN.rain}\n\n${EN.door}`, { segmentCache: true });
    assert.ok(digests.length && digests.every(d => !String(d).includes('korean-keep-v1')), 'nothing kept → old signature');
});
await check('mixed Korean/English inside one quote, Japanese and Chinese dialogue are sent as before', async () => {
    await reset();
    const text = [`${EN.map} "그건 정말 amazing 했어, you know?" ${EN.said}`, `${EN.door} 「明日の朝、もう一度来てください。」`, `${EN.door} 「我们明天再来吧。」`].join('\n\n');
    await env.translate(text);
    const sent = prompts.join('\n');
    assert.ok(sent.includes('그건 정말 amazing 했어, you know?') && sent.includes('明日の朝、もう一度来てください。') && sent.includes('我们明天再来吧。'));
});
await check('setting off, or a prompt that does not target Korean: old behaviour (the Korean is sent)', async () => {
    await reset(); S.keep_korean_source = false;
    assert.equal(await env.translate(MESSAGE), EXPECTED);
    assert.ok(prompts.some(prompt => prompt.includes(DLG) && prompt.includes(QUOTE)));
});
await check('setting off really sends an all-Korean message; a Japanese-target prompt never masks', async () => {
    await reset(); S.keep_korean_source = false;
    await env.translate(ALL_KOREAN);
    assert.equal(prompts.length, 1); assert.ok(prompts[0].includes(KO.rain));
    await reset();
    await env.translate(MESSAGE, { prompt: 'Please translate the following text to Japanese:' });
    assert.ok(prompts.some(prompt => prompt.includes(DLG)));
});
await check('[Numbers:] and the bracket note still work around masked dialogue', async () => {
    await reset();
    await env.translate(`${EN.guards} 「${QUOTE}」 ${EN.said}`);
    const prompt = prompts.at(-1);
    assert.ok(prompt.includes('[Numbers: copy every number'), 'numbers note');
    assert.ok(prompt.includes(BRACKET_NOTE) && prompt.includes('「[[__VAR_0__]]」'), 'bracket note with the brackets kept around the placeholder');
    assert.ok(!HANGUL.test(bodyOf(prompt).replace(BRACKET_NOTE, '')), 'no Hangul in the body');
});
await check('a model that mangles or drops the placeholders still gets the Korean back in place', async () => {
    await reset();
    model = body => ko(body).replace(/\[\[__VAR_(\d+)__\]\]/g, '[[ __VAR_$1__ ]]');
    assert.equal(await env.translate(MESSAGE), EXPECTED, 'spaced placeholders');
    await reset();
    model = body => ko(body).replace(/\[\[__VAR_(\d+)__\]\]/g, '[__VAR_$1__]');
    assert.equal(await env.translate(MESSAGE), EXPECTED, 'single brackets');
    await reset();
    model = body => ko(body).replace(/\[\[__VAR_0__\]\]\n\n/, '');
    const out = await env.translate(MESSAGE);
    assert.ok(out.includes(DLG), 'dropped whole-paragraph placeholder restored');
    assert.equal(out.split(DLG).length - 1, 1, 'once');
});
await check('user-protected blocks keep their numbers (Korean placeholders come after them)', async () => {
    await reset();
    S.user_defined_regexes = ['<note>[\\s\\S]*?</note>'];
    const text = `<note>keep this</note> ${EN.map}\n\n${DLG}`;
    const out = await env.translate(text);
    S.user_defined_regexes = [];
    assert.ok(prompts[0].includes('[[__VAR_0__]] ') && prompts[0].includes('[[__VAR_1__]]'), prompts[0].slice(-120));
    assert.equal(out, `<note>keep this</note> ${KO.map}\n\n${DLG}`);
});
await check('wiring: setting default on, checkbox, only for Korean-target message translation (not retranslation · input · check source), manifest 2.9.7', () => {
    assert.match(source, /keep_korean_source: true,/);
    assert.match(source, /\$\('#llm_keep_korean'\)\.prop\('checked', extensionSettings\.keep_korean_source !== false\)/);
    assert.match(source, /extensionSettings\.keep_korean_source !== false && !options\.isInputTranslation && !options\.isRetranslation && options\.checkSource === undefined\s+&& KOREAN_TARGET\.test/);
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    assert.match(html, /id="llm_keep_korean"><span>이미 한국어인 부분은 보내지 않기<\/span>/);
    assert.match(html, /ext-version">v2\.9\.7</, 'version shown in the drawer head');   // 7.1.8 말투 지침 · 의심 번역 모아보기
    assert.match(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'), /"version": "2\.9\.7"/);
});

// ── 3. 어림 토큰 (보고용) ──
await check('token estimate on a sample (English narration + Korean dialogue)', async () => {
    const sample = [EN.rain, DLG, `${EN.map} "${QUOTE}" ${EN.said}`, EN.door, '「그 배는 사흘 전에 떠났어. 다음 배는 언제 올지 아무도 몰라.」', `${EN.map} 「바다가 잔잔해지면 꼭 다시 올게. 그때는 같이 가자.」 ${EN.said}`].join('\n\n');
    await reset(); S.keep_korean_source = false; await env.translate(sample);
    const off = keep.roughTokens(bodyOf(prompts.at(-1)));
    await reset(); await env.translate(sample);
    const on = keep.roughTokens(bodyOf(prompts.at(-1)));
    assert.ok(on < off);
    console.log(`  estimate: request body ≈ ${off} → ${on} tokens (−${Math.round((1 - on / off) * 100)}%; reply is shorter by about the same Korean part)`);
});

console.log(`translator-keep-korean: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
