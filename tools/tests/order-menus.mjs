// 6.3.3 확장 순서 › 요술봉 항목 숨김 · 위로 고정 (src/addons/order/menu-plan.js 순수 함수 + 배선) · 모델 전환 상태 칩 이름 한 줄 (css/19-extwindows.css)
// + 6.3.4 뒤 고침: 테마가 정하는 항목의 눈 = 그 테마 설정 · 고정을 지키는 순서 바꾸기 · 키 그대로 · 눈/핀 이름 고정 · 반쪽 원 아이콘은 말줄임 밖
//   node tools/tests/order-menus.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { planWand, toggleIn, cleanList, latentOrder, swapKeys, ownerOf, ownerShown, setOwner, normalizeMenuPrefs, HIDDEN_CLASS, MENU_KINDS, WAND_OWNERS } = await import(pathToFileURL(path.join(root, 'src/addons/order/menu-plan.js')));

const results = [];
async function test(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }
const keys = ['id:cg-wand-button:0', 'id:bl-tool-menu-modelswitch:0', 'id:rl-wand-button:0', 'fa-solid fa-volume-high:0', 'fa-solid fa-glasses:0'];
const ord = plan => Object.fromEntries([...plan.orders.entries()]);
// 화면 차례: order 값(없으면 0) → 같으면 DOM 차례 (flex order 와 같은 규칙)
const visual = (list, p) => { const plan = planWand(list, p); return list.map((k, i) => ({ k, i, o: plan.orders.get(k) ?? 0 })).sort((a, b) => (a.o - b.o) || (a.i - b.i)).map(x => x.k); };

