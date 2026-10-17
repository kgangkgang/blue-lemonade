// 7.0.5 확장 서랍 머리에 제목 · 판 알약은 한 번만 — 한글화 패널을 펼치면 「한글화 패널 v… 한글화 패널 v…」 두 번 보이던 것
//   node tools/tests/addon-head-once.mjs <테마 루트>
// 원인: css/85-addon-unify.css 의 창 머리 제목 규칙(#pt-panel > #pt-panel-header > h3 { display: inline-flex !important })이, 서랍 안에 들어온
// 패널(.pt-in-drawer)의 머리 제목을 숨기던 애드온 규칙을 덮었다. 화면 확인은 격리 리그(390 나이트 · 화이트)로 했고, 여기서는 그 조건을 지킨다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
// 간단한 특이도 (id, class/속성/가상클래스, 태그) — :is/:not/:has 는 인자 중 가장 큰 값, :where 는 0
function spec(sel) {
    let a = 0, b = 0, c = 0, s = sel;
    const take = (re, fn) => { s = s.replace(re, (...m) => { fn(...m); return ' '; }); };
    for (;;) {   // 안쪽 괄호부터 풀기
        const m = /:(is|not|has|where)\(([^()]*)\)/.exec(s); if (!m) break;
        let best = [0, 0, 0];
        if (m[1] !== 'where') for (const part of m[2].split(',')) { const p = spec(part); if (p[0] > best[0] || (p[0] === best[0] && (p[1] > best[1] || (p[1] === best[1] && p[2] > best[2])))) best = p; }
        a += best[0]; b += best[1]; c += best[2]; s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
    }
    take(/#[\w-]+/g, () => a++);
    take(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g, () => b++);
    take(/::[\w-]+/g, () => c++);
    take(/(^|[\s>+~])([a-zA-Z][\w-]*)/g, () => c++);
    return [a, b, c];
}
const cmp = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

const HIDE = 'html body.salty #pt-panel.pt-in-drawer > #pt-panel-header > h3 { display: none !important; }';
test('통일 CSS: 서랍 안 한글화 패널의 머리 제목(판 알약 포함)을 숨기는 한 줄 · style.css 에도', () => {
    assert.ok(read('css/85-addon-unify.css').includes(HIDE));
    assert.ok(read('style.css').includes(HIDE), 'node tools/build-css.cjs 로 다시 빌드');
});
test('숨김 줄이 통일 제목 규칙(빌드된 꼴)보다 무겁고 뒤에 있다', () => {
    const css = read('style.css');
    const at = css.indexOf('html body.salty :is(#pt-panel > #pt-panel-header > h3) {');
    assert.ok(at >= 0, '통일 제목 규칙의 한글화 패널 줄을 못 찾음 — 빌드 꼴이 바뀌었으면 이 시험을 맞출 것');
    assert.ok(css.indexOf(HIDE) > at, '숨김 줄은 뒤에');
    const unify = spec('html body.salty :is(#pt-panel > #pt-panel-header > h3)'), hide = spec(HIDE.slice(0, HIDE.indexOf('{')));
    assert.ok(cmp(hide, unify) > 0, `특이도 ${hide} > ${unify}`);
});
test('한글화 패널 자체 규칙도 그대로: 서랍 안에서는 패널 머리 제목 · × 를 숨기고 ↻ 만', () => {
    assert.match(read('src/addons/prompt/style.css'), /#pt-panel\.pt-in-drawer #pt-panel-header h3,#pt-panel\.pt-in-drawer #pt-panel-close\{display:none\}/);
});
test('애드온 서랍 머리 마크업마다 판 알약은 하나 이하', () => {
    const bad = [];
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
    for (const f of walk(path.join(root, 'src/addons')).filter(f => /\.(js|html)$/.test(f))) {
        const s = fs.readFileSync(f, 'utf8');
        for (const m of s.matchAll(/inline-drawer-header[^>]*>([\s\S]{0,600}?)<div class="inline-drawer-(icon|content)/g)) {
            const pills = (m[1].match(/class="[^"]*\b(ext-version|pt-drawer-version|[\w-]+-version)\b/g) || []).length;
            if (pills > 1) bad.push(path.relative(root, f) + ' ' + pills);
        }
    }
    assert.deepEqual(bad, []);
});
test('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/addon-head-once\.mjs \./));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
