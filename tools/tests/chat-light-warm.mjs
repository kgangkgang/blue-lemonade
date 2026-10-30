// 긴 채팅 가볍게 — 쉴 때 화면 밖 메시지 미리 그리기 (src/chat-light.js kickWarm · stepWarm · coolOffscreen · css/05-chat.css [data-bl-warm])
//   node tools/tests/chat-light-warm.mjs <테마 루트>
// 성능 관문 스크롤(폰 4배)에서 content-visibility:auto 로 건너뛴 메시지가 들어오는 프레임마다 스타일 · 배치 · 칠하기를 해 50ms 넘는 프레임이 33개였어요(끄면 3).
// 가짜 DOM · 가짜 시계 · 가짜 scheduler 로: 조용해진 뒤 보는 자리에서 가까운 차례로 data-bl-warm 을 달고 · 몇 개씩 묶어 한 번만 재고 · 한 조각 시간 안에서 비키고 ·
//   생성 중 · 서랍(고정 서랍 빼고) · 답장 토큰 동안은 쉬며 표식을 떼고(자리를 재지 않음) · 드라이런은 건너뛰고 · 네모 단추 감시에 풀린 메시지를 알리고 ·
//   굴려서 그려진 메시지는 그대로 두는지. CSS 규칙(속성 표식 · !important) · 미리보기 사본 제외 · CI 등록도 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------- 가짜 시계 · 타이머 · scheduler
let clock = 0, tid = 0;
const timers = new Map(), tasks = [];
globalThis.performance = { now: () => clock };
globalThis.setTimeout = (fn, ms = 0) => { const id = ++tid; timers.set(id, { fn, at: clock + ms }); return id; };
globalThis.clearTimeout = id => { timers.delete(id); };
const priorities = [];
globalThis.scheduler = { postTask(fn, opts = {}) { priorities.push(opts.priority); const t = { fn, signal: opts.signal }; tasks.push(t); return new Promise(() => { }); } };
const slices = [];
/** 타이머와 낮은 우선순위 작업을 ms 동안(가짜 시계) 돌린다 — 작업마다 걸린 시간을 적어 둔다 */
function advance(ms) {
    const end = clock + ms;
    for (let guard = 0; guard < 100000; guard++) {
        const t = clock < end ? tasks.shift() : null;   // 작업도 시계 안에서만 — 한 조각씩 볼 수 있게
        if (t) { if (t.signal?.aborted) continue; const s = clock; t.fn(); slices.push(clock - s); clock += 1; continue; }
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        clock = Math.max(clock, next[1].at); timers.delete(next[0]); next[1].fn();
    }
    clock = Math.max(clock, end);
}

