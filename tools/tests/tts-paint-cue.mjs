// 2.0.1(사용자 제보 11-21 「저 대사는 왜 그 인물 색 아님 · 저건 누구 색이냐 첨 보는디」) — 서술 속 인용(『…』 · "…")의 색
//   ① 인용 앞(바로 앞 두 문장) · 뒤(같은 문장)에 「X에게서 온」 · 「X의 메시지」 · 「X가 보낸」 · 「X: 」 · from X · Xからの 같은 보낸 쪽 꼴이 붙으면
//      그 인물로(paraName · paraHead → 화면 화자 색 source 'header' 로 칠함) · 여럿이면 인용에 가장 가까운 보낸 쪽 하나 · 「X에게 보낸」 · to X(받는 쪽)는 아님
//   ② 못 가리면 예전처럼 기본 대사 색 + 표시 q.bl-q-nobody(색 없는 옅은 점선 밑줄) — 서술 줄 가운데 인용만
//   지어낸 이름 · 글만. node tools/tests/tts-paint-cue.mjs <테마 루트>
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('tts-paint-cue');

const X = await load('src/addons/tts/src/text.js');
const core = await load('src/addons/tts/src/paint-core.js');
const NAMES = ['미나', '하람', '렉스', 'Orin', 'Tavi', 'ミナ'];
const dial = s => X.segmentMessage(s, { knownNames: NAMES, userName: '나', charName: '렉스', paragraphs: true }).filter(g => g.kind === 'dialogue').map(g => [g.text.slice(0, 8), g.paraName || '', !!g.paraHead]);

