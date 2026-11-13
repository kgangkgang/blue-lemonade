// 1.2.1 opt: 네모 단추 감시(src/squared-buttons.js)의 기록 갈래(recordKind)가 예전 차례(perfMarkOnly → data-generating → 같은 값 · 스와이프 → 자식 목록 → padding)와
//   ① 무작위 기록 2만 개에서 같은 갈래를 내는지 ② 같은 값을 다시 쓴 class 기록에 앞뒤 클래스 Set 을 만들지 않는지(getAttribute 호출 수로 봐요)
//   ③ 미세 벤치: 메시지 300개에 같은 값 class 기록(실리태번 refreshSwipeButtons 꼴)이 섞인 묶음에서 예전 → 지금 시간(노드 · 가짜 기록)
//   node tools/tests/squared-record-kind.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const mod = await import(pathToFileURL(path.join(root, 'src/squared-buttons.js')));
const { recordKind, perfMarkOnly, swipeMarkOnly, unchangedAttr, paddingOnly } = mod;
let pass = 0; const test = (name, fn) => { fn(); pass++; console.log('  PASS  ' + name); };
assert.equal(typeof recordKind, 'function', 'recordKind 를 내보내요');

// 1.1.9 onRecords 의 차례 그대로 — 기준
function oldKind(r, htmlEl) {
    if (r.target === htmlEl) return 'html';
    if (perfMarkOnly(r)) return 'perf';
    if (r.attributeName === 'data-generating') return 'gen';
    if (unchangedAttr(r) || swipeMarkOnly(r)) return 'skip';
    if (r.type === 'childList') return 'child';
    return paddingOnly(r) ? 'skip' : 'target';
}

let gets = 0;
class El {
    constructor(attrs = {}) { this.attrs = { ...attrs }; this.nodeType = 1; const self = this; this.classList = { contains: c => String(self.attrs.class || '').split(/\s+/).includes(c) }; }
    getAttribute(k) { gets++; return k in this.attrs ? this.attrs[k] : null; }
}
let seed = 777;
const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 4) % n; };
const pick = a => a[rnd(a.length)];
const CLASSES = ['mes', 'last_mes', 'fade', 'last_swipe', 'swipes_visible', 'bl-chat-light', 'bl-chat-covered', 'bl-bars-hidden', 'menu_button', 'openDrawer', 'x'];
const clsText = () => Array.from({ length: rnd(5) }, () => pick(CLASSES)).join(pick([' ', '  ']));
const STYLES = ['', 'padding-top: 3px', 'padding-top: 4px; padding-bottom: 2px', 'display: none', 'padding-top: 3px; color: red', 'opacity: 0.5'];

await test('무작위 기록 2만 개에서 예전 차례와 같은 갈래예요', () => {
    const html = new El({ class: 'bl-chat-light' });
    const tally = {};
    for (let i = 0; i < 20000; i++) {
        const kind = rnd(10);
        let r;
        if (kind === 0) r = { type: 'childList', target: new El(), addedNodes: [], attributeName: null };
        else if (kind === 1) r = { type: 'attributes', attributeName: 'class', target: html, oldValue: clsText() };
        else if (kind === 2) { const now = pick(['', 'true']); r = { type: 'attributes', attributeName: 'data-generating', target: new El(now ? { 'data-generating': now } : {}), oldValue: pick([null, '', 'true', undefined]) }; }
        else if (kind <= 4) { const now = pick(STYLES); r = { type: 'attributes', attributeName: 'style', target: new El({ style: now }), oldValue: pick([now, ...STYLES, undefined]) }; }
        else if (kind === 5) { const now = pick(['', 'hidden']); r = { type: 'attributes', attributeName: pick(['hidden', 'open']), target: new El(now ? { hidden: now, open: now } : {}), oldValue: pick([null, '', 'hidden', undefined]) }; }
        else { const now = clsText(); r = { type: 'attributes', attributeName: 'class', target: new El({ class: now }), oldValue: pick([now, now, clsText(), now + ' fade', now + ' bl-chat-light', undefined, null]) }; }
        const a = oldKind(r, html), b = recordKind(r, html);
        assert.equal(b, a, `갈래 다름: ${JSON.stringify({ type: r.type, name: r.attributeName, old: r.oldValue, now: r.target.attrs })}`);
        tally[a] = (tally[a] || 0) + 1;
    }
    console.log('        갈래', JSON.stringify(tally));
    for (const k of ['html', 'perf', 'gen', 'skip', 'child', 'target']) assert.ok(tally[k] > 50, `${k} 갈래가 시험에 있어야 해요`);
});

await test('(1.2.2) 서랍 덮개 속성(data-bl-chat-covered) 기록은 붙을 때도 떨어질 때도 perf 갈래 — 다시 훑지 않고, 옛 덮개 class 는 보통 class', () => {
    const on = new El({ 'data-bl-chat-covered': '' }), off = new El({});
    assert.equal(recordKind({ type: 'attributes', attributeName: 'data-bl-chat-covered', target: on, oldValue: null }, null), 'perf');
    assert.equal(recordKind({ type: 'attributes', attributeName: 'data-bl-chat-covered', target: off, oldValue: '' }, null), 'perf');
    assert.equal(recordKind({ type: 'attributes', attributeName: 'class', target: new El({ class: 'bl-chat-covered' }), oldValue: '' }, null), 'target');
    assert.equal(recordKind({ type: 'attributes', attributeName: 'class', target: new El({ class: 'bl-bars-hidden' }), oldValue: '' }, null), 'perf');
});

await test('같은 값을 다시 쓴 class 기록은 getAttribute 한 번(예전: perfMarkOnly 에서 한 번 + 같은 값 비교 한 번)', () => {
    const el = new El({ class: 'mes last_mes' });
    const r = { type: 'attributes', attributeName: 'class', target: el, oldValue: 'mes last_mes' };
    gets = 0; assert.equal(recordKind(r, null), 'skip'); assert.equal(gets, 1);
    gets = 0; assert.equal(oldKind(r, null), 'skip'); assert.equal(gets, 2);
});

await test('미세 벤치 — 메시지 300개 묶음(같은 값 class 기록 300 + 바뀐 기록 30) × 200번', () => {
    const batch = [];
    for (let i = 0; i < 300; i++) { const c = 'mes' + (i % 3 ? ' last_swipe' : ''); batch.push({ type: 'attributes', attributeName: 'class', target: new El({ class: c }), oldValue: c }); }
    for (let i = 0; i < 30; i++) batch.push({ type: 'attributes', attributeName: 'class', target: new El({ class: 'mes fade' }), oldValue: 'mes' });
    const run = fn => { const t0 = process.hrtime.bigint(); let n = 0; for (let k = 0; k < 200; k++) for (const r of batch) if (fn(r, null) === 'skip') n++; return [Number(process.hrtime.bigint() - t0) / 1e6, n]; };
    run(oldKind); run(recordKind);
    const [before, a] = run(oldKind), [after, b] = run(recordKind);
    assert.equal(a, b);
    console.log(`        ${before.toFixed(1)} → ${after.toFixed(1)}ms (기록 ${batch.length * 200}개)`);
});

console.log(`squared-record-kind: ${pass} passed`);
