import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=pathToFileURL(path.resolve(process.argv[2]||'.')+'/');
const {themeEnabled,addonsEnabled}=await import(new URL('src/usage-mode.js',root));
const {DEFAULTS}=await import(new URL('src/settings.js',root));
const s=structuredClone(DEFAULTS);s.addons.translator=true;s.palette='night';
const preserved=JSON.stringify({...s,usageMode:null});
for(const [mode,theme,addons] of [['both',true,true],['theme',true,false],['extensions',false,true],['both',true,true]]){
 s.usageMode=mode;assert.equal(themeEnabled(s),theme);assert.equal(addonsEnabled(s),addons);
 assert.equal(JSON.stringify({...s,usageMode:null}),preserved);
}
s.enabled=false;assert.equal(themeEnabled(s),false);assert.equal(addonsEnabled(s),false);
delete s.usageMode;s.enabled=true;assert.equal(themeEnabled(s),true);assert.equal(addonsEnabled(s),true);
console.log('PASS modes, round-trip preferences, master disable and legacy default');

const { checkboxTokens } = await import(new URL('src/usage-mode.js', root));
const palette = Object.fromEntries(['line','control','surface','text','muted','accent','on-accent','bg'].map(k=>['--salty-'+k,'existing-'+k]));
assert.deepEqual(checkboxTokens(palette, false), {});
assert.deepEqual(checkboxTokens(palette, true), {
    '--bl-checkbox-line':'existing-line','--bl-checkbox-accent':'existing-accent','--bl-checkbox-ink':'existing-on-accent',
});   // 7.7.9 A3: 선 · 포인트 면 · 꺽쇠 세 색만
console.log('PASS owned checkbox tokens reuse the palette and stay absent when disabled');

const checkboxCss = fs.readFileSync(new URL('css/92-checkboxes.css', root), 'utf8');
const usedTokens = [...new Set([...checkboxCss.matchAll(/var\((--bl-checkbox-[a-z-]+)/g)].map(m => m[1]))].sort();
assert.deepEqual(usedTokens, Object.keys(checkboxTokens(palette, true)).sort(), 'every standalone checkbox color has a value');
assert.doesNotMatch(checkboxCss, /var\(--salty-[a-z-]+\)/, 'theme colors need an owned-control fallback');
console.log('PASS standalone checkbox CSS has complete color fallbacks');

// 8.2.1 settings import: a file whose usageMode differs saves and reloads like the dedicated control (stale half-applied mode otherwise)
const panelSrc = fs.readFileSync(new URL('src/panel.js', root), 'utf8');
const importBlock = panelSrc.slice(panelSrc.indexOf('input[data-file="settings"]\') && target.files'), panelSrc.indexOf("toastr.success('\uC124\uC815\uC744 \uAC00\uC838\uC654\uC5B4\uC694'"));
assert.match(importBlock, /const modeChanged = modeBefore !== usageMode\(ext\.salty\)/, 'import compares the usage mode before and after');
// 1.5.8 까지: 되돌리기 기록(history.run)이 backup 객체에 새 값을 부은 뒤에 옛 방식을 읽어 늘 「안 바뀜」이었어요 — 옛 방식은 그 앞에서 읽어요
{
    const readAt = importBlock.indexOf('const modeBefore = usageMode(backup || {})');
    assert.ok(readAt > 0 && readAt < importBlock.indexOf('history.run(backup'), 'the old mode is read before history.run rewrites the backup object');
    const { SettingsHistory } = await import(new URL('src/settings-history.js', root));
    const { usageMode } = await import(new URL('src/usage-mode.js', root));
    const ext = { salty: { usageMode: 'both', a: 1 } };
    const backup = ext.salty, before = usageMode(backup);
    ext.salty = structuredClone({ usageMode: 'extensions', a: 2 });
    new SettingsHistory().run(backup, st => { for (const key of Object.keys(st)) delete st[key]; Object.assign(st, ext.salty); ext.salty = st; });
    assert.equal(backup, ext.salty, 'history.run leaves backup and ext.salty as one object (comparing them afterwards is always equal)');
    assert.notEqual(before, usageMode(ext.salty), 'the mode captured before the run differs');
}
assert.match(importBlock, /if \(modeChanged\) \{[^}]*await saveAddonsNow\(\); location\.reload\(\); return; \}/, 'a changed mode saves then reloads');
assert.match(importBlock, /usageMode\(ext\.salty\) === 'extensions' && restoreState\(\)\) \{ try \{ await offerRestore\(\)/, 'switching to extensions-only offers the SillyTavern restore first');
console.log('PASS settings import reloads when the usage mode changes');
