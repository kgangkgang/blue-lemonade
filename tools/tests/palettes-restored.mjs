// 1.0.0 되살린 팔레트 11벌 · 커스텀이 8.2.5 와 같은 색인지, 시작 그래프에는 밤 · 낮만 있고 나머지는 지연으로 받는지
//   고정물 tools/tests/palettes-825.json = 8.2.5 src/palettes.js 의 PALETTES 계산값(이름 · 설명 포함)과 PALETTE_FAMILIES(고르기 카드 차례 · 이름).
//   node tools/tests/palettes-restored.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const pal = await import(pathToFileURL(path.join(root, 'src/palettes.js')).href);
const fixture = JSON.parse(read('tools/tests/palettes-825.json'));

await t('시작할 때는 밤 · 낮 두 벌만 있고, id 목록은 26개 전부를 알아요(저장값을 지우지 않게)', () => {
    assert.deepEqual(Object.keys(pal.PALETTES).sort(), ['night', 'salt']);
    assert.equal(pal.palettesReady(), false);
    assert.deepEqual(Object.keys(pal.PALETTE_MODES).sort(), Object.keys(fixture.palettes).sort());
    for (const [id, p] of Object.entries(fixture.palettes)) assert.equal(pal.PALETTE_MODES[id], p.mode, id);
    for (const id of ['salt', 'night']) assert.deepEqual({ ...pal.PALETTES[id] }, fixture.palettes[id], id);
    assert.deepEqual(pal.PALETTE_FAMILIES.blue, fixture.families.blue);
});
await t('데이터 전에도 가족 · 밝기 짝은 8.2.5 와 같아요', () => {
    for (const [family, { light, dark }] of Object.entries(fixture.families)) {
        assert.equal(pal.paletteVariant(family, 'light'), light, family);
        assert.equal(pal.paletteVariant(family, 'dark'), dark, family);
        assert.equal(pal.paletteFamily(light), family);
        assert.equal(pal.paletteFamily(dark), family);
    }
});
await t('데이터 전에 다른 팔레트를 칠하면 같은 밝기의 기본으로 (기억해 둔 계산값이 있으면 그것)', () => {
    const s = { palette: 'melon-night', nightTint: 1, lightTint: .5, colorOverrides: {} };
    assert.equal(pal.paletteColors(s).accent, pal.PALETTES.night.accent);
    store.set('bl_palette_cache', JSON.stringify({ id: 'melon-night', palette: { ...fixture.palettes['melon-night'], label: 'x' } }));
    assert.equal(pal.paletteColors(s).accent, fixture.palettes['melon-night'].accent);
    store.clear();
});
await t('palette-data.js 를 받으면 26벌 · 13가족이 8.2.5 와 같은 색 · 이름이에요(「멜론 에이드」 같은 에이드 이름 그대로)', async () => {
    assert.equal(await pal.ensurePalettes(), true);
    assert.equal(pal.palettesReady(), true);
    assert.deepEqual(Object.keys(pal.PALETTE_FAMILIES), Object.keys(fixture.families));
    for (const [id, want] of Object.entries(fixture.palettes)) assert.deepEqual({ ...pal.PALETTES[id] }, want, id);
    assert.deepEqual(JSON.parse(JSON.stringify(pal.PALETTE_FAMILIES)), fixture.families);
    assert.equal(pal.PALETTES['melon-night'].label, '멜론 에이드 · 나이트');
});
await t('rememberPalette 는 다른 팔레트의 계산값만 이 브라우저에 적어요', () => {
    pal.rememberPalette('night');
    assert.equal(store.size, 0);
    pal.rememberPalette('mint');
    assert.equal(JSON.parse(store.get('bl_palette_cache')).id, 'mint');
});
await t('palette-data.js 는 시작 그래프 밖이에요(정적 import 하는 곳은 설정 창 · 애드온 · 그 밖 지연 모듈뿐)', () => {
    for (const rel of ['index.js', 'src/apply.js', 'src/settings.js', 'src/palettes.js', 'src/fonts.js', 'src/features.js']) {
        assert.ok(!/^\s*import\s+[^;]*['"][./]*palette-data\.js['"]/m.test(read(rel)), rel);
    }
});
await t('CI 가 이 시험을 돌려요', () => {
    assert.match(read('.github/workflows/release-check.yml'), /node tools\/tests\/palettes-restored\.mjs \./);
});
console.log(`palettes restored: ${n} passed`);
