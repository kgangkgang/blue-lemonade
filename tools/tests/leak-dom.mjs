// 장시간 메모리 시험용 작은 가짜 브라우저 (jsdom 없이) — tools/tests/chat-switch-leak.mjs 가 쓴다.
//   요소 · 글 노드 · 선택자(태그 · #id · .class · [속성] · :not · :is · :has 얕게 · 자손 · 자식) · innerHTML 얕은 파서 · 사건 전파
//   MutationObserver(관찰 대상은 WeakRef — 브라우저처럼 관찰만으로 노드를 붙잡지 않는다) · ResizeObserver · IntersectionObserver(대상 WeakRef)
//   가상 시계(setTimeout · setInterval · requestAnimationFrame) · 실리태번 eventSource 흉내(등록 수를 센다)
//   목적은 「등록이 늘어나는지 · 옛 채팅 DOM 이 살아남는지」를 세는 것이라 그리기 · 크기는 모두 0 이에요.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
// 테마 파일(import.meta.url 기준 file: 주소)은 디스크에서 읽어 준다 — 설정 화면 HTML · manifest 같은 것. 그 밖은 404
function readLocal(url) { try { const s = String(url); if (!s.startsWith('file:')) return null; return fs.readFileSync(fileURLToPath(s.split(/[?#]/)[0]), 'utf8'); } catch { return null; } }
function response(text) { const ok = text !== null; const body = ok ? text : ''; return { ok, status: ok ? 200 : 404, json: async () => JSON.parse(body || '{}'), text: async () => body, blob: async () => new Blob([body]), arrayBuffer: async () => new TextEncoder().encode(body).buffer, headers: new Map(), clone() { return response(text); } }; }
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
export const stats = { listeners: new Map(), mo: new Set(), ro: new Set(), io: new Set(), intervals: new Map(), timers: new Map() };

// ── 가상 시계 ──
let now = 0, seq = 1;
const queue = new Map();   // id → { at, fn, every }
export const clock = {
    get now() { return now; },
    setTimeout(fn, ms = 0, ...args) { const id = seq++; queue.set(id, { at: now + Math.max(0, Number(ms) || 0), fn: () => fn(...args), every: 0 }); return id; },
    setInterval(fn, ms = 0, ...args) { const id = seq++; const every = Math.max(1, Number(ms) || 1); queue.set(id, { at: now + every, fn: () => fn(...args), every }); stats.intervals.set(id, every); return id; },
    clear(id) { queue.delete(id); stats.intervals.delete(id); },
    /** ms 만큼 시간을 보내며 그 사이 차례가 된 것을 모두 돌린다 (마이크로태스크도 사이사이) */
    async advance(ms) {
        const end = now + ms;
        for (let guard = 0; guard < 100000; guard++) {
            await flushMicro();
            let next = null;
            for (const [id, t] of queue) if (t.at <= end && (!next || t.at < next[1].at || (t.at === next[1].at && id < next[0]))) next = [id, t];
            if (!next) break;
            const [id, t] = next;
            now = Math.max(now, t.at);
            if (t.every) t.at = now + t.every; else queue.delete(id);
            try { t.fn(); } catch (error) { errors.push(error); }
        }
        now = end;
        await flushMicro();
    },
    pending: () => queue.size,
};
export const errors = [];
async function flushMicro() { for (let i = 0; i < 20; i++) await null; }

// ── 노드 ──
class EventTargetLite {
    constructor() { this._ls = null; }
    addEventListener(type, fn, opts) {
        if (!fn) return;
        const capture = typeof opts === 'boolean' ? opts : !!opts?.capture;
        this._ls ??= [];
        if (this._ls.some(l => l.type === type && l.fn === fn && l.capture === capture)) return;
        const entry = { type, fn, capture, once: !!opts?.once };
        this._ls.push(entry);
        if (opts?.signal) opts.signal.addEventListener?.('abort', () => this.removeEventListener(type, fn, opts));
        if (this._track) stats.listeners.set(this._track, (stats.listeners.get(this._track) || 0) + 1);
    }
    removeEventListener(type, fn, opts) {
        const capture = typeof opts === 'boolean' ? opts : !!opts?.capture;
        const i = this._ls?.findIndex(l => l.type === type && l.fn === fn && l.capture === capture) ?? -1;
        if (i < 0) return;
        this._ls.splice(i, 1);
        if (this._track) stats.listeners.set(this._track, stats.listeners.get(this._track) - 1);
    }
    dispatchEvent(event) {
        event.target ??= this;
        const path = []; for (let n = this; n; n = n.parentNode ?? (n === documentLite ? windowLite : null)) path.push(n);
        const run = (node, capture) => {
            for (const l of [...(node._ls || [])]) {
                if (l.type !== event.type || (capture !== null && l.capture !== capture)) continue;
                if (l.once) node.removeEventListener(l.type, l.fn, l.capture);
                event.currentTarget = node;
                try { typeof l.fn === 'function' ? l.fn.call(node, event) : l.fn.handleEvent(event); } catch (error) { errors.push(error); }
                if (event._stopNow) return;
            }
        };
        for (let i = path.length - 1; i > 0 && !event._stop; i--) run(path[i], true);
        if (!event._stop) run(this, null);
        if (event.bubbles) for (let i = 1; i < path.length && !event._stop; i++) run(path[i], false);
        return !event.defaultPrevented;
    }
}
class EventLite {
    constructor(type, init = {}) { this.type = type; this.bubbles = !!init.bubbles; this.cancelable = !!init.cancelable; this.detail = init.detail; this.defaultPrevented = false; Object.assign(this, init); }
    preventDefault() { this.defaultPrevented = true; }
    stopPropagation() { this._stop = true; }
    stopImmediatePropagation() { this._stop = true; this._stopNow = true; }
}

class NodeLite extends EventTargetLite {
    constructor(type) { super(); this.nodeType = type; this.parentNode = null; this.childNodes = []; }
    get ownerDocument() { return documentLite; }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === documentLite; }
    get firstChild() { return this.childNodes[0] ?? null; }
    get lastChild() { return this.childNodes.at(-1) ?? null; }
    get nextSibling() { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) + 1] ?? null : null; }
    get previousSibling() { const p = this.parentNode; return p ? p.childNodes[p.childNodes.indexOf(this) - 1] ?? null : null; }
    getRootNode() { let n = this; while (n.parentNode) n = n.parentNode; return n; }
    contains(node) { for (let n = node; n; n = n.parentNode) if (n === this) return true; return false; }
    hasChildNodes() { return this.childNodes.length > 0; }
    _adopt(nodes) { const out = []; queueMicrotask(() => { for (const n of out) if (n.localName === 'link' || n.localName === 'script') { try { n.onload?.(new EventLite('load')); n.dispatchEvent(new EventLite('load')); } catch (error) { errors.push(error); } } }); for (const n of nodes) { if (n == null) continue; const node = typeof n === 'string' || typeof n === 'number' ? new TextLite(String(n)) : n; if (node.nodeType === 11) { out.push(...node.childNodes); node.childNodes.length = 0; } else out.push(node); } return out; }
    insertBefore(node, ref) { const nodes = this._adopt([node]); for (const n of nodes) { n.parentNode?._detach(n); n.parentNode = this; const i = ref ? this.childNodes.indexOf(ref) : -1; if (i < 0) this.childNodes.push(n); else this.childNodes.splice(i, 0, n); } mutated(this, 'childList', { addedNodes: nodes, removedNodes: [] }); return node; }
    appendChild(node) { return this.insertBefore(node, null); }
    append(...nodes) { const list = this._adopt(nodes); for (const n of list) { n.parentNode?._detach(n); n.parentNode = this; this.childNodes.push(n); } if (list.length) mutated(this, 'childList', { addedNodes: list, removedNodes: [] }); }
    prepend(...nodes) { const list = this._adopt(nodes); for (const n of list.reverse()) { n.parentNode?._detach(n); n.parentNode = this; this.childNodes.unshift(n); } if (list.length) mutated(this, 'childList', { addedNodes: list, removedNodes: [] }); }
    _detach(n) { const i = this.childNodes.indexOf(n); if (i >= 0) { this.childNodes.splice(i, 1); n.parentNode = null; mutated(this, 'childList', { addedNodes: [], removedNodes: [n] }); } }
    removeChild(n) { this._detach(n); return n; }
    replaceChild(next, old) { this.insertBefore(next, old); this._detach(old); return old; }
    remove() { this.parentNode?._detach(this); }
    before(...nodes) { const p = this.parentNode; if (!p) return; for (const n of this._adopt(nodes)) p.insertBefore(n, this); }
    after(...nodes) { const p = this.parentNode; if (!p) return; let ref = this.nextSibling; for (const n of this._adopt(nodes)) p.insertBefore(n, ref); }
    replaceWith(...nodes) { const p = this.parentNode; if (!p) return; this.before(...nodes); this.remove(); }
    replaceChildren(...nodes) { const old = [...this.childNodes]; for (const n of old) n.parentNode = null; this.childNodes = []; if (old.length) mutated(this, 'childList', { addedNodes: [], removedNodes: old }); this.append(...nodes); }
    get textContent() { return this.nodeType === 3 ? this.data : this.childNodes.map(n => n.textContent).join(''); }
    set textContent(v) { if (this.nodeType === 3) { this.data = String(v); return; } this.replaceChildren(...(v === '' || v == null ? [] : [new TextLite(String(v))])); }
    cloneNode(deep) { const c = this.nodeType === 3 ? new TextLite(this.data) : this.nodeType === 11 ? new FragmentLite() : new ElementLite(this.localName); if (this.attrs) c.attrs = new Map(this.attrs); if (deep) c.append(...this.childNodes.map(n => n.cloneNode(true))); return c; }
    compareDocumentPosition(other) { const a = order(this), b = order(other); return a < b ? 4 : a > b ? 2 : 0; }
}
function order(node) { const list = []; (function walk(n) { list.push(n); n.childNodes.forEach(walk); })(node.getRootNode()); return list.indexOf(node); }
class TextLite extends NodeLite {
    constructor(data) { super(3); this._data = data; this.nodeName = '#text'; }
    get data() { return this._data; } set data(v) { this._data = String(v); mutated(this, 'characterData', {}); }
    get nodeValue() { return this._data; } set nodeValue(v) { this.data = v; }
    get length() { return this._data.length; }
}
class CommentLite extends NodeLite { constructor(data) { super(8); this.data = data; this.nodeName = '#comment'; } get textContent() { return ''; } }
class FragmentLite extends NodeLite { constructor() { super(11); this.nodeName = '#document-fragment'; } querySelector(s) { return qsa(this, s)[0] ?? null; } querySelectorAll(s) { return qsa(this, s); } get children() { return this.childNodes.filter(n => n.nodeType === 1); } }

const styleOf = el => new Proxy({}, {
    get(t, k) {
        const map = el._style ??= new Map();
        if (k === 'setProperty') return (name, value) => { map.set(name, String(value)); };
        if (k === 'getPropertyValue') return name => map.get(name) ?? '';
        if (k === 'removeProperty') return name => { const v = map.get(name) ?? ''; map.delete(name); return v; };
        if (k === 'cssText') return [...map].map(([a, b]) => `${a}: ${b}`).join('; ');
        if (k === 'length') return map.size;
        if (typeof k !== 'string') return undefined;
        return map.get(k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())) ?? '';
    },
    set(t, k, v) { const map = el._style ??= new Map(); if (k === 'cssText') { map.clear(); for (const part of String(v).split(';')) { const [a, ...b] = part.split(':'); if (a?.trim()) map.set(a.trim(), b.join(':').trim()); } } else map.set(String(k).replace(/[A-Z]/g, m => '-' + m.toLowerCase()), String(v)); return true; },
});
class ElementLite extends NodeLite {
    constructor(tag) { super(1); this.localName = String(tag).toLowerCase(); this.attrs = new Map(); }
    get tagName() { return this.localName.toUpperCase(); } get nodeName() { return this.tagName; }
    get children() { return this.childNodes.filter(n => n.nodeType === 1); }
    get childElementCount() { return this.children.length; }
    get firstElementChild() { return this.children[0] ?? null; } get lastElementChild() { return this.children.at(-1) ?? null; }
    get nextElementSibling() { let n = this.nextSibling; while (n && n.nodeType !== 1) n = n.nextSibling; return n; }
    get previousElementSibling() { let n = this.previousSibling; while (n && n.nodeType !== 1) n = n.previousSibling; return n; }
    getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; }
    setAttribute(n, v) { const old = this.getAttribute(n); this.attrs.set(n, String(v)); mutated(this, 'attributes', { attributeName: n, oldValue: old }); }
    removeAttribute(n) { if (!this.attrs.has(n)) return; const old = this.attrs.get(n); this.attrs.delete(n); mutated(this, 'attributes', { attributeName: n, oldValue: old }); }
    hasAttribute(n) { return this.attrs.has(n); }
    toggleAttribute(n, force) { const on = force ?? !this.attrs.has(n); if (on) { if (!this.attrs.has(n)) this.setAttribute(n, ''); } else this.removeAttribute(n); return on; }
    getAttributeNames() { return [...this.attrs.keys()]; }
    get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
    get id() { return this.getAttribute('id') ?? ''; } set id(v) { this.setAttribute('id', v); }
    get className() { return this.getAttribute('class') ?? ''; } set className(v) { this.setAttribute('class', v); }
    get classList() {
        const el = this, list = () => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean), write = l => el.setAttribute('class', l.join(' '));
        return { contains: c => list().includes(c), add: (...cs) => { const l = list(); let ch = false; for (const c of cs) if (!l.includes(c)) { l.push(c); ch = true; } if (ch) write(l); }, remove: (...cs) => { const l = list(); const n = l.filter(c => !cs.includes(c)); if (n.length !== l.length) write(n); },
            toggle: (c, force) => { const has = list().includes(c); const want = force ?? !has; if (want && !has) write([...list(), c]); else if (!want && has) write(list().filter(x => x !== c)); return want; }, replace: (a, b) => { const l = list(); const i = l.indexOf(a); if (i < 0) return false; l[i] = b; write(l); return true; },
            get length() { return list().length; }, item: i => list()[i] ?? null, [Symbol.iterator]: () => list()[Symbol.iterator](), forEach: fn => list().forEach(fn), get value() { return list().join(' '); } };
    }
    get dataset() { const el = this; const key = k => 'data-' + String(k).replace(/[A-Z]/g, m => '-' + m.toLowerCase()); return new Proxy({}, { get: (t, k) => typeof k === 'string' ? el.getAttribute(key(k)) ?? undefined : undefined, set: (t, k, v) => { el.setAttribute(key(k), v); return true; }, deleteProperty: (t, k) => { el.removeAttribute(key(k)); return true; }, has: (t, k) => el.hasAttribute(key(k)), ownKeys: () => el.getAttributeNames().filter(n => n.startsWith('data-')).map(n => n.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())), getOwnPropertyDescriptor: (t, k) => el.hasAttribute(key(k)) ? { enumerable: true, configurable: true, value: el.getAttribute(key(k)) } : undefined }); }
    get style() { return this._styleProxy ??= styleOf(this); }
    get hidden() { return this.hasAttribute('hidden'); } set hidden(v) { this.toggleAttribute('hidden', !!v); }
    get title() { return this.getAttribute('title') ?? ''; } set title(v) { this.setAttribute('title', v); }
    get type() { return this.getAttribute('type') ?? ''; } set type(v) { this.setAttribute('type', v); }
    get src() { return this.getAttribute('src') ?? ''; } set src(v) { this.setAttribute('src', v); }
    get currentSrc() { return this.src; }
    get href() { return this.getAttribute('href') ?? ''; } set href(v) { this.setAttribute('href', v); }
    get name() { return this.getAttribute('name') ?? ''; } set name(v) { this.setAttribute('name', v); }
    get value() { return this._value ?? this.getAttribute('value') ?? ''; } set value(v) { this._value = String(v); }
    get checked() { return !!this._checked; } set checked(v) { this._checked = !!v; }
    get disabled() { return this.hasAttribute('disabled'); } set disabled(v) { this.toggleAttribute('disabled', !!v); }
    get open() { return this.hasAttribute('open'); } set open(v) { this.toggleAttribute('open', !!v); }
    get tabIndex() { return Number(this.getAttribute('tabindex') ?? -1); } set tabIndex(v) { this.setAttribute('tabindex', v); }
    get complete() { return true; } get naturalWidth() { return 0; } get naturalHeight() { return 0; }
    get offsetWidth() { return 0; } get offsetHeight() { return 0; } get clientWidth() { return 0; } get clientHeight() { return 0; } get scrollWidth() { return 0; } get scrollHeight() { return 0; }
    get offsetTop() { return 0; } get offsetLeft() { return 0; } get offsetParent() { return null; }
    scrollTop = 0; scrollLeft = 0;
    getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }; }
    getClientRects() { return []; }
    checkVisibility() { return false; }
    scrollIntoView() {} scrollTo() {} scrollBy() {} focus() {} blur() {} click() { this.dispatchEvent(new EventLite('click', { bubbles: true })); }
    showModal() { this.setAttribute('open', ''); } show() { this.setAttribute('open', ''); } close() { if (!this.open) return; this.removeAttribute('open'); this.dispatchEvent(new EventLite('close')); }
    animate() { return { finished: Promise.resolve(), cancel() {}, onfinish: null, addEventListener() {} }; }
    getAnimations() { return []; }
    attachShadow() { const f = new FragmentLite(); this.shadowRoot = f; return f; }
    matches(sel) { return matchesSel(this, sel); }
    closest(sel) { for (let n = this; n && n.nodeType === 1; n = n.parentNode) if (matchesSel(n, sel)) return n; return null; }
    querySelector(sel) { return qsa(this, sel)[0] ?? null; }
    querySelectorAll(sel) { return qsa(this, sel); }
    getElementsByTagName(t) { return live(this, t); } getElementsByClassName(c) { return live(this, '.' + c.trim().split(/\s+/).join('.')); }
    get innerHTML() { return this.childNodes.map(serialize).join(''); }
    set innerHTML(html) { this.replaceChildren(...parseHtml(String(html))); }
    get outerHTML() { return serialize(this); }
    get innerText() { return this.textContent; } set innerText(v) { this.textContent = v; }
    insertAdjacentHTML(pos, html) { const nodes = parseHtml(String(html)); this._insertAt(pos, nodes); }
    insertAdjacentElement(pos, el) { this._insertAt(pos, [el]); return el; }
    insertAdjacentText(pos, text) { this._insertAt(pos, [new TextLite(text)]); }
    _insertAt(pos, nodes) { const p = String(pos).toLowerCase(); if (p === 'beforebegin') this.before(...nodes); else if (p === 'afterend') this.after(...nodes); else if (p === 'afterbegin') this.prepend(...nodes); else this.append(...nodes); }
    getContext() { return canvasContext(); }
    toDataURL() { return 'data:image/png;base64,'; }
    decode() { return Promise.resolve(); }
    pause() {} play() { return Promise.resolve(); } load() {}
    setPointerCapture() {} releasePointerCapture() {} hasPointerCapture() { return false; }
    get sheet() { return this.localName === 'style' ? { cssRules: [], insertRule() { return 0; }, deleteRule() {} } : null; }
    get content() { return this._content ??= new FragmentLite(); }
    get form() { return this.closest('form'); }
    get options() { return qsa(this, 'option'); } get selectedIndex() { return 0; }
    select() {} setSelectionRange() {} get selectionStart() { return this.value.length; } get selectionEnd() { return this.value.length; }
}
function canvasContext() { return new Proxy({}, { get: (t, k) => k === 'measureText' ? (s => ({ width: String(s).length * 7, actualBoundingBoxAscent: 7, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 })) : k === 'getImageData' ? (() => ({ data: new Uint8ClampedArray(4) })) : k === 'canvas' ? { width: 1, height: 1 } : (() => {}), set: () => true }); }
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function serialize(n) { if (n.nodeType === 3) return escapeHtml(n.data); if (n.nodeType === 8) return `<!--${n.data}-->`; if (n.nodeType === 11) return n.childNodes.map(serialize).join(''); const attrs = [...n.attrs].map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join(''); return VOID.has(n.localName) ? `<${n.localName}${attrs}>` : `<${n.localName}${attrs}>${n.childNodes.map(serialize).join('')}</${n.localName}>`; }
const decode = s => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' })[e]);
export function parseHtml(html) {
    const root = new FragmentLite(); const stack = [root];
    const re = /<!--([\s\S]*?)-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+|<)/g;
    for (const m of html.matchAll(re)) {
        const top = stack.at(-1);
        if (m[1] !== undefined) top.childNodes.push(Object.assign(new CommentLite(m[1]), { parentNode: top }));
        else if (m[2]) { const tag = m[2].toLowerCase(); for (let i = stack.length - 1; i > 0; i--) if (stack[i].localName === tag) { stack.length = i; break; } }
        else if (m[3]) {
            const el = new ElementLite(m[3]);
            for (const a of (m[4] || '').matchAll(/([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) el.attrs.set(a[1].toLowerCase(), decode(a[2] ?? a[3] ?? a[4] ?? ''));
            el.parentNode = top; top.childNodes.push(el);
            if (!m[5] && !VOID.has(el.localName)) stack.push(el);
        } else if (m[6]) top.childNodes.push(Object.assign(new TextLite(decode(m[6])), { parentNode: top }));
    }
    const out = root.childNodes.slice(); for (const n of out) n.parentNode = null; return out;
}

// ── 선택자 (얕게) ──
const selCache = new Map();
function splitTop(s, ch) { const out = []; let depth = 0, quote = null, cur = ''; for (const c of s) { if (quote) { if (c === quote) quote = null; cur += c; continue; } if (c === '"' || c === "'") { quote = c; cur += c; continue; } if (c === '(' || c === '[') depth++; if (c === ')' || c === ']') depth--; if (c === ch && depth === 0) { out.push(cur); cur = ''; continue; } cur += c; } out.push(cur); return out.map(x => x.trim()).filter(x => x !== ''); }
function parseComplex(s) {
    // 조합자(' ' · '>' · '+' · '~')로 자른다
    const parts = []; let depth = 0, quote = null, cur = '';
    const push = comb => { if (cur.trim()) parts.push({ sel: cur.trim(), comb }); cur = ''; };
    let pendingComb = ' ';
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (quote) { if (c === quote) quote = null; cur += c; continue; }
        if (c === '"' || c === "'") { quote = c; cur += c; continue; }
        if (c === '(' || c === '[') depth++;
        if (c === ')' || c === ']') depth--;
        if (depth === 0 && (c === '>' || c === '+' || c === '~' || /\s/.test(c))) {
            if (cur.trim()) { parts.push({ sel: cur.trim(), comb: pendingComb }); cur = ''; pendingComb = ' '; }
            if (c !== ' ' && !/\s/.test(c)) pendingComb = c;
            continue;
        }
        cur += c;
    }
    push(pendingComb);
    return parts;
}
function compile(sel) {
    if (selCache.has(sel)) return selCache.get(sel);
    const list = splitTop(sel, ',').map(parseComplex);
    selCache.set(sel, list);
    return list;
}
function matchCompound(el, c, scope) {
    if (!el || el.nodeType !== 1) return false;
    let s = c;
    const tag = /^([a-zA-Z][\w-]*|\*)/.exec(s);
    if (tag) { if (tag[1] !== '*' && el.localName !== tag[1].toLowerCase()) return false; s = s.slice(tag[1].length); }
    while (s) {
        let m;
        if ((m = /^#([\w-]+)/.exec(s))) { if (el.id !== m[1]) return false; }
        else if ((m = /^\.([\w-]+)/.exec(s))) { if (!el.classList.contains(m[1])) return false; }
        else if ((m = /^\[\s*([\w:-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]+)))?\s*(?:i)?\s*\]/.exec(s))) {
            const v = el.getAttribute(m[1]); if (v === null) return false;
            const want = m[3] ?? m[4] ?? m[5];
            if (m[2] === '=' && v !== want) return false; if (m[2] === '^=' && !v.startsWith(want)) return false; if (m[2] === '$=' && !v.endsWith(want)) return false;
            if (m[2] === '*=' && !v.includes(want)) return false; if (m[2] === '~=' && !v.split(/\s+/).includes(want)) return false; if (m[2] === '|=' && v !== want && !v.startsWith(want + '-')) return false;
        } else if ((m = /^:(not|is|where|has)\(/.exec(s))) {
            let depth = 1, i = m[0].length; for (; i < s.length && depth; i++) { if (s[i] === '(') depth++; if (s[i] === ')') depth--; }
            const inner = s.slice(m[0].length, i - 1);
            const r = m[1] === 'has' ? splitTop(inner, ',').some(x => qsa(el, x.replace(/^>\s*/, ':scope > ')).length > 0) : matchesSel(el, inner, scope);
            if (m[1] === 'not' ? r : !r) return false;
            s = s.slice(i); continue;
        } else if ((m = /^:scope/.exec(s))) { if (el !== scope) return false; }
        else if ((m = /^:(first-child|last-child|only-child|first-of-type|last-of-type|empty|checked|disabled|enabled|focus|focus-within|focus-visible|hover|active|visited|link|root|defined|open|modal|popover-open|placeholder-shown|nth-child\([^)]*\)|nth-of-type\([^)]*\)|nth-last-child\([^)]*\))/.exec(s))) {
            const p = el.parentElement, sibs = p ? p.children : [el];
            const k = m[1];
            if (k === 'first-child' && sibs[0] !== el) return false; if (k === 'last-child' && sibs.at(-1) !== el) return false; if (k === 'only-child' && sibs.length !== 1) return false;
            if (k === 'first-of-type' && sibs.find(x => x.localName === el.localName) !== el) return false; if (k === 'last-of-type' && sibs.filter(x => x.localName === el.localName).at(-1) !== el) return false;
            if (k === 'empty' && el.childNodes.length) return false; if (k === 'checked' && !el.checked) return false; if (k === 'disabled' && !el.disabled) return false;
            if (k === 'root' && el !== documentLite.documentElement) return false; if (k === 'open' && !el.open) return false;
            if (/^(focus|hover|active|visited|focus-within|focus-visible|modal|popover-open|placeholder-shown)$/.test(k)) return false;
        } else if ((m = /^::?[\w-]+(\([^)]*\))?/.exec(s))) { return false; }   // 모르는 가상 클래스 · 요소 — 맞지 않음
        else throw new SyntaxError('selector: ' + c);
        s = s.slice(m[0].length);
    }
    return true;
}
function matchComplex(el, parts, scope) {
    const last = parts.length - 1;
    if (!matchCompound(el, parts[last].sel, scope)) return false;
    const up = (node, i) => {
        if (i < 0) return true;
        const comb = parts[i + 1].comb;
        if (comb === '>') { const p = node.parentElement; return !!p && matchCompound(p, parts[i].sel, scope) && up(p, i - 1); }
        if (comb === '+') { const p = node.previousElementSibling; return !!p && matchCompound(p, parts[i].sel, scope) && up(p, i - 1); }
        if (comb === '~') { for (let p = node.previousElementSibling; p; p = p.previousElementSibling) if (matchCompound(p, parts[i].sel, scope) && up(p, i - 1)) return true; return false; }
        for (let p = node.parentElement; p; p = p.parentElement) if (matchCompound(p, parts[i].sel, scope) && up(p, i - 1)) return true;
        return false;
    };
    return up(el, last - 1);
}
function matchesSel(el, sel, scope = null) { return compile(sel).some(parts => matchComplex(el, parts, scope)); }
/** 살아 있는 목록 (HTMLCollection 처럼 읽을 때마다 다시 찾음) */
function live(root, sel) { return new Proxy([], { get(t, k) { const now = qsa(root, sel); if (k === 'item') return i => now[i] ?? null; const v = now[k]; return typeof v === 'function' ? v.bind(now) : v; }, has(t, k) { return k in qsa(root, sel); } }); }
function qsa(root, sel) { const out = []; const list = compile(sel); (function walk(n) { for (const c of n.childNodes) { if (c.nodeType === 1) { if (list.some(parts => matchComplex(c, parts, root))) out.push(c); walk(c); } else if (c.nodeType === 11) walk(c); } })(root); return out; }

