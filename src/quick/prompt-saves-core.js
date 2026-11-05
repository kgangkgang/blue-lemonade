// 프롬프트 켜짐 묶음 (1.0.3) — 순수 계산 (DOM · 실리태번 없음, tools/tests/quick-prompt-saves.mjs).
// 묶음 하나 = { id, name, states: { 항목 identifier: 켜짐 } } — 저장한 순간 프롬프트 관리자 목록의 켜고 끈 상태를 그대로 적어요.
// 되돌리기(적용)는 지금 목록에 있는 항목만, 실리태번이 켜고 끄기를 허락한 항목만, 다른 것만 바꿔요. 묶음에 없는 새 항목은 그대로 둬요.
export const MAX_SETS = 12;
export const MAX_NAME = 24;
const MAX_STATES = 600;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** 저장값 다듬기 (깨진 값 · 같은 id · 너무 많은 묶음 · 긴 이름) */
export function tidySets(list) {
    if (!Array.isArray(list)) return [];
    const out = [], ids = new Set();
    for (const raw of list) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        let id = typeof raw.id === 'string' && ID.test(raw.id) && !ids.has(raw.id) ? raw.id : newSetId(ids);
        ids.add(id);
        const name = String(raw.name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || `묶음 ${out.length + 1}`;
        const states = {};
        let n = 0;
        if (raw.states && typeof raw.states === 'object' && !Array.isArray(raw.states)) {
            for (const [key, value] of Object.entries(raw.states)) {
                if (typeof key !== 'string' || !key || key.length > 200 || key === '__proto__' || typeof value !== 'boolean') continue;
                states[key] = value;
                if (++n >= MAX_STATES) break;
            }
        }
        if (!n) continue;
        out.push({ id, name, states });
        if (out.length >= MAX_SETS) break;
    }
    return out;
}

export function newSetId(taken = new Set()) {
    for (;;) {
        const id = 's' + Math.random().toString(36).slice(2, 9);
        if (!taken.has(id)) return id;
    }
}

/** 지금 목록(실리태번 순서 [{ identifier, enabled }]) → states */
export function snapshot(order) {
    const states = {};
    for (const entry of Array.isArray(order) ? order : []) {
        if (entry && typeof entry.identifier === 'string' && entry.identifier) states[entry.identifier] = !!entry.enabled;
    }
    return states;
}

/** 이 묶음을 입히면 바뀔 것 [[identifier, 켜짐]] — allowed(identifier) 가 false 면 건너뛰어요 */
export function planApply(set, order, allowed = () => true) {
    const changes = [];
    for (const entry of Array.isArray(order) ? order : []) {
        const want = set?.states?.[entry?.identifier];
        if (typeof want !== 'boolean' || want === !!entry.enabled) continue;
        if (!allowed(entry.identifier)) continue;
        changes.push([entry.identifier, want]);
    }
    return changes;
}

/** 지금 목록이 이 묶음과 같은가 (묶음에 적힌 항목 가운데 지금 있고 켜고 끌 수 있는 것이 모두 같고, 하나 이상 겹칠 때) */
export function matches(set, order, allowed = () => true) {
    let shared = 0;
    for (const entry of Array.isArray(order) ? order : []) {
        const want = set?.states?.[entry?.identifier];
        if (typeof want !== 'boolean' || !allowed(entry.identifier)) continue;
        if (want !== !!entry.enabled) return false;
        shared++;
    }
    return shared > 0;
}

/** 묶음 하나를 앞(-1) · 뒤(+1)로 — 새 목록 또는 null(못 옮김) */
export function moveSet(list, id, dir) {
    const i = list.findIndex(s => s.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return null;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
}
