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
export function loadBundledScript(id,fresh=false){
  const item=scriptDefinition(id);if(!item)return Promise.reject(Error('알 수 없는 스크립트예요.'));
  // 폰에서 테마를 다시 깐 직후에는 파일이 빈 채로(또는 쓰다 만 채로) 읽혀 default 가 없는 모듈이 올 때가 있다. 빈 모듈도 문법상 멀쩡해서 오류 없이 undefined 가 나왔고,
  // 실행기는 그것을 '이미 돌고 있는 코드와 같다'로 잘못 읽어 아무것도 띄우지 않은 채 '사용 중'이라고 적었다 (메뉴가 중국어로 남던 진짜 원인).
  // 글이 아니면 실패로 치고, fresh 로 부르면 주소를 바꿔 브라우저가 쥔 사본을 건너뛰고 다시 받는다.
  if(fresh)cache.delete(id);
  if(!cache.has(id))cache.set(id,import(`./bundled/${item.file}.js${fresh?`?r=${Date.now().toString(36)}`:''}`).then(module=>{
    if(typeof module.default!=='string'||module.default.length<50)throw Error('스크립트 파일이 비어 있어요');
    return module.default;
  }).catch(error=>{cache.delete(id);throw error;}));
  return cache.get(id);
}
