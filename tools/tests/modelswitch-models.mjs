// 모델 전환 · 모델 등록의 모델 목록 — 공용 목록 src/live-models.js 를 쓰는 길 (src/addons/modelswitch/targets.js · src/addons/models/panel.js)
//   node tools/tests/modelswitch-models.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// 실리태번 모듈(script.js · extensions.js · secrets.js · openai.js · popup.js)은 data: 스텁으로. 네트워크 없음 (fetch 는 가짜 — 부른 것을 기록).
// 확인하는 것:
//   1) 고를 목록: 받은 목록이 없으면 모델 등록 → 최신 이름(KNOWN) → 실리태번 화면 목록, 받은 목록이 있으면 그것(새것 먼저) + 모델 등록 — 옛 이름으로 부풀리지 않음 (MiniMax 는 실리태번의 8개뿐)
//      + 대상 확장의 지금 모델. 'OR_Website' · 직접 입력 표시 · OpenAI 의 채팅 아닌 모델은 빠짐. Custom 은 주소별 (아무도 안 쓰는 옛 주소 목록은 안 넣음)
//   2) ↻: 목록을 주는 공급자 모두 · Custom 은 실리태번 Custom 주소만 (저장된 키 보호) · Custom 요청 본문은 예전(1.0.5)과 글자까지 같음 · 받은 목록은 localStorage 에만 (settings.json 의 model_switch.lists 는 그대로, 읽기만)
//   3) 조용히 다시 받기: 하루 안이면 안 물음 · 키 없음 · 목록 없는 공급자 · 새로 친 Custom 주소는 안 물음 · 실패해도 조용히 · 불러오기만으로는 통신 없음
//   4) 모델 등록 입력칸 제안: 공용 목록 가운데 실리태번 목록 · 등록한 목록에 없는 것만
//   5) 모델 전환은 생성 요청을 보내지 않는다 — 모델별 요청 규칙(applyModelRequestRules)의 자체 사본이 없음
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__msModelsTest = { ext: {}, cs: {}, names: [], selects: {}, ctx: null };
T.ctx = { chatCompletionSettings: T.cs, onlineStatus: 'no_connection' };
globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const G = 'const T = globalThis.__msModelsTest;\n';
const ST = {
    'script.js': js(G + `export const chat = [];
export const event_types = { ONLINE_STATUS_CHANGED: 'online_status_changed' };
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => '{' + String(t ?? '') + '}';
export function getRequestHeaders() { return { 'Content-Type': 'application/json', 'X-CSRF-Token': 'tok' }; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = T.names;
export function getContext() { return T.ctx; }`),
    'secrets.js': js('export let secret_state = {};\nexport function setSecretState(s) { secret_state = s || {}; }'),
    'openai.js': js(G + 'export const oai_settings = T.cs;\nexport let model_list = [];'),
    'popup.js': js('export const POPUP_TYPE = {}; export const POPUP_RESULT = {}; export async function callGenericPopup() { return null; }'),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    const base = spec.split('/').pop();
    if (parent.startsWith(R) && (spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(srcDir).href } });

// ---------- 가짜 화면: 실리태번의 #model_<id>_select (옵션 값만) · 모델 등록 창이 만드는 숨은 칸
const element = () => ({ hidden: false, dataset: {}, style: {}, children: [], append(...n) { this.children.push(...n); }, replaceChildren(...n) { this.children = n; }, querySelector: () => null, addEventListener() {} });
globalThis.document = {
    body: element(),
    activeElement: null,
    createElement: element,
    getElementById: (id) => (T.selects[id] ? { options: T.selects[id].map(value => ({ value })) } : null),
};

let calls = [];
let fetchHits = 0;
globalThis.fetch = async (url, init) => { fetchHits++; calls.push({ url, init }); return reply(url, init); };
let reply = () => ({ ok: true, status: 200, text: async () => JSON.stringify({ data: [] }) });
const answer = (body, status = 200) => () => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

