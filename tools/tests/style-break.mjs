// 6.7.5 줄 맨 앞 <style> 바로 뒤 <br> 숨기기 (src/typography.js markStyleBreaks · css/07-images.css).
// 프리셋 표시 정규식이 대사 앞에 「<style>…</style>⏎」 을 끼우면 그 줄바꿈이 문단 맨 앞 빈 줄이 되어 감정 대사 위가 벌어졌다.
// 가짜 DOM (지어낸 글만): node tools/tests/style-break.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

class Base {
    get previousSibling() { const list = this.parentElement?.childNodes; return list ? list[list.indexOf(this) - 1] ?? null : null; }
    get nextSibling() { const list = this.parentElement?.childNodes; return list ? list[list.indexOf(this) + 1] ?? null : null; }
}
class Text extends Base { constructor(data) { super(); this.nodeType = 3; this.data = data; this.nodeName = '#text'; this.parentElement = null; } }
class El extends Base {
    constructor(tag, cls = '', kids = []) {
        super(); this.nodeType = 1; this.nodeName = tag.toUpperCase(); this.parentElement = null; this.childNodes = []; this.cls = new Set(cls.split(/\s+/).filter(Boolean));
        const self = this;
        this.classList = { contains: c => self.cls.has(c), add: (...c) => c.forEach(x => self.cls.add(x)), remove: (...c) => c.forEach(x => self.cls.delete(x)) };
        for (const k of kids) this.append(k);
    }
    append(k) { const n = typeof k === 'string' ? new Text(k) : k; n.parentElement = this; this.childNodes.push(n); return this; }
    insertFirst(k) { const n = typeof k === 'string' ? new Text(k) : k; n.parentElement = this; this.childNodes.unshift(n); return this; }
    *walk() { for (const k of this.childNodes) if (k.nodeType === 1) { yield k; yield* k.walk(); } }
    getElementsByTagName(t) { return [...this.walk()].filter(n => n.nodeName === t.toUpperCase()); }
    getElementsByClassName(c) { return [...this.walk()].filter(n => n.cls.has(c)); }
    querySelectorAll() { return []; }
    closest(sel) { const c = sel.replace(/^\./, ''); for (let n = this; n; n = n.parentElement) if (n.cls?.has(c)) return n; return null; }
}
const h = (tag, cls, ...kids) => new El(tag, cls, kids);
globalThis.document = { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null };
const T = await import(pathToFileURL(path.join(root, 'src/typography.js')).href);

let pass = 0;
const check = (name, fn) => { fn(); pass++; console.log('PASS', name); };
const marked = br => br.classList.contains('bl-style-br');

check('style at the start of a paragraph: its <br> is marked (preset regex output)', () => {
    const br = h('br'), style = h('style');
    const text = h('div', 'mes_text', h('p', '', '앞 문단이에요.'), h('p', '', style, br, h('span', 'custom-dem-expressive', h('q', '', '「가상 인물의 대사」'))));
    T.markStyleBreaks(text);
    assert.ok(marked(br));
});
check('blank text, comments and other <style> between are skipped; after a <br> counts as line start', () => {
    const br1 = h('br'), br2 = h('br');
    const p = h('p', '', '첫 줄', br1, '\n', h('style'), ' ', h('style'), '\n', br2, '둘째 줄');
    const text = h('div', 'mes_text', p);
    T.markStyleBreaks(text);
    assert.ok(!marked(br1) && marked(br2));
});
check('style inside an inline wrapper at paragraph start counts as line start', () => {
    const br = h('br');
    const text = h('div', 'mes_text', h('p', '', h('span', 'wrap', h('style'), br, '「대사」')));
    T.markStyleBreaks(text);
    assert.ok(marked(br));
});
check('mid-line <style> keeps the author line break; outside messages untouched', () => {
    const br = h('br'), br2 = h('br');
    const text = h('div', 'mes_text', h('p', '', '앞 글 ', h('style'), br, '뒤 글'));
    const panel = h('div', 'salty-panel', h('p', '', h('style'), br2, '설정 글'));
    T.markStyleBreaks(text); T.markStyleBreaks(panel);
    assert.ok(!marked(br) && !marked(br2));
});
check('mark is taken back when the line is no longer at the start', () => {
    const br = h('br'), p = h('p', '', h('style'), br, '「대사」');
    const text = h('div', 'mes_text', p);
    T.markStyleBreaks(text); assert.ok(marked(br));
    p.insertFirst('새로 앞에 붙은 글 ');
    T.markStyleBreaks(text); assert.ok(!marked(br));
});
check('wiring: CSS hides the mark, typesetting marks before reading line starts and before paint, off removes it', () => {
    assert.match(read('css/07-images.css'), /body\.salty \.mes_text br\.bl-style-br \{\s*display: none !important;\s*\}/);
    const typo = read('src/typography.js');
    assert.match(typo, /markAssetBreaks\(root\);\n\s*markStyleBreaks\(root\);/);
    assert.match(typo, /if\(root\.isConnected\)\{if\(markAssetBreaks\(root\)\)padded=true;markStyleBreaks\(root\);\}/);
    assert.match(typo, /querySelectorAll\(`br\.\$\{STYLE_BR\}`\)\.forEach\(node=>node\.classList\.remove\(STYLE_BR\)\)/);
});
console.log(`style-break: ${pass} passed, 0 failed`);
