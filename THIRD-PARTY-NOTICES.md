# 출처와 라이선스

Blue Lemonade는 GNU Affero General Public License v3.0 조건으로 배포합니다. [라이선스 전문](LICENSE).
원작자 및 기여자의 저작권과 기존 고지를 유지합니다. 이 수정판은 원작자의 공식 배포나 보증을 의미하지 않으며 무보증으로 제공합니다.

## 기반 테마와 내장 확장

| 구성요소 | 원작자·출처 | 라이선스 |
|---|---|---|
| TTS | Blue Lemonade · MultiCast-TTS / JINSIN2 · BigSoundBank · freesound · 한국저작권위원회 / 공유마당 | Blue Lemonade 코드 [AGPL-3.0](LICENSE), MultiCast 코드 MIT, 음원 CC0·CC BY 4.0 등 출처별 조건 · [별도 고지](src/addons/tts/NOTICE.md) |
| Direction Manager · 전개 지시 | [temporary0723](https://github.com/temporary0723/Direction-Manager) | [수정·업로드 허락 게시글](https://kkangtong.xyz/posts/104303) · [별도 고지](src/addons/direction/NOTICE.md) |
| Character Assets | [tincansimagine](https://github.com/tincansimagine/character-assets) / 공유 게시글 작성자 「깡」 | [공유 허락 댓글](https://kkangtong.xyz/posts/122931#comment-7bd0d60e-f2f9-4c2c-9f42-4f395873fa17) · [별도 고지](src/addons/assets/NOTICE.md) |
| 기반 테마 Moonlit Echoes Theme | [RivelleDays](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme) | [AGPL-3.0](LICENSE) |
| LLM Translator | [1234anon](https://github.com/1234anon/llm-translator) / 수정판 [NamelessKkang](https://github.com/NamelessKkang/llm-translator-custom) | [AGPL-3.0](src/addons/translator/LICENSE) |
| 번역 리모컨 (LLM Translator 안) | 번역 리모컨 — 태번 헬퍼 스크립트(원작자의 허락으로 수정 · 통합) | 원작자의 수정 · 사용 허락 · 애드온 구조에 맞춰 다시 짠 [remote.js](src/addons/translator/remote.js) |
| Prompt Panel | [anon4961](https://github.com/anon4961/prompt-panel) / [개인개조+++ 게시글 작성자 「깡」](https://kkangtong.xyz/posts/138394) | [AGPL-3.0](src/addons/prompt/LICENSE) |
| 태번 헬퍼 한글화 사전(짧은 단추 · 메뉴 이름만) | 태번 헬퍼 [JS-Slash-Runner](https://github.com/N0VI028/JS-Slash-Runner)(KAKAA · N0VI028, [GitLab](https://gitlab.com/novi028/JS-Slash-Runner)) 화면 문구 | 원작은 [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0). 원작 문구가 든 [사전 파일](src/scripts/plain/helper.js)만 **PolyForm Noncommercial License 1.0.0** 조건으로 배포해요(비상업 목적만 · 테마의 다른 파일은 AGPL-3.0) |
| 설정 창 그림 표본 5장(src/preview-art/sample-*.webp) | 실리태번 기본 캐릭터 화면을 찍은 그림 — [SillyTavern](https://github.com/SillyTavern/SillyTavern) 기본 캐릭터 세라피나 표정 그림(`default/content/Seraphina/*.png`)과 기본 배경(`default/content/backgrounds/` 의 tavern day · landscape beach day · japan path cherry blossom · cityscape medieval night · landscape winter lake house)을 실리태번 화면에 띄워 찍고 webp 로 담음(그림 편집 없음) | [AGPL-3.0](LICENSE) |
| 날씨 그림 6장(src/weather-art/*.webp) | Blue Lemonade 작업 중 이미지 생성 도구로 만든 그림(원작 그림 없음 · 원본과 만든 지시문은 비공개 작업 기록에 보관) | 테마와 같은 조건 [AGPL-3.0](LICENSE) |
| 설정 창 투명 그림 표본(src/preview-art/character.webp) | [SillyTavern](https://github.com/SillyTavern/SillyTavern) 기본 캐릭터 세라피나 표정 그림(`default/content/Seraphina/joy.png`, webp 로 다시 담음) | [AGPL-3.0](LICENSE) |
| 채팅 정리 — 최근 채팅 · 채팅 폴더 · 여러 채팅 지우기(src/chat-organizer.js · src/chat-organizer-core.js · src/chat-organizer.css, 1.0.2) | [ChatsPlus](https://github.com/SoFizzticated/SillyTavern-ChatPlus)(SoFizzticated · 확인한 커밋 `ca5e6a8463e9a09c473d2a25967b6262def1d263`) · 한국어판 [ChatsPlus (Mod) 1.2.0-mod](https://github.com/sdafaff346/stjchatMod)(sdafaff346 · 커밋 `e8db163c7b98e991a8c4c63375a1d76a895463d2`). 원작이 감사를 밝힌 [RivelleDays](https://github.com/RivelleDays)(모양 다듬기 · SillyTavern-FriendlyUI 참고) · [Cohee1207](https://github.com/Cohee1207)(Extension-TopInfoBar 를 바탕으로 함) | 원작 모두 [AGPL-3.0](LICENSE). 기능 구성(캐릭터 관리 탭 · 최근 채팅 한 번 요청 · 고정 · 폴더 · 여러 개 지우기 흐름)과 날짜 이름표 규칙(Mod 의 ui-helpers.js)을 참고해 우리 구조 · 이름 · 디자인 규격으로 다시 썼어요. 원작 파일을 그대로 넣지 않았어요 |
| CustomThemeStyleInputs (커스텀 CSS 조절) | Copyright (c) 2025 [IceFog72](https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs) | [MIT 전문](src/addons/customstyle/LICENSE) |
| 장면 소리 · 분위기 음악 곡 8개 | OpenGameArt — cynicmusic · omfgdude · yd · Emma_MA · Joth · RandomMind | 음원 CC0 · [곡별 출처](src/scene-music/SOURCES.json) · [CC0 전문](src/scene-music/LICENSE-CC0.txt) |

Prompt Panel은 사용자 제공 개인개조+++ 공유본을 기반으로 수정했습니다. [원작 소개글](https://kkangtong.xyz/posts/87408). 추가 수정자의 이름은 공유 게시글에 표시된 이름을 따릅니다.

2026-09-24 Blue Lemonade 수정: LLM 번역·Prompt Panel·CustomThemeStyleInputs 내장, 설정 화면 연결과 사용 모드 선택, Prompt Panel 상단 탭·도움말·현재 연결 및 직접 연결, 모바일 UI 정리. 각 원작의 기존 라이선스 전문은 해당 폴더에 보존합니다.

Character Assets는 원작자의 개인 수정본 공유 허락에 따라 포함합니다. 원작에 표준 라이선스가 별도 명시된 것으로 간주하지 않으며, 원작 코드의 권리·출처와 공유 허락은 [별도 고지](src/addons/assets/NOTICE.md)를 따릅니다.

2026-09-30 Blue Lemonade 수정: TTS 1.3.0 내장, 엔진·목소리 등록과 캐릭터별 읽기, 별도 감정 분석 연결, 재생 표시 선택을 추가했습니다. 개인 API 키·음성 목록·개인 녹음은 포함하지 않습니다. 이후 추가한 공개 효과음의 출처와 조건은 아래에 구분합니다.

## 프리셋 지원 · 한글화 사전

프리셋을 고치지 않고 화면에 보이는 이름만 바꾸거나 고르기 단추를 더하는 기능이에요. 저장되는 이름 · 프롬프트 본문은 바꾸지 않아요. 프롬프트 본문은 담지 않아요.

| 대상 | 원작 · 출처 | 담은 것 · 조건 |
|---|---|---|
| 데우스 엑스 마키나 2.5 · V3 | [lsennn/Deus-ex-machina](https://github.com/lsennn/Deus-ex-machina), [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | [이름 사전](src/scripts/plain/deus.js) · [빠른 설정](src/scripts/plain/deus-qr.js) · 옵션 효과: 프롬프트 이름 · id 와 Blue Lemonade 가 쓴 설명만. **CC BY-NC-SA 4.0 조건으로 배포하는 파일**(원작 표시 정규식 · HTML 뼈대를 옮김 — 원작 CSS · 그림은 빼고 글은 지어냄): [미리보기 표본](src/deus-preview-samples.js), 시험 고정물 [translator-v3-module-fixtures.mjs](tools/tests/translator-v3-module-fixtures.mjs) · [translator-preset-fixtures.mjs](tools/tests/translator-preset-fixtures.mjs)(데우스 정규식 부분) |
| 과일 · 야한 과일(涩果) · 청과(青果) · 레모나 프리셋, 과일의 마음(果实之心) 스크립트 | 출처: 원작 배포본(라이선스 표기 없음 · 원작자 이름을 확인하지 못했어요) | [이름 사전](src/scripts/plain/fruit.js) · [화면 보조](src/scripts/plain/qingguo.js) · [과일의 마음 화면 문구 사전](src/scripts/plain/fruit-heart.js)(긴 변경 내역 · 도움말 문단은 빼고 메뉴 · 단추 이름 위주) · 위 시험 고정물의 해당 프리셋 정규식. 원문 문구의 권리는 원작자에게 있어요 |
| 솔라 V4(Gremlin Sola) 프리셋 | 출처: 원작 배포본(라이선스 표기 없음 · 원작자 이름을 확인하지 못했어요) | [이름 사전](src/scripts/plain/sola.js): 프롬프트 이름 · id 와 Blue Lemonade 가 쓴 설명만 · [빠른 설정](src/scripts/plain/deus-qr.js): 프리셋을 포함하지 않고, 실행할 때 지금 프리셋의 프롬프트 이름 · 순서 · 택1 묶음만 읽어요(구역 · 묶음 이름 규칙과 Blue Lemonade 가 쓴 탭 안내만 담음) |

## 포함 라이브러리

- [omggif](https://github.com/deanm/omggif) 1.0.10의 GIF writer, Dean McNamee, MIT. 전문: [gif-writer.js](src/vendor/gif-writer.js).
- [image-q](https://github.com/ibezkrovnyi/image-quantization) 4.0.0, Igor Bezkrovny 및 기여자, MIT. 포함된 NeuQuant·RgbQuant 등 구성요소의 고지도 [image-q.js](src/vendor/image-q.js)에 보존합니다.
- 글꼴 프리젠테이션 4 Regular · 7 Bold(PT& · 이주임) · [갈무리모노11](https://github.com/quiple/galmuri) 2.40.3(이민서), 둘 다 SIL OFL 1.1(원본 글꼴의 라이선스 칸). 글자 갈래별로 나눈 woff2 조각(수정본 — 글꼴 안 이름을 바꿈)만 [fonts/](fonts/SOURCES.json)에 담고, 원본 주소 · 해시 · 저작권은 [SOURCES.json](fonts/SOURCES.json), 전문은 [LICENSE-OFL.txt](fonts/LICENSE-OFL.txt). 다시 만들기 `python tools/build-fonts.py`.
- 글꼴 [리디바탕](https://www.sandollcloud.com/free-font/857/RIDIBatang)(ⓒ 리디주식회사)은 배포 파일에 담지 않아요. 글꼴 목록에서 고르면 브라우저가 공개 배포 주소(jsDelivr `projectnoonnu/noonfonts_twelve@1.0/RIDIBatang.woff`)에서 직접 받아요. 다른 목록 글꼴(Pretendard 등)도 같은 방식이에요.
- [Font Awesome Free](https://fontawesome.com/license/free) 6.5.2의 아이콘 이름 · 글자 번호 목록, Fonticons, Inc., 아이콘 CC BY 4.0 · 글꼴 SIL OFL 1.1 · 코드 MIT. 단추 아이콘 고르기 창이 쓰는 목록만 [role-icons-fa.gen.js](src/role-icons-fa.gen.js)에 담고, 글꼴은 SillyTavern이 싣는 것을 그대로 씁니다.

## 대응 소스와 빌드

[전체 소스](https://github.com/kgangkgang/blue-lemonade). 배포 ZIP에도 편집 가능한 JavaScript, 분할 CSS 원본, HTML 템플릿, 빌드 도구와 라이선스를 포함합니다. Node.js에서 `node tools/build-css.cjs`, `node tools/build-plain-scripts.mjs`로 생성 파일을 재작성합니다. SillyTavern은 별도 설치합니다.
수정·재배포 시 기존 고지·변경 고지·무보증 고지를 보존하고 AGPL의 대응 소스 제공 조건을 지켜야 합니다. 별도 MIT 구성요소의 고지도 유지합니다.

## 라이선스 확인 기준

아래는 라이선스를 확인한 저장소 버전이며, 개인개조본과 모든 파일이 동일하다는 뜻은 아닙니다.

- [RivelleDays/SillyTavern-MoonlitEchoesTheme · 5336f368a418](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/5336f368a41871275317c60a5bc9a806d59f4000/LICENSE)
- [anon4961/prompt-panel · 80f43cef9cdd](https://github.com/anon4961/prompt-panel/blob/80f43cef9cdd5ee9b93540cc84a9fe8b14cdec93/LICENSE)
- [NamelessKkang/llm-translator-custom · e5ea9e35c4b4](https://github.com/NamelessKkang/llm-translator-custom/blob/e5ea9e35c4b4e7b9798ae48849606ba85787d872/LICENSE)
- [IceFog72/SillyTavern-CustomThemeStyleInputs · a001f9ebfcf2](https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs/blob/a001f9ebfcf2e41de1904e631d5884032b8b319b/LICENSE)
- [zonde306/ST-Prompt-Template · d6f520d149ab](https://github.com/zonde306/ST-Prompt-Template/blob/d6f520d149aba146305b0b781ddd691d449c28d2/LICENSE)

## MultiCast-TTS 효과음과 대본 편집

2026-10-10 Blue Lemonade TTS 1.5.0: [JINSIN2/MultiCast-TTS](https://github.com/JINSIN2/MultiCast-TTS), Copyright (c) 2026 JINSIN2, MIT. 내장 효과음 목록·매칭과 대본 편집·효과음 배치 흐름을 기존 TTS에 연결했습니다. [MIT 전문](src/addons/tts/LICENSE-MultiCast.txt) · [반영 범위와 변경 고지](src/addons/tts/NOTICE.md) · [음원 47개별 원본 URL·해시](src/addons/tts/sfx/SOURCES.json). 원본 커밋은 `f48ebeef9b19d814bf8d4568af13613544007e63`입니다. 음원은 원본 저장소의 CC0 표기를 따르며, 개별 녹음의 최초 출처·라이선스를 독립적으로 확인한 것은 아닙니다(출처: 원작 확장 배포본 — 파일별 최초 출처 표기 없음). 일부 파일 메타데이터에 다른 효과음 묶음 이름이 남아 있는 것 등 관찰 기록은 [TTS 고지](src/addons/tts/NOTICE.md)에 있어요.

## 추가 효과음 44개 · 내장 효과음 총 91개

2026-10-10 TTS 1.5.1에서 생활 효과음 16개를 추가했고, 같은 날 TTS 1.5.3에서 휴대폰 진동·의자 끌기·펜 뚜껑·냉장고 문·전기주전자·양치질 6개를, 2026-10-11 TTS 1.5.7에서 찰싹 한 번(Slaps)·엉덩이 찰싹 연속(Spanking) 2개를, 같은 날 TTS 1.6.0에서 친밀한 장면 효과음 10개(freesound, CC0)를 더했습니다. 2026-10-11 심장박동·펜으로 쓰기·성냥 켜기·벽난로 장작 타기·배에서 꼬르륵·코르크 마개 따기 6개(freesound, CC0)를 추가했습니다. 2026-10-11 TTS 1.6.8에서 발소리(SpliceSound, freesound, CC0) 1개를, 2026-10-12 TTS 1.7.1에서 반복용 질척이는 리듬(MrFossy, freesound, CC0) 1개를 추가했습니다. 기존 MultiCast 음원 47개는 변경하지 않았습니다(MultiCast 발소리의 표시 이름만 「군화 발소리」로 바꿨습니다).

- **BigSoundBank 22개**: Joseph SARDIN 20개, Pierre SIBANARCO 1개(우산 아래 빗소리), cecilegatina 1개(탁자 위 컵). 각 원본 페이지가 CC0를 표시하며 재배포를 허용합니다. [이용 조건](https://bigsoundbank.com/licenses.html) · [동봉 CC0 전문](src/addons/tts/sfx-extra/LICENSE-CC0.txt).
- **공유마당 4개**: 한국저작권위원회, CC BY 4.0. 원본은 [가위질_천천히_짧게](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263912), [과자_봉투_만지기_뜯기](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263932), [국물_마시기](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263933), [국자_나무탁자_내려놓기](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263935). [동봉 CC BY 전문](src/addons/tts/sfx-extra/LICENSE-CC-BY.txt).
- **freesound 18개**: SundayRecords(핥기 2개) · noahpardo(키스) · renrenrenrenren(키스 연속) · SoundDesignForYou(찔꺽) · tiddles451(찔꺽 연속) · cabusta9(침대 삐걱) · bmusic92(침대 삐걱 연속) · magnuswaker(꿀꺽) · aobowser(꿀꺽 연속) · Andy Jack / 업로드 JonasTisell(심장박동) · khenshom(펜으로 쓰기) · SamuelGremaud(성냥 켜기) · jmehlferber(벽난로 장작 타기) · XxBirdoxX(배에서 꼬르륵) · dr19(코르크 마개 따기) · SpliceSound(발소리) · MrFossy(질척이는 리듬). 각 소리 페이지가 Creative Commons 0을 표시합니다. 원본은 freesound가 공개한 고음질 미리듣기 MP3입니다. [동봉 CC0 전문](src/addons/tts/sfx-extra/LICENSE-CC0.txt).

Blue Lemonade는 새 생활 음원에서 한 동작 또는 짧은 연속 구간을 골라 음량·시작과 끝 페이드·MP3 인코딩을 조정했습니다. [파일별 원본 URL·저작자·라이선스·가공 내역·원본 및 배포 SHA-256](src/addons/tts/sfx-extra/SOURCES.json)을 보존합니다. 공유마당 음원이 들어간 WAV·영상 등을 공유할 때 제작자·원본 출처·CC BY 4.0 링크와 변경 여부를 함께 표시하고 기존 고지를 유지해야 합니다. CC BY 음원에 AGPL만 적용하거나 추가 이용 제한을 붙이지 않습니다. 원작자의 후원·보증을 의미하지 않으며, 파일은 무보증으로 제공합니다.

## 장면 소리 · 분위기 음악 곡 8개

2026-10-17 장면 소리의 분위기 음악(일상 · 긴장 · 전투 · 로맨스 · 슬픔 · 신비 · 축제)에 OpenGameArt 의 CC0 곡 8개를 담았습니다. 각 원본 페이지가 License(s): CC0 을 표시합니다.

- cynicmusic — [Town Theme RPG](https://opengameart.org/content/town-theme-rpg) (일상)
- omfgdude — [Chill lofi inspired](https://opengameart.org/content/chill-lofi-inspired) (일상)
- yd — [Pressure](https://opengameart.org/content/pressure) (긴장) · [Shrine](https://opengameart.org/content/shrine) (신비)
- Emma_MA — [Determined Pursuit (epic orchestra loop)](https://opengameart.org/content/determined-pursuit-epic-orchestra-loop) (전투) · [At the end of hope](https://opengameart.org/content/at-the-end-of-hope) (슬픔)
- Joth — [Next to You](https://opengameart.org/content/next-to-you) (로맨스)
- RandomMind — [Medieval: King's Feast](https://opengameart.org/content/medieval-kings-feast) (축제)

Blue Lemonade는 모노로 바꾸고, 반복용이 아닌 곡은 반복 구간을 골라 끝 0.6초를 겹쳐 이음새 없이 반복되게 했으며, 평균 크기를 맞추고 봉우리를 눌러 MP3 80 kbps 로 다시 담았습니다. [파일별 원본 URL·저작자·라이선스·가공 내역·원본 및 배포 SHA-256](src/scene-music/SOURCES.json) · [동봉 CC0 전문](src/scene-music/LICENSE-CC0.txt).

## Mermaid 도표

Cohee1207 · [SillyTavern/Extension-Mermaid](https://github.com/SillyTavern/Extension-Mermaid), AGPL-3.0.
고정 커밋 62265d550ca3dc46737c09bddf0bf328fd1f3469.
Mermaid 11.12.3: Copyright (c) 2014–2022 Knut Sveidqvist, MIT.
2026-10-14 Blue Lemonade 수정: 지연 로딩, webpack 분리, 원문 보존 및 재시도, strict 렌더링.
[전체 저작권·의존 라이선스 전문](src/addons/mermaid/NOTICE.md),
[AGPL 전문](src/addons/mermaid/LICENSE),
[배포에 동봉한 대응 소스·빌드 안내](src/addons/mermaid/source/README.md).

## 프롬프트 템플릿 (ST-Prompt-Template)

zonde306 · [ST-Prompt-Template](https://github.com/zonde306/ST-Prompt-Template), AGPL-3.0.
고정 커밋 d6f520d149aba146305b0b781ddd691d449c28d2 (2026-09-06, manifest 1.17.9).
2026-10-17 Blue Lemonade: 원본을 수정 없이 ZIP([src/addons/prompt-template/ST-Prompt-Template.zip](src/addons/prompt-template/ST-Prompt-Template.zip), 그 커밋의 git 추적 파일 245개 중 소스맵 96개만 뺀 149개 · 바이트 동일)으로 담고, 실리태번 `extensions/third-party/ST-Prompt-Template` 에 설치 · 업데이트 · 삭제하는 테마 쪽 도구와 설정 화면 한국어 표를 더했습니다. 원본은 테마 안에서 실행하지 않습니다. ZIP 안에는 원본의 TypeScript 소스 · 빌드 설정과, 원본이 묶어 배포하는 라이브러리(monaco-editor · EJS · @faker-js/faker 등, 각자의 라이선스)가 원본 그대로 들어 있습니다.
[파일별 SHA-256](src/addons/prompt-template/SOURCE.json) · [반영 범위와 변경 고지](src/addons/prompt-template/NOTICE.md) · [AGPL 전문](src/addons/prompt-template/LICENSE). ZIP 다시 만들기: `node tools/prompt-template-bundle.mjs <원본 체크아웃>`, 확인: `--check`.

## 프롬프트 폴더 (아이디어 참고)

아이디어 참고: [URMIIE/SillyTavern-PromptFolders](https://github.com/URMIIE/SillyTavern-PromptFolders)(AGPL-3.0) — 코드는 옮기지 않음.
참고한 원본 커밋 8cd30867c2db421b492bb1cae8b32cb5a5258a85 (2026-11-04, manifest 1.2.6).
