// 캡처용 글 편집(src/capture-editor.js) — 편집을 시작할 때 본 메시지 표시와 파일을 만들 때의 표시를 견주는 규칙.
// 실행: node tools/tests/capture-editor.mjs salty-ext   (jsdom 없이 작은 DOM 흉내로)
// 5.8.4: 화면 밖 데우스 감정 효과 표시(data-bl-fx-off)는 스크롤 · 파일 만들기(holdFx)만으로 붙고 떨어진다 — 견줄 때 빼야 편집이 막히지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');

// ---------- 작은 DOM 흉내 (markupOf · captureDraft · applyCaptureDraft 가 쓰는 만큼)
const esc = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
class TextNode {
    constructor(data) { this.nodeType = 3; this.data = String(data); this.parentNode = null; }
    get textContent() { return this.data; }
    set textContent(v) { this.data = String(v); }
    cloneNode() { return new TextNode(this.data); }
    get html() { return esc(this.data); }
}
const parseStyle = css => String(css || '').split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf(':'); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; });
class Element {
    constructor(tag, attrs = {}, kids = []) {
        this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = new Map(Object.entries(attrs)); this.childNodes = []; this.parentNode = null;
        this.append(...kids);
    }
    append(...nodes) { for (const n of nodes) { const node = typeof n === 'string' ? new TextNode(n) : n; node.parentNode = this; this.childNodes.push(node); } }
    replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    hasAttribute(n) { return this.attrs.has(n); }
    getAttribute(n) { return this.attrs.has(n) ? this.attrs.get(n) : null; }
    setAttribute(n, v) { this.attrs.set(n, String(v)); }
    removeAttribute(n) { this.attrs.delete(n); }
    toggleAttribute(n, on) { if (on) this.attrs.set(n, ''); else this.attrs.delete(n); }
    get style() {
        const el = this, list = () => parseStyle(el.getAttribute('style')), write = l => el.setAttribute('style', l.map(([k, v]) => `${k}: ${v};`).join(' '));
        return {
            *[Symbol.iterator]() { for (const [k] of list()) yield k; },
            removeProperty(name) { write(list().filter(([k]) => k !== name)); },
            get cssText() { return list().map(([k, v]) => `${k}: ${v};`).join(' '); },
            set cssText(v) { write(parseStyle(v)); },
            set whiteSpace(v) { write([...list().filter(([k]) => k !== 'white-space'), ['white-space', v]]); },
        };
    }
    get classList() {
        const el = this, list = () => String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean);
        return {
            get length() { return list().length; },
            contains: c => list().includes(c),
            remove(...names) { el.setAttribute('class', list().filter(c => !names.includes(c)).join(' ')); },
        };
    }
    cloneNode(deep) { const copy = new Element(this.tagName, Object.fromEntries(this.attrs)); if (deep) copy.append(...this.childNodes.map(n => n.cloneNode(true))); return copy; }
    get textContent() { return this.childNodes.map(n => n.textContent).join(''); }
    set textContent(v) { this.replaceChildren(new TextNode(v)); }
    // 선택자: 쉼표 목록의 단순 선택자만 — tag · .class · [attr] · [attr="v"]
    matches(selector) {
        return selector.split(',').some(sel => {
            const parts = sel.trim().match(/[a-z]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]/gi) || [];
            return parts.every(p => p[0] === '.' ? this.classList.contains(p.slice(1))
                : p[0] === '[' ? (([, n, v]) => this.hasAttribute(n) && (v === undefined || this.getAttribute(n) === v))(p.match(/\[([\w-]+)(?:="([^"]*)")?\]/))
                : this.tagName === p.toUpperCase());
        });
    }
    querySelectorAll(selector) { const out = []; const walk = el => { for (const n of el.childNodes) if (n.nodeType === 1) { if (n.matches(selector)) out.push(n); walk(n); } }; walk(this); return out; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    get html() { return `<${this.tagName.toLowerCase()}${[...this.attrs].map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}>${this.innerHTML}</${this.tagName.toLowerCase()}>`; }
    get innerHTML() { return this.childNodes.map(n => n.html).join(''); }
}
const h = (tag, attrs, ...kids) => new Element(tag, attrs || {}, kids);
let messages = [];
globalThis.document = {
    querySelector(sel) { const id = /mesid="(\d+)"/.exec(sel)?.[1]; return messages.find(m => m.getAttribute('mesid') === id) || null; },
    createElement: tag => new Element(tag),
};

// ---------- capture-editor.js 를 실리태번 없이 불러온다 (modal.js 는 편집 창에서만 — 여기서는 안 씀)
const source = (await fs.readFile(path.join(root, 'src/capture-editor.js'), 'utf8')).replace(/^import .*;$/gm, '');
const M = await import('data:text/javascript;base64,' + Buffer.from('const showThemeModal=()=>{};\n' + source).toString('base64'));

// 메시지 하나: 문단 둘 — 둘째 문단에 데우스 감정 효과 글 (안쪽 칸 포함) · 에셋 그림의 표시용 값
const fx = () => h('span', { class: 'custom-dem-expressive bl-fx-lead' }, h('q', null, '"가자!"'));
const message = (mesid, { fxOff = false, extra = null, text = '첫 문단이에요.', saltyWidth = '120px' } = {}) => {
    const effect = fx(); if (fxOff) effect.toggleAttribute('data-bl-fx-off', true);
    if (extra) effect.setAttribute(extra[0], extra[1]);
    const img = h('img', { class: 'salty-asset', style: `--salty-w: ${saltyWidth}; border-radius: 4px;`, src: 'a.webp' });
    return h('div', { class: 'mes', mesid: String(mesid) }, h('div', { class: 'mes_text' }, h('p', null, text), h('p', null, '그가 외쳤다. ', effect, img)));
};
const editOf = (draft) => { const d = structuredClone(draft); d.blocks[0].text = '고친 첫 문단'; return d; };
const apply = (draft, live) => { const clone = live.cloneNode(true); M.applyCaptureDraft(clone, draft, live); return clone; };
const CHANGED = /채팅 표시가 바뀌었어요/;
let passed = 0;
const test = (name, run) => { try { run(); } catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exit(1); } passed++; console.log('PASS ' + name); };

