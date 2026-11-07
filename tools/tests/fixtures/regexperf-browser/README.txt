실제 정규식 엔진 검사용 합성 자료예요.

출처는 Penterson/st-regex-perf의 e21e666bface5dca6c0ea83bcbce0c6e8fe03824예요.
tests/harness의 MIT 자료를 가져왔고 LICENSE에 저작권과 허가문을 보존했어요.
블루레몬 변경은 boot.js의 엔진 연결·실행 순서, index.html의 jQuery 경로, 새 lifecycle.js예요.

실리태번 소스는 여기에 복사하지 않아요. regex-perf-browser.mjs가 ST_ROOT/public의
정규식 엔진·이벤트·표시 훅을 읽어서 제공하고, utils.js의 regexFromString 및 script.js의
messageFormatting 중 정규식 단계까지를 실행 시 추출해요. 실제 사용자 data는 읽지 않아요.
macro 환경·캐릭터·프리셋·채팅·저장 함수는 합성 자료예요. 실제 API 호출은 없어요.
브라우저 요청은 검사 서버의 loopback 주소로 제한하고 종료 시 서버·브라우저를 닫아요.
읽은 ST 파일은 시작·종료 해시를 대조하고, 결과 보고서에 파일별 SHA256을 남겨요.

실행하려면 환경변수를 지정해요.
ST_ROOT: 검사할 실리태번 소스 경로예요.
CHROME_PATH: headless 실행이 가능한 Chromium 실행 파일 경로예요.
REGEX_BROWSER_DRIVER: puppeteer-core의 모듈 진입 파일 경로예요.
REGEX_REPORT: 선택 사항인 JSON 결과 저장 파일 경로예요.
명령은 저장소에서 node tools/tests/regex-perf-browser.mjs예요.

기본 설정을 포함한 5프로필 원문 비교, 8000개 빠른 치환 차등 검사, 캐시·macro·허용조건·
스와이프·명령·켜기/끄기·패치 공존·측정 취소를 검사해요. 의도적으로 스트리밍 생략을
켜는 allOn 프로필의 생성 중 표시만 원문 동등성에서 제외하고 나머지 출력은 그대로 비교해요.
영구 캐시·해시 키·퓨즈·브레이커 등 결과가 달라질 수 있는 선택 기능의 모든 조합을
전수 검사한 것은 아니에요. 실행 시간을 제품 성능 보증치로 사용하지 않아요.