// ── 관찰자 ──
// 브라우저처럼: 등록은 관찰 대상 노드가 들고(노드 → 등록 → 관찰자), 관찰자 쪽은 대상을 약하게만 안다.
//   그래서 떨어진 노드와 그 노드만 보는 관찰자는 함께 수거된다. 아래 목록은 세기용 WeakRef 뿐이다.
const registrations = new Set();   // WeakRef<{ observer, target: WeakRef, options }>
function mutated(target, type, extra) {
    for (let n = target; n; n = n.parentNode) {
        if (!n._regs) continue;
        for (const r of n._regs) {
            if (n !== target && !r.options.subtree) continue;
            if (type === 'childList' && !r.options.childList) continue;
            if (type === 'attributes' && !(r.options.attributes || r.options.attributeFilter)) continue;
            if (type === 'attributes' && r.options.attributeFilter && !r.options.attributeFilter.includes(extra.attributeName)) continue;
            if (type === 'characterData' && !r.options.characterData) continue;
            r.observer._queue({ type, target, addedNodes: [], removedNodes: [], attributeName: null, oldValue: null, ...extra });
        }
    }
}
function* liveRegistrations() { for (const ref of registrations) { const r = ref.deref(); if (!r) { registrations.delete(ref); continue; } const t = r.target.deref(); if (!t || !t._regs?.includes(r)) { registrations.delete(ref); continue; } yield [r, t]; } }
class MutationObserverLite {
    constructor(cb) { this.cb = cb; this.records = []; this.scheduled = false; this.targets = new Set(); if (process.env.LEAK_TRACE) this.origin = new Error().stack.split('\n').slice(2, 5).join(' | '); }
    observe(target, options = {}) {
        if (!target) throw new TypeError('observe: no target');
        target._regs ??= [];
        const existing = target._regs.find(r => r.observer === this);
        if (existing) { existing.options = options; return; }
        const reg = { observer: this, target: new WeakRef(target), options };
        target._regs.push(reg);
        this.targets.add(reg.target);
        registrations.add(new WeakRef(reg));
    }
    disconnect() { for (const ref of this.targets) { const t = ref.deref(); if (t?._regs) t._regs = t._regs.filter(r => r.observer !== this); } this.targets.clear(); this.records = []; }
    takeRecords() { const r = this.records; this.records = []; return r; }
    _queue(rec) { this.records.push(rec); if (this.scheduled) return; this.scheduled = true; queueMicrotask(() => { this.scheduled = false; const r = this.takeRecords(); if (r.length) { try { this.cb(r, this); } catch (error) { errors.push(error); } } }); }
}
class TargetObserver {
    // 대상 요소가 관찰자를 들고(요소 → 관찰자), 관찰자는 대상을 약하게만 안다 (크롬 ResizeObserver · IntersectionObserver 와 같은 방향)
    constructor(cb, kind) { this.cb = cb; this.targets = new Set(); this.kind = kind; stats[kind].add(new WeakRef(this)); if (process.env.LEAK_TRACE) this.origin = new Error().stack.split('\n').slice(2, 5).join(' | '); }
    observe(el) { if (![...this.targets].some(r => r.deref() === el)) { this.targets.add(new WeakRef(el)); (el._watchers ??= new Set()).add(this); } }
    unobserve(el) { for (const r of this.targets) if (r.deref() === el) this.targets.delete(r); el?._watchers?.delete(this); }
    disconnect() { for (const r of this.targets) r.deref()?._watchers?.delete(this); this.targets.clear(); }
    takeRecords() { return []; }
}
function* liveObservers(kind) { for (const ref of stats[kind]) { const o = ref.deref(); if (!o) { stats[kind].delete(ref); continue; } yield o; } }
class ResizeObserverLite extends TargetObserver { constructor(cb) { super(cb, 'ro'); } }
class IntersectionObserverLite extends TargetObserver { constructor(cb, opts) { super(cb, 'io'); this.root = opts?.root ?? null; this.rootMargin = opts?.rootMargin ?? '0px'; this.thresholds = [0]; } }

