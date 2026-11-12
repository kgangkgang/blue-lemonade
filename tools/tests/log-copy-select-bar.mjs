// 11-12 로그 복사 — 고른 글 옆 막대(src/log-copy-select-bar.js) · 시트 연결(src/log-copy-sheet.js)
//   ① 자리 계산(폰: 아래 → 위 → 자판 위 바닥 · PC: 위 → 아래 · 가로 맞춤) ② 막대 흐름(가짜 브라우저 leak-dom + 가짜 고르기):
//   고르기 → 막대(단추) → 누름 → run(고른 자리) · 풀림 · 밖 누름 · Esc · 굴림이면 숨김 ③ 시트가 같은 「숨기기」 칩 길로 이어요(소스 꼴)
//   실제 손가락 고르기 · iframe 자리 · 복사 결과는 헤드리스 사진 대본에서 봐요.
//   node tools/tests/log-copy-select-bar.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}\n${error.stack || error}`); } };

const dom = await import(url('tools/tests/leak-dom.mjs'));
dom.installBrowser({ settings: { enabled: true } });
const settle = async (ms = 40) => { await dom.clock.advance(ms); for (let i = 0; i < 10; i++) await null; };
const { placeBar, selBox, createSelectBar, BAR_CLASS } = await import(url('src/log-copy-select-bar.js'));

const PHONE = { left: 0, top: 0, width: 375, height: 812 };
const BAR = { width: 220, height: 48 };

await test('① 폰: 고른 글 바로 아래(손잡이 높이만큼 더) · 가운데 맞춤', () => {
    const sel = { top: 300, bottom: 324, left: 40, right: 200, x: 120 };
    const at = placeBar(sel, BAR, PHONE, { touch: true });
    assert.equal(at.side, 'below');
    assert.ok(at.top >= 324 + 26, `손잡이 아래: ${at.top}`);
    assert.equal(at.left, 10);
});
await test('① 폰: 자판이 올라와 아래가 모자라면 위(기기 메뉴 높이만큼 더 올려요) · 둘 다 모자라면 보이는 화면 바닥', () => {
    const kb = { left: 0, top: 0, width: 375, height: 420 };
    const sel = { top: 300, bottom: 360, left: 40, right: 200, x: 120 };
    const up = placeBar(sel, BAR, kb, { touch: true });
    assert.equal(up.side, 'above');
    assert.ok(up.top + BAR.height <= 300 - 56, `기기 메뉴 자리를 비워요: ${up.top}`);
    const tall = { top: 20, bottom: 400, left: 0, right: 375, x: 180 };
    const dock = placeBar(tall, BAR, kb, { touch: true });
    assert.equal(dock.side, 'dock');
    assert.equal(dock.top, 420 - 8 - BAR.height, '자판 바로 위');
});
await test('① PC: 고른 글 바로 위 · 위가 모자라면 아래 · 오른쪽 끝을 넘지 않아요', () => {
    const view = { left: 0, top: 0, width: 1280, height: 900 };
    const sel = { top: 200, bottom: 220, left: 1200, right: 1270, x: 1235 };
    const at = placeBar(sel, { width: 200, height: 38 }, view, { touch: false });
    assert.equal(at.side, 'above');
    assert.equal(at.top, 200 - 8 - 38);
    assert.equal(at.left, 1280 - 8 - 200, '오른쪽 끝 안');
    const top = placeBar({ top: 10, bottom: 30, left: 100, right: 200, x: 150 }, { width: 200, height: 38 }, view);
    assert.equal(top.side, 'below');
    assert.equal(top.top, 30 + 8);
});
await test('① 고른 자리 상자: 폰은 끝 줄 가운데 · PC 는 첫 줄 가운데 · iframe 자리만큼 옮겨요', () => {
    const rects = [{ top: 10, bottom: 30, left: 50, right: 150, width: 100, height: 20 }, { top: 30, bottom: 50, left: 0, right: 60, width: 60, height: 20 }];
    assert.deepEqual(selBox(rects, { x: 5, y: 100 }, false), { top: 110, bottom: 150, left: 5, right: 155, x: 105 });
    assert.equal(selBox(rects, { x: 5, y: 100 }, true).x, 35);
    assert.equal(selBox([], {}, true), null);
});

