// 서랍 덮개 (src/chat-light.js syncChatCover · css/05-chat.css) — 서랍이 #chat 을 다 덮고 바탕이 불투명할 때만 #chat.bl-chat-covered(content-visibility:hidden)
//   node tools/tests/chat-cover.mjs <테마 루트>
// 가짜 DOM · 가짜 타이머: 덮는 판정(자리 · 불투명 · 여는 중 변환) · 닫히면 바로 뗌 · 뗄 때 스크롤(바닥 → 바닥, 중간 → 그 자리) · 숨긴 동안 채팅이 바뀌면 바로 떼고 다시 안 숨김
//   · 반만 덮는 서랍(PC 옆 패널) · 반투명 서랍은 그대로 · 끄면 감시자 · 리스너 · 클래스를 다 뗀다 · CSS 규칙 · 미리보기 DENY.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// ---------------------------------------------------------------- 가짜 타이머 · 감시자
const timers = new Map(); let tid = 0, now = 0;
globalThis.setTimeout = (fn, ms = 0) => { const id = ++tid; timers.set(id, { fn, at: now + ms }); return id; };
globalThis.clearTimeout = id => { timers.delete(id); };
const advance = ms => { const end = now + ms; for (;;) { const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]; if (!next || next[1].at > end) break; now = next[1].at; timers.delete(next[0]); next[1].fn(); } now = end; };
const observers = [];
class FakeMO { constructor(cb) { this.cb = cb; this.live = true; this.targets = []; observers.push(this); } observe(el, opts) { this.targets.push(el); this.opts = opts; } disconnect() { this.live = false; } }
globalThis.MutationObserver = FakeMO;

function el(id, rect, style = {}) {
    const e = { id, rect, style: { visibility: 'visible', opacity: '1', transform: 'none', backgroundColor: 'rgb(250, 250, 250)', ...style }, classes: new Set() };
    e.classList = { contains: c => e.classes.has(c), add: c => { if (e.classes.has(c)) return; const old = [...e.classes].join(' '); e.classes.add(c); notify(e, old); }, remove: c => { if (!e.classes.has(c)) return; const old = [...e.classes].join(' '); e.classes.delete(c); notify(e, old); } };
    e.getBoundingClientRect = () => ({ ...e.rect });
    return e;
}
function notify(target, oldValue) { for (const o of observers) if (o.live && o.targets.includes(target) && o.opts?.attributes) o.cb([{ type: 'attributes', target, attributeName: 'class', oldValue }]); }
const W = 384, H = 798;
const chat = el('chat', { left: 0, top: 50, right: 384, bottom: 700 });
chat.scrollHeight = 60000; chat.clientHeight = 650; chat.scrollTop = 59350; chat.childWrites = 0;
const persona = el('persona-management-block', { left: 0, top: 46, right: 384, bottom: 798 });
const side = el('right-nav-panel', { left: 200, top: 46, right: 384, bottom: 798 });
const glass = el('AdvancedFormatting', { left: 0, top: 46, right: 384, bottom: 798 }, { backgroundColor: 'rgba(250, 250, 250, 0.8)' });
const drawers = [persona, side, glass];
const winListeners = new Map();
globalThis.window = { innerWidth: W, innerHeight: H, getComputedStyle: e => e.style, addEventListener: (t, f) => winListeners.set(t, f), removeEventListener: t => winListeners.delete(t) };
globalThis.document = { getElementById: id => (id === 'chat' ? chat : null), querySelectorAll: sel => (sel === '.drawer-content' ? drawers : []) };
const es = { l: new Map(), on(ev, fn) { if (!this.l.has(ev)) this.l.set(ev, []); this.l.get(ev).push(fn); }, removeListener(ev, fn) { const a = this.l.get(ev) || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }, emit(ev) { for (const fn of [...(this.l.get(ev) || [])]) fn(); } };
globalThis.SillyTavern = { getContext: () => ({ eventSource: es, eventTypes: { GENERATION_STARTED: 'gs', CHAT_CHANGED: 'cc', MESSAGE_SWIPED: 'ms' } }) };

