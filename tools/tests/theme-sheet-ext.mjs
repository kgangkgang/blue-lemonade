// 8.2.1 「확장만」 · 테마 끔용 가벼운 사본(style-ext.css) — 빌드 결과 · 빠진 규칙 · 차례 · 켜고 끄는 순서
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const build = require(path.join(root, 'tools/build-css.cjs'));
const lib = require(path.join(root, 'tools/css-lib.cjs'));
const style = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const ext = fs.readFileSync(path.join(root, 'style-ext.css'), 'utf8');
const lazyPath = path.join(root, 'src/style-lazy.gen.css');   // 1.0.0 두 장 빌드: 둘째 장의 몫도 사본에 들어가요
const lazy = fs.existsSync(lazyPath) ? fs.readFileSync(lazyPath, 'utf8') : null;

// 1) 빌드와 같고, 크기가 확실히 작다
assert.equal(ext, build.extText(style, lazy), 'style-ext.css matches node tools/build-css.cjs');
assert.ok(Buffer.byteLength(ext) < (Buffer.byteLength(style) + Buffer.byteLength(lazy || '')) * 0.4, 'the light copy is much smaller');
console.log(`PASS style-ext.css is the build output (${(Buffer.byteLength(ext) / 1024).toFixed(0)}KB of ${(Buffer.byteLength(style) / 1024).toFixed(0)}KB)`);