// ── 막대 흐름: 가짜 iframe 문서(고르기만 흉내) ──
function fakeFrameDoc() {
    const listeners = new Map();
    const on = (t, fn) => { const l = listeners.get(t) || []; l.push(fn); listeners.set(t, l); };
    const off = (t, fn) => listeners.set(t, (listeners.get(t) || []).filter(f => f !== fn));
    const fire = (t, ev = {}) => { for (const fn of listeners.get(t) || []) fn({ type: t, preventDefault() {}, stopImmediatePropagation() {}, ...ev }); };
    const text = { nodeType: 3, parentElement: { closest: () => null } };
    let range = null;
    const makeRange = (collapsed) => ({ collapsed, startContainer: text, endContainer: text, cloneRange() { return this; }, getClientRects: () => [{ top: 100, bottom: 120, left: 40, right: 140, width: 100, height: 20 }] });
    const win = { addEventListener: on, removeEventListener: off };
    const doc = { defaultView: win, addEventListener: on, removeEventListener: off, getSelection: () => ({ rangeCount: range ? 1 : 0, getRangeAt: () => range, toString: () => (range && !range.collapsed ? '고른 글' : '') }) };
    return { doc, fire, select() { range = makeRange(false); fire('selectionchange'); }, collapse() { range = makeRange(true); fire('selectionchange'); }, listeners };
}

await test('② 고르기 → 막대(단추 셋) → 「눌러야 보이게」 → run(고른 자리) · 막대 숨김', async () => {
    const host = document.createElement('dialog'); document.body.append(host);
    const bar = createSelectBar({ host });
    const f = fakeFrameDoc(), ran = [];
    bar.watch(f.doc, { buttons: () => [{ id: 'hide', label: '눌러야 보이게', main: true, run: r => ran.push(['hide', r]) }, { id: 'bold', label: '굵게', run: r => ran.push(['bold', r]) }, { id: 'italic', label: '기울임', run: () => {} }] });
    assert.ok(document.getElementById('bl-selbar-style'), '꾸밈 블록 하나');
    const el = host.querySelector(`.${BAR_CLASS}`);
    assert.ok(el.hidden, '처음엔 숨김');
    f.select(); await settle(200);
    assert.ok(!el.hidden, '고르면 떠요');
    assert.equal(el.getAttribute('role'), 'toolbar');
    assert.deepEqual([...el.querySelectorAll('button')].map(b => b.textContent), ['눌러야 보이게', '굵게', '기울임']);
    assert.ok(el.style.top && el.style.left, '자리를 줬어요');
    el.querySelector('[data-sb="hide"]').click();
    assert.equal(ran.length, 1); assert.equal(ran[0][0], 'hide'); assert.equal(ran[0][1].collapsed, false, '고른 자리를 넘겨요');
    assert.ok(el.hidden, '누르면 숨어요');
    bar.destroy();
    assert.ok(!host.querySelector(`.${BAR_CLASS}`), '창을 닫으면 막대도 없어요');
    host.remove();
});
await test('② 고른 것이 풀리면 · 밖을 누르면 · Esc · 굴리면 숨어요 · 단추가 없으면 안 떠요', async () => {
    const host = document.createElement('dialog'); document.body.append(host);
    const bar = createSelectBar({ host });
    const f = fakeFrameDoc();
    let none = false;
    bar.watch(f.doc, { buttons: () => (none ? [] : [{ id: 'unhide', label: '숨김 풀기', run: () => {} }]) });
    const el = host.querySelector(`.${BAR_CLASS}`);
    f.select(); await settle(200); assert.ok(!el.hidden);
    f.collapse(); await settle(200); assert.ok(el.hidden, '풀리면 숨음');
    f.select(); await settle(200); assert.ok(!el.hidden);
    f.fire('keydown', { key: 'Escape' }); assert.ok(el.hidden, 'Esc');
    f.select(); await settle(200); assert.ok(!el.hidden);
    f.fire('pointerdown', { pointerType: 'mouse', target: {} }); assert.ok(el.hidden, '미리보기를 다시 누름');
    f.fire('pointerup'); await settle(200); assert.ok(!el.hidden, '놓으면 남은 고르기로 다시');
    document.dispatchEvent(new Event('scroll')); assert.ok(el.hidden, '굴림');
    await settle(400); assert.ok(!el.hidden, '굴림이 멈추면 다시');
    none = true; f.select(); await settle(200); assert.ok(el.hidden, '단추가 없으면 안 떠요');
    bar.destroy(); host.remove();
});
await test('② 첫 Esc 는 막대만 닫아요(시트의 Esc 닫기보다 먼저 · 다른 듣기는 막음)', async () => {
    const host = document.createElement('dialog'); document.body.append(host);
    const bar = createSelectBar({ host });
    const f = fakeFrameDoc();
    bar.watch(f.doc, { buttons: () => [{ id: 'hide', label: 'x', run: () => {} }] });
    f.select(); await settle(200);
    let stopped = false;
    f.fire('keydown', { key: 'Escape', stopImmediatePropagation() { stopped = true; } });
    assert.ok(stopped, '시트 Esc 까지 안 가요');
    stopped = false;
    f.fire('keydown', { key: 'Escape', stopImmediatePropagation() { stopped = true; } });
    assert.ok(!stopped, '막대가 없으면 Esc 는 시트로');
    bar.destroy(); host.remove();
});

