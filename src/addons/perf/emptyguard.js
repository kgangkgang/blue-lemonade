// 저장 정리 1.1.6 (블루레몬에이드 7.3.1) — 빈 채팅 덮어쓰기 막기 (2026-10-20 사용자 채팅에서 메시지 16개가 사라진 일)
//
// 실리태번 reloadCurrentChat 은 채팅 배열을 먼저 비우고(clearChat) 파일을 다시 읽는다. 그동안 chat_metadata 는 그대로라
// 그 사이에 들어온 저장(변수 매크로의 saveMetadataDebounced · 확장의 늦은 saveChat)이나, 다시 읽기가 실패했을 때
// getChatResult 의 「채팅이 서버에 있게」 저장이 같은 integrity 의 머리줄만 있는 파일을 써서 메시지를 모두 지운다
// (서버의 integrity 검사는 같은 채팅이라 통과). 여기서는 그런 저장을 보내기 전에 막는다.
//
// 막는 것: 같은 채팅 파일로 가는 저장인데 메시지가 0개이고, 그 파일이 메시지를 갖고 있던 것을 알거나(이 페이지에서 본 수)
//          서버에 물어 메시지가 있다고 답할 때. 사용자가 메시지를 지워 0개가 된 것(MESSAGE_DELETED)은 그대로 보낸다.
// 또: 채팅을 열었는데(CHAT_CHANGED) 메시지가 하나도 없고, 그 파일이 메시지를 갖고 있던 것을 알면 「의심」으로 두고,
//     파일이 제대로 다시 열릴 때까지 그 파일로 가는, 아는 수보다 적은 저장을 막는다 (불러오기 실패 뒤 새 메시지 하나가 16개를 덮지 않게).
// 막은 저장은 서버로 보내지 않고 409 로 돌려준다 (실리태번은 「저장하지 못함」 알림을 띄우고, 디스크의 파일은 그대로).

export const GUARD_STATUS = 409;
export const GUARD_ERROR = 'bl_empty_chat_guard';
const MAX_PARSE = 32 * 1024 * 1024;

/** 저장 본문의 메시지 수 (머리줄 뺀). 못 읽으면 null */
export function messagesInBody(path, body) {
    if (typeof body !== 'string' || body.length > MAX_PARSE) return null;
    try {
        const j = JSON.parse(body);
        if (!Array.isArray(j?.chat)) return null;
        const head = j.chat[0];
        const hasHeader = !!(head && typeof head === 'object' && ('chat_metadata' in head || 'user_name' in head));
        return Math.max(0, j.chat.length - (hasHeader ? 1 : 0));
    } catch {
        return null;
    }
}

/**
 * @param {object} env
 * @param {() => { key: string|null, length: number }|null} env.live 지금 열린 채팅 (키 모양은 recovery.js bodyKey 와 같다)
 * @param {(key: string) => Promise<number|null>} env.serverCount 서버 파일의 메시지 수 (없으면 0, 모르면 null)
 * @param {(info: object) => void} [env.onBlock]
 * @param {(info: object) => void} [env.onSuspect]
 * @param {() => boolean} [env.enabled]
 */