const secrets = await import(ST['secrets.js']);
const LM = await import(pathToFileURL(path.join(srcDir, 'live-models.js')).href);
const MS = await import(pathToFileURL(path.join(srcDir, 'addons/modelswitch/targets.js')).href);
const MR = await import(pathToFileURL(path.join(srcDir, 'addons/models/panel.js')).href);
const importHits = fetchHits;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
function fakeStorage(init = {}) {
    const data = { ...init };
    return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, removeItem: (k) => { delete data[k]; } };
}
const SECRET = (on) => (on ? [{ id: 'k1', value: '***', label: 'x', active: true }] : null);
const DAY = 24 * 60 * 60 * 1000;
const ST_URL = 'http://127.0.0.1:5001/v1/';
const ST_KEY = 'custom:http://127.0.0.1:5001/v1';
function reset({ cs = {}, ext = {}, selects = {}, keys = {} } = {}) {
    globalThis.localStorage = fakeStorage();
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    Object.assign(T.ext, { salty: { addons: { translator: true, rewrite: true } } }, ext);
    for (const k of Object.keys(T.cs)) delete T.cs[k];
    Object.assign(T.cs, { chat_completion_source: 'openai', custom_url: ST_URL, custom_include_headers: 'X-H: 1', reverse_proxy: '', proxy_password: '' }, cs);
    T.selects = selects;
    T.names.length = 0;
    secrets.setSecretState({ api_key_openai: SECRET(true), api_key_openrouter: SECRET(true), api_key_deepseek: SECRET(false), api_key_claude: SECRET(true), api_key_minimax: SECRET(true), ...keys });
    LM._resetForTest();
    calls = [];
    reply = answer({ data: [] });
}
// 번역(llm-translator-custom) · 다시 쓰기(ban_word_rewrite) 대상이 지금 쓰는 모델
const translatorOn = (provider, model, extra = {}) => ({ 'llm-translator-custom': { connection_mode: 'direct', llm_provider: provider, llm_model: model, ...extra } });
const rewriteOn = (provider, model, extra = {}) => ({ ban_word_rewrite: { connection: 'direct', provider, models: { [provider]: model }, ...extra } });

// 1.0.5 의 fetchModels 가 보내던 본문 (index.js 그대로 — 주소가 실리태번 Custom 주소일 때만 보냈으므로 own 은 늘 참)
const oldCustomBody = (url, oai) => JSON.stringify({ chat_completion_source: 'custom', custom_url: url, custom_include_headers: true ? oai.custom_include_headers : '', reverse_proxy: '', proxy_password: '' });

