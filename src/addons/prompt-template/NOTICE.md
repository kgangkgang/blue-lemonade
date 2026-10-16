# 프롬프트 템플릿 (ST-Prompt-Template)

이 애드온은 zonde306 의 SillyTavern 확장 **ST-Prompt-Template** 을 **수정 없이** ZIP 으로 담아, 실리태번의 `extensions/third-party/ST-Prompt-Template` 폴더에 설치 · 업데이트 · 삭제하는 테마 쪽 도구입니다. 원본 코드는 테마 안에서 실행하지 않고, 설치된 뒤에는 실리태번이 보통의 제3자 확장으로 불러옵니다.

## 원본

- 저장소: https://github.com/zonde306/ST-Prompt-Template
- 저작권: zonde306 및 원본 저장소의 기여자 (원본 manifest 의 author: zonde306)
- 라이선스: **GNU Affero General Public License v3.0** — 전문은 이 폴더의 [LICENSE](LICENSE) (원본 저장소의 LICENSE 그대로, ZIP 안에도 같은 파일이 들어 있습니다)
- 가져온 커밋: `d6f520d149aba146305b0b781ddd691d449c28d2` (2026-09-06, 기본 브랜치 main, manifest version 1.17.9)
- 담은 파일: [ST-Prompt-Template.zip](ST-Prompt-Template.zip) — 그 커밋의 git 추적 파일 245개 중 `dist/*.map` 소스맵 96개만 빼고 149개를 **바이트 그대로** 담았습니다. 파일별 크기 · SHA-256 · ZIP 자체의 SHA-256 은 [SOURCE.json](SOURCE.json) 에 있습니다. ZIP 은 `node tools/prompt-template-bundle.mjs <원본 체크아웃>` 으로 같은 내용으로 다시 만들 수 있고, `--check` 로 담긴 것이 목록과 같은지 확인합니다.

## 수정 여부

- 원본 파일 수정: **없음**. ZIP 안 파일은 위 커밋과 바이트가 같습니다. 설치 폴더 이름도 원본의 고정 경로(`third-party/ST-Prompt-Template`)를 그대로 따릅니다.
- Blue Lemonade 가 더한 것 (테마와 같은 [AGPL-3.0](../../../LICENSE)): 이 폴더의 `index.js`(설치 · 업데이트 · 삭제 · 실리태번 설정 열기) · `style.css` · `ko-kr.js`(설정 화면 한국어 표 — 원본 `locales/zh-cn.json` 과 같은 키, 실리태번 언어가 한국어일 때 `addLocaleData` 로 더함) · `SOURCE.json` · `NOTICE.md`, 그리고 `tools/prompt-template-bundle.mjs`(ZIP 재생성 · 확인).
- 왜 설치형인가: 원본 번들(`dist/index.js`)이 설정 화면 HTML 과 워커를 `/scripts/extensions/third-party/ST-Prompt-Template/…` 고정 경로로 읽고, 실리태번 모듈을 `../../../../../script.js` 같은 상대 깊이로 가져옵니다. 테마 폴더 안에 두면 이 경로들이 맞지 않아 그대로 실행할 수 없습니다. 원본을 고치지 않으려면 그 이름의 폴더에 설치하는 길뿐입니다.

## 대응 소스

ZIP 안에 원본의 TypeScript 소스(`src/`), 빌드 설정(`webpack.config.js` · `package.json` · `package-lock.json` · `tsconfig.json` · `babel.config.json`)과 문서(`docs/`)가 함께 들어 있습니다. 같은 커밋을 받아 `npm install && npm run build` 하면 `dist/` 를 다시 만들 수 있습니다. 전체 이력은 원본 저장소에 있습니다.

ZIP 안 `dist/` · `libs/` 에는 원본이 묶어 배포하는 라이브러리(monaco-editor · EJS · @faker-js/faker · buffer · jsonrepair · zod · xxhash-wasm 등)가 각자의 라이선스로 원본 그대로 들어 있습니다. 목록과 판은 ZIP 안 `package.json` · `package-lock.json` 을 따릅니다.

## 실리태번 확장 관리와의 관계

- ZIP 으로 설치한 폴더에는 `.git` 이 없어 실리태번 확장 관리의 git 업데이트가 적용되지 않습니다. 업데이트는 테마의 이 애드온(담긴 판)으로 합니다. 실리태번 버전이 바뀐 직후의 자동 업데이트는 이 폴더에서 「업데이트 실패」 알림을 한 번 띄울 수 있으며 기능에는 영향이 없습니다.
- 실리태번 확장 관리(git)로 이미 설치한 폴더가 있으면 이 애드온은 덮어쓰거나 지우지 않고 안내만 합니다.
- 삭제는 ZIP 설치 도우미의 백업 길을 그대로 써서 폴더 전체를 백업에 옮깁니다. 복원은 ZIP 설치 창의 백업 목록에서 합니다.

이 고지는 원작자의 후원 · 보증을 뜻하지 않으며, 파일은 무보증으로 제공됩니다.
