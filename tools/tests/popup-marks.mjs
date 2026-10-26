// 창을 옮기고 내용을 지웠을 때 표식이 남거나, 같은 창을 여러 번 훑지 않는지 확인해요.
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const { POPUP_MARK, markPopup, refreshPopupMarks } = await import(pathToFileURL(path.join(root, 'src/popup-marks.js')).href);
class Element {
    constructor(classes = '', id = '') { this.nodeType = 1; this.classes = classes.split(' '); this.id = id; this.children = []; this.parentElement = null; this.attrs = new Map(); this.writes = 0; }
    matches(selector) {
        return selector.split(',').some(part => {
            const exclude = part.match(/:not\(([^)]+)\)/)?.[1];
            part = part.replace(/:not\([^)]+\)/, '');
            return (!exclude || !this.matches(exclude)) && (!part.includes('#') || this.id === part.match(/#([\w-]+)/)[1]) && [...part.matchAll(/\.([\w-]+)/g)].every(m => this.classes.includes(m[1]));
        });
    }
    append(child) { child.parentElement = this; this.children.push(child); return child; }
    querySelectorAll(selector) { return this.children.flatMap(c => [...(c.matches(selector) ? [c] : []), ...c.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getAttribute(name) { return this.attrs.get(name) ?? null; }
    hasAttribute(name) { return this.attrs.has(name); }
    setAttribute(name, value) { this.writes++; this.attrs.set(name, value); }
    removeAttribute(name) { this.writes++; this.attrs.delete(name); }
}
const body = new Element();
const outer = body.append(new Element('popup'));
const inner = outer.append(new Element('popup'));
const qr = inner.append(new Element('', 'qr--modalEditor'));
assert.equal(refreshPopupMarks(null, body), 2);
assert.equal(inner.getAttribute(POPUP_MARK), 'qr qr-idle');
assert.equal(outer.getAttribute(POPUP_MARK), 'qr qr-idle');
const writes = inner.writes;
markPopup(inner);
assert.equal(inner.writes, writes, '같은 표식은 다시 쓰지 않아요');
qr.classes = ['qr--isExecuting'];
assert.equal(refreshPopupMarks([{type:'attributes', target:qr}, {type:'attributes', target:qr}]), 2);
assert.equal(inner.getAttribute(POPUP_MARK), 'qr');
assert.equal(outer.getAttribute(POPUP_MARK), 'qr');
inner.children = [];
qr.parentElement = null;
refreshPopupMarks([{type:'childList', target:inner, addedNodes:[]}]);
assert.equal(inner.hasAttribute(POPUP_MARK), false, '마지막 본문을 지우면 표식을 지워요');
assert.equal(outer.hasAttribute(POPUP_MARK), false, '바깥 창의 표식도 지워요');
inner.append(new Element('salty-panel in-popup'));
refreshPopupMarks([{type:'childList', target:inner, addedNodes:[]}]);
assert.equal(inner.getAttribute(POPUP_MARK), 'settings');
inner.classes = [];
refreshPopupMarks([{type:'attributes', target:inner}]);
assert.equal(inner.hasAttribute(POPUP_MARK), false, '창 역할을 잃으면 표식을 지워요');
assert.equal(refreshPopupMarks([{type:'characterData',target:qr}]), 0, '스트리밍 글자는 창 구조를 다시 훑지 않아요');
console.log('창 표식의 초기 상태·실행 상태·중첩·제거·중복 갱신 검사를 통과했어요.');