// ---------- 1) 고를 목록
await test('받은 목록이 없으면: 모델 등록 → 최신 이름 → 실리태번 화면 목록 → 대상의 지금 모델 · 채팅 아닌 모델 · OR_Website · 직접 입력 표시는 뺌', () => {
    reset({
        ext: { model_register: { sources: { openai: ['my-gpt'] }, picks: {} }, ...translatorOn('openai', 'gpt-old-saved'), ...rewriteOn('openai', 'dall-e-3') },
        selects: { model_openai_select: ['gpt-6-sol', 'gpt-4o', 'dall-e-3', 'text-embedding-3-small', 'gpt-4o-mini-tts', 'custom', 'my-gpt'] },
    });
    const ids = MS.modelOptions('openai');
    assert.equal(ids[0], 'my-gpt', '모델 등록 먼저');
    assert.equal(ids[1], 'gpt-6.1-sol', '그다음 테마가 아는 최신 이름 (실리태번 화면에 없어도)');
    assert.deepEqual(ids.slice(1, 1 + LM.KNOWN.openai.length), [...LM.KNOWN.openai]);
    assert.ok(ids.includes('gpt-6-sol') && ids.includes('gpt-4o'), '실리태번 화면 목록');
    assert.equal(ids.at(-1), 'gpt-old-saved', '대상 확장이 지금 쓰는 모델은 목록에 없어도 넣음');
    for (const bad of ['dall-e-3', 'text-embedding-3-small', 'gpt-4o-mini-tts', 'custom', 'OR_Website']) assert.ok(!ids.includes(bad), bad);
    assert.equal(new Set(ids).size, ids.length, '중복 없음');
    // OpenRouter 화면의 '웹사이트에서 고르기'
    reset({ selects: { model_openrouter_select: ['OR_Website', 'openai/gpt-6.1-sol', 'x/old:batch'] } });
    const or = MS.modelOptions('openrouter');
    assert.ok(!or.includes('OR_Website') && !or.includes('x/old:batch'));
    assert.equal(or[0], LM.KNOWN.openrouter[0]);
});
await test('받은 목록이 있으면 그것만(새것 먼저) + 모델 등록 + 대상의 지금 모델 — 옛 이름 · 최신 이름 표로 부풀리지 않음', () => {
    reset({
        ext: { model_register: { sources: { openai: ['my-gpt'] }, picks: {} }, ...translatorOn('openai', 'gpt-old-saved') },
        selects: { model_openai_select: ['gpt-4o', 'gpt-3.5-turbo'] },
    });
    LM.put('openai', [{ id: 'gpt-7', created: 300 }, { id: 'gpt-6.1-sol', created: 200 }, { id: 'gpt-6-sol', created: 100 }]);
    assert.deepEqual(MS.modelOptions('openai'), ['gpt-7', 'gpt-6.1-sol', 'gpt-6-sol', 'my-gpt', 'gpt-old-saved']);
    // MiniMax (실리태번이 목록을 안 받음): 실리태번의 8개 + 대상 모델 — 테마가 아는 이름을 더하지 않는다
    const MINIMAX = ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1', 'MiniMax-M2.1-highspeed', 'MiniMax-M2', 'MiniMax-M2-her'];
    reset({ selects: { model_minimax_select: MINIMAX } });
    assert.deepEqual(MS.modelOptions('minimax'), MINIMAX);
    assert.equal(LM.KNOWN.minimax, undefined);
});
await test('Custom: 주소 칸이 비면 실리태번 주소 목록 + 대상 확장이 쓰는 주소의 목록 · 아무도 안 쓰는 옛 주소는 안 넣음 · 주소를 넣으면 그 주소만', () => {
    const lists = {
        'http://other.test/v1': { models: ['other-2', 'other-1'], fetchedAt: '2026-10-01T00:00:00.000Z' },
        'http://unused.test/v1': { models: ['stale-x'], fetchedAt: '2026-09-01T00:00:00.000Z' },
    };
    reset({
        ext: {
            model_switch: { lists: { 'http://127.0.0.1:5001/v1': { models: ['relay-b', 'relay-a'], fetchedAt: '2026-10-05T00:00:00.000Z' } } },
            ...translatorOn('custom', 'custom', { custom_models: { custom: 'other-1' }, custom_url: 'http://other.test/v1', custom_model_lists: lists }),
        },
        selects: { model_custom_select: ['st-page-model'] },
    });
    const empty = MS.modelOptions('custom');
    assert.deepEqual(empty, ['relay-b', 'relay-a', 'other-2', 'other-1'], '예전에 설정에 둔 목록(model_switch.lists)도 읽음 · 받은 목록이 있으면 화면 목록은 안 붙임');
    assert.ok(!empty.includes('stale-x'));
    const typed = MS.modelOptions('custom', { url: 'http://other.test/v1/' });
    assert.deepEqual(typed, ['other-2', 'other-1'], '다른 주소면 실리태번 화면의 Custom 목록도 안 넣음');
    assert.deepEqual(MS.modelOptions('custom', { url: ST_URL }), ['relay-b', 'relay-a', 'other-1'], '실리태번 주소 · 대상 모델은 끝에');
    // 받은 목록이 없는 주소: 실리태번 주소면 화면의 Custom 목록, 다른 주소면 대상 모델만
    delete T.ext.model_switch.lists['http://127.0.0.1:5001/v1'];
    assert.deepEqual(MS.modelOptions('custom', { url: ST_URL }), ['st-page-model', 'other-1']);
    assert.deepEqual(MS.modelOptions('custom', { url: 'http://new.test/v1' }), ['other-1']);
    // 새로 받은 목록이 예전 목록보다 앞선다
    LM.put(ST_KEY, ['relay-new']);
    assert.deepEqual(MS.modelOptions('custom', { url: ST_URL }).slice(0, 2), ['relay-new', 'other-1']);
    assert.equal(MS.hasModelList('custom'), true);
    assert.equal(MS.hasModelList('custom', 'http://nothing.test/v1'), false);
    assert.equal(MS.listUrlOf(''), 'http://127.0.0.1:5001/v1');
    assert.equal(MS.listUrlOf(' http://a.test/v1// '), 'http://a.test/v1');
});
await test('google ↔ makersuite: 번역의 google 대상 모델도 Google AI Studio 목록에', () => {
    reset({ ext: translatorOn('google', 'gemini-old-pro'), selects: { model_google_select: ['gemini-2.5-pro', 'gemini-2.5-flash-preview-tts'] } });
    const ids = MS.modelOptions('makersuite');
    assert.equal(ids[0], LM.KNOWN.makersuite[0]);
    assert.ok(ids.includes('gemini-old-pro') && !ids.includes('gemini-2.5-flash-preview-tts'));
});

