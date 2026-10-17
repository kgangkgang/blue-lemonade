// 번역기 2.6.2 묶음 번역 흘려받기 — 「수정 문단 n/전체」가 묶음이 아니라 문단마다 오른다 (사용자 요청 10-16).
//   ① translation-stream.js: 공급자별 SSE(OpenAI 꼴 · Claude · Gemini · Cohere)를 실리태번이 stream:false 로 줬을 꼴로 — 같은 답이면 번역문이 바이트까지 같다
//   ② streamedPassages · streamWatch: 닫힌 ⟦n⟧ 문단만 · 한 프레임에 한 번 · 끝 · 멈춤 뒤엔 알리지 않는다
//   ③ callLLMAPI(직접 연결) · requestCurrentConnection(현재 연결): 못 쓰는 공급자 · 실패 · 끊김이면 예전 요청 그대로, 429 · 5xx · 멈춤 · 시간 초과는 예전 오류
//   ④ translate(): 진행 숫자 1/N … · 바로 보기 · 흘려받은 글은 캐시에 안 들어감 · 혼잣말 · 주석 · 괄호 · 번역 중단 감시 그대로
// 가짜 서버(가짜 fetch · 가짜 스트림)와 가상 문장만 쓴다. node tools/tests/translator-stream.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KOREAN_KEEP_ENV } from './korean-keep-env.mjs';   // 2.7.9 이미 한국어인 부분 판정 (korean-keep.js · KOREAN_TARGET)

const root = path.resolve(process.argv[2] || '.'), dir = path.join(root, 'src/addons/translator');
const source = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
const stream = await import(pathToFileURL(path.join(dir, 'translation-stream.js')));
const seg = await import(pathToFileURL(path.join(dir, 'translation-segments.js')));
const card = await import(pathToFileURL(path.join(dir, 'display-cards.js')));
const auto = await import(pathToFileURL(path.join(dir, 'context-auto.js')));
const cardValueModule = await import(pathToFileURL(path.join(dir, 'card-values.js')));
const resume = await import(pathToFileURL(path.join(dir, 'translation-resume.js')));
const guardModule = await import(pathToFileURL(path.join(dir, 'translation-guard.js')));
const { requestCurrentConnection } = await import(pathToFileURL(path.join(dir, 'current-connection.js')));
const LiveModels = await import(pathToFileURL(path.join(root, 'src/live-models.js')));

let passed = 0, failed = 0;
async function check(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n  ' + (error?.stack || error)); }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const outcome = fn => { try { return fn(); } catch (error) { return 'ERR ' + error.message; } };

// ── 프레임: requestAnimationFrame 을 손으로 돌린다 (한 프레임에 한 번 묶기를 본다) ──
const frames = new Map();
let frameId = 0;
globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
globalThis.cancelAnimationFrame = id => { frames.delete(id); };
const flushFrames = () => { const due = [...frames.values()]; frames.clear(); for (const fn of due) fn(); return due.length; };

// ── 가짜 스트림 ──
const encoder = new TextEncoder();
/** 바이트 조각으로 자른 본문 (한글 한 글자가 두 조각에 걸치게) · signal 이 끊기면 스트림도 끊긴다 · hold 가 있으면 그 조각 앞에서 기다린다 */
function byteStream(text, { pieces = 7, signal = null, before = null } = {}) {
    const bytes = encoder.encode(text), size = Math.max(1, Math.ceil(bytes.length / pieces)), parts = [];
    for (let at = 0; at < bytes.length; at += size) parts.push(bytes.slice(at, at + size));
    let index = 0;
    return new ReadableStream({
        start(controller) { signal?.addEventListener('abort', () => { try { controller.error(signal.reason ?? new DOMException('aborted', 'AbortError')); } catch { /* 이미 닫힘 */ } }, { once: true }); },
        async pull(controller) {
            await before?.(index);
            if (signal?.aborted) return;
            if (index >= parts.length) return controller.close();
            controller.enqueue(parts[index++]);
        },
    });
}
const sse = events => events.map(event => typeof event === 'string' ? `data: ${event}\n\n` : `${event.event ? `event: ${event.event}\n` : ''}data: ${JSON.stringify(event.data ?? event)}\n\n`).join('');
const TEXT = '  ⟦0⟧ 첫째 문단 — 창가의 등불이 깜박였다.\n\n⟦1⟧ 「둘째 문단의 대사.」\n\n⟦2⟧ 셋째 문단, 주전자가 나지막이 노래했다.  ';
const split = (text, n) => { const out = [], size = Math.ceil(text.length / n); for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size)); return out; };
const FAMILY_STREAMS = {
    openai: text => sse([{ choices: [{ delta: { role: 'assistant', content: '' } }] }, ...split(text, 5).map(content => ({ choices: [{ index: 0, delta: { content } }] })), { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }, '[DONE]']),
    claude: (text, { thinking = '먼저 문단을 센다.' } = {}) => sse([{ event: 'message_start', data: { type: 'message_start', message: { id: 'm', content: [] } } },
        { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking } },
        { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'sig' } }, { type: 'content_block_stop', index: 0 }, { type: 'ping' },
        ...(text ? [{ type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } }, ...split(text, 4).map(t => ({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: t } })), { type: 'content_block_stop', index: 1 }] : []),
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { event: 'message_stop', data: { type: 'message_stop' } }]),
    gemini: text => sse([{ candidates: [{ content: { parts: [{ text: '생각 중…', thought: true }], role: 'model' } }] }, ...split(text, 4).map(t => ({ candidates: [{ content: { parts: [{ text: t }], role: 'model' } }] })),
        { candidates: [{ content: { parts: [{ text: '' }], role: 'model' }, finishReason: 'STOP' }], usageMetadata: {} }]),
    cohere: text => sse([{ type: 'message-start' }, { type: 'content-start', index: 0 }, ...split(text, 4).map(t => ({ type: 'content-delta', index: 0, delta: { message: { content: { text: t } } } })),
        { type: 'content-end', index: 0 }, { type: 'message-end', delta: { finish_reason: 'COMPLETE' } }]),
};
// 실리태번 서버가 stream:false 로 주는 꼴 (src/endpoints/backends/chat-completions.js)
const FAMILY_JSON = {
    openai: text => ({ id: 'x', choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }] }),
    claude: text => { const content = [{ type: 'thinking', thinking: '먼저 문단을 센다.', signature: 'sig' }, { type: 'text', text }]; return { choices: [{ message: { content: content[0]?.text || '' } }], content }; },
    gemini: text => ({ choices: [{ message: { content: text } }], responseContent: { parts: [{ text: '생각 중…', thought: true }, { text }] } }),
    cohere: text => ({ id: 'x', finish_reason: 'COMPLETE', message: { role: 'assistant', content: [{ type: 'text', text }] } }),
};
const PROVIDER = { openai: 'openai', claude: 'claude', gemini: 'google', cohere: 'cohere' };
const SOURCE = { openai: 'openai', claude: 'claude', gemini: 'makersuite', cohere: 'cohere' };