// ── 시트 연결(소스 꼴) ──
const sheet = fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8');
await test('③ 시트: 막대를 창 안에 만들고 미리보기 문서를 들어요 · 숨기기/풀기는 「숨기기」 칩 길 · 창을 닫으면 치워요', () => {
    assert.match(sheet, /import \{ createSelectBar \} from '\.\/log-copy-select-bar\.js';/);
    assert.match(sheet, /const selBar = createSelectBar\(\{ host: dialog \}\);/);
    assert.match(sheet, /selBar\.watch\(doc, \{\s*frame,/);
    const watch = sheet.slice(sheet.indexOf('selBar.watch(doc'), sheet.indexOf('selBar.watch(doc') + 1600);
    assert.match(watch, /spoilerAt\(range\)/);
    assert.equal((watch.match(/\$\('\[data-lc="spoiler"\]'\)\.click\(\)/g) || []).length, 2, '숨기기 · 풀기 둘 다 칩 길(되돌리기 한 칸 · 다시 그릴 때 이어짐)');
    // 11-12 규칙(테마 · 마트 · 폰 · PC 같음): 평소엔 「눌러야 보이게 / 숨김 풀기」만 · 굵게 · 기울임은 「글 고치기」 모드에서 한 칸 안을 골랐을 때만(edCell 문을 거쳐서만 — 자세한 잠금은 log-copy-edit-blocks.mjs)
    const call = watch.slice(0, watch.indexOf('\n            });') + 16);
    assert.deepEqual([...call.matchAll(/\{ id: '(\w+)'/g)].map(m => m[1]), ['unhide', 'hide'], '늘 뜨는 단추는 숨김 풀기 · 눌러야 보이게뿐');
    const gate = /\.\.\.\(edCell\(range\) \? [^\n]*: \[\]\)/;
    assert.match(call, gate);
    assert.doesNotMatch(call.replace(gate, ''), /execCommand|edFormat|'bold'|'italic'|굵게|기울임/, '굵게 · 기울임은 edCell(글 고치기 칸) 문 안에만');
    assert.match(sheet, /dialog\.addEventListener\('close', \(\) => \{ selBar\.destroy\(\);/);
    assert.match(sheet, /끌어 고르면 바로 옆에 <b>눌러야 보이게<\/b>가 떠요/);
});

console.log(`log-copy-select-bar: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
