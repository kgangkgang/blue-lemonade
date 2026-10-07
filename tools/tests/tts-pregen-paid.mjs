// TTS 5.6.4 유료 엔진은 미리 만들지 않기 (src/addons/tts/src/paid.js · pregen.js · settings.js · ui.js)
//   node tools/tests/tts-pregen-paid.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈(script.js · extensions.js · popup.js · utils.js · secrets.js)은 data: 스텁으로 바꿔 끼우고, pregen.js 가 부르는
// 재생기 · 분석 · 번역 · 캐시 · 클릭은 부른 것을 기록만 하는 스텁으로 (소리를 만들지 않음 · 네트워크 없음 — fetch 를 부르면 실패).
// 판단 규칙: MiniMax 는 공식 서버(목록 3개 · minimax.io · minimaxi.com · minimax.chat · minimaxi.chat 로 끝나는 주소)만 유료.
//   '직접 입력' 이 비었으면 hostOf 가 api.minimax.io 로 보내므로 유료, 읽을 수 없는 주소도 유료(아끼는 쪽 — 어차피 요청 실패).
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { mock } from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.', 'src/addons/tts/src');
const mod = (name) => pathToFileURL(path.join(root, name)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;

// ---------- 공유 상태 (스텁이 globalThis 로 읽음)
const T = globalThis.__ttsPaidTest = {
    chat: [], ext: {}, ctx: null, saves: { debounced: 0, direct: 0 },
    clips: [], analysisCalls: 0, wantAnalysis: false, jobs: [],
    lineJobs() { return { jobs: T.jobs.slice(), held: 0, missing: false }; },
    async ensureClip(job) { T.clips.push(job.key); return { made: true }; },
};
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };

const G = 'const T = globalThis.__ttsPaidTest;\n';
const ST = {
    'script.js': js(G + `export const chat = T.chat;
export const event_types = {};
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() { T.saves.debounced++; }
export async function saveSettings() { T.saves.direct++; }`),
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
export const coolDown = () => {};`),
    './analysis.js': js(G + 'export async function analyzeMessage() { T.analysisCalls++; return { segs: [] }; }'),
    './translation.js': js(`export const displayReady = () => true;
export const translationExpected = () => false;
export async function watchDisplay() { return 'none'; }`),
    './cache.js': js('export async function has() { return false; }\nexport function setProtected() {}'),
    './clickplay.js': js('export const tapSegments = (mes) => [{ kind: "dialogue", text: String(mes?.mes ?? "") }];'),
};
// 탈출 경로(../ 세 번 이상)로 부르는 실리태번 모듈만 · pregen.js 의 이웃 모듈만 바꾼다
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
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.message || e).split('\n').slice(0, 4).join('\n       ')}`); }
}
async function load(name) {
    try { return await import(mod(name)); } catch (e) { return { __error: e }; }
}
const need = (m, name) => { if (m.__error) throw new Error(`${name} 를 못 불러옴: ${m.__error.message}`); return m; };

const V = {
    mm: { uid: 'minimax:ade', provider: 'minimax', voiceId: 'ade', name: '에이드' },
    cp: { uid: 'openai_compat:night', provider: 'openai_compat', voiceId: 'night', name: '나이트' },
    br: { uid: 'browser:ko', provider: 'browser', voiceId: 'ko', name: '브라우저' },
    el: { uid: 'elevenlabs:x', provider: 'elevenlabs', voiceId: 'x', name: '일레븐' },
};
const OFFICIAL = { key: 'test-key', host: 'https://api.minimax.io' };
const GATEWAY = { key: 'test-key', host: 'custom', host_custom: 'http://198.51.100.7:8880' };
T.ext.lemon_voice = {
    version: 8, enabled: true, pregen: 'dialogue', click_play: true, auto_play: false,
    voices: [V.mm], providers: { minimax: { ...OFFICIAL } },
};

const S = need(await load('settings.js'), 'settings.js');
const P = need(await load('providers/index.js'), 'providers/index.js');
const L = need(await load('log.js'), 'log.js');
const pregen = need(await load('pregen.js'), 'pregen.js');
const paid = await load('paid.js');
const ui = await load('ui.js');
const s = S.settings();

