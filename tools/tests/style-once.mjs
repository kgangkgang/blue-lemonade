// 성능 보조 「메시지 속 같은 꾸밈 한 번만 넣기」 — src/addons/perf/styleonce.js (서식 훅 · 칸 · 차례 · 정리 · 캡처 되돌리기) · 연결 줄 ·
// regexlink 데우스 짝 이름(ALIASES). 지어낸 글만.
//   node tools/tests/style-once.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const themeRoot = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(themeRoot, rel), 'utf8');
const S = await import(pathToFileURL(path.join(themeRoot, 'src/addons/perf/styleonce.js')).href);
const R = await import(pathToFileURL(path.join(themeRoot, 'src/addons/regexlink/engine.js')).href);
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 6).join('\n       ')); }
}

// ── 작은 가짜 DOM (요소 · 글 노드 · 문서 차례) ─────────────────
class Text {
    constructor(data) { this.nodeType = 3; this.data = data; this.parentNode = null; }
    get length() { return this.data.length; }
    detach() { if (this.parentNode) { const c = this.parentNode.childNodes; c.splice(c.indexOf(this), 1); this.parentNode = null; } }
}
class El {
    constructor(tag, doc) { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.childNodes = []; this.parentNode = null; this.attrs = {}; this.hidden = false; this.id = ''; }
    get children() { return this.childNodes.filter(n => n.nodeType === 1); }
    get firstChild() { return this.childNodes[0] ?? null; }
    get nextSibling() { const p = this.parentNode; if (!p) return null; return p.childNodes[p.childNodes.indexOf(this) + 1] ?? null; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === this.ownerDocument.root; }
    get textContent() { return this.childNodes.map(n => n.nodeType === 3 ? n.data : n.textContent).join(''); }
    set textContent(v) { for (const n of this.childNodes) n.parentNode = null; this.childNodes = v === '' ? [] : [Object.assign(new Text(String(v)), { parentNode: this })]; }
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
    getAttribute(k) { return k === 'id' ? this.id || null : (k in this.attrs ? this.attrs[k] : null); }
    hasAttribute(k) { return this.getAttribute(k) !== null; }
    detach() { if (this.parentNode) { const c = this.parentNode.childNodes; c.splice(c.indexOf(this), 1); this.parentNode = null; } }
    remove() { this.detach(); this.ownerDocument.mutations++; }
    insertBefore(node, ref) { node.detach(); const i = ref ? this.childNodes.indexOf(ref) : -1; if (i < 0) this.childNodes.push(node); else this.childNodes.splice(i, 0, node); node.parentNode = this; this.ownerDocument.mutations++; return node; }
    append(...nodes) { for (const n of nodes) this.insertBefore(typeof n === 'string' ? new Text(n) : n, null); }
    after(node) { const p = this.parentNode; p.insertBefore(node, this.nextSibling); }
    *walk() { for (const c of this.childNodes) if (c.nodeType === 1) { yield c; yield* c.walk(); } }
    getElementsByTagName(tag) { const T = tag.toUpperCase(); return [...this.walk()].filter(e => e.tagName === T); }
    querySelectorAll(sel) { assert.equal(sel, 'style'); return this.getElementsByTagName('style'); }
}
function makeDoc() {
    const doc = { mutations: 0 };
    doc.createElement = tag => new El(tag, doc);
    doc.root = new El('html', doc);
    doc.body = doc.createElement('body');
    doc.root.append(doc.body);
    doc.getElementById = id => [...doc.root.walk()].find(e => e.id === id) ?? null;
    const sheld = doc.createElement('div'); sheld.setAttribute('id', 'sheld');
    const chat = doc.createElement('div'); chat.setAttribute('id', 'chat');
    const form = doc.createElement('div'); form.setAttribute('id', 'movingDivs');
    sheld.append(chat); doc.body.append(sheld, form);
    doc.chat = chat;
    return doc;
}
/** HTML 조각(우리가 만드는 꼴만: 글 + <style>…</style>) → 메시지 노드 */
function message(doc, html) {
    const mes = doc.createElement('div'); mes.attrs.class = 'mes';
    const text = doc.createElement('div'); text.attrs.class = 'mes_text';
    mes.append(text);
    paint(doc, text, html);
    return mes;
}
function paint(doc, text, html) {
    text.textContent = '';
    for (const part of html.split(/(<style>[\s\S]*?<\/style>)/)) {
        if (!part) continue;
        const hit = /^<style>([\s\S]*)<\/style>$/.exec(part);
        if (hit) { const st = doc.createElement('style'); st.textContent = hit[1]; text.append(st); }
        else text.append(part);
    }
}

