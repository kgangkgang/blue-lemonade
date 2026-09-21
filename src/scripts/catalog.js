// Bundled code loads only when opened or enabled. User edits live outside theme/style presets.
export const SCRIPT_CATALOG = [
  {id:'korean',name:'실리태번 한글화',version:'1.4.0',icon:'fa-language',description:'남아 있는 영어 메뉴와 기본 안내를 한글로 보여요. 대화와 입력한 값은 그대로예요.',match:['__sillyTavernKoreanUI_v1'],file:'korean'},
  {id:'helper',name:'타번 헬퍼 한글화',version:'1.3.8',icon:'fa-puzzle-piece',description:'헬퍼 메뉴·도움말·공지와 스크립트 관리 화면을 한글로 보여요.',match:['__tavernHelperKoreanUI_v1'],file:'helper'},
  {id:'deus',name:'데우스 프롬프트 번역',version:'2.5',icon:'fa-book-open',description:'데우스 2.5 프롬프트·정규식 제목과 편집 힌트를 번역해요. 저장되는 이름과 본문은 바꾸지 않아요.',match:['Prompt Name Translator','데우스'],file:'deus'},
  {id:'shajin',name:'샤진 프롬프트 번역',version:'3.9',icon:'fa-book',description:'거문고자리·물고기자리 프롬프트와 정규식 제목, 편집 힌트를 번역해요.',match:['Prompt Name Translator','거문고자리'],file:'shajin'},
  {id:'fold',name:'▲ 삼각형 접기',version:'1.0.0',icon:'fa-caret-up',description:'펼친 채팅 카드 아래에서 바로 접어요. 북마크·메시지 미리보기와 접근 가능한 채팅 iframe에도 적용돼요.',match:['__thkFold'],file:'fold'},
];
export const scriptDefinition = id => SCRIPT_CATALOG.find(item=>item.id===id);
const cache=new Map();
const failures=new Map();
export const loadFailure=id=>failures.get(id)||'';
const bundledUrl=(item,bust)=>new URL(`./bundled/${item.file}.js${bust?`?r=${Date.now().toString(36)}`:''}`,import.meta.url).href;
/** 파일을 글로 직접 받아 `export default "…";` 안의 글을 꺼낸다 — 모듈로 읽기가 실패하는 환경(덜 쓰인 파일을 브라우저가 쥐고 있음 등)의 우회로이자 진단 */
async function fetchBundled(item){
  const response=await fetch(bundledUrl(item,true),{cache:'no-store'});
  const text=await response.text();
  const at=text.indexOf('export default ');
  const body=at<0?'':text.slice(at+15).trim().replace(/;$/,'');
  if(!response.ok)throw Error(`파일 응답 ${response.status}`);
  if(!body.startsWith('"')||!body.endsWith('"'))throw Error(`파일이 덜 풀렸어요 (${text.length}자, 끝 ${JSON.stringify(text.slice(-12))})`);
  const code=JSON.parse(body);
  if(typeof code!=='string'||code.length<50)throw Error('파일 내용이 비었어요');
  return code;
}
/** 셋째 길: 모양이 전혀 다른 둘째 사본(src/scripts/plain/<id>.js — 여러 줄짜리 보통 함수)에서 함수 몸통을 글로 꺼낸다 (tools/build-plain-scripts.mjs 가 만든다) */
async function loadPlain(item){
  const module=await import(new URL(`./plain/${item.file}.js?r=${Date.now().toString(36)}`,import.meta.url).href);
  const text=String(module.default||''),from=text.indexOf('/*BL-SCRIPT-START*/'),to=text.lastIndexOf('/*BL-SCRIPT-END*/');
  if(from<0||to<0)throw Error('둘째 사본도 비었어요');
  const code=text.slice(from+19,to).trim();
  if(code.length<50)throw Error('둘째 사본도 비었어요');
  return code;
}
/** 진단용: 파일이 실제로 어떻게 읽히는지 */
export async function probeBundled(id){
  const item=scriptDefinition(id);if(!item)return `${id}: ?`;
  try{const response=await fetch(bundledUrl(item,true),{cache:'no-store'});const text=await response.text();
    let plain='?';try{const r2=await fetch(new URL(`./plain/${item.file}.js?r=${Date.now().toString(36)}`,import.meta.url).href,{cache:'no-store'});plain=`${r2.status} ${(await r2.text()).length}자`;}catch{plain='못 받음';}
    return `${id}: ${response.status} ${text.length}자 ${/";?\s*$/.test(text)?'끝 있음':'끝 없음'} / 둘째 ${plain}`;}
  catch(error){return `${id}: 못 받음 ${String(error?.message||error).slice(0,60)}`;}
}
export function loadBundledScript(id,fresh=false){
  const item=scriptDefinition(id);if(!item)return Promise.reject(Error('알 수 없는 스크립트예요.'));
  // 폰에서 테마를 다시 깐 직후에는 파일이 빈 채로(또는 쓰다 만 채로) 읽혀 default 가 없는 모듈이 올 때가 있다. 빈 모듈도 문법상 멀쩡해서 오류 없이 undefined 가 나왔고,
  // 실행기는 그것을 '이미 돌고 있는 코드와 같다'로 잘못 읽어 아무것도 띄우지 않은 채 '사용 중'이라고 적었다 (메뉴가 중국어로 남던 원인).
  // 글이 아니면 실패로 치고, 모듈 읽기가 안 되면 파일을 글로 직접 받아 본다. 그래도 안 되면 이유를 남긴다(진단 · 상태 줄에 보임)
  if(fresh)cache.delete(id);
  if(!cache.has(id))cache.set(id,import(bundledUrl(item,fresh)).then(module=>{
    if(typeof module.default!=='string'||module.default.length<50)throw Error('모듈에 내용이 없어요');
    return module.default;
  }).catch(async importError=>{
    try{const code=await fetchBundled(item);failures.delete(id);return code;}
    catch(error){
      try{const code=await loadPlain(item);failures.set(id,`둘째 사본으로 돌아요 (${String(error?.message||error).slice(0,50)})`);return code;}catch(plainError){error=Error(`${String(error?.message||error).slice(0,60)} → ${plainError.message}`);}
      failures.set(id,`${String(importError?.message||importError).slice(0,50)} → ${String(error?.message||error).slice(0,70)}`);throw error;}
  }).catch(error=>{cache.delete(id);throw error;}));
  return cache.get(id);
}

