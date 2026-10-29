// 커스텀 CSS 조절 (src/addons/customstyle/index.js) — 조절 값 저장 (extension_settings.CTSI.entries)
//   1) 켤 때: 이미 있는 CTSI 설정을 같은 객체로 이어 쓰고, 새 항목만 기본값으로 채움 (select 는 없는 기본값이면 첫 선택지) · 사용자 값과
//      지금 CSS 에 없는 항목의 값은 지우지 않음 · 부팅은 한 번만 (5.1.3) · 켜기만으로는 저장하지 않음 · 단위(-unit) · 빈 값은 적용 안 함
//   2) 입력: 슬라이더 ↔ 숫자칸 함께 · 글자 · 체크 · 선택 · 색 고르기 → 값 저장 + CSS 변수, varId 없는 입력은 무시
//   3) 기본값 복원: 취소 → 그대로, 확인 → 지금 CSS 의 항목만 기본값 (다른 저장 값은 남김)
//   4) CSS 가 바뀜 (SETTINGS_UPDATED): 빠진 항목은 CSS 변수만 지우고 값은 남겨 다시 생기면 그 값 · 같은 CSS 면 다시 만들지 않음 ·
//      망가진 JSON · 잘못된 항목 · 겹친 varId 는 걸러지고 저장 값은 그대로
//   5) 6.7.8 로딩 화면 동안의 SETTINGS_UPDATED 는 APP_READY 뒤 한 번만 · 부팅 전에는 무시
//   6) 사용자 CSS 의 글이 화면 HTML 로 새지 않음 (이스케이프)
//   7) 기본값이 숫자 0 인 슬라이더 — 값이 빈칸이 되어 CSS 에도 저장 글에도 0 이 사라지는 문제 (보고한 버그, 고치기 전에는 이 항목이 실패)
// 실리태번 모듈(script.js · extensions.js)과 테마 modal.js 는 data: 스텁, DOM · 타이머 · requestAnimationFrame 은 작은 가짜. 네트워크 없음.
//   node tools/tests/customstyle-values.mjs <테마 루트>
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const T = globalThis.__ctsiValuesTest = { ext: {}, saves: 0, handlers: {}, once: {}, config: '', reads: 0, toasts: [], confirms: [], asked: [], pickers: {} };
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const G = 'const T = globalThis.__ctsiValuesTest;\n';
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

// ── 가짜 타이머 · 그리기 프레임 (넣은 차례대로 돌린다) ──
const pending = new Map();
let timerSeq = 0;
globalThis.setTimeout = fn => { const id = ++timerSeq; pending.set(id, fn); return id; };
globalThis.clearTimeout = id => { pending.delete(id); };
globalThis.requestAnimationFrame = fn => { const id = ++timerSeq; pending.set(id, fn); return id; };
globalThis.cancelAnimationFrame = id => { pending.delete(id); };
function flush() {
    for (let i = 0; i < 100 && pending.size; i++) { const [id, fn] = pending.entries().next().value; pending.delete(id); fn(); }
    assert.equal(pending.size, 0, '타이머가 끝없이 생기지 않는다');
}

