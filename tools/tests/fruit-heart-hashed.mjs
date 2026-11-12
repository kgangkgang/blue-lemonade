// 1.1.4 과일의 마음 긴 글 지문 사전: 긴 원문(폭 30 넘음) 대신 지문 → 번역(hashed) · 지문 → 노드별 조각(blocks)
//   node tools/tests/fruit-heart-hashed.mjs <테마 루트>
// 원문은 저장소에 두지 않아요 — 이 시험의 중국어 문장은 시험용으로 지어낸 글이에요(원작 문구 아님).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { scriptCode } from './script-code.mjs';
import { keepPresetText } from '../preset-text-limit.mjs';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const code = await scriptCode(root, 'fruit-heart');
let passed = 0;
function check(name, fn) { fn(); passed++; console.log('ok', name); }

const MARK = 'installFruitHeartKorean(BlueLemonade,';
const at = code.lastIndexOf(MARK);
const data = JSON.parse(code.slice(at + MARK.length).trim().replace(/\);[\s\S]*$/, ''));
assert.ok(code.slice(at + MARK.length).startsWith(JSON.stringify(data)), '사전 호출이 JSON 한 덩어리예요');
const tail = code.slice(at + MARK.length + JSON.stringify(data).length);
const fpBody = code.split('/*BL-FINGERPRINT-START*/')[1]?.split('/*BL-FINGERPRINT-END*/')[0];
const fingerprint = new Function(fpBody + '\nreturn fingerprint;')();
const normalize = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const LONG_HAN = /\p{Script=Han}{7,}/u;

check('지문 함수는 동기 · 같은 글에 같은 값 · 숫자와 「」 안쪽만 다르면 같은 열쇠', () => {
    const a = fingerprint('试验用的句子第 12 条，请到「甲」里看看。'), b = fingerprint('试验用的句子第 3,456 条，请到「乙丙」里看看。');
    assert.equal(a.id, b.id); assert.deepEqual(a.caps, ['12', '甲']); assert.deepEqual(b.caps, ['3,456', '乙丙']);
    assert.notEqual(fingerprint('试验用的句子第 12 条，请到「甲」里看。').id, a.id);
    assert.match(a.id, /^[0-9a-z]{1,12}$/);
});

check('번들 사전: 지문 69개 이상 · 묶음 1개 이상, 모양이 맞고 번역에 한자 원문이 길게 들어 있지 않아요', () => {
    const hashed = Object.entries(data.hashed || {}), blocks = Object.entries(data.blocks || {});
    assert.ok(hashed.length >= 69, String(hashed.length)); assert.ok(blocks.length >= 1);
    for (const [id, [ko, kind]] of hashed) { assert.match(id, /^[0-9a-z]{1,12}$/); assert.ok(['t', 'a', 'o', 'n'].includes(kind), id); assert.ok(ko.trim()); assert.doesNotMatch(ko, LONG_HAN, id); }
    for (const [id, parts] of blocks) { assert.match(id, /^[0-9a-z]{1,12}$/); for (const part of parts) assert.ok(part === null || (typeof part === 'string' && !LONG_HAN.test(part)), id); }
});

check('원본 파일(additions)에도 긴 원문이 새로 들어가지 않아요: entries 는 짧은 글만, hashed · blocks 에는 한자 원문 없음', () => {
    const add = JSON.parse(fs.readFileSync(path.join(root, 'tools/scripts-src/fruit-family/fruit-heart-additions.json'), 'utf8'));
    for (const entry of add.entries) assert.ok(keepPresetText(entry.zh), entry.zh);
    assert.doesNotMatch(JSON.stringify(add.hashed) + JSON.stringify(add.blocks), LONG_HAN);
    assert.deepEqual(add.hashed, data.hashed); assert.deepEqual(add.blocks, data.blocks);
});

