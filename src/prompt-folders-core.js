// 프롬프트 폴더 (1.0.1, 1.0.2 · 1.0.3 더함) — 순수 계산만. 화면은 prompt-folders.js 가 맡아요.
// 폴더 = 이름 + 항목 id 목록. 줄은 옮기지 않고, 실제 순서(prompt_order)에서 같은 폴더 항목이 이어지는 구간마다 머리 줄 하나를 끼워요.
// 그래서 순서의 주인은 언제나 실리태번이에요(끌기 저장 · 생성 순서 그대로). 저장: 테마 설정 promptFolders.presets[프리셋 이름].folders
// 폴더 택1 묶음(folderChoiceGroups · withFolderChoices)은 택1 규칙과 함께 prompt-choice-core.js 에 있어요.
export { folderChoiceGroups, withFolderChoices } from './prompt-choice-core.js';

export const LIMITS = { presets: 200, folders: 60, ids: 400, name: 40 };
const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);
const cleanName = value => Array.from(String(value ?? '').replace(/\s+/g, ' ').trim()).slice(0, LIMITS.name).join('');
const safeKey = key => typeof key === 'string' && key !== '' && !['__proto__', 'constructor', 'prototype'].includes(key);

/** 저장 값 다듬기 — 모르는 칸은 버리고, 한 항목은 앞 폴더 하나에만 */
export function tidyFolderStore(raw) {
    const out = { on: !isObj(raw) || raw.on !== false, presets: {} };
    const presets = isObj(raw?.presets) ? Object.entries(raw.presets) : [];
    for (const [key, preset] of presets.slice(0, LIMITS.presets)) {
        if (!safeKey(key) || !isObj(preset)) continue;
        const folders = tidyFolders(preset.folders);
        if (folders.length) out.presets[key] = { folders };
    }
    return out;
}
export function tidyFolders(list) {
    const seenIds = new Set(), seenFolders = new Set(), out = [];
    for (const folder of Array.isArray(list) ? list : []) {
        if (!isObj(folder) || out.length >= LIMITS.folders) continue;
        let id = typeof folder.id === 'string' && /^[\w-]{1,40}$/.test(folder.id) ? folder.id : '';
        if (!id || seenFolders.has(id)) id = newFolderId(seenFolders);
        seenFolders.add(id);
        const ids = [];
        for (const item of Array.isArray(folder.ids) ? folder.ids : []) {
            if (typeof item !== 'string' || !item || seenIds.has(item) || ids.length >= LIMITS.ids) continue;
            seenIds.add(item); ids.push(item);
        }
        out.push({ id, name: cleanName(folder.name) || '폴더', ids, open: folder.open !== false, pick: folder.pick === true, parent: typeof folder.parent === 'string' ? folder.parent : '' });
    }
    // 위 폴더는 맨 위 폴더만(2단까지) — 없는 폴더 · 자기 자신 · 위 폴더가 있는 폴더를 가리키면 맨 위로
    const raw = new Map(out.map(f => [f.id, f.parent]));
    for (const f of out) if (f.parent && (f.parent === f.id || !raw.has(f.parent) || raw.get(f.parent))) f.parent = '';
    return out;
}
let idSeq = 0;
export function newFolderId(taken = new Set()) {
    for (;;) {
        const id = 'f' + Date.now().toString(36) + (idSeq++).toString(36);
        if (!taken.has(id)) return id;
    }
}

// 프리셋 파일에 넣어 다니는 폴더: extensions.blPromptFolders = { version: 1, folders: [{ id, name, ids, parent?, pick?, open? }] }
export const PRESET_FIELD = 'blPromptFolders';
/** 프리셋 extensions 칸에서 폴더를 읽는다(모르는 판 · 깨진 값이면 빈 목록). 없는 항목은 그리는 쪽에서 조용히 건너뛰어요 */
export function readPresetFolders(extensions) {
    const value = extensions?.[PRESET_FIELD];
    return value?.version === 1 && Array.isArray(value.folders) ? tidyFolders(value.folders) : [];
}

/** id → 폴더 */
export function folderIndex(folders) {
    const map = new Map();
    for (const folder of folders || []) for (const id of folder.ids) if (!map.has(id)) map.set(id, folder);
    return map;
}

