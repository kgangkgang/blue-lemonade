// 긴 채팅 가볍게 — 쉴 때 화면 밖 메시지 미리 그리기 (src/chat-light.js kickWarm · stepWarm · coolOffscreen · css/05-chat.css [data-bl-warm])
//   node tools/tests/chat-light-warm.mjs <테마 루트>
// 성능 관문 스크롤(폰 4배)에서 content-visibility:auto 로 건너뛴 메시지가 들어오는 프레임마다 스타일 · 배치 · 칠하기를 해 50ms 넘는 프레임이 33개였어요(끄면 3).
// 가짜 DOM · 가짜 시계 · 가짜 프레임(rAF · IntersectionObserver) · 가짜 scheduler 로: 조용해진 뒤 보는 자리에서 가까운 차례로 data-bl-warm 을 달고 ·
//   몇 개씩 묶어 낮은 우선순위 작업 안에서 배치를 한 번 끝내며(묶음 여럿이 한 프레임의 칠하기를 나눠 씀) · 한 묶음이 길지 않고 · 자리 · 계산된 스타일은 읽지 않으며 ·
//   입력이 기다리면 미루되 시간으로 쉬지 않고(답장 뒤 치다 바로 굴려도 풀려 있게 — 1.0.0 scroll-919) ·
//   생성 중 · 서랍(고정 서랍 빼고) · 답장 토큰 동안은 쉬며 표식을 떼고 · 드라이런은 건너뛰고 · 네모 단추 감시에 풀린 메시지를 알리고 ·
//   굴려서 그려진 메시지는 그대로 두는지. CSS 규칙(속성 표식 · !important · JS 선택자와 같은 꼴) · 미리보기 사본 제외 · CI 등록도 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------- 가짜 시계 · 타이머 · scheduler · 프레임
// 표식을 바꾼 뒤 배치를 끝내면(작업 안의 #chat.offsetHeight 읽기 또는 다음 프레임) 스타일 · 배치 비용 FIXED + PER × 새로 푼 메시지가 든다.
// 프레임은 16ms 마다: rAF 콜백 → (아직 안 끝낸 표식이 있으면) 그 비용 → 칠하기(표식이 바뀐 프레임이면 PAINT 한 번) → IntersectionObserver 알림 차례.
let clock = 0, tid = 0;
const timers = new Map(), tasks = [];
globalThis.performance = { now: () => clock };
globalThis.setTimeout = (fn, ms = 0) => { const id = ++tid; timers.set(id, { fn, at: clock + ms }); return id; };
globalThis.clearTimeout = id => { timers.delete(id); };
const priorities = [];
globalThis.scheduler = { postTask(fn, opts = {}) { priorities.push(opts.priority); const t = { fn, signal: opts.signal }; tasks.push(t); return new Promise(() => { }); } };
let rafQ = new Map(), rafId = 0, rafCalls = 0;
globalThis.requestAnimationFrame = fn => { rafCalls++; const id = ++rafId; rafQ.set(id, fn); return id; };
globalThis.cancelAnimationFrame = id => { rafQ.delete(id); };
let pendingInput = false;   // navigator.scheduling.isInputPending() 가 돌려줄 값
Object.defineProperty(globalThis, 'navigator', { value: { scheduling: { isInputPending: () => pendingInput } }, configurable: true, writable: true });
const ioQ = [];
let FIXED = 20, PER = 5, PAINT = 40;   // 배치를 끝낼 때 드는 고정 몫 · 새로 푼 메시지 하나 몫 · 표식이 바뀐 프레임의 칠하기(ms)
let dirty = 0, paintDirty = false, inTask = false, forcedInTask = 0, forcedOutside = 0, rectReads = 0, styleReads = 0;
const batchCosts = [], paints = [];
function flushLayout() { if (dirty) { const c = FIXED + PER * dirty; clock += c; dirty = 0; return c; } return 0; }
let lastFrame = 0;
function runFrame() {
    lastFrame = clock;
    const q = [...rafQ.values()]; rafQ = new Map();
    for (const fn of q) fn(clock);
    flushLayout();
    if (paintDirty) { clock += PAINT; paints.push(clock); paintDirty = false; }
    for (const deliver of ioQ.splice(0)) deliver();
}
/** 그릴 것이 있으면 지난 프레임 뒤 16ms 에 다음 프레임(작업이 길어 넘겼으면 그 작업이 끝나자마자) */
const nextFrameAt = () => Math.max(lastFrame + 16, Math.floor(clock / 16) * 16);
/** 타이머 · 낮은 우선순위 작업 · 프레임을 ms 동안(가짜 시계) 돌린다 — 다음 프레임 차례 전에는 작업이 더 돌 수 있다(짧은 묶음 여럿이 한 프레임을 나눠 씀) */
function advance(ms) {
    const end = clock + ms;
    for (let guard = 0; guard < 200000; guard++) {
        const frameAt = rafQ.size || ioQ.length || dirty || paintDirty ? nextFrameAt() : Infinity;
        const t = clock < end && clock < frameAt ? tasks.shift() : null;   // 작업은 시계 안 · 다음 프레임 자리 전까지
        if (t) { if (t.signal?.aborted) continue; inTask = true; try { t.fn(); } finally { inTask = false; } clock += 1; continue; }
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        const timerAt = next ? next[1].at : Infinity;
        if (Math.min(timerAt, frameAt) > end) break;
        if (frameAt <= timerAt) { clock = Math.max(clock, frameAt); runFrame(); continue; }
        clock = Math.max(clock, timerAt); timers.delete(next[0]); next[1].fn();
    }
    clock = Math.max(clock, end);
}

