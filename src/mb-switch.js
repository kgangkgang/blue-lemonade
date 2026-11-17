// 1.7.3 미트볼 맞춤 스위치 — 블루레몬이 미트볼 상태창에 손대는 것을 하나씩 켜고 끄는 표(한 곳)예요.
//   미트볼 원작자(11-17): 「테마가 교정한 것들 각각 다 온오프 기능만 넣어 주면 필요한 것만 껐다 켰다 하기 편할 것 같아」 — 원작의 「데이터 보호 · 화면 보호」와 짝이 맞게
//   화면만 바꾸는 것(screen)과 데이터를 고치는 것(data · 그 확장의 저장 자료 · 설정 값 · AI 요청을 바꿔요) 두 갈래로 나눠요.
//   · 기본값은 전부 켬(지금 동작 그대로) — 끈 열쇠만 테마 설정 chat.mbOff(배열)에 적어요. 새 스위치가 생겨도 옛 설정은 켬이에요.
//   · 이미 있던 스위치(뒤로 가기 · 지도 층별 · 영어 저장 · 눈 감긴 답 · 편의 기능 · 추억 앨범 단추 · 얼굴 표시 · 미트볼 문구)는 키를 바꾸지 않고 그 키를 그대로 써요(setting).
//   · 켜고 끄기는 html 표식 하나(data-bl-mb-off="arrow ask …" — 끈 열쇠를 띄어 적어요 · 다 켜져 있으면 표식 없음)로 알려요:
//     맞춤 시트(src/ext-status.gen.css — tools/css-mb-gate.cjs 가 원본 src/ext-status.css 의 규칙마다 :where(:root:not([data-bl-mb-off~="열쇠"])) 를 붙여요)는
//     다시 읽기 없이 바로 그 묶음 규칙이 안 먹고, 모듈은 일할 때마다 mbOff() 로 보고 쉬어요(바뀐 순간 할 일이 있으면 문서 사건 'bl-mb-off' 를 들어요).
//   · 데이터를 고치는 것은 끄면 더는 고치지 않아요(이미 고친 기록은 그대로 · 되돌리기는 원작 되돌리기).
//   시험: tools/tests/mb-toggles.mjs
export const MB_OFF_ATTR = 'data-bl-mb-off';
export const MB_OFF_EVENT = 'bl-mb-off';

/**
 * 스위치 표. key = 끄는 열쇠(시트 묶음 · 모듈이 같이 써요) · kind = screen(화면만) | data(데이터를 고침) · name = 설정 이름 · desc = 해요체 한 줄(무엇이 바뀌고 끄면 원작과 어떻게 같은지)
 *   group = 설정 창 안 작은 묶음 · file = 그 일을 하는 파일(보고 · 시험용) · setting = 이미 있던 설정 키(chat.*) · invert = 그 키가 참이면 끈 것 · choice = 고르기 설정({ off: 원작 값 })
 *   css = 맞춤 시트에 이 열쇠 묶음이 있어요 · words = 설정 찾기 낱말
 */
