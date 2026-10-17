// 테마 6.9.6 — 번역 실패 표시(「[번역 실패: … — 원문 그대로]」)가 캐시에 들어가 다시 번역해도 낫지 않던 것 (사용자 폰 제보 재현).
//   증상: 묶음 하나가 90초 시간 초과로 실패해 그 문단들이 실패 표시 + 원문으로 남음 → 「번역」을 다시 누르면 「IndexedDB에서 번역문을 가져왔습니다」로
//         같은 실패 표시를 다시 붙이고 그 문단을 보내지 않음 → 번역 기록을 지워야 나음.
//   원인(재현으로 확인): 번역 점검 자동 고치기가 실패 문단 하나만 다시 번역해 저장(saveCheckedTranslation)하면서 남은 실패 표시까지 메시지 캐시에 넣었다.
//         메시지 번역 길은 일부 실패면 캐시에 안 넣었지만, 점검 · 수정 저장 · 고른 글 지우기 · 가져오기는 그런 검사가 없었다.
//   ① 재현: 묶음 하나 시간 초과 → 실패 표시 둘 이상 · 점검이 'blocked' 로 고름 → 자동 고치기 「이 문단만」 → 저장하려던 글에 실패 표시가 남음
//   ② 고친 뒤: 그 글은 캐시에 안 들어가고 · 다음 「번역」은 메시지 캐시를 안 쓰고 실패 문단만 다시 보낸다 (된 문단은 문단 캐시에서)
//   ③ 이미 들어 있는 실패 표시 줄(메시지 캐시 · 문단 캐시)은 읽을 때 없는 셈 → 저절로 낫는다 · 어느 저장 길로도 다시 안 들어간다
// 가상 문장만 쓴다.  node tools/tests/translator-fail-cache.mjs [테마 뿌리, 기본 .]
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
const S = { llm_prompt_chat: 'Translate visible text.', glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled',
    connection_mode: 'direct', llm_provider: 'x', parameters: { x: { max_length: 300 } } };   // 출력 한도를 작게 — 묶음이 여럿으로 나뉜다
