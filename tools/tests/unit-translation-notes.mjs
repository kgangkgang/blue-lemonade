// 역주 자리 찾기 (src/addons/translator/translation-notes.js) — 번호 붙은 역주 묶음만 본문에서 떼어 내야 해요
//   node tools/tests/unit-translation-notes.mjs .
import { assert, load, suite } from './_t.mjs';
const { test, done } = suite('unit-translation-notes');
const { translatorNoteRanges, maskTranslatorNotes } = await load('src/addons/translator/translation-notes.js');
const cut = (text, options) => translatorNoteRanges(text, options).map(r => text.slice(r.start, r.end));

await test('「역주:」 머리줄 아래 번호 줄을 한 묶음으로 찾아요', () => {
    const text = '그는 사케[1]를 마셨다.\n\n역주:\n[1] 일본 술';
    assert.deepEqual(cut(text), ['역주:\n[1] 일본 술']);
    const [range] = translatorNoteRanges(text);
    assert.equal(text.slice(range.attachStart, range.start), '\n\n', 'attachStart 는 앞의 빈 줄까지 물어요');
});

await test('머리줄이 없으면 「[1]:」처럼 쌍점이 있어야 역주예요', () => {
    assert.deepEqual(cut('그는 사케[1]를 마셨다.\n\n[1]: 일본 술'), ['[1]: 일본 술']);
    assert.deepEqual(cut('그는 사케[1]를 마셨다.\n\n[1] 일본 술'), [], '쌍점 없는 [1] 줄은 본문일 수 있어요');
    assert.deepEqual(cut('그는 사케[^a]를 마셨다.\n\n[^a]: 일본 술'), ['[^a]: 일본 술']);
});

await test('headed 를 켜면 머리줄 없는 숫자 역주는 건드리지 않아요', () => {
    assert.deepEqual(cut('그는 사케[1]를 마셨다.\n\n[1]: 일본 술', { headed: true }), []);
    assert.deepEqual(cut('그는 사케[1]를 마셨다.\n\n역주:\n[1] 일본 술', { headed: true }), ['역주:\n[1] 일본 술']);
});

await test('본문에 참조가 없는 번호는 역주로 보지 않아요', () => {
    assert.deepEqual(cut('본문만 있다.\n[2]: 없는 참조'), []);
    assert.deepEqual(cut('역주나 번호가 전혀 없는 글'), []);
    assert.deepEqual(cut(null), []);
});

await test('빈 줄로 띄운 다음 번호까지 잇고, 그 뒤 본문에서 끝나요', () => {
    const text = '사케[1] 다다미[2]\n\n**역주:**\n[1] 술\n\n[2] 바닥\n\n다음 문단';
    assert.deepEqual(cut(text), ['**역주:**\n[1] 술\n\n[2] 바닥']);
});

await test('코드 울타리 안의 역주는 그대로 둬요', () => {
    assert.deepEqual(cut('```\n역주:\n[1] x\n```\n사케[1]'), []);
});

await test('문단 번호(⟦n⟧)가 바뀌면 앞 문단의 참조는 잊어요', () => {
    const text = '⟦1⟧ 사케[1]\n역주:\n[1] 술\n⟦2⟧ 다음\n역주:\n[1] 술';
    assert.deepEqual(cut(text), ['역주:\n[1] 술'], '둘째 문단에는 [1] 참조가 없어요');
});

await test('같은 번호가 두 번 나오면 첫 줄에서 끊어요', () => {
    assert.deepEqual(cut("사케[1]\nTranslator's notes:\n[1] sake\n[1] dup"), ["Translator's notes:\n[1] sake"]);
});

await test('찾기를 연달아 불러도 결과가 같아요 (정규식 lastIndex 가 남지 않아요)', () => {
    const text = '사케[1]\n\n역주:\n[1] 술';
    assert.deepEqual(cut(text), cut(text));
    assert.equal(cut(text).length, 1);
});

await test('가렸다가 되돌리면 원래 글이에요', () => {
    const text = '사케[1]를 마셨다.\n\n역주:\n[1] 일본 술';
    const masked = maskTranslatorNotes(text);
    assert.equal(masked.changed, true);
    assert.ok(!masked.text.includes('일본 술'));
    assert.equal(masked.restore(masked.text), text);
    assert.equal(masked.restore(masked.text, note => `<i>${note}</i>`), '사케[1]를 마셨다.\n\n<i>역주:\n[1] 일본 술</i>');
    const plain = maskTranslatorNotes('역주 없는 글');
    assert.equal(plain.changed, false);
    assert.equal(plain.text, '역주 없는 글');
});

await test('attach 를 켜면 앞의 빈 줄까지 같이 가려요', () => {
    const text = '사케[1]를 마셨다.\n\n역주:\n[1] 일본 술';
    const masked = maskTranslatorNotes(text, { attach: true });
    assert.ok(masked.text.startsWith('사케[1]를 마셨다.') && !masked.text.includes('\n'));
});

await test('글에 이미 같은 표식이 있으면 겹치지 않는 표식을 써요', () => {
    const token = '' + String.fromCharCode(0xE100) + '';
    const text = `사케[1] ${token}\n\n역주:\n[1] 술`;
    const masked = maskTranslatorNotes(text);
    assert.equal(masked.restore(masked.text), text);
});

done();
