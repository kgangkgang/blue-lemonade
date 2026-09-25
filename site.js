'use strict';
// Synthetic demonstration chats; calm scenes and palette controls use the current runtime.
const topics = [
{
  "id": "new498",
  "label": "새 기능",
  "title": "그림도 번역도, 내 방식으로",
  "sub": "메모부터 전개 지시 · 그림 관리 · 번역까지 실제 사용 흐름을 살펴보세요. 영상은 5.3.2 화이트 테마로 찍었어요. 메모 태그 · 연결 · 폴더는 5.3.3 에서 생겼어요.",
  "tall": true,
  "cards": [
    ["532-notes-write.mp4", "메모 · 적고 체크하고 색 입히기", "입력창 위 ☰ 로 메모 목록을 열어요. 체크박스는 눌러서 체크하고, 목록 줄에서 엔터를 누르면 다음 줄이 이어져요. 메모지 색 · 글자색은 테마 팔레트 색이나 내 색으로 골라요.", "532-notes-write.jpg"],
    ["532-notes-arrange.mp4", "메모 · 꾹 눌러 옮기고 찾기", "메모를 꾹 눌러 끌면 칸 자리가 바뀌어요. 정렬 · 찾기는 머리에서 바로 쓰고, 채팅 안에서 만든 메모는 그 채팅에서만 보여요. PC 에서는 목록 밖에 놓으면 스티커로 떠요.", "532-notes-arrange.jpg"],
    ["524-direction.mp4", "전개 지시 · 다음 장면을 깃펜에", "원하는 전개를 적고 켜면 대화 요청마다 지시가 들어가요. 끄면 내용은 남고 삽입만 멈춰요. 깃펜을 길게 누르면 창 없이 바로 켜고 꺼요. 켜짐은 깃펜의 빛으로 표시합니다.", "524-direction.jpg"],
    ["524-ade-presets.mp4", "캐릭터 에셋 · 그림 프리셋을 따로", "그림을 폴더별로 나누고 프리셋 전체를 켜거나 꺼요. 같은 파일 이름은 켜진 폴더 중 위쪽 것이 우선해요. 시연 그림은 테마 마스코트 에이드와 나이트예요.", "524-ade-presets.jpg"],
    ["524-ade-toggle.mp4", "캐릭터 에셋 · 쓸 그림만 골라요", "그림을 크게 보고 하나씩 껐다 켜요. 끈 그림은 파일을 지우지 않고 AI에게 알려 주는 목록에서 제외해요. 시연 그림은 테마 마스코트 에이드와 나이트예요.", "524-ade-toggle.jpg"],

    ["500-llm-glossary-world.mp4", "LLM 용어집 · 월드인포에서 뽑기", "세계관의 이름·지명·단체를 후보로 뽑고 표기를 고친 뒤 필요한 것만 넣어요. 일상 단어는 기본 선택에서 빠져요. 가상 자료와 시연용 모델 응답을 사용했습니다.", "500-llm-glossary-world.jpg"],
    ["500-llm-glossary-chat.mp4", "LLM 용어집 · 번역문에서 뽑기", "캐릭터 카드와 최근 원문·번역문에서 쓰인 표기를 모아요. 후보를 수정하고 골라 이 캐릭터 용어집에 저장해요. 가상 자료와 시연용 모델 응답을 사용했습니다.", "500-llm-glossary-chat.jpg"],
    ["500-llm-send-context.mp4", "보내기 번역 · 참고정보도 함께", "캐릭터 설정·페르소나·월드인포·작가 노트·최근 대화를 골라 번역 요청에 참고로 넣어요. 이름과 말투를 맞추는 데 쓰며, 추가한 만큼 입력 토큰이 늘어요.", "500-llm-send-context.jpg"],
    ["500-llm-split-language.mp4", "서술은 영어 · 대사는 일본어", "보내는 글의 서술과 대사에 다른 언어를 지정할 수 있어요. 대사 언어를 비우면 서술과 같은 언어를 써요. 영상은 설정 시연입니다.", "500-llm-split-language.jpg"],
    ["500-llm-send-display.mp4", "AI에게 보낼 글과 내가 읽을 글을 따로", "내 화면에는 입력한 원문·보낸 번역문·한국어로 다시 번역한 글 중에서 골라 보여줘요. 다시 번역은 추가 요청이 발생해요. 영상은 표시 방식 설정 시연입니다.", "500-llm-send-display.jpg"],
    [
      "498-llm-location.mp4",
      "LLM 번역 · 표시 위치 선택",
      "추가된 내장 설정에서 확장 탭 표시를 켜고 꺼요. 숨긴 상태에서도 세부 설정을 열 수 있어요.",
      "498-llm-location.jpg"
    ],
    [
      "498-llm-settings.mp4",
      "LLM 번역 · 쓰던 설정을 한곳에서",
      "블루레몬에이드 스타일의 번역·모델·프롬프트·데이터 탭. 기존 연결·용어집·기록을 이어 쓰는 구성이에요.",
      "498-llm-settings.jpg"
    ],
    [
      "500-panel-mobile.mp4",
      "한글화 패널 · 바로 펼쳐 쓰기",
      "체크·이름·상태를 한 줄로 모았어요. 자료 선택과 불러오기도 한 줄로, 복사·내보내기·번역 기록은 더보기에서 열어요.",
      "500-panel-mobile.jpg"
    ],
    [
      "500-panel-guide.mp4",
      "한글화 패널 · 설명은 필요할 만큼",
      "버전 버튼에 자세한 사용방법을 모았어요. 익숙해지면 작업 화면의 보조 설명을 숨길 수 있어요.",
      "500-panel-guide.jpg"
    ],
    [
      "500-panel-parameters.mp4",
      "한글화 패널 · 파라미터를 두 줄로",
      "4개 설정을 2열 × 2줄로 배치했어요. 숫자를 입력하면 슬라이더도 함께 바뀌고, 기본값으로 돌릴 수 있어요.",
      "500-panel-parameters.jpg"
    ],
    [
      "500-regex-phone.mp4",
      "정규식 · 이름만 한글로",
      "추가된 정규식 탭에서 번역 이름을 표시하거나 원문으로 되돌려요. 검색식·치환식·저장된 원본 이름은 그대로예요. 시연용 응답으로 준비한 번역 예제입니다.",
      "500-regex-phone.jpg"
    ],
    [
      "498-menu-order.mp4",
      "요술봉과 채팅 메뉴도 순서 변경",
      "확장 설정뿐 아니라 요술봉·가로줄 세 개 메뉴의 항목도 위아래로 옮겨요.",
      "498-menu-order.jpg"
    ],
    [
      "500-modes.mp4",
      "테마만 · 확장만 · 함께",
      "테마 → 기타 설정에서 현재 모드 한 줄을 펼쳐 선택해요. 실제 적용은 「저장하고 새로고침」을 누르며 기존 설정은 보관돼요.",
      "500-modes.jpg"
    ]
  ]
},
  {
    "id": "color",
    "label": "색",
    "title": "색상과 그라데이션",
    "sub": "최대 3색 혼합 · 색 비중 · 번짐 조절 · 팔레트 저장",
    "cards": [
      [
        "calm-mix-setting.mp4",
        "에이드 섞기",
        "1~3색을 선택한 순서대로 혼합해요.",
        "calm-mix-setting.jpg"
      ],
      [
        "472-colors.mp4",
        "색 하나하나",
        "바탕부터 글자까지 따로 고쳐요.",
        "472-colors.jpg"
      ],
      [
        "472-styles.mp4",
        "스타일 일괄 적용",
        "소설책 · 메신저 · 또렷하게.",
        "472-styles.jpg"
      ],
      [
        "471-palette-library.mp4",
        "팔레트 저장",
        "라이트와 나이트를 한 쌍으로.",
        "471-palette-library.jpg"
      ],
      [
        "471-auto.mp4",
        "낮과 밤에 맞춰서",
        "기기 테마나 정해 둔 시간을 따라가요.",
        "471-auto.jpg"
      ]
    ],
    "pc": [
      [
        "calm-pc-mix-setting.mp4",
        "섞고, 바로 보고",
        "미리보기와 설정을 나란히.",
        "calm-pc-mix-setting.jpg"
      ],
      [
        "472-pc-colors.mp4",
        "색 하나하나",
        "",
        "472-pc-colors.jpg"
      ],
      [
        "472-pc-styles.mp4",
        "완성된 스타일",
        "",
        "472-pc-styles.jpg"
      ]
    ]
  },
  {
    "id": "text",
    "label": "대사",
    "title": "글꼴과 대사 표시",
    "sub": "형광펜 · 글꼴 · 여백 · 움직이는 대사.",
    "cards": [
      [
        "471-marker-setting.mp4",
        "형광펜의 모양과 굵기",
        "펜 자국 · 직사각형 · 알약.",
        "471-marker-setting.jpg"
      ],
      [
        "472-fx-setting.mp4",
        "대사 애니메이션",
        "움직임 · 빛 · 색 흐름을 골라요.",
        "472-fx-setting.jpg"
      ],
      [
        "471-text-gradient-setting.mp4",
        "글자에도 그라데이션",
        "이름과 대사를 서로 다른 색으로.",
        "471-text-gradient-setting.jpg"
      ],
      [
        "471-fonts.mp4",
        "언어마다 다른 글꼴",
        "",
        "471-fonts.jpg"
      ],
      [
        "471-para.mp4",
        "문단과 여백",
        "",
        "471-para.jpg"
      ],
      [
        "472-outline-setting.mp4",
        "글자 그림자 · 외곽선",
        "",
        "472-outline-setting.jpg"
      ]
    ],
    "pc": [
      [
        "471-pc-marker-setting.mp4",
        "형광펜 조절",
        "",
        "471-pc-marker-setting.jpg"
      ],
      [
        "472-pc-fx-setting.mp4",
        "움직임의 크기까지",
        "",
        "472-pc-fx-setting.jpg"
      ],
      [
        "471-pc-fonts.mp4",
        "글꼴과 줄 간격",
        "",
        "471-pc-fonts.jpg"
      ]
    ]
  },
  {
    "id": "profile",
    "label": "사진",
    "title": "프로필 크기와 이미지 배치",
    "sub": "큰 프로필 · 작은 프로필 · 대화만. 액자와 배치도 따로.",
    "cards": [
      [
        "472-profile-setting.mp4",
        "프로필 표시 방식",
        "없음 · 작게 · 상단 크게.",
        "472-profile-setting.jpg"
      ],
      [
        "472-my-profile.mp4",
        "내 프로필은 따로",
        "",
        "472-my-profile.jpg"
      ],
      [
        "472-name-time.mp4",
        "이름 색상과 글꼴",
        "단색부터 그라데이션, 글꼴까지.",
        "472-name-time.jpg"
      ],
      [
        "472-image-layout.mp4",
        "채팅 속 그림 배치",
        "",
        "472-image-layout.jpg"
      ],
      [
        "472-image-frame.mp4",
        "둥글기와 테두리",
        "",
        "472-image-frame.jpg"
      ]
    ],
    "pc": [
      ["calm-profile-large.mp4", "큰 프로필", "PC에서 상단 사진을 크게.", "calm-profile-large.jpg"],
      ["calm-profile-small.mp4", "작은 프로필", "메시지 옆에 작은 프로필을 표시해요.", "calm-profile-small.jpg"],
      ["calm-profile-none.mp4", "대화만", "사진 없이 문장에 집중해요.", "calm-profile-none.jpg"],
      [
        "472-pc-profile-setting.mp4",
        "프로필의 크기와 배치",
        "",
        "472-pc-profile-setting.jpg"
      ],
      [
        "472-pc-my-profile.mp4",
        "내 사진도 따로",
        "",
        "472-pc-my-profile.jpg"
      ],
      [
        "472-pc-image-frame.mp4",
        "이미지 테두리와 모서리",
        "",
        "472-pc-image-frame.jpg"
      ],
      [
        "476-frame-presets.mp4",
        "액자 프리셋 6종",
        "수채화 · 가는 리본 · 겹친 종이.",
        "476-frame-presets.jpg"
      ]
    ]
  },
  {
    "id": "weather",
    "label": "날씨",
    "title": "날씨 효과",
    "sub": "비 · 눈 · 안개 · 은하수 · 유성 · 꽃잎의 속도와 양을 조절해요.",
    "cards": [
      [
        "rain-phone-v2.mp4",
        "가는 비",
        "라이트 테마의 날씨 효과 예시예요.",
        "rain-phone-v2.jpg"
      ],
      [
        "snow-phone-v2.mp4",
        "작은 눈",
        "눈송이의 크기와 속도를 조절해요.",
        "snow-phone-v2.jpg"
      ],
      [
        "mist-phone-long.mp4",
        "옅은 안개",
        "옅게 흐르는 안개.",
        "mist-phone-long.jpg"
      ],
      ["stars-phone-v2.mp4", "은하수", "별 입자가 움직이는 배경 효과.", "stars-phone-v2.jpg"],
      ["meteor-phone-v2.mp4", "유성", "유성이 화면을 가로지르는 효과.", "meteor-phone-v2.jpg"],
      [
        "petals-phone-long.mp4",
        "작은 색 조각",
        "꽃잎 입자의 양과 속도를 조절해요.",
        "petals-phone-long.jpg"
      ],
      [
        "475-weather-amount.mp4",
        "원하는 만큼만",
        "비·눈의 양을 숫자로, 원하는 만큼.",
        "475-weather-amount.jpg"
      ]
    ],
    "pc": [
      [
        "rain-pc-v2.mp4",
        "가는 비",
        "",
        "rain-pc-v2.jpg"
      ],
      [
        "snow-pc-v2.mp4",
        "작은 눈",
        "",
        "snow-pc-v2.jpg"
      ],
      ["stars-pc-v2.mp4", "은하수", "별 입자가 움직이는 배경 효과.", "stars-pc-v2.jpg"],
      ["meteor-pc-v2.mp4", "유성", "유성이 화면을 가로지르는 효과.", "meteor-pc-v2.jpg"]
    ]
  },
  {
    "id": "capture",
    "label": "캡처",
    "title": "채팅 이미지·영상 저장",
    "sub": "미리 보고, 문단을 고르고, 이미지나 영상으로.",
    "cards": [
      [
        "471-capture-quick.mp4",
        "먼저 미리보기",
        "",
        "471-capture-quick.jpg"
      ],
      [
        "471-capture-editor.mp4",
        "남길 문단만 고르기",
        "캡처용 사본만 바꿔요.",
        "471-capture-editor.jpg"
      ],
      [
        "471-capture-format.mp4",
        "이미지 · 영상 · 움짤",
        "PNG · MP4/WebM · GIF · APNG · WebP.",
        "471-capture-format.jpg"
      ],
      [
        "471-capture-info.mp4",
        "본문만, 또는 정보까지",
        "",
        "471-capture-info.jpg"
      ],
      [
        "471-capture-privacy.mp4",
        "공유할 때는 이름 가리고",
        "",
        "471-capture-privacy.jpg"
      ]
    ],
    "pc": [
      [
        "471-pc-capture-quick.mp4",
        "미리보기와 설정을 한 화면에",
        "",
        "471-pc-capture-quick.jpg"
      ],
      [
        "471-pc-capture-editor.mp4",
        "문단별로 가볍게 편집",
        "",
        "471-pc-capture-editor.jpg"
      ],
      [
        "471-pc-capture-format.mp4",
        "저장 형식 고르기",
        "",
        "471-pc-capture-format.jpg"
      ],
      [
        "471-pc-capture-info.mp4",
        "담을 정보 고르기",
        "",
        "471-pc-capture-info.jpg"
      ]
    ]
  },
  {
    "id": "tools",
    "label": "도구",
    "title": "내장 확장 도구",
    "sub": "스크립트부터 모델 전환까지 테마 안에서.",
    "cards": [
      [
        "472-words.mp4",
        "단어 치환",
        "",
        "472-words.jpg"
      ],
      [
        "472-modelswitch.mp4",
        "모델을 한 번에 바꾸기",
        "",
        "472-modelswitch.jpg"
      ],
      [
        "472-models.mp4",
        "목록에 없는 모델 등록",
        "",
        "472-models.jpg"
      ],
      [
        "472-perf.mp4",
        "성능 보조",
        "",
        "472-perf.jpg"
      ],
      [
        "472-regexlink.mp4",
        "프롬프트와 정규식을 함께",
        "",
        "472-regexlink.jpg"
      ],
      [
        "472-order.mp4",
        "확장 순서 정리",
        "",
        "472-order.jpg"
      ]
    ],
    "pc": [
      [
        "472-pc-modelswitch.mp4",
        "여러 확장의 모델을 한 번에",
        "",
        "472-pc-modelswitch.jpg"
      ],
      [
        "472-pc-models.mp4",
        "모델 등록",
        "",
        "472-pc-models.jpg"
      ],
      [
        "472-pc-regexlink.mp4",
        "프롬프트 연동 정규식",
        "",
        "472-pc-regexlink.jpg"
      ]
    ]
  },
  {
    "id": "rewrite",
    "label": "다시 쓰기",
    "title": "금지 표현 감지와 다시 쓰기",
    "sub": "금지 묘사 · 규칙 만들기 · 예외 · 테스트.",
    "cards": [
      [
        "471-rw-rules.mp4",
        "금지 묘사 규칙",
        "",
        "471-rw-rules.jpg"
      ],
      [
        "471-rw-ai.mp4",
        "AI에게 부탁해서 규칙 만들기",
        "",
        "471-rw-ai.jpg"
      ],
      [
        "471-rw-exceptions.mp4",
        "캐릭터별 예외",
        "",
        "471-rw-exceptions.jpg"
      ],
      [
        "471-rw-test.mp4",
        "걸리는 표현 미리 확인하기",
        "",
        "471-rw-test.jpg"
      ],
      [
        "471-rw-connect.mp4",
        "사용할 모델 고르기",
        "",
        "471-rw-connect.jpg"
      ]
    ],
    "pc": [
      [
        "471-pc-rw-rules.mp4",
        "규칙 하나씩 살펴보기",
        "",
        "471-pc-rw-rules.jpg"
      ],
      [
        "471-pc-rw-ai.mp4",
        "규칙 만들기도 편하게",
        "",
        "471-pc-rw-ai.jpg"
      ]
    ],
    "guide": true
  },
  {
    "id": "read",
    "label": "읽기",
    "title": "북마크와 빠른 조작",
    "sub": "북마크 · 빠른 버튼 · 프롬프트 카드 · 한 손 조작.",
    "cards": [
      [
        "472-bookmark-setting.mp4",
        "메시지 북마크",
        "",
        "472-bookmark-setting.jpg"
      ],
      [
        "472-pins-setting.mp4",
        "자주 쓰는 버튼은 가까이",
        "",
        "472-pins-setting.jpg"
      ],
      [
        "472-prompt-tab.mp4",
        "프롬프트 카드 테마 적용",
        "",
        "472-prompt-tab.jpg"
      ],
      [
        "472-qr-setting.mp4",
        "퀵 리플라이 자리와 모양",
        "",
        "472-qr-setting.jpg"
      ]
    ],
    "pc": [
      [
        "472-pc-qr-setting.mp4",
        "빠른 답장 설정",
        "",
        "472-pc-qr-setting.jpg"
      ]
    ]
  },
  {
    "id": "settings",
    "label": "설정",
    "title": "설정 검색과 백업",
    "sub": "검색하고, 되돌리고, 내 설정을 보관해요.",
    "cards": [
      [
        "472-changes.mp4",
        "바꾼 것만 모아서",
        "",
        "472-changes.jpg"
      ],
      [
        "471-favorites.mp4",
        "설정 즐겨찾기",
        "",
        "471-favorites.jpg"
      ],
      [
        "472-backup.mp4",
        "필요한 프리셋만 공유",
        "형광펜 · 날씨 · 글꼴을 골라 담고, 필요한 것만 불러와요.",
        "472-backup.jpg"
      ],
      [
        "472-css-setting.mp4",
        "다른 CSS와 함께 쓸 때",
        "",
        "472-css-setting.jpg"
      ]
    ],
    "pc": [
      [
        "472-pc-backup.mp4",
        "필요한 프리셋만 공유",
        "형광펜 · 날씨 · 글꼴을 골라 담고, 필요한 것만 불러와요.",
        "472-pc-backup.jpg"
      ]
    ]
  }
];
const $ = s => document.querySelector(s);
function element(tag, cls, text) { const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e; }
// media cache keys: one stable key for everything; a file retaken under the same name gets its own entry here (never bump the stable key)
const modeMedia=new Set(["rain-phone-v2", "snow-phone-v2", "mist-phone-long", "stars-phone-v2", "meteor-phone-v2", "petals-phone-long", "rain-pc-v2", "snow-pc-v2", "stars-pc-v2", "meteor-pc-v2", "clear-phone-long", "daynight-pc-clear"]);
function setMediaMode(video){
 const mode=document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
 const file=video.dataset.modeBase+'-'+mode;video.dataset.src='media/'+file+'.mp4'+mv(file+'.mp4');video.poster='media/'+file+'.jpg'+mv(file+'.jpg');
}
document.addEventListener('bl-theme',()=>{for(const video of document.querySelectorAll('video[data-mode-base]')){
 const playing=!video.paused;video.pause();video.removeAttribute('src');setMediaMode(video);video.load();
 if(video.controls)video.src=video.dataset.src;
 if(playing&&!document.hidden){video.src=video.dataset.src;video.play().catch(()=>{});}
}});
// 532light: 새 기능 18개를 5.3.2 라이트(블루 레몬에이드 · 화이트)로 다시 찍음 — 같은 파일 이름
const RETAKEN={"532-notes-write.mp4":"533light","532-notes-write.jpg":"533light","532-notes-arrange.mp4":"533light","532-notes-arrange.jpg":"533light","524-direction.mp4":"533light","524-direction.jpg":"533light","524-ade-presets.mp4":"533light","524-ade-presets.jpg":"533light","524-ade-toggle.mp4":"533light","524-ade-toggle.jpg":"533light","500-llm-glossary-world.mp4":"532light","500-llm-glossary-world.jpg":"532light","500-llm-glossary-chat.mp4":"532light","500-llm-glossary-chat.jpg":"532light","500-llm-send-context.mp4":"532light","500-llm-send-context.jpg":"532light","500-llm-split-language.mp4":"532light","500-llm-split-language.jpg":"532light","500-llm-send-display.mp4":"532light","500-llm-send-display.jpg":"532light","498-llm-location.mp4":"532light","498-llm-location.jpg":"532light","498-llm-settings.mp4":"532light","498-llm-settings.jpg":"532light","500-panel-mobile.mp4":"532light","500-panel-mobile.jpg":"532light","500-panel-guide.mp4":"532light","500-panel-guide.jpg":"532light","500-panel-parameters.mp4":"532light","500-panel-parameters.jpg":"532light","500-regex-phone.mp4":"532light","500-regex-phone.jpg":"532light","498-menu-order.mp4":"532light","498-menu-order.jpg":"532light","500-modes.mp4":"532light","500-modes.jpg":"532light"};
const mv=file=>'?v='+(RETAKEN[file]||'s1')+'-ade-488';

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
      const video=element('video');video.preload='none';video.playsInline=true;video.muted=true;video.loop=true;video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-label',title);
      // 라이트/다크 파일은 모드 이름을 먼저 정해서 한 번만 지정 — 기본 파일 이름(없음)을 먼저 요청하지 않도록
      const base=file.replace('.mp4','');if(modeMedia.has(base)){video.dataset.modeBase=base;setMediaMode(video);}else{video.dataset.src='media/'+file+mv(file);video.poster='media/'+poster+mv(poster);}
      if(reduceMotion.matches){video.controls=true;video.src=video.dataset.src;}
      else{const state=element('span','play-state','▶');state.setAttribute('aria-hidden','true');wrap.classList.add('paused');
        video.addEventListener('play',()=>wrap.classList.remove('paused'));video.addEventListener('pause',()=>wrap.classList.add('paused'));
        const toggle=()=>{if(!video.src&&video.dataset.src)video.src=video.dataset.src;if(video.paused){delete video.dataset.userPaused;video.play().catch(()=>{});}else{video.dataset.userPaused='1';video.pause();}};
        video.tabIndex=0;video.setAttribute('role','button');video.setAttribute('aria-label',title+' 재생 또는 일시정지');
        video.addEventListener('click',toggle);video.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
        wrap.append(state);inView.observe(video);}
      wrap.prepend(video);
      const enlarge=element('button','gallery-expand','크게 보기 ↗');enlarge.type='button';enlarge.setAttribute('aria-label',title+' 크게 보기');
      enlarge.onclick=()=>{const dialog=$('#atmosphere-lightbox'), player=dialog.querySelector('video');if(video.dataset.modeBase)player.dataset.modeBase=video.dataset.modeBase;else delete player.dataset.modeBase;player.poster=video.poster;player.src=video.getAttribute('src')||video.dataset.src;player.setAttribute('aria-label',title);dialog.showModal();player.play().catch(()=>{});};wrap.append(enlarge);
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
  if(location.hash==='#portraits')first='profile';
  show(first);
  if(location.hash==='#portraits')document.querySelector('#gallery').scrollIntoView();
}
{const big=lightbox.querySelector('img');big.addEventListener('load',()=>{lightbox.classList.toggle('tall',big.naturalHeight>big.naturalWidth*1.9);lightbox.scrollTop=0;});}
lightbox.querySelector('.close').onclick=()=>lightbox.close();lightbox.onclick=e=>{if(e.target===lightbox)lightbox.close();};lightbox.addEventListener('close',()=>{lightbox.querySelector('img').src='';});
{const dialog=$('#atmosphere-lightbox'), video=dialog.querySelector('video');
 dialog.querySelector('button').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 dialog.addEventListener('close',()=>{video.pause();video.removeAttribute('src');delete video.dataset.modeBase;video.load();});}
