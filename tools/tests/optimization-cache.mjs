import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
// Host imports are stubbed; execute the actual bookmark module against DOM colors.
const source=fs.readFileSync('src/addons/bookmarks/state.js','utf8').replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'');
let vars='x'.repeat(200)+'--salty-accent:#112233;', accent='#112233', reads=0;
const context=vm.createContext({document:{body:{classList:{contains:n=>n==='salty'}},documentElement:{},getElementById:()=>({textContent:vars})},getComputedStyle:()=>{reads++;return {getPropertyValue:()=>accent};}});
vm.runInContext(source+'\nthis.colors=themeColors;',context);
assert.equal(context.colors().accent,'#112233');assert.equal(context.colors().accent,'#112233');assert.equal(reads,1);
vars=vars.replace('#112233','#445566');accent='#445566';assert.equal(context.colors().accent,'#445566');assert.equal(reads,2);
context.colors().accent='#ffffff';assert.equal(context.colors().accent,'#445566');
vars+=' ';accent='';assert.equal(context.colors(),null);accent='#778899';assert.equal(context.colors().accent,'#778899');
// A corrupt persisted cache must fall back to probing, not reject font loading.
globalThis.localStorage={getItem:()=> 'null',setItem(){}};
globalThis.document={fonts:{add(){},delete(){}},createElement:()=>({getContext:()=>null})};
globalThis.FontFace=class {async load(){return this;}};
const {blankScripts}=await import('../../src/fonts.js');
assert.deepEqual(await blankScripts({id:'cache-null-test',file:'https://example.invalid/font.woff2'}),[]);
console.log('PASS same-length palette edits, cache reuse, late colors and corrupt font cache');
