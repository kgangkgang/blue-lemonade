import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'), url=pathToFileURL(root+'/');
const prompt=await import(new URL('src/addons/direction/prompt.js',url));
const {insertDirection,insertInstructions,CONTINUE_DIRECTION}=prompt;
const ext={};const probe={ext,insertInstructions,saves:0};globalThis.__directionTest=probe;globalThis.window={matchMedia:()=>({matches:false})};
const source=(await fs.readFile(path.join(root,'src/addons/direction/index.js'),'utf8')).split('// ── 시작')[0].replace(/^import .*;$/gm,'');
const prelude='const {ext:extension_settings,insertInstructions}=globalThis.__directionTest;const saveSettingsDebounced=()=>{globalThis.__directionTest.saves++;};const getChatCompletionModel=()=>globalThis.__directionTest.model||"example-model";const oai_settings={};';
const m=await import('data:text/javascript;base64,'+Buffer.from(prelude+source+'\nexport {initSettings,settings,injectDirection,trackGeneration,remember,savePreset,isSaved,alwaysActive,partnerColor,KINDS,HISTORY_MAX,PRESET_MAX};').toString('base64'));
ext['Direction-Manager-Lite']={extensionEnabled:false,direction:{enabled:true,content:'literal $& direction'},directionPrompt:'Custom {{direction}}',promptDepth:3};
m.initSettings();assert.equal(m.settings().extensionEnabled,false);assert.equal(m.settings().direction.content,'literal $& direction');assert.equal(m.settings().promptDepth,3);
m.settings().onColor='#123456';m.initSettings();assert.equal(m.settings().onColor,'#123456');
let chat=[{role:'user',content:'hello'}];m.injectDirection({chat});assert.equal(chat.length,1);
m.settings().extensionEnabled=true;m.injectDirection({chat});assert.equal(chat.length,1);m.trackGeneration('normal');m.injectDirection({chat});assert.equal(chat[0].content,'Custom literal $& direction');
chat=[{role:'user',content:'hello'}];function generateRaw(){m.trackGeneration('normal');m.injectDirection({chat});}generateRaw();assert.equal(chat.length,1);
for(const type of ['quiet','impersonate']){m.trackGeneration(type);m.injectDirection({chat});assert.equal(chat.length,1);}
m.settings().direction.enabled=false;m.injectDirection({chat});assert.equal(chat.length,1);
const answer={role:'assistant',content:'original answer'};chat=[answer];insertDirection(chat,'{{direction}}','next',0,'gemini-2.5-pro');assert.equal(chat[0],answer);assert.equal(chat.at(-1).role,'user');assert.equal(chat[1].role,'system');
chat=[{...answer,tool_calls:[{id:'tool'}]}];insertDirection(chat,'{{direction}}','next',1,'gemini-2.5-pro');assert.equal(chat.length,2);assert.equal(chat.at(-1).role,'assistant');
// 1.1.5 항상 지시 · 저장 · 최근
const s=m.settings();
assert.deepEqual(s.always,{enabled:false,content:''});assert.deepEqual(s.presets,[]);assert.deepEqual(s.history.always,[]);assert.deepEqual(s.history.direction.map(x=>x.content),['literal $& direction'],'a sent direction is remembered');
ext.jeongaejisi={...structuredClone(s),always:'bad',presets:[{kind:'always',content:' keep '},{kind:'always',content:'keep'},{kind:'direction',content:'keep'},{kind:'other',content:'x'},{kind:'direction',content:'  '},null],history:{direction:[{content:'a'},{content:' a '},{content:''},7],always:'bad'}};
m.initSettings();const t=m.settings();
assert.deepEqual(t.always,{enabled:false,content:''});assert.deepEqual(t.presets.map(p=>p.kind+':'+p.content),['always:keep','direction:keep'],'trimmed, one per page');assert.equal(typeof t.presets[0].id,'string');assert.ok(t.presets[0].id);assert.deepEqual(t.history.always,[]);assert.deepEqual(t.history.direction.map(h=>h.content),['a']);assert.equal(m.isSaved('always','keep'),true);
t.history={direction:[],always:[]};t.presets=[];
t.extensionEnabled=true;t.direction.enabled=false;t.promptDepth=1;t.directionPrompt='D {{direction}}';
t.always={enabled:true,content:''};assert.equal(m.alwaysActive(),false);chat=[{role:'user',content:'u'}];m.trackGeneration('normal');m.injectDirection({chat});assert.equal(chat.length,1,'empty always sends nothing');
t.always.content='<OOC: two images>';assert.equal(m.alwaysActive(),true);
chat=[{role:'user',content:'u1'},{role:'assistant',content:'a1'}];m.trackGeneration('normal');m.injectDirection({chat});
assert.deepEqual(chat.map(x=>x.content),['u1','<OOC: two images>','a1'],'always is raw text at the same depth');
assert.equal(t.history.always[0].content,'<OOC: two images>');assert.deepEqual(t.history.direction,[]);
t.direction={enabled:true,content:'they meet'};probe.saves=0;
chat=[{role:'user',content:'u1'},{role:'assistant',content:'a1'}];m.trackGeneration('swipe');m.injectDirection({chat});
assert.deepEqual(chat.map(x=>x.content),['u1','<OOC: two images>','D they meet','a1'],'always first, then direction');
assert.equal(t.history.direction[0].content,'they meet');assert.equal(probe.saves,1,'new direction saved once');
probe.saves=0;m.trackGeneration('normal');m.injectDirection({chat:[{role:'user',content:'x'}]});assert.equal(probe.saves,0,'same directions again: no settings save');
t.direction.content='draft never sent';t.always.content='<OOC: draft>';probe.saves=0;m.trackGeneration('normal');chat=[{role:'user',content:'x'}];m.injectDirection({chat,dryRun:true});assert.equal(chat.length,3,'dry run still injects (token counting)');assert.equal(probe.saves,0,'dry run saves nothing');assert.deepEqual([t.history.direction[0].content,t.history.always[0].content],['they meet','<OOC: two images>'],'dry run is not remembered');
t.always.content='<OOC: two images>';t.directionPrompt='No placeholder';t.direction.content='not inserted';m.trackGeneration('normal');chat=[{role:'user',content:'x'}];m.injectDirection({chat});assert.equal(chat[1].content,'No placeholder');assert.equal(t.history.direction[0].content,'they meet','a template without {{direction}} does not send the text');t.directionPrompt='D {{direction}}';
t.direction.content='';probe.saves=0;m.trackGeneration('normal');chat=[{role:'user',content:'x'}];m.injectDirection({chat});assert.equal(chat.length,3,'empty direction still sends its template');assert.equal(t.history.direction.length,1,'empty direction is not remembered');
t.extensionEnabled=false;chat=[{role:'user',content:'x'}];m.trackGeneration('normal');m.injectDirection({chat});assert.equal(chat.length,1,'button off sends nothing');t.extensionEnabled=true;
for(const type of ['quiet','impersonate']){chat=[{role:'user',content:'x'}];m.trackGeneration(type);m.injectDirection({chat});assert.equal(chat.length,1);}
chat=[{role:'user',content:'x'}];(function generateRaw(){m.trackGeneration('normal');m.injectDirection({chat});})();assert.equal(chat.length,1,'raw generation untouched by always');
// 제미니: 끝이 assistant 일 때 user 턴을 덧붙이는 것은 전개 지시가 들어갈 때만
t.direction.enabled=false;probe.model='gemini-2.5-pro';chat=[{role:'assistant',content:'a'}];m.trackGeneration('normal');m.injectDirection({chat});assert.deepEqual(chat.map(x=>x.role),['system','assistant'],'always only: no user turn appended');
t.direction.enabled=true;chat=[{role:'assistant',content:'a'}];m.trackGeneration('normal');m.injectDirection({chat});assert.equal(chat.at(-1).content,CONTINUE_DIRECTION);
chat=[{role:'assistant',content:'a'}];m.trackGeneration('continue');m.injectDirection({chat});assert.equal(chat.at(-1).role,'assistant','continue keeps the assistant prefill');assert.equal(chat.length,3);delete probe.model;
// 최근: 맨 앞이면 그대로, 다른 자리면 맨 앞으로, 최대 개수
t.history.direction=[];assert.equal(m.remember('direction','one'),true);assert.equal(m.remember('direction',' one '),false);m.remember('direction','two');assert.equal(m.remember('direction','one'),true);
assert.deepEqual(t.history.direction.map(x=>x.content),['one','two']);
for(let i=0;i<m.HISTORY_MAX+5;i++)m.remember('direction','n'+i);assert.equal(t.history.direction.length,m.HISTORY_MAX);assert.equal(t.history.direction[0].content,'n'+(m.HISTORY_MAX+4));
// 저장
t.presets=[];assert.equal(m.savePreset('always','  '),'empty');assert.equal(m.savePreset('always','<OOC>'),'saved');assert.equal(m.savePreset('always',' <OOC> '),'duplicate');assert.equal(m.savePreset('direction','<OOC>'),'saved','same text on the other page is a separate preset');
assert.equal(m.isSaved('always','<OOC>'),true);assert.equal(m.isSaved('direction','nope'),false);
for(let i=t.presets.length;i<m.PRESET_MAX;i++)t.presets.push({id:'p'+i,kind:'direction',content:'p'+i,at:0});assert.equal(m.savePreset('direction','one more'),'full');
// 그라데이션 짝 색: 형식 · 회색은 밝기만
for(const c of ['#e18a24','#93c9ff','#ffe873','#5c5c5c','#d6d6d6','#000000','#ffffff'])assert.match(m.partnerColor(c),/^#[0-9a-f]{6}$/);
assert.notEqual(m.partnerColor('#5c5c5c'),'#5c5c5c');assert.notEqual(m.partnerColor('#e18a24'),'#e18a24');
const {knownConflicts}=await import(new URL('src/assist/core.js',url));
for(const folder of ['story-direction','Direction-Manager','Direction-Manager-Lite','jeongaejisi']){const key='third-party/'+folder;assert.equal(knownConflicts([key],[],{direction:true}).length,1);assert.equal(knownConflicts([key],[key],{direction:true}).length,0);assert.equal(knownConflicts([key],[],{direction:false}).length,0);}
const {DEFAULTS}=await import(new URL('src/settings.js',url));assert.equal(DEFAULTS.addons.direction,false);
delete globalThis.__directionTest;delete globalThis.window;
console.log('PASS direction migration, preserved settings, off/raw isolation, insertion and Gemini continuation, always direction, presets and history, duplicate ownership and opt-in');