function cut(name) {
    const re = new RegExp('\\n(?:export )?(?:async )?function ' + name + '\\('), start = source.search(re);
    assert(start >= 0, name);
    return source.slice(start + 1, source.indexOf('\n}', start + 1) + 2).replace(/^export /, '');
}

// ── ① translation-stream.js ──
await check('streamFamily: Claude · Gemini(AI Studio · Vertex) · Cohere · OpenAI 꼴만, 텍스트 완성 · 모르는 공급자는 흘려받지 않음', () => {
    assert.equal(stream.streamFamily('claude'), 'claude');
    assert.equal(stream.streamFamily('makersuite'), 'gemini');
    assert.equal(stream.streamFamily('vertexai'), 'gemini');
    assert.equal(stream.streamFamily('cohere'), 'cohere');
    for (const s of ['openai', 'openrouter', 'deepseek', 'custom', 'mistralai', 'xai']) assert.equal(stream.streamFamily(s), 'openai', s);
    for (const s of ['', 'textgenerationwebui', 'ai21', 'koboldcpp', undefined]) assert.equal(stream.streamFamily(s), '', String(s));
});
for (const family of Object.keys(FAMILY_STREAMS)) {
    await check(`readStream ${family}: 바이트 조각 · 한글이 조각에 걸쳐도 글이 같고, 실리태번 stream:false 꼴과 같은 답 읽기`, async () => {
        const seen = [];
        const read = await stream.readStream(new Response(byteStream(FAMILY_STREAMS[family](TEXT), { pieces: 23 })), { family, source: SOURCE[family], onText: text => seen.push(text) });
        assert(read.data, 'data');
        assert(seen.length >= 2, 'onText while streaming: ' + seen.length);
        for (let i = 1; i < seen.length; i++) assert(seen[i].startsWith(seen[i - 1]) && seen[i].length > seen[i - 1].length, 'grows');
        assert(TEXT.startsWith(seen.at(-1)) || seen.at(-1) === TEXT);
        const extract = new Function('env', `with(env){return (${cut('extractTranslationResult')});}`)({ LiveModels, blockedReasonOf: new Function(`return (${cut('blockedReasonOf')});`)() });
        assert.equal(extract(read.data, PROVIDER[family]), extract(FAMILY_JSON[family](TEXT), PROVIDER[family]), 'direct');
        assert.equal(outcome(() => extract(read.data, 'profile')), outcome(() => extract(FAMILY_JSON[family](TEXT), 'profile')), 'profile (실리태번이 감싼 꼴 그대로 — 같은 결과 · 같은 오류)');
        assert.equal(extract(read.data, PROVIDER[family]), TEXT.trim());
    });
}
await check('readStream: 끝 표시 없이 끊김 · 오류 이벤트 · 읽을 수 없는 조각 · 모르는 꼴 · 빈 답은 streamFailed (모르는 꼴만 unsupported)', async () => {
    const run = (body, family = 'openai') => stream.readStream(new Response(byteStream(body, { pieces: 3 })), { family, source: family, onText() {} });
    const full = FAMILY_STREAMS.openai(TEXT);
    await assert.rejects(run(full.slice(0, full.indexOf('"finish_reason"') - 40)), e => e.streamFailed && !e.unsupported);
    await assert.rejects(run(FAMILY_STREAMS.claude(TEXT).replace(/event: message_stop[\s\S]*$/, ''), 'claude'), e => e.streamFailed && !e.unsupported);
    await assert.rejects(run(sse([{ choices: [{ delta: { content: '반쪽' } }] }, { error: { message: 'upstream died' } }])), e => e.streamFailed && /upstream died/.test(e.message));
    await assert.rejects(run(sse([{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]), 'claude'), e => e.streamFailed);
    await assert.rejects(run('data: {not json\n\n'), e => e.streamFailed);
    await assert.rejects(run(sse([{ hello: 'world' }, '[DONE]'])), e => e.streamFailed && e.unsupported);
    await assert.rejects(run('   \n'), e => e.streamFailed);
});
await check('readStream: 서버가 stream 을 무시하고 통째로 준 본문은 raw 로 (예전 요청의 답처럼 읽는다)', async () => {
    const body = JSON.stringify(FAMILY_JSON.openai(TEXT));
    assert.deepEqual(await stream.readStream(new Response(byteStream('\n' + body, { pieces: 4 })), { family: 'openai', source: 'openai' }), { raw: '\n' + body });
    const html = '<!doctype html><title>524</title>error code: 524';
    assert.deepEqual(await stream.readStream(new Response(byteStream(html)), { family: 'claude', source: 'claude' }), { raw: html });
});
await check('readStream: 끝난 까닭 — OpenAI 꼴 length 는 그대로(잘림), Claude · Gemini 는 실리태번처럼 버림 · Gemini 입력 차단은 같은 오류 문구', async () => {
    const extract = new Function('env', `with(env){return (${cut('extractTranslationResult')});}`)({ LiveModels, blockedReasonOf: new Function(`return (${cut('blockedReasonOf')});`)() });
    const read = async (body, family, src = family) => (await stream.readStream(new Response(byteStream(body)), { family, source: src })).data;
    const cutOpenAI = await read(FAMILY_STREAMS.openai(TEXT).replace('"finish_reason":"stop"', '"finish_reason":"length"'), 'openai');
    assert.throws(() => extract(cutOpenAI, 'openai'), e => e.truncated);
    const maxClaude = await read(FAMILY_STREAMS.claude(TEXT).replace('"end_turn"', '"max_tokens"'), 'claude');
    assert.equal(extract(maxClaude, 'claude'), TEXT.trim(), 'ST drops Claude stop_reason in stream:false too');
    const maxGemini = await read(FAMILY_STREAMS.gemini(TEXT).replace('"STOP"', '"MAX_TOKENS"'), 'gemini', 'makersuite');
    assert.equal(extract(maxGemini, 'google'), TEXT.trim(), 'ST drops Gemini finishReason in stream:false too');
    const blocked = await read(sse([{ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' }, usageMetadata: {} }]), 'gemini', 'vertexai');
    assert.equal(blocked.error.message, 'Google Vertex AI API returned no candidate\nPrompt was blocked due to : PROHIBITED_CONTENT');
    assert.throws(() => extract(blocked, 'vertexai'), e => e.refused);
    const thoughtOnly = await read(FAMILY_STREAMS.claude(''), 'claude');
    assert.throws(() => extract(thoughtOnly, 'claude'), e => e.truncated && /생각/.test(e.message));
});

// ── ② 닫힌 문단 · 프레임 ──
const SRC = ['The lantern flickered by the window.', '"Stay," she whispered.', 'The kettle hummed over the stove.', 'Rain tapped the glass.'];
const KO = ['창가의 등불이 깜박였다.', '"있어 줘." 그녀가 속삭였다.', '화덕 위에서 주전자가 노래했다.', '빗방울이 유리를 두드렸다.'];
const answer = (list = KO, lead = '') => lead + list.map((t, i) => `⟦${i}⟧ ${t}`).join('\n\n');
await check('streamedPassages: 다음 ⟦n⟧ 이 온 문단만 · 표시가 반쯤 와도 그 앞 문단은 닫힘 · 1부터 매긴 답 · 차례가 어긋나면 거기까지', () => {
    const full = answer();
    assert.deepEqual(seg.streamedPassages(full, 4, SRC), KO.slice(0, 3));
    assert.deepEqual(seg.streamedPassages(full.slice(0, full.indexOf('⟦2⟧') + 2), 4, SRC), KO.slice(0, 2), '⟦2 까지만 와도 앞 문단은 닫힘');
    assert.deepEqual(seg.streamedPassages(full.slice(0, full.indexOf('⟦2⟧') + 1), 4, SRC), KO.slice(0, 1), '⟦ 만 온 줄은 아직 표시가 아님');
    assert.deepEqual(seg.streamedPassages(full.slice(0, full.indexOf('⟦1⟧') - 1), 4, SRC), []);
    assert.deepEqual(seg.streamedPassages(KO.map((t, i) => `⟦${i + 1}⟧ ${t}`).join('\n\n'), 4, SRC), KO.slice(0, 3), 'renumbered from 1');
    assert.deepEqual(seg.streamedPassages(`⟦0⟧ ${KO[0]}\n\n⟦2⟧ ${KO[2]}\n\n⟦3⟧ ${KO[3]}`, 4, SRC), [], 'skipped number: stop there');
    assert.deepEqual(seg.streamedPassages('<think>⟦0⟧ 초안\n⟦1⟧ 초안', 4, SRC), [], 'still thinking');
    assert.deepEqual(seg.streamedPassages(`<think>계획</think>\n\`\`\`\n${full}`, 4, SRC), KO.slice(0, 3), 'closed think + fence');
});
await check('streamedPassages 는 parseBatchResult 와 같은 걷어 내기 (초안 · 꼬리 메모 · 원문 되풀이)', () => {
    const LEAKY = [`「등불 이야기」 — let me write properly.\n\n<output>\n${KO[0]}</output>`, KO[1], `${KO[2]}\n\nTranslator's note: kettle = 주전자`, KO[3]];
    const raw = answer(LEAKY);
    assert.deepEqual(seg.streamedPassages(raw + '\n\n⟦4⟧', 4, SRC), seg.parseBatchResult(raw, 4, {}, SRC));
    assert.deepEqual(seg.streamedPassages(answer([KO[0], `${SRC[1]} → ${KO[1]}`, KO[2], KO[3]]) + '\n\n⟦4⟧', 4, SRC), seg.parseBatchResult(answer([KO[0], `${SRC[1]} → ${KO[1]}`, KO[2], KO[3]]), 4, {}, SRC));
});
await check('streamWatch: 문단이 닫힐 때만 · 한 프레임에 한 번 · settle 은 밀린 알림 버림 · close 뒤엔 아무것도 안 알림', () => {
    frames.clear();
    const calls = [], settled = [];
    const watch = seg.streamWatch({ done: (view, count) => calls.push([[...view], count]), settled: () => settled, shape: t => t + '!' });
    const onText = watch.follow(SRC, 0), full = answer();
    for (let n = 1; n <= full.length; n += 3) onText(full.slice(0, n));   // 글자마다 와도
    assert.equal(calls.length, 0, 'nothing until a frame');
    assert.equal(flushFrames(), 1, 'one frame queued');
    assert.deepEqual(calls, [[KO.slice(0, 3).map(t => t + '!'), 3]]);
    onText(full); assert.equal(frames.size, 0, 'no new passage closed → no frame');
    // 두 번째 묶음 (자리 4부터)
    settled.push('A', 'B', 'C', 'D');
    const second = watch.follow(SRC, 4);
    second(answer().slice(0, answer().indexOf('⟦2⟧') + 3));
    watch.settle(); assert.equal(flushFrames(), 0, 'settled → dropped');
    second(answer());
    flushFrames();
    assert.deepEqual(calls.at(-1), [['A', 'B', 'C', 'D', ...KO.slice(0, 3).map(t => t + '!')], 7]);
    watch.keep(4, ['x', 'y', 'z', 'w']); flushFrames();
    assert.deepEqual(calls.at(-1)[1], 8);
    const before = calls.length;
    second(answer() + '\n\n⟦4⟧ 더'); watch.close(); second(answer() + '\n\n⟦4⟧ 더\n\n⟦5⟧'); watch.keep(0, ['q']);
    assert.equal(flushFrames(), 0); assert.equal(calls.length, before, 'closed');
    // 프레임 함수가 곧바로 부르는 환경이어도 막히지 않는다
    const counts = [];
    const sync = seg.streamWatch({ done: (_view, count) => counts.push(count), settled: () => [], frame: fn => { fn(); return 1; }, cancel() { throw new Error('nothing to cancel'); } });
    const run = sync.follow(SRC, 0);
    for (const at of ['⟦1⟧', '⟦2⟧', '⟦3⟧']) run(full.slice(0, full.indexOf(at) + 3));
    sync.settle(); sync.close();
    assert.deepEqual(counts, [1, 2, 3]);
});

// ── ③ callLLMAPI · requestCurrentConnection ──
function directFixture({ provider = 'claude', serve }) {
    const fetches = [], warnings = [];
    const settings = { llm_provider: provider, llm_model: 'test-model', connection_mode: 'direct', parameters: { [provider]: { temperature: 0.5, max_length: 1000 } }, llm_prefill_toggle: false, use_reverse_proxy: false };
    class FakeRequest { constructor(url, init) { Object.assign(this, init, { url }); } }
    const env = {
        extensionSettings: settings, document: { getElementById: () => null }, secret_state: new Proxy({}, { get: () => 'key' }), SECRET_KEYS: new Proxy({}, { get: (_, k) => String(k) }),
        getProviderSpecificParams: () => ({}), LiveModels, prepareAutoTranslationPayload: async payload => payload, oai_settings: {}, getRequestHeaders: () => ({ 'X-CSRF-Token': 't' }),
        getCustomEndpointConfig: () => ({ url: 'http://relay.invalid/v1', inheritExtras: false }), getCustomModelName: () => 'test-model', substituteParams: x => x, Request: FakeRequest,
        streamParts: stream, noStream: new Set(), STREAM_IDLE_MS: 90000,   // 2.9.3 흘려받기 멈춤 시간 (index.js 맨 위 상수)
        console: { warn: (...a) => warnings.push(a.join(' ')), info() {}, debug() {}, error() {} },
        fetch: async (input, init) => {
            const request = input instanceof FakeRequest ? input : { url: input, ...init };
            const body = JSON.parse(request.body);
            fetches.push({ body, request: input instanceof FakeRequest, init, requestLog: init?.requestLog ?? request.requestLog });
            return serve(body, request.signal, fetches.length);
        },
    };
    env.blockedReasonOf = new Function(`return (${cut('blockedReasonOf')});`)();
    for (const name of ['extractTranslationResult', 'streamedReply', 'callLLMAPI']) env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
    return { env, fetches, warnings, settings };
}
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, statusText: status === 200 ? 'OK' : 'Error' });
for (const family of Object.keys(FAMILY_STREAMS)) {
    await check(`callLLMAPI 직접 ${family}: 흘려받은 답 = stream:false 답 (바이트까지) · 요청은 한 번 · Request 객체(끊김 감시 밖) · 요청 기록 이름 그대로`, async () => {
        const serve = (body, signal) => body.stream ? new Response(byteStream(FAMILY_STREAMS[family](TEXT), { pieces: 11, signal })) : jsonResponse(FAMILY_JSON[family](TEXT));
        const a = directFixture({ provider: PROVIDER[family], serve }), b = directFixture({ provider: PROVIDER[family], serve });
        const texts = [];
        const streamed = await a.env.callLLMAPI('Translate.\n\nbody', { onStream: text => texts.push(text) });
        const plain = await b.env.callLLMAPI('Translate.\n\nbody');
        assert.equal(streamed, plain);
        assert.equal(a.fetches.length, 1); assert.equal(a.fetches[0].body.stream, true); assert(a.fetches[0].request, 'Request object, no init body');
        assert.equal(a.fetches[0].init?.body, undefined);
        assert.deepEqual(a.fetches[0].requestLog, { caller: 'llm-translator-custom', purpose: 'translation.chat' });
        assert.equal(b.fetches[0].body.stream, false);
        const { stream: _s, ...restA } = a.fetches[0].body, { stream: _p, ...restB } = b.fetches[0].body;
        assert.deepEqual(restA, restB, 'same request apart from stream');
        assert(texts.length >= 2);
    });
}
await check('callLLMAPI 직접: 중간에 끊긴 스트림은 버리고 예전 요청(stream:false)으로 한 번 더 — 결과는 예전 답 그대로', async () => {
    const half = FAMILY_STREAMS.claude(TEXT);
    const f = directFixture({ serve: (body, signal) => body.stream ? new Response(byteStream(half.slice(0, half.indexOf('⟦2⟧')), { signal })) : jsonResponse(FAMILY_JSON.claude('예전 요청의 답')) });
    const texts = [];
    assert.equal(await f.env.callLLMAPI('p', { onStream: t => texts.push(t) }), '예전 요청의 답');
    assert.deepEqual(f.fetches.map(x => x.body.stream), [true, false]);
    assert(texts.at(-1).includes('⟦1⟧'), 'partial text went only to onStream');
    assert(f.warnings.some(w => /흘려받지 못해/.test(w)));
    assert(!f.env.noStream.size, 'a cut is not a reason to stop streaming');
});
await check('callLLMAPI 직접: 400 · 404 는 예전 요청으로 (404 는 이 세션 동안 흘려받기 끔) · 통째로 온 본문은 다시 보내지 않고 그대로 읽음', async () => {
    let status = 400;
    const f = directFixture({ serve: body => body.stream ? jsonResponse({ error: { message: 'bad' } }, status) : jsonResponse(FAMILY_JSON.claude(TEXT)) });
    assert.equal(await f.env.callLLMAPI('p', { onStream() {} }), TEXT.trim());
    assert.deepEqual(f.fetches.map(x => x.body.stream), [true, false]); assert.equal(f.env.noStream.size, 0);
    status = 404; f.fetches.length = 0;
    await f.env.callLLMAPI('p', { onStream() {} });
    assert.deepEqual(f.fetches.map(x => x.body.stream), [true, false]); assert.equal(f.env.noStream.size, 1);
    f.fetches.length = 0;
    await f.env.callLLMAPI('p', { onStream() {} });
    assert.deepEqual(f.fetches.map(x => x.body.stream), [false], 'remembered');
    const g = directFixture({ provider: 'custom', serve: () => jsonResponse(FAMILY_JSON.openai(TEXT)) });   // 서버가 stream 을 무시
    assert.equal(await g.env.callLLMAPI('p', { onStream() {} }), TEXT.trim());
    assert.equal(g.fetches.length, 1); assert.equal(g.env.noStream.size, 1);
});
await check('callLLMAPI 직접: 429 · 5xx 는 곧장 또 보내지 않고 예전과 같은 오류 (일시 오류 표시 그대로)', async () => {
    for (const [status, flag] of [[429, 'transient'], [500, 'transient'], [529, 'transient'], [524, 'timeout']]) {
        const f = directFixture({ serve: () => jsonResponse({ type: 'error', error: { message: 'busy' } }, status) });
        const g = directFixture({ serve: () => jsonResponse({ type: 'error', error: { message: 'busy' } }, status) });
        const a = await f.env.callLLMAPI('p', { onStream() {} }).catch(e => e), b = await g.env.callLLMAPI('p').catch(e => e);
        assert.equal(f.fetches.length, 1, String(status));
        assert.equal(a.message, b.message); assert.equal(a[flag], true, `${status} ${flag}`); assert.equal(a[flag], b[flag]);
    }
});
await check('callLLMAPI 직접: 멈춤 · 시간 초과는 예전 요청 없이 같은 오류', async () => {
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const body = FAMILY_STREAMS.openai(TEXT);
    const f = directFixture({ provider: 'openai', serve: (b, signal) => new Response(byteStream(body, { pieces: 6, signal, before: i => (i === 2 ? gate : null) })) });
    const outer = new AbortController(), reason = Object.assign(new Error('채팅이 바뀌어 멈췄어요'), { cancelled: true });
    const run = f.env.callLLMAPI('p', { onStream() {}, signal: outer.signal });
    await tick(); await tick();
    outer.abort(reason); release();
    await assert.rejects(run, e => e === reason);
    assert.equal(f.fetches.length, 1);
    // 2.9.3 첫 글이 오기 전에 멈춘 답만 제한 시간으로 끊는다 (글이 오기 시작하면 90초 멈춤으로 — translator-stream-idle.mjs)
    const g = directFixture({ provider: 'openai', serve: (b, signal) => new Response(byteStream(body, { pieces: 6, signal, before: i => (i === 0 ? new Promise(() => {}) : null) })) });
    await assert.rejects(g.env.callLLMAPI('p', { onStream() {}, timeoutMs: 60 }), e => e.timeout && /0초 안에 답이 없어/.test(e.message));
    assert.equal(g.fetches.length, 1);
});
await check('callLLMAPI 직접: onStream 이 없으면(통짜 · 덩이 · 남은 가나 · 다른 모델) 흘려받지 않음 · 텍스트 완성 공급자도', async () => {
    const f = directFixture({ serve: () => jsonResponse(FAMILY_JSON.claude(TEXT)) });
    await f.env.callLLMAPI('p'); await f.env.callLLMAPI('p', { via: { provider: 'claude', model: 'other' } });
    assert.deepEqual(f.fetches.map(x => [x.body.stream, x.request]), [[false, false], [false, false]]);
});
await check('requestCurrentConnection(현재 연결): 실리태번 ChatCompletionService 와 같은 본문으로 흘려받고, 오류 · 실패는 예전처럼', async () => {
    const make = (serve, mainApi = 'openai') => {
        const fetched = [], processed = [];
        const ctx = { mainApi, chatCompletionSettings: { chat_completion_source: 'claude' }, ChatCompletionService: {
            createRequestData: payload => ({ ...payload, use_sysprompt: true }),
            processRequest: async payload => { processed.push(payload); return FAMILY_JSON.claude('예전 요청의 답'); } } };
        const f = directFixture({ serve: (body, signal) => { fetched.push(body); return serve(body, signal); } });
        const call = () => requestCurrentConnection({ context: () => ctx, messages: [{ role: 'user', content: 'p' }], buildChat: async () => ({ chat_completion_source: 'claude', messages: [] }),
            stream: async (live, payload, signal) => {
                const body = live.ChatCompletionService.createRequestData(payload);
                const reply = await f.env.streamedReply({ body, source: body.chat_completion_source, onText() {}, signal });
                if (!reply) return null;
                const json = reply.data ?? JSON.parse(await reply.replay.text());
                if (reply.replay?.ok === false || json?.error) throw new Error(String(json?.error?.message || 'Response not OK'));
                return json;
            } });
        return { call, fetched, processed };
    };
    const ok = make((body, signal) => new Response(byteStream(FAMILY_STREAMS.claude(TEXT), { signal })));
    assert.deepEqual(await ok.call(), { choices: [{ message: { content: '' } }], content: [{ type: 'thinking', thinking: '먼저 문단을 센다.', signature: '' }, { type: 'text', text: TEXT }] });
    assert.equal(ok.fetched[0].use_sysprompt, true); assert.equal(ok.fetched[0].stream, true); assert.equal(ok.processed.length, 0);
    const broken = make((body, signal) => new Response(byteStream('data: {"type":"message_start"}\n\n', { signal })));
    assert.deepEqual(await broken.call(), FAMILY_JSON.claude('예전 요청의 답')); assert.equal(broken.processed.length, 1);
    const busy = make(() => jsonResponse({ error: { message: 'Too Many Requests' } }, 429));
    await assert.rejects(busy.call(), e => e.transient === true); assert.equal(busy.processed.length, 0);
    const connection = fs.readFileSync(path.join(dir, 'current-connection.js'), 'utf8');
    assert(connection.includes('const streamed=stream?await stream(ctx,payload,controller.signal,touch):null;'), 'chat completion only');   // 2.9.3 touch
    assert.equal(connection.split('stream(ctx').length - 1, 1, 'text completion stays stream:false');
});

// ── ④ translate() ──
const BRACKET_NOTE = /\nconst BRACKET_NOTE = '([^']*)'/.exec(source)?.[1] ?? '';
const S = { llm_prompt_chat: 'Translate visible text.', glossary_enabled: false, user_defined_regexes: [], user_no_fold_regexes: [], translation_display_mode: 'disabled' };
const PREFIX = 'Translate visible text.\n\n';
const LINE = n => `Line ${n}: The lantern by the window flickered while the kettle hummed softly over the stove.`;
const LINE_KO = n => `${n}번째 줄: 창가의 등불이 깜박이는 동안 주전자가 화덕 위에서 나지막이 노래했다.`;
const SAY = '<span style="color:#7fe03c">「Stay here, it is warm by the stove.」</span>';
const SAY_KO = '<span style="color:#7fe03c">화덕 옆이 따뜻하니 여기 있어.</span>';   // 모델이 괄호를 빼먹음 → 2.5.2 가 되살린다
const COMMENT = '<!--  写作自检：\n此处检查节奏：\n\n我正在复盘细节 -->';
const MESSAGE = [LINE(1), SAY, LINE(2), COMMENT, LINE(3), LINE(4), LINE(5), LINE(6)].join('\n\n');
const koBody = body => body.replace(/Line (\d+): The lantern by the window flickered while the kettle hummed softly over the stove\./g, (_, n) => LINE_KO(n)).split(SAY).join(SAY_KO);
// 모델 답: ⟦3⟧ 문단에 초안 누출(2.5.0 stripPlanningNotes 가 걷는 꼴)을 섞는다
const modelAnswer = body => koBody(body).replace(/⟦(\d+)⟧ 3번째 줄/, '⟦$1⟧ 「등불 이야기」 — let me write properly.\n\n<output>\n3번째 줄').replace(/(3번째 줄: [^\n]*)/, '$1</output>');
function translateEnv() {
    const T = { sent: [], progress: [], previews: [], streamMode: true, flushEach: true, onSend: null };
    const env = { ...KOREAN_KEEP_ENV, ...card, ...seg, ...resume, ...auto, cardValues: cardValueModule.cardValues, getStringHash: t => [...String(t)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0), extensionSettings: S,
        getContext: () => ({ chatMetadata: {}, chat: [], chatId: 'chat-A' }), guards: { capture: () => ({ assert() { if (T.moved) throw Object.assign(new Error('채팅이 바뀌어 멈췄어요'), { cancelled: true }); } }) },
        connectionSignature: () => '', watchGuard: guardModule.watchGuard,
        document: { getElementById: () => null, querySelector: () => null },
        BLOCKED_CHUNK_MARK: '[차단된 문단 — 원문 그대로]', MARK_TAIL: ' — 원문 그대로]', MASK_PATTERN: '[[__VAR_{index}__]]', DEBUG_MODE: false, RULE_PROMPT_KEY: 'rules', substituteCustomPlaceholders: x => x, substituteParams: x => x,
        buildGlossaryBlock: () => '', checkpointKey: async x => x, glossarySegmentSignature: x => () => x, textOutputLimit: () => 0, isTransientError: e => Boolean(e?.transient), CHUNK_TARGET: 100000,
        looksLikeInputBlock: () => false, looksLikeRefusal: () => false, fallbackOf: () => null, sameTarget: () => false, getCustomModelName: () => '',
        tidyKana: x => x, tidyGlossaryOutput: (_s, x) => x, linesToFix: () => [], glossaryHanKeep: () => [], glossaryNameKeep: () => [],
        runtimeProtections: new Map(), console: { debug() {}, info() {}, warn() {}, error() {} }, dropProseStrayWords: seg.dropStrayWords, repairProseTagPairs: seg.repairTagPairs, dropProseLeftoverPlaceholders: seg.dropLeftoverPlaceholders,
        correctBackticks: x => x, window: {}, toastr: { warning() {} }, BRACKET_NOTE, processTranslationText: (_o, t) => t, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 5)),
    };
    for (const name of ['compileUserPattern', 'runtimeRegexes', 'getCombinedRegexes', 'getNoFoldRegexes', 'protectedBlockRegexes', 'isProtectedBlock', 'withoutProtectedBlocks', 'fixMalformedPlaceholders',
        'dropStrayWords', 'dropLeftoverPlaceholders', 'repairTagPairs', 'failMarkOf', 'cutError', 'refusalError', 'splitForChunks', 'liveChatPrompt', 'translate']) env[name] = new Function('env', `with(env){return (${cut(name)});}`)(env);
    env.tidyGlossaryOutput = (_s, x) => x;
    // 가짜 모델: onStream 이 오면(흘려받기) 답을 문단 표시마다 조각내 흘려보내고, 조각 사이에 프레임을 돌린다 — 돌려주는 답은 같다
    env.callLLMAPI = async (prompt, overrides = {}) => {
        const body = prompt.slice(PREFIX.length).replace(BRACKET_NOTE + '\n\n', '');
        T.sent.push({ body, streamed: typeof overrides.onStream === 'function' });
        const out = modelAnswer(body.startsWith(seg.BATCH_HEADER) ? body.slice(seg.BATCH_HEADER.length) : body);
        await T.onSend?.(body, overrides);
        if (T.streamMode && typeof overrides.onStream === 'function') {
            const cuts = [...out.matchAll(/⟦\d+⟧/g)].map(m => m.index).slice(1);
            let from = 0;
            for (const at of [...cuts.flatMap(c => [c + 1, c + 3]), out.length]) {
                overrides.signal?.throwIfAborted?.();
                overrides.onStream(out.slice(0, at)); from = at;
                if (T.flushEach) flushFrames();
                await tick();
            }
            if (T.flushAtEnd) flushFrames();
            if (T.cutAfter) throw Object.assign(new Error('끊김'), { transient: true });
        }
        return out;
    };
    return { env, T };
}
const options = T => ({ segmentCache: true, onProgress: info => T.progress.push(info), onPreview: text => T.previews.push(text) });
await check('translate: 흘려받으면 진행 숫자가 문단마다 1/N … · 결과는 흘려받지 않을 때와 바이트까지 같다 (초안 · 주석 · 괄호 · 상태 그대로)', async () => {
    frames.clear();
    await seg.clearSegmentCache();
    const a = translateEnv();
    const streamed = await a.env.translate(MESSAGE, options(a.T));
    await seg.clearSegmentCache();
    const b = translateEnv(); b.T.streamMode = false;
    const plain = await b.env.translate(MESSAGE, options(b.T));
    await seg.clearSegmentCache();
    const c = translateEnv();
    const quiet = await c.env.translate(MESSAGE, { segmentCache: true });   // 진행 표시 · 바로 보기가 없으면 흘려받지 않는다
    assert.equal(streamed, plain); assert.equal(quiet, plain);
    assert.deepEqual(a.T.sent.map(x => x.body), b.T.sent.map(x => x.body), 'same requests');
    assert(a.T.sent.every(x => x.streamed) && c.T.sent.every(x => !x.streamed));
    assert(!plain.includes('let me write properly') && !plain.includes('<output>'), 'draft leak stripped');
    assert(plain.includes('「화덕 옆이 따뜻하니 여기 있어.」'), 'dialogue brackets restored');
    assert(plain.includes(COMMENT), 'hidden comment back verbatim');
    const counts = a.T.progress.filter(p => p.stage === 'segments' && p.pending).map(p => p.finished);
    const total = a.T.progress.find(p => p.stage === 'segments').batch;
    assert.equal(total, 7, 'seven paragraphs to translate (the comment is protected)');
    assert.deepEqual(counts, [0, 1, 2, 3, 4, 5, 6, 7], 'one step per paragraph');
    assert.deepEqual(b.T.progress.filter(p => p.stage === 'segments' && p.pending).map(p => p.finished), [0, 7], 'without streaming: per batch (as before)');
    assert.equal(a.T.previews.length, 6, 'a preview per closed paragraph but the last');
    assert(a.T.previews[0].includes(LINE_KO(1)) && a.T.previews[0].includes(LINE(2)), 'closed paragraph translated, the rest original');
    assert(a.T.previews[2].includes(LINE_KO(2)) && a.T.previews[2].includes(COMMENT), 'comment in place in previews');
    assert(!a.T.previews.some(p => /\[\[__VAR_\d+__\]\]|⟦/.test(p)), 'no placeholders or markers in previews');
    assert(!a.T.previews.some(p => p.includes('let me write properly')), 'previews strip the draft too');
    assert.equal(frames.size, 0, 'no frame left behind');
});
await check('translate: 여러 묶음 — 둘째 묶음 문단도 제자리 · 한 프레임에 여러 문단이 닫히면 알림 한 번', async () => {
    frames.clear();
    await seg.clearSegmentCache();
    const a = translateEnv(); a.T.flushEach = false; a.T.flushAtEnd = true;   // 프레임을 조각마다 돌리지 않음 → 묶음마다 한 번에 묶임
    S.connection_mode = 'direct'; S.llm_provider = 'claude'; S.parameters = { claude: { max_length: 160 } };   // 묶음 한도 400자 → 두 묶음 이상
    try {
        const out = await a.env.translate(MESSAGE, options(a.T));
        assert(a.T.sent.length >= 2, 'several groups: ' + a.T.sent.length);
        assert.equal(out, koBody(MESSAGE).split(SAY_KO).join('<span style="color:#7fe03c">「화덕 옆이 따뜻하니 여기 있어.」</span>'));
        const counts = a.T.progress.filter(p => p.stage === 'segments' && p.pending).map(p => p.finished);
        for (let i = 1; i < counts.length; i++) assert(counts[i] > counts[i - 1], 'goes up, never back: ' + counts);
        assert.equal(counts.at(-1), 7);
        assert.equal(counts.length, 1 + a.T.sent.length * 2, 'one coalesced update per group while streaming + one at each group end: ' + counts);
        for (const view of a.T.previews) {
            const paras = view.split('\n\n');
            assert.equal(paras.length, MESSAGE.split('\n\n').length, 'layout kept');
            paras.forEach((p, i) => assert(p === MESSAGE.split('\n\n')[i] || p === out.split('\n\n')[i], 'each paragraph is either original or its own translation'));
        }
    } finally { delete S.connection_mode; delete S.llm_provider; delete S.parameters; }
});
await check('translate: 흘려받다 끊긴 묶음 — 2.9.0 부터 닫힌 문단은 하루 이어 하기로 남아 다시 번역하면 남은 문단만 (30일 캐시에는 안 들어감) · 실패한 문단은 원문 + 표시', async () => {
    frames.clear();
    await seg.clearSegmentCache();
    const a = translateEnv(); a.T.cutAfter = true;
    const out = await a.env.translate([LINE(1), LINE(2), LINE(3)].join('\n\n'), options(a.T)).catch(e => e);
    assert(out instanceof Error || /원문 그대로/.test(out), 'failed batch: ' + String(out).slice(0, 80));
    assert(a.T.previews.some(p => p.includes(LINE_KO(1))), 'preview did show streamed paragraphs');
    const b = translateEnv(); b.T.streamMode = false;
    await b.env.translate([LINE(1), LINE(2), LINE(3)].join('\n\n'), { segmentCache: true });
    assert.equal(b.T.sent.length, 1);
    assert(!b.T.sent[0].body.includes(LINE(1)) && !b.T.sent[0].body.includes(LINE(2)) && b.T.sent[0].body.includes(LINE(3)), 'closed paragraphs resumed, only the rest sent');   // 2.9.0 · 2.9.2
});
await check('translate: 번역 중단 감시(채팅 바뀜)가 흘려받는 중에 멈추면 같은 멈춤 오류 · 그 뒤 진행 · 바로 보기 알림 없음', async () => {
    frames.clear();
    await seg.clearSegmentCache();
    const a = translateEnv(); a.T.flushEach = false;
    let hold;
    a.T.onSend = () => new Promise(resolve => { hold = resolve; });
    const run = a.env.translate(MESSAGE, options(a.T));
    while (!hold) await tick();
    hold();
    await tick(); await tick();
    a.T.moved = true;
    const error = await run.catch(e => e);
    assert(error?.cancelled, 'cancelled: ' + error?.message);
    const seen = [a.T.progress.length, a.T.previews.length];
    flushFrames(); await new Promise(resolve => setTimeout(resolve, 30)); flushFrames();
    assert.deepEqual([a.T.progress.length, a.T.previews.length], seen, 'nothing after the stop');
});