// ---------- 2) ↻
await test('↻: 목록을 주는 공급자 모두 · 못 받는 까닭 · Custom 은 실리태번 주소만 (저장된 키는 설정한 주소에만)', async () => {
    reset();
    assert.equal(MS.fetchBlock('openrouter'), '');
    assert.equal(MS.fetchBlock('makersuite'), '', 'Google AI Studio 도 (ST /status)');
    assert.match(MS.fetchBlock('claude'), /목록을 받아 오지 않아요/);
    assert.match(MS.fetchBlock('minimax'), /목록을 받아 오지 않아요/);
    assert.match(MS.fetchBlock('deepseek'), /키를 먼저/, '키가 비어 있으면 묻지 않음');
    assert.equal(MS.fetchBlock('mistralai'), '', '키 상태를 모르면 서버에 맡김');
    assert.equal(MS.fetchBlock('custom'), '');
    assert.equal(MS.fetchBlock('custom', ST_URL), '');
    assert.match(MS.fetchBlock('custom', 'http://typed.test/v1'), /Custom 연결 주소를 먼저/);
    T.cs.custom_url = '';
    assert.match(MS.fetchBlock('custom'), /주소를 먼저 넣어/);
    await assert.rejects(MS.refreshModels('custom', 'http://typed.test/v1'), (e) => e.blocked === true);
    await assert.rejects(MS.refreshModels('claude'), (e) => e.blocked === true);
    assert.equal(calls.length, 0, '막힌 ↻ 는 요청하지 않음');
    // 5.7.1 본체 리버스 프록시가 있어도 키가 없으면 묻지 않음 — 바꾸는 애드온들은 본체 프록시로 보내지 않아 목록도 직접 연결의 것
    reset({ cs: { chat_completion_source: 'deepseek', reverse_proxy: 'https://proxy.test', proxy_password: 'pw' } });
    assert.match(MS.fetchBlock('deepseek'), /키를 먼저/);
});
await test('↻ Custom: 요청 본문이 1.0.5 와 글자까지 같음 · 받은 목록은 localStorage 에만 (설정의 model_switch.lists 는 그대로)', async () => {
    const legacy = { 'http://127.0.0.1:5001/v1': { models: ['relay-a'], fetchedAt: '2026-10-01T00:00:00.000Z' } };
    reset({ ext: { model_switch: { lists: structuredClone(legacy) } } });
    for (const headers of ['X-H: 1', '', undefined, 'Authorization: {{x}}\nY: "q"']) {
        T.cs.custom_include_headers = headers;
        LM._resetForTest(); calls = [];
        reply = answer({ data: [{ id: 'relay-1' }, { id: 'relay-2' }, { id: 'custom' }] });
        const ids = await MS.refreshModels('custom');
        assert.deepEqual(ids, ['relay-2', 'relay-1']);
        assert.equal(calls.length, 1);
        assert.equal(calls[0].url, '/api/backends/chat-completions/status');
        assert.equal(calls[0].init.method, 'POST');
        assert.deepEqual(calls[0].init.headers, { 'Content-Type': 'application/json', 'X-CSRF-Token': 'tok' });
        assert.equal(calls[0].init.body, oldCustomBody('http://127.0.0.1:5001/v1', T.cs), `본문 (헤더 ${JSON.stringify(headers)})`);
    }
    // 주소 칸에 실리태번 주소를 그대로 적어도 같은 본문
    LM._resetForTest(); calls = [];
    await MS.refreshModels('custom', 'http://127.0.0.1:5001/v1///');
    assert.equal(calls[0].init.body, oldCustomBody('http://127.0.0.1:5001/v1', T.cs));
    assert.deepEqual(T.ext.model_switch.lists, legacy, '설정(settings.json)에는 쓰지 않음 — 폰 동기화');
    const stored = JSON.parse(globalThis.localStorage.data.bl_live_models_v1);
    assert.deepEqual(stored[ST_KEY].ids, ['relay-2', 'relay-1'], '이 브라우저의 공용 캐시');
    assert.deepEqual(MS.modelOptions('custom').slice(0, 2), ['relay-2', 'relay-1'], '새로 받은 목록이 예전 목록 대신');
});
await test('↻ 그 밖의 공급자: 실리태번 /status · 새것 먼저 · 채팅 아닌 모델 뺌 · 실패하면 예전 목록 그대로', async () => {
    reset();
    reply = answer({ data: [{ id: 'gpt-6-sol', created: 2 }, { id: 'dall-e-3', created: 9 }, { id: 'gpt-7', created: 5 }, { id: 'text-embedding-3-large', created: 7 }] });
    assert.deepEqual(await MS.refreshModels('openai'), ['gpt-7', 'gpt-6-sol']);
    assert.equal(calls[0].init.body, '{"chat_completion_source":"openai"}');
    reply = answer({ data: [{ id: 'gemini-4-pro' }] });
    await MS.refreshModels('makersuite');
    assert.equal(calls[1].init.body, '{"chat_completion_source":"makersuite"}', '번역의 google 은 makersuite 로');
    // 5.7.1 본체가 이 공급자에 리버스 프록시를 써도 따르지 않음 (프록시 목록이 번역기 · 다시 쓰기 칸에 섞이지 않게)
    reset({ cs: { chat_completion_source: 'openai', reverse_proxy: 'https://proxy.test', proxy_password: 'pw' } });
    reply = answer({ data: [{ id: 'gpt-6-sol' }] });
    await MS.refreshModels('openai');
    assert.equal(calls[0].init.body, '{"chat_completion_source":"openai"}');
    // 실패
    LM.put('openai', ['gpt-6.1-sol']);
    reply = answer({ error: true }, 400);
    await assert.rejects(MS.refreshModels('openai'), (e) => e.status === 400);
    reply = answer({ error: true, data: { data: [] } });
    await assert.rejects(MS.refreshModels('openai'), (e) => e.empty === true);
    assert.deepEqual(MS.modelOptions('openai'), ['gpt-6.1-sol'], '예전 목록 그대로');
});