await test('보낸 쪽 꼴 — 한국어 · 영어 · 일본어 · 괄호 덧말', () => {
    assert.deepEqual(dial('화면 맨 위에 뜬 것은 미나 (기획부)에게서 온 조용한 배지였고, 미리보기 줄에는 이렇게 적혀 있었다. 『아까 고마워~! 목요일에 봐✨』'), [['아까 고마워~!', '미나', true]]);
    assert.deepEqual(dial('미나의 메시지가 떴다. 『지금 출발해』'), [['지금 출발해', '미나', true]]);
    assert.deepEqual(dial('미나의⠀메시지가⠀떴다.⠀『지금 출발해』'), [['지금 출발해', '미나', true]], '점자 빈칸(U+2800)');
    assert.deepEqual(dial('하람이 방금 보낸 문자였다. 『도착!』'), [['도착!', '하람', true]]);
    assert.deepEqual(dial('The last line read: Tavi: "Thanks again!" and nothing else.'), [['Thanks a', 'Tavi', true]]);
    assert.deepEqual(dial('A text from Orin lit up the screen: "Running late."'), [['Running ', 'Orin', true]]);
    assert.deepEqual(dial('ミナからのメッセージには「了解です」とだけあった。'), [['了解です', 'ミナ', true]]);
    assert.deepEqual(dial('『곧 갈게』라는 미나의 답장이 왔다.'), [['곧 갈게', '미나', true]], '인용 뒤 같은 문장');
});
await test('받는 쪽은 보낸 사람이 아니에요 · 여럿이면 가장 가까운 보낸 쪽', () => {
    assert.deepEqual(dial('미나가 렉스에게 보낸 메시지였다. 『거기 있어?』'), [['거기 있어?', '미나', true]]);
    assert.deepEqual(dial('렉스는 하람에게 보낸 답장을 다시 봤다. 『응 알았어』'), [['응 알았어', '렉스', true]], '렉스가 보낸 쪽(「…는 … 보낸」) · 하람은 받는 쪽');
    assert.deepEqual(dial('미나의 메시지 아래로 하람의 답이 붙었다. 『나도 갈게』'), [['나도 갈게', '하람', true]], '가까운 쪽');
    assert.deepEqual(dial('Orin sent a message to Tavi: "On my way."'), [['On my wa', 'Orin', true]], 'to X 는 받는 쪽');
});
await test('단서가 없으면 예전처럼(문단 짐작 · 안 칠함) — 「쓴웃음」 · 「말했다」 · 인용 안의 이름은 단서가 아니에요', () => {
    assert.deepEqual(dial('렉스는 창밖을 봤다. 『오늘은 비가 오네』'), [['오늘은 비가 오', '렉스', false]]);
    assert.deepEqual(dial('미나가 쓴웃음을 지었다. 「그래」'), [['그래', '미나', false]]);
    assert.deepEqual(dial('미나가 웃으며 말했다. 「그래」'), [['그래', '미나', false]]);
    assert.deepEqual(dial('그녀는 "하람의 여동생"이라는 말을 떠올렸다.'), [['하람의 여동생', '', false]]);
    assert.deepEqual(dial('미나의 메시지가 왔다.\n\n렉스는 고개를 들었다. 「뭐래?」'), [['뭐래?', '렉스', false]], '다른 문단의 단서는 안 봐요');
});
// 2.0.2(사용자 제보 11-21 「타자는 왜 그 인물 대사 색 아님 ㅜ」) — 넓힌 꼴 · 인용만 있는 문단 · 내가 보낸 메시지
const dial2 = s => X.segmentMessage(s, { knownNames: NAMES, userName: '하람', charName: '렉스', paragraphs: true }).filter(g => g.kind === 'dialogue').map(g => [g.text.slice(0, 6), g.paraName || '', !!g.paraHead]);
await test('2.0.2 「X 특유의 … 답장」 · 「X의 회신」 · 「X가 쳐낸」 · X 의 reply · X texted back — 인용만 있는 다음 문단도', () => {
    assert.deepEqual(dial2('하람은 휴대폰을 주머니에 넣었다. 진동이 울렸다.\n\n꺼내 보니, 렉스 특유의 분당 200단어짜리 타자 속도로 쳐낸 답장이 와 있다.\n\n『17:08에 최종 배치 확인.』'), [['17:08에', '렉스', true]]);
    assert.deepEqual(dial2('미나의 회신이 떴다. 『확인』'), [['확인', '미나', true]]);
    assert.deepEqual(dial2('미나가 쳐낸 답장은 짧았다. 『응』'), [['응', '미나', true]]);
    assert.deepEqual(dial2("Tavi's reply came fast: \"Got it.\""), [['Got it', 'Tavi', true]]);
    assert.deepEqual(dial2('Tavi texted back: "Sure."'), [['Sure.', 'Tavi', true]]);
    assert.deepEqual(dial2('미나에게서 답장이 와 있다.\n\n\n\n『곧 가』'),[['곧 가', '미나', true]], '빈 문단 하나 건너');
});
await test('2.0.2 내가 보낸 메시지: 「(나는) X(직함)과의 대화창을 열고 … 입력한다」 · 「私はXに送る」 · 대명사는 앞 문장 주어가 나일 때만', () => {
    assert.deepEqual(dial2('하람은 휴대폰을 들었다. 그녀는 렉스(기획부 부장)과의 개인 대화창을 열고, 감정을 지운 채 철저히 사무적인 메시지를 입력한다.\n\n『렉스 부장님, 배치 결과 보고드립니다.』'), [['렉스 부장님', '하람', true]]);
    assert.deepEqual(dial2('하람이 보낸 메시지였다. 『곧 갈게』'), [['곧 갈게', '하람', true]], '내 이름 + 보낸');
    assert.deepEqual(dial2('私はミナに送る。「今行く」'), [['今行く', '하람', true]]);
    assert.deepEqual(dial2('하람은 숨을 골랐다. 그녀가 입력한 문장은 짧았다. 『알겠어요』'), [['알겠어요', '하람', true]]);
    assert.deepEqual(dial2('렉스는 미나와의 대화창을 열고 메시지를 보낸다. 『지금 와』'), [['지금 와', '렉스', true]], '주어가 다른 아는 이름이면 그 사람');
});
await test('2.0.2 못 가리면 그대로(오판보다 못 가림): 앞 문장 없는 대명사 · 보내는 말 없는 대화창 · 다른 이름 주어 대명사', () => {
    assert.deepEqual(dial2('그녀는 렉스(기획부 부장)과의 개인 대화창을 열고 메시지를 입력한다.\n\n『렉스 부장님, 보고드립니다.』'), [['렉스 부장님', '', false]]);
    assert.deepEqual(dial2('그녀가 입력한 문장은 짧았다. 『알겠어요』'), [['알겠어요', '', false]]);
    assert.deepEqual(dial2('하람은 렉스와의 대화창을 열어 둔 채 창밖을 봤다. 『비가 오네』'), [['비가 오네', '하람', false]], '보내는 말이 없으면 받는 쪽 꼴이 아니에요(예전 문단 짐작)');
    assert.deepEqual(dial2('미나는 고개를 들었다. 그녀는 렉스와의 대화창을 열고 입력한다. 『응』'), [['응', '미나', false]], '대명사의 앞 주어가 내가 아님');
});

