// 저장 정리 — 채팅을 바꾸기 전에 남은 저장 마치기 (1.1.0)
//
// 실리태번은 채팅을 바꿀 때 저장하지 않는다. 메시지 수정 · 스와이프(saveChatDebounced)나 채팅 변수 · 북마크 · 장기 기억
// (saveMetadataDebounced)은 1초 뒤에 저장하는데, 그 1초 안에 채팅을 바꾸면 clearChat() 이 그 저장을 취소하고 채팅을 비운다.
// 밀려서 빠진 저장(recovery.js)이 아직 기다리는 중이어도 마찬가지다.
//
// 여기서는 저장할 것이 남아 있을 때만 채팅 바꾸는 클릭을 잠깐 붙잡고, 지금 채팅을 실리태번 자신의 saveChatConditional() 로
// 한 번 저장한 뒤 그 클릭을 다시 보낸다.
// - 남은 것이 없으면(저장 대기 · 저장 중 · 복구 대기가 모두 없으면) 클릭을 건드리지 않는다. 저장도 더하지 않는다.
// - 채팅 파일을 직접 쓰지 않는다. 실리태번의 바꾸기 코드가 돌기 전, 아직 그대로인 지금 채팅만 저장한다.
// - 앞 저장을 5초까지 기다리고, 우리 저장이 5초(합쳐 8초)를 넘거나 실패하면 요청을 끊고 그냥 넘어간다.
// [1.1.1] 스트리밍 답을 마무리하는 중(잠금은 풀렸지만 실리태번의 끝 저장 전)이면 그 저장이 끝날 때까지 기다린다.
//         끊긴 스트림의 답(실리태번이 저장하지 않는다)도 바꾸기 전에 저장한다. 기다리는 사이 답 받기가 다시 시작되면 멈춘다 (blocked).

export const FLUSH_MARKER = 'saveDedupeSwitchFlush';

/** 채팅을 바꾸는 클릭 (선택자, 그 안에서 제외할 것). README 의 목록과 맞출 것 */
export const SWITCH_ENTRIES = Object.freeze([
    ['.character_select', null], // 캐릭터 목록 → selectCharacterById
    ['.group_select', null], // 그룹 목록 → openGroupById
    ['.select_chat_block', '.renameChatButton, .exportRawChatButton, .exportChatButton, .PastChat_cross'], // 지난 채팅 목록 → openCharacterChat · openGroupChat
    ['.mes_bookmark', null], // 메시지의 체크포인트 링크
    ['.mes_create_branch', null], // 분기 만들기 → 새 분기로 이동
    ['.swipe_picker_branch', null], // [1.1.2] 스와이프 고르기 창의 분기 만들기 → branchChat → 새 분기로 이동
    ['.recentChat', '.renameChat, .deleteChat, .pinChat'], // 첫 화면 최근 채팅
    ['#option_start_new_chat', null], // 새 채팅 시작 (지우고 시작 포함)
    ['#option_close_chat', null], // 채팅 닫기
    ['#option_back_to_main', null], // 원래 채팅으로
    ['#option_convert_to_group', null], // 그룹 채팅으로 바꾸기
    ['#newChatFromManageScreenButton', null], // 채팅 관리 화면의 새 채팅
    ['.renameChatButton', null], // 지난 채팅 이름 바꾸기 (지금 채팅이면 다시 불러온다)
]);

/** 클릭한 요소에서 채팅 바꾸기 항목을 찾는다 (없으면 null) */
export function matchSwitchEntry(target, entries = SWITCH_ENTRIES) {
    const start = target && typeof target.closest === 'function' ? target : target?.parentElement;
    if (!start || typeof start.closest !== 'function') return null;
    for (const [selector, not] of entries) {
        const el = start.closest(selector);
        if (!el) continue;
        if (not) {
            const inner = start.closest(not);
            if (inner && el.contains(inner) && inner !== el) continue;
        }
        return el;
    }
    return null;
}

