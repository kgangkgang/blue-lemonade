// 6.1.6 「큰 숫자는 쉼표로」 좁은 칸 맞추기 — 여섯 자리(128,000)부터 쉼표가 사라지던 것. 맞춤 계산(numbers.js) · numcomma.js 연결
//   node tools/tests/numcomma-fit.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const { groupedNumber, fitNumberText, scaledFont, NUMBER_FIT_MIN } = await import(pathToFileURL(path.join(root, 'src/numbers.js')));
const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }

test('fits as before: plain, then the spin-button room (wide)', () => {
    assert.deepEqual(fitNumberText(40, 44, 15), { scale: 1, wide: false });
    assert.deepEqual(fitNumberText(44.4, 44, 15), { scale: 1, wide: false }, '0.5px rounding slack');
    assert.deepEqual(fitNumberText(55, 44, 15), { scale: 1, wide: true });
    assert.deepEqual(fitNumberText(59.5, 44, 15), { scale: 1, wide: true });
});

test('too wide even with the spin room: shrink to fit (uses the spin room too), down to the 72% limit', () => {
    const fit = fitNumberText(70, 44, 15);
    assert.equal(fit.wide, true);
    assert.ok(fit.scale < 1 && fit.scale >= NUMBER_FIT_MIN, JSON.stringify(fit));
    assert.ok(70 * fit.scale <= 44 + 15 - 0.5 + 1e-9, 'shrunk text fits the room');
    assert.ok(70 * (fit.scale + 0.002) > 44 + 15 - 0.5, 'no smaller than needed');
    const phone = fitNumberText(60, 50, 0);     // 폰: 스핀 단추 자리가 없다
    assert.equal(phone.wide, false);
    assert.ok(phone.scale >= NUMBER_FIT_MIN && 60 * phone.scale <= 49.5 + 1e-9, JSON.stringify(phone));
    assert.equal(NUMBER_FIT_MIN, 0.72);
});

test('centered PC boxes may shrink into the whole box (minus 1px each side), never below the limit', () => {
    // 64px 칸, 왼쪽 여백 15 (스핀 자리 맞춤) · 오른쪽 0 · 스핀 15 → inner 34, 스핀 포함 49, 칸 전체 64 - 2 = 62
    assert.equal(fitNumberText(70, 34, 15), null, 'spin room only: 48.5 / 70 < 0.72');
    const fit = fitNumberText(70, 34, 15, undefined, 62);
    assert.ok(fit && fit.wide && fit.scale < 1 && 70 * fit.scale <= 61.5 + 1e-9, JSON.stringify(fit));
    assert.deepEqual(fitNumberText(45, 34, 15, undefined, 62), { scale: 1, wide: true }, 'unscaled wide threshold stays inner + spin');
    assert.equal(fitNumberText(95, 34, 15, undefined, 62), null);
});

test('beyond the limit keeps the original text (null), as do empty or bad widths', () => {
    assert.equal(fitNumberText(100, 44, 15), null, '59 / 100 < 0.72');
    assert.equal(fitNumberText(100, 60, 0, 0.6), null, '0.595 < 0.6');
    assert.equal(fitNumberText(100, 60, 0, 0.55).scale, 0.595);
    assert.equal(fitNumberText(0, 44, 15), null);
    assert.equal(fitNumberText(NaN, 44, 15), null);
});

test('six and seven digit values: typical 60px slider box fits with a modest shrink', () => {
    // 실리태번 슬라이더 옆 칸: 내용 폭 ≈ 44px + PC 스핀 15px, 13.5px 글꼴의 숫자 폭 ≈ 7.6px · 쉼표 ≈ 3.4px
    const digit = 7.6, comma = 3.4, room = 44, spin = 15;
    const widthOf = text => [...text].reduce((a, ch) => a + (ch === ',' ? comma : digit), 0);
    assert.deepEqual(fitNumberText(widthOf(groupedNumber('12345')), room, spin), { scale: 1, wide: false });
    const six = fitNumberText(widthOf(groupedNumber('128000')), room, spin);
    assert.ok(six && six.scale === 1 && six.wide, `128,000 -> ${JSON.stringify(six)}`);
    const seven = fitNumberText(widthOf(groupedNumber('1000000')), room, spin);
    assert.ok(seven && seven.scale < 1 && seven.scale >= NUMBER_FIT_MIN, `1,000,000 -> ${JSON.stringify(seven)}`);
    const phoneSix = fitNumberText(widthOf(groupedNumber('128000')), room, 0);
    assert.ok(phoneSix && phoneSix.scale < 1, `phone 128,000 -> ${JSON.stringify(phoneSix)}`);
});

test('scaledFont swaps only the size in the canvas font string', () => {
    assert.equal(scaledFont('normal 400 13.5px Pretendard, sans-serif', '13.5px', 0.8), 'normal 400 10.8px Pretendard, sans-serif');
    assert.equal(scaledFont('italic 700 16px "Noto Sans KR"', '16px', 0.75), 'italic 700 12px "Noto Sans KR"');
    assert.equal(scaledFont('normal 400 16px X', '15px', 0.8), null, 'size not in the font string');
    assert.equal(scaledFont('normal 400 16px X', '', 0.8), null);
});

test('numcomma.js renders through the fit (no early bail-out left) with the scaled font, letter spacing and glyph cells', () => {
    const src = fs.readFileSync(path.join(root, 'src/numcomma.js'), 'utf8');
    assert.match(src, /import \{ groupedNumber, fitNumberText, scaledFont \} from '\.\/numbers\.js';/);
    assert.match(src, /const fit = fitNumberText\(width, inner, L\.spin, undefined, shrinkRoom\);\s*if \(!fit\) return null;/);
    assert.match(src, /const shrinkRoom = L\.spin > 0 && centered \? L\.w - 2 \* Math\.min\(L\.pl, L\.pr\) - 2 : inner \+ L\.spin;/);
    assert.ok(!src.includes('else if (width > inner + 0.5) return null;'), 'old bail-out removed');
    assert.match(src, /font = scaledFont\(L\.font, L\.cs\.fontSize, fit\.scale\);/);
    assert.match(src, /glyphs = glyphs\.map\(\(\[ch, cell\]\) => \[ch, cell \* fit\.scale\]\);/);
    assert.match(src, /ctx\.font = font;\s+\/\/ 크기를 바꾸면/);
    assert.match(src, /const imgKey = \[text, font, L\.tabular, L\.ink, ls,/);
});

const failed = results.filter(r => !r.pass);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
