// 테마 6.1.6 (TTS 1.6.9) 재생 표시 밑줄이 글자색을 따라가게 — 색 읽기 · 가까운 색 · 색으로 묶기 · 이름 · 규칙 · 스위치 · player.js 연결
//   node tools/tests/tts-highlight-colors.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { HIGHLIGHT_BASE, COLOR_LIMIT, NEAR_PLAIN, colorKey, nearColor, highlightName, followsTextColor, groupByColor, highlightRule, pieceKey, groupId, splitGroup, alphaOf, paintKey, bandFrom, markerMask, speakerColor, ownSpeakerColor, readableOn, contrastRatio, luminance, barNameChoice } = await import(pathToFileURL(path.join(root, 'src/addons/tts/src/highlight-colors.js')));

const results = [];
function test(name, fn) { try { fn(); results.push({ name, pass: true }); } catch (e) { results.push({ name, pass: false, error: e.stack || e.message }); } }

test('computed colours become #rrggbb; transparent or half-transparent text has no own colour', () => {
    assert.equal(colorKey('rgb(230, 69, 83)'), '#e64553');
    assert.equal(colorKey('rgba(30, 136, 199, 1)'), '#1e88c7');
    assert.equal(colorKey('rgb(30 136 199 / 0.8)'), '#1e88c7');
    assert.equal(colorKey('rgba(0, 0, 0, 0)'), null);
    assert.equal(colorKey('rgba(10, 20, 30, 0.3)'), null);
    assert.equal(colorKey('rgb(1 2 3 / 40%)'), null);
    assert.equal(colorKey('#ABC'), '#aabbcc');
    assert.equal(colorKey('#A1B2C3'), '#a1b2c3');
    for (const bad of ['currentcolor', '', undefined, null]) assert.equal(colorKey(bad), null);
});

test('near colours: theme dialogue #f5f5f7 next to body #e1e1e5 counts as plain, a real colour does not', () => {
    assert.equal(nearColor('#f5f5f7', '#e1e1e5'), true);
    assert.equal(nearColor('#a4c7ed', '#e1e1e5'), false);
    assert.equal(nearColor('#e64553', null), false);
    assert.equal(nearColor('#000000', `#${NEAR_PLAIN.toString(16).padStart(2, '0').repeat(3)}`), true);
    assert.equal(nearColor('#000000', `#${(NEAR_PLAIN + 1).toString(16).padStart(2, '0').repeat(3)}`), false);
});

test('names: theme colour keeps the old names (style.css rules), each colour gets -c-rrggbb per display style', () => {
    assert.deepEqual(HIGHLIGHT_BASE, { both: 'lv-now', color: 'lv-now-color', underline: 'lv-now-underline' });
    assert.equal(highlightName('both', ''), 'lv-now');
    assert.equal(highlightName('underline', ''), 'lv-now-underline');
    assert.equal(highlightName('underline', '#e64553'), 'lv-now-underline-c-e64553');
    assert.equal(highlightName('nonsense', '#e64553'), 'lv-now-c-e64553', 'unknown style falls back to both');
});

test('only underline styles follow, and only while the switch is on', () => {
    assert.equal(followsTextColor('both'), true);
    assert.equal(followsTextColor('underline', true), true);
    assert.equal(followsTextColor('color', true), false, 'fill-only users see no change');
    assert.equal(followsTextColor('both', false), false);
    assert.equal(followsTextColor('underline', false), false);
});

test('grouping: dialogue and inner-thought colours split, plain or near-plain text stays on the theme colour', () => {
    const pieces = [
        { id: 'plain-1', color: 'rgb(225, 225, 229)' },
        { id: 'red-q', color: 'rgb(230, 69, 83)' },
        { id: 'theme-q', color: 'rgb(245, 245, 247)' },
        { id: 'em', color: 'rgb(164, 199, 237)' },
        { id: 'red-q-2', color: 'rgba(230, 69, 83, 1)' },
        { id: 'clear', color: 'rgba(0, 0, 0, 0)' },
    ];
    const groups = groupByColor(pieces, 'rgb(225, 225, 229)');
    assert.deepEqual([...groups.keys()].sort(), ['', '#a4c7ed', '#e64553']);
    assert.deepEqual(groups.get('').map(p => p.id), ['plain-1', 'theme-q', 'clear']);
    assert.deepEqual(groups.get('#e64553').map(p => p.id), ['red-q', 'red-q-2']);
    assert.equal(groupByColor([], 'rgb(0,0,0)').size, 0);
});

