// 1.5.7 2차 부팅: 한글화(korean) — 닫힌 서랍 안에서 바뀐 칸 · 닫힌 서랍 미리 번역을 부팅 뒤로 미뤄도
//   ① 보이는 칸은 예전처럼 바로 ② 닫힌 서랍 안 칸은 서랍이 열리는 그 콜백(그리기 전)에 다 바뀌고 ③ 안 연 서랍도 시작 뒤 첫 누름(또는 시간) 뒤 쉴 때 다 바뀌고
//   ④ 닫힌 서랍에서 밖으로 옮긴 칸은 바로 바뀌고 ⑤ 끄면 모두 원문으로 돌아가는지 봐요(jsdom · 지어낸 글).
//   node tools/tests/korean-closed-late.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2).
import assert from 'node:assert/strict';
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

function start() {
    const dom = new JSDOM(`<!doctype html><body>
      <div id="top-settings-holder">
        <div id="d1" class="drawer-content closedDrawer"><span class="a">Hello there</span><div class="box"></div></div>
        <div id="d2" class="drawer-content closedDrawer"><span class="b">Hello there</span></div>
      </div>
      <div id="vis"><span class="v">Hello there</span></div>
      <div id="sheld"><div id="chat"></div><div id="form_sheld"><span class="f">Hello there</span></div></div>
    </body>`, { pretendToBeVisual: true });
    const w = dom.window;
    w.requestIdleCallback = (fn) => w.setTimeout(() => fn({ timeRemaining: () => 50, didTimeout: false }), 1);
    w.cancelIdleCallback = id => w.clearTimeout(id);
    const BlueLemonade = { koreanDictionary: () => ({ exact: [['Hello there', '안녕하세요']] }), onCleanup: () => {} };
    new w.Function('BlueLemonade', 'window', code)(BlueLemonade, w);
    return w;
}
const txt = (w, sel) => [...w.document.querySelectorAll(sel)].map(e => e.textContent);

await test('보이는 칸은 바로 · 닫힌 서랍은 부팅 동안 그대로 · 서랍 안에서 바뀐 칸도 그대로(보이지 않음)', async () => {
    const w = start();
    await sleep(700);   // 사전(쉴 때 · 늦어도 600ms 흉내)
    assert.deepEqual(txt(w, '.v, .f'), ['안녕하세요', '안녕하세요']);
    assert.deepEqual(txt(w, '.a, .b'), ['Hello there', 'Hello there']);
    w.document.querySelector('#d1 .box').innerHTML = '<p class="late">Hello there</p>';
    await sleep(120);
    assert.deepEqual(txt(w, '.late'), ['Hello there'], '닫힌 서랍 안 새 칸은 열릴 때');
    // ① 서랍이 열리는 class 변화 → 그 콜백에서(그리기 전) 다 바뀜
    w.document.getElementById('d1').classList.add('openDrawer');
    await Promise.resolve(); await sleep(0);
    assert.deepEqual(txt(w, '#d1 .a, #d1 .late'), ['안녕하세요', '안녕하세요']);
    assert.deepEqual(txt(w, '.b'), ['Hello there'], '안 연 서랍은 아직');
    // 시작 뒤에 붙은 닫힌 서랍(확장이 늦게 그림) — 처음 훑기의 「미룬 서랍」이 아니어도 열리는 콜백에서
    w.document.getElementById('top-settings-holder').insertAdjacentHTML('beforeend', '<div id="d3" class="drawer-content closedDrawer"><span class="c">Hello there</span></div>');
    await sleep(120);
    assert.deepEqual(txt(w, '.c'), ['Hello there']);
    w.document.getElementById('d3').classList.add('openDrawer');
    await Promise.resolve(); await sleep(0);
    assert.deepEqual(txt(w, '.c'), ['안녕하세요'], '늦게 붙은 닫힌 서랍도 열릴 때');
    // ④ 닫힌 서랍에서 보이는 곳으로 옮긴 칸은 바로
    const moved = w.document.querySelector('#d2 .b'); w.document.getElementById('vis').append(moved);
    await sleep(80);
    assert.deepEqual(txt(w, '#vis .b'), ['안녕하세요']);
    w.close();
});

await test('안 연 서랍 · 그 안에서 바뀐 칸도 첫 누름 뒤 쉴 때 다 바뀌고, 끄면 원문', async () => {
    const w = start();
    await sleep(700);
    w.document.querySelector('#d1 .box').innerHTML = '<p class="late">Hello there</p>';
    await sleep(120);
    assert.deepEqual(txt(w, '.a, .b, .late'), ['Hello there', 'Hello there', 'Hello there']);
    w.document.body.dispatchEvent(new w.Event('pointerdown', { bubbles: true }));
    await sleep(200);
    assert.deepEqual(txt(w, '.a, .b, .late'), ['안녕하세요', '안녕하세요', '안녕하세요']);
    // 이제(부팅 뒤)는 닫힌 서랍 안 변화도 예전처럼 바로
    w.document.querySelector('#d1 .box').insertAdjacentHTML('beforeend', '<p class="later">Hello there</p>');
    await sleep(120);
    assert.deepEqual(txt(w, '.later'), ['안녕하세요']);
    w.__sillyTavernKoreanUI_v1.cleanup();
    assert.deepEqual(txt(w, '.a, .b, .late, .later, .v, .f'), Array(6).fill('Hello there'));
    w.close();
});

await test('누름이 없어도 정한 시간 뒤엔 미리 번역해요(원본에 시간 · 누름 둘 다)', () => {
    assert.match(code, /const LATE_DRAIN_MS = 10000, CHAT_REST_MS = 3000;/);
    assert.ok(code.includes("lateTimer = host.setTimeout(startLateDrain, LATE_DRAIN_MS);"));
    assert.ok(code.includes("doc.addEventListener('pointerdown', startLateDrain, true); doc.addEventListener('keydown', startLateDrain, true);"));
});
console.log(`\nkorean-closed-late: ${passed} passed`);
