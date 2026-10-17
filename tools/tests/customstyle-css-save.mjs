// 커스텀 CSS 조절 (src/addons/customstyle/index.js) — 사용자의 커스텀 CSS 글(#customCSS)을 고치는 길과 내보내기
//   1) 「커스텀 CSS에 저장」: --custom-theme-style-inputs 의 JSON 배열만 지금 값으로 바꾸고 앞뒤 CSS 는 한 글자도 안 바뀜 · input 이벤트 한 번
//   2) 5.1.3: 문자열 안의 `]` · 선택지 배열(안쪽 `]`)에서 배열 끝을 잘못 잡아 뒤 CSS 를 망가뜨리지 않음
//   3) 배열이 없으면 첫 :root { 안에 · :root 도 없으면 끝에 붙임 · 같은 내용이면 다시 쓰지 않음 · 끝을 못 찾는 망가진 배열은 그대로 둠 · 입력칸이 없으면 쓰지 않음
//   4) 「예제 CSS 추가」: 취소 → 그대로, 확인 → 예제를 앞에 붙이고 기존 CSS 는 뒤에 그대로
//   5) 「설정 CSS 복사」: 지금 값을 기본값으로 한 :root 블록 · 클립보드가 막히면 execCommand 대체 · 둘 다 안 되면 오류 알림
// 실리태번 모듈(script.js · extensions.js)과 테마 modal.js 는 data: 스텁, DOM · 타이머 · requestAnimationFrame 은 작은 가짜. 네트워크 없음.
//   node tools/tests/customstyle-css-save.mjs <테마 루트>
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const T = globalThis.__ctsiSaveTest = { ext: {}, saves: 0, handlers: {}, once: {}, config: '', toasts: [], confirms: [], asked: [], copied: [], execResult: false };
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const G = 'const T = globalThis.__ctsiSaveTest;\n';
const stubs = {
    'script.js': js(G + `export const event_types = { SETTINGS_UPDATED: 'settings_updated', APP_READY: 'app_ready' };
export const eventSource = { on(name, fn) { (T.handlers[name] ||= []).push(fn); }, once(name, fn) { (T.once[name] ||= []).push(fn); } };
export function saveSettingsDebounced() { T.saves++; }`),
    'extensions.js': js(G + 'export const extension_settings = new Proxy({}, { get: (_, key) => T.ext[key], set: (_, key, value) => { T.ext[key] = value; return true; } });'),
    'modal.js': js('export function showThemeModal(dialog) { dialog.open = true; }'),
};
register(js(`let S = {}, R = '';
export async function initialize(data) { S = data.stubs; R = data.dir; }
export async function resolve(spec, ctx, next) {
    const base = spec.split('/').pop();
    if (String(ctx.parentURL || '').startsWith(R) && spec.startsWith('../') && S[base]) return { url: S[base], shortCircuit: true };
    return next(spec, ctx);
}`), { data: { stubs, dir: pathToFileURL(path.join(root, 'src/addons/customstyle')).href } });
const indexUrl = pathToFileURL(path.join(root, 'src/addons/customstyle/index.js')).href;

// ── 가짜 타이머 · 그리기 프레임 ──
const pending = new Map();
let timerSeq = 0;
globalThis.setTimeout = fn => { const id = ++timerSeq; pending.set(id, fn); return id; };
globalThis.clearTimeout = id => { pending.delete(id); };
globalThis.requestAnimationFrame = fn => { const id = ++timerSeq; pending.set(id, fn); return id; };
globalThis.cancelAnimationFrame = id => { pending.delete(id); };
function flush() { for (let i = 0; i < 100 && pending.size; i++) { const [id, fn] = pending.entries().next().value; pending.delete(id); fn(); } }

// ── 작은 DOM 흉내 ──
let ids = new Map();
class El extends EventTarget {
    constructor(tag = 'div', id = '') { super(); this.tagName = tag.toUpperCase(); this.id = id; this.dataset = {}; this.style = { cssText: '' }; this.html = ''; this.children = []; this.parent = null; this.value = ''; this.hidden = false; this.inputs = 0; }
    adopt(html) { for (const m of String(html).matchAll(/<([\w-]+)\b[^>]*?\bid="([^"]+)"/g)) { const child = new El(m[1], m[2]); child.parent = this; this.children.push(child); ids.set(m[2], child); } }
    get innerHTML() { return this.html; }
    set innerHTML(html) { this.html = String(html); this.children = []; this.adopt(html); }
    insertAdjacentHTML(_where, html) { this.html += html; this.adopt(html); }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); if (node.id) ids.set(node.id, node); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    querySelectorAll() { return []; }
    select() {} setSelectionRange() {}
}
function makeDocument() {
    ids = new Map();
    const props = new Map();
    return {
        body: new El('body'), activeElement: null,
        documentElement: { style: { props, setProperty: (name, value) => props.set(name, String(value)), removeProperty: name => props.delete(name) } },
        createElement: tag => new El(tag), getElementById: id => ids.get(id) ?? null, querySelector: () => null,
        execCommand: command => { assert.equal(command, 'copy'); T.copied.push(['exec', document.body.children.at(-1)?.value]); return T.execResult; },
    };
}
globalThis.getComputedStyle = () => ({ getPropertyValue: name => name === '--custom-theme-style-inputs' ? T.config : '' });
globalThis.toastr = { success: m => T.toasts.push(['success', m]), error: m => T.toasts.push(['error', m]), info: m => T.toasts.push(['info', m]) };
globalThis.confirm = message => { T.asked.push(message); return T.confirms.shift() ?? false; };