// ── 작은 DOM 흉내: id 가 있는 태그만 요소로 만들고, 색 고르기는 그린 HTML 에서 찾는다 ──
let ids = new Map();
class El extends EventTarget {
    constructor(tag = 'div', id = '') { super(); this.tagName = tag.toUpperCase(); this.id = id; this.dataset = {}; this.style = { cssText: '' }; this.html = ''; this.children = []; this.parent = null; this.value = ''; this.hidden = false; }
    adopt(html) { for (const m of String(html).matchAll(/<([\w-]+)\b[^>]*?\bid="([^"]+)"/g)) { const child = new El(m[1], m[2]); child.parent = this; this.children.push(child); ids.set(m[2], child); } }
    get innerHTML() { return this.html; }
    set innerHTML(html) { this.html = String(html); this.children = []; this.adopt(html); }
    insertAdjacentHTML(_where, html) { this.html += html; this.adopt(html); }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); if (node.id) ids.set(node.id, node); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    get allHtml() { return this.html + this.children.map(child => child.allHtml).join(''); }
    querySelectorAll(selector) {
        if (selector !== 'toolcool-color-picker') return [];
        return [...this.allHtml.matchAll(/<toolcool-color-picker data-var-id="([^"]+)" color="([^"]*)"/g)].map(m => {
            const picker = new El('toolcool-color-picker'); picker.dataset.varId = m[1]; picker.color = m[2]; T.pickers[m[1]] = picker; return picker;
        });
    }
}
function makeDocument({ loader = false, head = false } = {}) {
    ids = new Map();
    const props = new Map();
    const doc = {
        body: new El('body'), activeElement: null,
        documentElement: { style: { props, setProperty: (name, value) => props.set(name, String(value)), removeProperty: name => props.delete(name) } },
        createElement: tag => new El(tag), getElementById: id => ids.get(id) ?? null, querySelector: () => null,
    };
    if (loader) ids.set('loader', new El('div', 'loader'));
    // 7.7.4 <head> 의 사용자 CSS(<style>) 한 장 — 글은 지금 설정 변수(T.config)와 함께 바뀐다
    if (head) {
        const style = { tagName: 'STYLE', disabled: false, sheet: { cssRules: { length: 1 } }, getAttribute: () => null, get textContent() { return `:root{--custom-theme-style-inputs:${T.config}}`; } };
        doc.head = { querySelectorAll: () => [style] };
        doc.documentElement.getAttribute = () => null;
    }
    return doc;
}
globalThis.getComputedStyle = () => ({ getPropertyValue: name => { T.reads++; return name === '--custom-theme-style-inputs' ? T.config : ''; } });
globalThis.toastr = { success: m => T.toasts.push(['success', m]), error: m => T.toasts.push(['error', m]), info: m => T.toasts.push(['info', m]) };
globalThis.confirm = message => { T.asked.push(message); return T.confirms.shift() ?? false; };

let caseNo = 0;
/** 모듈을 새로 읽어 (새 관리자 · 새 문서) 부팅까지 돌린다 */
async function boot({ ext = {}, config = CONFIG, loader = false, run = true, head = false } = {}) {
    pending.clear();
    Object.assign(T, { ext, saves: 0, handlers: {}, once: {}, reads: 0, toasts: [], confirms: [], asked: [], pickers: {} });
    setConfig(config);
    globalThis.document = makeDocument({ loader, head });
    const mod = await import(`${indexUrl}?case=${++caseNo}`);
    if (run) flush();
    return { manager: mod.default, css: document.documentElement.style.props };
}
const setConfig = config => { T.config = typeof config === 'string' ? config : ' ' + JSON.stringify(config); };
const emit = name => {
    for (const fn of T.handlers[name] ?? []) fn();
    const once = T.once[name] ?? []; T.once[name] = [];
    for (const fn of once) fn();
};
async function quiet(fn) {
    const saved = [console.error, console.warn];
    console.error = console.warn = () => {};
    try { return await fn(); } finally { [console.error, console.warn] = saved; }
}

let passed = 0, failed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.error('FAIL ' + name + '\n' + (error.stack || error)); }
}

const CONFIG = [
    { type: 'slider', varId: 'bl-size', displayText: 'Text size', default: '5', min: 0, max: 32, step: 1 },
    { type: 'color', varId: 'bl-bg', displayText: 'Background', default: 'rgba(10, 20, 30, 0.5)' },
    { type: 'text', varId: 'bl-speed', displayText: 'Speed', default: '0.1s' },
    { type: 'checkbox', varId: 'bl-flag', displayText: 'Flag', checked: true },
    { type: 'select', varId: 'bl-vis', displayText: 'Visibility', default: 'hidden', options: [{ label: 'visible', value: 'visible' }, { label: 'hidden', value: 'hidden' }] },
    { type: 'select', varId: 'bl-width', displayText: 'Width', default: 'missing', options: [{ label: 'Wide', value: '512px' }, { label: 'None', value: '0px' }] },
];
const DEFAULTS = { 'bl-size': '5', 'bl-bg': 'rgba(10, 20, 30, 0.5)', 'bl-speed': '0.1s', 'bl-flag': true, 'bl-vis': 'hidden', 'bl-width': '512px' };

