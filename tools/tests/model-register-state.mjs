// 모델 등록 — extension_settings.model_register 를 쓰는 길 (src/addons/models/state.js · offer.js pruneNative · index.js 옮김 알림)
//   node tools/tests/model-register-state.mjs <테마 루트>   (공개 저장소는 '.')
// 진짜 state.js · offer.js 를 부르고, 실리태번 모듈(script.js · extensions.js · secrets.js · openai.js · popup.js)만 data: 스텁. 네트워크 없음.
// 확인하는 것:
//   1) 처음 켤 때 옛 확장(vertexCustomModels) 설정을 한 번만 옮김 — 이름 다듬기 · 중복 빼기 · 고른 모델은 목록에 있을 때만 · 옛 설정은 그대로 둠
//   2) 이미 있는 설정: 다시 옮기지 않음 · 손으로 망가뜨린 칸은 빈 객체 · 빈 목록 · 목록에 없는 고른 모델은 지움 · 기본값 객체를 같이 쓰지 않음
//   3) setModels · rememberPick(사용자가 고른 것만 기억을 지움) · movePick(이름 바꾸기를 따라감)
//   4) 1.1.7 실리태번 기본 목록에 들어온 등록 정리를 진짜 설정에: 등록 · 고른 모델 · pruned 기록
//   5) 옮김 알림은 한 번만 (migrationNoticeShown 을 적고 저장)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(srcDir, rel)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__mrStateTest = { ext: {}, cs: {}, saves: 0, toasts: [] };
const G = 'const T = globalThis.__mrStateTest;\n';
const ST = {
    'script.js': js(G + `export const chat = [];
export const event_types = { APP_READY: 'app_ready', ONLINE_STATUS_CHANGED: 'online_status_changed' };
export const eventSource = { on() {}, once() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() { T.saves++; }
export async function saveSettings() {}`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return { chatCompletionSettings: T.cs }; }`),
    'secrets.js': js('export let secret_state = {};\nexport function setSecretState(s) { secret_state = s || {}; }'),
    'openai.js': js(G + 'export const oai_settings = T.cs;\nexport let model_list = [];'),
    'popup.js': js(`export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 }; export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup() { return null; }`),
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
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// offer.js → inject.js applyOne 이 찾는 실리태번 목록은 없는 셈 (화면 없음)
globalThis.document = { querySelector: () => null, getElementById: () => null, createElement: () => ({ append() {} }), baseURI: 'http://localhost/' };
globalThis.toastr = { info: m => T.toasts.push(['info', m]), success() {}, warning() {} };

const state = await import(url('addons/models/state.js'));
const offer = await import(url('addons/models/offer.js'));

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
function reset(ext = {}) {
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    Object.assign(T.ext, structuredClone(ext));
    T.saves = 0; T.toasts = [];
}
const store = () => T.ext.model_register;

// ---------- 1) 옛 확장에서 옮기기
await test('처음 켤 때 옛 확장(vertexCustomModels)에서 한 번 옮김: 이름 다듬기 · 중복 · 빈 값 빼기 · 고른 모델 · 옛 설정은 그대로', () => {
    const old = { models: [' gemini-alt ', 'gemini-side', '', 'gemini-alt', null, '  '], selectedModel: ' gemini-side ', extra: 'keep' };
    reset({ vertexCustomModels: old });
    const s = state.initSettings();
    assert.equal(s, store(), 'extension_settings.model_register 에 붙음');
    assert.deepEqual(s, { sources: { vertexai: ['gemini-alt', 'gemini-side'] }, picks: { vertexai: 'gemini-side' }, offered: {}, pruned: {}, migratedFrom: 'vertexCustomModels' });
    assert.equal(T.saves, 1, '새로 만들면 저장');
    assert.deepEqual(T.ext.vertexCustomModels, old, '옛 설정은 지우거나 고치지 않는다');
    // 두 번째 부름: 이미 있으니 다시 옮기지 않음 (옛 설정이 바뀌었어도)
    T.ext.vertexCustomModels.models.push('gemini-late');
    state.initSettings();
    assert.deepEqual(store().sources.vertexai, ['gemini-alt', 'gemini-side']);
    assert.equal(T.saves, 1, '있는 설정은 저장하지 않음');
});

await test('옛 설정의 고른 모델이 목록에 없으면 기억하지 않음 · 옛 목록이 비면 옮긴 표시 없음 · 옛 설정이 없으면 기본값', () => {
    reset({ vertexCustomModels: { models: ['gemini-alt'], selectedModel: 'gemini-gone' } });
    assert.deepEqual(state.initSettings(), { sources: { vertexai: ['gemini-alt'] }, picks: {}, offered: {}, pruned: {}, migratedFrom: 'vertexCustomModels' });
    reset({ vertexCustomModels: { models: [], selectedModel: 'gemini-alt' } });
    assert.deepEqual(state.initSettings(), { sources: {}, picks: {}, offered: {}, pruned: {} });
    reset({ vertexCustomModels: 'broken' });
    assert.deepEqual(state.initSettings(), { sources: {}, picks: {}, offered: {}, pruned: {} });
    reset();
    const first = state.initSettings();
    first.sources.openai = ['gpt-mine'];
    first.picks.openai = 'gpt-mine';
    delete T.ext.model_register;
    const second = state.initSettings();
    assert.deepEqual(second, { sources: {}, picks: {}, offered: {}, pruned: {} }, '기본값 객체를 같이 쓰지 않음 (얼린 기본값의 사본)');
    assert.notEqual(second.sources, first.sources);
});

// ---------- 2) 이미 있는 설정 다듬기
await test('이미 있는 설정: 다시 옮기지 않음 · 망가진 칸은 빈 객체 · 목록 다듬기 · 빈 목록 지움 · 목록에 없는 고른 모델 지움 · 다른 칸은 그대로', () => {
    reset({
        vertexCustomModels: { models: ['gemini-old'], selectedModel: 'gemini-old' },
        model_register: { sources: { claude: [' claude-mine ', 'claude-mine', 'claude-two'], openai: [], vertexai: 'x', custom: ['', null] },
            picks: { claude: ' claude-two ', openai: 'gpt-x', makersuite: 'gem' }, offered: ['x'], pruned: null, migratedFrom: 'vertexCustomModels', migrationNoticeShown: true },
    });
    const s = state.initSettings();
    assert.deepEqual(s.sources, { claude: ['claude-mine', 'claude-two'] }, '빈 목록 · 목록 아닌 값은 지움');
    assert.deepEqual(s.picks, { claude: 'claude-two' }, '목록에 없는 고른 모델은 지움');
    assert.deepEqual([s.offered, s.pruned], [{}, {}]);
    assert.equal(s.migrationNoticeShown, true, '모르는 칸은 그대로');
    assert.equal(T.saves, 0, '읽어 다듬기만 — 저장은 다음 변경 때');
    for (const broken of [{ sources: ['a'], picks: 'x' }, { sources: null, picks: [] }]) {
        reset({ model_register: broken });
        const b = state.initSettings();
        assert.deepEqual([b.sources, b.picks, b.offered, b.pruned], [{}, {}, {}, {}], JSON.stringify(broken));
    }
    assert.deepEqual(state.modelsOf('nothing'), []);
    assert.equal(state.pickOf('nothing'), '');
});

// ---------- 3) 목록 · 고른 모델
await test('setModels: 다듬어 통째로 바꿈 · 빈 목록이면 공급자 칸을 지움 · 고른 모델이 빠지면 기억도 지움 · 남으면 그대로 · 저장', () => {
    reset({ model_register: { sources: { claude: ['claude-a', 'claude-b'] }, picks: { claude: 'claude-b' } } });
    state.initSettings();
    assert.deepEqual(state.setModels('claude', [' claude-b ', 'claude-c', 'claude-b']), ['claude-b', 'claude-c']);
    assert.deepEqual(store().sources.claude, ['claude-b', 'claude-c']);
    assert.equal(store().picks.claude, 'claude-b', '남으면 그대로');
    assert.equal(T.saves, 1);
    state.setModels('claude', ['claude-c']);
    assert.ok(!('claude' in store().picks), '빠지면 기억도 지움');
    state.setModels('claude', []);
    assert.ok(!('claude' in store().sources), '빈 목록이면 칸을 지움');
    assert.equal(T.saves, 3);
});

await test('rememberPick: 등록한 이름은 기억 (같으면 저장 안 함) · 실리태번이 스스로 바꾼 값은 기억을 안 지움 · 사용자가 고른 다른 모델이면 지움', () => {
    reset({ model_register: { sources: { vertexai: ['gemini-alt', 'gemini-side'] }, picks: {} } });
    state.initSettings();
    state.rememberPick('vertexai', ' gemini-side ');
    assert.equal(state.pickOf('vertexai'), 'gemini-side');
    assert.equal(T.saves, 1);
    state.rememberPick('vertexai', 'gemini-side');
    assert.equal(T.saves, 1, '같으면 저장 안 함');
    state.rememberPick('vertexai', 'gemini-native');
    state.rememberPick('vertexai', '');
    assert.equal(state.pickOf('vertexai'), 'gemini-side', '실리태번이 목록을 다시 채우며 고른 값은 무시');
    assert.equal(T.saves, 1);
    state.rememberPick('vertexai', 'gemini-native', { fromUser: true });
    assert.equal(state.pickOf('vertexai'), '', '사용자가 실리태번 모델을 고르면 기억을 지움');
    assert.equal(T.saves, 2);
    state.rememberPick('vertexai', 'gemini-native', { fromUser: true });
    assert.equal(T.saves, 2, '지울 기억이 없으면 저장 안 함');
});

await test('movePick: 고른 모델의 이름을 바꾸면 기억도 따라감 · 다른 이름이면 그대로 · 빈 이름이면 지움', () => {
    reset({ model_register: { sources: { openai: ['gpt-mine', 'gpt-two'] }, picks: { openai: 'gpt-mine' } } });
    state.initSettings();
    state.movePick('openai', 'gpt-two', 'gpt-three');
    assert.equal(state.pickOf('openai'), 'gpt-mine');
    assert.equal(T.saves, 0);
    state.movePick('openai', 'gpt-mine', '  gpt-renamed ');
    assert.equal(state.pickOf('openai'), 'gpt-renamed');
    state.movePick('openai', 'gpt-renamed', '   ');
    assert.ok(!('openai' in store().picks));
    assert.equal(T.saves, 2);
});

// ---------- 4) 기본 목록에 들어온 등록 정리 — 진짜 설정에
await test('1.1.7 pruneNative: 기본 목록에 들어온 등록은 빼고 pruned 에 적음 · 고른 모델이었으면 기억도 지움 · 다시 빠지면 되돌림 · 받아 오는 목록은 그대로', async () => {
    reset({ model_register: { sources: { claude: ['claude-now-native', 'claude-mine'], openrouter: ['route/native'] }, picks: { claude: 'claude-now-native' } } });
    state.initSettings();
    const lists = { claude: new Set(['claude-now-native', 'claude-base']), openrouter: new Set(['route/native']) };
    const changed = await offer.pruneNative(lists);
    assert.deepEqual(changed, [{ source: 'claude', gone: ['claude-now-native'], back: [] }]);
    assert.deepEqual(store().sources, { claude: ['claude-mine'], openrouter: ['route/native'] }, 'OpenRouter 는 받아 오는 목록이라 그대로');
    assert.deepEqual(store().pruned, { claude: ['claude-now-native'] });
    assert.ok(!('claude' in store().picks), '실리태번 목록의 제자리에서 고르면 되니 기억은 지움');
    assert.match(T.toasts.at(-1)?.[1] || '', /claude-now-native/);
    assert.ok(T.saves >= 2);
    lists.claude = new Set(['claude-base']);
    assert.deepEqual(await offer.pruneNative(lists), [{ source: 'claude', gone: [], back: ['claude-now-native'] }]);
    assert.deepEqual(store().sources.claude, ['claude-mine', 'claude-now-native'], '기본 목록에서 다시 빠지면 등록 끝으로 되돌림');
    assert.ok(!('claude' in store().pruned));
    const before = JSON.stringify(store());
    assert.deepEqual(await offer.pruneNative({}), [], '기본 목록을 못 읽은 공급자는 건드리지 않음');
    assert.equal(JSON.stringify(store()), before);
});

// ---------- 5) 옮김 알림
await test('옮겨 온 뒤 알림은 한 번만: migrationNoticeShown 을 적고 저장 · 옮긴 개수', () => {
    const source = read('src/addons/models/index.js');
    const at = source.indexOf('if (store.migratedFrom && !store.migrationNoticeShown) {');
    assert.ok(at >= 0, 'index.js 의 옮김 알림 갈래');
    let depth = 0, end = -1;
    for (let j = source.indexOf('{', at); j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}' && --depth === 0) { end = j + 1; break; }
    }
    const notices = [];
    // 그 갈래를 원문 그대로 함수로 감싸 진짜 state.js 의 saveSettings 와 함께 돌린다
    const run = new Function('store', 'saveSettings', 'toast', source.slice(at, end));
    reset({ vertexCustomModels: { models: ['gemini-alt', 'gemini-side'] } });
    const s = state.initSettings();
    const saves = T.saves;
    run(s, state.saveSettings, (kind, message) => notices.push([kind, message]));
    assert.equal(s.migrationNoticeShown, true);
    assert.equal(T.saves, saves + 1, '적고 저장');
    assert.equal(notices.length, 1);
    assert.match(notices[0][1], /모델 2개를 옮겨 왔어요/);
    run(s, state.saveSettings, (kind, message) => notices.push([kind, message]));
    assert.equal(notices.length, 1, '두 번째 로딩부터는 안 알림');
    const fresh = { ...s, migratedFrom: undefined, migrationNoticeShown: undefined };
    run(fresh, state.saveSettings, (kind, message) => notices.push([kind, message]));
    assert.equal(notices.length, 1, '옮긴 적이 없으면 안 알림');
});

console.log(`\nmodel-register-state: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
