// TTS 1.4.4 듣는 언어 (listen_lang) — src/addons/tts/src/listen.js · player.js (buildJobs · lineJobs · listenNeeds · streamBlocked · analysisNeeds) · settings.js
//   node tools/tests/tts-listen.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈은 data: 스텁, LLM 번역 애드온은 globalThis[Symbol.for('blue-lemonade.translator')] 의 가짜 (부른 줄을 기록하고 '[ja] 원문' 을 돌려줌).
// 네트워크 없음 (fetch 는 엔진 요청 본문을 볼 때만 바꿔 끼움). IndexedDB 가 없어 캐시는 메모리만.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__ttsListenTest = { ext: {}, ctx: { chat: [], chatMetadata: {}, name1: 'User', name2: 'Mina' } };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const G = 'const T = globalThis.__ttsListenTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.ctx.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
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
    'secrets.js': js('export const secret_state = {};'),
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

const mod = (name) => import(pathToFileURL(path.join(root, name)).href);
const S = await mod('settings.js');
const L = await mod('listen.js');
const P = await mod('player.js');
const PR = await mod('providers/index.js');
const TX = await mod('text.js');
const { settings } = S;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- 가짜 LLM 번역 애드온 (translateForSpeech · speechReady · speechModelTag)
const DEFAULT_REPLY = (lines, target) => lines.map(x => `[${target}] ${x}`);
const API = {
    calls: [], ready: { ok: true }, tag: 'direct|custom|mock', delay: 0, drop: new Set(), signals: [],
    reply: DEFAULT_REPLY,
    async translateForSpeech(lines, target, { signal } = {}) {
        this.calls.push({ lines: [...lines], target });
        this.signals.push(signal);
        if (this.delay) {
            await new Promise((res, rej) => {
                const t = setTimeout(res, this.delay);
                signal?.addEventListener('abort', () => { clearTimeout(t); rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
            });
        }
        return this.reply(lines, target).map((x, i) => (this.drop.has(lines[i]) ? null : x));
    },
    speechReady() { return this.ready; },
    speechModelTag() { return this.tag; },
};
const SYM = Symbol.for('blue-lemonade.translator');
function apiReset() {
    API.calls = []; API.signals = []; API.ready = { ok: true }; API.reply = DEFAULT_REPLY; API.tag = 'direct|custom|mock'; API.delay = 0; API.drop = new Set();
    globalThis[SYM] = API;
    T.ext.salty = { addons: { translator: true } };
    L._forTest.reset();
}

// ---------- 목소리 · 메시지
const gv = (provider, voiceId, name, extra = {}) => ({ uid: `${provider}:${voiceId}`, provider, voiceId, name, lang: '', group: 'g', aliases: [], params: {}, mix: [], ...extra });
function reset(listen = 'auto') {
    const s = settings();
    s.voices = [gv('minimax', 'mm_a', 'Mina'), gv('elevenlabs', 'el_a', 'Ella')];
    s.char_map = { Mina: 'minimax:mm_a', Ella: 'elevenlabs:el_a' };
    s.default_voice = 'minimax:mm_a';
    s.user_voice = ''; s.narrator_voice = ''; s.prefer_provider = '';
    s.emotion_strength = 'normal';
    s.pregen = 'dialogue';
    s.text_source = 'display';
    s.pron_dict = '';
    s.wait_translation = 'off';
    s.extras = 'off';
    s.analysis = { ...s.analysis, enabled: false, translate: true };
    s.providers = { minimax: { key: 'mm-test-key-000000000000000000000000000000000000', host: 'https://api.minimax.io', model: 'speech-2.8-hd' }, elevenlabs: { key: 'el-test', model: 'eleven_v4' } };
    s.mini_player = false;
    s.listen_lang = listen;
    apiReset();
}
function message(text, { name = 'Mina', display = null } = {}) {
    const mes = { name, is_user: false, mes: text, extra: display ? { display_text: display } : {}, swipe_id: 0 };
    T.ctx.chat.length = 0; T.ctx.chat.push(mes);
    T.ctx.name1 = 'User'; T.ctx.name2 = name;
    return mes;
}
const segsOf = (mes) => TX.segmentMessage(mes.mes, { userName: 'User', charName: mes.name, knownNames: [], routes: settings().routes, final: true, skipTags: new Set(), stripRegex: [] }).filter(x => x.kind === 'dialogue' && x.text);
const jobsOf = (mes, opts) => P.lineJobs(0, mes, segsOf(mes), opts);
const EN = '"Hello there." She smiled. "See you tomorrow."';

// ---------- 1. 글자 갈래 · 설정
await test('inTarget: 한글 · 가나 · 한자 · 라틴을 세어 이미 그 언어인지 (한자만이면 일본어로는 옮김 · 글자가 없으면 그대로)', () => {
    assert.equal(L.inTarget('안녕하세요.', 'ko'), true);
    assert.equal(L.inTarget('아델이 Adelstein라고 했다.', 'ko'), true, '한국어 속 영어 이름');
    assert.equal(L.inTarget('Hello there.', 'ko'), false);
    assert.equal(L.inTarget('ありがとう。', 'ja'), true);
    assert.equal(L.inTarget('アデルシュタインさん、おはよう。', 'ja'), true);
    assert.equal(L.inTarget('大丈夫。', 'ja'), false, '한자만 → 중국어일 수도 있어 옮김');
    assert.equal(L.inTarget('大丈夫。', 'zh'), true);
    assert.equal(L.inTarget('你好，我们走吧。', 'zh'), true);
    assert.equal(L.inTarget('ありがとう。', 'zh'), false);
    assert.equal(L.inTarget('Hello there.', 'en'), true);
    assert.equal(L.inTarget('Hello, ありがとう。', 'en'), false, '섞인 줄은 옮김');
    assert.equal(L.inTarget('Hello, ありがとう。', 'ja'), true);
    assert.equal(L.inTarget('안녕', 'en'), false);
    for (const t of ['ko', 'ja', 'en', 'zh']) assert.equal(L.inTarget('……!?', t), true, '글자 없음');
});
await test('설정: 기본 자동 · 모르는 값은 자동 · 고르는 값 목록이 listen.js 와 같음', () => {
    assert.equal(S.DEFAULTS.listen_lang, 'auto');
    assert.deepEqual([...S.LISTEN_LANGS], [...L.LISTEN_LANGS]);
    assert.equal(L.listenTarget({ listen_lang: 'auto' }), '');
    assert.equal(L.listenTarget({ listen_lang: 'ja' }), 'ja');
    assert.equal(L.listenTarget({ listen_lang: 'xx' }), '');
    assert.equal(L.listenTarget({}), '');
    assert.equal(L.langName('ja'), '일본어');
});

// ---------- 2. 캐시 열쇠
await test('캐시 열쇠: 원문 + 목표 언어 + 번역 모델 (공백 · 줄바꿈만 다른 원문은 같음 · 원문 글은 열쇠에 없음)', () => {
    const k = L.cacheKey('Hello there.', 'ja', 'direct|custom|mock');
    assert.equal(L.cacheKey('  Hello there.\n', 'ja', 'direct|custom|mock'), k);
    assert.notEqual(L.cacheKey('Hello there.', 'en', 'direct|custom|mock'), k);
    assert.notEqual(L.cacheKey('Hello there.', 'ja', 'direct|custom|other'), k);
    assert.notEqual(L.cacheKey('Hello there!', 'ja', 'direct|custom|mock'), k);
    assert.ok(!k.includes('Hello'), k);
});

// ---------- 3. fill: 한 묶음 · 메모리 · 진행 중 요청에 붙기 · 못 옮긴 줄 · 번역기 없음 · 모델 바뀜
await test('fill: 줄 셋 = 번역기 한 요청 · 다시 부르면 요청 없음 (메모리) · peek', async () => {
    reset('ja');
    const r = await L.fill(['A one.', 'B two.', 'C three.', 'A one.'], 'ja');
    assert.deepEqual(r, { asked: 3, failed: 0 });
    assert.equal(API.calls.length, 1);
    assert.deepEqual(API.calls[0], { lines: ['A one.', 'B two.', 'C three.'], target: 'ja' });
    assert.equal(L.peek('B two.', 'ja'), '[ja] B two.');
    assert.deepEqual(await L.fill(['A one.', 'C three.'], 'ja'), { asked: 0, failed: 0 });
    assert.equal(API.calls.length, 1, '두 번째는 메모리');
});
await test('fill: 겹치는 두 요청은 한 요청에 붙는다 (자동 읽기 + 미리 만들기)', async () => {
    reset('ja');
    API.delay = 60;
    const [a, b] = await Promise.all([L.fill(['X.', 'Y.'], 'ja'), L.fill(['Y.', 'X.'], 'ja')]);
    assert.equal(API.calls.length, 1);
    assert.equal(a.asked + b.asked, 2);
    assert.equal(L.peek('X.', 'ja'), '[ja] X.');
});
await test('fill: 기다리는 쪽이 모두 그만두면 요청도 끊고, 하나만 그만두면 계속', async () => {
    reset('ja');
    API.delay = 200;
    const c1 = new AbortController();
    const p1 = L.fill(['Stop me.'], 'ja', { signal: c1.signal });
    await sleep(20);
    c1.abort();
    await assert.rejects(p1, e => e.name === 'AbortError');
    await sleep(10);
    assert.equal(API.signals[0].aborted, true, '혼자 기다리던 요청은 끊김');
    assert.equal(L.peek('Stop me.', 'ja'), '');
    const c2 = new AbortController();
    const q1 = L.fill(['Keep me.'], 'ja', { signal: c2.signal });
    const q2 = L.fill(['Keep me.'], 'ja');
    await sleep(20);
    c2.abort();
    await assert.rejects(q1, e => e.name === 'AbortError');
    assert.deepEqual(await q2, { asked: 0, failed: 0 });
    assert.equal(API.calls.length, 2);
    assert.equal(API.signals[1].aborted, false, '다른 쪽이 기다리면 요청은 계속');
    assert.equal(L.peek('Keep me.', 'ja'), '[ja] Keep me.');
});
await test('fill: 번역기가 null 을 준 줄은 failed · 번역 애드온 꺼짐 · 준비 안 됨(키 없음)은 보내지 않고 notReady', async () => {
    reset('ja');
    API.drop = new Set(['Bad.']);
    assert.deepEqual(await L.fill(['Good.', 'Bad.'], 'ja'), { asked: 2, failed: 1 });
    assert.equal(L.peek('Bad.', 'ja'), '');
    T.ext.salty.addons.translator = false;
    assert.equal(L.translatorState().ok, false);
    await assert.rejects(L.fill(['New.'], 'ja'), e => e.notReady === true);
    T.ext.salty.addons.translator = true;
    API.ready = { ok: false, why: '번역 API 키가 없어요' };
    assert.equal(L.translatorState().why, '번역 API 키가 없어요');
    await assert.rejects(L.fill(['New.'], 'ja'), e => e.notReady === true && /키/.test(e.message));
    delete globalThis[SYM];
    assert.equal(L.translatorState().ok, false, '애드온이 API 를 안 냄 (단독 확장이 돌아 대기)');
    assert.equal(API.calls.length, 1, '준비 안 된 때는 한 번도 안 보냄');
});
await test('못 옮긴 줄은 잠시 기억: 다시 불러도 요청 없음 (원문) · listenNeeds 에서도 빠짐 · 캐시 비우기 뒤엔 다시 · 거절 오류도 · 그만둠은 세지 않음', async () => {
    reset('ja');
    API.drop = new Set(['Bad.']);
    assert.deepEqual(await L.fill(['Good.', 'Bad.'], 'ja'), { asked: 2, failed: 1 });
    assert.deepEqual(await L.fill(['Bad.'], 'ja'), { asked: 0, failed: 1 });
    assert.equal(API.calls.length, 1, '막힌 줄로 또 보내지 않음');
    assert.equal(L.failedRecently('Bad.', 'ja'), true);
    const mes = message('"Bad." "Good."');
    assert.deepEqual(P._forTest.listenNeeds(0, mes), [], '다시 듣기 · 누르기도 기다리지 않고 원문으로');
    assert.deepEqual(jobsOf(mes).jobs.map(j => j.text), ['Bad.', '[ja] Good.']);
    await L.clearCache();
    API.drop = new Set();
    assert.deepEqual(await L.fill(['Bad.'], 'ja'), { asked: 1, failed: 0 }, '캐시 비우기 뒤엔 다시 보냄');
    reset('ja');
    const real = API.translateForSpeech;
    API.translateForSpeech = async function (lines) { this.calls.push({ lines: [...lines] }); throw Object.assign(new Error('blocked'), { refused: true }); };
    try {
        await assert.rejects(L.fill(['Blocked.'], 'ja'), /blocked/);
        assert.equal(L.failedRecently('Blocked.', 'ja'), true, '거절 오류도 기억');
        await L.fill(['Blocked.'], 'ja');
        assert.equal(API.calls.length, 1);
    } finally { API.translateForSpeech = real; }
    reset('ja');
    API.delay = 200;
    const c = new AbortController();
    const p = L.fill(['Stopped.'], 'ja', { signal: c.signal });
    await sleep(20);
    c.abort();
    await assert.rejects(p, e => e.name === 'AbortError');
    await sleep(20);
    assert.equal(L.failedRecently('Stopped.', 'ja'), false, '그만둔 줄은 다음에 다시 옮김');
});
await test('fill: 번역 모델이 바뀌면 새로 옮긴다 (열쇠에 모델)', async () => {
    reset('ja');
    await L.fill(['Same line.'], 'ja');
    API.tag = 'direct|custom|other';
    await sleep(1100);   // 모델 지문은 1초 기억
    assert.equal(L.peek('Same line.', 'ja'), '');
    await L.fill(['Same line.'], 'ja');
    assert.equal(API.calls.length, 2);
});

// ---------- 4. 재생기 작업 (탭 · 미리 만들기와 같은 길 lineJobs)
const realFetch = globalThis.fetch;
async function bodyOf(job) {
    let body = null;
    globalThis.fetch = async (u, init = {}) => {
        body = init.body ? JSON.parse(init.body) : null;
        if (/t2a_v2/.test(u)) return new Response(JSON.stringify({ data: { audio: 'fff344c4' }, extra_info: { usage_characters: 3 }, base_resp: { status_code: 0 } }), { status: 200, headers: { 'content-type': 'application/json' } });
        return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/mpeg' } });
    };
    try { await job.provider.synth({ text: job.text, voice: job.voice, cfg: P.voiceCfg(job.provider, job.voice), params: job.params, lang: job.lang, emotion: job.emotion, signal: new AbortController().signal }); }
    finally { globalThis.fetch = realFetch; }
    return body;
}
let autoKeys = null;
await test('자동: 1.4.3 과 같은 작업 · 캐시 키 · 번역기 요청 없음', () => {
    reset('auto');
    const mes = message(EN);
    const jobs = jobsOf(mes).jobs;
    assert.deepEqual(jobs.map(j => j.text), ['Hello there.', 'See you tomorrow.']);
    assert.ok(jobs.every(j => !j.listen && !j.listenPending));
    assert.deepEqual(P._forTest.listenNeeds(0, mes), []);
    autoKeys = jobs.map(j => j.key);
    // 설정 칸이 아예 없던 1.4.3 설정 객체와도 같은 키
    delete settings().listen_lang;
    assert.deepEqual(jobsOf(mes).jobs.map(j => j.key), autoKeys);
    settings().listen_lang = 'auto';
    assert.equal(API.calls.length, 0);
});
await test('일본어로 듣기: 영어 채팅 → 메시지의 읽을 줄을 한 묶음으로 → 옮긴 글로 읽음 (엔진 언어 Japanese · 강조는 화면 조각 그대로)', async () => {
    reset('ja');
    const mes = message(EN);
    const before = jobsOf(mes).jobs;
    assert.ok(before.every(j => j.listenPending), '옮기기 전엔 남은 줄');
    assert.deepEqual(before.map(j => j.text), ['Hello there.', 'See you tomorrow.'], '옮기기 전 = 원문 (못 옮기면 이대로 읽음)');
    const need = P._forTest.listenNeeds(0, mes);
    API.reply = (lines) => lines.map(x => `にほんご ${x}`);   // 일본어 글자가 있는 답 (엔진 언어 = 일본어)
    assert.deepEqual(need, ['Hello there.', 'See you tomorrow.']);
    await L.fill(need, 'ja');
    assert.equal(API.calls.length, 1, '메시지 하나 = 요청 하나');
    const jobs = jobsOf(mes).jobs;
    assert.deepEqual(jobs.map(j => j.text), ['にほんご Hello there.', 'にほんご See you tomorrow.']);
    assert.ok(jobs.every(j => j.lang === 'ja' && !j.listenPending));
    assert.deepEqual(jobs.map(j => j.parts[0].seg.text), ['Hello there.', 'See you tomorrow.'], '강조는 화면 글로 찾음');
    assert.notDeepEqual(jobs.map(j => j.key), autoKeys, '옮긴 글은 다른 소리');
    assert.deepEqual(P._forTest.listenNeeds(0, mes), [], '다시 듣기 · 대사 클릭 = 캐시');
    const body = await bodyOf(jobs[0]);
    assert.equal(body.text, 'にほんご Hello there.');
    assert.equal(body.language_boost, 'Japanese');
    const el = await bodyOf({ ...jobs[0], voice: settings().voices[1], provider: PR.getProvider('elevenlabs'), params: {} });
    assert.equal(el.language_code, 'ja');
    // 다시 자동으로: 예전과 같은 키
    settings().listen_lang = 'auto';
    assert.deepEqual(jobsOf(mes).jobs.map(j => j.key), autoKeys);
    assert.equal(API.calls.length, 1);
});
await test('번역기가 안 옮기고 돌려준 줄: 그 글대로 읽되 엔진 언어는 글에서 (영어 글에 일본어 발음 힌트를 주지 않음) · 한자만인 일본어 답은 일본어', async () => {
    reset('ja');
    const mes = message('"Hello there." "Fine."');
    API.reply = (lines) => lines.map(x => (x === 'Hello there.' ? x : '大丈夫。'));
    await L.fill(P._forTest.listenNeeds(0, mes), 'ja');
    const jobs = jobsOf(mes).jobs;
    assert.deepEqual(jobs.map(j => [j.text, j.lang, !!j.listenPending]), [['Hello there.', 'en', false], ['大丈夫。', 'ja', false]]);
    const body = await bodyOf(jobs[0]);
    assert.equal(body.language_boost, 'English');
    assert.equal(L.spokenLang('Mr. Anderson, 안녕.', 'ko'), 'ko', '한글 답 속 영어 이름');
    assert.equal(L.spokenLang('……', 'ja'), 'ja', '글자 없음');
    assert.equal(L.spokenLang('안녕', 'ja'), '');
});
await test('화면 번역문이 이미 그 언어면 요청 없이 그것을 (읽을 글이 원문이어도 짝으로)', () => {
    reset('ja');
    const mes = message('"Hello there."', { display: '"こんにちは。"' });
    let jobs = jobsOf(mes).jobs;
    assert.deepEqual(jobs.map(j => j.text), ['こんにちは。']);
    assert.ok(jobs.every(j => !j.listenPending && j.lang === 'ja'));
    settings().text_source = 'original';
    jobs = jobsOf(mes).jobs;
    assert.deepEqual(jobs.map(j => j.text), ['こんにちは。'], '원문을 읽는 설정이어도 짝이 그 언어면');
    assert.equal(jobs[0].parts[0].alt.text, 'Hello there.', '강조 짝');
    assert.deepEqual(P._forTest.listenNeeds(0, mes), []);
    assert.equal(API.calls.length, 0);
});
await test('원문이 이미 그 언어면 그대로 · 한국어로 듣기 + 한국어 번역문 = 번역문 (요청 없음)', () => {
    reset('ja');
    let mes = message('"ありがとう。"');
    assert.deepEqual(jobsOf(mes).jobs.map(j => [j.text, j.lang, !!j.listenPending]), [['ありがとう。', 'ja', false]]);
    reset('ko');
    mes = message('"Hello there."', { display: '"안녕하세요."' });
    assert.deepEqual(jobsOf(mes).jobs.map(j => [j.text, !!j.listenPending]), [['안녕하세요.', false]]);
    assert.equal(API.calls.length, 0);
});
await test('옮길 원문은 모델이 쓴 원문 (화면 한국어 번역문을 다시 옮기지 않음)', () => {
    reset('ja');
    const mes = message('"Hello there."', { display: '"안녕하세요."' });
    assert.deepEqual(P._forTest.listenNeeds(0, mes), ['Hello there.']);
});
await test('발음 사전은 옮긴 글에 (원문 열쇠는 그대로)', async () => {
    reset('ja');
    settings().pron_dict = '[ja]=JA';
    const mes = message('"Hello there."');
    await L.fill(P._forTest.listenNeeds(0, mes), 'ja');
    assert.deepEqual(jobsOf(mes).jobs.map(j => j.text), ['JA Hello there.']);
    assert.deepEqual(API.calls[0].lines, ['Hello there.']);
});
await test('미리 만들기 1차(번역문을 기다림): 그 언어가 아닌 줄은 미룬다 (번역을 기다리는 동안 옮기지 않음) · 이미 그 언어인 줄은 바로', () => {
    reset('ja');
    let mes = message(EN);
    let r = jobsOf(mes, { awaitDisplay: true });
    assert.equal(r.jobs.length, 0);
    assert.equal(r.held, 2);
    mes = message('"ありがとう。" "Hello."');
    r = jobsOf(mes, { awaitDisplay: true });
    assert.deepEqual(r.jobs.map(j => j.text), ['ありがとう。']);
    assert.equal(r.held, 1);
});
await test('대사 분석: 듣는 언어를 고르면 원어 번역문을 묻지 않는다 (감정 · 화자만) · 자동이면 예전처럼', () => {
    reset('auto');
    const s = settings();
    s.analysis = { ...s.analysis, enabled: true, translate: true, emotion: true };
    s.voices[0].lang = 'ja';
    const mes = message('"Hello there."');
    assert.deepEqual([...P.analysisNeeds(0, mes, s).langs], ['ja']);
    s.listen_lang = 'ja';
    assert.deepEqual([...P.analysisNeeds(0, mes, s).langs], []);
    assert.equal(P.analysisNeeds(0, mes, s).emotion, true);
});
await test('스트리밍 읽기: 듣는 언어를 고르면 쉰다 (답장이 다 온 뒤 한 묶음) · 자동이면 예전처럼', () => {
    reset('auto');
    message(EN);
    assert.equal(P.streamBlocked(0), false);
    settings().listen_lang = 'en';
    assert.equal(P.streamBlocked(0), true);
});

// ---------- 5. 설정 창 · 가져오기
let UI = null;
try { UI = await mod('ui.js'); } catch (e) { UI = { __error: e }; }
await test('설정 창: 「본문과 제외할 내용」의 읽을 글 바로 아래 「듣는 언어」 (자동 · 한국어 · 日本語 · English · 中文, ? 도움말) · 번역기를 못 쓰면 한 줄 · 스트리밍 읽기 칸은 꺼짐', () => {
    if (UI.__error) throw UI.__error;
    const fields = UI._forTest.readFields('text');
    const i = fields.findIndex(f => f.key === 'text_source');
    const f = fields[i + 1];
    assert.equal(f?.key, 'listen_lang');
    assert.equal(f.label, '듣는 언어');
    assert.deepEqual(f.options.map(o => `${o.value}:${o.label}`), ['auto:자동', 'ko:한국어', 'ja:日本語', 'en:English', 'zh:中文']);
    assert.ok(typeof f.help === 'string' && f.help.length < 200, '? 도움말 (짧게)');
    reset('auto');
    assert.equal(f.desc(settings()), '', '자동이면 안내 없음');
    settings().listen_lang = 'ja';
    assert.equal(f.desc(settings()), '', '번역기를 쓸 수 있으면 안내 없음');
    T.ext.salty.addons.translator = false;
    assert.match(f.desc(settings()), /꺼져 있어요 — 원문으로 읽어요/);
    T.ext.salty.addons.translator = true;
    const stream = UI._forTest.whenFields().find(x => x.key === 'stream_read');
    assert.equal(stream.disabled(settings()), true);
    assert.match(stream.desc(settings()), /듣는 언어/);
    settings().listen_lang = 'auto';
    settings().wait_translation = 'off';
    assert.equal(!!stream.disabled(settings()), false);
});
await test('설정 가져오기: listen_lang 은 목록 안의 값만', () => {
    if (UI.__error) throw UI.__error;
    reset('auto');
    UI._forTest.importSettings({ listen_lang: 'zh' });
    assert.equal(settings().listen_lang, 'zh');
    UI._forTest.importSettings({ listen_lang: 'fr' });
    assert.equal(settings().listen_lang, 'zh', '모르는 값은 버림');
    UI._forTest.importSettings({ listen_lang: 'auto' });
    assert.equal(settings().listen_lang, 'auto');
});

console.log(`\ntts-listen: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
