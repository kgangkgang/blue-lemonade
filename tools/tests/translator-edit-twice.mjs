// 번역문 수정 창(src/addons/translator/index.js editTranslation) — 연필을 빠르게 두 번 눌러도 수정 창은 하나예요.
//   1.5.8 까지: 저장된 번역을 읽는 await 사이에 두 번째 누름이 들어와 수정 칸 · 단추 줄이 두 벌 붙었어요(한 벌을 닫아도 다른 한 벌이 남음).
//   진짜 editTranslation 을 잘라, 이 함수가 쓰는 만큼만 흉내 낸 작은 $ 위에서 돌려요.
//   node tools/tests/translator-edit-twice.mjs [테마 루트]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const source = fs.readFileSync(path.join(root, 'src/addons/translator/index.js'), 'utf8');
function cut(name, prefix = 'function') {
    const start = source.indexOf(`\n${prefix} ${name}(`);
    assert.ok(start >= 0, 'missing ' + name);
    let depth = 0;
    for (let i = source.indexOf(') {', start) + 2; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}' && --depth === 0) return source.slice(start + 1, i + 1);
    }
    throw Error('unbalanced ' + name);
}
// ── 작은 $ ──
class N { constructor(tag, cls = '') { this.tag = tag; this.cls = new Set(cls.split(/\s+/).filter(Boolean)); this.kids = []; this.parent = null; this.on = {}; this.value = ''; }
    all(out = []) { for (const k of this.kids) { out.push(k); k.all(out); } return out; }
    detach() { if (this.parent) { this.parent.kids.splice(this.parent.kids.indexOf(this), 1); this.parent = null; } } }
class Q {
    constructor(nodes) { this.nodes = nodes; }
    get length() { return this.nodes.length; }
    find(sel) { const c = sel.replace(/^\./, ''); return new Q(this.nodes.flatMap(n => n.all().filter(k => k.cls.has(c)))); }
    hasClass(c) { return this.nodes.some(n => n.cls.has(c)); }
    addClass(c) { for (const n of this.nodes) for (const x of c.split(/\s+/)) n.cls.add(x); return this; }
    removeClass(c) { for (const n of this.nodes) n.cls.delete(c); return this; }
    hide() { return this; } show() { return this; } attr() { return this; } text() { return this; } prop() { return this; } focus() { return this; } data() { return this; }
    val(v) { if (v === undefined) return this.nodes[0]?.value; for (const n of this.nodes) n.value = v; return this; }
    on(type, fn) { for (const n of this.nodes) (n.on[type] ||= []).push(fn); return this; }
    append(...qs) { for (const q of qs) for (const k of q.nodes) { k.detach(); k.parent = this.nodes[0]; this.nodes[0].kids.push(k); } return this; }
    after(q) { const me = this.nodes[0], p = me.parent; for (const k of q.nodes) { k.detach(); k.parent = p; p.kids.splice(p.kids.indexOf(me) + 1, 0, k); } return this; }
    before(q) { const me = this.nodes[0], p = me.parent; for (const k of q.nodes) { k.detach(); k.parent = p; p.kids.splice(p.kids.indexOf(me), 0, k); } return this; }
    remove() { for (const n of this.nodes) n.detach(); return this; }
    click() { for (const n of this.nodes) for (const fn of n.on.click || []) fn.call(n, {}); return this; }
}
function fixture() {
    const mes = new N('div', 'mes'), text = new N('div', 'mes_text'), buttons = new N('div', 'mes_buttons');
    for (const k of [buttons, text]) { k.parent = mes; mes.kids.push(k); }
    const message = { mes: 'Synthetic source.', name: 'Bot', swipe_id: 0, extra: { display_text: 'KO' } };
    const context = { chat: [message], name1: 'You', saveChat: async () => {} };
    let release; const reads = [];
    const env = {
        getContext: () => context, substituteParams: t => String(t ?? ''), editShowsSource: false,
        $: arg => /^</.test(arg) ? new Q([new N(arg.replace(/[<>]/g, ''))]) : new Q([mes]),
        localOrDisplayedTranslation: () => new Promise(resolve => { reads.push(1); release = () => resolve('KO'); }),
        toastr: { warning() {}, error() {}, info() {}, success() {} }, console: { error() {}, warn() {} },
        editOpening: new WeakSet(), String, WeakSet, Promise, setTimeout,
    };
    const api = new Function('env', `with (env) { ${cut('editTranslation', 'async function')}\n return { editTranslation }; }`)(env);
    return { mes: new Q([mes]), api, reads, release: () => release() };
}
let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('PASS ' + name); }

await test('연필을 빠르게 두 번 눌러도 수정 칸은 하나예요', async () => {
    const f = fixture();
    const first = f.api.editTranslation(0), second = f.api.editTranslation(0);
    await Promise.resolve(); f.release();
    await Promise.all([first, second]);
    assert.equal(f.reads.length, 1, '저장된 번역도 한 번만 읽어요');
    assert.equal(f.mes.find('translation_edit_textarea').length, 1);
    assert.equal(f.mes.find('translation_edit_buttons').length, 1);
});
await test('열린 채 또 눌러도 그대로 · 취소한 뒤에는 다시 열려요', async () => {
    const f = fixture();
    let run = f.api.editTranslation(0); await Promise.resolve(); f.release(); await run;
    await f.api.editTranslation(0);
    assert.equal(f.mes.find('translation_edit_textarea').length, 1);
    f.mes.find('translation_edit_cancel').click();
    assert.equal(f.mes.find('translation_edit_textarea').length, 0);
    run = f.api.editTranslation(0); await Promise.resolve(); f.release(); await run;
    assert.equal(f.mes.find('translation_edit_textarea').length, 1);
});
console.log(`translator-edit-twice: ${passed} passed`);
