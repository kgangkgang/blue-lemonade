// 단어 치환 › 잠시 가리기 (6.0.4, src/wordmask.js) — 순수 함수 maskPlan · parseMaskWords 와 설정 정리(wordTools.maskWords) 검사. DOM · 네트워크 없음.
//   node tools/tests/wordmask.mjs <테마 루트>   (공개 저장소는 '.', 개발본은 'salty-ext')
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], characterId: 0, saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
const { DEFAULTS, getSettings } = await import(pathToFileURL(path.join(root, 'src/settings.js')));
const M = await import(pathToFileURL(path.join(root, 'src/wordmask.js')));
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`PASS ${name}`); };
const join = plan => plan.map(p => (p.masked ? p.orig : p.text)).join('');
const shown = plan => plan.map(p => p.text).join('');

test('목록: 줄 · 쉼표로 나누고 빈 것 · 중복(대소문자 무시)을 빼고 긴 것부터 · 2000자 · 200개까지', () => {
    assert.deepEqual(M.parseMaskWords('세라, 세라피나\n\n lemon ,Lemon,,세라'), ['lemon', '세라피나', '세라']); // 코드 유닛 길이 순: lemon 5 · 세라피나 4
    assert.deepEqual(M.parseMaskWords(''), []);
    assert.deepEqual(M.parseMaskWords(null), []);
    assert.equal(M.parseMaskWords('가'.repeat(5000))[0].length, 2000);
    assert.equal(M.parseMaskWords(Array.from({ length: 300 }, (_, i) => 'w' + i).join('\n')).length, 200);
});
test('가리기: 낱말 글자 수만큼 ■ (최대 4) · 원문은 orig 에 · 조각을 이으면 원문 그대로', () => {
    const plan = M.maskPlan('세라피나가 웃었다. Lemon!', ['세라피나', 'lemon']);
    assert.deepEqual(plan, [
        { text: '■■■■', masked: true, orig: '세라피나' }, { text: '가 웃었다. ', masked: false },
        { text: '■■■■', masked: true, orig: 'Lemon' }, { text: '!', masked: false },
    ]);
    assert.equal(join(plan), '세라피나가 웃었다. Lemon!');
    assert.equal(shown(M.maskPlan('나기', ['나기'])), '■■');
    assert.equal(shown(M.maskPlan('가나다라마바사', ['가나다라마바사'])), '■■■■');
    assert.equal(shown(M.maskPlan('A', ['a'])), '■');
});
test('대소문자 무시 · 단순 부분 일치(조사 · 다른 낱말 속도 잡음) · 겹치면 긴 낱말이 먼저', () => {
    assert.equal(shown(M.maskPlan('LEMON lemon LeMoN', ['lemon'])), '■■■■ ■■■■ ■■■■');
    assert.equal(shown(M.maskPlan('세라피나는 세라를 불렀다', ['세라', '세라피나'])), '■■■■는 ■■를 불렀다');
    assert.equal(shown(M.maskPlan('블루레몬에이드', ['레몬'])), '블루■■에이드');
    assert.deepEqual(M.maskPlan('세라피나는 세라를 불렀다', ['세라', '세라피나']).filter(p => p.masked).map(p => p.orig), ['세라피나', '세라']);
    assert.equal(shown(M.maskPlan('세라피나', '세라피나\n세라')), '■■■■', '목록 글을 그대로 넘겨도 된다');
});
test('빈 목록 · 안 맞는 글 · 빈 글은 조각 하나 그대로', () => {
    assert.deepEqual(M.maskPlan('그대로', []), [{ text: '그대로', masked: false }]);
    assert.deepEqual(M.maskPlan('그대로', ['없음']), [{ text: '그대로', masked: false }]);
    assert.deepEqual(M.maskPlan('', ['x']), [{ text: '', masked: false }]);
    assert.deepEqual(M.maskPlan('abc', ['', '  ']), [{ text: 'abc', masked: false }]);
    assert.deepEqual(M.maskPlan(null, ['x']), [{ text: '', masked: false }]);
});
test('이모지 · 소문자화로 길이가 바뀌는 글자 사이에서도 자리가 어긋나지 않는다', () => {
    const plan = M.maskPlan('😀세라피나😀 İstanbul 세라피나', ['세라피나', 'istanbul']);
    assert.equal(join(plan), '😀세라피나😀 İstanbul 세라피나');
    assert.equal(shown(plan), '😀■■■■😀 İstanbul ■■■■'); // İ 는 소문자화하면 글자 수가 바뀌어 그대로 둔다 → istanbul 과 다른 글자로 본다
    assert.equal(shown(M.maskPlan('a😀b', ['😀'])), 'a■b');
});
test('DOM 없이 불러도 안전: 스위치는 꺼져 있고 start/stop 은 0', () => {
    assert.equal(M.isMasking(), false);
    assert.equal(M.stopMask(), 0);
    assert.equal(M.startMask(['x']), 0);
    assert.equal(M.isMasking(), false);
    assert.doesNotThrow(() => M.syncWordMask(false));
});
test('설정: 기본 maskWords 는 빈 글 · 스위치는 설정에 없음 · 2000자로 자르고 글이 아니면 비움', () => {
    assert.equal(DEFAULTS.wordTools.maskWords, '');
    assert.equal('maskOn' in DEFAULTS.wordTools, false);
    ctx.extensionSettings.salty = { wordTools: { maskWords: 'x'.repeat(2500) } };
    assert.equal(getSettings().wordTools.maskWords.length, 2000);
    ctx.extensionSettings.salty = { wordTools: { maskWords: 42 } };
    assert.equal(getSettings().wordTools.maskWords, '');
    ctx.extensionSettings.salty = { wordTools: { maskWords: '세라\n나기' } };
    assert.equal(getSettings().wordTools.maskWords, '세라\n나기');
    ctx.extensionSettings.salty = {};
    assert.equal(getSettings().wordTools.maskWords, '');
});
console.log(`wordmask: ${passed} passed`);
