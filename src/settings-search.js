// Local settings index. Hidden aliases include controls that are currently folded
// or disabled. Searching never renders all sections or sends text to a server.
const rows = [
 ['theme','palette','테마 색과 밝기','팔레트 화이트 나이트 밝은 어두운 다크모드 라이트모드 블루 레몬 피치 복숭아 자몽 커스텀 테마 선택'],
 ['theme','colors','테마 세부 색','바탕 배경 종이 카드 포인트 강조 형광펜 글자색 색깔 변경 색상 투명 색 고치기'],
 ['theme','custom','직접 테마 만들기','커스텀 테마 만들기 새 팔레트 내 색 이름 저장 자동 색 조합'],
 ['theme','styles','스타일 저장·공유','프리셋 스타일 저장 불러오기 삭제 이름 변경 공유 코드 내보내기 가져오기 캐릭터별 연결 자동 적용 소설책 메신저 되돌리기'],
 ['theme','backup','설정 백업·복원','백업 복원 파일 json 내보내기 가져오기 초기화 리셋 설정 전체 저장'],
 ['text','text','본문 글꼴과 크기','글자 글씨 폰트 글꼴 크기 굵기 자간 줄 높이 행간 언어 한글 영어 일본어 중국어 한자 구글 폰트 업로드 CSS 링크'],
 ['text','dialogue','대사·형광펜','대사 따옴표 형광펜 밑줄 기울기 대각선 위치 굵기 진하기 색 글자 폰트 자간 크기 전체 칠'],
 ['text','ui','메뉴 글자','메뉴 설정창 버튼 글자 글씨 크기 굵기 자간 폰트 글꼴'],
 ['text','em','속마음 글자','속마음 기울임 이탤릭 별표 보라색 글자 색 크기 굵기 자간 폰트'],
 ['text','strong','강조 글자','강조 굵은 글씨 볼드 별표 두개 글자 색 크기 굵기 자간 폰트'],
 ['text','code','코드 글자','코드 백틱 도트 글꼴 네오둥근모 글씨 색 크기 굵기 자간 폰트'],
 ['text','para','문단·줄·글자 간격','문단 간격 들여쓰기 첫줄 정렬 왼쪽 가운데 오른쪽 양쪽 줄바꿈 자간 행간 글 폭 가독성 읽기 폭'],
 ['text','shadow','글자 그림자·외곽선','글자 글씨 본문 그림자 외곽선 테두리 가독성 색 진하기 투명도 각도 거리 번짐 퍼짐 두께 대상 대사 속마음 강조'],
 ['chat','message','내 메시지 모양','말풍선 카드 테이블 글자만 사용자 내 메시지 채팅 모양 이름 줄 시간 숨김 작은 아바타 숨기기 글자 크기 진하기'],
 ['chat','screen','퀵 리플라이 · QR','qr 큐알 퀵리플라이 퀵 리플라이 quick reply 빠른답장 빠른 답장 단축답장 편집 검색 돋보기 숨기기 끄기 켜기 토글 자리 위치 입력창 위 아래 가로 세로 스크롤 줄','퀵 리플라이'],
 ['chat','screen','채팅 화면·아이콘','아이콘 선 기본 배경 이미지 비치기 고르기 목록 팝업 색 고르기 팝업 모델 프리셋 선택창'],
 ['chat','screen','새로고침 화면','새로고침 시작 로딩 레몬 로고 뇌 splash', '새로고침 화면'],
 ['image','layout','미리보기 확대·축소·이동','미리보기 예시 확대 축소 돋보기 배율 원래 크기 초기 크기 이동 드래그 핀치 손가락 줌'],
 ['chat','screen','가벼운 페이드 인','스트리밍 새 글자 페이드인 스며들기 빨라지기 속도 버벅임 애니메이션', '', 'chat.streamFade'],
 ['chat','screen','날씨 효과','날씨 비 눈 꽃잎 하트 별 배경 효과 세기 투명도 크기 속도 각도 이미지 내 그림 트래커','날씨'],
 ['chat','screen','모바일 바·한 손 버튼','폰 모바일 스크롤 바 숨기기 자동 숨김 몰입 읽기 한손 한 손 버튼 스와이프 사칭 이어쓰기 다시생성','폰'],
 ['chat','etc','글자색 통일·톤 보정','본문 글자 색 지정 색 통일 퍼스널 컬러 색상 채도 밝기 화이트 나이트 원문 색 정규식 보라색 톤','색 통일'],
 ['chat','etc','다른 CSS와 충돌','커스텀 css 끄기 충돌 다른 테마 사용자 스타일 모양 이상 겹침','다른 CSS'],
 ['image','layout','에셋 사진 배치','에셋 이미지 사진 가로 꽉 영화관 좌우 여백 채우기 본문 폭 작게 배치'],
 ['image','shape','에셋 모양·모서리','에셋 이미지 네모 도형 마스크 투명 png 커스텀 모양 저장 불러오기 둥근 모서리 라운드 누끼 캐릭터 컷'],
 ['image','frame','에셋 장식 액자','에셋 이미지 사진 액자 프리셋 수채화 맥 브라우저 스크랩 다이어리 리본 겹친 메모지 팝스타 낙서 노트 레몬 스티커 보관함 업로드 저장 여러개 가로 세로 비율 색 확대 위치','장식 액자'],
 ['image','frame','에셋 테두리·그림자','에셋 이미지 사진 그림자 테두리 외곽선 얇은 선 이중선 실선 점선 파선 빛 두께 색 진하기 면 여백 번짐 확장 거리','그림자'],
 ['image','size','에셋 이미지 크기','에셋 사진 이미지 크기 높이 최대 세로 화면 비율 높이 맞춤 자르기'],
 ['image','fade','에셋 가장자리 흐림','에셋 이미지 사진 흐림 번짐 가장자리 페이드 위아래 옆 투명 흰 배경 지우기'],
 ['prompt','deus','데우스 프롬프트 호환','데우스 dem deus 엑스 마키나 프롬프트 호환 켜기 끄기 트래커 장면 계획 상태 카드 접기 폰 색 통일 이모티콘'],
 ['prompt','deus','데우스 대사 색·가독성','데우스 프롬프트 대사 색 형광펜 가독성 향상 그림자 외곽선 글자 배경 묻힘 두께 진하기 거리 번짐','대사 색상 가독성 향상'],
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
const tabs={theme:'테마',text:'글자',chat:'채팅',image:'이미지',prompt:'프롬프트'};
const subs={palette:'색',colors:'색 고치기',custom:'직접 테마 만들기',styles:'스타일',backup:'백업',text:'본문',dialogue:'대사',ui:'메뉴',em:'속마음',strong:'강조',code:'코드',para:'문단',shadow:'그림자 · 외곽선',message:'메시지',screen:'화면',etc:'기타',layout:'배치',shape:'모양',frame:'테두리',size:'크기',fade:'흐림',deus:'데우스 엑스 마키나',profile:'캐릭터 프로필','user-profile':'내 프로필',name:'캐릭터 이름·시간','user-name':'내 이름·시간'};
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/퀵\s*리플라이|quick\s*repl(?:y|ies)|큐알|\bqr\b/g,'퀵리플라이').replace(/프사|아바타/g,'프로필').replace(/글씨|글자\s*간격/g,m=>m==='글씨'?'글자':'자간').replace(/확대\s*축소/g,'확대 축소').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export const SEARCH_ENTRIES = rows.map(([tab,sub,title,aliases,anchor='',path=''],id)=>{
 const words=[...new Set(normalize(title+' '+aliases).split(' '))];
 return {id,tab,sub,title,anchor,path,breadcrumb:tabs[tab]+' › '+subs[sub],words,compact:words.join('')};
});
export function searchSettings(query) {
 const q=normalize(String(query).slice(0,160)), compact=q.replaceAll(' ','');
 if(!compact)return [];
 const words=q.split(' ').map(w=>w.replace(/(?:으로|에서|하고|하게|좀|을|를|은|는)$/u,'' )).filter(w=>w.length>1&&!['설정','편집','변경','바꾸기','싶어','싶어요','어떻게','어디서','해줘'].includes(w));
 const mine=/(?:내|나의|유저|사용자|페르소나|깡캐)/.test(q), bot=/(?:캐릭터|봇|상대)/.test(q);
 return SEARCH_ENTRIES.map(entry=>{
  let score=0, matches=0;
  for(const w of entry.words){if((w.length>1&&compact.includes(w))||(w.length===1&&q.split(' ').includes(w))){score+=Math.min(w.length,6);matches++;}}
  for(const w of words)if(entry.compact.includes(w)){score+=10;matches++;}
  if(entry.compact.includes(compact))score+=12;
  if(!matches)return {entry,score:0};
  if(mine)score+=entry.sub.startsWith('user-')?30:entry.tab==='chat'&&['profile','name'].includes(entry.sub)?-25:0;
  if(bot&&!mine)score+=['profile','name'].includes(entry.sub)?20:entry.sub.startsWith('user-')?-20:0;
  if(/에셋/.test(q))score+=entry.tab==='image'?25:-15;
  return {entry,score};
 }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.entry.id-b.entry.id).slice(0,8).map(r=>r.entry);
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const searchMarkup = query => `<div class="bl-settings-search"><div class="bl-search-field"><input type="search" data-settings-search maxlength="160" aria-label="테마 설정 검색" autocomplete="off" placeholder="설정 찾기 · 예: QR 편집" value="${esc(query)}"><button type="button" data-settings-clear aria-label="설정 검색 지우기" ${query?'':'hidden'}>×</button></div><div class="bl-search-results" aria-label="설정 검색 결과" hidden></div></div>`;
export function paintSettingsSearch(root) {
 const query=root._settingsQuery||'', list=root.querySelector('.bl-search-results');if(!list)return;
 root.querySelector('[data-settings-clear]').hidden=!query;
 list.hidden=!query.trim();if(list.hidden){list.replaceChildren();return;}
 const items=searchSettings(query);
 list.innerHTML=`<p role="status">${items.length?'관련 설정 '+items.length+'개':'찾는 설정이 없어요. 기능 이름이나 다른 표현으로 검색해 보세요.'}</p>`+items.map(e=>`<button type="button" data-settings-result="${e.id}"><strong>${esc(e.title)}</strong><small>${esc(e.breadcrumb)}</small></button>`).join('');
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
