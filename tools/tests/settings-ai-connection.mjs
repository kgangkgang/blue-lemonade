// 실제 회사 API는 호출하지 않고 요청·중단·선택 UI를 확인해요.
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),load=f=>import(pathToFileURL(path.join(root,f)));
const M=await load('src/settings-ai-connection.js');
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log('통과: '+name);};
const messages=[{role:'system',content:'설정 목록만 읽어요.'},{role:'user',content:'글씨를 크게 해 주세요.'}];
const config=(provider,model='example-model')=>({provider,models:{[provider]:model},customModels:{},customUrl:''});
const host={chat_completion_source:'makersuite',model:'host-model',reverse_proxy:'https://unused.invalid',proxy_password:'가짜 프록시 값',custom_url:'https://host.invalid/v1',custom_include_headers:'X-Test: host',custom_include_body:'host: true',custom_exclude_body:'unused',vertexai_auth_mode:'express',vertexai_region:'global',vertexai_express_project_id:'test-project'};
await test('8개 회사의 요청은 선택한 회사·모델·설정 문장만 사용하고 호스트를 바꾸지 않아요',()=>{
 const original=structuredClone(host),input=structuredClone(messages);
 assert.equal(Object.keys(M.PROVIDERS).length,8);
 for(const [id,p]of Object.entries(M.PROVIDERS)){
  const c=config(id),body=M.buildDirectPayload(messages,c,host);
  assert.equal(body.chat_completion_source,p.source);assert.equal(body.model,'example-model');assert.equal(body.stream,false);
  assert.deepEqual(body.messages,messages);assert.notEqual(body.messages,messages);
  assert.ok(!('reverse_proxy'in body)&&!('proxy_password'in body)&&!('api_key'in body));
  assert.deepEqual(c,config(id));
 }
 assert.deepEqual(host,original);assert.deepEqual(messages,input);
});
await test('생각 모델의 요청 규칙은 공용 규칙을 따르고 일반 모델의 출력 한도는 유지해요',()=>{
 const normal=M.buildDirectPayload(messages,config('openai','gpt-4o'),host);
 assert.equal(normal.max_tokens,800);assert.ok(!('max_completion_tokens'in normal));
 const thinking=M.buildDirectPayload(messages,config('openai','o3-mini'),host);
 assert.equal(thinking.max_completion_tokens,8192);assert.ok(!('max_tokens'in thinking));
 const routed=M.buildDirectPayload(messages,config('openrouter','openai/o3-mini'),host);
 assert.equal(routed.max_tokens,8192);assert.ok(!('max_completion_tokens'in routed));
 assert.equal(M.buildDirectPayload(messages,config('claude','claude-opus-5'),host).max_tokens,8192);
});
await test('Vertex Express와 Full의 인증 방식·지역을 보존해요',()=>{
 const a=M.buildDirectPayload(messages,config('vertexai'),host);
 assert.equal(a.vertexai_auth_mode,'express');assert.equal(a.vertexai_region,'global');assert.equal(a.vertexai_express_project_id,'test-project');
 const b=M.buildDirectPayload(messages,config('vertexai'),{...host,vertexai_auth_mode:'full'});
 assert.equal(b.vertexai_auth_mode,'full');assert.ok(!('vertexai_express_project_id'in b));
});
await test('다른 Custom 주소에는 호스트의 추가 헤더·본문을 보내지 않아요',()=>{
 const c=config('custom','custom');c.customModels.custom='typed-model';c.customUrl=' https://other.invalid/v1/ ';
 const own=M.buildDirectPayload(messages,c,host);
 assert.equal(own.model,'typed-model');assert.equal(own.custom_url,'https://other.invalid/v1');
 for(const k of ['custom_include_headers','custom_include_body','custom_exclude_body'])assert.equal(own[k],'');
 c.customUrl='';const inherited=M.buildDirectPayload(messages,c,host);
 assert.equal(inherited.custom_url,host.custom_url);assert.equal(inherited.custom_include_headers,host.custom_include_headers);
 assert.throws(()=>M.buildDirectPayload(messages,{...c,customUrl:'file:///private'},host),/주소/);
});
let calls=0;
const ctx={getRequestHeaders:()=>({'X-CSRF-Token':'합성 토큰'}),chatCompletionSettings:host};
const ok=async(url,opts)=>{calls++;assert.equal(url,'/api/backends/chat-completions/generate');assert.equal(opts.headers['X-CSRF-Token'],'합성 토큰');return{ok:true,json:async()=>({choices:[{message:{content:'{"changes":[]}'},finish_reason:'stop'}]})};};
await test('미지원 회사·빈 모델·사전 취소는 실제 요청을 만들지 않아요',async()=>{
 for(const c of [config('missing'),config('constructor'),config('openai',''),{provider:'openai',models:{openai:{bad:true}}}])await assert.rejects(M.sendSettingsAiDirect(messages,{connection:c,ctx,fetcher:ok}));
 const ac=new AbortController();ac.abort();await assert.rejects(M.sendSettingsAiDirect(messages,{connection:config('google'),ctx,fetcher:ok,signal:ac.signal}));
 assert.equal(calls,0);
});
await test('성공 응답은 JSON 문장으로 돌리고 호스트 설정을 쓰지 않아요',async()=>{
 const before=structuredClone(host);
 assert.equal(await M.sendSettingsAiDirect(messages,{connection:config('google'),ctx,fetcher:ok}),'{"changes":[]}');
 assert.equal(calls,1);assert.deepEqual(host,before);
});
await test('HTTP 오류·차단·잘린 출력은 불완전한 변경으로 적용하지 않아요',async()=>{
 await assert.rejects(M.sendSettingsAiDirect(messages,{connection:config('google'),ctx,fetcher:async()=>({ok:false,status:401})}),/HTTP 401/);
 for(const reason of ['length','content_filter'])await assert.rejects(M.sendSettingsAiDirect(messages,{connection:config('google'),ctx,fetcher:async()=>({ok:true,json:async()=>({choices:[{message:{content:'{"changes":[]}'},finish_reason:reason}]})})}));
});
await test('진행 중 취소와 시간 초과가 요청 신호를 끊어요',async()=>{
 const ac=new AbortController();let started;
 const ready=new Promise(r=>started=r);
 const fetcher=async(_url,{signal})=>new Promise((_resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});started();});
 const job=M.sendSettingsAiDirect(messages,{connection:config('google'),ctx,fetcher,signal:ac.signal});await ready;ac.abort();await assert.rejects(job,/멈췄어요/);
 const original=globalThis.setTimeout,clear=globalThis.clearTimeout;let cleaned=false;
 globalThis.setTimeout=fn=>{queueMicrotask(fn);return 7};globalThis.clearTimeout=()=>{cleaned=true};
 try{await assert.rejects(M.sendSettingsAiDirect(messages,{connection:config('google'),ctx,fetcher}),/90초/);assert.equal(cleaned,true);}
 finally{globalThis.setTimeout=original;globalThis.clearTimeout=clear;}
});

