// 7.7.4 볼록 단추 rollback 시험 (css/90-puffy.css · src/usage-mode.js puffyMode · apply.js) — 기본 모양, 설정 스위치 없음.
//   사용자(10-22): 「따로 설정하는 게 아니라 기본으로 — 써 보고 마음에 안 들면 롤백」 → 되돌리기 = css/90-puffy.css 를 지우고 node tools/build-css.cjs.
//   ① rollback: 이 모듈만 빼고 다시 만든 style.css = 지금 style.css 에서 이 모듈 칸만 뺀 것(글자 하나까지 같음) — 다른 모듈 · 순서 · 빌드 결과에 흔적 없음
//   ② 모든 규칙이 html[data-bl-puffy] 로 시작하고 다른 모듈은 그 속성을 안 씀 — 모듈을 빼면 속성이 남아도 걸리는 규칙 0(계산 스타일 그대로)
//   ③ 대상 단추에만: 마지막 칸이 .salty-btn · 팝업 확인/취소 · 테마가 모양을 바꾼 글자 .menu_button 뿐, 아이콘만 · 켜진 단추는 빠짐
//      바꾸는 속성은 테두리(두께) · 누를 때의 배경 자르기 · transform: none · 전환 · --bl-puffy-* 뿐 — 면 색 · 글자 · 크기 · 간격 · 모서리는 그대로
//   ④ 색 글자 0: #hex · rgb() · hsl() · 색 이름 없이 테마 변수(--salty-text · --salty-bg · --salty-accent)와 transparent 만
//   ⑤ 스위치 없음: 설정 키 · 설정 창 줄 · 찾기 · 이름표 없음, 예전에 저장된 puffyButtons 값은 오류 없이 무시
//   실제 화면(격리 실리태번 + 헤드리스 Edge, 375 터치 · 1440 · 팔레트 10개 · 테마+확장 / 확장만)과 rollback 계산 스타일 비교는 리그에서 쟀다.
//   node tools/tests/puffy-rollback.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(root, rel)).href;
const require = createRequire(import.meta.url);
const lib = require(path.join(root, 'tools/css-lib.cjs'));
const NAME = '90-puffy.css';   // 글자 단추 볼록
const KNOB = '91-switch-knob.css';   // 7.7.5 스위치 손잡이 그림자 (따로 지울 수 있음)
const MODS = [NAME, KNOB];
const MOD = 'css/' + NAME;
const css = read(MOD);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const tree = lib.parse(css);
const allRules = lib.flatRules(tree);
const allSelectors = allRules.flatMap(r => lib.topSplit(r.selector).map(s => s.trim()).filter(Boolean));
// 토글 손잡이 규칙(10-23 「A」) — 가짜 요소(::before/::after)가 마지막인 규칙. 나머지가 단추 규칙
const isKnob = r => lib.topSplit(r.selector).every(s => /::(before|after)\s*$/.test(s.trim()));
const knobRules = allRules.filter(isKnob);
const rules = allRules.filter(r => !isKnob(r));
const selectors = rules.flatMap(r => lib.topSplit(r.selector).map(s => s.trim()).filter(Boolean));
const knobCss = read('css/' + KNOB);
const knobTree = lib.parse(knobCss);
const knobModRules = lib.flatRules(knobTree);
const knobSelectors = knobModRules.flatMap(r => lib.topSplit(r.selector).map(s => s.trim()).filter(Boolean));
const subject = sel => { const c = lib.compounds(sel); return c[c.length - 1]; };

