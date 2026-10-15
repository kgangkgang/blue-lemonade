import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'), dir=path.join(root,'src/addons/translator');
const source=fs.readFileSync(process.argv[3]?path.resolve(process.argv[3]):path.join(dir,'index.js'),'utf8');
const card=await import(pathToFileURL(path.join(dir,'display-cards.js')));
const auto=await import(pathToFileURL(path.join(dir,'context-auto.js')));
const cardValueModule=await import(pathToFileURL(path.join(dir,'card-values.js')));
const seg=await import(pathToFileURL(path.join(dir,'translation-segments.js')));
const resume=await import(pathToFileURL(path.join(dir,'translation-resume.js')));
function cut(name){const re=new RegExp('\\n(?:export )?(?:async )?function '+name+'\\('),start=source.search(re);assert(start>=0,name);const chunk=source.slice(start+1,source.indexOf('\n}',start+1)+2);return chunk.replace(/^export /,'');}
const events=[],ctx={chatMetadata:{}}, S={llm_prompt_chat:'Translate visible text.',glossary_enabled:false,user_defined_regexes:[],user_no_fold_regexes:[],translation_display_mode:'folded'};
const env={...card,...seg,...resume,...auto,cardValues:cardValueModule.cardValues,getStringHash:t=>[...String(t)].reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0),extensionSettings:S,getContext:()=>ctx, guards:{capture:()=>({assert(){}})},connectionSignature:()=>'',watchGuard:()=>({check(){},close(){},signal:null}), document:{getElementById:()=>null},
    BLOCKED_CHUNK_MARK:'failed',MASK_PATTERN:'[[__VAR_{index}__]]',DEBUG_MODE:false,RULE_PROMPT_KEY:'rules',substituteCustomPlaceholders:x=>x,substituteParams:x=>x,buildGlossaryBlock:()=>'',checkpointKey:async x=>x,glossarySegmentSignature:x=>()=>x,textOutputLimit:()=>0,isTransientError:()=>false,failMarkOf:()=>"failed",splitForChunks:()=>[],CHUNK_TARGET:100000,
    looksLikeInputBlock:()=>false,looksLikeRefusal:()=>false,fallbackOf:()=>null,sameTarget:()=>false,getCustomModelName:()=>'',
    tidyKana:x=>x,tidyGlossaryOutput:(_s,x)=>x,linesToFix:()=>[],glossaryHanKeep:()=>[],glossaryNameKeep:()=>[],dropDanglingOpenQuote:x=>x,
    runtimeProtections:new Map(),console:{debug(){},info(){},warn(){},error(){}},dropProseStrayWords:seg.dropStrayWords,repairProseTagPairs:seg.repairTagPairs,dropProseLeftoverPlaceholders:seg.dropLeftoverPlaceholders,
    correctBackticks:x=>x,window:{},toastr:{},FOLD_MARKUP:/llm-translator-details|class="(?:translated|original)_text|llmt-para-gap/,
};
function install(name){if(!new RegExp('\\n(?:export )?(?:async )?function '+name+'\\(').test(source))return env[name];env[name]=new Function('env',`with(env){return (${cut(name)});}`)(env);return env[name];}
for(const name of ['compileUserPattern','runtimeRegexes','getCombinedRegexes','getNoFoldRegexes','protectedBlockRegexes','isProtectedBlock','withoutProtectedBlocks','fixMalformedPlaceholders','dropStrayWords','dropLeftoverPlaceholders','repairTagPairs','tidyGlossaryOutput','translate','applyIsolation','processTranslationText','analyzeStructure','extractPureText','renderTranslation','renderAllInOne','renderInterleaved','createDetailsTag','restoreContent'])install(name);
let reply=x=>x.replace(/Visible sentence/g,'보이는 문장').replace(/Sunny weather/g,'맑은 날씨').replace(/Quiet library/g,'조용한 도서관').replace(/English prose\./g,'한국어 본문.');
env.callLLMAPI=async prompt=>{events.push(prompt);return reply(prompt.replace(/^Translate visible text\.\n\n/,'').replace(seg.BATCH_HEADER,''))};
let checks=0;async function test(name,fn){await fn();checks++;console.log('PASS '+name)}
const status='<status_bar>\n日期：2026-10-15\n时间：Morning\n天气：Sunny weather\n地点：Quiet library\n题记：Visible sentence\n之间：Visible sentence\n</status_bar>';
const sourceText='English prose.\n\n'+status+'\n\nEnglish prose.';
await test('actual translate sends only visible card values and restores exact keys',async()=>{const result=await env.translate(sourceText);assert(!events.at(-1).includes('<status_bar>'));assert(!events.at(-1).includes('日期'));assert(result.includes('天气：맑은 날씨'));assert(result.includes('地点：조용한 도서관'));assert.equal(result,sourceText.replace(/English prose\./g,'한국어 본문.').replace(/Sunny weather/g,'맑은 날씨').replace(/Quiet library/g,'조용한 도서관').replace(/Visible sentence/g,'보이는 문장'));});
await test('paragraph cache translation restores fields and can reuse only unchanged value payloads',async()=>{await seg.clearSegmentCache();events.length=0;const result=await env.translate(sourceText,{segmentCache:true});assert(result.includes('天气：맑은 날씨'));assert.equal((result.match(/<status_bar>/g)||[]).length,1);const calls=events.length;assert(calls>0);assert.equal(await env.translate(sourceText,{segmentCache:true}),result);assert.equal(events.length,calls);});
await test('empty-value paragraph responses are not cached and a retry requests a fresh card',async()=>{await seg.clearSegmentCache();const good=reply;reply=x=>good(x).replace(/(\[\[__VAR_\d+__\]\])보이는 문장/g,'$1');await assert.rejects(env.translate(sourceText,{segmentCache:true}),e=>e.structuredCard);const before=events.length;reply=good;const out=await env.translate(sourceText,{segmentCache:true});assert(events.length>before);assert(out.includes('题记：보이는 문장'));});
await test('invalid card chunks are rejected before checkpointing and retry recovers',async()=>{await resume.clearCheckpoints();const good=reply,oldSplit=env.splitForChunks;env.CHUNK_TARGET=1;install('splitForChunks');reply=x=>good(x).replace(/(\[\[__VAR_\d+__\]\])보이는 문장/g,'$1');await assert.rejects(env.translate(sourceText),e=>e.structuredCard);const before=events.length;reply=good;const out=await env.translate(sourceText);assert(events.length>before);assert(out.includes('题记：보이는 문장'));env.CHUNK_TARGET=100000;env.splitForChunks=oldSplit;});
await test('explicit whole-card protection wins over the default translator',async()=>{S.user_defined_regexes=['/<status_bar>[\\s\\S]*?<\\/status_bar>/g'];const out=await env.translate(sourceText);assert(!events.at(-1).includes('Sunny weather'));assert(out.includes(status));S.user_defined_regexes=[]});
await test('user-protected value fragment stays local through card restoration',async()=>{S.user_defined_regexes=['/Quiet library/g'];const out=await env.translate(sourceText);assert(!events.at(-1).includes('Quiet library'));assert(out.includes('地点：Quiet library'));assert(out.includes('天气：맑은 날씨'));S.user_defined_regexes=[]});
await test('missing or repeated card field token fails before a result is returned',async()=>{const good=reply;for(const mutate of [x=>x.replace(/\[\[__VAR_\d+__\]\]/,''),x=>x.replace(/(\[\[__VAR_\d+__\]\])/,'$1$1')]){reply=x=>mutate(good(x));await assert.rejects(env.translate(sourceText),e=>e.structuredCard===true)}reply=good});
await test('correction workflow sends original/translated fields but restores one card',async()=>{const translated=sourceText.replace(/Sunny weather/g,'Old weather');const good=reply;reply=x=>good(x.split('\n\n[Translated Text]:\n')[0].replace(/^\[Original Text\]:\n/,''));const out=await env.translate('[Original Text]:\n'+sourceText+'\n\n[Translated Text]:\n'+translated,{isRetranslation:true,checkSource:sourceText});assert.equal((out.match(/<status_bar>/g)||[]).length,1);assert(out.includes('天气：맑은 날씨'));reply=good});
await test('late prose cleanup and tag repair preserve full card bytes',async()=>{const cardHtml='<snow><div>Visible sentence</div><style>\n.dash { content: "「"; }\n</style><script>\nValladolid\n</script></snow>';const text='한국어 문장이 충분히 길다.\n\nValladolid\n\n'+cardHtml;const cleaned=env.tidyGlossaryOutput('Original prose.',env.dropStrayWords(text,'Original prose.'));assert(cleaned.includes(cardHtml));assert(!cleaned.slice(0,cleaned.indexOf('<snow>')).includes('Valladolid'));assert(env.repairTagPairs('<span>Source</span>\n'+cardHtml,'<span>번역\n'+cardHtml).includes(cardHtml));assert(env.dropLeftoverPlaceholders(cardHtml,'source').includes(cardHtml));});
await test('known cards bypass processed-HTML rejection while unrelated HTML remains rejected',()=>{assert(!/<[a-z][\s\S]*>/i.test(env.withoutProtectedBlocks(sourceText)));assert(/<[a-z][\s\S]*>/i.test(env.withoutProtectedBlocks('<div>Other HTML</div>')))});
await test('all folded modes leave one translated card with no field wrappers',()=>{const translated=sourceText.replace(/Sunny weather/g,'맑은 날씨').replace(/English prose\./g,'한국어 본문.');const translatedCard=translated.slice(translated.indexOf('<status_bar>'),translated.indexOf('</status_bar>')+13);for(const mode of ['folded','unfolded','original_first']){S.translation_display_mode=mode;const out=env.processTranslationText(sourceText,translated);assert.equal((out.match(/<status_bar>/g)||[]).length,1,mode);assert(out.includes(translatedCard),mode);assert(!out.includes('__MASK_'),mode)}});

