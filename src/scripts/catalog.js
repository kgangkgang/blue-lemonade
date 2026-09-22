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
// retry=true 일 때만 주소를 흔든다. 4.5.8 전에는 늘 흔들어서, 둘째 사본으로 도는 기기
// (bl_scripts_plain='1')는 새로고침마다 609KB 를 통째로 다시 받았다 — 캐시가 절대 안 맞았다.
// 첫 번째 시도는 주소를 고정해 조건부 GET(304)이 먹게 하고, 실패해서 다시 받을 때만 흔든다.
// 4.5.9: 둘째 사본 우선 분기에 retry 를 false 로 박아 두면 안 된다 — runtime.js 는 재시도를
// loadBundledScript(id, attempt>0) 로 알리는데, 주소가 같으면 모듈 맵이 멈춰 있는 레코드를
// 그대로 돌려줘 재시도가 요청을 한 번도 안 낸다. fresh 를 그대로 넘긴다.
async function loadPlain(item,retry){
  const bust=retry?`?r=${Date.now().toString(36)}`:'';
  const module=await import(new URL(`./plain/${item.file}.js${bust}`,import.meta.url).href);
  const text=String(module.default||''),from=text.indexOf('/*BL-SCRIPT-START*/'),to=text.lastIndexOf('/*BL-SCRIPT-END*/');
  if(from<0||to<0)throw Error('둘째 사본도 비었어요');
  const code=text.slice(from+19,to).trim();
  if(code.length<50)throw Error('둘째 사본도 비었어요');
  return code;
}
/** 진단용: 파일이 실제로 어떻게 읽히는지 — 받은 글자 수와 함께 서버가 말한 길이(content-length) · 압축 · etag 를 적는다.
 *  서버가 말한 길이부터 0 이면 서버(폰의 파일 읽기)가 빈 파일을 준 것이고, 길이는 멀쩡한데 받은 글이 0 이면 오는 길(브라우저)에서 비워진 것이다 */
async function probeUrl(label,url){
  try{
    const response=await fetch(url+(url.includes('?')?'&':'?')+'r='+Date.now().toString(36),{cache:'no-store'});
    const text=await response.text(),h=name=>response.headers.get(name)||'-';
    return `${label}: ${response.status} 받음 ${text.length}자 · 서버 길이 ${h('content-length')} · 압축 ${h('content-encoding')} · etag ${h('etag')} · 고친 때 ${h('last-modified').slice(5,25)}`;
  }catch(error){return `${label}: 못 받음 ${String(error?.message||error).slice(0,60)}`;}
}
export async function probeBundled(id){
  const item=scriptDefinition(id);if(!item)return `${id}: ?`;
  const first=await probeUrl(id,new URL(`./bundled/${item.file}.js`,import.meta.url).href);
  const second=await probeUrl('  둘째',new URL(`./plain/${item.file}.js`,import.meta.url).href);
  return `${first}\n${second}`;
}
/** 진단용: 테마의 다른 파일 · 실리태번 자체 파일도 같은지 (테마 파일만 비는지 가린다) */
export const probeOthers=()=>Promise.all([probeUrl('테마 panel.js',new URL('../panel.js',import.meta.url).href),probeUrl('테마 style.css',new URL('../../style.css',import.meta.url).href),probeUrl('실리태번 script.js',new URL('/script.js',location.href).href)]);
export function loadBundledScript(id,fresh=false){
  const item=scriptDefinition(id);if(!item)return Promise.reject(Error('알 수 없는 스크립트예요.'));
  // 폰에서 테마를 다시 깐 직후에는 파일이 빈 채로(또는 쓰다 만 채로) 읽혀 default 가 없는 모듈이 올 때가 있다. 빈 모듈도 문법상 멀쩡해서 오류 없이 undefined 가 나왔고,
  // 실행기는 그것을 '이미 돌고 있는 코드와 같다'로 잘못 읽어 아무것도 띄우지 않은 채 '사용 중'이라고 적었다 (메뉴가 중국어로 남던 원인).
  // 글이 아니면 실패로 치고, 모듈 읽기가 안 되면 파일을 글로 직접 받아 본다. 그래도 안 되면 이유를 남긴다(진단 · 상태 줄에 보임)
  if(fresh)cache.delete(id);
  // 이 기기에서 원래 파일이 비어 온 적이 있으면(브라우저가 막음) 둘째 사본부터 받는다 — 스크립트마다 헛요청 두 번(모듈 · 직접 받기)을 건너뛴다. 둘째가 안 되면 원래 순서로
  let plainFirst=false;try{plainFirst=localStorage.getItem('bl_scripts_plain')==='1';}catch{/* 저장소를 못 쓰면 늘 원래 순서 */}
  if(plainFirst&&!cache.has(id)){cache.set(id,loadPlain(item,fresh).catch(()=>{try{localStorage.removeItem('bl_scripts_plain');}catch{/* 무시 */}cache.delete(id);return loadBundledScript(id,true);}));return cache.get(id);}
  if(!cache.has(id))cache.set(id,import(bundledUrl(item,fresh)).then(module=>{
    if(typeof module.default!=='string'||module.default.length<50)throw Error('모듈에 내용이 없어요');
    return module.default;
  }).catch(async importError=>{
    try{const code=await fetchBundled(item);failures.delete(id);return code;}
    catch(error){
      try{const code=await loadPlain(item,true);try{localStorage.setItem('bl_scripts_plain','1');}catch{/* 무시 */}failures.set(id,`둘째 사본으로 돌아요 (${String(error?.message||error).slice(0,50)})`);return code;}catch(plainError){error=Error(`${String(error?.message||error).slice(0,60)} → ${plainError.message}`);}
      failures.set(id,`${String(importError?.message||importError).slice(0,50)} → ${String(error?.message||error).slice(0,70)}`);throw error;}
  }).catch(error=>{cache.delete(id);throw error;}));
  return cache.get(id);
}

