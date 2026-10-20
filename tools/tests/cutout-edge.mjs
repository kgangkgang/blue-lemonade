// 6.1.6 투명 그림(캐릭터 컷) 외곽선 · 그림자 — 값 정리 · 필터 문자열 · 그림 가장자리 색 · 설정 저장/되돌리기 · 연결
// 7.3.0 프리셋(자동 · 어두운 화면용 · 밝은 화면용 · 공통 · 직접) · 둥근 넓히기(흐림 → 문턱) · 잘린 면 빼기 · 채팅의 모든 그림 · 크게 보기 · data-salty-cutout
//   node tools/tests/cutout-edge.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const edge = await import(pathToFileURL(path.join(root, 'src/cutedge.js')));
const { SEARCH_ENTRIES } = await import(pathToFileURL(path.join(root, 'src/settings-search.js')));
const { CUT_EDGE_DEFAULTS, CUT_EDGE_RANGES, CUT_EDGE_PRESETS, CUT_EDGE_PRESET_IDS, PRESET_VALUES, AUTO_PRESET, normalizeCutEdge, tidyCutEdge, cutEdgeDefaults, cutEdgeVars, cutEdgeClasses,
    resolveCutEdge, toCustom, imageFrameOn, shadowOffset, rgba, ringFilterMarkup, roundGrow, filterRegion, edgeColorFromGrid, touchedSides, quantizeColor, pickFilterId,
    darkBackground, hexLuminance, baseInk, RING_ID } = edge;

const results = [];
async function test(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }
const DARK = { dark: true, accent: '#93c9ff' }, LIGHT = { dark: false, accent: '#2477d3' };

await test('defaults: preset 「자동」, clipped to the picture box; the custom values keep the 6.1.6 prototype for 「직접」', () => {
    assert.deepEqual(normalizeCutEdge(undefined), {
        preset: 'auto', overflow: false,
        outline: { on: true, colorMode: 'custom', color: '#ffffff', width: 2, alpha: 90, blur: 0 },
        shadow: { on: true, colorMode: 'custom', color: '#000000', alpha: 55, angle: 90, distance: 6, blur: 12 },
    });
    assert.deepEqual(cutEdgeVars(undefined, DARK), { '--salty-cutedge-ring': `url("#${RING_ID}")`, '--salty-cutedge-drop': 'opacity(1)' }, 'one SVG filter; the old drop variable stays as a no-op for other extensions');
    assert.deepEqual(cutEdgeClasses(undefined), ['salty-cutedge']);
    const fresh = cutEdgeDefaults();
    fresh.outline.width = 7; fresh.shadow.alpha = 1;
    assert.equal(CUT_EDGE_DEFAULTS.outline.width, 2, 'reset copy is deep');
    assert.equal(cutEdgeDefaults().preset, 'auto');
});