// ── 작은 DOM 흉내 (tools/tests/fruit-localization.mjs 와 같은 꼴)
class Element {
    constructor(tag = 'div', attrs = {}, text = '') { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.attrs = new Map(Object.entries(attrs)); this.children = []; this.dataset = {}; if (text) this.append({ nodeType: 3, nodeValue: text }); }
    get id() { return this.getAttribute('id') || ''; } get className() { return this.getAttribute('class') || ''; }
    get isConnected() { return this.tagName === 'HTML' || !!this.parentElement?.isConnected; }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; } setAttribute(k, v) { this.attrs.set(k, String(v)); }
    append(node) { node.parentElement = this; Object.defineProperty(node, 'isConnected', { configurable: true, get: () => this.isConnected }); this.children.push(node); return node; }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(x => x !== this); this.parentElement = null; }
    matches(selector) { return selector.split(',').some(part => {
        part = part.trim(); const child = part.split(/\s*>\s*/); if (child.length > 1) { const last = child.pop(); return this.matches(last) && !!this.parentElement?.matches(child.join(' > ')); }
        if (part.includes(':first-child')) { if (this.parentElement?.children.find(x => x.nodeType === 1) !== this) return false; part = part.replace(':first-child', ''); }
        part = part.trim(); const ancestry = part.split(/\s+(?![^\[]*\])/); if (ancestry.length > 1) { const last = ancestry.pop(); return this.matches(last) && !!this.parentElement?.closest(ancestry.join(' ')); }
        const no = part.match(/:not\((.*?)\)/); if (no) { if (this.matches(no[1])) return false; part = part.replace(no[0], ''); }
        for (const a of part.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) if (!this.attrs.has(a[1]) || a[2] !== undefined && this.getAttribute(a[1]) !== a[2]) return false;
        part = part.replace(/\[[^\]]*\]/g, ''); const id = part.match(/#([\w-]+)/); if (id && this.id !== id[1]) return false;
        for (const c of part.matchAll(/\.([\w-]+)/g)) if (!this.className.split(/\s+/).includes(c[1])) return false;
        const tag = part.match(/^[\w-]+/); return !tag || tag[0].toUpperCase() === this.tagName;
    }); }
    closest(s) { for (let n = this; n; n = n.parentElement) if (n.matches(s)) return n; return null; }
    querySelectorAll(s) { const out = []; for (const c of this.children) if (c.nodeType === 1) { if (c.matches(s)) out.push(c); out.push(...c.querySelectorAll(s)); } return out; }
    get text() { const all = []; const walk = n => { for (const c of n.children) c.nodeType === 3 ? all.push(c.nodeValue) : walk(c); }; walk(this); return all.join(''); }
}
function environment(source) {
    const html = new Element('html'), head = new Element('head'), body = new Element('body'); html.append(head); html.append(body);
    const listeners = new Map(), frames = new Map(), observers = [], calls = []; let next = 1;
    const doc = { documentElement: html, head, body, activeElement: null, querySelectorAll: s => html.querySelectorAll(s), getElementById: id => html.querySelectorAll('#' + id)[0], createElement: tag => new Element(tag), addEventListener: (n, f) => listeners.set(n, f), removeEventListener: (n, f) => { if (listeners.get(n) === f) listeners.delete(n); }, createTreeWalker(rootNode) { const nodes = []; const walk = n => { for (const c of n.children) { if (c.nodeType === 3) nodes.push(c); else walk(c); } }; walk(rootNode); let i = 0; return { currentNode: null, nextNode() { this.currentNode = nodes[i++]; return !!this.currentNode; } }; } };
    class Observer { constructor(fn) { this.fn = fn; this.targets = []; observers.push(this); } observe(n, o) { this.targets.push([n, o]); } disconnect() { this.targets = []; } }
    const host = { document: doc, MutationObserver: Observer, requestAnimationFrame: fn => { const id = next++; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id), setInterval: () => next++, clearInterval() {}, confirm: message => { calls.push(message); return false; } }; host.parent = host;
    const cleanups = [];
    const settle = () => { for (let i = 0; frames.size && i < 10; i++) { const jobs = [...frames.values()]; frames.clear(); jobs.forEach(f => f()); } };
    return { html, body, host, calls, cleanups, run: () => { vm.runInNewContext(source, { window: host, BlueLemonade: { onCleanup: f => cleanups.push(f) }, console }, { timeout: 2000 }); settle(); }, settle, click(target) { listeners.get('click')?.({ target }); settle(); }, mutate() { observers.filter(o => o.targets.length).forEach(o => o.fn()); settle(); } };
}
const add = (parent, tag, attrs, text) => parent.append(new Element(tag, attrs, text));