test('whitespace-only pieces stay in the highlight and follow the neighbouring colour (no gaps at spaces)', () => {
    const pieces = [
        { id: 'lead-space', blank: true, color: '' },
        { id: 'red', color: 'rgb(230, 69, 83)' },
        { id: 'gap-1', blank: true, color: '' },
        { id: 'plain', color: 'rgb(225, 225, 229)' },
        { id: 'gap-2', blank: true, color: '' },
        { id: 'green', color: 'rgb(64, 160, 43)' },
    ];
    const groups = groupByColor(pieces, 'rgb(225, 225, 229)');
    assert.deepEqual(groups.get('#e64553').map(p => p.id), ['lead-space', 'red', 'gap-1'], 'a leading space takes the first colour, a gap takes the colour before it');
    assert.deepEqual(groups.get('').map(p => p.id), ['plain', 'gap-2']);
    assert.deepEqual(groups.get('#40a02b').map(p => p.id), ['green']);
    assert.equal([...groups.values()].reduce((n, list) => n + list.length, 0), pieces.length, 'every piece, blank or not, is painted');
    assert.deepEqual([...groupByColor([{ blank: true }, { blank: true }], 'rgb(0,0,0)').keys()], [''], 'an all-space range uses the theme colour');
});

test('color(srgb …) values (Chrome writes color-mix results this way, e.g. my-message text) are read too', () => {
    assert.equal(colorKey('color(srgb 0.952941 0.968627 0.988235)'), '#f3f7fc');
    assert.equal(colorKey('color(srgb 1 0 0 / 0.8)'), '#ff0000');
    assert.equal(colorKey('color(srgb 1 0 0 / 0.3)'), null);
    assert.equal(colorKey('color(srgb 100% 50% 0%)'), '#ff8000');
    const groups = groupByColor([{ id: 'q', color: 'rgb(243, 247, 252)' }], 'color(srgb 0.952941 0.968627 0.988235)');
    assert.deepEqual([...groups.keys()], [''], 'near-plain dialogue in my own message stays on the theme colour');
});

test('a line with too many colours keeps the first ones and puts the rest on the theme colour', () => {
    const pieces = Array.from({ length: COLOR_LIMIT + 5 }, (_, i) => ({ id: i, color: `rgb(${i * 6}, 10, 200)` }));
    const groups = groupByColor(pieces, 'rgb(255, 255, 255)');
    assert.equal([...groups.keys()].filter(Boolean).length, COLOR_LIMIT);
    assert.equal(groups.get('').length, 5);
    assert.equal(groupByColor(pieces, 'rgb(255,255,255)', 2).get('').length, COLOR_LIMIT + 3);
});

