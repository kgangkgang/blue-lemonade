// Synthetic prompts only. No user preset text, settings, regex or personal data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.argv[2] || '.');
const bundled = (await import(pathToFileURL(path.join(root,'src/scripts/bundled/deus-qr.js')))).default;
const plain = fs.readFileSync(path.join(root,'src/scripts/plain/deus-qr.js'),'utf8');
assert.equal(plain.split('/*BL-SCRIPT-START*/\n')[1].split('\n/*BL-SCRIPT-END*/')[0],bundled);
new Function('BlueLemonade',bundled);
const { groups, toggles, groupsV3, togglesV3, variant, marker, create, matches, quickName } = new Function(bundled.split('// INSTALL')[0]+'\nreturn { groups:DEUS_QUICK_GROUPS,toggles:DEUS_QUICK_TOGGLES,groupsV3:DEUS_QUICK_GROUPS_V3,togglesV3:DEUS_QUICK_TOGGLES_V3,variant:deusVariant,marker:DEUS_QUICK_MARKER,create:createDeusQuickController,matches:deusMatches,quickName:deusQuickName };')();
let passed=0;
async function test(name, fn) { await fn(); console.log('PASS',name); passed++; }
function fixture() {
 const ids=[marker], seen=new Set(ids);
 const add=id=>{if(!seen.has(id)){seen.add(id);ids.push(id);}};
 const addGroup=g=>{if(seen.has(g.header))return;add(g.header);g.options.forEach(x=>add(x.id));const next=groups.find(x=>x.header===g.end);if(next)addGroup(next);else add(g.end);};
 groups.forEach(addGroup);toggles.forEach(t=>add(t.id));add('unknown-custom');
 const prompts=ids.map(identifier=>({identifier,name:identifier===marker?'DEUS EX MACHINA V2.5':'synthetic',content:'synthetic fixture only',role:'system',forbid_overrides:true,extra:{untouched:1}}));
 const order=ids.map(identifier=>({identifier,enabled:false,custom:'kept'}));
 for(const group of groups) order.find(x=>x.identifier===group.options[0].id).enabled=true;
 const saved={prompts,prompt_order:[{character_id:100001,order},{character_id:7,order:[{identifier:'unknown-custom',enabled:true}]}],extensions:{regex_scripts:[{findRegex:'synthetic',unknown:9}],other:{keep:1}},temperature:.75,unknown:{a:[1,2,3]}};
 const live={...structuredClone(saved),preset_settings_openai:'Synthetic Deus',temperature:.99};
 const writes=[],other=structuredClone(saved); other.unknown.a.push(10);
 let name='Synthetic Deus', selectedLive=live, mode='openai', strategy='global', publishCount=0, saveHook=null, readHook=null;
 const cache=new Map([[name,saved],['Other',other]]);
 const adapter={read(){readHook?.();return {name,api:mode,saved:cache.get(name),live:selectedLive,strategy};},cached:n=>cache.get(n),async save(n,p){writes.push([n,structuredClone(p)]);await saveHook?.(n,p);},publish(){publishCount++;}};
 return {saved,live,writes,cache,controller:create(adapter),switch(){name='Other';selectedLive={...structuredClone(other),preset_settings_openai:'Other'};},setName(n){name=n;},setMode(v){mode=v;},setStrategy(v){strategy=v;},setSave(fn){saveHook=fn;},setRead(fn){readHook=fn;},get publishCount(){return publishCount;}};
}
const group=groups.find(g=>g.key==='length'), toggle=toggles[0];
const order=p=>p.prompt_order.find(x=>String(x.character_id)==='100001').order;
const changed=(before,after)=>order(before).filter((x,i)=>x.enabled!==order(after)[i].enabled).map(x=>x.identifier);
await test('초장편은 아주 길게와 배타적이고 기존 프리셋에 없으면 새 항목을 만들지 않아요',async()=>{
 const ultra='bl-deus-length-ultra-long',extra='1bbb1b67-520c-4730-96d7-9674f794538b';
 assert.equal(group.options.find(x=>x.id===ultra)?.label,'초장편');
 const f=fixture();await f.controller.change(group.key,ultra);
 assert.deepEqual(group.options.filter(x=>f.controller.read().states.get(x.id)).map(x=>x.id),[ultra]);
 await f.controller.change(group.key,extra);
 assert.deepEqual(group.options.filter(x=>f.controller.read().states.get(x.id)).map(x=>x.id),[extra]);
 const old=fixture();for(const p of [old.saved,old.live]){p.prompts=p.prompts.filter(x=>x.identifier!==ultra);for(const g of p.prompt_order)g.order=g.order.filter(x=>x.identifier!==ultra);}
 await assert.rejects(old.controller.change(group.key,ultra));assert.equal(old.writes.length,0);
});
await test('초장편과 민속 공포의 한글 이름·도움말을 번역 사전에서 찾을 수 있어요',async()=>{
 const code=(await import(pathToFileURL(path.join(root,'src/scripts/bundled/deus.js')))).default;
 let dictionary;new Function('BlueLemonade',code)({translate:value=>{dictionary=value;}});
 const ultra=dictionary.prompts.find(x=>x.id==='bl-deus-length-ultra-long');
 assert.equal(ultra.title,'「 초장편 」');assert.ok(ultra.desc.includes('2,000~3,200'));
 const horror=dictionary.prompts.find(x=>x.id==='6f3c2a91-4d7e-4b58-9a1c-e2f05b8d7c34');
 assert.equal(horror.title,'「 일상 민속 공포 · 기묘한 미스터리 」');
 assert.ok(toggles.some(x=>x.id===horror.id&&x.tab==='문체'));
});
await test('16 choice groups and independent multi-select styles',()=>{assert.equal(groups.length,16);assert.ok(toggles.filter(x=>x.tab==='문체').length>=10);assert.ok(!groups.some(x=>x.label.includes('분위기')));});
await test('display labels use natural Korean instead of implementation macros',()=>{for(const item of [...groups.flatMap(g=>g.options),...toggles])assert.ok(!/\{\{(?:user|char)\}\}/.test(item.label));});
await test('known 2.5 marker requires version and structural anchors',()=>{const f=fixture();assert.ok(matches(f.saved));f.saved.prompts[0].name='DEUS V2.3';assert.equal(matches(f.saved),false);f.saved.prompts[0].name='DEUS V2.50';assert.equal(matches(f.saved),false);});
await test('toggle updates only clicked enabled; unknown data, regex, prompt content, other order and unsaved parameters survive',async()=>{
 const f=fixture(),before=structuredClone(f.saved),liveBefore=structuredClone(f.live);const r=await f.controller.change(toggle.id,true);assert.equal(r.state,'saved');
 assert.deepEqual(changed(before,f.saved),[toggle.id]);const expected=structuredClone(before);order(expected).find(x=>x.identifier===toggle.id).enabled=true;
 assert.deepEqual(f.saved,expected);assert.deepEqual(f.writes[0],[liveBefore.preset_settings_openai,expected]);assert.equal(f.live.temperature,.99);assert.deepEqual(f.live.prompts,liveBefore.prompts);assert.equal(f.publishCount,1);
});
await test('radio changes exactly available known siblings, no header or unknown ID',async()=>{const f=fixture(),before=structuredClone(f.saved);await f.controller.change(group.key,group.options[2].id);assert.deepEqual(changed(before,f.saved),[group.options[0].id,group.options[2].id]);assert.equal(order(f.saved).find(x=>x.identifier===group.header).enabled,false);});
await test('multiple selected values are preserved until explicit choice',async()=>{const f=fixture();for(const p of [f.live,f.saved])order(p).find(x=>x.identifier===group.options[1].id).enabled=true;assert.equal(f.controller.read().states.get(group.options[0].id),true);assert.equal(f.writes.length,0);await f.controller.change(group.key,group.options[2].id);assert.deepEqual(group.options.map(x=>f.controller.read().states.get(x.id)),group.options.map((_,i)=>i===2));});
await test('same value sends no request',async()=>{const f=fixture();assert.equal((await f.controller.change(group.key,group.options[0].id)).state,'unchanged');assert.equal(f.writes.length,0);});
await test('turn a choice group off without touching its header or any other group',async()=>{const f=fixture(),before=structuredClone(f.saved);await f.controller.change(group.key,'');assert.deepEqual(changed(before,f.saved),[group.options[0].id]);assert.ok(group.options.every(x=>f.controller.read().states.get(x.id)===false));});
await test('active unknown option within a choice group blocks only that group',async()=>{const f=fixture();for(const p of [f.saved,f.live]){const rows=order(p),idx=rows.findIndex(x=>x.identifier==='unknown-custom');const row=rows.splice(idx,1)[0];row.enabled=true;rows.splice(rows.findIndex(x=>x.identifier===group.end),0,row);}await assert.rejects(f.controller.change(group.key,group.options[1].id));assert.equal(f.writes.length,0);await f.controller.change(toggle.id,true);assert.equal(order(f.saved).find(x=>x.identifier==='unknown-custom').enabled,true);});
await test('inactive unknown option is preserved when choosing a known sibling',async()=>{const f=fixture();for(const p of [f.saved,f.live]){const rows=order(p),idx=rows.findIndex(x=>x.identifier==='unknown-custom');const row=rows.splice(idx,1)[0];rows.splice(rows.findIndex(x=>x.identifier===group.end),0,row);}const before=structuredClone(f.saved);await f.controller.change(group.key,group.options[1].id);assert.deepEqual(changed(before,f.saved),[group.options[0].id,group.options[1].id]);});
await test('missing group boundary or moved known sibling cannot be guessed',async()=>{for(const change of [rows=>rows.splice(rows.findIndex(x=>x.identifier===group.end),1),rows=>rows.push(rows.splice(rows.findIndex(x=>x.identifier===group.options[1].id),1)[0])]){const f=fixture();for(const p of [f.saved,f.live])change(order(p));await assert.rejects(f.controller.change(group.key,group.options[0].id));assert.equal(f.writes.length,0);}});
await test('disabled/absent known optional item is never created',async()=>{const f=fixture(),id=group.options.at(-1).id;for(const p of [f.live,f.saved]){p.prompts=p.prompts.filter(x=>x.identifier!==id);p.prompt_order[0].order=p.prompt_order[0].order.filter(x=>x.identifier!==id);}assert.equal(f.controller.read().available.has(id),false);await assert.rejects(f.controller.change(group.key,id));assert.equal(f.writes.length,0);});
await test('unknown requests and non-boolean toggle values fail closed',async()=>{const f=fixture();await assert.rejects(f.controller.change('unknown-custom',true));await assert.rejects(f.controller.change(toggle.id,'true'));await assert.rejects(f.controller.change(group.key,'unknown-custom'));assert.equal(f.writes.length,0);});
await test('wrong preset, API and per-character strategy cannot write',async()=>{for(const action of [f=>f.saved.prompts[0].name='Other',f=>f.setMode('textgenerationwebui'),f=>f.setStrategy('character'),f=>f.setName('Other')]){const f=fixture();action(f);await assert.rejects(f.controller.change(toggle.id,true));assert.equal(f.writes.length,0);}});
await test('duplicate identifiers or order lists fail closed',async()=>{for(const action of [p=>p.prompts.push({...p.prompts[0]}),p=>p.prompt_order.push(structuredClone(p.prompt_order[0])),p=>order(p).push({...order(p)[0]})]){const f=fixture();action(f.saved);await assert.rejects(f.controller.change(toggle.id,true));assert.equal(f.writes.length,0);}});
await test('dirty prompt content and order changes block save without losing edit',async()=>{for(const action of [p=>p.prompts[2].content='new edit',p=>order(p)[2].enabled=!order(p)[2].enabled,p=>p.prompt_order[0].order.reverse()]){const f=fixture();action(f.live);const before=structuredClone(f.live);assert.equal(f.controller.read().dirty,true);await assert.rejects(f.controller.change(toggle.id,true));assert.deepEqual(f.live,before);assert.equal(f.writes.length,0);}});
await test('change between click and write is rejected before network',async()=>{const f=fixture();const promise=f.controller.change(toggle.id,true);f.saved.unknown.a.push(4);await assert.rejects(promise);assert.equal(f.writes.length,0);});
await test('selection switch before write is rejected',async()=>{const f=fixture();const promise=f.controller.change(toggle.id,true);f.switch();await assert.rejects(promise);assert.equal(f.writes.length,0);});
await test('save failure leaves original and live state intact',async()=>{const f=fixture(),before=structuredClone(f.saved),live=structuredClone(f.live);f.setSave(()=>{throw Error('offline');});await assert.rejects(f.controller.change(toggle.id,true));assert.deepEqual(f.saved,before);assert.deepEqual(f.live,live);assert.equal(f.controller.busy,false);assert.equal(f.publishCount,0);});
await test('concurrent click sends one write',async()=>{const f=fixture();let done;f.setSave(()=>new Promise(r=>done=r));const first=f.controller.change(toggle.id,true);await Promise.resolve();await assert.rejects(f.controller.change(toggles[1].id,true));done();await first;assert.equal(f.writes.length,1);});
await test('switch while saving updates only original cache and leaves selected preset intact',async()=>{const f=fixture(),beforeOther=structuredClone(f.cache.get('Other'));f.setSave(()=>f.switch());assert.equal((await f.controller.change(toggle.id,true)).state,'switched');assert.deepEqual(f.cache.get('Other'),beforeOther);assert.equal(f.publishCount,0);});
await test('same-preset external cache change during save is preserved and reported',async()=>{const f=fixture();f.setSave(()=>{f.saved.unknown.a.push(9);});assert.equal((await f.controller.change(toggle.id,true)).state,'conflict');assert.equal(order(f.saved).find(x=>x.identifier===toggle.id).enabled,false);assert.equal(f.saved.unknown.a.at(-1),9);assert.equal(f.publishCount,0);});
await test('same-preset live edit during save is never overwritten',async()=>{const f=fixture();f.setSave(()=>{f.live.prompts[3].content='external edit';});assert.equal((await f.controller.change(toggle.id,true)).state,'conflict');assert.equal(f.live.prompts[3].content,'external edit');assert.equal(order(f.live).find(x=>x.identifier===toggle.id).enabled,false);assert.equal(f.publishCount,0);});
await test('stop before write cancels request, stop during write does not apply live',async()=>{let f=fixture();let p=f.controller.change(toggle.id,true);f.controller.stop();await assert.rejects(p);assert.equal(f.writes.length,0);f=fixture();f.setSave(()=>f.controller.stop());assert.equal((await f.controller.change(toggle.id,true)).state,'switched');assert.equal(f.publishCount,0);});
await test('idle polling never reads large prompt content after initial validation',()=>{const f=fixture();let reads=0;for(const p of [f.saved,f.live])Object.defineProperty(p.prompts[1],'content',{enumerable:true,get(){reads++;return 'x'.repeat(100000);}});f.controller.read();const initial=reads;assert.ok(initial>0);for(let i=0;i<20;i++)f.controller.read(false);assert.equal(reads,initial);f.controller.read(true);assert.ok(reads>initial);});

