// 성능 보조 — 닫힌 프롬프트 목록은 열 때 그리기
//
// 실제로 보낼 때마다 openai.js prepareOpenAIMessages 가 promptManager.render(false) 를 부른다. 그 render 는 생성이 끝날 때까지
// 기다렸다가(100 ms 간격 확인) AI 응답 설정 서랍 안의 프롬프트 목록 전체를 다시 만든다 — 데우스 프리셋에서 폰(4× CPU)
// 기준 답 끝에 약 0.6초짜리 긴 작업 하나 (jQuery UI sortable, keyboard.js 관찰자, 헬퍼 번역 스크립트의 목록 번역까지).
// 서랍이 닫혀 있으면 아무도 그 목록을 보지 않는다. 그래서 목록이 안 보일 때 온 render(false) 는 "다시 그려야 함"만 적어 두고,
// 목록이 보이기 시작하면 원래 render(false) 를 한 번 부른다.
// - render() / render(true) (토큰 계산 포함), 서랍이 열려 있을 때의 호출은 그대로 보낸다. 그런 호출이 목록을 다시 만들면 적어 둔 것은 지운다.
// - 저장 정리(save-dedupe)의 '닫힌 프롬프트 관리자 토큰 계산 미루기'는 renderDebounced 를 미루는 별개 기능이라 겹치지 않는다.
// 8.0.5 묶기: 목록이 보일 때 render() / render(true)(미리 돌려 보기 + 목록 전체 다시 그리기)가 짧은 사이에 거듭 오면 마지막 한 번만 돌린다.
//   토글을 잇달아 누르면 실리태번은 누를 때마다 미리 돌려 보기와 목록 그리기를 한 번씩 했다(데우스 3 · 폰 흉내 한 번 2초 남짓).
//   누른 줄 표시는 prompt-choice.js 가 바로 바꾸므로, 그 뒤 계산은 마지막 상태로 한 번이면 같다. 보내기 쪽 render(false) 는 그대로 보낸다.

/**
 * @param {object} env
 * @param {() => any} env.manager openai.js 의 promptManager (없으면 null)
 * @param {() => boolean} env.enabled
 * @param {(el: Element) => boolean} env.visible
 * @param {(el: Element, onChange: () => void) => (null | (() => void))} env.watch
 * @param {() => any} [env.peer] 저장 정리의 promptDefer ({ dirty(), stats.rendered }) — 있으면 겹치는 목록 그리기를 한 번 줄인다
 * @param {number} [env.coalesceMs] 보이는 목록의 render(true) 를 이 시간 안의 마지막 한 번으로 묶는다 (0 · 없음 = 안 묶음)
 * @param {() => boolean} [env.coalesceWhen] 이 호출을 묶어도 되는가(없으면 늘) — 토글로 생긴 그리기만 묶고, 지우기 · 끼우기 · 편집 저장 · 끌어 옮기기 뒤 그리기는 바로 보낸다
 * @param {(fn: () => void, ms: number) => any} [env.setTimer]
 * @param {(id: any) => void} [env.clearTimer]
 */
