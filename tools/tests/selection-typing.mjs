// 8.2.5 입력칸에 글자를 칠 때 selectionchange 리스너가 Selection 을 읽지 않는지 (성능 빈틈 전수조사 7절 — 페르소나 설명 50자에 테마 JS 2~3초)
//   node tools/tests/selection-typing.mjs <테마 루트>
// 입력칸(textarea · input · contenteditable)에 글자를 칠 때마다 selectionchange 가 오고, 그때 Selection 의 isCollapsed · toString ·
// getClientRects 를 읽으면 문서 전체 스타일 · 배치를 강제로 계산한다. 다시 쓰기의 빠른 금지 칩(quick-ban.js)을 가짜 문서로 돌려
// 「입력 중이면 Selection 을 읽지 않는다 · 칩이 떠 있으면 숨기기만 · 채팅 글을 고르면 예전처럼 칩이 뜬다 · isCollapsed 는 읽지 않는다」를 보고,
// 번역 애드온 고른 글 도구 · 당겨서 새로고침은 같은 규칙이 글에 있는지 본다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

// ── 가짜 시계
let now = 0; const timers = [];
globalThis.setTimeout = (fn, ms) => { const t = { fn, at: now + (ms || 0), live: true }; timers.push(t); return t; };
globalThis.clearTimeout = t => { if (t) t.live = false; };
const tick = ms => { const end = now + ms; for (;;) { const due = timers.filter(t => t.live && t.at <= end).sort((a, b) => a.at - b.at)[0]; if (!due) break; now = due.at; due.live = false; due.fn(); } now = end; };
const liveTimers = () => timers.filter(t => t.live).length;

// ── 가짜 문서: Selection 읽기를 전부 적는다
const reads = [];
const listeners = new Map();
const el = (tag, { type = '', editable = false, classes = [], parent = null } = {}) => {
    const node = { nodeType: 1, tagName: tag, type, isContentEditable: editable, parentElement: parent, hidden: false, style: {}, offsetWidth: 60, offsetHeight: 28, children: [], classList: { contains: c => classes.includes(c) } };
    node.closest = sel => { for (let n = node; n; n = n.parentElement) { if (sel === '#chat .mes_text' && n.id === 'mes_text') return n; if (sel === '.translated_text' && n.classList.contains('translated_text')) return n; } return null; };
    node.querySelector = () => ({ textContent: '' });
    node.addEventListener = () => {};
    node.append = () => {};
    return node;
};
const body = el('BODY'); body.append = () => {};
const chat = el('DIV', { parent: body }); chat.id = 'chat';
const mes = el('DIV', { parent: chat }); mes.id = 'mes_text';
const textNode = { nodeType: 3, parentElement: mes };
const textarea = el('TEXTAREA', { parent: body });
const numberInput = el('INPUT', { type: 'number', parent: body });
const checkbox = el('INPUT', { type: 'checkbox', parent: body });
const editable = el('DIV', { editable: true, parent: body });
let active = body;
let selection = null;
function makeSelection({ collapsed = false, text = '낱말' } = {}) {
    const range = { collapsed, startContainer: textNode, endContainer: textNode, getClientRects: () => { reads.push('getClientRects'); return [{ width: 10, height: 12, left: 0, right: 10, top: 0, bottom: 12 }]; }, getBoundingClientRect: () => { reads.push('getBoundingClientRect'); return { left: 0, right: 10, top: 0, bottom: 12, width: 10, height: 12 }; } };
    const s = { rangeCount: 1, getRangeAt: () => { reads.push('getRangeAt'); return range; }, toString: () => { reads.push('toString'); return text; }, removeAllRanges: () => {} };
    Object.defineProperty(s, 'isCollapsed', { get() { reads.push('isCollapsed'); return collapsed; } });
    return s;
}
globalThis.document = {
    body,
    get activeElement() { return active; },
    getSelection: () => { reads.push('getSelection'); return selection; },
    addEventListener: (type, fn) => { listeners.set(type, fn); },
    getElementById: () => null,
    createElement: () => el('BUTTON'),
};
globalThis.window = { addEventListener: () => {}, innerHeight: 800, innerWidth: 1200 };
globalThis.matchMedia = () => ({ matches: false });

const { startQuickBan, setQuickBanEnabled } = await import(pathToFileURL(path.join(root, 'src/addons/rewrite/quick-ban.js')).href);
const { typingInField } = await import(pathToFileURL(path.join(root, 'src/addons/rewrite/quick-ban.js')).href);
let added = [];
startQuickBan(word => { added.push(word); return true; });
setQuickBanEnabled(true);
const fire = () => listeners.get('selectionchange')();
const chipShown = () => { const c = body.appended; return !!c && !c.hidden; };
body.append = c => { body.appended = c; };

let n = 0, failed = 0;
const test = (name, fn) => { try { fn(); n++; console.log(`ok ${n + failed} - ${name}`); } catch (e) { failed++; console.log(`not ok ${n + failed} - ${name}\n  ${e.message}`); } };