await test('own pending save keeps target identity through a temporary prompt refresh',async()=>{
 const f=fixture(),prompts=f.live.prompts;f.setSave(async()=>{f.live.prompts=[];assert.equal(f.controller.isAvailable(),false);assert.equal(f.controller.isPendingTarget(),true);await Promise.resolve();f.live.prompts=prompts;});
 assert.equal((await f.controller.change(toggle.id,true)).state,'saved');assert.equal(f.controller.isPendingTarget(),false);assert.equal(f.controller.isAvailable(),true);
});
await test('external preset switches are never treated as the pending saved target',async()=>{
 const f=fixture();f.setSave(()=>{assert.equal(f.controller.isPendingTarget(),true);f.switch();assert.equal(f.controller.isPendingTarget(),false);});assert.equal((await f.controller.change(toggle.id,true)).state,'switched');
});
await test('failed saves clear pending identity before retry',async()=>{
 const f=fixture();f.setSave(()=>{assert.equal(f.controller.isPendingTarget(),true);throw Error('offline');});await assert.rejects(f.controller.change(toggle.id,true));assert.equal(f.controller.isPendingTarget(),false);f.setSave(null);assert.equal((await f.controller.change(toggle.id,true)).state,'saved');
});
await test('UI entry, cleanup, explicit save and no model/network generation contracts',()=>{
 assert.ok(bundled.includes('__blueLemonadeDeusQuick_v1'));assert.ok(bundled.includes('BlueLemonade.onCleanup(stop)'));assert.ok(bundled.includes('skipUpdate:true'));assert.ok(bundled.includes("setAttribute('aria-modal','false')"));assert.ok(!/generateRaw|generateQuietPrompt|fetch\(|executeSlashCommands|replacePreset\(/.test(bundled));
});
await test('native modules import through the parent realm and native document base',()=>{assert.ok(bundled.includes("host.Function('url','return import(url)')"));assert.ok(bundled.includes("importHost(new URL('scripts/openai.js',doc.baseURI).href)"));assert.ok(!bundled.includes("import(new URL("));});
await test('the entry name is display only: trimmed, single-spaced, capped at 40 characters, never a non-string',()=>{assert.equal(quickName('  데우스   설정 '),'데우스 설정');assert.equal(quickName('가'.repeat(60)).length,40);assert.equal(quickName(''),'');assert.equal(quickName(undefined),'');assert.equal(quickName(['x']),'');});
await test('the entry label follows the script settings and is refreshed on settings events and from the theme panel',()=>{assert.ok(bundled.includes("extensionSettings?.blue_lemonade_scripts?.names?.deus"));assert.ok(bundled.includes('refreshName: syncName'));assert.ok(bundled.includes("    if (stopped) return;\n    syncName();"));assert.ok(bundled.includes('.dq-entry-label'));assert.ok(!bundled.includes('names.deus ='));});
await test('8.0.1 a quick toggle inside a choice group turns its lit peers off in the same saved write (대사 색상 ↔ 카드 따라 자동)',async()=>{
 const {promptChoiceGroups}=await import(pathToFileURL(path.join(root,'src/prompt-choice-core.js')));
 globalThis.BlueLemonade={choicePeers:(prompts,order,metadata,id)=>[...new Set(promptChoiceGroups(prompts,order,metadata).filter(g=>g.ids.includes(id)).flatMap(g=>g.ids))].filter(x=>x!==id)};
 try{
  const f=fixture(),color=toggles.find(x=>x.label==='대사 색상').id;
  for(const preset of [f.saved,f.live]){preset.prompts.push({identifier:'bl-auto',name:'| Dialogue Color (카드 따라 자동) |',content:'synthetic',role:'system'});order(preset).push({identifier:'bl-auto',enabled:true});preset.extensions.blPromptChoices={version:1,groups:[{id:'dialogue-colors',ids:[color,'bl-auto']}]};}
  const r=await f.controller.change(color,true);assert.equal(r.state,'saved');
  const row=id=>order(f.writes[0][1]).find(x=>x.identifier===id);
  assert.equal(row(color).enabled,true);assert.equal(row('bl-auto').enabled,false,'the saved preset keeps only one lit');
  assert.equal(order(f.live).find(x=>x.identifier==='bl-auto').enabled,false,'live settings follow');
  const g=fixture();await g.controller.change(toggles.find(x=>x.label==='반복 방지').id,true);assert.equal(order(g.writes[0][1]).filter(x=>x.enabled).length,order(g.saved).filter(x=>x.enabled).length,'toggles outside any group change only themselves');
 }finally{delete globalThis.BlueLemonade;}
});
// ── V3 · 2.5 둘 다(2026-10-27): 실제 사용자 저장본 두 개의 구조(본문 · 이름 없음, tools/tests/deus-qr-presets.json)로 시험해요.
const presets=JSON.parse(fs.readFileSync(path.join(root,'tools/tests/deus-qr-presets.json'),'utf8'));
function realFixture(kind,{marker}={}){
 const src=presets[kind];
 const prompts=src.order.map(([identifier])=>({identifier,name:identifier===DEUS_MARKER?(marker??src.marker):'synthetic',content:'synthetic fixture only',role:'system'}));
 const saved={prompts,prompt_order:[{character_id:100001,order:src.order.map(([identifier,on])=>({identifier,enabled:on===1}))}],extensions:{regex_scripts:[{findRegex:'synthetic'}]},temperature:1};
 const live={...structuredClone(saved),preset_settings_openai:'내 데우스'};
 const writes=[];let name='내 데우스';const cache=new Map([[name,saved]]);
 const adapter={read(){return {name,api:'openai',saved:cache.get(name),live,strategy:'global'};},cached:n=>cache.get(n),async save(n,p){writes.push([n,structuredClone(p)]);},publish(){}};
 return {saved,live,writes,controller:create(adapter)};
}
const DEUS_MARKER=marker;
const lit=(f,g)=>g.options.filter(o=>f.controller.read().states.get(o.id)===true).map(o=>o.label);
await test('V3 · 실제 V3 사용자 저장본 구조는 V3, 2.5 저장본 구조는 2.5 로 알아봐요(파일 · 프리셋 이름과 무관)',()=>{
 assert.equal(variant(realFixture('v3').saved).key,'v3');assert.equal(variant(realFixture('2.5').saved).key,'2.5');
 assert.equal(realFixture('v3').controller.read().variant.label,'V3');assert.equal(realFixture('2.5').controller.read().variant.label,'2.5');
 assert.equal(realFixture('v3').controller.isAvailable(),true);assert.equal(realFixture('2.5').controller.isAvailable(),true);
});
await test('V3 · 시작 표시 이름을 바꾸거나 판 번호를 지워도 구조로 판별하고, 모르는 판 번호(V2.3 · V2.50 · V4)는 받지 않아요',()=>{
 for(const name of ['🔹나의 데우스🔹','DEUS','','데우스 3','🔹DEUS EX MACHINA V3.1🔹'])assert.equal(variant(realFixture('v3',{marker:name}).saved)?.key,'v3',name);
 for(const name of ['🔹나의 데우스🔹','DEUS EX MACHINA V2.5 (내 설정)'])assert.equal(variant(realFixture('2.5',{marker:name}).saved)?.key,'2.5',name);
 for(const name of ['DEUS V2.3','DEUS V2.50','DEUS EX MACHINA V4'])assert.equal(variant(realFixture('v3',{marker:name}).saved),null,name);
 assert.equal(variant(realFixture('v3',{marker:'🔹DEUS EX MACHINA V2.5🔹'}).saved).key,'v3','이름보다 구조가 우선이에요');
});
await test('V3 · 저장본과 현재 설정의 판이 다르면 열지도 저장하지도 않아요',async()=>{
 const f=realFixture('v3'),other=realFixture('2.5');f.live.prompts=other.live.prompts;f.live.prompt_order=other.live.prompt_order;
 assert.equal(f.controller.isAvailable(),false);await assert.rejects(f.controller.change('length','c66c7b02-93ab-44ca-b908-0b49fe626280'));assert.equal(f.writes.length,0);
});
await test('V3 · 표의 모든 id 가 V3 저장본에 있고, 2.5 표는 그대로(16묶음)이며 2.5 저장본에서도 모두 쓸 수 있어요',()=>{
 const ids=kind=>new Set(presets[kind].order.map(([id])=>id));
 for(const g of groupsV3)for(const id of [g.header,g.end,...g.options.map(o=>o.id)])assert.ok(ids('v3').has(id),`${g.key} ${id}`);
 for(const t of togglesV3)assert.ok(ids('v3').has(t.id),t.label);
 assert.equal(groups.length,16);assert.equal(groupsV3.length,19);
 for(const g of groups)for(const id of [g.header,g.end,...g.options.filter(o=>o.id!=='bl-deus-length-ultra-long').map(o=>o.id)])assert.ok(ids('2.5').has(id),`${g.key} ${id}`);
 assert.ok(!togglesV3.some(t=>['f155f1d8-34be-4ef3-98e3-c63fbd8cec48','ddaac217-1380-4152-9bcd-d1092c5deadf'].includes(t.id)),'V3 에 없는 로맨틱 · 로맨틱 코미디는 V3 표에 없어요');
 assert.ok(toggles.some(t=>t.id==='f155f1d8-34be-4ef3-98e3-c63fbd8cec48'),'2.5 표의 로맨틱은 남아 있어요');
});
await test('V3 · 실제 저장본의 모든 택1 묶음이 막힘 없이 열리고 지금 켜진 값을 그대로 보여요',()=>{
 const f=realFixture('v3'),r=f.controller.read();
 for(const g of groupsV3)assert.equal(r.groupIssues.get(g.key),'',g.key);
 const by=k=>lit(f,groupsV3.find(g=>g.key===k));
 assert.deepEqual(by('length'),['초장편']);assert.deepEqual(by('dialogue'),['연극적으로']);assert.deepEqual(by('narration'),['라이트']);
 assert.deepEqual(by('relationships'),[]);assert.deepEqual(by('status'),['모든 캐릭터']);assert.deepEqual(by('tension'),[]);assert.deepEqual(by('companions'),[]);
 assert.deepEqual(by('reasoning'),['생각하기 ! (대체용)']);assert.deepEqual(by('explicit'),['최고 수위']);
 const g=realFixture('2.5'),r2=g.controller.read();for(const x of groups)assert.equal(r2.groupIssues.get(x.key),'',`2.5 ${x.key}`);
 assert.deepEqual(lit(g,groups.find(x=>x.key==='length')),['초장편']);assert.deepEqual(lit(g,groups.find(x=>x.key==='dialogue')),['생동감 있게']);
});
await test('V3 · 답변 길이는 새 「아주 길게」(3d498f27) · 초장편 · 대장편 중 하나만 켜고, 2.5 의 옛 「아주 길게」 id 는 V3 에서 받지 않아요',async()=>{
 const f=realFixture('v3'),g=groupsV3.find(x=>x.key==='length');
 assert.deepEqual(g.options.map(o=>o.label),['유동적','짧게','보통','길게','아주 길게','초장편','대장편']);
 assert.equal((await f.controller.change('length','bl-deus-length-epic')).state,'saved');assert.deepEqual(lit(f,g),['대장편']);
 await f.controller.change('length','3d498f27-126a-41fc-baf2-369c90a9c50f');assert.deepEqual(lit(f,g),['아주 길게']);
 await assert.rejects(f.controller.change('length','1bbb1b67-520c-4730-96d7-9674f794538b'));assert.equal(f.writes.length,2);
});
await test('V3 · 새 택1(관계 · 상태창 범위 · 친구들 반응 방식)은 그 묶음 안의 켜진 것만 바꾸고 머리 표시는 건드리지 않아요',async()=>{
 for(const [key,pick] of [['relationships','ce6efb5d-fe0f-4dbf-9a9c-4402c4132170'],['status','f2a63bb5-7bf4-4a2d-9767-293fe609ef60'],['companions','35e32cf4-0331-4146-8ffb-fe3b1b1347a5'],['tension','c858bd65-2e20-4b39-b481-9c8d54fe1dc9'],['narration','e2f653f7-fbd0-4565-9ad1-ee2ef67a2bce'],['dialogue','b9a5f748-bd71-41d5-bbb3-432ecb23a1f8']]){
  const f=realFixture('v3'),before=structuredClone(f.saved),g=groupsV3.find(x=>x.key===key);
  assert.equal((await f.controller.change(key,pick)).state,'saved',key);
  const diff=changed(before,f.saved);assert.ok(diff.includes(pick),key);assert.ok(diff.every(id=>g.options.some(o=>o.id===id)),`${key} 바깥을 건드렸어요 ${diff}`);
  assert.equal(order(f.saved).find(x=>x.identifier===g.header).enabled,order(before).find(x=>x.identifier===g.header).enabled);
  assert.deepEqual(lit(f,g),[g.options.find(o=>o.id===pick).label]);
 }
});
await test('V3 · 켜진 「대사 소리」 머리 표시가 서술 묶음을 막지 않고, 대사 소리 · 친구 · 새 분위기는 하나씩 따로 켜고 꺼요',async()=>{
 const f=realFixture('v3');assert.equal(order(f.saved).find(x=>x.identifier==='279618e4-d961-489f-9d2b-56503e0d6067').enabled,true);
 assert.equal(f.controller.read().groupIssues.get('narration'),'');
 for(const label of ['말 더듬기','레일라 (애니 덕후)','서스펜스','한편','파이의 퇴고 메모']){
  const t=togglesV3.find(x=>x.label===label),before=structuredClone(f.saved);
  assert.equal((await f.controller.change(t.id,true)).state,'saved',label);assert.deepEqual(changed(before,f.saved),[t.id],label);
  assert.equal((await f.controller.change(t.id,false)).state,'saved',label);
 }
 assert.deepEqual([...new Set(togglesV3.filter(t=>t.card).map(t=>t.card))],['대사 소리']);
 assert.deepEqual(togglesV3.filter(t=>t.tab==='친구들').length,7);
});
await test('V3 · 2.5 저장본에서는 2.5 표 그대로 동작해요(생동감 있게 · 옛 아주 길게 · 로맨틱)',async()=>{
 const f=realFixture('2.5'),g=groups.find(x=>x.key==='length');
 await f.controller.change('length','1bbb1b67-520c-4730-96d7-9674f794538b');assert.deepEqual(lit(f,g),['아주 길게']);
 await assert.rejects(f.controller.change('relationships','ce6efb5d-fe0f-4dbf-9a9c-4402c4132170'));
 const romantic='f155f1d8-34be-4ef3-98e3-c63fbd8cec48',before=structuredClone(f.saved);await f.controller.change(romantic,true);assert.deepEqual(changed(before,f.saved),[romantic]);
});
await test('V3 · 옵션 설명은 같은 id 라도 V3 원문이면 V3 설명, 2.5 원문이면 2.5 설명을 보여요',async()=>{
 const {describeDeusOption,isDeusV3Preset}=await import(pathToFileURL(path.join(root,'src/scripts/deus-option-help.js')));
 const {DEUS_EFFECTS}=await import(pathToFileURL(path.join(root,'src/scripts/deus-option-effects.js')));
 const v3=realFixture('v3').saved,v25=realFixture('2.5').saved;assert.equal(isDeusV3Preset(v3),true);assert.equal(isDeusV3Preset(v25),false);
 const id='d2c6ab81-6ae3-4880-8d50-43b2bc9326c6';
 assert.match(describeDeusOption('dialogue',v3).text,/연극적으로/);assert.match(describeDeusOption('dialogue',v25).text,/생동감 있게/);
 for(const g of groupsV3)assert.ok(!describeDeusOption(g.key,v3).text.includes('찾지 못했어요'),g.key);
 for(const t of togglesV3)assert.ok(DEUS_EFFECTS[t.id],`설명 없음 ${t.label}`);
 for(const g of groupsV3)for(const o of g.options)assert.ok(DEUS_EFFECTS[o.id],`설명 없음 ${g.key} ${o.label}`);
 assert.ok(DEUS_EFFECTS[id].v3?.hash&&DEUS_EFFECTS[id].hash!==DEUS_EFFECTS[id].v3.hash);
});
await test('V3 · 화면: 판 표시는 판별 결과를 따르고 「친구들」 탭은 그 판에 항목이 있을 때만 생겨요',()=>{
 assert.ok(bundled.includes("const tabsOf = current =>"));assert.ok(bundled.includes("current?.variant?.label"));assert.ok(!bundled.includes("node('span','2.5','dq-version')"));
 assert.ok(bundled.includes("'친구들':'user-group'"));assert.ok(bundled.includes('.dq-version[hidden]{display:none}'));
});
console.log(`Deus quick settings: ${passed} passed`);
