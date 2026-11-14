// 1.4.x 최적화 3차 — 값싼 지킴 꼴: 빌드 도구(tools/css-light-guards.cjs) · 실행 중 되돌리기(src/cheap-guards.js) · 부르는 자리
//   node tools/tests/cheap-guards.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const require = createRequire(path.join(root, 'tools/'));
const G = require(path.join(root, 'tools/css-light-guards.cjs'));
const L = require(path.join(root, 'tools/css-lib.cjs'));
const R = await import(pathToFileURL(path.join(root, 'src/cheap-guards.js')).href);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let pass = 0, fail = 0;
const test = async (name, fn) => { try { await fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 8).join('\n       ')); } };

const M = '[data-bl-native-ext-colors]';
await test('빌드 도구: 괄호 안 한 갈래 `X *` 만 `X:not(*)` 로 · 특이도 그대로 · 되돌리면 글자 하나까지 같아요', () => {
    const src = `body.salty .a:where(:not(${M},${M} *)) {color:red}\nbody.salty .b:where(${M},${M} *) {border-width:1px}\nbody.salty .c:not(.salty-panel *, .world_entry *) {color:blue}\nbody.salty :is(.popup-body, .salty-panel, .salty-panel *)::-webkit-scrollbar {display:none}`;
    const out = G.lighten(src);
    assert.equal(out.count, 4);
    assert.deepEqual(out.byToken, { [M]: 2, '.salty-panel': 2 });
    assert.ok(out.text.includes(`:where(:not(${M},${M}:not(*)))`));
    assert.ok(out.text.includes(`:where(${M},${M}:not(*))`));
    assert.ok(out.text.includes(':not(.salty-panel:not(*), .world_entry *)'));
    assert.ok(out.text.includes(':is(.popup-body, .salty-panel, .salty-panel:not(*))'));
    assert.equal(G.full(out.text), src);
    for (const [a, b] of [[`${M} *`, `${M}:not(*)`], ['.salty-panel *', '.salty-panel:not(*)']]) assert.deepEqual(L.spec(b), L.spec(a));
});
await test('빌드 도구: 괄호 밖 · 다른 칸과 붙은 꼴 · 더 긴 사슬 · 문자열은 그대로예요', () => {
    const src = `.salty-panel * {color:red}\n.a, .salty-panel *, .b {color:red}\n.x:not(div${M} *, .q.salty-panel *) {color:red}\n.y:not(.salty-panel * .z) {color:red}\n.w[title=":not(.salty-panel *)"] {color:red}\n.v::after {content:"(.salty-panel *)"}`;
    const out = G.lighten(src);
    assert.equal(out.count, 0);
    assert.equal(out.text, src);
});
await test('빌드 도구: 받은 글에 이미 가벼운 꼴이 있으면 멈춰요(되돌리기가 모호)', () => {
    assert.throws(() => G.lighten('.a:not(.salty-panel:not(*)) {color:red}'), /이미/);
});
await test('생성물: 테마 시트들에 괄호 안 지킴 갈래가 원래 꼴로 남지 않고, 되돌리면 예전 지킴 글이 그대로예요', () => {
    for (const f of ['style.css', 'src/style-lazy.gen.css', 'src/lazy-panel.gen.css', 'style-ext.css', 'src/compat-browser.gen.css']) {
        const text = read(f);
        assert.equal(G.lighten(G.full(text)).text, text, `${f} 에 아직 원래 꼴 갈래가 있어요(빌드 뒤 다시 만들기)`);
    }
    const first = G.full(read('style.css'));
    assert.ok(first.includes(`:where(:not(${M},${M} *))`), '되돌린 첫 장에 확장 색 지킴 글');
    assert.ok(/body\.salty \*:where\(:not\(\[data-bl-native-ext-colors\],\[data-bl-native-ext-colors\]:not\(\*\)\)\)/.test(read('style.css')), '글자 그림자 끔 규칙(모든 요소)도 가벼운 꼴');
    assert.ok(!/(\[data-bl-native-ext-colors\]|\.salty-panel):not\(\*\)/.test(read('src/dem-style-data.gen.js')), '데우스 분리 규칙(실행 중 insertRule)에는 가벼운 꼴이 없어요');
});