// 실리태번 decodeStyleTags 흉내: 선택자 앞에 '.mes_text ' · 주석은 그대로 · 해석 실패는 'CSS ERROR' 글
let decodes = 0;
function stDecode(html) {
    return html.replace(/<style>([\s\S]+?)<\/style>/gi, (_, css) => {
        decodes++;
        if (css.includes('{{broken')) return 'CSS ERROR: 지어낸 오류';
        const out = css.replace(/\/\*[\s\S]*?\*\/|([^{}]+)\{([^}]*)\}/g, (m, sel, body) => sel === undefined ? m : `${sel.split(',').map(s => '.mes_text ' + s.trim()).join(', ')} {${body.trim()}}`);
        return `<style>${out}</style>`;
    });
}
const CSS_A = '.ink-a{color:#c33} .ink-a b{font-weight:700}';
const CSS_B = '.card-b{border:1px solid #888}';
const CSS_C = '.ink-a{color:#3a3}';   // A 와 같은 선택자 — 차례가 화면을 정한다
const st = css => `<style>${css}</style>`;

function setup(over = {}) {
    const doc = makeDoc();
    let t = 1000;
    const tasks = [];
    const once = S.createStyleOnce({ decode: stDecode, doc: () => doc, queue: fn => tasks.push(fn), now: () => t, ...over });
    const flush = () => { while (tasks.length) tasks.shift()(); };
    const ctx = id => ({ messageId: id, ch_name: '세라', isUser: false, isSystem: false, isReasoning: false });
    /** ST 처럼: 훅 → (decode) → DOM */
    const render = (id, html) => { const shown = stDecode(once.transform(html, ctx(id))); const m = message(doc, shown); doc.chat.append(m); return m; };
    const holder = () => doc.getElementById(S.HOLDER_ID);
    const keys = () => holder()?.children.map(e => e.getAttribute(S.KEY_ATTR)) ?? [];
    return { doc, once, flush, ctx, render, holder, keys, tick: ms => { t += ms; } };
}

await test('같은 style 100벌 → 실리태번 해석은 한 번, 메시지 안은 작은 표시 · #sheld 바로 뒤 칸에 한 벌', () => {
    const { doc, once, flush, render, holder } = setup();
    decodes = 0;
    for (let i = 0; i < 100; i++) render(i, `<p>장면 ${i}</p>${st(CSS_A)}<p>끝</p>`);
    flush();
    // 우리 decode 1번 + 실리태번 쪽 표시 해석 100번(아주 작은 주석)
    assert.equal(once.stats.made, 1);
    assert.equal(once.stats.hits, 99);
    const marks = doc.chat.getElementsByTagName('style');
    assert.equal(marks.length, 100);
    assert.ok(marks.every(m => S.markKeyOf(m) !== null && m.textContent.length < 40), 'every in-message style is a tiny marker');
    const h = holder();
    assert.equal(doc.getElementById('sheld').nextSibling, h, 'holder sits right after #sheld');
    assert.equal(h.hidden, true);
    assert.equal(h.children.length, 1);
    assert.equal(h.children[0].textContent, stDecode(st(CSS_A)).slice(7, -8), 'canonical copy = ST result for the same text');
});

