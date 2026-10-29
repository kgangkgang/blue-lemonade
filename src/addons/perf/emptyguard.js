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
//
// 8.2.6 성능 보조를 켜지 않아도 기본으로 켠다 (src/empty-guard-boot.js · 설정 chat.emptyGuard). 판정 · 알림 문구 · 409 응답 · 사건 걸기는
// 모두 이 파일 하나 — 성능 보조(savededupe.js)와 독립 모듈이 같은 것을 부른다. 둘 중 하나만 설치한다(guardSlot 표식).
// 또 8.2.6: 사용자가 직접 지워 0개가 된 저장은 보낸다. 실리태번의 지우는 길(public/script.js · power-user.js · slash-commands.js, 읽기만):
//   - 휴지통 · 편집 칸 지우기 · /cut · /del N (deleteMessage): 배열을 줄이고 saveChatDebounced() 를 건 뒤 MESSAGE_DELETED 를 쏜다 → 저장보다 사건이 먼저.
//     다만 사건은 등록 차례대로 하나씩 await 되므로, 앞선 확장 처리가 느리거나 그 안에서 저장하면 저장이 먼저 올 수 있다 → 사건을 맨 앞(makeFirst)에 건다.
//   - 메시지 지우기 모드(/del 숫자 없이 · ··· 메뉴) 확인 단추 #dialogue_del_mes_ok: chat.length 를 줄이고 saveChatConditional() 을 먼저 기다린 뒤
//     MESSAGE_DELETED 를 쏜다 → 0번부터 고르면 그 저장이 막혔다(사용자 제보). 그래서 확인 단추 누름을 먼저(capture) 듣고 「지울 때 있던 수 · 남을 수」를 적어 둔다.
//   - /delname: splice → 저장 → reloadCurrentChat, 사건 없음. 확장의 chat.splice 뒤 saveChat 도 사건 없음 — 사용자 동작인지 알 수 없어 예전처럼 막는다.
//   - 스와이프 지우기는 메시지 수가 그대로라 상관없다. 채팅 지우기(/delchat · 채팅 관리)는 파일을 지우는 요청이라 저장이 아니다.

export const GUARD_STATUS = 409;
export const GUARD_ERROR = 'bl_empty_chat_guard';
export const SAVE_PATHS = Object.freeze(['/api/chats/save', '/api/chats/group/save']);
const MAX_PARSE = 32 * 1024 * 1024;
/** 지우기 확인 단추를 누른 뒤 이 안에 오는 그 채팅의 0개 저장만 「사용자가 다 지움」으로 본다 (실리태번은 누른 즉시 저장 — 앞 저장을 기다려도 1초) */
export const DELETE_INTENT_MS = 10000;
// 알림 문구 — 성능 보조 · 독립 모듈이 같은 글 (커뮤니티에 알려진 그대로)
export const NOTICE_TITLE = '저장 정리';
export const BLOCK_TEXT = '채팅이 비어 있는 채로 저장하려 해서 막았어요. 파일은 그대로예요. 페이지를 새로 고친 뒤 채팅을 다시 열어 주세요.';
export const SUSPECT_TEXT = '채팅을 불러오지 못했어요. 지금 저장하면 내용이 사라질 수 있어 저장을 막아 둘게요. 페이지를 새로 고쳐 주세요.';

/** 저장 본문에서 대상 채팅 키. 캐릭터: c|아바타|파일, 그룹: g|채팅id. 모르면 null (8.2.6 recovery.js 에서 옮김 — recovery.js 는 다시 내보낸다) */
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

/** 실리태번 getContext() 에서 지금 채팅 키 · integrity · 메시지 수 (8.2.6 recovery.js 에서 옮김) */
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

/**
 * 지금 채팅 키 · integrity 를 가볍게 — 실리태번 내보내기(script.js · group-chats.js 모듈)를 바로 읽는다. 없으면 getContext() 로.
 * getContext() 는 한 번에 ~0.1 ms(4× CPU)이고 데우스 프리셋은 프롬프트 한 번에 저장 타이머를 수백 번 건다 (savededupe.js quickLive 에서 옮김).
 */