/** 떨어진 노드를 아직 보는 관찰자 (LEAK_TRACE=1 이면 만든 자리도) — 원인 찾기용 */
export function detachedObserved() {
    const desc = t => `${t.localName}${t.id ? '#' + t.id : ''}${t.className ? '.' + String(t.className).trim().split(/\s+/).join('.') : ''}`;
    const out = [];
    for (const kind of ['ro', 'io']) for (const o of liveObservers(kind)) for (const ref of o.targets) { const t = ref.deref(); if (t && !t.isConnected) out.push({ kind, target: desc(t), origin: o.origin || '' }); }
    for (const [r, t] of liveRegistrations()) if (!t.isConnected) out.push({ kind: 'mo', target: desc(t), origin: r.observer.origin || '' });
    return out;
}
/** 지금 살아 있는 관찰 — { mo: 붙은 등록 수, moDetached: 떨어진(아직 수거 안 된) 노드를 보는 등록, ro/io: 보는 대상(연결 · 떨어짐) } */
export function observerCounts() {
    let mo = 0, moDetached = 0; for (const [, t] of liveRegistrations()) { if (t.isConnected) mo++; else moDetached++; }
    const count = kind => { let on = 0, off = 0; for (const o of liveObservers(kind)) for (const ref of o.targets) { const t = ref.deref(); if (!t) continue; if (t.isConnected) on++; else off++; } return { on, off }; };
    return { mo, moDetached, ro: count('ro'), io: count('io') };
}

