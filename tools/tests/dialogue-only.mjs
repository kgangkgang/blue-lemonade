// 테마 6.6.9 대사만 보기 — src/dialogue-lines.js (대사 추출 · 화면 글에서 자리 찾기) · src/dialogue-only.js (··· 메뉴 단추) · src/dialogue-view.js (지연 화면)
//   node tools/tests/dialogue-only.mjs <테마 루트>
// 인물 · 문장은 모두 지어낸 것이다. 실리태번 · DOM 없이 순수 함수만 돌리고, 연결은 글로 확인한다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { dialogueLines, shownText, dropThinkingBlocks, locateLines, DEFAULT_SKIP_TAGS } = await import(pathToFileURL(path.join(root, 'src/dialogue-lines.js')).href);

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`ok - ${name}`); };
const msg = (mes, extra = {}) => ({ mes, name: '가람', is_user: false, extra });
const texts = list => list.map(x => x.text);

test('괄호 대사만 순서대로 — 서술 · 행동은 빼요', () => {
    const lines = dialogueLines(msg('바람이 분다.\n「오늘은 일찍 닫아요.」\n그가 문을 닫았다. *한숨*\n『잠깐만 기다려 줘.』'));
    assert.deepEqual(texts(lines), ['오늘은 일찍 닫아요.', '잠깐만 기다려 줘.']);
    assert.ok(lines.every(x => x.kind === 'dialogue'));
});

test('인라인 색 대사 — 괄호 있는 것 · 색만 입힌 것 모두, 색은 #rrggbb', () => {
    const lines = dialogueLines(msg('창밖을 본다.\n<span style="color:#E06C75">「비가 올 것 같아.」</span>\n<span style="color: rgb(97, 175, 239)">우산은 내가 챙길게.</span>\n그리고 조용해졌다.'));
    assert.deepEqual(texts(lines), ['비가 올 것 같아.', '우산은 내가 챙길게.']);
    assert.equal(lines[0].color, '#e06c75');
    assert.equal(lines[1].color, '#61afef');
});

test('여러 줄 대사는 한 줄로 · "이름: 「" 은 이름으로', () => {
    const lines = dialogueLines(msg('누리: 「첫째 줄이고\n둘째 줄까지 이어지는\n긴 대사예요.」\n서술 한 줄.'), { knownNames: ['누리'] });
    assert.equal(lines.length, 1);
    assert.equal(lines[0].text, '첫째 줄이고 둘째 줄까지 이어지는 긴 대사예요.');
    assert.equal(lines[0].name, '누리');
});

test('속마음은 「속마음」 줄로 (true_thoughts · 이름)', () => {
    const lines = dialogueLines(msg('「괜찮아.」\n<true_thoughts character="누리">사실은 하나도 안 괜찮은데.</true_thoughts>\n「정말이야.」'));
    assert.deepEqual(lines.map(x => [x.kind, x.text]), [['dialogue', '괜찮아.'], ['thought', '사실은 하나도 안 괜찮은데.'], ['dialogue', '정말이야.']]);
    assert.equal(lines[1].name, '누리');
});

test('생각 블록(머리 · 가운데) · 숨김 주석 · think 안의 글은 대사가 아니에요', () => {
    const head = '[RE: 검사]\n<ECoT>\n「생각 속 가짜 대사」를 쓸지 고민한다.\n</ECoT>\n';
    const body = '「진짜 첫 대사.」\n<!-- 「숨김 주석 속 대사」 -->\n<ECoT>「가운데 생각 블록」</ECoT>\n<think>「추론 속 대사」</think>\n「진짜 둘째 대사.」';
    assert.deepEqual(texts(dialogueLines(msg(head + body))), ['진짜 첫 대사.', '진짜 둘째 대사.']);
    // 닫히지 않은 주석은 그 문단 끝까지만 숨김 (TTS 1.8.9 blankComments 와 같은 규칙) — 다음 문단 대사는 살아 있다
    assert.deepEqual(texts(dialogueLines(msg('「보이는 대사.」\n<!-- 「닫히지 않은 주석」\n이어지는 점검 줄「여기도 숨김」\n\n「다음 문단 대사.」'))), ['보이는 대사.', '다음 문단 대사.']);
    // 줄 수는 그대로 (줄 번호가 밀리지 않게)
    const dropped = dropThinkingBlocks('가\n<ECoT>나\n다</ECoT>\n라');
    assert.equal(dropped.split('\n').length, 4);
    assert.ok(!/ECoT|나|다/.test(dropped));
});

test('번역문이 있으면 번역문 기준 · 원문의 색 · 이름을 옮겨요', () => {
    const mes = msg('<span style="color:#c678dd">「おはよう。」</span>\n朝だ。\n「行こう。」', {
        display_text: '<span style="color:#c678dd">「좋은 아침.」</span>\n아침이다.\n「가자.」',
    });
    assert.equal(shownText(mes).translated, true);
    const lines = dialogueLines(mes);
    assert.deepEqual(texts(lines), ['좋은 아침.', '가자.']);
    assert.equal(lines[0].color, '#c678dd');
    // 번역문에서 색이 빠져도 원문 색이 차례대로 옮겨진다
    const lost = dialogueLines(msg('<span style="color:#98c379">「はい。」</span>', { display_text: '「네.」' }));
    assert.deepEqual(texts(lost), ['네.']);
    assert.equal(lost[0].color, '#98c379');
    // 번역문이 원문과 같거나 비었으면 원문
    assert.equal(shownText(msg('「하나.」', { display_text: '  ' })).translated, false);
    assert.deepEqual(texts(dialogueLines(msg('「하나.」', { display_text: '「하나.」' }))), ['하나.']);
});