// 시험용 사전: 진짜 사전에 시험 글의 지문을 더해 번들 코드를 다시 짜요.
const LONG = '这是一段测试用的很长句子，第 7 次检查指纹查找能否正常工作。';
const LONG_ATTR = '这是给提示文字准备的测试长句，用来确认属性也会被替换。';
const LONG_QUOTE = '测试用：请到「设置页」里找到第 3 个开关再回来看看效果。';
const LONG_TOAST = '这是测试用的长提示消息，只在面板里点过之后才会翻译。';
const LONG_CONFIRM = '这是测试用的确认对话框问题，真的要把第 42 条删掉吗？';
const SHORT = '短测试句子';
const BLOCK = ['5', ' 测试项 · ', '9', ' 测试组'];
const fake = {
    [fingerprint(normalize(LONG)).id]: ['시험용 긴 문장이에요. {0}번째 지문 찾기 점검.', 't'],
    [fingerprint(normalize(LONG_ATTR)).id]: ['속성 시험 번역', 'a'],
    [fingerprint(normalize(LONG_QUOTE)).id]: ['「{0}」에서 {1}번째 스위치를 찾아요', 't'],
    [fingerprint(normalize(LONG_TOAST)).id]: ['시험 알림 번역', 'o'],
    [fingerprint(normalize(LONG_CONFIRM)).id]: ['{0}번을 지울까요?', 'n'],
    [fingerprint(SHORT).id]: ['짧은 글은 지문으로 찾지 않아요', 't'],
};
const fakeBlocks = { [fingerprint(normalize(BLOCK.join(''))).id]: ['항목 {0}개', ' · ', null, '묶음'] };
const testData = { ...data, hashed: { ...data.hashed, ...fake }, blocks: { ...data.blocks, ...fakeBlocks } };
const testCode = code.slice(0, at) + MARK + JSON.stringify(testData) + tail;

const e = environment(testCode);
const panel = add(e.html, 'div', { id: 'fruit-heart-v6', class: 'open' });
const long = add(panel, 'p', {}, '  ' + LONG + ' ');
const attr = add(panel, 'input', { placeholder: LONG_ATTR });
const quote = add(panel, 'p', {}, LONG_QUOTE);
const short = add(panel, 'p', {}, SHORT);
const stat = add(panel, 'div', { 'data-exp-stat': '' });
add(stat, 'b', {}, BLOCK[0]); stat.append({ nodeType: 3, nodeValue: BLOCK[1] }); add(stat, 'b', {}, BLOCK[2]); stat.append({ nodeType: 3, nodeValue: BLOCK[3] });
const code1 = add(panel, 'code', {}, LONG);
const toastBox = add(e.body, 'div', { id: 'toast-container' });
e.run();

check('긴 글은 지문으로 찾아 번역하고 숫자를 제자리에 채우며 앞뒤 공백은 그대로예요', () => assert.equal(long.text, '  시험용 긴 문장이에요. 7번째 지문 찾기 점검. '));
check('속성(placeholder)도 지문으로 바꿔요', () => assert.equal(attr.getAttribute('placeholder'), '속성 시험 번역'));
check('「」 안쪽과 숫자를 순서대로 채워요', () => assert.equal(quote.text, '「设置页」에서 3번째 스위치를 찾아요'));
check('16자 미만 짧은 글은 지문으로 찾지 않아요', () => assert.equal(short.text, SHORT));
check('묶음: 노드별 조각을 바꾸고 null 조각은 그대로 둬요', () => assert.equal(stat.text, '항목 5개 · 9묶음'));
check('코드 칸(code)은 지문이 맞아도 그대로예요', () => assert.equal(code1.text, LONG));

const toast = add(toastBox, 'div', { class: 'toast-message' }, LONG_TOAST); e.mutate();
// 1.1.6: 알림은 패널을 누르지 않아도(15초 창 없이) 지문(알림 종류)이 맞으면 바꿔요.
check('알림은 패널을 누르기 전에도 지문(알림 종류)으로 바꿔요', () => assert.equal(toast.text, '시험 알림 번역'));
e.click(panel); toast.children[0].nodeValue = LONG_TOAST; e.mutate();
check('글이 원문으로 다시 바뀌어도 또 번역해요', () => assert.equal(toast.text, '시험 알림 번역'));
const textToast = add(toastBox, 'div', { class: 'toast-message' }, LONG); e.mutate();
check('글 종류(t) 지문은 알림 판정에 쓰지 않아요', () => assert.equal(textToast.text, LONG));
e.host.confirm(LONG_CONFIRM);
check('확인 창은 지문(확인 창 종류)으로 바꾸고 숫자를 채워요', () => assert.equal(e.calls.at(-1), '42번을 지울까요?'));
e.host.confirm(LONG);
check('글 종류 지문은 확인 창 판정에 쓰지 않아요', () => assert.equal(e.calls.at(-1), LONG));

e.mutate();
check('다시 칠해도 묶음 결과가 같아요', () => assert.equal(stat.text, '항목 5개 · 9묶음'));
e.cleanups.at(-1)();
check('끄면 원문으로 돌아가요(글 · 속성 · 묶음)', () => { assert.equal(long.text, '  ' + LONG + ' '); assert.equal(attr.getAttribute('placeholder'), LONG_ATTR); assert.equal(stat.text, BLOCK.join('')); });

console.log(`fruit-heart-hashed: ${passed} 통과`);
