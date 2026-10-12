// 테마 6.1.6 (TTS 1.6.9) 재생 표시 밑줄이 글자색을 따라가게 — 색 읽기 · 가까운 색 · 색으로 묶기 · 이름 · 규칙 · 스위치 · player.js 연결
//   node tools/tests/tts-highlight-colors.mjs .
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url)));
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { HIGHLIGHT_BASE, COLOR_LIMIT, NEAR_PLAIN, colorKey, nearColor, highlightName, followsTextColor, groupByColor, highlightRule } = await import(pathToFileURL(path.join(root, 'src/addons/tts/src/highlight-colors.js')));

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
    assert.match(player, /import \{ paintColorHighlights, clearColorHighlights \} from '\.\/highlight-colors\.js';/);
    assert.match(player, /function clearHighlight\(\) \{ if \(highlightOk\(\)\) clearColorHighlights\(\); \}/);
    assert.match(player, /paintColorHighlights\(root, ranges, style, \{ follow: settings\(\)\.highlight_text_color !== false \}\)/);
    assert.ok(!/CSS\.highlights\.set\(name, new Highlight\(\.\.\.ranges\)\)/.test(player), 'no single theme-colour highlight left in player.js');
    const version = read('src/addons/tts/version.js').match(/TTS_VERSION = '([\d.]+)'/)[1];
    assert.match(version, /^\d+\.\d+\.\d+$/);
    assert.ok(read('src/addons/tts/style.css').includes(`--lv-css-version: "${version}";`));
    assert.equal(JSON.parse(read('src/addons/tts/manifest.json')).version, version);
    assert.ok(read('src/addons/tts/README.md').startsWith(`# TTS ${version}\n`));
});

const failed = results.filter(r => !r.pass);
console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed }, null, 2));
if (failed.length) process.exitCode = 1;