// ── 문서 · 창 ──
class DocumentLite extends NodeLite {
    constructor() { super(9); this.nodeName = '#document'; }
    createElement(tag) { return new ElementLite(tag); }
    createElementNS(ns, tag) { return new ElementLite(tag); }
    createTextNode(t) { return new TextLite(String(t)); }
    createComment(t) { return new CommentLite(String(t)); }
    createDocumentFragment() { return new FragmentLite(); }
    createRange() { return { setStart() {}, setEnd() {}, selectNodeContents() {}, collapse() {}, getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }), getClientRects: () => [], cloneContents: () => new FragmentLite(), toString: () => '' }; }
    createTreeWalker(root, what = 0xffffffff, filter = null) {
        const list = []; (function walk(n) { for (const c of n.childNodes) { const ok = (c.nodeType === 1 && what & 1) || (c.nodeType === 3 && what & 4); let verdict = 1; if (ok && filter) verdict = typeof filter === 'function' ? filter(c) : filter.acceptNode(c); if (ok && verdict === 1) list.push(c); if (verdict !== 2) walk(c); } })(root);
        let i = -1; return { root, get currentNode() { return list[i] ?? root; }, nextNode: () => list[++i] ?? null, previousNode: () => list[--i] ?? null };
    }
    get documentElement() { return this.childNodes[0]; }
    get head() { return this.documentElement.childNodes[0]; }
    get body() { return this.documentElement.childNodes[1]; }
    getElementById(id) { return qsa(this, '#' + CSS_escape(id))[0] ?? null; }
    querySelector(s) { return qsa(this, s)[0] ?? null; }
    querySelectorAll(s) { return qsa(this, s); }
    getElementsByTagName(t) { return live(this, t); }
    getElementsByClassName(c) { return live(this, '.' + c.trim().split(/\s+/).join('.')); }
    get defaultView() { return globalThis; }
    get activeElement() { return this.body; }
    get readyState() { return 'complete'; }
    get visibilityState() { return this._hiddenTab ? 'hidden' : 'visible'; } get hidden() { return !!this._hiddenTab; }
    hasFocus() { return true; }
    get styleSheets() { return []; }
    get fonts() { return { check: () => true, load: () => Promise.resolve([]), ready: Promise.resolve(), addEventListener() {}, removeEventListener() {}, add() {}, delete() {}, [Symbol.iterator]: function* () {} }; }
    getSelection() { return windowLite.getSelection(); }
    elementFromPoint() { return null; } elementsFromPoint() { return []; }
    execCommand() { return false; }
    adoptedStyleSheets = [];
}
const CSS_escape = s => String(s).replace(/([^\w-])/g, '\\$1');
export const documentLite = new DocumentLite();
const html = new ElementLite('html'); html.parentNode = documentLite; documentLite.childNodes.push(html);
html.append(new ElementLite('head'), new ElementLite('body'));
documentLite._track = 'document';
export const windowLite = globalThis;

