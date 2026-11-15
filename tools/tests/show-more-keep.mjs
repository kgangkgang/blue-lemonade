// 1.5.1 「이전 메시지 더 보기」 단추 지키기 (src/show-more-keep.js) — 브라우저 없이 작은 #chat 흉내로.
// 酒馆助手(JS-Slash-Runner) better_message_to_load 의 cancelChatMessages 를 그대로 흉내 내(지운 뒤 옛 첫 메시지 번호를 읽음 · 붙일 땐 맨 아래) 사용자 사진 상황을 다시 만든다.
//   node tools/tests/show-more-keep.mjs [테마 뿌리, 기본 .]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const K = await import(pathToFileURL(path.join(root, 'src/show-more-keep.js')).href);
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('PASS ' + name); };

// ── 아주 작은 DOM: #chat 의 바로 아래 자식만 ──
class El {
    constructor(doc, { id = '', cls = '', mesid = null, text = '' } = {}) { this.doc = doc; this.id = id; this.className = cls; this.mesid = mesid; this.textContent = text; this.parentElement = null; this.children = []; }
    getAttribute(k) { return k === 'mesid' ? this.mesid : null; }
    get isConnected() { return this === this.doc.chat || !!this.parentElement?.isConnected; }
    get nextElementSibling() { const p = this.parentElement; if (!p) return null; return p.children[p.children.indexOf(this) + 1] ?? null; }
    remove() { const p = this.parentElement; if (!p) return; p.children.splice(p.children.indexOf(this), 1); this.parentElement = null; p.doc.mutated(); }
    insertBefore(node, ref) { node.remove(); const i = ref ? this.children.indexOf(ref) : -1; this.children.splice(i < 0 ? this.children.length : i, 0, node); node.parentElement = this; this.doc.mutated(); return node; }
    append(...nodes) { for (const x of nodes) this.insertBefore(x, null); }
    prepend(...nodes) { for (const x of nodes.reverse()) this.insertBefore(x, this.children[0] ?? null); }
    querySelector(sel) {
        assert.equal(sel, ':scope > .mes[mesid]');
        return this.children.find(c => c.className.split(' ').includes('mes') && c.mesid !== null) ?? null;
    }
    mesList() { return this.children.filter(c => c.className.split(' ').includes('mes')); }
}
function makeDoc() {
    const doc = { observers: [], mutated() { for (const o of this.observers) o.notify(); } };
    doc.chat = new El(doc, { id: 'chat' });
    doc.getElementById = id => (id === 'chat' ? doc.chat : doc.chat.children.find(c => c.id === id) ?? null);
    doc.createElement = () => new El(doc);
    return doc;
}
const mes = (doc, i) => new El(doc, { cls: 'mes', mesid: String(i) });
/** 화면 순서: 'B' = 단추, 숫자 = 메시지 번호 */
const order = doc => doc.chat.children.map(c => (c.id === 'show_more_messages' ? 'B' : Number(c.mesid)));

/** 실리태번 printMessages(불러올 수 count) */
function printMessages(doc, chatLen, count) {
    doc.chat.children.slice().forEach(c => c.remove());
    let start = 0;
    if (chatLen > count) { start = chatLen - count; const b = doc.createElement(); b.id = 'show_more_messages'; b.textContent = 'Show more messages'; doc.chat.append(b); }
    for (let i = start; i < chatLen; i++) doc.chat.append(mes(doc, i));
}
/** 실리태번 showMoreMessages: 단추 뒤에 끼워 넣고, 0 까지 왔으면 단추를 뗀다 */
function showMore(doc, count) {
    const first = Number(doc.chat.querySelector(':scope > .mes[mesid]')?.getAttribute('mesid'));
    const firstId = Math.max(0, first - count);
    const b = doc.getElementById('show_more_messages');
    const els = []; for (let i = firstId; i < first; i++) els.push(mes(doc, i));
    if (b) { let ref = b.nextElementSibling; for (const e of els) doc.chat.insertBefore(e, ref); } else doc.chat.prepend(...els);
    if (firstId === 0) b?.remove();
}
/** 酒馆助手 4.12.1 cancelChatMessages 그대로 (src/panel/optimize/better_message_to_load/index.ts) */
function tavernHelperCancel(doc, truncation) {
    const $mes = doc.chat.mesList();
    $mes.slice(0, Math.max(0, $mes.length - truncation)).forEach(e => e.remove());
    const firstMesid = Number($mes[0]?.getAttribute('mesid'));   // ← 지운 뒤에도 옛 목록의 첫 것
    const b = doc.getElementById('show_more_messages');
    if (firstMesid > 0 && !b) { const x = doc.createElement(); x.id = 'show_more_messages'; x.textContent = 'Show more messages'; doc.chat.append(x); }
    else if (firstMesid === 0 && b) b.remove();
}
const keep = (doc, chatLength) => K.keepShowMore(doc.chat, { doc, chatLength });

