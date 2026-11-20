// 1.6.1 공용 「창 겹 쌓기」(src/layer-back.js) — 겹 하나 = 브라우저 기록 한 칸. 가짜 기록(pushState · go · popstate)으로 돌려 봐요.
//   ① 겹을 올리면 기록 한 칸(주소 · 남의 상태 그대로) ② 뒤로 가기 = 맨 위 겹 하나만 닫음 ③ ✕ 로 닫으면 기록 한 칸을 스스로 물려 다음 뒤로 가기가 헛돌지 않음
//   ④ 연달아 닫아도 더 물러나지 않음 ⑤ 안 닫힌 겹은 남고 기록을 다시 채움 ⑥ 새로 고침 · 앞으로 가기로 깊이만 남은 칸이면 스스로 물러남 ⑦ 기록을 못 쓰는 환경이면 아무것도 안 함
//   node tools/tests/layer-back.mjs [저장소 뿌리]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const M = await import(pathToFileURL(path.join(root, 'src/layer-back.js')).href);
let n = 0; const ok = async (name, fn) => { await fn(); n++; console.log('ok', name); };

/** 가짜 창: 기록 칸 목록 · go 는 비동기(실제처럼 다음 박자에 popstate 한 번) · left = 페이지를 떠난 횟수 */
const fakeWin = (entries = [{ app: 1 }], at = entries.length - 1) => {
    const w = { entries: entries.slice(), at, left: 0, moves: [], listeners: [], queue: Promise.resolve() };
    w.history = {
        get state() { return w.entries[w.at]; },
        pushState(state, title, url) { assert.equal(url, undefined, '주소는 안 바꿔요'); w.entries.length = w.at + 1; w.entries.push(state); w.at++; },
        go(d) { w.moves.push(d); w.queue = w.queue.then(() => { const to = w.at + d; if (to < 0) { w.left++; return; } if (to >= w.entries.length) return; w.at = to; const ev = { state: w.entries[w.at], stopped: false, stopImmediatePropagation() { this.stopped = true; } }; for (const l of [...w.listeners.filter(x => x.capture), ...w.listeners.filter(x => !x.capture)]) { if (ev.stopped) break; l.fn(ev); } }); },
        back() { this.go(-1); }, forward() { this.go(1); },
    };
    w.addEventListener = (type, fn, capture = false) => { assert.equal(type, 'popstate'); w.listeners.push({ fn, capture: capture === true || capture?.capture === true }); };   // 창이 과녁인 사건: 잡는 단계 듣는 곳이 먼저 불려요(걸린 차례와 상관없이)
    w.idle = async () => { for (let i = 0; i < 8; i++) { await w.queue; await new Promise(r => setTimeout(r, 0)); } };
    return w;
};
const depth = w => w.entries[w.at]?.[M.DEPTH_KEY] || 0;

