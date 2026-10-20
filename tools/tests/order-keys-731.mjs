// 7.3.1 확장 순서 1.2.4 — 공용 틀 class(inline-drawer)뿐인 설정 창은 바깥 칸(.extension_container) id 로 부른다.
//   1.2.3 은 그런 창이 모두 'cls:inline-drawer', 'cls:inline-drawer#2' … (읽힌 차례 번호)라 확장을 깔거나 지우면 숨김 · 고정이 다른 창으로 옮겨 갔다.
//   예전 이름표는 한 번, 지금 가리키는 창의 새 이름표로 옮긴다 (pinned · order · panelHidden · 테마의 확장 위 스위치 headSwitches).
//   가짜 DOM · 스텁은 order-apply.mjs 와 같다. 지어낸 확장 이름만 쓴다.
//   node tools/tests/order-keys-731.mjs <테마 루트>
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const orderDir = pathToFileURL(path.join(root, 'src/addons/order')).href + '/';
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__orderKeysTest = { ext: {}, saves: 0, wide: false, moves: 0, theme: { addonUI: {} } };
const G = 'const T = globalThis.__orderKeysTest;\n';
const STUBS = {
    'extensions.js': js(G + 'export const extension_settings = T.ext;'),
    'script.js': js(G + 'export function saveSettingsDebounced() { T.saves++; }'),
    'popup.js': js('export const POPUP_TYPE = { TEXT: 1 }; export async function callGenericPopup() { return null; }'),
    'theme-settings.js': js(G + 'export function getSettings() { return T.theme; } export function saveSettings() {}'),
};
register(js(`let S = {}, DIR = '';
export async function initialize(d) { S = d.stubs; DIR = d.dir; }
export async function resolve(spec, ctx, next) {
    if (String(ctx.parentURL || '').startsWith(DIR)) {
        const ups = (spec.match(/\\.\\.\\//g) || []).length, base = spec.split('/').pop();
        if (ups >= 3 && S[base]) return { url: S[base], shortCircuit: true };
        if (ups === 2 && base === 'settings.js') return { url: S['theme-settings.js'], shortCircuit: true };
    }
    return next(spec, ctx);
}`), { data: { stubs: STUBS, dir: orderDir } });

