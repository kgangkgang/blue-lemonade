// 8.0.8: 규칙 바구니 열쇠(tools/css-key.cjs) — 열쇠 찾기 · 특이도 보존 · 멱등 · 빌드된 style.css 에 전체 바구니 갈래가 줄었는가
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const require = createRequire(import.meta.url);
const K = require(path.join(root, 'tools/css-key.cjs'));
const L = require(path.join(root, 'tools/css-lib.cjs'));

// 열쇠 찾기: 칸에 맞는 요소라면 반드시 가진 이름
assert.deepEqual(K.keysOf(':is(#chat,.bl-chat-like)'), ['#chat', '.bl-chat-like']);
assert.deepEqual(K.keysOf(':is(.a .b, .c)'), ['.b', '.c']);
assert.deepEqual(K.keysOf(':is(#toast-container > div)'), ['div']);
assert.deepEqual(K.keysOf(':where(.avatar img):is(#bl-s, *)'), ['img']);
assert.deepEqual(K.keysOf('span:is(#bl-s, *)'), ['span']);
assert.deepEqual(K.keysOf(':is(:is(#chat,.bl-chat-like), .cg-root)'), ['#chat', '.bl-chat-like', '.cg-root']);
assert.equal(K.keysOf('*:where(:not(.x))'), null, '* 는 열쇠 없음');
assert.equal(K.keysOf(':is(#bl-s, *)'), null, '특이도 보정만 있는 칸');
assert.equal(K.keysOf(':not(#salty-none)'), null, ':not 안은 안 봄');
assert.equal(K.keysOf(':has(> i)'), null, ':has 안은 안 봄');
assert.equal(K.keysOf(':is(em *)'), null);
// 바구니: 이름이 드러난 칸은 그대로
assert.equal(K.bucketOf('.mes'), 'class');
assert.equal(K.bucketOf(':where(#chat):is(#chat,.bl-chat-like)'), 'id');
assert.equal(K.bucketOf(':is(#chat,.bl-chat-like)'), 'universal');
assert.equal(K.bucketOf(':is(.a .b)'), 'universal');
assert.equal(K.bucketOf(':where(.a .b)'), 'universal');

// 갈래 하나: 특이도 그대로 · 열쇠를 떼면 원문
const stats = { universal: 0, keyed: 0, split: 0, noKey: 0, tooMany: 0 };
const one = K.keyOne('body.salty :is(#chat,.bl-chat-like):is(bl-s, *)', stats);
assert.deepEqual(one, ['body.salty :where(#chat):is(#chat,.bl-chat-like):is(bl-s, *)', 'body.salty :where(.bl-chat-like):is(#chat,.bl-chat-like):is(bl-s, *)']);
for (const n of one) assert.equal(L.spec(n).join('.'), L.spec('body.salty :is(#chat,.bl-chat-like):is(bl-s, *)').join('.'));
assert.equal(K.keyOne('body.salty .mes', stats), null, '이미 바구니에 든 갈래는 안 건드림');
assert.equal(K.keyOne('body.salty :where(#chat):is(#chat,.bl-chat-like)', stats), null, '열쇠가 있으면 안 건드림(멱등)');
assert.equal(K.keyOne('.a::before', stats), null);
assert.equal(K.keyOne('.a &', stats), null);

// 작은 시트: 규칙 수 · 선언 · @묶음 그대로, 두 번 돌려도 같음
const css = `/* a */\n.x :is(#chat,.bl-chat-like) { color: red; }\n@media (max-width: 500px) {\n  .y :is(.a .b) > :is(.c, .d .e) { margin: 0 }\n  .z :is(#bl-s, *) { padding: 0 }\n}\n.w::placeholder { color: blue }\n`;
const r1 = K.keyize(css);
assert.equal(r1.stats.rulesChanged, 2);
assert.ok(r1.text.includes('.x :where(#chat):is(#chat,.bl-chat-like),\n.x :where(.bl-chat-like):is(#chat,.bl-chat-like) {'), r1.text);
assert.ok(r1.text.includes('.y :where(.b):is(.a .b) > :where(.c):is(.c, .d .e),\n.y :where(.b):is(.a .b) > :where(.e):is(.c, .d .e) {'), r1.text);
assert.ok(r1.text.includes('.z :is(#bl-s, *) { padding: 0 }'), '열쇠 없는 칸은 그대로');
const r2 = K.keyize(r1.text);
assert.equal(r2.text, r1.text, '멱등');
assert.equal(r2.stats.keyed, 0);

// 빌드된 style.css: 다시 돌려도 그대로, 전체 바구니 갈래는 빌드 보고와 같게 줄어 있음
const built = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const again = K.keyize(built);
assert.equal(again.text, built, 'style.css 는 열쇠가 다 달려 있어야 함(멱등)');
assert.equal(again.stats.keyed, 0);
assert.ok(again.stats.universal < 200, `전체 바구니 갈래가 아직 ${again.stats.universal}개`);
assert.ok((built.match(/:where\(#chat\):is\(#chat,\.bl-chat-like\)/g) || []).length > 0, '#chat 바꿔 쓰기 갈래에 열쇠');
// css/ 원본은 손대지 않는다
const source = fs.readdirSync(path.join(root, 'css')).filter(n => n.endsWith('.css')).map(n => fs.readFileSync(path.join(root, 'css', n), 'utf8')).join('\n');
assert.ok(!/:where\(#chat\):is\(#chat,\.bl-chat-like\)/.test(source), '열쇠는 빌드에서만');
console.log(`css-key: style.css 전체 바구니 ${again.stats.universal}갈래 남음(열쇠 없음 ${again.stats.noKey})`);
