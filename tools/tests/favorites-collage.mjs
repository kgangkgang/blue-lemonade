// 즐겨찾기 줄 그룹 칸 콜라주 (css/21-witidy.css, hunt-world 10-30) — 실리태번 콜라주(#group_avatars_template .collage_N)는 그림을 칸 크기의 % 로 절대 배치해
// 테마의 즐겨찾기 칸(세로로 그림 48×52 + 이름표)에서는 그림이 이름표 위를 덮고 칸은 60×90 으로 아래가 비었다(리그 360 폭 실측).
// 고친 뒤 실측(리그, 콜라주 1~4): 칸 64×81 · 이름표 (4,60) · 그림 자리 (8,4) 48×52 — 캐릭터 칸과 같다. 이 시험은 그 자리 규칙이 원문 · style.css 에 있는지 본다.
//   node tools/tests/favorites-collage.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0; const t = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };
const P = 'body.salty #right-nav-panel #HotSwapWrapper .hotswap > .avatar.avatar_collage';
/** 선택자 하나(정확히 같은 글자)의 선언 덩어리 — 줄 맨 앞에서 시작하는 규칙만 */
function decl(css, sel) {
    for (const chunk of css.split('\n' + sel + ' {').slice(1)) return chunk.slice(0, chunk.indexOf('}'));
    return null;
}

for (const file of ['css/21-witidy.css', 'style.css']) {
    const css = read(file);
    t(`${file}: 콜라주 칸은 64 폭 · 이름표는 그림 아래(위 여백 60px) · 정사각 비율을 푼다`, () => {
        const d = decl(css, P); assert.ok(d, '칸 규칙');
        assert.match(d, /width: 64px !important/); assert.match(d, /padding-top: 60px/); assert.match(d, /aspect-ratio: auto/); assert.match(d, /position: relative/);
    });
    t(`${file}: 그림은 캐릭터 칸 그림 자리(왼쪽 8 · 위 4)에서 % 상한 없이`, () => {
        const d = decl(css, `${P} img`); assert.ok(d, '그림 규칙');
        assert.match(d, /top: 4px; left: 8px;/); assert.match(d, /max-width: none; max-height: none;/);
    });
    t(`${file}: 2~4 장은 반폭 24 · 3~4 장은 반높이 26 · 오른쪽 칸 32 · 아래 칸 30 · 3장 째는 온폭 48`, () => {
        assert.match(decl(css, `${P}:is(.collage_2, .collage_3, .collage_4) img`) || '', /width: 24px !important/);
        assert.match(decl(css, `${P}:is(.collage_3, .collage_4) img`) || '', /height: 26px !important/);
        assert.ok(css.includes(`\n${P}:is(.collage_2, .collage_3, .collage_4) .img_2,\n${P}.collage_4 .img_4 { left: 32px; }`), '오른쪽 칸');
        assert.ok(css.includes(`\n${P}:is(.collage_3, .collage_4) .img_3,\n${P}:is(.collage_3, .collage_4) .img_4 { top: 30px; }`), '아래 칸');
        assert.match(decl(css, `${P}.collage_3 .img_3`) || '', /width: 48px !important/);
    });
}
t('기준: 캐릭터 칸 그림은 48×52 고정 (이 크기가 바뀌면 콜라주 자리도 같이 바꾼다)', () => {
    assert.ok(read('css/21-witidy.css').includes('#HotSwapWrapper .hotswap > .avatar img { width: 48px !important; height: 52px !important;'));
});
console.log(`PASS favorites-collage: ${n} checks`);
