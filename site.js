'use strict';
// Gallery, grouped by what a visitor is looking for. Every example was shot on 4.3.4 with the same synthetic chat.
// card = [file, title, description, poster, gif, credit]; pc = wide shots (1280×800) shown first when the visitor picks PC.
// File names: 434-<scene>.* (phone, 2×) and 434-pc-<scene>.* (PC).
const P = (n, t, d, poster) => poster ? [`434-${n}.mp4`, t, d, `434-${n}.jpg`] : [`434-${n}.png`, t, d];
const C = (n, t, d) => [`434-pc-${n}.mp4`, t, d, `434-pc-${n}.jpg`];
const S = (n, t, d) => [`434-pc-${n}.png`, t, d];
const CREDIT = ['예시: 공유봇 천지합동청 ↗', 'https://kkangtong.xyz/posts/54677'];
const topics = [
  { id:'color', label:'색', title:'에이드를 섞어, 나만의 색으로.', sub:'열두 가지 에이드 · 혼합 · 번짐 · 보관함 · 색 고치기 · 완성 스타일 · 자동 전환', cards: [
    P('ades', '에이드가 열두 가지', '블루 레몬에이드부터 수박까지. 누르면 채팅 전체가 그 색으로 바뀌어요.', true),
    P('mix', '에이드를 섞어서', '두세 가지 에이드를 고르고 방향을 돌리면 형광펜과 면이 함께 물들어요.', true),
    P('blend', '번짐은 내 마음대로', '0이면 색 경계가 딱 나뉘고, 100이면 끝에서 끝까지 천천히 번져요.', true),
    P('mix-setting', '섞는 건 간단하게', '혼합을 켜고 에이드를 고르면 끝. 라이트·나이트 따로 저장돼요.'),
    P('palette-library', '마음에 든 색은 보관함에', '화이트·나이트를 한 쌍으로, 24개까지 저장해요.'),
    P('colors', '색 하나하나 고치기', '바탕 · 메뉴 · 입력칸 · 글자를 테마 따르기 · 단색 · 그라데이션 중에 골라요.'),
    P('styles', '한 번에 입히는 스타일', '소설책, 메신저, 또렷하게. 완성 스타일로 시작하거나 내 스타일을 저장해요.'),
    P('auto', '낮에는 밝게, 밤에는 편안하게', '기기 다크 모드나 정해 둔 시간을 따라 전환해요.'),
    P('night-chat', '배경 그림 위의 나이트', '배경 이미지를 비치게 하고 농도를 고르면 그림이 은은하게 깔려요.'),
  ], pc: [
    C('ades', '에이드가 열두 가지', '넓은 화면에서 한 번에 바꿔 보세요.'),
    C('mix', '에이드를 섞어서', '두세 가지 에이드로 형광펜과 면을 함께 물들여요.'),
    C('blend', '번짐은 내 마음대로', '미리보기를 보면서 경계를 또렷하게, 또는 부드럽게.'),
    S('mix-setting', '미리보기와 설정을 나란히', '왼쪽에서 보고, 오른쪽에서 바로 바꿔요.'),
    S('colors', '색 하나하나 고치기', '바탕 · 메뉴 · 입력칸 · 글자를 각각.'),
    S('night-chat', '밤바다 위의 나이트', '배경 그림이 은은하게 비치는 차콜 화면.'),
  ]},
  { id:'text', label:'대사', title:'대사는 또렷하게, 분위기는 그대로.', sub:'형광펜 모양 · 글자 그라데이션 · 프롬프트 색 · 외곽선 · 감정 대사 애니메이션 · 글꼴 · 문단', cards: [
    P('fx', '감정이 실린 대사는 움직여요', '데우스 엑스 마키나의 Expressive Dialogue(외침 · 떨림 · 울음 · 어지러움 · 들뜸)를 테마 위에서도 또렷하게. 움직임 크기 · 빛 · 색 흐름을 골라요.', true),
    P('fx-marker', '무지개는 형광펜에도', '색 흐름을 글자 대신 형광펜 띠에 줄 수 있어요. 글자는 대사색 그대로.', true),
    P('fx-setting', '움직임은 원하는 만큼', '은은하게 · 보통 · 크게, 빛, 색 흐름을 어디에 줄지.'),
    P('pill-marker', '끝이 둥근 알약 형광펜', '펜 자국 · 직사각형 · 알약 중에 골라요.'),
    P('rect-marker', '끝이 반듯한 형광펜', '펜 자국 대신 직사각형으로. 위치와 굵기도 맞춰요.'),
    P('marker-setting', '형광펜 설정', '모양 · 굵기 · 위치를 미리보기로 확인하며.'),
    P('text-gradient', '글자에도 그라데이션', '이름 · 대사 · 속마음을 따로 물들일 수 있어요.'),
    P('text-gradient-setting', '글자 그라데이션 설정', '두 색과 방향을 고르면 돼요.'),
    P('ink-text', '프롬프트가 고른 대사 색', '데우스가 칠한 색을 글자에 그대로.'),
    P('ink-marker', '취향은 형광펜 쪽', '글자는 선명하게, 붓자국 띠만 프롬프트 색으로.'),
    P('ink-outline-night', '어두운 화면에서도 또렷하게', '대사에만 외곽선과 그림자를 더할 수 있어요.'),
    P('ink-outline-setting', '가독성도 원하는 만큼', '색, 두께, 각도를 조절하고 미리보기로 확인하세요.'),
    P('outline-setting', '본문 전체에 글자 외곽선', '글자 › 그림자 · 외곽선에서 설정해요.'),
    P('fonts', '글꼴은 언어별로', '한국어 · 영어 · 일본어 · 한자 글꼴을 따로 고르고, 목록에서 미리 봐요.'),
    P('para', '문단과 여백', '문단 사이 · 좌우 여백 · 들여쓰기를 취향대로.'),
  ], pc: [
    C('fx', '감정이 실린 대사는 움직여요', '넓은 화면에서도 같은 효과.'),
    C('fx-marker', '무지개는 형광펜에도', '색 흐름을 형광펜 띠에.'),
    S('pill-marker', '끝이 둥근 알약 형광펜', ''),
    S('text-gradient', '글자에도 그라데이션', ''),
    S('ink-text', '프롬프트가 고른 대사 색', ''),
    S('ink-outline-night', '어두운 화면에서도 또렷하게', ''),
    S('marker-setting', '형광펜 설정', '왼쪽 미리보기 · 오른쪽 설정.'),
    S('fonts', '글꼴은 언어별로', ''),
  ]},
  { id:'profile', label:'사진', title:'사진은 크게, 액자는 취향대로.', sub:'큰 프로필(PC) · 장식 액자 · 액자 색 · 내 프로필 · 이름 · 시간 · 이미지 배치', cards: [
    P('no-profile', '사진 없이 글만', '프로필을 없애면 글이 화면을 다 써요.'),
    P('profile-setting', '캐릭터 프로필 설정', '프로필 없음 · 작은 프로필 · 상단 큰 프로필.'),
    P('my-profile', '내 프로필도 따로', '내 사진에는 다른 모양을. 캐릭터와 따로 꾸며요.'),
    P('name-time', '이름과 시간 줄', '이름 크기 · 굵기 · 색, 번호와 시간의 위치.'),
    P('image-layout', '이미지 배치', '채팅 속 그림의 정렬과 크기.'),
    P('image-frame', '이미지 테두리', '그림에 둥글기와 테두리를.'),
  ], pc: [
    S('big-profile', '사진을 이야기 첫머리에', '캐릭터 사진을 본문 위에 크게. 크기와 자르기도 자유롭게.'),
    C('frames', '여섯 가지 장식 액자', '수채화부터 낙서 노트까지, 눌러서 바로 바꿔요.'),
    C('frame-colors', '액자 색도 내 마음대로', '리본 액자의 바탕색과 포인트색을 바꿔 가며.'),
    S('frame-setting', '바탕색 · 포인트색', '미리보기를 보면서 두 칸만 바꾸면 돼요.'),
    S('profile-setting', '캐릭터 프로필 설정', ''),
    S('no-profile', '사진 없이 글만', ''),
    S('my-profile', '내 프로필도 따로', ''),
  ]},
  { id:'weather', label:'날씨', title:'오늘의 장면에, 오늘의 날씨.', sub:'안개 · 햇살 · 별 · 반딧불이 · 무지개 · 물결 · 유리 빗방울 · 눈 · 꽃잎 · 두 날씨 혼합 · 내 메시지 농도', cards: [
    ['434-bubble-opacity.mp4','내 메시지도 날씨가 비치게','날씨를 켜면 내 메시지 면이 비쳐요. ‘내 메시지 농도’로 30~100% 사이에서 고르고, 100이면 예전처럼 불투명해요. 이 탭의 예시는 45%예요.','434-bubble-opacity.jpg'],
    ['434-look-milkyway.mp4','은하수 위를 도는 유성','별(은하수 · 두 색 그라데이션) + 유성(곡률 95 · 원 크기 130). 날씨 혼합하기로 두 가지를 겹쳐요.','434-look-milkyway.jpg'],
    ['434-look-mist.mp4','구름 띠와 아침 볕','안개(애니풍 구름 띠 · 아래) + 햇살(성스러운 빛 · 따뜻한 두 색).','434-look-mist.jpg'],
    ['434-look-moonsea.mp4','밤바다와 은하수','물결(바다 · 아래) + 별(은하수).','434-look-moonsea.jpg'],
    ['434-look-petalsun.mp4','꽃잎과 봄볕','꽃잎(흔들림 150 · 속도 65) + 햇살(애니풍).','434-look-petalsun.jpg'],
    ['434-look-seaside.mp4','바닷가의 빛줄기','물결(바다) + 햇살(빛줄기 · 옅은 노랑).','434-look-seaside.jpg'],
    ['434-look-snownight.mp4','별 뜬 밤의 눈','눈(크기 90 · 속도 55 · 흔들림 140) + 별(반짝이는 별).','434-look-snownight.jpg'],
    ['434-look-fireflies.mp4','안개 낀 숲의 반딧불이','반딧불이(크기 120 · 노랑→연두) + 안개(실안개 · 아래).','434-look-fireflies.jpg'],
    ['434-look-rainyglass.mp4','비 오는 창가','유리 빗방울은 작게(크기 50 · 세기 강하게)가 예뻐요. + 안개(위쪽 · 옅게).','434-look-rainyglass.jpg'],
    ['434-look-afterrain.mp4','비 갠 뒤','무지개(자리를 끌어 옮김) + 햇살(빛줄기).','434-look-afterrain.jpg'],
    P('picker', '하늘 · 자연 · 물·유리', '종류별로 고르고, 1 · 2 칸에 하나씩 넣으면 혼합이에요.'),
    P('weather-color', '날씨마다 색을 따로', '기본 색 · 직접 고르기 · 두 색 그라데이션. 날씨마다 기억해요.'),
    P('weather-spot', '무지개는 어디에', '나무 그림자 · 무지개 · 햇살은 작은 네모에서 끌어 자리를 정해요.'),
    P('weather-tracker', '트래커 날씨 따라가기', '비 · 눈 · 안개 · 햇살 · 별 · 무지개 · 바람을 알아보고, 실내의 비는 유리 빗방울로. 빼고 싶은 날씨는 제외해요.'),
    P('weather-bubble', '내 메시지 농도', '날씨를 켠 동안 내 메시지 면이 이만큼만 칠해져요.'),
    P('weather-custom', '내 그림도 내려요', '투명 PNG로 꽃잎, 별, 마음에 드는 그림을 더해요.'),
  ], pc: [
    ['434-hero-pc-light.mp4','꽃잎과 봄볕','넓은 화면에서 꽃잎 + 햇살(애니풍).','434-hero-pc-light.jpg'],
    ['434-hero-pc-dark.mp4','안개 낀 숲의 반딧불이','넓은 화면에서 반딧불이 + 실안개.','434-hero-pc-dark.jpg'],
    S('picker', '하늘 · 자연 · 물·유리', '두 날씨를 1 · 2 칸에.'),
    S('weather-tracker', '트래커 날씨 따라가기', ''),
    S('weather-bubble', '내 메시지 농도', ''),
  ]},
  { id:'capture', label:'캡처', title:'좋아하는 장면을 이미지 · 영상 · 움짤로.', sub:'빠른 미리보기 · 문단 고르기 · 이미지 · 영상 · GIF · APNG · WebP · 표시할 항목 · 이름 가림', cards: [
    ['420-capture-moving.webp','움짤 속 글자도 살아 있게','테마가 저장한 실제 WebP 움짤이에요. 채팅에서 돌던 감정 대사의 흔들림 · 빛 · 색 흐름이 영상과 움짤에도 담겨요.'],
    P('capture-quick', '몇 초 만에 빠른 미리보기', '굽지 않고 첫 화면부터 확인해요. 파일은 ‘파일 만들기’를 눌렀을 때만 만들어요.'),
    P('capture-editor', '남길 문단만 골라서', '캡처용 글 편집은 문단마다 한 줄. 체크해서 한 번에 지우거나 고른 것만 남기고, 한 줄을 누르면 펼쳐서 고쳐요.'),
    P('capture-format', '올릴 곳 한도에 맞춰서', '파일 종류에서 GIF · APNG · WebP 를 고르고 최대 용량을 정하면, 화질 → 크기 → 초당 장수 순으로 낮춰 맞춰요. 프리셋으로 한 번에.'),
    P('capture-info', '본문만 또는 원하는 정보만', '이름 · 사진 · 날짜 · 모델 · 번호 · 토큰 · 시간 · 본문 에셋을 각각 골라요.'),
    P('capture-privacy', '공유할 땐 이름 가리고', '단어 치환 적용과 이름 숨기기. 네모 · 모자이크 · 테이프로 가려요.'),
  ], pc: [
    ['420-capture-moving.webp','움짤 속 글자도 살아 있게','테마가 저장한 실제 WebP 움짤.'],
    S('capture-quick', '파일별 미리보기와 세부 설정', '왼쪽에서 고르고 보고, 오른쪽에서 조절해요.'),
    S('capture-editor', '남길 문단만 골라서', ''),
    S('capture-format', '올릴 곳 한도에 맞춰서', ''),
    S('capture-info', '본문만 또는 원하는 정보만', ''),
  ]},
  { id:'tools', label:'도구', title:'필요한 것만 켜는, 작은 도구.', sub:'스크립트 · 단어 치환 · 확장 순서 · 모델 등록·전환 · 성능 보조 · 단독 업데이트', cards: [
    P('regexlink', '끈 모듈의 정규식도 같이 꺼지게', "프롬프트 관리자에서 끈 모듈(모멘텀 엔진 · 상태창 · 선택지 …)의 정규식을 자동으로 끄고, 다시 켜면 돌려놓아요. 모듈마다 프롬프트 따라 · 늘 켜기 · 늘 끄기를 고를 수 있어요."),
    P('scripts', '필요한 스크립트만 켜요', '실리태번 · 헬퍼 한글화, 데우스 · 샤진 번역과 삼각형 접기를 각각 선택해요. 기존 헬퍼의 같은 스크립트는 먼저 꺼 주세요.'),
    P('update-tool', '이 테마만 업데이트', '전체 확장 목록을 기다리지 않고 확인해요. 업데이트 후 새로고침하면 적용돼요.'),
    P('modelswitch', '여러 확장의 모델을 한 번에', '모델을 따로 고르는 확장들의 공급자와 모델을 함께 바꿔요. 자주 쓰는 조합은 저장해 두고, 잠금으로 실수도 막아요.'),
    P('words', '단어 치환도 한곳에서', '번역본 · 원문 보기로 메시지를 고르고, 치환 전후를 확인해요.'),
    P('order', '확장 순서 정리', '필요할 때만 켜고, 기존 단독 확장과 중복 실행을 막아요.'),
    P('models', '목록에 없는 모델도 직접', '공급자를 고르고 모델 이름을 등록해요.'),
    P('perf', '성능 보조도 선택해서', '끊김 감시 · 로딩 시간 · 요청 로그 · 저장 정리, 다섯 도구를 바로 조절해요.'),
  ], pc: [
    S('regexlink', '끈 모듈의 정규식도 같이 꺼지게', '모듈 카드가 두 열로. 짝 프롬프트가 켜져 있으면 칩이 강조돼요.'),
    S('scripts', '왼쪽에서 고르고, 오른쪽에서 편집', '스크립트마다 코드를 수정 · 저장 · 복원할 수 있어요.'),
    S('update-tool', '업데이트도 테마 설정에서', ''),
    S('modelswitch', '여러 확장의 모델을 한 번에', ''),
    S('words', '단어 치환도 한곳에서', ''),
    S('perf', '성능 보조도 선택해서', ''),
    S('models', '목록에 없는 모델도 직접', ''),
  ]},
  { id:'rewrite', label:'다시 쓰기', tall:true, title:'마음에 안 드는 문장만, 다시.', sub:'금지 묘사 · 예외 · AI에게 부탁해서 만들기 · 테스트 · 사용법', guide:true, cards: [
    P('rw-rules', '금지 묘사 — 규칙 하나 열어 보기', '규칙마다 잡을 단어(영·한·일·중), 고쳐 쓰는 AI에게 줄 설명을 적어요. 기본 규칙 열 개는 끄거나 지울 수 있어요.'),
    [...P('rw-horn', '이 캐릭터에게만', '사람 아이콘이 붙은 규칙은 적어 둔 이름이 최근 메시지에 나올 때만 켜져요. 기본 규칙 「뿔」의 사탄은 공유봇의 캐릭터예요.'), , , CREDIT],
    P('rw-ai', 'AI에게 부탁해서 만들기', '싫은 묘사를 평소 말투로 적고 → 프롬프트를 복사해 아무 AI에게 → 받은 답을 붙여넣으면 규칙이 돼요.'),
    [...P('rw-exceptions', '예외 — 원래 그 특징이 있는 캐릭터', '이름과 허용할 묘사를 체크해요. 기본 예외 벨포드 · 아델스타인은 공유봇의 캐릭터라, 그 봇을 안 쓰면 지우면 돼요.'), , , CREDIT],
    P('rw-test', '테스트 — 걸리는 곳 보기', '문장을 넣으면 어느 규칙에 걸리는지 바로 보여 줘요. 이 단계는 기기 안에서만 돌아서 비용이 없어요.'),
    P('rw-guide', '사용법은 버전 표시 속에', '제목 옆 버전 표시를 누르면 열 단계 사용법이 열려요.'),
    P('rw-connect', '연결은 지금 모델 그대로', '고칠 때 쓸 모델은 현재 연결 · 직접 선택 · 연결 프로필 중에 골라요.'),
  ], pc: [
    S('rw-rules', '금지 묘사 — 규칙 하나 열어 보기', ''),
    S('rw-ai', 'AI에게 부탁해서 만들기', ''),
  ]},
  { id:'read', label:'읽기', title:'읽는 동안에는, 이야기만.', sub:'북마크 · 배경 농도 · 고정 버튼 · 몰입 읽기 · 한 손 버튼 · 카드 접기 · 퀵 리플라이 · 로어북 · 백그라운드', cards: [
    P('bookmark-panel', '남겨 둔 장면을 한곳에', '북마크 창에서 모아 보고 · 찾고 · 그 자리로 돌아가요. 카드의 글은 채팅과 같은 서식이고, 메모도 달 수 있어요. 북마크 창만 밝게 · 어둡게 따로 볼 수도 있어요.'),
    P('bookmark-panel-light', '밝은 화면의 북마크', '라이트에서도 카드가 한 면으로 깔끔해요.'),
    P('bookmark-chat', '메시지마다 별 하나', '메시지의 별을 누르면 북마크, 길게 누르면 메모. 앞뒤 문맥 보기와 같은 캐릭터의 다른 채팅, 채팅 전체 검색도 들어 있어요.'),
    P('bookmark-setting', '북마크 설정', '테마 밝게 · 어둡게, 데우스 › 본문만 보기.'),
    P('bg-alpha', '배경 그림 위에서도 또렷하게', '채팅 바탕 농도를 0~100%로. 내 메시지도 같은 농도를 따라가고, 100이면 입력창 둘레까지 테마 바탕색으로 덮어요.', true),
    P('pins', '자주 쓰는 버튼은 밖으로', '··· 메뉴 속 번역 · 복사 · 숨기기 같은 버튼을 골라 늘 보이게 해요. 풀면 원래 자리로 돌아가요.'),
    P('pins-setting', '늘 보일 버튼 고르기', '목록에서 체크하면 돼요. 최대 12개.'),
    P('reader', '밀어서 몰입하기', '아래로 읽으면 메뉴와 입력창이 잠시 비켜나요.', true),
    P('onehand', '한 손으로 닿는 버튼', '스와이프, 사칭, 이어 쓰기, 다시 생성을 입력창 가까이에.'),
    P('fold', '폰에서는 카드를 접어서', '트래커와 장면 계획을 필요한 순간에 펼쳐 보세요.', true),
    P('cards', '데우스 카드도 테마 모양으로', '트래커 · 장면 계획 카드가 테마 색과 둥글기를 따라요.'),
    P('prompt-tab', '프롬프트 설정을 한곳에', '카드 스킨부터 대사 색, 감정 대사, 트래커 날씨까지.'),
    P('qr-top', '입력창 위로, 한 줄 더', '폰에서도 QR 줄을 입력창 위로 올릴 수 있어요.'),
    P('qr-rows', '여러 줄이 편하다면', '세로 스크롤은 보이는 줄을 1~4줄로 정할 수 있어요.'),
    P('qr-find', '이름도, 내용도 한 번에', '찾은 부분에 형광펜이 칠해져요. 하위 세트도 함께 찾아요.'),
    P('qr-setting', '퀵 리플라이 설정', '자리 · 넘기기 · 보이는 줄 · 검색 버튼.'),
    P('lorebook', '연결된 책에 불이 들어와요', '캐릭터 · 채팅 로어북이 연결되면 아이콘이 테마색으로 은은하게 빛나요.'),
    P('background-keep', '백그라운드에서도 계속 (실험)', '답을 기다리는 동안 다른 앱을 봐도 생성과 자동 번역이 멈추지 않게.'),
  ], pc: [
    S('bookmark-panel', '남겨 둔 장면을 한곳에', ''),
    S('bookmark-chat', '메시지마다 별 하나', ''),
    C('bg-alpha', '배경 그림 위에서도 또렷하게', ''),
    S('pins', '자주 쓰는 버튼은 밖으로', ''),
    S('cards', '데우스 카드도 테마 모양으로', ''),
    S('qr-find', '이름도, 내용도 한 번에', ''),
    S('lorebook', '연결된 책에 불이 들어와요', ''),
  ]},
  { id:'settings', label:'설정', title:'설정하는 시간도 편안하게.', sub:'설정 검색 · 되돌리기 · 미리보기 확대 · 변경한 설정 · 즐겨찾기 · 백업 · 확장 서랍', cards: [
    P('search', '말로 찾는 설정', '"내 사진 오른쪽"처럼 입력하면 그 설정으로 바로 가요.', true),
    P('search-still', '초성도, 말하듯 써도', '"글씨가 너무 작아요"처럼 쓰거나 ㅂㄱ처럼 초성만 쳐도 찾아요.'),
    P('history', '되돌리기 · 다시 실행', '바꾼 값을 한 번에 되돌려요. 무엇이 바뀌었는지 알려 줘요.', true),
    P('zoom', '미리보기는 확대해서', '돋보기를 누르면 확대 · 축소 줄이 나와요. 최대 300%.', true),
    P('changes', '바꾼 설정만 모아서', '기본값과 다른 항목을 한눈에. 하나씩 기본값으로 돌려요.'),
    P('favorites', '자주 쓰는 설정은 ★', '항목 옆 별을 누르면 즐겨찾기에 모여요. 최대 16개.'),
    P('backup', '설정 백업과 복원', '파일로 저장하고, 다른 기기에서 불러와요.'),
    P('prompt-list', '프롬프트 목록도 한눈에', '위쪽은 두 줄로, 토큰 수는 오른쪽에 맞춰 정리했어요.'),
    P('ext-drawer', '좁아도 가지런한 확장 서랍', '아이콘은 밀리지 않고 글자는 줄 너비에 맞춰져요.'),
    P('css-setting', '다른 테마에서 넘어왔다면', '남아 있는 커스텀 CSS를 지우지 않고 잠시 꺼 둬요.'),
  ], pc: [
    C('search', '찾으면 바로 그 설정', '"내 사진 오른쪽"처럼 입력하면 그 자리로 가요.'),
    C('history', '되돌리기 · 다시 실행', ''),
    S('changes', '바꾼 설정만 모아서', ''),
    S('commas', 'PC 설정은 두 열로', '스위치와 슬라이더를 나란히 정리했어요.'),
    S('ext-drawer', '가지런한 확장 서랍', ''),
  ]},
];
const $ = s => document.querySelector(s);
function element(tag, cls, text) { const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e; }
// media cache keys: one stable key for everything; a file retaken under the same name gets its own entry here (never bump the stable key)
const RETAKEN={'434-hero-pc-light.mp4':'b','434-hero-pc-light.jpg':'b','434-hero-pc-dark.mp4':'b','434-hero-pc-dark.jpg':'b','434-scripts.png':'436','434-pc-scripts.png':'436','434-update-tool.png':'436','434-pc-update-tool.png':'436','434-words.png':'436','434-pc-words.png':'436','434-order.png':'436','434-pc-order.png':'436','434-models.png':'436','434-pc-models.png':'436','434-perf.png':'436','434-pc-perf.png':'436','434-modelswitch.png':'436','434-pc-modelswitch.png':'436'};
const mv=file=>'?v='+(RETAKEN[file]||'s1');

