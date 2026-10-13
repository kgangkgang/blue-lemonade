// 6.3.3 확장 순서 › 요술봉 항목 숨김 · 위로 고정 (src/addons/order/menu-plan.js 순수 함수 + 배선) · 모델 전환 상태 칩 이름 한 줄 (css/19-extwindows.css)
//   node tools/tests/order-menus.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { planWand, toggleIn, cleanList, normalizeMenuPrefs, HIDDEN_CLASS, MENU_KINDS } = await import(pathToFileURL(path.join(root, 'src/addons/order/menu-plan.js')));

const results = [];
async function test(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }
const keys = ['id:cg-wand-button:0', 'id:bl-tool-menu-modelswitch:0', 'id:rl-wand-button:0', 'fa-solid fa-volume-high:0', 'fa-solid fa-glasses:0'];
const ord = plan => Object.fromEntries([...plan.orders.entries()]);

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
    const p = planWand(keys, { hidden: [keys[1], 'id:gone:0', keys[1]] });
    assert.deepEqual([...p.hidden], [keys[1]]);
    assert.deepEqual(ord(planWand(keys, { hidden: [keys[1]] })), Object.fromEntries(keys.map(k => [k, null])), 'hiding alone does not assign orders');
});
await test('toggleIn / cleanList: add once, remove on second toggle, blanks and duplicates dropped', () => {
    assert.deepEqual(toggleIn([], 'a'), ['a']);
    assert.deepEqual(toggleIn(['a', 'b'], 'a'), ['b']);
    assert.deepEqual(toggleIn(['a', 'a', ' ', null], 'b'), ['a', 'b']);
    assert.deepEqual(toggleIn(['a'], ''), ['a']);
    assert.deepEqual(cleanList(undefined), []);
});
await test('normalizeMenuPrefs: builds { wand: [] } shapes, cleans lists, reports changes', () => {
    const s = {};
    assert.equal(normalizeMenuPrefs(s), true);
    assert.deepEqual(s, { menuHidden: { wand: [] }, menuPinned: { wand: [] } });
    assert.equal(normalizeMenuPrefs(s), false, 'already clean → no change');
    const t = { menuHidden: ['x'], menuPinned: { wand: ['a', 'a', ''], chat: ['z'] } };
    assert.equal(normalizeMenuPrefs(t), true);
    assert.deepEqual(t.menuHidden, { wand: [] });
    assert.deepEqual(t.menuPinned, { wand: ['a'] }, 'only the wand kind is kept (MENU_KINDS)');
    assert.deepEqual([...MENU_KINDS], ['wand']);
    assert.equal(normalizeMenuPrefs(null), false);
});
await test('wiring: menus.js plans with planWand and toggles the hidden class; state.js has the defaults; style hides with one scoped rule', () => {
    const menus = read('src/addons/order/menus.js');
    assert.match(menus, /import \{[^}]*planWand[^}]*\} from '\.\/menu-plan\.js'/);
    assert.match(menus, /planWand\(rows\.map\(r=>r\.key\)/);
    assert.match(menus, /classList\.toggle\(HIDDEN_CLASS/);
    assert.match(menus, /data-act="pin"|po-pin/);
    assert.match(menus, /po-hide/);
    assert.ok(!/addEventListener\(['"]touch/.test(menus), 'no touch listeners');
    const state = read('src/addons/order/state.js');
    assert.match(state, /menuHidden: \{ wand: \[\] \}/);
    assert.match(state, /menuPinned: \{ wand: \[\] \}/);
    assert.match(state, /normalizeMenuPrefs\(store\)/);
    const css = read('src/addons/order/style.css');
    assert.match(css, new RegExp(`#extensionsMenu \\.${HIDDEN_CLASS}\\{display:none!important\\}`));
    assert.ok(!new RegExp(String.fromCharCode(0xAC24)).test(menus + state + css + read('src/addons/order/menu-plan.js')), 'no forbidden syllable');   // 글자 대신 코드 (이 시험 파일도 공개 글이라)
});
await test('model switch state chip name: one-line ellipsis rule outranks the theme normal-wrap rule (css/19-extwindows.css)', () => {
    const css = read('css/19-extwindows.css');
    const wrap = css.indexOf("html body.salty :is(.ms-chip b,.ms-chip small,.ms-target small) { white-space:normal; overflow-wrap:anywhere; }");
    const nowrap = css.indexOf('html body.salty .ms-chip.ms-state .ms-state-go > b { max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; overflow-wrap:normal; }');
    assert.ok(wrap > 0 && nowrap > wrap, 'nowrap rule exists after the wrap rule');
    assert.ok(!/ms-state-go > b \{[^}]*!important/.test(css), 'no !important needed (specificity 0,4,3 beats 0,2,3)');
    assert.ok(read('style.css').includes('.ms-chip.ms-state .ms-state-go > b'), 'style.css rebuilt');
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/order-menus\.mjs \./);
});

const failed = results.filter(r => !r.pass);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
