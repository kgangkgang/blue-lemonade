// 번역기 2.5.1 숨긴 HTML 주석 · 끊긴 답 (가상 인물 · 가상 문장으로 바꾼 재현).
// 프리셋이 답마다 넣는 빈 줄을 품은 자기 점검 주석 「<!--  …⏎⏎…（…输出结果) -->」을 번역에 보내던 2.5.0 까지:
//   ① 주석 속 빈 줄에서 덩이가 갈라지고, 원문 그대로 둔 뒤 조각은 끝의 「 -->」 때문에 원문+화살표(되풀이)로 보여 지워졌다 → 닫는 --> 를 잃은
//      「<!-- 점검: …」이 화면에 보였다.
//   ② 실리태번이 Gemini 답의 finishReason 을 버려, 문장 중간(「『별」)에서 멈춘 답을 다 온 답으로 받아 그 덩이의 나머지 문단이 사라졌다.
// index.js 의 translate() 를 잘라 가짜 모델로 돌린다 (브라우저 · 실리태번 · 네트워크 없음).
//   node tools/tests/translator-comments.mjs [테마 뿌리, 기본 .]
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
const { hideOpenComments, openCommentAt, brokenComments, looksCutShort, removeSourceEcho, restoreParagraphBreaks, hasSourceEcho, stripDraftLeaks, BATCH_HEADER } = seg;

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}

// ── 가상 재료 ──
const COMMENT = '<!--  写作自检：\n此处以旁观者的视角检查当前场景的节奏与张力：\n\n我正在复盘叙事细节：\n1. 保持角色语气一致\n2. 放慢节奏，细化描写\n（请按以上步骤思考后输出结果) -->';
const [COMMENT_HEAD, COMMENT_TAIL] = COMMENT.split('\n\n');
const LINE = n => `Line ${n}: The lantern by the window flickered while the kettle hummed softly over the stove.`;
const LINE_KO = n => `${n}번째 줄: 창가의 등불이 깜박이는 동안 주전자가 화덕 위에서 나지막이 노래했다.`;
const ASK = '<span style="color:#e63946">「でも……さっき君が聞いた『星はどうして夜にだけ光るのか』という質問には、まだ半分しか答えていないね。」</span>';
const ASK_KO = '<span style="color:#e63946">「하지만…… 아까 네가 물었던 『별은 왜 밤에만 빛나는가』라는 질문에는 아직 절반밖에 답하지 않았네.」</span>';
const WAIT = 'Kaito tilted his head and waited for the rest of the answer, the rain still drumming on the glass.';
const WAIT_KO = '카이토는 고개를 갸웃하며 나머지 대답을 기다렸고, 빗소리는 여전히 유리창을 두드렸다.';
const DICT = [[ASK, ASK_KO], [WAIT, WAIT_KO]];
const ko = text => {
    let out = String(text);
    for (const [a, b] of DICT) out = out.split(a).join(b);
    return out.replace(/Line (\d+): The lantern by the window flickered while the kettle hummed softly over the stove\./g, (_, n) => LINE_KO(n));
};
// 실제 사례 모양: 맨 위 주석 · 대사 바로 뒤 주석 · 사이사이 서술 (빈 줄을 품은 주석이 덩이 경계에 걸리게)
const MESSAGE = ['<content>\n' + COMMENT, ...[1, 2, 3, 4, 5, 6].map(LINE), ASK, COMMENT, WAIT, ...[7, 8, 9, 10, 11, 12].map(LINE), COMMENT, ...[13, 14, 15].map(LINE), '</content>'].join('\n\n');

