// 7.0.2 테마 설정(salty) 기기 간 합치기 — 폰 · PC 를 번갈아 쓸 때 다른 기기의 옛 탭이 한 번 저장하면 이쪽에서 만든 내 스타일 · 액자 · 글꼴 ·
// 날씨 그림 · 치환/캡처 프리셋 · 프롬프트 귀속 같은 보관함이 사라지던 것(실리태번은 extension_settings 를 통째로 저장한다).
//
// 세 갈래 합치기: 이 탭이 마지막으로 서버와 맞춘 값(base — 시작할 때 읽은 값 · 저장이 끝날 때마다 · 합친 뒤) · 지금 탭(local) · 지금 서버(remote).
//   한쪽만 바꾼 것은 바꾼 쪽, 둘 다 바꿨으면 안으로 들어가 다시(객체는 열쇠마다, id 가 있는 목록은 id 마다), 그래도 부딪히면 이 탭.
//   id 목록: 서버에만 있고 base 에 없던 것 = 다른 기기가 더함 → 더함 · base 에 있던 것이 이 탭에 없으면 = 이 탭이 지움 → 안 되살림 ·
//            base 에 있던 것이 서버에 없으면 = 다른 기기가 지움 → 뺌(이 탭이 그 뒤로 고쳤으면 남김).
// 이 탭이 salty 를 하나도 안 바꿨으면 서버 값을 그대로 받는다 → 합치기 저장(settings-merge.js)이 이 탭의 옛 salty 로 서버를 덮지 않는다.
// 메모 · 용어집과 같은 공용 길(settings-merge.js: 탭이 1분 넘게 숨었다 다시 보일 때 서버를 한 번 읽음)에 「salty」로 등록하고, 애드온과 무관하게 늘 건다.
import { registerSettingsMerge, startSettingsMerge } from './settings-merge.js';
import { layoutMergeView } from './device-layouts.js';

const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const idList = v => Array.isArray(v) && v.length > 0 && v.every(item => isObj(item) && (typeof item.id === 'string' || typeof item.id === 'number'));

function mergeIdList(base, local, remote) {
    const baseById = new Map((Array.isArray(base) ? base : []).filter(isObj).map(item => [String(item.id), item]));
    const localById = new Map(local.map(item => [String(item.id), item]));
    const remoteById = new Map(remote.map(item => [String(item.id), item]));
    const out = [];
    for (const item of local) {
        const id = String(item.id), other = remoteById.get(id), was = baseById.get(id);
        if (!other) { if (was && same(item, was)) continue; out.push(item); continue; }   // 다른 기기가 지움 (이 탭이 안 고쳤으면 뺀다)
        out.push(merge3(was, item, other));
    }
    for (let i = 0; i < remote.length; i++) {
        const item = remote[i], id = String(item.id);
        if (localById.has(id) || baseById.has(id)) continue;   // 이미 있음 · 이 탭이 지운 것
        let at = 0;   // 서버 차례에서 바로 앞 이웃 뒤에
        for (let j = i - 1; j >= 0; j--) { const k = out.findIndex(x => String(x.id) === String(remote[j].id)); if (k >= 0) { at = k + 1; break; } }
        out.splice(at, 0, clone(item));
    }
    return out;
}

