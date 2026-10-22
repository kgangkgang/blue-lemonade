// 7.4.0 (북마크 1.7.2) 발췌 카드의 글이 위로 붙어 보이던 것 — 한 줄 발췌의 글 상자가 카드 가운데 · 고치기/지우기 단추 가운데와 같은 높이
//   폰(터치) 카드 최소 높이 48px 가 글 한 줄 + 위아래 9px 보다 커서 아래만 남았다(위 9 · 아래 12.6). 위아래 여백을 같게 (최소 높이 − 한 줄)/2 이상으로.
//   CSS 식을 그대로 셈해 본다 (화면 측정은 rig: work/bl-731/rig/excerpt-rig.mjs).   node tools/tests/bookmark-excerpt-740.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const css = fs.readFileSync(path.join(root, 'src/addons/bookmarks/style.css'), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// CSS 와 같은 셈: 위아래 여백 · 단추 올림 · 카드 높이 → 글 상자 위 · 아래 틈, 단추 가운데와 글 가운데 차이
function layout({ size, lh = 1.65, touch, phone }) {
    const line = size * lh, min = touch ? 48 : 40, pad = phone ? 9 : 10, btn = touch ? 44 : 36;
    const padv = Math.max(pad, (min - line) / 2);
    const lift = Math.max(2 - padv, (line - btn) / 2);
    const height = Math.max(min, line + 2 * padv);
    const top = padv, bottom = height - padv - line;
    const btnCenter = padv + lift + btn / 2, textCenter = padv + line / 2;
    return { top, bottom, height, btnTop: padv + lift, btnBottom: padv + lift + btn, btnCenter, textCenter };
}

await test('CSS: 위아래 여백 = max(기본, (최소 높이 − 한 줄)/2) · 최소 높이도 같은 변수 · 터치 48px · 단추 올림은 상자 위 끝 2px 안까지', () => {
    assert.match(css, /--cg-ex-padv: max\(var\(--cg-ex-pad\), calc\(\(var\(--cg-ex-min\) - var\(--cg-ex-line\)\) \/ 2\)\);/);
    assert.match(css, /padding: var\(--cg-ex-padv\) 14px;/);
    assert.match(css, /\.cg-root \.cg-excerpts \.cg-excerpt \{ min-height: var\(--cg-ex-min, 40px\); \}/);
    assert.match(css, /@media \(pointer: coarse\) \{[\s\S]{0,400}\.cg-root \.cg-excerpt \{ --cg-ex-min: 48px; \}/);
    assert.match(css, /--cg-ex-lift: max\(calc\(2px - var\(--cg-ex-padv, 10px\)\), calc\(\(var\(--cg-ex-line\) - var\(--cg-ex-btn\)\) \/ 2\)\);/);
    assert.match(css, /--cg-css-version: "1\.7\.5";/);
});

for (const [label, opts] of [['폰 375 · 100%', { size: 16, touch: true, phone: true }], ['폰 375 · 130%', { size: 20.8, touch: true, phone: true }], ['PC 1440 · 100%', { size: 16, touch: false, phone: false }], ['PC 1440 · 130%', { size: 20.8, touch: false, phone: false }], ['폰 작은 글씨 14px', { size: 14, touch: true, phone: true }]]) {
    await test(`한 줄 발췌 ${label}: 글 상자 위 · 아래 틈 차이 ≤ 2px · 단추 가운데 = 글 가운데 · 단추는 카드 안`, () => {
        const r = layout(opts);
        assert.ok(Math.abs(r.top - r.bottom) <= 2, JSON.stringify(r));
        assert.ok(Math.abs(r.btnCenter - r.textCenter) <= 1, JSON.stringify(r));
        assert.ok(r.btnTop >= 0 && r.btnBottom <= r.height + 0.01, JSON.stringify(r));
    });
}
await test('예전 식(폰 100%)은 위 9 · 아래 12.6 이었다 — 이 시험이 그 차이를 잡는다', () => {
    const line = 16 * 1.65, top = 9, bottom = 48 - 9 - line;
    assert.ok(bottom - top > 3);
});

console.log(`bookmark-excerpt-740: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
