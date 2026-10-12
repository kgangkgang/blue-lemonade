// 6.2.1 번역문 태그 짝 지키기: 모델이 바꿔 쓴 자리표시자([[/__VAR_3__]]) 되돌리기, 빠진 닫는 태그 · 빠진 앞머리 여는 태그 · 남는 태그 · 꼬인 순서를
// 원문 구조대로 맞추기, 저장된 번역을 보여 줄 때 고치기. 가짜 글만 쓴다 (실제 채팅 없음).
//   node tools/tests/translation-tag-pairs.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const seg = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-segments.js')).href);
const { fixPlaceholderVariants, dropLeftoverPlaceholders, repairTagPairs } = seg;
const count = (text, name) => [(text.match(new RegExp(`<${name}\\b`, 'g')) || []).length, (text.match(new RegExp(`</${name}>`, 'g')) || []).length];
const PARA = /\n[\t ]*\n(?:[\t ]*\n)*/;
const staysInParagraph = text => [...text.matchAll(/<true_thoughts[^>]*>([\s\S]*?)<\/true_thoughts>/g)].every(m => !PARA.test(m[1]));

// 1) 자리표시자 변형
for (const variant of ['[[/__VAR_3__]]', '[[__VAR_3__/]]', '[__VAR_3__]', '[[ __VAR_3__ ]]', '[[__var_3__]]', '[[__VARIABLE_3__]]', '[[ / __VAR_3 __]]', '[[__변수_3__]]'])
    assert.equal(fixPlaceholderVariants(`a ${variant} b`), 'a [[__VAR_3__]] b', variant);
assert.equal(fixPlaceholderVariants('[[__VAR_0__]][[__VAR_12__]] [3] [VAR] __VAR__'), '[[__VAR_0__]][[__VAR_12__]] [3] [VAR] __VAR__');
assert.equal(dropLeftoverPlaceholders('끝이야.[[/__VAR_5__]]', 'end.</true_thoughts>'), '끝이야.');
assert.equal(dropLeftoverPlaceholders('[[__VAR_1__]] 그대로', 'literal [[__VAR_1__]] in source'), '[[__VAR_1__]] 그대로');
console.log('PASS placeholder variants: [[/__VAR_n__]] · single bracket · spaces · var/VARIABLE/변수 → [[__VAR_n__]], leftovers dropped only when the source has none');

// 2) 실제로 깨진 모양: 문단을 넘는 <prose> 안의 속마음 셋 — 번역에서 앞 두 개의 닫는 태그가 빠짐 (서술까지 속마음으로 칠해지던 것)
const source = [
    '<tracker>09:47 | Lobby</tracker>',
    '<prose>\nThe clock reads nine forty-seven.',
    '<true_thoughts character="Mina">Stay calm. Just an escort.</true_thoughts>',
    'Something cold touches her neck.',
    '<shout><span style="color:#424C59">"Eek!"</span></shout>',
    '<true_thoughts character="Jun">She is completely frozen.</true_thoughts>',
    '<anxious><span style="color:#424C59">"Is that okay?"</span></anxious>',
    'The doors open.',
    '<true_thoughts character="Leo">She bows so deeply.</true_thoughts>',
    'Her ears go red.\n</prose>',
].join('\n\n');
const broken = [
    '<tracker>09:47 | Lobby</tracker>',
    '<prose>\n시계는 9시 47분이다.',
    '<true_thoughts character="Mina">진정해. 그냥 안내일 뿐이야.',
    '차가운 무언가가 목덜미에 닿았다.',
    '<shout><span style="color:#424C59">"꺄악!"</span></shout>',
    '<true_thoughts character="Jun">완전히 굳었네.',
    '<anxious><span style="color:#424C59">"괜찮을까요?"</span></anxious>',
    '문이 열린다.',
    '<true_thoughts character="Leo">저렇게 깊이 숙이다니.</true_thoughts>',
    '그녀의 귀가 빨개진다.\n</prose>',
].join('\n\n');
assert.deepEqual(count(broken, 'true_thoughts'), [3, 1]);
assert.ok(!staysInParagraph(broken));
const fixed = repairTagPairs(source, broken);
assert.deepEqual(count(fixed, 'true_thoughts'), [3, 3]);
assert.ok(staysInParagraph(fixed), 'every thought closes inside its own paragraph');
for (const name of ['tracker', 'prose', 'shout', 'span', 'anxious']) assert.deepEqual(count(fixed, name), count(source, name), name);
const before = broken.split(PARA), after = fixed.split(PARA);
assert.deepEqual(after.map((p, i) => p === before[i] ? null : i).filter(i => i !== null), [2, 5]);
assert.equal(after[2], '<true_thoughts character="Mina">진정해. 그냥 안내일 뿐이야.</true_thoughts>');
assert.equal(repairTagPairs(source, fixed), fixed, 'already fixed → unchanged');
assert.equal(repairTagPairs(source, source), source);
// 번역할 때의 순서: 모델 답의 [[/__VAR_n__]] 를 되돌린 뒤 풀면 짝이 그대로 맞는다
const blocks = ['</true_thoughts>'];
const answer = fixPlaceholderVariants('<true_thoughts character="Mina">진정해.[[/__VAR_0__]]').split('[[__VAR_0__]]').join(blocks[0]);
assert.equal(answer, '<true_thoughts character="Mina">진정해.</true_thoughts>');
console.log('PASS broken thoughts: open 3 · close 3, narration stays outside, only the two broken paragraphs change, idempotent');

