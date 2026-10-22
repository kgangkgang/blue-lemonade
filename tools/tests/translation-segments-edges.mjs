// 번역 문단 맞추기의 경계 (translator/translation-segments.js) — 문단 나누기 · 보호 블록 되돌리기 · 숨긴 주석 · 끊긴 답 어림 · 표 · 꼬리 메모 ·
//   작업 메모 · 초안 걷기 · 원문 되풀이 · 묶음 답 번호 · 흘려받는 문단 · 낱말 끼어듦 · 감싼 「」 · 대사 괄호 · 태그 짝. 지어낸 문장 · 이름만, 네트워크 없음.
//   node tools/tests/translation-segments-edges.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const S = await import(pathToFileURL(path.join(root, 'src/addons/translator/translation-segments.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const ko = n => '가나다라마바사아자차카타파하'.repeat(Math.ceil(n / 14)).slice(0, n);

await test('segmentParagraphs: 문단을 넘어 열린 채인 꾸밈 태그면 나누지 않는다', () => {
    assert.equal(S.segmentParagraphs('<b>미나가 웃었다\n\n렉스도 웃었다'), null, '닫히지 않은 <b>');
    assert.deepEqual(S.segmentParagraphs('<b>가</b>\n\n<i>나</i><br/>'), ['<b>가</b>', '\n\n', '<i>나</i><br/>']);
});

await test('forgetSegments: 구분자는 건너뛰고 문단마다 열쇠 하나', async () => {
    assert.equal(await S.forgetSegments(['하나', '\n\n', '둘', '\n\n', '셋'], () => 'sig'), 3);
    assert.equal(await S.forgetSegments(['[[__VAR_0__]]', '\n\n', '  '], () => 'sig'), 0);
});

await test('restoreDroppedPlaceholders: 문단 안에서 빠진 자리표시자를 앞 · 뒤 자리와 줄바꿈 그대로', () => {
    const masked = '미나가 문을 열었다.\n[[__VAR_1__]]\n\n[[__VAR_2__]] 렉스가 고개를 들었다.';
    const out = 'Mina opened the door.\n\nRex looked up.';
    assert.equal(S.restoreDroppedPlaceholders(masked, out, ['[[__VAR_1__]]', '[[__VAR_2__]]']), 'Mina opened the door.\n[[__VAR_1__]]\n\n[[__VAR_2__]] Rex looked up.');
    const two = '[[__VAR_3__]] [[__VAR_4__]] 가나다';
    assert.equal(S.restoreDroppedPlaceholders(two, 'abc', ['[[__VAR_4__]]', '[[__VAR_3__]]']), '[[__VAR_3__]] [[__VAR_4__]] abc', '같은 문단의 둘은 원문 차례대로');
    const tail = '가나다 [[__VAR_5__]] [[__VAR_6__]]';
    assert.equal(S.restoreDroppedPlaceholders(tail, 'abc', ['[[__VAR_6__]]', '[[__VAR_5__]]']), 'abc [[__VAR_5__]] [[__VAR_6__]]');
});

await test('openCommentAt · brokenComments: 빈 주석 <!----> 은 닫힌 것', () => {
    assert.equal(S.openCommentAt('<!---->'), -1);
    assert.equal(S.openCommentAt('가 <!-- 나'), 2);
    assert.equal(S.brokenComments('<!---->가', '<!---->나'), false);
});

await test('looksCutShort: 무게 · 열린 끝 · 문단 수의 경계', () => {
    // 무게 비율이 딱 0.8 이면 다 온 답
    assert.equal(S.looksCutShort(ko(50), '「' + ko(40)), false);
    assert.equal(S.looksCutShort(ko(50), '「' + ko(39)), true, '0.8 아래 + 꺾쇠 열린 끝');
    // 끝 문단의 꾸밈 태그가 닫혔으면 열린 끝이 아니다 (단 120 아래라 문단 수는 안 본다)
    assert.equal(S.looksCutShort(ko(60) + '.', '<b>' + ko(10) + '</b> ' + ko(30)), false);
    assert.equal(S.looksCutShort(ko(60) + '.', '「' + ko(10) + '」 ' + ko(30)), false, '꺾쇠가 짝이 맞으면 열린 끝이 아니다');
    // 원문 무게 120 부터 비율 · 문단 수를 본다
    assert.equal(S.looksCutShort(ko(120), ko(50) + '.'), true, '0.5 아래');
    assert.equal(S.looksCutShort(ko(119), ko(50) + '.'), false);
    const en = 'Mina folded the letter twice and slid it under the door before anyone woke up.';   // 로마자 63자 = 무게 25.2
    assert.equal(S.looksCutShort(en.repeat(2), '미나는 아무도 깨기 전에 편지를 두 번 접어 문 밑으로 밀어 넣었다. '.repeat(2).trim()), false, '영어 원문의 로마자는 0.4 로 센다');
    assert.equal(S.looksCutShort(ko(30), '「' + ko(10)), true, '무게 30 부터');
    assert.equal(S.looksCutShort(ko(29), '「' + ko(10)), false);
    assert.equal(S.looksCutShort(ko(40) + '.', '<b>' + ko(20)), true, '꾸밈 태그가 열린 채 글자로 끝남');
    const four = [ko(40), ko(40), ko(40), ko(40)].join('\n\n');
    assert.equal(S.looksCutShort(four, ko(48) + '.\n\n' + ko(48) + '.'), true, '문단 수가 원문의 절반');
    assert.equal(S.looksCutShort(four, ko(32) + '.\n\n' + ko(32) + '.\n\n' + ko(32) + '.'), false);
});

