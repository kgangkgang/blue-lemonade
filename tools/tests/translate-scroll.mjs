// 7.7.4 번역이 끝날 때 읽던 문단이 아래로(맨 아래로) 밀리던 것 — 읽던 위치 보호(src/chat-reading-position.js)의 시나리오 시험.
// 원인: 손댄 지 1.5초 안(관성 · 손가락)에 번역 끝 그림이 오면 보호가 「한 번 맞추고 손을 뗐다」. 그런데 번역기의 끝 그림은
//   비동기다 — 상태창 틀(iframe)이 날 코드 블록으로 잠깐 길어졌다가(수천 px) 헬퍼가 다시 iframe 으로 줄인다. 한 번 맞춘 자리는
//   길어진 배치 기준이라 scrollTop 이 그만큼 앞으로 갔고, 줄어들 때 브라우저가 scrollTop 을 새 바닥으로 잘랐다.
// 고침: 손댄 뒤에는 절대 위치로 되돌리지 않고(관성과 싸우지 않게) 정해진 시간 동안 「배치 변화로 읽던 문단이 움직인 만큼」만 되돌린다.
// 실리태번 모듈을 불러오지 않는다 — 가짜 채팅 칸(높이 모델)으로 node 에서 돈다.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { keepChatReadingPosition: keep, watchChatReadingGestures } = await import(pathToFileURL(path.resolve(process.argv[2] || '.', 'src/chat-reading-position.js')));

/**
 * 채팅 칸: [앞 메시지들 above] [대상 메시지: 생각 칸 reasoning · 상태창 card · 문단들] [뒤 메시지들 below]
 * 높이만 바꾸면 위치가 다시 계산된다. 칸 높이보다 scrollTop 이 크면 브라우저처럼 바닥으로 자른다.
 */
