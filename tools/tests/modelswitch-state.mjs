// 모델 전환 1.1.1 — 상태 칩 (src/addons/modelswitch/state.js · targets.js stateRead/stateApply)
//   node tools/tests/modelswitch-state.mjs <테마 루트>   (공개 저장소는 '.')
// 실리태번 모듈(script.js · extensions.js · secrets.js · openai.js · popup.js)은 data: 스텁, jQuery 는 부른 것을 적는 가짜. 네트워크 없음.
// 확인하는 것:
//   1) 지금 상태 통째로: 대상마다 공급자 · 모델 · 주소, 아는 확장은 연결 방식(mode)까지 — 따름이어도 직접 연결 칸의 값을 같이
//   2) 되돌리기: 지금과 같은 대상은 안 씀 · 다른 대상만 그 대상의 apply 로 (모델 먼저 → 공급자 change 나중) · 그다음 연결 방식만 원래 값으로
//   3) 「↶ 직전」: 바꾸기 직전 상태(실제로 바뀐 대상만) — 누르면 그 전으로, 한 번 더 누르면 제자리
//   4) 자동으로 찾은 확장 · 연결 방식을 모르는 확장: 공급자 · 모델만 (반쪽 원 표시 = limited) · 따름이던 줄은 못 돌림으로 셈
//   5) 저장 꼴 걸러내기 (states ≤8 · 망가진 last 지움) · 칩 요약 · 요술봉 메뉴는 그대로 전체 창
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__msStateTest = { ext: {}, cs: {}, names: [] };
T.names.includes = () => true;   // 따로 설치하는 아는 확장(폴더)은 모두 깔려 있는 셈
const G = 'const T = globalThis.__msStateTest;\n';
const ST = {
    'script.js': js(`export const chat = [];
export const event_types = { ONLINE_STATUS_CHANGED: 'online_status_changed' };
export const eventSource = { on() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() {}
export async function saveSettings() {}`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = T.names;
export function getContext() { return { chatCompletionSettings: T.cs }; }`),
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

globalThis.fetch = async () => { throw new Error('시험 중 네트워크 요청'); };
const element = () => ({ hidden: false, dataset: {}, style: {}, children: [], append(...n) { this.children.push(...n); }, replaceChildren(...n) { this.children = n; }, querySelector: () => null, addEventListener() {} });
globalThis.document = Object.assign(new EventTarget(), { body: element(), activeElement: null, createElement: element, getElementById: () => null });
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// 화면 알림 (prompt · assets 의 다시 그리기, 레지스트리)
globalThis.window = new EventTarget();
const events = [];
for (const type of ['bl:prompt-connection-changed', 'bl:assets-pick-changed', 'bl:model-switch-targets']) window.addEventListener(type, () => events.push(type));
// 가짜 jQuery: 있는 칸(dom) · 부른 순서(log). trigger 때 설정을 찍어 둔다 — 공급자 change 가 불릴 때 모델이 이미 들어가 있어야 한다
const dom = new Set();
let log = [];
globalThis.jQuery = (sel) => ({
    length: [...dom].some(d => sel === d || sel.startsWith(`${d} `)) ? 1 : 0,
    val(v) { log.push(['val', sel, v]); return this; },
    trigger(type) { log.push(['trigger', sel, type, structuredClone(T.ext)]); return this; },
});

const S = await import(pathToFileURL(path.join(srcDir, 'addons/modelswitch/state.js')).href);
const MS = await import(pathToFileURL(path.join(srcDir, 'addons/modelswitch/targets.js')).href);
const menu = await import(pathToFileURL(path.join(srcDir, 'addons/modelswitch/menu.js')).href);

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}

const RELAY = 'https://relay.test/v1';
// 평소: 번역만 중계(custom) · 나머지는 deepseek (사용자 설정과 같은 꼴, 이름은 일반 예시)
function usual() {
    return {
        salty: { addons: { translator: true, rewrite: true, prompt: true, assets: true } },
        'llm-translator-custom': { connection_mode: 'direct', llm_provider: 'custom', llm_model: 'relay-flash', custom_url: RELAY, provider_model_history: { custom: 'relay-flash', deepseek: 'deepseek-old' } },
        ban_word_rewrite: { connection: 'direct', provider: 'deepseek', models: { deepseek: 'deepseek-pro', custom: 'relay-flash' }, customModels: {}, customUrl: RELAY },
        memoria: { apiMode: 'direct', direct: { source: 'deepseek', models: { deepseek: 'deepseek-pro' }, customModels: {}, customUrl: RELAY } },
        'prompt-panel': { connectionMode: 'direct', provider: 'deepseek', model: 'deepseek-pro', customModelName: '', customUrl: RELAY },
        esetham: { pick: { enabled: true, connection: 'direct', provider: 'deepseek', models: { deepseek: 'deepseek-pro' }, customModels: {}, customUrl: RELAY } },
    };
}
function reset(ext = usual()) {
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    Object.assign(T.ext, structuredClone(ext));
    for (const k of Object.keys(T.cs)) delete T.cs[k];
    T.names.length = 0;
    dom.clear(); log = []; events.length = 0;
    for (const id of ['vtts']) MS.registry.unregister(`ext:${id}`);
}
// 스스로 등록한 확장 (연결 방식을 모르는 쪽 — stateRead 없음): engine 'st' 면 따름
function registerVoice(cfg) {
    const calls = [];
    MS.registry.register({
        id: 'vtts', name: '음성 분석', sources: null,
        read: () => cfg.engine === 'st' ? { follow: '지금 연결' } : { source: cfg.provider, model: cfg.models[cfg.provider] || '', url: '' },
        apply: ({ source, model }) => { calls.push([source, model]); cfg.engine = 'provider'; cfg.provider = source; cfg.models[source] = model; },
    });
    return calls;
}
// 6.2.9 검열되면 다른 모델로: 「<이름> (검열되면)」 대상은 처음엔 꺼 둔다 — 일괄 바꾸기 · 상태 칩은 켰을 때만 (index.js isOn · inState).
//       이 시험의 「모든 대상」은 화면에서 처음 켜져 있는 대상 (꺼 둔 대상은 아래 따로 본다)
const listNow = () => MS.listTargets().filter(t => !t.defaultOff);
const byId = id => MS.listTargets().find(t => t.id === id);
const preset = { source: 'vertexai', model: 'vertex-flash', url: '' };
assert.deepEqual(MS.listTargets().filter(t => t.defaultOff).map(t => t.id).filter(id => id.endsWith('-fallback')).sort(),
    MS.listTargets().filter(t => t.id.endsWith('-fallback') && !t.external).map(t => t.id).sort(), '(검열되면) 대상은 모두 처음엔 꺼 둠');
// index.js applyNow 와 같은 길: 체크한 대상마다 바꾸기 전 한 줄을 남기고 apply → 실제로 바뀐 대상만 「↶ 직전」
async function applyAll(d, only = () => true) {
    const before = [];
    for (const t of listNow()) {
        if (!only(t) || !MS.supports(t, d.source)) continue;
        before.push([t, S.entryOf(t)]);
        await t.apply(d);
    }
    return S.changedSince(before);
}
// apply · stateApply 부른 횟수 (지금과 같은 대상은 쓰지 않아야 한다)
function spy() {
    const hits = {}, orig = new Map();
    for (const t of listNow()) {
        const apply = t.apply;
        orig.set(t, apply);
        t.apply = function (...a) { hits[t.id] = (hits[t.id] || 0) + 1; return apply.apply(this, a); };
    }
    return { hits, restore() { for (const [t, apply] of orig) t.apply = apply; } };
}

// ---------- 1) 지금 상태 통째로
await test('지금 상태: 대상마다 공급자 · 모델 · 주소 + 아는 확장은 연결 방식(mode) — read() 결과는 예전 그대로', () => {
    reset();
    registerVoice({ engine: 'provider', provider: 'deepseek', models: { deepseek: 'deepseek-pro' } });
    const targets = listNow();
    assert.deepEqual(targets.map(t => t.id), ['translator', 'prompt', 'memory', 'rewrite', 'assets', 'ext:vtts']);
    // read() 는 고치기 전 코드와 같은 값 (공용 함수로 옮긴 것뿐)
    assert.deepEqual(byId('translator').read(), { source: 'custom', model: 'relay-flash', url: RELAY });
    assert.deepEqual(byId('rewrite').read(), { source: 'deepseek', model: 'deepseek-pro', url: '' });
    assert.deepEqual(byId('memory').read(), { source: 'deepseek', model: 'deepseek-pro', url: '' });
    assert.deepEqual(byId('prompt').read(), { source: 'deepseek', model: 'deepseek-pro', url: '' });
    assert.deepEqual(byId('assets').read(), { source: 'deepseek', model: 'deepseek-pro', url: '' });
    const items = S.captureState(targets);
    assert.deepEqual(items.translator, { name: '번역', source: 'custom', model: 'relay-flash', url: RELAY, mode: 'direct' });
    assert.deepEqual(items.memory, { name: byId('memory').name, source: 'deepseek', model: 'deepseek-pro', url: '', mode: 'direct' });
    assert.deepEqual(items['ext:vtts'], { name: '음성 분석', source: 'deepseek', model: 'deepseek-pro', url: '' }, '연결 방식을 모르는 확장은 mode 없음');
    assert.equal(S.summary(items), 'deepseek-pro · relay-flash', '많이 쓰는 모델 먼저');
    assert.equal(S.limited(items), false, '모두 직접 연결 — 공급자 · 모델로 그대로 돌아옴');
    assert.ok(S.isCurrent(items, targets));
    // 따름이던 아는 확장: 직접 연결 칸의 값도 같이 (되돌릴 때 그 칸까지 원래대로)
    T.ext.ban_word_rewrite.connection = 'profile';
    assert.deepEqual(byId('rewrite').read(), { follow: '연결 프로필' });
    assert.deepEqual(S.entryOf(byId('rewrite')), { name: '다시 쓰기', source: 'deepseek', model: 'deepseek-pro', url: '', follow: '연결 프로필', mode: 'profile' });
    // include: 자동 · 처음엔 꺼 두는 대상은 켰을 때만 (index.js inState)
    const only = S.captureState(targets, t => t.id !== 'ext:vtts');
    assert.ok(!('ext:vtts' in only) && 'translator' in only);
});

// ---------- 2) · 3) 되돌리기 · 「↶ 직전」
await test('중계가 죽어 모두 공식으로 → 「↶ 직전」 한 번에 원래대로 (번역만 중계 · 나머지 deepseek) → 한 번 더 누르면 다시 공식', async () => {
    reset();
    const voice = { engine: 'provider', provider: 'deepseek', models: { deepseek: 'deepseek-pro' } };
    registerVoice(voice);
    const usualItems = S.captureState(listNow());
    const last = await applyAll(preset);
    assert.deepEqual(Object.keys(last), ['translator', 'prompt', 'memory', 'rewrite', 'assets', 'ext:vtts'], '바뀐 대상 모두 「직전」에');
    assert.equal(last.translator.model, 'relay-flash');
    assert.ok(!S.isCurrent(usualItems, listNow()));
    for (const t of listNow()) assert.deepEqual(t.read(), { source: 'vertexai', model: 'vertex-flash', url: '' }, t.id);

    const r = await S.runRestore(S.planRestore(last, listNow()));
    assert.deepEqual(r.done, listNow().map(t => t.name));
    assert.deepEqual(r.done.slice(0, 2), ['번역', '한글화 패널']);
    assert.deepEqual([r.partial, r.failed, r.same], [[], [], 0]);
    assert.deepEqual(byId('translator').read(), { source: 'custom', model: 'relay-flash', url: RELAY });
    assert.equal(T.ext['llm-translator-custom'].provider_model_history.custom, 'relay-flash');
    assert.deepEqual(byId('rewrite').read(), { source: 'deepseek', model: 'deepseek-pro', url: '' });
    assert.ok(S.isCurrent(usualItems, listNow()), '저장한 「평소」 칩이 다시 켜짐');
    assert.deepEqual(r.touched.map(t => t.id), Object.keys(last));
    // 새 「직전」 = 방금 되돌리기 전 (공식) → 누르면 다시 공식, 또 누르면 평소
    assert.deepEqual(Object.values(r.before).map(e => e.model), Array(6).fill('vertex-flash'));
    const back = await S.runRestore(S.planRestore(r.before, listNow()));
    assert.equal(back.done.length, 6);
    assert.deepEqual(byId('memory').read(), { source: 'vertexai', model: 'vertex-flash', url: '' });
    const again = await S.runRestore(S.planRestore(back.before, listNow()));
    assert.equal(again.done.length, 6);
    assert.ok(S.isCurrent(usualItems, listNow()));
});

await test('지금과 같은 대상은 쓰지 않는다 · 체크한 대상만 바꿨으면 「직전」도 그 대상만', async () => {
    reset();
    registerVoice({ engine: 'provider', provider: 'deepseek', models: { deepseek: 'deepseek-pro' } });
    const usualItems = S.captureState(listNow());
    // 번역만 체크를 뺀 채(체크 반전 전) 공식으로 — 번역은 그대로 중계
    const last = await applyAll(preset, t => t.id !== 'translator');
    assert.ok(!('translator' in last));
    assert.deepEqual(byId('translator').read(), { source: 'custom', model: 'relay-flash', url: RELAY });
    // 같은 모델로 한 번 더 바꾸면 바뀐 게 없음 → 「직전」을 덮지 않을 빈 결과
    assert.deepEqual(await applyAll(preset, t => t.id !== 'translator'), {});
    const s = spy();
    try {
        const plan = S.planRestore(usualItems, listNow());
        assert.deepEqual(plan.map(p => p.kind), ['same', 'write', 'write', 'write', 'write', 'write']);
        assert.deepEqual(plan.map(p => p.via || ''), ['', 'state', 'state', 'state', 'state', 'apply']);
        const r = await S.runRestore(plan);
        assert.equal(r.same, 1);
        assert.equal(s.hits.translator, undefined, '번역은 이미 평소 그대로 — 안 씀');
        assert.deepEqual(Object.keys(s.hits).sort(), ['assets', 'ext:vtts', 'memory', 'prompt', 'rewrite']);
        assert.deepEqual(Object.keys(r.before).sort(), ['assets', 'ext:vtts', 'memory', 'prompt', 'rewrite']);
    } finally { s.restore(); }
});

await test('쓰는 순서: 모델 먼저 → 공급자 change → (따름이었으면) 연결 방식은 그다음 — 번역 · 다시 쓰기 화면이 열려 있을 때', async () => {
    reset();
    T.ext['llm-translator-custom'].connection_mode = 'current';
    T.ext.ban_word_rewrite.connection = 'profile';
    const saved = S.captureState(listNow());
    assert.equal(saved.translator.mode, 'current');
    assert.equal(saved.translator.follow, '지금 연결');
    await applyAll(preset);
    assert.equal(T.ext['llm-translator-custom'].connection_mode, 'direct', '바꾸기는 예전처럼 직접 연결로');
    for (const sel of ['#llm_provider', '#llm_connection_mode', '#llm_custom_url', '#bwr_provider', '#bwr_connection', '#bwr_custom_url']) dom.add(sel);
    log = [];
    const r = await S.runRestore(S.planRestore(saved, listNow()));
    assert.ok(r.done.includes('번역') && r.done.includes('다시 쓰기'), JSON.stringify(r));
    // 번역: 연결 방식(직접) → 주소 → 공급자 change(그때 모델이 이미 그 공급자 칸에) → 연결 방식 원래대로(지금 연결)
    const tr = log.filter(x => x[1].startsWith('#llm_'));
    assert.deepEqual(tr.map(x => x.slice(0, 3)), [
        ['val', '#llm_connection_mode', 'direct'], ['trigger', '#llm_connection_mode', 'change'],
        ['val', '#llm_custom_url', RELAY],
        ['val', '#llm_provider', 'custom'], ['trigger', '#llm_provider', 'change'],
        ['val', '#llm_connection_mode', 'current'], ['trigger', '#llm_connection_mode', 'change'],
    ]);
    const atProvider = tr.find(x => x[0] === 'trigger' && x[1] === '#llm_provider')[3]['llm-translator-custom'];
    assert.equal(atProvider.provider_model_history.custom, 'relay-flash', '공급자 change 때 모델이 이미 들어가 있음');
    assert.equal(atProvider.llm_model, 'relay-flash');
    const tset = T.ext['llm-translator-custom'];
    assert.deepEqual([tset.connection_mode, tset.llm_provider, tset.llm_model, tset.custom_url], ['current', 'custom', 'relay-flash', RELAY]);
    // 다시 쓰기: 직접 칸 클릭 → 공급자 change(모델 먼저) → 프로필 칸 클릭
    const rw = log.filter(x => x[1].startsWith('#bwr_') && x[0] === 'trigger').map(x => x[1]);
    assert.deepEqual(rw, ['#bwr_connection .bwr_seg[data-value="direct"]', '#bwr_provider', '#bwr_connection .bwr_seg[data-value="profile"]']);
    const rwAt = log.find(x => x[0] === 'trigger' && x[1] === '#bwr_provider')[3].ban_word_rewrite;
    assert.equal(rwAt.models.deepseek, 'deepseek-pro');
    assert.equal(T.ext.ban_word_rewrite.connection, 'profile');
    assert.deepEqual(byId('rewrite').read(), { follow: '연결 프로필' });
    assert.ok(S.isCurrent(saved, listNow()));
});

await test('기억 · 한글화 패널 · 캐릭터 에셋: 연결 방식까지 원래대로 (프로필 특수 공급자는 연결 방식만) · 화면 다시 그리기 알림', async () => {
    reset();
    T.ext.memoria.apiMode = 'st';
    Object.assign(T.ext['prompt-panel'], { connectionMode: 'profile', provider: '__st_profile__', model: '' });
    T.ext.esetham.pick.connection = 'profile';
    const saved = S.captureState(listNow());
    assert.equal(saved.memory.follow, '연결 프로필');
    assert.equal(saved.prompt.mode, 'profile');
    await applyAll(preset);
    assert.equal(T.ext.memoria.apiMode, 'direct');
    events.length = 0;
    const r = await S.runRestore(S.planRestore(saved, listNow()));
    assert.deepEqual(r.failed, []);
    assert.equal(T.ext.memoria.apiMode, 'st');
    assert.equal(T.ext.memoria.direct.source, 'deepseek', '직접 연결 칸도 원래 값');
    assert.equal(T.ext['prompt-panel'].connectionMode, 'profile');
    assert.equal(T.ext.esetham.pick.connection, 'profile');
    assert.ok(events.includes('bl:prompt-connection-changed') && events.includes('bl:assets-pick-changed'));
    assert.ok(S.isCurrent(saved, listNow()));
});

// ---------- 4) 공급자 · 모델만 되돌리는 대상
function fakeTarget(id, state, { stays = false, sources = null } = {}) {
    return {
        id, name: id, auto: id.startsWith('auto:'), sources, state, writes: 0,
        read() { return state.mode === 'st' ? { follow: '지금 연결', source: state.source, model: state.model, url: '', stays } : { source: state.source, model: state.model, url: '' }; },
        apply({ source, model }) { this.writes++; if (!stays) state.mode = 'direct'; state.source = source; state.model = model; },
    };
}
await test('자동으로 찾은 확장 · 연결 방식을 모르는 확장: 공급자 · 모델만 — 반쪽 원(limited) · 따름이던 줄은 공급자 · 모델만 돌아옴', async () => {
    const auto = fakeTarget('auto:ext.analysis', { mode: 'direct', source: 'deepseek', model: 'deepseek-pro' });
    const follow = fakeTarget('ext:other', { mode: 'st', source: 'openai', model: 'gpt-x' });
    const items = S.captureState([auto, follow]);
    assert.equal(S.limited({ 'auto:ext.analysis': items['auto:ext.analysis'] }), true, '자동으로 찾은 대상은 늘 표시');
    assert.equal(S.limited({ 'ext:other': items['ext:other'] }), true, '따름이던 줄 (연결 방식을 모름)');
    assert.equal(S.limited({ x: { source: 'openai', model: 'm', follow: '지금 연결', mode: 'current' } }), false, '아는 확장은 연결 방식까지 돌아옴');
    // 바꾸기 → 둘 다 직접 연결 vertexai
    auto.apply(preset); follow.apply(preset);
    const r = await S.runRestore(S.planRestore(items, [auto, follow]));
    assert.deepEqual(r.done, ['auto:ext.analysis'], '직접 연결이던 자동 대상은 그대로 돌아옴');
    assert.deepEqual(r.partial, ['ext:other'], '따름이던 대상은 공급자 · 모델만 (연결 방식은 지금 그대로)');
    assert.deepEqual([follow.state.source, follow.state.model, follow.state.mode], ['openai', 'gpt-x', 'direct']);
    // 둘 다 따름이면 같다고 본다 — apply 가 연결 방식을 직접으로 바꿔 버리지 않게 안 씀
    const f2 = fakeTarget('ext:f2', { mode: 'st', source: 'openai', model: 'gpt-x' });
    const saved2 = S.captureState([f2]);
    f2.state.model = 'gpt-y';
    assert.equal(S.planRestore(saved2, [f2])[0].kind, 'same');
    // 공급자 · 모델을 모르는 따름 줄(지금 연결만)은 직접 연결이 된 뒤엔 못 돌림
    const bare = { id: 'ext:bare', name: '맨 따름', cfg: { st: true }, read() { return this.cfg.st ? { follow: '지금 연결' } : { source: 'openai', model: 'm', url: '' }; }, apply() { this.cfg.st = false; } };
    const saved3 = S.captureState([bare]);
    bare.apply();
    const r3 = await S.runRestore(S.planRestore(saved3, [bare]));
    assert.deepEqual(r3.failed, ['맨 따름']);
});

await test('없어진 대상 · 못 쓰는 공급자 · 던지는 apply: 그 대상만 「못 바꿈」, 나머지는 씀', async () => {
    const a = fakeTarget('ext:a', { mode: 'direct', source: 'openai', model: 'm1' });
    const b = fakeTarget('ext:b', { mode: 'direct', source: 'openai', model: 'm1' }, { sources: ['deepseek'] });
    const c = fakeTarget('ext:c', { mode: 'direct', source: 'openai', model: 'm1' });
    const items = { ...S.captureState([a, b, c]), 'ext:gone': { name: '지운 확장', source: 'openai', model: 'm', url: '' } };
    a.state.model = 'changed'; b.state.model = 'changed'; c.state.model = 'changed';
    c.apply = () => { throw new Error('boom'); };
    const errors = [];
    const r = await S.runRestore(S.planRestore(items, [a, b, c]), job => job(), (target, error) => errors.push([target.id, error.message]));
    assert.deepEqual(r.done, ['ext:a']);
    assert.deepEqual(r.failed.sort(), ['ext:b', 'ext:c', '지운 확장']);
    assert.deepEqual(errors, [['ext:c', 'boom']]);
    assert.equal(a.state.model, 'm1');
});

await test('run(job) 으로 감싸서 쓴다 (index.js: 잠금을 풀고 쓰기) · 쓰는 동안만', async () => {
    reset();
    const saved = S.captureState(listNow());
    await applyAll(preset);
    let depth = 0, seen = 0;
    const wrap = async job => { depth++; try { return await job(); } finally { depth--; } };
    const t = byId('memory');
    const apply = t.apply;
    t.apply = async function (...a) { seen += depth; return apply.apply(this, a); };
    try { await S.runRestore(S.planRestore(saved, listNow()), wrap); }
    finally { t.apply = apply; }
    assert.equal(seen, 1);
    assert.equal(depth, 0);
});

// ---------- 5) 저장 꼴 · 요약 · 등록 길 · 요술봉
await test('저장 꼴 걸러내기: states 는 이름 + items 있는 것만 8개까지 · 망가진 last 는 지움 · 새 객체를 만들지 않음', () => {
    const good = i => ({ name: `s${i}`, items: { translator: { name: '번역', source: 'openai', model: 'm', url: '' } } });
    const list = [good(1), null, { name: 3 }, { name: 'x', items: [] }, ...Array.from({ length: 9 }, (_, i) => good(i + 2))];
    const s = S.keepStates({ states: list, last: { at: 1, items: {} } });
    assert.equal(s.states.length, 8);
    assert.equal(s.states[0], list[0], '같은 객체');
    assert.ok(!('last' in s), '빈 last 지움');
    const kept = S.keepStates({ last: { at: 2, items: { a: { source: 'x', model: 'y' } } } });
    assert.deepEqual(kept.states, []);
    assert.equal(kept.last.at, 2);
    assert.ok(!('last' in S.keepStates({})), '없던 last 를 만들지 않음');
    // 손으로 고친 줄도 안전하게 읽음
    assert.deepEqual(S.cleanEntry({ source: 'custom', model: ' m ', url: 'https://x.test/v1//', follow: '', mode: 7 }), { name: '', source: 'custom', model: 'm', url: 'https://x.test/v1' });
    assert.equal(S.cleanEntry('x'), null);
    assert.equal(S.planRestore({ a: 'junk' }, [])[0].kind, 'gone');
    assert.equal(S.MAX_STATES, 8);
});

await test('같음 판단: 따름이면 연결 방식만 · 직접이면 공급자 · 모델 (Custom 은 주소까지, 저장한 주소가 비면 주소는 안 봄)', () => {
    const e = (o) => S.cleanEntry({ name: 'n', ...o });
    assert.ok(S.sameEntry(e({ source: 'openai', model: 'a' }), e({ source: 'openai', model: 'a' })));
    assert.ok(!S.sameEntry(e({ source: 'openai', model: 'a' }), e({ source: 'openai', model: 'b' })));
    assert.ok(!S.sameEntry(e({ source: 'custom', model: 'a', url: 'https://a.test/v1' }), e({ source: 'custom', model: 'a', url: 'https://b.test/v1' })));
    assert.ok(S.sameEntry(e({ source: 'custom', model: 'a', url: '' }), e({ source: 'custom', model: 'a', url: 'https://b.test/v1' })));
    assert.ok(S.sameEntry(e({ follow: '지금 연결', mode: 'current', source: 'x' }), e({ follow: '지금 연결', mode: 'current', source: 'y' })));
    assert.ok(!S.sameEntry(e({ follow: '연결 프로필', mode: 'profile' }), e({ follow: '지금 연결', mode: 'current' })));
    assert.ok(!S.sameEntry(e({ follow: '지금 연결' }), e({ source: 'openai', model: 'a' })));
    assert.equal(S.summary({ k1: { model: 'x' }, k2: { model: 'y' }, k3: { model: 'y' }, k4: { follow: '지금 연결', model: 'z' } }), 'y · x · 지금 연결');
    assert.equal(S.summary(null), '');
});

await test('스스로 등록한 확장도 stateRead · stateApply 를 주면 연결 방식까지 (레지스트리가 그대로 넘김)', async () => {
    reset();
    const cfg = { engine: 'st', provider: 'openai', model: 'gpt-x' };
    MS.registry.register({
        id: 'vtts', name: '음성 분석',
        read: () => cfg.engine === 'st' ? { follow: '지금 연결' } : { source: cfg.provider, model: cfg.model, url: '' },
        apply: ({ source, model }) => { cfg.engine = 'provider'; cfg.provider = source; cfg.model = model; },
        stateRead: () => ({ source: cfg.provider, model: cfg.model, url: '', mode: cfg.engine }),
        stateApply: ({ source, model, mode }) => { if (source) { cfg.provider = source; cfg.model = model; } cfg.engine = mode; },
    });
    const t = byId('ext:vtts');
    assert.equal(typeof t.stateApply, 'function');
    const saved = S.captureState([t]);
    assert.equal(S.limited(saved), false);
    t.apply(preset);
    const r = await S.runRestore(S.planRestore(saved, [t]));
    assert.deepEqual(r.done, ['음성 분석']);
    assert.deepEqual(cfg, { engine: 'st', provider: 'openai', model: 'gpt-x' });
});

await test('요술봉 「모델 전환」은 그대로 전체 창을 연다 · 상태 칩은 창 안에만 (index.js 연결 · [hidden] 함정)', async () => {
    const made = [];
    const menuEl = { append: el => made.push(el) };
    let opened = 0;
    const doc = globalThis.document;
    globalThis.document = { getElementById: id => id === 'extensionsMenu' ? menuEl : made.find(el => el.id === id) || null, createElement: () => ({ setAttribute() {}, remove() {} }) };
    try {
        menu.syncModelSwitchMenu(true, () => opened++);
        assert.equal(made.length, 1);
        assert.match(made[0].innerHTML, /fa-shuffle.*모델 전환/);
        made[0].onclick();
        assert.equal(opened, 1, '누르면 전체 창(openPanel) 한 번');
    } finally { globalThis.document = doc; }
    const index = await fs.readFile(path.join(srcDir, 'addons/modelswitch/index.js'), 'utf8');
    assert.match(index, /syncModelSwitchMenu\([^)]*,\s*openPanel\)/, '요술봉 → openPanel 그대로');
    assert.match(index, /class="ms-states"/);
    assert.match(index, /data-act="snap"/);
    assert.match(index, /remember\(changedSince\(before\)\)/, '바꾸기도 「직전」을 남김');
    // 💾 저장: 찾기를 기다리는 동안 · 이름 창이 열린 동안 busy (두 번 눌러도 창 하나) — 끝나면(취소 포함) 풀고 다시 그림
    const saveFn = index.match(/async function saveState\(\) \{[\s\S]*?\n\}\n/)?.[0] || '';
    assert.match(saveFn, /^async function saveState\(\) \{\n    if \(busy[^\n]*\n    busy = true; render\(\);\n    try \{/, '💾 는 시작하자마자 busy');
    assert.match(saveFn, /\} finally \{ busy = false; render\(\); \}\n\}/, '끝나면 busy 를 풀고 다시 그림');
    assert.ok(saveFn.indexOf('busy = true') < saveFn.indexOf('callGenericPopup'), '이름 창보다 먼저 busy');
    // 상태 칩 다시 누름(바뀐 것 없음 · 같은 대상 있음)은 「이미 … 상태예요」 + 상태 줄만 — 못 돌리는 대상이 있어도 경고를 되풀이하지 않는다
    const applyFn = index.match(/async function applyState\(which\) \{[\s\S]*?\n\}\n/)?.[0] || '';
    assert.match(applyFn, /const retap = !done\.length && !partial\.length && same > 0;/, '다시 누름 판정');
    assert.match(applyFn, /retap \? `이미 「\$\{title\}」 상태예요` : ''/, '다시 누름이면 「이미 … 상태예요」');
    assert.match(applyFn, /if \(failed\.length && !retap\) globalThis\.toastr\?\.warning/, '경고는 다시 누름이 아닐 때만');
    const css = await fs.readFile(path.join(srcDir, 'addons/modelswitch/style.css'), 'utf8');
    assert.match(css, /\.ms-states:empty\{display:none\}/, '저장한 상태도 직전도 없으면 줄이 없다');
    assert.match(css, /\.ms-snap\[hidden\]\{display:none\}/, 'menu_button 의 display 가 [hidden] 을 이기지 않게');
});

await test('TTS 대사 분석(스스로 등록): 엔진(지금 연결 · 호환 주소)까지 저장 · 되돌림 — 화면 다시 그리기 알림', async () => {
    reset();
    T.ext.lemon_voice = { analysis: { enabled: true, engine: 'compat', provider: 'deepseek', provider_models: { deepseek: 'deepseek-pro' }, custom_url: '' } };
    const TTS = await import(pathToFileURL(path.join(srcDir, 'addons/tts/src/modelswitch.js')).href);
    const target = TTS.target();
    assert.equal(typeof target.stateRead, 'function');
    assert.deepEqual(target.read(), { follow: 'OpenAI 호환 주소' });
    assert.deepEqual(target.stateRead(), { source: 'deepseek', model: 'deepseek-pro', url: '', mode: 'compat' });
    const saved = S.captureState([target]);
    assert.equal(S.limited(saved), false, '엔진까지 돌아오니 반쪽 원 없음');
    target.apply(preset);
    assert.equal(T.ext.lemon_voice.analysis.engine, 'provider');
    const seen = [];
    const listen = e => seen.push(e.detail);
    document.addEventListener('tts:analysis', listen);
    try {
        const r = await S.runRestore(S.planRestore(saved, [target]));
        assert.deepEqual(r.done, ['TTS 대사 분석']);
    } finally { document.removeEventListener('tts:analysis', listen); }
    const a = T.ext.lemon_voice.analysis;
    assert.deepEqual([a.engine, a.provider, a.provider_models.deepseek, a.provider_models.vertexai], ['compat', 'deepseek', 'deepseek-pro', 'vertex-flash']);
    assert.ok(seen.length >= 1, '분석 카드 다시 그리기');
    // 직접(API 중 선택)이던 상태는 apply 그대로 — 엔진을 다시 쓰지 않음
    a.engine = 'provider'; a.provider = 'deepseek';
    const direct = S.captureState([target]);
    target.apply(preset);
    const r2 = await S.runRestore(S.planRestore(direct, [target]));
    assert.deepEqual(r2.done, ['TTS 대사 분석']);
    assert.equal(a.engine, 'provider');
    assert.equal(a.provider, 'deepseek');
});

console.log(`\nmodelswitch-state: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