export const MB_SWITCHES = [
    // ── 화면만: 모양 ──
    { key: 'icons', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '그림 글자를 선 아이콘으로', desc: '미트볼 화면의 그림 글자(이모지) · 계기판 고양이 · 묶음 탭 아이콘을 테마 선 아이콘으로 그려요 · 끄면 원작 그림 글자예요(글자 자체는 원래부터 그대로)', words: '이모지 그림 글자 아이콘 고양이 탭 아이콘 선 아이콘 emoji icon' },
    { key: 'font', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '글꼴 · 글자 크기 · 굵기', desc: '미트볼 화면 글꼴을 테마 글꼴(또는 고른 미트볼 글꼴)로, 글자 크기 · 굵기를 테마 단(400 · 650)으로 맞춰요 · 끄면 원작 글꼴 · 크기예요(이때 글 속 그림 글자는 선 아이콘이 아니에요)', words: '글꼴 폰트 글자 크기 굵기 font size weight' },
    { key: 'palette', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '색을 테마 팔레트로', desc: '그 확장의 색 변수 · 박힌 색 · 무늬 · 강조 면을 낮 · 밤 · 에이드 팔레트로 바꾸고 대비가 모자란 글자색을 고쳐요 · 끄면 원작 색 · 「꾸미기」 색 판 그대로예요', words: '색 팔레트 색깔 대비 무늬 체크무늬 color palette' },
    { key: 'controls', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '단추 · 입력창 · 스위치 모양', desc: '단추 · 입력창 · 켬끔 스위치 · 고르기 · 탭 · 칩을 테마 부품 꼴(높이 36 · 모서리 8 · 고른 것은 옅은 면)로 맞춰요 · 끄면 원작 모양이에요', words: '단추 버튼 입력창 스위치 고르기 탭 칩 높이 모서리 button' },
    { key: 'dialog', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '창 면 · 닫기 ✕', desc: '미트볼 창을 테마 팝업 면 · 그림자로 그리고, 큰 창은 아래 「닫기」 줄 대신 오른쪽 위 ✕ 로 닫아요 · 창 위아래 여백을 같게 맞춰요 · 끄면 원작 창이에요', words: '창 팝업 닫기 엑스 여백 dialog close' },
    { key: 'layout', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '배치 · 두 열', desc: '조절 칸 · 짧은 항목 · 기능 카드 · 루트 비교를 두 열로 놓고, 좁은 화면에서 창 머리 · 관계 카드 머리 · 묶음 줄이 꺾이지 않게 맞춰요 · 끄면 원작 배치(대개 한 열)예요', words: '배치 두 열 2열 세로 좁은 화면 폰 layout column' },
    { key: 'spacing', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '간격', desc: '카드 · 단추 · 설명 글 사이 틈을 4 · 8 · 12 · 16 눈금으로 맞춰 붙어 보이던 곳을 띄워요 · 끄면 원작 간격이에요', words: '간격 틈 여백 붙어 있음 spacing gap' },
    { key: 'touch', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '누를 자리 44', desc: '손가락 화면에서 작은 단추 · 탭 · 손잡이의 누를 자리를 44 로 넓혀요(보이는 크기는 그대로) · 끄면 원작 크기만큼만 눌려요', words: '누를 자리 터치 손가락 44 touch target' },
    { key: 'blur', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '흐림 끄기', desc: '옆 서랍 · 작은 판 · 알림의 뒤 흐림과 상태창 창 안 스크롤 흐림을 꺼서 글이 번지지 않게 해요 · 끄면 원작처럼 흐려요', words: '흐림 블러 번짐 스크롤 흐림 blur' },
    { key: 'next', kind: 'screen', group: 'look', css: true, file: 'src/ext-status.css', name: '다음 판 미리 맞춤', desc: '아직 나오지 않은 미트볼 판(2.8 준비 갈래 「같은 모양」 · 다마고치 · 상점 진열대)의 화면을 미리 테마 색으로 맞춰 둬요 · 지금 판에는 그 화면이 없어 대개 아무 일도 없어요', words: '다음 판 미리 맞춤 같은 모양 다마고치 상점 next version' },
    // ── 화면만: 자리별 ──
    { key: 'band', kind: 'screen', group: 'place', css: true, file: 'src/ext-status.css', name: '채팅 위 띠 · 알림 자리', desc: '채팅 위 띠를 입력창 폭 · 카드 면으로, 폰에서 두 줄로 줄이고 칸 글자 · 펼친 칸을 한 줄로 맞춰요 · 알림이 띠를 덮지 않게 띠 아래에서 떠요 · 끄면 원작 띠예요', words: '띠 상태 띠 허드 hud 알림 자리 가장자리 손잡이' },
    { key: 'bandrow', kind: 'screen', group: 'place', css: true, file: 'src/ext-compat.js', name: '띠 한 줄로 맞추기', desc: '폰에서 띠 칸이 셋 이하이거나 마지막 줄 오른쪽이 비면 단추 줄을 그 자리로 올려 띠를 한 줄 짧게 해요 · 끄면 원작처럼 단추 줄이 아래 따로 있어요', words: '띠 한 줄 단추 줄 올리기 one row' },
    { key: 'weekday', kind: 'screen', group: 'place', css: true, file: 'src/ext-compat.js', name: '띠 날짜에 요일', desc: '띠 날짜 칩 「아침 4/1」 뒤에 그 확장 달력의 요일을 한국어 한 글자로 붙여 보여요(「(월)」) · 끄면 원작처럼 날짜만이에요', words: '요일 날짜 달력 띠 weekday' },
    { key: 'badge', kind: 'screen', group: 'place', css: true, file: 'src/ext-compat.js', name: '종 숫자 배지 「9+」', desc: '띠 종(알림함)의 숫자 배지를 종 모서리에 작게 두고 10 이상은 「9+」로 보여요(적힌 숫자는 그대로) · 끄면 원작 배지예요', words: '종 배지 알림 숫자 9+ badge' },
    { key: 'dot', kind: 'screen', group: 'place', css: true, file: 'src/ext-compat.js', name: '눌러 본 칸 빨간 점 숨기기', desc: '방금 바뀐 칸의 빨간 점을 한 번 눌러 보면 다음 AI 답까지 숨겨요 · 끄면 원작처럼 다음 답까지 남아요', words: '빨간 점 바뀐 칸 점 숨기기 dot' },
    { key: 'grid', kind: 'screen', group: 'place', css: true, file: 'src/ext-compat.js', name: '이름표 → 값 두 열', desc: '프로필 · 관계 · 장소의 「이름표 → 값」 목록을 두 열로 놓고 긴 값만 한 줄 통째로 써요 · 끄면 원작처럼 한 줄에 하나씩이에요', words: '이름표 값 목록 두 열 프로필 관계 장소 grid' },
    { key: 'chips', kind: 'screen', group: 'place', css: true, file: 'src/ext-status.css', name: '답 아래 변동 칩 모양', desc: '답 아래 변동 칩을 테마 딱지 꼴로 그리고 긴 이름 칩이 화면 밖으로 안 나가게 줄을 바꿔요 · 끄면 원작 칩이에요', words: '변동 칩 메시지 칩 답 아래 chip' },
    { key: 'drawer', kind: 'screen', group: 'place', css: true, file: 'src/ext-status.css', name: '설정 칸 줄 맞춤', desc: '확장 서랍의 미트볼 설정 칸에서 줄 사이 · 숫자 칸 폭 · 체크 줄 · 단추 줄 · 머리줄을 테마 설정 줄 꼴로 맞춰요 · 끄면 원작 설정 칸이에요', words: '설정 칸 서랍 줄 맞춤 숫자 칸 체크 drawer' },
    { key: 'tabs', kind: 'screen', group: 'place', css: true, file: 'src/ext-compat.js · src/ext-organize.js', name: '설정 칸 탭 나누기 · 정리한 보기', desc: '긴 미트볼 설정 칸을 묶음 머리마다 가로 탭으로 나누고 탭 설명 · 접는 갈래 · 숫자 두 열 · 비용 표시로 정리해 보여요(값 저장은 원작 그대로) · 끄면 원작처럼 한 줄로 길게 다 보여요', words: '설정 칸 탭 나누기 정리한 보기 분류 탭 tabs' },
    { key: 'helpers', kind: 'screen', group: 'place', css: true, setting: 'chat.mbHelpers', file: 'src/ext-compat.js', name: '설정 찾기 · 맨 위로', desc: '미트볼 설정 칸의 「설정 찾기」 돋보기와 긴 상태창의 「맨 위로」 단추를 보여요 · 끄면 둘 다 사라지고 나머지 맞춤 화면은 그대로예요', words: '설정 찾기 돋보기 맨 위로 편의 기능' },
    // ── 화면만: 더한 것 · 동작 ──
    { key: 'face', kind: 'screen', group: 'add', css: true, setting: 'chat.mbFace', choice: { off: 'icon' }, file: 'src/ext-compat.js · src/mb-face-now.js', name: '미트볼 얼굴 표시', desc: '얼굴 자리를 동물 아이콘 대신 이름 첫 글자 · 정해 둔 인물 색으로 보여요(고르는 칸 — 기본은 아이콘 = 원작 그림)', words: '얼굴 첫 글자 색만 아이콘 프로필 얼굴 face' },
    { key: 'avapick', kind: 'screen', group: 'add', css: true, file: 'src/ext-compat.js', name: '얼굴 고르개', desc: '「얼굴 바꾸기」 창의 고르개 자리에 선 아이콘 고르개를 놓아요(고른 그림은 그 창 입력창에 적히고 저장은 원작 「저장」 단추) · 끄면 원작 창 그대로예요', words: '얼굴 바꾸기 고르개 아이콘 고르기 picker' },
    { key: 'deco', kind: 'screen', group: 'add', css: true, file: 'src/ext-compat.js', name: '꾸미기 창 「블루레몬 꾸미기」 묶음', desc: '미트볼 「꾸미기」 창에 글꼴 · 얼굴 표시 · 색 톤을 고르는 「블루레몬 꾸미기」 묶음을 끼워요 · 끄면 원작 꾸미기 창이에요(이 칸들은 테마 설정에서 바꿔요)', words: '꾸미기 창 블루레몬 꾸미기 묶음 deco' },
    { key: 'arrow', kind: 'screen', group: 'add', css: true, file: 'src/mb-arrow.js', name: '「->」를 화살표 그림으로', desc: '그 확장 글의 「저녁 -> 밤」 같은 「->」를 테마 선 화살표 그림으로 보여요(글 · 복사 글 · 자료는 그대로) · 끄면 원작처럼 「->」 글자예요', words: '화살표 꺾쇠 -> arrow' },
    { key: 'floors', kind: 'screen', group: 'add', css: true, setting: 'chat.mbMapFloors', file: 'src/mb-map-floors.js', name: '지도 층별 보기', desc: '장소 설명에 층이 적힌 지도를 층 띠 · 꺾인 선의 건물 단면으로 다시 놓아요(장소 자료는 그대로) · 끄면 원작 지도 그림이에요', words: '지도 층 층별 건물 지하 map floor' },
    { key: 'trend', kind: 'screen', group: 'add', css: true, file: 'src/mb-trend.js', name: '변화 그래프 다시 그리기', desc: '변화 그래프 창을 프로필 얼굴 색 · 둥근 선 · 누르면 한 사람 강조로 다시 그려요(자료는 그대로) · 끄면 다음에 여는 그래프부터 원작 그래프예요', words: '변화 그래프 추이 선 색 trend graph' },
    { key: 'addon', kind: 'screen', group: 'add', css: true, file: 'src/ext-status.css', name: '부가 기능 탭 정렬', desc: '상태창 「부가 기능」 탭의 단추 높이 · 줄 머리 · 단추 아래 틈을 맞춰요 · 끄면 원작 배열이에요', words: '부가 기능 탭 정렬 방명록 addon' },
    { key: 'album', kind: 'screen', group: 'add', css: true, setting: 'chat.mbAlbumBtn', invert: true, file: 'src/ext-status.css', name: '「추억 앨범에 담기」 단추 숨기기', desc: '답마다 이름 줄에 붙는 「추억 앨범에 담기」 단추를 숨겨 폰 이름 줄이 한 줄에 들어가요(앨범 기능 · 앨범 탭은 그대로) · 끄면 원작처럼 단추가 보여요', words: '추억 앨범 단추 별 이름 줄 album' },
    { key: 'ask', kind: 'screen', group: 'add', file: 'src/mb-ask.js', name: '바로 지워지는 단추에 한 번 묻기', desc: '알림함 비우기 · 비밀 · 기억 · 편지 지우기 · 답장 다시 받기처럼 묻지 않고 바로 지워지는 단추에 확인 창을 덧대요 · 끄면 원작처럼 누르자마자 지워요', words: '지우기 확인 창 묻기 알림함 비우기 비밀 기억 편지 confirm' },
    { key: 'back', kind: 'screen', group: 'add', setting: 'chat.mbBack', file: 'src/mb-back.js', name: '뒤로 가기로 미트볼 창 닫기', desc: '폰의 뒤로 가기를 누르면 열려 있는 미트볼 창이 한 겹씩 닫혀요 · 끄면 원작처럼 뒤로 가기가 창을 안 닫아요', words: '뒤로 가기 뒤로가기 창 닫기 back' },
    { key: 'note', kind: 'screen', group: 'add', file: 'src/mb-note.js', name: '「작가 노트 넣기」 단추', desc: '프로필 「AI로 수정」 지시칸 · 만들기 「추가 지시」 칸 옆에 이 채팅의 작가 노트를 붙이는 단추와 채팅마다 한 번 알림을 둬요 · 끄면 원작처럼 단추가 없어요', words: '작가 노트 넣기 단추 지시칸 author note' },
    // ── 화면만: 화면만 번역 빈틈 ──
    { key: 'trchip', kind: 'screen', group: 'tr', file: 'src/ext-bridge-tr.js', name: '칩 번역 다시 적기', desc: '「화면만 번역」에서 반쯤 바뀌어 남던 답 아래 칩 글을 그 확장 사전으로 다시 적고, 옛 답의 날 칩 · 시간대 · 날씨 칩을 지금 칩 꼴로 보여요(AI 0 · 자료 그대로) · 끄면 다음에 그릴 때부터 원작 칩 글이에요', words: '칩 번역 화면만 번역 시간대 날씨 옛 답 칩 아이콘' },
    { key: 'trtoast', kind: 'screen', group: 'tr', file: 'src/ext-bridge-tr.js', name: '미트볼 알림 번역', desc: '「화면만 번역」일 때 그 확장이 띄우는 알림 글도 그 확장 사전으로 바꿔 보여요 · 끄면 원작처럼 알림은 저장 언어 그대로예요', words: '알림 번역 토스트 화면만 번역 toast' },
    // ── 데이터를 고치는 것 ──
    { key: 'hidden', kind: 'data', group: 'data', setting: 'chat.mbHiddenSync', file: 'src/mb-hidden.js', name: '눈 감긴 답은 미트볼 상태에서 빼기', desc: '눈 단추로 감긴 AI 답의 메시지 칸(extra.type)에 표식을 적어 그 확장이 그 답의 변화를 건너뛰게 해요 · 끄면 더는 안 적고 남은 표식을 치워요(원작은 감긴 답도 더해요) · 감긴 답 뒤에 그 확장의 칸 통째 저장 기록이 있으면 아래 「눈 감기 · 삭제 바로 반영」이 빼요(그걸 끄면 안 빠진다고 한 줄로 알려요)', words: '눈 감긴 숨긴 메시지 빼기 통째 저장 hidden' },
    { key: 'autosub', kind: 'data', group: 'data', file: 'src/mb-autosub.js', name: '눈 감기 · 삭제 바로 반영', desc: '감긴 답 · 지운 답(스와이프)보다 뒤에 그 확장의 칸 통째 저장(영어 저장 바꾸기 등)이 있으면, 그 저장 바로 뒤에 그 답의 애정 · 우정 · 돈 · 수치 변화를 빼는 편집 기록(「눈 감긴 답 #31 빼기 (블루레몬)」)을 끼워 바로 반영해요 · 눈을 뜨면 그 기록을 빼서 돌아와요 · 관리 탭 「편집 기록 — 골라서 지우기」로 되돌려요 · 끄면 더는 안 끼우고 1.7.3 처럼 알림만 띄워요(이미 끼운 기록은 그대로)', words: '눈 감기 삭제 지운 답 스와이프 바로 반영 통째 저장 빼기 애정 우정 autosub' },
    { key: 'autoen', kind: 'data', group: 'data', setting: 'chat.mbAutoEn', file: 'src/mb-auto-en.js', name: '영어 저장 전환을 묻지 않고 바로', desc: '「한국어로 저장된 칸을 영어 저장으로 바꾸기」의 「바꿀까요?」 창 없이 바로 바꿔요(칸마다 /ss-undo 는 그대로) · 날짜 때문에 생기는 관계 칸은 자동으로 바꾸지 않아요(같은 채팅 같은 칸은 한 번만) · 끄면 원작처럼 물어요', words: '영어 저장 전환 확인 창 자동 네 english' },
    { key: 'prompt', kind: 'data', group: 'data', setting: 'chat.mbPrompt', choice: { off: 'off' }, file: 'src/mb-prompt.js', name: '미트볼 문구: 블루레몬 추천', desc: '만들기 · 칸 다시 생성 · AI로 수정 문구 끝에 채팅 본문을 더 읽히는 블루레몬 줄을 덧붙여요(고르는 칸 — 기본 「적용 안 함」 = 원작 문구)', words: '미트볼 문구 프롬프트 추천 채팅 전체' },
    { key: 'rules', kind: 'data', group: 'data', file: 'src/mb-prompt.js', name: '줄 꼴 규칙 덧붙이기', desc: '미트볼 문구를 쓰는 동안 본편 「출력 규칙」 · 「별도 분석」 문구 끝에 변화 줄 꼴을 바로잡는 한 덩이를 붙여요 · 끄면 그 덩이만 떼요(손으로 고친 문구는 그대로)', words: '줄 꼴 규칙 출력 규칙 별도 분석 rules' },
    { key: 'read', kind: 'data', group: 'data', file: 'src/mb-read.js', name: '만들기 화면 「채팅 읽기」 고르기', desc: '상태창 만들기 화면 맨 위에 이번 만들기에만 채팅을 더 읽히는 고르기와 어림 한 줄을 놓아요(고르면 그 확장 문구를 잠깐 바꿔요) · 끄면 원작 만들기 화면이에요', words: '만들기 채팅 읽기 고르기 이번 한 번만 wizard' },
    { key: 'ledger', kind: 'data', group: 'data', file: 'src/mb-prompt.js', name: '변화 장부 · 이름 장부 싣기', desc: '「채팅 전체」 · 「기억 요약」으로 보낼 때 본편 AI 가 남긴 변화 합 · 사건 · 마지막 장소 · 직함과 진짜 이름 짝을 글 앞에 실어요 · 끄면 본문만 실어요', words: '변화 장부 이름 장부 직함 ledger' },
    { key: 'relfix', kind: 'data', group: 'data', file: 'src/mb-prompt.js', name: '만든 뒤 관계 숫자 · 시간대 바로잡기', desc: '「채팅 전체」 · 「기억 요약」으로 만든 직후 관계 애정 · 우정이 채팅 변화 합보다 처음 쪽에 머물면 그 합까지 올리고, 시간대를 마지막 시간대로 맞춰요(상태창 기준 자료를 고쳐요) · 끄면 AI 가 만든 그대로예요', words: '관계 숫자 바로잡기 애정 우정 시간대 relationship' },
    { key: 'fill', kind: 'data', group: 'data', file: 'src/mb-prompt.js', name: '만든 뒤 빈 프로필 채우기', desc: '관계 칸에는 있는데 프로필이 없는 사람에게 관계 칸 이름표 · 메모로 짧은 프로필을 더해요(AI 0 · 표식을 남겨요) · 끄면 더하지 않아요', words: '프로필 채우기 빈 프로필 profile fill' },
    { key: 'rename', kind: 'data', group: 'data', file: 'src/mb-prompt.js', name: '만든 뒤 직함 이름 바꾸기', desc: '만든 상태창의 이름 칸이 한 사람에게만 속하는 직함이면 카드 · 로어북의 진짜 이름으로 바꿔요 · 끄면 AI 가 적은 그대로예요', words: '직함 이름 바꾸기 rename title' },
    { key: 'merge', kind: 'data', group: 'data', file: 'src/mb-prompt.js', name: '직함 줄 · 이름 줄 합치기', desc: '관계 칸에 같은 사람이 직함 줄과 이름 줄로 나뉘어 있으면 그 확장 「합치기」와 같은 편집 기록을 더해요(채팅을 열 때 · 만든 뒤 · 관리 탭에서 되돌려요) · 끄면 더하지 않아요', words: '합치기 직함 줄 이름 줄 merge' },
    { key: 'dedupe', kind: 'data', group: 'data', file: 'src/mb-prompt.js', name: '중복 프로필 정리', desc: '채팅을 열 때 블루레몬이 더했던 프로필이 다른 프로필과 같은 사람이면 그것만 지워요(직접 · AI 가 만든 프로필은 그대로) · 끄면 지우지 않아요', words: '중복 프로필 정리 dedupe' },
    { key: 'trtidy', kind: 'data', group: 'data', file: 'src/ext-bridge-tr.js', name: '번역 사전에 고정 낱말 넣기', desc: '「화면만 번역」 사전(채팅 메타 tr)에 요일 · 시간대 · 날씨 같은 고정 낱말 짝을 넣고 깨진 짝을 되살려요(AI 0) · 끄면 사전을 안 고쳐요', words: '번역 사전 고정 낱말 요일 시간대 날씨 tidy' },
    { key: 'trfill', kind: 'data', group: 'data', file: 'src/ext-bridge-tr.js', name: '남은 영어 번역 메우기', desc: '번역을 마친 뒤 칩 · 알림함 · 상태 칸에 영어로 남은 글만 그 확장 번역 길(번역 모델 · AI 요청)로 옮겨 같은 사전에 넣어요 · 끄면 원작이 번역한 만큼만이에요', words: '남은 영어 번역 메우기 AI 번역 fill' },
    { key: 'glossary', kind: 'data', group: 'data', file: 'src/ext-bridge.js', name: '번역 용어집 싣기', desc: '미트볼 설정 칸의 블루레몬 「번역 용어집」을 켜 둔 때 그 확장 AI 요청 · 본편 요청에 나온 이름의 용어집 줄을 붙여요 · 끄면 켜 둔 것이 있어도 안 붙여요', words: '번역 용어집 glossary' },
    { key: 'model', kind: 'data', group: 'data', file: 'src/ext-bridge.js', name: '고른 모델로 보내기', desc: '미트볼 설정 칸에서 기능마다 고른 회사 · 모델이 있으면 그 확장 AI 요청을 그 모델로 보내요 · 끄면 골라 둔 것이 있어도 원작처럼 메인 연결로 보내요', words: '모델 고르기 회사 모델 직접 연결 model' },
];
export const MB_KEYS = MB_SWITCHES.map(sw => sw.key);
const BY_KEY = new Map(MB_SWITCHES.map(sw => [sw.key, sw]));
export const switchOf = key => BY_KEY.get(key) || null;
/** 설정 창 묶음 이름(차례 그대로) */
export const MB_GROUPS = [['look', '모양'], ['place', '자리별 맞춤'], ['add', '더한 것 · 동작'], ['tr', '화면만 번역 빈틈'], ['data', '데이터를 고치는 것']];

