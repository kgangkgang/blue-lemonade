// 버그 사냥 6차 — 북마크 공용 시트(src/addons/bookmarks/ui-kit.js)의 Esc 와 그 위에 뜬 창
//   앞뒤 문맥 시트에서 그림을 꾹 눌러 크게 보기 창(<dialog> · src/addons/assets/viewer.js)을 열면, 시트의 window 캡처 Esc(모듈을 받을 때 걸려 늘 먼저 돎)가
//   stopImmediatePropagation 으로 그 창의 Esc 를 막고 밑의 시트를 닫았어요 — 그림 창은 그대로 남았어요.
//   이제 시트를 연 뒤에 새로 열린 <dialog> 가 있으면 Esc 는 그 창 몫이에요(시트는 그대로).
//   node tools/tests/bookmark-sheet-esc.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]
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

const source = fs.readFileSync(path.join(root, 'src/addons/bookmarks/ui-kit.js'), 'utf8');
const plain = source.split('\n').filter(line => !/^import /.test(line)).join('\n').replace(/^export /gm, '');
const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
window.applyTheme = () => {};
window.escapeHtml = s => String(s);
window.eval(plain + '\nwindow.__kit = { openSheet, hasOpenSheet };');
const { openSheet, hasOpenSheet } = window.__kit;
const { document } = window;
const esc = () => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

// ① 시트만 있으면 Esc 가 시트를 닫아요(예전 그대로)
{
    const sheet = openSheet({ title: '합성 시트' });
    esc();
    assert.equal(hasOpenSheet(), false, '시트 하나뿐이면 Esc 로 닫혀요');
    void sheet;
}

// ② 시트 위에 그림 창(<dialog open>)이 새로 열리면 Esc 는 그 창 몫 — 시트는 남고, 그 창의 Esc 처리가 불려요
{
    const sheet = openSheet({ title: '앞뒤 문맥' });
    const viewer = document.createElement('dialog');
    document.body.append(viewer);
    viewer.setAttribute('open', '');
    let viewerGot = 0;
    const onEsc = event => { if (event.key !== 'Escape' || !viewer.open) return; event.preventDefault(); event.stopImmediatePropagation(); viewerGot++; viewer.removeAttribute('open'); viewer.remove(); };
    window.addEventListener('keydown', onEsc, true);   // 그림 창은 열릴 때 거니 시트 것보다 늦게 걸려요
    esc();
    assert.equal(viewerGot, 1, '그림 창의 Esc 처리가 불려요');
    assert.equal(hasOpenSheet(), true, '밑의 시트는 그대로예요');
    window.removeEventListener('keydown', onEsc, true);
    esc();
    assert.equal(hasOpenSheet(), false, '그림 창이 닫힌 뒤 Esc 는 다시 시트를 닫아요');
    void sheet;
}

// ③ 시트를 열 때 이미 떠 있던 <dialog>(시트 밑)는 시트의 Esc 를 막지 않아요
{
    const under = document.createElement('dialog');
    document.body.append(under);
    under.setAttribute('open', '');
    openSheet({ title: '창 위의 시트' });
    esc();
    assert.equal(hasOpenSheet(), false, '밑에 있던 창은 시트 Esc 를 막지 않아요');
    under.remove();
}
console.log('bookmark-sheet-esc: 3 통과');