// ---------------------------------------------------------------- 가짜 DOM
const observers = [];
class FakeMO { constructor(cb) { this.cb = cb; this.live = true; observers.push(this); } observe(el, opts) { this.target = el; this.opts = opts; } disconnect() { this.live = false; } }
globalThis.MutationObserver = FakeMO;
const FIXED = 20, PER = 5;   // 한 번 잴 때 고정 몫 · 새로 푼 메시지 하나 몫(ms)
let dirty = 0, forced = 0, rectReads = 0, PER_NOW = PER;
const events = [];
function makeMes(i) {
    const attrs = new Map();
    const m = {
        i, attrs, isConnected: true, excluded: false, top: 0,
        classList: { contains: c => c === 'mes' },
        hasAttribute: a => attrs.has(a),
        setAttribute: (a, v) => { if (!attrs.has(a)) dirty++; attrs.set(a, v); },
        removeAttribute: a => { attrs.delete(a); },
        getAttribute: a => attrs.get(a) ?? null,
        getBoundingClientRect: () => { rectReads++; return { top: m.top, bottom: m.top + 200, height: 200 }; },
        dispatchEvent: ev => { events.push([i, ev.type, ev.skipped]); return true; },
    };
    return m;
}
let mes = [];
const chat = {
    id: 'chat', classes: new Set(),
    classList: { contains: c => chat.classes.has(c), toggle(c, f) { if (f) chat.classes.add(c); else chat.classes.delete(c); }, remove(c) { chat.classes.delete(c); } },
    querySelectorAll(sel) {
        if (sel === ':scope > .mes') return mes;
        if (sel === ':scope > .mes:not([data-bl-warm])') return mes.filter(m => !m.attrs.has('data-bl-warm'));
        if (sel === ':scope > .mes[data-bl-warm]') return mes.filter(m => m.attrs.has('data-bl-warm'));
        throw new Error('모르는 선택자 ' + sel);
    },
    getBoundingClientRect: () => ({ top: 0, bottom: 600, height: 600 }),
    get offsetHeight() { forced++; clock += FIXED + PER_NOW * dirty; dirty = 0; return 1000; },
};
function setMessages(count) {
    mes = Array.from({ length: count }, (_, i) => makeMes(i));
    // 보는 자리: 89 번이 가운데(0~600) 바로 위 — 바닥 10개(90~99)는 CSS 가 처음부터 안 건너뛴다
    for (const m of mes) { m.top = (m.i - 90) * 200 + 300; m.parentElement = chat; m.excluded = m.i >= count - 10; }
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
    addEventListener: (t, f, cap) => { docListeners.set(t, f); },
};
globalThis.window = { innerHeight: 800, getComputedStyle: m => ({ contentVisibility: m.attrs?.has('data-bl-warm') || m.excluded ? 'visible' : 'auto' }), addEventListener() { }, removeEventListener() { } };
const es = { l: new Map(), on(ev, fn) { if (!this.l.has(ev)) this.l.set(ev, []); this.l.get(ev).push(fn); }, emit(ev, ...a) { for (const fn of [...(this.l.get(ev) || [])]) fn(...a); } };
const T = { STREAM_TOKEN_RECEIVED: 'tok', GENERATION_STARTED: 'gs', GENERATION_ENDED: 'ge', GENERATION_STOPPED: 'gst', MESSAGE_RECEIVED: 'mr', CHAT_CHANGED: 'cc', MESSAGE_SWIPED: 'ms' };
globalThis.SillyTavern = { getContext: () => ({ eventSource: es, eventTypes: T }) };

