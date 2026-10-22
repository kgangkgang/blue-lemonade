import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { keepChatReadingPosition: keep, watchChatReadingGestures } = await import(pathToFileURL(path.resolve(process.argv[2] || '.', 'src/chat-reading-position.js')));

function fixture() {
    let height = 100, top = 1500, key = 'a';
    const frames = [], observers = [];
    const doc = new EventTarget();
    const win = doc.defaultView = {
        requestAnimationFrame(fn) { frames.push(fn); return frames.length; }, cancelAnimationFrame() {},
        ResizeObserver: class { constructor(fn) { this.fn = fn; this.targets = []; observers.push(this); } observe(el) { this.targets.push(el); } disconnect() { this.off = true; } },
    };
    const chat = { ownerDocument: doc, isConnected: true, clientHeight: 480, clientWidth: 375, clientTop: 0,
        get scrollHeight() { return height * 30; }, get scrollTop() { return top; }, set scrollTop(v) { top = Math.max(0, Math.min(v, this.scrollHeight - this.clientHeight)); },
        getBoundingClientRect() { return { top: 0, left: 0 }; },
    };
    const mes = { ownerDocument: doc, isConnected: true, getAttribute: () => '0', closest: s => s === '#chat' ? chat : s === '.mes' ? mes : null,
        getBoundingClientRect: () => ({ top: -top, bottom: height * 30 - top, height: height * 30 }),
        querySelector: () => body,
    };
    const body = { ownerDocument: doc, parentElement: mes, closest: mes.closest, children: [] };
    function fill() { body.children.forEach(n => n.isConnected = false); body.children = Array.from({ length: 30 }, (_, i) => ({
        isConnected: true, parentElement: body, classList: { contains: () => false }, closest: mes.closest,
        getBoundingClientRect: () => ({ top: i * height - top, bottom: (i + 1) * height - top, height }),
    })); }
    fill();
    doc.elementFromPoint = () => body.children[Math.min(29, Math.floor((top + 2) / height))];
    doc.getElementById = () => chat;
    doc.querySelector = () => mes;
    globalThis.SillyTavern = { getContext: () => ({ chatId: key, powerUserSettings: { auto_scroll_chat_to_bottom: true } }) };
    return { chat, mes, body, doc, frames, observers,
        replace(h) { height = h; fill(); chat.scrollTop = top; },
        resize(h) { height = h; chat.scrollTop = top; for (const o of observers) if (!o.off) o.fn(); },
        flush() { frames.splice(0).forEach(fn => fn()); },
        switchChat() { key = 'b'; },
        stop(type = 'wheel') { doc.dispatchEvent(new Event(type)); },
    };
}