const T = { chat: [], saved: 0, warnings: [] };
const PREFIX = 'Translate visible text.\n\n';
const hash = t => String([...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
const env = { ...KOREAN_KEEP_ENV, ...card, ...seg, ...resume, ...auto, ...notify, ...check, cardValues: cardValueModule.cardValues, getStringHash: hash, extensionSettings: S,
    getContext: () => ({ chatMetadata: {}, chat: T.chat, chatId: 'chat-A', name1: 'You', saveChat: async () => { T.saved++; } }),
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

let firstTry = null;
await test('① 재현: 묶음 하나가 90초 시간 초과 → 그 문단들만 실패 표시 + 원문 · 메시지 번역 길은 일부 실패라 캐시에 안 넣는다', async () => {
    await seg.clearSegmentCache(); rows.length = 0; sent.length = 0;
    timeoutWhen = body => body.includes(SRC[5]);   // 6번째 문단이 든 묶음
    const report = {};
    firstTry = await env.translate(MESSAGE, { segmentCache: true, report });
    assert(sent.length >= 3, `묶음 ${sent.length}개`);
    const marks = failLines(firstTry);
    assert(marks.length >= 2, `실패 표시 ${marks.length}`);
    assert(marks.every(line => line.includes(TIMEOUT_MSG.slice(0, 20))), marks[0]);
    assert.equal(report.partial, true, '일부 실패');
    assert(firstTry.includes(KO[0]) && firstTry.includes(SRC[5]), '된 문단은 번역 · 실패 문단은 원문');
});
await test('① 재현(고치기 전 동작 — 실패 표시 검사를 빼면): 자동 고치기가 남은 실패 표시까지 메시지 캐시에 넣고 · 다음 「번역」이 그 캐시를 그대로 쓴다', async () => {
    const realMark = env.hasFailMark;
    env.hasFailMark = () => false;
    try {
        timeoutWhen = () => false; rows.length = 0;
        const message = { mes: MESSAGE, name: 'Narrator', extra: { display_text: firstTry, original_text_hash: hash(MESSAGE) } };
        T.chat = [message];
        const state = env.checkStateOf(0);
        const row = check.checkTranslation(state.source, state.translation, { protect: state.protect }).paragraphs.find(p => p.reasons.includes('blocked'));
        await env.runCheckAction('retry', 0, row.index, row, { auto: true });
        const cached = await env.readCachedTranslation(MESSAGE);
        assert.ok(cached && failLines(cached).length >= 1, '실패 표시가 든 글이 캐시에서 나온다 (= 「IndexedDB에서 번역문을 가져왔습니다」 + 같은 실패 표시)');
    } finally { env.hasFailMark = realMark; rows.length = 0; await seg.clearSegmentCache(); }
    // 문단 캐시를 비웠으니 ①의 첫 번역을 다시 (된 문단을 문단 캐시에 되돌린다)
    timeoutWhen = body => body.includes(SRC[5]);
    firstTry = await env.translate(MESSAGE, { segmentCache: true });
    timeoutWhen = () => false;
});
await test('① 재현 → ② 고친 뒤: 점검 자동 고치기가 실패 문단 하나만 다시 번역해 저장 — 남은 실패 표시가 든 글은 메시지 캐시에 안 들어간다', async () => {
    timeoutWhen = () => false; sent.length = 0;
    const message = { mes: MESSAGE, name: 'Narrator', extra: { display_text: firstTry, original_text_hash: hash(MESSAGE) } };
    T.chat = [message];
    const state = env.checkStateOf(0);
    const result = check.checkTranslation(state.source, state.translation, { protect: state.protect });
    const blocked = result.paragraphs.filter(p => p.reasons.includes('blocked'));
    assert(blocked.length >= 2 && blocked[0].sure, JSON.stringify(result.paragraphs));
    await env.runCheckAction('retry', 0, blocked[0].index, blocked[0], { auto: true });
    const after = message.extra.display_text;
    assert.equal(failLines(after).length, failLines(firstTry).length - 1, '그 문단만 고쳐짐 — 나머지 실패 표시는 남은 글을 저장하려 했다 (전엔 이 글이 캐시에 들어갔다)');
    assert.equal(rows.filter(r => r.originalText === MESSAGE).length, 0, '실패 표시가 남은 글은 메시지 캐시에 넣지 않는다');
    assert(T.warnings.some(w => /실패 표시가 남은 글/.test(w)));
    assert.equal(await env.readCachedTranslation(MESSAGE), null, '다음 「번역」은 캐시를 안 쓴다');
});
await test('② 다음 「번역」: 메시지 캐시 없음 → 문단 캐시로 된 문단은 그대로 · 실패한 문단만 다시 보내 실패 표시가 없어진다', async () => {
    sent.length = 0;
    const report = {};
    assert.equal(await env.readCachedTranslation(MESSAGE), null);
    const again = await env.translate(MESSAGE, { segmentCache: true, report });
    assert.equal(again, join(KO), '전부 번역');
    assert.equal(failLines(again).length, 0);
    assert(sent.length >= 1 && sent.every(body => !body.includes(SRC[0])), '된 문단은 다시 보내지 않는다');
    assert(sent.some(body => body.includes(SRC[6])), '실패했던 문단은 다시 보낸다 (시간 초과 문단도)');
    assert.equal(report.partial, false);
    await env.storeTranslationQuietly(MESSAGE, again);
    assert.equal(await env.readCachedTranslation(MESSAGE), join(KO), '온전한 번역은 예전처럼 캐시');
});
await test('③ 6.9.5 까지 들어간 실패 표시 줄: 메시지 캐시는 읽을 때 없는 셈(더 오래된 좋은 줄이 있으면 그것) · 문단 캐시 줄도 다시 요청해 저절로 낫는다', async () => {
    rows.length = 0; await seg.clearSegmentCache(); sent.length = 0;
    rows.push({ id: nextId++, originalText: MESSAGE, translation: firstTry });
    assert.equal(await env.readCachedTranslation(MESSAGE), null, '실패 표시 줄은 없는 셈');
    rows.unshift({ id: nextId++, originalText: MESSAGE, translation: join(KO) });
    assert.equal(await env.readCachedTranslation(MESSAGE), join(KO), '그 앞의 좋은 줄은 쓴다');
    // 문단 캐시에 실패 표시가 든 줄을 넣어 둔다 — 검사를 빼고(6.9.5 처럼) 같은 열쇠로 → 검사를 되살리면 그 줄을 안 쓰고 그 문단만 다시 보낸다
    const poisoned = SRC.slice(0, 2), realMark = env.hasFailMark, realCall = env.callLLMAPI;
    env.hasFailMark = () => false;
    env.callLLMAPI = async prompt => (await realCall(prompt)).replace(KO[1], `[번역 실패: ${TIMEOUT_MSG} — 원문 그대로]\n${KO[1]}`);
    const seeded = await env.translate(join(poisoned), { segmentCache: true });
    assert.equal(failLines(seeded).length, 1, '실패 표시 줄이 든 답');
    env.hasFailMark = realMark; env.callLLMAPI = realCall; sent.length = 0;
    const out = await env.translate(join(poisoned), { segmentCache: true });
    assert.equal(out, join(KO.slice(0, 2)));
    assert.equal(failLines(out).length, 0);
    assert.equal(sent.length, 1);
    assert(sent[0].includes(SRC[1]) && !sent[0].includes(SRC[0]), '그 문단만 다시 (다른 문단은 문단 캐시에서)');
});
await test('③ 어느 저장 길로도 다시 안 들어간다: storeTranslationQuietly · addTranslationToDB(수정 저장 · 고른 글 지우기 · 가져오기가 쓰는 것) · 차단 표시도', async () => {
    rows.length = 0;
    await env.storeTranslationQuietly('src-a', firstTry);
    assert.equal(await env.addTranslationToDB('src-b', firstTry), 'skipped');
    await env.addTranslationToDB('src-c', `${KO[0]}\n\n[차단된 문단 — 원문 그대로]\n${SRC[1]}`);
    assert.equal(rows.length, 0);
    await env.addTranslationToDB('src-d', '그냥 「원문 그대로」라는 말이 든 번역');
    assert.equal(rows.length, 1, '실패 표시 줄이 아니면 그대로 저장');
    assert.equal(env.hasFailMark(env.failMarkOf(Object.assign(new Error('HTTP 429 [rate]'), {}))), true, '원인에 ] 가 들어도 알아본다');
});
await test('연결: 실패 표시 검사가 메시지 캐시 읽기 · 쓰기 · 문단 캐시 판정에 · release-check 에 이 시험', () => {
    assert.match(cut('storeTranslationQuietly'), /if \(hasFailMark\(translation\)\)/);
    assert.match(cut('addTranslationToDB'), /if \(hasFailMark\(translation\)\) return 'skipped';/);
    assert.match(cut('getTranslationFromDB'), /&& !hasFailMark\(item\.translation\)\);/);
    assert.match(source, /if \(!displayCards\.cacheable\(body, out\) \|\| hasFailMark\(out\)\) return false;/);
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/translator-fail-cache\.mjs \./);
});

console.log(`translator-fail-cache: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
