// 1.9.2 한글화(korean) — 사용자가 정한 이름은 번역하지 않아요(폰 제보: 에셋 창 그림 이름표 「Foo_shy_surprise」 가 「Foo_shy_놀람」).
//   ① 공용 「번역 제외」 표시(translate="no" · .notranslate) 안의 글자 · 속성은 사전 줄과 같아도 그대로
//   ② 에셋 창 꼴(밑줄 뒤 <wbr> 로 쪼갠 이름표)은 표시가 없어도 낱말 조각을 바꾸지 않아요(글 전체가 사전 줄일 때만)
//   ③ 표시 밖 · 통째 글자는 예전처럼 바뀌어요(대조군) ④ 끄면 원문(jsdom · 지어낸 이름).
//   node tools/tests/korean-user-names.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { scriptCode } from './script-code.mjs';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || path.join(root, 'tools');
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const code = await scriptCode(root, 'korean');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };
const tile = label => label.replace(/_/g, '_<wbr>');   // panel.js 이름표와 같은 꼴

function start(body) {
    const dom = new JSDOM(`<!doctype html><body>${body}<div id="sheld"><div id="chat"></div><div id="form_sheld"></div></div></body>`, { pretendToBeVisual: true });
    const w = dom.window;
    w.requestIdleCallback = (fn) => w.setTimeout(() => fn({ timeRemaining: () => 50, didTimeout: false }), 1);
    w.cancelIdleCallback = id => w.clearTimeout(id);
    const BlueLemonade = { koreanDictionary: () => ({ exact: [['surprise', '놀람'], ['Hello there', '안녕하세요']] }), onCleanup: () => {} };
    new w.Function('BlueLemonade', 'window', code)(BlueLemonade, w);
    return w;
}
const txt = (w, sel) => [...w.document.querySelectorAll(sel)].map(e => e.textContent);

await test('translate="no" · .notranslate 안은 글자 · title 모두 그대로, 밖의 같은 글은 바뀜', async () => {
    const w = start(`
      <dialog open class="bl-assets-dialog" translate="no">
        <div class="eh-tile" title="surprise"><div class="eh-tile-name n1">${tile('Foo_shy_surprise')}</div><div class="n2">surprise</div></div>
      </dialog>
      <div class="notranslate"><span class="n3">surprise</span></div>
      <div id="vis"><span class="ctl">surprise</span><span class="hi">Hello there</span></div>`);
    await sleep(700);
    assert.deepEqual(txt(w, '.n1, .n2, .n3'), ['Foo_shy_surprise', 'surprise', 'surprise']);
    assert.equal(w.document.querySelector('.eh-tile').getAttribute('title'), 'surprise');
    assert.deepEqual(txt(w, '.ctl, .hi'), ['놀람', '안녕하세요'], '대조군(표시 밖 · 통째 글)은 예전처럼');
    // 나중에 그려진 타일(목록 다시 그리기)도 그대로
    w.document.querySelector('.bl-assets-dialog').insertAdjacentHTML('beforeend', `<div class="eh-tile-name n4">${tile('Foo_surprise')}</div>`);
    await sleep(120);
    assert.deepEqual(txt(w, '.n4'), ['Foo_surprise']);
    w.close();
});

await test('표시가 없어도 <wbr> · 맞붙은 글자 노드로 쪼갠 낱말 조각은 안 바꿔요', async () => {
    const w = start(`<div id="vis">
      <div class="w1">${tile('Foo_shy_surprise')}</div>
      <div class="w2">surprise<wbr>_Foo</div>
      <div class="w3"></div>
      <div class="w4"></div>
      <div class="w5"><span>surprise</span></div>
      <div class="w6"></div>
    </div>`);
    const w3 = w.document.querySelector('.w3');
    w3.append(w.document.createTextNode('Foo_'), w.document.createTextNode('surprise'));     // 맞붙은 두 글자 노드 = 한 낱말
    const w4 = w.document.querySelector('.w4');
    w4.append(w.document.createTextNode('Hello there'), w.document.createTextNode(' 고마워요'));   // 사이가 띄어 있으면 따로 글 → 바뀜
    const w6 = w.document.querySelector('.w6');
    w6.append(w.document.createTextNode('Hello there'), w.document.createTextNode(': 3'));   // 맞닿아도 문장부호 경계면 따로 글 → 바뀜
    await sleep(700);
    assert.deepEqual(txt(w, '.w1, .w2, .w3'), ['Foo_shy_surprise', 'surprise_Foo', 'Foo_surprise']);
    assert.deepEqual(txt(w, '.w4, .w5, .w6'), ['안녕하세요 고마워요', '놀람', '안녕하세요: 3']);
    w.__sillyTavernKoreanUI_v1.cleanup();
    assert.deepEqual(txt(w, '.w4, .w5'), ['Hello there 고마워요', 'surprise']);
    w.close();
});

await test('에셋 창 뿌리 · 다른 이름 칸에 번역 제외 표시가 달려 있어요(원본)', () => {
    const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
    const panel = read('src/addons/assets/panel.js');
    assert.equal((panel.match(/root\.className = 'eh-root';\n\s+root\.translate = false;/g) || []).length, 2, '설정 칸 · 독립 창 뿌리');
    assert.match(panel, /body\.className = 'eh-root'; body\.translate = false;/);
    assert.match(read('src/addons/assets/index.js'), /dialog\.className = 'bl-assets-dialog';\n\s+dialog\.translate = false;/);
    assert.match(read('src/addons/assets/index.js'), /stub\.className = 'eh-root';\n\s+stub\.translate = false;/);
    assert.match(read('src/addons/assets/viewer.js'), /dialog\.className = 'eh-root eh-viewer';\n\s+dialog\.translate = false;/);
    assert.match(read('src/chat-organizer.js'), /<div translate="no" class="bl-co-row/);
    assert.match(read('src/chat-graph.js'), /label\.translate = false; label\.textContent = node\.label;/);
    const ms = read('src/addons/modelswitch/index.js');
    assert.match(ms, /translate="no" class="ms-option/);
    assert.match(ms, /class="ms-state-name" translate="no"/);
    assert.match(read('src/quick/preset-folders.js'), /class="salty-pick-rows" translate="no"/);
    assert.match(read('src/quick/preset-folders.js'), /title.translate = false; title.textContent = preset;/);
    assert.match(read('src/chat-library.js'), /<article class="bl-library-row" translate="no"/);
    assert.ok(code.includes(`'[translate="no"]', '.notranslate'`), '한글화 SKIP 에 공용 표시');
});
console.log(`\nkorean-user-names: ${passed} passed`);