await test('같음: 표시를 칸의 CSS 로 되돌리면 실리태번이 원래 그렸을 HTML 과 글자 하나까지 같다 (expand)', () => {
    const { once, ctx } = setup();
    const samples = [
        `<p>a</p>${st(CSS_A)}${st(CSS_B)}<p>b</p>`,
        `${st(CSS_B)}<div>${st(CSS_A)}</div>`,
        `<p>style 없음</p>`,
        `${st('/* 주석만 */ .x{}')}<p>x</p>${st(CSS_A)}`,
        `<STYLE>${CSS_C}</STYLE>`,
    ];
    for (const html of samples) {
        const want = stDecode(html);
        const doc2 = makeDoc();
        const host = doc2.createElement('div');
        paint(doc2, host, stDecode(once.transform(html, ctx(3))));
        once.expand(host);
        const got = host.childNodes.map(n => n.nodeType === 3 ? n.data : `<style>${n.textContent}</style>`).join('');
        assert.equal(got, want.replace(/<STYLE>/g, '<style>'), html);
    }
});

await test('건너뜀(원래대로): 해석 실패 · @layer · 「이름:」 이 든 글 · 채팅 밖 그리기(-1) · 생각 칸 · 속성 있는 style · 스위치 끔', () => {
    let on = true;
    const { once, ctx } = setup({ enabled: () => on });
    const keep = (html, c = ctx(1)) => assert.equal(once.transform(html, c), html, html);
    keep(st('.a{{broken}'));
    keep(st('@layer base { .a{color:red} }'));
    keep(st('.a::after{content:"세라: 안녕"}'));
    keep(st(CSS_A), ctx(-1));
    keep(st(CSS_A), { ...ctx(1), isReasoning: true });
    keep(`<style media="print">${CSS_A}</style>`);
    keep('<p>없음</p>');
    on = false; keep(st(CSS_A)); on = true;
    assert.notEqual(once.transform(st(CSS_A), ctx(1)), st(CSS_A));
    // 해석 실패는 한 번만 시도하고 기억한다
    decodes = 0; once.transform(st('.a{{broken}'), ctx(1)); once.transform(st('.a{{broken}'), ctx(2));
    assert.equal(decodes, 0);
});

await test('외부 주소 허용이 다르면 다른 열쇠 · 이미 표시된 글은 다시 바꾸지 않는다', () => {
    let media = true;
    const { once, ctx } = setup({ mediaAllowed: () => media });
    const a = once.transform(st(CSS_A), ctx(1));
    media = false;
    const b = once.transform(st(CSS_A), ctx(2));
    assert.notEqual(a, b);
    assert.equal(once.transform(a, ctx(1)), a);
    assert.equal(once.stats.made, 2);
});

await test('차례: 칸 안 순서 = 문서에서 마지막으로 나온 차례 (A, B, A → B, A) · 마지막 A 를 지우면 A, B', () => {
    const { doc, once, flush, render, keys } = setup();
    const m1 = render(0, st(CSS_A));
    render(1, st(CSS_B));
    const m3 = render(2, st(CSS_A));
    flush();
    const [kA, kB] = [S.markKeyOf(m1.getElementsByTagName('style')[0]), S.markKeyOf(doc.chat.children[1].getElementsByTagName('style')[0])];
    assert.deepEqual(keys(), [kB, kA]);
    m3.remove(); once.schedule(); flush();
    assert.deepEqual(keys(), [kA, kB]);
    // 흔한 경우(하나가 맨 뒤로)는 한 번만 옮긴다
    const before = once.stats.moved;
    render(3, st(CSS_A)); flush();
    assert.deepEqual(keys(), [kB, kA]);
    assert.equal(once.stats.moved - before, 1);
});

await test('같은 선택자가 겹치는 두 style 도 원래 캐스케이드 차례 그대로 (C 뒤에 A 가 나오면 A 가 이긴다)', () => {
    const { doc, flush, render, keys } = setup();
    render(0, st(CSS_A)); render(1, st(CSS_C)); flush();
    const order1 = keys().map(k => doc.getElementById(S.HOLDER_ID).children.find(e => e.getAttribute(S.KEY_ATTR) === k).textContent);
    assert.ok(order1[1].includes('#3a3'), 'C (later) wins');
    render(2, st(CSS_A)); flush();
    const order2 = keys().map(k => doc.getElementById(S.HOLDER_ID).children.find(e => e.getAttribute(S.KEY_ATTR) === k).textContent);
    assert.ok(order2[1].includes('#c33'), 'A (now last) wins');
});