await test('old cache rows with changed card keys are skipped without deleting stored data',async()=>{
 const good=sourceText.replace(/Sunny weather/g,'맑은 날씨'),bad=good.replace('天气：','날씨：');
 const records=[{id:1,translation:good},{id:2,translation:bad}],before=JSON.stringify(records);
 env.STORE_NAME='test';env.openDB=async()=>({close(){},transaction(){return{objectStore(){return{index(){return{getAll(){const request={};queueMicrotask(()=>request.onsuccess({target:{result:structuredClone(records)}}));return request}}}}}}}});
 install('getTranslationFromDB');assert.equal(await env.getTranslationFromDB(sourceText),good);assert.equal(JSON.stringify(records),before);
 records.splice(0,1);assert.equal(await env.getTranslationFromDB(sourceText),null);assert.equal(records.length,1);
 records[0].translation=sourceText;assert.equal(await env.getTranslationFromDB(sourceText),sourceText,'structurally valid untranslated cards remain eligible');
});
await test('another-device and saved-swipe reuse require source card structure',async()=>{
 env.readCachedTranslation=async()=>null;env.originalHashOf=x=>x;env.substituteParams=x=>x;install('localOrDisplayedTranslation');install('hasCurrentSwipeTranslation');
 const good=sourceText.replace(/Sunny weather/g,'맑은 날씨'),message={mes:sourceText,name:'Synthetic',extra:{original_text_hash:sourceText,display_text:good}};
 assert.equal(await env.localOrDisplayedTranslation(message,sourceText),good);assert.equal(env.hasCurrentSwipeTranslation(message),true);
 message.extra.display_text=good.replace('天气：','날씨：');assert.equal(await env.localOrDisplayedTranslation(message,sourceText),null);assert.equal(env.hasCurrentSwipeTranslation(message),false);
 message.extra.translation_edited=sourceText;assert.equal(env.hasCurrentSwipeTranslation(message),true,'manual edits are not replaced automatically');
});

