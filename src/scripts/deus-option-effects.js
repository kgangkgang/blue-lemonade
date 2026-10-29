// Reviewed DEUS 2.5 and V3 quick-setting effects. No original prompt body.
// v3 = the same id in DEUS V3: its body hash, plus a label/text only where the meaning changed.
// standing = 같은 원문에 블루레몬에이드 상시 손질(프리셋 자동 갱신)만 얹은 본문 지문 — 뜻이 같아 확인된 설명으로 봐요(10-29 상태창 영어 줄).
export const DEUS_EFFECTS = {
  "a3c64aa2-de6f-4ace-987d-1eca5c4ffdb7": {
    "label": "내 캐릭터 직접 조종",
    "text": "사용자의 말·행동·선택을 AI가 대신 만들지 않고 다른 인물의 반응을 이어 써요.",
    "hash": "34609e615cd2cd9c8575e54bbd0fe137408f11df23edeb2e415202a885313db6",
    "v3": {
      "hash": "3bb6095cff80f61baa2871ebc566a29a5a221c9eafcb0f475bc2388bb7112ef3"
    }
  },
  "1c352c54-a636-454f-a058-712ddc3983cf": {
    "label": "입력 다듬기",
    "text": "입력한 행동과 문장을 첫 부분에서 다듬은 뒤, 다음 사용자 선택은 사용자에게 맡겨요.",
    "hash": "cb9326ae6f56ba7564df34bbd4f2106731ee34072b3f8a89ddc77293ba63ee4f",
    "v3": {
      "hash": "ec6a5f7709759cd72bfd0ff2e438122d9c3690075104d78548828024f93956a0",
      "text": "내 입력을 내가 쓴 순서대로 더 나은 문장으로 다시 쓰고 대사도 다듬어요. 내가 쓰지 않은 내 캐릭터 대사는 더하지 않아요."
    }
  },
  "16b32808-e943-45ad-b65e-1de52f2efc3c": {
    "label": "선택지 목록",
    "text": "선택지를 고르면 그 분기에 맞춰 사용자 대사와 행동까지 AI가 진행해요.",
    "hash": "ab9028705b04468a0c3e9417ddfb3d7b2d1e3a1f8d56b2070f640357e7c938d6",
    "v3": {
      "hash": "ccdbe3238b50149b4fd1333f028a5e907ee1b8ab0b45ec0465ab2c848aaa13c3"
    }
  },
  "30d2dd79-5144-4b66-9d49-3b8a0fe61a3a": {
    "label": "연출가 모드",
    "text": "입력을 역할극 대사보다 전개 지시로 받아 사용자 대사·행동까지 AI가 작성해요.",
    "hash": "581b4570fe8b0b958feed171ebf929441d159af6dab1df6468ca51319f02f6d4",
    "v3": {
      "hash": "37693e22ceb651a793c1c440309e395f47d027d77cee986e15d6630b7513d761"
    }
  },
  "f6c1a7d4-2b8e-4f90-a3d5-6e1b9c7d2048": {
    "label": "적응형",
    "text": "장면에 맞춰 자연스럽게 진행 속도를 조절해요.",
    "hash": "8bea2b2ca1688ef5898f39ea8233c020ad6e2c8236e1cae5d69966817082ddbe",
    "v3": {
      "hash": "bffb6ba44e04e3f06c66f59927ea231c59e0353bc47b84c5136c52b7b09be633"
    }
  },
  "a4e8c2f1-7d9b-46b3-8f0a-5c1e2d6b9a74": {
    "label": "급박하게",
    "text": "빠른 전환과 사건의 압박으로 진행 속도를 높여요.",
    "hash": "4e50ae06651073436e53592d371f7aaebcc99882733dc69be5dee7c11a087a27",
    "v3": {
      "hash": "1d0986221535c484cf4fa46347cc2f33afaecc1c83ee5f3486a60b26e4ed596f"
    }
  },
  "b7d3f9a2-6c1e-48b5-9d0f-4a7e2c8b1f63": {
    "label": "느긋하게",
    "text": "여백과 세부 대화를 살리고 천천히 진행해요.",
    "hash": "7612b684331acc1856e1e3c6a314d63973623808c170219a947919843791e510",
    "v3": {
      "hash": "43cda9fa9c0a3f959e62d913d4ae8d37d6c747c640a3b75f0c36c97f08009bee"
    }
  },
  "b7e4eab4-3fc3-4f7c-a9aa-17b8b32b8f61": {
    "label": "유동적",
    "text": "장면에 따라 짧거나 긴 답을 유동적으로 써요.",
    "hash": "3fc45784b693ff4ff61e8a452b7117b05109caa1e0f8d674a41c2376e0fc028d",
    "v3": {
      "hash": "fd8b2883c462b1aa3382996546da4f57d38a2dd5f6e7e6ff1d80f697f3202ea1"
    }
  },
  "c8150e42-0cc3-4728-a95d-024f608895e3": {
    "label": "짧게",
    "text": "생각 과정을 제외한 본문을 약 120~270단어, 2~3문단으로 요청해요.",
    "hash": "2acb8f7eac73832ab81b5151371c6375bb1154a96a25034252fff55ff23cf679",
    "v3": {
      "hash": "6f607d9d955bb8b2a551b19e6f0372fbb20df1df8182449a57641d0e86416334"
    }
  },
  "52a66809-c36a-4893-87ee-228b93f24e77": {
    "label": "보통",
    "text": "본문을 약 250~450단어, 2~5문단으로 요청해요.",
    "hash": "5d20a8cb748b6868c7e728fa97e53a00ba8919a4dd5d4881a4b1561f86f14e1d",
    "v3": {
      "hash": "4d736f83acb065c47063520c988e11a5cc9d6b9a76301a5ea6260ce22c368503"
    }
  },
  "c66c7b02-93ab-44ca-b908-0b49fe626280": {
    "label": "길게",
    "text": "본문을 약 500~800단어, 4~8문단으로 요청해요.",
    "hash": "7a1cfe28f4333437f2dd883f3fb0b4c439f7bb3fee81f7f938229e33793162a5",
    "v3": {
      "hash": "e4838f374e3a17d59ce31c6dd16af4a6089e3f775ee06c21972e38ef043f2f0c"
    }
  },
  "1bbb1b67-520c-4730-96d7-9674f794538b": {
    "label": "아주 길게",
    "text": "본문을 약 1000~1600단어, 8~14문단으로 요청해요. 출력 토큰 한도도 충분해야 해요.",
    "hash": "ca445d91b992ac50fc80fe1a91935567aa2b35da500a95c6c83ee0b57be204bd"
  },
  "b8d2e3f4-a5c6-47b8-9012-c3d4e5f60718": {
    "label": "카드 기본 (세계관)",
    "text": "별도 세계관 지시를 더하지 않고 캐릭터 카드의 설정을 따라요.",
    "hash": "768052aa5d9b08220f028f0bc063f92f910949623cd5247f483a90d0b08ffffd"
  },
  "c9e3f4a5-b6d7-48c9-0123-d4e5f6071829": {
    "label": "카드 충실",
    "text": "카드 설정에 충실하게 필요한 정도만 보완해요.",
    "hash": "88df6ff86a1673953565a7bc61846d85d85525bc7f5feaecc8174259db401610",
    "v3": {
      "hash": "4d5353dad4bfe73b128fedf1f03efc86d4a6029ee0a6b40940395bc339018238"
    }
  },
  "d0f4a5b6-c7e8-49d0-1234-e5f60718293a": {
    "label": "확장",
    "text": "카드 밖의 배경과 세계 세부를 더 넓게 확장해요.",
    "hash": "f8584b188d98cd580e87230ee0e683666256a2191e27e166fb290ebdf79bfc35",
    "v3": {
      "hash": "6d0cb033207203cbe323b97ced3c467724fb290c2d70174f90044da3593c1aa9"
    }
  },
  "d1b5c9f2-8e30-4c7d-a941-6f2e3a9d8c75": {
    "label": "역동적",
    "text": "장면의 움직임과 대응을 균형 있게 보여 주는 전투 묘사예요. 전투가 없으면 꺼서 지시 토큰을 줄일 수 있어요.",
    "hash": "16ad3782391afca7006791061af08f0bb1946123756ac18e09b4ae9cd178d230",
    "v3": {
      "hash": "3fcc136fae7e91e5ce6137124cb7ff4efade872ecf5f2f2bdaa27aa8f36d66af"
    }
  },
  "e2c6d0a3-9f41-4d8e-b052-7a3f4b0e9d86": {
    "label": "빠르게",
    "text": "전투의 부수적인 설명을 줄이고 빠르게 결론까지 진행해요.",
    "hash": "00ada1d1c8c86110bc31db7e119e80e49d50fe3c1b3282e805183c8a59693677",
    "v3": {
      "hash": "629014989a713bf04ed99107d62f681488afc20e13a5c4dc67d08693ef37e069"
    }
  },
  "f3d7e1b4-a052-4e9f-8c63-8b4c5a1f0e97": {
    "label": "길게 이어서",
    "text": "전투의 과정과 공방을 여러 단계로 길게 이어 가요.",
    "hash": "2b350f03a9b1b7e69f991083c8f689c69940b97dd1ecbb600b7eb8944bb1a566",
    "v3": {
      "hash": "1f925faff6a4d5898b836d8e5bc3d820bf344c04542d849889616cf3137438e6"
    }
  },
  "d6e649df-213d-49bc-81fe-cc17c8e73491": {
    "label": "영화적",
    "text": "관찰 가능한 행동과 장면을 선명하게 보여 주는 영화적인 서술이에요.",
    "hash": "bebc35e7d37682cadba0c714124699ecd9626d23e58e54841b5d816662d2f132",
    "v3": {
      "hash": "807ab43912e276d1d1314fd1bdf2728da9011e8a034e211ecb1d31c863776f59",
      "text": "카메라처럼 밖에서 볼 수 있는 것만, 지금 순간의 장면을 끊어 이으며 보여 주는 서술이에요."
    }
  },
  "d72af435-6568-454e-9ed5-aeeb079a55bb": {
    "label": "문학적",
    "text": "세부 표현과 문장의 개성을 더 강조하는 문학적 서술이에요.",
    "hash": "cf0d10cc772094c6ba841a19cbbfd801d5bfc733a879450e6947ab80cf07649d",
    "v3": {
      "hash": "4d72d8a5198cb2bf05ec900b016919e79d3f127a8ea1247d80682fbe555d4c29",
      "text": "초점 인물의 머릿속에서 그 인물의 생각과 말투를 띠는 문학적 서술이에요. 비꼬는 화자를 원하면 분위기의 코믹을 함께 켜요."
    }
  },
  "0908e4f6-a475-4ec6-be3c-1640225c690a": {
    "label": "건조하게",
    "text": "비유를 줄이고 직접적·객관적인 묘사로 쓰도록 해요.",
    "hash": "ee585ea9ef77db6006c50bf7e398bb19fc47d9fe56727c28de34d33d7ca4cd9c",
    "v3": {
      "hash": "a1884eea66dee50018c118d48f35b5b365007a3c29ef1ab5b97e8742f78c00f7"
    }
  },
  "7c8ce8f6-46c2-4035-89b0-6beac7ac5c6c": {
    "label": "라이트",
    "text": "간단한 작성 규칙만 남겨 별도 문체 강요와 지시 토큰을 줄여요.",
    "hash": "4104b8e0dae51cb859cc201224e4382ca04c9ebcfc35da7bd0b0552cd0afd018",
    "v3": {
      "hash": "12588cac3c578ef410dfe25604b899e5d0d032e18e2edd20e4502929265a65fb"
    }
  },
  "02f90aa5-83a7-4799-b7f6-4de37111c69f": {
    "label": "자연스럽게",
    "text": "과장하지 않고 실제 대화처럼 자연스럽게 말해요.",
    "hash": "4576127ec7458acf3412c6abde94d378db48d5e1214b1d99f4bc39c2ff04c63f",
    "v3": {
      "hash": "fa02cece02b22ae705190c7adc64ed744b8bb6e6aa523077c791cf8b229c3af0"
    }
  },
  "353d0187-4c2b-4104-a2bb-c1920e4e174d": {
    "label": "절제되게",
    "text": "짧고 정확하며 절제된 대사를 사용해요.",
    "hash": "ddfd0d8f71ecebc65f64963677565b3369b59733035e94b2463818d9555dcc0e",
    "v3": {
      "hash": "adb966f4d3dcc58bc62e47007ccbe5534ab7aa038f52aa25afcba6cc32061587"
    }
  },
  "d2c6ab81-6ae3-4880-8d50-43b2bc9326c6": {
    "label": "생동감 있게",
    "text": "더 길고 표현력이 풍부한 대사를 사용해요.",
    "hash": "c7fb86f9b5f1610ba11d4e55534db156750e81f2b9a9e776b8e960373bced9ed",
    "v3": {
      "hash": "861e1dd4640b727b90247ced885c27213865092c3d399d6bb187e94c872b5d93",
      "label": "연극적으로",
      "text": "계산된 리듬과 수사를 쓰는 연극 무대 같은 대사예요. 감정이 오르는 순간에는 더 길고 풍부해져요."
    }
  },
  "7805eb87-f271-4308-96e5-1343f9a2d1ba": {
    "label": "3인칭 (캐릭터)",
    "text": "캐릭터를 이름이나 그·그녀로 서술해요.",
    "hash": "2d8eba899de5a6a8d94a7a937912973909f95211aab0ca80f568c4aaf51983f2"
  },
  "5a8d0204-d0df-4773-b501-23f0a2552769": {
    "label": "1인칭 (캐릭터)",
    "text": "캐릭터가 나로 말하는 1인칭이에요. 여러 인물이 있는 장면이나 일부 전개 설정과 충돌할 수 있어요.",
    "hash": "a0c4a08fcfd71fe7baf8c773f0d2799b400b49db87750296c46084e00d1fa989"
  },
  "c4311841-0509-4578-8864-9ebd0c1e7236": {
    "label": "2인칭 (내 캐릭터)",
    "text": "사용자를 너로 가리켜요.",
    "hash": "b8677bb584f42c547a08db6d60d5d609c3ea63ad015aa3725d96ff64ff524338"
  },
  "7ee86bcd-2311-496c-ae0c-2ef13e5d5dc7": {
    "label": "3인칭 (내 캐릭터)",
    "text": "사용자를 이름이나 그·그녀로 가리켜요.",
    "hash": "b51c0f358235f324b118b4c871a8a78066e264345fae84d59d80952082bf6fc0"
  },
  "49c0c04e-ef52-4817-8430-f08644d7c382": {
    "label": "1인칭 (내 캐릭터)",
    "text": "사용자를 나로 서술해요. 선택지 목록이나 연출가 모드가 필요하며 캐릭터 1인칭은 3인칭으로 전환돼요.",
    "hash": "56b781e234dc60acf9ee6c928d0dfb32813440497f15dd2714d100d5bab3f593"
  },
  "1975aa43-f0ba-402b-b12f-e708c40d931d": {
    "label": "현재형",
    "text": "현재 일어나는 것처럼 현재형으로 서술해요.",
    "hash": "b1e71d704ec3617a9f81b16845fb91562daae3a20f2c7f096144fdcae67d9d7e"
  },
  "7c8282df-eb71-4803-a43c-962363942a88": {
    "label": "과거형",
    "text": "이미 일어난 것을 전하듯 과거형으로 서술해요.",
    "hash": "90ceb16fa7ce4e936a84fc780dbeaaa7266130fcd9dd27c9edb65201b7db950a"
  },
  "34c55900-90a8-4770-a8a3-6f535579f6cd": {
    "label": "숨김",
    "text": "속마음을 기록하되 화면에서 숨겨요. 모델에는 전달되므로 토큰이 없어지는 것은 아니에요.",
    "hash": "2a20ca46d233df37879026e81937a741fc2572a6dfbd89613df5cb253b1e2acf",
    "v3": {
      "hash": "a3b2466371e03af8e95efde959a2d1840812ab7471ae6196769693eb66dcd90a"
    }
  },
  "b3b14ca1-4c8c-4539-a9c3-a2fcb2771c40": {
    "label": "보이기",
    "text": "속마음을 화면에 보여 줘요. 캐릭터 1인칭에서는 내면이 서술에 포함되어 별도 속마음이 꺼질 수 있어요.",
    "hash": "837ec091c7735dbd494b73ad516a53d1bca3897af5cadb6e70067e1191a54858",
    "v3": {
      "hash": "9845e98724adc53e775b0c22889344eadb09c2fd599e39493ae535ce8a37aebb"
    }
  },
  "16879fbb-850b-4c0a-b25a-30c6911e3f9f": {
    "label": "별표 없이",
    "text": "서술을 별표로 감싸지 않아요.",
    "hash": "dcf6c450bfe222a0350ccacb34635a2a9e03c08ce3b18d041082a576149d412a"
  },
  "3307748d-b371-4b03-9cf3-d3cac99b8c7c": {
    "label": "별표로 감싸기",
    "text": "서술을 별표로 감싸 기울임 표시 등에 활용해요.",
    "hash": "447a9b4ee7c44f6ebb783acaa9965e6d4f5f6b7e572aea2b8e8a54ce56823765"
  },
  "6537edf0-8331-4e7e-841a-86655f5a5a9c": {
    "label": "현실적인 수위",
    "text": "성인 장면을 비교적 현실적인 분위기로 다루도록 해요.",
    "hash": "14979dd087b3933d1abb6841852efb48199af50647a4eec6ad2a3d2ec0376a39",
    "v3": {
      "hash": "dd1cbad9701325f2589c5039921c88d09f0659cbf64d0e4808b051f41a4e2a4a"
    }
  },
  "1d816ec2-2c8f-4e92-81d1-18021dbfedd0": {
    "label": "최고 수위",
    "text": "성인 소재의 표현 강도를 크게 높이는 옵션이에요. 캐릭터 현실성 보조 규칙과 충돌할 수 있어요.",
    "hash": "0af4e17e0ea2268535864470642db568caaae9eb986494b0995a99ca0f87f7c7",
    "v3": {
      "hash": "df567b923b106d5ac79520bced836c93f855c92e4fb5c6f26cc096b70f28bd0d"
    }
  },
  "668ed810-9070-44cd-830b-3f295fb58c03": {
    "label": "노골적 묘사 없음",
    "text": "노골적인 성인 표현을 피하고 해당 장면은 건너뛰거나 비노골적으로 요약해요.",
    "hash": "21641226a67ed1862b62818e121da6e9a59bd0ea18d06fae25f664aef79d9ca6",
    "v3": {
      "hash": "3cc0502934f30552ee1bcd305432a8d0a12a42a3cac598a504efc2b71979fe81"
    }
  },
  "4e6b48fe-f9f6-41e7-b910-dc6f13d15cfd": {
    "label": "정확한 시각",
    "text": "날짜·장소·날씨와 정확한 시각을 상태창에 기록해요.",
    "hash": "14714f5992046efb17118f3f53e930eac880fa356d8299c4d629cabc530d4df6",
    "v3": {
      "hash": "6acc480df18cb63c7127c5309ef0a1ac57458df3cf52be13b6e19f673a5a5136"
    }
  },
  "9056ce79-fcf0-443e-aa6f-ae6b8929ece2": {
    "label": "대략적인 시간대",
    "text": "분 단위 시각 대신 아침·저녁 같은 시간대로 기록해요.",
    "hash": "041188c11ab8ac183340dd1cfdc81184c224b0e6fe03faccd12596301bb16eb8",
    "v3": {
      "hash": "6dbf6190afc654e05084f7e89fabec43fb88bde6825f9494b127adc75843866f"
    }
  },
  "e0ffb643-674b-42a1-bb0b-076e4b7ad3d7": {
    "label": "모멘텀 엔진",
    "text": "네 가지 전개 후보 중 매크로가 무작위 경로를 골라 다음 답에 반영해요. 라우터도 켜 두세요.",
    "hash": "3510c515f7a629e1a324ba3507ba35c34880561bff7f8267c2778e6f7b4355b0",
    "v3": {
      "hash": "82bc70f2125a64fb4db43678278e2526ab1e30d8b21750fdf67a8ca768a8bf4a",
      "text": "네 가지 전개 후보 중 하나를 무작위로 골라 다음 답을 이끌어요. 라우터도 켜 두세요. V3 의 기본 선택은 물밑 흐름이에요."
    }
  },
  "fff18557-018d-4856-9497-2f47a6ef2b2a": {
    "label": "갈등 블록",
    "text": "답 끝에 갈등 정보를 기록해 다음 응답의 방향을 천천히 유도해요.",
    "hash": "f0745ecf9e435f9420d1e5e2ada554628541091d0e3f464be6c8d2a34389b3a3",
    "v3": {
      "hash": "23115c1983027c475cfec2ee94664bc83173aca54c9383e70734c27745ae3cc6"
    }
  },
  "f355912c-d2a8-4823-85e9-cbb01820af83": {
    "label": "장면 계획",
    "text": "본문 전에 장면 계획을 작성해 연속성을 점검해요.",
    "hash": "74efb71f01e1b4c931f9e4c8c648fff6789530b425515a1d9056438b6f60169b",
    "v3": {
      "hash": "a8bab6b220d5023ce4285346da632a05fa7c891dae1a52ece46092a550414cf4"
    }
  },
  "86373739-207c-44d9-8af4-147312c4724a": {
    "label": "생각하기 ! (대체용)",
    "text": "장면 계획을 쓰지 않을 때 대체 생각 과정을 사용해요.",
    "hash": "c5fd636fbc2fa59888f85aeb831175aa5c9b0686f29fe6c945a2773c7ba71a54",
    "v3": {
      "hash": "58ca81bf4d4ec4f4ed262ac16a99ea7008093bbffc28c66a69aa00d8115e8814"
    }
  },
  "7f5495fd-d06b-41be-ab28-5962a64456b1": {
    "label": "과도한 생각 방지 ! (대체용)",
    "text": "장면 계획을 쓰지 않을 때 지나치게 긴 생각을 줄이려는 보조 지시예요. 실제 모델의 추론 설정을 직접 바꾸지는 않아요.",
    "hash": "98f3b1e9fa5650b22e9c397b9d33b92e93781787735583b19271b495bd8f1b4d",
    "v3": {
      "hash": "7888f986c0dc6ff47b1fe3b3ae4f937c9b1dde03c68bb1f22d8241db97f1e6c4"
    }
  },
  "0c01676d-4a2e-439c-a5ac-27c128d5a533": {
    "label": "캐릭터",
    "text": "인물 행동과 역할 수행의 기본 규칙을 적용해요.",
    "hash": "bae34b8eb6e96a894bfaa3b1a1cd82c2f61499b66f68c98d5b5d8bf860293583",
    "v3": {
      "hash": "dce4e68eb225a21a21a5358b2967ca78255def300846bb8c0ad8b2dc2b2628d6"
    }
  },
  "8e8f0b40-c695-47b8-90d6-3720e4c79437": {
    "label": "플롯 가이드",
    "text": "장면에 필요한 사건·전환·목표를 다루는 전개 지침을 더해요.",
    "hash": "ba43f07f9fafc1f8844258b712610a105c3a839684dedf4d7ea2ac013f4c5751",
    "v3": {
      "hash": "37a5979d4515a7f67a1e264a975a19ad14f25d2d6b1316b029591f4e37e2d2cc"
    }
  },
  "c4a8e2f7-1b65-4d90-9c31-7285be6a0f42": {
    "label": "카드 기본 (분위기)",
    "text": "분위기 지시를 추가하지 않고 카드의 본래 분위기를 유지해요.",
    "hash": "e03a0d25322395d085f6328b5caddcd5a287993aa6652bb5bd1c6ba2db6d85cb"
  },
  "d6f1a9c3-8b47-4e20-a562-9371cd5f8a04": {
    "label": "코믹",
    "text": "기존 장르를 유지하면서 코믹한 표현을 더해요.",
    "hash": "502692d9b752bbb2ca2eebb7bcb650a3ab9b4b5f8ff2ea274ddc99c55a950c24",
    "v3": {
      "hash": "8288053f60dcf33736a3502d9de906027cccc0a17e675290b39476cc45950c3f"
    }
  },
  "ddaac217-1380-4152-9bcd-d1092c5deadf": {
    "label": "로맨틱 코미디",
    "text": "기존 관계를 유지하면서 로맨틱 코미디 분위기를 더해요.",
    "hash": "efe8c021a05bd56c25f5043becb1bfe2d1ee889aee10013888c166573a1adb0d"
  },
  "f155f1d8-34be-4ef3-98e3-c63fbd8cec48": {
    "label": "로맨틱",
    "text": "애정과 친밀함의 표현을 강조하는 분위기를 더해요.",
    "hash": "3dff22c55e689bf14b9d47bb1db845ccfb0f05e12abc0c37b7d0a9e347bcda6c"
  },
  "e8b3c7a2-5d19-4f64-806e-2149af7c3b58": {
    "label": "드라마틱",
    "text": "갈등과 감정의 극적인 긴장을 더해요.",
    "hash": "67fa42daef68a4d8fba941a127db7aa53d72d3d2a3164f8bac75a12f8f2289d6",
    "v3": {
      "hash": "304985917107c9f6a88b599a97652161ee3591f55e48928a24120c945eff8528"
    }
  },
  "f9c4d8b1-6e20-4a75-917f-3250ba8d4c69": {
    "label": "서사시",
    "text": "규모와 여정이 느껴지는 서사적인 분위기를 더해요.",
    "hash": "5dee76cde4cd529ea995fc998bff4df12077d182d4cbd63a150919178e7dcda9",
    "v3": {
      "hash": "0721b5f6af782adb601720dbe338e7e8c46d8dbfeecf0f789aeccaf47aedd12e"
    }
  },
  "a1d5e9c2-7f34-4b86-9280-4361cb9e5d70": {
    "label": "고딕",
    "text": "어둡고 장중하며 불길한 고딕 분위기를 더해요.",
    "hash": "0a2024b7bb261d5d9592ea6502fe590a686010f7491b1c57905e200b11204f3b",
    "v3": {
      "hash": "626ebd03b327996ac63ec7caf73c28c2623957934fa05cccf45822ab951bd9bc"
    }
  },
  "b3e6f0d4-8a25-4c97-0391-5472dc0f6e81": {
    "label": "몽환적",
    "text": "꿈결 같은 감각과 여운을 더해요.",
    "hash": "7b6c1d3e4abe8760cefa864645872cea8e898a63b795fcf40fa17c4f9cf33d2b",
    "v3": {
      "hash": "5e2850d5bd0a19ec309f2fb4dec86e56942dd3d0e25d760f0397a69cf50c2b14"
    }
  },
  "c5f7a1e6-9b36-4d08-1402-6583ed1a7f92": {
    "label": "초현실",
    "text": "현실에서 벗어난 낯선 결합과 분위기를 더해요.",
    "hash": "3db4a9d9e03f9f32b77c7c593825787641eebbcd35ee6ade26d9443e7a94d747",
    "v3": {
      "hash": "3b8c5604306dff6f2574c0e642b04f7c51a7d55ddeb15a3d439a95440a62cf0e"
    }
  },
  "5415c972-4ec8-46de-8d29-1e3bce1881d7": {
    "label": "기괴한",
    "text": "설명하기 어려운 불안과 기묘함을 더해요.",
    "hash": "0b13c4d060d3bf65642260560ba015fef6eafd7d6df9f3bf17ed775e26808959",
    "v3": {
      "hash": "db15dd84ccb0341c5b31e7f90a4bef27a987cb3b37b637d373df9315596beb21"
    }
  },
  "d7a2b8f0-3c47-4e19-2513-7694fe2b8a05": {
    "label": "그림다크",
    "text": "거칠고 어두운 세계의 냉혹한 분위기를 더해요.",
    "hash": "c19f0b5d547d57620e963e121ff5763d1966f9885fa07637882b561f180bc7e6",
    "v3": {
      "hash": "4d968199b7ae617a5cb0fcf6c186cb618965a27ecc26fd4f52255bb354b059e3"
    }
  },
  "e9c3d9a1-4f58-4026-3624-8705af3c9b16": {
    "label": "밝고 경쾌",
    "text": "밝고 가벼운 분위기를 더해요.",
    "hash": "3560141970c0191929b9f2c0f9cecc036a43e0b3f3a2342fff690ba5a33b3c22",
    "v3": {
      "hash": "e6502229b148ddfb8c1c81847ad7661096d798fc79764e7f3e814b155b88ca01"
    }
  },
  "745db607-a083-45d7-b216-f3c69e4d8c31": {
    "label": "대사 색상",
    "text": "인물별로 다른 대사 색을 붙여요. 화면 표시에는 대응 정규식이 필요해요.",
    "hash": "2a9028fd10ae1f1d3f16578b925a8564e16ed1ba082c897cfd682c7d1a7ccfa6",
    "v3": {
      "hash": "290f2a7d5c39e8f6fc248eabad197dca5e9a022233be24d4b497cf2899a61042"
    }
  },
  "e7b4c2d1-9f86-4a53-b7c0-2d1e8f9a6b41": {
    "label": "감정이 드러나는 대사",
    "text": "감정이 뚜렷한 대사에 태그를 붙여 애니메이션·색 변화로 표현해요.",
    "hash": "9d5807b19301c509d43f9a33194e3354589a16bbe00898fbf367bf1d9931cd48",
    "v3": {
      "hash": "ad894e270680790d8d71301c3d1e98202b9e72ac610c140d9ca8da0f04c89b39"
    }
  },
  "c32a9d07-bbcc-4456-adaa-ed1642d47db9": {
    "label": "시각적 연출 (HTML)",
    "text": "이야기에 맞는 HTML·CSS 시각 요소를 답마다 추가해요.",
    "hash": "e7acdd7f57c2f593e4763a10de0c3cabf9ed8f83016d226c2a8d58c51771ad1c",
    "v3": {
      "hash": "8aae8f630394b39f6b2cad524328c6d8a226e5c588eff82cca8d6f21d122ac0e",
      "text": "새로 보거나 읽을 것이 나올 때만 이야기에 맞는 HTML·CSS 요소를 더해요. 대부분의 답에는 없어요."
    }
  },
  "838e2a5f-0e74-4abd-98a4-0fee33a22a14": {
    "label": "캐릭터 현실성",
    "text": "인물이 무조건 사용자를 따르지 않고 설정과 상황에 맞게 행동하도록 해요.",
    "hash": "171f00993b920b743e5edfcd6e2eace10e95cbc71d3aae4c624695eb11997663",
    "v3": {
      "hash": "c8c119cb997ec7b12ee39970ffed0c7f62ba3fbbd01186738c9293c4362fe706"
    }
  },
  "4371b70a-8f15-46ec-90fb-6ea572c77cde": {
    "label": "전지적 시점 방지",
    "text": "인물이 직접 알 수 없는 서술이나 비밀을 지식으로 사용하지 않도록 해요.",
    "hash": "20263f7ce744d06d0a0e56faa3cbaf0eb0d44775d80a7677b67a52f339282ee3",
    "v3": {
      "hash": "fe1cd06cd7883cac6c26217b7b52c68a3875902e5acba0d82514c8df03756d77"
    }
  },
  "d3a52caa-ed44-454b-ba62-a40101d4949d": {
    "label": "긍정 편향 방지",
    "text": "무조건 좋은 결과로 정리하거나 갈등을 피하는 경향을 줄여요.",
    "hash": "6b6fb94b89422455e1c6ecae467ed3ff737c4d7ea30766d36ea67985f8f167c2",
    "v3": {
      "hash": "a7103d8295cc15c40f98f06ce9d162aafd606a67f85141ff589aba29e9dd2eb8"
    }
  },
  "3f6ef275-2ecb-45ca-8ceb-f77ad11e012a": {
    "label": "반복 방지",
    "text": "이전 답의 표현과 내용을 반복하는 빈도를 줄이도록 해요.",
    "hash": "15450371b1f985ecc548c31a59055aee7886c3fae9bfbb9fdba27f08d62d17e6",
    "v3": {
      "hash": "c7eaf6ad287b8d08234534f6a6a611dbae516a2629493e025f5b0c64bfc7c0b4"
    }
  },
  "8ffe0557-5f8a-45bd-ab43-ebc580510827": {
    "label": "금지어 목록",
    "text": "정해 둔 상투적 단어와 표현 목록을 피하도록 해요. 목록은 원문에서 확인할 수 있어요.",
    "hash": "c97ccfb9e614e66fcf02016e1d90d3bde3546d5c26a0163fb8b8e51fbdeefdbc",
    "v3": {
      "hash": "f81b0dd940d47560b393472a77d3404041118149c194cb64d67425effa64821f"
    }
  },
  "403539e4-e530-43a1-be30-5d5bd33d4d5e": {
    "label": "상태창",
    "text": "등장 중이거나 장면 밖에 있는 주요 인물의 상태를 기록해요.",
    "hash": "366872c37740d485dbe5c4a1e5ddd3e88bb29dde841be3ba25d3ea0d06a7d15b",
    "v3": {
      "hash": "72082f5d16150538d93dc9ef4f36ae1528a1075d92a0b18f8f8e83b73ccc7572",
      "standing": [
        "f6b347b791cd2bdc59e50af59abfa97a35a6b369a150f5d139bace9ca1c1fb11"
      ]
    }
  },
  "ab70a374-f6f5-4e5c-a1c6-1596a4397806": {
    "label": "스토리 떡밥",
    "text": "미해결 사건과 새로운 단서를 기록해 이후 이야기에서 다시 다루도록 해요.",
    "hash": "66525c8ff52ead61e3132b6a9d93df018dbac550b55d1a1c87a07a8c0400e67a",
    "v3": {
      "hash": "3f09f8d4e678f5334967291705b41e4a96d03c91878374b650ac3a66b46bd3e6"
    }
  },
  "7eb033d6-2036-4c5a-9b3a-d22d1d6da7b8": {
    "label": "심리 상태",
    "text": "주요 인물의 현재 내면과 동기를 따로 기록해요.",
    "hash": "e4df2f21354f0596a1aa1dbce9f617e69284937864767269a8f943879ad6df8b",
    "v3": {
      "hash": "6244d7a2485cb9f1d5c74aef2cd14bd0ad9fbb9ab91196f4311ccc5b21dbca5a"
    }
  },
  "9f4e7a1c-2b63-4d80-a5e7-91c3f6b8d204": {
    "label": "줄거리 흐름",
    "text": "실제로 진행된 이야기 단계와 배경 흐름을 기록해요.",
    "hash": "eb78d4d8a348f165db78b6db933318fe6481ba588dc25fd83d8e6c0a096e36c6",
    "v3": {
      "hash": "bced541ce5948b24ba408136a04b38ca179f15febcc3258b5ecf04fb43ffe500"
    }
  },
  "a3210be7-945f-4ebc-b3fe-3433d51e7479": {
    "label": "모멘텀 엔진 라우터",
    "text": "매크로가 선택한 모멘텀 경로를 실제 다음 전개 지시에 적용해요. 모멘텀 엔진과 함께 켜야 해요.",
    "hash": "d356f27eba3168dc967facd798da59b64560b61626c47f61d1c8626a20fb67ac",
    "v3": {
      "hash": "bc567ff0f9d36df5585c1bb2dc776f0c34863fa34021d58088d15137d4284421"
    }
  },
  "3d498f27-126a-41fc-baf2-369c90a9c50f": {
    "label": "아주 길게",
    "text": "본문을 약 700~1,000단어, 6~10문단으로 요청해요.",
    "hash": "7503ac6cbb8ef02b3615f3f15fdc3664abca982cba1eb84a797b4db0b4cb35c6"
  },
  "e2f653f7-fbd0-4565-9ad1-ee2ef67a2bce": {
    "label": "파이의 이야기꾼 서술",
    "text": "진행자 '파이'가 따뜻하고 호기심 많은 이야기꾼 목소리로 서술해요. 다른 서술보다 토큰을 더 써요.",
    "hash": "18f7646fd2d10be9a615d95f3723e03d1dd73846daaa93f592047722ae240a78"
  },
  "b9a5f748-bd71-41d5-bbb3-432ecb23a1f8": {
    "label": "애니메이션처럼",
    "text": "느낀 것을 말로 하고 반응이 큰 애니메이션 같은 대사예요. 성격은 그대로 두고 표현만 키워요.",
    "hash": "24b28c8fe5049c22f34cb06a082809538b3e8450a71ee914fe76efbfe199dc09"
  },
  "ef8c52ca-4c07-423d-8bc7-7600ca364cd0": {
    "label": "우정",
    "text": "로맨스 없는 우정을 그리고, 꼬리말로 신뢰·단계·함께 나누는 것·지금의 마찰을 기록해요.",
    "hash": "a73b391ad12ba8274a77afb99e25c764abde1ada1449e30ea12bfc3bf698492d"
  },
  "ce6efb5d-fe0f-4dbf-9a9c-4402c4132170": {
    "label": "현실 로맨스",
    "text": "끌림이 시간·실수·선택으로 쌓이는 현실적인 로맨스예요. 꼬리말로 가까움·단계·말하지 못한 것·가로막는 것을 기록해요.",
    "hash": "99a1df0b7e5a89c22e214164f42fa574a06031d8cb313ba40a7cc660451faad6"
  },
  "ad03f5c8-49fe-41fa-9fb3-6edd272bbce2": {
    "label": "달달한 로맨스",
    "text": "티격태격·플러팅·두근거림이 있는 달콤한 로맨스예요. 꼬리말로 설렘·단계·달달한 순간·지금의 엇갈림을 기록해요.",
    "hash": "3525eb4798f303b9aae55db2327f102895ff4f6965f0d089ed16db5ebbd193bc"
  },
  "2b07f8a7-a4c8-45fd-952c-839353905dea": {
    "label": "다크 로맨스",
    "text": "소유욕·힘의 불균형·금지된 끌림이 있는 위험한 로맨스예요. 꼬리말로 붙잡는 힘·단계·넘은 선·쥐고 있는 약점을 기록해요.",
    "hash": "c09ef4ac6af0d7aa3230b1c171307c94ded264436fabb7b57a405e200543ab91"
  },
  "c858bd65-2e20-4b39-b481-9c8d54fe1dc9": {
    "label": "물밑 흐름",
    "text": "꼬리말에 인물마다 원하는 것·받는 압박과 다음 경로 다섯 개를 적고 매 턴 갱신해요. 경로는 제안일 뿐이고 내 입력이 방향을 정해요.",
    "hash": "71cdf9a5ca683345753f836ea13fddf209b9fee70c964b6ea9c1dfc754d9ea32"
  },
  "bf1386b1-1257-41c6-96b6-efb46e2db8ad": {
    "label": "모든 캐릭터",
    "text": "상태창에 장면 안팎의 주요 인물을 모두 적어 자리에 없는 인물도 놓치지 않게 해요.",
    "hash": "a92ce0c45acfd24bee0c9cfa1bc2773b20b7b927c1464a91241616ea7f31bd62"
  },
  "f2a63bb5-7bf4-4a2d-9767-293fe609ef60": {
    "label": "장면에 있는 캐릭터만",
    "text": "상태창에 지금 장면에 있는 인물만 적어요. 이름에 걸린 로어북이 계속 켜질 때 써요. 자리에 없는 인물은 놓칠 수 있어요.",
    "hash": "7fad014bbad29b9b8e0caf136e2a0d31f4df0fd033b99aa42ab6cc45ad10b9cc"
  },
  "ee9417ca-55ce-42c8-a582-63f1ce5b46c6": {
    "label": "감상 메모",
    "text": "친구들이 본문 아래에 각자 짧은 감상을 남겨요. OOC로 @이름을 쓰면 그 친구에게 말을 걸어요.",
    "hash": "d8ba17a115ba35a764305730fae42eacb75d7ad1b0926450ef216e537bb3b96a"
  },
  "35e32cf4-0331-4146-8ffb-fe3b1b1347a5": {
    "label": "단체 대화",
    "text": "친구들이 단체 대화방처럼 짧은 메시지를 3~8개 주고받아요. OOC로 @이름을 쓰면 그 친구에게 말을 걸어요.",
    "hash": "240e1ccd500ee10ace084c46009ec2f689165b25f4d360ca303796080fb482a4"
  },
  "9a3f546c-c791-4df7-83e2-6fa281b39391": {
    "label": "말끝 늘이기",
    "text": "끌거나 조르거나 놀릴 때 말끝을 늘여요(예: 제발~). 한 줄에 하나까지예요.",
    "hash": "8890c199876718643786ef7ab890033f937fddc717bf9e13239e941d45a5c5c8"
  },
  "a8829752-6472-47d6-882b-1f51edd580de": {
    "label": "말 더듬기",
    "text": "두려움·당황·거짓말처럼 압박을 받을 때만 말을 더듬어요.",
    "hash": "8dfee4440fd3fa7c64eef22b8e27e5db3bb6cc1286d837f46e4e67dbd40d52bd"
  },
  "957810fa-2f9d-4f8e-bf71-1d63a2d90b61": {
    "label": "외침은 대문자로",
    "text": "외치는 말을 대문자로 써서 목소리 크기를 보여요. 로마자 대사에서 효과가 있어요.",
    "hash": "63989b111bf138bf416a07f22491ac85a6e5fe0a140759ad9b8a9225f3c014cf"
  },
  "9cff52a3-ffb4-4717-bb61-c376e21f0372": {
    "label": "감탄사·소리",
    "text": "아·음·쯧 같은 말 아닌 소리를 대사 안에 그대로 적어요.",
    "hash": "de328c40c6b730f2b71c330b4034d81a98c58ec91f714f4a9a9de7a845697bb9"
  },
  "b33b45dc-abb3-4313-a260-7011f7552117": {
    "label": "서스펜스",
    "text": "답은 미뤄 두고 기대와 긴장을 쌓아요. 모든 진행 속도와 어울려요.",
    "hash": "288f8758af6d4b1ec7dd728d6d96208d8feb889c1ce1554a8f6d2ddfb9664735"
  },
  "bf50a051-c194-4964-9ff8-dd6f299c0c17": {
    "label": "쓸쓸한",
    "text": "상실·기억·오래가지 않는 것들의 조용한 슬픔을 더해요.",
    "hash": "5158ab5d0dd98c927e1fe2eb47a83c09558e7b8dda64a61e065816ca5f4808db"
  },
  "81f1ca27-ae2a-4812-8312-46ff1c70ad9d": {
    "label": "친밀한",
    "text": "작은 행동으로 드러나는 두 사람 사이의 조용한 친밀감을 담아요. 스스로 로맨스나 성적 장면을 부르지는 않아요.",
    "hash": "4aef696bff2f1c84b729e52290145ab754597191874ba689117486ce02287bf2"
  },
  "88859954-b3a5-4eb1-b2d3-f56daa08cb6c": {
    "label": "파이의 퇴고 메모",
    "text": "이야기 뒤에 파이가 방금 쓴 글의 약한 문장과 어긴 규칙, 고칠 방법을 짧게 적어요. 장면 계획·생각하기가 다음 답에 이어 받아요.",
    "hash": "c9287c66eba6883761a838d82b46872d1c720c0c9d67a52f1e4e095189c9f65c"
  },
  "d152123a-0eb9-4231-81a6-148d33c95d49": {
    "label": "한편",
    "text": "이야기가 다른 곳에서 진행되는 동안 화면 밖 인물과 사건을 기록해요. 화면에서는 스포일러 아래에 숨겨요.",
    "hash": "ad9ba6b4fc42a7f33e8f06cfff1555d86330d332af120f1b38b8a2df4a24f810"
  },
  "7e22cd21-5634-4bd7-b967-ff298c17c096": {
    "label": "숨은 진실",
    "text": "누가 무엇을 아는지 기록해 인물이 실제로 알게 된 것으로만 움직이게 해요. 스포일러 아래에 숨겨요.",
    "hash": "1540be81b3b106342a1f905832897b0b0c0352afc46e0d80a2fddb58be736012"
  },
  "ac8baf99-31c7-4aa6-a1fa-65c0061175c8": {
    "label": "치 (가장 친한 친구)",
    "text": "파이의 가장 친한 친구예요. 반응 방식(감상 메모·단체 대화)을 함께 골라야 나와요.",
    "hash": "710b3d9b861dece3b93f82a9685691c0b14324b6a0efa6cb2861a9a1191a2d28"
  },
  "3b27fb81-988f-46d2-9b15-11e2fdd5faac": {
    "label": "루 (탐정)",
    "text": "하드보일드 탐정 친구예요. 반응 방식을 함께 골라야 나와요.",
    "hash": "ef4a10f02854fd325be65bf7b66db4e2d91564d7d3bb2ebe581cf830eec18706"
  },
  "001d91d3-32a4-44b0-a40d-d43bc5c1dd7b": {
    "label": "샘 (게이머)",
    "text": "아늑한 게임을 즐기는 게이머 친구예요. 반응 방식을 함께 골라야 나와요.",
    "hash": "ae738c48f507819815e7d6316b05b04c5bf94fea8f66047af8b087c0d841bff7"
  },
  "ede70f86-56c1-4fb0-8f3b-cd56d82f0b91": {
    "label": "그레이스 (시나리오 작가)",
    "text": "할리우드 황금기 시나리오 작가 친구예요. 반응 방식을 함께 골라야 나와요.",
    "hash": "758ac35aa870d4c69b9f9aec3a077d4bb13e9eee05b2964faf5857a4c63ad4b5"
  },
  "87ab753f-c7e8-4787-9bbf-ea9bad6f49f0": {
    "label": "레일라 (애니 덕후)",
    "text": "2000년대 후반 감성의 애니메이션 팬 친구예요. 반응 방식을 함께 골라야 나와요.",
    "hash": "44f813f37987da5b6f0bd487a6913889ecd4c6acc65b755a68aded2139bda7c0"
  },
  "7b41c7cf-6076-4e41-b829-04dee6e4c5ff": {
    "label": "파이 (이야기 진행자)",
    "text": "진행자 파이가 장면을 쓴 기분을 이야기해요. 앞으로의 전개는 말하지 않아요.",
    "hash": "8c3fa117387f69150cb2aa6064ed133bfed331506fed09ab54627f475c31ea4d"
  },
  "f42ef524-bb38-4804-a7b5-b9762214bcd5": {
    "label": "솔라 (열정 가득)",
    "text": "Pyropia의 Sola 프리셋에서 온 따뜻한 창작 동료 친구예요. 반응 방식을 함께 골라야 나와요.",
    "hash": "8981f3cbcda48655271433fd9796d04ae0eab6423ed9012bb3f266a89d937c35"
  },
  "bl-deus-length-ultra-long": {
    "label": "초장편",
    "text": "본문을 약 2,000~3,200단어, 16~28문단으로 요청해요. 반복으로 늘리지 않아요.",
    "hash": "4dd34f80388659206bc2fe5899b3e5a6bc644ce4b8c28dd80e3981a660b597aa",
    "v3": {
      "hash": "ca75de5c364768c4643de8cb0afd1ad4aed49ebac1c83a7c924a117d763e1e4b",
      "text": "본문을 약 1,400~2,000단어, 12~20문단으로 요청해요. 반복으로 늘리지 않아요."
    }
  },
  "6f3c2a91-4d7e-4b58-9a1c-e2f05b8d7c34": {
    "label": "일상 민속 공포",
    "text": "일상 속 민속 공포와 기묘한 미스터리의 불안한 분위기를 더해요.",
    "hash": "3c9d8d332419db5e48c5e98f5403f6eabf6650958ab1393d9bc9018943882f1b",
    "v3": {
      "hash": "d68fcf96e15806b52ce32224e5e60e264f7a1b851b666233eb0c1a96893dd64a",
      "text": "오래된 민담·금기·외딴 시골에서 오는 축축한 공포가 일상에 스며들게 해요."
    }
  },
  "bl-deus-length-epic": {
    "label": "대장편",
    "text": "본문을 약 2,800~4,000단어, 24~40문단으로 요청해요. 반복으로 늘리지 않아요.",
    "hash": "52a92349e37449b68cfaabd424425994cc70242dea66c454f9f5a3bee7ebffd3"
  }
};
export const DEUS_EFFECT_GROUPS = {
  "agency": {
    "label": "주도권",
    "ids": [
      "a3c64aa2-de6f-4ace-987d-1eca5c4ffdb7",
      "1c352c54-a636-454f-a058-712ddc3983cf",
      "16b32808-e943-45ad-b65e-1de52f2efc3c",
      "30d2dd79-5144-4b66-9d49-3b8a0fe61a3a"
    ]
  },
  "pacing": {
    "label": "진행 속도",
    "ids": [
      "f6c1a7d4-2b8e-4f90-a3d5-6e1b9c7d2048",
      "a4e8c2f1-7d9b-46b3-8f0a-5c1e2d6b9a74",
      "b7d3f9a2-6c1e-48b5-9d0f-4a7e2c8b1f63"
    ]
  },
  "length": {
    "label": "답변 길이",
    "ids": [
      "b7e4eab4-3fc3-4f7c-a9aa-17b8b32b8f61",
      "c8150e42-0cc3-4728-a95d-024f608895e3",
      "52a66809-c36a-4893-87ee-228b93f24e77",
      "c66c7b02-93ab-44ca-b908-0b49fe626280",
      "1bbb1b67-520c-4730-96d7-9674f794538b",
      "3d498f27-126a-41fc-baf2-369c90a9c50f",
      "bl-deus-length-ultra-long",
      "bl-deus-length-epic"
    ]
  },
  "world": {
    "label": "세계관",
    "ids": [
      "b8d2e3f4-a5c6-47b8-9012-c3d4e5f60718",
      "c9e3f4a5-b6d7-48c9-0123-d4e5f6071829",
      "d0f4a5b6-c7e8-49d0-1234-e5f60718293a"
    ]
  },
  "combat": {
    "label": "전투 묘사",
    "ids": [
      "d1b5c9f2-8e30-4c7d-a941-6f2e3a9d8c75",
      "e2c6d0a3-9f41-4d8e-b052-7a3f4b0e9d86",
      "f3d7e1b4-a052-4e9f-8c63-8b4c5a1f0e97"
    ]
  },
  "narration": {
    "label": "서술",
    "ids": [
      "d6e649df-213d-49bc-81fe-cc17c8e73491",
      "d72af435-6568-454e-9ed5-aeeb079a55bb",
      "0908e4f6-a475-4ec6-be3c-1640225c690a",
      "7c8ce8f6-46c2-4035-89b0-6beac7ac5c6c",
      "e2f653f7-fbd0-4565-9ad1-ee2ef67a2bce"
    ]
  },
  "dialogue": {
    "label": "대화",
    "ids": [
      "02f90aa5-83a7-4799-b7f6-4de37111c69f",
      "353d0187-4c2b-4104-a2bb-c1920e4e174d",
      "d2c6ab81-6ae3-4880-8d50-43b2bc9326c6",
      "b9a5f748-bd71-41d5-bbb3-432ecb23a1f8"
    ]
  },
  "relationships": {
    "label": "관계",
    "ids": [
      "ef8c52ca-4c07-423d-8bc7-7600ca364cd0",
      "ce6efb5d-fe0f-4dbf-9a9c-4402c4132170",
      "ad03f5c8-49fe-41fa-9fb3-6edd272bbce2",
      "2b07f8a7-a4c8-45fd-952c-839353905dea"
    ]
  },
  "character": {
    "label": "캐릭터 시점",
    "ids": [
      "7805eb87-f271-4308-96e5-1343f9a2d1ba",
      "5a8d0204-d0df-4773-b501-23f0a2552769"
    ]
  },
  "user": {
    "label": "내 시점",
    "ids": [
      "c4311841-0509-4578-8864-9ebd0c1e7236",
      "7ee86bcd-2311-496c-ae0c-2ef13e5d5dc7",
      "49c0c04e-ef52-4817-8430-f08644d7c382"
    ]
  },
  "tense": {
    "label": "시제",
    "ids": [
      "1975aa43-f0ba-402b-b12f-e708c40d931d",
      "7c8282df-eb71-4803-a43c-962363942a88"
    ]
  },
  "thoughts": {
    "label": "속마음",
    "ids": [
      "34c55900-90a8-4770-a8a3-6f535579f6cd",
      "b3b14ca1-4c8c-4539-a9c3-a2fcb2771c40"
    ]
  },
  "asterisks": {
    "label": "별표",
    "ids": [
      "16879fbb-850b-4c0a-b25a-30c6911e3f9f",
      "3307748d-b371-4b03-9cf3-d3cac99b8c7c"
    ]
  },
  "explicit": {
    "label": "성인 표현",
    "ids": [
      "6537edf0-8331-4e7e-841a-86655f5a5a9c",
      "1d816ec2-2c8f-4e92-81d1-18021dbfedd0",
      "668ed810-9070-44cd-830b-3f295fb58c03"
    ]
  },
  "tracker": {
    "label": "시간 표시",
    "ids": [
      "4e6b48fe-f9f6-41e7-b910-dc6f13d15cfd",
      "9056ce79-fcf0-443e-aa6f-ae6b8929ece2"
    ]
  },
  "tension": {
    "label": "전개 긴장감",
    "ids": [
      "c858bd65-2e20-4b39-b481-9c8d54fe1dc9",
      "e0ffb643-674b-42a1-bb0b-076e4b7ad3d7",
      "fff18557-018d-4856-9497-2f47a6ef2b2a"
    ]
  },
  "status": {
    "label": "상태창 범위",
    "ids": [
      "bf1386b1-1257-41c6-96b6-efb46e2db8ad",
      "f2a63bb5-7bf4-4a2d-9767-293fe609ef60"
    ]
  },
  "reasoning": {
    "label": "추론",
    "ids": [
      "f355912c-d2a8-4823-85e9-cbb01820af83",
      "86373739-207c-44d9-8af4-147312c4724a",
      "7f5495fd-d06b-41be-ab28-5962a64456b1"
    ]
  },
  "companions": {
    "label": "친구들 반응 방식",
    "ids": [
      "ee9417ca-55ce-42c8-a582-63f1ce5b46c6",
      "35e32cf4-0331-4146-8ffb-fe3b1b1347a5"
    ]
  }
};
