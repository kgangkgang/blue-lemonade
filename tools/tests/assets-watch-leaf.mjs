// 8.2.7 성능: 에셋 감시(assets.js 채팅 관찰자)가 메시지마다 붙는 작은 단추(자식 요소가 없는 <img> 아닌 요소)는 그림 선택자로 맞춰 보지 않는지 · 결과는 같은지 (가짜 문서)
//   채팅 300개 열기에서 붙는 요소 3,600개 가운데 3,300개가 메시지 단추 줄의 단추예요 — 하나마다 에셋 · 외곽선 · 메시지 선택자로 matches 넷 · querySelector(All) 둘을 불렀어요.
//   그대로인 것: 자식 없는 .custom-cac-img 는 에셋으로 재고(그림이 아니어도 맞는 유일한 갈래), 메시지 본문에 붙은 작은 요소는 줄바꿈 정리를 하고, <img> 와 자식이 있는 요소 · quirks 문서는 예전 길이에요.
//   node tools/tests/assets-watch-leaf.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`  PASS  ${name}`); } catch (e) { failed++; console.log(`  FAIL  ${name}\n        ${String(e.stack || e).split('\n').slice(0, 6).join('\n        ')}`); } };
const src = fs.readFileSync(path.join(root, 'src/assets.js'), 'utf8');
const constOf = name => { const m = new RegExp(`const ${name} = '([^']*)';`).exec(src); assert.ok(m, name); return m[1]; };
const ASSET_IMG = constOf('ASSET_IMG'), EDGE_IMG = constOf('EDGE_IMG');

