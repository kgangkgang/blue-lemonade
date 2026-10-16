// TTS 「다음 한 줄」 미리 만들기 (테마 6.2.5 — src/addons/tts/src/pregen.js pregenNext · settings.js · ui.js · player.js)
//   node tools/tests/tts-pregen-next.mjs <테마 루트>
// 대사를 누르면 그 답장의 바로 다음 대사 한 줄만 미리 만든다. 답장이 올 때는 아무것도 안 만든다. 기본값은 그대로(새 설치 끔).
// 실리태번 모듈은 data: 스텁, pregen.js 가 부르는 재생기 · 분석 · 번역 · 캐시 · 클릭은 부른 것을 기록만 하는 스텁 (소리 · 네트워크 없음).
// 타이머를 기다리는 곳은 상태를 폴링한다 (CI 에서 고정 대기는 흔들림).
// 6.2.8 「다음 한 줄 · 이어 듣기」(chain): 누른 줄의 큐가 끝나면(onEnded) 다음 줄을 누른 것처럼 넣는다 — 4b) 절. 기존 네 모드의 동작은 그대로.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const mod = (name) => pathToFileURL(path.join(root, name)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;

// ---------- 공유 상태 (스텁이 globalThis 로 읽음)
const T = globalThis.__ttsNextTest = {
    chat: [], ext: {}, ctx: null, handlers: {},
    clips: [], gate: null, fail: null, wantAnalysis: false, displayReady: true, expect: false, segs: [], segOpts: [], tapFns: [], cooled: [], endFns: [], spoken: [],
    voiceFor: () => null,
    jobFor(seg) { const v = T.voiceFor(seg); return v ? { key: `k:${seg.text}`, text: seg.text, voice: v, provider: T.provider(v.provider), ...(seg.listenPending ? { listenPending: true } : {}) } : null; },
    lineJobs(id, mes, segs) { return { jobs: segs.map(seg => T.jobFor(seg)).filter(Boolean), held: 0, missing: false }; },
    async ensureClip(job, o) {
        const rec = { key: job.key, signal: o?.signal, prepare: o?.prepare };
        T.clips.push(rec);
        if (T.fail) { const e = T.fail; T.fail = null; throw e; }
        if (T.gate) await T.gate;
        if (o?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        return { made: true };
    },
};
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };

const G = 'const T = globalThis.__ttsNextTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.chat;
export const event_types = { CHAT_CHANGED: 'chat_changed', MESSAGE_SWIPED: 'message_swiped', MESSAGE_DELETED: 'message_deleted', GENERATION_STARTED: 'generation_started', MESSAGE_EDITED: 'message_edited', MESSAGE_UPDATED: 'message_updated' };
export const eventSource = { on(n, fn) { (T.handlers[n] ||= []).push(fn); }, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}`),
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
const PREGEN = {
    './player.js': js(G + `export const PREP_LINES = 2;
export const lineJobs = (...a) => T.lineJobs(...a);
export const ensureClip = (job, o) => T.ensureClip(job, o);
export const analysisWanted = () => T.wantAnalysis;
export const analysisNeeds = () => ({ langs: [] });
export const isInflight = () => false;
export const wasStreamRead = () => false;
export const coolDown = (id) => { T.cooled.push(id); };
export const listenOn = () => false;
export const onTapped = (fn) => { T.tapFns.push(fn); return () => {}; };
export const onEnded = (fn) => { T.endFns.push(fn); return () => {}; };
export const speakSegments = (id, segs) => { T.spoken.push({ id, segs }); for (const fn of T.tapFns) fn(id, segs); return true; };`),
    './analysis.js': js(G + 'export async function analyzeMessage() { return { segs: [] }; }'),
    './translation.js': js(G + `export const displayReady = () => T.displayReady;
