// 실제 로더 함수를 작은 DOM에서 돌려요. 파일·네트워크·브라우저를 열지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ADDON_STYLE_IDS, addonStyleMark, ADDON_GATED_BUNDLE, ADDON_GATED_BOOT_BUNDLE, LATE_STYLE_IDS, syncAddonStyleFlags } from '../../src/addon-style-bundle.js';
const src = fs.readFileSync(new URL('../../src/addons.js', import.meta.url), 'utf8');
function part(startText, endText) {
    const start = src.indexOf(startText), end = src.indexOf(endText, start);
    assert.ok(start >= 0 && end > start); return src.slice(start, end).replace('export function', 'function');
}
function harness() {
    const links = [], classes = new Set(), fail = new Set();
    const loaded = link => queueMicrotask(() => { if (fail.has(link.href)) link.onerror?.(); else link.onload?.(); });
    const document = {
        documentElement: { classList: { contains: key => classes.has(key), toggle(key, on) { if (on) classes.add(key); else classes.delete(key); } } },
        head: { append(link) { links.push(link); loaded(link); } },
        createElement() { return { dataset: {}, get isConnected() { return links.includes(this); },
            remove() { const at = links.indexOf(this); if (at >= 0) links.splice(at, 1); },
            after(next) { links.splice(links.indexOf(this) + 1, 0, next); loaded(next); } }; },
    };
    const box = { document, setTimeout, clearTimeout, syncAddonStyleFlags, ADDON_GATED_BUNDLE, ADDON_GATED_BOOT_BUNDLE, LATE_STYLE_IDS, addonUrl: rel => rel };
    vm.runInNewContext('const pendingSheets=new Map();let bundledStyleIds=[];let upgrading=Promise.resolve();\n' +
        part('function attachStyle(', '\nconst addonUrl=') +
        part('function swapSheet(', '\n/** 첫 장을') +
        part('export function upgradeAddonStyles(', '\nfunction watchUpgrade') +
        part('function stylesheetBundle(', '\nasync function persist(') +
        '\nthis.pendingCount=()=>pendingSheets.size;this.ids=()=>bundledStyleIds;', box);
    return { box, links, classes, fail };
}
let passed = 0;
async function test(name, run) { await run(); passed++; console.log(`통과 ${passed}: ${name}`); }
await test('메모를 뺀 조합도 한 장이며 전체 시트로 같은 자리에서 바꿔요', async () => {
    const h = harness(), ids = ADDON_STYLE_IDS.filter(id => id !== 'notes');
    await h.box.stylesheetBundle(ids);
    assert.equal(h.links.length, 1); assert.equal(h.links[0].href, ADDON_GATED_BOOT_BUNDLE);
    assert.equal(h.classes.has(addonStyleMark('notes')), false);
    assert.equal(h.links[0].dataset.blAddons, ids.filter(id => !LATE_STYLE_IDS.includes(id)).join(' '));
    const unrelated = {}; h.links.push(unrelated);
    await h.box.upgradeAddonStyles();
    assert.equal(h.links.length, 2); assert.equal(h.links[1], unrelated);
    assert.equal(h.links[0].href, ADDON_GATED_BUNDLE); assert.equal(h.links[0].dataset.blAddons, ids.join(' '));
    assert.equal(h.box.pendingCount(), 0);
});
await test('첫 장을 못 받으면 임시 링크·표식·대기를 남기지 않아요', async () => {
    const h = harness(); h.fail.add(ADDON_GATED_BOOT_BUNDLE);
    await assert.rejects(h.box.stylesheetBundle(ADDON_STYLE_IDS), /읽지 못/);
    assert.equal(h.links.length, 0); assert.equal(h.classes.size, 0); assert.equal(h.box.pendingCount(), 0); assert.equal(h.box.ids().length, 0);
});
await test('전체 장만 실패하면 첫 장을 유지하고 다음 시도에 교체해요', async () => {
    const h = harness(); await h.box.stylesheetBundle(ADDON_STYLE_IDS); h.fail.add(ADDON_GATED_BUNDLE);
    const first = h.links[0]; await h.box.upgradeAddonStyles();
    assert.equal(h.links.length, 1); assert.equal(h.links[0], first); assert.equal(h.box.pendingCount(), 1);
    h.fail.clear(); await h.box.upgradeAddonStyles();
    assert.equal(h.links.length, 1); assert.equal(h.links[0].href, ADDON_GATED_BUNDLE); assert.equal(h.box.pendingCount(), 0);
});
console.log(`조건부 CSS 실제 로더 시험 ${passed}개를 통과했어요.`);
