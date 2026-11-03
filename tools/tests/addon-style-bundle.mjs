// 9.0.9 애드온 CSS 한 장 — 목록이 addons.js 시작 순서와 같은지, 한 장이 최신인지, 전후 폭포(선택자별 최종 선언 · 규칙 순서)가 같은지,
// 켜진 애드온이 목록과 다르면 예전처럼 한 장씩인지, 한 장일 때 한글화 패널 · 파일 어긋남 다시 받기가 한 장을 알아보는지.
//   node tools/tests/addon-style-bundle.mjs [저장소]
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const t = async (name, fn) => { try { await fn(); console.log(`ok - ${name}`); } catch (error) { failed++; console.log(`not ok - ${name}\n  ${error.stack || error}`); } };
const run = (...args) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });

const { ADDON_STYLE_IDS, ADDON_STYLE_BUNDLE, bundleFits } = await import(pathToFileURL(path.join(root, 'src/addon-style-bundle.js')).href);
const { startOrder } = await import(pathToFileURL(path.join(root, 'tools/build-addon-css.mjs')).href);

await t('한 장 목록 = addons.js 시작 순서에서 translator 만 뺀 것', () => {
    assert.deepEqual([...ADDON_STYLE_IDS], startOrder(root));
    assert.ok(!ADDON_STYLE_IDS.includes('translator'), '번역은 스타일을 따로 붙여요');
});

await t('src/addons/style-addons.css 가 애드온 CSS 에서 다시 만든 것과 같아요 (build-addon-css --check · build-css --check)', () => {
    const r = run('tools/build-addon-css.mjs', '--check');
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.match(read(`src/addons/${ADDON_STYLE_BUNDLE}`), /^@charset "UTF-8";\n\/\* Blue Lemonade 애드온 CSS 한 장/);
    assert.match(read('tools/build-css.cjs'), /build-addon-css\.mjs/, 'node tools/build-css.cjs 가 한 장도 같이 만들어요');
});

await t('전후 폭포 차이 0 — 선택자별 최종 선언 · 규칙 순서 (tools/css-cascade-diff.mjs)', () => {
    const r = run('tools/css-cascade-diff.mjs', '.', '--json');
    const report = JSON.parse(r.stdout);
    assert.equal(r.status, 0, JSON.stringify(report.diffs?.slice(0, 3)) + JSON.stringify(report.orderDiff));
    assert.equal(report.finals.diff, 0);
    assert.equal(report.order, 'same');
    assert.equal(report.finals.before, report.finals.after);
    for (const id of ADDON_STYLE_IDS) assert.ok(report.perAddon[id].finals > 0 && report.perAddon[id].diff === 0, `${id}: 최종 선언이 있고 차이 0`);
});

await t('켜진 애드온이 목록과 꼭 같을 때만 한 장 (하나 빠짐 · 순서 다름 · 하나 더 = 한 장씩)', () => {
    assert.equal(bundleFits([...ADDON_STYLE_IDS]), true);
    assert.equal(bundleFits(ADDON_STYLE_IDS.slice(1)), false);
    assert.equal(bundleFits([...ADDON_STYLE_IDS].reverse()), false);
    assert.equal(bundleFits([...ADDON_STYLE_IDS, 'translator']), false);
    const addons = read('src/addons.js');
    assert.match(addons, /const styleAll=\(\)=>bundleFits\(styled\)\?stylesheetBundle\(styled\)\.catch\([^]*?return styleEach\(\);\}\):styleEach\(\);/, '못 받으면 한 장씩 다시');
    assert.match(addons, /link\.dataset\.blAddons=ids\.filter\([^\n]*\.join\(' '\);link\.href=addonUrl\(ADDON_BOOT_BUNDLE\);/);
    assert.match(addons, /pendingSheets\.set\(link,addonUrl\(ADDON_STYLE_BUNDLE\)\);/, '첫 장 뒤에 전체 한 장으로 바꿔요');
});

await t('한 장일 때: 한글화 패널은 자기 CSS 를 또 붙이지 않고, 파일 어긋남 다시 받기는 한 장을 같은 자리에서 다시 받아요', () => {
    const prompt = read('src/addons/prompt/index.js');
    assert.equal((prompt.match(/if \(CSS_URL && !hasPanelCss\(PDOC\)\)/g) || []).length, 2, '패널 CSS 를 붙이는 두 곳 모두');
    assert.match(prompt, /const hasPanelCss = doc => [^\n]*link\.href === CSS_URL \|\| String\(link\.dataset\?\.blAddons \?\? ''\)\.split\(' '\)\.includes\('prompt'\)/);
    assert.match(read('src/addon-files-check.js'), /String\(link\.dataset\?\.blAddons \?\? ''\)\.split\(' '\)\.includes\(folder\)/);
});

await t('한 장에는 @import 가 남지 않아요(전부 펼침)', () => {
    const bundle = read(`src/addons/${ADDON_STYLE_BUNDLE}`);
    assert.ok(!/@import/.test(bundle.replace(/\/\*[^]*?\*\//g, '')), '한 장에는 @import 가 남지 않아요(전부 펼침)');
});

if (failed) { console.log(`${failed}개 실패`); process.exit(1); }
console.log('PASS 애드온 CSS 한 장');
