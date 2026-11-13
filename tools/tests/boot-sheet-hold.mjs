// 1.2.2 덮개 동안 붙는 시트 모으기 — src/boot-gate.js holdSheet 를 쓰는 자리 · 덮개 동안 계산 스타일을 읽던 자리
//   node tools/tests/boot-sheet-hold.mjs <테마 루트>
// ① 켠 설정 시트(gate-css.js): 덮개 동안 붙으면 꺼진 채 · 다시 적용해도 켜지지 않음 · 다 받으면 클래스는 그대로 달림 · 걷히면 켜짐 · 그동안 끄기로 바뀌면 꺼진 채
// ② 카드 글자색(cardink.js) · 이전 메시지 저절로(show-more-auto.js): 덮개 동안은 읽지 · 누르지 않고 걷힌 뒤 한 번
// ③ 계약: 덮개 동안 붙는 시트마다 holdSheet · 꺼 둔 시트의 값을 읽던 곳은 booting → afterBoot · 실리태번 시트 고치기 · 서랍 규칙 옮기기는 걷힌 뒤
//    · 새 감시자 · 타이머 없음(boot-gate.js 의 MutationObserver 는 예전 하나 그대로)
// ④ 미트볼 맞춤(ext-compat.js): 맞춤 시트는 여덟째로 꺼 둔 채 · 고른 탭 굴리기(scrollIntoView)는 걷힌 뒤
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const src = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const url = rel => pathToFileURL(path.join(root, rel)).href;

let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (error) { fail++; console.log('FAIL ' + name); console.log(error); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ── 작은 문서 흉내: #preloader · head · body.classList · <link>/<style> 의 media 속성 · MutationObserver(손으로 알림)
const observers = [];
globalThis.MutationObserver = class { constructor(cb) { this.cb = cb; this.on = false; observers.push(this); } observe() { this.on = true; } disconnect() { this.on = false; } };
let cover = null;
const classes = new Set(['salty']);
const els = {};
class Sheet {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.attrs = new Map(); this.dataset = {}; this.listeners = {}; this.isConnected = false; this.ownerDocument = globalThis.document; }
    getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; }
    setAttribute(n, v) { this.attrs.set(n, String(v)); }
    removeAttribute(n) { this.attrs.delete(n); }
    hasAttribute(n) { return this.attrs.has(n); }
    get media() { return this.attrs.get('media') ?? ''; }
    set media(v) { this.attrs.set('media', String(v)); }
    addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
    fire(t) { for (const f of this.listeners[t] || []) f(); }
    remove() { this.isConnected = false; }
}
const appended = [];
globalThis.document = {
    getElementById: id => (id === 'preloader' ? cover : els[id] || null),
    createElement: tag => new Sheet(tag),
    styleSheets: [],
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    head: { append(el) { el.isConnected = true; appended.push(el); }, appendChild(el) { this.append(el); } },
    body: { classList: { contains: c => classes.has(c), add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)) }, dataset: {} },
    documentElement: {},
};
const addCover = () => { cover = { id: 'preloader', parentNode: {} }; };
const removeCover = () => { cover = null; for (const o of [...observers]) if (o.on) o.cb([]); };

// boot-gate 는 모듈 하나를 같이 써요(gate-css · cardink · show-more-auto 가 부르는 것과 같은 것)
const gate = await import(url('src/boot-gate.js'));