const M = await import(pathToFileURL(path.join(root, 'src/chat-light.js')).href);
const C = M.COVER_CLASS;
let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.stack || e.message}`); } };
const open = d => { d.classList.remove('closedDrawer'); d.classList.add('openDrawer'); };
const close = d => { d.classList.remove('openDrawer'); d.classList.add('closedDrawer'); };
const chatMo = () => observers.find(o => o.live && o.targets.includes(chat) && o.opts?.childList);
M.syncChatCover(true);

test('판정: 자리를 다 덮고 불투명해야 덮음 — 반만 덮음 · 반투명 · opacity < 1 · 여는 중 변환 · 숨김은 아님', () => {
    assert.equal(M.rectCovers({ left: 0, top: 46, right: 384, bottom: 798 }, { left: 0, top: 50, right: 384, bottom: 700 }), true);
    assert.equal(M.rectCovers({ left: 200, top: 46, right: 384, bottom: 798 }, { left: 0, top: 50, right: 384, bottom: 700 }), false);
    assert.equal(M.rectCovers({ left: 0, top: 100, right: 384, bottom: 798 }, { left: 0, top: 50, right: 384, bottom: 700 }), false, '위가 비면 아님');
    const base = { visibility: 'visible', opacity: '1', transform: 'none', backgroundColor: 'rgb(1, 2, 3)' };
    assert.equal(M.opaqueStyle(base), true);
    assert.equal(M.opaqueStyle({ ...base, backgroundColor: 'rgba(1, 2, 3, 0.85)' }), false);
    assert.equal(M.opaqueStyle({ ...base, backgroundColor: 'rgba(0, 0, 0, 0)' }), false);
    assert.equal(M.opaqueStyle({ ...base, backgroundColor: 'rgb(1 2 3 / 50%)' }), false);
    assert.equal(M.opaqueStyle({ ...base, opacity: '0.6' }), false, '여는 중 페이드');
    assert.equal(M.opaqueStyle({ ...base, transform: 'matrix(1, 0, 0, 1, 0, -40)' }), false, '여는 중 미끄러짐');
    assert.equal(M.opaqueStyle({ ...base, visibility: 'hidden' }), false);
});
test('폰 페르소나 서랍(화면 가득 · 불투명)을 열면 전환 뒤 #chat 에 덮개 · 닫는 순간 바로 뗀다 · 바닥이었으면 바닥으로', () => {
    open(persona); assert.equal(chat.classes.has(C), false, '열자마자는 아직(전환 중일 수 있다)');
    advance(1200); assert.equal(chat.classes.has(C), true);
    assert.deepEqual(M._cover.state().saved, { top: 59350, bottom: true });
    chat.scrollTop = 0;   // 숨긴 동안 범위가 줄어 0 으로 밀렸다고 치자
    close(persona); assert.equal(chat.classes.has(C), false, '닫는 순간');
    assert.equal(chat.scrollTop, chat.scrollHeight - chat.clientHeight, '바닥으로');
});
test('중간을 읽던 중이면 그 자리로 되돌린다 · 같으면 쓰지 않는다', () => {
    chat.scrollTop = 20000; open(persona); advance(1200); assert.equal(chat.classes.has(C), true);
    chat.scrollTop = 0; close(persona); assert.equal(chat.scrollTop, 20000);
    let writes = 0; let v = 20000; Object.defineProperty(chat, 'scrollTop', { get: () => v, set: x => { writes++; v = x; }, configurable: true });
    open(persona); advance(1200); close(persona); assert.equal(writes, 0, '자리가 그대로면 scrollTop 을 쓰지 않는다');
    delete chat.scrollTop; chat.scrollTop = 20000;
});
test('여는 중(변환 · 페이드)이면 기다렸다가 끝난 뒤 덮는다', () => {
    persona.style.transform = 'matrix(1, 0, 0, 1, 0, -40)'; open(persona); advance(200); assert.equal(chat.classes.has(C), false);
    persona.style.transform = 'none'; advance(1000); assert.equal(chat.classes.has(C), true);
    close(persona);
});
test('반만 덮는 서랍(옆 패널) · 반투명 서랍은 덮개를 붙이지 않는다', () => {
    open(side); advance(1200); assert.equal(chat.classes.has(C), false); close(side);
    open(glass); advance(1200); assert.equal(chat.classes.has(C), false); close(glass);
});
test('숨긴 동안 채팅이 바뀌면(새 메시지 · 다른 채팅 · 생성 시작 · 스와이프) 바로 떼고 그 서랍 동안 다시 숨기지 않는다', () => {
    for (const how of ['child', 'gs', 'cc', 'ms']) {
        open(persona); advance(1200); assert.equal(chat.classes.has(C), true, how);
        if (how === 'child') chatMo().cb([{ type: 'childList' }]); else es.emit(how);
        assert.equal(chat.classes.has(C), false, how + ' → 뗌');
        window.innerWidth = W; winListeners.get('resize')?.(); advance(1200);
        assert.equal(chat.classes.has(C), false, how + ' → 이번 서랍 동안 다시 안 숨김');
        close(persona); open(persona); advance(1200); assert.equal(chat.classes.has(C), true, how + ' → 다음에 열면 다시');
        close(persona);
    }
});
test('덮인 동안과 뗀 직후 두 프레임은 #chat 의 scroll 이벤트를 창 캡처에서 멈춘다(숨길 때 scrollTop 0 이 읽던 자리 저장에 닿지 않게) · 다른 요소 scroll 은 그대로', () => {
    const onScroll = winListeners.get('scroll'); assert.ok(onScroll, '창 scroll 캡처 리스너');
    const ev = target => { const e = { target, stopped: false, stopImmediatePropagation() { this.stopped = true; } }; onScroll(e); return e.stopped; };
    advance(40); assert.equal(ev(chat), false, '덮이기 전에는 그대로');
    open(persona); advance(1200); assert.equal(chat.classes.has(C), true);
    assert.equal(ev(chat), true, '덮인 동안 멈춤'); assert.equal(ev(persona), false, '서랍 안 scroll 은 그대로');
    close(persona); assert.equal(ev(chat), true, '뗀 직후(되돌리는 scroll) 도 멈춤');
    advance(40); assert.equal(ev(chat), false, '두 프레임 뒤에는 그대로');
});
test('끄면 감시자 · 리스너 · 덮개를 다 뗀다 · 다시 켜도 한 벌', () => {
    open(persona); advance(1200); assert.equal(chat.classes.has(C), true);
    M.syncChatCover(false);
    assert.equal(chat.classes.has(C), false);
    assert.equal(observers.filter(o => o.live).length, 0);
    assert.equal(winListeners.size, 0);
    assert.equal([...es.l.values()].reduce((a, v) => a + v.length, 0), 0);
    close(persona); open(persona); advance(1200); assert.equal(chat.classes.has(C), false, '끈 뒤에는 안 붙는다');
    close(persona);
    M.syncChatCover(true); M.syncChatCover(true);
    assert.equal(observers.filter(o => o.live).length, 2, '서랍 감시 하나 · 채팅 감시 하나');
    assert.equal(es.l.get('gs').length, 1);
});
test('CSS: body.salty #chat.bl-chat-covered { content-visibility: hidden } · style.css 에 빌드 · 미리보기 DENY · syncChatLight 가 같은 설정으로 켠다', () => {
    assert.match(read('css/05-chat.css'), /^body\.salty #chat\.bl-chat-covered \{\s*content-visibility: hidden;\s*\}/m);
    assert.ok(read('style.css').includes('.bl-chat-covered {'));
    assert.match(read('tools/gen-preview-css.js'), /'\.bl-chat-covered',/);
    assert.match(read('src/chat-light.js'), /syncChatCover\(on\);/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/chat-cover\.mjs \./);
});

console.log(`chat-cover: ${n}/${n + failed} 통과`);
if (failed) process.exit(1);