const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
let motionAllowed=false;try{motionAllowed=sessionStorage.getItem('bl-site-motion')==='1';}catch{}
const calm=()=>reduceMotion.matches&&!motionAllowed;
document.documentElement.classList.add('js');
const lightbox=$('#lightbox');
const inView=new IntersectionObserver(entries=>{for(const {target,isIntersecting} of entries){if(calm()||target.dataset.userPaused)continue;if(isIntersecting){if(!target.src&&target.dataset.src)target.src=target.dataset.src;target.play().catch(()=>{});}else target.pause();}},{threshold:.35});
function galleryBlock(topic, device, cards, withHeading){
  const block=element('section','gallery-block'), heading=element('div','gallery-heading'), label=element('div'); block.dataset.device=device;
  label.append(element('h3','',topic.title),element('p','',topic.sub));
  heading.append(label);
  const track=element('div','track'); track.tabIndex=0; track.setAttribute('aria-label',topic.title+(device==='pc'?' PC':'')+' 갤러리');
  const arrows=element('div','arrows'), buttons=[];
  for(const [symbol,dir,name] of [['←',-1,'이전'],['→',1,'다음']]){const b=element('button','',symbol);b.setAttribute('aria-label',topic.title+' '+name);b.onclick=()=>track.scrollBy({left:dir*(track.querySelector('.card').offsetWidth+16),behavior:reduceMotion.matches?'instant':'smooth'});arrows.append(b);buttons.push(b);}heading.append(arrows);
  const syncArrows=()=>{buttons[0].disabled=track.scrollLeft<4;buttons[1].disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-4;};
  track.addEventListener('scroll',syncArrows,{passive:true});addEventListener('resize',syncArrows);block.syncArrows=syncArrows;
  for(const [file,title,description,poster,gif,credit] of cards){
    const card=element('figure','card'), wrap=element('div','media-wrap'), caption=element('figcaption','',title); card.style.setProperty('--i',Math.min(track.children.length,6));
    if(file.startsWith('410-export.')||file.startsWith('420-capture-moving.'))wrap.classList.add('export-media');
    if(file.endsWith('.mp4')){
      const video=element('video');video.preload='none';video.playsInline=true;video.muted=true;video.loop=true;video.setAttribute('muted','');video.setAttribute('playsinline','');video.dataset.src='media/'+file+mv(file);video.poster='media/'+poster+mv(poster);video.setAttribute('aria-label',title);
      if(reduceMotion.matches){video.controls=true;video.src=video.dataset.src;}
      else{const state=element('span','play-state','▶');state.setAttribute('aria-hidden','true');wrap.classList.add('paused');
        video.addEventListener('play',()=>wrap.classList.remove('paused'));video.addEventListener('pause',()=>wrap.classList.add('paused'));
        video.addEventListener('click',()=>{if(!video.src&&video.dataset.src)video.src=video.dataset.src;if(video.paused){delete video.dataset.userPaused;video.play().catch(()=>{});}else{video.dataset.userPaused='1';video.pause();}});
        wrap.append(state);inView.observe(video);}
      wrap.prepend(video);
    }else{const img=element('img');img.src='media/'+file+mv(file);img.alt=title;img.loading='lazy';img.decoding='async';img.tabIndex=0;const open=()=>{lightbox.querySelector('img').src=img.src;lightbox.querySelector('img').alt=title;lightbox.querySelector('p').textContent=title;lightbox.showModal();};img.onclick=open;img.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();open();}};wrap.append(img);}
    caption.append(element('small','',description));if(credit){const c=element('a','gif-link',credit[0]);c.href=credit[1];c.target='_blank';c.rel='noopener';caption.append(c);}if(gif){const a=element('a','gif-link','움짤로 보기 ↗');a.href='media/'+gif+mv(gif);a.target='_blank';a.rel='noopener';caption.append(a);}card.append(wrap,caption);track.append(card);
  }block.append(heading,track);return block;
}
// Topic tabs: a topic's cards are built the first time it is opened, so the page starts with one topic's media instead of all of them
{
  const host=$('#galleries'), tabs=element('div','topic-tabs'), panels=new Map();tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','둘러볼 주제');
  const show=(id,focus)=>{
    for(const b of tabs.children){const on=b.dataset.topic===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus();
      if(on&&tabs.scrollWidth>tabs.clientWidth)tabs.scrollTo({left:b.offsetLeft-(tabs.clientWidth-b.offsetWidth)/2,behavior:reduceMotion.matches?'instant':'smooth'});}
    let panel=panels.get(id);
    if(!panel){const topic=topics.find(t=>t.id===id);panel=element('div','topic-panel');panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','topic-tab-'+id);
      if(topic.pc)panel.append(galleryBlock(topic,'pc',topic.pc,true));
      const phone=galleryBlock(topic,'mobile',topic.cards,true);if(topic.tall)phone.classList.add('tall-media');if(topic.guide){const g=document.querySelector('#rewrite-guide');if(g){g.hidden=false;phone.querySelector('.gallery-heading').after(g);}}if(topic.pc){phone.classList.add('after-pc');phone.querySelector('.gallery-heading>div').append(element('p','gallery-device','모바일 화면'));}panel.append(phone);panels.set(id,panel);host.append(panel);}
    for(const [key,p] of panels){p.hidden=key!==id;if(key!==id)for(const b of p.children)b.classList.remove('in');}
    requestAnimationFrame(()=>requestAnimationFrame(()=>{for(const b of panel.children){b.classList.add('in');b.syncArrows();}}));
    try{sessionStorage.setItem('bl-site-topic',id);}catch{}
  };
  for(const topic of topics){const b=element('button','',topic.label);b.type='button';b.id='topic-tab-'+topic.id;b.dataset.topic=topic.id;b.setAttribute('role','tab');b.append(element('span','',String(topic.cards.length+(topic.pc?topic.pc.length:0))));if(topic.fresh){b.classList.add('fresh-topic');b.setAttribute('aria-label',topic.label+' (새 기능 있음)');}b.onclick=()=>show(topic.id);tabs.append(b);}
  tabs.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();const list=[...tabs.children],i=list.findIndex(b=>b.getAttribute('aria-selected')==='true');show(list[(i+d+list.length)%list.length].dataset.topic,true);});
  host.before(tabs);
  for(const link of document.querySelectorAll('a[data-topic]'))link.addEventListener('click',()=>show(link.dataset.topic));
  let first=topics[0].id;try{const saved=sessionStorage.getItem('bl-site-topic');if(topics.some(t=>t.id===saved))first=saved;}catch{}
  show(first);
}
{const big=lightbox.querySelector('img');big.addEventListener('load',()=>{lightbox.classList.toggle('tall',big.naturalHeight>big.naturalWidth*1.9);lightbox.scrollTop=0;});}
lightbox.querySelector('.close').onclick=()=>lightbox.close();lightbox.onclick=e=>{if(e.target===lightbox)lightbox.close();};lightbox.addEventListener('close',()=>{lightbox.querySelector('img').src='';});
const SHOWN_NOTES=3;
fetch('release-notes.json').then(r=>{if(!r.ok)throw new Error('notes');return r.json();}).then(notes=>{$('#notes').replaceChildren();
  // one card per day, like the theme's own notice: a busy day reads as "v4.1.2 ~ v4.2.4 · 업데이트 13번"
  const days=[];for(const note of notes){const last=days.at(-1);if(last&&last.date===note.date)last.notes.push(note);else days.push({date:note.date,notes:[note]});}
  days.forEach((day,i)=>{const d=element('details','note');d.open=i===0;d.hidden=i>=SHOWN_NOTES;const s=element('summary'),first=day.notes.at(-1).version,latest=day.notes[0].version;
    s.append(element('span','num',latest));if(i===0)s.append(element('span','tag','NEW'));
    if(day.notes.length>1)s.append(element('span','span',`v${first} ~ v${latest} · 업데이트 ${day.notes.length}번`));
    s.append(element('span','date',day.date.replaceAll('-','.')),element('span','plus','+'));d.append(s);
    day.notes.forEach(note=>{if(day.notes.length>1)d.append(element('h4','ver','v'+note.version));const ul=element('ul');note.items.forEach((t,k)=>{const li=element('li','',t);li.style.setProperty('--i',Math.min(k,10));ul.append(li);});d.append(ul);});
    $('#notes').append(d);});
  if(days.length>SHOWN_NOTES){const more=element('button','notes-more',`이전 날짜 ${days.length-SHOWN_NOTES}일 더 보기`);more.type='button';more.onclick=()=>{document.querySelectorAll('.note[hidden]').forEach((n,k)=>{n.hidden=false;n.classList.add('appear');n.style.setProperty('--i',Math.min(k,12));});more.remove();};$('#notes').after(more);}
}).catch(()=>{$('#notes').textContent='업데이트 내역을 불러오지 못했어요. 잠시 후 새로고침해 주세요.';});
$('#copy-repo').onclick=async()=>{try{await navigator.clipboard.writeText($('#repo-url').textContent);const cb=$('#copy-repo');cb.textContent='복사됨 ✓';cb.classList.add('done');setTimeout(()=>{cb.textContent='복사';cb.classList.remove('done');},1800);$('#toast').textContent='설치 주소를 복사했어요.';$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),2200);}catch{$('#copy-repo').textContent='주소 선택';const r=document.createRange();r.selectNodeContents($('#repo-url'));const s=window.getSelection();s.removeAllRanges();s.addRange(r);}};
document.addEventListener('play',e=>{if(e.target.tagName==='VIDEO'&&e.target.controls)document.querySelectorAll('video').forEach(v=>{if(v!==e.target)v.pause();});},true);