await test('지우기 · 다시 그리기 · 채팅 바꾸기: 안 쓰는 열쇠는 빠지고(방금 만든 것은 잠깐 앞쪽에), 다시 쓰면 기억에서 돌아온다', () => {
    const { doc, once, flush, render, keys, tick } = setup();
    const a = render(0, st(CSS_A));
    const b = render(1, st(CSS_B));
    flush();
    assert.equal(keys().length, 2);
    // B 메시지를 지움 — 방금 만든 것이라 잠깐 남는다(앞쪽)
    b.remove(); once.schedule(); flush();
    assert.equal(keys().length, 2);
    assert.equal(keys()[1], S.markKeyOf(a.getElementsByTagName('style')[0]), 'used key stays last');
    tick(5000); once.schedule(); flush();
    assert.equal(keys().length, 1, 'idle key removed after grace');
    // 스와이프 · 편집: 같은 메시지를 다시 그림 (같은 꾸밈)
    paint(doc, a.children[0], stDecode(once.transform(`<p>다른 답</p>${st(CSS_A)}`, { messageId: 0 })));
    once.schedule(); flush();
    assert.equal(keys().length, 1);
    // 채팅 바꾸기: 모두 지움 → 칸 비움 → 새 채팅에 B → 해석 없이 기억에서
    a.remove(); tick(5000); once.schedule(); flush();
    assert.deepEqual(keys(), []);
    decodes = 0; render(0, st(CSS_B)); flush();
    assert.equal(decodes, 1, 'only ST decoding the tiny marker; no new decode of CSS_B');
    assert.equal(keys().length, 1);
});

await test('칸이 통째로 빠지면(다른 코드가 지움) 다음 그리기 · 정리 때 다시 붙고 쓰는 것을 다시 넣는다', () => {
    const { doc, once, flush, render, holder } = setup();
    render(0, st(CSS_A)); render(1, st(CSS_B)); flush();
    holder().remove();
    assert.equal(doc.getElementById(S.HOLDER_ID), null);
    once.schedule(); flush();
    assert.equal(holder()?.children.length, 2);
    assert.equal(doc.getElementById('sheld').nextSibling, holder());
});

await test('캡처: 내보내는 사본 안 표시를 원래 CSS 로 되돌린다 · 모르는 표시 · 다른 style 은 그대로', () => {
    const { doc, once, render } = setup();
    const m = render(0, `${st(CSS_A)}<p>x</p>`);
    const other = doc.createElement('style'); other.textContent = '.own{}'; m.append(other);
    const fake = doc.createElement('style'); fake.textContent = '/*bl-dd:zzzz*/'; m.append(fake);
    assert.equal(once.expand(m), 1);
    assert.equal(m.getElementsByTagName('style')[0].textContent, stDecode(st(CSS_A)).slice(7, -8));
    assert.equal(other.textContent, '.own{}');
    assert.equal(fake.textContent, '/*bl-dd:zzzz*/');
});

await test('훅 붙이기: 마크다운 뒤 · 다른 훅(LATEST)보다 뒤 · 훅이 없는 옛 실리태번은 false', () => {
    const added = [];
    const formatter = { stage: { AFTER_MARKDOWN: 'afterMarkdown' }, order: { LATEST: 100 }, addHook: (fn, o) => added.push([fn, o]) };
    const { once } = setup();
    assert.equal(S.installStyleOnce(once, formatter), true);
    assert.equal(added[0][1].stage, 'afterMarkdown');
    assert.ok(added[0][1].order > 100);
    assert.match(added[0][0](st(CSS_A), { messageId: 1 }), /bl-dd:/);
    assert.equal(S.installStyleOnce(once, {}), false);
    assert.equal(S.installStyleOnce(once, null), false);
});

