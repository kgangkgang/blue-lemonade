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
| Prompt Panel | [anon4961](https://github.com/anon4961/prompt-panel) / [개인개조+++ 게시글 작성자 「깡」](https://kkangtong.xyz/posts/138394) | [AGPL-3.0](src/addons/prompt/LICENSE) |
| CustomThemeStyleInputs | Copyright (c) 2025 [IceFog72](https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs) | [MIT 전문](src/addons/customstyle/LICENSE) |
| Prompt Template (ST-Prompt-Template) · 설치형, 원본 무수정 | [zonde306](https://github.com/zonde306/ST-Prompt-Template) | [AGPL-3.0 전문](src/addons/prompt-template/LICENSE) · [별도 고지](src/addons/prompt-template/NOTICE.md) |

Prompt Panel은 사용자 제공 개인개조+++ 공유본을 기반으로 수정했습니다. [원작 소개글](https://kkangtong.xyz/posts/87408). 추가 수정자의 이름은 공유 게시글에 표시된 이름을 따릅니다.

2026-09-24 Blue Lemonade 수정: LLM 번역·Prompt Panel·CustomThemeStyleInputs 내장, 설정 화면 연결과 사용 모드 선택, Prompt Panel 상단 탭·도움말·현재 연결 및 직접 연결, 모바일 UI 정리. 각 원작의 기존 라이선스 전문은 해당 폴더에 보존합니다.

Character Assets는 원작자의 개인 수정본 공유 허락에 따라 포함합니다. 원작에 표준 라이선스가 별도 명시된 것으로 간주하지 않으며, 원작 코드의 권리·출처와 공유 허락은 [별도 고지](src/addons/assets/NOTICE.md)를 따릅니다.

2026-09-30 Blue Lemonade 수정: TTS 1.3.0 내장, 엔진·목소리 등록과 캐릭터별 읽기, 별도 감정 분석 연결, 재생 표시 선택을 추가했습니다. 개인 API 키·음성 목록·개인 녹음은 포함하지 않습니다. 이후 추가한 공개 효과음의 출처와 조건은 아래에 구분합니다.

## 포함 라이브러리

- [omggif](https://github.com/deanm/omggif) 1.0.10의 GIF writer, Dean McNamee, MIT. 전문: [gif-writer.js](src/vendor/gif-writer.js).
- [image-q](https://github.com/ibezkrovnyi/image-quantization) 4.0.0, Igor Bezkrovny 및 기여자, MIT. 포함된 NeuQuant·RgbQuant 등 구성요소의 고지도 [image-q.js](src/vendor/image-q.js)에 보존합니다.

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

2026-10-10 Blue Lemonade TTS 1.5.0: [JINSIN2/MultiCast-TTS](https://github.com/JINSIN2/MultiCast-TTS), Copyright (c) 2026 JINSIN2, MIT. 내장 효과음 목록·매칭과 대본 편집·효과음 배치 흐름을 기존 TTS에 연결했습니다. [MIT 전문](src/addons/tts/LICENSE-MultiCast.txt) · [반영 범위와 변경 고지](src/addons/tts/NOTICE.md) · [음원 47개별 원본 URL·해시](src/addons/tts/sfx/SOURCES.json). 원본 커밋은 `f48ebeef9b19d814bf8d4568af13613544007e63`입니다. 음원은 원본 저장소의 CC0 표기를 따르며, 개별 녹음의 최초 출처·라이선스를 독립적으로 확인한 것은 아닙니다.

## 추가 효과음 42개 · 내장 효과음 총 89개

2026-10-10 TTS 1.5.1에서 생활 효과음 16개를 추가했고, 같은 날 TTS 1.5.3에서 휴대폰 진동·의자 끌기·펜 뚜껑·냉장고 문·전기주전자·양치질 6개를, 2026-10-11 TTS 1.5.7에서 찰싹 한 번(Slaps)·엉덩이 찰싹 연속(Spanking) 2개를, 같은 날 TTS 1.6.0에서 친밀한 장면 효과음 10개(freesound, CC0)를 더했습니다. 2026-10-11 심장박동·펜으로 쓰기·성냥 켜기·벽난로 장작 타기·배에서 꼬르륵·코르크 마개 따기 6개(freesound, CC0)를 추가했습니다. 2026-10-11 TTS 1.6.8에서 발소리(SpliceSound, freesound, CC0) 1개를, 2026-10-12 TTS 1.7.1에서 반복용 질척이는 리듬(MrFossy, freesound, CC0) 1개를 추가했습니다. 기존 MultiCast 음원 47개는 변경하지 않았습니다(MultiCast 발소리의 표시 이름만 「군화 발소리」로 바꿨습니다).

- **BigSoundBank 20개**: Joseph SARDIN 19개, cecilegatina 1개(탁자 위 컵). 각 원본 페이지가 CC0를 표시하며 재배포를 허용합니다. [이용 조건](https://bigsoundbank.com/licenses.html) · [동봉 CC0 전문](src/addons/tts/sfx-extra/LICENSE-CC0.txt).
- **공유마당 4개**: 한국저작권위원회, CC BY 4.0. 원본은 [가위질_천천히_짧게](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263912), [과자_봉투_만지기_뜯기](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263932), [국물_마시기](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263933), [국자_나무탁자_내려놓기](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263935). [동봉 CC BY 전문](src/addons/tts/sfx-extra/LICENSE-CC-BY.txt).
- **freesound 18개**: SundayRecords(핥기 2개) · noahpardo(키스) · renrenrenrenren(키스 연속) · SoundDesignForYou(찔꺽) · tiddles451(찔꺽 연속) · cabusta9(침대 삐걱) · bmusic92(침대 삐걱 연속) · magnuswaker(꿀꺽) · aobowser(꿀꺽 연속) · Andy Jack / 업로드 JonasTisell(심장박동) · khenshom(펜으로 쓰기) · SamuelGremaud(성냥 켜기) · jmehlferber(벽난로 장작 타기) · XxBirdoxX(배에서 꼬르륵) · dr19(코르크 마개 따기) · SpliceSound(발소리) · MrFossy(질척이는 리듬). 각 소리 페이지가 Creative Commons 0을 표시합니다. 원본은 freesound가 공개한 고음질 미리듣기 MP3입니다. [동봉 CC0 전문](src/addons/tts/sfx-extra/LICENSE-CC0.txt).

Blue Lemonade는 새 생활 음원에서 한 동작 또는 짧은 연속 구간을 골라 음량·시작과 끝 페이드·MP3 인코딩을 조정했습니다. [파일별 원본 URL·저작자·라이선스·가공 내역·원본 및 배포 SHA-256](src/addons/tts/sfx-extra/SOURCES.json)을 보존합니다. 공유마당 음원이 들어간 WAV·영상 등을 공유할 때 제작자·원본 출처·CC BY 4.0 링크와 변경 여부를 함께 표시하고 기존 고지를 유지해야 합니다. CC BY 음원에 AGPL만 적용하거나 추가 이용 제한을 붙이지 않습니다. 원작자의 후원·보증을 의미하지 않으며, 파일은 무보증으로 제공합니다.

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