await test('structureLines: 글 끝까지 이어지는 표 · 한 칸 표', () => {
    assert.deepEqual([...S.structureLines(['| 이름 | 나이 |', '| --- | --- |', '| 미나 | 17 |'])], [0, 1, 2]);
    assert.deepEqual([...S.structureLines(['머리', '| 칸 |', '| --- |', '| 하나 |', '끝'])], [1, 2, 3]);
    assert.deepEqual([...S.structureLines(['```', '---', '```', '***'])], [3], '코드 블록 안은 보지 않는다');
});

await test('batchGroups: 한도에 딱 맞으면 같은 묶음', () => {
    assert.deepEqual(S.batchGroups(['aa', 'bb', 'cc', 'dd'], 4), [['aa', 'bb'], ['cc', 'dd']]);
    assert.deepEqual(S.batchGroups([], 4), []);
});

await test('stripTrailingNote: 구분선 · 빈 덩이 · 원문 없는 ※ 줄 · 원문 상태창 짝', () => {
    assert.equal(S.stripTrailingNote('미나가 웃었다.\n\n---\nNote: 존댓말로 옮겼어요.'), '미나가 웃었다.');
    assert.equal(S.stripTrailingNote('가\n\n나\n\n'), '가\n\n나', '끝 빈 덩이만 있으면 걷고 멈춘다');
    assert.equal(S.stripTrailingNote('미나가 웃었다.\n\n※ 호감도 +5'), '미나가 웃었다.\n\n※ 호감도 +5', '원문 없이 ※ 줄은 번역 이야기일 때만');
    assert.equal(S.stripTrailingNote('미나가 웃었다.\n\n※ 번역: 존댓말 유지'), '미나가 웃었다.');
    const src = 'Mina smiled.\n\n※ Affection +5';
    assert.equal(S.stripTrailingNote('미나가 웃었다.\n\n※ 호감도 +5\n\nTranslator\'s note: 호감도는 그대로 두었어요.', src), '미나가 웃었다.\n\n※ 호감도 +5', '원문 상태창 뒤의 분명한 메모만');
    assert.equal(S.stripTrailingNote('미나가 웃었다.\n\n※ 호감도 +5', src), '미나가 웃었다.\n\n※ 호감도 +5');
    assert.equal(S.stripTrailingNote('미나가 웃었다.\n---\nNote: 이름은 음역했어요.'), '미나가 웃었다.', '빈 줄 없이 붙은 구분선 밑 메모');
    assert.equal(S.stripTrailingNote('가\n\n미나가 웃었다.\n---\nNote: 이름은 음역했어요.'), '가\n\n미나가 웃었다.');
});

await test('stripPlanningNotes: 화살표 + 말투 이름만으로는 메모가 아니다', () => {
    const line = 'Rex calls her Mina now → 반말';
    assert.equal(S.stripPlanningNotes(`렉스가 웃었다.\n${line}`), `렉스가 웃었다.\n${line}`);
    assert.equal(S.stripPlanningNotes('렉스가 웃었다.\nRex speaks casually → I\'ll use 반말'), '렉스가 웃었다.');
});