await test('열쇠 해시: 같은 글 = 같은 값 · 한 글자만 달라도 다름', () => {
    assert.equal(S.hash53(CSS_A), S.hash53(CSS_A));
    assert.notEqual(S.hash53(CSS_A), S.hash53(CSS_A + ' '));
    assert.notEqual(S.hash53('ab'), S.hash53('ba'));
});

await test('연결 줄: 성능 보조 5 (기본 켬 · 서랍 이름 · 실리태번 같은 길로 해석 · 정리 이벤트) · 캡처 두 곳', () => {
    const js = read('src/addons/perf/perfassist.js');
    assert.match(js, /import \* as chats from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/chats\.js';/);
    assert.match(js, /const DEFAULTS = Object\.freeze\(\{[^}]*styleOnce: true[^}]*\}\);/);
    assert.match(js, /\['styleOnce', '메시지 속 같은 꾸밈 한 번만 넣기'\]/);
    assert.match(js, /chats\.decodeStyleTags\(chats\.encodeStyleTags\(html\), \{ prefix: '\.mes_text ' \}\)/);
    assert.match(js, /\['styleOnce', installStyleOnceHook\]/);
    for (const ev of ['MESSAGE_DELETED', 'CHAT_CHANGED', 'MORE_MESSAGES_LOADED', 'MESSAGE_SWIPED']) assert.ok(js.includes(`'${ev}'`), ev);
    assert.match(read('src/chat-capture.js'), /PerfAssist\?\.styleOnce\?\.expand\?\.\(exportRoot\);\n\s*const html=new XMLSerializer\(\)\.serializeToString\(exportRoot\);/);
    assert.match(read('src/capture-animate.js'), /const piece = block\.cloneNode\(true\);\n\s*window\.PerfAssist\?\.styleOnce\?\.expand\?\.\(piece\);/);
});

await test('regexlink: 데우스 @Companions · @Relationships 가 택1 갈래 이름으로 짝을 찾는다 (묶음 머리 marker · 비슷한 낱말은 아님)', () => {
    const prompts = [
        { identifier: 'h1', name: '⟡ Chat History ⟡', marker: true },
        { identifier: 'p1', name: '🔻PICK: COMPANIONS🔻', marker: true },
        { identifier: 'n1', name: '「 Notes 」' }, { identifier: 'c1', name: '「 Chat 」' }, { identifier: 'b1', name: '| Mira, The Best Friend |' },
        { identifier: 'r0', name: '🔻PICK: RELATIONSHIPS🔻', marker: true },
        { identifier: 'r1', name: '「 Friendship 」' }, { identifier: 'r2', name: '「 Realistic Romance 」' }, { identifier: 'r3', name: '「 Bubbly Romance 」' }, { identifier: 'r4', name: '「 Dark Romance 」' },
        { identifier: 'i1', name: '「 Intimate 」' }, { identifier: 'x1', name: '「 Chatter Box 」' },
    ];
    const owners = R.ownersFor(['companions', 'relationships'], prompts);
    assert.deepEqual(owners.get('companions').sort(), ['b1', 'c1', 'n1']);
    assert.deepEqual(owners.get('relationships').sort(), ['r1', 'r2', 'r3', 'r4']);
    const scripts = [{ id: 's1', scriptName: 'DEM - @Companions UI', findRegex: '/<companions\\b[^>]*>/g', replaceString: '' }, { id: 's2', scriptName: 'DEM - @Relationships UI', findRegex: '/<relationships\\b[^>]*>/g', replaceString: '' }];
    const rows = R.plan({ scripts, prompts, enabled: new Set(['r2']) });
    assert.deepEqual(rows.map(r => r.want), [false, true]);
    // 최근 메시지에 그 태그가 있으면 짝이 꺼져도 켜 둔다(옛 메시지 꾸밈)
    assert.deepEqual(R.plan({ scripts, prompts, enabled: new Set(), recentHas: keys => keys.includes('companions') }).map(r => r.want), [true, false]);
});

console.log(`style-once: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