await test('no saved order, no pins → every item gets null (inline order removed, original places)', () => {
    const p = planWand(keys, {});
    assert.deepEqual(ord(p), Object.fromEntries(keys.map(k => [k, null])));
    assert.equal(p.hidden.size, 0);
});
await test('saved order only → sequential orders by that order, unknown keys after, stable', () => {
    const p = planWand(keys, { order: [keys[2], keys[0]] });
    assert.deepEqual(ord(p), { [keys[2]]: 0, [keys[0]]: 1, [keys[1]]: 2, [keys[3]]: 3, [keys[4]]: 4 });
});
await test('pins only → pinned first with negative orders in pin order, the rest keep their current places', () => {
    const p = planWand(keys, { pinned: [keys[3], keys[1], 'id:not-there:0'] });
    assert.deepEqual(ord(p), { [keys[3]]: -1000, [keys[1]]: -999, [keys[0]]: 0, [keys[2]]: 1, [keys[4]]: 2 });
});
await test('pins + saved order → pins win, the rest follow the saved order', () => {
    const p = planWand(keys, { pinned: [keys[4]], order: [keys[2], keys[4], keys[0]] });
    assert.deepEqual(ord(p), { [keys[4]]: -1000, [keys[2]]: 0, [keys[0]]: 1, [keys[1]]: 2, [keys[3]]: 3 });
});
await test('hidden keeps only keys that are present now (settings may hold keys of extensions that are off)', () => {
    const p = planWand(keys, { hidden: [keys[0], 'id:gone:0', keys[0]] });
    assert.deepEqual([...p.hidden], [keys[0]]);
    assert.deepEqual(ord(planWand(keys, { hidden: [keys[0]] })), Object.fromEntries(keys.map(k => [k, null])), 'hiding alone does not assign orders');
});
await test('toggleIn / cleanList: add once, remove on second toggle, blanks and duplicates dropped', () => {
    assert.deepEqual(toggleIn([], 'a'), ['a']);
    assert.deepEqual(toggleIn(['a', 'b'], 'a'), ['b']);
    assert.deepEqual(toggleIn(['a', 'a', ' ', null], 'b'), ['a', 'b']);
    assert.deepEqual(toggleIn(['a'], ''), ['a']);
    assert.deepEqual(cleanList(undefined), []);
});
await test('keys are compared as made: a key with a leading space (icon class " fa-solid fa-x") can be hidden, pinned and ordered', () => {
    const odd = [' fa-solid fa-x:0', 'id:a:0'];
    assert.deepEqual(cleanList([' fa-solid fa-x:0']), [' fa-solid fa-x:0'], 'no trim');
    const hidden = toggleIn([], odd[0]);
    assert.deepEqual(hidden, [' fa-solid fa-x:0']);
    assert.ok(planWand(odd, { hidden }).hidden.has(odd[0]), 'hidden matches the row key');
    assert.equal(planWand(odd, { pinned: [odd[0]] }).orders.get(odd[0]), -1000, 'pinned matches the row key');
    assert.deepEqual(ord(planWand(odd, { order: [odd[1], odd[0]] })), { [odd[1]]: 0, [odd[0]]: 1 }, 'saved order matches the row key');
});
await test('latentOrder / swapKeys: the order without pins, two keys swapped in place', () => {
    assert.deepEqual(latentOrder(['A', 'B', 'C'], []), ['A', 'B', 'C']);
    assert.deepEqual(latentOrder(['A', 'B', 'C', 'D'], ['C', 'A']), ['C', 'A', 'B', 'D']);
    assert.deepEqual(swapKeys(['A', 'B', 'C', 'D', 'E'], 'E', 'C'), ['A', 'B', 'E', 'D', 'C']);
    assert.deepEqual(swapKeys(['A', 'B'], 'A', 'Z'), ['A', 'B'], 'unknown key → unchanged');
});
await test('a move while something is pinned keeps the pinned item’s own place: unpin brings it back between its neighbours', () => {
    const dom = ['A', 'B', 'C', 'D', 'E'];
    assert.deepEqual(visual(dom, { pinned: ['D'] }), ['D', 'A', 'B', 'C', 'E']);
    // ↑ on E (shown below C) — menus.js: swapKeys(latentOrder(dom, saved), 'E', 'C')
    const saved = swapKeys(latentOrder(dom, []), 'E', 'C');
    assert.deepEqual(saved, ['A', 'B', 'E', 'D', 'C']);
    assert.deepEqual(visual(dom, { pinned: ['D'], order: saved }), ['D', 'A', 'B', 'E', 'C'], 'what the user sees right after the move');
    assert.deepEqual(visual(dom, { order: saved }), ['A', 'B', 'E', 'D', 'C'], 'unpinned: D is back between its neighbours, not at the top');
});
await test('theme-owned wand items: ownerOf maps menu keys to their theme setting (addonUI)', () => {
    assert.deepEqual(ownerOf('id:rl-wand-button:0')?.path, ['perfMenu', 'log']);
    assert.deepEqual(ownerOf('id:lt-wand-button:0')?.path, ['perfMenu', 'timer']);
    assert.deepEqual(ownerOf('id:bl-perf-menu-dedupe:0')?.path, ['perfMenu', 'dedupe']);
    assert.deepEqual(ownerOf('id:bl-tool-menu-modelswitch:0')?.path, ['modelswitchMenu']);
    assert.deepEqual(ownerOf('id:bl-notes-wand:0')?.path, ['notesMenu']);
    assert.deepEqual(ownerOf('id:bl-zip-install-menu:0')?.path, ['zipinstallMenu']);
    assert.deepEqual(ownerOf('id:bl-tool-menu-words:0')?.path, ['wordsMenu']);
    assert.equal(ownerOf('id:cg-wand-button:0'), null);
    assert.equal(ownerOf('id:bl-perf-menu-:0'), null, 'prefix alone is not a tab');
    assert.equal(ownerOf('fa-solid fa-x:0'), null);
    assert.ok(WAND_OWNERS.length >= 8);
});
await test('ownerShown / setOwner read and write the same value the theme reads (!== false for 「요술봉에 … 표시」, truthy for perf menus)', () => {
    const ui = { perfMenu: { log: true, timer: false }, modelswitchMenu: false };
    assert.equal(ownerShown(ui, ownerOf('id:rl-wand-button:0')), true);
    assert.equal(ownerShown(ui, ownerOf('id:lt-wand-button:0')), false);
    assert.equal(ownerShown(ui, ownerOf('id:bl-tool-menu-modelswitch:0')), false);
    assert.equal(ownerShown(ui, ownerOf('id:bl-notes-wand:0')), true, 'notesMenu unset → shown (theme reads !== false)');
    assert.equal(ownerShown(ui, ownerOf('id:bl-tool-menu-words:0')), false, 'wordsMenu unset → hidden (theme reads truthy)');
    setOwner(ui, ownerOf('id:rl-wand-button:0'), false);
    setOwner(ui, ownerOf('id:bl-tool-menu-modelswitch:0'), true);
    setOwner(ui, ownerOf('id:bl-perf-menu-watchdog:0'), true);
    assert.deepEqual(ui, { perfMenu: { log: false, timer: false, watchdog: true }, modelswitchMenu: true });
    const empty = {}; setOwner(empty, ownerOf('id:lt-wand-button:0'), true);
    assert.deepEqual(empty, { perfMenu: { timer: true } }, 'missing boxes are made');
});
await test('planWand never hides a theme-owned item itself (its theme setting decides)', () => {
    const p = planWand(keys, { hidden: [keys[1], keys[2], keys[0]] });
    assert.deepEqual([...p.hidden], [keys[0]]);
});
await test('normalizeMenuPrefs: builds { wand: … } shapes, cleans lists, keeps seen names of owned items only, reports changes', () => {
    const s = {};
    assert.equal(normalizeMenuPrefs(s), true);
    assert.deepEqual(s, { menuHidden: { wand: [] }, menuPinned: { wand: [] }, menuSeen: { wand: {} } });
    assert.equal(normalizeMenuPrefs(s), false, 'already clean → no change');
    const t = { menuHidden: ['x'], menuPinned: { wand: ['a', 'a', ''], chat: ['z'] }, menuSeen: { wand: { 'id:rl-wand-button:0': '요청 로그', 'id:cg-wand-button:0': 'x', 'id:bl-notes-wand:0': '' } } };
    assert.equal(normalizeMenuPrefs(t), true);
    assert.deepEqual(t.menuHidden, { wand: [] });
    assert.deepEqual(t.menuPinned, { wand: ['a'] }, 'only the wand kind is kept (MENU_KINDS)');
    assert.deepEqual(t.menuSeen, { wand: { 'id:rl-wand-button:0': '요청 로그' } });
    assert.deepEqual([...MENU_KINDS], ['wand']);
    assert.equal(normalizeMenuPrefs(null), false);
});
await test('wiring: menus.js plans with planWand, toggles the hidden class, swaps in the latent order, owned eyes write the theme setting and resync', () => {
    const menus = read('src/addons/order/menus.js');
    assert.match(menus, /import \{[^}]*planWand[^}]*\} from '\.\/menu-plan\.js'/);
    assert.match(menus, /from '\.\.\/\.\.\/settings\.js'/);
    assert.match(menus, /planWand\(rows\.map\(r=>r\.key\)/);
    assert.match(menus, /classList\.toggle\(HIDDEN_CLASS/);
    assert.match(menus, /swapKeys\(latentOrder\(domKeys,/);
    assert.match(menus, /setOwner\(addonUI\(\),owner,hidden\);saveThemeSettings\(\);await syncTheme\(\)/);
    assert.match(menus, /import\('\.\.\/\.\.\/addons\.js'\)\.then\(m=>m\.syncAddonIcons\(\)\)/);
    assert.match(menus, /moveOwnedHidden\(\);rememberOwned\(rows\)/);
    assert.ok(!/addEventListener\(['"]touch/.test(menus), 'no touch listeners');
    // 이름은 상태에 따라 바뀌지 않고 켜짐은 aria-pressed 가 말한다 (화면 읽기가 반대로 읽지 않게)
    assert.match(menus, /setAttribute\('aria-label',row\.label\+' 위에 고정'\);pin\.setAttribute\('aria-pressed'/);
    assert.match(menus, /setAttribute\('aria-label',row\.label\+' 숨기기'\);eye\.setAttribute\('aria-pressed'/);
    assert.ok(!/고정 풀기|' 보이기'/.test(menus), 'no flipping action labels');
    const state = read('src/addons/order/state.js');
    assert.match(state, /menuHidden: \{ wand: \[\] \}/);
    assert.match(state, /menuPinned: \{ wand: \[\] \}/);
    assert.match(state, /menuSeen: \{ wand: \{\} \}/);
    assert.match(state, /normalizeMenuPrefs\(store\)/);
    const css = read('src/addons/order/style.css');
    assert.match(css, new RegExp(`#extensionsMenu \\.${HIDDEN_CLASS}\\{display:none!important\\}`));
    assert.ok(!new RegExp(String.fromCharCode(0xAC24)).test(menus + state + css + read('src/addons/order/menu-plan.js') + read('tools/tests/order-menus.mjs')), 'no forbidden syllable');   // 글자 대신 코드 (이 시험 파일도 공개 글이라)
});
await test('model switch state chip: only the name is cut — the leading icon and the trailing half-circle (공급자 · 모델만) stay visible', () => {
    const css = read('css/19-extwindows.css');
    const wrap = css.indexOf("html body.salty :is(.ms-chip b,.ms-chip small,.ms-target small) { white-space:normal; overflow-wrap:anywhere; }");
    const row = css.indexOf('html body.salty .ms-chip.ms-state .ms-state-go > b { display:flex; align-items:baseline; max-width:100%; min-width:0; white-space:nowrap; overflow:hidden; overflow-wrap:normal; }');
    const name = css.indexOf('html body.salty .ms-chip.ms-state .ms-state-go > b > .ms-state-name { flex:0 1 auto; min-width:0; margin-left:.3em; overflow:hidden; text-overflow:ellipsis; }');
    const icons = css.indexOf('html body.salty .ms-chip.ms-state .ms-state-go > b > i { flex:none; }');
    assert.ok(wrap > 0 && row > wrap && name > row && icons > row, 'one-line rules come after the wrap rule');
    assert.ok(!/ms-state-go > b[^{]*\{[^}]*!important/.test(css), 'no !important needed (specificity beats 0,2,3)');
    assert.ok(read('style.css').includes('.ms-chip.ms-state .ms-state-go > b > .ms-state-name'), 'style.css rebuilt');
    const ms = read('src/addons/modelswitch/index.js');
    assert.ok(ms.includes('<b><i class="fa-solid fa-layer-group" aria-hidden="true"></i> <span class="ms-state-name">${esc(state.name)}</span>${part(state.items)}</b>'), 'name wrapped in its own span, the half-circle after it');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/order-menus\.mjs \./);
});

const failed = results.filter(r => !r.pass);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
