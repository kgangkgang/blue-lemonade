// 버그 사냥 2(1.7.8 거리) — 데우스 감정 대사: 같은 글의 대사가 한 메시지에 여러 번 나올 때(jsdom)
//   화면에서 「글이 같은 첫 칸」 을 골라, 태그 없는 앞 대사가 감싸지거나 다시 훑을 때(80 · 800 · 3000ms) 태그 없는 뒤 대사까지 감쌌어요.
//   이제 원문에서 같은 글 대사 가운데 몇 번째인지 세어 화면에서도 그 차례만 감싸요. 지어낸 글만.
//   node tools/tests/dem-expressive-dup.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const win = new JSDOM('<!doctype html><html><head></head><body class="salty"><div id="chat"></div></body></html>', { pretendToBeVisual: true }).window;
for (const k of ['window', 'document', 'Node', 'NodeFilter', 'Element', 'HTMLElement', 'MutationObserver', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    try { globalThis[k] = win[k]; } catch { Object.defineProperty(globalThis, k, { value: win[k], configurable: true, writable: true }); }
}
win.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.matchMedia = win.matchMedia;
globalThis.CSS ??= { escape: s => s };
const ev = { on() {}, removeListener() {}, emit() {} };
globalThis.SillyTavern = { getContext: () => ({ chat: [], eventSource: ev, event_types: {} }) };
const m = await import(pathToFileURL(path.join(root, 'src/dem-expressive.js')).href);
m.syncDemExpressive(true);
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };

const fx = el => { const box = el.closest('.custom-dem-expressive'); return box ? box.className.split(' ').find(c => c.startsWith('custom-dem-expressive--')).slice(23) : '-'; };
function dressed(html, mes, times = 3) {
    const body = document.createElement('div'); body.className = 'mes_text'; body.innerHTML = html;
    for (let i = 0; i < times; i++) m.dressBody(body, { mes });   // 80 · 800 · 3000ms 다시 훑기와 같은 길
    return body;
}

test('태그 붙은 대사가 먼저 — 다시 훑어도 뒤의 같은 글 대사는 안 감싸요', () => {
    const body = dressed('<p><q>「멈춰!」</q> 그가 외쳤다. 잠시 뒤 다시 <q>「멈춰!」</q></p>', '<shout>「멈춰!」</shout> 그가 외쳤다. 잠시 뒤 다시 「멈춰!」');
    assert.deepEqual([...body.querySelectorAll('q')].map(fx), ['shout', '-']);
});
test('태그 없는 같은 글 대사가 먼저 — 태그 붙은 뒤 대사를 감싸요', () => {
    const body = dressed('<p>그가 <q>「응」</q> 하고 말했다. 그리고 <q>「응」</q></p>', '그가 「응」 하고 말했다. 그리고 <quiet>「응」</quiet>');
    assert.deepEqual([...body.querySelectorAll('q')].map(fx), ['-', 'quiet']);
});
test('같은 글 대사 셋 중 가운데만 태그', () => {
    const body = dressed('<p><q>「응」</q> · <q>「응」</q> · <q>「응」</q></p>', '「응」 · <excited>「응」</excited> · 「응」');
    assert.deepEqual([...body.querySelectorAll('q')].map(fx), ['-', 'excited', '-']);
});
test('같은 글 대사 둘 다 태그(다른 감정)', () => {
    const body = dressed('<p><q>「응」</q> 그리고 <q>「응」</q></p>', '<shout>「응」</shout> 그리고 <quiet>「응」</quiet>');
    assert.deepEqual([...body.querySelectorAll('q')].map(fx), ['shout', 'quiet']);
});
test('글 속에 섞인 대사(q 없음) — 차례대로 한 번만', () => {
    const body = dressed('<p>그가 「응」 하고 말했다. 그리고 「응」 끝</p>', '그가 「응」 하고 말했다. 그리고 <quiet>「응」</quiet> 끝');
    const spans = [...body.querySelectorAll('.custom-dem-expressive')];
    assert.equal(spans.length, 1);
    assert.equal(spans[0].textContent, '「응」');
    assert.ok(body.textContent.indexOf('그리고') < body.textContent.indexOf(spans[0].textContent, body.textContent.indexOf('그리고')));
    assert.ok(spans[0].previousSibling.textContent.endsWith('그리고 '), body.innerHTML);
});
test('독립 검토: 원문에 같은 대사가 … 와 ... 로 섞여 적혀도 화면(… 로 바뀜) 차례로 세요', () => {
    const body = dressed('<p><q>「응…」</q> 그리고 <q>「응…」</q></p>', '「응…」 그리고 <quiet>「응...」</quiet>');
    assert.deepEqual([...body.querySelectorAll('q')].map(fx), ['-', 'quiet']);
});
test('대사가 하나뿐이면 예전 그대로', () => {
    const body = dressed('<p><q>「하나뿐」</q> 뒤</p>', '<shout>「하나뿐」</shout> 뒤');
    assert.deepEqual([...body.querySelectorAll('q')].map(fx), ['shout']);
});

console.log(`dem-expressive-dup: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
