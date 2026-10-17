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
    const out = mergeById({
        local: store.notes, remote: remote.notes, localGone: store.gone, remoteGone: remote.gone, now,
        accept: n => !!n && typeof n === 'object' && n.id != null && String(n.id) !== '',
        clone: cleanNote,
    });
    store.gone = out.gone;
    // 합친 메모가 가리키는 폴더가 이 탭에 없으면 서버에서 (이름째)
    if (!Array.isArray(store.folders)) store.folders = [];
    const have = new Set(store.folders.map(f => String(f?.id)));
    const used = new Set(store.notes.map(n => n.folder).filter(Boolean));
    for (const f of Array.isArray(remote.folders) ? remote.folders : []) {
        if (!f?.id || have.has(String(f.id)) || !used.has(String(f.id))) continue;
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