const SHOWN_NOTES=3;
fetch('release-notes.json?v=535', {cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('notes');return r.json();}).then(notes=>{$('#notes').replaceChildren();
  // one card per day, like the theme's own notice: a busy day reads as "v4.1.2 ~ v4.2.4 · 업데이트 13번"
  const days=[];for(const note of notes){const last=days.at(-1);if(last&&last.date===note.date)last.notes.push(note);else days.push({date:note.date,notes:[note]});}
  days.forEach((day,i)=>{const d=element('details','note');d.open=i===0;d.hidden=i>=SHOWN_NOTES;const s=element('summary'),first=day.notes.at(-1).version,latest=day.notes[0].version;
    s.append(element('span','num',latest));if(i===0)s.append(element('span','tag','새 소식'));
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

// Homepage stays light; palette preview brightness is independent.

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
    document.querySelectorAll('.track').forEach(t => t.dispatchEvent(new Event('scroll'))); document.dispatchEvent(new CustomEvent('bl-device',{detail:device})); };
  set(html.classList.contains('device-pc') ? 'pc' : 'mobile');
  pick.addEventListener('click', e => { const b = e.target.closest('button[data-device]'); if (!b) return; set(b.dataset.device); try { localStorage.setItem('bl-site-device', b.dataset.device); } catch {} });
})();