let caseNo = 0;
async function boot({ ext = {}, config = CONFIG, css = null } = {}) {
    pending.clear();
    Object.assign(T, { ext, saves: 0, handlers: {}, once: {}, toasts: [], confirms: [], asked: [], copied: [], execResult: false });
    T.config = ' ' + JSON.stringify(config);
    globalThis.document = makeDocument();
    let area = null;
    if (css !== null) {
        area = new El('textarea', 'customCSS');
        area.value = css;
        area.addEventListener('input', event => { assert.equal(event.bubbles, true); area.inputs++; });
        document.body.append(area);
    }
    const mod = await import(`${indexUrl}?case=${++caseNo}`);
    flush();
    return { manager: mod.default, area };
}
const click = (manager, id) => manager.handleDelegatedClick({ target: { closest: selector => { assert.equal(selector, '.interactable'); return { id }; } } });

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n' + (error.stack || error)); }
}

// 문자열 안의 ] · 선택지(안쪽 배열)가 있는 설정
const CONFIG = [
    { type: 'slider', varId: 'bl-size', displayText: 'Size [px]', default: '5', min: 0, max: 32, step: 1 },
    { type: 'select', varId: 'bl-mode', displayText: 'Mode', default: 'a', options: [{ label: 'A ]', value: 'a' }, { label: 'B', value: 'b' }] },
    { type: 'text', varId: 'bl-label', displayText: 'Label', default: 'x]y' },
];
const PREFIX = '/* my own rules */\n:root {\n  --custom-theme-style-inputs: ';
const SUFFIX = ';\n  --keep-me: 1;\n}\n.mes_text { color: red; } /* ] after */\n';
const block = config => PREFIX + JSON.stringify(config, null, 2) + SUFFIX;
/** 결과 글에서 배열 부분만 떼어 JSON 으로 */
function arrayOf(text, prefix = PREFIX, suffix = SUFFIX) {
    assert.ok(text.startsWith(prefix), '앞 CSS 그대로');
    assert.ok(text.endsWith(suffix), '뒤 CSS 그대로');
    return JSON.parse(text.slice(prefix.length, text.length - suffix.length));
}

// ---------- 1) · 2) 저장
await test('커스텀 CSS에 저장: 배열만 지금 값으로 (다른 칸 · 선택지는 그대로), 앞뒤 CSS 는 한 글자도 안 바뀜 · 문자열 안의 ] 에서 끊지 않음(5.1.3)', async () => {
    const { manager, area } = await boot({ ext: { CTSI: { entries: { 'bl-size': '9' } } }, css: block(CONFIG) });
    manager.handleDelegatedInput({ target: { dataset: { varId: 'bl-label' }, classList: { contains: () => false }, type: 'text', value: 'new]label' } });
    click(manager, 'ctsi-update-customCSS');
    const saved = arrayOf(area.value);
    assert.deepEqual(saved, [{ ...CONFIG[0], default: '9' }, CONFIG[1], { ...CONFIG[2], default: 'new]label' }]);
    assert.equal(area.inputs, 1, '실리태번이 저장하도록 input 이벤트 한 번');
    assert.equal(T.toasts.at(-1)[0], 'success');
    assert.equal((area.value.match(/--custom-theme-style-inputs/g) || []).length, 1, '두 번 들어가지 않는다');
});

await test('같은 값으로 다시 저장하면 글을 다시 쓰지 않음 (input 이벤트 없음) · 저장한 글을 다시 저장해도 앞뒤 CSS 그대로', async () => {
    const { manager, area } = await boot({ ext: { CTSI: { entries: { 'bl-size': '9' } } }, css: block(CONFIG) });
    manager.updateCustomCSSFile();
    const once = area.value;
    assert.equal(area.inputs, 1);
    manager.updateCustomCSSFile();
    assert.equal(area.value, once); assert.equal(area.inputs, 1);
    assert.match(T.toasts.at(-1)[1], /이미 같은 내용/);
    arrayOf(area.value);
});

