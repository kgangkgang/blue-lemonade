// 5.6.2: 번역 '원문 병기 보기'(접기 · 원문 먼저 · 펼침)의 렌더러 — index.js 안의 순수 함수들을 잘라 내 node 에서 돌린다 (브라우저 없이 문자열 결과를 고정).
//   node tools/tests/translation-display.mjs [확장 뿌리, 기본 .]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dev = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(dev, 'src/addons/translator/index.js'), 'utf8');
function cut(name) {
    let start = source.indexOf(`\nfunction ${name}(`);
    if (start < 0) start = source.indexOf(`\nexport function ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    // 매개변수 목록이 여러 줄일 수 있다 → 본문을 여는 중괄호는 ') {' 의 것
    for (let j = source.indexOf(') {', start) + 2; j < source.length; j++) {
        const ch = source[j];
        if (ch === '{') depth++;
        else if (ch === '}' && --depth === 0) return source.slice(start + 1, j + 1).replace(/^export /, '');
    }
    throw new Error('unbalanced ' + name);
}
const names = ['processTranslationText', 'applyIsolation', 'analyzeStructure', 'extractPureText', 'renderTranslation', 'renderAllInOne', 'renderInterleaved', 'createDetailsTag', 'restoreContent'];
const segments = pathToFileURL(path.join(dev, 'src/addons/translator/translation-segments.js')).href;
const module = `import { splitBlockPrefix, structureLines, isHeadingUnderline, isBareQuote, paragraphBlocks } from ${JSON.stringify(segments)};
const extensionSettings = { translation_display_mode: 'folded', force_sequential_matching: false };
const window = {}, toastr = { error() {}, warning() {} };
const correctBackticks = input => input, getCombinedRegexes = () => [], getNoFoldRegexes = () => [];
${names.map(cut).join('\n')}
export function render(orig, trans, mode = 'folded', force = false) {
    extensionSettings.translation_display_mode = mode; extensionSettings.force_sequential_matching = force;
    return processTranslationText(orig, trans);
}
`;
const file = path.join(os.tmpdir(), `llmt-render-${process.pid}.mjs`);
fs.writeFileSync(file, module);
const { render } = await import(pathToFileURL(file).href);
fs.unlinkSync(file);

const D = (t, o, mode = 'folded') => mode === 'folded'
    ? `<details class="llm-translator-details mode-folded"><summary class="llm-translator-summary"><span class="translated_text clickable-text-org">${t}</span></summary><span class="original_text">${o}</span></details>`
    : `<details class="llm-translator-details mode-original-first"><summary class="llm-translator-summary"><span class="original_text clickable-text-org">${o}</span></summary><span class="translated_text">${t}</span></details>`;
const U = (t, o) => `<span class="translated_text mode-unfolded">${t}</span><br><span class="original_text mode-unfolded">${o}</span>`;
const GAP = '<div class="llmt-para-gap"></div>';
const eq = (orig, trans, expected, mode = 'folded') => assert.equal(render(orig, trans, mode), expected.join('\n'), JSON.stringify(trans));

// '사용 안 함'은 번역문 그대로
assert.equal(render('A\r\nB', '# 가\r\n- 나', 'disabled'), '# 가\r\n- 나');
// 보통 문단: 예전과 같은 결과 (줄마다 details, 빈 줄은 간격 요소)
eq('A\nB\n\nC', '가\n나\n\n다', [D('가', 'A'), D('나', 'B'), GAP, D('다', 'C')]);
eq('A\n\nB', '가\n\n나', [D('가', 'A', 'of'), GAP, D('나', 'B', 'of')], 'original_first');
eq('A\n\nB', '가\n\n나', [U('가', 'A'), '', U('나', 'B')], 'unfolded');
// 제목 · 인용 · 목록: 표시는 감싸개 밖, 원문 쪽 표시도 뗀다
eq('# One', '# 하나', ['# ' + D('하나', 'One')]);
eq('## One ##', '## 하나 ##', ['## ' + D('하나', 'One')]);
eq('> Q1\n> Q2', '> 인용1\n> 인용2', ['> ' + D('인용1', 'Q1'), '> ' + D('인용2', 'Q2')]);
eq('- a\n- b\n\nend', '- 가\n- 나\n\n끝', ['- ' + D('가', 'a'), '- ' + D('나', 'b'), '', D('끝', 'end')]);
// 번호 목록 사이 빈 줄은 빈 줄 그대로 (간격 요소면 목록이 끊겨 번호가 1 로 돌아간다)
eq('1. a\n\n2. b', '1. 가\n\n2. 나', ['1. ' + D('가', 'a'), '', '2. ' + D('나', 'b')]);
// 문단 글 바로 다음의 목록 · 제목 · 인용: 앞에 간격 요소 (보통 화면은 거기서 문단이 끝난다)
eq('t\n- a', '글\n- 가', [D('글', 't'), GAP, '- ' + D('가', 'a')]);
eq('t\n## h\nu', '글\n## 제목\n뒤', [D('글', 't'), GAP, '## ' + D('제목', 'h'), D('뒤', 'u')]);
// 목록 · 인용에 딸린 줄(표시 없는 줄)은 문단 글이 아니다 → 다음 항목 앞에 간격 요소를 넣지 않는다, 그 뒤 빈 줄도 빈 줄 그대로
eq('- a\nmore\n- b\n\nend', '- 가\n딸린 줄\n- 나\n\n끝', ['- ' + D('가', 'a'), D('딸린 줄', 'more'), '- ' + D('나', 'b'), '', D('끝', 'end')]);
eq('1. a\nmore\n\n2. b', '1. 가\n딸린 줄\n\n2. 나', ['1. ' + D('가', 'a'), D('딸린 줄', 'more'), '', '2. ' + D('나', 'b')]);
// 열린 목록 안: 4칸 · 탭 들여쓴 하위 항목, 빈 줄 다음의 들여쓴 줄(항목에 딸린 문단)은 앞 공백을 감싸개 밖에. 목록 밖의 4칸 들여쓴 줄은 줄째 감싼다
eq('- a\n    - b\n\t- c\n- d', '- 가\n    - 나\n\t- 다\n- 라', ['- ' + D('가', 'a'), '    - ' + D('나', 'b'), '\t- ' + D('다', 'c'), '- ' + D('라', 'd')]);
eq('- a\n\n  more\n- c\n\nend', '- 가\n\n  딸린 문단\n- 다\n\n끝', ['- ' + D('가', 'a'), '', '  ' + D('딸린 문단', 'more'), '- ' + D('다', 'c'), '', D('끝', 'end')]);
eq('t\n\n    - x', '글\n\n    - 가', [D('글', 't'), GAP, D('    - 가', '    - x')]);
// 가로줄 · 표는 감싸지 않고, 양쪽 줄 맞춤에서도 뺀다
eq('A\n\n---\n\nB', '가\n\n---\n\n나', [D('가', 'A'), GAP, '---', '', D('나', 'B')]);
eq('A\n\n***\n\nB', '가\n\n---\n\n나', [D('가', 'A'), GAP, '---', '', D('나', 'B')]);
eq('t\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nu', '글\n\n| 가 | 나 |\n|---|---|\n| 1 | 2 |\n\n뒤', [D('글', 't'), GAP, '| 가 | 나 |', '|---|---|', '| 1 | 2 |', '', D('뒤', 'u')]);
eq('| S |\n|---|\n| x |\n\nu', '| 상태창 |\n|---|\n| 내용 |\n\n뒤', ['| 상태창 |', '|---|', '| 내용 |', '', D('뒤', 'u')]);
// 문단 글 바로 아래의 표 · 가로줄(***)은 새 블록 → 간격 요소. 제목 밑줄(--- · ===)은 윗줄을 제목으로 만든다 → 그 줄은 표시째 감싸고 간격 요소 없음
eq('t\n| a | b |\n|---|---|', '글\n| 가 | 나 |\n|---|---|', [D('글', 't'), GAP, '| 가 | 나 |', '|---|---|']);
eq('t\n***\nu', '글\n***\n뒤', [D('글', 't'), GAP, '***', D('뒤', 'u')]);
eq('t\n---\nu', '글\n---\n뒤', [D('글', 't'), '---', D('뒤', 'u')]);
eq('t\n===', '글\n===', [D('글', 't'), '===']);
eq('### S\n---\nb', '### 상태\n---\n본문', [D('### 상태', '### S'), '---', D('본문', 'b')]);
eq('t\nTitle\n---', '글\n제목\n---', [D('글', 't'), GAP, D('제목', 'Title'), '---']);
// 인용 속 빈 줄('>')은 감싸지 않는다 (감싸면 '>' 가 글자로 보이고 문단이 붙는다)
eq('> A\n>\n> B', '> 가\n>\n> 나', ['> ' + D('가', 'A'), '>', '> ' + D('나', 'B')]);
// 코드 블록: 안은 그대로, 문단 글 바로 다음이면 앞에 간격 요소. 블록 안의 표 · 가로줄은 구조 줄로 보지 않는다
eq('t\n```\n| a | b |\n---\n```\nu', '글\n```\n| a | b |\n---\n```\n뒤', [D('글', 't'), GAP, '```', '| a | b |', '---', '```', D('뒤', 'u')]);
// 표시처럼 보이지만 아닌 줄은 예전처럼 줄째 감싼다 (0열이 아닌 # · 목록 표시 뒤의 # 포함)
eq('*i* x\n-dash\n1) n\n # s', '*기울임* 글\n-붙은 글\n1) 번호\n # 제목 아님', [D('*기울임* 글', '*i* x'), D('-붙은 글', '-dash'), D('1) 번호', '1) n'), D(' # 제목 아님', ' # s')]);
eq('- # h', '- # 제목', ['- ' + D('# 제목', '# h')]);
// 번역문에만 표시가 있으면 원문은 그대로, 원문에만 있으면 손대지 않는다
eq('plain', '# 제목', ['# ' + D('제목', 'plain')]);
eq('# Head', '제목', [D('제목', '# Head')]);
// 펼침 방식: 표시는 밖, 빈 줄은 빈 줄
eq('- a\n\nt', '- 가\n\n글', ['- ' + U('가', 'a'), '', U('글', 't')], 'unfolded');
// CRLF 로 저장된 원문(인사말): 줄 판정이 양쪽에서 같아 줄마다 접히고(통째 접기로 떨어지지 않는다), 결과에 \r 이 남지 않는다
eq('She waited.\r\n---\r\n**Status**\r\nHP: 10\r\n\r\nNext.', '그녀는 기다렸다.\n---\n**상태**\nHP: 10\n\n다음.', [D('그녀는 기다렸다.', 'She waited.'), '---', D('**상태**', '**Status**'), D('HP: 10', 'HP: 10'), GAP, D('다음.', 'Next.')]);
eq('### Chapter 1\r\n\r\n*Rain.*', '### 1장\r\n\r\n*비.*', ['### ' + D('1장', 'Chapter 1'), '', D('*비.*', '*Rain.*')]);
assert.ok(!render('A\r\nB', '가\r\n나', 'unfolded').includes('\r'));
// 가로줄 수가 달라도(모델이 --- 를 빼먹음) 줄 맞춤은 유지된다
eq('A\n\n---\n\nB', '가\n\n나', [D('가', 'A'), GAP, D('나', 'B')]);
// 통째 접기(줄 수 불일치): 문단마다 <p>
const whole = render('A\n\nB', '가\n\n나1\n나2', 'folded');
assert.ok(whole.includes('<summary class="llm-translator-summary"><p>가</p><p>나1<br>나2</p></summary>'), whole);
assert.ok(whole.includes('<p>A</p><p>B</p>'), whole);
console.log('PASS renderer: plain paragraphs unchanged; block prefixes outside wrappers; gaps only after paragraph text; rules/tables/code left as is; CRLF; whole-fold paragraphs');

// TTS: 접기 줄 칸 밖에 놓인 표시 · 표 줄은 읽지 않는다 (예전과 같은 결과 — 이 보기에서는 번역문 칸이 '건너뛸 태그' 안에 있다)
const { speechDisplay, segmentMessage } = await import(pathToFileURL(path.join(dev, 'src/addons/tts/src/text.js')).href);
const shown = render('1. Step one\n2. Step two\n\n| Name | HP |\n|---|---|\n| Ann | 10 |\n\n# Title\n"Hi," she said.', '1. 첫 단계\n2. 둘째 단계\n\n| 이름 | 체력 |\n|---|---|\n| 앤 | 10 |\n\n# 제목\n"안녕," 그녀가 말했다.');
const speech = speechDisplay(shown);
assert.ok(!/^\s*\d+\.\s|^\s*\||^# /m.test(speech), speech);
assert.equal((speech.match(/<details class="llm-translator-details /g) || []).length, 4);
const skip = { skipTags: new Set(['details', 'summary', 'table']), skipCode: true };
assert.equal((segmentMessage(speech, skip) || []).length, 0);
assert.ok((segmentMessage(shown, skip) || []).length > 0, 'the guard is what removes the stray pieces');
assert.equal(speechDisplay('1. 보통 번역문\n| a | b |'), '1. 보통 번역문\n| a | b |');
assert.equal(speechDisplay(render('- a', '- 가', 'unfolded')), '- ' + U('가', 'a'));
console.log('PASS TTS reads no stray list numbers or table rows from a folded translation');
