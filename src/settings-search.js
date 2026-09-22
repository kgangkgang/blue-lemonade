// Local settings index. Hidden aliases include controls that are currently folded
// or disabled. Searching never renders all sections or sends text to a server.
import { favoriteButton } from './settings-favorites.js';
const rows = [
 ['theme','palette','에이드 혼합하기 · 그라데이션','그라데이션 그라디언트 혼합 섞기 2색 3색 두색 세색 방향 각도 360 반전 비중 비율 색상 조합 번짐 경계 블러 흐리기 부드럽게 선명 섞임'],
 ['theme','colors','글자·형광펜 그라데이션','본문 대사 속마음 강조 글자 형광펜 그라데이션 단색 색 비중 방향 각도'],
 ['theme','changes','변경한 설정·항목별 복원','변경 내역 기본값 다른 바꾼 설정 목록 초기화 원래대로 항목 하나만 되돌리기 복원 실수'],
 ['theme','palette','테마 색과 밝기','배경 진하기 테마색 농도 차콜 색감 퍼센트 0.5% 1% 20% 팔레트 화이트 나이트 밝은 어두운 다크모드 라이트모드 블루 레몬 피치 복숭아 자몽 라벤더 딸기 민트 오렌지 우드 갈색 수박 초록 빨강 커스텀 테마 선택'],
 ['theme','colors','테마 세부 색','바탕 배경 종이 카드 포인트 강조 형광펜 글자색 색깔 변경 색상 투명 색 고치기'],
 ['theme','custom','직접 테마 만들기','커스텀 테마 만들기 새 팔레트 내 색 이름 저장 자동 색 조합'],
 ['theme','styles','스타일 저장·공유','프리셋 스타일 저장 불러오기 삭제 이름 변경 공유 코드 내보내기 가져오기 캐릭터별 연결 자동 적용 소설책 메신저 되돌리기'],
 ['theme','backup','설정 백업·복원','백업 복원 파일 json 내보내기 가져오기 초기화 리셋 설정 전체 저장'],
 ['theme','palette','설정창 전체 화면·닫기·되돌리기','되돌리기 취소 앞으로가기 다시실행 실행취소 undo redo 전체화면 전체 화면 크게 넓게 설정창 팝업 작은창 작은 창 닫기 종료 나가기 엑스 x'],
 ['text','text','본문 글꼴과 크기','글자 글씨 폰트 글꼴 크기 굵기 자간 줄 높이 행간 언어 한글 영어 일본어 중국어 한자 구글 폰트 업로드 CSS 링크'],
 ['text','dialogue','대사·형광펜','대사 따옴표 형광펜 직사각형 알약 둥근 끝 동그란 네모 반듯 일자 펜 자국 모양 밑줄 기울기 대각선 위치 굵기 진하기 색 글자 폰트 자간 크기 전체 칠'],
 ['text','ui','메뉴 글자','메뉴 설정창 버튼 글자 글씨 크기 굵기 자간 폰트 글꼴'],
 ['text','em','속마음 글자','속마음 기울임 이탤릭 별표 보라색 글자 색 크기 굵기 자간 폰트'],
 ['text','strong','강조 글자','강조 굵은 글씨 볼드 별표 두개 글자 색 크기 굵기 자간 폰트'],
 ['text','code','코드 글자','코드 백틱 도트 글꼴 네오둥근모 글씨 색 크기 굵기 자간 폰트'],
 ['text','para','문단·줄·글자 간격','문단 간격 들여쓰기 첫줄 정렬 왼쪽 가운데 오른쪽 양쪽 줄바꿈 자간 행간 글 폭 가독성 읽기 폭'],
 ['text','shadow','글자 그림자·외곽선','글자 글씨 본문 그림자 외곽선 테두리 가독성 색 진하기 투명도 각도 거리 번짐 퍼짐 두께 대상 대사 속마음 강조'],
 ['chat','message','내 메시지 모양','말풍선 카드 테이블 글자만 사용자 내 메시지 채팅 모양 이름 줄 시간 숨김 작은 아바타 숨기기 글자 크기 진하기'],
 ['chat','screen','퀵 리플라이 · QR','qr 큐알 퀵리플라이 퀵 리플라이 quick reply 빠른답장 빠른 답장 단축답장 편집 검색 돋보기 숨기기 끄기 켜기 토글 자리 위치 입력창 위 아래 가로 세로 스크롤 줄','퀵 리플라이'],
 ['chat','screen','채팅 화면·아이콘','아이콘 선 기본 배경 이미지 비치기 채팅 바탕 농도 불투명 투명 메시지 버튼 고정 꺼내기 번역 버튼 점 세 개 메뉴 고르기 목록 팝업 색 고르기 팝업 모델 프리셋 선택창'],
 ['chat','screen','새로고침 화면','새로고침 시작 로딩 레몬 로고 뇌 splash', '새로고침 화면'],
 ['image','layout','미리보기 확대·축소·이동','미리보기 예시 확대 축소 돋보기 배율 원래 크기 초기 크기 이동 드래그 핀치 손가락 줌 높이 가변 크기 손잡이 한줄 넓게 늘리기 줄이기 기본 높이'],
 ['chat','screen','가벼운 페이드 인','스트리밍 새 글자 페이드인 스며들기 빨라지기 속도 버벅임 애니메이션', '', 'chat.streamFade'],
 ['chat','screen','날씨 효과','날씨 비 눈 꽃잎 하트 별 배경 효과 세기 투명도 크기 속도 각도 이미지 내 그림 트래커','날씨'],
 ['chat','screen','모바일 바·한 손 버튼','폰 모바일 스크롤 바 숨기기 자동 숨김 몰입 읽기 한손 한 손 버튼 스와이프 사칭 이어쓰기 다시생성','폰'],
 ['prompt','deus','글자색 통일·톤 보정','본문 글자 색 지정 색 통일 퍼스널 컬러 색상 채도 밝기 화이트 나이트 원문 색 정규식 보라색 톤 형광펜 톤 띠 색 맞추기','색 통일'],
 ['chat','etc','다른 CSS와 충돌','커스텀 css 끄기 충돌 다른 테마 사용자 스타일 모양 이상 겹침','다른 CSS'],
 ['image','layout','에셋 사진 배치','에셋 이미지 사진 가로 꽉 영화관 좌우 여백 채우기 본문 폭 작게 배치'],
 ['image','shape','에셋 모양·모서리','에셋 이미지 네모 도형 마스크 투명 png 커스텀 모양 저장 불러오기 둥근 모서리 라운드 누끼 캐릭터 컷'],
 ['image','frame','에셋 장식 액자','에셋 이미지 사진 액자 프리셋 수채화 맥 브라우저 스크랩 다이어리 리본 겹친 메모지 팝스타 낙서 노트 레몬 스티커 보관함 업로드 저장 여러개 가로 세로 비율 색 확대 위치','장식 액자'],
 ['image','frame','에셋 테두리·그림자','에셋 이미지 사진 그림자 테두리 외곽선 얇은 선 이중선 실선 점선 파선 빛 두께 색 진하기 면 여백 번짐 확장 거리','그림자'],
 ['image','size','에셋 이미지 크기','에셋 사진 이미지 크기 높이 최대 세로 화면 비율 높이 맞춤 자르기'],
 ['image','fade','에셋 가장자리 흐림','에셋 이미지 사진 흐림 번짐 가장자리 페이드 위아래 옆 투명 흰 배경 지우기'],
 ['prompt','deus','데우스 프롬프트 호환','데우스 dem deus 엑스 마키나 프롬프트 호환 켜기 끄기 트래커 장면 계획 상태 카드 접기 폰 색 통일 이모티콘'],
 ['prompt','deus','데우스 대사 색·가독성','데우스 프롬프트 대사 색 형광펜 가독성 향상 그림자 외곽선 글자 배경 묻힘 두께 진하기 거리 번짐','대사 색상 가독성 향상'],
 ['prompt','deus','데우스 감정 대사 효과','데우스 expressive dialogue 감정 대사 효과 애니메이션 움직임 외침 떨림 빛 색 흐름 무지개 애니메이션 줄이기 절전','감정 대사 효과'],
 ['prompt','deus','트래커 날씨 연결','데우스 트래커 날씨 비 눈 채팅 뒤 효과 자동 연결','트래커'],
];
for (const [sub, name, alias] of [['profile','캐릭터','캐릭터 봇 상대'],['user-profile','내','내 나 유저 사용자 페르소나 깡캐']]) {
 const owner = sub === 'profile' ? 'profile' : 'userProfile';
 rows.push([ 'chat',sub,`${name} 프로필 표시·배치`,`${alias} 프로필 프사 아바타 사진 이미지 없음 숨김 작은 상단 큰 왼쪽 오른쪽 위치 정렬`, '', `${owner}.mode` ],
 ['chat',sub,`${name} 프로필 크기·자르기`,`${alias} 프로필 사진 크기 너비 높이 세로 남길 부분 자르기 픽셀 화면 비율 원본 화질 전체 보이기 가득 채우기 영화관 여백 모서리 둥글기 간격`, '사진 크기 · 위치'],
 ['chat',sub,`${name} 프로필 흐림`,`${alias} 프로필 사진 흐림 투명도 진하기 가장자리 위아래 좌우 블러 페이드`, '흐림 · 투명도'],
 ['chat',sub,`${name} 프로필 액자`,`${alias} 프로필 사진 장식 액자 프리셋 수채화 리본 맥 브라우저 스크랩 메모지 노트 보관함 저장 그림 불러오기 안쪽 배경 제거 색 가로 세로 비율`, '장식 액자'],
 ['chat',sub,`${name} 프로필 테두리·그림자`,`${alias} 프로필 사진 테두리 그림자 색 진하기 두께 종류 이중선 점선 파선 빛 번짐 확장 거리 여백`, '그림자']);
 const namesub = sub === 'profile' ? 'name' : 'user-name';
 rows.push(['chat',namesub,`${name} 이름 글꼴·꾸미기`,`${alias} 이름 폰트 글꼴 언어 크기 굵기 자간 색 정렬 왼쪽 중앙 가운데 오른쪽 기울임 밑줄 외곽선 그림자`, '이름 글자'],
 ['chat',namesub,`${name} 시간·버튼 배치`,`${alias} 이름 시간 날짜 버튼 점세개 메뉴 편집 연필 모델 아이콘 통계 토큰 번호 한줄 두줄 옆 아래 간격 진하기 정렬`, '']);
}
rows.push(['extensions','words','단어 치환','단어 바꾸기 조사 규칙 되돌리기'],['extensions','capture','채팅 캡처','이미지 사진 저장 메시지 다중 선택'],['extensions','order','확장 순서','패널 고정 순서 정렬'],['extensions','perf','성능 보조','끊김 감시 요청 로그 로딩 저장 정리'],['chat','screen','날씨 움직임','레몬 꽃잎 유성 낙하 회전 흔들림 커스텀'],['theme','palette','내 에이드 보관함','커스텀 여러개 저장 불러오기'],
 ['extensions','models','모델 등록','모델 이름 직접 추가 등록 공급자 목록에 없는 새 모델 커스텀 모델'],
 ['extensions','bookmarks','북마크','북마크 책갈피 즐겨찾기 메시지 표시 메모 모아 보기 찾기 이동 앞뒤 문맥 다른 채팅'],
 ['extensions','modelswitch','모델 전환','번역 장기 기억 다시 쓰기 모델 한번에 바꾸기 중계 공식 API 조합 저장 주소 잠금 공급자 전환'],
 ['extensions','regexlink','프롬프트 연동 정규식','정규식 프롬프트 연동 모듈 모멘텀 엔진 상태창 선택지 끄기 켜기 자동 스트리밍 가볍게 데우스 regex'],
 ['extensions','rewrite','다시 쓰기','금지 묘사 금지어 밴 단어 문장 고치기 다시 쓰기 안경 수염 외모 묘사 씬 플랜 리롤 장면 계획 예외 캐릭터 AI 프롬프트 규칙 사용법'],
 ['extensions','scripts','스크립트','내장 스크립트 실리태번 한글화 헬퍼 한글화 데우스 샤진 번역 프롬프트 이름 정규식 이름 삼각형 접기 코드 편집'],
 ['theme','update','테마 업데이트','업데이트 새 버전 확인 최신 버전 받기 공지사항 달라진 점']);