await test('newly escaped punctuation and script values remain reusable from the actual DB path',async()=>{
 const good=reply;reply=x=>x.replace(/Visible sentence/g,'"문장 & [말] | ${값} \\ 소리"');
 for(const original of ['<status_bar>\n题记：Visible sentence\n</status_bar>','<novel_header>[TITLE]Visible sentence</novel_header>','<角色状态面板><语录集><语录>Visible sentence</语录></语录集></角色状态面板>']){
   const translated=await env.translate(original);
   env.openDB=async()=>({close(){},transaction(){return{objectStore(){return{index(){return{getAll(){const request={};queueMicrotask(()=>request.onsuccess({target:{result:[{translation:translated}]}}));return request}}}}}}}});
   assert.equal(await env.getTranslationFromDB(original),translated,original);
 }
 reply=good;
});

await test('escaped display values can be corrected without field mismatch or double escaping',async()=>{
 const original='<status_bar>\n题记：Visible sentence\n</status_bar>',good=reply;
 reply=x=>x.replace('Visible sentence','안녕 & 친구');const translated=await env.translate(original);assert.equal(translated,original.replace('Visible sentence','안녕 &amp; 친구'));
 reply=x=>x.split('\n\n[Translated Text]:\n')[1];
 const corrected=await env.translate('[Original Text]:\n'+original+'\n\n[Translated Text]:\n'+translated,{isRetranslation:true,checkSource:original});
 assert.equal(corrected,translated);assert(!corrected.includes('&amp;amp;'));reply=good;
});
await test('CRLF source cards remain reusable after the normal LF combined-view render',async()=>{
 const original=sourceText.replace(/\n/g,'\r\n'),translated=original.replace(/Sunny weather/g,'맑은 날씨'),rawLF=translated.replace(/\r\n/g,'\n');
 env.openDB=async()=>({close(){},transaction(){return{objectStore(){return{index(){return{getAll(){const request={};queueMicrotask(()=>request.onsuccess({target:{result:[{translation:rawLF}]}}));return request}}}}}}}});
 assert.equal(await env.getTranslationFromDB(original),rawLF);
 S.translation_display_mode='folded';const display=env.processTranslationText(original,translated);
 assert(display.includes('<status_bar>\n'));assert(!display.includes('\r'));
 const message={mes:original,name:'Synthetic',extra:{original_text_hash:original,display_text:display}};
 assert.equal(env.hasCurrentSwipeTranslation(message),true);
});

