import assert from 'node:assert/strict';
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
