// 버그 사냥 2(1.7.8 거리) — 이름 숨김(로그 복사 · 채팅 캡처)이 로마자 이름을 다른 낱말 속에서도 가리던 것.
//   「Eve」 를 가리면 Every · evening · never 가 ○○ry · ○○ning · n○○r 이 됐어요. 로마자 이름은 낱말 경계에서만 —
//   한글 이름 · 한글 조사가 붙은 로마자 이름(Eve와) · 끝 s(Eves) · 's 는 그대로 가려요.
//   node tools/tests/name-hide-latin.mjs <테마 루트>
import fs from 'node:fs';
import path from 'node:path';
import { assert, load, root, suite } from './_t.mjs';
const { test, done } = suite('name-hide-latin');

const { namePattern } = await load('src/name-aliases.js');
const { transformLog } = await load('src/log-copy-words.js');
const hits = (names, text) => [...text.matchAll(namePattern(names))].map(m => m[0]);

await test('로마자 이름은 다른 낱말 속에서 안 걸려요', () => {
    assert.deepEqual(hits(['Eve'], 'Every evening never'), []);
    assert.deepEqual(hits(['Ann'], 'Planning an announcement'), []);
});
await test('로마자 이름 자체 · 소유 · 끝 s · 한글 조사는 걸려요', () => {
    assert.deepEqual(hits(['Eve'], "Eve said. Eve's cup. Eves. eve!"), ['Eve', 'Eve', 'Eve', 'eve']);
    assert.deepEqual(hits(['Eve'], 'Eve와 Eve가 「Eve」'), ['Eve', 'Eve', 'Eve']);
    assert.deepEqual(hits(['Mira Joon'], 'Mira Joon came'), ['Mira Joon']);
});
await test('한글 이름은 예전처럼 낱말 속에서도 걸려요(조사 · 붙여 쓴 말)', () => {
    assert.deepEqual(hits(['하루'], '하루와 하루가 오늘하루'), ['하루', '하루', '하루']);
});
await test('긴 이름 먼저 · 대소문자 무시 · 특수 글자 이스케이프', () => {
    assert.deepEqual(hits(['Ann', 'Anna'], 'Anna and ANN'), ['Anna', 'ANN']);
    assert.deepEqual(hits(['R.J.'], 'R.J. RxJx'), ['R.J.']);
});
await test('빈 목록 · 빈 이름은 null', () => {
    assert.equal(namePattern([]), null);
    assert.equal(namePattern(['', '  ']), null);
});

await test('로그 복사 transformLog: 「Eve」 를 가려도 Every · evening 은 그대로', () => {
    const model = { chatName: 'Eve', userName: 'Joon', base: { bg: '#fff' }, messages: [{ index: 0, user: false, name: 'Eve', nodes: [{ t: 'text', text: 'Every evening Eve said: never.' }] }] };
    const out = transformLog(model, { hide: { names: ['Eve'], mask: 'auto', word: '○○' } });
    const text = out.model.messages[0].nodes.map(n => n.text ?? n.children?.map(c => c.text).join('') ?? '').join('');
    assert.equal(text, 'Every evening ○○ said: never.');
    assert.ok(out.hidden >= 1);
});

await test('채팅 캡처 가리기도 같은 찾기 틀을 써요', () => {
    const src = fs.readFileSync(path.join(root, 'src/capture-privacy.js'), 'utf8');
    assert.match(src, /namePattern\(/);
    assert.doesNotMatch(src, /new RegExp\(list\.map/);
});

done();
