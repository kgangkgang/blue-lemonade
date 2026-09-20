// 저장 정리 — 밀려서 빠진 채팅 저장 되살리기 (1.0.2)
//
// 실리태번 saveChatConditional()은 앞선 저장이 끝나기를 1초(DEFAULT_SAVE_EDIT_TIMEOUT)만 기다린다. 그 안에 안 끝나면
// console.warn('Timeout waiting for chat to save') 만 남기고 저장하지 않은 채 돌아가고, 부른 쪽은 저장된 줄 안다.
// 폰처럼 저장 한 번이 1초를 넘으면 번역기 · 장기 기억이 방금 넣은 내용이 다음 저장까지 디스크에 없다 (앱을 닫으면 사라짐).
//
// 여기서는 그 경고를 본 뒤, 앞선 저장이 끝나면 실리태번 자신의 저장 함수로 "지금 채팅"을 한 번 더 저장한다.
// - 저장을 더하기만 한다. 실리태번의 진짜 저장은 건너뛰거나 늦추지 않는다 (막는 것은 이 파일이 스스로 부른 저장뿐).
// - 경고 뒤에 시작해 성공한 같은 채팅 저장이 이미 있으면(다른 저장이 새 내용을 실어 갔으면) 아무것도 안 한다.
// - 채팅이 바뀌었으면(다른 채팅 · 다른 캐릭터 · 그룹 · 다시 불러오는 중) 저장하지 않는다. 요청 직전에 한 번 더 확인한다.
// - 기다리는 복구는 하나로 합친다. 실패가 이어져도 몇 번 해 보고 멈춘다.

export const MARKER = 'saveDedupeRecoverySave';
export const DROP_MESSAGE = 'Timeout waiting for chat to save';

const DEFAULTS = Object.freeze({
    tickMs: 100, // 앞선 저장이 끝났는지 보는 간격
    settleMs: 300, // 저장이 끝난 뒤 이만큼 조용하면 복구 (그 사이 기다리던 실리태번 저장이 먼저 가면 복구가 필요 없다)
    marginMs: 20, // 타이머 오차: "경고 시각 − 기다린 시간"보다 조금 뒤에 시작한 저장만 새 내용을 실었다고 본다
    maxAttempts: 3, // 복구 호출이 저장 요청으로 이어지지 않을 때 다시 해 보는 횟수
    maxWaitMs: 120000, // 앞선 저장이 이보다 오래 안 끝나면 포기
});

/**
 * @typedef {{ key: string|null, integrity: any, length: number }} LiveChat
 * @param {object} env
 * @param {() => number} env.now
 * @param {(fn: Function, ms: number) => any} env.setTimer
 * @param {() => boolean|undefined} env.isSaving 실리태번 isChatSaving (모르면 undefined → 복구 안 함)
 * @param {() => number} env.saveTimeout saveChatConditional 이 기다리는 시간
 * @param {() => LiveChat|null} env.live 지금 열린 채팅
 * @param {() => Promise<any>} env.save 실리태번 saveChatConditional (반드시 그 promise 를 그대로 돌려줄 것 — 스택으로 복구 요청을 알아본다)
 * @param {() => boolean} env.enabled
 * @param {() => boolean} [env.hidden]
 * @param {() => void} [env.onChange]
 */
