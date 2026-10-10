# TTS

이 내장판은 Blue Lemonade가 개발한 TTS 코드와 기존 `lemon_voice` 설정 형식을 사용합니다. Blue Lemonade 코드에는 저장소의 [AGPL-3.0 라이선스](../../../LICENSE)가 적용되며, 아래 외부 코드·효과음에는 각각의 고지를 함께 보존합니다.

각 음성 서비스와 모델의 이름은 해당 서비스의 식별을 위해 사용합니다. 이 애드온은 서비스의 API 클라이언트이며, API 키·계정·음성 모델·개인 복제 목소리·개인 음성 샘플은 포함하지 않습니다. 연결한 서비스와 목소리의 사용 조건은 해당 제공자의 조건을 따릅니다.

## MultiCast TTS

- 원본: [JINSIN2/MultiCast-TTS](https://github.com/JINSIN2/MultiCast-TTS).
- 가져온 기준: 버전 3.0.8, 커밋 [`f48ebeef9b19d814bf8d4568af13613544007e63`](https://github.com/JINSIN2/MultiCast-TTS/tree/f48ebeef9b19d814bf8d4568af13613544007e63).
- 원본 코드 저작권: **Copyright (c) 2026 JINSIN2**. 원본 manifest의 저자 표기: **Cao Cao & Claude**.
- 코드 라이선스: **MIT**. 원문의 저작권·허가·면책 조항 전체는 [LICENSE-MultiCast.txt](LICENSE-MultiCast.txt)에 보존합니다.
- 반영 범위: `src/sfx-library.js`의 내장 효과음 목록, 영어 키워드, 인접 단어·접두어와 정확한 일치에 가중치를 주는 매칭 및 동일 태그의 변형 선택 방식. 커스텀 효과음 우선 매칭과 효과음 팩 호환은 원본 동작을 참고했습니다. 대본 편집·효과음 배치·반복/겹침 재생은 MultiCast의 사용자 흐름을 참고해 Blue Lemonade의 기존 분석·재생·저장 구조에 맞췄습니다.
- Blue Lemonade 수정: 한국어 이름·분류·검색어, 기존 TTS와 연결, 별도 IndexedDB 저장, 파일·팩 검증 및 용량 한도, 중지·일시정지 중 비동기 로드 취소 보호. 원본 전체 확장을 설치하거나 별도 유료 효과음 생성 API를 호출하지 않습니다.

## MultiCast에서 가져온 효과음 47개

`sfx/*.mp3`는 위 고정 커밋에서 **바이트 변경 없이** 가져왔습니다. 원본 `index.js`는 이 번들 효과음을 **CC0**로 표기합니다([원본 고지](https://github.com/JINSIN2/MultiCast-TTS/blob/f48ebeef9b19d814bf8d4568af13613544007e63/index.js#L1465)).

이는 원본 저장소의 표기에 근거한 것이며, **개별 원음의 최초 제작자·원출처 및 원출처 라이선스까지 독립적으로 확인한 것은 아닙니다.** 코드의 MIT 라이선스를 효과음의 개별 권리 근거로 대신하지 않습니다. 각 파일의 원본 URL·SHA-256·크기·CC0 표시 근거는 [sfx/SOURCES.json](sfx/SOURCES.json)에 기록합니다.

사용자가 추가한 효과음의 권리와 사용 조건은 해당 파일의 출처를 따릅니다. 이 고지가 사용자 파일에 새로운 이용 허락을 부여하지 않습니다.

## 생활 효과음 16개 추가 · 총 63개

2026-10-10 TTS 1.5.1에서 아래 생활 효과음 16개를 추가했습니다. 기존 MultiCast 47개는 변경하지 않았습니다. 새 파일의 원본 제목·페이지·다운로드 URL·저작자·라이선스·원본 및 가공 파일 SHA-256은 [sfx-extra/SOURCES.json](sfx-extra/SOURCES.json)에 보존합니다.

### BigSoundBank · 12개 · CC0 1.0

- 저작자 **Joseph SARDIN**: 고양이 골골송·야옹, 물 따르기, 수돗물, 작은 물줄기, 빗소리, 키보드, 지퍼, 시계, 컵 안 숟가락, 동전(11개).
- 저작자 **cecilegatina**: 탁자 위 컵 소리(1개).
- 개별 원본 페이지의 CC0 표시와 재배포 허용 문구를 확인했습니다. [BigSoundBank 이용 조건](https://bigsoundbank.com/licenses.html) · [공식 CC0](https://creativecommons.org/publicdomain/zero/1.0/) · [동봉 전문](sfx-extra/LICENSE-CC0.txt).

### 공유마당 · 4개 · CC BY 4.0

저작(권)자와 출처는 **한국저작권위원회 / 공유마당**입니다. 각 개별 페이지가 CC BY 4.0을 명시합니다.

| 원본 제목 | 원본 페이지 | 동봉 파일 |
|---|---|---|
| 가위질_천천히_짧게 | [G905-13263912](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263912) | `sfx-extra/daily_scissors.mp3` |
| 과자_봉투_만지기_뜯기 | [G905-13263932](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263932) | `sfx-extra/daily_snack_bag.mp3` |
| 국물_마시기 | [G905-13263933](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263933) | `sfx-extra/daily_soup.mp3` |
| 국자_나무탁자_내려놓기 | [G905-13263935](https://gongu.copyright.or.kr/gongu/wrt/wrt/view.do?menuNo=100219&wrtSn=13263935) | `sfx-extra/daily_ladle.mp3` |

[공식 CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) · [동봉 전문](sfx-extra/LICENSE-CC-BY.txt). 이 음원이 들어간 WAV·영상 등을 재배포할 때 저작자·원본 페이지·라이선스 링크와 변경 여부를 표시하고 기존 고지를 유지해야 합니다. 음원에 AGPL만 적용하거나 CC BY가 허용한 이용을 추가로 제한하지 않습니다. 이 표기는 원저작자의 후원·보증을 의미하지 않으며, 음원은 무보증으로 제공됩니다.

### Blue Lemonade 가공 내역

생활 효과음 16개는 원본 녹음의 반복 동작 중 한 동작 또는 짧은 연속 구간만 추출했습니다. 동전은 첫 낙하와 잔향 1.05초, 키보드는 한 타이핑 묶음 2.5초, 골골송·비·물줄기는 7초입니다. 음량을 조정하고 시작 20ms·끝 30ms 페이드, MP3 128kbps / 44.1kHz 인코딩을 적용했습니다. 파일별 시작 시각·길이·음량 조정값은 `SOURCES.json`의 `modifications`에 기록했습니다. 모든 파일의 기본 반복 재생은 꺼져 있습니다.

공유마당 파일은 원본 페이지가 공개한 재생용 MP3를 가공했으며, 별도 원문 다운로드 파일과의 바이트 동일성은 확인하지 않았습니다.