function world({ paragraphs = 60, h = 90, card = 400, reasoning = 0, above = 0, below = 0, viewport = 700, auto = false } = {}) {
    const doc = new EventTarget();
    const observers = [], frames = [];
    doc.defaultView = {
        requestAnimationFrame(fn) { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
        ResizeObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() { this.off = true; } },
    };
    const s = { above, reasoning, card, below, heights: Array(paragraphs).fill(h), top: 0 };
    const mesHeight = () => s.reasoning + s.card + s.heights.reduce((a, b) => a + b, 0);
    const total = () => s.above + mesHeight() + s.below;
    const chat = {
        id: 'chat', ownerDocument: doc, isConnected: true, clientHeight: viewport, clientWidth: 375, clientTop: 0,
        get scrollHeight() { return total(); },
        get scrollTop() { return s.top; }, set scrollTop(v) { s.top = Math.max(0, Math.min(v, total() - viewport)); },
        getBoundingClientRect: () => ({ top: 0, left: 0 }),
    };
    const closest = sel => (sel === '#chat' ? chat : sel === '.mes' ? mes : null);
    const mes = { ownerDocument: doc, isConnected: true, closest, getAttribute: () => '5', querySelector: () => body,
        getBoundingClientRect: () => ({ top: s.above - s.top, height: mesHeight() }) };
    const body = { ownerDocument: doc, parentElement: mes, closest, children: [] };
    const node = (offset, height, tagName = 'P') => ({ tagName, isConnected: true, parentElement: body, classList: { contains: () => false }, closest,
        getBoundingClientRect: () => ({ top: offset() - s.top, bottom: offset() + height() - s.top, height: height() }) });
    const paraTop = i => s.above + s.reasoning + s.card + s.heights.slice(0, i).reduce((a, b) => a + b, 0);
    function build() {
        body.children.forEach(n => { n.isConnected = false; });
        // 상태창 = 날 코드(PRE 하나) 또는 헬퍼 틀(DIV) + 접기 단추(DIV) — 자식 수가 달라진다
        const card = s.framed ? [node(() => s.above + s.reasoning, () => s.card, 'DIV'), node(() => s.above + s.reasoning + s.card, () => 0, 'DIV')] : [node(() => s.above + s.reasoning, () => s.card, 'PRE')];
        body.children = [...card, ...s.heights.map((_, i) => node(() => paraTop(i), () => s.heights[i]))];
    }
    build();
    doc.elementFromPoint = (x, y) => {
        const at = s.top + y;
        if (at < s.above + s.reasoning || at >= s.above + mesHeight()) return at < s.above + s.reasoning && at >= s.above ? mes : chat;
        if (at < s.above + s.reasoning + s.card) return body.children[0];
        let i = 0; while (i < s.heights.length - 1 && paraTop(i + 1) <= at) i++;
        return body.children[i + body.children.length - s.heights.length];
    };
    doc.getElementById = () => chat;
    doc.querySelector = () => mes;
    globalThis.SillyTavern = { getContext: () => ({ chatId: 'c', powerUserSettings: { auto_scroll_chat_to_bottom: auto } }) };
    const scrollEvent = () => { const e = new Event('scroll'); Object.defineProperty(e, 'target', { value: chat }); doc.dispatchEvent(e); };
    const w = {
        s, chat, body, doc, observers, frames,
        /** 화면 위에서 i 번째 문단까지의 거리(px) */
        screen: i => paraTop(i) - s.top,
        gap: () => total() - viewport - s.top,
        /** 높이가 바뀐 뒤 — 브라우저: 바닥 자르기 → ResizeObserver → scroll 이벤트 */
        layout() { const before = s.top; chat.scrollTop = s.top; for (const o of observers) if (!o.off) o.fn(); if (s.top !== before) scrollEvent(); },
        /** 손가락 (gesture 추적 · 보호 해제 모두 같은 이벤트) */
        touch(type = 'touchstart') { const e = new Event(type); Object.defineProperty(e, 'target', { value: body.children[1] }); doc.dispatchEvent(e); },
        /** 읽는 사람이 굴림 (손가락 · 관성) */
        scrollBy(dy) { chat.scrollTop = s.top + dy; scrollEvent(); },
        /** 번역문으로 바꿈: 문단 노드를 새로 만들고 높이를 ratio 배 */
        translate(ratio = 0.8) { s.heights = s.heights.map(x => Math.round(x * ratio)); build(); },
        flush() { frames.splice(0).forEach(fn => fn()); },
        /** i 번째 문단을 화면 맨 위에 두고 읽는 중 (보호가 지키는 것 = 화면 맨 위 문단의 자리) */
        read(i, y = 0) { chat.scrollTop = paraTop(i) - y; },
    };
    return w;
}

// 번역기의 끝 그림 꼴(refreshMessageBlock): 동기 부분에서 번역문을 넣고 상태창 iframe 이 날 코드로 길어짐 → 약속을 돌려줌 →
// 헬퍼가 MESSAGE_UPDATED 를 듣고 iframe 으로 다시 그려 줄어듦 → 약속이 풀림
function finalPaint(w, { tall = 8000, ratio = 0.8, during = () => {}, reframe = false } = {}) {
    let finish;
    // reframe: 그리기 전엔 헬퍼 틀(DIV 둘), 끝 그림은 날 코드(PRE 하나) — 문단 순번이 한 칸 어긋난다
    if (reframe) { w.s.framed = true; w.translate(1); }
    const result = keep(w.body, () => { w.s.framed = false; w.translate(ratio); w.s.card += tall; return new Promise(resolve => { finish = resolve; }); });
    during();
    w.s.card -= tall; if (reframe) { w.s.framed = true; w.translate(1); } w.layout();   // 헬퍼 다시 그림
    finish('ok');
    return result;
}

let count = 0;
const stops = [];
async function check(name, run) {
    try { await run(); count++; console.log('PASS ' + name); } finally { for (const s of stops.splice(0)) s(); }
}
// 손가락 추적은 문서마다 하나 (실제로는 모듈이 불릴 때 document 에 건다)
const gestures = w => { const stop = watchChatReadingGestures(w.doc); stops.push(stop); return w; };

