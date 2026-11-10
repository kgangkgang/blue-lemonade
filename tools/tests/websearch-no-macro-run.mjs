// 1.1.2 코드 감사 H2 — 「웹 검색 · 출처 표시」가 출처 후보(카드 · 페르소나 · 로어북 · 확장 주입 · 지시 · 프리셋) 글마다 실리태번 매크로 엔진을 한 번 더 돌리던 것
//   node tools/tests/websearch-no-macro-run.mjs <테마 루트>
// 실리태번의 변수 매크로는 풀 때 실제로 실행돼요({{incvar}} · {{addvar}} · {{setvar}}). 생성마다 후보 글을 substituteParams 로 풀면 그 매크로가 두 번 돌아요.
//   (a) 프롬프트를 보낼 때 테마는 substituteParams 를 부르지 않아요 — 변수 값은 실리태번이 한 번 푼 그대로
//   (b) 이름 자리({{user}} · {{char}})는 직접 채워서 출처 칩이 예전처럼 맞춰져요(카드 설명 · 프리셋 이름)
//   (c) 이름 채우기(fillNames)는 글만 바꾸는 순수 함수 — 빈 글이 되는 매크로는 실행 없이 지우고, 나머지 매크로는 그대로 둬요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const core = await import(pathToFileURL(path.join(root, 'src/websearch-core.js')).href);

// ── 실리태번 흉내: 변수 매크로를 「실행」하는 substituteParams ──
const vars = new Map();
let subCalls = 0;
const USER = '레몬', CHAR = '세라피나';
function substituteParams(text) {
    subCalls++;
    return String(text ?? '')
        .replace(/\{\{\/\/[\s\S]*?\}\}/g, '')
        .replace(/\{\{setvar::([^:}]+)::([^}]*)\}\}/gi, (_, key, value) => { vars.set(key, value); return ''; })
        .replace(/\{\{addvar::([^:}]+)::([^}]*)\}\}/gi, (_, key, value) => { vars.set(key, Number(vars.get(key) ?? 0) + Number(value)); return ''; })
        .replace(/\{\{incvar::([^}]+)\}\}/gi, (_, key) => { vars.set(key, Number(vars.get(key) ?? 0) + 1); return String(vars.get(key)); })
        .replace(/\{\{getvar::([^}]+)\}\}/gi, (_, key) => String(vars.get(key) ?? ''))
        .replace(/\{\{user\}\}/gi, USER).replace(/\{\{char\}\}/gi, CHAR);
}

const CARD = '{{char}}는 숲을 지키는 수호자이고 {{user}}를 오래 기다려 왔어요. 만난 횟수 {{incvar::met}} 번째.';
const PRESETS = [
    { identifier: 'p-count', name: '턴 세기', content: '{{addvar::turn::1}}{{setvar::mood::calm}}지금 분위기를 지켜 주세요. {{user}}의 말에 차분히 답해요.' },
    { identifier: 'p-order', name: '차례', content: '{{setvar::mood::angry}}화가 난 채로 말하지 않아요. 이 줄은 꺼져 있어요.' },
];