await test('① 켠 설정 시트: 덮개 동안 붙으면 꺼진 채 — 다시 적용해도 안 켜지고, 다 받으면 클래스는 달리고, 걷히면 켜져요', async () => {
    addCover(); gate.coverOpaque(true);
    const gc = await import(url('src/gate-css.js'));
    const held = gc.syncGateCss(['salty', 'salty-md-hr-line']);
    const link = appended.find(el => el.id === 'salty-gate-md');
    assert.ok(link, '마크다운 모양 시트를 붙였어요');
    assert.equal(link.getAttribute('media'), 'not all', '덮개 동안은 꺼진 채');
    assert.ok(held.has('salty-md-hr-line'), '시트가 오기 전이라 클래스는 미뤄요(예전과 같음)');
    gc.syncGateCss(['salty', 'salty-md-hr-line']);   // 둘째 applyAll(채팅 모양 모듈이 온 뒤)
    assert.equal(link.getAttribute('media'), 'not all', '다시 적용해도 지금 켜지 않아요');
    assert.deepEqual(gc.gateState().sheets.find(s => s.id === 'md'), { id: 'md', ready: false, on: true, held: true });
    link.fire('load');
    assert.ok(classes.has('salty-md-hr-line'), '다 받으면 클래스는 그대로 달려요(꺼진 시트라 보이는 것은 없어요)');
    removeCover();
    assert.equal(link.getAttribute('media'), 'all', '걷히는 순간 켜져요');
    gc.syncGateCss(['salty']);
    assert.equal(link.getAttribute('media'), 'not all', '걷힌 뒤 끄기는 바로');
});

await test('① 덮개 동안 끄기로 바뀐 시트는 걷혀도 꺼진 채 · 덮개가 비치면 처음부터 켜진 채', async () => {
    addCover(); gate.coverOpaque(true);
    const gc = await import(url('src/gate-css.js') + '?b');
    gc.syncGateCss(['salty', 'salty-outline']);
    const link = appended.filter(el => el.id === 'salty-gate-outline').at(-1);
    assert.equal(link.getAttribute('media'), 'not all');
    gc.syncGateCss(['salty']);
    assert.equal(link.getAttribute('media'), 'not all');
    removeCover();
    assert.equal(link.getAttribute('media'), 'not all', '끈 시트는 켜지 않아요');
    addCover(); gate.coverOpaque(false);
    const gc2 = await import(url('src/gate-css.js') + '?c');
    gc2.syncGateCss(['salty', 'salty-indent']);
    const type = appended.filter(el => el.id === 'salty-gate-type').at(-1);
    assert.equal(type.getAttribute('media'), 'all', '비치는 덮개면 예전처럼 바로 켜요');
    removeCover();
});

await test('② 카드 글자색: 덮개 동안은 채팅을 읽지 않고 걷힌 뒤 한 번 읽어요', async () => {
    let reads = 0;
    els.chat = { nodeType: 1, matches: () => false, querySelectorAll: () => { reads++; return []; } };
    addCover(); gate.coverOpaque(true);
    const { _cardInk } = await import(url('src/cardink.js'));
    _cardInk.schedule(null);
    await wait(5);
    assert.equal(reads, 0, '덮개 동안은 안 읽어요');
    removeCover();
    await wait(5);
    assert.equal(reads, 1, '걷힌 뒤 채팅 전체를 한 번');
    _cardInk.schedule(null);
    await wait(5);
    assert.equal(reads, 2, '걷힌 뒤에는 예전처럼 바로');
});

await test('② 이전 메시지 저절로: 덮개 동안 단추가 보인다고 와도 누르지 않고, 걷힌 뒤 다시 걸어 그때 판단해요', async () => {
    const ios = [];
    globalThis.IntersectionObserver = class { constructor(cb, opts) { this.cb = cb; this.opts = opts; this.targets = new Set(); ios.push(this); } observe(el) { this.targets.add(el); } unobserve(el) { this.targets.delete(el); } disconnect() { this.targets.clear(); } };
    globalThis.requestAnimationFrame = () => 0;
    const listeners = {};
    globalThis.SillyTavern = { getContext: () => ({ eventSource: { on: (n, f) => { (listeners[n] ??= []).push(f); }, removeListener: () => {} }, event_types: { CHAT_CHANGED: 'cc' } }) };
    let clicks = 0;
    els.chat = {};
    els.show_more_messages = { id: 'show_more_messages', click() { clicks++; } };
    addCover(); gate.coverOpaque(true);
    const sm = await import(url('src/show-more-auto.js'));
    sm.syncShowMoreAuto(true);
    await wait(300);
    const io = ios.at(-1);
    assert.ok(io?.targets.has(els.show_more_messages), '단추를 지켜봐요');
    io.cb([{ target: els.show_more_messages, isIntersecting: true, intersectionRatio: 1 }]);
    assert.equal(clicks, 0, '덮개 동안은 안 눌러요');
    io.targets.clear();
    removeCover();
    assert.ok(io.targets.has(els.show_more_messages), '걷히면 다시 걸어요(관찰자가 그때 상태를 다시 알려요)');
    io.cb([{ target: els.show_more_messages, isIntersecting: true, intersectionRatio: 1 }]);
    assert.equal(clicks, 1, '걷힌 뒤에는 예전처럼');
    sm.syncShowMoreAuto(false);
});