export function createRecovery(env, options = {}) {
    const o = { ...DEFAULTS, ...options };
    const stats = { drops: 0, recovered: 0, alreadySaved: 0, coveredByOther: 0, chatChanged: 0, blocked: 0, gaveUp: 0 };
    const log = [];
    /** 채팅 키 → 성공한 문자열 본문 저장 가운데 가장 늦게 시작한 시각 */
    const okStart = new Map();
    let pending = null;
    let call = null;
    let timer = null;
    let idleSince = null;

    function note(ev, extra = {}) {
        log.push({ t: Math.round(env.now()), ev, ...extra });
        if (log.length > 60) log.shift();
        try { env.onChange?.(); } catch { /* 표시만 */ }
    }

    function sameChat(live, p = pending) {
        return !!(live && p && live.key && live.key === p.key && live.integrity === p.integrity);
    }

    function covered(p = pending) {
        return (okStart.get(p.key) ?? -Infinity) > p.since;
    }

    function schedule(ms = o.tickMs) {
        if (timer !== null || !pending) return;
        timer = env.setTimer(tick, ms);
    }

    function finish(result) {
        const p = pending;
        pending = null;
        idleSince = null;
        if (!p) return;
        if (result === 'recovered') stats.recovered++;
        else if (result === 'already-saved') stats.alreadySaved++;
        else if (result === 'covered') stats.coveredByOther++;
        else if (result === 'chat-changed') stats.chatChanged++;
        else if (result !== 'disabled') stats.gaveUp++;
        note(result, { drops: p.drops, attempts: p.attempts });
    }

    /** saveChatConditional 이 시간 초과로 저장을 건너뛰었다 (console.warn 에서 부른다) */
    function onDrop({ own = false } = {}) {
        if (own && call) {
            // 복구 호출 자신이 기다리다 넘어갔다 = 그 사이 다른 저장이 잠금을 잡고 있었다. 결과는 호출이 끝난 뒤 본다.
            call.dropped = true;
            note('own-call-timed-out');
            return;
        }
        if (!env.enabled()) return;
        const live = env.live();
        if (!live?.key) return;
        stats.drops++;
        const since = env.now() - env.saveTimeout() + o.marginMs;
        if (pending && !sameChat(live)) finish('chat-changed');
        if (!pending) {
            pending = { key: live.key, integrity: live.integrity, hadMessages: live.length > 0, since, drops: 1, attempts: 0, detectedAt: env.now() };
        } else {
            pending.since = Math.max(pending.since, since);
            pending.drops++;
            pending.attempts = 0; // 새로 빠진 저장 = 새로 필요한 복구
            pending.detectedAt = env.now();
        }
        note('drop', { drops: pending.drops });
        schedule();
    }

    function tick() {
        timer = null;
        if (!pending || call) return;
        if (!env.enabled()) return finish('disabled');
        const now = env.now();
        if (now - pending.detectedAt > o.maxWaitMs) return finish('gave-up');
        if (covered()) return finish('covered'); // 그 채팅에 새 내용을 실은 저장이 이미 성공했다 (채팅을 바꿨어도 그 전에)
        const live = env.live();
        if (!sameChat(live)) return finish('chat-changed');
        if (env.isSaving() !== false) {
            idleSince = null;
            return schedule();
        }
        if (idleSince === null) idleSince = now;
        const hidden = !!env.hidden?.();
        if (!hidden && now - idleSince < o.settleMs) return schedule();
        if (pending.hadMessages && live.length === 0) {
            // 채팅을 비우고 다시 불러오는 중 — 끝나면 채팅이 바뀌었는지 다시 본다
            idleSince = null;
            return schedule();
        }
        saveDedupeRecoverySave();
    }

    // 이 함수 이름(MARKER)이 fetch 래퍼의 비동기 스택에 보이면 그 저장 요청은 복구가 부른 것이다.
    async function saveDedupeRecoverySave() {
        const p = pending;
        const c = call = { pending: p, requested: false, ok: false, skipped: false, blocked: false, dropped: false };
        p.attempts++;
        note('save', { attempt: p.attempts });
        try {
            await env.save();
        } catch (error) {
            note('save-error', { error: String(error?.message ?? error).slice(0, 120) });
        }
        call = null;
        idleSince = null;
        if (pending !== p) return schedule();
        if (c.blocked) return finish('chat-changed');
        if (covered(p)) {
            if (c.requested && c.ok) return finish(c.skipped ? 'already-saved' : 'recovered');
            return finish('covered');
        }
        if (p.attempts >= o.maxAttempts) return finish('gave-up');
        schedule();
    }

    /**
     * fetch 래퍼가 채팅 저장 요청마다 (보내기 전에) 부른다.
     * @param {{ key: string|null, own: boolean }} info key = 본문에서 읽은 대상 채팅 (gzip 등 모르면 null), own = 스택에 MARKER
     * @returns {{ block: boolean, token: object }}
     */
    function onSaveRequest({ key = null, own = false } = {}) {
        const token = { key, start: env.now(), own: false };
        if (call && own && !call.requested) {
            call.requested = true;
            token.own = true;
            const live = env.live();
            const p = call.pending;
            const ok = sameChat(live, p) && (!p.hadMessages || live.length > 0) && (key === null || key === p.key);
            if (!ok) {
                call.blocked = true;
                stats.blocked++;
                note('blocked', { key, live: live?.key ?? null });
                return { block: true, token };
            }
        }
        return { block: false, token };
    }

    /** 요청 결과. skipped = 같은 본문이라 보내지 않았다 (디스크가 이미 그 내용) */
    function onSaveResult(token, ok, { skipped = false } = {}) {
        if (!token) return;
        if (ok && token.key !== null && token.start > (okStart.get(token.key) ?? -Infinity)) okStart.set(token.key, token.start);
        if (token.own && call) {
            call.ok = !!ok;
            call.skipped = !!skipped;
        }
    }

    /** 페이지가 가려질 때: 기다리는 복구가 있으면 조용한 시간을 기다리지 않는다 */
    function kick() {
        if (!pending || call) return;
        if (timer !== null) return; // 다음 tick 이 hidden 을 본다
        schedule(0);
    }

    return {
        onDrop,
        onSaveRequest,
        onSaveResult,
        kick,
        inCall: () => call !== null,
        pending: () => (pending ? { ...pending } : null),
        stats,
        log,
    };
}