/** 세 갈래 합치기 (순수). base: 마지막으로 서버와 맞춘 값, local: 지금 탭, remote: 지금 서버 */
export function merge3(base, local, remote) {
    if (same(local, remote)) return local;
    if (same(local, base)) return clone(remote);
    if (same(remote, base)) return local;
    if (isObj(local) && isObj(remote)) {
        const out = {};
        const b = isObj(base) ? base : {};
        for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
            const inLocal = key in local, inRemote = key in remote, inBase = key in b;
            if (inLocal && inRemote) out[key] = merge3(b[key], local[key], remote[key]);
            else if (inLocal) { if (!(inBase && same(local[key], b[key]))) out[key] = local[key]; }   // 서버에서 지워졌고 이 탭이 안 고쳤으면 따라 지움
            else if (!inBase || !same(remote[key], b[key])) out[key] = clone(remote[key]);   // 서버가 새로 더하거나 고친 것 (이 탭이 지운 것은 안 되살림)
        }
        return out;
    }
    if (Array.isArray(local) && Array.isArray(remote) && (idList(local) || !local.length) && (idList(remote) || !remote.length)) return mergeIdList(base, local, remote);
    return local;   // 둘 다 다르게 바꾼 값(글자 · 숫자 · id 없는 목록) — 이 탭이 이긴다
}

/**
 * salty 를 제자리에서 합친다 (뿌리 객체는 그대로 — 설정 창 · 다른 모듈이 잡고 있다).
 * 돌려줌: { changed: 탭 값이 바뀌었나, needSave: 합친 값이 서버와 다른가(이 탭만 가진 것 → 다음 저장이 서버에 되돌린다) }
 */
export function mergeSalty(salty, base, remote) {
    if (!isObj(salty) || !isObj(remote)) return { changed: false, needSave: false };
    const merged = merge3(base, salty, remote);
    const changed = !same(merged, salty);
    if (changed) {
        for (const key of Object.keys(salty)) if (!(key in merged)) delete salty[key];
        Object.assign(salty, merged);
    }
    return { changed, needSave: !same(merged, remote) };
}

let base = null, started = false, readFrom;   // readFrom: 서버 읽기를 시작할 때의 base (읽는 사이 이 탭 저장이 끝나 base 가 옮겨 가도 그때 것으로 견줘요)
/** 테마 시작 때 한 번 (애드온과 무관). hooks: { getSalty, save, after } */
export function startThemeSettingsSync({ getSalty, save, after } = {}) {
    if (started || typeof getSalty !== 'function') return;
    started = true;
    const snap = () => { try { base = clone(getSalty() ?? null); } catch { base = null; } };
    snap();   // 시작할 때 읽은 값 = 서버와 맞춘 값
    try {
        const { eventSource, event_types } = SillyTavern.getContext();
        if (event_types?.SETTINGS_UPDATED) eventSource.on(event_types.SETTINGS_UPDATED, snap);   // 저장이 끝남 = 서버가 이 탭 값을 가짐
    } catch { /* 이벤트가 없으면 합치기 뒤에만 base 를 옮긴다 */ }
    registerSettingsMerge('salty', ext => {
        // 읽는 사이 이 탭 저장이 끝나면(SETTINGS_UPDATED → base = 이 탭 값) 서버가 먼저 내준 옛 값이 「서버가 바꿈」으로 보여
        // 방금 저장한 이 탭 값을 되돌렸어요 — 읽기를 시작할 때의 base 로 견줘요
        const from = readFrom !== undefined ? readFrom : base;
        readFrom = undefined;
        const salty = getSalty(), remote = ext?.salty;
        if (!isObj(salty) || !isObj(remote)) return null;
        const view = layoutMergeView(salty);   // 기기별 배치: 위 칸은 이 기기 배치끼리 견줘요 (device-layouts.js)
        const result = mergeSalty(salty, view(from), view(remote));
        view.settle();
        base = clone(remote);   // 서버 값까지는 맞췄다 — 이 탭만 가진 것은 다음 저장이 서버로
        if (result.changed) { try { after?.(); } catch (error) { console.warn('[Blue Lemonade] 설정 합친 뒤 다시 적용', error); } }
        return { pulled: result.changed ? 1 : 0, removed: 0, needSave: result.needSave };
    }, { begin: () => { readFrom = base; } });
    startSettingsMerge({ save });
}

/** 시험용 */
export const _forTest = { base: () => base, setBase: v => { base = v; }, reset: () => { base = null; started = false; readFrom = undefined; } };
