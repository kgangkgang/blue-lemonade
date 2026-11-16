// 메모 — 다른 기기와 합치기 (7.0.1, 메모 1.3.5). 공용 규칙은 ../../settings-merge.js.
// 탭이 오래 숨었다가 다시 보이면 서버의 extension_settings['bl-notes'] 를 읽어, 이 탭이 모르는 메모 · 더 늦게 고친 메모를 저장 전에 합친다.
// 지운 메모는 gone: { id: 지운 시각 } 에 남겨 다른 기기의 옛 목록이 되살리지 못하게 한다(30일 · 500개).
// 폴더(folders)는 합친 메모가 쓰는 것만 서버에서 가져온다(빈 폴더는 메모 쪽 정리가 걷는다). 쪽지 자리(stickies) · 모양(look)은 기기마다 그대로.
import { mergeById, markGone, tidyGone, registerSettingsMerge } from '../../settings-merge.js';

export const MODULE = 'bl-notes';
const HEX6 = /^#[0-9a-f]{6}$/i;

/** 서버에서 온 메모 한 개를 이 탭의 모양으로 (store() 의 다듬기와 같은 규칙) */
export function cleanNote(n) {
    const out = { ...n, id: String(n.id), title: String(n.title ?? ''), body: String(n.body ?? ''), updated: Number(n.updated) || 0 };
    out.color = HEX6.test(String(n.color || '')) ? n.color : '';
    out.ink = HEX6.test(String(n.ink || '')) ? n.ink : '';
    if (!(n.owner && typeof n.owner === 'object')) delete out.owner; else out.owner = { ...n.owner };
    if (!(typeof n.folder === 'string' && n.folder)) delete out.folder;
    return out;
}

/** 7.0.2 합치기 시각: 내용(updated) · 귀속 · 폴더(metaUpdated) 가운데 늦은 것 — 채팅 이름 바꾸기 · 폴더 묶기도 다른 기기에 전해지게 */
export const noteStamp = n => Math.max(Number(n?.updated) || 0, Number(n?.metaUpdated) || 0);

// 1.5.9 칸별 합치기 — 내용(제목 · 본문 · 색 등)은 updated 가 늦은 쪽, 귀속 · 폴더는 metaUpdated 가 늦은 쪽을 **따로** 골라요.
//   1.5.8 까지는 둘 중 늦은 시각 하나로 메모를 통째로 골라서, 한 기기에서 귀속 · 폴더만 바꿔도(채팅 이름 바꾸기 · 폴더 정리 포함)
//   다른 기기가 그 전에 고친 본문이 옛 본문으로 덮였어요(진 쪽이 다음에 합칠 때 새 본문까지 사라짐).
//   귀속 · 폴더 시각이 같으면(둘 다 안 바꿈 · 옛 판이 updated 로만 알린 귀속) 내용이 늦은 쪽 것을 따라가요 — 옛 동작 그대로.
const META_KEYS = ['owner', 'folder'];
const SKIP_KEYS = new Set([...META_KEYS, 'metaUpdated', 'id']);
const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const sameNote = (a, b) => { const flat = n => JSON.stringify(Object.keys(n).sort().map(k => [k, n[k]])); return flat(a) === flat(b); };
/** 순수: 같은 id 의 이 탭 메모(mine) · 서버 메모(theirs · cleanNote 를 거친 것)를 칸별로 합친 새 객체 */
export function mergeNotePair(mine, theirs) {
    const content = num(theirs.updated) > num(mine.updated) ? theirs : mine;
    const mm = num(mine.metaUpdated), tm = num(theirs.metaUpdated);
    const meta = tm > mm ? theirs : mm > tm ? mine : content;
    const next = { id: mine.id };
    for (const key of Object.keys(content)) if (!SKIP_KEYS.has(key)) next[key] = content[key];
    if (meta.owner && typeof meta.owner === 'object') next.owner = { ...meta.owner };
    if (typeof meta.folder === 'string' && meta.folder) next.folder = meta.folder;
    if (Math.max(mm, tm)) next.metaUpdated = Math.max(mm, tm);
    return next;
}

/** 지운 메모 기록 (removeNote 가 부른다) */
export function noteGone(store, id, now = Date.now()) {
    if (!store || id == null) return;
    if (!store.gone || typeof store.gone !== 'object' || Array.isArray(store.gone)) store.gone = {};
    markGone(store.gone, id, now);
}

