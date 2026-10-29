// 8.2.7 폰 예측점검(hunt-mobile): 설정 › 날씨 › 「자리」의 네모 판(.bl-spot-pad, 폰에서 약 150×300px)이 touch-action:none 이라
// 그 위에서 설정 창을 위아래로 밀면 안 굴러갔어요(10-29 제보 「미리보기 상자에서 세로 스크롤 안 됨」과 같은 종류).
// 끌기는 점(.bl-spot)만 받으니(src/panel.js pointerdown → closest('.bl-spot')) 판에는 필요 없어요 — 점은 그대로 touch-action:none.
//   node tools/tests/weather-spot-pad-scroll.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const rule = (css, selector) => { const at = css.indexOf(selector + '{'); assert.ok(at >= 0, selector); return css.slice(at, css.indexOf('}', at)); };
for (const file of ['css/52-tool-editor.css', 'style.css', 'style-ext.css']) {
    test(`${file}: 판은 손가락 스크롤을 막지 않고(고치기 전: touch-action:none), 점은 그대로 끌기 전용`, () => {
        const css = read(file);
        assert.doesNotMatch(rule(css, '.salty-panel .bl-spot-pad'), /touch-action\s*:\s*none/);
        assert.match(rule(css, '.salty-panel .bl-spot'), /touch-action\s*:\s*none/);
    });
}
test('끌기는 점에서만 시작해요 (판을 눌러 옮기는 길은 없어요)', () => {
    const src = read('src/panel.js');
    assert.match(src, /root\.addEventListener\('pointerdown', \(event\) => \{\s*const dot = event\.target\.closest\?\.\('\.bl-spot'\), pad = dot\?\.parentElement;\s*if \(!dot \|\| !pad\) return;/);
});
assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/weather-spot-pad-scroll.mjs .'), 'release-check.yml 에 등록');
console.log(`날씨 자리 판 세로 스크롤: ${pass}개 통과했어요.`);
