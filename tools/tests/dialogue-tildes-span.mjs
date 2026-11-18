// 버그 사냥 2(1.7.8 거리) — 줄을 넘는 대사(실리태번이 <q> 로 안 감싸는 대사) 안의 늘임표 「응~~~, 그래~~~!」 가 취소선으로 남던 것(jsdom).
//   대사 안인지를 <q> 조상으로만 봐서, 여러 줄 대사 · 섞인 따옴표 대사에서는 「~, 그래」 가 그어진 글(del)로 보였어요.
//   조판 차례(restoreDialogueTildes → wrapSpanningQuotes)를 두 번 돌려 봐요. 대사 밖 ~~지운 글~~ 은 그대로 del 이에요.
//   node tools/tests/dialogue-tildes-span.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const win = new JSDOM('<!doctype html><body></body>').window;
for (const k of ['document', 'Node', 'NodeFilter', 'HTMLElement', 'Element']) globalThis[k] = win[k];
const load = rel => import(pathToFileURL(path.join(root, rel)).href);
const { restoreDialogueTildes } = await load('src/dialogue-tildes.js');
const { wrapSpanningQuotes } = await load('src/dialogue-span.js');
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };

function run(html, raw) {
    const box = document.createElement('div'); box.className = 'mes_text'; box.innerHTML = html; document.body.append(box);
    for (let i = 0; i < 2; i++) { restoreDialogueTildes(box, { sourceText: raw }); wrapSpanningQuotes(box); }   // 조판 두 차례
    const out = { dels: box.querySelectorAll('del').length, tildes: box.querySelectorAll('span.bl-dialogue-tildes').length, text: box.textContent };
    box.remove();
    return out;
}

test('한 줄 대사(q 안)는 예전처럼 늘임표로', () => {
    const r = run('<p><q>「응<del>~, 그래</del>~! 하하」</q></p>', '「응~~~, 그래~~~! 하하」');
    assert.equal(r.dels, 0); assert.equal(r.tildes, 1); assert.ok(r.text.includes('응~~~, 그래~~~!'));
});
test('두 줄에 걸친 대사 안 「응~~~, 그래~~~!」 도 늘임표로', () => {
    const r = run('<p>「응<del>~, 그래</del>~! 하하<br>알았어」</p>', '「응~~~, 그래~~~! 하하\n알았어」');
    assert.equal(r.dels, 0, '취소선이 남으면 안 돼요'); assert.ok(r.text.includes('응~~~, 그래~~~!'));
});
test('두 줄 대사 안 글자 사이 늘임표 「아~~앗, 대・성・공~~이다」 도', () => {
    const r = run('<p>「됐다아아아<del>앗, 대・성・공</del>이다!!<br>우리 이겼어」</p>', '「됐다아아아~~앗, 대・성・공~~이다!!\n우리 이겼어」');
    assert.equal(r.dels, 0);
});
test('곧은 큰따옴표 두 줄 대사도', () => {
    const r = run('<p>"응<del>~, 그래</del>~! 하하<br>알았어"</p>', '"응~~~, 그래~~~! 하하\n알았어"');
    assert.equal(r.dels, 0);
});
test('대사 밖(따옴표를 닫은 뒤) 같은 꼴은 그대로 취소선', () => {
    const r = run('<p>「알았어」 그는 웃었다. 응<del>~, 그래</del>~! 하고<br>끝</p>', '「알았어」 그는 웃었다. 응~~~, 그래~~~! 하고\n끝');
    assert.equal(r.dels, 1);
});
test('대사 밖 띄어 쓴 ~~지운 글~~ 은 그대로', () => {
    const r = run('<p>말 <del>지울 글</del> 뒤<br>「다음 줄 대사」</p>', '말 ~~지울 글~~ 뒤\n「다음 줄 대사」');
    assert.equal(r.dels, 1);
});
test('버그 사냥 4: 굽은 따옴표를 곧은 따옴표로 닫은 대사(“…") 뒤 대사 밖 같은 꼴은 그대로 취소선', () => {
    for (const [o, c] of [['“', '"'], ['"', '”']]) {
        const r = run(`<p>${o}알았어.${c} 그는 웃었다. 응<del>~, 그래</del>~! 하고<br>끝</p>`, `${o}알았어.${c} 그는 웃었다. 응~~~, 그래~~~! 하고\n끝`);
        assert.equal(r.dels, 1, o + c);
    }
    const r = run('<p>“응<del>~, 그래</del>~! 하하<br>알았어"</p>', '“응~~~, 그래~~~! 하하\n알았어"');
    assert.equal(r.dels, 0, '섞인 따옴표 대사 안은 늘임표');
});

console.log(`dialogue-tildes-span: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
