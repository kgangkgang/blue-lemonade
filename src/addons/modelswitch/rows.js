// 모델 전환 6.4.5 목록 규칙 — 실리태번을 import 하지 않는 순수 모듈 (node 시험: tools/tests/modelswitch-links.mjs)
//  · 「(검열되면)」 줄은 꺼져 있으면 숨긴다. 꺼짐 = enabled false · 제공처 빈 글 · 모델 빈 글 (실제로 다시 보내지 않는 상태 — fallback.js fallbackOf 와 같다).
//    켜는 곳은 각 기능 설정 창의 「검열당했을 때」 칸 (fallback-field.js). 켜면 본 줄 바로 밑에 나온다 (fallback.js pairFallbacks)
//  · 고르기 단추 둘: 「전체」 = 일반 줄 · 「검열되면」 = 보이는 「(검열되면)」 줄 — 그 줄들이 모두 켜져 있으면 모두 끄고, 아니면 모두 켠다
const isObj = value => !!value && typeof value === 'object' && !Array.isArray(value);

/** id 가 「<본 id>-fallback」 인 대상 (아는 확장 · 스스로 등록한 확장 모두) */
export const isFallbackRow = target => String(target?.id ?? '').endsWith('-fallback');

/** fallback 칸 { enabled, provider, model } 이 켜져 있나 */
export const fallbackOn = fb => isObj(fb) && fb.enabled !== false && !!String(fb.provider ?? '').trim() && !!String(fb.model ?? '').trim();

/** 목록에 보일 줄인가 — 일반 줄은 늘, 「(검열되면)」 줄은 켜져 있을 때만 (active() 가 있으면 그것, 없으면 read() 로: 제공처 · 모델이 있어야 켜짐) */
export function rowShown(target) {
    if (!isFallbackRow(target)) return true;
    if (typeof target.active === 'function') { try { return !!target.active(); } catch { return false; } }
    let now = null;
    try { now = target.read?.(); } catch { now = null; }
    return isObj(now) && !now.follow && !!String(now.source ?? '').trim() && !!String(now.model ?? '').trim();
}

/** 보일 줄만 (차례 그대로) */
export const visibleRows = list => (Array.isArray(list) ? list : []).filter(rowShown);

/**
 * 고르기 단추: group 'main'(일반 줄) · 'fallback'(「(검열되면)」 줄) — rows 는 보이는 줄.
 * 그 묶음이 모두 켜져 있으면 모두 끄고, 아니면 모두 켠다 → 바꿀 값 { [id]: true|false } (빈 묶음이면 {})
 */
export function toggleGroup(rows, group, isOn) {
    const pick = (Array.isArray(rows) ? rows : []).filter(target => (group === 'fallback') === isFallbackRow(target));
    if (!pick.length) return {};
    const allOn = pick.every(target => isOn(target));
    return Object.fromEntries(pick.map(target => [target.id, !allOn]));
}

/** 그 묶음이 지금 모두 켜져 있나 (단추 눌림 표시) — 빈 묶음이면 false */
export function groupOn(rows, group, isOn) {
    const pick = (Array.isArray(rows) ? rows : []).filter(target => (group === 'fallback') === isFallbackRow(target));
    return pick.length > 0 && pick.every(target => isOn(target));
}
