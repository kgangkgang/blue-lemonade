// 7.7.2 프롬프트 캐시 (src/prompt-cache.js · 번역 translate() · TTS 대사 분석) — 가상 글만.
//   ① 모듈: 모델별 최소 길이 · 적게 어림 · 매크로 판정 · Claude 직접 연결만 · tool_result 앞부분에 cache_control 하나 · 짧으면 그대로
//   ② translate() 를 잘라 가짜 모델로: 켜면 지시문이 맨 앞(배치 1)이고 묶음마다 같은 앞부분을 promptCache 로 넘긴다 · 끄면 예전 차례(배치 0) · 넘기지 않음
//   ③ TTS composePrompt: 효과음 목록이 있으면 고정 글(이름 줄 · 목록)을 앞에 두는 배치 · 저장 열쇠용 user 글은 그대로
//   ST_ROOT=<실리태번 폴더> 를 주면 실리태번 서버의 convertClaudeMessages 로 Anthropic 본문에 cache_control 이 남는지도 본다 (CI 에선 건너뜀)
//   OLD_TRANSLATOR=<7.7.1 index.js> 를 주면 끈 상태의 요청이 예전 판과 바이트까지 같은지도 본다 (CI 에선 건너뜀)
//   node tools/tests/prompt-cache.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KOREAN_KEEP_ENV } from './korean-keep-env.mjs';

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const PC = await import(pathToFileURL(path.join(root, 'src/prompt-cache.js')));
let passed = 0, failed = 0, skipped = 0;
async function check(name, fn) {
    try { const r = await fn(); if (r === 'skip') { skipped++; console.log('SKIP ' + name); } else { passed++; console.log('PASS ' + name); } }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}
const LONG = 'You translate fiction faithfully into natural Korean. Keep names, tone and line breaks. '.repeat(40);   // ≈ 3400자 → 850토큰쯤
const body = (over = {}) => ({ model: 'claude-opus-5-5', chat_completion_source: 'claude', stream: false, messages: [{ role: 'user', content: `${LONG}\n\n[Glossary]\nMina → 미나\n\nThe rain fell.` }], ...over });
const breakpoints = b => JSON.stringify(b).split('"cache_control"').length - 1;