await check('S4 끝나기 직전 손댐 + 상태창 비동기 다시 그림: 읽던 문단이 제자리 (전엔 맨 아래로)', async () => {
    const w = gestures(world({ paragraphs: 80, card: 600 }));
    w.read(40); w.touch('touchend');
    assert.equal(await finalPaint(w), 'ok');
    assert.ok(Math.abs(w.screen(40)) <= 1, `screen ${w.screen(40)}`);
    assert.ok(w.gap() > 0);
});
await check('S4 끝 그림이 상태창 자리의 자식 수를 바꿔도(헬퍼 틀+접기 단추 ↔ 날 코드) 읽던 문단을 같은 태그 순번으로 찾음', async () => {
    for (const touched of [true, false]) {
        const w = gestures(world({ paragraphs: 80, card: 600 }));
        w.s.framed = true; w.translate(1);
        w.read(40); if (touched) w.touch('touchend');
        await finalPaint(w, { tall: 2500, reframe: true });
        w.flush(); w.flush();
        assert.ok(Math.abs(w.screen(40)) <= 1, `${touched ? '손댐' : '안 댐'}: screen ${w.screen(40)}`);
    }
});
await check('S4 읽던 문단이 아래쪽(끝 가까이)이어도 바닥으로 잘리지 않음', async () => {
    const w = gestures(world({ paragraphs: 80, card: 600 }));
    w.read(66); w.touch('touchend');
    await finalPaint(w, { tall: 12000 });
    assert.ok(Math.abs(w.screen(66)) <= 1 && w.gap() > 0, `screen ${w.screen(66)} gap ${w.gap()}`);
});
await check('S2 그리는 중(비동기 사이)에 손대도 줄어든 만큼 되돌림', async () => {
    const w = world({ paragraphs: 80, card: 600 });
    w.read(30);
    await finalPaint(w, { during: () => w.touch('touchstart') });
    assert.ok(Math.abs(w.screen(30)) <= 1, `screen ${w.screen(30)}`);
});
await check('S2 관성으로 계속 내려가는 중이면 사용자가 옮긴 만큼은 그대로 둠', async () => {
    const w = gestures(world({ paragraphs: 80, card: 600 }));
    w.read(30); w.touch('touchend');
    await finalPaint(w, { during: () => w.scrollBy(240) });
    assert.ok(Math.abs(w.screen(30) + 240) <= 1, `screen ${w.screen(30)}`);
});
await check('읽던 문단을 화면 아래로 두고 위로 올라가 버렸으면 끌어오지 않음', async () => {
    const w = gestures(world({ paragraphs: 80, card: 600 }));
    w.read(50); w.touch('touchend');
    let finish;
    const result = keep(w.body, () => { w.translate(); w.s.card += 3000; return new Promise(r => { finish = r; }); });
    w.scrollBy(-4000);   // 맨 위 쪽으로 휙
    const top = w.chat.scrollTop;
    w.s.card -= 3000; w.layout(); finish(1); await result;
    assert.equal(w.chat.scrollTop, Math.min(top, w.chat.scrollHeight - 700));
});
await check('S1 · S2 번역 중 미리 보기(동기 그림)마다 손대며 읽어도 제자리', () => {
    const w = gestures(world({ paragraphs: 60 }));
    w.read(35);
    for (let k = 0; k < 6; k++) {
        w.touch('touchmove');
        keep(w.body, () => { w.s.heights = w.s.heights.map((x, i) => (i <= k * 6 ? Math.round(x * 0.9) : x)); });
        w.layout();
        assert.ok(Math.abs(w.screen(35)) <= 1, `paint ${k}: ${w.screen(35)}`);
    }
});
await check('S3 생각 칸이 뒤늦게 늘어도(번역해서 보기 다시 그림) 손댄 뒤 제자리', async () => {
    const w = gestures(world({ paragraphs: 60, reasoning: 120 }));
    w.read(20); w.touch('touchend');
    await finalPaint(w, { tall: 0 });
    w.s.reasoning = 900; w.layout();
    assert.ok(Math.abs(w.screen(20)) <= 1, `screen ${w.screen(20)}`);
});
await check('S4 화면 3배짜리 짧은 답도 제자리', async () => {
    const w = gestures(world({ paragraphs: 20, h: 100, card: 200 }));
    w.read(8); w.touch('touchend');
    await finalPaint(w, { tall: 3000 });
    assert.ok(Math.abs(w.screen(8)) <= 1, `screen ${w.screen(8)}`);
});
await check('S5 마지막이 아닌 메시지(아래에 다른 답)도 제자리', async () => {
    const w = gestures(world({ paragraphs: 60, above: 5000, below: 9000 }));
    w.read(25); w.touch('touchend');
    await finalPaint(w);
    assert.ok(Math.abs(w.screen(25)) <= 1, `screen ${w.screen(25)}`);
});
await check('S6 자동 스크롤 켬 · 맨 아래에서 보던 사람은 새 바닥을 따라감 (손 안 댐)', async () => {
    const w = world({ paragraphs: 40, auto: true });
    w.chat.scrollTop = w.chat.scrollHeight;
    await finalPaint(w);
    assert.equal(w.gap(), 0);
});
await check('S6 자동 스크롤 켬이어도 위로 올려 읽던 사람은 제자리', async () => {
    const w = gestures(world({ paragraphs: 80, auto: true }));
    w.read(40); w.touch('touchend');
    await finalPaint(w);
    assert.ok(Math.abs(w.screen(40)) <= 1, `screen ${w.screen(40)}`);
});
await check('S6 자동 스크롤 끔 · 손 안 댄 채 끝나도 제자리 (기존 보호)', async () => {
    const w = world({ paragraphs: 80 });
    w.read(40);
    await finalPaint(w);
    w.flush(); w.flush();
    assert.ok(Math.abs(w.screen(40)) <= 1, `screen ${w.screen(40)}`);
});
await check('손댄 뒤 지키기도 정해진 시간이 지나면 듣기를 모두 뗌', async () => {
    const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
    const timers = new Map(); let id = 0;
    globalThis.setTimeout = (fn, ms) => { timers.set(++id, { fn, ms }); return id; };
    globalThis.clearTimeout = n => timers.delete(n);
    try {
        const w = world({ paragraphs: 40 });
        let listeners = 0;
        const add = w.doc.addEventListener.bind(w.doc), remove = w.doc.removeEventListener.bind(w.doc);
        w.doc.addEventListener = (...a) => { listeners++; return add(...a); };
        w.doc.removeEventListener = (...a) => { listeners--; return remove(...a); };
        w.read(20);
        let finish; const result = keep(w.body, () => new Promise(r => { finish = r; }));
        w.touch('touchstart');
        assert.equal(listeners, 1);   // 손댄 뒤엔 scroll 하나만 (배치 변화 확인용)
        finish(); await result;
        const settle = [...timers.values()].find(t => t.ms === 1200);
        assert.ok(settle); settle.fn();
        assert.equal(listeners, 0);
        assert.ok(w.observers.every(o => o.off));
        const before = w.chat.scrollTop; w.s.card += 500; w.layout();
        assert.equal(w.chat.scrollTop, before);   // 다 끝난 뒤의 배치 변화엔 손대지 않음
    } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
});
await check('다른 채팅으로 옮기면 손댄 뒤 지키기도 멈춤', async () => {
    const w = gestures(world({ paragraphs: 60 }));
    w.read(30); w.touch('touchend');
    let finish; const result = keep(w.body, () => { w.translate(); return new Promise(r => { finish = r; }); });
    globalThis.SillyTavern = { getContext: () => ({ chatId: 'other', powerUserSettings: {} }) };
    const before = w.chat.scrollTop; w.s.card += 2000; w.layout(); finish(); await result;
    assert.equal(w.chat.scrollTop, before);
});
console.log(`translate-scroll: ${count} passed`);
