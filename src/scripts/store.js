import { SCRIPT_CATALOG } from './catalog.js';
export const STORE_KEY='blue_lemonade_scripts';
const ids=new Set(SCRIPT_CATALOG.map(item=>item.id));
export function scriptSettings(){
  const ext=SillyTavern.getContext().extensionSettings;
  if(!ext[STORE_KEY]||typeof ext[STORE_KEY]!=='object'||Array.isArray(ext[STORE_KEY]))ext[STORE_KEY]={version:1,enabled:{},overrides:{}};
  const state=ext[STORE_KEY];
  if(!state.enabled||typeof state.enabled!=='object'||Array.isArray(state.enabled))state.enabled={};
  if(!state.overrides||typeof state.overrides!=='object'||Array.isArray(state.overrides))state.overrides={};
  for(const id of ids){
    state.enabled[id]=state.enabled[id]===true;
    if(state.overrides[id]&&(typeof state.overrides[id].code!=='string'||state.overrides[id].code.length>1000000))delete state.overrides[id];
  }
  return state;
}
export function replaceScriptSettings(state){SillyTavern.getContext().extensionSettings[STORE_KEY]=state;}
export async function persistScripts(){
  const expected=JSON.stringify(scriptSettings());
  const host=await import('../../../../../../script.js');
  await host.saveSettings();
  const response=await fetch('/api/settings/get',{method:'POST',headers:host.getRequestHeaders(),body:'{}',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('설정 저장을 확인하지 못했어요. 연결을 확인해 주세요.');
  const data=await response.json(),settings=typeof data.settings==='string'?JSON.parse(data.settings):data.settings;
  if(JSON.stringify(settings?.extension_settings?.[STORE_KEY])!==expected)throw Error('스크립트 설정이 아직 저장되지 않았어요. 다시 시도해 주세요.');
}
function flatten(trees,active=true,result=[]){
  for(const node of Array.isArray(trees)?trees:[]){
    const on=active&&node.enabled!==false;
    if(node.type==='folder')flatten(node.scripts,on,result);
    else if(on&&node.type==='script')result.push(node);
  }
  return result;
}
export function legacyConflicts(id){
  const definition=SCRIPT_CATALOG.find(item=>item.id===id);if(!definition)return [];
  const settings=SillyTavern.getContext().extensionSettings?.tavern_helper;
  if(settings?.enabled===false||settings?.script?.enabled?.global===false)return [];
  // 헬퍼가 아직 준비되기 전에 물으면 던질 수 있다(느린 폰에서 테마가 먼저 뜰 때) — 그때는 저장된 설정으로 본다.
  let trees;
  try{trees=window.TavernHelper?.getScriptTrees?.({type:'global'});}catch(error){console.warn('[Blue Lemonade] 헬퍼 스크립트 목록을 아직 읽지 못했어요',error);}
  trees??=settings?.script?.scripts;
  return flatten(trees).filter(script=>definition.match.every(token=>String(script.content||'').includes(token)));
}