await test('presets: dark-screen and light-screen ones are first-class, 「자동」 picks by chat background luminance', () => {
    assert.deepEqual(CUT_EDGE_PRESETS.map(p => p.id), ['auto', 'rim-light', 'glow', 'neon', 'rim-dark', 'paper', 'sticker', 'shadow', 'off']);
    assert.deepEqual(CUT_EDGE_PRESETS.map(p => p.label), ['자동', '밝은 테두리', '은은한 빛', '네온 테두리', '깔끔한 테두리', '종이 그림자', '스티커', '그림자만', '끄기']);
    assert.deepEqual(CUT_EDGE_PRESETS.filter(p => p.tone === 'dark').map(p => p.id), ['rim-light', 'glow', 'neon']);
    assert.deepEqual(CUT_EDGE_PRESETS.filter(p => p.tone === 'light').map(p => p.id), ['rim-dark', 'paper']);
    assert.deepEqual([...CUT_EDGE_PRESET_IDS].slice(-1), ['custom']);
    assert.equal(resolveCutEdge({ preset: 'auto' }, DARK).preset, AUTO_PRESET.dark);
    assert.equal(resolveCutEdge({ preset: 'auto' }, LIGHT).preset, AUTO_PRESET.light);
    assert.equal(darkBackground('#141F2E'), true); assert.equal(darkBackground('#1c1e21'), true);
    assert.equal(darkBackground('#F9FCFF'), false); assert.equal(darkBackground('nope'), false);
    assert.ok(Math.abs(hexLuminance('#ffffff') - 1) < 1e-9 && hexLuminance('#000000') === 0);
    // 어두운 화면용은 밝은 색, 밝은 화면용은 어두운 색
    const lum = id => hexLuminance(PRESET_VALUES[id].outline.on ? PRESET_VALUES[id].outline.color : PRESET_VALUES[id].shadow.color);
    for (const id of ['rim-light', 'glow']) assert.ok(lum(id) > 0.8, id);
    for (const id of ['rim-dark', 'paper', 'shadow']) assert.ok(lum(id) < 0.05, id);
    // 은은한 빛 = 거리 0 의 넓은 빛 (검은 옷을 바탕에서 띄움), 네온 = 테마 포인트 색 띠 + 같은 색 빛, 스티커 = 두꺼운 흰 띠 + 작은 그림자
    assert.ok(PRESET_VALUES.glow.shadow.distance === 0 && PRESET_VALUES.glow.shadow.blur >= 12);
    const neon = resolveCutEdge({ preset: 'neon' }, DARK);
    assert.equal(baseInk(neon, DARK.accent), '#93c9ff');
    assert.match(ringFilterMarkup('n', baseInk(neon, DARK.accent), neon), /flood-color="#93c9ff" flood-opacity="0.7"[\s\S]*flood-color="#93c9ff" flood-opacity="0.95"/);
    assert.ok(PRESET_VALUES.sticker.outline.width >= 3 && PRESET_VALUES.sticker.outline.color === '#ffffff' && PRESET_VALUES.sticker.shadow.on);
    assert.ok(!PRESET_VALUES.shadow.outline.on && PRESET_VALUES.shadow.shadow.on);
    assert.deepEqual(cutEdgeClasses({ preset: 'off' }), [], 'off removes the filter class');
    assert.deepEqual(cutEdgeVars({ preset: 'off' }), { '--salty-cutedge-ring': 'opacity(1)', '--salty-cutedge-drop': 'opacity(1)' });
});

await test('migration from 7.2.9: untouched defaults → 자동, both off → 끄기, anything else (e.g. shadow only, 75% · 1px) → 직접 with the same values', () => {
    assert.equal(normalizeCutEdge({ overflow: false, outline: { on: true, colorMode: 'custom', color: '#ffffff', width: 2, alpha: 90, blur: 0 }, shadow: { on: true, color: '#000000', alpha: 55, angle: 90, distance: 6, blur: 12 } }).preset, 'auto');
    assert.equal(normalizeCutEdge({ outline: { on: false }, shadow: { on: false } }).preset, 'off');
    const mine = normalizeCutEdge({ overflow: true, outline: { on: false }, shadow: { on: true, color: '#000000', alpha: 75, angle: 90, distance: 1, blur: 1 } });
    assert.equal(mine.preset, 'custom');
    assert.deepEqual(resolveCutEdge(mine, DARK).shadow, { on: true, colorMode: 'custom', color: '#000000', alpha: 75, angle: 90, distance: 1, blur: 1 }, 'their look stays as it was');
    assert.equal(normalizeCutEdge({ preset: 'glow', outline: { width: 6 } }).preset, 'glow', 'a saved preset wins over leftover values');
    assert.equal(normalizeCutEdge({ preset: 'rainbow' }).preset, 'auto');
});

