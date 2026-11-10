// 단어 치환 엔진 (src/word-tools-core.js) — 조사 맞추기 · 건너뛰는 자리 · 옛 규칙 들여오기
//   node tools/tests/unit-word-tools-core.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-word-tools-core');
const { ending, replaceText, importRuleSets } = await load('src/word-tools-core.js');

await test('받침 판정: 한글 · 숫자 · 영문 끝 글자', () => {
    assert.equal(ending('사과'), 0);
    assert.equal(ending('물'), 8, 'ㄹ 받침은 8');
    assert.ok(ending('밥') > 0 && ending('밥') !== 8);
    assert.equal(ending('1'), 8, '일');
    assert.equal(ending('3'), 1, '삼');
    assert.equal(ending('2'), 0, '이');
    assert.equal(ending('l'), 8);
    assert.equal(ending('abc'), 0);
    assert.equal(ending(''), 0);
    assert.equal(ending('  물  '), 8, '앞뒤 공백은 떼고 봐요');
});

await test('바꾼 말의 받침에 맞춰 조사를 고쳐요', () => {
    assert.equal(replaceText('철수는 철수가 철수를 철수와', [{ from: '철수', to: '길동' }]).text, '길동은 길동이 길동을 길동과');
    assert.equal(replaceText('길동은 길동이 길동을 길동과', [{ from: '길동', to: '철수' }]).text, '철수는 철수가 철수를 철수와');
    assert.equal(replaceText('철수로 간다', [{ from: '철수', to: '길동' }]).text, '길동으로 간다');
    assert.equal(replaceText('철수로 간다', [{ from: '철수', to: '서울' }]).text, '서울로 간다', 'ㄹ 받침 뒤는 「로」');
});

await test('particles:false 면 조사는 그대로 둬요', () => {
    assert.equal(replaceText('철수는', [{ from: '철수', to: '길동' }], { particles: false }).text, '길동는');
});

await test('코드 · 태그 · 주석 안은 건드리지 않아요', () => {
    const r = replaceText('철수 `철수` <b title="철수">철수</b> <!-- 철수 --> ```\n철수\n```', [{ from: '철수', to: '민지' }]);
    assert.equal(r.text, '민지 `철수` <b title="철수">민지</b> <!-- 철수 --> ```\n철수\n```');
    assert.equal(r.count, 2);
});

await test('꺼 둔 규칙 · 빈 규칙은 건너뛰고, 쉼표로 여러 표기를 받아요', () => {
    const rules = [{ from: '없음', to: 'x', enabled: false }, null, { from: '고양이, 냥이，야옹이', to: '개' }];
    assert.equal(replaceText('없음 고양이 냥이 야옹이', rules).text, '없음 개 개 개');
});

await test('앞선 규칙이 이기고, 바꾼 글은 다시 찾지 않아요', () => {
    assert.equal(replaceText('가나', [{ from: '가', to: '나' }, { from: '나', to: '다' }], { particles: false }).text, '나다');
    assert.equal(replaceText('가나다', [{ from: '가나', to: 'A' }, { from: '가나다', to: 'B' }], { particles: false }).text, 'A다', '먼저 적은 규칙이 이겨요');
});

await test('대소문자 · 낱말 단위 옵션', () => {
    assert.equal(replaceText('Cat cat', [{ from: 'cat', to: 'dog' }]).text, 'dog dog');
    assert.equal(replaceText('Cat cat', [{ from: 'cat', to: 'dog' }], { caseSensitive: true }).text, 'Cat dog');
    assert.equal(replaceText('Cat catalog cat', [{ from: 'cat', to: 'dog' }], { wholeWords: true }).text, 'dog catalog dog');
    assert.equal(replaceText('철수는 철수네', [{ from: '철수', to: '민지' }], { wholeWords: true }).text, '민지는 철수네', '조사가 붙은 낱말은 낱말 단위로 봐요');
});

await test('spans 는 바꾼 자리를 글자 번호로 돌려줘요', () => {
    const r = replaceText('가 철수는 나', [{ from: '철수', to: '김민지' }], { spans: true });
    assert.equal(r.text, '가 김민지는 나');
    assert.deepEqual(r.spans, { src: [[2, 5]], out: [[2, 6]] });
});

await test('옛 설정에서 규칙 묶음을 들여와요', () => {
    const sets = importRuleSets({
        word_replace: { rules: [{ original: 'a||b', replacement: 'c' }, { from: '', to: 'x' }, null] },
        'text-to-image-converter': {
            replaceRules: [{ from: 'p', to: 'q', enabled: false }],
            presets: { nonePreset: { replaceRules: [{ from: 'z', to: 'z' }] }, mine: { originalWord1: 'o1', replacementWord1: 'r1', originalWord3: 'o3' }, empty: {} },
        },
    });
    assert.deepEqual(sets, [
        { name: '기존 단어 치환 규칙', rules: [{ from: 'a, b', to: 'c', enabled: true }] },
        { name: '기존 발췌 규칙', rules: [{ from: 'p', to: 'q', enabled: false }] },
        { name: 'mine', rules: [{ from: 'o1', to: 'r1', enabled: true }, { from: 'o3', to: '', enabled: true }] },
    ]);
    assert.deepEqual(importRuleSets({}), []);
});

done();