// ── 연결 ──
await check('wiring: 묶음 요청만 흘려받기 · 다른 모델 · 통짜 요청은 예전 그대로 · 버전 2.6.2 · CI 에 이 시험', () => {
    assert(/const watch = done && \(onProgress \|\| showPreview\) \? streamWatch\(\{ done, settled: \(\) => translated, shape: tidyKana \}\) : null;/.test(source));
    assert(/batchStream = watch \? \(\) => watch\.follow\(group, at\) : null;/.test(source));
    assert(/out = await request\(promptOf\(layout\), batchStream \? \{ onStream: batchStream\(\) \} : undefined\);/.test(source));
    assert(/try \{ out = await request\(prompt, \{ via: fallbackTo \}\); \}/.test(source), 'fallback model: no stream');
    assert(/translateGroup\(group\.slice\(mid\), half, false, at \+ mid\)/.test(source));
    assert(/\} finally \{ watch\?\.close\(\); \}/.test(source));
    assert(/response = streamed\?\.replay \?\? await fetch\('\/api\/backends\/chat-completions\/generate'/.test(source));
    assert(/if \(stopped\) return;/.test(source), 'preview.show after stop is ignored');
    const version = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')).version;
    assert(version.localeCompare('2.6.2', undefined, { numeric: true }) >= 0, version);
    assert(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes(`ext-version">v${version}<`));
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/translator-stream\.mjs \./);
});

console.log(`translator-stream: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
