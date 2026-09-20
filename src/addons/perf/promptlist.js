// 성능 보조 — 닫힌 프롬프트 목록은 열 때 그리기
//
// 실제로 보낼 때마다 openai.js prepareOpenAIMessages 가 promptManager.render(false) 를 부른다. 그 render 는 생성이 끝날 때까지
// 기다렸다가(100 ms 간격 확인) AI 응답 설정 서랍 안의 프롬프트 목록 전체를 다시 만든다 — 데우스 프리셋에서 폰(4× CPU)
// 기준 답 끝에 약 0.6초짜리 긴 작업 하나 (jQuery UI sortable, keyboard.js 관찰자, 헬퍼 번역 스크립트의 목록 번역까지).
// 서랍이 닫혀 있으면 아무도 그 목록을 보지 않는다. 그래서 목록이 안 보일 때 온 render(false) 는 "다시 그려야 함"만 적어 두고,
// 목록이 보이기 시작하면 원래 render(false) 를 한 번 부른다.
// - render() / render(true) (토큰 계산 포함), 서랍이 열려 있을 때의 호출은 그대로 보낸다. 그런 호출이 목록을 다시 만들면 적어 둔 것은 지운다.
// - 저장 정리(save-dedupe)의 '닫힌 프롬프트 관리자 토큰 계산 미루기'는 renderDebounced 를 미루는 별개 기능이라 겹치지 않는다.

/**
 * @param {object} env
 * @param {() => any} env.manager openai.js 의 promptManager (없으면 null)
 * @param {() => boolean} env.enabled
 * @param {(el: Element) => boolean} env.visible
 * @param {(el: Element, onChange: () => void) => (null | (() => void))} env.watch
 * @param {() => any} [env.peer] 저장 정리의 promptDefer ({ dirty(), stats.rendered }) — 있으면 겹치는 목록 그리기를 한 번 줄인다
 */
export function createPromptListDefer(env) {
    const stats = { deferred: 0, rendered: 0, passed: 0, covered: 0 };
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

    return { install, flush, pending: () => pending, installed: () => hooked !== null, stats };
}
