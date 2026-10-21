import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const s=fs.readFileSync(path.resolve(process.argv[2]||'.','src/addons/models/panel.js'),'utf8'),code=s.slice(s.indexOf('async function onAdd()'),s.indexOf('async function onListClick('));
function rig(){let resolve;const pending=new Promise(r=>resolve=r),input={value:'First'},saved=[],store={vertexai:[],custom:[]},context={currentId:'vertexai',$:()=>input,modelsOf:id=>store[id],builtInLists:()=>pending,toast(){},save:(id,list)=>{store[id]=list;saved.push([id,list])}};vm.runInNewContext(code+'\nglobalThis.run=onAdd;',context);return{input,saved,store,context,resolve,run:context.run}}
let passed=0;async function test(name,f){await f();passed++;console.log('ok',name)}
await test('editing while a native-list check is pending preserves the new draft',async()=>{const t=rig(),task=t.run();t.input.value='Next draft';t.resolve({});await task;assert.equal(t.input.value,'Next draft');assert.equal(t.saved[0][0],'vertexai');assert.equal(t.saved[0][1][0],'First')});
await test('switching providers preserves even an identical new-provider draft',async()=>{const t=rig(),task=t.run();t.context.currentId='custom';t.resolve({});await task;assert.equal(t.input.value,'First');assert.equal(t.store.custom.length,0);assert.equal(t.store.vertexai[0],'First')});
await test('unchanged submitted text clears after successful registration',async()=>{const t=rig(),task=t.run();t.resolve(null);await task;assert.equal(t.input.value,'');assert.equal(t.saved.length,1)});
await test('duplicate overlapping adds write once and preserve newer input',async()=>{const t=rig(),a=t.run(),b=t.run();t.input.value='Keep this';t.resolve({});await Promise.all([a,b]);assert.equal(t.saved.length,1);assert.equal(t.input.value,'Keep this')});
console.log(`models add race: ${passed} passed`);
