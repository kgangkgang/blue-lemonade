// 8.2.6 성능: src/scripts/prompt-engine.js 가 그리기 한 번에 문서를 한 번만 훑고(예전 여섯 번),
//   칠한 결과(이름 글 · 제목 · 입력칸 옆 안내)는 예전과 같은지, 앞 묶음이 글을 바꿔 문서에서 빠진 요소는 뒤 묶음에서 건너뛰는지 (가짜 문서)
//   node tools/tests/prompt-engine-once.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`  PASS  ${name}`); };

// 선택자 흉내: 요소마다 「맞는 선택자 한 갈래」 목록을 들고, 쉼표 목록은 갈래 가운데 하나라도 맞으면 맞아요
const S = {
    A1: 'li[data-pm-identifier] .completion_prompt_manager_prompt_name > a.prompt-manager-inspect-action', A2: 'li[data-pm-identifier] .completion_prompt_manager_prompt_name > span[title]:not([class])',
    B: '#completion_prompt_manager_footer_append_prompt option', C1: '.regex-script-label[id] > .regex_script_name', C2: 'div.regex_script_name[title]', C3: 'li.regex-debugger-rule[data-id] .rule-name',
    D: '#completion_prompt_manager_popup_entry_form_name', E: 'input.regex_script_name', F1: '#saved_preset_scripts [title]', F2: '#saved_regex_scripts [title]', F3: '#saved_scoped_scripts [title]',
};
const split = list => list.split(',').map(s => s.trim());
let docScans = 0;
class El {
    constructor(tag, { sels = [], id = '', text = '', title = null, value = '', cls = '' } = {}) {
        this.nodeType = 1; this.localName = tag; this.sels = new Set(sels.map(k => S[k])); this.id = id; this.children = []; this.parentElement = null; this.attrs = {}; this.dataset = {}; this.value = value; this.className = cls; this._text = text;
        if (title !== null) this.attrs.title = title;
    }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set textContent(v) { for (const c of this.children) c.parentElement = null; this.children = []; this._text = v; }
    get isConnected() { let n = this; while (n.parentElement) n = n.parentElement; return n === doc.body; }
    append(...n) { for (const c of n) { c.parentElement = this; this.children.push(c); } return n[0]; }
    insertAdjacentElement(where, el) { const p = this.parentElement; el.parentElement = p; p.children.splice(p.children.indexOf(this) + 1, 0, el); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } setAttribute(k, v) { this.attrs[k] = String(v); }
    matches(list) { return split(list).some(s => this.sels.has(s)); }
    closest(sel) { for (let n = this; n; n = n.parentElement) { if (sel === 'li' && n.localName === 'li') return n; if (sel === 'li.regex-debugger-rule' && n.localName === 'li' && n.className === 'regex-debugger-rule') return n; } return null; }
    all() { const out = []; const walk = e => { for (const c of e.children) { out.push(c); walk(c); } }; walk(this); return out; }
}
const doc = { body: null, getElementById: () => null, createElement: tag => new El(tag), addEventListener() {}, removeEventListener() {}, querySelectorAll: list => { docScans++; return doc.body.all().filter(e => e.matches(list)); } };
globalThis.MutationObserver = class { constructor(fn) { this.fn = fn; } observe() {} disconnect() {} };

function fixture() {
    doc.body = new El('body');
    const pm = doc.body.append(new El('div', { id: 'completion_prompt_manager' }));
    const li1 = pm.append(new El('li')); li1.dataset.pmIdentifier = 'main'; const a = li1.append(new El('a', { sels: ['A1'], text: 'Main Prompt' }));
    const li2 = pm.append(new El('li')); li2.dataset.pmIdentifier = 'jb'; const span = li2.append(new El('span', { sels: ['A2'], text: 'Jailbreak', title: 'Jailbreak' }));
    const opt = pm.append(new El('option', { sels: ['B'], text: 'NSFW', value: 'nsfw' }));
    const label = doc.body.append(new El('div', { id: 'r1' }));
    const rname = label.append(new El('div', { sels: ['C1'], text: 'Fix quotes ' }));
    const ghost = rname.append(new El('i', { sels: ['F2'], title: 'Trim' }));   // 이름 칸 안의 [title] — 이름을 칠하면 문서에서 빠져요
    const saved = doc.body.append(new El('div', { id: 'saved_regex_scripts' }));
    const both = saved.append(new El('div', { sels: ['C2', 'F2'], text: 'Trim', title: 'Trim' }));   // 두 묶음에 다 걸리는 요소 — 글 칠하기 다음 제목
    const preset = doc.body.append(new El('div', { id: 'saved_preset_scripts' }));
    const ptitle = preset.append(new El('span', { sels: ['F1'], title: 'Fix quotes' }));
    const form = doc.body.append(new El('div'));
    const nameInput = form.append(new El('input', { sels: ['D'], value: 'Main Prompt' }));
    const regexInput = form.append(new El('input', { sels: ['E'], value: 'Fix quotes' }));
    return { a, span, opt, rname, ghost, both, ptitle, nameInput, regexInput };
}
const DICT = { prompts: [{ name: 'Main Prompt', id: 'main', title: '메인 프롬프트' }, { name: 'Jailbreak', title: '탈옥' }, { name: 'NSFW', title: '성인 내용' }], regex: [{ name: 'Fix quotes', id: 'r1', title: '따옴표 고치기' }, { name: 'Trim', title: '다듬기' }] };
const { createPromptEngine } = await import(pathToFileURL(path.join(root, 'src/scripts/prompt-engine.js')).href);

await test('그리기 한 번에 문서를 한 번만 훑어요(예전 여섯 번)', () => {
    fixture(); const engine = createPromptEngine(doc);
    docScans = 0; const off = engine.register('qa', DICT);
    console.log(`        문서 훑기 ${docScans}번`);
    assert.equal(docScans, 1);
    off();
});
await test('칠한 결과는 예전과 같아요 — 프롬프트 이름 · 추가 목록 · 정규식 이름 · 제목 · 입력칸 안내', () => {
    const f = fixture(); const engine = createPromptEngine(doc); const off = engine.register('qa', DICT);
    assert.equal(f.a.textContent, '메인 프롬프트');
    assert.equal(f.span.textContent, '탈옥');
    assert.equal(f.opt.textContent, '성인 내용');
    assert.equal(f.rname.textContent, '따옴표 고치기');
    assert.equal(f.both.textContent, '다듬기', '두 묶음에 걸린 요소: 글');
    assert.equal(f.both.getAttribute('title'), '다듬기', '두 묶음에 걸린 요소: 제목');
    assert.equal(f.ptitle.getAttribute('title'), '따옴표 고치기', '프리셋 스크립트 칸 제목(아이디가 달라도 이름이 같으면)');
    const hint = f.nameInput.parentElement.children[f.nameInput.parentElement.children.indexOf(f.nameInput) + 1];
    assert.equal(hint.className, 'bl-script-hint'); assert.equal(hint.textContent, '→ 메인 프롬프트');
    // 이름 칸을 칠하며 빠진 안쪽 [title] 은 제목 묶음에서 건너뛰어요(예전에도 그때는 문서에 없었어요)
    assert.equal(f.ghost.isConnected, false); assert.equal(f.ghost.getAttribute('title'), 'Trim');
    off();
    assert.equal(f.a.textContent, 'Main Prompt', '끄면 원래 글로'); assert.equal(f.both.getAttribute('title'), 'Trim', '끄면 원래 제목으로');
});
await test('CI 등록', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/prompt-engine-once\.mjs \./);
});
console.log(`\n${passed} passed`);