export function createEmptyGuard(env) {
    const known = new Map();      // 키 → 이 페이지에서 본 메시지 수 (> 0)
    const cleared = new Set();    // 사용자가 메시지를 지워 0개로 만든 채팅
    const suspect = new Map();    // 키 → 불러오기가 비어 끝났을 때의 아는 수
    const stats = { checked: 0, blocked: 0, asked: 0, suspects: 0 };
    const log = [];
    const enabled = () => (env.enabled ? env.enabled() !== false : true);
    function note(ev, extra = {}) {
        log.push({ t: Date.now(), ev, ...extra });
        if (log.length > 40) log.shift();
    }

    /** 채팅이 열렸다 (CHAT_CHANGED · CHAT_LOADED) */
    function onChatOpened() {
        const live = env.live();
        if (!live?.key) return;
        if (live.length > 0) {
            known.set(live.key, live.length);
            cleared.delete(live.key);
            if (suspect.delete(live.key)) note('suspect-cleared', { key: live.key });
            return;
        }
        const had = known.get(live.key) ?? 0;
        if (had > 0 && !cleared.has(live.key)) {
            suspect.set(live.key, had);
            stats.suspects++;
            note('suspect', { key: live.key, had });
            env.onSuspect?.({ key: live.key, had });
        }
    }

    /** 메시지를 지웠다 (MESSAGE_DELETED) — 0개가 됐으면 사용자가 비운 것 */
    function onMessageDeleted() {
        const live = env.live();
        if (!live?.key) return;
        if (live.length === 0) {
            cleared.add(live.key);
            known.delete(live.key);
            suspect.delete(live.key);
            note('cleared-by-user', { key: live.key });
        } else {
            known.set(live.key, live.length);
        }
    }

    /**
     * 저장 요청을 보내기 전에. key = 본문의 대상 채팅 (모르면 null — 그때는 지금 채팅으로 본다).
     * @returns {Promise<{ block: boolean, reason?: string, messages?: number|null, had?: number }>}
     */
    async function check(path, body, key) {
        if (!enabled()) return { block: false };
        const live = env.live();
        const target = key ?? live?.key ?? null;
        if (!target) return { block: false };
        const sameAsLive = live?.key === target;
        // 빠른 길: 지금 채팅이 그 파일이고 메시지가 있으면 본문을 읽지 않는다
        if (sameAsLive && live.length > 0) {
            const hold = suspect.get(target);
            if (hold !== undefined && live.length < hold) {
                return blocked({ path, target, reason: 'suspect', messages: live.length, had: hold });
            }
            if (hold === undefined) known.set(target, live.length);
            return { block: false };
        }
        stats.checked++;
        const messages = messagesInBody(path, body);
        if (messages === null) return { block: false };
        if (messages > 0) {
            const hold = suspect.get(target);
            if (hold !== undefined && messages < hold) return blocked({ path, target, reason: 'suspect', messages, had: hold });
            return { block: false };
        }
        if (cleared.has(target)) return { block: false };
        const had = known.get(target) ?? suspect.get(target) ?? 0;
        if (had > 0) return blocked({ path, target, reason: 'known', messages, had });
        // 이 페이지에서 그 파일을 본 적이 없다 (처음 열기가 실패한 경우 등) — 서버에 묻는다 (빈 저장일 때만, 드묾)
        stats.asked++;
        let onServer = null;
        try { onServer = await env.serverCount(target); } catch { onServer = null; }
        if (onServer === null) return blocked({ path, target, reason: 'unknown-server', messages, had: null });
        if (onServer > 0) return blocked({ path, target, reason: 'server', messages, had: onServer });
        return { block: false };
    }

    /**
     * 동기 첫 판단 — 막지 않는 저장은 모두 null 로 그대로 보낸다 (fetch 감싸개의 동기 흐름 · 겹친 저장의 차례가 그대로).
     * 흔한 경우(지금 채팅이 그 파일이고 메시지가 있음)는 본문을 읽지도 않는다. 막을 때는 이미 끝난 promise,
     * 서버에 물어야 할 때(이 페이지에서 본 적 없는 파일을 메시지 0개로 저장 — 드묾)만 기다리는 promise.
     */
    function precheck(path, body, key) {
        if (!enabled()) return null;
        const live = env.live();
        const target = key ?? live?.key ?? null;
        if (!target) return null;
        if (live?.key === target && live.length > 0) {
            const hold = suspect.get(target);
            if (hold === undefined) { known.set(target, live.length); return null; }
            if (live.length >= hold) return null;
            return Promise.resolve(blocked({ path, target, reason: 'suspect', messages: live.length, had: hold }));
        }
        stats.checked++;
        const messages = messagesInBody(path, body);
        if (messages === null) return null;
        const hold = suspect.get(target);
        if (messages > 0) return hold !== undefined && messages < hold ? Promise.resolve(blocked({ path, target, reason: 'suspect', messages, had: hold })) : null;
        if (cleared.has(target)) return null;
        const had = known.get(target) ?? hold ?? 0;
        if (had > 0) return Promise.resolve(blocked({ path, target, reason: 'known', messages, had }));
        return check(path, body, key);
    }

    function blocked(info) {
        stats.blocked++;
        note('blocked', info);
        try { env.onBlock?.(info); } catch { /* 알림만 */ }
        return { block: true, ...info };
    }

    return { check, precheck, onChatOpened, onMessageDeleted, stats, log, debug: { known, cleared, suspect } };
}

// 7.4.1 (저장 정리 1.1.7) 막은 저장은 409 로 돌아가 실리태번이 「Chat could not be saved」 알림(영 · 한)을 또 띄워
// BL 의 「막았어요」 알림과 겹쳤다 (세 개). 막은 직후 잠깐(기본 6초) 그 저장 실패 알림만 숨긴다 — 다른 오류 알림 · 그 밖의 시간은 그대로.
export const SAVE_FAIL_TITLE = /chat could not be saved|채팅을 저장하지 못했어요/i;   // 채팅 · 그룹 채팅 저장만 (설정 · 프리셋 저장 실패는 그대로)
export const SAVE_FAIL_TEXT = /Check the server connection|서버 연결을 확인/i;

export function createSaveFailMute({ now = () => Date.now(), windowMs = 6000 } = {}) {
    let until = 0, muted = 0, wrapped = false;
    const shouldMute = (message, title) => {
        if (now() >= until) return false;
        if (!SAVE_FAIL_TITLE.test(String(title ?? '')) || !SAVE_FAIL_TEXT.test(String(message ?? ''))) return false;
        muted++;
        return true;
    };
    return {
        /** 막을 때마다 — 지금부터 windowMs 동안 */
        arm() { until = now() + windowMs; },
        shouldMute,
        /** toastr.error 를 한 번만 감싼다 (막은 적이 없으면 감싸지도 않는다) */
        wrap(target) {
            if (wrapped || !target || typeof target.error !== 'function') return false;
            const original = target.error;
            target.error = function (message, title, ...rest) {
                if (shouldMute(message, title)) return undefined;
                return original.call(this, message, title, ...rest);
            };
            wrapped = true;
            return true;
        },
        get muted() { return muted; },
    };
}
