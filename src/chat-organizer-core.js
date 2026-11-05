// 채팅 정리 (1.0.2) — 순수 계산. 화면 · 저장 · 실리태번 연결은 chat-organizer.js.
//
// 일부는 ChatsPlus (SoFizzticated/SillyTavern-ChatPlus, AGPL-3.0)와 그 한국어판 ChatsPlus (Mod) (sdafaff346/stjchatMod, AGPL-3.0)를
// 참고해 우리 구조에 맞게 다시 썼어요(THIRD-PARTY-NOTICES.md). 원작에서 그대로 옮긴 식은 날짜 이름표(dayLabel · shortTime · fullTime)의 규칙뿐이고,
// 저장 모양 · 채팅 찾기 · 폴더 계산은 새로 썼어요.
//
// 저장 모양(테마 설정 extension_settings.salty.chatOrganizer):
//   { on, folders: [{ id, name, parent, open }], chats: { [id]: { k, o, f, i?, pin?, in? } } }
//   · 채팅 하나 = 안정 키(id, 우리가 만든 짧은 글) → k 'c'(캐릭터) · 'g'(그룹), o 주인(아바타 파일 · 그룹 id), f 채팅 파일 이름(.jsonl 뺌),
//     i 채팅 안의 integrity(실리태번이 채팅을 만들 때 넣는 고유 값 — 파일 이름이 밖에서 바뀌어도 그대로), pin 고정, in 들어 있는 폴더 id.
//   · 폴더 순서 = 배열 순서. parent '' 는 맨 위. 하위 폴더는 DEPTH 단까지.
//   원작의 「밖에서 이름을 바꾸면 폴더가 깨짐」을 피하려고 파일 이름을 열쇠로 쓰지 않아요: 이름이 달라도 integrity 가 같으면 같은 채팅으로 보고 이름을 고쳐 적어요.

export const LIMITS = Object.freeze({ folders: 200, chats: 3000, name: 40, depth: 3, file: 300 });

const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const cleanName = (v, max = LIMITS.name) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanId = v => (typeof v === 'string' && /^[\w-]{1,32}$/.test(v) && !BAD_KEYS.has(v) ? v : '');
/** 채팅 파일 이름(.jsonl 뺌) — 경로 구분자 · 제어 문자가 든 이름은 버려요 */
export function fileIdOf(name) {
    const s = String(name ?? '').replace(/\.jsonl$/i, '');
    if (!s || s.length > LIMITS.file || /[\\/\u0000-\u001f]/.test(s) || s === '.' || s === '..') return '';
    return s;
}

