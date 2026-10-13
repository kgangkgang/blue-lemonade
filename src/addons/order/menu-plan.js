// 확장 순서 › 요술봉 항목 숨김 · 위로 고정 계획 — 순수 함수 (DOM · 실리태번 없음, tools/tests/order-menus.mjs 가 검사한다). 6.3.3
// menus.js 가 쓴다: 지금 메뉴에 있는 항목 키(화면 순서)와 설정(저장한 순서 · 고정 · 숨김)으로 항목마다 flex order 와 숨김을 정한다.
//  · 저장한 순서(menuOrders.wand)도 고정도 없으면 order 를 지워 원래 자리대로 (2026-10-06 규칙 — 나중에 붙은 항목이 맨 아래로 밀리지 않게)
//  · 고정(menuPinned.wand)은 음수 order 로 맨 위(고정 목록 차례), 나머지는 저장한 순서(없으면 지금 차례)
//  · 숨김(menuHidden.wand)은 지금 있는 키만 (설정에는 남긴다 — 나중에 다시 붙으면 다시 숨김)
// 6.3.4 뒤 고침: 키는 다듬지 않는다(만들어진 그대로 비교) · 순서 바꾸기는 고정한 항목의 원래 자리를 지킨다(latentOrder · swapKeys)
//  · 테마가 보일지 정하는 항목(WAND_OWNERS)은 여기서 숨기지 않는다 — 창의 눈이 그 테마 설정을 읽고 쓴다(ownerOf · ownerShown · setOwner)

export const HIDDEN_CLASS = 'po-menu-hidden';
export const MENU_KINDS = Object.freeze(['wand']);

/** 키 목록 정리 — 빈 것 · 중복 제거, 차례 유지. 키는 menus.js 가 만든 그대로 둔다(앞 공백도 키의 일부) */
export function cleanList(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set(), out = [];
    for (const item of list) {
        const key = typeof item === 'string' ? item : item == null ? '' : String(item);
        if (!key.trim() || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}

/** 목록에 key 가 있으면 빼고 없으면 끝에 넣는다 (새 배열) */
export function toggleIn(list, key) {
    const clean = cleanList(list);
    const k = typeof key === 'string' ? key : key == null ? '' : String(key);
    if (!k.trim()) return clean;
    return clean.includes(k) ? clean.filter(x => x !== k) : [...clean, k];
}

/** 고정을 뺀 「원래」 차례: 저장한 순서가 있으면 그 순서(없는 키는 뒤로, 화면 차례대로), 없으면 화면(DOM) 차례 */
export function latentOrder(keys, order = []) {
    const present = cleanList(keys);
    const saved = cleanList(order);
    if (!saved.length) return present;
    const rank = k => (saved.indexOf(k) < 0 ? saved.length : saved.indexOf(k));
    return present.map((k, i) => ({ k, i })).sort((a, b) => (rank(a.k) - rank(b.k)) || (a.i - b.i)).map(x => x.k);
}

/** 두 키의 자리만 맞바꾼 새 목록 (없는 키면 그대로) — 고정한 키는 원래 자리에 남는다 */
export function swapKeys(list, a, b) {
    const out = [...list];
    const i = out.indexOf(a), j = out.indexOf(b);
    if (i < 0 || j < 0) return out;
    [out[i], out[j]] = [out[j], out[i]];
    return out;
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
        pin.forEach((k, i) => orders.set(k, -1000 + i));
        latentOrder(present, saved).filter(k => !orders.has(k)).forEach((k, i) => orders.set(k, i));
    }
    return { orders, hidden: new Set(cleanList(hidden).filter(k => present.includes(k) && !ownerOf(k))) };
}

// 테마가 요술봉에 보일지 정하는 항목 — 설정은 테마의 addonUI 아래 (그 화면: 애드온 카드의 「요술봉에 … 표시」 · 성능 보조의 메뉴 표시).
// shownIfUnset: 값이 없을 때 보이는지 (「!== false」 로 읽는 설정은 true, 「켰을 때만」 읽는 설정은 false)
export const WAND_OWNERS = Object.freeze([
    { id: 'lt-wand-button', path: ['perfMenu', 'timer'], shownIfUnset: false },
    { id: 'rl-wand-button', path: ['perfMenu', 'log'], shownIfUnset: false },
    { prefix: 'bl-perf-menu-', path: ['perfMenu'], shownIfUnset: false },
    { id: 'bl-tool-menu-words', path: ['wordsMenu'], shownIfUnset: false },
    { id: 'bl-tool-menu-capture', path: ['captureMenu'], shownIfUnset: false },
    { id: 'bl-tool-menu-modelswitch', path: ['modelswitchMenu'], shownIfUnset: true },
    { id: 'bl-notes-wand', path: ['notesMenu'], shownIfUnset: true },
    { id: 'bl-zip-install-menu', path: ['zipinstallMenu'], shownIfUnset: true },
]);

/** 메뉴 키(id:<id>:n)가 테마 설정이 정하는 항목이면 { id, path, shownIfUnset }, 아니면 null */
export function ownerOf(key) {
    const m = /^id:(.+):\d+$/.exec(typeof key === 'string' ? key : '');
    if (!m) return null;
    const id = m[1];
    for (const owner of WAND_OWNERS) {
        if (owner.id === id) return { id, path: [...owner.path], shownIfUnset: owner.shownIfUnset };
        if (owner.prefix && id.startsWith(owner.prefix) && id.length > owner.prefix.length)
            return { id, path: [...owner.path, id.slice(owner.prefix.length)], shownIfUnset: owner.shownIfUnset };
    }
    return null;
}

/** 그 설정으로 지금 보이는지 (addonUI 를 읽기만) */
export function ownerShown(addonUI, owner) {
    let value = addonUI;
    for (const part of owner.path) value = value && typeof value === 'object' ? value[part] : undefined;
    if (value === undefined || value === null) return owner.shownIfUnset;
    return owner.shownIfUnset ? value !== false : Boolean(value);
}

/** 그 설정을 바꾼다 (addonUI 를 고침 · 없는 칸은 만든다) */
export function setOwner(addonUI, owner, shown) {
    let box = addonUI;
    for (const part of owner.path.slice(0, -1)) {
        if (!box[part] || typeof box[part] !== 'object') box[part] = {};
        box = box[part];
    }
    box[owner.path.at(-1)] = Boolean(shown);
}

/** 설정 안의 숨김 · 고정 · 본 이름 칸을 정리한다 ({ wand: … } 모양). 고친 것이 있으면 true */
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
    // menuSeen: 테마 설정이 정하는 항목의 이름 (설정으로 꺼서 메뉴에서 빠져도 창에 줄을 남겨 다시 켤 수 있게)
    const before = JSON.stringify(store.menuSeen ?? null);
    const src = store.menuSeen && typeof store.menuSeen === 'object' && !Array.isArray(store.menuSeen) ? store.menuSeen : {};
    const next = {};
    for (const kind of MENU_KINDS) {
        const map = src[kind] && typeof src[kind] === 'object' && !Array.isArray(src[kind]) ? src[kind] : {};
        next[kind] = Object.fromEntries(Object.entries(map)
            .filter(([key, label]) => ownerOf(key) && typeof label === 'string' && label.trim())
            .slice(0, 60).map(([key, label]) => [key, label.slice(0, 80)]));
    }
    store.menuSeen = next;
    if (JSON.stringify(next) !== before) changed = true;
    return changed;
}