await test('배열이 없으면 첫 :root { 바로 안에 넣고 나머지는 그대로 · :root 도 없으면 끝에 새 블록', async () => {
    const withRoot = '.a { color: blue; }\n:root {\n  --x: 1;\n}\n:root { --y: 2; }\n';
    let { manager, area } = await boot({ css: withRoot });
    manager.updateCustomCSSFile();
    const head = '.a { color: blue; }\n:root {\n  --custom-theme-style-inputs: ';
    assert.ok(area.value.startsWith(head));
    const rest = area.value.slice(head.length);
    const json = rest.slice(0, rest.indexOf(';\n'));
    assert.deepEqual(JSON.parse(json), CONFIG);
    assert.equal(rest.slice(json.length), ';\n\n  --x: 1;\n}\n:root { --y: 2; }\n');
    assert.equal(area.inputs, 1);

    const plain = '.b { margin: 0; }';
    ({ manager, area } = await boot({ ext: { CTSI: { entries: { 'bl-mode': 'b' } } }, css: plain }));
    manager.updateCustomCSSFile();
    const appended = arrayOf(area.value, plain + '\n:root {\n  --custom-theme-style-inputs: ', ';\n}');
    assert.equal(appended[1].default, 'b');
    assert.equal(area.inputs, 1);
});

await test('끝을 찾지 못하는 망가진 배열은 그대로 둠 · 입력칸이 없으면 아무것도 쓰지 않고 오류 알림', async () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
        for (const broken of [':root { --custom-theme-style-inputs: [ {"type": "slider" ; }', ':root { --custom-theme-style-inputs: [ {"a": ] } ] ; }\n.c{}']) {
            const { manager, area } = await boot({ css: broken });
            manager.updateCustomCSSFile();
            assert.equal(area.value, broken); assert.equal(area.inputs, 0);
        }
    } finally { console.warn = warn; }
    const { manager } = await boot();
    assert.doesNotThrow(() => manager.updateCustomCSSFile());
    assert.equal(T.toasts.at(-1)[0], 'error');
});

// ---------- 4) 예제 CSS 추가
await test('예제 CSS 추가: 취소하면 그대로 · 확인하면 예제를 앞에 붙이고 기존 CSS 는 뒤에 그대로', async () => {
    const mine = '.mes { padding: 2px; }\n';
    const { manager, area } = await boot({ css: mine, config: [] });
    T.confirms.push(false);
    click(manager, 'insert-default-css');
    for (let i = 0; i < 6; i++) await Promise.resolve();   // 7.0.1 확인 창(ask)은 비동기 — 이 시험은 타이머가 가짜라 마이크로태스크로 기다린다
    assert.equal(area.value, mine); assert.equal(area.inputs, 0); assert.equal(T.asked.length, 1);
    T.confirms.push(true);
    click(manager, 'insert-default-css');
    for (let i = 0; i < 6; i++) await Promise.resolve();   // 7.0.1 확인 창(ask)은 비동기 — 이 시험은 타이머가 가짜라 마이크로태스크로 기다린다
    assert.ok(area.value.endsWith('\n' + mine), '기존 CSS 는 뒤에 그대로');
    const example = area.value.slice(0, -(mine.length + 1));
    assert.match(example, /--custom-theme-style-inputs: \[/);
    assert.match(example, /:root \{/);
    assert.equal(area.inputs, 1);
});

// ---------- 5) 복사
await test('설정 CSS 복사: 지금 값을 기본값으로 한 :root 블록 · 클립보드가 막히면 execCommand · 둘 다 안 되면 오류 (임시 입력칸은 치움)', async () => {
    const write = text => { T.copied.push(['clipboard', text]); };
    Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async text => write(text) } }, configurable: true, writable: true });
    const { manager } = await boot({ ext: { CTSI: { entries: { 'bl-size': '12' } } } });
    await manager.copyToClipboard();
    const [[kind, text]] = T.copied;
    assert.equal(kind, 'clipboard');
    const head = ':root {\n  --custom-theme-style-inputs: ';
    assert.ok(text.startsWith(head) && text.endsWith('\n}'));
    assert.deepEqual(JSON.parse(text.slice(head.length, -2)), [{ ...CONFIG[0], default: '12' }, CONFIG[1], CONFIG[2]]);
    assert.equal(T.toasts.at(-1)[0], 'success');
    assert.equal(T.saves, 0, '복사는 저장 값을 바꾸지 않는다');

    navigator.clipboard.writeText = async () => { throw new Error('blocked'); };
    T.copied = []; T.execResult = true;
    const children = document.body.children.length;
    await manager.copyToClipboard();
    assert.equal(T.copied[0][0], 'exec'); assert.equal(T.copied[0][1], text, '같은 글을 임시 입력칸으로 복사');
    assert.equal(document.body.children.length, children, '임시 입력칸은 치운다');
    assert.equal(T.toasts.at(-1)[0], 'success');
    T.execResult = false;
    await manager.copyToClipboard();
    assert.equal(T.toasts.at(-1)[0], 'error');
    assert.equal(document.body.children.length, children);
});

delete globalThis.__ctsiSaveTest;
console.log(`customstyle-css-save: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