/** 폴더의 사슬: [위 폴더, 폴더] 또는 [폴더] */
export function chainOf(folder, folders) {
    if (!folder) return [];
    const top = folder.parent ? folders.find(f => f.id === folder.parent) : null;
    return top ? [top, folder] : [folder];
}
/** 폴더의 항목 전부(하위 폴더 항목까지) */
export function folderItems(folder, folders) {
    return [...folder.ids, ...folders.filter(f => f.parent === folder.id).flatMap(f => f.ids)];
}
/** 항목도 하위 폴더도 없는 폴더를 뺀다 */
export function dropEmpty(folders) {
    const kept = folders.filter(f => f.ids.length || folders.some(c => c.parent === f.id && c.ids.length));
    return kept.length === folders.length ? kept : dropEmpty(kept);
}

/** 실제 순서(order: id 배열)를 걸으며 구간을 만든다 → [{ folder, depth, start, end, ids, part, parts }] 머리 줄을 끼울 차례대로
 *  (start/end 는 order 의 자리, depth 0 맨 위 · 1 하위, part 는 같은 폴더의 몇 번째 구간). 위 폴더 구간은 하위 폴더 구간을 품어요 */
export function folderRuns(order, folders) {
    const of = folderIndex(folders), runs = [], parts = new Map();
    const open = [];   // 깊이별 지금 구간
    order.forEach((id, i) => {
        const chain = chainOf(of.get(id), folders);
        let depth = 0;
        while (depth < chain.length && open[depth]?.folder === chain[depth]) { open[depth].end = i; open[depth].ids.push(id); depth++; }
        open.length = depth;
        for (; depth < chain.length; depth++) {
            const folder = chain[depth], part = parts.get(folder) || 0;
            parts.set(folder, part + 1);
            const run = { folder, depth, start: i, end: i, ids: [id], part };
            open[depth] = run;
            runs.push(run);
        }
    });
    for (const r of runs) r.parts = parts.get(r.folder);
    return runs;
}

/** 직전 순서와 지금 순서를 견줘 자리를 옮긴 항목 하나를 찾는다(같은 항목들이고 하나만 옮겼을 때). 아니면 null */
export function detectMove(before, after) {
    if (!Array.isArray(before) || !Array.isArray(after) || before.length !== after.length || before.length < 2) return null;
    let a = 0;
    while (a < before.length && before[a] === after[a]) a++;
    if (a === before.length) return null;
    let b = before.length - 1;
    while (b > a && before[b] === after[b]) b--;
    // [a..b] 구간 안에서 한쪽 끝 하나가 다른 쪽 끝으로 간 경우만
    const same = (x, y, len) => { for (let k = 0; k < len; k++) if (x[k] !== y[k]) return false; return true; };
    const span = b - a;
    if (before[a] === after[b] && same(before.slice(a + 1, b + 1), after.slice(a, b), span)) return after[b];   // 아래로
    if (before[b] === after[a] && same(before.slice(a, b), after.slice(a + 1, b + 1), span)) return after[a];   // 위로
    return null;
}

/** 옮긴 항목의 소속을 놓인 자리로 정한다. 바뀌었으면 true (folders 를 고침)
 *  · 앞뒤가 같은 폴더(사슬에서 가장 깊은 공통 폴더) → 그 폴더로(접혀 있으면 펼침)  · 앞뒤 어느 쪽도 원래 폴더가 아님 → 폴더에서 빠짐  · 나머지(원래 폴더 끝에 붙음) → 그대로 */
export function adoptMove(folders, order, moved) {
    const at = order.indexOf(moved);
    if (at < 0) return false;
    const of = folderIndex(folders);
    const own = of.get(moved) || null;
    const prev = at > 0 ? of.get(order[at - 1]) || null : null;
    const next = at + 1 < order.length ? of.get(order[at + 1]) || null : null;
    const nextChain = chainOf(next, folders);
    const shared = chainOf(prev, folders).filter(f => nextChain.includes(f)).pop() || null;
    const stays = !!own && (own === prev || own === next);
    if (shared) {
        if (own === shared || stays) return false;
        if (own) own.ids = own.ids.filter(id => id !== moved);
        const before = order.slice(0, at).filter(id => shared.ids.includes(id)).length;
        shared.ids.splice(Math.min(before, shared.ids.length), 0, moved);
        for (const f of chainOf(shared, folders)) f.open = true;
        return true;
    }
    if (own && !stays) {
        own.ids = own.ids.filter(id => id !== moved);
        return true;
    }
    return false;
}