// ── 1. 순수 함수 ──
await check('stored translation with lost closers: every unclosed opener is hidden to its paragraph end, the rest stays', () => {
    const stored = ['<content>\n<!--  점검:\n여기서 나는 관찰자의 시점', LINE_KO(1), '<!--  점검:\n이 지점에서 나는 장면을 보정하고 있다:', LINE_KO(2), ASK_KO, '</content>'].join('\n\n');
    const shown = hideOpenComments(stored);
    assert.equal(shown, ['<content>', LINE_KO(1), LINE_KO(2), ASK_KO, '</content>'].join('\n\n'));
    assert.equal(openCommentAt(shown), -1);
    assert.equal(hideOpenComments(shown), shown, 'idempotent');
});
await check('closed comments (even with a blank line inside) and prose arrows are left alone', () => {
    const text = `${LINE_KO(1)}\n\n${COMMENT}\n\n그는 A --> B 로 갔다.\n\n${LINE_KO(2)}`;
    assert.equal(hideOpenComments(text), text);
    assert.equal(openCommentAt(text), -1);
});
await check('an unclosed opener followed later by a real comment is still hidden; a dangling closer paragraph is dropped', () => {
    const text = `<!--  점검:\n앞 조각\n\n${LINE_KO(1)}\n\n${COMMENT}\n\n${LINE_KO(2)}`;
    assert.equal(hideOpenComments(text), `${LINE_KO(1)}\n\n${COMMENT}\n\n${LINE_KO(2)}`);
    const tail = `${LINE_KO(1)}\n\n나는 서사 세부를 복기하고 있다:\n1. 말투 유지\n(위 단계대로 생각하고 출력) -->\n\n${LINE_KO(2)}`;
    assert.equal(hideOpenComments(tail), `${LINE_KO(1)}\n\n${LINE_KO(2)}`);
});
await check('brokenComments: unclosed or missing comments are broken; old fully translated but closed comments are not', () => {
    assert.equal(brokenComments(MESSAGE, MESSAGE), false);
    assert.equal(brokenComments(MESSAGE, MESSAGE.replace(COMMENT_TAIL, '')), true, 'closer lost');
    assert.equal(brokenComments(MESSAGE, MESSAGE.replace(COMMENT, '')), true, 'one comment dropped');
    const translatedComments = MESSAGE.split(COMMENT).join('<!--  점검:\n관찰자의 시점으로 보정한다:\n\n세부를 복기한다 -->');
    assert.equal(brokenComments(MESSAGE, translatedComments), false);
    assert.equal(brokenComments('앞 <!-- 끊긴 원문', '앞 <!-- 끊긴 번역'), false, 'source itself was cut');
    assert.equal(hasSourceEcho(MESSAGE, MESSAGE.replace(COMMENT_TAIL, '')), true, 'message cache rejects the broken shape');
});
await check('cause ①: a comment tail left as-is ends with -->, and is no longer removed as "source + arrow"', () => {
    const src = `${COMMENT_HEAD}\n\n${COMMENT_TAIL}\n\n${WAIT}`;
    const out = `<!--  점검:\n관찰자의 시점으로 장면을 보정한다:\n\n${COMMENT_TAIL}\n\n${WAIT_KO}`;
    assert.equal(removeSourceEcho(src, out), out);
    assert.equal(restoreParagraphBreaks(src, out), out);
    // 진짜 되풀이(원문 + 화살표 + 번역)는 예전처럼 걷는다
    assert.equal(removeSourceEcho(WAIT, `${WAIT} -->\n\n${WAIT_KO}`), WAIT_KO);
});
await check('cause ②: answers that stop mid-sentence are recognised, complete ones are not', () => {
    const chunk = [LINE(1), LINE(2), LINE(3), ASK, WAIT, LINE(4)].join('\n\n');
    const cutAtQuote = [LINE_KO(1), LINE_KO(2), LINE_KO(3), '<span style="color:#e63946">「하지만…… 아까 네가 물었던 『별'].join('\n\n');
    assert.equal(looksCutShort(chunk, cutAtQuote), true, 'stops after 『 with the span still open');
    assert.equal(looksCutShort(chunk, LINE_KO(1)), true, 'most of the chunk is missing');
    assert.equal(looksCutShort(chunk, ko(chunk)), false, 'complete translation');
    assert.equal(looksCutShort(chunk, ko(chunk).replace('</span>', '')), false, 'only a closing tag missing (tag repair handles it)');
    assert.equal(looksCutShort(ASK, '<span style="color:#e63946">「하지만…… 아까 네가 물었던 『별'), true, 'one dialogue line cut mid-sentence');
    assert.equal(looksCutShort(ASK, ASK_KO), false);
    assert.equal(looksCutShort('「はい。」', '「응'), false, 'very short sources are not judged');
    assert.equal(looksCutShort([LINE(1), LINE(2)].join('\n\n'), `${LINE_KO(1)} ${LINE_KO(2)}`), false, 'merged paragraphs keep their weight');
});
await check('the 2.5.0 leak filter leaves a complete 『』 line, its </span> and the comment placeholder alone', () => {
    const src = `${ASK}\n\n[[__VAR_0__]]\n\n${WAIT}`, out = `${ASK_KO}\n\n[[__VAR_0__]]\n\n${WAIT_KO}`;
    assert.equal(stripDraftLeaks(out, src), out);
    assert.equal(restoreParagraphBreaks(src, out), out);
});