await test('「자세히」: touching a slider turns the shown preset into 「직접」 with those values first', () => {
    const holder = { cutEdge: { preset: 'glow', overflow: false, outline: { ...CUT_EDGE_DEFAULTS.outline }, shadow: { ...CUT_EDGE_DEFAULTS.shadow } } };
    assert.equal(toCustom(holder, DARK), true);
    assert.equal(holder.cutEdge.preset, 'custom');
    assert.deepEqual(holder.cutEdge.outline, { ...PRESET_VALUES.glow.outline });
    assert.equal(toCustom(holder, DARK), false, 'already custom');
    const auto = { cutEdge: { preset: 'auto', outline: {}, shadow: {} } };
    toCustom(auto, LIGHT);
    assert.deepEqual(auto.cutEdge.outline, { ...PRESET_VALUES[AUTO_PRESET.light].outline }, 'auto copies what it showed on this screen');
    const panel = read('src/panel.js');
    assert.ok(panel.includes("if (/^image\\.cutEdge\\.(outline|shadow)\\./.test(path) && obj?.image?.cutEdge && toCustom(obj.image, edgeThemeNow())) queueMicrotask(markCutEdgeCustom);"), 'setPath turns presets into custom');
});

await test('normalize clamps ranges, rejects bad colours and modes, reads imported string booleans', () => {
    const e = normalizeCutEdge({ preset: 'custom', overflow: 'true', outline: { on: 'false', colorMode: 'rainbow', color: 'red', width: 99, alpha: -5, blur: '3.5' }, shadow: { angle: 400, distance: '3', blur: 'x', color: '#ABCDEF', colorMode: 'nope' } });
    assert.equal(e.overflow, true);
    assert.deepEqual(e.outline, { on: false, colorMode: 'custom', color: '#ffffff', width: 8, alpha: 0, blur: 3.5 });
    assert.deepEqual(e.shadow, { on: true, colorMode: 'custom', color: '#abcdef', alpha: 55, angle: 360, distance: 3, blur: 12 });
    for (const mode of ['picture', 'accent']) assert.equal(normalizeCutEdge({ outline: { colorMode: mode } }).outline.colorMode, mode);
    assert.equal(normalizeCutEdge({ shadow: { colorMode: 'outline' } }).shadow.colorMode, 'outline');
    for (const [key, [min, max, step]] of Object.entries(CUT_EDGE_RANGES)) {
        const [part, name] = key.split('.');
        assert.ok(min < max && step > 0, key);
        assert.ok(CUT_EDGE_DEFAULTS[part][name] >= min && CUT_EDGE_DEFAULTS[part][name] <= max, `${key} default inside its range`);
        for (const [id, v] of Object.entries(PRESET_VALUES)) assert.ok(v[part][name] >= min && v[part][name] <= max, `${id} ${key} inside its range`);
    }
});

await test('tidy keeps the same objects (settings window holds them) and drops unknown keys', () => {
    const holder = { cutEdge: { junk: 1, preset: 'paper', outline: { width: '4', stray: true }, shadow: null } };
    const keep = holder.cutEdge, keepOutline = holder.cutEdge.outline;
    tidyCutEdge(holder);
    assert.equal(holder.cutEdge, keep);
    assert.equal(holder.cutEdge.outline, keepOutline);
    assert.equal(holder.cutEdge.preset, 'paper');
    assert.equal(holder.cutEdge.outline.width, 4);
    assert.ok(!('junk' in holder.cutEdge) && !('stray' in holder.cutEdge.outline));
    const empty = {}; tidyCutEdge(empty); assert.deepEqual(empty.cutEdge, cutEdgeDefaults());
});

await test('image frames win: while a frame or frame shadow is on (square shape), no cut-edge classes so 6.1.5 frames look the same', () => {
    assert.equal(imageFrameOn({ shape: 'rect', edge: 'none', edgeShadow: false }), false);
    for (const e of ['line', 'inset', 'glow', 'prism']) assert.equal(imageFrameOn({ shape: 'rect', edge: e, edgeShadow: false }), true, e);
    assert.equal(imageFrameOn({ shape: 'rect', edge: 'none', edgeShadow: true }), true, 'frame shadow alone');
    assert.equal(imageFrameOn({ shape: 'custom', edge: 'glow', edgeShadow: true }), false);
    assert.deepEqual(cutEdgeClasses(undefined, { frame: true }), []);
    assert.deepEqual(cutEdgeClasses({ preset: 'custom', overflow: true }), ['salty-cutedge', 'salty-cutedge-out']);
    assert.deepEqual(cutEdgeClasses({ preset: 'custom', outline: { colorMode: 'picture' } }), ['salty-cutedge', 'salty-cutedge-pick']);
    assert.deepEqual(cutEdgeClasses({ preset: 'custom', outline: { colorMode: 'picture', on: false } }), ['salty-cutedge'], 'picture colour only matters while the outline shows');
});

