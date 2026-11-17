// 버그 사냥 7 (6차 남김) — 떠 있는 작은 메뉴(src/quick/shared.js openMenu · src/chat-organizer.js openMenu)의 키보드 초점
//   ① 키보드 · 마우스 기기에서 메뉴를 열어도 초점이 메뉴 안으로 안 들어갔어요(빠른 메뉴: 켜짐 묶음 · 프리셋 폴더 ⋯) — 이제 첫 항목으로
//   ② 위 · 아래 화살표 · Home · End 로 항목을 옮겨 다녀요
//   ③ Esc · 항목 고르기로 닫으면 초점이 body 로 떨어졌어요 — 이제 메뉴를 연 단추로 돌아와요
//   소스에서 메뉴 함수만 잘라 jsdom 에서 돌려요.
//   node tools/tests/quick-menu-focus.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   (jsdom 이 없으면 종료 코드 2 — 통과로 치지 않아요)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }

const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const fn = (src, name) => { const a = src.search(new RegExp(`(^|\\n)(export )?function ${name}\\(`)); assert.ok(a >= 0, name); const b = src.indexOf('\n}\n', a + 1); return src.slice(a, b + 2).replace(/^\n?export /, '\n'); };
let pass = 0;

for (const [file, extra] of [['src/quick/shared.js', ''], ['src/chat-organizer.js', 'const mouseDevice = () => window.__mouse;']]) {
    const src = read(file);
    const dom = new JSDOM('<!doctype html><body><button id="anchor">⋯</button><button id="other">다른</button></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
    const { window } = dom;
    const { document } = window;
    window.__mouse = true;
    window.matchMedia = q => ({ matches: /hover: hover|pointer: fine/.test(q), addEventListener() {}, removeEventListener() {} });
    window.pickRect = () => ({ width: 160, left: 0, top: 30, maxHeight: 300, up: false });
    window.backLayer = () => () => {};   // 1.6.9 뒤로 가기 겹(src/back-close.js) 대역
    window.warn = () => {};
    const esc = 'const esc = s => String(s);';
    const consts = (src.match(/\nconst mouseDevice = [^\n]+\n/) || [''])[0];
    window.eval(`let menu = null;\n${esc}\n${extra}\n${consts}\n${fn(src, 'swallowNextClick')}${fn(src, 'closeMenu')}${fn(src, 'openMenu')}\nwindow.__m = { openMenu, closeMenu };`);
    const anchor = document.getElementById('anchor');
    const ran = [];
    const items = [{ label: '가', run: () => ran.push('가') }, { label: '나', run: () => ran.push('나') }, { label: '다', disabled: true }, { label: '라', run: () => ran.push('라') }];
    const key = (k) => (document.activeElement || document.body).dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const label = () => document.activeElement?.textContent?.trim();

    anchor.focus();
    window.__m.openMenu(anchor, items);
    assert.ok(document.querySelector('[role="menu"]'), `${file}: 메뉴가 열려요`);
    assert.equal(label(), '가', `${file}: 열면 초점이 첫 항목으로`);
    key('ArrowDown'); assert.equal(label(), '나', `${file}: 아래 화살표`);
    key('ArrowDown'); assert.equal(label(), '라', `${file}: 막힌 항목은 건너뛰어요`);
    key('ArrowDown'); assert.equal(label(), '가', `${file}: 끝에서 처음으로`);
    key('ArrowUp'); assert.equal(label(), '라', `${file}: 위 화살표`);
    key('Home'); assert.equal(label(), '가', `${file}: Home`);
    key('End'); assert.equal(label(), '라', `${file}: End`);
    key('Escape');
    assert.equal(document.querySelector('[role="menu"]'), null, `${file}: Esc 로 닫혀요`);
    assert.equal(document.activeElement, anchor, `${file}: Esc 로 닫으면 초점이 연 단추로 돌아와요`);

    window.__m.openMenu(anchor, items);
    document.querySelectorAll('[role="menuitem"]')[1].click();
    await new Promise(r => setTimeout(r, 0));
    assert.deepEqual(ran, ['나']);
    assert.equal(document.activeElement, anchor, `${file}: 항목을 고르고 닫혀도 초점이 연 단추로`);

    // 메뉴 밖으로 초점이 옮겨 간 뒤 닫히면 끌어오지 않아요
    window.__m.openMenu(anchor, items);
    document.getElementById('other').focus();
    window.__m.closeMenu();
    assert.equal(document.activeElement.id, 'other', `${file}: 밖으로 간 초점은 그대로`);

    // 터치 기기는 초점을 옮기지 않아요(폰 화면 키보드 · 초점 테두리 없음)
    window.__mouse = false;
    window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    anchor.focus();
    window.__m.openMenu(anchor, items);
    assert.equal(document.activeElement, anchor, `${file}: 터치 기기는 그대로`);
    window.__m.closeMenu();
    pass++;
}
console.log(`quick-menu-focus: ${pass} 통과`);
