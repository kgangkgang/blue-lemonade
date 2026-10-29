// 8.2.6 성능: src/mes-pins.js 가 메시지 하나가 그려진 이벤트에는 그 메시지만 훑고(채팅 전체를 두 번 훑지 않음),
//   결과(꺼낸 단추 자리 · 순서 · 표시)는 채팅 전체를 훑은 것과 같은지, 번호가 없거나 못 찾으면 예전처럼 전체를 훑는지 (가짜 DOM · 가짜 타이머)
//   node tools/tests/mes-pins-one.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

// ── 작은 DOM 흉내: 이 모듈이 쓰는 선택자(.a > .b > * · :scope > .a)만 ──
let visits = 0;
class Node0 { constructor() { this.parentNode = null; } get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; } get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === doc; }
    replaceWith(other) { const p = this.parentNode; const i = p.childNodes.indexOf(this); other.remove?.(); p.childNodes.splice(i, 1, other); other.parentNode = p; this.parentNode = null; }
    remove() { const p = this.parentNode; if (p) { p.childNodes.splice(p.childNodes.indexOf(this), 1); this.parentNode = null; } } }
class Comment0 extends Node0 { constructor(t) { super(); this.nodeType = 8; this.data = t; } }
class El extends Node0 {
    constructor(tag, cls = '', attrs = {}) {
        super(); this.nodeType = 1; this.localName = tag; this.childNodes = []; this.attrs = { ...attrs }; this.dataset = {}; this.style = {};
        const list = new Set(cls.split(/\s+/).filter(Boolean)); this._cls = list;
        this.classList = { contains: c => list.has(c), add: c => list.add(c), remove: c => list.delete(c), toggle: (c, on) => { if (on ?? !list.has(c)) list.add(c); else list.delete(c); }, [Symbol.iterator]: () => list.values() };
    }
    get children() { return this.childNodes.filter(n => n.nodeType === 1); }
    get childElementCount() { return this.children.length; }
    get lastElementChild() { return this.children.at(-1) || null; }
    get previousElementSibling() { const s = this.parentNode?.children || []; return s[s.indexOf(this) - 1] || null; }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    append(...nodes) { for (const n of nodes) { n.remove?.(); n.parentNode = this; this.childNodes.push(n); } }
    insertBefore(n, ref) { if (!ref) return this.append(n); n.remove?.(); const i = this.childNodes.indexOf(ref); this.childNodes.splice(i, 0, n); n.parentNode = this; }
    matchCompound(c) { if (c === '*') return true; return c.split('.').filter(Boolean).every(x => this._cls.has(x)); }
    matchChain(parts, scope) {
        if (!this.matchCompound(parts.at(-1))) return false;
        let at = this.parentElement;
        for (let i = parts.length - 2; i >= 0; i--) { if (parts[i] === ':scope') return at === scope; if (!at || !at.matchCompound(parts[i])) return false; at = at.parentElement; }
        return true;
    }
    querySelectorAll(sel) { const parts = sel.split('>').map(s => s.trim()); const out = []; const walk = e => { for (const c of e.children) { visits++; if (c.matchChain(parts, this)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    closest(sel) { for (let n = this; n; n = n.parentElement) if (n.matchCompound(sel.replace(/^\./, '.'))) return n; return null; }
    matches(sel) { return sel.split(',').some(s => this.matchCompound(s.trim())); }
}
const doc = { nodeType: 9, childNodes: [], body: null, getElementById: id => id === 'chat' ? chat : null, createComment: t => new Comment0(t), addEventListener() {}, removeEventListener() {} };
let chat;
globalThis.document = doc;
// 가짜 타이머 — 시간을 손으로 흘려요
let now = 0; const timers = new Map(); let nextTimer = 1;
globalThis.setTimeout = (fn, ms) => { const id = nextTimer++; timers.set(id, { fn, at: now + ms }); return id; };
globalThis.clearTimeout = id => timers.delete(id);
const advance = ms => { const end = now + ms; for (;;) { const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0]; if (!due) break; timers.delete(due[0]); now = due[1].at; due[1].fn(); } now = end; };
const listeners = new Map();
const eventSource = { on: (n, fn) => { if (!listeners.has(n)) listeners.set(n, []); listeners.get(n).push(fn); }, removeListener: (n, fn) => listeners.set(n, (listeners.get(n) || []).filter(f => f !== fn)), emit: (n, ...a) => (listeners.get(n) || []).forEach(fn => fn(...a)) };
const event_types = { CHAT_CHANGED: 'chat_changed', CHARACTER_MESSAGE_RENDERED: 'char_rendered', USER_MESSAGE_RENDERED: 'user_rendered', MORE_MESSAGES_LOADED: 'more_loaded', MESSAGE_UPDATED: 'updated', MESSAGE_SWIPED: 'swiped', MESSAGE_EDITED: 'edited', MESSAGE_DELETED: 'deleted' };
globalThis.SillyTavern = { getContext: () => ({ eventSource, event_types, extensionSettings: {}, saveSettingsDebounced() {} }) };

const BUTTONS = ['mes_translate', 'mes_narrate', 'mes_copy', 'mes_edit', 'mes_hide', 'mes_unhide', 'mes_bookmark', 'mes_create_branch', 'mes_prompt', 'mes_delete', 'mes_embed', 'mes_media_gallery'];
function message(id) {
    const mes = new El('div', 'mes', { mesid: String(id) });
    const bar = new El('div', 'mes_buttons'), extra = new El('div', 'extraMesButtons'), hint = new El('div', 'extraMesButtonsHint');
    for (const b of BUTTONS) extra.append(new El('div', `mes_button ${b} fa-solid interactable`));
    bar.append(hint, extra, new El('div', 'mes_edit mes_button'));
    const text = new El('div', 'mes_block'); for (let i = 0; i < 6; i++) text.append(new El('p'));
    mes.append(new El('div', 'mesAvatarWrapper'), text, bar);
    return mes;
}
function freshChat(n) { chat = new El('div', 'chat', { id: 'chat' }); doc.childNodes = []; chat.parentNode = doc; doc.childNodes.push(chat); for (let i = 0; i < n; i++) chat.append(message(i)); }
const snapshot = () => chat.children.map(mes => {
    const bar = mes.children.find(c => c._cls.has('mes_buttons'));
    const extra = bar.children.find(c => c._cls.has('extraMesButtons'));
    const cls = e => [...e._cls].find(c => /^mes_(?!button)/.test(c)) || [...e._cls].join('.');
    return [bar.childNodes.map(n => n.nodeType === 8 ? '#' : cls(n) + (n._cls.has('bl-pinned') ? `@${n.dataset.blPin}` : '')).join(','), extra.childNodes.map(n => n.nodeType === 8 ? '#' : cls(n)).join(','), bar._cls.has('bl-menu-empty')].join('|');
}).join('\n');

const { syncMesPins } = await import(pathToFileURL(path.join(root, 'src/mes-pins.js')).href);
const PINS = ['mes_translate', 'mes_hide', 'mes_copy'];

await test('켤 때 채팅 전체를 한 번 훑어 모든 메시지에서 고른 단추를 꺼내요(짝 mes_unhide 포함)', () => {
    freshChat(300);
    visits = 0; syncMesPins(true, PINS, false);
    const snap = snapshot().split('\n');
    assert.equal(snap.length, 300);
    assert.ok(snap.every(line => line.startsWith('mes_translate@0,mes_hide@1,mes_unhide@2,mes_copy@3,extraMesButtonsHint,extraMesButtons,')), snap[0]);
    assert.ok(visits > 300 * 20, `전체 훑기 ${visits}`);
});
await test('새 답 하나(번호 있음) → 그 메시지만 두 번 훑고, 결과는 전체 훑기와 같아요', () => {
    chat.append(message(300));
    visits = 0; eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, 300, 'normal'); advance(1000);
    const one = visits, snap = snapshot();
    console.log(`        훑은 요소 ${one}개 (메시지 301개)`);
    assert.ok(one < 400, `한 메시지만 — ${one}`);
    // 같은 DOM 을 채팅 바뀜(전체)으로 맞춘 결과와 견줘요
    const mine = snap; freshChat(300); syncMesPins(false, [], false); syncMesPins(true, PINS, false); chat.append(message(300));
    visits = 0; eventSource.emit(event_types.CHAT_CHANGED); advance(1000);
    console.log(`        같은 일을 채팅 전체로(8.2.5 방식) 훑으면 ${visits}개`);
    assert.ok(visits > 301 * 20 * 2, `채팅 바뀜은 전체 두 번 — ${visits}`);
    assert.equal(mine, snapshot());
});
await test('이벤트가 잇달아 오면 타이머를 새로 걸고, 쌓인 번호는 모두 훑어요', () => {
    chat.append(message(301)); chat.append(message(302));
    visits = 0; eventSource.emit(event_types.USER_MESSAGE_RENDERED, 301); advance(30); eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, '302', 'normal'); advance(1000);
    const lines = snapshot().split('\n');
    assert.ok(lines[301].includes('mes_translate@0') && lines[302].includes('mes_translate@0'));
    assert.ok(visits < 800, `두 메시지만 — ${visits}`);
    assert.equal(timers.size, 0, '700ms 뒤에는 남은 타이머가 없어요');
});
await test('번호가 없거나 · 그 메시지를 못 찾거나 · 20개 넘게 쌓이면 예전처럼 전체를 훑어요', () => {
    for (const fire of [() => eventSource.emit(event_types.MESSAGE_UPDATED), () => eventSource.emit(event_types.MESSAGE_EDITED, 9999), () => { for (let i = 0; i < 25; i++) eventSource.emit(event_types.MESSAGE_SWIPED, i); }, () => eventSource.emit(event_types.MESSAGE_DELETED, 3), () => eventSource.emit(event_types.MORE_MESSAGES_LOADED)]) {
        visits = 0; fire(); advance(1000);
        assert.ok(visits > 300 * 20, `전체 — ${visits}`);
    }
});
await test('끄면 단추를 메뉴 제자리로 돌려놓고 이벤트 리스너를 모두 떼요', () => {
    syncMesPins(false, [], false);
    assert.ok(snapshot().split('\n').every(line => line.startsWith('extraMesButtonsHint,extraMesButtons,mes_edit|mes_translate,mes_narrate,mes_copy,')), snapshot().split('\n')[0]);
    assert.equal([...listeners.values()].flat().length, 0);
    visits = 0; eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, 5); advance(1000); assert.equal(visits, 0);
});
console.log(`\n${passed} passed`);
