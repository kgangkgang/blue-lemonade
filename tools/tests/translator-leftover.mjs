// 6.4.2 번역문에 원문 글자가 남은 줄 — src/addons/translator/leftover-fix.js (순수) + index.js 연결 코드. 문장은 모두 지어낸 것.
// 6.4.2 v2 + 다시 온 줄은 지킨 자리 밖만 · 20줄은 가나 줄부터 · 읽기 괄호 · 작은따옴표 · 한국어 원문 한자 · 머리말 · 문단 캐시 재사용.
// 6.4.2 v3 + 가나가 있던 줄은 다시 온 줄에서 가나만 본다 · 맨 URL · 인라인 코드 · 태그 안 · 루비 · 《》 읽기는 고르지 않는다.
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
const pick = (t, src, keep) => L.linesToFix(t, src, keep).map(([i, , runs]) => [i, runs]);

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
await test('index.js 연결: 통째 · 문단 묶음 · 문단 캐시 모두 같은 규칙, 한 요청, 실패하면 그대로 · CI 등록', () => {
    const js = read('src/addons/translator/index.js');
    assert.match(js, /import \{ linesToFix, fixNoteFor, stillLeftover \} from '\.\/leftover-fix\.js';/);
    assert.match(js, /return marks\(body\) === marks\(out\) && !linesToFix\(out, body, glossaryHanKeep\(\)\)\.length/);
    assert.match(js, /lines = linesToFix\(joined, bodies\.join\('\\n\\n'\), glossaryHanKeep\(\)\);/);
    assert.match(js, /buildFullPrompt\(0, fixNoteFor\(lines, KANA_FIX_NOTE\) \+ lines\.map/);
    assert.match(js, /const kanaLines = paragraphParts \? \[\] : linesToFix\(translatedText, isInputTranslation \? '' : \(isRetranslation \? compareText : text\), glossaryHanKeep\(\)\);/);
    assert.match(js, /buildFullPrompt\(0, fixNoteFor\(kanaLines, KANA_FIX_NOTE\) \+ kanaLines\.map/);
    assert.match(js, /kanaLines\.forEach\(\(\[index, line, runs\], i\) => \{\s*const candidate = map\.get\(i \+ 1\);\s*if \(candidate === undefined \|\| !candidate\.trim\(\) \|\| stillLeftover\(candidate, runs, line\)\) return;/, 'v3 the line sent decides the kana-only rule');
    assert.ok(!js.includes('linesWithKana('), 'the old picker is gone (no definition, no caller)');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/translator-leftover\.mjs \./);
});

console.log(`translator-leftover: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
