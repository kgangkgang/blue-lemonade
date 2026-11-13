// 1.2.1 opt: 가로 탭 줄(src/tab-scroll.js)의 한 프레임 묶음 — 새로 붙은 요소 가운데 조상도 같은 묶음에서 붙은 것은 따로 훑지 않아요(outermostAdded).
//   ① 무작위 나무 · 묶음 2,000개에서 묶이는 줄(bind)이 예전(붙은 요소마다 scan)과 같은지 — 겹쳐 붙음 · 메시지(.mes) 안 · 떨어진 가지 · 같은 요소 두 번 · 글자 노드
//   ② 미세 벤치: 서랍 하나를 그리며 그릇 안에 줄 200개를 따로 붙인 묶음에서 querySelectorAll 이 훑는 요소 수(예전 → 지금)
//   node tools/tests/tab-scroll-batch.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { outermostAdded } = await import(pathToFileURL(path.join(root, 'src/tab-scroll.js')));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('  PASS  ' + name); };
assert.equal(typeof outermostAdded, 'function', 'outermostAdded 를 내보내요');

let visited = 0;
class El {
    constructor(cls = '') { this.nodeType = 1; this.cls = cls; this.children = []; this.parentElement = null; }
    append(...k) { for (const c of k) { c.parentElement?.children.splice(c.parentElement.children.indexOf(c), 1); c.parentElement = this; this.children.push(c); } return this; }
    remove() { if (this.parentElement) { this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1); this.parentElement = null; } }
    matches(sel) { return this.cls === sel; }
    closest(sel) { for (let p = this; p; p = p.parentElement) if (p.cls === sel) return p; return null; }
    querySelectorAll(sel) { const out = []; const walk = e => { for (const c of e.children) { visited++; if (c.cls === sel) out.push(c); walk(c); } }; walk(this); return out; }
}
const TEXT = { nodeType: 3 };
// tab-scroll.js 의 scan 과 같은 판정 — 묶이는 줄을 모아요
const BAR = 'bar';
function scan(node, bound) {
    if (node.nodeType !== 1) return;
    if (node.closest('.mes'.slice(1))) return;
    if (node.matches(BAR)) bound.add(node);
    for (const b of node.querySelectorAll(BAR)) bound.add(b);
}
const oldWay = records => { const bound = new Set(); for (const r of records) r.addedNodes.forEach(n => scan(n, bound)); return bound; };
const newWay = records => { const bound = new Set(); for (const n of outermostAdded(records)) scan(n, bound); return bound; };

let seed = 4242;
const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 4) % n; };
const pick = a => a[rnd(a.length)];
function tree(depth) {
    const e = new El(pick(['', '', '', 'bar', 'mes']));
    if (depth > 0) for (let i = rnd(4); i > 0; i--) e.append(tree(depth - 1));
    return e;
}
const all = r => { const out = [r]; const walk = e => e.children.forEach(c => { out.push(c); walk(c); }); walk(r); return out; };

test('무작위 묶음 2,000개에서 묶이는 줄이 예전과 같아요', () => {
    let saved = 0, total = 0;
    for (let t = 0; t < 2000; t++) {
        const doc = new El(); doc.append(tree(4), tree(4));
        // 붙은 요소: 문서 안 아무 요소(겹쳐 붙음) · 떨어뜨린 가지 · 같은 요소 두 번 · 글자 노드
        const nodes = all(doc).slice(1);
        const added = Array.from({ length: 1 + rnd(8) }, () => (rnd(10) === 0 ? TEXT : pick(nodes)));
        if (rnd(4) === 0) added[0].remove?.();
        const records = []; for (let i = 0; i < added.length;) { const n = 1 + rnd(3); records.push({ addedNodes: added.slice(i, i + n), removedNodes: [] }); i += n; }
        const a = oldWay(records), b = newWay(records);
        assert.deepEqual([...b].sort((x, y) => all(doc).indexOf(x) - all(doc).indexOf(y)).length, a.size);
        for (const x of a) assert.ok(b.has(x), `묶음 ${t}: 예전엔 묶였는데 빠졌어요`);
        for (const x of b) assert.ok(a.has(x), `묶음 ${t}: 예전엔 안 묶였는데 묶였어요`);
        total += new Set(added.filter(n => n.nodeType === 1)).size; saved += outermostAdded(records).length;
    }
    console.log(`        훑는 뿌리 ${total} → ${saved}`);
    assert.ok(saved < total);
});

test('미세 벤치 — 그릇 하나와 그 안 줄 200개를 따로 붙인 묶음: querySelectorAll 이 도는 요소 수', () => {
    const doc = new El(), box = new El();
    doc.append(box);
    const rows = Array.from({ length: 200 }, () => { const r = new El(); r.append(new El('bar'), new El(), new El()); box.append(r); return r; });
    const records = [{ addedNodes: [box], removedNodes: [] }, ...rows.map(r => ({ addedNodes: [r], removedNodes: [] }))];
    visited = 0; const a = oldWay(records); const before = visited;
    visited = 0; const b = newWay(records); const after = visited;
    assert.equal(a.size, 200); assert.equal(b.size, 200);
    console.log(`        훑은 요소 ${before} → ${after}`);
    assert.ok(after * 1.5 < before, `${after} vs ${before}`);
});

console.log(`tab-scroll-batch: ${pass}개 통과`);
