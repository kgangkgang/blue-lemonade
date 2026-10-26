// 7.9.9 속도 P4: src/icon-text.js 가 채팅 · 미리보기 .mes 에 다는 표식이 옛 :has() 조건과 하나씩 같은지 (가짜 DOM, 브라우저 없음)
//   node tools/tests/mes-marks.mjs <테마 루트>
//   data-bl-editing 토큰: deep(안에 .edit_textarea) · text(> .mes_block > .mes_text > .edit_textarea)
//   data-bl-meta 토큰: id · timer · tok (> .mesAvatarWrapper > 그 칸이 :empty 가 아님 — 공백 글자도 자식, 주석만 있으면 빈 것)
//   또 CSS 에 옛 조건이 남아 있지 않고, 특이도 보정(:is(.bl-s, *))이 붙었는지 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

class Node { constructor(type, value = '') { this.nodeType = type; this.nodeValue = value; } }
class El extends Node {
    constructor(tag, cls = '', children = []) {
        super(1); this.localName = tag; const list = cls.split(/\s+/).filter(Boolean);
        this.classList = { contains: c => list.includes(c) }; this.childNodes = children;
        for (const c of children) c.parentElement = this;
    }
    get children() { return this.childNodes.filter(n => n.nodeType === 1); }
    get firstChild() { return this.childNodes[0] || null; }
    getElementsByClassName(c) { const out = []; const walk = e => { for (const k of e.children) { if (k.classList.contains(c)) out.push(k); walk(k); } }; walk(this); return out; }
}
Object.defineProperty(Node.prototype, 'nextSibling', { get() { const s = this.parentElement?.childNodes || []; return s[s.indexOf(this) + 1] || null; } });
const text = s => new Node(3, s), comment = () => new Node(8, 'x');
const el = (tag, cls, ...children) => new El(tag, cls, children);

const { editingTokens, metaTokens } = await import(pathToFileURL(path.join(root, 'src/icon-text.js')).href);

await test('편집 표식 — deep 는 어디든, text 는 > .mes_block > .mes_text > 바로 아래만', () => {
    const plain = el('div', 'mes', el('div', 'mesAvatarWrapper'), el('div', 'mes_block', el('div', 'ch_name'), el('div', 'mes_text', text('안녕'))));
    assert.equal(editingTokens(plain), '');
    const editing = el('div', 'mes', el('div', 'mes_block', el('div', 'ch_name'), el('div', 'mes_text', el('textarea', 'edit_textarea'))));
    assert.equal(editingTokens(editing), 'deep text');
    const nested = el('div', 'mes', el('div', 'mes_block', el('div', 'mes_text', el('div', 'wrap', el('textarea', 'edit_textarea')))));
    assert.equal(editingTokens(nested), 'deep');                       // 손자는 text 아님
    const reasoning = el('div', 'mes', el('div', 'mes_block', el('details', 'mes_reasoning_details', el('textarea', 'reasoning_edit_textarea'))));
    assert.equal(editingTokens(reasoning), '');                        // 생각 편집칸은 다른 클래스
});
await test('머리 표식 — :not(:empty) 과 같은 판정', () => {
    const mes = (...meta) => el('div', 'mes', el('div', 'mesAvatarWrapper', el('div', 'avatar'), ...meta), el('div', 'mes_block'));
    assert.equal(metaTokens(mes(el('div', 'mesIDDisplay', text('#3')), el('div', 'mes_timer', text('2.4s')), el('div', 'tokenCounterDisplay', text('318t')))), 'id timer tok');
    assert.equal(metaTokens(mes(el('div', 'mesIDDisplay'), el('div', 'mes_timer', text(' ')), el('div', 'tokenCounterDisplay', comment()))), 'timer');   // 빈 칸 · 주석만 = :empty, 공백 글자 = 비어 있지 않음
    assert.equal(metaTokens(el('div', 'mes', el('div', 'mes_block', el('div', 'mesIDDisplay', text('#3'))))), '');                                       // mesAvatarWrapper 바로 아래가 아니면 아님
    assert.equal(metaTokens(mes()), '');
});
await test('CSS 에 옛 편집 · 머리 신호 :has 가 남아 있지 않음', () => {
    const left = [];
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.endsWith('.gen.css'))) {
        const t = fs.readFileSync(path.join(root, 'css', f), 'utf8');
        for (const re of [/:has\([^{]*\.edit_textarea/, /:has\(\.reasoning_edit_textarea\)/, /:has\(> \.mesAvatarWrapper > \.(mesIDDisplay|mes_timer|tokenCounterDisplay):not\(:empty\)\)/]) {
            const m = re.exec(t); if (m) left.push(`${f}: ${m[0].slice(0, 80)}`);
        }
    }
    assert.deepEqual(left, [], '아직 :has 로 고르는 곳이 있어요 — data-bl-editing · data-bl-meta · data-bl-reasoning-editing 으로');
});
await test('표식 선택자의 특이도 보정 — text (0,3,0) · 머리 (0,3,0)', () => {
    let n = 0;
    for (const f of fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css') && !f.endsWith('.gen.css'))) {
        const t = fs.readFileSync(path.join(root, 'css', f), 'utf8');
        for (const m of t.matchAll(/\[data-bl-meta~="(?:id|timer|tok)"\]((?::is\(\.bl-s, \*\))*)/g)) { n++; assert.equal(m[1], ':is(.bl-s, *):is(.bl-s, *)', `${f}: ${m[0]}`); }
        for (const m of t.matchAll(/:not\(\[data-bl-editing~="text"\]((?::is\(\.bl-s, \*\))*)\)/g)) { n++; assert.equal(m[1], ':is(.bl-s, *):is(.bl-s, *)', `${f}: ${m[0]}`); }
    }
    assert.ok(n >= 14, `표식 쓰는 곳 ${n}`);
});
console.log(`\n${passed} passed`);
