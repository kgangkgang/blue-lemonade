// 7.7.2 번역 · TTS 문단 맞추기의 경계 (tts/src/text.js) — 원문 ↔ 번역문 대사 짝(pairSegments · colorsClash), 이어 읽기 묶음(markJoins · joinSpeech),
//   물어볼 기울임(italicCandidates), 원문 함께 보기에서 번역문만 읽기(speechDisplay). 지어낸 문장 · 이름만, 네트워크 없음.
//   node tools/tests/tts-pair-edges.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const X = await import(pathToFileURL(path.join(root, 'src/addons/tts/src/text.js')).href);
let pass = 0, fail = 0;
function test(name, fn) {
    try { fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}
const d = (text, extra = {}) => ({ kind: 'dialogue', text, tags: [], ...extra });

test('colorsClash: 둘 다 색이 있는데 다를 때만', () => {
    assert.equal(X.colorsClash([{ color: '#f00' }], [{ color: '#0f0' }]), true);
    assert.equal(X.colorsClash([{ color: '#f00' }], [{ color: '#f00' }]), false);
    assert.equal(X.colorsClash([{ color: '#f00' }], [{}]), false);
    assert.equal(X.colorsClash([{}], [{ color: '#f00' }]), false);
    assert.equal(X.colorsClash([{ color: '#f00' }, { color: '#00f' }], [{ color: '#f00' }]), false, '짝이 없는 줄은 안 본다');
    assert.equal(X.colorsClash([], []), false);
});

test('pairSegments: 대사 수가 같고 색이 안 부딪칠 때만 차례대로 색 · 이름 · 꼬리표를 옮긴다', () => {
    const src = [d('"Hi"', { color: '#f00', speakerHint: 'Mina', tags: ['a'] }), { kind: 'narration', text: 'n' }, d('"Bye"', { color: '#00f', speakerHint: 'Rex', tags: [] })];
    const disp = [{ kind: 'narration', text: '서술' }, d('「안녕」'), d('「잘 가」', { color: '#00f', speakerHint: '렉스', tags: ['own'] })];
    const out = X.pairSegments(src, disp);
    assert.deepEqual(out.map(s => [s.kind, s.color ?? null, s.speakerHint ?? null, s.tags]), [['narration', null, null, []], ['dialogue', '#f00', 'Mina', ['a']], ['dialogue', '#00f', '렉스', ['own']]]);
    assert.notEqual(out[1], disp[1], '새 객체');
    assert.deepEqual(disp[1].tags, [], '번역문 조각을 고치지 않는다');
    out[1].tags.push('z'); assert.deepEqual(src[0].tags, ['a'], '꼬리표 배열도 사본');
    const fewer = X.pairSegments(src, [d('「하나뿐」')]);
    assert.deepEqual(fewer.map(s => s.color ?? null), [null], '수가 다르면 옮기지 않는다 (사본만)');
    const clash = X.pairSegments([d('a', { color: '#f00' }), d('b', { color: '#00f' })], [d('가', { color: '#00f' }), d('나', { color: '#f00' })]);
    assert.deepEqual(clash.map(s => s.color), ['#00f', '#f00'], '색이 부딪치면(한 줄씩 밀림) 옮기지 않는다');
    assert.deepEqual(X.pairSegments([], [d('가')]).map(s => s.color ?? null), [null]);
    assert.deepEqual(X.pairSegments(src, null), []);
    assert.deepEqual(X.pairSegments(null, [d('가')]).length, 1);
    const keep = X.pairSegments([d('a', { color: null, speakerHint: null })], [d('가', { color: '#abc' })]);
    assert.deepEqual([keep[0].color, keep[0].speakerHint], ['#abc', null], '원문에 색이 없으면 번역문 색 그대로');
    const noTags = X.pairSegments([d('a', { tags: undefined })], [d('가', { tags: undefined })]);
    assert.deepEqual(noTags[0].tags, []);
});

test('markJoins: 같은 문단의 대사 · 말 기울임을, 읽지 않는 조각만 사이에 두고 한 묶음으로', () => {
    const seg = (kind, para, extra = {}) => ({ kind, para, text: 'x', ...extra });
    const segs = [seg('dialogue', 0), seg('narration', 0), seg('dialogue', 0), seg('action', 0, { speech: true }), seg('dialogue', 1), seg('thought', 1), seg('dialogue', 1), seg('dialogue', 1, { term: true }), seg('dialogue', 1), null, seg('dialogue', 2, { text: '' })];
    X.markJoins(segs, {}, 't');
    assert.deepEqual(segs.map(s => s?.join ?? null), ['t1', null, 't1', 't1', 't2', null, 't3', null, 't3', null, null], '서술은 건너뛰기라 이어지고, 속마음 글이 끼면 끊긴다 · 이름표(term)는 묶지 않지만 끊지도 않는다');
    const read = [seg('dialogue', 0), seg('narration', 0), seg('dialogue', 0)];
    X.markJoins(read, { narration: 'read' });
    assert.deepEqual(read.map(s => s.join ?? null), ['1', null, '2'], '서술을 읽으면 거기서 끊긴다');
    const act = [seg('dialogue', 0), seg('action', 0), seg('dialogue', 0)];
    X.markJoins(act, { action: 'narrator' });
    assert.deepEqual(act.map(s => s.join ?? null), ['1', null, '2'], '행동을 읽으면 끊긴다');
    X.markJoins(act, {});
    assert.deepEqual(act.map(s => s.join ?? null), ['1', null, '1'], '다시 부르면 옛 묶음을 지우고 새로');
    const paraless = [{ kind: 'dialogue', text: 'a' }, { kind: 'dialogue', text: 'b' }];
    X.markJoins(paraless);
    assert.deepEqual(paraless.map(s => s.join ?? null), [null, null], '문단 번호가 없으면 묶지 않는다');
    assert.equal(X.markJoins(null), null);
});

test('joinSpeech: 글자로 끝나면 쉼표 + 띄어쓰기, 문장부호로 끝나면 띄어쓰기만', () => {
    assert.equal(X.joinSpeech('안녕', '잘 가'), '안녕, 잘 가');
    assert.equal(X.joinSpeech('Hi3', 'there'), 'Hi3, there');
    assert.equal(X.joinSpeech('안녕.', '잘 가'), '안녕. 잘 가');
    assert.equal(X.joinSpeech('"안녕"', '잘 가'), '"안녕" 잘 가');
    assert.equal(X.joinSpeech('  안녕  ', '  잘 가 '), '  안녕, 잘 가 ', '사이 공백만 다듬는다');
    assert.equal(X.joinSpeech('', 'b'), 'b');
    assert.equal(X.joinSpeech('a', ''), 'a');
    assert.equal(X.joinSpeech(null, '  b'), 'b');
});

test('italicCandidates: 기울이지 않은 서술이 있는 메시지의 기울임만 묻는다', () => {
    const g = (kind, para, text = 'x') => ({ kind, para, text });
    const prose = [g('narration', 0), g('action', 0), g('action', 1), g('action', null), g('action', 2, ''), null];
    assert.deepEqual(X.italicCandidates(prose).map(s => s.para), [0, 1]);
    assert.deepEqual(X.italicCandidates([g('action', 0), g('dialogue', 0)]), [], 'RP 체(서술이 모두 기울임)는 묻지 않는다');
    assert.deepEqual(X.italicCandidates([g('narration', null), g('action', 0)]), [], '문단 번호 없는 서술은 세지 않는다');
    assert.deepEqual(X.italicCandidates([g('narration', 0, ''), g('action', 0)]), []);
    assert.deepEqual(X.italicCandidates(null), []);
});

test('speechDisplay: 원문 함께 보기(접기 · 원문 먼저 · 펼침)에서 번역문만, 다른 details 는 그대로', () => {
    const fold = (sum, body, mode = 'mode-folded') => `<details class="llm-translator-details ${mode}"><summary class="s">${sum}</summary>${body}</details>`;
    assert.equal(X.speechDisplay('그냥 글'), '그냥 글');
    assert.equal(X.speechDisplay(null), '');
    assert.equal(X.speechDisplay(fold('번역문', '원문')), '번역문', '접기: 요약 = 번역문');
    assert.equal(X.speechDisplay(fold('원문', '번역문', 'mode-original-first')), '번역문', '원문 먼저: 본문 = 번역문');
    assert.equal(X.speechDisplay(fold('<span class="translated_text">번역문</span>', '원문')), '번역문', '번역문 칸 하나면 벗긴다');
    assert.equal(X.speechDisplay(fold('<span class="translated_text">가</span> 나', '원문')), '<span class="translated_text">가</span> 나', '칸이 글 일부면 그대로');
    assert.equal(X.speechDisplay(`앞 ${fold('하나', 'one')}\n${fold('둘', 'two')} 뒤`), '앞 하나\n둘 뒤', '줄마다');
    assert.equal(X.speechDisplay(fold('바깥 <details><summary>안</summary>속</details> 끝', 'orig')), '바깥 <details><summary>안</summary>속</details> 끝', '안쪽 details 를 세어 닫는 짝을 찾는다');
    assert.equal(X.speechDisplay('<details class="llm-translator-details mode-folded">요약 없음</details>'), '<details class="llm-translator-details mode-folded">요약 없음</details>', '요약이 없으면 그대로');
    assert.equal(X.speechDisplay('<details class="llm-translator-details mode-folded"><summary>안 닫힘'), '<details class="llm-translator-details mode-folded"><summary>안 닫힘', '안 닫힌 것은 그대로');
    const unf = (t, o) => `<span class="translated_text mode-unfolded">${t}</span><br><span class="original_text mode-unfolded">${o}</span>`;
    assert.equal(X.speechDisplay(`1. ${unf('번역 하나', 'one')}\n${unf('번역 둘', 'two')}`), '1. 번역 하나\n번역 둘', '펼침: 줄 머리 표시는 남고 원문 칸은 뗀다');
    assert.equal(X.speechDisplay('머리 <br><span class="original_text mode-unfolded">원문</span>'), '머리 ', '번역문 칸 없이 원문 칸만 있으면 앞만');
    assert.equal(X.speechDisplay('가<div class="llmt-para-gap"></div>나'), '가나', '문단 간격 요소는 지운다');
    assert.equal(X.speechDisplay('<details class="status"><summary>상태</summary>값</details>'), '<details class="status"><summary>상태</summary>값</details>', '다른 details 는 손대지 않는다');
});

console.log(`tts-pair-edges: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