export function quickLiveFrom(script, groupChats, context) {
    if (!script || !groupChats || !Array.isArray(script.characters) || typeof script.getCurrentChatId !== 'function' || !('selected_group' in groupChats)) return liveChatFrom(context());
    const integrity = script.chat_metadata?.integrity;
    const length = Array.isArray(script.chat) ? script.chat.length : 0;
    if (groupChats.selected_group) {
        const id = script.getCurrentChatId();
        return { key: id ? `g|${id}` : null, integrity, length };
    }
    const chid = script.this_chid;
    const character = chid !== undefined && chid !== null && chid !== '' ? script.characters[chid] : null;
    return { key: character?.chat && character?.avatar ? `c|${character.avatar}|${character.chat}` : null, integrity, length };
}

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
 * @param {() => number} [env.now] 지우기 확인 단추 시각 비교용 (기본 Date.now)
 * @param {{ known?: Map, cleared?: Set, suspect?: Map }} [env.state] 8.2.6 넘겨받을 기억 — 독립 모듈이 먼저 돌다 성능 보조가 넘겨받을 때 (같은 객체를 그대로 쓴다)
 */
export function createEmptyGuard(env) {
    const known = env.state?.known instanceof Map ? env.state.known : new Map();        // 키 → 이 페이지에서 본 메시지 수 (> 0)
    const cleared = env.state?.cleared instanceof Set ? env.state.cleared : new Set();  // 사용자가 메시지를 지워 0개로 만든 채팅
    const suspect = env.state?.suspect instanceof Map ? env.state.suspect : new Map();  // 키 → 불러오기가 비어 끝났을 때의 아는 수
    const stats = { checked: 0, blocked: 0, asked: 0, suspects: 0, userCleared: 0 };
    const log = [];
    const now = typeof env.now === 'function' ? env.now : () => Date.now();
    /** 8.2.6 지우기 모드 확인 단추를 누른 때: { key, before(그때 메시지 수), after(남을 수 = 고른 첫 메시지 번호), t } — 한 번 쓰면 · 채팅이 바뀌면 지운다 */
    let intent = null;
    const enabled = () => (env.enabled ? env.enabled() !== false : true);
    function note(ev, extra = {}) {
        log.push({ t: Date.now(), ev, ...extra });
        if (log.length > 40) log.shift();
    }

    /** 채팅이 열렸다 (CHAT_CHANGED · CHAT_LOADED) */
    function onChatOpened() {
        intent = null;   // 지운 직후 다른 채팅으로 바뀌면 그 누름은 더 쓰지 않는다 (바뀌는 사이의 빈 저장은 예전처럼 막는다)
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
            intent = null;
            cleared.add(live.key);
            known.delete(live.key);
            suspect.delete(live.key);
            note('cleared-by-user', { key: live.key });
        } else {
            known.set(live.key, live.length);
        }
    }

    /**
     * 8.2.6 메시지 지우기 모드의 확인 단추를 눌렀다 (실리태번이 지우고 저장하기 전, capture 로 듣는다).
     * before = 그때 채팅의 메시지 수, after = 남을 메시지 수(고른 첫 메시지 번호 — 그 뒤는 모두 지운다).
     */
    function onUserDelete({ before, after } = {}) {
        const live = env.live();
        if (!live?.key) return;
        const b = Number(before), a = Number(after);
        if (!Number.isInteger(b) || !Number.isInteger(a) || a < 0 || b < 0) return;
        intent = { key: live.key, before: b, after: a, t: now() };
        note('user-delete', { key: live.key, before: b, after: a });
    }

    /**
     * 0개 저장이 「사용자가 방금 다 지운 결과」인가 (8.2.6). 다음을 모두 만족할 때만 — 하나라도 아니면 예전처럼 막는다:
     *   ① 지우기 확인 단추를 누른 지 DELETE_INTENT_MS 안 ② 누른 채팅 = 저장 대상 = 지금 열린 채팅 (그 사이 CHAT_CHANGED 가 오면 누름은 지워진다)
     *   ③ 고른 범위가 0번부터(남을 수 0) ④ 누를 때 화면의 메시지 수 ≥ 이 파일에 있다고 아는 수(had).
     * ④가 「지운 개수가 저장 직전 메시지 수와 맞는지」다: 불러오기가 실패해 비어 있던 채팅(suspect)이나 다시 읽는 중인 채팅은 누를 때 메시지가 없거나
     * 아는 수보다 적어 통과하지 못한다. ≥ 인 까닭: 새 메시지를 보낸 직후(늦은 저장 전)에 지우면 화면 수가 아는 수보다 클 수 있다 — 그래도 파일이 가진 것은 다 지운 것.
     * 한 번 쓰면 지운다 — 그 뒤의 0개 저장은 cleared 로 통과한다 (MESSAGE_DELETED 와 같은 결과).
     */
    function userCleared(target, had, live) {
        const it = intent;
        if (!it) return false;
        if (now() - it.t > DELETE_INTENT_MS) { intent = null; return false; }
        if (it.key !== target || live?.key !== target || it.after !== 0 || !(it.before >= had)) return false;
        intent = null;
        cleared.add(target);
        known.delete(target);
        suspect.delete(target);
        stats.userCleared++;
        note('cleared-by-user', { key: target, via: 'delete-mode', before: it.before, had });
        return true;
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
        if (had > 0 && userCleared(target, had, live)) return { block: false };
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
        if (had > 0 && userCleared(target, had, live)) return null;
        if (had > 0) return Promise.resolve(blocked({ path, target, reason: 'known', messages, had }));
        return check(path, body, key);
    }

    function blocked(info) {
        stats.blocked++;
        note('blocked', info);
        try { env.onBlock?.(info); } catch { /* 알림만 */ }
        return { block: true, ...info };
    }

    return { check, precheck, onChatOpened, onMessageDeleted, onUserDelete, stats, log, debug: { known, cleared, suspect, intent: () => intent } };
}