const storage = () => { const m = new Map(); return { getItem: k => m.has(String(k)) ? m.get(String(k)) : null, setItem: (k, v) => m.set(String(k), String(v)), removeItem: k => m.delete(String(k)), clear: () => m.clear(), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } }; };

/** 전역에 가짜 브라우저를 깐다. 실리태번 흉내 ctx 를 돌려준다 */
export function installBrowser({ settings = {}, extensionSettings = {} } = {}) {
    const g = globalThis;
    const winListeners = new EventTargetLite(); winListeners._track = 'window';
    Object.assign(g, {
        window: g, self: g, document: documentLite, Document: DocumentLite, Node: NodeLite, Element: ElementLite, HTMLElement: ElementLite, Text: TextLite, DocumentFragment: FragmentLite, Comment: CommentLite,
        HTMLImageElement: ElementLite, HTMLDialogElement: ElementLite, HTMLInputElement: ElementLite, HTMLTextAreaElement: ElementLite, HTMLSelectElement: ElementLite, HTMLScriptElement: ElementLite, HTMLCanvasElement: ElementLite, HTMLAnchorElement: ElementLite, HTMLButtonElement: ElementLite, HTMLStyleElement: ElementLite, SVGElement: ElementLite, HTMLVideoElement: ElementLite, HTMLAudioElement: ElementLite,
        Event: EventLite, CustomEvent: EventLite, KeyboardEvent: EventLite, PointerEvent: EventLite, MouseEvent: EventLite, InputEvent: EventLite, FocusEvent: EventLite, TouchEvent: EventLite, WheelEvent: EventLite, EventTarget: EventTargetLite,
        MutationObserver: MutationObserverLite, ResizeObserver: ResizeObserverLite, IntersectionObserver: IntersectionObserverLite,
        NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4, SHOW_ALL: 0xffffffff, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 },
        setTimeout: clock.setTimeout, clearTimeout: clock.clear, setInterval: clock.setInterval, clearInterval: clock.clear,
        requestAnimationFrame: fn => clock.setTimeout(() => fn(clock.now), 16), cancelAnimationFrame: clock.clear,
        requestIdleCallback: fn => clock.setTimeout(() => fn({ timeRemaining: () => 10, didTimeout: false }), 30), cancelIdleCallback: clock.clear,
        getComputedStyle: el => new Proxy({}, { get: (t, k) => k === 'getPropertyValue' ? (n => el?._style?.get(n) ?? '') : k === 'display' ? (el?.hidden ? 'none' : 'block') : k === 'visibility' ? 'visible' : k === 'fontSize' ? '16px' : k === 'lineHeight' ? 'normal' : typeof k === 'string' ? (el?._style?.get(k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())) ?? '') : undefined }),
        matchMedia: q => ({ media: q, matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null }),
        localStorage: storage(), sessionStorage: storage(),
        innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, scrollY: 0, scrollX: 0, visualViewport: null,
        getSelection: () => ({ rangeCount: 0, isCollapsed: true, toString: () => '', removeAllRanges() {}, addRange() {}, getRangeAt: () => documentLite.createRange(), anchorNode: null, focusNode: null, containsNode: () => false, collapse() {} }),
        scrollTo() {}, scrollBy() {}, focus() {}, open() { return null; },
        location: { href: 'http://127.0.0.1:8000/', origin: 'http://127.0.0.1:8000', pathname: '/', search: '', hash: '', host: '127.0.0.1:8000', hostname: '127.0.0.1', protocol: 'http:', reload() {} },
        fetch: input => Promise.resolve(response(readLocal(input?.url ?? input))),
        Image: class extends ElementLite { constructor() { super('img'); } },
        Audio: class extends ElementLite { constructor() { super('audio'); } },
        CSS: { escape: CSS_escape, supports: () => true, highlights: undefined },
        toastr: { info() {}, success() {}, warning() {}, error() {}, clear() {}, remove() {} },
        DOMParser: class { parseFromString(s) { const d = new FragmentLite(); d.append(...parseHtml(s)); return { body: d, documentElement: d, querySelector: x => d.querySelector(x), querySelectorAll: x => d.querySelectorAll(x) }; } },
        XMLSerializer: class { serializeToString(n) { return serialize(n); } },
        Path2D: class {}, OffscreenCanvas: undefined, createImageBitmap: undefined, Worker: undefined, BroadcastChannel: undefined,
        FontFace: class { constructor(f) { this.family = f; this.status = 'loaded'; } load() { return Promise.resolve(this); } },
        getStringHash: s => s.length,
    });
    try { Object.defineProperty(g, 'navigator', { configurable: true, value: { userAgent: 'leak-test', platform: 'Win32', maxTouchPoints: 0, language: 'ko-KR', languages: ['ko-KR'], clipboard: { writeText: async () => {} }, onLine: true, standalone: false, hardwareConcurrency: 4, deviceMemory: 8, vibrate() {} } }); } catch { /* 이미 있음 */ }
    try { Object.defineProperty(g, 'performance', { configurable: true, value: { now: () => clock.now, mark() {}, measure() {}, getEntriesByType: () => [], getEntriesByName: () => [], setResourceTimingBufferSize() {}, timeOrigin: 0 } }); } catch { /* 없음 */ }
    g.addEventListener = winListeners.addEventListener.bind(winListeners);
    g.removeEventListener = winListeners.removeEventListener.bind(winListeners);
    g.dispatchEvent = e => { e.target ??= g; winListeners.dispatchEvent(e); return true; };
    windowListenerHost = winListeners;
    // 실리태번 화면 뼈대 (테마가 찾는 자리)
    const body = documentLite.body;
    const el = (tag, id, cls) => { const e = new ElementLite(tag); if (id) e.setAttribute('id', id); if (cls) e.setAttribute('class', cls); return e; };
    const sheld = el('div', 'sheld'); const chat = el('div', 'chat'); const form = el('form', 'send_form'); const ta = el('textarea', 'send_textarea');
    form.append(ta, el('div', 'send_but'), el('div', 'mes_stop'), el('div', 'options_button'), el('div', 'extensionsMenuButton'));
    const formSheld = el('div', 'form_sheld'); formSheld.append(form);
    sheld.append(chat, formSheld);
    body.append(el('div', 'top-bar'), el('div', 'top-settings-holder'), el('div', 'left-nav-panel'), el('div', 'right-nav-panel'), sheld,
        el('div', 'extensions_settings'), el('div', 'extensions_settings2'), el('div', 'extensionsMenu'), el('div', 'movingDivs'), el('div', 'WorldInfo'), el('template', 'entry_edit_template'), el('div', 'character_popup'));
    // 목록 뿌리 (캐릭터 · 페르소나 · 월드인포 항목 · 프롬프트 관리자) 와 실리태번이 복제하는 캐릭터 틀
    const charTemplate = el('div', 'character_template'); charTemplate.innerHTML = '<div class="character_select entity_block"><div class="avatar"><img loading="lazy" src="" alt=""></div><span class="ch_name"></span></div>';
    const wi = documentLite.getElementById('WorldInfo'); wi.append(el('div', 'world_popup_entries_list'));
    const pm = el('div', 'completion_prompt_manager'); pm.append(el('ul', 'completion_prompt_manager_list'));
    body.append(el('div', 'rm_print_characters_block'), el('div', 'user_avatar_block'), charTemplate, pm, el('input', 'character_search_bar'));
    // 실리태번 eventSource 흉내
    const handlers = new Map();
    const eventSource = {
        on(type, fn) { if (!type) return; (handlers.get(type) || handlers.set(type, []).get(type)).push(fn); },
        once(type, fn) { const w = (...a) => { this.removeListener(type, w); return fn(...a); }; this.on(type, w); },
        makeFirst(type, fn) { (handlers.get(type) || handlers.set(type, []).get(type)).unshift(fn); },
        makeLast(type, fn) { this.on(type, fn); },
        removeListener(type, fn) { const list = handlers.get(type); const i = list?.indexOf(fn) ?? -1; if (i >= 0) list.splice(i, 1); },
        off(type, fn) { this.removeListener(type, fn); },
        async emit(type, ...args) { for (const fn of [...(handlers.get(type) || [])]) { try { await fn(...args); } catch (error) { errors.push(error); } } },
        async emitAndWait(type, ...args) { return this.emit(type, ...args); },
        count: () => { let n = 0; for (const list of handlers.values()) n += list.length; return n; },
        byType: () => Object.fromEntries([...handlers].map(([k, v]) => [k, v.length]).filter(([, n]) => n)),
    };
    const T = ['APP_READY', 'APP_INITIALIZED', 'CHAT_CHANGED', 'CHAT_CREATED', 'CHAT_DELETED', 'CHAT_RENAMED', 'MESSAGE_RECEIVED', 'MESSAGE_SENT', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPE_DELETED',
        'CHARACTER_MESSAGE_RENDERED', 'USER_MESSAGE_RENDERED', 'MORE_MESSAGES_LOADED', 'GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'GENERATION_AFTER_COMMANDS', 'GENERATE_AFTER_DATA', 'GENERATE_AFTER_COMBINE_PROMPTS', 'STREAM_TOKEN_RECEIVED',
        'SETTINGS_UPDATED', 'SETTINGS_LOADED', 'SETTINGS_LOADED_AFTER', 'EXTENSION_SETTINGS_LOADED', 'CHARACTER_PAGE_LOADED', 'CHARACTER_EDITED', 'CHARACTER_RENAMED', 'CHARACTER_DELETED', 'GROUP_UPDATED', 'ONLINE_STATUS_CHANGED', 'OAI_PRESET_CHANGED_AFTER',
        'CHAT_COMPLETION_PROMPT_READY', 'CHAT_COMPLETION_SETTINGS_READY', 'WORLD_INFO_ACTIVATED', 'WORLDINFO_UPDATED', 'IMPERSONATE_READY', 'PERSONA_CHANGED', 'PERSONA_CREATED', 'PERSONA_DELETED', 'MAIN_API_CHANGED', 'OPEN_CHARACTER_LIBRARY', 'GROUP_MEMBER_DRAFTED', 'FORCE_SET_BACKGROUND'];
    const event_types = Object.fromEntries(T.map(k => [k, k.toLowerCase()]));
    const ctx = {
        eventSource, event_types, eventTypes: event_types, chat: [], chatId: 'chat-0', characterId: 0, groupId: null, characters: [{ name: 'Char', avatar: 'char.png', data: { extensions: {} } }], groups: [], name1: 'You', name2: 'Char',
        extensionSettings: { salty: settings, ...extensionSettings }, chatMetadata: {}, powerUserSettings: {}, chatCompletionSettings: {}, textCompletionSettings: {}, mainApi: 'openai', onlineStatus: 'no_connection', extensionPrompts: {},
        saveSettingsDebounced() {}, saveSettings: async () => {}, saveChat: async () => {}, saveMetadata: async () => {}, saveMetadataDebounced() {}, getRequestHeaders: () => ({}), getCurrentLocale: () => 'ko-kr', getCurrentChatId: () => ctx.chatId,
        substituteParams: s => s, getThumbnailUrl: (type, file) => `/thumbnail?type=${type}&file=${file}`, getTokenCountAsync: async s => String(s).length, getTokenCount: s => String(s).length,
        SlashCommandParser: { commands: {}, addCommandObject() {} }, registerSlashCommand() {}, callGenericPopup: async () => null, POPUP_TYPE: { TEXT: 1, CONFIRM: 2, INPUT: 3 }, POPUP_RESULT: { AFFIRMATIVE: 1, NEGATIVE: 0 },
        updateMessageBlock() {}, addOneMessage() {}, reloadCurrentChat: async () => {}, openCharacterChat: async () => {}, getExtensionManifest: () => null, addLocaleData() {}, isMobile: () => false, tags: [], tagMap: {}, worldInfo: {}, macros: { register() {} },
        accountStorage: { getItem: k => globalThis.localStorage.getItem(k), setItem: (k, v) => globalThis.localStorage.setItem(k, v), removeItem: k => globalThis.localStorage.removeItem(k) },
    };
    g.SillyTavern = { getContext: () => ctx };
    g.jQuery = g.$ = jq;
    return { ctx, eventSource, event_types, chat, document: documentLite };
}
let windowListenerHost = null;
/** 등록 수: eventSource · window · document · 그 밖 요소 */
export function listenerCounts(eventSource) {
    let elements = 0; (function walk(n) { elements += n._ls?.length || 0; n.childNodes.forEach(walk); })(documentLite);
    return { eventSource: eventSource.count(), window: windowListenerHost?._ls?.length || 0, document: documentLite._ls?.length || 0, elements, intervals: stats.intervals.size };
}