// ── 2. translate() 를 잘라 가짜 모델로 ──
function cut(name) {
    const re = new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('), start = source.search(re);
    assert(start >= 0, name);
    return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2).replace(/^export /, '');
}
const BRACKET_NOTE = /\nconst BRACKET_NOTE = '([^']*)'/.exec(source)?.[1] ?? '';   // 2.5.2 대사 괄호 안내 한 줄 (모델에 가는 글에서 떼고 본다)
const ctx = { chatMetadata: {}, chat: [] }, S = { llm_prompt_chat: 'Translate visible text.', glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled' };
const PREFIX = 'Translate visible text.\n\n';
const env = { ...card, ...seg, ...resume, ...auto, cardValues: cardValueModule.cardValues, getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S, getContext: () => ctx,
    guards: { capture: () => ({ assert() {} }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }), document: { getElementById: () => null },
    BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
    buildGlossaryBlock: () => '', checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
    looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
    tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [], dropDanglingOpenQuote: x => x,
    runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
    correctBackticks: x => x, window: {}, toastr: { warning() {} }, globalThis: { toastr: { warning() {} } }, BRACKET_NOTE,
};
function install(name) { env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env); return env[name]; }
for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
    'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'tidyGlossaryOutput', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'liveChatPrompt', 'translate', 'hideBrokenCommentsOnRender']) install(name);
env.tidyGlossaryOutput = (_s, x) => x;
const sent = [];
let model = body => ko(body);
env.callLLMAPI = async prompt => {
    assert(prompt.startsWith(PREFIX));
    const body = prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', '');
    sent.push(body);
    if (body.startsWith(BATCH_HEADER)) return model(body.slice(BATCH_HEADER.length), true);
    return model(body, false);
};
const reset = async () => { sent.length = 0; model = body => ko(body); await seg.clearSegmentCache(); await resume.clearCheckpoints(); };

await check('chunk path: the comment never reaches the model and comes back verbatim, closed, in place', async () => {
    await reset(); env.CHUNK_TARGET = 300;
    const out = await env.translate(MESSAGE);
    env.CHUNK_TARGET = 100000;
    assert(sent.length > 1, 'chunked');
    for (const body of sent) { assert(!body.includes('<!--') && !body.includes('-->') && !body.includes('写作自检'), body.slice(0, 80)); }
    assert.equal(out, ko(MESSAGE));
    assert.equal((out.match(/<!--[\s\S]*?-->/g) || []).length, 3);
    assert.equal(openCommentAt(out), -1);
});
await check('paragraph (cache) path: comment paragraphs are not sent, a reused cache gives the same text', async () => {
    await reset();
    const out = await env.translate(MESSAGE, { segmentCache: true });
    assert.equal(out, ko(MESSAGE));
    assert(sent.every(body => !body.includes('写作自检')));
    const calls = sent.length;
    assert.equal(await env.translate(MESSAGE, { segmentCache: true }), out);
    assert.equal(sent.length, calls, 'second run is served from the paragraph cache');
});
await check('whole path (short message) keeps the comment too', async () => {
    await reset();
    const short = `${ASK}\n\n${COMMENT}\n\n${WAIT}`;
    assert.equal(await env.translate(short), ko(short));
    assert(!sent[0].includes('<!--'));
});
await check('a model that drops the comment placeholder still gets the comment back', async () => {
    await reset();
    model = body => ko(body).replace(/\[\[__VAR_\d+__\]\]\n\n/g, '');
    const short = `${ASK}\n\n${COMMENT}\n\n${WAIT}`;
    const out = await env.translate(short);
    assert.equal((out.match(/<!--[\s\S]*?-->/g) || []).length, 1);
    assert.equal(openCommentAt(out), -1);
});
const stopAtStar = body => { const full = ko(body), at = full.indexOf('『별'); return at < 0 ? full : full.slice(0, at + 2); };
await check('chunk answer that stops mid-sentence: halves are retried, only the stubborn part stays original with a marker — nothing is lost silently', async () => {
    await reset(); env.CHUNK_TARGET = 300;
    model = stopAtStar;
    const out = await env.translate(MESSAGE);
    env.CHUNK_TARGET = 100000;
    assert(!out.includes('『별'), 'the cut answer is never attached');
    assert(out.includes('[차단된 문단 — 원문 그대로]\n') && out.includes(ASK), 'the stubborn chunk is kept in the original with a marker');
    for (const n of [1, 2, 3, 13, 14, 15]) assert(out.includes(LINE_KO(n)), 'other chunks are translated: ' + n);
    assert(out.includes(WAIT) || out.includes(WAIT_KO), 'the paragraph after the cut point is not lost');
    assert.equal(openCommentAt(out), -1);
});
await check('a transient cut is healed by the half retry', async () => {
    await reset(); env.CHUNK_TARGET = 300;
    let first = true;
    model = body => { if (first && body.includes(ASK)) { first = false; return stopAtStar(body); } return ko(body); };
    const out = await env.translate(MESSAGE);
    env.CHUNK_TARGET = 100000;
    assert.equal(out, ko(MESSAGE));
});
await check('paragraph path: a passage cut mid-sentence ends up as original + "끊김" marker, the others translated', async () => {
    await reset();
    model = (body, batch) => { const full = ko(body); const at = full.indexOf('『별'); return at < 0 ? full : full.slice(0, at + 2); };
    const out = await env.translate(MESSAGE, { segmentCache: true });
    assert(out.includes('[번역 답이 중간에 끊김 — 원문 그대로]\n' + ASK), out.slice(0, 400));
    assert(out.includes(WAIT_KO) && out.includes(LINE_KO(15)));
    assert(!out.includes('『별은 왜'), 'no half sentence');
});
await check('whole path: a short message whose answer is cut is not attached (error instead of a half translation)', async () => {
    await reset();
    model = stopAtStar;
    const short = [LINE(1), LINE(2), ASK, WAIT].join('\n\n');
    await assert.rejects(env.translate(short), error => error.cut === true);
});