// ---------- 1) 켤 때
await test('켤 때: 기존 CTSI 를 같은 객체로 이어 쓰고 새 항목만 기본값 · 사용자 값과 지금 CSS 에 없는 값은 그대로 · 저장은 하지 않음', async () => {
    const saved = { entries: { 'bl-size': '20', 'bl-retired': 'keep-me' }, note: 'untouched' };
    const { manager, css } = await boot({ ext: { CTSI: saved } });
    assert.equal(manager.settings, saved, '같은 객체 — 고친 값이 그대로 extension_settings 에 남는다');
    assert.equal(T.ext.CTSI, saved); assert.equal(saved.note, 'untouched');
    assert.deepEqual(saved.entries, { ...DEFAULTS, 'bl-size': '20', 'bl-retired': 'keep-me' });
    assert.equal(css.get('--bl-size'), '20'); assert.equal(css.get('--bl-bg'), DEFAULTS['bl-bg']); assert.equal(css.get('--bl-flag'), 'true');
    assert.equal(css.get('--bl-width'), '512px', '없는 기본값이면 첫 선택지');
    assert.equal(css.has('--bl-retired'), false, '지금 CSS 에 없는 항목은 적용하지 않는다');
    assert.equal(T.saves, 0, '켜기만으로는 저장하지 않는다');
    assert.equal((ids.get('bl-ctsi-holder').allHtml.match(/id="ctsi-drawer"/g) || []).length, 1, '프레임 · 1초 타이머 둘 다 와도 부팅은 한 번 (5.1.3)');
    const fresh = await boot({ ext: {} });
    assert.deepEqual(T.ext.CTSI, { entries: DEFAULTS }, 'CTSI 가 없으면 새로 만든다');
    assert.equal(fresh.manager.settings, T.ext.CTSI);
});

await test('단위: 저장한 `<varId>-unit` 을 붙여 적용 · 빈 값은 CSS 변수로 쓰지 않음', async () => {
    const { css } = await boot({ ext: { CTSI: { entries: { 'bl-size': '14', 'bl-size-unit': 'px', 'bl-speed': '' } } } });
    assert.equal(css.get('--bl-size'), '14px');
    assert.equal(css.has('--bl-speed'), false);
    assert.equal(css.has('--bl-size-unit'), false);
    assert.equal(T.ext.CTSI.entries['bl-speed'], '', '사용자가 비운 값은 기본값으로 되돌리지 않는다');
});

// ---------- 2) 입력
await test('입력: 슬라이더 ↔ 숫자칸 함께 · 글자 · 체크 · 선택 · 색 고르기 — 값 저장(saveSettingsDebounced) + CSS 변수, varId 없는 입력은 무시', async () => {
    const { manager, css } = await boot({ ext: { CTSI: { entries: {} } } });
    const entries = T.ext.CTSI.entries;
    const pair = () => {
        const slider = { dataset: { varId: 'bl-size' }, classList: { contains: c => c === 'neo-range-slider' }, value: '' };
        const number = { dataset: { varId: 'bl-size' }, classList: { contains: c => c === 'neo-range-input' }, value: '' };
        const box = { querySelectorAll: selector => { assert.equal(selector, '[data-var-id="bl-size"]'); return [slider, number]; } };
        slider.closest = number.closest = selector => { assert.equal(selector, '.alignitemscenter'); return box; };
        return { slider, number };
    };
    let { slider, number } = pair();
    slider.value = '18';
    manager.handleDelegatedInput({ target: slider });
    assert.equal(number.value, '18'); assert.equal(entries['bl-size'], '18'); assert.equal(css.get('--bl-size'), '18'); assert.equal(T.saves, 1);
    ({ slider, number } = pair());
    number.value = '7';
    manager.handleDelegatedInput({ target: number });
    assert.equal(slider.value, '7'); assert.equal(entries['bl-size'], '7');
    manager.handleDelegatedInput({ target: { dataset: { varId: 'bl-speed' }, classList: { contains: () => false }, type: 'text', value: '0.4s' } });
    assert.equal(entries['bl-speed'], '0.4s'); assert.equal(css.get('--bl-speed'), '0.4s');
    manager.handleDelegatedChange({ target: { dataset: { varId: 'bl-flag' }, type: 'checkbox', checked: false } });
    assert.equal(entries['bl-flag'], false); assert.equal(css.get('--bl-flag'), 'false');
    manager.handleDelegatedChange({ target: { dataset: { varId: 'bl-vis' }, type: 'select-one', tagName: 'SELECT', value: 'visible' } });
    assert.equal(entries['bl-vis'], 'visible'); assert.equal(css.get('--bl-vis'), 'visible');
    const picker = T.pickers['bl-bg'];
    assert.ok(picker, '색 고르기를 그렸다');
    picker.dispatchEvent(Object.assign(new Event('change'), { detail: { rgba: 'rgba(1, 2, 3, 1)' } }));
    assert.equal(entries['bl-bg'], 'rgba(1, 2, 3, 1)'); assert.equal(css.get('--bl-bg'), 'rgba(1, 2, 3, 1)');
    picker.dispatchEvent(Object.assign(new Event('change'), { detail: { hex: '#abcdef' } }));
    assert.equal(entries['bl-bg'], '#abcdef');
    assert.equal(T.saves, 7);
    manager.handleDelegatedInput({ target: { dataset: {}, classList: { contains: () => true }, type: 'text', value: 'x' } });
    manager.handleDelegatedChange({ target: { dataset: {}, type: 'checkbox', checked: true } });
    manager.handleDelegatedInput({ target: { dataset: { varId: 'bl-size' }, classList: { contains: () => false }, type: 'number', value: '99' } });
    assert.equal(T.saves, 7, 'varId 없는 입력 · 다른 종류의 칸은 저장하지 않는다');
    assert.equal(entries['bl-size'], '7');
});