// ── 8.2.6 성능 보조와 독립 모듈이 같이 쓰는 것 ─────────────────────────

/**
 * 켜져 있나 — BL 설정 chat.emptyGuard(설정 › 채팅 › 기타 「빈 채팅 덮어쓰기 막기」)와 저장 정리의 emptyGuard(성능 보조 › 저장 정리 서랍 ·
 * 옛 단독 저장 정리 확장도 같은 extension_settings.save_dedupe 칸)를 함께 본다. 둘 중 하나라도 false 면 끔:
 *   두 값 모두 기본은 켬이고(없으면 켬 — 옛 설정 보정과 같다) false 는 사용자가 그 스위치를 직접 끈 때만 생긴다.
 *   그러니 false 는 「이 보호를 원하지 않는다」는 뚜렷한 뜻이고, 다른 쪽 스위치가 켜져 있다는 것은 기본값일 뿐이라 그 뜻을 덮지 않는다.
 *   (8.2.5 까지 저장 정리에서 끈 사람이 8.2.6 으로 올려도 다시 켜지지 않는다 — settings.js 가 그 사람의 chat.emptyGuard 도 처음 한 번 끔으로 맞춘다.)
 */
export function guardWanted(ext) {
    return ext?.salty?.chat?.emptyGuard !== false && ext?.save_dedupe?.emptyGuard !== false;
}

/**
 * 설치 여부를 나누는 표식 하나: owner 'boot'(독립 모듈) | 'perf'(성능 보조 저장 정리) | null, guard 는 지금 판정 객체,
 * mute 는 둘이 같이 쓰는 저장 실패 알림 숨기기 (toastr.error 를 한 번만 감싸게)
 */
export const GUARD_SLOT = Symbol.for('blue-lemonade.empty-guard');
export function guardSlot(root = globalThis) {
    return root[GUARD_SLOT] ??= { owner: null, guard: null, mute: null };
}

export function guardResponse(result) {
    return new Response(JSON.stringify({ error: GUARD_ERROR, reason: result.reason, messages: result.messages, had: result.had }),
        { status: GUARD_STATUS, headers: { 'Content-Type': 'application/json' } });
}

