// 확장 순서 1.2.4 (블루레몬에이드 7.3.1) — 설정 창 이름표(열쇠)와 예전 이름표 옮기기. DOM 은 el.id · classList · parentElement 만 본다 (node 로 시험).
//
// 1.2.3 까지는 창 자신의 id · class 로만 이름표를 만들었다. 실리태번 공용 틀 class(inline-drawer …)만 있고 id 는 바깥 칸(.extension_container)에만 있는
// 확장 창은 모두 'cls:inline-drawer', 'cls:inline-drawer#2' … 가 되어 읽힌 차례로 번호가 붙었다. 확장 하나를 깔거나 지우면 번호가 밀려
// 숨김 · 고정이 다른 창으로 옮겨 갔다 (실제 설정에 panelHidden: ['cls:inline-drawer'] 가 있어 확장 창 하나가 통째로 숨어 있었다).
// 이제 그런 창은 바깥 칸의 id 로 부른다(id:<칸 id>). 자기 class 가 있는 창(정규식 cls:regex_settings, 번역 칸의 두 창 …)은 예전 그대로다.

/** 실리태번 공용 틀 class — 이것만으로는 어느 확장인지 모른다 (src/extension-colors.js GENERIC 과 같은 목록) */
export const GENERIC_CLASSES = Object.freeze(['extension_container', 'inline-drawer', 'wide100p', 'flex-container', 'flexFlowColumn']);
const GENERIC = new Set(GENERIC_CLASSES);

/** 창을 담은 바깥 칸(.extension_container) — 없으면 null */
export function containerOf(el) {
    const parent = el?.parentElement;
    return parent?.classList?.contains('extension_container') ? parent : null;
}

/** 1.2.3 까지의 이름표: 창의 id → class 전부(정렬) → 태그 */
export function legacyKeyOf(el) {
    if (el.id) return `id:${el.id}`;
    const cls = [...el.classList].filter(Boolean).sort().join('.');
    return cls ? `cls:${cls}` : `tag:${el.tagName.toLowerCase()}`;
}

/** 1.2.4 이름표: 창의 id → (공용 틀 class 뿐이면) 바깥 칸의 id → class 전부(정렬) → 태그 */
export function keyOf(el, box = containerOf(el)) {
    if (el.id) return `id:${el.id}`;
    const classes = [...el.classList].filter(Boolean);
    if (box?.id && classes.every(name => GENERIC.has(name))) return `id:${box.id}`;
    return legacyKeyOf(el);
}

/** 공용 틀 class 로만 된 예전 이름표인가 ('cls:inline-drawer', 'cls:inline-drawer.wide100p#3', 'tag:div#2' …) — 어느 창인지 알 수 없는 것 */
export function ambiguousLegacyKey(key) {
    const m = /^(cls|tag):([^#]+)(?:#\d+)?$/.exec(String(key ?? ''));
    if (!m) return false;
    return m[1] === 'tag' || m[2].split('.').every(name => GENERIC.has(name));
}

/**
 * 예전 이름표를 새 이름표로 바꾼다 (순수 함수). map: 지금 화면의 창마다 예전 이름표 → 새 이름표 (같아도 넣는다 — 「가리키는 창이 있음」 표시).
 * lists: 고칠 배열들 (pinned · order · panelHidden — 제자리에서 고친다), switches: { 이름표: true } (확장 위 스위치 headSwitches — 제자리에서).
 * drop: 끝낼 때 — 어느 창도 가리키지 않는 '공용 틀 class 뿐인' 예전 이름표는 뺀다 (남겨 두면 나중에 아무 창이나 다시 가리킬 수 있다).
 * 돌려주는 값: 바꾸거나 뺀 수
 */
export function migrateKeys(map, lists, switches = null, { drop = false } = {}) {
    let changed = 0;
    const gone = key => drop && !map.has(key) && ambiguousLegacyKey(key);
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        const out = [];
        for (const key of list) {
            if (gone(key)) { changed++; continue; }
            const next = map.has(key) ? map.get(key) : key;
            if (next !== key) changed++;
            if (!out.includes(next)) out.push(next);
        }
        if (out.length !== list.length || out.some((key, i) => key !== list[i])) list.splice(0, list.length, ...out);
    }
    if (switches && typeof switches === 'object') {
        for (const key of Object.keys(switches)) {
            if (gone(key)) { delete switches[key]; changed++; continue; }
            const next = map.has(key) ? map.get(key) : key;
            if (next === key) continue;
            if (!(next in switches)) switches[next] = switches[key];
            delete switches[key]; changed++;
        }
    }
    return changed;
}
