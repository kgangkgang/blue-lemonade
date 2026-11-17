// 버그 사냥 7 (6차 남김) — 프리셋 고르기 목록에서 폴더 「⋯」 메뉴를 연 뒤 Esc: 메뉴만 닫혀야 해요
//   목록의 Esc(document 캡처)가 메뉴의 Esc(같은 document 캡처 · 나중에 걸림)보다 먼저 돌아 목록의 close() 가 메뉴까지 닫았어요.
//   이제 목록은 열린 메뉴가 있으면 Esc 를 메뉴에 넘겨요. 두 번째 Esc 에 목록이 닫혀요.
//   가짜 브라우저(leak-dom) · 이름은 지어낸 것.  node tools/tests/preset-folder-menu-esc.mjs <테마 루트>
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const url = f => pathToFileURL(path.join(root, f)).href;

const dom = await import(url('tools/tests/leak-dom.mjs'));
const settings = { enabled: true, presetFolders: { on: true, folders: [{ id: 'g', name: '자주 씀', items: ['프리셋 둘'] }, { id: 'd', name: '긴 답', items: ['프리셋 셋'] }] } };
const { ctx } = dom.installBrowser({ settings });
dom.installHost(ctx);
const { register } = await import('node:module');
register(url('tools/tests/leak-loader.mjs'), { data: { root } });
console.warn = () => {};
document.body.classList.add('salty');

const names = ['기본', '프리셋 둘', '프리셋 셋'];
const sel = document.createElement('select');
sel.id = 'settings_preset_openai';
names.forEach((name, i) => { const o = document.createElement('option'); o.setAttribute('value', String(i)); o.textContent = name; sel.append(o); });
let selected = 0;
Object.defineProperty(sel, 'options', { get: () => Object.assign(sel.children.map((o, i) => Object.assign(o, { text: o.textContent, index: i })), {}) });
Object.defineProperty(sel, 'selectedIndex', { get: () => selected, set: v => { selected = v; } });
Object.defineProperty(sel, 'selectedOptions', { get: () => [sel.children[selected]] });
document.body.append(sel);

const P = await import(url('src/quick/preset-folders.js'));
P.syncPresetFolders(true);
const esc = () => document.body.dispatchEvent(new Event('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
const menu = () => document.querySelector('.bl-quick-layer');

P._forTest.open(sel);
assert.ok(P._forTest.layer(), '목록이 열려요');
P._forTest.layer().querySelector('.bl-pfo-head[data-f="g"] [data-pfo="menu"]').click();
assert.ok(menu(), '폴더 ⋯ 메뉴가 열려요');
esc();
assert.equal(menu(), null, 'Esc 로 메뉴가 닫혀요');
assert.ok(P._forTest.layer(), '첫 Esc 에 목록까지 닫혔어요');
esc();
assert.equal(P._forTest.layer(), null, '두 번째 Esc 에 목록이 닫혀요');
P.syncPresetFolders(false);
console.log('preset-folder-menu-esc: 3 통과');