// ---------- 3) 기본값 복원
await test('기본값 복원: 취소하면 그대로 · 확인하면 지금 CSS 의 항목만 기본값으로 (다른 저장 값은 남김) 저장', async () => {
    const { manager, css } = await boot({ ext: { CTSI: { entries: { 'bl-size': '30', 'bl-vis': 'visible', 'bl-retired': 'keep-me' } } } });
    const entries = T.ext.CTSI.entries;
    T.confirms.push(false);
    manager.handleDelegatedClick({ target: { closest: () => ({ id: 'ctsi-reset-defaults' }) } });
    for (let i = 0; i < 6; i++) await Promise.resolve();   // 7.0.1 확인 창(ask)은 비동기 — 이 시험은 타이머가 가짜라 마이크로태스크로 기다린다
    assert.equal(entries['bl-size'], '30'); assert.equal(T.saves, 0); assert.equal(T.asked.length, 1);
    T.confirms.push(true);
    manager.handleDelegatedClick({ target: { closest: () => ({ id: 'ctsi-reset-defaults' }) } });
    for (let i = 0; i < 6; i++) await Promise.resolve();   // 7.0.1 확인 창(ask)은 비동기 — 이 시험은 타이머가 가짜라 마이크로태스크로 기다린다
    assert.deepEqual(entries, { ...DEFAULTS, 'bl-retired': 'keep-me' });
    assert.equal(T.ext.CTSI.entries, entries);
    assert.equal(css.get('--bl-size'), '5'); assert.equal(css.get('--bl-vis'), 'hidden');
    assert.equal(T.saves, 1);
    assert.equal(T.toasts.at(-1)[0], 'info');
    manager.handleDelegatedClick({ target: { closest: () => null } });
    assert.equal(T.saves, 1);
});

await test('1029 기본값 복원: 기본값이 없는 항목(빈 글자칸)은 적용해 둔 CSS 변수를 지워 사용자 CSS 의 값으로 돌아가요 (예전엔 새로고침 전까지 옛 값이 남았어요)', async () => {
    const config = [...CONFIG, { type: 'text', varId: 'bl-note', displayText: 'Note' }];
    const { manager, css } = await boot({ config, ext: { CTSI: { entries: { 'bl-note': 'mine', 'bl-size': '30' } } } });
    assert.equal(css.get('--bl-note'), 'mine');
    T.confirms.push(true);
    manager.handleDelegatedClick({ target: { closest: () => ({ id: 'ctsi-reset-defaults' }) } });
    for (let i = 0; i < 6; i++) await Promise.resolve();
    assert.equal(css.has('--bl-note'), false, '기본값 없는 항목의 옛 값이 화면에 남으면 안 돼요');
    assert.equal(css.get('--bl-size'), '5', '기본값 있는 항목은 기본값');
});