await test('발신자 머리 줄이 있으면 그것이 먼저(1.7.8 그대로)', () => {
    assert.deepEqual(dial('렉스의 메시지 다음.\n【발신자: 미나】\n『확인했어.』'), [['확인했어.', '미나', true]]);
});
await test('칠하기: 보낸 사람 단서(header)는 칠하고 · 못 가린 서술 속 인용만 표시', () => {
    const quotes = [{ d: { start: 12 }, text: '아까 고마워', colored: false }, { d: { start: 40 }, text: '하람의 여동생', colored: false }, { d: { start: 60 }, text: '그래', colored: false }, { d: { start: 70 }, text: '빨강', colored: true }];
    const flat = '미나에게서 온 배지였다. 『아까 고마워』\n\n그녀는 "하람의 여동생"이라는 말을 떠올렸다.\n「그래」\n렉스는 「빨강」';
    const at = s => flat.indexOf(s) - 1;
    quotes[0].d.start = at('아까 고마워'); quotes[1].d.start = at('하람의 여동생'); quotes[2].d.start = at('그래'); quotes[3].d.start = at('빨강');
    const speakers = [{ text: '아까 고마워', color: null, name: '미나', source: 'header' }, { text: '하람의 여동생', color: null, name: '렉스', source: 'sender' }, { text: '그래', color: null, name: '렉스', source: 'sender' }, { text: '빨강', color: '#ff0000', name: '렉스', source: 'learned' }];
    assert.deepEqual(core.planPaint(quotes, speakers, n => (n === '미나' ? '#7b6cd9' : null)), [{ index: 0, color: '#7b6cd9', name: '미나' }]);
    assert.deepEqual(core.nobodyPlan(quotes, speakers, flat), [1], '서술 줄 가운데 · 화자 못 정함만(줄 머리 대사 · 색 있는 대사 · 칠한 대사는 아님)');
    assert.equal(core.NOBODY, 'bl-q-nobody');
});
await test('배선: 화면 칠하기가 표시를 달고 떼요 · CSS 는 색 없는 옅은 점선 밑줄', () => {
    const paint = fs.readFileSync(path.join(root, 'src/addons/tts/src/paint.js'), 'utf8');
    assert.match(paint, /markNobody\(root, new Set\(speakers\.length \? nobodyPlan\(list, speakers, flat\)/);
    assert.match(paint, /if \(skip\) \{ if \(had\.length\) unwrap\(root\); markNobody\(root, new Set\(\)\); return 0; \}/);
    const css = fs.readFileSync(path.join(root, 'css/06-chat-text.css'), 'utf8');
    assert.match(css, /q\.bl-q-nobody \{\s*text-decoration-line: underline;\s*text-decoration-style: dotted;\s*text-decoration-color: var\(--salty-faint\);/);
});
done();
