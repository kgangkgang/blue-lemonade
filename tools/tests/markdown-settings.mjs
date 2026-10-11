import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
// Runs against an explicit theme root or this repository. Uses synthetic in-memory settings only.
const root = pathToFileURL(path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url))) + path.sep);
const loadModule = file => import(new URL('src/' + file, root));
const { MARKDOWN_CONTROLS, MARKDOWN_TUNING, MARKDOWN_DEFAULTS, tidyMarkdown, markdownClasses, markdownVariables } = await loadModule('markdown.js');
const { DEFAULTS, getSettings, invalidateSettings, resetSettings } = await loadModule('settings.js');
const { captureStyle, applyStyleData } = await loadModule('styles.js');
const { capturePreset, readPreset, applyPreset } = await loadModule('preset-sharing.js');
const { SettingsHistory } = await loadModule('settings-history.js');
const { appearanceSnapshot, beginComparison, comparisonView, endComparison } = await loadModule('appearance-compare.js');
const { changedSettings, settingRoute, resetSetting } = await loadModule('settings-differences.js');
const { syncDeviceLayout, saveDeviceLayout } = await loadModule('device-layouts.js');
const { searchSettings, SEARCH_ENTRIES } = await loadModule('settings-search.js');
const ctx = { extensionSettings: {}, powerUserSettings: {}, saveSettingsDebounced() {} };
globalThis.SillyTavern = { getContext: () => ctx };
const fresh = () => structuredClone(DEFAULTS);
const loaded = value => { ctx.extensionSettings.salty = structuredClone(value); invalidateSettings(); return getSettings(); };
const decorated = () => {
    const s = fresh();
    for (const { key, options } of MARKDOWN_CONTROLS) s.markdown[key] = options.at(-1)[0];
    for (const { key, min } of MARKDOWN_TUNING) s.markdown[key] = min;
    s.markdown.accentOwn = true; s.markdown.accentColor = '#b16dc2';
    return s;
};
const results = [];
async function check(name, run) { try { await run(); results.push({ name, pass: true }); } catch (error) { results.push({ name, pass: false, error: error.stack }); } }
await check('old settings receive default choices without replacing custom appearance', () => {
    const old = fresh(); delete old.markdown; old.palette = 'lemon-night'; old.type.size = 23; old.type.letterSpacing = 12; old.fonts.text.ko = 'custom-font'; old.dialogue.style = 'plain'; old.image.radius = 31;
    const after = loaded(old);
    assert.deepEqual(after.markdown, MARKDOWN_DEFAULTS);
    for (const key of ['type', 'fonts', 'dialogue', 'image']) assert.deepEqual(after[key], old[key]);
    assert.deepEqual(markdownClasses(after.markdown), []);
});
await check('existing Markdown selections survive adding finer decoration settings', () => {
    const s = fresh();
    s.markdown = { size:'small', space:'compact', heading:'line', hr:'line', quote:'plain', list:'accent', link:'plain', table:'zebra', details:'card', mark:'soft', underline:'wavy' };
    s.strong.weight = 800; s.strong.size = 19; s.type.codeSize = 14;
    const before = structuredClone(s), after = loaded(s);
    for (const [key, value] of Object.entries(before.markdown)) assert.equal(after.markdown[key], value, key);
    for (const key of Object.keys(MARKDOWN_DEFAULTS).filter(key => !Object.hasOwn(before.markdown, key))) assert.equal(after.markdown[key], MARKDOWN_DEFAULTS[key], key);
    assert.deepEqual(after.strong, before.strong); assert.equal(after.type.codeSize, 14);
    assert.deepEqual(markdownVariables(after.markdown), {}, 'old choices do not acquire numeric or color overrides');
});
await check('all choices survive normalization and produce only the declared class', () => {
    for (const { key, options } of MARKDOWN_CONTROLS) for (const [choice] of options) {
        const s = fresh(); s.markdown[key] = choice;
        assert.equal(loaded(s).markdown[key], choice);
        assert.deepEqual(markdownClasses(s.markdown), choice === options[0][0] ? [] : [`salty-md-${key}-${choice}`]);
    }
});
await check('invalid group and CSS-like strings safely return to defaults', () => {
    for (const invalid of [null, [], 42, 'line']) { const s = fresh(); s.markdown = invalid; assert.deepEqual(loaded(s).markdown, MARKDOWN_DEFAULTS); }
    const bad = Object.fromEntries(MARKDOWN_CONTROLS.map(({ key }) => [key, 'line bad;}body{display:none}']));
    assert.deepEqual(markdownClasses(bad), []);
    assert.deepEqual(tidyMarkdown(bad), MARKDOWN_DEFAULTS);
});
await check('numeric controls clamp imported extremes and recover invalid values before rendering', () => {
    for (const { key, min, max, default: fallback } of MARKDOWN_TUNING) {
        for (const [input, expected] of [[min - 10, min], [max + 10, max], [min, min], [max, max], [fallback, fallback], [null, fallback], [false, fallback], ['', fallback], ['10', fallback], [NaN, fallback], [Infinity, fallback], [-Infinity, fallback], ['1; color:red', fallback]]) {
            const s = fresh(); s.markdown[key] = input;
            assert.equal(loaded(s).markdown[key], expected, `${key}: ${String(input)}`);
        }
        const precise = min + (max - min) / 3;
        assert.equal(tidyMarkdown({ [key]: precise })[key], precise, `${key} does not silently round stored precision`);
    }
});
await check('custom accent rejects CSS payloads and is an explicit boolean opt-in', () => {
    for (const input of ['', '#abc', 'red', 'var(--secret)', '#123456;display:none', '</style><script>bad</script>', null, 123456]) {
        const s = fresh(); s.markdown.accentOwn = true; s.markdown.accentColor = input;
        assert.equal(loaded(s).markdown.accentColor, MARKDOWN_DEFAULTS.accentColor, String(input));
        assert(!Object.values(markdownVariables(s.markdown)).some(value => /[;{}<>]/.test(value)));
    }
    for (const input of [false, 'true', 1, null]) assert.equal(tidyMarkdown({ accentOwn: input }).accentOwn, false);
    const selected = tidyMarkdown({ accentOwn: true, accentColor: '#ABC123' });
    assert.equal(selected.accentColor.toLowerCase(), '#abc123');
    assert.equal(markdownVariables(selected)['--bl-md-accent'].toLowerCase(), '#abc123');
    selected.accentOwn = false;
    assert(!Object.hasOwn(markdownVariables(selected), '--bl-md-accent'));
    assert.equal(selected.accentColor.toLowerCase(), '#abc123', 'temporarily following the theme retains the chosen color');
});
await check('default tuning emits no style overrides and non-default values carry their CSS units', () => {
    assert.deepEqual(markdownVariables(MARKDOWN_DEFAULTS), {});
    assert.deepEqual(markdownVariables(undefined), {});
    const changed = { ...MARKDOWN_DEFAULTS, hrWidth: 63, hrSpace: 1.7, quotePadding: 0, strongAlpha: 0, underlineWidth: 2.25, accentOwn: true, accentColor: '#123456' };
    assert.deepEqual(markdownVariables(changed), {
        '--bl-md-hr-width': '63%', '--bl-md-hr-space': '1.7em', '--bl-md-quote-padding': '0em',
        '--bl-md-strong-alpha': '0%', '--bl-md-underline-width': '2.25px', '--bl-md-accent': '#123456',
    });
    for (const key of ['hrWidth','hrSpace','quotePadding','strongAlpha','underlineWidth']) assert(markdownClasses(changed).includes(`salty-md-tune-${key}`));
    assert(markdownClasses(changed).includes('salty-md-custom-accent'));
    assert.deepEqual(markdownClasses(tidyMarkdown({ hrWidth: Infinity, quotePadding: '0em', accentOwn: 'true' })), []);
});
await check('JSON save/reload keeps every selection and unrelated custom settings', () => {
    const s = loaded(decorated());
    s.colorOverrides = { 'salt': { accent: '#123456' } }; const expected = structuredClone(s.markdown);
    for (let i = 0; i < 5; i++) { const next = loaded(JSON.parse(JSON.stringify(getSettings()))); assert.deepEqual(next.markdown, expected); assert.equal(next.colorOverrides.salt.accent, '#123456'); }
});
await check('saved styles include Markdown and old partial styles preserve it', () => {
    const s = decorated(); s.markdown.hr = 'line'; s.markdown.heading = 'soft';
    const data = captureStyle(s); assert.deepEqual(data.markdown, s.markdown);
    const dest = fresh(); applyStyleData(dest, data); assert.deepEqual(dest.markdown, s.markdown);
    applyStyleData(dest, { type: { ...dest.type, size: 22 } }); assert.equal(dest.markdown.hr, 'line');
});
await check('text-only preset roundtrip includes Markdown and respects group selection', () => {
    const s = decorated(); s.markdown.hr = 'line'; const packet = readPreset(capturePreset(s, ['text']));
    for (const [key, value] of Object.entries(s.markdown)) assert.equal(packet.groups.text[`markdown.${key}`], value, key);
    const dest = fresh(); applyPreset(dest, packet, []); assert.equal(dest.markdown.hr, 'dots');
    applyPreset(dest, packet, ['text']); assert.deepEqual(dest.markdown, s.markdown);
});
await check('size/spacing locks preserve Markdown geometry during style application', () => {
    const s = fresh(); s.settingLocks.size = true; s.settingLocks.spacing = true; s.markdown.size = 'small'; s.markdown.space = 'compact';
    const incoming = fresh(); incoming.markdown.size = 'large'; incoming.markdown.space = 'relaxed'; incoming.markdown.hr = 'line';
    applyStyleData(s, captureStyle(incoming));
    assert.equal(s.markdown.size, 'small'); assert.equal(s.markdown.space, 'compact'); assert.equal(s.markdown.hr, 'line');
});
await check('spacing and color locks preserve fine tuning across both style and preset imports', () => {
    const protectedKeys = ['hrWidth','hrSpace','quotePadding','listIndent','tablePadding','underlineOffset','accentOwn','accentColor','quoteAlpha','strongAlpha'];
    for (const mode of ['style', 'preset']) {
        const s = decorated(), before = structuredClone(s.markdown), incoming = fresh();
        s.settingLocks.spacing = true; s.settingLocks.colors = true;
        if (mode === 'style') applyStyleData(s, captureStyle(incoming));
        else applyPreset(s, capturePreset(incoming, ['text']), ['text']);
        for (const key of protectedKeys) assert.equal(s.markdown[key], before[key], `${mode}: ${key}`);
        for (const key of ['heading','hr','strongStyle','underlineWidth','strongThick']) assert.equal(s.markdown[key], MARKDOWN_DEFAULTS[key], `${mode}: unlocked ${key}`);
    }
});
await check('device layouts separate geometry while appearance choices remain shared', () => {
    const s = fresh(); s.deviceLayouts.on = true; syncDeviceLayout(s, 'pc'); s.markdown.size = 'large'; s.markdown.space = 'relaxed'; s.markdown.hr = 'line'; saveDeviceLayout(s);
    syncDeviceLayout(s, 'mobile'); assert.equal(s.markdown.size, 'default'); s.markdown.size = 'small'; s.markdown.space = 'compact'; saveDeviceLayout(s);
    syncDeviceLayout(s, 'pc'); assert.equal(s.markdown.size, 'large'); assert.equal(s.markdown.space, 'relaxed'); assert.equal(s.markdown.hr, 'line');
});
await check('mobile fine spacing survives device switches without splitting decoration or colors', () => {
    const geometry = ['hrWidth','hrSpace','quotePadding','listIndent','tablePadding','underlineOffset'];
    const s = fresh(); s.deviceLayouts.on = true; syncDeviceLayout(s, 'pc');
    const pc = { hrWidth: 88, hrSpace: 1.6, quotePadding: 1.1, listIndent: 2, tablePadding: .65, underlineOffset: .3 };
    Object.assign(s.markdown, pc); saveDeviceLayout(s); syncDeviceLayout(s, 'mobile');
    for (const key of geometry) assert.equal(s.markdown[key], MARKDOWN_DEFAULTS[key], key);
    const mobile = { hrWidth: 65, hrSpace: .5, quotePadding: .2, listIndent: 1.1, tablePadding: .2, underlineOffset: .1 };
    const shared = { hr: 'star', strongThick: 65, underlineWidth: 3, quoteAlpha: 20, strongAlpha: 45, accentOwn: true, accentColor: '#123456' };
    Object.assign(s.markdown, mobile, shared); saveDeviceLayout(s);
    for (const [device, expected] of [['pc', pc], ['mobile', mobile], ['pc', pc]]) {
        syncDeviceLayout(s, device);
        for (const key of geometry) assert.equal(s.markdown[key], expected[key], `${device}: ${key}`);
        for (const [key, value] of Object.entries(shared)) assert.equal(s.markdown[key], value, `${device}: shared ${key}`);
    }
});
await check('saved device spacing restores on a fresh mobile or PC session', () => {
    const s = fresh(); s.deviceLayouts.on = true; syncDeviceLayout(s, 'pc');
    s.markdown.hrWidth = 92; s.markdown.quotePadding = 1.2; saveDeviceLayout(s);
    syncDeviceLayout(s, 'mobile'); s.markdown.hrWidth = 60; s.markdown.quotePadding = .25; s.markdown.accentOwn = true; s.markdown.accentColor = '#aabbcc'; saveDeviceLayout(s);
    const saved = JSON.stringify(s), previous = globalThis.matchMedia;
    try {
        for (const [mobile, width, padding] of [[true, 60, .25], [false, 92, 1.2]]) {
            globalThis.matchMedia = () => ({ matches: mobile });
            const restored = loaded(JSON.parse(saved));
            assert.equal(restored.markdown.hrWidth, width); assert.equal(restored.markdown.quotePadding, padding);
            assert.equal(restored.markdown.accentOwn, true); assert.equal(restored.markdown.accentColor, '#aabbcc');
        }
    } finally { if (previous === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = previous; }
});
await check('undo/redo and held comparison affect only the intended saved/rendered values', () => {
    const s = fresh(), h = new SettingsHistory(), token = {}; const snap = appearanceSnapshot(s);
    const next = decorated().markdown;
    h.run(s, value => { value.markdown = structuredClone(next); }); h.step(s); assert.deepEqual(s.markdown, MARKDOWN_DEFAULTS); h.step(s, true); assert.deepEqual(s.markdown, next);
    beginComparison(token, snap); assert.deepEqual(comparisonView(s).markdown, MARKDOWN_DEFAULTS); assert.deepEqual(s.markdown, next); endComparison(token); assert.deepEqual(comparisonView(s).markdown, next);
});
await check('changed-setting navigation and individual/theme reset cover new keys', () => {
    const s = loaded(decorated());
    for (const key of Object.keys(MARKDOWN_DEFAULTS)) {
        const path = `markdown.${key}`;
        if (s.markdown[key] !== MARKDOWN_DEFAULTS[key]) assert(changedSettings(s).some(item => item.path === path), path);
        assert.deepEqual(settingRoute(path), { tab: 'text', sub: 'markdown' });
        assert(resetSetting(s, path)); assert.equal(s.markdown[key], MARKDOWN_DEFAULTS[key], path);
    }
    s.markdown = decorated().markdown; resetSettings({ look: true }); assert.deepEqual(getSettings().markdown, MARKDOWN_DEFAULTS);
});
await check('search aliases and every control route to the dedicated Markdown page', () => {
    const entries = SEARCH_ENTRIES.filter(entry => entry.sub === 'markdown');
    for (const key of [...MARKDOWN_CONTROLS.map(item => item.key), ...MARKDOWN_TUNING.map(item => item.key), 'accentOwn', 'accentColor']) assert(entries.some(entry => entry.path === `markdown.${key}`), key);
    for (const text of ['마크다운', '구분선', '***', '* * *', '별표 세개', '인용문', '글머리', '줄무늬', '밑줄 물결']) assert(searchSettings(text).some(entry => entry.sub === 'markdown'), text);
    assert(entries.every(entry => entry.breadcrumb === '글자 › 마크다운' && entry.path.startsWith('markdown.')));
});
await check('preview reuses one stage and does not edit chat, code, or existing formatting controls', async () => {
    const source = await readFile(new URL('src/panel.js', root), 'utf8');
    const stage = source.slice(source.indexOf('function markdownStage()'), source.indexOf('// 그림 무대:'));
    for (const token of ['<h1>', '<h2>', '<h3>', '<h4>', '<h5>', '<h6>', '<hr>', '<blockquote>', '<ul>', '<ol start="3">', '<table>', '<details open>', '<mark>', '<u>', '<strong>', '<code>', '<a href=']) assert(stage.includes(token), token);
    assert(!stage.includes('SillyTavern')); assert(!stage.includes('getContext')); assert(source.includes("kind === 'markdown' ? markdownStage()"));
    assert(!MARKDOWN_CONTROLS.some(item => ['strong','em','strike','code','image','dialogue'].includes(item.key)));
});
await check('note ink derives local twenty-percent rule color and resets without touching note data', async () => {
    const source = await readFile(new URL('src/addons/notes/index.js', root), 'utf8');
    const paint = runInNewContext(`const HEX6=/^#[0-9a-f]{6}$/i; ${source.match(/function paintNote\(el, color, ink\) \{[\s\S]*?\n\}/)[0]}; paintNote`);
    const vars = new Map(), classes = new Set(); const el = { style: {setProperty:(k,v)=>vars.set(k,v), removeProperty:k=>vars.delete(k)}, classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}};
    paint(el, '#abcdef', '#123456'); assert.equal(vars.get('--salty-text-20'),'#12345633'); assert.equal(vars.get('--bl-note-ink'),'#123456'); assert(classes.has('has-ink'));
    paint(el, '#ffffff', undefined); assert.equal(vars.get('--salty-text-20'),'#12345633');
    paint(el, '', ''); assert(!vars.has('--salty-text-20')); assert(!vars.has('--bl-note-ink')); assert(!classes.has('has-ink'));
});
const output = { total: results.length, passed: results.filter(item => item.pass).length, pass: results.every(item => item.pass), results };
console.log(JSON.stringify(output, null, 2));
if (!output.pass) process.exitCode = 1;