await t('사용자 사진 그대로(메시지 2개 · 불러올 수 1): 酒馆助手가 #0 을 지우고 단추를 안 붙인다 → 지키기가 #1 앞에 붙인다', () => {
    const doc = makeDoc();
    printMessages(doc, 1, 1);                       // 첫 인사만 — 단추 없음(본체도 안 붙임)
    assert.deepEqual(order(doc), [0]);
    doc.chat.append(mes(doc, 1));                   // 새 답 #1
    tavernHelperCancel(doc, 1);
    assert.deepEqual(order(doc), [1], '고치기 전: 단추 없음(사진)');
    assert.equal(keep(doc, 2), 'added');
    assert.deepEqual(order(doc), ['B', 1]);
    assert.equal(doc.getElementById('show_more_messages').textContent, 'Show more messages', '본체와 같은 글 → ko-ui 가 한글로');
    showMore(doc, 1);                               // 누르면 #0 이 위로 들어오고 단추는 사라진다
    assert.deepEqual(order(doc), [0, 1]);
    assert.equal(keep(doc, 2), 'ok');
});
await t('맨 위까지 다 불러온 뒤 새 답(긴 채팅): 酒馆助手가 옛것을 다 지우고 단추 없음 → 붙인다 · 눌러 차례대로 위로', () => {
    const doc = makeDoc();
    printMessages(doc, 5, 1); for (let i = 0; i < 4; i++) showMore(doc, 1);
    assert.deepEqual(order(doc), [0, 1, 2, 3, 4]);
    doc.chat.append(mes(doc, 5)); tavernHelperCancel(doc, 1);
    assert.deepEqual(order(doc), [5]);
    assert.equal(keep(doc, 6), 'added');
    showMore(doc, 1); assert.deepEqual(order(doc), ['B', 4, 5]);
    showMore(doc, 3); assert.deepEqual(order(doc), ['B', 1, 2, 3, 4, 5]);
    showMore(doc, 3); assert.deepEqual(order(doc), [0, 1, 2, 3, 4, 5]);
});
await t('酒馆助手가 단추를 맨 아래(append)에 붙인 경우 → 첫 메시지 앞으로 옮겨 옛 메시지가 위로 들어간다', () => {
    const doc = makeDoc();
    doc.chat.append(mes(doc, 3), mes(doc, 4));
    const b = doc.createElement(); b.id = 'show_more_messages'; doc.chat.append(b);
    assert.deepEqual(order(doc), [3, 4, 'B']);
    assert.equal(keep(doc, 5), 'moved');
    assert.deepEqual(order(doc), ['B', 3, 4]);
    showMore(doc, 1); assert.deepEqual(order(doc), ['B', 2, 3, 4]);
});
await t('본체 그대로의 흐름엔 손대지 않는다: 단추가 맨 위 · 처음부터 다 보임 · 단추만 먼저 붙은 틈 · 빈 채팅', () => {
    const doc = makeDoc();
    printMessages(doc, 3, 1); assert.equal(keep(doc, 3), 'ok'); assert.deepEqual(order(doc), ['B', 2]);
    printMessages(doc, 2, 5); assert.equal(keep(doc, 2), 'ok'); assert.deepEqual(order(doc), [0, 1]);
    doc.chat.children.slice().forEach(c => c.remove());
    const b = doc.createElement(); b.id = 'show_more_messages'; doc.chat.append(b);
    assert.equal(keep(doc, 5), 'empty', 'printMessages 가 단추를 붙이고 메시지를 아직 안 붙인 틈');
    assert.deepEqual(order(doc), ['B']);
    b.remove(); assert.equal(keep(doc, 0), 'empty');
});
await t('#0 이 보이는데 단추가 남아 있으면 뗀다 · 채팅 배열 밖 번호(다른 화면)는 건드리지 않는다', () => {
    const doc = makeDoc();
    doc.chat.append(mes(doc, 0), mes(doc, 1)); const b = doc.createElement(); b.id = 'show_more_messages'; doc.chat.append(b);
    assert.equal(keep(doc, 2), 'removed'); assert.deepEqual(order(doc), [0, 1]);
    const d2 = makeDoc(); d2.chat.append(mes(d2, 7));
    assert.equal(keep(d2, 3), 'skip'); assert.deepEqual(order(d2), [7]);
});
await t('감시자: #chat 자식이 바뀐 뒤 한 번 모아서 고친다 · 뗄 수 있다', async () => {
    const doc = makeDoc();
    const prevMO = globalThis.MutationObserver, prevDoc = globalThis.document, prevST = globalThis.SillyTavern;
    let calls = 0;
    globalThis.MutationObserver = class { constructor(cb) { this.cb = cb; } observe(el, opts) { assert.equal(el, doc.chat); assert.deepEqual(opts, { childList: true }); doc.observers.push(this); } disconnect() { doc.observers = doc.observers.filter(o => o !== this); } notify() { calls++; this.cb([]); } };
    globalThis.document = doc; globalThis.SillyTavern = { getContext: () => ({ chat: [{}, {}] }) };
    try {
        printMessages(doc, 1, 1);
        K.installShowMoreKeep(doc.chat);
        doc.chat.append(mes(doc, 1)); tavernHelperCancel(doc, 1);
        assert.deepEqual(order(doc), [1], '같은 일 안에서는 아직');
        await Promise.resolve(); await Promise.resolve();
        assert.deepEqual(order(doc), ['B', 1], '마이크로태스크 뒤 단추가 맨 위');
        assert.ok(calls >= 2);
        assert.equal(K.uninstallShowMoreKeep(), true);
        doc.chat.children.find(c => c.id === 'show_more_messages').remove();
        await Promise.resolve();
        assert.deepEqual(order(doc), [1], '뗀 뒤엔 안 붙인다');
    } finally { globalThis.MutationObserver = prevMO; globalThis.document = prevDoc; globalThis.SillyTavern = prevST; }
});
console.log(`show-more-keep: ${n} 통과`);