let count = 0;
async function check(name, run) { const f = fixture(); try { await run(f); count++; console.log('PASS ' + name); } finally { f.stop(); } }
await check('shorter replacement keeps paragraph 15 instead of clamping to bottom', f => {
    keep(f.body, () => f.replace(40));
    assert.equal(f.chat.scrollTop, 600); assert.equal(f.chat.scrollHeight - f.chat.scrollTop - 480, 120);
});
await check('already at bottom follows the new bottom', f => {
    f.chat.scrollTop = 3000; keep(f.body, () => f.replace(120)); assert.equal(f.chat.scrollTop, 3120);
});
await check('reading position is captured at each paint, including a later upward scroll', f => {
    keep(f.body, () => f.replace(80)); f.stop(); f.chat.scrollTop = 400;
    keep(f.body, () => f.replace(40)); assert.equal(f.chat.scrollTop, 200);
});
await check('late media resize preserves the visible paragraph', f => {
    keep(f.body, () => f.replace(80)); f.resize(100); assert.equal(f.chat.scrollTop, 1500);
});
await check('wheel cancels pending layout/animation restoration', f => {
    keep(f.body, () => f.replace(80)); f.stop(); f.chat.scrollTop = 250; f.flush(); f.resize(100); assert.equal(f.chat.scrollTop, 250);
});
await check('a touch already moving when the next paint starts can cancel it', f => {
    keep(f.body, () => f.replace(80)); f.stop('touchmove'); f.chat.scrollTop = 300; f.flush(); assert.equal(f.chat.scrollTop, 300);
});
await check('switching chats cancels stale asynchronous restoration', f => {
    keep(f.body, () => f.replace(80)); f.switchChat(); f.chat.scrollTop = 300; f.flush(); assert.equal(f.chat.scrollTop, 300);
});
await check('async rendering observes layout before its promise settles', async f => {
    let finish; const result = keep(f.body, () => new Promise(resolve => finish = resolve));
    f.resize(80); assert.equal(f.chat.scrollTop, 1200); finish(42); assert.equal(await result, 42);
});
await check('throwing renderer restores position and removes its observer', f => {
    assert.throws(() => keep(f.body, () => { f.replace(40); throw Error('failed'); }), /failed/);
    assert.equal(f.chat.scrollTop, 600); assert.ok(f.observers.every(o => o.off));
});
await check('no browser or hidden message simply runs the callback', () => assert.equal(keep(null, () => 7), 7));
await check('body whitespace or bare text keeps a relative message position', f => {
    f.doc.elementFromPoint = () => f.body;
    keep(f.body, () => f.replace(40));
    assert.equal(f.chat.scrollTop, 600);
    assert.ok(f.chat.scrollTop < f.chat.scrollHeight - f.chat.clientHeight);
});
await check('one long paragraph keeps its reading fraction after shrinking', f => {
    const make = () => ({ isConnected: true, parentElement: f.body, classList: { contains: () => false },
        closest: f.mes.closest, getBoundingClientRect: () => f.mes.getBoundingClientRect() });
    let anchor = make(); f.body.children = [anchor]; f.doc.elementFromPoint = () => anchor;
    keep(f.body, () => {
        f.replace(40); anchor.isConnected = false; anchor = make(); f.body.children = [anchor];
    });
    assert.equal(f.chat.scrollTop, 600);
});
await check('recent touch keeps this paint but leaves later momentum alone', f => {
    keep(f.body, () => f.replace(80)); f.stop('touchmove'); f.chat.scrollTop = 400;
    const queued = f.frames.length;
    keep(f.body, () => f.replace(40));
    assert.equal(f.chat.scrollTop, 200);
    assert.equal(f.frames.length, queued);
    f.chat.scrollTop = 130; f.flush(); assert.equal(f.chat.scrollTop, 130);
});
await check('a different changed message and visible message are both observed', f => {
    const changed = { ownerDocument: f.doc, closest: selector => selector === '#chat' ? f.chat : changed };
    keep(changed, () => f.replace(80));
    const observer = f.observers.find(item => !item.off);
    assert.ok(observer.targets.includes(changed));
    assert.ok(observer.targets.includes(f.mes));
    f.resize(100); assert.equal(f.chat.scrollTop, 1500);
});
await check('changing swipe cancels queued restoration', f => {
    const message = { swipe_id: 0 };
    globalThis.SillyTavern = { getContext: () => ({ chatId: 'a', chat: [message], powerUserSettings: { auto_scroll_chat_to_bottom: true } }) };
    keep(f.body, () => f.replace(80)); message.swipe_id = 1; f.chat.scrollTop = 250; f.flush();
    assert.equal(f.chat.scrollTop, 250);
    assert.ok(f.observers.every(observer => observer.off));
});
await check('a renderer that never settles releases listeners after its deadline', async f => {
    const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
    const timers = new Map(); let nextId = 0, listeners = 0;
    const add = f.doc.addEventListener.bind(f.doc), remove = f.doc.removeEventListener.bind(f.doc);
    f.doc.addEventListener = (...args) => { listeners++; return add(...args); };
    f.doc.removeEventListener = (...args) => { listeners--; return remove(...args); };
    globalThis.setTimeout = (fn, ms) => { timers.set(++nextId, { fn, ms }); return nextId; };
    globalThis.clearTimeout = id => timers.delete(id);
    try {
        let finish;
        const result = keep(f.body, () => new Promise(resolve => finish = resolve));
        assert.equal(listeners, 8);
        const deadline = [...timers.values()].find(timer => timer.ms === 10000);
        assert.ok(deadline); deadline.fn();
        assert.equal(listeners, 0);
        assert.ok(f.observers.every(observer => observer.off));
        f.chat.scrollTop = 250; finish(9);
        assert.equal(await result, 9);
        assert.equal(f.chat.scrollTop, 250);
        assert.equal(timers.size, 0);
    } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
});
await check('auto-follow disabled preserves the old position at bottom', f => {
    globalThis.SillyTavern = { getContext: () => ({ chatId: 'a', powerUserSettings: { auto_scroll_chat_to_bottom: false } }) };
    f.chat.scrollTop = 3000; keep(f.body, () => f.replace(120));
    assert.equal(f.chat.scrollTop, 2520);
});
await check('an overlay does not hide the visible paragraph from hit testing', f => {
    const hit = f.doc.elementFromPoint;
    const overlay = { closest: () => null };
    f.doc.elementFromPoint = () => overlay;
    f.doc.elementsFromPoint = () => [overlay, hit(), f.body, f.mes, f.chat];
    keep(f.body, () => f.replace(40));
    assert.equal(f.chat.scrollTop, 600);
});
function scrollEvent(f, target = f.chat) {
    const event = new Event('scroll'); Object.defineProperty(event, 'target', { value: target }); f.doc.dispatchEvent(event);
}
await check('late renderer scroll after both layout frames keeps the reading paragraph', f => {
    keep(f.body, () => f.replace(80)); f.flush(); f.flush();
    f.chat.scrollTop = f.chat.scrollHeight; scrollEvent(f);
    assert.equal(f.chat.scrollTop, 1200);
});
await check('late scrolling does not override a user touch', f => {
    keep(f.body, () => f.replace(80)); f.stop('touchmove');
    f.chat.scrollTop = 250; scrollEvent(f); f.flush(); assert.equal(f.chat.scrollTop, 250);
});
await check('keyboard activation of a navigation button cancels restoration', f => {
    keep(f.body, () => f.replace(80));
    const e = new Event('keydown'); Object.defineProperty(e, 'key', { value: 'Enter' }); f.doc.dispatchEvent(e);
    f.chat.scrollTop = 250; f.flush(); scrollEvent(f); assert.equal(f.chat.scrollTop, 250);
});
await check('accessible click navigation cancels restoration without a pointer event', f => {
    keep(f.body, () => f.replace(80));
    const click = new Event('click'); Object.defineProperty(click, 'isTrusted', { value: true }); f.doc.dispatchEvent(click);
    f.chat.scrollTop = 250; f.flush(); scrollEvent(f); assert.equal(f.chat.scrollTop, 250);
});
// 7.6.9 a scripted click (jQuery trigger → element.click(), isTrusted false) is not the reader moving
await check('a scripted click does not cancel restoration', f => {
    keep(f.body, () => f.replace(80)); f.stop('click');
    f.chat.scrollTop = f.chat.scrollHeight; scrollEvent(f); assert.equal(f.chat.scrollTop, 1200);
});
// 7.6.9 a native scrollbar drag sends mousedown without pointerdown
await check('mousedown on the scrollbar cancels restoration', f => {
    keep(f.body, () => f.replace(80)); f.stop('mousedown');
    f.chat.scrollTop = 250; f.flush(); scrollEvent(f); assert.equal(f.chat.scrollTop, 250);
});
// 7.6.9 a tap on a message control is not a scroll gesture: the paint it triggers keeps the full guard
await check('a tap on a message button before the paint does not shorten the guard', f => {
    const stop = watchChatReadingGestures(f.doc);
    try {
        const button = { closest: s => s === '#chat' ? f.chat : s.includes('button') ? button : null };
        for (const type of ['pointerdown', 'touchstart', 'touchend', 'mousedown']) {
            const event = new Event(type); Object.defineProperty(event, 'target', { value: button }); f.doc.dispatchEvent(event);
        }
        keep(f.body, () => f.replace(80)); f.flush(); f.flush();
        f.chat.scrollTop = f.chat.scrollHeight; scrollEvent(f); assert.equal(f.chat.scrollTop, 1200);
        assert.ok(f.observers.some(o => !o.off));
        const move = new Event('touchmove'); Object.defineProperty(move, 'target', { value: button }); f.doc.dispatchEvent(move);
        f.chat.scrollTop = 250; scrollEvent(f); assert.equal(f.chat.scrollTop, 250);
    } finally { stop(); }
});
await check('gesture before the first paint leaves ongoing momentum free', f => {
    const stop = watchChatReadingGestures(f.doc);
    try {
        const event = new Event('touchend'); Object.defineProperty(event, 'target', { value: f.body }); f.doc.dispatchEvent(event);
        keep(f.body, () => f.replace(80));
        assert.equal(f.frames.length, 0);   // no absolute restore frames queued behind the momentum
        f.chat.scrollTop = 250; scrollEvent(f); f.flush(); assert.equal(f.chat.scrollTop, 250);
        // 7.7.4 the observer stays for layout shifts only: a callback without a layout change leaves the reader alone
        for (const o of f.observers) if (!o.off) o.fn();
        assert.equal(f.chat.scrollTop, 250);
    } finally { stop(); }
});
console.log(`chat-reading-position: ${count} passed`);
