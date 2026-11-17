// 버그 사냥 6차 — 테마 고르기 목록(src/selects.js)이 열린 채 Esc: 목록만 닫혀야 해요
//   목록의 Esc 는 document 캡처에서 stopPropagation 만 해서, 같은 document 캡처에 나중에 걸린 리스너(전개 지시 창 onPopupKeydown ·
//   TTS 이름 목소리 상자)도 같이 돌았어요 — 전개 지시 창에서 프롬프트를 고치다 「넣는 곳」 · 「역할」 목록을 열고 Esc 를 누르면 고치던 창째 닫혔어요.
//   node tools/tests/select-pick-esc.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
//   jsdom 이 없으면 알리고 끝나요(통과로 치지 않아요 — 종료 코드 2).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const source = fs.readFileSync(path.join(root, 'src/selects.js'), 'utf8');
const plain = source.split('\n').filter(line => !/^import /.test(line)).join('\n').replace(/^export /gm, '');
const dom = new JSDOM('<!doctype html><body class="salty"><div id="pop"><select id="s"><option value="a">가</option><option value="b">나</option></select></div></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.getSettings = window.readSettings = () => ({ chat: { selectPop: true } });
window.watchDom = () => () => {};
window.matchMedia ||= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
window.Range.prototype.getBoundingClientRect ||= () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });   // jsdom 에 없어요(자리 잡기만)
window.Range.prototype.getClientRects ||= () => [];
window.eval(plain + '\nwindow.__sel = { startSelectPop };');
window.__sel.startSelectPop();

// 전개 지시 창처럼 목록을 연 뒤(창이 열릴 때) 같은 document 캡처에 Esc 리스너를 걸어요
let popupClosed = 0;
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.target.closest?.('dialog')) popupClosed++; }, true);

const sel = document.getElementById('s');
sel.focus();
sel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
assert.ok(document.querySelector('.salty-pick-layer'), '키보드 Enter 로 목록이 열려요');
(document.activeElement || document.body).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
assert.equal(document.querySelector('.salty-pick-layer'), null, 'Esc 로 목록이 닫혀요');
assert.equal(popupClosed, 0, '목록이 받은 Esc 는 밑의 창(같은 document 캡처 리스너)으로 안 가요');

// 목록이 없을 때 Esc 는 그대로 밑의 창 몫
sel.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
assert.equal(popupClosed, 1, '목록이 없으면 Esc 는 창 몫이에요');
console.log('select-pick-esc: 3 통과');
