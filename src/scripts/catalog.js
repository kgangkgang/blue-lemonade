// 내장 스크립트 목록. 코드는 src/scripts/plain/<file>.js 모듈이고 켤 때 처음 받아요(runtime.js). 9.0.7 부터 iframe 없이 테마 창에서 돌아요.
export const SCRIPT_CATALOG = [
  {id:'korean',name:'실리태번 한글화',version:'1.4.8',icon:'fa-language',description:'남아 있는 영어 메뉴와 기본 안내를 한글로 보여요. 대화와 입력한 값은 그대로예요.',match:['__sillyTavernKoreanUI_v1'],file:'korean'},
  {id:'helper',name:'실리태번 헬퍼 한글화',version:'1.4.0',icon:'fa-puzzle-piece',description:'헬퍼 메뉴·단추·스크립트 관리 화면의 짧은 이름을 한글로 보여요. 긴 도움말·공지는 원래 말 그대로예요.',match:['__tavernHelperKoreanUI_v1'],file:'helper'},
  {id:'deus',name:'데우스 프롬프트 번역',version:'3.0',icon:'fa-book-open',description:'데우스 V3 · 2.5 프롬프트·정규식 제목과 편집 힌트를 번역해요. 저장되는 이름과 본문은 바꾸지 않아요.',match:['Prompt Name Translator','데우스'],file:'deus'},
  {id:'sola',name:'솔라 프롬프트 번역',version:'1.0.0',icon:'fa-sun',description:'Sola V4 프리셋의 프롬프트·정규식 제목과 편집 힌트를 번역해요. 저장되는 이름과 본문은 바꾸지 않아요.',match:['Prompt Name Translator','Gremlin Sola'],file:'sola'},
  // 과일 계열(과일 · 야한과일 · 청과)은 한글화 토글 하나(SCRIPT_FAMILIES)로 함께 켜고 꺼요. 아래 세 칸은 실행 단위예요.
  {id:'fruit',family:'fruit-family',name:'과일 계열 프롬프트 이름 한글화',version:'2.0.1',icon:'fa-leaf',description:'과일 6.4 · 야한과일 2.0 · 청과 1.75X2 · 청과 2.0XV3 의 프롬프트·정규식 이름을 한 사전(공통 + 프리셋별 추가)으로 한글로 보여요. 저장된 이름과 본문은 그대로예요.',match:['BlueLemonade.translate','果实之心控制配置'],file:'fruit'},
  {id:'qingguo',family:'fruit-family',name:'과일 계열 화면 보조 한글화',version:'2.0.0',icon:'fa-leaf',description:'과일의 마음 창 항목 이름과 청과 문장 점검 화면을 한글로 보여요. 원본과 선택은 그대로예요.',match:['__blueLemonadeQingguoKorean_v1'],file:'qingguo'},
  {id:'fruit-heart',family:'fruit-family',name:'과일의 마음 한글화',version:'1.1.0',icon:'fa-heart',description:'과일의 마음 메뉴와 상태창의 고정 문구·버튼 설명을 한글로 보여요. 프리셋·대화·입력값·켜짐 상태는 그대로예요.',match:['__blueLemonadeFruitHeartKorean_v1'],file:'fruit-heart'},
  {id:'fruit-style',name:'과일의 마음 꾸미기',version:'1.0.7',kind:'tool',icon:'fa-palette',description:'과일 창의 색·글꼴·버튼을 블루레몬에이드에 맞추고, 빠른 답장 이름 바꾸기와 ? 도움말을 더해요. 프롬프트 → 과일에서 켤 수 있어요.',match:['__blueLemonadeFruitStyle_v1'],file:'fruit-style'},
  {id:'deus-qr',name:'데우스 빠른 설정',version:'1.0.8',kind:'tool',icon:'fa-sliders',description:'데우스 V3 · 2.5 · 솔라 프리셋의 옵션을 입력창 옆에서 바로 골라요. 지금 프리셋에 맞는 창이 열려요. 프롬프트 → 데우스 엑스 마키나에서 켤 수 있어요.',match:['__blueLemonadeDeusQuick_v1'],file:'deus-qr'},
];
// 한 토글로 여러 실행 단위를 켜는 묶음. 저장은 enabled['fruit-family'] 하나를 기준으로 하고, 실행 단위 값은 그 값을 따라가요.
export const SCRIPT_FAMILIES = [
  {id:'fruit-family',name:'과일 계열 (과일 · 야한과일 · 청과)',version:'2.0.0',icon:'fa-leaf',description:'과일 · 야한과일(涩果) · 청과(青果) 프리셋을 한 묶음으로 한글화해요. 프롬프트·정규식 이름, 과일의 마음 창, 청과 문장 점검 화면이 함께 켜지고 꺼져요. 원본 이름·본문·선택은 그대로예요.',members:['fruit','qingguo','fruit-heart']},
];
export const scriptFamily = id => SCRIPT_FAMILIES.find(item=>item.id===id||item.members.includes(id));
export const scriptDefinition = id => SCRIPT_CATALOG.find(item=>item.id===id);
