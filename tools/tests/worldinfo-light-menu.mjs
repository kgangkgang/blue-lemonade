// 월드인포 긴 목록 가볍게 × ⋯ 항목 작업 메뉴 (hunt-world 10-30) — 항목이 80개 넘게 보이면(쪽 크기 100 이상) 접힌 항목에 content-visibility:auto 가 붙는데,
// 이 속성은 화면 안에서도 늘 칠하기 가두기(paint containment)라 머리 줄 ⋯(src/layout.js 가 만드는 <details class="bl-wi-actions">)를 열면
// 항목 밖으로 내려오는 목록(옮기기 · 복제 · 삭제)이 항목 아래 끝에서 잘려 「복제 · 삭제」를 누를 수 없었다(리그 360 폭 실측: 첫 단추만 보임).
// → 메뉴를 연 항목은 가볍게 규칙에서 뺀다. 메뉴는 머리 줄의 바로 아래 자식이라 「> .inline-drawer-header > .bl-wi-actions[open]」 으로 집는다.
//   node tools/tests/worldinfo-light-menu.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

const EXCLUDE = ':not(:has(> form > .inline-drawer > .inline-drawer-header > .bl-wi-actions[open]))';
const ruleOf = css => css.match(/body\.salty #WorldInfo #world_popup_entries_list\.bl-wi-light > \.world_entry([^{]*)\{([^}]*content-visibility[^}]*)\}/);

t('가볍게 규칙이 ⋯ 메뉴를 연 항목을 뺀다 (원문 · style.css 둘 다)', () => {
    for (const file of ['css/12-worldinfo.css', 'style.css']) {
        const rule = ruleOf(read(file));
        assert.ok(rule, `${file}: 가볍게 규칙이 있다`);
        assert.ok(rule[1].includes(EXCLUDE), `${file}: 메뉴를 연 항목 제외`);
        assert.ok(!/\[\s*style/.test(rule[1]), `${file}: :has 안에 inline style 선택자 없음`);
    }
});
t('layout.js 가 메뉴를 머리 줄의 바로 아래 자식 <details class="bl-wi-actions"> 로 붙인다 (선택자 「> .bl-wi-actions」 가 맞는 조건)', () => {
    const js = read('src/layout.js');
    assert.match(js, /for \(const header of world\.querySelectorAll\('\.world_entry > form > \.inline-drawer > \.inline-drawer-header'\)\)/);
    assert.match(js, /const menu = document\.createElement\('details'\);\s*\n\s*menu\.className = 'bl-wi-actions';/);
    assert.match(js, /\n\s*header\.append\(menu\);/);
});
t('메뉴 목록은 항목 밖으로 내려오는 절대 배치다 (잘림이 생기는 까닭 — 이 모양이 바뀌면 이 시험도 다시 본다)', () => {
    const css = read('css/21-witidy.css');
    assert.match(css, /body\.salty #WorldInfo \.bl-wi-action-list \{\s*\n\s*position: absolute; right: 0; top: 36px;/);
});
console.log(`PASS worldinfo-light-menu: ${n} checks`);
