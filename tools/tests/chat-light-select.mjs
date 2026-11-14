// 긴 채팅 가볍게 — 채팅 글을 고른 동안 화면 밖 건너뛰기 쉬기 (src/chat-light.js syncSelectAhead · 1.4.8 select-scroll)
//   node tools/tests/chat-light-select.mjs <테마 루트>
// 제보: 고른 채 아래로 내리면 메시지 사이가 비고 그 아래 채팅 칸 전체가 빈 화면. 화면 밖 건너뛴 메시지(content-visibility:auto)가 화면에 닿은 뒤에야 풀려서로 봐요.
// 확인(기본 'all'): 채팅 안 고르기가 생기면 html[data-bl-chat-sel] 을 한 번 달아 CSS 건너뛰기 규칙이 빠지고, 고르기가 풀리면 떼요 ·
//   같은 고르기가 이어지면 다시 쓰지 않고 · 편집 칸 초점 · 짧은 채팅이면 Selection 을 읽지 않고 · 채팅 밖 · 접힌 고르기 · 꺼짐에는 아무것도 안 하고 ·
//   자리 · 계산된 스타일을 읽지 않아요. 남겨 둔 'near' 모드(위아래 SELECT_NEAR 띠만 미리 그리기)도 확인해요.
//   리그 비용(폰 384 · CPU 4배 · 미리 그린 표식을 뗀 가장 나쁜 상태 · 보고 `지시-1114/선택-스크롤-깨짐/보고.md`)으로 'all' 을 골랐어요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let n = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.message}`); } };