// ── jQuery 얕은 흉내 (on · off · 고르기 정도) ──
function jq(arg) {
    if (typeof arg === 'function') { clock.setTimeout(arg, 0); return jqWrap([]); }
    if (arg instanceof NodeLite || arg === globalThis) return jqWrap([arg]);
    if (typeof arg === 'string') { if (arg.trim().startsWith('<')) return jqWrap(parseHtml(arg).filter(n => n.nodeType === 1)); try { return jqWrap(qsa(documentLite, arg)); } catch { return jqWrap([]); } }
    if (Array.isArray(arg)) return jqWrap(arg);
    return jqWrap([]);
}
const delegated = new WeakMap();
function jqWrap(list) {
    const w = Object.assign(Object.create(null), list);
    Object.assign(w, {
        length: list.length, get: i => i === undefined ? [...list] : list[i], each(fn) { list.forEach((el, i) => fn.call(el, i, el)); return w; },
        on(types, sel, fn) { if (typeof sel === 'function') { fn = sel; sel = null; } for (const el of list) for (const type of String(types).split(/\s+/).filter(Boolean)) { const h = sel ? (e => { const t = e.target?.closest?.(sel); if (t) fn.call(t, e); }) : (e => fn.call(el, e)); (delegated.get(el) || delegated.set(el, []).get(el)).push({ type, fn, h }); (el === globalThis ? globalThis : el).addEventListener(type.split('.')[0], h); } return w; },
        off(types, sel, fn) { if (typeof sel === 'function') fn = sel; for (const el of list) { const arr = delegated.get(el) || []; for (const type of String(types || '').split(/\s+/).filter(Boolean)) for (let i = arr.length - 1; i >= 0; i--) if (arr[i].type === type && (!fn || arr[i].fn === fn)) { (el === globalThis ? globalThis : el).removeEventListener(type.split('.')[0], arr[i].h); arr.splice(i, 1); } } return w; },
        one(types, sel, fn) { return w.on(types, sel, fn); }, appendTo(t) { const host = typeof t === 'string' ? qsa(documentLite, t)[0] : t?.get ? t.get(0) : t; host?.append(...list); return w; }, prependTo(t) { const host = typeof t === 'string' ? qsa(documentLite, t)[0] : t?.get ? t.get(0) : t; host?.prepend(...list); return w; }, prepend(...a) { list[0]?.prepend(...a.flatMap(x => x?.get ? x.get() : [x])); return w; }, after() { return w; }, before() { return w; }, empty() { list.forEach(el => el.replaceChildren()); return w; }, slideToggle() { return w; }, slideUp() { return w; }, slideDown() { return w; }, fadeIn() { return w; }, fadeOut() { return w; }, select2() { return w; }, sortable() { return w; }, draggable() { return w; }, focus() { return w; }, click() { return w; }, change() { return w; }, offset: () => ({ top: 0, left: 0 }), width: () => 0, height: () => 0, outerHeight: () => 0, outerWidth: () => 0, scrollTop: () => 0, hasClass: () => false, map: fn => jqWrap(list.map((el, i) => fn.call(el, i, el))), not: () => w, has: () => w, siblings: () => jqWrap([]), next: () => jqWrap([]), prev: () => jqWrap([]), removeAttr() { return w; }, wrap() { return w; }, clone: () => jqWrap(list.map(el => el.cloneNode(true))), trigger() { return w; }, css() { return w; }, attr() { return w; }, prop() { return w; }, addClass() { return w; }, removeClass() { return w; }, toggleClass() { return w; },
        find: s => jqWrap(list.flatMap(el => qsa(el, s))), closest: s => jqWrap(list.map(el => el.closest?.(s)).filter(Boolean)), append(...a) { list[0]?.append(...a.flatMap(x => x?.get ? x.get() : [x])); return w; }, remove() { list.forEach(el => el.remove()); return w; },
        text: v => v === undefined ? list.map(el => el.textContent).join('') : (list.forEach(el => { el.textContent = v; }), w), html: v => v === undefined ? list[0]?.innerHTML : (list.forEach(el => { el.innerHTML = v; }), w), val: v => v === undefined ? list[0]?.value : (list.forEach(el => { el.value = v; }), w),
        hide() { return w; }, show() { return w; }, is: () => false, data: () => undefined, children: () => jqWrap(list.flatMap(el => el.children || [])), parent: () => jqWrap(list.map(el => el.parentElement).filter(Boolean)), filter: () => w, first: () => jqWrap(list.slice(0, 1)), last: () => jqWrap(list.slice(-1)), eq: i => jqWrap(list.slice(i, i + 1)), [Symbol.iterator]: () => list[Symbol.iterator](),
    });
    // 모르는 jQuery 메서드는 아무것도 안 하고 자기를 돌려준다 (사슬이 끊기지 않게)
    const proxy = new Proxy(w, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && !/^\d+$/.test(k) && k !== 'then') return () => proxy; return undefined; } });
    return proxy;
}
jq.get = url => { const text = readLocal(url); return text === null ? Promise.reject(new Error('404 ' + url)) : Promise.resolve(text); }; jq.ajax = () => Promise.resolve({}); jq.getJSON = () => Promise.resolve({}); jq.Deferred = () => { let res; const p = new Promise(r => { res = r; }); p.resolve = res; p.promise = () => p; return p; };
jq.fn = {}; jq.extend = Object.assign; jq.expr = { pseudos: {} }; jq.find = { matchesSelector: (el, s) => el.matches(s) }; jq.event = { special: {} };