test('같은 대사가 여러 번이면 번째 · 개수 (TTS 가 같은 줄을 고르게)', () => {
    const lines = dialogueLines(msg('「응.」\n서술.\n「아니.」\n「응.」'));
    assert.deepEqual(lines.map(x => [x.text, x.sameIndex, x.sameCount]), [['응.', 0, 2], ['아니.', 0, 1], ['응.', 1, 2]]);
});

test('시스템 메시지 · 빈 글 · 대사 없는 글은 빈 목록', () => {
    assert.deepEqual(dialogueLines({ mes: '「시스템」', is_system: true }), []);
    assert.deepEqual(dialogueLines(msg('')), []);
    assert.deepEqual(dialogueLines(msg('그냥 서술만 이어지는 문단.\n*행동*')), []);
    assert.deepEqual(dialogueLines(null), []);
});

test('긴 답(1만 자 넘게)도 한 번에 빨리', () => {
    const block = '하늘이 낮게 내려앉았다. 길 위로 바람이 지나간다.\n「여기서 잠깐 쉬자.」\n<span style="color:#e5c07b">「물 마실래?」</span>\n';
    const text = '[RE:]\n<ECoT>\n「계획」\n</ECoT>\n' + block.repeat(120);
    assert.ok(text.length > 10000);
    const t0 = performance.now();
    const lines = dialogueLines(msg(text));
    const ms = performance.now() - t0;
    assert.equal(lines.length, 240);
    assert.ok(!lines.some(x => x.text === '계획'));
    assert.ok(ms < 1500, `${ms}ms`);
});

test('TTS 의 기본 건너뛸 태그와 같아요', () => {
    const m = /DEFAULT_SKIP_TAGS = '([^']*)'/.exec(read('src/addons/tts/src/settings.js'));
    assert.equal(DEFAULT_SKIP_TAGS, m?.[1]);
});

test('화면 글에서 자리 찾기 — 마크다운 조각 · 줄임표 · 같은 대사 순서', () => {
    const pieces = ['서술이다. 「', '오늘', '은… 정말', ' 길었어.」 그리고 「응.」 다시 「', '응.', '」'];
    const lines = [{ text: '오늘은... 정말 길었어.' }, { text: '응.' }, { text: '응.' }, { text: '없는 대사' }];
    const at = locateLines(pieces, lines);
    // 시작은 첫 글자, 끝은 줄 글의 마지막 글자 바로 뒤 — 조각을 넘어도 (강조 · 색 span 으로 갈린 글 노드)
    assert.deepEqual(at[0], { piece: 1, offset: 0, endPiece: 3, endOffset: pieces[3].indexOf('.') + 1 });
    assert.deepEqual(at[1], { piece: 3, offset: pieces[3].indexOf('응'), endPiece: 3, endOffset: pieces[3].indexOf('응') + 2 });
    assert.deepEqual(at[2], { piece: 4, offset: 0, endPiece: 4, endOffset: 2 });
    assert.equal(at[3], null);
    // 화면 글이 저장 글과 끝이 다르면(뒷부분을 다르게 그림) 맞는 데까지만
    const part = locateLines(['「같은 앞부분인데 끝이 달라」'], [{ text: '같은 앞부분인데 끝이 다르다' }])[0];
    assert.deepEqual(part, { piece: 0, offset: 1, endPiece: 0, endOffset: 12 });
});

test('단추 모듈: 감시자 · 타이머 없음 · 화면은 처음 누를 때만 불러와요', () => {
    const only = read('src/dialogue-only.js');
    const view = read('src/dialogue-view.js');
    assert.ok(!/^import\s/m.test(only), '단추 모듈은 아무것도 미리 불러오지 않는다');
    assert.ok(/import\('\.\/dialogue-view\.js'\)/.test(only));
    for (const src of [only, view]) assert.ok(!/MutationObserver|setInterval|ResizeObserver|IntersectionObserver/.test(src));
    assert.ok(!/setTimeout/.test(only));
    // 단추 이름표는 mes-pins.js 가 고정할 수 있는 클래스 (bl- · fa- 는 공통 클래스로 걸러진다)
    assert.ok(/const KEY = 'mes_dialogue_only'/.test(only));
    assert.ok(/#message_template/.test(only));
    // features.js: 테마가 켜져 있을 때 단추 모듈 (설정 chat.dialogueOnly === false 면 끔)
    const features = read('src/features.js');
    assert.ok(/load\('dialogueonly', '\.\/dialogue-only\.js'\)\.then\(m => m\?\.syncDialogueOnly\(dialogueOnly\)\)/.test(features));
});

test('듣기는 TTS 의 기존 길만 써요 (새 재생기 · 오디오 없음)', () => {
    const view = read('src/dialogue-view.js');
    assert.ok(/speakSegments\(mesId, segs\)/.test(view));
    assert.ok(/segmentForHit\(mes,/.test(view));
    assert.ok(!/new Audio|AudioContext|speechSynthesis|fetch\(/.test(view));
    // TTS 가 꺼져 있으면 듣기 단추가 없다 (켜진 TTS 모듈이 있고 줄이 있을 때만) · 조각은 듣기를 누를 때 한 번만 만든다
    assert.ok(/\$\{tts && rows\.length \? `<button type="button" class="salty-btn" data-act="listen">/.test(view));
    assert.ok(/segs \?\?= segsOf\(mes, rows, tts\)/.test(view));
    assert.ok(/dialogueSpeakers\(mesId\)/.test(view));
    assert.ok(/runtimeEnabled\(\)/.test(view) && /blue-lemonade\.tts\.owner/.test(view));
});

console.log(`\n${passed} passed`);
