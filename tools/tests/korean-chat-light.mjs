// 한글화(korean) 채팅 감시 가볍게 — 답 본문 글자가 자랄 때(characterData)는 콜백이 불리지 않고, 번역하는 칸(생각 칸 머리글 · 프리셋 카드 제목 ·
//   환영 칸 글자)은 예전처럼 그리기 전에 바뀐다. 제 번역이 쓴 글자 때문에 콜백이 한 번 더 불리지도 않는다.
//   node tools/tests/korean-chat-light.mjs <테마 루트>
// 폰 4배 측정에서 내장 스크립트 실행기 몫의 MutationObserver 콜백이 2,019번이었다 (채팅 뿌리 전체를 characterData 로 보던 때).
// 내장본(src/scripts/bundled/korean.js)의 채팅 감시 조각을 잘라 작은 가짜 DOM · 가짜 MutationObserver 위에서 돌린다. 글은 모두 지어낸 것.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let pass = 0, fail = 0;
async function test(name, fn) {
    try { await fn(); pass++; console.log('  ok  ' + name); }
    catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e.stack || e.message || e).split('\n').slice(0, 8).join('\n       ')); }
}

const source = read('tools/scripts-src/korean.js');
const bundled = String((await import(pathToFileURL(path.join(root, 'src/scripts/bundled/korean.js')).href)).default).replace(/\r\n/g, '\n');

