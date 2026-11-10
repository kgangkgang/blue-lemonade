// 긴 채팅 가볍게 (src/chat-light.js · css/05-chat.css) — 메시지 60개 이상이면 #chat.bl-chat-light, 화면 밖 메시지에 content-visibility:auto
//   node tools/tests/chat-light.mjs <테마 루트>
// 작은 DOM 흉내: #chat 에만 childList 감시자 · 60개 이상이면 클래스 · 아래로 내려가면 뗀다 · 같은 상태면 classList 를 건드리지 않는다 · 끄면 감시자 · 클래스를 뗀다.
// CSS: .bl-chat-light 의 메시지에 content-visibility:auto + contain-intrinsic-size · 마지막 · 메뉴 열린 · 고른 메시지는 제외 · :has 를 쓰지 않는다(메시지마다 :has 주어가 되지 않게) · style.css 에 들어 있다.
// 연결: features.js(설정 chat.chatLight · 기본 켬) · settings.js 기본값 · 보정 · 동작 값 목록(styles.js 도) · 설정 줄 · 라벨 · 검색.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const observers = [];
class FakeMO { constructor(cb) { this.cb = cb; this.target = null; this.live = true; observers.push(this); } observe(el, opts) { this.target = el; this.opts = opts; } disconnect() { this.live = false; } }
globalThis.MutationObserver = FakeMO;
let classWrites = 0;
let tailWrites = 0;
// (1.1.1) 바닥 표식(data-bl-tail)을 보려고 메시지 흉내도 둬요 — 세기 · 표식은 형제 차례로만(querySelectorAll 로 채팅 전체를 훑지 않아요)
function kids(el) {
    if (el._n !== el.count) { const old = el._k || []; el._n = el.count; el._k = Array.from({ length: el.count }, (_, i) => old[i] || mesNode(el, i)); }
    return el._k;
}
function mesNode(el, i) {
    const attrs = new Map();
    return { i, attrs, classList: { contains: c => c === 'mes' }, hasAttribute: a => attrs.has(a), setAttribute: (a, v) => { tailWrites++; attrs.set(a, v); }, removeAttribute: a => { tailWrites++; attrs.delete(a); },
        get nextElementSibling() { return kids(el)[i + 1] ?? null; }, get previousElementSibling() { return kids(el)[i - 1] ?? null; } };
}
function makeChat(n) {
    const el = { id: 'chat', count: n, classes: new Set(), classList: { contains: c => el.classes.has(c), toggle(c, force) { classWrites++; if (force) el.classes.add(c); else el.classes.delete(c); }, remove(c) { classWrites++; el.classes.delete(c); } },
        querySelectorAll: sel => { throw new Error('채팅 전체 훑기: ' + sel); },
        get firstElementChild() { return kids(el)[0] ?? null; }, get lastElementChild() { return kids(el).at(-1) ?? null; } };
    return el;
}
const tailOf = el => kids(el).filter(m => m.attrs.has('data-bl-tail')).map(m => m.i);
let chat = makeChat(10);
// (8.2.7) 표식은 html 에 — 흉내에서는 html 의 classList 를 지금 채팅 칸의 것과 같게 둬서 아래 확인(chat.classes)을 그대로 써요
globalThis.document = { getElementById: id => (id === 'chat' ? chat : null), documentElement: { get classList() { return chat.classList; } } };
const M = await import(pathToFileURL(path.join(root, 'src/chat-light.js')).href);

