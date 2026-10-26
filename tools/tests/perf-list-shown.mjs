// 성능 보조 — 프롬프트 관리자 목록이 그려지는지(src/addons/perf/shown.js): 스타일 계산을 강제하는 읽기(checkVisibility ·
// getClientRects · getComputedStyle · offset*)를 부르지 않고, 조상의 class · 인라인 style · hidden 만으로 답하는지 본다.
//   node tools/tests/perf-list-shown.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const { listShown } = await import(pathToFileURL(path.join(root, 'src/addons/perf/shown.js')).href);

const forced = [];
function el(classes = [], { display = '', visibility = '', hidden = false } = {}, parent = null) {
    const node = {
        nodeType: 1, parentElement: parent, hidden, isConnected: true,
        style: { display, visibility },
        classList: { contains: c => classes.includes(c) },
    };
    for (const name of ['checkVisibility', 'getClientRects', 'getBoundingClientRect']) node[name] = () => { forced.push(name); return name === 'checkVisibility' ? true : [{}]; };
    for (const name of ['offsetParent', 'offsetHeight', 'clientHeight']) Object.defineProperty(node, name, { get() { forced.push(name); return 1; } });
    return node;
}
globalThis.getComputedStyle = () => { forced.push('getComputedStyle'); return {}; };

const body = el(['salty']);
globalThis.document = { body };
const holder = el([], {}, body);
const drawer = el(['drawer-content', 'fillLeft', 'openDrawer'], {}, holder);
const range = el(['range-block'], { display: 'block' }, drawer);
const list = el([], {}, range);

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };

test('열린 서랍 · 숨김 없는 조상 → 보임', () => assert.equal(listShown(list), true));
test('닫힌 서랍(.openDrawer 없음) → 안 보임', () => {
    const closed = el(['drawer-content', 'closedDrawer'], {}, holder);
    assert.equal(listShown(el([], {}, el([], {}, closed))), false);
});
test('실리태번이 API 칸을 인라인 display:none 으로 숨기면 → 안 보임', () => {
    const hiddenRange = el(['range-block'], { display: 'none' }, drawer);
    assert.equal(listShown(el([], {}, hiddenRange)), false);
});
test('hidden 속성 · visibility:hidden · displayNone 클래스 → 안 보임', () => {
    assert.equal(listShown(el([], {}, el([], { hidden: true }, drawer))), false);
    assert.equal(listShown(el([], {}, el([], { visibility: 'hidden' }, drawer))), false);
    assert.equal(listShown(el([], {}, el(['displayNone'], {}, drawer))), false);
});
test('문서에 없는 목록 · 없음 → 안 보임', () => {
    const gone = el([], {}, drawer); gone.isConnected = false;
    assert.equal(listShown(gone), false);
    assert.equal(listShown(null), false);
    assert.equal(listShown(undefined), false);
});
test('서랍 밖(서랍 조상 없음)이어도 숨김이 없으면 보임 — 미루지 않고 실리태번 그대로 그린다', () => assert.equal(listShown(el([], {}, body)), true));
test('어느 경우에도 스타일 · 배치를 강제하는 읽기를 부르지 않는다', () => assert.deepEqual(forced, []));

console.log(`perf-list-shown: ${n}/${n} 통과`);