/** 새 id — 이미 쓰는 것과 겹치지 않게 */
export function newId(taken = new Set(), prefix = 'c', rand = Math.random) {
    for (let n = 0; n < 1000; n++) {
        const id = prefix + Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0');
        if (!taken.has(id)) return id;
    }
    let n = taken.size;
    while (taken.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
}

/** 저장값 다듬기: 모르는 칸 · 깨진 값은 버리고 한도 안으로. 원본은 바꾸지 않아요 */
export function tidyStore(raw) {
    const src = plain(raw) ? raw : {};
    const folders = [];
    const seen = new Set();
    for (const f of Array.isArray(src.folders) ? src.folders : []) {
        if (!plain(f) || folders.length >= LIMITS.folders) continue;
        let id = cleanId(f.id);
        if (!id || seen.has(id)) id = newId(seen, 'f');
        seen.add(id);
        folders.push({ id, name: cleanName(f.name) || '폴더', parent: cleanId(f.parent), open: f.open !== false });
    }
    // 없는 부모 · 자기 자신 · 고리 · 너무 깊음 → 맨 위로
    const byId = new Map(folders.map(f => [f.id, f]));
    for (const f of folders) if (f.parent && (!byId.has(f.parent) || f.parent === f.id)) f.parent = '';
    for (const f of folders) {
        const path = new Set([f.id]);
        let p = f.parent, depth = 1;
        while (p) {
            if (path.has(p) || depth >= LIMITS.depth) { f.parent = ''; break; }
            path.add(p); depth++;
            p = byId.get(p)?.parent || '';
        }
    }
    const chats = {};
    let count = 0;
    const entries = plain(src.chats) ? Object.entries(src.chats) : [];
    for (const [key, c] of entries) {
        if (count >= LIMITS.chats) break;
        const id = cleanId(key);
        if (!id || !plain(c)) continue;
        const k = c.k === 'g' ? 'g' : c.k === 'c' ? 'c' : '';
        const o = typeof c.o === 'string' ? c.o.slice(0, LIMITS.file) : '';
        const f = fileIdOf(c.f);
        if (!k || !o || !f) continue;
        const e = { k, o, f };
        if (typeof c.i === 'string' && c.i && c.i.length <= 200) e.i = c.i;
        if (c.pin === true) e.pin = true;
        const inside = cleanId(c.in);
        if (inside && byId.has(inside)) e.in = inside;
        if (!e.pin && !e.in) continue;   // 고정도 폴더도 아니면 남길 까닭이 없어요
        chats[id] = e; count++;
    }
    return { on: src.on === true, folders, chats };
}

// ───────── 서버 줄 ─────────
/** /api/chats/recent 한 줄 → 우리 줄. 깨진 줄은 null */
export function normalizeRow(item, toMs = defaultMs) {
    if (!plain(item)) return null;
    const f = fileIdOf(item.file_id ?? item.file_name);
    const k = item.group ? 'g' : item.avatar ? 'c' : '';
    const o = String(item.group || item.avatar || '');
    if (!f || !k || !o) return null;
    const meta = plain(item.chat_metadata) ? item.chat_metadata : null;
    const integrity = typeof meta?.integrity === 'string' && meta.integrity.length <= 200 ? meta.integrity : '';
    const count = Number(item.chat_items ?? item.message_count);
    return {
        k, o, f, integrity,
        last: toMs(item.last_mes),
        count: Number.isFinite(count) && count >= 0 ? count : 0,
        mes: typeof item.mes === 'string' ? item.mes.slice(0, 400) : '',
        size: typeof item.file_size === 'string' ? item.file_size.slice(0, 20) : '',
    };
}
export const rowKey = r => `${r.k}\u0001${r.o}\u0001${r.f}`;
export function defaultMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const t = Date.parse(String(value ?? ''));
    return Number.isFinite(t) ? t : 0;
}

/** 줄(또는 {k,o,f,integrity})에 맞는 저장 항목 id — integrity 가 같으면 먼저, 아니면 주인 · 이름이 같은 것 */
export function findEntry(store, ref) {
    let byName = '';
    for (const [id, e] of Object.entries(store.chats)) {
        if (e.k !== ref.k || e.o !== ref.o) continue;
        if (ref.integrity && e.i && e.i === ref.integrity) return id;
        if (!byName && e.f === ref.f && (!e.i || !ref.integrity || e.i === ref.integrity)) byName = id;
    }
    return byName;
}

/**
 * 받은 줄로 저장 항목을 맞춰요: integrity 가 같은데 파일 이름이 다르면(밖에서 이름 바꿈) 이름을 고쳐 적고, 비어 있던 integrity 는 채워요.
 * 같은 이름의 다른 채팅(integrity 가 다름)은 건드리지 않아요. 반환: 바꾼 항목 수
 */
export function reconcile(store, rows) {
    let changed = 0;
    const byIntegrity = new Map();
    for (const r of rows) if (r?.integrity) byIntegrity.set(`${r.k}\u0001${r.o}\u0001${r.integrity}`, r);
    const names = new Set(rows.map(r => r && rowKey(r)));
    for (const e of Object.values(store.chats)) {
        if (e.i) {
            const r = byIntegrity.get(`${e.k}\u0001${e.o}\u0001${e.i}`);
            if (r && r.f !== e.f) { e.f = r.f; changed++; }
        } else if (names.has(`${e.k}\u0001${e.o}\u0001${e.f}`)) {
            const r = rows.find(x => x && x.k === e.k && x.o === e.o && x.f === e.f);
            if (r?.integrity) { e.i = r.integrity; changed++; }
        }
    }
    return changed;
}

