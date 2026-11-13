# 퀵 리플라이 줄 접기 · 출처와 라이선스

- 원작: [Simple QR Bar Toggle](https://github.com/IceFog72/SillyTavern-SimpleQRBarToggle) — Copyright (c) 2025 IceFog72, MIT. 확인한 커밋 `b40082351f9a42dc8e6ed82b7c7a05e41fa3e397`(v0.0.1).
- 호환판: [Simple QR Bar Toggle (Blue Lemonade 호환판)](https://github.com/sdafaff346/stqrtoggle-mod) — 개조 sdafaff346, MIT(라이선스 파일의 저작권 줄은 원작 그대로 「Copyright (c) 2025 IceFog72」). 확인한 커밋 `f128dd857b39e394f2fd84bc9fc34bf369e7b9a1`(v0.1.0).
- MIT 전문: [LICENSE](LICENSE). 이 폴더의 파일은 MIT 조건의 저작권 고지와 허락 문구를 보존하고, 블루 레몬에이드 전체는 AGPL-3.0 으로 배포해요.

호환판의 방식(접힘을 `<body>` 의 class 하나로 두기, 입력판이 다시 그려지면 단추 되살리기, 열림 · 닫힘 기억, Enter · Space, 펼친 뒤 줄의 scroll 사건으로 테마가 양끝 흐림을 다시 재게 하기)을 따라 이 테마의 지연 로딩 구조로 옮겼어요.

2026-11-10 Blue Lemonade 수정:
- 설정 스위치(채팅 › 기타 「퀵 리플라이 줄 접기」, 기본 꺼짐)로 켜고 끄며, 켰을 때만 모듈과 스타일을 받아요. 끄면 단추 · 스타일 · 감시를 모두 걷어요.
- 단추 id · 접힘 표식 · 저장 열쇠를 이 테마 것으로 바꿨어요(`bl_qr_fold` · `<body>` 의 `data-bl-qr-folded` 속성 — 원작은 class · `blue_lemonade_qrfold`). 호환판 확장이 적어 둔 열림 상태는 처음 한 번 이어받아요.
- 원작 · 호환판 확장이 따로 켜져 있으면(그쪽 단추가 보이면) 내장 쪽이 물러나고 한 번 알려요.
- 처음 켰을 때는 펼친 채로 시작해요(호환판은 접힌 채로 시작).
- 켜 둔 동안 테마의 줄 앞 「QR 접기 단추」는 쉬어요(그 단추로 접어 둔 줄은 펼쳐지고, 끄면 그 단추와 접힌 상태가 그대로 돌아와요).
- 열 때 높이를 정하는 CSS 변수(`--SQRBT-open-panel-height`)는 옮기지 않았어요. 단추 모양 · 크기는 테마의 입력줄 아이콘 규칙을 그대로 써요.
