import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ADDON_STYLE_IDS as IDS, addonStyleMark, ADDON_GATED_BUNDLE, ADDON_GATED_BOOT_BUNDLE, LATE_STYLE_IDS, gatedBundleFits, syncAddonStyleFlags } from '../../src/addon-style-bundle.js';
import { tables, expandSheet } from '../build-addon-css.mjs';
const MARKS = Object.fromEntries(IDS.map(id => [id, addonStyleMark(id)]));
const require = createRequire(import.meta.url), lib = require('../css-lib.cjs');
const { gateCss, gateSelector } = require('../css-addon-gate.cjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let passed = 0;
const test = (name, run) => { run(); passed++; console.log(`통과 ${passed}: ${name}`); };
test('대부분 켠 조합은 묶음을 쓰고 적게 켠 조합은 개별 시트를 써요', () => {
    assert.equal(gatedBundleFits(IDS), true);
    assert.equal(gatedBundleFits(IDS.filter(id => id !== 'notes')), true);
    for (const removed of IDS) assert.equal(gatedBundleFits(IDS.filter(id => id !== removed)), true);
    for (const ids of [[], ['notes'], ['perf', 'tts'], IDS.slice(2), ['notes', 'perf'], [...IDS].reverse(), [...IDS.slice(1), 'private'], [...IDS.slice(1), IDS[1]], null]) assert.equal(gatedBundleFits(ids), false);
});
test('뿌리·본문·의사 요소도 특이도를 바꾸지 않고 조건을 더해요', () => {
    for (const sel of [':root', ':root::highlight(lv-now)', 'html body.salty .panel', 'html[data-mode="dark"] .row', 'body.salty :is(.a,.b)', '.item:not(.off)::before']) {
        const next = gateSelector(sel, MARKS.notes);
        assert.deepEqual(lib.spec(next), lib.spec(sel));
        assert.ok(next.includes(MARKS.notes));
    }
    assert.throws(() => gateSelector(':is(html, body) .item', MARKS.notes), /검토/);
    assert.throws(() => gateSelector('.item', 'bad:root'), /표식/);
    assert.match(gateCss('@media (min-width:1px){.item{color:red}} @keyframes move{from{opacity:0}to{opacity:1}}', MARKS.notes), /@keyframes move\{from\{opacity:0\}to\{opacity:1\}\}/);
});
test('꺼진 애드온은 표식이 없고 같은 상태에는 DOM을 쓰지 않아요', () => {
    const classes = new Set(['keep-me']), writes = [];
    const doc = { documentElement: { classList: { contains: key => classes.has(key), toggle(key, on) { writes.push([key, on]); if (on) classes.add(key); else classes.delete(key); } } } };
    syncAddonStyleFlags(doc, ['perf', 'tts']); assert.equal(writes.length, 2);
    syncAddonStyleFlags(doc, ['perf', 'tts']); assert.equal(writes.length, 2);
    syncAddonStyleFlags(doc, ['tts']); assert.equal(classes.has(MARKS.perf), false);
    syncAddonStyleFlags(doc, []); assert.deepEqual([...classes], ['keep-me']);
});
test('활성 표식은 html을 스위치·토글 조상으로 오인하게 하지 않아요', () => {
    assert.equal(new Set(Object.values(MARKS)).size, IDS.length);
    for (const id of IDS) { assert.match(MARKS[id], /^bl-asc-\d+$/); assert.doesNotMatch(MARKS[id], /switch|toggle|button|checkbox|radio/); }
});
const signature = (rule, selector = rule.selector) => JSON.stringify({ ctx: rule.ctx, selector: lib.cleanSel(selector), declarations: rule.decls.map(d => [d.lname, d.value, d.important]) });
const expected = [];
const t = await tables(root);
for (const id of IDS) for (const sheet of expandSheet(root, t.sheetOf(id))) for (const node of sheet.nodes) {
    for (const rule of lib.flatRules(lib.parse(node.text))) expected.push({ id, signature: signature(rule) });
}
function readGated(file) {
    const errors = [], tree = lib.parse(fs.readFileSync(path.join(root, 'src/addons', file), 'utf8'), errors);
    assert.deepEqual(errors, []);
    return lib.flatRules(tree).map(rule => {
        const selectors = lib.topSplit(rule.selector, ',');
        const owners = new Set(), restored = selectors.map(selector => {
            // 생성기와 다른 경로로 조건이 하나뿐인지, 원래 특이도가 유지되는지 확인해요.
            const marks = [...selector.matchAll(/:where\((?:html)?\.bl-asc-(\d+)\)/g)];
            assert.equal(marks.length, 1, selector); owners.add(IDS[Number(marks[0][1])]);
            const old = selector.replace(marks[0][0], '').trim();
            assert.deepEqual(lib.spec(old), lib.spec(selector));
            return old;
        });
        assert.equal(owners.size, 1);
        return { id: [...owners][0], signature: signature(rule, restored.join(',')), selector: rule.selector };
    });
}
const actual = readGated(ADDON_GATED_BUNDLE);
const combinations = [[], IDS, IDS.filter(id => id !== 'notes'), IDS.filter((_, i) => i % 2 === 0), ...IDS.map(id => [id]), ...IDS.map(id => IDS.filter(x => x !== id))];
test(`활성 조합 ${combinations.length}개의 선언·조건·상대 순서가 개별 시트와 같아요`, () => {
    for (const ids of combinations) {
        const active = new Set(ids);
        assert.deepEqual(actual.filter(x => active.has(x.id)).map(x => x.signature), expected.filter(x => active.has(x.id)).map(x => x.signature), ids.join(','));
    }
});
test('첫 장에는 늦게 시작하는 애드온 규칙이 없고 감시 표지도 소유자 조건이 있어요', () => {
    const boot = readGated(ADDON_GATED_BOOT_BUNDLE);
    assert.ok(boot.length > 0 && boot.length < actual.length);
    for (const item of boot) assert.ok(!LATE_STYLE_IDS.includes(item.id), item.id);
    assert.ok(boot.some(item => item.selector.includes('.rl-root')), '성능 보조 창의 첫 사용 표지가 있어요');
});
test('연결은 조건부 묶음·전체 시트 전환·실패 대체·켜짐 갱신을 유지해요', () => {
    const src = fs.readFileSync(path.join(root, 'src/addons.js'), 'utf8');
    assert.match(src, /gatedBundleFits\(styled\)\?stylesheetBundle\(styled\)/);
    assert.match(src, /pendingSheets\.set\(link,addonUrl\(ADDON_GATED_BUNDLE\)\)/);
    assert.match(src, /bundledStyleIds=\[\];syncAddonStyleFlags\(document,\[\]\);throw error/);
    assert.match(src, /bundledStyleIds\.filter\(id=>addonsEnabled\(s\)&&s.addons\[id\]\)/);
});
console.log(`조건부 CSS 묶음 시험 ${passed}개를 통과했어요. 전체 규칙 ${actual.length}개를 대조했어요.`);
