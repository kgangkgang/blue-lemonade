// Exercise the real ESM entry and outer addon catch; host modules are synthetic.
// node tools/tests/perf-start.mjs [theme root]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';

const root = path.resolve(process.argv[2] || '.');
const scenario = process.argv[3];
const cases = ['normal', 'off', 'legacy', 'old-settings', 'tool-delayed', 'tool-timer', 'tool-perf', 'tool-watchdog', 'tool-dedupe', 'tool-log', 'broken-note', 'hub-cycle', 'hub-export', 'settings', 'host-shape', 'module-fetch'];
if (!scenario) {
    let failed = 0;
    for (const name of cases) {
        const result = spawnSync(process.execPath, [import.meta.filename, root, name], { encoding: 'utf8' });
        if (result.status !== 0) { failed++; console.log(`FAIL ${name}\n${result.stderr}`); }
        else console.log(`PASS ${name}`);
    }
    console.log(`perf-start: ${cases.length - failed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
} else {
    const src = pathToFileURL(path.join(root, 'src/')).href;
    const js = code => `data:text/javascript,${encodeURIComponent(code)}`;
    const T = globalThis.__perfStartTest = { loaded: [], off: [], legacy: [], broken: [], errors: [], settings: { enabled: true, usageMode: 'extensions', addons: { perf: true }, addonUI: { perfLoad: {} } } };
    const G = 'const T=globalThis.__perfStartTest;\n';
    const tools = { loadtimer: 'timer', perfassist: 'perf', 'watchdog-main': 'watchdog', savededupe: 'dedupe', requestlog: 'log' };
    if (scenario === 'off') T.settings.addonUI.perfLoad = Object.fromEntries(Object.values(tools).map(id => [id, false]));
    const stubs = {
        'settings.js': G + `export function getSettings(){${scenario === 'settings' ? 'throw Error("synthetic private detail");' : 'return T.settings;'}} export function saveSettings(){}`,
        'addon-layout.js': 'export function toolSection(){}',
        'settings-dialog.js': 'export function leaveSettingsDialog(){}',
        'addons/notes/version.js': 'export const NOTES_VERSION="1.0.0";',
        'addons/tts/version.js': 'export const TTS_VERSION="1.0.0";',
        'addons/tts/credits.js': 'export function ttsCreditsSummaryHtml(){}',
        'addon-save.js': 'export async function restorePendingAddons(){return false;} export async function saveAddonsNow(){}',
        'assist/core.js': 'export const IDS=[],LABELS={},DUPLICATES={};',
        'addons/perf/hub.js': G + (scenario === 'hub-cycle' ? `import {failures} from ${JSON.stringify(src + 'addons/perf/start.js')}; T.cycleRead=failures.length;\n` : '') + (scenario === 'hub-export' ? `import {missing} from ${JSON.stringify(js('export const other=1;'))};\n` : '') + `export function markOff(id){T.off.push(id);} export function markLegacy(id){T.legacy.push(id);} export function markBroken(id,error){T.broken.push(id);}`,
    };
    if (scenario === 'old-settings') {
        delete stubs['settings.js'];
        globalThis.SillyTavern = { getContext: () => ({ extensionSettings: { salty: { usageMode: 'extensions', addonUI: { perfLoad: null } } } }) };
    }
    if (scenario === 'broken-note') stubs['addons/perf/hub.js'] = stubs['addons/perf/hub.js'].replace('T.broken.push(id);', 'T.broken.push(id); throw Error("synthetic renderer detail");');
    const host = js(`export const extensionNames=${scenario === 'host-shape' ? 'undefined' : scenario === 'legacy' ? '["third-party/load-timer"]' : '[]'}; export const extension_settings={disabledExtensions:[]};`);
    register(js(`import fs from 'node:fs';
let root,stubs,host,tools,scenario;
export function initialize(d){({root,stubs,host,tools,scenario}=d);}
export async function resolve(spec,ctx,next){
    if(spec.endsWith('/extensions.js')&&ctx.parentURL?.startsWith(root))return {url:host,shortCircuit:true};
    return next(spec,ctx);
}
export async function load(url,ctx,next){
    if(url.startsWith(root)){
        const rel=url.slice(root.length);
        if(stubs[rel])return {format:'module',source:stubs[rel],shortCircuit:true};
        if(rel==='addons/perf/start.js'&&scenario==='module-fetch')throw TypeError('Failed to fetch dynamically imported module: synthetic-private-detail');
        const name=rel.match(/^addons\\/perf\\/([^/]+)\\.js$/)?.[1];
        if(tools[name])return {format:'module',source:'const T=globalThis.__perfStartTest;'+(scenario==='tool-delayed'&&name==='loadtimer'?'await new Promise(resolve=>T.release=resolve);':'')+(scenario==='tool-'+tools[name]||(scenario==='broken-note'&&name==='loadtimer')?'throw TypeError("synthetic private detail");':'T.loaded.push('+JSON.stringify(tools[name])+');'),shortCircuit:true};
        if(rel==='addons.js')return {format:'module',source:fs.readFileSync(new URL(url),'utf8')+'\\nexport {startOne as testStart,running as testRunning,failed as testFailed};',shortCircuit:true};
    }
    return next(url,ctx);
}`), { data: { root: src, stubs, host, tools, scenario } });
    globalThis.window = { dispatchEvent() {} };
    console.error = (...args) => T.errors.push(args);
    const addon = await import(src + 'addons.js');
    const starting = addon.testStart('perf');
    if (scenario === 'tool-delayed') {
        const deadline = Date.now() + 5000;
        while (!T.release && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
        assert.equal(typeof T.release, 'function');
        assert.equal(addon.testRunning.has('perf'), false, 'running must wait for the tool import');
        T.release();
    }
    await starting;
    const failure = addon.testFailed.get('perf');
    if (['normal', 'off', 'legacy', 'hub-cycle', 'old-settings', 'tool-delayed'].includes(scenario)) {
        assert.equal(addon.testRunning.has('perf'), true, 'the addon must finish starting');
        assert.equal(failure, undefined);
        assert.deepEqual(T.loaded, scenario === 'off' ? [] : scenario === 'legacy' ? ['perf', 'watchdog', 'dedupe', 'log'] : Object.values(tools));
        if (scenario === 'off') assert.deepEqual(T.off, Object.values(tools));
        if (scenario === 'legacy') assert.deepEqual(T.legacy, ['timer']);
        if (scenario === 'hub-cycle') assert.equal(T.cycleRead, 0);
    } else if (scenario.startsWith('tool-') || scenario === 'broken-note') {
        const id = scenario === 'broken-note' ? 'timer' : scenario.slice(5);
        assert.equal(addon.testRunning.has('perf'), true, 'one broken tool must not stop its siblings');
        assert.match(failure, /일부 도구/);
        assert.deepEqual(T.broken, [id]);
        assert.deepEqual(T.loaded, Object.values(tools).filter(value => value !== id));
    } else {
        assert.equal(addon.testRunning.has('perf'), false);
        assert.match(failure, /PERF-/);
        const phase = { 'hub-export': 'HUB', settings: 'SETTINGS', 'host-shape': 'HOST', 'module-fetch': 'ENTRY' }[scenario];
        assert.ok(failure.includes('PERF-' + phase), 'report the failed startup stage');
        assert.ok(!failure.includes('synthetic'), 'never display arbitrary exception details');
    }
    if (fs.existsSync(path.join(root, 'src/addons/perf/start-error.js'))) {
        const diagnostics = await import(src + 'addons/perf/start-error.js');
        assert.ok(!diagnostics.perfErrorText({ perfPhase: 'HUB', perfKind: 'INIT', message: 'synthetic private detail' }).includes('synthetic'));
    }
}