/** 실리태번 CHAT_RENAMED 를 따라 이름 고치기 (old/new 는 .jsonl 이 붙어 와도 돼요) */
export function renameEntries(store, { k, o, from, to }) {
    const a = fileIdOf(from), b = fileIdOf(to);
    if (!a || !b || a === b) return 0;
    let n = 0;
    for (const e of Object.values(store.chats)) if (e.k === k && e.o === o && e.f === a) { e.f = b; n++; }
    return n;
}
/** 캐릭터 아바타 파일이 바뀌면(CHARACTER_RENAMED) 주인도 */
export function moveOwner(store, from, to) {
    if (!from || !to || from === to) return 0;
    let n = 0;
    for (const e of Object.values(store.chats)) if (e.k === 'c' && e.o === from) { e.o = to; n++; }
    return n;
}
/** 지운 채팅들({k,o,f})을 저장에서 빼요 */
export function dropEntries(store, refs) {
    let n = 0;
    for (const ref of refs) for (const [id, e] of Object.entries(store.chats)) if (e.k === ref.k && e.o === ref.o && e.f === ref.f) { delete store.chats[id]; n++; }
    return n;
}

/** 항목을 고치고(고정 · 폴더), 고정도 폴더도 없어지면 빼요. 반환: 항목 id(빠졌으면 '') */
export function setEntry(store, ref, change) {
    let id = findEntry(store, ref);
    if (!id) {
        if (Object.keys(store.chats).length >= LIMITS.chats) return '';
        id = newId(new Set(Object.keys(store.chats)), 'c');
        store.chats[id] = { k: ref.k, o: ref.o, f: ref.f, ...(ref.integrity ? { i: ref.integrity } : {}) };
    }
    const e = store.chats[id];
    if (ref.integrity && !e.i) e.i = ref.integrity;
    if (own(change, 'pin')) { if (change.pin) e.pin = true; else delete e.pin; }
    if (own(change, 'in')) { if (change.in) e.in = change.in; else delete e.in; }
    if (!e.pin && !e.in) { delete store.chats[id]; return ''; }
    return id;
}
/** 고정한 채팅 — /api/chats/recent 의 pinned 칸 꼴(서버가 개수 한도와 상관없이 맨 앞에 넣어 줘요) */
export function pinnedParam(store) {
    return Object.values(store.chats).filter(e => e.pin).map(e => (e.k === 'g' ? { group: e.o, file_name: `${e.f}.jsonl` } : { avatar: e.o, file_name: `${e.f}.jsonl` }));
}

// ───────── 폴더 ─────────
export function depthOf(folders, id) {
    const byId = new Map(folders.map(f => [f.id, f]));
    let d = 0, p = id;
    const seen = new Set();
    while (p && byId.has(p) && !seen.has(p)) { seen.add(p); d++; p = byId.get(p).parent; }
    return d;
}
/** 폴더 id 와 그 아래 모든 폴더 id */
export function subtreeIds(folders, id) {
    const out = new Set([id]);
    let grew = true;
    while (grew) { grew = false; for (const f of folders) if (f.parent && out.has(f.parent) && !out.has(f.id)) { out.add(f.id); grew = true; } }
    return out;
}
const height = (folders, id) => {
    const kids = folders.filter(f => f.parent === id);
    return 1 + (kids.length ? Math.max(...kids.map(k => height(folders, k.id))) : 0);
};
/** id 폴더를 parent 아래로 옮길 수 있나(고리 · 깊이) — parent '' 는 맨 위 */
export function canNest(folders, id, parent) {
    if (!parent) return true;
    if (subtreeIds(folders, id).has(parent)) return false;
    return depthOf(folders, parent) + height(folders, id) <= LIMITS.depth;
}
/** 화면 차례: 부모 바로 아래 자식(배열 차례) — [{ folder, depth }] */
export function folderTree(folders) {
    const out = [];
    const walk = (parent, depth) => { for (const f of folders) if (f.parent === parent) { out.push({ folder: f, depth }); walk(f.id, depth + 1); } };
    walk('', 0);
    return out;
}
export function addFolder(store, name, parent = '') {
    if (store.folders.length >= LIMITS.folders) return '';
    if (parent && (!store.folders.some(f => f.id === parent) || depthOf(store.folders, parent) >= LIMITS.depth)) parent = '';
    const id = newId(new Set(store.folders.map(f => f.id)), 'f');
    store.folders.push({ id, name: cleanName(name) || '새 폴더', parent, open: true });
    return id;
}
export function renameFolder(store, id, name) {
    const f = store.folders.find(x => x.id === id);
    const n = cleanName(name);
    if (!f || !n || n === f.name) return false;
    f.name = n; return true;
}
/** 폴더를 다른 폴더 안(또는 맨 위)으로 — 그 단의 맨 끝에 붙어요 */
export function nestFolder(store, id, parent = '') {
    const f = store.folders.find(x => x.id === id);
    if (!f || f.parent === parent || !canNest(store.folders, id, parent)) return false;
    f.parent = parent;
    const i = store.folders.indexOf(f);
    store.folders.splice(i, 1); store.folders.push(f);
    return true;
}
/** 같은 단 안에서 한 칸 위(-1) · 아래(+1) */
export function shiftFolder(store, id, dir) {
    const f = store.folders.find(x => x.id === id);
    if (!f) return false;
    const sibs = store.folders.filter(x => x.parent === f.parent);
    const at = sibs.indexOf(f), other = sibs[at + (dir < 0 ? -1 : 1)];
    if (!other) return false;
    const a = store.folders.indexOf(f), b = store.folders.indexOf(other);
    store.folders[a] = other; store.folders[b] = f;
    return true;
}
/**
 * 폴더 지우기: 하위 폴더는 한 단 위로, 안의 채팅은 위 폴더로(맨 위 폴더였으면 폴더 밖으로). 채팅 파일은 그대로예요.
 * 반환: { moved: 옮긴 채팅 수, lifted: 올린 하위 폴더 수 }
 */
