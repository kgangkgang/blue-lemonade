// 모델 전환 — 상태 칩 (1.1.1)
// 확장마다 다른 공급자 · 모델(예: 번역만 중계, 나머지는 공식)을 칩 하나에 통째로 저장해 두고, 누르면 모든 대상을 그 상태로 되돌린다.
// 「바꾸기」나 칩을 누르기 직전의 상태는 「↶ 직전」(store().last)에 저절로 남는다 — 그 칩을 누르면 다시 그 전으로 (두 번 누르면 제자리).
//  - 쓰기는 각 대상의 apply 그대로 (모델 먼저 → 공급자 change 나중). 아는 확장(targets.js stateRead · stateApply)은 그다음 연결 방식 칸까지 원래 값으로.
//  - 자동으로 찾은 확장 · 연결 방식을 모르는 등록 확장은 공급자 · 모델(· 주소)만 되돌린다 → 칩에 반쪽 원 아이콘 (limited).
//  - 지금과 같은 대상은 쓰지 않는다 (확장 설정을 괜히 건드리지 않게).
// 실리태번 모듈을 부르지 않는 순수 함수만 둔다 → tools/tests/modelswitch-state.mjs 가 node 로 바로 시험한다.

export const MAX_STATES = 8;
const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
const str = value => typeof value === 'string' ? value : '';
const cleanUrl = url => str(url).trim().replace(/\/+$/, '');
const supports = (target, source) => !target.sources || target.sources.includes(source);
/** 자동으로 찾은 대상의 id (targets.js discover → makeTarget) */
export const isAutoId = id => String(id).startsWith('auto:');

/** 저장된 한 줄을 믿을 수 있는 꼴로 (settings.json 은 손으로 고칠 수도 있다) */
export function cleanEntry(entry) {
    if (!isObj(entry)) return null;
    const source = str(entry.source);
    const out = { name: str(entry.name), source, model: str(entry.model).trim(), url: source === 'custom' ? cleanUrl(entry.url) : '' };
    if (str(entry.follow)) out.follow = entry.follow;
    if (typeof entry.mode === 'string') out.mode = entry.mode;
    return out;
}

/** 대상 하나의 지금 상태 → { name, source, model, url, follow?, mode? } · 못 읽으면 null.
 *  stateRead 가 있으면(아는 확장) 연결 방식과 상관없이 직접 연결 칸의 공급자 · 모델과 연결 방식 값(mode)까지 */
export function entryOf(target) {
    let now = null;
    try { now = target.read(); } catch { return null; }
    if (!isObj(now)) return null;
    let raw = null;
    if (typeof target.stateRead === 'function') { try { raw = target.stateRead(); } catch { raw = null; } }
    const base = isObj(raw) ? raw : now;
    return cleanEntry({ name: String(target.name || target.id), source: base.source, model: base.model, url: base.url, follow: now.follow, mode: isObj(raw) ? str(raw.mode) : undefined });
}

/** 저장해 둔 상태(saved)와 지금(now)이 같은가. 따름(지금 연결 · 프로필 …)이면 공급자 · 모델은 쓰이지 않으니 연결 방식만 본다 */
export function sameEntry(saved, now) {
    if (!saved || !now || !!saved.follow !== !!now.follow) return false;
    if (typeof saved.mode === 'string' && typeof now.mode === 'string' && saved.mode !== now.mode) return false;
    if (saved.follow) return true;
    return saved.source === now.source && saved.model === now.model && (saved.source !== 'custom' || !saved.url || saved.url === now.url);
}

/** 지금 상태 통째로: { [대상 id]: 한 줄 }. include(target) 이 거짓인 대상은 뺀다 */
export function captureState(targets, include = () => true) {
    const items = {};
    for (const target of targets) {
        if (!include(target)) continue;
        const entry = entryOf(target);
        if (entry) items[target.id] = entry;
    }
    return items;
}

/** 공급자 · 모델만 되돌리는 줄이 있나 — 자동으로 찾은 대상, 또는 연결 방식을 모르는 대상이 따름이던 줄 */
export function limited(items) {
    return Object.entries(isObj(items) ? items : {}).some(([id, entry]) => isAutoId(id) || (isObj(entry) && str(entry.follow) && typeof entry.mode !== 'string'));
}

