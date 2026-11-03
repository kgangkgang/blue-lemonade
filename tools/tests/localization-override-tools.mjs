// 1.0.0 되살림(657ea96d 되돌림): 한글화 패널 카드의 「수정 코드 내보내기 · 기본 코드로 복원」 — 글만 본다
//   node tools/tests/localization-override-tools.mjs .
// 확인: ① 단추 둘(data-locale-export · data-locale-restore)이 카드마다 있고, 저장된 수정 코드(blue_lemonade_scripts.overrides)가 있을 때만 보여요
//       ② 내보내기는 파일로만 · 복원은 묻고 나서 그 카드의 수정 코드만 지워요(켜기 설정은 그대로) ③ CSS 가 [hidden] 을 지켜요 ④ CI 등록
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };
const ui = read('src/addons/prompt/localization-ui.js'), css = read('src/addons/prompt/style.css');
test('① 단추 둘 · 수정 코드가 있을 때만 보임', () => {
    assert.match(ui, /textContent='수정 코드 내보내기';exportCode\.dataset\.localeExport=item\.id/);
    assert.match(ui, /textContent='기본 코드로 복원';restore\.dataset\.localeRestore=item\.id/);
    assert.match(ui, /const overridesOf=item=>unitsOf\(item\)\.filter\(id=>scriptSettings\(\)\.overrides\[id\]\);/);
    assert.match(ui, /actions\.hidden=!overridesOf\(card\(actions\.dataset\.localeOverride\)\)\.length/);
});
test('② 내보내기는 파일 · 복원은 묻고 그 카드 수정 코드만 지움', () => {
    assert.match(ui, /a\.download=`blue-lemonade-\$\{id\}-custom\.js`/);
    assert.match(ui, /if\(!await ask\('이 항목을 기본 코드로 복원할까요\?/);
    assert.match(ui, /for\(const id of overridesOf\(item\)\)delete scriptSettings\(\)\.overrides\[id\];/);
    assert.match(ui, /catch\(error\)\{replaceScriptSettings\(before\);/);
});
test('③ CSS: 줄 칸 · [hidden] 은 숨김', () => {
    assert.match(css, /#pt-panel \.pt-locale-override\[hidden\]\{display:none\}/);
    assert.match(css, /#pt-page-localization \.pt-locale-override \{ margin:0 0 8px 26px; \}/);
});
test('④ CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/localization-override-tools\.mjs \./));
console.log(`\n${passed} PASS · ${failed} FAIL`);
if (failed) process.exitCode = 1;