await test('stripPlanningNotes: 서식 메모 줄 길이 120 · 꼬리 메모', () => {
    const src = 'Mina whispered. "Stay here."';
    const short = 'keep the placeholder ' + '-'.repeat(99);   // 120자 (라틴 글자가 적어 번역문은 한국어로 세어진다)
    assert.equal(short.length, 120);
    assert.equal(S.stripPlanningNotes(`미나가 속삭였다. 「여기 있어.」\n${short}`, src), '미나가 속삭였다. 「여기 있어.」');
    assert.equal(S.stripPlanningNotes(`미나가 속삭였다. 「여기 있어.」\n${short}x`, src), `미나가 속삭였다. 「여기 있어.」\n${short}x`, '121자는 줄째 걷지 않는다');
    assert.equal(S.stripPlanningNotes('미나가 속삭였다. 「여기 있어.」 placeholder 유지.', src), '미나가 속삭였다. 「여기 있어.」');
    assert.equal(S.stripPlanningNotes('미나가 속삭였다. 「여기 있어.」 placeholder 유지.', 'Mina whispered. "Stay here." placeholder 유지.'), '미나가 속삭였다. 「여기 있어.」 placeholder 유지.', '원문에 같은 꼬리가 있으면 둔다');
    assert.equal(S.stripPlanningNotes('Stay here. placeholder 유지.', src), 'Stay here. placeholder 유지.', '꼬리 앞이 라틴이면 둔다');
});

await test('stripPlanningNotes: 반쪽 원문 + translate 꼬리 (원문 머리 8자 이상일 때만)', () => {
    const src = 'The archive smelled of dust and old paper. Mina sneezed twice.';
    assert.equal(S.stripPlanningNotes('서고에서는 먼지와 낡은 종이 냄새가 났다.\nThe archive smelled of dust... translate.\n미나는 두 번 재채기했다.', src), '서고에서는 먼지와 낡은 종이 냄새가 났다.\n미나는 두 번 재채기했다.');
    assert.equal(S.stripPlanningNotes('서고에서는 먼지와 낡은 종이 냄새가 났다.\nThe ark... translate.', 'The ark sank. ' + src), '서고에서는 먼지와 낡은 종이 냄새가 났다.\nThe ark... translate.', '머리가 짧으면(8자 아래) 둔다');
});

await test('stripDraftLeaks: 바꿀 게 없으면 받은 글 그대로 (빈 줄 · 끝 줄바꿈 포함)', () => {
    const src = 'Mina nodded.\n\nRex left.';
    assert.equal(S.stripDraftLeaks('미나가 끄덕였다.\n\n\n렉스가 떠났다.', src), '미나가 끄덕였다.\n\n\n렉스가 떠났다.');
    assert.equal(S.stripDraftLeaks('미나가 끄덕였다.\n\n렉스가 떠났다.\n\n', src), '미나가 끄덕였다.\n\n렉스가 떠났다.\n\n');
});

await test('stripDraftLeaks: 낯선 태그는 안이 라틴 글자 위주일 때만 걷는다', () => {
    const src = '彼女は窓を開けた。';
    const mostlyKo = '<memo>Rex는 창문 밖을 내다보며 아주 오랫동안 아무 말도 하지 않았다 ok</memo>';
    assert.equal(S.stripDraftLeaks(`${mostlyKo}\n그녀가 창문을 열었다.`, src), `${mostlyKo}\n그녀가 창문을 열었다.`);
    assert.equal(S.stripDraftLeaks('<memo>Rex speaks casually, so I keep it short</memo>\n그녀가 창문을 열었다.', src), '그녀가 창문을 열었다.');
});

await test('stripDraftLeaks: 초안 줄은 다음 문단과 닮았을 때만 · 줄 끝에 있을 때만 걷는다', () => {
    const src = '彼女は窓を開けた。風が入ってきた。';
    const draft = '그녀가 창문을 열었더니 바람이 — let me rewrite.';
    assert.equal(S.stripDraftLeaks(`${draft}\n\n<output>\n그녀가 창문을 열었다. 바람이 들어왔다.\n</output>`, src), '그녀가 창문을 열었다. 바람이 들어왔다.');
    assert.equal(S.stripDraftLeaks(`${draft}\n\n<output>\n렉스는 아무 대답도 하지 않았다.\n</output>`, src), '그녀가 창문을 열었더니 바람이\n\n렉스는 아무 대답도 하지 않았다.', '감싼 문단이 닮지 않으면 초안(꼬리만 걷은 줄)은 남는다');
    assert.equal(S.stripDraftLeaks(`${draft}\n마지막 줄.\n\n<output>\n그녀가 창문을 열었다. 바람이 들어왔다.\n</output>`, src), '그녀가 창문을 열었더니 바람이\n마지막 줄.\n\n그녀가 창문을 열었다. 바람이 들어왔다.', '초안이 덩이의 끝 줄이 아니면 둔다');
    assert.equal(S.stripDraftLeaks(`${draft}\n\n\`\`\`\n그녀가 창문을 열었다, 바람이 들어왔다고.\n\`\`\``, src), '그녀가 창문을 열었다, 바람이 들어왔다고.', '코드 펜스로 감싼 문단도 감싼 것');
});

