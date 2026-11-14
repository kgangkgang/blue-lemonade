// 이 엔진의 Error.stack 에 await 너머 부른 쪽(비동기 프레임)이 남나 — 남의 확장 기능 다리(src/ext-bridge.js)가 한 번 재요.
//   크롬(V8)은 「at async …」로 남기고, 사파리는 안 남기고, 파이어폭스는 개발자 도구를 닫으면 안 남기는 게 기본이에요.
//   함수 이름에 기대지 않아요 — 묶음 도구(esbuild minify)가 이름을 한두 글자로 줄여서, 이름 찾기는 배포본에서 틀려요(11-14 검토 M1).
//   대신 「이 파일 주소」가 스택에 몇 줄 나오나를 세요: await 뒤에 만든 Error 의 스택에 이 파일 줄이 둘(안쪽 + 기다리는 바깥) 이상이면 남는 엔진이에요.
//   주소는 import.meta.url 이라 줄이기와 상관없어요. 따로 받는 작은 조각이라(ext-bridge.js 가 import() 로) 시험이 배포본 조각을 그대로 불러 볼 수 있어요.
//   시험: tools/tests/ext-bridge-async-probe.mjs (소스 · 실제 dist 조각 둘 다)
export const ASYNC_FRAMES_MARK = 'bl-async-frames-v1';
const SELF = (() => { try { return new URL(import.meta.url).pathname; } catch { return ''; } })();

/** 스택 글 → true(남음) · false(안 남음) · null(못 잼: 스택이나 이 파일 주소가 없음) */
export function asyncFramesIn(text, self = SELF) {
    const body = String(text ?? '');
    if (!body.trim() || !self) return null;
    let lines = 0;
    for (const line of body.split('\n')) if (line.includes(self)) lines += 1;
    return lines === 0 ? null : lines >= 2;
}

async function probeInner() { await null; return String(new Error(ASYNC_FRAMES_MARK).stack || ''); }
async function probeOuter() { const text = await probeInner(); return text; }

/** 한 번 재요 → true · false. 못 재면 true(받은 때의 스택을 달지 않는 예전 동작) */
export async function probeAsyncFrames() {
    try { const found = asyncFramesIn(await probeOuter()); return found === null ? true : found; } catch { return true; }
}
