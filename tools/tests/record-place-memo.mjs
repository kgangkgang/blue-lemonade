// 1.2.1 감시 허브 「조판 (그리기 전)」 · 「메시지 꾸미기 (이벤트 밖 변화)」 — 기록마다 closest 두 번(진행 표시 · 메시지) 하던 것을 묶음 안 요소마다 한 번으로(src/message-decor.js recordPlaceMemo)
//   ① 아무렇게나 지은 나무(진행 표시 · 메시지 · 겹친 메시지 · 떨어진 가지)에서 답이 closest('.llmt-progress') · closest('.mes') 와 같아요
//   ② 같은 요소 · 같은 조상은 다시 올라가지 않아요(요소마다 class 를 한 번만 봐요)
//   ③ 두 구독이 기록마다 closest 를 다시 부르지 않아요(되돌리면 실패)
//   node tools/tests/record-place-memo.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
globalThis.document ??= { compatMode: 'CSS1Compat', getElementById: () => null };
const { recordPlaceMemo } = await import(pathToFileURL(path.join(root, 'src/message-decor.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

let looks = 0;
class El {
    constructor(cls = '') { this.nodeType = 1; this.parentElement = null; this.kids = []; const set = new Set(cls.split(/\s+/).filter(Boolean)); this.classList = { contains: c => { looks++; return set.has(c); } }; this.cls = set; }
    add(k) { k.parentElement = this; this.kids.push(k); return k; }
    closest(sel) { const c = sel.replace(/^\./, ''); for (let n = this; n; n = n.parentElement) if (n.cls.has(c)) return n; return null; }
}
// 씨앗 있는 난수(시험이 늘 같은 나무를 지어요)
let seed = 12345; const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
const CLASSES = ['', '', '', 'mes', 'mes_text', 'llmt-progress', 'mes llmt-progress', 'p', 'q'];
function grow(depth, into, all) {
    if (depth <= 0) return;
    for (let i = 0, n = 1 + rnd(3); i < n; i++) { const el = into.add(new El(CLASSES[rnd(CLASSES.length)])); all.push(el); grow(depth - 1, el, all); }
}

test('① 답이 closest 두 번과 같아요(진행 표시는 메시지보다 위 · 아래 어디든)', () => {
    for (let t = 0; t < 40; t++) {
        const top = new El(t % 2 ? 'chat' : ''), all = [top];
        grow(6, top, all);
        const loose = new El('mes'); const leaf = loose.add(new El('q')); all.push(loose, leaf);   // 떨어진 가지
        const place = recordPlaceMemo();
        // 아무 차례로(아래부터 · 위부터 섞어) 물어도 같아요
        const order = all.map((el, i) => [rnd(1000), el, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
        for (const el of order) {
            const got = place(el);
            assert.equal(got.skip, !!el.closest('.llmt-progress'));
            assert.equal(got.mes, el.closest('.mes'));
        }
    }
    const place = recordPlaceMemo();
    assert.deepEqual(place(null), { skip: false, mes: null });
    assert.deepEqual(place(undefined), { skip: false, mes: null });
});

test('② 같은 요소 · 같은 조상은 다시 올라가지 않아요', () => {
    const top = new El('chat'), all = [top];
    grow(6, top, all);
    const place = recordPlaceMemo();
    looks = 0;
    for (let i = 0; i < 20; i++) for (const el of all) place(el);
    assert.ok(looks <= all.length * 2, `class 를 본 횟수 ${looks} — 요소 ${all.length}개 × 2(진행 표시 · 메시지) 안`);
});

test('③ 조판 · 메시지 꾸미기 구독이 기록마다 closest 를 다시 부르지 않아요', () => {
    const typo = fs.readFileSync(path.join(root, 'src/typography.js'), 'utf8');
    const sub = typo.slice(typo.indexOf("name:'조판 (그리기 전)'"));
    const loop = sub.slice(0, sub.indexOf('// 5.3.2'));
    assert.ok(/recordPlaceMemo\(\)/.test(loop), '조판 구독은 recordPlaceMemo 로');
    assert.ok(!/closest\('\.llmt-progress'\)|closest\('\.mes'\)/.test(loop), '조판 구독 기록 고리에 closest 가 남았어요');
    const decor = fs.readFileSync(path.join(root, 'src/message-decor.js'), 'utf8');
    const on = decor.slice(decor.indexOf('function onRecords('), decor.indexOf('function start('));
    assert.ok(/recordPlaceMemo\(\)/.test(on), '메시지 꾸미기 구독은 recordPlaceMemo 로');
    assert.ok(!/closest/.test(on), '메시지 꾸미기 기록 고리에 closest 가 남았어요');
});

console.log(`record-place-memo: ${pass} PASS`);