await test('angle follows the text shadow: 0 = right, 90 = down, 180 = left', () => {
    assert.deepEqual(shadowOffset(0, 5), [5, 0]);
    assert.deepEqual(shadowOffset(90, 5), [0, 5]);
    assert.deepEqual(shadowOffset(180, 5), [-5, 0]);
    assert.deepEqual(shadowOffset(45, 2), [1.41, 1.41]);
    assert.equal(rgba('#ff8000', 50), 'rgba(255, 128, 0, 0.5)');
});

await test('outline = round, anti-aliased growth (blur → alpha threshold), band only outside the silhouette; no square feMorphology', () => {
    const r = resolveCutEdge({ preset: 'custom', outline: { width: 2, alpha: 90 }, shadow: { on: false } });
    const f = ringFilterMarkup('a', '#ffffff', r);
    assert.ok(!f.includes('feMorphology'), 'square dilation gave stair steps on diagonals');
    assert.match(f, /^<filter id="a" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">/);
    assert.match(f, /<feGaussianBlur in="SourceAlpha" stdDeviation="1.333" result="gb"\/><feComponentTransfer in="gb" result="grown"><feFuncA type="linear" slope="[\d.]+" intercept="-[\d.]+"\/><\/feComponentTransfer>/);
    assert.match(f, /<feComposite in="grown" in2="SourceAlpha" operator="out" result="band"\/>/, 'translucent halos are not filled from behind');
    assert.match(f, /<feMerge><feMergeNode in="ring"\/><feMergeNode in="SourceGraphic"\/><\/feMerge><\/filter>$/);
    // 문턱: α 0 은 늘 0 (가는 띠가 그림 칸 전체를 칠하지 않게) · 띠 가운데가 두께만큼 밖
    for (const w of [0.5, 1, 1.5, 2, 4, 8]) {
        const g = roundGrow(w);
        assert.ok(g.intercept <= 0, `width ${w}: transparent stays transparent (${g.intercept})`);
        const sigma = g.sigma, at = x => 0.5 * (1 + erf(-x / sigma / Math.SQRT2)); // 곧은 가장자리에서 x px 밖의 흐린 알파
        const a = x => Math.min(1, Math.max(0, g.slope * at(x) + g.intercept));
        assert.ok(a(0) > 0.95 && a(w + 1.5) < 0.05, `width ${w}: solid at the edge, gone 1.5px past the width`);
        if (w >= 1.5) assert.ok(Math.abs(a(w) - 0.5) < 0.05, `width ${w}: half way at the width`);
    }
    const soft = ringFilterMarkup('b', '#123456', resolveCutEdge({ preset: 'custom', outline: { blur: 3, alpha: 40 }, shadow: { on: false } }));
    assert.match(soft, /flood-color="#123456" flood-opacity="0.4"/);
    assert.match(soft, /<feGaussianBlur in="ring" stdDeviation="1.5" result="soft"\/><feMerge><feMergeNode in="soft"\/>/);
    assert.match(ringFilterMarkup('c', 'javascript:x', r), /flood-color="#ffffff"/, 'only #rrggbb reaches the markup');
    // 그림자 · 빛도 같은 필터 (거리 0 = 빛), 그림자 색 = 외곽선 색 고르기
    const glow = ringFilterMarkup('g', '#ffffff', resolveCutEdge({ preset: 'glow' }));
    assert.match(glow, /<feGaussianBlur in="SourceAlpha" stdDeviation="8" result="sb"\/><feFlood flood-color="#e6edff" flood-opacity="0.62"\/><feComposite in2="sb" operator="in" result="sc"\/>/);
    assert.match(glow, /<feMerge><feMergeNode in="shade"\/><feMergeNode in="ring"\/><feMergeNode in="SourceGraphic"\/>/);
    assert.match(ringFilterMarkup('p', '#ffffff', resolveCutEdge({ preset: 'paper' })), /<feOffset in="sb" dx="0" dy="6" result="so"\/>/);
});
function erf(x) { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); }