let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.message}`); } };
const fire = () => { for (const o of observers) if (o.live && o.target === chat) o.cb([]); };

test('켜면 #chat 에만 childList 감시자(subtree 없음) · 60개 미만이면 클래스 없음', () => {
    M.syncChatLight(true);
    const live = observers.filter(o => o.live);
    assert.equal(live.length, 1); assert.equal(live[0].target, chat); assert.deepEqual(live[0].opts, { childList: true });
    assert.equal(chat.classes.has('bl-chat-light'), false);
    assert.equal(M.THRESHOLD, 60);
});
test('메시지가 60개 이상 되면(감시자 콜백) 클래스를 붙이고, 59개로 내려가면 뗀다', () => {
    chat.count = 60; fire(); assert.equal(chat.classes.has('bl-chat-light'), true);
    chat.count = 50; fire(); assert.equal(chat.classes.has('bl-chat-light'), false, '50개 표시는 미리 그리기 비용을 더하지 않아요');
    chat.count = 300; fire(); assert.equal(chat.classes.has('bl-chat-light'), true);
    chat.count = 59; fire(); assert.equal(chat.classes.has('bl-chat-light'), false);
});
test('같은 상태면 classList 를 건드리지 않는다 (속성 변경 기록을 만들지 않게)', () => {
    chat.count = 50; fire(); assert.equal(chat.classes.has('bl-chat-light'), false, '50개 표시는 미리 그리기 비용을 더하지 않아요');
    chat.count = 300; fire(); classWrites = 0; fire(); fire(); fire(); assert.equal(classWrites, 0);
    chat.count = 5; fire(); assert.equal(classWrites, 1); fire(); assert.equal(classWrites, 1);
});
test('채팅 칸이 바뀌면(다시 그림) 새 칸을 감시한다 · 끄면 감시자와 클래스를 뗀다', () => {
    chat = makeChat(100); M.syncChatLight(true);
    assert.equal(observers.filter(o => o.live).length, 1); assert.equal(observers.filter(o => o.live)[0].target, chat); assert.equal(chat.classes.has('bl-chat-light'), true);
    M.syncChatLight(false);
    assert.equal(observers.filter(o => o.live).length, 0); assert.equal(chat.classes.has('bl-chat-light'), false); assert.equal(M._test.state().watching, false);
    chat.count = 50; fire(); assert.equal(chat.classes.has('bl-chat-light'), false, '50개여도 설정을 끄면 적용하지 않아요');
    chat.count = 300; fire(); assert.equal(chat.classes.has('bl-chat-light'), false, '끈 뒤에는 세지 않는다');
});
test('CSS: html.bl-chat-light(:where) 아래 #chat 의 메시지에 content-visibility:auto · contain-intrinsic-size auto · 마지막 · 바닥 10개 · 메뉴 · 고른 메시지 제외 · :has 없음 · [style 없음 · style.css 에 들어 있다', () => {
    const src = read('css/05-chat.css');
    const m = src.match(/^:where\(html\.bl-chat-light\) body\.salty \[id="chat"\]:not\(#salty-none\) > \.mes([^{]*)\{([^}]*)\}/m);
    assert.ok(m, '규칙이 없다');
    assert.match(m[1], /:not\(\.last_mes, \.bl-menu-open, \.selected\)/);
    assert.match(m[1], /:not\(\[data-bl-tail\]\)/, '바닥 10개는 실제 높이로 — 바닥 붙이기 정확(src/chat-light.js 가 다는 표식)');
    assert.ok(!m[1].includes(':nth-'), '뒤에서 세는 자리 규칙(:nth-last-child)은 메시지가 하나 붙을 때마다 형제 메시지 전부를 다시 계산해요');
    assert.ok(!m[1].includes(':has('), '메시지마다 :has 주어가 되지 않게');
    assert.ok(!/\[\s*style/.test(m[1]));
    assert.match(m[2], /content-visibility:\s*auto/); assert.match(m[2], /contain-intrinsic-size:\s*auto \d+px/);
    assert.match(m[2], /flex-shrink:\s*0/, '#chat 세로 flex 에서 건너뛴 메시지가 납작해지지 않게');
    assert.ok(read('style.css').includes(':where(html.bl-chat-light) body.salty [id="chat"]:not(#salty-none) > .mes:not(.last_mes, .bl-menu-open, .selected):not([data-bl-tail])'), 'style.css 에 빌드돼 있다 (진짜 채팅 칸만 — 빌드의 #chat 넓히기에 안 걸리는 꼴)');
    assert.doesNotMatch(read('css/23-preview.gen.css'), /bl-chat-light/, '미리보기 사본에는 안 넣어요(html 표식이 미리보기 상자에 걸리지 않게)');
    assert.match(src, /\.mes\.bl-menu-open \{[^}]*content-visibility: visible !important/s, '메뉴 열린 메시지는 visible !important 로 이미 뺀다');
});
test('(1.1.1) 바닥 표식: 가볍게일 때만 #chat 의 마지막 요소 10개 중 .mes 에 data-bl-tail · 하나 붙으면 바뀐 둘만 쓴다 · 줄거나 끄면 뗀다 · 채팅 전체를 훑지 않는다', () => {
    chat = makeChat(30); M.syncChatLight(true);
    assert.deepEqual(tailOf(chat), [], '60개 미만이면 표식 없음');
    chat.count = 300; fire();
    assert.deepEqual(tailOf(chat), [290, 291, 292, 293, 294, 295, 296, 297, 298, 299]);
    tailWrites = 0; chat.count = 301; fire();
    assert.deepEqual(tailOf(chat), [291, 292, 293, 294, 295, 296, 297, 298, 299, 300]);
    assert.equal(tailWrites, 2, '새 메시지에 달고 11번째에서 뗀다');
    tailWrites = 0; fire(); fire(); assert.equal(tailWrites, 0, '같으면 쓰지 않는다');
    chat.count = 40; fire(); assert.deepEqual(tailOf(chat), [], '가볍게가 풀리면 뗀다');
    chat.count = 300; fire(); assert.equal(tailOf(chat).length, 10);
    M.syncChatLight(false); assert.deepEqual(tailOf(chat), [], '끄면 뗀다');
});
test('(1.1.1) 테마 CSS 어디에도 채팅 메시지 줄(.mes)에 :nth-* 자리 규칙이 없다 — #chat 이 자리 규칙을 가지면 답 하나마다 형제 전부가 다시 계산돼요', () => {
    const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.css') ? [path.join(d, e.name)] : []);
    // .mes 가 든 복합 선택자(괄호 밖 띄어쓰기 · > + ~ , 까지)에 :nth- 가 있으면 걸려요
    const compoundAt = (s, i) => { let d = 0, j = i; for (; j < s.length; j++) { const c = s[j]; if (c === '(') d++; else if (c === ')') { if (!d) break; d--; } else if (!d && /[\s>+~,]/.test(c)) break; } let k = i; for (d = 0; k > 0; k--) { const c = s[k - 1]; if (c === ')') d++; else if (c === '(') { if (!d) break; d--; } else if (!d && /[\s>+~,]/.test(c)) break; } return s.slice(k, j); };
    const bad = [];
    for (const f of ['style.css', ...walk('css'), ...walk('src')]) {
        const text = read(f).replace(/\/\*[\s\S]*?\*\//g, '');
        for (const sel of text.match(/[^{}]+(?=\{)/g) || []) for (const m of sel.matchAll(/\.mes(?![\w-])/g)) {
            const part = compoundAt(sel, m.index);
            if (part.includes(':nth-')) bad.push(`${f}: ${part.slice(0, 160)}`);
        }
    }
    assert.deepEqual(bad, []);
    assert.ok(compoundAt('a > .mes:not(.x, .y):not(:nth-last-child(-n+10)) b', 4).includes(':nth-'), '검사가 예전 꼴을 잡는다');
});
test('연결: features.js · settings.js(기본값 · 보정 · 동작 값) · styles.js · 설정 줄 · 라벨 · 검색 · CI', () => {
    assert.match(read('src/features.js'), /const chatLight = on && s\.chat\?\.chatLight !== false;\n\s+if \(chatLight \|\| modules\.chatlight\) load\('chatlight', '\.\/chat-light\.js'\)\.then\(m => \{ ready\.chatlight = m; m\?\.syncChatLight\(chatLight\); \}\);/);   // (1.1.1 restyle) 받은 모듈은 ready 에 — apply.js 가 설정 적용 직전 coolForRestyle 을 바로 부르게
    const settings = read('src/settings.js');
    assert.match(settings, /chat: \{ user: 'bubble',[^\n]*chatLight: true,/);
    assert.match(settings, /s\.chat\.chatLight = flag\(s\.chat\.chatLight, true\);/);
    assert.match(settings, /'mesPins'[^\]]*'chatLight'[^\]]*\]\) \{/);   // 8.2.4 키(lazyAvatars …)와 합치면 사이에 다른 키가 낀다 — 목록 안에만 있으면 된다
    assert.match(read('src/styles.js'), /'mesPins'[^\]]*'chatLight'[^\]]*\];/);
    assert.match(read('src/panel.js'), /row\('긴 채팅의 화면 밖 메시지 가볍게', toggle\('chat\.chatLight', s\.chat\.chatLight !== false\)/);
    assert.match(read('src/settings-labels.js'), /"chat\.chatLight":"긴 채팅의 화면 밖 메시지 가볍게"/);
    assert.match(read('src/settings-search.js'), /'chat\.chatLight'\]/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/chat-light\.mjs \./);
});
console.log(`chat-light: ${n}/${n + failed} 통과`);
if (failed) process.exit(1);