/** 칩 아래 한 줄: 모델 이름(따름이면 그 이름) — 많이 쓰는 것 먼저, 같으면 대상 순서 */
export function summary(items) {
    const count = new Map();
    for (const entry of Object.values(isObj(items) ? items : {})) {
        const e = cleanEntry(entry);
        const key = e ? (e.follow || e.model) : '';
        if (key) count.set(key, (count.get(key) || 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key).join(' · ');
}

/**
 * 되돌리기 계획: 저장한 줄마다 { id, saved, target?, now?, kind }
 *  kind = 'same'(지금과 같음 — 안 씀) · 'write'(씀) · 'cant'(못 씀: 공급자 · 모델을 모르거나 이 대상이 그 공급자를 못 씀) · 'gone'(대상이 없음: 꺼졌거나 지움)
 *  via = 'state'(stateApply: 연결 방식까지) · 'apply'(공급자 · 모델 · 주소만)
 */
export function planRestore(items, targets) {
    const byId = new Map(targets.map(target => [target.id, target]));
    return Object.entries(isObj(items) ? items : {}).map(([id, entry]) => {
        const saved = cleanEntry(entry);
        const target = byId.get(id);
        if (!saved || !target) return { id, saved, kind: 'gone' };
        const now = entryOf(target);
        if (!now) return { id, saved, target, kind: 'cant' };
        if (sameEntry(saved, now)) return { id, saved, target, now, kind: 'same' };
        if (typeof target.stateApply === 'function' && typeof saved.mode === 'string') return { id, saved, target, now, kind: 'write', via: 'state' };
        if (!saved.source || !saved.model || !supports(target, saved.source)) return { id, saved, target, now, kind: 'cant' };
        return { id, saved, target, now, kind: 'write', via: 'apply' };
    });
}

/** 지금 이 상태인가 (모든 줄이 같음) */
export const isCurrent = (items, targets) => { const plan = planRestore(items, targets); return plan.length > 0 && plan.every(step => step.kind === 'same'); };

/** pairs = [[target, 바꾸기 전 한 줄]] → 실제로 바뀐 대상만 { id: 바꾸기 전 } (「↶ 직전」에 남길 것) */
export function changedSince(pairs) {
    const items = {};
    for (const [target, was] of pairs) {
        if (!was) continue;
        if (!sameEntry(was, entryOf(target))) items[target.id] = was;
    }
    return items;
}

/**
 * 계획대로 쓴다. run(job) = 쓰는 동안 감싸기 (index.js: 잠금 풀고). 대상마다 따로 — 하나가 실패해도 나머지는 쓴다.
 * → { done, partial, failed, same, before, touched }
 *   done = 그대로 돌아온 대상 이름 · partial = 공급자 · 모델만 돌아옴(연결 방식은 지금 그대로) · failed = 못 돌림
 *   before = 실제로 바뀐 대상의 바꾸기 전 상태 (다음 「↶ 직전」) · touched = 쓴 대상
 */
export async function runRestore(plan, run = job => job(), onError = () => {}) {
    const done = [], partial = [], failed = [], touched = [], pairs = [];
    let same = 0;
    for (const step of plan) {
        const name = step.saved?.name || step.target?.name || step.id;
        if (step.kind === 'same') { same++; continue; }
        if (step.kind !== 'write') { failed.push(name); continue; }
        const { target, saved } = step;
        const fields = { source: saved.source, model: saved.model, url: saved.url || '' };
        pairs.push([target, step.now]);
        try {
            if (step.via === 'state') {
                // 공급자를 못 쓰는 줄(프로필 모드의 특수 값 등)은 연결 방식만 되돌린다
                const ok = !!saved.source && !!saved.model && supports(target, saved.source);
                await run(() => target.stateApply({ ...(ok ? fields : { source: '', model: '', url: '' }), mode: saved.mode }));
            } else {
                await run(() => target.apply(fields));
            }
            touched.push(target);
            const now = entryOf(target);
            if (sameEntry(saved, now)) done.push(name);
            else if (now && now.source === saved.source && now.model === saved.model) partial.push(name);
            else failed.push(name);
        } catch (error) { onError(target, error); failed.push(name); }
    }
    return { done, partial, failed, same, before: changedSince(pairs), touched };
}

/** settings.json 의 states · last 를 믿을 수 있는 꼴로 (store() 가 부를 때마다 — 새 객체는 만들지 않고 걸러내기만) */
export function keepStates(s) {
    s.states = Array.isArray(s.states) ? s.states.filter(state => isObj(state) && typeof state.name === 'string' && isObj(state.items)).slice(0, MAX_STATES) : [];
    if ('last' in s && !(isObj(s.last) && isObj(s.last.items) && Object.keys(s.last.items).length)) delete s.last;
    return s;
}
