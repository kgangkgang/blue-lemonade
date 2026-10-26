// 7.0.3 긴 채팅 성능 회귀 시험 (지어낸 DOM · 글만 쓴다)
//   node tools/tests/long-chat-perf.mjs <테마 루트>
// ① CSS: :has() 인자 안에 class 속성 선택자([class] · [class*=] …)를 두지 않는다 — 크롬은 그런 규칙이 하나만 있어도 문서 어디서든 class 가 바뀔 때마다
//    문서 전체 스타일을 다시 계산한다(답 20개 · 요소 2.5만 개 채팅에서 폰 4배 느린 CPU 기준 한 번 1.3초). inline style 속성([style*=])도 같은 꼴이라 새로 늘리지 않는다.
// ② 과일 감시 셋(상태창 글자 · 바로가기 단추 · 상태창 한국어)의 1.5초 타이머는 채팅이 그대로면 다시 훑지 않는다 — 긴 채팅에서 가만히 있어도 1.5초마다
//    채팅 전체(+ iframe)를 훑었다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── ① CSS ──
const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const cssFiles = ['style.css', ...walk(path.join(root, 'css')).map(f => path.relative(root, f)), ...walk(path.join(root, 'src')).filter(f => f.endsWith('.css')).map(f => path.relative(root, f))]
    .filter(f => f.endsWith('.css') && fs.existsSync(path.join(root, f)));
