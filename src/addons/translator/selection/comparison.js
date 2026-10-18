import { adapter,context,chatKey,exclusive,deleteHooks,termHooks,captureGuard } from './state.js';
import { prepareTranslation,assertTranslationAlive } from './translation.js';
export const COMPARISON_MODES = [
 {id:'natural',label:'자연스럽게',guidance:'Translate naturally and fluently in Korean. Preserve every fact, intent, and paragraph boundary; do not add or omit information.'},
 {id:'close',label:'원문 가깝게',guidance:'Stay close to the original phrasing, detail and sentence order while keeping grammatical Korean. Preserve every fact and paragraph boundary; do not summarize.'},
 {id:'voice',label:'말투 강조',guidance:'Focus on the original speaker voice and register, following the explicit character speech preferences when attribution is clear. Do not infer new relationships or exaggerate emotion. Preserve facts and paragraph boundaries.'},
];
const cancelled=()=>Object.assign(Error('후보 만들기를 멈췄어요. 이미 보낸 요청은 과금될 수 있어요.'),{cancelled:true});
export function createComparison(selection,{closed=()=>false,update=()=>{}}={}){
 let stopped=false,busy=false,job=null;const counts={alignment:0,natural:0,close:0,voice:0},candidates=[];
 const alive=()=>{if(stopped||closed())throw cancelled();if(job)assertTranslationAlive(job);};
 const onRequest=id=>()=>{alive();counts[id]++;update({counts:{...counts},candidates:[...candidates],stage:id,busy});};
 return {counts,candidates,get job(){return job},get busy(){return busy},cancel(){stopped=true;},async generate(){
  if(busy||job||candidates.length)throw Error('새로 비교하려면 창을 다시 열어 주세요.');busy=true;
  try{
   update({stage:'alignment',counts:{...counts},candidates:[],busy});
   job=await prepareTranslation(selection,()=>stopped||closed(),{alignOnly:true,onRequest:onRequest('alignment')});alive();
   for(const mode of COMPARISON_MODES){
    alive();update({stage:mode.id,counts:{...counts},candidates:[...candidates],busy});
    const result=await exclusive(async()=>{alive();const api=await adapter();const text=String(await api.command.callback({assertValid:alive,guidance:mode.guidance,onRequest:onRequest(mode.id)},job.original)).trim();alive();if(!text||text===job.original||!/[가-힣]/.test(text)||/\[차단된 문단|^LLM 번역 중 오류/.test(text))throw Error('사용할 수 있는 한국어 후보를 받지 못했어요.');return text;});
    candidates.push({...mode,result,calls:counts[mode.id]});update({stage:mode.id,counts:{...counts},candidates:[...candidates],busy});
   }
   return {job,candidates:[...candidates],counts:{...counts}};
  }finally{busy=false;update({stage:stopped?'cancelled':'done',counts:{...counts},candidates:[...candidates],busy});}
 }};
}
const extraStamp=message=>JSON.stringify(message.extra);
export async function applyComparison(job,result){
 return exclusive(async()=>{
  assertTranslationAlive(job);const ctx=context(),hooks=deleteHooks(),metadata=ctx.chatMetadata;
  if(termHooks()?.busy?.())throw Error('진행 중인 번역이 끝난 뒤 적용해 주세요.');
  const raw=job.translated.slice(0,job.span.start)+result+job.translated.slice(job.span.end),display=hooks.render(job.source,raw);
  if(!display)throw Error('번역 표시를 만들지 못했어요.');
  const before=structuredClone(job.message.extra),extra=job.message.extra;
  extra.display_text=display;if('original_translation_backup'in extra)extra.original_translation_backup=display;extra.translation_edited=hooks.hashOf(job.source);hooks.remember(extra,job.source,raw,display);job.guard?.acceptDisplay();hooks.syncSwipe(job.id);
  const stamp=extraStamp(job.message);let saved;
  try{saved=await termHooks().save({...job,metadata});}catch(error){if(extraStamp(job.message)===stamp){for(const k of Object.keys(extra))delete extra[k];Object.assign(extra,before);job.guard?.acceptDisplay();if(chatKey()===job.chatKey&&context().chat[job.id]===job.message)hooks.syncSwipe(job.id);}throw error;}
  let refreshFailed=false;
  if(chatKey()===job.chatKey&&context().chat[job.id]===job.message&&job.message.swipe_id===job.swipe)try{await hooks.refresh(job.id,job.message);}catch{refreshFailed=true;}
  return {...job,display,guard:captureGuard(job.message),before,stamp,saved,metadata,refreshFailed};
 });
}
export async function undoComparison(job){
 return exclusive(async()=>{
  assertTranslationAlive(job);if(context().chatMetadata!==job.metadata||extraStamp(job.message)!==job.stamp)throw Error('그사이 번역문이 바뀌어 되돌리지 않았어요.');
  const hooks=deleteHooks(),extra=job.message.extra,after=structuredClone(extra);for(const k of Object.keys(extra))delete extra[k];Object.assign(extra,structuredClone(job.before));job.guard?.acceptDisplay();hooks.syncSwipe(job.id);const stamp=extraStamp(job.message);let saved;
  try{saved=await termHooks().save(job);}catch(error){if(extraStamp(job.message)===stamp){for(const k of Object.keys(extra))delete extra[k];Object.assign(extra,after);job.guard?.acceptDisplay();if(chatKey()===job.chatKey&&context().chat[job.id]===job.message)hooks.syncSwipe(job.id);}throw error;}
  if(chatKey()===job.chatKey&&context().chat[job.id]===job.message&&job.message.swipe_id===job.swipe)try{await hooks.refresh(job.id,job.message);}catch{return {...saved,refreshFailed:true};}return saved;
 });
}
