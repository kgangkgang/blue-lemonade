// TTS 1.7.1 (테마 6.1.8) 대사 분석 — 검열되면 다른 모델로 · 화자 찾기 보강 · 「모르는 화자」 목소리
//   src/addons/tts/src/block-fallback.js (순수) · analysis.js (callProvider 차단 표시 · doAnalyze 한 번만 다시) · player.js (analysisNeeds · lineJobs) · voices.js (unknownVoice)
//   사용자 제보: 수위 높은 답장에서 대사 분석이 거절돼(Gemini PROHIBITED_CONTENT / 중계의 맨 'Bad Request') 분석이 없음 → 색 없는 엑스트라 대사가 「목소리를 먼저 정해요」.
//   node tools/tests/tts-block-fallback.mjs <테마 루트>
// 실리태번 모듈은 data: 스텁, 분석 요청은 가짜 fetch (/api/backends/chat-completions/generate 만 받음).
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsBlockTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: '천지합동청', chatId: 'chat-1', characterId: 0, characters: [{ avatar: '천지합동청.png' }], mainApi: 'openai', chatCompletionSettings: { chat_completion_source: 'custom', custom_url: 'https://relay.example/v1' } } };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__ttsBlockTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return { 'Content-Type': 'application/json' }; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}
export const main_api = 'openai';
export function generateRaw() { throw new Error('없음'); }`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return T.ctx; }
export function saveMetadataDebounced() {}`),
    'popup.js': js(`export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 };
export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup() { return null; }`),
    'utils.js': js(`export function getStringHash(s) { let h = 0; for (const c of String(s ?? '')) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
export function splitRecursive(t) { return [String(t ?? '')]; }`),
    'secrets.js': js(G + 'export const secret_state = { api_key_custom: true, api_key_makersuite: true, api_key_claude: true, api_key_deepseek: true }; export const SECRET_KEYS = { CUSTOM: "api_key_custom", MAKERSUITE: "api_key_makersuite", CLAUDE: "api_key_claude", DEEPSEEK: "api_key_deepseek" };'),
};
register(js(`let S = {};
export async function initialize(d) { S = d.st; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.includes('/addons/tts/')) {
        const base = spec.split('/').pop();
        if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST } });

// 가짜 분석 서버: 모델마다 답을 정한다 (requests 에 모델 · 공급자를 남김)
const NET = { requests: [], replies: {} };
globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (!u.includes('/api/backends/chat-completions/generate')) throw new Error(`시험 중 네트워크 요청: ${u}`);
    const body = JSON.parse(init.body || '{}');
    NET.requests.push({ model: body.model, source: body.chat_completion_source });
    const r = NET.replies[body.model] || NET.replies['*'];
    const out = typeof r === 'function' ? r(body) : r;
    return new Response(JSON.stringify(out.json), { status: out.status || 200, headers: { 'content-type': 'application/json' } });
};
globalThis.toastr = { info() {}, warning() {}, success() {}, error() {} };

const mod = (name) => import(pathToFileURL(path.join(root, name)).href);
const B = await mod('block-fallback.js');
const S = await mod('settings.js');
const A = await mod('analysis.js');
const P = await mod('player.js');
const V = await mod('voices.js');
const TX = await mod('text.js');
const { settings } = S;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ---------- 1. 순수 판정
await test('block judgement: content blocks, ST empty candidate and a bare 400 count; 429 · 401 · network · timeout do not', () => {
    for (const m of ['Prompt was blocked due to : PROHIBITED_CONTENT', 'finish_reason: SAFETY', 'content_filter', 'The prompt contains sensitive words']) assert.equal(B.maybeBlocked(new Error(m)), true, m);
    assert.equal(B.maybeBlocked(new Error('Candidate text empty')), true, 'ST Google empty candidate');
    assert.equal(B.maybeBlocked(new Error('Bad Request')), true, 'bare 400');
    assert.equal(B.maybeBlocked(Object.assign(new Error('요청이 거절됐어요 (키·설정 확인)'), { bare400: true })), true, 'marked bare 400');
    for (const m of ['요청이 너무 잦아요 · 429 Too Many Requests', '인증 실패 (실리태번에 저장된 키 확인)', 'Failed to fetch', '120초 안에 응답이 없어요', 'Bad Request: model not found']) assert.equal(B.maybeBlocked(new Error(m)), false, m);
    assert.equal(B.maybeBlocked(Object.assign(new Error('x'), { name: 'AbortError' })), false, 'abort is never a block');
});
await test('200 replies: safety finish reasons, prompt feedback and blocked error text are blocks; a normal reply is not', () => {
    assert.equal(B.blockedReasonOf({ choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }), 'content_filter');
    assert.equal(B.blockedReasonOf({ candidates: [{ finishReason: 'PROHIBITED_CONTENT' }] }), 'PROHIBITED_CONTENT');
    assert.equal(B.blockedReasonOf({ promptFeedback: { blockReason: 'OTHER' } }), 'OTHER');
    assert.equal(B.blockedReasonOf({ error: { message: 'Prompt was blocked due to : PROHIBITED_CONTENT' } }), 'PROHIBITED_CONTENT');
    assert.equal(B.blockedReasonOf({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] }), '');
    assert.equal(B.refusalReply("I'm sorry, but I can't help with that."), true);
    assert.equal(B.refusalReply('죄송하지만 도와드릴 수 없어요.'), true);
    assert.equal(B.refusalReply('{"segs":[{"i":0,"emotion":"calm"}]}'), false, 'JSON is never a refusal');
    assert.equal(B.refusalReply('Here is the JSON: {"segs":[]}'), false);
});
await test('settings: fallback defaults to on with nothing chosen (= as before) and keeps unknown fields', () => {
    assert.deepEqual(B.normFallback(undefined), { enabled: true, provider: '', model: '' });
    assert.deepEqual(B.normFallback({ enabled: false, provider: ' deepseek ', model: 'deepseek-chat', note: 1 }), { enabled: false, provider: 'deepseek', model: 'deepseek-chat', note: 1 });
    assert.equal(B.fallbackTarget({ enabled: false, provider: 'deepseek', model: 'x' }), null, 'automatic needs the switch');
    assert.deepEqual(B.fallbackTarget({ enabled: false, provider: 'deepseek', model: 'x' }, { manual: true }), { provider: 'deepseek', model: 'x' }, '「다른 모델로 다시」 works with the switch off');
    assert.equal(B.fallbackTarget({ provider: 'deepseek', model: '' }), null);
    assert.equal(settings().analysis.fallback.enabled, true, 'settings() fills analysis.fallback');
});

// ---------- 2. runWithBlockFallback — 한 번만
const blockErr = () => Object.assign(new Error('내용 차단 (PROHIBITED_CONTENT)'), { blocked: true });
await test('one retry only: a block goes to the other model once; a second block ends with one short error', async () => {
    let main = 0, other = 0;
    const target = { provider: 'deepseek', model: 'deepseek-chat' };
    const ok = await B.runWithBlockFallback({ call: async () => { main++; throw blockErr(); }, callFallback: async () => { other++; return 'ok'; }, target, failed: { provider: 'custom', model: 'gemini-3.7-flash', url: 'https://relay.example/v1' } });
    assert.equal(ok, 'ok'); assert.equal(main, 1); assert.equal(other, 1);
    main = other = 0;
    await assert.rejects(B.runWithBlockFallback({ call: async () => { main++; throw blockErr(); }, callFallback: async () => { other++; throw new Error('Bad Request'); }, target, failed: { model: 'gemini-3.7-flash' } }),
        (e) => e.fallback?.blocked === true && /둘 다 거절/.test(e.message) && !e.message.includes(' · '));
    assert.equal(main + other, 2, 'never a third request');
});
await test('not a block → no other model (429 · key · network), same model → no retry, refusal text (200) → other model', async () => {
    let other = 0;
    const target = { provider: 'deepseek', model: 'deepseek-chat' };
    for (const m of ['요청이 너무 잦아요 · 429', '인증 실패', 'Failed to fetch']) {
        await assert.rejects(B.runWithBlockFallback({ call: async () => { throw new Error(m); }, callFallback: async () => { other++; return 'x'; }, target }), new RegExp(m.split(' ')[0]));
    }
    assert.equal(other, 0);
    await assert.rejects(B.runWithBlockFallback({ call: async () => { throw blockErr(); }, callFallback: async () => { other++; return 'x'; }, target, failed: { provider: 'deepseek', model: 'deepseek-chat' } }), /내용 차단/);
    assert.equal(other, 0, 'the same model is not asked again');
    const r = await B.runWithBlockFallback({ call: async () => ({ text: "I'm sorry, I can't." }), callFallback: async () => { other++; return { text: '{}' }; }, target, refused: (x) => B.refusalReply(x.text) });
    assert.deepEqual(r, { text: '{}' }); assert.equal(other, 1);
    let main = 0;
    await B.runWithBlockFallback({ call: async () => { main++; return 'main'; }, callFallback: async () => 'fb', target, via: 'fallback' });
    assert.equal(main, 0, 'via fallback skips the blocked model');
});

// ---------- 3. 분석 요청 (analysis.js) — 가짜 중계: 첫 모델은 막힘, 다른 모델은 정상
const gv = (provider, voiceId, name, extra = {}) => ({ uid: `${provider}:${voiceId}`, provider, voiceId, name, lang: 'ja', group: 'g', aliases: [], params: {}, mix: [], ...extra });
const TEXT = '<span style="color:#3ccfbf">「よう、来たか」</span>\n\nShe notices and grins.\n\n「天使くんじゃん。観光？それとも失恋？」';
function reset({ fallback = { enabled: true, provider: 'deepseek', model: 'deepseek-chat' }, extras = 'auto' } = {}) {
    const s = settings();
    s.voices = [gv('elevenlabs', 'el_zad', 'Zadkiel')];
    s.char_map = { Zadkiel: 'elevenlabs:el_zad' };
    s.card_colors = { '천지합동청.png': { '#3ccfbf': 'Zadkiel' } };
    T.ctx.chatMetadata = { lemon_voice: { colors: { '#3ccfbf': { name: 'Zadkiel', locked: true, auto: false, votes: {}, tvotes: {}, count: 1, aliases: [] } }, userColor: null, palette_at: 0, names: {}, learned: {}, seeded: true } };
    s.default_voice = ''; s.user_voice = ''; s.narrator_voice = ''; s.prefer_provider = 'elevenlabs';
    s.extras = extras; s.extra_map = {};
    s.text_source = 'original'; s.wait_translation = 'off'; s.listen_lang = 'auto'; s.pregen = 'off'; s.mini_player = false;
    s.providers = { elevenlabs: { key: 'el-test', model: 'eleven_v4' } };
    s.analysis = { ...s.analysis, enabled: true, engine: 'provider', provider: 'custom', custom_url: 'https://relay.example/v1', provider_models: { custom: 'gemini-3.7-flash' }, emotion: true, translate: false, speaker: true, when: 'auto', fallback };
    // 엑스트라 엔진(elevenlabs)의 기본 목소리 목록 — unknownVoice 가 여기서 고른다 (오늘 받은 것)
    store.set('lemon_voice_tts_stock', JSON.stringify({ elevenlabs: { at: Date.now(), list: [{ voiceId: 'stk_b', name: 'Bella', g: 'f', a: 'y', l: '' }, { voiceId: 'stk_a', name: 'Adam', g: 'm', a: 'a', l: '' }] } }));
    NET.requests = [];
    NET.replies = {
        'gemini-3.7-flash': { json: { error: { message: 'Prompt was blocked due to : PROHIBITED_CONTENT' } } },
        'deepseek-chat': (body) => {
            const user = JSON.stringify(body.messages);
            const n = (user.match(/\[(\d+)\]/g) || []).length;
            return { json: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ segs: [{ i: 0, emotion: 'calm', speaker: 'Zadkiel', ko: '어이, 왔냐' }, { i: 1, emotion: 'happy', speaker: 'Camilla', ko: '천사 군이네' }].slice(0, Math.max(2, n)), people: { Camilla: { g: 'f', a: 'a', l: 'ja' } } }) } }] } };
        },
    };
}
function message(text = TEXT) {
    const mes = { name: '천지합동청', is_user: false, mes: text, extra: {}, swipe_id: 0, swipes: [text] };
    T.ctx.chat.length = 0; T.ctx.chat.push(mes);
    return mes;
}
const segsOf = (mes) => TX.segmentMessage(mes.mes, { userName: 'User', charName: mes.name, knownNames: [], routes: settings().routes, final: true, skipTags: new Set(), stripRegex: [] }).filter(x => x.kind === 'dialogue' && x.text);

await test('a reply with only an uncoloured extra line still asks for the analysis (speaker finding)', () => {
    reset();
    const mes = message('She grins.\n\n「天使くんじゃん。観光？それとも失恋？」');
    const s = settings();
    s.analysis.emotion = false;   // 감정도 원어도 안 물어도 — 화자 찾기만으로 필요
    const need = P.analysisNeeds(0, mes, s);
    assert.equal(need.speaker, true, 'missingSpeaker');
    assert.equal(P.analysisWanted(0, mes, s, { quiet: true }), true);
    s.analysis.speaker = false;
    assert.equal(P.analysisNeeds(0, mes, s).speaker, false, 'speaker finding off → not needed for that');
});
await test('a blocked analysis is sent once more to the chosen model, the extra gets a voice, and the model is recorded', async () => {
    reset();
    message();
    const a = await A.analyzeMessage(0, {});
    assert.ok(a && Array.isArray(a.segs), 'analysis saved');
    assert.deepEqual(NET.requests.map(r => r.model), ['gemini-3.7-flash', 'deepseek-chat'], 'blocked model once, then the other model once');
    assert.equal(a.model, 'deepseek-chat');
    assert.equal(NET.requests[1].source, 'deepseek');
    assert.equal(a.segs.find(g => g.i === 1)?.speaker, 'Camilla');
});
await test('without a chosen model the block is remembered (no resend on every tap) and the toast points to the setting', async () => {
    reset({ fallback: { enabled: true, provider: '', model: '' } });
    message();
    await assert.rejects(A.analyzeMessage(0, {}), (e) => e.blocked === true && e.noFallback === true);
    assert.equal(NET.requests.length, 1);
    assert.equal(A.hasResponseFailure(0), true, 'the same text is not sent again');
    assert.equal(A.wasBlocked(0), true);
    // 다른 모델을 고르면 분석 설정이 바뀌어 다시 보낼 수 있고, 막힌 메시지는 막힌 모델을 건너뛰고 그 모델로 바로
    settings().analysis.fallback = { enabled: true, provider: 'deepseek', model: 'deepseek-chat' };
    assert.equal(A.hasResponseFailure(0), false);
    NET.requests = [];
    const a = await A.analyzeMessage(0, {});
    assert.ok(a);
    assert.deepEqual(NET.requests.map(r => r.model), ['deepseek-chat'], 'already blocked → straight to the other model');
});
await test('「다른 모델로 다시」 (via fallback) works with the switch off and never asks the blocked model', async () => {
    reset({ fallback: { enabled: false, provider: 'deepseek', model: 'deepseek-chat' } });
    message();
    await assert.rejects(A.analyzeMessage(0, {}), (e) => e.blocked === true);
    assert.deepEqual(NET.requests.map(r => r.model), ['gemini-3.7-flash'], 'switch off → no automatic retry');
    NET.requests = [];
    const a = await A.analyzeMessage(0, { via: 'fallback' });
    assert.ok(a);
    assert.deepEqual(NET.requests.map(r => r.model), ['deepseek-chat']);
});
await test('both models refuse → one short error, two requests, and no third', async () => {
    reset();
    NET.replies['deepseek-chat'] = { status: 400, json: { error: { message: 'Bad Request' } } };
    message();
    await assert.rejects(A.analyzeMessage(0, {}), (e) => e.fallback?.blocked === true);
    assert.equal(NET.requests.length, 2);
    await assert.rejects(A.analyzeMessage(0, {}));
    assert.equal(NET.requests.length, 2, 'remembered — tapping again sends nothing');
});
await test('a 200 reply cut by the safety filter (finish reason) goes to the other model at once — no longer-token retry of the blocked model', async () => {
    reset();
    NET.replies['gemini-3.7-flash'] = { json: { choices: [{ finish_reason: 'content_filter', message: { content: '' } }] } };
    message();
    const a = await A.analyzeMessage(0, {});
    assert.ok(a);
    assert.deepEqual(NET.requests.map(r => r.model), ['gemini-3.7-flash', 'deepseek-chat']);
});
await test('a bare 400 Bad Request (relay hides the reason) also tries the other model once', async () => {
    reset();
    NET.replies['gemini-3.7-flash'] = { status: 400, json: { error: { message: 'Bad Request' } } };
    message();
    const a = await A.analyzeMessage(0, {});
    assert.ok(a);
    assert.deepEqual(NET.requests.map(r => r.model), ['gemini-3.7-flash', 'deepseek-chat']);
});
await test('429 from the analysis model is not a block — no other model', async () => {
    reset();
    NET.replies['gemini-3.7-flash'] = { status: 429, json: { error: { message: 'Too Many Requests' } } };
    message();
    await assert.rejects(A.analyzeMessage(0, {}));
    assert.deepEqual(NET.requests.map(r => r.model), ['gemini-3.7-flash']);
});

await test('review: a 429 whose text says "blocked" is not a content block — no other model', async () => {
    assert.equal(B.maybeBlocked(Object.assign(new Error('요청 오류 · Request blocked by firewall'), { status: 429 })), false);
    assert.equal(B.maybeBlocked(Object.assign(new Error('Request blocked due to rate limit'), { retry: true })), false);
    reset();
    NET.replies['gemini-3.7-flash'] = { json: { error: { message: 'Request blocked due to rate limit (429)' } } };
    message();
    await assert.rejects(A.analyzeMessage(0, {}));
    assert.deepEqual(NET.requests.map(r => r.model), ['gemini-3.7-flash']);
});
await test('review: a bare 400 is remembered (the same request gets the same 400), an empty-candidate answer is not (the next tap tries again, as before)', async () => {
    reset({ fallback: { enabled: true, provider: '', model: '' } });
    NET.replies['gemini-3.7-flash'] = { status: 400, json: { error: { message: 'Bad Request' } } };
    message();
    await assert.rejects(A.analyzeMessage(0, {}), (e) => e.noFallback === true);
    assert.equal(A.hasResponseFailure(0), true);
    reset({ fallback: { enabled: true, provider: '', model: '' } });
    NET.replies['gemini-3.7-flash'] = { json: { error: { message: 'Candidate text empty' } } };
    message();
    await assert.rejects(A.analyzeMessage(0, {}), (e) => e.noFallback === true);
    assert.equal(A.hasResponseFailure(0), false);
});
await test('review: a top-up of an analysis made by the other model goes straight to that model; 「다른 모델로 다시」 keeps finished work', async () => {
    reset();
    message();
    const first = await A.analyzeMessage(0, {});
    assert.equal(first.via, 'fallback');
    settings().analysis.translate = true;
    NET.requests = [];
    const more = await A.analyzeMessage(0, { langs: ['ko'] });
    assert.deepEqual(NET.requests.map(r => r.model), ['deepseek-chat'], 'the blocked model is not asked again for the new language');
    assert.equal(more.segs.find(g => g.i === 1)?.speaker, 'Camilla', 'speakers kept');
    assert.ok((more.langs || []).includes('ko'));
});
await test('review: a fallback equal to the analysis model is flagged (toast says so) and Model Switch leaves the fallback off by default and refuses the same model', async () => {
    reset({ fallback: { enabled: true, provider: 'custom', model: 'gemini-3.7-flash' } });
    message();
    await assert.rejects(A.analyzeMessage(0, {}), (e) => e.fallbackSame === true);
    assert.equal(NET.requests.length, 1);
    const MS = await mod('modelswitch.js');
    assert.equal(MS.fallbackTarget().defaultOff, true);
    assert.equal(MS.applyFallback({ source: 'custom', model: 'gemini-3.7-flash' }), false, 'same as the analysis model → refused');
    assert.equal(MS.applyFallback({ source: 'deepseek', model: 'deepseek-chat' }), true);
    assert.deepEqual([settings().analysis.fallback.provider, settings().analysis.fallback.model], ['deepseek', 'deepseek-chat']);
});

// ---------- 4. 분석이 끝내 없을 때: 「모르는 화자」
await test('no analysis in the end → the uncoloured line reads with one unknown-speaker voice (same per card and chat), not a toast', async () => {
    reset({ fallback: { enabled: true, provider: '', model: '' } });
    const mes = message();
    await assert.rejects(A.analyzeMessage(0, {}));   // 막힘 · 다른 모델 없음 → 실패 기억
    const r = P.lineJobs(0, mes, segsOf(mes));
    assert.equal(r.missing, false, 'no 「목소리를 먼저 정해요」');
    const extra = r.jobs.find(j => /天使くん/.test(j.text));
    assert.ok(extra, 'the extra line is read');
    assert.ok(['stk_a', 'stk_b'].includes(extra.voice.voiceId), 'a stock voice of the extras engine');
    const again = P.lineJobs(0, mes, segsOf(mes)).jobs.find(j => /天使くん/.test(j.text));
    assert.equal(again.voice.voiceId, extra.voice.voiceId, 'the same voice every time');
    assert.equal(V.unknownVoice('천지합동청.png|chat-1').voiceId, V.unknownVoice('천지합동청.png|chat-1').voiceId);
    const zad = r.jobs.find(j => /よう/.test(j.text));
    assert.equal(zad.voice.voiceId, 'el_zad', 'coloured lines keep their own voice');
});
await test('extras off → no unknown-speaker voice (as before); analysis still pending → not guessed early', async () => {
    reset({ extras: 'off', fallback: { enabled: true, provider: '', model: '' } });
    let mes = message();
    await assert.rejects(A.analyzeMessage(0, {}));
    assert.equal(P.lineJobs(0, mes, segsOf(mes)).missing, true, 'extras off keeps the old missing-voice path');
    reset();
    mes = message();
    const r = P.lineJobs(0, mes, segsOf(mes));
    assert.equal(r.jobs.some(j => /天使くん/.test(j.text)), false, 'before the analysis has run the line is not given a guessed voice');
});

await test('review: a sound-scene row with the unknown-speaker voice plays (the temporary voice is not in the voice list)', async () => {
    reset({ fallback: { enabled: true, provider: '', model: '' } });
    const mes = message();
    await assert.rejects(A.analyzeMessage(0, {}));
    const rows = P.scriptRows(0);
    const row = rows.find(r => /天使くん/.test(r.text));
    assert.ok(row && row.voiceUid, 'the row carries the unknown-speaker voice');
    const jobs = P._forTest.sceneJobs(0, [row]);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].voice.uid, row.voiceUid);
});

console.log(`\ntts-block-fallback: ${pass} passed, ${fail} failed`);
if (fail) process.exitCode = 1;