test('effect off-screen when editing started, on-screen (or held for the file) when capturing: edit applies', () => {
    messages = [message(3, { fxOff: true })];
    const [draft] = M.captureDraft([3]);
    messages = [message(3)]; // holdFx(true) 가 표시를 뗀 뒤
    const out = apply(editOf(draft), messages[0]);
    assert.equal(out.querySelector('.mes_text').childNodes[0].textContent, '고친 첫 문단');
});
test('effect on-screen when editing started, scrolled off-screen before a quick preview: edit applies', () => {
    messages = [message(4)];
    const [draft] = M.captureDraft([4]);
    messages = [message(4, { fxOff: true })];
    assert.doesNotThrow(() => apply(editOf(draft), messages[0]));
});
test('changed text still stops the edit', () => {
    messages = [message(5, { fxOff: true })];
    const [draft] = M.captureDraft([5]);
    messages = [message(5, { text: '다른 첫 문단이에요.' })];
    assert.throws(() => apply(editOf(draft), messages[0]), CHANGED);
});
test('other attribute changes on the effect still stop the edit', () => {
    messages = [message(6)];
    const [draft] = M.captureDraft([6]);
    messages = [message(6, { extra: ['data-mood', 'angry'] })];
    assert.throws(() => apply(editOf(draft), messages[0]), CHANGED);
});
test('asset sizing values (--salty-* · salty-asset) are still ignored', () => {
    messages = [message(7, { saltyWidth: '120px' })];
    const [draft] = M.captureDraft([7]);
    messages = [message(7, { saltyWidth: '300px', fxOff: true })];
    assert.doesNotThrow(() => apply(editOf(draft), messages[0]));
});
test('the draft keeps the off-screen marker out of its own copy only (live message untouched)', () => {
    messages = [message(8, { fxOff: true })];
    M.captureDraft([8]);
    assert.equal(messages[0].querySelectorAll('[data-bl-fx-off]').length, 1);
});
console.log(`${passed} checks passed`);
