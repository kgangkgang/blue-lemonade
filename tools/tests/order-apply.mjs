// 확장 순서 애드온 — 저장한 순서대로 확장 설정 창을 실제로 줄 세우는지 (src/addons/order/order.js scan · desired · apply)
//   node tools/tests/order-apply.mjs <테마 루트>   (공개 저장소는 '.')
// 진짜 order.js · state.js · menu-plan.js · panel-hidden.js 를 불러온다. 실리태번 모듈(extensions.js · script.js)과 테마 settings.js 는 data: 스텁,
// 확장 서랍의 두 칸(#extensions_settings · #extensions_settings2)과 창들은 작은 가짜 DOM (children 배열 · insertBefore · 간단한 선택자만).
// 확인하는 것:
//   1) 처음 설정: 고정(정규식 · 빠른 답장) 위 · 구분선 · 나머지 가나다순, 둘째 칸의 창도 첫째 칸으로 모으고 빈 둘째 칸은 숨김
//   2) 칸막이에 창이 하나뿐이면 칸째 옮긴다 — <style> 이 같이 든 칸도 (4.3.9: 꺼내면 그 확장의 '#칸 안의 …' 색 규칙이 빠졌다), 둘 든 칸은 창만
//   3) 자동 정렬을 끄면 저장한 순서 · 목록에 없는 새 확장은 뒤에 가나다순 · 꺼 둔 확장(목록에만 있음)은 건너뜀 · 구분선 끄기
//   4) 넓은 화면 두 칸(왼쪽 고정 · 오른쪽 나머지) · 두 칸 끄면 한 줄 · 고정한 창이 모두 숨김이면 한 줄이고 구분선 없음 (6.6.1 표시 체크)
//   5) 이미 맞으면 아무것도 안 옮기고, 늦게 붙은 창 하나는 그 창만 옮긴다 (5.8.4 — 예전엔 뒤의 창을 모두 떼었다 붙였다)
//   6) 같은 class 창 둘: 이름표(#2)는 창에 적어 두고 계속 써서 다시 세어도 고정이 다른 창으로 옮겨 가지 않음 · 제목 장식 떼기
// 시험 글은 지어낸 확장 이름만 쓴다.
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const orderDir = pathToFileURL(path.join(root, 'src/addons/order')).href + '/';
const js = src => `data:text/javascript,${encodeURIComponent(src)}`;
const T = globalThis.__orderApplyTest = { ext: {}, saves: 0, wide: false, moves: 0, theme: { addonUI: {} } };
const G = 'const T = globalThis.__orderApplyTest;\n';
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
const ONE_COLUMN = ['정규식', '빠른 답장', '|', '감마 도구', '델타 도구', '베타 도구', '알파 도구'];

await test('처음 설정: 고정 위 · 구분선 · 나머지 가나다순 — 둘째 칸 창도 첫째 칸으로, 빈 둘째 칸은 숨김', () => {
    T.wide = false;
    const P = standard();
    settingsFrom(undefined);
    O.apply();
    assert.deepEqual(seq(P.c1), ONE_COLUMN);
    assert.deepEqual(seq(P.c2), []);
    assert.equal(P.c2.style.display, 'none');
    assert.equal(P.c1.children.filter(c => c.id === 'po-divider').length, 1, '구분선은 하나');
});

await test('칸막이에 창이 하나면 칸째 옮긴다 (<style> 이 같이 든 칸도 — 4.3.9), 창 둘 든 칸은 창만 꺼낸다', () => {
    T.wide = false;
    const P = standard();
    settingsFrom(undefined);
    O.apply();
    assert.equal(P.regexBox.parentElement, P.c1); assert.equal(P.regex.parentElement, P.regexBox);
    assert.equal(P.regexBox.children[0].tagName, 'STYLE', '칸 안의 <style> 도 그대로');
    assert.equal(P.qrBox.parentElement, P.c1); assert.equal(P.qr.parentElement, P.qrBox);
    assert.equal(P.gamma.parentElement, P.c1); assert.equal(P.delta.parentElement, P.c1);
    assert.equal(P.pairBox.parentElement, P.c2, '빈 칸막이는 제자리');
    const node = O.scan().find(p => p.key === 'cls:regex_settings').node;
    assert.equal(node, P.regexBox);
});

await test('자동 정렬 끔: 고정(꺼 둔 확장은 건너뜀) → 저장한 순서 → 목록에 없는 새 확장은 뒤에 가나다순 · 구분선 끄기/켜기', () => {
    T.wide = false;
    const P = standard();
    settingsFrom({ auto: false, divider: false, pinned: ['id:ext_missing', 'id:ext_delta'], order: ['id:ext_alpha', 'id:ext_gone', 'id:ext_beta'] });
    const d = O.desired(O.scan());
    assert.deepEqual(d.pinned.map(p => p.key), ['id:ext_delta']);
    assert.deepEqual(d.rest.map(p => p.key), ['id:ext_alpha', 'id:ext_beta', 'id:ext_gamma', 'id:qr--settings', 'cls:regex_settings']);
    O.apply();
    assert.deepEqual(seq(P.c1), ['델타 도구', '알파 도구', '베타 도구', '감마 도구', '빠른 답장', '정규식']);
    S.settings().divider = true;
    O.apply();
    assert.deepEqual(seq(P.c1), ['델타 도구', '|', '알파 도구', '베타 도구', '감마 도구', '빠른 답장', '정규식']);
});

