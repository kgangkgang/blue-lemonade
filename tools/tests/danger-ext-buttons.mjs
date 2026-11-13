// 지우기 확인 창 표식(src/danger.js) — 남의 확장의 지우기 단추를 누른 뒤 뜬 확인 창을 지우기 창(.salty-danger-confirm)으로 알아보는지 지켜요.
//   ① Memoria 「초기화」 단추(.memoria__danger): 휴지통 그림이 아니라 글자 · 단추 자체를 눌러도 그 뒤 확인 창에 표식이 붙어요
//   ② 보통 단추를 누른 뒤 뜬 창 · 취소가 없는 창(알려 주기만 하는 창)에는 안 붙어요
//   ③ 한 번 누름 = 한 창 — 표식이 붙은 뒤에 뜬 다음 창은 그대로예요
//   ④ 표식이 붙은 창의 확인 단추를 지우기 색으로 칠하는 규칙이 있어요(css/17-semantic.css)
// 시험 DOM 은 클래스 하나짜리 선택자만 알아요(속성 선택자 갈래는 여기서 보지 않아요).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok', name); };

const listeners = {};
let records = null;
class Element {
    constructor(cls = '', parent = null) {
        this.cls = cls.split(' ').filter(Boolean); this.parent = parent; this.nodeType = 1; this.style = {}; this.found = {};
        this.classList = { contains: c => this.cls.includes(c), add: c => { this.cls.push(c); }, remove: c => { this.cls = this.cls.filter(x => x !== c); } };
    }
    closest(sel) { for (let e = this; e; e = e.parent) if (sel.split(',').some(s => /^\.[\w-]+$/.test(s.trim()) && e.cls.includes(s.trim().slice(1)))) return e; return null; }
    matches(sel) { return sel === 'dialog.popup' && this.cls.includes('popup'); }
    querySelector(sel) { return this.found[sel] || null; }
}
globalThis.Element = Element;
globalThis.MutationObserver = class { constructor(fn) { records = fn; } observe() {} disconnect() {} takeRecords() { return []; } };
const body = new Element('salty');
const marked = [];
globalThis.document = { body, addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); }, querySelectorAll: () => marked.filter(d => d.cls.includes('salty-danger-confirm')) };
const { startDangerMark } = await import(pathToFileURL(path.join(root, 'src/danger.js')).href);
startDangerMark();
const press = target => { for (const fn of listeners.click) fn({ target }); };
const open = ({ cancel = true } = {}) => {
    const dlg = new Element('popup');
    if (cancel) dlg.found['.popup-button-cancel'] = new Element('popup-button-cancel');
    marked.push(dlg);
    records([{ type: 'childList', target: body, addedNodes: [dlg], removedNodes: [] }]);
    return dlg;
};
const isDanger = dlg => dlg.cls.includes('salty-danger-confirm');

check('① Memoria 「초기화」 단추의 글자 · 단추 자체를 눌러도 그 뒤 확인 창이 지우기 창이에요', () => {
    const button = new Element('menu_button memoria__danger'), label = new Element('', button);
    press(label);
    assert.ok(isDanger(open()), '글자를 누른 때');
    press(button);
    assert.ok(isDanger(open()), '단추 자체를 누른 때(글쇠로 누른 때도 과녁은 단추예요)');
    assert.ok(read('src/danger.js').includes("'.memoria__danger',"), '지우기 컨트롤 목록에 있어요');
});
check('② 보통 단추 뒤의 창 · 취소가 없는 창에는 안 붙어요', () => {
    press(new Element('', new Element('menu_button')));
    assert.ok(!isDanger(open()), '보통 단추');
    press(new Element('menu_button memoria__danger'));
    assert.ok(!isDanger(open({ cancel: false })), '알려 주기만 하는 창');
});
check('③ 한 번 누름 = 한 창', () => {
    press(new Element('menu_button memoria__danger'));
    const first = open(), second = open();
    assert.ok(isDanger(first) && !isDanger(second));
});
check('④ 표식이 붙은 창의 확인 단추를 지우기 색으로 칠해요', () => {
    const css = read('css/17-semantic.css').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(m => m[1].includes('body.salty .popup.salty-danger-confirm .popup-controls .menu_button.popup-button-ok') && !/:(hover|active|focus-visible)\s*$/.test(m[1].trim()));
    assert.ok(rule, '지우기 확인 단추 규칙');
    assert.match(rule[2], /background:\s*var\(--bl-danger-btn\) !important/);
    assert.match(rule[2], /color:\s*var\(--bl-danger-ink\) !important/);
});
console.log(`danger-ext-buttons: ${passed}개 통과`);