await test('removeSourceEcho: 첫 덩이 · 끝 덩이 · 가장 긴 원문 문단의 되풀이', () => {
    const src = 'Mina opened the window slowly.';
    assert.equal(S.removeSourceEcho(src, 'Mina opened the window slowly. → 미나가 천천히 창문을 열었다.'), '미나가 천천히 창문을 열었다.');
    assert.equal(S.removeSourceEcho(src, 'Mina opened the window slowly.\n\n→\n\n미나가 천천히 창문을 열었다.'), '미나가 천천히 창문을 열었다.');
    assert.equal(S.removeSourceEcho(`Rex sat down.\n\n${src}`, `렉스가 앉았다.\n\n${src}\n\n→`), '렉스가 앉았다.');
    assert.equal(S.removeSourceEcho(src, '미나가 천천히 창문을 열었다.\n\n'), '미나가 천천히 창문을 열었다.\n\n', '걷을 게 없으면 받은 글 그대로');
    const twenty = 'Rex sat by the fire.';   // 글자 · 숫자 16자
    const longer = 'Rex quietly sat by the old fire.';   // 26자
    assert.equal(S.removeSourceEcho(longer, `${longer}\n\n렉스가 낡은 난롯가에 조용히 앉았다.`), '렉스가 낡은 난롯가에 조용히 앉았다.', '20자 넘는 원문 덩이 + 다른 글자 번역');
    assert.equal(S.removeSourceEcho(twenty, `${twenty}\n\n렉스가 난롯가에 앉았다.`), `${twenty}\n\n렉스가 난롯가에 앉았다.`, '20자 아래면 그대로');
});

await test('removeSourceEcho: 원문 덩이 정확히 20자에서 걷는다', () => {
    const src = 'Mina found a silver key.';   // minafoundasilverkey = 19
    const src20 = 'Mina found a silver keys.';   // 20
    assert.equal(S.removeSourceEcho(src20, `${src20}\n\n미나는 은 열쇠들을 찾았다.`), '미나는 은 열쇠들을 찾았다.');
    assert.equal(S.removeSourceEcho(src, `${src}\n\n미나는 은 열쇠를 찾았다.`), `${src}\n\n미나는 은 열쇠를 찾았다.`);
});

await test('hasSourceEcho: 한 덩이에 원문을 길게 베껴 품은 번역', () => {
    const src = 'Mina walked through the quiet library and picked up an old map.';
    assert.equal(S.hasSourceEcho(src, `${src} 미나는 조용한 도서관을 걸어가 낡은 지도를 집어 들었다.`), true);
    assert.equal(S.hasSourceEcho(src, '미나는 조용한 도서관을 걸어가 낡은 지도를 집어 들었다.'), false);
    assert.equal(S.hasSourceEcho('짧은 원문', '짧은 원문 번역'), false);
});

await test('parseBatchResult: ⟦ 답 안의 [n] 줄 · 1부터 매긴 답 표시', () => {
    assert.deepEqual(S.parseBatchResult('⟦0⟧ 가\n[1] 나', 2), ['가', '나']);
    assert.deepEqual(S.parseBatchResult('⟦1⟧ 나\n⟦0⟧ 가\n[1] 다', 2), ['가\n[1] 다', '나'], '이미 받은 번호면 [n] 은 본문');
    const meta = {};
    assert.deepEqual(S.parseBatchResult('⟦1⟧ 가\n⟦2⟧ 나', 2, meta), ['가', '나']);
    assert.equal(meta.renumbered, true);
    const meta0 = {};
    S.parseBatchResult('⟦0⟧ 가\n⟦1⟧ 나', 2, meta0);
    assert.equal(meta0.renumbered, undefined);
});

await test('streamedPassages: 첫 ⟦ 앞의 [n] 은 표시가 아니고, ⟦ 다음 번호 [n] 은 표시', () => {
    assert.deepEqual(S.streamedPassages('[1] 머리말\n⟦0⟧ 가\n⟦1⟧ 나\n⟦2⟧', 3), ['가', '나']);
    assert.deepEqual(S.streamedPassages('⟦0⟧ 가\n[1] 나\n⟦2⟧ 다\n⟦3⟧', 4), ['가', '나', '다']);
    assert.deepEqual(S.streamedPassages('⟦0⟧ 가\n[1] 나\n⟦1⟧ 다\n⟦2', 3, ['a', '[1] b', 'c']), ['가\n[1] 나', '다'], '원문에 [1] 줄이 있으면 본문');
});

