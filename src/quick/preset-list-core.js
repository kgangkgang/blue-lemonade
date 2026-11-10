// 프리셋 고르기 목록 폴더 (1.0.3) — 순수 계산 (DOM · 실리태번 없음, tools/tests/quick-preset-folders.mjs).
// 폴더 = { id, name, open, items: [프리셋 이름] } — 실리태번 프리셋 고르기 칸(#settings_preset_openai)의 글(이름)로 기억해요.
// 프리셋 하나는 폴더 하나에만. 지금 없는 이름(지운 프리셋)은 목록에 안 보이고 저장값에는 남아요(되살리면 다시 보여요).
// 1.1.1 시제품: 이름을 바꾼 프리셋은 폴더가 따라가요 — 마지막으로 본 이름 목록(seen)과 견줘, 폴더 안 이름 하나가 사라지고 새 이름 하나가 생겼을 때만(followRenames).
export const MAX_FOLDERS = 50;
export const MAX_NAME = 40;
const MAX_ITEMS = 1000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function newFolderId(taken = new Set()) {
    for (;;) {
        const id = 'f' + Math.random().toString(36).slice(2, 9);
        if (!taken.has(id)) return id;
    }
}
const cleanName = (value, fallback) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME) || fallback;

/** 저장값 다듬기: 깨진 값 · 같은 id · 이름 · 같은 프리셋이 두 폴더에(앞 폴더 것만) · 최대 수 */
export function tidyFolders(list) {
    if (!Array.isArray(list)) return [];
    const out = [], ids = new Set(), owned = new Set();
    for (const raw of list) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const id = typeof raw.id === 'string' && ID.test(raw.id) && !ids.has(raw.id) ? raw.id : newFolderId(ids);
        ids.add(id);
        const items = [];
        for (const name of Array.isArray(raw.items) ? raw.items : []) {
            if (typeof name !== 'string' || !name || name.length > 200 || owned.has(name)) continue;
            owned.add(name); items.push(name);
            if (items.length >= MAX_ITEMS) break;
        }
        out.push({ id, name: cleanName(raw.name, `폴더 ${out.length + 1}`), open: raw.open !== false, items });
        if (out.length >= MAX_FOLDERS) break;
    }
    return out;
}

/** 지금 프리셋 이름들(고르기 칸 차례) → { groups: [{ folder, items }], loose: [이름] } — 폴더 안 차례는 폴더에 적힌 차례 */
export function groupPresets(names, folders) {
    const present = new Set(names), used = new Set();
    const groups = folders.map(folder => {
        const items = folder.items.filter(name => present.has(name) && !used.has(name));
        for (const name of items) used.add(name);
        return { folder, items };
    });
    return { groups, loose: names.filter(name => !used.has(name)) };
}

const fold = text => String(text ?? '').normalize('NFKC').toLocaleLowerCase();
/** 찾기: 낱말이 모두 들어간 프리셋 [{ name, folder }] (고르기 칸 차례) */
export function searchPresets(names, folders, query) {
    const words = fold(query).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const owner = new Map();
    for (const folder of folders) for (const name of folder.items) if (!owner.has(name)) owner.set(name, folder.name);
    return names.filter(name => words.every(word => fold(name).includes(word))).map(name => ({ name, folder: owner.get(name) || '' }));
}

/** 폴더 하나의 프리셋을 chosen 으로 — 다른 폴더에 있던 것은 거기서 빼요. 지금 없는 이름은 그 폴더에 그대로 남겨요 */
export function assignPresets(folders, id, chosen, present = null) {
    const pick = new Set(chosen);
    return folders.map(folder => {
        if (folder.id === id) {
            const kept = folder.items.filter(name => pick.has(name) || (present && !present.has(name)));
            const added = [...pick].filter(name => !kept.includes(name));
            return { ...folder, items: [...kept, ...added] };
        }
        return { ...folder, items: folder.items.filter(name => !pick.has(name)) };
    });
}

/** 폴더를 앞(-1) · 뒤(+1)로 — 새 목록 또는 null */
export function moveFolder(folders, id, dir) {
    const i = folders.findIndex(f => f.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= folders.length) return null;
    const next = folders.slice();
    [next[i], next[j]] = [next[j], next[i]];
    return next;
}

/** 폴더만 지우기 — 안의 프리셋은 폴더 밖으로(프리셋 파일은 그대로) */
export const removeFolder = (folders, id) => folders.filter(f => f.id !== id);

/** 지금 프리셋이 든 폴더 id (없으면 '') */
export function folderOf(folders, name) {
    return folders.find(f => f.items.includes(name))?.id || '';
}

export const MAX_SEEN = 2000;
/**
 * 이름 바뀜 따라가기 (1.1.1 시제품): seen(마지막으로 본 이름들) → names(지금 이름들)에서 사라진 이름이 꼭 하나이고 그것이 폴더 안이며, 새 이름도 꼭 하나면 그 자리에 새 이름을 적어요.
 * 둘 이상 사라졌거나 생겼으면(지우기 · 새로 만들기가 섞임) 어느 것이 어느 것인지 알 수 없어 건드리지 않아요 — 엉뚱한 프리셋을 폴더에 넣는 것보다 그대로가 나아요.
 * 실리태번의 이름 바꾸기는 「새 이름으로 저장 → 옛 이름 지우기」라 목록에서는 사라짐 하나 · 생김 하나로 보여요.
 * @returns {{ folders: object[], moved: [string, string][] }}
 */
export function followRenames(folders, seen, names) {
    const before = new Set(Array.isArray(seen) ? seen : []), now = new Set(names);
    if (!before.size) return { folders, moved: [] };
    const gone = [...before].filter(name => !now.has(name)), fresh = [...now].filter(name => !before.has(name));
    if (gone.length !== 1 || fresh.length !== 1) return { folders, moved: [] };
    const [from] = gone, [to] = fresh;
    if (!folders.some(f => f.items.includes(from)) || folders.some(f => f.items.includes(to))) return { folders, moved: [] };
    return { folders: folders.map(f => ({ ...f, items: f.items.map(name => (name === from ? to : name)) })), moved: [[from, to]] };
}
/** 지금 이름 목록이 마지막으로 본 것과 같은가 (차례까지) */
export const sameNames = (seen, names) => Array.isArray(seen) && seen.length === names.length && seen.every((name, i) => name === names[i]);
