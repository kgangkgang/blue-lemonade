// 1.4.8 팔레트 안 색 · 대비 — 게시 뒤 전수조사(1.4.7)의 두 갈래를 다시 막아요. 합성 계산 · 원본 글만 봐요(DOM 없음).
//  · 단추 묶음(.salty-seg) 안 고른 칸 글자는 팔레트 잉크 --salty-muted-ink(apply.js) — CSS color-mix 로 만든 팔레트 밖 색이 아니에요
//  · 그 잉크는 내장 팔레트 전부 · 음영 두 겹(묶음 카드 + 묶음 판) 위에서 4.5 : 1 이상, 이미 넘는 팔레트(나이트)는 보조색 그대로
//  · 과일의 마음 고르기 칸 꺾쇠는 회색 그림이 아니라 글자색(mask) · 고급 서식 마스터 단추 줄은 반투명 .8
//   node tools/tests/seg-muted-ink.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const P = await import(pathToFileURL(path.join(root, 'src/palettes.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };
const lum = c => P.parseColor(c).slice(0, 3).reduce((s, v, i) => { v /= 255; return s + [0.2126, 0.7152, 0.0722][i] * (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); }, 0);
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
// apply.js readableInk 와 같은 걸음(1% 씩 본문색 쪽으로)
const ink = (color, toward, backs, t) => { for (let k = 0; k <= 100; k++) { const c = k ? P.mixColor(toward, color, k / 100) : color; if (backs.every(b => cr(c, b) >= t)) return c; } return toward; };
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

test('단추 묶음 안 고른 칸 글자는 --salty-muted-ink 이고 color-mix 가 없어요', () => {
    const rule = strip(read('css/20-panel.css')).split('}').find(r => /^\s*\.salty-seg button\s*\{/.test(r));
    assert.ok(rule, '.salty-seg button 규칙');
    assert.match(rule, /color:\s*var\(--salty-muted-ink,\s*var\(--salty-muted\)\)/);
    assert.doesNotMatch(rule, /color-mix/);
});
test('apply.js 가 --salty-muted-ink 를 readableInk(보조색 → 본문색, 4.6)로 만들어요', () => {
    const src = read('src/apply.js');
    assert.match(src, /vars\['--salty-muted-ink'\] = readableInk\(pal\.muted, pal\.text, \[[^\]]+\], 4\.6\)/);
});
test('내장 팔레트 전부: 음영 두 겹 위 잉크 4.5 : 1 이상 · 나이트는 보조색 그대로', () => {
    for (const id of Object.keys(P.PALETTES)) {
        const pal = P.paletteColors({ palette: id, colorOverrides: {} });
        const dark = P.paletteMode(id) === 'dark';
        const card = dark ? P.mixColor(pal.text, pal.surface, 0.035) : pal.surface;
        const one = [pal.bg, pal.surface, card].map(c => P.mixColor(pal.text, c, 0.06));
        const backs = [...one, ...one.map(c => P.mixColor(pal.text, c, 0.06))];
        const c = ink(pal.muted, pal.text, backs, 4.6);
        for (const b of backs) assert.ok(cr(c, b) >= 4.5, `${id} ${c} on ${b} ${cr(c, b).toFixed(2)}`);
        if (dark) assert.equal(c, pal.muted, `${id} 나이트는 그대로`);
    }
});
test('코끼리 창(색 변수를 바꿔 끼우는 곳)도 잉크를 그 확장의 보조색으로 맞춰요', () => {
    assert.match(read('src/ext-elephant.css'), /--salty-muted: var\(--lm-muted\);\s*--salty-muted-ink: var\(--lm-muted\);/);
});
test('과일 고르기 칸 꺾쇠: 공용 ▾ 는 모양(mask)만 · 칠은 글자색', () => {
    const rule = strip(read('css/79-fruit-type.css')).split('}').find(r => r.includes('.fh-sel > i {'));
    assert.ok(rule, '.fh-sel > i 규칙');
    assert.match(rule, /background:linear-gradient\(currentColor, currentColor\)/);
    assert.match(rule, /-webkit-mask:var\(--bl-select-arrow\)/);
    assert.match(rule, /(^|[\s;])mask:var\(--bl-select-arrow\)/);
});
test('고급 서식 마스터 불러오기 · 내보내기 줄은 채팅 완성에서 반투명 .8', () => {
    const css = strip(read('css/15-drawers.css'));
    // 1.4.8 묶음: .8 은 변수로 두고 채팅 완성 :has 규칙 하나가 읽어요(주어 아닌 :has 수를 늘리지 않게 — has-guard ②)
    assert.match(css, /#AdvancedFormatting > \.flex-container:first-child > \.flex-container\[data-cc-null\] \{\s*--bl-ccnull-op: 0\.8;/);
    assert.match(css, /:has\(#main_api option\[value=\"openai\"\]:checked\) #AdvancedFormatting :is\([^)]*#AdvancedFormatting > \.flex-container:first-child > \.flex-container\)\[data-cc-null\] \{\s*opacity: var\(--bl-ccnull-op, 1\);/);
});
test('과일 창 고른 칸 면은 창의 낮 · 밤 블록에서 다시 정해요(테마 화이트 + 창 밤 섞임 막기)', () => {
    const src = read('src/scripts/plain/fruit-style.js');
    assert.equal(src.split('--bl-ui-pick-face:color-mix(in srgb,var(--salty-accent) 13%,var(--salty-fill-surface));').length - 1, 2);
});
// 창 밤 잉크(포인트 50% + 흰색)는 내장 팔레트 전부 · 창 낮 잉크(포인트 58% + 남색)는 화이트 팔레트만 — 나이트 팔레트의 파스텔 포인트 + 창 낮은 3.7 : 1(1.4.7 부터 있던 것 · 이번 범위 밖)
test('과일 창 고른 칸 잉크(글자 · 꺾쇠) 4.5 : 1 · 안 고른 칸 꺾쇠 3 : 1 이상(창 밤 = 팔레트 전부 · 창 낮 = 화이트 팔레트)', () => {
    for (const [id, pal] of Object.entries(P.PALETTES)) {
        const acc = pal.accent;
        for (const [mode, ink, fillBase, fillK, ctlBase, ctlK, muted] of [
            ['밤', P.mixColor(acc, '#ffffff', 0.5), '#282d36', 0.03, '#303641', 0.05, '#b1bdcc'],
            ['낮', P.mixColor(acc, '#17222e', 0.58), '#ffffff', 0.02, '#edf0f4', 0.04, '#586473']]) {
            if (mode === '낮' && P.paletteMode(id) === 'dark') continue;
            const face = P.mixColor(acc, P.mixColor(acc, fillBase, fillK), 0.13);
            assert.ok(cr(ink, face) >= 4.5, `${id} ${mode} 고른 칸 ${cr(ink, face).toFixed(2)}`);
            const ctl = P.mixColor(acc, ctlBase, ctlK);
            assert.ok(cr(muted, ctl) >= 3, `${id} ${mode} 안 고른 칸 꺾쇠 ${cr(muted, ctl).toFixed(2)}`);
        }
    }
});
console.log(`seg-muted-ink: ${pass} passed`);
