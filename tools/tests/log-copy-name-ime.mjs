// 버그 사냥 6차 — 로그 복사 「이름 숨김」 의 가릴 이름 칸(src/log-copy-sheet.js)에서 한글 조합 중 Enter
//   칸의 Enter 는 「더하기」 를 눌러 이름을 넣고 칸을 비워요. 조합 중 Enter(isComposing · keyCode 229)까지 받아,
//   「하루」 를 친 뒤 바로 Enter 를 누르면 조합 중에 칸을 비우고 — 크롬은 조합 끝 글자(「루」)를 빈 칸에 다시 넣거나, 맥에서는 뒤따르는 두 번째 Enter 로 「루」 를 이름으로 또 넣었어요.
//   이제 조합 중 Enter 는 조합만 끝내요(다른 칸들 · selects.js 8.2.7 과 같은 규칙).
//   node tools/tests/log-copy-name-ime.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const source = fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8');
// 이름 칸 Enter 를 받는 keydown 리스너 몸통을 잘라 돌려요
const at = source.indexOf("event.target.matches?.('[data-lc-name-input]')");
assert.ok(at > 0, '이름 칸 Enter 처리가 있어요');
const start = source.lastIndexOf("dialog.addEventListener('keydown', (event) => {", at);
const end = source.indexOf('\n    });', at);
assert.ok(start > 0 && end > at, '리스너 몸통을 찾았어요');
const body = source.slice(start + "dialog.addEventListener('keydown', (event) => {".length, end);
const handler = new Function('$', `return (event) => {${body}\n};`);
let clicks = 0;
const run = handler(sel => (sel === '[data-lc="name-add"]' ? { click() { clicks++; } } : null));
const input = { matches: sel => sel === '[data-lc-name-input]' };
const key = init => { const e = { key: 'Enter', target: input, isComposing: false, keyCode: 13, prevented: false, preventDefault() { this.prevented = true; }, ...init }; run(e); return e; };

key({ isComposing: true, keyCode: 229 });
assert.equal(clicks, 0, '조합 중 Enter(isComposing) 는 이름을 넣지 않아요');
key({ isComposing: false, keyCode: 229 });
assert.equal(clicks, 0, '조합 중 Enter(keyCode 229 · isComposing 없는 브라우저) 도 넣지 않아요');
const plain = key({});
assert.equal(clicks, 1, '조합이 끝난 Enter 는 이름을 넣어요');
assert.ok(plain.prevented, '그때 기본 동작(폼 보내기)은 막아요');
console.log('log-copy-name-ime: 3 통과');
