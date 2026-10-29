// 그룹 편집 멤버 줄 (css/13-characters.css, hunt-world 10-30) — 실리태번 #group_member_template 은 한 줄 flex(아바타 · 이름 · 순번 · 단추 묶음)인데,
// 테마가 단추를 34px 로 키워 다섯 개(178px)가 줄지 않자 이름 · 태그 칸이 눌렸다: 폰 360 에서 14px(이름 「아·」, 태그는 글자 없는 세로 막대 — 태그 30개면 줄 761px),
// 넓은 화면 서랍(319px)에서 42px (리그 실측, 순정은 98px). → 격자로: 아바타가 두 줄, 첫 줄 이름(+ 답 차례 번호), 둘째 줄 단추(오른쪽 정렬 · 좁으면 줄 바꿈).
// 고친 뒤 실측: 폰 이름 204px · 줄 117px · 단추 6개 모두 눌림, 넓은 화면 이름 123px · 줄 151px. 이 시험은 그 격자 규칙이 원문 · style.css 에 있는지 본다.
//   node tools/tests/group-member-layout.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };
const P = 'body.salty #right-nav-panel .group_member';
/** 줄 맨 앞에서 시작하는 그 선택자 규칙의 선언들을 모두 이어 붙인다 */
function decls(css, sel) {
    return css.split('\n' + sel + ' {').slice(1).map(chunk => chunk.slice(0, chunk.indexOf('}'))).join(';');
}

for (const file of ['css/13-characters.css', 'style.css']) {
    const css = read(file);
    t(`${file}: 멤버 줄은 3칸 격자(아바타 · 이름 · 순번)`, () => {
        const d = decls(css, P);
        assert.match(d, /display: grid/); assert.match(d, /grid-template-columns: auto minmax\(0, 1fr\) auto/);
    });
    t(`${file}: 아바타 두 줄 · 이름 첫 줄 가운데 칸(폭 상한 없이 줄어듦) · 순번 첫 줄 끝 · 단추 둘째 줄(오른쪽 정렬 · 줄 바꿈)`, () => {
        assert.match(decls(css, `${P} > .avatar`), /grid-area: 1 \/ 1 \/ span 2 \/ auto/);
        const name = decls(css, `${P} > .group_member_name`);
        assert.match(name, /grid-area: 1 \/ 2/); assert.match(name, /width: auto/); assert.match(name, /min-width: 0/);
        assert.match(decls(css, `${P} > .queue_position`), /grid-area: 1 \/ 3/);
        const icons = decls(css, `${P} > .group_member_icon`);
        assert.match(icons, /grid-area: 2 \/ 2 \/ auto \/ span 2/); assert.match(icons, /flex-wrap: wrap/); assert.match(icons, /justify-content: flex-end/);
    });
}
t('기준: 멤버 단추는 34px (단추가 작아지면 이 배치를 다시 본다)', () => {
    assert.match(decls(read('css/13-characters.css'), `${P} .right_menu_button`), /min-width: 34px/);
});
console.log(`PASS group-member-layout: ${n} checks`);
