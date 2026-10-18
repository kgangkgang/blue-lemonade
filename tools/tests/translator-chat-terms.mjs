import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {CHAT_GLOSSARY_KEY as KEY, chatGlossaryEntries,chatGlossarySignature,planChatTerm,proposeChatTerm,createChatTermCachePolicy} from '../../src/addons/translator/chat-glossary.js';
import {pickSame,screenOrdinal} from '../../src/addons/translator/selection/delete-core.js';
import {saveTermChat} from '../../src/addons/translator/selection/term-save.js';
import {glossaryFold,glossaryAlternatives,glossaryLines} from '../../src/addons/translator/glossary-match.js';
const source=fs.readFileSync(new URL('../../src/addons/translator/selection/term-memory.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ','');
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
const metadata=(src='Mina',dst='미나')=>({[KEY]:[{id:src.toLowerCase(),src,dst,scope:'chat'}]});
await test('empty and malformed metadata is ignored without mutation',()=>{const m={[KEY]:[null,{src:'<bad>',dst:'x'}]};assert.deepEqual(chatGlossaryEntries(m),[]);assert.equal(m[KEY].length,2);assert.deepEqual(chatGlossaryEntries(null),[]);});
await test('case folded matching accepts a complete source name',()=>assert.equal(planChatTerm({},'Mina arrived.','Mina','민아')[0].dst,'민아'));
await test('substring of another Latin name is rejected',()=>assert.throws(()=>planChatTerm({},'Minato arrived.','Mina','민아')));
await test('markup attributes do not establish a source match',()=>assert.throws(()=>planChatTerm({},'<span title="Mina">Hello</span>','Mina','민아')));
await test('Japanese and Korean source forms work',()=>{assert.equal(planChatTerm({},'ミナが来た。','ミナ','미나').length,1);assert.equal(planChatTerm({},'미나가 왔다.','미나','민아').length,1);});
await test('unknown source, excessive length and multiple forms are rejected',()=>{for(const src of ['Missing','Mina, Rex','x'.repeat(101)])assert.throws(()=>planChatTerm({},'Mina',src,'민아'));});
await test('markup and multiline destinations are rejected',()=>{for(const dst of ['<img>','**민아**','민아\n지시','[민아](x)'])assert.throws(()=>planChatTerm({},'Mina','Mina',dst));});
await test('same normalized source replaces only its chat entry',()=>{const m=metadata();m[KEY].push({id:'rex',src:'Rex',dst:'렉스'});const n=planChatTerm(m,'Mina','mina','민아');assert.equal(n.length,2);assert.equal(m[KEY][0].dst,'미나');assert.equal(n.find(e=>e.src==='Rex').dst,'렉스');});
await test('rule bound permits replacement but refuses entry 101',()=>{const m={[KEY]:Array.from({length:100},(_,i)=>({id:String(i),src:'Name'+i,dst:'이름'+i}))};assert.throws(()=>planChatTerm(m,'Other','Other','다름'));assert.equal(planChatTerm(m,'Name0','Name0','새이름').length,100);});
await test('suggestion requires one existing destination/source match',()=>{assert.equal(proposeChatTerm([{src:'Mina',dst:'미나'}],'미나','Mina arrived'),'Mina');assert.equal(proposeChatTerm([{src:'Mina, Minah',dst:'미나'}],'미나','Mina met Minah'),'');assert.equal(proposeChatTerm([{src:'Mina',dst:'미나'}],'미나','Rex arrived'),'');});
await test('signature changes with destination but not timestamps',()=>{const a=metadata(),b=metadata();b[KEY][0].updated=123;assert.deepEqual(chatGlossarySignature(a),chatGlossarySignature(b));b[KEY][0].dst='민아';assert.notDeepEqual(chatGlossarySignature(a),chatGlossarySignature(b));});
function fixture(){
    const msg={mes:'Mina met Rex. Mina smiled.',name:'Narrator',swipe_id:0,extra:{display_text:'미나가 왔다. 미나가 웃었다.',original_text_hash:'hash',foreign:42}},meta={},ctx={chat:[msg],chatMetadata:meta,name1:'Reader',getCurrentChatId:()=> 'one',substituteParams:x=>x};
    let current=ctx,key='one',saved=0,refresh=0,closed=false,save=async()=>({confirmed:true}),raw=async()=>msg.extra.display_text;
    const hooks={rawTranslation:(...a)=>raw(...a),render:(_,text)=>text,hashOf:()=> 'hash',remember:(extra,_,text)=>extra.translation_source={t:text},syncSwipe(){},busy:()=>false,refresh:async()=>refresh++};
    const env=vm.createContext({JSON,structuredClone,Error,pickSame,CHAT_GLOSSARY_KEY:KEY,chatGlossaryEntries,planChatTerm,proposeChatTerm,context:()=>current,chatKey:()=>key,exclusive:fn=>fn(),captureGuard:()=>({assert(){},acceptDisplay(){}}),deleteHooks:()=>hooks,termHooks:()=>({entries:()=>[],changed(){},save:async job=>{saved++;return save(job);}})});
    vm.runInContext(source+'\nglobalThis.api={prepareTermMemory,applyTermMemory,undoTermMemory,prepareTermList,removeTermRule};',env);
    const screen=msg.extra.display_text,text='미나',at=screen.lastIndexOf(text);
    const selection={id:0,message:msg,text,mes:msg.mes,display:screen,swipe:0,chatKey:key,correction:{side:'translation',text,screen,ordinal:screenOrdinal(screen,at,text)}};
    return {msg,meta,ctx,hooks,api:env.api,selection,prepare:()=>env.api.prepareTermMemory(selection,()=>closed),navigate(){current={...ctx,chat:[],chatMetadata:{}};key='other';},close(){closed=true;},save(fn){save=fn;},raw(fn){raw=fn;},get saves(){return saved;},get refreshes(){return refresh;}};
}
await test('second repeated name is the only replaced occurrence; undo restores text and rule',async()=>{const f=fixture(),job=await f.prepare(),undo=await f.api.applyTermMemory(job,'Mina','민아');assert.equal(f.msg.extra.display_text,'미나가 왔다. 민아가 웃었다.');assert.equal(f.meta[KEY][0].dst,'민아');assert.equal(f.msg.extra.foreign,42);await f.api.undoTermMemory(undo);assert.equal(f.msg.extra.display_text,job.display);assert.equal(f.meta[KEY],undefined);});
await test('wrong side and changed visible context are rejected',async()=>{for(const mode of ['side','context']){const f=fixture();if(mode==='side')f.selection.correction.side='original';else f.selection.correction.screen='없는 문맥 미나';await assert.rejects(f.prepare());}});
await test('chat change during raw read cannot write',async()=>{const f=fixture();f.raw(async()=>{f.navigate();return '미나';});await assert.rejects(f.prepare());assert.equal(f.saves,0);});
await test('swipe changed before apply cannot write',async()=>{const f=fixture(),job=await f.prepare();f.msg.swipe_id=1;await assert.rejects(f.api.applyTermMemory(job,'Mina','민아'));assert.equal(f.saves,0);});
await test('dialog close before apply cannot write',async()=>{const f=fixture(),job=await f.prepare();f.close();await assert.rejects(f.api.applyTermMemory(job,'Mina','민아'));assert.equal(f.saves,0);});
await test('rule mutation before apply is not overwritten',async()=>{const f=fixture(),job=await f.prepare();f.meta[KEY]=metadata('Rex','렉스')[KEY];await assert.rejects(f.api.applyTermMemory(job,'Mina','민아'));assert.equal(f.meta[KEY][0].src,'Rex');});
await test('unknown save outcome retains edit and allows explicit undo',async()=>{const f=fixture(),job=await f.prepare();f.save(async()=>({confirmed:false}));const undo=await f.api.applyTermMemory(job,'Mina','민아');assert.equal(undo.saved.confirmed,false);assert.equal(f.meta[KEY][0].dst,'민아');await f.api.undoTermMemory(undo);assert.equal(f.msg.extra.display_text,job.display);});
await test('pre-save failure restores only owned exact state',async()=>{const f=fixture(),job=await f.prepare();f.save(async()=>{throw Error('not started');});await assert.rejects(f.api.applyTermMemory(job,'Mina','민아'));assert.equal(f.meta[KEY],undefined);assert.equal(f.msg.extra.display_text,job.display);});
await test('late navigation completes only captured chat and does not refresh new chat',async()=>{const f=fixture(),job=await f.prepare();f.save(async()=>{f.navigate();return {confirmed:true};});const undo=await f.api.applyTermMemory(job,'Mina','민아');assert.equal(f.refreshes,0);await assert.rejects(f.api.undoTermMemory(undo));});
await test('new manual edit or rule blocks undo',async()=>{for(const kind of ['text','rule']){const f=fixture(),job=await f.prepare(),undo=await f.api.applyTermMemory(job,'Mina','민아');if(kind==='text')f.msg.extra.display_text='새 수정';else f.meta[KEY][0].dst='새 표기';await assert.rejects(f.api.undoTermMemory(undo));}});
await test('list deletion preserves unrelated rule and permits repeated deletes',async()=>{const f=fixture();f.meta[KEY]=[...metadata()[KEY],...metadata('Rex','렉스')[KEY]];let job=f.api.prepareTermList(f.selection,()=>false);job=await f.api.removeTermRule(job,'mina');assert.equal(f.meta[KEY][0].src,'Rex');job=await f.api.removeTermRule(job,'rex');assert.equal(f.meta[KEY].length,0);});
await test('list deletion rejects another chat or concurrent rule change',async()=>{const f=fixture();f.meta[KEY]=metadata()[KEY];const job=f.api.prepareTermList(f.selection,()=>false);f.meta[KEY][0].dst='다름';await assert.rejects(f.api.removeTermRule(job,'mina'));});
function storage(group=false){const msg={mes:'Mina',swipe_id:0,extra:{display_text:'민아',foreign:1}},meta=metadata('Mina','민아');const ctx={groupId:group?'g':null,characterId:0,characters:[{name:'Example',avatar:'example.png'}],chat:[msg],chatMetadata:meta,getCurrentChatId:()=> 'captured',getRequestHeaders:()=>({'Content-Type':'application/json'})};return {msg,meta,ctx,job:{id:0,message:msg,metadata:meta,swipe:0}};}
await test('native save lane is used; only read endpoint is fetched',async()=>{for(const group of [false,true]){const f=storage(group),calls=[];let saved=false;f.ctx.saveChat=async()=>{saved=true;f.msg.extra.otherAddon=2;};globalThis.fetch=async(url,init)=>{calls.push(url);assert.equal(saved,true);const payload=JSON.parse(init.body);assert.equal(group?payload.id:payload.file_name,'captured');assert.equal(payload.chat,undefined);return {ok:true,json:async()=>[{chat_metadata:f.meta},f.msg]};};assert.equal((await saveTermChat(f.ctx,f.job)).confirmed,true);assert.deepEqual(calls,[group?'/api/chats/group/get':'/api/chats/get']);}});
await test('successful save followed by readback error is unknown without rollback',async()=>{const f=storage();f.ctx.saveChat=async()=>{};globalThis.fetch=async()=>{throw Error('offline');};assert.equal((await saveTermChat(f.ctx,f.job)).confirmed,false);assert.equal(f.msg.extra.display_text,'민아');});
await test('native save error is unknown and no read is required',async()=>{const f=storage();f.ctx.saveChat=async()=>{throw Error('offline');};globalThis.fetch=()=>assert.fail('no fetch');assert.equal((await saveTermChat(f.ctx,f.job)).confirmed,false);});
await test('readback mismatched owned fields reports unknown',async()=>{const f=storage();f.ctx.saveChat=async()=>{};globalThis.fetch=async()=>({ok:true,json:async()=>[{chat_metadata:{}},{...f.msg,extra:{display_text:'old'}}]});assert.equal((await saveTermChat(f.ctx,f.job)).confirmed,false);});
await test('navigation during native save still verifies original file',async()=>{const f=storage();f.ctx.saveChat=async()=>{f.ctx.getCurrentChatId=()=> 'other';f.ctx.characters[0].avatar='other.png';};globalThis.fetch=async(_,init)=>{assert.equal(JSON.parse(init.body).file_name,'captured');assert.equal(JSON.parse(init.body).avatar_url,'example.png');return {ok:true,json:async()=>[{chat_metadata:f.meta},f.msg]};};assert.equal((await saveTermChat(f.ctx,f.job)).confirmed,true);});
await test('never-settled readback times out as unknown and late response cannot mutate data',async()=>{
 const f=storage();f.ctx.saveChat=async()=>{};let release,signal;globalThis.fetch=(_,opts)=>{signal=opts.signal;return new Promise(r=>release=r);};
 const oldSet=globalThis.setTimeout,oldClear=globalThis.clearTimeout;let cleared=0;
 globalThis.setTimeout=fn=>{queueMicrotask(fn);return 123;};globalThis.clearTimeout=()=>cleared++;
 try{const before=JSON.stringify(f.msg);const result=await saveTermChat(f.ctx,f.job);assert.equal(result.confirmed,false);assert.equal(signal.aborted,true);release({ok:true,json:async()=>[{chat_metadata:f.meta},f.msg]});await Promise.resolve();assert.equal(JSON.stringify(f.msg),before);assert.equal(cleared,1);}finally{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear;}
});

const indexSource=fs.readFileSync(new URL('../../src/addons/translator/index.js',import.meta.url),'utf8');
const cut=name=>{const at=indexSource.search(new RegExp(`\\n(?:async )?function ${name}\\(`));return indexSource.slice(at+1,indexSource.indexOf('\n}',at+1)+2);};
await test('next translation prompt uses chat rule before character/global rules',()=>{
 let current={chatMetadata:metadata('Mina','민아')};const settings={glossary_enabled:true,glossary_entries:[{scope:'char',src:'Mina',dst:'미나'},{scope:'global',src:'Rex',dst:'렉스'}]};
 const env={getContext:()=>current,extensionSettings:settings,glossaryEntries:()=>settings.glossary_entries,glossaryScopeKeys:()=>['char'],chatGlossaryEntries,glossaryFold,glossaryAlternatives,glossaryLines,GLOSSARY_MAX_LINES:60};
 const api=new Function('env',`with(env){${cut('activeGlossaryEntries')}\n${cut('buildGlossaryBlock')}\nreturn{activeGlossaryEntries,buildGlossaryBlock};}`)(env);
 const block=api.buildGlossaryBlock('Mina met Rex.');assert.match(block,/민아/);assert.doesNotMatch(block,/미나/);assert.match(block,/렉스/);
 current={chatMetadata:{}};const other=api.buildGlossaryBlock('Mina met Rex.');assert.match(other,/미나/);assert.doesNotMatch(other,/민아/);
 settings.glossary_enabled=false;assert.equal(api.buildGlossaryBlock('Mina'), '');
});
await test('chat rule operations do not change user prompt settings',()=>{
 const memory=fs.readFileSync(new URL('../../src/addons/translator/selection/term-memory.js',import.meta.url),'utf8');
 assert.doesNotMatch(memory,/extension_settings|llm_prompt|saveSettings/);
});
await test('selection feedback targets only the shared footer status',()=>{
 const ui=fs.readFileSync(new URL('../../src/addons/translator/selection/ui.js',import.meta.url),'utf8');
 assert.match(ui,/function status\(box, message\) \{ if \(box.isConnected\) box.querySelector\('\.llmt-selection-status'\)/);
});
await test('request provenance is carried to both model-result cache paths',()=>{
 assert.match(indexSource,/options\.report\.requestMetadata = getContext\(\)\.chatMetadata/);
 assert.match(indexSource,/storeTranslationQuietly\(originalText, translation, report\)/);
 assert.match(indexSource,/storeTranslationQuietly\(originalText, retranslation, report\)/);
 assert.match(indexSource,/storeTranslationQuietly\(state.source, next, state\)/);
});
const add=indexSource.slice(indexSource.indexOf('async function addTranslationToDB('),indexSource.indexOf('// 모든 데이터 가져오기',indexSource.indexOf('async function addTranslationToDB('))),get=indexSource.slice(indexSource.indexOf('async function getTranslationFromDB('),indexSource.indexOf('// IndexedDB 삭제 함수',indexSource.indexOf('async function getTranslationFromDB(')));
function cacheRig(){let beforeRequest=()=>{};let ctx={chatMetadata:{}},resolveDB,writes=0,closes=0,lastRequest;const policy=createChatTermCachePolicy();const request=result=>{const r={result};lastRequest=r;queueMicrotask(()=>{beforeRequest();r.onsuccess?.({target:r})});return r};const db={close:()=>closes++,transaction:()=>({objectStore:()=>({index:()=>({getAll:()=>request([{translation:'옛 전역표기'}]),getAllKeys:()=>request([])}),add:()=>{writes++;return request(1)}})})};const open=()=>new Promise(r=>resolveDB=()=>r(db)),args=[()=>ctx,policy,open,{},'cache',()=>false,()=>false,()=>false,()=>true];const fn=new Function('getContext','chatTermCachePolicy','openDB','extensionSettings','STORE_NAME','hasFailMark','hasSourceEcho','looksLikeRefusal','matchesDisplayCardStructure',add+get+';return{addTranslationToDB,getTranslationFromDB};')(...args);return{ctx,policy,fn,beforeRequest:fn=>beforeRequest=fn,open:()=>resolveDB(),writes:()=>writes,closes:()=>closes};}
await test('write: context switch while database opens performs no transaction',async()=>{const r=cacheRig(),pending=r.fn.addTranslationToDB('x','번역');r.ctx.chatMetadata={};r.open();await pending;assert.equal(r.writes(),0);assert.equal(r.closes(),1)});
await test('write: same metadata gains chat rule while DB opens skips global write',async()=>{const r=cacheRig(),pending=r.fn.addTranslationToDB('x','번역');r.ctx.chatMetadata[KEY]=[{src:'x',dst:'새표기'}];r.open();await pending;assert.equal(r.writes(),0);assert.equal(r.closes(),1)});
await test('read: context switches to scoped B while database opens must not return global row',async()=>{const r=cacheRig(),pending=r.fn.getTranslationFromDB('x');r.ctx.chatMetadata={[KEY]:[{src:'x',dst:'새표기'}]};r.open();assert.equal(await pending,null)});
await test('read: same metadata gains new rule while database opens must not return global row',async()=>{const r=cacheRig(),pending=r.fn.getTranslationFromDB('x');r.ctx.chatMetadata[KEY]=[{src:'x',dst:'새표기'}];r.open();assert.equal(await pending,null)});
await test('read: rule appears after DB open but before getAll success',async()=>{const r=cacheRig();r.beforeRequest(()=>{r.ctx.chatMetadata[KEY]=[{src:'x',dst:'새표기'}]});const pending=r.fn.getTranslationFromDB('x');r.open();assert.equal(await pending,null)});
await test('write: rule appears before key lookup callback and prevents global insert',async()=>{const r=cacheRig();r.beforeRequest(()=>{r.ctx.chatMetadata[KEY]=[{src:'x',dst:'새표기'}]});const pending=r.fn.addTranslationToDB('x','번역');r.open();await pending;assert.equal(r.writes(),0)});

console.log(`${passed} checks passed`);