await test('모듈 머리 · 문법: 첫 줄 머리 주석, 파싱 문제 0, 규칙이 있음, style.css 에 이 모듈 칸', () => {
    assert.match(css, /^\/\* ===== css\/90-puffy\.css =====/);
    assert.deepEqual(tree.problems, []);
    assert.ok(rules.length >= 6, String(rules.length));
    for (const m of MODS) assert.ok(read('style.css').includes(`/* css/${m} */\n`), m);
});
for (const drop of [[NAME], [KNOB], MODS]) await test(`① rollback: ${drop.join(' + ')} 만 빼고 다시 만든 style.css = 지금 style.css 에서 그 모듈 칸만 뺀 것 (머리 주석의 모듈 수 · 해시 말고 글자 하나까지)`, () => {
    const B = require(path.join(root, 'tools/build-css.cjs'));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-puffy-rollback-'));
    try {
        for (const f of fs.readdirSync(path.join(root, 'css'))) if (!drop.includes(f) && f.endsWith('.css')) fs.copyFileSync(path.join(root, 'css', f), path.join(tmp, f));
        const without = B.build(tmp).text;
        let now = read('style.css');
        for (const name of drop) {
            const a = now.indexOf(`/* css/${name} */\n`), b = now.indexOf('/* css/', a + 5);
            assert.ok(a > 0 && b > a, name + ' 모듈 칸 경계');
            now = now.slice(0, a) + now.slice(b);
        }
        const head = s => s.replace(/^\/\*[^\n]*\*\/\n/, '');
        assert.equal(head(now), head(without));
        if (drop.length === 2) assert.ok(!without.includes('data-bl-puffy'), '둘 다 빼고 만든 style.css 에 볼록 규칙 0');
        assert.equal(B.lazyTail(without), B.lazyTail(read('style.css')), '게으른 칸(src/lazy-panel.gen.css)은 이 모듈과 무관');
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
await test('② 모듈을 빼면 규칙 0: 모든 선택자가 html[data-bl-puffy] 로 시작 · @media 는 움직임 줄이기 조건만 · 다른 모듈 · 런타임 CSS 는 이 속성을 안 씀', () => {
    for (const s of [...allSelectors, ...knobSelectors]) assert.match(s, /^html\[data-bl-puffy(="dark")?\]/, s);
    for (const n of tree.children.filter(n => n.type === 'at')) assert.match(n.prelude, /^@media \(prefers-reduced-motion: (no-preference|reduce)\)$/, n.prelude);
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !MODS.includes(f))) assert.ok(!read('css/' + f).includes('data-bl-puffy'), f);
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    for (const f of walk(path.join(root, 'src')).filter(f => /\.(css|js)$/.test(f))) {
        const t = fs.readFileSync(f, 'utf8'); const rel = path.relative(root, f).replace(/\\/g, '/');
        if (rel === 'src/apply.js' || rel === 'src/usage-mode.js' || rel === 'src/build-info.js') continue;
        assert.ok(!t.includes('data-bl-puffy'), rel);
    }
});
await test('② 속성 값: puffyMode — 테마 켬이면 팔레트 밝기(확장만 모드 포함 · 예전 puffyButtons 값은 무시), 테마 끔이면 null · apply.js 가 붙이고 뗌', async () => {
    const { puffyMode } = await import(url('src/usage-mode.js'));
    assert.equal(puffyMode({ enabled: true }, 'dark'), 'dark');
    assert.equal(puffyMode({ enabled: true }, 'light'), 'light');
    assert.equal(puffyMode({ enabled: true, usageMode: 'extensions' }, 'dark'), 'dark', '확장만 모드에서도 테마 자신의 단추');
    assert.equal(puffyMode({ enabled: true, puffyButtons: false }, 'dark'), 'dark', '예전 스위치 값은 읽지 않음(기본 모양)');
    assert.equal(puffyMode({ enabled: false }, 'light'), null, '테마를 끄면 속성 없음');
    assert.equal(puffyMode({ enabled: true }, 'weird'), 'light');
    const apply = read('src/apply.js');
    assert.match(apply, /const puffy = puffyMode\(getSettings\(\), mode\);/);
    assert.match(apply, /if \(puffy\) document\.documentElement\.setAttribute\('data-bl-puffy', puffy\); else document\.documentElement\.removeAttribute\('data-bl-puffy'\);/);
});
const TARGET = /(^|[^-\w])(\.salty-btn|\.menu_button)(?![-\w])/;
await test('③ 대상 단추에만: 마지막 칸은 .salty-btn · .menu_button(팝업 확인/취소 · body.salty 글자 단추) 뿐 — 탭 · 칩 · 입력 · 체크칸 · 목록 줄 없음', () => {
    for (const s of selectors) {
        if (/^html\[data-bl-puffy(="dark")?\]$/.test(s)) continue;   // 변수만 두는 뿌리
        const subj = subject(s);
        assert.match(subj, TARGET, s);
        assert.doesNotMatch(subj.replace(/:not\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)/g, ''), /input|select|textarea|checkbox|\.qr--|tab|list-group|seg|chip|switch/i, s);
        if (/\.menu_button/.test(subj)) assert.ok(/body\.salty /.test(s), 'menu_button 은 테마가 모양을 바꾸는 body.salty 안에서만: ' + s);
    }
});
await test('③ 빼는 단추: 글자 .menu_button 규칙은 아이콘만(02-controls 와 같은 조건) · 켜진 단추 · 설정 창 · 입력줄 · 면을 지운 #movingUIreset 을 빼고, .salty-btn 은 켜진(.on · .active · aria-pressed) 것을 뺌', () => {
    const icon = ':is(.fa-solid, .fa-regular, .fa-brands, :has(> i:only-child), :has(> svg:only-child), .menu_button_icon:has(> i):not(:has(> span, > b, > strong, > small))):not([data-bl-icon-text])'; // 7.7.8: svg 하나짜리도 아이콘만
    const mb = selectors.filter(s => /body\.salty \.menu_button:not\(/.test(s));
    assert.ok(mb.length >= 3, String(mb.length));
    for (const s of mb) {
        assert.ok(s.includes(icon), '아이콘만 빼기: ' + s);
        for (const x of ['.salty-panel *', '#nonQRFormItems *', '.popup-controls *', '.welcomePanel *', '#rm_buttons_container *', '.toggleEnabled', '.active', '.toggled', '#movingUIreset']) assert.ok(s.includes(x), x + ' 빼기: ' + s);
    }
    const sb = selectors.filter(s => /body \.salty-btn/.test(s));
    assert.ok(sb.length >= 3, String(sb.length));
    for (const s of sb) assert.ok(s.includes('.salty-btn:not(.on, .active, [aria-pressed="true"]'), s);
    // 02-controls 의 아이콘 조건과 글자 그대로 같아야 함(바뀌면 여기도)
    assert.ok(read('css/02-controls.css').includes(':is(.fa-solid, .fa-regular, .fa-brands, :has(> i:only-child), :has(> svg:only-child), .menu_button_icon:has(> i):not(:has(> span, > b, > strong, > small)))'));
});
const ALLOWED = /^(--bl-puffy-(d|lt|deep|edge)|border-bottom|border-top|border-bottom-width|background-clip|transform|transition)$/;
await test('③ 바꾸는 속성: 두께 · 누를 때 테두리 · 배경 자르기 · transform: none · 전환 · 변수뿐 (면 색 · 글자 · 크기 · 간격 · 모서리 · 자간은 안 건드림)', () => {
    for (const r of rules) for (const d of r.decls) {
        assert.match(d.name, ALLOWED, `${r.selector.slice(0, 60)} { ${d.name} }`);
        if (d.name === 'transform') assert.equal(d.value, 'none');
        if (d.name === 'background-clip') assert.equal(d.value, 'padding-box');
        if (d.name === 'border-top') assert.match(d.value, /^var\(--bl-puffy-d\) solid transparent$/, '누를 때 위는 투명');
        if (d.name === 'transition') assert.match(d.value, /border-top-width 0\.15s ease-out, border-bottom-width 0\.15s ease-out$/);
    }
    const tr = rules.filter(r => r.decls.some(d => d.name === 'transition'));
    assert.ok(tr.length && tr.every(r => (r.ctx || []).includes('@media (prefers-reduced-motion: no-preference)')), '전환은 움직임 허용일 때만');
    const press = rules.filter(r => r.decls.some(d => d.name === 'border-top'));
    assert.ok(press.length && press.every(r => (r.ctx || []).includes('@media (prefers-reduced-motion: no-preference)') && /:active/.test(r.selector)), '누름 움직임은 움직임 허용일 때 :active 에만');
    for (const r of press) for (const s of lib.topSplit(r.selector)) assert.match(s, /disabled/, '비활성은 안 눌림: ' + s);
});
await test('③ 두께는 높이 안에: 크기 · 여백 속성 없음, 쉬는 두께 2px(팝업 3px) · 누르면 위 = 두께 · 아래 = 0 (테두리 합이 같아 배치 그대로)', () => {
    assert.match(css, /html\[data-bl-puffy\] \{\s*--bl-puffy-d: 2px;/);
    assert.match(css, /\.popup \.popup-controls \.menu_button \{\s*--bl-puffy-d: 3px;\s*\}/);
    const rest = rules.find(r => r.decls.some(d => d.name === 'border-bottom' && /var\(--bl-puffy-edge\)/.test(d.value)));
    assert.equal(rest.decls.find(d => d.name === 'border-bottom').value, 'var(--bl-puffy-d) solid var(--bl-puffy-edge)');
    const press = rules.find(r => r.decls.some(d => d.name === 'border-bottom-width'));
    assert.equal(press.decls.find(d => d.name === 'border-bottom-width').value, '0');
    for (const r of rules) for (const d of r.decls) assert.doesNotMatch(d.name, /^(height|min-height|width|padding|margin|font|letter-spacing|border-radius|color|background|background-color|box-shadow|top)$/, r.selector.slice(0, 60) + ' ' + d.name);
});
await test('⑥ 스위치 손잡이(7.7.5 「캐릭터 에셋처럼」): 토글 A(3px 딱딱한 두께)는 없음 · 손잡이 그림자를 빠져 있던 곳만 var(--bl-knob) 로 — 크기 · 위치 · 길 · 켬 색은 안 건드림', () => {
    assert.match(knobCss, /^\/\* ===== css\/91-switch-knob\.css =====/);
    assert.deepEqual(knobTree.problems, []);
    assert.equal(knobRules.length, 0, '90-puffy 에 손잡이 규칙 없음(단추 몫만)');
    assert.ok(!css.includes('--bl-puffy-knob-edge') && !knobCss.includes('--bl-puffy-knob-edge'), '토글 A 두께 색 변수 없음');
    assert.equal(knobModRules.length, 2, String(knobModRules.length));
    assert.ok(knobTree.children.every(n => n.type !== 'at'), '@media 없음');
    for (const s of knobSelectors) assert.match(s, /^html\[data-bl-puffy\] body\.salty (\.salty-panel \.salty-switch span::after|#WorldInfo #wiCheckboxes label\.checkbox_label > input\[type="checkbox"\]::before)$/, s);
    for (const r of knobModRules) for (const d of r.decls) { assert.equal(d.name, 'box-shadow'); assert.equal(d.value, 'var(--bl-knob)'); }
    assert.doesNotMatch(knobCss.replace(/\/\*[\s\S]*?\*\//g, ''), /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/, '색 글자 0');
    // 기준(확장 서랍 확장 켜기 스위치 · 실리태번 체크 줄 스위치)이 같은 토큰을 쓰는지, 덮는 대상(21-witidy 의 none)이 그대로인지 — 바뀌면 여기도
    assert.match(read('css/64-headswitch.css'), /\.bl-hs-switch > span \{[^}]*box-shadow: var\(--bl-knob,/);
    assert.match(read('css/02-controls.css'), /width: 14px !important;\s*height: 14px !important;\s*border-radius: 50% !important;\s*clip-path: none !important;\s*background: #fff !important;\s*box-shadow: var\(--bl-knob\) !important;/);
    assert.match(read('css/21-witidy.css'), /body\.salty \.salty-panel \.salty-switch span::after \{ width: 14px; height: 14px; box-shadow: none; \}/);
    assert.match(read('css/21-witidy.css'), /#wiCheckboxes label\.checkbox_label > input\[type="checkbox"\]::before \{ width: 14px !important; height: 14px !important; box-shadow: none !important; \}/);
    assert.match(read('css/10-foundation.css'), /--bl-knob: var\(--salty-knob, 0 1px 2px rgba\(15, 34, 56, 0\.2\), 0 3px 8px -1px rgba\(15, 34, 56, 0\.2\)\);/);
    assert.match(read('css/10-foundation.css'), /--bl-knob: var\(--salty-knob, 0 1px 2px rgba\(0, 6, 16, 0\.4\), 0 2px 6px -1px rgba\(0, 6, 16, 0\.35\)\);/);
});
await test('④ 색 글자 0: #hex · rgb() · hsl() · 색 이름 없음 — 두께 색은 테마 변수를 깊게 섞은 것', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(body, /#[0-9a-fA-F]{3,8}\b/);
    assert.doesNotMatch(body, /\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[-\d.]/);
    assert.doesNotMatch(body, /(?<=[:,(\s])(white|black|red|blue|green|gray|grey|yellow|orange|navy|silver)(?=\s*[;,)!}])/i);
    assert.match(body, /html\[data-bl-puffy\] \{\s*--bl-puffy-d: 2px;\s*--bl-puffy-lt: 100%;\s*\}/);
    assert.match(body, /html\[data-bl-puffy="dark"\] \{\s*--bl-puffy-lt: 0%;\s*\}/);
    assert.match(body, /--bl-puffy-deep: color-mix\(in oklab, var\(--salty-text\) var\(--bl-puffy-lt\), var\(--salty-bg\)\);/);
    // 색은 단추에서 섞는다 — 뿌리(html)에서 섞으면 확장만 모드(--salty-* 가 설정 창 쪽)에서 값이 비어 두께가 사라졌다(리그 10-22)
    const rootRules = rules.filter(r => /^html\[data-bl-puffy(="dark")?\]$/.test(r.selector.trim()));
    for (const r of rootRules) for (const d of r.decls) assert.doesNotMatch(d.value, /--salty-/, '뿌리에 테마 색 변수 금지: ' + d.name);
    assert.match(body, /--bl-puffy-edge: color-mix\(in oklab, var\(--bl-puffy-deep\) 22%, transparent\);/);
});
await test('⑤ 스위치 없음: 설정 키 · 창 줄 · 찾기 · 이름표 없음, 예전에 저장된 puffyButtons 값은 오류 없이 무시', async () => {
    const ctx = { extensionSettings: {} };
    globalThis.SillyTavern = { getContext: () => ctx };
    globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
    const { getSettings, DEFAULTS } = await import(url('src/settings.js') + '?puffy');
    assert.ok(!('puffyButtons' in DEFAULTS));
    ctx.extensionSettings.salty = { puffyButtons: false };
    const s = getSettings();
    assert.equal(typeof s, 'object');
    ctx.extensionSettings.salty = { puffyButtons: 'junk' };
    assert.doesNotThrow(() => getSettings());
    for (const f of ['src/panel.js', 'src/settings-search.js', 'src/settings-labels.js', 'src/settings.js']) assert.ok(!read(f).includes('puffyButtons'), f);
});
console.log(`\n볼록 단추 rollback: 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