await test('streamWatch: 걷어 내고 빈 문단(null)은 shape 를 거치지 않는다', async () => {
    const seen = [];
    const frames = [];
    const w = S.streamWatch({ done: (view, count, safe) => seen.push([view, count, safe]), settled: () => [], shape: t => `<${t}>`, frame: fn => { frames.push(fn); return frames.length; }, cancel: () => {} });
    const feed = w.follow(['a', 'b', 'c'], 0);
    feed('⟦0⟧ 가\n⟦1⟧ ​\n⟦2⟧ 다\n⟦3');
    feed('⟦0⟧ 가\n⟦1⟧ ​\n⟦2⟧ 다\n⟦3⟧ ');
    frames.splice(0).forEach(fn => fn());
    const [view, count] = seen.at(-1);
    assert.equal(view[0], '<가>');
    assert.equal(count, 3);
});

await test('dropStrayWords: 들여 쓴 낱말 줄도 원문에 있으면 남긴다', () => {
    const src = 'They reached Lindenfeld at dawn.';
    assert.equal(S.dropStrayWords('새벽에 도착했다.\n  Lindenfeld\n성문이 열려 있었다.', src), '새벽에 도착했다.\n  Lindenfeld\n성문이 열려 있었다.');
    assert.equal(S.dropStrayWords('새벽에 도착했다.\n\tQuixote\n성문이 열려 있었다.', src), '새벽에 도착했다.\n성문이 열려 있었다.');
});

await test('dropWrapQuotes: 줄 끝 [각주] · 정보 문자열 있는 코드 펜스 · <pre> 안', () => {
    assert.equal(S.dropWrapQuotes('「그는 웃었다」 [1]', '彼は笑った [1]'), '「그는 웃었다」 [1]');
    assert.equal(S.dropWrapQuotes('```js\nlet a = 1;\n```\n「그는 웃었다」', '```js\nlet a = 1;\n```\n彼は笑った'), '```js\nlet a = 1;\n```\n그는 웃었다');
    assert.equal(S.dropWrapQuotes('  ```\nx\n  ```\n「그는 웃었다」', '  ```\nx\n  ```\n彼は笑った'), '  ```\nx\n  ```\n그는 웃었다', '들여 쓴 닫는 펜스');
    const pre = '<pre>\n<code>x</code>\n「그는 웃었다」\n</pre>';
    assert.equal(S.dropWrapQuotes(pre, '<pre>\n<code>x</code>\n彼は笑った\n</pre>'), pre, '<pre> 안은 글 그대로');
    assert.equal(S.dropWrapQuotes('「 」', 'abc'), '「 」', '속이 비면 그대로');
    assert.equal(S.dropWrapQuotes('「가」', 'abc'), '가');
});

await test('restoreDialogueBrackets: 고칠 게 없으면 받은 글 그대로 (CRLF 포함)', () => {
    assert.equal(S.restoreDialogueBrackets('「가나」\r\n다', '「나가」\r\n라'), '「나가」\r\n라');
    const src = '<span style="color:#a7c">「Wait.」</span>\n\nRex ran.';
    assert.equal(S.restoreDialogueBrackets(src, '<span style="color:#a7c">「기다려.」</span>\r\n렉스가 달렸다.\r\n\r\n끝.'), '<span style="color:#a7c">「기다려.」</span>\r\n렉스가 달렸다.\r\n\r\n끝.');
    assert.equal(S.restoreDialogueBrackets(src, '<span style="color:#a7c">기다려.</span>\n렉스가 달렸다.\n\n끝.'), '<span style="color:#a7c">「기다려.」</span>\n렉스가 달렸다.\n\n끝.', '문단이 어긋나도 색 span 끼리');
    assert.equal(S.restoreDialogueBrackets('「」\n\nx', '가\n\ny'), '가\n\ny', '빈 괄호는 감싼 것이 아니다');
});

await test('repairTagPairs: <x/> 는 짝을 세지 않고, 남은 태그는 마지막 문단 끝에서 닫는다', () => {
    assert.equal(S.repairTagPairs('<b>가</b>', '<b>나<icon/></b>'), '<b>나<icon/></b>');
    assert.equal(S.repairTagPairs('<prose>a\n\nb</prose>', '<prose>가\n\n나\n\n다'), '<prose>가\n\n나\n\n다</prose>');
    assert.equal(S.repairTagPairs('<b><i>a</i></b> c', '<b><i>가</b> 다</i>'), '<b><i>가</i></b> 다');
});

