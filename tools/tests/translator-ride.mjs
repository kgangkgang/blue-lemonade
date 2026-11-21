// 1.9.7 본문 번역에 얹기(ride) — 가상 글 · 가짜 모델 · 가짜 창구만.
//   함께 쓰는 확장이 창구 globalThis[Symbol.for('blue-lemonade.translator.ride.v1')] 를 열어 두면, 메시지 번역(options.ride)이 한 요청으로 끝날 때 그 요청 끝 칸에 조각을 실어요.
//   ① 창구가 없거나 낼 조각이 없으면 요청 · 답이 예전과 바이트까지 같아요
//   ② 한 묶음 번역: 요청 1번 · 끝 칸 · 캐시 앞부분(promptCache) 그대로 · 본문 번역 결과(문단 수)가 칸 없는 요청과 같음 · 조각은 창구 쪽에 넘어감
//   ③ 흘려받는 미리 보기에 「⟪」 가 안 보임(통째 길 · 묶음 길)
//   ④ 안 얹는 곳: 여러 묶음 · 캐시만(요청 0) · 다시 번역 · 입력 번역 · 점검 원문 견주기 · 따로 준 프롬프트 · 한국어가 아닌 목표어 · ride 없는 부름
//   ⑤ 다시 보내기(입력 차단 배치 2)에는 안 얹음 · 요청 실패는 drop · 칸만 오고 본문이 빈 답은 칸 없이 빈 답이 온 것과 같게 다룸
//   node tools/tests/translator-ride.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KOREAN_KEEP_ENV } from './korean-keep-env.mjs';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}

const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
const { BATCH_HEADER } = seg;
const { glossarySignature } = await import(pathToFileURL(path.join(dir, 'glossary-sync.js')));

const LONG = 'You translate fiction faithfully into natural Korean. Keep names, tone and line breaks. '.repeat(40);
const EN = ['Mina walked along the pier while the rain kept falling on the old lanterns.', 'The ferryman leaned on the door frame, watching Mina fold the wet map.', 'Nobody on the quay spoke while the bell rang twice over the harbour.'];
const KO = ['미나는 오래된 등불 위로 비가 계속 내리는 동안 부두를 따라 걸었다.', '뱃사공은 문틀에 기대어 미나가 젖은 지도를 접는 것을 지켜보았다.', '종이 항구 위로 두 번 울리는 동안 부둣가의 누구도 말하지 않았다.'];
const PIECES = [['k1', 'She is hiding something.', '뭔가 숨기고 있어.'], ['k2', 'Old friend', '오랜 친구']];
const ko = t => { let out = String(t); EN.forEach((e, i) => { out = out.split(e).join(KO[i]); }); return out; };
const MESSAGE = EN.join('\n\n');
const PROMPT = `${LONG}\nPlease translate the following text to korean:`;
const HUB = Symbol.for('blue-lemonade.translator.ride.v1');
const DELIM = '⟪EXTRA⟫';

// 가짜 창구 — 함께 쓰는 확장이 여는 것과 같은 약속(offer → { block, view, take, drop })만 흉내 내요
function fakeHub(pieces = PIECES) {
    const log = { offers: [], taken: [], dropped: 0, accepted: [] };
    const view = s => { const t = String(s ?? ''); let at = t.indexOf(DELIM); const m = t.search(/⟪\s*e\s*\d/); if (m >= 0 && (at < 0 || m < at)) at = m; if (at >= 0) return t.slice(0, at).replace(/\s+$/, ''); for (let k = Math.min(DELIM.length - 1, t.length); k > 0; k--) if (DELIM.startsWith(t.slice(-k))) return t.slice(0, -k).replace(/\s+$/, ''); return t; };
    return { log, hub: { v: 1, offer(o) {
        log.offers.push(o);
        if (!pieces.length) return null;
        let settled = false;
        return { count: pieces.length,
            block: [DELIM, '[Extra lines from the same scene, not part of the text above.]', ...pieces.map(([, en], i) => `⟪e${i + 1}⟫ ${en}`)].join('\n'),
            view,
            take(raw) {
                const s = String(raw), at = s.indexOf(DELIM);
                const body = at < 0 ? s : s.slice(0, at).replace(/\s+$/, '');
                log.taken.push(s);
                if (!settled && at >= 0) { settled = true; for (const m of s.slice(at).matchAll(/⟪e(\d+)⟫ ([^\n]+)/g)) log.accepted.push([pieces[Number(m[1]) - 1]?.[0], m[2].trim()]); }
                return body;
            },
            drop() { settled = true; log.dropped++; } };
    } } };
}

