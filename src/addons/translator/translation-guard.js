// A snapshot remains invalid after leaving and returning to another chat; the same chat reloaded in place keeps its targets.
// 6.5.2 같은 채팅이 제자리에서 다시 불려도(reloadCurrentChat — 정규식 창 저장 · 프롬프트 귀속 · 헬퍼 스크립트의 정규식 교체 · 다른 확장) 번역을 멈추지 않는다:
//   - CHAT_CHANGED 가 와도 채팅 열쇠(그룹 · 캐릭터 · 채팅 id)가 그대로면 세대(epoch)를 올리지 않는다.
//   - 채팅 배열이 새 객체로 바뀌어 원래 메시지 객체가 없으면, 같은 번호 자리에 같은 글 · 같은 스와이프 · 같은 번역 표시의 메시지가 있을 때 그것을 같은 대상으로 본다(relocate).
//   - 다시 불러오는 사이(배열이 비어 있는 짧은 순간)는 「바뀜」이 아니라 「아직 모름」 — settled() 가 false 면 부르는 쪽이 잠시 기다렸다 다시 본다.
//   글(mes)이 정말 달라졌거나 · 스와이프가 바뀌었거나 · 편집(MESSAGE_EDITED/SWIPED → revision) 이 있었거나 · 다른 채팅이면 전처럼 멈춘다.
export function createGuards(getContext) {
    let epoch = 0, lastKey = null;
    const revisions = new WeakMap();
    const key = () => {
        const c = getContext();
        return JSON.stringify([c.groupId ?? null, c.characterId ?? null, c.getCurrentChatId?.() ?? c.chatId ?? null]);
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
            assert() { if (!this.valid()) throw cancelled(); },
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
            lastKey = now; epoch++;
        },
        messageChanged(id) {
            const message = getContext().chat?.[Number(id)];
            if (message) revisions.set(message, (revisions.get(message) || 0) + 1);
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
