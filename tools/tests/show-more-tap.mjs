// 7.9.9 「이전 메시지 더 보기」를 손으로 눌렀을 때 불러온 메시지를 보여 주기 (src/show-more-tap.js) + 자동 더 보기 잠깐 쉬기 (show-more-auto.js holdAuto).
// 실리태번 · 브라우저 없음 — 작은 채팅 칸 흉내(높이 모델)로 실리태번 showMoreMessages 의 「끼워 넣고 단추가 창 안이면 scrollTop 을 들어온 높이로」 를 그대로 흉내 낸다.
//   node tools/tests/show-more-tap.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const T = await import(pathToFileURL(path.join(root, 'src/show-more-tap.js')).href);
let n = 0; const t = (name, fn) => { fn(); n++; console.log('PASS ' + name); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 채팅 칸 흉내: 메시지 높이 목록 · 맨 위 단추(40px) · scrollTop 은 브라우저처럼 바닥에서 자른다 ──
function world({ heights = [500], viewport = 668, button = 40 } = {}) {
    const s = { heights: heights.slice(), top: 0, button };
    const total = () => s.button + s.heights.reduce((a, b) => a + b, 0);
    const mesTop = i => s.button + s.heights.slice(0, i).reduce((a, b) => a + b, 0);
    const nodes = [];
    const chat = {
        id: 'chat', clientHeight: viewport, clientTop: 0,
        get scrollHeight() { return total(); },
        get scrollTop() { return s.top; }, set scrollTop(v) { s.top = Math.max(0, Math.min(v, total() - viewport)); },
        getBoundingClientRect: () => ({ top: 0 }),
        querySelector: sel => (sel === '.mes' ? nodes[0] ?? null : null),
        querySelectorAll: sel => (sel === '.mes' ? nodes.slice() : []),
    };
    const makeNode = i => ({ isConnected: true, get index() { return nodes.indexOf(this); }, getBoundingClientRect() { return { top: mesTop(this.index) - s.top }; } });
    const rebuild = () => { nodes.length = 0; for (let i = 0; i < s.heights.length; i++) nodes.push(makeNode(i)); };
    rebuild();
    /** 실리태번 showMoreMessages 흉내: 위에 끼워 넣고, 단추가 창 안(위 0~viewport)이면 scrollTop 을 들어온 높이로 (script.js) */
    const insert = (added, { buttonRemains = true } = {}) => {
        const prevHeight = total(), buttonInView = -s.top >= 0 && (s.button - s.top) <= viewport;
        const old = nodes.slice(); s.heights.unshift(...added); rebuild();
        for (let i = 0; i < old.length; i++) { old[i].isConnected = true; nodes[added.length + i] = old[i]; }   // 옛 요소는 같은 객체(그대로 연결)
        if (!buttonRemains) s.button = 0;
        if (buttonInView) chat.scrollTop = total() - prevHeight;
        else if (s.top > 0) chat.scrollTop = s.top + (total() - prevHeight);   // 브라우저 스크롤 앵커링 (맨 위 0 이 아닐 때만)
    };
    return { chat, insert, s, nodes, button: { id: 'show_more_messages', closest: sel => (sel === '#show_more_messages' ? this : null) } };
}

t('revealTarget: 들어온 블록이 화면보다 짧으면 0 · 길면 「보던 첫 메시지 위쪽 OVERLAP 만 남긴 자리」 · 위로 가는 경우만', () => {
    assert.equal(T.revealTarget({ oldFirstTop: 540, clientHeight: 668, scrollTop: 500 }), 0);
    assert.equal(T.revealTarget({ oldFirstTop: 3000, clientHeight: 668, scrollTop: 2960 }), 3000 - 668 + T.OVERLAP);
    assert.equal(T.revealTarget({ oldFirstTop: 3000, clientHeight: 668, scrollTop: 100 }), null, '이미 더 위에 있으면 내리지 않는다');
    assert.equal(T.revealTarget({ oldFirstTop: NaN, clientHeight: 668, scrollTop: 100 }), null);
});
t('사용자 조건(1개씩 · 자동 끔): 화면이 찬 뒤 누르면 실리태번은 scrollTop 을 한 메시지만큼 내려 새 메시지를 숨긴다 → 되돌려 보여 준다(맨 위)', () => {
    const w = world({ heights: [500, 700] }); w.chat.scrollTop = 0;   // 두 번째 누름 상황: 내용 1240 > 668
    const oldFirst = w.nodes[0], oldCount = 2;
    w.insert([300]);
    assert.equal(w.chat.scrollTop, 300, '실리태번 보정: 보던 첫 메시지가 제자리 → 새 메시지는 화면 위로 숨음');
    assert.equal(T.revealLoaded(w.chat, oldFirst, oldCount), true);
    assert.equal(w.chat.scrollTop, 0, '단추 + 새 메시지(300) + 보던 첫 메시지 일부가 보인다');
});
t('100개를 불러와 화면보다 길면: 새 블록의 끝이 화면 아래에 오고 보던 첫 메시지 위쪽 24px 만 보인다', () => {
    const w = world({ heights: Array(10).fill(300) }); w.chat.scrollTop = 0;
    const oldFirst = w.nodes[0];
    w.insert(Array(100).fill(250));
    assert.equal(w.chat.scrollTop, 25000);
    assert.equal(T.revealLoaded(w.chat, oldFirst, 10), true);
    assert.equal(w.chat.scrollTop, 40 + 25000 - 668 + T.OVERLAP);
});
t('들어온 것이 없거나(다 불러옴 · 실패) 첫 메시지가 떨어져 나갔으면 손대지 않는다', () => {
    const w = world({ heights: [500, 700] }); w.chat.scrollTop = 300;
    assert.equal(T.revealLoaded(w.chat, w.nodes[0], 2), false); assert.equal(w.chat.scrollTop, 300);
    const gone = { isConnected: false }; assert.equal(T.revealLoaded(w.chat, gone, 1), false);
    assert.equal(T.revealLoaded(null, w.nodes[0], 1), false);
});
t('단추가 창 밖(브라우저 앵커링이 자리를 지킨 경우)에도 같은 계산으로 보여 준다', () => {
    const w = world({ heights: [500, 700, 600] }); w.chat.scrollTop = 900;   // 단추는 위로 900px 밖
    const oldFirst = w.nodes[0];
    w.insert([400, 400]);
    assert.equal(w.chat.scrollTop, 1700, '앵커링: 그대로 보인다');
    assert.equal(T.revealLoaded(w.chat, oldFirst, 3), true);
    assert.equal(w.chat.scrollTop, 40 + 800 - 668 + T.OVERLAP);
});

// ── 설치: 손으로 누른 클릭(isTrusted)만 · 스크립트 .click() 은 건너뜀 · 디스패치가 끝난 뒤(타이머 0) 보여 준다 · 자동 더 보기 holdAuto ──
await (async () => {
    const listeners = new Map();
    const w = world({ heights: [500, 700] }); w.chat.scrollTop = 0;
    const doc = { addEventListener: (type, fn, cap) => listeners.set(type + cap, fn), removeEventListener: (type, fn, cap) => listeners.delete(type + cap), getElementById: id => (id === 'chat' ? w.chat : null) };
    globalThis.document = doc;
    const held = []; globalThis.SillyTavern = { getContext: () => ({ eventSource: { on() {}, removeListener() {} }, event_types: {} }) };
    const A = await import(pathToFileURL(path.join(root, 'src/show-more-auto.js')).href);
    const off = T.installShowMoreTap(doc);
    const click = isTrusted => { const target = { closest: sel => (sel === '#show_more_messages' ? target : null) }; listeners.get('clicktrue')({ isTrusted, target, currentTarget: doc }); w.insert([300]); };   // 리스너(캡처) 뒤 실리태번 핸들러가 동기로 끼워 넣음
    click(false); await sleep(10);
    t('설치: 스크립트 .click() 은 그대로 — 실리태번 보정(300)만 남는다', () => { assert.equal(w.chat.scrollTop, 300); });
    w.chat.scrollTop = 0;
    const before = Date.now(); click(true); assert.equal(w.chat.scrollTop, 300, '디스패치 직후엔 아직 실리태번 보정 상태'); await sleep(10);
    t('설치: 손으로 누르면 디스패치가 끝난 뒤 보여 준다 (0) · 자동 더 보기는 HOLD 동안 쉰다', () => { assert.equal(w.chat.scrollTop, 0); assert.equal(A._forTest.state().holding, true); assert.ok(T.HOLD >= 1000); });
    t('설치: 떼면 더 듣지 않는다', () => { assert.equal(off(), true); assert.equal(listeners.has('clicktrue'), false); assert.equal(T.uninstallShowMoreTap(), false); });
    void before; void held;
})();
console.log(`show-more-tap: ${n} passed`);
