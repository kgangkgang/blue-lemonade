// 버그 사냥 7 — 월드 인포 항목의 「⋯」 메뉴(src/layout.js .bl-wi-actions)를 연 채 Esc: 메뉴만 닫혀야 해요
//   메뉴의 Esc 는 문서 거품 단계라, 먼저 걸린 실리태번 Esc(RossAscends-mods.js — 열린 월드 인포 서랍을 닫음 · 답을 만드는 중이면 생성 멈춤)도 같이 돌았어요.
//   이제 메뉴가 열려 있을 때만 캡처 단계에서 받아 거기서 멈춰요. 메뉴가 없으면 Esc 는 그대로 실리태번 몫.
//   소스에서 그 리스너만 잘라 jsdom 에서 돌려요.
//   node tools/tests/wi-menu-esc.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   (jsdom 이 없으면 종료 코드 2)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const src = fs.readFileSync(path.join(root, 'src/layout.js'), 'utf8');
const a = src.indexOf("if (world) document.addEventListener('keydown'");
assert.ok(a > 0, '월드 인포 메뉴 Esc 리스너를 찾았어요');
const tail = /\n    \}(, true)?\);/.exec(src.slice(a));
const b = a + tail.index + tail[0].length;
const block = src.slice(a, b);

const dom = new JSDOM('<!doctype html><body><div id="WorldInfo"><details class="bl-wi-actions"><summary>⋯</summary><button id="act">복사</button></details></div></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom; const { document } = window;
let stEsc = 0;
document.addEventListener('keydown', e => { if (e.key === 'Escape') stEsc++; });   // 실리태번 $(document).on('keydown') 흉내 — 먼저 걸림
window.eval(`const world = document.getElementById('WorldInfo');\n${block}`);
const menu = document.querySelector('.bl-wi-actions');
const esc = el => el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

menu.open = true;
document.getElementById('act').focus();
esc(document.activeElement);
assert.equal(menu.open, false, '메뉴가 닫혀요');
assert.equal(document.activeElement.tagName, 'SUMMARY', '초점은 메뉴 머리로');
assert.equal(stEsc, 0, '메뉴를 닫은 Esc 가 실리태번(서랍 닫기 · 생성 멈춤)으로 넘어가요');
esc(document.activeElement);
assert.equal(stEsc, 1, '메뉴가 없으면 Esc 는 실리태번 몫');
console.log('wi-menu-esc: 4 통과');
