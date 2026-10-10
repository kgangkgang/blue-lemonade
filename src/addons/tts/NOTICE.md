# TTS

이 내장판은 Blue Lemonade의 TTS 코드와 기존 `lemon_voice` 설정 형식을 사용합니다. Blue Lemonade 코드에는 저장소의 라이선스가 적용되며, 아래 외부 코드·효과음에는 각각의 고지를 함께 보존합니다.

각 음성 서비스와 모델의 이름은 해당 서비스의 식별을 위해 사용합니다. 이 애드온은 서비스의 API 클라이언트이며, API 키·계정·음성 모델·개인 복제 목소리·개인 음성 샘플은 포함하지 않습니다. 연결한 서비스와 목소리의 사용 조건은 해당 제공자의 조건을 따릅니다.

## MultiCast TTS

- 원본: [JINSIN2/MultiCast-TTS](https://github.com/JINSIN2/MultiCast-TTS).
- 가져온 기준: 버전 3.0.8, 커밋 [`f48ebeef9b19d814bf8d4568af13613544007e63`](https://github.com/JINSIN2/MultiCast-TTS/tree/f48ebeef9b19d814bf8d4568af13613544007e63).
- 원본 코드 저작권: **Copyright (c) 2026 JINSIN2**. 원본 manifest의 저자 표기: **Cao Cao & Claude**.
- 코드 라이선스: **MIT**. 원문의 저작권·허가·면책 조항 전체는 [LICENSE-MultiCast.txt](LICENSE-MultiCast.txt)에 보존합니다.
- 반영 범위: `src/sfx-library.js`의 내장 효과음 목록, 영어 키워드, 인접 단어·접두어와 정확한 일치에 가중치를 주는 매칭 및 동일 태그의 변형 선택 방식. 커스텀 효과음 우선 매칭과 효과음 팩 호환은 원본 동작을 참고했습니다. 대본 편집·효과음 배치·반복/겹침 재생은 MultiCast의 사용자 흐름을 참고해 Blue Lemonade의 기존 분석·재생·저장 구조에 맞췄습니다.
- Blue Lemonade 수정: 한국어 이름·분류·검색어, 기존 TTS와 연결, 별도 IndexedDB 저장, 파일·팩 검증 및 용량 한도, 중지·일시정지 중 비동기 로드 취소 보호. 원본 전체 확장을 설치하거나 별도 유료 효과음 생성 API를 호출하지 않습니다.

## 내장 효과음 47개

`sfx/*.mp3`는 위 고정 커밋에서 **바이트 변경 없이** 가져왔습니다. 원본 `index.js`는 이 번들 효과음을 **CC0**로 표기합니다([원본 고지](https://github.com/JINSIN2/MultiCast-TTS/blob/f48ebeef9b19d814bf8d4568af13613544007e63/index.js#L1465)).

이는 원본 저장소의 표기에 근거한 것이며, **개별 원음의 최초 제작자·원출처 및 원출처 라이선스까지 독립적으로 확인한 것은 아닙니다.** 코드의 MIT 라이선스를 효과음의 개별 권리 근거로 대신하지 않습니다. 각 파일의 원본 URL·SHA-256·크기·CC0 표시 근거는 [sfx/SOURCES.json](sfx/SOURCES.json)에 기록합니다.

사용자가 추가한 효과음의 권리와 사용 조건은 해당 파일의 출처를 따릅니다. 이 고지가 사용자 파일에 새로운 이용 허락을 부여하지 않습니다.
