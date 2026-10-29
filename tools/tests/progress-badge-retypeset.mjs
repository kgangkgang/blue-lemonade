// 8.2.7 폰 예측점검(hunt-mobile) · 가볍게: 번역 진행 표시(.llmt-progress, src/addons/translator/index.js progressBadge)는 번역하는 동안 1초마다 글(초 · 문단 수)을 새로 써요.
// 그 표시는 메시지 글 칸(.mes_text) 안이라, 조판 감시(src/typography.js)는 그때마다 메시지 전체를 dirty 로 잡아 그 자리에서 그림 옆 표시 · <style> 뒤 빈 줄 · 색 글자 훅을 돌리고
// 0.12초 뒤 메시지 전체를 다시 조판했어요(대사마다 계산 스타일 읽기). 글자 맞춤(src/tone.js)도 0.4초 뒤 메시지 전체를 다시 칠했어요 — 긴 답을 번역하는 30~60초 내내 1초마다.
// 진행 표시 안에는 조판 · 맞춤할 것(대사 · 그림 · 색 글자 · 한자 줄)이 없어 결과가 같아요.
// 고친 뒤: 진행 표시 안에서만 일어난 변화는 건너뛰어요. 표시를 붙이고 떼는 변화(.mes_text 의 자식 목록)는 지금처럼 봐요.
//   node tools/tests/progress-badge-retypeset.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };
// 작은 문서: #chat > .mes > .mes_text > .llmt-progress
const el = (cls, parent = null) => ({ nodeType: 1, cls, parentElement: parent, isConnected: true, classList: { contains: c => c === cls }, querySelectorAll: () => [], matches: () => false,
    closest(sel) { for (let e = this; e; e = e.parentElement) if (sel.split(',').some(s => s.trim() === '.' + e.cls || (s.trim() === '#chat' && e.cls === 'chat'))) return e; return null; } });
const chat = el('chat'), mes = el('mes', chat), text = el('mes_text', mes), badge = el('llmt-progress', text);
let observed = null;
globalThis.MutationObserver = class { constructor(cb) { observed = cb; } observe() {} disconnect() {} takeRecords() { return []; } };
globalThis.document = { body: { dataset: {}, classList: { contains: c => c === 'salty-tone' } }, getElementById: id => (id === 'chat' ? chat : null), querySelectorAll: () => [], addEventListener() {}, createTreeWalker: () => ({ nextNode: () => null }) };
const timers = []; globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; globalThis.clearTimeout = () => {};
globalThis.performance ??= { now: () => 0 };
const typo = await import(pathToFileURL(path.join(root, 'src/typography.js')));
const hooked = []; typo.setTypesetHook(roots => hooked.push(roots));
typo.syncTypography(true);
const typoObserver = observed;
test('조판: 진행 표시의 글이 바뀐 기록은 메시지를 다시 조판하지 않아요 (고치기 전: 메시지 전체 dirty → 훅 · 0.12초 뒤 조판)', () => {
    hooked.length = 0;
    typoObserver([{ type: 'childList', target: badge, addedNodes: [], removedNodes: [] }, { type: 'characterData', target: { nodeType: 3, parentElement: badge }, addedNodes: [] }]);
    assert.ok(hooked.every(list => !list.includes(mes)), '색 글자 훅에 메시지가 오지 않아요');
});
test('조판: 진행 표시를 붙이는 기록(.mes_text 자식 목록) · 메시지 글 변화는 지금처럼 봐요', () => {
    hooked.length = 0;
    typoObserver([{ type: 'childList', target: text, addedNodes: [badge], removedNodes: [] }]);
    assert.ok(hooked.some(list => list.includes(mes)));
});
// 글자 맞춤(tone.js): 0.4초 묶음 타이머가 걸리는지로 봐요
observed = null; timers.length = 0;
globalThis.SillyTavern ??= { getContext: () => ({ extensionSettings: {}, saveSettingsDebounced() {} }) };   // 설정 읽기(켜짐 판정)만 — 처음 칠하기는 꺼짐으로 끝나요
const tone = await import(pathToFileURL(path.join(root, 'src/tone.js')));
tone.startInlineTone();
const toneObserver = observed;
test('글자 맞춤: 진행 표시 안의 변화는 다시 칠하지 않아요 (고치기 전: 0.4초 뒤 메시지 다시 칠하기)', () => {
    assert.equal(typeof toneObserver, 'function');
    timers.length = 0;
    toneObserver([{ type: 'childList', target: badge, addedNodes: [] }, { type: 'characterData', target: { nodeType: 3, parentElement: badge }, addedNodes: [] }]);
    assert.equal(timers.filter(t => t.ms === 400).length, 0);
    toneObserver([{ type: 'childList', target: text, addedNodes: [] }]);
    assert.equal(timers.filter(t => t.ms === 400).length, 1, '메시지 글 변화는 지금처럼');
});
assert.ok(read('.github/workflows/release-check.yml').includes('node tools/tests/progress-badge-retypeset.mjs .'), 'release-check.yml 에 등록');
console.log(`번역 진행 표시 · 다시 조판 줄이기: ${pass}개 통과했어요.`);