// ---------------------------------------------------------------- 가짜 DOM
let rectReads = 0, selReads = 0;
const listeners = new Map();
class FakeMO { constructor() { } observe() { } disconnect() { } }
globalThis.MutationObserver = FakeMO;
const ios = [];
class FakeIO {
    constructor(cb, opts) { this.cb = cb; this.opts = opts; this.watched = new Set(); this.live = true; ios.push(this); }
    observe(el) { this.watched.add(el); }
    unobserve(el) { this.watched.delete(el); }
    disconnect() { this.live = false; this.watched.clear(); }
    fire(els, hit = true) { this.cb(els.map(target => ({ target, isIntersecting: hit }))); }
}
globalThis.IntersectionObserver = FakeIO;
function mes(i, chat) {
    const attrs = new Map(); const cls = new Set(['mes']);
    const m = {
        i, attrs, parentElement: chat, tagName: 'DIV', events: 0,
        classList: { contains: c => cls.has(c), add: c => cls.add(c) },
        hasAttribute: a => attrs.has(a), setAttribute: (a, v) => attrs.set(a, v), removeAttribute: a => attrs.delete(a), getAttribute: a => attrs.get(a) ?? null,
        // SKIP_SELECTOR: .mes:not(.last_mes, .bl-menu-open, .selected):not([data-bl-tail])
        matches: sel => { assert.match(sel, /^\.mes:not\(\.last_mes, \.bl-menu-open, \.selected\):not\(\[data-bl-tail\]\)$/); return !cls.has('last_mes') && !cls.has('selected') && !cls.has('bl-menu-open') && !attrs.has('data-bl-tail'); },
        dispatchEvent: () => { m.events++; return true; },
        getBoundingClientRect: () => { rectReads++; return { top: 0, bottom: 0 }; },
    };
    return m;
}
function makeChat(count) {
    const chat = { id: 'chat', kids: [], contains: node => node === chat || chat.kids.includes(node) || chat.kids.includes(node?.parentElement), classList: { contains: () => false } };
    for (let i = 0; i < count; i++) chat.kids.push(mes(i, chat));
    chat.kids.forEach((k, i) => { Object.defineProperty(k, 'nextElementSibling', { get: () => chat.kids[i + 1] ?? null }); Object.defineProperty(k, 'previousElementSibling', { get: () => chat.kids[i - 1] ?? null }); });
    Object.defineProperty(chat, 'firstElementChild', { get: () => chat.kids[0] ?? null });
    Object.defineProperty(chat, 'lastElementChild', { get: () => chat.kids.at(-1) ?? null });
    chat.kids.at(-1).classList.add('last_mes');
    return chat;
}
let chat = makeChat(80);
let selection = { rangeCount: 0, anchorNode: null, focusNode: null, collapsed: true };
const htmlClasses = new Set(), htmlAttrs = new Map();
let htmlWrites = 0;
globalThis.document = {
    activeElement: null,
    documentElement: { classList: { contains: c => htmlClasses.has(c), toggle: (c, f) => (f ? htmlClasses.add(c) : htmlClasses.delete(c)), remove: c => htmlClasses.delete(c) },
        hasAttribute: a => htmlAttrs.has(a), setAttribute: (a, v) => { htmlWrites++; htmlAttrs.set(a, v); }, removeAttribute: a => { htmlWrites++; htmlAttrs.delete(a); } },
    body: { dataset: {} },
    getElementById: id => (id === 'chat' ? chat : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    getSelection: () => { selReads++; return { rangeCount: selection.rangeCount, anchorNode: selection.anchorNode, focusNode: selection.focusNode, getRangeAt: () => ({ collapsed: selection.collapsed }) }; },
    addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    removeEventListener: () => { },
};
globalThis.window = globalThis;
globalThis.getComputedStyle = () => { throw new Error('계산된 스타일을 읽었어요'); };
const fire = type => { for (const fn of listeners.get(type) || []) fn({}); };
const select = (node, collapsed = false) => { selection = { rangeCount: 1, anchorNode: node, focusNode: node, collapsed }; fire('selectionchange'); };
const unselect = () => { selection = { rangeCount: 0, anchorNode: null, focusNode: null, collapsed: true }; fire('selectionchange'); };

const M = await import(pathToFileURL(path.join(root, 'src/chat-light.js')).href);
M.syncChatLight(true);   // 80개 → html.bl-chat-light · 바닥 10개 표식 · 미리 그리기 · 고르기 감시 등록
M._warm.stop();
const liveIo = () => ios.filter(o => o.live).at(-1);

await test('켜면 selectionchange 를 들어요 · 고르기 전에는 관찰이 없어요', () => {
    assert.ok(htmlClasses.has(M.CLASS));
    assert.ok((listeners.get('selectionchange') || []).length >= 1);
    assert.equal(M._select.state().watching, false);
});
await test("기본은 'all': 채팅 안 글을 고르면 html 에 data-bl-chat-sel 을 한 번 달고, 이어지는 selectionchange 에는 다시 쓰지 않고, 풀면 떼요", () => {
    assert.equal(M.SELECT_MODE, 'all');
    assert.equal(M.SEL_ATTR, 'data-bl-chat-sel');
    const w0 = htmlWrites;
    select(chat.kids[30]);
    assert.ok(htmlAttrs.has(M.SEL_ATTR));
    for (let i = 0; i < 20; i++) select(chat.kids[30 + (i % 5)]);
    assert.equal(htmlWrites - w0, 1, '손잡이를 끄는 동안 html 을 다시 쓰지 않아요');
    assert.equal(ios.length, 0, "'all' 은 관찰을 걸지 않아요");
    assert.ok(!chat.kids.some(k => k.hasAttribute(M.WARM_ATTR) && k.i !== 5), '메시지 표식은 안 건드려요');
    unselect();
    assert.ok(!htmlAttrs.has(M.SEL_ATTR));
    assert.equal(htmlWrites - w0, 2);
    unselect();
    assert.equal(htmlWrites - w0, 2, '안 고른 상태가 이어지면 아무것도 안 해요');
});
await test("'all': 끄면 바로 떼요 · 접힌 고르기 · 채팅 밖 고르기에는 안 달아요", () => {
    select(chat.kids[30], true); assert.ok(!htmlAttrs.has(M.SEL_ATTR));
    select({ parentElement: null }); assert.ok(!htmlAttrs.has(M.SEL_ATTR));
    select(chat.kids[30]); assert.ok(htmlAttrs.has(M.SEL_ATTR));
    M.syncChatLight(false); assert.ok(!htmlAttrs.has(M.SEL_ATTR));
    M.syncChatLight(true); M._warm.stop();
    assert.ok(htmlClasses.has(M.CLASS));
    unselect();
});
await test('「near」 모드: 채팅 안 글을 고르면 #chat 뿌리 · 위아래로 넓힌 관찰을 걸고, 건너뛰는 메시지만 봐요(바닥 10개 · 마지막 · 이미 그린 것 빼고)', () => {
    M._select.mode('near');
    chat.kids[5].setAttribute(M.WARM_ATTR, '');
    select(chat.kids[30]);
    assert.ok(!htmlAttrs.has(M.SEL_ATTR), "'near' 는 건너뛰기 규칙을 끄지 않아요");
    const io = liveIo();
    assert.ok(io, '관찰이 걸려요');
    assert.equal(io.opts.root, chat);
    assert.equal(io.opts.rootMargin, `${M.SELECT_NEAR} 0px`);
    assert.match(M.SELECT_NEAR, /^\d+%$/);
    assert.ok(!io.watched.has(chat.kids[5]), '이미 그린 메시지는 안 봐요');
    assert.ok(!io.watched.has(chat.kids[79]) && !io.watched.has(chat.kids[75]), '바닥 10개 · 마지막은 늘 그려져 있어요');
    assert.equal(io.watched.size, 80 - 10 - 1);
});
await test('띠에 들어온 메시지에 바로 표식을 달고 알려요 · 띠 밖은 그대로(화면 밖 건너뛰기 유지)', () => {
    const io = liveIo();
    io.fire([chat.kids[40], chat.kids[41]]);
    io.fire([chat.kids[60]], false);
    assert.ok(chat.kids[40].hasAttribute(M.WARM_ATTR) && chat.kids[41].hasAttribute(M.WARM_ATTR));
    assert.equal(chat.kids[40].events, 1, '네모 단추 감시에 풀린 메시지를 알려요');
    assert.ok(!chat.kids[60].hasAttribute(M.WARM_ATTR), '띠 밖은 그대로 건너뛰어요');
    assert.ok(!io.watched.has(chat.kids[40]), '단 메시지는 더 안 봐요');
    assert.equal(chat.kids.filter(k => k.hasAttribute(M.WARM_ATTR)).length, 3);
});
await test('같은 고르기가 이어지면(손잡이 끌기 · selectionchange 여러 번) 관찰을 다시 만들지 않아요', () => {
    const before = ios.length;
    for (let i = 0; i < 20; i++) select(chat.kids[30 + (i % 5)]);
    assert.equal(ios.length, before);
});
await test('고르기가 풀리면 관찰을 끊고, 단 표식은 그대로 둬요', () => {
    const io = liveIo();
    unselect();
    assert.equal(io.live, false);
    assert.equal(M._select.state().watching, false);
    assert.ok(chat.kids[40].hasAttribute(M.WARM_ATTR));
    M._select.mode('all');
});
await test('접힌 고르기(커서만) · 채팅 밖 고르기는 아무것도 안 해요', () => {
    const before = ios.length;
    select(chat.kids[30], true);
    select({ parentElement: null });
    assert.equal(ios.length, before);
});
await test('메시지 편집 칸(채팅 안 입력칸)에 초점이 있으면 Selection 을 읽지 않아요(글을 칠 때마다 오는 selectionchange)', () => {
    const r0 = selReads;
    const edit = { tagName: 'TEXTAREA', parentElement: chat.kids[20] };
    document.activeElement = edit;
    for (let i = 0; i < 30; i++) fire('selectionchange');
    assert.equal(selReads, r0);
    document.activeElement = null;
});
await test('보내기 칸(채팅 밖)에 초점이 남아 있어도 채팅 글을 고르면 걸어요(리그: 고른 뒤에도 초점은 보내기 칸)', () => {
    document.activeElement = { tagName: 'TEXTAREA', parentElement: null };
    select(chat.kids[30]);
    assert.equal(M._select.state().watching, true);
    unselect();
    assert.equal(M._select.state().watching, false);
    document.activeElement = null;
});
await test('짧은 채팅이면 selectionchange 에 Selection 을 읽지 않아요', () => {
    htmlClasses.delete(M.CLASS);
    const r0 = selReads;
    for (let i = 0; i < 30; i++) fire('selectionchange');
    assert.equal(selReads, r0);
    htmlClasses.add(M.CLASS);
});
await test('「near」: 생성 중에는 고른 채여도 달지 않아요(답장 동안 화면 밖을 쉬게 하는 규칙 그대로)', () => {
    M._select.mode('near');
    select(chat.kids[30]);
    const io = liveIo();
    document.body.dataset.generating = 'true';
    io.fire([chat.kids[50]]);
    assert.ok(!chat.kids[50].hasAttribute(M.WARM_ATTR));
    delete document.body.dataset.generating;
    unselect();
    M._select.mode('all');
});
await test('짧은 채팅(가볍게가 안 걸림) · 설정을 끄면 관찰하지 않아요', () => {
    htmlClasses.delete(M.CLASS);
    const before = ios.length;
    select(chat.kids[30]);
    assert.equal(ios.length, before);
    htmlClasses.add(M.CLASS);
    select(chat.kids[30]);
    assert.equal(M._select.state().watching, true);
    M.syncChatLight(false);
    assert.equal(M._select.state().watching, false, '끄면 바로 끊어요');
    select(chat.kids[31]);
    assert.equal(M._select.state().watching, false);
});
await test('자리 · 계산된 스타일을 읽지 않아요', () => { assert.equal(rectReads, 0); });
await test('CSS: 건너뛰기 규칙은 html[data-bl-chat-sel] 이 없을 때만(고르지 않는 동안 최적화 그대로) · 선택자는 SKIP_SELECTOR 와 같아요 · CI 에 등록돼 있어요', () => {
    const css = fs.readFileSync(path.join(root, 'css/05-chat.css'), 'utf8');
    const rule = css.match(/^:where\(html\.bl-chat-light:not\(\[data-bl-chat-sel\]\)\) body\.salty \[id="chat"\]:not\(#salty-none\) > (\.mes[^{]*?) \{\n  content-visibility: auto;/m);
    assert.ok(rule, '고르는 동안 빠지는 건너뛰기 규칙');
    assert.equal(rule[1], M.SKIP_SELECTOR);
    assert.ok(!/data-bl-chat-sel/.test(css.replace(rule[0], '').replace(/\/\*[\s\S]*?\*\//g, '')), '다른 규칙은 이 표식을 안 봐요');
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/chat-light-select\.mjs \./);
});
console.log(`chat-light-select: ${n}/${n + failed} 통과`);
process.exit(failed ? 1 : 0);