setMessages(100);
const M = await import(pathToFileURL(path.join(root, 'src/chat-light.js')).href);
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.stack || e.message}`); } };
const warmCount = () => mes.filter(m => m.attrs.has('data-bl-warm')).length;
const candidates = () => mes.filter(m => !m.excluded).length;
const settle = (ms = 20000) => advance(ms);

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
test('보는 자리에서 가까운 차례 · 몇 개씩 묶어 한 번만 잰다 · 한 조각은 WARM_SLICE_MS 남짓에서 비킨다', () => {
    setMessages(100); events.length = 0; forced = 0; slices.length = 0;
    const order = [];
    for (const m of mes) { const set = m.setAttribute; m.setAttribute = (a, v) => { if (a === 'data-bl-warm' && !m.attrs.has(a)) order.push(m.i); set(a, v); }; }
    M.kickWarm(0); settle();
    assert.equal(order.length, 90);
    assert.deepEqual(order.slice(0, 4), [89, 88, 87, 86], '가운데에서 가까운 것부터');
    assert.ok(forced < order.length / 2, `묶어서 잰다(잰 횟수 ${forced} · 메시지 ${order.length})`);
    const worst = Math.max(...slices);
    assert.ok(worst <= M.WARM_SLICE_MS + FIXED + PER, `한 조각이 길지 않다(가장 긴 조각 ${worst}ms)`);
    assert.ok(slices.length > 3, '여러 조각으로 나눠 한다');
});
test('깨끗한 메시지로 묶음이 커진 뒤 처음 그리는(비싼) 메시지를 만나도 한 조각이 WARM_BATCH_MAX 묶음 이상 길어지지 않고 바로 줄인다', () => {
    setMessages(100); slices.length = 0;
    PER_NOW = 0.5; M._warm.stop(); M.kickWarm(0); advance(1);
    for (let i = 0; i < 4; i++) advance(1);   // 몇 조각 — 싼 메시지로 묶음이 커진다
    assert.ok(warmCount() < 90, '아직 다 풀지 않았다(조각을 하나씩 본다)');
    const grown = M._warm.state().k;
    assert.ok(grown > 4, `싸면 묶음이 커진다(${grown})`);
    assert.ok(grown <= M.WARM_BATCH_MAX);
    PER_NOW = 15; const before = slices.length; settle();
    const after = slices.slice(before);
    assert.ok(after.length >= 3, '비싼 메시지는 여러 조각으로');
    assert.ok(Math.max(...after) <= FIXED + 15 * M.WARM_BATCH_MAX + 1, `가장 긴 조각 ${Math.max(...after)}ms`);
    assert.ok(after.slice(2).every(x => x <= M.WARM_SLICE_MS + FIXED), '넘친 다음 조각부터는 줄어든다');
    assert.equal(warmCount(), 90);
    PER_NOW = PER;
});
test('풀어 준 메시지마다 contentvisibilityautostatechange(skipped=false) 를 알려 네모 단추 감시가 안쪽을 잰다', () => {
    const got = new Set(events.filter(e => e[1] === 'contentvisibilityautostatechange' && e[2] === false).map(e => e[0]));
    assert.equal(got.size, 90);
});
test('답장 토큰이 오면 표식을 다 떼고(자리를 재지 않음) 토큰이 STREAM_QUIET_MS 끊긴 뒤에야 다시 푼다', () => {
    assert.equal(warmCount(), 90);
    rectReads = 0;
    es.emit('tok', '하나');
    assert.equal(warmCount(), 0, '토큰이 오면 화면 밖 것을 다시 건너뛰게');
    assert.equal(rectReads, 0, '떼는 순간 자리를 재지 않는다(더러워진 스타일 · 배치를 강제로 계산하지 않게)');
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
test('굴려서 크롬이 그린 메시지(skipped=false)는 표식을 달아 그대로 두고, 쉬는 동안 · 다른 요소 · 건너뛴 알림은 손대지 않는다', () => {
    const onReveal = docListeners.get('contentvisibilityautostatechange');
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
    const st = M._warm.state(); assert.equal(st.timer || st.job, false);
});
test('CSS: 표식(data 속성)이 붙은 메시지는 content-visibility: visible !important · style.css 에 빌드 · 미리보기 사본 제외 · CI 등록', () => {
    const src = read('css/05-chat.css');
    assert.match(src, /^body\.salty #chat > \.mes\[data-bl-warm\] \{\n  content-visibility: visible !important;\n\}/m);
    assert.ok(!/\.bl-warm\b/.test(src), 'class 표식을 쓰지 않는다(실리태번 keyboard.js 감시자가 class 마다 다시 훑음)');
    assert.match(read('style.css'), /> \.mes\[data-bl-warm\] \{\n  content-visibility: visible !important;/);
    assert.ok(!read('css/23-preview.gen.css').includes('data-bl-warm'), '미리보기 사본에는 넣지 않는다');
    assert.match(read('tools/gen-preview-css.js'), /'\[data-bl-warm\]'/);
    const js = read('src/chat-light.js');
    assert.ok(!/requestIdleCallback\(/.test(js), '쉬는 시간 콜백은 화면이 계속 그려지면 몇 ms 만 줘서 쓰지 않는다');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/chat-light-warm\.mjs \./);
});
console.log(`chat-light-warm: ${n}/${n + failed} 통과`);
process.exit(failed ? 1 : 0);
