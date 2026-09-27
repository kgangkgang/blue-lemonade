import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
// Runs against an explicit theme root or this repository. Uses synthetic in-memory settings only.
const root = pathToFileURL(path.resolve(process.argv[2] || fileURLToPath(new URL('../..', import.meta.url))) + path.sep);
const loadModule = file => import(new URL('src/' + file, root));
const { MARKDOWN_CONTROLS, MARKDOWN_DEFAULTS, tidyMarkdown, markdownClasses } = await loadModule('markdown.js');
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
const results = [];
async function check(name, run) { try { await run(); results.push({ name, pass: true }); } catch (error) { results.push({ name, pass: false, error: error.stack }); } }
await check('old settings receive default choices without replacing custom appearance', () => {
    const old = fresh(); delete old.markdown; old.palette = 'lemon-night'; old.type.size = 23; old.type.letterSpacing = 12; old.fonts.text.ko = 'custom-font'; old.dialogue.style = 'plain'; old.image.radius = 31;
    const after = loaded(old);
    assert.deepEqual(after.markdown, MARKDOWN_DEFAULTS);
    for (const key of ['type', 'fonts', 'dialogue', 'image']) assert.deepEqual(after[key], old[key]);
    assert.deepEqual(markdownClasses(after.markdown), []);
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
await check('JSON save/reload keeps every selection and unrelated custom settings', () => {
    const s = loaded(fresh()); for (const { key, options } of MARKDOWN_CONTROLS) s.markdown[key] = options.at(-1)[0];
    s.colorOverrides = { 'salt': { accent: '#123456' } }; const expected = structuredClone(s.markdown);
    for (let i = 0; i < 5; i++) { const next = loaded(JSON.parse(JSON.stringify(getSettings()))); assert.deepEqual(next.markdown, expected); assert.equal(next.colorOverrides.salt.accent, '#123456'); }
});
await check('saved styles include Markdown and old partial styles preserve it', () => {
    const s = fresh(); s.markdown.hr = 'line'; s.markdown.heading = 'soft';
    const data = captureStyle(s); assert.deepEqual(data.markdown, s.markdown);
    const dest = fresh(); applyStyleData(dest, data); assert.deepEqual(dest.markdown, s.markdown);
    applyStyleData(dest, { type: { ...dest.type, size: 22 } }); assert.equal(dest.markdown.hr, 'line');
});
await check('text-only preset roundtrip includes Markdown and respects group selection', () => {
    const s = fresh(); s.markdown.hr = 'line'; const packet = readPreset(capturePreset(s, ['text']));
    assert.equal(packet.groups.text['markdown.hr'], 'line');
    const dest = fresh(); applyPreset(dest, packet, []); assert.equal(dest.markdown.hr, 'dots');
    applyPreset(dest, packet, ['text']); assert.equal(dest.markdown.hr, 'line');
});
await check('size/spacing locks preserve Markdown geometry during style application', () => {
    const s = fresh(); s.settingLocks.size = true; s.settingLocks.spacing = true; s.markdown.size = 'small'; s.markdown.space = 'compact';
    const incoming = fresh(); incoming.markdown.size = 'large'; incoming.markdown.space = 'relaxed'; incoming.markdown.hr = 'line';
    applyStyleData(s, captureStyle(incoming));
    assert.equal(s.markdown.size, 'small'); assert.equal(s.markdown.space, 'compact'); assert.equal(s.markdown.hr, 'line');
});
await check('device layouts separate geometry while appearance choices remain shared', () => {
    const s = fresh(); s.deviceLayouts.on = true; syncDeviceLayout(s, 'pc'); s.markdown.size = 'large'; s.markdown.space = 'relaxed'; s.markdown.hr = 'line'; saveDeviceLayout(s);
    syncDeviceLayout(s, 'mobile'); assert.equal(s.markdown.size, 'default'); s.markdown.size = 'small'; s.markdown.space = 'compact'; saveDeviceLayout(s);
    syncDeviceLayout(s, 'pc'); assert.equal(s.markdown.size, 'large'); assert.equal(s.markdown.space, 'relaxed'); assert.equal(s.markdown.hr, 'line');
});
await check('undo/redo and held comparison affect only the intended saved/rendered values', () => {
    const s = fresh(), h = new SettingsHistory(), token = {}; const snap = appearanceSnapshot(s);
    h.run(s, value => { value.markdown.hr = 'line'; }); h.step(s); assert.equal(s.markdown.hr, 'dots'); h.step(s, true); assert.equal(s.markdown.hr, 'line');
    beginComparison(token, snap); assert.equal(comparisonView(s).markdown.hr, 'dots'); assert.equal(s.markdown.hr, 'line'); endComparison(token); assert.equal(comparisonView(s).markdown.hr, 'line');
});
await check('changed-setting navigation and individual/theme reset cover new keys', () => {
    const s = loaded(fresh()); s.markdown.hr = 'line';
    assert(changedSettings(s).some(item => item.path === 'markdown.hr'));
    assert.deepEqual(settingRoute('markdown.hr'), { tab: 'text', sub: 'markdown' });
    assert(resetSetting(s, 'markdown.hr')); assert.equal(s.markdown.hr, 'dots'); s.markdown.quote = 'soft'; resetSettings({ look: true }); assert.deepEqual(getSettings().markdown, MARKDOWN_DEFAULTS);
});
await check('search aliases and every control route to the dedicated Markdown page', () => {
    assert.equal(SEARCH_ENTRIES.filter(entry => entry.sub === 'markdown').length, MARKDOWN_CONTROLS.length);
    for (const text of ['마크다운', '구분선', '***', '* * *', '별표 세개', '인용문', '글머리', '줄무늬', '밑줄 물결']) assert(searchSettings(text).some(entry => entry.sub === 'markdown'), text);
    assert(SEARCH_ENTRIES.filter(entry => entry.sub === 'markdown').every(entry => entry.breadcrumb === '글자 › 마크다운' && entry.path.startsWith('markdown.')));
});
await check('preview reuses one stage and does not edit chat, code, or existing formatting controls', async () => {
    const source = await readFile(new URL('src/panel.js', root), 'utf8');
    const stage = source.slice(source.indexOf('function markdownStage()'), source.indexOf('// 그림 무대:'));
    for (const token of ['<h1>', '<h2>', '<h3>', '<h4>', '<h5>', '<h6>', '<hr>', '<blockquote>', '<ul>', '<ol start="3">', '<table>', '<details open>', '<mark>', '<u>', '<a href=']) assert(stage.includes(token), token);
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
