// 자동 생성 (tools/build-plain-scripts.mjs) — 고치려면 bundled/deus.js 을 고치고 다시 만든다
export default function blueLemonadeScript(BlueLemonade) {
/*BL-SCRIPT-START*/
// 표시용 번역 사전: 저장된 이름과 프롬프트 본문은 바꾸지 않습니다.
BlueLemonade.translate({
  "priority": 20,
  "prompts": [
    {
      "name": "「 3rd Person 」",
      "title": "「 3인칭 」",
      "desc": "캐릭터 시점과 {{user}} 시점 구역에 같은 이름이 있습니다. 목록에서 눌러 열면 어느 쪽인지 구분해 보여 줍니다."
    },
    {
      "name": "「 1st Person 」",
      "title": "「 1인칭 」",
      "desc": "캐릭터 시점과 {{user}} 시점 구역에 같은 이름이 있습니다. 목록에서 눌러 열면 어느 쪽인지 구분해 보여 줍니다."
    },
    {
      "name": "「 Card-Default 」",
      "title": "「 카드 기본 」",
      "desc": "세계관 구축과 서사 분위기 구역에 같은 이름이 있습니다. 목록에서 눌러 열면 어느 쪽인지 구분해 보여 줍니다."
    },
    {
      "id": "main",
      "name": "M (ST - Disabled)",
      "title": "M (실리태번 기본 · 꺼 둠)",
      "desc": "실리태번 기본 메인 프롬프트 자리입니다. 이 프리셋에서는 꺼 둡니다."
    },
    {
      "id": "nsfw",
      "name": "N (ST - Disabled)",
      "title": "N (실리태번 기본 · 꺼 둠)",
      "desc": "실리태번 기본 NSFW 프롬프트 자리입니다. 이 프리셋에서는 꺼 둡니다."
    },
    {
      "id": "dialogueExamples",
      "name": "⟡ Chat Examples ⟡",
      "title": "⟡ 예시 대화 ⟡",
      "desc": "실리태번 기본 항목: 캐릭터 카드의 예시 대화입니다."
    },
    {
      "id": "jailbreak",
      "name": "! Post-History Instructions !",
      "title": "! 대화 기록 뒤 지시 !",
      "desc": "기본으로 꺼져 있습니다. 카드가 넣는 '대화 기록 뒤 지시(Post-History Instructions)'를 쓰고 싶을 때만 켜세요."
    },
    {
      "id": "chatHistory",
      "name": "⟡ Chat History ⟡ ⚠️",
      "title": "⟡ 대화 기록 ⟡ ⚠️",
      "desc": "실리태번 기본 항목: 지금까지의 대화 기록입니다."
    },
    {
      "id": "worldInfoAfter",
      "name": "⟡ World Info (after) ⟡",
      "title": "⟡ 로어북 (캐릭터 설정 뒤) ⟡",
      "desc": "실리태번 기본 항목: 캐릭터 설정 뒤에 들어가는 로어북 내용입니다."
    },
    {
      "id": "worldInfoBefore",
      "name": "⟡ World Info (before) ⟡",
      "title": "⟡ 로어북 (캐릭터 설정 앞) ⟡",
      "desc": "실리태번 기본 항목: 캐릭터 설정 앞에 들어가는 로어북 내용입니다."
    },
    {
      "id": "enhanceDefinitions",
      "name": "E (ST - Disabled)",
      "title": "E (실리태번 기본 · 꺼 둠)",
      "desc": "실리태번 기본 '정의 강화' 자리입니다. 이 프리셋에서는 꺼 둡니다."
    },
    {
      "id": "charDescription",
      "name": "⟡ Char Description ⟡ ⚠️",
      "title": "⟡ 캐릭터 설명 ⟡ ⚠️",
      "desc": "실리태번 기본 항목: 캐릭터 카드의 설명입니다."
    },
    {
      "id": "charPersonality",
      "name": "⟡ Char Personality ⟡ ⚠️",
      "title": "⟡ 캐릭터 성격 ⟡ ⚠️",
      "desc": "실리태번 기본 항목: 캐릭터 카드의 성격 요약입니다."
    },
    {
      "id": "scenario",
      "name": "⟡ Scenario ⟡",
      "title": "⟡ 시나리오 ⟡",
      "desc": "실리태번 기본 항목: 캐릭터 카드의 시나리오입니다."
    },
    {
      "id": "personaDescription",
      "name": "⟡ Persona Description ⟡",
      "title": "⟡ 페르소나 설명 ⟡",
      "desc": "실리태번 기본 항목: 내 페르소나 설명입니다."
    },
    {
      "id": "8e8f0b40-c695-47b8-90d6-3720e4c79437",
      "name": "| Plot Guidance |",
      "title": "| 플롯 가이드 |",
      "desc": "반전 같은 이야기 전개 장치입니다. 기본으로 켜져 있습니다."
    },
    {
      "id": "c9e2d1f7-4a6b-4e8e-9b3d-5f7a1c2e9d40",
      "name": "🔻PICK: PACING🔻",
      "title": "🔻택1: 전개 속도🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "f6c1a7d4-2b8e-4f90-a3d5-6e1b9c7d2048",
      "name": "「 Adaptive 」",
      "title": "「 적응형 」",
      "desc": "균형 잡힌 전개 속도. 서두르지 않으면서 이야기가 계속 움직입니다. 기본 선택."
    },
    {
      "id": "a4e8c2f1-7d9b-46b3-8f0a-5c1e2d6b9a74",
      "name": "「 Frenetic 」",
      "title": "「 급박하게 」",
      "desc": "빠르고 몰아붙이는 전개 속도."
    },
    {
      "id": "b7d3f9a2-6c1e-48b5-9d0f-4a7e2c8b1f63",
      "name": "「 Laid-Back 」",
      "title": "「 느긋하게 」",
      "desc": "천천히 쌓아 가는 여유로운 전개 속도."
    },
    {
      "id": "b7e4eab4-3fc3-4f7c-a9aa-17b8b32b8f61",
      "name": "「 Flexible 」",
      "title": "「 유동적 」",
      "desc": "상황에 따라 짧게도 길게도 씁니다. 기본 선택."
    },
    {
      "id": "c8150e42-0cc3-4728-a95d-024f608895e3",
      "name": "「 Short 」",
      "title": "「 짧게 」",
      "desc": "짧은 답변."
    },
    {
      "id": "0c01676d-4a2e-439c-a5ac-27c128d5a533",
      "name": "| Characters |",
      "title": "| 캐릭터 |",
      "desc": "캐릭터의 행동 방식과 모델이 캐릭터를 다루는 방법을 정합니다. 기본으로 켜져 있습니다."
    },
    {
      "id": "16879fbb-850b-4c0a-b25a-30c6911e3f9f",
      "name": "「 Without Asterisks 」",
      "title": "「 별표 없이 」",
      "desc": "서술을 *별표*로 감싸지 않습니다. 기본 선택."
    },
    {
      "id": "c32a9d07-bbcc-4456-adaa-ed1642d47db9",
      "name": "| Visual Storytelling (HTML) |",
      "title": "| 시각적 연출 (HTML) |",
      "desc": "매 답변에 이야기에 어울리는 작거나 눈에 띄는 HTML/CSS 요소를 넣습니다. 기본으로 꺼져 있습니다."
    },
    {
      "id": "b3b14ca1-4c8c-4539-a9c3-a2fcb2771c40",
      "name": "「 Visible 」",
      "title": "「 보이기 」",
      "desc": "캐릭터 속마음을 화면에 보여 줍니다. '대사 색상'이 켜져 있으면 같은 캐릭터 색을 씁니다. 캐릭터 1인칭 시점에서는 자동으로 꺼집니다."
    },
    {
      "id": "89e96392-9741-479e-8f77-228a21502a54",
      "name": "| Content Policy |",
      "title": "| 콘텐츠 정책 |",
      "desc": "창작에서 다룰 내용의 범위와 표현 기준을 정하는 항목입니다."
    },
    {
      "id": "838e2a5f-0e74-4abd-98a4-0fee33a22a14",
      "name": "| Character Realism |",
      "title": "| 캐릭터 현실성 |",
      "desc": "아첨을 줄이고 캐릭터 행동을 더 현실적으로 만듭니다. 기본으로 켜져 있고, '최고 수위'를 켜면 충돌을 막기 위해 자동으로 꺼집니다."
    },
    {
      "id": "c4311841-0509-4578-8864-9ebd0c1e7236",
      "name": "「 2nd Person 」",
      "title": "「 2인칭 ({{user}}) 」",
      "desc": "{{user}}를 2인칭으로 서술합니다. 예: 당신이 말한다. 기본 선택."
    },
    {
      "id": "745db607-a083-45d7-b216-f3c69e4d8c31",
      "name": "| Dialogue Color |",
      "title": "| 대사 색상 |",
      "desc": "대사에 인라인 CSS 색을 넣어 캐릭터마다 고유한 색을 줍니다. 기본으로 켜져 있고 '시각적 연출 (HTML)'과 함께 켤 수 있습니다."
    },
    {
      "id": "8ffe0557-5f8a-45bd-ab43-ebc580510827",
      "name": "| Banned Terms |",
      "title": "| 금지어 목록 |",
      "desc": "모델이 자주 쓰는 식상한 표현 금지 목록입니다. 똑똑한 모델일수록 잘 지킵니다. 자주 나오는 표현은 직접 추가하고 안 나오는 건 지우세요."
    },
    {
      "id": "802abe87-7b38-4275-b8e8-ff39beda3ecd",
      "name": "! Hard Jailbreak !",
      "title": "! 강력 탈옥 !",
      "desc": "강한 탈옥 프롬프트입니다. 기본으로 꺼져 있고 가끔 Mimo에 유용합니다. 모델이 거부할 때만 켜세요. 일부 모델에는 너무 강해서 오히려 거부를 부를 수 있습니다."
    },
    {
      "id": "3cd3a7aa-9264-45ad-be9e-8e53ff38ce32",
      "name": "🔻PICK: TRACKER🔻",
      "title": "🔻택1: 트래커🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "9056ce79-fcf0-443e-aa6f-ae6b8929ece2",
      "name": "「 Time Window 」",
      "title": "「 대략적인 시간대 」",
      "desc": "시간대(아침·저녁 등)·날짜·장소·날씨 트래커를 붙입니다. °C로 바꾸려면 본문의 템플릿을 고치세요."
    },
    {
      "id": "4e6b48fe-f9f6-41e7-b910-dc6f13d15cfd",
      "name": "「 Exact Time 」",
      "title": "「 정확한 시각 」",
      "desc": "정확한 시각·날짜·장소·날씨 트래커를 붙입니다. 온도를 °F에서 °C로 바꾸려면 본문의 템플릿을 고치세요. 기본 선택."
    },
    {
      "id": "70180865-8275-483a-980a-7c4e404f6723",
      "name": "🔻PICK: TENSION🔻",
      "title": "🔻택1: 긴장감🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "e0ffb643-674b-42a1-bb0b-076e4b7ad3d7",
      "name": "「 Momentum Engine 」",
      "title": "「 모멘텀 엔진 」",
      "desc": "다음 턴 이야기 경로 4개를 만들고, 정규식 매크로가 그중 하나를 무작위로 골라 전개를 이끕니다. 따로 고를 필요 없습니다. 기본 선택이며 '! 모멘텀 엔진 라우터 !'도 함께 켜 두어야 합니다."
    },
    {
      "id": "fff18557-018d-4856-9497-2f47a6ef2b2a",
      "name": "「 Conflict 」",
      "title": "「 갈등 블록 」",
      "desc": "답변 끝에 갈등 블록을 붙여, 다음 답변을 모멘텀 엔진보다 느린 속도로 그 내용 쪽으로 이끕니다."
    },
    {
      "id": "d3a52caa-ed44-454b-ba62-a40101d4949d",
      "name": "| Anti-Positivity Bias |",
      "title": "| 긍정 편향 방지 |",
      "desc": "갈등을 피하거나 모든 걸 훈훈하게 만드는 모델의 경향을 줄입니다. 기본으로 켜져 있습니다."
    },
    {
      "id": "ab70a374-f6f5-4e5c-a1c6-1596a4397806",
      "name": "| Story Threads |",
      "title": "| 스토리 떡밥 |",
      "desc": "모멘텀 엔진과 함께면 [미해결]·[씨앗] 떡밥만 기록해 모델이 다시 다루게 합니다. 모멘텀 엔진 없이 쓰면 [미해결]·[현재]·[가능] 스토리 포인트를 추적해 '갈등 블록'에 넘겨 줍니다. 기본으로 켜져 있습니다."
    },
    {
      "id": "34c55900-90a8-4770-a8a3-6f535579f6cd",
      "name": "「 Hidden 」",
      "title": "「 숨김 」",
      "desc": "비밀·감정·의견 같은 캐릭터 속마음을 모델에게만 보내고 화면에는 숨깁니다(답변 편집으로 볼 수 있음). 기본 선택. 캐릭터 1인칭 시점에서는 자동으로 꺼집니다."
    },
    {
      "id": "3f6ef275-2ecb-45ca-8ceb-f77ad11e012a",
      "name": "| Anti-Repetition |",
      "title": "| 반복 방지 |",
      "desc": "따라 하기와 반복을 줄입니다(완전히 없애지는 못함). 쓰는 모델이 원래 반복하지 않으면 끄세요. 기본으로 켜져 있습니다."
    },
    {
      "id": "4371b70a-8f15-46ec-90fb-6ea572c77cde",
      "name": "| Anti-Omniscience |",
      "title": "| 전지적 시점 방지 |",
      "desc": "{{user}}의 서술처럼 캐릭터가 알 수 없는 정보를 알지 못하게 막습니다. 똑똑한 모델일수록 잘 작동합니다."
    },
    {
      "id": "1d816ec2-2c8f-4e92-81d1-18021dbfedd0",
      "name": "「 Max Lewdness 」",
      "title": "「 최고 수위 」",
      "desc": "판타지적·극단적인 수위. 장면이 빠르게 NSFW로 흘러갑니다. 켜면 '캐릭터 현실성'이 자동으로 꺼집니다."
    },
    {
      "id": "52a66809-c36a-4893-87ee-228b93f24e77",
      "name": "「 Medium 」",
      "title": "「 보통 」",
      "desc": "보통 길이 답변."
    },
    {
      "id": "d72af435-6568-454e-9ed5-aeeb079a55bb",
      "name": "「 Literary 」",
      "title": "「 문학적 」",
      "desc": "디테일과 수사에 집중하는, 약간 주관적인 문학 서술."
    },
    {
      "id": "7c8ce8f6-46c2-4035-89b0-6beac7ac5c6c",
      "name": "「 Lite 」",
      "title": "「 라이트 」",
      "desc": "토큰 최소화. 추가 문체 없이 서술 품질 규칙만 압축해 넣습니다."
    },
    {
      "id": "0908e4f6-a475-4ec6-be3c-1640225c690a",
      "name": "「 Dry 」",
      "title": "「 건조하게 」",
      "desc": "영화적 서술의 극단형. 은유·직유 없이 직접적이고 객관적인 묘사만 합니다."
    },
    {
      "id": "02f90aa5-83a7-4799-b7f6-4de37111c69f",
      "name": "「 Naturalistic 」",
      "title": "「 자연스럽게 」",
      "desc": "과장 없이 실제 사람 같은 대사. 기본 선택."
    },
    {
      "id": "353d0187-4c2b-4104-a2bb-c1920e4e174d",
      "name": "「 Lean 」",
      "title": "「 절제되게 」",
      "desc": "차분하고 절제된, 정확한 대사."
    },
    {
      "id": "d2c6ab81-6ae3-4880-8d50-43b2bc9326c6",
      "name": "「 Heightened 」",
      "title": "「 생동감 있게 」",
      "desc": "생기 있고 더 길며 표현이 풍부한 대사."
    },
    {
      "id": "c66c7b02-93ab-44ca-b908-0b49fe626280",
      "name": "「 Long 」",
      "title": "「 길게 」",
      "desc": "긴 답변."
    },
    {
      "id": "7ee86bcd-2311-496c-ae0c-2ef13e5d5dc7",
      "name": "「 3rd Person 」",
      "title": "「 3인칭 ({{user}}) 」",
      "desc": "{{user}}를 3인칭으로 서술합니다. 예: 그들(당신)이 말한다."
    },
    {
      "id": "49c0c04e-ef52-4817-8430-f08644d7c382",
      "name": "「 1st Person 」",
      "title": "「 1인칭 ({{user}}) 」",
      "desc": "{{user}}를 1인칭으로 서술합니다. 예: 나({{user}})는 말한다. '선택지 목록'이나 '연출가 모드'가 필요하며, 없으면 경고와 함께 2인칭으로 돌아갑니다."
    },
    {
      "id": "1975aa43-f0ba-402b-b12f-e708c40d931d",
      "name": "「 Present 」",
      "title": "「 현재형 」",
      "desc": "현재 시제로 서술합니다. 기본 선택."
    },
    {
      "id": "7c8282df-eb71-4803-a43c-962363942a88",
      "name": "「 Past 」",
      "title": "「 과거형 」",
      "desc": "과거 시제로 서술합니다."
    },
    {
      "id": "6dfb2660-c42d-4068-a696-eb52cf8618c0",
      "name": "! Force Formatting !",
      "title": "! 서식 강제 !",
      "desc": "모델이 서식 선택을 계속 무시하거나 대화 중간에 서식을 바꿨을 때 2~3개 메시지 동안만 켜고, 서식이 잡히면 끄세요. 기본으로 꺼져 있습니다."
    },
    {
      "id": "3307748d-b371-4b03-9cf3-d3cac99b8c7c",
      "name": "「 With Asterisks 」",
      "title": "「 별표로 감싸기 」",
      "desc": "서술을 *별표*로 감쌉니다."
    },
    {
      "id": "1fa7c9ad-5872-45fb-969e-8298aa26461b",
      "name": "🔻PICK: (+18) NSFW🔻",
      "title": "🔻택1: (19금) NSFW🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "bbd6e522-4e23-45d8-9f61-4b89996b4dc5",
      "name": "🔻PICK: NARRATION🔻",
      "title": "🔻택1: 서술 문체🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "88f5ab8f-682f-4450-92f6-1b7c8b4d7536",
      "name": "🔻PICK: DIALOGUE🔻",
      "title": "🔻택1: 대사 스타일🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "0d5603cc-0ce7-4244-9f2b-909d4f281dac",
      "name": "🔻PICK: LENGTH🔻",
      "title": "🔻택1: 답변 길이🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "f04a8c26-3123-4c37-bdfb-25d2eb80279d",
      "name": "🔻PICK: THOUGHTS🔻",
      "title": "🔻택1: 속마음🔻",
      "desc": "캐릭터의 속마음을 보이거나 숨기는 방식을 고릅니다."
    },
    {
      "id": "66943461-0379-47f4-b827-5b0702093fbe",
      "name": "🔻PICK: TENSE🔻",
      "title": "🔻택1: 시제🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "338c942b-8ec5-4e64-8a60-a31128892474",
      "name": "🔻PICK: ASTERISKS🔻",
      "title": "🔻택1: 별표(*)🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "cf4338d3-1098-47f2-9be9-64c7899f173b",
      "name": "🔻PICK: {{USER}} POV🔻",
      "title": "🔻택1: {{user}} 시점🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "403539e4-e530-43a1-be30-5d5bd33d4d5e",
      "name": "| Status |",
      "title": "| 상태창 |",
      "desc": "장면 안팎의 주요 캐릭터를 추적합니다. 꾸밈만이 아니라, 특히 캐릭터가 여럿인 장면에서 모델의 일관성을 높여 줍니다. 기본으로 켜져 있습니다."
    },
    {
      "id": "a3c64aa2-de6f-4ace-987d-1eca5c4ffdb7",
      "name": "「 You control {{user}} 」",
      "title": "「 {{user}}는 내가 조종 」",
      "desc": "{{user}}는 나만 조종하고 모델은 조종하지 않습니다. 기본 선택."
    },
    {
      "id": "16b32808-e943-45ad-b65e-1de52f2efc3c",
      "name": "「 Choices List 」",
      "title": "「 선택지 목록 」",
      "desc": "선택형 어드벤처(CYOA). 번호를 고르면 모델이 내 대사까지 포함해 이야기를 진행합니다. {{user}} 1인칭 시점은 이것이나 '연출가 모드'를 켜야 쓸 수 있습니다."
    },
    {
      "id": "30d2dd79-5144-4b66-9d49-3b8a0fe61a3a",
      "name": "「 Director 」",
      "title": "「 연출가 모드 」",
      "desc": "내 입력을 이야기 진행 지시로 받아들입니다. 롤플레이 대신 원하는 전개만 적으면 되고, 내 대사도 모델이 씁니다."
    },
    {
      "id": "35de6384-3978-4b0d-8f0b-cabb5f0060fe",
      "name": "🔻PICK: AGENCY🔻",
      "title": "🔻택1: 주도권🔻",
      "desc": "누가 {{user}}를 움직일지 정합니다. 아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "d0c94485-2128-48a1-9503-326d4cc84a0c",
      "name": "! Macro Cleaner !",
      "title": "! 매크로 정리 !",
      "desc": "프리셋이 쓰는 변수 매크로를 매 턴 초기화합니다. 켜 두세요."
    },
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "| Response Directives ⚠️ |",
      "title": "| 응답 지침 ⚠️ |",
      "desc": "서술 서식과 응답 구조를 하나로 묶은 핵심 모듈입니다. 반드시 켜 두세요!"
    },
    {
      "id": "b009bd1d-d8fc-4cb8-be4a-a09c6596de35",
      "name": "| Reinforcement |",
      "title": "| 지시 강화 |",
      "desc": "이 프리셋의 지시를 다시 강조합니다."
    },
    {
      "id": "a3210be7-945f-4ebc-b3fe-3433d51e7479",
      "name": "! Momentum Engine Router !",
      "title": "! 모멘텀 엔진 라우터 !",
      "desc": "매크로가 무작위로 고른 경로를 적용해 이야기를 그쪽으로 이끕니다. '모멘텀 엔진'을 켰다면 반드시 켜 두세요."
    },
    {
      "id": "f355912c-d2a8-4823-85e9-cbb01820af83",
      "name": "! Scene Plan !",
      "title": "! 장면 계획 !",
      "desc": "이야기 앞에 짧은 장면 계획을 출력합니다. 일관성 유지에 꼭 필요합니다. 추론은 끄거나(안 되면 낮게) 두고 쓰세요. 기본으로 켜져 있습니다."
    },
    {
      "id": "d8a18c74-1f53-4d63-b0e1-81e8d9cf5004",
      "name": "🚨🚨 DANGER ZONE 🚨🚨",
      "title": "🚨🚨 위험 구역 🚨🚨",
      "desc": "아래 항목은 함부로 끄거나 옮기지 마세요."
    },
    {
      "id": "d8a18c74-1f53-4d63-b0e1-81e8d9cf5005",
      "name": "! Warning System ! ⚠️",
      "title": "! 경고 시스템 ! ⚠️",
      "desc": "보호된 모듈이 꺼졌거나 위치가 바뀌었을 때, 또는 매크로에 문제가 있을 때 답변 위에 경고를 띄웁니다. 일부러 그렇게 쓰는 게 아니면 켜 두세요."
    },
    {
      "id": "8bd749ce-e02c-4de5-bb1d-f44c190e98ed",
      "name": "! Change Language !",
      "title": "! 출력 언어 변경 !",
      "desc": "기본으로 꺼져 있습니다. 쓰려면 본문의 \"English\"를 원하는 언어(예: Korean)로 바꾸고 켜세요."
    },
    {
      "id": "9d42c8d7-18df-43bc-8f82-d04b6c4d8824",
      "name": "❗Sheet XML tag open❗",
      "title": "❗시트 XML 태그 열기❗",
      "desc": "켜 두세요. 실리태번 기본 시트(캐릭터 정보) 구역을 <sheet> 태그로 감쌉니다."
    },
    {
      "id": "96ed6099-8646-4415-8bb6-25d289423cf5",
      "name": "❗Sheet XML tag close❗",
      "title": "❗시트 XML 태그 닫기❗",
      "desc": "켜 두세요. <sheet> 감싸기를 닫습니다."
    },
    {
      "id": "b5ee8699-3c94-4f5d-9ef4-8af4c4fac44d",
      "name": "❗Story XML tag open❗",
      "title": "❗스토리 XML 태그 열기❗",
      "desc": "켜 두세요. 대화 기록 구역을 <story_development> 태그로 감쌉니다."
    },
    {
      "id": "6c104677-4b8e-4745-bf29-031e3584c96c",
      "name": "❗Story XML tag close❗",
      "title": "❗스토리 XML 태그 닫기❗",
      "desc": "켜 두세요. 스토리 감싸기를 닫습니다."
    },
    {
      "id": "b6d10f84-5786-4453-9330-5a4248b5acd0",
      "name": "🔻PICK: CHAR POV🔻",
      "title": "🔻택1: 캐릭터 시점🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "7805eb87-f271-4308-96e5-1343f9a2d1ba",
      "name": "「 3rd Person 」",
      "title": "「 3인칭 (캐릭터) 」",
      "desc": "캐릭터를 3인칭으로 서술합니다. 예: 그녀가 말한다. 기본 선택."
    },
    {
      "id": "5a8d0204-d0df-4773-b501-23f0a2552769",
      "name": "「 1st Person 」",
      "title": "「 1인칭 (캐릭터) 」",
      "desc": "캐릭터를 1인칭으로 서술합니다. 예: 나는 말한다. 실험적 기능이라 첫 메시지에 캐릭터가 여럿이면 모델이 헷갈릴 수 있습니다."
    },
    {
      "id": "64aa9554-07c9-4c75-ad50-d3efc7a10224",
      "name": "🔹🔹USER UTILITY🔹🔹",
      "title": "🔹🔹사용자 도구🔹🔹",
      "desc": "필요할 때만 켜는 사용자용 도구 구역입니다."
    },
    {
      "id": "35cc3b43-9687-494e-b89c-0cff95a7b528",
      "name": "🔹🔹CORE🔹🔹",
      "title": "🔹🔹핵심🔹🔹",
      "desc": "핵심 설정 구역입니다."
    },
    {
      "id": "fa5af938-28f9-448f-b2d7-7d12b1a943b1",
      "name": "🔹🔹SYSTEM UTILITY🔹🔹",
      "title": "🔹🔹시스템 도구🔹🔹",
      "desc": "프리셋이 내부적으로 쓰는 도구 구역입니다."
    },
    {
      "id": "410a43c2-3673-43d7-be4b-ad14bcd6fbab",
      "name": "🔹🔹ADD-ONS🔹🔹",
      "title": "🔹🔹부가 기능🔹🔹",
      "desc": "트래커·상태창 같은 부가 기능 구역입니다."
    },
    {
      "id": "dc88ac84-76b2-4f58-b039-cb6f9ff9c13f",
      "name": "🔹🔹STORY🔹🔹",
      "title": "🔹🔹스토리🔹🔹",
      "desc": "이야기 진행 방식을 정하는 구역입니다."
    },
    {
      "id": "4fb5d6d6-b652-45a7-8558-c2b5eef6dd3b",
      "name": "🔹🔹VISUALS🔹🔹",
      "title": "🔹🔹시각 효과🔹🔹",
      "desc": "답변의 시각적 꾸밈을 정하는 구역입니다."
    },
    {
      "id": "f7e1c2d3-a4b5-46c7-89d0-e1f2a3b4c5d6",
      "name": "🔹🔹FORMATTING🔹🔹",
      "title": "🔹🔹서식🔹🔹",
      "desc": "답변 서식을 정하는 구역입니다."
    },
    {
      "id": "465594f9-c78d-4eae-b6e6-77488f88bb9b",
      "name": "🔹🔹CONSTRAINTS🔹🔹",
      "title": "🔹🔹제약 조건🔹🔹",
      "desc": "캐릭터와 서술을 제한하는 규칙 구역입니다."
    },
    {
      "id": "afd0849b-c934-44e7-9b34-d42d160bef87",
      "name": "🔹🔹 CARD & LORE 🔹🔹",
      "title": "🔹🔹 카드 & 설정 🔹🔹",
      "desc": "캐릭터 카드와 로어북이 들어가는 구역입니다."
    },
    {
      "id": "7f5495fd-d06b-41be-ab28-5962a64456b1",
      "name": "! Anti-Overthink ! (FALLBACK)",
      "title": "! 과도한 생각 방지 ! (대체용)",
      "desc": "특히 Kimi에서 모델의 과한 생각을 줄여 줄 수 있습니다(효과가 없을 수도 있음). 기본으로 꺼져 있습니다."
    },
    {
      "id": "a9b7c6d5-e4f3-4210-9abc-76543210fedc",
      "name": "🔻PICK: REASONING🔻",
      "title": "🔻택1: 추론🔻",
      "desc": "아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "7ac8a1e7-5cf6-4a41-8a48-f42263a180c6",
      "name": "! Custom Instructions !",
      "title": "! 사용자 지시 !",
      "desc": "본문에 원하는 지시나 OOC 명령을 적으면 매 턴 모델에게 보냅니다."
    },
    {
      "id": "7eb033d6-2036-4c5a-9b3a-d22d1d6da7b8",
      "name": "| Psychological States |",
      "title": "| 심리 상태 |",
      "desc": "장면에 있는 {{user}} 외 주요 캐릭터의 현재 내면 상태와 동기를 추적합니다. 선택 사항이며 기본으로 꺼져 있습니다."
    },
    {
      "id": "b2e7f4a1-0c93-4d6e-8f25-7193ab4c6d80",
      "name": "🔹🔹NARRATIVE STYLES🔹🔹",
      "title": "🔹🔹서사 분위기🔹🔹",
      "desc": "여러 개를 함께 켤 수 있는 분위기 옵션입니다. 모두 카드·테마·장르는 그대로 유지합니다."
    },
    {
      "id": "c4a8e2f7-1b65-4d90-9c31-7285be6a0f42",
      "name": "「 Card-Default 」",
      "title": "「 카드 기본 (분위기) 」",
      "desc": "캐릭터 카드 본래의 서사 분위기를 유지하고 추가 지시를 넣지 않습니다. 분위기 옵션이 필요 없으면 이것만 켜 두세요."
    },
    {
      "id": "d6f1a9c3-8b47-4e20-a562-9371cd5f8a04",
      "name": "「 Comedic 」",
      "title": "「 코믹 」",
      "desc": "코믹한 분위기를 더합니다. '드라마틱'과 함께 켜면 '드라메디'가 됩니다."
    },
    {
      "id": "ddaac217-1380-4152-9bcd-d1092c5deadf",
      "name": "「Romantic Comedy」",
      "title": "「 로맨틱 코미디 」",
      "desc": "로맨틱 코미디 분위기를 더합니다. 설렘과 어색함, 티격태격하는 대화와 엇갈린 타이밍으로 웃음과 다정함을 함께 만듭니다. 카드·장르·기존 관계는 그대로 따르고, '코믹'·'드라마틱'과 함께 켤 수 있습니다. '캐릭터' 프롬프트와 관련됩니다."
    },
    {
      "id": "e8b3c7a2-5d19-4f64-806e-2149af7c3b58",
      "name": "「 Dramatic 」",
      "title": "「 드라마틱 」",
      "desc": "드라마틱한 분위기를 더합니다. '코믹'과 함께 켜면 '드라메디'가 됩니다."
    },
    {
      "id": "f9c4d8b1-6e20-4a75-917f-3250ba8d4c69",
      "name": "「 Epic 」",
      "title": "「 서사시 」",
      "desc": "웅장한 서사시 분위기를 더합니다."
    },
    {
      "id": "a1d5e9c2-7f34-4b86-9280-4361cb9e5d70",
      "name": "「 Gothic 」",
      "title": "「 고딕 」",
      "desc": "고딕 분위기를 더합니다."
    },
    {
      "id": "b3e6f0d4-8a25-4c97-0391-5472dc0f6e81",
      "name": "「 Dreamy 」",
      "title": "「 몽환적 」",
      "desc": "몽환적인 분위기를 더합니다."
    },
    {
      "id": "c5f7a1e6-9b36-4d08-1402-6583ed1a7f92",
      "name": "「 Surrealist 」",
      "title": "「 초현실 」",
      "desc": "초현실적인 분위기를 더합니다."
    },
    {
      "id": "d7a2b8f0-3c47-4e19-2513-7694fe2b8a05",
      "name": "「 Grimdark 」",
      "title": "「 그림다크 」",
      "desc": "암울하고 가혹한 분위기를 더합니다. '밝고 경쾌'와 함께 켜면 '그림브라이트'가 됩니다."
    },
    {
      "id": "e9c3d9a1-4f58-4026-3624-8705af3c9b16",
      "name": "「 Lighthearted 」",
      "title": "「 밝고 경쾌 」",
      "desc": "밝고 가벼운 분위기를 더합니다. '그림다크'와 함께 켜면 '그림브라이트'가 됩니다."
    },
    {
      "id": "c0a4b8e1-7d2f-4b6c-9a30-5e1f2d8c7b64",
      "name": "🔻PICK: COMBAT WRITING🔻",
      "title": "🔻택1: 전투 묘사🔻",
      "desc": "선택 사항인 전투 장면 가이드입니다. 전투가 아닐 때는 모두 꺼서 토큰을 아끼세요."
    },
    {
      "id": "d1b5c9f2-8e30-4c7d-a941-6f2e3a9d8c75",
      "name": "「 Dynamic 」",
      "title": "「 역동적 」",
      "desc": "기본 전투 묘사(이 구역의 기본 선택). 전투가 아닐 때는 꺼서 토큰을 아끼세요."
    },
    {
      "id": "e2c6d0a3-9f41-4d8e-b052-7a3f4b0e9d86",
      "name": "「 Rapid 」",
      "title": "「 빠르게 」",
      "desc": "빠른 전투 묘사. 전투가 아닐 때는 끄세요."
    },
    {
      "id": "f3d7e1b4-a052-4e9f-8c63-8b4c5a1f0e97",
      "name": "「 Extended 」",
      "title": "「 길게 이어서 」",
      "desc": "길게 이어지는 전투 묘사. 전투가 아닐 때는 끄세요."
    },
    {
      "id": "1c352c54-a636-454f-a058-712ddc3983cf",
      "name": "「 Input Improver 」",
      "title": "「 입력 다듬기 」",
      "desc": "모델이 첫 문단에서 내 글을 다듬어 줍니다. 그 뒤로는 {{user}}를 나만 조종합니다."
    },
    {
      "id": "fb7942e3-d99b-48a6-a195-bf2a1811ae50",
      "name": "🔹DEUS EX MACHINA V2.5🔹",
      "title": "🔹데우스 엑스 마키나 V2.5🔹",
      "desc": "프리셋 시작 표시입니다."
    },
    {
      "id": "86373739-207c-44d9-8af4-147312c4724a",
      "name": "! Thinking ! (FALLBACK)",
      "title": "! 생각하기 ! (대체용)",
      "desc": "추론이 항상 켜지는 모델(예: GLM 5.3)용 대체 옵션입니다. '장면 계획'을 끄고 이것을 켜세요."
    },
    {
      "id": "a7c1d2e3-f4b5-46a7-8901-b2c3d4e5f607",
      "name": "🔻PICK: WORLD-BUILDING🔻",
      "title": "🔻택1: 세계관 구축🔻",
      "desc": "선택 사항인 세계관 구축 가이드입니다. 아래 옵션 중 하나만 켜세요."
    },
    {
      "id": "b8d2e3f4-a5c6-47b8-9012-c3d4e5f60718",
      "name": "「 Card-Default 」",
      "title": "「 카드 기본 (세계관) 」",
      "desc": "시트(카드)에 있는 세계관만 따르고 추가 지시를 넣지 않습니다. 세계관 가이드가 필요 없으면 이것만 켜 두세요."
    },
    {
      "id": "c9e3f4a5-b6d7-48c9-0123-d4e5f6071829",
      "name": "「 Contained 」",
      "title": "「 카드 충실 」",
      "desc": "시트에 충실하게, 꼭 필요한 부분만 덧붙이는 세계관 구축."
    },
    {
      "id": "d0f4a5b6-c7e8-49d0-1234-e5f60718293a",
      "name": "「 Expanded 」",
      "title": "「 확장 」",
      "desc": "시트를 넘어 넓고 자세하게 세계관을 구축합니다."
    },
    {
      "id": "5415c972-4ec8-46de-8d29-1e3bce1881d7",
      "name": "「 Eerie 」",
      "title": "「 기괴한 」",
      "desc": "으스스하고 기이한 분위기를 더합니다."
    },
    {
      "id": "df9f15ba-a8e7-4de2-91fb-01c7cd5d33d5",
      "name": "⚠️ README Model Setup ⚠️",
      "title": "⚠️ 읽어 주세요: 모델 설정 ⚠️",
      "desc": "모델별 권장 설정과 2.5 사용법이 정리된 안내입니다. 구체적인 값은 본문을 확인하세요."
    },
    {
      "id": "668ed810-9070-44cd-830b-3f295fb58c03",
      "name": "「 Nothing Explicit 」",
      "title": "「 노골적 묘사 없음 」",
      "desc": "노골적인 성적 내용을 원하지 않을 때 켜세요. 그런 장면이 나오면 건너뛰거나 수위 없이 요약하고, 대체로 그쪽으로 흘러가지 않습니다."
    },
    {
      "id": "8fa1ee7c-6172-4a83-8256-82b94eaa45b1",
      "name": "! Fandom !",
      "title": "! 원작 설정 !",
      "desc": "기본으로 꺼져 있습니다. 쓰려면 본문의 \"Series name\"을 원하는 작품 이름(예: 주술회전)으로 바꾸고 켜세요. 로어북과 함께 쓰는 걸 권장합니다."
    },
    {
      "id": "471b7f8d-cea6-4768-91ad-9683ab5347d2",
      "name": "| Main Statements ⚠️ |",
      "title": "| 기본 선언 ⚠️ |",
      "desc": "롤플레이·공동 창작의 기본 규칙을 정합니다. 반드시 켜 두세요!"
    },
    {
      "id": "6537edf0-8331-4e7e-841a-86655f5a5a9c",
      "name": "「 Realistic Smut 」",
      "title": "「 현실적인 수위 」",
      "desc": "현실적인 친밀 장면. 기본으로 꺼져 있지만 이 구역의 기본 선택입니다."
    },
    {
      "id": "d6e649df-213d-49bc-81fe-cc17c8e73491",
      "name": "「 Cinematic 」",
      "title": "「 영화적 」",
      "desc": "창밖을 보듯 장면을 보여 주는 영화 같은 서술. 꾸밈보다 묘사 대상에 집중합니다. 기본 선택."
    },
    {
      "id": "aad64d82-04b7-4b0f-bc17-2d0d78248138",
      "name": "{{img_inprompt}}",
      "title": "이미지 태그 넣기 ({{img_inprompt}})",
      "desc": "캐릭터 에셋 확장용 지시입니다. 답변마다 문단이 끝난 자리에 {{img::키워드.확장자}} 형식의 이미지 태그를 최대 2개 넣게 합니다."
    },
    {
      "id": "f6f8a299-42dc-472d-ba60-d176e910a419",
      "name": "English「日本語」",
      "title": "영어「일본어」",
      "desc": "서술은 영어, 대사(따옴표나 「」 안)는 일본어로 쓰게 하는 이중 언어 설정입니다. 본문의 setvar 두 줄에서 언어를 바꿀 수 있습니다."
    },
    {
      "id": "246171d7-7d6f-46b4-842a-2f75ee967222",
      "name": "「 Romance」",
      "title": "「 로맨스 」",
      "desc": "로맨틱한 분위기를 더합니다. 머무는 시선, 감각의 자각, 말하지 못한 그리움, 가까운 거리, 드러난 약점으로 감정의 긴장을 높입니다. '캐릭터' 프롬프트와 관련됩니다."
    },
    {
      "id": "8ae22958-9f1b-4a5a-9aae-d13e08b7e7a9",
      "name": "한국어\"한국어\"",
      "title": "한국어\"한국어\"",
      "desc": "서술과 대사를 모두 한국어로 씁니다. 대사는 큰따옴표 안에 쓰고 다른 언어를 섞지 않습니다."
    },
    {
      "id": "63890619-5c52-46a0-aa68-3c166c3226bb",
      "name": "English\"한국어\"",
      "title": "영어\"한국어\"",
      "desc": "서술과 행동 묘사는 영어, 큰따옴표 안의 대사는 한국어로 씁니다. 같은 줄에서 언어를 섞지 않습니다."
    },
    {
      "id": "71f7c910-039c-451b-8463-2dcf33f44208",
      "name": "日本語「日本語」",
      "title": "일본어「일본어」",
      "desc": "서술과 대사를 모두 일본어로 씁니다. 대사에는 「」를 사용할 수 있으며 다른 언어를 섞지 않습니다."
    },
    {
      "id": "e7b4c2d1-9f86-4a53-b7c0-2d1e8f9a6b41",
      "name": "| Expressive Dialogue |",
      "title": "| 감정이 드러나는 대사 |",
      "desc": "대사의 감정에 맞춰 제한적으로 움직임과 색 변화를 붙입니다. 대사 색상과 함께 사용할 수 있습니다."
    },
    {
      "id": "9f4e7a1c-2b63-4d80-a5e7-91c3f6b8d204",
      "name": "| Plotlines |",
      "title": "| 줄거리 흐름 |",
      "desc": "이미 진행된 주요 이야기 단계와 현재 움직이는 보조 줄거리를 정리하는 선택 모듈입니다."
    },
    {
      "id": "81ecd7e2-a79c-4daa-bc41-364ab27d3ebe",
      "name": "🔹🔹NARRATIVE MODE🔹🔹",
      "title": "🔹🔹서사 모드🔹🔹",
      "desc": "서사 모드를 고르는 구역입니다."
    }
  ],
  "regex": [
    {
      "id": "a17c9d42-6e53-4fb8-b281-0d74e96c5a31",
      "name": "DEM - @Status UI - Collapsed (Disable for expanded)",
      "title": "DEM - @상태창 UI - 접힌 버전 (펼친 버전을 쓰려면 끄기)",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000001",
      "name": "DEM - Convert legacy @Momentum Engine footer labels",
      "title": "DEM - 옛 @모멘텀 엔진 목록 번호 변환",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "acb16b98-2fb1-4e42-a48d-cbd12b4936e2",
      "name": "DEM - Convert legacy @Momentum Engine #1 (Primary + Fallback)",
      "title": "DEM - 옛 @모멘텀 엔진 #1 변환 (주 + 예비 경로)",
      "desc": "경로 표시의 주 경로(Primary)와 예비 경로(Fallback) 번호 1을 A로 바꿉니다. 이전 버전 프리셋으로 쓴 채팅용이며, 최근 메시지 3개의 화면과 모델에게 보내는 내용만 바뀌고 채팅 파일은 그대로입니다."
    },
    {
      "id": "6ed42e16-ced5-4ef6-a010-4e6dfff3ad47",
      "name": "DEM - Convert legacy @Momentum Engine #2 (Primary + Fallback)",
      "title": "DEM - 옛 @모멘텀 엔진 #2 변환 (주 + 예비 경로)",
      "desc": "경로 표시의 주 경로(Primary)와 예비 경로(Fallback) 번호 2을 B로 바꿉니다. 이전 버전 프리셋으로 쓴 채팅용이며, 최근 메시지 3개의 화면과 모델에게 보내는 내용만 바뀌고 채팅 파일은 그대로입니다."
    },
    {
      "id": "5e0efced-3b63-4d33-89f9-aaeafedb845a",
      "name": "DEM - Convert legacy @Momentum Engine #3 (Primary + Fallback)",
      "title": "DEM - 옛 @모멘텀 엔진 #3 변환 (주 + 예비 경로)",
      "desc": "경로 표시의 주 경로(Primary)와 예비 경로(Fallback) 번호 3을 C로 바꿉니다. 이전 버전 프리셋으로 쓴 채팅용이며, 최근 메시지 3개의 화면과 모델에게 보내는 내용만 바뀌고 채팅 파일은 그대로입니다."
    },
    {
      "id": "dfe27c7a-f66f-4376-8683-9a34a9495deb",
      "name": "DEM - Convert legacy @Momentum Engine #4 (Primary + Fallback)",
      "title": "DEM - 옛 @모멘텀 엔진 #4 변환 (주 + 예비 경로)",
      "desc": "경로 표시의 주 경로(Primary)와 예비 경로(Fallback) 번호 4을 D로 바꿉니다. 이전 버전 프리셋으로 쓴 채팅용이며, 최근 메시지 3개의 화면과 모델에게 보내는 내용만 바뀌고 채팅 파일은 그대로입니다."
    },
    {
      "id": "4f938e21-ef1c-46c4-8cfb-8f7d7bbd5224",
      "name": "DEM - Remove older ! Scene Plan ! from context",
      "title": "DEM - 이전 ! 장면 계획 ! 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 1 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "75bf5197-a878-45c5-b6ee-67dc0f74b2e9",
      "name": "DEM - Remove horizontal rule",
      "title": "DEM - 가로줄 없애기",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다."
    },
    {
      "id": "1ed4a0d8-1f3d-4d1b-9cf5-625d55f62842",
      "name": "DEM - Remove older @Dialogue Color from context",
      "title": "DEM - 이전 @대사 색상 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 6 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "3f2c7a91-6d4e-4b8f-a205-9c1e7d3b6f80",
      "name": "DEM - Remove older inline CSS @Dialogue Color from context",
      "title": "DEM - 이전 인라인 CSS @대사 색상 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 10 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "8c7e2f41-4a2d-4a14-9c6e-7b8d3f5e2a10",
      "name": "DEM - Render inline CSS @Dialogue Color as legacy font",
      "title": "DEM - 인라인 CSS @대사 색상을 font 태그로 표시",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "50405a53-82e1-4443-9db5-a928978bea06",
      "name": "DEM - Remove older @CYOA / @Momentum Engine / styles from context",
      "title": "DEM - 이전 @선택지 목록 / @모멘텀 엔진 / 스타일 컨텍스트에서 빼기",
      "desc": "최근 메시지 2개를 뺀 이전 메시지의 선택지 목록(<cyoa>), 모멘텀 엔진 블록(<momentum>), 시각적 연출용 CSS 블록(<style>)을 모델에게 보내는 내용에서 지워 토큰을 아낍니다. 화면과 채팅 파일은 그대로입니다."
    },
    {
      "id": "a1a2d449-2b65-41e5-904b-8f8a1e716659",
      "name": "DEM - Remove older @Status / @Story Threads / @Psychological States from context",
      "title": "DEM - 이전 @상태창 / @스토리 떡밥 / @심리 상태 컨텍스트에서 빼기",
      "desc": "최근 메시지 6개를 뺀 이전 메시지의 상태창(<status>), 스토리 떡밥(<threads>), 심리 상태(<psychological_states>)를 모델에게 보내는 내용에서 지워 토큰을 아낍니다. 화면과 채팅 파일은 그대로입니다."
    },
    {
      "id": "7be09711-4a82-4635-9ef4-5de5509e7f67",
      "name": "DEM - Remove older @Conflict from context",
      "title": "DEM - 이전 @갈등 블록 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 4 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "62d9b4de-89e1-4af2-ac87-5a69f948bd0a",
      "name": "DEM - Hide @True Thoughts",
      "title": "DEM - @속마음 숨기기",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "ae67ca6c-a6f6-4961-86a6-22e1a50e581e",
      "name": "DEM - Show @True Thoughts",
      "title": "DEM - @속마음 보이기",
      "desc": "캐릭터 속마음(<true_thoughts>) 블록의 태그를 벗기고 내용을 기울임꼴(*…*)로 보여 줍니다. 모델에게는 태그 그대로 보내고 채팅 파일도 바뀌지 않습니다. 위 '@속마음 숨기기'와 함께 켜지 마세요. (화면 표시만 바뀝니다)"
    },
    {
      "id": "51d87b9e-a447-46e8-98cb-d2103825f1c7",
      "name": "DEM - Normalize @Momentum Engine labels",
      "title": "DEM - @모멘텀 엔진 번호 정리",
      "desc": "답변을 처리할 때 적용되어 저장되는 내용에도 영향을 줍니다."
    },
    {
      "id": "e8d4d6af-ae80-4bd0-8287-29ca8995cadf",
      "name": "DEM - Seal @Momentum Engine route",
      "title": "DEM - @모멘텀 엔진 경로 봉인",
      "desc": "답변을 처리할 때 적용되어 저장되는 내용에도 영향을 줍니다."
    },
    {
      "id": "5b6e7f80-91a2-43b4-c5d6-e7f8091a2b3c",
      "name": "DEM - ! Scene Plan ! row scaffolding",
      "title": "DEM - ! 장면 계획 ! 줄 틀 만들기",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5230",
      "name": "DEM - ! Scene Plan ! classify inputs",
      "title": "DEM - ! 장면 계획 ! 분류: 입력",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5231",
      "name": "DEM - ! Scene Plan ! classify constraints",
      "title": "DEM - ! 장면 계획 ! 분류: 제약",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5232",
      "name": "DEM - ! Scene Plan ! classify craft",
      "title": "DEM - ! 장면 계획 ! 분류: 작법",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5233",
      "name": "DEM - ! Scene Plan ! classify plan",
      "title": "DEM - ! 장면 계획 ! 분류: 계획",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5240",
      "name": "DEM - ! Scene Plan ! content Markdown",
      "title": "DEM - ! 장면 계획 ! 내용 마크다운",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5241",
      "name": "DEM - ! Scene Plan ! phase Inputs",
      "title": "DEM - ! 장면 계획 ! 구역 제목: 입력",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5242",
      "name": "DEM - ! Scene Plan ! phase Constraints",
      "title": "DEM - ! 장면 계획 ! 구역 제목: 제약",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5243",
      "name": "DEM - ! Scene Plan ! phase Craft",
      "title": "DEM - ! 장면 계획 ! 구역 제목: 작법",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5244",
      "name": "DEM - ! Scene Plan ! phase Plan",
      "title": "DEM - ! 장면 계획 ! 구역 제목: 계획",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3f22c84a-d99d-456d-a4b8-00ca3c0a5224",
      "name": "DEM - ! Scene Plan ! UI",
      "title": "DEM - ! 장면 계획 ! UI",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "7d864648-1b97-4122-a33c-c8806af11f07",
      "name": "DEM - @Tracker UI",
      "title": "DEM - @트래커 UI",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "b50e17f1-5ecb-43f6-bf57-ddeef9b8fc1c",
      "name": "DEM - @Tracker UI (recovery)",
      "title": "DEM - @트래커 UI (복구용)",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "3fe8f199-c17b-4812-aa8a-6294eea1244d",
      "name": "DEM - @CYOA UI",
      "title": "DEM - @선택지 목록 UI",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "8821ac4d-354c-4e85-9d5f-82702ac82fbd",
      "name": "DEM - @Status UI",
      "title": "DEM - @상태창 UI",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "c3703be8-98b3-4b9d-91b3-92e0852b5430",
      "name": "DEM - @Status UI - Char. w/ relationship",
      "title": "DEM - @상태창 UI - 관계 있는 캐릭터",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "9fff3360-9bb4-4fec-881e-8efe0e2e64b2",
      "name": "DEM - @Status UI - {{user}}",
      "title": "DEM - @상태창 UI - {{user}}",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "a1f2e3d4-c5b6-47a8-9b0c-1d2e3f4a5b6c",
      "name": "DEM - @Story Threads tag sort rows",
      "title": "DEM - @스토리 떡밥 태그 정렬 줄",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "0c447ced-0fc1-4711-8920-ccfd14dd207e",
      "name": "DEM - @Story Threads UI",
      "title": "DEM - @스토리 떡밥 UI",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "b7a6c5d4-e3f2-4180-9a7b-6c5d4e3f2a10",
      "name": "DEM - @Psychological States UI",
      "title": "DEM - @심리 상태 UI",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "c8b7a6d5-e4f3-4291-0b8c-7d6e5f4a3b21",
      "name": "DEM - @Psychological States UI - Character",
      "title": "DEM - @심리 상태 UI - 캐릭터",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d43f98c6-6e35-4d65-9599-b7a8f749df48",
      "name": "DEM - @Momentum Engine UI",
      "title": "DEM - @모멘텀 엔진 UI",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "750f3969-3516-4143-8a3c-d3188403aefd",
      "name": "DEM - @Conflict UI",
      "title": "DEM - @갈등 블록 UI",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000110",
      "name": "DEM - @Tracker UI fallback",
      "title": "DEM - @트래커 UI 대체용",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000111",
      "name": "DEM - @CYOA UI fallback",
      "title": "DEM - @선택지 목록 UI 대체용",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000112",
      "name": "DEM - @Status UI fallback",
      "title": "DEM - @상태창 UI 대체용",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000113",
      "name": "DEM - @Story Threads UI fallback",
      "title": "DEM - @스토리 떡밥 UI 대체용",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000114",
      "name": "DEM - @Psychological States UI fallback",
      "title": "DEM - @심리 상태 UI 대체용",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000115",
      "name": "DEM - @Momentum Engine UI fallback",
      "title": "DEM - @모멘텀 엔진 UI 대체용",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000116",
      "name": "DEM - @Conflict UI fallback",
      "title": "DEM - @갈등 블록 UI 대체용",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000117",
      "name": "DEM - ! Scene Plan ! UI fallback",
      "title": "DEM - ! 장면 계획 ! UI 대체용",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "66c3595e-0779-4dd6-a4d6-99af91469ede",
      "name": "DEM - UI module accents",
      "title": "DEM - UI 모듈 강조색",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "b1b0ea73-9450-4505-94d2-334f5467b422",
      "name": "DEM - [Current] tag appearance ",
      "title": "DEM - [현재] 태그 모양",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "c2fef43c-53b6-4700-9c4e-26d0f4527a18",
      "name": "DEM - [Unresolved] tag appearance",
      "title": "DEM - [미해결] 태그 모양",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "92afc933-3ee5-4b1c-81bb-0d4e5118e8f7",
      "name": "DEM - [Possible] tag appearance ",
      "title": "DEM - [가능] 태그 모양",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "7d6b4f7b-539a-4d84-b03d-e2eb1c7c8f91",
      "name": "DEM - [Seed] tag appearance",
      "title": "DEM - [씨앗] 태그 모양",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000002",
      "name": "DEM - Convert legacy @Momentum Engine Primary #1",
      "title": "DEM - 옛 형식 변환 @모멘텀 엔진 주 경로 #1",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000003",
      "name": "DEM - Convert legacy @Momentum Engine Primary #2",
      "title": "DEM - 옛 형식 변환 @모멘텀 엔진 주 경로 #2",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000004",
      "name": "DEM - Convert legacy @Momentum Engine Primary #3",
      "title": "DEM - 옛 형식 변환 @모멘텀 엔진 주 경로 #3",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000005",
      "name": "DEM - Convert legacy @Momentum Engine Primary #4",
      "title": "DEM - 옛 형식 변환 @모멘텀 엔진 주 경로 #4",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000006",
      "name": "DEM - Convert legacy @Momentum Engine Fallback #1",
      "title": "DEM - 옛 형식 변환 @모멘텀 엔진 예비 경로 #1",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000007",
      "name": "DEM - Convert legacy @Momentum Engine Fallback #2",
      "title": "DEM - 옛 형식 변환 @모멘텀 엔진 예비 경로 #2",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000008",
      "name": "DEM - Convert legacy @Momentum Engine Fallback #3",
      "title": "DEM - 옛 형식 변환 @모멘텀 엔진 예비 경로 #3",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000009",
      "name": "DEM - Convert legacy @Momentum Engine Fallback #4",
      "title": "DEM - 옛 형식 변환 @모멘텀 엔진 예비 경로 #4",
      "desc": "화면과 모델에게 보내는 내용에 적용합니다. 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "d74c0001-0000-4000-8000-000000000010",
      "name": "DEM - Redact unselected @Momentum Engine routes from context",
      "title": "DEM - 선택하지 않은 경로 가리기 @모멘텀 엔진 경로 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 2 이하인 최근 메시지에 적용합니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000078",
      "name": "DEM - Remove older Expressive Dialogue tags from context",
      "title": "DEM - 이전 감정 대사 태그 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 6 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "8c7e2f41-4a2d-4a14-9c6e-7b8d3f5e2a11",
      "name": "DEM - Render bare hex @Dialogue Color as legacy font",
      "title": "DEM - 표시 색상 코드 @대사 색상 기존 font 태그로",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "71f0e5b8-9513-4aac-8e63-56582279befc",
      "name": "DEM - Remove older @Visual Storytelling styles from context",
      "title": "DEM - 이전 @시각적 연출 스타일 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 2 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "d711c848-58a2-4dba-95f6-8cae5290f9f1",
      "name": "DEM - Remove older @CYOA from context",
      "title": "DEM - 이전 @선택지 목록 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 2 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "d6ed8d89-91ba-4c7e-a5e9-3a514a05e9e9",
      "name": "DEM - Remove older @Status / @Story Threads / @Psychological States / @Plotlines from context",
      "title": "DEM - 이전 상태창·떡밥·심리·줄거리 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 6 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "2e066f02-63e6-44a6-9a52-ed2191ea5e0f",
      "name": "DEM - Remove older @Story Threads from context",
      "title": "DEM - 이전 @스토리 떡밥 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 6 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "e5d2c1b0-7a84-4f63-9e25-1c0b6d8f42a7",
      "name": "DEM - Remove older @Psychological States from context",
      "title": "DEM - 이전 @심리 상태 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 6 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000074",
      "name": "DEM - Remove older @Plotlines from context",
      "title": "DEM - 이전 @줄거리 흐름 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 6 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "f49c991e-4cf4-4db8-a862-a296125848cc",
      "name": "DEM - Remove older @Momentum Engine from context",
      "title": "DEM - 이전 @모멘텀 엔진 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 2 이상인 이전 메시지에 적용합니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000001",
      "name": "DEM - Thinking (Fallback) wrapper",
      "title": "DEM - 생각 정리 (보조 추론) 틀",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000002",
      "name": "DEM - Thinking (Fallback) rows",
      "title": "DEM - 생각 정리 (보조 추론) 줄",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000003",
      "name": "DEM - Thinking (Fallback) classify inputs",
      "title": "DEM - 생각 정리 (보조 추론) 분류 입력",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000004",
      "name": "DEM - Thinking (Fallback) classify constraints",
      "title": "DEM - 생각 정리 (보조 추론) 분류 제약",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000005",
      "name": "DEM - Thinking (Fallback) classify craft",
      "title": "DEM - 생각 정리 (보조 추론) 분류 작법",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000006",
      "name": "DEM - Thinking (Fallback) classify plan",
      "title": "DEM - 생각 정리 (보조 추론) 분류 계획",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000007",
      "name": "DEM - Thinking (Fallback) phase Inputs",
      "title": "DEM - 생각 정리 (보조 추론) 구역 제목 입력",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000008",
      "name": "DEM - Thinking (Fallback) phase Constraints",
      "title": "DEM - 생각 정리 (보조 추론) 구역 제목 제약",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000009",
      "name": "DEM - Thinking (Fallback) phase Craft",
      "title": "DEM - 생각 정리 (보조 추론) 구역 제목 작법",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000010",
      "name": "DEM - Thinking (Fallback) phase Plan",
      "title": "DEM - 생각 정리 (보조 추론) 구역 제목 계획",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "a22f4e31-6c57-4af7-9e6f-3c2ab87d1140",
      "name": "DEM - @Status UI layout",
      "title": "DEM - @상태창 UI 배치",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000075",
      "name": "DEM - @Plotlines UI",
      "title": "DEM - @줄거리 흐름 UI",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000076",
      "name": "DEM - @Plotlines UI - Subplot",
      "title": "DEM - @줄거리 흐름 UI - 보조 줄거리",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "f12a0001-0000-4000-8000-000000000077",
      "name": "DEM - @Plotlines UI fallback",
      "title": "DEM - @줄거리 흐름 UI 대체 표시",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "e7b4c2d1-9f86-4a53-b7c0-2d1e8f9a6b40",
      "name": "DEM - Render Expressive Dialogue",
      "title": "DEM - 표시 감정 대사",
      "desc": "채팅 화면 표시를 바꿉니다. 저장된 원문과 모델에게 보내는 내용은 바꾸지 않습니다."
    },
    {
      "id": "d6ed8d89-91ba-4c7e-a5e9-3a514a05e9e9-original-name",
      "name": "DEM - Remove older @Status from context",
      "title": "DEM - 이전 @상태창 컨텍스트에서 빼기",
      "desc": "모델에게 보내는 내용만 정리합니다. 화면과 저장된 원문은 그대로입니다. 깊이 6 이상인 이전 메시지에 적용합니다."
    }
  ]
});

/*BL-SCRIPT-END*/
}
