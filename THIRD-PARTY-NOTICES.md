# 출처와 라이선스

Blue Lemonade는 GNU Affero General Public License v3.0 조건으로 배포합니다. [라이선스 전문](LICENSE).
원작자 및 기여자의 저작권과 기존 고지를 유지합니다. 이 수정판은 원작자의 공식 배포나 보증을 의미하지 않으며 무보증으로 제공합니다.

## 기반 테마와 내장 확장

| 구성요소 | 원작자·출처 | 라이선스 |
|---|---|---|
| Character Assets | [tincansimagine](https://github.com/tincansimagine/character-assets) / 공유 게시글 작성자 「깡」 | [공유 허락 댓글](https://kkangtong.xyz/posts/122931#comment-7bd0d60e-f2f9-4c2c-9f42-4f395873fa17) · [별도 고지](src/addons/assets/NOTICE.md) |
| 기반 테마 Moonlit Echoes Theme | [RivelleDays](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme) | [AGPL-3.0](LICENSE) |
| LLM Translator | [1234anon](https://github.com/1234anon/llm-translator) / 수정판 [NamelessKkang](https://github.com/NamelessKkang/llm-translator-custom) | [AGPL-3.0](src/addons/translator/LICENSE) |
| Prompt Panel | [anon4961](https://github.com/anon4961/prompt-panel) / [개인개조+++ 게시글 작성자 「깡」](https://kkangtong.xyz/posts/138394) | [AGPL-3.0](src/addons/prompt/LICENSE) |
| CustomThemeStyleInputs | Copyright (c) 2025 [IceFog72](https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs) | [MIT 전문](src/addons/customstyle/LICENSE) |

Prompt Panel은 사용자 제공 개인개조+++ 공유본을 기반으로 수정했습니다. [원작 소개글](https://kkangtong.xyz/posts/87408). 추가 수정자의 이름은 공유 게시글에 표시된 이름을 따릅니다.

2026-09-24 Blue Lemonade 수정: LLM 번역·Prompt Panel·CustomThemeStyleInputs 내장, 설정 화면 연결과 사용 모드 선택, Prompt Panel 상단 탭·도움말·현재 연결 및 직접 연결, 모바일 UI 정리. 각 원작의 기존 라이선스 전문은 해당 폴더에 보존합니다.

Character Assets는 원작자의 개인 수정본 공유 허락에 따라 포함합니다. 원작에 표준 라이선스가 별도 명시된 것으로 간주하지 않으며, 원작 코드의 권리·출처와 공유 허락은 [별도 고지](src/addons/assets/NOTICE.md)를 따릅니다.

## 포함 라이브러리

- [omggif](https://github.com/deanm/omggif) 1.0.10의 GIF writer, Dean McNamee, MIT. 전문: [gif-writer.js](src/vendor/gif-writer.js).
- [image-q](https://github.com/ibezkrovny/image-quantization) 4.0.0, Igor Bezkrovny 및 기여자, MIT. 포함된 NeuQuant·RgbQuant 등 구성요소의 고지도 [image-q.js](src/vendor/image-q.js)에 보존합니다.

## 대응 소스와 빌드

[전체 소스](https://github.com/kgangkgang/blue-lemonade). 배포 ZIP에도 편집 가능한 JavaScript, 분할 CSS 원본, HTML 템플릿, 빌드 도구와 라이선스를 포함합니다. Node.js에서 `node tools/build-css.cjs`, `node tools/build-plain-scripts.mjs`로 생성 파일을 재작성합니다. SillyTavern은 별도 설치합니다.
수정·재배포 시 기존 고지·변경 고지·무보증 고지를 보존하고 AGPL의 대응 소스 제공 조건을 지켜야 합니다. 별도 MIT 구성요소의 고지도 유지합니다.

## 라이선스 확인 기준

아래는 라이선스를 확인한 저장소 버전이며, 개인개조본과 모든 파일이 동일하다는 뜻은 아닙니다.

- [RivelleDays/SillyTavern-MoonlitEchoesTheme · 5336f368a418](https://github.com/RivelleDays/SillyTavern-MoonlitEchoesTheme/blob/5336f368a41871275317c60a5bc9a806d59f4000/LICENSE)
- [anon4961/prompt-panel · 80f43cef9cdd](https://github.com/anon4961/prompt-panel/blob/80f43cef9cdd5ee9b93540cc84a9fe8b14cdec93/LICENSE)
- [NamelessKkang/llm-translator-custom · e5ea9e35c4b4](https://github.com/NamelessKkang/llm-translator-custom/blob/e5ea9e35c4b4e7b9798ae48849606ba85787d872/LICENSE)
- [IceFog72/SillyTavern-CustomThemeStyleInputs · a001f9ebfcf2](https://github.com/IceFog72/SillyTavern-CustomThemeStyleInputs/blob/a001f9ebfcf2e41de1904e631d5884032b8b319b/LICENSE)
