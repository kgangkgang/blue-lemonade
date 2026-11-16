// 1.5.7 2차 부팅: 과일의 마음 한글화(src/scripts/plain/fruit-heart.js)의 scanOutsideChat 을 「id 표 · 칸 안 · 두 선택자 한 번」으로 나눈 뒤에도
//   고르는 요소 · 차례가 예전 길(#chat 밖 가지마다 FLUSH_ALL 열일곱 선택자)과 같은지 무작위 문서로 대조해요(jsdom).
//   팝업(열린 · 닫힌 dialog · div) · 알림 칸 · 헬퍼 목록(겹친 것 포함) · 과일 입구 · 같은 id 두 개 · 채팅 안에 든 같은 요소 · head 안 요소까지 섞어요.
//   node tools/tests/fruit-heart-scan.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || path.join(root, 'tools');
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const src = fs.readFileSync(path.join(root, 'src/scripts/plain/fruit-heart.js'), 'utf8');
const grab = re => { const m = re.exec(src); assert.ok(m, `원본에서 못 찾음: ${re}`); return m[0]; };
// 원본에서 선택자 · 새 훑기를 그대로 떠 와요(베끼지 않아요)
const parts = [
    grab(/const rootsSelector = [^\n]+/), grab(/const watchSelector = [^\n]+/), grab(/const helperRootsSelector = [^\n]+/),
    grab(/const POPUPS = [^\n]+/), grab(/const FLUSH_ALL = [^\n]+/),
    grab(/const branchable = [^\n]+/), grab(/function outsideChat\(\) \{[\s\S]*?\n  \}/),
    grab(/const SCAN_IDS = [^\n]+/), grab(/const SCAN_SCOPED = [^\n]+/), grab(/const SCAN_REST = [^\n]+/),
    grab(/function scanOutsideChat\(\) \{[\s\S]*?\n  \}/),
];
const OLD = `function oldScan() {
    if (!branchable() || !doc.getElementById('chat')) return [...doc.querySelectorAll(FLUSH_ALL)];
    const out = [];
    for (const branch of outsideChat()) { if (branch.matches(FLUSH_ALL)) out.push(branch); for (const el of branch.querySelectorAll(FLUSH_ALL)) out.push(el); }
    if (out.length > 1 && typeof out[0].compareDocumentPosition === 'function') out.sort((a, b) => (a === b ? 0 : a.compareDocumentPosition(b) & 4 ? -1 : 1));
    return out;
  }`;
const make = new Function('doc', `${parts.join('\n')}\n${OLD}\nreturn { scanOutsideChat, oldScan };`);

let seed = 1;
const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rand() * a.length)];
const PIECES = [
    () => '<div class="popup">팝업</div>', () => '<dialog class="popup" open>열린 창</dialog>', () => '<dialog class="popup">닫힌 창</dialog>',
    () => '<dialog open>그냥 창</dialog>', () => '<button data-fh-cat="1">입구</button>', () => '<button data-fh-cat="2">다른 칸</button>',
    () => '<div id="toast-container"><div class="toast"><div class="toast-title">제목</div><div class="toast-message">글</div></div></div>',
    () => '<div id="tavern_helper"><div data-container-type="global"><div data-container-type="character"></div></div><div data-container-type="preset"></div><div data-container-type="other"></div></div>',
    () => '<div class="toast-message">밖 알림 글</div>', () => '<div data-container-type="global">헬퍼 밖</div>',
    () => '<div id="qr--bar"><div class="qr--buttons"><div class="qr--button" data-fh-cat="1">QR</div></div></div>',
    () => '<div id="extensionsMenu"><div class="list-group-item">항목</div></div>', () => '<select id="reasoning_select"><option>a</option></select>',
    () => '<div id="fruit-heart-v6" class="open"><span>과일</span></div>', () => '<div id="fruit-heart-v6-dock"></div>', () => '<div id="quickReplies"></div>',
    () => '<div class="drawer-content"><div class="inline-drawer"><span>칸</span></div></div>', () => '<p>그냥 글</p>',
];
function page() {
    const chunk = (depth) => { let html = ''; const n = 1 + Math.floor(rand() * 4); for (let i = 0; i < n; i++) { const p = pick(PIECES)(); html += depth > 0 && rand() < 0.35 ? `<div class="wrap">${p}${chunk(depth - 1)}</div>` : p; } return html; };
    const headExtra = rand() < 0.5 ? '<template><div class="popup"></div></template>' : '';
    return `<!doctype html><html><head><title>t</title>${headExtra}</head><body>${chunk(3)}<div id="sheld"><div id="top">${chunk(2)}</div><div id="chat">${chunk(2)}<div class="mes"><div class="popup">채팅 안</div><button data-fh-cat="1">채팅 안 입구</button></div></div><div id="form_sheld">${chunk(2)}</div></div>${chunk(3)}</body></html>`;
}