/** 폴더에 항목을 넣는다(다른 폴더에 있던 것은 빼서) — ids 는 실제 순서대로 정렬 */
export function assignIds(folders, folder, ids, order = []) {
    const want = new Set(ids);
    for (const other of folders) if (other !== folder) other.ids = other.ids.filter(id => !want.has(id));
    const rank = new Map(order.map((id, i) => [id, i]));
    folder.ids = [...want].sort((x, y) => (rank.get(x) ?? 1e9) - (rank.get(y) ?? 1e9)).slice(0, LIMITS.ids);
    return folder;
}

/** 한곳에 모으기: 폴더 항목을 첫 항목 자리로 모은 새 순서(id 배열). 이미 붙어 있으면 null */
export function gatherOrder(order, folder) {
    const set = new Set(folder.ids);
    const first = order.findIndex(id => set.has(id));
    if (first < 0) return null;
    const members = order.filter(id => set.has(id));
    const rest = order.filter(id => !set.has(id));
    const before = order.slice(0, first).filter(id => !set.has(id)).length;
    const next = [...rest.slice(0, before), ...members, ...rest.slice(before)];
    return next.every((id, i) => id === order[i]) ? null : next;
}

/** 폴더 풀기(1.0.2) → 새 폴더 목록. 하위 폴더면 항목이 위 폴더로 올라가요(실제 순서대로) — 폴더 밖으로 빠져 위 폴더가 비던 것.
 *  맨 위 폴더면 항목은 폴더 밖으로, 그 안의 하위 폴더는 맨 위로 */
export function ungroupFolder(folders, id, order = []) {
    const folder = folders.find(f => f.id === id);
    if (!folder) return folders;
    const rest = folders.filter(f => f !== folder);
    for (const f of rest) if (f.parent === folder.id) f.parent = '';
    const up = folder.parent ? rest.find(f => f.id === folder.parent) : null;
    if (up) assignIds(rest, up, [...up.ids, ...folder.ids], order);
    return rest;
}

/** 폴더째 한 칸 옮기기(1.0.2) → 새 순서(id 배열) 또는 null.
 *  한 구간으로 붙어 있는 폴더를 바로 위(dir -1) · 아래(dir 1)에 보이는 한 칸과 자리를 바꿔요 — 한 칸 = 폴더 밖 항목 하나, 또는 같은 단의 폴더 하나 통째.
 *  하위 폴더는 위 폴더 구간 안에서만 움직여요. 떨어진 폴더(구간 둘 이상)는 먼저 「한곳에 모으기」 */
export function moveFolderBlock(order, folders, id, dir) {
    const runs = folderRuns(order, folders);
    const own = runs.filter(r => r.folder.id === id);
    if (own.length !== 1 || (dir !== -1 && dir !== 1)) return null;
    const run = own[0];
    let lo = 0, hi = order.length - 1;
    if (run.depth) {
        const host = runs.find(r => r.depth === 0 && r.folder.id === run.folder.parent && r.start <= run.start && r.end >= run.end);
        if (!host) return null;
        lo = host.start; hi = host.end;
    }
    const at = dir < 0 ? run.start - 1 : run.end + 1;
    if (at < lo || at > hi) return null;
    const other = runs.find(r => r.depth === run.depth && r.start <= at && r.end >= at);
    const [a, b] = other ? [other.start, other.end] : [at, at];
    const block = order.slice(run.start, run.end + 1), next = order.slice(a, b + 1);
    return dir < 0
        ? [...order.slice(0, a), ...block, ...next, ...order.slice(run.end + 1)]
        : [...order.slice(0, run.start), ...next, ...block, ...order.slice(b + 1)];
}

/** 폴더 창(1.0.3)에서 항목 한 칸 위 · 아래로 → 새 순서(id 배열) 또는 null.
 *  같은 폴더 직속 항목 중 실제 순서로 바로 앞(dir -1) · 뒤(dir 1) 항목과 자리만 바꿔요 — 그 사이 줄(하위 폴더 · 다른 항목)은 그대로 */
