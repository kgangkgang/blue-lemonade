// 1.1.8 묶음에서만 줄이는 창 CSS 글(tools/build-bundle.mjs minStyle) — 걷는 것이 주석 · 띄어쓰기 · 마지막 「;」 뿐인지 봐요(규칙 · 값 · 선택자는 한 글자도 안 바뀌어요).
//   node tools/tests/bundle-min-style.mjs [저장소]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { minStyle } = await import(pathToFileURL(path.join(root, 'tools/build-bundle.mjs')));
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };
const cssOf = (code, name) => { const head = `const ${name} = \``, at = code.indexOf(head); return code.slice(at + head.length, code.indexOf('`;', at + head.length)); };
// 띄어쓰기가 뜻을 갖는 곳(자손 선택자 · 값 사이)은 남기고, 「{ } ; , >」 둘레와 주석만 걷었는지 — 둘 다 공백을 하나로 모은 뒤 견줘요
//   따옴표 글(url("data:image/svg+xml,…") — 1.2.0 추천 꺾쇠)은 한 글자도 안 바뀌어야 해요: 떼어 두고 견준 뒤 그대로 되돌려요
const STR = /"[^"\n]*"|'[^'\n]*'/g;
const bare = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (css) => { const kept = []; return bare(css).replace(STR, (s) => { kept.push(s); return `\uE000${kept.length - 1}\uE001`; }).replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim().replace(/\uE000(\d+)\uE001/g, (all, i) => kept[i]); };

for (const [file, name] of [['src/log-copy-sheet.js', 'STYLE'], ['src/mart-import-ui.js', 'STYLE'], ['src/log-copy-tune-ui.js', 'FINE_STYLE'], ['src/log-copy-handoff.js', 'STYLE'], ['src/mart-retake.js', 'STYLE']]) {
    test(`${file} ${name}: 주석 · 띄어쓰기만 걷어요`, () => {
        const code = fs.readFileSync(path.join(root, file), 'utf8');
        const out = minStyle(code, name);
        const before = cssOf(code, name), after = cssOf(out, name);
        assert.ok(after.length < before.length, '줄어들어야 해요');
        assert.equal(after, norm(before));
        // 글자 차례는 그대로(공백 · 주석 · 「;}」 의 ; 만 빠짐)
        assert.equal(after.replace(STR, '""').replace(/\s/g, ''), bare(before).replace(STR, '""').replace(/\s/g, '').replace(/;}/g, '}'));
        assert.equal((after.match(/\{/g) ?? []).length, (after.match(/\}/g) ?? []).length, '괄호 짝');
        assert.ok(!/\/\*/.test(after), '주석이 남지 않아요');
        // 따옴표 글은 차례 · 글자 그대로(띄어쓰기 · 쉼표 · 괄호가 들어 있어도 줄이기가 안 건드려요)
        assert.deepEqual(after.match(STR) ?? [], bare(before).match(STR) ?? [], '따옴표 글이 바뀌었어요');
        // 코드의 나머지는 그대로
        assert.equal(out.length - after.length, code.length - before.length);
    });
}
test('따옴표 글 안의 띄어쓰기 · 쉼표 · 「>」 · 괄호는 그대로 둬요', () => {
    const css = `a { b:url("data:image/svg+xml,%3Csvg  viewBox='0 0 8 8' %3E a > b , c { }") ;  content:'x ;  y' ; }  /* 주석 */  c > d { e:f ; }`;
    const out = cssOf(minStyle('const STYLE = `' + css + '`;', 'STYLE'), 'STYLE');
    assert.equal(out, `a{b:url("data:image/svg+xml,%3Csvg  viewBox='0 0 8 8' %3E a > b , c { }");content:'x ;  y'}c>d{e:f}`);
});
test('글 끼우기(${…})가 든 CSS 는 줄이지 않고 멈춰요', () => {
    assert.throws(() => minStyle('const STYLE = `a { b:${c}; }`;', 'STYLE'));
    assert.throws(() => minStyle('const X = 1;', 'STYLE'));
});
test('CI 등록', () => assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/bundle-min-style.mjs .')));
console.log(`\n${passed} 통과 · ${failed} 실패`);
if (failed) process.exit(1);