/** 스택에 이름이 보이는지 (복구 요청 알아보기) */
export function stackHas(name) {
    const limit = Error.stackTraceLimit;
    try {
        Error.stackTraceLimit = 100;
        return String(new Error().stack).includes(name);
    } catch {
        return false;
    } finally {
        try { Error.stackTraceLimit = limit; } catch { /* */ }
    }
}

/** 이 브라우저가 await 너머의 호출자를 스택에 남기는지 (크롬 · 엣지 · 삼성 인터넷은 남긴다). 못 남기면 복구를 켜지 않는다 */
export async function asyncStacksWork() {
    async function saveDedupeProbeInner() {
        await Promise.resolve();
        await new Promise(resolve => setTimeout(resolve, 0));
        return stackHas('saveDedupeProbeOuter');
    }
    async function saveDedupeProbeMiddle() {
        return await saveDedupeProbeInner();
    }
    async function saveDedupeProbeOuter() {
        return await saveDedupeProbeMiddle();
    }
    try {
        return await saveDedupeProbeOuter();
    } catch {
        return false;
    }
}

/** 저장 본문에서 대상 채팅 키. 캐릭터: c|아바타|파일, 그룹: g|채팅id. 모르면 null */
export function bodyKey(path, body) {
    if (typeof body !== 'string') return null;
    try {
        if (path === '/api/chats/group/save') {
            const m = /^\{"id":("(?:[^"\\]|\\.)*"),/.exec(body.slice(0, 1024));
            return m ? `g|${JSON.parse(m[1])}` : null;
        }
        const head = /^\{"ch_name":"(?:[^"\\]|\\.)*","file_name":("(?:[^"\\]|\\.)*"),"chat":/.exec(body.slice(0, 4096));
        const tail = /,"avatar_url":("(?:[^"\\]|\\.)*"),"force":(?:true|false)\}$/.exec(body.slice(-4096));
        return head && tail ? `c|${JSON.parse(tail[1])}|${JSON.parse(head[1])}` : null;
    } catch {
        return null;
    }
}

/** 실리태번 getContext() 에서 지금 채팅 키 · integrity · 메시지 수 */
export function liveChatFrom(ctx) {
    if (!ctx) return null;
    let key = null;
    if (ctx.groupId) {
        const id = typeof ctx.getCurrentChatId === 'function' ? ctx.getCurrentChatId() : ctx.chatId;
        key = id ? `g|${id}` : null;
    } else if (ctx.characterId !== undefined && ctx.characterId !== null && ctx.characterId !== '') {
        const character = ctx.characters?.[ctx.characterId];
        key = character?.chat && character?.avatar ? `c|${character.avatar}|${character.chat}` : null;
    }
    return { key, integrity: ctx.chatMetadata?.integrity, length: Array.isArray(ctx.chat) ? ctx.chat.length : 0 };
}
