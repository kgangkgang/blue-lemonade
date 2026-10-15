// 2.6.3 한국어 문장 가운데 남은 소문자 영어 낱말 (가상 문장).
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = pathToFileURL(path.resolve(process.argv[2] || '.') + '/');
const { leftoverEnglish, linesToFix } = await import(new URL('src/addons/translator/leftover-fix.js', root));
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const src = "Bram's fingers paused over the home row. He saved his work with a single shortcut.\nThe train was 5 km away.";
check('mid-sentence leftover word is picked', () => {
    assert.deepEqual(leftoverEnglish('브램의 손가락이 홈 row 위에서 멈췄다.', src), ['row']);
    assert.deepEqual(leftoverEnglish('손가락이 row를 짚었다.', src), ['row']);
});
check('units, quotes, names and words not in an English source line are left alone', () => {
    assert.deepEqual(leftoverEnglish('열차는 5 km 떨어져 있었다.', src), []);
    assert.deepEqual(leftoverEnglish('그는 「row」라고 적었다.', src), []);
    assert.deepEqual(leftoverEnglish('그는 홈 row 위에서 멈췄다.', '「ホーム row」と書いた。'), []);
    assert.deepEqual(leftoverEnglish('브램의 손가락이 홈 row 위에서 멈췄다.', src, ['row']), []);
});
check('old sentence-start rule still works and English-heavy lines are skipped', () => {
    assert.deepEqual(leftoverEnglish('Then 브램은 창가로 갔다.', 'Then Bram went to the window.'), ['Then']);
    assert.deepEqual(leftoverEnglish('home row 위', src), []);
});
check('linesToFix sends the line once', () => {
    const rows = linesToFix('첫 줄이다.\n브램의 손가락이 홈 row 위에서 멈췄다.', src);
    assert.equal(rows.length, 1); assert.equal(rows[0][0], 1); assert.deepEqual(rows[0][2], ['row']);
});
console.log(`translator-midword: ${passed} passed, 0 failed`);
