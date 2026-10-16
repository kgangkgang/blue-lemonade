// 뒷일 다리 (6.9.8): 답이 끝난 뒤 도는 일(번역 · 그림 · 요약 …)이 「돌고 있음 / 끝남」을 알리는 아주 작은 전역 창구.
// 백그라운드 창(소리 없이 버티기)이 이걸 보고 「답 끝나고 90초」 대신 뒷일이 끝날 때까지(상한 5분) 버티고, 끝나면 바로 끈다.
// 일반 이름의 Symbol 이라 어떤 확장이든 같은 키로 스스로 등록한다 — 테마가 먼저 세우지 않았어도 누가 먼저 세우든 같은 모양이면 그대로 쓴다.
//
//   const work = globalThis[Symbol.for('blue-lemonade.after-work')];
//   work?.begin('translate');  …  work?.end('translate');       // 꼬리표마다 센다 (begin 둘이면 end 둘)
//   work?.busy                                                   // 아직 도는 일이 있나 (상한 5분이 지나면 거짓)
//   work?.onChange(fn)                                           // 돌고 있음 ↔ 멈춤이 바뀔 때 fn({ busy, tags })
//
// 끝 신호 없이 멈춘 일은 상한(MAX_MS)이 내려놓는다 — begin 만 부르고 죽은 확장이 소리를 영원히 켜 두지 못하게.
export const AFTER_WORK = Symbol.for('blue-lemonade.after-work');
export const VERSION = 1;
export const MAX_MS = 5 * 60 * 1000;

export function createAfterWork({ now = () => Date.now(), maxMs = MAX_MS } = {}) {
    const counts = new Map();   // tag → 열린 begin 수
    const started = new Map();  // tag → 처음 begin 시각 (상한 계산)
    const listeners = new Set();
    let lastBusy = false;
    const live = () => { const t = now(); return [...counts].filter(([tag, n]) => n > 0 && t - (started.get(tag) ?? t) <= maxMs).map(([tag]) => tag); };
    const notify = () => {
        const tags = live(), busy = tags.length > 0;
        if (busy === lastBusy) return;
        lastBusy = busy;
        for (const fn of listeners) { try { fn({ busy, tags }); } catch (error) { console.warn('[Blue Lemonade] 뒷일 다리 알림', error); } }
    };
    const work = {
        version: VERSION,
        begin(tag = 'work') {
            tag = String(tag || 'work');
            const t = now();
            // 끝 신호 없이 상한을 넘긴 꼬리표는 죽은 것 — 새로 시작한 것으로 되감는다 (안 그러면 count 만 늘고 started 가 옛날이라 영영 「바쁘지 않음」)
            if (counts.has(tag) && t - (started.get(tag) ?? t) > maxMs) { counts.delete(tag); started.delete(tag); }
            const n = (counts.get(tag) || 0) + 1;
            counts.set(tag, n);
            if (n === 1) started.set(tag, t);
            notify();
            return () => work.end(tag);   // 되돌려 받은 함수를 부르면 끝 (finally 에 두기 좋게)
        },
        end(tag = 'work') {
            tag = String(tag || 'work');
            const n = Math.max(0, (counts.get(tag) || 0) - 1);
            if (n) counts.set(tag, n); else { counts.delete(tag); started.delete(tag); }
            notify();
            return n;
        },
        /** 모두 내려놓음 (채팅이 바뀌거나 테마가 꺼질 때) */
        clear() { counts.clear(); started.clear(); notify(); },
        get busy() { return live().length > 0; },
        get tags() { return live(); },
        /** 상한을 넘긴 꼬리표를 걷는다 — 타이머에서 가끔 부른다 */
        sweep() { const t = now(); for (const [tag, at] of started) if (t - at > maxMs) { counts.delete(tag); started.delete(tag); } notify(); return work.busy; },
        onChange(fn) { if (typeof fn === 'function') listeners.add(fn); return () => listeners.delete(fn); },
    };
    return work;
}

/** 전역 창구를 세운다 (이미 같은 모양이 있으면 그것) */
export function installAfterWork(globalObject = globalThis) {
    const found = globalObject[AFTER_WORK];
    if (found && typeof found.begin === 'function' && typeof found.end === 'function') return found;
    return (globalObject[AFTER_WORK] = createAfterWork());
}
export const afterWork = () => installAfterWork(globalThis);
