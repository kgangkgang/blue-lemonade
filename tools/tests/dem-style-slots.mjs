import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { requiredFlags, splitDemSlots, restoreDemSlots, compileDemSheets } = require('../css-dem-slots.cjs');
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = (name, run) => { run(); passed++; console.log(`통과 ${passed}: ${name}`); };
test('부정·선택 갈래의 표식을 필수로 오인하지 않아요', () => {
    assert.deepEqual(requiredFlags('body:not(.salty-dem-skin) .item'), []);
    assert.deepEqual(requiredFlags(':is(body.salty-dem-skin, .other) .item'), []);
    assert.deepEqual(requiredFlags('[data-x=".salty-dem-skin"] .item'), []);
    assert.deepEqual(requiredFlags('.salty-sample.salty-dem-skin .item'), [], '독립 표본은 몸체의 켬 상태와 달라요');
    assert.deepEqual(requiredFlags('body.salty .salty-dem-skin .item'), [], '자식의 표식을 몸체 설정으로 오인하지 않아요');
    assert.deepEqual(requiredFlags('body.salty.salty-dem-skin .item:not(.off)'), ['salty-dem-skin']);
});
test('겹치는 일반 규칙을 제자리에 두고 원래 바이트를 되살려요', () => {
    const text = '.x{color:red} body.salty.salty-dem-skin .x{color:blue}\nbody.salty.salty-dem-skin .y{color:black}\n.x{color:green} @media(max-width:400px){body.salty.salty-dem-ink .x{color:pink}.z{color:white}}';
    const split = splitDemSlots(text);
    assert.equal(split.stats.rules, 3); assert.equal(split.stats.slots, 2);
    assert.ok(split.core.indexOf('.x{color:red}') < split.core.indexOf('@media not all'));
    assert.ok(split.core.indexOf('@media not all') < split.core.indexOf('.x{color:green}'));
    assert.equal(restoreDemSlots(split.core, split.slots), text);
});
test('쉼표 갈래 중 일반 화면이 있으면 원래 시트에 남겨요', () => {
    const text = 'body.salty-dem-skin .x,body .other{color:red}';
    assert.equal(splitDemSlots(text).core, text);
});
test('키프레임·등록 속성·문자열과 주석을 건드리지 않아요', () => {
    const text = '@property --x{syntax:"<color>";inherits:true;initial-value:red}@keyframes x{from{opacity:0}to{opacity:1}}/* 남겨요 */body.salty.salty-dem-skin .x{content:"$&}"}';
    const split = splitDemSlots(text); assert.equal(split.stats.rules, 1);
    assert.equal(restoreDemSlots(split.core, split.slots), text);
    assert.throws(() => restoreDemSlots(split.core + split.core, split.slots), /겹쳐/);
});
test('실제 네 원본과 첫 장·전체 장도 분리 후 바이트가 같아요', () => {
    for (const file of ['css/08-regex-unify.css', 'css/30-dem-skin.css', 'css/37-prompt-ink.css', 'css/55-dem-expressive.css', 'style.css', 'src/style-lazy.gen.css']) {
        const text = fs.readFileSync(path.join(root, file), 'utf8'), split = splitDemSlots(text);
        if (text.includes('#bl-dem-slot-')) {
            const again = compileDemSheets(text); assert.equal(again.count, 0, '이미 분리한 내용은 두 번 빼지 않아요'); assert.equal(again.boot, text);
        } else assert.ok(split.stats.rules > 0, file);
        assert.equal(restoreDemSlots(split.core, split.slots), text, file);
    }
});
console.log(`데우스 시트 분리 준비 시험 ${passed}개를 통과했어요.`);