await ok('① 겹을 올리면 기록 한 칸 — 남이 적어 둔 상태는 그대로 두고 깊이만 더해요 · 듣는 곳은 하나', async () => {
    const w = fakeWin(); const L = M.createLayers(w);
    L.open(() => true); L.open(() => true);
    assert.equal(w.entries.length, 3); assert.deepEqual(w.entries[1], { app: 1, [M.DEPTH_KEY]: 1 }); assert.deepEqual(w.entries[2], { app: 1, [M.DEPTH_KEY]: 2 });
    assert.equal(L.size, 2); assert.equal(w.listeners.length, 1); assert.deepEqual(w.moves, []);
});
await ok('② 뒤로 가기 한 번 = 맨 위 겹 하나만 · 다 닫힌 뒤의 뒤로 가기는 원래대로(페이지 쪽)', async () => {
    const w = fakeWin([{ before: 1 }, { app: 1 }]); const L = M.createLayers(w); const closed = [];
    L.open(() => { closed.push('a'); }); L.open(() => { closed.push('b'); });
    w.history.back(); await w.idle();
    assert.deepEqual(closed, ['b']); assert.equal(L.size, 1); assert.equal(depth(w), 1);
    w.history.back(); await w.idle();
    assert.deepEqual(closed, ['b', 'a']); assert.equal(L.size, 0); assert.equal(w.at, 1); assert.equal(depth(w), 0);
    assert.deepEqual(w.moves, [-1, -1]);                               // 테마가 스스로 더 움직인 것 없음
    w.history.back(); await w.idle(); assert.equal(w.at, 0); assert.deepEqual(closed, ['b', 'a']);   // 실리태번 쪽 원래 동작 그대로
});
await ok('③ ✕ 로 닫으면(done) 기록 한 칸을 스스로 물려요 — 다음 뒤로 가기가 헛돌지 않아요 · done 을 두 번 불러도 한 번', async () => {
    const w = fakeWin(); const L = M.createLayers(w); let closes = 0;
    const done = L.open(() => { closes++; });
    done(); done(); await w.idle();
    assert.equal(L.size, 0); assert.equal(w.at, 0); assert.equal(depth(w), 0); assert.deepEqual(w.moves, [-1]); assert.equal(closes, 0);
    const again = L.open(() => { closes++; });                         // 다시 열면 앞으로 가기 칸을 덮어요
    assert.equal(w.entries.length, 2); assert.equal(depth(w), 1);
    w.history.back(); await w.idle(); assert.equal(closes, 1); again(); await w.idle(); assert.deepEqual(w.moves, [-1, -1]);   // 뒤로 가기로 닫힌 뒤 늦게 온 done 은 아무것도 안 해요
});
await ok('④ 여러 겹을 연달아 ✕ 로 닫아도 딱 그만큼만 물러나요(이동 중에는 새로 안 움직이고 끝난 뒤 맞춰요)', async () => {
    const w = fakeWin([{ before: 1 }, { app: 1 }]); const L = M.createLayers(w);
    const d1 = L.open(() => true), d2 = L.open(() => true), d3 = L.open(() => true);
    d3(); d2(); d1(); await w.idle();
    assert.equal(w.at, 1); assert.equal(w.left, 0); assert.equal(depth(w), 0); assert.equal(w.moves.reduce((a, b) => a + b, 0), -3);
    const e1 = L.open(() => true), e2 = L.open(() => true);            // 아래 겹이 먼저 닫혀도(차례가 달라도) 칸 수만 맞으면 돼요
    e1(); await w.idle(); assert.equal(L.size, 1); assert.equal(depth(w), 1);
    let hit = 0; const e3 = L.open(() => { hit++; }); w.history.back(); await w.idle(); assert.equal(hit, 1); assert.equal(L.size, 1); e2(); e3(); await w.idle(); assert.equal(w.at, 1);
});
await ok('⑤ 안 닫힌 겹(위의 다른 창을 먼저 닫은 때 — close 가 false)은 남고 기록 한 칸을 다시 채워요', async () => {
    const w = fakeWin(); const L = M.createLayers(w); let over = true, closed = 0;
    L.open(() => { if (over) { over = false; return false; } closed++; });
    w.history.back(); await w.idle();
    assert.equal(L.size, 1); assert.equal(depth(w), 1); assert.equal(closed, 0);
    w.history.back(); await w.idle();
    assert.equal(L.size, 0); assert.equal(closed, 1); assert.equal(w.at, 0);
    const X = M.createLayers(fakeWin()); X.open(() => { throw new Error('닫다가 오류'); });   // 닫다가 오류가 나도 겹은 내려요(기록이 창 없이 남지 않게)
});
await ok('⑥ 새로 고친 뒤 · 앞으로 가기로 「겹 없는데 깊이만 남은 칸」 에 서면 스스로 물러나요', async () => {
    const w = fakeWin([{ app: 1 }, { app: 1, [M.DEPTH_KEY]: 1 }, { app: 1, [M.DEPTH_KEY]: 2 }], 2); const L = M.createLayers(w);
    L.start(); await w.idle();
    assert.equal(w.at, 0); assert.deepEqual(w.moves, [-2]);
    w.history.forward(); await w.idle();                               // 앞으로 가기
    assert.equal(w.at, 0); assert.equal(w.left, 0);
});
await ok('⑦ 기록을 못 쓰는 환경 · 닫는 법이 없으면 아무것도 안 해요', async () => {
    const L = M.createLayers({}); const done = L.open(() => true); done(); assert.equal(L.size, 0); L.start();
    const w = fakeWin(); const K = M.createLayers(w); K.open(null); assert.equal(w.entries.length, 1); assert.equal(w.listeners.length, 0);
    const bad = fakeWin(); bad.history.pushState = () => { throw new Error('막힘'); }; const B = M.createLayers(bad); const d = B.open(() => true); assert.equal(B.size, 1); d(); await bad.idle(); assert.deepEqual(bad.moves, []);
});
await ok('⑧ 창을 닫자마자(기록이 아직 물러나는 중) 다른 창을 열어도 새 창이 닫히지 않아요 — 기록은 한 칸으로 맞춰져요', async () => {
    const w = fakeWin(); const L = M.createLayers(w); let closed = 0;
    const d1 = L.open(() => { closed++; });
    d1();                                                              // 물러나는 이동이 아직 안 끝났어요
    L.open(() => { closed++; });
    await w.idle();
    assert.equal(closed, 0); assert.equal(L.size, 1); assert.equal(depth(w), 1); assert.equal(w.at, 1);
    w.history.back(); await w.idle(); assert.equal(closed, 1); assert.equal(L.size, 0); assert.equal(w.at, 0);
});
await ok('⑨ 1.7.6 테마가 스스로 물린 이동(겹을 ✕ · 고르기로 닫은 뒤 기록 한 칸 물리기) · 테마 겹이 쓴 뒤로 가기는 다른 확장의 뒤로 가기 듣는 곳에 안 보여요 — 테마가 닫을 게 없는 뒤로 가기는 그대로 보여요', async () => {
    // 미트볼 상태창 2.9.0 처럼 「뒤로 가기 신호가 오면 제 창을 닫는」 다른 확장을 흉내 내요: 제 창을 열 때 기록 한 칸 · 신호가 오면 닫음
    const w = fakeWin(); const other = { open: true, pops: 0 };
    w.addEventListener('popstate', () => { other.pops++; other.open = false; });   // 테마보다 먼저 걸려 있어도
    w.history.pushState({ app: 1, otherDlg: 1 }, '');                               // 그 확장 창이 열림
    const L = M.createLayers(w);
    const done = L.open(() => true);                                                // 그 창 위에 테마 겹(고르기 목록 · 확인 창)
    assert.deepEqual(w.entries.at(-1), { app: 1, otherDlg: 1, [M.DEPTH_KEY]: 1 });
    done(); await w.idle();                                                         // 목록에서 값을 고름 → 테마가 제 칸을 스스로 물려요
    assert.deepEqual(w.moves, [-1]); assert.equal(w.at, 1);
    assert.equal(other.pops, 0, '테마가 스스로 물린 이동을 남이 사용자 뒤로 가기로 읽으면 그 창이 닫혀요'); assert.equal(other.open, true);
    // 연달아 두 겹을 닫아도(한 번 물러난 뒤 다시 맞추는 이동까지) 안 보여요
    const d1 = L.open(() => true), d2 = L.open(() => true); d2(); d1(); await w.idle();
    assert.equal(other.pops, 0); assert.equal(w.at, 1); assert.equal(L.size, 0);
    // 사용자가 누른 뒤로 가기: 테마 겹이 그 한 번을 썼으면(맨 위 칸이 테마 칸) 남에게 안 넘겨요 — 목록만 닫히고 그 확장 창은 남아요
    let closed = 0; L.open(() => { closed++; }); w.history.back(); await w.idle();
    assert.equal(closed, 1); assert.equal(other.pops, 0); assert.equal(other.open, true); assert.equal(w.at, 1);
    // 안 닫힌 겹(다시 채움)이 쓴 뒤로 가기도 안 넘겨요
    const keep = L.open(() => false); w.history.back(); await w.idle(); assert.equal(other.pops, 0); assert.equal(L.size, 1); keep(); await w.idle(); assert.equal(other.pops, 0); assert.equal(w.at, 1);
    // 테마 겹이 없을 때의 뒤로 가기는 그대로 넘겨요(그 확장이 제 창을 닫아요)
    w.history.back(); await w.idle(); assert.equal(other.pops, 1); assert.equal(other.open, false); assert.equal(w.at, 0);
    // 맨 위 칸이 남의 칸이면(테마 겹 위에 그 확장 창) 테마는 닫을 게 없고 그대로 넘겨요
    const w2 = fakeWin(); let heard = 0; const L2 = M.createLayers(w2); let c2 = 0; L2.open(() => { c2++; });
    w2.addEventListener('popstate', () => { heard++; }); w2.history.pushState({ ...w2.history.state, otherDlg: 1 }, '');
    w2.history.back(); await w2.idle(); assert.equal(heard, 1); assert.equal(c2, 0); assert.equal(L2.size, 1);
    const src = (await import('node:fs')).readFileSync(path.join(root, 'src/layer-back.js'), 'utf8');
    assert.ok(src.includes("addEventListener('popstate', onPop, true)"));                              // 잡는 단계 — 나중에 걸려도 먼저 불려요
});
await ok('⑩ 1.9.2 모듈이 두 번 읽혀도(src 와 dist · 묶음 조각) 겹 관리자는 문서에 하나 — 뒤 것이 앞 것의 기록 칸을 물려 방금 연 창을 닫지 않아요', async () => {
    const again = await import(pathToFileURL(path.join(root, 'src/layer-back.js')).href + '?twice=' + Math.random());
    assert.notEqual(again, M);                       // 다른 모듈 인스턴스
    assert.equal(again.layers(), M.layers());        // 같은 관리자
    const bc1 = await import(pathToFileURL(path.join(root, 'src/back-close.js')).href + '?a=' + Math.random());
    const bc2 = await import(pathToFileURL(path.join(root, 'src/back-close.js')).href + '?b=' + Math.random());
    bc1.resetBackCloseForTest();
    const body = { getAttribute: () => null }, doc = { body, querySelectorAll: () => [], addEventListener() {} };
    assert.equal(bc1.startBackClose(doc, { watch() {}, stack: M.createLayers(fakeWin()) }), true);
    assert.equal(bc2.startBackClose(doc, { watch() {}, stack: M.createLayers(fakeWin()) }), false);   // 둘째 인스턴스는 이미 시작한 것으로 봐요(같은 창을 두 겹으로 올리지 않게)
    bc1.resetBackCloseForTest();
});
console.log(`layer-back: ${n}개 통과`);
