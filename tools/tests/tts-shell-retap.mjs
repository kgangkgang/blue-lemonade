// TTS 껍데기(src/addons/tts/shell.js)가 본체를 받은 뒤 「처음 누른 대사」를 다시 눌러 줄 때, 본체(src/clickplay.js onClick)가 그 click 을 받는지.
//   본체는 한 번 누름(detail === 1)만 받아요. 1.5.8 까지 껍데기가 만든 click 은 detail 이 0(기본값)이라 늘 버려져,
//   새로고침 뒤 처음 누른 대사는 소리가 안 나고 한 번 더 눌러야 했어요.
//   두 파일의 실제 줄을 떼어 서로 맞는지 봐요.
//   node tools/tests/tts-shell-retap.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

const shellLine = read('src/addons/tts/shell.js').split('\n').find(l => l.includes("tap.target.dispatchEvent(new MouseEvent('click'"));
assert.ok(shellLine, '껍데기의 다시 누르기 줄을 찾아요');
const guardLine = read('src/addons/tts/src/clickplay.js').split('\n').find(l => l.includes('e.defaultPrevented || e.button !== 0 || e.detail'));
assert.ok(guardLine, '본체의 누름 가르기 줄을 찾아요');

// 브라우저 MouseEvent 의 기본값 그대로: detail 0 · button 0 · 꾸밈 키 없음
class MouseEvent { constructor(type, init = {}) { Object.assign(this, { type, detail: 0, button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, defaultPrevented: false }, init); } }
const sent = [];
new Function('tap', 'MouseEvent', 'window', shellLine)({ target: { dispatchEvent: e => sent.push(e) }, x: 12, y: 34 }, MouseEvent, {});
const rejected = e => new Function('e', `${guardLine.trim()} return false;`.replace(') return;', ') return true;'))(e);

test('껍데기가 다시 눌러 주는 click 은 한 번 누름(detail 1) · 누른 자리 그대로', () => {
    assert.equal(sent.length, 1);
    assert.equal(sent[0].detail, 1); assert.equal(sent[0].clientX, 12); assert.equal(sent[0].clientY, 34); assert.equal(sent[0].bubbles, true);
});
test('본체가 그 click 을 받아요 (고치기 전: detail 0 이라 버림)', () => {
    assert.equal(rejected(sent[0]), false);
    assert.equal(rejected(new MouseEvent('click')), true, '기본값(detail 0) click 은 본체가 버려요 — 그래서 껍데기가 detail 을 줘야 해요');
    assert.equal(rejected(new MouseEvent('click', { detail: 2 })), true, '두 번 누름은 전처럼 버려요');
});
console.log(`tts-shell-retap: ${passed} passed`);