/** 실리태번 메시지 하나 (#chat > .mes) */
export function messageElement(id, { user = false, text = '' } = {}) {
    const mes = new ElementLite('div');
    mes.setAttribute('class', 'mes'); mes.setAttribute('mesid', String(id)); mes.setAttribute('ch_name', user ? 'You' : 'Char'); mes.setAttribute('is_user', String(user)); mes.setAttribute('is_system', 'false'); mes.setAttribute('swipeid', '0');
    mes.innerHTML = `<div class="mesAvatarWrapper"><div class="avatar"><img src="/thumbnail?type=avatar&amp;file=char.png" alt=""></div></div>`
        + `<div class="mes_block"><div class="ch_name flex-container"><span class="name_text">${user ? 'You' : 'Char'}</span><div class="mes_buttons"><div class="extraMesButtons"><div class="mes_button mes_edit fa-solid fa-pencil"></div></div><div class="mes_button extraMesButtonsHint fa-solid fa-ellipsis"></div></div></div>`
        + `<div class="mes_text"><p>${text || `메시지 ${id} 의 본문이에요. <q>「따옴표 대사예요」</q> 그리고 <em>기울임</em>.`}</p></div><div class="mes_img_container"></div>`
        + `<div class="swipe_left fa-solid fa-chevron-left"></div><div class="swipeRightBlock"><div class="swipes-counter">1/1</div></div></div>`;
    return mes;
}

