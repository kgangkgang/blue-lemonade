// 1.1.1 가볍게: 마크다운 모양 규칙 떼어 두기 → 1.1.6 tools/css-gates.cjs 의 md 시트로 합쳤어요(src/lite.js syncGateCss · src/gate-css.js)
//   body.salty.salty-md-*(고른 마크다운 모양)가 있어야만 맞는 규칙은 첫 장(style.css)과 전체 장(style-lazy.gen.css) 둘 다에서 빼 src/markdown.gen.css 로 —
//   기본값(고른 모양 없음)이면 받지 않아요. 고르면 테마 시트 뒤 줄(전체 장 뒤)에 붙고, 클래스는 시트를 받은 뒤에 달아요.
//   뒤 규칙과 덮어쓰기를 겨루는 규칙은 떼지 않고 제자리에 둬요 — 차례 확인은 tools/tests/css-gates-order.mjs 가 규칙마다 해요.
//   node tools/tests/markdown-css-split.mjs [테마 뿌리]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(process.argv[2] || '.');
const require = createRequire(path.join(root, 'tools/'));
const lib = require(path.join(root, 'tools/css-lib.cjs'));
const B = require(path.join(root, 'tools/build-css.cjs'));
const G = require(path.join(root, 'tools/css-gates.cjs'));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 8).join('\n       ')); } };

const out = B.build(B.CSS_DIR);
const md = read('src/markdown.gen.css'), style = read('style.css'), full = read('src/style-lazy.gen.css');
const rulesOf = text => lib.flatRules(lib.parse(text));
const gatedRule = r => lib.topSplit(r.selector).every(B.markdownGated);
const mdRules = rulesOf(md);
const kept = new Set(out.gates.kept.map(k => k.selector));

test('마크다운 시트는 고른 모양 규칙만 · 첫 장 · 전체 장에는 차례 때문에 남긴 것 말고는 없어요', () => {
    assert.ok(mdRules.length >= 60, `떼어 낸 규칙 ${mdRules.length}개`);
    assert.ok(mdRules.every(gatedRule), '떼어 낸 규칙은 모두 body.salty.salty-md-* 를 요구해요');
    for (const [name, text] of [['style.css', style], ['style-lazy.gen.css', full]]) {
        const left = rulesOf(text).filter(r => gatedRule(r) && !kept.has(r.selector));
        assert.deepEqual(left.map(r => r.selector.slice(0, 80)), [], `${name} 에 남은 고른 모양 규칙`);
    }
    assert.equal(md, out.gateFiles['src/markdown.gen.css']);
});

test('기본값(고른 모양 없음)에서는 떼어 낸 규칙이 하나도 맞지 않아요 — 기본값은 body 에 salty-md-* 를 달지 않아요', () => {
    assert.match(read('src/markdown.js'), /selected !== options\[0\]\[0\]/);
    for (const r of mdRules) for (const sel of lib.topSplit(r.selector)) assert.match(sel, /^body\.salty(?:[.:][\w-]+|\([^)]*\))*\.salty-md-[\w-]+/, sel.slice(0, 80));
});

test('옛 떼는 함수(markdownSplit)는 비교용으로 그대로 — 칸이 없으면 그대로', () => {
    assert.deepEqual(B.markdownSplit('a{}'), { text: 'a{}', md: '', rules: 0 });
    const sample = '/* css/60-x.css */\nb{c:d}\n/* css/61-markdown.css */\nbody.salty.salty-md-size-small h1 {e:f}\n.bl-markdown-stage x {g:h}\n/* css/62-y.css */\ni{j:k}\n';
    const o = B.markdownSplit(sample);
    assert.equal(o.rules, 1);
    assert.equal(o.md, 'body.salty.salty-md-size-small h1 {e:f}');
    // 새 기준도 같은 규칙을 골라요(요소 클래스 .salty-md-i 같은 것은 body 칸이 아니라 안 골라요)
    const cfg = G.loadConfig(path.join(root, 'tools/css-gates.json'));
    assert.deepEqual([...G.ruleTriggers('body.salty.salty-md-size-small h1', cfg.eligible)], ['salty-md-size-small']);
    assert.equal(G.ruleTriggers('.salty-md-i', cfg.eligible), null);
    assert.equal(G.ruleTriggers('body.salty .mes .salty-md-mark', cfg.eligible), null);
});

test('붙이는 코드: 고른 모양이 있을 때만 · 클래스보다 먼저 · 전체 장이 켜져도 켜 둬요', () => {
    const lite = read('src/lite.js'), apply = read('src/apply.js'), sheet = read('src/theme-sheet.js'), table = read('src/css-gates.gen.js');
    assert.match(apply, /const held = syncGateCss\(want\);/);
    assert.match(table, /"id":"md","file":".\/markdown\.gen\.css","prefixes":\["salty-md-"\]/);
    assert.match(lite, /export function syncGateCss\(want\)/);
    assert.doesNotMatch(sheet, /setMarkdown/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/markdown-css-split\.mjs \./);
});

console.log(`markdown-css-split: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
