// 1.2.0 받은 글꾸 관리(점검 1112 「테마 마」) — DOM 없는 순수 함수(node 시험 tools/tests/log-copy-mine.mjs). 쓰는 곳: log-copy-sheet.js · mart-import.js · mart-retake.js.
//   ① 받을 때 표(info): 받은 날 · 틀 지문(hash) · 마트가 실어 보내면 판(rev) · 고친 날(updated) — 다시 받을 때 「같은 틀 / 바뀐 틀」을 가려요
//   ② 다시 받기: 테마에서 바꾼 조절 값(set)이 있으면 덮어쓰기 전에 물어요 — 덮어쓰기 · 조절 값 지키고 틀만 새로 · 그만두기
//   ③ 내 글꾸 차례: 즐겨찾기 → 최근 → 받은 차례 · 지운 id 는 즐겨찾기 · 최근에서도 빼요(되돌리면 다시)
//   ④ 「내 글꾸 n/20」 줄과 꽉 찼을 때 할 일
export const MINE_MAX = 20;   // mart-import.js CUSTOM_MAX · settings.js tidyLogCopy 와 같은 값

/** 틀 글의 짧은 지문(FNV-1a 32 → 16진 8자리) — 같은 글이면 같은 값 */
export function fingerprint(text) {
    let h = 0x811c9dc5;
    const s = String(text ?? '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
}
const bodyOf = item => item?.frame?.html ?? item?.template ?? item?.html ?? '';
const day = now => { const d = new Date(now); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const REV = /^[\w.-]{1,16}$/, DAY = /^\d{4}-\d{2}-\d{2}$/;

/** 마트 꾸러미 항목의 판 · 고친 날(있을 때만 — 지금 마트는 싣지 않아요 · 마트-③ 「rev」 · 「updated」가 오면 그대로 읽어요) */
export function metaOf(raw) {
    const out = {};
    const rev = raw?.rev == null ? '' : String(raw.rev);
    if (REV.test(rev)) out.rev = rev;
    if (typeof raw?.updated === 'string' && DAY.test(raw.updated.slice(0, 10))) out.updated = raw.updated.slice(0, 10);
    return out;
}

/** 받을 때 내 글꾸에 붙이는 표 */
export function stampInfo(item, now = Date.now()) {
    return { got: day(now), hash: fingerprint(bodyOf(item)), ...(item?.rev ? { rev: item.rev } : {}), ...(item?.updated ? { updated: item.updated } : {}) };
}

/** 설정 정리(settings.js 와 같은 규칙 — 모르는 칸 · 틀린 꼴은 버려요) */
export function tidyInfo(info) {
    if (!info || typeof info !== 'object') return null;
    const out = {};
    if (DAY.test(info.got ?? '')) out.got = info.got;
    if (/^[0-9a-f]{8}$/.test(info.hash ?? '')) out.hash = info.hash;
    if (REV.test(info.rev ?? '')) out.rev = info.rev;
    if (DAY.test(info.updated ?? '')) out.updated = info.updated;
    return Object.keys(out).length ? out : null;
}

const setText = set => { try { return JSON.stringify(set ?? null); } catch { return ''; } };
const plainSet = set => setText(set) === '{"blGeulkku":2}' || set == null;

/**
 * 다시 받기 견주기 — old: 이미 있는 내 글꾸 · item: 새로 받는 항목(readMart 결과)
 * @returns {{ frame: 'same'|'new', tuned: boolean, keepable: boolean }}
 *   frame: 틀 글이 같은가(마트 판이 바뀌었나) · tuned: 테마에서 바꾼 조절 값이 덮어쓰기로 사라지나 · keepable: 「조절 값 지키고 틀만 새로」가 되나(둘 다 심플 글꾸 · 둘 다 옛 틈 템플릿 글꾸)
 *   옛 틈 템플릿 글꾸는 저장한 색(colors)이 조절 값이에요
 */
export function retakeOf(old, item) {
    const same = bodyOf(old) === bodyOf(item);
    const simple = !!old?.frame && item?.kind === 'geulkku-simple', inked = !old?.frame && typeof old?.template === 'string' && item?.kind === 'geulkku';
    const tuned = simple ? !plainSet(old.set) && setText(old.set) !== setText(item.set) : inked && !!old.colors && setText(old.colors).toLowerCase() !== setText(item.colors).toLowerCase();
    return { frame: same ? 'same' : 'new', tuned, keepable: simple || inked };
}

/** 다시 받을 때 견줄 옛것 — 내 글꾸 · 없으면 「블루레몬 추천」 판에서 바꾼 조절 값(logCopy.pickSet[id] — 받으면 추천 줄에서 빠지고 받은 글꾸가 이겨요) */
export function oldOf(lc, item) {
    const set = lc?.pickSet?.[item.id];
    return lc?.custom?.find(c => c.id === item.id) ?? (item.frame && set && typeof set === 'object' && !plainSet(set) && setText(set) !== setText(item.set) ? { frame: item.frame, set } : null);
}

/** 「조절 값 지키고 틀만 새로」 — 새 등록 값(틀)에 옛 조절 값 · 옛 틈 템플릿 글꾸는 저장한 색 */
export const keepTuning = (entry, old) => (old?.set && entry?.frame ? { ...entry, set: JSON.parse(JSON.stringify(old.set)) }
    : old?.colors && !old.frame && entry?.template !== undefined ? { ...entry, colors: { ...entry.colors, ...old.colors } } : entry);

/** 11-12 → 「11월 12일」 */
export const dayLabel = text => (DAY.test(text ?? '') ? `${Number(text.slice(5, 7))}월 ${Number(text.slice(8, 10))}일` : '');

/** 고른 내 글꾸 한 줄 표(받은 날 · 판) — 표가 없는 옛 글꾸는 '' */
export function infoLabel(item) {
    const info = item?.info;
    if (!info) return '';
    const parts = [];
    if (info.got) parts.push(`${dayLabel(info.got)} 받음`);
    if (info.rev) parts.push(`판 ${info.rev}${info.updated ? ` · ${dayLabel(info.updated)} 고침` : ''}`);
    return parts.join(' · ');
}

/** 「내 글꾸 n/20」 — full 이면 할 일까지 */
export function countLine(n, max = MINE_MAX) {
    const full = n >= max;
    return { full, text: full ? `내 글꾸 ${n}/${max} 꽉 찼어요 — 새로 받으려면 쓰지 않는 글꾸를 ✕ 로 지워요` : `내 글꾸 ${n}/${max}` };
}

/** 내 글꾸 차례 — 즐겨찾기 → 최근 → 받은 차례 */
export function mineOrder(custom, fav = [], recent = []) {
    const ids = custom.map(c => c.id);
    const f = ids.filter(id => fav.includes(id)), r = recent.filter(id => ids.includes(id) && !f.includes(id));
    const rank = new Map([...f, ...r, ...ids.filter(id => !f.includes(id) && !r.includes(id))].map((id, i) => [id, i]));
    return [...custom].sort((a, b) => rank.get(a.id) - rank.get(b.id));
}

/** 지우기(되돌릴 수 있게 지운 것을 돌려줘요) — s: logCopy 저장 칸 */
let trail = [];   // 지운 id 까지 낀 받은 차례 — 여럿을 지우고 어느 차례로 되돌려도 제자리(새로 받은 것은 끝에 · 차례가 안 맞으면 새로 적어요)
export function removeMine(s, id) {
    const at = s.custom.findIndex(c => c.id === id);
    if (at < 0) return null;
    const ids = s.custom.map(c => c.id);
    trail = [...trail, ...ids.filter(x => !trail.includes(x))];
    if (trail.filter(x => ids.includes(x)).join() !== ids.join()) trail = ids;
    const undo = { entry: s.custom[at], after: trail.slice(trail.indexOf(id) + 1), fav: s.fav.indexOf(id), recent: s.recent.indexOf(id) };   // after: 뒤에 있던 id — 되돌릴 때 그 앞에(번호는 그새 바뀌어요)
    s.custom = s.custom.filter(c => c.id !== id);
    s.fav = s.fav.filter(x => x !== id);
    s.recent = s.recent.filter(x => x !== id);
    return undo;
}

/** 되돌리기 — 그새 같은 id 를 다시 받았거나 꽉 찼으면 false */
export function restoreMine(s, undo, max = MINE_MAX) {
    if (!undo || s.custom.some(c => c.id === undo.entry.id) || s.custom.length >= max) return false;
    const put = (list, at, id) => { if (at < 0 || list.includes(id)) return list; const next = [...list]; next.splice(Math.min(at, next.length), 0, id); return next; };
    const custom = [...s.custom], i = custom.findIndex(c => undo.after.includes(c.id)); custom.splice(i < 0 ? custom.length : i, 0, undo.entry);
    s.custom = custom;
    s.fav = put(s.fav, undo.fav, undo.entry.id);
    s.recent = put(s.recent, undo.recent, undo.entry.id).slice(0, 5);
    return true;
}