console.log('TTS 5.6.4 유료 엔진 미리 만들기');

// ---------- 1) paid.js 판단
await test('MiniMax 공식 서버(목록 3개 · 기본값)는 유료', () => {
    const { isPaidProvider } = need(paid, 'paid.js');
    for (const host of ['https://api.minimax.io', 'https://api-uw.minimax.io', 'https://api.minimaxi.com']) assert.equal(isPaidProvider('minimax', { host }), true, host);
    assert.equal(isPaidProvider('minimax', {}), true, '설정 없음 = 기본 서버 api.minimax.io');
    assert.equal(isPaidProvider('minimax', { host: 'https://api.minimax.io/' }), true, '끝 / ');
});
await test('직접 입력 http://198.51.100.7:8880 (집 PC 로컬 게이트웨이 · 공인 IP) 은 무료 · 집 안 · 내 PC 주소도', () => {
    const { isPaidProvider, LOCAL_HOST } = need(paid, 'paid.js');
    assert.equal(LOCAL_HOST.test('198.51.100.7'), false, '공인 IP 라 LOCAL_HOST 로는 못 가림');
    assert.equal(isPaidProvider('minimax', GATEWAY), false);
    for (const host_custom of ['198.51.100.7:8880', 'http://198.51.100.7:8880/', ' http://192.168.0.10:8880 ', 'http://localhost:8880', 'https://tts.myhome.example']) {
        assert.equal(isPaidProvider('minimax', { host: 'custom', host_custom }), false, host_custom);
    }
    assert.equal(isPaidProvider('minimax', { host: 'http://198.51.100.7:8880' }), false, '1.0.0 에서 옮겨온 임의 주소도 같은 규칙');
});
await test('직접 입력이 MiniMax 공식 도메인이면 유료 (대소문자 · 하위 도메인 · 네 도메인) · 닮은 이름은 아님', () => {
    const { isPaidProvider } = need(paid, 'paid.js');
    for (const host_custom of ['https://api.minimax.io', 'api.minimax.io', 'https://API.MiniMax.io/', 'https://minimax.chat', 'https://x.minimaxi.chat/v1', 'https://api.minimaxi.com.']) {
        assert.equal(isPaidProvider('minimax', { host: 'custom', host_custom }), true, host_custom);
    }
    for (const host_custom of ['https://api.minimax.io.example.com', 'https://notminimax.io', 'https://minimax.io-proxy.example']) {
        assert.equal(isPaidProvider('minimax', { host: 'custom', host_custom }), false, host_custom);
    }
});
await test('직접 입력이 비었거나 읽을 수 없으면 유료 (빈칸 = hostOf 가 api.minimax.io 로 보냄 · 못 읽는 주소 = 아끼는 쪽)', () => {
    const { isPaidProvider } = need(paid, 'paid.js');
    for (const host_custom of ['', '   ', undefined, null, 'http://exa mple:8880', 'http://[zz]']) {
        assert.equal(isPaidProvider('minimax', { host: 'custom', host_custom }), true, JSON.stringify(host_custom));
    }
});
await test('OpenAI 호환: 내 PC · 집 안(빈 주소 = 127.0.0.1)은 무료, 바깥 주소는 유료 · 브라우저 · Google 번역 무료 · 나머지 · 모르는 엔진 유료', () => {
    const { isPaidProvider } = need(paid, 'paid.js');
    for (const base of [undefined, '', '  ', 'http://127.0.0.1:8880/v1', 'http://192.168.1.5:8880/v1', 'http://kokoro.local/v1', 'http://[::1]:8880/v1']) assert.equal(isPaidProvider('openai_compat', { base }), false, String(base));
    for (const base of ['https://tts.example.com/v1', 'https://api.openai.com/v1', 'http://198.51.100.7:8880/v1']) assert.equal(isPaidProvider('openai_compat', { base }), true, base);
    assert.equal(isPaidProvider('browser'), false);
    assert.equal(isPaidProvider('gtranslate'), false);
    for (const id of ['openai', 'openrouter', 'elevenlabs', 'gemini', 'azure', 'typecast', 'cartesia', 'mystery']) assert.equal(isPaidProvider(id, {}), true, id);
});
await test('paidEngines · paidOnly: 등록한 목소리의 엔진만 · 설정을 새로 만들지 않음', () => {
    const { paidEngines, paidOnly } = need(paid, 'paid.js');
    const t = (voices, providers) => ({ voices, providers });
    assert.deepEqual(paidEngines(t([V.mm], { minimax: OFFICIAL })), ['MiniMax']);
    assert.equal(paidOnly(t([V.mm], { minimax: OFFICIAL })), true);
    assert.deepEqual(paidEngines(t([V.mm], { minimax: GATEWAY })), []);
    assert.equal(paidOnly(t([V.mm], { minimax: GATEWAY })), false);
    assert.deepEqual(paidEngines(t([V.mm, V.br], { minimax: OFFICIAL })), ['MiniMax']);
    assert.equal(paidOnly(t([V.mm, V.br], { minimax: OFFICIAL })), false, '무료 엔진이 섞이면 통째로 쉬지 않음');
    assert.deepEqual(paidEngines(t([V.mm, V.el], { minimax: GATEWAY })), ['ElevenLabs']);
    assert.equal(paidOnly(t([], {})), false, '목소리 없음');
    const bare = t([V.cp], {});
    assert.deepEqual(paidEngines(bare), []);
    assert.equal(bare.providers.openai_compat, undefined, '빈 엔진 설정을 만들지 않음');
});

