// 모델 전환 — extension_settings.model_switch 를 쓰는 길 (src/addons/modelswitch/index.js · state.js · lock.js)
//   node tools/tests/modelswitch-store.mjs <테마 루트>   (공개 저장소는 '.')
// index.js 는 화면 · 실리태번 전역을 잔뜩 쓰므로 통째로 부르지 않고, 확인할 함수만 원문 그대로 잘라 임시 모듈로 돌린다
// (translation-source.mjs 와 같은 방식). targets.js · state.js · lock.js · rows.js 는 진짜 모듈, 실리태번 모듈만 data: 스텁. 네트워크 없음.
// 확인하는 것:
//   1) store(): 없으면 만들고 · 손으로 망가뜨린 칸은 기본값 · 조합은 이름/공급자/모델이 글자인 것만 8개 · 잠금은 true 만 · 옛 Custom 목록(lists) 보존 · 같은 객체
//   2) 조합 저장(이름 20자 · 같은 이름은 덮어씀 · 취소는 안 씀) · 지금 조합 지우기
//   3) 상태 칩: 저장(평소 → 상태 N · 자동/처음엔 꺼 둔 대상은 켰을 때만 · 8개까지 · 취소) · 누르기(설정 되돌림 · 「↶ 직전」) · 다시 누름 · 지우기
//   4) 바꾸기: 「↶ 직전」엔 실제로 바뀐 대상의 바꾸기 전 값만 · 못 쓰는 공급자는 건너뜀 · 바뀐 게 없으면 예전 직전 그대로
//   5) 잠금: 켠 대상 중 화면을 아는 확장만 body 클래스로 · 끄면 모두 풂
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
// 기록 확장의 설치 폴더 이름은 targets.js 의 그 대상에서 읽는다 (시험 글에 이름을 적지 않는다)
const MEMORY_FOLDER = 'mem-ext';   // 7.8.4: 기억 확장 폴더는 해시로 찾고, 시험은 setMemoryFolderForTest 로 지어낸 이름
const srcDir = path.join(root, 'src');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(srcDir, rel)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__msStoreTest = { ext: {}, cs: {}, names: [], saves: 0, popups: [], answers: [], renders: [], events: [], toasts: [], onPopup: null };
const G = 'const T = globalThis.__msStoreTest;\n';
const ST = {
    'script.js': js(G + `export const chat = [];
export const event_types = { ONLINE_STATUS_CHANGED: 'online_status_changed', SETTINGS_UPDATED: 'settings_updated' };
export const eventSource = { on() {}, once() {}, makeLast() {}, emit() {}, removeListener() {} };
export const substituteParams = (t) => String(t ?? '');
export function getRequestHeaders() { return {}; }
export function saveSettingsDebounced() { T.saves++; }
export async function saveSettings() {}`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = T.names;
export function getContext() { return { chatCompletionSettings: T.cs }; }`),
    'secrets.js': js('export let secret_state = {};\nexport function setSecretState(s) { secret_state = s || {}; }'),
    'openai.js': js(G + 'export const oai_settings = T.cs;\nexport let model_list = [];'),
    'popup.js': js(G + `export const POPUP_TYPE = { TEXT: 'text', CONFIRM: 'confirm', INPUT: 'input' };
export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup(content, type, value) { T.popups.push({ content, type, value }); T.onPopup?.(content); return T.answers.length ? T.answers.shift() : null; }`),
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
const bodyClasses = new Set();
globalThis.document = Object.assign(new EventTarget(), {
    body: Object.assign(element(), { classList: { toggle: (name, on) => { if (on) bodyClasses.add(name); else bodyClasses.delete(name); } } }),
    activeElement: null, createElement: element, getElementById: () => null,
});
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = new EventTarget();
window.addEventListener('st:model-switch-applied', e => T.events.push(e.detail));
globalThis.toastr = { success: m => T.toasts.push(['success', m]), warning: m => T.toasts.push(['warning', m]), info() {} };

// ---------- index.js 에서 함수를 원문 그대로 잘라 임시 모듈로
const source = read('src/addons/modelswitch/index.js');
function closeOf(open, what) {
    let depth = 0;
    for (let j = open; j < source.length; j++) {
        if (source[j] === '{') depth++;
        else if (source[j] === '}' && --depth === 0) return j + 1;
    }
    throw new Error('괄호 짝이 안 맞음: ' + what);
}
function cut(name, kind = 'function') {
    const start = source.indexOf(`\n${kind} ${name}(`);
    assert.ok(start >= 0, 'index.js 에 없음: ' + name);
    return source.slice(start + 1, closeOf(source.indexOf(') {', start) + 2, name));
}
const line = re => { const m = source.match(re); assert.ok(m, 'index.js 에 없음: ' + re); return m[0].trim(); };
// 「이 조합 지우기」는 클릭 처리기 안의 한 갈래 — 그 갈래의 몸통을 그대로 함수로 감싼다
function branch(marker) {
    const at = source.indexOf(marker);
    assert.ok(at >= 0, 'index.js 에 없음: ' + marker);
    const open = source.indexOf('{', at);
    return source.slice(open + 1, closeOf(open, marker) - 1);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-ms-store-'));
let M, S;
try {
    const modulePath = path.join(tmp, 'modelswitch-store-cut.mjs');
    fs.writeFileSync(modulePath, `import { callGenericPopup, POPUP_TYPE } from ${JSON.stringify(ST['popup.js'])};
import { extension_settings } from ${JSON.stringify(ST['extensions.js'])};
import { saveSettingsDebounced } from ${JSON.stringify(ST['script.js'])};
import { SOURCES } from ${JSON.stringify(url('addons/models/sources.js'))};
import { listTargets, shownTargets, linkable, supports, discoverTargets, setMemoryFolderForTest } from ${JSON.stringify(url('addons/modelswitch/targets.js'))};
setMemoryFolderForTest('mem-ext');   // 7.8.4: 기억 확장 폴더는 해시로 찾으므로 시험은 지어낸 이름
import { setLocks, withoutLock } from ${JSON.stringify(url('addons/modelswitch/lock.js'))};
import { MAX_STATES, entryOf, captureState, changedSince, planRestore, isCurrent, runRestore, limited, summary, keepStates } from ${JSON.stringify(url('addons/modelswitch/state.js'))};
import { toggleGroup, groupOn, fallbackOnly, rowActive, isFallbackRow, displayGroups } from ${JSON.stringify(url('addons/modelswitch/rows.js'))};
const T = globalThis.__msStoreTest;
// 화면은 시험 밖: 다시 그리기는 그때의 busy · note 만 적는다. 3초 기다림이 프로세스를 붙잡지 않게 unref
const render = () => { T.renders.push({ busy, note }); };
const openPanel = () => {};
const setTimeout = (fn, ms) => { const t = globalThis.setTimeout(fn, ms); t.unref?.(); return t; };
${line(/\nconst MAX_PRESETS = [^\n]+/)}
${line(/\nconst esc = [^\n]+/)}
${line(/\nconst label = [^\n]+/)}
${line(/\nlet root,[^\n]+/)}
${cut('store')}
${line(/\nconst armed = [^\n]+/)}
${line(/\nconst canArm = [^\n]+/)}
${line(/\nconst isOn = [^\n]+/)}
${line(/\nconst inState = [^\n]+/)}
${cut('syncLocks')}
${line(/\nconst cleanUrl = [^\n]+/)}
${cut('remember')}
${cut('applyNow', 'async function')}
${cut('savePreset', 'async function')}
${cut('saveState', 'async function')}
${cut('applyState', 'async function')}
${cut('deleteState', 'async function')}
function removePreset() {${branch("else if (act === 'remove') {")}}
export { store, syncLocks, applyNow, savePreset, saveState, applyState, deleteState, removePreset };
export const peek = () => ({ busy, note });
export function resetState() { busy = false; note = ''; armed.clear(); }
`);
    M = await import(pathToFileURL(modulePath).href);
    S = await import(url('addons/modelswitch/state.js'));
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}

// 지어낸 설정: 번역은 중계(custom) · 다시 쓰기 · 한글화 패널은 deepseek
const RELAY = 'https://relay.test/v1';
function usual(extra = {}) {
    return {
        salty: { addons: { translator: true, rewrite: true, prompt: true } },
        'llm-translator-custom': { connection_mode: 'direct', llm_provider: 'custom', llm_model: 'relay-flash', custom_url: RELAY, provider_model_history: { custom: 'relay-flash' } },
        ban_word_rewrite: { connection: 'direct', provider: 'deepseek', models: { deepseek: 'deepseek-main' }, customModels: {}, customUrl: RELAY },
        'prompt-panel': { connectionMode: 'direct', provider: 'deepseek', model: 'deepseek-main', customModelName: '', customUrl: RELAY },
        ...extra,
    };
}
function reset(ext = usual(), names = []) {
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    Object.assign(T.ext, structuredClone(ext));
    T.names.length = 0;
    T.names.push(...names);
    Object.assign(T, { saves: 0, popups: [], answers: [], renders: [], events: [], toasts: [], onPopup: null });
    bodyClasses.clear();
    M.resetState();
}
const tr = () => T.ext['llm-translator-custom'];
const rw = () => T.ext.ban_word_rewrite;
const preset = (name, model = 'm', source = 'openai') => ({ name, source, model, url: '' });

// ---------- 1) store()
await test('store(): 없으면 만듦 (대상 · 조합 · 입력칸 · 옛 목록 · 잠금 · 상태) — 직전은 만들지 않음', () => {
    reset();
    const s = M.store();
    assert.equal(T.ext.model_switch, s, 'extension_settings.model_switch 에 붙음');
    assert.deepEqual(s, { targets: {}, presets: [], draft: { source: 'custom', model: '', url: '' }, lists: {}, lock: false, states: [] });
    assert.equal(M.store(), s, '다시 불러도 같은 객체');
    assert.equal(T.saves, 0, '읽기만으로는 저장하지 않음');
});

await test('store(): 손으로 망가뜨린 칸은 기본값 · 조합은 글자 칸이 다 있는 것만 8개 · 잠금은 true 만 · 옛 Custom 목록 · 좋은 값은 같은 객체 그대로', () => {
    const good = Array.from({ length: 10 }, (_, i) => preset(`조합${i}`, `model-${i}`));
    const lists = { [RELAY]: ['relay-flash'] };
    const targets = { translator: false };
    const draft = { source: 'deepseek', model: 'deepseek-main', url: '' };
    reset({ ...usual(), model_switch: { targets, presets: [null, { name: 1, source: 'x', model: 'y' }, { name: 'a', source: 'b' }, ...good], draft, lists, lock: 'true',
        states: [{ name: '평소', items: { translator: { name: '번역', source: 'custom', model: 'relay-flash', url: RELAY } } }, { name: 2, items: {} }, null], last: { at: 1, items: {} } } });
    const s = M.store();
    assert.equal(s.targets, T.ext.model_switch.targets, '대상 체크는 같은 객체');
    assert.deepEqual(s.targets, { translator: false });
    assert.deepEqual(s.presets.map(p => p.name), good.slice(0, 8).map(p => p.name), '망가진 조합은 빼고 8개까지');
    assert.equal(s.draft, T.ext.model_switch.draft);
    assert.deepEqual(s.lists, { [RELAY]: ['relay-flash'] }, '옛 Custom 주소별 목록은 읽기용으로 그대로');
    assert.equal(s.lock, false, "'true' 글자는 잠금이 아님");
    assert.deepEqual(s.states.map(x => x.name), ['평소']);
    assert.ok(!('last' in s), '빈 직전은 지움');
    for (const broken of [{ targets: 'x', presets: 'x', draft: 'x', lists: ['x'], lock: 1 }, { targets: null, presets: null, draft: null, lists: null, lock: true }]) {
        reset({ ...usual(), model_switch: structuredClone(broken) });
        const b = M.store();
        assert.deepEqual([b.targets, b.presets, b.draft, b.lists], [{}, [], { source: 'custom', model: '', url: '' }, {}], JSON.stringify(broken));
        assert.equal(b.lock, broken.lock === true);
    }
});

// ---------- 2) 조합
await test('조합 저장: 모델이 비면 묻지 않음 · 이름 기본값(중계/공식) · 이름 20자 · 모델 · 주소 다듬음 · 같은 이름은 그 자리에 덮어씀 · 취소는 안 씀', async () => {
    reset();
    const s = M.store();
    s.draft = { source: 'custom', model: '   ', url: '' };
    await M.savePreset();
    assert.equal(T.popups.length, 0);
    assert.match(M.peek().note, /모델 이름을 먼저/);
    s.draft = { source: 'custom', model: ' relay-flash ', url: ` ${RELAY} ` };
    T.answers = ['  아주아주아주아주긴이름의중계조합이름입니다  '];
    await M.savePreset();
    assert.deepEqual(T.popups.at(-1), { content: '이 조합의 이름', type: 'input', value: '중계' });
    assert.deepEqual(s.presets, [{ name: '아주아주아주아주긴이름의중계조합이름입니', source: 'custom', model: 'relay-flash', url: RELAY }], '이름은 20자까지');
    assert.equal(T.saves, 1);
    s.draft = { source: 'deepseek', model: 'deepseek-main', url: '' };
    T.answers = ['공식'];
    await M.savePreset();
    assert.equal(T.popups.at(-1).value, '공식');
    s.draft = { source: 'deepseek', model: 'deepseek-next', url: '' };
    T.answers = ['공식'];
    await M.savePreset();
    assert.deepEqual(s.presets.map(p => [p.name, p.model]), [[s.presets[0].name, 'relay-flash'], ['공식', 'deepseek-next']], '같은 이름은 그 자리에서 바뀜');
    const saves = T.saves, before = JSON.stringify(s.presets);
    for (const answer of [false, null, '   ']) { T.answers = [answer]; await M.savePreset(); }
    assert.equal(JSON.stringify(s.presets), before, '취소 · 닫기 · 빈 이름');
    assert.equal(T.saves, saves);
});

await test('지금 조합 지우기: 공급자 · 모델 · 주소가 모두 같은 조합만 (주소 빈칸 = 없음)', () => {
    reset({ ...usual(), model_switch: { presets: [preset('하나', 'm1'), { ...preset('둘', 'm1'), url: RELAY }, preset('셋', 'm2'), { name: '넷', source: 'openai', model: 'm1' }] } });
    const s = M.store();
    s.draft = { source: 'openai', model: 'm1', url: '' };
    M.removePreset();
    assert.deepEqual(s.presets.map(p => p.name), ['둘', '셋'], '주소가 다른 조합은 남음 · url 없던 옛 조합도 같은 것으로');
    assert.equal(T.saves, 1);
    s.draft = { source: 'openai', model: 'm1', url: RELAY };
    M.removePreset();
    assert.deepEqual(s.presets.map(p => p.name), ['셋']);
});

// ---------- 3) 상태 칩
await test('상태 저장: 모든 대상의 지금 값 · 처음엔 꺼 둔 「(검열되면)」은 켰을 때만 · 이름 평소 → 상태 N · 같은 이름은 덮어씀 · 취소 · 8개까지', async () => {
    reset();
    T.answers = ['평소'];
    await M.saveState();
    assert.equal(T.popups.at(-1).value, '평소', '첫 이름 제안');
    const s = M.store();
    assert.equal(s.states.length, 1);
    assert.deepEqual(Object.keys(s.states[0].items).sort(), ['prompt', 'rewrite', 'translator'], '(검열되면) 줄은 켜지 않아서 빠짐');
    assert.deepEqual(s.states[0].items.translator, { name: '번역', source: 'custom', model: 'relay-flash', url: RELAY, mode: 'direct' });
    assert.equal(T.saves, 1);
    assert.match(M.peek().note, /「평소」 저장 · 3개/);
    assert.equal(M.peek().busy, false);
    assert.equal(T.renders[0].busy, true, '이름 창이 열린 동안은 busy');
    s.targets['translator-fallback'] = true;   // 직접 켠 (검열되면) 줄은 담는다
    T.answers = [' 출근 '];
    await M.saveState();
    assert.equal(T.popups.at(-1).value, '상태 2');
    assert.equal(s.states[1].name, '출근');
    assert.ok('translator-fallback' in s.states[1].items);
    rw().models.deepseek = 'deepseek-next';
    T.answers = ['평소'];
    await M.saveState();
    assert.equal(s.states.length, 2, '같은 이름은 덮어씀');
    assert.equal(s.states[0].items.rewrite.model, 'deepseek-next');
    const saves = T.saves;
    for (const answer of [false, null, '  ']) { T.answers = [answer]; await M.saveState(); }
    assert.equal(s.states.length, 2);
    assert.equal(T.saves, saves, '취소는 저장 없음');
    assert.equal(M.peek().busy, false, '취소해도 busy 풀림');
    while (s.states.length < S.MAX_STATES) s.states.push({ name: `채움${s.states.length}`, items: { translator: s.states[0].items.translator } });
    const popups = T.popups.length;
    await M.saveState();
    assert.equal(T.popups.length, popups, '8개면 묻지 않음');
});

await test('상태 누르기: 설정을 그 상태로 · 「↶ 직전」 = 누르기 직전(바뀐 대상만) · 직전을 누르면 그 전으로 · 다시 누르면 「이미」 · 화면 다시 그리기 알림', async () => {
    reset();
    T.answers = ['평소'];
    await M.saveState();
    const s = M.store();
    // 중계가 죽어 모두 공식으로 바꿈 (번역 · 다시 쓰기만)
    s.draft = { source: 'vertexai', model: 'vertex-flash', url: '' };
    s.targets.prompt = false;
    await M.applyNow();
    assert.deepEqual([tr().llm_provider, tr().llm_model, rw().provider, rw().models.vertexai], ['vertexai', 'vertex-flash', 'vertexai', 'vertex-flash']);
    assert.deepEqual(Object.keys(s.last.items).sort(), ['rewrite', 'translator'], '체크한 대상만 직전에');
    T.events = []; T.toasts = [];
    let saves = T.saves;
    await M.applyState('0');
    assert.equal(T.saves, saves + 1, '누르면 설정 저장');
    assert.deepEqual([tr().llm_provider, tr().llm_model, tr().custom_url], ['custom', 'relay-flash', RELAY], '번역은 중계로');
    assert.deepEqual([rw().provider, rw().models.deepseek], ['deepseek', 'deepseek-main']);
    assert.match(M.peek().note, /→ 「평소」/);
    assert.equal(T.events.length, 2, '쓴 대상마다 다시 그리라는 알림');
    assert.deepEqual(T.toasts, [], '다 됐으면 알림창 없음');
    assert.deepEqual(Object.keys(s.last.items).sort(), ['rewrite', 'translator']);
    assert.equal(s.last.items.translator.model, 'vertex-flash', '새 직전 = 누르기 직전(공식)');
    await M.applyState('last');
    assert.equal(tr().llm_model, 'vertex-flash', '직전을 누르면 공식으로');
    assert.equal(s.last.items.translator.model, 'relay-flash', '한 번 더 누르면 제자리로 갈 직전');
    await M.applyState('last');
    assert.equal(tr().llm_model, 'relay-flash');
    T.events = [];
    const lastBefore = s.last;
    await M.applyState('0');
    assert.match(M.peek().note, /이미 「평소」 상태예요/);
    assert.deepEqual(T.events, [], '같은 상태면 안 씀');
    assert.equal(s.last, lastBefore, '바뀐 게 없으면 직전 그대로');
    saves = T.saves;
    const note = M.peek().note;
    await M.applyState('7');
    assert.deepEqual([M.peek().busy, M.peek().note, T.saves], [false, note, saves], '없는 칩은 아무것도 안 함');
});

await test('상태 누르기: 없어진 대상은 「못 바꿈」 + 경고 (다시 누름이면 경고 되풀이 안 함)', async () => {
    reset();
    T.answers = ['평소'];
    await M.saveState();
    const s = M.store();
    s.states[0].items['ext:gone'] = { name: '지운 확장', source: 'openai', model: 'gpt-x', url: '' };
    rw().models.deepseek = 'deepseek-next';
    T.toasts = [];
    await M.applyState('0');
    assert.equal(rw().models.deepseek, 'deepseek-main');
    assert.match(M.peek().note, /못 바꿈: 지운 확장/);
    assert.equal(T.toasts.length, 1);
    assert.equal(T.toasts[0][0], 'warning');
    await M.applyState('0');
    assert.match(M.peek().note, /이미 「평소」 상태예요/);
    assert.equal(T.toasts.length, 1, '다시 누름이면 상태 줄만');
});

await test('상태 지우기: 확인하면 그 칩만 (확인창 사이에 순서가 바뀌어도 같은 칩) · 아니오면 그대로 · 이름은 이스케이프', async () => {
    reset({ ...usual(), model_switch: { states: [{ name: '<b>평소</b>', items: { a: { source: 'x', model: 'y' } } }, { name: '출근', items: { a: { source: 'x', model: 'z' } } }] } });
    const s = M.store();
    T.answers = [false];
    await M.deleteState(1);
    assert.equal(s.states.length, 2);
    assert.equal(T.saves, 0);
    T.answers = [true];
    await M.deleteState(0);
    assert.match(T.popups.at(-1).content, /「&lt;b&gt;평소&lt;\/b&gt;」 지울까요/);
    assert.deepEqual(s.states.map(x => x.name), ['출근']);
    assert.equal(T.saves, 1);
    // 확인창이 열린 사이에 (다른 창에서) 앞 칩이 지워져도 고른 칩을 지운다 — 순서가 아니라 그 칩으로 다시 찾음
    s.states.unshift({ name: '앞', items: { a: { source: 'x', model: 'w' } } });
    T.onPopup = () => { s.states.splice(0, 1); };
    T.answers = [true];
    await M.deleteState(1);
    T.onPopup = null;
    assert.deepEqual(s.states, [], '「출근」을 지움 (순서로 지우면 남는다)');
    await M.deleteState(5);
    assert.equal(T.popups.length, 3, '없는 칩은 묻지 않음');
});

// ---------- 4) 바꾸기의 「↶ 직전」
await test('바꾸기: Custom 주소 끝 / 다듬음 · 직전엔 바꾸기 전 값 · 못 쓰는 공급자는 건너뜀 · 바뀐 게 없으면 예전 직전 그대로', async () => {
    reset();
    const s = M.store();
    s.draft = { source: 'custom', model: ' relay-pro ', url: `${RELAY}///` };
    await M.applyNow();
    assert.deepEqual([tr().llm_model, tr().custom_url], ['relay-pro', RELAY]);
    assert.deepEqual([rw().provider, rw().models.custom, rw().customUrl], ['custom', 'relay-pro', RELAY]);
    assert.deepEqual(Object.keys(s.last.items).sort(), ['prompt', 'rewrite', 'translator']);
    assert.deepEqual(s.last.items.translator, { name: '번역', source: 'custom', model: 'relay-flash', url: RELAY, mode: 'direct' });
    assert.equal(typeof s.last.at, 'number');
    const last = s.last;
    s.draft = { source: 'pollinations', model: 'poll-x', url: '' };   // 번역 · 다시 쓰기 · 한글화 패널 모두 못 쓰는 공급자
    await M.applyNow();
    assert.match(M.peek().note, /바뀐 확장 없음/);
    assert.match(M.peek().note, /못 바꿈: /);
    assert.equal(s.last, last, '바뀐 게 없으면 예전 직전 그대로');
    assert.equal(tr().llm_model, 'relay-pro');
    s.draft = { source: 'custom', model: '', url: '' };
    const saves = T.saves;
    await M.applyNow();
    assert.equal(T.saves, saves, '모델이 비면 아무것도 안 함');
});

// ---------- 5) 잠금
await test('잠금: 켠 대상 중 화면을 아는 확장(번역 · 다시 쓰기 · 한글화 패널 · 기록 확장)만 · 체크를 빼면 풀림 · 잠금 끄면 모두 풂', () => {
    reset(usual({ memoria: { apiMode: 'direct', direct: { source: 'deepseek', models: { deepseek: 'deepseek-main' }, customModels: {}, customUrl: '' } } }), ['third-party/' + MEMORY_FOLDER]);
    const s = M.store();
    M.syncLocks();
    assert.deepEqual([...bodyClasses], [], '잠금 꺼짐');
    s.lock = true;
    s.targets['translator-fallback'] = true;   // (검열되면) 줄은 잠글 화면이 없다
    M.syncLocks();
    assert.deepEqual([...bodyClasses].sort(), ['bl-ms-lock-memory', 'bl-ms-lock-prompt', 'bl-ms-lock-rewrite', 'bl-ms-lock-translator']);
    s.targets.translator = false;
    M.syncLocks();
    assert.deepEqual([...bodyClasses].sort(), ['bl-ms-lock-memory', 'bl-ms-lock-prompt', 'bl-ms-lock-rewrite']);
    s.lock = false;
    M.syncLocks();
    assert.deepEqual([...bodyClasses], []);
    s.lock = 'yes';
    assert.equal(M.store().lock, false, 'store() 가 true 가 아닌 값을 끔');
});

console.log(`\nmodelswitch-store: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