await test('④ 미트볼 맞춤(1.2.3 ext-compat.js): 덮개 동안 붙는 맞춤 시트는 꺼 둔 채(여덟째) · 고른 탭 굴리기는 걷힌 뒤 한 번 — 걷히면 둘 다', async () => {
    addCover(); gate.coverOpaque(true);
    const ec = await import(url('src/ext-compat.js'));
    const before = gate.heldSheets();
    assert.equal(ec.attachSheet(globalThis.document, ec.SETS[0], 'http://x/scripts/extensions/third-party/t/src/ext-compat.js'), true);
    const link = appended.at(-1);
    assert.equal(link.id, 'bl-ext-css-ss-settings');
    assert.equal(link.getAttribute('media'), 'not all', '덮개 동안은 꺼진 채');
    assert.equal(gate.heldSheets(), before + 1, '모으기 표에 들어가요');
    // 고른 탭: 덮개 동안은 굴리지 않아요(scrollIntoView 는 스타일 · 배치를 그 자리에서 강제해요)
    let scrolls = 0;
    const tab = to => {
        const cls = new Set(); const attrs = {};
        return { dataset: { blTabTo: to }, ownerDocument: globalThis.document, isConnected: true, attrs,
            classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: c => cls.has(c) },
            setAttribute: (n, v) => { attrs[n] = v; }, scrollIntoView: () => { scrolls++; } };
    };
    const tabs = [tab('0'), tab('1'), tab('2')];
    const nav = { children: tabs, parentElement: { children: [] } };
    const box = { querySelector: () => nav, dataset: {} };
    ec.showGroup(box, 2);
    ec.showGroup(box, 1);
    assert.equal(scrolls, 0, '덮개 동안은 안 굴려요');
    assert.equal(tabs[1].attrs['aria-selected'], 'true', '고르기 · 보이기는 바로(속성만)');
    removeCover();
    assert.equal(link.getAttribute('media'), null, '걷히는 순간 켜져요(원래 media 없음)');
    assert.equal(scrolls, 1, '걷힌 뒤 지금 고른 탭 하나만 한 번');
    ec.showGroup(box, 2);
    assert.equal(scrolls, 2, '걷힌 뒤에는 예전처럼 바로');
    // 덮개가 없으면(이미 걷힘) 예전처럼 바로 켜진 채 붙어요
    els['bl-ext-css-ss-settings'] = null;
    const d2 = { getElementById: () => null, createElement: tag => new Sheet(tag), head: globalThis.document.head };
    assert.equal(ec.attachSheet(d2, ec.SETS[0], 'http://x/a/src/ext-compat.js'), true);
    assert.equal(appended.at(-1).getAttribute('media'), null, '덮개가 없으면 꺼 두지 않아요');
});