function grid48(paint) {
    const g = new Uint8ClampedArray(48 * 48 * 4);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const c = paint(x, y); if (c) g.set(c, (y * 48 + x) * 4); }
    return g;
}

await test('cut sides: silhouette touching the picture box (cropped body) is not outlined past that side when drawing outside the box', () => {
    // 위가 비고 아래 · 왼쪽 · 오른쪽이 잘린 상반신
    const bust = grid48((x, y) => (y > 10 ? [20, 20, 20, 255] : null));
    assert.equal(touchedSides(bust), 2 | 4 | 8);
    assert.equal(touchedSides(grid48((x, y) => (Math.hypot(x - 23.5, y - 23.5) < 12 ? [1, 2, 3, 255] : null))), 0, 'a floating figure touches nothing');
    assert.equal(touchedSides(grid48((x, y) => (x === 0 && y === 20 ? [9, 9, 9, 255] : null))), 8, 'even one strand at the edge counts');
    assert.equal(touchedSides(null), 0);
    assert.equal(filterRegion(0, false), 'x="0%" y="0%" width="100%" height="100%"', 'clipped mode = the picture box');
    assert.equal(filterRegion(0, true), 'x="-20%" y="-20%" width="140%" height="140%"');
    assert.equal(filterRegion(2 | 4 | 8, true), 'x="-0%" y="-20%" width="100%" height="120%"', 'only the free top side grows');
    assert.match(ringFilterMarkup('m', '#ffffff', resolveCutEdge({ preset: 'rim-light', overflow: true }), 4), /x="-20%" y="-20%" width="140%" height="120%"/);
    assert.equal(pickFilterId('#ff0088'), 'salty-cutedge-ring-ff0088');
    assert.equal(pickFilterId('#ff0088', 6), 'salty-cutedge-ring-ff0088-m6');
    assert.equal(pickFilterId('', 4), 'salty-cutedge-ring-m4');
});

await test('edge colour = alpha-weighted average of opaque cells touching transparency (silhouette, not the cut)', () => {
    const disc = grid48((x, y) => { const d = Math.hypot(x - 23.5, y - 23.5); return d > 16 ? null : d > 14 ? [20, 60, 220, 255] : [230, 20, 20, 255]; });
    const c = edgeColorFromGrid(disc);
    assert.ok(c && c.b > 200 && c.r < 40, JSON.stringify(c));
    const body = grid48((x, y) => (x < 12 || x > 35 ? null : y >= 44 ? [0, 200, 0, 255] : y < 8 ? null : [200, 150, 90, 255]));
    const b = edgeColorFromGrid(body);
    assert.ok(b && b.g < 160 && b.r > 150, JSON.stringify(b));
    assert.equal(edgeColorFromGrid(grid48(() => [10, 10, 10, 255])), null, 'fully opaque picture has no silhouette');
    assert.equal(quantizeColor({ r: 250, g: 3, b: 128 }), '#ff0088');
});