export function shiftInFolder(order, folder, id, dir) {
    if (!folder || (dir !== -1 && dir !== 1)) return null;
    const own = new Set(folder.ids);
    if (!own.has(id)) return null;
    const mine = order.filter(x => own.has(x)), at = mine.indexOf(id), other = mine[at + dir];
    if (at < 0 || other === undefined) return null;
    const next = order.slice(), i = next.indexOf(id), j = next.indexOf(other);
    [next[i], next[j]] = [next[j], next[i]];
    return next;
}
/** 폴더 창에 보일 폴더(1.0.3): scope 가 없으면 전부, 있으면 그 폴더와 안의 하위 폴더. 실제 순서에서 먼저 나오는 폴더부터(빈 폴더는 끝에) */
export function scopeFolders(folders, scope, order = []) {
    const list = scope ? folders.filter(f => f.id === scope || f.parent === scope) : folders.slice();
    const rank = new Map(order.map((id, i) => [id, i]));
    const first = f => Math.min(1e9, ...f.ids.map(id => rank.get(id) ?? 1e9), ...folders.filter(c => c.parent === f.id).flatMap(c => c.ids.map(id => rank.get(id) ?? 1e9)));
    return list.map((f, i) => ({ f, i, at: first(f) })).sort((a, b) => (a.at - b.at) || (a.i - b.i)).map(x => x.f);
}

/** 머리 줄 숫자 */
export function runStats(ids, enabled, tokens = new Map()) {
    let on = 0, sum = 0;
    for (const id of ids) if (enabled.has(id)) { on++; const t = Number(tokens.get(id)); if (Number.isFinite(t)) sum += t; }
    return { on, total: ids.length, tokens: sum };
}

/** 전체 켜기/끄기 계획 → [[id, 켬]] (바뀌는 것만). allowed(id) 가 거짓인 줄은 건너뜀.
 *  켤 때는 택1 묶음마다 하나만: 이미 켜진 것 → 없으면 순서상 첫 항목. 폴더 자체가 택1이면 끄기만 해요(켜기는 null) */
export function planToggleAll(ids, enabled, on, { groups = [], allowed = () => true, pick = false } = {}) {
    const usable = ids.filter(id => allowed(id));
    if (!on) return usable.filter(id => enabled.has(id)).map(id => [id, false]);
    if (pick) return null;
    const result = new Map(usable.map(id => [id, true]));
    for (const group of groups) {
        const inside = usable.filter(id => group.ids.includes(id));
        if (!inside.length) continue;
        // 묶음에 이미 켜진 것이 있으면(폴더 밖이어도) 그것을 남기고, 없으면 순서상 첫 항목 하나만 켜요
        const keep = group.ids.find(id => enabled.has(id)) ?? inside[0];
        for (const id of inside) if (id !== keep) result.set(id, enabled.has(id));
    }
    return [...result].filter(([id, value]) => value !== enabled.has(id));
}

