// 본채팅 Google(AI Studio · Vertex AI) 답의 끝 이유 알림 (src/main-chat-finish.js 순수 함수 + src/main-chat-rules.js 배선) — v3 본채팅 문지기
//   node tools/tests/main-chat-finish.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const X = await import(pathToFileURL(path.join(root, 'src/main-chat-finish.js')).href);

const results = [];
async function test(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }
const sse = chunks => chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('');
// 시험대가 쓰는 가짜 응답과 같은 모양 (스트림 = 원본 Gemini SSE, 스트림이 아님 = 실리태번 서버가 감싼 JSON · 오류 글)
const SAFETY = sse([
    { candidates: [{ content: { role: 'model', parts: [{ text: '그는 고개를 들어' }] } }], usageMetadata: { thoughtsTokenCount: 2000 } },
    { candidates: [{ content: { role: 'model', parts: [{ text: '' }] }, finishReason: 'SAFETY', safetyRatings: [{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', probability: 'HIGH', blocked: true }] }], usageMetadata: { candidatesTokenCount: 6, thoughtsTokenCount: 2000 } },
]);
const PROMPT_BLOCK = sse([{ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' }, usageMetadata: { promptTokenCount: 900 } }]);
const CUT = sse([
    { candidates: [{ content: { parts: [{ text: '그는' }] } }], usageMetadata: { thoughtsTokenCount: 6200 } },
    { candidates: [{ content: { parts: [{ text: ' 창밖을' }] }, finishReason: 'MAX_TOKENS' }], usageMetadata: { candidatesTokenCount: 75, thoughtsTokenCount: 6425 } },
]);
const FULL = sse([{ candidates: [{ content: { parts: [{ text: '긴 답이 끝까지 왔다.' }] }, finishReason: 'STOP' }], usageMetadata: { candidatesTokenCount: 900, thoughtsTokenCount: 4000 } }]);
const LONG = sse([{ candidates: [{ content: { parts: [{ text: '긴 답' }] }, finishReason: 'MAX_TOKENS' }], usageMetadata: { candidatesTokenCount: 6000, thoughtsTokenCount: 500 } }]);
const NS_EMPTY = JSON.stringify({ error: { message: 'Google AI Studio Candidate text empty' } });
const NS_BLOCKED = JSON.stringify({ error: { message: 'Google Vertex AI API returned no candidate\nPrompt was blocked due to : PROHIBITED_CONTENT' } });
const NS_NO_CANDIDATE = JSON.stringify({ error: { message: 'Google AI Studio API returned no candidate' } });
const NS_OK = JSON.stringify({ choices: [{ message: { content: '짧다' } }], responseContent: { parts: [{ text: '짧다' }] } });
const NS_KEY = JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } });

await test('finishNotice: 안전 필터 · 생각 잘림 · 스트림이 아닌 답의 서버 오류 글 · 그 밖은 없음', () => {
    for (const reason of X.SAFETY_REASONS) assert.equal(X.finishNotice({ ...X.emptyTally(), finish: reason }), 'safety', reason);
    assert.equal(X.finishNotice(X.tallyOf(SAFETY)), 'safety');
    assert.equal(X.finishNotice(X.tallyOf(PROMPT_BLOCK)), 'safety', '프롬프트 차단 (후보 없음)');
    assert.equal(X.finishNotice(X.tallyOf(CUT)), 'thought');
    assert.equal(X.finishNotice(X.tallyOf(FULL)), '', 'STOP');
    assert.equal(X.finishNotice(X.tallyOf(LONG)), '', '답을 길게 쓰다 한도 — 생각 탓이 아님');
    assert.equal(X.finishNotice({ ...X.emptyTally(), finish: 'RECITATION' }), '', '목록 밖');
    assert.equal(X.finishNotice({ ...X.emptyTally(), finish: 'MAX_TOKENS', thoughtChars: 9000, textChars: 300 }), 'thought', '사용량이 없으면 보이는 글자로');
    assert.equal(X.finishNotice(X.tallyOf(NS_EMPTY)), 'empty', '빈 답');
    assert.equal(X.finishNotice(X.tallyOf(NS_BLOCKED)), 'safety', '오류 글에 적힌 프롬프트 차단 이유');
    assert.equal(X.finishNotice(X.tallyOf(NS_NO_CANDIDATE)), 'empty', '이유 없는 후보 없음');
    assert.equal(X.finishNotice(X.tallyOf(NS_OK)), '', '글이 온 답은 끝 이유를 모르니 조용');
    assert.equal(X.finishNotice(X.tallyOf(NS_KEY)), '', '키 오류 등 다른 오류');
    assert.deepEqual(X.sseEvents('data: {"a":1}\n\ndata: [DONE]\ndata: {broken\n: comment\ndata:{"b":2}'), [{ a: 1 }, { b: 2 }]);
    for (const notice of Object.values(X.NOTICES)) assert.ok(notice.length < 60, '짧게');
});

await test('mainGoogleBody · isMainGoogleRequest: 본문 type 이 본채팅 4종 + Google 공급자인 생성 요청의 꼴', () => {
    const url = '/api/backends/chat-completions/generate';
    const post = body => ({ method: 'POST', body: JSON.stringify(body) });
    for (const type of X.MAIN_TYPES) for (const source of ['makersuite', 'vertexai']) {
        assert.equal(X.isMainGoogleRequest(url, post({ type, chat_completion_source: source })), true, type + ' ' + source);
        assert.equal(X.mainGoogleBody(url, post({ type, chat_completion_source: source }))?.type, type);
    }
    assert.equal(X.isMainGoogleRequest(url, post({ type: 'quiet', chat_completion_source: 'makersuite' })), false);
    assert.equal(X.isMainGoogleRequest(url, post({ type: 'impersonate', chat_completion_source: 'makersuite' })), false);
    assert.equal(X.isMainGoogleRequest(url, post({ chat_completion_source: 'makersuite', model: 'gemini-4-argon' })), false, 'type 없는 요청 (테마 애드온)');
    assert.equal(X.isMainGoogleRequest(url, post({ type: 'normal', chat_completion_source: 'openrouter' })), false);
    assert.equal(X.isMainGoogleRequest('http://127.0.0.1:8000/api/backends/chat-completions/generate?x=1', post({ type: 'swipe', chat_completion_source: 'vertexai' })), true);
    assert.equal(X.isMainGoogleRequest('/api/backends/chat-completions/status', post({ type: 'normal', chat_completion_source: 'makersuite' })), false);
    assert.equal(X.isMainGoogleRequest(url, { method: 'GET' }), false);
    assert.equal(X.isMainGoogleRequest(url, { method: 'POST', body: '{broken' }), false);
    assert.equal(X.isMainGoogleRequest(url, { method: 'POST', body: new Blob(['{}']) }), false);
    assert.equal(X.isMainGoogleRequest(url), false);
    assert.equal(X.isMainGoogleRequest(url, { method: 'POST', body: '{"type":"normal","chat_completion_source":"openrouter","model":"makersuite"}' }), false);
});

await test('stackOrigin: 실제 실리태번 · 실리태번 헬퍼 4.11.3 에서 본 스택 모양 (SETTINGS_READY 처리 안)', () => {
    const at = (fn, file) => `    at ${fn} (http://127.0.0.1:8000${file}:1:1)`;
    const own = at('Object.handler', '/scripts/extensions/third-party/bl-theme/src/main-chat-rules.js'), emit = at('EventEmitter.emit', '/scripts/events.js');
    const main = [own, emit, at('createGenerationParameters', '/scripts/openai.js'), at('async sendOpenAIRequest', '/scripts/openai.js'), at('async sendStreamingRequest', '/script.js'), at('async finishGenerating', '/script.js')].join('\n');
    const helperStream = [own, emit, at('async mG', '/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js'), at('async Object.eK [as generate]', '/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js')].join('\n');
    const helperPlain = [own, emit, at('createGenerationParameters', '/scripts/openai.js'), at('async sendOpenAIRequest', '/scripts/openai.js'), at('async vG', '/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js'), at('async Object.tK [as generateRaw]', '/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js')].join('\n');
    const wrapped = [own, emit, at('wrapper', '/scripts/extensions/third-party/some-hook/index.js'), at('createGenerationParameters', '/scripts/openai.js'), at('async Generate', '/script.js')].join('\n');
    const builtin = [own, emit, at('createGenerationParameters', '/scripts/openai.js'), at('async summarize', '/scripts/extensions/memory/index.js'), at('async Generate', '/script.js')].join('\n');
    assert.equal(X.stackOrigin(main, 'bl-theme'), 'main');
    assert.equal(X.stackOrigin(helperStream, 'bl-theme'), 'foreign', '헬퍼 스트림 길 (본체 프레임 없음)');
    assert.equal(X.stackOrigin(helperPlain, 'bl-theme'), 'foreign', '헬퍼 sendOpenAIRequest 길 (본체 바깥에 헬퍼)');
    assert.equal(X.stackOrigin(wrapped, 'bl-theme'), 'main', '본체 안쪽에서 감싸는 확장은 부른 쪽이 아니다');
    assert.equal(X.stackOrigin(builtin, 'bl-theme'), 'foreign', '실리태번 내장 확장이 부른 것');
    assert.equal(X.stackOrigin([own, emit, at('createGenerationParameters', '/scripts/openai.js')].join('\n'), 'bl-theme'), 'unknown', '비동기 프레임이 안 보이면 모름');
    assert.equal(X.stackOrigin(main, ''), 'main', '제 폴더를 몰라도 제 처리 프레임은 본체 안쪽이라 부른 쪽이 아니다');
    assert.equal(X.stackOrigin('', 'bl-theme'), 'unknown');
});

await test('문지기(순수): 본채팅 창 안 · 헬퍼 창 밖의 본문만 표 · 표는 한 번 · 드라이런 · quiet · impersonate · 시간 넘김', () => {
    let t = 1000;
    const G = X.createMainGate({ now: () => t });
    const data = (extra = {}) => ({ type: 'normal', chat_completion_source: 'vertexai', model: 'gemini-4-argon', messages: [{ role: 'user', content: '안녕' }], ...extra });
    const d1 = data();
    assert.equal(G.settingsReady(d1), false, '창 밖');
    G.generationStarted('normal', true); assert.equal(G.settingsReady(d1), false, '드라이런은 창을 안 연다');
    G.generationStarted('quiet', false); assert.equal(G.settingsReady(d1), false, 'quiet');
    G.generationStarted('impersonate', false); assert.equal(G.settingsReady(d1), false, 'impersonate');
    G.generationStarted('normal', false); assert.equal(G.settingsReady(d1), true);
    assert.equal(G.take({ ...d1, stream: true, temperature: 1 }), true, '보낸 본문 (stream · 샘플링 값은 표에 없다)');
    assert.equal(G.take({ ...d1, stream: false }), false, '같은 본문을 다시 보내는 리롤 — 표가 이미 쓰였다');
    assert.equal(G.settingsReady(data({ chat_completion_source: 'openrouter' })), false, 'Google 만');
    assert.equal(G.settingsReady(data({ type: 'quiet' })), false, '본채팅 type 만');
    // 헬퍼 창: 본채팅 창 안이어도 그 사이 본문은 표가 없다
    G.helperStarted('h1'); assert.equal(G.settingsReady(data({ messages: [{ content: '헬퍼' }] })), false);
    G.helperEnded('h1'); const d2 = data({ messages: [{ content: '본채팅 두 번째' }] }); assert.equal(G.settingsReady(d2), true);
    // 헬퍼가 오류로 끝 신호를 안 내도 그 헬퍼 요청이 나가면(표와 안 맞는 생성 요청) 닫힌다
    G.helperStarted('h-err'); assert.equal(G.settingsReady(data({ messages: [{ content: '헬퍼 오류' }] })), false); G.otherRequestSent();
    const dErr = data({ messages: [{ content: '헬퍼 오류 뒤 본채팅' }] }); assert.equal(G.settingsReady(dErr), true, '헬퍼 요청이 나간 뒤에는 본채팅 표'); assert.equal(G.take(dErr), true);
    G.otherRequestSent(); assert.equal(G.state.helpers, 0, '헬퍼 창이 없을 때는 아무 일 없음');
    // 스택: 다른 확장이 부른 본문은 늘 빼고, 본채팅(Generate) 스택이면 헬퍼 창이 열려 있어도 표 (본채팅 시작 직후 끼어든 헬퍼)
    G.helperStarted('h-open'); const dMain = data({ messages: [{ content: '헬퍼 창 안의 본채팅' }] });
    assert.equal(G.settingsReady(dMain, 'main'), true); assert.equal(G.settingsReady(data({ messages: [{ content: 'x' }] }), 'foreign'), false);
    assert.equal(G.settingsReady(data({ messages: [{ content: 'y' }] }), 'unknown'), false, '모르면 헬퍼 창으로');
    assert.equal(G.take(dMain), true); G.helperEnded('h-open');
    assert.equal(G.settingsReady(data({ messages: [{ content: 'z' }] }), 'foreign'), false, '헬퍼 창 밖이어도 다른 확장이 부른 본문은 뺀다');
    // 헬퍼 오류로 실리태번이 본채팅 도중 GENERATION_ENDED 를 내도, 본채팅 스택의 본문은 표 (스택으로 모르는 본문은 닫힌 창으로 빠진다)
    G.generationStarted('normal', false); G.generationEnded();
    const dAfterEnd = data({ messages: [{ content: '헬퍼 오류 뒤 본채팅 본문' }] });
    assert.equal(G.settingsReady(data({ messages: [{ content: 'u' }] }), 'unknown'), false); assert.equal(G.settingsReady(dAfterEnd, 'main'), true); assert.equal(G.take(dAfterEnd), true);
    // 요청도 못 나간 헬퍼는 HELPER_TTL 뒤에는 닫힌다
    G.helperStarted('h2'); t += X.HELPER_TTL + 1; G.generationStarted('swipe', false);
    const d3 = data({ type: 'swipe', messages: [{ content: '스와이프' }] }); assert.equal(G.settingsReady(d3), true);
    // 끝 · 멈춤 신호로 창이 닫힌다 · 끝 신호가 없어도 MAIN_TTL 뒤 닫힌다
    G.generationEnded(); assert.equal(G.settingsReady(data({ messages: [{ content: '끝난 뒤' }] })), false);
    G.generationStarted('continue', false); t += X.MAIN_TTL + 1; assert.equal(G.settingsReady(data({ type: 'continue' })), false);
    assert.equal(G.take(d2), false, '표도 MAIN_TTL 뒤 버린다');
    // 마지막 메시지 글이 다르면 다른 표
    G.generationStarted('normal', false); const d4 = data({ messages: [{ content: 'A' }] }); G.settingsReady(d4);
    assert.equal(G.take(data({ messages: [{ content: 'B' }] })), false); assert.equal(G.take(d4), true);
});

await test('배선: 본채팅 생성만 · 헬퍼 generate(스트림 · 스트림 아님) · 리롤 재전송 · 끼어든 요청은 조용 · 요청과 응답은 그대로', async () => {
    const handlers = {};
    const toasts = [];
    const sent = [];
    globalThis.toastr = { warning: (...args) => toasts.push(args) };
    globalThis.window = {
        fetch: async (url, init) => {
            sent.push(init?.body);
            const { reply, status = 200 } = JSON.parse(init.body).__fake;
            return new Response(reply, { status, headers: { 'Content-Type': reply.startsWith('{') ? 'application/json' : 'text/event-stream' } });
        },
    };
    const ET = { CHAT_COMPLETION_SETTINGS_READY: 'ready', GENERATION_STARTED: 'started', GENERATION_ENDED: 'ended', GENERATION_STOPPED: 'stopped' };
    globalThis.SillyTavern = { getContext: () => ({ event_types: ET, eventSource: { on: (name, fn) => { (handlers[name] ||= []).push(fn); } } }) };
    const R = await import(pathToFileURL(path.join(root, 'src/main-chat-rules.js')).href);
    R.startMainChatRules(); R.startMainChatRules();
    assert.equal(handlers.ready.length, 1, 'Claude 5 규칙과 문지기는 한 처리'); assert.equal(handlers.started.length, 1); assert.equal(handlers.ended.length, 1); assert.equal(handlers.stopped.length, 1);
    for (const e of [...X.HELPER_EVENTS.start, X.HELPER_EVENTS.end]) assert.equal(handlers[e]?.length, 1, e);
    assert.equal(window.fetch.blMainReplyWatch, true);
    const emit = (name, ...args) => { for (const fn of handlers[name] || []) fn(...args); };
    const settle = () => new Promise(r => setTimeout(r, 30));
    const request = (body, reply, status) => window.fetch('/api/backends/chat-completions/generate', { method: 'POST', body: JSON.stringify({ ...body, __fake: { reply, status } }) });
    const gen = async (body, reply, status) => { const res = await request(body, reply, status); const text = await res.text(); await settle(); return text; };
    let n = 0;
    const data = (type = 'normal', extra = {}) => ({ type, chat_completion_source: 'vertexai', model: 'gemini-4-argon', max_tokens: 6500, stream: true, messages: [{ role: 'user', content: `메시지 ${++n}` }], ...extra });
    // 실리태번 본채팅 생성 한 번: GENERATION_STARTED → (보내기 직전) CHAT_COMPLETION_SETTINGS_READY → fetch → GENERATION_ENDED
    const mainGen = async (type, reply, extra = {}, status) => {
        emit('started', type, {}, false);
        const d = data(type, extra); emit('ready', d);
        const text = await gen(d, reply, status);
        emit('ended');
        return { d, text };
    };
    const last = () => toasts.at(-1)?.[0];

    const first = await mainGen('normal', SAFETY);
    assert.equal(first.text, SAFETY, '실리태번이 읽는 응답은 그대로');
    assert.equal(toasts.length, 1); assert.equal(last(), X.NOTICES.safety);
    assert.equal(JSON.parse(sent.at(-1)).max_tokens, 6500, '요청은 바꾸지 않는다');
    await mainGen('regenerate', CUT); assert.equal(toasts.length, 2); assert.equal(last(), X.NOTICES.thought);
    await mainGen('continue', SAFETY); assert.equal(toasts.length, 3, '이어쓰기');
    await mainGen('swipe', SAFETY); assert.equal(toasts.length, 4, '스와이프');
    await mainGen('normal', FULL); assert.equal(toasts.length, 4, '끝까지 온 답은 조용');
    await mainGen('normal', NS_EMPTY, { stream: false }); assert.equal(toasts.length, 5); assert.equal(last(), X.NOTICES.empty);
    await mainGen('regenerate', NS_BLOCKED, { stream: false }); assert.equal(toasts.length, 6); assert.equal(last(), X.NOTICES.safety);
    await mainGen('normal', NS_OK, { stream: false }); assert.equal(toasts.length, 6, '글이 온 답');
    await mainGen('normal', NS_KEY, { stream: false }, 500); assert.equal(toasts.length, 6, '실패 응답은 읽지 않는다');

    // [중] 실리태번 헬퍼 generate · generateRaw — 본문 type 'normal' · 지금 연결(vertexai). 본채팅 생성 창 밖: js_generation_started → (헬퍼가 띄우는) SETTINGS_READY → fetch → js_generation_ended
    const helperGen = async (id, reply, extra = {}) => {
        emit('js_generation_requested', id, 'generate', {}); emit('js_generation_started', id);
        const d = data('normal', extra); emit('ready', d);
        const text = await gen(d, reply);
        emit('js_generation_ended', 'text', id);
        return text;
    };
    await helperGen('h-stream', SAFETY); assert.equal(toasts.length, 6, '헬퍼 generate (스트림) 은 조용');
    await helperGen('h-plain', NS_EMPTY, { stream: false }); assert.equal(toasts.length, 6, '헬퍼 generate (스트림 아님 · sendOpenAIRequest normal) 은 조용');
    // 헬퍼가 SETTINGS_READY 없이 바로 보내도(신호만) 표가 없어 조용
    emit('js_generation_started', 'h-bare'); await gen(data('normal'), SAFETY); emit('js_generation_ended', '', 'h-bare'); assert.equal(toasts.length, 6);
    // 헬퍼 요청이 오류로 끝나 js_generation_ended 가 없어도 그 뒤 본채팅 알림은 막히지 않는다 (실제 헬퍼: 빈 답이면 throw · 끝 신호 없음)
    emit('js_generation_started', 'h-error'); const ed = data('normal', { stream: false }); emit('ready', ed); await gen(ed, NS_EMPTY);
    assert.equal(toasts.length, 6, '오류로 끝난 헬퍼 요청은 조용');
    await mainGen('regenerate', SAFETY); assert.equal(toasts.length, 7, '그 뒤 본채팅은 알림'); assert.equal(last(), X.NOTICES.safety);
    // 본채팅 생성 창 안에서 헬퍼 스크립트가 끼어 보내도 그 요청은 조용 · 그 뒤 본채팅 본문은 알림
    emit('started', 'normal', {}, false);
    emit('js_generation_started', 'h-inside'); const hd = data('normal'); emit('ready', hd); await gen(hd, SAFETY); emit('js_generation_ended', '', 'h-inside');
    assert.equal(toasts.length, 7, '본채팅 창 안의 헬퍼 요청');
    const md = data('normal'); emit('ready', md); await gen(md, SAFETY); emit('ended');
    assert.equal(toasts.length, 8, '같은 창의 본채팅 본문'); assert.equal(last(), X.NOTICES.safety);
    // [하] 다시 쓰기 씬 플랜 리롤: 잡아 둔 본채팅 본문을 그대로(stream:false) 다시 보낸다 — 시도마다 알리지 않는다
    emit('started', 'normal', {}, false); const rd = data('normal'); emit('ready', rd);
    await gen(rd, SAFETY); assert.equal(toasts.length, 9, '원래 답은 알림');
    for (let i = 0; i < 6; i++) await gen({ ...rd, stream: false, n: undefined }, NS_EMPTY);
    emit('ended'); assert.equal(toasts.length, 9, '리롤 재전송 6번은 조용');
    // 드라이런 · 조용한 생성 · 생성 창 밖 · type 없는 요청 · OpenRouter
    emit('started', 'normal', {}, true); const dd = data('normal'); emit('ready', dd); await gen(dd, SAFETY); emit('ended'); assert.equal(toasts.length, 9, '드라이런');
    emit('started', 'quiet', {}, false); const qd = data('quiet', { stream: false }); emit('ready', qd); await gen(qd, NS_EMPTY); emit('ended'); assert.equal(toasts.length, 9, 'quiet');
    await gen(data('normal'), SAFETY); assert.equal(toasts.length, 9, '본채팅 생성 창 밖의 normal 꼴 요청');
    await gen({ chat_completion_source: 'vertexai', model: 'gemini-4-argon', messages: [] }, NS_EMPTY); assert.equal(toasts.length, 9, 'type 없는 요청 (테마 애드온)');
    await mainGen('normal', SAFETY, { chat_completion_source: 'openrouter', model: 'google/gemini-4-argon' }); assert.equal(toasts.length, 9, 'OpenRouter');
    // 멈춤 신호로 창이 닫힌다
    emit('started', 'normal', {}, false); emit('stopped'); const sd = data('normal'); emit('ready', sd); await gen(sd, SAFETY); assert.equal(toasts.length, 9, '멈춘 뒤');
    // 다른 길은 감싸기만 하고 그대로
    const other = await window.fetch('/api/backends/chat-completions/status', { method: 'POST', body: JSON.stringify({ __fake: { reply: '{"data":[]}' } }) });
    assert.equal(await other.text(), '{"data":[]}');
    await settle(); assert.equal(toasts.length, 9);
    // Claude 5 규칙은 그대로
    const claude = { chat_completion_source: 'claude', model: 'claude-haiku-5-5', temperature: 1, max_tokens: 900 };
    handlers.ready[0](claude);
    assert.equal('temperature' in claude, false); assert.equal(claude.max_tokens, 900);
});

await test('공개 글: 금지 글자 없음 · CI 등록 · 문지기 배선', () => {
    const files = ['src/main-chat-finish.js', 'src/main-chat-rules.js', 'tools/tests/main-chat-finish.mjs'].map(read).join('\n');
    assert.ok(!new RegExp(String.fromCharCode(0xAC24)).test(files), 'no forbidden syllable');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/main-chat-finish\.mjs \./);
    const rules = read('src/main-chat-rules.js');
    assert.match(rules, /const body = mainGoogleBody\(input, init\); main = body !== null && mainGate\.take\(body\);/);
    assert.match(rules, /listenMainGate\(eventSource, event_types\);/);
    assert.match(rules, /try \{ stripClaude5Sampling\(data\); \} catch \(error\) \{[^\n]*\}\n\s*try \{ mainGate\.settingsReady\(data, stackOrigin\(new Error\(\)\.stack, OWN_FOLDER\)\); \} catch/);
    assert.match(rules, /if \(!main && isGenerateRequest\(input, init\)\) mainGate\.otherRequestSent\(\);/);
});

const failed = results.filter(r => !r.pass);
for (const r of failed) console.log('FAIL', r.name, '\n', r.error);
console.log(`main-chat-finish: ${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exitCode = 1;
