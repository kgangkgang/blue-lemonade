// Bundled code loads only when opened or enabled. User edits live outside theme/style presets.
export const SCRIPT_CATALOG = [
  {id:'korean',name:'실리태번 한글화',version:'1.3.9',icon:'fa-language',description:'남아 있는 영어 메뉴와 기본 안내를 한글로 보여요. 대화와 입력한 값은 그대로예요.',match:['__sillyTavernKoreanUI_v1'],file:'korean'},
  {id:'helper',name:'타번 헬퍼 한글화',version:'1.3.5',icon:'fa-puzzle-piece',description:'헬퍼 메뉴·도움말·공지와 스크립트 관리 화면을 한글로 보여요.',match:['__tavernHelperKoreanUI_v1'],file:'helper'},
  {id:'deus',name:'데우스 프롬프트 번역',version:'2.5',icon:'fa-book-open',description:'데우스 2.5 프롬프트·정규식 제목과 편집 힌트를 번역해요. 저장되는 이름과 본문은 바꾸지 않아요.',match:['Prompt Name Translator','데우스'],file:'deus'},
  {id:'shajin',name:'샤진 프롬프트 번역',version:'3.9',icon:'fa-book',description:'거문고자리·물고기자리 프롬프트와 정규식 제목, 편집 힌트를 번역해요.',match:['Prompt Name Translator','거문고자리'],file:'shajin'},
  {id:'fold',name:'▲ 삼각형 접기',version:'1.0.0',icon:'fa-caret-up',description:'펼친 채팅 카드 아래에서 바로 접어요. 북마크·메시지 미리보기와 접근 가능한 채팅 iframe에도 적용돼요.',match:['__thkFold'],file:'fold'},
];
export const scriptDefinition = id => SCRIPT_CATALOG.find(item=>item.id===id);
const cache=new Map();
export function loadBundledScript(id){
  const item=scriptDefinition(id);if(!item)return Promise.reject(Error('알 수 없는 스크립트예요.'));
  if(!cache.has(id))cache.set(id,import(`./bundled/${item.file}.js`).then(module=>module.default).catch(error=>{cache.delete(id);throw error;}));
  return cache.get(id);
}