/** POST 저장 경로면 그 경로, 아니면 '' — 저장이 아닌 요청은 문자열 두어 개만 보고 지나간다 */
export function savePathOf(input, init, origin) {
    const method = init?.method ?? input?.method;
    if (typeof method !== 'string' || method.toUpperCase() !== 'POST') return '';
    const raw = typeof input === 'string' ? input : (input?.url ?? String(input ?? ''));
    if (!raw.includes('/api/chats/')) return '';
    try {
        const path = new URL(raw, origin).pathname;
        return SAVE_PATHS.includes(path) ? path : '';
    } catch {
        return '';
    }
}

/** 막았을 때 알림 — 실리태번의 「Chat could not be saved」는 그 직후 잠깐 숨긴다 (mute = createSaveFailMute()) */
export function notifyBlocked(toast, mute) {
    if (!toast) return;
    mute?.wrap(toast);
    mute?.arm();
    toast.warning(BLOCK_TEXT, NOTICE_TITLE, { preventDuplicates: true, timeOut: 15000 });
}
export function notifySuspect(toast) {
    toast?.warning(SUSPECT_TEXT, NOTICE_TITLE, { preventDuplicates: true, timeOut: 0, extendedTimeOut: 0 });
}

/** 서버 파일의 메시지 수 — /api/chats/recent 에 그 파일 하나만 (없으면 0, 모르면 null) */
export function createServerCount({ fetcher, headers, selectedGroup }) {
    return async function serverCount(key) {
        const m = /^(c|g)\|(.*)$/.exec(String(key));
        if (!m) return null;
        let pin;
        if (m[1] === 'g') pin = { file_name: `${m[2]}.jsonl`, group: selectedGroup() ?? undefined };
        else {
            const at = m[2].indexOf('|');
            if (at < 0) return null;
            pin = { avatar: m[2].slice(0, at), file_name: `${m[2].slice(at + 1)}.jsonl` };
        }
        const r = await fetcher('/api/chats/recent', { method: 'POST', headers: headers(), body: JSON.stringify({ max: 0, pinned: [pin], metadata: false }), signal: AbortSignal.timeout(10000) });
        if (!r.ok) return null;
        const list = await r.json();
        const hit = Array.isArray(list) ? list.find(x => x?.file_name === pin.file_name && (pin.group ? x.group === pin.group : x.avatar === pin.avatar)) : null;
        if (!hit) return 0;
        const n = Number(hit.chat_items);
        return Number.isFinite(n) ? n : null;
    };
}

/**
 * 사건 · 지우기 단추 걸기 (한 번). active() 가 false 면(다른 쪽이 넘겨받음 · 꺼짐) 아무것도 안 한다.
 * CHAT_CHANGED · MESSAGE_DELETED 둘 다 맨 앞(makeFirst): 다른 확장이 채팅을 열 때 · 지운 뒤 저장하기 전에 판단한다.
 * 지우기 모드 확인 단추는 document capture 클릭 하나 — 누른 것이 그 단추일 때만 고른 메시지(.mes.selected)를 센다.
 */
export function bindGuardEvents({ guard, eventSource, eventTypes, doc, chatLength, active = () => true }) {
    const on = (type, fn) => {
        if (!type || !eventSource) return;
        if (typeof eventSource.makeFirst === 'function') eventSource.makeFirst(type, fn);
        else eventSource.on?.(type, fn);
    };
    on(eventTypes?.CHAT_CHANGED, () => { if (active()) guard().onChatOpened(); });
    on(eventTypes?.MESSAGE_DELETED, () => { if (active()) guard().onMessageDeleted(); });
    doc?.addEventListener?.('click', (event) => {
        if (!active()) return;
        if (!event.target?.closest?.('#dialogue_del_mes_ok')) return;
        let low = Infinity;
        for (const el of doc.querySelectorAll('#chat .mes.selected')) {
            const id = Number(el.getAttribute('mesid'));
            if (Number.isInteger(id) && id < low) low = id;
        }
        if (low === Infinity) return;   // 고른 것이 없으면 실리태번도 지우지 않는다
        guard().onUserDelete({ before: chatLength(), after: low });
    }, true);
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
