// 6.4.2 번역문에 원문 글자가 남은 줄 — src/addons/translator/leftover-fix.js (순수) + index.js 연결 코드. 문장은 모두 지어낸 것.
// 6.4.2 v2 + 다시 온 줄은 지킨 자리 밖만 · 20줄은 가나 줄부터 · 읽기 괄호 · 작은따옴표 · 한국어 원문 한자 · 머리말 · 문단 캐시 재사용.
// 6.4.2 v3 + 가나가 있던 줄은 다시 온 줄에서 가나만 본다 · 맨 URL · 인라인 코드 · 태그 안 · 루비 · 《》 읽기는 고르지 않는다.
// 6.4.3 한자 v4 + 지킴 자리 좁힘(URL 끝 · 태그 꼴 · 주석) · <rb> · 대문자 루비 · 붙은 《》 읽기만.
// 6.4.3 + 문장 첫머리에 남은 흔한 영어 낱말 · 여는 말 (원문에서 그 말이 든 줄이 모두 영어가 주된 줄일 때만).
// 6.4.3 영어 v4 + 「한글이 주된 줄」 셈에서 맨 URL · 인라인 코드 글자는 뺀다.
//   node tools/tests/translator-leftover.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const read = (rel) => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
const L = await import(pathToFileURL(path.join(themeRoot, 'src/addons/translator/leftover-fix.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
// 6.4.1 의 linesWithKana 그대로 (가나만일 때 결과가 같은지 견주려고)
function oldLinesWithKana(text) {
    const s = String(text ?? '');
    const hangul = (s.match(/[가-힣]/g) || []).length, kana = (s.match(/[ぁ-ゖァ-ヺ]/g) || []).length;
    if (!kana || hangul <= kana) return [];
    const out = [];
    s.split('\n').forEach((line, index) => { if (/[ぁ-ゖァ-ヺ]/.test(line) && line.trim().length <= 1200 && out.length < 20) out.push([index, line]); });
    return out;
}
const pick = (t, src, keep, names) => L.linesToFix(t, src, keep, names).map(([i, , runs]) => [i, runs]);

await test('원문의 한자 덩이가 한글 줄에 남으면 그 줄을 고른다 (서술 · 「」 안 한글 대사)', () => {
    const src = 'ミナ室長は書類を見た。\n「ミナ室長、こちらです」\n天気がいい。';
    const out = '미나 室長은 서류를 보았다.\n「미나 室長님, 이쪽입니다」\n날씨가 좋다.';
    assert.deepEqual(pick(out, src), [[0, ['室長']], [1, ['室長']]]);
});
await test('일부러 둔 한자는 뺀다 — 괄호 병기 · 한글 없는 「」 『』 따옴표 · 용어집 번역 표기 · 원문에 없는 덩이 · 한 글자', () => {
    const src = '室長と天文部と星座。室。';
    assert.deepEqual(pick('미나는 실장(室長)이 되었다.', src), []);
    assert.deepEqual(pick('문에는 「室長」이라고 적혀 있었다.', src), []);
    assert.deepEqual(pick('『星座』라는 책을 폈다.', src), []);
    assert.deepEqual(pick('"天文部" 팻말이 보였다.', src), []);
    assert.deepEqual(pick('天文部 부원들이 모였다.', src, ['天文部']), [], 'glossary keeps the hanja form');
    assert.deepEqual(pick('天文部 부원들이 모였다.', src), [[0, ['天文部']]], 'without the glossary entry it is a leftover');
    assert.deepEqual(pick('그는 會議에 늦었다.', src), [], 'not in the source');
    assert.deepEqual(pick('그 室은 넓었다.', src), [], 'single hanja');
});
await test('한글이 주된 글 · 줄이 아니면(중국어 · 일본어로 번역) 안 고른다 · 원문이 없으면 예전처럼 가나만', () => {
    assert.deepEqual(pick('室長は書類を見た。', '室長は書類を見た。'), []);
    assert.deepEqual(pick('室長看了文件。', '室長は書類を見た。'), []);
    assert.deepEqual(pick('미나 室長은 서류를 보았다.', ''), [], 'no source → no hanja check');
});
await test('가나만 남은 글은 6.4.1 linesWithKana 와 같은 줄 · 같은 차례 · 20줄까지', () => {
    const samples = ['미나는 ミナ라고 불렸다.\n괜찮다.\nそれでも 웃었다.', 'すべて日本語の文。', '한국어만.', Array.from({ length: 30 }, (_, i) => `줄 ${i} ミナ 이야기`).join('\n')];
    for (const t of samples) assert.deepEqual(L.linesToFix(t, '').map(([i, l]) => [i, l]), oldLinesWithKana(t), t.slice(0, 20));
    for (const t of samples) assert.deepEqual(L.linesToFix(t, '原文に漢字なし').map(([i, l]) => [i, l]), oldLinesWithKana(t), 'source without the runs: same as before');
    const many = Array.from({ length: 30 }, (_, i) => `미나 室長 ${i}번 보고`).join('\n');
    assert.equal(L.linesToFix(many, '室長').length, 20);
});
await test('다시 번역해 온 줄: 가나나 그 줄의 한자 덩이가 그대로면 넣지 않는다 · 머리말은 한자 줄이 있을 때만 바뀐다', () => {
    assert.equal(L.stillLeftover('미나 室長님', ['室長']), true);
    assert.equal(L.stillLeftover('미나 실장님', ['室長']), false);
    assert.equal(L.stillLeftover('미나 ミナ', []), true);
    const kanaNote = 'KANA\n';
    assert.equal(L.fixNoteFor([[0, 'x', []]], kanaNote), kanaNote);
    assert.equal(L.fixNoteFor([[0, 'x', []], [1, 'y', ['室長']]], kanaNote), L.LEFTOVER_FIX_NOTE);
    assert.match(L.LEFTOVER_FIX_NOTE, /one line per number\.\]\n$/);
});
await test('6.4.2 v2 다시 온 줄은 일부러 둔 자리 밖의 덩이만 센다 — 제대로 고쳐 온 줄 · 같이 고친 가나를 버리지 않는다', () => {
    const src = '扉には「室長」と書かれていた。レックスの室長は笑った。';
    const out = '문에는 「室長」이라고 적혀 있었고, 그 室長님은 웃었다.';
    assert.deepEqual(pick(out, src), [[0, ['室長']]]);
    assert.equal(L.stillLeftover('문에는 「室長」이라고 적혀 있었고, 그 실장님은 웃었다.', ['室長']), false, 'the kept nameplate stays, the leftover is fixed');
    assert.equal(L.stillLeftover('문에는 「室長」이라고 적혀 있었고, 그 室長님은 웃었다.', ['室長']), true);
    assert.deepEqual(pick('그녀는 ミナ였고 四面楚歌 상태였다.', 'ミナは四面楚歌だった。'), [[0, ['四面楚歌']]]);
    assert.equal(L.stillLeftover('그녀는 미나였고 사면초가(四面楚歌) 상태였다.', ['四面楚歌']), false, 'reading kept in brackets');
    assert.equal(L.stillLeftover('그녀는 ミナ였고 사면초가 상태였다.', ['四面楚歌']), true, 'kana still there (6.4.1 rule)');
});
await test('6.4.2 v2 20줄 한도: 가나 줄을 6.4.1 차례대로 먼저 채우고 남는 자리에 한자 줄', () => {
    const text = Array.from({ length: 30 }, (_, i) => (i < 25 ? `미나 室長 ${i}번 보고` : `줄 ${i} ミナ 이야기`)).join('\n');
    const rows = L.linesToFix(text, 'ミナ室長');
    assert.equal(rows.length, 20);
    assert.deepEqual(rows.filter(([, line]) => /ミナ/.test(line)).map(([i]) => i), [25, 26, 27, 28, 29], 'all kana lines kept');
    assert.deepEqual(rows.map(([i]) => i), [...rows.map(([i]) => i)].sort((a, b) => a - b), 'in line order');
});
await test('6.4.2 v2 일부러 둔 한자를 더 뺀다 — 한자(한글 읽기) · 이름(독음) · 작은따옴표 · 한국어 원문에 원래 있던 한자', () => {
    const src = '彼は四面楚歌だった。天野が笑った。室長と書いた。';
    assert.deepEqual(pick('그는 그때 이미 四面楚歌(사면초가) 상태였다.', src), [], 'hanja then its Hangul reading');
    assert.deepEqual(pick('天野(아마노)가 웃었다.', src), [], 'a name with its reading');
    assert.deepEqual(pick("명패에는 '室長'이라고 적혀 있었다.", src), [], 'ASCII single quotes');
    assert.deepEqual(pick('그는 室長이다.', '그는 室長이다.'), [], 'hanja that was already in a Korean source');
    assert.deepEqual(pick('그는 그때 이미 四面楚歌 상태였다.', src), [[0, ['四面楚歌']]], 'still a leftover without the reading');
});
await test('6.4.2 v2 머리말: 이름은 원어 발음으로 (한자음으로 읽지 않게) · 문단 캐시 재사용도 같은 판정', () => {
    assert.match(L.LEFTOVER_FIX_NOTE, /Japanese names in their Japanese pronunciation written in Hangul, Chinese names in their usual Korean form; follow the glossary/);
    assert.doesNotMatch(L.LEFTOVER_FIX_NOTE, /names become their Korean reading/);
    assert.match(read('src/addons/translator/translation-segments.js'), /if \(saved\.has\(key\) && cleanParagraphEcho\(saved\.get\(key\), body\) === saved\.get\(key\)\.replace\(\/\^\\n\+\|\\s\+\$\/g, ''\) && cacheable\(body, saved\.get\(key\)\)\)/, 'a cached paragraph that would not be cached now is translated again');
});
await test('6.4.2 v3 가나만 고치고 한자를 둔 답은 받는다 — 원래 줄에 가나가 있으면 6.4.1 처럼 가나만 본다 · 남은 한자는 계속 고른다', () => {
    const src = '室長はミナに言った。';
    const out = '室長은 ミナ에게 말했다.';
    assert.deepEqual(pick(out, src), [[0, ['室長']]]);
    assert.equal(L.stillLeftover('室長은 미나에게 말했다.', ['室長'], out), false, 'kana fixed, hanja left: not worse than the line sent');
    assert.equal(L.stillLeftover('실장은 미나에게 말했다.', ['室長'], out), false);
    assert.equal(L.stillLeftover('室長은 ミナ에게 말했다.', ['室長'], out), true, 'kana still there');
    assert.deepEqual(pick('室長은 미나에게 말했다.', src), [[0, ['室長']]], 'the hanja line is still picked, so the paragraph stays out of the cache');
    assert.equal(L.stillLeftover('室長은 웃었다.', ['室長'], '室長은 웃었다.'), true, 'a hanja-only line keeps the v2 rule');
});
await test('6.4.2 v3 글이 아닌 자리는 고르지도 세지도 않는다 — 맨 URL · 인라인 코드 · 태그 안(따옴표 없는 속성) · 루비 · 《》 읽기', () => {
    assert.deepEqual(pick('자료는 https://example.com/資料室/a.png 에 있다.', '資料は https://example.com/資料室/a.png にある。'), [], 'bare URL');
    assert.deepEqual(pick('`室長` 이라는 변수를 봐라.', '`室長`という変数を見ろ。'), [], 'inline code');
    assert.deepEqual(pick('`실장 室長` 이라고 적힌 코드를 봐라.', '`室長`'), [], 'inline code with Hangul inside');
    assert.deepEqual(pick('<span title=室長>미나</span>는 웃었다.', '<span title=室長>ミナ</span>は笑った。'), [], 'unquoted attribute');
    assert.deepEqual(pick('<ruby>室長<rt>실장</rt></ruby>님은 웃었다.', '<ruby>室長<rt>しつちょう</rt></ruby>は笑った。'), [], 'ruby reading');
    assert.deepEqual(pick('<ruby>室長<rp>(</rp><rt>실장</rt><rp>)</rp></ruby>님은 웃었다.', '室長は笑った。'), [], 'ruby with rp brackets');
    assert.deepEqual(pick('室長《실장》님은 웃었다.', '｜室長《しつちょう》は笑った。'), [], 'reading in 《》');
    const src = '<img src="/img/室長.png">室長は笑った。';
    assert.deepEqual(pick('<img src="/img/室長.png">室長님은 웃었다.', src), [[0, ['室長']]], 'the one in the text still counts');
    assert.equal(L.stillLeftover('<img src="/img/室長.png">실장님은 웃었다.', ['室長']), false, 'the one inside the tag is not counted');
    assert.deepEqual(pick('그는 3 < 5 라고 적힌 室長 의 메모를 봤다 > 그리고 웃었다.', '室長'), [[0, ['室長']]], 'a bare < is not a tag');
});
await test('6.4.3 문장 첫머리에 남은 흔한 영어 낱말 — 줄 처음 · 문장 뒤 · 한글 대사 「」 · 태그 안 글 · 강조', () => {
    const src = 'Now, Mina stands by the window. Still, she says nothing.\n"Well, that is odd," Rex said.';
    assert.deepEqual(pick('Now, 미나는 창가에 서 있다.', src), [[0, ['Now']]]);
    assert.deepEqual(pick('미나는 창가에 서 있다. Still, 그녀는 아무 말도 없다.', src), [[0, ['Still']]]);
    assert.deepEqual(pick('「Well, 그건 이상하네.」 렉스가 말했다.', src), [[0, ['Well']]]);
    assert.deepEqual(pick('<span style="color:#335577">Well, 그건 이상하네.</span>', src), [[0, ['Well']]], 'tag letters are not counted');
    assert.deepEqual(pick('*Now* 미나는 창가에 서 있다.', src), [[0, ['Now']]], 'an emphasised word left untranslated');
    assert.deepEqual(pick('*Now, 미나는* 창가에 서 있다.', src), [[0, ['Now']]]);
});
await test('6.4.3 영어 낱말은 빼는 것 — 이름 · 약어 · 한글 없는 따옴표 · 영어가 주된 줄 · 원문에 없는 낱말 · 목록 밖 낱말 · 문장 가운데', () => {
    const src = 'Will, over here. OK, go. Now, listen. Rowan, wait. Now Mina smiles and then she leaves.';
    assert.deepEqual(pick('Will, 이쪽이야.', src, [], ['Will']), [], 'a name');
    assert.deepEqual(pick('OK, 가자.', src), [], 'all-caps abbreviation');
    assert.deepEqual(pick('「Now, listen.」이라고 그가 말했다.', src), [], 'English-only quote');
    assert.deepEqual(pick('Now, listen to me, she said quietly. 웃었다.', src), [], 'English-dominant line');
    assert.deepEqual(pick('Now, 미나는 웃었다.', '今、ミナは笑った。'), [], 'not in the source');
    assert.deepEqual(pick('Rowan, 기다려.', src), [], 'not a common word');
    assert.deepEqual(pick('미나는 then 떠났다.', src), [], 'mid-sentence lowercase');
    assert.deepEqual(pick('Now, 미나는 웃었다.', src, [], ['now']), [], 'names compare case-insensitively');
    assert.deepEqual(pick('Now, 미나는 웃었다.', ''), [], 'no source → no English check');
});
await test('6.4.3 원문 언어: 원문에서 그 말이 든 줄이 영어가 주된 글일 때만 — 일본어 원문에 일부러 쓴 영어는 그대로', () => {
    assert.deepEqual(pick('「Yes, 마이 로드.」 그가 고개를 숙이며 대답했다.', '「Yes, マイロード」と彼は頭を下げて答えた。'), [], 'English inside a Japanese line');
    assert.deepEqual(pick('「Hello, 미나 씨. 오늘도 일찍 나왔네요.」', '「Hello, ミナさん。今日も早いですね」'), []);
    const src = 'Now, Mina waits by the door.\n「Yes, マイロード」と彼は答えた。';
    assert.deepEqual(pick('Now, 미나는 문가에서 기다린다.\n「Yes, 마이 로드.」 그가 대답했다.', src), [[0, ['Now']]], 'English line in, Japanese line out');
});
await test('6.4.3 여는 말 (두 · 세 낱말) · 굵게 · 줄임표 · 대시 바로 뒤 · 마침표 · 느낌표', () => {
    const src = 'And then, she smiled. Of course, Rex nodded. Just then, the door opened. Even so, she waited. Now. Mina left. Wait! Rex shouted.';
    assert.deepEqual(pick('And then, 그녀는 웃었다.', src), [[0, ['And then']]]);
    assert.deepEqual(pick('Of course, 렉스가 고개를 끄덕였다.', src), [[0, ['Of course']]], 'phrase list');
    assert.deepEqual(pick('Just then, 문이 열렸다.', src), [[0, ['Just then']]], 'a short line still counts as Korean once the leftover is set aside');
    assert.deepEqual(pick('**Even so**, 그녀는 기다렸다.', src), [[0, ['Even so']]]);
    assert.deepEqual(pick('**Now**, 미나는 창가에 서 있다.', src), [[0, ['Now']]], 'bold then comma');
    assert.deepEqual(pick('그녀는 숨을 골랐다…Now, 미나는 창가에 섰다.', src), [[0, ['Now']]], 'right after an ellipsis');
    assert.deepEqual(pick('—Now, 미나는 창가에 서 있다.', src), [[0, ['Now']]], 'right after a dash');
    assert.deepEqual(pick('Now. 미나는 떠났다.', src), [[0, ['Now']]], 'a one-word sentence');
    assert.deepEqual(pick('「Wait! 거기 서!」 렉스가 외쳤다.', src), [[0, ['Wait']]]);
    assert.deepEqual(pick('The Beatles 노래가 흘렀다.', 'The Beatles played. The song ended.'), [], 'a capitalised name after The');
    assert.deepEqual(pick('Of 미나는 웃었다.', src), [], 'not a phrase');
});
await test('6.4.3 다시 온 줄 · 머리말: 영어 말이 일부러 둔 자리 밖에 그대로면 넣지 않는다(낱말 경계) · 영어 줄이 섞이면 영어 머리말', () => {
    assert.equal(L.stillLeftover('Now, 미나는', ['Now']), true);
    assert.equal(L.stillLeftover('이제 미나는', ['Now']), false);
    assert.equal(L.stillLeftover('Nowhere 미나는', ['Now']), false, 'word boundary');
    assert.equal(L.stillLeftover('And  then, 그녀는', ['And then']), true);
    assert.equal(L.stillLeftover('그리고 그녀는', ['And then']), false);
    assert.equal(L.stillLeftover('「Now, listen.」이라고 그가 말했다. 이제 미나는 웃었다.', ['Now']), false, 'the same word inside a kept quote does not count');
    const kanaNote = 'KANA\n';
    assert.equal(L.fixNoteFor([[0, 'x', ['室長']], [1, 'y', ['Now']]], kanaNote), L.LEFTOVER_EN_NOTE);
    assert.equal(L.fixNoteFor([[0, 'x', ['Of course']]], kanaNote), L.LEFTOVER_EN_NOTE);
    assert.equal(L.fixNoteFor([[0, 'x', ['室長']]], kanaNote), L.LEFTOVER_FIX_NOTE, 'hanja only: 6.4.2 note');
    assert.match(L.LEFTOVER_EN_NOTE, /English words/);
    assert.match(L.LEFTOVER_EN_NOTE, /Japanese names in their Japanese pronunciation written in Hangul/);
});
await test('6.4.3 20줄 한도: 가나 → 한자 → 영어 차례로 채운다 · 문단 캐시 판정은 영어를 안 본다', () => {
    const src = 'Now, Mina stands.\nミナ室長';
    const text = Array.from({ length: 30 }, (_, i) => (i < 25 ? `Now, 미나는 창가에 ${i}번 섰다.` : `줄 ${i} ミナ 이야기`)).join('\n');
    const rows = L.linesToFix(text, src);
    assert.equal(rows.length, 20);
    assert.equal(rows.filter(([, line]) => /ミナ/.test(line)).length, 5, 'all kana lines kept');
    assert.deepEqual(rows.map(([i]) => i), [...rows.map(([i]) => i)].sort((a, b) => a - b), 'in line order');
    const mixed = Array.from({ length: 30 }, (_, i) => (i < 25 ? `Now, 미나는 창가에 ${i}번 섰다.` : `미나 室長 ${i}번 보고`)).join('\n');
    assert.equal(L.linesToFix(mixed, src).filter(([, line]) => /室長/.test(line)).length, 5, 'hanja lines before English lines');
    assert.deepEqual(L.linesToFix('Now, 미나는 창가에 섰다.', src, [], [], { english: false }), [], 'cache check ignores English');
    assert.deepEqual(L.linesToFix('미나 室長은 창가에 섰다.', src, [], [], { english: false }).map(([i, , r]) => [i, r]), [[0, ['室長']]], 'hanja still counts');
});
await test('6.4.3 v3 영어 서술 + 일본어 대사 원문: 그 말이 영어 위주가 아닌 원문 줄에도 있으면 일부러 쓴 영어로 본다', () => {
    const src = 'Mina nodded and said yes without a word.\n「Yes, マイロード。お任せください」';
    assert.deepEqual(pick('「Yes, 마이 로드. 맡겨 주십시오」', src), [], 'English inside a Japanese line, the same word in the narration');
    assert.deepEqual(pick('「Hey, 미나! 여기야」', 'Corvin waved, calling out hey across the hall.\n「Hey、ミナ！こっちだ」'), []);
    assert.deepEqual(pick('Now, 미나는 고개를 끄덕였다.\n「Yes, 마이 로드.」', 'Now Mina nodded.\n「Yes、マイロード」'), [[0, ['Now']]], 'a word only in the English narration is still a leftover');
});
await test('6.4.3 v3 여는 말 더 — A moment later, · Moments later, · With a sigh, · Without a word, · 줄임표 바로 뒤 한글(Now… · Now...)', () => {
    const src = 'A moment later, she smiled. Moments later, Rex left. With a sigh, she sat down. Without a word, he left. Now… she waited.';
    assert.deepEqual(pick('A moment later, 그녀는 웃었다.', src), [[0, ['A moment later']]]);
    assert.deepEqual(pick('Moments later, 렉스가 떠났다.', src), [[0, ['Moments later']]]);
    assert.deepEqual(pick('With a sigh, 그녀는 앉았다.', src), [[0, ['With a sigh']]]);
    assert.deepEqual(pick('Without a word, 그는 떠났다.', src), [[0, ['Without a word']]]);
    assert.deepEqual(pick('Now… 미나는 기다렸다.', src), [[0, ['Now']]]);
    assert.deepEqual(pick('Now...미나는 기다렸다.', src), [[0, ['Now']]]);
    assert.deepEqual(pick('A, B, C 순서로 섰다.', 'A, B, C stood in line.'), [], 'single capitals are not words');
});
await test('6.4.3 v3 가나가 있던 줄은 다시 온 줄에서 가나만 본다 (영어 말도 한자처럼)', () => {
    assert.equal(L.stillLeftover('Now, 미나는 웃었다.', ['Now'], 'Now, ミナは 웃었다.'), false);
    assert.equal(L.stillLeftover('Now, 미나는 웃었다.', ['Now'], 'Now, 미나는 웃었다.'), true, 'English-only line: the word is still there');
});
await test('6.4.3 한자 v4 지킴 자리 밖의 남은 한자는 고른다 — URL 끝(괄호 · 낫표 · 쉼표 · 마침표 뒤) · 태그 꼴이 아닌 꺾쇠', () => {
    assert.deepEqual(pick('자료는 [메모](https://ex.com/a)室長님이 보냈다.', '資料は[メモ](https://ex.com/a)室長が送った。'), [[0, ['室長']]], 'after a markdown link');
    assert.deepEqual(pick('자료는 https://ex.com/a」室長님이 보냈다고 미나가 말했다.', '資料はhttps://ex.com/a」室長が送った'), [[0, ['室長']]], 'after a corner bracket');
    assert.deepEqual(pick('자료는 https://example.com,室長님이 보냈다.', '資料は https://example.com,室長が送った。'), [[0, ['室長']]], 'comma then hanja');
    assert.deepEqual(pick('출처는 https://ex.com/a.室長님의 메모라고 미나가 말했다.', 'https://ex.com/a。室長のメモ'), [[0, ['室長']]], 'full stop then hanja');
    assert.deepEqual(pick('<System: 室長님이 입장했습니다> 미나는 고개를 들었다.', '<System: 室長が入場しました> ミナは顔を上げた。'), [[0, ['室長']]], 'a system line in angle brackets is text');
    assert.deepEqual(pick('<Chapter 3: 室長의 비밀> 미나는 문을 열었다.', '<Chapter 3: 室長の秘密> ミナは扉を開けた。'), [[0, ['室長']]]);
    assert.deepEqual(pick('점수는 x<y 였고 그 室長님은 웃으며 y>z 라고 적었다.', 'x<y 室長 y>z'), [[0, ['室長']]], 'x<y … y>z is not a tag');
    assert.deepEqual(pick('그 室長 《밤의 노래》를 미나가 읽었다.', 'その室長『夜の歌』をミナが読んだ。'), [[0, ['室長']]], 'a spaced 《title》 is not a reading');
});
await test('6.4.3 한자 v4 계속 두는 자리 — URL 경로 안 한자 · 따옴표 없는 속성 · 주석 · <rb> 루비 · 대문자 루비', () => {
    assert.deepEqual(pick('자료는 https://example.com/資料室/a.png 에 있다.', '資料は https://example.com/資料室/a.png にある。'), [], 'hanja inside the URL path');
    assert.deepEqual(pick('<https://example.com/室長> 를 열었다 하하.', '室長'), [], 'autolink');
    assert.deepEqual(pick('<span title=室長>미나</span>는 웃었다.', '<span title=室長>ミナ</span>は笑った。'), [], 'unquoted attribute');
    assert.deepEqual(pick('<!-- 室長 --> 미나는 웃었다 하하하.', '室長は笑った。'), [], 'HTML comment');
    assert.deepEqual(pick('<ruby><rb>室長</rb><rt>실장</rt></ruby>님은 웃었다.', '<ruby><rb>室長</rb><rt>しつちょう</rt></ruby>は笑った。'), [], 'ruby with rb');
    assert.deepEqual(pick('<RUBY>室長<RT>실장</RT></RUBY>님은 웃었다.', '室長は笑った。'), [], 'upper-case ruby tags');
    assert.deepEqual(pick('室長《 실장 》님은 웃었다.', '｜室長《しつちょう》は笑った。'), [], 'attached 《reading》 with spaces inside');
});
await test('6.4.3 영어 v4 한국어 줄의 맨 URL · 인라인 코드 글자는 「한글이 주된 줄」 셈에 넣지 않는다', () => {
    const src = 'The file is at https://example.com/a. Then Mina smiled.\nShe ran `npm run build`. Then Rex left.';
    assert.deepEqual(pick('자료는 https://example.com/a 에 있다. Then 미나는 웃었다.', src), [[0, ['Then']]], 'bare URL');
    assert.deepEqual(pick('`npm run build` 를 돌렸다. Then 렉스는 떠났다.', src), [[0, ['Then']]], 'inline code');
    assert.deepEqual(pick('Then, she smiled and left the room at https://example.com/a 웃음.', src), [], 'an English-dominant line still stays out');
});
await test('index.js 연결: 통째 · 문단 묶음 · 문단 캐시 모두 같은 규칙, 한 요청, 실패하면 그대로 · 이름 목록 · CI 등록', () => {
    const js = read('src/addons/translator/index.js');
    assert.match(js, /import \{ linesToFix, fixNoteFor, stillLeftover \} from '\.\/leftover-fix\.js';/);
    assert.match(js, /return marks\(body\) === marks\(out\) && !linesToFix\(out, body, glossaryHanKeep\(\), \[\], \{ english: false \}\)\.length/, '6.4.3: English leftovers that survived the fix do not block the paragraph cache');
    assert.match(js, /lines = linesToFix\(joined, bodies\.join\('\\n\\n'\), glossaryHanKeep\(\), glossaryNameKeep\(\)\);/);
    assert.match(js, /buildFullPrompt\(0, fixNoteFor\(lines, KANA_FIX_NOTE\) \+ lines\.map/);
    assert.match(js, /const kanaLines = paragraphParts \? \[\] : linesToFix\(translatedText, isInputTranslation \? '' : \(isRetranslation \? compareText : text\), glossaryHanKeep\(\), glossaryNameKeep\(\)\);/);
    assert.match(js, /const glossaryNameKeep = \(\) => \{ try \{ const c = getContext\(\);/);
    assert.match(js, /buildFullPrompt\(0, fixNoteFor\(kanaLines, KANA_FIX_NOTE\) \+ kanaLines\.map/);
    assert.match(js, /kanaLines\.forEach\(\(\[index, line, runs\], i\) => \{\s*const candidate = map\.get\(i \+ 1\);\s*if \(candidate === undefined \|\| !candidate\.trim\(\) \|\| stillLeftover\(candidate, runs, line\)\) return;/, 'v3 the line sent decides the kana-only rule');
    assert.ok(!js.includes('linesWithKana('), 'the old picker is gone (no definition, no caller)');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/translator-leftover\.mjs \./);
});

console.log(`translator-leftover: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