await test('pruneKeys: 개수 · 글자 수 한도에 딱 맞으면 남긴다', () => {
    const now = 1e12, row = (key, ago, text = 'ab') => ({ key, time: now - ago, text });
    const rows = [row('a', 3), row('b', 1), row('c', 2)];
    assert.deepEqual(S.pruneKeys(rows, now, { limit: 2 }), ['a'], '오래된 것부터 뺀다');
    assert.deepEqual(S.pruneKeys(rows, now, { limit: 3, chars: 6 }), []);
    assert.deepEqual(S.pruneKeys(rows, now, { limit: 3, chars: 5 }), ['a']);
    assert.deepEqual(S.pruneKeys([row('resume:x', 2 * 86400000), row('y', 2 * 86400000)], now), ['resume:x'], '이어 하기 줄은 하루');
});

await test('localizePlaceholders · restorePlaceholders: 문단 안 차례로 매기고 되돌린다', () => {
    const { norm, map } = S.localizePlaceholders('[[__VAR_5__]] 미나 [[__VAR_2__]] [[__VAR_5__]]');
    assert.equal(norm, '[[__VAR_0__]] 미나 [[__VAR_1__]] [[__VAR_0__]]');
    assert.deepEqual(map, [5, 2]);
    assert.equal(S.restorePlaceholders('[[__VAR_1__]] 가 [[__VAR_0__]] [[__VAR_9__]]', map), '[[__VAR_2__]] 가 [[__VAR_5__]] [[__VAR_9__]]', '모르는 번호는 그대로');
});

await test('segmentParagraphs: 둘째 문단의 열린 태그도 본다', () => {
    assert.equal(S.segmentParagraphs('가\n\n<b>나\n\n다'), null);
});

await test('cleanParagraphEcho: 원문 + 화살표뿐이면 null', () => {
    assert.equal(S.cleanParagraphEcho('Mina opened the window slowly. →', 'Mina opened the window slowly.'), null);
    assert.equal(S.cleanParagraphEcho('미나가 창문을 천천히 열었다.\n', 'Mina opened the window slowly.'), '미나가 창문을 천천히 열었다.');
});

await test('echoesSource · hasSourceEcho: 베낀 비율 60% · 문장 12자 · 문단 40자 경계', () => {
    const src = 'Mina found a small brass keys. Rex grinned at hers.';   // 글자 24 + 16 = 40
    const answer = 'Mina found a small brass keys. 렉스가 그녀를 보며 씩 웃고 열쇠를 받았다.';
    assert.equal(S.echoesSource(answer, src), true, '24/40 = 60%');
    assert.equal(S.hasSourceEcho(src, answer), true, '문단 40자');
    const four = 'Rex walked off. Mina sat alone. Aria sang loud. Hero stood up.';   // 12 · 12 · 12 · 11
    assert.equal(S.echoesSource('Rex walked off. Mina sat alone. Aria sang loud. 히어로가 자리에서 천천히 일어섰다.', four), true);
    assert.equal(S.echoesSource('렉스가 떠났다. 미나는 혼자 앉았다. 아리아는 크게 노래했다. 히어로가 일어섰다.', four), false);
});

await test('removeSourceEcho: 화살표로 끝나는 원문 문단 · 20자 아래 머리 · 문단 수가 같으면 남긴다', () => {
    const arrowSrc = 'Check the report results now -->';
    assert.equal(S.removeSourceEcho(arrowSrc, arrowSrc), arrowSrc, '원문이 원래 화살표로 끝나면 번역하지 않고 둔 문단');
    const short = 'Mina sat alone here.';   // 16자
    assert.equal(S.removeSourceEcho(short, `${short}\n미나는 여기 혼자 앉아 있었다.`), `${short}\n미나는 여기 혼자 앉아 있었다.`);
    const long = 'Mina sat alone by the quiet window.';
    assert.equal(S.removeSourceEcho(`${long}\n\nRex left.`, `${long}\n\n렉스가 떠났다.`), `${long}\n\n렉스가 떠났다.`, '덩이 수가 원문과 같으면 번역하지 않은 문단일 수 있다');
});

await test('streamedPassages: 번호가 건너뛰면 멈추고, 원문 되풀이는 걷는다', () => {
    assert.deepEqual(S.streamedPassages('⟦0⟧ 가\n⟦2⟧ 나\n⟦3⟧', 4), []);
    assert.deepEqual(S.streamedPassages('⟦0⟧ Mina opened the window slowly. → 미나가 천천히 창문을 열었다.\n⟦1', 2, ['Mina opened the window slowly.', 'b']), ['미나가 천천히 창문을 열었다.']);
});

