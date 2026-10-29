// 8.2.6 검토(review-826): 테마 애드온(TTS · LLM 번역)이 켜지면서 이미 그려진 메시지 전부에 메뉴 단추를 늦게 붙이는 경우 —
//   8.2.5 는 다음 메시지 이벤트 때 채팅 전체를 훑어 그 단추도 이름 줄로 꺼냈어요. 메시지 하나만 훑게 바꾼 뒤에도 옛 메시지에서 꺼내지는지,
//   그리고 애드온 상태 사건(bl:addons-state) 뒤에 전체를 훑는지 봐요 (가짜 DOM · 가짜 타이머, 틀은 mes-pins-one.mjs 와 같음)
//   node tools/tests/mes-pins-addon-late.mjs <테마 루트>
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
const win = new EventTarget(); globalThis.window = win;
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
// 애드온이 늦게 붙이는 단추(TTS 읽기 단추 꼴) — 메시지마다 메뉴 맨 앞에
const LATE = 'lv_play';
const addLate = mes => { const extra = mes.children.find(c => c._cls.has('mes_buttons')).children.find(c => c._cls.has('extraMesButtons')); extra.insertBefore(new El('div', `mes_button ${LATE} fa-solid fa-volume-high interactable`), extra.childNodes[0]); };
const pinnedIn = mes => mes.children.find(c => c._cls.has('mes_buttons')).children.some(c => c._cls.has(LATE) && c._cls.has('bl-pinned'));

await test('애드온이 옛 메시지에 단추를 늦게 붙인 뒤 새 메시지가 오면, 옛 메시지에서도 꺼내요(8.2.5 와 같은 결과)', () => {
    freshChat(40);
    syncMesPins(true, [LATE, 'mes_copy'], false); advance(1000);
    assert.ok(chat.children.every(m => !pinnedIn(m)), '아직 단추가 없어요');
    // 애드온 켜짐: 그려진 메시지 전부에 단추를 붙이고 상태 사건을 내요(addons.js startOne · persist)
    chat.children.forEach(addLate);
    win.dispatchEvent(new Event('bl:addons-state'));
    advance(100);
    // 새 답 하나(애드온이 그 메시지에도 붙임)
    const fresh = message(40); chat.append(fresh); addLate(fresh);
    eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, 40, 'normal'); advance(1000);
    const missing = chat.children.filter(m => !pinnedIn(m)).map(m => m.getAttribute('mesid'));
    assert.deepEqual(missing, [], `꺼내지 않은 메시지 ${missing.length}개: ${missing.slice(0, 8).join(',')}`);
});
await test('애드온 상태 사건 뒤에는 새 메시지를 기다리지 않고 채팅 전체를 훑어요', () => {
    freshChat(40);
    syncMesPins(false, [], false); syncMesPins(true, [LATE, 'mes_copy'], false); advance(1000);
    chat.children.forEach(addLate);
    win.dispatchEvent(new Event('bl:addons-state'));
    advance(1000);
    assert.ok(chat.children.every(pinnedIn), '모든 메시지에서 꺼냄');
});
await test('끄면 애드온 상태 사건 리스너도 떼요', () => {
    syncMesPins(false, [], false);
    freshChat(5); chat.children.forEach(addLate);
    visits = 0; win.dispatchEvent(new Event('bl:addons-state')); advance(1000);
    assert.equal(visits, 0);
    assert.equal([...listeners.values()].flat().length, 0);
});
console.log(`\n${passed} passed`);
