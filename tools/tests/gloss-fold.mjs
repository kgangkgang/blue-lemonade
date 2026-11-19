// 1.8.8 원어 대사 뒤 영어 풀이 줄 접기(src/gloss-fold.js) — 지어낸 대사로 원문 짝 · 화면 짝 · 접기 · 펴기를 봐요. 번역 호출 없음.
//   node tools/tests/gloss-fold.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const { window } = new JSDOM('<!doctype html><html><body><div id="chat"></div></body></html>');
for (const k of ['MutationObserver', 'Node', 'NodeFilter', 'document', 'requestAnimationFrame']) globalThis[k] = window[k] ?? globalThis[k];
const G = await import(pathToFileURL(path.join(root, 'src/gloss-fold.js')).href);

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };
const B = '⠀';
const SRC = [
    'Rain taps the window.',
    '',
    '<span style="color:#8f9c65"><steady>「明日は晴れるって、言っただろ？」</steady></span>',
    '',
    `*"You${B}said${B}it${B}would${B}be${B}sunny${B}tomorrow,${B}didn't${B}you?"*`,
    '',
    'She laughs.',
    '',
    '<span style="color:#424C59">「うん、言ったよ！」</span>',
    '',
    '*“Yes, I did!”*',
    '',
    '「Plain English in brackets」',
    '',
    '*"Not a gloss."*',
].join('\n');
const SCREEN = `<p>창문을 두드리는 비.</p>
<p><span style="color:#8f9c65">「내일은 맑을 거라고, 말했잖아?」</span></p>
<p><em>"내일은 맑을 거라고, 말했잖아?"</em></p>
<p>그녀가 웃는다.</p>
<p><span>「응, 말했어!」</span></p>
<p><em>“응, 말했어!”</em></p>
<p>「괄호 속 영어」</p>
<p><em>"풀이 아님."</em></p>`;

test('원문 짝: 일본어 대사 + 영어 따옴표 기울임 한 줄만 접을 것 · 점자 빈칸 · 둥근 따옴표 · 영어 대사 뒤는 아님', () => {
    assert.deepEqual(G.sourcePairs(SRC).map(x => x.fold), [true, true, false]);
    assert.deepEqual(G.sourcePairs('「こんにちは」\n*"안녕"*').map(x => x.fold), [false], '풀이가 한국어면 아님');
    assert.deepEqual(G.sourcePairs('「こんにちは」\nShe waves.\n*"Hello"*'), [], '바로 다음 줄이 아니면 짝 아님');
    assert.deepEqual(G.sourcePairs('「こんにちは」 と言った。\n*"Hello"*'), [], '대사 하나만 든 줄이 아니면 아님');
});

test('화면: 번역본이 보일 때 접고 · 원문만 보이면 안 접고 · 짝 수가 다르면 아무것도 안 함 · 끄면 폄', () => {
    const box = window.document.createElement('div'); box.className = 'mes_text'; box.innerHTML = SCREEN;
    assert.equal(G.foldMessage(box, SRC, true), 2);
    const ps = [...box.querySelectorAll(':scope > p')];
    assert.equal(ps[2].style.display, 'none'); assert.equal(ps[5].style.display, 'none');
    assert.equal(ps[7].style.display, '', '영어 대사 뒤 줄은 그대로');
    assert.equal(ps[1].style.display, '', '대사 줄은 그대로');
    assert.equal(G.foldMessage(box, SRC, true), 2, '두 번 불러도 같음');
    assert.equal(G.foldMessage(box, SRC, false), 0);
    assert.equal(box.querySelectorAll('[data-bl-gloss]').length, 0, '끄면 모두 폄');
    // 원문만 보이는 화면(한글 없음) — 안 접음
    const orig = window.document.createElement('div'); orig.innerHTML = '<p><span>「明日は晴れるって、言っただろ？」</span></p><p><em>"You said it would be sunny tomorrow, didn\'t you?"</em></p><p><span>「うん、言ったよ！」</span></p><p><em>"Yes, I did!"</em></p><p>「Plain English in brackets」</p><p><em>"Not a gloss."</em></p>';
    assert.equal(G.foldMessage(orig, SRC, true), 0);
    // 번역이 줄을 합쳐 짝 수가 다름 — 안 접음
    const merged = window.document.createElement('div'); merged.innerHTML = '<p><span>「내일은 맑을 거라고, 말했잖아?」</span></p><p><em>"내일은 맑을 거라고, 말했잖아?"</em></p>';
    assert.equal(G.foldMessage(merged, SRC, true), 0);
    // 원문 글은 그대로(화면만)
    assert.ok(SRC.includes('*"You'));
});

console.log(`gloss-fold: ${passed} 통과`);