await test('streamWatch: keep · 한 프레임에 한 번 · 새 문단이 없으면 알리지 않는다', () => {
    const calls = [], frames = [];
    const w = S.streamWatch({ done: (view, count, safe) => calls.push({ view: [...view], count, safe }), settled: () => [], frame: fn => { frames.push(fn); return frames.length; }, cancel: () => {} });
    w.keep(0, ['가', '나']);
    w.keep(2, ['다']);
    assert.equal(frames.length, 1, '기다리는 프레임이 있으면 더 걸지 않는다');
    frames.splice(0).forEach(fn => fn());
    assert.deepEqual(calls, [{ view: ['가', '나', '다'], count: 3, safe: 3 }]);
    const feed = w.follow(['a', 'b'], 3);
    feed('⟦0⟧ 라 ⟦9⟧');
    assert.equal(frames.length, 0, '닫힌 문단이 없으면 알리지 않는다');
    w.close();
    w.keep(5, ['마']);
    assert.equal(frames.length, 0);
});

await test('stripDraftLeaks: 초안을 걷는 닮음 기준 (감싸지 않음 0.5 · 감쌈 0.3)', () => {
    const src = '彼女は窓を開けた。風が入ってきた。';
    const draft = '그녀가 창문을 열었더니 바람이 — let me rewrite.';
    assert.equal(S.stripDraftLeaks(`${draft}\n\n그녀가 웃었다. 바람이 불었다.`, src), '그녀가 창문을 열었더니 바람이\n\n그녀가 웃었다. 바람이 불었다.', '0.33 · 감싸지 않음');
    assert.equal(S.stripDraftLeaks(`${draft}\n\n<output>\n\n그녀가 웃었다. 바람이 불었다.\n\n</output>`, src), '그녀가 웃었다. 바람이 불었다.', '0.33 · 태그만 있는 덩이 다음 문단도 감싼 것');
    assert.equal(S.stripDraftLeaks(`${draft}\n\n<output>\n\n그녀가 웃자 창문이 흔들렸다.\n\n</output>`, src), '그녀가 창문을 열었더니 바람이\n\n그녀가 웃자 창문이 흔들렸다.', '0.25 · 감쌌어도 둔다');
    assert.equal(S.stripDraftLeaks(`${draft}\n\n미나가 창문을 열었다.`, src), '그녀가 창문을 열었더니 바람이\n\n미나가 창문을 열었다.', '0.42 · 감싸지 않음');
    assert.equal(S.stripDraftLeaks(`첫 줄이다.\n${draft}\n\n<output>\n그녀가 창문을 열었다. 바람이 들어왔다.\n</output>`, src), '첫 줄이다.\n\n그녀가 창문을 열었다. 바람이 들어왔다.', '덩이 끝 줄의 초안만');
    assert.equal(S.stripDraftLeaks('그녀가 창문을 열었다 바람이 들어왔다\n\n<output>\n그녀가 창문을 열었다. 바람이 들어왔다.\n</output>', src), '그녀가 창문을 열었다. 바람이 들어왔다.', '꼬리 없는 초안 덩이는 덩이가 원문 문단보다 많을 때');
    assert.equal(S.stripDraftLeaks('그녀가 창문을 열었다 바람이 들어왔다\n\n<output>\n그녀가 창문을 열었다. 바람이 들어왔다.\n</output>', `${src}\n\n二つ目。`), '그녀가 창문을 열었다 바람이 들어왔다\n\n그녀가 창문을 열었다. 바람이 들어왔다.');
});

await test('restoreDroppedPlaceholders: 문단 수가 달라 끝에 붙일 때도 원문 차례', () => {
    assert.equal(S.restoreDroppedPlaceholders('가\n\n[[__VAR_0__]]\n\n나 [[__VAR_1__]]', '하나로 합친 번역', ['[[__VAR_1__]]', '[[__VAR_0__]]']), '하나로 합친 번역\n\n[[__VAR_0__]]\n\n[[__VAR_1__]]');
});

await test('splitCrossLineEmphasis: 태그 줄을 사이에 둔 * 는 잇지 않는다', () => {
    assert.equal(S.splitCrossLineEmphasis('*미나가 걷는다\n<b>잠깐</b>\n천천히.*'), '*미나가 걷는다\n<b>잠깐</b>\n천천히.*');
    assert.equal(S.splitCrossLineEmphasis('*미나가 걷는다\n천천히.*'), '*미나가 걷는다*\n*천천히.*');
});