// 3) 빠진 앞머리 여는 태그 · 남는 닫는 태그 · 꼬인 순서
const one = (src, out) => repairTagPairs(src, out);
assert.equal(one('<excited><span style="color:#111">"Oh!"</span></excited>', '<span style="color:#111">"아!"</span></excited>'),
    '<excited><span style="color:#111">"아!"</span></excited>');
assert.equal(one('<span style="color:#111">"Oh!"</span>', '<span style="color:#111">"아!"</span></span>'), '<span style="color:#111">"아!"</span>');
assert.equal(one('<shout><span>"No"</span></shout>', '<shout><span>"싫어"</shout></span>'), '<shout><span>"싫어"</span></shout>');
assert.equal(one('<quiet><span>"Hi"</span></quiet>', '<quiet><span>"안녕"</span>'), '<quiet><span>"안녕"</span></quiet>');
assert.equal(one('<true_thoughts character="A">x</true_thoughts> She smiles.', '<true_thoughts character="A">엑스  '), '<true_thoughts character="A">엑스</true_thoughts>  ');
console.log('PASS missing leading open restored in place · stray close dropped · crossed order fixed · missing close at the paragraph end');

// 4) 문단을 넘는 태그를 번역이 일찍 닫으면 그 닫기는 뺀다 · 끝에 안 닫았으면 닫는다
const span3 = '<prose>\nA.\n\nB.\n\nC.\n</prose>';
assert.equal(one(span3, '<prose>\n가.</prose>\n\n나.\n\n다.\n</prose>'), '<prose>\n가.\n\n나.\n\n다.\n</prose>');
assert.equal(one(span3, '<prose>\n가.\n\n나.\n\n다.'), '<prose>\n가.\n\n나.\n\n다.</prose>');
console.log('PASS spanning tags: early close removed, unclosed end closed');

// 5) 문단 수가 다를 때: 원문에서 한 문단 안에서만 쓰는 태그는 열린 문단 끝에서 닫는다 (문단을 넘는 태그는 그대로)
const src5 = '<prose>\n<true_thoughts character="A">one</true_thoughts>\n\nNarration.\n\nMore.\n\n<true_thoughts character="B">two</true_thoughts>\n</prose>';
const out5 = '<prose>\n<true_thoughts character="A">하나\n\n서술. 더.\n\n<true_thoughts character="B">둘</true_thoughts>\n</prose>';
const fixed5 = one(src5, out5);
assert.deepEqual(count(fixed5, 'true_thoughts'), [2, 2]);
assert.ok(staysInParagraph(fixed5));
assert.ok(fixed5.startsWith('<prose>\n<true_thoughts character="A">하나</true_thoughts>\n\n서술. 더.'));
assert.deepEqual(count(fixed5, 'prose'), [1, 1]);
console.log('PASS paragraph count differs: paragraph-local tags close where they opened, spanning tags untouched');

// 6) 건드리지 않는 것: 맞는 번역 · 모델이 짝 맞게 더한 태그 · 빈 요소 · 원문 짝이 안 맞음 · 코드 블록 · 주석 · 태그 없는 원문
assert.equal(one('<span>"A"</span> b', '<span>"가"</span> <b>나</b>'), '<span>"가"</span> <b>나</b>');
assert.equal(one('a<br>b <img src="x"/>', 'ㄱ<br>ㄴ <img src="x"/>'), 'ㄱ<br>ㄴ <img src="x"/>');
assert.equal(one('<span>open only', '<span>열기만'), '<span>열기만');
assert.equal(one('```\n<b>\n```', '```\n<b>\n'), '```\n<b>\n');
assert.equal(one('<!-- x --><span>a</span>', '<!-- x --><span>가'), '<!-- x --><span>가');
assert.equal(one('plain text', 'plain </span> text'), 'plain </span> text');
assert.equal(one('<span class="slot" data-k="a>b">[pic]</span>', '<span class="slot" data-k="a>b">[pic]</span>'), '<span class="slot" data-k="a>b">[pic]</span>');
console.log('PASS untouched: correct translation, balanced extra tags, void elements, unbalanced source, code fences, comments, tag-free source');

// 7) 연결: 번역할 때(풀린 뒤) · 저장된 번역을 보여 줄 때(채팅을 열 때 · 그 스와이프로 돌아올 때) 고친다
const index = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
assert.ok(/let fixedText = fixPlaceholderVariants\(text\);/.test(index), 'fixMalformedPlaceholders normalizes variants first');
const unmask = index.indexOf('translatedText = translatedText.replace(placeholderRegex, () => block);'), repair = index.indexOf('repairTagPairs(tagSource, translatedText)');
assert.ok(unmask > 0 && repair > unmask, 'tags are repaired after unmasking');
assert.ok(/function repairShownTranslation\(/.test(index) && /repairShownTranslations\(\); \/\/ 6\.2\.1/.test(index), 'saved translations are repaired when a chat opens');
assert.ok(/repairShownTranslation\(Number\(messageId\), message\)/.test(index), 'a swipe that brings back its translation is repaired');
assert.ok(/shown\.includes\('llm-translator-details'\)/.test(index) && /isTranslationInProgress\(id\)/.test(index), 'folded views and messages in flight are left alone');
console.log('PASS wiring: variants before unmask, repair after unmask, repair on chat open and on swipe return');
