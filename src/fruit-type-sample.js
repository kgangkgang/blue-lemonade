// 8.0.6 대화에 그 종류의 상태창이 없을 때 보여 줄 표본 상태창이에요.
//   표본 글은 원작 프롬프트가 정한 출력 꼴을 따른 지어낸 문장이에요. 캐릭터 · 페르소나 · 대화는 읽지 않아요.
//   모양은 사용자가 설치한 프리셋의 원작 정규식으로 그 표본 글을 바꿔서 만들어요(실리태번이 메시지에 하는 것과 같은 치환).
//   과일 계열처럼 정규식 결과가 스크립트로 그려지는 문서면, 네트워크 · 부모 창 · 저장소가 막힌 격리 iframe 에서 한 번 그려 본 결과만 가져와요.
//   원작 정규식을 못 찾거나 그리지 못하면 테마에 들어 있는 기본 표본(fruit-type-preview.js)을 써요.
import {FRUIT_TYPES,typeMatch} from './fruit-type-schema.js';
import {fruitTypePreview,FRUIT_PREVIEW_BASE,DEUS_PREVIEW_CSS} from './fruit-type-preview.js';
import {wrapCss} from './fruit-type-runtime.js';

// 8.1.0 데우스 표본은 원작 판(2.5 · V3)을 골라 봐요(설정 chat.demPreviewVersion, 기본 V3 — 8.0.9 스킨이 V3 기준). 지어낸 글만 써요(인물 A · 인물 B · 가상력).
export const DEUS_VERSIONS=[['v3','V3'],['2.5','2.5']];
export const tidyDemVersion=v=>v==='2.5'?'2.5':'v3';
// 트래커는 낮(해) · 밤(16일 = 보름달) 두 개를 한 표본에 — 해 · 달 · 하늘 띠가 둘 다 보이게
export const DEUS_TRACKERS=['<tracker>🕒 3:20 PM | 가상력 12년 5월 3일 목요일 | 오래된 도서관 → 열람실 → 동쪽 창가 | ☀️ 맑음, 22°C</tracker>','<tracker>🌙 9:40 PM | 가상력 12년 5월 16일 토요일 | 오래된 도서관 → 정원 → 달빛 아래 벤치 | 🌙 맑은 밤, 14°C</tracker>'];
// V3 는 상태 · 관계 · 떡밥 · 심리 · 줄거리 · 모멘텀 · 갈등이 한 묶음(.dem-modules)으로 그려져요 — 어느 종류를 골라도 묶음 전체가 표본이에요(실제 채팅과 같게)
export const DEUS_V3_MODULES='<status>\n<summary>Status\n- 나 | Physical: 조금 피곤함, 손끝이 차가움 | Clothes: 파란 겉옷 · 회색 바지 | Mental: 차분함 | Location: 오래된 도서관 동쪽 창가 | Relationship: see Relationships | Inventory: 낡은 편지 · 도서관 열쇠\n- 인물 A | Physical: 건강함, 손끝에 잉크 자국 | Clothes: 회색 목도리 · 긴 코트 | Mental: 편지의 주인이 궁금함 | Location: 열람실 서가 사이 | Relationship: see Relationships | Inventory: 서가 목록 · 만년필\n</summary>\n<details>\n- 인물 B (Off-scene) | Physical: 비에 젖음 | Clothes: 노란 비옷 | Mental: 기다리는 중 | Location: 도서관 정원 벤치 | Relationship: see Relationships | Inventory: 우산 · 젖은 쪽지\n</details>\n</status>\n<relationships>\n<summary>Relationships</summary>\n<details>\n- 인물 A | Closeness: 62/100 (was 58) | Stage: Interested | Unspoken: 편지 글씨가 낯익다는 말을 아직 못 꺼냄 | Obstacle: 문 닫을 시간과 사서의 규칙\n- 인물 B | Closeness: 45/100 (was 50) | Stage: Strangers | Unspoken: 정원에서 본 것을 숨기고 있음 | Obstacle: 비와 서로 다른 약속 시간\n</details>\n</relationships>\n<threads>\n<summary>Story Threads</summary>\n<details>\n- [Current] 도서관 문을 닫기 전에 편지 주인의 단서를 찾아야 해요\n- [Unresolved] 편지의 주인은 아직 나타나지 않았어요\n- [Possible] 인물 B가 정원에서 새 단서를 들고 올지도 몰라요\n- [Seed] 서가 맨 위 칸에 같은 글씨의 책이 꽂혀 있어요\n</details>\n</threads>\n<psych>\n<summary>Psychological States</summary>\n<details>\n- 인물 A | Trait: 호기심이 많고 서두르는 편 | Loop: 단서를 찾음 → 들뜸 → 서두름 → 놓침 | Now: 편지를 다시 읽는다 → 서가로 간다\n- 인물 B | Trait: 말이 적고 관찰이 빠름 | Loop: 지켜봄 → 망설임 → 물러섬 → 후회 | Now: 벤치에서 기다린다 → 문 앞으로 온다\n</details>\n</psych>\n<plotlines>\n<summary>Plotlines</summary>\n<details>\nMain Plot: 낡은 편지 발견 → 편지 주인 찾기 → 서가 맨 위 칸의 비밀\nSubplots:\n- 도서관 정원의 오래된 벤치 고치기\n- 사서가 지키는 폐관 규칙의 유래\n- 인물 B가 숨기는 젖은 쪽지\n</details>\n</plotlines>\n<momentum>\n<summary>Momentum Engine</summary>\n<details>\nCurrent scene: 해 질 녘 도서관에서 낡은 편지의 주인을 찾는 중이에요.\n\nPotential developments:\nA. **새 단서**: 서가 사이에서 같은 글씨의 쪽지가 나와요.\nB. **늦은 손님**: 인물 B가 젖은 우산을 들고 들어와요.\nC. **잠깐의 정전**: 불이 꺼지고 창밖 노을만 남아요.\nD. **조용한 쉼**: 둘이 창가에서 차를 나눠 마셔요.\n<momentum_route primary="A" fallback="B"></momentum_route>\n</details>\n</momentum>\n<conflict>\n<summary>Conflict</summary>\n<details>\n- 문 닫을 시간이 다가오는데 편지의 주인은 아직 몰라요.\n- 인물 A는 서두르고 싶지만 사서는 규칙을 지키라고 해요.\n- 인물 B는 정원에서 본 것을 말할지 망설여요.\n</details>\n</conflict>\n<meanwhile>\n<summary>Meanwhile</summary>\n<details>\n- [Offscreen] 사서: 정원 쪽 문을 잠그러 복도를 걸어가요.\n- [World] 소나기: 도서관 지붕 위로 빗소리가 커져요.\n</details>\n</meanwhile>\n<truths>\n<summary>Hidden Truths</summary>\n<details>\n- [Secret] 편지의 주인: 편지는 사서가 오래전에 쓴 것이에요 | Knows: 사서 | Suspects: 인물 B | Misled: 인물 A\n</details>\n</truths>\n<undercurrents>\n<summary>Undercurrents</summary>\n<details>\nExternal: 문 닫을 시간이 가까워져요.\n- 인물 A | Want: 편지의 주인 찾기 | Pressure: 남은 시간\n- 인물 B | Want: 젖은 쪽지 전하기 | Pressure: 말을 꺼내기 어려움\n- [Subtle] 사서: 서가 열쇠를 슬쩍 주머니에 넣어요\n</details>\n</undercurrents>\n<scratchpad>\n<summary>Scratchpad</summary>\n<details>\n- 편지 글씨와 서가 목록의 글씨를 견주어 봐요.\n- 정원 벤치의 젖은 쪽지를 다음 장면에 꺼내요.\n</details>\n</scratchpad>';
// 묶음 밖 카드 표본 — 지어낸 글(세라피나 · 숲 오두막)만. 원작 정규식이 바꿀 수 있는 꼴만 따라요.
export const DEUS_SCENE_PLAN='<scene_plan>\n<summary>Scene Plan</summary>\n<details>\nContext: 숲 오두막, 세라피나가 다친 손님을 돌보는 저녁\nConstraints: 세라피나는 손님의 이름을 아직 몰라요\nNarrative Style: 따뜻하고 조용하게, 짧은 문장\nProse Plan: 약초 차를 건네며 숲의 소리를 들려줘요\n</details>\n</scene_plan>';
export const DEUS_CYOA='<cyoa>\n1. [행동] **약초 바구니 들기**: 세라피나와 함께 숲 가장자리로 나가요.\n2. [대화] **지도 묻기**: 오두막 벽의 낡은 지도에 대해 물어요.\n3. [관찰] **창밖 보기**: 안개 속에서 움직이는 그림자를 살펴요.\n4. [휴식] **차 한 잔**: 난롯가에서 잠깐 쉬어요.\n5. [자유] **직접 쓰기**: 하고 싶은 행동을 적어요.\n</cyoa>';
export const DEUS_COMPANIONS='<companions>\n<summary>Companions</summary>\n<details>\n**루미:** 세라피나가 약초를 고르는 장면이 좋아요.\n**토토:** 다음엔 숲 지도가 꼭 나올 것 같아요.\n</details>\n</companions>';
export const DEUS_OOC='<ooc>\n이번 장면은 세라피나의 오두막에서 쉬어 가요. 다음 장면에서 숲길 지도를 펼쳐 볼게요.\n</ooc>';
export const DEUS_THINKING='Context: 숲 오두막의 저녁, 세라피나가 약초 차를 끓여요\nConstraints: 손님은 아직 이름을 말하지 않았어요\nNarrative Style: 따뜻하고 조용하게\nProse Plan: 난롯불 소리와 함께 짧은 대화를 이어 가요\n<prose>\n세라피나가 찻잔을 내밀었다.\n</prose>';
export const DEUS_NOTICES=['<dem_missed>Tracker</dem_missed>\n<dem_missed>Status</dem_missed>\n','<dem_uncolored></dem_uncolored>\n'];
// 2.5 는 카드마다 따로(묶음 없음) — 상태창은 요약 인물 2명 + 접힌 Off-scene 1명, 다른 카드도 항목 2~3개씩
export const SAMPLE_INPUTS_25={
    'deus-tracker':DEUS_TRACKERS,
    'deus-status':['<status>\n<summary>Status\n- 나 | Physical: 조금 피곤함, 손끝이 차가움 | Clothes: 파란 겉옷 · 회색 바지 | Mental: 차분함 | Location: 오래된 도서관 동쪽 창가 | Inventory: 낡은 편지 · 도서관 열쇠\n- 인물 A | Physical: 건강함, 손끝에 잉크 자국 | Clothes: 회색 목도리 · 긴 코트 | Mental: 편지의 주인이 궁금함 | Location: 열람실 서가 사이 | Relationship (mutual with 나): 62/100 - 인물 A is 나\'s 오랜 친구 | Inventory: 서가 목록 · 만년필\n</summary>\n<details>\n- 인물 B (Off-scene) | Physical: 비에 젖음 | Clothes: 노란 비옷 | Mental: 기다리는 중 | Location: 도서관 정원 벤치 | Relationship (mutual with 나): 45/100 - 인물 B is 나\'s 이웃 | Inventory: 우산 · 젖은 쪽지\n</details>\n</status>'],
    'deus-threads':['<threads>\n<summary>Story Threads</summary>\n<details>\n  - [Current] 도서관 문을 닫기 전에 편지 주인의 단서를 찾아야 해요\n  - [Unresolved] 편지의 주인은 아직 나타나지 않았어요\n  - [Possible] 인물 B가 정원에서 새 단서를 들고 올지도 몰라요\n  - [Seed] 서가 맨 위 칸에 같은 글씨의 책이 꽂혀 있어요\n</details>\n</threads>'],
    'deus-psych':['<psych>\n<summary>Psychological States</summary>\n<details>\n- 인물 A | Inner-state: 편지 글씨가 낯익어 마음이 들떠 있음 | Motivations: 문을 닫기 전에 주인을 찾고 싶어 서가를 살핌\n- 인물 B | Inner-state: 비 오는 정원에서 조용히 생각에 잠김 | Motivations: 약속한 시간까지 기다리기로 함\n</details>\n</psych>'],
    'deus-plot':['<plotlines>\n<summary>Plotlines</summary>\n<details>\nMain Plot: 낡은 편지 발견 → 편지 주인 찾기 → 서가 맨 위 칸의 비밀\nSubplots:\n- 도서관 정원의 오래된 벤치 고치기\n- 사서가 지키는 폐관 규칙의 유래\n- 인물 B가 숨기는 젖은 쪽지\n</details>\n</plotlines>'],
    'deus-momentum':['<momentum>\n<summary>Momentum Engine</summary>\n<details>\nCurrent scene: 해 질 녘 도서관에서 낡은 편지의 주인을 찾는 중이에요.\n\nPotential developments:\nA. **새 단서**: 서가 사이에서 같은 글씨의 쪽지가 나와요.\nB. **늦은 손님**: 인물 B가 젖은 우산을 들고 들어와요.\nC. **잠깐의 정전**: 불이 꺼지고 창밖 노을만 남아요.\nD. **조용한 쉼**: 둘이 창가에서 차를 나눠 마셔요.\n<momentum_route primary="A" fallback="B"></momentum_route>\n</details>\n</momentum>'],
    'deus-conflict':['<conflict>\n<summary>Conflict</summary>\n<details>\n- 문 닫을 시간이 다가오는데 편지의 주인은 아직 몰라요.\n- 인물 A는 서두르고 싶지만 사서는 규칙을 지키라고 해요.\n- 인물 B는 정원에서 본 것을 말할지 망설여요.\n</details>\n</conflict>'],
};
export const SAMPLE_INPUTS={
    'deus-tracker':DEUS_TRACKERS,
    'deus-status':[DEUS_V3_MODULES],
    'deus-threads':[DEUS_V3_MODULES],
    'deus-psych':[DEUS_V3_MODULES],
    'deus-plot':[DEUS_V3_MODULES],
    'deus-momentum':[DEUS_V3_MODULES],
    'deus-conflict':[DEUS_V3_MODULES],
    'deus-relationships':[DEUS_V3_MODULES],
    'deus-meanwhile':[DEUS_V3_MODULES],
    'deus-truths':[DEUS_V3_MODULES],
    'deus-undercurrents':[DEUS_V3_MODULES],
    'deus-scratchpad':[DEUS_V3_MODULES],
    'deus-modules':[DEUS_V3_MODULES],
    'deus-scene-plan':[DEUS_SCENE_PLAN],
    'deus-cyoa':[DEUS_CYOA],
    'deus-companions':[DEUS_COMPANIONS],
    'deus-phi-note':[DEUS_OOC],
    'deus-notice':DEUS_NOTICES,
    'deus-thinking':[DEUS_THINKING],
    'deus-tail':[DEUS_THINKING],
    'fruit-choices':['<branches>\nA. 세라피나에게 숲길 지도를 부탁한다\nB. 난롯가에서 약초 차를 한 잔 더 마신다\nC. 창밖에서 움직이는 그림자를 살핀다\n</branches>'],
    'fruit-theater':['<ccd>\n세라피나가 찻잔을 내려놓았다.\n"차가 식기 전에 마셔요."\n『조금 쑥스럽네.』\n〔딸깍〕\n> 난롯불이 낮게 탄다\n||오늘의 한 줄: 숲은 조용했다\n</ccd>'],
    'fruit-reverie':['<prologue>\n模式：memory\n가상력 12년 봄 · 숲 오두막\n난롯불 옆에서 처음 들은 이야기\n세라피나는 찻잔을 두 손으로 감쌌다.\n</prologue>'],
    'fruit-summary':['<meow_FM>\nserial: 12\ntime: 가상력 12년 5월 3일 저녁\nscene: 숲 오두막\nplot: 세라피나가 다친 손님에게 약초 차를 건넸어요.\nseeds: <li>낡은 숲길 지도</li><li>창밖의 그림자</li>\n</meow_FM>'],
    'sola-tempo':['<tempo>STEADY</tempo>'],
    'sola-feeling':["<fengine>\nGuide:\nIW=2↑ | T=2 | F=3↑ | D=1 | Y=2\nMood: 손님을 향한 경계가 조금 누그러졌어요.\n</fengine>"],
    'sola-bond':["<bond>\nPair: Guide / Traveler\nDynamic: 서로를 조심스럽게 알아가요.\nShift: +작은 신뢰 / -남은 망설임\n</bond>"],
    'sola-cabinet':["<cabinet>\nMask: 침착한 숲지기예요.\nInternal: 손님의 이야기가 궁금해요.\nBoundary: 이름을 먼저 묻지는 않아요.\n</cabinet>"],
    'sola-thought-engine':["<thought_engine char=\"Guide\">\n찻잔을 두 손으로 감싸 쥔 모습을 보고 긴장이 풀렸다는 걸 알아챘어요. 다음에는 숲길 이야기를 꺼내 보려 해요.\n</thought_engine>"],
    'sola-calendar':["<date>\nDay: 가상력 12년 봄의 셋째 날\nTime: 오후 7시 20분\nElapsed: 만난 뒤 두 시간\n</date>"],
    'sola-wardrobe':["<wardrobe>\nLayers: 회색 외투와 얇은 목도리예요.\nCondition: 소매 끝이 빗물에 조금 젖었어요.\nTells: 찻잔을 건네는 손끝이 조금 떨려요.\n</wardrobe>"],
    'sola-inventory':["<inventory>\nIn-Hand: 따뜻한 찻잔을 들고 있어요.\nCarried: 약초 주머니와 낡은 지도가 있어요.\nConcealed: 안주머니에 작은 열쇠를 넣어 뒀어요.\n</inventory>"],
    'sola-cast':["<scene_cast>\nLocation: 숲 오두막의 난롯가예요.\nActive Speakers: 숲지기와 여행자가 있어요.\nAmbient NPCs: 창밖의 새들이 잠들었어요.\nObservable Facts: 젖은 외투에서 물이 조금씩 떨어져요.\n</scene_cast>"],
    'sola-notebook':["<story_notes>\nThreads: 낡은 지도에 표시된 길이 남아 있어요.\nSeeds: 창밖에서 작은 종소리가 들렸어요.\nMotives: 손님이 길을 잃은 이유를 알아보려 해요.\nHorizon: 날이 밝으면 숲길을 함께 살펴봐요.\n</story_notes>"],
    'sola-trait':["<solatag>\nTraits: 신중하고 세심해요.\nVoice: 낮고 차분하게 말해요.\nBoundary: 대답을 재촉하지 않아요.\n</solatag>"],
    'sola-matrix':["<char_matrix>\nGuide\nOrientation: 낯선 손님을 살피고 있어요.\nKnowledge: 오두막 주변 길을 잘 알아요.\nStatus: 차를 마시며 쉬고 있어요.\n</char_matrix>"],
    'sola-heart':["<heart>\nEgo: 손님을 돕기로 했어요.\nNerve: 낯선 소리에 아직 조심스러워요.\nBody: 긴장이 조금 풀렸어요.\nPsyche: 지도의 사연이 궁금해요.\n</heart>"],
    'sola-current':["<current>\nCadence: 천천히 대화를 이어가요.\nFocus: 손님이 꺼낸 지도를 보고 있어요.\nState: Gathering\n</current>"],
    'sola-arrow':["<arrow>\nGamble: 먼저 길을 안내하겠다고 말해요.\nTrajectory: 오두막 밖으로 대화가 이어져요.\nFriction: 비가 아직 그치지 않았어요.\n</arrow>"],
    'sola-ooc':['((OOC: 세라피나 장면은 조금 더 천천히 갈게요.))'],
    'sola-user-ooc':['((OOC: 세라피나의 말투를 부드럽게.))'],
    'sola-easel':['<sola_easel>\n세라피나 장면 점검: 속도 보통\n</sola_easel>'],
    'sola-hud':['<sola_hud>\n<details>\n<summary>숲 오두막 | 저녁</summary>\n</details>\n</sola_hud>'],
    'sola-chatterbox':['<chatterbox>\n<sola_text>세라피나가 찻잔을 내밀었어요!</sola_text>\n<user_text>고마워요.</user_text>\n</chatterbox>'],
    'sola-capsule':['<thought>세라피나는 손님이 이름을 말해 줄지 조용히 기다렸다.</thought>'],
    'sola-micro':['세라피나가 <tell note="손끝이 조금 떨려요.">찻잔</tell>을 건넸어요. <lore entry="숲에서 자라는 향긋한 약초예요.">은잎 풀</lore>과 <translate meaning="어서 와요.">옛 인사말</translate>을 소개했어요.'],
    status:['<status_bar>\n日期：가상력 12년 5월 3일 목요일\n时间：오후 3:20\n天气：맑음 · 산들바람 22℃\n地点：오래된 도서관 · 동쪽 창가\n题记：바람이 책장을 넘기면 이야기는 다시 시작된다.\n之间：반걸음 거리 · 아직 펼치지 않은 우산\n</status_bar>',
        '<status_bar>\n[Info|가상력 12년 5월 3일 목요일|오후 3:20|맑음 · 산들바람 22℃|오래된 도서관 · 동쪽 창가]\n[Quote|바람이 책장을 넘기면 이야기는 다시 시작된다.]\n[Outfit|회색 목도리와 긴 코트|파란 겉옷과 운동화]\n</status_bar>'],
    compact:['◸가상력 12년 5월 3일 · 15:20｜오래된 도서관 · 동쪽 창가<present>맑음 · 호박색 오후 빛｜책장 사이로 오후의 빛이 들어왔다◹'],
    single:['<角色状态面板>\n<日期>May 3, 0012</日期>\n<坐标>오래된 도서관 · 동쪽 창가</坐标>\n<本地时间>15:20</本地时间>\n<位置描述>오후 햇빛이 책장 사이로 들어오는 조용한 열람실</位置描述>\n<上装>파란 겉옷</上装>\n<下装>회색 바지와 운동화</下装>\n<姿势>창가에 기대 편지를 읽는 중</姿势>\n<心情符号>📖</心情符号>\n<心情名称>Calm</心情名称>\n<心情描述>오랜만에 조용한 시간을 보내며 마음이 편안해요</心情描述>\n<搜索历史>\n<搜索记录><内容>오래된 편지 주인 찾는 법</内容><时间>15:02</时间></搜索记录>\n</搜索历史>\n<语录集>\n<语录>다음 이야기는 어디로 이어질까?</语录>\n</语录集>\n<当前播放>Clair de Lune</当前播放>\n</角色状态面板>'],
    novel:['<novel_header>\n[CHAP] 제3장\n[TITLE] 창가의 작은 약속\n[CP] 인물A×인물B\n[LOC] 오래된 도서관\n[TAGS] 일상 / 성장 / 잔잔함\n[PREFACE] 펼치지 않은 편지에도 계절은 먼저 도착한다.\n</novel_header>'],
    prologue:['<prologue>\n오늘의 이야기는 아직 쓰이지 않은 한 페이지.\n<hr>\n\n— 가상의 책 「창가의 오후」\n</prologue>'],
    'qingguo-forum':['<live_forum>\n[Header|파란 겉옷에 회색 목도리를 두른 차림]\n[Comment|Stardust_77|오늘 방송 배경 음악이 좋네요.]\n[Comment|_void_|창가 자리 분위기가 최고예요.]\n[Reply_to|1|CyberNomad|저도 그 노래를 찾고 있었어요.]\n[Comment|Error404|다음 방송은 언제예요?]\n</live_forum>'],
    'qingguo-board':['<rumor_forum>\n[楼主|도서관지기|오늘 도서관 창가 자리 후기|오후 햇빛이 좋아서 책 읽기 딱 좋았어요.]\n[评论|책벌레|저도 거기 자주 가요.]\n[评论|산책러|창가 자리는 늘 인기가 많죠.]\n[评论|고양이손|回复@책벌레: 다음에 같이 가요.]\n</rumor_forum>'],
    'qingguo-mailbox':['<harass_mailbox>\n[SMS|내일이 도서관 반납일이에요.]\n[SMS|주문하신 책이 도착했어요.]\n[SMS|이번 주 독서 모임은 목요일이에요.]\n</harass_mailbox>'],
};
// 기본 표본(원작 정규식을 못 찾았을 때) — 청과 세 종류와 데우스 카드의 최소 모양만 더해요.
// 1.0.x 솔라 4 카드 — 원작 CSS 없이 서랍 꼴(class)만, 글은 지어낸 것(세라피나)
const SOLA_EXTRA={"sola-ooc":"<details open class=\"sola-drawer sola-drawer-track sola-card-ooc\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>공동 작가 OOC 쪽지</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-ooc-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-user-ooc":"<details open class=\"sola-drawer sola-drawer-track sola-card-user-ooc\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>내 OOC 연출 메모</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-uooc-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-tempo":"<details open class=\"sola-drawer sola-drawer-track sola-card-tempo\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>전개 속도</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-feeling":"<details open class=\"sola-drawer sola-drawer-track sola-card-feeling\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>감정 엔진</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-bond":"<details open class=\"sola-drawer sola-drawer-track sola-card-bond\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>유대 · 케미</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-cabinet":"<details open class=\"sola-drawer sola-drawer-track sola-card-thought-cabinet\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>생각 서랍</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-thought-engine":"<details open class=\"sola-drawer sola-drawer-track sola-card-thought-engine\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>생각 엔진</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-calendar":"<details open class=\"sola-drawer sola-drawer-track sola-card-calendar\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>달력 · 연대기</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-wardrobe":"<details open class=\"sola-drawer sola-drawer-track sola-card-wardrobe\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>옷차림 · 몸 상태</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-inventory":"<details open class=\"sola-drawer sola-drawer-track sola-card-inventory\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>소지품 · 장비</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-cast":"<details open class=\"sola-drawer sola-drawer-track sola-card-cast\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>장면 인물 · 현장 사실</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-notebook":"<details open class=\"sola-drawer sola-drawer-track sola-card-notebook\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>연출 노트 · 이야기 씨앗</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-trait":"<details open class=\"sola-drawer sola-drawer-track sola-card-trait\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>인물 특성 장부</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-matrix":"<details open class=\"sola-drawer sola-drawer-track sola-card-matrix\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>인물 매트릭스</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-heart":"<details open class=\"sola-drawer sola-drawer-track sola-card-heart\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>마음 엔진</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-current":"<details open class=\"sola-drawer sola-drawer-track sola-card-current\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>속마음 흐름</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-arrow":"<details open class=\"sola-drawer sola-drawer-track sola-card-arrow\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>바람의 화살</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-track-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-easel":"<details open class=\"sola-drawer sola-drawer-track sola-card-easel\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>연출 이젤</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-easel-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-hud":"<details open class=\"sola-drawer sola-drawer-track sola-card-hud\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>HUD 묶음</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-hud-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-chatterbox":"<details open class=\"sola-drawer sola-drawer-track sola-card-chatterbox\"><summary class=\"sola-drawer-summary\"><span class=\"sola-drawer-title\"><span class=\"track-icon\">✦</span><span>수다방</span></span><span class=\"sola-drawer-badge\">세라피나</span><span class=\"sola-drawer-chevron\">+</span></summary><div class=\"sola-chatter-body\"><div class=\"sola-fld\"><span class=\"sola-fld-lab\">장소</span><span class=\"sola-fld-val\">숲 오두막 · 난롯가</span></div><div class=\"sola-fld\"><span class=\"sola-fld-lab\">지금</span><span class=\"sola-fld-val\">약초 차를 건네며 손님을 살펴요</span></div><div class=\"sola-director-note\">다음 장면은 조금 천천히 가요.</div></div></details>","sola-capsule":"<div class=\"sola-tc\">세라피나는 찻잔의 온기를 손바닥으로 느끼며, 손님이 언제 이름을 말해 줄지 조용히 기다렸다. 난롯불이 한 번 크게 일렁였고, 창밖 숲은 고요했다.</div>","sola-micro":"<p>세라피나가 <span class=\"sola-lore\"><span class=\"sola-lore-trigger\">숲의 약초</span><span class=\"sola-lore-card\">오두막 뒤뜰에서 자라는 은빛 잎, 달여 마시면 몸이 따뜻해져요.</span></span>를 꺼냈다. <span class=\"sola-tell\"><span class=\"sola-tell-trigger\">손끝</span><span class=\"sola-tell-tip\">긴장하면 찻잔을 두 번 두드려요.</span></span></p>"};
const BUILTIN_EXTRA={...SOLA_EXTRA,
    'fruit-choices':'<div class="post-it-container"><div class="cat-kaomoji corner-text">=^.^=</div><div class="corner-info corner-text">고르기</div><div class="post-it-collapsible"><div class="content-wrapper"><div id="options-container"><div class="clickable-text"><li>세라피나에게 숲길 지도를 부탁한다</li></div><div class="clickable-text"><li>난롯가에서 약초 차를 한 잔 더 마신다</li></div><div class="clickable-text"><li>창밖에서 움직이는 그림자를 살핀다</li></div></div></div></div></div>',
    'fruit-theater':'<div class="greenhouse"><div class="doc"><div class="top-bar"><span class="bar-label">글자만 극장</span></div><div class="content"><p>세라피나가 찻잔을 내려놓았다. <span class="say">“차가 식기 전에 마셔요.”</span></p><p><span class="whisper">『조금 쑥스럽네.』</span> <span class="sfx">〔딸깍〕</span></p><div class="quote-block">난롯불이 낮게 탄다</div><div class="hl-block"><p>오늘의 한 줄: 숲은 조용했다</p></div></div><div class="bottom-bar"><button class="to-top-btn" type="button">↑ 맨 위로</button></div></div></div>',
    'fruit-reverie':'<div class="reverie-container style-memory active"><div class="card-content-wrapper"><div class="memory-title-bar"><span class="title-text">기억 조각</span><div class="window-buttons"><span class="window-button">_</span><span class="window-button close">×</span></div></div><div class="memory-content-area"><div class="line-2">난롯불 옆에서 처음 들은 이야기</div><div class="line-3">세라피나는 찻잔을 두 손으로 감쌌다.</div></div><div class="memory-status-bar"><div class="line-1">가상력 12년 봄 · 숲 오두막</div></div></div></div>',
    'fruit-summary':'<div class="meow-fm-ghost"><details open><summary><span>12</span><span>가상력 12년 5월 3일 저녁</span></summary><div><div>→ 숲 오두막</div><div>세라피나가 다친 손님에게 약초 차를 건넸어요.</div></div></details><div>=^.^=</div></div>',
    'qingguo-forum':'<div class="forum-container"><div class="live-indicator">LIVE</div><div class="forum-title">가상 방송 포럼</div><div class="subject-info">파란 겉옷에 회색 목도리를 두른 차림</div><div class="comment"><span class="comment-author">Stardust_77</span><p class="comment-text">오늘 방송 배경 음악이 좋네요.</p><div class="comment-actions">답글 · 좋아요</div></div><div class="comment"><span class="comment-author">_void_</span><p class="comment-text">창가 자리 분위기가 최고예요.</p><div class="comment-actions">답글 · 좋아요</div></div></div>',
    'qingguo-board':'<div class="rumor-board"><div class="post-title">오늘 도서관 창가 자리 후기</div><span class="user-id">도서관지기</span><span class="timestamp">방금</span><p class="post-body">오후 햇빛이 좋아서 책 읽기 딱 좋았어요.</p><div class="comment-body"><span class="user-id">책벌레</span> 저도 거기 자주 가요.</div><div class="comment-meta">댓글 2</div></div>',
    'qingguo-mailbox':'<div class="mbox"><div class="m-head"><span class="m-title">편지함</span><span class="m-status">3통</span></div><div class="m-scroll"><div class="sms"><span class="sms-id">7520341</span><span class="sms-time">15:20</span><p class="sms-content">내일이 도서관 반납일이에요.</p></div><div class="sms"><span class="sms-id">1288745</span><span class="sms-time">15:21</span><p class="sms-content">주문하신 책이 도착했어요.</p></div></div><div class="m-foot">모두 읽음</div></div>',
};
// 바깥 라이브러리(React · Babel)로 그리는 원작은 격리 iframe 에서 그릴 수 없어요 — 원작 화면 구조(펼친 상태 · 첫 칸)를 그대로 옮긴 뼈대에 원작 CSS 만 입혀요.
const SKELETONS={
    single:'<div class="swiss-island expanded"><div class="island-bg-image" style="opacity:1"></div><div class="island-overlay" style="opacity:1"></div><div class="speech-bubble" style="left:48px;top:56px">다음 이야기는 어디로 이어질까?</div><div class="capsule-content"><span class="capsule-title">인물 A</span><span class="capsule-date">May 3, 0012</span></div><div class="card-content"><div class="card-header-row"><div><h1 class="main-title">인물 A</h1><div class="status-badge"><div class="status-dot"></div><span class="status-text">ACTIVE TRACKING</span></div></div><button class="close-btn"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1L13 13M1 13L13 1"></path></svg></button></div><div class="content-display-area"><div class="detail-glass-box"><div class="detail-header-title">LOCATION / TIME</div><div class="info-stack"><div class="detail-row"><span class="detail-label">Coordinates</span><span class="detail-value">오래된 도서관 · 동쪽 창가</span></div><div class="detail-row" style="border-bottom:none"><span class="detail-label">Local Time</span><span class="detail-value text-bold">15:20</span></div><div class="text-desc">오후 햇빛이 책장 사이로 들어오는 조용한 열람실</div></div></div></div><div class="nav-footer">'+['fa-map-location-dot','fa-user-astronaut','fa-heart','fa-magnifying-glass','fa-compact-disc','fa-gear'].map((icon,i)=>`<button class="nav-icon-btn${i?'':' active'}"><span><i class="fa-solid ${icon}"></i></span><div class="nav-dot"></div></button>`).join('')+'</div></div></div>',
};
const BUILTIN_CSS=`.sola-drawer>summary{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}.sola-drawer>:not(summary){padding-inline:.65em}.sola-drawer-title{display:inline-flex;gap:6px}.sola-drawer-badge{font-size:.8em;opacity:.75}.sola-fld{display:grid;grid-template-columns:minmax(4.5rem,auto) minmax(0,1fr);gap:.15em .6em;margin:0 0 .35em}.sola-fld-lab{font-size:.75em;font-weight:700;opacity:.75}.sola-director-note{font-style:italic;opacity:.8}.forum-container,.rumor-board,.mbox{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid #8885;border-radius:10px}.live-indicator,.m-status,.timestamp,.comment-actions,.comment-meta,.sms-time,.m-foot{font-size:12px;opacity:.7}.forum-title,.post-title,.m-title{font-weight:700}.comment,.sms{padding:8px 0;border-top:1px solid #8883}.dem-card{display:block;padding:8px 10px;border:1px solid #8885;border-left:3px solid #94e2d5;border-radius:8px}.dem-track__grid{display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"time date wx" "time place wx";align-items:center;gap:3px 12px;padding:10px 12px;border:1px solid #8885;border-top:2px solid #94e2d5;border-radius:10px}.dem-track__time{grid-area:time;display:flex;gap:6px;align-items:center}.dem-track__clock{font-size:1.3em;font-weight:600}.dem-track__date{grid-area:date;font-size:.76em;font-weight:700}.dem-track__place{grid-area:place;min-width:0}.dem-track__sep{margin:0 .4em;opacity:.6}.dem-track__wx{grid-area:wx;display:flex;flex-direction:column;align-items:flex-end}.dem-card__title{display:block;font-weight:700;margin-bottom:6px}`;

