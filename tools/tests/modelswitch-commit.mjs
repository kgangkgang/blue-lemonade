// 모델 전환 「(검열되면)」 켜기 — 사용자 설정에 실제로 쓰는 길 (src/addons/modelswitch/index.js · targets.js · fallback.js)
//   node tools/tests/modelswitch-commit.mjs <테마 루트>   (공개 저장소는 '.')
// index.js 는 화면 · 실리태번 전역을 잔뜩 쓰므로 통째로 부르지 않고, 확인할 함수만 원문 그대로 잘라 임시 모듈로 돌린다
// (translation-source.mjs 와 같은 방식). 그 함수가 부르는 targets.js · fallback.js · rows.js · lock.js · state.js 는 진짜 모듈,
// 실리태번 모듈(script.js · extensions.js · secrets.js · openai.js · popup.js)만 data: 스텁. 네트워크 없음.
// 확인하는 것:
//   1) 꺼진 「<이름> (검열되면)」 줄: 확인 → 공급자 · 모델 고름 → 켜기 = 그 확장 설정의 fallback 에만 저장 · 체크 켬 · 설정 저장 · 다시 그리라는 알림
//   2) 본 모델과 같음 · 빈 모델 · 못 쓰는 공급자 · 「안 함」 · 아니오 · 취소 · 두 번 누름 → 아무것도 안 씀 (창은 열린 채)
//   3) 스스로 등록한 확장이 표준 fallback 자리(settingsKey · path)만 선언했을 때: 그 자리에만 쓰고 같은 객체의 다른 칸은 그대로
//   4) 6.7.2 · 6.7.5 「검열되면」 단추: 일반 줄은 빼고 검열되면 줄만 · 꺼진 줄은 한 번 묻고 고름(armed) · 다시 누르면 모두 끔
//      → 「바꾸기」 때 고른 꺼진 줄은 위에서 고른 모델로 켬 (본 설정은 그대로) · 본 모델과 같으면 못 켬
//   5) 1.2.0 켜기 · 취소 단추: 실리태번 .menu_button{width:min-content} 때문에 한글이 한 글자씩 꺾이던 것 — 규칙 · VERSION = --ms-version
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const srcDir = path.join(root, 'src');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(srcDir, rel)).href;
const js = (src) => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__msCommitTest = { ext: {}, cs: {}, names: [], saves: 0, popups: [], answers: [], renders: [], events: [], toasts: [], opened: [] };
const G = 'const T = globalThis.__msCommitTest;\n';
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
export async function callGenericPopup(content, type, value) { T.popups.push({ content, type, value }); return T.answers.length ? T.answers.shift() : null; }`),
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-ms-commit-'));
let M, R, F, FF, MS;
try {
    const modulePath = path.join(tmp, 'modelswitch-index-cut.mjs');
    fs.writeFileSync(modulePath, `import { callGenericPopup, POPUP_TYPE } from ${JSON.stringify(ST['popup.js'])};
