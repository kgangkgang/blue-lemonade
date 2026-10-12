// 6.1.6 투명 그림(캐릭터 컷) 외곽선 · 그림자 — 값 정리 · 필터 문자열 · 그림 가장자리 색 · 설정 저장/되돌리기 · 연결
//   node tools/tests/cutout-edge.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const edge = await import(pathToFileURL(path.join(root, 'src/cutedge.js')));
const { CUT_EDGE_DEFAULTS, CUT_EDGE_RANGES, normalizeCutEdge, tidyCutEdge, cutEdgeDefaults, cutEdgeVars, cutEdgeClasses, dropShadow, imageFrameOn,
    shadowOffset, rgba, ringFilterMarkup, edgeColorFromGrid, quantizeColor, pickFilterId, RING_ID } = edge;

const results = [];
const panel0 = () => read('src/panel.js');
async function test(name, fn) { try { await fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }

await test('defaults are the prototype the user approved: white 2px 90%, no blur, shadow down 6px black 55% blur 12, clipped', () => {
    assert.deepEqual(normalizeCutEdge(undefined), {
        overflow: false,
        outline: { on: true, colorMode: 'custom', color: '#ffffff', width: 2, alpha: 90, blur: 0 },
        shadow: { on: true, color: '#000000', alpha: 55, angle: 90, distance: 6, blur: 12 },
    });
    assert.deepEqual(cutEdgeVars(undefined), { '--salty-cutedge-ring': `url("#${RING_ID}")`, '--salty-cutedge-drop': 'drop-shadow(0px 6px 12px rgba(0, 0, 0, 0.55))' });
    assert.deepEqual(cutEdgeClasses(undefined), ['salty-cutedge']);
    const fresh = cutEdgeDefaults();
    fresh.outline.width = 7; fresh.shadow.alpha = 1;
    assert.equal(CUT_EDGE_DEFAULTS.outline.width, 2, 'reset copy is deep');
    assert.equal(cutEdgeDefaults().shadow.alpha, 55);
});

await test('normalize clamps ranges, rejects bad colours and modes, reads imported string booleans', () => {
    const e = normalizeCutEdge({ overflow: 'true', outline: { on: 'false', colorMode: 'rainbow', color: 'red', width: 99, alpha: -5, blur: '3.5' }, shadow: { angle: 400, distance: '3', blur: 'x', color: '#ABCDEF' } });
    assert.equal(e.overflow, true);
    assert.deepEqual(e.outline, { on: false, colorMode: 'custom', color: '#ffffff', width: 8, alpha: 0, blur: 3.5 });
    assert.deepEqual(e.shadow, { on: true, color: '#abcdef', alpha: 55, angle: 360, distance: 3, blur: 12 });
    assert.equal(normalizeCutEdge({ outline: { colorMode: 'picture' } }).outline.colorMode, 'picture');
    assert.equal(normalizeCutEdge({ outline: { width: 0 } }).outline.width, 0.5, 'thinnest outline is 0.5px');
    assert.equal(normalizeCutEdge({ outline: { width: '' } }).outline.width, 2, 'empty text keeps the default');
    for (const [key, [min, max, step]] of Object.entries(CUT_EDGE_RANGES)) {
        const [part, name] = key.split('.');
        assert.ok(min < max && step > 0, key);
        assert.ok(CUT_EDGE_DEFAULTS[part][name] >= min && CUT_EDGE_DEFAULTS[part][name] <= max, `${key} default inside its range`);
    }
});

await test('tidy keeps the same objects (settings window holds them) and drops unknown keys', () => {
    const holder = { cutEdge: { junk: 1, outline: { width: '4', stray: true }, shadow: null } };
    const keep = holder.cutEdge, keepOutline = holder.cutEdge.outline;
    tidyCutEdge(holder);
    assert.equal(holder.cutEdge, keep);
    assert.equal(holder.cutEdge.outline, keepOutline);
    assert.equal(holder.cutEdge.outline.width, 4);
    assert.ok(!('junk' in holder.cutEdge) && !('stray' in holder.cutEdge.outline));
    assert.deepEqual(holder.cutEdge.shadow, { ...CUT_EDGE_DEFAULTS.shadow });
    const empty = {}; tidyCutEdge(empty); assert.deepEqual(empty.cutEdge, cutEdgeDefaults());
});

await test('classes and variables: each part can be off, zero strength draws nothing, both off removes the filter class', () => {
    const off = { outline: { on: false }, shadow: { on: false } };
    assert.deepEqual(cutEdgeClasses(off), []);
    assert.deepEqual(cutEdgeVars(off), { '--salty-cutedge-ring': 'opacity(1)', '--salty-cutedge-drop': 'opacity(1)' });
    assert.deepEqual(cutEdgeClasses({ outline: { alpha: 0 }, shadow: { alpha: 0 } }), []);
    assert.deepEqual(cutEdgeVars({ shadow: { on: false } }), { '--salty-cutedge-ring': `url("#${RING_ID}")`, '--salty-cutedge-drop': 'opacity(1)' });
    assert.equal(dropShadow({ outline: { on: false }, shadow: { angle: 0, distance: 4, blur: 2, color: '#112233', alpha: 40 } }), 'drop-shadow(4px 0px 2px rgba(17, 34, 51, 0.4))');
    assert.deepEqual(cutEdgeClasses({ overflow: true }), ['salty-cutedge', 'salty-cutedge-out']);
    assert.deepEqual(cutEdgeClasses({ outline: { colorMode: 'picture' } }), ['salty-cutedge', 'salty-cutedge-pick']);
    assert.deepEqual(cutEdgeClasses({ outline: { colorMode: 'picture', on: false } }), ['salty-cutedge'], 'picture colour only matters while the outline shows');
});

await test('image frames win: while a frame or frame shadow is on (square shape), no cut-edge classes so 6.1.5 frames look the same', () => {
    assert.equal(imageFrameOn({ shape: 'rect', edge: 'none', edgeShadow: false }), false);
    for (const edge of ['line', 'inset', 'glow', 'prism']) assert.equal(imageFrameOn({ shape: 'rect', edge, edgeShadow: false }), true, edge);
    assert.equal(imageFrameOn({ shape: 'rect', edge: 'none', edgeShadow: true }), true, 'frame shadow alone');
    assert.equal(imageFrameOn({ shape: 'custom', edge: 'glow', edgeShadow: true }), false, 'frame rules only run on the square shape');
    assert.equal(imageFrameOn(null), false);
    assert.deepEqual(cutEdgeClasses(undefined, { frame: true }), []);
    assert.deepEqual(cutEdgeClasses(undefined, { frame: false }), ['salty-cutedge']);
});

await test('angle follows the text shadow: 0 = right, 90 = down, 180 = left', () => {
    assert.deepEqual(shadowOffset(0, 5), [5, 0]);
    assert.deepEqual(shadowOffset(90, 5), [0, 5]);
    assert.deepEqual(shadowOffset(180, 5), [-5, 0]);
    assert.deepEqual(shadowOffset(45, 2), [1.41, 1.41]);
    assert.equal(rgba('#ff8000', 50), 'rgba(255, 128, 0, 0.5)');
    assert.equal(rgba('nope', 100), 'rgba(0, 0, 0, 1)');
});

await test('outline filter: silhouette dilate → flood → in, optional blur on the ring only, region by overflow', () => {
    const clip = ringFilterMarkup('a', '#ffffff', undefined);
    assert.match(clip, /^<filter id="a" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB">/);
    assert.match(clip, /<feMorphology in="SourceAlpha" operator="dilate" radius="2" result="grown"\/>/);
    assert.match(clip, /<feFlood flood-color="#ffffff" flood-opacity="0.9" result="ink"\/>/);
    assert.match(clip, /<feComposite in="ink" in2="grown" operator="in" result="ring"\/>/);
    assert.ok(!clip.includes('feGaussianBlur'));
    assert.match(clip, /<feMerge><feMergeNode in="ring"\/><feMergeNode in="SourceGraphic"\/><\/feMerge><\/filter>$/);
    const soft = ringFilterMarkup('b', '#123456', { overflow: true, outline: { blur: 3, width: 5.5, alpha: 40 } });
    assert.match(soft, /x="-20%" y="-20%" width="140%" height="140%"/);
    assert.match(soft, /radius="5.5"/);
    assert.match(soft, /flood-color="#123456" flood-opacity="0.4"/);
    assert.match(soft, /<feGaussianBlur in="ring" stdDeviation="1.5" result="soft"\/><feMerge><feMergeNode in="soft"\/>/);
    assert.match(ringFilterMarkup('c', 'javascript:x', undefined), /flood-color="#ffffff"/, 'only #rrggbb reaches the markup');
});

function grid48(paint) {
    const g = new Uint8ClampedArray(48 * 48 * 4);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const c = paint(x, y); if (c) g.set(c, (y * 48 + x) * 4); }
    return g;
}
await test('edge colour = alpha-weighted average of opaque cells touching transparency (silhouette, not the cut)', () => {
    // 가운데 원: 바깥 고리 파랑, 속 빨강 — 실루엣 바로 안쪽만 보므로 파랑
    const disc = grid48((x, y) => { const d = Math.hypot(x - 23.5, y - 23.5); return d > 16 ? null : d > 14 ? [20, 60, 220, 255] : [230, 20, 20, 255]; });
    const c = edgeColorFromGrid(disc);
    assert.ok(c && c.b > 200 && c.r < 40, JSON.stringify(c));
    // 아래가 그림 칸에 잘린 몸: 아래 가장자리(격자 바깥)는 실루엣이 아니다 → 잘린 면의 색(초록)은 안 섞인다
    const body = grid48((x, y) => (x < 12 || x > 35 ? null : y >= 44 ? [0, 200, 0, 255] : y < 8 ? null : [200, 150, 90, 255]));
    const b = edgeColorFromGrid(body);
    assert.ok(b && b.g < 160 && b.r > 150, JSON.stringify(b));
    assert.equal(edgeColorFromGrid(grid48(() => [10, 10, 10, 255])), null, 'fully opaque picture has no silhouette');
    assert.equal(edgeColorFromGrid(grid48((x, y) => (x === 5 && y === 5 ? [255, 255, 255, 255] : null))), null, 'a speck is not a silhouette');
    assert.equal(edgeColorFromGrid(null), null);
    assert.equal(edgeColorFromGrid(new Uint8ClampedArray(10)), null);
    assert.equal(quantizeColor({ r: 250, g: 3, b: 128 }), '#ff0088');
    assert.equal(quantizeColor(null), null);
    assert.equal(pickFilterId('#ff0088'), 'salty-cutedge-ring-ff0088');
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
    s.image.cutEdge.outline.width = '6'; s.image.cutEdge.shadow.on = 'false'; s.image.cutEdge.overflow = 'true';
    ctx.extensionSettings.salty = JSON.parse(JSON.stringify(s));
    invalidateSettings();
    s = getSettings();
    assert.equal(s.image.cutEdge.outline.width, 6);
    assert.equal(s.image.cutEdge.shadow.on, false);
    assert.equal(s.image.cutEdge.overflow, true);
    assert.equal(settingChanged(s, 'image.cutEdge.outline.width'), true);
    assert.equal(resetSetting(s, 'image.cutEdge.outline.width'), true);
    assert.equal(s.image.cutEdge.outline.width, 2);
    assert.deepEqual(settingRoute('image.cutEdge.shadow.angle'), { tab: 'image', sub: 'cutedge' });
});

await test('wiring: assets marks .salty-alpha regardless of the cut-out switch, apply writes vars/classes/filters, panel shows every control', () => {
    const assets = read('src/assets.js');
    assert.match(assets, /import \{ paintCutEdge \} from '\.\/cutedge\.js';/);
    assert.match(assets, /host\.classList\.toggle\('salty-alpha', rec\.cutout\);/);
    assert.match(assets, /paintCutEdge\(host, rec\);/);
    const apply = read('src/apply.js');
    assert.match(apply, /cutEdgeVars\(s\.image\.cutEdge\)/);
    assert.match(apply, /for \(const name of cutEdgeClasses\(s\.image\.cutEdge, \{ frame: imageFrameOn\(s\.image\) \}\)\) want\.add\(name\);/);
    assert.match(apply, /syncCutEdge\(s\.image\.cutEdge, !!s\.enabled && !imageFrameOn\(s\.image\)\);/);
    assert.ok(panel0().includes("이미지 › 테두리를 쓰는 동안은 테두리가 먼저라 외곽선 · 그림자가 쉬어요."), 'panel says why it pauses');
    assert.ok(read('src/settings-search.js').includes("const subs={cutedge:'투명 그림',"), 'search breadcrumb');
    const panel = read('src/panel.js');
    assert.match(panel, /\['cutedge', '투명 그림'\]/);
    for (const key of ['outline.width', 'outline.alpha', 'outline.blur', 'shadow.alpha', 'shadow.angle', 'shadow.distance', 'shadow.blur']) assert.ok(panel.includes(`slider('image.cutEdge.${key}'`), key);
    for (const key of ['outline.on', 'shadow.on', 'overflow']) assert.ok(panel.includes(`toggle('image.cutEdge.${key}'`), key);
    for (const key of ['outline.color', 'shadow.color']) assert.ok(panel.includes(`color('image.cutEdge.${key}'`), key);
    assert.ok(panel.includes("seg('image.cutEdge.outline.colorMode', [['custom', '직접'], ['picture', '그림 가장자리 색']])"));
    assert.ok(panel.includes('data-act="cutedge-reset"') && panel.includes("case 'cutedge-reset':"));
    assert.ok(panel.includes("'image.cutEdge.outline.on', 'image.cutEdge.shadow.on', 'image.cutEdge.overflow'"), 'toggles that show/hide rows re-render');
    const labels = read('src/settings-labels.js');
    for (const leaf of ['overflow', 'outline.on', 'outline.colorMode', 'outline.color', 'outline.width', 'outline.alpha', 'outline.blur', 'shadow.on', 'shadow.color', 'shadow.alpha', 'shadow.angle', 'shadow.distance', 'shadow.blur']) assert.ok(labels.includes(`'image.cutEdge.${leaf}':`), leaf);
    assert.ok(read('src/settings-search.js').includes("['image','cutedge','투명 그림 외곽선 · 그림자'"));
    assert.ok(read('src/chat-capture.js').includes("document.getElementById('salty-cutedge-defs')"), 'captures carry the outline filter');
    assert.ok(read('src/capture-editor.js').includes("'salty-asset','salty-cutout','salty-alpha'"));
});

await test('CSS: built into style.css, preview included, clipping by default, overflow lifts mask and clip-path', () => {
    const css = read('css/68-cutout-edge.css');
    const style = read('style.css');
    const target = ':is(.salty-alpha :is(.custom-cac-img, img.character-asset-rendered, img.eh-img, img[data-autopic-id], img.mes_img), [class*="custom-imageWrapper"].salty-alpha img, img.salty-alpha)';
    for (const rule of [
        `body.salty.salty-cutedge :is(#chat, #salty-nochat, .salty-preview) :is(.mes_text, .autopic-media-owner .mes_media_wrapper) ${target} {`,
        `body.salty.salty-cutedge.salty-cutedge-pick :is(#chat, #salty-nochat, .salty-preview) :is(.mes_text, .autopic-media-owner .mes_media_wrapper) ${target} {`,
        'body.salty.salty-cutedge:not(.salty-cutedge-out) :where(#chat, #salty-nochat, .salty-preview)',
        `body.salty.salty-cutedge.salty-cutedge-out:not(.salty-shape-custom) :is(#chat, #salty-nochat, .salty-preview) :is(.mes_text, .autopic-media-owner .mes_media_wrapper) ${target} {`,
        `body.salty.salty-cutedge:not(#salty-cutedge-weight) :is(#chat, #salty-nochat, .salty-preview) :is(.mes_text, .autopic-media-owner .mes_media_wrapper) ${target} {`,
    ]) assert.ok(css.includes(rule), rule);
    // style.css 는 빌드가 #chat 을 :is(#chat,.bl-chat-like) 로 바꾸고 :is 목록을 나눠 쓴다 → 모듈 표시와 선언으로 본다
    const built = style.slice(style.indexOf('css/68-cutout-edge.css'));
    assert.ok(style.includes('css/68-cutout-edge.css') && built.length > 0, 'module is built into style.css');
    for (const decl of ['filter: var(--salty-cutedge-ring) var(--salty-cutedge-drop) !important;', 'filter: var(--salty-cutedge-pick, var(--salty-cutedge-ring)) var(--salty-cutedge-drop) !important;', 'clip-path: inset(0);', 'mask-image: none !important;']) assert.ok(built.includes(decl), `style.css: ${decl}`);
    assert.ok(built.includes('body.salty.salty-cutedge :is(:is(#chat,.bl-chat-like), #salty-nochat, .salty-preview)'), 'chat, chat-like copies and the settings preview');
    assert.match(css, /filter: var\(--salty-cutedge-ring\) var\(--salty-cutedge-drop\) !important;/);
    assert.match(css, /filter: var\(--salty-cutedge-pick, var\(--salty-cutedge-ring\)\) var\(--salty-cutedge-drop\) !important;/);
    assert.match(css, /filter: var\(--salty-cutedge-ring\) var\(--salty-cutedge-drop\) !important;\s*mix-blend-mode: normal !important;/);
    assert.match(css, /:not\(#salty-cutedge-weight\)[^{]+\{\s*box-shadow: none !important;\s*\}/);
    assert.match(css, /clip-path: inset\(0\);/);
    assert.match(css, /-webkit-mask-image: none !important;\s*mask-image: none !important;\s*clip-path: none !important;/);
    assert.ok(!/\uAC24/.test(css + read('src/cutedge.js')), 'no forbidden syllable (U+AC24)');
});

const failed = results.filter(r => !r.pass);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
