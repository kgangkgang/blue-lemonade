// Local settings index. Hidden aliases include controls that are currently folded
// or disabled. Searching never renders all sections or sends text to a server.
// 10-31: 검색은 늘 로컬이에요. 「AI 로 설정 바꾸기」를 켠 사람이 「AI 에게 맡기기」를 누를 때만 문장 + 설정 목록을 실리태번 연결로 한 번 보내요(settings-ai.js).
import { favoriteButton } from './settings-favorites.js';
import { MARKDOWN_CONTROLS, MARKDOWN_TUNING } from './markdown.js';
import { mergedOf } from './settings-screens.js';   // 1.0.0 후보: 합친 화면(글자 모양 · 이름 · 시간)의 길 표시
const rows = [
 ['image','frame','안쪽 사진 모서리 (px)','액자 안쪽 사진 모서리 둥글기'],
 ['image','frame','사진 확대 (%)','액자 안쪽 사진 확대 맞추기'],
 ['chat','user-profile','작은 사진 위치','작은 사진 위치 왼쪽 오른쪽'],
 ['chat','profile','사진 맞추기','사진 맞추기 가득 채우기 전체 보이기'],
 ['text','para','폰 · PC 배치 따로 기억','기기별 분리 저장 글자 여백 프로필'],
 ['chat','profile','원본 화질','원본 사진 화질'],
 ['image','frame','액자 진하기 (%)','액자 진하기 투명도'],
 ['image','frame','액자 가로 비율 (%)','액자 가로 비율 크기'],
 ['image','frame','액자 세로 비율 (%)','액자 세로 비율 크기'],
 ['image','frame','액자 기울기 (도)','액자 기울기 각도 회전 비스듬히 기울이기'],   // 1.0.1 심플 액자 기울기(-10~10도)
 ['image','frame','액자 색상 돌리기 (도)','액자 색상 색감 색조 돌리기 색 바꾸기 hue'],   // 1.0.7 액자 색감
 ['image','frame','액자 채도 (%)','액자 채도 색감 진하게 흐리게 선명 saturate'],
 ['image','frame','액자 밝기 (%)','액자 밝기 밝게 어둡게 색감 brightness'],
 ['image','frame','장식 액자 사용','장식 액자 사용'],
 ['image','frame','에셋 장식 액자','사진 액자 프리셋 보관함 저장 그림','장식 액자'],
 ['prompt','deus','데우스 빠른 설정','데우스 2.5 V3 솔라 Sola QR 퀵리플라이 옵션 프리셋 토글 선택 한글화 빠른 토글'],
 ['prompt','sola','솔라 카드 스타일','솔라 Sola 상태창 카드 원작 블루레몬 테마 모양 접기 색 글꼴','상태창 글자'],
 ['prompt','fruit','과일 계열 (과일 · 야한과일 · 청과)','과일 과일계열 야한과일 涩果 청과 青果 과일의 마음 QR 퀵리플라이 꾸미기 스크립트 글꼴 줄바꿈 버튼 한글화 출처'],
 ['prompt','fruit','캐릭터 이름 연동','캐릭터 이름 연동 프롬프트 정규식 자동 켜기 끄기 기본 짝 채팅 프리셋 대사 색상','캐릭터 이름 연동'],
 ['extensions','tts','TTS','음성 읽기 목소리 API 감정 대사 재생 색깔 밑줄 확장 탭 설정 표시 요술봉 MiniMax OpenAI ElevenLabs Gemini Azure'],
 ['extensions','prompt','한글화 패널','실리태번 헬퍼 데우스 샤진 거문고 솔라 Sola 한글화 프리셋 월드인포 봇카드 페르소나 설명 정규식 번역 제목 검색 사용방법'],
 ['chat','etc','펼친 카드 아래에 접기 버튼','삼각형 접기 카드 아래 접기','', 'chat.triangleFold'],
 ['extensions','zipinstall','ZIP 설치','압축 파일 설치 업데이트 덮어쓰기 백업 복원 도우미'],
 ['extensions','notes','메모','노트 북마크 채팅 기록 메모장 쪽지 포스트잇 태그 폴더 요술봉 입력창 메모 줄'],
 ['text','strike','취소선','가운데 줄 지우기 선 두께 색 기울임 흐림 흐리기 취소선 선 긋기 선 색 따로 정하기 기울이기'],
 ['extensions','mermaid','Mermaid 도표','머메이드 다이어그램 순서도 관계도 그래프 flowchart sequence diagram'],
 ['extensions','prompt-template','프롬프트 템플릿','EJS 템플릿 프롬프트 카드 월드 인포 변수 조건 반복 시뮬 설치 업데이트 삭제 ST-Prompt-Template zonde306'],
 ['extensions','customstyle','커스텀 CSS 조절','IceFog 색 변수 슬라이더 입력 커스텀 스타일 CSS 변수 조절 다른 테마 CSS'],
 ['extensions','perf','저장 공간','저장 공간 용량 브라우저 서버 캐시 정리 지우기 점검 도구 진단 복사 최근 오류 요술봉'],
 ['chat','profile','프로필 여러 개','아바타 사진 여러 장 랜덤 고정 핀 코스튬 캐릭터 선택창 답변마다 메시지마다 채팅방 열 때마다 하루에 한 번', '', 'multiAvatar.on'],
 ['chat','profile','적용 시점','프로필 여러 개 랜덤 바뀌는 때 채팅방 열 때마다 캐릭터 목록 열 때마다 하루에 한 번 끔', '', 'multiAvatar.when'],
 ['chat','profile','원본 카드 그림도 섞기','프로필 여러 개 원본 카드 랜덤 후보 섞기', '', 'multiAvatar.includeCard'],
 ['theme','backup','최근 꾸미기 복구함','이전 모습 기록 복구 새로고침 스타일 프리셋 보관'],
 ['theme','colors','가독성 확인 · 색 보정','글자 배경 형광펜 대비 안보임 흐림 보정'],
 ['chat','screen','생성·편집 중 날씨 쉬기','자동 일시정지 재개 답변 타이핑 편집 날씨 성능'],
 ['theme','backup','설정 일부 잠그기','잠금 유지 스타일 프리셋 글꼴 크기 문단 여백 색 프로필'],
 ['chat','screen','날씨 글 읽기 우선','가독성 보호 자동 그림자 날씨 농도'],
 ['theme','changes','변경한 설정·항목별 복원','변경 내역 기본값 다른 바꾼 설정 목록 초기화 원래대로 항목 하나만 되돌리기 복원 실수'],
 ['theme','palette','테마 색과 밝기','배경 진하기 테마색 농도 차콜 색감 퍼센트 0.5% 1% 20% 팔레트 화이트 나이트 밝은 어두운 다크모드 라이트모드 블루 레몬 피치 복숭아 자몽 라벤더 딸기 민트 오렌지 우드 갈색 수박 초록 빨강 커스텀 테마 선택 자동 기준 기기 다크 모드 나이트 시작 화이트 시작'],
 ['theme','icons','단추 아이콘','아이콘 단추 바꾸기 닫기 엑스 되돌리기 다시 실행 찾기 검색 돋보기 전체 화면 작은 창 목록 더 보기 추가 확인 이전 다음 뒤로 처음 값 내 그림 PNG SVG WebP 이모지 글자 Font Awesome 폰트어썸 상단 서랍 연결 API 프리셋 AI 응답 설정 고급 서식 월드 인포 사용자 설정 배경 확장 페르소나 캐릭터 입력줄 옵션 메뉴 요술봉 보내기 이어 쓰기 대신 쓰기 멈춤 전개 지시 깃털 보내기 번역 말풍선 화면에서 고르기 내 단추 확장 단추 메시지 단추'],
 ['theme','colors','테마 세부 색','바탕 배경 종이 카드 포인트 강조 형광펜 글자색 색깔 변경 색상 투명 색 고치기'],
 ['theme','styles','스타일 저장·공유','프리셋 스타일 저장 불러오기 삭제 이름 변경 공유 코드 내보내기 가져오기 캐릭터별 연결 자동 적용 소설책 메신저 되돌리기'],
 ['theme','backup','설정 백업·복원','백업 복원 파일 json 내보내기 가져오기 초기화 리셋 설정 전체 저장'],
 ['theme','palette','설정창 전체 화면·닫기·되돌리기','되돌리기 취소 앞으로가기 다시실행 실행취소 undo redo 전체화면 전체 화면 크게 넓게 설정창 팝업 작은창 작은 창 닫기 종료 나가기 엑스 x'],
 ['text','text','본문 글꼴과 크기','글자 글씨 폰트 글꼴 크기 굵기 자간 줄 높이 행간 언어 한글 영어 일본어 중국어 한자 구글 폰트 업로드 CSS 링크 한자 漢字'],
 ['text','dialogue','대사·형광펜','대사 따옴표 형광펜 직사각형 알약 둥근 끝 동그란 네모 반듯 일자 펜 자국 모양 밑줄 기울기 대각선 위치 굵기 진하기 색 글자 폰트 자간 크기 전체 칠 본문 글꼴과 같게'],
 ['text','ui','메뉴 글자','메뉴 설정창 버튼 글자 글씨 크기 굵기 자간 폰트 글꼴 본문 글꼴과 같게'],
 ['text','em','속마음 글자','속마음 기울임 이탤릭 별표 보라색 글자 색 크기 굵기 자간 폰트 기울여 쓰기 본문 글꼴과 같게'],
 ['text','strong','강조 글자','강조 굵은 글씨 볼드 별표 두개 글자 색 크기 굵기 자간 폰트 본문 글꼴과 같게'],
 ['text','code','코드 글자','코드 백틱 도트 글꼴 네오둥근모 글씨 색 크기 굵기 자간 폰트 본문 글꼴과 같게'],
 ['text','para','문단·줄·글자 간격','문단 간격 들여쓰기 첫줄 정렬 왼쪽 가운데 오른쪽 양쪽 줄바꿈 자간 행간 글 폭 가독성 읽기 폭 PC 본문 최대 폭'],
 ['image','cutedge','투명 그림 외곽선 · 그림자','투명 배경 캐릭터 컷 에셋 생성 그림 이미지 외곽선 테두리 둘레 실루엣 윤곽 그림자 붕 떠 보임 떠있는 두께 진하기 퍼짐 블러 흐림 각도 거리 투명도 색 가장자리 색 맞추기 칸 밖 잘림 그림 칸 밖으로도 그리기 프리셋 자동 밝은 테두리 은은한 빛 네온 테두리 깔끔한 테두리 종이 그림자 스티커 그림자만 끄기 어두운 화면 밝은 화면 검은 옷 묻힘 글로우 림'],
 ['text','shadow','글자 그림자·외곽선','글자 글씨 본문 그림자 외곽선 테두리 가독성 색 진하기 투명도 각도 거리 번짐 퍼짐 두께 대상 대사 속마음 강조'],
 ['chat','message','내 메시지 모양','말풍선 카드 테이블 글자만 사용자 내 메시지 채팅 모양 이름 줄 시간 숨김 작은 아바타 숨기기 글자 크기 진하기'],
 ['chat','message','캐릭터 메시지 말풍선','캐릭터 상대 봇 AI 답 메시지 말풍선 버블 카톡 카카오톡 메신저 글자만','','chat.char'],
 ['chat','message','말풍선 나누기','말풍선 나누기 통으로 하나로 엔터 두 번 빈 줄 문단마다 따로 카톡 카카오톡 메신저 내 메시지 캐릭터 메시지 버블','','chat.bubbleSplit'],
 ['chat','screen','퀵 리플라이 · QR','qr 큐알 퀵리플라이 퀵 리플라이 quick reply 빠른답장 빠른 답장 단축답장 편집 검색 돋보기 숨기기 끄기 켜기 토글 자리 위치 입력창 위 아래 가로 세로 스크롤 줄 검색 버튼 보이는 줄 넘기기','퀵 리플라이'],
 ['chat','screen','QR 검색 버튼','퀵리플라이 검색 버튼 돋보기','','chat.qrFind'],
 ['chat','screen','QR 책장','퀵리플라이 QR 책장 모아 보기 즐겨찾기 최근 이 봇 캐릭터 채팅 세계관 카테고리 분류 미분류 이름 설명 붙이기 숨기기 AI 정리 자동 분류 보관함 많은 QR 정리 shelf bookshelf','','qrShelf.on'],
 ['chat','screen','QR 접기 단추','퀵리플라이 접기 펴기 숨기기 토글 단추 줄 접힘 간이 바 토글','','chat.qrFold'],
 ['chat','screen','하위 목록 단추에 세트 이름','퀵리플라이 QR 세트 이름 ⋮ 하위 목록 묶음','','chat.qrCtxNames'],
 ['chat','screen','채팅 화면·아이콘','아이콘 선 기본 배경 이미지 비치기 채팅 바탕 농도 불투명 투명 메시지 버튼 고정 꺼내기 번역 버튼 점 세 개 메뉴 고르기 목록 팝업 색 고르기 팝업 모델 프리셋 선택창'],
 ['chat','screen','새로고침 화면','새로고침 시작 로딩 레몬 로고 뇌 splash', '새로고침 화면'],
 ['chat','screen','탭 아이콘','탭 아이콘 파비콘 favicon 레몬 로고 ST 브라우저 홈 화면 바로가기 앱 아이콘', '탭 아이콘'],
 ['image','layout','미리보기 확대·축소·이동','미리보기 예시 확대 축소 돋보기 배율 원래 크기 초기 크기 이동 드래그 핀치 손가락 줌 높이 가변 크기 손잡이 한줄 넓게 늘리기 줄이기 기본 높이'],
 ['chat','screen','페르소나 입력창 높이 2배','페르소나 본문 설명 입력창 입력칸 세로 높이 길게 두 배 2배', '', 'chat.personaTall'],
 ['chat','screen','채팅 입력칸 숨기기','채팅 입력칸 입력창 텍스트 글 쓰는 칸 숨기기 없애기 끄기 단추만 버튼만 보내기 빠른 답장 퀵 리플라이 QR 입력줄', '', 'chat.hideSendTextarea'],
 ['chat','screen','웹 검색 · 출처 표시','웹 검색 인터넷 검색 지구 아이콘 출처 꾹 누르기 길게 누르기 낱말 단어 카드 로어북 기억 지시 프리셋 지어냄 검색 표시 어디서 왔는지 진동 기록 없음 단어 검색 꾹 눌러 검색', '', 'chat.webSearchMarks'],
 ['chat','screen','큰 숫자는 쉼표로','숫자 쉼표 천 단위 자릿수 구분 콤마 30,000 컨텍스트 최대 토큰 숫자 칸 입력칸', '', 'chat.numComma'],
 ['chat','screen','글자색 대비 맞추기','글자색 대비 가독성 안 보임 묻힘 어두운 색 밝은 색 인라인 색 font color 퍼스널 컬러 나이트 라이트', '', 'chat.inkContrast'],
 ['chat','screen','가벼운 페이드 인','스트리밍 새 글자 페이드인 스며들기 빨라지기 속도 버벅임 애니메이션 실리태번 페이드 인', '', 'chat.streamFade'],
 ['chat','screen','숨긴 메시지 흐리게','숨긴 메시지 컨텍스트에서 뺀 메시지 눈 감은 아이콘 옅게 흐리게 진하기 흑백 회색 마우스 올리면 진하게','','chat.hiddenFade'],
 ['chat','screen','추론 요청을 끄면 지난 추론도 숨기기','추론 생각 사고 thinking reasoning 모델 추론 요청 생각 칸 숨기기 가리기 지난 이전 예전 메시지', '', 'chat.reasoningFollow'],
 ['chat','screen','날씨 효과','날씨 비 눈 꽃잎 하트 별 배경 효과 세기 크기 속도 각도 이미지 내 그림 트래커 그림 효과 사용 그림 스타일 그림체 안개 모양 안개 위치 가장자리 선명하게 부풀기 깊이감 그림자 모양 그림자 흐리기 유성우 곡률 원 크기 도는 방향 둘째 날씨 세기 내 메시지 농도 비침 날씨 색 색상','날씨'],
 ['chat','screen','날씨 그림 효과','날씨 그림 효과 사용 그림 스타일 그림체 일러스트 외곽선','','chat.weatherIllustrated'],
 ['chat','screen','날씨 · 내 메시지 비침','날씨 내 메시지 농도 비침 비치기 내 말 위 날씨','','chat.weatherBubble'],
 ['chat','screen','장면 소리','장면 소리 배경 소리 빗소리 비 소리 바람 소리 천둥 물결 파도 환경음 앰비언트 ambient 날씨 소리 소리 크기 볼륨 내 소리 파일 화면 밖에서도 TTS 효과음 겹침','','sceneSound.on'],
 ['chat','screen','분위기 음악','분위기 음악 배경 음악 BGM 브금 음악 크기 일상 긴장 전투 로맨스 슬픔 신비 축제 분위기 고정 내 곡 덕킹','','sceneSound.music.on'],
 ['chat','screen','모바일 바·한 손 버튼','폰 모바일 스크롤 바 숨기기 자동 숨김 몰입 읽기 한손 한 손 버튼 스와이프 사칭 이어쓰기 다시생성 맨 위로 맨 아래로 번호로 가기 이동 점프 마지막 메시지 지우기 스크롤하면 바 숨기기','폰'],
 ['prompt','deus','글자색 통일·톤 보정','본문 글자 색 지정 색 통일 퍼스널 컬러 색상 채도 밝기 화이트 나이트 원문 색 정규식 보라색 톤 형광펜 톤 띠 색 맞추기','색 통일'],
 ['chat','etc','다른 CSS와 충돌','커스텀 css 끄기 충돌 다른 테마 사용자 스타일 모양 이상 겹침','다른 CSS'],
 ['chat','etc','「확장 탭에 보이기」 줄','확장 탭 보이기 줄 확장 창 맨 위 제목 줄 스위치 꺼내기 확장 위 스위치 숨기기 끄기 켜기','','headSwitchRows'],
 ['chat','etc','로그 복사','로그 복사 서식 복사 그대로 복사 보이는 그대로 복사 글꾸 글 꾸미기 커뮤니티 게시판 붙여넣기 HTML 코드 마크다운 대화 색 글꼴 자간 메신저 말풍선 카드 탭 드래그 선택','','logCopy.on'],
 ['chat','etc','단추 길게 누르면 설명 보기','길게 누르기 꾹 누르기 단추 설명 도움말 무슨 기능 뭐하는 버튼 툴팁 풍선 마우스 올리기','','longpressHelp'],
 ['chat','etc','API 서버 상태','API 서버 상태 공식 상태 페이지 장애 서버 다운 터짐 느림 점검 status 스테이터스 클로드 제미니 오픈AI 딥시크 오픈라우터 연결 상태 점 아파요 server status outage','','apiStatus.on'],
 ['chat','etc','프롬프트 켜짐 묶음','프롬프트 켜짐 묶음 저장 빠른 전환 켜고 끈 상태 조합 칩 되돌리기 짧게 길게 프리셋 항목 상태 저장 불러오기 prompt toggle snapshot preset quick switch','','promptSaves.on'],
 ['chat','etc','프리셋 목록 폴더','프리셋 목록 폴더 프리셋 고르기 드롭다운 정리 폴더로 묶기 순서 채팅 완성 프리셋 많을 때 preset folders dropdown','','presetFolders.on'],
 ['chat','etc','최근 채팅 · 채팅 폴더','최근 채팅 채팅 폴더 채팅 정리 대화 목록 캐릭터 넘나들기 고정 핀 찾기 검색 여러 개 지우기 삭제 일괄 정리 캐릭터 관리 탭 chatsplus chats plus recent chats folders','','chatOrganizer.on'],
 ['chat','etc','고른 글 고치기','고른 글 고치기 부분 수정 고치기 드래그 오타 오역 이름 한 문장 바꾸기 편집 고른 글 도구 줄 selection edit fix typo','','quick.selEdit'],
 ['chat','etc','번역문도 고치기','번역문도 고치기 고른 글 고치기 번역 메시지 번역문 수정 화면 번역 고치기 오역 selection edit translation display text','','quick.selEditTr'],
 ['chat','etc','로어북 스캔에서 상태창 글 빼기','로어북 스캔에서 상태창 글 빼기 월드인포 키워드 상태창 트래커 코드 칸 접는 칸 엉뚱한 항목 켜짐 스캔 제외 lorebook world info scan exclude status','','quick.wiSkip'],
 ['chat','etc','퀵 리플라이 줄 접기','퀵 리플라이 줄 접기 QR 바 숨기기 펼치기 요술봉 옆 단추 빠른 답장 줄 접기 simple qr bar toggle quick reply collapse','','quick.qrFold'],
 ['theme','palette','채팅방마다 다른 에이드','채팅방마다 다른 에이드 캐릭터별 팔레트 채팅별 테마 색 기억 에이드 갈아입기 per chat palette','','quick.adeChat'],
 ['theme','palette','오늘의 에이드','오늘의 에이드 날마다 바뀌는 팔레트 매일 다른 테마 색 에이드 갈아입기 daily palette rotate','','quick.adeDaily'],
 ['chat','etc','연필 옆 지우기 단추','연필 옆 지우기 단추 메시지 지우기 삭제 휴지통 한 번에 빨리 지우기 메시지 단추 delete message trash','','quick.mesDelete'],
 ['chat','etc','메시지 범위 지우기','메시지 범위 지우기 범위 삭제 중간 메시지 여러 개 지우기 사이만 처음 끝 골라 지우기 옵션 메뉴 range delete messages','','quick.rangeDelete'],
 ['chat','etc','프롬프트 폴더','프롬프트 폴더 그룹 묶기 묶음 접기 펼치기 프롬프트 관리자 토글 정리 구분선 자동 하나만 켜기 택1 전체 켜기 끄기 prompt folders','','promptFolders.on'],
 ['chat','etc','한국어 화면 다듬기','실리태번 한국어 한글 한글화 영어로 남은 글 어색한 말 화면 글 다듬기','','koUi'],
 ['chat','etc','빈 채팅 덮어쓰기 막기','빈 채팅 날아감 덮어쓰기 저장 막기 채팅 사라짐 메시지 사라짐 없어짐 비었어요 불러오기 실패 보호 저장 정리 성능 보조','채팅 저장','chat.emptyGuard'],   // 1.0.0 중복 정리: 성능 보조 › 저장 정리 하나로
 ['chat','etc','AI 로 설정 바꾸기','AI 인공지능 자연어 말로 설정 바꾸기 검색창 맡기기 연결 프로필 토큰 요청','설정 찾기','searchAi.on'],
 ['chat','etc','다른 기기 변경 알림','다른 기기 폰 PC 컴퓨터 동기화 싱크 바뀜 덮어쓰기 띠 알림 묻기','','syncWatch'],
 ['image','layout','에셋 사진 배치','에셋 이미지 사진 가로 꽉 영화관 좌우 여백 채우기 본문 폭 작게 배치'],
 ['image','shape','에셋 모양·모서리','에셋 이미지 네모 도형 마스크 투명 png 커스텀 모양 저장 불러오기 둥근 모서리 라운드 누끼 캐릭터 컷 투명 그림도 똑같이 맞추는 법'],
 ['image','frame','에셋 테두리·그림자','에셋 이미지 사진 그림자 테두리 외곽선 얇은 선 이중선 선 종류 실선 점선 파선 빛 두께 색 진하기 면 여백 번짐 확장 거리','그림자'],
 ['image','size','에셋 이미지 크기','에셋 사진 이미지 크기 높이 최대 세로 화면 비율 높이 맞춤 자르기'],
 ['image','shape','에셋 가장자리 흐림','에셋 이미지 사진 흐림 번짐 가장자리 페이드 위아래 옆 투명 흰 배경 지우기'],
 ['prompt','deus','데우스 프롬프트 호환','데우스 dem deus 엑스 마키나 프롬프트 호환 켜기 끄기 트래커 장면 계획 상태 카드 접기 폰 색 통일 이모티콘 카드 스킨 폰에서 접어 두기'],
 ['prompt','deus','데우스 상태창 글자','데우스 상태창 글자 꾸미기 글꼴 크기 굵기 자간 줄간격 기울임 정렬 줄바꿈 상태창 종류 시간 표시 트래커 상태창 스토리 떡밥 심리 상태 줄거리 흐름 모멘텀 엔진 갈등 블록 장면 계획 씬 플랜 씬플랜 scene plan 선택지 목록 cyoa 관계 한편 meanwhile 숨은 진실 hidden truths 물밑 흐름 undercurrents 퇴고 메모 scratchpad 친구들 companions OOC 쪽지 형식 확인 알림 모듈 묶음 탭 인물 칩 생각 계획 thinking plan 본문 끝 별 ✦ 장식 색 아이콘 구분선 강조색','상태창 글자'],
 ['prompt','sola','솔라 빠른 설정','솔라 sola 빠른 설정 빠른 토글 QR 퀵리플라이 옵션 프리셋 토글 선택 입력창 켜기 끄기','솔라 빠른 설정'],
 ['prompt','sola','솔라 상태창 글자','솔라 sola 상태창 글자 서랍 카드 꾸미기 글꼴 크기 굵기 자간 줄간격 정렬 줄바꿈 장식 색 공동 작가 OOC 전개 속도 감정 엔진 유대 케미 생각 서랍 생각 엔진 달력 연대기 옷차림 소지품 장비 장면 인물 연출 노트 이야기 씨앗 인물 특성 매트릭스 마음 엔진 속마음 흐름 바람의 화살 연출 이젤 HUD 수다방 생각 캡슐 쪽지','상태창 글자'],
 ['prompt','fruit','과일 상태창 글자','과일 청과 야한과일 상태창 글자 꾸미기 글꼴 크기 굵기 자간 줄간격 정렬 줄바꿈 장식 색 상태창 종류 글머리 문구 간결 1인 상태창 소설 제목 첫머리 서문 슈퍼 서문 냥냥 선택기 선택지 글자만 극장 소극장 요약 유령 방송 포럼 소문 게시판 편지함','상태창 글자'],
 ['prompt','deus','데우스 카드 스킨','카드 스킨 트래커 장면 계획 상태 카드 테마 모양 폰에서 접어 두기 접기','','chat.demSkin'],
 ['prompt','deus','데우스 프롬프트 색 그대로','프롬프트 색 그대로 데우스 글자색 형광펜 색을 어디에 글자 띠','','chat.demInk'],
 ['prompt','deus','데우스 대사 색·가독성','데우스 프롬프트 대사 색 형광펜 가독성 향상 그림자 외곽선 글자 배경 묻힘 두께 진하기 거리 번짐','대사 색상 가독성 향상'],
 ['prompt','deus','데우스 감정 대사 효과','데우스 expressive dialogue 감정 대사 효과 애니메이션 움직임 외침 떨림 빛 색 흐름 무지개 애니메이션 줄이기 절전 기기설정 무시 효과 살리기 색 흐름을 어디에','감정 대사 효과'],
 ['chat','screen','트래커 날씨 연결','데우스 트래커 날씨 비 눈 채팅 뒤 효과 자동 연결 트래커 날씨로 날씨 효과','날씨'],   // 1.0.0 중복 정리: 채팅 › 화면 › 날씨의 「트래커」 하나로
];
for (const [sub, name, alias] of [['profile','캐릭터','캐릭터 봇 상대'],['user-profile','내','내 나 유저 사용자 페르소나']]) {
 const owner = sub === 'profile' ? 'profile' : 'userProfile';
 rows.push(['chat',sub,`${name} 프로필 표시 · 꾸미기`,`${alias} 사진 크기 자르기 흐림 장식 액자 테두리 위치`, '', `${owner}.mode`]);
 const namesub = sub === 'profile' ? 'name' : 'user-name';
 rows.push(['chat',namesub,`${name} 정보 정렬`,`${alias} 이름 시간 날짜 번호 토큰 정렬 왼쪽 가운데 중앙 오른쪽 메신저 말풍선 작은 프로필 없음`, '', `${owner}.nameRowAlign`]); // 5.8.3 큰 프로필이 아닐 때
 rows.push(['chat',namesub,`${name} 이름 글꼴·꾸미기`,`${alias} 이름 폰트 글꼴 언어 크기 굵기 자간 색 정렬 왼쪽 중앙 가운데 오른쪽 기울임 밑줄 외곽선 그림자`, '이름 글자'],
 ['chat',namesub,`${name} 시간·버튼 배치`,`${alias} 이름 시간 날짜 버튼 점세개 메뉴 편집 연필 모델 아이콘 통계 토큰 번호 한줄 두줄 옆 아래 간격 진하기 정렬 줄 위치`, '']);
}
rows.push(['extensions','words','단어 치환','단어 바꾸기 낱말 치환 조사 규칙 되돌리기 잠시 가리기 가림 숨기기 스포일러'],['extensions','capture','채팅 캡처','이미지 사진 저장 메시지 다중 선택'],['extensions','capture','캡처 필터 · 색감','캡처 필터 필름 그레인 노이즈 자글자글 지글지글 입자 흑백 모노 무채색 빈티지 세피아 옛날 사진 색감 색 보정 밝기 대비 채도 색온도 따뜻하게 차갑게 비네트 가장자리 어둡게 프리셋 초기화','','captureTools.filterPreset'],['extensions','order','확장 순서','패널 고정 순서 정렬'],['extensions','perf','성능 보조','끊김 감시 응답 멈춤 스트리밍 멈춤 다시 받기 요청 로그 로딩 시간 시작 시간 저장 정리'],['chat','screen','날씨 움직임','레몬 꽃잎 유성 낙하 회전 흔들림 커스텀'],['theme','palette','내 에이드 보관함','커스텀 여러개 저장 불러오기'],
 ['extensions','models','모델 등록','모델 이름 직접 추가 등록 공급자 목록에 없는 새 모델 커스텀 모델'],
 ['extensions','direction','전개 지시','전개 지시 감독 이야기 다음 장면 깃털 프롬프트 깊이'],
 ['extensions','assets','캐릭터 에셋','이미지 그림 사진 에셋 프리셋 업로드 묶음 캐릭터'],
 ['extensions','translator','LLM 번역','번역 LLM 단독 확장 탭 표시 숨기기 용어집 선택 번역'],
 ['extensions','translator','번역 프롬프트 기본값으로 되돌리기','번역 프롬프트 기본값 기본 값 초기화 처음 값 원래대로 되돌리기 복구 채팅 번역 재번역 교정 지침교정 문단 수 맞추기 입력 번역 보내기 번역 프리필'],
 ['extensions','translator','입력창에 DB 관리 단추 두기','번역 DB 관리 단추 llm번역DB관리 퀵 리플라이 퀵리플라이 Quick Reply QR 입력창 숨기기 없애기 끄기 지우기 DB 관리 도구 준비'],
 ['extensions','bookmarks','북마크','북마크 책갈피 즐겨찾기 메시지 표시 메모 모아 보기 찾기 이동 앞뒤 문맥 다른 채팅'],
 ['extensions','models','모델 전환','번역 다시 쓰기 모델 한번에 바꾸기 중계 공식 API 조합 저장 주소 잠금 공급자 전환'],
 ['extensions','perf','프롬프트 연동 정규식','정규식 프롬프트 연동 모듈 모멘텀 엔진 상태창 선택지 끄기 켜기 자동 스트리밍 가볍게 데우스 regex'],
 ['extensions','rewrite','다시 쓰기','금지 묘사 금지어 밴 단어 문장 고치기 다시 쓰기 안경 수염 외모 묘사 씬 플랜 리롤 장면 계획 예외 캐릭터 AI 프롬프트 규칙 사용법'],
 ['extensions','perf','확장 충돌 검사','확장 충돌 진단 검사 겹침 중복 설치 두 번 슬래시 명령 매크로 전역 설정 키 id 단축키 덮어쓰기 몽키패치 fetch important 오류 점검 보고서 결과 복사 GitHub 링크 설치 전 검사 AI 검토 extconflict 충돌 검사기','확장 충돌 검사'],
 ['theme','update','테마 업데이트','업데이트 확인 새 판 새 버전 판 번호 버전 목록 설치된 판 애드온 판 확장 버전 새로고침 GitHub 최신'],
 ['theme','update','설치 · 충돌 점검','설치 점검 파일 상태 무결성 충돌 다시 검사 설치 ZIP 새 판 파일 버전 섞임 설치 오류 재설치'],
 ['theme','etc','처음 설정 다시 보기','처음 설정 첫 실행 시작 안내 온보딩 튜토리얼 따라하기 단계 팔레트 글꼴 폰트 읽기 방식 다시 고르기','처음 설정 다시 보기'],
 ['chat','etc','입력칸 높이 고정','입력칸 높이 고정 입력창 다섯 줄 안쪽 스크롤 자동 수정 밑줄 파란 밑줄 낱말 위치 어긋남 튐 다른 줄 input height fixed','','inputBox.hold'],
 ['chat','etc','자동 수정 밑줄 끄기','자동 수정 밑줄 끄기 입력창 맞춤법 표시 파란 밑줄 빨간 밑줄 자동 고침 끄기 autocorrect spellcheck off','','inputBox.noCorrect'],
 ['chat','etc','진단 복사 · 진단 파일','진단 복사 진단 파일 제보 오류 버전 켜진 기능 JSON 최근 오류 번역 중단 이유'],
 ['theme','etc','사용 모드','테마만 확장만 테마 확장 함께 실행 기타 설정 다른 테마 쓰기 확장만 쓰기'],
 ['theme','etc','새 버전 자동 확인','업데이트 새 버전 새 판 자동 확인 알림 판 알약 공지사항 GitHub','','updateCheck'],
 ['theme','etc','다른 확장 색 유지','외부 확장 원래 색 글자 배경 CSS 색상 보존 덮어쓰기 해제 확장 팝업 설정창 확장별 선택 일부만 빼기','','compat.preserveExtensionColors'],
 ['chat','screen','백그라운드에서도 계속','백그라운드 다른 앱 앱 전환 탭 잠 멈춤 소리 없이 무음 작은 창 pip 버티기 번역 계속 버티는 방식','', 'bgWindow.on'],
 ['chat','screen','이전 메시지 저절로 불러오기','이전 메시지 더 보기 더보기 자동 저절로 불러오기 위로 스크롤 옛 메시지 지난 대화 무한 스크롤 show more messages','', 'chat.showMoreAuto'],
 ['chat','screen','아바타는 가까워질 때 받기','아바타 썸네일 지연 로딩 느리게 받기 가까워질 때 캐릭터 목록 페르소나 목록 캐릭터 많을 때 가볍게 lazy 성능','', 'chat.lazyAvatars'],
 ['chat','screen','검색은 글자 조합이 끝난 뒤','캐릭터 월드인포 로어북 페르소나 채팅 파일 그룹 멤버 검색 한글 조합 입력 중 디바운스 느림 멈칫 검색 칸 가볍게 성능 ime','', 'chat.searchIme'],
 ['chat','screen','코드 색 입히기 끄기','코드 블록 코드블록 구문 강조 하이라이트 색 끄기 hljs 코드 많은 채팅 폰 느릴 때 가볍게 성능','', 'chat.codePlain'],
 ['chat','screen','월드인포 긴 목록 가볍게','월드인포 월드 인포 로어북 항목 많을 때 긴 목록 스크롤 끊김 가볍게 성능 content-visibility','', 'chat.worldInfoLight'],
 ['chat','screen','긴 채팅의 화면 밖 메시지 가볍게','긴 채팅 메시지 많을 때 화면 밖 메시지 가볍게 타이핑 끊김 글자 지연 페르소나 설명 전개 지시 입력 느림 성능 content-visibility 60개','', 'chat.chatLight'],
 ['chat','screen','입력 중 목록 갱신 미루기','페르소나 설명 입력 타이핑 끊김 버벅 글자 지연 폰 모바일 목록 카드 설명 갱신 미루기 성능 저장','', 'chat.personaDefer'],
 ['chat','screen','새 답 첫 줄로 가는 단추','새 답 첫 줄 맨 위로 처음으로 화살표 위 아이콘 긴 답 답변 시작 위치 점프 이동 단추','', 'chat.replyTop'],
 ['chat','screen','토큰 수 누르면 내역','토큰 수 내역 생각 본문 총 프롬 프롬프트 다음 답 들어가는 양 정규식 숨긴 메시지','', 'chat.sentTokens'],
 ['chat','screen','답이 오면 알려 주기','알림 진동 푸시 답 도착 완료 알려 주기 다른 앱 폰 백그라운드','', 'replyNotify.on']);