await test('settings: default saved under image.cutEdge, survives reload, string booleans and reset to defaults', async () => {
    const ctx = { extensionSettings: {}, powerUserSettings: {}, characters: [], saveSettingsDebounced() {} };
    globalThis.SillyTavern = { getContext: () => ctx };
    const { DEFAULTS, getSettings, invalidateSettings } = await import(pathToFileURL(path.join(root, 'src/settings.js')));
    const { settingRoute, settingChanged, resetSetting } = await import(pathToFileURL(path.join(root, 'src/settings-differences.js')));
    assert.deepEqual(DEFAULTS.image.cutEdge, cutEdgeDefaults());
    ctx.extensionSettings.salty = structuredClone(DEFAULTS);
    delete ctx.extensionSettings.salty.image.cutEdge; // 6.1.5 이하에서 올라온 설정
    invalidateSettings();
    let s = getSettings();
    assert.deepEqual(s.image.cutEdge, cutEdgeDefaults(), 'old settings get the defaults');
    s.image.cutEdge.preset = 'custom'; s.image.cutEdge.outline.width = '6'; s.image.cutEdge.shadow.on = 'false'; s.image.cutEdge.overflow = 'true';
    ctx.extensionSettings.salty = JSON.parse(JSON.stringify(s));
    invalidateSettings();
    s = getSettings();
    assert.equal(s.image.cutEdge.preset, 'custom');
    assert.equal(s.image.cutEdge.outline.width, 6);
    assert.equal(s.image.cutEdge.shadow.on, false);
    assert.equal(s.image.cutEdge.overflow, true);
    assert.equal(settingChanged(s, 'image.cutEdge.preset'), true);
    assert.equal(resetSetting(s, 'image.cutEdge.preset'), true);
    assert.equal(s.image.cutEdge.preset, 'auto');
    assert.deepEqual(settingRoute('image.cutEdge.shadow.angle'), { tab: 'image', sub: 'cutedge' });
});

await test('detection: every transparent chat picture (other extensions too, lazy ones on load), viewers · galleries, and the public data-salty-cutout switch', () => {
    const assets = read('src/assets.js');
    assert.match(assets, /import \{ paintCutEdge \} from '\.\/cutedge\.js';/);
    assert.match(assets, /host\.classList\.toggle\('salty-alpha', rec\.cutout\);/);
    assert.ok(assets.includes("const EDGE_IMG = '.mes_text img, .mes_img_container img, .mes_media_wrapper img';"), 'any picture inside a message');
    assert.ok(assets.includes("if (!img.complete || !img.naturalWidth) { img.addEventListener('load', onEdgeLoad, { once: true }); return; }"), 'lazy pictures classify when they load');
    assert.ok(assets.includes("export const CUTOUT_ATTR = 'data-salty-cutout';"));
    assert.ok(assets.includes("const wanted = opt === 'auto' || opt === 'on' || known?.seen || img.matches(VIEW_IMG);"));
    assert.ok(assets.includes("observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [CUTOUT_ATTR] })"), 'dialogs appended to <body> and the attribute');
    assert.ok(assets.includes("if (chat.contains(m.target)) continue;"), 'chat changes are not scanned twice');
    assert.ok(assets.includes("img.classList.toggle('salty-alpha-view', rec.cutout);"));
    assert.ok(!new RegExp('auto' + '-?' + 'pic', 'i').test(assets.slice(assets.indexOf('const EDGE_IMG'), assets.indexOf('const optOf'))), 'generic: no extension names in the new rules');
    const readme = read('README.md');
    assert.ok(readme.includes('## 확장 만드는 분께') && readme.includes('data-salty-cutout="auto"') && readme.includes('data-salty-cutout="off"'), 'README documents the attribute');
});

