// 7.3.1 번역기 문단 캐시 — 81문단을 넘는 긴 답도 문단으로 나눠, 원문 한 문단을 고치면 그 문단만 다시 보낸다.
//   ① 상한 801조각(401문단) · ② 고친 문단만 요청 · ③ 캐시 크기(4000문단 · 200만 자 · LRU) · ④ 긴 첫 번역이 한 번호 묶음(⟦n⟧)으로 갈 때
//   모델이 번호를 빠뜨려도 예전 길(번호 없이 통짜로 한 번 더)로 90문단이 다 붙는다.
// 글은 합성 — 실제 채팅을 읽지 않는다. 노드에는 indexedDB 가 없어 메모리 캐시로 돈다 (저장소 크기는 실리태번 rig 에서 따로 쟀다).
//   node tools/tests/translator-segment-cap.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KOREAN_KEEP_ENV } from './korean-keep-env.mjs';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const { segmentParagraphs, translateSegments, clearSegmentCache, batchGroups, SEGMENT_PARTS_MAX, SEGMENT_CACHE_LIMITS, pruneKeys } = seg;

// 사용자 채팅의 긴 답과 같은 꼴: 89문단, 문단마다 150자 안팎, 13000자쯤
const paragraph = (i, tag = '') => `Paragraph ${tag}${i} keeps the scene moving while the lantern light flickers over the harbor and the gulls circle low above the quiet pier at dusk.`;
const message = (n, tag = '') => Array.from({ length: n }, (_, i) => paragraph(i, tag)).join('\n\n');
const text89 = message(89);

let passed = 0, failed = 0;
const check = async (name, fn) => {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
};

await check('89-paragraph reply is split into paragraphs (7.3.0 returned null above 161 parts → whole-message request)', () => {
    assert.equal(SEGMENT_PARTS_MAX, 801);
    const parts = segmentParagraphs(text89);
    assert.ok(Array.isArray(parts), 'segmentParagraphs returned null');
    assert.equal(parts.length, 89 * 2 - 1);
    assert.equal(parts.join(''), text89, 'parts rebuild the exact text');
});

await check('81 paragraphs (old limit) and 90 paragraphs both split; absurd sizes still fall back', () => {
    assert.ok(Array.isArray(segmentParagraphs(message(81))));
    assert.ok(Array.isArray(segmentParagraphs(message(90))));
    assert.ok(Array.isArray(segmentParagraphs(message(401))), '401 paragraphs = 801 parts');
    assert.equal(segmentParagraphs(message(402)), null);
    assert.equal(segmentParagraphs(message(2000)), null, 'very large paragraph counts keep the whole/chunk path');
    assert.equal(segmentParagraphs(`<details>\n\n${text89}\n\n</details>`), null, 'structured HTML still not split');
});

await check('first translation of 89 paragraphs stays one request at the user limit (24000 tokens × 1.2 chars)', () => {
    const bodies = segmentParagraphs(text89).filter((_, i) => i % 2 === 0);
    assert.equal(batchGroups(bodies, Math.round(24000 * 1.2)).length, 1);
});

await check('edit one sentence in one paragraph → only that paragraph is requested, 88 come from the cache', async () => {
    await clearSegmentCache();
    const calls = [], stages = [];
    const go = text => translateSegments({ parts: segmentParagraphs(text), signature: () => 'setup', progress: info => stages.push(info), request: async bodies => { calls.push([...bodies]); return bodies.map(b => `번역 ${b.length}`); } });
    const first = await go(text89);
    assert.equal(first.translated, 89); assert.equal(calls.length, 1); assert.equal(calls[0].length, 89);
    const edited = text89.replace(paragraph(49), paragraph(49).replace('flickers', 'flickered'));
    assert.notEqual(edited, text89);
    calls.length = 0; stages.length = 0;
    const second = await go(edited);
    assert.equal(calls.length, 1, 'one request');
    assert.deepEqual(calls[0], [paragraph(49).replace('flickers', 'flickered')], 'only the edited paragraph is sent');
    assert.equal(second.reused, 88); assert.equal(second.translated, 1); assert.equal(second.resumed, 0);
    assert.deepEqual([stages[0].reused, stages[0].pending, stages[0].resumed], [88, 1, 0], 'first progress tells the toast: 88 cached, 1 changed');
    calls.length = 0;
    const again = await go(edited);
    assert.equal(calls.length, 0, 'same text again (swipe back / reload with display lost) sends nothing');
    assert.equal(again.reused, 89);
});