// ---------- 3) 조용히 다시 받기
await test('불러오기만으로는 통신하지 않음 · 목록 그리기도 통신 없음', () => {
    assert.equal(importHits, 0);
    reset({ ext: translatorOn('openai', 'gpt-x') });
    const before = fetchHits;
    MS.modelOptions('openai'); MS.modelOptions('custom'); MS.hasModelList('openrouter'); MS.fetchBlock('openai'); MR.suggestions('claude');
    assert.equal(fetchHits, before);
});
await test('창을 열 때 · 공급자를 바꿀 때: 하루 안 · 키 없음 · 목록 없는 공급자 · 새로 친 Custom 주소는 안 물음 · 실패해도 조용히 + 기다림', async () => {
    reset();
    reply = answer({ data: [{ id: 'm1' }] });
    assert.deepEqual(await MS.autoModels('openrouter'), ['m1'], '목록 없음 + 키 있음');
    assert.equal(await MS.autoModels('openrouter'), null, '하루 안');
    assert.equal(await MS.autoModels('deepseek'), null, '키 없음');
    assert.equal(await MS.autoModels('claude'), null, '목록 없는 공급자');
    assert.equal(await MS.autoModels('minimax'), null);
    assert.equal(await MS.autoModels('custom', 'http://typed.test/v1'), null, '새로 친 주소로 키가 가지 않게');
    assert.equal(calls.length, 1);
    assert.deepEqual(await MS.autoModels('custom'), ['m1'], '실리태번 Custom 주소');
    assert.equal(calls[1].init.body, oldCustomBody('http://127.0.0.1:5001/v1', T.cs), '조용히 받을 때도 같은 본문');
    assert.deepEqual(await MS.autoModels('custom', ST_URL), null, '하루 안');
    // 같은 목록을 받는 중이면 하나로
    reset();
    let release;
    reply = () => new Promise(resolve => { release = () => resolve(answer({ data: [{ id: 'g1' }] })()); });
    const a = MS.autoModels('openai'), b = MS.autoModels('openai'), c = MS.refreshModels('openai');
    await new Promise(r => setTimeout(r, 0));
    release();
    assert.deepEqual(await a, ['g1']); assert.deepEqual(await b, ['g1']); assert.deepEqual(await c, ['g1']);
    assert.equal(calls.length, 1, '요청 하나');
    // 오래된 목록 → 다시
    LM.put('openai', ['gpt-old'], { at: Date.now() - DAY - 5 });
    reply = answer({ data: [{ id: 'gpt-new' }] });
    assert.deepEqual(await MS.autoModels('openai'), ['gpt-new']);
    // 실패 → null · 예전 목록 그대로 · 기다리는 동안 안 물음
    LM.put('openrouter', ['or-old'], { at: Date.now() - DAY - 5 });
    reply = answer({ error: true }, 500);
    const n = calls.length;
    assert.equal(await MS.autoModels('openrouter'), null);
    assert.equal(await MS.autoModels('openrouter'), null);
    assert.equal(calls.length, n + 1);
    assert.deepEqual(MS.modelOptions('openrouter'), ['or-old']);
});
await test('목록이 바뀌면 알림 (창이 다시 그림): 받은 뒤 · 다른 확장이 받은 목록도', async () => {
    reset();
    const seen = [];
    const off = LM.onChange((e) => seen.push(e.source));
    reply = answer({ data: [{ id: 'm' }] });
    await MS.refreshModels('openrouter');
    await MS.autoModels('custom');
    LM.put('openai', ['x']);
    off();
    assert.deepEqual(seen, ['openrouter', 'custom', 'openai']);
});

