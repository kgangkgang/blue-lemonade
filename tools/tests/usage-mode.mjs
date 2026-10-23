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