import { extension_settings } from ${JSON.stringify(ST['extensions.js'])};
import { saveSettingsDebounced } from ${JSON.stringify(ST['script.js'])};
import { SOURCES } from ${JSON.stringify(url('addons/models/sources.js'))};
import { listTargets, shownTargets, linkable, supports, discoverTargets } from ${JSON.stringify(url('addons/modelswitch/targets.js'))};
import { setLocks, withoutLock } from ${JSON.stringify(url('addons/modelswitch/lock.js'))};
import { MAX_STATES, entryOf, captureState, changedSince, planRestore, isCurrent, runRestore, limited, summary, keepStates } from ${JSON.stringify(url('addons/modelswitch/state.js'))};
import { toggleGroup, groupOn, fallbackOnly, rowActive, isFallbackRow, displayGroups } from ${JSON.stringify(url('addons/modelswitch/rows.js'))};
const T = globalThis.__msCommitTest;
// 화면 · 다른 창은 시험 밖: 다시 그리기는 그때의 busy · note 만 적고, 설정 창 열기는 부른 것만 적는다. 3초 기다림이 프로세스를 붙잡지 않게 unref
const render = () => { T.renders.push({ busy, note }); };
const openTarget = async id => { T.opened.push(id); };
const openPanel = () => {};
const setTimeout = (fn, ms) => { const t = globalThis.setTimeout(fn, ms); t.unref?.(); return t; };
${line(/\nconst MAX_PRESETS = [^\n]+/)}
${line(/\nconst esc = [^\n]+/)}
${line(/\nconst label = [^\n]+/)}
${line(/\nlet root,[^\n]+/)}
${line(/\nlet configuring = [^\n]+/)}
${line(/\nconst expandedGroups = [^\n]+/)}
root = { querySelector: () => null };
${cut('store')}
${line(/\nconst armed = [^\n]+/)}
${line(/\nconst canArm = [^\n]+/)}
${line(/\nconst isOn = [^\n]+/)}
${line(/\nconst canPick = [^\n]+/)}
${line(/\nconst fallbackPickable = [^\n]+/)}
${cut('pickFallbacks', 'async function')}
${line(/\nconst inState = [^\n]+/)}
${cut('syncLocks')}
${line(/\nconst cleanUrl = [^\n]+/)}
${cut('describe')}
${cut('configureFallback', 'async function')}
${cut('commitFallback', 'async function')}
${cut('targetHtml')}
${cut('remember')}
${cut('applyNow', 'async function')}
export { store, isOn, pickFallbacks, configureFallback, commitFallback, targetHtml, applyNow };
export const peek = () => ({ busy, note, configuring, armed: [...armed] });
export function setConfiguring(value) { configuring = value; }
export function resetState() { busy = false; note = ''; configuring = null; armed.clear(); }
`);
    M = await import(pathToFileURL(modulePath).href);
    R = await import(url('addons/modelswitch/rows.js'));
    F = await import(url('addons/modelswitch/fallback.js'));
    FF = await import(url('addons/modelswitch/fallback-field.js'));
    MS = await import(url('addons/modelswitch/targets.js'));
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}

// 지어낸 설정: 번역 · 다시 쓰기는 deepseek 본 모델, 다시 쓰기에만 「검열되면」(vertexai) 이 켜져 있음
const RELAY = 'https://relay.test/v1';
function usual() {
    return {
        salty: { addons: { translator: true, rewrite: true } },
        'llm-translator-custom': { connection_mode: 'direct', llm_provider: 'deepseek', llm_model: 'deepseek-main', custom_url: RELAY },
        ban_word_rewrite: { connection: 'direct', provider: 'deepseek', models: { deepseek: 'deepseek-main' }, customModels: {}, customUrl: RELAY, fallback: { enabled: true, provider: 'vertexai', model: 'vertex-side' } },
    };
}
const EXT_IDS = ['sample-helper', 'sample-helper-fallback', 'tts-analysis-fallback', 'slow-helper-fallback'];
function reset(ext = usual()) {
    for (const id of EXT_IDS) MS.registry.unregister(id);
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    Object.assign(T.ext, structuredClone(ext));
    Object.assign(T, { saves: 0, popups: [], answers: [], renders: [], events: [], toasts: [], opened: [] });
    M.resetState();
}
const byId = id => MS.listTargets().find(t => t.id === id);
const tr = () => T.ext['llm-translator-custom'];
const rw = () => T.ext.ban_word_rewrite;

// ---------- 1) 꺼진 줄 켜기
await test('꺼진 「번역 (검열되면)」: 확인 → 고름 → 켜기 = 번역 설정의 fallback 에만 저장 · 체크 켬 · 설정 저장 · 다시 그리라는 알림', async () => {
    reset();
    const target = byId('translator-fallback');
    assert.ok(target, '번역 (검열되면) 줄');
    assert.equal(R.rowActive(target), false, '처음엔 꺼짐');
    T.answers = [true];
    await M.configureFallback('translator-fallback');
    assert.equal(T.popups.length, 1);
    assert.equal(T.popups[0].type, 'confirm');
    assert.match(T.popups[0].content, /검열되면 대체할 모델을 켜시겠습니까/);
    const edit = M.peek().configuring;
    assert.deepEqual(edit, { id: 'translator-fallback', settings: { fallback: { enabled: true, provider: '', model: '' } } }, '「안 씀」이던 줄은 빈칸으로 시작');
    assert.equal(tr().fallback, undefined, '확인만으로는 아무것도 안 씀');
    assert.equal(T.saves, 0);
    // 편집 칸(mountFallbackField)이 하는 그대로: 제공처 고름 → 모델 고름
    FF.pickProvider(edit.settings, 'vertexai');
    FF.pickModel(edit.settings, '  vertex-alt  ');
    await M.commitFallback();
    assert.deepEqual(tr().fallback, { enabled: true, provider: 'vertexai', model: 'vertex-alt' });
    assert.deepEqual([tr().connection_mode, tr().llm_provider, tr().llm_model], ['direct', 'deepseek', 'deepseek-main'], '본 연결은 그대로');
    const s = M.store();
    assert.equal(s.targets['translator-fallback'], true, '체크 켬');
    assert.equal(T.saves, 1, '설정 저장 한 번');
    assert.equal(M.peek().configuring, null, '편집 칸 닫힘');
    assert.equal(M.peek().busy, false);
    assert.match(M.peek().note, /번역 \(검열되면\) 켰어요/);
    assert.deepEqual(T.events, [{ settingsKey: undefined, path: 'fallback' }], '그 확장 화면이 다시 그리라는 알림');
    assert.equal(R.rowActive(target), true);
    assert.equal(M.isOn(target), true);
    assert.deepEqual(F.fallbackOf(tr()), { provider: 'vertexai', model: 'vertex-alt' }, '본 요청이 막히면 이 모델로');
});

await test('본 모델과 같은 모델: 켜지 않음 · 설정 그대로 · 편집 칸은 열린 채 → 다른 모델로 고치면 켜짐', async () => {
    reset();
    T.answers = [true];
    await M.configureFallback('translator-fallback');
    const edit = M.peek().configuring;
    FF.pickProvider(edit.settings, 'deepseek');
    FF.pickModel(edit.settings, 'deepseek-main');
    await M.commitFallback();
    assert.equal(tr().fallback, undefined);
    assert.equal(M.store().targets['translator-fallback'], undefined);
    assert.equal(T.saves, 0);
    assert.deepEqual(T.events, []);
    assert.equal(M.peek().configuring, edit, '다른 모델을 고를 수 있게 그대로');
    assert.match(M.peek().note, /이 모델로 켜지 못했어요/);
    FF.pickModel(edit.settings, 'deepseek-other');
    await M.commitFallback();
    assert.deepEqual(tr().fallback, { enabled: true, provider: 'deepseek', model: 'deepseek-other' });
    assert.equal(M.store().targets['translator-fallback'], true);
});

await test('빈 모델 · 이 확장이 못 쓰는 공급자 · 「안 함」 · 편집 칸 없음: 켜기를 눌러도 아무것도 안 씀', async () => {
    reset();
    T.answers = [true];
    await M.configureFallback('translator-fallback');
    const edit = M.peek().configuring;
    const before = JSON.stringify(T.ext);
    FF.pickProvider(edit.settings, 'vertexai');
    FF.pickModel(edit.settings, '   ');
    await M.commitFallback();
    assert.equal(JSON.stringify(T.ext), before, '빈 모델');
    FF.pickProvider(edit.settings, 'groq');   // 번역이 못 쓰는 공급자 (NARROW 밖)
    FF.pickModel(edit.settings, 'groq-model');
    await M.commitFallback();
    assert.equal(JSON.stringify(T.ext), before, '못 쓰는 공급자');
    FF.pickProvider(edit.settings, 'vertexai');
    FF.pickModel(edit.settings, 'vertex-alt');
    FF.pickProvider(edit.settings, '');   // 「안 함」 = enabled:false
    await M.commitFallback();
    assert.equal(JSON.stringify(T.ext), before, '안 함');
    M.setConfiguring(null);
    await M.commitFallback();
    assert.equal(JSON.stringify(T.ext), before, '편집 칸 없음');
    assert.equal(T.saves, 0);
    assert.deepEqual(T.events, []);
    assert.equal(M.store().targets['translator-fallback'], undefined);
});

await test('확인창에서 아니오 · 일반 줄 · 켤 수 없는 줄(설정 창 열기만) · 켜다가 오류: 설정은 그대로', async () => {
    reset();
    T.answers = [false];
    await M.configureFallback('translator-fallback');
    assert.equal(M.peek().configuring, null, '아니오');
    await M.configureFallback('translator');
    assert.equal(T.popups.length, 1, '일반 줄은 묻지도 않음');
    // 스스로 등록했지만 켜는 길(enable · settingsKey+path)이 없는 「(검열되면)」: 그 확장 설정 창으로만 보낸다
    MS.registry.register({ id: 'tts-analysis-fallback', name: '대사 분석 시험', read: () => ({ follow: '안 씀' }), apply() {} });
    const ext = byId('ext:tts-analysis-fallback');
    assert.equal(typeof ext.enable, 'undefined');
    assert.equal(typeof ext.open, 'function');
    await M.configureFallback('ext:tts-analysis-fallback');
    assert.deepEqual(T.opened, ['ext:tts-analysis-fallback']);
    assert.equal(T.popups.length, 1);
    // 등록한 확장의 enable 이 던지면: 알림만, 체크 · 저장 없음, busy 풀림
    MS.registry.register({ id: 'slow-helper-fallback', name: '느린 도우미', read: () => ({ follow: '안 씀' }), apply() {}, enable() { throw new Error('저장 실패'); } });
    T.answers = [true];
    await M.configureFallback('ext:slow-helper-fallback');
    const edit = M.peek().configuring;
    FF.pickProvider(edit.settings, 'openai');
    FF.pickModel(edit.settings, 'gpt-side');
    await M.commitFallback();
    assert.match(M.peek().note, /켜지 못했어요: 저장 실패/);
    assert.equal(M.peek().busy, false);
    assert.equal(M.store().targets['ext:slow-helper-fallback'], undefined);
    assert.equal(T.saves, 0);
});

await test('켜는 동안 두 번 눌러도 한 번만 켠다 (busy)', async () => {
    reset();
    let calls = 0, release;
    const gate = new Promise(resolve => { release = resolve; });
    const cfg = { fallback: { enabled: false, provider: '', model: '' } };
    MS.registry.register({ id: 'slow-helper-fallback', name: '느린 도우미', read: () => cfg.fallback.provider ? { source: cfg.fallback.provider, model: cfg.fallback.model, url: '' } : { follow: '안 씀' }, apply() {},
        active: () => cfg.fallback.enabled === true,
        async enable({ source, model }) { calls++; await gate; cfg.fallback = { enabled: true, provider: source, model }; return true; } });
    T.answers = [true];
    await M.configureFallback('ext:slow-helper-fallback');
    const edit = M.peek().configuring;
    FF.pickProvider(edit.settings, 'openai');
    FF.pickModel(edit.settings, 'gpt-side');
    const first = M.commitFallback();
    assert.equal(M.peek().busy, true);
    await M.commitFallback();
    release();
    await first;
    assert.equal(calls, 1);
    assert.equal(T.saves, 1);
    assert.deepEqual(cfg.fallback, { enabled: true, provider: 'openai', model: 'gpt-side' });
    assert.equal(M.store().targets['ext:slow-helper-fallback'], true);
});

// ---------- 3) 스스로 등록한 확장 — 표준 fallback 자리만 선언
await test('스스로 등록한 확장(settingsKey · path 만 선언): 그 자리에만 쓰고 같은 객체의 다른 칸 · 본 설정은 그대로 · 알림에 그 자리', async () => {
    reset({ ...usual(), sample_ext: { helper: { provider: 'openai', model: 'gpt-main', fallback: { enabled: false, provider: 'openai', model: 'gpt-saved', memo: 'keep' } }, other: 1 } });
    const h = () => T.ext.sample_ext.helper;
    MS.registry.register({ id: 'sample-helper', name: '도우미', read: () => ({ source: h().provider, model: h().model, url: '' }), apply() {} });
    MS.registry.register({ id: 'sample-helper-fallback', name: '도우미 (검열되면)', settingsKey: 'sample_ext', path: 'helper.fallback',
        read: () => h().fallback.provider ? { source: h().fallback.provider, model: h().fallback.model, url: '' } : { follow: '안 씀' }, apply() {} });
    const target = byId('ext:sample-helper-fallback');
    assert.equal(typeof target.enable, 'function', '레지스트리가 표준 자리 켜기를 붙임');
    assert.equal(R.rowActive(target), false, 'enabled:false 면 꺼진 줄');
    T.answers = [true];
    await M.configureFallback('ext:sample-helper-fallback');
    const edit = M.peek().configuring;
    assert.deepEqual(edit.settings.fallback, { enabled: true, provider: 'openai', model: 'gpt-saved' }, '남겨 둔 값으로 시작');
    FF.pickModel(edit.settings, 'gpt-main');
    await M.commitFallback();
    assert.equal(h().fallback.enabled, false, '본 모델과 같으면 안 켬');
    assert.equal(T.saves, 0);
    FF.pickModel(edit.settings, 'gpt-alt');
    await M.commitFallback();
    assert.deepEqual(h().fallback, { enabled: true, provider: 'openai', model: 'gpt-alt', memo: 'keep' });
    assert.deepEqual([h().provider, h().model, T.ext.sample_ext.other], ['openai', 'gpt-main', 1]);
    assert.equal(M.store().targets['ext:sample-helper-fallback'], true);
    assert.deepEqual(T.events, [{ settingsKey: 'sample_ext', path: 'helper.fallback' }]);
    assert.equal(R.rowActive(target), true);
});

// ---------- 4) 「검열되면」 단추 → 「바꾸기」
await test('6.7.2 · 6.7.5 「검열되면」 단추: 아니오면 그대로 · 예면 일반 줄은 빼고 검열되면 줄만(꺼진 줄은 armed) · 다시 누르면 모두 끔', async () => {
    reset();
    const s = M.store();
    T.answers = [false];
    await M.pickFallbacks();
    assert.equal(T.popups.length, 1);
    assert.match(T.popups[0].content, /꺼져 있는 「검열되면」 1개도 고를까요/);
    assert.deepEqual(s.targets, {}, '아니오면 아무것도 안 바꿈');
    assert.equal(T.saves, 0);
    T.answers = [true];
    await M.pickFallbacks();
    assert.deepEqual(s.targets, { rewrite: false, translator: false, 'rewrite-fallback': true });
    assert.deepEqual(M.peek().armed, ['translator-fallback'], '꺼진 줄은 설정을 바꾸지 않고 고르기만');
    assert.equal(tr().fallback, undefined);
    assert.equal(M.isOn(byId('translator-fallback')), true);
    assert.equal(T.saves, 1);
    await M.pickFallbacks();
    assert.equal(T.popups.length, 2, '이미 검열되면 줄만이면 묻지 않고 끈다');
    assert.equal(s.targets['rewrite-fallback'], false);
    assert.deepEqual(M.peek().armed, []);
    assert.equal(M.isOn(byId('translator-fallback')), false);
    assert.deepEqual([s.targets.translator, s.targets.rewrite], [false, false]);
});

await test('6.7.5 회귀: 일반 줄과 검열되면 줄이 모두 켜진 상태에서 누르면 검열되면 줄만 남김 (전엔 검열되면 줄이 꺼지고 일반 줄만 남았다)', async () => {
    const ext = usual();
    ext['llm-translator-custom'].fallback = { enabled: true, provider: 'vertexai', model: 'vertex-tr' };
    ext.model_switch = { targets: { 'translator-fallback': true, 'rewrite-fallback': true } };
    reset(ext);
    const s = M.store();
    const on = () => ['translator', 'rewrite', 'translator-fallback', 'rewrite-fallback'].map(id => M.isOn(byId(id)));
    assert.deepEqual(on(), [true, true, true, true], '모두 켜진 상태');
    await M.pickFallbacks();
    assert.equal(T.popups.length, 0, '꺼진 줄이 없으면 묻지 않음');
    assert.deepEqual(on(), [false, false, true, true], '검열되면 줄만 남김');
    assert.deepEqual(s.targets, { 'translator-fallback': true, 'rewrite-fallback': true, translator: false, rewrite: false });
    await M.pickFallbacks();
    assert.deepEqual(on(), [false, false, false, false], '검열되면 줄만일 때 누르면 끔');
});

await test('「바꾸기」: 고른 꺼진 줄은 위 모델로 켜고(본 설정 그대로) · 켜진 검열되면 줄은 그 모델로 · 「↶ 직전」엔 바꾼 줄만', async () => {
    reset();
    T.answers = [true];
    await M.pickFallbacks();
    const s = M.store();
    s.draft = { source: 'vertexai', model: ' vertex-alt ', url: '' };
    await M.applyNow();
    assert.deepEqual(tr().fallback, { enabled: true, provider: 'vertexai', model: 'vertex-alt' }, '꺼진 줄을 켬');
    assert.deepEqual([tr().llm_provider, tr().llm_model], ['deepseek', 'deepseek-main'], '번역 본 연결 그대로 (체크 뺀 줄)');
    assert.deepEqual(rw().fallback, { enabled: true, provider: 'vertexai', model: 'vertex-alt' });
    assert.deepEqual([rw().provider, rw().models.deepseek], ['deepseek', 'deepseek-main']);
    assert.equal(s.targets['translator-fallback'], true, '켠 줄은 체크로 남김');
    assert.deepEqual(M.peek().armed, []);
    assert.equal(T.events.length, 2);
    assert.deepEqual(Object.keys(s.last.items), ['rewrite-fallback'], '켜기만 한 줄은 직전에 없음 (되돌릴 값이 없음)');
    assert.equal(s.last.items['rewrite-fallback'].model, 'vertex-side');
    assert.match(M.peek().note, /번역 \(검열되면\)/);
    assert.match(M.peek().note, /→ Google Vertex AI · vertex-alt/);
    assert.equal(T.toasts.at(-1)[0], 'success');
    assert.equal(M.peek().busy, false);
});

await test('「바꾸기」: 위 모델이 본 모델과 같으면 꺼진 줄은 못 켜고 켜진 검열되면 줄도 안 바꿈 · 직전 그대로 · 경고', async () => {
    reset();
    T.answers = [true];
    await M.pickFallbacks();
    const s = M.store();
    s.draft = { source: 'deepseek', model: 'deepseek-main', url: '' };
    await M.applyNow();
    assert.equal(tr().fallback, undefined);
    assert.deepEqual(rw().fallback, { enabled: true, provider: 'vertexai', model: 'vertex-side' });
    assert.equal(s.targets['translator-fallback'], undefined);
    assert.ok(!('last' in s), '바뀐 게 없으면 직전을 만들지 않음');
    assert.match(M.peek().note, /못 바꿈: .*번역 \(검열되면\)/);
    assert.equal(T.toasts.at(-1)[0], 'warning');
});

// ---------- 5) 1.2.0 켜기 · 취소 단추
await test('1.2.0 켜기 · 취소: 편집 칸 단추가 .ms-fallback-actions 안 .menu_button · 글자 폭 · 줄바꿈 없음 · VERSION = --ms-version', async () => {
    reset();
    T.answers = [true];
    await M.configureFallback('translator-fallback');
    const html = M.targetHtml(byId('translator-fallback'));
    const actions = html.match(/<div class="ms-fallback-actions">([\s\S]*?)<\/div>/)?.[1] || '';
    const buttons = [...actions.matchAll(/<button type="button" class="([^"]*)" data-act="([^"]+)">([^<]*)<\/button>/g)].map(m => [m[1], m[2], m[3]]);
    assert.deepEqual(buttons, [['menu_button', 'fallback-save', '켜기'], ['menu_button', 'fallback-cancel', '취소']]);
    const css = read('src/addons/modelswitch/style.css');
    const body = css.match(/#model-switch-settings \.ms-fallback-actions \.menu_button\{([^}]*)\}/)?.[1];
    assert.ok(body, '#model-switch-settings .ms-fallback-actions .menu_button 규칙');
    const decl = Object.fromEntries(body.split(';').map(x => x.trim()).filter(Boolean).map(x => { const i = x.indexOf(':'); return [x.slice(0, i).trim(), x.slice(i + 1).trim()]; }));
    assert.equal(decl.flex, '0 0 auto', '줄어들지 않음');
    assert.equal(decl.width, 'auto', '실리태번 width:min-content 를 이김');
    assert.equal(decl['white-space'], 'nowrap', '켜/기 · 취/소로 꺾이지 않음');
    assert.match(decl['min-height'] || '', /^max\(36px,\s*\S.*\)$/, '최소 높이 36 (테마 컨트롤이 더 크면 그 값)');
    assert.match(decl['border-radius'] || '', /^var\(--bl-r-sm,\s*8px\)(\s*!important)?$/);
    const version = source.match(/\nconst VERSION = '([^']+)';/)?.[1];
    const cssVersion = css.match(/#model-switch-settings\{--ms-version:"([^"]+)"\}/)?.[1];
    assert.ok(version && cssVersion, 'VERSION · --ms-version');
    assert.equal(cssVersion, version, 'index.js VERSION 과 style.css --ms-version 이 같아야 「파일이 안 맞음」 알림이 안 뜬다');
    assert.match(source, /verifyAddonCss\(\{ folder: 'modelswitch', name: '--ms-version', version: VERSION,/);
});

console.log(`\nmodelswitch-commit: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
