# 배포 전 검사

검사 도구는 브라우저 런타임에 포함되지 않습니다. Python 표준 라이브러리와 Node.js만 필요합니다. 테스트는 가상 설정만 사용하며 실제 사용자 설정이나 대화를 읽지 않습니다.

## 필수 순서

1. 개발 원본을 수정하고 CSS를 빌드합니다. 채팅 CSS를 바꾸면 미리보기 CSS도 갱신합니다.
2. 설정 보존과 배포 검사 자체의 실패 검사를 실행합니다.
3. 원본에서 루트 배포본과 PC 확장의 런타임 파일만 동기화합니다. 사용자 설정은 건드리지 않습니다.
4. release_gate로 버전·모듈·CSS 빌드·배포본 일치를 확인한 뒤 ZIP을 만듭니다.
5. 공개 다운로드 위치로 복사한 ZIP을 다시 비교한 후 커밋/푸시합니다. 실패하면 배포하지 않습니다.

저장소 루트에서 실행:

~~~powershell
python -m unittest discover -s tools/tests -p test_release_gate.py
node tools/tests/settings-upgrade.mjs salty-ext
node salty-ext/tools/build-css.cjs --check
python tools/release_gate.py --kind theme --source salty-ext --mirror . --mirror "PC_EXTENSION_DIRECTORY" --build "OUTPUT_DIRECTORY/blue-lemonade-VERSION.zip"
python tools/release_gate.py --kind theme --source salty-ext --mirror . --zip "OUTPUT_DIRECTORY/blue-lemonade-VERSION.zip" --zip "docs/downloads/blue-lemonade-VERSION.zip"
~~~

실제 경로와 manifest의 버전으로 자리표시자를 바꿉니다. 기존 ZIP은 덮어쓰지 않습니다. 파일 목록은 런타임·manifest·README만 포함하며 작업 문서, 테스트, 개인 설정을 추가하면 ZIP 비교가 실패합니다. 코드의 설정 구조 버전은 배포 버전과 별개입니다.

장기기억도 같은 검사기를 사용합니다. manifest, defs.js의 VERSION, CSS의 --lm-css-version을 모두 비교하여 과거 CSS 표기 누락을 차단합니다:

~~~powershell
python tools/release_gate.py --kind memory --source "MEMORY_EXTENSION_DIRECTORY" --zip "OUTPUT_DIRECTORY/long-memory-VERSION.zip"
~~~

GitHub Actions는 커밋된 런타임과 현재 공개 ZIP을 비교하고 설정 이전 검사를 반복합니다. 푸시 뒤 CI는 사후 검증입니다. 배포 전 차단은 위 로컬 명령이 담당하므로 이를 생략하지 않습니다. 브랜치 보호나 필수 체크를 자동 설정하지는 않습니다.

## 긴 채팅 검사

로컬 HTTP 서버로 tests/long-chat.html을 엽니다. 기본은 루트 배포본, ?dev는 salty-ext 개발 원본입니다. SillyTavern/public 폴더가 저장소의 형제 위치에 있어야 호스트 CSS/jQuery를 읽습니다. 모든 메시지와 이미지는 합성이며 API 호출을 하지 않습니다. 검사 시작 버튼을 눌러 JSON 결과를 확인합니다.

100개/1,000개 메시지, 25개/250개 에셋, 장식 액자 켬/끔을 측정합니다. 설정 적용, 스크롤, 스트리밍 흉내, 반복 채팅 교체, 관찰 중인 삭제 이미지 해제, 유휴 콜백을 확인합니다. 화면을 전경에 두어야 프레임 시간이 의미 있습니다. 모바일 폭 모의 검사는 실제 휴대폰 하드웨어 성능을 보증하지 않습니다. 기기 부하에 따라 시간은 달라지므로 이전 결과와 같은 환경에서 비교합니다.
