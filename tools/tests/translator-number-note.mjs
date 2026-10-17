// 번역기 2.7.8 숫자 한 줄: 글자로 붙여 쓴 숫자 + 단위("two hundred-and-ninety-centimeter guards" = 190센티미터인 둘)가 원문에 있을 때만
// 번역 요청에 [Numbers: …] 한 줄을 붙인다. 없으면 프롬프트는 예전 그대로.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || '.';
const source = readFileSync(join(root, 'src/addons/translator/index.js'), 'utf8');
let passed = 0, failed = 0;
function check(name, fn) {
    try { fn(); passed++; console.log(`  PASS  ${name}`); } catch (error) { failed++; console.log(`  FAIL  ${name}\n        ${error.message}`); }
}

const start = source.indexOf('const buildFullPrompt = (layout, body = maskedText) => {');
const end = source.indexOf('\n        };', start);
const builder = source.slice(start, end);
const line = builder.split('\n').find(l => l.includes('hundred-(?:and-)?'));
const pattern = line && new Function(`return ${/if \((\/.*\/i)\.test\(body\)\)/.exec(line)[1]};`)();

check('the note is built inside buildFullPrompt, after the bracket note and before the body', () => {
    assert.ok(start > 0 && end > start, 'buildFullPrompt');
    assert.ok(pattern instanceof RegExp, 'pattern');
    const note = builder.indexOf('[Numbers: copy every number');
    assert.ok(note > builder.indexOf('BRACKET_NOTE') && note < builder.indexOf('built += `\\n\\n${body}`'), 'order');
    assert.match(builder, /190 cm tall, not 290 cm/);
});

check('triggers on a count word before a hyphenated spelled-out measurement', () => {
    for (const text of [
        'Mina stood between the two hundred-and-ninety-centimeter giants on the bridge.',
        'watching the two hundred-and-ninety-centimeter guards argue',
        'both hundred-and-ninety-centimeter statues stopped moving',
        'three hundred-and-twenty-meter towers',
        'two hundred-twenty-pound guards',
        'the two Hundred-And-Eighty-Five-Centimetre twins',
    ]) assert.ok(pattern.test(text), text);
});

check('stays quiet on ordinary numbers', () => {
    for (const text of [
        'The old clock ticked roughly two hundred times a minute.',
        'leaning across the sixty-centimeter table',
        'floating two centimeters above the water',
        'He is 190 cm tall.',
        'a hundred people waited',
        '「ちょっと待って」',
    ]) assert.ok(!pattern.test(text), text);
});

check('public text stays neutral', () => {
    assert.ok(!new RegExp(String.fromCharCode(0xCC10, 0xBE60)).test(line + builder));
});

console.log(`translator-number-note: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
