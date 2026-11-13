// 생성 파일 — tools/build-css.cjs (tools/css-gates.cjs · tools/css-gates.json). 고치지 말 것.
// 켜짐 시트: body 에 클래스(classes) 나 접두사(prefixes) 로 시작하는 클래스가 하나라도 붙을 때 필요해요(src/lite.js syncGateCss). 차례 = 붙는 차례.
export const GATE_SHEETS = [{"id":"md","file":"./markdown.gen.css","prefixes":["salty-md-"],"classes":[]},{"id":"outline","file":"./gate-outline.gen.css","prefixes":[],"classes":["salty-demink-outline","salty-outline"]},{"id":"type","file":"./gate-type.gen.css","prefixes":[],"classes":["salty-indent","salty-namerow-center","salty-namerow-right","salty-user-namerow-center","salty-user-namerow-right"]}];
// 테마 설정 창(.salty-panel) 안에서만 맞는 규칙 시트(src/lite.js panelCssReady) — 없으면 null
export const PANEL_SHEET = "./panel.gen.css";