export function createPromptListDefer(env) {
    const stats = { deferred: 0, rendered: 0, passed: 0, covered: 0, coalesced: 0, coalescedRuns: 0 };
    const setTimer = env.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = env.clearTimer || (id => clearTimeout(id));
    /** @type {{ self: any, args: any[], timer: any, first: number } | null} */
    let batch = null;   // 묶어 둔 render(true) — 마지막 호출의 인자
    /** @type {{ manager: any, original: Function } | null} */
    let hooked = null;
    let pending = false;
    let unwatch = null;
    let peerMark = null; // 미루기 시작할 때 저장 정리가 미뤄 둔 계산을 푼 횟수

    function peer() {
        try {
            const p = env.peer?.();
            return p && typeof p.dirty === 'function' && typeof p.stats?.rendered === 'number' ? p : null;
        } catch {
            return null;
        }
    }

    /** 저장 정리가 곧(또는 방금) 토큰 계산과 함께 목록을 다시 그리는가 */
    function peerCovers() {
        const p = peer();
        if (!p || peerMark === null) return false;
        try {
            return !!p.dirty() || p.stats.rendered > peerMark;
        } catch {
            return false;
        }
    }

    function stopWatching() {
        const stop = unwatch;
        unwatch = null;
        try { stop?.(); } catch { /* */ }
    }

    function mayCoalesce() {
        if (typeof env.coalesceWhen !== 'function') return true;
        try {
            return !!env.coalesceWhen();
        } catch {
            return false; // 모르면 묶지 않는다
        }
    }

    function shown(el) {
        try {
            return !!env.visible(el);
        } catch {
            return true; // 모르면 미루지 않는다
        }
    }

    /** 적어 둔 목록 그리기를 지금. force 가 아니면, 저장 정리가 곧 목록까지 다시 그릴 때는 건너뛴다 */
    function flush(force = false) {
        stopWatching();
        if (!pending || !hooked) return false;
        pending = false;
        const covered = !force && peerCovers();
        peerMark = null;
        if (covered) {
            stats.covered++;
            return false;
        }
        stats.rendered++;
        hooked.original.call(hooked.manager, false);
        return true;
    }

    function onWatch() {
        if (!pending) return stopWatching();
        const el = hooked?.manager?.containerElement;
        if (el && shown(el)) flush();
    }

    function install() {
        const pm = env.manager();
        if (!pm || typeof pm.render !== 'function') return false;
        if (hooked?.manager === pm) return true;
        const original = pm.render;
        pm.render = function perfAssistRender(afterTryGenerate = true, ...rest) {
            const el = pm.containerElement;
            if (afterTryGenerate !== false || !env.enabled() || !el || shown(el)) {
                // 이 호출이 목록을 다시 만든다 → 적어 둔 것은 필요 없다
                if (pending) { pending = false; peerMark = null; stopWatching(); }
                const ms = Number(env.coalesceMs) || 0;
                if (afterTryGenerate !== false && ms > 0 && env.enabled() && el && shown(el) && mayCoalesce()) {
                    // 짧은 사이에 거듭 오는 render(true) 는 마지막 한 번만 (처음 부른 뒤 ms × 4 를 넘기지는 않는다)
                    const now = Date.now();
                    if (batch) { clearTimer(batch.timer); stats.coalesced++; } else batch = { first: now };
                    batch.self = this; batch.args = [afterTryGenerate, ...rest];
                    const wait = Math.max(0, Math.min(ms, batch.first + ms * 4 - now));
                    batch.timer = setTimer(runBatch, wait);
                    return undefined;   // 원래 render 도 기다리는 약속을 돌려주지 않는다
                }
                stats.passed++;
                return original.call(this, afterTryGenerate, ...rest);
            }
            if (!unwatch) {
                try {
                    unwatch = env.watch(el, onWatch) ?? null;
                } catch {
                    unwatch = null;
                }
                if (!unwatch) {
                    stats.passed++;
                    return original.call(this, afterTryGenerate, ...rest);
                }
            }
            if (!pending) {
                const p = peer();
                peerMark = p ? p.stats.rendered : null;
            }
            pending = true;
            stats.deferred++;
            return undefined; // 원래 render 도 기다리는 약속을 돌려주지 않는다
        };
        hooked = { manager: pm, original };
        return true;
    }

    function runBatch() {
        const b = batch;
        batch = null;
        if (!b || !hooked) return;
        stats.coalescedRuns++;
        stats.passed++;
        hooked.original.call(b.self, ...b.args);
    }
    /** 묶어 둔 render(true) 를 지금 (끌 때 · 검사) */
    function flushBatch() {
        if (!batch) return false;
        clearTimer(batch.timer);
        runBatch();
        return true;
    }

    return { install, flush, flushBatch, pending: () => pending, batched: () => batch !== null, installed: () => hooked !== null, stats };
}
