// 번역기 2.9.4 한글 낱말에 낀 한자: 「…마력으로 보호되는 특注품이라고──!」(特注品 → 특주품). 예전 규칙은 원문에 있던 2자 이상 한자 덩이만 잡아
// 원문(영어)에 없는 한 글자가 한국어 낱말 안에 끼면 그대로 남았다. 문단 캐시 · 덩이 · 통째 길 모두 linesToFix 를 지난다. 가상 문장만.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { linesToFix, leftoverHan, stillLeftover, fixNoteFor, LEFTOVER_FIX_NOTE } = await import(pathToFileURL(path.join(root, 'src/addons/translator/leftover-fix.js')));
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };
const EN = 'It is a custom-made piece protected by mana—!\n\nThe guard nodded.';
const KO = '마력으로 보호되는 특注품이라고──!\n\n경비가 고개를 끄덕였다.';

test('영어 원문 · 한국어 번역 낱말 안의 한 글자 한자(注)를 고칠 줄로 고른다 · 한자 머리말', () => {
    const rows = linesToFix(KO, EN);
    assert.equal(rows.length, 1); assert.equal(rows[0][0], 0); assert.deepEqual(rows[0][2], ['注']);
    assert.equal(fixNoteFor(rows, 'KANA'), LEFTOVER_FIX_NOTE);
    assert.equal(linesToFix(KO, EN, [], [], { english: false }).length, 1, '문단 캐시 판정에도 걸린다 (캐시에 안 넣음)');
});
test('일본어 원문(特注品)에서 와도 한글에 붙은 한자는 고른다', () => {
    assert.deepEqual(leftoverHan('마력으로 보호되는 특注품이라고──!', '魔力で守られた特注品だと──！'), ['注']);
    assert.deepEqual(leftoverHan('그는 대王국으로 떠났다.', '他前往大王国。'), ['王'], '중국어 원문');
    assert.deepEqual(leftoverHan('그 會議에 늦었다. 그 室은 넓었다.', '会議と室。'), [], '한자 뒤에 조사만 (6.4.2 그대로)');
});
test('2.9.9 한글 낱말 끝에 붙은 한 글자 한자(변顔 ← 変顔)도 고른다 — 원문 일본어 줄에 있던 것만', () => {
    const JP = '「あはは、あの変顔すごいね！」';
    assert.deepEqual(leftoverHan('「아하하, 그 변顔 사진 너무 웃긴 거 아니야~!」', JP), ['顔']);
    assert.deepEqual(leftoverHan('「그 변顔, 웃기다」', JP), ['顔'], '뒤가 쉼표');
    assert.equal(linesToFix('「아하하, 그 변顔 너무 웃겼어」', JP).length, 1, '고칠 줄로 고른다');
    assert.deepEqual(leftoverHan('그는 변顔 했다.', 'He made a funny face.'), [], '원문에 없는 한자가 낱말 끝이면 예전처럼 둔다');
    assert.deepEqual(leftoverHan('그는 변顔 했다.', '그는 변顔 했다.'), [], '한국어 원문 줄에 그대로 있던 것');
    assert.deepEqual(leftoverHan('변顔(헨가오) 사진', JP), [], '한글 읽기 괄호');
});
test('한국어 원문에 원래 있던 한자 · 용어집 표기 · 일부러 둔 자리는 고르지 않는다', () => {
    assert.deepEqual(leftoverHan('이 책은 韓國語 교재야.', '이 책은 韓國語 교재야.'), [], '띄어 쓴 한자 (한글에 안 붙음)');
    assert.deepEqual(leftoverHan('그는 韓國어를 배웠다.', '그는 韓國어를 배웠다.'), [], '한국어 원문 줄에 그대로 있던 한자');
    assert.deepEqual(leftoverHan('그는 天野님에게 인사했다.', 'He greeted Amano.', ['天野']), [], '용어집 표기');
    assert.deepEqual(leftoverHan('특주품(特注品)이라고 했다.', EN), [], '괄호 병기');
    assert.deepEqual(leftoverHan('特注品(특주품)이라고 했다.', EN), [], '한글 읽기 괄호');
    assert.deepEqual(leftoverHan('명패에는 「特注」라고 적혀 있었다.', EN), [], '한글 없는 낫표 안');
    assert.deepEqual(leftoverHan('표 1 을 보라.', 'See table 1.'), []);
});
test('다시 온 줄: 한국어로 고쳐 왔으면 받고, 그대로면 다시 남김', () => {
    assert.equal(stillLeftover('마력으로 보호되는 특주품이라고──!', ['注'], '마력으로 보호되는 특注품이라고──!'), false);
    assert.equal(stillLeftover('마력으로 보호되는 특注품이라고──!', ['注'], '마력으로 보호되는 특注품이라고──!'), true);
});
test('예전 규칙 그대로: 원문에 있던 2자 덩이(室長님) · 한자가 더 많은 글은 손대지 않음', () => {
    assert.deepEqual(leftoverHan('실장 室長님이 왔다.', '室長が来た。'), ['室長']);
    assert.deepEqual(linesToFix('天地合同', 'heaven'), [], '한글이 주된 글이 아니면 안 본다');
});
test('배선: 세 길 모두 linesToFix (문단 캐시 cacheable · 묶음 끝 고치기 · 통째/덩이 길)', () => {
    const index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
    assert.ok(index.includes('!linesToFix(out, body, glossaryHanKeep(), [], { english: false }).length'));
    assert.ok(index.includes('lines = linesToFix(joined, bodies.join'));
    assert.ok(index.includes('const kanaLines = paragraphParts ? [] : linesToFix(translatedText'));
});
console.log(`\ntranslator-han-in-word: ${passed} passed, 0 failed`);
