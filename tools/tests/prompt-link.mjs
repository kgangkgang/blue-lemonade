// 캐릭터 이름 연동 설정 (6.5.2, src/prompt-link.js) — 가짜 설정 · 가짜 문서로 표시 · 저장 · 맞추기 호출을 검사. 네트워크 · DOM 없음.
//   node tools/tests/prompt-link.mjs [테마 루트]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(process.argv[2]||path.join(path.dirname(fileURLToPath(import.meta.url)),'../..'));
const source=fs.readFileSync(path.join(root,'src/prompt-link.js'),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replaceAll('export function ','function ')
  .replace("import('./promptbind.js')",'promptbindReady');
function environment(){
  const settings={promptLink:{on:false,name:''}},calls=[],listeners=new Map();
  let report={prompts:2,twins:1,regex:2},changed=3,fail=false;
  const promptbind={syncPromptBinds:async reason=>{calls.push('sync:'+reason);if(fail)throw Error('no manager');return changed;},linkReport:async()=>report};
  const status={textContent:'',isConnected:true};
  const box={querySelector:sel=>sel==='[data-prompt-link-status]'?status:null};
  const context={getSettings:()=>settings,saveSettings:()=>calls.push('save'),document:{addEventListener:(type,fn)=>listeners.set(type,fn)},promptbindReady:Promise.resolve(promptbind)};
  vm.runInNewContext(source+'\nglobalThis.api={promptLinkMarkup,installPromptLink};',context);
  const control=(attr,props)=>({...props,hasAttribute:name=>name===attr,closest:sel=>sel==='[data-prompt-link]'?box:null});
  return{settings,calls,status,context,listeners,setReport:r=>{report=r},setChanged:n=>{changed=n},setFail:()=>{fail=true},
    toggle:checked=>listeners.get('change')({target:control('data-prompt-link-on',{checked})}),
    name:value=>{const input=control('data-prompt-link-name',{value});const done=listeners.get('change')({target:input});return done.then(()=>input)},
    other:()=>listeners.get('change')({target:{closest:()=>null}})};
}
let passed=0;
async function check(label,fn){await fn();console.log('ok',label);passed++}
await check('markup shows the switch, the name field with escaping and a search anchor',async()=>{
  const e=environment();e.settings.promptLink={on:true,name:'하루 "A" <b>'};
  const html=e.context.api.promptLinkMarkup();
  assert.ok(html.includes('data-prompt-link-on') && html.includes('checked'));assert.ok(html.includes('value="하루 &quot;A&quot; &lt;b&gt;"'));assert.ok(html.includes('data-search-anchor="캐릭터 이름 연동"'));assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('data-prompt-link-status'),'status line');
});
await check('a missing settings block is created without crashing',async()=>{
  const e=environment();delete e.settings.promptLink;const html=e.context.api.promptLinkMarkup();assert.ok(html.includes('value=""'));assert.equal(JSON.stringify(e.settings.promptLink),'{"on":false,"name":""}');
});
await check('turning the switch on saves, resyncs through promptbind and reports what was found',async()=>{
  const e=environment();e.settings.promptLink.name='하루';await e.toggle(true);
  assert.equal(e.settings.promptLink.on,true);assert.deepEqual(e.calls,['save','sync:ui']);assert.match(e.status.textContent,/프롬프트 2개 · 짝 1개 · 정규식 2개/);assert.match(e.status.textContent,/3개를 지금 채팅에 맞췄어요/);
});
await check('already matching chats and empty presets are reported, never saved twice',async()=>{
  const e=environment();e.settings.promptLink.name='하루';e.setChanged(0);await e.toggle(true);assert.match(e.status.textContent,/이미 지금 채팅에 맞아요/);
  e.setReport({prompts:0,twins:0,regex:0});await e.toggle(true);assert.match(e.status.textContent,/그 이름이 든 프롬프트·정규식이 없어요/);
  assert.deepEqual(e.calls,['save','sync:ui','save','sync:ui']);
});
await check('turning it off saves without resyncing and leaves prompts alone',async()=>{
  const e=environment();e.settings.promptLink={on:true,name:'하루'};await e.toggle(false);
  assert.equal(e.settings.promptLink.on,false);assert.deepEqual(e.calls,['save']);assert.match(e.status.textContent,/지금 상태 그대로/);
});
await check('the name is trimmed to 80 characters, saved on change, and an empty name asks for one',async()=>{
  const e=environment();e.settings.promptLink.on=true;
  const input=await e.name('  '+'가'.repeat(90)+'  ');assert.equal(e.settings.promptLink.name,'가'.repeat(80));assert.equal(input.value,'가'.repeat(80));assert.deepEqual(e.calls,['save','sync:ui']);
  await e.name('   ');assert.equal(e.settings.promptLink.name,'');assert.match(e.status.textContent,/이름을 적어 주세요/);assert.deepEqual(e.calls,['save','sync:ui','save']);
});
await check('an unchanged name while the switch is off does nothing',async()=>{
  const e=environment();e.settings.promptLink={on:false,name:'하루'};await e.name('하루');assert.deepEqual(e.calls,[]);
});
await check('a failed promptbind import is reported, not thrown',async()=>{
  const e=environment();e.settings.promptLink.name='하루';e.setFail();await e.toggle(true);assert.match(e.status.textContent,/프롬프트 관리자를 읽지 못했어요/);
});
await check('events outside the block and repeated installs are ignored',async()=>{
  const e=environment();await e.other();assert.deepEqual(e.calls,[]);
  const seen=[];e.context.api.installPromptLink({addEventListener:()=>seen.push(1)});assert.equal(seen.length,0,'installed once at import');
});
console.log(`prompt-link: ${passed} passed`);
