// 단어 치환 전후 보기의 강조 자리 (테마 5.7.3) — 엔진(replaceText spans)이 실제로 바꾼 자리만 칠하는지
//   node tools/tests/word-replace-marks.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
// spans 를 켜도 바꾼 글 · 개수는 그대로, 자리는 코드 포인트 기준(이모지 앞뒤도 맞게), 조사까지 한 덩어리, HTML 속성 · 코드는 안 칠함
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const core = path.resolve(process.argv[2] || '.', 'src/word-tools-core.js');
const { replaceText } = await import(pathToFileURL(core).href);
const cut = (text, ranges) => ranges.map(([a, b]) => Array.from(text).slice(a, b).join(''));

if (!replaceText('가', [{ from: '가', to: '나' }], { spans: true }).spans) {
    console.log('skip: 이 트리의 replaceText 에는 spans 가 없어요 (5.7.2 이전)');
    process.exit(0);
}

const cases = [
    ['일본어 접미사', 'くんが来た。山田くん！', [{ from: 'くん', to: 'ちゃん' }], ['くん', 'くん'], ['ちゃん', 'ちゃん']],
    ['한국어 조사까지', '레오가 웃었다. 「레오, 왔어?」 레오는', [{ from: '레오', to: '아리아' }], ['레오가', '레오', '레오는'], ['아리아가', '아리아', '아리아는']],
    ['받침 따라 바뀐 조사', '세라프가 창밖을 본다. 세라프는 웃었다.', [{ from: '세라프', to: '미카엘' }], ['세라프가', '세라프는'], ['미카엘이', '미카엘은']],
    ['이모지 · HTML 속성 · 코드', '사과는 맛있다 🍎 사과를 <b title="사과">사과</b> `사과`', [{ from: '사과', to: '수박' }], ['사과는', '사과를', '사과'], ['수박은', '수박을', '수박']],
    ['대소문자 무시', 'Leo and leo', [{ from: 'Leo', to: 'Nagi' }], ['Leo', 'leo'], ['Nagi', 'Nagi']],
    ['여러 규칙', '「レオくん」セラフは言った。', [{ from: 'セラフ', to: 'ミカエル' }, { from: 'くん', to: 'ちゃん' }], ['くん', 'セラフ'], ['ちゃん', 'ミカエル']],
    ['바뀐 것 없음', '아무 일도 없었다.', [{ from: '세라프', to: '미카엘' }], [], []],
];
let n = 0;
for (const [name, text, rules, before, after] of cases) {
    const plain = replaceText(text, rules, {});
    const marked = replaceText(text, rules, { spans: true });
    assert.equal(marked.text, plain.text, `${name}: spans 를 켜도 바꾼 글은 같아야 해요`);
    assert.equal(marked.count, plain.count, `${name}: 개수도 같아야 해요`);
    assert.equal('spans' in plain, false, `${name}: spans 를 안 켜면 예전 모양 그대로`);
    assert.deepEqual(cut(text, marked.spans.src), before, `${name}: 바꾸기 전 강조 자리`);
    assert.deepEqual(cut(marked.text, marked.spans.out), after, `${name}: 바꾼 뒤 강조 자리`);
    assert.equal(marked.spans.src.length, marked.spans.out.length, `${name}: 전후 자리 수가 같아야 해요`);
    n++;
}
console.log(`word-replace-marks: ${n}/${cases.length} 통과`);
