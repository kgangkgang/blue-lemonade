// 1.7.6 금지 묘사 찾기 워커 (spans.js 설명). 컴파일한 규칙 정규식을 이 워커가 들고 있는다.
// 2.0.4 core.js · spans.js 도 워커 주소의 ?v= 를 붙여 읽는다 — 정적 import './core.js' 는 버전이 없어, 업데이트 뒤에도 브라우저가
//   옛 core.js(가릴 곳 목록 PROTECTED 가 다른 판)를 줄 수 있었다. 못 읽으면 오류로 답해 화면 쪽이 화면 스레드 찾기로 넘어간다 (spans.js).
const version = new URL(self.location.href).search;
const ready = Promise.all([import(`./core.js${version}`), import(`./spans.js${version}`)])
    .then(([core, spans]) => spans.createSpanHandler({ compileRule: core.compileRule, findSpans: core.findSpans }));

self.onmessage = async ({ data }) => {
    try {
        const handle = await ready;
        self.postMessage({ id: data.id, spans: handle(data) });
    } catch (error) {
        self.postMessage({ id: data.id, error: String(error?.message ?? error) });
    }
};