const tabs={extensions:'확장',theme:'테마',text:'글자',chat:'채팅',image:'이미지',prompt:'프롬프트'};
const subs={words:'단어 치환',capture:'채팅 캡처',order:'확장 순서',perf:'성능 보조',models:'모델 등록',modelswitch:'모델 전환',regexlink:'프롬프트 연동 정규식',rewrite:'다시 쓰기',bookmarks:'북마크',scripts:'스크립트',update:'업데이트',changes:'변경한 설정',palette:'색',colors:'색 고치기',custom:'직접 테마 만들기',styles:'스타일',backup:'백업',text:'본문',dialogue:'대사',ui:'메뉴',em:'속마음',strong:'강조',code:'코드',para:'문단',shadow:'그림자 · 외곽선',message:'메시지',screen:'화면',etc:'기타',layout:'배치',shape:'모양',frame:'테두리',size:'크기',fade:'흐림',deus:'데우스 엑스 마키나',profile:'캐릭터 프로필','user-profile':'내 프로필',name:'캐릭터 이름·시간','user-name':'내 이름·시간'};
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/퀵\s*리플라이|quick\s*repl(?:y|ies)|큐알|\bqr\b/g,'퀵리플라이').replace(/프사|아바타/g,'프로필').replace(/글씨|글자\s*간격/g,m=>m==='글씨'?'글자':'자간').replace(/확대\s*축소/g,'확대 축소').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
// 한글을 초성 · 자모로 풀어 둔다: 'ㅂㄱ' → 배경, '배겨'(치다 만 글자) → 배경, 한 글자 틀린 말도 찾는다.
const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const syllable=c=>{const k=c.charCodeAt(0)-0xAC00;return k>=0&&k<11172?k:-1;};
export const chosung=text=>[...String(text)].map(c=>{const k=syllable(c);return k<0?c:CHO[Math.floor(k/588)];}).join('');
export const jamo=text=>[...String(text)].map(c=>{const k=syllable(c);return k<0?c:CHO[Math.floor(k/588)]+JUNG[Math.floor(k%588/28)]+JONG[k%28];}).join('');
// 말하듯 쓴 문장 → 설정에서 쓰는 말. 왼쪽이 보이면 오른쪽 낱말을 검색어에 보탠다.
const INTENTS=[
 [/작아|작게|작은|크게|큰|키우|키워|줄이|줄여|커졌|작아졌/,'크기'],
 [/안\s*보|잘\s*안|가독성|읽기\s*(?:힘|어려|불편)|눈\s*아프|흐릿|묻혀/,'외곽선 그림자 가독성 농도'],
 [/어둡|어두운|밤|눈부|다크/,'나이트 다크모드 밝기'],
 [/밝게|밝은|환하|라이트|하얗/,'화이트 라이트모드 밝기'],
 [/느려|느림|렉|버벅|끊겨|끊김|무거|멈춰|멈춤/,'성능 보조 끊김 감시 로딩'],
 [/비쳐|비치|비침|투명|불투명|뒤에\s*배경|배경\s*사진|배경\s*그림/,'배경 이미지 비치기 농도 투명'],
 [/폰트|서체|글씨체|글자체/,'글꼴'],
 [/줄\s*사이|행간|줄\s*간격|빽빽|답답/,'줄간격 문단 간격 여백'],
 [/동그랗|동그란|둥글|네모|각지|모서리/,'모양 둥글기 모서리'],
 [/저장해\s*두|저장해\s*놓|나중에\s*다시|옮기|다른\s*기기|폰으로|컴퓨터로/,'스타일 저장 백업 내보내기 가져오기'],
 [/원래대로|처음으로|되돌|초기화|리셋|망했|잘못\s*바꿨|실수/,'초기화 되돌리기 복원 변경한 설정'],
 [/눈이?\s*(?:내리|내려|와|오)|비가?\s*(?:내리|내려|와|오)|날씨|꽃잎|유성|별똥/,'날씨'],
 [/캡처|캡쳐|스샷|스크린샷|사진으로|이미지로\s*저장|짤/,'채팅 캡처'],
 [/금지|밴|보기\s*싫|나오지\s*않게|안\s*나오게|묘사/,'다시 쓰기 금지 묘사'],
 [/번역\s*안|영어로\s*나와|영어가|중국어|한글로|한국어로/,'스크립트 한글화'],
 [/모델\s*바꾸|모델\s*변경|중계|api\s*바꾸/,'모델 전환'],
 [/말풍선|메신저|카톡|버블/,'메시지 말풍선 모양'],
 [/색깔|색상|컬러|색\s*바꾸|무슨\s*색/,'색 테마'],
 [/별표|즐겨\s*찾|자주\s*쓰는/,'즐겨찾기'],
];
const STOP=new Set(['설정','편집','변경','바꾸기','바꾸고','바꿀','싶어','싶어요','싶은데','싶다','어떻게','어디서','어디','해줘','해주세요','하는','하려면','하고','있어','있나','있나요','없어','없나','너무','좀','조금','약간','그냥','이거','저거','그거','뭐','왜','제발','하면','되나','되나요','돼','할','수','것','거','법','방법','알려줘','찾아줘','하게','해','줘']);
const ENDING=/(?:으로|에서|에게|한테|이랑|하고|하게|해서|인데|은데|는데|이요|예요|에요|어요|아요|나요|가요|고요|이야|이에요|들|을|를|은|는|이|가|도|만|의|에|로|와|과|랑|요)$/u;
const stem=word=>{let w=word;for(let i=0;i<2;i++){const next=w.replace(ENDING,'');if(next===w||next.length<1)break;w=next;}return w;};
// 한 글자 틀림까지 (자모 기준, 앞에서부터 같은 길이만 본다)
function near(a,b){
 if(Math.abs(a.length-b.length)>1)return false;
 let i=0,j=0,miss=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue;}
  if(++miss>1)return false;
  if(a.length>b.length)i++;else if(a.length<b.length)j++;else{i++;j++;}
 }
 return miss+(a.length-i)+(b.length-j)<=1;
}
export const SEARCH_ENTRIES = rows.map(([tab,sub,title,aliases,anchor='',path=''],id)=>{
 const words=[...new Set(normalize(title+' '+aliases).split(' '))];
 const titleWords=normalize(title).split(' ');
 return {id,tab,sub,title,anchor,path,breadcrumb:tabs[tab]+' › '+subs[sub],words,compact:words.join(''),
  titleCho:chosung(titleWords.join('')),cho:words.map(chosung),jamoWords:words.map(jamo),titleJamo:titleWords.map(jamo)};
});
export function searchSettings(query) {
 // NFKC 가 ㅂ(호환 자모)을 첫소리 자모(U+1100~)로 바꿔 놓으므로 되돌린다
 const raw=normalize(String(query).slice(0,160)).replace(/[ᄀ-ᄒ]/g,c=>CHO[c.charCodeAt(0)-0x1100]);
 if(!raw.replaceAll(' ',''))return [];
 // 말하듯 쓴 문장이면 뜻에 맞는 낱말을 보탠다
 const extra=INTENTS.filter(([re])=>re.test(raw)).map(([,add])=>add).join(' ');
 const q=extra?normalize(raw+' '+extra):raw, compact=q.replaceAll(' ','');
 const tokens=q.split(' '), tokenSet=new Set(tokens);
 const stems=[...new Set(tokens.map(stem))];
 for(const w of stems)if(w.length===1)tokenSet.add(w);
 const words=stems.filter(w=>w.length>1&&!STOP.has(w));
 const initials=raw.split(' ').filter(w=>w.length>1&&/^[ㄱ-ㅎ]+$/.test(w));
 const loose=raw.split(' ').map(stem).filter(w=>w.length>1&&!STOP.has(w)&&!/^[ㄱ-ㅎ]+$/.test(w)).map(w=>[w,jamo(w)]).filter(([,j])=>j.length>=3);
 const mine=/(?:^|\s)(?:내(?!보내)|나의|유저|사용자|페르소나|깡캐)/.test(q), bot=/(?:캐릭터|봇|상대)/.test(q);
 const frame=/액자/.test(q), transfer=/내보내|가져오|백업|복원|공유/.test(q);
 return SEARCH_ENTRIES.map(entry=>{
  let score=0, matches=0;
  for(const w of entry.words){if((w.length>1&&compact.includes(w))||(w.length===1&&tokenSet.has(w))){score+=Math.min(w.length,6);matches++;}}
  for(const w of words)if(entry.compact.includes(w)){score+=10;matches++;}
  if(entry.compact.includes(compact))score+=12;
  // 초성: ㅂㄱ → 배경
  for(const w of initials){
   if(entry.titleCho.includes(w)){score+=entry.titleCho.startsWith(w)?34:26;matches++;}
   else if(entry.cho.some(c=>c.startsWith(w))){score+=16;matches++;}
   else if(w.length>2&&entry.cho.some(c=>c.includes(w))){score+=8;matches++;}
  }
  // 치다 만 글자 · 한 글자 틀린 말: 자모로 풀어 낱말 앞머리와 견준다
  for(const [w,j] of loose){
   if(entry.compact.includes(w))continue;
   if(entry.titleJamo.some(t=>t.startsWith(j))){score+=14;matches++;}
   else if(entry.jamoWords.some(t=>t.startsWith(j))){score+=9;matches++;}
   else if(j.length>=5&&entry.jamoWords.some(t=>near(j,t.slice(0,j.length))||near(j,t))){score+=6;matches++;}
  }
  if(!matches)return {entry,score:0};
  if(mine)score+=entry.sub.startsWith('user-')?30:entry.tab==='chat'&&['profile','name'].includes(entry.sub)?-25:0;
  if(bot&&!mine)score+=['profile','name'].includes(entry.sub)?20:entry.sub.startsWith('user-')?-20:0;
  if(/에셋/.test(q))score+=entry.tab==='image'?25:-15;
  if(frame)score+=entry.title.includes('액자')?30:-10;
  if(transfer&&!frame)score+=['styles','backup'].includes(entry.sub)?35:-10;
  return {entry,score};
 }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.entry.id-b.entry.id).slice(0,10).map(r=>r.entry);
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const searchMarkup = query => `<div class="bl-settings-search"><div class="bl-search-field"><input type="search" data-settings-search maxlength="160" aria-label="테마 설정 검색" autocomplete="off" placeholder="설정 찾기 · 예: QR 편집 · ㅂㄱ · 글씨가 작아" value="${esc(query)}"><button type="button" data-settings-clear aria-label="설정 검색 지우기" ${query?'':'hidden'}>×</button></div><div class="bl-search-results" aria-label="설정 검색 결과" hidden></div></div>`;
export function paintSettingsSearch(root) {
 const query=root._settingsQuery||'', list=root.querySelector('.bl-search-results');if(!list)return;
 root.querySelector('[data-settings-clear]').hidden=!query;
 list.hidden=!query.trim();if(list.hidden){list.replaceChildren();return;}
 const items=searchSettings(query);
 list.innerHTML=`<p role="status">${items.length?'관련 설정 '+items.length+'개':'찾는 설정이 없어요. 다른 말이나 초성(ㅂㄱ)으로도 찾아보세요.'}</p>`+items.map(e=>`<div class="bl-search-result-row"><button type="button" data-settings-result="${e.id}"><strong>${esc(e.title)}</strong><small>${esc(e.breadcrumb)}</small></button>${favoriteButton(e)}</div>`).join('');
}
export function bindSettingsSearch(root,navigate) {
 const update=input=>{root._settingsQuery=input.value;paintSettingsSearch(root);};
 root.addEventListener('input',e=>{if(e.target.matches('[data-settings-search]')&&!e.isComposing)update(e.target);});
 root.addEventListener('compositionend',e=>{if(e.target.matches('[data-settings-search]'))update(e.target);});
 root.addEventListener('click',e=>{
  const result=e.target.closest('[data-settings-result]'),clear=e.target.closest('[data-settings-clear]');if(!result&&!clear)return;
  e.preventDefault();e.stopPropagation();root._settingsQuery='';
  if(result){const entry=SEARCH_ENTRIES[Number(result.dataset.settingsResult)];if(entry)navigate(entry);}
  else {const input=root.querySelector('[data-settings-search]');input.value='';paintSettingsSearch(root);input.focus();}
 });
 root.addEventListener('keydown',e=>{
  if(!e.target.closest('.bl-settings-search')||e.isComposing)return;
  const input=root.querySelector('[data-settings-search]'), buttons=[...root.querySelectorAll('[data-settings-result]')];
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();root._settingsQuery='';input.value='';paintSettingsSearch(root);input.focus();}
  if(e.key==='Enter'&&e.target===input){e.preventDefault();e.stopPropagation();buttons[0]?.click();}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();const i=buttons.indexOf(e.target),next=i+(e.key==='ArrowDown'?1:-1);(next<0?input:buttons[Math.min(next,buttons.length-1)]||input).focus();}
 });
}
