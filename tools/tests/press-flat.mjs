// 7.8.6 누름 · 전환 모듈 시험 (css/90-press.css) — 탈락한 시안 A(볼록, 옛 css/90-puffy.css)를 걷어낸 뒤
//   ① 옛 볼록 모듈 없음 · 볼록 두께 변수(--bl-puffy-d · edge · deep · lt)를 쓰거나 정하는 곳 0 — 되살아날 뿌리가 없다
//   ② 남은 규칙은 html[data-bl-puffy] 로 시작하고, 바꾸는 속성은 transition · background-clip: padding-box · transform: none 뿐
//      (테두리 · 면 · 크기 · 간격 · 모서리 · 글자는 안 건드림 — 평평 C 는 94-density-c 몫)
//   ③ 전환은 움직임 허용일 때만, 누름은 :active 에만 · 비활성은 빠짐
//   ④ 표식 html[data-bl-puffy]: apply.js 가 테마가 켜져 있으면 단다(91-switch-knob 도 씀) — usage-mode.js puffyMode
//   ⑤ 빼기 검사: 이 모듈만 빼고 다시 만든 style.css = 지금 style.css 에서 이 모듈 칸만 뺀 것
//   리그 계산 스타일 비교(옛 모듈 있음 ↔ 이 모듈, 384×3.75 · 사용자 설정 · 화면 52개 · 라이트/나이트): --bl-puffy-* 밖의 차이 0.
//   node tools/tests/press-flat.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const require = createRequire(import.meta.url);
const lib = require(path.join(root, 'tools/css-lib.cjs'));
const NAME = '90-press.css';
const css = read('css/' + NAME);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const tree = lib.parse(css);
const rules = lib.flatRules(tree);
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

await test('① 옛 볼록 모듈 없음 · 볼록 두께 변수 0 (css/ · style.css · src/ 의 css)', () => {
    assert.ok(!fs.existsSync(path.join(root, 'css/90-puffy.css')), 'css/90-puffy.css 가 남아 있음');
    const files = [...fs.readdirSync(path.join(root, 'css')).map(f => 'css/' + f), 'style.css', ...walk(path.join(root, 'src')).filter(f => f.endsWith('.css')).map(f => path.relative(root, f).replace(/\\/g, '/'))];
    for (const f of files) assert.doesNotMatch(read(f), /--bl-puffy-(d|edge|deep|lt)\b/, f);
});
await test('② 머리 · 문법 · 선택자 · 속성: html[data-bl-puffy] 로 시작, transition · background-clip · transform 만', () => {
    assert.match(css, /^\/\* ===== css\/90-press\.css =====/);
    assert.deepEqual(tree.problems, []);
    assert.ok(rules.length >= 4, String(rules.length));
    for (const r of rules) {
        for (const s of lib.topSplit(r.selector)) assert.match(s.trim(), /^html\[data-bl-puffy\]:not\(#bl-puffy-off\) body/, s);
        for (const d of r.decls) {
            assert.match(d.name, /^(transition|background-clip|transform)$/, `${r.selector.slice(0, 60)} { ${d.name} }`);
            if (d.name === 'transform') assert.equal(d.value, 'none');
            if (d.name === 'background-clip') assert.equal(d.value, 'padding-box');
        }
    }
    assert.ok(read('style.css').includes(`/* css/${NAME} */\n`));
});
await test('③ 전환은 움직임 허용일 때만 · 누름은 :active 에만 · 비활성 빠짐', () => {
    for (const r of rules) {
        const ctx = (r.ctx || []).join(' ');
        assert.match(ctx, /@media \(prefers-reduced-motion: (no-preference|reduce)\)/, r.selector.slice(0, 60));
        if (r.decls.some(d => d.name === 'transition')) assert.match(ctx, /no-preference/);
        if (r.decls.some(d => d.name === 'background-clip')) for (const s of lib.topSplit(r.selector)) { assert.match(s, /:active\s*$/, s); assert.match(s, /disabled/, s); }
    }
});
await test('④ 표식: puffyMode — 테마 켬이면 팔레트 밝기, 끔이면 null · apply.js 가 붙이고 뗌 · 91 도 이 표식을 씀', async () => {
    const { puffyMode } = await import(pathToFileURL(path.join(root, 'src/usage-mode.js')).href);
    assert.equal(puffyMode({ enabled: true }, 'dark'), 'dark');
    assert.equal(puffyMode({ enabled: true }, 'light'), 'light');
    assert.equal(puffyMode({ enabled: false }, 'light'), null);
    assert.match(read('src/apply.js'), /if \(puffy\) document\.documentElement\.setAttribute\('data-bl-puffy', puffy\); else document\.documentElement\.removeAttribute\('data-bl-puffy'\);/);
    assert.match(read('css/91-switch-knob.css'), /html\[data-bl-puffy\]/);
});
await test('⑤ 빼기 검사: 이 모듈만 빼고 다시 만든 style.css = 지금 style.css 에서 이 모듈 칸만 뺀 것', () => {
    const B = require(path.join(root, 'tools/build-css.cjs'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-press-'));
    try {
        for (const f of fs.readdirSync(path.join(root, 'css'))) if (f !== NAME && f.endsWith('.css')) fs.copyFileSync(path.join(root, 'css', f), path.join(tmp, f));
        const without = B.build(tmp).text;
        let now = read('style.css');
        const a = now.indexOf(`/* css/${NAME} */\n`), b = now.indexOf('/* css/', a + 5);
        assert.ok(a > 0 && b > a);
        now = now.slice(0, a) + now.slice(b);
        const head = s => s.replace(/^\/\*[^\n]*\*\/\n/, '');
        assert.equal(head(now), head(without));
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
console.log(`press-flat: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
