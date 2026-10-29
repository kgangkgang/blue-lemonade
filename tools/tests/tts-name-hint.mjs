// TTS 이름표 화자 힌트 — src/addons/tts/src/text.js segmentMessage · linePrefixName (clickplay.js 누른 대사도 같은 함수)
//   1) 태그의 character="이름 성" 은 띄어 쓴 이름 전체 (전엔 첫 낱말만 — 「Mina」 로 잘려 「Mina Park」 목소리를 못 찾았다)
//   2) 「[렉스]: "…"」 · 「【렉스】: "…"」 처럼 괄호로 감싼 이름표는 괄호를 뺀 이름 (전엔 「[렉스]」 라는 모르는 이름)
//   3) 「Mina Park: "…"」 처럼 띄어 쓴 이름표는 아는 이름일 때만 (전엔 힌트 없음). 모르는 여러 낱말(「그때 그녀는:」)은 그대로 힌트 없음
//   기존: 「렉스: "…"」 · 「**렉스**: "…"」 · 「렉스「…」」(아는 이름) 은 그대로.
//   인물 · 문장은 지어낸 것. 네트워크 없음.  node tools/tests/tts-name-hint.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const theme = path.resolve(process.argv[2] || '.');
const root = path.join(theme, 'src/addons/tts/src');
const T = await import(pathToFileURL(path.join(root, 'text.js')).href);

const KNOWN = ['Mina Park', '미나', '렉스'];
const hints = (raw, knownNames = KNOWN) => T.segmentMessage(raw, { knownNames, userName: '하람', charName: '미나' })
    .filter(s => s.kind === 'dialogue').map(s => s.speakerHint);

let n = 0;
const t = (name, fn) => { fn(); n++; console.log(`  PASS  ${name}`); };

t('character="Mina Park" 은 띄어 쓴 이름 전체', () => {
    assert.deepEqual(hints('<span character="Mina Park" style="color:#ff0000">"안녕"</span>'), ['Mina Park']);
    assert.deepEqual(hints("<span character='Mina Park'>\"안녕\"</span>"), ['Mina Park']);
});
t('character=렉스 (따옴표 없음) · character="렉스" 는 그대로', () => {
    assert.deepEqual(hints('<span character=렉스>"안녕"</span>'), ['렉스']);
    assert.deepEqual(hints('<span character="렉스" style="color:#ff0000">"안녕"</span>'), ['렉스']);
});
t('빈 character="" 는 힌트 없음', () => {
    assert.deepEqual(hints('<span character="">"안녕"</span>'), [null]);
});
t('[렉스]: · 【렉스】: 는 괄호를 뺀 이름', () => {
    assert.deepEqual(hints('[렉스]: "안녕"'), ['렉스']);
    assert.deepEqual(hints('【렉스】: "안녕"'), ['렉스']);
    assert.deepEqual(hints('**[렉스]**: "안녕"'), ['렉스']);
});
t('띄어 쓴 아는 이름표 Mina Park: 는 그 이름', () => {
    assert.deepEqual(hints('Mina Park: "안녕"'), ['Mina Park']);
    assert.deepEqual(hints('**Mina Park**: "안녕"'), ['Mina Park']);
});
t('모르는 여러 낱말 이름표는 힌트 없음 (아는 이름이 없어도)', () => {
    assert.deepEqual(hints('그때 그녀는: "안녕"'), [null]);
    assert.deepEqual(hints('그때 그녀는: "안녕"', []), [null]);
});
t('기존 이름표는 그대로: 렉스: · **렉스**: · 렉스「…」 · 모르는 이름「…」 는 힌트 없음', () => {
    assert.deepEqual(hints('렉스: "안녕"'), ['렉스']);
    assert.deepEqual(hints('**렉스**: "안녕"'), ['렉스']);
    assert.deepEqual(hints('렉스「안녕」'), ['렉스']);
    assert.deepEqual(hints('누구「안녕」'), [null]);
    assert.deepEqual(hints('모르는이: "안녕"'), ['모르는이']);
});
t('linePrefixName 은 내보내고, 누른 대사(clickplay.js)도 같은 함수를 써요', () => {
    assert.equal(typeof T.linePrefixName, 'function');
    const strict = (x) => KNOWN.map(k => k.toLowerCase().replace(/\s+/g, '')).includes(String(x).toLowerCase().replace(/\s+/g, ''));
    assert.equal(T.linePrefixName('[렉스]: ', '"', strict, strict), '렉스');
    assert.equal(T.linePrefixName('Mina Park: ', '"', strict, strict), 'Mina Park');
    assert.equal(T.linePrefixName('렉스', '「', strict, strict), '렉스');
    assert.equal(T.linePrefixName('렉스', '"', strict, strict), null);
    const cp = fs.readFileSync(path.join(root, 'clickplay.js'), 'utf8');
    assert.match(cp, /linePrefixName\(/, 'clickplay.js prefixHint 가 linePrefixName 을 불러요');
});

console.log(`\nTTS 이름표 화자 힌트: ${n}개 통과`);
