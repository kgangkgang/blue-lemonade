// 8.2.7 폰에서 select 를 길게 누르면 단추 설명 창(모달)이 뜨는데, 손을 뗄 때 고르기 목록까지 열려 설명 창 뒤에 남던 것 (src/selects.js behindModal)
//   node tools/tests/select-pick-longpress.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));

const handlers = {};
let modal = null, tried = 0;
class HTMLSelectElement { constructor() { this.options = [{}]; this.classList = { contains: () => false }; } closest() { return null; } }
globalThis.HTMLSelectElement = HTMLSelectElement;
globalThis.Node = class {};
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = fn => fn();
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() {} }) };
globalThis.document = {
    body: { classList: { contains: c => c === 'salty' } },
    addEventListener: (type, fn) => { (handlers[type] ||= []).push(fn); },
    querySelector: sel => (sel === 'dialog:modal' ? modal : null),
    get activeElement() { tried++; throw new Error('목록 그리기 시도'); },   // open() 이 시작되면 여기서 멈춤 → OS 목록으로(경고)
};
const warn = console.warn; console.warn = () => {};
const { startSelectPop } = await import(pathToFileURL(path.join(root, 'src/selects.js')));
startSelectPop();
let sel = null;
const tap = () => {
    sel = new HTMLSelectElement();   // 누를 때마다 다른 칸 (같은 칸이면 open 이 열린 것으로 보고 닫아요)
    for (const fn of handlers.touchstart) fn({ target: sel, touches: [{ clientX: 10, clientY: 10 }] });
    for (const fn of handlers.touchend) fn({ target: sel, changedTouches: [{ clientX: 10, clientY: 10 }], preventDefault() {} });
};
tap();
assert.equal(tried, 1, '그냥 톡 누르면 목록을 열어요');
modal = { contains: () => false };   // 길게 누르는 사이 select 밖에 설명 창(모달)이 떴어요
tap();
assert.equal(tried, 1, '설명 창이 떠 있으면 손을 떼도 목록을 열지 않아요');
modal = { contains: el => el instanceof HTMLSelectElement }; // select 가 그 모달 안에 있으면(실리태번 팝업 속 select) 그대로 열어요
tap();
assert.equal(tried, 2, '모달 안의 select 는 그대로 열어요');
console.warn = warn;
console.log('PASS 길게 누르기 설명 창이 뜬 누름은 고르기 목록을 열지 않고, 모달 안 select 는 그대로 열어요');
