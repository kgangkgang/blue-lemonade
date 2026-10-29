// 8.2.7 폰 예측점검(hunt-mobile): 몰입 읽기(css/29-reader-onehand.css)는 입력판(#form_sheld)을 #sheld 안에 position:absolute; left:0; right:0 으로 띄워요.
// 실리태번은 폰에서 #sheld 에 좌우 안전 영역(env(safe-area-inset-left/right))만큼 안쪽 여백을 두는데(public/css/mobile-styles.css #sheld),
// absolute 의 left/right 는 그 여백 바깥(테두리 안쪽)부터 재서 가로 아이폰에서 입력판 왼쪽(≡ 단추 · 글 칸)이 노치 밑에 깔렸어요.
// 고친 뒤: left/right 를 안전 영역만큼 띄워요(노치 없는 기기 · 세로는 0 이라 그대로).
//   node tools/tests/reader-form-safe-area.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
const rule = (css, selector) => { const at = css.indexOf(selector + ' {'); assert.ok(at >= 0, selector); return css.slice(at, css.indexOf('}', at)); };
for (const file of ['css/29-reader-onehand.css', 'style.css']) {
    test(`${file}: 몰입 읽기 입력판은 좌우 안전 영역 안에 있어요 (고치기 전: left 0 · right 0)`, () => {
        const body = rule(read(file), 'body.salty.bl-reader #form_sheld');
        assert.match(body, /left:\s*env\(safe-area-inset-left,\s*0px\)/);
        assert.match(body, /right:\s*env\(safe-area-inset-right,\s*0px\)/);
        assert.doesNotMatch(body, /(^|[;\s])left:\s*0;/);
        assert.match(body, /bottom:\s*0;/, '아래는 그대로(바 숨기기 transform 기준)');
    });
}
assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/reader-form-safe-area.mjs .'), 'release-check.yml 에 등록');
console.log(`몰입 읽기 입력판 안전 영역: ${pass}개 통과했어요.`);