const markdownAliases = {
 size:'h1 h2 h3 h4 h5 h6 헤딩 큰글씨 작은글씨', space:'여백 간격 문단 촘촘히 넉넉히', heading:'h1 h2 h3 h4 h5 h6 헤더 헤딩 밑선',
 hr:'hr 수평선 가로선 장면 전환 별표 세개 점 세개 선', quote:'blockquote 인용 문장 옆선 배경', list:'ul ol 글머리 기호 번호 숫자 순서 중첩 체크리스트 체크박스',
 link:'a 링크 하이퍼링크 주소 URL 밑줄', table:'table 표 행 열 테이블 줄무늬', details:'details summary 접기 펼치기 요약 카드', mark:'mark 하이라이트 형광 표시', underline:'u 밑줄 물결',
 listMark:'글머리 기호 모양 목록', strongStyle:'strong 굵은 강조 형광펜', inlineCode:'code 코드 글자 상자', tableHead:'표 헤더 머리행 제목 행',
};
for (const { key, label, options } of MARKDOWN_CONTROLS) rows.push(['text','markdown',`마크다운 · ${label}`,`markdown 마크다운 ${markdownAliases[key]} ${options.map(([,name])=>name).join(' ')}`,'',`markdown.${key}`]);
for (const {key,label,group} of MARKDOWN_TUNING) rows.push(['text','markdown',`마크다운 · ${MARKDOWN_CONTROLS.find(c=>c.key===group).label} · ${label}`,`마크다운 꾸미기 ${markdownAliases[group]} ${label}`,'',`markdown.${key}`]);
rows.push(['text','markdown','마크다운 · 장식 색 직접 고르기','마크다운 꾸미기 색 색상 포인트 직접 선택','','markdown.accentOwn'],['text','markdown','마크다운 · 장식 색','마크다운 꾸미기 색 색상 포인트','','markdown.accentColor']);
const tabs={extensions:'확장',theme:'테마',text:'글자',chat:'채팅',image:'이미지',prompt:'프롬프트'};
const subs={mermaid:'Mermaid 도표',cutedge:'투명 그림',zipinstall:'ZIP 설치',tts:'TTS',notes:'메모',strike:'취소선',direction:'전개 지시',assets:'캐릭터 에셋',prompt:'한글화 패널',customstyle:'커스텀 CSS 조절','prompt-template':'프롬프트 템플릿',translator:'LLM 번역',words:'단어 치환',capture:'채팅 캡처',order:'확장 순서',perf:'성능 보조',models:'모델 관리',modelswitch:'모델 전환',regexlink:'프롬프트 연동 정규식',rewrite:'다시 쓰기',bookmarks:'북마크',scripts:'스크립트',update:'업데이트',changes:'변경한 설정',palette:'색',colors:'색 고치기',icons:'단추 아이콘',custom:'직접 테마 만들기',styles:'스타일',backup:'백업',text:'본문',dialogue:'대사',ui:'메뉴',em:'속마음',strong:'강조',code:'코드',para:'문단',shadow:'그림자 · 외곽선',message:'메시지',screen:'화면',etc:'기타',layout:'배치',shape:'모양',frame:'테두리',size:'크기',fade:'흐림',deus:'데우스 엑스 마키나',sola:'솔라',fruit:'과일 계열',profile:'캐릭터 프로필','user-profile':'내 프로필',name:'캐릭터 이름·시간','user-name':'내 이름·시간'};
subs.markdown = '마크다운';
const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/^\s*(?:\*\s*){3,}$/,'구분선').replace(/퀵\s*리플라이|quick\s*repl(?:y|ies)|큐알|\bqr\b/g,'퀵리플라이').replace(/프사|아바타/g,'프로필').replace(/글씨|글자\s*간격/g,m=>m==='글씨'?'글자':'자간').replace(/확대\s*축소/g,'확대 축소').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
// 한글을 초성 · 자모로 풀어 둔다: 'ㅂㄱ' → 배경, '배겨'(치다 만 글자) → 배경, 한 글자 틀린 말도 찾는다.
const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ', JUNG='ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ', JONG=['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const syllable=c=>{const k=c.charCodeAt(0)-0xAC00;return k>=0&&k<11172?k:-1;};
export const chosung=text=>[...String(text)].map(c=>{const k=syllable(c);return k<0?c:CHO[Math.floor(k/588)];}).join('');
export const jamo=text=>[...String(text)].map(c=>{const k=syllable(c);return k<0?c:CHO[Math.floor(k/588)]+JUNG[Math.floor(k%588/28)]+JONG[k%28];}).join('');
// 6.9.5 자판 순서: 겹모음 · 겹받침을 누른 차례대로 편다 (ㅘ → ㅗㅏ, ㄺ → ㄹㄱ). 치는 중의 글자('호' · '확ㅈ' · '갑' · '닭')가 다 친 낱말('확장' · '가방' · '달걀')의 앞부분이 된다
const SPLIT={'ㅘ':'ㅗㅏ','ㅙ':'ㅗㅐ','ㅚ':'ㅗㅣ','ㅝ':'ㅜㅓ','ㅞ':'ㅜㅔ','ㅟ':'ㅜㅣ','ㅢ':'ㅡㅣ','ㄳ':'ㄱㅅ','ㄵ':'ㄴㅈ','ㄶ':'ㄴㅎ','ㄺ':'ㄹㄱ','ㄻ':'ㄹㅁ','ㄼ':'ㄹㅂ','ㄽ':'ㄹㅅ','ㄾ':'ㄹㅌ','ㄿ':'ㄹㅍ','ㅀ':'ㄹㅎ','ㅄ':'ㅂㅅ'};
export const keystrokes=text=>[...jamo(text)].map(c=>SPLIT[c]||c).join('');
// 말하듯 · 증상으로 쓴 문장(「글씨가 작아」 「밤에 눈부셔」 「채팅이 느려」)은 사전(settings-intents.js)이 읽어요 — 검색창을 처음 쓸 때 받아요
let dict = null, dictLoading = null;
export function loadIntents() { return dictLoading ||= import('./settings-intents.js').then(m => (dict = m), error => { dictLoading = null; throw error; }); }
// 결과 줄에서 바로 바꾸지 않는 것: 테마 전체 끄기 · 알림 허용(기기마다 묻는 창이 떠야 해요) · 확장 켬
const NOT_QUICK = new Set(['enabled', 'replyNotify.on']);
export const quickAllowed = path => typeof path === 'string' && !NOT_QUICK.has(path) && !/^(addons|addonUI)\./.test(path);
const STOP=new Set(['설정','편집','변경','바꾸기','바꾸고','바꿀','싶어','싶어요','싶은데','싶다','어떻게','어디서','어디','해줘','해주세요','하는','하려면','하고','있어','있나','있나요','없어','없나','너무','좀','조금','약간','그냥','이거','저거','그거','뭐','왜','제발','하면','되나','되나요','돼','할','수','것','거','법','방법','알려줘','찾아줘','하게','해','줘']);
const ENDING=/(?:으로|에서|에게|한테|이랑|하고|하게|해서|인데|은데|는데|이요|예요|에요|어요|아요|나요|가요|고요|이야|이에요|들|을|를|은|는|이|가|도|만|의|에|로|와|과|랑|요)$/u;
const stem=word=>{let w=word;for(let i=0;i<2;i++){const next=w.replace(ENDING,'');if(next===w||next.length<1)break;w=next;}return w;};
// 자모 편집 거리가 k 이하인지 (넘으면 바로 멈춰요) — 제목 전체 오타 · 사전(settings-intents.js)이 같이 써요
export function within(a, b, k) {
 if (Math.abs(a.length - b.length) > k) return false;
 let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
 for (let i = 1; i <= a.length; i++) {
  const cur = [i]; let best = i;
  for (let j = 1; j <= b.length; j++) {
   const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
   cur.push(v); if (v < best) best = v;
  }
  if (best > k) return false;
  prev = cur;
 }
 return prev[b.length] <= k;
}
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
// 결과 줄 길 표시: 합친 화면은 「글자 › 글자 모양 · 취소선」 「채팅 › 이름 · 시간 · 나」처럼 설정 창 머리 · 칩 이름 그대로. 목록 칸에서만 줄여 부르는 이름(「데우스」)은 쓰지 않아요
const crumb=(tab,sub)=>{const m=mergedOf(tab,sub);return tabs[tab]+' › '+(m?`${m.label} · ${m.chips?.[sub]||subs[sub]}`:subs[sub]);};
export const SEARCH_ENTRIES = rows.map(([tab,sub,title,aliases,anchor='',path=''],id)=>{
 const words=[...new Set(normalize(title+' '+aliases).split(' '))];
 const titleWords=normalize(title).split(' ');
 return {id,tab,sub,title,anchor,path,breadcrumb:crumb(tab,sub),words,compact:words.join(''),
  titleCho:chosung(titleWords.join('')),cho:words.map(chosung),jamoWords:words.map(jamo),titleJamo:titleWords.map(jamo),titleKeys:titleWords.map(keystrokes),wordKeys:words.map(keystrokes),titleTyped:keystrokes(titleWords.join('')),titleAll:jamo(titleWords.join(''))};
});
// NFKC 가 ㅂ(호환 자모)을 첫소리 자모(U+1100~)로 바꿔 놓으므로 되돌린다 — 6.9.5 치는 중에 홀로 남은 모음(U+1161~) · 받침(U+11A8~)도
export const searchNormalize = value => normalize(value).replace(/[ᄀ-ᄒ]/g,c=>CHO[c.charCodeAt(0)-0x1100]).replace(/[ᅡ-ᅵ]/g,c=>JUNG[c.charCodeAt(0)-0x1161]).replace(/[ᆨ-ᇂ]/g,c=>JONG[c.charCodeAt(0)-0x11A7]);
const byTitle = new Map();
for (const entry of SEARCH_ENTRIES) if (!byTitle.has(entry.title)) byTitle.set(entry.title, entry);
export const entryByTitle = title => byTitle.get(title);
// [{ entry, quick }] — quick: 사전이 그 뜻의 첫 결과에 붙인 「바로 바꿀 것」 [{ path, only }]
export function searchResults(query) {
 const raw=searchNormalize(String(query).slice(0,160));
 if(!raw.replaceAll(' ',''))return [];
 // 6.9.5 치고 있는 마지막 낱말은 앞부분으로 (띄어쓰기 전 · 한 글자만 쳐도): 자판 순서로 펴서 낱말 앞머리와 견준다. 다 친 같은 낱말은 아래에서 이미 센다
 const lastWord=raw.split(' ').at(-1), lastKeys=keystrokes(lastWord), rawCompact=raw.replaceAll(' ','');
 const typing=lastKeys.length>=2&&!STOP.has(lastWord)&&!/^[ㄱ-ㅎ]+$/.test(lastWord);
 // 제목을 앞에서부터 치는 중(마지막 낱말이 덜 쳐졌거나 낱말 둘 이상)이면 그 제목이 먼저 — 그때는 말하듯 쓴 문장의 보탬 낱말을 붙이지 않는다.
 // 낱말 하나를 다 친 검색(「날씨」 「캡처」)은 예전 순위 그대로
 const typedTitle=keystrokes(rawCompact), titleTyping=typedTitle.length>=4&&!/^[ㄱ-ㅎ]+$/.test(rawCompact), multi=raw.includes(' ');
 const titleHit=e=>titleTyping&&e.titleTyped.startsWith(typedTitle)&&(multi||!e.words.includes(lastWord));
 const partialTitle=SEARCH_ENTRIES.some(titleHit);
 // 말하듯 쓴 문장이면 뜻에 맞는 낱말을 보태고(사전 WORDS), 사전이 읽은 뜻(증상 · 구어 · 오타 · 초성)의 설정을 맨 위로 올린다
 const extra=partialTitle||!dict?'':dict.expandWords(raw);
 const meant=partialTitle||!dict?[]:dict.matchIntents(raw).slice(0,4);
 const bonus=new Map(), quickFor=new Map();
 meant.forEach(({intent,strength},rank)=>intent.go.forEach((title,i)=>{
  const entry=byTitle.get(title);if(!entry)return;
  bonus.set(entry.id,Math.max(bonus.get(entry.id)||0,(rank===0?(i===0?120:90):(i===0?70:45))*strength));
  if(i===0&&intent.quick.length&&!quickFor.has(entry.id))quickFor.set(entry.id,intent.quick);
 }));
 const q=extra?normalize(raw+' '+extra):raw, compact=q.replaceAll(' ','');
 const tokens=q.split(' '), tokenSet=new Set(tokens);
 const stems=[...new Set(tokens.map(stem))];
 for(const w of stems)if(w.length===1)tokenSet.add(w);
 const words=stems.filter(w=>w.length>1&&!STOP.has(w));
 const initials=raw.split(' ').filter(w=>w.length>1&&/^[ㄱ-ㅎ]+$/.test(w));
 const loose=raw.split(' ').map(stem).filter(w=>w.length>1&&!STOP.has(w)&&!/^[ㄱ-ㅎ]+$/.test(w)).map(w=>[w,jamo(w)]).filter(([,j])=>j.length>=3);
 // 10-31 제목 전체를 한두 자모 틀리게 친 것(「성능 보저」 「날씨 휴과」)
 const rawJamo=jamo(rawCompact), typo=rawJamo.length>=6&&!/^[ㄱ-ㅎ]+$/.test(rawCompact)?(rawJamo.length>=10?2:1):0;
 const mine=/(?:^|\s)(?:내(?!보내)|나의|유저|사용자|페르소나)/.test(q), bot=/(?:캐릭터|봇|상대)/.test(q);
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
  if(typing&&!(lastWord.length>1&&entry.words.includes(lastWord))){
   if(entry.titleKeys.some(t=>t.startsWith(lastKeys))){score+=entry.titleKeys[0].startsWith(lastKeys)?20:16;matches++;}
   else if(entry.wordKeys.some(t=>t.startsWith(lastKeys))){score+=7;matches++;}
  }
  if(titleHit(entry)){score+=40;matches++;}
  if(typo&&!entry.compact.includes(rawCompact)&&within(rawJamo,entry.titleAll,typo)){score+=30;matches++;}
  if(!matches&&!bonus.has(entry.id))return {entry,score:0};
  // 「내」 가점은 다른 말도 맞은 내 프로필 항목에만 — 「내 메시지」가 내 프로필 다섯 줄만 띄우던 것 (6.9.5)
  if(mine)score+=entry.sub.startsWith('user-')?(matches>1?30:0):entry.tab==='chat'&&['profile','name'].includes(entry.sub)?-25:0;
  if(bot&&!mine)score+=['profile','name'].includes(entry.sub)?20:entry.sub.startsWith('user-')?-20:0;
  if(/에셋/.test(q))score+=entry.tab==='image'?25:-15;
  if(frame)score+=entry.title.includes('액자')?30:-10;
  if(transfer&&!frame)score+=['styles','backup'].includes(entry.sub)?35:-10;
  score+=bonus.get(entry.id)||0;
  return {entry,score};
 }).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||a.entry.id-b.entry.id).slice(0,10).map(r=>({entry:r.entry,quick:quickFor.get(r.entry.id)||[]}));
}
export const searchSettings = query => searchResults(query).map(r => r.entry);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const searchMarkup = query => `<div class="bl-settings-search"><div class="bl-search-field"><input type="search" data-settings-search maxlength="160" aria-label="테마 설정 검색" autocomplete="off" placeholder="설정 찾기 · 예: 글씨가 작아 · 밤에 눈부셔 · ㅂㄱ" value="${esc(query)}"><button type="button" data-settings-clear aria-label="설정 검색 지우기" ${query?'':'hidden'}>×</button></div><div class="bl-search-results" aria-label="설정 검색 결과" hidden></div></div>`;

