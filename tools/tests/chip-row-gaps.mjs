// 1.7.5 칩 줄 틈 — 손가락 화면에서 칩 · 꼬리표 · 범례의 44 누를 자리가 이웃 줄과 겹치지 않게 줄 사이만 넓힌 것을 다시 막아요. 원본 글만 봐요(DOM 없음).
//  · 과일의 마음: 꼬리표 · 칩(높이 34) 줄 사이 10 · 단추 줄(높이 36) 줄 사이 8 — 칩 높이 + 줄 사이 ≥ 44 · 가로 틈 · 크기 · 글자는 안 바꿔요
//  · 데우스/솔라 빠른 설정 탭 줄: 위 여백 4(탭 36 의 44 상자 위쪽이 overflow-y:hidden 에 안 잘리게) · 탭도 기준점 · 상자 목록에
//  · 미트볼 변화 그래프 범례: 줄 사이 16(알약 28 + 위아래 8) — 손가락 화면 묶음 안
//  · 모두 (pointer: coarse) 안에만 — 마우스 화면은 그대로
//   node tools/tests/chip-row-gaps.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('  ok  ' + name); };
// @media (pointer: coarse) { … } 안쪽 글
const coarseOf = css => { const at = css.indexOf('@media (pointer: coarse) {'); assert.ok(at >= 0, '손가락 화면 묶음'); let d = 0; for (let i = css.indexOf('{', at); i < css.length; i++) { if (css[i] === '{') d++; else if (css[i] === '}' && !--d) return css.slice(at, i + 1); } throw Error('묶음이 안 닫혀요'); };
const FH = ':is(html > body.salty #fruit-heart-v6#fruit-heart-v6#fruit-heart-v6, html > body.salty ~ #fruit-heart-v6#fruit-heart-v6#fruit-heart-v6)';
const touch = strip(read('css/87-addon-touch.css'));
const coarse = coarseOf(touch);

test('과일의 마음 칩 줄: 줄 사이만 — 꼬리표 · 칩 10 · 단추 줄 8 (칩 높이 + 줄 사이 ≥ 44)', () => {
    assert.ok(coarse.includes(`${FH} :is(.fh-tags, .fh-chips) { row-gap: 10px; }`), '꼬리표 · 칩');
    assert.ok(coarse.includes(`${FH} :is(.fh-qr-acts, .fh-pad) { row-gap: 8px; }`), '단추 줄');
    assert.ok(34 + 10 >= 44 && 36 + 8 >= 44);
    for (const m of coarse.matchAll(/\.fh-(?:tags|chips|qr-acts|pad)\)\s*\{([^}]*)\}/g)) assert.match(m[1].trim(), /^row-gap: \d+px;$/, '줄 사이 말고는 안 바꿔요(가로 틈 · 크기 · 글자 그대로): ' + m[1]);
});
test('데우스/솔라 탭 줄: 위 여백 4 · 탭이 기준점 목록과 상자 목록 둘 다에', () => {
    assert.ok(coarse.includes('html body.salty #bl-deus-popover .dq-tabs { padding-top: 4px; }'));
    const rel = coarse.split('}').find(r => r.includes(':where(') && /position:\s*relative/.test(r));
    const box = coarse.split('}').find(r => /::after,\s*\n?\s*:is\(/.test(r) && /content:\s*''/.test(r));
    assert.ok(rel && rel.includes('#bl-deus-popover :is(.dq-help-button, .dq-close, .bl-ft-shortcut, .dq-tabs > button)'), '기준점');
    assert.ok(box && box.includes('#bl-deus-popover :is(.dq-help-button, .dq-close, .bl-ft-shortcut, .dq-tabs > button)'), '상자(::after)');
    assert.ok(36 + 4 + 4 >= 44, '탭 36 + 위 4 + 아래 4(탭 줄 아래 여백 8 안)');
    // 탭의 ::after 를 다른 모듈이 모양으로 쓰지 않아요(쓰면 상자가 그 모양을 지워요)
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(n => n.endsWith('.css') && n !== '87-addon-touch.css')) assert.doesNotMatch(strip(read('css/' + f)), /\.dq-tabs[^{},]*(?:button|\[aria-pressed[^\]]*\])[^{},]*::after/, f);
});
test('미트볼 변화 그래프 범례: 손가락 화면에서 줄 사이 16 — 아래 범례 규칙(12)보다 센 갈래', () => {
    const mb = strip(read('src/ext-status.css'));
    const c = coarseOf(mb);
    assert.ok(c.includes('body.salty:not([data-bl-ext-raw]) .ss-scope .ss-trend-box > .ss-trend-legend.bl-tr-legend { row-gap: var(--bl-s4, 16px); }'));
    assert.ok(mb.includes('body.salty:not([data-bl-ext-raw]) .ss-scope .ss-trend-legend.bl-tr-legend { display: flex; flex-wrap: wrap; gap: var(--bl-s3, 12px) var(--bl-s2, 8px);'), '마우스 화면은 12 그대로');
    assert.ok(mb.includes(".bl-tr-legend > .bl-tr-key::before { content: ''; position: absolute; inset: -9px 0; }"), '알약 28 + 위아래 8 = 44');
    assert.ok(28 + 16 >= 44);
});
test('마우스 화면은 그대로 — 묶음 밖에는 이 규칙이 없어요', () => {
    const outside = touch.replace(coarse, '');
    assert.doesNotMatch(outside, /row-gap|\.dq-tabs/);
});
test('CI 등록', () => assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/chip-row-gaps.mjs .')));
console.log(`chip-row-gaps: ${pass} passed`);