await test('넓은 화면: 왼쪽 칸 = 고정, 오른쪽 칸 = 나머지 (구분선 없음) · 두 칸 끄면 한 줄 · 고정 창이 모두 숨김이면 한 줄 · 구분선 없음', () => {
    T.wide = true;
    const P = standard();
    settingsFrom(undefined);
    O.apply();
    assert.deepEqual(seq(P.c1), ['정규식', '빠른 답장']);
    assert.deepEqual(seq(P.c2), ['감마 도구', '델타 도구', '베타 도구', '알파 도구']);
    assert.equal(P.c2.style.display, '');
    S.settings().twoColumns = false;
    O.apply();
    assert.deepEqual(seq(P.c1), ONE_COLUMN);
    assert.equal(P.c2.style.display, 'none');
    S.settings().twoColumns = true;
    S.settings().panelHidden = ['cls:regex_settings', 'id:qr--settings'];
    O.apply();
    assert.deepEqual(seq(P.c1), ['정규식', '빠른 답장', '감마 도구', '델타 도구', '베타 도구', '알파 도구']);
    assert.ok(P.regex.classList.contains('po-panel-hidden') && P.qr.classList.contains('po-panel-hidden'));
    assert.ok(!P.gamma.classList.contains('po-panel-hidden'));
    S.settings().panelHidden = [];
    O.apply();
    assert.deepEqual(seq(P.c1), ['정규식', '빠른 답장']);
    assert.ok(!P.regex.classList.contains('po-panel-hidden'));
    T.wide = false;
});

await test('이미 맞으면 하나도 안 옮기고, 늦게 붙은 창은 그 창만 옮긴다 (5.8.4) — 둘째 칸에 붙은 창도 첫째 칸 끝으로', () => {
    T.wide = false;
    const P = standard();
    settingsFrom(undefined);
    O.apply();
    T.moves = 0; O.apply();
    assert.equal(T.moves, 0, '맞는 차례면 그대로');
    P.c1.append(panel('ext_kappa', '나비 도구'));
    T.moves = 0; O.apply();
    assert.deepEqual(seq(P.c1), ['정규식', '빠른 답장', '|', '감마 도구', '나비 도구', '델타 도구', '베타 도구', '알파 도구']);
    assert.equal(T.moves, 1, '새 창 하나만 끼운다 (뒤의 델타 · 베타 · 알파는 그대로)');
    P.c2.append(panel('ext_omega', '하늘 도구'));
    T.moves = 0; O.apply();
    assert.deepEqual(seq(P.c1).slice(-2), ['알파 도구', '하늘 도구']);
    assert.equal(T.moves, 1);
    assert.equal(P.c2.style.display, 'none');
    T.moves = 0; O.apply();
    assert.equal(T.moves, 0);
});

await test('같은 class 창 둘: 이름표 #2 는 창에 적어 두고 계속 쓴다 — 다시 세어도 고정이 다른 창으로 옮겨 가지 않음 · 제목 장식 · 제목 없는 창', () => {
    T.wide = false;
    const one = panel('', '쌍둥이 하나', ['twin_settings']), two = panel('', '쌍둥이 둘', ['twin_settings']);
    const plain = new FakeEl('div', { id: 'ext_plain' }); NAME.set(plain, 'id:ext_plain');
    const deco = panel('ext_deco', '  ⚙ 장식 도구 ⓘ ');
    const P = page([one, two, plain], [deco]);
    settingsFrom({ pinned: ['cls:twin_settings#2'] });
    assert.deepEqual(O.scan().map(p => [p.key, p.label]), [['cls:twin_settings', '쌍둥이 하나'], ['cls:twin_settings#2', '쌍둥이 둘'], ['id:ext_plain', 'id:ext_plain'], ['id:ext_deco', '장식 도구']]);
    O.apply();
    // 가나다순(ko)은 한글이 라틴보다 앞 — 제목 없는 창(id: 이름표)은 맨 뒤
    const want = ['쌍둥이 둘', '|', '쌍둥이 하나', '장식 도구 ⓘ', 'id:ext_plain'];
    assert.deepEqual(seq(P.c1).map(x => x === '⚙ 장식 도구 ⓘ' ? '장식 도구 ⓘ' : x), want);
    O.apply(); O.apply();
    assert.deepEqual(seq(P.c1).map(x => x === '⚙ 장식 도구 ⓘ' ? '장식 도구 ⓘ' : x), want, '몇 번을 다시 세도 같은 차례');
    assert.equal(two.dataset.poKey, 'cls:twin_settings#2');
    assert.equal(O.scan().find(p => p.el === two).key, 'cls:twin_settings#2');
});

console.log(`order-apply: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