// ---------- 4) CSS 가 바뀔 때
await test('CSS 가 바뀜: 같은 CSS 면 다시 만들지 않음 · 빠진 항목은 CSS 변수만 지우고 값은 남김 · 다시 생기면 저장 값으로 · 이 과정에서 저장 없음', async () => {
    await boot({ ext: { CTSI: { entries: { 'bl-bg': '#123456' } } } });
    const { css } = { css: document.documentElement.style.props };
    const firstPicker = T.pickers['bl-bg'];
    emit('settings_updated'); flush();
    assert.equal(T.pickers['bl-bg'], firstPicker, '처음 SETTINGS_UPDATED 에 화면을 다시 만들지 않는다 (5.1.3)');
    setConfig(CONFIG.filter(entry => entry.varId !== 'bl-bg'));
    emit('settings_updated'); emit('settings_updated'); flush();
    assert.equal(css.has('--bl-bg'), false);
    assert.equal(T.ext.CTSI.entries['bl-bg'], '#123456');
    setConfig(CONFIG);
    emit('settings_updated'); flush();
    assert.equal(css.get('--bl-bg'), '#123456', '지웠다 다시 넣은 항목은 사용자가 고른 값으로');
    assert.equal(T.saves, 0);
});

await test('망가진 CSS: JSON 아님 · 배열 아님 → 조절 칸 없음 안내, 적용한 변수는 지우되 저장 값은 그대로 · 잘못된 항목과 겹친 varId 는 거름', async () => {
    const { manager } = await boot({ ext: { CTSI: { entries: { 'bl-size': '11' } } } });
    const css = document.documentElement.style.props;
    const before = structuredClone(T.ext.CTSI.entries);
    for (const broken of [' [ {"type": "slider",', ' {"type":"slider"}', 'none', ' ']) {
        setConfig(broken);
        await quiet(() => { emit('settings_updated'); flush(); });
        assert.deepEqual(T.ext.CTSI.entries, before, JSON.stringify(broken));
        assert.equal(css.has('--bl-size'), false, '지금 CSS 에 없는 항목의 변수는 지운다');
        assert.match(ids.get('cts-row-1').html, /조절 항목이 아직 없어요/);
    }
    setConfig([
        { type: 'range', varId: 'bl-a', displayText: 'A' }, { type: 'slider', varId: '1bad', displayText: 'B' }, { type: 'text', varId: 'bl-c' },
        { type: 'text', varId: 'bl-d;color:red', displayText: 'D' }, null,
        { type: 'text', varId: 'bl-e', displayText: 'E first', default: '1' }, { type: 'text', varId: 'bl-e', displayText: 'E again', default: '2' },
    ]);
    const parsed = await quiet(() => manager._parseCSSConfig('--custom-theme-style-inputs'));
    assert.deepEqual(parsed.map(entry => [entry.varId, entry.displayText]), [['bl-e', 'E first']]);
    setConfig(CONFIG);
    emit('settings_updated'); flush();
    assert.equal(css.get('--bl-size'), '11', 'CSS 를 고치면 저장해 둔 값이 그대로 돌아온다');
});

await test('7.7.2 <head> 스타일 시트 · <html> 속성이 그대로면 SETTINGS_UPDATED 에 :root 계산 스타일을 다시 읽지 않음 · 시트 글이 바뀌면 읽고 다시 만듦', async () => {
    await boot({ ext: { CTSI: { entries: {} } }, head: true });
    const css = document.documentElement.style.props;
    const reads = T.reads;
    for (let i = 0; i < 5; i++) { emit('settings_updated'); flush(); }
    assert.equal(T.reads, reads, '그대로인 CSS 를 다시 읽음');
    setConfig([...CONFIG, { type: 'text', varId: 'bl-new', displayText: 'New', default: 'fresh' }]);   // 사용자 CSS 를 고침 (<style> 글이 바뀜)
    emit('settings_updated'); flush();
    assert.ok(T.reads > reads, '바뀐 CSS 를 안 읽음');
    assert.equal(css.get('--bl-new'), 'fresh');
    assert.equal(T.saves, 0);
});