// ── 실행 중: 가짜 CSSOM ──
const ROOT = new URL('../', pathToFileURL(path.join(root, 'src/cheap-guards.js')).href).href;
class Rule { constructor(sheet, text, inner = null) { this.parentStyleSheet = sheet; this._t = text; this.writes = 0; if (inner) this.cssRules = inner; } get selectorText() { return this._t; } set selectorText(v) { this._t = v; this.writes++; } }
class Sheet { constructor(href, texts, owner = 'link') { this.href = href; this.ownerNode = { localName: owner }; this.cssRules = texts.map(t => (Array.isArray(t) ? new Rule(this, undefined, t.map(x => new Rule(this, x))) : new Rule(this, t))); } }
function fakeDoc(sheets, panel = false) {
    const listeners = [];
    return { styleSheets: sheets, querySelector: sel => (panel && sel === '.salty-panel' ? {} : null), addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }), fire(el) { for (const l of listeners) if (l.type === 'load' && l.capture) l.fn({ target: el }); }, listeners, set panel(v) { panel = v; } };
}
const extLight = `body.salty .a:where(:not(${M},${M}:not(*)))`, panelLight = 'body.salty .c:not(.salty-panel:not(*), .world_entry *)';
await test('실행 중: 켜기 전에는 시트를 읽지도 않고, 켜면 그 가족 갈래만 원래 꼴로(다른 확장 시트는 안 건드려요)', () => {
    R._resetGuards();
    const theme = new Sheet(ROOT + 'style.css', [extLight, panelLight, '.plain', [extLight]]);
    const other = new Sheet('http://x/scripts/extensions/third-party/foo/style.css', [extLight]);
    const doc = fakeDoc([theme, other]);
    assert.equal(R.guardSheet(theme), 0); assert.equal(R.guardStats.scans, 0);
    assert.equal(R.armGuard('ext', doc), true);
    assert.equal(theme.cssRules[0].selectorText, `body.salty .a:where(:not(${M},${M} *))`);
    assert.equal(theme.cssRules[1].selectorText, panelLight);
    assert.equal(theme.cssRules[3].cssRules[0].selectorText, `body.salty .a:where(:not(${M},${M} *))`, '@media 안쪽도');
    assert.equal(other.cssRules[0].selectorText, extLight, '다른 확장 시트');
    assert.equal(R.armGuard('ext', doc), false, '두 번째는 할 일 없음');
});
await test('실행 중: 설정 창 가족은 창이 문서에 남아 있으면 끄지 않고, 다 떼면 가벼운 꼴로 되돌려요(되돌린 글 = 원래 글)', () => {
    R._resetGuards();
    const theme = new Sheet(ROOT + 'src/style-lazy.gen.css', [extLight, panelLight]);
    const doc = fakeDoc([theme], true);
    R.armGuard('panel', doc);
    assert.equal(theme.cssRules[1].selectorText, 'body.salty .c:not(.salty-panel *, .world_entry *)');
    assert.equal(theme.cssRules[0].selectorText, extLight);
    assert.equal(R.disarmGuard('panel', doc), false, '창이 남아 있음');
    doc.panel = false;
    assert.equal(R.disarmGuard('panel', doc), true);
    assert.equal(theme.cssRules[1].selectorText, panelLight);
    assert.equal(R.guardArmed('panel'), false);
});
await test('실행 중: 켜진 동안 새로 붙은 테마 시트는 load 잡기에서 · 글로 넣은 <style> 은 guardSheet 로 맞춰요 · 규칙 수가 바뀌면 그 시트만 다시 읽어요', () => {
    R._resetGuards();
    const doc = fakeDoc([]);
    R.armGuard('ext', doc);
    const late = new Sheet(ROOT + 'src/style-lazy.gen.css', [extLight]);
    doc.fire({ localName: 'link', sheet: late });
    assert.equal(late.cssRules[0].selectorText, `body.salty .a:where(:not(${M},${M} *))`);
    const inline = new Sheet(null, [extLight], 'style');
    assert.equal(R.guardSheet(inline), 1);
    inline.cssRules.push(new Rule(inline, extLight));
    const scans = R.guardStats.scans;
    assert.equal(R.guardSheet(inline), 1, '새 규칙 하나만');
    assert.equal(R.guardStats.scans, scans + 1);
    assert.equal(R.guardSheet(inline), 0, '바뀐 게 없으면 다시 안 읽어요');
    assert.equal(R.guardStats.scans, scans + 1);
});
await test('실행 중: 표식 가족도 표식이 문서에 남아 있으면 끄지 않고, 다 떼면 가벼운 꼴로 · 두 가족은 따로예요', () => {
    R._resetGuards();
    const theme = new Sheet(ROOT + 'style.css', [extLight, panelLight, `body.salty .d:not(.salty-panel:not(*)):where(:not(${M},${M}:not(*)))`]);
    const doc = fakeDoc([theme]);
    doc.querySelector = sel => ((doc.marked && sel === M) || (doc.hasPanel && sel === '.salty-panel') ? {} : null);
    doc.marked = true; doc.hasPanel = true;
    R.armGuard('ext', doc); R.armGuard('panel', doc);
    assert.equal(theme.cssRules[2].selectorText, `body.salty .d:not(.salty-panel *):where(:not(${M},${M} *))`);
    doc.hasPanel = false;
    assert.equal(R.disarmGuard('panel', doc), true);
    assert.equal(theme.cssRules[2].selectorText, `body.salty .d:not(.salty-panel:not(*)):where(:not(${M},${M} *))`, '설정 창 갈래만 가볍게');
    assert.equal(R.disarmGuard('ext', doc), false, '표식이 남아 있음');
    doc.marked = false;
    assert.equal(R.disarmGuard('ext', doc), true);
    assert.equal(theme.cssRules[2].selectorText, `body.salty .d:not(.salty-panel:not(*)):where(:not(${M},${M}:not(*)))`);
});
await test('실행 중: 견주기용 lightSelector 는 되돌린 꼴을 빌드 꼴로', () => {
    assert.equal(R.lightSelector(`body.salty .a:where(:not(${M}, ${M} *))`), `body.salty .a:where(:not(${M}, ${M}:not(*)))`);
    assert.equal(R.lightSelector(panelLight), panelLight);
});
await test('부르는 자리: 표식 · 설정 창을 문서에 넣기 전에 켜고, 글로 넣는 시트 · 뼈대 견주기도 따라가요', () => {
    const ec = read('src/extension-colors.js');
    assert.ok(ec.indexOf("armGuard('ext')") > 0 && ec.indexOf("armGuard('ext')") < ec.indexOf('root.setAttribute(MARKER'), 'extension-colors: 표식 전에');
    assert.ok(/disarmGuard\('ext'\)/.test(ec));
    const ex = read('src/ext-compat.js');
    assert.ok(/if \(!n\) armGuard\('ext'\); part\.dataset\[NATIVE\] = ''/.test(ex), 'ext-compat keepNative');
    const sp = read('src/addons/perf/storage/panel.js');
    assert.ok(sp.indexOf("armGuard('ext')") < sp.indexOf("setAttribute?.('data-bl-native-ext-colors'"), '성능 보조 창 stamp');
    const pn = read('src/panel.js');
    const mount = pn.slice(pn.indexOf('export function mountPanel'));
    assert.ok(mount.indexOf("armGuard('panel')") < mount.indexOf('container.appendChild(root)'), 'mountPanel: 넣기 전에');
    assert.ok(/if \(!panels\.size\) disarmGuard\('panel'\)/.test(pn), 'unmountPanel');
    const lite = read('src/lite.js');
    assert.ok(/guardSheet\(style\.sheet\)/.test(lite) && /lightSelector\(x\.selectorText\) !== lightSelector\(y\.selectorText\)/.test(lite), 'lite.js');
    const split = read('src/split-css.js');
    assert.ok(split.indexOf('guardSheet(full)') < split.indexOf("link.media = 'all'") && /guardSheet\(panel\.sheet\)/.test(split), 'split-css.js: 켜기 전에');
    const b = read('tools/build-css.cjs');
    assert.ok(/css-light-guards\.cjs/.test(b), 'build-css 가 부름');
    assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/cheap-guards.mjs .'), 'CI 등록');
});
console.log(`cheap-guards: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
