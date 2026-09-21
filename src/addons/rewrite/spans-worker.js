// 1.7.6 금지 묘사 찾기 워커 (spans.js 설명). 컴파일한 규칙 정규식을 이 워커가 들고 있는다.
import { compileRule, findSpans } from './core.js';
import { createSpanHandler } from './spans.js';

const handle = createSpanHandler({ compileRule, findSpans });

self.onmessage = ({ data }) => {
    try {
        self.postMessage({ id: data.id, spans: handle(data) });
    } catch (error) {
        self.postMessage({ id: data.id, error: String(error?.message ?? error) });
    }
};
