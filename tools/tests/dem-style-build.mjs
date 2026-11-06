import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseDemStyleData } from '../../src/dem-style-loader.js';
const require = createRequire(import.meta.url), B = require('../build-css.cjs'), L = require('../css-lib.cjs');
const parent = path.resolve(os.tmpdir()), dir = fs.mkdtempSync(path.join(parent, 'bl-dem-build-'));
const write = (name, text) => fs.writeFileSync(path.join(dir, name), `/* ===== css/${name} ===== */\n${text}\n`);
const hydrate = output => output.text.replace(/@media not all \{#bl-dem-slot-([\w-]+)\{--bl-dem-slot:0\}\}/g, (_, id) => {
    assert.ok(output.dem.slots[id]); return output.dem.slots[id].rules.join('\n');
});
let passed = 0;
function test(name, run) { run(); passed++; console.log(`통과 ${passed}: ${name}`); }
try {
    write('00-base.css', ':root{--base:1}.base{color:red}');
    write('20-panel.css', '.salty-panel .control{color:green}');
    write('30-dem-skin.css', 'body.salty.salty-dem-skin .card{padding:var(--gap);content:"$&"}.public-demo.salty-dem-skin{color:blue}.salty-sample.salty-dem-skin{color:green}');
    write('99-lazy-panel.css', '#salty-lazy-panel-start {}\nbody.salty.salty-dem-skin .tail{color:pink}');
    const two = B.build(dir, { bucket: false, key: false }), one = B.build(dir, { bucket: false, key: false, split: false });
    test('실제 빌드 함수가 내용·대체 파일·같은 판 표식을 함께 만들어요', () => {
        assert.ok(two.dem.count > 0);
        assert.ok(two.text.includes(`--bl-dem-style-key:"${two.dem.key}"`));
        assert.ok(two.lazyText.includes(`--bl-dem-style-key:"${two.dem.key}"`));
        assert.deepEqual(parseDemStyleData(two.dem.data, two.dem.key), two.dem.slots);
        assert.deepEqual(parseDemStyleData(two.dem.fallback, two.dem.key), two.dem.slots);
        assert.equal(B.untouched(two.text), true, '분리 내용의 키까지 빌드 해시에 들어가요');
    });
    test('분리된 칸을 복원하면 데우스 선언이 원래 자리로 돌아와요', () => {
        const rules = L.flatRules(L.parse(hydrate(two)));
        assert.ok(rules.some(rule => rule.selector.includes('body.salty.salty-dem-skin .card') && rule.decls.some(d => d.lname === 'padding' && d.value === 'var(--gap)')));
        assert.ok(!hydrate(two).includes('#bl-dem-slot-'));
    });
    test('독립 미리보기와99꼬리는 별도 내용으로 빼지 않아요', () => {
        assert.ok(two.text.includes('.public-demo.salty-dem-skin'));
        assert.ok(two.preview.includes('.salty-sample.salty-dem-skin'));
        assert.ok(B.lazyTail(two.text).includes('.tail'));
        assert.equal(B.lazyTail(two.lazyText), B.lazyTail(one.text));
        assert.ok(!B.lazyTail(two.lazyText).includes('#bl-dem-slot-'));
    });
    test('테마를 끈 사본에는 분리 칸이 남지 않아요', () => {
        const ext = B.extText(two.text, two.lazyText);
        assert.ok(!ext.includes('#bl-dem-slot-'));
        assert.ok(ext.includes('.public-demo.salty-dem-skin'), '독립 표본 규칙은 유지해요');
    });
    test('내용이 바뀌면 데이터 주소용 키와 CSS 해시도 달라져요', () => {
        write('30-dem-skin.css', 'body.salty.salty-dem-skin .card{padding:2px}');
        const next = B.build(dir, { bucket: false, key: false });
        assert.notEqual(next.dem.key, two.dem.key); assert.notEqual(next.digest, two.digest);
        assert.throws(() => parseDemStyleData(two.dem.data, next.dem.key), /판/);
    });
} finally {
    if (path.dirname(path.resolve(dir)) !== parent || !path.basename(dir).startsWith('bl-dem-build-')) throw Error('시험 폴더 범위를 확인해야 해요');
    fs.rmSync(dir, { recursive: true });
}
console.log(`작은 CSS의 실제 빌드 연결 시험 ${passed}개를 통과했어요.`);