test('typingInField: textarea · 글 input · contenteditable 은 입력 중, 체크박스 · 본문은 아님', () => {
    assert.equal(typingInField(textarea), true);
    assert.equal(typingInField(numberInput), true);
    assert.equal(typingInField(editable), true);
    assert.equal(typingInField(checkbox), false);
    assert.equal(typingInField(body), false);
    assert.equal(typingInField(null), false);
});

test('textarea 에 글자를 칠 때(selectionchange × 50) Selection 을 한 번도 읽지 않고 타이머도 걸지 않는다', () => {
    active = textarea; selection = makeSelection({ collapsed: true }); reads.length = 0;
    for (let i = 0; i < 50; i++) { fire(); tick(263); }
    assert.deepEqual(reads, []);
    assert.equal(liveTimers(), 0);
    assert.equal(chipShown(), false);
});

test('채팅 글을 고르면(입력칸 밖) 예전처럼 250ms 뒤 칩이 뜬다 — isCollapsed 는 읽지 않는다', () => {
    active = body; selection = makeSelection({ collapsed: false, text: '낱말' }); reads.length = 0;
    fire(); assert.equal(chipShown(), false, '바로는 안 뜬다');
    tick(250);
    assert.equal(chipShown(), true);
    assert.ok(reads.includes('getSelection') && reads.includes('toString'), '채팅 선택은 읽는다: ' + reads.join(','));
    assert.ok(!reads.includes('isCollapsed'), 'isCollapsed 대신 getRangeAt(0).collapsed: ' + reads.join(','));
});

test('칩이 떠 있는데 입력칸에 초점이 가면 Selection 을 읽지 않고 숨기기만 한다', () => {
    assert.equal(chipShown(), true);
    active = textarea; reads.length = 0;
    fire();
    assert.equal(chipShown(), false);
    assert.deepEqual(reads, []);
    assert.equal(liveTimers(), 0);
});

test('contenteditable 안의 선택도 입력 중으로 본다 · 접힌 채팅 선택은 칩 없이 끝난다', () => {
    active = editable; selection = makeSelection({ collapsed: false }); reads.length = 0;
    fire(); tick(300); assert.deepEqual(reads, []); assert.equal(chipShown(), false);
    active = body; selection = makeSelection({ collapsed: true }); reads.length = 0;
    fire(); tick(300); assert.equal(chipShown(), false);
    assert.ok(!reads.includes('toString') && !reads.includes('getClientRects'), '접혀 있으면 글 · 자리를 읽지 않는다: ' + reads.join(','));
});

test('끈 상태(setQuickBanEnabled(false))에서는 아무것도 하지 않는다', () => {
    setQuickBanEnabled(false); active = body; selection = makeSelection({ collapsed: false }); reads.length = 0;
    fire(); tick(300); assert.deepEqual(reads, []); assert.equal(chipShown(), false);
    setQuickBanEnabled(true);
});

test('번역 애드온 고른 글 도구: selectionSnapshot · selectionChanged 가 입력 중이면 Selection 을 읽기 전에 돌아간다', () => {
    const tr = read('src/addons/translator/selection/translation.js');
    assert.match(tr, /export function typingInField\(element = document\.activeElement\)/);
    assert.match(tr, /export function selectionSnapshot\(\) \{\n\s+if \(document\.body\.classList\.contains\('cg-previewing'\)\) return null;\n\s+if \(typingInField\(\)\) return null;\n\s+const selected = window\.getSelection\(\);/);
    const idx = read('src/addons/translator/selection/index.js');
    assert.match(idx, /import \{ selectionSnapshot, typingInField \} from '\.\/translation\.js';/);
    assert.match(idx, /function selectionChanged\(\) \{\n\s+clearTimeout\(selectionTimer\);\n(\s+\/\/[^\n]*\n)?\s+if \(typingInField\(\) && !document\.getElementById\('llmt-selection-selection'\)\) return;/);
});

test('당겨서 새로고침: selectionchange 에서 isCollapsed 는 당기는 중 · 표시가 떠 있을 때만 읽는다', () => {
    assert.match(read('src/pull-to-refresh.js'), /listen\(doc, 'selectionchange', \(\) => \{ if \(\(gesture \|\| !indicator\.hidden\) && selected\(\)\) reset\(\); \}\);/);
});

test('다시 쓰기 · 북마크 · 번역 지우기 · 데우스 선택: selectionchange 리스너 전부에 입력칸 지킴이가 있다', () => {
    assert.match(read('src/addons/rewrite/quick-ban.js'), /if \(typingInField\(\)\) \{ if \(current\) hide\(\); return; \}/);
    assert.match(read('src/addons/bookmarks/selection-chip.js'), /if \(!held && typingInField\(\)\) return;/);
    assert.match(read('src/addons/translator/selection/delete.js'), /const onSelection = \(\) => \{ if \(!held && typingInField\(\)\) return; schedule\(\); \};/);
    assert.match(read('src/dem-selection.js'), /if \(typingOutside\(document\.activeElement\)\) return false;/);
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/selection-typing\.mjs \./);
});

console.log(`selection-typing: ${n}/${n + failed} 통과`);
if (failed) process.exit(1);