function harness(src) {
    const cut = name => {
        const re = new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('), start = src.search(re);
        assert(start >= 0, name);
        return src.slice(start + 1, src.indexOf('\n}', start + 1) + 2).replace(/^export /, '');
    };
    const S = { llm_prompt_chat: PROMPT, glossary_enabled: true, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled', keep_korean_source: false };
    const ctx = { chatMetadata: {}, chat: [] };
    const calls = [];
    const G = { toastr: { warning() {} } };
    const env = { ...KOREAN_KEEP_ENV, ...card, ...seg, ...resume, ...auto, glossarySignature, cardValues: cardValueModule.cardValues, getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S, getContext: () => ctx,
        guards: { capture: () => ({ assert() {} }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }), document: { getElementById: () => null },
        BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
        buildGlossaryBlock: () => '', checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
        looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
        tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [], dropDanglingOpenQuote: x => x,
        runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
        correctBackticks: x => x, window: {}, toastr: G.toastr, globalThis: G, speechModelTag: () => 'direct|claude|claude-opus-5-5', BRACKET_NOTE: /\nconst BRACKET_NOTE = '([^']*)'/.exec(src)?.[1] ?? '',
    };
    for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
        'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'tidyGlossaryOutput', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'liveChatPrompt', 'translate']) {
        if (!new RegExp('\\nfunction ' + name + '\\(|\\nasync function ' + name + '\\(').test(src)) continue;
        env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
    }
    env.tidyGlossaryOutput = (_s, x) => x;
    // 가짜 모델: 본문은 글자 바꾸기로 「번역」 · 끝 칸이 있으면 칸 머리 줄 + 번호 줄 번역을 붙여 답해요. answer(prompt, n) 로 답을 바꿀 수 있어요
    const model = { answer: null, fail: null, stream: false };
    env.callLLMAPI = async (prompt, overrides = {}) => {
        calls.push({ prompt, overrides });
        if (model.fail) throw model.fail;
        const at = prompt.indexOf(`\n\n${DELIM}`);
        const main = at >= 0 ? prompt.slice(0, at) : prompt;
        const batch = main.includes(BATCH_HEADER);
        let out = ko(batch ? main.slice(main.indexOf(BATCH_HEADER) + BATCH_HEADER.length) : main.includes(PROMPT) ? main.slice(main.indexOf(PROMPT) + PROMPT.length).replace(/^\n+/, '') : main.slice(main.lastIndexOf('\n\n') + 2));
        if (at >= 0) out += `\n\n${DELIM}\n` + PIECES.map(([, , k], i) => `⟪e${i + 1}⟫ ${k}`).join('\n');
        if (model.answer) out = model.answer(out, calls.length, prompt);
        if (model.stream && typeof overrides.onStream === 'function') for (let i = 1; i <= out.length; i += 3) overrides.onStream(out.slice(0, i));
        return out;
    };
    const run = async (text, options = {}, chunk = 100000) => { calls.length = 0; env.CHUNK_TARGET = chunk; await seg.clearSegmentCache(); await resume.clearCheckpoints(); const out = await env.translate(text, options); return { out, calls: [...calls] }; };
    const again = async (text, options = {}) => { calls.length = 0; const out = await env.translate(text, options); return { out, calls: [...calls] }; };
    return { S, env, G, model, run, again };
}
const T = harness(source);
const withHub = h => { if (h) T.G[HUB] = h; else delete T.G[HUB]; };
const reset = () => { T.model.answer = null; T.model.fail = null; T.model.stream = false; T.env.looksLikeInputBlock = () => false; };

