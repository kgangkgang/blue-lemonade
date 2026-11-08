// 1.0.8 채팅에서 끌어 고르다 입력창(아래) · 머리줄(위)에 닿아도 고른 끝이 채팅 밖으로 나가 채팅 끝까지 다 골라지지 않는지
//   node tools/tests/selection-keep-in-chat.mjs <테마 루트>
// 가짜 문서로 selection-bar.js 의 keepInChat 을 돌려 「시작이 채팅 안 · 끝이 밖이면 채팅 칸에 보이는 맨 아래(위) 줄로 붙잡는다 · 안이면 건드리지 않는다」를 봐요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const FOLLOWING = 4, PRECEDING = 2;
globalThis.Node = { DOCUMENT_POSITION_FOLLOWING: FOLLOWING, DOCUMENT_POSITION_PRECEDING: PRECEDING };
// 문서 순서: top(머리줄) < chat 안 글 a · b · c < form(입력창)
const order = ['top', 'a', 'b', 'c', 'form'];
const node = name => ({ name, compareDocumentPosition: other => (order.indexOf(other.name) > order.indexOf(name) ? FOLLOWING : PRECEDING) });
const N = Object.fromEntries(order.map(n => [n, node(n)]));
const inChat = new Set([N.a, N.b, N.c]);
const chat = { contains: n => inChat.has(n), getBoundingClientRect: () => ({ left: 0, right: 400, top: 50, bottom: 650, width: 400, height: 600 }) };
let selection, extended, probes, hit;
const reset = (anchor, focus, hitAt = () => N.b) => {
    extended = null; probes = []; hit = hitAt;
    selection = { anchorNode: anchor, focusNode: focus, rangeCount: 1, extend: (n, o) => { extended = [n.name, o]; } };
};
globalThis.document = {
    getSelection: () => selection,
    getElementById: id => (id === 'chat' ? chat : null),
    caretPositionFromPoint: (x, y) => { probes.push([x, y]); const n = hit(x, y); return n ? { offsetNode: n, offset: 7 } : null; },
};
const { keepInChat } = await import(pathToFileURL(path.join(root, 'src/selection-bar.js')).href);

// 아래로 끌어 입력창에 닿음 → 채팅 맨 아래 줄로
reset(N.a, N.form);
assert.equal(keepInChat(), true);
assert.deepEqual(extended, ['b', 7]);
assert.deepEqual(probes[0], [200, 644], '가로는 채팅 가운데(끈 자리를 모르면) · 세로는 채팅 칸 아래 끝 바로 안');

// 위로 끌어 머리줄에 닿음 → 채팅 맨 위 줄로
reset(N.c, N.top);
assert.equal(keepInChat(), true);
assert.deepEqual(probes[0], [200, 56]);

// 맨 아래 자리가 채팅 밖(떠 있는 도구 줄)이면 안쪽으로 조금씩 올라가며 찾는다
reset(N.a, N.form, (x, y) => (y > 620 ? N.form : N.c));
assert.equal(keepInChat(), true);
assert.deepEqual(extended, ['c', 7]);
assert.ok(probes.length > 1 && probes.at(-1)[1] <= 620);

// 끝이 채팅 안이면 건드리지 않는다
reset(N.a, N.c);
assert.equal(keepInChat(), false);
assert.equal(extended, null);
assert.equal(probes.length, 0, '채팅 안 끌기에서는 자리를 재지 않는다');

// 시작이 채팅 밖(입력창에서 고름)이면 건드리지 않는다
reset(N.form, N.top);
assert.equal(keepInChat(), false);
assert.equal(extended, null);

// 끝을 붙잡을 채팅 안 자리를 못 찾으면 그대로 둔다
reset(N.a, N.form, () => N.form);
assert.equal(keepInChat(), false);
assert.equal(extended, null);

console.log('selection-keep-in-chat: 6 통과');
