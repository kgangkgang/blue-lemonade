import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]||fileURLToPath(new URL('../..',import.meta.url)));
const source=fs.readFileSync(path.join(root,'src/panel.js'),'utf8');
const start=source.indexOf('const FOCUS_VOLATILE =');
const end=source.indexOf('\nfunction render(root)',start);
assert.ok(start>=0&&end>start);
const document={body:{},activeElement:null};
const context={document,CSS:{escape:String}};
vm.runInNewContext(source.slice(start,end)+'\nglobalThis.api={focusSnapshot,restoreFocus,restorePanelScroll};',context);
const {focusSnapshot,restoreFocus,restorePanelScroll}=context.api;
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('ok',name)};
check('navigation focus does not read a layout-dependent scroll position',()=>{
 const button={tagName:'BUTTON',dataset:{act:'editor-route',tab:'theme',sub:'palette'},getAttribute:()=>null,get scrollLeft(){throw Error('unexpected layout read')}};
 document.activeElement=button;const panel={contains:e=>e===button,querySelectorAll:()=>[button]};
 const snap=focusSnapshot(panel);assert.equal(snap.scrollLeft,0);assert.equal(snap.caret,null);assert.match(snap.selector,/data-sub="palette"/);
});
check('text editor caret, selection direction and horizontal offset survive rerender',()=>{
 const input={tagName:'INPUT',dataset:{promptName:'deus'},selectionStart:3,selectionEnd:8,selectionDirection:'backward',scrollLeft:27,getAttribute:()=>null};
 document.activeElement=input;const panel={contains:()=>true,querySelectorAll:()=>[input]};const snap=focusSnapshot(panel);
 assert.deepEqual(Array.from(snap.caret),[3,8,'backward']);assert.equal(snap.scrollLeft,27);
 const next={disabled:false,closest:()=>null,focus:o=>{assert.equal(o.preventScroll,true);document.activeElement=next},setSelectionRange:(...v)=>{next.selection=v},scrollLeft:0};
 document.activeElement=document.body;panel.querySelectorAll=()=>[next];restoreFocus(panel,snap);
 assert.equal(document.activeElement,next);assert.deepEqual(next.selection,[3,8,'backward']);assert.equal(next.scrollLeft,27);
});
check('fresh sections do not perform any scroll assignment or layout query',()=>{
 const panel={_editorRoute:'theme/palette',_editorScroll:new Map(),_addonScroll:new Map(),querySelector(){throw Error('fresh section should not query scrolling nodes')}};
 restorePanelScroll(panel);
});
check('nonzero section and embedded addon scroll positions are restored',()=>{
 const writes=[];const node=name=>({set scrollTop(value){writes.push([name,value])}});
 const nodes={'.salty-sec':node('section'),'.bl-addon-main':node('main'),'.bl-addon-config':node('config')};
 const panel={_editorRoute:'extensions/tools',_editorScroll:new Map([['extensions/tools',175]]),_addonScroll:new Map([['extensions/tools',[240,90]]]),querySelector:s=>nodes[s]};
 restorePanelScroll(panel);assert.deepEqual(writes,[['section',175],['main',240],['config',90]]);
});
check('missing embedded panes and zero offsets do not throw or trigger writes',()=>{
 const queries=[];const panel={_editorRoute:'extensions/tools',_editorScroll:new Map(),_addonScroll:new Map([['extensions/tools',[0,50]]]),querySelector:s=>{queries.push(s);return null}};
 restorePanelScroll(panel);assert.deepEqual(queries,['.bl-addon-config']);
});
console.log(`settings render layout: ${passed} passed`);