// ── 결과 줄에서 바로 바꾸기 (10-31) ── 켜기/끄기 · 값 고르기 · 숫자 한 칸씩. 바꾸면 위 줄에 「되돌리기」
const decimals = step => (String(step).split('.')[1] || '').length;
/** 경로 하나를 결과 줄에서 어떻게 바꾸나: bool · options · num (모르면 null) */
export function quickSpec(path, read, only = null) {
 if (!quickAllowed(path) || typeof read !== 'function') return null;
 const q = dict?.QUICK?.[path], value = read(path);
 if (q?.num) return typeof value === 'number' ? { kind: 'num', path, label: q.label, min: q.num[0], max: q.num[1], step: q.num[2], unit: q.unit || '' } : null;
 const md = path.startsWith('markdown.') ? MARKDOWN_CONTROLS.find(c => `markdown.${c.key}` === path) : null;
 const options = q?.options || md?.options;
 if (options) { const list = only ? options.filter(([v]) => only.includes(v)) : options; return list.length ? { kind: 'options', path, label: q?.label || `마크다운 ${md.label}`, options: list } : null; }
 if (typeof value === 'boolean') return { kind: 'bool', path, label: SEARCH_ENTRIES.find(e => e.path === path)?.title || dict?.SETTING_LABELS?.[path] || '이 설정' };
 return null;
}
export function quickText(spec, value) {
 if (value === undefined || value === null) return '기본값';
 if (spec?.kind === 'bool' || typeof value === 'boolean') return value ? '켜짐' : '꺼짐';
 if (spec?.kind === 'options') return spec.options.find(([v]) => String(v) === String(value))?.[1] ?? (dict?.QUICK?.[spec.path]?.options || []).find(([v]) => String(v) === String(value))?.[1] ?? String(value);
 if (spec?.kind === 'num' && typeof value === 'number') return `${Number(value.toFixed(decimals(spec.step)))}${spec.unit}`;
 return String(value);
}
function quickControl(spec, read) {
 const value = read(spec.path), name = esc(spec.label);
 if (spec.kind === 'bool') return `<label class="salty-switch bl-search-switch"><input type="checkbox" data-search-flip="${esc(spec.path)}" aria-label="${name}" ${value ? 'checked' : ''}><span></span></label>`;
 if (spec.kind === 'options') return `<div class="salty-seg${spec.options.length > 2 ? ' bl-seg-2col' : ''}">${spec.options.map(([v, label]) => { const on = String(value) === String(v); return `<button type="button" class="bl-search-ctl${on ? ' on' : ''}" data-search-set="${esc(spec.path)}" data-value="${esc(v)}" aria-pressed="${on}">${esc(label)}</button>`; }).join('')}</div>`;
 const at = d => Number(Math.min(spec.max, Math.max(spec.min, value + d * spec.step)).toFixed(decimals(spec.step)));
 return `<span class="bl-search-step"><button type="button" class="bl-search-ctl" data-search-set="${esc(spec.path)}" data-value="${at(-1)}" aria-label="${name} 줄이기" ${value <= spec.min ? 'disabled' : ''}><i class="fa-solid fa-minus" aria-hidden="true"></i></button><output>${esc(quickText(spec, value))}</output><button type="button" class="bl-search-ctl" data-search-set="${esc(spec.path)}" data-value="${at(1)}" aria-label="${name} 늘리기" ${value >= spec.max ? 'disabled' : ''}><i class="fa-solid fa-plus" aria-hidden="true"></i></button></span>`;
}
function resultRow({ entry: e, quick }, index, read) {
 const own = read && e.path ? quickSpec(e.path, read) : null;
 const extra = read ? quick.map(q => quickSpec(q.path, read, q.only)).filter(s => s && s.path !== e.path) : [];
 // 첫 세 줄은 제 손잡이(고르기 · 숫자)도 펼쳐 보여요. 켬/끔은 줄 오른쪽 스위치 하나
 const lines = [...(own && own.kind !== 'bool' && index < 3 ? [own] : []), ...extra];
 const line = spec => spec.kind === 'bool' ? `<div class="salty-row bl-search-quick-line"><span>${esc(spec.label)}</span>${quickControl(spec, read)}</div>` : `<div class="salty-stack bl-search-quick-line"><span>${esc(spec.label)}</span>${quickControl(spec, read)}</div>`;
 return `<div class="bl-search-result-row"><button type="button" data-settings-result="${e.id}"><strong>${esc(e.title)}</strong><small>${esc(e.breadcrumb)}</small></button>${own?.kind === 'bool' ? quickControl(own, read) : ''}${favoriteButton(e)}</div>${lines.length ? `<div class="bl-search-quick">${lines.map(line).join('')}</div>` : ''}`;
}
// ── AI 에게 맡기기 (10-31, 기본 꺼짐) ── 켠 사람만 · 단추를 눌렀을 때만 요청 한 번 · 미리보기에서 「적용」을 눌러야 바꿔요
function aiMarkup(root, query) {
 const ai = root._searchAi;
 if (!ai || ai.query !== query) return '';
 const tokens = ai.tokens ? ` · 요청 약 ${ai.tokens.toLocaleString('ko-KR')} 토큰` : '';
 if (ai.state === 'asking') return `<div class="bl-search-ai" role="status"><p>AI 에게 묻는 중…${tokens}</p><div class="salty-btns"><button type="button" class="salty-btn bl-search-ctl" data-search-ai-cancel>멈추기</button></div></div>`;
 if (ai.state === 'error') return `<div class="bl-search-ai" role="status"><p>${esc(ai.message)}</p></div>`;
 if (ai.state !== 'preview') return '';
 const head = `<p>${ai.changes.length ? `AI 가 고른 변경 ${ai.changes.length}개` : '바꿀 설정을 찾지 못했어요'}${tokens}${ai.dropped ? ` · 목록 밖 ${ai.dropped}개는 뺐어요` : ''}</p>`;
 const list = ai.changes.length ? `<ul>${ai.changes.map(c => `<li><span>${esc(c.label)}</span><b>${esc(c.beforeText)} → ${esc(c.afterText)}</b></li>`).join('')}</ul>` : '';
 return `<div class="bl-search-ai" role="status">${head}${list}<div class="salty-btns">${ai.changes.length ? '<button type="button" class="salty-btn bl-search-ctl" data-search-ai-apply>적용</button>' : ''}<button type="button" class="salty-btn bl-search-ctl" data-search-ai-cancel>${ai.changes.length ? '취소' : '닫기'}</button></div></div>`;
}
export function paintSettingsSearch(root) {
 const query=root._settingsQuery||'', list=root.querySelector('.bl-search-results');if(!list)return;
 root.querySelector('[data-settings-clear]').hidden=!query;
 list.hidden=!query.trim();if(list.hidden){list.replaceChildren();return;}
 if(!dict&&!root._intentsAsked){root._intentsAsked=true;loadIntents().then(()=>{if(root._settingsQuery)paintSettingsSearch(root);},()=>{});}
 const ops=root._searchOps||{}, read=typeof ops.read==='function'?ops.read:null;
 const items=searchResults(query), undo=root._searchUndo;
 const aiOn=!!(typeof ops.ai==='function'&&ops.ai()?.on), asking=root._searchAi?.state==='asking';
 const count=`<p>${items.length?'관련 설정 '+items.length+'개':'찾는 설정이 없어요. 다른 말이나 초성(ㅂㄱ)으로도 찾아보세요.'}</p>`;
 const status=undo?`<div class="bl-search-status bl-search-done" role="status"><p>${esc(undo.text)}</p><button type="button" class="salty-btn bl-search-ctl" data-search-undo>되돌리기</button></div>`
  :`<div class="bl-search-status" role="status">${count}${aiOn&&!asking&&query.trim().length>=2?'<button type="button" class="salty-btn bl-search-ctl" data-search-ai><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span>AI 에게 맡기기</span></button>':''}</div>`;
 list.innerHTML=status+aiMarkup(root,query)+items.map((item,i)=>resultRow(item,i,read)).join('');
}
// 바꾼 뒤 설정 창이 다시 그려져도(panel.js update) 결과 목록 스크롤 · 누르던 자리를 그대로
function keepPlace(root, run, focusSel) {
 const before = root.querySelector('.bl-search-results')?.scrollTop || 0;
 run();
 const list = root.querySelector('.bl-search-results');
 if (list && !list.hidden) { list.scrollTop = before; (focusSel && list.querySelector?.(focusSel))?.focus?.({ preventScroll: true }); }
}
function writeChanges(root, picked, text) {
 const ops = root._searchOps; if (!ops?.write || !picked.length) return;
 const changes = [...picked, ...picked.flatMap(c => Object.entries(dict?.QUICK?.[c.path]?.also || {}).map(([path, value]) => ({ path, value, before: ops.read(path) })))];
 root._searchUndo = { text, changes: changes.map(c => [c.path, c.before]) };
 keepPlace(root, () => { ops.write(changes.map(c => [c.path, c.value])); paintSettingsSearch(root); }, '[data-search-undo]');
}
function quickChange(root, path, value) {
 const read = root._searchOps?.read; if (typeof read !== 'function') return;
 const spec = quickSpec(path, read), before = read(path);
 if (!spec || Object.is(before, value)) return;
 writeChanges(root, [{ path, before, value }], `${spec.label}: ${quickText(spec, before)} → ${quickText(spec, value)}`);
}
async function askAi(root) {
 const ops = root._searchOps || {}, query = root._settingsQuery || '';
 const ai = typeof ops.ai === 'function' ? structuredClone(ops.ai()) : null;
 if (!ai?.on || !query.trim() || typeof ops.read !== 'function') return;   // 꺼 두면 요청 0
 root._searchAi?.controller?.abort();
 const controller = new AbortController(), state = { query, state: 'asking', controller };
 root._searchAi = state; paintSettingsSearch(root);
 try {
  const m = await import('./settings-ai.js');
  const result = await m.askSettingsAi({ sentence: query, read: ops.read, profileId: ai.profileId || '', connection: ai, send: ops.send, signal: controller.signal, onTokens: n => { state.tokens = n; if (root._searchAi === state) paintSettingsSearch(root); } });
  if (root._searchAi !== state) return;
  Object.assign(state, { state: 'preview', changes: result.changes, dropped: result.dropped, tokens: result.tokens ?? state.tokens });
 } catch (error) {
  if (root._searchAi !== state) return;
  Object.assign(state, { state: 'error', message: controller.signal.aborted ? '멈췄어요' : `AI 요청이 안 됐어요: ${error?.message || error}` });
 }
 keepPlace(root, () => paintSettingsSearch(root), '[data-search-ai-apply]');
}
/** ops: { read(path), write([[path, value]]) — 한 번에 한 단계로 저장 · 되돌리기, ai() → 연결 설정, send?(messages, { profileId, connection, signal }) — 시험용 } */
export function bindSettingsSearch(root,navigate,ops={}) {
 root._searchOps=ops;
 let typingTimer=0;
 const forget=()=>{root._searchUndo=null;root._searchAi?.controller?.abort();root._searchAi=null;};
 const update=input=>{clearTimeout(typingTimer);typingTimer=0;if(root._settingsQuery!==input.value)forget();root._settingsQuery=input.value;paintSettingsSearch(root);};
 // 사전은 검색창에 처음 들어올 때 받아요 (설정 창을 열기만 해서는 받지 않음)
 root.addEventListener('focusin',e=>{if(e.target.matches?.('[data-settings-search]'))loadIntents().catch(()=>{});});
 // 6.9.5 한글은 마지막 글자가 띄어쓰기 · 다음 글자 전까지 조합 중이다 — 조합 중에도 잠깐(100ms) 뒤 결과를 그린다 (입력칸은 그대로라 조합이 끊기지 않음)
 root.addEventListener('input',e=>{
  if(!e.target.matches('[data-settings-search]'))return;
  if(!e.isComposing)return update(e.target);
  const input=e.target;clearTimeout(typingTimer);typingTimer=setTimeout(()=>{typingTimer=0;if(input.isConnected)update(input);},100);
 });
 root.addEventListener('compositionend',e=>{if(e.target.matches('[data-settings-search]'))update(e.target);});
 root.addEventListener('change',e=>{
  const flip=e.target.closest?.('[data-search-flip]');if(!flip)return;
  e.stopPropagation();quickChange(root,flip.dataset.searchFlip,flip.checked);
 });
 root.addEventListener('click',e=>{
  const pick=sel=>e.target.closest?.(sel);
  const set=pick('[data-search-set]'),undo=pick('[data-search-undo]'),ask=pick('[data-search-ai]'),apply=pick('[data-search-ai-apply]'),cancel=pick('[data-search-ai-cancel]');
  if(set||undo||ask||apply||cancel){
   e.preventDefault();e.stopPropagation();
   if(set){const path=set.dataset.searchSet,current=root._searchOps?.read?.(path),v=set.dataset.value;quickChange(root,path,typeof current==='number'?Number(v):typeof current==='boolean'?v==='true':v);}
   else if(undo){const last=root._searchUndo;root._searchUndo=null;if(last&&root._searchOps?.write)keepPlace(root,()=>{root._searchOps.write(last.changes);paintSettingsSearch(root);},'[data-settings-result]');}
   else if(ask)askAi(root);
   else if(apply){const ai=root._searchAi;if(ai?.state==='preview'&&ai.changes.length){root._searchAi=null;writeChanges(root,ai.changes,`AI 가 설정 ${ai.changes.length}개를 바꿨어요`);}}
   else{root._searchAi?.controller?.abort();root._searchAi=null;keepPlace(root,()=>paintSettingsSearch(root),'[data-settings-result]');}
   return;
  }
  const result=pick('[data-settings-result]'),clear=pick('[data-settings-clear]');if(!result&&!clear)return;
  e.preventDefault();e.stopPropagation();root._settingsQuery='';forget();
  if(result){const entry=SEARCH_ENTRIES[Number(result.dataset.settingsResult)];if(entry)navigate(entry);}
  else {const input=root.querySelector('[data-settings-search]');input.value='';paintSettingsSearch(root);input.focus();}
 });
 root.addEventListener('keydown',e=>{
  if(!e.target.closest('.bl-settings-search')||e.isComposing)return;
  const input=root.querySelector('[data-settings-search]'), buttons=[...root.querySelectorAll('[data-settings-result]')];
  if(e.key==='Escape'&&input.value){e.preventDefault();e.stopPropagation();root._settingsQuery='';forget();input.value='';paintSettingsSearch(root);input.focus();}
  // Enter 는 언제나 첫 결과로 가기 — AI 요청은 「AI 에게 맡기기」 단추로만
  if(e.key==='Enter'&&e.target===input){e.preventDefault();e.stopPropagation();buttons[0]?.click();}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();const i=buttons.indexOf(e.target),next=i+(e.key==='ArrowDown'?1:-1);(next<0?input:buttons[Math.min(next,buttons.length-1)]||input).focus();}
 });
}