// ---------------------------------------------------------------- 가짜 DOM
const observers = [];
class FakeMO { constructor(cb) { this.cb = cb; this.live = true; observers.push(this); } observe(el, opts) { this.target = el; this.opts = opts; } disconnect() { this.live = false; } }
globalThis.MutationObserver = FakeMO;
let SKIP = null;   // 모듈의 SKIP_SELECTOR — matches 가 그 선택자로만 불리는지 본다
const events = [];
let ioMade = 0;
function makeMes(i) {
    const attrs = new Map();
    const m = {
        i, attrs, isConnected: true, excluded: false, top: 0,
        classList: { contains: c => c === 'mes' },
        hasAttribute: a => attrs.has(a),
        setAttribute: (a, v) => { if (!attrs.has(a)) { dirty++; paintDirty = true; } attrs.set(a, v); },
        removeAttribute: a => { attrs.delete(a); },
        getAttribute: a => attrs.get(a) ?? null,
        matches: sel => { assert.equal(sel, SKIP); return !m.excluded; },   // 바닥 10개 · 마지막은 CSS 가 처음부터 안 건너뛴다
        getBoundingClientRect: () => { rectReads++; return { top: m.top, bottom: m.top + 200, height: 200 }; },
        get offsetHeight() { forcedOutside++; return 200; },
        dispatchEvent: ev => { events.push([i, ev.type, ev.skipped, dirty]); return true; },
    };
    return m;
}
let mes = [];
const chat = {
    id: 'chat', classes: new Set(),
    classList: { contains: c => chat.classes.has(c), toggle(c, f) { if (f) chat.classes.add(c); else chat.classes.delete(c); }, remove(c) { chat.classes.delete(c); } },
    querySelectorAll(sel) {
        if (sel === ':scope > .mes') return mes;
        if (sel === ':scope > .mes[data-bl-warm]') return mes.filter(m => m.attrs.has('data-bl-warm'));
        throw new Error('모르는 선택자 ' + sel);
    },
    getBoundingClientRect: () => { rectReads++; return { top: 0, bottom: 600, height: 600 }; },
    // 배치 읽기: 낮은 우선순위 작업 안에서만 세고(묶음 끝내기), 그 자리에서 스타일 · 배치 비용을 치른다
    get offsetHeight() { if (inTask) { forcedInTask++; batchCosts.push(flushLayout()); } else forcedOutside++; return 1000; },
    get scrollTop() { forcedOutside++; return 0; },
    get scrollHeight() { forcedOutside++; return 20000; },
};
// 보는 칸(#chat) 0~600 — IntersectionObserver 는 그리고 난 뒤 이 칸과 겹치는 메시지를 알린다(자리를 강제로 재지 않는 길)
globalThis.IntersectionObserver = class {
    constructor(cb, opts) { ioMade++; this.cb = cb; this.opts = opts; this.targets = []; this.live = true; ioQ.push(() => { if (this.live) this.cb(this.targets.map(t => ({ target: t, isIntersecting: t.top < 600 && t.top + 200 > 0 }))); }); }
    observe(t) { assert.equal(this.opts?.root, chat, '보는 칸(#chat)을 뿌리로'); this.targets.push(t); }
    disconnect() { this.live = false; }
};
/** count 개 · view = 보는 칸 가운데 바로 위에 오는 메시지 번호 */
function setMessages(count, view = count - 11) {
    mes = Array.from({ length: count }, (_, i) => makeMes(i));
    for (const m of mes) { m.top = (m.i - view - 1) * 200 + 300; m.parentElement = chat; m.excluded = m.i >= count - 10; }
}
let openDrawer = null;   // { pinned }
const docListeners = new Map();
const htmlClasses = new Set();   // 긴 채팅 표식이 html 에 붙는 판(8.2.7 perf-fade)과 #chat 에 붙는 판 둘 다
globalThis.document = {
    body: { dataset: {} },
    documentElement: { classList: { contains: c => htmlClasses.has(c), toggle(c, f) { if (f) htmlClasses.add(c); else htmlClasses.delete(c); }, remove(c) { htmlClasses.delete(c); }, add(c) { htmlClasses.add(c); } } },
    getElementById: id => (id === 'chat' ? chat : null),
    querySelectorAll: sel => (sel === '.drawer-content' ? [] : []),
    querySelector: sel => {
        if (sel === '.drawer-content.openDrawer:not(.pinnedOpen)') return openDrawer && !openDrawer.pinned ? openDrawer : null;
        return null;
    },
    addEventListener: (t, f, opts) => { docListeners.set(t, { f, opts }); },
};
globalThis.window = { innerHeight: 800, getComputedStyle: m => { styleReads++; return { contentVisibility: m.attrs?.has('data-bl-warm') || m.excluded ? 'visible' : 'auto' }; }, addEventListener() { }, removeEventListener() { } };
const es = { l: new Map(), on(ev, fn) { if (!this.l.has(ev)) this.l.set(ev, []); this.l.get(ev).push(fn); }, emit(ev, ...a) { for (const fn of [...(this.l.get(ev) || [])]) fn(...a); } };
const T = { STREAM_TOKEN_RECEIVED: 'tok', GENERATION_STARTED: 'gs', GENERATION_ENDED: 'ge', GENERATION_STOPPED: 'gst', MESSAGE_RECEIVED: 'mr', CHAT_CHANGED: 'cc', MESSAGE_SWIPED: 'ms' };
globalThis.SillyTavern = { getContext: () => ({ eventSource: es, eventTypes: T }) };