/** 파일 속 모든 :has( … ) 인자 (괄호 짝 맞춤) */
function hasArgs(text) {
    const out = [];
    const src = text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    for (let i = src.indexOf(':has('); i >= 0; i = src.indexOf(':has(', i + 5)) {
        let depth = 0, j = i + 4;
        for (; j < src.length; j++) { if (src[j] === '(') depth++; else if (src[j] === ')' && --depth === 0) break; }
        out.push({ arg: src.slice(i, j + 1), line: src.slice(0, i).split('\n').length });
    }
    return out;
}
// 지금 있는 [style*=] :has 는 설정 창(검색 결과 칸) 것뿐 — 채팅 그리기와 상관없다. 새로 늘리면 실패
const STYLE_OK = /^:has\(\s*>?\s*#result_info(:not\()?\[style\*="(display: )?none"\]\)?\)$/;

await test(':has() 인자 안에 class 속성 선택자 없음 (테마 CSS 전부)', () => {
    const bad = [];
    for (const f of cssFiles) for (const { arg, line } of hasArgs(fs.readFileSync(path.join(root, f), 'utf8'))) if (/\[\s*class\b/i.test(arg)) bad.push(`${f}:${line} ${arg.slice(0, 120)}`);
    assert.deepEqual(bad, [], bad.join('\n'));
});
await test(':has() 인자 안의 inline style 속성 선택자는 설정 창 것만', () => {
    const bad = [];
    for (const f of cssFiles) for (const { arg, line } of hasArgs(fs.readFileSync(path.join(root, f), 'utf8'))) if (/\[\s*style\b/i.test(arg) && !STYLE_OK.test(arg.replace(/\s+/g, ' ').trim())) bad.push(`${f}:${line} ${arg.slice(0, 120)}`);
    assert.deepEqual(bad, [], bad.join('\n'));
});
await test('말풍선 통째: 숨긴 글 틀 판정은 그대로 · :has 안에서 [class] 만 빠짐', () => {
    const css = fs.readFileSync(path.join(root, 'css/06-chat-text.css'), 'utf8');
    assert.match(css, /salty-bubble-whole[^{]*\.mes_text:not\(:empty, \[data-bl-editing~="text"\] > \.mes_block > \.mes_text, \.mes\[is_system="true"\] > \.mes_block > \.mes_text:has\(> details:not\(\[open\]\) > summary:empty\)\) \{/);
    assert.doesNotMatch(css, /details:not\(\[class\], \[open\]\) > summary:empty\)\)/);
    assert.ok(fs.readFileSync(path.join(root, 'style.css'), 'utf8').includes('.mes_block > .mes_text:has(> details:not([open]) > summary:empty))'), 'style.css 다시 빌드');
});

// ── ② 과일 감시 셋 — 가짜 DOM · 가짜 타이머 ──
class El {
    constructor(doc, tag, attrs = {}) { this.ownerDocument = doc; this.tagName = tag.toUpperCase(); this.nodeType = 1; this.attrs = { ...attrs }; this.children = []; this.dataset = {}; this.listeners = new Map(); this.parentElement = null; }
    append(...nodes) { for (const n of nodes) { n.parentElement = this; this.children.push(n); } return nodes[0]; }
    after(n) { const p = this.parentElement; if (!p) return; n.parentElement = p; p.children.splice(p.children.indexOf(this) + 1, 0, n); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(n => n !== this); this.parentElement = null; }
    get isConnected() { return this === this.ownerDocument.body || this === this.ownerDocument.head || !!this.parentElement?.isConnected; }
    matches(sel) { return sel.split(',').some(s => { s = s.trim(); if (s === '*') return true; if (s.startsWith('#')) { const [id, ...cls] = s.slice(1).split('.'); return this.attrs.id === id && cls.every(c => (this.attrs.class || '').split(' ').includes(c)); } if (s.startsWith('.')) return s.slice(1).split('.').every(c => (this.attrs.class || '').split(' ').includes(c)); return this.tagName === s.toUpperCase(); }); }
    closest(sel) { for (let n = this; n; n = n.parentElement) if (n.matches?.(sel)) return n; return null; }
    querySelectorAll(sel) { const out = []; const visit = n => { for (const c of n.children) { if (c.nodeType !== 1) continue; let ok = false; try { ok = c.matches(sel); } catch { ok = false; } if (ok) out.push(c); visit(c); } }; visit(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    getAttribute(k) { return this.attrs[k] ?? null; } setAttribute(k, v) { this.attrs[k] = String(v); } hasAttribute(k) { return k in this.attrs; }
    addEventListener(k, fn) { this.listeners.set(k, fn); } removeEventListener(k, fn) { if (this.listeners.get(k) === fn) this.listeners.delete(k); }
}
function fakeDoc() {
    const doc = { createElement: tag => new El(doc, tag), addEventListener() {}, removeEventListener() {}, querySelector(s) { return this.body.querySelector(s) || (this.head.matches(s) ? this.head : null); }, querySelectorAll(s) { return this.body.querySelectorAll(s); } };
    doc.body = new El(doc, 'body'); doc.head = new El(doc, 'head'); doc.documentElement = doc.body;
    return doc;
}
function fakeHost() {
    const frames = new Map(), timers = new Map(), observers = []; let next = 1;
    const host = {
        requestAnimationFrame(fn) { const id = next++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id),
        setInterval(fn) { const id = next++; timers.set(id, fn); return id; }, clearInterval: id => timers.delete(id),
        MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe(node) { this.node = node; } disconnect() { this.node = null; } takeRecords() { return []; } },
    };
    const tick = () => { for (const fn of [...timers.values()]) fn(); };
    const settle = () => { for (let i = 0; frames.size && i < 8; i++) { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); } };
    return { host, frames, timers, observers, tick, settle };
}
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
// 채팅: 메시지 몇 개와 iframe 하나 (지어낸 상태창 카드)
function chatFixture(doc) {
    const chat = doc.body.append(new El(doc, 'div', { id: 'chat' }));
    for (let i = 0; i < 3; i++) chat.append(new El(doc, 'div', { class: 'mes' })).append(new El(doc, 'div', { class: 'mes_text' }));
    const frame = chat.append(new El(doc, 'iframe', {}));
    const inner = fakeDoc(); frame.contentDocument = inner;
    inner.body.append(new El(inner, 'div', { class: 'fate-status-wrapper' }));
    return { chat, frame, inner };
}

await test('상태창 글자(fruit-type-runtime): 1.5초 타이머 — 그대로면 안 훑고, 채팅 뿌리가 바뀌면 훑는다', async () => {
    const { watchFruitTypography } = await imp('src/fruit-type-runtime.js');
    const doc = fakeDoc(), H = fakeHost(); const { chat } = chatFixture(doc);
    const stop = watchFruitTypography(doc, H.host, () => ({ on: true }), () => '');
    H.settle(); assert.equal(H.frames.size, 0);
    for (let i = 0; i < 3; i++) { H.tick(); assert.equal(H.frames.size, 0, '그대로인 채팅을 다시 훑음'); }
    chat.remove(); chatFixture(doc);   // 실리태번이 채팅 칸을 갈아 끼운 것처럼
    H.tick(); assert.equal(H.frames.size, 1, '새 채팅 뿌리를 못 찾음'); H.settle();
    H.tick(); assert.equal(H.frames.size, 0);
    stop(); assert.equal(H.timers.size, 0);
});
await test('7.0.4 과일 상태창 iframe: 글꼴 설정이 꺼져 있어도 낱말 꺾임 막기 한 장 — 루트 있는 iframe 에만 · 끄면 걷음 · 프리셋 class/id 규칙보다 무겁게', async () => {
    const { watchFruitTypography, syncFruitTypography, wrapCss } = await imp('src/fruit-type-runtime.js');
    assert.equal(typeof syncFruitTypography, 'function');
    const css = wrapCss();
    assert.match(css, /word-break:keep-all;overflow-wrap:anywhere/);
    assert.match(css, /:not\(#bl-fruit-wrap\)/, '프리셋의 .fate-grid-value 같은 class 하나 규칙을 이기도록 id 무게');
    assert.doesNotMatch(css, /!important/);
    const doc = fakeDoc(), H = fakeHost(); const { chat, inner } = chatFixture(doc);
    const plain = chat.append(new El(doc, 'iframe', {})); const plainDoc = fakeDoc(); plain.contentDocument = plainDoc; plainDoc.body.append(new El(plainDoc, 'p'));
    const stop = watchFruitTypography(doc, H.host, () => ({ on: false }), () => '');
    H.settle();
    const wrapsIn = d => d.head.children.filter(n => n.dataset?.blFruitWrap === '').length;
    assert.equal(wrapsIn(inner), 1, '과일 루트가 있는 iframe 에 한 장');
    assert.equal(wrapsIn(plainDoc), 0, '루트 없는 iframe 은 그대로');
    assert.equal(wrapsIn(doc), 0, '본문 문서에는 안 넣음 (채팅 본문은 이미 낱말 단위)');
    H.tick(); H.settle(); assert.equal(wrapsIn(inner), 1, '다시 훑어도 한 장');
    stop(); assert.equal(wrapsIn(inner), 0, '끄면 걷음');
    assert.match(fs.readFileSync(path.join(root, 'src/features.js'), 'utf8'), /\(on&&s\.usageMode!=='extensions'\)\|\|modules\.fruittype\)load\('fruittype'/, '글꼴 설정과 상관없이 테마가 켜져 있으면 실음');
});
await test('바로가기 단추(fruit-type-shortcuts): 1.5초 타이머 — 그대로면 안 훑고, iframe 안 내용이 바뀌거나 과일 창이 열려 있으면 훑는다', async () => {
    const { installFruitTypeShortcuts } = await imp('src/fruit-type-shortcuts.js');
    const doc = fakeDoc(), H = fakeHost(); const { inner } = chatFixture(doc);
    const release = installFruitTypeShortcuts(doc, H.host);
    H.settle();
    for (let i = 0; i < 3; i++) { H.tick(); assert.equal(H.frames.size, 0, '그대로인 채팅을 다시 훑음'); }
    inner.body.append(new El(inner, 'div', { class: 'dem-status' }));   // iframe 안에 카드가 늦게 그려짐 (body 감시자는 못 봄)
    H.tick(); assert.equal(H.frames.size, 1, 'iframe 안 새 카드를 못 봄'); H.settle();
    const panel = doc.body.append(new El(doc, 'div', { id: 'fruit-heart-v6' }));   // 7.7.4 닫힌 과일 창 뿌리는 문서에 남는다
    H.tick(); assert.equal(H.frames.size, 0, '닫힌 과일 창 뿌리만으로 다시 훑음');
    panel.attrs.class = 'open';
    H.tick(); assert.equal(H.frames.size, 1, '과일 창이 열려 있으면 예전처럼 훑음'); H.settle();
    release(); assert.equal(H.timers.size, 0);
});
await test('상태창 한국어(fruit-status): 1.5초 타이머 — 그대로면 안 훑는다', async () => {
    const { installFruitStatusKorean } = await imp('src/scripts/fruit-status.js');
    const doc = fakeDoc(), H = fakeHost(); chatFixture(doc);
    doc.createTreeWalker = () => ({ nextNode: () => false });
    const stop = installFruitStatusKorean(doc, H.host);
    H.settle();
    for (let i = 0; i < 3; i++) { H.tick(); assert.equal(H.frames.size, 0, '그대로인 채팅을 다시 훑음'); }
    stop(); assert.equal(H.timers.size, 0);
});
await test('상태창 글자: 일반 문장 교체는 다시 훑지 않고 새 iframe은 바로 찾아요', async () => {
    const { watchFruitTypography } = await imp('src/fruit-type-runtime.js');
    const doc=fakeDoc(),H=fakeHost(),{chat}=chatFixture(doc);
    const stop=watchFruitTypography(doc,H.host,()=>({on:true}),()=> '');H.settle();
    const observer=H.observers.find(o=>o.node===chat),text=new El(doc,'span');
    for(let i=0;i<100;i++)observer.fn([{target:chat.children[0],addedNodes:[text],removedNodes:[]}]);
    assert.equal(H.frames.size,0,'상태창과 관계없는 문장 교체를 다시 훑었어요');
    observer.fn([{target:chat,addedNodes:[new El(doc,'iframe')],removedNodes:[]}]);
    assert.equal(H.frames.size,1,'새 iframe을 놓쳤어요');stop();
});
await test('상태창 바로가기: 알림 100회에는 재탐색하지 않고 새 카드와 창에는 반응해요', async () => {
    const { installFruitTypeShortcuts } = await imp('src/fruit-type-shortcuts.js');
    const doc=fakeDoc(),H=fakeHost();chatFixture(doc);
    const stop=installFruitTypeShortcuts(doc,H.host);H.settle();
    const observer=H.observers.find(o=>o.node===doc.body),toast=new El(doc,'div',{class:'toast'});
    for(let i=0;i<100;i++)observer.fn([{target:doc.body,addedNodes:[toast],removedNodes:[]}]);
    assert.equal(H.frames.size,0,'알림 변경을 상태창 탐색으로 처리했어요');
    observer.fn([{target:doc.body,addedNodes:[new El(doc,'section',{class:'dem-status'})],removedNodes:[]}]);
    assert.equal(H.frames.size,1,'새 상태창을 놓쳤어요');stop();
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/long-chat-perf\.mjs \./);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