/** 순수: 이 탭의 store(extension_settings['bl-notes'])에 서버 값 server 를 합친다. { pulled, removed, needSave, changed } */
export function mergeNotes(store, server, now = Date.now()) {
    if (!store || !Array.isArray(store.notes)) return null;
    const remote = server && typeof server === 'object' ? server : {};
    // 둘 다 가진 메모는 먼저 칸별로 합쳐 두고(mergeNotePair), mergeById 에는 합친 결과를 서버 것으로 보여 줘요 — 새 메모 · 지운 기록 · 자리는 공용 규칙 그대로
    const accept = n => !!n && typeof n === 'object' && n.id != null && String(n.id) !== '';
    const mineById = new Map(store.notes.map(n => [String(n?.id), n]));
    let pairPulled = 0, pairSave = false;
    const remoteNotes = (Array.isArray(remote.notes) ? remote.notes : []).map(item => {
        const mine = accept(item) ? mineById.get(String(item.id)) : null;
        if (!mine) return item;
        const theirs = cleanNote(item), next = mergeNotePair(mine, theirs);
        if (!sameNote(next, theirs)) pairSave = true;       // 서버가 모르는 것이 있음 → 다음 저장이 올려요
        if (!sameNote(next, mine)) {                         // 이 탭이 모르는 것이 있음 → 제자리에서 고쳐요(화면이 잡은 객체 그대로)
            for (const key of Object.keys(mine)) if (!(key in next)) delete mine[key];
            Object.assign(mine, next); pairPulled++;
        }
        return { ...mine };
    });
    const out = mergeById({
        local: store.notes, remote: remoteNotes, localGone: store.gone, remoteGone: remote.gone, now,
        accept,
        clone: cleanNote,
        stamp: noteStamp,
    });
    if (pairPulled) { out.pulled += pairPulled; out.changed = true; }
    if (pairSave) out.needSave = true;
    store.gone = out.gone;
    // 합친 메모가 가리키는 폴더가 이 탭에 없으면 서버에서 (이름째)
    if (!Array.isArray(store.folders)) store.folders = [];
    const have = new Set(store.folders.map(f => String(f?.id)));
    const used = new Set(store.notes.map(n => n.folder).filter(Boolean));
    for (const f of Array.isArray(remote.folders) ? remote.folders : []) {
        if (!f?.id) continue;
        const mine = have.has(String(f.id)) ? store.folders.find(x => String(x?.id) === String(f.id)) : null;
        if (mine) {   // 7.0.2 같은 폴더면 이름을 늦게 고친 쪽
            if ((Number(f.updated) || 0) > (Number(mine.updated) || 0)) { mine.name = String(f.name ?? ''); mine.updated = Number(f.updated); out.pulled++; out.changed = true; }
            else if ((Number(mine.updated) || 0) > (Number(f.updated) || 0)) out.needSave = true;
            continue;
        }
        if (!used.has(String(f.id))) continue;
        store.folders.push({ ...f, id: String(f.id), name: String(f.name ?? '') });
        have.add(String(f.id));
    }
    // 서버 기록과 지금 기록을 같게 맞춘 뒤 오래된 것을 걷는다
    store.gone = tidyGone(store.gone, now);
    return out;
}

/** 합친 뒤 알림 한 줄 */
export function notesMessage({ pulled = 0, removed = 0 } = {}) {
    if (pulled && removed) return `다른 기기의 메모 ${pulled}개를 가져오고 ${removed}개를 뺐어요.`;
    if (pulled) return `다른 기기의 메모 ${pulled}개를 가져왔어요.`;
    if (removed) return `다른 기기에서 지운 메모 ${removed}개를 뺐어요.`;
    return '';
}

/** index.js 가 한 번 부른다: store() · 다시 그리기 · 알림 함수를 받아 합치기를 등록 */
export function registerNotesMerge({ store, refresh, notify }) {
    return registerSettingsMerge(MODULE, ext => {
        const out = mergeNotes(store(), ext?.[MODULE]);
        if (!out) return null;
        if (out.changed) {
            try { refresh?.(); } catch (error) { console.warn('[Blue Lemonade] 메모 합친 뒤 다시 그리기', error); }
            const text = notesMessage(out);
            if (text) notify?.(text);
        }
        return out;
    });
}
