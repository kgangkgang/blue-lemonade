// 버그 사냥 7 (6차 남김) — 전개 지시 창(src/addons/direction/index.js closePopup)을 Esc · 닫기 단추로 닫으면 초점이 body 로 떨어졌어요
//   창 안(입력칸 · 단추)에 초점이 있었으면 이제 창을 연 입력판의 깃털 단추로 돌려줘요. 창 밖으로 간 초점은 그대로 둬요.
//   소스에서 closePopup 만 잘라 jsdom 에서 돌려요(곁 함수는 가짜).
//   node tools/tests/direction-close-focus.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   (jsdom 이 없으면 종료 코드 2)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const src = fs.readFileSync(path.join(root, 'src/addons/direction/index.js'), 'utf8');
const a = src.indexOf('\nfunction closePopup() {');
assert.ok(a >= 0, 'closePopup 을 찾았어요');
const closePopup = src.slice(a, src.indexOf('\n}\n', a) + 2);

const dom = new JSDOM('<!doctype html><body><div id="send_form"><button id="jj-button">깃털</button><textarea id="send_textarea"></textarea></div></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
const { document } = window;
window.eval(`let popup = null, listView = null, pageTarget = null, sendWatch = null, promptsResize = null, chatUnflushed = false;
const typingRefreshers = [];
const button = document.getElementById('jj-button');
const endPromptDrag = () => {}, cancelPromptPress = () => {}, refreshButton = () => {}, onOutsidePointer = () => {}, onPopupKeydown = () => {}, getContext = () => ({});
${closePopup}
window.__d = { open() { popup = document.createElement('div'); popup.id = 'jj-popup'; popup.innerHTML = '<textarea class="jj-ta"></textarea><button data-act="close">닫기</button>'; document.getElementById('send_form').append(popup); return popup; }, closePopup };`);

let pass = 0;
{
    const p = window.__d.open();
    p.querySelector('.jj-ta').focus();
    assert.equal(document.activeElement.className, 'jj-ta');
    window.__d.closePopup();
    assert.equal(document.activeElement.id, 'jj-button', 'Esc 로 닫으면 초점이 깃털 단추로 돌아와요');
    pass++;
}
{
    const p = window.__d.open();
    p.querySelector('[data-act="close"]').focus();
    window.__d.closePopup();
    assert.equal(document.activeElement.id, 'jj-button', '닫기 단추로 닫아도 깃털 단추로');
    pass++;
}
{
    window.__d.open();
    document.getElementById('send_textarea').focus();
    window.__d.closePopup();
    assert.equal(document.activeElement.id, 'send_textarea', '창 밖(입력칸)으로 간 초점은 그대로');
    pass++;
}
console.log(`direction-close-focus: ${pass} 통과`);