await test('stripTrailingNote: 원문 끝이 상태창일 때는 분명한 메모가 문단 수보다 넘칠 때만 · 구분선 밑 약한 메모는 둔다', () => {
    const src = 'Mina smiled.\n\n※ Affection +5';
    assert.equal(S.stripTrailingNote('미나가 웃었다.\n\nTranslator\'s note: 호감도 줄을 옮겼어요.', src), '미나가 웃었다.\n\nTranslator\'s note: 호감도 줄을 옮겼어요.');
    assert.equal(S.stripTrailingNote('미나가 웃었다.\n\n※ 호감도 +5\n---\nNote: 숫자는 그대로', src), '미나가 웃었다.\n\n※ 호감도 +5\n---\nNote: 숫자는 그대로');
});

await test('stripPlanningNotes: 한국어 말투 메모 (낱말 두 가지) · 받은 글 앞 줄바꿈은 그대로', () => {
    const src = 'Rex grinned. "Fine by me."';
    assert.equal(S.stripPlanningNotes('렉스가 씩 웃었다. 「난 좋아.」\n렉스 말투 → 반말, 속마음은 해요체', src), '렉스가 씩 웃었다. 「난 좋아.」');
    assert.equal(S.stripPlanningNotes('\n미나는 keep 이라고 적었다.'), '\n미나는 keep 이라고 적었다.');
});

await test('stripPlanningNotes: 반쪽 원문 줄은 머리가 원문에 그대로 있을 때만', () => {
    const src = 'The archive smelled of dust and old paper.';
    assert.equal(S.stripPlanningNotes('서고에서는 먼지 냄새가 났다.\nThe archive smelled of dust... translate.', src), '서고에서는 먼지 냄새가 났다.');
    assert.equal(S.stripPlanningNotes('서고에서는 먼지 냄새가 났다.\nThe archive smelled of smoke... translate.', src), '서고에서는 먼지 냄새가 났다.\nThe archive smelled of smoke... translate.');
});

await test('stripDraftLeaks: 낯선 태그 안 로마자가 12자 아래면 둔다 · 역주 칸은 건드리지 않는다', () => {
    const src = '彼女は窓を開けた。';
    assert.equal(S.stripDraftLeaks('<memo>Rex nods. 응</memo>\n그녀가 창문을 열었다.', src), '<memo>Rex nods. 응</memo>\n그녀가 창문을 열었다.');
    const noted = '미나는 오리온자리[1]를 가리켰다.\n\n역주:\n[1]: 사냥꾼 별자리 — let me add: the hunter from Greek myth.';
    assert.equal(S.stripDraftLeaks(noted, '彼女はオリオン座を指さした。'), noted);
});

await test('dropWrapQuotes: 따옴표 모양만 바꾼 대사 · 빈 줄 수가 다른 글', () => {
    assert.equal(S.dropWrapQuotes('「그가 “좋아”라고 말했다」', 'He said "fine" quietly'), '그가 “좋아”라고 말했다', '원문 "…" 한 쌍 = 번역문 “…” 한 쌍, 바깥 「」 만 더 많다');
    assert.equal(S.dropWrapQuotes('「그가 “좋아”라고 말했다」', 'He said fine quietly'), '「그가 “좋아”라고 말했다」', '따옴표 짝이 원문보다 둘 많으면 둔다');
    assert.equal(S.dropWrapQuotes('미나가 웃었다.\n\n「그는 고개를 끄덕였다」', 'Mina smiled.\n\n\nHe nodded.'), '미나가 웃었다.\n\n그는 고개를 끄덕였다', '빈 줄은 세지 않는다');
});

await test('restoreDialogueBrackets: 색 span 의 빈 괄호는 감싼 대사가 아니다', () => {
    const src = '<span style="color:#a7c">「」</span> a\n\nb';
    assert.equal(S.restoreDialogueBrackets(src, '<span style="color:#a7c">빈 칸</span> 가'), '<span style="color:#a7c">빈 칸</span> 가');
});

await test('repairTagPairs: 문단 수가 다르면 문단 안에서만 쓰던 태그는 연 문단 끝에서 닫는다', () => {
    assert.equal(S.repairTagPairs('<i>a</i>\n\nb', '<i>가\n\n나\n\n다'), '<i>가</i>\n\n나\n\n다');
    assert.equal(S.repairTagPairs('<prose><i>a</i>\n\nb</prose>', '<prose><i>가\n\n나\n\n다</prose>'), '<prose><i>가</i>\n\n나\n\n다</prose>', '문단을 넘는 바깥 태그는 두고 안쪽만');
});

console.log(`translation-segments-edges: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