// ---------- 2) 설정
await test('settings: 기본 pregen_paid=false (DEFAULTS · 새 설치 · 옛 설정) · 켬끔만 · 내보내기에 포함', () => {
    assert.equal(S.DEFAULTS.pregen_paid, false);
    assert.equal(s.pregen_paid, false, '옛 설정(키 없음)');
    const keep = T.ext.lemon_voice;
    try {
        delete T.ext.lemon_voice;
        assert.equal(S.settings().pregen_paid, false, '새 설치');
        T.ext.lemon_voice = { version: 8, voices: [], pregen_paid: 'yes' };
        assert.equal(S.settings().pregen_paid, false, '이상한 값 → 끔');
        T.ext.lemon_voice = { version: 8, voices: [], pregen_paid: true };
        assert.equal(S.settings().pregen_paid, true, '켠 값은 그대로');
        assert.equal(S.exportable().pregen_paid, true);
    } finally { T.ext.lemon_voice = keep; S.settings(); }
});
await test('설정 가져오기: pregen_paid 켬끔을 받고 · 켬끔이 아닌 값은 버림', () => {
    const { importSettings } = need(ui, 'ui.js')._forTest || {};
    assert.equal(typeof importSettings, 'function', 'ui.js _forTest.importSettings');
    try {
        importSettings({ pregen_paid: true });
        assert.equal(s.pregen_paid, true);
        importSettings({ pregen_paid: 'false' });
        assert.equal(s.pregen_paid, true, '글 값은 버림');
        importSettings({ pregen: 'all' });
        assert.equal(s.pregen_paid, true, '키가 없는 파일은 그대로');
        importSettings({ pregen_paid: false });
        assert.equal(s.pregen_paid, false);
    } finally { s.pregen = 'dialogue'; s.pregen_paid = false; }
});

// ---------- 3) 미리 만들기
let n = 0;
/** 내 메시지 + 생성한 답장 하나 (마지막) → 답장 번호 */
function reply() {
    T.chat.length = 0;
    T.chat.push({ name: 'User', is_user: true, mes: 'hi' });
    T.chat.push({ name: 'Ade', is_user: false, mes: `「안녕 ${++n}」`, extra: { api: 'custom', model: 'm' } });
    return 1;
}
const job = (key, v) => ({ key, text: `줄 ${key}`, voice: v, provider: P.getProvider(v.provider) });
function setup({ voices, minimax = OFFICIAL, pregenPaid = false, jobs }) {
    s.voices = voices; s.providers = { minimax: { ...minimax } }; s.pregen_paid = pregenPaid;
    T.jobs = jobs; T.clips.length = 0; T.analysisCalls = 0;
}
const logged = [];
L.onLog((e) => logged.push(e.msg));