// UI 모델 목록은 가짜 공급자에만 요청해요. 가짜 DOM의 선택 값 갱신만 보완해요.
const {installBrowser}=await import('./leak-dom.mjs');installBrowser();
globalThis.SillyTavern={getContext:()=>({...ctx,ConnectionManagerRequestService:{getSupportedProfiles:()=>[{id:'old:/profile',name:'기존 <프로필>'}]}})};
let cfg={on:true,profileId:'old:/profile',provider:'custom',models:{custom:'custom',openai:'remembered'},customModels:{custom:'saved-typed'},customUrl:''};
const slot=document.createElement('div');document.body.append(slot);
let listener,stopped=false,filled=0,resolveList;
const models={fillSelect:(select,ids,opts)=>{filled++;select.value=opts.customSelected?opts.customValue:opts.saved;select._ids=ids;},onChange:fn=>{listener=fn;return()=>{stopped=true;listener=null;}}};
const providers={normalizeUrl:v=>String(v).trim().replace(/\/+$/,''),listKey:(id,ep)=>id==='custom'?id+':'+ep.url:id,modelChoices:()=>({ids:['listed']}),canFetch:()=>true,fetchModelList:()=>new Promise(r=>resolveList=r)};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stop=M.mountSettingsAiConnection(slot,{read:()=>cfg,write:fn=>fn(cfg),esc,stack:(label,html)=>`<label><span>${esc(label)}</span>${html}</label>`,models,providers});
const change=(selector,value)=>{const e=slot.querySelector(selector);assert.ok(e,selector);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));};
await test('목록 알림은 현재 회사의 선택지만 갱신하고 입력 중인 주소·모델명을 보존해요',()=>{
 const input=slot.querySelector('[data-search-ai-custom-model]'),url=slot.querySelector('[data-search-ai-url]');input.value='아직 저장하지 않은 모델';url.value='https://draft.invalid/v1';
 const count=filled;listener({key:'other'});assert.equal(filled,count);
 listener({key:'custom:https://host.invalid/v1'});assert.equal(filled,count+1);
 assert.equal(slot.querySelector('[data-search-ai-custom-model]'),input);assert.equal(input.value,'아직 저장하지 않은 모델');assert.equal(url.value,'https://draft.invalid/v1');
 assert.equal(cfg.customModels.custom,'saved-typed');
});
await test('늦은 목록 응답이 다른 회사 선택과 저장된 모델을 덮지 않아요',async()=>{
 slot.querySelector('[data-search-ai-refresh]').click();
 change('[data-search-ai-connection-choice]','api:openai');assert.equal(slot.querySelector('[data-search-ai-model]').value,'remembered');
 resolveList(['old-custom']);await Promise.resolve();await Promise.resolve();
 assert.equal(cfg.provider,'openai');assert.equal(slot.querySelector('[data-search-ai-model]').value,'remembered');assert.equal(slot.querySelector('[data-search-ai-connection-status]').textContent,'');
 change('[data-search-ai-connection-choice]','profile:'+encodeURIComponent('old:/profile'));assert.equal(cfg.provider,'');assert.equal(cfg.profileId,'old:/profile');
 change('[data-search-ai-connection-choice]','api:custom');assert.equal(slot.querySelector('[data-search-ai-custom-model]').value,'saved-typed');
 change('[data-search-ai-connection-choice]','');assert.equal(cfg.profileId,'');assert.equal(cfg.provider,'');
});
await test('입력 저장은 칸을 다시 만들지 않고, 해제 뒤에는 늦은 응답도 그리지 않아요',async()=>{
 change('[data-search-ai-connection-choice]','api:custom');
 const input=slot.querySelector('[data-search-ai-custom-model]');change('[data-search-ai-custom-model]',' typed-new ');assert.equal(cfg.customModels.custom,'typed-new');assert.equal(slot.querySelector('[data-search-ai-custom-model]'),input);
 slot.querySelector('[data-search-ai-refresh]').click();const html=slot.innerHTML;stop();assert.equal(stopped,true);resolveList(['ignored']);await Promise.resolve();await Promise.resolve();assert.equal(slot.innerHTML,html);
});
console.log(`AI 설정 연결: ${passed}개를 통과했어요.`);