await test('correction accepts equal protected values with different mask numbers without disclosure',async()=>{
 const original='<status_bar>\n地点：Quiet library\n题记：Visible sentence\n</status_bar>',translated=original.replace('Visible sentence','보이는 문장');
 const good=reply;S.user_defined_regexes=['/Quiet library/g'];reply=x=>x.split('\n\n[Translated Text]:\n')[1].replace('보이는 문장','새로 다듬은 문장');
 const out=await env.translate('[Original Text]:\n'+original+'\n\n[Translated Text]:\n'+translated,{isRetranslation:true,checkSource:original});
 assert.equal(out,translated.replace('보이는 문장','새로 다듬은 문장'));assert(!events.at(-1).includes('Quiet library'));assert(!out.includes('__VAR_'));S.user_defined_regexes=[];reply=good;
});
await test('correction rejects different protected values even if their token positions match',async()=>{
 const original='<status_bar>\n地点：Quiet library\n题记：Visible sentence\n</status_bar>',translated=original.replace('Quiet library','Other library').replace('Visible sentence','보이는 문장');
 const good=reply;S.user_defined_regexes=['/(?:Quiet|Other) library/g'];const before=events.length;
 await assert.rejects(env.translate('[Original Text]:\n'+original+'\n\n[Translated Text]:\n'+translated,{isRetranslation:true,checkSource:original}),e=>e.structuredCard===true);
 assert.equal(events.length,before,'different protected data rejected before a request');S.user_defined_regexes=[];reply=good;
});

