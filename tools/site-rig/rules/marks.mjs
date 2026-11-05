// 수집기가 「나쁨」으로 표시한 것(테마 census/rules/marks.mjs 사본): 보이는 스크롤 막대 · 화살표 없는 고르기 상자
export const id = 'mark';
export const title = '보이는 스크롤 막대 · 화살표 없는 고르기';
export function afterAll({ variants }) {
    const out = [];
    for (const v of variants) if (v.ours && (v.kind === 'scroll' || v.kind === 'select') && (v.examples || []).some(e => e.bad)) out.push({ key: `${v.kind}|${v.sig}`, msg: `${v.kind} 「${v.sig}」 ×${v.count} · ${v.where.slice(0, 3).join(' / ')}` });
    return out;
}