// ── ① 모듈 ──
await check('minimum cacheable length per model (Anthropic table): 5-generation 512, Sonnet 5 1024, Opus 4.6/4.5 · Haiku 4.5 4096, Opus 4.7 2048, unknown 1024', () => {
    for (const m of ['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'claude-fable-5', 'claude-mythos-5-1']) assert.equal(PC.minCacheTokens(m), 512, m);
    for (const m of ['claude-sonnet-5', 'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-sonnet-4-5', 'claude-opus-4-1', 'some-model', '']) assert.equal(PC.minCacheTokens(m), 1024, m);
    for (const m of ['claude-opus-4-6', 'claude-opus-4-5', 'claude-haiku-4-5']) assert.equal(PC.minCacheTokens(m), 4096, m);
    for (const m of ['claude-opus-4-7', 'claude-mythos-preview']) assert.equal(PC.minCacheTokens(m), 2048, m);
});
await check('estimateTokens counts low (English 4 chars, other 1.5 chars per token) · pureMacros allows only {{char}} / {{user}}', () => {
    assert.equal(PC.estimateTokens('a'.repeat(400)), 100);
    assert.equal(PC.estimateTokens('가'.repeat(300)), 200);
    assert.equal(PC.estimateTokens(''), 0);
    assert.ok(PC.pureMacros('plain text') && PC.pureMacros('Call {{char}} by name, never {{user}}.'));
    for (const t of ['{{random::a,b}}', '{{time}}', '{{setvar::x::1}}', '{{llmContext}}', '{{ getvar::x }}']) assert.ok(!PC.pureMacros(t), t);
});
await check('withPromptCache: Claude direct → first user message = [tool_result head + cache_control, text rest]; text joins back to the same prompt; one breakpoint', () => {
    const b = body(), out = PC.withPromptCache(b, LONG);
    const parts = out.messages[0].content;
    assert.ok(Array.isArray(parts) && parts.length === 2);
    assert.deepEqual(parts[0], { type: 'tool_result', content: LONG, cache_control: { type: 'ephemeral' } });
    assert.equal(parts[1].type, 'text');
    assert.equal(parts[0].content + parts[1].text, b.messages[0].content, 'same text');
    assert.equal(breakpoints(out), 1, '≤ 4 breakpoints (one)');
    assert.equal(typeof b.messages[0].content, 'string', 'input body untouched');
    const withSystem = PC.withPromptCache({ ...b, messages: [{ role: 'system', content: 'sys' }, ...b.messages] }, LONG);
    assert.equal(withSystem.messages[0].content, 'sys'); assert.ok(Array.isArray(withSystem.messages[1].content), 'system messages before the user turn are part of the prefix');
});
await check('withPromptCache leaves the body as it was: other providers, reverse proxy, tools, post-processing, short head, head not at the start, empty tail, no head', () => {
    for (const [label, b, head] of [
        ['gemini', body({ chat_completion_source: 'makersuite' }), LONG], ['openai', body({ chat_completion_source: 'openai' }), LONG], ['custom relay', body({ chat_completion_source: 'custom' }), LONG],
        ['reverse proxy', body({ reverse_proxy: 'https://proxy.invalid/v1' }), LONG], ['tools', body({ tools: [{ type: 'function', function: { name: 'f' } }] }), LONG],
        ['post-processing', body({ custom_prompt_post_processing: 'merge' }), LONG], ['short', body(), LONG.slice(0, 600)], ['opus 4.6 needs 4096', body({ model: 'claude-opus-4-6' }), LONG],
        ['not prefix', body(), 'Something else'], ['empty tail', body({ messages: [{ role: 'user', content: LONG }] }), LONG], ['no head', body(), ''], ['undefined head', body(), undefined],
        ['assistant first', body({ messages: [{ role: 'assistant', content: 'x' }, { role: 'user', content: `${LONG}\n\nrest` }] }), LONG],
    ]) assert.equal(PC.withPromptCache(b, head), b, label);
});

// ── ② translate() 를 잘라 가짜 모델로 (translator-keep-korean.mjs 와 같은 틀) ──
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
const { BATCH_HEADER } = seg;
const { glossarySignature } = await import(pathToFileURL(path.join(dir, 'glossary-sync.js')));
const EN = ['Mina walked along the pier while the rain kept falling on the old lanterns.', 'The ferryman leaned on the door frame, watching Mina fold the wet map.', 'Nobody on the quay spoke while the bell rang twice over the harbour.'];
const KO = ['미나는 오래된 등불 위로 비가 계속 내리는 동안 부두를 따라 걸었다.', '뱃사공은 문틀에 기대어 미나가 젖은 지도를 접는 것을 지켜보았다.', '종이 항구 위로 두 번 울리는 동안 부둣가의 누구도 말하지 않았다.'];
const ko = t => { let out = String(t); EN.forEach((e, i) => { out = out.split(e).join(KO[i]); }); return out; };
const MESSAGE = EN.join('\n\n');
const PROMPT = `${LONG}\nPlease translate the following text to korean:`;
const glossary = text => (/Mina/.test(text) ? '[Glossary]\nRender these terms exactly as given below:\nMina → 미나' : '');
function harness(src) {
    const cut = name => {
        const re = new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('), start = src.search(re);
        assert(start >= 0, name);
        return src.slice(start + 1, src.indexOf('\n}', start + 1) + 2).replace(/^export /, '');
    };
    const S = { llm_prompt_chat: PROMPT, glossary_enabled: true, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled', keep_korean_source: false };
    const ctx = { chatMetadata: {}, chat: [] };
    const calls = [];
    const env = { ...KOREAN_KEEP_ENV, ...card, ...seg, ...resume, ...auto, glossarySignature, cardValues: cardValueModule.cardValues, getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S, getContext: () => ctx,
        guards: { capture: () => ({ assert() {} }) }, connectionSignature: () => '', watchGuard: () => ({ check() {}, close() {}, signal: null }), document: { getElementById: () => null },
        BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
        buildGlossaryBlock: glossary, checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: () => false, CHUNK_TARGET: 100000,
        looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
        tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [], dropDanglingOpenQuote: x => x,
        runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
        correctBackticks: x => x, window: {}, toastr: { warning() {} }, globalThis: { toastr: { warning() {} } }, BRACKET_NOTE: /\nconst BRACKET_NOTE = '([^']*)'/.exec(src)?.[1] ?? '',
    };
    for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
        'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'tidyGlossaryOutput', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'liveChatPrompt', 'translate']) {
        if (!new RegExp('\\nfunction ' + name + '\\(|\\nasync function ' + name + '\\(').test(src)) continue;
        env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
    }
    env.tidyGlossaryOutput = (_s, x) => x;
    env.callLLMAPI = async (prompt, overrides = {}) => {
        calls.push({ prompt, overrides });
        const batch = prompt.includes(BATCH_HEADER);
        return ko(batch ? prompt.slice(prompt.indexOf(BATCH_HEADER) + BATCH_HEADER.length) : prompt.slice(prompt.lastIndexOf('\n\n') + 2));
    };
    const run = async (text, options = {}, chunk = 60) => { calls.length = 0; env.CHUNK_TARGET = chunk; await seg.clearSegmentCache(); await resume.clearCheckpoints(); const out = await env.translate(text, options); return { out, calls: [...calls] }; };
    return { S, env, run };
}
const NEW = harness(source);

await check('on (default): a three-batch message sends three requests; each starts with the instructions and carries the same promptCache head (byte-identical)', async () => {
    NEW.S.prompt_cache = undefined;
    const { out, calls } = await NEW.run(MESSAGE, { segmentCache: true });
    assert.equal(out, KO.join('\n\n'));
    assert.equal(calls.length, 3, 'one request per batch');
    for (const call of calls) {
        assert.ok(call.prompt.startsWith(PROMPT), 'instructions first');
        assert.equal(call.overrides.promptCache, PROMPT, 'head = the fixed instructions');
        if (/Mina/.test(call.prompt)) assert.ok(call.prompt.indexOf('[Glossary]') > PROMPT.length, 'glossary after the instructions');
    }
    assert.equal(new Set(calls.map(c => c.overrides.promptCache)).size, 1, 'same head for every batch');
});
await check('on: two consecutive messages share the same head; chat rules from chat metadata are part of it', async () => {
    const a = await NEW.run(EN[0], { segmentCache: true }), b = await NEW.run(EN[2], { segmentCache: true });
    assert.equal(a.calls[0].overrides.promptCache, b.calls[0].overrides.promptCache);
    NEW.env.getContext().chatMetadata = { rules: 'Keep honorifics.' };
    const c = await NEW.run(EN[1], { segmentCache: true });
    NEW.env.getContext().chatMetadata = {};
    assert.equal(c.calls[0].overrides.promptCache, `[Additional Rules]:\nKeep honorifics.\n\n${PROMPT}`);
});
await check('on: no head for retranslation · input translation · a custom prompt · a non-pure macro in the instructions (random, time)', async () => {
    for (const options of [{ isRetranslation: true, checkSource: MESSAGE }, { isInputTranslation: true }, { prompt: 'Translate into Japanese:' }, { segmentCache: true, requestPurpose: 'translation.tts' }]) {
        const { calls } = await NEW.run(MESSAGE, options);
        assert.ok(calls.length >= 1 && calls.every(c => !('promptCache' in c.overrides)), JSON.stringify(options));
    }
    NEW.S.llm_prompt_chat = `${PROMPT} {{random::a,b}}`;
    const { calls } = await NEW.run(MESSAGE, { segmentCache: true });
    NEW.S.llm_prompt_chat = PROMPT;
    assert.ok(calls.every(c => !('promptCache' in c.overrides)), 'stateful macro → no cache');
});
await check('off: old order (glossary first, layout 0) and no promptCache — the request text is the pre-7.7.2 one', async () => {
    NEW.S.prompt_cache = false;
    const { out, calls } = await NEW.run(MESSAGE, { segmentCache: true });
    NEW.S.prompt_cache = undefined;
    assert.equal(out, KO.join('\n\n'));
    assert.equal(calls.filter(c => c.prompt.startsWith('[Glossary]')).length, 2, 'glossary first as before (the two batches that name Mina)');
    for (const call of calls) assert.ok(!('promptCache' in call.overrides));
});
await check('local only: switch off sends byte-identical prompts to the 7.7.1 translator (OLD_TRANSLATOR)', async () => {
    if (!process.env.OLD_TRANSLATOR) return 'skip';
    const OLD = harness(fs.readFileSync(process.env.OLD_TRANSLATOR, 'utf8'));
    NEW.S.prompt_cache = false;
    for (const [text, options, chunk] of [[MESSAGE, { segmentCache: true }, 60], [MESSAGE, {}, 100000], [EN[1], { segmentCache: true }, 100000], [MESSAGE, { isRetranslation: true, checkSource: MESSAGE }, 100000]]) {
        const a = await OLD.run(text, options, chunk), b = await NEW.run(text, options, chunk);
        assert.deepEqual(b.calls.map(c => c.prompt), a.calls.map(c => c.prompt), JSON.stringify(options));
        assert.deepEqual(b.calls.map(c => Object.keys(c.overrides).sort()), a.calls.map(c => Object.keys(c.overrides).sort()), 'same overrides');
    }
    NEW.S.prompt_cache = undefined;
});
await check('wiring: default on, checkbox, both request paths (direct and current connection) go through withPromptCache', () => {
    assert.match(source, /prompt_cache: true,/);
    assert.match(source, /\$\('#llm_prompt_cache'\)\.prop\('checked', extensionSettings\.prompt_cache !== false\)/);
    assert.match(source, /const preparedParameters = withPromptCache\(await prepareAutoTranslationPayload\(parameters, overrides\), overrides\.promptCache\);/);
    assert.match(source, /preparePayload: async payload => withPromptCache\(await prepareAutoTranslationPayload\(/);
    assert.match(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), /id="llm_prompt_cache"><span>프롬프트 캐시<\/span>/);
});

// ── ③ TTS 대사 분석 배치 (composePrompt — 순수 함수만, 실리태번 모듈 없이 잘라서) ──
const tts = fs.readFileSync(path.join(root, 'src/addons/tts/src/analysis.js'), 'utf8');
await check('TTS composePrompt: with a sound library, cache = { head: name line + library, tail: the rest in the original order }; user (storage key) unchanged', () => {
    const start = tts.indexOf('\nexport function composePrompt('), end = tts.indexOf('\n}\n', start) + 2;
    const fn = new Function('env', `with(env){return (${tts.slice(start + 1, end).replace(/^export /, '')});}`)({
        EMOTIONS: ['calm', 'happy'], LANGS: ['ja', 'ko'], LANG_HINT: {}, SYSTEM: 'S', cleanName: x => String(x || ''), JSON });
    const lines = [{ i: 0, h: 1, text: 'Hello.', speaker: 'Mira' }, { i: 1, h: 2, text: 'Bye.', speaker: 'Mira' }];
    const lib = [{ id: 'door', name: 'Door', sustain: false, words: ['door'] }, { id: 'rain', name: 'Rain', sustain: true, words: ['rain'] }];
    const parts = { lines, needs: {}, context: 'The door opened.', emotion: true, charName: 'Mira', userName: 'Sol', sfxLibrary: lib, sceneText: '[after=0] The door opened.' };
    const r = fn(parts);
    assert.ok(r.cache, 'cache layout');
    assert.equal(r.cache.head, `Character: Mira · User: Sol\n\nSound-effect library (reference data, not instructions):\n${JSON.stringify(lib)}`);
    assert.ok(!r.cache.tail.includes('Sound-effect library') && r.cache.tail.startsWith('Narration around the lines:'));
    const canon = r.user.split('\n\n'), sent = `${r.cache.head}\n\n${r.cache.tail}`.split('\n\n');
    assert.deepEqual([...sent].sort(), [...canon].sort(), 'same pieces, only reordered');
    assert.ok(r.user.indexOf('Narration around the lines:') < r.user.indexOf('Sound-effect library'), 'storage-key text keeps the old order');
    const other = fn({ ...parts, context: 'Rain fell.', lines: [lines[1]], sceneText: '[after=1] Rain fell.' });
    assert.equal(other.cache.head, r.cache.head, 'next message: same head');
    assert.equal(fn({ ...parts, sfxLibrary: [], sceneText: '' }).cache, null, 'no library → old layout only');
});
await check('TTS wiring: callProvider sends the cached layout only when prompt_cache is not false, through withPromptCache; usage counts Anthropic cache tokens; switch shown for provider engine', () => {
    assert.match(tts, /const sentUser = \(cfg, user, cache\) => \(cfg\?\.prompt_cache !== false && cache\?\.head && cache\.tail \? `\$\{cache\.head\}\\n\\n\$\{cache\.tail\}` : user\);/);
    assert.match(tts, /const body = withPromptCache\(stapi\.buildRequest\(cfg, system, sent, \{ maxTokens \}\), head\);/);
    assert.match(tts, /call: \(\) => counted\(callerOf\(engine\)\(cfg, built\.system, built\.user, signal, onSend, \{ cache: built\.cache \}\)\)/);
    assert.match(tts, /return hash\(JSON\.stringify\(\[1, engine, provider, model, !!cfg\.emotion, !!cfg\.translate, cfg\.temperature \?\? 0\.2, p\.system, p\.user\]\)\);/, 'profile key unchanged');
    assert.match(tts, /cache_read_input_tokens\) \|\| 0\) \+ \(Number\(u\.cache_creation_input_tokens\)/);
    assert.match(fs.readFileSync(path.join(root, 'src/addons/tts/src/ui.js'), 'utf8'), /key: 'analysis\.prompt_cache', label: '프롬프트 캐시', type: 'toggle'/);
    assert.match(fs.readFileSync(path.join(root, 'src/addons/tts/src/settings.js'), 'utf8'), /prompt_cache: true,/);
});
await check('ledger: request-log text of a cached body includes the head (capture contentText · attribution)', async () => {
    const cap = fs.readFileSync(path.join(root, 'src/addons/perf/capture.js'), 'utf8');
    assert.match(cap, /if \(part\.type === 'tool_result' && typeof part\.content === 'string'\) return part\.content;/);
    const { createAttribution } = await import(pathToFileURL(path.join(root, 'src/addons/perf/attribution.js')));
    const at = createAttribution();
    const cached = PC.withPromptCache(body(), LONG);
    const done = at.begin({ caller: 'bl-tts', purpose: 'tts.analysis', user: body().messages[0].content.slice(0, 300) });
    assert.equal(at.resolve({ caller: 'ext', kind: 'text', body: cached }).purpose, 'tts.analysis');
    done();
});

// ── ④ 실리태번 서버 변환 (있을 때만) ──
await check('local only: SillyTavern convertClaudeMessages keeps cache_control on the head as a text block (ST_ROOT)', async () => {
    if (!process.env.ST_ROOT) return 'skip';
    (await import(pathToFileURL(path.join(process.env.ST_ROOT, 'src/util.js')))).setConfigFilePath?.(path.join(process.env.ST_ROOT, 'config.yaml'));
    const { convertClaudeMessages } = await import(pathToFileURL(path.join(process.env.ST_ROOT, 'src/prompt-converters.js')));
    const names = { userName: 'Sol', charName: 'Mira', groupNames: [], startsWithGroupName: () => false };
    const b = PC.withPromptCache(body({ messages: [{ role: 'system', content: 'sys' }, body().messages[0]] }), LONG);
    const { messages, systemPrompt } = convertClaudeMessages(structuredClone(b.messages), '', true, false, names);
    assert.deepEqual(systemPrompt, [{ type: 'text', text: 'sys' }]);
    assert.equal(messages.length, 1);
    assert.deepEqual(messages[0].content[0], { type: 'text', text: LONG, cache_control: { type: 'ephemeral' } });
    assert.equal(messages[0].content.map(p => p.text).join(''), body().messages[0].content);
    const plain = convertClaudeMessages(structuredClone(body().messages), '', true, false, names);
    assert.equal(JSON.stringify(plain).includes('cache_control'), false, 'without the head nothing changes');
});

console.log(`prompt-cache: ${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
