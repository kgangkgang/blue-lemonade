// 8.2.3 미리보기 상자(.bl-view-port) 폰 끌기: 세로 = 설정 칸 스크롤 · 가로 = 미리보기 이동 · 두 손가락 = 확대 (src/touch-drag-intent.js · src/preview-view.js · css/45-preview-view.css)
//   제보 10-29 「본문·대사 창에서 스크롤이 안 먹음(모바일)」 — 미리보기가 손가락을 다 잡았고, 설정 칸(.salty-sec)은 미리보기의 조상이 아니라 브라우저 pan-y 로도 안 굴러간다.
//   사용자 결정: 세로 끌기는 화면 스크롤, 가로만 이동, 마우스는 그대로 → JS 가 세로 끌기를 설정 칸 scrollTop 으로 넘긴다
//   node tools/tests/preview-view-touch.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { dragIntent } = await import(pathToFileURL(path.join(root, 'src/touch-drag-intent.js')));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
test('8px 안은 보류(null) — 손가락 떨림으로 정하지 않아요', () => { for (const [dx, dy] of [[0, 0], [3, 2], [-7, 7], [7.9, -7.9]]) assert.equal(dragIntent(dx, dy), null, `${dx},${dy}`); });
test('세로 우세(|dy| ≥ |dx|)면 vertical — 같으면 세로(스크롤 쪽이 안전)', () => { for (const [dx, dy] of [[0, 8], [0, -30], [5, 12], [-8, 8], [20, -20]]) assert.equal(dragIntent(dx, dy), 'vertical', `${dx},${dy}`); });
test('가로 우세면 horizontal(미리보기 이동)', () => { for (const [dx, dy] of [[8, 0], [-40, 3], [12, -5], [9, 8]]) assert.equal(dragIntent(dx, dy), 'horizontal', `${dx},${dy}`); });
test('문턱을 바꿀 수 있어요', () => { assert.equal(dragIntent(5, 0, 4), 'horizontal'); assert.equal(dragIntent(5, 0, 6), null); });
test('CSS: 미리보기 상자는 touch-action none 그대로 — pan-y 를 주면 Chrome 이 손짓을 가져가 pointercancel 만 오고 아무것도 안 굴러가요(리그 10-29)', () => {
    const css = fs.readFileSync(path.join(root, 'css/45-preview-view.css'), 'utf8');
    const rule = css.split('\n').find(l => l.startsWith('.bl-view-port {'));
    assert.match(rule, /touch-action:none/);
    assert.match(fs.readFileSync(path.join(root, 'style.css'), 'utf8'), /\.bl-view-port \{[^}]*touch-action:none/);
});
test('JS: 터치만 결정을 미루고(마우스는 decided) · 세로면 설정 칸(.bl-editor .salty-sec, 없으면 가장 가까운 스크롤 칸)을 손가락 따라 굴리고 · 두 손가락은 바로 확대', () => {
    const js = fs.readFileSync(path.join(root, 'src/preview-view.js'), 'utf8');
    assert.match(js, /decided: e\.pointerType !== 'touch'/);
    assert.match(js, /pointers\.size >= 2 \? 'horizontal' : dragIntent\(next\.x - old\.x0, next\.y - old\.y0\)/);
    assert.match(js, /intent === 'vertical'\) next\.scroll = scrollerOf\(root, box\)/);
    assert.match(js, /next\.scroll\.scrollTop -= next\.y - old\.y/);
    assert.match(js, /\.bl-editor \.salty-sec'\) \|\| box\.closest\('\.drawer-content, \.popup-content, \.salty-sec'\)/);
    assert.match(js, /onpointercancel = viewport\.onlostpointercapture/);
});
console.log(`미리보기 터치: ${pass}개 통과했어요.`);