// ───────── 구분선으로 자동 만들기 ─────────
const WORD = /[\p{L}\p{N}]/u;
const DECO = /[\p{So}\p{Sm}\p{Pd}─-╿▀-▟■-◿☀-➿]|\p{Extended_Pictographic}/u;
/** 앞뒤 장식 · 기호를 뗀 이름('' 이면 글자 없음) */
export function dividerTitle(name) {
    const chars = Array.from(String(name ?? '').replace(/\{\{[^}]*\}\}/g, '').normalize('NFC'));
    let a = 0, b = chars.length;
    while (a < b && !WORD.test(chars[a])) a++;
    while (b > a && !WORD.test(chars[b - 1]) && !/[)\]）】」』]/.test(chars[b - 1])) b--;
    return cleanName(chars.slice(a, b).join(''));
}
const emptyContent = prompt => !String(prompt?.content ?? '').replace(/\{\{\/\/[\s\S]*?\}\}/g, '').trim();
/** 구분선인가: 마커가 아니고 내용이 비었고 이름에 장식이 있거나 글자가 없음, 또는 🔻PICK/택1 머리 */
export function isDivider(prompt) {
    if (!prompt || prompt.marker) return false;
    const name = String(prompt.name ?? '');
    if (/^\s*🔻\s*(?:PICK|택1)\s*:/iu.test(name)) return true;
    if (!emptyContent(prompt)) return false;
    return !WORD.test(name) || DECO.test(name);
}
// 시작 · 끝 짝: ⤵ … ⤴, <tag> … </tag>, start · begin · 시작 … end · 끝 · 종료 (이름에서 표시를 뺀 글자가 같아야 짝)
const END_WORD = /\bend\b|종료|끝/i, START_WORD = /\b(?:start|begin)\b|시작/i;
const pairKey = name => String(name ?? '').replace(/[⤴⤵️]/gu, '').replace(/\b(?:start|begin|end)\b|시작|종료|끝/gi, '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
function markOf(name) {
    const text = String(name ?? '').trim(), bare = text.replace(/[⤴⤵️]/gu, '').trim();
    if (/⤴/u.test(text) || /^<\/[A-Za-z][\w-]*\s*>$/.test(bare) || END_WORD.test(bare)) return 'close';
    if (/⤵/u.test(text) || /^<[A-Za-z][\w-]*\b[^>]*>$/.test(bare) || START_WORD.test(bare)) return 'open';
    return '';
}
/** 짝이 맞은 시작 · 끝 → Map(끝 id → 시작 id) */
export function findPairs(order, promptOf) {
    const pairs = new Map(), stack = [];
    for (const id of order) {
        const prompt = promptOf(id);
        if (!prompt || prompt.marker) continue;
        const mark = markOf(prompt.name);
        if (mark === 'open') { stack.push(id); continue; }
        if (mark !== 'close' || !stack.length) continue;
        const key = pairKey(prompt.name);
        let k = stack.length - 1;
        while (k >= 0 && pairKey(promptOf(stack[k]).name) !== key) k--;
        if (k < 0 && /⤴/u.test(prompt.name) && /⤵/u.test(promptOf(stack.at(-1)).name)) k = stack.length - 1;
        if (k < 0) continue;
        pairs.set(id, stack[k]);
        stack.length = k;
    }
    return pairs;
}
const lead = name => Array.from(String(name ?? '').trim())[0] || '';
// 같은 글자(이모지)로 시작하는 글자 있는 빈 줄이 3개 이상 이어지면 구분선이 아니라 항목 묶음이에요(🚫 하나 · 🚫 둘 · 🚫 셋)
function plainRuns(order, promptOf) {
    const plain = new Set();
    const weak = id => { const p = promptOf(id); return isDivider(p) && WORD.test(String(p.name)) && !/^\s*🔻/u.test(String(p.name)); };
    for (let i = 0; i < order.length;) {
        if (!weak(order[i])) { i++; continue; }
        let j = i + 1;
        while (j < order.length && weak(order[j]) && lead(promptOf(order[j]).name) === lead(promptOf(order[i]).name)) j++;
        if (j - i >= 3) for (let k = i; k < j; k++) plain.add(order[k]);
        i = j;
    }
    return plain;
}
const titleOf = name => dividerTitle(String(name ?? '').replace(/[<>/]/g, ' ').replace(START_WORD, ' '));
/** 구분선 · 시작끝 짝으로 폴더 계획 → [{ name, ids, children: [{ name, ids }] }] (구분선 줄도 첫 항목)
 *  글자 없는 구분선은 닫기만. 짝 구역 안의 구역(구분선 · 안쪽 짝)은 하위 폴더. 항목이 머리 하나뿐인 폴더는 뺌 */
export function planFromDividers(order, promptOf) {
    const pairs = findPairs(order, promptOf), openers = new Set(pairs.values()), plain = plainRuns(order, promptOf);
    const plans = [];
    let top = null, sub = null;
    const start = (id, name, paired) => {
        const node = { name, ids: [id], children: [], paired, head: id };
        if (top?.paired) { sub = node; top.children.push(node); } else { top = node; sub = null; plans.push(node); }
    };
    for (const id of order) {
        const prompt = promptOf(id);
        if (openers.has(id)) { start(id, titleOf(prompt.name) || '폴더', true); continue; }
        if (pairs.has(id)) {
            const opener = pairs.get(id);
            if (sub?.head === opener) { sub.ids.push(id); sub = null; continue; }
            if (top?.head === opener) { top.ids.push(id); top = sub = null; continue; }
        }
        if (isDivider(prompt) && !plain.has(id)) {
            // 1.0.3 끝 표시(「━━ 문체 끝 ━━」)가 지금 구역과 같은 이름이면 새 구역을 열지 않고 그 구역을 닫아요(끝 줄도 그 구역에)
            if (markOf(prompt.name) === 'close' && pairKey(prompt.name)) {
                const key = pairKey(prompt.name), same = node => !!node && pairKey(promptOf(node.head)?.name) === key;
                if (same(sub)) { sub.ids.push(id); sub = null; continue; }
                if (same(top)) { top.ids.push(id); top = sub = null; continue; }
            }
            const title = dividerTitle(prompt.name);
            if (title) start(id, title, false);
            else if (top?.paired) { sub = null; top.ids.push(id); }
            else top = sub = null;
            continue;
        }
        (sub ?? top)?.ids.push(id);
    }
    const size = plan => plan.ids.length + plan.children.reduce((n, x) => n + x.ids.length, 0);
    return plans.map(node => {
        const children = node.children.filter(c => c.ids.length >= 2).map(c => ({ name: c.name, ids: c.ids }));
        const ids = [...node.ids, ...node.children.filter(c => c.ids.length < 2).flatMap(c => c.ids)];   // 혼자인 하위는 위 폴더로
        return { name: node.name, ids, children };
    }).flatMap(plan => {
        // 구분선 하나가 긴 목록의 절반 넘게 덮으면 그 폴더는 쓸모가 없어요 — 안의 하위만 맨 위로
        if (order.length >= 20 && size(plan) > order.length / 2) return plan.children.map(c => ({ ...c, children: [] }));
        return plan;
    }).filter(plan => plan.ids.length >= 2 || plan.children.length).slice(0, LIMITS.folders);
}

// ───────── 다른 프리셋에서 가져오기 ─────────
const nameKey = name => String(name ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
/** 프리셋 이름에서 판 번호를 뺀 줄기 — 같은 프리셋의 다른 판을 먼저 보여 줘요 */
export const presetStem = name => nameKey(name).toLowerCase().replace(/[\s_.v-]*\d+(?:\.\d+)*\s*$/i, '').replace(/[\d.]+/g, '').trim();
/** 다른 프리셋의 폴더를 지금 프리셋에 맞춘다. 항목은 ① 같은 id ② 같은 이름(지금 프리셋에 그 이름이 하나일 때)으로 찾고 못 찾으면 뺌.
 *  아직 폴더에 없는 항목은 실제 순서에서 앞뒤 항목이 같은 폴더면 그 안에 넣어요.
 *  source: 폴더 목록 · names: 원본 프리셋 { id: 이름 } · prompts: 지금 프리셋 프롬프트 · order: 지금 순서 → { folders, stats } */
export function remapFolders(source, names, prompts, order) {
    const known = new Set(prompts.map(p => p.identifier)), byName = new Map();
    for (const p of prompts) { const key = nameKey(p.name); if (key) byName.set(key, byName.has(key) ? null : p.identifier); }
    const stats = { kept: 0, byName: 0, missing: 0, placed: 0 }, taken = new Set(), idMap = new Map();
    const fresh = new Set(source.map(f => f.id));
    const folders = source.map(folder => {
        const ids = [];
        for (const id of folder.ids) {
            let to = known.has(id) ? id : null;
            if (to) stats.kept++;
            else { to = byName.get(nameKey(names?.[id])) ?? null; if (to) stats.byName++; else stats.missing++; }
            if (to && !taken.has(to)) { taken.add(to); ids.push(to); }
        }
        const id = newFolderId(fresh);
        fresh.add(id); idMap.set(folder.id, id);
        return { ...folder, id, ids };
    });
    for (const f of folders) f.parent = f.parent ? idMap.get(f.parent) || '' : '';
    const of = folderIndex(folders), list = order.filter(id => known.has(id));
    list.forEach((id, i) => {
        if (taken.has(id)) return;
        let p = i - 1, n = i + 1;
        while (p >= 0 && !taken.has(list[p])) p--;
        while (n < list.length && !taken.has(list[n])) n++;
        const before = p >= 0 ? of.get(list[p]) : null, after = n < list.length ? of.get(list[n]) : null;
        if (before && before === after) { before.ids.push(id); of.set(id, before); taken.add(id); stats.placed++; }
    });
    const rank = new Map(list.map((id, i) => [id, i]));
    for (const f of folders) f.ids.sort((x, y) => (rank.get(x) ?? 1e9) - (rank.get(y) ?? 1e9));
    return { folders: dropEmpty(folders), stats };
}