const chatKey = sw => sw.setting?.split('.')[1];
/** 이 스위치가 켜져 있나(테마 설정 기준) */
export function switchOn(settings, key) {
    const sw = BY_KEY.get(key), chat = settings?.chat || {};
    if (!sw) return true;
    if (!sw.setting) return !(Array.isArray(chat.mbOff) && chat.mbOff.includes(key));
    const v = chat[chatKey(sw)];
    if (sw.choice) return v !== sw.choice.off && v !== undefined;
    if (sw.invert) return v !== true;
    return v !== false;
}
/** html 표식에 적을 끈 열쇠(띄어 적은 글 · 다 켜져 있으면 '') — 고르는 칸(얼굴 표시 · 미트볼 문구)은 제 표식 · 설정을 따로 써서 빼요 */
export function offAttrValue(settings) {
    const out = [];
    for (const sw of MB_SWITCHES) if (!sw.choice && !switchOn(settings, sw.key)) out.push(sw.key);
    return out.join(' ');
}
/**
 * 한 스위치를 켜거나 꺼요(테마 설정 chat 을 그 자리에서 고쳐요). 고르는 칸은 끌 때 원작 값으로 두고 그때 값을 mbAllWas 에 적어 둬요 — 다시 켜면 그 값으로.
 */
export function setSwitch(chat, key, on) {
    const sw = BY_KEY.get(key); if (!sw || !chat) return false;
    if (sw.setting) {
        const k = chatKey(sw);
        if (sw.choice) {
            const was = chat.mbAllWas && typeof chat.mbAllWas === 'object' ? chat.mbAllWas : (chat.mbAllWas = {});
            if (!on) { if (chat[k] !== undefined && chat[k] !== sw.choice.off) was[k] = chat[k]; chat[k] = sw.choice.off; }
            else if (was[k] !== undefined) { chat[k] = was[k]; delete was[k]; }   // 적어 둔 값이 없으면 그대로 — 고르는 칸(얼굴 표시 · 토큰이 드는 미트볼 문구)은 「켜기」로 저절로 고르지 않아요
        } else chat[k] = sw.invert ? !on : !!on;
        return true;
    }
    const list = new Set(Array.isArray(chat.mbOff) ? chat.mbOff : []);
    if (on) list.delete(key); else list.add(key);
    chat.mbOff = [...list];
    return true;
}
/** 전부 · 화면만 · 데이터만 켜거나 꺼요. kind = all | screen | data · 미트볼 문구(토큰이 드는 고르기)는 「켜기」로 저절로 켜지 않아요(끄기 전 단계가 적혀 있으면 그것으로) */
export function setAll(chat, on, kind = 'all') {
    for (const sw of MB_SWITCHES) if (kind === 'all' || sw.kind === kind) setSwitch(chat, sw.key, on);
    return chat;
}
/** 이 문서에서 그 스위치가 꺼져 있나(html 표식) — 문서를 모르면 켜진 것으로 */
export function mbOff(key, doc = globalThis.document) {
    let v = '';
    try { v = doc?.documentElement?.getAttribute?.(MB_OFF_ATTR) || ''; } catch { v = ''; }
    return !!v && ` ${v} `.includes(` ${key} `);
}
/** 맞춤 시트가 걸리는 때(테마 켬 · 원작 그대로 보기 아님)이면서 그 스위치가 켜져 있나 */
export function mbFit(key, doc = globalThis.document) {
    const body = doc?.body;
    return !!body?.classList?.contains?.('salty') && !body.hasAttribute?.('data-bl-ext-raw') && !mbOff(key, doc);
}
/** html 표식을 맞추고(바뀌었으면) 문서 사건을 한 번 내요 → 바뀌었나 */
export function syncOffAttr(value, doc = globalThis.document, before = () => {}) {
    const root = doc?.documentElement; if (!root) return false;
    const had = root.getAttribute(MB_OFF_ATTR) || '';
    if (had === value) return false;
    before();
    if (value) root.setAttribute(MB_OFF_ATTR, value); else root.removeAttribute(MB_OFF_ATTR);
    try { doc.dispatchEvent(new (doc.defaultView?.CustomEvent || globalThis.CustomEvent)(MB_OFF_EVENT, { detail: { off: value ? value.split(' ') : [], was: had ? had.split(' ') : [] } })); } catch { /* 사건 없이 — 모듈은 일할 때마다 표식을 봐요 */ }
    return true;
}
/** 문서 사건 받기(바뀐 열쇠마다 한 번) — fn(key, off) */
export function onMbOff(doc, keys, fn) {
    try {
        doc?.addEventListener?.(MB_OFF_EVENT, e => {
            const off = new Set(e?.detail?.off || []), was = new Set(e?.detail?.was || []);
            for (const k of keys) if (off.has(k) !== was.has(k)) { try { fn(k, off.has(k)); } catch { /* 다음 바뀜에 */ } }
        });
        return true;
    } catch { return false; }
}