// ── 작은 선택자: 태그 · #id · .class · [속성] · [속성="값"] · [속성*="값"] · [속성^="값"] · :is(…) · 자손(빈칸) · 자식(>) · 쉼표
function splitTop(text, sep) {
    const out = []; let depth = 0, quote = null, cur = '';
    for (const ch of text) {
        if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
        if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        if (depth === 0 && sep(ch)) { out.push(cur); cur = ''; continue; }
        cur += ch;
    }
    out.push(cur);
    return out;
}
const parsed = new Map();
function parseList(selector) {
    if (parsed.has(selector)) return parsed.get(selector);
    const list = splitTop(selector, ch => ch === ',').map(s => s.trim()).filter(Boolean).map(complex => {
        const words = splitTop(complex.replace(/\s*>\s*/g, ' > '), ch => /\s/.test(ch)).filter(Boolean);
        const parts = [];
        for (const word of words) {
            if (word === '>') { parts.push('>'); continue; }
            if (parts.length && parts[parts.length - 1] !== '>') parts.push(' ');
            parts.push(word);
        }
        return parts;
    });
    parsed.set(selector, list);
    return list;
}
function matchCompound(el, compound) {
    if (!el || el.nodeType !== 1) return false;
    let rest = compound;
    const tag = rest.match(/^[a-z*][\w-]*/i);
    if (tag) { if (tag[0] !== '*' && el.tagName !== tag[0].toUpperCase()) return false; rest = rest.slice(tag[0].length); }
    while (rest) {
        let m;
        if ((m = rest.match(/^#([\w-]+)/))) { if (el.getAttribute('id') !== m[1]) return false; }
        else if ((m = rest.match(/^\.([\w-]+)/))) { if (!String(el.getAttribute('class') || '').split(/\s+/).includes(m[1])) return false; }
        else if ((m = rest.match(/^\[([\w-]+)(?:([*^]?=)"([^"]*)")?\]/))) {
            const value = el.getAttribute(m[1]);
            if (value === null) return false;
            if (m[2] === '=' && value !== m[3]) return false;
            if (m[2] === '*=' && !value.includes(m[3])) return false;
            if (m[2] === '^=' && !value.startsWith(m[3])) return false;
        } else if (rest.startsWith(':is(')) {
            let depth = 0, end = -1;
            for (let i = 3; i < rest.length; i++) { if (rest[i] === '(') depth++; if (rest[i] === ')' && --depth === 0) { end = i; break; } }
            if (!matchesList(el, rest.slice(4, end))) return false;
            rest = rest.slice(end + 1);
            continue;
        } else throw new Error('모르는 선택자 조각: ' + rest);
        rest = rest.slice(m[0].length);
    }
    return true;
}
function matchParts(el, parts, i) {
    if (!matchCompound(el, parts[i])) return false;
    if (i === 0) return true;
    const comb = parts[i - 1];
    if (comb === '>') return matchParts(el.parentElement, parts, i - 2);
    for (let up = el.parentElement; up; up = up.parentElement) if (matchParts(up, parts, i - 2)) return true;
    return false;
}
function matchesList(el, selector) { return parseList(selector).some(parts => matchParts(el, parts, parts.length - 1)); }

// ── 가짜 MutationObserver (명세대로: 조상 등록 중 subtree · 종류가 맞는 감시자마다 기록 하나, 마이크로태스크에서 생긴 차례대로 부름)
const registrations = new Map();   // node → [{ observer, options }]
const allObservers = [];
let deliveryQueued = false;
let callbacks = 0;
class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.records = []; this.nodes = new Set(); allObservers.push(this); }
    observe(node, options) {
        const list = registrations.get(node) || [];
        const mine = list.find(r => r.observer === this);
        if (mine) mine.options = { ...options };
        else list.push({ observer: this, options: { ...options } });
        registrations.set(node, list);
        this.nodes.add(node);
    }
    takeRecords() { const out = this.records; this.records = []; return out; }
    disconnect() {
        for (const node of this.nodes) registrations.set(node, (registrations.get(node) || []).filter(r => r.observer !== this));
        this.nodes.clear();
        this.records = [];
    }
}
function queueRecord(type, target, added = [], removed = []) {
    const interested = new Set();
    for (let node = target; node; node = node.parentNode) {
        for (const { observer, options } of registrations.get(node) || []) {
            if (node !== target && !options.subtree) continue;
            if (type === 'characterData' && !options.characterData) continue;
            if (type === 'childList' && !options.childList) continue;
            if (type === 'attributes' && !options.attributes) continue;
            interested.add(observer);
        }
    }
    for (const observer of interested) observer.records.push({ type, target, addedNodes: added, removedNodes: removed });
    if (interested.size && !deliveryQueued) {
        deliveryQueued = true;
        queueMicrotask(() => {
            deliveryQueued = false;
            for (const observer of allObservers) {
                const records = observer.takeRecords();
                if (!records.length) continue;
                callbacks++;
                observer.callback(records, observer);
            }
        });
    }
}

// ── 가짜 노드
class Text {
    constructor(value) { this.nodeType = 3; this.parentNode = null; this.value = value; }
    get parentElement() { return this.parentNode; }
    get nodeValue() { return this.value; }
    set nodeValue(value) { this.value = String(value); queueRecord('characterData', this); }
    get isConnected() { return isConnected(this); }
}
class El {
    constructor(tag, attrs = {}, kids = []) {
        this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.childNodes = []; this.parentNode = null;
        for (const kid of kids) this.appendQuiet(typeof kid === 'string' ? new Text(kid) : kid);
    }
    appendQuiet(node) { node.parentNode = this; this.childNodes.push(node); return node; }
    append(node) { this.appendQuiet(node); queueRecord('childList', this, [node], []); return node; }
    replaceChildren(...nodes) {
        const removed = this.childNodes;
        for (const node of removed) node.parentNode = null;
        this.childNodes = [];
        for (const node of nodes) this.appendQuiet(node);
        queueRecord('childList', this, nodes, removed);
    }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    get children() { return this.childNodes.filter(n => n.nodeType === 1); }
    get isConnected() { return isConnected(this); }
    getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    setAttribute(name, value) { this.attrs[name] = String(value); queueRecord('attributes', this); }
    get textContent() { return this.childNodes.map(n => n.nodeType === 3 ? n.nodeValue : n.textContent).join(''); }
    set textContent(value) { this.replaceChildren(new Text(value)); }
    matches(selector) { return matchesList(this, selector); }
    closest(selector) { for (let el = this; el; el = el.parentElement) if (el.matches(selector)) return el; return null; }
    *descendants() { for (const kid of this.children) { yield kid; yield* kid.descendants(); } }
    querySelectorAll(selector) { return [...this.descendants()].filter(el => el.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    contains(node) { for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; }
}
let html = null;
function isConnected(node) { for (let n = node; n; n = n.parentNode) if (n === html) return true; return false; }
const textOf = el => el.childNodes.find(n => n.nodeType === 3);

// ── 내장본의 채팅 감시 조각만 잘라 돌린다
function piece(text, from, to) {
    const lines = text.split('\n');
    const a = lines.findIndex(l => from.test(l));
    const b = lines.findIndex((l, i) => i > a && to.test(l));
    assert.ok(a >= 0 && b > a, `조각을 못 찾았어요: ${from}`);
    return lines.slice(a, b).join('\n');
}
function chatSection(code) {
    return [
        piece(code, /^  const ATTRIBUTE_NAMES = /, /^  function normalize\(text\) \{$/),
        '  function normalize(text) { return String(text ?? \'\').normalize(\'NFKC\').replace(/\\s+/g, \' \').trim(); }',
        '  const translate = () => null;',
        piece(code, /^  \/\/ 채팅 안은 원래 건드리지 않지만/, /^  \/\/ Only individual text nodes change/),
        piece(code, /^  function swapText\(node, lookup\) \{$/, /^  function translateAttributes\(/),
        piece(code, /^  \/\/ 채팅: 메시지가 수천 개라도/, /^  \/\/ Helper release notes/),
        '  return { watchChat, chatObservers, textChanges, stop() { stopped = true; } };',
    ].join('\n');
}
const timers = [];
const host = {
    MutationObserver: FakeMutationObserver,
    NodeFilter: { SHOW_TEXT: 4 },
    setTimeout(fn) { timers.push(fn); return timers.length; },
    clearTimeout() {},
};
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
async function runTimers() { await settle(); while (timers.length) { timers.shift()(); await settle(); } }

function makePage() {
    registrations.clear(); allObservers.length = 0; timers.length = 0; callbacks = 0;
    const title = new El('div', { class: 'recentChatsTitle' }, ['Recent Chats']);
    const welcome = new El('div', { class: 'welcomePanel' }, [title]);
    const header = new El('span', { class: 'mes_reasoning_header_title' }, ['Thinking...']);
    const bodyText = new El('p', {}, ['Hel']);
    const mesText = new El('div', { class: 'mes_text' }, [bodyText]);
    const mes = new El('div', { class: 'mes', mesid: '1' }, [new El('div', { class: 'mes_reasoning_header' }, [header]), mesText]);
    const chat = new El('div', { id: 'chat' }, [welcome, mes]);
    html = new El('html', {}, [new El('body', {}, [chat])]);
    const doc = { querySelectorAll: selector => html.querySelectorAll(selector), createTreeWalker() { throw new Error('도우미 인사말 길은 이 시험에서 안 가요'); } };
    return { chat, welcome, title, header, mes, mesText, bodyText, doc };
}
async function boot(code) {
    const page = makePage();
    const api = new Function('host', 'doc', chatSection(code))(host, page.doc);
    api.watchChat();
    await runTimers();
    return { ...page, api };
}

await test('뿌리는 글자 변화(characterData)를 보지 않고, 칸이 들어오는 것(childList)만 본다', async () => {
    const { chat, api } = await boot(bundled);
    const rootReg = registrations.get(chat).find(r => r.observer === api.chatObservers.get(chat));
    assert.deepEqual(rootReg.options, { subtree: true, childList: true });
    for (const text of [source, bundled]) {
        assert.ok(text.includes('    observer.observe(root, { subtree: true, childList: true });'));
        assert.ok(!text.includes('observer.observe(root, { subtree: true, childList: true, characterData: true });'));
        assert.ok(text.includes('  const CHAT_TEXT_WATCH = { subtree: true, characterData: true };'));
        assert.ok(text.includes('      watchChatText(label);') && text.includes('      watchChatText(message);'), '환영 칸 글자 · 도우미 인사말에도 글자 감시');
        assert.ok(text.includes('    watchChatText(element);\n    if (element.closest(\'[contenteditable="true"], textarea\')) return;'), '번역하는 칸에 글자 감시');
        assert.ok(/chatObservers\.clear\(\);\n    chatText\.disconnect\(\);/.test(text), '정리할 때 글자 감시도 끊는다');
    }
});

await test('처음 훑기는 예전처럼 번역하고, 제 번역 글자로 콜백이 다시 불리지 않는다', async () => {
    const { title, header } = await boot(bundled);
    assert.equal(textOf(title).nodeValue, '최근 대화');
    assert.equal(textOf(header).nodeValue, '생각하는 중...');
    assert.equal(callbacks, 0);
});

await test('답 본문 글자가 200번 자라도 콜백 0번 (뿌리 전체를 글자로 보던 예전 꼴은 200번)', async () => {
    for (const [code, want] of [[bundled, 0], [bundled.replace('observer.observe(root, { subtree: true, childList: true });', 'observer.observe(root, { subtree: true, childList: true, characterData: true });'), 200]]) {
        const { bodyText } = await boot(code);
        const node = textOf(bodyText);
        callbacks = 0;
        for (let i = 0; i < 200; i++) { node.nodeValue += 'lo'; await settle(); }
        assert.equal(callbacks, want);
    }
});

await test('스트리밍이 걸음마다 본문을 새로 쓰면 걸음마다 한 번만 불리고, 카드 제목 · 머리글은 그 자리에서 바뀐다', async () => {
    const { mesText, header } = await boot(bundled);
    for (let i = 0; i < 30; i++) {
        const card = new El('div', { class: 'custom-dem-card__title' }, ['Status']);
        mesText.replaceChildren(new El('p', {}, ['Line ' + i]), card);
        await settle();
        assert.equal(textOf(card).nodeValue, '상태', '그리기 전에(같은 마이크로태스크 안) 바뀐다');
    }
    header.textContent = 'Thought for some time';
    await settle();
    assert.equal(textOf(header).nodeValue, '잠시 생각함');
    assert.equal(callbacks, 31, '제 번역 글자 때문에 한 번 더 불리지 않는다');
});

await test('다른 코드가 번역한 칸 글자를 제자리에서 영어로 되돌리면 글자 감시가 받아 다시 바꾼다 (한 번만 불림)', async () => {
    const { title, header } = await boot(bundled);
    textOf(header).nodeValue = 'Thinking...';
    await settle();
    assert.equal(textOf(header).nodeValue, '생각하는 중...');
    assert.equal(callbacks, 1);
    textOf(title).nodeValue = 'Recent Chats';
    await settle();
    assert.equal(textOf(title).nodeValue, '최근 대화');
    assert.equal(callbacks, 2);
});

await test('뿌리 콜백과 글자 감시 기록이 한 일(task)에 같이 생겨도 둘 다 처리한다 (밖에서 생긴 글자 기록을 버리지 않음)', async () => {
    const { header, mesText } = await boot(bundled);
    textOf(header).nodeValue = 'Thinking...';
    const card = new El('div', { class: 'custom-dem-card__tag' }, ['Live']);
    mesText.append(card);
    await settle();
    assert.equal(textOf(header).nodeValue, '생각하는 중...');
    assert.equal(textOf(card).nodeValue, '실시간');
    assert.ok(callbacks <= 2, String(callbacks));
});

await test('나중에 들어온 환영 칸 · 카드도 글자 감시가 붙는다', async () => {
    const { chat } = await boot(bundled);
    const label = new El('div', { class: 'recentChatsTitle' }, ['Recent Chats']);
    chat.append(new El('div', { class: 'welcomePanel' }, [label]));
    await settle();
    assert.equal(textOf(label).nodeValue, '최근 대화');
    textOf(label).nodeValue = 'Recent Chats';
    await settle();
    assert.equal(textOf(label).nodeValue, '최근 대화');
    assert.equal(callbacks, 2);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