// header: hairline after scrolling, current section in the nav
const header=$('.top');
let headerFrame=0;const onScroll=()=>{headerFrame=0;header.classList.toggle('scrolled',scrollY>8);};
addEventListener('scroll',()=>{if(!headerFrame)headerFrame=requestAnimationFrame(onScroll);},{passive:true});onScroll();
const navLinks=[...document.querySelectorAll('.top nav a')].map(a=>[a,document.querySelector(a.hash)]).filter(([,s])=>s);
// which section is under the middle of the screen — the browser reports it, nothing is measured per frame
let current=null;const setCurrent=id=>{current=id;for(const [a,s] of navLinks){const on=String(s.id===id);if(a.getAttribute('aria-current')!==on)a.setAttribute('aria-current',on);}};
const spy=new IntersectionObserver(entries=>{for(const e of entries){if(e.isIntersecting)setCurrent(e.target.id);else if(current===e.target.id)setCurrent(null);}},{rootMargin:'-45% 0px -54% 0px'});
navLinks.forEach(([,s])=>spy.observe(s));

// white / night toggle — follows the device until the visitor picks one
const root=document.documentElement, dark=matchMedia('(prefers-color-scheme: dark)');
$('#theme-toggle').onclick=e=>{const next=(root.dataset.theme||(dark.matches?'dark':'light'))==='dark'?'light':'dark';const swap=()=>{root.dataset.theme=next;try{localStorage.setItem('bl-site-theme',next);}catch{}document.dispatchEvent(new CustomEvent('bl-theme',{detail:next}));};
  if(!document.startViewTransition||reduceMotion.matches){swap();return;}
  const b=e.currentTarget.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,r=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  root.classList.add('theme-swap');const vt=document.startViewTransition(swap);vt.finished.finally(()=>root.classList.remove('theme-swap'));vt.ready.then(()=>root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${r}px at ${x}px ${y}px)`]},{duration:850,easing:'cubic-bezier(.45,0,.2,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>{});};

// quiet fade-up as blocks enter
const reveal=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('in');reveal.unobserve(e.target);}},{rootMargin:'0px 0px -8% 0px'});
document.querySelectorAll('.fresh-item').forEach((el,i)=>el.style.setProperty('--i',i));
document.querySelectorAll('.fresh,.section-head,.palette-layout,.reading-layout,.gallery-block,.feature-search,.notice-guide,#notes,.install-inner>*').forEach(el=>{el.classList.add('reveal');reveal.observe(el);});

// which device the visitor mostly uses: picked in the hero, remembered, defaults to the screen they are on
(() => {
  const html = document.documentElement, pcReady = topics.some(t => t.pc);
  $('#galleries').classList.toggle('has-pc', pcReady);
  document.querySelector('.hero-art')?.classList.toggle('has-pc', pcReady);
  const pick = document.querySelector('.device-pick');
  if (!pcReady) { pick?.remove(); return; }
  const set = device => { html.classList.toggle('device-pc', device === 'pc'); html.classList.toggle('device-mobile', device !== 'pc');
    pick.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.device === device)));
    document.querySelectorAll('.track').forEach(t => t.dispatchEvent(new Event('scroll'))); };
  set(html.classList.contains('device-pc') ? 'pc' : 'mobile');
  pick.addEventListener('click', e => { const b = e.target.closest('button[data-device]'); if (!b) return; set(b.dataset.device); try { localStorage.setItem('bl-site-device', b.dataset.device); } catch {} });
})();

// hero loops (phones for mobile, browser windows for PC): only the chosen device's pair is fetched
(() => {
  const art = document.querySelector('.hero-art'); if (!art) return;
  const vids = [...art.querySelectorAll('video.hero-video')];
  const shown = v => document.documentElement.classList.contains('device-pc') ? !!v.closest('.pc-stage') : !!v.closest('.phone-slot');
  const start = v => { if (!v.src && v.dataset.src) { if (v.dataset.poster) v.poster = v.dataset.poster; v.src = v.dataset.src; } v.muted = true; const p = v.play(); if (p) p.catch(() => { if (!motionAllowed) motionNote('blocked'); }); };
  // a quiet line under the hero when videos are held back, with one button to play them anyway
  function motionNote(why) { let n = document.querySelector('.motion-note'); if (!n) { n = document.createElement('p'); n.className = 'motion-note'; const t = document.createElement('span'), b = document.createElement('button'); b.type = 'button'; b.textContent = '영상 재생'; b.onclick = () => { motionAllowed = true; try { sessionStorage.setItem('bl-site-motion', '1'); } catch {} n.remove(); sync(); for (const v of document.querySelectorAll('.topic-panel:not([hidden]) video')) { const r = v.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) { if (!v.src && v.dataset.src) v.src = v.dataset.src; v.play().catch(() => {}); } } }; n.append(t, b); (document.querySelector('.device-pick') || art).after(n); } n.firstChild.textContent = why === 'blocked' ? '절전 모드 등으로 자동 재생이 막혀 있어요.' : '기기의 ‘애니메이션 줄이기’가 켜져 있어 영상을 멈춰 뒀어요.'; }
  const sync = () => { const on = !document.hidden && !calm() && !art.classList.contains('idle'); for (const v of vids) { if (shown(v) && on) start(v); else v.pause(); } };
  new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(sync).observe(art, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', sync);
  reduceMotion.addEventListener('change', () => { if (calm()) motionNote('reduce'); else document.querySelector('.motion-note')?.remove(); sync(); });
  if (calm()) motionNote('reduce');
  sync();
})();
