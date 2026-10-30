// 8.2.7 성능: 내장 스크립트 감시 셋(한글화 채팅 감시 · 청과 화면 보조 · 헬퍼 창 찾기)이 같은 부모에 몰린 기록마다 조상을 다시 거슬러 오르지 않는지 · 고르는 것은 같은지
//   채팅을 열면 기록 수천 개가 메시지마다 단추 줄(부모 몇백 개)에 몰려요 — 기록마다 closest(긴 선택자) · contains 로 조상을 끝까지 올랐어요(폰 4배 관문 장면 합 약 0.3초).
//   부모마다 한 번만 묻고 그 답을 그 콜백 안에서 다시 써요(콜백이 묻는 동안 DOM 은 그대로 · 헬퍼는 글자 · 속성만 바꿔요). 내장본(bundled)에서 감시 조각을 잘라 가짜 노드 위에서 돌려요.
//   node tools/tests/script-watch-records.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`  PASS  ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${String(e.stack || e).split('\n').slice(0, 6).join('\n        ')}`); } };
const bundled = async id => String((await import(pathToFileURL(path.join(root, `src/scripts/bundled/${id}.js`)).href)).default).replace(/\r\n/g, '\n');
function piece(text, from, to) {
    const lines = text.split('\n'); const a = lines.findIndex(l => from.test(l)); const b = lines.findIndex((l, i) => i > a && to.test(l));
    assert.ok(a >= 0 && b > a, `조각을 못 찾았어요: ${from}`); return lines.slice(a, b).join('\n');
}
// 가짜 노드: closest · contains · getRootNode 를 셉니다(선택자는 class 하나 · #id 하나 · 쉼표만 흉내 — 답은 이 시험에 필요한 만큼)
const counted = { closest: 0, contains: 0, rootNode: 0 };
class El {
    constructor(tag, attrs = {}, kids = []) { this.nodeType = 1; this.localName = tag; this.attrs = attrs; this.children = []; this.parentElement = null; this.parentNode = null; for (const k of kids) this.append(k); }
    append(n) { n.parentElement = n.parentNode = this; this.children.push(n); return n; }
    get id() { return this.attrs.id || ''; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    get isConnected() { return true; }
    getRootNode() { counted.rootNode++; let n = this; while (n.parentNode) n = n.parentNode; return n; }
    one(sel) { return sel.split(',').map(s => s.trim()).some(s => (s.startsWith('#') && this.id === s.slice(1)) || (s.startsWith('.') && String(this.attrs.class || '').split(' ').includes(s.slice(1)))); }
    matches(sel) { return this.one(sel); }
    closest(sel) { counted.closest++; for (let n = this; n?.nodeType === 1; n = n.parentElement) if (n.one(sel)) return n; return null; }
    contains(node) { counted.contains++; for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; }
    querySelectorAll() { return []; }
    querySelector() { return null; }
}
// 지어낸 채팅: 메시지 하나 · 단추 줄 하나에 단추 200개가 하나씩 붙는 기록
function page() {
    const row = new El('div', { class: 'extraMesButtons' });
    const chat = new El('div', { id: 'chat' }, [new El('div', { class: 'mes' }, [new El('div', { class: 'mes_text' }), row])]);
    const doc = new El('#document'); doc.nodeType = 9; const html = doc.append(new El('html')); const body = html.append(new El('body'));
    body.append(chat); body.append(new El('div', { id: 'fruit-heart-v6' })); body.append(new El('div', { id: 'tavern_helper' }));
    const records = Array.from({ length: 200 }, () => ({ type: 'childList', target: row, addedNodes: [new El('div', { class: 'mes_button' })], removedNodes: [] }));
    return { doc, chat, row, records };
}

await test('한글화 채팅 감시: 같은 단추 줄에 붙는 기록 200개 — 환영 칸 · 번역 칸 조상 찾기는 부모마다 한 번(예전 400번) · 고르는 칸은 같아요', async () => {
    const code = await bundled('korean');
    const fn = new Function('host', 'doc', [
        "  const WELCOME_CONTAINER = '.welcomePanel, .mes_assistant';",
        "  const CHAT_TARGETS = '.mes_reasoning_header_title, .custom-dem-card__title';",
        '  let stopped = false, chatTimer = null; const textChanges = new Map(), attributeChanges = new Map(); const seen = { welcomes: [], labels: [] };',
        '  const chatText = { takeRecords: () => [] }; const flushChat = () => {};',
        '  const processWelcome = el => seen.welcomes.push(el); const translateChatLabel = el => seen.labels.push(el);',
        piece(code, /^  function handleChatRecords\(records\) \{$/, /^  function watchChatRoot\(root\) \{$/),
        '  return { handleChatRecords, seen };',
    ].join('\n'))({ setTimeout: () => 1 }, null);
    const { row, records } = page(); const title = new El('span', { class: 'custom-dem-card__title' }); row.append(title);
    records.push({ type: 'childList', target: title, addedNodes: [], removedNodes: [] });
    counted.closest = 0; fn.handleChatRecords(records);
    assert.ok(counted.closest <= 4, `조상 찾기 ${counted.closest}번`);
    assert.equal(fn.seen.welcomes.length, 200, '붙은 요소마다 환영 칸 확인(예전과 같음)');
    assert.deepEqual(fn.seen.labels, [title], '번역 칸(카드 제목)은 그대로 골라요');
});
await test('청과 화면 보조: 같은 부모 기록 200개 — 뿌리와 상관있는지는 부모마다 한 번(예전 200번) · 뿌리 안 변화는 예전처럼 다시 칠해요', async () => {
    const code = await bundled('qingguo');
    const { doc, row, records } = page(); const panel = doc.children[0].children[0].children[1];
    const observers = []; let frames = 0;
    const host = { document: doc, parent: null, confirm() {}, NodeFilter: { SHOW_TEXT: 4 }, requestAnimationFrame: () => ++frames, cancelAnimationFrame() {}, MutationObserver: class { constructor(fn) { this.fn = fn; observers.push(this); } observe() {} disconnect() {} } };
    host.parent = host;
    doc.querySelectorAll = sel => { const out = []; const walk = e => { for (const c of e.children) { if (sel.split(',').some(s => s.trim() === '#' + c.id && c.id)) out.push(c); walk(c); } }; walk(doc); return out; };
    doc.createTreeWalker = () => ({ nextNode: () => false });
    const saved = globalThis.window; globalThis.window = host;
    try {
        new Function('BlueLemonade', code)({ onCleanup() {}, promptTitle: () => null });
        const watcher = observers.at(-1); assert.ok(watcher);
        frames = 0; counted.rootNode = 0; counted.contains = 0; watcher.fn(records);
        assert.equal(frames, 0, '채팅 단추는 청과 화면과 상관없어요');
        assert.ok(counted.rootNode <= 201, `문서 확인 ${counted.rootNode}번(부모 한 번 + 붙은 요소마다)`);
        const inner = panel.append(new El('span'));
        watcher.fn([{ type: 'childList', target: panel, addedNodes: [inner], removedNodes: [] }]);
        assert.equal(frames, 1, '과일 창 안 변화는 다시 칠해요');
    } finally { globalThis.window = saved; }
});
await test('헬퍼 창 찾기: 같은 부모 기록 200개 — 채팅 · 입력칸 안인지는 부모마다 한 번(예전 200번) · 채팅 밖 새 칸은 예전처럼 찾아요', async () => {
    const code = await bundled('helper');
    const found = [];
    const fn = new Function('host', [
        "  const SCOPE = '.helper-scope'; const scopes = new Map(); const attachScope = el => found.push(el);",
        '  const found = arguments[1];',
        piece(code, /^  const discovery = new host\.MutationObserver\(records => \{$/, /^  \/\/ 탭 줄: /),
        '  return discovery;',
    ].join('\n'))({ MutationObserver: class { constructor(fn) { this.fn = fn; } } }, found);
    const { doc, records } = page();
    counted.closest = 0; fn.fn(records);
    assert.ok(counted.closest <= 2, `조상 찾기 ${counted.closest}번`);
    const body = doc.children[0].children[0]; const pop = body.append(new El('div', { class: 'popup' })); const scope = new El('div', { class: 'helper-scope' });
    scope.querySelectorAll = () => []; pop.append(scope);
    fn.fn([{ type: 'childList', target: pop, addedNodes: [scope], removedNodes: [] }]);
    assert.deepEqual(found, [scope], '채팅 밖에 붙은 헬퍼 칸은 그대로 찾아요');
});
await test('원본에서 만든 내장본: 한글화 · 청과는 원본(tools/scripts-src)과 같아요', () => {
    assert.ok(fs.readFileSync(path.join(root, 'tools/scripts-src/korean.js'), 'utf8').includes('const ancestors = new Map();'));
    assert.ok(fs.readFileSync(path.join(root, 'tools/scripts-src/fruit-family/qingguo-ui.js'), 'utf8').includes('targetRelevant'));
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/script-watch-records\.mjs \./);
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
