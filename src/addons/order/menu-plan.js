// 확장 순서 › 요술봉 항목 숨김 · 위로 고정 계획 — 순수 함수 (DOM · 실리태번 없음, tools/tests/order-menus.mjs 가 검사한다). 6.3.3
// menus.js 가 쓴다: 지금 메뉴에 있는 항목 키(화면 순서)와 설정(저장한 순서 · 고정 · 숨김)으로 항목마다 flex order 와 숨김을 정한다.
//  · 저장한 순서(menuOrders.wand)도 고정도 없으면 order 를 지워 원래 자리대로 (2026-10-06 규칙 — 나중에 붙은 항목이 맨 아래로 밀리지 않게)
//  · 고정(menuPinned.wand)은 음수 order 로 맨 위(고정 목록 차례), 나머지는 저장한 순서(없으면 지금 차례)
//  · 숨김(menuHidden.wand)은 지금 있는 키만 (설정에는 남긴다 — 나중에 다시 붙으면 다시 숨김)

export const HIDDEN_CLASS = 'po-menu-hidden';
export const MENU_KINDS = Object.freeze(['wand']);

/** 문자열 키 목록 정리 — 빈 것 · 중복 제거, 차례 유지 */
export function cleanList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set(), out = [];
    for (const item of list) {
        const key = String(item ?? '').trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}

/** 목록에 key 가 있으면 빼고 없으면 끝에 넣는다 (새 배열) */
export function toggleIn(list, key) {
    const clean = cleanList(list);
    const k = String(key ?? '').trim();
    if (!k) return clean;
    return clean.includes(k) ? clean.filter(x => x !== k) : [...clean, k];
}

/**
 * @param {string[]} keys 지금 메뉴에 있는 항목 키 (화면 차례)
 * @returns {{ orders: Map<string, number|null>, hidden: Set<string> }} order null = 인라인 order 를 지움
 */
export function planWand(keys, { order = [], pinned = [], hidden = [] } = {}) {
    const present = cleanList(keys);
    const saved = cleanList(order);
    const pin = cleanList(pinned).filter(k => present.includes(k));
    const orders = new Map();
    if (!saved.length && !pin.length) {
        for (const k of present) orders.set(k, null);
    } else {
        const rank = k => (saved.length ? (saved.indexOf(k) < 0 ? saved.length : saved.indexOf(k)) : present.indexOf(k));
        pin.forEach((k, i) => orders.set(k, -1000 + i));
        const rest = present.filter(k => !orders.has(k)).map((k, i) => ({ k, i })).sort((a, b) => (rank(a.k) - rank(b.k)) || (a.i - b.i));
        rest.forEach((x, i) => orders.set(x.k, i));
    }
    return { orders, hidden: new Set(cleanList(hidden).filter(k => present.includes(k))) };
}

/** 설정 안의 숨김 · 고정 칸을 정리한다 ({ wand: [] } 모양). 고친 것이 있으면 true */
export function normalizeMenuPrefs(store) {
    if (!store || typeof store !== 'object') return false;
    let changed = false;
    for (const field of ['menuHidden', 'menuPinned']) {
        const before = JSON.stringify(store[field] ?? null);
        const src = store[field] && typeof store[field] === 'object' && !Array.isArray(store[field]) ? store[field] : {};
        const next = {};
        for (const kind of MENU_KINDS) next[kind] = cleanList(src[kind]);
        store[field] = next;
        if (JSON.stringify(next) !== before) changed = true;
    }
    return changed;
}
