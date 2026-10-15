// 6.5.2 메시지 작업 순서 — 답 직후 같은 메시지를 건드리는 주체들(다시 쓰기 · 번역 · 캐릭터 에셋 · 그림 확장 · 프리셋의 헬퍼 스크립트)이 서로의 쓰기를
//   「글이 바뀌었다 → 그만」으로 오판하지 않게 하는 작은 공용 장치 (순수 함수: DOM · 실리태번 없음, tools/tests/message-work.mjs 가 검사한다).
//   · run(message, by, fn): 메시지마다 직렬 큐 — 같은 메시지에 쓰는 일은 앞 일이 끝난 뒤에. 다른 메시지는 서로 기다리지 않는다.
//   · noteWrite(message, { by, before, after }): 글(mes)을 바꾼 주체가 바꾼 뒤 적는다 — 다른 주체가 옛 글을 들고 돌아왔을 때 그 변화가 누구의 것인지 알 수 있게.
//   · rebase(message, source): 옛 글 → 기록된 쓰기 사슬 → 지금 글. known 이면 그 사이의 변화는 모두 기록된 주체의 것 (헬퍼 스크립트처럼 기록하지 않는 주체의 변화는 unknown).
//   · sameVisible(a, b): 두 글이 같은 「보이는 글」인가 — 머리의 생각 블록(<ECoT> · <think> …) · 그림 자리 span · 빈 줄 차이를 떼고 비교. 기록 없는 변화(헬퍼의 생각 블록 떼기 ·
//     에셋 · 그림 확장의 자리 넣기)가 보이는 글을 안 바꿨으면 참 — 번역 · 다시 쓰기가 그만두지 않고 지금 글에 이어 쓸 근거.
//   · ignore(name, regex): 보이는 글에서 뗄 표식을 다른 확장이 등록한다 (CONTRACT: fruit-compat-20261015/MESSAGE-WORK-CONTRACT.md).
// 전역 다리: globalThis[Symbol.for('blue-lemonade.message-work')] (installMessageWork) — 테마 밖 확장은 이 다리로만 쓴다 (없으면 예전처럼).
export const BRIDGE = Symbol.for('blue-lemonade.message-work');
export const VERSION = 1;
/** 머리(또는 꼬리)의 생각 블록 — 과일의 마음 ECoT(<ECoT>…</ECoT>) · 실리태번 추론 접두사 꼴 */
export const THINKING_BLOCK = /<(ECoT|think|thinking|reasoning|thought)\b[^>]*>[\s\S]*?<\/\1>/gi;
// 6.6.5 답 머리의 생각 블록 범위 — 과일의 마음 ECoT 스크립트(果实之心 ECoT 模块 v20261003.1 splitReasoning)가 추론으로 옮기는 범위와 같게:
//   글 맨 앞(머리 한 줄 "[RE:]" 같은 "[…]" 뒤)이 생각 블록으로 시작할 때, 다섯 끝 태그 가운데 마지막 것 뒤까지. 실리태번 자동 추론 분리는 "[RE:]" 탓에 못 떼고,
//   스크립트는 MESSAGE_RECEIVED 다음 차례 · GENERATION_ENDED(실리태번이 MESSAGE_RECEIVED 보다 먼저 보낸다) 300ms 뒤에 뗀다 — 그 전에 답을 읽는 기능이 쓴다.
export const THINKING_ENDS = ['</ecot>', '</thinking>', '</think>', '<!-- end of the ecot -->', '<!-- end the ecot -->'];
const THINKING_LEAD = /^\s*(?:\[[^\]\n]{0,20}\][ \t]*\r?\n?\s*)?(?:<ecot\b|<think(?:ing)?\b|<!--)/i;
/** 머리 생각 블록이 끝나는 자리(그 뒤가 본문). 머리가 생각 블록이 아니면 -1. open: 끝 태그가 아직 없으면(스트리밍 중) 글 끝까지 생각 */
export function thinkingHeadEnd(text, { open = false } = {}) {
    const s = String(text ?? '');
    if (!THINKING_LEAD.test(s)) return -1;
    const lower = s.toLowerCase();
    let end = -1;
    for (const tag of THINKING_ENDS) { const at = lower.lastIndexOf(tag); if (at >= 0) end = Math.max(end, at + tag.length); }
    return end < 0 && open ? s.length : end;
}
/** 머리 생각 블록을 뗀 글 (없으면 그대로) */
export function dropThinkingHead(text) {
    const s = String(text ?? ''), end = thinkingHeadEnd(s);
    return end < 0 ? s : s.slice(end);
}
/** 테마의 그림 자리(캐릭터 에셋) — slots.js SLOT_SOURCE 와 같은 꼴 */
export const ASSET_SLOT = /<span class="bl-asset-slot" data-asset-slot="[\w-]+"><\/span>/g;

