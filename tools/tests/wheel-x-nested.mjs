// 8.2.4 사후 검토(review-824): Shift 없는 가로 휠(src/wheel-x.js) — 세로로 굴러가는 칸이 바깥 가로 넘침 칸 안에 있을 때 세로 스크롤을 빼앗지 않는지.
// 고치기 전: 가로로 안 넘치는 칸은 세로로 넘쳐도 그냥 지나쳐, 바깥 칸(예: overflow auto 인 팝업 · 설정 칸이 몇 px 가로로 넘침)을 찾아 휠을 가로로 바꿨어요
//   → 안쪽 목록을 휠로 내리려 하면 바깥이 옆으로 밀리거나(끝까지 밀릴 때까지) 방향을 바꿀 때마다 한 칸씩 먹혔어요.
//   node tools/tests/wheel-x-nested.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { findWheelStrip } = await import(pathToFileURL(path.join(root, 'src/wheel-x.js')));
let pass = 0;
const test = (name, fn) => { fn(); pass++; console.log('PASS ' + name); };

const doc = { body: null };
function el(box = {}) {
    const node = { nodeType: 1, parentElement: null, ownerDocument: doc, clientWidth: 300, scrollWidth: 300, clientHeight: 200, scrollHeight: 200, overflowX: 'visible', overflowY: 'visible', ...box };
    node.matches = () => false;
    node.closest = () => null;
    return node;
}
const body = el(); doc.body = body;
const under = (parent, child) => { child.parentElement = parent; return child; };
const calls = [];
const style = n => { calls.push(n); return { overflowX: n.overflowX, overflowY: n.overflowY }; };

test('세로로 굴러가는 목록(가로는 맞음) 안에서는 바깥 가로 넘침 칸까지 올라가지 않아요 (고치기 전: 바깥 칸)', () => {
    const outer = under(body, el({ scrollWidth: 304, overflowX: 'auto', overflowY: 'auto' }));   // 4px 가로 넘침 · 세로는 맞음
    const list = under(outer, el({ scrollHeight: 900, overflowY: 'auto', overflowX: 'hidden' }));
    const row = under(list, el({ clientHeight: 40, scrollHeight: 40 }));
    assert.equal(findWheelStrip(row, body, style), null);
});
test('세로로 넘쳐도 overflow 가 visible · hidden 이면(굴러가지 않는 칸) 그대로 지나쳐 가로 줄을 찾아요', () => {
    const strip = under(body, el({ scrollWidth: 900, clientHeight: 60, scrollHeight: 60, overflowX: 'auto', overflowY: 'hidden' }));
    for (const overflowY of ['visible', 'hidden', 'clip']) {
        const tall = under(strip, el({ clientWidth: 80, scrollWidth: 80, clientHeight: 20, scrollHeight: 48, overflowY }));
        assert.equal(findWheelStrip(under(tall, el({ clientWidth: 80, clientHeight: 20, scrollHeight: 20 })), body, style), strip, overflowY);
    }
});
test('즐겨찾기 줄처럼 아무것도 세로로 안 넘치면 getComputedStyle 은 줄 하나에만', () => {
    const strip = under(body, el({ scrollWidth: 900, clientHeight: 60, scrollHeight: 60, overflowX: 'auto' }));
    const avatar = under(strip, el({ clientWidth: 50, scrollWidth: 50, clientHeight: 50, scrollHeight: 50 }));
    calls.length = 0;
    assert.equal(findWheelStrip(avatar, body, style), strip);
    assert.deepEqual(calls, [strip]);
});
console.log(`가로 휠 · 안쪽 세로 칸: ${pass}개 통과했어요.`);
