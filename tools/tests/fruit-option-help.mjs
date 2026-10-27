import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const {optionFamily,optionEffect}=await import(pathToFileURL(path.join(root,'src/scripts/fruit-option-help.js')));
const {FRUIT_OPTION_EFFECTS,FRUIT_OPTION_BASELINES}=await import(pathToFileURL(path.join(root,'src/scripts/fruit-option-effects.js')));
assert.equal(optionFamily({id:'a',name:'👁️ 示例｜人称单选 #MODEL @Author'}),'人称');
assert.equal(optionFamily({id:'b',name:'⌨️ 示例'}),'文风');
assert.equal(optionFamily({id:'c',name:'Custom'},{c:'Custom group'}),'Custom group');
assert.equal((await optionEffect('')).verified,true);
assert.equal((await optionEffect('Unreviewed synthetic prompt')).verified,false);
assert.equal((await optionEffect('Changed body',{})).verified,false);
const hash=Object.keys(FRUIT_OPTION_EFFECTS)[0];
const fake={subtle:{digest:async()=>Uint8Array.from(hash.match(/../g),x=>parseInt(x,16))}};
assert.equal((await optionEffect('Synthetic body',fake)).text,FRUIT_OPTION_EFFECTS[hash]);
assert(Object.keys(FRUIT_OPTION_EFFECTS).length>=300);
assert(Object.keys(FRUIT_OPTION_BASELINES).length>=316);
const {localPromptHash}=await import(pathToFileURL(path.join(root,'src/scripts/prompt-fingerprint.js')));
for(const text of ['', 'abc', '한글 日本語 😀', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'test'.repeat(20000)])assert.equal(localPromptHash(text),createHash('sha256').update(text).digest('hex'));
const id=Object.keys(FRUIT_OPTION_BASELINES)[0];
assert.equal((await optionEffect('Changed custom body',{},id)).baseline,true);
assert.equal((await optionEffect('Changed custom body',{},id)).text,FRUIT_OPTION_BASELINES[id]);
assert((await optionEffect('',{},'chatHistory')).text.includes('대화 기록'));

// Exercise the actual QR visibility function with only an inert DOM facade.
const layout=fs.readFileSync(path.join(root,'src/layout.js'),'utf8');
const a=layout.indexOf('    function syncQrFind('),b=layout.indexOf('\n    }',a)+6;
assert(a>=0&&b>a);
let existing=null,closed=0,buttons=true;
const context={globalThis:{quickReplyApi:{settings:{isEnabled:false}}},qrFinderModule:{closeQrFind(){closed++;}},
 document:{body:{classList:{contains:()=>false}},createElement(){return {setAttribute(){},addEventListener(){},remove(){existing=null;}};}}};
// 6.6.7 hidden native Fruit buttons ([data-bl-fruit-native-entry]) do not count as QR buttons.
let hiddenFruitOnly=false;
const bar={querySelector:s=>s.includes('bl-qr-find')?existing:s==='.qr--button:not([data-bl-fruit-native-entry])'&&buttons&&!hiddenFruitOnly?{}:null,prepend(el){existing=el;},querySelectorAll(){return[];}};
vm.createContext(context);vm.runInContext(layout.slice(a,b)+';this.sync=syncQrFind;',context);
context.sync(bar,true);assert.equal(existing,null,'helper buttons do not enable search when native QR is OFF');
context.globalThis.quickReplyApi.settings.isEnabled=true;context.sync(bar,true);assert(existing,'native QR ON permits search');
hiddenFruitOnly=true;context.sync(bar,true);assert.equal(existing,null,'only the hidden native Fruit button does not show search');hiddenFruitOnly=false;context.sync(bar,true);assert(existing,'visible QR buttons show search again');
context.globalThis.quickReplyApi.settings.isEnabled=false;context.sync(bar,true);assert.equal(existing,null);assert(closed>=2);
context.globalThis.quickReplyApi.settings.isEnabled=true;context.document.body.classList.contains=()=>true;context.sync(bar,true);assert.equal(existing,null,'theme search OFF remains respected');
context.document.body.classList.contains=()=>false;buttons=false;context.sync(bar,true);assert.equal(existing,null);
const help=fs.readFileSync(path.join(root,'src/scripts/fruit-option-help.js'),'utf8');
assert(!/fetch\(|updatePreset|saveSettings|triggerSlash|executeSlash/.test(help));
assert(help.includes("['pointercancel',cancel]")&&help.includes("['scroll',cancel]")&&help.includes('e.isPrimary===false'));
console.log('Fruit option help: exact-content descriptions, unknown/changed fallback, group matching, QR visibility gates and read-only wiring passed');
