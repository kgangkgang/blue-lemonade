// 저장 정리 — 답을 받는 동안 채팅 바꾸기 막기 (1.1.1)
//
// 실리태번의 지난 채팅 목록 · 체크포인트 링크 · 분기 만들기 · 원래 채팅으로 · 채팅 관리 화면의 새 채팅 · /go 같은 슬래시 명령은
// 답을 받는 중인지(is_send_press) 보지 않는다. 스트리밍 중에 채팅을 바꾸면 실리태번이 같은 chat 배열에 새 채팅을 읽어 들이고,
// 스트리밍은 그 배열의 같은 번호에 계속 써서 — 옛 채팅 파일에는 답이 없고, 새 채팅은 그 번호의 메시지가 받던 답으로 덮여 저장됐다 (재현).
// 캐릭터 목록 · 새 채팅 · 채팅 닫기는 is_send_press 를 보지만, 스트리밍이 끝나면 실리태번은 잠금을 먼저 풀고
// (MESSAGE_RECEIVED · CHARACTER_MESSAGE_RENDERED 를 기다린 뒤) 저장한다. 그 사이에 바꾸면 끝난 답이 저장되지 않았다 (재현).
//
// 상태
// - generating: 실리태번이 잠가 둔 동안 (스트리밍 · 스트리밍 아닌 기다림 · 그룹 생성 · 다시 쓰기의 잠금) → 막는다
// - finishing: 잠금은 풀렸지만 streamingProcessor 가 아직 이 채팅의 답을 마무리 중(저장 전) → 저장 마치기(switchflush)가 기다렸다가 넘긴다
// - 끊긴 스트림(onErrorStreaming)은 실리태번이 저장하지 않는다 → erroredUnsaved 면 바꾸기 전에 한 번 저장한다
// 번역 · 장기 기억처럼 답 뒤에 도는 일은 막지 않는다 (번역은 캐시에 남고 번역기가 다른 채팅에 붙이지 않는다, 장기 기억은 다음 전송 때 기록한다).

/**
 * 막을 뿐 저장을 기다리지는 않는 누름: 지난 채팅 지우기 (지금 채팅이면 실리태번이 다른 채팅으로 넘어간다).
 * [1.1.2] 스와이프 고르기 창의 스와이프 지우기 단추도 PastChat_cross 를 그대로 쓴다 — 그것은 채팅을 바꾸지 않으므로 뺀다.
 */
export const DELETE_ENTRY = '.PastChat_cross:not(.swipe_picker_delete)';

/** 채팅을 바꾸는 슬래시 명령 (별칭은 같은 명령 객체를 가리킨다: /char → /go). [1.1.2] /delchat 추가 (지금 채팅을 지우면 다른 채팅으로 넘어간다) */
export const GUARD_COMMANDS = Object.freeze(['go', 'newchat', 'closechat', 'tempchat', 'checkpoint-go', 'checkpoint-exit', 'branch-create', 'renamechat', 'delchat']);

const DEFAULTS = Object.freeze({
    finishMaxMs: 20000, // 잠금이 풀린 뒤 이만큼 지나도 마무리 중이면 멈춘 것으로 보고 더는 붙잡지 않는다
});

function toMs(value) {
    if (value === undefined || value === null || value === '') return null;
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {object} env
 * @param {() => boolean} env.isGenerating 실리태번 isGenerating() (is_send_press || is_group_generating)
 * @param {() => any} env.processor 실리태번 streamingProcessor (없으면 null)
 * @param {(id: number) => any} env.messageAt 지금 chat[id]
 * @param {() => number} env.now
 * @param {(key: string, wallMs: number) => boolean} env.savedSinceWall 그 채팅의 저장이 wallMs(Date.now 기준) 뒤에 시작해 성공했는지
 */
export function createSwitchGuard(env, options = {}) {
    const o = { ...DEFAULTS, ...options };
    const stats = { blocked: 0, commands: 0 };
    /** 잠금이 풀린 채로 처음 본 streamingProcessor 와 그 시각 */
    let seen = null;

    const safe = (fn, fallback) => {
        try {
            return fn();
        } catch {
            return fallback;
        }
    };

    /** 그 processor 가 그리던 메시지가 아직 지금 채팅 화면에 있는지 (채팅을 바꾸면 clearChat 이 지운다) */
    const inThisChat = p => !!p?.messageDom && p.messageDom.isConnected === true;

    /** 'generating' | 'finishing' | null */
    function state() {
        const p = safe(env.processor, null);
        if (safe(env.isGenerating, false) === true) {
            seen = p ? { processor: p, since: env.now() } : null;
            return 'generating';
        }
        if (!p || p.isStopped || !inThisChat(p)) return null;
        if (seen?.processor !== p) seen = { processor: p, since: env.now() };
        if (env.now() - seen.since > o.finishMaxMs) return null;
        return 'finishing';
    }

    /** 끊긴 스트림의 답이 이 채팅에 있고, 그 뒤로 이 채팅이 저장되지 않았는지 */
    function erroredUnsaved(live) {
        const p = safe(env.processor, null);
        if (!p || !p.isStopped || !live?.key || !inThisChat(p)) return false;
        const message = safe(() => env.messageAt(p.messageId), null);
        if (!message || typeof message !== 'object') return false;
        const wall = toMs(message.gen_finished) ?? toMs(p.createdAt);
        if (wall === null) return false;
        return !safe(() => env.savedSinceWall(live.key, wall), false);
    }

    return { state, erroredUnsaved, stats };
}

/**
 * 슬래시 명령의 callback 을 감싼다 (명령 객체는 파서가 실행할 때 callback 을 읽는다). 이미 감싼 명령은 건너뛴다.
 * @param {Record<string, any>} commands SlashCommandParser.commands
 * @param {readonly string[]} names
 * @param {(original: Function) => Function} wrap
 * @param {WeakSet<object>} done
 * @returns {number} 새로 감싼 수
 */
export function wrapCommands(commands, names, wrap, done) {
    let count = 0;
    if (!commands || typeof commands !== 'object') return count;
    for (const name of names) {
        const command = commands[name];
        if (!command || typeof command.callback !== 'function' || done.has(command)) continue;
        command.callback = wrap(command.callback);
        done.add(command);
        count++;
    }
    return count;
}
