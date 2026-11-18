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
let nextFrameAt = () => Math.max(lastFrame + 16, Math.floor(clock / 16) * 16);
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
        setAttribute: (a, v) => { if (!attrs.has(a) && a === 'data-bl-warm') { dirty++; paintDirty = true; } attrs.set(a, v); },   // 바닥 표식(data-bl-tail)은 바닥 10개라 원래 그려져요 — 비용 없음
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
    get firstElementChild() { return mes[0] ?? null; }, get lastElementChild() { return mes.at(-1) ?? null; },
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
    mes.forEach((m, i) => { m.nextElementSibling = mes[i + 1] ?? null; m.previousElementSibling = mes[i - 1] ?? null; });   // (1.1.1) 형제 차례로 세요
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
// (1.8.3 perf-jank) 답장 토큰 뒤에도 남는 띠 — 보는 자리를 모르면 바닥에서 위로 STREAM_KEEP + VIEW_GUARD 개(바닥 10개 포함)
const keptAfterToken = () => mes.filter(m => !m.excluded && m.i >= mes.length - 1 - M.VIEW_GUARD - M.STREAM_KEEP).length;
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
    for (const type of ['click', 'wheel', 'touchstart']) assert.equal(docListeners.has(type), false, type + ' 로 쉬는 리스너가 없다');
    // (1.2.1 opt121-warm) 키 · 입력 · 누름은 「그 프레임까지」만 미루는 문(시간으로 쉬지 않아요) — 수동 · 캡처 리스너
    for (const type of ['keydown', 'input', 'pointerdown']) assert.deepEqual(docListeners.get(type)?.opts, { capture: true, passive: true }, type + ' 는 프레임 문만');
    setMessages(100); M._warm.stop(); M.kickWarm(0); settle();
    assert.equal(warmCount(), 90);
    es.emit('tok', '답장');   // 답장을 받는 동안 화면 밖을 다시 건너뛰게(바로 위 띠만 남김)
    assert.equal(warmCount(), keptAfterToken());
    advance(M.STREAM_QUIET_MS + 50);   // 토큰이 멎고 곧바로 치기 시작
    for (let i = 0; i < 40; i++) { press('keydown'); press('input'); advance(60); }   // 2.4초 동안 친다(관문 타이핑 꼴)
    advance(300);   // 0.3초 뒤 굴린다
    assert.equal(warmCount(), 90, `굴리기 전에 다 풀려 있다(${warmCount()}/90)`);
});
test('(1.2.1 opt121-warm) 키 · 입력 · 누름을 처리한 뒤 그 프레임이 칠해지기 전에는 묶음을 시작하지 않는다 — 프레임 뒤 바로 이어 끝 결과 · 차례는 같다', () => {
    // 관문 타이핑 꼴: 키(keydown · input · keyup) → 다음 프레임 + 0ms 까지가 입력 지연 → 30ms 쉼. 그 사이(입력 → 프레임)에 묶음이 끼면 지연이 묶음만큼 늘어요.
    setMessages(100); M._warm.stop();
    const order = trackOrder(), startedAt = [];
    let keyAt = -Infinity;
    for (const m of mes) { const set = m.setAttribute; m.setAttribute = (a, v) => { if (a === 'data-bl-warm' && !m.attrs.has(a)) startedAt.push({ keyAt, frameSinceKey: lastFrame >= keyAt }); set(a, v); }; }
    FIXED = 20; PER = 5;
    const gridFrame = nextFrameAt; nextFrameAt = () => Math.max(lastFrame + 16, Math.ceil((clock + 1) / 16) * 16);   // 프레임은 다음 16ms 칸에서만(입력 → 프레임 사이에 빈틈이 있게)
    try {
    M.kickWarm(0);
    for (let g = 0; g < 400 && !M._warm.state().job; g++) advance(1);
    const g0 = M._warm.state().gated;
    for (let k = 0; k < 60 && warmCount() < 90; k++) {
        advance(7 + (k * 13) % 23);   // 키 사이 간격을 흔들어 묶음이 여러 자리에 걸리게
        keyAt = clock; press('keydown'); press('input');
        if (k === 0) assert.equal(M._warm.state().gate, true, '미리 그리는 중이면 프레임 문이 닫힌다');
        advance(1);   // 프레임 전(입력 처리 직후) — 잡혀 있던 묶음이 여기 끼지 않아야 해요
    }
    settle();
    const early = startedAt.filter(s => s.keyAt > -Infinity && !s.frameSinceKey);
    assert.deepEqual(early, [], `입력 뒤 프레임 전에 시작한 묶음 ${early.length}개`);
    assert.ok(M._warm.state().gated > g0, '미룬 적이 있다(시험이 빈 것을 통과시키지 않게)');
    assert.equal(order.length, 90, '끝 결과는 같다(다 풀림)');
    assert.deepEqual(order.slice(0, 4), [89, 88, 87, 86], '차례도 같다');
    assert.equal(M._warm.state().gate, false, '문은 프레임에서 풀린다');
    } finally { nextFrameAt = gridFrame; }
    // 미리 그릴 일이 없으면 문을 닫지 않는다(평소 타이핑에 프레임을 잡지 않아요)
    const raf0 = rafCalls; press('keydown'); assert.equal(rafCalls, raf0); assert.equal(M._warm.state().gate, false);
    // 그리지 않는 탭(rAF 가 안 옴)이어도 늦게라도 풀린다
    setMessages(100); M._warm.stop(); M.kickWarm(0);
    for (let g = 0; g < 400 && !M._warm.state().job; g++) advance(1);
    const realRaf = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => 0;
    try { press('keydown'); assert.equal(M._warm.state().gate, true); advance(150); assert.equal(M._warm.state().gate, false, 'INPUT_GATE_MAX_MS 뒤 풀림'); }
    finally { globalThis.requestAnimationFrame = realRaf; }
    settle(); assert.equal(warmCount(), 90);
});
test('답장 토큰이 오면 바로 위 띠(STREAM_KEEP)만 남기고 표식을 떼고(자리를 재지 않음) 토큰이 STREAM_QUIET_MS 끊긴 뒤에야 다시 푼다', () => {
    assert.equal(warmCount(), 90);
    rectReads = 0; const f0 = forcedOutside;
    es.emit('tok', '하나');
    assert.ok(keptAfterToken() > 20 && keptAfterToken() < 90, `띠 ${keptAfterToken()}`);
    assert.equal(warmCount(), keptAfterToken(), '토큰이 오면 띠 밖 것을 다시 건너뛰게');
    assert.ok(mes.filter(m => m.attrs.has('data-bl-warm')).every(m => m.i >= mes.length - 1 - M.VIEW_GUARD - M.STREAM_KEEP), '남는 것은 바닥 쪽 띠뿐');
    assert.equal(rectReads, 0, '떼는 순간 자리를 재지 않는다(더러워진 스타일 · 배치를 강제로 계산하지 않게)');
    assert.equal(forcedOutside, f0);
    advance(M.STREAM_QUIET_MS - 50); es.emit('tok', '둘'); advance(M.STREAM_QUIET_MS - 50);
    assert.equal(warmCount(), keptAfterToken(), '토큰이 이어지는 동안은 쉰다(띠 밖은 더 풀지 않음)');
    settle();
    assert.equal(warmCount(), 90, '끊기면 다시 푼다');
});
test('생성 시작(드라이런 아님)은 떼고, 드라이런(토큰 세기)은 그대로 둔다', () => {
    es.emit('gs', 'normal', {}, true);
    assert.equal(warmCount(), 90, '드라이런은 건너뛴다');
    document.body.dataset.generating = 'true';
    es.emit('gs', 'normal', {}, false);
    assert.equal(warmCount(), keptAfterToken());
    settle(5000);
    assert.equal(warmCount(), keptAfterToken(), '생성 중(body data-generating)에는 더 풀지 않는다');
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
test('(1.1.1 restyle) coolForRestyle: 문서 전체 다시 계산(설정 적용) 앞에 표식을 떼고(자리를 재지 않음) 조용해진 뒤 다시 푼다 · 가볍게가 안 걸린 채팅은 0', () => {
    openDrawer = null; settle(); assert.equal(warmCount(), 90);
    rectReads = 0; forcedOutside = 0;
    assert.equal(M.coolForRestyle(), 90);
    assert.equal(warmCount(), 0); assert.equal(rectReads, 0); assert.equal(forcedOutside, 0, '되돌리는 자리에서 자리 · 배치를 읽지 않는다');
    advance(M.WARM_QUIET_MS - 50); assert.equal(warmCount(), 0, '바로 다시 풀지 않는다(조용해진 뒤)');
    settle(); assert.equal(warmCount(), 90, '조용해진 뒤 다시 푼다');
    // 푸는 중에 불리면 잡아 둔 묶음을 버리고 처음부터
    M.coolForRestyle(); advance(M.WARM_QUIET_MS + 400);
    const mid = warmCount(); assert.ok(mid > 0 && mid < 90, `푸는 중(${mid})`);
    assert.equal(M.coolForRestyle(), mid); assert.equal(warmCount(), 0);
    settle(); assert.equal(warmCount(), 90);
    // 가볍게가 안 걸린(짧은) 채팅은 손대지 않는다
    htmlClasses.delete('bl-chat-light');
    assert.equal(M.coolForRestyle(), 0); assert.equal(warmCount(), 90);
    htmlClasses.add('bl-chat-light');
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
    const rule = src.match(/^:where\(html\.bl-chat-light:not\(\[data-bl-chat-sel\]\)\) body\.salty \[id="chat"\]:not\(#salty-none\) > (\.mes[^{]*?) \{\n  content-visibility: auto;/m);
    assert.ok(rule, '긴 채팅 가볍게 규칙');
    assert.equal(rule[1], M.SKIP_SELECTOR, 'JS 가 matches 로 고르는 선택자와 CSS 가 건너뛰는 선택자가 같다');
    assert.match(read('style.css'), /> \.mes\[data-bl-warm\] \{\n  content-visibility: visible !important;/);
    assert.ok(!read('css/23-preview.gen.css').includes('data-bl-warm'), '미리보기 사본에는 넣지 않는다');
    assert.match(read('tools/gen-preview-css.js'), /'\[data-bl-warm\]'/);
    const js = read('src/chat-light.js');
    assert.ok(!/requestIdleCallback\(/.test(js), '쉬는 시간 콜백은 화면이 계속 그려지면 몇 ms 만 줘서 쓰지 않는다');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/chat-light-warm\.mjs \./);
});
// ---------------------------------------------------------------- (1.6.1 opt4-warm) 보는 자리 둘레만 · 굴리는 동안 쉼 · 멀리 뛰면 그 자리부터
//   예전(전부 풀기)은 묶음의 고정 몫이 이미 푼 수에 비례해 500개 채팅이 폰 4배에서 몇 분 동안 메인 스레드를 채웠어요(보고 지시-1116/최적화-4차).
let fakeTop = 0; Object.defineProperty(chat, 'scrollTop', { get: () => fakeTop, configurable: true });
const warmed = () => mes.filter(m => m.attrs.has('data-bl-warm')).map(m => m.i);
/** 보는 칸 가운데 바로 위에 view 번이 오게 굴린 꼴(자리만 바꿈 · 사건은 따로) */
const moveTo = view => { for (const m of mes) m.top = (m.i - view - 1) * 200 + 300; fakeTop = view * 200; };
const begin = (count, view) => { setMessages(count); moveTo(view); M.syncChatLight(false); M.syncChatLight(true); M._warm.stop(); };
const scrollEvent = () => docListeners.get('scroll').f({ target: chat });
test('(둘레) warmWindow: 방향 쪽으로 WARM_AHEAD · 반대쪽 나머지 · 모르면 반반 · 끝에 닿으면 남는 몫은 반대쪽', () => {
    const { warmWindow: W, WARM_AROUND: N, WARM_AHEAD: A } = M;
    assert.ok(N >= 150 && N <= 200 && A > N / 2 && A < N, 'N ' + N + ' · 앞 ' + A);
    assert.deepEqual(W(1000, 500, 0), { lo: 500 - N / 2, hi: 500 + N / 2 });
    assert.deepEqual(W(1000, 500, -1), { lo: 500 - A, hi: 500 + (N - A) });
    assert.deepEqual(W(1000, 500, 1), { lo: 500 - (N - A), hi: 500 + A });
    assert.deepEqual(W(1000, 999, 0), { lo: 999 - N, hi: 999 }, '바닥에서 열면 위로 N 개');
    assert.deepEqual(W(1000, 0, 1), { lo: 0, hi: N });
    assert.deepEqual(W(50, 20, -1), { lo: 0, hi: 49 }, '짧으면 전부');
    assert.deepEqual(W(0, 0, 0), { lo: 0, hi: -1 });
    for (const [c, at, d] of [[1000, 3.5, -1], [1000, 996.5, 1], [300, 150, 0], [2000, 1999, -1]]) { const w = W(c, at, d); assert.ok(w.lo >= 0 && w.hi <= c - 1 && w.hi - w.lo <= N && w.lo <= at && at <= w.hi, JSON.stringify([c, at, d, w])); }
});
test('(둘레) 500개 채팅: 전부가 아니라 보는 자리 둘레 WARM_AROUND 안만 풀고 멈춘다 — 묶음 수도 그만큼만', () => {
    begin(500, 489); const s0 = M._warm.state().slices;
    M.kickWarm(0); settle(120000);
    const w = warmed();
    assert.ok(w.length > 100 && w.length <= M.WARM_AROUND + 1, '푼 수 ' + w.length);
    assert.ok(w.every(i => i >= 500 - 10 - M.WARM_AROUND - 2 && i < 490), '둘레 밖을 풀었어요: ' + w[0] + ' ~ ' + w.at(-1));
    assert.ok(mes.slice(0, 300).every(m => !m.attrs.has('data-bl-warm')), '먼 메시지(0 ~ 299)는 그대로 건너뛴다');
    const st = M._warm.state(); assert.equal(st.timer || st.job || st.look, false, '다 풀면 일정이 남지 않는다');
    assert.ok(st.slices - s0 <= M.WARM_AROUND, '묶음 ' + (st.slices - s0) + '번');
});
test('(굴리는 중 쉼) scroll 이 이어지는 동안 묶음을 돌리지 않고, WARM_SCROLL_REST_MS 멎은 뒤 새 자리 둘레로 이어 간다 · 굴리던 쪽을 더 넉넉히', () => {
    begin(500, 489); M.kickWarm(0); advance(M.WARM_QUIET_MS + 400);   // 몇 묶음 푼 채
    const before = M._warm.state().slices;
    for (let v = 480; v >= 300; v -= 6) { moveTo(v); scrollEvent(); advance(50); }   // 위로 계속 굴림(1.5초)
    assert.equal(M._warm.state().slices, before, '굴리는 동안 묶음이 돌았어요');
    assert.equal(M._warm.state().dir, -1, '위로 굴리던 중');
    settle(120000);
    const w = warmed(); const up = w.filter(i => i < 300).length, down = w.filter(i => i > 301).length;
    assert.ok(up >= M.WARM_AHEAD - 12 && up <= M.WARM_AHEAD + M.WARM_KEEP, '위쪽(굴리던 쪽) ' + up);
    assert.ok(down >= 30, '아래쪽 ' + down);
});
test('(멀리 뛰기) scroll 사건 그 자리에서 — 프레임이 그려지기 전 — 보이는 메시지와 위아래 VIEW_GUARD 개가 풀린다 · 읽기가 모두 쓰기보다 먼저', () => {
    begin(500, 489); M.kickWarm(0); settle(120000);
    assert.ok(!mes[100].attrs.has('data-bl-warm'));
    const log = []; for (const m of mes) { const r = m.getBoundingClientRect, w = m.setAttribute; m.getBoundingClientRect = () => { log.push('r'); return r(); }; m.setAttribute = (a, v) => { if (a === 'data-bl-warm') log.push('w'); w(a, v); }; }
    events.length = 0; const reads0 = rectReads;
    moveTo(100); scrollEvent();   // 찾기 · 북마크 · 번호로 이동 · 맨 위로 … 어느 길이든 #chat 이 구르면 와요. 시계를 돌리지 않음 = 같은 프레임
    const vis = mes.filter(m => m.top < 600 && m.top + 200 > 0).map(m => m.i);
    assert.ok(vis.length >= 2 && vis.includes(100), '보이는 것 ' + vis);
    for (let i = vis[0] - M.VIEW_GUARD; i <= vis.at(-1) + M.VIEW_GUARD; i++) assert.ok(mes[i].attrs.has('data-bl-warm'), i + '번이 아직 건너뛴 채');
    assert.ok(!mes[vis[0] - M.VIEW_GUARD - 1].attrs.has('data-bl-warm') && !mes[vis.at(-1) + M.VIEW_GUARD + 1].attrs.has('data-bl-warm'), '그 자리에서는 보이는 둘레만');
    assert.ok(log.lastIndexOf('r') < log.indexOf('w'), '쓰기 뒤에 자리를 읽었어요(강제 배치): ' + log.join(''));
    assert.ok(rectReads - reads0 <= 2 + 12 + vis.length + 2, '자리 읽기 ' + (rectReads - reads0) + '번(이분 탐색이어야 해요 · 메시지 500개)');
    assert.ok(events.some(e => e[1] === 'contentvisibilityautostatechange' && e[2] === false), '네모 단추 감시에 풀린 메시지를 알린다');
    settle(120000);
    const w = warmed();
    assert.ok(w.filter(i => i >= 20 && i <= 180).length >= 130, '뛴 자리 둘레가 풀린다');
    assert.ok(mes.slice(300).every(m => !m.attrs.has('data-bl-warm')), '옛 자리(바닥 쪽)의 표식은 떼서 다시 건너뛴다 — 푼 수가 채팅 길이만큼 쌓이지 않는다');
    assert.ok(w.length <= M.WARM_AROUND + 2 * M.WARM_KEEP + 2 * M.VIEW_GUARD + 4, '푼 수 ' + w.length);
    assert.ok(M._warm.state().cooled > 0);
});
test('(1.6.5 버그 사냥 6차) 다른 확장 · CSS 가 숨긴(display:none · 자리 0) 메시지가 섞여도 이분 탐색이 보이는 메시지를 찾아요', () => {
    begin(500, 489); M.kickWarm(0); settle(120000);
    moveTo(100);
    const hide = i => (i > 100 && i % 3 !== 0) || (i < 90 && i % 4 === 0);   // 보이는 자리 아래로 많이 · 위로도 몇 개 숨김
    for (const m of mes) if (hide(m.i)) m.getBoundingClientRect = () => { rectReads++; return { top: 0, bottom: 0, height: 0 }; };
    scrollEvent();
    const vis = mes.filter(m => !hide(m.i) && m.top < 600 && m.top + 200 > 0).map(m => m.i);
    assert.ok(vis.includes(100), '보이는 것 ' + vis);
    for (const i of vis) assert.ok(mes[i].attrs.has('data-bl-warm'), i + '번(보이는 메시지)이 아직 건너뛴 채');
    for (const m of mes) delete m.getBoundingClientRect;
    setMessages(500, 489);   // 다음 시험을 위해 새 메시지로
});
test('(여유) 둘레에서 WARM_KEEP 안쪽으로만 벗어난 푼 메시지는 되돌리지 않는다(조금 굴릴 때마다 뗐다 붙였다 하지 않게)', () => {
    begin(500, 290); scrollEvent(); moveTo(300); scrollEvent(); settle(120000);   // 아래로 굴리던 중(둘레가 같은 쪽으로 치우친 채)
    const a = warmed();
    moveTo(300 + M.WARM_KEEP - 10); scrollEvent(); settle(120000);
    for (const i of a) assert.ok(mes[i].attrs.has('data-bl-warm'), i + '번을 되돌렸어요');
});
test('(쉬는 동안) 답을 받는 중 · 서랍이 열려 표식을 뗀 동안에는 scroll 이 와도 달지 않는다(예전처럼 브라우저에 맡김)', () => {
    begin(500, 489); M.kickWarm(0); settle(120000);
    document.body.dataset.generating = 'true'; moveTo(100); scrollEvent();
    assert.ok(!mes[100].attrs.has('data-bl-warm'));
    delete document.body.dataset.generating;
    M.coolOffscreen(); moveTo(200); scrollEvent();
    assert.ok(!mes[200].attrs.has('data-bl-warm'), '되돌린 상태(cool)에서는 달지 않는다');
    assert.equal(warmed().length, 0);
    M._warm.stop();
});
test('(묶음 최소) 고정 몫이 조각 시간을 넘겨도 묶음 크기가 WARM_BATCH_MIN 아래로 내려가지 않는다 — 메시지마다 고정 몫을 따로 치르지 않게', () => {
    begin(500, 489); const s0 = M._warm.state().slices; FIXED = 120; PER = 10;   // 긴 채팅: 고정 몫만으로 조각 시간(50ms)의 1.5배를 넘음
    try { M.kickWarm(0); settle(240000); } finally { FIXED = 20; PER = 5; }
    const st = M._warm.state(); const done = warmed().length;
    assert.equal(M.WARM_BATCH_MIN, 4); assert.ok(done >= 140, '푼 수 ' + done);
    assert.ok(st.k >= M.WARM_BATCH_MIN, '묶음 크기 ' + st.k);
    assert.ok(st.slices - s0 <= Math.ceil(done / M.WARM_BATCH_MIN) + 6, '묶음 ' + (st.slices - s0) + '번 · 메시지 ' + done + '개(묶음 크기가 1 로 내려앉으면 메시지 수만큼 돌아요)');
    M._warm.stop();
});
test('(1.7.1 제자리 scroll) 보이는 메시지가 그대로인 scroll(풀린 메시지의 크기가 잡혀 스크롤 고정이 scrollTop 을 옮김 · 글 칸이 커지고 작아짐)은 미리 그리기를 멈추거나 처음부터 다시 잡지 않는다', () => {
    // 관문 차례(스트리밍 → 타이핑 → 굴리기)를 쉼 없이 밟으면 1.6.3 ~ 1.7.0 은 이런 scroll 마다 kickWarm(200) 으로 묶음을 버리고 다시 시작해
    //   굴리기 전에 155개 중 52 ~ 120개만 풀려 있었어요(폰 4배 관문 스크롤 p95 233 ~ 483ms · 1.6.2 는 145개 다 · 16.7ms)
    begin(500, 489); M.kickWarm(0); advance(M.WARM_QUIET_MS + 400);
    const s0 = M._warm.state().slices, w0 = warmed().length, dir0 = M._warm.state().dir;
    scrollEvent();   // 지금 자리를 먼저 한 번 알아 둬요(첫 scroll 은 움직임으로 봐요)
    for (let k = 0; k < 40; k++) { fakeTop += k % 2 ? 7 : -3; scrollEvent(); advance(60); }   // 2.4초 동안 60ms 마다 — 보이는 메시지는 그대로
    const st = M._warm.state();
    assert.ok(st.slices - s0 >= 10, '묶음이 이어지지 않았어요: ' + (st.slices - s0) + '번');
    assert.ok(warmed().length > w0 + 40, '푼 수 ' + w0 + ' → ' + warmed().length);
    assert.equal(st.dir, dir0, '제자리 scroll 로 굴리던 방향을 바꾸지 않는다');
    // 보이는 메시지가 바뀌면(사람이 굴림) 예전처럼 쉬었다가 새 자리 둘레로
    const s1 = M._warm.state().slices;
    for (let v = 480; v >= 400; v -= 4) { moveTo(v); scrollEvent(); advance(50); }
    assert.equal(M._warm.state().slices, s1, '굴리는 동안 묶음이 돌았어요');
    settle(120000);
    assert.ok(warmed().filter(i => i < 400).length >= M.WARM_AHEAD - 12, '새 자리 위쪽이 풀린다');
    M._warm.stop();
});
test('(짧은 채팅 · 다른 칸) 긴 채팅 표식이 없거나 #chat 이 아닌 칸의 scroll 은 아무것도 읽지 않는다', () => {
    const r0 = rectReads; docListeners.get('scroll').f({ target: { id: 'other' } });
    const had = htmlClasses.has('bl-chat-light'), hadC = chat.classes.has('bl-chat-light');
    htmlClasses.delete('bl-chat-light'); chat.classes.delete('bl-chat-light'); scrollEvent();
    assert.equal(rectReads, r0);
    if (had) htmlClasses.add('bl-chat-light'); if (hadC) chat.classes.add('bl-chat-light');
    M._warm.stop();
});
test('(배선) scroll 은 문서에서 capture · passive 로 한 번 · 글 고르는 동안의 규칙(data-bl-chat-sel)은 이 고침이 건드리지 않는다', () => {
    const l = docListeners.get('scroll'); assert.ok(l && l.opts && l.opts.capture === true && l.opts.passive === true);
    const js = read('src/chat-light.js');
    assert.equal((js.match(/addEventListener\('scroll', onChatScroll/g) || []).length, 1);
    assert.match(js, /if \(!warm\.cool && document\.body\?\.dataset\?\.generating !== 'true'\) \{[^\n]*\n\s+viewGuard\(el\);\n\s+if \(!warm\.moved\) \{ warm\.held\+\+; return; \}/);
    assert.match(read('css/05-chat.css'), /^:where\(html\.bl-chat-light\[data-bl-chat-sel\]\) body\.salty \[id="chat"\]:not\(#salty-none\) > \.mes/m, '고르는 동안 크기 기억 규칙(1.5.9)');
});
test('(1.8.3 perf-jank) 답장 토큰 · 생성 시작에 보는 자리(마지막 scroll 의 기억) 바로 위 STREAM_KEEP 띠는 남긴다 — 자리를 새로 재지 않고, 서랍 · 설정 적용은 예전처럼 전부 뗀다', () => {
    // 고치기 전: 첫 토큰에 표식을 전부 떼서, 답 끝 → 프레임마다 치기 → 곧바로 굴리기에서 굴리기 전 150개 중 12개만 다시 풀려 있었어요(리그 f6)
    begin(500, 300); scrollEvent(); settle(120000);
    assert.ok(mes[300].attrs.has('data-bl-warm') && mes[280].attrs.has('data-bl-warm'));
    const r0 = rectReads, f0 = forcedOutside;
    es.emit('tok', '하나');
    assert.equal(rectReads, r0, '떼는 순간 자리를 재지 않는다'); assert.equal(forcedOutside, f0);
    const kept = warmed();
    const view = M._warm.state(); void view;
    assert.ok(kept.length >= M.STREAM_KEEP - 2 && kept.length <= M.STREAM_KEEP + 2 * M.VIEW_GUARD + 2, '남긴 수 ' + kept.length);
    assert.ok(kept.every(i => i >= 300 - M.STREAM_KEEP - 2 * M.VIEW_GUARD - 2 && i <= 304 + M.VIEW_GUARD), '보는 자리 위쪽 띠만: ' + kept[0] + ' ~ ' + kept.at(-1));
    assert.ok(kept.includes(290) && kept.includes(275), '바로 위가 남는다');
    // 토큰이 끊기면 둘레를 다시 풀고, 남긴 것은 다시 달지 않는다(그대로)
    settle(120000); assert.ok(warmed().length > kept.length);
    // 서랍 · 설정 적용(문서 전체 다시 계산)은 예전처럼 전부 뗀다
    openDrawer = { pinned: false }; M.warmOnDrawers(); assert.equal(warmed().length, 0); openDrawer = null; M.warmOnDrawers(); settle(120000);
    assert.ok(M.coolForRestyle() > 0); assert.equal(warmed().length, 0);
    // 보는 자리를 모르면(채팅이 바뀌어 기억이 비었음) 바닥 띠
    begin(200, 189); M.kickWarm(0); settle(120000);
    es.emit('tok', '둘');
    const k2 = warmed();
    assert.ok(k2.length > 0 && k2.every(i => i >= 200 - 1 - M.VIEW_GUARD - M.STREAM_KEEP), '바닥 띠: ' + k2[0]);
    M._warm.stop();
});
console.log(`chat-light-warm: ${n}/${n + failed} 통과`);
process.exit(failed ? 1 : 0);