await test('wiring: apply passes the screen tone and accent, panel shows preset cards on a real sample and keeps sliders under 「자세히」', () => {
    const apply = read('src/apply.js');
    assert.ok(apply.includes("const edgeTheme = { dark: /^#[0-9a-f]{6}$/i.test(String(pal.bg)) ? darkBackground(pal.bg) : mode === 'dark', accent: pal.accent };"), 'chat background luminance, palette mode as fallback');
    assert.match(apply, /cutEdgeVars\(s\.image\.cutEdge, edgeTheme\)/);
    assert.match(apply, /syncCutEdge\(s\.image\.cutEdge, !!s\.enabled && !imageFrameOn\(s\.image\), edgeTheme\);/);
    const panel = read('src/panel.js');
    assert.ok(panel.includes('data-act="cutedge-preset"') && panel.includes("case 'cutedge-preset':"));
    assert.ok(panel.includes("const own = document.querySelector('#chat .salty-alpha img, #chat img.salty-alpha');"), 'cards use a transparent picture from this chat when there is one');
    assert.ok(panel.includes('<details class="bl-cutedge-more" data-md-fold="cutedge-more"><summary>자세히</summary>'));
    for (const key of ['outline.width', 'outline.alpha', 'outline.blur', 'shadow.alpha', 'shadow.angle', 'shadow.distance', 'shadow.blur']) assert.ok(panel.includes(`slider('image.cutEdge.${key}'`), key);
    for (const key of ['outline.on', 'shadow.on', 'overflow']) assert.ok(panel.includes(`toggle('image.cutEdge.${key}'`), key);
    assert.ok(panel.includes("seg('image.cutEdge.outline.colorMode', [['custom', '직접'], ['picture', '그림 가장자리 색'], ['accent', '테마 포인트 색']])"));
    assert.ok(panel.includes("seg('image.cutEdge.shadow.colorMode', [['custom', '직접'], ['outline', '외곽선과 같은 색']])"));
    assert.ok(panel.includes("이미지 › 테두리를 쓰는 동안은 테두리가 먼저라 외곽선 · 그림자가 쉬어요."), 'panel says why it pauses');
    assert.equal(SEARCH_ENTRIES.find(e => e.tab === 'image' && e.sub === 'cutedge')?.breadcrumb, '이미지 › 투명 그림', 'search breadcrumb');
    const labels = read('src/settings-labels.js');
    for (const id of CUT_EDGE_PRESET_IDS) assert.ok(labels.includes(`'image.cutEdge.preset:${id}'`), 'value label ' + id);
    assert.ok(read('src/chat-capture.js').includes("document.getElementById('salty-cutedge-defs')"), 'captures carry the outline filter');
    assert.ok(read('src/capture-editor.js').includes("'salty-asset','salty-cutout','salty-alpha'"));
});

await test('CSS: every chat picture area, viewers, one filter with per-picture variants, clipping by default, cards are 44px+', () => {
    const css = read('css/68-cutout-edge.css');
    const style = read('style.css');
    const scope = ':is(#chat, #salty-nochat, .salty-preview) :is(.mes_text, .mes_media_wrapper, .mes_img_container)';
    const target = ':is(.salty-alpha :is(.custom-cac-img, img.character-asset-rendered, img.eh-img, img[data-autopic-id], img.mes_img), [class*="custom-imageWrapper"].salty-alpha img, img.salty-alpha)';
    assert.ok(css.includes(`body.salty.salty-cutedge ${scope} ${target},\nbody.salty.salty-cutedge img.salty-alpha-view {`));
    assert.match(css, /filter: var\(--salty-cutedge-own, var\(--salty-cutedge-ring\)\) !important;\s*mix-blend-mode: normal !important;/);
    assert.match(css, /filter: var\(--salty-cutedge-pick, var\(--salty-cutedge-own, var\(--salty-cutedge-ring\)\)\) !important;/);
    assert.match(css, /:not\(#salty-cutedge-weight\)[^{]+\{\s*box-shadow: none !important;\s*\}/);
    assert.match(css, /clip-path: inset\(0\);/);
    assert.match(css, /-webkit-mask-image: none !important;\s*mask-image: none !important;\s*clip-path: none !important;/);
    assert.match(css, /\.salty-panel \.bl-cutedge-card \{[^}]*min-height: 44px;/);
    const built = style.slice(style.indexOf('css/68-cutout-edge.css'));
    assert.ok(style.includes('css/68-cutout-edge.css') && built.includes('img.salty-alpha-view'), 'module is built into style.css');
    assert.ok(!/\uAC24/.test(css + read('src/cutedge.js')), 'no forbidden syllable (U+AC24)');
});

const failed = results.filter(r => !r.pass);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