export function createMessageWork({ now = () => Date.now(), limit = 32 } = {}) {
    const queues = new WeakMap();   // message → 마지막 일의 Promise
    const writes = new WeakMap();   // message → [{ by, before, after, at }]
    const ignores = new Map([['thinking', THINKING_BLOCK], ['asset-slot', ASSET_SLOT]]);
    const strip = text => { let s = String(text ?? ''); for (const re of ignores.values()) s = s.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'), ''); return s.split('\n').map(line => line.trim()).filter(line => line !== '').join('\n'); };
    const work = {
        version: VERSION,
        run(message, by, fn) {
            if (!message || typeof message !== 'object') return Promise.resolve().then(fn);
            const tail = queues.get(message) ?? Promise.resolve();
            const next = tail.then(() => fn(), () => fn());
            queues.set(message, next.then(() => undefined, () => undefined));
            return next;
        },
        /** 이 메시지에 지금 도는 일이 있나 (run 으로 넣은 것) — 끝난 큐는 거짓 */
        busy(message) { return queues.has(message) && queues.get(message) !== undefined && pendingOf(message); },
        noteWrite(message, { by = 'unknown', before, after } = {}) {
            if (!message || typeof message !== 'object' || typeof before !== 'string' || typeof after !== 'string' || before === after) return false;
            const list = writes.get(message) ?? [];
            list.push({ by: String(by), before, after, at: now() });
            while (list.length > limit) list.shift();
            writes.set(message, list);
            return true;
        },
        writesOf(message) { return [...(writes.get(message) ?? [])]; },
        rebase(message, source) {
            const list = writes.get(message) ?? [];
            const current = String(message?.mes ?? '');
            if (source === current) return { known: true, by: [], text: current };
            const start = list.findIndex(w => w.before === source);
            if (start < 0) return { known: false, by: [], text: current };
            const by = [];
            let text = source;
            for (let i = start; i < list.length; i++) {
                if (list[i].before !== text) break;   // 사이에 기록 없는 변화
                text = list[i].after;
                by.push(list[i].by);
            }
            return { known: text === current, by, text: current };
        },
        ignore(name, regex) { if (regex instanceof RegExp && name) ignores.set(String(name), regex); return () => ignores.delete(String(name)); },
        strip,
        sameVisible(a, b) { return strip(a) === strip(b); },
    };
    // 큐가 비었는지: 마지막 일의 상태를 따로 적어 둔다
    const pending = new WeakMap();
    const pendingOf = message => pending.get(message) === true;
    const run = work.run;
    work.run = (message, by, fn) => {
        if (message && typeof message === 'object') pending.set(message, true);
        const p = run(message, by, fn);
        if (message && typeof message === 'object') { const mine = queues.get(message); mine.then(() => { if (queues.get(message) === mine) pending.set(message, false); }); }
        return p;
    };
    return work;
}

/** 전역 다리를 세운다 (이미 있으면 그것) */
export function installMessageWork(globalObject = globalThis) {
    if (!globalObject[BRIDGE]) globalObject[BRIDGE] = createMessageWork();
    return globalObject[BRIDGE];
}
/** 전역 다리 (없으면 세운다) — 애드온은 이것만 쓴다 */
export const messageWork = () => installMessageWork(globalThis);