// ── 작은 가짜 DOM 으로 src/websearch.js 를 그대로 돌려요(websearch-mark.mjs 와 같은 길) ──
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-websearch-macro-'));
fs.copyFileSync(path.join(root, 'src/websearch.js'), path.join(dir, 'websearch.js'));
fs.copyFileSync(path.join(root, 'src/websearch-core.js'), path.join(dir, 'websearch-core.js'));
fs.writeFileSync(path.join(dir, 'settings.js'), 'export const getSettings = () => globalThis.__wsSettings;\n');
fs.writeFileSync(path.join(dir, 'usage-mode.js'), 'export const themeEnabled = () => true;\n');
fs.writeFileSync(path.join(dir, 'name-aliases.js'), 'export const nameAliases = () => [];\n');
globalThis.__wsSettings = { chat: {} };
const listeners = new Map();
const emit = (type, event) => { for (const fn of [...(listeners.get(type) || [])]) fn(event); return event; };
class FakeElement {}
globalThis.Element = FakeElement;
const node = { nodeType: 3, nodeValue: '수호자는 차분히 웃었어요' };
const mesEl = Object.assign(new FakeElement(), { getAttribute: k => (k === 'mesid' ? '1' : k === 'is_user' ? 'false' : null) });
const textEl = Object.assign(new FakeElement(), {
    closest: sel => (sel === '.mes_text' ? textEl : sel.startsWith('#chat .mes') ? mesEl : null),
    contains: n => n === node, getBoundingClientRect: () => ({ top: 100 }), textContent: node.nodeValue,
});
const body = [];
let caretOffset = 1;
globalThis.document = {
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    createElement: () => ({ style: {}, offsetWidth: 80, offsetHeight: 24, setAttribute() {}, remove() { const i = body.indexOf(this); if (i >= 0) body.splice(i, 1); } }),
    body: { append: el => body.push(el) }, documentElement: { clientWidth: 384 }, addEventListener() {}, removeEventListener() {},
    caretRangeFromPoint: () => ({ startContainer: node, startOffset: caretOffset }),
};
globalThis.window = { addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); }, removeEventListener: (type, fn) => listeners.get(type)?.delete(fn), innerHeight: 800, getSelection: () => ({ isCollapsed: true }) };
globalThis.CSS = { escape: s => s };
Object.defineProperty(globalThis, 'navigator', { value: { vibrate: () => true }, configurable: true, writable: true });
const st = new Map();
const types = Object.fromEntries(['GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'WORLD_INFO_ACTIVATED', 'CHAT_COMPLETION_PROMPT_READY', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'CHAT_CHANGED', 'MESSAGE_DELETED', 'MORE_MESSAGES_LOADED'].map(k => [k, k]));
const context = {
    chat: [{ is_user: true, mes: '안녕', extra: {} }, { is_user: false, mes: node.nodeValue, extra: {} }],
    characters: [{ name: CHAR, avatar: 'a.png', description: CARD }], characterId: 0, name1: USER, name2: CHAR,
    powerUserSettings: { persona_description: '' }, extensionPrompts: {}, extensionSettings: {},
    chatCompletionSettings: { prompts: PRESETS, prompt_order: [{ character_id: 100001, order: [{ identifier: 'p-count', enabled: true }, { identifier: 'p-order', enabled: false }] }] },
    substituteParams, eventTypes: types, getCurrentChatId: () => 'chat-a',
    eventSource: { on: (name, fn) => { if (!st.has(name)) st.set(name, []); st.get(name).push(fn); } },
};
globalThis.SillyTavern = { getContext: () => context };
const fireST = (name, ...args) => { for (const fn of st.get(name) || []) fn(...args); };
const ws = await import(pathToFileURL(path.join(dir, 'websearch.js')).href);
ws.startWebSearchMarks();

let pid = 0;
const ev = () => ({ pointerId: pid, isPrimary: true, pointerType: 'touch', button: 0, clientX: 50, clientY: 120, target: textEl, isTrusted: true, preventDefault() {}, stopImmediatePropagation() {} });
/** 낱말 자리(caret)를 길게 눌러 뜬 칩 글 */
function chipAt(offset) {
    caretOffset = offset; pid++; ws.hideChip(); body.length = 0;
    emit('pointerdown', ev()); emit('contextmenu', ev()); emit('pointerup', ev()); emit('click', ev());
    return body.length ? body[0].textContent : null;
}
/** 생성 한 번 — 실리태번이 켜진 프롬프트만 한 번 풀어 보내요 */
function generate() {
    const sent = [
        { role: 'system', content: substituteParams(PRESETS[0].content) },
        { role: 'system', content: substituteParams(CARD) },
        { role: 'user', content: '안녕' },
    ];
    const mine = subCalls;
    fireST('GENERATION_STARTED', 'normal', {}, false);
    fireST('CHAT_COMPLETION_PROMPT_READY', { chat: sent, dryRun: false });
    fireST('MESSAGE_RECEIVED', 1, 'normal');
    return { sent, extraCalls: subCalls - mine };
}

await test('프롬프트를 보낼 때 매크로 엔진을 한 번 더 돌리지 않아요 — {{incvar}} · {{addvar}} · {{setvar}} 가 다시 실행되지 않음', () => {
    vars.clear();
    const first = generate();
    assert.equal(first.extraCalls, 0, `테마가 substituteParams 를 ${first.extraCalls}번 불렀어요`);
    assert.deepEqual(Object.fromEntries(vars), { turn: 1, mood: 'calm', met: 1 }, '생성 한 번 = 실리태번이 푼 한 번');
    const second = generate();
    assert.equal(second.extraCalls, 0);
    assert.deepEqual(Object.fromEntries(vars), { turn: 2, mood: 'calm', met: 2 }, '꺼진 프롬프트의 {{setvar}} 도 돌지 않아요');
    assert.equal(ws.originCount(), 1);
});

await test('출처 칩은 예전처럼 맞춰져요 — 이름 자리만 직접 채워 보낸 글과 견줘요', () => {
    generate();
    node.nodeValue = '수호자는 차분히 웃었어요'; textEl.textContent = node.nodeValue;
    assert.equal(chipAt(1), '카드 · 설명', '「수호자는」 → 카드 설명');
    assert.equal(chipAt(6), '프리셋 · 턴 세기', '「차분히」 → 켜진 프리셋 프롬프트');
    node.nodeValue = '세라피나와 레몬'; textEl.textContent = node.nodeValue;
    assert.equal(chipAt(1), '카드 · 설명', '{{char}} 자리에 채운 이름으로도 찾아요');
    assert.match(chipAt(6) ?? '', /카드 · 설명/, '{{user}} 자리에 채운 이름으로도 찾아요');
    node.nodeValue = '바다를 건넜어요'; textEl.textContent = node.nodeValue;
    assert.equal(chipAt(1), '지어냄');
});

await test('fillNames: 이름만 채우고(치환 무늬 $ 는 글자 그대로) 빈 글이 되는 매크로는 지우기만 · 나머지는 그대로', () => {
    const { fillNames } = core;
    assert.equal(typeof fillNames, 'function');
    assert.equal(fillNames('{{char}} 와 {{User}} · <USER> · <BOT>', { user: 'U', char: 'C' }), 'C 와 U · U · C');
    assert.equal(fillNames('{{user}} 의 돈', { user: "$&$'", char: 'C' }), "$&$' 의 돈");
    assert.equal(fillNames('{{user}} · {{char}}', {}), '{{user}} · {{char}}', '이름을 모르면 그대로');
    assert.equal(fillNames('{{// 메모}}{{setvar::a::1}}{{addvar::b::2}}{{setglobalvar::c::3}}{{noop}}본문'), '본문');
    assert.equal(fillNames('앞\n\n{{trim}}\n뒤'), '앞뒤');
    assert.equal(fillNames('{{incvar::n}} {{getvar::a}} {{random::a::b}} {{roll:d6}}'), '{{incvar::n}} {{getvar::a}} {{random::a::b}} {{roll:d6}}', '값이 나오는 매크로는 풀지 않고 그대로');
    assert.equal(fillNames(null), '');
});

await test('소스: 출처 후보 모으기에 substituteParams 가 없어요', () => {
    const src = fs.readFileSync(path.join(root, 'src/websearch.js'), 'utf8').replace(/\/\/.*$/gm, '');
    assert.ok(!/substituteParams/.test(src));
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(`websearch-no-macro-run: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