test('rules: underline in the text colour (70%, 2px offset); the fill stays the theme colour like style.css', () => {
    assert.equal(highlightRule('both', '#e64553'), '::highlight(lv-now-c-e64553) { background-color: color-mix(in srgb, var(--SmartThemeQuoteColor, #51a0de) 28%, transparent); text-decoration: underline; text-decoration-color: color-mix(in srgb, #e64553 70%, transparent); text-underline-offset: 2px; }');
    assert.equal(highlightRule('underline', '#1e88c7'), '::highlight(lv-now-underline-c-1e88c7) { text-decoration: underline; text-decoration-color: color-mix(in srgb, #1e88c7 70%, transparent); text-underline-offset: 2px; }');
    const css = read('src/addons/tts/style.css');
    assert.match(css, /::highlight\(lv-now\), ::highlight\(lv-now-color\) \{\s*background-color: color-mix\(in srgb, var\(--SmartThemeQuoteColor, #51a0de\) 28%, transparent\);/);
    assert.match(css, /text-decoration-color: color-mix\(in srgb, var\(--SmartThemeQuoteColor, #51a0de\) 70%, transparent\);\s*text-underline-offset: 2px;/);
});

test('switch: default on, tidied from strings, shown only for underline styles, refreshes the live highlight', async () => {
    const settings = read('src/addons/tts/src/settings.js');
    assert.match(settings, /highlight_text_color: true,/);
    assert.match(settings, /s\.highlight_text_color = s\.highlight_text_color !== false && s\.highlight_text_color !== 'false';/);
    const ui = read('src/addons/tts/src/ui.js');
    assert.ok(ui.includes("{ key: 'highlight_text_color', label: '밑줄 색: 글자색 따라가기', type: 'toggle', show: (s) => !!s.highlight && s.highlight_style !== 'color' }"));
    assert.ok(ui.includes("path === 'highlight_text_color') player.refreshHighlight();"));
    const show = s => !!s.highlight && s.highlight_style !== 'color';
    assert.deepEqual(['color', 'both', 'underline'].map(style => show({ highlight: true, highlight_style: style })), [false, true, true]);
    assert.equal(show({ highlight: false, highlight_style: 'underline' }), false);
});

test('player paints and clears through the colour module with the switch; version stamps agree', () => {
    const player = read('src/addons/tts/src/player.js');
    assert.match(player, /import \{ paintColorHighlights, clearColorHighlights(, [a-zA-Z, ]+)? \} from '\.\/highlight-colors\.js';/);
    assert.match(player, /function clearHighlight\(\) \{ stopHighlightWatch\(\); if \(highlightOk\(\)\) clearColorHighlights\(\); \}/);
    assert.match(player, /paintColorHighlights\(root, ranges, style, \{ follow: settings\(\)\.highlight_text_color !== false \}\)/);
    assert.ok(!/CSS\.highlights\.set\(name, new Highlight\(\.\.\.ranges\)\)/.test(player), 'no single theme-colour highlight left in player.js');
    const version = read('src/addons/tts/version.js').match(/TTS_VERSION = '([\d.]+)'/)[1];
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.ok(read('src/addons/tts/style.css').includes(`--lv-css-version: "${version}";`));
    assert.equal(JSON.parse(read('src/addons/tts/manifest.json')).version, version);
    assert.ok(read('src/addons/tts/README.md').startsWith(`# TTS ${version}\n`));
});

// ---------- 1.7.0 (테마 6.1.7) 형광펜 띠 위 밑줄 · 글자 칠 고정 · 다시 칠하기
// 시험대(사용자 설정: 형광펜 직사각형 95 · 데우스 대사색 · 어두운 팔레트)에서 잰 실제 값: 인물색 대사 q 는 color = 인물 색, 글자 칠 = 잉크 #f5f5f7, 띠 = q 바탕(인물 색) + 마스크 2층.
const INK = 'rgb(245, 245, 247)', PLAIN = 'rgb(225, 225, 229)', RED = 'rgb(230, 57, 70)', BLUE = 'rgb(78, 168, 222)';
const MASK = 'linear-gradient(rgb(0, 0, 0) 0px, rgb(0, 0, 0) 0px), url("data:image/svg+xml,%3Csvg%3E")';
test('1.7.0 band test (pure): only q / mark with a background, first block stops it; slot only for the marker mask on a plain-colour band', () => {
    const q = { tag: 'Q', display: 'inline', backgroundColor: RED, backgroundImage: 'none', backgroundClip: 'border-box', mask: MASK };
    assert.deepEqual(bandFrom([{ tag: 'FONT', display: 'inline', backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'none' }, q]), { index: 1, slot: true, color: '#e63946' }, 'prompt-colour marker: q under font');
    assert.deepEqual(bandFrom([{ ...q, backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'url("data:image/svg+xml,…")', mask: 'none' }]), { index: 0, slot: false, color: null }, 'theme marker brush (image band, no mask)');
    assert.deepEqual(bandFrom([{ ...q, backgroundImage: 'linear-gradient(90deg, rgb(255, 107, 107), rgb(255, 209, 102))' }]), { index: 0, slot: false, color: '#e63946' }, 'rainbow flow band (mflow): a band, but no slot — the slot would show a rainbow strip');
    assert.equal(bandFrom([{ tag: 'DEL', display: 'inline', backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'linear-gradient(transparent 45%, red 45%)' }]), null, 'strike line drawn as a background is not a band');
    assert.equal(bandFrom([{ tag: 'CODE', display: 'inline', backgroundColor: 'rgba(255, 255, 255, 0.1)', backgroundImage: 'none' }]), null, 'inline code shading is not a band');
    assert.deepEqual(bandFrom([{ tag: 'SPAN', display: 'inline-block', backgroundColor: 'rgba(0, 0, 0, 0)', backgroundImage: 'linear-gradient(red, blue)', backgroundClip: 'text' }, q]), { index: 1, slot: true, color: '#e63946' }, 'expressive wrapper (inline-block gradient text) around a q: the q is still the band');
    assert.equal(bandFrom([{ tag: 'EM', display: 'inline' }, { tag: 'P', display: 'block' }, q]), null, 'stops at the first block');
    assert.equal(bandFrom([{ ...q, backgroundClip: 'text' }]), null, 'a q painted as gradient text is not a band');
    assert.equal(markerMask(MASK), true);
    assert.equal(markerMask('none'), false);
});
test('1.7.0 underline colour: slot band → the band colour, other band → the visible glyph colour, no band → glyph colour or theme', () => {
    const plain = colorKey(PLAIN);
    assert.deepEqual(pieceKey({ color: RED, fill: INK, band: true, slot: true, bandColor: RED }, plain), { key: '#e63946', pin: '#f5f5f7' }, 'prompt-colour marker: band-colour line, ink glyphs');
    assert.deepEqual(pieceKey({ color: RED, fill: INK, band: true, slot: true, bandColor: 'hsl(355 60% 40%)' }, plain).key, '#e63946', 'unreadable band colour → the text colour');
    assert.deepEqual(pieceKey({ color: RED, fill: INK, band: true, slot: true, bandColor: 'rgb(150, 40, 50)' }, plain).key, '#962832', 'tone mode: the toned band colour, so strip and line are one colour');
    assert.deepEqual(pieceKey({ color: INK, fill: INK, band: true }, plain), { key: '#f5f5f7', pin: '' }, 'theme marker, uncoloured dialogue: the ink even though near plain');
    assert.deepEqual(pieceKey({ color: RED, fill: RED }, plain), { key: '#e63946', pin: '' }, 'inner thought keeps its own colour');
    assert.deepEqual(pieceKey({ color: PLAIN, fill: PLAIN }, plain), { key: '', pin: '' }, 'plain narration → theme colour');
    assert.deepEqual(pieceKey({ color: RED }, plain), { key: '#e63946', pin: '' }, 'no fill reported → color (6.1.6 pieces)');
    assert.deepEqual(pieceKey({ color: RED, fill: INK, band: true, slot: true, bandColor: RED }, plain, false), { key: '', pin: '#f5f5f7' }, 'switch off: theme underline, glyphs still pinned');
});
test('1.7.0 the pin keeps the exact glyph paint: alpha for faded strike text, transparent for gradient text, nothing when fill = color', () => {
    const plain = colorKey(PLAIN);
    assert.equal(paintKey('rgba(245, 245, 247, 0.55)'), '#f5f5f78c');
    assert.equal(paintKey('rgba(0, 0, 0, 0)'), 'transparent');
    assert.equal(paintKey('transparent'), 'transparent');
    assert.equal(paintKey(INK), '#f5f5f7');
    assert.equal(paintKey('nonsense'), null);
    assert.deepEqual(pieceKey({ color: RED, fill: 'rgba(245, 245, 247, 0.55)', band: true }, plain).pin, '#f5f5f78c', 'struck words in a marker q stay faded (was opaque, or flipped to red below 50%)');
    assert.deepEqual(pieceKey({ color: RED, fill: 'rgba(245, 245, 247, 0.3)', band: true }, plain).pin, '#f5f5f74d', 'even under 50% the glyphs keep their paint');
    assert.deepEqual(pieceKey({ color: RED, fill: 'rgba(0, 0, 0, 0)' }, plain), { key: '', pin: 'transparent' }, 'gradient dialogue: theme underline, glyphs stay transparent so the gradient shows');
    assert.deepEqual(pieceKey({ color: RED, fill: RED }, plain).pin, '', 'fill = color: no pin');
    assert.equal(highlightName('underline', '', 'transparent'), 'lv-now-underline-p-t');
    assert.equal(highlightName('underline', '#e63946', '#f5f5f78c'), 'lv-now-underline-c-e63946-p-f5f5f78c');
    assert.equal(highlightRule('both', '', 'transparent'), '::highlight(lv-now-p-t) { background-color: color-mix(in srgb, var(--SmartThemeQuoteColor, #51a0de) 28%, transparent); text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--SmartThemeQuoteColor, #51a0de) 70%, transparent); text-underline-offset: 2px; color: transparent; -webkit-text-fill-color: transparent; }');
});
test('1.7.0 groups carry the pin; names and rules add -p-… and color / -webkit-text-fill-color', () => {
    const pieces = [
        { id: 'narr', color: PLAIN, fill: PLAIN },
        { id: 'red-q', color: RED, fill: INK, band: true, slot: true, bandColor: RED },
        { id: 'gap', blank: true, color: '' },
        { id: 'red-q-2', color: RED, fill: INK, band: true, slot: true, bandColor: RED },
        { id: 'blue-q', color: BLUE, fill: INK, band: true, slot: true, bandColor: BLUE },
        { id: 'plain-q', color: INK, fill: INK, band: true },
        { id: 'thought', color: RED, fill: RED },
    ];
    const groups = groupByColor(pieces, PLAIN);
    assert.deepEqual([...groups.keys()].sort(), ['', '#4ea8de|#f5f5f7', '#e63946', '#e63946|#f5f5f7', '#f5f5f7']);
    assert.deepEqual(groups.get('#e63946|#f5f5f7').map(p => p.id), ['red-q', 'gap', 'red-q-2']);
    assert.deepEqual(groups.get('#f5f5f7').map(p => p.id), ['plain-q']);
    assert.deepEqual(groups.get('#e63946').map(p => p.id), ['thought'], 'the thought (no band) is a different highlight from the pinned dialogue');
    assert.deepEqual(groupByColor(pieces, PLAIN, COLOR_LIMIT, { follow: false }).get('|#f5f5f7').map(p => p.id), ['red-q', 'gap', 'red-q-2', 'blue-q']);
    assert.deepEqual(splitGroup('#e63946|#f5f5f7'), { key: '#e63946', pin: '#f5f5f7' });
    assert.deepEqual(splitGroup(''), { key: '', pin: '' });
    assert.equal(groupId('#e63946', ''), '#e63946');
    assert.equal(highlightName('color', '', '#f5f5f7'), 'lv-now-color-p-f5f5f7');
    assert.equal(highlightRule('underline', '#e63946', '#f5f5f7'), '::highlight(lv-now-underline-c-e63946-p-f5f5f7) { text-decoration: underline; text-decoration-color: color-mix(in srgb, #e63946 70%, transparent); text-underline-offset: 2px; color: #f5f5f7; -webkit-text-fill-color: #f5f5f7; }');
    assert.equal(highlightRule('underline', '', '#f5f5f7'), '::highlight(lv-now-underline-p-f5f5f7) { text-decoration: underline; text-decoration-color: color-mix(in srgb, var(--SmartThemeQuoteColor, #51a0de) 70%, transparent); text-underline-offset: 2px; color: #f5f5f7; -webkit-text-fill-color: #f5f5f7; }', 'theme underline + pin');
    assert.equal(highlightRule('color', '', '#f5f5f7'), '::highlight(lv-now-color-p-f5f5f7) { background-color: color-mix(in srgb, var(--SmartThemeQuoteColor, #51a0de) 28%, transparent); color: #f5f5f7; -webkit-text-fill-color: #f5f5f7; }', 'fill-only style also keeps the ink');
});
test('1.7.0 alpha of a computed colour, including other colour spaces', () => {
    for (const [v, a] of [['transparent', 0], ['rgba(0, 0, 0, 0)', 0], ['rgb(230, 57, 70)', 1], ['rgba(230, 57, 70, 0.35)', 0.35], ['rgb(1 2 3 / 50%)', 0.5], ['color(srgb 1 0 0 / 0.2)', 0.2],
        ['color(display-p3 1 0 0 / 0.5)', 0.5], ['color(rec2020 0.1 0.2 0.3 / 0.4)', 0.4], ['color(display-p3 1 0 0)', 1], ['', 0]]) assert.equal(alphaOf(v), a, v);
});
test('1.7.0 slot: only while following the text colour, diffed (not rewritten each repaint), cleared on clear; CSS repeats the theme two layers', () => {
    const css = read('src/addons/tts/style.css');
    assert.ok(css.includes('#chat .mes_text [data-lv-line] {\n    -webkit-mask: linear-gradient(#000 0 0), linear-gradient(#000 0 0) 0 100% / 100% 2px no-repeat, var(--salty-marker-bg) !important;\n    -webkit-mask-clip: text, border-box, border-box !important;'));
    assert.match(css, /@supports \(-webkit-mask-clip: text\) \{\s*#chat \.mes_text \[data-lv-line\]/);
    const ink = read('css/37-prompt-ink.css');
    assert.ok(ink.includes('-webkit-mask: linear-gradient(#000 0 0), var(--salty-marker-bg);') && ink.includes('-webkit-mask-clip: text, border-box;'), 'the theme mask still has the two layers the slot rule repeats');
    const src = read('src/addons/tts/src/highlight-colors.js');
    assert.match(src, /if \(following && key\) for \(const p of pieces\) if \(p\.slot && p\.bandEl\) slots\.add\(p\.bandEl\);/);
    assert.match(src, /for \(const el of \[\.\.\.slotted\]\) if \(!want\.has\(el\)\)/, 'only removed when no longer wanted');
    assert.match(src, /export function clearColorHighlights\(\) \{\s*clearHighlightsOnly\(\);\s*setSlots\(new Set\(\)\);\s*\}/);
    for (const f of ['src/capture-editor.js', 'src/capture-options.js']) assert.ok(read(f).includes('data-lv-line'), `${f} ignores the read-time slot mark`);
});
test('1.7.0 player repaints the read line on re-render, theme changes and once more after the colours settle — at most every 200 ms, on the same message', () => {
    const player = read('src/addons/tts/src/player.js');
    assert.match(player, /const SETTLE_MS = \[120, 600\];/);
    assert.match(player, /const REPAINT_GAP_MS = 200;/);
    assert.match(player, /w\.mo\.observe\(root, \{ childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: \['class', 'style', 'color'\] \}\);/);
    assert.match(player, /w\.mo\.observe\(document\.body, \{ attributes: true, attributeFilter: \['class'\] \}\);/);
    assert.match(player, /function highlightJob\(job\) \{\s*const root = paintHighlight\(job\);\s*if \(root\) watchHighlight\(job, root\);\s*\}/);
    assert.match(player, /if \(hlWatch !== w \|\| current !== job\) return;/, 'only the line still being read');
    assert.match(player, /const root = prefer\?\.isConnected \? prefer : document\.querySelector/, 'stays on the same message element');
    assert.match(player, /else clearColorHighlights\(\);   \/\/ 글이 바뀌어 못 찾음/);
    assert.match(player, /analysis\.analysisCovers\(cached, need\.langs\)/, 'a pending redo of rewritten lines counts as not covered');
});

// ---------- 1.7.1 (테마 6.1.8) 재생 막대의 이름 색 = 읽는 줄의 대사 색 — 사용자: 「tts 밑에 이름 뜨는 것도 대사 색깔이랑 맞춰 주삼 대사 색 있는 애들은」
test('1.7.1 bar name colour: the dialogue colour that covers most of the read line; plain text, the theme dialogue colour and marker ink count as no colour', () => {
    const TEAL = 'rgb(60, 207, 191)', THEME_DIALOGUE = 'rgb(243, 247, 252)', THEME_EM = 'rgb(164, 199, 237)', THEME_STRONG = 'rgb(255, 232, 115)', WHITE_EM = 'rgb(51, 111, 166)';
    const THEME = [PLAIN, THEME_DIALOGUE, INK, THEME_EM, THEME_STRONG];   // player.js THEME_INKS 를 푼 값 (블루 아워)
    assert.equal(speakerColor([{ color: TEAL, start: 0, end: 40 }], THEME), '#3ccfbf', 'thought line in the character colour (screenshot case)');
    assert.equal(speakerColor([{ color: RED, fill: INK, start: 0, end: 10 }], THEME), '#e63946', 'marker dialogue: the band colour (color), not the ink fill');
    assert.equal(speakerColor([{ color: PLAIN, start: 0, end: 30 }], THEME), '', 'plain narration → theme colour');
    assert.equal(speakerColor([{ color: THEME_DIALOGUE, start: 0, end: 30 }], THEME), '', 'uncoloured dialogue painted by the theme → theme colour');
    assert.equal(speakerColor([{ color: INK, start: 0, end: 30 }], THEME), '', 'uncoloured marker dialogue (ink) → theme colour');
    assert.equal(speakerColor([{ color: THEME_EM, start: 0, end: 30 }], THEME), '', 'an uncoloured character’s thought / italic in the theme em colour → theme colour');
    assert.equal(speakerColor([{ color: THEME_STRONG, start: 0, end: 30 }], THEME), '', 'bold-only line in the theme strong colour → theme colour');
    assert.equal(speakerColor([{ color: WHITE_EM, start: 0, end: 30 }], [PLAIN, WHITE_EM]), '', 'other palettes too (화이트 em)');
    assert.equal(speakerColor([{ color: THEME_EM, start: 0, end: 30 }, { color: TEAL, start: 0, end: 10 }], THEME), '#3ccfbf', 'a real character colour wins even when shorter than theme-coloured words');
    assert.equal(speakerColor([{ color: RED, start: 0, end: 5 }, { color: TEAL, start: 0, end: 20 }, { blank: true, start: 0, end: 50 }], [PLAIN]), '#3ccfbf', 'most letters win; spaces do not count');
    assert.equal(speakerColor([{ color: 'rgba(0, 0, 0, 0)', start: 0, end: 30 }], [PLAIN]), '', 'gradient text (transparent) → theme colour');
    assert.equal(speakerColor([{ color: '#e63946', text: '오늘은 늦었네.' }], []), '#e63946', 'source markup colours (off screen) by text length');
    assert.equal(speakerColor([], [PLAIN]), '');
});
test('1.7.1 bar: name tinted per line from the read range (same ranges as the highlight), reset while waiting; source colours when off screen', () => {
    const player = read('src/addons/tts/src/player.js');
    assert.match(player, /import \{ paintColorHighlights, clearColorHighlights, piecesOf, speakerColor, colorKey, barNameChoice, alphaOf, luminance \} from '\.\/highlight-colors\.js';/);
    assert.match(player, /tintBarName\(job\);   \/\/ 1\.7\.1/);
    assert.match(player, /if \(job\.barTint\) barEl\.voice\.style\.setProperty\('--lv-name', job\.barTint\); else barEl\.voice\.style\.removeProperty\('--lv-name'\);/);
    assert.match(player, /barEl\.voice\.textContent = String\(mes\?\.name \|\| ''\);\s*try \{ barEl\.voice\.style\.removeProperty\('--lv-name'\); \}/);
    assert.match(player, /if \(fresh \|\| job\.barTint === undefined\)/, 'measured once per line');
    assert.match(player, /tintBarName\(job, true\);   \/\/ 1\.7\.1 막대 이름 색도 다시/, 're-measured when the line is repainted');
    assert.ok(!/barEl\.voice\.style\.color =/.test(player), 'no inline colour (it would beat the dimmed paused / waiting name)');
    const css = read('src/addons/tts/style.css');
    assert.ok(css.includes('font-weight: 600; color: var(--lv-name, var(--lv-accent)); }'));
    assert.ok(css.includes('.lv-bar-paused .lv-bar-voice { color: var(--lv-dim); }') && css.includes('.lv-bar-wait .lv-bar-voice { color: var(--lv-dim); }'), 'paused / waiting still dim the name');
    assert.match(player, /if \(ranges\.length\) line = speakerColor\(piecesOf\(ranges, root\), \[getComputedStyle\(root\)\.color, \.\.\.themeInks\(\)\]\);/, '6.5.4: the screen colour is only a fallback for speakers without a colour of their own');
    assert.match(player, /const THEME_INKS = \['--salty-dialogue', '--salty-marker-ink', '--salty-em', '--salty-strong', '--SmartThemeEmColor', '--SmartThemeQuoteColor', '--SmartThemeBodyColor'\];/);
    assert.match(player, /const parts = \(job\.parts \|\| \[\]\)\.map\(p => \(\{ color: p\.seg\?\.color \|\| p\.alt\?\.color \|\| '', text: p\.seg\?\.text \|\| p\.alt\?\.text \|\| '' \}\)\);\n        line = speakerColor\(parts, off\);/, 'off-screen source colours also skip theme colours');
    assert.match(player, /const ranges = rangesFor\(job, root\);\n/, 'the highlight uses the same range finder');
});

// ---------- 6.3.9 막대 이름 색: 화자의 팔레트 색이 그 줄에 보이면 그 색 — 사용자 제보: 옅은 노랑 · 하늘색 인물의 막대 이름이 테마 색으로 나옴
test('6.3.9 bar name colour: the speaker palette colour wins when it is on the line, even near a theme ink; theme-ink text stays theme colour', () => {
    const THEME_STRONG = 'rgb(255, 232, 115)', THEME_QUOTE = 'rgb(147, 201, 255)', PLAIN_BODY = 'rgb(225, 225, 229)';
    const INKS = [PLAIN_BODY, 'rgb(245, 245, 247)', 'rgb(164, 199, 237)', THEME_STRONG, THEME_QUOTE];   // 블루 레몬에이드 어둠 + 실리태번 인용색 (시험대에서 잰 값)
    const YELLOW = 'rgb(240, 216, 120)', SKY = 'rgb(127, 212, 234)';
    // 고치기 전: 테마 잉크와 ±24 안이라 「색 없음」
    assert.equal(speakerColor([{ color: YELLOW, start: 0, end: 40 }], INKS), '', 'yellow #f0d878 is within 24 of the bold ink #ffe873 (15 · 16 · 5)');
    assert.equal(speakerColor([{ color: SKY, start: 0, end: 40 }], INKS), '', 'sky #7fd4ea is within 24 of the quote colour #93c9ff (20 · 11 · 21)');
    // 고친 뒤: 화자의 팔레트 색이 그 줄에 있으면 그 색
    assert.equal(ownSpeakerColor([{ color: YELLOW, start: 0, end: 40 }], '#f0d878'), '#f0d878');
    assert.equal(ownSpeakerColor([{ color: SKY, start: 0, end: 40 }], '#7FD4EA'), '#7fd4ea', 'palette colours are folded (upper case)');
    assert.equal(ownSpeakerColor([{ color: THEME_STRONG, start: 0, end: 40 }], '#f0d878'), '', 'bold-only text in the theme ink is not the yellow character (15 apart > 6)');
    assert.equal(ownSpeakerColor([{ color: PLAIN_BODY, start: 0, end: 40 }], '#f0d878'), '', 'uncoloured line → no palette colour → theme colour');
    assert.equal(ownSpeakerColor([{ color: YELLOW, blank: true }], '#f0d878'), '', 'spaces do not count');
    assert.equal(ownSpeakerColor([{ color: YELLOW }], ''), '', 'no palette colour for the speaker');
    assert.equal(ownSpeakerColor([{ color: '#e63946', text: '…' }], '#e63946'), '#e63946', 'source markup colours (off screen) too');
    const player = read('src/addons/tts/src/player.js');
    assert.match(player, /function speakerPalette\(job\) \{[\s\S]*?return colorOfName\(job\.speaker \|\| '', \{ userName \}\) \|\| '';/);
    assert.match(player, /import \{ resolveSpeaker, canon, knownNames as learnedNames, colorOfName, ownerOfColor \} from '\.\/speakers\.js';/);
});

// ---------- 6.5.4 막대 이름 색: 화자 자신의 색이 먼저 · 막대 배경에서 읽히게 밝기만 조절 · 남의 색은 절대 안 집음 — 사용자 제보: 어두운 슬레이트(#424c59) 인물의 줄이 옆 인물의 빨강으로 칠해져 막대 이름도 빨강
test('6.5.4 bar name colour: own colour wins and is lightened on a dark bar; no own colour → line colour unless it belongs to another known speaker', () => {
    const DARK = '#1c1c20', LIGHT = '#f3f3f5';
    assert.ok(Math.abs(luminance('#ffffff') - 1) < 1e-6 && luminance('#000000') === 0 && luminance('nope') === null);
    assert.ok(contrastRatio('#ffffff', '#000000') > 20.9 && contrastRatio('#e63946', DARK) >= 3, 'red reads on the dark bar');
    assert.ok(contrastRatio('#424c59', DARK) < 3, 'the dark slate does not read on the dark bar');
    const slate = readableOn('#424c59', DARK);
    assert.match(slate, /^#[0-9a-f]{6}$/); assert.ok(contrastRatio(slate, DARK) >= 3, 'lightened until it reads'); assert.notEqual(slate, '#424c59');
    const hue = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; if (!d) return 0; return (max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; };
    assert.ok(Math.abs(hue(slate) - hue('#424c59')) < 3, 'same hue — only lightness moved');
    assert.equal(readableOn('#e63946', DARK), '#e63946', 'a readable colour is untouched');
    assert.equal(readableOn('rgb(230, 57, 70)', DARK), '#e63946', 'computed colours are folded');
    const yellowOnWhite = readableOn('#f0d878', LIGHT); assert.ok(contrastRatio(yellowOnWhite, LIGHT) >= 3 && luminance(yellowOnWhite) < luminance('#f0d878'), 'darkened on a light bar');
    assert.equal(readableOn('#424c59', ''), '#424c59', 'unknown background → as is'); assert.equal(readableOn('', DARK), ''); assert.equal(readableOn('rgba(0,0,0,0)', DARK), '');
    // 고르기
    assert.equal(barNameChoice({ own: '#424c59', line: '#e63946', background: DARK }), slate, 'own colour wins over the red the line shows (and is lightened)');
    assert.equal(barNameChoice({ own: '#e63946', line: '', background: DARK }), '#e63946', 'own colour even when the line shows nothing');
    assert.equal(barNameChoice({ own: '', line: '#e63946', otherOwner: true, background: DARK }), '', 'no own colour: another speaker\'s colour is never taken → theme colour');
    assert.equal(barNameChoice({ own: '', line: '#3ccfbf', otherOwner: false, background: DARK }), '#3ccfbf', 'no own colour: an unowned line colour still tints the name (1.7.1)');
    assert.equal(barNameChoice({ line: '#424c59', background: DARK }), slate, 'an unowned dark line colour is lightened too');
    assert.equal(barNameChoice({}), ''); assert.equal(barNameChoice({ own: 'rgba(1,2,3,0.3)', line: 'none' }), '');
    // player.js 연결: 제 색이 화면 · 원문 색보다 먼저, 줄의 색은 임자가 다른 인물이면 버림, 배경은 막대에서
    const player = read('src/addons/tts/src/player.js');
    assert.match(player, /const own = speakerPalette\(job\);\n    const background = barBackground\(\);\n    if \(own\) return barNameChoice\(\{ own, background \}\);/, 'own colour first, before any screen or source colour');
    assert.match(player, /return barNameChoice\(\{ line, otherOwner: isOtherSpeaker\(line, job\), background \}\);/);
    assert.match(player, /function isOtherSpeaker\(color, job\) \{[\s\S]*?const owner = ownerOfColor\(color\);/);
    assert.match(player, /function barBackground\(\) \{[\s\S]*?alphaOf\(bg\) >= 0\.8 && colorKey\(bg\)\) return colorKey\(bg\);\n        const ink = colorKey\(getComputedStyle\(bar \|\| document\.body\)\.color\);/, 'the 92 % bar background counts; the fallback reads the bar text, never the tinted name');
    const speakers = read('src/addons/tts/src/speakers.js');
    assert.match(speakers, /export function ownerOfColor\(color\) \{/);
});

const failed = results.filter(r => !r.pass);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
