// 1.2.1 opt: lite 「서랍 · 팝업 열림」 구독의 묶음 처리(panelBatch, src/lite.js)가 예전 콜백 고리와
//   ① 무작위 묶음 3,000개 × (열림 / 닫힘) × (숫자 쉼표 있음 / 없음)에서 같은 답 · 같은 tap 차례인지
//   ② 한 묶음 안 같은 요소의 속성 기록에는 「옛 팝업을 품었나」(그 요소 아래 querySelector)를 한 번만 묻는지(서랍 여닫기 애니메이션 꼴) 봐요
//   ③ 미세 벤치: 큰 서랍(요소 2,000개)의 style 기록 30개 묶음 — 예전 → 지금 querySelector 횟수 · 시간(가짜 DOM · 노드)
//   node tools/tests/lite-panel-batch.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const dom = await import(pathToFileURL(path.join(root, 'tools/tests/leak-dom.mjs')).href);
dom.installBrowser({});
const { panelBatch } = await import(pathToFileURL(path.join(root, 'src/lite.js')).href);
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('  PASS  ' + name); };
assert.equal(typeof panelBatch, 'function', 'panelBatch 를 내보내요');

const LEGACY_POPUPS = '#character_popup, #world_popup, #select_chat_popup, #shadow_popup, #dialogue_popup, #export_format_popup';
const OPENERS = `.openDrawer, dialog, ${LEGACY_POPUPS}`;
// 1.1.9 콜백 고리 그대로 — 기준
function oldBatch(list, { on, tap, body }) {
    const mayOpen = (m) => {
        const t = m.target;
        if (m.type === 'childList') return [...m.addedNodes].some(n => n.nodeType === 1 && (n.matches(OPENERS) || !!n.querySelector(OPENERS)));
        if (m.attributeName === 'open' || t.classList.contains('openDrawer')) return true;
        return t !== body && (t.matches(LEGACY_POPUPS) || !!t.querySelector(LEGACY_POPUPS));
    };
    let hit = false;
    for (const m of list) {
        const t = m.target;
        if (t.nodeType !== 1 || t.closest?.('#chat, #form_sheld')) continue;
        if (tap) tap(m);
        if (hit || (!on && !mayOpen(m))) continue;
        hit = true;
        if (!tap) break;
    }
    return hit;
}

const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.append(...kids); return e; };
const body = document.body;
const sheld = el('div', { id: 'sheld' }, el('div', { id: 'chat' }, el('div', { class: 'mes' }, el('span'))), el('div', { id: 'form_sheld' }, el('textarea')));
const drawerA = el('div', { class: 'drawer-content closedDrawer' }, ...Array.from({ length: 40 }, () => el('div', { class: 'flex-container' }, el('input'), el('span'))));
const drawerB = el('div', { class: 'drawer-content openDrawer' }, el('div', {}, el('span')));
const popupWrap = el('div', { class: 'wrap' }, el('div', { id: 'character_popup' }, el('div')));
body.append(sheld, drawerA, drawerB, popupWrap, el('dialog'));
const all = [body, ...body.querySelectorAll('*')];
const text = document.createTextNode('x'); body.querySelector('span').append(text);

let seed = 99;
const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 4) % n; };
const pick = a => a[rnd(a.length)];
const freshAdd = () => pick([el('div'), el('div', { class: 'openDrawer' }), el('dialog'), el('div', {}, el('div', { id: 'world_popup' })), el('span', {}, el('b')), document.createTextNode('t')]);
function record() {
    const k = rnd(6);
    if (k === 0) return { type: 'characterData', target: text, addedNodes: [] };
    if (k === 1) return { type: 'childList', target: pick(all), addedNodes: Array.from({ length: rnd(3) }, freshAdd), removedNodes: [] };
    return { type: 'attributes', attributeName: pick(['class', 'style', 'open']), target: pick(all), addedNodes: [] };
}

test('무작위 묶음 3,000개 × 열림/닫힘 × tap 있음/없음 — 답과 tap 차례가 예전과 같아요', () => {
    let hits = 0, taps = 0;
    for (let i = 0; i < 3000; i++) {
        const list = Array.from({ length: 1 + rnd(12) }, record);
        for (const on of [false, true]) for (const withTap of [false, true]) {
            const a = [], b = [];
            const ra = oldBatch(list, { on, tap: withTap ? m => a.push(m) : null, body });
            const rb = panelBatch(list, { on, tap: withTap ? m => b.push(m) : null, body });
            assert.equal(rb, ra);
            assert.equal(b.length, a.length); for (let j = 0; j < a.length; j++) assert.equal(b[j], a[j]);
            hits += ra ? 1 : 0; taps += a.length;
        }
    }
    console.log(`        열림 판정 참 ${hits}번 · tap ${taps}번`);
    assert.ok(hits > 3000 && hits < 12000);
});

// querySelector 횟수 세기(이 시험의 요소 원형에)
const proto = Object.getPrototypeOf(drawerA);
const qs = proto.querySelector; let qsCalls = 0;
proto.querySelector = function (s) { qsCalls++; return qs.call(this, s); };

test('같은 요소의 속성 기록이 여럿이면 「옛 팝업을 품었나」는 한 번만 물어요', () => {
    const list = Array.from({ length: 30 }, (_, i) => ({ type: 'attributes', attributeName: 'style', target: drawerA, addedNodes: [] }));
    qsCalls = 0; assert.equal(oldBatch(list, { on: false, tap: null, body }), false); const before = qsCalls;
    qsCalls = 0; assert.equal(panelBatch(list, { on: false, tap: null, body }), false); const after = qsCalls;
    assert.equal(before, 30); assert.equal(after, 1);
});

test('미세 벤치 — 큰 서랍(요소 2,000개)의 style 기록 30개 묶음 × 10번', () => {
    const big = el('div', { class: 'drawer-content' }, ...Array.from({ length: 500 }, () => el('div', { class: 'row' }, el('input'), el('span', {}, el('b')))));
    body.append(big);
    const list = Array.from({ length: 30 }, () => ({ type: 'attributes', attributeName: 'style', target: big, addedNodes: [] }));
    const run = fn => { qsCalls = 0; const t0 = process.hrtime.bigint(); for (let k = 0; k < 10; k++) fn(list, { on: false, tap: null, body }); return [Number(process.hrtime.bigint() - t0) / 1e6, qsCalls]; };
    const [tb, qb] = run(oldBatch), [ta, qa] = run(panelBatch);
    console.log(`        ${tb.toFixed(1)} → ${ta.toFixed(1)}ms · querySelector ${qb} → ${qa}번`);
    assert.ok(qa * 10 <= qb);
    big.remove();
});
proto.querySelector = qs;

console.log(`lite-panel-batch: ${pass}개 통과`);
process.exit(0);
