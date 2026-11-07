// 1.0.7 한글화 패널 — 원문이 바뀐 항목은 바뀐 줄 · 문단만 다시 번역(11-08 사용자 「월드인포 내용 바뀌면 캐시 저장해서 바뀐 문단만 다시 번역 ·
//   지금은 다 삭제했다가 다시 해야 해서 월드인포 바꿀 때마다 힘들다」). DOM · 실리태번 없이 도는 순수 함수(node 시험: tools/tests/prompt-paragraph-reuse.mjs).
// 번역할 때의 원문을 같이 저장해 두고(index.js `…::src`), 원문이 바뀌면 예전 원문 · 예전 번역을 같은 단위로 나눠 맞대요:
//   예전 원문의 단위 수와 예전 번역의 단위 수가 같을 때만 「i번째 원문 ↔ i번째 번역」으로 믿고, 새 원문에서 글자 그대로 남은 단위는 그 번역을 다시 써요.
//   단위는 줄(빈 줄로 문단을 나누지 않은 월드인포가 많아요) → 안 맞으면 문단(빈 줄) → 그래도 안 맞으면 맞대기 포기(통째 번역).

const UNITS = [
    { kind: 'line', sep: '\n', split: text => text.split('\n') },
    { kind: 'paragraph', sep: '\n\n', split: text => text.split(/\n[ \t]*\n/) },
];
const blank = s => !String(s).trim();
const norm = s => String(s ?? '').replace(/\r\n?/g, '\n').trim();

/**
 * @param {string} oldSource 지난번 번역할 때의 원문
 * @param {string} oldTranslation 그때의 번역(본문만 — 제목 · 주석을 뗀 것)
 * @param {string} newSource 지금 원문
 * @returns {null | { kind: 'line'|'paragraph', sep: string, units: { source: string, translation: string|null }[], missing: number[] }}
 *   null = 맞댈 수 없어요(통째로 다시 번역) · missing = 새로 번역할 단위 번호(빈 단위는 그대로 두니 안 들어가요)
 */
export function planReuse(oldSource, oldTranslation, newSource) {
    const before = norm(oldSource), done = norm(oldTranslation), now = norm(newSource);
    if (!before || !done || !now) return null;
    for (const unit of UNITS) {
        const a = unit.split(before), b = unit.split(done);
        if (a.length < 2 || a.length !== b.length) continue;
        // 빈 단위 자리도 맞아야 해요(원문이 빈 줄인 자리에 번역 글이 있으면 어긋난 것)
        if (a.some((s, i) => blank(s) !== blank(b[i]))) continue;
        const pool = new Map();
        a.forEach((s, i) => { if (blank(s)) return; const key = s.trim(); if (!pool.has(key)) pool.set(key, []); pool.get(key).push(b[i]); });
        const units = unit.split(now).map((s) => {
            if (blank(s)) return { source: s, translation: s };
            const queue = pool.get(s.trim());
            return { source: s, translation: queue?.length ? queue.shift() : null };
        });
        const missing = units.map((u, i) => (u.translation === null ? i : -1)).filter(i => i >= 0);
        return { kind: unit.kind, sep: unit.sep, units, missing };
    }
    return null;
}

/** 다시 번역할 단위들을 한 번에 보낼 글 */
export const missingText = plan => plan.missing.map(i => plan.units[i].source.trim()).join(plan.sep);

/**
 * 받은 번역을 빈 자리에 채워 본문을 다시 짜요.
 * @returns {string|null} 받은 단위 수가 빈 자리 수와 다르면 null(통째로 다시 번역)
 */
export function fillPlan(plan, translated) {
    let parts = [];
    if (plan.missing.length) {
        parts = norm(translated).split(plan.kind === 'line' ? '\n' : /\n[ \t]*\n/).filter(s => !blank(s));
        if (parts.length !== plan.missing.length) return null;
    }
    const units = plan.units.map(u => u.translation);
    plan.missing.forEach((at, k) => { units[at] = parts[k].trim(); });
    return units.join(plan.sep).trim();
}

/** 다시 보낼 몫이 이만큼을 넘으면 통째로 다시 번역해요(앞뒤 맥락이 더 나아요) */
export const REUSE_MAX_SHARE = 0.6;
export const worthReusing = plan => !!plan && plan.missing.length <= Math.max(1, Math.floor(plan.units.filter(u => !blank(u.source)).length * REUSE_MAX_SHARE));
