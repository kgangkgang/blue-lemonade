// A snapshot remains invalid after leaving and returning to another chat; the same chat reloaded in place keeps its targets.
// 6.5.2 같은 채팅이 제자리에서 다시 불려도(reloadCurrentChat — 정규식 창 저장 · 프롬프트 귀속 · 헬퍼 스크립트의 정규식 교체 · 다른 확장) 번역을 멈추지 않는다:
//   - CHAT_CHANGED 가 와도 채팅 열쇠(그룹 · 캐릭터 · 채팅 id)가 그대로면 세대(epoch)를 올리지 않는다.
//   - 채팅 배열이 새 객체로 바뀌어 원래 메시지 객체가 없으면, 같은 번호 자리에 같은 글 · 같은 스와이프 · 같은 번역 표시의 메시지가 있을 때 그것을 같은 대상으로 본다(relocate).
//   - 다시 불러오는 사이(배열이 비어 있는 짧은 순간)는 「바뀜」이 아니라 「아직 모름」 — settled() 가 false 면 부르는 쪽이 잠시 기다렸다 다시 본다.
//   글(mes)이 정말 달라졌거나 · 스와이프가 바뀌었거나 · 편집(MESSAGE_EDITED/SWIPED → revision) 이 있었거나 · 다른 채팅이면 전처럼 멈춘다.
// 2.5.4 멈춘 이유: 무엇이 바뀌었나(채팅 · 메시지 자리 · 편집 이벤트 · 글 · 스와이프 · 번역 표시)와 편집 이벤트를 보낸 곳(확장 폴더 이름) — 글 내용 · id 는 남기지 않는다.
const KEY_PARTS = ['group', 'character', 'chat'];
const keyDiff = (before, after) => {
    try { const a = JSON.parse(before), b = JSON.parse(after); return KEY_PARTS.filter((_, i) => a[i] !== b[i]).map(part => `${part}${b[KEY_PARTS.indexOf(part)] == null ? '(없음)' : ''}`); }
    catch { return ['?']; }
};
/** 이벤트를 보낸 쪽: 호출 스택의 확장 폴더 · 실리태번 스크립트 파일 이름 (번역기 자신은 뺀다) */
export function callerOf(stack = new Error().stack) {
    const seen = [];
    for (const line of String(stack || '').split('\n').slice(1)) {
        if (/translation-guard\.js|addons\/translator\//.test(line)) continue;
        const found = /extensions\/third-party\/([^/?#:]+)\/|\/scripts\/(?:extensions\/)?([\w.-]+\.js)/.exec(line);
        const name = found && (found[1] ? decodeURIComponent(found[1]) : found[2]);
        if (name && !seen.includes(name)) seen.push(name);
        if (seen.length >= 4) break;
    }
    return seen;
}
export function createGuards(getContext) {
    let epoch = 0, lastKey = null, lastSwitch = null;
    const revisions = new WeakMap(), edits = new WeakMap();
    const key = () => {
        const c = getContext();
        // 2.6.1 그룹 채팅은 실리태번이 답을 만드는 동안만 characterId 를 말하는 캐릭터로 두고 끝나면 비운다(여럿이면 차례로 바뀐다) —
        //       그 값까지 견주면 같은 채팅인데 「채팅이 바뀌어 번역을 멈췄어요」가 났다 (제보 진단: {"what":"chat","changed":["character(없음)"]}). 그룹은 그룹 · 채팅만 본다.
        const group = c.groupId ?? null;
        return JSON.stringify([group, group === null ? c.characterId ?? null : null, c.getCurrentChatId?.() ?? c.chatId ?? null]);
    };
    const cancelled = () => Object.assign(new Error('채팅이나 글이 바뀌어 번역을 멈췄어요. 현재 글은 그대로 유지했어요.'), { cancelled: true });
    function capture(message = null) {
        const stamp = epoch, chat = key();
        if (lastKey === null) lastKey = chat;   // 번역기가 채팅이 열린 뒤에 켜졌으면 지금 열쇠를 '본 적 있는' 것으로 — 같은 채팅의 첫 CHAT_CHANGED 가 세대를 올리지 않게
        let target = message, revision = message ? revisions.get(message) : null;
        const source = message?.mes, swipe = message?.swipe_id, sent = message?.send_date, who = message?.name, user = message?.is_user;
        let display = message?.extra?.display_text;
        let index = message ? (getContext().chat?.indexOf(message) ?? -1) : -1;
        // 같은 자리의 메시지가 같은 메시지인가 (다시 불러온 사본): 보낸 시각 · 이름 · 사용자 여부 · 스와이프 · 번역 표시가 같다
        const sameIdentity = again => !!again && again !== target && again.send_date === sent && again.name === who && again.is_user === user && again.swipe_id === swipe && again.extra?.display_text === display;
        // 채팅 배열이 바뀌었으면 같은 자리의 같은 메시지로 옮겨 탄다 → true. 자리가 비었거나(다시 불러오는 중) 다른 글이면 false
        const relocate = () => {
            const list = getContext().chat;
            if (!Array.isArray(list)) return false;
            if (list.includes(target)) { index = list.indexOf(target); return true; }
            if (index < 0) return false;
            const again = list[index];
            if (!sameIdentity(again) || again.mes !== source) return false;
            target = again; revision = revisions.get(again);
            return true;
        };
        const sameChat = () => stamp === epoch && chat === key();
        return {
            valid() {
                return sameChat() && (!message ||
                    (relocate() && revisions.get(target) === revision &&
                    target.mes === source && target.swipe_id === swipe && target.extra?.display_text === display));
            },
            // 6.5.2 지금 판단해도 되나: 같은 채팅인데 메시지가 없고 배열이 비어 있거나 그 자리까지 안 찼으면 다시 불러오는 중일 수 있다 → false
            settled() {
                if (!message || !sameChat()) return true;
                const list = getContext().chat;
                if (!Array.isArray(list)) return true;
                if (list.includes(target)) return true;
                return list.length > index;
            },
            assert() { if (!this.valid()) throw Object.assign(cancelled(), { reason: this.why() }); },
            /** 2.5.4 valid() 가 거짓인 까닭 (진단용, 글 내용 없이 길이만) */
            why() {
                if (stamp !== epoch) return { what: 'chat', changed: lastSwitch };
                if (chat !== key()) return { what: 'chat', changed: keyDiff(chat, key()) };
                if (!message) return null;
                if (!relocate()) { const list = getContext().chat; return { what: 'gone', index, length: Array.isArray(list) ? list.length : -1 }; }
                if (revisions.get(target) !== revision) return { what: 'edited', ...(edits.get(target) || {}) };
                if (target.mes !== source) {
                    const now = String(target.mes ?? ''), was = String(source ?? '');
                    let same = 0; while (same < was.length && same < now.length && was[same] === now[same]) same++;
                    return { what: 'text', before: was.length, after: now.length, samePrefix: same };
                }
                if (target.swipe_id !== swipe) return { what: 'swipe', before: swipe ?? null, after: target.swipe_id ?? null };
                if (target.extra?.display_text !== display) return { what: 'display', before: display == null ? null : String(display).length, after: target.extra?.display_text == null ? null : String(target.extra.display_text).length };
                return null;
            },
            index() { return this.valid() ? getContext().chat.indexOf(target) : -1; },
            /** 지금 가리키는 메시지 객체 (다시 불러온 뒤엔 새 객체) */
            target() { return target; },
            // 6.1.8 글(mes)만 바뀐 같은 대상인가: 같은 채팅 · 같은 메시지 객체 · 같은 스와이프 · 같은 revision · 같은 번역 표시 (대기열이 버리지 않고 지금 글로 번역하게)
            sameTarget() {
                return !!message && sameChat() && relocateLoose() &&
                    revisions.get(target) === revision && target.swipe_id === swipe && target.extra?.display_text === display;
            },
            acceptDisplay() { display = target?.extra?.display_text; },
        };
        // sameTarget 용: 글이 달라도 같은 자리의 같은 스와이프 · 같은 표시면 옮겨 탄다
        function relocateLoose() {
            const list = getContext().chat;
            if (!Array.isArray(list)) return false;
            if (list.includes(target)) { index = list.indexOf(target); return true; }
            if (index < 0) return false;
            const again = list[index];
            if (!sameIdentity(again)) return false;
            target = again; revision = revisions.get(again);
            return true;
        }
    }
    return { capture, cancelled,
        chatChanged() {
            const now = key();
            if (lastKey !== null && now === lastKey) return;   // 6.5.2 같은 채팅을 제자리에서 다시 불러온 것 — 번역 대상은 그대로
            if (lastKey !== null) lastSwitch = keyDiff(lastKey, now);
            lastKey = now; epoch++;
        },
        messageChanged(id, type = 'edited') {
            const message = getContext().chat?.[Number(id)];
            if (!message) return;
            revisions.set(message, (revisions.get(message) || 0) + 1);
            let by = [];
            try { by = callerOf(); } catch { /* 스택을 못 읽는 브라우저 */ }
            edits.set(message, { event: type, by, mesLength: String(message.mes ?? '').length });
        } };
}

export function watchGuard(assertValid, interval = 100) {
    const controller = new AbortController();
    const check = () => {
        if (controller.signal.aborted) throw controller.signal.reason;
        try { assertValid(); } catch (error) { controller.abort(error); throw error; }
    };
    check();
    const timer = setInterval(() => { try { check(); } catch { /* request receives the reason */ } }, interval);
    return { signal: controller.signal, check, close() { clearInterval(timer); } };
}
