import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const source=fs.readFileSync(path.join(root,'src/prompt-tools.js'),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ')
  .replace("import('./scripts/runtime.js')",'runtimeReady');
const cleanName=value=>typeof value==='string'?Array.from(value.replace(/\s+/g,' ').trim()).slice(0,40).join('').trim():'';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function environment({kind='fruit',pendingRuntime=false}={}){
  const state={enabled:{'fruit-style':false,'fruit':true,'deus-qr':true},overrides:{fruit:{code:'custom code'}}};
  const settings={addons:true,theme:true},calls=[],subscribers=new Set(),runtimeGate=deferred(),saveGate=deferred();
  let save=()=>Promise.resolve(),conflict=false;
  const inputs=['fruit-style','fruit-heart','fruit','deus-qr','deus'].map(id=>({dataset:{promptScript:id},checked:state.enabled[id]===true,disabled:false}));
  const button={dataset:{promptOpen:kind},disabled:false,closest:()=>button};
  const status={textContent:''},events=new Map();
  const choice={value:'yes',disabled:false,hasAttribute:s=>s==='data-prompt-deus-icon'};
  const box={dataset:{promptTools:kind},isConnected:true,querySelector:s=>s==='[data-prompt-open]'?button:s==='[data-prompt-deus-icon]'?choice:status,querySelectorAll:()=>inputs,addEventListener:(type,fn)=>events.set(type,fn),removeEventListener:(type,fn)=>{if(events.get(type)===fn)events.delete(type)}};
  const nodes=new Map();
  const runtime={subscribeScripts:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn)},syncScripts:async()=>{calls.push('sync')},scriptStatus:()=> '사용 중'};
  const context={scriptSettings:()=>state,persistScripts:()=>{calls.push('save');return save()},legacyConflicts:()=>conflict?[{}]:[],addonsEnabled:s=>s.addons,themeEnabled:s=>s.theme,getSettings:()=>settings,leaveSettingsDialog:()=>calls.push('leave'),promptLinkMarkup:()=>'',fruitTypographyMarkup:()=>'',bindFruitTypography:()=>()=>{},document:{getElementById:id=>nodes.get(id)},runtimeReady:pendingRuntime?runtimeGate.promise:Promise.resolve(runtime),cleanName};
  vm.runInNewContext(source+'\nglobalThis.api={bindPromptTools,promptToolsMarkup,fruitPromptMarkup};',context);
  const cleanup=context.api.bindPromptTools({querySelector:()=>box});
  return{state,settings,calls,inputs,button,status,choice,box,events,nodes,context,runtime,subscribers,cleanup,saveGate,runtimeGate,
    gateSave(){save=()=>saveGate.promise},failSave(){save=()=>Promise.reject(Error('save failed'))},setConflict(){conflict=true},
    change(id,value){const input=inputs.find(x=>x.dataset.promptScript===id);input.checked=value;return events.get('change')?.({target:input})},open:()=>events.get('click')?.({target:button})};
}
let passed=0;
async function check(label,fn){await fn();console.log('ok',label);passed++}
await check('saving disables controls and preserves unrelated switches and custom code',async()=>{
  const e=environment();e.gateSave();const task=e.change('fruit-style',true);
  assert.ok(e.inputs.every(input=>input.disabled));assert.equal(e.button.disabled,true);
  assert.equal(e.state.enabled.fruit,true);assert.equal(e.state.overrides.fruit.code,'custom code');
  e.saveGate.resolve();await task;assert.equal(e.state.enabled['fruit-style'],true);assert.equal(e.button.disabled,false);assert.deepEqual(e.calls,['save','sync']);e.cleanup();
});
await check('a failed save rolls back only the affected switch',async()=>{
  const e=environment();e.gateSave();const task=e.change('fruit-style',true);e.state.enabled.fruit=false;e.state.overrides.fruit.code='edited elsewhere';e.saveGate.reject(Error('offline'));await task;
  assert.equal(e.state.enabled['fruit-style'],false);assert.equal(e.state.enabled.fruit,false);assert.equal(e.state.overrides.fruit.code,'edited elsewhere');assert.equal(e.status.textContent,'offline');e.cleanup();
});
await check('disabled addon mode and existing Helper copies cannot save or start tools',async()=>{
  const e=environment();e.settings.addons=false;await e.change('fruit-style',true);assert.deepEqual(e.calls,[]);assert.equal(e.state.enabled['fruit-style'],false);
  e.settings.addons=true;e.setConflict();await e.change('fruit-style',true);assert.deepEqual(e.calls,[]);assert.match(e.status.textContent,/헬퍼/);e.cleanup();
});
await check('unknown switch events never alter persisted settings',async()=>{
  const e=environment();await e.events.get('change')({target:{dataset:{promptScript:'unknown'},checked:true}});assert.deepEqual(e.calls,[]);assert.equal(e.state.enabled.unknown,undefined);e.cleanup();
});
await check('closing before a lazy import resolves cannot subscribe a detached panel',async()=>{
  const e=environment({pendingRuntime:true});e.cleanup();e.box.isConnected=false;e.runtimeGate.resolve(e.runtime);await Promise.resolve();await Promise.resolve();assert.equal(e.subscribers.size,0);assert.equal(e.events.size,0);
});
await check('closing during a save still finishes the save without touching detached UI',async()=>{
  const e=environment();e.gateSave();const task=e.change('fruit-style',true);await new Promise(setImmediate);assert.ok(e.calls.includes('save'));e.cleanup();e.box.isConnected=false;const before=e.status.textContent;e.saveGate.resolve();await task;
  assert.equal(e.status.textContent,before);assert.equal(e.state.enabled['fruit-style'],true);assert.equal(e.subscribers.size,0);
});
await check('Fruit opens through its API after leaving the native settings dialog',async()=>{
  const e=environment();e.context.__FRUIT_HEART_MAIN__={open:()=>e.calls.push('fruit-open')};await e.open();assert.deepEqual(e.calls,['leave','fruit-open']);e.cleanup();
});
await check('already open Fruit retains its selected tab and scroll position',async()=>{
  const e=environment();e.context.__FRUIT_HEART_MAIN__={open:()=>e.calls.push('fruit-reset')};e.nodes.set('fruit-heart-v6',{classList:{contains:()=>true}});await e.open();assert.deepEqual(e.calls,['leave']);e.cleanup();
});
await check('older Fruit can use its original entry, while an absent script keeps settings open',async()=>{
  const e=environment();await e.open();assert.deepEqual(e.calls,[]);assert.match(e.status.textContent,/스크립트를 켜/);e.nodes.set('fruit-heart-v6-wand-entry',{click:()=>e.calls.push('entry')});await e.open();assert.deepEqual(e.calls,['leave','entry']);e.cleanup();
});
await check('Deus waits for its runtime and leaves the native dialog before opening',async()=>{
  const e=environment({kind:'deus',pendingRuntime:true});e.context.__blueLemonadeDeusQuick_v1={open:async()=>e.calls.push('deus-open')};const task=e.open();assert.deepEqual(e.calls,[]);e.runtimeGate.resolve(e.runtime);await task;assert.deepEqual(e.calls,['leave','deus-open']);e.cleanup();
});
await check('a pending open is cancelled when its settings panel closes',async()=>{
  const e=environment({kind:'deus',pendingRuntime:true});e.context.__blueLemonadeDeusQuick_v1={open:()=>e.calls.push('deus-open')};const task=e.open();e.cleanup();e.box.isConnected=false;e.runtimeGate.resolve(e.runtime);await task;assert.deepEqual(e.calls,[]);
});
await check('a runtime import failure cannot leave a saved switch different from memory',async()=>{
  const e=environment({pendingRuntime:true});const task=e.change('fruit-style',true);e.runtimeGate.reject(Error('runtime unavailable'));await task;assert.deepEqual(e.calls,[]);assert.equal(e.state.enabled['fruit-style'],false);e.cleanup();
});
await check('a failure after verified saving preserves the saved switch',async()=>{
  const e=environment();e.runtime.syncScripts=async()=>{throw Error('runtime unavailable')};await e.change('fruit-style',true);assert.deepEqual(e.calls,['save']);assert.equal(e.state.enabled['fruit-style'],true);assert.match(e.status.textContent,/runtime unavailable/);e.cleanup();
});
await check('source display distinguishes the distribution link and code without asserting different authors',async()=>{
  const e=environment();const html=e.context.api.fruitPromptMarkup();assert.ok(html.includes('https://discord.com/channels/1384945301780955246/1395707630302789653/1554887154583212064'));assert.ok(html.includes('https://github.com/kongkongmie/guoshizhixin'));assert.ok(html.includes('과일 원문 보기'));assert.ok(html.includes('>코드 ↗'));e.cleanup();
});
await check('the Deus entry name row renders beside its switch and hides while the quick settings are off',async()=>{
  const e=environment({kind:'deus'});let html=e.context.api.promptToolsMarkup('deus');assert.ok(html.includes('data-prompt-name="deus"'));assert.ok(!html.includes('data-prompt-name-row="deus" hidden'));
  e.state.enabled['deus-qr']=false;html=e.context.api.promptToolsMarkup('deus');assert.ok(html.includes('data-prompt-name-row="deus" hidden'));e.state.names={deus:'<b>&"x"'};html=e.context.api.promptToolsMarkup('deus');assert.ok(html.includes('value="&lt;b&gt;&amp;&quot;x&quot;"'));e.cleanup();
});
await check('a committed name is cleaned, saved through the verified script store and pushed to the running entry',async()=>{
  const e=environment({kind:'deus'});e.context.__blueLemonadeDeusQuick_v1={refreshName:()=>e.calls.push('name')};const input={dataset:{promptName:'deus'},value:'  나의   데우스 '};
  await e.events.get('change')({target:input});assert.equal(e.state.names.deus,'나의 데우스');assert.equal(input.value,'나의 데우스');assert.deepEqual(e.calls,['save','name']);assert.match(e.status.textContent,/저장/);
  await e.events.get('change')({target:{dataset:{promptName:'deus'},value:'나의 데우스'}});assert.deepEqual(e.calls,['save','name']);
  await e.events.get('change')({target:{dataset:{promptName:'unknown'},value:'x'}});assert.deepEqual(e.calls,['save','name']);assert.equal(e.state.names.unknown,undefined);e.cleanup();
});
await check('a failed name save rolls back to the previous name',async()=>{
  const e=environment({kind:'deus'});e.state.names={deus:'이전'};e.failSave();await e.events.get('change')({target:{dataset:{promptName:'deus'},value:'새 이름'}});assert.equal(e.state.names.deus,'이전');assert.equal(e.status.textContent,'save failed');e.cleanup();
});
await check('name display stays disabled when addon mode or the quick tool is unavailable',async()=>{
  const e=environment({kind:'deus'});e.settings.addons=false;e.choice.value='no';await e.events.get('change')({target:e.choice});
  assert.equal(e.choice.disabled,true);assert.equal(e.choice.value,'yes');assert.deepEqual(e.calls,[]);
  e.settings.addons=true;e.state.enabled['deus-qr']=false;e.choice.value='no';await e.events.get('change')({target:e.choice});assert.equal(e.choice.disabled,true);assert.deepEqual(e.calls,[]);e.cleanup();
});
await check('name display prevents a second write until the first verified save finishes',async()=>{
  const e=environment({kind:'deus'});e.gateSave();e.choice.value='no';const first=e.events.get('change')({target:e.choice});
  assert.equal(e.choice.disabled,true);assert.ok(e.inputs.every(i=>i.disabled));
  e.choice.value='yes';await e.events.get('change')({target:e.choice});assert.deepEqual(e.calls,['save']);assert.equal(e.choice.value,'no');
  e.saveGate.resolve();await first;assert.equal(e.choice.disabled,false);assert.equal(e.state.deusIconWithName,false);e.cleanup();
});
await check('failed name-display persistence restores both the saved value and the visible selection',async()=>{
  const e=environment({kind:'deus'});e.state.deusIconWithName=true;e.failSave();e.choice.value='no';await e.events.get('change')({target:e.choice});
  assert.equal(e.state.deusIconWithName,true);assert.equal(e.choice.value,'yes');assert.equal(e.choice.disabled,false);assert.equal(e.status.textContent,'save failed');e.cleanup();
});
await check('name-display selection follows updates from another open settings panel',async()=>{
  const e=environment({kind:'deus'});await new Promise(setImmediate);e.state.deusIconWithName=false;for(const paint of e.subscribers)paint();assert.equal(e.choice.value,'no');e.cleanup();
});
console.log(`prompt-tools: ${passed} passed`);
