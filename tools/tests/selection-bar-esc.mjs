// 버그 사냥 7 — 채팅 글을 골라 뜬 도구 줄(src/selection-bar.js)을 Esc 로 닫으면 Esc 가 실리태번으로도 넘어갔어요
//   실리태번 문서 Esc(script.js · RossAscends-mods.js)는 답을 만드는 중이면 생성을 멈추고 열린 서랍을 닫아요 — 줄만 닫으려던 Esc 가 그 일까지 했어요.
//   이제 줄이 보일 때만 캡처 단계에서 받아 거기서 멈춰요. 줄이 없으면 Esc 는 그대로 실리태번 몫.
//   소스에서 그 리스너만 잘라 jsdom 에서 돌려요.
//   node tools/tests/selection-bar-esc.mjs <테마 루트> [jsdom 이 든 node_modules 의 부모 폴더]   (jsdom 이 없으면 종료 코드 2)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(process.argv[2] || '.');
const jsdomHome = process.argv[3] || process.env.BL_JSDOM || root;
let JSDOM;
try { ({ JSDOM } = createRequire(path.join(path.resolve(jsdomHome), 'x.js'))('jsdom')); }
catch { console.log(`jsdom 을 못 찾았어요(${jsdomHome}) — 이 시험은 돌지 않았어요`); process.exit(2); }
const src = fs.readFileSync(path.join(root, 'src/selection-bar.js'), 'utf8');
const a = src.indexOf("    document.addEventListener('keydown', (event) => {", src.indexOf('function start()'));
assert.ok(a > 0, '도구 줄 Esc 리스너를 찾았어요');
const tail = /\n    \}(, true)?\);/.exec(src.slice(a));
const block = src.slice(a, a + tail.index + tail[0].length);

const dom = new JSDOM('<!doctype html><body><div id="chat">글</div><div class="bl-sel-bar"></div></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom; const { document } = window;
let stEsc = 0;
document.addEventListener('keydown', e => { if (e.key === 'Escape') stEsc++; });   // 실리태번 $(document).on('keydown') 흉내 — 먼저 걸림
window.eval(`let bar = document.querySelector('.bl-sel-bar'); window.__hidden = 0; function hideSelectionBar() { bar.hidden = true; window.__hidden++; }\n${block}`);
const esc = () => document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
esc();
assert.equal(window.__hidden, 1, '줄이 닫혀요');
assert.equal(stEsc, 0, '줄을 닫은 Esc 가 실리태번(생성 멈춤 · 서랍 닫기)으로 넘어가요');
esc();
assert.equal(window.__hidden, 1);
assert.equal(stEsc, 1, '줄이 없으면 Esc 는 실리태번 몫');
console.log('selection-bar-esc: 4 통과');
