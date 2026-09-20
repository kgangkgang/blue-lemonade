// 저장 정리 — 닫힌 프롬프트 관리자의 토큰 계산 미루기 (1.1.0)
//
// 실리태번 프롬프트 관리자(AI 응답 설정 서랍 맨 아래)는 답장 · 수정 · 삭제 · 채팅 열기마다 renderDebounced() 로
// Generate(dryRun) 를 한 번 더 돌려 프롬프트 전체를 다시 만든다. 목록에 토큰 수를 적으려고. 폰(4× CPU)에서 한 번에 ~0.36초이고,
// 프리셋 변수 매크로가 다시 돌아 채팅 저장도 한 번 더 일어난다. 서랍이 닫혀 있으면 아무도 그 숫자를 보지 않는다.
// 그래서 목록이 안 보일 때 온 renderDebounced() 는 "다시 그려야 함"만 적어 두고, 목록이 보이기 시작하면 원래 renderDebounced() 를 한 번 부른다.
// - render() 를 바로 부르는 곳(서랍 안에서 켜고 끄기 · 편집 · 실제 전송)은 건드리지 않는다.
// - 미루는 동안에도 실제 전송은 그대로다 (전송은 자기 프롬프트를 새로 만든다).

/**
 * @param {object} env
 * @param {() => any} env.manager openai.js 의 promptManager (아직 없으면 null)
 * @param {() => boolean} env.enabled
 * @param {(el: Element) => boolean} env.visible 목록이 지금 화면에 그려지는지 (닫힌 서랍 = false)
 * @param {(el: Element, onChange: () => void) => (() => void)} env.watch 보이는 상태가 바뀔 수 있을 때 onChange. 돌려준 함수로 그만 본다
 * @param {() => void} [env.onChange]
 */
export function createPromptDefer(env) {
    const stats = { deferred: 0, rendered: 0, passed: 0 };
    /** @type {{ manager: any, original: Function } | null} */
    let hooked = null;
    let dirty = false;
    let unwatch = null;

    function note() {
        try { env.onChange?.(); } catch { /* 표시만 */ }
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

    /** 미뤄 둔 계산을 지금 (원래 renderDebounced 로) */
    function flush() {
        stopWatching();
        if (!dirty || !hooked) return false;
        dirty = false;
        stats.rendered++;
        note();
        hooked.original.call(hooked.manager);
        return true;
    }

    function onWatch() {
        const el = hooked?.manager?.containerElement;
        if (!dirty) return stopWatching();
        if (el && shown(el)) flush();
    }

    /** promptManager 가 생겼으면 renderDebounced 를 감싼다. 이미 감쌌거나 없으면 그대로 */
    function install() {
        const pm = env.manager();
        if (!pm || typeof pm.renderDebounced !== 'function') return false;
        if (hooked?.manager === pm) return true;
        const original = pm.renderDebounced;
        pm.renderDebounced = function saveDedupeRenderDebounced(...args) {
            const el = pm.containerElement;
            if (!env.enabled() || !el || shown(el)) {
                stats.passed++;
                return original.apply(this, args);
            }
            stats.deferred++;
            dirty = true;
            if (!unwatch) {
                try {
                    unwatch = env.watch(el, onWatch) ?? null;
                } catch {
                    unwatch = null;
                }
                if (!unwatch) {
                    // 볼 수단이 없으면 미루지 않는다
                    dirty = false;
                    stats.deferred--;
                    stats.passed++;
                    return original.apply(this, args);
                }
            }
            note();
        };
        hooked = { manager: pm, original };
        return true;
    }

    return {
        install,
        flush,
        dirty: () => dirty,
        installed: () => hooked !== null,
        stats,
    };
}
