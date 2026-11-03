// 1.0.0 극한 최적화: :has() 앞 지킴 — 뜻 · 특이도를 바꾸지 않고, 앞 칸이 안 맞으면 :has() 를 견주지 않게 달렸는지 봐요
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const { guardHas, guardPart } = require('../css-has-guard.cjs');
const test = (name, fn) => { fn(); console.log(`ok - ${name}`); };
const stats = () => ({ guarded: 0, skipped: 0 });

test('맨 오른쪽 칸 앞에 앞 칸들을 :where 로 달아요', () => {
    assert.equal(guardPart('body.salty #x > :where(:not(.a)):has(> i)', stats()), 'body.salty #x > :where(:not(.a)):where(body.salty #x > *):has(> i)');
    assert.equal(guardPart('body.salty #x p:not(:has(q))', stats()), 'body.salty #x p:where(body.salty #x p):not(:has(q))');
    assert.equal(guardPart('body.salty #x p.k:not(.z):has(q)', stats()), 'body.salty #x p.k:not(.z):where(body.salty #x p.k):has(q)', ':has 바로 앞에');
    assert.equal(guardPart('body.salty :has(> i)', stats()), 'body.salty :has(> i)', '앞 칸이 뿌리뿐이면 그대로');
    assert.equal(guardPart('.a + .b:has(i)', stats()), '.a + .b:where(.a + .b):has(i)');
});
test('첫 칸의 :has · 앞 칸에 :has 가 있는 갈래 · :has 없는 갈래는 그대로예요', () => {
    assert.equal(guardPart('.a:has(i) .b', stats()), '.a:has(i) .b');
    assert.equal(guardPart('.a:has(i) .b:has(q)', stats()), '.a:has(i) .b:has(q)');
    assert.equal(guardPart('.a .b', stats()), '.a .b');
});
test('규칙 글: 조건 묶음 안까지 · 선언 · 다른 규칙은 그대로', () => {
    const css = '/* c */\n.x { color: red }\n@media (min-width: 1px) {\n.a .b:has(i), .c { top: 0 }\n}\n';
    const { text, stats: s } = guardHas(css);
    assert.equal(s.guarded, 1);
    assert.ok(text.includes('.a .b:where(.a .b):has(i), .c {'), text);
    assert.ok(text.includes('.x { color: red }'));
});
test('style.css: 주어 칸이 앞 칸 뒤에 있는 :has 는 모두 지킴이 있어요(긴 앞 칸 제외 몇 개 안쪽)', () => {
    const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
    const again = guardHas(css);
    assert.ok(again.stats.guarded < 25, `지킴 없는 :has ${again.stats.guarded}`);
    assert.ok((css.match(/:where\([^{}]{1,330}\)/g) || []).length > 40);
});
