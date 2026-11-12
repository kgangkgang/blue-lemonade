// 1.1.8 「블루레몬 추천」 기본 글꾸 — 사용자가 고른 글꾸 마트 심플 틀을 테마에 다시 실어요(사용자 「테마가 너무 밋밋」 11-12 · 고른 목록은 tools/mart/picks-gen.mjs PICKS).
//   꼴은 마트에서 받은 글꾸(「테마로 담기」 → 내 글꾸 { id, name, emoji, frame, set })와 같아요: id 가 마트 id 그대로라 조절 화면 · 틀별 상한표 · 그리기가 받은 글꾸와 한 길이에요.
//   같은 틀을 마트에서 받아 둔 사람은 그 받은 글꾸(조절 값 포함)가 이겨요 — 추천 줄에서는 빠지고 「내 글꾸」에만 있어요(겹치지 않게).
//   시리즈 판(고양이 셋 · 플라밍고 둘 · 기타 셋 · 분노 셋 · 속보 둘 · 카메라 셋)은 칩 하나 + 옆 꺾쇠로 판을 골라요 · 고른 판은 logCopy.pickVar[묶음] 에 · 조절 값은 logCopy.pickSet[id] 에(받은 틀 칸을 늘리지 않아요).
//   자료(log-copy-picks.gen.js · 압축)는 로그 복사 창을 열 때만 받아요(시작 그래프 밖). 풀 수 없는 브라우저(DecompressionStream 없음)는 추천 줄 없이 예전 그대로예요.
import { PICKS_Z, PICKS_GROUPS } from './log-copy-picks.gen.js';

export const PICK_CATEGORY = Object.freeze({ id: 'pick', label: '블루레몬 추천' });
export { PICKS_GROUPS };

async function unpack(z) {
    if (typeof DecompressionStream !== 'function' || typeof atob !== 'function') return [];
    const bytes = Uint8Array.from(atob(z), ch => ch.charCodeAt(0));
    const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    return JSON.parse(text).map(([id, name, emoji, frame]) => Object.freeze({ id, name, emoji, frame }));
}
let cache = null;
/** 추천 글꾸 등록 값 목록(한 번 풀어 두고 다시 써요) — 못 풀면 빈 목록 */
export const loadPicks = () => (cache ??= unpack(PICKS_Z).catch(() => { cache = null; return []; }));

const ownIds = customs => new Set((customs ?? []).map(c => c?.id));
/** 묶음 하나 → 그 판 id 들 */
export const groupOf = id => PICKS_GROUPS.find(g => g.ids.includes(id)) ?? null;

/**
 * 추천 줄 칩 — 묶음마다 { group, name, emoji, ids(보이는 판), labels, current(지금 고른 판) }. 내 글꾸에 같은 id 가 있는 판은 빼요(받은 쪽이 이겨요).
 * @param {object[]} picks loadPicks() 결과
 * @param {object[]} customs logCopy.custom
 * @param {object} chosen logCopy.pickVar — { 묶음 id: 판 id }
 */
export function pickChips(picks, customs = [], chosen = {}) {
    const own = ownIds(customs), byId = new Map(picks.map(p => [p.id, p]));
    const out = [];
    for (const g of PICKS_GROUPS) {
        const at = g.ids.map((id, i) => [id, i]).filter(([id]) => byId.has(id) && !own.has(id));
        if (!at.length) continue;
        const ids = at.map(([id]) => id);
        out.push({ group: g.id, name: g.name, emoji: byId.get(ids[0]).emoji, ids, labels: at.map(([, i]) => g.labels[i]), current: ids.includes(chosen?.[g.id]) ? chosen[g.id] : ids[0] });
    }
    return out;
}

/** 보이는 추천 글꾸 id 전부(내 글꾸와 겹치는 것 빼고) */
export const pickIds = (picks, customs = []) => { const own = ownIds(customs); return picks.filter(p => !own.has(p.id)).map(p => p.id); };

const fresh = new Map();   // 조절 값이 아직 없는 판의 기본 값 — 같은 판은 같은 객체(조절 화면이 「안 바뀜」을 === 로 봐요)
/**
 * 추천 글꾸 하나 → 내 글꾸와 같은 꼴(시트 custom() 이 돌려주는 것). 내 글꾸에 같은 id 가 있거나 없는 id 면 null.
 *   set 을 고치면 logCopy.pickSet[id] 에 적어요(저장은 부르는 쪽 saveSettings).
 * @param {() => object} store logCopy 를 돌려주는 함수(설정을 다시 읽으면 새 객체 — 적을 때마다 새로 읽어요)
 */
export function pickEntry(picks, customs, id, store) {
    if (ownIds(customs).has(id)) return null;
    const p = picks.find(x => x.id === id);
    if (!p) return null;
    return { id: p.id, name: p.name, emoji: p.emoji, html: '', frame: p.frame, slot: null, pick: true,
        get set() { const own = store().pickSet?.[p.id]; if (own) return own; if (!fresh.has(p.id)) fresh.set(p.id, { blGeulkku: 2 }); return fresh.get(p.id); },
        set set(value) { const s = store(); s.pickSet = { ...(s.pickSet ?? {}), [p.id]: value }; } };
}

/** 판 고르기 — 고른 판을 묶음에 적어요(저장은 부르는 쪽) · 묶음이 없는 id 면 false */
export function choosePick(store, id) {
    const g = groupOf(id);
    if (!g) return false;
    const s = store();
    s.pickVar = { ...(s.pickVar ?? {}), [g.id]: id };
    return true;
}