// ── ③ 계약(소스): 덮개 동안 붙는 시트마다 holdSheet
const holds = [
    ['src/gate-css.js', /holdSheet\(own\)/],
    ['src/tag-ink.js', /document\.head\.appendChild\(style\); holdSheet\(style\);/],
    ['src/squared-buttons.js', /\.append\(style\);\s*holdSheet\(style\);/],
    ['src/fruit-type-runtime.js', /\.append\(decor\);holdSheet\(decor\);/],
    ['src/chat-appearance.js', /document\.head\.appendChild\(sheet\);\s*holdSheet\(sheet\);/],
    ['src/decor.js', /style\.id = 'bl-decor-data'; document\.head\.append\(style\); holdSheet\(style\);/],
    ['src/dem-expressive.js', /document\.head\.append\(style\);\s*holdSheet\(style\);/],
    ['src/ext-compat.js', /\.append\(link\);\s*holdSheet\(link\);/],   // 1.2.3 미트볼 맞춤 시트 — 그 확장이 있을 때만 받는 모듈
];
await test('③ 덮개 동안 붙는 시트 여덟 자리가 모두 holdSheet 를 불러요(대사 아이콘은 「아무것도 미리 불러오지 않는」 단추 모듈이라 빼요 — 대사만 보기를 켠 사람만 · 한 줄)', () => {
    assert.equal(holds.length, 8);
    for (const [file, re] of holds) assert.match(src(file), re, file);
    const ec = src('src/ext-compat.js').replace(/^\s*\/\/.*$/gm, '');
    assert.equal((ec.match(/scrollIntoView/g) || []).length, 2, '고른 탭 굴리기는 revealTab(바로) · revealLater(걷힌 뒤) 두 곳뿐');
    assert.match(ec, /export function showGroup\(root, index\) \{[^]*?if \(on\) revealTab\(tab\);/, 'showGroup 은 revealTab 으로');
    assert.match(ec, /function revealTab\(tab\) \{\n\s*if \(booting\(tab\.ownerDocument\)\) \{ revealWaiting\.add\(tab\); afterBoot\(revealLater\); return; \}/);
});
await test('③ 변수 시트 · 글꼴 선언은 꺼 두지 않아요(새로고침 첫 화면이 팔레트 색을 쓰고, 꺼 둔 @font-face 는 글꼴을 안 받아요)', () => {
    const apply = src('src/apply.js');
    assert.doesNotMatch(apply, /holdSheet[(]/);
    assert.match(apply, /coverOpaque\(want\.has\('salty'\) && \(parseColor\(pal\.bg\)\?\.\[3\] \?\? 0\) >= 1\);\n\s*const held = syncGateCss\(want(?:, coolChatForRestyle)?\);/, '켠 설정 시트를 붙이기 전에 덮개가 불투명한지 알려요');
});
const deferred = [
    ['src/ink-contrast.js', /function run\(roots, \{ force = false \} = \{\}\) \{\n\s*if \(!active\) return;\n\s*if \(booting\(\)\) \{ afterBoot\(runAfterBoot\); return; \}/],
    ['src/cardink.js', /queued = false;\n\s*if \(booting\(\)\) \{ afterBoot\(scheduleAfterBoot\); return; \}/],
    ['src/center-ink.js', /function apply\(list\) \{\n\s*if \(booting\(\)\) \{ afterBoot\(all\); return; \}/],
    ['src/show-more-auto.js', /if \(booting\(\)\) \{ afterBoot\(watch\); return; \}/],
    ['src/reading-resume.js', /function enter\(\)\{\n\s*if\(booting\(\)\)\{afterBoot\(/],
    ['src/lite.js', /if \(booting\(\)\) afterBoot\(commit\); else commit\(\);/],
    ['index.js', /\['rebaseBodyHasRules', \(\) => import\('\.\/src\/st-has-anchor\.js'\), m => \{ afterBoot\(\(\) => m\.rebaseBodyHasRules\(\)\); \}\]/],
];
await test('③ 꺼 둔 시트의 값(바탕 · 글자색 · 여백 · 높이)을 덮개 동안 읽던 곳과 켜진 시트를 고치는 곳은 걷힌 뒤에', () => {
    for (const [file, re] of deferred) assert.match(src(file), re, file);
});
await test('③ 새 감시자 · 타이머 없음 — boot-gate.js 의 감시자는 덮개 하나 · 타이머 0 · 안전망은 APP_READY 한 번 듣기', () => {
    const s = src('src/boot-gate.js').replace(/^\s*\/\/.*$/gm, '');
    assert.equal((s.match(/new MutationObserver/g) || []).length, 1);
    assert.doesNotMatch(s, /setTimeout|setInterval|requestAnimationFrame|requestIdleCallback/);
    assert.match(s, /releaseSheets\(\);[^\n]*\n\s*const list = waiting/, '켜기가 대기자보다 먼저');
});

console.log(`\nboot-sheet-hold: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