// 2) 남은 선택자는 하나도 body.salty 를 꼭 요구하지 않고, 미리보기 덩어리 · 게으른 칸은 없다
const outside = sel => { let d = 0, s = ''; for (const c of sel) { if (c === '(') d++; else if (c === ')') d--; else if (d === 0) s += c; } return s; };
const split = sel => { const out = []; let d = 0, f = 0; for (let i = 0; i < sel.length; i++) { const c = sel[i]; if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--; else if (c === ',' && !d) { out.push(sel.slice(f, i).trim()); f = i + 1; } } out.push(sel.slice(f).trim()); return out.filter(Boolean); };
const needs = sel => /(^|[\s>+~])body\.salty(?![\w-])/.test(outside(sel));
const rules = (text) => { const out = []; const walk = (nodes, ctx) => { for (const n of nodes) { if (n.type === 'rule') out.push({ ctx, sel: n.selector, body: text.slice(n.bodyStart, n.bodyEnd) }); else if (n.children) walk(n.children, ctx + ' / ' + n.prelude); } }; const t = lib.parse(text); assert.equal(t.problems.length, 0, t.problems.join(' / ')); walk(t.children, ''); return out; };
const extRules = rules(ext);
assert.equal(extRules.filter(r => split(r.sel).some(needs)).length, 0, 'no kept selector requires body.salty');
assert.doesNotMatch(ext, /@media\s+not\s+all\s*\{/,'parked preview blocks stay out (lite.js serves them)');
assert.ok(!ext.includes(`${build.LAZY_SENTINEL} {}`), 'the lazy tail stays out (lite.js serves it)');
assert.ok(extRules.some(r => /salty-panel/.test(r.sel)), 'panel rules that work without the theme are kept');
console.log(`PASS ${extRules.length} kept rules never need body.salty; preview and lazy blocks are left to lite.js`);

// 3) 남은 규칙은 style.css 에서와 같은 차례 · 같은 선언(갈래 일부만 빠진 규칙은 남은 갈래만)
const canonical = lazy || style;
const full = rules(canonical.slice(0,canonical.lastIndexOf(`${build.LAZY_SENTINEL} {}`))).filter(r => !/@media not all(?! and)( \/|$)/i.test(r.ctx));
let j = 0;
for (const r of extRules) {
    while (j < full.length && !(full[j].body === r.body && full[j].ctx === r.ctx && split(full[j].sel).filter(p => !needs(p)).join(',') === split(r.sel).join(','))) j++;
    assert.ok(j < full.length, `rule out of order or changed: ${r.sel.slice(0, 120)}`);
    j++;
}
console.log('PASS kept rules keep the original cascade order and declarations');

// 4) 켜고 끄는 순서: 사본을 다 받은 뒤에 큰 시트를 끄고, 테마를 켜면 큰 시트를 먼저 켠다 · 못 받으면 큰 시트 그대로
const src = fs.readFileSync(path.join(root, 'src/theme-sheet.js'), 'utf8');
assert.match(src, /addEventListener\('load', \(\) => \{[^}]*main\.sheet\.disabled = true/, 'the big sheet is disabled only after the copy loaded');
assert.match(src, /failed = true; ext\.remove\(\); enableTheme\(main\)/, 'a missing copy keeps the available theme sheet');
assert.match(src, /if \(themeOn \|\| failed\) \{[^}]*enableTheme\(main\);[^}]*ext\?\.remove\(\)/, 'turning the theme on enables the full or boot sheet before removing the copy');
assert.match(src, /main\.after\(ext\)/, 'the copy sits right after the big sheet (same order against other CSS)');
const apply = fs.readFileSync(path.join(root, 'src/apply.js'), 'utf8');
// 현재 그리는 모드로 시트를 고르고, 꺼짐 또는 데우스 규칙이 필요한 때만 관리자를 받아요.
assert.match(apply, /const s = themeEnabled\(rendered\) \? rendered : \{\.\.\.rendered, enabled:false\};/);
const sheetLine = apply.split(/\r?\n/).find(line => line.includes("lateSync('themeSheet'"));
assert.ok(sheetLine);
const sync = new Function('s', 'lateSync', sheetLine);
for (const [settings, wanted] of [[{ enabled: false }, true], [{ enabled: true }, false], [{ enabled: true, deus: { on: true } }, true]]) {
    let load, shown;
    sync(settings, (_name, _loader, need, call) => { load = need; call({ syncThemeSheet(on) { shown = on; } }); });
    assert.equal(load, wanted); assert.equal(shown, settings.enabled);
}
assert.doesNotMatch(apply, /^import [^\n]*theme-sheet\.js/m, 'theme-sheet.js stays out of the start graph');
const lite = fs.readFileSync(path.join(root, 'src/lite.js'), 'utf8');
// 1.0.0: 미리보기는 따로 받는 <link>(9.0.1) — 게으른 칸 <style> 만 sheetTail 로 사본 뒤에 붙어요
assert.ok((lite.match(/sheetTail\(sheet\)/g) || []).length >= 1, 'lazy <style> goes after the copy');
// 1.1.6 sheetTail 은 테마 시트 뒤 줄 끝(themeRunEnd) — 그 줄에 가벼운 사본 · 전체 시트 · 뗀 규칙 시트가 있어요
assert.match(lite, /const sheetTail = sheet => themeRunEnd\(sheet\.ownerNode\);/, 'sheetTail goes to the end of the theme run');
assert.match(lite, /n && \(n\.id === 'salty-lazy-css' \|\| n\.id === 'salty-ext-css' \|\| n\.dataset\?\.blGate != null\)/, 'the theme run knows the light copy');
console.log('PASS sheet switching keeps the screen covered and the cascade order');

// 5) 가짜 문서로 실제로 돌려 보기
const listeners = {};
const mk = (attrs) => ({ ...attrs, sheet: { disabled: false, cssRules: [1] }, after(n) { this.next = n; n.prev = this; n.isConnected = true; } });
const main = mk({ href: new URL('../style.css', pathToFileURL(path.join(root, 'src/theme-sheet.js'))).href, id: '' });
let extNode = null;
globalThis.document = {
    querySelectorAll: () => extNode ? [main, extNode] : [main],
    getElementById: id => (extNode && extNode.isConnected && extNode.id === id ? extNode : null),
    createElement: () => { extNode = { isConnected: false, sheet: null, addEventListener(k, fn) { listeners[k] = fn; }, remove() { this.isConnected = false; } }; return extNode; },
};
const mod = await import(pathToFileURL(path.join(root, 'src/theme-sheet.js')).href + '?t=' + Date.now());
mod.syncThemeSheet(false);
assert.ok(extNode?.isConnected && main.next === extNode && main.sheet.disabled === false, 'copy added after the big sheet, big sheet still on while loading');
extNode.sheet = { cssRules: [1] }; listeners.load();
assert.equal(main.sheet.disabled, true, 'big sheet off once the copy loaded');
mod.syncThemeSheet(true);
assert.equal(main.sheet.disabled, false); assert.equal(extNode.isConnected, false, 'theme on: big sheet back, copy removed');
console.log('PASS switching runs in a fake document');