await check('no window (or nothing to offer): requests and result are byte-identical to a translation without ride', async () => {
    reset(); withHub(null);
    for (const [options, chunk] of [[{ segmentCache: true }, 100000], [{}, 100000], [{ segmentCache: true }, 60]]) {
        const a = await T.run(MESSAGE, options, chunk), b = await T.run(MESSAGE, { ...options, ride: 7 }, chunk);
        assert.equal(b.out, a.out); assert.deepEqual(b.calls.map(c => c.prompt), a.calls.map(c => c.prompt));
        assert.deepEqual(b.calls.map(c => Object.keys(c.overrides).sort()), a.calls.map(c => Object.keys(c.overrides).sort()));
    }
    const empty = fakeHub([]); withHub(empty.hub);
    const a = await T.run(MESSAGE, { segmentCache: true }), b = await T.run(MESSAGE, { segmentCache: true, ride: 7 });
    assert.equal(empty.log.offers.length, 1, 'asked once');
    assert.equal(b.out, a.out); assert.deepEqual(b.calls.map(c => c.prompt), a.calls.map(c => c.prompt));
    withHub(null);
});
await check('one-batch message: one request, block at the very end, same promptCache head, same paragraphs as without the block, pieces handed over', async () => {
    reset();
    withHub(null); const plain = await T.run(MESSAGE, { segmentCache: true });
    const f = fakeHub(); withHub(f.hub);
    const { out, calls } = await T.run(MESSAGE, { segmentCache: true, ride: 7 });
    assert.equal(calls.length, 1, 'one request');
    assert.deepEqual(f.log.offers, [{ messageId: 7, modelTag: 'direct|claude|claude-opus-5-5', target: 'ko' }]);
    assert.ok(calls[0].prompt.startsWith(plain.calls[0].prompt), 'the original request is untouched up to the block');
    assert.ok(calls[0].prompt.endsWith(PIECES.map(([, en], i) => `⟪e${i + 1}⟫ ${en}`).join('\n')), 'block is the tail');
    assert.equal(calls[0].prompt.slice(plain.calls[0].prompt.length, plain.calls[0].prompt.length + 2 + DELIM.length), `\n\n${DELIM}`);
    assert.equal(calls[0].overrides.promptCache, plain.calls[0].overrides.promptCache, 'cache head unchanged');
    assert.ok(calls[0].overrides.promptCache && calls[0].prompt.startsWith(calls[0].overrides.promptCache));
    assert.equal(out, plain.out); assert.equal(out, KO.join('\n\n')); assert.ok(!out.includes('⟪'));
    assert.equal(out.split('\n\n').length, plain.out.split('\n\n').length, 'same paragraph count');
    assert.deepEqual(f.log.accepted, PIECES.map(([k, , t]) => [k, t]));
    withHub(null);
});
await check('whole-message path (no paragraph cache) also rides once; streamed previews never show ⟪', async () => {
    reset(); const f = fakeHub(); withHub(f.hub);
    T.model.stream = true;
    const seen = [];
    const { out, calls } = await T.run(MESSAGE, { ride: 3, onPreview: v => seen.push(v), onProgress: () => {} });
    assert.equal(calls.length, 1); assert.ok(calls[0].prompt.includes(DELIM));
    assert.equal(out, KO.join('\n\n'));
    assert.ok(seen.length > 0, 'previews shown');
    assert.ok(seen.every(v => !v.includes('⟪') && !v.includes('EXTRA')), 'no block in previews');
    assert.equal(f.log.accepted.length, 2);
    withHub(null);
});
await check('batch path streaming: the onStream the model sees hides the block (partial head ⟪EX too)', async () => {
    reset(); const f = fakeHub(); withHub(f.hub);
    const got = [];
    const orig = T.env.callLLMAPI;
    T.env.callLLMAPI = async (prompt, overrides = {}) => {
        const out = await orig(prompt, {});
        if (typeof overrides.onStream === 'function') for (let i = 1; i <= out.length; i++) { overrides.onStream(out.slice(0, i)); got.push(out.slice(0, i)); }
        return out;
    };
    const shown = [];
    const realWatch = T.env.streamWatch;
    T.env.streamWatch = o => { const w = realWatch(o); return { ...w, follow: (g, at) => { const fn = w.follow(g, at); return text => { shown.push(text); return fn(text); }; } }; };
    try {
        const { out } = await T.run(MESSAGE, { segmentCache: true, ride: 4, onProgress: () => {}, onPreview: () => {} });
        assert.equal(out, KO.join('\n\n'));
        assert.ok(got.some(t => t.includes(DELIM)), 'the model did stream the block');
        assert.ok(shown.length > 0 && shown.every(t => !t.includes('⟪')), 'stream watcher never sees ⟪');
    } finally { T.env.callLLMAPI = orig; T.env.streamWatch = realWatch; withHub(null); }
});
await check('not offered: several batches · all cached (0 requests) · retranslation · input · check source · custom prompt · non-Korean target · no ride option', async () => {
    reset(); const f = fakeHub(); withHub(f.hub);
    const multi = await T.run(MESSAGE, { segmentCache: true, ride: 1 }, 60);
    assert.equal(multi.calls.length, 3); assert.ok(multi.calls.every(c => !c.prompt.includes(DELIM)), 'split request: none rides');
    assert.equal(f.log.offers.length, 0, 'not even asked');
    await T.run(EN[0], { segmentCache: true });
    const cached = await T.again(EN[0], { segmentCache: true, ride: 1 });
    assert.equal(cached.calls.length, 0, 'cache only'); assert.equal(f.log.offers.length, 0);
    for (const options of [{ isRetranslation: true, checkSource: MESSAGE, ride: 1 }, { isInputTranslation: true, ride: 1 }, { segmentCache: true, checkSource: MESSAGE, ride: 1 }, { prompt: 'Translate into Korean please:', ride: 1 }, { segmentCache: true, requestPurpose: 'translation.tts', ride: 1 }, { segmentCache: true }]) {
        const { calls } = await T.run(MESSAGE, options);
        assert.ok(calls.length >= 1 && calls.every(c => !c.prompt.includes(DELIM)), JSON.stringify(options));
    }
    T.S.llm_prompt_chat = `${LONG}\nPlease translate the following text to Japanese:`;
    const ja = await T.run(MESSAGE, { segmentCache: true, ride: 1 });
    T.S.llm_prompt_chat = PROMPT;
    assert.ok(ja.calls.every(c => !c.prompt.includes(DELIM)), 'Japanese target');
    assert.equal(f.log.offers.length, 0, 'never asked');
    withHub(null);
});
await check('re-send after an input block (layout 2) carries no block; offer asked once; first answer still split', async () => {
    reset(); const f = fakeHub(); withHub(f.hub);
    let n = 0; T.env.looksLikeInputBlock = out => { n++; return n === 1; };
    const { out, calls } = await T.run(MESSAGE, { segmentCache: true, ride: 2 });
    assert.equal(calls.length, 2, 'blocked once, sent again');
    assert.ok(calls[0].prompt.includes(DELIM)); assert.ok(!calls[1].prompt.includes(DELIM), 're-send without block');
    assert.equal(f.log.offers.length, 1);
    assert.equal(out, KO.join('\n\n'));
    withHub(null);
});
await check('request failure → drop (nothing stored); answer with only the block and an empty body behaves like an empty answer without ride', async () => {
    reset(); const f = fakeHub(); withHub(f.hub);
    T.model.fail = Object.assign(new Error('boom'), { status: 500 });
    await assert.rejects(T.run(MESSAGE, { ride: 5 }), /boom/);
    assert.equal(f.log.dropped, 1); assert.equal(f.log.taken.length, 0);
    T.model.fail = null;
    const outcome = async (ride, answer) => { T.model.answer = answer; try { const r = await T.run(MESSAGE, ride ? { ride: 5 } : {}); return ['ok', r.out]; } catch (e) { return ['error', String(e?.message)]; } finally { T.model.answer = null; } };
    const blockOnly = `${DELIM}\n` + PIECES.map(([, , k], i) => `⟪e${i + 1}⟫ ${k}`).join('\n');
    const a = await outcome(false, () => ''), b = await outcome(true, () => blockOnly);
    assert.deepEqual(b, a, 'same handling as an empty answer');
    withHub(null);
});
await check('a window that throws never breaks translation', async () => {
    reset(); withHub({ v: 1, offer() { throw new Error('window broke'); } });
    const plain = await T.run(MESSAGE, { segmentCache: true });
    withHub({ v: 1, offer() { throw new Error('window broke'); } });
    const r = await T.run(MESSAGE, { segmentCache: true, ride: 9 });
    assert.equal(r.out, plain.out); assert.deepEqual(r.calls.map(c => c.prompt), plain.calls.map(c => c.prompt));
    const good = fakeHub(); const o = good.hub.offer({});
    withHub({ v: 1, offer: () => ({ ...o, take() { throw new Error('take broke'); } }) });
    const t = await T.run(EN[0], { segmentCache: true, ride: 9 });
    assert.equal(t.out, KO[0]);
    withHub(null);
});
await check('wiring: message translation passes ride = message id; review / retranslation calls do not', () => {
    assert.match(source, /contextAt: Number\(messageId\), ride: Number\(messageId\), assertValid:/);
    assert.equal((source.match(/\bride: Number\(/g) || []).length, 1, 'only translateMessage');
    assert.match(source, /globalThis\[Symbol\.for\('blue-lemonade\.translator\.ride\.v1'\)\]/);
});

console.log(`translator-ride: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
