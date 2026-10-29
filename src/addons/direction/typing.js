// (10-29 perf-typing) 전개 지시 · 항상 지시 입력칸의 타이핑 처리 (순수 — tools/tests/direction-typing.mjs 가 가짜 textarea 로 본다)
//
// 제보: 「전개 지시 입력칸에 타이핑하면 글자가 뚝뚝 끊기고, 『미안』을 치면 『ㅣ안』처럼 조합이 깨질 때가 있다」.
// 전에는 input 마다 값을 적고 바로 refreshButton() 을 불렀다 — 그 안의 refreshPopup() 이 창의 글(상태 · 발문) · class · data-* 를 다시 쓰고
// getComputedStyle · getClientRects 로 배치를 강제해, 글자마다 문서 전체 스타일 재계산과 body 감시자(실리태번 keyboard.js · 테마) 콜백이 돌았다.
// 한글 조합(compositionstart ~ compositionend) 중에 그 일이 끼면 조합 글자가 깨질 수 있다.
// 이제: 값(store)은 input 마다 바로 적고(저장은 원래 디바운스), 창 · 단추 다시 그리기는 조합 중엔 미루고 조합이 끝난 뒤 · 타자가 잠깐 멈춘 뒤 한 번만.

/**
 * @param {EventTarget & { value: string }} textarea
 * @param {object} env
 * @param {(value: string) => void} env.onValue 입력 값이 바뀔 때마다 (저장 · 상태)
 * @param {() => void} env.refresh 단추 · 창 다시 그리기 — 조합 중이 아닐 때 delay 뒤 한 번
 * @param {number} [env.delay] 다시 그리기까지 기다리는 ms (기본 250)
 * @param {(fn: () => void, ms: number) => any} [env.setTimer]
 * @param {(id: any) => void} [env.clearTimer]
 * @returns {{ composing: () => boolean, pending: () => boolean, flush: () => void, stop: () => void }}
 */
export function attachTypingRefresh(textarea, env) {
    const delay = Number.isFinite(env.delay) ? env.delay : 250;   // 타자 사이(100~200ms)보다 길게 — 글자마다 한 번씩 다시 그리지 않게
    const setTimer = env.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = env.clearTimer || (id => clearTimeout(id));
    let composing = false;
    let timer = null;

    function run() {
        timer = null;
        if (composing) return;   // 조합이 끝나면 compositionend 가 다시 건다
        env.refresh();
    }
    function schedule() {
        if (composing) return;
        if (timer !== null) clearTimer(timer);
        timer = setTimer(run, delay);
    }
    function onInput(event) {
        env.onValue(textarea.value);
        if (composing || event?.isComposing) return;   // 조합 중에는 창 · 단추를 건드리지 않는다
        schedule();
    }
    function onCompositionStart() {
        composing = true;
        if (timer !== null) { clearTimer(timer); timer = null; }
    }
    function onCompositionEnd() {
        composing = false;
        env.onValue(textarea.value);   // 브라우저에 따라 마지막 input 이 compositionend 앞에 오므로 끝난 값을 한 번 더 적는다
        schedule();
    }
    textarea.addEventListener('input', onInput);
    textarea.addEventListener('compositionstart', onCompositionStart);
    textarea.addEventListener('compositionend', onCompositionEnd);
    return {
        composing: () => composing,
        pending: () => timer !== null,
        flush() { if (timer !== null) { clearTimer(timer); timer = null; } if (!composing) env.refresh(); },
        stop() {
            if (timer !== null) { clearTimer(timer); timer = null; }
            textarea.removeEventListener('input', onInput);
            textarea.removeEventListener('compositionstart', onCompositionStart);
            textarea.removeEventListener('compositionend', onCompositionEnd);
        },
    };
}