// ── 작은 가짜 DOM ──
class Classes extends Set {
    add(...names) { for (const n of names) super.add(n); return this; }
    remove(...names) { for (const n of names) this.delete(n); }
    contains(n) { return this.has(n); }
    toggle(n, force) { const on = force === undefined ? !this.has(n) : !!force; if (on) super.add(n); else this.delete(n); return on; }
}
class FakeEl {
    constructor(tag = 'div', { id = '', cls = [] } = {}) {
        this.tagName = tag.toUpperCase(); this.id = id; this.classList = new Classes(cls);
        this.children = []; this.parentElement = null; this.dataset = {}; this.style = {}; this.attrs = {}; this.textContent = '';
    }
    get className() { return [...this.classList].join(' '); }
    set className(v) { this.classList = new Classes(String(v).split(/\s+/).filter(Boolean)); }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    _detach() { const p = this.parentElement; if (p) { p.children.splice(p.children.indexOf(this), 1); this.parentElement = null; } }
    append(...nodes) { for (const n of nodes) { n._detach(); n.parentElement = this; this.children.push(n); } }
    insertBefore(node, ref) {
        if (ref && ref.parentElement !== this) throw new Error('NotFoundError: 기준 마디가 이 칸의 자식이 아님');
        T.moves++;
        node._detach();
        this.children.splice(ref ? this.children.indexOf(ref) : this.children.length, 0, node);
        node.parentElement = this;
        return node;
    }
    remove() { this._detach(); }
    cloneNode(deep) { const c = new FakeEl(this.tagName, { id: this.id, cls: [...this.classList] }); c.textContent = this.textContent; if (deep) c.append(...this.children.map(k => k.cloneNode(true))); return c; }
    matches(sel) { return sel.split(',').some(s => { s = s.trim(); if (s.startsWith('.')) return this.classList.has(s.slice(1)); if (s.startsWith('#')) return this.id === s.slice(1); return this.tagName === s.toUpperCase(); }); }
    *walk() { for (const c of this.children) { yield c; yield* c.walk(); } }
    querySelectorAll(sel) { return [...this.walk()].filter(el => el.matches(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
}
const body = new FakeEl('body');
globalThis.HTMLElement = FakeEl;
globalThis.document = { body, createElement: tag => new FakeEl(tag), getElementById: id => [...body.walk()].find(el => el.id === id) ?? null, querySelector: () => null, querySelectorAll: () => [] };
globalThis.matchMedia = () => ({ get matches() { return T.wide; }, addEventListener() {} });
globalThis.MutationObserver = class { observe() {} disconnect() {} };

const S = await import(orderDir + 'state.js');
const O = await import(orderDir + 'order.js');

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log(`  ok   ${name}`); }
    catch (e) { fail++; console.log(`  FAIL ${name}\n       ${String(e?.stack || e?.message || e).split('\n').slice(0, 6).join('\n       ')}`); }
}
// 확장 설정 창: 접기 머리(.inline-drawer-toggle) 안 <b> 제목 — labelOf 가 읽는 모양
const NAME = new Map();
function panel(id, label, cls = []) {
    const el = new FakeEl('div', { id, cls }), head = new FakeEl('div', { cls: ['inline-drawer-toggle'] }), b = new FakeEl('b');
    b.textContent = label; head.append(b); el.append(head); NAME.set(el, label.trim());
    return el;
}
function box(...kids) { const el = new FakeEl('div', { cls: ['extension_container'] }); el.append(...kids); return el; }
function page(first, second) {
    for (const old of [...body.children]) old.remove();
    const c1 = new FakeEl('div', { id: 'extensions_settings' }), c2 = new FakeEl('div', { id: 'extensions_settings2' });
    c1.append(...first); c2.append(...second); body.append(c1, c2);
    return { c1, c2 };
}
// 한 칸에 보이는 차례: 창 이름 · 구분선은 '|' · 칸막이 안의 창도 (그 칸막이 자리에서)
const seq = col => col.children.flatMap(c => c.id === 'po-divider' ? ['|'] : c.classList.contains('extension_container') ? c.children.filter(k => NAME.has(k)).map(k => NAME.get(k)) : NAME.has(c) ? [NAME.get(c)] : []);
// 늘 쓰는 서랍: 정규식(칸막이 + <style>) · 베타 / 알파 · 빠른 답장(칸막이 하나) · 감마 + 델타(칸막이 하나에 둘)
function standard() {
    const P = { regex: panel('', '정규식', ['regex_settings']), qr: panel('qr--settings', '빠른 답장'), gamma: panel('ext_gamma', '감마 도구'), delta: panel('ext_delta', '델타 도구'), beta: panel('ext_beta', '베타 도구'), alpha: panel('ext_alpha', '알파 도구') };
    const regexBox = box(new FakeEl('style'), P.regex); regexBox.id = 'regex_container';
    const qrBox = box(P.qr), pairBox = box(P.gamma, P.delta);
    return { ...P, regexBox, qrBox, pairBox, ...page([regexBox, P.beta], [P.alpha, qrBox, pairBox]) };
}
function settingsFrom(saved) { for (const k of Object.keys(T.ext)) delete T.ext[k]; if (saved !== undefined) T.ext.panel_order = structuredClone(saved); return S.initSettings(); }
const K = await import(orderDir + 'panel-keys.js');
const fs = await import('node:fs');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
// 바깥 칸에만 id 가 있는 확장: <div id="x_container" class="extension_container"><div class="inline-drawer">…</div></div>
function generic(containerId, label) { const el = panel('', label, ['inline-drawer']); const b = box(el); if (containerId) b.id = containerId; return { el, box: b }; }
function regexBlock() { const el = panel('', '정규식', ['regex_settings']); const b = box(new FakeEl('style'), el); b.id = 'regex_container'; return { el, box: b }; }

await test('이름표: 공용 틀 창 → 바깥 칸 id · 자기 class 가 있는 창(정규식)과 id 가 있는 창은 그대로 · 칸에 id 가 없으면 예전 그대로', () => {
    const a = generic('alpha_container', '알파'), r = regexBlock(), q = panel('qr--settings', '빠른 답장'), bare = generic('', '이름 없는 칸');
    page([a.box, r.box, q, bare.box], []);
    assert.equal(K.keyOf(a.el), 'id:alpha_container');
    assert.equal(K.keyOf(r.el), 'cls:regex_settings', 'DEFAULT_PINNED 의 정규식 이름표는 바뀌지 않는다');
    assert.equal(K.keyOf(q), 'id:qr--settings');
    assert.equal(K.keyOf(bare.el), 'cls:inline-drawer');
    assert.equal(K.legacyKeyOf(a.el), 'cls:inline-drawer');
    const wide = panel('', '넓은 틀', ['inline-drawer', 'wide100p']); const wb = box(wide); wb.id = 'wide_container';
    assert.equal(K.keyOf(wide), 'id:wide_container', 'wide100p 도 공용 틀');
    assert.ok(K.ambiguousLegacyKey('cls:inline-drawer#3') && K.ambiguousLegacyKey('cls:inline-drawer.wide100p') && !K.ambiguousLegacyKey('cls:regex_settings') && !K.ambiguousLegacyKey('id:x'));
});

await test('확장을 하나 더 깔아도(앞에 끼어도) 숨김 · 고정이 다른 창으로 옮겨 가지 않는다', () => {
    T.wide = false;
    const a = generic('alpha_container', '알파'), b = generic('beta_container', '베타');
    page([a.box, b.box], []);
    settingsFrom({ pinned: [], panelHidden: ['id:beta_container'], keyVersion: 2 });
    O.apply();
    assert.ok(b.el.classList.has('po-panel-hidden') && !a.el.classList.has('po-panel-hidden'));
    // 새 확장 감마가 맨 앞에 읽힘 (1.2.3 이면 cls:inline-drawer 번호가 하나씩 밀렸다)
    const a2 = generic('alpha_container', '알파'), b2 = generic('beta_container', '베타'), c2 = generic('gamma_container', '감마');
    page([c2.box, a2.box, b2.box], []);
    O.apply();
    assert.deepEqual(O.scan().map(p => p.key).sort(), ['id:alpha_container', 'id:beta_container', 'id:gamma_container']);
    assert.ok(b2.el.classList.has('po-panel-hidden') && !a2.el.classList.has('po-panel-hidden') && !c2.el.classList.has('po-panel-hidden'));
});

await test('옮기기: 예전 cls:inline-drawer(#n) 숨김 · 고정 · 확장 위 스위치 → 지금 가리키는 창의 새 이름표, 끝낼 때 아무 창도 안 가리키는 공용 틀 이름표만 뺀다', () => {
    T.wide = false;
    const a = generic('alpha_container', '알파'), b = generic('beta_container', '베타'), r = regexBlock();
    page([a.box, r.box, b.box], []);
    T.theme.headSwitches = { 'cls:inline-drawer#2': true, 'id:ext_kept': true, 'cls:inline-drawer#7': true };
    settingsFrom({ pinned: ['cls:regex_settings', 'cls:inline-drawer#2'], order: [], panelHidden: ['cls:inline-drawer', 'cls:inline-drawer#5', 'id:gone_ext'] });
    assert.equal(S.settings().keyVersion, undefined, '예전 설정에는 판 표시가 없다');
    O.apply();
    assert.deepEqual(S.settings().panelHidden, ['id:alpha_container', 'cls:inline-drawer#5', 'id:gone_ext'], '읽힌 첫째 공용 창 = 알파');
    assert.deepEqual(S.settings().pinned, ['cls:regex_settings', 'id:beta_container']);
    assert.deepEqual(T.theme.headSwitches, { 'id:beta_container': true, 'id:ext_kept': true, 'cls:inline-drawer#7': true });
    assert.ok(a.el.classList.has('po-panel-hidden') && !b.el.classList.has('po-panel-hidden'), '보이는 모습은 그대로 (같은 창이 숨음)');
    O.migrateLegacyKeys(O.scan(), { finish: true });
    assert.equal(S.settings().keyVersion, 2);
    assert.deepEqual(S.settings().panelHidden, ['id:alpha_container', 'id:gone_ext'], '가리킬 창이 없는 cls:inline-drawer#5 는 뺀다 · 꺼 둔 확장의 id 는 둔다');
    assert.deepEqual(T.theme.headSwitches, { 'id:beta_container': true, 'id:ext_kept': true });
    // 한 번만: 그다음 줄 세우기는 옮기지 않는다
    const saved = JSON.stringify(S.settings());
    O.apply();
    assert.equal(JSON.stringify(S.settings()), saved);
    delete T.theme.headSwitches;
});

await test('새로 켠 사람은 처음부터 새 이름표(keyVersion 2) — 옮길 것 없음 · 판 1.2.4 (JS = CSS) · CI', () => {
    settingsFrom(undefined);
    assert.equal(S.settings().keyVersion, 2);
    assert.equal(O.migrateLegacyKeys([]), 0);
    assert.match(read('src/addons/order/state.js'), /export const VERSION = '1\.2\.4';/);
    assert.match(read('src/addons/order/style.css'), /--po-css-version: "1\.2\.4";/);
    assert.match(read('src/addons/order/order.js'), /setTimeout\(\(\) => \{ try \{ migrateLegacyKeys\(scan\(\), \{ finish: true \}\); apply\(\); \}/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/order-keys-731\.mjs \./);
});

console.log(`order-keys-731: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
