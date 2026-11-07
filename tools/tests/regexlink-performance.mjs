// 실제 연동 모듈에 합성 성능 엔진을 연결해 비동기 켬/끔과 수동 변경 보존을 확인해요.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const tempBase=await fs.realpath(os.tmpdir());
const temp=await fs.mkdtemp(path.join(tempBase,'bl-regexlink-perf-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(fn)=>{for(let i=0;i<300;i++){if(fn())return;await sleep(10)}throw Error('합성 비동기 작업이 끝나지 않았어요')};
let cases=0,number=0;
const casesState=[];
async function boot({on=false,legacy=false,defer=false}={}){
 const dir=path.join(temp,String(number++)),host=path.join(dir,'st'),deep=path.join(host,'a/b/c/d'),addon=path.join(deep,'addons/regexlink');
 await fs.mkdir(addon,{recursive:true});await fs.writeFile(path.join(dir,'package.json'),' {"type":"module"} ');
 for(const f of ['index.js','engine.js'])await fs.copyFile(path.join(root,'src/addons/regexlink',f),path.join(addon,f));
 const S={on:false,imports:0,activations:[],mounts:0,notified:0,save:0,release:null,defer,nodes:[]};casesState.push(S);
 S.events=new Map();const events={on(k,f){const a=S.events.get(k)||[];a.push(f);S.events.set(k,a)},removeListener(k,f){S.events.set(k,(S.events.get(k)||[]).filter(x=>x!==f))}};
 S.ext={regex:[],preset_allowed_regex:{openai:['합성']},salty:{enabled:true,addons:{regexlink:true}},regex_link:{performanceOn:on}};
 S.names=legacy?['third-party/st-regex-perf']:[];
 S.oai={preset_settings_openai:'합성',prompts:[{identifier:'weather',name:'Weather Engine',content:'Output @Weather Engine'}],extensions:{regex_scripts:[{id:'w1',scriptName:'DEM - @Weather Engine UI',findRegex:'/x/g',replaceString:'y',disabled:false}]}};
 S.original=structuredClone(S.oai.extensions.regex_scripts);
 S.order=[{identifier:'weather',enabled:true}];
 S.pm={activeCharacter:{id:1},getPromptOrderForCharacter:()=>S.order};
 S.ctx={mainApi:'openai',chat:[],characterId:0,characters:[{avatar:'sample.png',data:{extensions:{regex_scripts:[]}}}]};
 S.presetManager={getCompletionPresetByName:()=>({extensions:{regex_scripts:S.original}}),writePresetExtensionField:async()=>{}};
 globalThis.__rxPerfLink=S;
 const G='const S=globalThis.__rxPerfLink;';
 await fs.writeFile(path.join(dir,'script.js'),G+'export const eventSource=S.eventSource;export const event_types={SETTINGS_UPDATED:"settings",OAI_PRESET_CHANGED_AFTER:"preset",CHAT_CHANGED:"chat",MESSAGE_RECEIVED:"message",MESSAGE_SWIPED:"swipe",MESSAGE_DELETED:"deleted"};export const saveSettingsDebounced=()=>S.save++;');
 S.eventSource=events;
 await fs.writeFile(path.join(host,'extensions.js'),G+'export const extension_settings=S.ext;export const extensionNames=S.names;');
 await fs.writeFile(path.join(host,'openai.js'),G+'export const oai_settings=S.oai;export const promptManager=S.pm;');
 await fs.writeFile(path.join(host,'preset-manager.js'),G+'export const getPresetManager=()=>S.presetManager;');
 await fs.writeFile(path.join(host,'popup.js'),'export const POPUP_TYPE={TEXT:1};export async function callGenericPopup(){}');
 await fs.writeFile(path.join(deep,'addon-files-check.js'),'export function verifyAddonCss(){}');
 await fs.writeFile(path.join(addon,'regexperf.js'),G+`
 S.imports++;if(S.defer)await new Promise(r=>S.release=r);
 export function setRuntimeEnabled(on){S.on=on;S.activations.push(on);return on}
 export function regexPerfStatus(){return {enabled:S.on,patched:S.on,wrapperWarning:''}}
 export function setScriptChangeListener(fn){S.scriptChange=fn}
 export function notifyScriptsChanged(){S.notified++}
 export async function mountPanel(){if(!S.mounted){S.mounted=true;S.mounts++}}
 S.loaded=true;`);
 function element(){
  const queries=new Map();let html='';
  const e={hidden:false,isConnected:true,open:false,style:{},dataset:{},handlers:{},classList:{add(){},remove(){}},append(){},replaceChildren(){},scrollIntoView(){},
   addEventListener(k,f){(this.handlers[k]??=[]).push(f)},
   get innerHTML(){return html},set innerHTML(v){html=String(v)},
   querySelector(sel){
    if(queries.has(sel))return queries.get(sel);
    const data=/^\[(data-[\w-]+)\]$/.exec(sel),cls=/^\.([\w-]+)$/.exec(sel);
    if(data&&!new RegExp('\\b'+data[1]+'(?:[\\s=>])').test(html))return null;
    if(cls&&!html.includes(cls[1]))return null;
    const x=element();x.hidden=!!data&&data[1]==='data-performance-panel';queries.set(sel,x);return x;
   }};
  S.nodes.push(e);return e;
 }
 globalThis.document={createElement:element,body:{append(){}},addEventListener(){},removeEventListener(){},querySelectorAll:()=>[]};
 globalThis.jQuery=fn=>fn();globalThis.SillyTavern={getContext:()=>S.ctx};
 S.module=await import(pathToFileURL(path.join(addon,'index.js')));
 S.root=S.nodes.find(e=>e.id==='regex-link-settings');
 await until(()=>S.root?.querySelector('[data-performance-status]')?.textContent?.length>0);
 assert.ok(S.root.innerHTML.includes('data-performance-details'));
 S.change=checked=>{for(const fn of S.root.handlers.change||[])fn({target:{dataset:{performance:''},checked}})};
 S.open=()=>{const el=S.root.querySelector('[data-performance-details]');el.open=true;for(const fn of el.handlers.toggle||[])fn({target:el})};
 S.slot=()=>S.root.querySelector('[data-performance-panel]');return S;
}
async function test(name,fn){await fn();cases++;console.log('통과: '+name)}
try{
 await test('기본 꺼짐은 성능 엔진을 받지 않아요',async()=>{const s=await boot();assert.equal(s.imports,0);assert.equal(s.slot().hidden,true);s.open();await sleep(20);assert.equal(s.imports,0);await s.module.stop()});
 await test('저장된 켬은 연결하되 세부 화면은 펼칠 때 만들어요',async()=>{const s=await boot({on:true});await until(()=>s.on);assert.equal(s.imports,1);assert.equal(s.mounts,0);s.open();await until(()=>s.mounts===1);s.module.sync();await sleep(20);assert.equal(s.imports,1);assert.equal(s.mounts,1);await s.module.stop();assert.equal(s.on,false)});
 await test('같은 창의 켬과 끔은 즉시 적용하고 모듈은 한 번만 받아요',async()=>{const s=await boot();s.open();s.change(true);await until(()=>s.on);assert.equal(s.ext.regex_link.performanceOn,true);s.change(false);assert.equal(s.on,false);assert.equal(s.slot().hidden,true);s.change(true);await until(()=>s.on);assert.equal(s.imports,1);await s.module.stop()});
 await test('불러오는 도중 끄면 늦은 완료가 다시 켜지 않아요',async()=>{const s=await boot({defer:true});s.change(true);await until(()=>s.release);s.change(false);s.release();await until(()=>s.loaded);await sleep(30);assert.equal(s.on,false);assert.ok(!s.activations.includes(true));await s.module.stop()});
 await test('불러오는 도중 stop 뒤에는 쉬고 resume 때만 다시 켜요',async()=>{const s=await boot({on:true,defer:true});await until(()=>s.release);await s.module.stop();s.release();await until(()=>s.loaded);await sleep(30);assert.equal(s.on,false);await s.module.resume();await until(()=>s.on);await s.module.stop();assert.equal(s.on,false)});
 await test('원본 확장이 켜져 있으면 받지 않고 원본을 끈 뒤에만 연결해요',async()=>{const s=await boot({on:true,legacy:true});assert.equal(s.imports,0);assert.match(s.root.querySelector('[data-performance-status]').textContent,/별도로 설치/);s.ext.disabledExtensions=['third-party/st-regex-perf'];s.module.sync();await until(()=>s.on);await s.module.stop()});
 await test('성능 표에서 직접 끈 규칙은 새 목록에서도 자동 연동이 되돌리지 않아요',async()=>{const s=await boot({on:true});await until(()=>s.on);s.scriptChange(['w1'],{disabled:true});s.oai.extensions.regex_scripts=s.oai.extensions.regex_scripts.map(x=>({...x,disabled:true}));s.module.sync();assert.equal(s.oai.extensions.regex_scripts[0].disabled,true);assert.equal(s.ext.regex_link.manual.w1,true);assert.ok(!Object.hasOwn(s.ext.regex_link.origin,'w1'));await s.module.stop();assert.equal(s.oai.extensions.regex_scripts[0].disabled,true)});
 await test('프롬프트 연동으로 켬/끔을 바꾼 직후 성능 캐시를 무효화해요',async()=>{const s=await boot({on:true});await until(()=>s.on);const before=s.notified;s.order[0].enabled=false;s.module.sync();assert.ok(s.notified>before);assert.equal(s.oai.extensions.regex_scripts[0].disabled,true);await s.module.stop()});
 await test('블루레몬 사용이 꺼지면 실행 계측도 원복돼요',async()=>{const s=await boot({on:true});await until(()=>s.on);s.ext.salty.enabled=false;s.module.sync();assert.equal(s.on,false);assert.equal(s.slot().hidden,true);await s.module.stop()});
}finally{
 for(const s of casesState){s.release?.();try{await s.module?.stop()}catch{}}
 const resolved=await fs.realpath(temp);assert.ok(resolved.startsWith(tempBase+path.sep)&&path.basename(resolved).startsWith('bl-regexlink-perf-'));
 await fs.rm(resolved,{recursive:true,force:true});
}
console.log(`정규식 연동 비동기 검사 ${cases}개를 통과했어요.`);
