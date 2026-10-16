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
    s.join_paragraph = false;   // 1.9.1 한 문단 이어 읽기는 끈다 — 이 파일은 줄마다 옮겨 읽기를 본다 (이어 읽기는 tts-join.mjs)
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
await test('inTarget: 한글 · 가나 · 한자 · 라틴을 세어 이미 그 언어인지 (6.1.8 짧은 한자만 줄도 일본어 · 글자가 없으면 그대로)', () => {
    assert.equal(L.inTarget('안녕하세요.', 'ko'), true);
    assert.equal(L.inTarget('클라인이 Kleinstein라고 했다.', 'ko'), true, '한국어 속 영어 이름');
    assert.equal(L.inTarget('Hello there.', 'ko'), false);
    assert.equal(L.inTarget('ありがとう。', 'ja'), true);
    assert.equal(L.inTarget('クラインシュタインさん、おはよう。', 'ja'), true);
    assert.equal(L.inTarget('大丈夫。', 'ja'), true, '6.1.8 짧은 한자만 → 일본어로 봄 (일본어 원문의 「羽」를 또 옮기려다 멈췄다)');
    assert.equal(L.inTarget('「羽」', 'ja'), true);
    assert.equal(L.inTarget('날개 羽', 'ja'), false, '한글이 섞이면 아님');
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
    const keep = globalThis[SYM]; delete globalThis[SYM];   // 1.6.1: 애드온 켜짐 표시가 아니라 API 가 있는지로 본다
    assert.equal(L.translatorState().ok, false);
    await assert.rejects(L.fill(['New.'], 'ja'), e => e.notReady === true);
    globalThis[SYM] = keep;
    API.ready = { ok: false, why: '번역 API 키가 없어요' };
    assert.equal(L.translatorState().why, '번역 API 키가 없어요');
    await assert.rejects(L.fill(['New.'], 'ja'), e => e.notReady === true && /키/.test(e.message));
    delete globalThis[SYM];
    assert.equal(L.translatorState().ok, false, '애드온이 API 를 안 냄 (단독 확장이 돌아 대기)');
    assert.equal(API.calls.length, 1, '준비 안 된 때는 한 번도 안 보냄');
});
await test('1.6.1 어떤 번역기든: 애드온 API → 대사 분석 엔진 → 실리태번 /translate 순으로 쓸 수 있는 첫 것', async () => {
    reset('ja');
    delete globalThis[SYM];
    assert.equal(L.translatorState().ok, false, '애드온도 엔진도 없음');
    const calls = [];
    L.setListenEngine({ ready: () => ({ ok: true }), tag: () => 'analysis:compat:m', translateLines: async (lines, target) => { calls.push([...lines]); return lines.map(x => `(${target}) ${x}`); } });
    let st = L.translatorState(); assert.equal(st.ok, true); assert.equal(st.via, 'analysis');
    assert.deepEqual(await L.fill(['Engine line.'], 'ja'), { asked: 1, failed: 0 });
    assert.equal(L.peek('Engine line.', 'ja'), '(ja) Engine line.'); assert.equal(calls.length, 1);
    assert.equal(L.modelTag(), 'analysis:compat:m', '캐시 열쇠는 고른 번역기의 지문');
    apiReset(); st = L.translatorState(); assert.equal(st.via, 'addon', '애드온이 준비돼 있으면 애드온이 먼저');
    API.ready = { ok: false, why: '단독 LLM 번역 확장이 돌고 있어 내장 번역을 쓸 수 없어요' };
    st = L.translatorState(); assert.equal(st.ok, true); assert.equal(st.via, 'analysis', '애드온이 대기 중이면 엔진으로');
    L.setListenEngine({ ready: () => ({ ok: false, why: '대사 분석이 꺼져 있어요' }), tag: () => '', translateLines: async () => [] });
    st = L.translatorState(); assert.equal(st.ok, false); assert.match(st.why, /단독 LLM 번역 확장/, '둘 다 안 되면 애드온의 이유');
    delete globalThis[SYM];
    const ran = [];
    T.ctx.SlashCommandParser = { commands: { translate: {} } };
    T.ctx.executeSlashCommandsWithOptions = async (cmd) => { ran.push(cmd); return { pipe: 'JA ' + cmd.replace(/^\/translate target=\S+ /, '') }; };
    st = L.translatorState(); assert.equal(st.ok, true); assert.equal(st.via, 'st');
    assert.deepEqual(await L.fill(['Pipe | line.'], 'ja'), { asked: 1, failed: 0 });
    assert.equal(ran.length, 1); assert.match(ran[0], /^\/translate target=ja Pipe \\\| line\.$/, '파이프 이스케이프');
    assert.equal(L.peek('Pipe | line.', 'ja'), 'JA Pipe \\| line.');
    assert.equal(L.modelTag(), 'st-translate:');
    delete T.ctx.SlashCommandParser; delete T.ctx.executeSlashCommandsWithOptions;
    st = L.translatorState(); assert.equal(st.ok, false); assert.match(st.why, /필요해요/);
    L.setListenEngine(null); apiReset();
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
    const keepApi = globalThis[SYM]; delete globalThis[SYM];
    assert.match(f.desc(settings()), /필요해요 — 원문으로 읽어요/);
    assert.ok(!/블루 레몬에이드/.test(f.desc(settings())), '테마 이름을 적지 않는다');
    globalThis[SYM] = keepApi;
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

// ---------- 6.1.8 원문이 일본어인데 「일본어로 번역 중…」에서 멈춤 (사용자: listen_lang ja · 원문 읽기 · 화면은 한국어 번역 · 대사 누르기)
const dispSegs = (mes) => TX.segmentMessage(mes.extra.display_text, { userName: 'User', charName: mes.name, knownNames: [], routes: settings().routes, final: true, skipTags: new Set(), stripRegex: [] }).filter(x => x.kind === 'dialogue' && x.text);
await test('6.1.8 Japanese original + Korean display: tapping a Korean line reads the Japanese original, no translation request', () => {
    reset('ja');
    settings().text_source = 'original';
    const mes = message('「よう、来たか」\n\n彼は笑った。\n\n「羽」', { display: '「어이, 왔냐」\n\n그는 웃었다.\n\n「날개」' });
    const jobs = P.lineJobs(0, mes, dispSegs(mes)).jobs;
    assert.deepEqual(jobs.map(j => j.text), ['よう、来たか', '羽']);
    assert.ok(jobs.every(j => !j.listenPending), 'nothing waits for a translation');
    assert.deepEqual(P._forTest.listenNeeds(0, mes, jobs), [], 'kanji-only 「羽」 is Japanese too');
    assert.equal(API.calls.length, 0);
});
await test('6.1.8 a Korean line whose original cannot be matched takes the original at the same place, else is read as it is — never translated again', () => {
    reset('ja');
    settings().text_source = 'original';
    // 번역문 줄이 하나 더 많다 (번역기가 한 줄을 둘로) — 짝을 못 찾는 줄이 생긴다
    const mes = message('「よう、来たか。観光か？」', { display: '「어이, 왔냐.」\n\n「관광이야?」' });
    const segs = dispSegs(mes);
    const first = P.lineJobs(0, mes, [segs[0]]).jobs;
    assert.equal(first[0].text, 'よう、来たか。観光か？', 'same place in the original');
    const second = P.lineJobs(0, mes, [segs[1]]).jobs;
    assert.ok(second.length === 1 && !second[0].listenPending, 'no original at that place → read as it is, not sent to the translator');
    assert.equal(API.calls.length, 0);
});
await test('6.1.8 a translator that never answers: after the time limit the line reads the original and is not asked again right away', async () => {
    reset('ja');
    API.delay = 60000;
    P._forTest.setListenTimeout(150);
    try {
        const t0 = Date.now();
        const ok = await P._forTest.listenFill(['Hello there.'], { quiet: true });
        assert.equal(ok, false);
        assert.ok(Date.now() - t0 < 2000, 'gave up at the limit');
        assert.equal(API.signals[0]?.aborted, false, 'the request already sent (and paid) is not cut — only the waiting stops');
        assert.equal(L.failedRecently('Hello there.', 'ja'), true, 'not resent on the next tap (reads the original)');
        const mes = message('"Hello there."');
        assert.deepEqual(P._forTest.listenNeeds(0, mes), [], 'the line is read as the original now');
    } finally { P._forTest.setListenTimeout(20000); API.delay = 0; }
});

await test('6.1.8 a slow translator: the late answer is kept and the next tap reads it; long kanji-only lines are still translated', async () => {
    reset('ja');
    API.delay = 300;
    P._forTest.setListenTimeout(80);
    try {
        assert.equal(await P._forTest.listenFill(['See you tomorrow.'], { quiet: true }), false, 'gave up waiting');
        await sleep(450);
        assert.equal(L.peek('See you tomorrow.', 'ja'), '[ja] See you tomorrow.', 'the late answer went into the cache');
        const mes = message('"See you tomorrow."');
        assert.deepEqual(jobsOf(mes).jobs.map(j => j.text), ['[ja] See you tomorrow.']);
        assert.equal(API.calls.length, 1, 'one request in all');
    } finally { P._forTest.setListenTimeout(20000); API.delay = 0; }
    assert.equal(L.inTarget('我们今天一起去公园散步吧好吗', 'ja'), false, 'a long kanji-only line may be Chinese → translated');
    assert.equal(L.inTarget('天使', 'ja'), true);
});

// ---------- 1.9.1 이미 그 언어인 줄은 번역을 기다리지 않음 · 막대 글은 옮길 때만 몇 줄인지 · 서술 속 낱말 인용은 읽지 않음
//   (사용자: 원문 대사가 이미 일본어인데 막대에 「일본어로 번역 중…」 — 서술 속 영어 인용 몇 줄을 옮기느라 메시지 전체가 멈췄다)
await test('1.9.1 막대 글: 옮길 줄이 없으면 「번역 중」이 아님 · 있으면 「영어 2줄 일본어로 번역 중…」 (언어가 섞이면 「2줄 …」)', async () => {
    reset('ja');
    const T9 = P._forTest;
    assert.equal(T9.listenText(['Good night.', 'See you.']), '영어 2줄 일본어로 번역 중…');
    assert.equal(T9.listenText(['Good night.', '잘 자.']), '2줄 일본어로 번역 중…');
    assert.equal(T9.listenText([]), '일본어로 번역 중…');
    assert.ok(!/번역/.test(T9.PREP_TEXT), '첫 막대 글');
    const src = (await import('node:fs')).readFileSync(path.join(root, 'player.js'), 'utf8');
    const prep = src.slice(src.indexOf('async function prepareThen'), src.indexOf('// ---------- 소리용 대본'));
    assert.match(prep, /beginWaiting\(mesId, mes, PREP_TEXT, 'listen'\)/, '듣는 언어만 남은 준비는 중립 글로 시작');
    assert.ok(prep.indexOf('w.text = listenText(need)') > prep.indexOf('if (need.length)'), '번역 문구는 옮길 줄이 있을 때만');
    const mes = message('「おはよう。」\n\n彼は笑った。\n\n「またね。」');
    assert.deepEqual(T9.listenNeeds(0, mes), [], '이미 일본어인 메시지 = 옮길 줄 없음 (기다림 · 막대 없이 바로 읽음)');
});
await test('1.9.1 일본어 줄은 기다리지 않음: 옮길 첫 줄 앞까지 먼저 읽고, 옮긴 뒤 그 줄부터 이어서 (요청은 메시지 한 묶음 · 이어 읽은 소리는 다 옮긴 뒤 읽을 때와 같은 열쇠)', async () => {
    reset('ja');
    settings().text_source = 'original';
    const mes = message('「おはよう。」\n\n彼は笑った。\n\n「今日は晴れだね。」\n\n"See you tomorrow."\n\n「またね。」');
    const before = P._forTest.autoJobs(0);
    assert.deepEqual(before.map(j => [j.text, !!j.listenPending]), [['おはよう。', false], ['今日は晴れだね。', false], ['See you tomorrow.', true], ['またね。', false]]);
    const cut = P._forTest.listenHead(before);
    assert.deepEqual(cut.jobs.map(j => j.text), ['おはよう。', '今日は晴れだね。'], '이미 일본어인 앞줄은 바로');
    assert.equal(cut.rest, before[2].segIndex, '옮길 줄부터 이어 읽음');
    const need = P._forTest.listenNeeds(0, mes);
    assert.deepEqual(need, ['See you tomorrow.']);
    await L.fill(need, 'ja');
    assert.equal(API.calls.length, 1, '요청은 한 묶음');
    const rest = P._forTest.autoJobs(0, cut.rest);
    assert.deepEqual(rest.map(j => j.text), ['[ja] See you tomorrow.', 'またね。']);
    const whole = P._forTest.autoJobs(0);
    assert.deepEqual([...cut.jobs, ...rest].map(j => j.key), whole.map(j => j.key), '나눠 읽어도 다 옮긴 뒤 한 번에 읽을 때와 같은 소리 열쇠');
    assert.equal(P._forTest.listenHead(P._forTest.autoJobs(0)), null, '다 옮겼으면 나누지 않음');
    message('"Good morning."\n\n「またね。」');
    assert.equal(P._forTest.listenHead(P._forTest.autoJobs(0)), null, '첫 줄부터 옮길 줄이면 예전처럼 다 옮긴 뒤');
});
await test('1.9.1 서술 속 낱말 인용(영어 낱말 뒤에 한글 · 일본어 조사)은 읽을 줄 · 옮길 줄이 아님 — 같은 문자의 짧은 대사 · 완전한 문장은 그대로', () => {
    reset('ja');
    settings().text_source = 'original';
    settings().join_paragraph = true;
    const mes = message('彼は*"Starlight-kun"*と呼んだ。「おはよう。」\n\n그는 "Old-friend"라는 말을 떠올렸다. *"Tell me the truth."*\n\n"가자"라고 그가 말했다.');
    const segs = TX.segmentMessage(mes.mes, { paragraphs: true }).filter(g => g.kind === 'dialogue');
    assert.deepEqual(segs.map(g => [g.text, !!g.term]), [['Starlight-kun', true], ['おはよう。', false], ['Old-friend', true], ['Tell me the truth.', false], ['가자', false]]);
    assert.deepEqual(P._forTest.listenNeeds(0, mes).sort(), ['Tell me the truth.', '가자'].sort(), '낱말 인용은 옮기지도 않음');
    assert.ok(!P._forTest.autoJobs(0).some(j => /Starlight|Old-friend/.test(j.text)));
    const C = segs.find(g => g.text === 'Old-friend');
    assert.ok(P.lineJobs(0, mes, [{ ...C, dialogueIndex: 2 }]).jobs.length === 1, '직접 누르면 읽음');
    settings().join_paragraph = false;
    assert.ok(TX.segmentMessage(mes.mes, {}).every(g => !g.term), '끄면 1.9.0 그대로 (표시 없음)');
});

// ---------- 6.3.8 누른 화면 글의 줄임표 (실리태번 마크다운이 '...' 를 '…' 로 그림)
await test('6.3.8 탭: 화면에 「…」로 그려진 줄도 저장된 화면 글(「...」)과 원문을 찾아 원문으로 읽음 — 원문이 이미 듣는 언어면 옮기지 않음', async () => {
    reset('ja');
    settings().text_source = 'original';
    const mes = message('「おはよう。」 「えっ、いいの？じゃあ……少しだけ。」', { display: '「좋은 아침.」 「어, 괜찮아? 그럼... 조금만.」' });
    const C = await mod('clickplay.js');
    const shown = '어, 괜찮아? 그럼… 조금만.';                          // 화면(DOM)에 그려진 글
    const seg = C.segmentForHit(mes, { kind: 'dialogue', text: shown, raw: shown, quoted: shown, line: 0 });
    assert.equal(seg.dialogueIndex, 1, '누른 줄 = 화면 글의 둘째 대사');
    assert.deepEqual(P.lineJobs(0, mes, [seg]).jobs.map(j => j.text), ['えっ、いいの？じゃあ……少しだけ。']);
    const raw = { kind: 'dialogue', text: shown, raw: shown, color: null, tags: [], speakerHint: null, line: 0 };   // 즉석 조각이어도 재생기가 짝을 찾음
    const job = P.lineJobs(0, mes, [raw]).jobs[0];
    assert.equal(job.text, 'えっ、いいの？じゃあ……少しだけ。');
    assert.equal(job.parts[0].original?.fromDisplay, undefined, '원문 짝이 있으면 표시 없음');
    assert.equal(API.calls.length, 0, '번역 요청 없음');
});
await test('6.3.8 원문 짝이 정말 없는 줄(화면 글에만 있음): 조각에 fromDisplay — 막대 칸 제목은 (1.9.1) 「원문을 못 찾았어요 — 화면 글(번역문)」, 짝이 있으면 「지금 읽는 대사의 원문」', async () => {
    reset('ja');
    settings().text_source = 'original';
    const D = await mod('playback-details.js');
    const mes = message('"Good morning."', { display: '"좋은 아침이에요."  "응."' });   // 화면에만 있는 짧은 한 줄 (번역기가 덧붙임)
    const only = { kind: 'dialogue', text: '응.', raw: '응.', color: null, tags: [], speakerHint: null, line: 0 };
    const job = P.lineJobs(0, mes, [only]).jobs[0];
    assert.equal((job.parts[0].original || job.parts[0].seg).fromDisplay, true);
    assert.equal(D.playbackOriginalTitle(job), job.listen ? D.ORIGINAL_MISSING_LISTEN : D.ORIGINAL_MISSING);   // 1.9.2 듣는 언어로 옮겨 읽으면 그 사정까지
    assert.equal(D.ORIGINAL_MISSING, '원문을 못 찾았어요 — 화면 글(번역문)');
    const paired = { kind: 'dialogue', text: '좋은 아침이에요.', raw: '좋은 아침이에요.', color: null, tags: [], speakerHint: null, line: 0 };
    const job2 = P.lineJobs(0, mes, [paired]).jobs[0];
    assert.equal(D.playbackOriginalTitle(job2), '지금 읽는 대사의 원문');
    assert.equal((job2.parts[0].original || job2.parts[0].seg).text, 'Good morning.');
    assert.equal(D.playbackOriginalTitle(null), '지금 읽는 대사의 원문');
});

// ---------- 6.4.2 막대 「원문」 칩: 읽는 글이 그 줄의 원문과 같은 말이면 숨김 (따옴표 · 줄임표 · 문장부호 · 태그 · 순한 글만 다름)
await test('6.4.2 원문 칩: 같은 말(따옴표 · 줄임표 · 문장부호 · 태그 · 발음 점 · 말끝 っ · 장음 겹침만 다름)이면 숨김, 옮긴 글 · 화면 글이면 보임', async () => {
    const D = await mod('playback-details.js');
    const job = (original, text, extra = {}) => ({ text, parts: [{ seg: { kind: 'dialogue', text: original, ...extra }, original: { kind: 'dialogue', text: original, ...extra }, text }] });
    for (const [original, spoken] of [
        ['「ははは、これは名誉の負傷だよ…」', 'ははは、これは名誉の負傷だよ…'],
        ['ははは、これは名誉の負傷だよ...', 'ははは、これは名誉の負傷だよ……'],
        ['行こう！', '[happy] 行こう。'],
        ['えっ、本当？', 'え、本当？'],
        ['すごーーい！', 'すごーい。'],
        ['S.T.A.R 本部に行く。', 'STAR 本部に行く。'],
        ['"Good morning," she said.', 'Good morning, she said'],
    ]) assert.equal(D.playbackOriginal(job(original, spoken)), '', `${original} ↔ ${spoken}`);
    assert.equal(D.playbackOriginal(job('좋은 아침.', 'おはよう。')), '좋은 아침.', '듣는 언어로 옮긴 글이면 원문 칩');
    assert.equal(D.playbackOriginal(job('좋은 아침.', 'おはよう。', { fromDisplay: true })), '좋은 아침.', '화면 글을 옮겨 읽음');
    assert.equal(D.playbackOriginalTitle(job('좋은 아침.', 'おはよう。', { fromDisplay: true })), D.ORIGINAL_MISSING);
    assert.equal(D.playbackOriginal(job('今日はいい天気だ。', '今日は悪い天気だ。')), '今日はいい天気だ。', '글이 다르면 칩');
    assert.equal(D.playbackOriginal({ sceneKind: 'sfx', parts: [] }), '');
});

// ---------- 1.9.1 막대 「원문」 칸에 원문(일본어) 대신 번역문(한국어)이 「지금 읽는 대사의 원문」으로 떴다 (원문 짝을 못 찾아 번역문을 다시 옮겨 읽음)
await test('1.9.1 누른 화면 글이 저장된 글과 문장부호 · 물결표만 달라도 그 줄의 원문 짝을 찾아 원문(일본어)을 읽음 — 번역문을 다시 옮기지 않고, 원문 칸도 원문', async () => {
    reset('ja');
    settings().text_source = 'original';
    const D = await mod('playback-details.js');
    const C = await mod('clickplay.js');
    const mes = message('<span style="color:#ff6b9d">「ねえ、見て〜。今日は晴れだね……って、ふふ」</span> She laughed.\n\n<span style="color:#5fa8ff">「本当だ。」</span>',
        { display: '<span style="color:#ff6b9d">「저기, 봐~. 오늘 맑네…… 라니, 후훗」</span> 그녀가 웃었다.\n\n<span style="color:#5fa8ff">「정말이네.」</span>' });
    const dom = '저기, 봐〜 오늘 맑네… 라니, 후훗!';   // 화면에 그려진 글이 저장된 글과 물결표 · 문장부호만 다름
    const seg = C.segmentForHit(mes, { kind: 'dialogue', text: dom, raw: dom, quoted: dom, color: '#ff6b9d', line: 0 });
    assert.equal(seg.text, '저기, 봐~. 오늘 맑네…… 라니, 후훗', '저장된 화면 글의 그 줄');
    const job = P.lineJobs(0, mes, [seg]).jobs[0];
    assert.equal(job.text, 'ねえ、見て〜。今日は晴れだね……って、ふふ', '원문 그대로 (번역문을 일본어로 다시 옮기지 않음)');
    assert.ok(!(job.parts[0].original || job.parts[0].seg).fromDisplay);
    assert.equal(D.playbackOriginalTitle(job), '지금 읽는 대사의 원문');
    assert.equal(API.calls.length, 0, '번역 요청 없음');
    const raw = { kind: 'dialogue', text: dom, raw: dom, color: null, tags: [], speakerHint: null, line: 0 };   // 즉석 조각(다른 길)이어도 재생기가 느슨하게 짝을 찾음
    assert.equal(P.lineJobs(0, mes, [raw]).jobs[0].text, 'ねえ、見て〜。今日は晴れだね……って、ふふ');
});
await test('1.9.1 번역문을 기준으로 읽는데 원문 짝이 없는 줄: 원문 칸 제목이 「원문을 못 찾았어요」 (자동 읽기 길도) · 짝이 있는 줄은 원문', async () => {
    reset('auto');
    settings().text_source = 'display';
    const D = await mod('playback-details.js');
    const mes = message('<span style="color:#ff6b9d">「おはよう。」</span>\n\n<span style="color:#5fa8ff">「またね。」</span>',
        { display: '<span style="color:#ff6b9d">「좋은 아침.」</span>\n\n"응."\n\n<span style="color:#5fa8ff">「또 봐.」</span>' });
    const jobs = P._forTest.autoJobs(0);
    assert.deepEqual(jobs.map(j => j.text), ['좋은 아침.', '응.', '또 봐.']);
    assert.deepEqual(jobs.map(j => D.playbackOriginalTitle(j)), ['지금 읽는 대사의 원문', D.ORIGINAL_MISSING, '지금 읽는 대사의 원문']);
    assert.deepEqual(jobs.map(j => D.playbackOriginal(j)), ['おはよう。', '', 'またね。'], '짝이 있으면 모델이 쓴 원문 · 없으면 읽는 글과 같아 칩 없음 (보이면 제목이 사실대로)');
});

// ---------- 1.9.2 원문 짝: 대사 수 · 차례가 어긋나도 같은 색 · 같은 번째로 (못 찾으면 번역문을 듣는 언어로 다시 옮겨 읽었다 — 일 → 한 → 일)
const A1 = '#aa88ee', B1 = '#55bb77';
const span = (c, t) => `<span style="color:${c}">${t}</span>`;
await test('1.9.2 번역기가 줄 차례를 바꿔도(차례 맞춤이 한쪽만 짝지음) 같은 색 · 같은 번째 원문을 읽음 — 번역 요청 없음 · 원문 칸은 원문', async () => {
    reset('ja');
    settings().text_source = 'original';
    const D = await mod('playback-details.js');
    const C = await mod('clickplay.js');
    const mes = message(`${span(A1, '「立ち話もなんですから、まずは座ってください。」')} She gestured to the chair.\n\n${span(B1, '「ありがとうございます。」')}`,
        { display: `${span(B1, '「고맙습니다.」')}\n\n${span(A1, '「서서 할 이야기는 아니니, 우선 앉으세요.」')} 그녀가 의자를 가리켰다.` });
    for (const [shown, color, want] of [['고맙습니다.', B1, 'ありがとうございます。'], ['서서 할 이야기는 아니니, 우선 앉으세요.', A1, '立ち話もなんですから、まずは座ってください。']]) {
        const seg = C.segmentForHit(mes, { kind: 'dialogue', text: shown, raw: shown, quoted: shown, color, line: 0 });
        const job = P.lineJobs(0, mes, [seg]).jobs[0];
        assert.equal(job.text, want, shown);
        assert.equal(D.playbackOriginalTitle(job), '지금 읽는 대사의 원문');
    }
    assert.equal(API.calls.length, 0, '번역문을 다시 옮기지 않음');
    settings().text_source = 'display';   // 읽을 글이 번역문이어도 (자동 읽기 길) 듣는 언어 줄은 원문 짝으로
    assert.deepEqual(P._forTest.autoJobs(0).map(j => j.text), ['ありがとうございます。', '立ち話もなんですから、まずは座ってください。']);
    assert.equal(API.calls.length, 0);
});
await test('1.9.2 원문에만 숨김 칸 · 기울임 영어 인용이 있어 대사 수가 어긋나도 같은 색 대사는 원문 짝 — 못 찾은 줄만 옮겨 읽고, 원문 칸은 「원문을 못 찾았어요 — 화면 글을 옮겨 읽는 중」 + 실제로 읽는 글', async () => {
    reset('ja');
    settings().text_source = 'original';
    const D = await mod('playback-details.js');
    const C = await mod('clickplay.js');
    const mes = message([
        `She studied them. *"Are you two related?"* she wondered.`,
        `<true_thoughts character="Mina">"Wait, what is going on?"</true_thoughts>`,
        `${span(A1, '「……ここで続ける話ではありませんね。」')} He pulled out a chair.`,
        `${span(B1, '「はい、そうします。」')}`,
        `${span(A1, '「では、始めましょう。」')}`,
    ].join('\n\n'), { display: [
        '그녀는 둘을 살폈다. 둘이 친척인가, 하고 그녀는 생각했다.',
        `${span(A1, '「……여기서 이어 갈 이야기는 아니군요.」')} 그가 의자를 빼냈다.`,
        `${span(B1, '「네, 그럴게요.」')}`,
        '"음."',
        `${span(A1, '「그럼, 시작하죠.」')}`,
    ].join('\n\n') });
    const tap = (shown, color) => P.lineJobs(0, mes, [C.segmentForHit(mes, { kind: 'dialogue', text: shown, raw: shown, quoted: shown, color, line: 0 })]).jobs[0];
    assert.equal(tap('……여기서 이어 갈 이야기는 아니군요.', A1).text, '……ここで続ける話ではありませんね。');
    assert.equal(tap('네, 그럴게요.', B1).text, 'はい、そうします。');
    assert.equal(tap('그럼, 시작하죠.', A1).text, 'では、始めましょう。');
    assert.equal(API.calls.length, 0, '원문 짝이 있는 줄은 옮기지 않음');
    const lone = tap('음.', null);   // 화면에만 있는 줄: 원문 대사가 이미 일본어인 메시지라 옮기지 않고 그대로 (6.1.8) · 칸 제목은 사실대로
    assert.ok(!lone.listenPending && lone.text === '음.' && (lone.parts[0].original || lone.parts[0].seg).fromDisplay);
    assert.equal(D.playbackOriginalTitle(lone), D.ORIGINAL_MISSING);
    assert.equal(API.calls.length, 0);
    // 원문이 다른 언어(영어)인 메시지: 원문 짝이 있는 줄은 원문을 옮기고, 화면에만 있는 줄만 번역문을 옮겨 읽음 — 원문 칸 = 실제로 읽는 글 + 사정
    const en = message(`${span(A1, '"We should not discuss this standing up."')}\n\n${span(B1, '"Alright."')}`,
        { display: `${span(A1, '"서서 할 이야기는 아니군요."')}\n\n"음."\n\n${span(B1, '"알겠어요."')}` });
    const tapEn = (shown, color) => P.lineJobs(0, en, [C.segmentForHit(en, { kind: 'dialogue', text: shown, raw: shown, quoted: shown, color, line: 0 })]).jobs[0];
    API.reply = (lines) => lines.map(x => `にほんご ${x}`);   // 일본어 글자가 있는 답 (「[ja]」 머리는 오디오 태그로 걸러져 원문 칸 비교가 안 됨)
    const jobs = [tapEn('서서 할 이야기는 아니군요.', A1), tapEn('음.', null), tapEn('알겠어요.', B1)];
    await L.fill(P._forTest.listenNeeds(0, en, jobs), 'ja');
    assert.deepEqual(API.calls.map(c => c.lines.slice().sort()), [['Alright.', 'We should not discuss this standing up.', '음.'].sort()], '한 묶음 — 원문 짝이 있으면 원문을, 없는 줄만 번역문을');
    const read = tapEn('음.', null);
    assert.equal(read.text, 'にほんご 음.');
    assert.equal(D.playbackOriginalTitle(read), D.ORIGINAL_MISSING_LISTEN);
    assert.equal(D.ORIGINAL_MISSING_LISTEN, '원문을 못 찾았어요 — 화면 글을 옮겨 읽는 중');
    assert.equal(D.playbackOriginal(read), 'にほんご 음.', '칸 = 실제로 읽는 글 (번역문을 「원문」처럼 두지 않음)');
    const paired = tapEn('서서 할 이야기는 아니군요.', A1);
    assert.equal(paired.text, 'にほんご We should not discuss this standing up.', '원문을 옮김 (번역문을 다시 옮기지 않음)');
    assert.equal(D.playbackOriginalTitle(paired), '지금 읽는 대사의 원문');
    assert.equal(D.playbackOriginal(paired), 'We should not discuss this standing up.');
});

console.log(`\ntts-listen: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
