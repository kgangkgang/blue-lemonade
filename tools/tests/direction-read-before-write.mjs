// 1.2.2 전개 지시 켜짐 색(src/addons/direction/index.js applyOnColor) — 계산된 스타일은 :root 에 쓰기 전에 다 읽어요.
// 쓰기 뒤에 다시 읽으면 방금 쓴 :root 변수 때문에 문서 스타일 계산을 그 자리에서 한 번 더 강제해요(폰 리그 추적: 덮개가 걷힐 때 isDarkTheme 한 번 · 요소 433).
//   node tools/tests/direction-read-before-write.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const src = fs.readFileSync(path.join(root, 'src/addons/direction/index.js'), 'utf8');
let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const start = src.indexOf('function applyOnColor()');
const end = src.indexOf('\n}', start);
const body = src.slice(start, end);
const firstWrite = body.search(/rootStyle\.(setProperty|removeProperty)\(/);
const swatch = body.indexOf('const swatch');

test('applyOnColor 를 찾았고 :root 쓰기가 있어요', () => {
    assert.ok(start > 0 && end > start && firstWrite > 0 && swatch > firstWrite);
});
test('첫 쓰기 앞에서 계산된 스타일을 받아 켜짐 색 · 밝기 · 서명을 다 읽어요', () => {
    const head = body.slice(0, firstWrite);
    assert.match(head, /getComputedStyle\(document\.documentElement\)/);
    assert.match(head, /isDarkTheme\(style\)/);
    assert.match(head, /effectiveOnColor\(style\)/);
    assert.match(head, /onColorSignature = colorSignature\(style\)/);
});
test('첫 쓰기부터 색 견본 줄 앞까지는 계산된 스타일을 읽지 않아요', () => {
    const writes = body.slice(firstWrite, swatch);
    for (const read of ['getComputedStyle', 'isDarkTheme(', 'effectiveOnColor(', 'colorSignature(', 'style.getPropertyValue', 'shownOnColor(']) {
        assert.ok(!writes.includes(read), `쓰기 사이에 ${read}`);
    }
});
test('쓰는 값은 그대로예요 — 어두운 테마면 var(--jj-on), 밝으면 80% 섞기 · 바탕 #141318 / #fbf9f6', () => {
    assert.match(body, /base = dark \? '#141318' : '#fbf9f6'/);
    assert.match(body, /setProperty\('--jj-stroke', dark \? 'var\(--jj-on\)' : 'color-mix\(in srgb, var\(--jj-on\) 80%, #b08000\)'\)/);
});

console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
