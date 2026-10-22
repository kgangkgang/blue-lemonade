// 7.7.4 번역 API 실패 주입 — 묶음 번역이 같은 실패를 묶음마다 다시 받거나 · 거절문을 번역문으로 남기지 않는지
//   ① 키 · 권한 오류(다시 보내도 같음): 첫 묶음에서 멈추고 남은 묶음은 보내지 않는다 (전엔 묶음 수만큼 보냈다)
//   ② 429 · 5xx: 그 묶음만 1.5초 뒤 한 번 더(예전 그대로), 그래도 실패하면 남은 묶음은 보내지 않는다
//   ③ 90초 시간 초과는 그 묶음만 — 다음 묶음은 계속 (translator-fail-cache ① 과 같은 뜻)
//   ④ 한국어로 옮기라 했는데 한글 없는 영어 거절문이 온 문단은 번역문으로 붙이지 않는다 (원문 대사에 부정어가 있어도)
//   node tools/tests/fault-translator.mjs <테마 뿌리>   (시험대는 translator-fail-cache.mjs 와 같다 — 가상 문장 · 네트워크 0)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KOREAN_KEEP_ENV } from './korean-keep-env.mjs';   // 2.7.9 이미 한국어인 부분 판정 (korean-keep.js · KOREAN_TARGET)

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const check = await import(pathToFileURL(path.join(dir, 'translation-check.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const notify = await import(pathToFileURL(path.join(root, 'src/rerender-notify.js')));

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}
function cut(name) {
    const at = source.search(new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('));
    assert(at >= 0, name);
    return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2).replace(/^export /, '');
}
const constLine = name => source.match(new RegExp(`^const ${name} = .+?;(?= *(?://|$))`, 'm'))[0];   // 줄 끝 주석은 빼고

// ── 지어낸 답장 12문단 (영어 원문 → 한국어) ──
const SRC = Array.from({ length: 12 }, (_, i) => `Line ${i + 1}: The lantern by the window flickered while the kettle hummed softly over the stove.`);
const KO = SRC.map((_, i) => `${i + 1}번째 줄: 창가의 등불이 깜박이는 동안 주전자가 화덕 위에서 나지막이 노래했다.`);
const join = list => list.join('\n\n');
const ko = text => SRC.reduce((value, line, i) => value.split(line).join(KO[i]), String(text));
const TIMEOUT_MSG = '90초 안에 답이 없어 끊었어요. 요청을 더 작게 나누거나 잠시 뒤 다시 해 주세요.';

// ── 가짜 IndexedDB (번역 기록 저장소: originalText 색인) — index.js 의 addTranslationToDB · getTranslationFromDB 를 그대로 돌린다 ──
const rows = [];
let nextId = 1;
const later = fn => setTimeout(fn, 0);
const fakeDb = () => ({
    close() {},
    transaction() {
        const tx = {
            objectStore: () => ({
                index: () => ({
                    getAll(key) { const req = {}; later(() => { req.onsuccess?.({ target: { result: rows.filter(r => r.originalText === key).map(r => ({ ...r })) } }); later(() => tx.oncomplete?.()); }); return req; },
                    getAllKeys(key) { const req = {}; later(() => { req.result = rows.filter(r => r.originalText === key).map(r => r.id); req.onsuccess?.(); later(() => tx.oncomplete?.()); }); return req; },
                }),
                add(record) { const req = {}; rows.push({ ...record, id: nextId++ }); later(() => req.onsuccess?.({})); return req; },
                put(record) { const req = {}; const at = rows.findIndex(r => r.id === record.id); rows[at] = { ...record }; later(() => req.onsuccess?.({})); return req; },
                delete(id) { const at = rows.findIndex(r => r.id === id); if (at >= 0) rows.splice(at, 1); },
            }),
        };
        return tx;
    },
});

// ── index.js 를 잘라 가짜 실리태번 위에서 (translator-check.mjs 와 같은 꼴) ──
const BRACKET_NOTE = /\nconst BRACKET_NOTE = '([^']*)'/.exec(source)?.[1] ?? '';
const S = { llm_prompt_chat: 'Translate visible text into Korean.', glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled',
    connection_mode: 'direct', llm_provider: 'x', parameters: { x: { max_length: 300 } } };   // 출력 한도를 작게 — 묶음이 여럿으로 나뉜다
const T = { chat: [], chatMetadata: {}, saved: 0, warnings: [] };
const PREFIX = 'Translate visible text into Korean.\n\n';
const hash = t => String([...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
const env = { ...KOREAN_KEEP_ENV, ...card, ...seg, ...resume, ...auto, ...notify, ...check, cardValues: cardValueModule.cardValues, getStringHash: hash, extensionSettings: S,
    getContext: () => ({ chatMetadata: T.chatMetadata, chat: T.chat, chatId: 'chat-A', name1: 'You', saveChat: async () => { T.saved++; } }),
    guards: { capture: () => ({ assert() {}, valid: () => true, settled: () => true }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }),
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
    MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
    buildGlossaryBlock: () => '', checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
    looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
    tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [],
    runtimeProtections: new Map(), console: { debug() {}, info() {}, warn: (...a) => T.warnings.push(a.join(' ')), error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
    correctBackticks: x => x, window: {}, toastr: { info() {}, warning() {}, success() {}, error() {} }, globalThis: { toastr: { warning() {} } }, BRACKET_NOTE, processTranslationText: (_o, t) => t,
    refreshMessageBlock: () => {}, originalHashOf: hash, markTranslatedOriginal: (message, text) => { message.extra.original_text_hash = hash(text); }, rememberTranslation: () => {},
    eventSource: { emit() {} }, emitTranslationUIUpdate: () => {}, syncMesToSwipe: () => {}, publishArchiveReady: () => {}, translationInProgress: {}, afterWorkEnds: new WeakMap() /* 2.7.4 번역 표 → 뒷일 다리 끝 함수 (index.js 모듈 상수) */, progressBadge: () => ({ update() {}, remove() {} }),
    translateMessage: async () => {}, loadCheckLib: async () => check, checkView: { schedule() {}, close() {}, mark: (_id, mes) => mes, finish: x => x },
    FOLD_MARKUP: /llm-translator-details|class="(?:translated|original)_text|llmt-para-gap/, hasSourceEcho: seg.hasSourceEcho, matchesDisplayCardStructure: card.matchesDisplayCardStructure,
    openDB: async () => fakeDb(), STORE_NAME: 'translations',
};
for (const name of ['BLOCKED_CHUNK_MARK', 'MARK_TAIL']) env[name] = new Function(`${constLine(name)}; return ${name};`)();   // hasFailMark 는 ...seg (translation-segments.js)
function install(name) { env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env); return env[name]; }
for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
    'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'liveChatPrompt', 'translate',
    'beginTranslation', 'endTranslation', 'isTranslationInProgress', 'checkStateOf', 'saveCheckedTranslation', 'runCheckAction',
    'addTranslationToDB', 'getTranslationFromDB', 'readCachedTranslation', 'storeTranslationQuietly']) install(name);
env.forgetSegments = seg.forgetSegments;
const sent = [];
let timeoutWhen = () => false;
env.callLLMAPI = async prompt => {
    const body = prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', '');
    sent.push(body);
    if (timeoutWhen(body)) throw Object.assign(new Error(TIMEOUT_MSG), { timeout: true });
    return ko(body.startsWith(seg.BATCH_HEADER) ? body.slice(seg.BATCH_HEADER.length) : body);
};
const MESSAGE = join(SRC);
const failLines = text => (String(text).match(/^\[[^\n]* — 원문 그대로\]$/gm) || []);

const TRANSIENT_LINE = constLine('isTransientError');
env.isTransientError = new Function(`${TRANSIENT_LINE}; return isTransientError;`)();
env.REFUSAL_PATTERN = /I'm sorry|I am sorry|죄송/i;   // 실제 정규식은 index.js 의 긴 목록 — 여기선 배선만 본다
env.REFUSAL_TOPIC = /request|translat/i;
const groupsOf = () => new Set(sent.map(body => body.slice(0, 40))).size;
async function run(fail) {
    await seg.clearSegmentCache(); rows.length = 0; sent.length = 0; T.warnings.length = 0;
    let n = 0;
    env.callLLMAPI = async prompt => {
        const body = prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', '');
        sent.push(body); n++;
        const out = fail(body, n);
        if (out instanceof Error) throw out;
        return out ?? ko(body.startsWith(seg.BATCH_HEADER) ? body.slice(seg.BATCH_HEADER.length) : body);
    };
    try { return { text: await env.translate(join(SRC), { segmentCache: true, report: {} }) }; } catch (error) { return { error }; }
}
await test('baseline: the 12-paragraph reply goes out in 3 or more bundles', async () => {
    const r = await run(() => null);
    assert.ok(!r.error, String(r.error));
    assert.ok(sent.length >= 3, `bundles ${sent.length}`);
});
await test('① a key / permission error stops at the first bundle (no request for the rest)', async () => {
    const r = await run(() => new Error('API 키가 잘못되었거나 권한이 없습니다.'));
    assert.equal(sent.length, 1, `sent ${sent.length}`);
    assert.ok(r.error && /API 키/.test(r.error.message), 'the whole translation fails with that reason');
});
await test('② 429 is retried once for that bundle, then the rest are not sent', async () => {
    const r = await run(() => Object.assign(new Error('요청 한도를 넘었어요. 잠시 뒤 다시 시도해 주세요.'), { transient: true }));
    assert.equal(sent.length, 2, `sent ${sent.length} (one bundle + its retry)`);
    assert.ok(r.error);
});
await test('② a failure after the first bundle succeeded keeps the done paragraphs and marks the rest', async () => {
    const r = await run((body, n) => n >= 2 ? Object.assign(new Error('서버가 일시적으로 응답하지 못했어요.'), { transient: true }) : null);
    assert.equal(sent.length, 3, `first ok + second bundle + its retry: ${sent.length}`);
    assert.ok(r.text && r.text.includes(KO[0]), 'first bundle translated');
    assert.ok(failLines(r.text).length >= 2, 'later paragraphs marked as failed');
});
await test('③ a timeout only fails its bundle — the next bundles are still sent', async () => {
    const r = await run(body => body.includes(SRC[5]) ? Object.assign(new Error(TIMEOUT_MSG), { timeout: true }) : null);
    assert.ok(sent.length >= 3, `sent ${sent.length}`);
    assert.ok(r.text && r.text.includes(KO[11]), 'last paragraph translated');
});
await test('④ an English refusal for a Korean target is not kept as the translation of a line that says "never"', async () => {
    SRC[3] = 'Line 4: "But one of them never listens," she said.';
    try {
        const REFUSAL = "I'm sorry, but I can't help with that request.";
        const r = await run(body => body.includes(SRC[3]) ? ko((body.startsWith(seg.BATCH_HEADER) ? body.slice(seg.BATCH_HEADER.length) : body).split(SRC[3]).join(REFUSAL)) : null);
        assert.ok(sent.some(body => body.includes(SRC[3])), 'the line was sent');
        const text = r.text ?? '';
        assert.ok(!text.includes(REFUSAL), 'refusal text not used as a translation');
        assert.ok(text.includes(KO[0]), 'other lines still translated');
    } finally { SRC[3] = 'Line 4: The lantern by the window flickered while the kettle hummed softly over the stove.'; }
});
await test('⑤ after one bundle is blocked through every retry step, the remaining bundles are sent once each (not the whole fan-out again)', async () => {
    const r = await run(() => Object.assign(new Error('요청이 거절됐어요 (400 Bad Request).'), { refused: true }));
    const last = sent.filter(body => body.includes(SRC[11])).length;
    assert.equal(last, 1, `last bundle sent ${last} times`);
    assert.ok(sent.length <= 20, `total ${sent.length}`);
    assert.ok(r.error || failLines(r.text).length >= 12, 'all paragraphs failed');
});
await test('교정 guard (behaviour): a short answer cut mid-sentence or a refusal is rejected, a normal correction passes', () => {
    const check = install('assertRetranslationUsable');
    const old = '번역: 창가의 등불이 깜박이고 주전자가 나지막이 울었다. 번역: 창가의 등불이 깜박였다.';
    assert.throws(() => check(old, 'The lamp flickered.', '가짜 응답이에요. 창가의'), e => e.cut === true, 'cut short mid-word');
    assert.throws(() => check(old, 'The lamp flickered.', "I'm sorry, but I can't help with that request."), e => e.refused === true, 'English refusal');
    assert.doesNotThrow(() => check(old, 'The lamp flickered.', '창가의 등불이 깜박이고 주전자가 나지막이 울었다. 등불이 깜박였다.'), 'normal correction');
    assert.doesNotThrow(() => check(old, 'The lamp flickered.', '등불이 깜박였어요'), 'shorter but ends a sentence (말끝)');
});
await test('stream adapter keeps the status code in front of the message; 401/403 stream errors are read, not re-sent', () => {
    assert.match(source, /const status = reply\.replay\?\.ok === false \? `\$\{reply\.replay\.status\} \$\{reply\.replay\.statusText \|\| ''\}`\.trim\(\) : '';/);
    assert.match(source, /const authLike = \[401, 402, 403\]\.includes\(response\.status\)/);
    assert.match(source, /if \(requestDown\) \{ for \(const body of group\) failReasons\.set\(body, requestDown\);/);
});

await test('current connection: parser / cut / 524 errors from SillyTavern become readable Korean, retry rules unchanged', async () => {
    const cc = await import(pathToFileURL(path.join(dir, 'current-connection.js')));
    const ask = async thrown => { try { await cc.requestCurrentConnection({ context: () => ({ mainApi: 'openai', chatCompletionSettings: {}, ChatCompletionService: { processRequest: async () => { throw thrown; } } }), messages: [{ role: 'user', content: 'x' }], buildChat: async () => ({}) }); return null; } catch (e) { return e; } };
    const cases = [
        [Object.assign(new SyntaxError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`)), /오류 페이지\(HTML\)/, false],
        [new Error('Unexpected end of JSON input'), /빈 답/, false],
        [new Error('Unterminated string in JSON at position 46 (line 1 column 47)'), /잘려/, false],
        [new Error('Invalid response body while trying to fetch http://x/v1/chat/completions: Premature close'), /연결이 끊겼/, false],
        [new Error('unknown'), /알려 주지 않았/, false],
        [new Error('Response not OK'), /실패」만/, false],
        [new Error('Too Many Requests'), /요청 한도/, true],
    ];
    for (const [thrown, want, transient] of cases) {
        const e = await ask(thrown);
        assert.ok(e && want.test(e.message), thrown.message + ' -> ' + e?.message);
        assert.equal(!!e.transient, transient, 'retry rule kept for ' + thrown.message);
    }
});

await test('교정 keeps the old translation when the answer is a refusal or cut far shorter (checked before cache · display · save)', () => {
    const at = source.indexOf('async function retranslateMessage(');
    const body = source.slice(at, source.indexOf('\n}\n', at));
    const guard = body.indexOf('if (existingTranslation) assertRetranslationUsable(existingTranslation, originalText, retranslation);');
    assert.ok(guard > 0, 'guard');
    assert.ok(guard < body.indexOf('storeTranslationQuietly(originalText, retranslation'), 'before the cache write');
    assert.ok(guard < body.indexOf('target.extra.display_text = processTranslationText(originalText, retranslation)'), 'before the display write');
    const fn = source.slice(source.indexOf('function assertRetranslationUsable('), at);
    assert.match(fn, /if \(refused\) throw refusalError\(out\);/);
    assert.match(fn, /if \(looksCutShort\(existingTranslation, out\) \|\| \(midSentence/);
});

console.log(`fault-translator: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
