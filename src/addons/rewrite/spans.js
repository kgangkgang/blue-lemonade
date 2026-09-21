// 1.7.6 금지 묘사 찾기(findSpans)를 워커에서. 실리태번을 import하지 않아 node로 시험한다 (test-extension.mjs).
//
// 왜: 규칙 정규식은 giu 플래그의 긴 갈래(색 이름 수십 개 · \p{L})라 처음 실행할 때 컴파일이 비싸다 (PC 55ms, 폰 흉내 4배 CPU 0.2~0.4초).
// V8 은 한동안 안 쓴 정규식 코드를 메이저 GC 때 버리는데, 답 한 번 사이에 화면 스레드는 GC 를 여러 번 해서
// 답이 끝날 때마다(MESSAGE_RECEIVED) 거의 매번 다시 컴파일했다 — 1.7.4 에서 반으로 줄였지만 남은 몫이 답 끝의 긴 작업에 그대로 있었다.
// 워커는 할당이 적어 GC 가 드물어 컴파일한 코드가 남고, 남는 비용도 화면을 멈추지 않는다. 워커를 못 쓰면 예전처럼 화면 스레드에서 찾는다.

/**
 * 워커 쪽: 규칙 글(words)마다 컴파일한 정규식을 기억해 두고 찾는다.
 * 규칙은 JSON 사본이라 매번 새 객체 — findSpans 가 돌려준 규칙은 받은 배열의 번호로 바꿔 돌려준다.
 * @param {{ compileRule: Function, findSpans: Function }} core
 */
export function createSpanHandler({ compileRule, findSpans }, limit = 64) {
    const cache = new Map();
    return ({ text, rules }) => {
        const active = rules.map((rule) => {
            const key = String(rule.words ?? '');
            let regexes = cache.get(key);
            if (!regexes) {
                regexes = compileRule({ words: rule.words }).regexes; // compileRule 은 words 만 읽는다
                cache.set(key, regexes);
                if (cache.size > limit) cache.delete(cache.keys().next().value);
            }
            return { rule, regexes };
        });
        return findSpans(String(text ?? ''), active).map(span => ({
            start: span.start,
            end: span.end,
            rules: span.rules.map(rule => rules.indexOf(rule)),
        }));
    };
}

/**
 * 화면 쪽: find(text, active) → findSpans 와 같은 모양의 결과를 약속으로.
 * 워커가 안 만들어지거나 · 오류 · timeoutMs 안에 답이 없으면 그 뒤로는 fallback(= findSpans)만 쓴다.
 * @param {object} options
 * @param {() => Worker} options.createWorker
 * @param {(text: string, active: object[]) => object[]} options.fallback
 */
export function createSpanFinder({ createWorker, fallback, timeoutMs = 5000, setTimer = setTimeout, clearTimer = clearTimeout, warn = () => {} }) {
    let worker = null;
    let broken = false;
    let seq = 0;
    const waits = new Map();

    const fail = (reason) => {
        if (broken) return;
        broken = true;
        warn(reason);
        try { worker?.terminate(); } catch { /* 이미 끝남 */ }
        worker = null;
        const pending = [...waits.values()];
        waits.clear();
        for (const wait of pending) {
            clearTimer(wait.timer);
            wait.fallback();
        }
    };

    const ensure = () => {
        if (worker || broken) return worker;
        try {
            worker = createWorker();
            worker.onmessage = ({ data }) => {
                const wait = waits.get(data?.id);
                if (!wait) return;
                waits.delete(data.id);
                clearTimer(wait.timer);
                if (data.error || !Array.isArray(data.spans)) {
                    fail(data.error || 'bad reply');
                    wait.fallback();
                    return;
                }
                wait.done(data.spans);
            };
            worker.onerror = (event) => {
                event?.preventDefault?.();
                fail(event?.message || 'worker error');
            };
        } catch (error) {
            worker = null;
            broken = true;
            warn(error?.message || String(error));
        }
        return worker;
    };

    return {
        find(text, active) {
            const current = ensure();
            if (!current) return Promise.resolve(fallback(text, active));
            return new Promise((resolve) => {
                const id = ++seq;
                let settled = false;
                const finish = (spans) => {
                    if (settled) return;
                    settled = true;
                    resolve(spans);
                };
                const wait = {
                    done: raw => finish(raw.map(span => ({
                        start: span.start,
                        end: span.end,
                        rules: span.rules.map(index => active[index].rule),
                        text: text.slice(span.start, span.end),
                    }))),
                    fallback: () => finish(fallback(text, active)),
                };
                wait.timer = setTimer(() => {
                    if (!waits.has(id)) return;
                    fail(`no reply in ${timeoutMs} ms`); // fail 이 이 기다림까지 fallback 으로 끝낸다
                }, timeoutMs);
                waits.set(id, wait);
                try {
                    current.postMessage({ id, text, rules: active.map(entry => JSON.parse(JSON.stringify(entry.rule))) });
                } catch (error) {
                    fail(error?.message || String(error));
                }
            });
        },
        get broken() {
            return broken;
        },
    };
}
