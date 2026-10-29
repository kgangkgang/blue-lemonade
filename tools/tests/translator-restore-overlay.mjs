// 8.2.7 폰 예측점검(hunt-mobile): 번역 › 메타데이터에서 번역 복원(restoreTranslationsFromMetadata)의 진행 막(#llm-translator-progress-blocker)은
// position:fixed + height:100% 였어요. 실리태번은 html 에 transform(translateZ) 을 걸고(public/style.css) 폰(≤1000px)에서는 body 를 position:fixed 로
// 둬(public/css/mobile-styles.css) fixed 의 기준이 높이 0 인 html 이에요 → 막 높이 0 · 진행 상자가 화면 맨 위에 반쯤 잘리고 뒤 화면이 눌렸어요.
// 고친 뒤: 화면 단위(100vh → 100dvh)로 줘요. 같은 이유로 테마의 다른 덮개(selects.js · qrfind.js · prompt 의 덮개)도 화면 단위를 써요.
//   node tools/tests/translator-restore-overlay.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
const at = src.indexOf("progressContainer.id = 'llm-translator-progress-blocker';");
assert.ok(at > 0, '진행 막을 찾아요');
const block = src.slice(at, src.indexOf('document.body.appendChild(progressContainer);', at));
// 막의 style 쓰기만 차례로 따라 해요: 브라우저처럼 모르는 값(dvh 를 모르는 옛 브라우저)은 버려요
function heightAfter(supportsDvh) {
    let height = '';
    for (const [, value] of block.matchAll(/progressContainer\.style\.height = '([^']+)';/g)) {
        if (value.endsWith('dvh') && !supportsDvh) continue;
        height = value;
    }
    return height;
}
// html 높이가 0 인 폰에서 막이 실제로 얼마나 높은가 (퍼센트는 기준 상자 높이 0 의 몇 %, 화면 단위는 화면 높이)
const tall = (value, viewport = 800, containingBlock = 0) => value.endsWith('%') ? containingBlock * parseFloat(value) / 100 : value.endsWith('vh') ? viewport * parseFloat(value) / 100 : 0;
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
test('폰(html 높이 0)에서 막이 화면 높이만큼 덮어요 (고치기 전: 100% → 0px)', () => {
    assert.match(block, /progressContainer\.style\.position = 'fixed';/);
    assert.equal(tall(heightAfter(true)), 800);
    assert.equal(heightAfter(true), '100dvh');
});
test('dvh 를 모르는 브라우저는 100vh 로 남아요', () => assert.equal(tall(heightAfter(false)), 800));
assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/translator-restore-overlay.mjs .'), 'release-check.yml 에 등록');
console.log(`번역 복원 진행 막 높이: ${pass}개 통과했어요.`);
