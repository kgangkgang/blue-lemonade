// 1.1.4 유휴 폴링 하나로(src/frame-poll.js): 과일 계열 세 모듈이 타이머 하나 · 박자마다 서명 계산 한 번을 같이 써요. 가려진 동안은 쉬고 다시 보이면 바로 한 번.
//   node tools/tests/frame-poll.mjs [저장소]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { framePoll, FRAME_POLL_MS } = await import(pathToFileURL(path.join(root, 'src/frame-poll.js')).href);
let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } };

function world() {
    const timers = new Map(); let next = 1;
    const host = { setInterval(fn, ms) { const id = next++; timers.set(id, { fn, ms }); return id; }, clearInterval: id => timers.delete(id) };
    const listeners = new Map();
    const state = { count: 5 };
    const frameDoc = () => ({ body: { getElementsByTagName: () => [] }, getElementsByTagName: () => ({ get length() { return state.count; } }) });
    const frames = [];
    const chat = { getElementsByTagName(tag) { assert.equal(tag, 'iframe'); return frames; } };
    const doc = {
        hidden: false, chat,
        querySelector(sel) { assert.equal(sel, '#chat'); return this.chat; },
        addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
    };
    const tick = () => { for (const t of [...timers.values()]) t.fn(); };
    return { host, doc, timers, listeners, frames, frameDoc, tick, state };
}

test('세 구독이 타이머 하나(1.5초) · 박자마다 서명 계산 한 번을 같이 써요', () => {
    const w = world();
    const poll = framePoll(w.doc, w.host);
    assert.equal(framePoll(w.doc, w.host), poll, '같은 창 · 문서는 같은 폴');
    const seen = [];
    const offA = poll.every(() => seen.push(['a', poll.sig()]));
    const offB = poll.every(() => seen.push(['b', poll.sig()]));
    const offC = poll.every(() => seen.push(['c', poll.sig(true)]), { counts: true });
    assert.equal(w.timers.size, 1, '진짜 타이머는 하나');
    assert.equal([...w.timers.values()][0].ms, FRAME_POLL_MS);
    assert.equal(FRAME_POLL_MS, 1500, '박자는 예전 그대로 1.5초');
    const before = poll.stats().walks;
    w.tick();
    assert.equal(seen.length, 3, '세 구독이 한 박자에 한 번씩');
    assert.equal(poll.stats().walks - before, 1, '서명 계산은 박자에 한 번(요소 수 포함 한 번으로 둘 다)');
    assert.equal(seen[0][1], seen[1][1], '같은 박자의 서명은 같은 값');
    offA(); offB();
    assert.equal(w.timers.size, 1, '구독이 남아 있으면 타이머도 남아요');
    offC(); offC();
    assert.equal(w.timers.size, 0, '마지막 구독이 끊기면 타이머도 내려요');
    assert.equal(w.listeners.size, 0, '보임 듣기도 떼요');
    const offD = poll.every(() => {});
    assert.equal(w.timers.size, 1, '다시 구독하면 다시 걸어요');
    offD();
    assert.equal(w.timers.size, 0);
});

test('요소 수를 쓰는 구독이 없으면 요소 수는 세지 않고, 기본 서명도 박자에 한 번만 계산해요', () => {
    const w = world();
    let counted = 0;
    w.frames.push({ contentDocument: { body: { getElementsByTagName: () => [] }, getElementsByTagName: () => ({ get length() { counted++; return 1; } }) } });
    const poll = framePoll(w.doc, w.host);
    const off1 = poll.every(() => poll.sig());
    const off2 = poll.every(() => poll.sig());
    const before = poll.stats().walks;
    w.tick();
    assert.equal(poll.stats().walks - before, 1);
    assert.equal(counted, 0);
    off1(); off2();
});

test('서명: 채팅 뿌리 · iframe 문서 정체 번호(예전 꼴 그대로) — 뿌리나 iframe 문서가 바뀌면 달라지고 그대로면 같아요', () => {
    const w = world();
    const poll = framePoll(w.doc, w.host);
    const s0 = poll.sig();
    assert.equal(s0, '1', 'iframe 이 없으면 뿌리 번호 하나');
    assert.equal(poll.sig(), s0, '그대로면 같은 값');
    w.frames.push({ contentDocument: w.frameDoc() });
    const s1 = poll.sig();
    assert.equal(s1, '1,2,3', '뿌리 · iframe 문서 · 그 body');
    assert.equal(poll.sig(true), '1,2,5,3', '요소 수 포함: 문서 번호 뒤에 요소 수');
    w.state.count = 6;
    assert.equal(poll.sig(), s1, '요소 수만 바뀌면 기본 서명은 그대로');
    assert.equal(poll.sig(true), '1,2,6,3', '요소 수 포함 서명은 달라져요');
    w.frames[0] = { contentDocument: w.frameDoc() };
    assert.notEqual(poll.sig(), s1, 'iframe 문서가 바뀌면 달라져요');
    w.frames.length = 0;
    w.frames.push({ get contentDocument() { throw new Error('cross-origin'); } });
    assert.equal(poll.sig(), '1,0', '다른 출처 iframe 은 0');
    w.doc.chat = { getElementsByTagName: () => [] };
    assert.notEqual(poll.sig(), '1', '채팅 뿌리가 바뀌면 달라져요');
    w.doc.chat = null;
    assert.equal(poll.sig(), '0', '뿌리가 없으면 0');
});

test('가려진 동안은 박자를 건너뛰고, 다시 보이면 바로 한 번 돌아요', () => {
    const w = world();
    const poll = framePoll(w.doc, w.host);
    let runs = 0;
    const off = poll.every(() => { runs++; });
    w.doc.hidden = true;
    const walks = poll.stats().walks;
    w.tick(); w.tick();
    assert.equal(runs, 0, '가려진 동안 구독을 부르지 않아요');
    assert.equal(poll.stats().walks, walks, '서명도 계산하지 않아요');
    w.doc.hidden = false;
    w.listeners.get('visibilitychange')();
    assert.equal(runs, 1, '다시 보이면 바로 한 번');
    w.tick();
    assert.equal(runs, 2);
    off();
});

test('한 구독이 던져도 다른 구독은 돌고, 박자 밖 서명은 그때 새로 계산해요', () => {
    const w = world();
    const poll = framePoll(w.doc, w.host);
    const warn = console.warn; console.warn = () => {};
    let ran = 0;
    const off1 = poll.every(() => { throw new Error('boom'); });
    const off2 = poll.every(() => { ran++; });
    try { w.tick(); } finally { console.warn = warn; }
    assert.equal(ran, 1);
    const walks = poll.stats().walks;
    poll.sig(); poll.sig();
    assert.equal(poll.stats().walks - walks, 2, '박자 밖에서는 부를 때마다 새로(훑은 뒤 기준값이 낡지 않게)');
    off1(); off2();
});

test('CI 등록 · 세 모듈이 제 타이머를 두지 않아요', () => {
    const yml = fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8');
    assert.ok(yml.includes('node tools/tests/frame-poll.mjs .'), 'release-check.yml 에 등록');
    for (const file of ['src/fruit-type-shortcuts.js', 'src/fruit-type-runtime.js', 'src/scripts/fruit-status.js']) assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), /setInterval\(/, file);
});

console.log(`frame-poll: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
