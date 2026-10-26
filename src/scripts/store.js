import { SCRIPT_CATALOG, SCRIPT_FAMILIES, scriptFamily } from './catalog.js';
export const STORE_KEY='blue_lemonade_scripts';
const ids=new Set(SCRIPT_CATALOG.map(item=>item.id));
export const NAME_KEYS=['deus','fruit'];
export const cleanName=value=>typeof value==='string'?Array.from(value.replace(/\s+/g,' ').trim()).slice(0,40).join('').trim():'';
export function scriptSettings(){
  const ext=SillyTavern.getContext().extensionSettings;
  if(!ext[STORE_KEY]||typeof ext[STORE_KEY]!=='object'||Array.isArray(ext[STORE_KEY]))ext[STORE_KEY]={version:1,enabled:{},overrides:{}};
  const state=ext[STORE_KEY];
  if(!state.enabled||typeof state.enabled!=='object'||Array.isArray(state.enabled))state.enabled={};
  if(!state.overrides||typeof state.overrides!=='object'||Array.isArray(state.overrides))state.overrides={};
  // 빠른 설정·빠른 답장 줄에 보일 이름. 비우면 원래 아이콘·이름.
  if(!state.names||typeof state.names!=='object'||Array.isArray(state.names))state.names={};
  for(const key of NAME_KEYS)state.names[key]=cleanName(state.names[key]);
  state.deusIconWithName=state.deusIconWithName!==false;
  // 8.0.1 과일 계열 한 토글: 처음 읽을 때(묶음 값이 아직 없을 때)는 실행 단위 중 하나라도 켜져 있었으면 켬으로 옮겨요(청과만 켠 사용자 → 켬).
  // 그 뒤로는 묶음 값이 기준이고 실행 단위 값은 그 값을 따라가요.
  for(const family of SCRIPT_FAMILIES){
    if(typeof state.enabled[family.id]!=='boolean')state.enabled[family.id]=family.members.some(id=>state.enabled[id]===true);
    for(const id of family.members)state.enabled[id]=state.enabled[family.id];
  }
  for(const id of ids){
    state.enabled[id]=state.enabled[id]===true;
    if(state.overrides[id]&&(typeof state.overrides[id].code!=='string'||state.overrides[id].code.length>1000000))delete state.overrides[id];
  }
  return state;
}
/** 토글 하나를 켜고 끈다 — 묶음 id 거나 묶음에 든 실행 단위면 묶음 전체를 같이 */
export function setScriptEnabled(state,id,on){
  const family=scriptFamily(id);
  if(family){state.enabled[family.id]=!!on;for(const member of family.members)state.enabled[member]=!!on;return;}
  state.enabled[id]=!!on;
}
/** 화면에 보이는 토글의 켜짐 — 묶음이면 묶음 값 */
export const scriptEnabled=(state,id)=>state.enabled[scriptFamily(id)?.id??id]===true;
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
  const family=SCRIPT_FAMILIES.find(item=>item.id===id);
  if(family)return family.members.flatMap(member=>legacyConflicts(member));
  const definition=SCRIPT_CATALOG.find(item=>item.id===id);if(!definition)return [];
  const settings=SillyTavern.getContext().extensionSettings?.tavern_helper;
  if(settings?.enabled===false||settings?.script?.enabled?.global===false)return [];
  // 헬퍼가 아직 준비되기 전에 물으면 던질 수 있다(느린 폰에서 테마가 먼저 뜰 때) — 그때는 저장된 설정으로 본다.
  let trees;
  try{trees=window.TavernHelper?.getScriptTrees?.({type:'global'});}catch(error){console.warn('[Blue Lemonade] 헬퍼 스크립트 목록을 아직 읽지 못했어요',error);}
  trees??=settings?.script?.scripts;
  return flatten(trees).filter(script=>definition.match.every(token=>String(script.content||'').includes(token)));
}
