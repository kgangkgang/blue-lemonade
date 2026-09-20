// 확장 순서 — 설정 보관과 공통 상수
// 설정 키(panel_order)와 폴더 이름은 바꾸지 않는다. 고정해 둔 확장과 직접 잡은 순서가 여기 들어 있다.
import { extension_settings } from '../../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../../script.js';

export const MODULE = 'panel_order';
export const FOLDER = 'blue-lemonade';
export const VERSION = '1.1.0';
export const TITLE = '확장 순서';

/**
 * 처음 켤 때 위에 고정해 두는 확장 — 정규식, 빠른 답장.
 * 창 제목이 아니라 창에 붙은 id·class로 찾는다. 한글화 스크립트가 제목을 바꿔도 그대로 찾아낸다.
 */
export const DEFAULT_PINNED = Object.freeze(['cls:regex_settings', 'id:qr--settings']);

const DEFAULTS = Object.freeze({
    /** 고정하지 않은 확장을 가나다순으로 자동 정렬할지 */
    auto: true,
    /** 고정한 확장 아래에 구분선을 그을지 */
    divider: true,
    /** 넓은 화면(PC)에서 두 칸으로: 왼쪽은 고정한 확장, 오른쪽은 나머지 (사용자: "PC는 화면 넓으니까 세로 2줄로") */
    twoColumns: true,
    /** 위에 고정한 확장 (보이는 차례대로) */
    pinned: [...DEFAULT_PINNED],
    /** 자동 정렬을 껐을 때 쓰는 사용자 순서 */
    order: [],
});

export function settings() {
    return extension_settings[MODULE];
}

export function saveSettings() {
    saveSettingsDebounced();
}

function cleanKeys(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const key = String(item ?? '').trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(key);
    }
    return out;
}

export function initSettings() {
    const saved = extension_settings[MODULE];
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
        extension_settings[MODULE] = structuredClone(DEFAULTS);
        saveSettings();
        return settings();
    }
    const store = settings();
    const before = JSON.stringify([store.auto, store.divider, store.twoColumns, store.pinned, store.order]);
    store.auto = store.auto !== false;
    store.divider = store.divider !== false;
    store.twoColumns = store.twoColumns !== false;
    // 목록이 아예 없거나 배열이 아니면 처음 값으로 되돌린다.
    // 빈 배열은 사용자가 고정을 모두 푼 것이라 그대로 둔다.
    store.pinned = Array.isArray(store.pinned) ? cleanKeys(store.pinned) : [...DEFAULT_PINNED];
    store.order = Array.isArray(store.order) ? cleanKeys(store.order) : [];
    // 고정한 확장은 사용자 순서 목록에 겹쳐 있으면 안 된다 (둘 다 있으면 두 번 세어진다).
    store.order = store.order.filter(key => !store.pinned.includes(key));
    // 고쳐 놓은 것을 적어 둔다. 안 그러면 켤 때마다 같은 수선을 되풀이한다.
    if (JSON.stringify([store.auto, store.divider, store.twoColumns, store.pinned, store.order]) !== before) saveSettings();
    return store;
}

/** 설정을 처음 상태로 되돌린다. */
export function resetSettings() {
    const store = settings();
    const fresh = structuredClone(DEFAULTS);
    store.auto = fresh.auto;
    store.divider = fresh.divider;
    store.twoColumns = fresh.twoColumns;
    store.pinned = fresh.pinned;
    store.order = fresh.order;
    saveSettings();
    return store;
}
