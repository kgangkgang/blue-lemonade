// Connection flow adapted from LLM Translator 2.1.6 (AGPL-3.0), 2026-09-24.
import { requestCurrentConnection } from './current-connection.js';
const cleanUrl=value=>String(value||'').trim().replace(/\/+$/,'');
export function customEndpoint(c,host) {
 const own=cleanUrl(c.customUrl);
 return {url:own||cleanUrl(host.custom_url),extras:!own};
}
export function applyCustomConnection(payload,c,host) {
 const {url,extras}=customEndpoint(c,host);
 if(!/^https?:\/\//i.test(url))throw Error('Custom 엔드포인트 주소를 확인해 주세요.');
 payload.custom_url=url;
 for(const key of ['custom_include_headers','custom_include_body','custom_exclude_body'])payload[key]=extras?(host[key]||''):'';
}
export async function requestActive({cfg,context,messages,inFlight,hostModules}) {
 const c=cfg(),controller=new AbortController();inFlight.add(controller);
 try {
  const {script,chat,text}=await hostModules();
  const result=await requestCurrentConnection({
   context,messages,maxTokens:c.activeMaxTokens||0,
   overrides:{signal:controller.signal,timeoutMs:c.requestTimeoutMs},
   buildChat:async(settings,input)=>(await chat.createGenerationParameters(settings,chat.getChatCompletionModel(settings),'quiet',input)).generate_data,
   buildText:(settings,input,limit)=>text.createTextGenGenerationData(settings,text.getTextGenModel(settings),script.createRawPrompt(input,'textgenerationwebui',false,false,'',''),limit||settings.max_new_tokens||2048,false,false,null,'quiet'),
  });
  return typeof result==='string'?result.trim():String(result?.content||result?.choices?.[0]?.message?.content||result?.results?.[0]?.text||'').trim();
 } finally {inFlight.delete(controller);}
}
export function bindConnection({doc,cfg,save,host,extensions,headers,refresh,models,escape}) {
 const by=id=>doc.getElementById(id);
 const status=message=>{by('pt-connection-status').textContent=message;};
 by('pt-connection-mode').value=cfg().connectionMode;
 by('pt-connection-mode').onchange=event=>{
  const c=cfg();c.connectionMode=event.target.value;
  if(c.provider==='__st_profile__'&&c.connectionMode!=='profile')c.provider='openai';
  by('pt-provider').value=c.provider;save();refresh();
 };
 by('pt-active-max').onchange=event=>{cfg().activeMaxTokens=Math.min(160000,Math.max(0,parseInt(event.target.value,10)||0));event.target.value=cfg().activeMaxTokens;save();};
 by('pt-custom-url').oninput=event=>{cfg().customUrl=cleanUrl(event.target.value);save();refresh();};
 by('pt-fetch-models').onclick=async()=>{
  const button=by('pt-fetch-models'),c=cfg(),config=customEndpoint(c,host);
  const target=by('pt-models-status');
  if(!/^https?:\/\//i.test(config.url)){target.textContent='주소를 먼저 입력해 주세요.';return;}
  button.disabled=true;target.textContent='모델 목록을 불러오는 중…';
  try {
   const response=await fetch('/api/backends/chat-completions/status',{method:'POST',headers:headers(),body:JSON.stringify({chat_completion_source:'custom',custom_url:config.url,custom_include_headers:config.extras?(host.custom_include_headers||''):''}),signal:AbortSignal.timeout(30000)});
   if(!response.ok)throw Error(`서버 응답 ${response.status}`);
   const data=await response.json();const rows=Array.isArray(data)?data:(data.data||data.models);
   if(!Array.isArray(rows))throw Error('모델 목록 형식이 올바르지 않아요.');
   const ids=[...new Set(rows.map(r=>typeof r==='string'?r:r?.id||r?.name).filter(v=>typeof v==='string'&&v.length<300))].sort();
   c.customModelLists={...(c.customModelLists||{}),[config.url]:ids};
   // Retain only recent endpoint lists, as in the LLM extension.
   c.customModelLists=Object.fromEntries(Object.entries(c.customModelLists).slice(-3));save();
   if(customEndpoint(cfg(),host).url===config.url){refresh();target.textContent=`모델 ${ids.length}개를 불러왔어요.`;}
  }catch(error){target.textContent=`목록을 불러오지 못했어요. ${error.message}`;}
  finally{button.disabled=false;}
 };
 by('pt-import-llm').onclick=()=>{
  const source=extensions['llm-translator-custom'];
  if(!source){status('저장된 LLM 번역 설정이 없어요. 현재 연결 따라가기를 사용할 수 있어요.');return;}
  const c=cfg(),provider=source.llm_provider||'openai';
  c.connectionMode=source.connection_mode==='direct'?'direct':'current';
  c.provider=provider;c.activeMaxTokens=source.profile_max_tokens||0;
  const raw=source.llm_model==='custom'?(source.custom_models?.[provider]||source.custom_model||''):(source.llm_model||'');
  c.model=(models[provider]||[]).includes(raw)?raw:'__custom__';c.customModelName=raw;
  c.customUrl=source.custom_url||'';
  c.useReverseProxy=!!source.use_reverse_proxy;c.reverseProxyUrl=source.reverse_proxy_url||'';c.reverseProxyPassword=source.reverse_proxy_password||'';
  if(source.parameters?.[provider])c.parameters[provider]={...source.parameters[provider]};
  for(const [id,value] of Object.entries({'pt-provider':c.provider,'pt-connection-mode':c.connectionMode,'pt-active-max':c.activeMaxTokens,'pt-custom-url':c.customUrl,'pt-model-custom':c.customModelName,'pt-proxy-url':c.reverseProxyUrl,'pt-proxy-pw':c.reverseProxyPassword}))by(id).value=value;
  by('pt-use-proxy').checked=c.useReverseProxy;save();refresh();
  status('LLM 번역의 연결·모델·생성 설정을 가져왔어요. 이후 변경은 이 패널에만 저장돼요.');
 };
}