export const translationExpected = () => T.expect;
export async function watchDisplay() { return 'none'; }`),
    './cache.js': js('export async function has() { return false; }\nexport function setProtected() {}'),
    './clickplay.js': js(G + 'export const tapSegments = (mes, o) => { T.segOpts.push(o); return T.segs.slice(); };'),
};
register(js(`let S = {}, P = {};
export async function initialize(d) { S = d.st; P = d.pregen; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    if (parent.includes('/addons/tts/')) {
        const base = spec.split('/').pop();
        if ((spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
        if (/\\/src\\/pregen\\.js$/.test(parent) && P[spec]) return { url: P[spec], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { st: ST, pregen: PREGEN } });

// ---------- 시험 틀
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function until(fn, label, ms = 3000) {
    const t0 = Date.now();
    while (!fn()) { if (Date.now() - t0 > ms) throw new Error(`기다림 초과: ${label}`); await sleep(5); }
}

const V = {
    mm: { uid: 'minimax:ade', provider: 'minimax', voiceId: 'ade', name: '에이드' },
    cp: { uid: 'openai_compat:night', provider: 'openai_compat', voiceId: 'night', name: '나이트' },
};
const OFFICIAL = { key: 'test-key', host: 'https://api.minimax.io' };
const GATEWAY = { key: 'test-key', host: 'custom', host_custom: 'http://198.51.100.7:8880' };
T.ext.lemon_voice = { version: 8, enabled: true, pregen: 'next', click_play: true, auto_play: false, voices: [V.cp], providers: {} };

const S = await import(mod('settings.js'));
const P = await import(mod('providers/index.js'));
const L = await import(mod('log.js'));
const pregen = await import(mod('pregen.js'));
const ui = await import(mod('ui.js'));
T.provider = (id) => P.getProvider(id);
const s = S.settings();
const logged = [];
L.onLog((e) => logged.push(e.msg));

const D = (text, i, line) => ({ kind: 'dialogue', text, dialogueIndex: i, line });
const LINES = [D('「하나」', 0, 1), D('「둘」', 1, 3), D('「셋」', 2, 5)];
let n = 0;
/** 내 메시지 + 생성한 답장 (마지막) → 답장 번호 */
function reply() {
    T.chat.length = 0;
    T.chat.push({ name: 'User', is_user: true, mes: 'hi' });
    T.chat.push({ name: 'Ade', is_user: false, mes: `「하나」 「둘」 「셋」 ${++n}`, extra: { api: 'custom', model: 'm' } });
    return 1;
}
function setup({ mode = 'next', voices = [V.cp], providers = {}, pregenPaid = false, segs = LINES, voiceFor = () => V.cp } = {}) {
    Object.assign(s, { pregen: mode, enabled: true, click_play: true, auto_play: false, voices, providers, pregen_paid: pregenPaid });
    T.segs = segs; T.voiceFor = voiceFor; T.clips.length = 0; T.gate = null; T.fail = null; T.wantAnalysis = false; T.displayReady = true; T.expect = false; T.cooled.length = 0; T.spoken.length = 0;
    s.routes = { ...(s.routes || {}), thought: 'skip' };
    pregen.pregenCancel();
}
const keys = () => T.clips.map(c => c.key);

console.log('TTS 「다음 한 줄」 미리 만들기');

// ---------- 1) 설정
await test('settings: 고르는 값에 next (끔 다음) · 기존 기본값 그대로 (옛 설정 대사 · 새 설치 끔) · 저장된 next 는 그대로', () => {
    assert.deepEqual([...S.PREGEN_MODES], ['off', 'next', 'chain', 'dialogue', 'all']);
    assert.equal(S.DEFAULTS.pregen, 'dialogue', '옛 설정의 빈 값을 채우는 기본값은 그대로');
    const keep = T.ext.lemon_voice;
    try {
        delete T.ext.lemon_voice;
        assert.equal(S.settings().pregen, 'off', '새 설치는 끔');
        T.ext.lemon_voice = { version: 8, voices: [], pregen: 'next' };
        assert.equal(S.settings().pregen, 'next');
    } finally { T.ext.lemon_voice = keep; S.settings(); }
});
await test('설정 가져오기: next 를 받는다 (고르는 값 목록 안)', () => {
    const { importSettings } = ui._forTest || {};
    assert.equal(typeof importSettings, 'function');
    try {
        importSettings({ pregen: 'next' });
        assert.equal(s.pregen, 'next');
        importSettings({ pregen: 'chain' });
        assert.equal(s.pregen, 'chain', '6.2.8 이어 듣기도 받는다');
        importSettings({ pregen: 'next' });
        importSettings({ pregen: 'everything' });
        assert.equal(s.pregen, 'next', '모르는 값은 버림');
    } finally { s.pregen = 'next'; }
});

// ---------- 2) 누른 다음 줄만
await test('답장이 와도 아무것도 안 만든다 (next 는 답장 미리 만들기에서 끔)', async () => {
    setup();
    const r = pregen.pregenMessage(reply(), { type: 'normal' });
    assert.equal(r, null);
    await sleep(0);
    assert.deepEqual(keys(), []);
});
await test('첫 줄을 누르면 둘째 줄 하나만 — 미리 만들기 줄(ensureClip · signal · 음량 고르기)로, 기록에 키', async () => {
    setup();
    const id = reply();
    const job = await pregen.pregenNext(id, [LINES[0]]);
    assert.deepEqual(keys(), ['k:「둘」']);
    assert.ok(T.clips[0].signal instanceof AbortSignal, '그만둘 수 있게 signal');
    assert.equal(T.clips[0].prepare, true);
    assert.equal(job.state, 'done');
    assert.deepEqual(job.keys, ['k:「둘」']);
    assert.equal(job.made, 1);
    assert.deepEqual(T.segOpts.at(-1), { thoughts: false }, '대사만 (속마음은 다음 줄로 치지 않음)');
    assert.deepEqual(pregen.state().next?.keys, ['k:「둘」']);
});
await test('마지막 줄 · 목록에 없는 줄을 누르면 아무것도 안 만든다', async () => {
    setup();
    const id = reply();
    assert.equal(pregen.pregenNext(id, [LINES[2]]), null);
    assert.equal(pregen.pregenNext(id, [D('「없음」', 7, 9)]), null);
    assert.deepEqual(keys(), []);
});
await test('끔 · 대사 · 대사+속마음 모드, 대사 클릭 꺼짐, TTS 꺼짐, 시스템 메시지 → pregenNext 는 아무것도 안 함', async () => {
    for (const mode of ['off', 'dialogue', 'all']) {
        setup({ mode });
        assert.equal(pregen.pregenNext(reply(), [LINES[0]]), null, mode);
    }
    setup(); s.click_play = false;
    assert.equal(pregen.pregenNext(reply(), [LINES[0]]), null, 'click_play off');
    setup(); s.enabled = false;
    assert.equal(pregen.pregenNext(reply(), [LINES[0]]), null, 'enabled off');
    setup(); const id = reply(); T.chat[id].is_system = true;
    assert.equal(pregen.pregenNext(id, [LINES[0]]), null, 'system');
    assert.equal(pregen.pregenNext(-3, [LINES[0]]), null, '다른 확장의 글 (음수 번호)');
    assert.deepEqual(keys(), []);
});
await test('같은 대사가 둘이면 누른 번호(dialogueIndex)로 자리를 찾는다 · 속마음을 누르면 그 줄 뒤의 첫 대사', () => {
    const list = [D('「네」', 0, 1), D('「왜」', 1, 3), D('「네」', 2, 5), D('「끝」', 3, 7)];
    assert.equal(pregen.nextLine(list, D('「네」', 2, 5)).text, '「끝」');
    assert.equal(pregen.nextLine(list, D('「네」', 0, 1)).text, '「왜」');
    assert.equal(pregen.nextLine(list, { kind: 'dialogue', text: '「네」', dialogueIndex: -1, line: 6 }).text, '「끝」', '번호가 없으면 가까운 줄');
    assert.equal(pregen.nextLine(list, { kind: 'thought', text: '생각', line: 4 }).text, '「네」');
    assert.equal(pregen.nextLine(list, { kind: 'thought', text: '생각', line: 9 }), null);
    // 줄 번호는 0부터: 첫 줄의 속마음(데우스식 <true_thoughts> 머리말) → 그 뒤 첫 대사, 같은 줄에 이어지는 대사도 다음 한 줄
    assert.equal(pregen.nextLine([D('「하나」', 0, 1), D('「둘」', 1, 2)], { kind: 'thought', text: '생각', line: 0 }).text, '「하나」', 'first-line thought');
    assert.equal(pregen.nextLine([D('「하나」', 0, 0), D('「둘」', 1, 1)], { kind: 'thought', text: '생각', line: 0 }).text, '「하나」', 'thought and dialogue on line 0');
    assert.equal(pregen.nextLine([D('「하나」', 0, 1), D('「둘」', 1, 1), D('「셋」', 2, 3)], { kind: 'thought', text: '생각', line: 1 }).text, '「하나」', 'shared line: the dialogue on that line, not the one after');
    assert.equal(pregen.nextLine(list, { kind: 'thought', text: '생각' }), null, '줄을 모르면 null');
    assert.equal(pregen.nextLine([], D('「네」', 0, 1)), null);
});

// ---------- 3) 유료 엔진 · 분석 · 번역 · 듣는 언어
await test('유료 엔진 규칙 그대로: 목소리가 모두 MiniMax 공식이고 「유료 엔진도 미리 만들기」 끔 → 안 만듦 (까닭 기록 한 줄) · 켬 → 만듦 · 게이트웨이 → 만듦', async () => {
    setup({ voices: [V.mm], providers: { minimax: { ...OFFICIAL } }, voiceFor: () => V.mm });
    logged.length = 0;
    const id = reply();
    assert.equal(pregen.pregenNext(id, [LINES[0]]), null);
    assert.equal(pregen.pregenNext(id, [LINES[0]]), null);
    assert.deepEqual(keys(), []);
    assert.equal(logged.filter(m => m.includes(`#${id}`) && /유료 엔진/.test(m)).length, 1, logged.join(' | '));
    setup({ voices: [V.mm], providers: { minimax: { ...OFFICIAL } }, pregenPaid: true, voiceFor: () => V.mm });
    await pregen.pregenNext(reply(), [LINES[0]]);
    assert.deepEqual(keys(), ['k:「둘」']);
    setup({ voices: [V.mm], providers: { minimax: { ...GATEWAY } }, voiceFor: () => V.mm });
    await pregen.pregenNext(reply(), [LINES[0]]);
    assert.deepEqual(keys(), ['k:「둘」'], '집 PC 게이트웨이는 무료');
});
await test('목소리가 섞여 있으면 다음 줄이 유료 엔진일 때만 건너뜀 (skipped)', async () => {
    setup({ voices: [V.mm, V.cp], providers: { minimax: { ...OFFICIAL } }, voiceFor: (seg) => (seg.text === '「둘」' ? V.mm : V.cp) });
    const id = reply();
    const job = await pregen.pregenNext(id, [LINES[0]]);
    assert.deepEqual(keys(), []);
    assert.equal(job.skipped, 1);
    await pregen.pregenNext(id, [LINES[1]]);
    assert.deepEqual(keys(), ['k:「셋」'], '무료 엔진 줄은 만듦');
});
await test('분석이 아직이면 · 번역문이 올 답장이면 안 만든다 (키가 바뀌어 두 번 값을 치르지 않게) · 듣는 언어로 못 옮긴 줄도', async () => {
    setup(); T.wantAnalysis = true;
    assert.equal(pregen.pregenNext(reply(), [LINES[0]]), null, '분석 전');
    setup(); T.displayReady = false; T.expect = true;
    assert.equal(pregen.pregenNext(reply(), [LINES[0]]), null, '번역문을 기다림');
    setup(); T.displayReady = false; T.expect = false;
    await pregen.pregenNext(reply(), [LINES[0]]);
    assert.deepEqual(keys(), ['k:「둘」'], '번역기가 없으면 원문으로');
    setup({ segs: [LINES[0], { ...LINES[1], listenPending: true }] });
    const job = await pregen.pregenNext(reply(), [LINES[0]]);
    assert.deepEqual(keys(), []);
    assert.equal(job.skipped, 1);
});

// ---------- 4) 그만두기 · 오류
const FOUR = [...LINES, D('「넷」', 3, 7)];
await test('다른 줄을 새로 누르면 앞의 「다음 한 줄」은 그만 (signal abort — 아직 안 보낸 것만 취소) · 새 다음 줄을 만든다', async () => {
    setup({ segs: FOUR });
    let open; T.gate = new Promise(r => { open = r; });
    const id = reply();
    const first = pregen.pregenNext(id, [FOUR[0]]);
    await until(() => T.clips.length === 1, '첫 요청');
    T.gate = null;
    const second = pregen.pregenNext(id, [FOUR[2]]);
    assert.equal(T.clips[0].signal.aborted, true, '앞의 것은 그만');
    open();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.state, 'cancel');
    assert.equal(b.state, 'done');
    assert.deepEqual(keys(), ['k:「둘」', 'k:「넷」']);
    assert.deepEqual(pregen.state().next?.keys, ['k:「넷」']);
});
await test('만드는 중인 바로 그 줄을 누르면 그 요청은 그만두지 않는다 (누른 쪽이 붙음) · 그다음 줄을 새로', async () => {
    setup({ segs: FOUR });
    let open; T.gate = new Promise(r => { open = r; });
    const id = reply();
    const first = pregen.pregenNext(id, [FOUR[0]]);
    await until(() => T.clips.length === 1, '첫 요청');
    T.gate = null;
    const second = pregen.pregenNext(id, [FOUR[1]]);
    assert.equal(T.clips[0].signal.aborted, false, '「둘」 요청은 그대로');
    open();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.state, 'done');
    assert.equal(b.state, 'done');
    assert.deepEqual(keys(), ['k:「둘」', 'k:「셋」']);
    assert.deepEqual(pregen.state().next?.keys, ['k:「셋」']);
});
await test('채팅 바뀜 · 스와이프 · 글이 바뀜 이벤트가 「다음 한 줄」을 그만둔다', async () => {
    pregen.init();
    for (const [name, arg, mutate] of [['chat_changed', undefined, null], ['message_swiped', 1, null], ['message_edited', 1, (m) => { m.mes += ' 고침'; }]]) {
        setup();
        let open; T.gate = new Promise(r => { open = r; });
        const id = reply();
        const p = pregen.pregenNext(id, [LINES[0]]);
        await until(() => T.clips.length === 1, name);
        if (mutate) mutate(T.chat[id]);
        for (const fn of T.handlers[name] || []) fn(arg);
        assert.equal(T.clips[0].signal.aborted, true, name);
        open();
        assert.equal((await p).state, 'cancel', name);
        assert.equal(pregen.state().next, null, name);
    }
    setup();
    let open; T.gate = new Promise(r => { open = r; });
    const id = reply();
    const p = pregen.pregenNext(id, [LINES[0]]);
    await until(() => T.clips.length === 1, 'same text');
    for (const fn of T.handlers.message_updated || []) fn(id);
    assert.equal(T.clips[0].signal.aborted, false, '글이 그대로인 갱신은 그대로 둔다');
    open();
    assert.equal((await p).state, 'done');
});
await test('오류: 키 · 잔액 → 그 엔진을 멈춤 · 잦은 요청(429) → 쉬었다 다시 · 키가 아직 없음 → 그 줄만 건너뜀 (토스트 없음)', async () => {
    setup();
    T.fail = Object.assign(new Error('rate'), { status: 429 });
    const a = await pregen.pregenNext(reply(), [LINES[0]]);
    assert.deepEqual(T.cooled, ['openai_compat']);
    assert.deepEqual(keys(), ['k:「둘」', 'k:「둘」'], '한 번 더');
    assert.equal(a.state, 'done');
    setup();
    T.fail = Object.assign(new Error('nokey'), { fatal: true });
    const b = await pregen.pregenNext(reply(), [LINES[0]]);
    assert.equal(b.skipped, 1);
    assert.equal(b.state, 'done');
    setup();
    T.fail = Object.assign(new Error('auth'), { status: 401 });
    const c = await pregen.pregenNext(reply(), [LINES[0]]);
    assert.equal(c.skipped, 1);
    assert.ok(pregen.state().halted.includes('openai_compat'), '멈춘 엔진');
    T.clips.length = 0;
    const d = await pregen.pregenNext(reply(), [LINES[0]]);
    assert.deepEqual(keys(), [], '멈춘 엔진 줄은 건너뜀');
    assert.equal(d.skipped, 1);
    T.handlers.chat_changed.forEach(fn => fn());   // 채팅이 바뀌면 멈춤이 풀린다
    assert.deepEqual(pregen.state().halted, []);
});
await test('init 이 재생기의 onTapped 에 붙는다 — 누르면 다음 틱에 다음 줄 (폴링으로 확인)', async () => {
    setup();
    assert.equal(T.tapFns.length, 1, '한 번만 등록 (init 은 두 번 불러도 한 번)');
    pregen.init();
    assert.equal(T.tapFns.length, 1);
    const id = reply();
    T.tapFns[0](id, [LINES[1]]);
    assert.deepEqual(keys(), [], '부른 그 자리에서는 아직 (누른 줄 재생을 먼저)');
    await until(() => T.clips.length === 1, '다음 줄');
    assert.deepEqual(keys(), ['k:「셋」']);
});

// ---------- 4b) 6.2.8 「다음 한 줄 · 이어 듣기」 (chain)
const ended = (id, seg, played = true) => T.endFns[0](id, [seg], { played });
const spokenTexts = () => T.spoken.map(x => x.segs.map(s => s.text).join('+'));
await test('chain: 첫 줄을 누르면 둘째 줄을 미리(next 와 같은 키) · 그 큐가 끝나면 둘째 줄을 누른 것처럼 넣고 셋째 줄을 미리 … 마지막 줄 뒤엔 조용히 끝', async () => {
    setup({ mode: 'chain' });
    assert.equal(T.endFns.length, 1, 'init 이 onEnded 에 한 번 등록');
    const id = reply();
    await pregen.pregenNext(id, [LINES[0]]);
    assert.deepEqual(keys(), ['k:「둘」']);
    assert.deepEqual(T.segOpts.at(-1), { thoughts: false }, '속마음 건너뛰기면 대사만');
    assert.deepEqual(pregen.state().chain, { id, text: '「하나」' });
    ended(id, LINES[0]);
    assert.deepEqual(spokenTexts(), ['「둘」'], '둘째 줄을 누른 것처럼');
    await until(() => T.clips.length === 2, '셋째 줄 미리');
    assert.deepEqual(keys(), ['k:「둘」', 'k:「셋」']);
    await until(() => pregen.state().chain?.text === '「둘」', '이어 듣는 줄이 옮겨 감');
    ended(id, LINES[1]);
    assert.deepEqual(spokenTexts(), ['「둘」', '「셋」']);
    await until(() => pregen.state().chain?.text === '「셋」', '마지막 줄');
    assert.equal(T.clips.length, 2, '마지막 줄 뒤엔 만들 것이 없다');
    ended(id, LINES[2]);
    assert.deepEqual(spokenTexts(), ['「둘」', '「셋」'], '답장 끝 — 다음 메시지로 넘어가지 않는다');
    assert.equal(pregen.state().chain, null);
});
await test('chain 멈춤: 합성 실패(played false) · 다른 줄의 큐 · 글이 바뀜 · 생성 시작 · 채팅 바뀜 · 모드를 바꿈 → 이어 가지 않음', async () => {
    const start = async () => { setup({ mode: 'chain' }); const id = reply(); await pregen.pregenNext(id, [LINES[0]]); T.spoken.length = 0; return id; };
    let id = await start();
    ended(id, LINES[0], false);
    assert.deepEqual(spokenTexts(), [], '합성 실패');
    assert.deepEqual(pregen.state().chain, { id, text: '「하나」' }, '줄은 그대로 (다시 누르면 이어짐)');
    ended(id, LINES[1]);
    assert.deepEqual(spokenTexts(), [], '다른 줄의 큐는 무시');
    ended(id + 5, LINES[0]);
    assert.deepEqual(spokenTexts(), [], '다른 메시지의 큐는 무시');
    T.chat[id].mes += ' 고침';
    ended(id, LINES[0]);
    assert.deepEqual(spokenTexts(), [], '글이 바뀜');
    assert.equal(pregen.state().chain, null);
    id = await start();
    for (const fn of T.handlers.generation_started) fn('normal', {}, true);
    assert.deepEqual(pregen.state().chain, { id, text: '「하나」' }, 'dry run 은 그대로');
    for (const fn of T.handlers.generation_started) fn('quiet', {}, false);
    assert.deepEqual(pregen.state().chain, { id, text: '「하나」' }, '6.3.0 조용한 생성(요약 · 그림 프롬프트 · 표정)은 그대로 잇는다');
    for (const fn of T.handlers.generation_started) fn('normal', {}, false);
    assert.equal(pregen.state().chain, null, '생성이 시작되면 지금 줄까지');
    ended(id, LINES[0]);
    assert.deepEqual(spokenTexts(), []);
    id = await start();
    for (const fn of T.handlers.chat_changed) fn();
    assert.equal(pregen.state().chain, null, '채팅 바뀜');
    id = await start();
    for (const fn of T.handlers.message_swiped) fn(id);
    assert.equal(pregen.state().chain, null, '스와이프');
    id = await start();
    for (const fn of T.handlers.message_edited) { T.chat[id].mes += ' 편집'; fn(id); }
    assert.equal(pregen.state().chain, null, '편집');
    id = await start();
    s.pregen = 'next';
    ended(id, LINES[0]);
    assert.deepEqual(spokenTexts(), [], '모드를 바꾸면 이어 가지 않음');
    s.pregen = 'chain';
    id = await start();
    s.click_play = false;
    ended(id, LINES[0]);
    assert.deepEqual(spokenTexts(), [], '대사 클릭 꺼짐');
});
await test('chain: 다른 줄을 새로 누르면 그 줄부터 이어 간다 (옛 줄의 끝은 무시)', async () => {
    setup({ mode: 'chain', segs: FOUR });
    const id = reply();
    await pregen.pregenNext(id, [FOUR[0]]);
    await pregen.pregenNext(id, [FOUR[2]]);
    assert.deepEqual(pregen.state().chain, { id, text: '「셋」' });
    ended(id, FOUR[0]);
    assert.deepEqual(spokenTexts(), [], '옛 줄');
    ended(id, FOUR[2]);
    assert.deepEqual(spokenTexts(), ['「넷」']);
});
await test('chain: 유료 엔진뿐이고 「유료 엔진도 미리 만들기」 끔 → 미리는 안 만들지만 이어 듣기는 된다 (그 줄은 누를 때처럼 만듦)', async () => {
    setup({ mode: 'chain', voices: [V.mm], providers: { minimax: { ...OFFICIAL } }, voiceFor: () => V.mm });
    const id = reply();
    assert.equal(pregen.pregenNext(id, [LINES[0]]), null, '미리 만들기는 건너뜀');
    assert.deepEqual(keys(), []);
    assert.deepEqual(pregen.state().chain, { id, text: '「하나」' }, '그래도 이어 듣는 줄은 적힘');
    ended(id, LINES[0]);
    assert.deepEqual(spokenTexts(), ['「둘」'], '둘째 줄을 누른 것처럼 (재생기가 그때 만든다)');
    assert.deepEqual(keys(), [], '여전히 미리는 없음');
    setup({ mode: 'chain', voices: [V.mm, V.cp], providers: { minimax: { ...OFFICIAL } }, voiceFor: (seg) => (seg.text === '「둘」' ? V.mm : V.cp) });
    const id2 = reply();
    const job = await pregen.pregenNext(id2, [LINES[0]]);
    assert.equal(job.skipped, 1, '유료 줄만 건너뜀');
    ended(id2, LINES[0]);
    assert.deepEqual(spokenTexts(), ['「둘」']);
    await new Promise((r) => setTimeout(r, 0));   // 다음 시험 전에 다음 틱을 흘려 보낸다
});
const TH = { kind: 'thought', text: '생각', line: 2, dialogueIndex: -1, thoughtIndex: 0 };
await test('chain: 속마음은 읽을 글 › 속마음이 건너뛰기가 아닐 때만 순서에 낀다 (줄 번호 순서 · 미리 만들기도 속마음까지)', async () => {
    setup({ mode: 'chain', segs: [...LINES, TH] });   // tapSegments 처럼 속마음은 뒤에
    let id = reply();
    await pregen.pregenNext(id, [LINES[0]]);
    assert.deepEqual(keys(), ['k:「둘」'], '건너뛰기면 대사만');
    assert.deepEqual(T.segOpts.at(-1), { thoughts: false });
    ended(id, LINES[0]);
    assert.deepEqual(spokenTexts(), ['「둘」']);
    await new Promise((r) => setTimeout(r, 0));   // 앞 단락이 건 다음 틱(둘째 줄 미리 만들기)을 먼저 흘려 보낸다
    setup({ mode: 'chain', segs: [...LINES, TH] });
    s.routes.thought = 'character';
    id = reply();
    await pregen.pregenNext(id, [LINES[0]]);
    assert.deepEqual(keys(), ['k:생각'], '속마음이 다음 줄');
    assert.deepEqual(T.segOpts.at(-1), { thoughts: true });
    ended(id, LINES[0]);
    assert.deepEqual(spokenTexts(), ['생각']);
    await until(() => pregen.state().chain?.text === '생각', '속마음 차례');
    assert.deepEqual(keys(), ['k:생각', 'k:「둘」'], '속마음 다음은 둘째 대사');
    ended(id, TH);
    assert.deepEqual(spokenTexts(), ['생각', '「둘」']);
});
await test('next 모드는 그대로: 큐가 끝나도 이어 가지 않는다 · 끔 · 대사 · 대사+속마음도', async () => {
    for (const mode of ['next', 'off', 'dialogue', 'all']) {
        setup({ mode });
        const id = reply();
        await pregen.pregenNext(id, [LINES[0]]);
        assert.equal(pregen.state().chain, null, mode);
        ended(id, LINES[0]);
        assert.deepEqual(spokenTexts(), [], mode);
    }
});
await test('nextLine: thoughts 옵션 — 기본은 예전 그대로, thoughts 면 속마음도 줄 순서에 끼고 누른 속마음은 글로 찾아 그다음 조각', () => {
    const list = [D('「하나」', 0, 1), D('「둘」', 1, 3), { kind: 'thought', text: '생각', line: 2 }];
    assert.equal(pregen.nextLine(list, D('「하나」', 0, 1)).text, '「둘」', '기본: 대사만');
    assert.equal(pregen.nextLine(list, D('「하나」', 0, 1), { thoughts: true }).text, '생각');
    assert.equal(pregen.nextLine(list, { kind: 'thought', text: '생각', line: 2 }, { thoughts: true }).text, '「둘」');
    assert.equal(pregen.nextLine(list, { kind: 'thought', text: '생각', line: 2 }).text, '「둘」', '기본: 속마음 뒤의 첫 대사');
    assert.equal(pregen.nextLine(list, { kind: 'thought', text: '다른 생각', line: 2 }, { thoughts: true }).text, '「둘」', '못 찾은 속마음은 그 줄 뒤의 첫 대사');
    assert.equal(pregen.nextLine(list, D('「둘」', 1, 3), { thoughts: true }), null);
    assert.equal(pregen.nextLine([{ kind: 'thought', text: '생각', line: 2 }], D('「하나」', 0, 1), { thoughts: true }), null, '대사가 없으면 null');
});

await test('6.3.0 nextLine: 같은 줄의 속마음+대사는 글 순서(order)대로 — 앞의 속마음으로 되돌아가지 않고, 속마음을 누르면 같은 줄 뒤의 대사부터', () => {
    const o = (seg, order) => ({ ...seg, order });
    // tapSegments 처럼 대사 먼저 · 속마음 뒤, order 는 글 순서: *가나* 「하나」 / *다라* 「둘」 / 「셋」 *마바*
    const list = [o(D('「하나」', 0, 0), 1), o(D('「둘」', 1, 1), 3), o(D('「셋」', 2, 2), 4), o({ kind: 'thought', text: '가나', line: 0 }, 0), o({ kind: 'thought', text: '다라', line: 1 }, 2), o({ kind: 'thought', text: '마바', line: 2 }, 5)];
    const seq = (from) => { const out = []; let cur = from; while ((cur = pregen.nextLine(list, cur, { thoughts: true }))) out.push(cur.text); return out; };
    assert.deepEqual(seq(D('「하나」', 0, 0)), ['다라', '「둘」', '「셋」', '마바']);
    assert.deepEqual(seq({ kind: 'thought', text: '가나', line: 0 }), ['「하나」', '다라', '「둘」', '「셋」', '마바']);
    assert.deepEqual(seq({ kind: 'thought', text: '다라', line: 1 }), ['「둘」', '「셋」', '마바']);
    assert.equal(pregen.nextLine(list, { kind: 'thought', text: '마바', line: 2 }, { thoughts: true }), null);
    assert.equal(pregen.nextLine(list, D('「하나」', 0, 0)).text, '「둘」', 'thoughts 없이는 대사만 (예전 그대로)');
    // order 가 없는 옛 조각(시험 스텁 · 즉석 조각)은 예전처럼 목록 순서
    const old = [D('「하나」', 0, 0), { kind: 'thought', text: '가나', line: 0 }];
    assert.equal(pregen.nextLine(old, D('「하나」', 0, 0), { thoughts: true }).text, '가나');
    // clickplay.tapSegments 가 조각마다 글 순서를 적는다
    const cp = fs.readFileSync(path.join(root, 'clickplay.js'), 'utf8');
    assert.match(cp, /seg\.order = out\.length \+ later\.length;/);
});

// ---------- 5) 설정 창
await test('설정 창: 고르기 목록 끔 · 다음 한 줄 · 대사 · 대사+속마음, 「유료 엔진도 미리 만들기」 스위치는 다음 한 줄에도', () => {
    const t = ui._forTest || {};
    const fields = t.whenFields();
    const f = fields.find(x => x.key === 'pregen');
    assert.deepEqual(f.options, [{ value: 'off', label: '끔' }, { value: 'next', label: '다음 한 줄' }, { value: 'chain', label: '다음 한 줄 · 이어 듣기' }, { value: 'dialogue', label: '대사' }, { value: 'all', label: '대사+속마음' }]);
    assert.equal(f.title, undefined, '말풍선 없음');
    const st = (o) => ({ pregen: 'next', click_play: true, auto_play: false, voices: [V.mm], providers: { minimax: OFFICIAL }, ...o });
    assert.equal(t.showPregenPaid(st()), true);
    assert.equal(t.showPregenPaid(st({ pregen: 'off' })), false);
});
await test('설정 창 한 줄: 다음 한 줄은 대사 클릭이 꺼지면 쉼 (자동 읽기와 상관없음) · 유료 엔진뿐이면 쉼 · 경고는 한 줄만 든다는 말', () => {
    const { pregenDesc, pregenWarn } = ui._forTest || {};
    const st = (o) => ({ pregen: 'next', click_play: true, auto_play: false, voices: [V.cp], providers: {}, ...o });
    assert.equal(pregenDesc(st()), '');
    assert.equal(pregenDesc(st({ click_play: false, auto_play: true })), '대사 클릭이 꺼져 쉬어요', '자동 읽기는 누른 줄이 아님');
    assert.equal(pregenDesc(st({ voices: [V.mm], providers: { minimax: OFFICIAL } })), '유료 엔진이라 쉬어요');
    assert.equal(pregenDesc(st({ voices: [V.mm], providers: { minimax: OFFICIAL }, pregen_paid: true })), '');
    assert.equal(pregenDesc({ ...st(), pregen: 'dialogue', click_play: false, auto_play: false }), '대사 클릭·자동 읽기가 꺼져 쉬어요', '대사 모드는 예전 그대로');
    const paidOff = pregenWarn(st({ voices: [V.mm], providers: { minimax: OFFICIAL } }));
    assert.equal(paidOff, 'MiniMax 같은 유료 엔진은 미리 만들지 않아요 — 누른 줄만 만들어 크레딧을 아껴요.');
    const on = pregenWarn(st({ voices: [V.mm], providers: { minimax: OFFICIAL }, pregen_paid: true, usage: { pre_chars: 20000, pre_used_chars: 18000 } }));
    assert.match(on, /^누른 대사의 다음 한 줄만 미리 만들어요/);
    assert.match(on, /90 %만 들었어요\.$/);
    assert.match(pregenWarn({ ...st(), pregen: 'all', voices: [V.mm], providers: { minimax: OFFICIAL }, pregen_paid: true }), /빨리 닳아요\. 아끼려면 끔 또는 다음 한 줄\.$/);
});

// ---------- 6) 재생기 연결 (원문)
await test('player.js: 누른 줄을 재생 줄에 넣은 뒤 듣는 쪽을 부른다 (채팅 메시지만) · 6.4.2 누른 줄 · 자동 읽기 · 내려받기 모두 줄마다 (같은 키)', () => {
    const src = fs.readFileSync(path.join(root, 'player.js'), 'utf8');
    const body = src.slice(src.indexOf('export function speakSegments'), src.indexOf('export function speakExternal'));
    const enq = body.indexOf('enqueue([...cues.before, ...jobs, ...cues.after], { append: false });');
    const call = body.indexOf('if (mesId >= 0) for (const fn of tapListeners) { try { fn(mesId, told); } catch');   // 1.9.1 told = 이어 읽은 묶음의 조각들 (묶음이 아니면 segs)
    assert.ok(enq > 0 && call > enq, '재생 줄에 넣은 뒤');
    assert.match(body, /finishJobs\(flat, s, \{ merge: false, join: true \}\)\.filter\(t\.keep\)/);   // 1.9.1 줄마다 + 같은 문단 묶음만 이어서 (자동 읽기 · 미리 만들기와 같은 열쇠)
    assert.match(body, /const told = heard\.length > 1 \? heard : segs;/);
    assert.ok(!/merge: !(pregenOn|tapByLine)\(s\)/.test(src) && !/const tapByLine/.test(src), '6.4.2 설정에 따라 합치는 읽기 없음');
    assert.match(src, /export function onEnded\(fn\)/, '6.2.8 누른 큐의 끝 알림');
    assert.ok(/const ended = tapRun && tapRun\.gen === my \? tapRun : null;\s*tapRun = null;\s*if \(handoff && ended\) await handOffTails\(ended, my\);[^\n]*\n\s*else \{\s*finishAll\(\);\s*if \(ended\) notifyEnded\(ended\);/.test(src), '큐를 정리한 뒤에 알린다 (6.3.9 이어 듣기로 넘길 때는 handOffTails 가 먼저 알리고 정리)');
    assert.ok(/tapRun = mesId >= 0 \? \{ gen, mesId, segs: told, played: false \} : null;/.test(body), '누른 줄의 큐만');
    assert.match(src, /const pregenOn = \(s\) => s\?\.pregen === 'dialogue' \|\| s\?\.pregen === 'all';/, '자동 읽기 · 감정 태그 규칙은 예전 그대로');
    assert.match(src, /export function onTapped\(fn\)/);
    const pg = fs.readFileSync(path.join(root, 'pregen.js'), 'utf8');
    assert.match(pg, /player\.onTapped\(\(id, segs\) => setTimeout\(\(\) => \{/, '다음 틱에');
    assert.match(pg, /const modeOf = \(s\) => \(s && \(s\.pregen === 'dialogue' \|\| s\.pregen === 'all'\) \? s\.pregen : 'off'\);/, '답장 미리 만들기는 next 에서 끔');
    assert.ok(!/toastr|toast\(/.test(pg.slice(pg.indexOf('// ---------- 6.2.5'))), '토스트 없음');
    assert.match(pg, /player\.onEnded\(\(id, segs, info\) => \{ try \{ chainNext\(id, segs, info\); \}/, '6.2.8 이어 듣기 등록');
});

console.log(`\ntts-pregen-next: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