await test('기본(유료 엔진 미리 만들기 끔): MiniMax 공식 서버뿐이면 답장을 통째로 건너뜀 — 합성 · 분석 없음, 까닭은 메시지마다 한 줄', async () => {
    setup({ voices: [V.mm], jobs: [job('a', V.mm), job('b', V.mm)] });
    T.wantAnalysis = true;
    try {
        logged.length = 0;
        const id = reply();
        const r = await pregen.pregenMessage(id, { type: 'normal' });
        await pregen.pregenMessage(id, { type: 'normal' });
        assert.deepEqual(T.clips, [], `합성 요청: ${T.clips.join(',')}`);
        assert.equal(T.analysisCalls, 0, '대사 분석도 안 보냄');
        assert.equal(r, null);
        const lines = logged.filter(m => m.includes(`#${id}`));
        assert.equal(lines.length, 1, lines.join(' | '));
        assert.match(lines[0], /유료 엔진/);
    } finally { T.wantAnalysis = false; }
});
await test('유료 엔진도 미리 만들기(pregen_paid) 를 켜면 공식 서버도 전처럼 만듦', async () => {
    setup({ voices: [V.mm], pregenPaid: true, jobs: [job('c', V.mm), job('d', V.mm)] });
    const rec = await pregen.pregenMessage(reply(), { type: 'normal' });
    assert.deepEqual(T.clips, ['c', 'd']);
    assert.equal(rec.state, 'done');
    assert.equal(rec.skipped, 0);
});
await test('MiniMax 서버가 직접 입력 http://198.51.100.7:8880 (로컬 게이트웨이)면 끔이어도 미리 만듦', async () => {
    setup({ voices: [V.mm], minimax: GATEWAY, jobs: [job('e', V.mm), job('f', V.mm)] });
    const rec = await pregen.pregenMessage(reply(), { type: 'normal' });
    assert.deepEqual(T.clips, ['e', 'f']);
    assert.equal(rec.skipped, 0);
});
await test('목소리가 섞임(MiniMax 공식 + 내 PC OpenAI 호환): 유료 엔진 줄만 건너뜀 (rec.skipped) · 답장 끝 기록 한 줄', async () => {
    setup({ voices: [V.mm, V.cp], jobs: [job('g', V.mm), job('h', V.cp), job('i', V.mm), job('j', V.cp)] });
    logged.length = 0;
    const id = reply();
    const rec = await pregen.pregenMessage(id, { type: 'normal' });
    assert.deepEqual(T.clips, ['h', 'j'], '무료 엔진 줄만');
    assert.equal(rec.state, 'done');
    assert.equal(rec.skipped, 2);
    assert.equal(rec.paid, 2);
    const lines = logged.filter(m => m.includes(`#${id}`));
    assert.equal(lines.length, 1, lines.join(' | '));
    assert.match(lines[0], /유료 엔진 2줄/);
    assert.doesNotMatch(lines[0], /한도 넘은/, '한도 때문이 아님');
});
await test('섞임 + 유료 엔진도 미리 만들기 켬 → 모두 · 섞임 + 게이트웨이 → 모두 (끔이어도)', async () => {
    setup({ voices: [V.mm, V.cp], pregenPaid: true, jobs: [job('k', V.mm), job('l', V.cp)] });
    await pregen.pregenMessage(reply(), { type: 'normal' });
    assert.deepEqual(T.clips, ['k', 'l']);
    setup({ voices: [V.mm, V.cp], minimax: GATEWAY, jobs: [job('m', V.mm), job('n', V.cp)] });
    await pregen.pregenMessage(reply(), { type: 'normal' });
    assert.deepEqual(T.clips, ['m', 'n']);
});
await test('무료 엔진만(브라우저 내장 제외 — 소리 파일이 없어 원래 안 만듦 · 내 PC OpenAI 호환)이면 그대로', async () => {
    setup({ voices: [V.cp, V.br], jobs: [job('o', V.cp), job('p', V.br)] });
    const rec = await pregen.pregenMessage(reply(), { type: 'normal' });
    assert.deepEqual(T.clips, ['o']);
    assert.equal(rec.skipped, 0);
});

