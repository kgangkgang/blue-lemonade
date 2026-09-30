// Public host integration: optional activation, stored settings and duplicate ownership.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const rootPath = path.resolve(process.argv[2] || '.');
const root = pathToFileURL(rootPath + '/');
const { getSettings, DEFAULTS } = await import(new URL('src/settings.js', root));
const { addonMarkup } = await import(new URL('src/addons.js', root));
const { settingRoute } = await import(new URL('src/settings-differences.js', root));
const { knownConflicts, DUPLICATES } = await import(new URL('src/assist/core.js', root));

const storedTts = { enabled: true, voices: [{ id: 'example-custom-id', name: 'My voice' }],
    char_map: { Narrator: 'example-custom-id' }, highlight_style: 'underline', privateKey: 'fixture-only' };
const saved = { enabled: true, addons: {} };
globalThis.SillyTavern = { getContext: () => ({ extensionSettings: { salty: saved, lemon_voice: storedTts } }) };
const before = structuredClone(storedTts);
const settings = getSettings();
assert.equal(DEFAULTS.addons.tts, false);
assert.equal(DEFAULTS.addonUI.ttsDrawer, true);
assert.equal(settings.addons.tts, false);
assert.equal(settings.addonUI.ttsDrawer, true);
assert.deepEqual(storedTts, before);
assert.equal(settingRoute('addons.tts').sub, 'tts');
assert.equal(settingRoute('addonUI.ttsDrawer').sub, 'tts');
assert.match(addonMarkup(settings, 'tts'), /data-addon-toggle="tts"/);
assert.match(addonMarkup(settings, 'tts'), /TTS/);
assert.doesNotMatch(addonMarkup(settings, 'tts'), /undefined/);
assert.match(addonMarkup(settings, 'tts'), /data-tts-drawer checked/);
settings.addonUI.ttsDrawer = false;
assert.equal(getSettings().addonUI.ttsDrawer, false);
assert.match(addonMarkup(settings, 'tts'), /확장 탭에 TTS 설정 표시/);
assert.doesNotMatch(addonMarkup(settings, 'tts'), /data-tts-drawer checked/);
settings.addons.tts = true;
assert.equal(getSettings().addons.tts, true);
assert.deepEqual(storedTts, before);
for (const folder of DUPLICATES.tts) {
    const key = `third-party/${folder}`;
    assert.equal(knownConflicts([key], [], { tts: true }).length, 1);
    assert.equal(knownConflicts([key], [key], { tts: true }).length, 0);
    assert.equal(knownConflicts([key], [], { tts: false }).length, 0);
}
assert.equal(knownConflicts(['tts'], [], { tts: true }).length, 0,
    'SillyTavern built-in tts must not be misidentified as third-party/tts');
for (const name of ['src/panel.js', 'src/settings-search.js']) {
    assert.match(fs.readFileSync(path.join(rootPath, name), 'utf8'), /['"]tts['"]|tts:/);
}
console.log('PASS TTS host activation, existing settings, routes and third-party duplicate ownership');
