// 1.6.0 opt4: 네모 단추 감시(src/squared-buttons.js)가 body 전체를 훑을 때 그려지지 않는 닫힌 서랍(.drawer-content.closedDrawer · display:none) 안을 건너 훑어요 — jsdom 으로 봐요.
//   node tools/tests/squared-live-candidates.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2). 공개 CI 는 `cd tools && npm ci` 뒤 `. tools` 로 불러요.
// ① 무작위 나무 200개: liveCandidates = 예전 목록(body.querySelectorAll(FAST_CANDIDATES))에서 「display:none 인 닫힌 서랍과 그 안」만 뺀 것 · 문서 차례 그대로
// ② 닫힌 서랍이 보이게 덮인 경우(display 가 none 이 아님)는 빼지 않음 ③ 닫힌 서랍이 없으면 null(예전 길) ④ 훑는 요소 수가 실제로 줄어듦(다시 느려지면 잡히게)
// ⑤ 배선: scan 은 body 일 때만 쓰고, 아는 생김새 바로 붙이기(restamp)는 예전처럼 서랍 안까지
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
const { liveCandidates, FAST_CANDIDATES, DEAD_DRAWER } = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')).href);
const src = fs.readFileSync(path.join(root, 'src/squared-buttons.js'), 'utf8');
let passed = 0; const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

let seed = 20261116; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }; const pick = a => a[Math.floor(rnd() * a.length)];
const TAGS = ['div', 'div', 'div', 'span', 'button', 'a', 'label', 'summary', 'input', 'i'];
const CLS = ['', '', 'menu_button', 'drawer-content closedDrawer', 'drawer-content openDrawer', 'drawer-content closedDrawer shown', 'mes_buttons', 'chip', 'tab', 'drawer'];
function tree(doc, depth = 0) {
    const el = doc.createElement(pick(TAGS)); const c = pick(CLS); if (c) el.className = c;
    if (rnd() < 0.1) el.setAttribute('tabindex', '0'); if (rnd() < 0.05) el.setAttribute('data-bl-squared', '');
    const kids = depth > 5 ? 0 : Math.floor(rnd() * 4); for (let i = 0; i < kids; i++) el.append(tree(doc, depth + 1));
    return el;
}
const page = () => { const dom = new JSDOM('<!doctype html><html><head><style>.drawer-content.closedDrawer{display:none}.drawer-content.closedDrawer.shown{display:block}</style></head><body></body></html>'); return dom.window; };
const expected = (win) => {
    const body = win.document.body; const dead = [...body.querySelectorAll(DEAD_DRAWER)].filter(d => win.getComputedStyle(d).display === 'none');
    return { dead, list: [...body.querySelectorAll(FAST_CANDIDATES)].filter(el => !dead.some(d => d.contains(el))) };
};

check('무작위 나무 200개: 예전 목록에서 그려지지 않는 닫힌 서랍 안만 빠지고 차례가 같아요', () => {
    let withDead = 0, dropped = 0, keptShown = 0;
    for (let n = 0; n < 200; n++) {
        const win = page(); const body = win.document.body; for (let i = 0; i < 6; i++) body.append(tree(win.document));
        const { dead, list } = expected(win); const got = liveCandidates(body, win);
        if (!dead.length) { assert.equal(got, null, '닫힌 서랍이 없으면 null(예전 길)'); continue; }
        withDead++; assert.ok(Array.isArray(got));
        assert.equal(got.length, list.length, `나무 ${n}: 수가 달라요`);
        for (let i = 0; i < list.length; i++) assert.equal(got[i], list[i], `나무 ${n}: ${i}번째가 달라요`);
        dropped += body.querySelectorAll(FAST_CANDIDATES).length - list.length;
        keptShown += got.filter(el => el.closest('.drawer-content.closedDrawer.shown') && !dead.some(d => d.contains(el))).length;
    }
    assert.ok(withDead > 100 && dropped > 500, `시험이 닫힌 서랍을 충분히 못 만들었어요(${withDead} · ${dropped})`);
    assert.ok(keptShown > 20, `보이게 덮인 닫힌 서랍 안 후보는 남아야 해요(${keptShown})`);
});
check('닫힌 서랍 안은 선택자로 훑지도 않아요(서랍이 문서의 대부분일 때 훑는 요소 수가 줄어요)', () => {
    const win = page(); const doc = win.document; const body = doc.body;
    body.innerHTML = '<div id="top"><div class="drawer"><div class="drawer-content closedDrawer" id="d1"></div></div><div class="drawer"><div class="drawer-content closedDrawer" id="d2"></div></div></div><div id="sheld"><button class="menu_button" id="live">보내기 옆</button></div>';
    for (const id of ['d1', 'd2']) { const d = doc.getElementById(id); for (let i = 0; i < 300; i++) { const b = doc.createElement('button'); b.className = 'menu_button'; d.append(b); } }
    let asked = 0; const P = win.Element.prototype; const qsa = P.querySelectorAll, m = P.matches;
    P.querySelectorAll = function (s) { const r = qsa.call(this, s); if (s === FAST_CANDIDATES) asked += this.getElementsByTagName('*').length; return r; };
    P.matches = function (s) { if (s === FAST_CANDIDATES) asked++; return m.call(this, s); };
    const got = liveCandidates(body, win); P.querySelectorAll = qsa; P.matches = m;
    assert.deepEqual(got.map(el => el.id), ['live']);
    assert.ok(asked < 20, `닫힌 서랍 안까지 훑었어요(훑은 요소 ${asked} · 문서 ${body.getElementsByTagName('*').length})`);
});
check('건너뛸 구역인 body · 못 묻는 문서는 null(예전 길)', () => {
    const win = page(); win.document.body.innerHTML = '<div class="drawer-content closedDrawer"><button>가</button></div>';
    win.document.body.setAttribute('data-bl-native-ext-colors', '');
    assert.equal(liveCandidates(win.document.body, win), null);
    assert.equal(liveCandidates({ }, win), null); assert.equal(liveCandidates(win.document.body, {}), null);
});
check('배선: scan 은 body 를 훑을 때만 · restamp 는 예전처럼 candidates 로(서랍 안 아는 생김새도 바로 붙임)', () => {
    assert.match(src, /const live = fastOk && root === doc\.body \? liveCandidates\(root, host\) : null;/);
    assert.match(src, /const got = live \? \{ areas: NO_AREAS, list: live \} : candidates\(root\); if \(!got\) return;/);
    const restamp = src.match(/const restamp = el => \{([\s\S]*?)\n    \};/)?.[1] || '';
    assert.match(restamp, /const got = candidates\(el\)/); assert.doesNotMatch(restamp, /liveCandidates/);
    assert.equal(DEAD_DRAWER, '.drawer-content.closedDrawer');
});
console.log(`squared-live-candidates: ${passed}개 통과`);