/** 실리태번 debounce 저장 타이머를 만든 함수 이름 → 종류 (스택 문자열에서) */
export function timerKind(stack) {
    // getContext().saveMetadataDebounced() 처럼 객체에서 부르면 "at Object.saveMetadataDebounced" 로 찍힌다
    const m = /\n\s*at (?:async )?(?:[\w$<>]+\.)?(saveChatDebounced|saveMetadataDebounced) [([]/.exec(String(stack));
    if (!m) return null;
    return m[1] === 'saveChatDebounced' ? 'chat' : 'meta';
}

/**
 * setTimeout · clearTimeout 을 감싸 실리태번의 1초 저장 타이머(saveChatDebounced · saveMetadataDebounced)를 알아보고,
 * 아직 안 불린 것 · 불려서 저장 중인 것을 센다. 지연이 그 1초가 아닌 타이머는 스택도 안 본다.
 * @param {object} env
 * @param {(fn: Function, ms?: number, ...rest: any[]) => any} env.nativeSet
 * @param {(id: any) => void} env.nativeClear
 * @param {() => number} env.delay 실리태번 DEFAULT_SAVE_EDIT_TIMEOUT
 * @param {() => string} env.stack 지금 호출 스택 (짧게)
 * @param {() => { key: string|null, integrity: any }|null} env.live 지금 채팅
 * @param {() => boolean} env.enabled
 * @param {() => number} env.now
 */
export function createSaveTimers(env) {
    /** id → { kind, key, integrity, at } */
    const waiting = new Map();
    let running = 0;
    const stats = { tagged: 0, fired: 0, cleared: 0, flushed: 0 };

    // 4.7.8: 같은 handler(lodash debounce 의 timerExpired 등)는 스트리밍 중 걸음마다 다시 걸린다 — 종류(어디서 건 저장 타이머인지)는
    // 처음 한 번만 스택으로 가리고 기억한다. new Error().stack 이 답 하나에 수백 번 떠서 31ms@4x 였다.
    const kinds = new WeakMap();
    function saveDedupeSetTimeout(handler, ms, ...rest) {
        if (typeof handler !== 'function' || ms !== env.delay() || !env.enabled()) return env.nativeSet(handler, ms, ...rest);
        let kind = kinds.get(handler);
        if (kind === undefined) {
            try {
                kind = timerKind(env.stack()) || null;
            } catch {
                kind = null;
            }
            kinds.set(handler, kind);
        }
        if (!kind) return env.nativeSet(handler, ms, ...rest);
        let live = null;
        try { live = env.live(); } catch { live = null; }
        const rec = { id: null, kind, key: live?.key ?? null, integrity: live?.integrity, at: env.now() };
        rec.id = env.nativeSet(function saveDedupeTimerFired(...args) {
            waiting.delete(rec.id);
            stats.fired++;
            running++;
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                running--;
            };
            let result;
            try {
                result = handler.apply(this, args);
            } catch (error) {
                done();
                throw error;
            }
            if (result && typeof result.then === 'function') result.then(done, done);
            else done();
            return result;
        }, ms, ...rest);
        waiting.set(rec.id, rec);
        stats.tagged++;
        return rec.id;
    }

    function saveDedupeClearTimeout(id) {
        if (waiting.size && waiting.delete(id)) stats.cleared++;
        return env.nativeClear(id);
    }

    const matches = (rec, live) => !!live?.key && rec.key === live.key && rec.integrity === live.integrity;

    return {
        setTimeout: saveDedupeSetTimeout,
        clearTimeout: saveDedupeClearTimeout,
        /** 아직 안 불린 저장 타이머 수 (live 를 주면 그 채팅 것만) */
        waitingFor: (live) => (live === undefined ? waiting.size : [...waiting.values()].filter(rec => matches(rec, live)).length),
        /** 불려서 아직 끝나지 않은 타이머 콜백 수 (저장 잠금을 기다리거나 저장 중) */
        running: () => running,
        /** 그 채팅의 기다리는 타이머를 취소한다 (지금 대신 저장하므로) */
        cancelFor(live) {
            for (const [id, rec] of [...waiting]) {
                if (!matches(rec, live)) continue;
                waiting.delete(id);
                env.nativeClear(id);
                stats.flushed++;
            }
        },
        stats,
    };
}

const DEFAULTS = Object.freeze({
    limitMs: 5000, // 앞선 저장을 기다리고 우리 저장을 시작하기까지 붙잡는 최대 시간
    saveLimitMs: 5000, // 시작한 우리 저장을 기다리는 최대 시간 (폰에서 큰 채팅 저장은 수 초)
    maxTotalMs: 8000, // 전부 합쳐 이보다 오래 붙잡지 않는다
    idleMs: 150, // 저장이 이만큼 조용해야 "끝났다"고 본다 (실리태번 저장 대기는 0.1초마다 잠금을 본다)
    tickMs: 20,
    maxSaves: 2, // 한 번 붙잡는 동안 부르는 저장 수
    abortGraceMs: 1500, // 멈춘 저장을 끊은 뒤 잠금이 풀리기를 기다리는 시간
});

/**
 * @param {object} env
 * @param {() => number} env.now
 * @param {(ms: number) => Promise<void>} env.sleep
 * @param {() => boolean|undefined} env.isSaving 실리태번 isChatSaving
 * @param {ReturnType<typeof createSaveTimers>} env.timers
 * @param {() => { key: string|null, integrity: any, length: number }|null} env.live
 * @param {() => { key: string, since: number }|null} env.recoveryPending
 * @param {() => boolean} env.recoveryBusy 복구 저장 호출이 도는 중
 * @param {() => Promise<any>} env.save 실리태번 saveChatConditional (promise 를 그대로 돌려줄 것 — 스택으로 알아본다)
 * @param {(key: string, since: number) => boolean} env.savedSince 그 채팅의 저장이 since 뒤에 시작해 성공했는지
 * @param {() => void} [env.onChange]
 * @param {() => boolean} [env.finishing] [1.1.1] 스트리밍 답의 마무리(끝 저장까지)가 도는 중
 * @param {() => boolean} [env.generating] [1.1.1] 답을 받는 중 (기다림을 멈춘다)
 * @param {(live: object) => boolean} [env.erroredUnsaved] [1.1.1] 끊긴 스트림의 답이 저장되지 않음
 */
export function createSwitchFlush(env, options = {}) {
    const o = { ...DEFAULTS, ...options };
    const stats = { intercepted: 0, saved: 0, nothing: 0, failed: 0, timeout: 0, chatChanged: 0, gaveUp: 0, blocked: 0 };
    const log = [];
    let active = null;

    function note(ev, extra = {}) {
        log.push({ t: Math.round(env.now()), ev, ...extra });
        if (log.length > 60) log.shift();
        try { env.onChange?.(); } catch { /* 표시만 */ }
    }

    const sameChat = (a, b) => !!(a?.key && b?.key && a.key === b.key && a.integrity === b.integrity);

    const finishing = () => env.finishing?.() === true;
    const generating = () => env.generating?.() === true;
    const erroredUnsaved = live => !!live && env.erroredUnsaved?.(live) === true;

    function needsSave(live) {
        if (env.timers.waitingFor(live) > 0) return true;
        if (erroredUnsaved(live)) return true;
        const p = env.recoveryPending();
        return !!(p && p.key === live.key && !env.savedSince(live.key, p.since));
    }

    /** 저장할 것이 남았거나 저장 중인지 — 참일 때만 채팅 바꾸는 클릭을 붙잡는다 */
    function pending() {
        if (active) return true;
        if (env.timers.waitingFor() > 0 || env.timers.running() > 0) return true;
        if (env.isSaving() === true) return true;
        if (finishing()) return true;
        if (env.recoveryPending() || env.recoveryBusy()) return true;
        return !!env.erroredUnsaved && erroredUnsaved(env.live());
    }

    /** @returns {Promise<'idle'|'timeout'|'blocked'>} */
    async function waitIdle(deadline, state) {
        let idleSince = null;
        for (;;) {
            const now = env.now();
            if (generating()) return 'blocked';
            const saving = env.isSaving() !== false;
            const running = env.timers.running() > 0;
            const recovering = !!env.recoveryBusy();
            const ending = finishing();
            const busy = saving || running || recovering || ending;
            if (state) {
                if (saving) state.busy.saving++;
                if (running) state.busy.timer++;
                if (recovering) state.busy.recovery++;
                if (ending) state.busy.finishing++;
            }
            if (busy) idleSince = null;
            else if (idleSince === null) idleSince = now;
            else if (now - idleSince >= o.idleMs) return 'idle';
            if (now >= deadline) return 'timeout';
            await env.sleep(o.tickMs);
        }
    }

    // 이 함수 이름(FLUSH_MARKER)이 fetch 래퍼의 비동기 스택에 보이면 그 저장 요청은 여기서 부른 것이다 (멈추면 끊는다).
    async function saveDedupeSwitchFlush() {
        await env.save();
    }

    async function flush(state) {
        const deadline = state.t0 + o.limitMs;
        const first = env.live();
        let result = 'nothing';
        for (;;) {
            const waited = await waitIdle(deadline, state);
            if (waited !== 'idle') {
                if (result === 'nothing') result = waited;
                break;
            }
            const live = env.live();
            if (!sameChat(live, first) || !live.integrity) {
                if (result === 'nothing') result = 'chat-changed';
                break;
            }
            if (!needsSave(live)) break;
            if (state.saves >= o.maxSaves) {
                result = 'gave-up';
                break;
            }
            state.saves++;
            env.timers.cancelFor(live);
            const started = env.now();
            note('save', { attempt: state.saves, key: live.key });
            const saving = saveDedupeSwitchFlush();
            const saveDeadline = Math.min(started + o.saveLimitMs, state.t0 + o.maxTotalMs);
            const outcome = await Promise.race([
                saving.then(() => 'done', () => 'done'),
                env.sleep(Math.max(0, saveDeadline - env.now())).then(() => 'timeout'),
            ]);
            if (outcome === 'timeout') {
                state.controller?.abort();
                await Promise.race([saving.catch(() => {}), env.sleep(o.abortGraceMs)]);
                result = 'timeout';
                break;
            }
            if (!env.savedSince(live.key, started)) {
                result = 'failed';
                break;
            }
            result = 'saved';
        }
        return result;
    }

    /** 남은 저장을 마친다. 이미 도는 중이면 그것을 기다린다. 결과: saved | nothing | failed | timeout | chat-changed | gave-up | blocked */
    function run() {
        if (active) return active.promise;
        const state = active = {
            t0: env.now(),
            saves: 0,
            busy: { saving: 0, timer: 0, recovery: 0, finishing: 0 },
            controller: typeof AbortController === 'function' ? new AbortController() : null,
            promise: null,
        };
        note('start');
        state.promise = (async () => {
            let result = 'failed';
            try {
                result = await flush(state);
            } catch (error) {
                note('error', { error: String(error?.message ?? error).slice(0, 120) });
            } finally {
                active = null;
            }
            const key = { saved: 'saved', nothing: 'nothing', failed: 'failed', timeout: 'timeout', 'chat-changed': 'chatChanged', 'gave-up': 'gaveUp', blocked: 'blocked' }[result];
            if (key) stats[key]++;
            note(result, { ms: Math.round(env.now() - state.t0), saves: state.saves, busy: state.busy });
            return result;
        })();
        return state.promise;
    }

    return {
        pending,
        run,
        active: () => active !== null,
        note,
        /** 붙잡은 동안의 저장 요청에 달 AbortSignal (없으면 null) */
        signal: () => active?.controller?.signal ?? null,
        stats,
        log,
    };
}
