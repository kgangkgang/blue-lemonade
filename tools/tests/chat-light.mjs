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
function makeChat(n) {
    const el = { id: 'chat', count: n, classes: new Set(), classList: { contains: c => el.classes.has(c), toggle(c, force) { classWrites++; if (force) el.classes.add(c); else el.classes.delete(c); }, remove(c) { classWrites++; el.classes.delete(c); } }, querySelectorAll: sel => { assert.equal(sel, ':scope > .mes'); return { length: el.count }; } };
    return el;
}
let chat = makeChat(10);
globalThis.document = { getElementById: id => (id === 'chat' ? chat : null) };
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
    chat.count = 300; fire(); assert.equal(chat.classes.has('bl-chat-light'), true);
    chat.count = 59; fire(); assert.equal(chat.classes.has('bl-chat-light'), false);
});
test('같은 상태면 classList 를 건드리지 않는다 (속성 변경 기록을 만들지 않게)', () => {
    chat.count = 300; fire(); classWrites = 0; fire(); fire(); fire(); assert.equal(classWrites, 0);
    chat.count = 5; fire(); assert.equal(classWrites, 1); fire(); assert.equal(classWrites, 1);
});
test('채팅 칸이 바뀌면(다시 그림) 새 칸을 감시한다 · 끄면 감시자와 클래스를 뗀다', () => {
    chat = makeChat(100); M.syncChatLight(true);
    assert.equal(observers.filter(o => o.live).length, 1); assert.equal(observers.filter(o => o.live)[0].target, chat); assert.equal(chat.classes.has('bl-chat-light'), true);
    M.syncChatLight(false);
    assert.equal(observers.filter(o => o.live).length, 0); assert.equal(chat.classes.has('bl-chat-light'), false); assert.equal(M._test.state().watching, false);
    chat.count = 300; fire(); assert.equal(chat.classes.has('bl-chat-light'), false, '끈 뒤에는 세지 않는다');
});
test('CSS: #chat.bl-chat-light 의 메시지에 content-visibility:auto · contain-intrinsic-size auto · 마지막 · 바닥 10개 · 메뉴 · 고른 메시지 제외 · :has 없음 · [style 없음 · style.css 에 들어 있다', () => {
    const src = read('css/05-chat.css');
    const m = src.match(/^body\.salty #chat\.bl-chat-light > \.mes([^{]*)\{([^}]*)\}/m);
    assert.ok(m, '규칙이 없다');
    assert.match(m[1], /:not\(\.last_mes, \.bl-menu-open, \.selected\)/);
    assert.match(m[1], /:not\(:nth-last-child\(-n\+10\)\)/, '바닥 10개는 실제 높이로 — 바닥 붙이기 정확');
    assert.ok(!m[1].includes(':has('), '메시지마다 :has 주어가 되지 않게');
    assert.ok(!/\[\s*style/.test(m[1]));
    assert.match(m[2], /content-visibility:\s*auto/); assert.match(m[2], /contain-intrinsic-size:\s*auto \d+px/);
    assert.match(m[2], /flex-shrink:\s*0/, '#chat 세로 flex 에서 건너뛴 메시지가 납작해지지 않게');
    assert.ok(read('style.css').includes('.bl-chat-light > .mes:not(.last_mes, .bl-menu-open, .selected):not(:nth-last-child(-n+10))'), 'style.css 에 빌드돼 있다 (빌드가 #chat 을 :is(#chat,.bl-chat-like) 로 넓힌다)');
    assert.match(src, /\.mes\.bl-menu-open \{[^}]*content-visibility: visible !important/s, '메뉴 열린 메시지는 visible !important 로 이미 뺀다');
});
test('연결: features.js · settings.js(기본값 · 보정 · 동작 값) · styles.js · 설정 줄 · 라벨 · 검색 · CI', () => {
    assert.match(read('src/features.js'), /const chatLight = on && s\.chat\?\.chatLight !== false;\n\s+if \(chatLight \|\| modules\.chatlight\) load\('chatlight', '\.\/chat-light\.js'\)\.then\(m => m\?\.syncChatLight\(chatLight\)\);/);
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
