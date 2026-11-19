// 버그 사냥 7(1.8.7) 가운뎃점으로 이은 영문 덩어리 줄바꿈 자리(src/typography.js dotPieces · wrapDotRuns) — 지어낸 글.
//   node tools/tests/dot-run-wrap.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   양쪽 정렬에서 「《L·E·M·O·N》」 같은 덩어리가 통째로 다음 줄로 넘어가 앞 줄 낱말 사이가 크게 벌어졌어요 → 점 뒤마다 <wbr> · 글(textContent)은 그대로.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const dom = new JSDOM('<!doctype html><body></body>');
globalThis.document = dom.window.document; globalThis.NodeFilter = dom.window.NodeFilter;
const T = await import(pathToFileURL(path.join(root, 'src/typography.js')).href);
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
check('조각: 넷 이상 이은 것만 · 글은 그대로', () => {
    const line = '작게 새겨진 《L·E·M·O·N·A·D·E》 명판이 빛났다.';
    const p = T.dotPieces(line);
    assert.deepEqual(p.filter(x => x.dot).map(x => x.text), ['L·E·M·O·N·A·D·E']);
    assert.equal(p.map(x => x.text).join(''), line);
    for (const s of ['A·B', '1·2·3', '그·그녀', '오전·오후 · 저녁', '그냥 문장이다.']) assert.ok(!T.dotPieces(s).some(x => x.dot), s);
    assert.ok(T.dotPieces('S・O・S・X').some(x => x.dot), '일본 가운뎃점');
});
check('DOM: 점 뒤마다 <wbr> · textContent 그대로 · 강조 span 안 · 두 번 해도 같아요 · pre/code 는 그대로', () => {
    const d = dom.window.document;
    d.body.innerHTML = '<div class="mes_text"><p>내려다보며 서 있었다. 작게 새겨진 <strong>《L·E·M·O·N·A·D·E》</strong> 명판이</p><pre>X·Y·Z·W</pre></div>';
    const host = d.querySelector('.mes_text'), before = host.textContent;
    T.wrapDotRuns(host);
    const span = host.querySelector('strong .' + T.DOT_WRAP);
    assert.ok(span, '감쌈');
    assert.equal(span.querySelectorAll('wbr').length, 7, '점 뒤 일곱 자리');
    assert.equal(host.textContent, before, '글 그대로');
    assert.equal(host.querySelector('pre').innerHTML, 'X·Y·Z·W', 'pre 그대로');
    T.wrapDotRuns(host);
    assert.equal(host.querySelectorAll('.' + T.DOT_WRAP).length, 1, '두 번 해도 하나');
});
check('잇기: 조판 끝에 · 조판을 끄면 걷어요 · CI', () => {
    const src = fs.readFileSync(path.join(root, 'src/typography.js'), 'utf8');
    assert.match(src, /roots\.forEach\(wrapCjkRuns\);[^\n]*\n\s+roots\.forEach\(wrapDotRuns\);/);
    assert.match(src, /querySelectorAll\(`\.\$\{DOT_WRAP\}`\)\.forEach/);
    assert.ok(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8').includes('node tools/tests/dot-run-wrap.mjs . tools'));
});
console.log(`dot-run-wrap: ${passed} 통과`);