// ---------- 5) 로딩 화면 · 부팅 전
await test('6.7.8 로딩 화면 동안의 SETTINGS_UPDATED 는 :root 스타일을 읽지 않고 모았다가 APP_READY 뒤 한 번만 다시 읽음', async () => {
    await boot({ ext: { CTSI: { entries: {} } }, loader: true });
    const css = document.documentElement.style.props;
    setConfig([...CONFIG, { type: 'text', varId: 'bl-new', displayText: 'New', default: 'fresh' }]);
    const reads = T.reads;
    for (let i = 0; i < 5; i++) emit('settings_updated');
    flush();
    assert.equal(T.reads, reads, '로딩 중에는 읽지 않는다');
    assert.equal(T.ext.CTSI.entries['bl-new'], undefined);
    emit('app_ready'); flush();
    assert.equal(T.ext.CTSI.entries['bl-new'], 'fresh');
    assert.equal(css.get('--bl-new'), 'fresh');
    setConfig(CONFIG.filter(entry => entry.varId !== 'bl-size'));
    emit('settings_updated'); flush();
    assert.equal(css.has('--bl-size'), false, 'APP_READY 뒤에는 평소대로');
    assert.equal(T.saves, 0);
});

await test('부팅 전의 SETTINGS_UPDATED 는 아무 일도 예약하지 않음 · APP_READY 가 없으면 로딩 화면이 없을 때 바로 평소대로', async () => {
    await boot({ ext: { CTSI: { entries: {} } }, run: false });
    const before = pending.size;
    emit('settings_updated');
    assert.equal(pending.size, before);
    assert.equal(T.once.app_ready, undefined, '로딩 화면이 없으면 APP_READY 를 기다리지 않는다');
    flush();
    assert.deepEqual(T.ext.CTSI.entries, DEFAULTS);
});

// ---------- 6) 이스케이프
await test('사용자 CSS 의 글(이름 · 기본값 · 선택지 · 저장 값)은 화면 HTML 로 새지 않음', async () => {
    const evil = [
        { type: 'text', varId: 'bl-t', displayText: '<img src=x onerror=alert(1)>', default: '"><b>x</b>' },
        { type: 'select', varId: 'bl-s', displayText: 'S', default: 'a', options: [{ label: '<i>A</i>', value: 'a"onclick="x' }] },
    ];
    await boot({ ext: { CTSI: { entries: { 'bl-t': '" autofocus onfocus="x' } } }, config: evil });
    const html = ids.get('cts-row-1').html + ids.get('cts-row-2').html;
    assert.doesNotMatch(html, /<img|<b>|<i>|" autofocus|"onclick=/, '태그 · 속성으로 새지 않는다');
    assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html, /value="&quot; autofocus onfocus=&quot;x"/);
    assert.equal(T.ext.CTSI.entries['bl-t'], '" autofocus onfocus="x', '저장 값 자체는 바꾸지 않는다');
});

// ---------- 7) 기본값 0 (보고한 버그)
await test('[버그] 기본값이 숫자 0 인 슬라이더: 값은 0 이어야 하고 (빈칸이 아님) CSS 변수와 커스텀 CSS 저장 글에도 0 이 남아야 함', async () => {
    const { manager, css } = await boot({ ext: { CTSI: { entries: {} } }, config: [{ type: 'slider', varId: 'bl-zero', displayText: 'Blur', default: 0, min: 0, max: 10, step: 1 }] });
    assert.equal(String(T.ext.CTSI.entries['bl-zero']), '0', `저장 값이 ${JSON.stringify(T.ext.CTSI.entries['bl-zero'])} — 기본값 0 이 사라졌다 (syncSettingsWithConfig 의 entry.default || '')`);
    assert.equal(css.get('--bl-zero'), '0');
    assert.equal(String(JSON.parse(manager.generateSettingsJSON())[0].default), '0', '커스텀 CSS 에 저장하면 "default": 0 이 "" 로 바뀐다');
});

delete globalThis.__ctsiValuesTest;
console.log(`customstyle-values: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
