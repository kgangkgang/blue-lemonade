// 실제 로더 함수를 작은 DOM에서 돌려요. 파일·네트워크·브라우저를 열지 않아요.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ADDON_STYLE_IDS, gatedBundleFits, addonStyleMark, ADDON_GATED_BUNDLE, ADDON_GATED_BOOT_BUNDLE, LATE_STYLE_IDS, syncAddonStyleFlags } from '../../src/addon-style-bundle.js';
const src = fs.readFileSync(new URL('../../src/addons.js', import.meta.url), 'utf8');
function part(startText, endText) {
    const start = src.indexOf(startText), end = src.indexOf(endText, start);
    assert.ok(start >= 0 && end > start); return src.slice(start, end).replace('export function', 'function');
}
function harness({ cover = false } = {}) {
    const links = [], classes = new Set(), fail = new Set();
    const loaded = link => queueMicrotask(() => { if (fail.has(link.href)) link.onerror?.(); else link.onload?.(); });
    const document = {
        documentElement: { classList: { contains: key => classes.has(key), toggle(key, on) { if (on) classes.add(key); else classes.delete(key); } } },
        head: { append(link) { links.push(link); loaded(link); } },
        createElement() { return { dataset: {}, get isConnected() { return links.includes(this); },
            remove() { const at = links.indexOf(this); if (at >= 0) links.splice(at, 1); },
            after(next) { links.splice(links.indexOf(this) + 1, 0, next); loaded(next); } }; },
    };
    // 1.4.1 loadSheet(focus-copies.js)의 예전 길(실리태번 사본 자리가 없을 때)과 같은 흉내 — 미리 받기 길은 focus-copies.mjs 가 봐요
    const loadSheet = (link, place) => new Promise((resolve, reject) => { link.rel = 'stylesheet'; link.onload = () => resolve(); link.onerror = () => reject(Error('스타일을 읽지 못했어요.')); place(link); });
    const box = { document, setTimeout, clearTimeout, syncAddonStyleFlags, ADDON_GATED_BUNDLE, ADDON_GATED_BOOT_BUNDLE, LATE_STYLE_IDS, addonUrl: rel => rel, loadSheet, holdSheet: () => false, booting: () => gate.cover, afterBoot: fn => { if (gate.cover) gate.waiting.push(fn); else fn(); },
        ADDON_STYLE_IDS, gatedBundleFits, getSettings: () => gate.settings, addonsEnabled: () => true };
    // 2차: 시작 덮개 흉내 — lift() 가 boot-gate.js release 처럼 덮개를 걷고 기다리던 일을 차례로 불러요
    const gate = { cover, waiting: [], settings: { addons: Object.fromEntries(ADDON_STYLE_IDS.map(id => [id, true])) }, lift() { gate.cover = false; for (const fn of gate.waiting.splice(0)) fn(); } };   // 2차: 덮개 동안 꺼 두기(holdSheet) — 덮개 없는 흉내라 아무것도 안 해요
    vm.runInNewContext('const pendingSheets=new Map();let bundledStyleIds=[];let upgrading=Promise.resolve();\n' +
        part('function attachStyle(', '\nconst addonUrl=') +
        part('function swapSheet(', '\n/** 첫 장을') +
        part('export function upgradeAddonStyles(', '\nfunction watchUpgrade') +
        part('function stylesheetBundle(', '\nasync function persist(') +
        part('function earlyStyle(', '\nasync function startAddonsOnce(') +
        '\nthis.pendingCount=()=>pendingSheets.size;this.ids=()=>bundledStyleIds;this.earlyStyle=earlyStyle;this.undoEarlyStyle=undoEarlyStyle;', box);
    return { box, links, classes, fail, gate };
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
// ---- 2차 최적화(11-14): 덮개 아래에서 먼저 붙이기 · 표식은 걷힐 때 · 목록이 다르면 거두기
const frameNow = { afterFirstFrame: fn => Promise.resolve().then(fn) };
await test('2차: 덮개 동안이면 첫 프레임 뒤 첫 장을 붙이고, 뿌리 표식은 덮개가 걷힐 때 한 번에 붙여요', async () => {
    const h = harness({ cover: true });
    const job = h.box.earlyStyle(frameNow);
    assert.deepEqual(job.styled, ADDON_STYLE_IDS, '설정에 켠 목록 그대로(시작 순서)');
    const link = await job.link;
    assert.equal(link, h.links[0]); assert.equal(link.href, ADDON_GATED_BOOT_BUNDLE);
    assert.equal(h.classes.size, 0, '덮개 동안엔 표식을 안 붙여요');
    h.gate.lift();
    assert.equal(h.classes.size, ADDON_STYLE_IDS.length, '걷힐 때 한 번에');
});
await test('2차: 덮개가 이미 걷혔거나 첫 프레임 전에 거두면 아무것도 안 붙여요 · 적게 켠 조합은 예전 길', async () => {
    assert.equal(harness().box.earlyStyle(frameNow), null, '덮개 없음');
    const h = harness({ cover: true }); const job = h.box.earlyStyle(frameNow); job.cancelled = true;
    assert.equal(await job.link, null); assert.equal(h.links.length, 0);
    const few = harness({ cover: true }); few.gate.settings = { addons: { perf: true, notes: true } };
    assert.equal(few.box.earlyStyle(frameNow), null);
});
await test('2차: 확정 목록이 달라 거두면 링크 · 대기 · 표식이 남지 않고, 걷힐 때도 표식을 안 붙여요', async () => {
    const h = harness({ cover: true }); const link = await h.box.earlyStyle(frameNow).link;
    h.box.undoEarlyStyle(link);
    assert.equal(h.links.length, 0); assert.equal(h.box.pendingCount(), 0); assert.equal(h.box.ids().length, 0);
    h.gate.lift();
    assert.equal(h.classes.size, 0, '거둔 뒤 걷혀도 표식 없음');
});
console.log(`조건부 CSS 실제 로더 시험 ${passed}개를 통과했어요.`);