// ---------- 4) 모델 등록 제안
await test('모델 등록 제안: 공용 목록 가운데 실리태번 목록 · 등록한 목록에 없는 것만 (새것 먼저)', () => {
    reset({
        ext: { model_register: { sources: { claude: ['claude-mine'] }, picks: {} } },
        selects: { model_claude_select: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-mine'] },
    });
    const claude = MR.suggestions('claude');
    assert.deepEqual(claude.slice(0, 2), ['claude-sonnet-5-5', 'claude-opus-5-5'], '실리태번 화면에 아직 없는 새 모델');
    for (const have of ['claude-sonnet-5', 'claude-opus-4-8', 'claude-mine']) assert.ok(!claude.includes(have), have);
    LM.put('openai', [{ id: 'gpt-7', created: 3 }, { id: 'gpt-6-sol', created: 2 }]);
    T.selects.model_openai_select = ['gpt-6-sol'];
    assert.deepEqual(MR.suggestions('openai'), ['gpt-7']);
    assert.deepEqual(MR.suggestions('minimax'), [], 'MiniMax: 실리태번 목록 밖의 이름을 지어내지 않음');
});

// ---------- 5) 요청 규칙
await test('모델 전환 · 모델 등록에는 생성 요청이 없다 — 모델별 요청 규칙 사본이 없음 (공용 applyModelRequestRules 하나)', async () => {
    for (const file of ['addons/modelswitch/index.js', 'addons/modelswitch/targets.js', 'addons/modelswitch/discover.js', 'addons/models/panel.js', 'addons/models/inject.js']) {
        const text = await fs.readFile(path.join(srcDir, file), 'utf8');
        assert.ok(!/applyModelRequestRules|max_completion_tokens/.test(text), file);
        if (file.startsWith('addons/modelswitch/')) assert.ok(!/getRequestHeaders|chat-completions\/status/.test(text), `${file}: 목록 요청은 공용 모듈로`);
    }
    const state = await fs.readFile(path.join(srcDir, 'addons/models/state.js'), 'utf8');
    assert.ok(!/live-models/.test(state), 'state.js 는 live-models.js 를 불러오지 않는다 (맨 위 await 순환)');
});

console.log(`\nmodelswitch-models: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
