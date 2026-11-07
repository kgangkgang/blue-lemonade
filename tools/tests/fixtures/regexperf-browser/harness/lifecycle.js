// 블루레몬의 연결 수명·측정 취소를 합성 채팅에서 확인해요.
import {script,useScripts,P} from './scenarios.js';
export async function cancellation(kind,at=1){
 const h=window.__h,addon=window.__addon;
 const messages=Array.from({length:30},(_,i)=>({mes:`alpha ${i}`,name:'합성 인물',is_user:false,is_system:false,extra:{}}));
 h.st.setState({chat:messages});
 await useScripts(h,[script({findRegex:'/alpha/g',replaceString:'A',markdownOnly:true})]);
 const saved=JSON.stringify(h.extension_settings.regex_perf_kit);
 let yields=0;
 Object.defineProperty(globalThis,'scheduler',{configurable:true,value:{yield:async()=>{
  yields++;if(yields!==at)return;
  if(kind==='off')addon.setRuntimeEnabled(false);
  if(kind==='chat')h.st.setState({chat:[{...messages[0],mes:'다른 채팅'}]});
  if(kind==='future')messages[25].mes='앞으로 읽을 편집';
  if(kind==='past')messages[0].mes='이미 읽은 편집';
  if(kind==='reasoning')messages[0].extra.reasoning='새 추론';
  if(kind==='author')messages[0].name='바뀐 화자';
  if(kind==='role')messages[0].is_user=true;
  if(kind==='system')messages[0].is_system=true;
  if(kind==='scripts'){h.extension_settings.regex[0].replaceString='B';addon.notifyScriptsChanged();}
  if(kind==='scriptsSilent')h.extension_settings.regex[0].replaceString='B';
  if(kind==='replace')messages[0]={...messages[0]};
  if(kind==='rename')h.st.setState({name2:'바뀐 인물'});
  if(kind==='cycle'){addon.setRuntimeEnabled(false);addon.setRuntimeEnabled(true);}
  if(kind==='stream'){h.st.setState({streamingProcessor:{messageId:0,isFinished:false,isStopped:false}});await h.eventSource.emit(h.event_types.GENERATION_STARTED,'normal',{},false);}
 }}});
 await h.commands.regexperf.callback({},'measure');
 const result=addon.regexPerfState().report.measured;
 delete globalThis.scheduler;
 return {result,yields,settingsSame:saved===JSON.stringify(h.extension_settings.regex_perf_kit),savedChats:h.st.counters.saveChat};
}
export async function lifecycle(){
 const h=window.__h,addon=window.__addon,provider=h.engine.RegexProvider.instance;
 await useScripts(h,[script({findRegex:'/alpha/g',replaceString:'A'})]);
 const initial=h.engine.getRegexedString('alpha',P.AI),old=provider.get('/alpha/g');
 addon.setRuntimeEnabled(false);
 const original=provider.get,off=h.engine.getRegexedString('alpha',P.AI);
 const oldOff='alpha'.replace(old,()=> '끄기 뒤');
 addon.setRuntimeEnabled(true);
 const oldOn='alpha'.replace(old,()=> '다시 켠 뒤');
 const ours=provider.get,other=function(pattern){return ours.call(this,pattern)};
 provider.get=other;
 const late=h.engine.getRegexedString('alpha',P.AI);
 const status=addon.regexPerfStatus();
 const yielded=provider.get===other;
 addon.setRuntimeEnabled(false);
 const preserved=provider.get===other;
 provider.get=original;
 const resumed=addon.setRuntimeEnabled(true);
 return {initial,off,oldOff,oldOn,late,status,yielded,preserved,resumed,final:h.engine.getRegexedString('alpha',P.AI)};
}
export async function scoped(){
 const h=window.__h;
 const global=script({id:'global',findRegex:'/x/g',replaceString:'G'});
 const preset=script({id:'preset',findRegex:'/G/g',replaceString:'P'});
 const character=script({id:'character',findRegex:'/P/g',replaceString:'C'});
 h.st.setState({this_chid:0,characters:[{avatar:'one.png',data:{extensions:{regex_scripts:[character]}}},{avatar:'two.png',data:{extensions:{regex_scripts:[{...character,replaceString:'D'}]}}}]});
 h.preset.scripts=[preset];
 h.extension_settings.character_allowed_regex=['one.png','two.png'];
 h.extension_settings.preset_allowed_regex={openai:['Default']};
 await useScripts(h,[global]);
 const out=[];const render=()=>{out.push(h.engine.getRegexedString('x',P.AI));};
 render();render();h.st.setState({this_chid:1});await h.eventSource.emit(h.event_types.CHAT_CHANGED);render();
 h.extension_settings.character_allowed_regex=[];await h.eventSource.emit(h.event_types.CHAT_CHANGED);render();
 h.extension_settings.preset_allowed_regex={};await h.eventSource.emit(h.event_types.CHAT_CHANGED);render();
 return out;
}
export async function measureRecovery(){
 const h=window.__h;
 h.st.setState({chat:[{mes:'alpha',name:'합성 인물',is_user:false,is_system:false,extra:{}}]});
 await useScripts(h,[script({findRegex:'/alpha/g',replaceString:'A',markdownOnly:true})]);
 const before=JSON.stringify(h.st.chat),settings=JSON.stringify(h.extension_settings.regex_perf_kit);
 const original=SillyTavern.getContext;
 SillyTavern.getContext=()=>({...original(),messageFormatting(){throw Error('의도한 서식 오류')}});
 let rejected=false;try{await h.commands.regexperf.callback({},'measure');}catch(e){rejected=e.message==='의도한 서식 오류';}
 SillyTavern.getContext=original;
 await h.commands.regexperf.callback({},'measure');
 const measured=window.__addon.regexPerfState().report.measured;
 return {rejected,measured,chatSame:before===JSON.stringify(h.st.chat),settingsSame:settings===JSON.stringify(h.extension_settings.regex_perf_kit)};
}
export async function swipes(){
 const h=window.__h;
 if(h.extension_settings.regex_perf_kit)h.extension_settings.regex_perf_kit.persist=true;
 const m={mes:'alpha',name:'합성 인물',is_user:false,is_system:false,extra:{},swipes:['alpha','beta'],swipe_id:0};
 h.st.setState({chat:[m]});
 await useScripts(h,[script({findRegex:'/alpha|beta/g',replaceString:'[$0]',markdownOnly:true})]);
 const out=[];const render=()=>out.push(h.st.messageFormatting(m.mes,m.name,false,false,0));
 render();render();m.mes=m.swipes[++m.swipe_id];await h.eventSource.emit(h.event_types.MESSAGE_SWIPED,0);render();
 m.mes='alpha beta';await h.eventSource.emit(h.event_types.MESSAGE_EDITED,0);render();
 m.mes=m.swipes[--m.swipe_id];await h.eventSource.emit(h.event_types.MESSAGE_SWIPED,0);render();
 return out;
}

// 검색어는 빈 결과 안내에서도 HTML 요소나 이벤트로 실행되지 않아야 해요.
export async function filterText(){
 const h=window.__h;
 const row=script({scriptName:'합성 규칙',findRegex:'/alpha/g',replaceString:'A'});
 await useScripts(h,[row]);h.engine.runRegexScript(row,'alpha');
 document.getElementById('rpk_refresh').click();
 const input=document.getElementById('rpk_filter'),cases=[];window.__rxinjected=0;
 for(const value of ['<b data-rx-html>안녕 & bye</b>','<img src=x onerror="window.__rxinjected=1">']){
  input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(r=>setTimeout(r,20));
  const cell=document.querySelector('#rpk_table .rpk-empty');
  cases.push({value,text:cell?.textContent,children:cell?.children.length,injected:window.__rxinjected});
 }
 return cases;
}
