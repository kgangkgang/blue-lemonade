// Connection flow adapted from LLM Translator 2.1.6 (AGPL-3.0), 2026-09-24.
// 2026-10-07: 모델 목록은 공용 live-models.js (공급자가 지금 주는 목록 · 하루 캐시 · 새것 먼저) · 공급자별로 고른 모델 기억 · 모델별 요청 규칙
import { requestCurrentConnection } from './current-connection.js';
import * as LM from '../../live-models.js';
const cleanUrl=value=>String(value||'').trim().replace(/\/+$/,'');
const ST_PROFILE='__st_profile__',CUSTOM='__custom__';
const isObj=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function customEndpoint(c,host) {
 const own=cleanUrl(c.customUrl);
 return {url:own||cleanUrl(host?.custom_url),extras:!own};
}
export function applyCustomConnection(payload,c,host) {
 const {url,extras}=customEndpoint(c,host);
 if(!/^https?:\/\//i.test(url))throw Error('Custom 엔드포인트 주소를 확인해 주세요.');
 payload.custom_url=url;
 for(const key of ['custom_include_headers','custom_include_body','custom_exclude_body'])payload[key]=extras?(host[key]||''):'';
}
/**
 * 「실리태번 API 중 선택」 요청 본문. 예전 index.js runCompletionOnce 와 같은 순서 · 같은 값이고, 맨 끝(재번역 tweak 뒤)에 공용 모델별 요청 규칙만 더했다.
 * 규칙에 걸리지 않는 모델은 예전과 글자까지 같다 — tools/tests/prompt-models.mjs
 */
export function directParameters({c,source,model,messages,params,providerParams,host,tweak}) {
 const parameters={model,messages,stream:false,chat_completion_source:source,...providerParams};
 if(source==='vertexai') {
  // Read Vertex auth mode and region from ST's main API settings (oai_settings).
  // Hardcoding 'full' breaks users whose ST is configured in 'express' mode,
  // and missing region/project_id causes 404 on certain models.
  parameters.vertexai_auth_mode=host?.vertexai_auth_mode||'full';
  const region=host?.vertexai_region;
  if(region)parameters.vertexai_region=region;
  if(parameters.vertexai_auth_mode==='express'&&host?.vertexai_express_project_id)parameters.vertexai_express_project_id=host.vertexai_express_project_id;
 }
 if(source==='custom')applyCustomConnection(parameters,c,host);
 if(source!=='custom'&&c.useReverseProxy&&c.reverseProxyUrl?.trim()) {
  parameters.reverse_proxy=c.reverseProxyUrl.trim();
  parameters.proxy_password=c.reverseProxyPassword||'';
 }
 if(typeof tweak==='function')tweak(parameters,params,providerParams);
 // o 시리즈 · GPT-5 이후 · Claude 5 이후는 샘플링 값을 거부한다 (실리태번 본체 화면이 자기 요청에 하는 것과 같음 — 번역기 · 다시 쓰기 · TTS 와 한 벌)
 LM.applyModelRequestRules(source,model,parameters);
 return parameters;
}

// ── 모델 목록 (live-models: 받은 목록 → 없으면 모델 등록 · 테마가 아는 최신 · 실리태번 화면 목록)
/** 이 공급자 목록의 캐시 키 (목록이 바뀌었다는 알림이 이 화면 것인지 볼 때) */
export function modelListKey(c,host,prov=c.provider||'openai') {
 const source=LM.sourceOf(prov);
 return LM.cacheKey(source,source==='custom'?customEndpoint(c,host).url:undefined);
}
/** 고를 모델 → { ids, savedMissing, live, at, key, source }. 저장된 모델은 바꾸지 않는다 (목록에 없으면 savedMissing) */
export function modelChoices(c,host,prov=c.provider||'openai') {
 const source=LM.sourceOf(prov);
 const saved=prov===c.provider&&c.model!==CUSTOM?(c.model||''):'';
 const listed=source==='custom'?LM.list('custom',{saved,customUrl:customEndpoint(c,host).url}):LM.list(source,{saved});
 return {...listed,source};
}
export const canListModels=c=>LM.canList(LM.sourceOf(c.provider||'openai'));
/** 모델 칸을 채운다: 저장된 모델은 늘 보이고 골라 둔 채 (목록에 없으면 '(이전 목록)' · Custom 주소 목록에 없으면 '(이 주소 목록에 없음)'), 맨 끝은 커스텀 모델 입력 */
export function renderModelSelect(select,c,host) {
 const choices=modelChoices(c,host),custom=c.model===CUSTOM;
 LM.fillSelect(select,choices.ids,{saved:custom?'':(c.model||''),missingSuffix:choices.source==='custom'&&choices.ids.length?' (이 주소 목록에 없음)':' (이전 목록)',
  placeholder:'모델 선택...',customValue:CUSTOM,customLabel:'커스텀 모델 입력',customSelected:custom});
 const want=custom?CUSTOM:(c.model||'');
 if(select.value!==want)select.value=want;
 return choices;
}
/** 목록이 바뀌면 cb({ key, source }) — 그만 들으려면 돌려준 함수 */
export const watchModelLists=cb=>LM.onChange(cb);
/**
 * 조용히 다시 받기 — 설정의 연결 화면을 열 때 · 공급자를 바꿀 때만 (페이지를 열 때는 안 함). 하루 지난 목록 · 키가 있을 때만, 실패해도 예전 목록 그대로.
 * Custom 은 이 패널에 저장된 주소(없으면 본체 주소)
 */
export function autoListModels(c,host) {
 if(c.connectionMode!=='direct'||!c.provider||c.provider===ST_PROFILE)return Promise.resolve(null);
 const source=LM.sourceOf(c.provider);
 if(source!=='custom')return LM.autoRefresh(source,{inheritProxy:false});  // 5.7.1 이 패널은 본체 리버스 프록시로 보내지 않는다 — 목록도 직접
 const {url,extras}=customEndpoint(c,host);
 // 5.7.1 이 주소로 받아 본 적이 있을 때만 저절로 (방금 친 · 오타 난 주소로 실리태번이 저장된 키를 보내지 않게 — 처음은 ↻ 로)
 return LM.autoRefresh('custom',{customUrl:url,inheritCustom:extras,savedUrl:LM.cached(LM.cacheKey('custom',url)).ids.length>0});
}

// ── 공급자별로 고른 모델 기억 (c.models[공급자] · 커스텀 모델 입력은 c.customModels[공급자]) — 공급자를 바꿨다 돌아와도 쓰던 모델 그대로
/** 지금 공급자의 모델을 기억에 적는다. cfg() 가 부를 때마다 — 모델 전환 · 설정 가져오기가 c.model 을 바로 바꿔도 따라간다 */
export function syncModelMemory(c) {
 if(!isObj(c.models))c.models={};
 const prov=c.provider;
 if(!prov||prov===ST_PROFILE)return;
 const model=c.model||'';
 if(c.models[prov]!==model)c.models[prov]=model;
 if(model===CUSTOM) {
  if(!isObj(c.customModels))c.customModels={};
  const name=c.customModelName||'';
  if(c.customModels[prov]!==name)c.customModels[prov]=name;
 }
}
/** 공급자를 바꾼 뒤 (c.provider 는 이미 새 공급자): 그 공급자에서 쓰던 모델로. 처음 고르는 공급자면 목록 맨 앞 (예전: 늘 고정 목록의 첫 모델로 덮어씀) */
export function restoreModel(c,host) {
 const prov=c.provider;
 if(!prov||prov===ST_PROFILE)return;
 const remembered=isObj(c.models)?c.models[prov]:undefined;
 if(typeof remembered==='string'&&remembered) {
  c.model=remembered;
  if(remembered===CUSTOM&&isObj(c.customModels)&&typeof c.customModels[prov]==='string')c.customModelName=c.customModels[prov];
 } else c.model=modelChoices(c,host,prov).ids[0]||'';
 syncModelMemory(c);
}
export async function requestActive({cfg,context,messages,inFlight,hostModules}) {
 const c=cfg(),controller=new AbortController();inFlight.add(controller);
 try {
  const {script,chat,text}=await hostModules();
  const result=await requestCurrentConnection({
   context,messages,maxTokens:c.activeMaxTokens||0,
   overrides:{signal:controller.signal,timeoutMs:c.requestTimeoutMs},
   buildChat:async(settings,input)=>(await chat.createGenerationParameters(settings,chat.getChatCompletionModel(settings),'quiet',input)).generate_data,
   // 2026-10-06: 텍스트 완성 출력 한도가 실리태번 응답 길이(amount_gen)를 따른다 (2048 아래로는 안 줄임) — 전엔 늘 2048이라 긴 번역이 잘렸다
   buildText:(settings,input,limit)=>text.createTextGenGenerationData(settings,text.getTextGenModel(settings),script.createRawPrompt(input,'textgenerationwebui',false,false,'',''),limit||settings.max_new_tokens||Math.max(Number(script.amount_gen)||0,2048),false,false,null,'quiet'),
  });
  return typeof result==='string'?result.trim():String(result?.content||result?.choices?.[0]?.message?.content||result?.results?.[0]?.text||'').trim();
 } finally {inFlight.delete(controller);}
}
export function bindConnection({doc,cfg,save,host,extensions,refresh}) {
 const by=id=>doc.getElementById(id);
 const status=message=>{by('pt-connection-status').textContent=message;};
 const listNote=message=>{const target=by('pt-models-status');target.textContent=message;target.hidden=!message;};
 by('pt-connection-mode').value=cfg().connectionMode;
 by('pt-connection-mode').onchange=event=>{
  const c=cfg();c.connectionMode=event.target.value;
  if(c.provider==='__st_profile__'&&c.connectionMode!=='profile')c.provider='openai';
  by('pt-provider').value=c.provider;save();refresh();
  autoListModels(c,host);
 };
 by('pt-active-max').onchange=event=>{cfg().activeMaxTokens=Math.min(160000,Math.max(0,parseInt(event.target.value,10)||0));event.target.value=cfg().activeMaxTokens;save();};
 by('pt-custom-url').oninput=event=>{cfg().customUrl=cleanUrl(event.target.value);save();refresh();};
 // ↻: 지금 공급자의 목록을 바로 받는다 (실리태번 서버 /status — 키는 서버가 붙임). 받은 목록은 이 브라우저에만 하루 둔다 (settings.json 에는 안 씀)
 by('pt-fetch-models').onclick=async()=>{
  const button=by('pt-fetch-models'),c=cfg(),source=LM.sourceOf(c.provider||'openai'),key=modelListKey(c,host);
  let options={inheritProxy:false};
  if(source==='custom') {
   const config=customEndpoint(c,host);
   if(!/^https?:\/\//i.test(config.url)){listNote('주소를 먼저 입력해 주세요.');return;}
   options={customUrl:config.url,inheritCustom:config.extras,inheritProxy:false};
  }
  button.disabled=true;listNote('모델 목록을 불러오는 중…');
  try {
   const ids=await LM.refresh(source,options);
   if(modelListKey(cfg(),host)===key){refresh();listNote(`모델 ${ids.length}개를 불러왔어요.`);}
   else listNote('');
  }catch(error){listNote(`목록을 불러오지 못했어요. ${error.message}`);}
  finally{button.disabled=false;}
 };
 by('pt-import-llm').onclick=()=>{
  const source=extensions['llm-translator-custom'];
  if(!source){status('저장된 LLM 번역 설정이 없어요. 현재 연결 따라가기를 사용할 수 있어요.');return;}
  const c=cfg(),provider=source.llm_provider||'openai';
  c.connectionMode=source.connection_mode==='direct'?'direct':'current';
  c.provider=provider;c.activeMaxTokens=source.profile_max_tokens||0;
  const raw=source.llm_model==='custom'?(source.custom_models?.[provider]||source.custom_model||''):(source.llm_model||'');
  c.customUrl=source.custom_url||'';
  // 목록(받은 목록 · 모델 등록 · 테마가 아는 최신 · 실리태번 화면 목록)에 있으면 그대로 고르고, 없으면 커스텀 모델 입력에 넣는다
  c.model=raw&&modelChoices(c,host,provider).ids.includes(raw)?raw:CUSTOM;c.customModelName=raw;
  syncModelMemory(c);
  c.useReverseProxy=!!source.use_reverse_proxy;c.reverseProxyUrl=source.reverse_proxy_url||'';c.reverseProxyPassword=source.reverse_proxy_password||'';
  if(source.parameters?.[provider])c.parameters[provider]={...source.parameters[provider]};
  for(const [id,value] of Object.entries({'pt-provider':c.provider,'pt-connection-mode':c.connectionMode,'pt-active-max':c.activeMaxTokens,'pt-custom-url':c.customUrl,'pt-model-custom':c.customModelName,'pt-proxy-url':c.reverseProxyUrl,'pt-proxy-pw':c.reverseProxyPassword}))by(id).value=value;
  by('pt-use-proxy').checked=c.useReverseProxy;save();refresh();
  status('LLM 번역의 연결·모델·생성 설정을 가져왔어요. 이후 변경은 이 패널에만 저장돼요.');
 };
}