await test('actual translate preserves auto placeholders until complete-request selection and versions its context cache signature',async()=>{
 const beforeSettings={...S},beforeCall=env.callLLMAPI,beforeKey=env.checkpointKey,beforeSub=env.substituteCustomPlaceholders;
 S.context_message_auto=true;S.context_exclude_last=true;S.context_include_user=false;S.llm_prompt_chat='Translate visible text.\nHistory {{llmContext}}\nEnd history.';
 Object.assign(ctx,{chatId:'auto-synthetic',mainApi:'openai',name1:'Reader',name2:'Character',chat:[{mes:'Earlier complete answer.',name:'Character',is_user:false},{mes:'Current body.',name:'Character',is_user:false}]});
 env.autoRequestSignature=()=> 'stable-model';install('substituteCustomPlaceholders');const keys=[],sent=[];
 env.checkpointKey=async value=>{keys.push(value);return value};
 env.callLLMAPI=async prompt=>{
   assert(auto.hasAutoContext(prompt));
   const payload=await auto.prepareTranslatorAutoContext({payload:{messages:[{role:'user',content:prompt}],max_tokens:100},getContext:()=>ctx,getSettings:()=>S,getConnection:env.autoRequestSignature,getMaxPromptTokens:()=>900,getMaxContextTokens:()=>1000,countTokensOpenAIAsync:async messages=>messages.reduce((n,m)=>n+4+m.content.split(/\s+/).length,0)});
   sent.push(payload);return '한국어 본문.';
 };
 assert.equal(await env.translate('English prose.'),'한국어 본문.');assert.equal(sent.length,1);
 assert(sent[0].messages[0].content.includes('Earlier complete answer.'));assert(!auto.hasAutoContext(sent[0].messages[0].content));
 assert(keys.some(value=>value.includes('auto-context-v1')&&value.includes('Earlier complete answer.')));
 Object.keys(S).forEach(key=>delete S[key]);Object.assign(S,beforeSettings);env.callLLMAPI=beforeCall;env.checkpointKey=beforeKey;env.substituteCustomPlaceholders=beforeSub;
});
await test('6.5.4 Korean target: fixed status values and remembered values are filled locally and never sent',async()=>{
 const beforeSettings={...S},beforeCall=env.callLLMAPI,box=new Map();
 globalThis.localStorage={getItem:k=>box.get(k)??null,setItem:(k,v)=>box.set(k,String(v))};cardValueModule.forgetCardValueMemory();await seg.clearSegmentCache();
 S.llm_prompt_chat='Translate visible text into Korean.';const sent=[];
 env.callLLMAPI=async prompt=>{sent.push(prompt);return reply(prompt.replace(/^Translate visible text into Korean\.\n\n/,'').replace(seg.BATCH_HEADER,''))};
 const korean=quote=>`English prose.\n\n<status_bar>\n日期：2026年10月15日 星期四\n时间：上午 07:15\n天气：晴 微风 19℃\n地点：Quiet library\n题记：${quote}\n之间：Visible sentence\n</status_bar>\n\nEnglish prose.`;
 const first=await env.translate(korean('Visible sentence'));
 assert(!sent.some(x=>/2026年|上午|晴 微风/.test(x)),'rule values never reach the model');assert(sent.some(x=>x.includes('Quiet library')));
 assert(first.includes('日期：2026년 10월 15일 목요일')&&first.includes('时间：오전 07:15')&&first.includes('天气：맑음 산들바람 19℃')&&first.includes('地点：조용한 도서관'));
 sent.length=0;const second=await env.translate(korean('English prose.'));
 assert(!sent.some(x=>x.includes('Quiet library')||x.includes('Visible sentence')),'values translated before stay local');assert(second.includes('地点：조용한 도서관')&&second.includes('之间：보이는 문장')&&second.includes('题记：한국어 본문.'));
 sent.length=0;await env.translate(korean('English prose.'),{isInputTranslation:true,prompt:'Translate visible text into Korean.'});
 assert(sent.some(x=>x.includes('2026年10月15日')),'input translation never uses the local values');
 sent.length=0;S.llm_prompt_chat='Translate visible text.';env.callLLMAPI=async prompt=>{sent.push(prompt);return reply(prompt.replace(/^Translate visible text\.\n\n/,'').replace(seg.BATCH_HEADER,''))};
 await env.translate(korean('English prose.'));assert(sent.some(x=>x.includes('上午 07:15')),'another target language sends everything');
 Object.keys(S).forEach(key=>delete S[key]);Object.assign(S,beforeSettings);env.callLLMAPI=beforeCall;delete globalThis.localStorage;cardValueModule.forgetCardValueMemory();
});
console.log(`${checks} translator card integration checks passed`);