// 뿌리 표시: class 이름, 없으면 속성 이름([data-dem-thinking-fallback] — 생각 계획 카드)
const rootTokens=type=>{const c=[...String(type.root).matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m=>m[1]);return c.length?c:[...String(type.root).matchAll(/\[([\w-]+)/g)].map(m=>m[1]);};
const rootToken=type=>rootTokens(type)[0]||'';
// 데우스는 카드 하나를 여러 정규식(카드 · 줄 · 꾸밈 · 태그)이 이어서 만들어요. 「dem-」 을 내는 정규식을 모두 차례대로 써요.
const chainTokens=type=>type.owner==='deus'?['dem-']:type.owner==='sola'?['sola-']:[rootToken(type)];
// 데우스 정규식 목록의 판: V3 는 묶음(.dem-modules) · 트래커 격자(.dem-track__grid) · 유대 줄(.dem-bond-row)을 내요. 2.5 는 .dem-track__item 칸.
const V3_MARK=/dem-(?:modules|track__grid|bond-row|track__scene)\b/;
export const listVersion=list=>list.some(s=>V3_MARK.test(String(s?.replaceString||'')))?'v3':list.some(s=>String(s?.replaceString||'').includes('dem-'))?'2.5':null;
export const sampleInputs=(type,version='v3')=>type.owner==='deus'&&tidyDemVersion(version)==='2.5'?SAMPLE_INPUTS_25[type.id]||[]:SAMPLE_INPUTS[type.id]||[];

// 실리태번 regexFromString 과 같은 해석
export function parseFindRegex(source){
    try{const m=String(source).match(/(\/?)(.+)\1([a-z]*)/i);if(!m)return null;if(m[3]&&!/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3]))return new RegExp(source);return new RegExp(m[2],m[3]);}catch{return null;}
}
// 실리태번 runRegexScript 와 같은 치환 — {{match}} · $1 · $<이름> · 잘라 낼 글자. 표본이라 {{user}} · {{char}} 만 지어낸 이름으로 바꿔요.
export function runSampleScript(script,text){
    const find=parseFindRegex(script?.findRegex);if(!find||typeof script.replaceString!=='string')return text;
    const trims=Array.isArray(script.trimStrings)?script.trimStrings.filter(Boolean):[];
    return text.replace(find,(...args)=>{
        const groups=typeof args.at(-1)==='object'&&args.at(-1)?args.at(-1):null;
        const out=script.replaceString.replace(/{{match}}/gi,'$0').replaceAll(/\$(\d+)|\$<([^>]+)>/g,(_,num,name)=>{
            let value=num!==undefined?args[Number(num)]:groups?.[name];if(typeof value!=='string'||!value)return '';
            for(const t of trims)value=value.replaceAll(t,'');return value;
        });
        return out.replace(/{{user}}/gi,'나').replace(/{{char}}/gi,'인물 A');
    });
}
// 원작이 기본으로 꺼 두는 선택 규칙 이름(「Hide @Tracker scene backdrop (enable for settings it cannot fit)」 · 「… Collapsed (Enable for collapsed)」)
const OPTION_RULE=/\(\s*enable\b/i;
const placementOk=(s,type)=>!Array.isArray(s?.placement)||!s.placement.length||s.placement.includes(type.id==='sola-user-ooc'?1:2);
// 이 종류를 그리는 정규식 묶음 — 원작 뿌리 class 를 내는 정규식이 든 목록 하나를 골라, 그 목록의 관련 정규식을 순서대로.
//   8.1.0 그 종류의 카드를 내는 규칙이 켜져 있으면 실리태번처럼 켜진 규칙만 써요(꺼 둔 「장면 배경 숨기기」 같은 규칙이 섞이면 해 · 달이 사라졌어요).
//   카드 규칙이 전부 꺼져 있으면(그 모듈을 안 쓰는 설정 · 통째로 꺼 둔 사본) 모양을 보여 주려고 관련 규칙을 다 쓰되,
//   이름에 「(Enable for …)」 가 붙은 선택 규칙(원작이 기본으로 꺼 두는 것)만 빼요. 데우스는 고른 판(2.5 / V3)과 맞는 목록만 봐요.
export function pickSampleChain(type,lists,version='v3'){
    const token=rootToken(type),tokens=chainTokens(type);if(!token)return null;
    const attr=!/\./.test(type.root)&&/\[/.test(type.root);
    const has=s=>typeof s?.replaceString==='string'&&new RegExp(attr?`\\b${token.replace(/[-]/g,'\\-')}=`:`(?:class\\s*=\\s*["'][^"']*\\b|\\.|className\\s*=\\s*["'][^"']*\\b)${token.replace(/[-]/g,'\\-')}(?![\\w-])`).test(s.replaceString);
    // 카드를 「만드는」 규칙(class="… dem-status") — CSS 만 더하는 꾸밈 규칙(.dem-status{…})과 달라요
    const makes=s=>typeof s?.replaceString==='string'&&new RegExp(attr?`\\b${token.replace(/[-]/g,'\\-')}="`:`(?:class\\s*=\\s*["'][^"']*\\b|className\\s*=\\s*["'][^"']*\\b)${token.replace(/[-]/g,'\\-')}(?![\\w-])`).test(s.replaceString);
    const fits=list=>type.owner!=='deus'||listVersion(list)===tidyDemVersion(version);
    const ranked=lists.filter(({list})=>fits(list)).sort((a,b)=>(b.list.some(s=>has(s)&&!s.disabled)?1:0)-(a.list.some(s=>has(s)&&!s.disabled)?1:0));
    for(const {where,list} of ranked){
        if(!list.some(has))continue;
        const usable=list.filter(s=>s&&!s.promptOnly&&placementOk(s,type)&&tokens.some(t=>String(s.replaceString||'').includes(t)));
        const chain=usable.some(s=>!s.disabled&&makes(s))?usable.filter(s=>!s.disabled):usable.filter(s=>!s.disabled||!OPTION_RULE.test(String(s.scriptName||'')));
        if(chain.length)return {where,chain};
    }
    return null;
}
// 표본 글 → 원작 정규식 결과. 결과가 TavernHelper 용 ```html 문서면 그 문서를, 아니면 메시지 HTML 조각을 줘요.
//   트래커는 표본 글(낮 · 밤)마다 바꿔 전부 이어 붙여요. 다른 종류는 처음 되는 표본 하나.
const MULTI=new Set(['deus-tracker','deus-notice']);
const LEFT_TAGS=/<(status|relationships|threads|psych|plotlines|momentum|conflict|meanwhile|truths|undercurrents|scratchpad)>[\s\S]*?<\/\1>\s*/g;
export function sampleOutput(type,lists,version='v3'){
    const picked=pickSampleChain(type,lists,version);if(!picked)return null;
    const token=rootToken(type),parts=[];
    for(const input of sampleInputs(type,version)){
        let text=input;for(const script of picked.chain)text=runSampleScript(script,text);
        // 뿌리가 여러 class 중 하나(:is(.a,.b))면 어느 것이 나와도 돼요 — 형식 확인 알림(빠진 모듈 · 대사 색)
        if(text===input||!rootTokens(type).some(x=>text.includes(x)))continue;
        // V3 묶음 표본에서 켜 둔 규칙이 없어 그대로 남은 모듈 태그(<psych>…)는 채팅에서도 안 쓰는 모듈이라 빼요
        if(type.owner==='deus')text=text.replace(LEFT_TAGS,'');
        // TavernHelper 처럼 코드블록 안이 HTML 문서(<html · <body · <!doctype)면 iframe 문서로 봐요(```html 이 아니어도)
        const fenced=[...text.matchAll(/```[\w-]*[ \t]*\n?([\s\S]*?)```/g)].find(m=>/<(?:!doctype|html|body|head)\b/i.test(m[1])&&m[1].includes(token));
        // 채팅 본문 조각의 스크립트는 실리태번이 지우므로 iframe 문서일 때만 그려 봐요
        const out={where:picked.where,document:fenced?fenced[1]:text,scripted:!!fenced&&/<script\b/i.test(fenced[1]),fenced:!!fenced};
        if(!MULTI.has(type.id)||fenced)return out;
        parts.push(out);
    }
    return parts.length?{...parts[0],document:parts.map(p=>p.document).join('\n')}:null;
}
// 표본 문서의 CSS — 바깥 주소(글꼴 · 그림)는 미리보기 창이 어차피 막으므로 미리 빼요.
export function cleanSampleCss(css){
    return String(css).replace(/@import[^;]*;?/gi,'').replace(/@font-face\s*{[^}]*}/gi,b=>/url\(\s*['"]?(?:https?:)?\/\//i.test(b)?'':b).replace(/url\(\s*(['"]?)(?:https?:)?\/\/[^)]*\)/gi,'none').replace(/expression\s*\(|-moz-binding/gi,'');
}
const DROP=new Set(['SCRIPT','NOSCRIPT','IFRAME','FRAME','OBJECT','EMBED','LINK','META','BASE','AUDIO','VIDEO','SOURCE','TRACK','FORM','TEMPLATE','STYLE']);
const PLACEHOLDER='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%2F%3E';
// 그린 결과에서 실행 · 바깥 주소를 모두 빼고 모양(태그 · class · 인라인 style · 글자)만 남겨요.
export function sanitizeSampleNode(root){
    const walk=el=>{
        for(const child of [...el.children]){if(DROP.has(child.tagName.toUpperCase()))child.remove();else walk(child);}
        for(const attr of [...el.attributes]){
            const name=attr.name.toLowerCase(),value=attr.value;
            if(name.startsWith('on')||/^(href|xlink:href|action|formaction|srcset|ping|background|poster|data)$/.test(name))el.removeAttribute(attr.name);
            else if(name==='src')el.setAttribute('src',/^data:image\/(png|gif|jpeg|webp);base64,/i.test(value)?value:PLACEHOLDER);
            else if(name==='style'&&/url\s*\(\s*['"]?(?:https?:|\/\/|javascript:)|expression\s*\(/i.test(value))el.setAttribute('style',value.replace(/url\s*\([^)]*\)/gi,'none').replace(/expression\s*\(/gi,''));
        }
        if(/^(button|input|select|textarea|details|summary|a)$/i.test(el.tagName)){el.setAttribute('tabindex','-1');}
        if(el.tagName.toUpperCase()==='DETAILS')el.setAttribute('open','');// 표본은 접힌 카드도 펼쳐 글자를 보여요
    };
    walk(root);if(root.tagName?.toUpperCase()==='DETAILS')root.setAttribute('open','');return root;
}
// 그린 문서(문자열)에서 표본 뿌리 · CSS · html/body 의 class · style 을 가져와요(스크립트는 실행하지 않는 DOMParser)
// localize: 과일 계열 한글화가 켜져 있으면 채팅과 같은 라벨 한글화(installFruitStatusKorean)를 표본 문서에도 한 번 입혀요
export function extractSample(type,html,localize=null,view=globalThis){
    const doc=new DOMParser().parseFromString(html,'text/html');let stop=null;
    if(localize){const chat=doc.createElement('div');chat.id='chat';chat.append(...doc.body.childNodes);doc.body.append(chat);try{stop=localize(doc,view);}catch{stop=null;}}
    try{
    // 데우스는 뿌리가 여럿일 수 있어요(낮 · 밤 트래커) — 전부. V3 카드는 늘 묶음(.dem-modules) 안이라 묶음째(테두리 빛 · 탭이 실제 채팅과 같게)
    const roots=type.owner==='deus'?[...new Set([...doc.querySelectorAll(typeMatch(type))].map(el=>el.closest('.dem-modules,.custom-dem-modules')||el))]:[doc.querySelector(typeMatch(type))].filter(Boolean);
    if(!roots.length)return null;
    const css=cleanSampleCss([...doc.querySelectorAll('style')].map(s=>s.textContent).join('\n'));
    for(const root of roots){for(const s of root.querySelectorAll('style'))s.remove();sanitizeSampleNode(root);}
    const pick=el=>({className:el?.getAttribute('class')||'',style:(el?.getAttribute('style')||'').replace(/url\s*\([^)]*\)/gi,'none')});
    return {html:roots.map(r=>r.outerHTML).join(''),css,htmlAttrs:pick(doc.documentElement),bodyAttrs:pick(doc.body)};
    }finally{stop?.();}
}
// 표본에 쓸 실리태번 색 변수(정규식 CSS 가 var(--SmartTheme…) 로 읽어요)
const VAR_NAMES=['--SmartThemeBodyColor','--SmartThemeEmColor','--SmartThemeUnderlineColor','--SmartThemeQuoteColor','--SmartThemeBlurTintColor','--SmartThemeChatTintColor','--SmartThemeUserMesBlurTintColor','--SmartThemeBotMesBlurTintColor','--SmartThemeShadowColor','--SmartThemeBorderColor','--mainFontSize','--mainFontFamily','--monoFontFamily','--fontScale'];
export function sampleVars(doc=document){
    const style=getComputedStyle(doc.body),out=[];
    for(const name of VAR_NAMES){const v=style.getPropertyValue(name).trim();if(v&&!/[;{}<>]|url\s*\(/i.test(v))out.push(`${name}:${v}`);}
    out.push(`--TH-viewport-height:${Math.round(doc.defaultView?.innerHeight||800)}px`);
    return out.join(';');
}
const SHIM=(nonce,vars)=>`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><script>(function(){var P=window.parent,N=${JSON.stringify(nonce)},V=${JSON.stringify(vars)},m={};
var ls={getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};
try{Object.defineProperty(window,'localStorage',{value:ls,configurable:true});Object.defineProperty(window,'sessionStorage',{value:ls,configurable:true});}catch(e){}
try{Object.defineProperty(window,'parent',{value:window,configurable:true});}catch(e){}
try{document.documentElement.style.cssText+=';'+V;}catch(e){}
document.addEventListener('DOMContentLoaded',function(){try{document.body.style.cssText+=';'+V;}catch(e){}});
function send(){try{var s=document.querySelectorAll('script');for(var i=0;i<s.length;i++)s[i].remove();P.postMessage({blFruitSample:N,html:'<!doctype html>'+document.documentElement.outerHTML},'*');}catch(e){P.postMessage({blFruitSample:N,html:null},'*');}}
window.addEventListener('load',function(){setTimeout(send,700);});})();</script>`;
// TavernHelper(JS-Slash-Runner 4.x createSrcContent)와 같은 겉문서 — 기본 규칙(상자 크기 · 여백 0)과 min-height 의 vh 바꾸기까지
const TH_BASE='*,*::before,*::after{box-sizing:border-box;}html,body{margin:0!important;padding:0;overflow:hidden!important;max-width:100%!important;}';
export const thViewportCss=source=>String(source).replace(/(min-height\s*:\s*)([^;{}]*?\d+(?:\.\d+)?vh)(?=\s*[;}])/gi,(m,prefix,value)=>prefix+value.replace(/(\d+(?:\.\d+)?)vh\b/gi,(x,n)=>Number(n)===100?'var(--TH-viewport-height)':`calc(var(--TH-viewport-height) * ${Number(n)/100})`));
export function stageDocument(source,nonce,vars){
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${SHIM(nonce,vars)}<style>${TH_BASE}</style></head><body>${thViewportCss(source)}</body></html>`;
}
// 스크립트가 그리는 원작 문서를 격리 iframe(다른 출처 · 네트워크 막음)에서 한 번 그려 결과 HTML 만 받아요.
export function renderSampleStage(source,{width=360,vars='',timeout=3000,doc=document}={}){
    return new Promise(resolve=>{
        const nonce=Math.random().toString(36).slice(2)+Date.now().toString(36),frame=doc.createElement('iframe'),view=doc.defaultView;
        frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('aria-hidden','true');frame.setAttribute('title','표본 상태창 준비');frame.tabIndex=-1;frame.className='bl-ft-sample-stage';
        frame.style.cssText=`position:fixed;left:0;top:0;width:${Math.max(200,Math.round(width))}px;height:1600px;border:0;opacity:0;pointer-events:none;z-index:-1;contain:strict`;
        let done=false,timer=0;
        const finish=html=>{if(done)return;done=true;view.clearTimeout(timer);view.removeEventListener('message',onMessage);frame.remove();resolve(html);};
        const onMessage=e=>{if(e.source===frame.contentWindow&&e.data&&e.data.blFruitSample===nonce)finish(typeof e.data.html==='string'?e.data.html:null);};
        view.addEventListener('message',onMessage);timer=view.setTimeout(()=>finish(null),timeout);
        frame.srcdoc=stageDocument(source,nonce,vars);doc.body.append(frame);
    });
}
// 지금 실리태번에 있는 정규식 목록들(지금 프리셋 · 전역 · 이 카드 · 다른 프리셋). 읽기만 해요.
export function sampleRegexLists(){
    const out=[],seen=new Set(),push=(where,list)=>{if(Array.isArray(list)&&list.length&&!seen.has(list)){seen.add(list);out.push({where,list});}};
    let ctx=null;try{ctx=globalThis.SillyTavern?.getContext?.();}catch{}
    if(!ctx)return out;
    try{push('preset',ctx.getPresetManager?.()?.readPresetExtensionField?.({path:'regex_scripts'}));}catch{}
    try{push('global',ctx.extensionSettings?.regex);}catch{}
    try{push('card',ctx.characters?.[Number(ctx.characterId)]?.data?.extensions?.regex_scripts);}catch{}
    try{const pm=ctx.getPresetManager?.('openai');for(const name of pm?.getAllPresets?.()||[])push(`preset:${name}`,pm.getCompletionPresetByName?.(name)?.extensions?.regex_scripts);}catch{}
    return out;
}
const listSignature=lists=>lists.map(({where,list})=>`${where}:${list.length}:${list.map(s=>`${s?.id||''}${s?.disabled?0:1}${String(s?.replaceString||'').length}`).join('.')}`).join('|');
export function builtinSample(type,version='v3'){
    const html=BUILTIN_EXTRA[type.id]||fruitTypePreview(type.id,tidyDemVersion(version));
    return {html,css:`${FRUIT_PREVIEW_BASE.replace(/body\{[^}]*\}/,'')}${BUILTIN_CSS}${type.owner==='deus'?DEUS_PREVIEW_CSS:''}`,htmlAttrs:{className:'',style:''},bodyAttrs:{className:'',style:''},origin:'builtin',fragment:type.owner==='deus'||type.owner==='sola'};
}
// 실리태번이 메시지 HTML 에 하는 것처럼 class 앞에 custom- 을 붙여요(fa- · note- · monospace 는 그대로)
export const stClassName=value=>String(value||'').split(/\s+/).filter(Boolean).map(v=>v.startsWith('fa-')||v.startsWith('note-')||v==='monospace'||v.startsWith('custom-')?v:`custom-${v}`).join(' ');
export function stClasses(root){for(const el of [root,...root.querySelectorAll('[class]')]){const c=el.getAttribute?.('class');if(c)el.setAttribute('class',stClassName(c));}return root;}
// 맨 바깥 쉼표로만 선택자 목록을 나눠요(:is( , ) 안 쉼표는 그대로)
export function splitSelectors(text){const out=[];let depth=0,start=0;for(let i=0;i<text.length;i++){const c=text[i];if(c==='('||c==='[')depth++;else if(c===')'||c===']')depth--;else if(c===','&&!depth){out.push(text.slice(start,i));start=i+1;}}out.push(text.slice(start));return out.map(s=>s.trim()).filter(Boolean);}
// 선택자마다 앞에 범위를 붙이고(html · body · :root 는 범위 자체로), 원하면 class 를 custom- 이름으로 — 실리태번 decodeStyleTags 와 같은 일을 표본 자리에만
export function scopeSelector(selector,prefix,custom=false){
    return splitSelectors(selector).map(sel=>{
        if(custom)sel=sel.replace(/\.(-?[_a-zA-Z][\w-]*)/g,(m,name)=>name.startsWith('custom-')?m:`.custom-${name}`);
        const bare=sel.replace(/^(?::root|html|body)(?=$|[\s>+~.:#[])\s*/i,'');
        return bare?`${prefix} ${bare}`:prefix;
    }).join(',');
}
// 브라우저의 CSS 해석기로 규칙을 읽어 선택자만 바꿔요(@media · @supports 안쪽까지, @keyframes · @font-face 는 그대로)
export function scopeCss(css,prefix,{custom=false,doc=document}={}){
    let sheet;try{sheet=new doc.defaultView.CSSStyleSheet();sheet.replaceSync(String(css).replace(/@import[^;]*;?/gi,''));}catch{return '';}
    const walk=rules=>[...rules].map(rule=>{
        if(rule.selectorText!==undefined&&rule.style)return `${scopeSelector(rule.selectorText,prefix,custom)}{${rule.style.cssText}}`;
        if(rule.cssRules&&rule.conditionText!==undefined)return `@${rule.constructor.name==='CSSSupportsRule'?'supports':rule.constructor.name==='CSSContainerRule'?'container':'media'} ${rule.conditionText}{${walk(rule.cssRules)}}`;
        return rule.cssText;
    }).join('\n');
    return walk(sheet.cssRules);
}
// 데우스처럼 채팅 본문에 바로 그려지는 상태창은, 채팅과 같은 테마 규칙(데우스 스킨 등)을 받는 숨은 자리(.salty-preview › .mes_text)에 그려서
// 실제 상태창과 같은 방법(copyFruitPreview)으로 미리보기에 옮겨요. 이 자리는 화면에 보이지 않고 누를 수 없어요.
// textStyle: 채팅의 실제 메시지 본문(.mes_text) 글자 · 폭을 그대로 맞춰요(설정 창 미리보기용 옛 규칙과 크기가 달라서).
export function mountFragmentHost(type,sample,{width=360,doc=document,textStyle=null}={}){
    const host=doc.createElement('div');host.className='salty-preview bl-ft-sample-host';host.setAttribute('aria-hidden','true');host.inert=true;host.setAttribute('data-bl-dem-paused','');   // 1.0.0 숨은 표본의 감정 대사 효과(bl-fx-*)는 멈춰 둬요 — 보이지 않는 자리에서 매 프레임 스타일 재계산을 돌리던 것(css/55 멈춤 규칙)
    host.style.cssText=`position:fixed;right:100vw;top:0;width:${Math.round(width)+160}px;opacity:0;pointer-events:none;z-index:-1`;   // 8.0.9 버그: left:0 이면 화면 폭 + 126px 의 숨은 자리가 html 가로 스크롤을 만들었어요(폰 320~384) → 화면 왼쪽 밖(음수 x)에 두면 스크롤 넘침에 안 들어가요
    host.innerHTML='<div class="mes" is_user="false" is_system="false"><div class="mes_block"><div class="mes_text"></div></div></div>';
    const text=host.querySelector('.mes_text'),style=doc.createElement('style'),typo=doc.createElement('style');
    style.textContent=scopeCss(sample.css,'.bl-ft-sample-host .mes_text',{custom:true,doc});
    const parsed=new DOMParser().parseFromString(`<!doctype html><body>${sample.html}</body>`,'text/html');
    // 8.1.0 접힌 카드(묶음 · Off-scene · 트래커 한 줄)는 표본에서 펼쳐 보여요 — [open] 과 폰 접기의 .bl-dem-shown 둘 다
    const nodes=[...parsed.body.childNodes].map(node=>{const copy=doc.importNode(node,true);if(copy.nodeType===1){stClasses(copy);for(const el of [copy,...copy.querySelectorAll('.custom-dem-track,.custom-dem-track-recovery,details')]){if(el.matches('.custom-dem-track,.custom-dem-track-recovery,details.custom-dem-card,details.custom-dem-modules'))el.classList.add('bl-dem-shown');if(el.tagName==='DETAILS')el.setAttribute('open','');}}return copy;});
    text.style.setProperty('width',`${Math.round(width)}px`,'important');text.style.setProperty('max-width','none','important');
    if(textStyle)for(const [key,value] of Object.entries(textStyle))if(value)text.style.setProperty(key,value,'important');
    // 뿌리가 여럿(낮 · 밤 트래커)이어도 한 번에 옮기게 묶음 하나에 담아요. 묶음은 모양이 없어요(div).
    //   1.0.0: 묶음은 flow-root — 첫 · 끝 카드의 바깥 여백(솔라 서랍 8.7px)이 묶음 밖으로 새면 묶음 높이로 잰 미리보기 칸이 그만큼 짧아 끝 줄이 잘렸어요(11-01 솔라 OOC 쪽지 121px).
    const set=doc.createElement('div');set.className='bl-ft-sample-set';set.style.display='flow-root';set.append(...nodes);
    text.append(style,typo,set);doc.body.append(host);
    return {host,get root(){return set.querySelector(typeMatch(type))?set:null;},setTypography(css){const next=css?scopeCss(css,'.bl-ft-sample-host',{doc}):'';if(typo.textContent!==next)typo.textContent=next;},remove(){host.remove();}};
}
const cache=new Map();
// 표본 하나 — {html, css, htmlAttrs, bodyAttrs, origin:'regex'|'builtin', fragment}
export async function buildFruitSample(type,{width=360,vars=sampleVars(),lists=sampleRegexLists(),doc=document,localize=false,version='v3'}={}){
    version=tidyDemVersion(version);
    const key=[type.id,Math.round(width),vars,listSignature(lists),localize,version].join('\n');
    if(cache.has(key))return cache.get(key);
    const make=async()=>{
        try{
            const out=sampleOutput(type,lists,version);
            if(out){
                const html=out.scripted?await renderSampleStage(out.document,{width,vars,doc}):out.document;
                const korean=localize&&out.fenced?(await import('./scripts/fruit-status.js')).installFruitStatusKorean:null;
                let sample=html&&extractSample(type,html,korean,doc.defaultView);
                if(!sample&&out.fenced&&SKELETONS[type.id]){
                    // 원작 문서의 <style> 만(스크립트는 실행하지 않는 DOMParser) + 원작 구조 뼈대
                    const styles=[...new DOMParser().parseFromString(out.document,'text/html').querySelectorAll('style')].map(s=>`<style>${s.textContent}</style>`).join('');
                    sample=extractSample(type,`<!doctype html><html><head><style>${TH_BASE}</style>${styles}</head><body>${SKELETONS[type.id]}</body></html>`,korean,doc.defaultView);
                }
                // 채팅의 과일 iframe 에 늘 넣는 한국어 낱말 꺾임 막기(wrapCss)도 같이
                if(sample)return {...sample,css:out.fenced?`${sample.css}\n${wrapCss()}`:sample.css,origin:'regex',where:out.where,fragment:!out.fenced};
            }
        }catch{/* 원작 정규식을 못 쓰면 기본 표본으로 */}
        return builtinSample(type,version);
    };
    const pending=make();cache.set(key,pending);if(cache.size>40)cache.delete(cache.keys().next().value);
    return pending;
}
export const SAMPLE_TYPES=FRUIT_TYPES.map(t=>t.id);
