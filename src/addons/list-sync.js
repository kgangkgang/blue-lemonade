// 7.0.2 애드온 목록 · 글 칸 기기 간 합치기 — 7.0.1 의 메모 · 용어집 합치기(../settings-merge.js)를 다른 애드온 자료로 넓힌다.
// 실리태번 saveSettings 는 extension_settings 를 통째로 덮어써서, 다른 기기의 옛 탭이 아무 설정이나 저장하면 이 기기에서 더한
// 다시 쓰기 금지 묘사 · 예외, 전개 지시 저장 목록, TTS 발음 사전 · 음소거 낱말이 서버에서 사라졌다.
//   mergeLists(store, server, lists, now)       순수: lists = [{ field, gone, stamp? }] — id 목록마다 mergeById (지운 기록 store[gone])
//   mergeTextFields(store, server, fields, key)  순수: 글 한 칸짜리 — 칸마다 고친 시각(store[key][칸])이 늦은 쪽 값
//   touch(item) · listGone(store, gone, id) · stampText(store, key, field)   고치는 자리에서 부른다
//   registerAddonMerge(name, { module, lists, text, stampKey, onChange }) + startSettingsMerge (애드온이 켜질 때 한 번)
import { mergeById, markGone, tidyGone, registerSettingsMerge, startSettingsMerge } from '../settings-merge.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** 목록 항목을 고친 시각 */
export function touch(item, now = Date.now()) { if (isObj(item)) item.updated = now; return item; }
/** 지운 항목 기록 (store[gone] = { id: 지운 시각 }) */
export function listGone(store, gone, id, now = Date.now()) {
    if (!isObj(store) || id == null) return;
    if (!isObj(store[gone])) store[gone] = {};
    markGone(store[gone], id, now);
}
/** 글 칸을 고친 시각 (store[key][field]) */
export function stampText(store, key, field, now = Date.now()) {
    if (!isObj(store)) return;
    if (!isObj(store[key])) store[key] = {};
    store[key][field] = now;
}

/** 순수: id 목록 합치기. 돌려줌 { pulled, removed, needSave, changed } */
export function mergeLists(store, server, lists, now = Date.now()) {
    const out = { pulled: 0, removed: 0, needSave: false, changed: false };
    if (!isObj(store)) return out;
    const remote = isObj(server) ? server : {};
    for (const { field, gone, stamp = null } of lists || []) {
        if (!Array.isArray(store[field])) continue;   // 아직 만들지 않은 목록은 건드리지 않는다
        const r = mergeById({ local: store[field], remote: remote[field], localGone: store[gone], remoteGone: remote[gone], now,
            accept: item => isObj(item) && item.id != null && String(item.id) !== '', clone: item => JSON.parse(JSON.stringify(item)), stamp });
        store[gone] = tidyGone(r.gone, now);
        out.pulled += r.pulled; out.removed += r.removed;
        if (r.needSave) out.needSave = true;
        if (r.changed) out.changed = true;
    }
    return out;
}

/** 순수: 글 칸 합치기 — 서버 칸의 고친 시각이 늦으면 서버 값, 이 탭이 늦으면 다음 저장이 되돌리게. 돌려줌 { pulled, needSave, changed, fields } */
export function mergeTextFields(store, server, fields, key) {
    const out = { pulled: 0, needSave: false, changed: false, fields: [] };
    if (!isObj(store)) return out;
    const remote = isObj(server) ? server : {};
    const mine = isObj(store[key]) ? store[key] : {}, theirs = isObj(remote[key]) ? remote[key] : {};
    for (const field of fields || []) {
        const a = Number(mine[field]) || 0, b = Number(theirs[field]) || 0;
        if (b > a && typeof remote[field] === 'string') {
            if (store[field] !== remote[field]) { store[field] = remote[field]; out.fields.push(field); out.changed = true; out.pulled++; }
            if (!isObj(store[key])) store[key] = {};
            store[key][field] = b;
        } else if (a > b) out.needSave = true;
    }
    return out;
}

/**
 * 애드온 하나의 합치기를 건다. store() = 이 탭의 extension_settings[module] (없으면 null), save = 실리태번 saveSettingsDebounced,
 * onChange(out) = 받은 것이 있을 때 다시 그리기. 해제 함수를 돌려준다
 */
export function registerAddonMerge(name, { module, store, lists = [], text = [], stampKey = 'field_stamps', save, onChange } = {}) {
    const off = registerSettingsMerge(name, ext => {
        const local = store?.();
        if (!isObj(local)) return null;
        const server = ext?.[module];
        const a = mergeLists(local, server, lists);
        const b = text.length ? mergeTextFields(local, server, text, stampKey) : { pulled: 0, needSave: false, changed: false, fields: [] };
        const out = { pulled: a.pulled + b.pulled, removed: a.removed, needSave: a.needSave || b.needSave, changed: a.changed || b.changed, fields: b.fields };
        if (out.changed) { try { onChange?.(out); } catch (error) { console.warn('[Blue Lemonade] 합친 뒤 다시 그리기', name, error); } }
        return out;
    });
    startSettingsMerge({ save });
    return off;
}
