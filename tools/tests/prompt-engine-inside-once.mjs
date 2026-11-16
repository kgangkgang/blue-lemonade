// 1.5.9 opt4: src/scripts/prompt-engine.js 의 감시 콜백이 기록마다 조상 끝까지 선택자를 다시 맞춰 보지 않고(closest 두 번), 한 묶음 안에서 요소마다 한 번만 물어요 — jsdom 으로 봐요.
//   node tools/tests/prompt-engine-inside-once.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   (jsdom 이 없으면 종료 코드 2 · 통과로 치지 않아요)
// ① 무작위 나무 60개 × 요소 전부: insideOnce(sel)(el) === (el.closest(sel) !== null) — 콜백이 쓰는 두 선택자 묶음 그대로 ② 깊은 가지의 기록 수천 개에서 matches 를 부르는 수가 요소 수를 안 넘음
// ③ 배선: 콜백이 closest 대신 묶음마다 새로 만든 기억을 씀(대기 중이면 만들지도 않음)
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
const { insideOnce } = await import(pathToFileURL(path.join(root, 'src/scripts/prompt-engine.js')).href);
const src = fs.readFileSync(path.join(root, 'src/scripts/prompt-engine.js'), 'utf8');
let passed = 0; const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

const watched = src.match(/const watched='([^']+)';/)?.[1]; assert.ok(watched, 'watched 선택자');
const SKIP = '#chat,.bl-scripts,.bl-script-hint', HIT = watched + ',#saved_preset_scripts,#saved_regex_scripts,#saved_scoped_scripts';
let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; const pick = a => a[Math.floor(rnd() * a.length)];
const SHAPES = [['div', ''], ['div', ''], ['span', ''], ['li', 'data-pm-identifier="x"'], ['div', 'class="regex-script-label"'], ['div', 'class="regex_script_name"'], ['li', 'class="regex-debugger-rule"'], ['input', 'class="regex_script_name"'], ['div', 'id="saved_regex_scripts"'], ['div', 'class="bl-scripts"'], ['small', 'class="bl-script-hint"'], ['div', 'id="chat"'], ['div', 'class="world_entry"']];
function tree(doc, depth = 0) {
    const [tag, attr] = pick(SHAPES); const host = doc.createElement('div'); host.innerHTML = `<${tag} ${attr}></${tag}>`; const el = host.firstElementChild;
    if (tag !== 'input') { const kids = depth > 6 ? 0 : Math.floor(rnd() * 4); for (let i = 0; i < kids; i++) el.append(tree(doc, depth + 1)); }
    return el;
}
check('무작위 나무 60개: 요소마다 closest(sel) !== null 과 같은 답(건너뛸 곳 · 볼 곳 두 묶음)', () => {
    let n = 0, yes = 0;
    for (let t = 0; t < 60; t++) {
        const doc = new JSDOM('<!doctype html><body></body>').window.document; for (let i = 0; i < 5; i++) doc.body.append(tree(doc));
        const a = insideOnce(SKIP), b = insideOnce(HIT);
        const els = [...doc.body.querySelectorAll('*')]; for (let i = els.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [els[i], els[j]] = [els[j], els[i]]; }   // 묻는 차례를 섞어요(조상이 먼저 · 자손이 먼저 모두)
        for (const el of els) { assert.equal(a(el), el.closest(SKIP) !== null); assert.equal(b(el), el.closest(HIT) !== null); n++; if (b(el)) yes++; }
        assert.equal(a(null), false);
    }
    assert.ok(n > 3000 && yes > 300, `시험 나무가 모자라요(${n} · ${yes})`);
});
check('깊은 가지에서 온 기록 3,000개: 선택자 맞춰 보기(matches)는 그 가지의 요소 수만큼만', () => {
    const win = new JSDOM('<!doctype html><body><div id="top"></div></body>').window; const doc = win.document;
    let deep = doc.getElementById('top'); for (let i = 0; i < 20; i++) { const d = doc.createElement('div'); deep.append(d); deep = d; }
    const leaves = []; for (let i = 0; i < 100; i++) { const d = doc.createElement('div'); d.className = 'world_entry'; deep.append(d); leaves.push(d); }
    let asked = 0; const m = win.Element.prototype.matches; win.Element.prototype.matches = function (s) { asked++; return m.call(this, s); };
    const f = insideOnce(HIT); for (let i = 0; i < 3000; i++) assert.equal(f(leaves[i % 100]), false);
    win.Element.prototype.matches = m;
    assert.ok(asked <= 100 + 20 + 3, `기록마다 조상을 다시 올랐어요(matches ${asked}번 — 예전 꼴이면 3,000 × 22)`);
});
check('배선: 콜백은 대기 중이 아닐 때 묶음마다 기억을 새로 만들고 closest 대신 써요', () => {
    assert.match(src, /if\(timer\)return;[^\n]*\n\s*const inSkip=insideOnce\('#chat,\.bl-scripts,\.bl-script-hint'\),inWatched=insideOnce\(watched\+',#saved_preset_scripts,#saved_regex_scripts,#saved_scoped_scripts'\);/);
    assert.match(src, /if\(!el\|\|inSkip\(el\)\)return false;/);
    assert.match(src, /return inWatched\(el\)\|\|\[\.\.\.record\.addedNodes,\.\.\.record\.removedNodes\]\.some\(containsTarget\);/);
    const cb = src.match(/observer=new MutationObserver\(records=>\{([\s\S]*?)\n        \}\);/)?.[1] || '';
    assert.doesNotMatch(cb, /el\.closest\(/, '콜백 안에 기록마다 closest 가 남아 있어요');
});
console.log(`prompt-engine-inside-once: ${passed}개 통과`);