// ── 작은 선택자: 태그 · #id · .class · [속성] · [속성="값"] · [속성*="값"] · :is(…) · 자손(빈칸) · 자식(>) · 쉼표
function splitTop(text, sep) { const out = []; let depth = 0, cur = ''; for (const ch of text) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (!depth && sep(ch)) { out.push(cur); cur = ''; continue; } cur += ch; } out.push(cur); return out; }
const parsed = new Map();
function parseList(selector) {
    let list = parsed.get(selector); if (list) return list;
    list = splitTop(selector, ch => ch === ',').map(s => s.trim()).filter(Boolean).map(complex => {
        const words = splitTop(complex.replace(/\s*>\s*/g, ' > '), ch => ch === ' ').filter(Boolean); const parts = [];
        for (const w of words) { if (w === '>') { parts.push('>'); continue; } if (parts.length && parts.at(-1) !== '>') parts.push(' '); parts.push(w); }
        return parts;
    });
    parsed.set(selector, list); return list;
}
function compound(el, c) {
    if (!el || el.nodeType !== 1) return false;
    let rest = c; const tag = rest.match(/^[a-z*][\w-]*/i);
    if (tag) { if (tag[0] !== '*' && el.localName !== tag[0].toLowerCase()) return false; rest = rest.slice(tag[0].length); }
    while (rest) {
        let m;
        if ((m = rest.match(/^#([\w-]+)/))) { if (el.id !== m[1]) return false; }
        else if ((m = rest.match(/^\.([\w-]+)/))) { if (!el.classList.contains(m[1])) return false; }
        else if ((m = rest.match(/^\[([\w-]+)(?:([*^]?=)"([^"]*)")?\]/))) { const v = el.getAttribute(m[1]); if (v === null || (m[2] === '=' && v !== m[3]) || (m[2] === '*=' && !v.includes(m[3])) || (m[2] === '^=' && !v.startsWith(m[3]))) return false; }
        else throw Error('모르는 선택자 조각: ' + rest);
        rest = rest.slice(m[0].length);
    }
    return true;
}
function parts(el, p, i) {
    if (!compound(el, p[i])) return false; if (i === 0) return true;
    if (p[i - 1] === '>') return !!el.parentElement && parts(el.parentElement, p, i - 2);
    for (let up = el.parentElement; up; up = up.parentElement) if (parts(up, p, i - 2)) return true;
    return false;
}
const listMatch = (el, sel) => parseList(sel).some(p => parts(el, p, p.length - 1));

const asked = [];   // [요소, 선택자, 방법]
class El {
    constructor(doc, tag, attrs = {}, kids = []) {
        this.ownerDocument = doc; this.nodeType = 1; this.localName = tag; this.nodeName = tag.toUpperCase(); this.attrs = { ...attrs }; this.children = []; this.parentElement = null; this.listeners = []; this.dataset = {};
        const el = this, names = () => String(el.attrs.class || '').split(/\s+/).filter(Boolean);
        this.classList = { contains: c => names().includes(c), add: c => { if (!names().includes(c)) el.attrs.class = [...names(), c].join(' '); }, remove: c => { el.attrs.class = names().filter(n => n !== c).join(' '); }, toggle: (c, on) => { on = on ?? !names().includes(c); if (on) el.classList.add(c); else el.classList.remove(c); return on; } };
        const props = new Map(); this.style = { setProperty: (k, v) => props.set(k, v), removeProperty: k => props.delete(k), getPropertyValue: k => props.get(k) ?? '' };
        for (const k of kids) this.append(k);
    }
    get id() { return this.attrs.id || ''; }
    get firstElementChild() { return this.children[0] || null; }
    get firstChild() { return this.children[0] || null; }
    get nextSibling() { const p = this.parentElement; return p ? p.children[p.children.indexOf(this) + 1] || null : null; }
    get textContent() { return this.attrs.text || ''; }
    get isConnected() { return true; }
    all() { const out = []; const walk = e => { for (const c of e.children) { out.push(c); walk(c); } }; walk(this); return out; }
    append(...nodes) { for (const n of nodes) { n.parentElement = this; this.children.push(n); } return nodes[0]; }
    remove() { const p = this.parentElement; if (p) p.children.splice(p.children.indexOf(this), 1); this.parentElement = null; }
    getAttribute(k) { return this.attrs[k] ?? null; } hasAttribute(k) { return k in this.attrs; }
    matches(sel) { asked.push([this, sel, 'matches']); return listMatch(this, sel); }
    closest(sel) { for (let n = this; n; n = n.parentElement) if (listMatch(n, sel)) return n; return null; }
    querySelectorAll(sel) { asked.push([this, sel, 'query']); return this.all().filter(e => listMatch(e, sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    contains(n) { for (; n; n = n.parentElement) if (n === this) return true; return false; }
    addEventListener(type, fn) { this.listeners.push([type, fn]); }
}
const h = (doc, tag, attrs, kids) => new El(doc, tag, attrs, kids);

async function harness(mode, tag) {
    const doc = { compatMode: mode };
    const chat = h(doc, 'div', { id: 'chat' }); const body = h(doc, 'body', {}, [chat]);
    const observers = [];
    const saved = { document: globalThis.document, MutationObserver: globalThis.MutationObserver, setTimeout: globalThis.setTimeout };
    globalThis.document = { compatMode: mode, body, getElementById: id => (id === 'chat' ? chat : null), querySelectorAll: sel => body.querySelectorAll(sel), createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(48 * 48 * 4).fill(255) }) }) }) };
    globalThis.MutationObserver = class { constructor(fn) { this.fn = fn; observers.push(this); } observe(target, opts) { this.target = target; this.opts = opts; } };
    const assets = await import(pathToFileURL(path.join(root, 'src/assets.js')) + '?' + tag);
    assets.startAssetWatcher();
    const watcher = observers.find(o => o.target === chat);
    return { doc, chat, watcher, restore: () => Object.assign(globalThis, saved) };
}
const mesOf = doc => h(doc, 'div', { class: 'mes' }, [h(doc, 'div', { class: 'mes_block' }, [h(doc, 'div', { class: 'mes_text' }, [h(doc, 'p', {}, [h(doc, 'br'), h(doc, 'span', { text: '지어낸 글' })])])]), h(doc, 'div', { class: 'mes_buttons' }, [h(doc, 'div', { class: 'extraMesButtons' })])]);
const imageSelectors = new Set([ASSET_IMG, EDGE_IMG, 'img', '.mes, .mes_text, .mes_text *, .mes_block, .mes_img_container, .mes_media_wrapper']);

await test('단추 줄에 붙는 자식 없는 단추 수십 개는 에셋 · 외곽선 선택자로 맞춰 보지도 · 그 아래를 훑지도 않아요', async () => {
    const H = await harness('CSS1Compat', 'leaf-1');
    try {
        const mes = mesOf(H.doc); H.chat.append(mes); const row = mes.all().find(e => e.classList.contains('extraMesButtons'));
        const buttons = Array.from({ length: 40 }, (_, i) => h(H.doc, 'div', { class: `mes_button fa-solid fa-${i}`, role: 'button' }));
        row.append(...buttons); asked.length = 0;
        H.watcher.fn(buttons.map(b => ({ type: 'childList', target: row, addedNodes: [b], removedNodes: [] })));
        const image = asked.filter(([n, s]) => buttons.includes(n) && imageSelectors.has(s));
        assert.equal(image.length, 0, `단추마다 그림 선택자 ${image.length}번(${[...new Set(image.map(x => x[2] + ' ' + x[1].slice(0, 20)))].join(' | ')})`);
    } finally { H.restore(); }
});
await test('그대로: 자식 없는 .custom-cac-img 는 에셋으로 재고 · 본문에 붙은 작은 요소는 줄바꿈 정리 · <img> 는 예전처럼 맞춰 봐요', async () => {
    const H = await harness('CSS1Compat', 'leaf-2');
    try {
        const mes = mesOf(H.doc); H.chat.append(mes); const text = mes.all().find(e => e.classList.contains('mes_text')); const p = text.children[0];
        const cac = h(H.doc, 'div', { class: 'custom-cac-img' }); const span = h(H.doc, 'span'); const img = h(H.doc, 'img', { class: 'eh-img' });
        text.append(cac, span); asked.length = 0;
        H.watcher.fn([{ type: 'childList', target: text, addedNodes: [cac, span], removedNodes: [] }]);
        assert.ok(cac.listeners.some(([t]) => t === 'load'), '.custom-cac-img 를 에셋으로 재요(아직 안 실린 그림처럼 load 를 기다림)');
        assert.notEqual(p.children[0]?.localName, 'br', '본문에 작은 요소가 붙으면 문단 맨 앞 줄바꿈을 정리해요');
        text.append(img); asked.length = 0;
        H.watcher.fn([{ type: 'childList', target: text, addedNodes: [img], removedNodes: [] }]);
        assert.ok(asked.some(([n, s]) => n === img && s === ASSET_IMG), '<img> 는 에셋 선택자로 맞춰 봐요');
        assert.ok(img.listeners.some(([t]) => t === 'load'), '에셋 그림으로 재요');
    } finally { H.restore(); }
});
await test('quirks 문서(class 를 대소문자 없이 맞춤)는 예전처럼 다 맞춰 봐요', async () => {
    const H = await harness('BackCompat', 'leaf-3');
    try {
        const mes = mesOf(H.doc); H.chat.append(mes); const row = mes.all().find(e => e.classList.contains('extraMesButtons'));
        const b = h(H.doc, 'div', { class: 'mes_button' }); row.append(b); asked.length = 0;
        H.watcher.fn([{ type: 'childList', target: row, addedNodes: [b], removedNodes: [] }]);
        assert.ok(asked.some(([n, s]) => n === b && s === ASSET_IMG));
    } finally { H.restore(); }
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/assets-watch-leaf\.mjs \./);
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
