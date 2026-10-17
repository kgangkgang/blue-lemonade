// 용어집 — 다른 기기와 합치기 (7.0.1, 번역 2.7.5). 공용 규칙은 ../../settings-merge.js.
// 항목 { id, scope, src, dst, updated } — updated 는 2.7.5 부터 더하거나 고칠 때 적는다(옛 항목은 없음 = 가장 오래된 것).
// 지운 항목 · 겹쳐서 합쳐진 항목은 glossary_gone: { id: 시각 } 에 남겨 다른 기기의 옛 목록이 되살리지 못하게 한다.
// 범위(scope)는 'global' · 캐릭터 아바타 · 'group:<id>' 모두 같은 배열이라 그룹 · 멤버 용어집도 같은 규칙으로 합쳐진다.
// 문단 캐시 서명에는 updated 를 빼고 넣는다(glossarySignature) — 고친 시각만 바뀐 것으로 캐시가 버려지지 않게, 옛 캐시도 그대로 맞게.
import { mergeById, markGone, tidyGone } from '../../settings-merge.js';

export const GONE_KEY = 'glossary_gone';

/** 서명 재료: updated 만 뺀 항목들 (나머지 열쇠 · 차례는 그대로 → 2.7.4 까지의 서명과 같은 JSON) */
export function glossarySignature(entries) {
    if (!Array.isArray(entries)) return entries ?? null;
    return entries.map(entry => {
        if (!entry || typeof entry !== 'object' || !('updated' in entry)) return entry;
        const { updated, ...rest } = entry;
        return rest;
    });
}

/** 서버에서 온 항목 한 개 (모양이 맞는 것만) */
export const acceptEntry = e => !!e && typeof e === 'object' && e.id != null && String(e.id) !== '' && typeof e.src === 'string' && typeof e.dst === 'string';
export function cleanEntry(e) {
    const out = { id: String(e.id), scope: String(e.scope ?? 'global'), src: String(e.src), dst: String(e.dst) };
    for (const [key, value] of Object.entries(e)) if (!(key in out) && key !== 'updated') out[key] = value;
    const n = Number(e.updated);
    if (Number.isFinite(n) && n > 0) out.updated = n;
    return out;
}

/** 지운(또는 겹쳐 합쳐져 사라진) 항목 기록 */
export function glossaryGone(settings, id, now = Date.now()) {
    if (!settings || id == null) return;
    const g = settings[GONE_KEY];
    if (!g || typeof g !== 'object' || Array.isArray(g)) settings[GONE_KEY] = {};
    markGone(settings[GONE_KEY], id, now);
}

/** 순수: 이 탭의 번역 설정 settings 에 서버의 번역 설정 server 를 합친다. { pulled, removed, needSave, changed } */
export function mergeGlossary(settings, server, now = Date.now()) {
    if (!settings) return null;
    if (!Array.isArray(settings.glossary_entries)) settings.glossary_entries = [];
    const remote = server && typeof server === 'object' ? server : {};
    const out = mergeById({ local: settings.glossary_entries, remote: remote.glossary_entries, localGone: settings[GONE_KEY], remoteGone: remote[GONE_KEY], now, accept: acceptEntry, clone: cleanEntry });
    settings[GONE_KEY] = tidyGone(out.gone, now);
    return out;
}

export function glossaryMessage({ pulled = 0, removed = 0 } = {}) {
    if (pulled && removed) return `다른 기기의 용어집 ${pulled}개를 가져오고 ${removed}개를 뺐어요.`;
    if (pulled) return `다른 기기의 용어집 ${pulled}개를 가져왔어요.`;
    if (removed) return `다른 기기에서 지운 용어집 ${removed}개를 뺐어요.`;
    return '';
}