let passed = 0, compared = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  PASS  ${name}`); };
const key = el => `${el.tagName}#${el.id}.${el.className}|${el.textContent.slice(0, 12)}`;
test('무작위 문서 300벌: 새 훑기 = 예전 훑기(요소 · 차례 같음)', () => {
    for (let i = 0; i < 300; i++) {
        const dom = new JSDOM(page()); const doc = dom.window.document;
        const { scanOutsideChat, oldScan } = make(doc);
        const a = oldScan(), b = scanOutsideChat();
        assert.equal(b.length, a.length, `문서 ${i}: 수 ${a.length} ↔ ${b.length}`);
        a.forEach((el, j) => assert.equal(b[j], el, `문서 ${i} 자리 ${j}: ${key(el)} ↔ ${b[j] && key(b[j])}`));
        compared += a.length;
    }
    assert.ok(compared > 1500, `견준 요소가 충분해야 해요(${compared})`);
});
test('채팅이 없는 문서는 예전처럼 문서 전체', () => {
    const dom = new JSDOM('<!doctype html><body><div class="popup"></div><dialog class="popup"></dialog><button data-fh-cat="1"></button></body>');
    const { scanOutsideChat, oldScan } = make(dom.window.document);
    assert.deepEqual(scanOutsideChat(), oldScan()); assert.equal(scanOutsideChat().length, 2);
});
test('일부러 틀린 훑기(닫힌 dialog 도 고름)는 대조에서 잡혀요', () => {
    const bad = new Function('doc', `${parts.join('\n').replace("el.localName !== 'dialog' || el.hasAttribute('open')", 'true')}\n${OLD}\nreturn { scanOutsideChat, oldScan };`);
    let caught = false;
    for (let i = 0; i < 50 && !caught; i++) { const { scanOutsideChat, oldScan } = bad(new JSDOM(page()).window.document); if (scanOutsideChat().length !== oldScan().length) caught = true; }
    assert.ok(caught);
});
test('html · body 붙음 거르개: 고를 것 · 곧 고를 것 · 떨어진 뿌리만 다시 칠해요', () => {
    const doc = new JSDOM('<!doctype html><body><div id="sheld"><div id="chat"></div></div></body>').window.document;
    const body = [...parts.slice(0, 5), grab(/const RELEVANT = [^\n]+/), grab(/const lostRoot = [^\n]+/), grab(/const relevantInsertion = records => \{[\s\S]*?\n  \};/)].join('\n');
    const observed = new Set(), popupRoots = new Set();
    const rel = new Function('doc', 'observed', 'popupRoots', `${body}\nreturn relevantInsertion;`)(doc, observed, popupRoots);
    const add = html => { const t = doc.createElement('template'); t.innerHTML = html; return [{ addedNodes: [t.content.firstElementChild], removedNodes: [] }]; };
    for (const html of ['<fieldset></fieldset>', '<script></script>', '<ul class="ui-menu"><li>a</li></ul>', '<div class="lv-bar"><span>x</span></div>']) assert.equal(rel(add(html)), false, html);
    for (const html of ['<dialog class="popup"></dialog>', '<dialog></dialog>', '<div><div class="popup">p</div></div>', '<div><button data-fh-cat="0"></button></div>', '<div id="fruit-heart-v6"></div>', '<div id="toast-container"></div>', '<div id="tavern_helper"></div>', '<div id="qr--bar"></div>']) assert.equal(rel(add(html)), true, html);
    assert.equal(rel([{ addedNodes: [doc.createTextNode('글')], removedNodes: [] }]), false);
    observed.add(doc.createElement('div'));
    assert.equal(rel([{ addedNodes: [], removedNodes: [doc.createElement('div')] }]), true, '지켜보던 뿌리가 떨어짐');
    observed.clear(); assert.equal(rel([{ addedNodes: [], removedNodes: [doc.createElement('div')] }]), false, '상관없는 것이 떨어짐');
});
console.log(`\nfruit-heart-scan: ${passed} passed (견준 요소 ${compared})`);