await check('a changed setup signature (prompt · glossary · connection) still re-translates every paragraph', async () => {
    const calls = [];
    await translateSegments({ parts: segmentParagraphs(text89), signature: () => 'setup-with-new-glossary', request: async bodies => { calls.push(bodies.length); return bodies.map(() => '번역'); } });
    assert.deepEqual(calls, [89]);
});

await check('cache size: 4000 paragraphs and 2,000,000 characters, newest kept first, 30-day expiry', () => {
    assert.deepEqual({ ...SEGMENT_CACHE_LIMITS }, { paragraphs: 4000, chars: 2000000, memory: 1200, pruneEvery: 128, days: 30 });
    const now = 1e12, day = 86400000;
    const rows = Array.from({ length: 4100 }, (_, i) => ({ key: 'k' + i, text: '가'.repeat(150), time: now - i * 1000 }));
    const drop = new Set(pruneKeys(rows, now));
    assert.equal(drop.size, 100); assert.ok(drop.has('k4099') && drop.has('k4000') && !drop.has('k3999') && !drop.has('k0'), 'oldest 100 go');
    // 글자 예산: 문단이 길면 개수보다 먼저 닿는다
    const long = Array.from({ length: 300 }, (_, i) => ({ key: 'L' + i, text: 'x'.repeat(10000), time: now - i }));
    assert.equal(pruneKeys(long, now).length, 100, '200 × 10000 chars = budget');
    // 기한
    assert.deepEqual(pruneKeys([{ key: 'old', text: 'a', time: now - 31 * day }, { key: 'new', text: 'a', time: now - day }], now), ['old']);
    // 순서는 시각 — 꺼내 쓴(시각을 새로 쓴) 줄은 뒤에 쓴 줄보다 오래 남는다
    assert.deepEqual(pruneKeys([{ key: 'a', text: 'a', time: now - 5 }, { key: 'b', text: 'a', time: now - 1 }, { key: 'c', text: 'a', time: now }], now, { limit: 2 }), ['a']);
    // 이어 하기('resume:') 줄은 하루만 읽으니 하루가 지나면 지운다 (예전엔 30일 남아 문단 몫을 차지했다)
    assert.deepEqual(pruneKeys([{ key: 'resume:old', text: 'a', time: now - 2 * day }, { key: 'resume:new', text: 'a', time: now - 3600000 }, { key: 'para', text: 'a', time: now - 2 * day }], now), ['resume:old']);
});

await check('LRU: a chat read again from the cache stays while newer chats push older ones out (memory copy 1200 paragraphs)', async () => {
    await clearSegmentCache();
    const calls = [];
    const go = text => translateSegments({ parts: segmentParagraphs(text), signature: () => 'lru', request: async bodies => { calls.push(bodies.length); return bodies.map(b => `번역 ${b.length}`); } });
    const A = message(89, 'A'), others = Array.from({ length: 13 }, (_, k) => message(89, `B${k}-`));
    await go(A);
    for (const text of others.slice(0, 12)) await go(text);   // 89 × 13 = 1157 문단
    calls.length = 0;
    assert.equal((await go(A)).reused, 89, 'A still cached'); assert.deepEqual(calls, []);
    await go(others[12]);   // 1246 > 1200: 가장 오래 안 쓴 것이 밀려난다 — A 는 방금 썼으니 아니다
    calls.length = 0;
    assert.equal((await go(A)).reused, 89, 'A was touched, so it survived'); assert.deepEqual(calls, []);
    const b0 = await go(others[0]);
    assert.ok(b0.translated > 0, 'the least recently used chat lost paragraphs instead');
});

