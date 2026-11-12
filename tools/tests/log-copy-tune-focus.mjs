// 1.1.5 조절 화면 키보드 초점 — 누른 칩이 다시 그리기로 사라져도(켬/끔 칩 · 「따로」 · ↺) 초점이 body 로 떨어지지 않고 남은 칸으로 와요
//   node tools/tests/log-copy-tune-focus.mjs <테마 루트>
//   시트(src/log-copy-sheet.js)의 keepFocus 를 글 그대로 떼어 작은 DOM 흉내 위에서 돌려요(브라우저 없이).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const sheet = fs.readFileSync(path.join(root, 'src/log-copy-sheet.js'), 'utf8');
const pick = (re, what) => { const m = sheet.match(re); assert.ok(m, `${what} 를 시트에서 못 찾았어요`); return m[0]; };
const keys = pick(/const FOCUS_KEYS = \[[^\]]*\];/, 'FOCUS_KEYS');
const rows = pick(/const FOCUS_ROWS = '[^']*';/, 'FOCUS_ROWS');
const body = pick(/function keepFocus\(paint\) \{[\s\S]*?\n {4}\}\n/, 'keepFocus');

// ── 작은 DOM 흉내: 칸 · 속성 · 붙어 있음 · closest/querySelector(이 시트가 쓰는 선택자만) ──
const unesc = s => s.replace(/[\\](.)/g, '$1');
function matchOne(el, sel) {
    sel = sel.trim();
    let rest = sel;
    const not = rest.match(/:not\(:disabled\)$/); if (not) { if (el.attrs.has('disabled')) return false; rest = rest.slice(0, not.index); }
    const tag = rest.match(/^[a-z]+/); if (tag) { if (el.tag !== tag[0]) return false; rest = rest.slice(tag[0].length); }
    for (const m of rest.matchAll(/\.([\w-]+)|\[([\w-]+)(?:(\^?=)"((?:[\\].|[^"\\])*)")?\]/g)) {
        if (m[1]) { if (!(el.attrs.get('class') || '').split(/\s+/).includes(m[1])) return false; continue; }
        if (!el.attrs.has(m[2])) return false;
        if (m[3] === '=' && el.attrs.get(m[2]) !== unesc(m[4])) return false;
        if (m[3] === '^=' && !el.attrs.get(m[2]).startsWith(unesc(m[4]))) return false;
    }
    return true;
}
const matches = (el, list) => list.split(',').some(s => matchOne(el, s));
class El {
    constructor(tag, attrs = {}, kids = []) { this.tag = tag; this.attrs = new Map(Object.entries(attrs)); this.parent = null; this.kids = []; kids.forEach(k => this.append(k)); this.dataset = new Proxy({}, { get: (_, k) => this.attrs.get('data-' + String(k).replace(/[A-Z]/g, c => '-' + c.toLowerCase())) }); }
    append(k) { k.parent = this; this.kids.push(k); }
    set html(kids) { for (const k of this.kids) k.parent = null; this.kids = []; kids.forEach(k => this.append(k)); }
    get isConnected() { let n = this; while (n.parent) n = n.parent; return n === doc.root; }
    hasAttribute(a) { return this.attrs.has(a); }
    getAttribute(a) { return this.attrs.get(a) ?? null; }
    closest(list) { for (let n = this; n; n = n.parent) if (matches(n, list)) return n; return null; }
    *all() { for (const k of this.kids) { yield k; yield* k.all(); } }
    querySelector(list) { for (const n of this.all()) if (matches(n, list)) return n; return null; }
    contains(x) { for (let n = x; n; n = n.parent) if (n === this) return true; return false; }
    focus() { if (this.isConnected) doc.activeElement = this; }
}
const doc = { root: null, activeElement: null };
globalThis.document = doc;
globalThis.CSS = { escape: s => String(s).replace(/["\\|.]/g, c => String.fromCharCode(92) + c) };
const btn = (attrs, label) => new El('button', attrs, []);
const dialog = new El('dialog');
const easy = new El('div', { 'data-lc-easy': '' });
dialog.append(easy); doc.root = dialog;
const keepFocus = new Function('dialog', 'document', 'CSS', `${keys}\n${rows}\n${body}\nreturn keepFocus;`)(dialog, doc, globalThis.CSS);

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.error('FAIL ' + name + '\n' + (e.stack || e)); } }
const tabs = () => new El('div', { class: 'bl-lc-view' }, [btn({ 'data-lc-view': 'easy' }), btn({ 'data-lc-view': 'fine' })]);
const strip = (...kids) => new El('div', { class: 'bl-lt-row' }, [new El('div', { class: 'bl-lt-chips' }, kids)]);

test('켬/끔 칩(값이 열쇠 끝에 든 칩)을 누르면 다시 그린 같은 칸의 칩으로', () => {
    const before = btn({ class: 'bl-lc-chip', 'data-lt': 'look|shadow.on|true' });
    easy.html = [tabs(), strip(btn({ 'data-lt': 'look|fonts.text|null' })), strip(before)];
    before.focus();
    const after = btn({ class: 'bl-lc-chip', 'data-lt': 'look|shadow.on|null' });
    keepFocus(() => { easy.html = [tabs(), strip(btn({ 'data-lt': 'look|fonts.text|null' })), strip(after)]; })();
    assert.equal(doc.activeElement, after);
});
test('「따로」처럼 다음 화면에 없는 칩이면 body 가 아니라 남아 있는 조절 칸 안으로', () => {
    const apart = btn({ class: 'bl-lc-chip', 'data-lc-view': 'motion' });
    easy.html = [tabs(), new El('div', { class: 'bl-lc-easy-row' }, [new El('div', { class: 'bl-lc-easy-chips' }, [btn({ 'data-lc-easy': 'motion:m' }), apart])])];
    apart.focus();
    keepFocus(() => { easy.html = [tabs(), strip(btn({ 'data-lt': 'motion|text|"m"' }))]; })();
    assert.ok(doc.activeElement !== apart && doc.activeElement.isConnected && easy.contains(doc.activeElement), '초점이 붙어 있는 칸에');
});
test('열쇠가 그대로인 칩은 예전처럼 같은 칩으로', () => {
    const a = btn({ 'data-lt': 'tex|tex|"grid"' });
    easy.html = [tabs(), strip(a)]; a.focus();
    const b = btn({ 'data-lt': 'tex|tex|"grid"' });
    keepFocus(() => { easy.html = [tabs(), strip(b)]; })();
    assert.equal(doc.activeElement, b);
});
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
