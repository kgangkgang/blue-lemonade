// 1.2.1 opt: 단추 글자 세로 맞춤(src/control-ink.js) 감시 콜백이 한 묶음 안 같은 요소의 closest 답(채팅 안 · 단추 안 · 창 뿌리 ROOTS 27가지)을 한 번만 묻는지,
//   그래도 맞추러 가는 창(alignRoots 가 받는 뿌리)이 기억 없이 기록마다 묻던 때와 같은지 봐요 — 무작위 묶음 1,500개(가짜 DOM · vm).
//   「기억 없음」은 같은 코드에서 기억(memo)만 끈 것 = 1.1.9 의 기록마다 closest 와 같은 동작이에요.
//   node tools/tests/control-ink-batch.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(process.argv[2] || '.');
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('  PASS  ' + name); };

const src = fs.readFileSync(path.join(root, 'src/control-ink.js'), 'utf8').replace(/^import .*$/m, '').replace(/^export \{[^}]*\};$/m, '').replace('export function syncControlInk', 'function syncControlInk');
assert.ok(src.includes('const memo = new Map();'), '콜백이 묶음 안 기억(memo)을 써요');
const ROOTS_SEL = /const ROOTS = '([^']+)'/.exec(src)[1];
const BUTTONS_SEL = /const BUTTONS = '([^']+)'/.exec(src)[1];

const calls = { roots: 0, other: 0 };
class El {
    constructor(kind, parent = null) { this.kind = kind; this.nodeType = 1; this.parentElement = parent; this.children = []; this.isConnected = true; parent?.children.push(this); }
    is(sel) { return sel === ROOTS_SEL ? this.kind === 'root' : sel === BUTTONS_SEL ? this.kind === 'button' : sel === '#chat, .mes_text' ? this.kind === 'chat' : false; }
    closest(sel) { if (sel === ROOTS_SEL) calls.roots++; else calls.other++; for (let p = this; p; p = p.parentElement) if (p.is(sel)) return p; return null; }
    matches(sel) { return this.is(sel); }
    querySelector(sel) { const walk = e => { for (const c of e.children) { if (c.is(sel)) return c; const r = walk(c); if (r) return r; } return null; }; return walk(this); }
    querySelectorAll() { return []; }
    contains(o) { for (let p = o; p; p = p.parentElement) if (p === this) return true; return false; }
    getClientRects() { aligned.push(this); return []; }   // 맞추러 온 창을 적고 「안 보임」으로 건너뛰어요
}
let aligned = [];
function sandboxFor(code) {
    let callback = null; const frames = [];
    const sb = {
        document: { body: {}, documentElement: {}, fonts: { addEventListener() {} }, querySelectorAll: () => [] },
        window: { addEventListener() {} }, NodeFilter: { SHOW_TEXT: 4 }, console, getComputedStyle: () => ({}),
        requestAnimationFrame: fn => { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
        watchDom: (_t, _s, fn) => { callback = fn; const off = () => {}; off.quiet = () => {}; return off; },
    };
    vm.createContext(sb); vm.runInContext(code + '\nthis.sync = syncControlInk;', sb);
    sb.sync(true, 'k');
    frames.length = 0;
    return { notify: records => callback(records), flush: () => { while (frames.length) frames.shift()(); } };
}
const withMemo = sandboxFor(src);
const noMemo = sandboxFor(src.replace('const memo = new Map();', 'const memo = { get() {}, set() {} };'));

// 문서: 창 뿌리 몇 개(안에 창이 또 있기도) · 단추 · 채팅
const docRoot = new El('div');
const chat = new El('chat', docRoot); new El('button', new El('div', chat));
const rootsAll = [], pool = [docRoot];
for (let i = 0; i < 6; i++) {
    const r = new El('root', i % 3 === 2 ? rootsAll[i - 1] : docRoot); rootsAll.push(r); pool.push(r);
    for (let j = 0; j < 6; j++) { const row = new El('div', r); pool.push(row); const b = new El('button', row); pool.push(b); pool.push(new El('span', b)); }
}
pool.push(...chat.children, chat);
let seed = 31;
const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 4) % n; };
const pick = a => a[rnd(a.length)];
const record = () => {
    const t = pick(pool), k = rnd(4);
    if (k === 0) return { type: 'characterData', target: { nodeType: 3, parentElement: t }, addedNodes: [] };
    if (k === 1) { const add = rnd(2) ? new El(pick(['button', 'div', 'root'])) : { nodeType: 3 }; return { type: 'childList', target: t, addedNodes: [add] }; }
    return { type: 'attributes', target: t, attributeName: 'class', addedNodes: [] };
};

test('무작위 묶음 1,500개 — 맞추러 가는 창이 기억 없이 묻던 때와 같고, ROOTS closest 는 줄어요', () => {
    let rootsWith = 0, rootsWithout = 0;
    for (let i = 0; i < 1500; i++) {
        const list = Array.from({ length: 1 + rnd(20) }, record);
        aligned = []; calls.roots = 0; noMemo.notify(list); noMemo.flush(); const a = aligned; rootsWithout += calls.roots;
        aligned = []; calls.roots = 0; withMemo.notify(list); withMemo.flush(); const b = aligned; rootsWith += calls.roots;
        assert.deepEqual(b, a, `묶음 ${i}: 맞추는 창이 달라요`);
    }
    console.log(`        ROOTS closest ${rootsWithout} → ${rootsWith}번`);
    assert.ok(rootsWith < rootsWithout);
});

test('같은 단추의 글자 기록 40개(숫자 읽기가 바뀌는 단추) — closest 는 요소마다 한 번', () => {
    const b = pool.find(e => e.kind === 'button' && e.parentElement?.parentElement?.kind === 'root');
    const list = Array.from({ length: 40 }, () => ({ type: 'characterData', target: { nodeType: 3, parentElement: b }, addedNodes: [] }));
    calls.roots = 0; calls.other = 0; aligned = []; withMemo.notify(list); withMemo.flush();
    assert.equal(calls.roots, 1); assert.equal(calls.other, 2);   // 채팅 안 · 단추 안 한 번씩
    assert.deepEqual(aligned, [b.parentElement.parentElement]);
    calls.roots = 0; calls.other = 0; noMemo.notify(list); noMemo.flush();
    console.log(`        closest(ROOTS) 기억 없음 ${calls.roots}번 → 1번 · 그 밖 ${calls.other}번 → 2번`);
});

console.log(`control-ink-batch: ${pass}개 통과`);