// ── 실제 translate(): 90문단 첫 번역이 한 번호 묶음으로 가고, 모델이 번호를 빠뜨리면 예전 대비책으로 ──
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
const cut = name => { const re = new RegExp('\\n(?:async )?function ' + name + '\\('), at = source.search(re); return source.slice(at + 1, source.indexOf('\n}', at + 1) + 2); };
const BRACKET_NOTE = /\nconst BRACKET_NOTE = '([^']*)'/.exec(source)?.[1] ?? '';
function realTranslate(reply) {
    const S = { llm_prompt_chat: 'Translate visible text.', glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled', connection_mode: 'direct', llm_provider: 'x', parameters: { x: { max_length: 24000 } } };
    const warnings = [];
    const env = { ...KOREAN_KEEP_ENV, ...card, ...seg, ...resume, ...auto, cardValues: cardValueModule.cardValues, getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S, getContext: () => ({ chatMetadata: {}, chat: [] }),
        guards: { capture: () => ({ assert() {} }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }), document: { getElementById: () => null },
        BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
        buildGlossaryBlock: () => '', checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
        looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
        tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [],
        runtimeProtections: new Map(), console: { debug() {}, info() {}, warn: (...a) => warnings.push(a.join(' ')), error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
        correctBackticks: x => x, window: {}, toastr: { warning() {} }, globalThis: { toastr: { warning() {} } }, BRACKET_NOTE };
    for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
        'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'liveChatPrompt', 'translate']) env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
    env.tidyGlossaryOutput = (_s, x) => x;
    const requests = [];
    env.callLLMAPI = async prompt => {
        let body = prompt.slice(prompt.indexOf('\n\n') + 2);
        if (BRACKET_NOTE && body.startsWith(BRACKET_NOTE)) body = body.slice(BRACKET_NOTE.length + 2);
        const batch = body.startsWith(seg.BATCH_HEADER);
        requests.push({ batch, paragraphs: (batch ? body.slice(seg.BATCH_HEADER.length) : body).split('\n\n').length });
        return reply(batch ? body.slice(seg.BATCH_HEADER.length) : body, batch, requests.length);
    };
    return { env, requests, warnings };
}
const LINE = n => `Line ${n}: The lantern by the window flickered while the kettle hummed softly over the stove and the rain kept tapping on the glass.`;
const KO = n => `${n}번째 줄: 창가의 등불이 깜박이는 동안 주전자가 나지막이 노래했고 비는 계속 유리창을 두드렸다.`;
const ko = text => String(text).replace(/Line (\d+): The lantern by the window flickered while the kettle hummed softly over the stove and the rain kept tapping on the glass\./g, (_, n) => KO(n));
const text90 = Array.from({ length: 90 }, (_, i) => LINE(i + 1)).join('\n\n');
const wanted90 = Array.from({ length: 90 }, (_, i) => KO(i + 1)).join('\n\n');

await check('real translate(): 90-paragraph first translation goes as ONE numbered batch; then a one-word edit sends one paragraph', async () => {
    await clearSegmentCache();
    const { env, requests } = realTranslate(body => ko(body));
    assert.equal(await env.translate(text90, { segmentCache: true }), wanted90);
    assert.deepEqual(requests, [{ batch: true, paragraphs: 90 }]);
    const edited = text90.replace(LINE(37), LINE(37).replace('softly', 'quietly'));
    requests.length = 0;
    const out = await env.translate(edited, { segmentCache: true });
    assert.deepEqual(requests, [{ batch: true, paragraphs: 1 }], 'only the edited paragraph');
    assert.equal(out.split('\n\n').length, 90);
});

await check('real translate(): the model drops marker ⟦36⟧ (merges two passages) → plain re-send without numbers, all 90 paragraphs land and are cached', async () => {
    await clearSegmentCache();
    const { env, requests, warnings } = realTranslate((body, batch) => {
        const out = ko(body);
        return batch ? out.replace(/\n\n⟦36⟧ /, ' ') : out;   // 번호 하나를 빼고 앞 문단에 붙여 버린 답
    });
    assert.equal(await env.translate(text90, { segmentCache: true }), wanted90);
    assert.deepEqual(requests, [{ batch: true, paragraphs: 90 }, { batch: false, paragraphs: 90 }], 'existing fallback: one plain request');
    assert.ok(warnings.some(w => w.includes('형식 오류')), 'logged as a format error, not a refusal');
    requests.length = 0;
    assert.equal(await env.translate(text90, { segmentCache: true }), wanted90);
    assert.deepEqual(requests, [], 'the plain answer was cached per paragraph');
});

await check('real translate(): marker dropped AND the plain answer merges paragraphs → no partial text is attached or cached; the error is a format error', async () => {
    await clearSegmentCache();
    const { env, requests } = realTranslate((body, batch) => batch ? ko(body).replace(/\n\n⟦36⟧ /, ' ') : ko(body).replace(/\n\n(?=36번째)/, ' '));
    await assert.rejects(env.translate(text90, { segmentCache: true }), error => error?.format === true);
    assert.equal(requests.length, 2, 'no split for format errors (it would only add requests)');
    requests.length = 0;
    const { env: env2, requests: r2 } = realTranslate(body => ko(body));
    assert.equal(await env2.translate(text90, { segmentCache: true }), wanted90, 'next try sends everything again (nothing half-cached)');
    assert.deepEqual(r2, [{ batch: true, paragraphs: 90 }]);
});

console.log(`translator-segment-cap: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
