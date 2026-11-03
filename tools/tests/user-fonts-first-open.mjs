// 1.0.0 지금 쓰는 설정(본문 리디바탕 · 메뉴 프리젠테이션 · 코드 갈무리모노11 · 밤 팔레트)으로 처음 열었을 때 글꼴 · 팔레트가 바뀌지 않는지
//   - 설정 정리(getSettings)가 글꼴 칸 · 팔레트를 그대로 두고, 시작 목록(전체 목록을 받기 전)만으로 세 글꼴을 다 찾아 전체 목록을 받으러 가지 않아요
//   - 칸별 글꼴 줄(slotStack)이 전체 목록(catalog-full.js · 8.2.5 의 1,016개)을 받은 뒤와 같고, 가족 이름 · 갈래가 8.2.5 와 같아요
//   - 시작 목록에 없는 글꼴 · 팔레트를 골라 둔 설정도 지우지 않아요(전체 목록 · 팔레트 데이터는 나중에 받아요)
//   고정물: tools/tests/user-fonts-first-open.json (모양만 — 개인 값 · 대화 없음)
//   node tools/tests/user-fonts-first-open.mjs <테마 루트>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.argv[2] || '.');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tools/tests/user-fonts-first-open.json'), 'utf8'));
const ctx = { extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const mod = rel => import(pathToFileURL(path.join(root, rel)).href);
const { getSettings, FONT_SLOTS, fontSet } = await mod('src/settings.js');
const catalog = await mod('src/catalog.js');
const fonts = await mod('src/fonts.js');
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log(`  PASS  ${name}`); };
const load = salty => { ctx.extensionSettings.salty = structuredClone(salty); return getSettings(); };
const stacks = s => Object.fromEntries(FONT_SLOTS.map(slot => [slot, s.fonts[slot] === 'same' ? 'same' : fonts.slotStack(slot, fontSet(s, slot))]));

const s = load(fixture.salty);
const before = await (async () => stacks(s))();
await t('설정 정리가 글꼴 칸 · 팔레트를 그대로 둬요 (저장값이 바뀌지 않음)', () => {
    assert.deepEqual(s.fonts, fixture.salty.fonts);
    assert.equal(s.palette, 'night');
});
await t('전체 목록을 받기 전에도 세 글꼴을 다 찾아요 — 처음 열 때 전체 목록(163KB)을 받으러 가지 않아요', () => {
    assert.equal(catalog.catalogReady(), false);
    for (const id of ['ridibatang', 'freesentation', 'galmurimono11']) assert.ok(fonts.findFont(id), id);
    const sets = Object.values(fixture.salty.fonts).filter(v => v && typeof v === 'object');
    assert.ok(sets.every(set => Object.values(set).every(id => id === 'auto' || fonts.findFont(id))), 'apply.js 가 전체 목록을 당길 조건이 아니에요');
});
await t('가족 이름 · 갈래 · 리디바탕 주소가 8.2.5 와 같아요', () => {
    for (const [id, want] of Object.entries(fixture.expect825)) {
        const f = fonts.findFont(id);
        assert.equal(f.family, want.family, id);
        assert.equal(f.group, want.group, id);
        if (want.url) assert.deepEqual(f.files.map(x => x.url), [want.url], id);
    }
    assert.match(before.text, /^'Salty Text'/);
});
await t('전체 목록(8.2.5 의 1,016개)을 받아도 칸별 글꼴 줄이 그대로예요', async () => {
    assert.equal(await catalog.loadFullCatalog(), true);
    assert.equal(catalog.catalogReady(), true);
    assert.equal(catalog.CATALOG.length, 1016);
    assert.deepEqual(stacks(load(fixture.salty)), before);
});
await t('시작 목록 밖 글꼴 · 다른 팔레트를 골라 둔 설정도 지우지 않아요', () => {
    const other = structuredClone(fixture.salty);
    other.palette = 'melon-night';
    other.fonts.text.ko = 'suit';
    other.colorOverrides = { 'melon-night': { accent: '#CAF59E' }, 'custom-light': { bg: '#FFFFFF' } };
    const got = load(other);
    assert.equal(got.palette, 'melon-night');
    assert.equal(got.fonts.text.ko, 'suit');
    assert.deepEqual(Object.keys(got.colorOverrides).sort(), ['custom-light', 'melon-night']);
});
await t('CI 가 이 시험을 돌려요', () => {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows/release-check.yml'), 'utf8'), /node tools\/tests\/user-fonts-first-open\.mjs \./);
});
console.log(`user fonts first open: ${n} passed`);