export function removeFolder(store, id) {
    const f = store.folders.find(x => x.id === id);
    if (!f) return { moved: 0, lifted: 0 };
    let moved = 0, lifted = 0;
    for (const sub of store.folders) if (sub.parent === id) { sub.parent = f.parent; lifted++; }
    for (const [cid, e] of Object.entries(store.chats)) {
        if (e.in !== id) continue;
        moved++;
        if (f.parent) e.in = f.parent;
        else { delete e.in; if (!e.pin) delete store.chats[cid]; }
    }
    store.folders.splice(store.folders.indexOf(f), 1);
    return { moved, lifted };
}
/** 폴더 안 채팅 수(하위 폴더 포함 여부 선택) */
export function folderCount(store, id, deep = false) {
    const ids = deep ? subtreeIds(store.folders, id) : new Set([id]);
    return Object.values(store.chats).filter(e => e.in && ids.has(e.in)).length;
}

// ───────── 찾기 · 날짜 ─────────
const fold = s => String(s ?? '').normalize('NFKC').toLocaleLowerCase();
/** 낱말마다(공백으로 나눔) 이름 · 파일 · 마지막 말 어딘가에 있으면 */
export function matches(row, query, nameOf = () => '') {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const hay = fold(`${nameOf(row)}\n${row.f}\n${row.mes || ''}`);
    return words.every(w => hay.includes(w));
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysAgo = (ms, now) => Math.round((dayStart(new Date(now)) - dayStart(new Date(ms))) / 86400000);
/** 날짜 머리: 오늘 · 어제 · 11월 3일 (화) · (다른 해) 2025년 11월 3일 (월) — 규칙은 ChatsPlus (Mod) ui-helpers 그대로 */
export function dayLabel(ms, now = Date.now()) {
    if (!ms) return '날짜 모름';
    const d = new Date(ms), diff = daysAgo(ms, now);
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    const md = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
    return d.getFullYear() === new Date(now).getFullYear() ? md : `${d.getFullYear()}년 ${md}`;
}
/** 줄 끝 짧은 시각: 오늘 오후 3:05 · 어제 · 11/3 · 2025/11/3 */
export function shortTime(ms, now = Date.now()) {
    if (!ms) return '';
    const d = new Date(ms), diff = daysAgo(ms, now);
    if (diff === 0) { const h = d.getHours(); return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`; }
    if (diff === 1) return '어제';
    return d.getFullYear() === new Date(now).getFullYear() ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
export function fullTime(ms) {
    if (!ms) return '';
    const d = new Date(ms), h = d.getHours();
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** 최근 차례(새것 먼저)로 날짜 묶음 — [{ label, rows }] */
export function groupByDay(rows, now = Date.now()) {
    const out = [];
    for (const r of [...rows].sort((a, b) => b.last - a.last)) {
        const label = dayLabel(r.last, now);
        if (out.at(-1)?.label === label) out.at(-1).rows.push(r);
        else out.push({ label, rows: [r] });
    }
    return out;
}
