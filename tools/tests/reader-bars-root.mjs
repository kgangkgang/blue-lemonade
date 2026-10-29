// 8.2.7 perf-fade: 몰입 읽기(src/reader.js)의 「바 숨김」 표식 bl-bars-hidden 은 body 가 아니라 html 에 달아요 —
//   body class 를 바꾸면 기록마다 실리태번 keyboard.js 가 body 아래 전부를 선택자 31개로 다시 훑었어요(폰 4배 · 채팅을 내리고 올릴 때마다 140~240ms).
//   CSS(css/29-reader-onehand.css · style.css)도 html 표식을 봐요. 모양은 같아요.
//   node tools/tests/reader-bars-root.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };
const js = read('src/reader.js'), css = read('css/29-reader-onehand.css'), built = read('style.css');

test('reader.js: 바 숨김 표식을 html(root)에서 붙이고 · 떼고 · 읽어요 — body 에는 안 써요', () => {
    for (const op of ['contains', 'add', 'remove']) assert.match(js, new RegExp(`root\\.classList\\.${op}\\('bl-bars-hidden'\\)`), op);
    assert.doesNotMatch(js, /body\.classList\.(add|remove|toggle|contains)\('bl-bars-hidden'\)/);
});
test('CSS: 바 숨김 네 규칙(위 바 · 입력판 · TTS 막대 · 바뀜 띠)은 html.bl-bars-hidden 아래 — body 표식 규칙은 원본 · style.css 모두 없어요', () => {
    for (const tail of [':is(#top-bar, #top-settings-holder)', '#form_sheld', '.lv-bar', '#bl-sync-strip']) assert.ok(css.includes(`html.bl-bars-hidden body.salty.bl-reader ${tail} {`), tail);
    for (const text of [css, built]) assert.doesNotMatch(text, /\.bl-reader\.bl-bars-hidden/);
    assert.ok(built.includes('html.bl-bars-hidden body.salty.bl-reader'));
});
test('CI 등록', () => assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/reader-bars-root\.mjs \./));
console.log(`\n${passed} passed`);