/** 무엇이든 되는 빈 흉내 — 부르면 빈 흉내, 속성을 읽으면 빈 흉내 (then 은 없어서 await 해도 그대로) */
export function anything(label = 'stub') {
    const fn = function () {};
    return new Proxy(fn, {
        get(t, k) {
            if (k === 'then') return undefined;
            if (k === Symbol.toPrimitive) return () => '';
            if (k === Symbol.iterator) return function* () {};
            if (k === 'length') return 0;
            if (k === 'toString' || k === 'valueOf') return () => '';
            if (typeof k === 'symbol') return undefined;
            return t[k] ??= anything(label + '.' + String(k));
        },
        apply() { return anything(label + '()'); },
        construct() { return anything('new ' + label); },
    });
}
/** 테마 밖 모듈(실리태번 본체) 흉내 값: ctx 에 있으면 그것 */
export function installHost(ctx) {
    const extra = { extension_settings: ctx.extensionSettings, chat_metadata: ctx.chatMetadata, power_user: ctx.powerUserSettings, this_chid: ctx.characterId, main_api: ctx.mainApi, online_status: ctx.onlineStatus, oai_settings: ctx.chatCompletionSettings, extensionNames: [], settingsReady: true, getContext: () => ctx, model_list: [], DEFAULT_SAVE_EDIT_TIMEOUT: 1000, groups: [], selected_group: null };
    globalThis.__leakHost = name => name in extra ? extra[name] : name in ctx ? ctx[name] : anything(name);
}