setMessages(100);
const M = await import(pathToFileURL(path.join(root, 'src/chat-light.js')).href);
SKIP = M.SKIP_SELECTOR;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.stack || e.message}`); } };
const warmCount = () => mes.filter(m => m.attrs.has('data-bl-warm')).length;
const candidates = () => mes.filter(m => !m.excluded).length;
const settle = (ms = 30000) => advance(ms);
const press = (type = 'keydown') => docListeners.get(type)?.f({ type });
const trackOrder = () => { const order = []; for (const m of mes) { const set = m.setAttribute; m.setAttribute = (a, v) => { if (a === 'data-bl-warm' && !m.attrs.has(a)) order.push(m.i); set(a, v); }; } return order; };

test('켜면 바로 하지 않고 조용해진 뒤(WARM_QUIET_MS) 낮은 우선순위 작업으로 건너뛴 메시지만 전부 푼다', () => {
    assert.equal(typeof M.kickWarm, 'function', 'kickWarm 이 없다 — 미리 그리기 전');
    M.syncChatLight(true);
    assert.equal(chat.classes.has('bl-chat-light') || htmlClasses.has('bl-chat-light'), true);
    advance(M.WARM_QUIET_MS - 1);
    assert.equal(warmCount(), 0, '조용해지기 전에는 손대지 않는다');
    settle();
    assert.equal(warmCount(), candidates(), '건너뛰던 메시지는 다 풀린다');
    assert.ok(mes.filter(m => m.excluded).every(m => !m.attrs.has('data-bl-warm')), '처음부터 안 건너뛰는 바닥 10개에는 표식을 달지 않는다');
    assert.ok(priorities.length && priorities.every(p => p === 'background'), 'scheduler.postTask background 로');
});
test('고르기에서는 자리 · 크기 · 계산된 스타일을 읽지 않고(보는 자리는 IntersectionObserver), 배치는 묶음마다 한 번 낮은 우선순위 작업 안에서만 끝낸다', () => {
    assert.equal(rectReads, 0, `getBoundingClientRect ${rectReads}번`);
    assert.equal(styleReads, 0, `getComputedStyle ${styleReads}번`);
    assert.equal(forcedOutside, 0, `작업 밖(프레임 · 타이머 · 감시 콜백)의 배치 읽기 ${forcedOutside}번`);
    assert.ok(forcedInTask >= 1 && forcedInTask <= candidates(), `묶음마다 한 번(${forcedInTask}번 · 메시지 ${candidates()}개)`);
    assert.ok(ioMade >= 1, 'IntersectionObserver 첫 알림으로 보는 자리를 찾는다');
});
test('(1.0.0 scroll-919) 묶음은 프레임(rAF)이 아니라 작업 안에서 끝내 — 짧은 묶음 여럿이 한 프레임의 칠하기를 나눠 쓴다', () => {
    setMessages(100); paints.length = 0; batchCosts.length = 0; const raf0 = rafCalls;
    FIXED = 3; PER = 1; M._warm.stop(); M.kickWarm(0); settle(); FIXED = 20; PER = 5;
    assert.equal(warmCount(), 90);
    assert.equal(rafCalls - raf0, 0, '미리 그리기는 rAF 를 잡지 않는다');
    assert.ok(paints.length < batchCosts.length, `칠하기 ${paints.length}번 < 묶음 ${batchCosts.length}개 — 묶음마다 따로 칠하지 않는다`);
});
test('보는 자리에서 가까운 차례 · 몇 개씩 묶는다 · 한 묶음이 길지 않다', () => {
    setMessages(100); events.length = 0; batchCosts.length = 0;
    const order = trackOrder();
    M._warm.stop(); M.kickWarm(0); settle();
    assert.equal(order.length, 90);
    assert.deepEqual(order.slice(0, 4), [89, 88, 87, 86], '가운데에서 가까운 것부터');
    assert.ok(batchCosts.length <= order.length / 2, `묶어서 단다(묶음 ${batchCosts.length} · 메시지 ${order.length})`);
    // 묶음 크기는 앞 장면(싼 메시지)에서 이어받아 첫 묶음 하나는 넘칠 수 있고, 넘치면 바로 줄인다
    assert.ok(batchCosts[0] <= 20 + 5 * M.WARM_BATCH_MAX, `첫 묶음 ${batchCosts[0]}ms`);
    const worst = Math.max(...batchCosts.slice(1));
    assert.ok(worst <= M.WARM_SLICE_MS * 1.5, `한 묶음이 길지 않다(가장 긴 묶음 ${worst}ms)`);
});
test('보는 자리가 위쪽이면 위쪽부터 — 바닥(IntersectionObserver 가 없을 때의 기본)이 아니라', () => {
    setMessages(100, 3);
    const order = trackOrder();
    M._warm.stop(); M.kickWarm(0); settle();
    assert.equal(order.length, 90);
    assert.ok(order.slice(0, 4).every(i => i <= 6), `처음 넷: ${order.slice(0, 4)}`);
    const IO = globalThis.IntersectionObserver; delete globalThis.IntersectionObserver;
    try {
        setMessages(100, 3); const order2 = trackOrder();
        M.kickWarm(0); settle();
        assert.equal(order2[0], 89, '없으면 바닥에서부터(채팅은 바닥에서 열려요)');
        assert.equal(order2.length, 90);
    } finally { globalThis.IntersectionObserver = IO; }
});
test('깨끗한 메시지로 묶음이 커진 뒤 처음 그리는(비싼) 메시지를 만나도 한 묶음이 WARM_BATCH_MAX 묶음 이상 길어지지 않고 바로 줄인다', () => {
    setMessages(100); batchCosts.length = 0;
    FIXED = 4; PER = 0.5; M._warm.stop(); M.kickWarm(0);
    for (let g = 0; g < 400 && batchCosts.length < 4; g++) advance(1);   // 몇 묶음 — 싼 메시지로 묶음이 커진다
    assert.ok(warmCount() < 90, '아직 다 풀지 않았다(묶음을 하나씩 본다)');
    const grown = M._warm.state().k;
    assert.ok(grown > 4, `싸면 묶음이 커진다(${grown})`);
    assert.ok(grown <= M.WARM_BATCH_MAX);
    PER = 15; const before = batchCosts.length; settle();
    const after = batchCosts.slice(before);
    assert.ok(after.length >= 3, '비싼 메시지는 여러 묶음으로');
    assert.ok(Math.max(...after) <= FIXED + 15 * M.WARM_BATCH_MAX + 1, `가장 긴 묶음 ${Math.max(...after)}ms`);
    assert.ok(after.slice(3).every(x => x <= M.WARM_SLICE_MS * 1.5), `넘친 뒤 묶음은 줄어든다(${after.join(',')})`);
    assert.equal(warmCount(), 90);
    FIXED = 20; PER = 5;
});
test('풀어 준 메시지마다 contentvisibilityautostatechange(skipped=false) 를 배치를 끝낸 뒤 알려 네모 단추 감시가 안쪽을 잰다', () => {
    setMessages(100); events.length = 0;
    M._warm.stop(); M.kickWarm(0); settle();
    const got = events.filter(e => e[1] === 'contentvisibilityautostatechange' && e[2] === false);
    assert.equal(new Set(got.map(e => e[0])).size, 90);
    assert.ok(got.every(e => e[3] === 0), '알릴 때는 배치가 이미 끝나 있다(감시가 재도 다시 계산하지 않게)');
});
test('(1.0.0 scroll-919) 처리를 기다리는 입력이 있으면(isInputPending) 그 묶음을 달지 않고 미룬다 — 입력이 멎으면 이어서', () => {
    setMessages(100); M._warm.stop();
    const order = trackOrder();
    pendingInput = true;
    M.kickWarm(0); advance(2000);
    assert.equal(order.length, 0, '입력이 기다리는 동안은 달지 않는다');
    assert.ok(M._warm.state().yielded > 0, '미룬 횟수');
    assert.equal(M._warm.state().job, true, '미룬 묶음은 다음 낮은 우선순위 작업으로');
    pendingInput = false; settle();
    assert.equal(order.length, 90, '멎으면 처음 고른 차례대로 다 푼다');
    assert.deepEqual(order.slice(0, 2), [89, 88]);
    assert.equal(M.inputPending({}), false, 'isInputPending 이 없는 브라우저는 늘 false');
    assert.equal(M.inputPending({ scheduling: { isInputPending() { throw new Error('x'); } } }), false);
});
test('(1.0.0 scroll-919) 답장(토큰)을 받은 뒤 글을 치다 바로 굴려도 풀려 있다 — 키 · 입력 · 누름 · 클릭 · 휠 · 터치로 시간을 두고 쉬지 않는다', () => {
    // 9.0.3 은 키 · 누름 · 클릭 · 휠 · 터치 뒤 1초를 쉬어, 관문(스트리밍 → 타이핑 → 0.3초 뒤 스크롤)에서 145개 중 0개가 풀린 채 굴렸어요(폰 50ms 넘는 프레임 0 → 22)
    for (const type of ['keydown', 'input', 'pointerdown', 'click', 'wheel', 'touchstart']) assert.equal(docListeners.has(type), false, type + ' 로 쉬는 리스너가 없다');
    setMessages(100); M._warm.stop(); M.kickWarm(0); settle();
    assert.equal(warmCount(), 90);
    es.emit('tok', '답장');   // 답장을 받는 동안 화면 밖을 다시 건너뛰게
    assert.equal(warmCount(), 0);
    advance(M.STREAM_QUIET_MS + 50);   // 토큰이 멎고 곧바로 치기 시작
    for (let i = 0; i < 40; i++) { press('keydown'); press('input'); advance(60); }   // 2.4초 동안 친다(관문 타이핑 꼴)
    advance(300);   // 0.3초 뒤 굴린다
    assert.equal(warmCount(), 90, `굴리기 전에 다 풀려 있다(${warmCount()}/90)`);
});
test('답장 토큰이 오면 표식을 다 떼고(자리를 재지 않음) 토큰이 STREAM_QUIET_MS 끊긴 뒤에야 다시 푼다', () => {
    assert.equal(warmCount(), 90);
    rectReads = 0; const f0 = forcedOutside;
    es.emit('tok', '하나');
    assert.equal(warmCount(), 0, '토큰이 오면 화면 밖 것을 다시 건너뛰게');
    assert.equal(rectReads, 0, '떼는 순간 자리를 재지 않는다(더러워진 스타일 · 배치를 강제로 계산하지 않게)');
    assert.equal(forcedOutside, f0);
    advance(M.STREAM_QUIET_MS - 50); es.emit('tok', '둘'); advance(M.STREAM_QUIET_MS - 50);
    assert.equal(warmCount(), 0, '토큰이 이어지는 동안은 쉰다');
    settle();
    assert.equal(warmCount(), 90, '끊기면 다시 푼다');
});
test('생성 시작(드라이런 아님)은 떼고, 드라이런(토큰 세기)은 그대로 둔다', () => {
    es.emit('gs', 'normal', {}, true);
    assert.equal(warmCount(), 90, '드라이런은 건너뛴다');
    document.body.dataset.generating = 'true';
    es.emit('gs', 'normal', {}, false);
    assert.equal(warmCount(), 0);
    settle(5000);
    assert.equal(warmCount(), 0, '생성 중(body data-generating)에는 다시 풀지 않는다');
    delete document.body.dataset.generating;
    es.emit('ge', 100);
    settle();
    assert.equal(warmCount(), 90, '생성이 끝나면 다시 푼다');
});
test('서랍이 열리면 떼고 쉬며, 닫히면 다시 푼다 · 고정 서랍(pinnedOpen)은 쉬지 않는다', () => {
    rectReads = 0;
    openDrawer = { pinned: false }; M.warmOnDrawers();
    assert.equal(warmCount(), 0); assert.equal(rectReads, 0);
    settle(5000);
    assert.equal(warmCount(), 0, '서랍이 열린 동안은 다시 풀지 않는다');
    openDrawer = null; M.warmOnDrawers(); settle();
    assert.equal(warmCount(), 90);
    openDrawer = { pinned: true }; M.warmOnDrawers();
    assert.equal(warmCount(), 90, '고정 서랍은 그대로');
    assert.equal(M.warmPaused(), false);
    openDrawer = null;
});
test('생성이 시작되면 이미 잡아 둔 묶음도 달지 않는다(쉬는 조건은 묶음마다 다시 본다)', () => {
    setMessages(100); M._warm.stop();
    const order = trackOrder();
    M.kickWarm(0);
    for (let g = 0; g < 400 && !M._warm.state().job; g++) advance(1);
    assert.equal(M._warm.state().job, true, '묶음 작업이 잡혔다');
    const before = order.length;
    document.body.dataset.generating = 'true';
    try { advance(50); } finally { delete document.body.dataset.generating; }
    assert.equal(order.length, before, '생성이 시작됐으면 잡아 둔 묶음을 달지 않는다');
    assert.ok(before < 90);
    settle();
    assert.equal(order.length, 90);
});
test('시작 덮개(#preloader)가 있는 동안은 쉬고, 걷힌 뒤 푼다', () => {
    setMessages(100); M._warm.stop();
    const getById = document.getElementById;
    document.getElementById = id => (id === 'preloader' ? {} : getById(id));
    try {
        assert.equal(M.warmPaused(), true);
        M.kickWarm(0); settle(5000);
        assert.equal(warmCount(), 0);
    } finally { document.getElementById = getById; }
    settle();
    assert.equal(warmCount(), 90);
});
test('굴려서 크롬이 그린 메시지(skipped=false)는 표식을 달아 그대로 두고, 쉬는 동안 · 다른 요소 · 건너뛴 알림은 손대지 않는다', () => {
    const onReveal = docListeners.get('contentvisibilityautostatechange')?.f;
    assert.equal(typeof onReveal, 'function', '문서에 사건 리스너');
    setMessages(100); M._warm.stop();
    onReveal({ target: mes[5], skipped: false });
    assert.equal(mes[5].attrs.has('data-bl-warm'), true);
    onReveal({ target: mes[6], skipped: true });
    assert.equal(mes[6].attrs.has('data-bl-warm'), false);
    onReveal({ target: { classList: { contains: () => false }, hasAttribute: () => false, setAttribute() { throw new Error('메시지가 아닌 것') } }, skipped: false });
    es.emit('tok', '셋');
    onReveal({ target: mes[7], skipped: false });
    assert.equal(mes[7].attrs.has('data-bl-warm'), false, '답장 받는 동안은 달지 않는다');
    settle();
});
test('메시지가 들고 나면(#chat childList) 처음부터 다시 고르고, 끄면 일정이 남지 않는다', () => {
    setMessages(120);
    const mo = observers.filter(o => o.live && o.target === chat && o.opts?.childList).at(-1);
    mo.cb([]); settle();
    assert.equal(warmCount(), 110);
    M.syncChatLight(false);
    mes.push(makeMes(120)); mes[120].parentElement = chat; mes[120].top = 99999;
    settle();
    assert.equal(mes[120].attrs.has('data-bl-warm'), false, '끈 뒤에는 풀지 않는다');
    const st = M._warm.state();
    assert.equal(st.timer || st.job || st.look, false);
});
test('끝까지 — 자리 · 계산된 스타일 읽기 0, 작업 밖 배치 읽기 0', () => {
    assert.equal(styleReads, 0); assert.equal(rectReads, 0); assert.equal(forcedOutside, 0);
});
test('CSS: 표식(data 속성)이 붙은 메시지는 content-visibility: visible !important · 건너뛰는 규칙은 SKIP_SELECTOR 와 같은 꼴 · style.css 에 빌드 · 미리보기 사본 제외 · CI 등록', () => {
    const src = read('css/05-chat.css');
    assert.match(src, /^body\.salty #chat > \.mes\[data-bl-warm\] \{\n  content-visibility: visible !important;\n\}/m);
    assert.ok(!/\.bl-warm\b/.test(src), 'class 표식을 쓰지 않는다(실리태번 keyboard.js 감시자가 class 마다 다시 훑음)');
    const rule = src.match(/^:where\(html\.bl-chat-light\) body\.salty \[id="chat"\]:not\(#salty-none\) > (\.mes[^{]*?) \{\n  content-visibility: auto;/m);
    assert.ok(rule, '긴 채팅 가볍게 규칙');
    assert.equal(rule[1], M.SKIP_SELECTOR, 'JS 가 matches 로 고르는 선택자와 CSS 가 건너뛰는 선택자가 같다');
    assert.match(read('style.css'), /> \.mes\[data-bl-warm\] \{\n  content-visibility: visible !important;/);
    assert.ok(!read('css/23-preview.gen.css').includes('data-bl-warm'), '미리보기 사본에는 넣지 않는다');
    assert.match(read('tools/gen-preview-css.js'), /'\[data-bl-warm\]'/);
    const js = read('src/chat-light.js');
    assert.ok(!/requestIdleCallback\(/.test(js), '쉬는 시간 콜백은 화면이 계속 그려지면 몇 ms 만 줘서 쓰지 않는다');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/chat-light-warm\.mjs \./);
});
console.log(`chat-light-warm: ${n}/${n + failed} 통과`);
process.exit(failed ? 1 : 0);
