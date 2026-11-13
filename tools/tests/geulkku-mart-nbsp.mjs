// 1.2.1 결함 고침 — 받은 글꾸의 고친 글에 「&nbsp;」 글자가 보이던 것(11-12 밤 사용자가 깡통에 올린 글 · 마트 고침 ce06d4f8b 와 같은 규칙)
//   마트 「글 고치기」에서 꾸민 낱말 사이를 띄우면 contenteditable 이 &nbsp; 를 넣어요. 테마 사본 cleanRich(src/geulkku-mart/tune.js)가
//   그것을 &amp;nbsp; 로 이스케이프해 받은 글꾸를 그리면 「&nbsp;」가 글자로 보였어요. 이제 끊기지 않는 빈칸 네 꼴은 보통 빈칸이에요.
//   고정물: tools/tests/fixtures/geulkku-nbsp-1112.json(사용자 글에서 본 꼴 — 이름은 뺐어요)
//   node tools/tests/geulkku-mart-nbsp.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const fx = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/geulkku-nbsp-1112.json'), 'utf8'));
let passed = 0, failed = 0;
async function test(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }

const tune = await load('src/geulkku-mart/tune.js');

await test('cleanRich: &nbsp; · &#160; · &#xA0; · U+00A0 → 보통 빈칸 · 다른 엔티티는 두 번 이스케이프하지 않아요', () => {
    for (const [input, want] of fx.rich) assert.equal(tune.cleanRich(input), want, JSON.stringify(input));
    assert.ok(!tune.cleanRich(fx.rich[0][0]).includes('nbsp'), '「nbsp」 글자가 남았어요');
});

await test('cleanRich: 두 번 걸어도 같아요', () => {
    for (const v of [...fx.rich.map(r => r[0]), 'A &amp;amp; B', '&amp;nbsp;']) assert.equal(tune.cleanRich(tune.cleanRich(v)), tune.cleanRich(v), v);
});

await test('받은 글꾸 그리기(applySet): 고친 글 칸에 &amp;nbsp; · &nbsp; · U+00A0 이 안 남아요', async () => {
    const { applySet } = await load('src/log-copy-simple-set.js');
    const html = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/fixtures/geulkku-set-mart.json'), 'utf8')).inputs[fx.frame];
    assert.ok(html, `${fx.frame} 입력이 없어요`);
    const nr = tune.editables(html).find(e => e.cls === 'gk-nr');
    assert.ok(nr, '지문 칸을 못 찾았어요');
    const set = JSON.parse(JSON.stringify(fx.set));
    const key = set.frame, texts = set.frames[key].texts;
    texts[nr.i] = texts.NR; delete texts.NR;
    const out = applySet(html, set, { mode: 'dark', key });
    assert.ok(out.includes(`>${fx.expect}</p>`), out.slice(out.indexOf('gk-nr'), out.indexOf('gk-nr') + 140));
    assert.ok(!/&amp;nbsp;|&nbsp;| /.test(out), '끊기지 않는 빈칸이 남았어요');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
