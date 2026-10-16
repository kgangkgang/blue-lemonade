// 모델 등록 설정 창에서 등록 목록을 바꾸는 길 — 추가 · 지우기 · 이름 고치기 · ↑↓ · ⠿ 끌기 (src/addons/models/panel.js)
//   node tools/tests/model-register-panel.mjs <테마 루트>   (공개 저장소는 '.')
// panel.js 는 창 전체를 만들므로 통째로 부르지 않고, 확인할 함수만 원문 그대로 잘라 임시 모듈로 돌린다 (translation-source.mjs 와 같은 방식).
// 설정은 진짜 state.js 에 쓴다 (실리태번 모듈만 data: 스텁). 실리태번 목록에 넣기(applyOne) · 다시 그리기 · 기본 목록 읽기는 부른 것만 적는 가짜. 네트워크 없음.
// 확인하는 것:
//   1) 추가: 빈 이름 · 이미 등록 · 실리태번 기본 목록에 있는 이름은 안 넣음 · 기본 목록을 못 읽으면 넣음 · 기다리는 사이 공급자를 바꿔도 처음 공급자에
//   2) 지우기: 확인해야만 · 순서가 아니라 이름으로 (확인창 사이에 목록 · 공급자가 바뀌어도) · 고른 모델이면 기억도 지움
//   3) 이름 고치기: 취소(false) 가 'false' 라는 이름이 되지 않음 · 중복 안내 · 고른 모델이면 기억이 새 이름을 따라감
//   4) ↑↓ 와 ⠿ 끌기: 순서 저장 · 끝에서는 안 움직임 · 끄는 사이 목록이 바뀌었거나 취소 · Esc 면 안 씀
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
const T = globalThis.__mrPanelTest = { ext: {}, saves: 0, popups: [], answers: [], onPopup: null, applied: [], renders: 0, toasts: [], builtIn: null };
const G = 'const T = globalThis.__mrPanelTest;\n';
const ST = {
    'script.js': js(G + `export const event_types = {};
export const eventSource = { on() {}, once() {} };
export function saveSettingsDebounced() { T.saves++; }`),
    'extensions.js': js(G + `export const extension_settings = T.ext;
export const extensionNames = [];
export function getContext() { return { chatCompletionSettings: {} }; }`),
    'popup.js': js(G + `export const POPUP_TYPE = { TEXT: 1, CONFIRM: 2, INPUT: 3 };
export const POPUP_RESULT = { AFFIRMATIVE: 1, NEGATIVE: 0, CANCELLED: null };
export async function callGenericPopup(content, type, value) { T.popups.push({ text: content?.textContent ?? content, type, value }); await T.onPopup?.(); return T.answers.length ? T.answers.shift() : null; }`),
};
register(js(`let S = {}, R = '';
export async function initialize(d) { S = d.st; R = d.root; }
export async function resolve(spec, ctx, next) {
    const parent = String(ctx.parentURL || '');
    const base = spec.split('/').pop();
    if (parent.startsWith(R) && (spec.match(/\\.\\.\\//g) || []).length >= 3 && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { st: ST, root: pathToFileURL(srcDir).href } });
globalThis.document = { createElement: tag => ({ tagName: tag.toUpperCase(), textContent: '' }) };
globalThis.toastr = Object.fromEntries(['success', 'info', 'warning', 'error'].map(kind => [kind, (message) => T.toasts.push([kind, message])]));

// ---------- panel.js 에서 함수를 원문 그대로 잘라 임시 모듈로
const source = read('src/addons/models/panel.js');
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
    assert.ok(start >= 0, 'panel.js 에 없음: ' + name);
    return source.slice(start + 1, closeOf(source.indexOf(') {', start) + 2, name));
}
const line = re => { const m = source.match(re); assert.ok(m, 'panel.js 에 없음: ' + re); return m[0].trim(); };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-mr-panel-'));
let P, state;
try {
    const modulePath = path.join(tmp, 'model-register-panel-cut.mjs');
    fs.writeFileSync(modulePath, `import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from ${JSON.stringify(ST['popup.js'])};
import { TITLE, modelsOf, movePick, setModels, settings } from ${JSON.stringify(url('addons/models/state.js'))};
const T = globalThis.__mrPanelTest;
// 실리태번 목록에 넣기 · 다시 그리기 · 기본 목록 읽기는 시험 밖 (부른 것만 적는다)
const applyOne = id => { T.applied.push(id); };
const render = () => { T.renders++; };
const builtInLists = async () => T.builtIn;
const input = { value: '' };
${line(/\nlet root = [^\n]+/)}
root = { querySelector: selector => (selector === '.mr-input' ? input : null) };
${line(/\nlet currentId = [^\n]+/)}
${cut('$')}
${cut('toast')}
${cut('textNode')}
${line(/\nlet drag = [^\n]+/)}
${cut('startDrag')}
${cut('save')}
${cut('onAdd', 'async function')}
${cut('onListClick', 'async function')}
export { onAdd, onListClick, startDrag, input };
export const use = id => { currentId = id; };
export const dragging = () => drag;
`);
    P = await import(pathToFileURL(modulePath).href);
    state = await import(url('addons/models/state.js'));
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
function reset(store) {
    for (const k of Object.keys(T.ext)) delete T.ext[k];
    T.ext.model_register = structuredClone(store);
    state.initSettings();
    Object.assign(T, { saves: 0, popups: [], answers: [], onPopup: null, applied: [], renders: 0, toasts: [], builtIn: null });
    P.input.value = '';
}
const models = id => state.modelsOf(id);
// 목록 한 줄과 그 단추 (panel.js render 가 만드는 data-name · data-act 모양)
const rowOf = name => ({ dataset: { name }, closest: sel => (sel === '.mr-item' ? rowOf(name) : null) });
const click = (name, act) => {
    const row = rowOf(name);
    const button = { dataset: { act }, closest: sel => (sel === '[data-act]' ? button : sel === '.mr-item' ? row : null) };
    return P.onListClick({ target: button });
};

// ---------- 1) 추가
await test('추가: 이름을 다듬어 목록 끝에 · 입력칸 비움 · 실리태번 목록에 바로 넣음 · 저장 · 빈 이름 · 이미 등록 · 실리태번 기본 목록에 있는 이름은 안 넣음', async () => {
    reset({ sources: { claude: ['claude-mine'] }, picks: {} });
    P.use('claude');
    P.input.value = '   ';
    await P.onAdd();
    assert.equal(T.toasts.at(-1)[0], 'warning');
    P.input.value = 'claude-mine';
    await P.onAdd();
    assert.match(T.toasts.at(-1)[1], /이미 등록된 이름/);
    T.builtIn = { claude: new Set(['claude-native']) };
    P.input.value = ' claude-native ';
    await P.onAdd();
    assert.match(T.toasts.at(-1)[1], /실리태번 목록에 이미 있는 모델/);
    assert.deepEqual(models('claude'), ['claude-mine']);
    assert.equal(T.saves, 0);
    P.input.value = ' claude-extra ';
    await P.onAdd();
    assert.deepEqual(models('claude'), ['claude-mine', 'claude-extra']);
    assert.equal(P.input.value, '', '입력칸 비움');
    assert.deepEqual(T.applied, ['claude'], '메뉴에 바로');
    assert.equal(T.saves, 1);
    assert.equal(T.toasts.at(-1)[0], 'success');
    T.builtIn = null;   // 기본 목록(index.html)을 못 읽음 → 막지 않고 넣는다
    P.input.value = 'claude-native';
    await P.onAdd();
    assert.deepEqual(models('claude'), ['claude-mine', 'claude-extra', 'claude-native']);
});

await test('추가: 기본 목록을 읽는 사이 공급자를 바꿔도 처음 공급자에 넣음', async () => {
    reset({ sources: { claude: ['claude-mine'] }, picks: {} });
    P.use('claude');
    let release;
    T.builtIn = new Promise(resolve => { release = resolve; });
    P.input.value = 'claude-late';
    const adding = P.onAdd();
    P.use('vertexai');
    release({});
    await adding;
    assert.deepEqual(models('claude'), ['claude-mine', 'claude-late']);
    assert.deepEqual(models('vertexai'), []);
    assert.deepEqual(T.applied, ['claude']);
});

// ---------- 2) 지우기
await test('지우기: 확인해야만 · 그 이름만 · 고른 모델이었으면 기억도 지움 · 실리태번 목록에서도 뺌', async () => {
    reset({ sources: { vertexai: ['gemini-alt', 'gemini-side', 'gemini-third'] }, picks: { vertexai: 'gemini-side' } });
    P.use('vertexai');
    T.answers = [0];
    await click('gemini-side', 'delete');
    assert.match(T.popups.at(-1).text, /'gemini-side'을\(를\) 목록에서 지울까요/);
    assert.deepEqual(models('vertexai'), ['gemini-alt', 'gemini-side', 'gemini-third'], '아니오면 그대로');
    T.answers = [null];
    await click('gemini-side', 'delete');
    assert.equal(models('vertexai').length, 3, '닫기도 그대로');
    assert.equal(T.saves, 0);
    T.answers = [1];
    await click('gemini-side', 'delete');
    assert.deepEqual(models('vertexai'), ['gemini-alt', 'gemini-third']);
    assert.equal(state.pickOf('vertexai'), '', '고른 모델이 빠지면 기억도 지움');
    assert.deepEqual(T.applied, ['vertexai']);
    assert.equal(T.saves, 1);
});

await test('지우기: 확인창 사이에 목록 순서가 바뀌거나 공급자를 바꿔도 누른 그 이름을 그 공급자에서 · 이미 없어졌으면 아무것도 안 함', async () => {
    reset({ sources: { vertexai: ['gemini-alt', 'gemini-side'], claude: ['claude-mine'] }, picks: {} });
    P.use('vertexai');
    T.answers = [1];
    T.onPopup = () => { state.setModels('vertexai', ['gemini-new', 'gemini-side', 'gemini-alt']); P.use('claude'); };
    await click('gemini-side', 'delete');
    assert.deepEqual(models('vertexai'), ['gemini-new', 'gemini-alt'], '순서가 아니라 이름으로');
    assert.deepEqual(models('claude'), ['claude-mine'], '바꾼 공급자는 그대로');
    P.use('vertexai');
    T.answers = [1];
    T.onPopup = () => { state.setModels('vertexai', ['gemini-new']); };
    await click('gemini-alt', 'delete');
    assert.deepEqual(models('vertexai'), ['gemini-new']);
    T.onPopup = null;
    const popups = T.popups.length;
    await click('gemini-gone', 'delete');
    assert.equal(T.popups.length, popups, '목록에 없는 줄은 묻지도 않음');
});

// ---------- 3) 이름 고치기
await test("이름 고치기: 취소(false)가 'false' 라는 모델이 되지 않음 · 닫기 · 같은 이름 · 빈 이름 · 중복은 그대로 · 고치면 그 자리 · 고른 모델이면 기억도 새 이름", async () => {
    reset({ sources: { openai: ['gpt-mine', 'gpt-two'] }, picks: { openai: 'gpt-mine' } });
    P.use('openai');
    for (const answer of [false, null, undefined, 'gpt-mine', '   ']) {
        T.answers = [answer];
        await click('gpt-mine', 'rename');
    }
    assert.deepEqual(models('openai'), ['gpt-mine', 'gpt-two']);
    assert.ok(!models('openai').includes('false'));
    assert.equal(T.popups.at(-1).value, 'gpt-mine', '지금 이름이 입력칸에');
    T.answers = ['gpt-two'];
    await click('gpt-mine', 'rename');
    assert.match(T.toasts.at(-1)[1], /이미 등록된 이름/);
    assert.equal(T.saves, 0);
    T.answers = ['  gpt-renamed  '];
    await click('gpt-mine', 'rename');
    assert.deepEqual(models('openai'), ['gpt-renamed', 'gpt-two'], '그 자리에서');
    assert.equal(state.pickOf('openai'), 'gpt-renamed', '고른 모델의 기억이 새 이름을 따라감 (지워지지 않음)');
    assert.deepEqual(T.applied, ['openai']);
    T.answers = ['gpt-three'];
    await click('gpt-two', 'rename');
    assert.deepEqual(models('openai'), ['gpt-renamed', 'gpt-three']);
    assert.equal(state.pickOf('openai'), 'gpt-renamed', '다른 줄 이름은 기억과 무관');
});

// ---------- 4) 순서
await test('↑↓: 이웃과 자리 바꿈 · 저장 · 맨 위에서 ↑ · 맨 아래에서 ↓ 는 그대로', async () => {
    reset({ sources: { claude: ['claude-a', 'claude-b', 'claude-c'] }, picks: { claude: 'claude-b' } });
    P.use('claude');
    await click('claude-c', 'up');
    assert.deepEqual(models('claude'), ['claude-a', 'claude-c', 'claude-b']);
    await click('claude-a', 'down');
    assert.deepEqual(models('claude'), ['claude-c', 'claude-a', 'claude-b']);
    assert.equal(T.saves, 2);
    await click('claude-c', 'up');
    await click('claude-b', 'down');
    assert.deepEqual(models('claude'), ['claude-c', 'claude-a', 'claude-b']);
    assert.equal(T.saves, 2, '끝에서는 저장도 안 함');
    assert.equal(state.pickOf('claude'), 'claude-b', '순서만 바뀌고 기억은 그대로');
});

// ⠿ 끌기: 목록(.mr-list)과 줄 · 손잡이 흉내 — pointermove 가 줄을 옮긴 결과는 items 순서를 바꿔 흉내 낸다
function dragList() {
    const listeners = {};
    const rows = new Map();
    const list = {
        items: [], scrollTop: 0,
        addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
        querySelectorAll: sel => (sel === '.mr-item' ? list.items : []),
        emit(type, event) { for (const fn of listeners[type] ?? []) fn(event); },
        show(names) { list.items = names.map(name => rows.get(name) ?? rows.set(name, makeRow(name)).get(name)); },
    };
    function makeRow(name) {
        const row = { dataset: { name }, classList: { add() {}, remove() {} }, closest: sel => (sel === '.mr-item' ? row : null) };
        row.handle = { closest: sel => (sel === '.mr-handle' ? row.handle : sel === '.mr-item' ? row : null), setPointerCapture() {}, releasePointerCapture() {} };
        return row;
    }
    P.startDrag(list);
    const grab = (name, pointerId = 1) => list.emit('pointerdown', { target: list.items.find(r => r.dataset.name === name).handle, button: 0, pointerId, preventDefault() {} });
    return { list, grab };
}
await test('⠿ 끌기: 놓으면 보이는 순서로 저장 · 그대로 놓으면 · 취소(pointercancel) · Esc · 끄는 사이 목록이 바뀌면 안 씀', async () => {
    reset({ sources: { vertexai: ['gemini-a', 'gemini-b', 'gemini-c'] }, picks: {} });
    P.use('vertexai');
    const { list, grab } = dragList();
    list.show(models('vertexai'));
    grab('gemini-c');
    assert.equal(P.dragging()?.name, 'gemini-c');
    list.show(['gemini-c', 'gemini-a', 'gemini-b']);
    list.emit('pointerup', { pointerId: 1 });
    assert.deepEqual(models('vertexai'), ['gemini-c', 'gemini-a', 'gemini-b']);
    assert.deepEqual(T.applied, ['vertexai']);
    assert.equal(P.dragging(), null);
    const saves = T.saves;
    list.show(models('vertexai'));
    grab('gemini-a');
    list.emit('pointerup', { pointerId: 1 });
    assert.equal(T.saves, saves, '그대로 놓으면 안 씀');
    grab('gemini-a');
    list.show(['gemini-a', 'gemini-c', 'gemini-b']);
    list.emit('pointercancel', { pointerId: 1 });
    assert.equal(T.saves, saves, '취소');
    list.show(models('vertexai'));
    grab('gemini-b');
    list.show(['gemini-b', 'gemini-c', 'gemini-a']);
    list.emit('keydown', { key: 'Escape' });
    assert.equal(P.dragging(), null);
    list.emit('pointerup', { pointerId: 1 });
    assert.equal(T.saves, saves, 'Esc 뒤에 놓아도 안 씀');
    list.show(models('vertexai'));
    grab('gemini-a');
    list.emit('pointerup', { pointerId: 2 });
    assert.equal(P.dragging()?.name, 'gemini-a', '다른 손가락은 무시');
    state.setModels('vertexai', ['gemini-c', 'gemini-a', 'gemini-b', 'gemini-new']);   // 다른 창 · 새 모델 묻기가 그 사이 목록을 바꿈
    const after = T.saves;
    list.show(['gemini-a', 'gemini-c', 'gemini-b']);
    list.emit('pointerup', { pointerId: 1 });
    assert.deepEqual(models('vertexai'), ['gemini-c', 'gemini-a', 'gemini-b', 'gemini-new'], '끄는 사이 바뀐 목록을 덮어쓰지 않음');
    assert.equal(T.saves, after);
});

console.log(`\nmodel-register-panel: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
