// 번역기 → 장기 기억 번역 재사용 (archive-bridge.js matchingTranslation)
// 메시지 통째로 맞은 경우와 문단 하나가 맞은 경우가 같은 기준으로 받는다: 한글이 있고 가나가 남지 않은 번역만.
// 실행: node tools/tests/translator-archive-bridge.mjs salty-ext
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=pathToFileURL(path.resolve(process.argv[2]||'.')+'/');
const {matchingTranslation}=await import(new URL('src/addons/translator/archive-bridge.js',root));

// 통째 갈래: 원문 전체가 발췌와 같다
assert.equal(matchingTranslation('"Hello."','"안녕."','"Hello."'),'"안녕."');
assert.equal(matchingTranslation('Hello.','  안녕.  ','"Hello."'),'안녕.');
assert.equal(matchingTranslation('Hello.','Hello.','Hello.'),'');
assert.equal(matchingTranslation('"Hello."','"안녕." ねえ','"Hello."'),'','whole message: leftover hiragana is not reused');
assert.equal(matchingTranslation('Hello.','안녕, カナ.','Hello.'),'','whole message: leftover katakana is not reused');
console.log('PASS whole-message branch: Korean reused, leftover kana / no Hangul rejected');

// 문단 갈래: 빈 줄로 나눈 문단 하나가 발췌와 같다
const source='"Hello."\n\nBye.';
assert.equal(matchingTranslation(source,'"안녕."\n\n잘 가.','"Hello."'),'"안녕."');
assert.equal(matchingTranslation(source,'"안녕."\n\n잘 가.','Bye.'),'잘 가.');
assert.equal(matchingTranslation(source,'"안녕." ねえ\n\n잘 가.','"Hello."'),'','paragraph: leftover kana is not reused');
assert.equal(matchingTranslation(source,'"안녕." ねえ\n\n잘 가.','Bye.'),'잘 가.','paragraph: kana in another paragraph does not block');
assert.equal(matchingTranslation(source,'Hello.\n\n잘 가.','"Hello."'),'');
console.log('PASS paragraph branch: Korean reused, leftover kana / no Hangul rejected');

// 두 갈래가 같은 번역을 똑같이 받거나 버린다
const samples=['안녕.','  안녕.  ','안녕. ねえ','안녕, カナ.','아델・슈타인','으아ー','Hello.','こんにちは','漢字 한글','한글 ｶﾅ'];
for(const text of samples) {
    const whole=matchingTranslation('Line A.',text,'Line A.');
    const paragraph=matchingTranslation('Line A.\n\nLine B.',`${text}\n\n다음.`,'Line A.');
    assert.equal(whole,paragraph,`same rule for ${JSON.stringify(text)}: whole=${JSON.stringify(whole)} paragraph=${JSON.stringify(paragraph)}`);
}
console.log(`PASS both branches agree on ${samples.length} samples`);

// 나머지 규칙은 그대로
assert.equal(matchingTranslation('A','안녕',''),'');
assert.equal(matchingTranslation('A\n\nB','가\n\n나\n\n다','A'),'','paragraph counts differ');
assert.equal(matchingTranslation('A\n\nA','가\n\n나','A'),'','excerpt matches two paragraphs');
assert.equal(matchingTranslation('A\n\nB','가\n\n나','C'),'','excerpt not found');
assert.equal(matchingTranslation('“A”\n\nB','「가」\n\n나','"A"'),'「가」');
assert.equal(matchingTranslation('A\n  \nB','가\n\n나','B'),'나');
console.log('PASS unchanged guards: empty excerpt, count mismatch, duplicate, missing, quotes, blank-line split');
