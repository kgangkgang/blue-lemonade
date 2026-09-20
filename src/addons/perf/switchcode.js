// 저장 정리 — 코드로 채팅을 바꿀 때도 기다리기 (1.1.2)
//
// 1.1.1 의 막기는 "누름"만 본다. 그런데 채팅은 코드로도 바뀐다:
// - 확장 · 타번 헬퍼 스크립트의 SillyTavern.getContext().openCharacterChat(...) · openGroupChat(...) (재현: 답이 통째로 사라졌고,
//   바꿔 간 채팅의 같은 번호 메시지가 받던 답으로 덮여 저장됐다)
// - jQuery .trigger('click') — jQuery 는 먼저 자기 핸들러를 부르고 (실리태번의 목록 누름 처리가 여기서 돈다) 그 다음에야
//   진짜 click 을 쏘기 때문에, 창의 capture 리스너는 이미 늦다 (재현: 지난 채팅으로 바뀌고 답이 사라졌다)
// - reloadCurrentChat() — 정규식 편집기 저장/삭제, 페르소나 이름 바꾸기, 사용자 설정의 여러 토글과 "채팅 다시 불러오기",
//   캐릭터 이름 바꾸기, 토큰 다시 세기, /chat-reload, 타번 헬퍼 setChatMessages({refresh:'all'}) 가 모두 이것을 부른다.
//   답을 받는 중에 부르면 clearChat() 이 아직 파일에 없는 답을 지운다 (재현: 답이 사라졌다).
//
// 막는 대신 "기다렸다 그대로 한다". 스크립트가 기다리는 것을 망가뜨리지 않으려면 영원히 붙잡으면 안 되므로 maxMs 까지만 기다린다.
// reloadCurrentChat 은 실리태번 자신의 reloadChatMutex.callback 을 감싸면 코어까지 한 번에 잡힌다 (update 가 부를 때 읽는다).

/** getContext() 가 주는 함수 가운데 채팅을 바꾸는 것 (reloadCurrentChat 은 mutex 에서 잡는다) */
export const CODE_SWITCH_KEYS = Object.freeze(['openCharacterChat', 'openGroupChat']);

const DEFAULTS = Object.freeze({
    maxMs: 120000, // 이보다 오래 붙잡지 않는다 (스크립트가 영영 멈추지 않게)
    tickMs: 50,
    maxFlushes: 2,
});

/**
 * @param {object} env
 * @param {() => boolean} env.enabled 막기 · 저장 마치기 가운데 하나라도 켜져 있는지
 * @param {() => 'generating'|'finishing'|'saving'|null} env.busy 지금 바꾸면 잃는 것이 있는지
 * @param {() => Promise<any>} env.flush 남은 저장 마치기 (switchFlush.run)
 * @param {(ms: number) => Promise<void>} env.sleep
 * @param {() => number} env.now
 * @param {() => void} [env.onStart] 처음 붙잡을 때
 * @param {() => void} [env.onEnd] 다 놓았을 때
 */
export function createCodeGuard(env, options = {}) {
    const o = { ...DEFAULTS, ...options };
    const stats = { held: 0, timeouts: 0, reload: 0, switch: 0, trigger: 0, waitedMs: 0 };
    let holding = 0;

    /**
     * 지금 바꾸면 잃는 것이 있으면 없어질 때까지 기다린다.
     * @param {'reload'|'switch'|'trigger'} kind
     * @returns {Promise<'off'|'free'|'waited'|'timeout'>}
     */
    async function hold(kind) {
        let state = null;
        try {
            if (!env.enabled()) return 'off';
            state = env.busy();
        } catch {
            return 'off';
        }
        if (!state) return 'free';
        const t0 = env.now();
        const deadline = t0 + o.maxMs;
        stats.held++;
        if (kind && stats[kind] !== undefined) stats[kind]++;
        if (holding++ === 0) {
            try { env.onStart?.(); } catch { /* 표시만 */ }
        }
        let flushes = 0;
        let result = 'waited';
        try {
            for (;;) {
                let now = env.now();
                if (!state) break;
                if (now >= deadline) {
                    result = 'timeout';
                    stats.timeouts++;
                    break;
                }
                if (state === 'saving' && flushes < o.maxFlushes) {
                    flushes++;
                    try { await env.flush(); } catch { /* 그냥 기다린다 */ }
                } else {
                    await env.sleep(o.tickMs);
                }
                try { state = env.busy(); } catch { state = null; }
            }
        } finally {
            stats.waitedMs += Math.round(env.now() - t0);
            if (--holding === 0) {
                try { env.onEnd?.(); } catch { /* 표시만 */ }
            }
        }
        return result;
    }

    return { hold, stats, active: () => holding > 0 };
}

/** 'click' · 'click.namespace' · jQuery.Event 에서 눌림인지 (jQuery trigger 의 첫 인자) */
export function isClickTrigger(event) {
    const type = typeof event === 'string' ? event : (event && typeof event === 'object' ? event.type : '');
    return typeof type === 'string' && type.split('.')[0] === 'click';
}