// ---------- 4) 설정 창
await test("설정 창: '!' 는 유료 엔진이 있을 때만 · 끔이면 아끼는 안내, 켬이면 닳는다는 경고(이번 달 %)", () => {
    const { pregenWarn } = need(ui, 'ui.js')._forTest || {};
    assert.equal(typeof pregenWarn, 'function', 'ui.js _forTest.pregenWarn');
    const base = { pregen: 'dialogue', voices: [V.mm], usage: { pre_chars: 20000, pre_used_chars: 2400 } };
    assert.equal(pregenWarn({ ...base, providers: { minimax: GATEWAY } }), '', '게이트웨이 = 유료 아님 → 단추 없음');
    assert.equal(pregenWarn({ ...base, providers: { minimax: OFFICIAL } }), 'MiniMax 같은 유료 엔진은 미리 만들지 않아요 — 누른 줄만 만들어 크레딧을 아껴요.');
    const on = pregenWarn({ ...base, providers: { minimax: OFFICIAL }, pregen_paid: true });
    assert.match(on, /MiniMax 크레딧이 빨리 닳아요/);
    assert.match(on, /12 %만 들었어요/);
});
await test("설정 창: '유료 엔진도 미리 만들기' 스위치는 미리 만들기 바로 아래 · 유료 엔진이 있고 미리 만들기가 켜져 있을 때만 · 말풍선 없음", () => {
    const t = need(ui, 'ui.js')._forTest || {};
    assert.equal(typeof t.whenFields, 'function', 'ui.js _forTest.whenFields');
    const fields = t.whenFields();
    const i = fields.findIndex(f => f.key === 'pregen');
    const f = fields[i + 1];
    assert.equal(f?.key, 'pregen_paid');
    assert.equal(f.type, 'toggle');
    assert.ok(f.label && f.label.length <= 16, f.label);
    assert.equal(f.title, undefined);
    const st = (o) => ({ pregen: 'dialogue', voices: [V.mm], providers: { minimax: OFFICIAL }, ...o });
    assert.equal(f.show(st()), true);
    assert.equal(f.show(st({ pregen: 'off' })), false, '미리 만들기 끔');
    assert.equal(f.show(st({ providers: { minimax: GATEWAY } })), false, '유료 엔진 없음');
    assert.equal(f.show(st({ voices: [V.cp] })), false, '내 PC 서버만');
});
await test('설정 창: 목소리 엔진이 모두 유료이고 끔이면 미리 만들기 아래에 쉬는 까닭 한 줄', () => {
    const { pregenDesc } = need(ui, 'ui.js')._forTest || {};
    assert.equal(typeof pregenDesc, 'function', 'ui.js _forTest.pregenDesc');
    const st = (o) => ({ pregen: 'dialogue', click_play: true, auto_play: false, voices: [V.mm], providers: { minimax: OFFICIAL }, ...o });
    assert.equal(pregenDesc(st()), '유료 엔진이라 쉬어요');
    assert.equal(pregenDesc(st({ pregen_paid: true })), '');
    assert.equal(pregenDesc(st({ providers: { minimax: GATEWAY } })), '');
    assert.equal(pregenDesc(st({ voices: [V.mm, V.cp] })), '', '무료 엔진이 섞이면 쉬지 않음');
    assert.equal(pregenDesc(st({ pregen: 'off' })), '');
    assert.equal(pregenDesc(st({ click_play: false })), '대사 클릭·자동 읽기가 꺼져 쉬어요', '먼저 보던 까닭이 앞');
});

// ---------- 5) 사용량 저장: 30초 타이머도 debounce 없이 (그 1초 안에 탭을 닫아도 남게)
await test('사용량 30초 타이머 → saveSettings 바로 (saveSettingsDebounced 아님)', () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    try {
        S.flushUsage();
        const before = { ...T.saves };
        S.addUsage(10, { pre: true });
        mock.timers.tick(S.USAGE_SAVE_MS - 1);
        assert.deepEqual(T.saves, before, '30초 전엔 저장 없음');
        mock.timers.tick(1);
        assert.deepEqual(T.saves, { debounced: before.debounced, direct: before.direct + 1 });
        assert.equal(S.flushUsage(), false, '밀린 게 없음');
    } finally { mock.timers.reset(); }
});

console.log(`\ntts-pregen-paid: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