// ── 3. 표시 보정 훅 ──
await check('render hook hides unclosed comments only while a translation is shown, registered once', () => {
    const hooks = [];
    ctx.messageFormatter = { stage: { BEFORE_REGEX: 'beforeRegex' }, order: { EARLIEST: 0 }, addHook: (fn, options) => hooks.push({ fn, options }) };
    env.commentHookAdded = false; install('tidyNamesShown'); install('hideBrokenCommentsOnRender');
    env.hideBrokenCommentsOnRender(); env.hideBrokenCommentsOnRender();
    assert.equal(hooks.length, 1);
    assert.deepEqual(hooks[0].options, { stage: 'beforeRegex', order: 0 });
    const stored = `<content>\n<!--  점검:\n관찰자의 시점\n\n${LINE_KO(1)}\n</content>`;
    ctx.chat = [{ mes: MESSAGE, extra: { display_text: stored } }, { mes: MESSAGE, extra: {} }];
    const hook = hooks[0].fn;
    assert.equal(hook(stored, { messageId: 0, isReasoning: false }), `<content>\n\n${LINE_KO(1)}\n</content>`);
    assert.equal(ctx.chat[0].extra.display_text, stored, 'stored data untouched');
    assert.equal(hook(MESSAGE, { messageId: 0 }), MESSAGE, 'original view untouched');
    assert.equal(hook('<!-- x', { messageId: 1 }), '<!-- x', 'no translation shown');
    assert.equal(hook('<!-- x', { messageId: -1 }), '<!-- x', 'streaming preview');
    delete ctx.messageFormatter; ctx.chat = [];
});

// ── 4. 연결 · 판 ──
await check('2.5.1 wiring: comment rule after the 6.5.4 rules, hook registered at start-up, version shown', () => {
    const rules = env.getCombinedRegexes().map(r => r.source);
    assert(rules.indexOf('<!--[\\s\\S]*?-->') > rules.findIndex(r => r.includes('scene_plan')));
    assert(/\n {4}hideBrokenCommentsOnRender\(\);/.test(source));
    const version = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;
    assert(/^2\.(?:5\.[1-9]|[6-9]\.)\d*$/.test(version), version);   // 2.6.0 번역 점검도 이 규칙 위
    assert(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes(`>v${version}<`));
});

console.log(`translator-comments: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
